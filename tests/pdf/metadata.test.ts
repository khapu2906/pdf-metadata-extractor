import { normalizeMetaInfo } from "../../src/pdf/metadata";

describe("normalizeMetaInfo", () => {
  it("returns empty object for null", () => {
    expect(normalizeMetaInfo(null)).toEqual({});
  });

  it("returns empty object for undefined", () => {
    expect(normalizeMetaInfo(undefined)).toEqual({});
  });

  it("returns empty object for non-object", () => {
    expect(normalizeMetaInfo("string")).toEqual({});
    expect(normalizeMetaInfo(42)).toEqual({});
  });

  it("returns the object as-is for a valid object", () => {
    const input = { Creator: "Canva", Producer: "Canva PDF", Title: "Test" };
    expect(normalizeMetaInfo(input)).toEqual(input);
  });

  it("preserves all known fields", () => {
    const input = {
      Title: "My PDF",
      Author: "John",
      Subject: "Test",
      Keywords: "pdf, test",
      Creator: "Word",
      Producer: "Adobe PDF",
      CreationDate: "2024-01-01",
      ModDate: "2024-06-01",
    };
    const result = normalizeMetaInfo(input);
    expect(result.Title).toBe("My PDF");
    expect(result.Author).toBe("John");
    expect(result.Creator).toBe("Word");
  });
});
