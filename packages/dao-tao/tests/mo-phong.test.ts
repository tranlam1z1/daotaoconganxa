/**
 * Bộ mô phỏng giao thông (mô-đun M5, docs/PLAN.md GĐ-T3): làn gấp khúc theo 8 hướng, tất định,
 * xe phản ứng theo biển, phanh gấp khi gặp nguy hiểm không được báo trước, xe không chồng lên nhau,
 * và mã logic không gọi hàm lượng giác, số ngẫu nhiên hay đồng hồ.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buocMoPhong,
  type CauHinhMoPhong,
  chayDenHet,
  chongNhau,
  DUNG_SAI_TOC_DO,
  dungLan,
  dungMoPhong,
  hopBao,
  KICH_THUOC_XE,
  lanThangDiLen,
  NHIP_TOI_DA,
  O_CM,
  TANG_TOC,
  TOC_DO_AN_TOAN,
  TOC_DO_QUA_KHUC,
  TOC_DO_THUONG,
  trangThaiDau,
  viTriTrenLan,
} from "../src/mo-phong/index.ts";
import { bamTrangThai } from "../src/tro-choi/chung/nhat-ky.ts";

/** Đường 10 ô, trường học ở ô 6, cột biển ở ô 4; 4 xe cách nhau 2,5 giây. */
function cauHinh(phanUng: "giam_toc" | "dung_lai" | "khong_vao" | "di_tiep" | null): CauHinhMoPhong {
  return {
    lan: [lanThangDiLen("L", 10, TOC_DO_THUONG)],
    dac_diem: [{ id: "truong", loai: "truong_hoc", lan: "L", s_tu: 6 * O_CM, s_den: 7 * O_CM }],
    bien: phanUng === null ? [] : [{ id: "cot", ma: "X.1", lan: "L", s: 4 * O_CM + 500, phan_ung: phanUng }],
    xe: ["o_to", "xe_tai", "o_to", "xe_may"].map((loai, i) => ({
      id: `xe-${i + 1}`,
      loai: loai as "o_to",
      lan: "L",
      nhip_vao: i * 50,
    })),
  };
}

const loaiSuKien = (ch: CauHinhMoPhong) => chayDenHet(dungMoPhong(ch)).su_kien.map((s) => s.loai);

describe("làn", () => {
  test("đoạn dọc, ngang, chéo 45°; độ dài chéo làm tròn", () => {
    const l = dungLan({
      id: "a",
      diem: [
        { x: 0, y: 1000 },
        { x: 0, y: 0 },
        { x: 300, y: -300 },
      ],
      toc_do_toi_da: 700,
    });
    expect(l.doan.map((d) => d.huong)).toEqual([0, 1]);
    expect(l.doan[1]!.dai).toBe(424);
    expect(l.dai).toBe(1424);
    expect(viTriTrenLan(l, 500)).toEqual({ x: 0, y: 500, huong: 0 });
    expect(viTriTrenLan(l, 1000 + 212)).toEqual({ x: 150, y: -150, huong: 1 });
    // Ngoài làn thì kẹp về hai đầu.
    expect(viTriTrenLan(l, -50)).toEqual({ x: 0, y: 1000, huong: 0 });
    expect(viTriTrenLan(l, 99_999)).toEqual({ x: 300, y: -300, huong: 1 });
  });

  test("từ chối đoạn không theo 8 hướng và tọa độ không nguyên", () => {
    expect(() =>
      dungLan({
        id: "a",
        diem: [
          { x: 0, y: 0 },
          { x: 100, y: 30 },
        ],
        toc_do_toi_da: 1,
      }),
    ).toThrow();
    expect(() =>
      dungLan({
        id: "a",
        diem: [
          { x: 0, y: 0 },
          { x: 0.5, y: 10 },
        ],
        toc_do_toi_da: 1,
      }),
    ).toThrow();
    expect(() => dungLan({ id: "a", diem: [{ x: 0, y: 0 }], toc_do_toi_da: 1 })).toThrow();
  });

  test("cấu hình trỏ tới làn không có là lỗi lập trình", () => {
    expect(() =>
      dungMoPhong({ ...cauHinh(null), xe: [{ id: "x", loai: "o_to", lan: "khong-co", nhip_vao: 0 }] }),
    ).toThrow();
  });
});

describe("tất định", () => {
  test("cùng cấu hình chạy hai lần ra cùng băm trạng thái cuối", () => {
    for (const pu of [null, "giam_toc", "dung_lai", "khong_vao"] as const) {
      const a = chayDenHet(dungMoPhong(cauHinh(pu)));
      const b = chayDenHet(dungMoPhong(structuredClone(cauHinh(pu))));
      expect(bamTrangThai(a)).toBe(bamTrangThai(b));
      expect(a.xong).toBe(true);
    }
  });

  test("thứ tự khai xe và biển không đổi kết quả", () => {
    const ch = cauHinh("giam_toc");
    const dao: CauHinhMoPhong = { ...ch, xe: [...ch.xe].reverse() };
    expect(bamTrangThai(chayDenHet(dungMoPhong(dao)))).toBe(bamTrangThai(chayDenHet(dungMoPhong(ch))));
  });

  test("không sửa trạng thái cũ", () => {
    const mp = dungMoPhong(cauHinh(null));
    const t0 = trangThaiDau(mp);
    const truoc = bamTrangThai(t0);
    buocMoPhong(mp, buocMoPhong(mp, t0));
    expect(bamTrangThai(t0)).toBe(truoc);
  });

  test("chạy hết một lượt dưới 200 ms và không quá 5 phút mô phỏng", () => {
    const t = performance.now();
    const tt = chayDenHet(dungMoPhong(cauHinh("dung_lai")));
    expect(performance.now() - t).toBeLessThan(200);
    expect(tt.nhip).toBeLessThanOrEqual(NHIP_TOI_DA);
  });
});

describe("phản ứng với biển và đặc điểm", () => {
  test("không có biển: phanh gấp trước trường học", () => {
    expect(loaiSuKien(cauHinh(null))).toContain("phanh_gap");
  });

  test("biển giảm tốc: qua trường học an toàn, không phanh gấp", () => {
    const tt = chayDenHet(dungMoPhong(cauHinh("giam_toc")));
    expect(tt.su_kien.some((s) => s.loai === "phanh_gap" || s.loai === "nguy_hiem")).toBe(false);
    const qua = tt.su_kien.filter((s) => s.loai === "qua_an_toan");
    expect(qua).toHaveLength(4);
    for (const s of qua) expect(s.v).toBeLessThanOrEqual(TOC_DO_AN_TOAN.truong_hoc! + DUNG_SAI_TOC_DO);
    expect(tt.xe.every((x) => x.trang_thai === "da_qua")).toBe(true);
  });

  test("biển đi tiếp: xe không đổi cách chạy so với không có biển", () => {
    expect(loaiSuKien(cauHinh("di_tiep"))).toEqual(loaiSuKien(cauHinh(null)));
  });

  test("biển dừng lại: xe dừng tại biển rồi đi tiếp", () => {
    const tt = chayDenHet(dungMoPhong(cauHinh("dung_lai")));
    expect(tt.su_kien.filter((s) => s.loai === "dung_theo_bien")).toHaveLength(4);
    expect(tt.su_kien.some((s) => s.loai === "phanh_gap")).toBe(false);
    expect(tt.xe.every((x) => x.trang_thai === "da_qua")).toBe(true);
  });

  test("biển không vào: xe đầu bị chặn, xe sau không qua được, mô phỏng tự kết thúc", () => {
    const tt = chayDenHet(dungMoPhong(cauHinh("khong_vao")));
    expect(tt.su_kien.filter((s) => s.loai === "bi_chan")).toHaveLength(1);
    expect(tt.xe.find((x) => x.id === "xe-1")!.trang_thai).toBe("bi_chan");
    expect(tt.xe.some((x) => x.trang_thai === "da_qua")).toBe(false);
    expect(tt.xong).toBe(true);
    expect(tt.nhip).toBeLessThan(NHIP_TOI_DA);
  });

  test("xe không chồng lên nhau ở mọi nhịp", () => {
    for (const pu of [null, "giam_toc", "dung_lai", "khong_vao"] as const) {
      const mp = dungMoPhong(cauHinh(pu));
      let tt = trangThaiDau(mp);
      while (!tt.xong) {
        tt = buocMoPhong(mp, tt);
        const tren = tt.xe
          .filter((x) => x.trang_thai !== "cho" && x.trang_thai !== "da_qua")
          .sort((a, b) => b.s - a.s);
        for (let i = 1; i < tren.length; i++) {
          const duoiXeTruoc = tren[i - 1]!.s - KICH_THUOC_XE[tren[i - 1]!.loai].dai * 10;
          expect(tren[i]!.s).toBeLessThanOrEqual(duoiXeTruoc);
        }
      }
    }
  });
});

describe("mã logic tất định", () => {
  test("không gọi Math.sin, Math.cos, Math.atan2, Math.random, Date.now", () => {
    const goc = join(import.meta.dir, "..", "src");
    const tep = [
      ...readdirSync(join(goc, "mo-phong")).map((f) => join(goc, "mo-phong", f)),
      join(goc, "tro-choi", "chung", "nhat-ky.ts"),
      join(goc, "tro-choi", "cam-bien.ts"),
    ];
    for (const f of tep) {
      // Bỏ chú thích: chú thích được nhắc tên các hàm cấm.
      const ma = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect({
        f,
        cam: ma.match(/Math\.(sin|cos|tan|atan2?|random|hypot)\s*\(|Date\.now\s*\(|new Date\s*\(/g),
      }).toEqual({ f, cam: null });
    }
  });
});

describe("rẽ theo lộ trình", () => {
  // Làn A đi lên tới gốc tọa độ, làn B từ gốc sang phải: rẽ phải 90°.
  const A = {
    id: "A",
    diem: [
      { x: 0, y: 6000 },
      { x: 0, y: 0 },
    ],
    toc_do_toi_da: TOC_DO_THUONG,
  };
  const B = {
    id: "B",
    diem: [
      { x: 0, y: 0 },
      { x: 6000, y: 0 },
    ],
    toc_do_toi_da: TOC_DO_THUONG,
  };
  const re = (loTrinh: string[]): CauHinhMoPhong => ({
    lan: [A, B],
    dac_diem: [],
    bien: [],
    xe: [{ id: "xe-1", loai: "o_to", lan: "A", nhip_vao: 0, lo_trinh: loTrinh }],
  });

  test("hết làn thì sang làn kế tiếp, đổi hướng, phát sự kiện rẽ một lần, rồi ra khỏi đường", () => {
    const tt = chayDenHet(dungMoPhong(re(["B"])));
    expect(tt.su_kien.filter((s) => s.loai === "re")).toHaveLength(1);
    const x = tt.xe[0]!;
    expect(x).toMatchObject({ lan: "B", trang_thai: "da_qua", huong: 2, lo_trinh: [] });
    expect(tt.su_kien.at(-1)!.loai).toBe("ra_khoi_duong");
  });

  test("giảm tốc trước chỗ rẽ 90°, không tính là phanh gấp", () => {
    const mp = dungMoPhong(re(["B"]));
    let tt = trangThaiDau(mp);
    let vLucRe = -1;
    while (!tt.xong) {
      tt = buocMoPhong(mp, tt);
      const r = tt.su_kien.find((s) => s.loai === "re" && s.nhip === tt.nhip);
      if (r) vLucRe = r.v;
    }
    expect(vLucRe).toBeGreaterThan(0);
    expect(vLucRe).toBeLessThanOrEqual(TOC_DO_QUA_KHUC[2] + TANG_TOC);
    expect(tt.su_kien.some((s) => s.loai === "phanh_gap")).toBe(false);
  });

  test("đi thẳng qua khúc ngoặt trong một làn cũng giảm tốc theo độ gắt", () => {
    // Đi lên rồi ngoặt chéo 45°.
    const L = {
      id: "L",
      diem: [
        { x: 0, y: 8000 },
        { x: 0, y: 3000 },
        { x: 3000, y: 0 },
      ],
      toc_do_toi_da: TOC_DO_THUONG,
    };
    const mp = dungMoPhong({
      lan: [L],
      dac_diem: [],
      bien: [],
      xe: [{ id: "x", loai: "o_to", lan: "L", nhip_vao: 0 }],
    });
    let tt = trangThaiDau(mp);
    let vQua = -1;
    while (!tt.xong) {
      const truoc = tt.xe[0]!;
      tt = buocMoPhong(mp, tt);
      const sau = tt.xe[0]!;
      if (truoc.huong === 0 && sau.huong === 1) vQua = sau.v;
    }
    expect(vQua).toBeGreaterThan(0);
    expect(vQua).toBeLessThanOrEqual(TOC_DO_QUA_KHUC[1] + TANG_TOC);
    expect(vQua).toBeGreaterThan(TOC_DO_QUA_KHUC[2]);
  });

  test("lộ trình qua làn không nối liền là lỗi cấu hình", () => {
    const C = {
      id: "C",
      diem: [
        { x: 100, y: 0 },
        { x: 6000, y: 0 },
      ],
      toc_do_toi_da: TOC_DO_THUONG,
    };
    expect(() => dungMoPhong({ ...re(["C"]), lan: [A, B, C] })).toThrow("không nối");
    expect(() => dungMoPhong(re(["khong-co"]))).toThrow("làn không có");
  });

  test("tất định khi có rẽ", () => {
    const a = chayDenHet(dungMoPhong(re(["B"])));
    const b = chayDenHet(dungMoPhong(re(["B"])));
    expect(bamTrangThai(a)).toBe(bamTrangThai(b));
  });
});

describe("va chạm", () => {
  // Hai làn cắt nhau ở gốc tọa độ: N đi lên, E sang phải; cùng quãng đường tới chỗ cắt.
  const N = {
    id: "N",
    diem: [
      { x: 0, y: 6000 },
      { x: 0, y: -6000 },
    ],
    toc_do_toi_da: TOC_DO_THUONG,
  };
  const E = {
    id: "E",
    diem: [
      { x: -6000, y: 0 },
      { x: 6000, y: 0 },
    ],
    toc_do_toi_da: TOC_DO_THUONG,
  };
  const giaoNhau = (treE: number, xeSau = false): CauHinhMoPhong => ({
    lan: [N, E],
    dac_diem: [],
    bien: [],
    xe: [
      { id: "a", loai: "o_to", lan: "N", nhip_vao: 0 },
      { id: "b", loai: "o_to", lan: "E", nhip_vao: treE },
      ...(xeSau ? [{ id: "c", loai: "o_to" as const, lan: "N", nhip_vao: 30 }] : []),
    ],
  });

  test("hộp bao: xe đi lên kéo dài xuống dưới đầu xe; xe đi chéo có hộp bao vuông", () => {
    expect(hopBao({ x: 0, y: 0, huong: 0, loai: "o_to" })).toEqual({ x1: -90, x2: 90, y1: 0, y2: 450 });
    expect(hopBao({ x: 0, y: 0, huong: 2, loai: "o_to" })).toEqual({ x1: -450, x2: 0, y1: -90, y2: 90 });
    const c = hopBao({ x: 0, y: 0, huong: 1, loai: "o_to" });
    expect(c.x2 - c.x1).toBe(c.y2 - c.y1);
    expect(chongNhau({ x1: 0, y1: 0, x2: 10, y2: 10 }, { x1: 10, y1: 0, x2: 20, y2: 10 })).toBe(false);
    expect(chongNhau({ x1: 0, y1: 0, x2: 10, y2: 10 }, { x1: 9, y1: 9, x2: 20, y2: 20 })).toBe(true);
  });

  test("hai xe tới chỗ cắt cùng lúc: một sự kiện va chạm, cả hai dừng tại chỗ, mô phỏng kết thúc", () => {
    const tt = chayDenHet(dungMoPhong(giaoNhau(0)));
    const vc = tt.su_kien.filter((s) => s.loai === "va_cham");
    expect(vc).toHaveLength(1);
    expect(vc[0]).toMatchObject({ xe: "a", xe_khac: "b" });
    expect(tt.xe.map((x) => x.trang_thai)).toEqual(["va_cham", "va_cham"]);
    expect(tt.xe.every((x) => x.v === 0)).toBe(true);
    expect(tt.xong).toBe(true);
  });

  test("tới chỗ cắt lệch giờ thì không va chạm", () => {
    const tt = chayDenHet(dungMoPhong(giaoNhau(200)));
    expect(tt.su_kien.some((s) => s.loai === "va_cham")).toBe(false);
    expect(tt.xe.every((x) => x.trang_thai === "da_qua")).toBe(true);
  });

  test("xe sau cùng làn dừng lại sau xe đã va chạm, không đâm tiếp", () => {
    const tt = chayDenHet(dungMoPhong(giaoNhau(0, true)));
    expect(tt.su_kien.filter((s) => s.loai === "va_cham")).toHaveLength(1);
    const c = tt.xe.find((x) => x.id === "c")!;
    expect(c.trang_thai).not.toBe("va_cham");
    expect(c.v).toBe(0);
  });

  test("tất định khi có va chạm", () => {
    expect(bamTrangThai(chayDenHet(dungMoPhong(giaoNhau(0, true))))).toBe(
      bamTrangThai(chayDenHet(dungMoPhong(giaoNhau(0, true)))),
    );
  });
});
