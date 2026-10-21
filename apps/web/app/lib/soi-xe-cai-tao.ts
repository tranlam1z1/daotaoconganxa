/**
 * Kiểu và nhãn của trò "Soi xe cải tạo" dùng trên điện thoại (docs/PLAN.md GĐ-T14). Import thẳng mã nguồn
 * packages/dao-tao như lib/tram-can.ts, để tên dòng giấy, dấu và giới hạn khung khớp máy chủ.
 */
export {
  DONG_THONG_SO,
  type DongThongSo,
  ngayVn,
  TEN_DONG_THONG_SO,
  type ThongSoKyThuat,
} from "../../../../packages/dao-tao/src/tro-choi/chung/giay-to.ts";
export type { GocNhin, Hop, KieuNet } from "../../../../packages/dao-tao/src/tro-choi/hinh-xe-tham-so.ts";
export {
  type ChiTietSoiXe,
  type DauSoiXe,
  type DeSoiXe,
  KHUNG_TOI_DA_MOI_HINH,
  type KhungKhoanh,
  TEN_DAU_SOI_XE,
} from "../../../../packages/dao-tao/src/tro-choi/soi-xe-cai-tao.ts";
