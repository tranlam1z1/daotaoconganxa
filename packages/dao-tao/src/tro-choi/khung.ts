/**
 * Khung lượt chơi dùng chung cho mọi trò chơi (docs/GAME_DESIGN.md §2).
 *
 * Mỗi trò chỉ viết phần riêng dưới dạng một `DinhNghiaTroChoi`: sinh các bước của lượt từ nội dung
 * đã duyệt, dựng phần đề gửi người chơi, chấm một bước. Mọi thứ còn lại (vòng đời lượt, tính giờ,
 * thưởng nhanh, tổng kết, sao) nằm ở tệp này, dùng chung cho máy chủ và cho điện thoại khi offline.
 *
 * Hàm thuần: không chạm CSDL, không đọc đồng hồ (nhận `luc` làm tham số) để test được mọi mốc giờ.
 *
 * Màn chơi (GĐ-T1): trò có `manChoi` thì mỗi lượt thuộc một màn; `taoLuot` nhận số màn, giờ và XP
 * cơ bản lấy theo màn qua `dinhNghiaTheoMan`. Trò không có màn giữ nguyên hành vi.
 */
import type { CauHinhMan } from "./chung/man-choi.ts";

/** Dung sai độ trễ mạng cho hạn từng bước và hạn cả lượt. */
export const DUNG_SAI_BUOC_MS = 2_000;
/** Thưởng nhanh tối đa, tính theo phần điểm cơ bản của bước. */
export const THUONG_NHANH_TOI_DA = 0.5;
/** Ngưỡng tỷ lệ của 1, 2, 3 sao. */
export const NGUONG_SAO = [0.5, 0.7, 0.9] as const;

export type LoaiNguonBuoc =
  | "question"
  | "game_content"
  | "violation"
  | "traffic_sign"
  | "speed_limit"
  | "procedure"
  | "sinh";

/**
 * Tên nguồn nội dung một trò cần. Máy chủ lấy nguồn qua bảng `NGUON_TRO_CHOI` ở
 * packages/db/src/nguon-tro-choi.ts; thêm nguồn là thêm một tên ở đây và một dòng ở bảng đó.
 *  - `cau_hoi`: câu hỏi ngân hàng đã duyệt (GĐ-G0).
 *  - `toc_do_tinh_huong`: tình huống xe đã duyệt kèm khung phạt theo tốc độ đã duyệt (GĐ-G2).
 *  - `bien_bao_phan_ung`: biển báo đã duyệt có thao tác phản ứng (GĐ-G8).
 *  - `lap_bien_ban_tinh_huong`: tình huống lập biên bản đã duyệt kèm mức phạt đã duyệt (GĐ-G3).
 *  - `giay_to_ho_so`: hồ sơ người lái đã duyệt kèm luật giấy tờ và mức phạt đã duyệt (GĐ-T1).
 *  - `dung_xe_tinh_huong`: tình huống dừng xe đã duyệt kèm quy trình, luật giấy tờ, mức phạt đã duyệt (GĐ-T4).
 *  - `cam_bien_doan_duong`: đoạn đường đã duyệt kèm các biển đã duyệt có phản ứng trong khay (GĐ-T3).
 *  - `soi_camera_kich_ban`: kịch bản camera đã duyệt kèm mức phạt đã duyệt của các vi phạm (GĐ-T5).
 *  - `tu_lai_ban_do`: bản đồ khu phố đã duyệt kèm biển, bảng lỗi và mức phạt đã duyệt (GĐ-T9).
 *  - `phat_nguoi_ho_so`: hồ sơ phạt nguội đã duyệt kèm luật kiểm hồ sơ và mức phạt đã duyệt (GĐ-T11).
 *  - `tram_can_xe`: xe tải đã duyệt kèm giới hạn tải trọng và khung phần trăm quá tải đã duyệt (GĐ-T12).
 *  - `xe_khach_len_xe`: xe khách đã duyệt kèm luật vận tải hành khách và mức phạt đã duyệt (GĐ-T13).
 *  - `chot_dem_doan_duong`: đoạn đường ban đêm đã duyệt kèm bộ tiêu chí chấm đã duyệt (GĐ-T15).
 *  - `soi_xe_cai_tao_xe`: xe đã duyệt kèm danh mục biến thể cải tạo và mức phạt đã duyệt (GĐ-T14).
 *  - `truy_vet_vu`: vụ truy vết đã duyệt (bản đồ, camera, xe bỏ chạy, tin báo) (GĐ-T17).
 *  - `tai_dung_vu`: vụ va chạm đã duyệt (sơ đồ, dựng cảnh gốc, lỗi đúng) kèm mức phạt đã duyệt (GĐ-T10).
 */
export type NguonNoiDung =
  | "cau_hoi"
  | "game_content"
  | "toc_do_tinh_huong"
  | "bien_bao_phan_ung"
  | "lap_bien_ban_tinh_huong"
  | "giay_to_ho_so"
  | "dung_xe_tinh_huong"
  | "cam_bien_doan_duong"
  | "soi_camera_kich_ban"
  | "tu_lai_ban_do"
  | "phat_nguoi_ho_so"
  | "tram_can_xe"
  | "xe_khach_len_xe"
  | "chot_dem_doan_duong"
  | "soi_xe_cai_tao_xe"
  | "truy_vet_vu"
  | "tai_dung_vu";

/**
 * Một bước trong ảnh chụp của lượt. `noi_dung` có ĐÁP ÁN, chỉ máy chủ (hoặc gói offline) giữ;
 * người chơi chỉ nhận `deChoNguoiChoi(buoc)`.
 */
export interface BuocLuot<N = unknown> {
  thu_tu: number;
  ref_kind: LoaiNguonBuoc;
  ref_id: string | null;
  ref_version: number | null;
  topic_id: string | null;
  diem_toi_da: number;
  noi_dung: N;
}

/** Kết quả chấm một bước, chưa tính giờ. */
export interface KetQuaChamBuoc {
  diem: number;
  diemToiDa: number;
  /** null: bước không có đúng/sai (bước kể chuyện). */
  dung: boolean | null;
  /** Phần riêng của trò, gửi cho người chơi SAU khi chấm (đáp án đúng, chấm từng ô…). */
  chiTiet?: unknown;
  giaiThich: string | null;
  canCu: string[];
  /**
   * Thưởng nhanh do trò tự tính (trò không bật `thuongNhanh` chung, ví dụ thưởng theo từng biển của
   * Cung đường biển báo). Khung vẫn ép 0 khi lượt offline hoặc hết giờ (GĐ-G8).
   */
  thuong?: number;
}

/** Những gì khung đã biết lúc chấm, truyền xuống `chamBuoc` (GĐ-G8). */
export interface NguCanhCham {
  /** Thời gian từ lúc máy chủ mở đề tới lúc trả lời; null khi không biết (lượt offline, xem lại). */
  thoiGianMs: number | null;
  offline: boolean;
}

/** Kết quả chấm một bước sau khi áp luật giờ. */
export interface KetQuaBuoc extends KetQuaChamBuoc {
  /** Thưởng nhanh, cộng vào tổng điểm nhưng không vào tỷ lệ và sao. */
  thuong: number;
  hetGio: boolean;
  /** Thời gian từ lúc mở đề tới lúc trả lời; null khi không biết (lượt offline). */
  thoiGianMs: number | null;
}

export interface DinhNghiaTroChoi<N = unknown, De = unknown, TraLoi = unknown> {
  ma: string;
  ten: string;
  moTa: string;
  /** Có gói offline không. */
  offline: boolean;
  nguon: NguonNoiDung;
  /** Số bước của một lượt; nguồn ít hơn thì không bắt đầu được. */
  soBuoc: number;
  thoiGian: { moiBuocMs?: number; caLuotMs?: number } | null;
  thuongNhanh: boolean;
  /** XP cơ bản của một lượt đạt 100% (trước khi giảm theo số lượt trong ngày). */
  xpCoBan: number;
  /** Lọc nguồn dùng được cho trò (ví dụ chỉ câu một đáp án). */
  locNguon(nguon: readonly unknown[]): unknown[];
  /**
   * Màn chơi, đánh số từ 1 (GĐ-T1). Vắng: trò không có màn. Có màn thì giờ và XP cơ bản của lượt
   * lấy theo màn (`dinhNghiaTheoMan`), không theo `thoiGian`, `xpCoBan` ở trên.
   */
  manChoi?: readonly CauHinhMan[];
  /**
   * Sinh các bước của một lượt. Tất định theo (nguon, rng, man): máy chủ sinh lại được lượt
   * offline. `man` chỉ có ở trò có màn.
   */
  taoLuot(nguon: readonly unknown[], rng: () => number, man?: number): BuocLuot<N>[];
  /** Phần đề gửi cho người chơi: không đáp án, không giải thích. */
  deChoNguoiChoi(buoc: BuocLuot<N>): De;
  /** Đọc và kiểm dạng câu trả lời gửi lên; sai dạng trả null. */
  docTraLoi(raw: unknown): TraLoi | null;
  /** Chấm một bước, chưa tính giờ. `ngCanh` vắng khi không có thông tin giờ. */
  chamBuoc(buoc: BuocLuot<N>, traLoi: TraLoi, ngCanh?: NguCanhCham): KetQuaChamBuoc;
}

/* ------------------------------------------------------------------ */
/* Màn chơi                                                            */
/* ------------------------------------------------------------------ */

/** Cấu hình một màn của trò, hoặc undefined khi trò không có màn hay số màn không có. */
export function manCua(dn: Pick<DinhNghiaTroChoi, "manChoi">, man: number | null | undefined) {
  return man == null ? undefined : dn.manChoi?.find((m) => m.so === man);
}

/**
 * Định nghĩa trò áp theo màn: giờ và XP cơ bản của màn thay cho của trò. Trò không có màn (hoặc
 * lượt không có màn) thì trả nguyên định nghĩa.
 */
export function dinhNghiaTheoMan<T extends DinhNghiaTroChoi<any, any, any>>(
  dn: T,
  man: number | null | undefined,
): T {
  const m = manCua(dn, man);
  if (!m) return dn;
  const thoiGian =
    m.caLuotMs || m.moiBuocMs
      ? {
          ...(m.caLuotMs ? { caLuotMs: m.caLuotMs } : {}),
          ...(m.moiBuocMs ? { moiBuocMs: m.moiBuocMs } : {}),
        }
      : null;
  return Object.assign(Object.create(Object.getPrototypeOf(dn)), dn, {
    thoiGian,
    xpCoBan: m.xpCoBan ?? dn.xpCoBan,
  }) as T;
}

/* ------------------------------------------------------------------ */
/* Tính giờ                                                            */
/* ------------------------------------------------------------------ */

/** Hạn của một bước (chưa cộng dung sai), hoặc null khi trò không tính giờ từng bước. */
export function hanBuoc(dn: Pick<DinhNghiaTroChoi, "thoiGian">, moLuc: Date): Date | null {
  const ms = dn.thoiGian?.moiBuocMs;
  return ms ? new Date(moLuc.getTime() + ms) : null;
}

/** Mili giây còn lại của bước (không âm), hoặc null khi không tính giờ. */
export function conLaiBuocMs(dn: Pick<DinhNghiaTroChoi, "thoiGian">, moLuc: Date, luc: Date): number | null {
  const han = hanBuoc(dn, moLuc);
  return han ? Math.max(0, han.getTime() - luc.getTime()) : null;
}

/** Còn nhận trả lời theo hạn cả lượt không (hạn + dung sai). Không có hạn thì luôn nhận. */
export function conNhanTheoHanLuot(hanLuot: Date | null, luc: Date): boolean {
  return !hanLuot || luc.getTime() <= hanLuot.getTime() + DUNG_SAI_BUOC_MS;
}

/** Thưởng nhanh: tối đa THUONG_NHANH_TOI_DA × điểm tối đa, giảm tuyến tính theo thời gian đã dùng. */
export function thuongNhanh(diemToiDa: number, thoiGianMs: number, moiBuocMs: number): number {
  if (moiBuocMs <= 0 || diemToiDa <= 0) return 0;
  const conLai = Math.max(0, 1 - Math.max(0, thoiGianMs) / moiBuocMs);
  return Math.round(diemToiDa * THUONG_NHANH_TOI_DA * conLai * 10) / 10;
}

/**
 * Chấm một bước có áp luật giờ:
 *  - quá hạn bước + dung sai: 0 điểm, `hetGio`, lượt vẫn đi tiếp (không từ chối);
 *  - còn hạn và đúng hoàn toàn: cộng thưởng nhanh nếu trò có, trừ lượt offline (máy chủ không kiểm
 *    được đồng hồ của điện thoại);
 *  - trò tự tính thưởng (`KetQuaChamBuoc.thuong`, không bật `thuongNhanh` chung): lấy thưởng đó,
 *    cũng trừ lượt offline.
 */
export function chamBuocCoGio<N, TL>(
  dn: DinhNghiaTroChoi<N, unknown, TL>,
  buoc: BuocLuot<N>,
  traLoi: TL,
  opts: { moLuc: Date | null; luc: Date; offline: boolean },
): KetQuaBuoc {
  const moiBuocMs = dn.thoiGian?.moiBuocMs;
  const thoiGianMs =
    opts.offline || !opts.moLuc ? null : Math.max(0, opts.luc.getTime() - opts.moLuc.getTime());
  const goc = dn.chamBuoc(buoc, traLoi, { thoiGianMs, offline: opts.offline });
  if (moiBuocMs && thoiGianMs !== null && thoiGianMs > moiBuocMs + DUNG_SAI_BUOC_MS) {
    return { ...goc, diem: 0, dung: goc.dung === null ? null : false, thuong: 0, hetGio: true, thoiGianMs };
  }
  const thuong = dn.thuongNhanh
    ? moiBuocMs && thoiGianMs !== null && goc.dung && goc.diem >= goc.diemToiDa
      ? thuongNhanh(goc.diemToiDa, thoiGianMs, moiBuocMs)
      : 0
    : opts.offline
      ? 0
      : Math.max(0, goc.thuong ?? 0);
  return { ...goc, thuong, hetGio: false, thoiGianMs };
}

/* ------------------------------------------------------------------ */
/* Thứ tự bước                                                         */
/* ------------------------------------------------------------------ */

/** Bước kế tiếp phải trả lời (đi tuần tự), hoặc null khi đã trả lời hết. */
export function buocHienTai(soBuoc: number, daTraLoi: ReadonlySet<number>): number | null {
  for (let i = 1; i <= soBuoc; i++) if (!daTraLoi.has(i)) return i;
  return null;
}

/* ------------------------------------------------------------------ */
/* Tổng kết                                                            */
/* ------------------------------------------------------------------ */

export function saoLuot(tyLe: number): 0 | 1 | 2 | 3 {
  if (tyLe >= NGUONG_SAO[2]) return 3;
  if (tyLe >= NGUONG_SAO[1]) return 2;
  if (tyLe >= NGUONG_SAO[0]) return 1;
  return 0;
}

export interface TongKetLuot {
  diem: number;
  thuong: number;
  diemToiDa: number;
  /** diem / diemToiDa, 0–1, làm tròn 3 chữ số. Không tính thưởng nhanh. */
  tyLe: number;
  sao: 0 | 1 | 2 | 3;
  soDung: number;
  soDaTraLoi: number;
  soBuoc: number;
}

/**
 * Tổng kết một lượt. `diemToiDa` là tổng điểm tối đa của MỌI bước trong lượt: bước chưa trả lời
 * (bỏ dở, hết giờ cả lượt) tính 0 điểm nhưng vẫn tính vào mẫu số.
 */
export function tongKetLuot(
  ketQua: ReadonlyArray<{ diem: number; thuong: number; dung: boolean | null }>,
  buoc: ReadonlyArray<{ diem_toi_da: number }>,
): TongKetLuot {
  const diem = ketQua.reduce((s, k) => s + Math.max(0, k.diem), 0);
  const thuong = ketQua.reduce((s, k) => s + Math.max(0, k.thuong), 0);
  const diemToiDa = buoc.reduce((s, b) => s + b.diem_toi_da, 0);
  const tyLe = diemToiDa > 0 ? Math.min(1, Math.round((diem / diemToiDa) * 1000) / 1000) : 0;
  return {
    diem: Math.round(diem * 10) / 10,
    thuong: Math.round(thuong * 10) / 10,
    diemToiDa,
    tyLe,
    sao: saoLuot(tyLe),
    soDung: ketQua.filter((k) => k.dung === true).length,
    soDaTraLoi: ketQua.length,
    soBuoc: buoc.length,
  };
}
