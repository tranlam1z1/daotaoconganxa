/**
 * Đua thời gian 60 giây (docs/PLAN.md GĐ10, PRD #2): trả lời đúng nhiều câu nhất trong 60 giây.
 *
 * Đồng hồ do máy chủ quyết định: thời điểm bắt đầu là `started_at` của phiên. Câu trả lời gửi
 * sau 60 giây cộng dung sai mạng bị từ chối. Các hàm nhận `now` để test mọi tình huống thời gian.
 */

import type { LoaiCauHoi } from "../cau-hoi.ts";

export const THOI_GIAN_DUA_GIAY = 60;
/** Bù độ trễ mạng: câu bấm ở giây 59,9 vẫn phải được nhận. */
export const DUNG_SAI_DUA_GIAY = 3;
/** Số câu rút sẵn cho một lượt; nhanh nhất cũng khó trả lời quá 40 câu trong 60 giây. */
export const SO_CAU_DUA = 40;
/** Chỉ dùng loại câu trả lời bằng một chạm, để đua thời gian đo kiến thức chứ không đo tốc độ gõ. */
export const LOAI_CAU_DUA: readonly LoaiCauHoi[] = ["mot_dap_an", "dung_sai"];

export function hanDua(batDau: Date): Date {
  return new Date(batDau.getTime() + THOI_GIAN_DUA_GIAY * 1000);
}

/** Máy chủ còn nhận câu trả lời không (hết 60 giây cộng dung sai thì không). */
export function conNhanTraLoiDua(batDau: Date, now: Date): boolean {
  return now.getTime() <= hanDua(batDau).getTime() + DUNG_SAI_DUA_GIAY * 1000;
}

/** Số giây còn lại để hiển thị, không âm. */
export function giayConLaiDua(batDau: Date, now: Date): number {
  return Math.max(0, Math.ceil((hanDua(batDau).getTime() - now.getTime()) / 1000));
}
