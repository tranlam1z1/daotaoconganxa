/**
 * Trò "Soi camera" (docs/PLAN.md GĐ-T5) và phần mở rộng M5: đèn tín hiệu, làn dành cho loại xe, dừng
 * theo kịch bản, mũ bảo hiểm, phép chiếu camera; chấm dừng hình, khoanh vùng, thẻ lỗi; nhật ký; tệp
 * kịch bản mẫu.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { taoRng } from "../src/de-thi.ts";
import {
  type CauHinhMoPhong,
  chayDenHet,
  dungMoPhong,
  type Hop,
  hopXe,
  KICH_THUOC_XE,
  lanThangDiLen,
  mauDen,
  tyLePhu,
} from "../src/mo-phong/index.ts";
import { bamTrangThai, NHIP_MS } from "../src/tro-choi/chung/nhat-ky.ts";
import { chamBuocCoGio } from "../src/tro-choi/khung.ts";
import {
  CAMERA,
  type ChiTietSoiCamera,
  chamKhoanh,
  chayKichBan,
  type DapAnKichBan,
  DIEM_MOI_VI_PHAM,
  dungLaiKhoanh,
  hopCacXe,
  type Khoanh,
  kiemTraKichBan,
  kieuXeCamera,
  LOAI_VI_PHAM,
  type NguonSoiCamera,
  NHIP_SAU_VI_PHAM,
  type PayloadKichBan,
  phatHienViPham,
  TRO_CHOI_SOI_CAMERA as SC,
  SO_LAN_TUA,
  THONG_TIN_KIEU_XE,
  TRU_KHOANH_NHAM,
  type TraLoiSoiCamera,
  tocDoTuKmH,
} from "../src/tro-choi/soi-camera.ts";

const GOC = join(import.meta.dir, "..", "..", "..");
const tep = (await Bun.file(join(GOC, "data", "tro-choi", "soi-camera.json")).json()) as {
  doan: Array<{ ma: string; tieu_de: string; payload: PayloadKichBan; answer: DapAnKichBan }>;
};
const doan = (ma: string) => tep.doan.find((d) => d.ma === ma)!;

/* ------------------------------------------------------------------ */
/* M5 mở rộng                                                          */
/* ------------------------------------------------------------------ */

describe("M5: đèn tín hiệu, làn, dừng theo kịch bản", () => {
  const coBan = (xe: CauHinhMoPhong["xe"], them: Partial<CauHinhMoPhong> = {}): CauHinhMoPhong => ({
    lan: [{ ...lanThangDiLen("L", 8, tocDoTuKmH(60)), danh_cho: ["o_to"] }],
    dac_diem: [],
    bien: [],
    xe,
    den: [{ id: "d", xanh: 0, vang: 0, do: 10_000, lech: 0, vach: [{ lan: "L", s: 4000 }] }],
    chay_du_nhip: true,
    ...them,
  });
  const loai = (ch: CauHinhMoPhong, n = 400) =>
    chayDenHet(dungMoPhong(ch), n).su_kien.map((s) => `${s.xe}:${s.loai}`);

  test("chu kỳ đèn xanh → vàng → đỏ, có lệch pha", () => {
    const d = { xanh: 10, vang: 2, do: 8, lech: 0 };
    expect([0, 9, 10, 11, 12, 19, 20].map((n) => mauDen(d, n))).toEqual([
      "xanh",
      "xanh",
      "vang",
      "vang",
      "do",
      "do",
      "xanh",
    ]);
    expect(mauDen({ ...d, lech: 12 }, 0)).toBe("do");
  });

  test("đèn đỏ: xe dừng trước vạch, không vượt; xe bỏ qua đèn thì vượt đèn đỏ", () => {
    const tt = chayDenHet(dungMoPhong(coBan([{ id: "a", loai: "o_to", lan: "L", nhip_vao: 0 }])), 400);
    expect(tt.xe[0]!.s).toBeLessThanOrEqual(40_000);
    expect(tt.xe[0]!.den_da_qua).toEqual([]);
    expect(loai(coBan([{ id: "a", loai: "o_to", lan: "L", nhip_vao: 0, bo_qua_den: true }]))).toContain(
      "a:vuot_den_do",
    );
  });

  test("đèn vàng mà không kịp dừng thì qua vạch, không phải vượt đèn đỏ", () => {
    // Vàng từ nhịp 60 tới 100; xe 60 km/h tới vạch (40 m) chừng nhịp 48 + vài nhịp.
    const ch = coBan([{ id: "a", loai: "o_to", lan: "L", nhip_vao: 0 }], {
      den: [{ id: "d", xanh: 60, vang: 40, do: 1000, lech: 0, vach: [{ lan: "L", s: 4600 }] }],
    });
    const tt = chayDenHet(dungMoPhong(ch), 200);
    expect(tt.xe[0]!.den_da_qua).toEqual(["d"]);
    expect(tt.su_kien.some((s) => s.loai === "vuot_den_do")).toBe(false);
  });

  test("xe khác loại vào làn: sai làn; xe máy không mũ: không mũ bảo hiểm", () => {
    expect(loai(coBan([{ id: "m", loai: "xe_may", lan: "L", nhip_vao: 0, mu_bao_hiem: false }]))).toEqual(
      expect.arrayContaining(["m:sai_lan", "m:khong_mu_bao_hiem"]),
    );
    expect(loai(coBan([{ id: "a", loai: "o_to", lan: "L", nhip_vao: 0 }]))).toEqual([]);
  });

  test("dừng theo kịch bản: trong vùng cấm là dừng sai, ngoài vùng không phải; hết giờ thì đi tiếp", () => {
    const xe = [{ id: "a", loai: "o_to" as const, lan: "L", nhip_vao: 0, dung: { s: 2000, so_nhip: 20 } }];
    const trong = coBan(xe, { vung_cam_dung: [{ id: "z", lan: "L", s_tu: 1500, s_den: 2500 }] });
    expect(loai(trong)).toEqual(["a:dung_do_sai", "a:tiep_tuc"]);
    expect(loai(coBan(xe, { vung_cam_dung: [{ id: "z", lan: "L", s_tu: 3000, s_den: 3500 }] }))).toEqual([
      "a:dung_xe",
      "a:tiep_tuc",
    ]);
  });

  test("chay_du_nhip: xe chờ đèn đỏ lâu không làm mô phỏng tự kết thúc", () => {
    const tt = chayDenHet(dungMoPhong(coBan([{ id: "a", loai: "o_to", lan: "L", nhip_vao: 0 }])), 500);
    expect(tt.nhip).toBe(500);
  });
});

describe("camera", () => {
  test("hộp xe đi lên dài theo trục dọc, phủ đầy đủ khi khoanh trùm", () => {
    const h = hopXe(CAMERA, { x: 175, y: 3000, huong: 0, loai: "o_to" });
    expect(h[2] - h[0]).toBeGreaterThan(0);
    expect(h[3] - h[1]).toBe(90);
    expect(tyLePhu([0, 0, 1000, 1280], h)).toBe(1);
    expect(tyLePhu([0, 0, 1, 1], h)).toBe(0);
  });

  test("kích thước riêng thay kích thước theo loại xe", () => {
    const h = hopXe(CAMERA, {
      x: 175,
      y: 3000,
      huong: 0,
      loai: "xe_tai",
      kich_thuoc: { dai: 1050, rong: 250 },
    });
    expect(h[3] - h[1]).toBe(210);
  });
});

describe("kiểu xe", () => {
  const p = doan("SC-02").payload;

  test("kiểu mặc định theo loại; xe máy, xe ưu tiên không có kiểu", () => {
    expect(kieuXeCamera({ loai: "o_to" })).toBe("o_to_con");
    expect(kieuXeCamera({ loai: "xe_tai" })).toBe("xe_tai");
    expect(kieuXeCamera({ loai: "o_to", kieu: "taxi" })).toBe("taxi");
    expect(kieuXeCamera({ loai: "xe_may" })).toBeNull();
    expect(kieuXeCamera({ loai: "xe_uu_tien" })).toBeNull();
    // Kiểu mặc định có đúng kích thước theo loại, nên kịch bản cũ không đổi.
    expect(THONG_TIN_KIEU_XE.o_to_con).toMatchObject(KICH_THUOC_XE.o_to);
    expect(THONG_TIN_KIEU_XE.xe_tai).toMatchObject(KICH_THUOC_XE.xe_tai);
  });

  test("không khai kiểu: trạng thái mô phỏng không có kich_thuoc; khai kiểu: hộp xe theo kích thước kiểu", () => {
    expect(chayKichBan(p)[0]!.xe.every((x) => !("kich_thuoc" in x))).toBe(true);
    const xe = p.xe.find((x) => x.loai === "o_to")!;
    const buyt: PayloadKichBan = {
      ...p,
      xe: p.xe.map((x) => (x.id === xe.id ? { ...x, loai: "xe_tai" as const, kieu: "xe_buyt" as const } : x)),
    };
    const ds = chayKichBan(buyt);
    const i = ds.findIndex((t) => hopCacXe(t).has(xe.id));
    const h = hopCacXe(ds[i]!).get(xe.id)!;
    expect(ds[i]!.xe.find((x) => x.id === xe.id)!.kich_thuoc).toEqual({ dai: 1050, rong: 250 });
    expect(h[2] - h[0]).toBeGreaterThanOrEqual(112);
  });

  test("kiểu không hợp lệ hoặc khác loại xe bị báo đúng xe", () => {
    const xe = p.xe.find((x) => x.loai === "o_to")!;
    const voi = (kieu: string) =>
      kiemTraKichBan(
        { ...p, xe: p.xe.map((x) => (x.id === xe.id ? { ...x, kieu: kieu as never } : x)) },
        doan("SC-02").answer,
      );
    expect(voi("xe_buyt").map((l) => l.phan_tu)).toEqual([`xe:${xe.id}`]);
    expect(voi("khong_co").map((l) => l.phan_tu)).toEqual([`xe:${xe.id}`]);
    expect(voi("taxi")).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* Chấm                                                                */
/* ------------------------------------------------------------------ */

/** Hộp của xe ở một nhịp, và vùng khoanh trùm đúng xe đó. */
function hopTai(p: PayloadKichBan, nhip: number, xe: string): Hop {
  return hopCacXe(chayKichBan(p)[nhip]!).get(xe)!;
}

describe("chấm khoanh vùng", () => {
  const p = doan("SC-02").payload; // x2 vượt đèn đỏ
  const ds = chayKichBan(p);
  const [vp] = phatHienViPham(p, ds);
  const viPham = [{ ...vp!, mo_ta: "", can_cu: [] }];
  const khoanh = (nhip: number, hop: Hop, loi: Khoanh["loi"] = "vuot_den_do"): Khoanh => ({
    nhip_phim: nhip,
    hop,
    loi,
  });

  test("cửa sổ vi phạm tức thời: từ lúc vượt tới 2 giây sau", () => {
    expect(vp).toMatchObject({ xe: "x2", loai: "vuot_den_do" });
    expect(vp!.ket_thuc - vp!.bat_dau).toBe(NHIP_SAU_VI_PHAM);
  });

  test("dừng hình trong cửa sổ, khoanh đúng, thẻ đúng: đủ 20 điểm", () => {
    const n = vp!.bat_dau;
    expect(chamKhoanh(ds, viPham, [khoanh(n, hopTai(p, n, "x2"))]).diem).toBe(DIEM_MOI_VI_PHAM);
    const cuoi = vp!.ket_thuc;
    expect(chamKhoanh(ds, viPham, [khoanh(cuoi, hopTai(p, cuoi, "x2"))]).vi_pham[0]!.diem_dung_luc).toBe(5);
  });

  test("dừng trước lúc vi phạm hoặc quá 2 giây sau: không có điểm dừng", () => {
    for (const n of [vp!.bat_dau - 1, vp!.ket_thuc + 1]) {
      const kq = chamKhoanh(ds, viPham, [khoanh(n, hopTai(p, n, "x2"))]).vi_pham[0]!;
      expect({ n, dung: kq.diem_dung_luc, khoanh: kq.diem_khoanh }).toEqual({ n, dung: 0, khoanh: 5 });
    }
  });

  test("phủ 49% không có điểm khoanh, 50% có", () => {
    const n = vp!.bat_dau;
    const h = hopTai(p, n, "x2");
    const rong = h[2] - h[0];
    const vung = (tyLe: number): Hop => [h[0], h[1], h[0] + tyLe * rong, h[3]];
    expect(tyLePhu(vung(0.5), h)).toBe(0.5);
    expect(chamKhoanh(ds, viPham, [khoanh(n, vung(0.5))]).vi_pham[0]!.diem_khoanh).toBe(5);
    expect(chamKhoanh(ds, viPham, [khoanh(n, vung(0.49))]).vi_pham[0]!.diem_khoanh).toBe(0);
  });

  test("thẻ lỗi sai: mất 10 điểm thẻ", () => {
    const n = vp!.bat_dau;
    expect(chamKhoanh(ds, viPham, [khoanh(n, hopTai(p, n, "x2"), "sai_lan")]).diem).toBe(10);
  });

  test("vùng trùm quá 2 xe khác bị loại, không trừ; khoanh xe không vi phạm −5; bỏ sót được liệt kê", () => {
    const p8 = doan("SC-08").payload;
    const ds8 = chayKichBan(p8);
    const vp8 = phatHienViPham(p8, ds8).map((v) => ({ ...v, mo_ta: "", can_cu: [] }));
    const x05 = vp8.find((v) => v.xe === "x05")!;
    // Tìm nhịp trong cửa sổ có ít nhất 4 xe trên camera.
    const n = Array.from({ length: x05.ket_thuc - x05.bat_dau + 1 }, (_, i) => x05.bat_dau + i).find(
      (i) => hopCacXe(ds8[i]!).size >= 4,
    )!;
    expect(n).toBeDefined();
    const ca = chamKhoanh(ds8, vp8, [khoanh(n, [0, 0, 1000, 1280])]);
    expect(ca.vi_pham.find((v) => v.xe === "x05")).toMatchObject({ diem: 0, qua_rong: true, khoanh: null });
    expect(ca.khoanh_nham).toEqual([]);
    expect(ca.diem).toBe(0);

    // Khoanh một xe không vi phạm (x02, trước khi có vi phạm).
    const khac = [...hopCacXe(ds8[120]!)].find(([id]) => !vp8.some((v) => v.xe === id))!;
    const nham = chamKhoanh(ds8, vp8, [khoanh(120, khac[1])]);
    expect(nham.khoanh_nham).toHaveLength(1);
    expect(nham.khoanh_nham[0]!.xe).toEqual([khac[0]]);
    expect(nham.diem).toBe(0);
    // Có điểm thì trừ 5 cho vùng khoanh nhầm.
    const hx = hopCacXe(ds8[x05.bat_dau]!).get("x05")!;
    const coDiem = chamKhoanh(ds8, vp8, [khoanh(120, khac[1]), khoanh(x05.bat_dau, hx)]);
    expect(coDiem.diem).toBe(DIEM_MOI_VI_PHAM - TRU_KHOANH_NHAM);
    expect(coDiem.vi_pham.find((v) => v.xe === "x07")).toMatchObject({ diem: 0, khoanh: null });
  });
});

describe("nhật ký", () => {
  const nk = (ops: Array<[string, unknown]>, tong = 600): TraLoiSoiCamera =>
    SC.docTraLoi({
      thao_tac: ops.map(([t, p], i) => ({ nhip: i, thao_tac: t, tham_so: p })),
      tong_nhip: tong,
    })!;

  test(`tua lại lần thứ ${SO_LAN_TUA + 1} bị bỏ qua; khoanh khi chưa dừng hình hoặc lệch nhịp bị bỏ qua`, () => {
    const r = dungLaiKhoanh(
      nk([
        ["tua", { nhip_phim: 10 }],
        ["tua", { nhip_phim: 10 }],
        ["tua", { nhip_phim: 10 }],
        ["tua", { nhip_phim: 10 }],
        ["khoanh", { nhip_phim: 50, hop: [0, 0, 10, 10], loi: "sai_lan" }],
        ["dung_hinh", { nhip_phim: 60 }],
        ["khoanh", { nhip_phim: 61, hop: [0, 0, 10, 10], loi: "sai_lan" }],
        ["khoanh", { nhip_phim: 60, hop: [10, 20, 0, 0], loi: "sai_lan" }],
        ["tiep_tuc", null],
      ]),
      400,
    );
    expect(r.so_lan_tua).toBe(SO_LAN_TUA);
    expect(r.bo_qua).toEqual({ tua: 1, khoanh: 2 });
    expect(r.khoanh).toEqual([{ nhip_phim: 60, hop: [0, 0, 10, 20], loi: "sai_lan" }]);
  });

  test("nhật ký sai dạng bị từ chối", () => {
    const sai = (t: string, p: unknown) =>
      SC.docTraLoi({ thao_tac: [{ nhip: 0, thao_tac: t, tham_so: p }], tong_nhip: 5 });
    expect(sai("khoanh", { nhip_phim: 1, hop: [0, 0, 1], loi: "sai_lan" })).toBeNull();
    expect(sai("khoanh", { nhip_phim: 1, hop: [0, 0, 1, 1], loi: "cho_vui" })).toBeNull();
    expect(sai("dung_hinh", { nhip_phim: -1 })).toBeNull();
    expect(sai("tiep_tuc", { nhip_phim: 1 })).toBeNull();
    expect(sai("xoa", null)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Trò trên khung chung                                                */
/* ------------------------------------------------------------------ */

const nguon = (ma: string): NguonSoiCamera => {
  const d = doan(ma);
  return {
    id: ma,
    code: ma,
    version: 1,
    topic_id: null,
    kich_ban: d.payload,
    dap_an: d.answer,
    muc_phat: {},
  };
};
const KHOA_CAM = [
  "answer",
  "dap_an",
  "giai_thich",
  "can_cu",
  "explanation",
  "vi_pham",
  "bat_dau",
  "ket_thuc",
  "ma_muc_phat",
];
function khoaCo(v: unknown, kq = new Set<string>()): Set<string> {
  if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v)) {
      kq.add(k);
      khoaCo(x, kq);
    }
  return kq;
}

describe("trò trên khung chung", () => {
  const [buoc] = SC.taoLuot([nguon("SC-03"), nguon("SC-01")], taoRng("x"), 2);

  test("lượt lấy kịch bản đúng màn; điểm tối đa 20 mỗi vi phạm; đề không lộ vi phạm", () => {
    expect(buoc!.ref_id).toBe("SC-03");
    expect(buoc!.diem_toi_da).toBe(40);
    const de = SC.deChoNguoiChoi(buoc!);
    for (const k of KHOA_CAM) expect(khoaCo(de).has(k)).toBe(false);
    expect(de.the_loi.map((t) => t.ma)).toEqual([...LOAI_VI_PHAM]);
    expect(de.toc_do_phat).toBe(1);
  });

  test("chơi đúng hai vi phạm: đủ điểm; điểm máy khách gửi bị bỏ qua; máy chủ và điện thoại cùng băm", () => {
    const ds = chayKichBan(buoc!.noi_dung.kich_ban);
    const ops: Array<Record<string, unknown>> = [];
    let i = 0;
    for (const v of buoc!.noi_dung.vi_pham) {
      const n = v.bat_dau + 5;
      ops.push({ nhip: i++, thao_tac: "dung_hinh", tham_so: { nhip_phim: n } });
      ops.push({
        nhip: i++,
        thao_tac: "khoanh",
        tham_so: { nhip_phim: n, hop: hopCacXe(ds[n]!).get(v.xe), loi: v.loai },
      });
      ops.push({ nhip: i++, thao_tac: "tiep_tuc", tham_so: null });
    }
    const tl = SC.docTraLoi({ thao_tac: ops, tong_nhip: 600, diem: 999 })!;
    const t0 = performance.now();
    const kq = chamBuocCoGio(SC, buoc!, tl, { moLuc: new Date(0), luc: new Date(40_000), offline: false });
    expect(performance.now() - t0).toBeLessThan(200);
    expect(kq.diem).toBe(40);
    expect(kq.dung).toBe(true);
    expect((kq.chiTiet as ChiTietSoiCamera).bien_ban).toHaveLength(2);
    expect(bamTrangThai(chayKichBan(SC.deChoNguoiChoi(buoc!).kich_ban).at(-1))).toBe(bamTrangThai(ds.at(-1)));
  });

  test("gian lận thời gian: nhật ký dài hơn đồng hồ máy chủ thì 0 điểm", () => {
    const tl = SC.docTraLoi({ thao_tac: [], tong_nhip: 2000 })!;
    const kq = chamBuocCoGio(SC, buoc!, tl, { moLuc: new Date(0), luc: new Date(10_000), offline: false });
    expect(kq.diem).toBe(0);
    expect((kq.chiTiet as ChiTietSoiCamera).ly_do).toBe("Nhật ký không khớp đồng hồ máy chủ.");
    expect((kq.chiTiet as ChiTietSoiCamera).vi_pham.every((v) => v.khoanh === null)).toBe(true);
  });

  test("kịch bản không khớp mô phỏng bị loại khỏi nguồn", () => {
    const hong = { ...nguon("SC-01"), dap_an: { vi_pham: [] } };
    expect(SC.locNguon([hong])).toEqual([]);
  });
});

describe("kiểm kịch bản", () => {
  const d = doan("SC-02");
  const phanTu = (p: Partial<PayloadKichBan>, a: DapAnKichBan = d.answer) =>
    kiemTraKichBan({ ...d.payload, ...p }, a).map((l) => l.phan_tu);

  test("lỗi chỉ đúng xe hoặc vi phạm", () => {
    expect(
      phanTu({ xe: d.payload.xe.map((x) => (x.id === "x1" ? { ...x, lan: "khong-co" as never } : x)) }),
    ).toEqual(["xe:x1"]);
    expect(
      phanTu(
        {},
        { vi_pham: [...d.answer.vi_pham, { xe: "x1", loai: "sai_lan", ma_muc_phat: null, mo_ta: "x" }] },
      ),
    ).toContain("vi_pham:1");
    // Bỏ hành vi không dừng đèn: đáp án khai vi phạm mà mô phỏng không thấy.
    expect(phanTu({ xe: d.payload.xe.map((x) => ({ ...x, khong_dung_den: false })) })).toEqual([
      "vi_pham:0",
      "doan",
    ]);
  });

  test("số xe cùng lúc và số vi phạm theo màn", () => {
    const nhieu = doan("SC-08").payload;
    expect(
      kiemTraKichBan({ ...nhieu, muc: 1 }, doan("SC-08").answer)
        .map((l) => l.loi)
        .join(" "),
    ).toContain("tối đa 4 xe");
  });
});

describe("data/tro-choi/soi-camera.json", () => {
  test("8 đoạn, mọi đoạn khớp mô phỏng, đánh dấu demo, đủ 5 màn và 4 hành vi", () => {
    expect(tep.doan).toHaveLength(8);
    for (const x of tep.doan) {
      expect({ ma: x.ma, loi: kiemTraKichBan(x.payload, x.answer) }).toEqual({ ma: x.ma, loi: [] });
      expect(x.tieu_de.startsWith("[Demo]")).toBe(true);
    }
    expect(new Set(tep.doan.map((x) => x.payload.muc))).toEqual(new Set([1, 2, 3, 4, 5]));
    expect(new Set(tep.doan.flatMap((x) => x.answer.vi_pham.map((v) => v.loai)))).toEqual(
      new Set(LOAI_VI_PHAM),
    );
    expect(tep.doan.filter((x) => x.payload.ban_dem).map((x) => x.payload.muc)).toEqual([5]);
    expect(NHIP_MS).toBe(50);
  });
});
