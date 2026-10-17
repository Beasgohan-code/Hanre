import { gunzipSync, strFromU8 } from "fflate";

export interface TarEntry {
  path: string;
  content: string;
  size: number;
}

function readString(bytes: Uint8Array, start: number, length: number) {
  let end = start;
  while (end < start + length && bytes[end] !== 0) end += 1;
  return strFromU8(bytes.subarray(start, end));
}

function readOctal(bytes: Uint8Array, start: number, length: number) {
  const raw = readString(bytes, start, length).trim();
  if (!raw) return 0;
  const value = parseInt(raw, 8);
  return Number.isFinite(value) ? value : 0;
}

export function parseTarGz(buffer: ArrayBuffer): TarEntry[] {
  const gz = new Uint8Array(buffer);
  const tar = gunzipSync(gz);
  const entries: TarEntry[] = [];
  let offset = 0;
  const decoder = new TextDecoder("utf-8", { fatal: false });

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = readString(header, 0, 100);
    if (!name) break;
    const prefix = readString(header, 345, 155);
    const size = readOctal(header, 124, 12);
    const type = String.fromCharCode(header[156] || 48);
    const fullPath = prefix ? prefix + "/" + name : name;
    offset += 512;
    const body = tar.subarray(offset, offset + size);
    offset += Math.ceil(size / 512) * 512;
    if (type !== "0" && type !== "" && type !== "7") continue;
    entries.push({ path: fullPath, content: decoder.decode(body), size });
  }
  return entries;
}
