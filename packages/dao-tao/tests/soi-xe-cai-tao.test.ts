/**
 * Trò "Soi xe cải tạo" (docs/PLAN.md GĐ-T14): IoU, giới hạn diện tích khung, ghép khung với chỗ sai (một chỗ
 * tính một lần), nối dòng giấy, dấu, đọc câu trả lời, lượt theo màn, đề không lộ đáp án. Chạy trên chính danh
 * mục biến thể, dòng mức phạt và 16 xe mẫu trong data/.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  type BienTheCaiTao,
  type BuocLuot,
  type BuocSoiXe,
  type ChiTietSoiXe,
  dinhNghiaTheoMan,
  type Hop,
  iou,
  type KhungKhoanh,
  kiemTraBienTheCaiTao,
  kiemTraXeCaiTao,
  kiemTraXeVoiDanhMuc,
  type MucPhatDaDuyet,
  manToiThieu,
  type NguonSoiXe,
  SO_XE_THEO_MAN_SX,
  TRO_CHOI_SOI_XE_CAI_TAO as TC,
  taoRng,
  type XeCaiTao,
  xeSoiDungDuocOMan,
} from "../src/index.ts";

const GOC = join(import.meta.dir, "..", "..", "..");
const DANH_MUC: BienTheCaiTao[] = (
  (await Bun.file(join(GOC, "data", "tro-choi", "bien-the-cai-tao.json")).json()) as { bien_the: any[] }
).bien_the.map(({ tieu_de: _, ...b }) => ({ ...b, version: 1 }));
const MUC_PHAT: Record<string, MucPhatDaDuyet> = Object.fromEntries(
  ((await Bun.file(join(GOC, "data", "tra-cuu", "muc-phat.json")).json()) as { dong: any[] }).dong
    .filter((d) => String(d.ma).startsWith("oto-cai-tao-"))
    .map((d) => [
      d.ma,
      {
        ma: d.ma,
        version: 1,
        hanh_vi: d.hanh_vi,
        phat_tu: d.phat_tu,
        phat_den: d.phat_den,
        tru_diem: d.tru_diem,
        hinh_thuc_bo_sung: d.hinh_thuc_bo_sung,
        can_cu: d.can_cu,
      },
    ]),
);
const MAU = (
  (await Bun.file(join(GOC, "data", "tro-choi", "xe-cai-tao.json")).json()) as {
    xe: Array<{ ma: string; muc: number; xe: XeCaiTao }>;
  }
).xe;

const mau = (ma: string) => MAU.find((x) => x.ma === ma)!;
const nguonTu = (x: (typeof MAU)[number], danhMuc = DANH_MUC): NguonSoiXe => ({
  id: x.ma,
  code: x.ma,
  version: 1,
  topic_id: null,
  muc: x.muc,
  xe: x.xe,
  danh_muc: danhMuc,
  muc_phat: MUC_PHAT,
});
function buoc(ma: string, man = 5, n = nguonTu(mau(ma))): BuocLuot<BuocSoiXe> {
  const [b] = TC.taoLuot([n], taoRng("x"), man);
  if (!b) throw new Error(`Xe ${ma} không vào được màn ${man}`);
  return b;
}
const cham = (b: BuocLuot<BuocSoiXe>, raw: unknown) => {
  const tl = TC.docTraLoi(raw);
  if (!tl) throw new Error("Câu trả lời không hợp lệ");
  return TC.chamBuoc(b, tl);
};
const ct = (r: { chiTiet?: unknown }) => r.chiTiet as ChiTietSoiXe;

/** Khung khoanh đúng một chỗ sai: đúng vùng đáp án; màu sơn thì một khung nhỏ giữa phần sơn. */
function khungDung(b: BuocSoiXe, j: number): KhungKhoanh {
  const c = b.cho_sai[j]!;
  if (c.bien_doi === "doi_mau_son") {
    const t = b.than.nghieng;
    const cx = Math.round((t[0] + t[2]) / 2);
    const cy = Math.round((t[1] + t[3]) / 2);
    const w = Math.round((t[2] - t[0]) / 8);
    const h = Math.round((t[3] - t[1]) / 8);
    return { goc: "nghieng", hop: [cx - w, cy - h, cx + w, cy + h], dong: c.dong };
  }
  return { goc: c.vung[0]!.goc, hop: c.vung[0]!.hop, dong: c.dong };
}
const traLoiDung = (b: BuocSoiXe) => ({ khung: b.cho_sai.map((_, j) => khungDung(b, j)), dau: b.dau });

describe("dữ liệu mẫu", () => {
  test("danh mục và 16 xe hợp lệ; xe khớp danh mục; màn của xe không thấp hơn màn tối thiểu", () => {
    for (const b of DANH_MUC) expect(kiemTraBienTheCaiTao(b)).toEqual([]);
    expect(MAU).toHaveLength(16);
    for (const x of MAU) {
      expect(kiemTraXeCaiTao({ ...x.xe, muc: x.muc })).toEqual([]);
      expect(kiemTraXeVoiDanhMuc(x.xe, DANH_MUC)).toEqual([]);
      expect(manToiThieu(x.xe, DANH_MUC)).toBeLessThanOrEqual(x.muc);
    }
  });

  test("thùng cơi nới ít (chỉ đo mới thấy) chỉ có ở màn 5; cơi nới nhiều từ màn 4", () => {
    expect(manToiThieu(mau("SX-15").xe, DANH_MUC)).toBe(5);
    expect(manToiThieu(mau("SX-12").xe, DANH_MUC)).toBe(4);
  });

  test("biến thể chưa duyệt (vắng khỏi danh mục) thì xe dùng nó không vào lượt", () => {
    const thieu = DANH_MUC.filter((b) => b.ma !== "bt-den-noc");
    expect(xeSoiDungDuocOMan(nguonTu(mau("SX-02"), thieu), 5)).toBe(false);
    expect(xeSoiDungDuocOMan(nguonTu(mau("SX-01"), thieu), 5)).toBe(true);
  });
});

describe("IoU và giới hạn khung", () => {
  test("IoU 0,49 không có điểm, 0,5 có điểm", () => {
    const a: Hop = [0, 0, 100, 100];
    expect(iou(a, [0, 0, 100, 49])).toBeCloseTo(0.49, 10);
    expect(iou(a, [0, 0, 100, 50])).toBe(0.5);
    // Trên một xe thật: khung bằng nửa trên vùng đèn nóc (IoU đúng 0,5) có điểm; hụt 1 đơn vị thì không.
    const b = buoc("SX-02", 1);
    const v = b.noi_dung.cho_sai[0]!.vung[0]!;
    const h = v.hop[3] - v.hop[1];
    expect(h % 2).toBe(0);
    const khung = (y1: number) => ({
      khung: [{ goc: v.goc, hop: [v.hop[0], v.hop[1], v.hop[2], y1], dong: null }],
      dau: "khong_dat",
    });
    expect(ct(cham(b, khung(v.hop[1] + h / 2))).diem_khoanh).toBe(5);
    expect(ct(cham(b, khung(v.hop[1] + h / 2 - 1))).diem_khoanh).toBe(0);
  });

  test("khoanh cả hình để trúng mọi chỗ: khung quá 25% diện tích bị loại, phần khoanh 0 điểm", () => {
    const b = buoc("SX-16", 5);
    const de = TC.deChoNguoiChoi(b);
    const ca = (goc: "nghieng" | "sau") => ({
      goc,
      hop: [0, 0, de.hinh[goc].rong, de.hinh[goc].cao],
      dong: null,
    });
    const r = cham(b, { khung: [ca("nghieng"), ca("sau")], dau: "khong_dat" });
    expect(ct(r).diem_khoanh).toBe(0);
    expect(ct(r).khung_qua_lon).toEqual([0, 1]);
    expect(ct(r).khung_nham).toEqual([0, 1]);
    expect(r.diem).toBe(5);
  });

  test("khoanh trùng hai lần một chỗ chỉ tính một lần, không bị trừ", () => {
    const b = buoc("SX-02", 1);
    const k = khungDung(b.noi_dung, 0);
    const r = cham(b, { khung: [k, { ...k, dong: null }], dau: "khong_dat" });
    expect(ct(r).diem_khoanh).toBe(8);
    expect(ct(r).khung_trung).toEqual([1]);
    expect(ct(r).khung_nham).toEqual([]);
  });

  test("khoanh nhầm −2 chỉ trong phần khoanh, không âm; nối sai dòng mất 3 điểm", () => {
    const b = buoc("SX-07", 5);
    const [k1, k2] = b.noi_dung.cho_sai.map((_, j) => khungDung(b.noi_dung, j));
    const nham: KhungKhoanh = { goc: "sau", hop: [0, 0, 10, 10], dong: null };
    expect(ct(cham(b, { khung: [k1, k2, nham], dau: "khong_dat" })).diem_khoanh).toBe(14);
    expect(ct(cham(b, { khung: [{ ...k1!, dong: "co_lop" }, k2], dau: "khong_dat" })).diem_khoanh).toBe(13);
    expect(ct(cham(b, { khung: [nham, { ...nham, hop: [20, 0, 30, 10] }], dau: "dat" })).diem_khoanh).toBe(0);
  });

  test("màu sơn: khung nhỏ nằm trong phần sơn là chỉ đúng, khung ngoài thân xe thì không", () => {
    const b = buoc("SX-01", 1);
    expect(ct(cham(b, traLoiDung(b.noi_dung))).diem_khoanh).toBe(8);
    const ngoai = { khung: [{ goc: "nghieng", hop: [0, 0, 20, 20], dong: "mau_son" }], dau: "khong_dat" };
    expect(ct(cham(b, ngoai)).diem_khoanh).toBe(0);
  });
});

describe("chấm cả xe", () => {
  test("trả lời đúng mọi xe: đủ điểm tối đa (8 mỗi chỗ sai + 5 dấu)", () => {
    for (const x of MAU) {
      const b = buoc(x.ma, 5);
      expect(b.diem_toi_da).toBe(8 * x.xe.bien_the.length + 5);
      const r = cham(b, traLoiDung(b.noi_dung));
      expect(r.diem).toBe(b.diem_toi_da);
    }
  });

  test("xe đạt: đóng Không đạt mất điểm dấu; xe không đạt có biên bản với mức phạt đã duyệt", () => {
    const b = buoc("SX-06", 5);
    expect(b.noi_dung.dau).toBe("dat");
    expect(cham(b, { khung: [], dau: "khong_dat" }).diem).toBe(0);
    const c = buoc("SX-12", 5);
    expect(c.noi_dung.bien_ban.map((d) => d.muc_phat?.ma)).toEqual(["oto-cai-tao-thung"]);
  });
});

describe("đọc câu trả lời", () => {
  test("quá 6 khung một hình, hộp sai, dòng lạ, dấu lạ: không nhận", () => {
    const k = { goc: "nghieng", hop: [1, 1, 5, 5], dong: null };
    expect(TC.docTraLoi({ khung: [k], dau: "dat" })).not.toBeNull();
    for (const sai of [
      { khung: Array(7).fill(k), dau: "dat" },
      { khung: [{ ...k, hop: [5, 5, 1, 1] }], dau: "dat" },
      { khung: [{ ...k, hop: [1, 1, 5.5, 5] }], dau: "dat" },
      { khung: [{ ...k, dong: "gplx" }], dau: "dat" },
      { khung: [{ ...k, goc: "tren" }], dau: "dat" },
      { khung: [k], dau: "cho_qua" },
    ])
      expect(TC.docTraLoi(sai)).toBeNull();
    const tl = TC.docTraLoi({ khung: [k], dau: "dat", diem: 99, dung: true, vung: [] });
    expect(tl).toEqual({ khung: [{ goc: "nghieng", hop: [1, 1, 5, 5], dong: null }], dau: "dat" });
  });
});

describe("lượt và đề", () => {
  const NGUON = MAU.map((x) => nguonTu(x));

  test("số xe và giờ theo màn; từ màn 2 có xe đạt; tất định theo seed", () => {
    for (let m = 1; m <= 5; m++) {
      const l = TC.taoLuot(NGUON, taoRng(`s${m}`), m);
      expect(l).toHaveLength(SO_XE_THEO_MAN_SX[m]!);
      if (m >= 2) expect(l.some((b) => b.noi_dung.dau === "dat")).toBe(true);
      expect(JSON.stringify(TC.taoLuot(NGUON, taoRng(`s${m}`), m))).toBe(JSON.stringify(l));
    }
    expect(TC.taoLuot(NGUON, taoRng("m1"), 1).every((b) => b.noi_dung.xe.bien_the.length === 1)).toBe(true);
    expect(dinhNghiaTheoMan(TC, 2).thoiGian).toBeNull();
    expect(dinhNghiaTheoMan(TC, 5).thoiGian).toEqual({ caLuotMs: 270_000 });
  });

  const KHOA_CAM = [
    "bien_the",
    "vung",
    "cho_sai",
    "than",
    "dau",
    "bien_ban",
    "muc_phat",
    "can_cu",
    "giai_thich",
    "noi_dung",
    "answer",
    "muc",
    "dong",
    "ma",
  ];
  const coKhoaCam = (v: unknown): string | null => {
    if (Array.isArray(v))
      for (const x of v) {
        const k = coKhoaCam(x);
        if (k) return k;
      }
    else if (v && typeof v === "object")
      for (const [k, x] of Object.entries(v)) {
        if (KHOA_CAM.includes(k)) return k;
        const con = coKhoaCam(x);
        if (con) return con;
      }
    return null;
  };

  test("đề không có danh sách biến thể, vùng đáp án, tên bộ phận; giấy ghi thông số xe gốc", () => {
    for (const b of TC.taoLuot(NGUON, taoRng("d"), 5)) {
      const de = TC.deChoNguoiChoi(b);
      expect(coKhoaCam(de)).toBeNull();
      for (const g of ["nghieng", "sau"] as const)
        for (const n of de.hinh[g].net) expect(Object.keys(n).sort()).toEqual(["d", "kieu"]);
      expect(de.giay.thong_so.so_cho).toBe(b.noi_dung.xe.xe.so_cho);
    }
  });

  test("cùng xe cùng đáp án ở máy khách (gói offline) và máy chủ", () => {
    const goi = JSON.parse(JSON.stringify(NGUON)) as NguonSoiXe[];
    const a = TC.taoLuot(NGUON, taoRng("off"), 5);
    const c = TC.taoLuot(goi, taoRng("off"), 5);
    expect(JSON.stringify(c)).toBe(JSON.stringify(a));
    for (const [i, b] of a.entries())
      expect(cham(c[i]!, traLoiDung(b.noi_dung)).diem).toBe(cham(b, traLoiDung(b.noi_dung)).diem);
  });
});
