/** Đoán thuộc tính văn bản từ lớp văn bản của PDF (src/thuoc-tinh.ts). */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { docTrangPdf } from "../src/pdf.ts";
import { nhapTuLopVanBan } from "../src/postprocess.ts";
import { doanThuocTinh } from "../src/thuoc-tinh.ts";
import type { TrangText } from "../src/types.ts";

function trang(so: number, dong: string[]): TrangText {
  const text = dong.join("\n");
  return { trang: so, text, dong, soKyTu: text.replace(/\s/g, "").length, khoi: [], rong: 595, cao: 842 };
}

describe("doanThuocTinh", () => {
  test("thông tư in hai cột: số ký hiệu, ngày ban hành, trích yếu, cơ quan, ngày hiệu lực", () => {
    const tt = doanThuocTinh([
      trang(1, [
        "BỘ CÔNG AN",
        "-------",
        "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
        "Độc lập - Tự do - Hạnh phúc",
        "---------------",
        "Số: 65/2024/TT-BCA",
        "Hà Nội, ngày 12 tháng 11 năm 2024",
        "THÔNG TƯ",
        "Quy định kiểm tra kiến thức pháp luật về trật tự, an toàn giao thông",
        "đường bộ để được phục hồi điểm giấy phép lái xe",
        "Căn cứ Luật Trật tự, an toàn giao thông đường bộ ngày 27 tháng 6 năm 2024;",
        "Điều 1. Phạm vi điều chỉnh",
      ]),
      trang(2, [
        "Điều 12. Hiệu lực thi hành",
        "Thông tư này có hiệu lực thi hành từ ngày 01 tháng 01",
        "năm 2025.",
      ]),
    ]);
    expect(tt).toEqual({
      soKyHieu: "65/2024/TT-BCA",
      issuedDate: "2024-11-12",
      title:
        "Quy định kiểm tra kiến thức pháp luật về trật tự, an toàn giao thông đường bộ để được phục hồi điểm giấy phép lái xe",
      issuer: "BỘ CÔNG AN",
      effectiveFrom: "2025-01-01",
    });
  });

  test("không lấy ngày trong câu căn cứ làm ngày ban hành", () => {
    const tt = doanThuocTinh([
      trang(1, [
        "CHÍNH PHỦ",
        "Số: 45/2026/NĐ-CP",
        "NGHỊ ĐỊNH",
        "Quy định mẫu",
        "Căn cứ Luật Tổ chức Chính phủ ngày 18 tháng 02 năm 2025;",
      ]),
    ]);
    expect(tt.issuedDate).toBeUndefined();
    expect(tt.effectiveFrom).toBeUndefined();
  });

  test("có hiệu lực từ ngày ký thì lấy ngày ban hành", () => {
    const tt = doanThuocTinh([
      trang(1, [
        "Số: 12/2025/QĐ-TTg",
        "Hà Nội, ngày 5 tháng 3 năm 2025",
        "QUYẾT ĐỊNH",
        "Về việc thử",
        "Điều 1. Nội dung",
        "Điều 2. Quyết định này có hiệu lực thi hành kể từ ngày ký.",
      ]),
    ]);
    expect(tt.effectiveFrom).toBe("2025-03-05");
  });

  test("bản quét không có chữ: không đoán gì", () => {
    expect(doanThuocTinh([trang(1, [])])).toEqual({});
    expect(doanThuocTinh([])).toEqual({});
  });

  test("PDF Công báo mẫu: bỏ dòng đầu trang Công báo, đọc đúng phần đầu", () => {
    const tep = join(import.meta.dir, "../../../services/docproc/tests/fixtures/nghi-dinh-45-2026-nd-cp.pdf");
    const tt = doanThuocTinh(docTrangPdf(new Uint8Array(readFileSync(tep))));
    expect(tt.soKyHieu).toBe("45/2026/NĐ-CP");
    expect(tt.issuer).toBe("CHÍNH PHỦ");
    expect(tt.title).toBe(
      "Quy định quản lý đầu tư ứng dụng công nghệ thông tin sử dụng nguồn vốn ngân sách nhà nước",
    );
  });
});

describe("nhapTuLopVanBan với giuSoGiuaTrang (nạp PDF từ trang quản trị)", () => {
  const bang = trang(1, [
    "CÔNG BÁO/Số 123 + 124   Ngày 15-6-2026",
    "4",
    "Bảng 1. Định mức",
    "Khảo sát",
    "20",
    "Thiết kế",
    "35",
    "Điều 5. Hiệu lực thi hành",
    "- 4 -",
  ]);
  const chuKy = trang(2, [
    "CÔNG BÁO/Số 123 + 124   Ngày 15-6-2026",
    "5",
    "Bảo hành",
    "12",
    "Nơi nhận:",
    "- Lưu: VT.",
    "TM. CHÍNH PHỦ",
    "Nguyễn Văn A",
  ]);

  test("giữ ô số giữa trang, bỏ số trang đầu và cuối trang, bỏ dòng Công báo cả ở trang chữ ký", () => {
    const md = nhapTuLopVanBan([bang, chuKy], { giuSoGiuaTrang: true });
    expect(md).not.toContain("CÔNG BÁO");
    expect(md).toContain("Khảo sát 20 Thiết kế 35");
    expect(md).toContain("Bảo hành 12");
    expect(md).not.toContain("- 4 -");
    expect(md).toContain("Nguyễn Văn A");
  });

  test("mặc định giữ hành vi cũ của bản nháp cho agent", () => {
    const md = nhapTuLopVanBan([bang, chuKy]);
    expect(md).not.toContain("Khảo sát 20");
    expect(md).toContain("CÔNG BÁO");
  });
});

describe("doanThuocTinh: người ký", () => {
  const dau = ["BỘ CÔNG AN", "Số: 65/2024/TT-BCA", "THÔNG TƯ", "Quy định thử", "Điều 1. Phạm vi điều chỉnh"];

  test("ký thay, có cấp hàm, danh sách Nơi nhận trích xen vào giữa", () => {
    const tt = doanThuocTinh([
      trang(1, dau),
      trang(2, [
        "Điều 12. Hiệu lực thi hành",
        "Nơi nhận:",
        "KT. BỘ TRƯỞNG",
        "- Văn phòng Chính phủ;",
        "THỨ TRƯỞNG",
        "- Lưu: VT, C08.",
        "(Đã ký)",
        "Thượng tướng Nguyễn Văn Long",
      ]),
    ]);
    expect(tt.signer).toBe("Thượng tướng Nguyễn Văn Long");
  });

  test("lấy khối chữ ký của văn bản, không lấy của phụ lục phía sau", () => {
    const tt = doanThuocTinh([
      trang(1, dau),
      trang(2, ["TM. CHÍNH PHỦ", "THỦ TƯỚNG", "Phạm Minh Chính", "PHỤ LỤC I", "GIÁM ĐỐC", "Trần Văn B"]),
    ]);
    expect(tt.signer).toBe("Phạm Minh Chính");
  });

  test("dưới chức danh không phải họ tên thì bỏ trống, không đoán", () => {
    const tt = doanThuocTinh([
      trang(1, dau),
      trang(2, ["CHỦ TỊCH", "Ủy ban nhân dân cấp tỉnh quyết định việc thành lập.", "Điều 3. Tổ chức"]),
    ]);
    expect(tt.signer).toBeUndefined();
  });

  test("PDF Công báo mẫu", () => {
    const tep = join(import.meta.dir, "../../../services/docproc/tests/fixtures/nghi-dinh-45-2026-nd-cp.pdf");
    expect(doanThuocTinh(docTrangPdf(new Uint8Array(readFileSync(tep)))).signer).toBe("Nguyễn Văn A");
  });
});
