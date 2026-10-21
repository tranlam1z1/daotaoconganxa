/**
 * Thử thách vượt màn (docs/PLAN.md GĐ10, PRD #1).
 *
 * Mỗi chủ đề chia thành các màn 10 câu, xếp từ dễ đến khó. Màn 1 luôn mở; màn n mở khi màn n-1
 * đạt từ 80% trở lên. Sao 1–3 theo tỷ lệ đúng. Đề của một màn dựng bằng `rutCauLuyenTap` nên
 * được đảo câu và đảo phương án như luyện tập, chấm bằng `chamCauHoi`.
 */

import type { MucDoCauHoi } from "../cau-hoi.ts";
import type { CauHoiNguon } from "../de-thi.ts";

export const SO_CAU_MOI_MAN = 10;
export const NGUONG_QUA_MAN = 0.8;
/** Không sinh quá 10 màn một chủ đề: đủ dài cho một chủ đề, bản đồ vẫn gọn trên điện thoại. */
export const SO_MAN_TOI_DA = 10;
/** Chủ đề ít hơn 5 câu đã duyệt thì chưa có màn nào. */
export const SO_CAU_TOI_THIEU_MAN = 5;

/** Số màn của một chủ đề theo số câu đã duyệt. */
export function soManCuaChuDe(soCau: number): number {
  if (soCau < SO_CAU_TOI_THIEU_MAN) return 0;
  return Math.min(SO_MAN_TOI_DA, Math.max(1, Math.floor(soCau / SO_CAU_MOI_MAN)));
}

const THU_TU_MUC_DO: Record<MucDoCauHoi, number> = { de: 0, trung_binh: 1, kho: 2 };

/**
 * Chia câu đã duyệt thành các màn: xếp dễ → khó (cùng mức thì theo id cho ổn định), mỗi màn một
 * khúc liên tiếp. Chủ đề chưa đủ 10 câu thì một màn gồm mọi câu. Câu dư sau màn cuối không dùng.
 */
export function chiaCauTheoMan(nguon: CauHoiNguon[]): CauHoiNguon[][] {
  const soMan = soManCuaChuDe(nguon.length);
  if (!soMan) return [];
  const xep = [...nguon].sort(
    (a, b) => THU_TU_MUC_DO[a.level] - THU_TU_MUC_DO[b.level] || a.id.localeCompare(b.id),
  );
  if (xep.length < SO_CAU_MOI_MAN) return [xep];
  return Array.from({ length: soMan }, (_, i) => xep.slice(i * SO_CAU_MOI_MAN, (i + 1) * SO_CAU_MOI_MAN));
}

/** Số sao theo tỷ lệ đúng: dưới ngưỡng 0 sao; từ ngưỡng 1 sao; từ 90% 2 sao; đúng hết 3 sao. */
export function saoTheoTyLe(tyLe: number, nguong = NGUONG_QUA_MAN): 0 | 1 | 2 | 3 {
  if (tyLe < nguong) return 0;
  if (tyLe >= 1) return 3;
  if (tyLe >= 0.9) return 2;
  return 1;
}

export interface TienDoMan {
  best_ratio: number;
  stars: number;
  /** Đã từng đạt ngưỡng qua màn. */
  qua: boolean;
}

/** Màn `thuTu` (từ 1) có đang mở không, theo tiến độ các màn trước. */
export function manDaMo(thuTu: number, tienDo: ReadonlyMap<number, TienDoMan>): boolean {
  if (thuTu <= 1) return true;
  return Boolean(tienDo.get(thuTu - 1)?.qua);
}

/**
 * Tiến độ mới sau một lượt chơi: giữ kết quả tốt nhất, không bao giờ làm mất sao hay trạng thái
 * đã qua màn vì một lượt chơi kém hơn.
 */
export function capNhatTienDoMan(cu: TienDoMan | null, tyLe: number, nguong = NGUONG_QUA_MAN): TienDoMan {
  return {
    best_ratio: Math.max(cu?.best_ratio ?? 0, tyLe),
    stars: Math.max(cu?.stars ?? 0, saoTheoTyLe(tyLe, nguong)),
    qua: Boolean(cu?.qua) || tyLe >= nguong,
  };
}
