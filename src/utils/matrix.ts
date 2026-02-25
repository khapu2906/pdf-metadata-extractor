/**
 * PDF transform matrix utilities.
 * A PDF transform matrix is [a, b, c, d, e, f] where:
 *   e = x translation, f = y translation
 *   a, b, c, d = scaling / rotation components
 */

export type Matrix = [number, number, number, number, number, number];

export function getFontSizeFromMatrix(matrix: number[]): number {
  const [a, b] = matrix;
  return Math.sqrt(a ** 2 + b ** 2);
}

export function getXFromMatrix(matrix: number[]): number {
  return matrix[4];
}

export function getYFromMatrix(matrix: number[], pageHeight: number): number {
  return pageHeight - matrix[5];
}
