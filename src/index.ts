export * from "./types";
export { extractPDF } from "./core/extractor";

// Parser utilities
export { groupIntoLines, groupIntoWords, extractWords, extractTextStructure, lineToString } from "./parser/textParser";
export { getBoundingBox, filterByRegion } from "./parser/streamParser";
export type { BoundingBox } from "./parser/streamParser";

// Color utilities
export { rgbFromArray, rgbToHex, BLACK, WHITE } from "./utils/color";

// Matrix utilities
export { getFontSizeFromMatrix, getXFromMatrix, getYFromMatrix } from "./utils/matrix";
