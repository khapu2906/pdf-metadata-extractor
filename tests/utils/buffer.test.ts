import { toUint8Array, fromUint8Array } from "../../src/utils/buffer";

describe("toUint8Array", () => {
  it("converts Buffer to Uint8Array", () => {
    const buf = Buffer.from([1, 2, 3, 4]);
    const arr = toUint8Array(buf);
    expect(arr).toBeInstanceOf(Uint8Array);
    expect(Array.from(arr)).toEqual([1, 2, 3, 4]);
  });

  it("handles empty Buffer", () => {
    const arr = toUint8Array(Buffer.alloc(0));
    expect(arr.byteLength).toBe(0);
  });
});

describe("fromUint8Array", () => {
  it("converts Uint8Array to Buffer", () => {
    const arr = new Uint8Array([10, 20, 30]);
    const buf = fromUint8Array(arr);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(Array.from(buf)).toEqual([10, 20, 30]);
  });

  it("handles empty Uint8Array", () => {
    const buf = fromUint8Array(new Uint8Array(0));
    expect(buf.byteLength).toBe(0);
  });
});

describe("round-trip", () => {
  it("Buffer -> Uint8Array -> Buffer preserves data", () => {
    const original = Buffer.from([5, 10, 15, 20, 25]);
    const roundTripped = fromUint8Array(toUint8Array(original));
    expect(Array.from(roundTripped)).toEqual(Array.from(original));
  });
});
