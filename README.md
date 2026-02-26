# pdf-metadata-extractor

Extract text elements, fonts, colors, images, and vector graphics metadata from PDF files. Supports file paths, URLs, and Buffers. Includes text-grouping helpers to reconstruct lines and words from raw PDF glyph streams.

## Requirements

- Node.js **≥ 18** (uses native `fetch` and modern `zlib`)
- pnpm (recommended) or npm

## Installation

```bash
pnpm add pdf-metadata-extractor
```

## Quick start

```typescript
import { extractPDF } from "pdf-metadata-extractor";

const result = await extractPDF("./document.pdf");
console.log(result.totalPages);            // number of pages
console.log(result.fonts);                 // font list with real names, family, style, weight
console.log(result.pages[0].textElements); // raw TextElement[] for page 1
console.log(result.pages[0].rectElements); // colored rectangles / shapes
console.log(result.pages[0].imageElements); // embedded images with position + metadata
```

Input can be a **file path**, a **URL** (https), or a **Buffer**:

```typescript
await extractPDF("./local.pdf");
await extractPDF("https://example.com/file.pdf");
await extractPDF(fs.readFileSync("./local.pdf"));
```

## Text grouping

Raw `TextElement[]` contains individual glyphs or characters. Use the grouping helpers to reconstruct human-readable text:

### Lines + words in one call

```typescript
import { extractPDF, extractTextStructure } from "pdf-metadata-extractor";

const result = await extractPDF("./document.pdf");
for (const page of result.pages) {
  const lines = extractTextStructure(page.textElements);
  for (const line of lines) {
    console.log(line.text);           // full line string
    for (const word of line.words) {
      console.log(word.text, word.x, word.y, word.fontSize, word.fontFamily);
    }
  }
}
```

### Words only (flat list)

```typescript
import { extractWords } from "pdf-metadata-extractor";

const words = extractWords(page.textElements);
// returns TextWord[] in reading order (top-to-bottom, left-to-right)
```

### Step by step

```typescript
import { groupIntoLines, groupIntoWords } from "pdf-metadata-extractor";

const lines = groupIntoLines(page.textElements);        // TextLine[]
const words = groupIntoWords(lines[0].elements);        // TextWord[]
```

## Working with graphics

### Colored rectangles and paths

```typescript
for (const rect of page.rectElements) {
  console.log(rect.x, rect.y, rect.width, rect.height);
  console.log(rect.fillColor);   // RGB | null  e.g. { r: 244, g: 233, b: 215 }
  console.log(rect.strokeColor); // RGB | null
}
```

### Images

```typescript
for (const img of page.imageElements) {
  console.log(img.name);                          // pdfjs internal XObject name
  console.log(img.x, img.y, img.width, img.height); // display bounding box (pts)
  console.log(img.imageWidth, img.imageHeight);   // source pixel dimensions
  console.log(img.colorSpace, img.filter);        // e.g. "ICCBased", "DCTDecode"
}
```

### Graphic summary

```typescript
const { imageCount, vectorCount } = page.graphicSummary;
```

---

## API

### `extractPDF(input, options?)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `input` | `string \| Buffer` | File path, https URL, or raw Buffer |
| `options.loadExif` | `boolean` | (reserved, not yet active) |

Returns `Promise<PDFResult>`.

---

### `extractTextStructure(elements, lineTolerance?, gapFactor?)`

Groups raw `TextElement[]` into lines with words nested inside.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `elements` | `TextElement[]` | — | Raw elements from `page.textElements` |
| `lineTolerance` | `number` | `2` | Max Y-delta (pts) to treat two elements as the same line |
| `gapFactor` | `number` | `0.4` | Word-gap threshold as a fraction of `fontSize` |

Returns `TextLineWithWords[]`.

---

### `extractWords(elements, lineTolerance?, gapFactor?)`

Convenience wrapper: `groupIntoLines` → flatMap `groupIntoWords`.

Returns `TextWord[]` in reading order.

---

### `groupIntoLines(elements, tolerance?)`

Bucket elements by Y coordinate (within `tolerance` pts), sort top-to-bottom, left-to-right.

Returns `TextLine[]`.

---

### `groupIntoWords(elements, gapFactor?)`

Split a single line's elements into words by detecting:
- Explicit whitespace elements (word boundary unless letter-spacing heuristic applies)
- Large X gaps (`gap > fontSize × gapFactor`)

**Letter-spacing heuristic**: a space element sandwiched between two single-character elements is treated as decorative letter-spacing (e.g. Canva-generated PDFs) and merged into the current word rather than creating a word boundary.

Returns `TextWord[]`.

---

### `getBoundingBox(elements)`

Returns the tight `BoundingBox` (x, y, width, height) that encloses all elements, or `null` if the list is empty.

---

### `filterByRegion(elements, box)`

Filter elements whose top-left point falls inside the given `BoundingBox`.

---

### Color utilities

```typescript
import { rgbFromArray, rgbToHex, BLACK, WHITE } from "pdf-metadata-extractor";

rgbFromArray([0.2, 0.4, 0.6]);   // { r: 51, g: 102, b: 153 }
rgbToHex({ r: 255, g: 0, b: 0 }); // "#ff0000"
```

---

### Matrix utilities

```typescript
import { getFontSizeFromMatrix, getXFromMatrix, getYFromMatrix } from "pdf-metadata-extractor";
```

---

## Types

### `PDFResult`

```typescript
interface PDFResult {
  file?: string;            // basename of the source file (if path was given)
  totalPages: number;
  source: string;           // detected creator app ("Word", "Canva", "Inkscape", …)
  isPrintPDF: boolean;      // true if produced by a print driver
  info: Record<string, unknown>;  // raw PDF metadata (Title, Author, Creator, …)
  fonts: FontInfo[];        // deduplicated font list for the whole document
  pages: PageResult[];
}
```

### `PageResult`

```typescript
interface PageResult {
  pageNumber: number;       // 1-based
  width: number;            // pts
  height: number;           // pts
  pageType: "text" | "image" | "hybrid" | "vector" | "unknown";
  elements: PageElement[];  // all elements combined (text + rect + path + image)
  textElements: TextElement[];
  imageElements: ImageElement[];
  rectElements: RectElement[];
  pathElements: PathElement[];
  xobjectElements: XObjectElement[];
  graphicSummary: GraphicSummary;
}
```

### `TextElement`

```typescript
interface TextElement {
  type: "text";
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string | null;
  fontStyle: string | null;      // "italic" | "normal" | null
  fontWeight: number | null;     // 400 | 700 | null
  fontRealName: string | null;   // e.g. "OpenSans-Regular"
  fontSubtype: string | null;    // "Type1" | "TrueType" | "CIDFontType2" | …
  isSubsetFont: boolean | null;
  color: RGB;
}
```

### `RectElement`

```typescript
interface RectElement {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: RGB | null;
  strokeColor: RGB | null;
  strokeWidth: number | null;
}
```

### `PathElement`

```typescript
interface PathElement {
  type: "path";
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: RGB | null;
  strokeColor: RGB | null;
  strokeWidth: number | null;
}
```

### `ImageElement`

```typescript
interface ImageElement {
  type: "image";
  name: string;              // XObject resource name from the PDF
  x: number;                 // display position (pts, top-left origin)
  y: number;
  width: number;             // display size (pts)
  height: number;
  imageWidth: number | undefined;      // source pixel width
  imageHeight: number | undefined;     // source pixel height
  colorSpace: string | null | undefined;  // e.g. "ICCBased", "DeviceRGB"
  bitsPerComponent: number | undefined;
  filter: string | null | undefined;  // e.g. "DCTDecode", "FlateDecode"
  imageMask: boolean | undefined;
}
```

### `TextWord`

```typescript
interface TextWord {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontRealName: string | null;
  fontFamily: string | null;
  fontStyle: string | null;
  fontWeight: number | null;
  color: RGB;
  elements: TextElement[];   // constituent raw elements
}
```

### `TextLine` / `TextLineWithWords`

```typescript
interface TextLine {
  y: number;            // representative Y coordinate of the line
  text: string;         // full line text (joined elements)
  elements: TextElement[];
}

interface TextLineWithWords extends TextLine {
  words: TextWord[];
}
```

### `FontInfo`

```typescript
interface FontInfo {
  key: string;           // PDF resource key ("F4", "f-0-0", …)
  realName: string | null;     // "OpenSans-Regular"
  baseFontRaw: string | null;  // raw /BaseFont value (may include subset prefix)
  isSubset: boolean;     // true if baseFontRaw starts with "XXXXXX+"
  subtype: string | null;      // "TrueType" | "Type1" | "CIDFontType2" | …
  encoding: string | null;
  fontFamily: string | null;
  fontStyle: string | null;
  fontWeight: number | null;
  italicAngle: number | null;
}
```

### `GraphicSummary`

```typescript
interface GraphicSummary {
  vectorCount: number;   // total rect + path elements on the page
  imageCount: number;    // total image elements on the page
}
```

---

## JSON output example

```json
{
  "file": "document.pdf",
  "totalPages": 1,
  "source": "Canva",
  "isPrintPDF": false,
  "fonts": [
    {
      "key": "F4",
      "realName": "OpenSans-Regular",
      "isSubset": true,
      "subtype": "TrueType",
      "fontFamily": "OpenSans",
      "fontStyle": "normal",
      "fontWeight": 400
    }
  ],
  "pages": [
    {
      "pageNumber": 1,
      "width": 595.28,
      "height": 841.89,
      "pageType": "hybrid",
      "graphicSummary": { "vectorCount": 22, "imageCount": 1 },
      "lines": [
        {
          "y": 740,
          "text": "Hello World",
          "words": [
            {
              "text": "Hello",
              "x": 72, "y": 740,
              "width": 42.5, "height": 14,
              "fontSize": 14,
              "fontFamily": "OpenSans",
              "fontStyle": "normal",
              "fontWeight": 400,
              "color": { "r": 0, "g": 0, "b": 0 }
            }
          ]
        }
      ]
    }
  ]
}
```

---

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm run build

# Run tests
pnpm run test

# Run example (requires Node 18+)
pnpm run example
```

## License

MIT
