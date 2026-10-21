/**
 * Bộ dựng hình xe từ tham số (GĐ-T14; T19 dùng lại): tất định, nét không gắn tên bộ phận và không lộ phần
 * thêm vào qua thứ tự, mỗi biến đổi có vùng đáp án ở góc nhìn thấy được, thông số giấy là của xe gốc.
 */
import { describe, expect, test } from "bun:test";
import {
  type BienDoi,
  dungHinhXe,
  type KIEU_BIEN_DOI,
  kiemTraThongSoKyThuat,
  type ThamSoXe,
  TY_LE_MM,
  thongSoTuXe,
} from "../src/index.ts";

const CON: ThamSoXe = {
  loai: "o_to_con",
  dai_mm: 4400,
  rong_mm: 1730,
  cao_mm: 1480,
  thung: null,
  lop: { co: "185/60R15", duong_kinh_mm: 603 },
  so_cho: 5,
  mau: "trang",
};
const KHACH: ThamSoXe = {
  ...CON,
  loai: "xe_khach_16",
  dai_mm: 5990,
  rong_mm: 1990,
  cao_mm: 2500,
  so_cho: 16,
};
const TAI: ThamSoXe = {
  loai: "xe_tai_thung",
  dai_mm: 6450,
  rong_mm: 2000,
  cao_mm: 2900,
  thung: { dai_mm: 4400, rong_mm: 1900, cao_mm: 1900 },
  lop: { co: "7.00R16", duong_kinh_mm: 775 },
  so_cho: 3,
  mau: "xanh",
};

const BIEN_DOI: Record<(typeof KIEU_BIEN_DOI)[number], [ThamSoXe, BienDoi]> = {
  doi_mau_son: [CON, { kieu: "doi_mau_son", tham_so: { mau: "do" } }],
  den_noc: [CON, { kieu: "den_noc", tham_so: {} }],
  ong_xa_do: [CON, { kieu: "ong_xa_do", tham_so: {} }],
  lop_khac_co: [CON, { kieu: "lop_khac_co", tham_so: { duong_kinh_mm: 720 } }],
  thung_cao_them: [TAI, { kieu: "thung_cao_them", tham_so: { them_mm: 600 } }],
  thung_dai_them: [TAI, { kieu: "thung_dai_them", tham_so: { them_mm: 400 } }],
  them_ghe: [KHACH, { kieu: "them_ghe", tham_so: {} }],
};

describe("bộ dựng hình xe", () => {
  test("cùng tham số cùng nét; nét chỉ có đường vẽ và kiểu tô", () => {
    for (const [x, b] of Object.values(BIEN_DOI)) {
      const a = dungHinhXe(x, [b]);
      expect(JSON.stringify(dungHinhXe(x, [b]))).toBe(JSON.stringify(a));
      for (const g of ["nghieng", "sau"] as const)
        for (const n of a.hinh[g].net) expect(Object.keys(n).sort()).toEqual(["d", "kieu"]);
    }
  });

  test("mỗi biến đổi có vùng đáp án nằm trong hình; thùng dài thêm chỉ thấy ở hình nghiêng", () => {
    for (const [k, [x, b]] of Object.entries(BIEN_DOI)) {
      const h = dungHinhXe(x, [b]);
      const vung = h.vung[0]!;
      expect(vung.length).toBeGreaterThan(0);
      for (const v of vung) {
        const hg = h.hinh[v.goc];
        expect(v.hop[0]).toBeGreaterThanOrEqual(0);
        expect(v.hop[2]).toBeLessThanOrEqual(hg.rong);
        expect(v.hop[3]).toBeLessThanOrEqual(hg.cao);
        expect(v.hop[2]).toBeGreaterThan(v.hop[0]);
      }
      if (k === "thung_dai_them") expect(vung.every((v) => v.goc === "nghieng")).toBe(true);
    }
  });

  test("nét sắp theo lớp rồi theo chuỗi: xe có đèn nóc không lộ nét thêm ở cuối danh sách", () => {
    const h = dungHinhXe(CON, [BIEN_DOI.den_noc[1]]).hinh.nghieng.net;
    const lop = ["son", "hang", "kinh", "toi", "ghe", "sang", "do"];
    for (let i = 1; i < h.length; i++) {
      const a = lop.indexOf(h[i - 1]!.kieu);
      const b = lop.indexOf(h[i]!.kieu);
      expect(a < b || (a === b && h[i - 1]!.d <= h[i]!.d)).toBe(true);
    }
  });

  test("thùng cơi nới đo được bằng thước: vùng đáp án cao đúng phần cơi nới cộng lề, theo tỷ lệ mm", () => {
    const it = dungHinhXe(TAI, [{ kieu: "thung_cao_them", tham_so: { them_mm: 150 } }]);
    const [v] = it.vung[0]!;
    expect(v!.hop[3] - v!.hop[1]).toBe(150 / TY_LE_MM + 10);
    const goc = dungHinhXe(TAI, []);
    expect(it.hinh.nghieng.cao - goc.hinh.nghieng.cao).toBe(150 / TY_LE_MM);
  });

  test("giấy ghi thông số của xe gốc; xe tải: kích thước bao suy từ thùng", () => {
    const t = thongSoTuXe(TAI);
    expect(kiemTraThongSoKyThuat(t)).toEqual([]);
    expect(t.kich_thuoc_bao).toEqual({ dai_mm: 6450, rong_mm: 2000, cao_mm: 2900 });
    expect(t.kich_thuoc_thung).toEqual({ dai_mm: 4400, rong_mm: 1900, cao_mm: 1900 });
    expect(thongSoTuXe(CON).mau_son).toBe("Trắng");
    expect(kiemTraThongSoKyThuat({ ...t, so_cho: 0 }).length).toBeGreaterThan(0);
  });
});
