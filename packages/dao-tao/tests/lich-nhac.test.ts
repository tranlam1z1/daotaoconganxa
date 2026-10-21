/**
 * Lịch nhắc học (docs/PLAN.md GĐ15), dùng tham số `now` theo giờ Việt Nam (UTC+7): đúng giờ thì
 * có thông báo, giờ yên lặng thì không, đã học hôm nay thì không cảnh báo chuỗi ngày.
 */
import { describe, expect, test } from "bun:test";
import {
  CAI_DAT_MAC_DINH,
  dangKyHetHan,
  gioVietNam,
  phutTuChuoi,
  type TinhTrangNguoiHoc,
  thongBaoCanGui,
  trongGioYenLang,
} from "../src/index.ts";

/** Thời điểm theo giờ Việt Nam: "2026-09-24 19:30" -> Date (UTC). */
const luc = (vn: string) => new Date(`${vn.replace(" ", "T")}:00+07:00`);

const nguoi = (p: Partial<TinhTrangNguoiHoc> = {}): TinhTrangNguoiHoc => ({
  cai_dat: { ...CAI_DAT_MAC_DINH, remind_at: "19:30" },
  da_hoc_hom_nay: false,
  chuoi_ngay: 3,
  co_thu_thach: true,
  bai_giao_moi: [],
  ...p,
});

const loai = (t: TinhTrangNguoiHoc, now: Date) => thongBaoCanGui(t, now).map((x) => x.kind);

describe("giờ Việt Nam", () => {
  test("qua mốc 0h giờ Việt Nam thì sang ngày mới, dù giờ UTC vẫn là hôm trước", () => {
    expect(gioVietNam(new Date("2026-09-24T16:59:00Z"))).toEqual({ ngay: "2026-09-24", phut: 23 * 60 + 59 });
    expect(gioVietNam(new Date("2026-09-24T17:00:00Z"))).toEqual({ ngay: "2026-09-25", phut: 0 });
  });

  test("đọc giờ dạng HH:MM và HH:MM:SS", () => {
    expect(phutTuChuoi("07:05")).toBe(425);
    expect(phutTuChuoi("22:00:00")).toBe(1320);
    expect(phutTuChuoi("25:00")).toBeNull();
    expect(phutTuChuoi(null)).toBeNull();
  });

  test("giờ yên lặng qua nửa đêm", () => {
    expect(trongGioYenLang(23 * 60, 22 * 60, 6 * 60)).toBe(true);
    expect(trongGioYenLang(3 * 60, 22 * 60, 6 * 60)).toBe(true);
    expect(trongGioYenLang(6 * 60, 22 * 60, 6 * 60)).toBe(false);
    expect(trongGioYenLang(12 * 60, 13 * 60, 14 * 60)).toBe(false);
  });
});

describe("nhắc giờ học", () => {
  test("đúng giờ thì có trong danh sách gửi, ref là ngày Việt Nam", () => {
    const tb = thongBaoCanGui(nguoi(), luc("2026-09-24 19:30"));
    expect(tb).toEqual([expect.objectContaining({ kind: "nhac_hoc", ref: "2026-09-24", url: "/luyen-tap" })]);
  });

  test("job trễ một nhịp vẫn gửi trong cửa sổ; quá cửa sổ thì thôi", () => {
    expect(loai(nguoi(), luc("2026-09-24 19:44"))).toContain("nhac_hoc");
    expect(loai(nguoi(), luc("2026-09-24 21:29"))).toContain("nhac_hoc");
    expect(loai(nguoi(), luc("2026-09-24 21:30"))).not.toContain("nhac_hoc");
    expect(loai(nguoi(), luc("2026-09-24 19:29"))).not.toContain("nhac_hoc");
  });

  test("chưa đặt giờ nhắc hoặc đã học hôm nay thì không nhắc", () => {
    expect(loai(nguoi({ cai_dat: { ...CAI_DAT_MAC_DINH } }), luc("2026-09-24 19:30"))).toEqual([]);
    expect(loai(nguoi({ da_hoc_hom_nay: true }), luc("2026-09-24 19:30"))).toEqual([]);
  });

  test("giờ yên lặng thì không gửi, kể cả khi giờ nhắc nằm trong giờ yên lặng", () => {
    const khuya = nguoi({ cai_dat: { ...CAI_DAT_MAC_DINH, remind_at: "23:00" } });
    expect(loai(khuya, luc("2026-09-24 23:00"))).toEqual([]);
    const sang = nguoi({
      cai_dat: { ...CAI_DAT_MAC_DINH, remind_at: "05:30" },
      bai_giao_moi: [{ id: "g1", ten: "Đề 1" }],
    });
    expect(loai(sang, luc("2026-09-25 05:45"))).toEqual([]);
  });
});

describe("cảnh báo chuỗi ngày", () => {
  test("20h mà hôm nay chưa học thì cảnh báo", () => {
    expect(loai(nguoi(), luc("2026-09-24 20:00"))).toContain("chuoi_ngay");
  });

  test("người đã học hôm nay không nhận cảnh báo chuỗi ngày", () => {
    expect(loai(nguoi({ da_hoc_hom_nay: true }), luc("2026-09-24 20:00"))).not.toContain("chuoi_ngay");
  });

  test("chưa có chuỗi hoặc đã tắt cảnh báo thì không gửi; trước 20h thì chưa gửi", () => {
    expect(loai(nguoi({ chuoi_ngay: 0 }), luc("2026-09-24 20:10"))).not.toContain("chuoi_ngay");
    expect(
      loai(nguoi({ cai_dat: { ...CAI_DAT_MAC_DINH, streak_warning: false } }), luc("2026-09-24 20:10")),
    ).not.toContain("chuoi_ngay");
    expect(loai(nguoi(), luc("2026-09-24 19:59"))).not.toContain("chuoi_ngay");
  });
});

describe("thử thách và đề thi mới", () => {
  test("7h có thử thách thì gửi; không có câu thì không", () => {
    expect(loai(nguoi(), luc("2026-09-24 07:00"))).toContain("thu_thach");
    expect(loai(nguoi({ co_thu_thach: false }), luc("2026-09-24 07:00"))).not.toContain("thu_thach");
  });

  test("mỗi bài giao mới là một thông báo, ref là id bài giao; tắt thì không gửi", () => {
    const t = nguoi({
      bai_giao_moi: [
        { id: "g1", ten: "Đề 1" },
        { id: "g2", ten: "Đề 2" },
      ],
    });
    const tb = thongBaoCanGui(t, luc("2026-09-24 10:00")).filter((x) => x.kind === "de_thi_moi");
    expect(tb.map((x) => x.ref)).toEqual(["g1", "g2"]);
    expect(tb[0]).toMatchObject({ noi_dung: "Đề 1", url: "/thi" });
    expect(loai({ ...t, cai_dat: { ...t.cai_dat, new_exam: false } }, luc("2026-09-24 10:00"))).not.toContain(
      "de_thi_moi",
    );
  });
});

test("404 và 410 là đăng ký hết hạn", () => {
  expect(dangKyHetHan(410)).toBe(true);
  expect(dangKyHetHan(404)).toBe(true);
  expect(dangKyHetHan(500)).toBe(false);
  expect(dangKyHetHan(429)).toBe(false);
});
