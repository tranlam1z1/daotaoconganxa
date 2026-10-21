import { describe, expect, test } from "bun:test";
import {
  formatVietnameseDate,
  isValidSoKyHieu,
  normalizeAgency,
  normalizeDocType,
  normalizeSoKyHieu,
  normalizeText,
  parseVietnameseDate,
} from "../src/crawler/normalize.ts";

describe("normalizeSoKyHieu", () => {
  test("bỏ tiền tố 'Số:' và khoảng trắng", () => {
    expect(normalizeSoKyHieu("Số: 45/2026/NĐ-CP")).toBe("45/2026/NĐ-CP");
    expect(normalizeSoKyHieu("  số 45 / 2026 / NĐ-CP ")).toBe("45/2026/NĐ-CP");
    expect(normalizeSoKyHieu("SỐ:45/2026/NĐ-CP")).toBe("45/2026/NĐ-CP");
  });

  test("chữ Ð Latin (U+00D0) -> Đ Việt (U+0110)", () => {
    // "NÐ-CP" dùng Ð Latin, hay gặp khi copy từ PDF Công báo.
    expect(normalizeSoKyHieu("45/2026/NÐ-CP")).toBe("45/2026/NĐ-CP");
    expect(normalizeSoKyHieu("45/2026/NÐ-CP").codePointAt(9)).toBe(0x110);
  });

  test("chuẩn hóa NFC và viết hoa hậu tố", () => {
    // "Đ" dạng NFD (D + dấu hỏi tổ hợp) phải gộp về NFC.
    const nfd = "45/2026/NĐ-CP".normalize("NFD");
    expect(normalizeSoKyHieu(nfd)).toBe("45/2026/NĐ-CP");
    expect(normalizeSoKyHieu("45/2026/nđ-cp")).toBe("45/2026/NĐ-CP");
    expect(normalizeSoKyHieu("12/2026/tt-bkhcn")).toBe("12/2026/TT-BKHCN");
  });

  test("gạch nối en dash -> gạch nối thường", () => {
    expect(normalizeSoKyHieu("45/2026/NĐ–CP")).toBe("45/2026/NĐ-CP");
  });

  test("isValidSoKyHieu", () => {
    expect(isValidSoKyHieu("45/2026/NĐ-CP")).toBe(true);
    expect(isValidSoKyHieu("91/2015/QH13")).toBe(true);
    expect(isValidSoKyHieu("không phải số")).toBe(false);
  });
});

describe("parseVietnameseDate", () => {
  test("dạng chữ đầy đủ", () => {
    expect(parseVietnameseDate("ngày 26 tháng 01 năm 2026")).toBe("2026-01-26");
    expect(parseVietnameseDate("Hà Nội, ngày 5 tháng 3 năm 2026")).toBe("2026-03-05");
  });

  test("tháng viết bằng chữ", () => {
    expect(parseVietnameseDate("ngày 05 tháng mười hai năm 2026")).toBe("2026-12-05");
    expect(parseVietnameseDate("ngày 1 tháng tư năm 2025")).toBe("2025-04-01");
  });

  test("dạng số", () => {
    expect(parseVietnameseDate("26/01/2026")).toBe("2026-01-26");
    expect(parseVietnameseDate("19-06-2025")).toBe("2025-06-19");
    expect(parseVietnameseDate("26.01.2026")).toBe("2026-01-26");
  });

  test("dạng ISO không bị đảo ngày/tháng", () => {
    expect(parseVietnameseDate("2026-09-05")).toBe("2026-09-05");
    expect(parseVietnameseDate("2018-05-15T00:00:00")).toBe("2018-05-15");
  });

  test("trả undefined khi không nhận ra", () => {
    expect(parseVietnameseDate("")).toBeUndefined();
    expect(parseVietnameseDate(undefined)).toBeUndefined();
    expect(parseVietnameseDate("không có ngày")).toBeUndefined();
    expect(parseVietnameseDate("32/13/2026")).toBeUndefined();
  });

  test("format ngược", () => {
    expect(formatVietnameseDate("2026-01-26")).toBe("ngày 26 tháng 01 năm 2026");
  });
});

describe("normalizeAgency", () => {
  test("chuẩn hóa IN HOA", () => {
    expect(normalizeAgency("CHÍNH PHỦ").name).toBe("Chính phủ");
    expect(normalizeAgency("Chính phủ").code).toBe("cp");
  });

  test("sáp nhập 2025: Bộ TT&TT -> Bộ KH&CN", () => {
    const r = normalizeAgency("Bộ Thông tin và Truyền thông");
    expect(r.currentName).toBe("Bộ Khoa học và Công nghệ");
    expect(r.code).toBe("bkhcn");
    expect(r.merged).toBe(true);
  });

  test("giữ tên lịch sử khi văn bản ban hành trước ngày sáp nhập", () => {
    const old = normalizeAgency("Bộ Thông tin và Truyền thông", "2018-05-15");
    expect(old.name).toBe("Bộ Thông tin và Truyền thông");
    expect(old.currentName).toBe("Bộ Khoa học và Công nghệ");
    const now = normalizeAgency("Bộ Thông tin và Truyền thông", "2026-01-01");
    expect(now.name).toBe("Bộ Khoa học và Công nghệ");
  });

  test("sáp nhập 2025: Bộ KH&ĐT -> Bộ Tài chính", () => {
    const r = normalizeAgency("Bộ Kế hoạch và Đầu tư");
    expect(r.currentName).toBe("Bộ Tài chính");
    expect(r.merged).toBe(true);
  });

  test("các sáp nhập khác", () => {
    expect(normalizeAgency("Bộ Giao thông vận tải").currentName).toBe("Bộ Xây dựng");
    expect(normalizeAgency("Bộ Tài nguyên và Môi trường").currentName).toBe("Bộ Nông nghiệp và Môi trường");
    expect(normalizeAgency("Bộ Nông nghiệp và Môi trường").merged).toBe(false);
  });

  test("cơ quan không có trong bảng thì giữ nguyên", () => {
    const r = normalizeAgency("Ủy ban nhân dân tỉnh Thanh Hóa");
    expect(r.name).toBe("Ủy ban nhân dân tỉnh Thanh Hóa");
    expect(r.code).toBeUndefined();
  });
});

describe("normalizeDocType", () => {
  test("suy từ số ký hiệu", () => {
    const r = normalizeDocType({ soKyHieu: "45/2026/NĐ-CP" });
    expect(r.docType).toBe("nd");
    expect(r.rank).toBe(50);
    expect(r.isNormative).toBe(true);
    expect(r.from).toBe("so_ky_hieu");
  });

  test("phân biệt Luật / Bộ luật / Nghị quyết theo tiêu đề", () => {
    expect(normalizeDocType({ soKyHieu: "91/2015/QH13", title: "Bộ luật Dân sự" }).docType).toBe("bl");
    expect(
      normalizeDocType({ soKyHieu: "64/2025/QH15", title: "Luật Ban hành văn bản quy phạm pháp luật" })
        .docType,
    ).toBe("l");
    expect(normalizeDocType({ soKyHieu: "12/2026/QH15", title: "Nghị quyết về thí điểm" }).docType).toBe(
      "nq-qh",
    );
  });

  test("dùng tên loại của nguồn khi số ký hiệu không đủ", () => {
    const r = normalizeDocType({ soKyHieu: "01/2026", typeName: "Thông tư" });
    expect(r.docType).toBe("tt");
    expect(r.from).toBe("type_name");
  });

  test("thông tư của bộ", () => {
    expect(normalizeDocType({ soKyHieu: "16/2025/TT-BNNMT" }).docType).toBe("tt");
    expect(normalizeDocType({ soKyHieu: "05/2026/TTLT-BTP-BTC" }).docType).toBe("ttlt");
  });
});

describe("normalizeText", () => {
  test("gộp khoảng trắng, giữ xuống dòng, đổi ngoặc kép cong", () => {
    expect(normalizeText("a   b\nc  d")).toBe("a b\nc d");
    expect(normalizeText("“abc”")).toBe('"abc"');
    expect(normalizeText("A B")).toBe("A B");
  });
});
