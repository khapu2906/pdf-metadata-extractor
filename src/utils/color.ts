import { RGB } from "../types";

export const BLACK: RGB = { r: 0, g: 0, b: 0 };
export const WHITE: RGB = { r: 255, g: 255, b: 255 };

export function rgbFromArray(arr: number[]): RGB {
  return {
    r: Math.round((arr[0] ?? 0) * 255),
    g: Math.round((arr[1] ?? 0) * 255),
    b: Math.round((arr[2] ?? 0) * 255),
  };
}

export function rgbToHex(color: RGB): string {
  return (
    "#" +
    [color.r, color.g, color.b]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}
