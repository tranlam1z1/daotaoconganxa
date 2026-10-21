/**
 * Luật trò "Tái dựng hiện trường" dùng trên điện thoại (docs/PLAN.md GĐ-T10). Import thẳng mã nguồn
 * packages/dao-tao như lib/chot-dem.ts: điện thoại áp thao tác và chạy mô phỏng bằng CÙNG bộ M5
 * (mo-phong/va-cham.ts) và cùng hàm dựng cảnh mà máy chủ dùng khi chấm lại, nên kết quả khớp máy chủ.
 */
export {
  buocVaCham,
  type CanhVaCham,
  type DauVet,
  doDaiVet,
  HANH_DONG_XE,
  MUC_TOC_DO_KMH,
  type TrangThaiVaCham,
  trangThaiDauVaCham,
  type XeVaCham,
} from "../../../../packages/dao-tao/src/mo-phong/va-cham.ts";
export { KICH_THUOC_XE } from "../../../../packages/dao-tao/src/mo-phong/xe.ts";
export { BoGhiNhatKy } from "../../../../packages/dao-tao/src/tro-choi/chung/nhat-ky.ts";
export {
  apThaoTacTaiDung,
  type BanDungTaiDung,
  banDungRong,
  type CapLoi,
  type ChiTietTaiDung,
  canhTaiDung,
  chayTaiDung,
  type DeTaiDung,
  type DungCanhTaiDung,
  dungCanhCua,
  type LoaiLoiTaiDung,
  RONG_LAN_M,
  type SoDoTaiDung,
  TEN_HANH_DONG_XE,
  TEN_LOI_TAI_DUNG,
  TEN_MAT_DUONG,
  TEN_MUC_TOC_DO,
  TEN_VAT_TAI_DUNG,
  type ThamSoTaiDung,
  type ThaoTacTaiDung,
  type TraLoiTaiDung,
} from "../../../../packages/dao-tao/src/tro-choi/tai-dung.ts";

/** Tên 8 hướng (0 là lên, theo chiều kim đồng hồ). */
export const TEN_HUONG = ["bắc", "đông bắc", "đông", "đông nam", "nam", "tây nam", "tây", "tây bắc"] as const;
export const MUI_TEN_HUONG = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"] as const;
