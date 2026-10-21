/** Trò chơi hóa (docs/PLAN.md GĐ9): XP, cấp độ, chuỗi ngày theo giờ Việt Nam, huy hiệu, thử thách. */
import { describe, expect, test } from "bun:test";
import {
  capDo,
  chonCauThuThach,
  chuoiHienTai,
  dauKy,
  ghiNgayHoc,
  huyHieuDat,
  type LuatHuyHieu,
  ngayVietNam,
  QUY_TAC_XP,
  type TrangThaiChuoi,
  thuHaiCuaTuan,
  xpLuotThi,
  xpPhienLuyenTap,
} from "../src/diem-thuong.ts";

describe("ngày giờ Việt Nam", () => {
  test("qua mốc 0h giờ Việt Nam (UTC+7) thì sang ngày mới", () => {
    expect(ngayVietNam(new Date("2026-09-24T16:59:59Z"))).toBe("2026-09-24"); // 23:59:59 giờ VN
    expect(ngayVietNam(new Date("2026-09-24T17:00:00Z"))).toBe("2026-09-25"); // 00:00 giờ VN
  });

  test("đầu kỳ: thứ Hai của tuần và ngày 1 của tháng, theo giờ Việt Nam", () => {
    // Chủ nhật 27/9/2026 lúc 23:30 giờ VN vẫn thuộc tuần bắt đầu thứ Hai 21/9.
    expect(dauKy("tuan", new Date("2026-09-27T16:30:00Z"))).toBe("2026-09-21");
    // 0:30 thứ Hai 28/9 giờ VN đã sang tuần mới.
    expect(dauKy("tuan", new Date("2026-09-27T17:30:00Z"))).toBe("2026-09-28");
    expect(dauKy("thang", new Date("2026-09-30T17:30:00Z"))).toBe("2026-10-01");
    expect(thuHaiCuaTuan("2026-09-21")).toBe("2026-09-21");
  });
});

describe("chuỗi ngày học", () => {
  /** Ghi ngày học tại thời điểm UTC cho trước, ngày lấy theo giờ Việt Nam. */
  const hoc = (s: TrangThaiChuoi | null, utc: string) => ghiNgayHoc(s, ngayVietNam(new Date(utc)));

  // Ngày 1–3 là thứ Hai 21 đến thứ Tư 23/9/2026 (giờ VN), học lúc 23:30 giờ VN, sát mốc 0h.
  let s = hoc(null, "2026-09-21T16:30:00Z");
  s = hoc(s, "2026-09-22T16:30:00Z");
  s = hoc(s, "2026-09-23T16:30:00Z");

  test("học ngày 1, 2, 3 thì chuỗi = 3", () => {
    expect(s).toMatchObject({ current: 3, best: 3, last_day: "2026-09-23" });
    expect(chuoiHienTai(s, ngayVietNam(new Date("2026-09-23T17:30:00Z")))).toMatchObject({ hienTai: 3 });
  });

  test("bỏ ngày 4 mà còn lượt đóng băng thì chuỗi vẫn 3", () => {
    // Sáng ngày 5 (00:30 giờ VN ngày 25), ngày 24 không học.
    const ngay5 = ngayVietNam(new Date("2026-09-24T17:30:00Z"));
    expect(ngay5).toBe("2026-09-25");
    expect(chuoiHienTai(s, ngay5)).toMatchObject({ hienTai: 3, conDongBang: 1, daHocHomNay: false });
  });

  test("bỏ tiếp ngày 5 thì chuỗi về 0", () => {
    expect(chuoiHienTai(s, "2026-09-26")).toMatchObject({ hienTai: 0, totNhat: 3 });
  });

  test("học lại ngày 5 sau khi bỏ ngày 4: dùng lượt đóng băng, chuỗi = 4; bỏ tiếp một ngày thì đứt", () => {
    const s5 = ghiNgayHoc(s, "2026-09-25");
    expect(s5).toMatchObject({ current: 4, freezes_left: 0 });
    expect(chuoiHienTai(s5, "2026-09-27")).toMatchObject({ hienTai: 0 });
    expect(ghiNgayHoc(s5, "2026-09-27")).toMatchObject({ current: 1, best: 4 });
  });

  test("học hai lần một ngày không tăng chuỗi; sang tuần mới được cấp lại lượt đóng băng", () => {
    expect(ghiNgayHoc(s, "2026-09-23")).toEqual(s);
    const s5 = ghiNgayHoc(s, "2026-09-25"); // tuần 21/9, hết lượt
    const s6 = ghiNgayHoc(s5, "2026-09-26");
    // Thứ Hai 28/9 bỏ, thứ Ba 29/9 học: tuần mới có lượt mới nên chuỗi không đứt.
    const s7 = ghiNgayHoc(ghiNgayHoc(s6, "2026-09-27"), "2026-09-29");
    expect(s7.current).toBe(s6.current + 2);
    expect(s7.freezes_left).toBe(0);
  });
});

describe("XP và cấp độ", () => {
  test("XP phiên luyện tập và thử thách; phiên không trả lời câu nào không có XP", () => {
    expect(xpPhienLuyenTap({ nguon: "chu_de", dung: 7, daTraLoi: 10 })).toBe(
      7 * QUY_TAC_XP.cau_dung_luyen_tap + QUY_TAC_XP.hoan_thanh_phien,
    );
    expect(xpPhienLuyenTap({ nguon: "thu_thach", dung: 5, daTraLoi: 5 })).toBe(
      5 * 2 + QUY_TAC_XP.hoan_thanh_thu_thach,
    );
    expect(xpPhienLuyenTap({ nguon: "chu_de", dung: 0, daTraLoi: 0 })).toBe(0);
  });

  test("XP bài thi: nộp có thưởng, đạt thưởng thêm", () => {
    expect(xpLuotThi({ dat: false })).toBe(QUY_TAC_XP.nop_bai_thi);
    expect(xpLuotThi({ dat: true })).toBe(QUY_TAC_XP.nop_bai_thi + QUY_TAC_XP.dat_bai_thi);
  });

  test("cấp độ theo bảng ngưỡng", () => {
    expect(capDo(0)).toMatchObject({ cap: 1, tuXp: 0, denXp: 100, tienDo: 0 });
    expect(capDo(99).cap).toBe(1);
    expect(capDo(100)).toMatchObject({ cap: 2, tuXp: 100, denXp: 250, tienDo: 0 });
    expect(capDo(175).tienDo).toBe(0.5);
    expect(capDo(1_000_000)).toMatchObject({ cap: 10, denXp: null, tienDo: 1 });
  });
});

describe("huy hiệu", () => {
  const luat: LuatHuyHieu[] = [
    { code: "buoc-dau", rule: { chi_so: "so_phien", nguong: 1 } },
    { code: "chuoi-7", rule: { chi_so: "chuoi_tot_nhat", nguong: 7 } },
    { code: "la", rule: { chi_so: "khong_co" as never, nguong: 0 } },
  ];
  test("đạt theo ngưỡng; luật có chỉ số lạ bị bỏ qua", () => {
    const tk = { so_phien: 1, chuoi_tot_nhat: 6, so_cau_dung: 0, so_thu_thach: 0, so_bai_thi_dat: 0 };
    expect(huyHieuDat(luat, tk)).toEqual(["buoc-dau"]);
    expect(huyHieuDat(luat, { ...tk, chuoi_tot_nhat: 7 })).toEqual(["buoc-dau", "chuoi-7"]);
  });
});

describe("thử thách hằng ngày", () => {
  const ids = Array.from({ length: 40 }, (_, i) => `cau-${String(i).padStart(2, "0")}`);
  test("cùng ngày cho cùng 5 câu, không phụ thuộc thứ tự đầu vào; ngày khác cho bộ khác", () => {
    const homNay = chonCauThuThach(ids, "2026-09-24");
    expect(homNay).toHaveLength(5);
    expect(new Set(homNay).size).toBe(5);
    expect(chonCauThuThach([...ids].reverse(), "2026-09-24")).toEqual(homNay);
    expect(chonCauThuThach(ids, "2026-09-25")).not.toEqual(homNay);
  });
  test("ngân hàng ít hơn 5 câu thì lấy hết số đang có", () => {
    expect(chonCauThuThach(["a", "b", "c"], "2026-09-24")).toHaveLength(3);
  });
});
