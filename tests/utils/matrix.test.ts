import {
  getFontSizeFromMatrix,
  getXFromMatrix,
  getYFromMatrix,
} from "../../src/utils/matrix";

describe("getFontSizeFromMatrix", () => {
  it("returns font size for pure scaling matrix", () => {
    expect(getFontSizeFromMatrix([12, 0, 0, 12, 100, 700])).toBeCloseTo(12);
  });

  it("returns font size for rotated matrix", () => {
    // 45-degree rotation with scale 10: a = 10*cos(45), b = 10*sin(45)
    const a = 10 * Math.cos(Math.PI / 4);
    const b = 10 * Math.sin(Math.PI / 4);
    expect(getFontSizeFromMatrix([a, b, -b, a, 0, 0])).toBeCloseTo(10);
  });

  it("returns 0 for zero matrix", () => {
    expect(getFontSizeFromMatrix([0, 0, 0, 0, 0, 0])).toBe(0);
  });
});

describe("getXFromMatrix", () => {
  it("returns the 5th element (index 4)", () => {
    expect(getXFromMatrix([1, 2, 3, 4, 150, 300])).toBe(150);
  });
});

describe("getYFromMatrix", () => {
  it("returns pageHeight minus matrix[5]", () => {
    expect(getYFromMatrix([1, 2, 3, 4, 100, 600], 842)).toBeCloseTo(842 - 600);
  });

  it("returns 0 when matrix[5] equals pageHeight", () => {
    expect(getYFromMatrix([0, 0, 0, 0, 0, 842], 842)).toBeCloseTo(0);
  });
});
