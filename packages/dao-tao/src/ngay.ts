/**
 * Tiện ích lịch: ngày theo giờ Việt Nam, cộng/trừ ngày, ngày đầu tuần và kỳ (tuần, tháng).
 *
 * Thuần luật để dùng chung cho lịch nhắc, lịch ôn và báo cáo theo kỳ.
 */

const NGAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Ngày theo giờ Việt Nam (UTC+7), dạng "YYYY-MM-DD". */
export function ngayVietNam(d: Date = new Date()): string {
  return new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

/** Kiểm chuỗi có đúng dạng ngày "YYYY-MM-DD" và là ngày có thật. */
export function laNgay(s: unknown): s is string {
  if (typeof s !== "string" || !NGAY_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const ngayThanhSo = (ngay: string) => Math.round(Date.parse(`${ngay}T00:00:00Z`) / 86_400_000);

/** Số ngày từ `tu` tới `den` (âm nếu `den` trước `tu`). */
export function cachNgay(tu: string, den: string): number {
  return ngayThanhSo(den) - ngayThanhSo(tu);
}

/** Cộng (hoặc trừ) số ngày, trả về "YYYY-MM-DD". */
export function congNgayLich(ngay: string, soNgay: number): string {
  const d = new Date(`${ngay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + soNgay);
  return d.toISOString().slice(0, 10);
}

/** "2026-09-15" → "15/09/2026". */
export function ngayVn(ngay: string): string {
  const [y, m, d] = ngay.split("-");
  return `${d}/${m}/${y}`;
}

/** Thứ hai của tuần có `ngay` (ngày luôn dạng "YYYY-MM-DD"). */
export function thuHaiCuaTuan(ngay: string): string {
  const thu = new Date(`${ngay}T00:00:00Z`).getUTCDay(); // 0 = Chủ nhật
  return congNgayLich(ngay, -((thu + 6) % 7));
}

/** Ngày đầu kỳ: thứ hai cho tuần, ngày 1 cho tháng. */
export function dauKy(ky: "tuan" | "thang", now: Date = new Date()): string {
  const homNay = ngayVietNam(now);
  return ky === "tuan" ? thuHaiCuaTuan(homNay) : `${homNay.slice(0, 8)}01`;
}
