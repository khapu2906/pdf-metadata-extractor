import { rgbFromArray, rgbToHex, BLACK, WHITE } from "../../src/utils/color";

describe("rgbFromArray", () => {
  it("converts [0, 0, 0] to black", () => {
    expect(rgbFromArray([0, 0, 0])).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("converts [1, 1, 1] to white", () => {
    expect(rgbFromArray([1, 1, 1])).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("converts [0.5, 0.5, 0.5] to mid-gray", () => {
    const result = rgbFromArray([0.5, 0.5, 0.5]);
    expect(result.r).toBe(128);
    expect(result.g).toBe(128);
    expect(result.b).toBe(128);
  });

  it("defaults missing channels to 0", () => {
    expect(rgbFromArray([])).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe("rgbToHex", () => {
  it("converts black to #000000", () => {
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe("#000000");
  });

  it("converts white to #ffffff", () => {
    expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe("#ffffff");
  });

  it("converts red to #ff0000", () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe("#ff0000");
  });

  it("pads single-digit hex values", () => {
    expect(rgbToHex({ r: 1, g: 2, b: 3 })).toBe("#010203");
  });
});

describe("constants", () => {
  it("BLACK is (0, 0, 0)", () => {
    expect(BLACK).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("WHITE is (255, 255, 255)", () => {
    expect(WHITE).toEqual({ r: 255, g: 255, b: 255 });
  });
});
