/**
 * Trò "Trạm cân tải trọng" (docs/PLAN.md GĐ-T12, docs/GAME_DESIGN.md §5.12).
 *
 * Mỗi xe tải là một bước. Người chơi chạm một số trên phiếu cân và một số giới hạn (giấy chứng nhận kiểm
 * định, bảng tải trọng tại trạm, giấy phép lưu hành) để ghim cặp số làm căn cứ; kéo thanh trượt ước phần
 * trăm vượt; đóng một trong ba dấu: Cho đi, Hạ tải, Lập biên bản. Chấm (tối đa 18):
 *   - dấu đúng: 10;
 *   - cặp số căn cứ đúng là cặp quyết định (cặp có phần trăm vượt cao nhất; xe không vượt thì cặp của
 *     giới hạn gần nhất): 5;
 *   - phần trăm ước trong ±2 điểm phần trăm so với phần trăm máy chủ tính: 3.
 *
 * Ngưỡng không đặt trong mã: giới hạn tải trọng lấy từ `load_limits` đã duyệt (câu D17), khung phần trăm
 * quá tải lấy từ `violations` đã duyệt. Đúng bằng giới hạn tính là KHÔNG vượt. Dấu đúng (câu D18, demo):
 *   - có cặp số rơi vào một khung phần trăm bị xử phạt: Lập biên bản (gồm cả buộc hạ tải);
 *   - có cặp vượt nhưng chưa tới khung bị xử phạt nào: Hạ tải;
 *   - không cặp nào vượt: Cho đi.
 * Ngưỡng hoặc khung đổi sau khi duyệt lại thì đáp án đổi theo (tính lúc tạo lượt).
 *
 * Phạm vi so theo màn: màn 1 tổng trọng lượng với khối lượng toàn bộ cho phép; màn 2 thêm khối lượng hàng
 * chuyên chở; màn 3 thêm tải trọng trục, cụm trục, tổng trọng lượng theo loại xe (bảng tải trọng tại trạm);
 * màn 4 thêm giấy phép lưu hành: còn hạn, đúng tuyến thì giới hạn của giấy phép thay cho bảng tại trạm.
 *
 * Hàm thuần. Bộ kiểm dạng dữ liệu (chỉ máy chủ dùng) ở tram-can-kiem.ts.
 */

import { tron } from "../de-thi.ts";
import { type KhoangTocDo, type LoaiQuaTai, trongKhoang } from "../tra-cuu-nhanh.ts";
import { type DongBienBan, dongBienBan, type MucPhatDaDuyet } from "./chung/bien-ban.ts";
import type { GiayKiemDinh, GiayPhepLuuHanh, PhieuCan } from "./chung/giay-to.ts";
import type { CauHinhMan } from "./chung/man-choi.ts";
import type { BuocLuot, DinhNghiaTroChoi } from "./khung.ts";

export const MA_TRAM_CAN = "tram_can";
export const DIEM_DAU_TC = 10;
export const DIEM_CAP_TC = 5;
export const DIEM_UOC_TC = 3;
export const DIEM_MOI_XE_TAI = DIEM_DAU_TC + DIEM_CAP_TC + DIEM_UOC_TC;
/** Phần trăm ước lệch không quá số điểm phần trăm này thì được điểm. */
export const SAI_SO_UOC = 2;
export const UOC_TOI_DA = 200;

export const DAU_TRAM_CAN = ["cho_di", "ha_tai", "lap_bien_ban"] as const;
export type DauTramCan = (typeof DAU_TRAM_CAN)[number];
export const TEN_DAU_TRAM_CAN: Record<DauTramCan, string> = {
  cho_di: "Cho đi",
  ha_tai: "Hạ tải",
  lap_bien_ban: "Lập biên bản",
};

export const LOAI_XE_TAI = ["xe_tai_2_truc", "xe_tai_3_truc", "xe_tai_4_truc", "dau_keo_so_mi"] as const;
export type LoaiXeTai = (typeof LOAI_XE_TAI)[number];
export const TEN_LOAI_XE_TAI: Record<LoaiXeTai, string> = {
  xe_tai_2_truc: "Xe tải hai trục",
  xe_tai_3_truc: "Xe tải ba trục",
  xe_tai_4_truc: "Xe tải bốn trục",
  dau_keo_so_mi: "Xe đầu kéo kéo sơ mi rơ moóc",
};

export const TEN_LOAI_QUA_TAI: Record<LoaiQuaTai, string> = {
  kiem_dinh: "so với giấy chứng nhận kiểm định",
  cau_duong: "so với tải trọng cho phép của cầu, đường",
};

/** Một nhóm trục: trục đơn, hoặc cụm 2, 3 trục với khoảng cách giữa hai trục liền kề (cm). */
export type NhomTruc = { loai: "don" } | { loai: "cum"; so_truc: 2 | 3; khoang_cach_cm: number };

/* ------------------------------------------------------------------ */
/* Màn chơi                                                            */
/* ------------------------------------------------------------------ */

export const SO_XE_THEO_MAN: Readonly<Record<number, number>> = { 1: 6, 2: 6, 3: 7, 4: 8, 5: 8 };

export const MAN_TRAM_CAN: readonly CauHinhMan[] = [
  {
    so: 1,
    ten: "Màn 1: Tổng trọng lượng",
    moTa: "6 xe tải hai trục. So tổng trọng lượng với khối lượng toàn bộ cho phép. Không tính giờ.",
    caLuotMs: null,
    xpCoBan: 10,
  },
  {
    so: 2,
    ten: "Màn 2: Hàng chuyên chở",
    moTa: "6 xe. Thêm khối lượng hàng chuyên chở cho phép theo giấy kiểm định. Không tính giờ.",
    caLuotMs: null,
    xpCoBan: 12,
  },
  {
    so: 3,
    ten: "Màn 3: Tải trọng trục",
    moTa: "7 xe. Thêm tải trọng trục, cụm trục theo bảng tại trạm. 4 phút cho cả ca.",
    caLuotMs: 240_000,
    xpCoBan: 14,
  },
  {
    so: 4,
    ten: "Màn 4: Giấy phép lưu hành",
    moTa: "8 xe. Giấy phép lưu hành còn hạn, hết hạn, sai tuyến. 4 phút cho cả ca.",
    caLuotMs: 240_000,
    xpCoBan: 16,
  },
  {
    so: 5,
    ten: "Màn 5: Đầu kéo, cụm trục",
    moTa: "8 xe, có xe đầu kéo sơ mi rơ moóc nhiều cụm trục. 3 phút 30 giây cho cả ca.",
    caLuotMs: 210_000,
    xpCoBan: 18,
  },
];
export const SO_MAN_TRAM_CAN = MAN_TRAM_CAN.length;

const ganMan = (man: number | undefined) =>
  Math.min(SO_MAN_TRAM_CAN, Math.max(1, Number.isInteger(man) ? (man as number) : 1));

/* ------------------------------------------------------------------ */
/* Dữ liệu                                                             */
/* ------------------------------------------------------------------ */

/** Dữ kiện một xe (game_content.payload, trừ `muc`). */
export interface XeTramCan {
  loai_xe: LoaiXeTai;
  bien_so: string;
  tuyen_dang_di: string;
  nhom_truc: NhomTruc[];
  phieu_can: PhieuCan;
  giay_kiem_dinh: GiayKiemDinh;
  giay_phep_luu_hanh: GiayPhepLuuHanh | null;
}

export interface PayloadTramCan extends XeTramCan {
  muc: number;
}

/** Một dòng `load_limits` đã duyệt. */
export interface GioiHanTaiTrong {
  ma: string;
  version: number;
  loai: "tong" | "truc_don" | "cum_truc";
  loai_xe: LoaiXeTai | null;
  so_truc_cum: number | null;
  cach_tu_cm: number | null;
  /** Khoảng cách trục [từ, đến); null là không cận trên. */
  cach_den_cm: number | null;
  gioi_han_kg: number;
  ten: string;
  can_cu: string;
}

/** Một khung phần trăm quá tải: dòng `violations` đã duyệt có `qua_tai_*`. */
export interface KhungQuaTai {
  ma: string;
  loai: LoaiQuaTai;
  khoang: KhoangTocDo;
}

export interface NguonTramCan {
  id: string;
  code: string;
  version: number;
  topic_id: string | null;
  muc: number;
  xe: XeTramCan;
  gioi_han: GioiHanTaiTrong[];
  khung: KhungQuaTai[];
  muc_phat: Record<string, MucPhatDaDuyet>;
}

/** Cặp số người chơi ghim: mã số trên phiếu cân và mã số giới hạn. */
export interface CapSo {
  phieu: string;
  gioi_han: string;
}

/** Một cặp số hợp lệ, đã tính. */
export interface CapTinh extends CapSo {
  loai: LoaiQuaTai;
  ten: string;
  so_kg: number;
  gioi_han_kg: number;
  /** Phần trăm so với giới hạn, làm tròn 0,1; âm là còn dưới giới hạn. */
  phan_tram: number;
  can_cu: string | null;
  /** Mã dòng mức phạt của khung chứa phần trăm này (vượt và rơi vào khung bị xử phạt). */
  khung_ma: string | null;
}

export interface BuocTramCan {
  man: number;
  xe: XeTramCan;
  cap: CapTinh[];
  /** Chỉ số cặp quyết định trong `cap`. */
  quyet: number;
  dau: DauTramCan;
  bang: GioiHanTaiTrong[];
  bien_ban: DongBienBan[];
}

/** Phần đề gửi người chơi: mọi số trên phiếu, giấy, bảng tại trạm; không khung, không dấu, không cặp đúng. */
export interface DeTramCan {
  man: number;
  loai_xe: LoaiXeTai;
  ten_loai_xe: string;
  bien_so: string;
  tuyen_dang_di: string;
  nhom_truc: NhomTruc[];
  phieu_can: PhieuCan & { hang_kg: number | null };
  giay_kiem_dinh: GiayKiemDinh;
  giay_phep_luu_hanh: GiayPhepLuuHanh | null;
  bang: Array<{ ma: string; ten: string; gioi_han_kg: number }>;
}

export interface TraLoiTramCan {
  dau: DauTramCan;
  cap: CapSo;
  uoc: number;
}

export interface ChiTietTramCan {
  dau: DauTramCan;
  dau_dung: DauTramCan;
  diem_dau: number;
  diem_cap: number;
  diem_uoc: number;
  uoc: number;
  /** Phần trăm vượt của cặp quyết định (0 khi không vượt). */
  phan_tram_vuot: number;
  cap_chon: CapTinh | null;
  cap_quyet: CapTinh;
  cac_cap: CapTinh[];
  bien_ban: DongBienBan[];
}

/* ------------------------------------------------------------------ */
/* Tính cặp số                                                         */
/* ------------------------------------------------------------------ */

export const soTrucCuaNhom = (n: NhomTruc) => (n.loai === "don" ? 1 : n.so_truc);

/** "Cụm 2 trục, cách 1,35 m" */
export function tenNhomTruc(n: NhomTruc, i: number): string {
  return n.loai === "don"
    ? `Trục ${i + 1} (trục đơn)`
    : `Cụm trục ${i + 1} (${n.so_truc} trục, cách ${(n.khoang_cach_cm / 100).toLocaleString("vi-VN")} m)`;
}

const chuan = (s: string) => s.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");

/** Giấy phép lưu hành dùng được: đúng xe, đúng tuyến đang đi, còn hạn tại ngày cân. */
export function giayPhepDungDuoc(xe: XeTramCan): boolean {
  const g = xe.giay_phep_luu_hanh;
  const ngay = xe.phieu_can.ngay_can;
  return (
    !!g &&
    chuan(g.bien_so) === chuan(xe.bien_so) &&
    chuan(g.tuyen) === chuan(xe.tuyen_dang_di) &&
    g.tu_ngay <= ngay &&
    ngay <= g.den_ngay
  );
}

/** Dòng giới hạn áp cho một nhóm trục. */
export function gioiHanChoNhom(ds: readonly GioiHanTaiTrong[], n: NhomTruc): GioiHanTaiTrong | undefined {
  if (n.loai === "don") return ds.find((g) => g.loai === "truc_don");
  return ds.find(
    (g) =>
      g.loai === "cum_truc" &&
      g.so_truc_cum === n.so_truc &&
      (g.cach_tu_cm ?? 0) <= n.khoang_cach_cm &&
      (g.cach_den_cm === null || n.khoang_cach_cm < g.cach_den_cm),
  );
}

/** Bảng tải trọng tại trạm cho một loại xe: tổng trọng lượng của loại xe, trục đơn, các cụm trục. */
export function bangChoXe(ds: readonly GioiHanTaiTrong[], loai: LoaiXeTai): GioiHanTaiTrong[] {
  return ds.filter((g) => (g.loai === "tong" ? g.loai_xe === loai : true));
}

export const phanTram = (so: number, gioiHan: number) => Math.round(((so - gioiHan) / gioiHan) * 1000) / 10;

/** Có phần kiểm cầu đường (màn 3 trở đi), có giấy phép (màn 4 trở đi). */
const coHang = (man: number) => man >= 2;
const coCauDuong = (man: number) => man >= 3;
const coGiayPhep = (man: number) => man >= 4;

/**
 * Các cặp số hợp lệ ở một màn, theo thứ tự cố định (thứ tự này phân xử khi hai cặp cùng phần trăm).
 * Thiếu dòng giới hạn đã duyệt cho một nhóm trục hoặc cho tổng trọng lượng của loại xe thì trả null.
 */
export function capHopLe(
  xe: XeTramCan,
  gioiHan: readonly GioiHanTaiTrong[],
  man: number,
): Omit<CapTinh, "khung_ma">[] | null {
  const kq: Omit<CapTinh, "khung_ma">[] = [];
  const them = (
    phieu: string,
    gh: string,
    loai: LoaiQuaTai,
    ten: string,
    so: number,
    ghKg: number,
    canCu: string | null,
  ) =>
    kq.push({
      phieu,
      gioi_han: gh,
      loai,
      ten,
      so_kg: so,
      gioi_han_kg: ghKg,
      phan_tram: phanTram(so, ghKg),
      can_cu: canCu,
    });
  const p = xe.phieu_can;
  const k = xe.giay_kiem_dinh;
  them(
    "phieu.tong",
    "kd.toan_bo",
    "kiem_dinh",
    "Tổng trọng lượng so với khối lượng toàn bộ cho phép",
    p.tong_kg,
    k.toan_bo_cho_phep_kg,
    null,
  );
  if (coHang(man))
    them(
      "phieu.hang",
      "kd.hang",
      "kiem_dinh",
      "Khối lượng hàng so với khối lượng hàng chuyên chở cho phép",
      p.tong_kg - k.tu_trong_kg,
      k.hang_cho_phep_kg,
      null,
    );
  if (!coCauDuong(man)) return kq;
  const gp = coGiayPhep(man) && giayPhepDungDuoc(xe) ? xe.giay_phep_luu_hanh! : null;
  if (gp) {
    them(
      "phieu.tong",
      "gp.tong",
      "cau_duong",
      "Tổng trọng lượng so với giấy phép lưu hành",
      p.tong_kg,
      gp.tong_cho_phep_kg,
      null,
    );
    for (const [i, n] of xe.nhom_truc.entries()) {
      const don = n.loai === "don";
      them(
        `phieu.truc.${i}`,
        don ? "gp.truc_don" : "gp.cum_truc",
        "cau_duong",
        `${tenNhomTruc(n, i)} so với giấy phép lưu hành`,
        p.truc_kg[i]!,
        don ? gp.truc_don_cho_phep_kg : gp.cum_truc_cho_phep_kg,
        null,
      );
    }
    return kq;
  }
  const tong = gioiHan.find((g) => g.loai === "tong" && g.loai_xe === xe.loai_xe);
  if (!tong) return null;
  them(
    "phieu.tong",
    `bang.${tong.ma}`,
    "cau_duong",
    `Tổng trọng lượng so với ${tong.ten.toLowerCase()}`,
    p.tong_kg,
    tong.gioi_han_kg,
    tong.can_cu,
  );
  for (const [i, n] of xe.nhom_truc.entries()) {
    const g = gioiHanChoNhom(gioiHan, n);
    if (!g) return null;
    them(
      `phieu.truc.${i}`,
      `bang.${g.ma}`,
      "cau_duong",
      `${tenNhomTruc(n, i)} so với ${g.ten.toLowerCase()}`,
      p.truc_kg[i]!,
      g.gioi_han_kg,
      g.can_cu,
    );
  }
  return kq;
}

/** Ngưỡng bắt đầu xử phạt của một loại quá tải: cận dưới nhỏ nhất của các khung. */
function nguongPhat(khung: readonly KhungQuaTai[], loai: LoaiQuaTai): number | null {
  const ds = khung.filter((k) => k.loai === loai).map((k) => k.khoang.tu);
  return ds.length ? Math.min(...ds) : null;
}

export interface DapAnTramCan {
  cap: CapTinh[];
  quyet: number;
  dau: DauTramCan;
}

/**
 * Đáp án của một xe ở một màn, hoặc null khi không chấm được: thiếu giới hạn đã duyệt, thiếu khung phần
 * trăm của một loại quá tải đang xét, hoặc phần trăm vượt rơi vào khoảng trống giữa các khung.
 */
export function dapAnTramCan(
  xe: XeTramCan,
  gioiHan: readonly GioiHanTaiTrong[],
  khung: readonly KhungQuaTai[],
  man: number,
): DapAnTramCan | null {
  const ds = capHopLe(xe, gioiHan, man);
  if (!ds) return null;
  const cap: CapTinh[] = [];
  for (const c of ds) {
    const nguong = nguongPhat(khung, c.loai);
    if (nguong === null) return null;
    const k =
      c.phan_tram > 0
        ? khung.find((x) => x.loai === c.loai && trongKhoang(x.khoang, c.phan_tram))
        : undefined;
    if (!k && c.phan_tram > nguong) return null;
    cap.push({ ...c, khung_ma: k?.ma ?? null });
  }
  let quyet = 0;
  cap.forEach((c, i) => {
    if (c.phan_tram > cap[quyet]!.phan_tram) quyet = i;
  });
  const dau: DauTramCan = cap.some((c) => c.khung_ma)
    ? "lap_bien_ban"
    : cap.some((c) => c.phan_tram > 0)
      ? "ha_tai"
      : "cho_di";
  return { cap, quyet, dau };
}

/** Xe dùng được ở một màn: màn của xe không cao hơn màn đang chơi và chấm được bằng ngưỡng đã duyệt. */
export function xeDungDuocOMan(n: NguonTramCan, man: number): boolean {
  return n.muc <= ganMan(man) && dapAnTramCan(n.xe, n.gioi_han, n.khung, ganMan(man)) !== null;
}

/* ------------------------------------------------------------------ */
/* Định nghĩa trò                                                      */
/* ------------------------------------------------------------------ */

const kg = (n: number) => `${n.toLocaleString("vi-VN")} kg`;
const pt = (n: number) => `${n.toLocaleString("vi-VN")}%`;

function dungBuoc(n: NguonTramCan, thuTu: number, man: number): BuocLuot<BuocTramCan> {
  const da = dapAnTramCan(n.xe, n.gioi_han, n.khung, man)!;
  // Mỗi dòng mức phạt một dòng biên bản, lấy cặp có phần trăm cao nhất trong khung đó.
  const theoKhung = new Map<string, CapTinh>();
  for (const c of da.cap)
    if (c.khung_ma && (theoKhung.get(c.khung_ma)?.phan_tram ?? -1) < c.phan_tram)
      theoKhung.set(c.khung_ma, c);
  return {
    thu_tu: thuTu,
    ref_kind: "game_content",
    ref_id: n.id,
    ref_version: n.version,
    topic_id: n.topic_id,
    diem_toi_da: DIEM_MOI_XE_TAI,
    noi_dung: {
      man,
      xe: n.xe,
      cap: da.cap,
      quyet: da.quyet,
      dau: da.dau,
      bang: coCauDuong(man) ? bangChoXe(n.gioi_han, n.xe.loai_xe) : [],
      bien_ban: [...theoKhung].map(([ma, c]) =>
        dongBienBan({
          hanhVi: n.muc_phat[ma]?.hanh_vi ?? "Chở hàng vượt tải trọng cho phép",
          chiTiet: `Xe ${n.xe.bien_so}: ${c.ten.toLowerCase()}: ${kg(c.so_kg)} so với ${kg(c.gioi_han_kg)}, vượt ${pt(c.phan_tram)}.`,
          canCu: c.can_cu ? [c.can_cu] : [],
          maMucPhat: ma,
          mucPhat: n.muc_phat,
        }),
      ),
    },
  };
}

function giaiThich(b: BuocTramCan): string {
  const q = b.cap[b.quyet]!;
  if (b.dau === "cho_di")
    return `Không số nào vượt giới hạn. Gần giới hạn nhất: ${q.ten.toLowerCase()} (${kg(q.so_kg)} so với ${kg(q.gioi_han_kg)}). Cho đi.`;
  const dau = `${q.ten}: ${kg(q.so_kg)} so với ${kg(q.gioi_han_kg)}, vượt ${pt(q.phan_tram)}.`;
  return b.dau === "ha_tai"
    ? `${dau} Xe vượt nhưng chưa tới khung bị xử phạt: buộc hạ tải phần vượt.`
    : `${dau} Có số vượt vào khung bị xử phạt: lập biên bản (gồm cả buộc hạ tải).`;
}

const MA_SO_RE = /^(phieu|kd|bang|gp)\.[a-z0-9_.-]{1,80}$/;

export const TRO_CHOI_TRAM_CAN: DinhNghiaTroChoi<BuocTramCan, DeTramCan, TraLoiTramCan> = {
  ma: MA_TRAM_CAN,
  ten: "Trạm cân tải trọng",
  moTa: "Ghim cặp số làm căn cứ, ước phần trăm vượt, đóng dấu Cho đi, Hạ tải hoặc Lập biên bản cho từng xe tải.",
  offline: true,
  nguon: "tram_can_xe",
  // Số xe tối thiểu để bắt đầu; số xe mỗi ca theo màn ở SO_XE_THEO_MAN.
  soBuoc: SO_XE_THEO_MAN[1]!,
  thoiGian: null,
  thuongNhanh: false,
  xpCoBan: 10,
  manChoi: MAN_TRAM_CAN,

  locNguon(nguon) {
    // Nguồn đã qua bộ kiểm dạng đầy đủ ở máy chủ (tram-can-kiem.ts); ở đây chỉ kiểm khung.
    return (nguon as NguonTramCan[]).filter(
      (n) =>
        n?.xe?.phieu_can && Array.isArray(n.gioi_han) && Array.isArray(n.khung) && Number.isInteger(n.muc),
    );
  },

  taoLuot(nguon, rng, man) {
    const m = ganMan(man);
    const soXe = SO_XE_THEO_MAN[m] ?? this.soBuoc;
    // Sắp theo id trước khi trộn: lượt chỉ phụ thuộc tập nguồn, seed và màn.
    const dung = tron(
      (this.locNguon(nguon) as NguonTramCan[])
        .filter((n) => xeDungDuocOMan(n, m))
        .sort((a, b) => a.id.localeCompare(b.id)),
      rng,
    );
    const pool = [...dung.filter((n) => n.muc === m), ...dung.filter((n) => n.muc !== m)];
    const dau = new Map(pool.map((n) => [n, dapAnTramCan(n.xe, n.gioi_han, n.khung, m)!.dau]));
    const chon: NguonTramCan[] = [];
    const lay = (dk: (n: NguonTramCan) => boolean, soLuong: number) => {
      for (const n of pool) {
        if (soLuong <= 0 || chon.length >= soXe) return;
        if (!chon.includes(n) && dk(n)) {
          chon.push(n);
          soLuong--;
        }
      }
    };
    // Mỗi dấu ít nhất một xe (nếu đủ nguồn), ưu tiên xe đúng màn đang chơi.
    for (const d of DAU_TRAM_CAN) lay((n) => dau.get(n) === d, 1);
    lay(() => true, soXe);
    return tron(chon, rng).map((n, i) => dungBuoc(n, i + 1, m));
  },

  deChoNguoiChoi(buoc) {
    const { man, xe, bang } = buoc.noi_dung;
    const p = xe.phieu_can;
    return {
      man,
      loai_xe: xe.loai_xe,
      ten_loai_xe: TEN_LOAI_XE_TAI[xe.loai_xe],
      bien_so: xe.bien_so,
      tuyen_dang_di: xe.tuyen_dang_di,
      nhom_truc: xe.nhom_truc,
      phieu_can: {
        ...p,
        truc_kg: coCauDuong(man) ? p.truc_kg : [],
        hang_kg: coHang(man) ? p.tong_kg - xe.giay_kiem_dinh.tu_trong_kg : null,
      },
      giay_kiem_dinh: xe.giay_kiem_dinh,
      giay_phep_luu_hanh: coGiayPhep(man) ? xe.giay_phep_luu_hanh : null,
      bang: bang.map((g) => ({ ma: `bang.${g.ma}`, ten: g.ten, gioi_han_kg: g.gioi_han_kg })),
    };
  },

  docTraLoi(raw) {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    if (!(DAU_TRAM_CAN as readonly unknown[]).includes(r.dau)) return null;
    const c = r.cap as Record<string, unknown> | null | undefined;
    // Không có cặp số làm căn cứ thì không nhận: người chơi phải tự chỉ ra con số.
    if (!c || typeof c.phieu !== "string" || typeof c.gioi_han !== "string") return null;
    if (!c.phieu.startsWith("phieu.") || !MA_SO_RE.test(c.phieu) || !MA_SO_RE.test(c.gioi_han)) return null;
    if (c.gioi_han.startsWith("phieu.")) return null;
    // Chỉ đọc giá trị thanh trượt; phần trăm, điểm, cờ đúng máy khách gửi kèm bị bỏ qua.
    if (!Number.isInteger(r.uoc) || (r.uoc as number) < 0 || (r.uoc as number) > UOC_TOI_DA) return null;
    return { dau: r.dau as DauTramCan, cap: { phieu: c.phieu, gioi_han: c.gioi_han }, uoc: r.uoc as number };
  },

  chamBuoc(buoc, tl) {
    const b = buoc.noi_dung;
    const q = b.cap[b.quyet]!;
    const capChon = b.cap.find((c) => c.phieu === tl.cap.phieu && c.gioi_han === tl.cap.gioi_han) ?? null;
    const vuot = Math.max(0, q.phan_tram);
    const diemDau = tl.dau === b.dau ? DIEM_DAU_TC : 0;
    // Hai cặp cùng phần trăm cao nhất thì cặp nào cũng là cặp quyết định.
    const diemCap = capChon && capChon.phan_tram === q.phan_tram ? DIEM_CAP_TC : 0;
    const diemUoc = Math.abs(tl.uoc - vuot) <= SAI_SO_UOC + 1e-9 ? DIEM_UOC_TC : 0;
    const diem = diemDau + diemCap + diemUoc;
    const chiTiet: ChiTietTramCan = {
      dau: tl.dau,
      dau_dung: b.dau,
      diem_dau: diemDau,
      diem_cap: diemCap,
      diem_uoc: diemUoc,
      uoc: tl.uoc,
      phan_tram_vuot: vuot,
      cap_chon: capChon,
      cap_quyet: q,
      cac_cap: b.cap,
      bien_ban: b.bien_ban,
    };
    return {
      diem,
      diemToiDa: buoc.diem_toi_da,
      dung: diem >= buoc.diem_toi_da,
      chiTiet,
      giaiThich: giaiThich(b),
      canCu: [
        ...new Set(
          [...b.cap.map((c) => c.can_cu ?? ""), ...b.bien_ban.flatMap((d) => d.can_cu)].filter(Boolean),
        ),
      ],
    };
  },
};
