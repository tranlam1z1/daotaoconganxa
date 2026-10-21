/**
 * Luật trò "Tự lái qua phố" dùng trên điện thoại (docs/PLAN.md GĐ-T9). Import thẳng mã nguồn
 * packages/dao-tao như lib/cam-bien.ts: điện thoại lái bằng CÙNG bộ mô phỏng khu phố mà máy chủ chạy
 * lại khi chấm, nên lỗi và vị trí khớp kết quả máy chủ (so bằng băm trạng thái).
 */

export type { LoaiXeNguoiLai } from "../../../../packages/dao-tao/src/mo-phong/xe-nguoi-lai.ts";
export { kmh } from "../../../../packages/dao-tao/src/mo-phong/xe-nguoi-lai.ts";
export { SO_THAO_TAC_TOI_DA } from "../../../../packages/dao-tao/src/tro-choi/chung/nhat-ky.ts";
export {
  bamTuLai,
  type ChiTietTuLai,
  chayLaiTuLai,
  type DeTuLai,
  type LoiTuLaiKetQua,
  type ThamSoTuLai,
  type ThaoTacTuLai,
  TRU_DIEM_LOI,
  type TraLoiTuLai,
  thoiDiem,
} from "../../../../packages/dao-tao/src/tro-choi/tu-lai.ts";
export {
  apThaoTacLai,
  buocPho,
  dungTheGioi,
  giaoPhiaTruoc,
  HUONG_THEO_TEN,
  type HuongLai,
  huongRaGiao,
  khoaO,
  laDuong,
  mauDenPho,
  type NguoiChoiPho,
  type PayloadBanDo,
  type ThaoTacLai,
  type TheGioi,
  type TrangThaiPho,
  trangThaiDauPho,
  trucCua,
  viTriNguoiDiBo,
} from "../../../../packages/dao-tao/src/tro-choi/tu-lai-pho.ts";
