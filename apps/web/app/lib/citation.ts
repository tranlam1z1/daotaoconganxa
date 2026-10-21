/**
 * Chuẩn viện dẫn và định danh URN — bám ke-hoach/01-nen-tang-phap-ly.md §6
 * và ke-hoach/03-mo-hinh-du-lieu.md §1.
 */
import { docTypeLabel, formatDate } from "./format";
import type { DocumentMeta, VersionKind } from "./types";

const DIACRITIC_MAP: Array<[RegExp, string]> = [
  [/[àáạảãâầấậẩẫăằắặẳẵ]/g, "a"],
  [/[èéẹẻẽêềếệểễ]/g, "e"],
  [/[ìíịỉĩ]/g, "i"],
  [/[òóọỏõôồốộổỗơờớợởỡ]/g, "o"],
  [/[ùúụủũưừứựửữ]/g, "u"],
  [/[ỳýỵỷỹ]/g, "y"],
  [/đ/g, "d"],
];

/** Bỏ dấu tiếng Việt, dùng cho slug và so khớp tìm kiếm không dấu. */
export function removeDiacritics(input: string): string {
  let out = input.toLowerCase();
  for (const [re, rep] of DIACRITIC_MAP) out = out.replace(re, rep);
  return out;
}

/** "45/2026/NĐ-CP" -> "45-2026-nd-cp" (dùng làm đoạn URL). */
export function soKyHieuToSlug(soKyHieu: string): string {
  return removeDiacritics(soKyHieu)
    .replace(/[/\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Đường dẫn trang đọc của một văn bản. */
export function docHref(docType: string, soKyHieu: string): string {
  return `/van-ban/${docType}/${soKyHieuToSlug(soKyHieu)}`;
}

/** Đường dẫn trang đọc suy ra từ URN `vn:vbqppl:nd:45/2026/NĐ-CP`. */
export function docHrefFromUrn(urn: string): string {
  const parsed = parseUrn(urn);
  if (!parsed) return "/tim-kiem";
  return docHref(parsed.docType, parsed.soKyHieu) + (parsed.path ? `#${parsed.path}` : "");
}

/**
 * Đường dẫn mở thẳng một Điều ở chế độ đọc từng điều, cuộn tới đúng khoản/điểm.
 * `path` lấy từ tham số nếu có, không thì từ phần `#...` của URN. Không có Điều thì mở cả văn bản.
 */
export function dieuHrefFromUrn(urn: string, path?: string): string {
  const parsed = parseUrn(urn);
  if (!parsed) return "/tim-kiem";
  const base = docHref(parsed.docType, parsed.soKyHieu);
  const nodePath = path || parsed.path || "";
  if (laPathChuaXacDinh(nodePath)) return base;
  const dieu = nodePath.split(".")[0] ?? "";
  if (!dieu.startsWith("dieu-")) return base + (nodePath ? `#${nodePath}` : "");
  return `${base}?dieu=${encodeURIComponent(dieu)}#${nodePath}`;
}

/**
 * Dữ liệu biên tập chưa đối chiếu ghi tạm "dieu-chua-xac-dinh" khi chưa biết Điều nào
 * (data/tra-cuu/muc-phat.json). Path như vậy không trỏ tới nút nào, chỉ còn ý nghĩa ở mức văn bản.
 */
function laPathChuaXacDinh(path: string): boolean {
  return path.split(".").some((p) => p.endsWith("-chua-xac-dinh"));
}

export interface ParsedUrn {
  scheme: string;
  docType: string;
  soKyHieu: string;
  path?: string;
  asOf?: string;
}

/** Tách URN: vn:vbqppl:nd:45/2026/NĐ-CP#dieu-15.khoan-2@2026-03-01 */
export function parseUrn(urn: string): ParsedUrn | null {
  const m = /^vn:([a-z]+):([a-z0-9-]+):([^#@]+)(?:#([^@]+))?(?:@(\d{4}-\d{2}-\d{2}))?$/.exec(urn.trim());
  if (!m) return null;
  return {
    scheme: m[1] ?? "vbqppl",
    docType: m[2] ?? "",
    soKyHieu: m[3] ?? "",
    path: m[4],
    asOf: m[5],
  };
}

/** URN của một nút, kèm hậu tố @ngày khi có. */
export function nodeUrn(docUrn: string, path: string, asOf?: string): string {
  const base = docUrn.split("#")[0] ?? docUrn;
  const withPath = path ? `${base}#${path}` : base;
  return asOf ? `${withPath}@${asOf}` : withPath;
}

/**
 * Đọc path nút thành cụm tiếng Việt theo trật tự viện dẫn (điểm → khoản → Điều).
 * "dieu-15.khoan-2.diem-a" -> "điểm a khoản 2 Điều 15"
 */
export function pathToCitationPhrase(path: string): string {
  if (!path) return "";
  const seg: Record<string, string> = {};
  for (const part of path.split(".")) {
    const m = /^(phan|chuong|muc|tieu-muc|dieu|khoan|diem|phu-luc)-(.+)$/.exec(part);
    if (m?.[1] && m[2]) seg[m[1]] = m[2];
  }
  const out: string[] = [];
  if (seg.diem) out.push(`điểm ${seg.diem}`);
  if (seg.khoan) out.push(`khoản ${seg.khoan}`);
  if (seg.dieu) out.push(`Điều ${seg.dieu}`);
  if (!out.length) {
    if (seg["phu-luc"]) out.push(`Phụ lục ${seg["phu-luc"].toUpperCase()}`);
    else if (seg.muc) out.push(`Mục ${seg.muc}`);
    else if (seg.chuong) out.push(`Chương ${seg.chuong}`);
    else if (seg.phan) out.push(`Phần ${seg.phan}`);
  }
  return out.join(" ");
}

/** Bỏ phần tên loại văn bản ở đầu tiêu đề để ghép vào chuỗi viện dẫn đầy đủ. */
function titleTail(meta: DocumentMeta): string {
  const label = docTypeLabel(meta.docType);
  let tail = meta.title.trim();
  if (tail.toLowerCase().startsWith(label.toLowerCase())) {
    tail = tail.slice(label.length).trim();
  }
  tail = tail.replace(/^(số\s+\S+\s*)/i, "").replace(/^[-–—:,.\s]+/, "");
  return tail;
}

export interface CitationOptions {
  path?: string;
  asOf?: string;
  versionKind?: VersionKind;
  vbhnSoKyHieu?: string;
}

/**
 * Dạng đầy đủ:
 * "điểm a khoản 2 Điều 15 Nghị định số 45/2026/NĐ-CP ngày 26/01/2026 của Chính phủ quy định ..."
 */
export function formatCitationFull(meta: DocumentMeta, opts: CitationOptions = {}): string {
  const phrase = opts.path ? pathToCitationPhrase(opts.path) : "";
  const head = phrase ? `${phrase} ` : "";
  const tail = titleTail(meta);
  let s = `${head}${docTypeLabel(meta.docType)} số ${meta.soKyHieu} ngày ${formatDate(meta.issuedDate)} của ${meta.issuer}`;
  if (tail) s += ` ${tail}`;
  if (opts.versionKind === "consolidated_official" && opts.vbhnSoKyHieu) {
    s += ` (được hợp nhất tại Văn bản hợp nhất số ${opts.vbhnSoKyHieu})`;
  } else if (opts.versionKind === "consolidated_auto" && opts.asOf) {
    s += ` (bản hợp nhất tự động, hiệu lực tại ngày ${formatDate(opts.asOf)})`;
  }
  return s;
}

/** Dạng ngắn: "điểm a khoản 2 Điều 15 Nghị định 45/2026/NĐ-CP". */
export function formatCitationShort(meta: DocumentMeta, opts: CitationOptions = {}): string {
  const phrase = opts.path ? pathToCitationPhrase(opts.path) : "";
  const head = phrase ? `${phrase} ` : "";
  return `${head}${docTypeLabel(meta.docType)} ${meta.soKyHieu}`;
}

/** Dạng máy: URN có hậu tố thời điểm. */
export function formatCitationUrn(meta: DocumentMeta, opts: CitationOptions = {}): string {
  return nodeUrn(meta.urn, opts.path ?? "", opts.asOf);
}

/**
 * Đọc một URN thành nhãn viện dẫn tiếng Việt để HIỂN THỊ.
 *
 * QUY-TAC-HANH-VAN.md §6: nội dung hiển thị viết "Nghị định số 224/2026/NĐ-CP", không viết
 * URN kỹ thuật và không viết tắt "NĐ 224/2026". URN vẫn dùng làm khoá liên kết, chỉ không
 * dùng làm chữ cho người đọc.
 *
 * "vn:vbqppl:nd:224/2026/NĐ-CP#dieu-91.khoan-2"
 *   -> "khoản 2 Điều 91 Nghị định số 224/2026/NĐ-CP"
 */
export function nhanVienDan(urn: string): string {
  const p = parseUrn(urn);
  if (!p) return urn;
  const ten = `${docTypeLabel(p.docType)} số ${p.soKyHieu}`;
  const cum = p.path && !laPathChuaXacDinh(p.path) ? pathToCitationPhrase(p.path) : "";
  return cum ? `${cum} ${ten}` : ten;
}
