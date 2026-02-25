import path from "path";
import { extractPDF } from "../../src/core/extractor";
import { PDFResult } from "../../src/types";

const ASSETS = path.resolve(__dirname, "../../assets");

function asset(name: string) {
  return path.join(ASSETS, name);
}

// Helper to print a quick summary (visible with --verbose)
function summary(result: PDFResult) {
  return {
    file: result.file,
    totalPages: result.totalPages,
    source: result.source,
    isPrintPDF: result.isPrintPDF,
    fonts: result.fonts.length,
    firstPageType: result.pages[0]?.pageType,
    firstPageSize: result.pages[0]
      ? `${Math.round(result.pages[0].width)}x${Math.round(result.pages[0].height)}`
      : null,
    textCount: result.pages.reduce((s, p) => s + p.textElements.length, 0),
  };
}

describe("extractPDF — integration with real files", () => {
  jest.setTimeout(30_000);

  it("extracts mini.pdf", async () => {
    const result = await extractPDF(asset("mini.pdf"));

    console.log("mini.pdf →", summary(result));

    expect(result.file).toBe("mini.pdf");
    expect(result.totalPages).toBeGreaterThanOrEqual(1);
    expect(result.pages).toHaveLength(result.totalPages);
    expect(result.pages[0].width).toBeGreaterThan(0);
    expect(result.pages[0].height).toBeGreaterThan(0);
  });

  it("extracts OpenSans.pdf", async () => {
    const result = await extractPDF(asset("OpenSans.pdf"));

    console.log("OpenSans.pdf →", summary(result));

    expect(result.file).toBe("OpenSans.pdf");
    expect(result.totalPages).toBeGreaterThanOrEqual(1);
  });

  it("extracts 5894300-1.pdf", async () => {
    const result = await extractPDF(asset("5894300-1.pdf"));

    console.log("5894300-1.pdf →", summary(result));

    expect(result.file).toBe("5894300-1.pdf");
    expect(result.totalPages).toBeGreaterThanOrEqual(1);
  });

  it("extracts 5894300-2.pdf", async () => {
    const result = await extractPDF(asset("5894300-2.pdf"));

    console.log("5894300-2.pdf →", summary(result));

    expect(result.file).toBe("5894300-2.pdf");
    expect(result.totalPages).toBeGreaterThanOrEqual(1);
  });

  it("extracts all assets and returns valid structure", async () => {
    const files = [
      "mini.pdf",
      "mini copy.pdf",
      "mini copy 2.pdf",
      "OpenSans.pdf",
      "OpenSans copy.pdf",
      "OpenSans copy 2.pdf",
      "5894300-1.pdf",
      "5894300-2.pdf",
    ];

    for (const file of files) {
      const result = await extractPDF(asset(file));

      console.log(`${file} →`, summary(result));

      expect(result.totalPages).toBeGreaterThanOrEqual(1);
      expect(result.pages).toHaveLength(result.totalPages);
      expect(typeof result.source).toBe("string");
      expect(typeof result.isPrintPDF).toBe("boolean");
      expect(Array.isArray(result.fonts)).toBe(true);

      for (const page of result.pages) {
        expect(page.width).toBeGreaterThan(0);
        expect(page.height).toBeGreaterThan(0);
        expect(Array.isArray(page.textElements)).toBe(true);
      }
    }
  });

  it("accepts Buffer input", async () => {
    const fs = await import("fs");
    const buffer = fs.readFileSync(asset("mini.pdf"));
    const result = await extractPDF(buffer);

    console.log("Buffer input →", summary(result));

    expect(result.file).toBeUndefined(); // no filename for buffer input
    expect(result.totalPages).toBeGreaterThanOrEqual(1);
  });

  it("throws for non-existent file", async () => {
    await expect(extractPDF("/no/such/file.pdf")).rejects.toThrow("File not found");
  });
});
