/** Kho đối tượng: chế độ cục bộ chạy được ngay, chế độ R2 suy ra từ biến môi trường. */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { storageConfig } from "../src/config.ts";
import {
  deleteObject,
  ensureLocalCopy,
  getText,
  listObjects,
  localPath,
  normalizeUri,
  objectExists,
  objectUrl,
  putObject,
  putText,
  storageMode,
  writeWorkFile,
} from "../src/index.ts";
import { derivedMarkdownKey, pageKey, slugKey } from "../src/keys.ts";

let dir = "";
const moiTruongCu = { ...process.env };

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "qdpl-kho-"));
  process.env.STORAGE_DIR = dir;
  process.env.STORAGE_BACKEND = "local";
});

afterAll(async () => {
  process.env = moiTruongCu;
  await rm(dir, { recursive: true, force: true });
});

describe("kho đối tượng — chế độ cục bộ", () => {
  test("ghi, đọc, kiểm tra tồn tại và xóa", async () => {
    expect(storageMode()).toBe("local");
    const r = await putText("derived/abc/v1/document.md", "# Nghị định\n");
    expect(r.bytes).toBeGreaterThan(0);
    expect(await getText("derived/abc/v1/document.md")).toBe("# Nghị định\n");
    expect(await objectExists("derived/abc/v1/document.md")).toBe(true);
    expect(await objectExists("derived/abc/v1/khong-co.md")).toBe(false);
    await deleteObject("derived/abc/v1/document.md");
    expect(await objectExists("derived/abc/v1/document.md")).toBe(false);
  });

  test("URI được chuẩn hóa và chặn thoát thư mục", () => {
    expect(normalizeUri("/raw/a/b.pdf")).toBe("raw/a/b.pdf");
    expect(() => normalizeUri("../../etc/passwd")).toThrow();
    expect(() => normalizeUri("raw/../../etc/passwd")).toThrow();
    expect(localPath("raw/a.pdf")).toBe(join(dir, "raw/a.pdf"));
  });

  test("bản sao cục bộ và tệp tạm của việc số hóa", async () => {
    await putObject("raw/x/y.pdf", new Uint8Array([1, 2, 3]));
    expect(await ensureLocalCopy("raw/x/y.pdf")).toBe(join(dir, "raw/x/y.pdf"));
    const p = await writeWorkFile("viec-1", "cum-001.pdf", new Uint8Array([4, 5]));
    expect(await Bun.file(p).exists()).toBe(true);
    expect(objectUrl("raw/x/y.pdf")).toStartWith("file://");
  });

  test("liệt kê theo tiền tố", async () => {
    await putText("pages/doc1/0001.png", "a");
    await putText("pages/doc1/0002.png", "b");
    const ds = await listObjects("pages/doc1");
    expect(ds.sort()).toEqual(["pages/doc1/0001.png", "pages/doc1/0002.png"]);
  });

  test("khóa được sinh theo đúng quy ước", () => {
    expect(pageKey("doc1", 7)).toBe("pages/doc1/0007.png");
    expect(derivedMarkdownKey("doc1", 2)).toBe("derived/doc1/v2/document.md");
    expect(slugKey("Nghị định 45/2026/NĐ-CP")).toBe("nghi-dinh-45-2026-nd-cp");
  });
});

describe("chọn chế độ kho", () => {
  test("đủ biến R2 thì tự dùng R2, thiếu thì về thư mục cục bộ", () => {
    process.env.STORAGE_BACKEND = "";
    process.env.R2_BUCKET = "qdpl";
    process.env.R2_ACCOUNT_ID = "acc123";
    process.env.R2_ACCESS_KEY_ID = "k";
    process.env.R2_SECRET_ACCESS_KEY = "s";
    const cfg = storageConfig();
    expect(cfg.mode).toBe("r2");
    expect(cfg.endpoint).toBe("https://acc123.r2.cloudflarestorage.com");
    process.env.R2_SECRET_ACCESS_KEY = "";
    expect(storageConfig().mode).toBe("local");
  });

  test("ép R2 mà thiếu biến thì báo lỗi rõ ràng", () => {
    process.env.STORAGE_BACKEND = "r2";
    process.env.R2_BUCKET = "";
    expect(() => storageConfig()).toThrow(/thiếu biến môi trường/);
    process.env.STORAGE_BACKEND = "local";
  });
});
