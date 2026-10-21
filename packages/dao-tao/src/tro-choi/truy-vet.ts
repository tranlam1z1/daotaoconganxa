/**
 * Trò "Truy vết xe bỏ trốn" (docs/PLAN.md GĐ-T17, docs/GAME_DESIGN.md §5.17).
 *
 * Một vụ là một lượt, một bước của khung. Lượt mở đầu bằng tin báo: xe gây tai nạn bỏ chạy, kèm mô tả một
 * phần (loại xe, màu, 2–3 ký tự biển số, hướng chạy, giờ). Bản đồ khu phố (M9) có các camera. Người chơi:
 *  - mở một camera: xem đoạn cảnh 10 giây quanh lúc xe có thể tới camera đó;
 *  - chạm xe khớp mô tả để khóa;
 *  - chọn camera kế tiếp theo hướng xe đi; cuối cùng đặt điểm chặn trên bản đồ.
 *
 * Thời gian trong trò (giây, tính từ lúc xảy ra vụ việc):
 *  - Đồng hồ bắt đầu ở lúc nhận tin báo (`bao_sau_giay`).
 *  - Thời điểm của đoạn cảnh = mốc khóa gần nhất (camera và giờ, ban đầu là nơi xảy ra lúc 0) + số ô của
 *    đường ngắn nhất × số giây mỗi ô của loại xe (tốc độ trung bình, TOC_DO_TB_MM_S).
 *  - Chỉ xem được đoạn cảnh đã ghi xong: đồng hồ chưa tới thời điểm đó + 5 giây thì bị từ chối, trừ khi
 *    người chơi chọn chờ (đồng hồ nhảy tới lúc đó).
 *  - Mỗi lần xem tốn GIAY_XEM và một lượt xem; camera không thấy xe (sai hướng) tốn thêm GIAY_SAI_HUONG.
 *  - Điểm chặn đúng khi nằm trên lộ trình phía trước và xe tới đó muộn hơn đồng hồ lúc đặt ít nhất
 *    GIAY_CHAN_TRUOC.
 *
 * Lộ trình sinh tất định từ seed của vụ và biến thể của lượt, trên lưới M9; không soạn tay. Đoạn cảnh là
 * cấu hình M5 (ngã tư quanh camera, xe vào theo nhịp) để điện thoại tự chạy và vẽ bằng M6. Id xe sinh
 * riêng cho từng đoạn cảnh từ bí mật của lượt, nên không lần theo id từ đoạn này sang đoạn khác.
 *
 * Nhật ký thao tác (M7): "mo" (mở camera), "khoa" (khóa một xe trong đoạn cảnh mới nhất), "chan" (đặt điểm
 * chặn, thao tác cuối). Lượt online: route riêng của trò ghi "mo", "khoa" vào `noi_dung.nhat_ky` của ảnh
 * chụp bước (câu D23); khi chấm, máy chủ lấy nhật ký đó, chỉ nhận thao tác "khoa", "chan" cuối từ máy khách.
 * Lượt offline (câu D24): gói mang cả lộ trình; máy chủ chạy lại toàn bộ nhật ký máy khách gửi.
 *
 * Điểm (đề xuất, câu D15): khóa đúng +5 mỗi camera, khóa nhầm −3, điểm chặn đúng +20, lượt xem còn dư +2
 * mỗi lượt (tối đa 10, chỉ khi chặn đúng). Điểm bước không âm. Hàm thuần.
 */

import {
  type BanDoO,
  chiSo,
  cungO,
  dungLuoi,
  HUONG_O,
  type HuongO,
  huongGiua,
  keDuong,
  keTheoHuong,
  khoangCachTu,
  kiemTraBanDo,
  kiemTraDatVat,
  type LuoiO,
  laDuong,
  laGiaoLo,
  quayLai,
  type ToaDoO,
  trongLuoi,
} from "../ban-do/index.ts";
import { taoRng, tron } from "../de-thi.ts";
import { BUOC_HUONG, type Diem, type Lan } from "../mo-phong/duong.ts";
import {
  buocMoPhong,
  type CauHinhMoPhong,
  dungMoPhong,
  NHIP_MS,
  trangThaiDau,
} from "../mo-phong/mo-phong.ts";
import type { XeKhoiTao } from "../mo-phong/xe.ts";
import type { CauHinhMan } from "./chung/man-choi.ts";
import { chayLaiRoiCham, docNhatKy, LoiNhatKy, type NhatKy, type ThaoTacNhatKy } from "./chung/nhat-ky.ts";
import type { DinhNghiaTroChoi, KetQuaChamBuoc } from "./khung.ts";

export const MA_TRUY_VET = "truy_vet";

export const DIEM_KHOA_DUNG = 5;
export const TRU_KHOA_NHAM = 3;
export const DIEM_CHAN_DUNG = 20;
export const THUONG_MOI_LUOT_DU = 2;
export const THUONG_LUOT_DU_TOI_DA = 10;

/** Độ dài một đoạn cảnh, giây. */
export const GIAY_DOAN = 10;
/** Thời gian xem, tua một đoạn cảnh, giây trong trò. */
export const GIAY_XEM = 15;
/** Mở camera không thấy xe (sai hướng): tốn thêm, giây trong trò. */
export const GIAY_SAI_HUONG = 30;
/** Điểm chặn phải trước xe ít nhất chừng này, giây trong trò. */
export const GIAY_CHAN_TRUOC = 60;
/** Số biến thể lộ trình của một vụ; mỗi lượt chọn một biến thể. Bộ kiểm thử đủ mọi biến thể. */
export const SO_BIEN_THE = 3;
const NHIP_GIAY = 1_000 / NHIP_MS;

/* ------------------------------------------------------------------ */
/* Xe, màu, biển số                                                    */
/* ------------------------------------------------------------------ */

export const LOAI_XE_TRUY_VET = ["o_to", "xe_may", "xe_tai"] as const;
export type LoaiXeTruyVet = (typeof LOAI_XE_TRUY_VET)[number];
export const TEN_LOAI_XE_TV: Record<LoaiXeTruyVet, string> = {
  o_to: "ô tô con",
  xe_may: "xe máy",
  xe_tai: "xe tải",
};
/**
 * Tốc độ trung bình trong phố theo loại xe, mm/giây (thông số mô phỏng, không phải tốc độ theo quy định):
 * ô tô con 8 m/s (≈ 29 km/h), xe máy 7 m/s, xe tải 6 m/s.
 */
export const TOC_DO_TB_MM_S: Record<LoaiXeTruyVet, number> = { o_to: 8_000, xe_may: 7_000, xe_tai: 6_000 };

/** Số giây đi hết một ô của loại xe (làm tròn lên), để mọi thời điểm là số nguyên. */
export const giayMoiO = (loai: LoaiXeTruyVet, o_m: number) => Math.ceil((o_m * 1_000) / TOC_DO_TB_MM_S[loai]);

export const MAU_XE_TV = ["trang", "den", "bac", "do", "xanh_duong", "vang", "xanh_la"] as const;
export type MauXeTV = (typeof MAU_XE_TV)[number];
export const TEN_MAU_XE: Record<MauXeTV, string> = {
  trang: "trắng",
  den: "đen",
  bac: "bạc",
  do: "đỏ",
  xanh_duong: "xanh dương",
  vang: "vàng",
  xanh_la: "xanh lá",
};

/** Biển số trò chơi (hư cấu): 2 số, 1 chữ, gạch, 3 số, chấm, 2 số. Ví dụ "29A-123.45". */
export const MAU_BIEN_SO = /^\d{2}[A-Z]-\d{3}\.\d{2}$/;
/** Bỏ dấu gạch, dấu chấm: ký tự người báo nhớ được so trên chuỗi này. */
export const kyTuBien = (b: string) => b.replace(/[-.]/g, "");
/** Ký tự che trên biển (không đọc được ở đoạn cảnh). */
export const KY_TU_CHE = "•";
/** Chữ số dễ nhầm với nhau khi nhìn qua camera. */
const NHAM: Readonly<Record<string, string>> = {
  "0": "8",
  "1": "7",
  "3": "8",
  "5": "6",
  "6": "8",
  "7": "1",
  "8": "3",
  "9": "8",
  "2": "7",
  "4": "1",
};

export interface MoTaXe {
  loai: LoaiXeTruyVet;
  mau: MauXeTV;
  /** 2–3 ký tự liền nhau của biển số (không tính gạch, chấm) người báo nhớ được. */
  ky_tu: string;
}

/** Xe có khớp hoàn toàn mô tả không (loại, màu, và biển có đủ các ký tự người báo nhớ). */
export const khopMoTa = (xe: { loai: string; mau: string; bien_so: string }, m: MoTaXe) =>
  xe.loai === m.loai && xe.mau === m.mau && kyTuBien(xe.bien_so).includes(m.ky_tu);

/* ------------------------------------------------------------------ */
/* Màn chơi                                                            */
/* ------------------------------------------------------------------ */

/** Loại xe mồi: cùng màu khác loại; cùng loại, màu, khác biển; cùng loại, màu, biển có chữ số dễ nhầm. */
export type LoaiXeMoi = "khac_loai" | "khac_bien" | "gan_giong";

export interface ThongSoManTruyVet {
  /** Số camera trên lộ trình. */
  camera: number;
  luot_xem: number;
  /** Số chặng giữa hai điểm quan sát mà xe rẽ ở giao lộ không có camera (đoạn khuất phải suy ra). */
  re_khuat: readonly [number, number];
  /** Xe nền trong mỗi đoạn cảnh. */
  xe_nen: number;
  xe_moi: readonly LoaiXeMoi[];
  /** Có che bớt ký tự biển số trong đoạn cảnh. */
  che_bien: boolean;
}

/** GAME_DESIGN §5.17, bảng màn chơi (đề xuất). */
export const THONG_SO_MAN_TRUY_VET: Readonly<Record<number, ThongSoManTruyVet>> = {
  1: { camera: 3, luot_xem: 5, re_khuat: [0, 0], xe_nen: 3, xe_moi: [], che_bien: false },
  2: { camera: 4, luot_xem: 6, re_khuat: [0, 0], xe_nen: 3, xe_moi: ["khac_loai"], che_bien: false },
  3: { camera: 5, luot_xem: 7, re_khuat: [0, 0], xe_nen: 4, xe_moi: ["khac_bien"], che_bien: false },
  4: {
    camera: 6,
    luot_xem: 8,
    re_khuat: [1, 1],
    xe_nen: 4,
    xe_moi: ["khac_loai", "khac_bien"],
    che_bien: true,
  },
  5: {
    camera: 8,
    luot_xem: 10,
    re_khuat: [2, 3],
    xe_nen: 4,
    xe_moi: ["gan_giong", "khac_bien"],
    che_bien: true,
  },
};

export const MAN_TRUY_VET: readonly CauHinhMan[] = [
  {
    so: 1,
    ten: "Màn 1: Làm quen",
    moTa: "3 camera trên đường xe chạy; chỉ một xe cùng màu.",
    caLuotMs: null,
    xpCoBan: 10,
  },
  { so: 2, ten: "Màn 2: Cùng màu", moTa: "4 camera; có xe cùng màu khác loại.", caLuotMs: null, xpCoBan: 12 },
  {
    so: 3,
    ten: "Màn 3: Soi biển số",
    moTa: "5 camera; có xe cùng loại, cùng màu, khác biển.",
    caLuotMs: null,
    xpCoBan: 14,
  },
  {
    so: 4,
    ten: "Màn 4: Rẽ ngõ",
    moTa: "6 camera; xe rẽ ở chỗ không có camera; biển số bị che bớt.",
    caLuotMs: null,
    xpCoBan: 16,
  },
  {
    so: 5,
    ten: "Màn 5: Xe mồi",
    moTa: "8 camera; xe mồi giống mô tả; nhiều đoạn khuất phải suy ra.",
    caLuotMs: null,
    xpCoBan: 18,
  },
];
export const SO_MAN_TRUY_VET = MAN_TRUY_VET.length;
const ganMan = (man: number | undefined) =>
  Math.min(SO_MAN_TRUY_VET, Math.max(1, Number.isInteger(man) ? (man as number) : 1));

/* ------------------------------------------------------------------ */
/* Nội dung một vụ                                                     */
/* ------------------------------------------------------------------ */

export interface CameraVu {
  id: string;
  x: number;
  y: number;
  /** Hướng nhìn (chỉ để vẽ biểu tượng). */
  huong: HuongO;
  /** Tên chỗ đặt, ví dụ "Ngã tư chợ". */
  ten: string;
}

/** Một vụ, lưu ở game_content.payload (game_code = 'truy_vet'). */
export interface PayloadVuTruyVet {
  muc: number;
  ban_do: BanDoO;
  camera: CameraVu[];
  noi_xay_ra: { x: number; y: number; ten: string };
  /** Hướng xe bỏ chạy lúc rời nơi xảy ra. */
  huong_chay: HuongO;
  /** Giờ xảy ra, "HH:MM:SS" (để hiện đồng hồ). */
  gio_xay_ra: string;
  /** Tin báo tới sau chừng này giây. */
  bao_sau_giay: number;
  /** Xe bỏ chạy: loại, màu, biển số đầy đủ, ký tự người báo nhớ được. */
  xe_bo_chay: MoTaXe & { bien_so: string };
  /** Lời tin báo (người soạn viết); phải khớp mô tả. */
  tin_bao: string;
  /** Seed sinh lộ trình, xe mồi, xe nền. */
  seed: string;
  /** URN căn cứ cho màn kết quả; rỗng khi văn bản chưa có trong kho. */
  can_cu: string[];
}

/** Một lỗi nội dung, chỉ đúng phần tử: "vu", "ban_do", "camera:<id>", "xe". */
export interface LoiVu {
  phan_tu: string;
  loi: string;
}

const GIO = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;

/* ------------------------------------------------------------------ */
/* Sinh lộ trình                                                       */
/* ------------------------------------------------------------------ */

export interface LoTrinh {
  bien_the: number;
  /** Các ô xe đi qua, từ nơi xảy ra tới mép bản đồ. */
  o: ToaDoO[];
  /** Giây trong trò xe tới từng ô (o[0] lúc 0). */
  t: number[];
  /** Camera trên lộ trình, theo thứ tự xe đi qua. */
  camera: Array<{ id: string; chi_so: number }>;
}

/** Xác suất rẽ ở giao lộ có camera, và ở giao lộ không có camera (chỉ màn có đoạn khuất). */
const XAC_SUAT_RE_CAMERA = 0.5;
const XAC_SUAT_RE_KHUAT = 0.3;
const SO_LAN_THU = 1_000;
/** Chơi đúng thì còn ít nhất chừng này ô đặt điểm chặn đúng. */
const SO_O_CHAN_TOI_THIEU = 2;
const DAI_TOI_DA = 120;

/** Thời điểm đồng hồ sau khi người chơi mở lần lượt mọi camera trên lộ trình (không sai lần nào). */
export function dongHoLyTuong(lt: LoTrinh, baoSau: number): number {
  let T = baoSau;
  for (const c of lt.camera) {
    const ket = lt.t[c.chi_so]! + GIAY_DOAN / 2;
    if (T < ket) T = ket;
    T += GIAY_XEM;
  }
  return T;
}

/** Số ô từ `p` tới mép bản đồ theo hướng `h`. */
function soOToiMep(l: LuoiO, p: ToaDoO, h: HuongO): number {
  return h === 0 ? p.y : h === 2 ? l.rong - 1 - p.x : h === 4 ? l.cao - 1 - p.y : p.x;
}

/** Chặng từ điểm quan sát `a` tới `b` (chỉ số trên lộ trình) có rẽ ở giao lộ không có camera không. */
function coReKhuat(l: LuoiO, o: readonly ToaDoO[], a: number, b: number): boolean {
  for (let j = a + 1; j < b; j++) {
    if (!laGiaoLo(l, o[j]!)) continue;
    if (huongGiua(o[j - 1]!, o[j]!) !== huongGiua(o[j]!, o[j + 1]!)) return true;
  }
  return false;
}

/**
 * Sinh lộ trình tất định từ seed của vụ và biến thể. Thử tối đa SO_LAN_THU đường đi ngẫu nhiên (theo seed),
 * lấy đường đầu tiên thỏa mọi ràng buộc của màn; không có thì trả null (nội dung không dùng được):
 *  - qua đúng số camera của màn; mỗi chặng giữa hai điểm quan sát là đường ngắn nhất (để thời điểm tính
 *    theo quãng đường khớp lúc xe tới thật);
 *  - số chặng có rẽ khuất nằm trong khoảng của màn; sau camera cuối xe không rẽ ở giao lộ nào;
 *  - chơi đúng thì còn ít nhất SO_O_CHAN_TOI_THIEU ô đặt điểm chặn đúng.
 */
export function sinhLoTrinh(p: PayloadVuTruyVet, bienThe: number): LoTrinh | null {
  const ts = THONG_SO_MAN_TRUY_VET[p.muc];
  if (!ts) return null;
  const l = dungLuoi(p.ban_do);
  const A = { x: p.noi_xay_ra.x, y: p.noi_xay_ra.y };
  if (!laDuong(l, A)) return null;
  const camTaiO = new Map(p.camera.map((c) => [chiSo(l, c), c.id]));
  const kc = new Map<string, Int32Array>([["", khoangCachTu(l, A)]]);
  for (const c of p.camera) kc.set(c.id, khoangCachTu(l, c));
  const gmo = giayMoiO(p.xe_bo_chay.loai, p.ban_do.o_m);
  const rng = taoRng(`${p.seed}#lo-trinh#${bienThe}`);
  const xsKhuat = ts.re_khuat[1] === 0 ? 0 : ts.re_khuat[1] === 1 ? XAC_SUAT_RE_KHUAT / 2 : XAC_SUAT_RE_KHUAT;

  for (let lan = 0; lan < SO_LAN_THU; lan++) {
    const o: ToaDoO[] = [A];
    const daQua = new Set([chiSo(l, A)]);
    let h: HuongO = p.huong_chay;
    let hong = false;
    let soCam = 0;
    for (;;) {
      const cuoi = o.at(-1)!;
      const thang = keTheoHuong(cuoi, h);
      if (o.length > 1 && !trongLuoi(l, thang)) break; // ra khỏi bản đồ
      if (o.length > DAI_TOI_DA) {
        hong = true;
        break;
      }
      let chon: HuongO | null = null;
      if (o.length === 1) chon = laDuong(l, thang) ? h : null;
      else {
        const conDi = keDuong(l, cuoi)
          .filter((k) => k.huong !== quayLai(h) && !daQua.has(chiSo(l, k.o)))
          .map((k) => k.huong);
        const re = conDi.filter((x) => x !== h);
        const thangDuoc = conDi.includes(h);
        if (laGiaoLo(l, cuoi) && conDi.length) {
          // Rẽ theo xác suất của loại giao lộ; khi chưa qua đủ camera thì ít đi về phía sắp ra khỏi bản đồ.
          const xs = camTaiO.has(chiSo(l, cuoi)) ? XAC_SUAT_RE_CAMERA : xsKhuat;
          const trongSo = conDi.map(
            (d) =>
              (thangDuoc ? (d === h ? 1 - xs : xs / re.length) : 1 / conDi.length) *
              (soCam < ts.camera && soOToiMep(l, cuoi, d) < 4 ? 0.1 : 1),
          );
          const tong = trongSo.reduce((s, w) => s + w, 0);
          let r = rng() * tong;
          chon = tong > 0 ? conDi.at(-1)! : null;
          for (let i = 0; i < conDi.length; i++) {
            r -= trongSo[i]!;
            if (r < 0) {
              chon = conDi[i]!;
              break;
            }
          }
        } else chon = thangDuoc ? h : (re[0] ?? null);
      }
      if (chon === null) {
        // Ngõ cụt, hoặc đường vòng về ô đã qua; ô mép bản đồ mà đi thẳng ra ngoài được thì đã dừng ở trên.
        hong = true;
        break;
      }
      h = chon;
      const tiep = keTheoHuong(cuoi, h);
      daQua.add(chiSo(l, tiep));
      if (camTaiO.has(chiSo(l, tiep))) soCam++;
      o.push(tiep);
    }
    if (hong || o.length < 4) continue;

    const camera = o
      .map((x, i) => ({ id: camTaiO.get(chiSo(l, x)), chi_so: i }))
      .filter((c): c is { id: string; chi_so: number } => c.id !== undefined && c.chi_so > 0);
    if (camera.length !== ts.camera || camera[0]!.chi_so < 1) continue;
    // Mỗi chặng là đường ngắn nhất; đếm chặng có rẽ khuất.
    let dung = true;
    let soKhuat = 0;
    let truoc = { id: "", chi_so: 0 };
    for (const c of camera) {
      if (kc.get(truoc.id)![chiSo(l, o[c.chi_so]!)] !== c.chi_so - truoc.chi_so) {
        dung = false;
        break;
      }
      if (coReKhuat(l, o, truoc.chi_so, c.chi_so)) soKhuat++;
      truoc = c;
    }
    if (!dung || soKhuat < ts.re_khuat[0] || soKhuat > ts.re_khuat[1]) continue;
    if (coReKhuat(l, o, truoc.chi_so, o.length - 1)) continue;
    const t = o.map((_, i) => i * gmo);
    const lt: LoTrinh = { bien_the: bienThe, o, t, camera };
    const T = dongHoLyTuong(lt, p.bao_sau_giay);
    const soChan = t.filter((x, i) => i > truoc.chi_so && x >= T + GIAY_CHAN_TRUOC).length;
    if (soChan < SO_O_CHAN_TOI_THIEU) continue;
    return lt;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Kiểm nội dung                                                       */
/* ------------------------------------------------------------------ */

const soTrong = (v: unknown, tu: number, den: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= tu && v <= den;
const laHuongO = (v: unknown): v is HuongO => (HUONG_O as readonly unknown[]).includes(v);

/** Kiểm một vụ; chạy sinh lộ trình cho mọi biến thể. Rỗng là hợp lệ. */
export function kiemTraVu(p: Partial<PayloadVuTruyVet> | null | undefined): LoiVu[] {
  const loi: LoiVu[] = [];
  const them = (phan_tu: string, l: string) => loi.push({ phan_tu, loi: l });
  if (!p || typeof p !== "object") return [{ phan_tu: "vu", loi: "Thiếu nội dung vụ." }];
  const ts = Number.isInteger(p.muc) ? THONG_SO_MAN_TRUY_VET[p.muc as number] : undefined;
  if (!ts) them("vu", `Màn (muc) phải từ 1 đến ${SO_MAN_TRUY_VET}.`);
  for (const l of kiemTraBanDo(p.ban_do)) them("ban_do", l);
  if (typeof p.gio_xay_ra !== "string" || !GIO.test(p.gio_xay_ra))
    them("vu", "Giờ xảy ra phải dạng HH:MM:SS.");
  if (!soTrong(p.bao_sau_giay, 30, 180)) them("vu", "Tin báo tới sau 30 đến 180 giây (số nguyên).");
  if (!laHuongO(p.huong_chay)) them("vu", "Hướng chạy phải là 0, 2, 4 hoặc 6.");
  if (typeof p.seed !== "string" || !p.seed.trim()) them("vu", "Thiếu seed.");
  if (!Array.isArray(p.can_cu) || p.can_cu.some((u) => typeof u !== "string"))
    them("vu", "Căn cứ phải là mảng URN.");
  const x = p.xe_bo_chay;
  if (!x || typeof x !== "object") them("xe", "Thiếu mô tả xe bỏ chạy.");
  else {
    if (!(LOAI_XE_TRUY_VET as readonly string[]).includes(x.loai)) them("xe", "Loại xe không hợp lệ.");
    if (!(MAU_XE_TV as readonly string[]).includes(x.mau)) them("xe", "Màu xe không hợp lệ.");
    if (typeof x.bien_so !== "string" || !MAU_BIEN_SO.test(x.bien_so))
      them("xe", "Biển số phải dạng 29A-123.45 (biển hư cấu).");
    else if (
      typeof x.ky_tu !== "string" ||
      !/^[0-9A-Z]{2,3}$/.test(x.ky_tu) ||
      !kyTuBien(x.bien_so).includes(x.ky_tu)
    )
      them("xe", "Ký tự người báo nhớ phải là 2–3 ký tự liền nhau của biển số (không tính gạch, chấm).");
  }
  if (typeof p.tin_bao !== "string" || p.tin_bao.trim().length < 20) them("vu", "Cần lời tin báo.");
  else if (x && typeof x.ky_tu === "string" && !p.tin_bao.includes(x.ky_tu))
    them("vu", "Lời tin báo phải nêu các ký tự biển số người báo nhớ.");
  else if (x && Object.hasOwn(TEN_MAU_XE, x.mau) && !p.tin_bao.includes(TEN_MAU_XE[x.mau as MauXeTV]))
    them("vu", "Lời tin báo phải nêu màu xe.");
  if (loi.length || !p.ban_do) return loi;

  const l = dungLuoi(p.ban_do);
  const A = p.noi_xay_ra;
  if (!A || !laDuong(l, { x: A.x, y: A.y })) them("vu", "Nơi xảy ra phải là một ô đường.");
  else if (typeof A.ten !== "string" || !A.ten.trim()) them("vu", "Cần tên nơi xảy ra.");
  else if (!laDuong(l, keTheoHuong(A, p.huong_chay as HuongO)))
    them("vu", "Ô kề theo hướng chạy phải là đường.");
  if (!Array.isArray(p.camera) || !p.camera.length) {
    them("vu", "Cần danh sách camera.");
    return loi;
  }
  for (const c of p.camera) {
    if (typeof c?.id !== "string" || !/^[a-z0-9-]{1,12}$/.test(c.id))
      them("vu", "Mã camera chỉ gồm chữ thường, số, gạch nối.");
    else if (!laHuongO(c.huong) || typeof c.ten !== "string" || !c.ten.trim())
      them(`camera:${c.id}`, `Camera ${c.id} cần hướng nhìn và tên chỗ đặt.`);
    else if (laDuong(l, c) && keDuong(l, c).length < 2)
      them(`camera:${c.id}`, `Camera ${c.id} phải đặt ở chỗ có ít nhất hai nhánh đường.`);
  }
  for (const k of kiemTraDatVat(
    l,
    p.camera.map((c) => ({ id: c.id, loai: "camera", x: c.x, y: c.y })),
    { camera: { loai_o: ["duong"], cach_toi_thieu: 2 } },
  ))
    them(`camera:${k.vat}`, k.loi);
  if (ts && p.camera.length < ts.camera + 1)
    them(
      "vu",
      `Màn ${p.muc} cần ít nhất ${ts.camera + 1} camera trên bản đồ (${ts.camera} trên đường xe chạy và camera khác).`,
    );
  if (A && p.camera.some((c) => c.x === A.x && c.y === A.y)) them("vu", "Nơi xảy ra không trùng ô camera.");
  if (loi.length) return loi;
  for (let b = 0; b < SO_BIEN_THE; b++)
    if (!sinhLoTrinh(p as PayloadVuTruyVet, b))
      them(
        "vu",
        `Biến thể ${b + 1}: không sinh được lộ trình qua đúng ${ts!.camera} camera, đúng số đoạn khuất của màn và còn chỗ đặt điểm chặn. Thêm camera ở giao lộ hoặc đổi seed.`,
      );
  return loi;
}

/* ------------------------------------------------------------------ */
/* Nhật ký và trạng thái                                               */
/* ------------------------------------------------------------------ */

export const THAO_TAC_TRUY_VET = ["mo", "khoa", "chan"] as const;
export type ThaoTacTruyVet = (typeof THAO_TAC_TRUY_VET)[number];
export type ThamSoTruyVet =
  | { camera: string; cho: boolean }
  | { doan: number; xe: string }
  | { x: number; y: number };
export type TraLoiTruyVet = NhatKy<ThaoTacTruyVet, ThamSoTruyVet>;
export type BuocNhatKyTV = ThaoTacNhatKy<ThaoTacTruyVet, ThamSoTruyVet>;

/** Một đoạn cảnh đã mở. */
export interface DoanDaMo {
  so: number;
  camera: string;
  /** Thời điểm tính theo quãng đường (giữa đoạn, trước khi lệch), giây trong trò. */
  t: number;
  /** Giây trong trò lúc đoạn bắt đầu. */
  bat_dau: number;
  cho: boolean;
  khoa: string | null;
}

export interface TrangThaiTruyVet {
  dong_ho: number;
  con_luot: number;
  /** Mốc khóa gần nhất: ô và giờ. Chưa khóa thì là nơi xảy ra lúc 0. */
  moc: { camera: string | null; x: number; y: number; t: number };
  doan: DoanDaMo[];
  chan: { x: number; y: number } | null;
}

export type MaLoiMo =
  | "khong_co_camera"
  | "het_luot"
  | "chua_toi_gio"
  | "da_xem"
  | "khong_toi_duoc"
  | "da_chan"
  | "khoa_sai"
  | "chan_sai";

export interface LoiThaoTac {
  ma: MaLoiMo;
  thong_bao: string;
  /** chua_toi_gio: số giây trong trò phải chờ. */
  cho_giay?: number;
}

/** Phần một vụ cần để chạy nhật ký (ảnh chụp bước có, gói offline có). */
export interface VuDaDung {
  vu: PayloadVuTruyVet;
  luoi: LuoiO;
  gmo: number;
  bi_mat: string;
}

export function dungVu(vu: PayloadVuTruyVet, bi_mat: string): VuDaDung {
  return { vu, luoi: dungLuoi(vu.ban_do), gmo: giayMoiO(vu.xe_bo_chay.loai, vu.ban_do.o_m), bi_mat };
}

export function trangThaiDauTV(vu: PayloadVuTruyVet): TrangThaiTruyVet {
  const ts = THONG_SO_MAN_TRUY_VET[vu.muc]!;
  return {
    dong_ho: vu.bao_sau_giay,
    con_luot: ts.luot_xem,
    moc: { camera: null, x: vu.noi_xay_ra.x, y: vu.noi_xay_ra.y, t: 0 },
    doan: [],
    chan: null,
  };
}

/** Thời điểm đoạn cảnh của camera tính từ mốc khóa gần nhất; null khi không có đường tới. */
export function thoiDiemCamera(
  v: Pick<VuDaDung, "luoi" | "gmo">,
  tt: TrangThaiTruyVet,
  cam: ToaDoO,
): number | null {
  const d = khoangCachTu(v.luoi, tt.moc)[chiSo(v.luoi, cam)]!;
  return d < 0 ? null : tt.moc.t + d * v.gmo;
}

/** Lệch đầu đoạn cảnh (−2…2 giây) theo bí mật của lượt, để xe cần tìm không luôn ở đúng giữa đoạn. */
const lechDoan = (bi_mat: string, camera: string, t: number) =>
  Math.floor(taoRng(`${bi_mat}|lech|${camera}|${t}`)() * 5) - 2;

/**
 * Áp một thao tác lên trạng thái (hàm dùng chung cho route của trò, điện thoại offline và bộ chấm). Trả
 * trạng thái mới hoặc lỗi; không sửa trạng thái cũ. Mọi lỗi là lỗi của thao tác, không phải lỗi lập trình.
 */
export function apThaoTacTV(
  v: VuDaDung,
  tt: TrangThaiTruyVet,
  op: { thao_tac: ThaoTacTruyVet; tham_so: ThamSoTruyVet },
  loTrinh: LoTrinh | null,
): { tt: TrangThaiTruyVet } | { loi: LoiThaoTac } {
  if (tt.chan) return { loi: { ma: "da_chan", thong_bao: "Đã đặt điểm chặn, vụ đã khép lại." } };
  if (op.thao_tac === "khoa") {
    const { doan, xe } = op.tham_so as { doan: number; xe: string };
    const cuoi = tt.doan.at(-1);
    if (!cuoi || doan !== cuoi.so || cuoi.khoa !== null)
      return { loi: { ma: "khoa_sai", thong_bao: "Chỉ khóa được một xe trong đoạn cảnh vừa mở." } };
    if (!xeTrongDoan(v, cuoi, loTrinh).some((x) => x.id === xe))
      return { loi: { ma: "khoa_sai", thong_bao: "Đoạn cảnh không có xe này." } };
    const cam = v.vu.camera.find((c) => c.id === cuoi.camera)!;
    const moi = [...tt.doan.slice(0, -1), { ...cuoi, khoa: xe }];
    return { tt: { ...tt, doan: moi, moc: { camera: cam.id, x: cam.x, y: cam.y, t: cuoi.t } } };
  }
  if (op.thao_tac === "chan") {
    const { x, y } = op.tham_so as { x: number; y: number };
    if (!laDuong(v.luoi, { x, y }))
      return { loi: { ma: "chan_sai", thong_bao: "Điểm chặn phải đặt trên đường." } };
    return { tt: { ...tt, chan: { x, y } } };
  }
  const { camera, cho } = op.tham_so as { camera: string; cho: boolean };
  const cam = v.vu.camera.find((c) => c.id === camera);
  if (!cam) return { loi: { ma: "khong_co_camera", thong_bao: "Không có camera này." } };
  if (tt.con_luot <= 0) return { loi: { ma: "het_luot", thong_bao: "Đã hết lượt xem camera." } };
  const t = thoiDiemCamera(v, tt, cam);
  if (t === null) return { loi: { ma: "khong_toi_duoc", thong_bao: "Không có đường tới camera này." } };
  if (tt.doan.some((d) => d.camera === camera && d.t === t))
    return { loi: { ma: "da_xem", thong_bao: "Đã xem đoạn cảnh này." } };
  let dongHo = tt.dong_ho;
  const ket = t + GIAY_DOAN / 2;
  if (dongHo < ket) {
    if (!cho)
      return {
        loi: {
          ma: "chua_toi_gio",
          thong_bao: "Xe chưa thể tới camera này ở thời điểm hiện tại.",
          cho_giay: ket - dongHo,
        },
      };
    dongHo = ket;
  }
  const doan: DoanDaMo = {
    so: tt.doan.length,
    camera,
    t,
    bat_dau: t - GIAY_DOAN / 2 + lechDoan(v.bi_mat, camera, t),
    cho: Boolean(cho),
    khoa: null,
  };
  dongHo += GIAY_XEM;
  if (loTrinh && !xeQuaDoan(v, loTrinh, doan)) dongHo += GIAY_SAI_HUONG;
  return { tt: { ...tt, dong_ho: dongHo, con_luot: tt.con_luot - 1, doan: [...tt.doan, doan] } };
}

/** Lúc (giây) xe bỏ chạy qua ô camera trong đoạn cảnh, hoặc null khi không qua. */
export function xeQuaDoan(v: VuDaDung, lt: LoTrinh, d: Pick<DoanDaMo, "camera" | "bat_dau">): number | null {
  const cam = v.vu.camera.find((c) => c.id === d.camera);
  if (!cam) return null;
  const i = lt.o.findIndex((o) => cungO(o, cam));
  if (i < 0) return null;
  const t = lt.t[i]!;
  return t >= d.bat_dau + 1 && t <= d.bat_dau + GIAY_DOAN - 1 ? t : null;
}

/**
 * Chạy lại nhật ký từ đầu. Thao tác không hợp lệ thì ném LoiNhatKy (bộ chấm coi cả bước 0 điểm).
 * `loTrinh` null: chạy không có lộ trình (điện thoại online không có), sai hướng không cộng giờ.
 */
export function chayNhatKyTV(
  v: VuDaDung,
  ops: ReadonlyArray<{ thao_tac: ThaoTacTruyVet; tham_so: ThamSoTruyVet }>,
  loTrinh: LoTrinh | null,
): TrangThaiTruyVet {
  let tt = trangThaiDauTV(v.vu);
  for (const op of ops) {
    const kq = apThaoTacTV(v, tt, op, loTrinh);
    if ("loi" in kq) throw new LoiNhatKy(kq.loi.thong_bao);
    tt = kq.tt;
  }
  return tt;
}

/* ------------------------------------------------------------------ */
/* Đoạn cảnh                                                           */
/* ------------------------------------------------------------------ */

/** Một xe trong đoạn cảnh. `vai` chỉ có ở máy chủ và bộ chấm, không gửi người chơi. */
export interface XeDoan {
  id: string;
  loai: LoaiXeTruyVet;
  mau: MauXeTV;
  /** Biển như thấy trên camera (có thể bị che bớt ký tự). */
  bien_so: string;
  /** Nhánh xe đi vào (hướng từ tâm ra nhánh đó) và nhánh xe đi ra. */
  vao: HuongO;
  ra: HuongO;
  /** Giây (tính từ đầu đoạn, có thể lẻ 0,05) xe qua tâm ngã tư. */
  qua_tam: number;
  /** Tốc độ tối đa, mm mỗi nhịp. */
  v_max: number;
  vai: "bo_chay" | "moi" | "nen";
}

/** Đoạn cảnh gửi cho người chơi: đủ để điện thoại tự chạy M5 và vẽ. */
export interface DoanCanh {
  so: number;
  camera: string;
  /** Giây trong trò lúc đoạn bắt đầu. */
  bat_dau: number;
  /** Nhánh đường quanh camera. */
  nhanh: HuongO[];
  xe: Array<Omit<XeDoan, "vai" | "qua_tam"> & { nhip_vao: number }>;
}

/** Ký tự biển số ngẫu nhiên. */
const CHU_BIEN = "ABCDEFGHKLMNPSTUVXYZ";
function bienNgauNhien(rng: () => number, tranh: string): string {
  for (;;) {
    const s = (n: number) => Array.from({ length: n }, () => Math.floor(rng() * 10)).join("");
    const b = `${10 + Math.floor(rng() * 89)}${CHU_BIEN[Math.floor(rng() * CHU_BIEN.length)]}-${s(3)}.${s(2)}`;
    if (!kyTuBien(b).includes(tranh)) return b;
  }
}

/** Biển gần giống: thay một chữ số trong nhóm ký tự người báo nhớ bằng chữ số dễ nhầm. */
function bienGanGiong(rng: () => number, goc: string, kyTu: string): string {
  const k = kyTuBien(goc);
  const dau = k.indexOf(kyTu);
  const viTri = [...kyTu].map((c, i) => (NHAM[c] ? dau + i : -1)).filter((i) => i >= 0);
  const doi = viTri.length ? viTri[Math.floor(rng() * viTri.length)]! : dau;
  const moi = k.slice(0, doi) + (NHAM[k[doi]!] ?? (k[doi] === "A" ? "4" : "A")) + k.slice(doi + 1);
  const b = `${moi.slice(0, 3)}-${moi.slice(3, 6)}.${moi.slice(6)}`;
  return kyTuBien(b).includes(kyTu) ? bienNgauNhien(rng, kyTu) : b;
}

export interface XeMoi {
  loai: LoaiXeTruyVet;
  mau: MauXeTV;
  bien_so: string;
  kieu: LoaiXeMoi;
}

/** Xe mồi của lượt: cố định hình dáng trong cả lượt, sinh từ bí mật của lượt. */
export function xeMoiCuaLuot(v: VuDaDung): XeMoi[] {
  const ts = THONG_SO_MAN_TRUY_VET[v.vu.muc]!;
  const m = v.vu.xe_bo_chay;
  return ts.xe_moi.map((kieu, i) => {
    const rng = taoRng(`${v.bi_mat}|moi|${i}`);
    if (kieu === "khac_loai") {
      const loai = LOAI_XE_TRUY_VET.filter((l) => l !== m.loai)[Math.floor(rng() * 2)]!;
      return { kieu, loai, mau: m.mau, bien_so: bienNgauNhien(rng, m.ky_tu) };
    }
    if (kieu === "khac_bien") return { kieu, loai: m.loai, mau: m.mau, bien_so: bienNgauNhien(rng, m.ky_tu) };
    return { kieu, loai: m.loai, mau: m.mau, bien_so: bienGanGiong(rng, m.bien_so, m.ky_tu) };
  });
}

/** Nhánh đường quanh ô camera. */
export const nhanhCamera = (v: Pick<VuDaDung, "luoi">, cam: ToaDoO): HuongO[] =>
  keDuong(v.luoi, cam).map((k) => k.huong);

/** Khoảng cách tối thiểu giữa hai xe qua tâm, giây; hai xe cùng nhánh vào hoặc cùng nhánh ra. */
const CACH_QUA_TAM = 2.5;
const CACH_CUNG_NHANH = 4;

/**
 * Các xe trong một đoạn cảnh, tất định theo (bí mật của lượt, số đoạn, camera, giờ). Không chạy mô phỏng,
 * nên bộ chấm gọi lại được rẻ. Xe bỏ chạy có mặt khi lộ trình qua camera trong đoạn.
 */
export function xeTrongDoan(
  v: VuDaDung,
  d: Pick<DoanDaMo, "so" | "camera" | "bat_dau">,
  loTrinh: LoTrinh | null,
): XeDoan[] {
  const ts = THONG_SO_MAN_TRUY_VET[v.vu.muc]!;
  const cam = v.vu.camera.find((c) => c.id === d.camera)!;
  const rng = taoRng(`${v.bi_mat}|doan|${d.so}|${d.camera}|${d.bat_dau}`);
  const nhanh = nhanhCamera(v, cam);
  const m = v.vu.xe_bo_chay;
  const daDung = new Set<string>();
  const idMoi = () => {
    for (;;) {
      const id = `x${Math.floor(rng() * 36 ** 4)
        .toString(36)
        .padStart(4, "0")}`;
      if (!daDung.has(id)) {
        daDung.add(id);
        return id;
      }
    }
  };
  const quaTam: Array<{ g: number; vao: HuongO; ra: HuongO }> = [];
  // Hai xe cùng nhánh vào hoặc cùng nhánh ra phải cách xa hơn: xe rẽ chạy chậm, xe sau dễ đuổi kịp.
  const chonGio = (vao: HuongO, ra: HuongO): number | null => {
    for (let i = 0; i < 12; i++) {
      const g = Math.round((1 + rng() * (GIAY_DOAN - 2)) * NHIP_GIAY) / NHIP_GIAY;
      if (
        quaTam.every(
          (q) => Math.abs(q.g - g) >= (q.vao === vao || q.ra === ra ? CACH_CUNG_NHANH : CACH_QUA_TAM),
        )
      )
        return g;
    }
    return null;
  };
  const nhanhNgauNhien = (): [HuongO, HuongO] => {
    const vao = nhanh[Math.floor(rng() * nhanh.length)]!;
    const ra = nhanh.filter((h) => h !== vao);
    return [vao, ra.length ? ra[Math.floor(rng() * ra.length)]! : vao];
  };
  const vMax = (loai: LoaiXeTruyVet, lech: boolean) => {
    const goc = TOC_DO_TB_MM_S[loai] / NHIP_GIAY;
    return lech ? Math.round(goc * (0.9 + rng() * 0.2)) : goc;
  };
  const kq: XeDoan[] = [];

  // Xe bỏ chạy.
  const qua = loTrinh ? xeQuaDoan(v, loTrinh, { camera: d.camera, bat_dau: d.bat_dau }) : null;
  if (loTrinh && qua !== null) {
    const i = loTrinh.o.findIndex((o) => cungO(o, cam));
    const g = qua - d.bat_dau;
    const vao = huongGiua(cam, loTrinh.o[i - 1]!)!;
    const ra = huongGiua(cam, loTrinh.o[i + 1]!)!;
    quaTam.push({ g, vao, ra });
    kq.push({
      id: idMoi(),
      loai: m.loai,
      mau: m.mau,
      bien_so: m.bien_so,
      vao,
      ra,
      qua_tam: g,
      v_max: vMax(m.loai, false),
      vai: "bo_chay",
    });
  }
  // Xe mồi: đoạn có xe bỏ chạy thì xe mồi đầu luôn có mặt; còn lại mỗi xe một nửa khả năng.
  xeMoiCuaLuot(v).forEach((x, i) => {
    const co = rng() < (qua !== null && i === 0 ? 1 : 0.5);
    if (!co) return;
    const [vao, ra] = nhanhNgauNhien();
    const g = chonGio(vao, ra);
    if (g === null) return;
    quaTam.push({ g, vao, ra });
    kq.push({
      id: idMoi(),
      loai: x.loai,
      mau: x.mau,
      bien_so: x.bien_so,
      vao,
      ra,
      qua_tam: g,
      v_max: vMax(x.loai, true),
      vai: "moi",
    });
  });
  // Xe nền: không khớp mô tả; màn 1 không có xe cùng màu.
  for (let n = 0; n < ts.xe_nen; n++) {
    let loai = LOAI_XE_TRUY_VET[Math.floor(rng() * 3)]!;
    let mau = MAU_XE_TV[Math.floor(rng() * MAU_XE_TV.length)]!;
    if (mau === m.mau && (v.vu.muc === 1 || loai === m.loai)) {
      mau =
        MAU_XE_TV[
          (MAU_XE_TV.indexOf(mau) + 1 + Math.floor(rng() * (MAU_XE_TV.length - 1))) % MAU_XE_TV.length
        ]!;
      if (mau === m.mau) loai = LOAI_XE_TRUY_VET[(LOAI_XE_TRUY_VET.indexOf(loai) + 1) % 3]!;
    }
    const bien = bienNgauNhien(rng, m.ky_tu);
    const [vao, ra] = nhanhNgauNhien();
    const g = chonGio(vao, ra);
    if (g === null) continue;
    quaTam.push({ g, vao, ra });
    kq.push({
      id: idMoi(),
      loai,
      mau,
      bien_so: bien,
      vao,
      ra,
      qua_tam: g,
      v_max: vMax(loai, true),
      vai: "nen",
    });
  }
  // Che bớt một chữ số của biển (màn 4, 5).
  if (ts.che_bien)
    for (const x of kq) {
      if (rng() >= 0.5) continue;
      const so = [...x.bien_so].map((c, i) => (/\d/.test(c) ? i : -1)).filter((i) => i >= 0);
      const i = so[Math.floor(rng() * so.length)]!;
      x.bien_so = x.bien_so.slice(0, i) + KY_TU_CHE + x.bien_so.slice(i + 1);
    }
  // Thứ tự gửi đi ngẫu nhiên, không để xe bỏ chạy luôn đứng đầu.
  return tron(kq, rng);
}

/* ------------------------------------------------------------------ */
/* Cảnh ngã tư cho M5                                                  */
/* ------------------------------------------------------------------ */

/** Nửa cạnh khung nhìn camera, cm. */
export const NUA_KHUNG_CM = 3_000;
/** Làn vào dài tới đây (ngoài khung) để xe kịp chạy đều trước khi hiện. */
const DAI_LAN_CM = 6_000;
/** Nửa cạnh ô ngã tư, cm. */
const NUA_NGA_TU_CM = 700;
const LECH_LAN_CM = 175;
/** Nhịp chạy trước khi đoạn bắt đầu (xe đã vào đường từ ngoài khung). */
export const NHIP_DAN = 12 * NHIP_GIAY;
export const NHIP_DOAN = GIAY_DOAN * NHIP_GIAY;

const don = (h: HuongO) => BUOC_HUONG[h] as readonly [number, number];
const phai = (h: HuongO) => don(((h + 2) % 8) as HuongO);
const cong = (...ds: Array<readonly [number, number, number]>): Diem => ({
  x: ds.reduce((s, [k, a]) => s + k * a, 0),
  y: ds.reduce((s, [k, , b]) => s + k * b, 0),
});
const vec = (k: number, v: readonly [number, number]) => [k, v[0], v[1]] as const;

/** Làn vào từ nhánh `n` (xe đi theo hướng ngược lại), làn ra theo nhánh `n`, làn qua ngã tư. */
export function lanNgaTu(nhanh: readonly HuongO[]): Lan[] {
  const lan: Lan[] = [];
  const v = 500;
  for (const n of nhanh) {
    const h = quayLai(n);
    lan.push({
      id: `vao-${n}`,
      diem: [
        cong(vec(DAI_LAN_CM, don(n)), vec(LECH_LAN_CM, phai(h))),
        cong(vec(NUA_NGA_TU_CM, don(n)), vec(LECH_LAN_CM, phai(h))),
      ],
      toc_do_toi_da: v,
    });
    lan.push({
      id: `ra-${n}`,
      diem: [
        cong(vec(NUA_NGA_TU_CM, don(n)), vec(LECH_LAN_CM, phai(n))),
        cong(vec(DAI_LAN_CM, don(n)), vec(LECH_LAN_CM, phai(n))),
      ],
      toc_do_toi_da: v,
    });
  }
  for (const a of nhanh)
    for (const b of nhanh) {
      if (a === b) continue;
      const h = quayLai(a);
      const dau = cong(vec(NUA_NGA_TU_CM, don(a)), vec(LECH_LAN_CM, phai(h)));
      const cuoi = cong(vec(NUA_NGA_TU_CM, don(b)), vec(LECH_LAN_CM, phai(b)));
      const diem =
        b === h ? [dau, cuoi] : [dau, cong(vec(LECH_LAN_CM, phai(h)), vec(LECH_LAN_CM, phai(b))), cuoi];
      lan.push({ id: `qua-${a}-${b}`, diem, toc_do_toi_da: v });
    }
  return lan;
}

const lanXe = (vao: HuongO, ra: HuongO) =>
  vao === ra
    ? { lan: `vao-${vao}`, lo_trinh: [] }
    : { lan: `vao-${vao}`, lo_trinh: [`qua-${vao}-${ra}`, `ra-${ra}`] };

/** Số nhịp từ lúc vào đường tới lúc qua tâm ngã tư của một xe chạy một mình (chạy M5 một lần, nhớ lại). */
const nhoNhipToiTam = new Map<string, number>();
export function nhipToiTam(vao: HuongO, ra: HuongO, v_max: number): number {
  const kieu = ra === quayLai(vao) ? 0 : ra === (vao + 6) % 8 ? 1 : 2;
  const khoa = `${kieu}|${v_max}`;
  const co = nhoNhipToiTam.get(khoa);
  if (co !== undefined) return co;
  const n = 0 as HuongO;
  const r = kieu === 0 ? 4 : kieu === 1 ? 6 : 2;
  const mp = dungMoPhong({
    lan: lanNgaTu([n, r as HuongO].filter((x, i, a) => a.indexOf(x) === i) as HuongO[]),
    dac_diem: [],
    bien: [],
    xe: [{ id: "a", loai: "o_to", nhip_vao: 0, v_max, ...lanXe(n, r as HuongO) }],
    chay_du_nhip: true,
  });
  // Tâm ngã tư: đi hết làn vào rồi thêm nửa làn qua ngã tư.
  const qua = mp.lan.get(lanXe(n, r as HuongO).lo_trinh[0] ?? "")?.dai ?? 0;
  const muc = (DAI_LAN_CM - NUA_NGA_TU_CM) * 10 + (kieu === 0 ? NUA_NGA_TU_CM * 10 : Math.floor(qua * 5));
  let tt = trangThaiDau(mp);
  let di = 0;
  let nhip = 0;
  while (di < muc && nhip < 2_000) {
    tt = buocMoPhong(mp, tt);
    di += tt.xe[0]!.v;
    nhip++;
  }
  nhoNhipToiTam.set(khoa, nhip);
  return nhip;
}

/**
 * Đoạn cảnh gửi người chơi: xe (bỏ vai) kèm nhịp vào đường. Chạy M5 một lần: còn cặp xe va nhau (xe rẽ chậm
 * bị xe sau đuổi kịp lúc nhập làn) thì bỏ bớt xe nền, rồi xe mồi, không bao giờ bỏ xe bỏ chạy. Xe bị bỏ
 * không hiện nên không khóa được; bộ chấm vẫn nhận ra xe bỏ chạy theo id.
 */
export function dungDoanCanh(v: VuDaDung, d: DoanDaMo, loTrinh: LoTrinh | null): DoanCanh {
  const cam = v.vu.camera.find((c) => c.id === d.camera)!;
  const nhanh = nhanhCamera(v, cam);
  const ds = xeTrongDoan(v, d, loTrinh).map(({ qua_tam, ...x }) => ({
    ...x,
    nhip_vao: Math.max(0, NHIP_DAN + Math.round(qua_tam * NHIP_GIAY) - nhipToiTam(x.vao, x.ra, x.v_max)),
  }));
  const thuTu = { nen: 0, moi: 1, bo_chay: 2 } as const;
  for (let lan = 0; lan < 4; lan++) {
    const dc: DoanCanh = { so: d.so, camera: d.camera, bat_dau: d.bat_dau, nhanh, xe: ds };
    const mp = dungMoPhong(cauHinhDoanCanh(dc));
    let tt = trangThaiDau(mp);
    for (let i = 0; i < NHIP_DAN + NHIP_DOAN; i++) tt = buocMoPhong(mp, tt);
    const vc = tt.su_kien.find((s) => s.loai === "va_cham");
    if (!vc) break;
    const cap = ds
      .filter((x) => x.id === vc.xe || x.id === vc.xe_khac)
      .sort((a, b) => thuTu[a.vai] - thuTu[b.vai]);
    if (!cap.length || cap[0]!.vai === "bo_chay") break;
    ds.splice(ds.indexOf(cap[0]!), 1);
  }
  return { so: d.so, camera: d.camera, bat_dau: d.bat_dau, nhanh, xe: ds.map(({ vai: _v, ...x }) => x) };
}

/** Cấu hình M5 của một đoạn cảnh (điện thoại chạy từ nhịp 0 tới NHIP_DAN + NHIP_DOAN, hiện từ NHIP_DAN). */
export function cauHinhDoanCanh(d: DoanCanh): CauHinhMoPhong {
  const xe: XeKhoiTao[] = d.xe.map((x) => ({
    id: x.id,
    loai: x.loai,
    nhip_vao: x.nhip_vao,
    v_max: x.v_max,
    ...lanXe(x.vao, x.ra),
  }));
  return { lan: lanNgaTu(d.nhanh), dac_diem: [], bien: [], xe, chay_du_nhip: true };
}

/* ------------------------------------------------------------------ */
/* Chấm                                                                */
/* ------------------------------------------------------------------ */

export interface KetQuaDoanTV {
  so: number;
  camera: string;
  bat_dau: number;
  co_xe: boolean;
  khoa: string | null;
  /** null: không khóa. */
  khoa_dung: boolean | null;
  /** Hình dáng xe đã khóa, cho màn kết quả. */
  xe_khoa: { loai: LoaiXeTruyVet; mau: MauXeTV; bien_so: string } | null;
}

export interface ChiTietTruyVet {
  hop_le: boolean;
  ly_do: string | null;
  doan: KetQuaDoanTV[];
  chan: { x: number; y: number; dung: boolean; xe_toi: number | null } | null;
  /** Lộ trình thật (chỉ gửi sau khi chấm). */
  lo_trinh: ToaDoO[];
  lo_trinh_t: number[];
  camera_tren_duong: string[];
  dong_ho: number;
  con_luot: number;
  so_khoa_dung: number;
  so_khoa_nham: number;
  diem_khoa: number;
  diem_chan: number;
  diem_thuong: number;
  gio_xay_ra: string;
}

/** Chấm từ trạng thái cuối. */
export function chamTruyVet(v: VuDaDung, lt: LoTrinh, tt: TrangThaiTruyVet) {
  const doan: KetQuaDoanTV[] = tt.doan.map((d) => {
    const xe = xeTrongDoan(v, d, lt);
    const k = d.khoa ? xe.find((x) => x.id === d.khoa) : undefined;
    return {
      so: d.so,
      camera: d.camera,
      bat_dau: d.bat_dau,
      co_xe: xe.some((x) => x.vai === "bo_chay"),
      khoa: d.khoa,
      khoa_dung: k ? k.vai === "bo_chay" : null,
      xe_khoa: k ? { loai: k.loai, mau: k.mau, bien_so: k.bien_so } : null,
    };
  });
  const dung = doan.filter((d) => d.khoa_dung === true).length;
  const nham = doan.filter((d) => d.khoa_dung === false).length;
  let chan: ChiTietTruyVet["chan"] = null;
  if (tt.chan) {
    const i = lt.o.findIndex((o) => cungO(o, tt.chan!));
    const xeToi = i >= 0 ? lt.t[i]! : null;
    chan = { ...tt.chan, dung: xeToi !== null && xeToi >= tt.dong_ho + GIAY_CHAN_TRUOC, xe_toi: xeToi };
  }
  const diemChan = chan?.dung ? DIEM_CHAN_DUNG : 0;
  const thuong = chan?.dung ? Math.min(THUONG_LUOT_DU_TOI_DA, THUONG_MOI_LUOT_DU * tt.con_luot) : 0;
  const diemKhoa = dung * DIEM_KHOA_DUNG - nham * TRU_KHOA_NHAM;
  return {
    doan,
    chan,
    so_khoa_dung: dung,
    so_khoa_nham: nham,
    diem_khoa: diemKhoa,
    diem_chan: diemChan,
    diem_thuong: thuong,
    diem: Math.max(0, diemKhoa + diemChan + thuong),
  };
}

/** Điểm tối đa của một lượt: khóa đúng ở mọi camera trên lộ trình, chặn đúng, thưởng lượt dư khi xem vừa đủ. */
export const diemToiDaTV = (muc: number) => {
  const ts = THONG_SO_MAN_TRUY_VET[muc]!;
  return (
    ts.camera * DIEM_KHOA_DUNG +
    DIEM_CHAN_DUNG +
    Math.min(THUONG_LUOT_DU_TOI_DA, THUONG_MOI_LUOT_DU * (ts.luot_xem - ts.camera))
  );
};

/* ------------------------------------------------------------------ */
/* Định nghĩa trò                                                      */
/* ------------------------------------------------------------------ */

export interface NguonTruyVet {
  id: string;
  code: string;
  version: number;
  topic_id: string | null;
  vu: PayloadVuTruyVet;
}

/** Ảnh chụp bước: có lộ trình, bí mật của lượt; chỉ máy chủ và gói offline có. */
export interface BuocTruyVet {
  man: number;
  vu: PayloadVuTruyVet;
  bi_mat: string;
  lo_trinh: LoTrinh;
  /** Nhật ký route của trò ghi (lượt online): "mo", "khoa" theo thứ tự. */
  nhat_ky: BuocNhatKyTV[];
}

/** Phần đề gửi người chơi: không lộ trình, không seed, không biển số đầy đủ của xe bỏ chạy. */
export interface DeTruyVet {
  man: number;
  ban_do: BanDoO;
  camera: CameraVu[];
  noi_xay_ra: { x: number; y: number; ten: string };
  gio_xay_ra: string;
  tin_bao: { loi: string; mo_ta: MoTaXe; huong: HuongO };
  giay_moi_o: number;
  luot_xem: number;
  bao_sau_giay: number;
  giay_xem: number;
  giay_sai_huong: number;
  giay_chan_truoc: number;
  /** Đoạn cảnh đã mở (lượt online, dựng từ nhật ký của route; vào lại lượt thì có sẵn). */
  da_mo: DoanCanh[];
  trang_thai: TrangThaiTruyVet;
}

/** Đề từ vụ và trạng thái hiện tại (dùng cho đề của khung và phản hồi của route). */
export function deTuVu(b: Pick<BuocTruyVet, "man" | "vu" | "bi_mat" | "lo_trinh" | "nhat_ky">): DeTruyVet {
  const v = dungVu(b.vu, b.bi_mat);
  let tt = trangThaiDauTV(b.vu);
  try {
    tt = chayNhatKyTV(v, b.nhat_ky, b.lo_trinh);
  } catch {
    // Nhật ký của route luôn hợp lệ; lỗi (không xảy ra) thì coi như chưa mở camera nào.
  }
  const ts = THONG_SO_MAN_TRUY_VET[b.man]!;
  const m = b.vu.xe_bo_chay;
  return {
    man: b.man,
    ban_do: b.vu.ban_do,
    camera: b.vu.camera,
    noi_xay_ra: b.vu.noi_xay_ra,
    gio_xay_ra: b.vu.gio_xay_ra,
    tin_bao: {
      loi: b.vu.tin_bao,
      mo_ta: { loai: m.loai, mau: m.mau, ky_tu: m.ky_tu },
      huong: b.vu.huong_chay,
    },
    giay_moi_o: v.gmo,
    luot_xem: ts.luot_xem,
    bao_sau_giay: b.vu.bao_sau_giay,
    giay_xem: GIAY_XEM,
    giay_sai_huong: GIAY_SAI_HUONG,
    giay_chan_truoc: GIAY_CHAN_TRUOC,
    da_mo: tt.doan.map((d) => dungDoanCanh(v, d, b.lo_trinh)),
    trang_thai: tt,
  };
}

const laChuoiNgan = (v: unknown, max = 40): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max;

export const TRO_CHOI_TRUY_VET: DinhNghiaTroChoi<BuocTruyVet, DeTruyVet, TraLoiTruyVet> = {
  ma: MA_TRUY_VET,
  ten: "Truy vết xe bỏ trốn",
  moTa: "Đọc tin báo, lần theo xe gây tai nạn qua các camera, khóa đúng xe và đặt điểm chặn.",
  offline: true,
  nguon: "truy_vet_vu",
  soBuoc: 1,
  thoiGian: null,
  thuongNhanh: false,
  xpCoBan: 10,
  manChoi: MAN_TRUY_VET,

  locNguon(nguon) {
    return (nguon as NguonTruyVet[]).filter((n) => n?.vu && kiemTraVu(n.vu).length === 0);
  },

  taoLuot(nguon, rng, man) {
    const m = ganMan(man);
    const ds = (this.locNguon(nguon) as NguonTruyVet[])
      .filter((n) => n.vu.muc === m)
      .sort((a, b) => a.id.localeCompare(b.id));
    const n = tron(ds, rng)[0];
    if (!n) return [];
    const bienThe = Math.floor(rng() * SO_BIEN_THE);
    const bi_mat = `${Math.floor(rng() * 2 ** 32).toString(36)}${Math.floor(rng() * 2 ** 32).toString(36)}`;
    const lt = sinhLoTrinh(n.vu, bienThe);
    if (!lt) return [];
    return [
      {
        thu_tu: 1,
        ref_kind: "game_content",
        ref_id: n.id,
        ref_version: n.version,
        topic_id: n.topic_id,
        diem_toi_da: diemToiDaTV(m),
        noi_dung: { man: m, vu: n.vu, bi_mat, lo_trinh: lt, nhat_ky: [] },
      },
    ];
  },

  deChoNguoiChoi(buoc) {
    return deTuVu(buoc.noi_dung);
  },

  docTraLoi(raw) {
    const nk = docNhatKy<ThaoTacTruyVet, ThamSoTruyVet>(
      raw,
      (thaoTac, thamSo) => {
        if (!thamSo || typeof thamSo !== "object") return null;
        const t = thamSo as Record<string, unknown>;
        if (thaoTac === "mo")
          return laChuoiNgan(t.camera, 12) && (t.cho === undefined || typeof t.cho === "boolean")
            ? { thao_tac: "mo", tham_so: { camera: t.camera, cho: Boolean(t.cho) } }
            : null;
        if (thaoTac === "khoa")
          return Number.isInteger(t.doan) &&
            (t.doan as number) >= 0 &&
            (t.doan as number) < 50 &&
            laChuoiNgan(t.xe, 12)
            ? { thao_tac: "khoa", tham_so: { doan: t.doan as number, xe: t.xe } }
            : null;
        if (thaoTac === "chan")
          return Number.isInteger(t.x) && Number.isInteger(t.y) && soTrong(t.x, 0, 40) && soTrong(t.y, 0, 40)
            ? { thao_tac: "chan", tham_so: { x: t.x as number, y: t.y as number } }
            : null;
        return null;
      },
      { tongNhipToiDa: (60 * 60_000) / NHIP_MS },
    );
    // Thao tác cuối phải là đặt điểm chặn, và chỉ một lần.
    if (!nk || nk.thao_tac.at(-1)?.thao_tac !== "chan") return null;
    if (nk.thao_tac.filter((t) => t.thao_tac === "chan").length !== 1) return null;
    return nk;
  },

  chamBuoc(buoc, tl, ngCanh): KetQuaChamBuoc {
    const n = buoc.noi_dung;
    const v = dungVu(n.vu, n.bi_mat);
    // Online: lượt mở camera, khóa lấy từ nhật ký route của trò; máy khách chỉ góp thao tác khóa, chặn cuối.
    // Offline: chạy lại toàn bộ nhật ký máy khách gửi (gói có lộ trình, câu D24).
    const offline = ngCanh?.offline === true;
    const nk: TraLoiTruyVet = offline
      ? tl
      : {
          thao_tac: [
            ...n.nhat_ky.map((t) => ({ ...t, nhip: 0 })),
            ...tl.thao_tac.filter((t) => t.thao_tac !== "mo").map((t) => ({ ...t, nhip: 0 })),
          ],
          tong_nhip: 0,
        };
    const kq = chayLaiRoiCham(nk, null, (x) => chayNhatKyTV(v, x.thao_tac, n.lo_trinh));
    const tt = kq.hop_le ? kq.ket_qua : trangThaiDauTV(n.vu);
    const cham = chamTruyVet(v, n.lo_trinh, tt);
    const diem = kq.hop_le ? cham.diem : 0;
    const chiTiet: ChiTietTruyVet = {
      hop_le: kq.hop_le,
      ly_do: kq.hop_le ? null : kq.ly_do,
      doan: cham.doan,
      chan: cham.chan,
      lo_trinh: n.lo_trinh.o,
      lo_trinh_t: n.lo_trinh.t,
      camera_tren_duong: n.lo_trinh.camera.map((c) => c.id),
      dong_ho: tt.dong_ho,
      con_luot: tt.con_luot,
      so_khoa_dung: cham.so_khoa_dung,
      so_khoa_nham: cham.so_khoa_nham,
      diem_khoa: cham.diem_khoa,
      diem_chan: cham.diem_chan,
      diem_thuong: cham.diem_thuong,
      gio_xay_ra: n.vu.gio_xay_ra,
    };
    const N = n.lo_trinh.camera.length;
    return {
      diem,
      diemToiDa: buoc.diem_toi_da,
      dung: kq.hop_le && cham.chan?.dung === true,
      chiTiet,
      giaiThich: kq.hop_le
        ? `Khóa đúng xe ở ${cham.so_khoa_dung}/${N} camera trên đường xe chạy${cham.so_khoa_nham ? `, khóa nhầm ${cham.so_khoa_nham} lần` : ""}. ${cham.chan?.dung ? "Điểm chặn đúng." : "Điểm chặn chưa đúng."}`
        : `Không chấm được: ${kq.ly_do}`,
      canCu: [...n.vu.can_cu],
    };
  },
};
