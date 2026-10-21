/**
 * Bảng nguồn nội dung của trò chơi (docs/PLAN.md GĐ-G2): tên nguồn → hàm lấy nội dung ĐÃ DUYỆT.
 *
 * API lượt chơi (apps/api/src/routes/luot-choi.ts) lấy nguồn của mọi trò qua bảng này, cho cả lượt
 * online và gói offline. Thêm một trò có nguồn mới: thêm tên vào `NguonNoiDung` (packages/dao-tao,
 * tro-choi/khung.ts) và một dòng ở đây, không sửa API lượt chơi.
 */
import type { NguonNoiDung } from "@qdpl/dao-tao";
import { nguonBienBaoPhanUng } from "./bien-bao.ts";
import { nguonCamBien } from "./cam-bien.ts";
import { nguonChotDem } from "./chot-dem.ts";
import { nguonDungXe } from "./dung-xe.ts";
import { nguonDuyetPhatNguoi } from "./duyet-phat-nguoi.ts";
import { nguonKiemTraGiayTo } from "./kiem-tra-giay-to.ts";
import { nguonLapBienBan } from "./lap-bien-ban.ts";
import { nguonLenXeKhach } from "./len-xe-khach.ts";
import { nguonCauHoiTroChoi } from "./luot-choi.ts";
import { nguonSoiCamera } from "./soi-camera.ts";
import { nguonSoiXeCaiTao } from "./soi-xe-cai-tao.ts";
import { nguonSungBanTocDo } from "./sung-ban-toc-do.ts";
import { nguonTaiDung } from "./tai-dung.ts";
import { nguonTramCan } from "./tram-can.ts";
import { nguonTruyVet } from "./truy-vet.ts";
import { nguonTuLai } from "./tu-lai.ts";

export interface TuyChonNguon {
  /** Chỉ nội dung được phép đưa vào gói offline. */
  chiOffline: boolean;
  /** Ngày chơi (giờ Việt Nam, YYYY-MM-DD): dữ liệu có hiệu lực theo ngày lấy tại ngày này. */
  ngay: string;
}

const NGUON_TRO_CHOI: Partial<Record<NguonNoiDung, (o: TuyChonNguon) => Promise<unknown[]>>> = {
  cau_hoi: (o) => nguonCauHoiTroChoi({ loai: ["mot_dap_an", "dung_sai"], chiOffline: o.chiOffline }),
  toc_do_tinh_huong: (o) => nguonSungBanTocDo(o),
  // Biển đã duyệt không có hiệu lực theo ngày riêng; mọi biển dùng được cả khi offline (GĐ-G8).
  bien_bao_phan_ung: () => nguonBienBaoPhanUng(),
  lap_bien_ban_tinh_huong: (o) => nguonLapBienBan(o),
  giay_to_ho_so: (o) => nguonKiemTraGiayTo(o),
  dung_xe_tinh_huong: (o) => nguonDungXe(o),
  cam_bien_doan_duong: (o) => nguonCamBien(o),
  soi_camera_kich_ban: (o) => nguonSoiCamera(o),
  tu_lai_ban_do: (o) => nguonTuLai(o),
  phat_nguoi_ho_so: (o) => nguonDuyetPhatNguoi(o),
  tram_can_xe: (o) => nguonTramCan(o),
  xe_khach_len_xe: (o) => nguonLenXeKhach(o),
  chot_dem_doan_duong: (o) => nguonChotDem(o),
  soi_xe_cai_tao_xe: (o) => nguonSoiXeCaiTao(o),
  truy_vet_vu: (o) => nguonTruyVet(o),
  tai_dung_vu: (o) => nguonTaiDung(o),
};

/** Nội dung đã duyệt của một nguồn. Nguồn chưa có trong bảng thì ném lỗi (lỗi lập trình). */
export async function layNguonTroChoi(ten: NguonNoiDung, o: TuyChonNguon): Promise<unknown[]> {
  const lay = NGUON_TRO_CHOI[ten];
  if (!lay) throw new Error(`Chưa khai nguồn nội dung "${ten}" trong nguon-tro-choi.ts.`);
  return await lay(o);
}
