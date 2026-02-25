export interface RGB {
  r: number;
  g: number;
  b: number;
}

// ─── Font ────────────────────────────────────────────────────────────────────

export interface FontInfo {
  key: string;
  realName: string | null;
  baseFontRaw: string | null;
  isSubset: boolean;
  subtype: string | null;
  encoding: string | null;
  fontFamily: string | null;
  fontStyle: string | null;
  fontWeight: number | null;
  italicAngle: number | null;
}

// ─── Elements ────────────────────────────────────────────────────────────────

export interface TextElement {
  type: "text";
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string | null;
  fontStyle: string | null;
  fontWeight: number | null;
  fontRealName: string | null;
  fontSubtype: string | null;
  isSubsetFont: boolean | null;
  color: RGB;
}

export interface RectElement {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: RGB | null;
  strokeColor: RGB | null;
  strokeWidth: number | null;
}

export interface PathElement {
  type: "path";
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: RGB | null;
  strokeColor: RGB | null;
  strokeWidth: number | null;
}

export interface ImageElement {
  type: "image";
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  imageWidth: number | undefined;
  imageHeight: number | undefined;
  colorSpace: string | null | undefined;
  bitsPerComponent: number | undefined;
  filter: string | null | undefined;
  imageMask: boolean | undefined;
}

export interface XObjectElement {
  type: "xobject";
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  subtype: string;
}

export type PageElement = TextElement | RectElement | PathElement | ImageElement | XObjectElement;

// ─── Text grouping (grouped output) ──────────────────────────────────────────

/** A single word — one or more adjacent TextElements with no meaningful gap. */
export interface TextWord {
  text:         string;
  x:            number;
  y:            number;
  width:        number;
  height:       number;
  fontSize:     number;
  fontRealName: string | null;
  fontFamily:   string | null;
  fontStyle:    string | null;
  fontWeight:   number | null;
  color:        RGB;
  elements:     TextElement[];
}

/** A visual line — TextElements sharing the same Y coordinate (within tolerance). */
export interface TextLine {
  /** Y coordinate of the line (rounded to grouping tolerance). */
  y: number;
  /** Concatenated text of all elements in reading order. */
  text: string;
  /** Individual text elements sorted left-to-right. */
  elements: TextElement[];
}

/** A line with its words already grouped — full hierarchy for JSON output. */
export interface TextLineWithWords extends TextLine {
  words: TextWord[];
}

// ─── Page / Document ─────────────────────────────────────────────────────────

export interface GraphicSummary {
  vectorCount: number;
  imageCount: number;
}

export interface PageResult {
  pageNumber: number;
  width: number;
  height: number;
  pageType: "text" | "image" | "hybrid" | "vector" | "unknown";
  elements: PageElement[];
  textElements: TextElement[];
  imageElements: ImageElement[];
  xobjectElements: XObjectElement[];
  rectElements: RectElement[];
  pathElements: PathElement[];
  graphicSummary: GraphicSummary;
}

export interface PDFResult {
  file?: string;
  totalPages: number;
  source: string;
  isPrintPDF: boolean;
  info: Record<string, unknown>;
  exif?: Record<string, unknown>;
  fonts: FontInfo[];
  pages: PageResult[];
}

export interface ExtractOptions {
  loadExif?: boolean;
}
