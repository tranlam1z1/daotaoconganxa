/**
 * Trò "Súng bắn tốc độ" (docs/PLAN.md GĐ-G2, docs/GAME_DESIGN.md §5.2).
 *
 * Mỗi bước là một xe đi qua chốt: loại xe, bối cảnh, biển hạn chế tốc độ P.127 (số trên biển) và
 * tốc độ đo được. Người chơi trả lời ba câu nhỏ trong 12 giây:
 *   1. Có bị xử phạt vì chạy quá tốc độ không? (3 điểm)
 *   2. Nếu có: khung tốc độ vượt nào? (4 điểm)
 *   3. Hình thức xử phạt bổ sung, trừ điểm giấy phép lái xe? (3 điểm)
 * Sai câu 1 thì xe đó 0 điểm. Xe không bị xử phạt mà trả lời đúng "Không": đủ 10 điểm.
 *
 * Tình huống (xe) do người soạn, lưu ở `game_content` và qua duyệt. Tình huống CHỈ có dữ kiện; đáp
 * án suy ra từ các dòng mức phạt theo tốc độ đã duyệt của loại xe đó, bằng cùng hàm khớp khoảng với
 * tra cứu tốc độ GĐ5. Tốc độ tối đa lấy từ số trên biển P.127 của tình huống (GAME_DESIGN §7 câu
 * Q6: chưa có văn bản quy định tốc độ theo loại đường trong kho).
 */

import { tron } from "../de-thi.ts";
import type { LoaiXe } from "../tra-cuu-nhanh.ts";
import {
  type KhoangTocDo,
  LOAI_XE,
  moTaKhoang,
  TEN_LOAI_XE,
  timTheoTocDo,
  tocDoVuot,
} from "../tra-cuu-nhanh.ts";
import type { BuocLuot, DinhNghiaTroChoi } from "./khung.ts";

export const MA_SUNG_BAN_TOC_DO = "sung_ban_toc_do";
export const DIEM_CAU_VI_PHAM = 3;
export const DIEM_CAU_KHUNG = 4;
export const DIEM_CAU_BO_SUNG = 3;
export const DIEM_MOI_XE = DIEM_CAU_VI_PHAM + DIEM_CAU_KHUNG + DIEM_CAU_BO_SUNG;
export const SO_XE_MOI_LUOT = 10;
/** Mỗi lượt cố gắng có ít nhất số xe không bị xử phạt này (nếu nguồn đủ). */
export const SO_XE_KHONG_VI_PHAM_TOI_THIEU = 2;
export const GIAY_MOI_XE = 12;

/* ------------------------------------------------------------------ */
/* Dữ liệu                                                             */
/* ------------------------------------------------------------------ */

/** Dữ kiện của một tình huống (game_content.payload). */
export interface TinhHuongTocDo {
  loai_xe: LoaiXe;
  /** Mô tả ngắn chiếc xe, ví dụ "Xe ô tô con màu trắng". */
  mo_ta_xe: string;
  /** Bối cảnh, ví dụ "Quốc lộ, đoạn có biển hạn chế tốc độ". */
  boi_canh: string;
  /** Số ghi trên biển P.127 (km/h). */
  bien_toc_do: number;
  /** Tốc độ súng bắn tốc độ đo được (km/h). */
  toc_do_do: number;
}

/** Một khung mức phạt theo tốc độ đã duyệt (dòng `violations` có khoảng tốc độ). */
export interface KhungPhatTocDo {
  ma: string;
  version: number;
  toc_do_vuot: KhoangTocDo;
  phat_tu: number;
  phat_den: number;
  tru_diem: number | null;
  hinh_thuc_bo_sung: string[];
  can_cu: string;
}

/** Một nguồn của trò: tình huống đã duyệt kèm các khung phạt đã duyệt của loại xe đó. */
export interface NguonSungBan {
  id: string;
  code: string;
  version: number;
  topic_id: string | null;
  tinh_huong: TinhHuongTocDo;
  khung: KhungPhatTocDo[];
}

export interface DapAnSungBan {
  vi_pham: boolean;
  vuot: number;
  khung_ma: string | null;
  bo_sung_ma: string | null;
}

export interface LuaChon {
  id: string;
  text: string;
}

/** Nội dung một bước trong ảnh chụp của lượt (có đáp án, chỉ máy chủ và gói offline giữ). */
export interface BuocSungBan {
  tinh_huong: TinhHuongTocDo;
  khung: KhungPhatTocDo[];
  lua_chon_khung: LuaChon[];
  lua_chon_bo_sung: LuaChon[];
  dap_an: DapAnSungBan;
}

/** Phần đề gửi người chơi: dữ kiện và các lựa chọn, không có mức tiền hay đáp án. */
export interface DeSungBan {
  loai_xe: LoaiXe;
  ten_loai_xe: string;
  mo_ta_xe: string;
  boi_canh: string;
  bien_toc_do: number;
  toc_do_do: number;
  lua_chon_khung: LuaChon[];
  lua_chon_bo_sung: LuaChon[];
}

export interface TraLoiSungBan {
  /** null: hết giờ mà chưa chọn. */
  vi_pham: boolean | null;
  khung?: string | null;
  bo_sung?: string | null;
}

/* ------------------------------------------------------------------ */
/* Kiểm tra tình huống                                                 */
/* ------------------------------------------------------------------ */

/** Kiểm dữ kiện một tình huống. Trả danh sách lỗi; rỗng là hợp lệ. */
export function kiemTraTinhHuongTocDo(p: Partial<TinhHuongTocDo> | null | undefined): string[] {
  const loi: string[] = [];
  if (!p || typeof p !== "object") return ["Thiếu dữ kiện tình huống."];
  if (!(LOAI_XE as readonly string[]).includes(p.loai_xe as string))
    loi.push("loai_xe phải là o_to hoặc mo_to.");
  if (typeof p.mo_ta_xe !== "string" || p.mo_ta_xe.trim().length < 3) loi.push("Thiếu mô tả xe.");
  if (typeof p.boi_canh !== "string" || p.boi_canh.trim().length < 3) loi.push("Thiếu bối cảnh.");
  if (!Number.isInteger(p.bien_toc_do) || (p.bien_toc_do ?? 0) < 5 || (p.bien_toc_do ?? 0) > 150)
    loi.push("Số trên biển P.127 phải là số nguyên từ 5 đến 150 km/h.");
  if (
    typeof p.toc_do_do !== "number" ||
    !Number.isFinite(p.toc_do_do) ||
    p.toc_do_do < 0 ||
    p.toc_do_do > 300
  )
    loi.push("Tốc độ đo được phải từ 0 đến 300 km/h.");
  return loi;
}

/* ------------------------------------------------------------------ */
/* Suy đáp án                                                          */
/* ------------------------------------------------------------------ */

/** Khóa của một tổ hợp hình thức bổ sung và trừ điểm; cũng là id lựa chọn ở câu 3. */
export function khoaBoSung(k: Pick<KhungPhatTocDo, "tru_diem" | "hinh_thuc_bo_sung"> | null): string {
  if (!k) return "khong";
  const phan = [...k.hinh_thuc_bo_sung]
    .map((s) => s.trim())
    .filter(Boolean)
    .sort();
  if (!phan.length && !k.tru_diem) return "khong";
  return `bs|${k.tru_diem ?? 0}|${phan.join(";")}`;
}

export function moTaBoSung(k: Pick<KhungPhatTocDo, "tru_diem" | "hinh_thuc_bo_sung"> | null): string {
  if (khoaBoSung(k) === "khong") return "Không có hình thức bổ sung, không trừ điểm giấy phép lái xe";
  const phan = [...k!.hinh_thuc_bo_sung].map((s) => s.trim()).filter(Boolean);
  if (k!.tru_diem) phan.push(`trừ ${k!.tru_diem} điểm giấy phép lái xe`);
  const s = phan.join("; ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function moTaKhung(k: KhungPhatTocDo): string {
  return `Vượt ${moTaKhoang(k.toc_do_vuot)}`;
}

/**
 * Đáp án của một tình huống theo các khung phạt đã duyệt của loại xe đó.
 *
 * - Không vượt số trên biển, hoặc vượt ít hơn cận dưới của khung thấp nhất: không bị xử phạt.
 * - Vượt và rơi đúng một khung: bị xử phạt theo khung đó.
 * - Không có khung nào (thiếu khung đã duyệt ở giữa) hoặc rơi vào hai khung (dữ liệu chồng nhau):
 *   trả null, tình huống không dùng được cho tới khi dữ liệu đầy đủ.
 */
export function suyDapAnSungBan(t: TinhHuongTocDo, khung: readonly KhungPhatTocDo[]): DapAnSungBan | null {
  if (!khung.length) return null;
  const vuot = tocDoVuot(t.bien_toc_do, t.toc_do_do);
  const khop = timTheoTocDo(khung as KhungPhatTocDo[], vuot);
  if (khop.length > 1) return null;
  if (khop.length === 1) {
    return { vi_pham: true, vuot, khung_ma: khop[0]!.ma, bo_sung_ma: khoaBoSung(khop[0]!) };
  }
  const thapNhat = Math.min(...khung.map((k) => k.toc_do_vuot.tu));
  const duoiNguong =
    vuot < thapNhat || (vuot === thapNhat && khung.every((k) => k.toc_do_vuot.bien[0] === "("));
  if (vuot <= 0 || duoiNguong) return { vi_pham: false, vuot, khung_ma: null, bo_sung_ma: null };
  return null;
}

/* ------------------------------------------------------------------ */
/* Định nghĩa trò                                                      */
/* ------------------------------------------------------------------ */

function dungBuoc(n: NguonSungBan, thuTu: number, rng: () => number): BuocLuot<BuocSungBan> | null {
  const dapAn = suyDapAnSungBan(n.tinh_huong, n.khung);
  if (!dapAn) return null;
  const khung = [...n.khung].sort((a, b) => a.toc_do_vuot.tu - b.toc_do_vuot.tu);
  const boSung = new Map<string, string>([["khong", moTaBoSung(null)]]);
  for (const k of khung) boSung.set(khoaBoSung(k), moTaBoSung(k));
  return {
    thu_tu: thuTu,
    ref_kind: "game_content",
    ref_id: n.id,
    ref_version: n.version,
    topic_id: n.topic_id,
    diem_toi_da: DIEM_MOI_XE,
    noi_dung: {
      tinh_huong: n.tinh_huong,
      khung,
      // Khung giữ thứ tự từ thấp tới cao cho dễ đọc; câu 3 đảo thứ tự theo lượt.
      lua_chon_khung: khung.map((k) => ({ id: k.ma, text: moTaKhung(k) })),
      lua_chon_bo_sung: tron(
        [...boSung].map(([id, text]) => ({ id, text })),
        rng,
      ),
      dap_an: dapAn,
    },
  };
}

function giaiThich(b: BuocSungBan): string {
  const t = b.tinh_huong;
  const d = b.dap_an;
  const dau = `Biển giới hạn ${t.bien_toc_do} km/h, xe chạy ${t.toc_do_do} km/h`;
  if (!d.vi_pham) {
    return d.vuot > 0
      ? `${dau}: vượt ${d.vuot} km/h, chưa tới khung phạt thấp nhất nên không bị xử phạt về tốc độ.`
      : `${dau}: không vượt tốc độ cho phép.`;
  }
  const k = b.khung.find((x) => x.ma === d.khung_ma)!;
  return `${dau}: vượt ${d.vuot} km/h, thuộc khung ${moTaKhoang(k.toc_do_vuot)}; phạt tiền ${k.phat_tu.toLocaleString("vi-VN")}–${k.phat_den.toLocaleString("vi-VN")} đồng; ${moTaBoSung(k).charAt(0).toLowerCase()}${moTaBoSung(k).slice(1)}.`;
}

export const TRO_CHOI_SUNG_BAN_TOC_DO: DinhNghiaTroChoi<BuocSungBan, DeSungBan, TraLoiSungBan> = {
  ma: MA_SUNG_BAN_TOC_DO,
  ten: "Súng bắn tốc độ",
  moTa: "Xe đi qua chốt kèm biển hạn chế và tốc độ đo được. Xác định có bị phạt không, khung phạt nào, có trừ điểm không.",
  offline: true,
  nguon: "toc_do_tinh_huong",
  soBuoc: SO_XE_MOI_LUOT,
  thoiGian: { moiBuocMs: GIAY_MOI_XE * 1000 },
  thuongNhanh: true,
  xpCoBan: 20,

  locNguon(nguon) {
    return (nguon as NguonSungBan[]).filter(
      (n) =>
        kiemTraTinhHuongTocDo(n.tinh_huong).length === 0 && suyDapAnSungBan(n.tinh_huong, n.khung) !== null,
    );
  },

  taoLuot(nguon, rng) {
    // Sắp theo id trước khi trộn: lượt chỉ phụ thuộc tập nguồn và seed (máy chủ sinh lại lượt offline).
    const goc = tron(
      [...(this.locNguon(nguon) as NguonSungBan[])].sort((a, b) => a.id.localeCompare(b.id)),
      rng,
    );
    const khong = goc.filter((n) => !suyDapAnSungBan(n.tinh_huong, n.khung)!.vi_pham);
    const chon = khong.slice(0, SO_XE_KHONG_VI_PHAM_TOI_THIEU);
    for (const n of goc) {
      if (chon.length >= this.soBuoc) break;
      if (!chon.includes(n)) chon.push(n);
    }
    return tron(chon, rng)
      .map((n, i) => dungBuoc(n, i + 1, rng))
      .filter((b): b is BuocLuot<BuocSungBan> => b !== null);
  },

  deChoNguoiChoi(buoc) {
    const t = buoc.noi_dung.tinh_huong;
    return {
      loai_xe: t.loai_xe,
      ten_loai_xe: TEN_LOAI_XE[t.loai_xe],
      mo_ta_xe: t.mo_ta_xe,
      boi_canh: t.boi_canh,
      bien_toc_do: t.bien_toc_do,
      toc_do_do: t.toc_do_do,
      lua_chon_khung: buoc.noi_dung.lua_chon_khung,
      lua_chon_bo_sung: buoc.noi_dung.lua_chon_bo_sung,
    };
  },

  docTraLoi(raw) {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    if (r.vi_pham !== null && typeof r.vi_pham !== "boolean") return null;
    const chuoi = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.length <= 300);
    if (!chuoi(r.khung) || !chuoi(r.bo_sung)) return null;
    return {
      vi_pham: r.vi_pham as boolean | null,
      khung: (r.khung as string | null | undefined) ?? null,
      bo_sung: (r.bo_sung as string | null | undefined) ?? null,
    };
  },

  chamBuoc(buoc, traLoi) {
    const b = buoc.noi_dung;
    const d = b.dap_an;
    const cau1 = traLoi.vi_pham === d.vi_pham;
    const cau2 = cau1 && d.vi_pham ? traLoi.khung === d.khung_ma : cau1;
    const cau3 = cau1 && d.vi_pham ? traLoi.bo_sung === d.bo_sung_ma : cau1;
    const diem = !cau1
      ? 0
      : !d.vi_pham
        ? DIEM_MOI_XE
        : DIEM_CAU_VI_PHAM + (cau2 ? DIEM_CAU_KHUNG : 0) + (cau3 ? DIEM_CAU_BO_SUNG : 0);
    const k = d.khung_ma ? b.khung.find((x) => x.ma === d.khung_ma)! : null;
    return {
      diem,
      diemToiDa: buoc.diem_toi_da,
      dung: cau1 && cau2 && cau3,
      chiTiet: {
        cham: { vi_pham: cau1, khung: cau2, bo_sung: cau3 },
        dap_an: {
          vi_pham: d.vi_pham,
          vuot: d.vuot,
          khung: d.khung_ma,
          khung_text: k ? moTaKhung(k) : null,
          phat_tu: k?.phat_tu ?? null,
          phat_den: k?.phat_den ?? null,
          bo_sung: d.bo_sung_ma,
          bo_sung_text: k ? moTaBoSung(k) : null,
        },
      },
      giaiThich: giaiThich(b),
      canCu: k ? [k.can_cu] : [],
    };
  },
};
