/**
 * Luật trò "Cung đường biển báo" dùng trên điện thoại (docs/PLAN.md GĐ-G8): bộ thao tác và kết quả
 * từng biển, để đường chạy phản hồi ngay và tính mạng bằng CÙNG hàm máy chủ dùng khi chấm lại.
 * Import thẳng mã nguồn packages/dao-tao như lib/offline/tro-choi.ts.
 */
export {
  TEN_THAO_TAC_BIEN_BAO,
  THAO_TAC_BIEN_BAO,
  type ThaoTacBienBao,
} from "../../../../packages/dao-tao/src/bien-bao.ts";
export {
  type ChiTietDuong,
  type DeCungDuong,
  type KetBien,
  ketQuaMotBien,
  SO_MANG,
  type SuKienDuong,
  TAM_DUNG_TOI_DA_MS,
  type TraLoiCungDuong,
} from "../../../../packages/dao-tao/src/tro-choi/cung-duong-bien-bao.ts";
