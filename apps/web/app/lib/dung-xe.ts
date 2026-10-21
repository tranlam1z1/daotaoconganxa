/**
 * Kiểu, nhãn và máy trạng thái của trò "Dừng xe đúng quy trình" dùng trên điện thoại (docs/PLAN.md
 * GĐ-T4). Import thẳng mã nguồn packages/dao-tao như lib/kiem-tra-giay-to.ts, để diễn biến điện thoại
 * hiện ngay khớp đúng với diễn biến máy chủ chạy lại khi chấm.
 */
export {
  type ChiTietDungXe,
  type DeDungXe,
  dienBien,
  HUONG_XU_LY,
  type HuongXuLy,
  type KieuBuocDungXe,
  type SoSanhBuoc,
  type SuKienDienBien,
  TEN_BUOC_DUNG_XE,
  TEN_HUONG_XU_LY,
  type ThaoTacDungXe,
  type TraLoiDungXe,
} from "../../../../packages/dao-tao/src/tro-choi/dung-xe.ts";
