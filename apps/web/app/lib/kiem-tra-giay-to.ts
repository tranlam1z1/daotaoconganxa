/**
 * Kiểu và nhãn của trò "Kiểm tra giấy tờ" dùng trên điện thoại (docs/PLAN.md GĐ-T1). Import thẳng mã
 * nguồn packages/dao-tao như lib/cung-duong.ts, để tên chi tiết, tên giấy tờ, cách ghi ngày và mức
 * phạt trên màn hình khớp đúng với máy chủ.
 */
export {
  CHUA_CO_MUC_PHAT,
  type DongBienBan,
  moTaMucPhatBienBan,
} from "../../../../packages/dao-tao/src/tro-choi/chung/bien-ban.ts";
export {
  type DauHieu,
  type LoaiGiayTo,
  ngayVn,
  TEN_DAU_HIEU,
  TEN_GIAY_TO,
  TEN_NGAN_GIAY_TO,
} from "../../../../packages/dao-tao/src/tro-choi/chung/giay-to.ts";
export type {
  ChiTietGiayTo,
  DeGiayTo,
  QuyetDinh,
  TraLoiGiayTo,
} from "../../../../packages/dao-tao/src/tro-choi/kiem-tra-giay-to.ts";
