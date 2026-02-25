import fs from "fs";
import path from "path";
import os from "os";
import { loadInput } from "../../src/pdf/loader";

describe("loadInput", () => {
  it("returns Buffer as-is when Buffer is passed", async () => {
    const buf = Buffer.from("test data");
    const result = await loadInput(buf);
    expect(result).toBe(buf);
  });

  it("reads file from disk when valid path is given", async () => {
    const tmpFile = path.join(os.tmpdir(), "test-loader.pdf");
    const content = Buffer.from("fake pdf content");
    fs.writeFileSync(tmpFile, content);

    try {
      const result = await loadInput(tmpFile);
      expect(result).toEqual(content);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it("throws when file path does not exist", async () => {
    await expect(loadInput("/non/existent/file.pdf")).rejects.toThrow(
      'File not found: "/non/existent/file.pdf"'
    );
  });

  it("calls fetchBuffer for http URLs", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      statusText: "OK",
      arrayBuffer: async () => new ArrayBuffer(4),
    });

    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await loadInput("http://example.com/test.pdf");
    expect(mockFetch).toHaveBeenCalledWith("http://example.com/test.pdf");
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it("calls fetchBuffer for https URLs", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      statusText: "OK",
      arrayBuffer: async () => new ArrayBuffer(8),
    });

    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await loadInput("https://example.com/doc.pdf");
    expect(mockFetch).toHaveBeenCalledWith("https://example.com/doc.pdf");
    expect(Buffer.isBuffer(result)).toBe(true);
  });
});
