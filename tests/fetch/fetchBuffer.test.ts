import { fetchBuffer } from "../../src/fetch/fetchBuffer";

describe("fetchBuffer", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns Buffer on success", async () => {
    const mockData = new ArrayBuffer(10);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      arrayBuffer: async () => mockData,
    }) as unknown as typeof fetch;

    const result = await fetchBuffer("https://example.com/test.pdf");
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.byteLength).toBe(10);
  });

  it("throws on non-ok response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      arrayBuffer: async () => new ArrayBuffer(0),
    }) as unknown as typeof fetch;

    await expect(fetchBuffer("https://example.com/missing.pdf")).rejects.toThrow(
      "HTTP 404"
    );
  });

  it("throws on network error", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network failure")) as unknown as typeof fetch;

    await expect(fetchBuffer("https://example.com/fail.pdf")).rejects.toThrow("Network failure");
  });

  it("passes correct URL to fetch", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    await fetchBuffer("https://example.com/my.pdf");
    expect(mockFetch).toHaveBeenCalledWith("https://example.com/my.pdf");
  });
});
