/**
 * Mô-đun M9 (bản đồ khu phố dạng ô, docs/GAME_DESIGN.md §4.1; tạo ở GĐ-T17): kiểm bản đồ, giao lộ, luật
 * đặt vật, đường đi ngắn nhất tất định, không dùng hàm lượng giác hay số ngẫu nhiên trong logic.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type BanDoO,
  dungLuoi,
  duongNganNhat,
  huongGiua,
  keDuong,
  khoangCachTu,
  kiemTraBanDo,
  kiemTraDatVat,
  laGiaoLo,
  loaiTai,
  oMep,
  soBuocNganNhat,
} from "../src/ban-do/index.ts";

// 0123456
const BD: BanDoO = {
  rong: 7,
  cao: 5,
  o_m: 50,
  o: [
    "#=###=#", // 0
    "=======", // 1
    "#=#T#=#", // 2
    "#=====C", // 3
    "#=#*#.#", // 4
  ],
};

describe("M9: bản đồ", () => {
  test("bản đồ hợp lệ; ký hiệu lạ, sai số dòng, cạnh ô ngoài khoảng bị báo đúng chỗ", () => {
    expect(kiemTraBanDo(BD)).toEqual([]);
    expect(kiemTraBanDo({ ...BD, o: [...BD.o.slice(0, 4), "#=#?#.#"] })).toEqual([
      'Dòng 5, cột 4: ký hiệu "?" lạ.',
    ]);
    expect(kiemTraBanDo({ ...BD, o: BD.o.slice(0, 4) })[0]).toContain("5 dòng");
    expect(kiemTraBanDo({ ...BD, o_m: 5 })[0]).toContain("Cạnh một ô");
    expect(kiemTraBanDo({ ...BD, o: BD.o.map((d) => d.replaceAll("=", "#")) })).toEqual([
      "Bản đồ chưa có ô đường nào.",
    ]);
    expect(() => dungLuoi({ ...BD, rong: 2 })).toThrow();
  });

  test("loại ô, giao lộ, ô mép, ô kề", () => {
    const l = dungLuoi(BD);
    expect(loaiTai(l, { x: 3, y: 2 })).toBe("truong_hoc");
    expect(loaiTai(l, { x: 6, y: 3 })).toBe("cho");
    expect(loaiTai(l, { x: 9, y: 0 })).toBeNull();
    expect(laGiaoLo(l, { x: 1, y: 1 })).toBe(true);
    expect(laGiaoLo(l, { x: 1, y: 2 })).toBe(false);
    expect(laGiaoLo(l, { x: 3, y: 3 })).toBe(false);
    expect(oMep(l, { x: 0, y: 1 })).toBe(true);
    expect(keDuong(l, { x: 1, y: 1 }).map((k) => k.huong)).toEqual([0, 2, 4, 6]);
    expect(huongGiua({ x: 1, y: 1 }, { x: 2, y: 1 })).toBe(2);
    expect(huongGiua({ x: 1, y: 1 }, { x: 2, y: 2 })).toBeNull();
  });

  test("luật đặt vật: loại ô, giao lộ, chung ô, khoảng cách tối thiểu, loại lạ", () => {
    const l = dungLuoi(BD);
    const luat = {
      camera: { loai_o: ["duong"] as const, cach_toi_thieu: 2 },
      to: { loai_o: ["duong"] as const, chi_giao_lo: true },
    };
    expect(
      kiemTraDatVat(
        l,
        [
          { id: "c1", loai: "camera", x: 1, y: 1 },
          { id: "c2", loai: "camera", x: 5, y: 1 },
        ],
        luat,
      ),
    ).toEqual([]);
    const loi = kiemTraDatVat(
      l,
      [
        { id: "c1", loai: "camera", x: 1, y: 1 },
        { id: "c2", loai: "camera", x: 2, y: 1 },
        { id: "c3", loai: "camera", x: 3, y: 2 },
        { id: "t1", loai: "to", x: 1, y: 2 },
        { id: "t2", loai: "to", x: 1, y: 1 },
        { id: "x", loai: "cay", x: 0, y: 0 },
      ],
      luat,
    ).map((k) => `${k.vat}: ${k.loi}`);
    expect(loi).toContain("c2: c2 và c1 cách nhau chưa đủ 2 ô.");
    expect(loi).toContain("c3: c3 không đặt được trên ô Trường học.");
    expect(loi).toContain("t1: t1 phải đặt ở giao lộ.");
    expect(loi).toContain("t2: t2 chung ô với c1.");
    expect(loi.some((x) => x.startsWith("x: Loại vật"))).toBe(true);
  });
});

describe("M9: đường đi ngắn nhất", () => {
  test("khoảng cách theo số ô, không tới được thì -1 / null", () => {
    const l = dungLuoi(BD);
    const d = khoangCachTu(l, { x: 1, y: 0 });
    expect(d[1 * 7 + 1]).toBe(1);
    expect(soBuocNganNhat(l, { x: 1, y: 0 }, { x: 5, y: 3 })).toBe(7);
    expect(soBuocNganNhat(l, { x: 1, y: 0 }, { x: 5, y: 4 })).toBeNull();
    expect(duongNganNhat(l, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull();
  });

  test("đường đi nối các ô kề, đúng độ dài, tất định khi có nhiều đường bằng nhau", () => {
    const l = dungLuoi(BD);
    const a = duongNganNhat(l, { x: 1, y: 3 }, { x: 5, y: 1 })!;
    expect(a.length - 1).toBe(6);
    for (let i = 1; i < a.length; i++) expect(huongGiua(a[i - 1]!, a[i]!)).not.toBeNull();
    // Hai đường dài bằng nhau (qua cột 1 hoặc cột 5): luôn cùng một đường, ưu tiên bắc trước.
    expect(duongNganNhat(l, { x: 1, y: 3 }, { x: 5, y: 1 })).toEqual(a);
    expect(a[1]).toEqual({ x: 1, y: 2 });
  });

  test("mã M9 không dùng hàm lượng giác, Math.random, Date.now", () => {
    const goc = join(import.meta.dir, "..", "src", "ban-do");
    for (const f of ["luoi.ts", "duong-di.ts", "index.ts"]) {
      const ma = readFileSync(join(goc, f), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(ma).not.toMatch(/Math\.(sin|cos|tan|atan2|random)|Date\.now/);
    }
  });
});
