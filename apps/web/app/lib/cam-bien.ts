/**
 * Luật trò "Cắm biển cho tuyến đường" dùng trên điện thoại (docs/PLAN.md GĐ-T3). Import thẳng mã
 * nguồn packages/dao-tao như lib/cung-duong.ts: điện thoại chạy thử bằng CÙNG bộ mô phỏng (M5) và
 * cùng hàm dựng bố trí mà máy chủ dùng khi chấm lại, nên hoạt cảnh khớp kết quả máy chủ.
 */

export { TEN_THAO_TAC_BIEN_BAO } from "../../../../packages/dao-tao/src/bien-bao.ts";
export { type LoaiDacDiem, O_CM, RONG_LAN_CM } from "../../../../packages/dao-tao/src/mo-phong/duong.ts";
export {
  buocMoPhong,
  dungMoPhong,
  type MoPhong,
  type TrangThaiMoPhong,
  trangThaiDau,
} from "../../../../packages/dao-tao/src/mo-phong/mo-phong.ts";
export {
  apThaoTac,
  type BoTri,
  boTriRong,
  type ChiTietCamBien,
  cauHinhChayThu,
  type DeCamBien,
  type KetQuaViTri,
  type KetViTri,
  MA_CAM_BIEN,
  phanUngTheoMa,
  type ThamSoCamBien,
  type ThaoTacCamBien,
  type TinhHuongNguyHiem,
  type TraLoiCamBien,
  tinhHuongNguyHiem,
} from "../../../../packages/dao-tao/src/tro-choi/cam-bien.ts";
export { BoGhiNhatKy, bamTrangThai } from "../../../../packages/dao-tao/src/tro-choi/chung/nhat-ky.ts";

/** Tên ngắn của đặc điểm, cho nhãn cạnh đường (tên đầy đủ có trong đề). */
export const TEN_NGAN_DAC_DIEM: Record<string, string> = {
  truong_hoc: "Trường học",
  nguoi_di_bo: "Sang đường",
  duong_cong_trai: "Ngoặt trái",
  duong_hep_trai: "Hẹp trái",
  duong_sat_co_rao: "Đường sắt có rào",
  duong_sat_khong_rao: "Đường sắt không rào",
  cong_truong: "Công trường",
  giao_lo: "Giao nhau",
  vong_xuyen: "Vòng xuyến",
  ben_xe_buyt: "Bến xe buýt",
};

export const urlAnhBien = (anh: string) => `/bien-bao/anh/${encodeURIComponent(anh)}`;
