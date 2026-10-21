/**
 * Trò "Soi xe cải tạo" (docs/PLAN.md GĐ-T14, docs/GAME_DESIGN.md §5.14).
 *
 * Mỗi xe là một bước: hình nhìn nghiêng và nhìn sau dựng từ tham số (tro-choi/hinh-xe-tham-so.ts), cạnh đó
 * là giấy chứng nhận kiểm định ghi thông số của xe GỐC (M1, `ThongSoKyThuat`). Người chơi khoanh chỗ xe khác
 * giấy, nối mỗi khung với một dòng trên giấy, rồi đóng dấu Đạt hoặc Không đạt. Chấm (câu D15: điểm bước
 * không âm):
 *   - mỗi chỗ sai khoanh đúng: 5 (IoU ≥ 0,5 với vùng đáp án; đổi màu sơn: khung nằm ít nhất một nửa trong
 *     phần sơn, vì màu sai ở khắp thân xe); nối đúng dòng giấy cho chỗ đó: 3;
 *   - khung không khớp chỗ sai nào: −2, chỉ trừ trong phần khoanh, không âm. Khung lớn hơn 25% diện tích
 *     hình bị loại và tính là khoanh nhầm; mỗi hình tối đa 6 khung. Một chỗ sai chỉ tính cho một khung;
 *     khoanh trùng lần nữa không cộng, không trừ;
 *   - dấu đúng: 5.
 *
 * Danh mục biến thể cải tạo là nội dung có duyệt (game_content, `payload.kieu = "bien_the"`, trỏ tới dòng
 * mức phạt). Xe dùng biến thể chưa duyệt thì không vào lượt. Vùng đáp án không soạn tay: tính từ tham số
 * hình và biến thể. Đề gửi xuống chỉ có nét hình (không tên bộ phận) và giấy; không có danh sách biến thể,
 * vùng đáp án, dòng giấy đúng. Hàm thuần. Bộ kiểm dạng dữ liệu ở soi-xe-cai-tao-kiem.ts.
 */

import { tron } from "../de-thi.ts";
import { type DongBienBan, dongBienBan, type MucPhatDaDuyet } from "./chung/bien-ban.ts";
import { DONG_THONG_SO, type DongThongSo, TEN_DONG_THONG_SO, type ThongSoKyThuat } from "./chung/giay-to.ts";
import type { CauHinhMan } from "./chung/man-choi.ts";
import {
  type BienDoi,
  dungHinhXe,
  type GocNhin,
  type HinhGoc,
  type Hop,
  type KieuBienDoi,
  type LoaiXeHinh,
  MAU_SON,
  TEN_LOAI_XE_HINH,
  type ThamSoBienDoi,
  type ThamSoXe,
  TY_LE_MM,
  thongSoTuXe,
} from "./hinh-xe-tham-so.ts";
import type { BuocLuot, DinhNghiaTroChoi } from "./khung.ts";

export const MA_SOI_XE_CAI_TAO = "soi_xe_cai_tao";
export const DIEM_KHOANH_SX = 5;
export const DIEM_NOI = 3;
export const TRU_KHOANH_NHAM_SX = 2;
export const DIEM_DAU_SX = 5;
export const NGUONG_IOU = 0.5;
/** Khung lớn hơn tỷ lệ này của diện tích hình bị loại. */
export const TY_LE_KHUNG_TOI_DA = 0.25;
export const KHUNG_TOI_DA_MOI_HINH = 6;
/** Thùng cơi nới dưới mức này (mm) chỉ đo bằng thước mới thấy: chỉ có ở màn 5. */
export const CAO_THEM_THAY_BANG_MAT_MM = 250;

export const DAU_SOI_XE = ["dat", "khong_dat"] as const;
export type DauSoiXe = (typeof DAU_SOI_XE)[number];
export const TEN_DAU_SOI_XE: Record<DauSoiXe, string> = { dat: "Đạt", khong_dat: "Không đạt" };

/* ------------------------------------------------------------------ */
/* Màn chơi                                                            */
/* ------------------------------------------------------------------ */

export const SO_XE_THEO_MAN_SX: Readonly<Record<number, number>> = { 1: 5, 2: 8, 3: 8, 4: 8, 5: 8 };

export const MAN_SOI_XE: readonly CauHinhMan[] = [
  {
    so: 1,
    ten: "Màn 1: Chỗ sai rõ",
    moTa: "5 xe, mỗi xe một chỗ sai rõ: đổi màu sơn, đèn gắn thêm. Không tính giờ.",
    caLuotMs: null,
    xpCoBan: 10,
  },
  {
    so: 2,
    ten: "Màn 2: Có xe đạt",
    moTa: "8 xe, 1–2 chỗ sai; có xe không sai chỗ nào. Không tính giờ.",
    caLuotMs: null,
    xpCoBan: 12,
  },
  {
    so: 3,
    ten: "Màn 3: Lốp, ống xả",
    moTa: "8 xe. Thêm lốp khác cỡ, ống xả độ. 5 phút cả lượt.",
    caLuotMs: 300_000,
    xpCoBan: 14,
  },
  {
    so: 4,
    ten: "Màn 4: Thùng, ghế",
    moTa: "8 xe. Thêm thùng cơi nới, ghế lắp thêm nhìn qua cửa sổ. 5 phút cả lượt.",
    caLuotMs: 300_000,
    xpCoBan: 16,
  },
  {
    so: 5,
    ten: "Màn 5: Đo bằng thước",
    moTa: "8 xe, 2–3 chỗ sai, có chỗ phải đo bằng thước mới thấy. 4 phút 30 giây cả lượt.",
    caLuotMs: 270_000,
    xpCoBan: 18,
  },
];
export const SO_MAN_SOI_XE = MAN_SOI_XE.length;
const ganMan = (man: number | undefined) =>
  Math.min(SO_MAN_SOI_XE, Math.max(1, Number.isInteger(man) ? (man as number) : 1));

/* ------------------------------------------------------------------ */
/* Dữ liệu                                                             */
/* ------------------------------------------------------------------ */

/** Một biến thể trong danh mục có duyệt. */
export interface BienTheCaiTao {
  ma: string;
  version: number;
  ten: string;
  bien_doi: KieuBienDoi;
  /** Dòng giấy mà chỗ sai này không khớp. */
  dong: DongThongSo;
  loai_xe: LoaiXeHinh[];
  /** Màn đầu tiên có biến thể này. */
  man_tu: number;
  ma_muc_phat: string | null;
  can_cu: string;
  giai_thich: string;
}

export interface XeCaiTao {
  bien_so: string;
  ngay_kiem_tra: string;
  xe: ThamSoXe;
  /** Biến thể áp lên xe: mã trong danh mục và tham số. Rỗng: xe đúng giấy. */
  bien_the: Array<{ ma: string; tham_so: ThamSoBienDoi }>;
  giay: { so: string; co_gia_tri_den: string };
}

export interface NguonSoiXe {
  id: string;
  code: string;
  version: number;
  topic_id: string | null;
  muc: number;
  xe: XeCaiTao;
  /** Danh mục biến thể đã duyệt (mọi mục đang dùng được). */
  danh_muc: BienTheCaiTao[];
  muc_phat: Record<string, MucPhatDaDuyet>;
}

export interface ChoSai {
  ma: string;
  ten: string;
  dong: DongThongSo;
  bien_doi: KieuBienDoi;
  mo_ta: string;
  vung: Array<{ goc: GocNhin; hop: Hop }>;
  can_cu: string;
  giai_thich: string;
}

export interface BuocSoiXe {
  man: number;
  xe: XeCaiTao;
  cho_sai: ChoSai[];
  than: Record<GocNhin, Hop>;
  dau: DauSoiXe;
  bien_ban: DongBienBan[];
}

export interface DeSoiXe {
  man: number;
  loai_xe: LoaiXeHinh;
  ten_loai_xe: string;
  bien_so: string;
  ngay_kiem_tra: string;
  ty_le_mm: number;
  mau_ve: string;
  hinh: Record<GocNhin, HinhGoc>;
  giay: { so: string; bien_so: string; co_gia_tri_den: string; thong_so: ThongSoKyThuat };
}

export interface KhungKhoanh {
  goc: GocNhin;
  hop: Hop;
  dong: DongThongSo | null;
}
export interface TraLoiSoiXe {
  khung: KhungKhoanh[];
  dau: DauSoiXe;
}

export interface ChiTietSoiXe {
  dau: DauSoiXe;
  dau_dung: DauSoiXe;
  diem_khoanh: number;
  diem_khoanh_toi_da: number;
  diem_dau: number;
  cho_sai: Array<Omit<ChoSai, "bien_doi"> & { khung: number | null; noi_dung: boolean }>;
  /** Chỉ số khung: khoanh nhầm (gồm khung quá lớn), khoanh trùng. */
  khung_nham: number[];
  khung_qua_lon: number[];
  khung_trung: number[];
  bien_ban: DongBienBan[];
}

/* ------------------------------------------------------------------ */
/* Hình học                                                            */
/* ------------------------------------------------------------------ */

const dienTich = (h: Hop) => Math.max(0, h[2] - h[0]) * Math.max(0, h[3] - h[1]);
const giao = (a: Hop, b: Hop) =>
  dienTich([Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])]);

/** Tỷ lệ giao trên hợp của hai hộp (khác `tyLePhu` của mo-phong/camera.ts). */
export function iou(a: Hop, b: Hop): number {
  const g = giao(a, b);
  const h = dienTich(a) + dienTich(b) - g;
  return h > 0 ? g / h : 0;
}

/** Phần diện tích của `a` nằm trong `b`. */
export const tyLeTrong = (a: Hop, b: Hop) => (dienTich(a) > 0 ? giao(a, b) / dienTich(a) : 0);

/* ------------------------------------------------------------------ */
/* Đáp án                                                              */
/* ------------------------------------------------------------------ */

const mm = (n: number) => `${n.toLocaleString("vi-VN")} mm`;

function moTaChoSai(b: BienTheCaiTao, t: ThamSoBienDoi, x: ThamSoXe, giay: ThongSoKyThuat): string {
  switch (b.bien_doi) {
    case "doi_mau_son":
      return `Giấy ghi màu ${giay.mau_son}; xe sơn màu ${MAU_SON[t.mau ?? x.mau][0]}.`;
    case "den_noc":
      return `Giấy ghi ${giay.den}; trên nóc xe lắp thêm dàn đèn.`;
    case "ong_xa_do":
      return `Ống xả thay mới nhô ra sau thân xe, vượt kích thước bao ghi trên giấy (dài ${mm(giay.kich_thuoc_bao.dai_mm)}).`;
    case "lop_khac_co":
      return `Giấy ghi cỡ lốp ${giay.co_lop} (đường kính khoảng ${mm(x.lop.duong_kinh_mm)}); bánh xe thực tế đường kính ${mm(t.duong_kinh_mm ?? 0)}.`;
    case "thung_cao_them":
      return `Giấy ghi chiều cao lòng thùng ${mm(x.thung!.cao_mm)}; thùng thực tế cao ${mm(x.thung!.cao_mm + (t.them_mm ?? 0))}.`;
    case "thung_dai_them":
      return `Giấy ghi chiều dài lòng thùng ${mm(x.thung!.dai_mm)}; thùng thực tế dài ${mm(x.thung!.dai_mm + (t.them_mm ?? 0))}.`;
    case "them_ghe":
      return `Giấy ghi ${giay.so_cho} người; khoang hành lý phía sau lắp thêm ghế.`;
  }
}

/** Các chỗ sai của xe theo danh mục; null khi có biến thể chưa có trong danh mục đã duyệt hoặc không hợp loại xe. */
export function choSaiCuaXe(
  x: XeCaiTao,
  danhMuc: readonly BienTheCaiTao[],
): { cho_sai: ChoSai[]; than: Record<GocNhin, Hop>; bien_the: BienTheCaiTao[] } | null {
  const bt: BienTheCaiTao[] = [];
  for (const b of x.bien_the) {
    const m = danhMuc.find((d) => d.ma === b.ma);
    if (!m?.loai_xe.includes(x.xe.loai)) return null;
    bt.push(m);
  }
  const bienDoi: BienDoi[] = x.bien_the.map((b, i) => ({ kieu: bt[i]!.bien_doi, tham_so: b.tham_so }));
  const h = dungHinhXe(x.xe, bienDoi);
  const giay = thongSoTuXe(x.xe);
  return {
    bien_the: bt,
    than: h.than,
    cho_sai: bt.map((m, i) => ({
      ma: m.ma,
      ten: m.ten,
      dong: m.dong,
      bien_doi: m.bien_doi,
      mo_ta: moTaChoSai(m, x.bien_the[i]!.tham_so, x.xe, giay),
      vung: h.vung[i]!,
      can_cu: m.can_cu,
      giai_thich: m.giai_thich,
    })),
  };
}

/** Màn nhỏ nhất xe vào được: màn đầu của mọi biến thể; thùng cơi nới chỉ đo mới thấy thì màn 5. */
export function manToiThieu(x: XeCaiTao, danhMuc: readonly BienTheCaiTao[]): number {
  let m = 1;
  for (const b of x.bien_the) {
    const d = danhMuc.find((y) => y.ma === b.ma);
    m = Math.max(m, d?.man_tu ?? SO_MAN_SOI_XE);
    if (d?.bien_doi === "thung_cao_them" && (b.tham_so.them_mm ?? 0) < CAO_THEM_THAY_BANG_MAT_MM)
      m = SO_MAN_SOI_XE;
  }
  return m;
}

export function xeSoiDungDuocOMan(n: NguonSoiXe, man: number): boolean {
  const m = ganMan(man);
  return n.muc <= m && manToiThieu(n.xe, n.danh_muc) <= m && choSaiCuaXe(n.xe, n.danh_muc) !== null;
}

/* ------------------------------------------------------------------ */
/* Chấm khung                                                          */
/* ------------------------------------------------------------------ */

/**
 * Ghép khung với chỗ sai: cặp (khung, chỗ sai) có điểm khớp ≥ ngưỡng, lấy cặp khớp nhất trước; mỗi khung và
 * mỗi chỗ sai dùng một lần. Khung quá lớn không ghép. Trả chỉ số khung của từng chỗ sai (null: bỏ sót), khung
 * trùng (khớp một chỗ đã có khung), khung nhầm.
 */
export function ghepKhung(
  b: Pick<BuocSoiXe, "cho_sai" | "than">,
  khung: readonly KhungKhoanh[],
  kho: Record<GocNhin, { rong: number; cao: number }>,
) {
  const quaLon = khung
    .map((k, i) => (dienTich(k.hop) > TY_LE_KHUNG_TOI_DA * kho[k.goc].rong * kho[k.goc].cao ? i : -1))
    .filter((i) => i >= 0);
  const diem = (k: KhungKhoanh, c: ChoSai) => {
    if (c.bien_doi === "doi_mau_son") {
      const t = tyLeTrong(k.hop, b.than[k.goc]);
      return t >= 0.5 ? t : 0;
    }
    return Math.max(0, ...c.vung.filter((v) => v.goc === k.goc).map((v) => iou(k.hop, v.hop)));
  };
  const cap: Array<[number, number, number]> = [];
  khung.forEach((k, i) => {
    if (quaLon.includes(i)) return;
    b.cho_sai.forEach((c, j) => {
      const d = diem(k, c);
      if (d >= NGUONG_IOU) cap.push([d, i, j]);
    });
  });
  cap.sort((a, c) => c[0] - a[0] || a[1] - c[1] || a[2] - c[2]);
  const cuaCho: Array<number | null> = b.cho_sai.map(() => null);
  const daDung = new Set<number>();
  for (const [, i, j] of cap) {
    if (daDung.has(i) || cuaCho[j] !== null) continue;
    cuaCho[j] = i;
    daDung.add(i);
  }
  const khopDuoc = new Set(cap.map(([, i]) => i));
  const trung = khung.map((_, i) => i).filter((i) => !daDung.has(i) && khopDuoc.has(i));
  const nham = khung.map((_, i) => i).filter((i) => !daDung.has(i) && !khopDuoc.has(i));
  return { cuaCho, trung, nham, quaLon };
}

/* ------------------------------------------------------------------ */
/* Định nghĩa trò                                                      */
/* ------------------------------------------------------------------ */

function dungBuoc(n: NguonSoiXe, thuTu: number, man: number): BuocLuot<BuocSoiXe> {
  const d = choSaiCuaXe(n.xe, n.danh_muc)!;
  return {
    thu_tu: thuTu,
    ref_kind: "game_content",
    ref_id: n.id,
    ref_version: n.version,
    topic_id: n.topic_id,
    diem_toi_da: (DIEM_KHOANH_SX + DIEM_NOI) * d.cho_sai.length + DIEM_DAU_SX,
    noi_dung: {
      man,
      xe: n.xe,
      cho_sai: d.cho_sai,
      than: d.than,
      dau: d.cho_sai.length ? "khong_dat" : "dat",
      bien_ban: d.cho_sai.map((c, i) =>
        dongBienBan({
          hanhVi: c.ten,
          chiTiet: `Xe ${n.xe.bien_so}: ${c.mo_ta}`,
          canCu: [c.can_cu],
          maMucPhat: d.bien_the[i]!.ma_muc_phat,
          mucPhat: n.muc_phat,
        }),
      ),
    },
  };
}

const khoHinh = (x: XeCaiTao, bienDoi: BienDoi[]) => {
  const h = dungHinhXe(x.xe, bienDoi).hinh;
  return { nghieng: { rong: h.nghieng.rong, cao: h.nghieng.cao }, sau: { rong: h.sau.rong, cao: h.sau.cao } };
};
const bienDoiCua = (b: BuocSoiXe): BienDoi[] =>
  b.cho_sai.map((c, i) => ({ kieu: c.bien_doi, tham_so: b.xe.bien_the[i]!.tham_so }));

export const TRO_CHOI_SOI_XE_CAI_TAO: DinhNghiaTroChoi<BuocSoiXe, DeSoiXe, TraLoiSoiXe> = {
  ma: MA_SOI_XE_CAI_TAO,
  ten: "Soi xe cải tạo",
  moTa: "Khoanh chỗ xe khác giấy chứng nhận kiểm định, nối với dòng thông số, đo bằng thước khi cần, đóng dấu Đạt hoặc Không đạt.",
  offline: true,
  nguon: "soi_xe_cai_tao_xe",
  // Số xe tối thiểu để bắt đầu; số xe mỗi lượt theo màn ở SO_XE_THEO_MAN_SX.
  soBuoc: SO_XE_THEO_MAN_SX[1]!,
  thoiGian: null,
  thuongNhanh: false,
  xpCoBan: 10,
  manChoi: MAN_SOI_XE,

  locNguon(nguon) {
    // Nguồn đã qua bộ kiểm dạng đầy đủ ở máy chủ (soi-xe-cai-tao-kiem.ts); ở đây chỉ kiểm khung.
    return (nguon as NguonSoiXe[]).filter(
      (n) =>
        n?.xe?.xe && Array.isArray(n.xe.bien_the) && Array.isArray(n.danh_muc) && Number.isInteger(n.muc),
    );
  },

  taoLuot(nguon, rng, man) {
    const m = ganMan(man);
    const soXe = SO_XE_THEO_MAN_SX[m] ?? this.soBuoc;
    // Sắp theo id trước khi trộn: lượt chỉ phụ thuộc tập nguồn, seed và màn.
    const dung = tron(
      (this.locNguon(nguon) as NguonSoiXe[])
        .filter((n) => xeSoiDungDuocOMan(n, m))
        .sort((a, b) => a.id.localeCompare(b.id)),
      rng,
    );
    const pool = [...dung.filter((n) => n.muc === m), ...dung.filter((n) => n.muc !== m)];
    const chon: NguonSoiXe[] = [];
    const lay = (dk: (n: NguonSoiXe) => boolean, soLuong: number) => {
      for (const n of pool) {
        if (soLuong <= 0 || chon.length >= soXe) return;
        if (!chon.includes(n) && dk(n)) {
          chon.push(n);
          soLuong--;
        }
      }
    };
    // Từ màn 2: ít nhất một xe đạt (nếu đủ nguồn). Còn lại ưu tiên xe đúng màn.
    if (m >= 2) lay((n) => n.xe.bien_the.length === 0, 1);
    lay((n) => n.xe.bien_the.length > 0, soXe);
    lay(() => true, soXe);
    return tron(chon, rng).map((n, i) => dungBuoc(n, i + 1, m));
  },

  deChoNguoiChoi(buoc) {
    const { man, xe } = buoc.noi_dung;
    const h = dungHinhXe(xe.xe, bienDoiCua(buoc.noi_dung));
    return {
      man,
      loai_xe: xe.xe.loai,
      ten_loai_xe: TEN_LOAI_XE_HINH[xe.xe.loai],
      bien_so: xe.bien_so,
      ngay_kiem_tra: xe.ngay_kiem_tra,
      ty_le_mm: TY_LE_MM,
      mau_ve: h.mau_ve,
      hinh: h.hinh,
      giay: { ...xe.giay, bien_so: xe.bien_so, thong_so: thongSoTuXe(xe.xe) },
    };
  },

  docTraLoi(raw) {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    if (!(DAU_SOI_XE as readonly unknown[]).includes(r.dau)) return null;
    const ds = r.khung ?? [];
    if (!Array.isArray(ds) || ds.length > 2 * KHUNG_TOI_DA_MOI_HINH) return null;
    const khung: KhungKhoanh[] = [];
    for (const k of ds as Array<Record<string, unknown>>) {
      if (!k || (k.goc !== "nghieng" && k.goc !== "sau")) return null;
      const h = k.hop;
      if (!Array.isArray(h) || h.length !== 4 || !h.every((v) => Number.isInteger(v) && v >= 0 && v <= 3000))
        return null;
      if (h[2] <= h[0] || h[3] <= h[1]) return null;
      if (k.dong != null && !(DONG_THONG_SO as readonly unknown[]).includes(k.dong)) return null;
      khung.push({ goc: k.goc, hop: [h[0], h[1], h[2], h[3]], dong: (k.dong as DongThongSo) ?? null });
    }
    for (const g of ["nghieng", "sau"] as const)
      if (khung.filter((k) => k.goc === g).length > KHUNG_TOI_DA_MOI_HINH) return null;
    // Điểm, cờ đúng, vùng máy khách tự khai bị bỏ qua.
    return { khung, dau: r.dau as DauSoiXe };
  },

  chamBuoc(buoc, tl) {
    const b = buoc.noi_dung;
    const g = ghepKhung(b, tl.khung, khoHinh(b.xe, bienDoiCua(b)));
    const cho = b.cho_sai.map((c, j) => {
      const i = g.cuaCho[j] ?? null;
      const { bien_doi: _, ...con } = c;
      return { ...con, khung: i, noi_dung: i !== null && tl.khung[i]!.dong === c.dong };
    });
    const toiDa = (DIEM_KHOANH_SX + DIEM_NOI) * b.cho_sai.length;
    const diemKhoanh = Math.max(
      0,
      Math.min(
        toiDa,
        DIEM_KHOANH_SX * cho.filter((c) => c.khung !== null).length +
          DIEM_NOI * cho.filter((c) => c.noi_dung).length -
          TRU_KHOANH_NHAM_SX * g.nham.length,
      ),
    );
    const diemDau = tl.dau === b.dau ? DIEM_DAU_SX : 0;
    const diem = diemKhoanh + diemDau;
    const chiTiet: ChiTietSoiXe = {
      dau: tl.dau,
      dau_dung: b.dau,
      diem_khoanh: diemKhoanh,
      diem_khoanh_toi_da: toiDa,
      diem_dau: diemDau,
      cho_sai: cho,
      khung_nham: g.nham,
      khung_qua_lon: g.quaLon,
      khung_trung: g.trung,
      bien_ban: b.bien_ban,
    };
    const giai = b.cho_sai.length
      ? `Xe có ${b.cho_sai.length} chỗ khác giấy chứng nhận kiểm định: ${b.cho_sai.map((c) => `${c.ten.toLowerCase()} (${TEN_DONG_THONG_SO[c.dong].toLowerCase()})`).join("; ")}. Không đạt.`
      : "Xe đúng với giấy chứng nhận kiểm định. Đạt.";
    return {
      diem,
      diemToiDa: buoc.diem_toi_da,
      dung: diem >= buoc.diem_toi_da,
      chiTiet,
      giaiThich: giai,
      canCu: [
        ...new Set([...cho.map((c) => c.can_cu), ...b.bien_ban.flatMap((d) => d.can_cu)].filter(Boolean)),
      ],
    };
  },
};
