import { PDFDocument, PDFName, PDFDict } from "pdf-lib";

export interface XObjectInfo {
  Subtype: string | null;
  Width?: number;
  Height?: number;
  BitsPerComponent?: number;
  ColorSpace?: string | null;
  Filter?: string | null;
  ImageMask?: boolean;
}

/** Stringify a raw PDF value (PDFName / PDFString), stripping the leading slash. */
function pdfVal(val: unknown): string | null {
  if (!val) return null;
  try {
    return (val as { toString(): string }).toString().replace(/^\//, "").trim();
  } catch {
    return null;
  }
}

/**
 * Resolve a raw PDF value to a number.
 * Works for both direct PDFNumber objects and indirect PDFRef → PDFNumber.
 * Uses duck-typing on `asNumber()` so it isn't coupled to a specific pdf-lib version.
 */
function numVal(ctx: PDFDocument["context"], raw: unknown): number | undefined {
  if (!raw) return undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj: any = ctx.lookup(raw as Parameters<typeof ctx.lookup>[0]);
    return typeof obj?.asNumber === "function" ? (obj.asNumber() as number) : undefined;
  } catch {
    return undefined;
  }
}

/** Same as numVal but for booleans. */
function boolVal(ctx: PDFDocument["context"], raw: unknown): boolean | undefined {
  if (!raw) return undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj: any = ctx.lookup(raw as Parameters<typeof ctx.lookup>[0]);
    return typeof obj?.asBoolean === "function" ? (obj.asBoolean() as boolean) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolve an XObject reference to its stream dictionary.
 *
 * Image XObjects are PDFRawStream (not PDFDict directly).
 * Form XObjects may also be streams.
 * Both have a `.dict` property that holds the actual stream dictionary.
 * If the resolved object IS a plain PDFDict (rare), return it directly.
 */
function resolveDict(
  ctx: PDFDocument["context"],
  ref: unknown
): PDFDict | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj: any = ctx.lookup(ref as Parameters<typeof ctx.lookup>[0]);
    if (!obj) return undefined;
    if (obj instanceof PDFDict) return obj;         // plain dict (Form XObject, etc.)
    if (obj.dict instanceof PDFDict) return obj.dict; // PDFRawStream / PDFStream
    return undefined;
  } catch {
    return undefined;
  }
}

export async function extractXObjectInfo(
  pdfDoc: PDFDocument,
  pageIndex: number
): Promise<Record<string, XObjectInfo>> {
  const result: Record<string, XObjectInfo> = {};

  try {
    const page = pdfDoc.getPages()[pageIndex];
    if (!page) return result;

    // ── Resources dict ──────────────────────────────────────────────────────
    const resourceDict = resolveDict(pdfDoc.context, page.node.get(PDFName.of("Resources")));
    if (!resourceDict) return result;

    // ── XObject sub-dict ────────────────────────────────────────────────────
    const xObjDict = resolveDict(pdfDoc.context, resourceDict.get(PDFName.of("XObject")));
    if (!xObjDict) return result;

    // ── Walk every XObject entry ─────────────────────────────────────────────
    for (const [nameKey, xObjRef] of xObjDict.entries()) {
      const name = pdfVal(nameKey) ?? nameKey.toString().replace(/^\//, "");

      const xObj = resolveDict(pdfDoc.context, xObjRef);
      if (!xObj) continue;

      const subtype = pdfVal(xObj.get(PDFName.of("Subtype")));
      const info: XObjectInfo = { Subtype: subtype };

      if (subtype === "Image") {
        const ctx             = pdfDoc.context;
        info.Width            = numVal(ctx, xObj.get(PDFName.of("Width")));
        info.Height           = numVal(ctx, xObj.get(PDFName.of("Height")));
        info.BitsPerComponent = numVal(ctx, xObj.get(PDFName.of("BitsPerComponent")));
        info.ColorSpace       = pdfVal(xObj.get(PDFName.of("ColorSpace")));
        info.Filter           = pdfVal(xObj.get(PDFName.of("Filter")));
        info.ImageMask        = boolVal(ctx, xObj.get(PDFName.of("ImageMask")));
      }

      result[name] = info;
    }
  } catch { /* ignore top-level errors */ }

  return result;
}
