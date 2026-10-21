/// <reference types="bun" />
/** Dữ liệu trang chủ: chia trang carousel, danh sách trò chơi, số liệu các ô chức năng (app/lib/trang-chu.ts). */
import { describe, expect, test } from "bun:test";
import type { TongQuanLuotChoi } from "../app/lib/luot-choi";
import type { PhienTomTat } from "../app/lib/luyen-tap.server";
import type { BaiThi } from "../app/lib/thi";
import { chiaTrang, danhSachTroChoi, danhSachTroChoiCongKhai, tinhThongKe } from "../app/lib/trang-chu";

const phien = (correct: number | null, total: number, xong = true) =>
  ({ finished_at: xong ? "2026-09-29T00:00:00Z" : null, correct, total }) as PhienTomTat;
const bai = (b: Partial<BaiThi>) =>
  ({ trang_thai: "chua_lam", so_luot_nop: 0, da_dat: false, ...b }) as BaiThi;

describe("chiaTrang", () => {
  test("6 thẻ mỗi trang, trang cuối có thể thiếu", () => {
    expect(chiaTrang([1, 2, 3, 4, 5, 6, 7]).map((t) => t.length)).toEqual([6, 1]);
    expect(chiaTrang([1, 2, 3, 4, 5, 6])).toHaveLength(1);
    expect(chiaTrang([])).toEqual([]);
  });
});

describe("danhSachTroChoi", () => {
  test("trò trên khung trước, trò cũ sau; trò có màn dẫn tới trang Trò chơi", () => {
    const tq = {
      tro_choi: [
        { ma: "thu_nghiem", ten: "Trắc nghiệm nhanh", mo_ta: "Mô tả", man: null },
        { ma: "tro_moi", ten: "Trò mới", mo_ta: "", man: [{ so: 1 }] },
      ],
      tro_choi_cu: ["vuot_man", "doan_bien_bao", "ma_la"],
      dang_choi: null,
      gan_day: [],
    } as unknown as TongQuanLuotChoi;
    expect(danhSachTroChoi(tq)).toEqual([
      { khoa: "thu_nghiem", nhan: "Trắc nghiệm nhanh", moTa: "Mô tả", to: null },
      { khoa: "tro_moi", nhan: "Trò mới", moTa: null, to: "/tro-choi?tro=tro_moi" },
      { khoa: "vuot_man", nhan: "Vượt màn", moTa: expect.any(String), to: "/tro-choi?tro=vuot_man" },
      {
        khoa: "doan_bien_bao",
        nhan: "Đoán biển báo",
        moTa: expect.any(String),
        to: "/tro-choi/doan-bien-bao",
      },
    ]);
  });
});

describe("danhSachTroChoiCongKhai", () => {
  test("mọi thẻ là liên kết tới trang của trò, kể cả trò chơi ngay một chạm", () => {
    const dm = {
      tro_choi: [
        { ma: "thu_nghiem", ten: "Trắc nghiệm nhanh", man: false },
        { ma: "tro_moi", ten: "Trò mới", man: true },
      ],
      tro_choi_cu: ["doan_bien_bao"],
    };
    expect(danhSachTroChoiCongKhai(dm).map((t) => t.to)).toEqual([
      "/tro-choi?tro=thu_nghiem",
      "/tro-choi?tro=tro_moi",
      "/tro-choi/doan-bien-bao",
    ]);
  });
});

describe("tinhThongKe", () => {
  test("đếm bài đang mở, đã thi, đạt; tỷ lệ đúng chỉ tính phiên đã xong", () => {
    const tk = tinhThongKe(
      [
        bai({ trang_thai: "chua_lam" }),
        bai({ trang_thai: "dang_lam", so_luot_nop: 1 }),
        bai({ trang_thai: "da_xong", so_luot_nop: 2, da_dat: true }),
        bai({ trang_thai: "het_han" }),
      ],
      [phien(8, 10), phien(2, 10), phien(null, 10, false)],
    );
    expect(tk.thi).toEqual({ dangMo: 2, daThi: 2, daDat: 1 });
    expect(tk.luyenTap).toEqual({ soPhien: 2, tyLeDung: 50 });
  });

  test("API lỗi thì phần đó null; chưa có phiên nào thì không có tỷ lệ", () => {
    expect(tinhThongKe(null, [])).toEqual({ thi: null, luyenTap: { soPhien: 0, tyLeDung: null } });
    expect(tinhThongKe([], null).luyenTap).toBeNull();
  });
});
