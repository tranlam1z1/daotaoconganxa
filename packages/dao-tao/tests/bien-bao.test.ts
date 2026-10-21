/**
 * Biển báo (docs/PLAN.md GĐ12): kiểm tra tệp dữ liệu biển báo.
 */
import { describe, expect, test } from "bun:test";
import { type BienBao, chuoiTimBienBao, kiemTraBienBao } from "../src/index.ts";

describe("kiểm tra tệp biển báo", () => {
  const hopLe: BienBao = {
    ma: "P.102",
    nhom: "cam",
    ten: "Cấm đi ngược chiều",
    y_nghia: "Ý nghĩa.",
    anh: "P.102.svg",
    can_cu: "vn:vbqppl:qcvn:41/2024/BGTVT",
    trang_thai: "nhap",
  };

  test("dòng hợp lệ không có lỗi", () => expect(kiemTraBienBao([hopLe])).toEqual([]));

  test("bắt mã sai dạng, trùng mã, xếp nhầm nhóm, thiếu nội dung, căn cứ sai", () => {
    const loi = kiemTraBienBao([
      hopLe,
      { ...hopLe },
      { ...hopLe, ma: "W.224", nhom: "cam" },
      { ...hopLe, ma: "P102", ten: " ", can_cu: "QCVN 41" },
    ]).map((l) => l.loi);
    expect(loi).toContain("Mã biển bị trùng");
    expect(loi).toContain('Mã W.224 không thuộc nhóm "Biển báo cấm"');
    expect(loi).toContain('Mã biển không đúng dạng (ví dụ P.102): "P102"');
    expect(loi).toContain("Chưa có tên biển");
    expect(loi).toContain('Căn cứ không đúng dạng URN: "QCVN 41"');
  });

  test("chuỗi tìm kiếm không dấu", () => {
    expect(chuoiTimBienBao(hopLe)).toBe("p.102 cam di nguoc chieu");
  });
});
