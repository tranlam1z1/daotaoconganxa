/**
 * Trò "Soi camera" (docs/PLAN.md GĐ-T5, docs/GAME_DESIGN.md §5.5).
 *
 * Một lượt là một đoạn "phim" camera 20–40 giây, dựng bằng bộ mô phỏng M5 từ KỊCH BẢN XE (dữ liệu),
 * không phải video: đoạn đường 4 làn có đèn tín hiệu ở chỗ người đi bộ sang đường, xe vào theo giờ,
 * mỗi xe có lộ trình và hành vi (tốc độ, có dừng theo đèn không, có dừng lại giữa đường không, có đội
 * mũ bảo hiểm không). Vi phạm KHÔNG ghi trong kịch bản: máy chủ chạy mô phỏng và lấy vi phạm từ sự
 * kiện (vượt vạch khi đèn đỏ, xe đi vào làn không dành cho loại xe đó, dừng trong vùng cấm dừng, người
 * đi xe máy không đội mũ bảo hiểm). Đáp án người soạn khai phải khớp đúng các vi phạm mô phỏng thấy.
 *
 * Người chơi bấm "Dừng hình", khoanh vùng xe vi phạm, kéo thẻ lỗi vào vùng, rồi "Tiếp tục". Được tua
 * lại 5 giây tối đa 3 lần. Mọi thao tác ghi vào nhật ký (M7), kèm nhịp phim đang dừng.
 *
 * Chấm mỗi vi phạm (một vùng khoanh chỉ tính cho một vi phạm):
 *  - vùng khoanh trùm xe vi phạm (phủ ≥ 50% hộp bao của xe) và trùm không quá 2 xe khác: +5;
 *  - vùng đó được khoanh lúc phim dừng TRONG cửa sổ vi phạm: +5;
 *  - thẻ lỗi đúng: +10.
 * Vùng khoanh không trùm xe vi phạm nào: −5. Bỏ sót: 0, liệt kê ở màn kết quả. Điểm bước không âm.
 *
 * Cửa sổ vi phạm: vi phạm tức thời (vượt đèn đỏ) từ lúc xảy ra tới 2 giây sau (GAME_DESIGN §5.5);
 * vi phạm kéo dài (sai làn, không mũ bảo hiểm, dừng sai nơi) từ lúc bắt đầu thấy được tới khi hết
 * vi phạm cộng 2 giây, trong phạm vi xe còn hiện trên camera.
 *
 * Đánh đổi (§1.2, ghi ở GAME_DESIGN §5.5): điện thoại có kịch bản xe để tự dựng hoạt cảnh, kể cả
 * hành vi "không dừng theo đèn"; không có loại lỗi, cửa sổ vi phạm, mã mức phạt. Hàm thuần.
 */

import { tron } from "../de-thi.ts";
import { type Camera, chieu, chuanHop, type Hop, hopXe, trongKhung, tyLePhu } from "../mo-phong/camera.ts";
import type { DenTinHieu } from "../mo-phong/den.ts";
import type { Lan, VungCamDung } from "../mo-phong/duong.ts";
import {
  buocMoPhong,
  type CauHinhMoPhong,
  dungMoPhong,
  NHIP_MS,
  type TrangThaiMoPhong,
  trangThaiDau,
} from "../mo-phong/mo-phong.ts";
import { LOAI_XE, type LoaiXe, type XeKhoiTao } from "../mo-phong/xe.ts";
import { type DongBienBan, dongBienBan, type MucPhatDaDuyet } from "./chung/bien-ban.ts";
import type { CauHinhMan } from "./chung/man-choi.ts";
import { chayLaiRoiCham, docNhatKy, type NhatKy } from "./chung/nhat-ky.ts";
import type { DinhNghiaTroChoi, KetQuaChamBuoc } from "./khung.ts";

export const MA_SOI_CAMERA = "soi_camera";
export const DIEM_KHOANH = 5;
export const DIEM_DUNG_LUC = 5;
export const DIEM_THE_LOI = 10;
export const DIEM_MOI_VI_PHAM = DIEM_KHOANH + DIEM_DUNG_LUC + DIEM_THE_LOI;
export const TRU_KHOANH_NHAM = 5;
export const TY_LE_PHU_TOI_THIEU = 0.5;
/** Vùng khoanh trùm quá số xe khác này thì không tính. */
export const XE_KHAC_TOI_DA = 2;
export const SO_LAN_TUA = 3;
export const GIAY_TUA = 5;
export const KHOANH_TOI_DA = 12;
/** Cửa sổ vi phạm kéo dài thêm 2 giây sau khi vi phạm kết thúc. */
export const NHIP_SAU_VI_PHAM = 2_000 / NHIP_MS;
export const GIAY_TOI_THIEU = 20;
export const GIAY_TOI_DA = 40;
const NHIP_GIAY = 1_000 / NHIP_MS;

/* ------------------------------------------------------------------ */
/* Loại vi phạm và màn chơi                                            */
/* ------------------------------------------------------------------ */

export const LOAI_VI_PHAM = ["vuot_den_do", "sai_lan", "dung_do_sai", "khong_mu_bao_hiem"] as const;
export type LoaiViPham = (typeof LOAI_VI_PHAM)[number];

/** Tên thẻ lỗi (tên gọi trong trò chơi; hành vi pháp lý đầy đủ lấy từ dòng mức phạt đã duyệt). */
export const TEN_VI_PHAM: Record<LoaiViPham, string> = {
  vuot_den_do: "Vượt đèn đỏ",
  sai_lan: "Đi sai làn đường",
  dung_do_sai: "Dừng xe sai nơi quy định",
  khong_mu_bao_hiem: "Không đội mũ bảo hiểm",
};

export const laLoaiViPham = (v: unknown): v is LoaiViPham =>
  typeof v === "string" && (LOAI_VI_PHAM as readonly string[]).includes(v);

export interface ThongSoManCamera {
  /** Số xe tối đa cùng hiện trên camera. */
  xe_toi_da: number;
  vi_pham: readonly [number, number];
  toc_do_phat: number;
}

/** GAME_DESIGN §5.5, bảng màn chơi. */
export const THONG_SO_MAN_CAMERA: Readonly<Record<number, ThongSoManCamera>> = {
  1: { xe_toi_da: 4, vi_pham: [1, 1], toc_do_phat: 0.75 },
  2: { xe_toi_da: 6, vi_pham: [2, 2], toc_do_phat: 1 },
  3: { xe_toi_da: 8, vi_pham: [1, 4], toc_do_phat: 1 },
  4: { xe_toi_da: 10, vi_pham: [1, 4], toc_do_phat: 1 },
  5: { xe_toi_da: 12, vi_pham: [1, 4], toc_do_phat: 1.25 },
};

export const MAN_SOI_CAMERA: readonly CauHinhMan[] = [
  {
    so: 1,
    ten: "Màn 1: Một vi phạm rõ",
    moTa: "Ít xe, phim chạy chậm 0,75 lần. Không tính giờ.",
    caLuotMs: null,
    xpCoBan: 10,
  },
  {
    so: 2,
    ten: "Màn 2: Đèn tín hiệu",
    moTa: "Hai vi phạm, có đèn tín hiệu, 5–6 xe.",
    caLuotMs: null,
    xpCoBan: 12,
  },
  {
    so: 3,
    ten: "Màn 3: Làn đường, dừng xe",
    moTa: "Vi phạm làn đường, dừng xe sai nơi; 8 xe.",
    caLuotMs: null,
    xpCoBan: 14,
  },
  {
    so: 4,
    ten: "Màn 4: Thoáng qua",
    moTa: "10 xe, có vi phạm chỉ thấy trong 1–2 giây.",
    caLuotMs: null,
    xpCoBan: 16,
  },
  {
    so: 5,
    ten: "Màn 5: Ban đêm",
    moTa: "Ban đêm, 12 xe, phim chạy nhanh 1,25 lần; có tình huống trông giống vi phạm mà không phải.",
    caLuotMs: null,
    xpCoBan: 18,
  },
];
export const SO_MAN_CAMERA = MAN_SOI_CAMERA.length;
const ganMan = (man: number | undefined) =>
  Math.min(SO_MAN_CAMERA, Math.max(1, Number.isInteger(man) ? (man as number) : 1));

/* ------------------------------------------------------------------ */
/* Đoạn đường mẫu của camera                                           */
/* ------------------------------------------------------------------ */

/**
 * Đoạn đường cố định: 4 làn, hai chiều; mỗi chiều làn trong cho ô tô, làn ngoài cho xe máy. Camera
 * thấy 60 m (y từ 0 ở trên tới 6000 cm ở dưới). Chỗ người đi bộ sang đường ở y 3100–3500 cm, có một
 * đèn tín hiệu cho cả hai chiều; vạch dừng chiều đi lên ở y 3700, chiều đi xuống ở y 2900.
 */
export const MA_LAN = ["bac-oto", "bac-xm", "nam-oto", "nam-xm"] as const;
export type MaLan = (typeof MA_LAN)[number];
export const TEN_LAN: Record<MaLan, string> = {
  "bac-oto": "làn ô tô, chiều đi lên",
  "bac-xm": "làn xe máy, chiều đi lên",
  "nam-oto": "làn ô tô, chiều đi xuống",
  "nam-xm": "làn xe máy, chiều đi xuống",
};
export const CAO_KHUNG_CM = 6000;
const CHAY_DA = 3000;
const DI_LEN = (m: MaLan) => m.startsWith("bac");
export const X_LAN: Record<MaLan, number> = {
  "bac-oto": 175,
  "bac-xm": 525,
  "nam-oto": -175,
  "nam-xm": -525,
};
export const DANH_CHO_LAN: Record<MaLan, readonly LoaiXe[]> = {
  "bac-oto": ["o_to", "xe_tai", "xe_uu_tien"],
  "bac-xm": ["xe_may"],
  "nam-oto": ["o_to", "xe_tai", "xe_uu_tien"],
  "nam-xm": ["xe_may"],
};
export const Y_VACH: Record<"len" | "xuong", number> = { len: 3700, xuong: 2900 };
export const Y_NGUOI_DI_BO: readonly [number, number] = [3100, 3500];

/** Quãng đường trên làn (cm) tới điểm có tung độ `y` (cm) trong khung. */
export const sTaiY = (lan: MaLan, y: number) => (DI_LEN(lan) ? CAO_KHUNG_CM + CHAY_DA - y : y + CHAY_DA);

export const CAMERA: Camera = { a: 450, b: 40, c: 0, d: 200, cx: 380, cy: 40, cao: 1280 };

/** Tốc độ km/h sang mm mỗi nhịp. */
export const tocDoTuKmH = (kmh: number) => Math.round((kmh * 125) / 9);

/* ------------------------------------------------------------------ */
/* Kiểu xe                                                             */
/* ------------------------------------------------------------------ */

/**
 * Kiểu xe trên camera: hình xe và kích thước thật (dài × rộng, cm). Mỗi kiểu thuộc một loại xe của
 * bộ mô phỏng (o_to hoặc xe_tai), loại xe quyết định làn được đi. Kiểu mặc định của mỗi loại có đúng
 * KICH_THUOC_XE của loại đó, nên kịch bản không khai kiểu vẫn chạy y như trước.
 */
export const KIEU_XE_CAMERA = [
  "o_to_con",
  "o_to_lon",
  "taxi",
  "ban_tai",
  "xe_tai_nho",
  "xe_tai",
  "xe_buyt",
  "xe_khach",
] as const;
export type KieuXeCamera = (typeof KIEU_XE_CAMERA)[number];

export const THONG_TIN_KIEU_XE: Record<
  KieuXeCamera,
  { loai: "o_to" | "xe_tai"; ten: string; dai: number; rong: number }
> = {
  o_to_con: { loai: "o_to", ten: "ô tô con", dai: 450, rong: 180 },
  o_to_lon: { loai: "o_to", ten: "ô tô lớn", dai: 490, rong: 190 },
  taxi: { loai: "o_to", ten: "taxi", dai: 450, rong: 180 },
  ban_tai: { loai: "o_to", ten: "xe bán tải", dai: 530, rong: 190 },
  xe_tai_nho: { loai: "xe_tai", ten: "xe tải nhỏ", dai: 550, rong: 200 },
  xe_tai: { loai: "xe_tai", ten: "xe tải", dai: 700, rong: 240 },
  xe_buyt: { loai: "xe_tai", ten: "xe buýt", dai: 1050, rong: 250 },
  xe_khach: { loai: "xe_tai", ten: "xe khách", dai: 750, rong: 220 },
};

const KIEU_MAC_DINH: Partial<Record<LoaiXe, KieuXeCamera>> = { o_to: "o_to_con", xe_tai: "xe_tai" };

/** Kiểu xe đã khai, hoặc kiểu mặc định của loại xe; null với xe máy và xe ưu tiên. */
export const kieuXeCamera = (x: Pick<XeKichBan, "loai" | "kieu">): KieuXeCamera | null =>
  x.kieu ?? KIEU_MAC_DINH[x.loai] ?? null;

/* ------------------------------------------------------------------ */
/* Kịch bản                                                            */
/* ------------------------------------------------------------------ */

export interface XeKichBan {
  id: string;
  loai: LoaiXe;
  /** Chỉ cho ô tô, xe tải; phải cùng loại với `loai`. Vắng: ô tô con (o_to), xe tải (xe_tai). */
  kieu?: KieuXeCamera;
  lan: MaLan;
  /** Giây vào đường (tính từ đầu phim), bước 0,1 giây. */
  vao: number;
  /** km/h, mặc định 40. */
  toc_do?: number;
  /** Chỉ cho xe máy; mặc định có đội. */
  mu_bao_hiem?: boolean;
  /** Không dừng theo đèn tín hiệu. */
  khong_dung_den?: boolean;
  /** Dừng lại tại tung độ `y` (mét tính từ mép trên khung) trong `giay` giây, rồi đi tiếp. */
  dung?: { y: number; giay: number };
}

/** Kịch bản một đoạn phim, lưu ở game_content.payload. */
export interface PayloadKichBan {
  muc: number;
  ban_dem: boolean;
  /** Giờ trên dấu thời gian của camera, "HH:MM:SS". */
  gio_bat_dau: string;
  /** Giây. */
  thoi_luong: number;
  /** Chu kỳ đèn, giây; `lech` là số giây đã trôi trong chu kỳ lúc phim bắt đầu. */
  den: { xanh: number; vang: number; do: number; lech: number };
  /** Vùng cấm dừng, theo mét tính từ mép trên khung. */
  vung_cam_dung: Array<{ lan: MaLan; y_tu: number; y_den: number }>;
  xe: XeKichBan[];
}

export interface ViPhamKhai {
  xe: string;
  loai: LoaiViPham;
  /** Mã dòng mức phạt (violations.code); null khi chưa có dòng mức phạt cho hành vi này. */
  ma_muc_phat: string | null;
  /** Mô tả tình huống cho màn kết quả và biên bản. */
  mo_ta: string;
}

/** Đáp án, lưu ở game_content.answer. */
export interface DapAnKichBan {
  vi_pham: ViPhamKhai[];
}

const giayNhip = (g: number) => Math.round(g * NHIP_GIAY);
export const tongNhip = (p: Pick<PayloadKichBan, "thoi_luong">) => giayNhip(p.thoi_luong);

/** Cấu hình mô phỏng của một kịch bản. */
export function cauHinhKichBan(p: PayloadKichBan): CauHinhMoPhong {
  const lan: Lan[] = MA_LAN.map((m) => ({
    id: m,
    diem: DI_LEN(m)
      ? [
          { x: X_LAN[m], y: CAO_KHUNG_CM + CHAY_DA },
          { x: X_LAN[m], y: -2000 },
        ]
      : [
          { x: X_LAN[m], y: -CHAY_DA },
          { x: X_LAN[m], y: CAO_KHUNG_CM + 2000 },
        ],
    toc_do_toi_da: tocDoTuKmH(70),
    danh_cho: DANH_CHO_LAN[m],
  }));
  const den: DenTinHieu = {
    id: "den",
    xanh: giayNhip(p.den.xanh),
    vang: giayNhip(p.den.vang),
    do: giayNhip(p.den.do),
    lech: giayNhip(p.den.lech),
    vach: MA_LAN.map((m) => ({ lan: m, s: sTaiY(m, DI_LEN(m) ? Y_VACH.len : Y_VACH.xuong) })),
  };
  const vung: VungCamDung[] = p.vung_cam_dung.map((v, i) => {
    const a = sTaiY(v.lan, v.y_tu * 100);
    const b = sTaiY(v.lan, v.y_den * 100);
    return { id: `vung-${i + 1}`, lan: v.lan, s_tu: Math.min(a, b), s_den: Math.max(a, b) };
  });
  const xe: XeKhoiTao[] = p.xe.map((x) => {
    const kieu = x.kieu ? THONG_TIN_KIEU_XE[x.kieu] : undefined;
    return {
      id: x.id,
      loai: x.loai,
      lan: x.lan,
      nhip_vao: giayNhip(x.vao),
      v_max: tocDoTuKmH(x.toc_do ?? 40),
      mu_bao_hiem: x.loai === "xe_may" ? x.mu_bao_hiem !== false : undefined,
      bo_qua_den: Boolean(x.khong_dung_den),
      dung: x.dung
        ? { s: sTaiY(x.lan, Math.round(x.dung.y * 100)), so_nhip: giayNhip(x.dung.giay) }
        : undefined,
      kich_thuoc: kieu ? { dai: kieu.dai, rong: kieu.rong } : undefined,
    };
  });
  return { lan, dac_diem: [], bien: [], xe, den: [den], vung_cam_dung: vung };
}

/** Trạng thái ở từng nhịp 0…N của đoạn phim. */
export function chayKichBan(p: PayloadKichBan): TrangThaiMoPhong[] {
  const mp = dungMoPhong(cauHinhKichBan(p));
  const n = tongNhip(p);
  const ds = [trangThaiDau(mp)];
  for (let i = 0; i < n; i++) ds.push(buocMoPhong(mp, ds[i]!));
  return ds;
}

/** Hộp bao trên camera của từng xe đang hiện ở một nhịp. */
export function hopCacXe(tt: TrangThaiMoPhong): Map<string, Hop> {
  const kq = new Map<string, Hop>();
  for (const x of tt.xe) {
    if (x.trang_thai === "cho" || x.trang_thai === "da_qua") continue;
    const h = hopXe(CAMERA, x);
    if (trongKhung(CAMERA, h)) kq.set(x.id, h);
  }
  return kq;
}

export interface ViPhamPhatHien {
  xe: string;
  loai: LoaiViPham;
  /** Cửa sổ vi phạm, nhịp phim (gồm hai đầu). */
  bat_dau: number;
  ket_thuc: number;
}

/** Vi phạm mô phỏng thấy được trên camera, theo thứ tự thời gian. */
export function phatHienViPham(_p: PayloadKichBan, ds: readonly TrangThaiMoPhong[]): ViPhamPhatHien[] {
  const n = ds.length - 1;
  const hien = new Map<string, number[]>();
  ds.forEach((tt, i) => {
    for (const id of hopCacXe(tt).keys()) {
      const h = hien.get(id);
      if (h) h[1] = i;
      else hien.set(id, [i, i]);
    }
  });
  const suKien = ds[n]!.su_kien;
  const kq: ViPhamPhatHien[] = [];
  const them = (xe: string, loai: LoaiViPham, tu: number, den: number) => {
    const h = hien.get(xe);
    if (!h) return;
    const a = Math.max(tu, h[0]!);
    const b = Math.min(den, h[1]!);
    if (a <= b && !kq.some((v) => v.xe === xe && v.loai === loai))
      kq.push({ xe, loai, bat_dau: a, ket_thuc: b });
  };
  for (const s of suKien) {
    if (s.loai === "vuot_den_do") them(s.xe, "vuot_den_do", s.nhip, s.nhip + NHIP_SAU_VI_PHAM);
    else if (s.loai === "sai_lan" || s.loai === "khong_mu_bao_hiem") them(s.xe, s.loai, 0, n);
    else if (s.loai === "dung_do_sai") {
      const het = suKien.find((t) => t.xe === s.xe && t.loai === "tiep_tuc" && t.nhip > s.nhip)?.nhip ?? n;
      them(s.xe, "dung_do_sai", s.nhip, het + NHIP_SAU_VI_PHAM);
    }
  }
  return kq.sort((a, b) => a.bat_dau - b.bat_dau || a.xe.localeCompare(b.xe));
}

/** Số xe nhiều nhất cùng hiện trên camera. */
export const xeCungLucToiDa = (ds: readonly TrangThaiMoPhong[]) =>
  Math.max(0, ...ds.map((t) => hopCacXe(t).size));

/* ------------------------------------------------------------------ */
/* Kiểm kịch bản                                                       */
/* ------------------------------------------------------------------ */

/** Một lỗi kịch bản, chỉ đúng phần tử: "doan", "xe:<id>", "vi_pham:<thứ tự>". */
export interface LoiKichBan {
  phan_tu: string;
  loi: string;
}

const soTrong = (v: unknown, tu: number, den: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= tu && v <= den;

/** Kiểm kịch bản và đáp án; chạy mô phỏng để đối chiếu vi phạm. Rỗng là hợp lệ. */
export function kiemTraKichBan(
  p: Partial<PayloadKichBan> | null | undefined,
  da: Partial<DapAnKichBan> | null | undefined,
): LoiKichBan[] {
  const loi: LoiKichBan[] = [];
  const them = (phan_tu: string, l: string) => loi.push({ phan_tu, loi: l });
  if (!p || typeof p !== "object") return [{ phan_tu: "doan", loi: "Thiếu kịch bản." }];
  const ts = Number.isInteger(p.muc) ? THONG_SO_MAN_CAMERA[p.muc as number] : undefined;
  if (!ts) them("doan", `Màn (muc) phải từ 1 đến ${SO_MAN_CAMERA}.`);
  if (!Number.isInteger(p.thoi_luong) || !soTrong(p.thoi_luong, GIAY_TOI_THIEU, GIAY_TOI_DA))
    them("doan", `Đoạn phim dài từ ${GIAY_TOI_THIEU} đến ${GIAY_TOI_DA} giây (số nguyên).`);
  if (typeof p.gio_bat_dau !== "string" || !/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(p.gio_bat_dau))
    them("doan", "Giờ bắt đầu phải dạng HH:MM:SS.");
  const d = p.den;
  if (
    !d ||
    !soTrong(d.xanh, 1, 120) ||
    !soTrong(d.vang, 1, 10) ||
    !soTrong(d.do, 1, 120) ||
    !soTrong(d.lech, 0, 250)
  )
    them("doan", "Chu kỳ đèn: xanh, đỏ từ 1 đến 120 giây; vàng từ 1 đến 10 giây; lệch từ 0 giây.");
  if (!Array.isArray(p.vung_cam_dung)) them("doan", "Vùng cấm dừng (vung_cam_dung) phải là mảng.");
  else
    p.vung_cam_dung.forEach((v, i) => {
      if (
        !(MA_LAN as readonly string[]).includes(v?.lan) ||
        !soTrong(v?.y_tu, 0, 60) ||
        !soTrong(v?.y_den, 0, 60) ||
        v.y_tu >= v.y_den
      )
        them("doan", `Vùng cấm dừng ${i + 1}: cần làn hợp lệ và 0 ≤ y_tu < y_den ≤ 60 (mét).`);
    });
  const xe = p.xe;
  if (!Array.isArray(xe) || !xe.length) {
    them("doan", "Cần ít nhất một xe.");
    return loi;
  }
  const ids = new Set<string>();
  for (const x of xe as Partial<XeKichBan>[]) {
    const pt = `xe:${x?.id}`;
    if (typeof x?.id !== "string" || !/^[a-z0-9-]{1,12}$/.test(x.id)) {
      them("doan", "Mã xe chỉ gồm chữ thường, số, gạch nối, tối đa 12 ký tự.");
      continue;
    }
    if (ids.has(x.id)) them(pt, `Mã xe ${x.id} bị trùng.`);
    ids.add(x.id);
    if (!(LOAI_XE as readonly string[]).includes(x.loai as string))
      them(pt, `Xe ${x.id}: loại xe không hợp lệ.`);
    else if (
      x.kieu !== undefined &&
      (!(KIEU_XE_CAMERA as readonly string[]).includes(x.kieu) || THONG_TIN_KIEU_XE[x.kieu].loai !== x.loai)
    )
      them(pt, `Xe ${x.id}: kiểu xe không hợp lệ hoặc không thuộc loại xe đã chọn.`);
    if (!(MA_LAN as readonly string[]).includes(x.lan as string)) them(pt, `Xe ${x.id}: làn không hợp lệ.`);
    if (!soTrong(x.vao, 0, Number(p.thoi_luong) || GIAY_TOI_DA))
      them(pt, `Xe ${x.id}: giờ vào phải trong đoạn phim.`);
    if (x.toc_do !== undefined && !soTrong(x.toc_do, 10, 70))
      them(pt, `Xe ${x.id}: tốc độ từ 10 đến 70 km/h.`);
    if (x.mu_bao_hiem !== undefined && x.loai !== "xe_may")
      them(pt, `Xe ${x.id}: chỉ xe máy có thuộc tính mũ bảo hiểm.`);
    if (x.dung && (!soTrong(x.dung.y, 1, 59) || !soTrong(x.dung.giay, 1, 20)))
      them(pt, `Xe ${x.id}: chỗ dừng từ 1 đến 59 mét, dừng từ 1 đến 20 giây.`);
  }
  if (loi.length) return loi;

  // Chạy mô phỏng, đối chiếu vi phạm.
  const ds = chayKichBan(p as PayloadKichBan);
  const thay = phatHienViPham(p as PayloadKichBan, ds);
  const cungLuc = xeCungLucToiDa(ds);
  if (ts && cungLuc > ts.xe_toi_da)
    them(
      "doan",
      `Màn ${p.muc} tối đa ${ts.xe_toi_da} xe cùng lúc trên camera, kịch bản có lúc ${cungLuc} xe.`,
    );
  const khai = da?.vi_pham;
  if (!Array.isArray(khai)) {
    them("doan", "Thiếu danh sách vi phạm trong đáp án.");
    return loi;
  }
  khai.forEach((v, i) => {
    const pt = `vi_pham:${i}`;
    if (!ids.has(v?.xe)) them(pt, `Vi phạm ${i + 1}: không có xe ${v?.xe}.`);
    if (!laLoaiViPham(v?.loai)) them(pt, `Vi phạm ${i + 1}: loại vi phạm không hợp lệ.`);
    else if (!thay.some((t) => t.xe === v.xe && t.loai === v.loai))
      them(
        pt,
        `Vi phạm ${i + 1}: mô phỏng không thấy xe ${v.xe} ${TEN_VI_PHAM[v.loai].toLowerCase()} trên camera.`,
      );
    if (v?.ma_muc_phat !== null && typeof v?.ma_muc_phat !== "string")
      them(pt, `Vi phạm ${i + 1}: mã mức phạt phải là chuỗi hoặc null.`);
    if (typeof v?.mo_ta !== "string" || !v.mo_ta.trim()) them(pt, `Vi phạm ${i + 1}: cần mô tả tình huống.`);
  });
  for (const t of thay)
    if (!khai.some((v) => v?.xe === t.xe && v?.loai === t.loai))
      them(
        `xe:${t.xe}`,
        `Mô phỏng thấy xe ${t.xe} ${TEN_VI_PHAM[t.loai].toLowerCase()} nhưng đáp án chưa khai.`,
      );
  if (ts && (thay.length < ts.vi_pham[0] || thay.length > ts.vi_pham[1]))
    them(
      "doan",
      `Màn ${p.muc} cần ${ts.vi_pham[0] === ts.vi_pham[1] ? ts.vi_pham[0] : `${ts.vi_pham[0]}–${ts.vi_pham[1]}`} vi phạm, mô phỏng thấy ${thay.length}.`,
    );
  return loi;
}

/* ------------------------------------------------------------------ */
/* Nhật ký và chấm                                                     */
/* ------------------------------------------------------------------ */

export const THAO_TAC_CAMERA = ["dung_hinh", "tiep_tuc", "tua", "khoanh"] as const;
export type ThaoTacCamera = (typeof THAO_TAC_CAMERA)[number];
export type ThamSoCamera = { nhip_phim: number; hop?: Hop; loi?: LoaiViPham } | null;
export type TraLoiSoiCamera = NhatKy<ThaoTacCamera, ThamSoCamera>;

export interface Khoanh {
  nhip_phim: number;
  hop: Hop;
  loi: LoaiViPham;
}

/**
 * Dựng lại các vùng khoanh từ nhật ký. Vùng khoanh chỉ tính khi phim đang dừng đúng ở nhịp đó; tua
 * lại quá 3 lần và vùng khoanh quá KHOANH_TOI_DA bị bỏ qua (không làm hỏng cả nhật ký).
 */
export function dungLaiKhoanh(nk: TraLoiSoiCamera, tong: number) {
  let dang: number | null = null;
  let tua = 0;
  const bo = { tua: 0, khoanh: 0 };
  const khoanh: Khoanh[] = [];
  for (const t of nk.thao_tac) {
    const nh = t.tham_so?.nhip_phim ?? -1;
    if (t.thao_tac === "dung_hinh") dang = nh >= 0 && nh <= tong ? nh : null;
    else if (t.thao_tac === "tiep_tuc") dang = null;
    else if (t.thao_tac === "tua") {
      tua++;
      if (tua > SO_LAN_TUA) bo.tua++;
      dang = null;
    } else if (
      dang === null ||
      nh !== dang ||
      khoanh.length >= KHOANH_TOI_DA ||
      !t.tham_so?.hop ||
      !t.tham_so.loi
    )
      bo.khoanh++;
    else khoanh.push({ nhip_phim: nh, hop: chuanHop(CAMERA, t.tham_so.hop), loi: t.tham_so.loi });
  }
  return { khoanh, so_lan_tua: Math.min(tua, SO_LAN_TUA), bo_qua: bo };
}

/** Xe (hiện trên camera ở nhịp đó) mà vùng khoanh phủ ≥ 50%. */
export function xeTrongVung(tt: TrangThaiMoPhong, hop: Hop): string[] {
  return [...hopCacXe(tt)].filter(([, h]) => tyLePhu(hop, h) >= TY_LE_PHU_TOI_THIEU).map(([id]) => id);
}

export interface KetQuaViPham extends ViPhamPhatHien {
  ten: string;
  mo_ta: string;
  can_cu: string[];
  khoanh: Khoanh | null;
  diem_khoanh: number;
  diem_dung_luc: number;
  diem_the: number;
  diem: number;
  /** Có vùng khoanh trúng xe nhưng trùm quá nhiều xe khác. */
  qua_rong: boolean;
}

export interface KetQuaKhoanh {
  vi_pham: KetQuaViPham[];
  khoanh_nham: Array<Khoanh & { xe: string[] }>;
  diem: number;
}

export function chamKhoanh(
  ds: readonly TrangThaiMoPhong[],
  viPham: ReadonlyArray<ViPhamPhatHien & { mo_ta: string; can_cu: string[] }>,
  khoanh: readonly Khoanh[],
): KetQuaKhoanh {
  const phu = khoanh.map((k) => xeTrongVung(ds[k.nhip_phim]!, k.hop));
  const daDung = new Set<number>();
  const kq: KetQuaViPham[] = viPham.map((v) => {
    let tot: { i: number; dungLuc: number; the: number } | null = null;
    let quaRong = false;
    khoanh.forEach((k, i) => {
      if (daDung.has(i) || !phu[i]!.includes(v.xe)) return;
      if (phu[i]!.length - 1 > XE_KHAC_TOI_DA) {
        quaRong = true;
        return;
      }
      const dungLuc = k.nhip_phim >= v.bat_dau && k.nhip_phim <= v.ket_thuc ? DIEM_DUNG_LUC : 0;
      const the = k.loi === v.loai ? DIEM_THE_LOI : 0;
      if (!tot || dungLuc + the > tot.dungLuc + tot.the) tot = { i, dungLuc, the };
    });
    const t = tot as { i: number; dungLuc: number; the: number } | null;
    if (t) daDung.add(t.i);
    return {
      ...v,
      ten: TEN_VI_PHAM[v.loai],
      khoanh: t ? khoanh[t.i]! : null,
      diem_khoanh: t ? DIEM_KHOANH : 0,
      diem_dung_luc: t?.dungLuc ?? 0,
      diem_the: t?.the ?? 0,
      diem: t ? DIEM_KHOANH + t.dungLuc + t.the : 0,
      qua_rong: !t && quaRong,
    };
  });
  // Vùng không trùm xe vi phạm nào là khoanh nhầm; vùng trùm xe vi phạm mà không được tính thì không trừ.
  const xeViPham = new Set(viPham.map((v) => v.xe));
  const nham = khoanh
    .map((k, i) => ({ ...k, xe: phu[i]!, i }))
    .filter((k) => !daDung.has(k.i) && !k.xe.some((x) => xeViPham.has(x)))
    .map(({ i: _, ...k }) => k);
  const tong = kq.reduce((s, v) => s + v.diem, 0) - nham.length * TRU_KHOANH_NHAM;
  return { vi_pham: kq, khoanh_nham: nham, diem: Math.max(0, tong) };
}

/* ------------------------------------------------------------------ */
/* Định nghĩa trò                                                      */
/* ------------------------------------------------------------------ */

export interface NguonSoiCamera {
  id: string;
  code: string;
  version: number;
  topic_id: string | null;
  kich_ban: PayloadKichBan;
  dap_an: DapAnKichBan;
  /** Dòng mức phạt đã duyệt theo mã (chỉ các mã đáp án trỏ tới). */
  muc_phat: Record<string, MucPhatDaDuyet>;
}

export interface BuocSoiCamera {
  man: number;
  kich_ban: PayloadKichBan;
  vi_pham: Array<ViPhamPhatHien & { mo_ta: string; ma_muc_phat: string | null; can_cu: string[] }>;
  bien_ban: DongBienBan[];
}

export interface DeSoiCamera {
  man: number;
  kich_ban: PayloadKichBan;
  toc_do_phat: number;
  so_lan_tua: number;
  the_loi: Array<{ ma: LoaiViPham; ten: string }>;
}

export interface ChiTietSoiCamera extends KetQuaKhoanh {
  hop_le: boolean;
  ly_do: string | null;
  so_lan_tua: number;
  bo_qua: { tua: number; khoanh: number };
  bien_ban: DongBienBan[];
}

/** Mã hóa hộp gửi lên: 4 số trong khung camera. */
const laHop = (v: unknown): v is Hop =>
  Array.isArray(v) &&
  v.length === 4 &&
  v.every((x) => typeof x === "number" && Number.isFinite(x) && x >= -100 && x <= 2000);

export const TRO_CHOI_SOI_CAMERA: DinhNghiaTroChoi<BuocSoiCamera, DeSoiCamera, TraLoiSoiCamera> = {
  ma: MA_SOI_CAMERA,
  ten: "Soi camera",
  moTa: "Xem camera giao thông, dừng hình đúng lúc, khoanh xe vi phạm và gắn đúng lỗi.",
  offline: true,
  nguon: "soi_camera_kich_ban",
  soBuoc: 1,
  thoiGian: null,
  thuongNhanh: false,
  xpCoBan: 10,
  manChoi: MAN_SOI_CAMERA,

  locNguon(nguon) {
    return (nguon as NguonSoiCamera[]).filter(
      (n) => n?.kich_ban && kiemTraKichBan(n.kich_ban, n.dap_an).length === 0,
    );
  },

  taoLuot(nguon, rng, man) {
    const m = ganMan(man);
    const ds = (this.locNguon(nguon) as NguonSoiCamera[])
      .filter((n) => n.kich_ban.muc === m)
      .sort((a, b) => a.id.localeCompare(b.id));
    const n = tron(ds, rng)[0];
    if (!n) return [];
    const thay = phatHienViPham(n.kich_ban, chayKichBan(n.kich_ban));
    const viPham = thay.map((t) => {
      const k = n.dap_an.vi_pham.find((v) => v.xe === t.xe && v.loai === t.loai)!;
      const mp = k.ma_muc_phat ? n.muc_phat[k.ma_muc_phat] : undefined;
      return { ...t, mo_ta: k.mo_ta, ma_muc_phat: k.ma_muc_phat, can_cu: mp ? [mp.can_cu] : [] };
    });
    return [
      {
        thu_tu: 1,
        ref_kind: "game_content",
        ref_id: n.id,
        ref_version: n.version,
        topic_id: n.topic_id,
        diem_toi_da: viPham.length * DIEM_MOI_VI_PHAM,
        noi_dung: {
          man: m,
          kich_ban: n.kich_ban,
          vi_pham: viPham,
          bien_ban: viPham.map((v) =>
            dongBienBan({
              hanhVi: TEN_VI_PHAM[v.loai],
              chiTiet: v.mo_ta,
              canCu: [],
              maMucPhat: v.ma_muc_phat,
              mucPhat: n.muc_phat,
            }),
          ),
        },
      },
    ];
  },

  deChoNguoiChoi(buoc) {
    const b = buoc.noi_dung;
    return {
      man: b.man,
      kich_ban: b.kich_ban,
      toc_do_phat: THONG_SO_MAN_CAMERA[b.man]?.toc_do_phat ?? 1,
      so_lan_tua: SO_LAN_TUA,
      the_loi: LOAI_VI_PHAM.map((ma) => ({ ma, ten: TEN_VI_PHAM[ma] })),
    };
  },

  docTraLoi(raw) {
    return docNhatKy<ThaoTacCamera, ThamSoCamera>(
      raw,
      (thaoTac, thamSo) => {
        if (thaoTac === "tiep_tuc") return thamSo == null ? { thao_tac: "tiep_tuc", tham_so: null } : null;
        if (!(THAO_TAC_CAMERA as readonly string[]).includes(thaoTac as string)) return null;
        if (!thamSo || typeof thamSo !== "object") return null;
        const t = thamSo as Record<string, unknown>;
        if (
          !Number.isInteger(t.nhip_phim) ||
          (t.nhip_phim as number) < 0 ||
          (t.nhip_phim as number) > GIAY_TOI_DA * NHIP_GIAY
        )
          return null;
        if (thaoTac !== "khoanh")
          return { thao_tac: thaoTac as ThaoTacCamera, tham_so: { nhip_phim: t.nhip_phim as number } };
        if (!laHop(t.hop) || !laLoaiViPham(t.loi)) return null;
        return { thao_tac: "khoanh", tham_so: { nhip_phim: t.nhip_phim as number, hop: t.hop, loi: t.loi } };
      },
      { tongNhipToiDa: (30 * 60_000) / NHIP_MS },
    );
  },

  chamBuoc(buoc, tl, ngCanh): KetQuaChamBuoc {
    const n = buoc.noi_dung;
    const ds = chayKichBan(n.kich_ban);
    const kq = chayLaiRoiCham(tl, ngCanh?.thoiGianMs ?? null, (nk) => dungLaiKhoanh(nk, ds.length - 1));
    const lai = kq.hop_le ? kq.ket_qua : { khoanh: [], so_lan_tua: 0, bo_qua: { tua: 0, khoanh: 0 } };
    const cham = chamKhoanh(ds, n.vi_pham, lai.khoanh);
    const chiTiet: ChiTietSoiCamera = {
      ...cham,
      hop_le: kq.hop_le,
      ly_do: kq.hop_le ? null : kq.ly_do,
      so_lan_tua: lai.so_lan_tua,
      bo_qua: lai.bo_qua,
      bien_ban: n.bien_ban,
    };
    const diem = kq.hop_le ? cham.diem : 0;
    const bat = cham.vi_pham.filter((v) => v.diem_khoanh > 0).length;
    return {
      diem,
      diemToiDa: buoc.diem_toi_da,
      dung: kq.hop_le && diem >= buoc.diem_toi_da,
      chiTiet,
      giaiThich: kq.hop_le
        ? `Bắt được ${bat}/${n.vi_pham.length} vi phạm${cham.khoanh_nham.length ? `, khoanh nhầm ${cham.khoanh_nham.length} lần` : ""}.`
        : `Không chấm được: ${kq.ly_do}`,
      canCu: [...new Set(n.vi_pham.flatMap((v) => v.can_cu))],
    };
  },
};

/** Tọa độ camera của một điểm bản đồ (vẽ đèn, vạch trên màn hình). */
export const chieuCamera = (x: number, y: number) => chieu(CAMERA, x, y);
