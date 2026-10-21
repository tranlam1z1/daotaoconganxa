/**
 * Luật trò "Soi camera" dùng trên điện thoại (docs/PLAN.md GĐ-T5). Import thẳng mã nguồn packages/
 * dao-tao như lib/cam-bien.ts: điện thoại dựng hoạt cảnh bằng CÙNG bộ mô phỏng (M5) và cùng phép chiếu
 * camera mà máy chủ dùng khi chấm, nên xe khoanh trên màn hình là đúng xe máy chủ thấy.
 */

export { type Hop, hopXe } from "../../../../packages/dao-tao/src/mo-phong/camera.ts";
export { mauDen } from "../../../../packages/dao-tao/src/mo-phong/den.ts";
export type { TrangThaiMoPhong } from "../../../../packages/dao-tao/src/mo-phong/mo-phong.ts";
export { BoGhiNhatKy } from "../../../../packages/dao-tao/src/tro-choi/chung/nhat-ky.ts";
export {
  CAMERA,
  type ChiTietSoiCamera,
  cauHinhKichBan,
  chayKichBan,
  type DeSoiCamera,
  GIAY_TUA,
  hopCacXe,
  type KetQuaViPham,
  KIEU_XE_CAMERA,
  type KieuXeCamera,
  kieuXeCamera,
  type LoaiViPham,
  MA_LAN,
  type MaLan,
  sTaiY,
  TEN_LAN,
  TEN_VI_PHAM,
  THONG_TIN_KIEU_XE,
  type ThamSoCamera,
  type ThaoTacCamera,
  type TraLoiSoiCamera,
  X_LAN,
  Y_NGUOI_DI_BO,
  Y_VACH,
} from "../../../../packages/dao-tao/src/tro-choi/soi-camera.ts";
