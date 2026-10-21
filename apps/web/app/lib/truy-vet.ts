/**
 * Luật trò "Truy vết xe bỏ trốn" dùng trên điện thoại (docs/PLAN.md GĐ-T17). Import thẳng mã nguồn
 * packages/dao-tao như lib/chot-dem.ts: điện thoại chạy đoạn cảnh bằng CÙNG bộ mô phỏng (M5) và cùng hàm dựng
 * cảnh với máy chủ; khi offline (câu D24) tự mở camera, khóa xe bằng cùng hàm máy chủ dùng để chấm lại.
 */
export {
  type BanDoO,
  chiSo,
  dungLuoi,
  type HuongO,
  keDuong,
  khoangCachTu,
  type LoaiO,
  laDuong,
  TEN_HUONG_O,
  TEN_LOAI_O,
  type ToaDoO,
} from "../../../../packages/dao-tao/src/ban-do/index.ts";
export {
  buocMoPhong,
  dungMoPhong,
  type MoPhong,
  type TrangThaiMoPhong,
  trangThaiDau,
} from "../../../../packages/dao-tao/src/mo-phong/mo-phong.ts";
export { BoGhiNhatKy } from "../../../../packages/dao-tao/src/tro-choi/chung/nhat-ky.ts";
export {
  apThaoTacTV,
  type BuocTruyVet,
  type ChiTietTruyVet,
  cauHinhDoanCanh,
  type DeTruyVet,
  type DoanCanh,
  dungDoanCanh,
  dungVu,
  GIAY_DOAN,
  KY_TU_CHE,
  type LoaiXeTruyVet,
  type LoiThaoTac,
  type MauXeTV,
  NHIP_DAN,
  NHIP_DOAN,
  NUA_KHUNG_CM,
  TEN_LOAI_XE_TV,
  TEN_MAU_XE,
  type ThamSoTruyVet,
  type ThaoTacTruyVet,
  type TraLoiTruyVet,
  type TrangThaiTruyVet,
  thoiDiemCamera,
} from "../../../../packages/dao-tao/src/tro-choi/truy-vet.ts";

/** Giờ đồng hồ "HH:MM:SS" của giây `giay` trong trò (tính từ lúc xảy ra vụ việc). */
export function gioTrongTro(gioXayRa: string, giay: number): string {
  const [h, m, s] = gioXayRa.split(":").map(Number) as [number, number, number];
  const t = (((h * 3600 + m * 60 + s + Math.floor(giay)) % 86_400) + 86_400) % 86_400;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(t / 3600))}:${p(Math.floor(t / 60) % 60)}:${p(t % 60)}`;
}
