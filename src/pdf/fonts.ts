import { PDFDocument, PDFName, PDFDict } from "pdf-lib";
import { FontInfo } from "../types";

function pdfValToString(val: unknown): string | null {
  if (!val) return null;
  try {
    return (val as { toString(): string })
      .toString()
      .replace(/^\//, "")
      .replace(/^\(|\)$/g, "")
      .trim();
  } catch {
    return null;
  }
}

function stripSubsetPrefix(name: string | null): string | null {
  if (!name) return null;
  return name.replace(/^\//, "").replace(/^[A-Z]{6}\+/, "");
}

export async function extractFonts(pdfDoc: PDFDocument): Promise<Record<string, FontInfo>> {
  const fontMap: Record<string, FontInfo> = {};

  for (const page of pdfDoc.getPages()) {
    let resourceDict: PDFDict | undefined;

    try {
      const res = page.node.get(PDFName.of("Resources"));
      resourceDict = pdfDoc.context.lookupMaybe(res, PDFDict);
    } catch {
      continue;
    }

    if (!resourceDict) continue;

    let fontDict: PDFDict | undefined;

    try {
      fontDict = pdfDoc.context.lookupMaybe(
        resourceDict.get(PDFName.of("Font")),
        PDFDict
      );
    } catch {
      continue;
    }

    if (!fontDict) continue;

    for (const [nameKey, fontRef] of fontDict.entries()) {
      const key = pdfValToString(nameKey) ?? nameKey.toString().replace(/^\//, "");

      if (fontMap[key]) continue;

      let fontObj: PDFDict | undefined;
      try {
        fontObj = pdfDoc.context.lookupMaybe(fontRef, PDFDict);
      } catch {
        continue;
      }

      if (!fontObj) {
        fontMap[key] = {
          key, realName: null, baseFontRaw: null, isSubset: false,
          subtype: null, encoding: null, fontFamily: null, fontStyle: null,
          fontWeight: null, italicAngle: null,
        };
        continue;
      }

      const baseFontRaw   = pdfValToString(fontObj.get(PDFName.of("BaseFont")));
      const subtype       = pdfValToString(fontObj.get(PDFName.of("Subtype")));
      const encoding      = pdfValToString(fontObj.get(PDFName.of("Encoding")));

      // FontDescriptor: first try direct, then through DescendantFonts (Type0)
      let descriptor: PDFDict | undefined;
      try {
        descriptor = pdfDoc.context.lookupMaybe(
          fontObj.get(PDFName.of("FontDescriptor")),
          PDFDict
        );
      } catch { /* ignore */ }

      if (!descriptor && subtype === "Type0") {
        try {
          const descArr = pdfDoc.context.lookup(fontObj.get(PDFName.of("DescendantFonts")));
          const cidRef  = (descArr as { array?: unknown[]; get?(n: number): unknown })?.array?.[0]
            ?? (descArr as { get?(n: number): unknown })?.get?.(0);
          const cidFont = pdfDoc.context.lookupMaybe(cidRef as Parameters<typeof pdfDoc.context.lookupMaybe>[0], PDFDict);
          descriptor = pdfDoc.context.lookupMaybe(
            cidFont?.get(PDFName.of("FontDescriptor")),
            PDFDict
          );
        } catch { /* ignore */ }
      }

      let fontFamily:  string | null = null;
      let fontWeight:  number | null = null;
      let italicAngle: number | null = null;

      if (descriptor) {
        fontFamily  = pdfValToString(descriptor.get(PDFName.of("FontFamily")));
        try { fontWeight  = (descriptor.get(PDFName.of("FontWeight")) as { numberValue?(): number } | undefined)?.numberValue?.() ?? null; } catch { /* ignore */ }
        try { italicAngle = (descriptor.get(PDFName.of("ItalicAngle")) as { numberValue?(): number } | undefined)?.numberValue?.() ?? null; } catch { /* ignore */ }
      }

      const realName  = stripSubsetPrefix(baseFontRaw);
      const isSubset  = /^[A-Z]{6}\+/.test((baseFontRaw ?? "").replace(/^\//, ""));
      const dashIdx   = realName?.indexOf("-") ?? -1;

      if (!fontFamily && realName) {
        fontFamily = dashIdx > -1 ? realName.slice(0, dashIdx) : realName;
      }
      const fontStyle = dashIdx > -1 ? realName!.slice(dashIdx + 1) : null;

      fontMap[key] = {
        key, realName, baseFontRaw, isSubset, subtype, encoding,
        fontFamily, fontStyle, fontWeight, italicAngle,
      };
    }
  }

  return fontMap;
}
