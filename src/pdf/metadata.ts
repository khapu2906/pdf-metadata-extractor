export interface PDFMetaInfo {
  Title?: string;
  Author?: string;
  Subject?: string;
  Keywords?: string;
  Creator?: string;
  Producer?: string;
  CreationDate?: string;
  ModDate?: string;
  [key: string]: unknown;
}

export function normalizeMetaInfo(raw: unknown): PDFMetaInfo {
  if (!raw || typeof raw !== "object") return {};
  return raw as PDFMetaInfo;
}
