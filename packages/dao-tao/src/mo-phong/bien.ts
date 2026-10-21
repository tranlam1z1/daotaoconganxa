/**
 * Biển báo trên đường của bộ mô phỏng (mô-đun M5).
 *
 * Xe phản ứng theo `phan_ung` của biển ĐÃ DUYỆT (cột `traffic_signs.reaction`, GĐ-G8), không theo
 * mã biển: bộ mô phỏng không tự biết biển nào nghĩa là gì. Người lái mô phỏng thấy biển từ
 * TAM_NHIN_BIEN_CM trước biển.
 */
import type { ThaoTacBienBao } from "../bien-bao.ts";

/** Người lái thấy biển từ khoảng cách này (cm) trước biển. */
export const TAM_NHIN_BIEN_CM = 5000;
/** Biển "giảm tốc": giữ tốc độ chậm tới hết khoảng này (cm) sau biển. */
export const VUNG_GIAM_TOC_CM = 6000;
/** Tốc độ khi đi qua vùng giảm tốc (mm mỗi nhịp, ≈ 30 km/h). */
export const TOC_DO_CHAM = 420;
/** Biển "dừng lại": dừng hẳn tại biển trong số nhịp này (1 giây) rồi đi tiếp. */
export const NHIP_DUNG_TAI_BIEN = 20;

/** Một biển trên đường. `id` là vị trí đặt (một cột có thể có nhiều biển, mỗi biển một dòng). */
export interface BienTrenDuong {
  id: string;
  ma: string;
  lan: string;
  /** Vị trí biển trên làn, cm. */
  s: number;
  /** Thao tác đúng khi gặp biển; null là biển không đòi phản ứng. */
  phan_ung: ThaoTacBienBao | null;
}
