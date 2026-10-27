/** Nhãn tiếng Việt và tiện ích định dạng dùng chung. */
import type { DocStatus, NodeKind, NodeStatus, RelationType, VersionKind } from "./types";

export const DOC_STATUS_LABEL: Record<DocStatus, string> = {
  chua_hieu_luc: "Chưa có hiệu lực",
  con_hieu_luc: "Còn hiệu lực",
  het_hieu_luc_mot_phan: "Hết hiệu lực một phần",
  het_hieu_luc: "Hết hiệu lực",
  ngung_hieu_luc: "Ngưng hiệu lực",
  khong_xac_dinh: "Không xác định",
};

/**
 * Sắc thái hiển thị của trạng thái. Màu cụ thể của từng sắc thái do token `--tone-*` trong
 * styles/app.css quyết định (đã đo tương phản ≥ 4.5:1 ở cả nền sáng và nền tối).
 */
export type Tone = "ok" | "warn" | "danger" | "info" | "muted";

export const DOC_STATUS_TONE: Record<DocStatus, Tone> = {
  chua_hieu_luc: "info",
  con_hieu_luc: "ok",
  het_hieu_luc_mot_phan: "warn",
  het_hieu_luc: "danger",
  ngung_hieu_luc: "warn",
  khong_xac_dinh: "muted",
};

export const NODE_STATUS_LABEL: Record<NodeStatus, string> = {
  active: "Đang áp dụng",
  amended: "Đã được sửa đổi",
  repealed: "Đã bị bãi bỏ",
  suspended: "Đang ngưng hiệu lực",
  added: "Được bổ sung",
};

export const NODE_STATUS_TONE: Record<NodeStatus, Tone> = {
  active: "muted",
  amended: "warn",
  repealed: "danger",
  suspended: "warn",
  added: "info",
};

export const NODE_KIND_LABEL: Record<NodeKind, string> = {
  van_ban: "Văn bản",
  loi_noi_dau: "Lời nói đầu",
  can_cu: "Căn cứ ban hành",
  phan: "Phần",
  chuong: "Chương",
  muc: "Mục",
  tieu_muc: "Tiểu mục",
  dieu: "Điều",
  khoan: "Khoản",
  diem: "Điểm",
  doan: "Đoạn",
  bang: "Bảng",
  cong_thuc: "Công thức",
  hinh: "Hình",
  phu_luc: "Phụ lục",
  chu_ky: "Ký ban hành",
};

export const VERSION_KIND_LABEL: Record<VersionKind, string> = {
  original: "Bản gốc",
  corrigendum: "Bản đính chính",
  consolidated_official: "Văn bản hợp nhất chính thức",
  consolidated_auto: "Hợp nhất tự động (tham khảo)",
  reissue: "Ban hành lại",
};

export const RELATION_LABEL: Record<RelationType, string> = {
  can_cu: "Căn cứ ban hành",
  la_can_cu_cua: "Là căn cứ của",
  huong_dan: "Hướng dẫn, quy định chi tiết",
  duoc_huong_dan_boi: "Được hướng dẫn bởi",
  sua_doi: "Sửa đổi, bổ sung",
  bi_sua_doi_boi: "Bị sửa đổi, bổ sung bởi",
  bai_bo: "Bãi bỏ",
  bi_bai_bo_boi: "Bị bãi bỏ bởi",
  thay_the: "Thay thế",
  bi_thay_the_boi: "Bị thay thế bởi",
  dinh_chinh: "Đính chính",
  hop_nhat: "Hợp nhất",
  dinh_chi: "Đình chỉ, ngưng hiệu lực",
  cong_bo_het_hieu_luc: "Công bố hết hiệu lực",
  dan_chieu: "Dẫn chiếu tới",
  duoc_dan_chieu_boi: "Được dẫn chiếu bởi",
  ap_dung_chuyen_tiep: "Áp dụng chuyển tiếp",
  cha: "Văn bản cha",
  con: "Văn bản con",
};

export const DOC_TYPE_LABEL: Record<string, string> = {
  "vb-dang": "Văn bản của Đảng",
  hp: "Hiến pháp",
  bl: "Bộ luật",
  l: "Luật",
  "nq-qh": "Nghị quyết Quốc hội",
  pl: "Pháp lệnh",
  "nq-ubtvqh": "Nghị quyết UBTVQH",
  nqlt: "Nghị quyết liên tịch",
  lenh: "Lệnh",
  "qd-ctn": "Quyết định Chủ tịch nước",
  nd: "Nghị định",
  "nq-cp": "Nghị quyết Chính phủ",
  "nqlt-cp": "Nghị quyết liên tịch Chính phủ",
  "qd-ttg": "Quyết định Thủ tướng",
  "nq-hdtp": "Nghị quyết Hội đồng Thẩm phán",
  tt: "Thông tư",
  ttlt: "Thông tư liên tịch",
  "nq-hdnd-t": "Nghị quyết HĐND cấp tỉnh",
  "qd-ubnd-t": "Quyết định UBND cấp tỉnh",
  "qd-ctubnd-t": "Quyết định Chủ tịch UBND cấp tỉnh",
  "nq-hdnd-x": "Nghị quyết HĐND cấp xã",
  "qd-ubnd-x": "Quyết định UBND cấp xã",
  dbkt: "VBQPPL đơn vị hành chính - kinh tế đặc biệt",
  vbhn: "Văn bản hợp nhất",
  cv: "Công văn",
};

export function docTypeLabel(docType: string): string {
  return DOC_TYPE_LABEL[docType] ?? docType.toUpperCase();
}

/** Chuyển "2026-01-26" thành "26/01/2026". Trả về chuỗi gốc nếu không parse được. */
export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Ngày hôm nay dạng YYYY-MM-DD theo giờ Việt Nam. Máy chủ chạy UTC, nên nếu lấy theo múi giờ
 * máy thì từ 0h đến 7h sáng "hôm nay" sẽ bị hiểu là hôm qua.
 */
export function todayIso(): string {
  // Định dạng en-CA cho sẵn YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** "25/09/2026 17:00" theo giờ Việt Nam, cho hạn làm bài và các mốc có giờ. */
export function formatNgayGio(value?: string | Date | null): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("day")}/${g("month")}/${g("year")} ${g("hour")}:${g("minute")}`;
}

/**
 * Ô `datetime-local` gửi giờ không kèm múi ("2026-09-25T17:00"); người dùng nhập theo giờ Việt
 * Nam nên gắn +07:00. Trả chuỗi ISO, hoặc null khi rỗng hay sai định dạng.
 */
export function gioVietNamSangIso(raw: string | null | undefined): string | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return null;
  return new Date(`${raw}:00+07:00`).toISOString();
}

/** Ngược lại: ISO -> giá trị cho ô `datetime-local`, theo giờ Việt Nam. */
export function isoSangGioVietNam(d: Date | string): string {
  const t = new Date(new Date(d).getTime() + 7 * 3600_000);
  return t.toISOString().slice(0, 16);
}

/** Kiểm tra ngày hợp lệ YYYY-MM-DD. */
export function isIsoDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number(value.slice(0, 4)) > 0 &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export function pluralVi(count: number, noun: string): string {
  return `${count.toLocaleString("vi-VN")} ${noun}`;
}

/**
 * Chữ cái cho ảnh đại diện: chữ đầu của TÊN (từ cuối họ tên kiểu Việt Nam), "Lê Quang Huy" → "H".
 * Chuỗi không có khoảng trắng (email, tên đăng nhập) thì lấy ký tự đầu.
 */
export function chuCaiDaiDien(hoTen: string): string {
  const ten = hoTen.includes("@") ? hoTen : (hoTen.trim().split(/\s+/).at(-1) ?? "");
  return ten.charAt(0).toLocaleUpperCase("vi-VN") || "?";
}
