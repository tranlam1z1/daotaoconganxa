/**
 * AI của nhóm học cùng (docs/PLAN.md GĐ16d, docs/PROMPT_NHOM_HOC_CUNG.md mục 2.7): dựng đầu vào đã
 * ẩn danh và hậu kiểm tất định đầu ra. Không nhờ mô hình tự kiểm.
 *
 * - Đầu vào không có họ tên, tên đăng nhập, email, đơn vị, cấp bậc. Thành viên là `TV1…TVn`, mục là
 *   `M1…Mn` (đề xuất Đ15); bảng đối chiếu mã với người thật và tên mục chỉ ở máy chủ.
 * - Đầu ra chỉ nhắc mục, thành viên bằng mã. Máy chủ thay mã bằng tên SAU khi hậu kiểm đạt.
 * - Hậu kiểm loại đầu ra có mẫu viện dẫn (Điều, khoản, Nghị định, Thông tư, Luật, số hiệu, số
 *   tiền), có lỗi chặn của bộ kiểm hành văn (emoji, dấu chấm than, khẩu ngữ…; đề xuất Đ16), có mã
 *   không tồn tại, có số không có trong đầu vào (AI-2), sai hoán vị (AI-1), quá độ dài.
 */
import { coLoiChan, soatChu } from "./hanh-van.ts";
import type { LoaiMucNhom, TrangThaiMucNhom } from "./nhom-hoc.ts";

export const PROMPT_GOI_Y_THU_TU = "nhom-hoc/goi-y-thu-tu";
export const PROMPT_TOM_TAT_TIEN_DO = "nhom-hoc/tom-tat-tien-do";

export const GIOI_HAN_AI_NHOM = {
  /** AI-1: số lần gọi mô hình thật mỗi nhóm mỗi ngày (giờ Việt Nam). */
  goiYMoiNhomMoiNgay: 5,
  /** AI-2: số lần gọi mô hình thật mỗi người yêu cầu mỗi ngày. */
  tomTatMoiNguoiMoiNgay: 20,
  ghiChuToiDa: 300,
  cauNhanXet: { toiThieu: 3, toiDa: 5 },
  /** Độ dài tối đa một câu nhận xét của AI-2. */
  cauToiDa: 300,
  mucCanChuYToiDa: 5,
  hetGioMs: 20_000,
} as const;

export const CANH_BAO_TOM_TAT = "Tóm tắt do AI soạn từ số liệu trong bảng dưới đây, cần đối chiếu với bảng.";
export const THONG_BAO_KHONG_GOI_Y = "Hệ thống chưa gợi ý được thứ tự cho nhóm này.";
export const THONG_BAO_CHUA_BAT_AI = "Chức năng gợi ý bằng AI chưa được bật.";

/* ------------------------------------------------------------------ */
/* Đầu vào                                                              */
/* ------------------------------------------------------------------ */

/** Mã giả -> thứ thật, giữ ở máy chủ. */
export type BangMa = Map<string, { loai: "thanh_vien" | "muc"; id: string; ten: string }>;

const MS_NGAY = 86_400_000;
const ngayCach = (tu: Date, den: Date) => Math.max(0, Math.floor((den.getTime() - tu.getTime()) / MS_NGAY));
/** Số ngày từ hôm nay tới hạn (âm là đã quá hạn); tính theo ngày giờ Việt Nam. */
function soNgayDenHan(han: string | null, now: Date): number | null {
  if (!han) return null;
  const homNay = new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
  return Math.round(
    (Date.parse(`${han.slice(0, 10)}T00:00:00Z`) - Date.parse(`${homNay}T00:00:00Z`)) / MS_NGAY,
  );
}

export interface MucNguon {
  id: string;
  ten: string;
  loai: LoaiMucNhom;
  chu_de: string | null;
  so_khoi: number | null;
  so_cau: number | null;
  so_phut: number | null;
  han_goi_y: string | null;
  trang_thai: TrangThaiMucNhom;
}

export interface DauVaoGoiYThuTu {
  muc: Array<{
    ma: string;
    ten: string;
    loai: LoaiMucNhom;
    chu_de: string | null;
    so_khoi: number | null;
    so_cau: number | null;
    so_phut: number | null;
    so_ngay_den_han: number | null;
  }>;
}

/** AI-1: mọi mục đang có theo thứ tự hiện tại, mã M1…Mn. Không có thông tin người. */
export function dungDauVaoGoiYThuTu(
  muc: readonly MucNguon[],
  now: Date,
): { dauVao: DauVaoGoiYThuTu; bang: BangMa } {
  const bang: BangMa = new Map();
  const dauVao: DauVaoGoiYThuTu = {
    muc: muc.map((m, i) => {
      const ma = `M${i + 1}`;
      bang.set(ma, { loai: "muc", id: m.id, ten: m.ten });
      return {
        ma,
        ten: m.ten,
        loai: m.loai,
        chu_de: m.chu_de,
        so_khoi: m.loai === "bai_hoc" ? m.so_khoi : null,
        so_cau: m.loai === "de_on_tap" ? m.so_cau : null,
        so_phut: m.loai === "bai_hoc" ? m.so_phut : null,
        so_ngay_den_han: soNgayDenHan(m.han_goi_y, now),
      };
    }),
  };
  return { dauVao, bang };
}

export interface ThanhVienNguon {
  id: string;
  ho_ten: string;
  phan_tram: number | null;
  muc: Record<string, number | null>;
  lan_hoc_gan_nhat: Date | string | null;
}

export interface DauVaoTomTat {
  so_thanh_vien: number;
  trung_binh_nhom: number | null;
  so_thanh_vien_chua_bat_dau: number;
  muc: Array<{
    ma: string;
    ten: string;
    loai: LoaiMucNhom;
    so_ngay_den_han: number | null;
    so_nguoi_hoan_thanh: number;
    ty_le_hoan_thanh: number;
  }>;
  thanh_vien: Array<{
    ma: string;
    phan_tram_chung: number | null;
    phan_tram_tung_muc: Record<string, number>;
    so_ngay_tu_lan_hoc_gan_nhat: number | null;
  }>;
}

/**
 * AI-2: số liệu của thành viên TRONG PHẠM VI (nơi gọi đã lọc), mã TV1…TVn, mục M1…Mn. Chỉ mục được
 * tính vào tiến độ. Số tổng hợp tính sẵn (trung bình, tỷ lệ hoàn thành từng mục, số người chưa bắt
 * đầu) để mô hình không phải tự tính số mới (đề xuất Đ15).
 */
export function dungDauVaoTomTat(
  p: { muc: readonly MucNguon[]; thanhVien: readonly ThanhVienNguon[]; trungBinh: number | null },
  now: Date,
): { dauVao: DauVaoTomTat; bang: BangMa } {
  const bang: BangMa = new Map();
  const muc = p.muc.filter((m) => m.trang_thai === "tinh");
  const maMuc = new Map(muc.map((m, i) => [m.id, `M${i + 1}`]));
  for (const m of muc) bang.set(maMuc.get(m.id)!, { loai: "muc", id: m.id, ten: m.ten });
  const thanhVien = p.thanhVien.map((t, i) => {
    const ma = `TV${i + 1}`;
    bang.set(ma, { loai: "thanh_vien", id: t.id, ten: t.ho_ten });
    const tungMuc: Record<string, number> = {};
    for (const m of muc) tungMuc[maMuc.get(m.id)!] = t.muc[m.id] ?? 0;
    return {
      ma,
      phan_tram_chung: t.phan_tram,
      phan_tram_tung_muc: tungMuc,
      so_ngay_tu_lan_hoc_gan_nhat: t.lan_hoc_gan_nhat ? ngayCach(new Date(t.lan_hoc_gan_nhat), now) : null,
    };
  });
  const n = thanhVien.length;
  const dauVao: DauVaoTomTat = {
    so_thanh_vien: n,
    trung_binh_nhom: p.trungBinh,
    so_thanh_vien_chua_bat_dau: thanhVien.filter((t) =>
      Object.values(t.phan_tram_tung_muc).every((v) => v === 0),
    ).length,
    muc: muc.map((m) => {
      const ma = maMuc.get(m.id)!;
      const xong = thanhVien.filter((t) => t.phan_tram_tung_muc[ma] === 100).length;
      return {
        ma,
        ten: m.ten,
        loai: m.loai,
        so_ngay_den_han: soNgayDenHan(m.han_goi_y, now),
        so_nguoi_hoan_thanh: xong,
        ty_le_hoan_thanh: n ? Math.floor((xong / n) * 100) : 0,
      };
    }),
    thanh_vien: thanhVien,
  };
  return { dauVao, bang };
}

/* ------------------------------------------------------------------ */
/* Hậu kiểm                                                             */
/* ------------------------------------------------------------------ */

export type HauKiemAiNhom<T> = { dat: true; ket_qua: T } | { dat: false; ly_do: string };

const MAU_VIEN_DAN: ReadonlyArray<[RegExp, string]> = [
  [/Điều\s*\d/iu, "Điều kèm số"],
  [/(^|[^\p{L}])khoản([^\p{L}]|$)/iu, "khoản"],
  [/Nghị\s+định/iu, "Nghị định"],
  [/Thông\s+tư/iu, "Thông tư"],
  [/(^|[^\p{L}])Luật([^\p{L}]|$)/u, "Luật"],
  [/\d+\s*\/\s*\d{4}/u, "số hiệu văn bản"],
  [/\d[\d.,]*\s*(đồng|đ|VNĐ|VND|nghìn|ngàn|triệu|tỷ)(?![\p{L}])/iu, "số tiền"],
];

const MA = /\b(?:TV|M)\d+\b/g;

/** Các số (dạng chuỗi chuẩn) có trong đầu vào: chỉ lấy giá trị kiểu số, không lấy chữ số trong chuỗi. */
export function soTrongDauVao(v: unknown, ra: Set<string> = new Set()): Set<string> {
  if (typeof v === "number" && Number.isFinite(v)) ra.add(String(v));
  else if (Array.isArray(v)) for (const x of v) soTrongDauVao(x, ra);
  else if (v && typeof v === "object") for (const x of Object.values(v)) soTrongDauVao(x, ra);
  return ra;
}

/**
 * Kiểm một đoạn chữ của mô hình. Trả lý do loại, hoặc null khi đạt.
 * `soHopLe` có thì mọi con số (trừ chữ số nằm trong mã TVn, Mn) phải thuộc tập này.
 */
export function kiemChuAi(
  chu: string,
  o: { maHopLe: ReadonlySet<string>; tenMuc: readonly string[]; soHopLe?: ReadonlySet<string> },
): string | null {
  for (const [re, ten] of MAU_VIEN_DAN) if (re.test(chu)) return `Có mẫu viện dẫn: ${ten}.`;
  const loiHanhVan = soatChu(chu).filter((l) => l.muc === "loi");
  if (coLoiChan(loiHanhVan)) return `Không qua bộ kiểm hành văn: ${loiHanhVan.map((l) => l.ma).join(", ")}.`;
  for (const ma of chu.match(MA) ?? []) if (!o.maHopLe.has(ma)) return `Mã không tồn tại: ${ma}.`;
  // Đề xuất Đ15: nhắc mục bằng mã, không chép tên mục.
  const thuong = chu.toLocaleLowerCase("vi");
  for (const ten of o.tenMuc) {
    if (ten.length >= 8 && thuong.includes(ten.toLocaleLowerCase("vi")))
      return "Chép tên mục thay vì dùng mã mục.";
  }
  if (o.soHopLe) {
    for (const so of chu.replace(MA, " ").match(/\d+(?:[.,]\d+)?/g) ?? []) {
      if (!o.soHopLe.has(String(Number(so.replace(",", "."))))) return `Số không có trong dữ liệu: ${so}.`;
    }
  }
  return null;
}

const laChuoi = (v: unknown): v is string => typeof v === "string";

/** AI-1: `thu_tu` là hoán vị đúng các mã mục đầu vào; `ghi_chu` tối đa 300 ký tự và qua kiểm chữ. */
export function hauKiemGoiYThuTu(
  json: unknown,
  dauVao: DauVaoGoiYThuTu,
): HauKiemAiNhom<{ thu_tu: string[]; ghi_chu: string }> {
  const o = json as { thu_tu?: unknown; ghi_chu?: unknown } | null;
  if (!o || typeof o !== "object") return { dat: false, ly_do: "Không đọc được JSON." };
  if (!Array.isArray(o.thu_tu) || !o.thu_tu.every(laChuoi)) return { dat: false, ly_do: "Thiếu thu_tu." };
  const ma = dauVao.muc.map((m) => m.ma);
  const thuTu = o.thu_tu;
  if (new Set(thuTu).size !== thuTu.length) return { dat: false, ly_do: "thu_tu có mã lặp." };
  if (thuTu.length !== ma.length || ma.some((x) => !thuTu.includes(x))) {
    return { dat: false, ly_do: "thu_tu không phải hoán vị đúng các mã mục." };
  }
  const ghiChu = laChuoi(o.ghi_chu) ? o.ghi_chu.trim() : "";
  if (ghiChu.length > GIOI_HAN_AI_NHOM.ghiChuToiDa) {
    return { dat: false, ly_do: `ghi_chu dài quá ${GIOI_HAN_AI_NHOM.ghiChuToiDa} ký tự.` };
  }
  const loi = kiemChuAi(ghiChu, { maHopLe: new Set(ma), tenMuc: dauVao.muc.map((m) => m.ten) });
  if (loi) return { dat: false, ly_do: loi };
  return { dat: true, ket_qua: { thu_tu: thuTu, ghi_chu: ghiChu } };
}

/**
 * AI-2: 3–5 câu nhận xét, danh sách mục cần chú ý bằng mã. Mọi con số có trong đầu vào, mọi mã
 * TVn, Mn tồn tại, không mẫu viện dẫn, qua kiểm chữ.
 */
export function hauKiemTomTat(
  json: unknown,
  dauVao: DauVaoTomTat,
): HauKiemAiNhom<{ nhan_xet: string[]; muc_can_chu_y: string[] }> {
  const o = json as { nhan_xet?: unknown; muc_can_chu_y?: unknown } | null;
  if (!o || typeof o !== "object") return { dat: false, ly_do: "Không đọc được JSON." };
  if (!Array.isArray(o.nhan_xet) || !o.nhan_xet.every(laChuoi))
    return { dat: false, ly_do: "Thiếu nhan_xet." };
  const nhanXet = o.nhan_xet.map((c) => c.trim()).filter(Boolean);
  const { toiThieu, toiDa } = GIOI_HAN_AI_NHOM.cauNhanXet;
  if (nhanXet.length < toiThieu || nhanXet.length > toiDa) {
    return { dat: false, ly_do: `nhan_xet cần ${toiThieu}–${toiDa} câu, có ${nhanXet.length}.` };
  }
  const maMuc = new Set(dauVao.muc.map((m) => m.ma));
  const maHopLe = new Set([...maMuc, ...dauVao.thanh_vien.map((t) => t.ma)]);
  const soHopLe = soTrongDauVao(dauVao);
  const tenMuc = dauVao.muc.map((m) => m.ten);
  for (const cau of nhanXet) {
    if (cau.length > GIOI_HAN_AI_NHOM.cauToiDa) return { dat: false, ly_do: "Có câu nhận xét quá dài." };
    const loi = kiemChuAi(cau, { maHopLe, tenMuc, soHopLe });
    if (loi) return { dat: false, ly_do: loi };
  }
  const canChuY = Array.isArray(o.muc_can_chu_y) ? o.muc_can_chu_y : [];
  if (!canChuY.every(laChuoi) || canChuY.length > GIOI_HAN_AI_NHOM.mucCanChuYToiDa) {
    return { dat: false, ly_do: "muc_can_chu_y sai dạng." };
  }
  if (new Set(canChuY).size !== canChuY.length || canChuY.some((m) => !maMuc.has(m))) {
    return { dat: false, ly_do: "muc_can_chu_y có mã lặp hoặc không tồn tại." };
  }
  return { dat: true, ket_qua: { nhan_xet: nhanXet, muc_can_chu_y: canChuY } };
}

/** Thay mã bằng tên thật sau khi hậu kiểm đạt: thành viên thành họ tên, mục thành “tên mục”. */
export function thayMa(chu: string, bang: BangMa): string {
  return chu.replace(MA, (ma) => {
    const x = bang.get(ma);
    if (!x) return ma;
    return x.loai === "muc" ? `“${x.ten}”` : x.ten;
  });
}
