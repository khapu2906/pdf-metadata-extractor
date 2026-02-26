import path from "path";
import { extractPDF } from "../src/core/extractor";

async function main() {
  const result = await extractPDF(path.resolve(__dirname, "../assets/sample-1.pdf"));
  const page = result.pages[0];
  console.log(`vectors=${page.rectElements.length + page.pathElements.length}  images=${page.imageElements.length}  text=${page.textElements.length}`);
  page.rectElements.slice(0, 8).forEach((r, i) =>
    console.log(`  rect[${i}] fill=${JSON.stringify(r.fillColor)}  stroke=${JSON.stringify(r.strokeColor)}  ${Math.round(r.width)}×${Math.round(r.height)}`)
  );
  page.textElements.slice(0, 3).forEach(t =>
    console.log(`  text "${t.text}"  color=rgb(${t.color.r},${t.color.g},${t.color.b})`)
  );
}

main().catch(console.error);
