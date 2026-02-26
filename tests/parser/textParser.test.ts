import { groupIntoLines, lineToString } from "../../src/parser/textParser";
import { TextElement } from "../../src/types";

function makeEl(text: string, x: number, y: number, fontSize = 12): TextElement {
  return {
    type: "text",
    text,
    x,
    y,
    width: 50,
    height: fontSize,
    fontSize,
    fontFamily: null,
    fontStyle: null,
    fontWeight: null,
    fontRealName: null,
    fontSubtype: null,
    isSubsetFont: null,
    color: { r: 0, g: 0, b: 0 },
  };
}

describe("groupIntoLines", () => {
  it("returns empty array for empty input", () => {
    expect(groupIntoLines([])).toEqual([]);
  });

  it("groups elements with same Y into one line", () => {
    const els = [makeEl("A", 0, 100), makeEl("B", 50, 100), makeEl("C", 100, 100)];
    const lines = groupIntoLines(els);
    expect(lines).toHaveLength(1);
    expect(lines[0].elements).toHaveLength(3);
  });

  it("splits elements on different Y into separate lines", () => {
    const els = [makeEl("A", 0, 100), makeEl("B", 0, 200), makeEl("C", 0, 300)];
    const lines = groupIntoLines(els);
    expect(lines).toHaveLength(3);
  });

  it("respects threshold for nearby Y values", () => {
    // bucket = Math.round(y / tolerance) * tolerance
    // Y=100 → bucket 100, Y=100.9 → Math.round(50.45)*2=100 → same bucket
    const els = [makeEl("A", 0, 100), makeEl("B", 50, 100.9)];
    const lines = groupIntoLines(els, 2);
    expect(lines).toHaveLength(1);
  });

  it("splits elements outside threshold", () => {
    const els = [makeEl("A", 0, 100), makeEl("B", 50, 103)]; // 3 > threshold=2
    const lines = groupIntoLines(els, 2);
    expect(lines).toHaveLength(2);
  });

  it("handles single element", () => {
    const lines = groupIntoLines([makeEl("only", 0, 0)]);
    expect(lines).toHaveLength(1);
    expect(lines[0].elements).toHaveLength(1);
  });
});

describe("lineToString", () => {
  it("concatenates elements sorted by X", () => {
    // lineToString joins with no separator (PDF text items carry their own spacing)
    const line = [makeEl("World", 50, 100), makeEl("Hello", 0, 100)];
    expect(lineToString(line)).toBe("HelloWorld");
  });

  it("returns empty string for empty line", () => {
    expect(lineToString([])).toBe("");
  });

  it("trims the result", () => {
    const line = [makeEl("  text  ", 0, 100)];
    expect(lineToString(line)).toBe("text");
  });

  it("handles single element", () => {
    expect(lineToString([makeEl("only", 0, 0)])).toBe("only");
  });
});
