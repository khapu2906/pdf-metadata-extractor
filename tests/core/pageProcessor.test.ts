import { processPage } from "../../src/core/pageProcessor";
import { PDFDocument } from "pdf-lib";
import { FontInfo } from "../../src/types";

// Minimal mock PDFDocument — both extractXObjectInfo and getContentStreamText
// have try/catch and return safe defaults when pdfDoc methods throw.
const mockPdfDoc = {} as unknown as PDFDocument;

function makePage(
  items: Array<{ str: string; transform: number[]; fontName?: string; width?: number; height?: number }>,
  width = 595,
  height = 842
) {
  return {
    getViewport: () => ({ width, height }),
    getTextContent: async () => ({ items }),
    getOperatorList: async () => ({ fnArray: [], argsArray: [] }),
  };
}

describe("processPage", () => {
  it("returns correct width and height", async () => {
    const page = makePage([]);
    const result = await processPage(page, 1, mockPdfDoc, 0);
    expect(result.width).toBe(595);
    expect(result.height).toBe(842);
  });

  it("sets pageType to 'unknown' when no text items", async () => {
    const result = await processPage(makePage([]), 1, mockPdfDoc, 0);
    expect(result.pageType).toBe("unknown");
  });

  it("sets pageType to 'text' when text items exist", async () => {
    const page = makePage([
      { str: "Hello", transform: [12, 0, 0, 12, 100, 700] },
    ]);
    const result = await processPage(page, 1, mockPdfDoc, 0);
    expect(result.pageType).toBe("text");
  });

  it("extracts text element with correct values", async () => {
    const page = makePage([
      { str: "World", transform: [14, 0, 0, 14, 50, 600], fontName: "F1" },
    ]);
    const realFontMap: Record<string, FontInfo> = {
      F1: { key: "F1", fontFamily: "Helvetica", fontStyle: "normal", fontWeight: 400, realName: "Helvetica", baseFontRaw: "Helvetica", subtype: "Type1", isSubset: false, encoding: null, italicAngle: null },
    };
    const result = await processPage(page, 1, mockPdfDoc, 0, realFontMap);
    const el = result.textElements[0];

    expect(el.text).toBe("World");
    expect(el.x).toBe(50);
    expect(el.y).toBeCloseTo(842 - 600);
    expect(el.fontFamily).toBe("Helvetica");
    expect(el.fontSize).toBeCloseTo(14);
    expect(el.color).toEqual({ r: 0, g: 0, b: 0 });
    expect(el.type).toBe("text");
  });

  it("filters items without transform", async () => {
    const page = makePage([
      { str: "valid", transform: [12, 0, 0, 12, 100, 700] },
      { str: "invalid", transform: undefined as unknown as number[] },
    ]);
    const result = await processPage(page, 1, mockPdfDoc, 0);
    expect(result.textElements).toHaveLength(1);
    expect(result.textElements[0].text).toBe("valid");
  });

  it("elements array contains all element types", async () => {
    const page = makePage([
      { str: "A", transform: [10, 0, 0, 10, 0, 0] },
    ]);
    const result = await processPage(page, 1, mockPdfDoc, 0);
    // With no images/rects/paths, elements should equal textElements
    expect(result.elements).toStrictEqual(result.textElements);
  });
});
