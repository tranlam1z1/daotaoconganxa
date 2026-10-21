/**
 * Đọc file ZIP tối thiểu (đủ cho DOCX): duyệt Central Directory rồi giải nén
 * entry cần dùng. Không phụ thuộc thư viện ngoài.
 * Hỗ trợ method 0 (store) và 8 (deflate); ZIP64 chỉ ở mức phát hiện và báo lỗi.
 */
import { inflateRawSync } from "node:zlib";

const EOCD_SIG = 0x06054b50;
const CDH_SIG = 0x02014b50;
const LFH_SIG = 0x04034b50;

export interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

function findEocd(view: DataView): number {
  const max = Math.min(view.byteLength, 0xffff + 22);
  for (let i = 22; i <= max; i++) {
    const off = view.byteLength - i;
    if (off < 0) break;
    if (view.getUint32(off, true) === EOCD_SIG) return off;
  }
  return -1;
}

export function listZipEntries(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEocd(view);
  if (eocd < 0) throw new Error("Không tìm thấy End of Central Directory — file không phải ZIP hợp lệ");
  const count = view.getUint16(eocd + 10, true);
  let off = view.getUint32(eocd + 16, true);
  if (off === 0xffffffff) throw new Error("ZIP64 chưa được hỗ trợ");
  const entries: ZipEntry[] = [];
  const dec = new TextDecoder("utf-8");
  for (let i = 0; i < count; i++) {
    if (view.getUint32(off, true) !== CDH_SIG) break;
    const method = view.getUint16(off + 10, true);
    const compressedSize = view.getUint32(off + 20, true);
    const uncompressedSize = view.getUint32(off + 24, true);
    const nameLen = view.getUint16(off + 28, true);
    const extraLen = view.getUint16(off + 30, true);
    const commentLen = view.getUint16(off + 32, true);
    const localHeaderOffset = view.getUint32(off + 42, true);
    const name = dec.decode(bytes.subarray(off + 46, off + 46 + nameLen));
    entries.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

export function readZipEntry(bytes: Uint8Array, entry: ZipEntry): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const lfh = entry.localHeaderOffset;
  if (view.getUint32(lfh, true) !== LFH_SIG) {
    throw new Error(`Local file header hỏng tại offset ${lfh} (entry ${entry.name})`);
  }
  const nameLen = view.getUint16(lfh + 26, true);
  const extraLen = view.getUint16(lfh + 28, true);
  const start = lfh + 30 + nameLen + extraLen;
  const raw = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return raw;
  if (entry.method === 8) return new Uint8Array(inflateRawSync(raw));
  throw new Error(`Phương thức nén ${entry.method} chưa hỗ trợ (entry ${entry.name})`);
}

/**
 * Chuẩn hóa tên entry: một số công cụ (kể cả DOCX của Công báo) ghi dấu phân
 * cách thư mục bằng "\" thay vì "/" theo chuẩn ZIP.
 */
export function normalizeEntryName(name: string): string {
  return name.replace(/\\/g, "/").replace(/^\.?\//, "");
}

/** Đọc một entry theo tên; trả về undefined nếu không có. */
export function readZipFile(bytes: Uint8Array, name: string): Uint8Array | undefined {
  const want = normalizeEntryName(name).toLowerCase();
  const entry = listZipEntries(bytes).find((e) => normalizeEntryName(e.name).toLowerCase() === want);
  return entry ? readZipEntry(bytes, entry) : undefined;
}

export function readZipText(bytes: Uint8Array, name: string): string | undefined {
  const data = readZipFile(bytes, name);
  return data ? new TextDecoder("utf-8").decode(data) : undefined;
}
