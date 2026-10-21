/**
 * Trò "Dựng chốt an toàn ban đêm" (docs/PLAN.md GĐ-T15): kiểm nội dung, đặt vật hợp lệ, dựng lại bố
 * trí từ nhật ký (chạy thử lần thứ 3, đặt vật ngoài phần đường, mốc thời gian sai: cả bước 0 điểm),
 * chấm từng tiêu chí ở ca biên của ngưỡng, đề không có ngưỡng, chạy thử trên điện thoại ra cùng băm với
 * máy chủ.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  apThaoTacChot,
  type BoTriChot,
  type BuocChotDem,
  type ChiTietChotDem,
  cauHinhChot,
  chamChot,
  DIEM_TOI_DA_CHOT,
  doDacRong,
  doSauNhip,
  dungLaiBoTriChot,
  type KetQuaChayChot,
  ketQuaChay,
  kiemTraDoanChot,
  kiemTraTieuChiChot,
  lyDoKhongDatDuoc,
  type NguonChotDem,
  NHIP_CHAY_CHOT,
  type PayloadDoanChot,
  type PayloadTieuChiChot,
  QUANG_GIAM_TOC_CM,
  SO_LAN_CHAY_THU_CHOT,
  sinhDongXe,
  TRO_CHOI_CHOT_DEM,
  vatTrongTui,
} from "../src/index.ts";
import { buocMoPhong, dungMoPhong, trangThaiDau } from "../src/mo-phong/index.ts";
import { bamTrangThai, LoiNhatKy } from "../src/tro-choi/chung/nhat-ky.ts";
import type { BuocLuot } from "../src/tro-choi/khung.ts";

const GOC = join(import.meta.dir, "..", "..", "..");
const DOAN = (
  (await Bun.file(join(GOC, "data", "tro-choi", "chot-dem.json")).json()) as {
    doan: Array<{ ma: string; payload: PayloadDoanChot }>;
  }
).doan;
const TIEU_CHI = (
  (await Bun.file(join(GOC, "data", "tro-choi", "tieu-chi-chot.json")).json()) as {
    tieu_chi: Array<{ payload: PayloadTieuChiChot }>;
  }
).tieu_chi.map((t) => t.payload);

const doanCua = (ma: string) => DOAN.find((d) => d.ma === ma)!.payload;
const tieuChiCua = (p: PayloadDoanChot) => TIEU_CHI.find((t) => t.ma === p.ma_tieu_chi)!;

function buoc(ma: string): BuocLuot<BuocChotDem> {
  const doan = doanCua(ma);
  return {
    thu_tu: 1,
    ref_kind: "game_content",
    ref_id: ma,
    ref_version: 1,
    topic_id: null,
    diem_toi_da: DIEM_TOI_DA_CHOT,
    noi_dung: { man: doan.muc, doan, tieu_chi: tieuChiCua(doan) },
  };
}
const deCua = (ma: string) => TRO_CHOI_CHOT_DEM.deChoNguoiChoi(buoc(ma));

/** Bố trí tốt cho CD-01 (chốt 160 m, làn phải): biển ở 60 và 110 m, 6 cọc 130–155 m, đèn đầu hàng cọc. */
const TOT_CD01: BoTriChot = {
  "bien-1": { m: 60, cot: "le_phai", huong: 0 },
  "bien-2": { m: 110, cot: "le_phai", huong: 0 },
  ...Object.fromEntries(
    Array.from({ length: 6 }, (_, i) => [
      `coc-${i + 1}`,
      { m: 130 + 5 * i, cot: "lan_2" as const, huong: 0 as const },
    ]),
  ),
  "den-1": { m: 128, cot: "le_phai", huong: 0 },
  "cs-1": { m: 162, cot: "lan_2", huong: 0 },
  "cs-2": { m: 166, cot: "lan_2", huong: 0 },
};

/** Nhật ký đặt đúng bố trí, rồi chạy thử `soLan` lần; mỗi thao tác một nhịp. */
function nhatKy(bt: BoTriChot, soLan = 1, them: unknown[] = []) {
  const thao_tac: unknown[] = [];
  let nhip = 0;
  for (const [vat, p] of Object.entries(bt)) {
    thao_tac.push({ nhip: nhip++, thao_tac: "dat", tham_so: { vat, m: p.m, cot: p.cot } });
    for (let i = 0; i < p.huong; i++) thao_tac.push({ nhip: nhip++, thao_tac: "xoay", tham_so: { vat } });
  }
  for (let i = 0; i < soLan; i++) thao_tac.push({ nhip: nhip++, thao_tac: "chay_thu", tham_so: null });
  for (const t of them) thao_tac.push({ ...(t as object), nhip: nhip++ });
  return { thao_tac, tong_nhip: nhip };
}

const cham = (ma: string, raw: unknown, thoiGianMs: number | null = null) => {
  const tl = TRO_CHOI_CHOT_DEM.docTraLoi(raw);
  expect(tl).not.toBeNull();
  const kq = TRO_CHOI_CHOT_DEM.chamBuoc(buoc(ma), tl!, { thoiGianMs, offline: thoiGianMs === null });
  return { ...kq, ct: kq.chiTiet as ChiTietChotDem };
};

describe("nội dung demo", () => {
  test("10 đoạn đường, đủ 5 màn, mọi đoạn hợp lệ và trỏ tới bộ tiêu chí có trong tệp", () => {
    expect(DOAN).toHaveLength(10);
    expect(new Set(DOAN.map((d) => d.payload.muc))).toEqual(new Set([1, 2, 3, 4, 5]));
    for (const d of DOAN) {
      expect({ ma: d.ma, loi: kiemTraDoanChot(d.payload) }).toEqual({ ma: d.ma, loi: [] });
      expect(tieuChiCua(d.payload)).toBeTruthy();
    }
    for (const t of TIEU_CHI) expect({ ma: t.ma, loi: kiemTraTieuChiChot(t) }).toEqual({ ma: t.ma, loi: [] });
  });

  test("kiểm nội dung bắt lỗi: màn 3 thiếu khúc cua, màn 5 thiếu giao lộ, tỷ lệ xe sai, tiêu chí thiếu nguồn", () => {
    const p = doanCua("CD-05");
    expect(kiemTraDoanChot({ ...p, khuat: [] }).join(" ")).toContain("Màn 3 cần một đoạn cong");
    expect(kiemTraDoanChot({ ...doanCua("CD-09"), giao_lo: null }).join(" ")).toContain("Màn 5 cần giao lộ");
    expect(
      kiemTraDoanChot({
        ...p,
        luong_xe: { ...p.luong_xe, ty_le: { o_to: 50, xe_may: 0, xe_tai: 0, xe_khach: 0 } },
      }).join(" "),
    ).toContain("tổng 100");
    const t = TIEU_CHI[0]!;
    expect(kiemTraTieuChiChot({ ...t, nguon: t.nguon.slice(1) }).join(" ")).toContain("bien_dau");
    expect(kiemTraTieuChiChot({ ...t, nguong: { ...t.nguong, bien_dau_m_tu: 200 } }).length).toBeGreaterThan(
      0,
    );
  });
});

describe("đề và lượt", () => {
  test("đề có đoạn đường, túi đồ, dòng xe; không có ngưỡng, không có mã bộ tiêu chí", () => {
    const de = deCua("CD-01");
    expect(de.tui.map((v) => v.id)).toEqual([
      "bien-1",
      "bien-2",
      "coc-1",
      "coc-2",
      "coc-3",
      "coc-4",
      "coc-5",
      "coc-6",
      "den-1",
      "cs-1",
      "cs-2",
    ]);
    expect(de.so_lan_chay).toBe(SO_LAN_CHAY_THU_CHOT);
    const chuoi = JSON.stringify(de);
    for (const k of ["nguong", "tieu_chi", "ma_tieu_chi", "hang_cho_m", "bien_dau_m_tu", "nguon"])
      expect(chuoi).not.toContain(k);
  });

  test("tạo lượt theo màn, chỉ dùng đoạn có bộ tiêu chí khớp mã", () => {
    const nguon: NguonChotDem[] = DOAN.map((d, i) => ({
      id: `id-${i}`,
      code: d.ma,
      version: 1,
      topic_id: null,
      doan: d.payload,
      tieu_chi: tieuChiCua(d.payload),
    }));
    const rng = () => 0.3;
    for (const man of [1, 3, 5]) {
      const l = TRO_CHOI_CHOT_DEM.taoLuot(nguon, rng, man);
      expect(l).toHaveLength(1);
      expect(l[0]!.noi_dung.doan.muc).toBe(man);
      expect(l[0]!.diem_toi_da).toBe(100);
    }
    const lech = nguon.map((n) => ({ ...n, tieu_chi: { ...n.tieu_chi, ma: "KHAC" } }));
    expect(TRO_CHOI_CHOT_DEM.taoLuot(lech, rng, 1)).toEqual([]);
  });

  test("dòng xe tất định theo seed; màn 5 có xe quá tốc độ và xe từ giao lộ", () => {
    const p = doanCua("CD-09");
    expect(sinhDongXe(p)).toEqual(sinhDongXe(structuredClone(p)));
    const dong = sinhDongXe(p);
    expect(dong.some((x) => x.qua_toc_do)).toBe(true);
    expect(dong.some((x) => x.khoi_tao.s_vao)).toBe(true);
    expect(dong.every((x) => x.khoi_tao.nhip_vao < NHIP_CHAY_CHOT)).toBe(true);
    expect(sinhDongXe({ ...p, luong_xe: { ...p.luong_xe, seed: "khac" } })).not.toEqual(dong);
  });
});

describe("đặt vật", () => {
  const de = deCua("CD-10");
  test("ngoài đoạn đường, trong giao lộ, trùng chỗ, xe tuần tra ở lề hẹp: không đặt được", () => {
    expect(lyDoKhongDatDuoc(de, {}, "coc-1", -1, "lan_2")).toContain("ngoài đoạn đường");
    expect(lyDoKhongDatDuoc(de, {}, "coc-1", de.dai_m + 1, "lan_2")).toContain("ngoài đoạn đường");
    expect(lyDoKhongDatDuoc(de, {}, "coc-1", 10, "giua" as never)).toContain("ngoài phần đường");
    expect(lyDoKhongDatDuoc(de, {}, "coc-1", de.giao_lo!.m, "lan_2")).toContain("giao lộ");
    expect(lyDoKhongDatDuoc(de, {}, "xe-1", 180, "le_phai")).toContain("Lề quá hẹp");
    expect(lyDoKhongDatDuoc(de, {}, "xe-1", 180, "lan_2")).toBeNull();
    const bt = { "xe-1": { m: 180, cot: "lan_2" as const, huong: 0 as const } };
    expect(lyDoKhongDatDuoc(de, bt, "coc-1", 177, "lan_2")).toContain("đã có vật");
    expect(lyDoKhongDatDuoc(de, bt, "coc-1", 181, "lan_2")).toBeNull();
    expect(lyDoKhongDatDuoc(de, {}, "vat-la", 10, "lan_2")).toContain("túi đồ");
  });

  test("đặt, dời, xoay biển, gỡ", () => {
    let bt: BoTriChot = {};
    bt = apThaoTacChot(de, bt, "dat", { vat: "bien-1", m: 50, cot: "le_phai" });
    bt = apThaoTacChot(de, bt, "xoay", { vat: "bien-1" });
    bt = apThaoTacChot(de, bt, "dat", { vat: "bien-1", m: 60, cot: "le_trai" });
    expect(bt["bien-1"]).toEqual({ m: 60, cot: "le_trai", huong: 1 });
    expect(() => apThaoTacChot(de, bt, "xoay", { vat: "coc-1" })).toThrow(LoiNhatKy);
    bt = apThaoTacChot(de, bt, "go", { vat: "bien-1" });
    expect(bt).toEqual({});
    expect(() => apThaoTacChot(de, bt, "go", { vat: "bien-1" })).toThrow(LoiNhatKy);
  });
});

describe("dựng lại bố trí, chấm cả bước 0", () => {
  test("chạy thử 2 lần rồi sửa vẫn hợp lệ; bố trí được chấm là bố trí lúc nộp", () => {
    const de = deCua("CD-01");
    const nk = TRO_CHOI_CHOT_DEM.docTraLoi(
      nhatKy({ "bien-1": { m: 60, cot: "le_phai", huong: 0 } }, 2, [
        { thao_tac: "dat", tham_so: { vat: "bien-1", m: 70, cot: "le_phai" } },
      ]),
    )!;
    const kq = dungLaiBoTriChot(de, nk);
    expect(kq.so_lan_chay).toBe(2);
    expect(kq.cham["bien-1"]!.m).toBe(70);
  });

  test("chạy thử lần thứ 3: cả bước 0 điểm", () => {
    const kq = cham("CD-01", nhatKy(TOT_CD01, 3));
    expect(kq.diem).toBe(0);
    expect(kq.ct.hop_le).toBe(false);
    expect(kq.ct.ly_do).toContain("quá 2 lần");
    expect(kq.ct.tieu_chi.every((t) => t.diem === 0)).toBe(true);
  });

  test("nhật ký đặt vật ngoài phần đường hợp lệ: cả bước 0 điểm", () => {
    const kq = cham("CD-01", nhatKy({ ...TOT_CD01, "coc-6": { m: 250, cot: "lan_2", huong: 0 } }, 1));
    expect(kq.diem).toBe(0);
    expect(kq.ct.ly_do).toContain("ngoài phần đường hợp lệ");
  });

  test("nhật ký sai dạng bị từ chối (docTraLoi trả null)", () => {
    const sai = [
      {
        thao_tac: [{ nhip: 0, thao_tac: "dat", tham_so: { vat: "coc-1", m: 1.5, cot: "lan_2" } }],
        tong_nhip: 1,
      },
      {
        thao_tac: [{ nhip: 0, thao_tac: "dat", tham_so: { vat: "coc-1", m: 5, cot: "giua" } }],
        tong_nhip: 1,
      },
      { thao_tac: [{ nhip: 0, thao_tac: "xoa_het", tham_so: null }], tong_nhip: 1 },
      { thao_tac: [{ nhip: 0, thao_tac: "chay_thu", tham_so: { vat: "x" } }], tong_nhip: 1 },
    ];
    for (const s of sai) expect(TRO_CHOI_CHOT_DEM.docTraLoi(s)).toBeNull();
  });

  test("mốc thời gian sai: cả bước 0 điểm", () => {
    const nk = nhatKy(TOT_CD01, 1);
    // Nhật ký dài hơn đồng hồ máy chủ.
    expect(cham("CD-01", { ...nk, tong_nhip: 2000 }, 1000).ct.ly_do).toBe(
      "Nhật ký không khớp đồng hồ máy chủ.",
    );
    // Không theo thứ tự thời gian.
    const dao = { ...nk, thao_tac: [...nk.thao_tac].reverse() };
    const kq = cham("CD-01", dao, 60_000);
    expect(kq.diem).toBe(0);
    expect(kq.ct.ly_do).toBe("Nhật ký không theo thứ tự thời gian.");
  });
});

describe("chấm theo tiêu chí", () => {
  test("bố trí tốt ở CD-01: đủ 100 điểm; máy chủ bỏ qua điểm máy khách gửi", () => {
    const kq = cham("CD-01", { ...nhatKy(TOT_CD01, 1), diem: 5, dung: false });
    expect(kq.diem).toBe(100);
    expect(kq.dung).toBe(true);
    expect(kq.ct.chay.phanh_gap).toEqual([]);
    expect(kq.ct.chay.vao_vung).toEqual([]);
    expect(kq.ct.tieu_chi.map((t) => t.diem)).toEqual([20, 15, 20, 20, 15, 10]);
  });

  test("không có biển, đèn: xe phanh gấp; chiến sĩ đứng làn đang chạy: xe vào vùng nguy hiểm", () => {
    const { "bien-1": _b1, "bien-2": _b2, "den-1": _d1, ...khongBao } = TOT_CD01;
    const kq = cham("CD-01", nhatKy(khongBao, 1));
    expect(kq.ct.chay.phanh_gap.length).toBeGreaterThan(0);
    expect(kq.ct.tieu_chi.find((t) => t.ma === "bien_dau")!.diem).toBe(0);
    expect(kq.ct.tieu_chi.find((t) => t.ma === "bien_khuat")!.diem).toBe(0);
    const lamLan = cham("CD-01", nhatKy({ ...TOT_CD01, "cs-1": { m: 162, cot: "lan_1", huong: 0 } }, 1));
    expect(lamLan.ct.chay.vao_vung.length).toBeGreaterThan(0);
    expect(lamLan.ct.chay.vao_vung.every((x) => x.chien_si === "cs-1")).toBe(true);
    expect(lamLan.ct.tieu_chi.find((t) => t.ma === "chien_si")!.diem).toBe(10);
  });

  // Ca biên: dùng kết quả chạy giả để cô lập từng ngưỡng.
  const d = deCua("CD-01");
  const tc = tieuChiCua(doanCua("CD-01"));
  const n = tc.nguong;
  const chayRong = (them: Partial<KetQuaChayChot> = {}): KetQuaChayChot => ({
    phanh_gap: [],
    vao_vung: [],
    hang_cho_m: 0,
    nhip_hang_cho: 0,
    bien: [
      {
        vat: "bien-1",
        m: 0,
        cot: "le_phai",
        quay_sai: false,
        tam_nhin_m: 50,
        bi_che: false,
        qua_gan: false,
        sau_chot: false,
      },
    ],
    so_xe: 0,
    so_xe_da_qua: 0,
    ...them,
  });
  const diem = (ma: string, bt: BoTriChot, kq = chayRong()) =>
    chamChot(d, tc, bt, kq).tieu_chi.find((t) => t.ma === ma)!.diem;
  const bien = (m: number, huong: 0 | 1 | 2 | 3 = 0): BoTriChot => ({
    "bien-1": { m, cot: "le_phai", huong },
  });

  test("khoảng cách biển đầu tiên: đúng hai mốc được 20, lệch 1 m ra ngoài được 0; biển quay sai không tính", () => {
    expect(diem("bien_dau", bien(d.chot_m - n.bien_dau_m_tu))).toBe(20);
    expect(diem("bien_dau", bien(d.chot_m - n.bien_dau_m_den))).toBe(20);
    expect(diem("bien_dau", bien(d.chot_m - n.bien_dau_m_tu + 1))).toBe(0);
    expect(diem("bien_dau", bien(d.chot_m - n.bien_dau_m_den - 1))).toBe(0);
    expect(diem("bien_dau", bien(d.chot_m - n.bien_dau_m_tu, 2))).toBe(0);
  });

  test("cọc: đúng ngưỡng đủ điểm; hở hơn ngưỡng 1 m trừ một đoạn; thiếu cọc 0; chưa tới chốt tính một đoạn hở", () => {
    const hang = (khoang: number, so = n.coc_toi_thieu, cuoi = d.chot_m - 1): BoTriChot =>
      Object.fromEntries(
        Array.from({ length: so }, (_, i) => [
          `coc-${i + 1}`,
          { m: cuoi - khoang * (so - 1 - i), cot: "lan_2" as const, huong: 0 as const },
        ]),
      );
    expect(diem("coc", hang(n.coc_khoang_m))).toBe(15);
    const mot = hang(n.coc_khoang_m);
    mot["coc-1"]!.m -= 1;
    expect(diem("coc", mot)).toBe(15 - n.tru_moi_doan_ho);
    expect(diem("coc", hang(n.coc_khoang_m, n.coc_toi_thieu - 1))).toBe(0);
    expect(diem("coc", hang(n.coc_khoang_m, n.coc_toi_thieu, d.chot_m - n.coc_khoang_m - 1))).toBe(
      15 - n.tru_moi_doan_ho,
    );
    // Cọc ở làn không thu hẹp không tính.
    const sai = Object.fromEntries(
      Object.entries(hang(n.coc_khoang_m)).map(([k, v]) => [k, { ...v, cot: "lan_1" as const }]),
    );
    expect(diem("coc", sai)).toBe(0);
  });

  test("chiến sĩ: chia đều; chiến sĩ chưa đặt hoặc có xe vào vùng không được điểm", () => {
    const cs: BoTriChot = {
      "cs-1": { m: 170, cot: "lan_2", huong: 0 },
      "cs-2": { m: 175, cot: "lan_2", huong: 0 },
    };
    expect(diem("chien_si", cs)).toBe(20);
    expect(diem("chien_si", { "cs-1": cs["cs-1"]! })).toBe(10);
    const vv = chayRong({
      vao_vung: [{ xe: "xe-01", loai: "o_to", qua_toc_do: false, m: 170, nhip: 5, chien_si: "cs-2" }],
    });
    expect(diem("chien_si", cs, vv)).toBe(10);
  });

  test("phanh gấp: 0 xe đủ điểm, mỗi xe trừ theo ngưỡng, không âm", () => {
    const pg = (k: number) =>
      chayRong({
        phanh_gap: Array.from({ length: k }, (_, i) => ({
          xe: `xe-${i}`,
          loai: "o_to" as const,
          qua_toc_do: false,
          m: 100,
          nhip: i,
        })),
      });
    expect(diem("phanh_gap", {}, pg(0))).toBe(20);
    expect(diem("phanh_gap", {}, pg(1))).toBe(20 - n.tru_moi_xe_phanh_gap);
    expect(diem("phanh_gap", {}, pg(10))).toBe(0);
  });

  test("hàng chờ: đúng ngưỡng đủ điểm, gấp đôi ngưỡng 0, tuyến tính ở giữa", () => {
    const hc = (m: number) => diem("hang_cho", {}, chayRong({ hang_cho_m: m }));
    expect(hc(n.hang_cho_m)).toBe(15);
    expect(hc(n.hang_cho_m + 1)).toBeLessThan(15);
    expect(hc((3 * n.hang_cho_m) / 2)).toBe(7.5);
    expect(hc(2 * n.hang_cho_m)).toBe(0);
    expect(hc(3 * n.hang_cho_m)).toBe(0);
  });

  test("biển khuất: tầm nhìn đúng ngưỡng không khuất, kém 1 m bị trừ; quay sai bị trừ; không biển 0 điểm", () => {
    const b = (tam_nhin_m: number, quay_sai = false) =>
      chayRong({ bien: [{ ...chayRong().bien[0]!, tam_nhin_m, quay_sai }] });
    expect(diem("bien_khuat", {}, b(n.tam_nhin_bien_m))).toBe(10);
    expect(diem("bien_khuat", {}, b(n.tam_nhin_bien_m - 1))).toBe(10 - n.tru_moi_bien_khuat);
    expect(diem("bien_khuat", {}, b(50, true))).toBe(10 - n.tru_moi_bien_khuat);
    expect(diem("bien_khuat", {}, chayRong({ bien: [] }))).toBe(0);
  });

  test("kết quả chạy thử báo biển quá gần, biển sau chốt, biển bị khúc cua che (không dùng ngưỡng)", () => {
    const de = deCua("CD-01");
    // Vùng chốt bắt đầu 10 m trước chốt; quãng giảm tốc êm ≈ 26 m.
    const kc = (m: number) =>
      ketQuaChay(de, { "bien-1": { m, cot: "le_phai", huong: 0 } }, [], [], doDacRong()).bien[0]!.qua_gan;
    const giam = Math.ceil(QUANG_GIAM_TOC_CM / 100);
    expect(kc(de.chot_m - 10 - giam + 1)).toBe(true);
    expect(kc(de.chot_m - 10 - giam - 1)).toBe(false);
    const sau = ketQuaChay(de, { "bien-1": { m: de.chot_m, cot: "le_phai", huong: 0 } }, [], [], doDacRong());
    expect(sau.bien[0]!.sau_chot).toBe(true);
    const cong = deCua("CD-05");
    const che = ketQuaChay(cong, { "bien-1": { m: 185, cot: "le_phai", huong: 0 } }, [], [], doDacRong());
    expect(che.bien[0]!.bi_che).toBe(true);
    expect(che.bien[0]!.tam_nhin_m).toBeLessThan(50);
  });
});

describe("điện thoại và máy chủ ra cùng kết quả", () => {
  test("chạy từng nhịp như điện thoại (có đo hàng chờ) cùng băm trạng thái cuối với máy chủ, mọi đoạn demo", () => {
    for (const d of DOAN) {
      const de = TRO_CHOI_CHOT_DEM.deChoNguoiChoi(buoc(d.ma));
      // Bố trí đơn giản: biển ở lề trái, cọc trên làn thu hẹp, chiến sĩ sau chốt.
      const bt: BoTriChot = {};
      const tui = vatTrongTui(d.payload.tui);
      tui
        .filter((v) => v.loai === "bien")
        .forEach((v, i) => {
          bt[v.id] = { m: de.chot_m - 120 + 8 * i, cot: "le_trai", huong: 0 };
        });
      tui
        .filter((v) => v.loai === "coc")
        .forEach((v, i) => {
          bt[v.id] = { m: de.chot_m - 1 - 3 * i, cot: de.lan_dong, huong: 0 };
        });
      tui
        .filter((v) => v.loai === "cs")
        .forEach((v, i) => {
          bt[v.id] = { m: de.chot_m + 2 + 2 * i, cot: de.lan_dong, huong: 0 };
        });
      const mp = dungMoPhong(cauHinhChot(de, bt));
      let tt = trangThaiDau(mp);
      let dd = doDacRong();
      while (!tt.xong && tt.nhip < NHIP_CHAY_CHOT) {
        tt = buocMoPhong(mp, tt);
        dd = doSauNhip(dd, tt);
      }
      const bamMay = bamTrangThai({ xe: tt.xe, su_kien: tt.su_kien, nhip: tt.nhip });
      const kq = cham(d.ma, nhatKy(bt, 1), null);
      expect({ ma: d.ma, bam: kq.ct.bam, loi: kq.ct.ly_do }).toEqual({ ma: d.ma, bam: bamMay, loi: null });
      expect(kq.ct.chay.hang_cho_m).toBe(Math.round(dd.hang_cho_cm / 100));
    }
  });

  test("chấm lại một bước ở máy chủ dưới 200 ms (màn 5)", () => {
    const de = deCua("CD-09");
    const bt: BoTriChot = {};
    de.tui
      .filter((x) => x.loai === "coc")
      .forEach((v, i) => {
        bt[v.id] = { m: de.chot_m - 1 - 3 * i, cot: "lan_2", huong: 0 };
      });
    const tl = TRO_CHOI_CHOT_DEM.docTraLoi(nhatKy(bt, 2))!;
    const t = performance.now();
    TRO_CHOI_CHOT_DEM.chamBuoc(buoc("CD-09"), tl, { thoiGianMs: 600_000, offline: false });
    expect(performance.now() - t).toBeLessThan(200);
  });
});
