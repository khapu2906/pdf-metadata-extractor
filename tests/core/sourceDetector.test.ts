import { detectSource, detectPrintPDF } from "../../src/core/sourceDetector";

describe("detectSource", () => {
  it("returns Canva when Creator contains 'Canva'", () => {
    expect(detectSource({ Creator: "Canva 1.0" }, null)).toBe("Canva");
  });

  it("returns Adobe Illustrator when Producer contains 'Illustrator'", () => {
    expect(detectSource({ Producer: "Adobe Illustrator 27.0" }, null)).toBe("Adobe Illustrator");
  });

  it("returns Adobe InDesign when Producer contains 'InDesign'", () => {
    expect(detectSource({ Producer: "Adobe InDesign CS6" }, null)).toBe("Adobe InDesign");
  });

  it("returns Adobe Photoshop when Creator contains 'Photoshop'", () => {
    expect(detectSource({ Creator: "Adobe Photoshop 2023" }, null)).toBe("Adobe Photoshop");
  });

  it("returns Figma when Creator contains 'Figma'", () => {
    expect(detectSource({ Creator: "Figma" }, null)).toBe("Figma");
  });

  it("returns Inkscape when Producer contains 'Inkscape'", () => {
    expect(detectSource({ Producer: "Inkscape 1.3" }, null)).toBe("Inkscape");
  });

  it("falls back to exif fields", () => {
    expect(detectSource(null, { Creator: "Canva" })).toBe("Canva");
  });

  it("returns Unknown when no known source", () => {
    expect(detectSource({ Creator: "Word 2019" }, null)).toBe("Unknown");
  });

  it("returns Unknown when both args are null", () => {
    expect(detectSource(null, null)).toBe("Unknown");
  });

  it("is case-insensitive", () => {
    expect(detectSource({ Creator: "CANVA" }, null)).toBe("Canva");
    expect(detectSource({ Creator: "figma" }, null)).toBe("Figma");
  });
});

describe("detectPrintPDF", () => {
  it("returns true for Adobe PDF Library", () => {
    expect(detectPrintPDF({ Producer: "Adobe PDF Library 15.0" })).toBe(true);
  });

  it("returns true for InDesign producer", () => {
    expect(detectPrintPDF({ Producer: "Adobe InDesign CS6" })).toBe(true);
  });

  it("returns true for Illustrator producer", () => {
    expect(detectPrintPDF({ Producer: "Adobe Illustrator" })).toBe(true);
  });

  it("returns false for unknown producer", () => {
    expect(detectPrintPDF({ Producer: "Microsoft Word" })).toBe(false);
  });

  it("returns false when Producer is missing", () => {
    expect(detectPrintPDF({})).toBe(false);
    expect(detectPrintPDF(null)).toBe(false);
  });
});
