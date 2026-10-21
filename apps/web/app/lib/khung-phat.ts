/**
 * Khung xử phạt dùng chung cho các công cụ nghiệp vụ có kết luận mức phạt (nồng độ cồn, cơi nới
 * thùng xe, quá khổ hàng hóa, hạng giấy phép lái xe) và thẻ components/cong-cu/TheKhungPhat.tsx.
 *
 * Số liệu soạn theo Nghị định số 168/2024/NĐ-CP, bản toàn văn đăng trên Cổng Thông tin điện tử
 * Chính phủ. Nghị định số 238/2026/NĐ-CP (hiệu lực 15/8/2026) không sửa các điểm, khoản dùng ở các
 * công cụ này. Kho văn bản chưa có hai nghị định nên mọi khung đều `daDoiChieu: false`, thẻ hiện
 * nhãn "Cần đối chiếu". Đối chiếu xong với kho thì sửa câu chữ ở từng khung và đổi cờ.
 */

export const ND_168 = "Nghị định số 168/2024/NĐ-CP";

export interface KhungPhat {
  /** Ai bị xử phạt: "Người điều khiển", "Chủ xe". */
  doiTuong: string;
  hanhVi: string;
  /** Khung tiền phạt (đồng) đối với cá nhân. */
  phatTu: number;
  phatDen: number;
  /** Khung riêng khi chủ xe là tổ chức. */
  toChuc?: { phatTu: number; phatDen: number };
  /** Số điểm giấy phép lái xe bị trừ. */
  truDiem?: number;
  boSung?: string[];
  khacPhuc?: string[];
  canCu: string;
  daDoiChieu: boolean;
}

/** Mức giữa của khung, là mức phạt khi không có tình tiết tăng nặng, giảm nhẹ. */
export const mucTrungBinh = (k: { phatTu: number; phatDen: number }) => (k.phatTu + k.phatDen) / 2;
