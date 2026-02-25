import { getBoundingBox, filterByRegion } from "../../src/parser/streamParser";
import { TextElement } from "../../src/types";

function makeEl(x: number, y: number, width = 50, height = 12): TextElement {
  return {
    type: "text",
    text: "x",
    x,
    y,
    width,
    height,
    fontSize: 12,
    fontFamily: null,
    fontRealName: null,
    color: { r: 0, g: 0, b: 0 },
  };
}

describe("getBoundingBox", () => {
  it("returns null for empty array", () => {
    expect(getBoundingBox([])).toBeNull();
  });

  it("returns correct bounding box for single element", () => {
    const box = getBoundingBox([makeEl(10, 20, 100, 15)]);
    expect(box).toEqual({ x: 10, y: 20, width: 100, height: 15 });
  });

  it("returns bounding box that wraps multiple elements", () => {
    const els = [makeEl(10, 20, 50, 12), makeEl(100, 50, 80, 14)];
    const box = getBoundingBox(els);
    expect(box).not.toBeNull();
    expect(box!.x).toBe(10);
    expect(box!.y).toBe(20);
    expect(box!.width).toBe(170); // maxX(180) - minX(10)
    expect(box!.height).toBe(44); // maxY(64) - minY(20)
  });

  it("uses fontSize as height fallback when height is undefined", () => {
    const el: TextElement = {
      type: "text", text: "x", x: 0, y: 0,
      fontSize: 16, fontFamily: null, fontRealName: null,
      color: { r: 0, g: 0, b: 0 },
    };
    const box = getBoundingBox([el]);
    expect(box!.height).toBe(16);
  });
});

describe("filterByRegion", () => {
  const elements = [
    makeEl(0, 0),
    makeEl(100, 100),
    makeEl(200, 200),
    makeEl(300, 300),
  ];

  it("returns all elements inside the region", () => {
    const box = { x: 0, y: 0, width: 400, height: 400 };
    expect(filterByRegion(elements, box)).toHaveLength(4);
  });

  it("returns only elements within smaller region", () => {
    const box = { x: 50, y: 50, width: 200, height: 200 };
    const result = filterByRegion(elements, box);
    expect(result).toHaveLength(2); // (100,100) and (200,200)
  });

  it("returns empty when no element is in region", () => {
    const box = { x: 500, y: 500, width: 100, height: 100 };
    expect(filterByRegion(elements, box)).toHaveLength(0);
  });

  it("returns empty for empty input", () => {
    expect(filterByRegion([], { x: 0, y: 0, width: 100, height: 100 })).toHaveLength(0);
  });
});
