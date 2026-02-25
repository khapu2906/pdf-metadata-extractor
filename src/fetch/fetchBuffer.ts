export async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch PDF from "${url}": HTTP ${res.status} ${res.statusText}`);
  }

  const arr = await res.arrayBuffer();

  return Buffer.from(arr);
}
