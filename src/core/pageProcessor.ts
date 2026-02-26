import { PageResult, TextElement, RectElement, PathElement, ImageElement, RGB, FontInfo } from "../types";
import { buildFontBridge, getContentStreamText } from "../parser/streamParser";
import { extractXObjectInfo } from "../pdf/xobjects";
import { PDFDocument } from "pdf-lib";

// ─── pdfjs-dist v3 operator codes (verified from bundle) ─────────────────────

const OPS_SAVE               = 10;
const OPS_RESTORE            = 11;
const OPS_TRANSFORM          = 12;
const OPS_RECTANGLE          = 19;
const OPS_STROKE             = 20;
const OPS_CLOSE_STROKE       = 21;
const OPS_FILL               = 22;
const OPS_EO_FILL            = 23;
const OPS_FILL_STROKE        = 24;
const OPS_EO_FILL_STROKE     = 25;
const OPS_CLOSE_FILL_STROKE  = 26;
const OPS_CLOSE_EO_FILL_STR  = 27;
const OPS_END_PATH           = 28;
const OPS_SET_LINE_WIDTH     = 2;
const OPS_STROKE_GRAY        = 56;
const OPS_FILL_GRAY          = 57;
const OPS_STROKE_RGB         = 58;
const OPS_FILL_RGB           = 59;
const OPS_STROKE_CMYK        = 60;
const OPS_FILL_CMYK          = 61;
const OPS_SHOW_TEXT          = 44;
const OPS_SHOW_SPACED        = 45;
const OPS_NL_SHOW            = 46;
const OPS_NL_SPC_SHOW        = 47;
const OPS_PAINT_IMAGE_XOBJ   = 85;
const OPS_PAINT_INLINE_IMG   = 86;
const OPS_PAINT_IMG_REPEAT   = 88;
const OPS_PAINT_IMG_MASK     = 83;
const OPS_CONSTRUCT_PATH     = 91;
const OPS_CURVE_TO           = 15;
const OPS_CURVE_TO2          = 16;
const OPS_CURVE_TO3          = 17;
const OPS_MOVE_TO            = 13;
const OPS_LINE_TO            = 14;

// ─── Matrix (CTM) helpers ─────────────────────────────────────────────────────

type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** Post-multiply: new_ctm = old × t  (Canvas / pdfjs convention) */
function mulMatrix(m: Matrix, t: Matrix): Matrix {
  return [
    m[0] * t[0] + m[2] * t[1],
    m[1] * t[0] + m[3] * t[1],
    m[0] * t[2] + m[2] * t[3],
    m[1] * t[2] + m[3] * t[3],
    m[0] * t[4] + m[2] * t[5] + m[4],
    m[1] * t[4] + m[3] * t[5] + m[5],
  ];
}

/** Apply CTM to a 2-D point (PDF row-vector convention). */
function applyMatrix(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/**
 * Compute the axis-aligned bounding box of the unit square [0,1]×[0,1]
 * transformed by `ctm`, then convert from PDF bottom-left to display top-left.
 */
function imageBBox(
  ctm: Matrix,
  pageH: number
): { x: number; y: number; width: number; height: number } {
  const corners: Array<[number, number]> = [
    applyMatrix(ctm, 0, 0),
    applyMatrix(ctm, 1, 0),
    applyMatrix(ctm, 0, 1),
    applyMatrix(ctm, 1, 1),
  ];
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX;
  const h = maxY - minY;
  return { x: minX, y: pageH - (minY + h), width: w, height: h };
}

/**
 * Compute the axis-aligned bounding box of a set of arbitrary points (already
 * in page coords) and convert to display top-left coordinates.
 */
function pointsBBox(
  pts: Array<[number, number]>,
  pageH: number
): { x: number; y: number; width: number; height: number } {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX;
  const h = maxY - minY;
  return { x: minX, y: pageH - (minY + h), width: w, height: h };
}

// ─── Color helpers ────────────────────────────────────────────────────────────
//
// pdfjs-dist v5: the worker normalises ALL color ops into setFillRGBColor (59)
// / setStrokeRGBColor (58) and passes a single "#rrggbb" hex string as args[0].
// OPS 57 (gray) and 61 (CMYK) are remapped before reaching us, so they will
// not appear in the fnArray at runtime.
//
// pdfjs-dist v3 (legacy/Node) emitted [r, g, b] as 0–255 integers instead.
// We handle both forms so the code degrades gracefully.

function clampByte(raw: unknown): number {
  const n = typeof raw === "number" && isFinite(raw) ? raw : 0;
  return Math.max(0, Math.min(255, Math.round(n)));
}

/**
 * Parse a color from pdfjs operator list args.
 * - v5: args[0] is "#rrggbb" hex string
 * - v3: args = [r, g, b] as 0–255 integers
 */
function parseColor(args: unknown[]): RGB {
  const first = args[0];
  if (typeof first === "string" && first.startsWith("#") && first.length >= 7) {
    return {
      r: parseInt(first.slice(1, 3), 16),
      g: parseInt(first.slice(3, 5), 16),
      b: parseInt(first.slice(5, 7), 16),
    };
  }
  // v3 fallback: [r, g, b] as 0–255 integers
  return { r: clampByte(args[0]), g: clampByte(args[1]), b: clampByte(args[2]) };
}

function grayRGB(args: unknown[]): RGB {
  const v = clampByte(args[0]);
  return { r: v, g: v, b: v };
}
function cmykRGB(args: unknown[]): RGB {
  const toF = (v: unknown) => Math.max(0, Math.min(1, typeof v === "number" ? v : 0));
  const c = toF(args[0]), m = toF(args[1]), y = toF(args[2]), k = toF(args[3]);
  return {
    r: Math.round((1 - c) * (1 - k) * 255),
    g: Math.round((1 - m) * (1 - k) * 255),
    b: Math.round((1 - y) * (1 - k) * 255),
  };
}

// ─── pdfjs interfaces ─────────────────────────────────────────────────────────

interface PDFOperatorList { fnArray: number[]; argsArray: unknown[][] }
interface PDFTextItem     { str: string; transform: number[]; fontName?: string; width?: number; height?: number }
interface PDFTextContent  { items: PDFTextItem[] }
interface PDFViewport     { width: number; height: number }
interface PDFJSPage {
  getViewport(options: { scale: number }): PDFViewport;
  getTextContent(): Promise<PDFTextContent>;
  getOperatorList(): Promise<PDFOperatorList>;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function processPage(
  pdfjsPage: PDFJSPage,
  pageNumber: number,
  pdfDoc:      PDFDocument,
  pageIndex0:  number,
  realFontMap: Record<string, FontInfo> = {}
): Promise<PageResult> {
  const viewport = pdfjsPage.getViewport({ scale: 1 });
  const pageH    = viewport.height;

  const [textContent, opList, xObjInfo] = await Promise.all([
    pdfjsPage.getTextContent(),
    pdfjsPage.getOperatorList().catch((): PDFOperatorList => ({ fnArray: [], argsArray: [] })),
    extractXObjectInfo(pdfDoc, pageIndex0),
  ]);

  // ── Ordered image XObjects (for positional fallback when pdfjs name ≠ PDF key) ──
  // pdfjs renames XObjects internally (e.g. "X5" → "img_p0_1"), same mismatch as fonts.
  // Strategy: try exact name lookup first; if miss, use the Nth Image XObject in dict order.
  const orderedImageKeys = Object.entries(xObjInfo)
    .filter(([, v]) => v.Subtype === "Image")
    .map(([k]) => k);
  let imageOpIndex = 0; // increments on every image paint op

  // ── Single-pass operator list: build colors, images, rects, paths ─────────

  const colorSeq: RGB[]         = [];  // fill color at each text-show op (indexed by text item)
  const imageEls: ImageElement[] = [];
  const rectEls:  RectElement[]  = [];
  const pathEls:  PathElement[]  = [];

  // CTM state
  const ctmStack: Matrix[] = [];
  let ctm: Matrix = [...IDENTITY] as Matrix;

  // Color state
  let fillColor:   RGB = { r: 0, g: 0, b: 0 };
  let strokeColor: RGB = { r: 0, g: 0, b: 0 };
  let lineWidth        = 1;

  // Pending path state
  let pendingRects:  Array<{ x: number; y: number; w: number; h: number }> = [];
  let pendingPoints: Array<[number, number]> = [];
  let hasPending = false;

  const flushPath = (fn: number) => {
    if (!hasPending) return;

    const hasFill   = fn !== OPS_STROKE && fn !== OPS_CLOSE_STROKE && fn !== OPS_END_PATH;
    const hasStroke = fn !== OPS_FILL && fn !== OPS_EO_FILL && fn !== OPS_END_PATH;
    const fc = hasFill   ? { ...fillColor }   : null;
    const sc = hasStroke ? { ...strokeColor } : null;
    const sw = hasStroke ? lineWidth          : null;

    for (const r of pendingRects) {
      // Transform 4 rect corners through CTM
      const corners: Array<[number, number]> = [
        applyMatrix(ctm, r.x,       r.y),
        applyMatrix(ctm, r.x + r.w, r.y),
        applyMatrix(ctm, r.x,       r.y + r.h),
        applyMatrix(ctm, r.x + r.w, r.y + r.h),
      ];
      const box = pointsBBox(corners, pageH);
      if (box.width > 0 || box.height > 0) {
        rectEls.push({ type: "rect", ...box, fillColor: fc, strokeColor: sc, strokeWidth: sw });
      }
    }

    if (pendingPoints.length >= 2) {
      const box = pointsBBox(pendingPoints, pageH);
      if (box.width > 0 || box.height > 0) {
        pathEls.push({ type: "path", ...box, fillColor: fc, strokeColor: sc, strokeWidth: sw });
      }
    }

    pendingRects  = [];
    pendingPoints = [];
    hasPending    = false;
  };

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn   = opList.fnArray[i];
    const args = (opList.argsArray[i] ?? []) as unknown[];

    switch (fn) {

      // ── CTM ──────────────────────────────────────────────────────────────
      case OPS_SAVE:
        ctmStack.push([...ctm] as Matrix);
        break;
      case OPS_RESTORE:
        if (ctmStack.length > 0) ctm = ctmStack.pop()!;
        break;
      case OPS_TRANSFORM: {
        const t = args as number[];
        if (t.length >= 6) ctm = mulMatrix(ctm, [t[0], t[1], t[2], t[3], t[4], t[5]]);
        break;
      }

      // ── Line width ────────────────────────────────────────────────────────
      case OPS_SET_LINE_WIDTH:
        if (typeof args[0] === "number") lineWidth = args[0];
        break;

      // ── Fill color ────────────────────────────────────────────────────────
      // v5: all color ops normalised to OPS_FILL_RGB with "#rrggbb" hex arg.
      // v3: separate gray/CMYK ops with numeric args.
      case OPS_FILL_GRAY:  fillColor = grayRGB(args);   break;
      case OPS_FILL_RGB:   fillColor = parseColor(args); break;
      case OPS_FILL_CMYK:  fillColor = cmykRGB(args);   break;

      // ── Stroke color ──────────────────────────────────────────────────────
      case OPS_STROKE_GRAY: strokeColor = grayRGB(args);   break;
      case OPS_STROKE_RGB:  strokeColor = parseColor(args); break;
      case OPS_STROKE_CMYK: strokeColor = cmykRGB(args);   break;

      // ── Text show ops — record active fill color ──────────────────────────
      case OPS_SHOW_TEXT:
      case OPS_SHOW_SPACED:
      case OPS_NL_SHOW:
      case OPS_NL_SPC_SHOW:
        colorSeq.push({ ...fillColor });
        break;

      // ── Standalone rectangle ──────────────────────────────────────────────
      case OPS_RECTANGLE: {
        const x = typeof args[0] === "number" ? args[0] : 0;
        const y = typeof args[1] === "number" ? args[1] : 0;
        const w = typeof args[2] === "number" ? args[2] : 0;
        const h = typeof args[3] === "number" ? args[3] : 0;
        pendingRects.push({ x, y, w, h });
        hasPending = true;
        break;
      }

      // ── Batched path (constructPath) ──────────────────────────────────────
      case OPS_CONSTRUCT_PATH: {
        if (typeof args[0] === "number") {
          // ── pdfjs v5: args = [renderFn, [Float32Array | null], [minX,minY,maxX,maxY] | null]
          // The rendering op (fill/stroke/both) is embedded, and the axis-aligned
          // bounding box of the path is pre-computed in args[2].
          const renderFn = args[0] as number;
          const bboxRaw  = args[2] as Record<number, number> | null | undefined;
          if (!bboxRaw) break;

          const minX = bboxRaw[0] ?? 0, minY = bboxRaw[1] ?? 0;
          const maxX = bboxRaw[2] ?? 0, maxY = bboxRaw[3] ?? 0;

          const hasFill   = renderFn !== OPS_STROKE && renderFn !== OPS_CLOSE_STROKE && renderFn !== OPS_END_PATH;
          const hasStroke = renderFn !== OPS_FILL   && renderFn !== OPS_EO_FILL      && renderFn !== OPS_END_PATH;
          const fc = hasFill   ? { ...fillColor }   : null;
          const sc = hasStroke ? { ...strokeColor } : null;
          const sw = hasStroke ? lineWidth          : null;

          const corners: Array<[number, number]> = [
            applyMatrix(ctm, minX, minY),
            applyMatrix(ctm, maxX, minY),
            applyMatrix(ctm, maxX, maxY),
            applyMatrix(ctm, minX, maxY),
          ];
          const box = pointsBBox(corners, pageH);
          if (box.width > 0 || box.height > 0) {
            rectEls.push({ type: "rect", ...box, fillColor: fc, strokeColor: sc, strokeWidth: sw });
          }

        } else {
          // ── pdfjs v3: args = [opsArray, coordsArray]
          const pathOps = args[0] as number[] | undefined;
          const coords  = args[1] as number[] | undefined;
          if (!Array.isArray(pathOps) || !Array.isArray(coords)) break;

          let ci = 0;
          for (const op of pathOps) {
            switch (op) {
              case OPS_RECTANGLE: {
                const x = coords[ci++] ?? 0, y = coords[ci++] ?? 0;
                const w = coords[ci++] ?? 0, h = coords[ci++] ?? 0;
                pendingRects.push({ x, y, w, h });
                break;
              }
              case OPS_MOVE_TO:
              case OPS_LINE_TO:
                pendingPoints.push([coords[ci++] ?? 0, coords[ci++] ?? 0]);
                break;
              case OPS_CURVE_TO:  // 6 coords
                for (let j = 0; j < 3; j++)
                  pendingPoints.push([coords[ci++] ?? 0, coords[ci++] ?? 0]);
                break;
              case OPS_CURVE_TO2:  // 4 coords
              case OPS_CURVE_TO3:
                for (let j = 0; j < 2; j++)
                  pendingPoints.push([coords[ci++] ?? 0, coords[ci++] ?? 0]);
                break;
            }
          }
          hasPending = pendingRects.length > 0 || pendingPoints.length > 0;
        }
        break;
      }

      // ── Path rendering (flush pending rects/paths) ────────────────────────
      case OPS_FILL:
      case OPS_EO_FILL:
      case OPS_FILL_STROKE:
      case OPS_EO_FILL_STROKE:
      case OPS_CLOSE_FILL_STROKE:
      case OPS_CLOSE_EO_FILL_STR:
      case OPS_STROKE:
      case OPS_CLOSE_STROKE:
      case OPS_END_PATH:
        flushPath(fn);
        break;

      // ── Image XObjects ────────────────────────────────────────────────────
      case OPS_PAINT_IMAGE_XOBJ:
      case OPS_PAINT_IMG_MASK: {
        const name = String(args[0]);
        // Name from pdfjs may not match PDF resource key (e.g. "img_p0_1" vs "X5").
        // Try exact match first, then fall back to the Nth image XObject by insertion order.
        const info = xObjInfo[name] ?? xObjInfo[orderedImageKeys[imageOpIndex] ?? ""];
        imageOpIndex++;
        const box  = imageBBox(ctm, pageH);
        imageEls.push({
          type:             "image",
          name,
          ...box,
          imageWidth:       info?.Width,
          imageHeight:      info?.Height,
          colorSpace:       info?.ColorSpace ?? null,
          bitsPerComponent: info?.BitsPerComponent,
          filter:           info?.Filter ?? null,
          imageMask:        fn === OPS_PAINT_IMG_MASK || info?.ImageMask,
        });
        break;
      }

      case OPS_PAINT_INLINE_IMG: {
        const imgData = args[0] as { width?: number; height?: number } | undefined;
        const box     = imageBBox(ctm, pageH);
        imageEls.push({
          type:             "image",
          name:             "inline",
          ...box,
          imageWidth:       imgData?.width,
          imageHeight:      imgData?.height,
          colorSpace:       null,
          bitsPerComponent: undefined,
          filter:           null,
          imageMask:        undefined,
        });
        break;
      }

      case OPS_PAINT_IMG_REPEAT: {
        // paintImageXObjectRepeat(objId, scaleX, scaleY, positions[])
        const name      = String(args[0]);
        const scaleX    = typeof args[1] === "number" ? args[1] : 1;
        const scaleY    = typeof args[2] === "number" ? args[2] : 1;
        const positions = args[3] as number[] | undefined;
        const info      = xObjInfo[name] ?? xObjInfo[orderedImageKeys[imageOpIndex] ?? ""];
        imageOpIndex++;
        if (Array.isArray(positions)) {
          for (let pi = 0; pi + 1 < positions.length; pi += 2) {
            const px = positions[pi], py = positions[pi + 1];
            const localCTM: Matrix = [scaleX, 0, 0, scaleY, px, py];
            const effectiveCTM = mulMatrix(ctm, localCTM);
            const box = imageBBox(effectiveCTM, pageH);
            imageEls.push({
              type:             "image",
              name,
              ...box,
              imageWidth:       info?.Width,
              imageHeight:      info?.Height,
              colorSpace:       info?.ColorSpace ?? null,
              bitsPerComponent: info?.BitsPerComponent,
              filter:           info?.Filter ?? null,
              imageMask:        info?.ImageMask,
            });
          }
        }
        break;
      }
    }
  }

  // ── Font bridge: pdfjs key → PDF resource key → real FontInfo ────────────

  const pdfjsFontsSeen    = new Set<string>();
  const pdfjsOrderedFonts: string[] = [];
  const validItems = textContent.items.filter(
    (item) => item?.transform && item.str !== undefined
  );

  for (const item of validItems) {
    const fn = item.fontName;
    if (fn && !pdfjsFontsSeen.has(fn)) { pdfjsFontsSeen.add(fn); pdfjsOrderedFonts.push(fn); }
  }

  const streamText = getContentStreamText(pdfDoc, pageIndex0);
  const bridgeMap  = buildFontBridge(streamText, pdfjsOrderedFonts);

  // ── Build TextElement[] ───────────────────────────────────────────────────

  const textEls: TextElement[] = validItems.map((item, idx) => {
    const t        = item.transform;
    const fontSize = Math.sqrt(t[0] ** 2 + t[1] ** 2);
    const color    = colorSeq[idx] ?? { r: 0, g: 0, b: 0 };
    const pdfjsKey = item.fontName ?? "";
    const pdfKey   = bridgeMap[pdfjsKey] ?? pdfjsKey;
    const fi       = realFontMap[pdfKey];

    return {
      type:         "text" as const,
      text:         item.str,
      x:            t[4],
      y:            pageH - t[5],
      width:        item.width  ?? 0,
      height:       item.height ?? fontSize,
      fontSize,
      fontFamily:   fi?.fontFamily  ?? null,
      fontStyle:    fi?.fontStyle   ?? null,
      fontWeight:   fi?.fontWeight  ?? null,
      fontRealName: fi?.realName    ?? null,
      fontSubtype:  fi?.subtype     ?? null,
      isSubsetFont: fi?.isSubset    ?? null,
      color,
    };
  });

  // ── graphicSummary + pageType ─────────────────────────────────────────────

  const imageCount  = imageEls.length;
  const vectorCount = rectEls.length + pathEls.length;
  const hasText     = textEls.length > 0;
  const hasImages   = imageCount > 0;
  const hasVectors  = vectorCount > 0;

  let pageType: PageResult["pageType"];
  if (hasText && !hasImages) {
    pageType = hasVectors ? "hybrid" : "text";
  } else if (!hasText && hasImages && !hasVectors) {
    pageType = "image";
  } else if (hasText && hasImages) {
    pageType = "hybrid";
  } else if (!hasText && !hasImages && hasVectors) {
    pageType = "vector";
  } else {
    pageType = "unknown";
  }

  const allElements = [
    ...textEls,
    ...imageEls,
    ...rectEls,
    ...pathEls,
  ];

  return {
    pageNumber,
    width:           viewport.width,
    height:          viewport.height,
    pageType,
    elements:        allElements,
    textElements:    textEls,
    imageElements:   imageEls,
    xobjectElements: [],
    rectElements:    rectEls,
    pathElements:    pathEls,
    graphicSummary:  { vectorCount, imageCount },
  };
}
