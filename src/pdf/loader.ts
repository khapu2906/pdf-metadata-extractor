import fs = require("fs");
import { fetchBuffer } from "../fetch/fetchBuffer";

export async function loadInput(input: string | Buffer): Promise<Buffer> {
  if (Buffer.isBuffer(input)) {
    return input;
  }

  if (input.startsWith("http://") || input.startsWith("https://")) {
    return fetchBuffer(input);
  }

  if (!fs.existsSync(input)) {
    throw new Error(`File not found: "${input}"`);
  }

  return fs.readFileSync(input);
}
