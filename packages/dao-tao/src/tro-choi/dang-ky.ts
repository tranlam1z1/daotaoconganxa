/**
 * Bảng mã → định nghĩa của các trò chạy trên khung lượt chơi chung (docs/GAME_DESIGN.md §2.1).
 *
 * Import được ở máy chủ và trong trình duyệt (trang chơi offline), nên chỉ chứa mã thuần.
 * Thêm một trò: viết tệp định nghĩa theo khung.ts, thêm vào bảng này, và thêm một dòng vào bảng
 * `games` bằng migration.
 */
import { TRO_CHOI_CAM_BIEN } from "./cam-bien.ts";
import { TRO_CHOI_CHOT_DEM } from "./chot-dem.ts";
import { TRO_CHOI_CUNG_DUONG } from "./cung-duong-bien-bao.ts";
import { TRO_CHOI_DUNG_XE } from "./dung-xe.ts";
import { TRO_CHOI_DUYET_PHAT_NGUOI } from "./duyet-phat-nguoi.ts";
import type { DinhNghiaTroChoi } from "./khung.ts";
import { TRO_CHOI_KIEM_TRA_GIAY_TO } from "./kiem-tra-giay-to.ts";
import { TRO_CHOI_LAP_BIEN_BAN } from "./lap-bien-ban.ts";
import { TRO_CHOI_LEN_XE_KHACH } from "./len-xe-khach.ts";
import { TRO_CHOI_SOI_CAMERA } from "./soi-camera.ts";
import { TRO_CHOI_SOI_XE_CAI_TAO } from "./soi-xe-cai-tao.ts";
import { TRO_CHOI_SUNG_BAN_TOC_DO } from "./sung-ban-toc-do.ts";
import { TRO_CHOI_TAI_DUNG } from "./tai-dung.ts";
import { TRO_CHOI_THU_NGHIEM } from "./thu-nghiem.ts";
import { TRO_CHOI_TRAM_CAN } from "./tram-can.ts";
import { TRO_CHOI_TRUY_VET } from "./truy-vet.ts";
import { TRO_CHOI_TU_LAI } from "./tu-lai.ts";

export type TroChoiBatKy = DinhNghiaTroChoi<any, any, any>;

export const DANG_KY_TRO_CHOI: Readonly<Record<string, TroChoiBatKy>> = {
  [TRO_CHOI_THU_NGHIEM.ma]: TRO_CHOI_THU_NGHIEM,
  [TRO_CHOI_SUNG_BAN_TOC_DO.ma]: TRO_CHOI_SUNG_BAN_TOC_DO,
  [TRO_CHOI_CUNG_DUONG.ma]: TRO_CHOI_CUNG_DUONG,
  [TRO_CHOI_LAP_BIEN_BAN.ma]: TRO_CHOI_LAP_BIEN_BAN,
  [TRO_CHOI_KIEM_TRA_GIAY_TO.ma]: TRO_CHOI_KIEM_TRA_GIAY_TO,
  [TRO_CHOI_DUNG_XE.ma]: TRO_CHOI_DUNG_XE,
  [TRO_CHOI_CAM_BIEN.ma]: TRO_CHOI_CAM_BIEN,
  [TRO_CHOI_SOI_CAMERA.ma]: TRO_CHOI_SOI_CAMERA,
  [TRO_CHOI_TU_LAI.ma]: TRO_CHOI_TU_LAI,
  [TRO_CHOI_DUYET_PHAT_NGUOI.ma]: TRO_CHOI_DUYET_PHAT_NGUOI,
  [TRO_CHOI_TRAM_CAN.ma]: TRO_CHOI_TRAM_CAN,
  [TRO_CHOI_LEN_XE_KHACH.ma]: TRO_CHOI_LEN_XE_KHACH,
  [TRO_CHOI_CHOT_DEM.ma]: TRO_CHOI_CHOT_DEM,
  [TRO_CHOI_SOI_XE_CAI_TAO.ma]: TRO_CHOI_SOI_XE_CAI_TAO,
  [TRO_CHOI_TRUY_VET.ma]: TRO_CHOI_TRUY_VET,
  [TRO_CHOI_TAI_DUNG.ma]: TRO_CHOI_TAI_DUNG,
};

export function layTroChoi(ma: string): TroChoiBatKy | undefined {
  return Object.hasOwn(DANG_KY_TRO_CHOI, ma) ? DANG_KY_TRO_CHOI[ma] : undefined;
}
