/**
 * Luật trò "Dựng chốt an toàn ban đêm" dùng trên điện thoại (docs/PLAN.md GĐ-T15). Import thẳng mã nguồn
 * packages/dao-tao như lib/cam-bien.ts: điện thoại kiểm chỗ đặt, chạy thử bằng CÙNG bộ mô phỏng (M5) và
 * cùng hàm dựng cấu hình mà máy chủ dùng khi chấm lại, nên kết quả chạy thử khớp máy chủ.
 */
export {
  buocMoPhong,
  dungMoPhong,
  type MoPhong,
  type TrangThaiMoPhong,
  trangThaiDau,
} from "../../../../packages/dao-tao/src/mo-phong/mo-phong.ts";
export { BAN_KINH_VUNG_NGUY_HIEM_CM } from "../../../../packages/dao-tao/src/mo-phong/vat-can.ts";
export {
  apThaoTacChot,
  type BoTriChot,
  type ChiTietChotDem,
  COT_CHOT,
  type CotChot,
  cauHinhChot,
  type DeChotDem,
  type DoDacChay,
  doDacRong,
  doSauNhip,
  type KetQuaChayChot,
  ketQuaChay,
  laLan,
  lyDoKhongDatDuoc,
  NHIP_CHAY_CHOT,
  sinhDongXe,
  TEN_TIEU_CHI_CHOT,
  TEN_VAT_CHOT,
  TEN_XE_CHOT,
  type ThamSoChot,
  type ThaoTacChot,
  type TraLoiChotDem,
  type ViTriVat,
  vungChotM,
  xCuaCot,
  yCuaM,
} from "../../../../packages/dao-tao/src/tro-choi/chot-dem.ts";
export { BoGhiNhatKy, bamTrangThai } from "../../../../packages/dao-tao/src/tro-choi/chung/nhat-ky.ts";

export const TEN_COT: Record<string, string> = {
  le_trai: "lề trái",
  lan_1: "làn trái",
  lan_2: "làn phải",
  le_phai: "lề phải",
};

export const TEN_HUONG_BIEN = [
  "quay về phía xe tới",
  "quay sang phải",
  "quay lưng lại xe tới",
  "quay sang trái",
];
