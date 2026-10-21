/**
 * Khớp lời nói với phương án (docs/PLAN.md GĐ14) và lời đọc sách nói của từng khối.
 */
import { describe, expect, test } from "bun:test";
import { chuanHoaLoiNoi, khopLoiNoi, type PhuongAnLoiNoi } from "../src/khop-loi-noi.ts";
import { boMarkdown, loiDocCuaKhoi } from "../src/sach-noi.ts";

const BON: PhuongAnLoiNoi[] = [
  { id: "p1", text: "Phạt tiền từ 2.000.000 đồng đến 3.000.000 đồng" },
  { id: "p2", text: "Tước giấy phép lái xe từ 10 tháng đến 12 tháng" },
  { id: "p3", text: "Cảnh cáo" },
  { id: "p4", text: "Tạm giữ phương tiện 7 ngày" },
];
const DUNG_SAI: PhuongAnLoiNoi[] = [
  { id: "dung", text: "Đúng" },
  { id: "sai", text: "Sai" },
];

const idCua = (loi: string, pa = BON) => {
  const kq = khopLoiNoi(loi, pa);
  return kq.loai === "khop" ? kq.id : "khong_chac";
};

describe("chuẩn hóa lời nói", () => {
  test("bỏ dấu, chữ thường, bỏ dấu câu", () => {
    expect(chuanHoaLoiNoi("  Đáp án B.  ")).toBe("dap an b");
    expect(chuanHoaLoiNoi("Nồng độ cồn?")).toBe("nong do con");
  });
});

describe("khớp theo chữ cái", () => {
  test('"a", "đáp án a", "A." đều khớp phương án A', () => {
    for (const loi of ["a", "đáp án a", "A.", "Đáp án A", "phương án a", "tôi chọn A"]) {
      expect(idCua(loi)).toBe("p1");
    }
  });

  test('"bê" khớp B; cách đọc tên chữ cái khác cũng nhận', () => {
    expect(idCua("bê")).toBe("p2");
    expect(idCua("Bờ")).toBe("p2");
    expect(idCua("đáp án xê")).toBe("p3");
    expect(idCua("đê")).toBe("p4");
    expect(idCua("dờ")).toBe("p4");
  });

  test('tiểu từ cuối câu không làm lệch: "B ạ" là B, không phải A', () => {
    expect(idCua("đáp án B ạ")).toBe("p2");
    expect(idCua("A nhé")).toBe("p1");
  });

  test("số thứ tự sau lời đệm", () => {
    expect(idCua("phương án hai")).toBe("p2");
    expect(idCua("đáp án 3")).toBe("p3");
  });

  test("chữ cái không có trong câu: không chắc", () => {
    const kq = khopLoiNoi("đáp án D", DUNG_SAI);
    expect(kq).toEqual({ loai: "khong_chac", lyDo: "ngoai_pham_vi" });
  });
});

describe("khớp theo nội dung", () => {
  test("đọc gần đúng nội dung phương án", () => {
    expect(idCua("cảnh cáo")).toBe("p3");
    expect(idCua("tước giấy phép lái xe mười tháng đến mười hai tháng")).toBe("p2");
    expect(idCua("tạm giữ phương tiện bảy ngày")).toBe("p4");
  });

  test("câu đúng/sai: nói đúng hoặc sai", () => {
    expect(idCua("đúng", DUNG_SAI)).toBe("dung");
    expect(idCua("Sai.", DUNG_SAI)).toBe("sai");
    expect(idCua("đúng rồi", DUNG_SAI)).toBe("dung");
  });
});

describe("lời nói mơ hồ trả không chắc, không đoán", () => {
  test("nói hai chữ cái", () => {
    expect(khopLoiNoi("a hoặc b", BON)).toEqual({ loai: "khong_chac", lyDo: "mo_ho" });
    expect(khopLoiNoi("b c", BON).loai).toBe("khong_chac");
  });

  test("lời không liên quan hoặc rỗng", () => {
    expect(khopLoiNoi("để tôi nghĩ đã", BON).loai).toBe("khong_chac");
    expect(khopLoiNoi("   ", BON)).toEqual({ loai: "khong_chac", lyDo: "rong" });
  });

  test('phủ định: "không đúng" không bị hiểu là "Đúng"', () => {
    expect(khopLoiNoi("không đúng", DUNG_SAI).loai).toBe("khong_chac");
  });

  test("nội dung gần đều hai phương án", () => {
    const gan: PhuongAnLoiNoi[] = [
      { id: "x", text: "Phạt tiền từ 4.000.000 đồng đến 6.000.000 đồng" },
      { id: "y", text: "Phạt tiền từ 6.000.000 đồng đến 8.000.000 đồng" },
    ];
    expect(khopLoiNoi("phạt tiền đồng", gan).loai).toBe("khong_chac");
  });
});

describe("lời đọc sách nói", () => {
  test("bỏ ký hiệu Markdown", () => {
    expect(boMarkdown("## Tiêu đề\n**Đậm** và [liên kết](/a)")).toBe("Tiêu đề\nĐậm và liên kết");
  });

  test("khối giảng, căn cứ, ghi nhớ đọc được; khối video bỏ qua", () => {
    expect(loiDocCuaKhoi({ kind: "giang", data: { md: "Người lái xe **phải** dừng." } })).toBe(
      "Người lái xe phải dừng.",
    );
    expect(
      loiDocCuaKhoi({ kind: "can_cu", data: { nhan: "Khoản 1 Điều 9", nguyen_van: "Nghiêm cấm lái xe." } }),
    ).toBe("Căn cứ: Khoản 1 Điều 9.\nNghiêm cấm lái xe.");
    expect(loiDocCuaKhoi({ kind: "tom_tat", data: { y: ["Ý một", "Ý hai."] } })).toBe(
      "Ghi nhớ.\nÝ một.\nÝ hai.",
    );
    expect(loiDocCuaKhoi({ kind: "video", data: { nguon: "x.mp4" } })).toBe("");
  });

  test("câu tự kiểm tra chỉ đọc câu hỏi và phương án, không đọc đáp án", () => {
    const loi = loiDocCuaKhoi({
      kind: "hoi_nhanh",
      data: {
        cau_hoi: "Đèn vàng thì làm gì",
        phuong_an: [
          { id: "a", text: "Dừng lại" },
          { id: "b", text: "Đi tiếp" },
        ],
        dap_an: "a",
        giai_thich: "Bí mật",
      },
    });
    expect(loi).toContain("Phương án A: Dừng lại.");
    expect(loi).not.toContain("Bí mật");
  });
});
