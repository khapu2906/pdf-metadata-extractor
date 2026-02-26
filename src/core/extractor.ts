import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { PDFDocument } from "pdf-lib";
import path from "path";
import { pathToFileURL } from "url";

import { loadInput } from "../pdf/loader";
import { extractFonts } from "../pdf/fonts";
import { normalizeMetaInfo } from "../pdf/metadata";
import { processPage } from "./pageProcessor";
import { detectSource, detectPrintPDF } from "./sourceDetector";
import { PDFResult, ExtractOptions } from "../types";

// pdfjs v5 fake-worker mode: the library dynamically imports workerSrc on the
// same thread when no real Web Worker is available.  An empty string no longer
// works — we must supply a resolvable file:// URL so Node's dynamic import()
// can load the worker module.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _workerPath = (require as NodeRequire).resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
(pdfjsLib as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
  pathToFileURL(_workerPath).href;

export async function extractPDF(
  input: string | Buffer,
  options: ExtractOptions = {}
): Promise<PDFResult> {
  void options;

  const buffer = await loadInput(input);

  const loadingTask = (pdfjsLib as unknown as {
    getDocument(params: { data: Uint8Array; useSystemFonts: boolean }): { promise: Promise<unknown> };
  }).getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise as {
    numPages: number;
    getMetadata(): Promise<unknown>;
    getPage(n: number): Promise<unknown>;
  };

  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });

  const rawMeta  = await pdf.getMetadata().catch(() => ({}));
  const meta     = rawMeta as { info?: unknown; metadata?: unknown };
  const metaInfo = normalizeMetaInfo(meta?.info ?? {});

  // realFontMap: { "F4": FontInfo, "F7": FontInfo, … }
  const realFontMap = await extractFonts(pdfDoc);

  const pages = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);

    const pageData = await processPage(
      page as Parameters<typeof processPage>[0],
      i,
      pdfDoc,
      i - 1,
      realFontMap
    );
    pages.push(pageData);
  }

  return {
    file:       typeof input === "string" ? path.basename(input) : undefined,
    totalPages: pdf.numPages,
    source:     detectSource(metaInfo, null),
    isPrintPDF: detectPrintPDF(metaInfo),
    info:       metaInfo as Record<string, unknown>,
    fonts:      Object.values(realFontMap),
    pages,
  };
}
