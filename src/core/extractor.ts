import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";
import { PDFDocument } from "pdf-lib";
import path from "path";

import { loadInput } from "../pdf/loader";
import { extractFonts } from "../pdf/fonts";
import { normalizeMetaInfo } from "../pdf/metadata";
import { processPage } from "./pageProcessor";
import { detectSource, detectPrintPDF } from "./sourceDetector";
import { PDFResult, ExtractOptions } from "../types";

// Disable worker in Node.js environment
(pdfjsLib as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc = "";

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

  // realFontMap: { "F4": FontInfo, "F7": FontInfo, … } keyed by PDF resource name
  const realFontMap = await extractFonts(pdfDoc);

  const pages = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);

    const pageData = await processPage(
      page as Parameters<typeof processPage>[0],
      i,
      pdfDoc,
      i - 1,       // 0-based page index for pdf-lib
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
