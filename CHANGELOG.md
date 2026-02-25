# Changelog

All notable changes to this project will be documented in this file.

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
- Color extracted from the pdfjs operator list (OPS 57 = gray, 59 = RGB, 61 = CMYK) and carried on every `TextElement` as `RGB`
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
- Uses **pdfjs-dist 3.11.174** legacy build (`pdfjs-dist/legacy/build/pdf.js`) with worker disabled for Node.js compatibility
- Uses **pdf-lib 1.17.x** for font dictionary traversal and raw content stream access
- Content stream decompression: `zlib.inflateSync` → `zlib.inflateRawSync` → raw latin1 fallback
- Requires Node.js ≥ 18 (native `fetch` for URL loading)
