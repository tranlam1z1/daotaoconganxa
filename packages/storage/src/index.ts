/**
 * Kho đối tượng dùng chung: **Cloudflare R2** (giao thức S3, qua `Bun.S3Client`)
 * hoặc **thư mục cục bộ** khi chưa cấu hình R2.
 *
 * Vì sao có lớp này: bản gốc PDF, ảnh trang và bản Markdown xuất bản phải nằm ngoài
 * CSDL (không bao giờ xóa, dung lượng lớn), nhưng mọi nơi trong hệ thống chỉ nên biết
 * một thứ duy nhất — **URI tương đối** kiểu `raw/congbao/2026/nghi-dinh/45-2026-nd-cp/<hash>.pdf`.
 * Cùng một URI chạy được cả trên máy phát triển (thư mục `data/`) lẫn trên R2.
 *
 * Quy ước tiền tố (ke-hoach/02 §3, ke-hoach/05 §2):
 *   raw/…       bản gốc tải về (PDF, DOCX, HTML) — KHÔNG bao giờ xóa
 *   pages/…     ảnh trang PNG dùng cho số hóa và cho màn hình "xem bản gốc"
 *   assets/…    ảnh cắt của bảng, hình, công thức
 *   derived/…   bản Markdown và cây JSON đã chốt của từng phiên bản văn bản
 *   work/…      tệp tạm của một việc số hóa (cửa sổ trang), xóa được sau khi xong
 */
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { type StorageConfig, type StorageMode, storageConfig } from "./config.ts";

export * from "./config.ts";
export * from "./keys.ts";

let client: import("bun").S3Client | undefined;
let clientKey = "";

function s3(cfg: StorageConfig): import("bun").S3Client {
  const key = `${cfg.endpoint}|${cfg.bucket}|${cfg.accessKeyId}`;
  if (!client || clientKey !== key) {
    client = new Bun.S3Client({
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
      bucket: cfg.bucket,
      endpoint: cfg.endpoint,
      region: cfg.region,
    });
    clientKey = key;
  }
  return client;
}

/** Chuẩn hóa URI: bỏ dấu "/" đầu, chặn "..", luôn dùng dấu "/" kiểu POSIX. */
export function normalizeUri(uri: string): string {
  const s = normalize(uri.trim().replace(/^\/+/, "")).replaceAll("\\", "/");
  if (s === ".." || s.startsWith("../") || s.includes("/../")) {
    throw new Error(`URI kho không hợp lệ (chứa ".."): ${uri}`);
  }
  if (!s || s === ".") throw new Error("URI kho rỗng");
  return s;
}

export function storageMode(): StorageMode {
  return storageConfig().mode;
}

/** Mô tả ngắn gọn kho đang dùng, để in ra nhật ký và công cụ chẩn đoán. */
export function storageLabel(): string {
  const cfg = storageConfig();
  return cfg.mode === "r2" ? `R2 bucket ${cfg.bucket}` : `thư mục ${cfg.dir}`;
}

/**
 * Đường dẫn tệp trên đĩa của một URI.
 * Chế độ cục bộ: chính là tệp thật. Chế độ R2: vị trí bản sao (có thể chưa tồn tại —
 * dùng `ensureLocalCopy` nếu cần chắc chắn có tệp).
 */
export function localPath(uri: string): string {
  const cfg = storageConfig();
  const u = normalizeUri(uri);
  return join(cfg.mode === "r2" ? cfg.cacheDir : cfg.dir, u);
}

export interface PutOptions {
  contentType?: string;
}

export interface StoredObject {
  uri: string;
  bytes: number;
  contentType?: string;
}

export async function putObject(
  uri: string,
  data: Uint8Array | ArrayBuffer | string,
  opts: PutOptions = {},
): Promise<StoredObject> {
  const cfg = storageConfig();
  const u = normalizeUri(uri);
  const buf = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data as ArrayBuffer);
  if (cfg.mode === "r2") {
    await s3(cfg)
      .file(u)
      .write(buf, opts.contentType ? { type: opts.contentType } : undefined);
  } else {
    const abs = join(cfg.dir, u);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, buf);
  }
  return { uri: u, bytes: buf.byteLength, ...(opts.contentType ? { contentType: opts.contentType } : {}) };
}

export async function putText(
  uri: string,
  text: string,
  contentType = "text/markdown",
): Promise<StoredObject> {
  return putObject(uri, text, { contentType });
}

export async function getObject(uri: string): Promise<Uint8Array> {
  const cfg = storageConfig();
  const u = normalizeUri(uri);
  if (cfg.mode === "r2") return new Uint8Array(await s3(cfg).file(u).arrayBuffer());
  return new Uint8Array(await readFile(join(cfg.dir, u)));
}

export async function getText(uri: string): Promise<string> {
  return new TextDecoder("utf-8").decode(await getObject(uri));
}

export async function objectExists(uri: string): Promise<boolean> {
  const cfg = storageConfig();
  const u = normalizeUri(uri);
  if (cfg.mode === "r2") return await s3(cfg).file(u).exists();
  try {
    await stat(join(cfg.dir, u));
    return true;
  } catch {
    return false;
  }
}

export async function deleteObject(uri: string): Promise<void> {
  const cfg = storageConfig();
  const u = normalizeUri(uri);
  if (cfg.mode === "r2") await s3(cfg).file(u).delete();
  else await rm(join(cfg.dir, u), { force: true });
}

/**
 * Bảo đảm có một BẢN SAO TRÊN ĐĨA của đối tượng và trả về đường dẫn tuyệt đối.
 * Đây là điểm nối cho agent số hóa: mô hình đọc tệp PDF/PNG bằng đường dẫn, nên
 * đối tượng nằm trên R2 phải được tải về thư mục bản sao trước.
 */
export async function ensureLocalCopy(uri: string): Promise<string> {
  const cfg = storageConfig();
  const u = normalizeUri(uri);
  const abs = localPath(u);
  if (cfg.mode === "local") {
    await stat(abs); // ném lỗi rõ ràng nếu tệp không có
    return abs;
  }
  try {
    const st = await stat(abs);
    if (st.size > 0) return abs;
  } catch {
    // chưa có bản sao — tải về
  }
  const bytes = await getObject(u);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, bytes);
  return abs;
}

/** Ghi tệp vào kho TỪ một tệp trên đĩa (không nạp hết vào bộ nhớ khi chạy cục bộ). */
export async function putFromFile(
  uri: string,
  filePath: string,
  opts: PutOptions = {},
): Promise<StoredObject> {
  const bytes = new Uint8Array(await readFile(filePath));
  return putObject(uri, bytes, opts);
}

/**
 * URL đọc đối tượng. Có R2_PUBLIC_URL thì trả URL công khai; không thì trả URL ký
 * hạn ngắn. Chế độ cục bộ trả về `file://`.
 */
export function objectUrl(uri: string, expiresInSeconds = 3600): string {
  const cfg = storageConfig();
  const u = normalizeUri(uri);
  if (cfg.mode === "local") return `file://${join(cfg.dir, u)}`;
  if (cfg.publicUrl) return `${cfg.publicUrl}/${u}`;
  return s3(cfg).file(u).presign({ expiresIn: expiresInSeconds });
}

/** Liệt kê URI theo tiền tố (dùng cho đối soát; chế độ cục bộ quét thư mục). */
export async function listObjects(prefix: string, limit = 1000): Promise<string[]> {
  const cfg = storageConfig();
  const p = prefix.replace(/^\/+/, "");
  if (cfg.mode === "r2") {
    const res = await s3(cfg).list({ prefix: p, maxKeys: limit });
    return (res.contents ?? []).map((o) => o.key).filter(Boolean) as string[];
  }
  const glob = new Bun.Glob("**/*");
  const out: string[] = [];
  const root = join(cfg.dir, p);
  try {
    for await (const rel of glob.scan({ cwd: root, onlyFiles: true })) {
      out.push(`${p.replace(/\/+$/, "")}/${rel}`);
      if (out.length >= limit) break;
    }
  } catch {
    return [];
  }
  return out;
}

/**
 * Thư mục làm việc CỤC BỘ cho một việc số hóa: nơi đặt PDF cụm trang và ảnh trang để
 * agent đọc bằng đường dẫn. Đây là tệp tạm — KHÔNG đưa lên R2, xóa được sau khi xong.
 */
export function localWorkDir(...parts: string[]): string {
  const cfg = storageConfig();
  return join(cfg.dir, "work", ...parts.map((p) => p.replace(/[^A-Za-z0-9._-]/g, "-")));
}

/** Ghi một tệp tạm vào thư mục làm việc, trả về đường dẫn tuyệt đối. */
export async function writeWorkFile(taskId: string, ten: string, data: Uint8Array): Promise<string> {
  const dir = localWorkDir(taskId);
  await mkdir(dir, { recursive: true });
  const p = join(dir, ten.replace(/[^A-Za-z0-9._-]/g, "-"));
  await writeFile(p, data);
  return p;
}

/** Xóa thư mục làm việc của một việc số hóa đã xong. */
export async function clearWorkDir(taskId: string): Promise<void> {
  await rm(localWorkDir(taskId), { recursive: true, force: true });
}
