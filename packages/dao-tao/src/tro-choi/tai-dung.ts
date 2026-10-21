/**
 * Trò "Tái dựng hiện trường" (docs/PLAN.md GĐ-T10, docs/GAME_DESIGN.md §5.10).
 *
 * Một màn là một vụ va chạm (một bước). Người chơi xem sơ đồ hiện trường nhìn từ trên xuống: vị trí cuối
 * của các xe, vết phanh, vết trượt, mảnh vỡ ở điểm va chạm, vật cố định, đèn, biển tốc độ, lời kể ngắn.
 * Dấu vết KHÔNG vẽ tay: máy chủ chạy M5 (mo-phong/va-cham.ts) từ DỰNG CẢNH GỐC người soạn khai lúc tạo
 * lượt, nên dấu vết luôn khớp với ít nhất một lời giải.
 *
 * Người chơi kéo từng xe vào vị trí ban đầu (lưới 1 m), xoay theo 8 hướng, chọn mức tốc độ và hành động,
 * bấm "Mô phỏng" để điện thoại chạy cùng M5 và phủ kết quả lên dấu vết thật. Khi thấy khớp, kéo thẻ lỗi
 * vào xe có lỗi rồi "Kết luận". Mọi thao tác ghi nhật ký (M7); máy chủ dựng lại dựng cảnh LÚC NỘP, chạy
 * M5 và chấm:
 *  - khớp dấu vết, tối đa 50: vị trí cuối 25, vết phanh và vết trượt 15, hướng cuối 10, chia đều cho các
 *    xe; điểm từng phần giảm tuyến tính theo độ lệch (NGUONG_VI_TRI_CM, NGUONG_VET_CM);
 *  - kết luận, tối đa 40: mỗi lỗi đúng chia đều 40, nửa cho đúng xe, nửa cho đúng lỗi của xe đó; mỗi thẻ
 *    sai (xe, lỗi không có trong đáp án) trừ TRU_THE_SAI;
 *  - số lần mô phỏng, tối đa 10: 1–3 lần 10, 4–6 lần 5, nhiều hơn 0. Không mô phỏng lần nào (không kiểm
 *    chứng) cũng 0 (đề xuất, GAME_DESIGN §5.10).
 * Nhật ký có quá SO_LAN_MO_PHONG_TOI_DA lần mô phỏng bị từ chối (400, chống dò). Mốc thời gian sai, thao
 * tác không hợp lệ: cả bước 0 điểm.
 *
 * Đánh đổi (§1.2): đề gửi người chơi có dấu vết (vị trí cuối, vết, điểm va chạm), vì đó là chính đề bài;
 * không có dựng cảnh gốc, lỗi đúng, mã mức phạt. Điện thoại có bộ mô phỏng nên về lý thuyết dò được lời
 * giải bằng cách thử hết tổ hợp, như mọi trò mô phỏng chơi offline.
 *
 * Căn cứ về xử lý tai nạn chờ khách hàng cung cấp (câu D10): mọi vụ là kịch bản demo. Trên màn hình luôn
 * ghi GHI_CHU_MINH_HOA. Hàm thuần: không chạm CSDL, không đọc đồng hồ.
 */

import { tron } from "../de-thi.ts";
import { doLechHuong, type Huong } from "../mo-phong/duong.ts";
import { chongNhau } from "../mo-phong/mo-phong.ts";
import {
  type CanhVaCham,
  chayVaCham,
  type DauVet,
  dauVetCua,
  doDaiVet,
  HANH_DONG_XE,
  type HanhDongXe,
  hopBaoTam,
  MAT_DUONG,
  type MatDuong,
  type MucTocDo,
  NHIP_TOI_DA_VA_CHAM,
  type VatCoDinh,
  type XeDungCanh,
} from "../mo-phong/va-cham.ts";
import { type DongBienBan, dongBienBan, type MucPhatDaDuyet } from "./chung/bien-ban.ts";
import type { CauHinhMan } from "./chung/man-choi.ts";
import { bamTrangThai, chayLaiRoiCham, docNhatKy, LoiNhatKy, type NhatKy } from "./chung/nhat-ky.ts";
import type { DinhNghiaTroChoi, KetQuaChamBuoc } from "./khung.ts";

export const MA_TAI_DUNG = "tai_dung_hien_truong";
export const GHI_CHU_MINH_HOA =
  "Mô phỏng minh họa để học cách đọc dấu vết, không phải phương pháp giám định.";

export const DIEM_VI_TRI_CUOI = 25;
export const DIEM_VET = 15;
export const DIEM_HUONG = 10;
export const DIEM_KHOP_TOI_DA = DIEM_VI_TRI_CUOI + DIEM_VET + DIEM_HUONG;
export const DIEM_KET_LUAN = 40;
export const DIEM_SO_LAN = 10;
export const DIEM_TOI_DA_TAI_DUNG = DIEM_KHOP_TOI_DA + DIEM_KET_LUAN + DIEM_SO_LAN;
/** Vị trí cuối lệch từ mức này (cm) trở lên thì phần vị trí của xe đó 0 điểm. */
export const NGUONG_VI_TRI_CM = 1000;
/** Tổng độ dài vết (phanh và trượt) lệch từ mức này (cm) trở lên thì phần vết của xe đó 0 điểm. */
export const NGUONG_VET_CM = 800;
export const TRU_THE_SAI = 10;
export const SO_THE_TOI_DA = 3;
/** Quá số lần này trong một lượt thì nhật ký bị từ chối (chống dò). */
export const SO_LAN_MO_PHONG_TOI_DA = 20;
/** Trần độ dài nhật ký: 30 phút. */
export const TONG_NHIP_TOI_DA_TAI_DUNG = (30 * 60_000) / 50;
/** Bề rộng một làn trên sơ đồ, m. */
export const RONG_LAN_M = 3.5;

/* ------------------------------------------------------------------ */
/* Màn chơi                                                            */
/* ------------------------------------------------------------------ */

export const MAN_TAI_DUNG: readonly CauHinhMan[] = [
  {
    so: 1,
    ten: "Màn 1: Một xe",
    moTa: "Một xe tự gây tai nạn. Chỉ cần đặt vị trí và chọn tốc độ. Không tính giờ.",
    caLuotMs: null,
    xpCoBan: 12,
  },
  {
    so: 2,
    ten: "Màn 2: Đâm từ phía sau",
    moTa: "Hai xe cùng chiều, xe sau đâm vào xe trước.",
    caLuotMs: null,
    xpCoBan: 14,
  },
  {
    so: 3,
    ten: "Màn 3: Giao lộ có đèn",
    moTa: "Hai xe va chạm tại giao lộ có đèn tín hiệu.",
    caLuotMs: null,
    xpCoBan: 16,
  },
  {
    so: 4,
    ten: "Màn 4: Vết phanh, mảnh vỡ",
    moTa: "Có vết phanh và mảnh vỡ; xe xoay sau va chạm nên hướng ban đầu không hiển nhiên.",
    caLuotMs: null,
    xpCoBan: 18,
  },
  {
    so: 5,
    ten: "Màn 5: Lời kể mâu thuẫn",
    moTa: "Lời kể của hai bên trái ngược nhau. Dấu vết mới là căn cứ.",
    caLuotMs: null,
    xpCoBan: 20,
  },
];
export const SO_MAN_TAI_DUNG = MAN_TAI_DUNG.length;
const ganMan = (man: number | undefined) =>
  Math.min(SO_MAN_TAI_DUNG, Math.max(1, Number.isInteger(man) ? (man as number) : 1));

/* ------------------------------------------------------------------ */
/* Dữ liệu                                                             */
/* ------------------------------------------------------------------ */

export const LOAI_XE_TAI_DUNG = ["o_to", "xe_tai", "xe_may"] as const;
export type LoaiXeTaiDung = (typeof LOAI_XE_TAI_DUNG)[number];
export const TEN_LOAI_XE_TAI_DUNG: Record<LoaiXeTaiDung, string> = {
  o_to: "Ô tô con",
  xe_tai: "Xe tải",
  xe_may: "Xe máy",
};

export const TEN_MUC_TOC_DO = ["Chậm", "Vừa", "Nhanh", "Rất nhanh"] as const;
export const TEN_HANH_DONG_XE: Record<HanhDongXe, string> = {
  di_thang: "Đi thẳng",
  phanh: "Phanh gấp",
  re_trai: "Rẽ trái",
  re_phai: "Rẽ phải",
  chuyen_lan_trai: "Chuyển làn trái",
  chuyen_lan_phai: "Chuyển làn phải",
};
export const TEN_MAT_DUONG: Record<MatDuong, string> = {
  kho: "Mặt nhựa khô",
  uot: "Mặt nhựa ướt",
  soi: "Đường sỏi, cát",
};

/** Thẻ lỗi. Tên hành vi do hệ thống soạn, chưa đối chiếu văn bản (câu D10). */
export const LOAI_LOI_TAI_DUNG = [
  "qua_toc_do",
  "khong_giu_khoang_cach",
  "vuot_den_do",
  "chuyen_lan_sai",
  "khong_nhuong_duong",
  "di_sai_phan_duong",
] as const;
export type LoaiLoiTaiDung = (typeof LOAI_LOI_TAI_DUNG)[number];
export const TEN_LOI_TAI_DUNG: Record<LoaiLoiTaiDung, string> = {
  qua_toc_do: "Chạy quá tốc độ",
  khong_giu_khoang_cach: "Không giữ khoảng cách an toàn",
  vuot_den_do: "Vượt đèn đỏ",
  chuyen_lan_sai: "Chuyển làn không an toàn",
  khong_nhuong_duong: "Không nhường đường",
  di_sai_phan_duong: "Đi sai phần đường",
};
const laLoi = (v: unknown): v is LoaiLoiTaiDung =>
  typeof v === "string" && (LOAI_LOI_TAI_DUNG as readonly string[]).includes(v);

export const LOAI_VAT_TAI_DUNG = ["cot", "rao", "cay", "tuong"] as const;
export type LoaiVatTaiDung = (typeof LOAI_VAT_TAI_DUNG)[number];
export const TEN_VAT_TAI_DUNG: Record<LoaiVatTaiDung, string> = {
  cot: "Cột điện",
  rao: "Rào chắn",
  cay: "Cây",
  tuong: "Tường",
};

/** Vật cố định trên sơ đồ: tâm (x, y), cỡ (rong theo trục x, dai theo trục y), m, bước 0,1 m. */
export interface VatSoDo {
  id: string;
  loai: LoaiVatTaiDung;
  x: number;
  y: number;
  rong: number;
  dai: number;
}

/** Đèn tại giao lộ lúc xảy ra vụ việc (theo dữ liệu camera): hướng đi của xe chịu đèn và màu đèn. */
export interface DenSoDo {
  huong: 0 | 2 | 4 | 6;
  mau: "xanh" | "vang" | "do";
}

/**
 * Sơ đồ hiện trường, m. `doan_thang`: đường dọc giữa sơ đồ; `nga_tu`: thêm đường ngang giữa sơ đồ. Mỗi
 * chiều `so_lan` làn rộng RONG_LAN_M; xe đi bên phải (đi lên ở nửa phải của đường dọc).
 */
export interface SoDoTaiDung {
  kieu: "doan_thang" | "nga_tu";
  rong_m: number;
  cao_m: number;
  so_lan: 1 | 2;
  mat_duong: MatDuong;
  /** Biển tốc độ tối đa trên đoạn; null khi không có. */
  toc_do_toi_da_kmh: number | null;
  vat: VatSoDo[];
  den: DenSoDo[];
}

export interface XeVuTaiDung {
  id: string;
  loai: LoaiXeTaiDung;
  /** Nhãn hiện cho người chơi, ví dụ "Xe A (ô tô con)". */
  nhan: string;
}

export interface LoiKe {
  nguoi: string;
  ke: string;
}

/** Vụ va chạm, lưu ở game_content.payload. Gửi người chơi (không có đáp án). */
export interface PayloadTaiDung {
  muc: number;
  /** Tin báo ngắn. */
  tin_bao: string;
  so_do: SoDoTaiDung;
  xe: XeVuTaiDung[];
  loi_ke: LoiKe[];
}

/** Vị trí ban đầu của một xe: tâm xe (m, số nguyên), hướng, mức tốc độ, hành động. */
export interface ViTriDau {
  x: number;
  y: number;
  huong: Huong;
  muc: MucTocDo;
  hanh_dong: HanhDongXe;
}

export interface LoiDungTaiDung {
  xe: string;
  loi: LoaiLoiTaiDung;
  /** Mã dòng mức phạt (violations.code); bắt buộc. */
  ma_muc_phat: string;
  /** Mô tả tình huống cho màn kết quả và biên bản. */
  mo_ta: string;
}

/** Đáp án, lưu ở game_content.answer. Không gửi người chơi trước khi chấm. */
export interface DapAnTaiDung {
  dung_canh: Array<ViTriDau & { xe: string }>;
  loi: LoiDungTaiDung[];
  /** Diễn biến đúng, hiện ở màn kết quả. */
  giai_thich: string;
}

/* ------------------------------------------------------------------ */
/* Sơ đồ → cảnh mô phỏng                                               */
/* ------------------------------------------------------------------ */

const cmTu = (m: number) => Math.round(m * 100);

export function vatCoDinhCua(sd: Pick<SoDoTaiDung, "vat">): VatCoDinh[] {
  return sd.vat.map((v) => ({
    id: v.id,
    x1: cmTu(v.x - v.rong / 2),
    y1: cmTu(v.y - v.dai / 2),
    x2: cmTu(v.x + v.rong / 2),
    y2: cmTu(v.y + v.dai / 2),
  }));
}

export type DungCanhTaiDung = Record<string, ViTriDau>;

/** Cảnh mô phỏng từ sơ đồ và dựng cảnh (xe chưa đặt thì không có trong cảnh). */
export function canhTaiDung(vu: Pick<PayloadTaiDung, "so_do" | "xe">, dung: DungCanhTaiDung): CanhVaCham {
  return {
    rong: cmTu(vu.so_do.rong_m),
    cao: cmTu(vu.so_do.cao_m),
    mat_duong: vu.so_do.mat_duong,
    vat: vatCoDinhCua(vu.so_do),
    xe: vu.xe
      .filter((x) => dung[x.id])
      .map((x): XeDungCanh => {
        const p = dung[x.id]!;
        return {
          id: x.id,
          loai: x.loai,
          x: cmTu(p.x),
          y: cmTu(p.y),
          huong: p.huong,
          muc: p.muc,
          hanh_dong: p.hanh_dong,
        };
      }),
  };
}

export function dungCanhGoc(da: Pick<DapAnTaiDung, "dung_canh">): DungCanhTaiDung {
  return Object.fromEntries(
    da.dung_canh.map((d) => [d.xe, { x: d.x, y: d.y, huong: d.huong, muc: d.muc, hanh_dong: d.hanh_dong }]),
  );
}

/** Chạy một dựng cảnh; trả dấu vết và băm trạng thái cuối (so máy chủ, điện thoại). */
export function chayTaiDung(
  vu: Pick<PayloadTaiDung, "so_do" | "xe">,
  dung: DungCanhTaiDung,
): { dau_vet: DauVet; bam: string; nhip: number } {
  const tt = chayVaCham(canhTaiDung(vu, dung));
  return {
    dau_vet: dauVetCua(tt),
    bam: bamTrangThai({ xe: tt.xe, vet: tt.vet, va_cham: tt.va_cham, nhip: tt.nhip }),
    nhip: tt.nhip,
  };
}

/* ------------------------------------------------------------------ */
/* Kiểm vụ                                                             */
/* ------------------------------------------------------------------ */

/** Một lỗi của vụ, chỉ đúng phần tử: "so_do", "xe:<id>", "loi:<thứ tự>", "vu". */
export interface LoiVuTaiDung {
  phan_tu: string;
  loi: string;
}

const soNguyen = (v: unknown, tu: number, den: number): v is number =>
  Number.isInteger(v) && (v as number) >= tu && (v as number) <= den;
const soMotLe = (v: unknown, tu: number, den: number): v is number =>
  typeof v === "number" &&
  Number.isFinite(v) &&
  v >= tu &&
  v <= den &&
  Math.abs(v * 10 - Math.round(v * 10)) < 1e-9;
const chuoi = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max;
const MA_ID = /^[A-Za-z0-9-]{1,8}$/;

/** Kiểm vụ và đáp án, chạy mô phỏng dựng cảnh gốc. Rỗng là hợp lệ. Chạy khi soạn, khi nạp, khi lấy nguồn. */
export function kiemTraVuTaiDung(
  p: Partial<PayloadTaiDung> | null | undefined,
  da: Partial<DapAnTaiDung> | null | undefined,
): LoiVuTaiDung[] {
  const loi: LoiVuTaiDung[] = [];
  const them = (phan_tu: string, l: string) => loi.push({ phan_tu, loi: l });
  if (!p || typeof p !== "object") return [{ phan_tu: "vu", loi: "Thiếu nội dung vụ." }];
  if (!soNguyen(p.muc, 1, SO_MAN_TAI_DUNG)) them("vu", `Màn (muc) phải từ 1 đến ${SO_MAN_TAI_DUNG}.`);
  if (!chuoi(p.tin_bao, 500)) them("vu", "Cần tin báo ngắn (tối đa 500 ký tự).");
  const sd = p.so_do;
  if (!sd || typeof sd !== "object") return [...loi, { phan_tu: "so_do", loi: "Thiếu sơ đồ." }];
  if (sd.kieu !== "doan_thang" && sd.kieu !== "nga_tu")
    them("so_do", 'Kiểu sơ đồ phải là "doan_thang" hoặc "nga_tu".');
  const rongOk = soNguyen(sd.rong_m, 10, 80);
  const caoOk = soNguyen(sd.cao_m, 20, 120);
  if (!rongOk) them("so_do", "Chiều rộng sơ đồ (rong_m) từ 10 đến 80 m.");
  if (!caoOk) them("so_do", "Chiều cao sơ đồ (cao_m) từ 20 đến 120 m.");
  if (sd.so_lan !== 1 && sd.so_lan !== 2) them("so_do", "Số làn mỗi chiều (so_lan) là 1 hoặc 2.");
  else if (rongOk && sd.so_lan * 2 * RONG_LAN_M > sd.rong_m) them("so_do", "Sơ đồ hẹp hơn mặt đường.");
  if (!(MAT_DUONG as readonly string[]).includes(sd.mat_duong as string))
    them("so_do", `Mặt đường phải là ${MAT_DUONG.join(", ")}.`);
  if (sd.toc_do_toi_da_kmh !== null && !soNguyen(sd.toc_do_toi_da_kmh, 10, 120))
    them("so_do", "Tốc độ tối đa trên biển từ 10 đến 120 km/h, hoặc null.");
  const rong = rongOk ? (sd.rong_m as number) : 80;
  const cao = caoOk ? (sd.cao_m as number) : 120;
  const idVat = new Set<string>();
  if (!Array.isArray(sd.vat) || sd.vat.length > 10) them("so_do", "Vật cố định (vat): mảng tối đa 10 vật.");
  else
    for (const v of sd.vat as Partial<VatSoDo>[]) {
      if (!chuoi(v?.id, 8) || !MA_ID.test(v.id)) {
        them("so_do", "Mã vật chỉ gồm chữ, số, gạch nối, tối đa 8 ký tự.");
        continue;
      }
      if (idVat.has(v.id)) them("so_do", `Mã vật ${v.id} bị trùng.`);
      idVat.add(v.id);
      if (!(LOAI_VAT_TAI_DUNG as readonly string[]).includes(v.loai as string))
        them("so_do", `Vật ${v.id}: loại phải là ${LOAI_VAT_TAI_DUNG.join(", ")}.`);
      if (!soMotLe(v.x, 0, rong) || !soMotLe(v.y, 0, cao))
        them("so_do", `Vật ${v.id}: tâm phải nằm trong sơ đồ.`);
      if (!soMotLe(v.rong, 0.2, 30) || !soMotLe(v.dai, 0.2, 30))
        them("so_do", `Vật ${v.id}: cỡ từ 0,2 đến 30 m, bước 0,1 m.`);
    }
  if (!Array.isArray(sd.den) || sd.den.length > 4) them("so_do", "Đèn (den): mảng tối đa 4 đèn.");
  else {
    if (sd.den.length && sd.kieu !== "nga_tu") them("so_do", "Chỉ sơ đồ ngã tư có đèn tín hiệu.");
    const huong = new Set<number>();
    for (const d of sd.den as Partial<DenSoDo>[]) {
      if (![0, 2, 4, 6].includes(d?.huong as number) || huong.has(d!.huong!))
        them("so_do", "Đèn: hướng là 0, 2, 4 hoặc 6, không trùng.");
      else huong.add(d!.huong!);
      if (!["xanh", "vang", "do"].includes(d?.mau as string))
        them("so_do", "Đèn: màu là xanh, vang hoặc do.");
    }
  }
  const xe = p.xe;
  const idXe = new Set<string>();
  if (!Array.isArray(xe) || xe.length < 1 || xe.length > 3) them("vu", "Vụ cần từ 1 đến 3 xe.");
  else
    for (const x of xe as Partial<XeVuTaiDung>[]) {
      if (!chuoi(x?.id, 8) || !MA_ID.test(x.id)) {
        them("vu", "Mã xe chỉ gồm chữ, số, gạch nối, tối đa 8 ký tự.");
        continue;
      }
      const pt = `xe:${x.id}`;
      if (idXe.has(x.id)) them(pt, `Mã xe ${x.id} bị trùng.`);
      idXe.add(x.id);
      if (!(LOAI_XE_TAI_DUNG as readonly string[]).includes(x.loai as string))
        them(pt, `Xe ${x.id}: loại xe phải là ${LOAI_XE_TAI_DUNG.join(", ")}.`);
      if (!chuoi(x.nhan, 40)) them(pt, `Xe ${x.id}: cần nhãn hiện cho người chơi (tối đa 40 ký tự).`);
    }
  if (!Array.isArray(p.loi_ke) || p.loi_ke.length > 4) them("vu", "Lời kể (loi_ke): mảng tối đa 4 lời.");
  else
    for (const k of p.loi_ke as Partial<LoiKe>[])
      if (!chuoi(k?.nguoi, 60) || !chuoi(k?.ke, 400)) them("vu", "Mỗi lời kể cần người kể và nội dung.");
  // Đặc trưng từng màn (GAME_DESIGN §5.10).
  const soXe = Array.isArray(xe) ? xe.length : 0;
  if (p.muc === 1 && soXe !== 1) them("vu", "Màn 1 chỉ có một xe.");
  if (typeof p.muc === "number" && p.muc >= 2 && soXe < 2) them("vu", `Màn ${p.muc} cần ít nhất hai xe.`);
  if (p.muc === 3 && (sd.kieu !== "nga_tu" || !Array.isArray(sd.den) || !sd.den.length))
    them("vu", "Màn 3 cần ngã tư có đèn tín hiệu.");
  if (p.muc === 5 && (!Array.isArray(p.loi_ke) || p.loi_ke.length < 2))
    them("vu", "Màn 5 cần lời kể của ít nhất hai bên.");
  if (loi.length) return loi;

  // Đáp án.
  if (!da || typeof da !== "object") return [{ phan_tu: "vu", loi: "Thiếu đáp án." }];
  const dc = da.dung_canh;
  if (!Array.isArray(dc)) return [{ phan_tu: "vu", loi: "Thiếu dựng cảnh gốc (dung_canh)." }];
  for (const x of p.xe!) {
    const pt = `xe:${x.id}`;
    const ds = dc.filter((d) => d?.xe === x.id);
    if (ds.length !== 1) {
      them(pt, `Dựng cảnh gốc cần đúng một vị trí cho xe ${x.id}.`);
      continue;
    }
    const d = ds[0]!;
    if (!soNguyen(d.x, 0, rong) || !soNguyen(d.y, 0, cao))
      them(pt, `Xe ${x.id}: vị trí ban đầu phải là mét nguyên trong sơ đồ.`);
    if (!soNguyen(d.huong, 0, 7)) them(pt, `Xe ${x.id}: hướng từ 0 đến 7.`);
    if (!soNguyen(d.muc, 0, 3)) them(pt, `Xe ${x.id}: mức tốc độ từ 0 đến 3.`);
    if (!(HANH_DONG_XE as readonly string[]).includes(d.hanh_dong as string))
      them(pt, `Xe ${x.id}: hành động không hợp lệ.`);
  }
  if (dc.some((d) => !idXe.has(d?.xe))) them("vu", "Dựng cảnh gốc có xe không có trong vụ.");
  const loiDung = da.loi;
  if (!Array.isArray(loiDung) || loiDung.length < 1 || loiDung.length > 2)
    them("vu", "Cần một hoặc hai lỗi đúng (loi).");
  else
    loiDung.forEach((l, i) => {
      const pt = `loi:${i}`;
      if (!idXe.has(l?.xe)) them(pt, `Lỗi ${i + 1}: không có xe ${l?.xe}.`);
      if (!laLoi(l?.loi)) them(pt, `Lỗi ${i + 1}: loại lỗi không hợp lệ.`);
      if (!chuoi(l?.ma_muc_phat, 80)) them(pt, `Lỗi ${i + 1}: thiếu mã mức phạt.`);
      if (!chuoi(l?.mo_ta, 300)) them(pt, `Lỗi ${i + 1}: cần mô tả tình huống.`);
      if (loiDung.findIndex((k) => k?.xe === l?.xe && k?.loi === l?.loi) !== i)
        them(pt, `Lỗi ${i + 1}: trùng với lỗi trước.`);
    });
  if (!chuoi(da.giai_thich, 1000)) them("vu", "Cần giải thích diễn biến đúng (giai_thich).");
  if (loi.length) return loi;

  // Chạy dựng cảnh gốc: không chồng nhau lúc đầu, có va chạm, mọi xe dừng trong sơ đồ.
  const dung = dungCanhGoc(da as DapAnTaiDung);
  const canh = canhTaiDung(p as PayloadTaiDung, dung);
  const hop = canh.xe.map((x) => ({ id: x.id, h: hopBaoTam(x.x, x.y, x.huong, x.loai) }));
  for (let i = 0; i < hop.length; i++) {
    for (let j = i + 1; j < hop.length; j++)
      if (chongNhau(hop[i]!.h, hop[j]!.h))
        them(`xe:${hop[i]!.id}`, `Xe ${hop[i]!.id} và ${hop[j]!.id} chồng lên nhau lúc đầu.`);
    for (const v of canh.vat)
      if (chongNhau(hop[i]!.h, v))
        them(`xe:${hop[i]!.id}`, `Xe ${hop[i]!.id} chồng lên vật ${v.id} lúc đầu.`);
  }
  if (loi.length) return loi;
  const tt = chayVaCham(canh);
  if (!tt.va_cham.length) them("vu", "Dựng cảnh gốc không sinh va chạm nào.");
  else if (p.muc === 1 && !tt.va_cham.some((e) => e.vat)) them("vu", "Màn 1 cần xe va chạm với vật cố định.");
  else if (p.muc! >= 2 && !tt.va_cham.some((e) => !e.vat))
    them("vu", `Màn ${p.muc} cần hai xe va chạm nhau.`);
  if (p.muc === 4 && !tt.vet.some((v) => v.loai === "phanh")) them("vu", "Màn 4 cần có vết phanh.");
  for (const x of tt.xe) {
    if (x.pha === "ra_ngoai")
      them(`xe:${x.id}`, `Xe ${x.id} chạy ra khỏi sơ đồ; dấu vết không đủ để dựng lại.`);
    else if (x.pha !== "dung")
      them(`xe:${x.id}`, `Xe ${x.id} chưa dừng sau ${NHIP_TOI_DA_VA_CHAM / 20} giây mô phỏng.`);
  }
  return loi;
}

/* ------------------------------------------------------------------ */
/* Nhật ký                                                             */
/* ------------------------------------------------------------------ */

export const THAO_TAC_TAI_DUNG = [
  "dat",
  "xoay",
  "toc_do",
  "hanh_dong",
  "mo_phong",
  "gan_loi",
  "go_loi",
] as const;
export type ThaoTacTaiDung = (typeof THAO_TAC_TAI_DUNG)[number];
export type ThamSoTaiDung = {
  xe: string;
  x?: number;
  y?: number;
  huong?: Huong;
  muc?: MucTocDo;
  hd?: HanhDongXe;
  loi?: LoaiLoiTaiDung;
} | null;
export type TraLoiTaiDung = NhatKy<ThaoTacTaiDung, ThamSoTaiDung>;

export interface CapLoi {
  xe: string;
  loi: LoaiLoiTaiDung;
}

/** Trạng thái dựng của người chơi: thuộc tính mỗi xe (vị trí null khi chưa đặt), thẻ lỗi đã gắn. */
export interface BanDungTaiDung {
  xe: Record<string, Omit<ViTriDau, "x" | "y"> & { vi_tri: { x: number; y: number } | null }>;
  the: CapLoi[];
  so_lan: number;
}

export function banDungRong(vu: Pick<PayloadTaiDung, "xe">): BanDungTaiDung {
  return {
    xe: Object.fromEntries(
      vu.xe.map((x) => [x.id, { vi_tri: null, huong: 0, muc: 1, hanh_dong: "di_thang" }]),
    ),
    the: [],
    so_lan: 0,
  };
}

/** Dựng cảnh (chỉ các xe đã đặt) của một bản dựng. */
export function dungCanhCua(b: BanDungTaiDung): DungCanhTaiDung {
  const kq: DungCanhTaiDung = {};
  for (const [id, x] of Object.entries(b.xe))
    if (x.vi_tri)
      kq[id] = { x: x.vi_tri.x, y: x.vi_tri.y, huong: x.huong, muc: x.muc, hanh_dong: x.hanh_dong };
  return kq;
}

/**
 * Áp một thao tác lên bản dựng (trả bản mới). Thao tác không hợp lệ thì ném LoiNhatKy. Dùng chung cho
 * máy chủ (chạy lại) và điện thoại.
 */
export function apThaoTacTaiDung(
  vu: Pick<PayloadTaiDung, "so_do" | "xe">,
  b: BanDungTaiDung,
  thaoTac: ThaoTacTaiDung,
  t: ThamSoTaiDung,
): BanDungTaiDung {
  if (thaoTac === "mo_phong") return { ...b, so_lan: b.so_lan + 1 };
  if (!t || !Object.hasOwn(b.xe, t.xe)) throw new LoiNhatKy("Nhật ký có xe không có trong vụ.");
  const x = b.xe[t.xe]!;
  const moi = (sua: Partial<typeof x>) => ({ ...b, xe: { ...b.xe, [t.xe]: { ...x, ...sua } } });
  switch (thaoTac) {
    case "dat":
      if (!soNguyen(t.x, 0, vu.so_do.rong_m) || !soNguyen(t.y, 0, vu.so_do.cao_m))
        throw new LoiNhatKy("Nhật ký đặt xe ngoài sơ đồ.");
      return moi({ vi_tri: { x: t.x, y: t.y } });
    case "xoay":
      return moi({ huong: t.huong! });
    case "toc_do":
      return moi({ muc: t.muc! });
    case "hanh_dong":
      return moi({ hanh_dong: t.hd! });
    case "gan_loi": {
      if (b.the.some((c) => c.xe === t.xe && c.loi === t.loi)) return b;
      if (b.the.length >= SO_THE_TOI_DA) throw new LoiNhatKy(`Nhật ký gắn quá ${SO_THE_TOI_DA} thẻ lỗi.`);
      return { ...b, the: [...b.the, { xe: t.xe, loi: t.loi! }] };
    }
    case "go_loi": {
      if (!b.the.some((c) => c.xe === t.xe && c.loi === t.loi))
        throw new LoiNhatKy("Nhật ký gỡ thẻ chưa gắn.");
      return { ...b, the: b.the.filter((c) => !(c.xe === t.xe && c.loi === t.loi)) };
    }
  }
}

/** Dựng lại bản dựng lúc nộp từ nhật ký. */
export function dungLaiTaiDung(vu: Pick<PayloadTaiDung, "so_do" | "xe">, nk: TraLoiTaiDung): BanDungTaiDung {
  let b = banDungRong(vu);
  for (const t of nk.thao_tac) b = apThaoTacTaiDung(vu, b, t.thao_tac, t.tham_so);
  return b;
}

/* ------------------------------------------------------------------ */
/* Chấm                                                                */
/* ------------------------------------------------------------------ */

const lam1 = (x: number) => Math.round(x * 10) / 10;
const kc = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));

export interface KhopXe {
  xe: string;
  /** Vị trí cuối lệch bao nhiêu cm; null khi xe chưa được đặt. */
  lech_vi_tri_cm: number | null;
  /** Tổng độ dài vết (cm) của dựng cảnh gốc và của người chơi. */
  vet_goc_cm: number;
  vet_cua_ban_cm: number | null;
  /** Hướng cuối lệch mấy bậc 45°. */
  lech_huong: number | null;
  vi_tri: number;
  vet: number;
  huong: number;
}

export interface KetQuaKhop {
  diem: number;
  vi_tri: number;
  vet: number;
  huong: number;
  theo_xe: KhopXe[];
}

const doDaiVetCua = (d: DauVet, xe: string, loai: "phanh" | "truot") =>
  d.vet.filter((v) => v.xe === xe && v.loai === loai).reduce((s, v) => s + doDaiVet(v), 0);

/**
 * Độ khớp dấu vết của người chơi với dấu vết gốc, tối đa DIEM_KHOP_TOI_DA. Xe không có trong dấu vết của
 * người chơi (chưa đặt) được 0 ở mọi phần. Điểm từng phần giảm tuyến tính theo độ lệch, nên lệch càng
 * nhiều điểm càng thấp (không tăng).
 */
export function doKhopDauVet(goc: DauVet, cua: DauVet): KetQuaKhop {
  const n = Math.max(1, goc.cuoi.length);
  const theoXe: KhopXe[] = goc.cuoi.map((g) => {
    const c = cua.cuoi.find((x) => x.xe === g.xe);
    const vetGoc = doDaiVetCua(goc, g.xe, "phanh") + doDaiVetCua(goc, g.xe, "truot");
    if (!c)
      return {
        xe: g.xe,
        lech_vi_tri_cm: null,
        vet_goc_cm: vetGoc,
        vet_cua_ban_cm: null,
        lech_huong: null,
        vi_tri: 0,
        vet: 0,
        huong: 0,
      };
    const lech = Math.round(kc(g, c));
    const lechVet =
      Math.abs(doDaiVetCua(goc, g.xe, "phanh") - doDaiVetCua(cua, g.xe, "phanh")) +
      Math.abs(doDaiVetCua(goc, g.xe, "truot") - doDaiVetCua(cua, g.xe, "truot"));
    const lh = doLechHuong(g.huong, c.huong);
    return {
      xe: g.xe,
      lech_vi_tri_cm: lech,
      vet_goc_cm: vetGoc,
      vet_cua_ban_cm: doDaiVetCua(cua, g.xe, "phanh") + doDaiVetCua(cua, g.xe, "truot"),
      lech_huong: lh,
      vi_tri: (DIEM_VI_TRI_CUOI / n) * Math.max(0, 1 - lech / NGUONG_VI_TRI_CM),
      vet: (DIEM_VET / n) * Math.max(0, 1 - lechVet / NGUONG_VET_CM),
      huong: (DIEM_HUONG / n) * (lh === 0 ? 1 : lh === 1 ? 0.5 : 0),
    };
  });
  const tong = (k: "vi_tri" | "vet" | "huong") => lam1(theoXe.reduce((s, x) => s + x[k], 0));
  const viTri = tong("vi_tri");
  const vet = tong("vet");
  const huong = tong("huong");
  return {
    diem: lam1(Math.min(DIEM_KHOP_TOI_DA, viTri + vet + huong)),
    vi_tri: viTri,
    vet,
    huong,
    theo_xe: theoXe.map((x) => ({ ...x, vi_tri: lam1(x.vi_tri), vet: lam1(x.vet), huong: lam1(x.huong) })),
  };
}

/** Điểm kết luận: mỗi lỗi đúng chia đều DIEM_KET_LUAN (nửa đúng xe, nửa đúng lỗi); thẻ sai trừ TRU_THE_SAI. */
export function chamKetLuan(
  dung: readonly CapLoi[],
  the: readonly CapLoi[],
): { diem: number; the_sai: CapLoi[] } {
  const phan = DIEM_KET_LUAN / Math.max(1, dung.length);
  let diem = 0;
  for (const d of dung) {
    if (the.some((t) => t.xe === d.xe)) diem += phan / 2;
    if (the.some((t) => t.xe === d.xe && t.loi === d.loi)) diem += phan / 2;
  }
  const sai = the.filter((t) => !dung.some((d) => d.xe === t.xe && d.loi === t.loi));
  return { diem: lam1(Math.max(0, Math.min(DIEM_KET_LUAN, diem - TRU_THE_SAI * sai.length))), the_sai: sai };
}

/** Điểm theo số lần mô phỏng: 1–3 lần đủ điểm, 4–6 lần nửa, còn lại 0. */
export const diemSoLanMoPhong = (n: number) =>
  n >= 1 && n <= 3 ? DIEM_SO_LAN : n >= 4 && n <= 6 ? DIEM_SO_LAN / 2 : 0;

/* ------------------------------------------------------------------ */
/* Định nghĩa trò                                                      */
/* ------------------------------------------------------------------ */

/** Một nguồn của trò: vụ đã duyệt kèm dòng mức phạt đã duyệt (chỉ các mã đáp án trỏ tới). */
export interface NguonTaiDung {
  id: string;
  code: string;
  version: number;
  topic_id: string | null;
  vu: PayloadTaiDung;
  dap_an: DapAnTaiDung;
  muc_phat: Record<string, MucPhatDaDuyet>;
}

/** Nội dung một bước trong ảnh chụp lượt (có đáp án). */
export interface BuocTaiDung {
  man: number;
  vu: PayloadTaiDung;
  dap_an: DapAnTaiDung;
  dau_vet: DauVet;
  bien_ban: DongBienBan[];
}

/** Phần đề gửi người chơi: sơ đồ, xe, lời kể, dấu vết. Không có dựng cảnh gốc, lỗi đúng. */
export interface DeTaiDung extends PayloadTaiDung {
  man: number;
  dau_vet: DauVet;
  so_lan_toi_da: number;
  the_loi: Array<{ ma: LoaiLoiTaiDung; ten: string }>;
  ghi_chu: string;
}

export interface ChiTietTaiDung {
  hop_le: boolean;
  ly_do: string | null;
  so_lan_mo_phong: number;
  /** Dựng cảnh lúc nộp và dấu vết của nó. */
  dung_canh: DungCanhTaiDung;
  dau_vet: DauVet;
  bam: string;
  /** Dựng cảnh gốc (gửi SAU khi chấm để phát lại cạnh dựng cảnh của người chơi). */
  dung_canh_goc: DungCanhTaiDung;
  khop: KetQuaKhop;
  ket_luan: { diem: number; the: CapLoi[]; the_sai: CapLoi[]; dung: LoiDungTaiDung[] };
  diem_so_lan: number;
  giai_thich: string;
  bien_ban: DongBienBan[];
}

export function deTaiDung(b: BuocTaiDung): DeTaiDung {
  const v = b.vu;
  return {
    man: b.man,
    muc: v.muc,
    tin_bao: v.tin_bao,
    so_do: structuredClone(v.so_do),
    xe: v.xe.map((x) => ({ ...x })),
    loi_ke: v.loi_ke.map((k) => ({ ...k })),
    dau_vet: structuredClone(b.dau_vet),
    so_lan_toi_da: SO_LAN_MO_PHONG_TOI_DA,
    the_loi: LOAI_LOI_TAI_DUNG.map((ma) => ({ ma, ten: TEN_LOI_TAI_DUNG[ma] })),
    ghi_chu: GHI_CHU_MINH_HOA,
  };
}

/** Đọc một thao tác gửi lên; sai dạng trả null. */
function docThaoTac(
  thaoTac: unknown,
  thamSo: unknown,
): { thao_tac: ThaoTacTaiDung; tham_so: ThamSoTaiDung } | null {
  if (thaoTac === "mo_phong") return thamSo == null ? { thao_tac: "mo_phong", tham_so: null } : null;
  if (!(THAO_TAC_TAI_DUNG as readonly string[]).includes(thaoTac as string)) return null;
  if (!thamSo || typeof thamSo !== "object") return null;
  const t = thamSo as Record<string, unknown>;
  if (!chuoi(t.xe, 8)) return null;
  const xe = t.xe as string;
  switch (thaoTac as ThaoTacTaiDung) {
    case "dat":
      return soNguyen(t.x, -1000, 1000) && soNguyen(t.y, -1000, 1000)
        ? { thao_tac: "dat", tham_so: { xe, x: t.x, y: t.y } }
        : null;
    case "xoay":
      return soNguyen(t.huong, 0, 7) ? { thao_tac: "xoay", tham_so: { xe, huong: t.huong as Huong } } : null;
    case "toc_do":
      return soNguyen(t.muc, 0, 3) ? { thao_tac: "toc_do", tham_so: { xe, muc: t.muc as MucTocDo } } : null;
    case "hanh_dong":
      return (HANH_DONG_XE as readonly string[]).includes(t.hd as string)
        ? { thao_tac: "hanh_dong", tham_so: { xe, hd: t.hd as HanhDongXe } }
        : null;
    default:
      return laLoi(t.loi) ? { thao_tac: thaoTac as "gan_loi" | "go_loi", tham_so: { xe, loi: t.loi } } : null;
  }
}

export const TRO_CHOI_TAI_DUNG: DinhNghiaTroChoi<BuocTaiDung, DeTaiDung, TraLoiTaiDung> = {
  ma: MA_TAI_DUNG,
  ten: "Tái dựng hiện trường",
  moTa: "Đọc dấu vết trên sơ đồ hiện trường, dựng lại vị trí, hướng, tốc độ của các xe, mô phỏng kiểm chứng rồi kết luận lỗi.",
  offline: true,
  nguon: "tai_dung_vu",
  soBuoc: 1,
  thoiGian: null,
  thuongNhanh: false,
  xpCoBan: 12,
  manChoi: MAN_TAI_DUNG,

  locNguon(nguon) {
    return (nguon as NguonTaiDung[]).filter((n) => n?.vu && kiemTraVuTaiDung(n.vu, n.dap_an).length === 0);
  },

  taoLuot(nguon, rng, man) {
    const m = ganMan(man);
    const ds = (this.locNguon(nguon) as NguonTaiDung[])
      .filter((n) => n.vu.muc === m)
      .sort((a, b) => a.id.localeCompare(b.id));
    const n = tron(ds, rng)[0];
    if (!n) return [];
    return [
      {
        thu_tu: 1,
        ref_kind: "game_content",
        ref_id: n.id,
        ref_version: n.version,
        topic_id: n.topic_id,
        diem_toi_da: DIEM_TOI_DA_TAI_DUNG,
        noi_dung: {
          man: m,
          vu: n.vu,
          dap_an: n.dap_an,
          dau_vet: chayTaiDung(n.vu, dungCanhGoc(n.dap_an)).dau_vet,
          bien_ban: n.dap_an.loi.map((l) =>
            dongBienBan({
              hanhVi: TEN_LOI_TAI_DUNG[l.loi],
              chiTiet: l.mo_ta,
              canCu: [],
              maMucPhat: l.ma_muc_phat,
              mucPhat: n.muc_phat,
            }),
          ),
        },
      },
    ];
  },

  deChoNguoiChoi(buoc) {
    return deTaiDung(buoc.noi_dung);
  },

  docTraLoi(raw) {
    const nk = docNhatKy<ThaoTacTaiDung, ThamSoTaiDung>(raw, docThaoTac, {
      tongNhipToiDa: TONG_NHIP_TOI_DA_TAI_DUNG,
    });
    // Chống dò: quá số lần mô phỏng thì từ chối cả nhật ký.
    if (nk && nk.thao_tac.filter((t) => t.thao_tac === "mo_phong").length > SO_LAN_MO_PHONG_TOI_DA)
      return null;
    return nk;
  },

  chamBuoc(buoc, tl, ngCanh): KetQuaChamBuoc {
    const n = buoc.noi_dung;
    const kq = chayLaiRoiCham(tl, ngCanh?.thoiGianMs ?? null, (nk) => dungLaiTaiDung(n.vu, nk));
    const ban = kq.hop_le ? kq.ket_qua : banDungRong(n.vu);
    const dung = dungCanhCua(ban);
    const chay = chayTaiDung(n.vu, dung);
    const khop = doKhopDauVet(n.dau_vet, chay.dau_vet);
    const kl = chamKetLuan(n.dap_an.loi, ban.the);
    const diemSoLan = diemSoLanMoPhong(ban.so_lan);
    const diem = kq.hop_le ? lam1(khop.diem + kl.diem + diemSoLan) : 0;
    const chiTiet: ChiTietTaiDung = {
      hop_le: kq.hop_le,
      ly_do: kq.hop_le ? null : kq.ly_do,
      so_lan_mo_phong: ban.so_lan,
      dung_canh: dung,
      dau_vet: chay.dau_vet,
      bam: chay.bam,
      dung_canh_goc: dungCanhGoc(n.dap_an),
      khop,
      ket_luan: { diem: kq.hop_le ? kl.diem : 0, the: ban.the, the_sai: kl.the_sai, dung: n.dap_an.loi },
      diem_so_lan: kq.hop_le ? diemSoLan : 0,
      giai_thich: n.dap_an.giai_thich,
      bien_ban: n.bien_ban,
    };
    return {
      diem,
      diemToiDa: buoc.diem_toi_da,
      dung: kq.hop_le && kl.diem >= DIEM_KET_LUAN && khop.diem >= 40,
      chiTiet,
      giaiThich: kq.hop_le
        ? `Khớp dấu vết ${khop.diem}/${DIEM_KHOP_TOI_DA} điểm, kết luận ${kl.diem}/${DIEM_KET_LUAN} điểm, mô phỏng ${ban.so_lan} lần (${diemSoLan}/${DIEM_SO_LAN} điểm). ${GHI_CHU_MINH_HOA}`
        : `Không chấm được: ${kq.ly_do}`,
      canCu: [...new Set(n.bien_ban.flatMap((d) => d.can_cu))],
    };
  },
};
