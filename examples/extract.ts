import path from "path";
import fs from "fs";
import { extractPDF } from "../src/core/extractor";
import { extractTextStructure } from "../src/parser/textParser";

const ASSETS = path.resolve(__dirname, "../assets");

async function main() {
  const files = [
    "sample-1.pdf",
    "sample-2.pdf",
    "sample-3.pdf",
    "sample-4.pdf",
  ];

  const outDir = path.resolve(__dirname, "../output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  for (const file of files) {
    try {
      const result = await extractPDF(path.join(ASSETS, file));

      // Build full structured text for each page
      const structured = {
        file:       result.file,
        source:     result.source,
        isPrintPDF: result.isPrintPDF,
        totalPages: result.totalPages,
        fonts:      result.fonts,
        pages: result.pages.map((page) => ({
          pageNumber: page.pageNumber,
          width:      page.width,
          height:     page.height,
          pageType:   page.pageType,
          lines:      extractTextStructure(page.textElements),
        })),
      };

      console.log(`\n${"═".repeat(60)}`);
      console.log(`FILE: ${file}  [${result.source}]`);

      for (const page of structured.pages) {
        const p = result.pages[page.pageNumber - 1];
        console.log(
          `\n  page ${page.pageNumber}  [${page.pageType}]` +
          `  text=${p.textElements.length}` +
          `  images=${p.graphicSummary.imageCount}` +
          `  vectors=${p.graphicSummary.vectorCount}`
        );
        for (const img of p.imageElements) {
          console.log(`    image "${img.name}"  x=${Math.round(img.x)} y=${Math.round(img.y)}  ${Math.round(img.width)}×${Math.round(img.height)}  src=${img.imageWidth}×${img.imageHeight}  cs=${img.colorSpace ?? "?"}`);
        }
        for (const line of page.lines) {
          console.log(`    line "${line.text}"`);
          for (const w of line.words) {
            console.log(`      word "${w.text}"  x=${Math.round(w.x)} y=${Math.round(w.y)}  size=${Math.round(w.fontSize)}  font=${w.fontRealName ?? "?"}  color=rgb(${w.color.r},${w.color.g},${w.color.b})`);
          }
        }
      }

      const outPath = path.join(outDir, file.replace(".pdf", ".json"));
      fs.writeFileSync(outPath, JSON.stringify(structured, null, 2), "utf-8");
      console.log(`\n  ✅ → output/${file.replace(".pdf", ".json")}`);

    } catch (err) {
      console.error(`❌ ${file}: ${(err as Error).message}`);
    }
  }
}

main().catch(console.error);
