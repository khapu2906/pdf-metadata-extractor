import { PDFMetaInfo } from "../pdf/metadata";

const SOURCE_PATTERNS: Array<[string, string]> = [
  ["canva", "Canva"],
  ["illustrator", "Adobe Illustrator"],
  ["indesign", "Adobe InDesign"],
  ["photoshop", "Adobe Photoshop"],
  ["figma", "Figma"],
  ["inkscape", "Inkscape"],
  ["affinity", "Affinity"],
  ["sketch", "Sketch"],
  ["coreldraw", "CorelDRAW"],
];

export function detectSource(metaInfo: PDFMetaInfo | null, exif: PDFMetaInfo | null): string {
  const text = (
    (metaInfo?.Creator ?? "") +
    (metaInfo?.Producer ?? "") +
    (exif?.Creator ?? "") +
    (exif?.Producer ?? "")
  ).toLowerCase();

  for (const [keyword, label] of SOURCE_PATTERNS) {
    if (text.includes(keyword)) return label;
  }

  return "Unknown";
}

export function detectPrintPDF(metaInfo: PDFMetaInfo | null): boolean {
  const producer = (metaInfo?.Producer ?? "").toLowerCase();

  return (
    producer.includes("adobe pdf library") ||
    producer.includes("indesign") ||
    producer.includes("illustrator")
  );
}
