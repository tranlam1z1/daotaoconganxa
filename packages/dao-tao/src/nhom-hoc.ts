/**
 * Nhóm học cùng (docs/PLAN.md GĐ16a, docs/PROMPT_NHOM_HOC_CUNG.md mục 2): luật thuần.
 *
 * - Tiến độ tính lúc đọc từ dữ liệu gốc (tiến độ bài học, phiên đề ôn tập). Không có cột phần
 *   trăm nào được lưu, và không có hàm nào nhận phần trăm từ máy khách.
 * - Mọi con số giới hạn là ĐỀ XUẤT đã được chấp nhận ở câu N10, gom ở `GIOI_HAN_NHOM` để sửa một
 *   chỗ khi đơn vị chốt số khác.
 * - Ngày của lượt cổ vũ tính theo giờ Việt Nam, nhận `now` làm tham số để test mốc 0 giờ.
 */
import { ngayVietNam } from "./ngay.ts";

/* ------------------------------------------------------------------ */
/* Giới hạn                                                            */
/* ------------------------------------------------------------------ */

export const GIOI_HAN_NHOM = {
  /** Thành viên đang ở trong một nhóm. */
  thanhVienMoiNhom: 30,
  /** Mục đang có (chưa gỡ) trong một nhóm. */
  mucMoiNhom: 30,
  /** Nhóm đang hoạt động mà một người đang làm trưởng nhóm. */
  nhomTruongNhomDangHoatDong: 5,
  /** Nhóm đang hoạt động mà một người đang là thành viên (kể cả làm trưởng nhóm). */
  nhomThamGia: 10,
  tenNhom: { toiThieu: 3, toiDa: 80 },
  moTa: 500,
  tenDeOnTap: { toiThieu: 3, toiDa: 80 },
  cauDeOnTap: { toiThieu: 5, toiDa: 20 },
  /** Sai mã mời quá số lần này trong cửa sổ thì từ chối (429). */
  maMoiSaiToiDa: 10,
  maMoiCuaSoPhut: 15,
  /** Số lần bấm "Cổ vũ" tối đa mỗi phút của một tài khoản. */
  coVuMoiPhut: 60,
} as const;

export type LoaiMucNhom = "bai_hoc" | "de_on_tap";

/* ------------------------------------------------------------------ */
/* Mã mời                                                              */
/* ------------------------------------------------------------------ */

/** Bảng chữ của mã mời: bỏ 0, O, 1, I, L để đọc và gõ lại không nhầm. 31 ký tự. */
export const BANG_CHU_MA_MOI = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const DO_DAI_MA_MOI = 8;

/**
 * Sinh mã mời ngẫu nhiên bằng Web Crypto. Byte ngoài bội số của 31 bị bỏ để mọi ký tự có cùng
 * xác suất. `lay` thay được trong test.
 */
export function sinhMaMoi(
  lay: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n)),
): string {
  const k = BANG_CHU_MA_MOI.length;
  const tran = 256 - (256 % k);
  let ma = "";
  while (ma.length < DO_DAI_MA_MOI) {
    for (const b of lay(DO_DAI_MA_MOI * 2)) {
      if (b >= tran) continue;
      ma += BANG_CHU_MA_MOI[b % k];
      if (ma.length === DO_DAI_MA_MOI) break;
    }
  }
  return ma;
}

/** Chuẩn hóa mã người dùng gõ: bỏ khoảng trắng và gạch nối, viết hoa. Sai dạng trả null. */
export function chuanHoaMaMoi(raw: string): string | null {
  const ma = raw.replace(/[\s-]/g, "").toUpperCase();
  if (ma.length !== DO_DAI_MA_MOI) return null;
  for (const ch of ma) if (!BANG_CHU_MA_MOI.includes(ch)) return null;
  return ma;
}

/* ------------------------------------------------------------------ */
/* Phần trăm một mục                                                    */
/* ------------------------------------------------------------------ */

/**
 * Phần trăm đã học của một bài (chuyển từ apps/api/src/routes/dao-tao.ts, kết quả không đổi).
 * Bài xong là 100; bài đang học tính theo khối xa nhất đã đọc, chặn ở 99 để chỉ bài đã xong mới
 * đạt 100. Khối đánh số từ 1 (0 là chưa đọc khối nào), nên `lastBlockOrdinal` cũng là số khối đã đọc.
 */
export function phanTramBai(
  state: string | null | undefined,
  lastBlockOrdinal: number,
  soKhoi: number,
): number {
  if (state === "xong") return 100;
  if (state !== "dang_hoc" || soKhoi === 0) return 0;
  return Math.min(99, Math.round((lastBlockOrdinal / soKhoi) * 100));
}

export interface PhienDeOnTap {
  da_ket_thuc: boolean;
  /** Số câu đã trả lời trong phiên. */
  da_tra_loi: number;
  /** Số câu của phiên lúc bắt đầu (`practice_sessions.total`). */
  tong: number;
}

/**
 * Phần trăm một đề ôn tập của một người: lấy phiên cao nhất. Phiên đã kết thúc là 100, không đòi
 * điểm tối thiểu (N6). Phiên đang làm là số câu đã trả lời chia số câu của chính phiên đó, làm tròn
 * xuống, tối đa 99 (Đ4). Chưa làm là 0.
 */
export function phanTramDeOnTap(phien: readonly PhienDeOnTap[]): number {
  let cao = 0;
  for (const p of phien) {
    const v = p.da_ket_thuc ? 100 : p.tong > 0 ? Math.min(99, Math.floor((p.da_tra_loi / p.tong) * 100)) : 0;
    if (v > cao) cao = v;
  }
  return cao;
}

/* ------------------------------------------------------------------ */
/* Tiến độ cả nhóm                                                      */
/* ------------------------------------------------------------------ */

/**
 * - `tinh`: mục được tính vào tiến độ.
 * - `khong_con_xuat_ban`: bài hoặc chuyên đề của bài không còn ở `xuat_ban` (Đ1).
 * - `khong_du_cau`: đề ôn tập còn dưới 5 câu đã duyệt.
 * Mục đã gỡ không vào danh sách tính từ đầu.
 */
export type TrangThaiMucNhom = "tinh" | "khong_con_xuat_ban" | "khong_du_cau";

export interface MucNhomTinh {
  id: string;
  loai: LoaiMucNhom;
  /** Bài học: bài và chuyên đề đều `xuat_ban`. Đề ôn tập: bỏ qua. */
  con_xuat_ban: boolean;
  /** Bài học: số khối của bài. */
  so_khoi: number;
  /** Đề ôn tập: số câu trong `question_ids` còn `da_duyet`. */
  so_cau_con_duyet: number;
}

export function trangThaiMuc(m: MucNhomTinh): TrangThaiMucNhom {
  if (m.loai === "bai_hoc") return m.con_xuat_ban ? "tinh" : "khong_con_xuat_ban";
  return m.so_cau_con_duyet >= GIOI_HAN_NHOM.cauDeOnTap.toiThieu ? "tinh" : "khong_du_cau";
}

/** Dữ liệu gốc của một người với một mục. */
export interface DuLieuMucCuaNguoi {
  /** Bài học: dòng `lesson_progress` (không có là chưa mở). */
  bai?: { state: string | null; last_block_ordinal: number } | null;
  /** Đề ôn tập: các phiên nguồn `nhom` của mục. */
  phien?: readonly PhienDeOnTap[];
}

export const khoaDuLieuMuc = (accountId: string, itemId: string) => `${accountId}|${itemId}`;

/** Phần trăm một mục của một người; null khi mục không được tính. */
export function phanTramMuc(m: MucNhomTinh, d: DuLieuMucCuaNguoi | undefined): number | null {
  if (trangThaiMuc(m) !== "tinh") return null;
  if (m.loai === "bai_hoc") return phanTramBai(d?.bai?.state, d?.bai?.last_block_ordinal ?? 0, m.so_khoi);
  return phanTramDeOnTap(d?.phien ?? []);
}

/** Trung bình cộng làm tròn xuống, trọng số bằng nhau (N5); danh sách rỗng trả null. */
export function trungBinhXuong(ds: readonly number[]): number | null {
  if (!ds.length) return null;
  return Math.floor(ds.reduce((t, v) => t + v, 0) / ds.length);
}

export interface TienDoThanhVien {
  account_id: string;
  /** Phần trăm từng mục theo id; null là mục không được tính. */
  muc: Record<string, number | null>;
  /** Trung bình các mục được tính; null khi nhóm chưa có mục nào được tính. */
  phan_tram: number | null;
}

export interface TienDoNhom {
  thanh_vien: TienDoThanhVien[];
  /** Trung bình phần trăm chung của thành viên đang ở trong nhóm, làm tròn xuống. */
  trung_binh: number | null;
}

/**
 * Tiến độ của các thành viên ĐANG ở trong nhóm (người đã rời không có mặt ở `thanhVien`).
 * `duLieu` khóa theo `khoaDuLieuMuc(accountId, itemId)`.
 */
export function tinhTienDoNhom(p: {
  muc: readonly MucNhomTinh[];
  thanhVien: readonly string[];
  duLieu: ReadonlyMap<string, DuLieuMucCuaNguoi>;
}): TienDoNhom {
  const thanhVien = p.thanhVien.map((accountId): TienDoThanhVien => {
    const muc: Record<string, number | null> = {};
    const tinh: number[] = [];
    for (const m of p.muc) {
      const v = phanTramMuc(m, p.duLieu.get(khoaDuLieuMuc(accountId, m.id)));
      muc[m.id] = v;
      if (v !== null) tinh.push(v);
    }
    return { account_id: accountId, muc, phan_tram: trungBinhXuong(tinh) };
  });
  const chung = thanhVien.map((t) => t.phan_tram).filter((v): v is number => v !== null);
  return { thanh_vien: thanhVien, trung_binh: trungBinhXuong(chung) };
}

/* ------------------------------------------------------------------ */
/* Cổ vũ                                                               */
/* ------------------------------------------------------------------ */

/** Ngày của một lượt cổ vũ (giờ Việt Nam): mỗi người cổ vũ một thành viên tối đa một lần mỗi ngày (N7). */
export function ngayCoVu(now: Date): string {
  return ngayVietNam(now);
}

/**
 * Bộ đếm lượt trong cửa sổ trượt: bỏ mốc cũ hơn `cuaSoMs`, còn chỗ thì nhận mốc mới. Trả mảng mốc
 * mới và kết quả, để nơi gọi tự giữ trạng thái (theo mẫu `choPhepDoc` của giọng đọc).
 */
export function nhanLuotTrongCuaSo(
  moc: readonly number[],
  now: number,
  cuaSoMs: number,
  toiDa: number,
): { duoc: boolean; moc: number[] } {
  const con = moc.filter((t) => now - t < cuaSoMs);
  const duoc = con.length < toiDa;
  if (duoc) con.push(now);
  return { duoc, moc: con };
}
