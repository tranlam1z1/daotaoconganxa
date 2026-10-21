/**
 * Kiểu và nhãn của trò "Duyệt hồ sơ phạt nguội" dùng trên điện thoại (docs/PLAN.md GĐ-T11). Import thẳng
 * mã nguồn packages/dao-tao như lib/kiem-tra-giay-to.ts, để tên chỗ chạm, cách ghi thời điểm và ký tự mờ
 * của biển số khớp đúng với máy chủ.
 */
export { ngayVn } from "../../../../packages/dao-tao/src/tro-choi/chung/giay-to.ts";
export {
  type AnhViPham,
  type ChiTietPhatNguoi,
  type ChoCham,
  type DePhatNguoi,
  KY_TU_MO,
  type QuyetDinhPhatNguoi,
  TEN_CHO_CHAM,
  thoiDiemVn,
} from "../../../../packages/dao-tao/src/tro-choi/duyet-phat-nguoi.ts";
