/**
 * Nhật ký thao tác và chấm lại (mô-đun M7, docs/GAME_DESIGN.md §2.3, §1.2).
 *
 * Trò mô phỏng gửi nhật ký thao tác thay cho đáp án. Mỗi thao tác ghi theo SỐ NHỊP (NHIP_MS = 50 ms)
 * tính từ lúc mở bước, không theo mili giây: `{ nhip, thao_tac, tham_so }`. Mili giây thật chỉ dùng
 * để kiểm gian lận, bằng đồng hồ của máy chủ.
 *
 * Luật chung (giống Cung đường biển báo):
 *  - Nhật ký quá SO_THAO_TAC_TOI_DA thao tác, hoặc sai dạng: từ chối (trả null, API báo 400).
 *  - Mốc trước lúc mở đề (nhịp âm), mốc sau lúc kết thúc, thao tác không theo thứ tự thời gian, hoặc
 *    tổng thời gian dài hơn thời gian máy chủ đo quá 10% (cộng dung sai 2 giây): cả bước 0 điểm,
 *    không cho gửi lại (`kiemMocThoiGian` trả lý do).
 *  - Máy chủ chạy lại từ nhật ký, bỏ qua mọi kết quả máy khách gửi (`chayLaiRoiCham`).
 *
 * Hàm thuần; bộ ghi phía máy khách nhận đồng hồ làm tham số.
 */
import { NHIP_MS } from "../../mo-phong/mo-phong.ts";
import { DUNG_SAI_BUOC_MS } from "../khung.ts";

export { NHIP_MS };

export const SO_THAO_TAC_TOI_DA = 2_000;
/** Nhật ký dài hơn thời gian máy chủ đo quá tỷ lệ này (cộng dung sai mạng) thì không hợp lệ. */
export const LECH_GIO_TOI_DA = 0.1;
/** Trần độ dài nhật ký khi đọc (1 giờ), chặn số quá lớn; từng trò đặt trần chặt hơn. */
export const TONG_NHIP_TRAN = (60 * 60_000) / NHIP_MS;

export interface ThaoTacNhatKy<T extends string = string, P = unknown> {
  nhip: number;
  thao_tac: T;
  tham_so: P;
}

export interface NhatKy<T extends string = string, P = unknown> {
  thao_tac: ThaoTacNhatKy<T, P>[];
  /** Nhịp lúc kết thúc (lúc nộp). */
  tong_nhip: number;
}

/**
 * Đọc nhật ký gửi lên. `docMot` kiểm và chuẩn hóa một thao tác (sai dạng trả null). Trả null khi
 * nhật ký sai dạng hoặc quá dài; mốc thời gian thì chưa kiểm ở đây (xem `kiemMocThoiGian`).
 */
export function docNhatKy<T extends string, P>(
  raw: unknown,
  docMot: (thaoTac: unknown, thamSo: unknown) => { thao_tac: T; tham_so: P } | null,
  opts: { tongNhipToiDa?: number } = {},
): NhatKy<T, P> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const tran = opts.tongNhipToiDa ?? TONG_NHIP_TRAN;
  const tong = r.tong_nhip;
  if (!Number.isInteger(tong) || (tong as number) < 0 || (tong as number) > tran) return null;
  if (!Array.isArray(r.thao_tac) || r.thao_tac.length > SO_THAO_TAC_TOI_DA) return null;
  const ds: ThaoTacNhatKy<T, P>[] = [];
  for (const t of r.thao_tac as unknown[]) {
    if (!t || typeof t !== "object") return null;
    const { nhip, thao_tac, tham_so } = t as Record<string, unknown>;
    // Nhịp âm vẫn đọc được để `kiemMocThoiGian` chấm 0 (mốc trước lúc mở đề), không từ chối.
    if (!Number.isInteger(nhip) || Math.abs(nhip as number) > tran) return null;
    const mot = docMot(thao_tac, tham_so);
    if (!mot) return null;
    ds.push({ nhip: nhip as number, thao_tac: mot.thao_tac, tham_so: mot.tham_so });
  }
  return { thao_tac: ds, tong_nhip: tong as number };
}

/**
 * Kiểm mốc thời gian của nhật ký. `thoiGianMs` là thời gian máy chủ đo từ lúc mở bước tới lúc nhận
 * nhật ký (null khi offline hoặc không biết: bỏ qua phần so đồng hồ). Trả lý do không hợp lệ, hoặc
 * null khi hợp lệ.
 */
export function kiemMocThoiGian(nk: NhatKy, thoiGianMs: number | null): string | null {
  let truoc = 0;
  for (const t of nk.thao_tac) {
    if (t.nhip < 0) return "Nhật ký có mốc trước lúc mở đề.";
    if (t.nhip > nk.tong_nhip) return "Nhật ký có mốc sau lúc kết thúc.";
    if (t.nhip < truoc) return "Nhật ký không theo thứ tự thời gian.";
    truoc = t.nhip;
  }
  if (thoiGianMs !== null && nk.tong_nhip * NHIP_MS > thoiGianMs * (1 + LECH_GIO_TOI_DA) + DUNG_SAI_BUOC_MS)
    return "Nhật ký không khớp đồng hồ máy chủ.";
  return null;
}

export type KetQuaChayLai<KQ> = { hop_le: true; ket_qua: KQ } | { hop_le: false; ly_do: string };

/**
 * Kiểm mốc thời gian rồi chạy lại nhật ký. `chayLai` là phần riêng của trò (dựng lại trạng thái từ
 * nhật ký, chạy mô phỏng, chấm); ném `LoiNhatKy` khi gặp thao tác không hợp lệ với trạng thái.
 */
export function chayLaiRoiCham<T extends string, P, KQ>(
  nk: NhatKy<T, P>,
  thoiGianMs: number | null,
  chayLai: (nk: NhatKy<T, P>) => KQ,
): KetQuaChayLai<KQ> {
  const lyDo = kiemMocThoiGian(nk, thoiGianMs);
  if (lyDo) return { hop_le: false, ly_do: lyDo };
  try {
    return { hop_le: true, ket_qua: chayLai(nk) };
  } catch (e) {
    if (e instanceof LoiNhatKy) return { hop_le: false, ly_do: e.message };
    throw e;
  }
}

/** Thao tác không hợp lệ với trạng thái lúc chạy lại (ví dụ gỡ biển chưa đặt). */
export class LoiNhatKy extends Error {}

/* ------------------------------------------------------------------ */
/* Bộ ghi phía máy khách                                               */
/* ------------------------------------------------------------------ */

/**
 * Ghi thao tác theo nhịp. `dongHo` trả mili giây đơn điệu (performance.now ở trình duyệt); thời gian
 * tạm dừng (tab ẩn) không tính.
 */
export class BoGhiNhatKy<T extends string, P> {
  private goc = 0;
  private dungLuc: number | null = null;
  private tamDungMs = 0;
  private readonly ds: ThaoTacNhatKy<T, P>[] = [];

  constructor(private readonly dongHo: () => number) {
    this.goc = dongHo();
  }

  /** Nhịp hiện tại. */
  nhip(): number {
    const bay = this.dungLuc ?? this.dongHo();
    return Math.max(0, Math.floor((bay - this.goc - this.tamDungMs) / NHIP_MS));
  }

  ghi(thaoTac: T, thamSo: P): ThaoTacNhatKy<T, P> | null {
    if (this.ds.length >= SO_THAO_TAC_TOI_DA) return null;
    const t = { nhip: this.nhip(), thao_tac: thaoTac, tham_so: thamSo };
    this.ds.push(t);
    return t;
  }

  tamDung() {
    if (this.dungLuc === null) this.dungLuc = this.dongHo();
  }

  tiepTuc() {
    if (this.dungLuc === null) return;
    this.tamDungMs += this.dongHo() - this.dungLuc;
    this.dungLuc = null;
  }

  get soThaoTac() {
    return this.ds.length;
  }

  ketThuc(): NhatKy<T, P> {
    return { thao_tac: [...this.ds], tong_nhip: this.nhip() };
  }
}

/* ------------------------------------------------------------------ */
/* Băm trạng thái                                                      */
/* ------------------------------------------------------------------ */

/** Chuỗi JSON với khóa đối tượng sắp theo thứ tự, để cùng dữ liệu luôn ra cùng chuỗi. */
export function chuoiOnDinh(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(chuoiOnDinh).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${chuoiOnDinh(o[k])}`)
    .join(",")}}`;
}

/** Băm FNV-1a 32 bit của trạng thái, 8 chữ số hex. Dùng để test máy chủ và máy khách ra cùng kết quả. */
export function bamTrangThai(v: unknown): string {
  const s = chuoiOnDinh(v);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
