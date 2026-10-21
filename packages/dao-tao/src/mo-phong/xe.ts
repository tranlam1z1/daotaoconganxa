/**
 * Xe của bộ mô phỏng (mô-đun M5).
 *
 * Kiểu dữ liệu đủ cho các trò sau (docs/GAME_DESIGN.md §4.3): hướng, làn, tốc độ, xe ưu tiên, xe do
 * người chơi lái. Trò 3 chỉ dùng xe tự chạy theo một làn. Xe rẽ bằng cách đi hết làn này rồi sang làn
 * kế tiếp trong lộ trình (`lo_trinh`); va chạm theo hộp bao (mo-phong.ts).
 *
 * Quãng đường và tốc độ của xe tính bằng mm và mm mỗi nhịp để gia tốc nhỏ vẫn là số nguyên; tọa độ
 * trên bản đồ (x, y) vẫn là cm như mọi thứ khác.
 */
import type { Huong } from "./duong.ts";

export const LOAI_XE = ["o_to", "xe_tai", "xe_may", "xe_uu_tien"] as const;
export type LoaiXe = (typeof LOAI_XE)[number];

/** Kích thước hình bao (cm). */
export const KICH_THUOC_XE: Record<LoaiXe, { dai: number; rong: number }> = {
  o_to: { dai: 450, rong: 180 },
  xe_tai: { dai: 700, rong: 240 },
  xe_may: { dai: 200, rong: 80 },
  xe_uu_tien: { dai: 520, rong: 200 },
};

/** Kích thước hình bao của một xe: theo `kich_thuoc` riêng nếu có, không thì theo loại xe. */
export const kichThuocXe = (x: { loai: LoaiXe; kich_thuoc?: { dai: number; rong: number } }) =>
  x.kich_thuoc ?? KICH_THUOC_XE[x.loai];

/** Tốc độ chạy thường, mm mỗi nhịp 50 ms (700 ≈ 50 km/h). */
export const TOC_DO_THUONG = 700;
/** Tăng tốc, mm/nhịp mỗi nhịp (≈ 2 m/s²). */
export const TANG_TOC = 5;
/** Phanh bình thường (≈ 3 m/s²): cần phanh mạnh hơn mức này là phanh gấp. */
export const PHANH_THUONG = 8;
/**
 * Người lái mô phỏng tính trước với mức phanh nhẹ hơn PHANH_THUONG, để sai số làm tròn giữa các nhịp
 * không biến một lần giảm tốc đã tính trước thành "phanh gấp".
 */
export const PHANH_DU_KIEN = 6;
/** Phanh gấp tối đa (≈ 7 m/s²). */
export const PHANH_GAP = 17;
/** Khoảng cách tối thiểu giữa đuôi xe trước và đầu xe sau khi dừng (cm). */
export const KHOANG_CACH_TOI_THIEU_CM = 400;

/** Qua khúc ngoặt hoặc chỗ rẽ, theo số bậc 45° phải đổi hướng (1: 45°, 2: 90°, 3 trở lên: quay gắt). */
export const TOC_DO_QUA_KHUC: Readonly<Record<1 | 2 | 3 | 4, number>> = { 1: 560, 2: 280, 3: 140, 4: 140 };

/** `va_cham`: xe đã va chạm, đứng yên tại chỗ cho tới hết lượt. */
export type TrangThaiXe = "cho" | "chay" | "dung" | "bi_chan" | "da_qua" | "va_cham";

export interface Xe {
  id: string;
  loai: LoaiXe;
  lan: string;
  /** Quãng đường trên làn, mm. */
  s: number;
  /** Tốc độ, mm mỗi nhịp. */
  v: number;
  v_max: number;
  /** Tọa độ đầu xe trên bản đồ, cm. */
  x: number;
  y: number;
  huong: Huong;
  trang_thai: TrangThaiXe;
  uu_tien: boolean;
  nguoi_lai: "tu_dong" | "nguoi_choi";
  /** Nhịp vào đường (xe "cho" tới nhịp này). */
  nhip_vao: number;
  /** Còn phải đứng yên bao nhiêu nhịp (dừng theo biển). */
  dung_con: number;
  /** Đang trong vùng giảm tốc tới quãng đường này (mm); 0 là không. */
  giam_den: number;
  /** Id biển đã xử lý (đã dừng, đã giảm tốc, hoặc đã qua). */
  bien_da_qua: string[];
  /** Id đặc điểm đã đi vào. */
  dac_diem_da_qua: string[];
  /** Id nguyên nhân đã phát sự kiện phanh gấp, để không phát lặp. */
  phanh_gap_vi: string[];
  /** Các làn còn phải đi sau làn hiện tại (rẽ sang làn kế tiếp khi hết làn). */
  lo_trinh: string[];
  /** Xe máy: người lái có đội mũ bảo hiểm (GĐ-T5). Xe khác: true. */
  mu_bao_hiem: boolean;
  /** Không dừng theo đèn tín hiệu (hành vi trong kịch bản, GĐ-T5). */
  bo_qua_den: boolean;
  /** Dừng theo kịch bản tại quãng đường `s` (cm) trong `so_nhip` nhịp; null khi không có hoặc đã dừng xong. */
  dung_kb: { s: number; so_nhip: number } | null;
  /** Đang đứng yên vì dừng theo kịch bản. */
  dang_dung_kb: boolean;
  /** Id đèn đã qua vạch dừng. */
  den_da_qua: string[];
  /** Kích thước riêng (cm), thay cho KICH_THUOC_XE của loại xe (kiểu xe trong Soi camera). */
  kich_thuoc?: { dai: number; rong: number };
}

/** Xe khai trong cấu hình mô phỏng. */
export interface XeKhoiTao {
  id: string;
  loai: LoaiXe;
  lan: string;
  nhip_vao: number;
  v_max?: number;
  uu_tien?: boolean;
  /** Các làn đi tiếp sau `lan`. Điểm cuối mỗi làn phải trùng điểm đầu làn kế tiếp. */
  lo_trinh?: readonly string[];
  /** GĐ-T5: xe máy có đội mũ bảo hiểm không (mặc định có). */
  mu_bao_hiem?: boolean;
  /** GĐ-T5: không dừng theo đèn tín hiệu. */
  bo_qua_den?: boolean;
  /** GĐ-T5: dừng tại quãng đường `s` (cm) trên làn đầu trong `so_nhip` nhịp rồi đi tiếp. */
  dung?: { s: number; so_nhip: number };
  /** GĐ-T15: vào đường tại quãng đường này (cm) trên làn đầu, như xe từ đường ngang rẽ vào; vắng là 0. */
  s_vao?: number;
  /** Kích thước riêng (cm); vắng thì theo KICH_THUOC_XE của loại xe. */
  kich_thuoc?: { dai: number; rong: number };
}
