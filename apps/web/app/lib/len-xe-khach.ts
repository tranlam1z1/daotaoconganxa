/**
 * Kiểu và nhãn của trò "Lên xe khách" dùng trên điện thoại (docs/PLAN.md GĐ-T13). Import thẳng mã nguồn
 * packages/dao-tao như lib/tram-can.ts, để sơ đồ khoang (mã ô), tên dấu và mã chỗ chạm khớp máy chủ.
 */
export { ngayVn, phutCuaGio } from "../../../../packages/dao-tao/src/tro-choi/chung/giay-to.ts";
export {
  type ChiTietXeKhach,
  type DauXeKhach,
  type DeXeKhach,
  type HinhPhanTu,
  laNguoi,
  MUC_SO_NGUOI,
  type OKhoang,
  type PhanTuCoId,
  SO_VUOT_TOI_DA,
  soDoKhoang,
  TEN_DAU_XE_KHACH,
} from "../../../../packages/dao-tao/src/tro-choi/len-xe-khach.ts";
