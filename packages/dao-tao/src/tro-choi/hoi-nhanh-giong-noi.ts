/**
 * Hỏi nhanh bằng giọng nói (docs/PLAN.md GĐ14, PRD #15): máy đọc câu hỏi, người học nói đáp án.
 *
 * Dùng phiên luyện tập `game:hoi_nhanh_giong_noi` như đua thời gian, nhưng không tính giờ: nói
 * và nghe cần thời gian, bắt đua sẽ đo tốc độ nói chứ không đo kiến thức.
 */
import type { LoaiCauHoi } from "../cau-hoi.ts";

/** Số câu một lượt. */
export const SO_CAU_HOI_NHANH = 10;
/** Chỉ câu trả lời được bằng một lời: một đáp án hoặc đúng/sai. */
export const LOAI_CAU_HOI_NHANH: readonly LoaiCauHoi[] = ["mot_dap_an", "dung_sai"];
