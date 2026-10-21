/**
 * Kiểu và nhãn của trò "Trạm cân tải trọng" dùng trên điện thoại (docs/PLAN.md GĐ-T12). Import thẳng mã
 * nguồn packages/dao-tao như lib/kiem-tra-giay-to.ts, để tên nhóm trục, tên dấu và cách ghi số khớp máy chủ.
 */
export { ngayVn } from "../../../../packages/dao-tao/src/tro-choi/chung/giay-to.ts";
export {
  type CapSo,
  type ChiTietTramCan,
  type DauTramCan,
  type DeTramCan,
  type NhomTruc,
  soTrucCuaNhom,
  TEN_DAU_TRAM_CAN,
  tenNhomTruc,
  UOC_TOI_DA,
} from "../../../../packages/dao-tao/src/tro-choi/tram-can.ts";
