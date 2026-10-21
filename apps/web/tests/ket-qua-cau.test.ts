/// <reference types="bun" />
/** Luật thuần của hộp kết quả đúng/sai (docs/PLAN.md GĐ17a, docs/PROMPT_HOP_KET_QUA_TRO_CHOI.md mục 2.7). */
import { describe, expect, test } from "bun:test";
import { coChiTiet, dapAnNgan, loaiKetQua, phutGiay, tieuDeKetQua } from "../app/lib/ket-qua-cau";
import type { DeCauHoi } from "../app/lib/ngan-hang";

const buoc = (x: Partial<Parameters<typeof tieuDeKetQua>[0]>) => ({
  dung: null,
  het_gio: false,
  diem: 0,
  diem_toi_da: 10,
  ...x,
});

describe("tiêu đề hộp", () => {
  test("dung true, false", () => {
    expect(tieuDeKetQua(buoc({ dung: true }))).toBe("Đúng");
    expect(tieuDeKetQua(buoc({ dung: false }))).toBe("Chưa đúng");
  });

  test("hết giờ thắng mọi giá trị của dung", () => {
    for (const dung of [true, false, null]) {
      expect(tieuDeKetQua(buoc({ dung, het_gio: true, diem: 10 }))).toBe("Hết giờ");
    }
  });

  test("dung null theo điểm (H6): đủ điểm, 0 điểm, một phần", () => {
    expect(tieuDeKetQua(buoc({ diem: 10 }))).toBe("Đúng");
    expect(tieuDeKetQua(buoc({ diem: 0 }))).toBe("Chưa đúng");
    expect(tieuDeKetQua(buoc({ diem: 5.5 }))).toBe("Đúng một phần");
    expect(loaiKetQua(buoc({ diem: 5.5 }))).toBe("mot_phan");
  });

  test("kết quả không có điểm (câu Vượt màn) chỉ theo dung", () => {
    expect(tieuDeKetQua({ dung: true })).toBe("Đúng");
    expect(tieuDeKetQua({ dung: false })).toBe("Chưa đúng");
    expect(tieuDeKetQua({ dung: null })).toBe("Chưa đúng");
    expect(tieuDeKetQua({ dung: null, diem: 3, diem_toi_da: 0 })).toBe("Chưa đúng");
  });
});

describe("nút Xem chi tiết", () => {
  test("không giải thích, không căn cứ, không chi tiết riêng thì không có nút", () => {
    expect(coChiTiet({ giai_thich: null, can_cu: [] })).toBe(false);
    expect(coChiTiet({ giai_thich: "   ", can_cu: [] })).toBe(false);
  });
  test("có một trong ba thì có nút", () => {
    expect(coChiTiet({ giai_thich: "Vì sao", can_cu: [] })).toBe(true);
    expect(coChiTiet({ giai_thich: null, can_cu: ["vn:luat:x#dieu-1"] })).toBe(true);
    expect(coChiTiet({ giai_thich: null, can_cu: [] }, true)).toBe(true);
  });
});

describe("đáp án một dòng", () => {
  const de = (kind: DeCauHoi["kind"]): DeCauHoi => ({
    kind,
    stem: "?",
    options: {
      phuong_an: [
        { id: "a", text: "Phương án A" },
        { id: "b", text: "Phương án B" },
      ],
    },
  });
  test("một đáp án, nhiều đáp án: chữ của phương án đúng", () => {
    expect(dapAnNgan(de("mot_dap_an"), { dap_an: { dung: ["b"] } })).toBe("Phương án B");
    expect(dapAnNgan(de("nhieu_dap_an"), { dap_an: { dung: ["a", "b"] } })).toBe("Phương án A; Phương án B");
  });
  test("đúng/sai", () => {
    expect(dapAnNgan({ kind: "dung_sai", stem: "?", options: {} }, { dap_an: { dung: ["sai"] } })).toBe(
      "Sai",
    );
  });
  test("loại khác, thiếu đáp án, mã lạ: không có dòng", () => {
    expect(dapAnNgan(de("sap_xep"), { dap_an: { thu_tu: ["a", "b"] } })).toBeNull();
    expect(dapAnNgan(de("mot_dap_an"), { dap_an: {} })).toBeNull();
    expect(dapAnNgan(de("mot_dap_an"), { dap_an: { dung: ["z"] } })).toBeNull();
  });
});

test("đồng hồ m:ss", () => {
  expect(phutGiay(0)).toBe("0:00");
  expect(phutGiay(61_000)).toBe("1:01");
  expect(phutGiay(59_001)).toBe("1:00");
  expect(phutGiay(-5)).toBe("0:00");
});
