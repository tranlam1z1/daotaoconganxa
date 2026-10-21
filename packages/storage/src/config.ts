/** Cấu hình kho đối tượng, đọc từ biến môi trường (.env được Bun nạp sẵn). */
import { isAbsolute, resolve } from "node:path";

/** Gốc monorepo, suy từ vị trí file này (packages/storage/src). */
const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..");

export type StorageMode = "r2" | "local";

export interface StorageConfig {
  mode: StorageMode;
  /** Thư mục kho khi chạy chế độ cục bộ, và là nơi giữ bản sao khi chạy R2. */
  dir: string;
  /** Bản sao cục bộ của đối tượng R2 — cần vì agent đọc tệp bằng đường dẫn. */
  cacheDir: string;
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  /** Tên miền công khai của bucket (nếu có), để sinh URL không cần ký. */
  publicUrl: string;
}

function abs(dir: string): string {
  return isAbsolute(dir) ? dir : resolve(REPO_ROOT, dir);
}

/**
 * Chế độ được suy ra, không cần khai báo:
 *   - đủ bốn biến R2_* -> dùng R2;
 *   - thiếu bất kỳ biến nào -> dùng thư mục cục bộ (chạy được ngay khi phát triển).
 * STORAGE_BACKEND=local|r2 ép chế độ khi cần thử nghiệm.
 */
export function storageConfig(): StorageConfig {
  const bucket = process.env.R2_BUCKET?.trim() || "";
  const account = process.env.R2_ACCOUNT_ID?.trim() || "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() || "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() || "";
  const endpoint =
    process.env.R2_ENDPOINT?.trim() || (account ? `https://${account}.r2.cloudflarestorage.com` : "");
  const forced = process.env.STORAGE_BACKEND?.trim().toLowerCase();
  const duR2 = Boolean(bucket && endpoint && accessKeyId && secretAccessKey);

  let mode: StorageMode = duR2 ? "r2" : "local";
  if (forced === "local") mode = "local";
  if (forced === "r2") {
    if (!duR2) {
      throw new Error(
        "STORAGE_BACKEND=r2 nhưng thiếu biến môi trường. Cần đủ: R2_BUCKET, R2_ACCESS_KEY_ID, " +
          "R2_SECRET_ACCESS_KEY và (R2_ACCOUNT_ID hoặc R2_ENDPOINT).",
      );
    }
    mode = "r2";
  }

  const dir = abs(process.env.STORAGE_DIR?.trim() || "./data");
  return {
    mode,
    dir,
    cacheDir: abs(process.env.STORAGE_CACHE_DIR?.trim() || `${dir}/cache-r2`),
    bucket,
    endpoint,
    accessKeyId,
    secretAccessKey,
    region: process.env.R2_REGION?.trim() || "auto",
    publicUrl: (process.env.R2_PUBLIC_URL?.trim() || "").replace(/\/+$/, ""),
  };
}
