/**
 * Dữ liệu cho thẻ văn bản ở trang /tim-kiem: danh sách kho (chưa nhập từ khóa) và kết quả tìm kiếm
 * gộp theo văn bản. API tìm kiếm trả từng điều, khoản; trang hiện mỗi văn bản một thẻ, kèm các
 * điều khoản khớp bên dưới.
 */
import { dieuHrefFromUrn, docHref, parseUrn, pathToCitationPhrase } from "./citation";
import type { DocStatus, DocumentListItem, SearchHit } from "./types";

/** Độ dài từ khóa tối đa, khớp giới hạn của API /v1/search; dài hơn thì trang báo, không gọi API. */
export const TU_KHOA_TOI_DA = 500;

/** Một điều, khoản khớp từ khóa trong văn bản. */
export interface DieuKhop {
  trangThai?: string;
  path: string;
  nhan: string;
  snippet: string;
  href: string;
}

export interface VanBanTraCuu {
  issuer?: string;
  primarySource?: string;
  documentGroup?: string;
  effectiveFrom?: string;
  coTepGoc?: boolean;
  asOf?: string;
  matchCount?: number;
  urn: string;
  docType: string;
  soKyHieu: string;
  tieuDe: string;
  /** YYYY-MM-DD; rỗng khi kho chưa ghi ngày ban hành. */
  ngayBanHanh: string;
  status: DocStatus;
  href: string;
  khop: DieuKhop[];
}

export function tuVanBan(d: DocumentListItem): VanBanTraCuu {
  return {
    issuer: d.issuer,
    primarySource: d.primarySource,
    documentGroup: d.documentGroup,
    effectiveFrom: d.effectiveFrom,
    coTepGoc: d.coTepGoc,
    urn: d.urn,
    docType: d.docType,
    soKyHieu: d.soKyHieu,
    tieuDe: d.title,
    ngayBanHanh: d.issuedDate,
    status: d.status,
    href: docHref(d.docType, d.soKyHieu),
    khop: [],
  };
}

/** "Khoản 2 Điều 15" cho khoản, điểm; "Điều 15. Phạm vi điều chỉnh" cho điều. */
function nhanDieuKhop(hit: SearchHit): string {
  const cum = hit.path.includes(".") ? pathToCitationPhrase(hit.path) : "";
  if (cum) return cum.charAt(0).toUpperCase() + cum.slice(1);
  return hit.heading ? `${hit.label.replace(/\.$/, "")}. ${hit.heading}` : hit.label;
}

/**
 * Gộp kết quả theo văn bản. Thứ tự văn bản theo kết quả khớp nhất của nó; điều khoản trong một văn
 * bản giữ thứ tự khớp. Kết quả cấp văn bản (không có path) chỉ tạo thẻ, không thêm điều khoản.
 */
export function gopTheoVanBan(hits: SearchHit[]): VanBanTraCuu[] {
  const theoUrn = new Map<string, VanBanTraCuu>();
  for (const hit of hits) {
    const urn = hit.urn.split("#")[0] ?? hit.urn;
    let vb = theoUrn.get(urn);
    if (!vb) {
      const p = parseUrn(urn);
      const docType = hit.docType ?? p?.docType ?? "";
      const soKyHieu = hit.soKyHieu ?? p?.soKyHieu ?? "";
      vb = {
        urn,
        docType,
        soKyHieu,
        tieuDe: hit.docFullTitle ?? hit.docTitle,
        ngayBanHanh: hit.issuedDate ?? "",
        status: hit.status,
        href: docHref(docType, soKyHieu),
        khop: [],
      };
      theoUrn.set(urn, vb);
    }
    if (!hit.path || vb.khop.some((k) => k.path === hit.path)) continue;
    vb.khop.push({
      path: hit.path,
      nhan: nhanDieuKhop(hit),
      snippet: hit.snippet,
      href: dieuHrefFromUrn(urn, hit.path),
    });
  }
  return [...theoUrn.values()];
}

export function tuKetQuaVanBan(d: import("./api").GroupedDocumentItem, asOf: string): VanBanTraCuu {
  const vb = tuVanBan(d);
  vb.asOf = asOf;
  vb.matchCount = d.matchCount;
  vb.khop = d.matches.map((m) => ({
    trangThai: m.nodeStatus,
    path: m.path,
    nhan: m.path.includes(".")
      ? pathToCitationPhrase(m.path)
      : m.heading
        ? `${m.label}. ${m.heading}`
        : m.label,
    snippet: m.snippet,
    href: dieuHrefFromUrn(d.urn, m.path),
  }));
  return vb;
}
