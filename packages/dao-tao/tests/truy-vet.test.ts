/**
 * Trò "Truy vết xe bỏ trốn" (docs/PLAN.md GĐ-T17): kiểm nội dung, sinh lộ trình tất định, xe mồi không
 * khớp hoàn toàn mô tả, id xe khác nhau giữa các đoạn cảnh, đồng hồ trong trò (chờ, sai hướng, hết lượt),
 * chấm (khóa nhầm không làm điểm âm, điểm chặn sau khi xe đã qua là sai, thưởng lượt xem dư), lượt online
 * chỉ tin nhật ký của route, đề không có lộ trình, đoạn cảnh chạy M5 không va chạm.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { soBuocNganNhat } from "../src/ban-do/index.ts";
import { taoRng } from "../src/de-thi.ts";
import { buocMoPhong, dungMoPhong, trangThaiDau } from "../src/mo-phong/mo-phong.ts";
import { bamTrangThai } from "../src/tro-choi/chung/nhat-ky.ts";
import type { BuocLuot } from "../src/tro-choi/khung.ts";
import {
  apThaoTacTV,
  type BuocNhatKyTV,
  type BuocTruyVet,
  type ChiTietTruyVet,
  cauHinhDoanCanh,
  chayNhatKyTV,
  DIEM_CHAN_DUNG,
  DIEM_KHOA_DUNG,
  deTuVu,
  diemToiDaTV,
  dungDoanCanh,
  dungVu,
  GIAY_CHAN_TRUOC,
  GIAY_SAI_HUONG,
  GIAY_XEM,
  khopMoTa,
  kiemTraVu,
  type LoTrinh,
  type NguonTruyVet,
  NHIP_DAN,
  NHIP_DOAN,
  type PayloadVuTruyVet,
  SO_BIEN_THE,
  sinhLoTrinh,
  THONG_SO_MAN_TRUY_VET,
  TRO_CHOI_TRUY_VET,
  TRU_KHOA_NHAM,
  thoiDiemCamera,
  trangThaiDauTV,
  type VuDaDung,
  xeMoiCuaLuot,
  xeQuaDoan,
  xeTrongDoan,
} from "../src/tro-choi/truy-vet.ts";

const GOC = join(import.meta.dir, "..", "..", "..");
const DU_LIEU = JSON.parse(readFileSync(join(GOC, "data", "tro-choi", "truy-vet.json"), "utf8")) as {
  vu: Array<{ ma: string; payload: PayloadVuTruyVet }>;
};
const VU = (ma: string) => structuredClone(DU_LIEU.vu.find((v) => v.ma === ma)!.payload);
const nguon = (p: PayloadVuTruyVet, id = "n1"): NguonTruyVet => ({
  id,
  code: id,
  version: 1,
  topic_id: null,
  vu: p,
});

/** Lượt của một vụ, dựng qua định nghĩa trò (như máy chủ). */
function luotCua(ma: string, seed = "luot-1"): BuocLuot<BuocTruyVet> {
  const p = VU(ma);
  return TRO_CHOI_TRUY_VET.taoLuot([nguon(p)], taoRng(seed), p.muc)[0]!;
}

type Op = Omit<BuocNhatKyTV, "nhip">;

/** Chơi đúng: mở lần lượt camera trên lộ trình (chờ khi cần), khóa đúng xe, đặt điểm chặn ở ô đúng đầu tiên. */
function choiDung(nd: BuocTruyVet): { ops: Op[]; v: VuDaDung } {
  const v = dungVu(nd.vu, nd.bi_mat);
  const ops: Op[] = [];
  let tt = trangThaiDauTV(nd.vu);
  const ap = (op: Op) => {
    const kq = apThaoTacTV(v, tt, op, nd.lo_trinh);
    if ("loi" in kq) throw new Error(kq.loi.thong_bao);
    tt = kq.tt;
    ops.push(op);
  };
  for (const c of nd.lo_trinh.camera) {
    ap({ thao_tac: "mo", tham_so: { camera: c.id, cho: true } });
    const d = tt.doan.at(-1)!;
    const xe = xeTrongDoan(v, d, nd.lo_trinh).find((x) => x.vai === "bo_chay")!;
    ap({ thao_tac: "khoa", tham_so: { doan: d.so, xe: xe.id } });
  }
  const j = nd.lo_trinh.t.findIndex((t) => t >= tt.dong_ho + GIAY_CHAN_TRUOC);
  ap({ thao_tac: "chan", tham_so: nd.lo_trinh.o[j]! });
  return { ops, v };
}

const nhatKy = (ops: Op[]) => ({ thao_tac: ops.map((o, i) => ({ ...o, nhip: i })), tong_nhip: ops.length });

describe("Truy vết: nội dung", () => {
  test("8 vụ demo hợp lệ, phủ đủ 5 màn, có tiền tố [Demo]", () => {
    expect(DU_LIEU.vu.length).toBe(8);
    for (const v of DU_LIEU.vu) expect(kiemTraVu(v.payload)).toEqual([]);
    expect(new Set(DU_LIEU.vu.map((v) => v.payload.muc))).toEqual(new Set([1, 2, 3, 4, 5]));
    for (const v of DU_LIEU.vu) expect(v.payload.tin_bao.startsWith("[Demo]")).toBe(true);
  });

  test("bộ kiểm báo đúng chỗ: ký tự biển số, camera ngoài đường, thiếu camera, tin báo thiếu màu", () => {
    const p = VU("tv-01");
    expect(
      kiemTraVu({ ...p, xe_bo_chay: { ...p.xe_bo_chay, ky_tu: "999" } }).map((l) => l.phan_tu),
    ).toContain("xe");
    const camSai = { ...p, camera: [...p.camera.slice(1), { ...p.camera[0]!, x: 0, y: 0 }] };
    expect(kiemTraVu(camSai).some((l) => l.phan_tu === `camera:${p.camera[0]!.id}`)).toBe(true);
    expect(
      kiemTraVu({ ...p, camera: p.camera.slice(0, 3) }).some((l) => l.loi.includes("ít nhất 4 camera")),
    ).toBe(true);
    expect(
      kiemTraVu({ ...p, tin_bao: p.tin_bao.replace("đỏ", "sẫm") }).some((l) => l.loi.includes("màu")),
    ).toBe(true);
    expect(kiemTraVu({ ...p, bao_sau_giay: 10 }).length).toBeGreaterThan(0);
  });
});

describe("Truy vết: sinh lộ trình", () => {
  test("cùng seed cùng lộ trình; mọi biến thể qua đúng số camera của màn, mỗi chặng là đường ngắn nhất", () => {
    for (const { payload: p } of DU_LIEU.vu) {
      const ts = THONG_SO_MAN_TRUY_VET[p.muc]!;
      const v = dungVu(p, "x");
      for (let b = 0; b < SO_BIEN_THE; b++) {
        const lt = sinhLoTrinh(p, b)!;
        expect(sinhLoTrinh(structuredClone(p), b)).toEqual(lt);
        expect(lt.camera.length).toBe(ts.camera);
        let truoc = { x: p.noi_xay_ra.x, y: p.noi_xay_ra.y };
        let i0 = 0;
        for (const c of lt.camera) {
          const cam = p.camera.find((x) => x.id === c.id)!;
          expect(soBuocNganNhat(v.luoi, truoc, cam)).toBe(c.chi_so - i0);
          truoc = cam;
          i0 = c.chi_so;
        }
      }
    }
  });

  test("đổi seed thì lộ trình khác; chơi đúng thì có ít nhất một điểm chặn đúng", () => {
    const p = VU("tv-08");
    const a = sinhLoTrinh(p, 0)!;
    const khac = [0, 1, 2].map((b) =>
      sinhLoTrinh(p, b)!
        .o.map((o) => `${o.x},${o.y}`)
        .join(" "),
    );
    expect(new Set(khac).size).toBeGreaterThan(1);
    expect(a.t.at(-1)!).toBeGreaterThan(0);
    for (const { payload } of DU_LIEU.vu) {
      const l = luotCua(DU_LIEU.vu.find((v) => v.payload === payload)!.ma);
      expect(() => choiDung(l.noi_dung)).not.toThrow();
    }
  });
});

describe("Truy vết: đoạn cảnh", () => {
  test("xe mồi không khớp hoàn toàn mô tả; xe nền không khớp; màn 1 không có xe khác cùng màu", () => {
    for (const { ma, payload: p } of DU_LIEU.vu) {
      const l = luotCua(ma);
      const nd = l.noi_dung;
      const v = dungVu(nd.vu, nd.bi_mat);
      for (const m of xeMoiCuaLuot(v)) expect(khopMoTa(m, p.xe_bo_chay)).toBe(false);
      const { ops } = choiDung(nd);
      const tt = chayNhatKyTV(v, ops, nd.lo_trinh);
      for (const d of tt.doan)
        for (const x of xeTrongDoan(v, d, nd.lo_trinh)) {
          if (x.vai !== "bo_chay") expect(khopMoTa({ ...x, bien_so: x.bien_so }, p.xe_bo_chay)).toBe(false);
          if (p.muc === 1 && x.vai !== "bo_chay") expect(x.mau).not.toBe(p.xe_bo_chay.mau);
        }
    }
  });

  test("id xe khác nhau giữa hai đoạn cảnh, và giữa hai lượt của cùng vụ", () => {
    const nd = luotCua("tv-05").noi_dung;
    const { ops, v } = choiDung(nd);
    const tt = chayNhatKyTV(v, ops, nd.lo_trinh);
    const idBoChay = tt.doan.map((d) => xeTrongDoan(v, d, nd.lo_trinh).find((x) => x.vai === "bo_chay")!.id);
    expect(new Set(idBoChay).size).toBe(idBoChay.length);
    const moiDoan = tt.doan.map((d) => new Set(xeTrongDoan(v, d, nd.lo_trinh).map((x) => x.id)));
    for (let i = 1; i < moiDoan.length; i++)
      expect([...moiDoan[i]!].filter((id) => moiDoan[i - 1]!.has(id))).toEqual([]);
    const khac = luotCua("tv-05", "luot-2").noi_dung;
    expect(khac.bi_mat).not.toBe(nd.bi_mat);
  });

  test("đoạn cảnh chạy M5 không va chạm; xe bỏ chạy hiện trong khung khi camera ở trên lộ trình", () => {
    for (const { ma } of DU_LIEU.vu) {
      const nd = luotCua(ma).noi_dung;
      const { ops, v } = choiDung(nd);
      const tt = chayNhatKyTV(v, ops, nd.lo_trinh);
      for (const d of tt.doan) {
        const dc = dungDoanCanh(v, d, nd.lo_trinh);
        const mp = dungMoPhong(cauHinhDoanCanh(dc));
        let s = trangThaiDau(mp);
        for (let i = 0; i < NHIP_DAN + NHIP_DOAN; i++) s = buocMoPhong(mp, s);
        expect(s.su_kien.filter((k) => k.loai === "va_cham")).toEqual([]);
        expect(dc.xe.every((x) => x.nhip_vao >= 0)).toBe(true);
      }
    }
  });
});

describe("Truy vết: đồng hồ trong trò", () => {
  const nd = () => luotCua("tv-03").noi_dung;

  test("mở camera chưa tới giờ mà không chờ thì bị từ chối; chọn chờ thì đồng hồ nhảy tới lúc xem được", () => {
    const b = nd();
    const v = dungVu(b.vu, b.bi_mat);
    // Camera cuối trên lộ trình, mở ngay từ đầu: xe chưa thể tới.
    const cuoi = b.lo_trinh.camera.at(-1)!;
    const tt0 = trangThaiDauTV(b.vu);
    const kq = apThaoTacTV(v, tt0, { thao_tac: "mo", tham_so: { camera: cuoi.id, cho: false } }, b.lo_trinh);
    expect("loi" in kq && kq.loi.ma).toBe("chua_toi_gio");
    expect("loi" in kq && kq.loi.cho_giay).toBeGreaterThan(0);
    const cho = apThaoTacTV(v, tt0, { thao_tac: "mo", tham_so: { camera: cuoi.id, cho: true } }, b.lo_trinh);
    expect("tt" in cho).toBe(true);
    if ("tt" in cho) {
      // Thời điểm tính theo đường ngắn nhất từ nơi xảy ra (mốc ban đầu), không theo lộ trình thật.
      const t = thoiDiemCamera(v, tt0, b.vu.camera.find((c) => c.id === cuoi.id)!)!;
      expect(cho.tt.doan[0]!.t).toBe(t);
      const saiHuong = xeQuaDoan(v, b.lo_trinh, cho.tt.doan[0]!) === null ? GIAY_SAI_HUONG : 0;
      expect(cho.tt.dong_ho).toBe(t + 5 + GIAY_XEM + saiHuong);
      expect(cho.tt.con_luot).toBe(THONG_SO_MAN_TRUY_VET[b.man]!.luot_xem - 1);
    }
  });

  test("camera sai hướng tốn thêm thời gian; xem lại cùng đoạn bị từ chối; hết lượt thì không mở được", () => {
    const b = nd();
    const v = dungVu(b.vu, b.bi_mat);
    const tren = new Set(b.lo_trinh.camera.map((c) => c.id));
    const sai = b.vu.camera.find((c) => !tren.has(c.id))!;
    let tt = trangThaiDauTV(b.vu);
    const kq = apThaoTacTV(v, tt, { thao_tac: "mo", tham_so: { camera: sai.id, cho: true } }, b.lo_trinh);
    if (!("tt" in kq)) throw new Error("không mở được");
    const t = kq.tt.doan[0]!.t;
    expect(kq.tt.dong_ho).toBe(Math.max(tt.dong_ho, t + 5) + GIAY_XEM + GIAY_SAI_HUONG);
    const lai = apThaoTacTV(v, kq.tt, { thao_tac: "mo", tham_so: { camera: sai.id, cho: true } }, b.lo_trinh);
    expect("loi" in lai && lai.loi.ma).toBe("da_xem");
    tt = { ...kq.tt, con_luot: 0 };
    const het = apThaoTacTV(
      v,
      tt,
      { thao_tac: "mo", tham_so: { camera: b.lo_trinh.camera[0]!.id, cho: true } },
      b.lo_trinh,
    );
    expect("loi" in het && het.loi.ma).toBe("het_luot");
  });

  test("khóa chỉ trong đoạn vừa mở, một lần; xe không có trong đoạn bị từ chối", () => {
    const b = nd();
    const v = dungVu(b.vu, b.bi_mat);
    const c1 = b.lo_trinh.camera[0]!.id;
    const kq = apThaoTacTV(
      v,
      trangThaiDauTV(b.vu),
      { thao_tac: "mo", tham_so: { camera: c1, cho: true } },
      b.lo_trinh,
    );
    if (!("tt" in kq)) throw new Error("không mở được");
    const xe = xeTrongDoan(v, kq.tt.doan[0]!, b.lo_trinh)[0]!;
    const k1 = apThaoTacTV(v, kq.tt, { thao_tac: "khoa", tham_so: { doan: 0, xe: xe.id } }, b.lo_trinh);
    if (!("tt" in k1)) throw new Error("không khóa được");
    expect(k1.tt.moc.camera).toBe(c1);
    const k2 = apThaoTacTV(v, k1.tt, { thao_tac: "khoa", tham_so: { doan: 0, xe: xe.id } }, b.lo_trinh);
    expect("loi" in k2 && k2.loi.ma).toBe("khoa_sai");
    const k3 = apThaoTacTV(v, kq.tt, { thao_tac: "khoa", tham_so: { doan: 0, xe: "xzzzz" } }, b.lo_trinh);
    expect("loi" in k3 && k3.loi.ma).toBe("khoa_sai");
  });
});

describe("Truy vết: chấm", () => {
  test("chơi đúng: đủ điểm tối đa của màn (khóa đúng mọi camera, chặn đúng, thưởng lượt dư)", () => {
    for (const { ma } of DU_LIEU.vu) {
      const l = luotCua(ma);
      const { ops } = choiDung(l.noi_dung);
      const tl = TRO_CHOI_TRUY_VET.docTraLoi(nhatKy(ops))!;
      const kq = TRO_CHOI_TRUY_VET.chamBuoc(l, tl, { thoiGianMs: null, offline: true });
      expect(kq.diem).toBe(diemToiDaTV(l.noi_dung.man));
      expect(kq.diemToiDa).toBe(diemToiDaTV(l.noi_dung.man));
      expect(kq.dung).toBe(true);
      const ct = kq.chiTiet as ChiTietTruyVet;
      expect(ct.so_khoa_dung).toBe(THONG_SO_MAN_TRUY_VET[l.noi_dung.man]!.camera);
      expect(ct.diem_chan).toBe(DIEM_CHAN_DUNG);
    }
  });

  test("khóa nhầm −3 không làm điểm bước âm; điểm chặn đặt sau khi xe đã qua thì sai, không có thưởng", () => {
    const l = luotCua("tv-04");
    const nd = l.noi_dung;
    const v = dungVu(nd.vu, nd.bi_mat);
    const c1 = nd.lo_trinh.camera[0]!.id;
    let tt = trangThaiDauTV(nd.vu);
    const mo = apThaoTacTV(v, tt, { thao_tac: "mo", tham_so: { camera: c1, cho: true } }, nd.lo_trinh);
    if (!("tt" in mo)) throw new Error("không mở được");
    tt = mo.tt;
    const nham = xeTrongDoan(v, tt.doan[0]!, nd.lo_trinh).find((x) => x.vai !== "bo_chay")!;
    const ops: Op[] = [
      { thao_tac: "mo", tham_so: { camera: c1, cho: true } },
      { thao_tac: "khoa", tham_so: { doan: 0, xe: nham.id } },
      // Ô nơi xảy ra: xe đã qua từ lâu.
      { thao_tac: "chan", tham_so: { x: nd.vu.noi_xay_ra.x, y: nd.vu.noi_xay_ra.y } },
    ];
    const kq = TRO_CHOI_TRUY_VET.chamBuoc(l, TRO_CHOI_TRUY_VET.docTraLoi(nhatKy(ops))!, {
      thoiGianMs: null,
      offline: true,
    });
    const ct = kq.chiTiet as ChiTietTruyVet;
    expect(ct.diem_khoa).toBe(-TRU_KHOA_NHAM);
    expect(ct.chan?.dung).toBe(false);
    expect(ct.diem_thuong).toBe(0);
    expect(kq.diem).toBe(0);
  });

  test("thưởng lượt xem dư: +2 mỗi lượt, tối đa 10; mở sai một camera thì mất một lượt dư", () => {
    const l = luotCua("tv-08");
    const nd = l.noi_dung;
    const { ops } = choiDung(nd);
    const ts = THONG_SO_MAN_TRUY_VET[5]!;
    const ct = TRO_CHOI_TRUY_VET.chamBuoc(l, TRO_CHOI_TRUY_VET.docTraLoi(nhatKy(ops))!, {
      thoiGianMs: null,
      offline: true,
    }).chiTiet as ChiTietTruyVet;
    expect(ct.con_luot).toBe(ts.luot_xem - ts.camera);
    expect(ct.diem_thuong).toBe(Math.min(10, 2 * (ts.luot_xem - ts.camera)));
    expect(ct.diem_khoa).toBe(ts.camera * DIEM_KHOA_DUNG);
  });

  test("lượt online: máy chủ bỏ qua thao tác mở camera máy khách gửi, chỉ dùng nhật ký của route", () => {
    const l = luotCua("tv-01");
    const nd = l.noi_dung;
    const { ops } = choiDung(nd);
    const chan = ops.at(-1)!;
    // Máy khách gửi đủ nhật ký "chơi đúng", nhưng route chưa ghi lần mở camera nào: không có đoạn nào, không điểm khóa.
    const tl = TRO_CHOI_TRUY_VET.docTraLoi(nhatKy(ops))!;
    const online = TRO_CHOI_TRUY_VET.chamBuoc(l, tl, { thoiGianMs: 60_000, offline: false });
    const ctOn = online.chiTiet as ChiTietTruyVet;
    expect(ctOn.doan).toEqual([]);
    expect(ctOn.diem_khoa).toBe(0);
    // Route đã ghi đủ lần mở, khóa: máy khách chỉ gửi thao tác chặn.
    const coNk: BuocLuot<BuocTruyVet> = {
      ...l,
      noi_dung: { ...nd, nhat_ky: ops.slice(0, -1).map((o) => ({ ...o, nhip: 0 })) },
    };
    const kq = TRO_CHOI_TRUY_VET.chamBuoc(coNk, TRO_CHOI_TRUY_VET.docTraLoi(nhatKy([chan]))!, {
      thoiGianMs: 60_000,
      offline: false,
    });
    expect(kq.diem).toBe(diemToiDaTV(nd.man));
  });

  test("nhật ký offline có thao tác không hợp lệ (mở khi chưa tới giờ, không chờ) thì cả bước 0 điểm", () => {
    const l = luotCua("tv-02");
    const nd = l.noi_dung;
    const ops: Op[] = [
      { thao_tac: "mo", tham_so: { camera: nd.lo_trinh.camera.at(-1)!.id, cho: false } },
      { thao_tac: "chan", tham_so: nd.lo_trinh.o.at(-1)! },
    ];
    const kq = TRO_CHOI_TRUY_VET.chamBuoc(l, TRO_CHOI_TRUY_VET.docTraLoi(nhatKy(ops))!, {
      thoiGianMs: null,
      offline: true,
    });
    expect(kq.diem).toBe(0);
    expect((kq.chiTiet as ChiTietTruyVet).hop_le).toBe(false);
  });

  test("nhật ký sai dạng bị từ chối: thiếu điểm chặn, hai điểm chặn, thao tác lạ", () => {
    expect(
      TRO_CHOI_TRUY_VET.docTraLoi(nhatKy([{ thao_tac: "mo", tham_so: { camera: "c1", cho: true } }])),
    ).toBeNull();
    const chan = { thao_tac: "chan" as const, tham_so: { x: 1, y: 1 } };
    expect(TRO_CHOI_TRUY_VET.docTraLoi(nhatKy([chan, chan]))).toBeNull();
    expect(
      TRO_CHOI_TRUY_VET.docTraLoi({ thao_tac: [{ nhip: 0, thao_tac: "bay", tham_so: {} }], tong_nhip: 1 }),
    ).toBeNull();
  });
});

describe("Truy vết: đề và tất định", () => {
  const CAM = [
    "lo_trinh",
    "xe_muc_tieu",
    "diem_chan",
    "seed_lo_trinh",
    "seed",
    "bi_mat",
    "xe_bo_chay",
    "vai",
    "answer",
    "dap_an",
    "giai_thich",
    "can_cu",
    "noi_dung",
  ];
  const khoa = (v: unknown, ds: string[] = []): string[] => {
    if (Array.isArray(v)) for (const x of v) khoa(x, ds);
    else if (v && typeof v === "object")
      for (const [k, x] of Object.entries(v)) {
        ds.push(k);
        khoa(x, ds);
      }
    return ds;
  };

  test("đề không có lộ trình, seed, bí mật, biển số đầy đủ của xe bỏ chạy; kể cả khi đã mở camera", () => {
    const l = luotCua("tv-06");
    const de = TRO_CHOI_TRUY_VET.deChoNguoiChoi(l);
    expect(khoa(de).filter((k) => CAM.includes(k))).toEqual([]);
    expect(JSON.stringify(de)).not.toContain(l.noi_dung.vu.xe_bo_chay.bien_so);
    const { ops } = choiDung(l.noi_dung);
    const deMo = deTuVu({ ...l.noi_dung, nhat_ky: ops.slice(0, 2).map((o) => ({ ...o, nhip: 0 })) });
    expect(deMo.da_mo.length).toBe(1);
    expect(khoa(deMo).filter((k) => CAM.includes(k))).toEqual([]);
  });

  test("ảnh chụp qua JSON (như gói offline) cho cùng đề, cùng kết quả chấm (so băm)", () => {
    const l = luotCua("tv-07");
    const { ops } = choiDung(l.noi_dung);
    const tl = TRO_CHOI_TRUY_VET.docTraLoi(nhatKy(ops))!;
    const qua = JSON.parse(JSON.stringify(l)) as typeof l;
    const a = TRO_CHOI_TRUY_VET.chamBuoc(l, tl, { thoiGianMs: null, offline: true });
    const b = TRO_CHOI_TRUY_VET.chamBuoc(qua, tl, { thoiGianMs: null, offline: true });
    expect(bamTrangThai(b)).toBe(bamTrangThai(a));
    expect(bamTrangThai(TRO_CHOI_TRUY_VET.deChoNguoiChoi(qua))).toBe(
      bamTrangThai(TRO_CHOI_TRUY_VET.deChoNguoiChoi(l)),
    );
    const lt: LoTrinh = l.noi_dung.lo_trinh;
    expect(sinhLoTrinh(l.noi_dung.vu, lt.bien_the)).toEqual(lt);
  });

  test("taoLuot chỉ lấy vụ đúng màn; không có vụ hợp lệ thì không có bước", () => {
    const p = VU("tv-01");
    expect(TRO_CHOI_TRUY_VET.taoLuot([nguon(p)], taoRng("a"), 2)).toEqual([]);
    expect(TRO_CHOI_TRUY_VET.taoLuot([nguon({ ...p, camera: [] })], taoRng("a"), 1)).toEqual([]);
  });

  test("mã trò không dùng hàm lượng giác, Math.random, Date.now", () => {
    const ma = readFileSync(join(import.meta.dir, "..", "src", "tro-choi", "truy-vet.ts"), "utf8").replace(
      /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
      "",
    );
    expect(ma).not.toMatch(/Math\.(sin|cos|tan|atan2|random)|Date\.now/);
  });
});
