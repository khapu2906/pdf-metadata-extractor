import zlib from "zlib";
import { PDFDocument, PDFName, PDFDict } from "pdf-lib";
import { TextElement } from "../types";

// ─── Bounding box helpers (kept for backwards-compat) ────────────────────────

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getBoundingBox(elements: TextElement[]): BoundingBox | null {
  if (elements.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const el of elements) {
    const w = el.width ?? 0;
    const h = el.height ?? el.fontSize;
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + w);
    maxY = Math.max(maxY, el.y + h);
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function filterByRegion(elements: TextElement[], box: BoundingBox): TextElement[] {
  return elements.filter(
    (el) =>
      el.x >= box.x &&
      el.y >= box.y &&
      el.x <= box.x + box.width &&
      el.y <= box.y + box.height
  );
}

// ─── Content-stream helpers ──────────────────────────────────────────────────

/**
 * Read the raw bytes of a pdf-lib object that represents a content stream.
 */
function streamContents(obj: unknown): Buffer | null {
  if (obj && typeof (obj as { contents?: unknown }).contents !== "undefined") {
    return Buffer.from((obj as { contents: Uint8Array }).contents);
  }
  return null;
}

/**
 * Try zlib inflate, inflate-raw, then return raw bytes as latin1.
 */
function decompress(raw: Buffer): string {
  try { return zlib.inflateSync(raw).toString("latin1"); } catch { /* */ }
  try { return zlib.inflateRawSync(raw).toString("latin1"); } catch { /* */ }
  return raw.toString("latin1");
}

/**
 * Resolve and decompress one or more content stream references into a string.
 */
function resolveStreams(
  pdfDoc: PDFDocument,
  contentsRef: unknown
): string {
  if (!contentsRef) return "";
  const contents = pdfDoc.context.lookup(
    contentsRef as Parameters<typeof pdfDoc.context.lookup>[0]
  );

  // Single stream
  const single = streamContents(contents);
  if (single) return decompress(single);

  // PDFArray of streams
  const arr = contents as { size?(): number; get?(i: number): unknown } | undefined;
  if (arr && typeof arr.size === "function") {
    const parts: string[] = [];
    for (let i = 0; i < arr.size(); i++) {
      const ref = arr.get!(i);
      const s   = pdfDoc.context.lookup(
        ref as Parameters<typeof pdfDoc.context.lookup>[0]
      );
      const raw = streamContents(s);
      if (raw) parts.push(decompress(raw));
    }
    return parts.join("\n");
  }

  return "";
}

/**
 * Collect all Form-XObject content streams referenced by a stream (recursively).
 * This handles PDFs where text lives inside /Form XObjects rather than the page stream.
 *
 * @param pdfDoc     — pdf-lib document
 * @param resourcesRef — the Resources dict for the current stream scope
 * @param streamText   — already-decompressed text of the current stream
 * @param visited      — guard against circular references
 */
function collectXObjectStreams(
  pdfDoc: PDFDocument,
  resourcesRef: unknown,
  streamText: string,
  visited: Set<string>,
  depth: number
): string[] {
  if (depth <= 0) return [];

  const extra: string[] = [];

  try {
    const resDict = pdfDoc.context.lookupMaybe(
      resourcesRef as Parameters<typeof pdfDoc.context.lookupMaybe>[0],
      PDFDict
    );
    if (!resDict) return extra;

    const xobjDictRef = resDict.get(PDFName.of("XObject"));
    if (!xobjDictRef) return extra;

    const xobjDict = pdfDoc.context.lookupMaybe(xobjDictRef, PDFDict);
    if (!xobjDict) return extra;

    // Find all /Name Do operators in the stream
    const doNames = new Set(
      [...streamText.matchAll(/\/([^\s/\[\]<>(){}]+)\s+Do/g)].map((m) => m[1])
    );

    for (const name of doNames) {
      const xobjRef = xobjDict.get(PDFName.of(name));
      if (!xobjRef) continue;

      const xobj = pdfDoc.context.lookup(
        xobjRef as Parameters<typeof pdfDoc.context.lookup>[0]
      );

      // Only process Form XObjects (Subtype = Form)
      const subtype = (xobj as { dict?: PDFDict })?.dict?.get(PDFName.of("Subtype"));
      const subtypeStr = subtype?.toString?.()?.replace(/^\//, "");
      if (subtypeStr !== "Form") continue;

      const raw = streamContents(xobj);
      if (!raw) continue;

      const key = raw.toString("hex").slice(0, 32);
      if (visited.has(key)) continue;
      visited.add(key);

      const text = decompress(raw);
      extra.push(text);

      // Recurse: XObjects can reference their own sub-XObjects
      const innerResRef = (xobj as { dict?: PDFDict })?.dict?.get(PDFName.of("Resources"));
      const nested = collectXObjectStreams(pdfDoc, innerResRef, text, visited, depth - 1);
      extra.push(...nested);
    }
  } catch { /* ignore */ }

  return extra;
}

/**
 * Decompress and return a page's full content text — including any Form XObject
 * sub-streams that pdfjs would process when extracting text.
 * `pageIndex` is 0-based (pdf-lib convention).
 */
export function getContentStreamText(pdfDoc: PDFDocument, pageIndex: number): string {
  try {
    const page        = pdfDoc.getPage(pageIndex);
    const contentsRef = page.node.get(PDFName.of("Contents"));
    const mainText    = resolveStreams(pdfDoc, contentsRef);

    const resourcesRef = page.node.get(PDFName.of("Resources"));
    const visited      = new Set<string>();
    const xobjTexts    = collectXObjectStreams(pdfDoc, resourcesRef, mainText, visited, 4);

    return [mainText, ...xobjTexts].join("\n");
  } catch { /* ignore */ }

  return "";
}

/**
 * Extract the ordered list of unique PDF resource font keys from combined stream text.
 * PDF names can contain hyphens/plus signs (e.g. "f-0-0", "F4+sub").
 * e.g. "/F4 42 Tf … /f-0-0 10 Tf … /F4 8 Tf" → ["F4", "f-0-0"]
 */
export function streamFontOrder(streamText: string): string[] {
  const seen    = new Set<string>();
  const ordered: string[] = [];
  // Match /FontName size Tf — FontName is any PDF name (no whitespace or delimiters)
  for (const m of streamText.matchAll(/\/([^\s/\[\]<>(){}]+)\s+[\d.]+\s+Tf/g)) {
    const key = m[1];
    if (!seen.has(key)) { seen.add(key); ordered.push(key); }
  }
  return ordered;
}

/**
 * Build a bridge map:  pdfjsKey → pdfResourceKey
 *
 * pdfjs-dist assigns keys like g_d1_f2 in first-appearance order matching the
 * content stream Tf commands.  The docId (d0, d1 …) is global across all
 * documents in the same process, so we match by position rather than by name.
 *
 * @param streamText        — full content text (main + XObject streams)
 * @param pdfjsOrderedFonts — fontName values in first-appearance order from pdfjs
 */
export function buildFontBridge(
  streamText: string,
  pdfjsOrderedFonts: string[]
): Record<string, string> {
  const streamOrder = streamFontOrder(streamText);
  const bridge: Record<string, string> = {};
  pdfjsOrderedFonts.forEach((pdfjsKey, i) => {
    if (streamOrder[i]) bridge[pdfjsKey] = streamOrder[i];
  });
  return bridge;
}
