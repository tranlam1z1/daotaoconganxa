/** Luật giấy tờ giả định cho test (không phải luật đã đối chiếu văn bản). Dùng chung cho các test GĐ-T1. */
import type { LuatGiayTo } from "../src/index.ts";

const URN = "vn:vbqppl:l:36/2024/QH15";
function luat(
  ma: string,
  kiem: LuatGiayTo["kiem"],
  giay_to: LuatGiayTo["giay_to"],
  p: Partial<LuatGiayTo> = {},
): LuatGiayTo {
  return {
    ma,
    version: 1,
    kiem,
    giay_to,
    phan_loai: [],
    tham_so: {},
    ten: `Luật thử ${ma}`,
    giai_thich: "Giải thích thử cho luật này.",
    can_cu: URN,
    ma_muc_phat: null,
    ...p,
  };
}

export const LUAT_THU: LuatGiayTo[] = [
  luat("co-gplx", "phai_co", "gplx"),
  luat("co-dk", "phai_co", "dang_ky"),
  luat("co-bh", "phai_co", "bao_hiem"),
  luat("han-gplx", "con_han", "gplx"),
  luat("han-bh", "con_han", "bao_hiem"),
  luat("dk-bien", "khop_xe", "dang_ky", { tham_so: { truong: "bien_so" } }),
  luat("dk-nhan", "khop_xe", "dang_ky", { tham_so: { truong: "nhan_hieu" } }),
  luat("bh-bien", "khop_xe", "bao_hiem", { tham_so: { truong: "bien_so" } }),
  luat("nguoi", "khop_nguoi", "gplx"),
  luat("hang-nho", "hang_gplx", "gplx", { phan_loai: ["mo_to_nho"], tham_so: { hang: ["A1", "A"] } }),
  luat("hang-lon", "hang_gplx", "gplx", { phan_loai: ["mo_to_lon"], tham_so: { hang: ["A"] } }),
  luat("hang-oto", "hang_gplx", "gplx", { phan_loai: ["o_to_con"], tham_so: { hang: ["B"] } }),
];
