/**
 * Trò "Cung đường biển báo" (docs/PLAN.md GĐ-G8, docs/GAME_DESIGN.md §5.5).
 *
 * Một lượt gồm 4 bước trên khung chung:
 *   1–3. Khởi động: đoán tên biển (dùng lại luật "Đoán biển báo" GĐ12), mỗi câu 5 điểm.
 *   4.   Đường chạy: xe tự chạy qua 12 biển. Mỗi biển có một cửa sổ phản ứng, ngắn dần qua 3 chặng.
 *        Người chơi bấm một trong 4 thao tác; điện thoại ghi nhật ký `{ bien, thao_tac, ms }` và gửi
 *        cả nhật ký khi về đích. Máy chủ chấm lại từ nhật ký.
 *
 * Chấm đường chạy (mỗi biển 10 điểm, thưởng nhanh tới 5):
 *  - Biển cần phản ứng: thao tác đầu tiên trong cửa sổ đúng thì +10 và thưởng; sai hoặc không bấm thì
 *    mất một mạng.
 *  - Biển không cần phản ứng (thao tác đúng là "Đi tiếp"): bấm "Đi tiếp" +10 và thưởng; không bấm,
 *    hoặc bấm "Giảm tốc"/"Dừng lại" thì 0 điểm, không mất mạng (không phạt người thận trọng); bấm
 *    "Không rẽ, không vào" là sai, mất mạng.
 *  - Hết 3 mạng: các biển sau không tính. Mốc trước khi biển hiện bị loại.
 *  - Nhật ký có tổng thời gian dài hơn thời gian máy chủ đo quá 10% (cộng dung sai mạng), hoặc có mốc
 *    sau lúc kết thúc: cả bước 0 điểm (người dùng chọn 25/9/2026: chấm 0, không từ chối).
 *
 * Thao tác đúng gửi kèm đề đường chạy để điện thoại phản hồi ngay và tính mạng; điểm vẫn do máy chủ
 * chấm lại. Hàm thuần: không chạm CSDL, không đọc đồng hồ.
 */

import { laThaoTacBienBao, type NhomBienBao, type ThaoTacBienBao } from "../bien-bao.ts";
import { tron } from "../de-thi.ts";
import { type BienBaoGame, chamCauDoan, taoVanDoan } from "./doan-bien-bao.ts";
import { type BuocLuot, type DinhNghiaTroChoi, DUNG_SAI_BUOC_MS, type KetQuaChamBuoc } from "./khung.ts";

export const MA_CUNG_DUONG = "cung_duong_bien_bao";
export const SO_CAU_KHOI_DONG = 3;
export const DIEM_CAU_KHOI_DONG = 5;
export const SO_BIEN_DUONG = 12;
export const DIEM_MOI_BIEN = 10;
export const THUONG_BIEN_TOI_DA = 5;
export const SO_MANG = 3;
/** Cửa sổ phản ứng theo chặng (4 biển mỗi chặng): ngắn dần khi lên cấp. */
export const CUA_SO_THEO_CHANG_MS = [3000, 2600, 2200] as const;
export const BIEN_MOI_CHANG = 4;
/** Từ lúc xuất phát tới biển đầu; từ lúc hết cửa sổ biển trước tới biển sau; sau biển cuối. */
export const MO_DAU_MS = 2500;
export const KHOANG_CACH_MS = 2500;
export const KET_THUC_MS = 2000;
/** Nhật ký dài hơn thời gian máy chủ đo quá tỷ lệ này (cộng dung sai mạng) thì không hợp lệ. */
export const LECH_GIO_TOI_DA = 0.1;
/** Tạm dừng (tab ẩn) quá mức này thì điện thoại kết thúc đường chạy. */
export const TAM_DUNG_TOI_DA_MS = 10_000;
const SU_KIEN_TOI_DA = 200;

/* ------------------------------------------------------------------ */
/* Dữ liệu                                                             */
/* ------------------------------------------------------------------ */

/** Một nguồn: biển đã duyệt có thao tác phản ứng. */
export interface BienPhanUng {
  ma: string;
  version: number;
  nhom: NhomBienBao;
  ten: string;
  y_nghia: string;
  /** Tên tệp ảnh (web phục vụ ở /bien-bao/anh/<tệp>). */
  anh: string;
  can_cu: string;
  topic_id: string | null;
  phan_ung: ThaoTacBienBao;
  ghi_chu_phan_ung: string | null;
}

/** Một biển trên đường chạy, có đáp án. */
export interface BienTrenDuong {
  thu_tu: number;
  ma: string;
  ten: string;
  anh: string;
  phan_ung: ThaoTacBienBao;
  ghi_chu: string | null;
  can_cu: string;
  /** Lúc biển hiện, tính từ lúc xuất phát. */
  hien_ms: number;
  cua_so_ms: number;
}

export type BuocCungDuong =
  | {
      loai: "doan";
      ma: string;
      anh: string;
      ten: string;
      y_nghia: string;
      can_cu: string;
      /** Mã và tên các phương án, đã trộn. */
      phuong_an: Array<{ ma: string; ten: string }>;
    }
  | { loai: "duong"; bien: BienTrenDuong[]; tong_ms: number };

export type DeCungDuong =
  | { loai: "doan"; anh: string; phuong_an: Array<{ id: string; text: string }> }
  | {
      loai: "duong";
      so_mang: number;
      tong_ms: number;
      bien: Array<Pick<BienTrenDuong, "thu_tu" | "anh" | "phan_ung" | "hien_ms" | "cua_so_ms">>;
    };

export interface SuKienDuong {
  /** Thứ tự biển (1…12) mà người chơi phản ứng. */
  bien: number;
  thao_tac: ThaoTacBienBao;
  /** Mili giây tính từ lúc xuất phát (không tính lúc tạm dừng). */
  ms: number;
}

export type TraLoiCungDuong =
  | { loai: "doan"; chon: string | null }
  | { loai: "duong"; su_kien: SuKienDuong[]; tong_ms: number };

export type KetBien = "dung" | "sai" | "bo_lo" | "than_trong" | "bo_qua" | "khong_tinh";

export interface KetQuaBien {
  thu_tu: number;
  ma: string;
  ten: string;
  anh: string;
  phan_ung: ThaoTacBienBao;
  chon: ThaoTacBienBao | null;
  ket: KetBien;
  diem: number;
  thuong: number;
  mat_mang: boolean;
  ghi_chu: string | null;
}

export interface ChiTietDuong {
  loai: "duong";
  hop_le: boolean;
  ly_do: string | null;
  mang_con: number;
  /** Số mốc bị loại vì bấm trước khi biển hiện. */
  moc_bi_loai: number;
  bien: KetQuaBien[];
}

/* ------------------------------------------------------------------ */
/* Sinh lượt                                                           */
/* ------------------------------------------------------------------ */

/** Nhịp của đường chạy: lúc hiện và cửa sổ của từng biển, tổng thời gian. */
export function nhipDuong(soBien: number): { hien_ms: number; cua_so_ms: number }[] {
  const kq: { hien_ms: number; cua_so_ms: number }[] = [];
  let t = MO_DAU_MS;
  for (let i = 0; i < soBien; i++) {
    const chang = Math.min(CUA_SO_THEO_CHANG_MS.length - 1, Math.floor(i / BIEN_MOI_CHANG));
    const cuaSo = CUA_SO_THEO_CHANG_MS[chang]!;
    kq.push({ hien_ms: t, cua_so_ms: cuaSo });
    t += cuaSo + KHOANG_CACH_MS;
  }
  return kq;
}

export function tongThoiGianDuong(nhip: ReadonlyArray<{ hien_ms: number; cua_so_ms: number }>): number {
  const cuoi = nhip.at(-1);
  return cuoi ? cuoi.hien_ms + cuoi.cua_so_ms + KET_THUC_MS : MO_DAU_MS;
}

/**
 * Chuỗi biển của đường chạy: trộn theo rng, lặp lại khi nguồn ít hơn số biển, không để hai biển
 * giống nhau liền nhau (cần ít nhất 2 biển khác nhau).
 */
export function sinhChuoiBien<T extends { ma: string }>(
  nguon: readonly T[],
  soBien: number,
  rng: () => number,
): T[] {
  const xep = [...nguon].sort((a, b) => a.ma.localeCompare(b.ma));
  if (!xep.length) return [];
  const kq: T[] = [];
  let tui: T[] = [];
  while (kq.length < soBien) {
    if (!tui.length) tui = tron(xep, rng);
    const truoc = kq.at(-1)?.ma;
    const i = tui.findIndex((b) => b.ma !== truoc);
    if (i < 0) {
      // Túi chỉ còn đúng biển vừa dùng: bỏ lại cuối, lấy túi mới.
      if (xep.length < 2) break;
      tui = tron(xep, rng);
      continue;
    }
    kq.push(tui.splice(i, 1)[0]!);
  }
  return kq;
}

function sangBienBaoGame(b: BienPhanUng): BienBaoGame {
  return { ma: b.ma, nhom: b.nhom, ten: b.ten, y_nghia: b.y_nghia, anh: b.anh, can_cu: b.can_cu };
}

/* ------------------------------------------------------------------ */
/* Chấm                                                                */
/* ------------------------------------------------------------------ */

/** Thưởng nhanh của một biển: tới THUONG_BIEN_TOI_DA, giảm tuyến tính theo thời gian phản ứng. */
export function thuongBien(msPhanUng: number, cuaSoMs: number): number {
  if (cuaSoMs <= 0) return 0;
  const conLai = Math.max(0, 1 - Math.max(0, msPhanUng) / cuaSoMs);
  return Math.round(THUONG_BIEN_TOI_DA * conLai * 10) / 10;
}

/**
 * Kết quả một biển từ thao tác đầu tiên trong cửa sổ (null: không bấm). Dùng chung cho máy chủ và
 * điện thoại (phản hồi ngay khi chơi).
 */
export function ketQuaMotBien(
  b: Pick<BienTrenDuong, "phan_ung" | "hien_ms" | "cua_so_ms">,
  chon: { thao_tac: ThaoTacBienBao; ms: number } | null,
): { ket: Exclude<KetBien, "khong_tinh">; diem: number; thuong: number; mat_mang: boolean } {
  if (chon && chon.thao_tac === b.phan_ung) {
    return {
      ket: "dung",
      diem: DIEM_MOI_BIEN,
      thuong: thuongBien(chon.ms - b.hien_ms, b.cua_so_ms),
      mat_mang: false,
    };
  }
  if (b.phan_ung === "di_tiep") {
    if (!chon) return { ket: "bo_qua", diem: 0, thuong: 0, mat_mang: false };
    if (chon.thao_tac === "giam_toc" || chon.thao_tac === "dung_lai")
      return { ket: "than_trong", diem: 0, thuong: 0, mat_mang: false };
    return { ket: "sai", diem: 0, thuong: 0, mat_mang: true };
  }
  return chon
    ? { ket: "sai", diem: 0, thuong: 0, mat_mang: true }
    : { ket: "bo_lo", diem: 0, thuong: 0, mat_mang: true };
}

/** Thao tác đầu tiên trong cửa sổ của biển; mốc trước khi biển hiện được đếm để báo "bị loại". */
function thaoTacTrongCuaSo(b: BienTrenDuong, suKien: readonly SuKienDuong[]) {
  let loai = 0;
  let dau: SuKienDuong | null = null;
  for (const s of suKien) {
    if (s.bien !== b.thu_tu) continue;
    if (s.ms < b.hien_ms) {
      loai++;
      continue;
    }
    if (s.ms > b.hien_ms + b.cua_so_ms) continue;
    if (!dau || s.ms < dau.ms) dau = s;
  }
  return { dau, loai };
}

/**
 * Chấm nhật ký đường chạy. `thoiGianMs` là thời gian máy chủ đo từ lúc mở bước tới lúc nhận nhật ký
 * (null khi offline hoặc không biết: bỏ qua kiểm lệch giờ).
 */
export function chamNhatKy(
  duong: { bien: BienTrenDuong[]; tong_ms: number },
  tl: { su_kien: readonly SuKienDuong[]; tong_ms: number },
  thoiGianMs: number | null,
): { diem: number; thuong: number; chiTiet: ChiTietDuong } {
  const khongTinh = (b: BienTrenDuong): KetQuaBien => ({
    thu_tu: b.thu_tu,
    ma: b.ma,
    ten: b.ten,
    anh: b.anh,
    phan_ung: b.phan_ung,
    chon: null,
    ket: "khong_tinh",
    diem: 0,
    thuong: 0,
    mat_mang: false,
    ghi_chu: b.ghi_chu,
  });

  let lyDo: string | null = null;
  if (tl.tong_ms > duong.tong_ms + DUNG_SAI_BUOC_MS) lyDo = "Nhật ký dài hơn cả đường chạy.";
  else if (tl.su_kien.some((s) => s.ms > tl.tong_ms)) lyDo = "Nhật ký có mốc sau lúc kết thúc.";
  else if (thoiGianMs !== null && tl.tong_ms > thoiGianMs * (1 + LECH_GIO_TOI_DA) + DUNG_SAI_BUOC_MS)
    lyDo = "Nhật ký không khớp đồng hồ máy chủ.";
  if (lyDo) {
    return {
      diem: 0,
      thuong: 0,
      chiTiet: {
        loai: "duong",
        hop_le: false,
        ly_do: lyDo,
        mang_con: SO_MANG,
        moc_bi_loai: 0,
        bien: duong.bien.map(khongTinh),
      },
    };
  }

  let mang = SO_MANG;
  let mocBiLoai = 0;
  const bien: KetQuaBien[] = [];
  for (const b of duong.bien) {
    const { dau, loai } = thaoTacTrongCuaSo(b, tl.su_kien);
    mocBiLoai += loai;
    // Hết mạng, hoặc đường chạy đã dừng trước khi hết cửa sổ biển này (không bấm gì): không tính.
    if (mang <= 0 || (!dau && tl.tong_ms < b.hien_ms + b.cua_so_ms)) {
      bien.push(khongTinh(b));
      continue;
    }
    const kq = ketQuaMotBien(b, dau ? { thao_tac: dau.thao_tac, ms: dau.ms } : null);
    if (kq.mat_mang) mang--;
    bien.push({
      thu_tu: b.thu_tu,
      ma: b.ma,
      ten: b.ten,
      anh: b.anh,
      phan_ung: b.phan_ung,
      chon: dau?.thao_tac ?? null,
      ...kq,
      ghi_chu: b.ghi_chu,
    });
  }
  const diem = bien.reduce((s, k) => s + k.diem, 0);
  const thuong = Math.round(bien.reduce((s, k) => s + k.thuong, 0) * 10) / 10;
  return {
    diem,
    thuong,
    chiTiet: { loai: "duong", hop_le: true, ly_do: null, mang_con: mang, moc_bi_loai: mocBiLoai, bien },
  };
}

/* ------------------------------------------------------------------ */
/* Định nghĩa trò                                                      */
/* ------------------------------------------------------------------ */

export const TRO_CHOI_CUNG_DUONG: DinhNghiaTroChoi<BuocCungDuong, DeCungDuong, TraLoiCungDuong> = {
  ma: MA_CUNG_DUONG,
  ten: "Cung đường biển báo",
  moTa: "Khởi động 3 câu đoán biển, rồi lái xe qua 12 biển: phản ứng đúng với từng biển trong vài giây, có 3 mạng.",
  offline: true,
  nguon: "bien_bao_phan_ung",
  // 3 câu khởi động cần ít nhất 4 biển (4 phương án); đường chạy dùng lại biển khi nguồn ít.
  soBuoc: SO_CAU_KHOI_DONG + 1,
  thoiGian: { caLuotMs: 10 * 60_000 },
  thuongNhanh: false,
  xpCoBan: 20,

  locNguon(nguon) {
    return (nguon as BienPhanUng[]).filter(
      (b) => laThaoTacBienBao(b.phan_ung) && b.ma && b.anh && b.ten && b.nhom !== "phu",
    );
  },

  taoLuot(nguon, rng) {
    const ds = [...(this.locNguon(nguon) as BienPhanUng[])].sort((a, b) => a.ma.localeCompare(b.ma));
    if (ds.length < SO_CAU_KHOI_DONG + 1) return [];
    const theoMa = new Map(ds.map((b) => [b.ma, b]));

    const van = taoVanDoan(ds.map(sangBienBaoGame), `cung-duong:${rng()}`, SO_CAU_KHOI_DONG);
    const khoiDong: BuocLuot<BuocCungDuong>[] = van.map((c, i) => {
      const b = theoMa.get(c.ma)!;
      return {
        thu_tu: i + 1,
        ref_kind: "traffic_sign",
        ref_id: b.ma,
        ref_version: b.version,
        topic_id: b.topic_id,
        diem_toi_da: DIEM_CAU_KHOI_DONG,
        noi_dung: {
          loai: "doan",
          ma: b.ma,
          anh: b.anh,
          ten: b.ten,
          y_nghia: b.y_nghia,
          can_cu: b.can_cu,
          phuong_an: c.phuong_an.map((ma) => ({ ma, ten: theoMa.get(ma)!.ten })),
        },
      };
    });

    const nhip = nhipDuong(SO_BIEN_DUONG);
    const chuoi = sinhChuoiBien(ds, SO_BIEN_DUONG, rng);
    const bien: BienTrenDuong[] = chuoi.map((b, i) => ({
      thu_tu: i + 1,
      ma: b.ma,
      ten: b.ten,
      anh: b.anh,
      phan_ung: b.phan_ung,
      ghi_chu: b.ghi_chu_phan_ung,
      can_cu: b.can_cu,
      ...nhip[i]!,
    }));
    const duong: BuocLuot<BuocCungDuong> = {
      thu_tu: khoiDong.length + 1,
      // Đường chạy do máy chủ sinh từ nhiều biển; tham chiếu từng biển nằm trong nội dung bước.
      ref_kind: "sinh",
      ref_id: null,
      ref_version: null,
      topic_id: null,
      diem_toi_da: bien.length * DIEM_MOI_BIEN,
      noi_dung: { loai: "duong", bien, tong_ms: tongThoiGianDuong(nhip.slice(0, bien.length)) },
    };
    return [...khoiDong, duong];
  },

  deChoNguoiChoi(buoc) {
    const n = buoc.noi_dung;
    if (n.loai === "doan") {
      return {
        loai: "doan",
        anh: n.anh,
        phuong_an: n.phuong_an.map((p, i) => ({ id: String(i), text: p.ten })),
      };
    }
    return {
      loai: "duong",
      so_mang: SO_MANG,
      tong_ms: n.tong_ms,
      bien: n.bien.map((b) => ({
        thu_tu: b.thu_tu,
        anh: b.anh,
        phan_ung: b.phan_ung,
        hien_ms: b.hien_ms,
        cua_so_ms: b.cua_so_ms,
      })),
    };
  },

  docTraLoi(raw) {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    if (r.loai === "doan") {
      if (r.chon !== null && (typeof r.chon !== "string" || r.chon.length > 10)) return null;
      return { loai: "doan", chon: r.chon as string | null };
    }
    if (r.loai !== "duong") return null;
    const tong = r.tong_ms;
    if (typeof tong !== "number" || !Number.isFinite(tong) || tong < 0 || tong > 3_600_000) return null;
    if (!Array.isArray(r.su_kien) || r.su_kien.length > SU_KIEN_TOI_DA) return null;
    const suKien: SuKienDuong[] = [];
    for (const s of r.su_kien as unknown[]) {
      if (!s || typeof s !== "object") return null;
      const { bien, thao_tac, ms } = s as Record<string, unknown>;
      if (!Number.isInteger(bien) || (bien as number) < 1 || (bien as number) > 100) return null;
      if (!laThaoTacBienBao(thao_tac)) return null;
      if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return null;
      suKien.push({ bien: bien as number, thao_tac, ms });
    }
    return { loai: "duong", su_kien: suKien, tong_ms: tong };
  },

  chamBuoc(buoc, traLoi, ngCanh): KetQuaChamBuoc {
    const n = buoc.noi_dung;
    if (n.loai === "doan") {
      const chon = traLoi.loai === "doan" ? traLoi.chon : null;
      const dung =
        chon !== null &&
        chamCauDoan({ stt: 0, ma: n.ma, anh: n.anh, phuong_an: n.phuong_an.map((p) => p.ma) }, chon);
      return {
        diem: dung ? buoc.diem_toi_da : 0,
        diemToiDa: buoc.diem_toi_da,
        dung,
        chiTiet: {
          loai: "doan",
          dung,
          dap_an: String(n.phuong_an.findIndex((p) => p.ma === n.ma)),
          ten: n.ten,
        },
        giaiThich: `Biển ${n.ma} "${n.ten}": ${n.y_nghia}`,
        canCu: [n.can_cu],
      };
    }
    const tl = traLoi.loai === "duong" ? traLoi : { su_kien: [], tong_ms: 0 };
    const kq = chamNhatKy(n, tl, ngCanh?.thoiGianMs ?? null);
    const soDung = kq.chiTiet.bien.filter((b) => b.ket === "dung").length;
    const giaiThich = kq.chiTiet.hop_le
      ? `Phản ứng đúng ${soDung}/${n.bien.length} biển, còn ${kq.chiTiet.mang_con}/${SO_MANG} mạng.`
      : `Không chấm được đường chạy: ${kq.chiTiet.ly_do}`;
    return {
      diem: kq.diem,
      diemToiDa: buoc.diem_toi_da,
      dung: kq.chiTiet.hop_le && kq.diem >= buoc.diem_toi_da,
      chiTiet: kq.chiTiet,
      giaiThich,
      canCu: [...new Set(n.bien.map((b) => b.can_cu))],
      thuong: kq.thuong,
    };
  },
};
