import { describe, expect, test } from "bun:test";
import { contentKey, DedupeIndex, fileHash, titleKey } from "../src/crawler/dedupe.ts";

describe("fileHash", () => {
  test("SHA-256 hex, ổn định giữa các lần chạy", () => {
    const h = fileHash("abc");
    expect(h).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(h).toHaveLength(64);
  });

  test("cùng nội dung -> cùng hash dù khác kiểu dữ liệu", () => {
    const bytes = new TextEncoder().encode("nội dung văn bản");
    expect(fileHash(bytes)).toBe(fileHash("nội dung văn bản"));
  });

  test("khác một byte -> khác hash", () => {
    expect(fileHash("Điều 1")).not.toBe(fileHash("Điều 2"));
  });
});

describe("contentKey (số ký hiệu + cơ quan + ngày)", () => {
  test("bất biến với cách viết số ký hiệu", () => {
    const a = contentKey({ soKyHieu: "Số: 45/2026/NÐ-CP", issuer: "CHÍNH PHỦ", issuedDate: "2026-01-26" });
    const b = contentKey({ soKyHieu: "45/2026/NĐ-CP", issuer: "Chính phủ", issuedDate: "2026-01-26" });
    expect(a).toBe(b);
  });

  test("dùng tên cơ quan HIỆN HÀNH nên tên cũ/mới vẫn trùng khóa", () => {
    const cu = contentKey({
      soKyHieu: "10/2020/TT-BTTTT",
      issuer: "Bộ Thông tin và Truyền thông",
      issuedDate: "2020-05-01",
    });
    const moi = contentKey({
      soKyHieu: "10/2020/TT-BTTTT",
      issuer: "Bộ Khoa học và Công nghệ",
      issuedDate: "2020-05-01",
    });
    expect(cu).toBe(moi);
  });

  test("khác ngày ban hành -> khác khóa", () => {
    const a = contentKey({ soKyHieu: "45/2026/NĐ-CP", issuer: "Chính phủ", issuedDate: "2026-01-26" });
    const b = contentKey({ soKyHieu: "45/2026/NĐ-CP", issuer: "Chính phủ", issuedDate: "2026-02-26" });
    expect(a).not.toBe(b);
  });

  test("thiếu cơ quan / ngày vẫn tạo được khóa", () => {
    expect(contentKey({ soKyHieu: "45/2026/NĐ-CP" })).toBe("45/2026/NĐ-CP||");
  });
});

describe("DedupeIndex", () => {
  test("phát hiện trùng hash", () => {
    const idx = new DedupeIndex();
    expect(idx.seenHash("aaa")).toBe(false);
    expect(idx.seenHash("aaa")).toBe(true);
    expect(idx.seenHash("bbb")).toBe(false);
  });

  test("phát hiện trùng khóa nội dung", () => {
    const idx = new DedupeIndex();
    const k = contentKey({ soKyHieu: "45/2026/NĐ-CP", issuer: "Chính phủ", issuedDate: "2026-01-26" });
    expect(idx.seenKey(k)).toBe(false);
    // Cùng văn bản lấy từ nguồn khác, viết số ký hiệu khác kiểu.
    const k2 = contentKey({ soKyHieu: "Số: 45/2026/NÐ-CP", issuer: "CHÍNH PHỦ", issuedDate: "2026-01-26" });
    expect(idx.seenKey(k2)).toBe(true);
    expect(idx.size).toBe(1);
  });

  test("hash và khóa là hai không gian riêng", () => {
    const idx = new DedupeIndex();
    idx.seenHash("x");
    expect(idx.seenKey("x")).toBe(false);
  });
});

describe("titleKey", () => {
  test("bỏ dấu, bỏ ký tự đặc biệt để so khớp tiêu đề giữa các nguồn", () => {
    expect(titleKey("Nghị định số 45/2026/NĐ-CP")).toBe(titleKey("nghi dinh so 45 2026 nd cp"));
    expect(titleKey("Quy định  quản lý!")).toBe("quy dinh quan ly");
  });
});
