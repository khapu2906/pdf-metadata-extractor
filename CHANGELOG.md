# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-02-26

### Added

#### Graphics extraction (new)
- `ImageElement` — extracts embedded images with display bounding box (x, y, width, height in pts) and source metadata (imageWidth, imageHeight, colorSpace, bitsPerComponent, filter, imageMask)
- `RectElement` — extracts rectangle paths with fillColor, strokeColor, strokeWidth; CTM (current transformation matrix) applied so coordinates are in page display space
- `PathElement` — extracts non-rectangular paths (curves, polylines) as axis-aligned bounding boxes with fill/stroke color
- `PageResult.rectElements`, `PageResult.pathElements`, `PageResult.imageElements` arrays
- `PageResult.graphicSummary.vectorCount` and `imageCount` counters
- `PageResult.elements` now includes all element types combined (text + rect + path + image)
- Page type `"vector"` and `"hybrid"` now correctly classified when vector/image elements are present

#### CTM tracking
- Full current transformation matrix (save/restore/transform) tracked throughout operator list
- Image bounding box derived from unit-square corners transformed through CTM
- Rect/path corners transformed through CTM before computing axis-aligned bounding box

### Changed

#### pdfjs-dist upgrade: v3.11.174 → v5.4.624
- Updated import to `pdfjs-dist/legacy/build/pdf.mjs` (legacy build still present in v5)
- **Worker setup**: v5 fake-worker mode uses `await import(workerSrc)` internally; empty string no longer works. Fix: `pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")).href`
- **Color format**: v5 worker normalises all color ops (gray, RGB, CMYK) into `setFillRGBColor` (OPS 59) / `setStrokeRGBColor` (OPS 58) with a single `"#rrggbb"` hex string argument. The old `[r, g, b]` integer triple format (v3) is supported as a fallback
- **`constructPath` (OPS 91) argument format**: v5 changed from `[opsArray, coordsArray]` to `[renderFn, [Float32Array], [minX, minY, maxX, maxY]]`. The rendering op (fill/stroke/both) and pre-computed bounding box are now embedded in the single op. Detection: `typeof args[0] === "number"` distinguishes v5 from v3

#### `processPage` signature change
- Old: `processPage(pdfjsPage, pageNumber, bridgeMap, realFontMap)`
- New: `processPage(pdfjsPage, pageNumber, pdfDoc, pageIndex0, realFontMap)` — `pdfDoc` and `pageIndex0` passed through so the function can call `extractXObjectInfo` and `buildFontBridge` internally

### Fixed
- Image XObject name mismatch: pdfjs renames XObjects internally (`img_p0_1` ≠ PDF key `X5`). Resolved with positional fallback — Nth image paint op maps to Nth Image XObject in dict insertion order
- `PDFRawStream` vs `PDFDict`: image XObjects are streams not plain dicts; `lookupMaybe(ref, PDFDict)` threw for them. Fixed: `ctx.lookup(ref)` then `.dict` property
- `PDFNumber.asNumber()` used instead of the private `.numberValue` field for XObject dimension extraction

---

## [1.0.0] - 2026-02-26

### Added

#### Core extraction
- `extractPDF(input, options?)` — main entry point; accepts file path, https URL, or `Buffer`
- Parallel loading via **pdfjs-dist** (text/operator extraction) and **pdf-lib** (font dict, content streams)
- Page type classification: `"text"` | `"image"` | `"hybrid"` | `"vector"` | `"unknown"`
- PDF metadata normalization (`Title`, `Author`, `Creator`, `Producer`, `CreationDate`, …)
- Source/creator detection: `detectSource()` identifies Canva, Inkscape, Word, LibreOffice, etc.
- Print PDF detection: `detectPrintPDF()` based on `Producer` field heuristics

#### Font resolution (bridge map)
- `extractFonts(pdfDoc)` — walks the PDF font dictionary to collect `FontInfo` for every resource key
- `getContentStreamText(pdfDoc, pageIndex)` — decompresses page content streams (single or array); recursively follows Form XObject sub-streams via `/Name Do` operators (depth limit 4) to handle Inkscape-style PDFs where text lives inside XObjects
- `streamFontOrder(streamText)` — extracts ordered unique font resource keys from `/FontKey size Tf` operators; regex `[^\s/\[\]<>(){}]+` correctly handles names with hyphens (e.g. `f-0-0`)
- `buildFontBridge(streamText, pdfjsOrderedFonts)` — positional matching of pdfjs internal keys (`g_dN_fK`) to PDF resource keys (`F4`, `f-0-0`); robust against pdfjs global document counter incrementing across multiple extractions in the same process
- Full font metadata on every `TextElement`: `fontFamily`, `fontStyle`, `fontWeight`, `fontRealName`, `fontSubtype`, `isSubsetFont`

#### Color extraction
- Color extracted from the pdfjs operator list and carried on every `TextElement` as `RGB`
- Utilities: `rgbFromArray()`, `rgbToHex()`, `BLACK`, `WHITE` constants

#### Text grouping (parser)
- `groupIntoLines(elements, tolerance?)` — bucket elements by Y coordinate within `tolerance` pts; produces `TextLine[]` sorted top-to-bottom
- `groupIntoWords(elements, gapFactor?)` — reconstruct words from glyph-level elements; handles two split triggers: explicit whitespace elements and large X gaps (`gap > fontSize × gapFactor`)
  - Letter-spacing heuristic: a whitespace element between two single-character elements is treated as decorative letter-spacing (Canva-style) and merged rather than used as a word boundary
- `extractWords(elements, lineTolerance?, gapFactor?)` — convenience wrapper; equivalent to `groupIntoLines().flatMap(groupIntoWords())`; returns `TextWord[]` in reading order
- `extractTextStructure(elements, lineTolerance?, gapFactor?)` — returns `TextLineWithWords[]` (full hierarchy: lines → words → raw elements)
- `lineToString(elements)` — legacy helper; joins elements in X order

#### Bounding box / region helpers
- `getBoundingBox(elements)` — tight bounding box around a set of `TextElement[]`
- `filterByRegion(elements, box)` — filter elements whose top-left falls inside a `BoundingBox`

#### Matrix utilities
- `getFontSizeFromMatrix(matrix)`, `getXFromMatrix(matrix)`, `getYFromMatrix(matrix)`

#### Types
- `RGB`, `FontInfo`
- `TextElement`, `RectElement`, `PathElement`, `ImageElement`, `XObjectElement`, `PageElement`
- `TextWord`, `TextLine`, `TextLineWithWords`
- `GraphicSummary`, `PageResult`, `PDFResult`, `ExtractOptions`
- `BoundingBox` (from `parser/streamParser`)

### Technical notes
- Uses **pdfjs-dist 3.11.174** legacy build with fake worker disabled for Node.js compatibility
- Uses **pdf-lib 1.17.x** for font dictionary traversal and raw content stream access
- Content stream decompression: `zlib.inflateSync` → `zlib.inflateRawSync` → raw latin1 fallback
- Requires Node.js ≥ 18 (native `fetch` for URL loading)
