/**
 * Bộ chuyển đổi dữ liệu API -> kiểu dùng ở giao diện.
 *
 * `apps/api` do nhánh khác phát triển nên tên trường có thể lệch so với kiểu
 * trong `types.ts` (ví dụ `document` thay cho `meta`, `tree` thay cho `root`,
 * `docStatus` thay cho `status`). Mọi hàm ở đây nhận `unknown`, chấp nhận cả hai
 * cách đặt tên và ném lỗi khi dữ liệu không dùng được để `api.ts` rơi về dữ liệu mẫu.
 */
import { parseUrn } from "./citation";
import { RELATION_LABEL } from "./format";
import type {
  DocStatus,
  DocumentContent,
  DocumentDetail,
  DocumentListItem,
  DocumentListResponse,
  DocumentMeta,
  DocumentVersion,
  Footnote,
  LegalNode,
  RelationGroup,
  RelationItem,
  RelationType,
  SearchFacets,
  SearchHit,
  SearchResponse,
  StatusEvent,
  VersionKind,
} from "./types";

type Raw = Record<string, unknown>;

function asRecord(value: unknown): Raw | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : null;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

const DOC_STATUSES: DocStatus[] = [
  "chua_hieu_luc",
  "con_hieu_luc",
  "het_hieu_luc_mot_phan",
  "het_hieu_luc",
  "ngung_hieu_luc",
  "khong_xac_dinh",
];

function docStatus(value: unknown): DocStatus {
  return DOC_STATUSES.includes(value as DocStatus) ? (value as DocStatus) : "khong_xac_dinh";
}

const VERSION_KINDS: VersionKind[] = [
  "original",
  "corrigendum",
  "consolidated_official",
  "consolidated_auto",
  "reissue",
];

function versionKind(value: unknown): VersionKind {
  return VERSION_KINDS.includes(value as VersionKind) ? (value as VersionKind) : "original";
}

/* ------------------------------------------------------------------ */
/* Thuộc tính văn bản                                                  */
/* ------------------------------------------------------------------ */

/** Nhận `{meta}`, `{document}` hoặc chính đối tượng văn bản. */
export function toMeta(raw: unknown): DocumentMeta {
  const r = asRecord(raw);
  if (!r) throw new Error("Thiếu dữ liệu văn bản");
  const d = asRecord(r.meta) ?? asRecord(r.document) ?? r;
  const urn = str(d.urn);
  const soKyHieu = str(d.soKyHieu);
  if (!urn || !soKyHieu) throw new Error("Thiếu urn hoặc số ký hiệu");
  const rank = num(d.rank) ?? 999;
  return {
    urn,
    docType: str(d.docType) ?? parseUrn(urn)?.docType ?? "",
    rank,
    isNormative: typeof d.isNormative === "boolean" ? (d.isNormative as boolean) : rank < 999,
    soKyHieu,
    title: str(d.title) ?? soKyHieu,
    shortTitle: str(d.shortTitle) ?? str(d.title) ?? soKyHieu,
    issuer: str(d.issuer) ?? "Không rõ cơ quan ban hành",
    documentGroup: str(d.documentGroup),
    primarySource: str(d.primarySource),
    ...(str(d.signer) ? { signer: str(d.signer) as string } : {}),
    issuedDate: str(d.issuedDate) ?? "",
    ...(str(d.effectiveFrom) ? { effectiveFrom: str(d.effectiveFrom) as string } : {}),
    ...(str(d.effectiveTo) ? { effectiveTo: str(d.effectiveTo) as string } : {}),
    ...(str(d.gazetteNo) ? { gazetteNo: str(d.gazetteNo) as string } : {}),
    ...(str(d.gazetteDate) ? { gazetteDate: str(d.gazetteDate) as string } : {}),
    fields: strArray(d.fields),
    // statusAsOf là trạng thái tại ngày tra; `status` chỉ là ảnh chụp lưu sẵn, có thể lệch ngày.
    status: docStatus(d.statusAsOf ?? d.status ?? d.docStatus),
    ...(str(d.summary) ? { summary: str(d.summary) as string } : {}),
    ...(str(d.signedDate) ? { signedDate: str(d.signedDate) as string } : {}),
    ...(str(d.publishedDbDate) ? { publishedDbDate: str(d.publishedDbDate) as string } : {}),
    ...(strArray(d.keywords).length ? { keywords: strArray(d.keywords) } : {}),
    ...(str(d.locality) ? { scopeArea: str(d.locality) as string } : {}),
    ...(str(d.sourceFile) ? { sourceFile: str(d.sourceFile) as string } : {}),
    ...(num(d.ocrQuality) !== undefined ? { ocrQuality: num(d.ocrQuality) as number } : {}),
    ...(str(d.crawledAt) ? { crawledAt: str(d.crawledAt) as string } : {}),
    ...(str(d.reviewedBy) ? { reviewedBy: str(d.reviewedBy) as string } : {}),
    ...(str(d.reviewedAt) ? { reviewedAt: str(d.reviewedAt) as string } : {}),
  };
}

export function toVersions(raw: unknown): DocumentVersion[] {
  const list = Array.isArray(raw) ? raw : (asRecord(raw)?.versions as unknown);
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => asRecord(item))
    .filter((item): item is Raw => item !== null)
    .map((item) => {
      const causedBy = Array.isArray(item.causedBy) ? (item.causedBy as unknown[]) : [];
      const firstCause = asRecord(causedBy[0]);
      return {
        versionNo: num(item.versionNo) ?? 1,
        kind: versionKind(item.kind),
        validFrom: str(item.validFrom) ?? "",
        ...(str(item.validTo) ? { validTo: str(item.validTo) as string } : {}),
        ...((str(item.reason) ?? str(firstCause?.shortTitle) ?? str(item.kindLabel))
          ? {
              reason: (str(item.reason) ?? str(firstCause?.shortTitle) ?? str(item.kindLabel)) as string,
            }
          : {}),
        ...(str(firstCause?.urn) ? { reasonUrn: str(firstCause?.urn) as string } : {}),
        ...(str(item.contentHash) ? { contentHash: str(item.contentHash) as string } : {}),
      };
    });
}

/** Suy ra dòng thời gian trạng thái khi API chưa trả sẵn. */
function deriveTimeline(meta: DocumentMeta): StatusEvent[] {
  const events: StatusEvent[] = [];
  if (meta.issuedDate) events.push({ date: meta.issuedDate, status: "chua_hieu_luc", note: "Ban hành" });
  if (meta.effectiveFrom)
    events.push({ date: meta.effectiveFrom, status: "con_hieu_luc", note: "Có hiệu lực thi hành" });
  if (meta.effectiveTo) events.push({ date: meta.effectiveTo, status: "het_hieu_luc", note: "Hết hiệu lực" });
  if (meta.status === "het_hieu_luc_mot_phan" && meta.effectiveFrom) {
    events.push({
      date: meta.effectiveFrom,
      status: "het_hieu_luc_mot_phan",
      note: "Bị sửa đổi, bổ sung một phần",
    });
  }
  return events;
}

export function toDetail(raw: unknown): DocumentDetail {
  const r = asRecord(raw);
  if (!r) throw new Error("Thiếu dữ liệu văn bản");
  const meta = toMeta(r);
  const versions = toVersions(r);
  const timelineRaw = Array.isArray(r.timeline) ? (r.timeline as unknown[]) : null;
  const timeline: StatusEvent[] = timelineRaw
    ? timelineRaw
        .map((item) => asRecord(item))
        .filter((item): item is Raw => item !== null)
        .map((item) => ({
          date: str(item.date) ?? "",
          status: docStatus(item.status),
          note: str(item.note) ?? "",
          ...(str(item.sourceUrn) ? { sourceUrn: str(item.sourceUrn) as string } : {}),
        }))
    : meta.documentGroup === "dang"
      ? []
      : deriveTimeline(meta);
  return {
    meta,
    versions,
    status: docStatus(r.status ?? meta.status),
    timeline,
    coTepGoc: r.coTepGoc === true,
    soTrangTepGoc: Number(r.soTrangTepGoc) || 0,
  };
}

/* ------------------------------------------------------------------ */
/* Nội dung toàn văn                                                   */
/* ------------------------------------------------------------------ */

function isLegalNode(value: unknown): value is LegalNode {
  const r = asRecord(value);
  return !!r && typeof r.kind === "string" && Array.isArray(r.children);
}

export function toContent(raw: unknown): DocumentContent {
  const r = asRecord(raw);
  if (!r) throw new Error("Thiếu nội dung văn bản");
  const root = r.root ?? r.tree;
  if (!isLegalNode(root)) throw new Error("Cây cấu trúc không hợp lệ");
  const footnotesRaw = Array.isArray(r.footnotes) ? (r.footnotes as unknown[]) : [];
  const footnotes: Footnote[] = footnotesRaw
    .map((item) => asRecord(item))
    .filter((item): item is Raw => item !== null)
    .map((item, index) => ({
      id: str(item.id) ?? String(index + 1),
      path: str(item.path) ?? "",
      text: str(item.text) ?? "",
      ...(str(item.sourceUrn) ? { sourceUrn: str(item.sourceUrn) as string } : {}),
      ...(str(item.effectiveFrom) ? { effectiveFrom: str(item.effectiveFrom) as string } : {}),
    }));
  return {
    root,
    footnotes,
    versionKind: versionKind(r.versionKind),
    ...(str(r.asOf) ? { asOf: str(r.asOf) as string } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Quan hệ                                                             */
/* ------------------------------------------------------------------ */

const GROUP_ALIAS: Record<string, RelationType> = {
  van_ban_cha: "cha",
  cha: "cha",
  van_ban_con: "con",
  con: "con",
};

function toRelationItem(raw: Raw): RelationItem | null {
  const urn = str(raw.otherUrn) ?? str(raw.urn) ?? str(raw.otherDocUrn);
  if (!urn) return null;
  const parsed = parseUrn(urn);
  return {
    urn,
    shortTitle: str(raw.otherShortTitle) ?? str(raw.shortTitle) ?? str(raw.otherTitle) ?? urn,
    ...((str(raw.otherTitle) ?? str(raw.title))
      ? { title: (str(raw.otherTitle) ?? str(raw.title)) as string }
      : {}),
    docType: str(raw.docType) ?? parsed?.docType ?? "",
    soKyHieu: str(raw.soKyHieu) ?? parsed?.soKyHieu ?? "",
    ...((str(raw.otherIssuedDate) ?? str(raw.issuedDate))
      ? { issuedDate: (str(raw.otherIssuedDate) ?? str(raw.issuedDate)) as string }
      : {}),
    status: docStatus(raw.otherStatus ?? raw.status ?? raw.docStatus),
    ...((str(raw.targetPath) ?? parsed?.path)
      ? { targetPath: (str(raw.targetPath) ?? parsed?.path) as string }
      : {}),
    ...(str(raw.targetLabel) ? { targetLabel: str(raw.targetLabel) as string } : {}),
    ...(str(raw.effectiveFrom) ? { effectiveFrom: str(raw.effectiveFrom) as string } : {}),
    ...(str(raw.note) ? { note: str(raw.note) as string } : {}),
  };
}

/** Chấp nhận mảng nhóm, `{groups: [...]}` hoặc `{loại: [...]}`. */
export function toRelations(raw: unknown): RelationGroup[] {
  const r = asRecord(raw);
  const rawGroups: unknown = Array.isArray(raw) ? raw : (r?.groups ?? r);
  const out: RelationGroup[] = [];

  const pushGroup = (type: string, label: string, items: unknown) => {
    if (!Array.isArray(items)) return;
    const mapped = items
      .map((item) => asRecord(item))
      .filter((item): item is Raw => item !== null)
      .map(toRelationItem)
      .filter((item): item is RelationItem => item !== null);
    if (!mapped.length) return;
    out.push({ type: (GROUP_ALIAS[type] ?? type) as RelationType, label, items: mapped });
  };

  if (Array.isArray(rawGroups)) {
    for (const entry of rawGroups) {
      const g = asRecord(entry);
      if (!g) continue;
      const name = str(g.group) ?? str(g.type) ?? "khac";
      const label = str(g.label) ?? RELATION_LABEL[(GROUP_ALIAS[name] ?? name) as RelationType] ?? name;
      const items = Array.isArray(g.items) ? (g.items as unknown[]) : [];
      if (GROUP_ALIAS[name]) {
        pushGroup(name, label, items);
        continue;
      }
      // Nhóm gộp (ví dụ "văn bản ảnh hưởng liên quan"): tách theo loại quan hệ của từng mục.
      const byType = new Map<string, unknown[]>();
      for (const item of items) {
        const it = asRecord(item);
        if (!it) continue;
        const type = str(it.type) ?? name;
        const bucket = byType.get(type) ?? [];
        bucket.push(it);
        byType.set(type, bucket);
      }
      if (!byType.size) continue;
      for (const [type, bucket] of byType) {
        const first = asRecord(bucket[0]);
        pushGroup(type, str(first?.label) ?? RELATION_LABEL[type as RelationType] ?? label, bucket);
      }
    }
    return out;
  }

  const record = asRecord(rawGroups);
  if (!record) throw new Error("Dữ liệu quan hệ không hợp lệ");
  for (const [type, items] of Object.entries(record)) {
    pushGroup(type, RELATION_LABEL[(GROUP_ALIAS[type] ?? type) as RelationType] ?? type, items);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Danh sách và tìm kiếm                                               */
/* ------------------------------------------------------------------ */

export function toDocumentList(raw: unknown): DocumentListResponse {
  const r = asRecord(raw);
  const list = Array.isArray(raw) ? raw : (r?.items as unknown);
  if (!Array.isArray(list)) throw new Error("Danh sách văn bản không hợp lệ");
  const items: DocumentListItem[] = list
    .map((item) => asRecord(item))
    .filter((item): item is Raw => item !== null)
    .map((item) => {
      const meta = toMeta(item);
      return {
        urn: meta.urn,
        docType: meta.docType,
        soKyHieu: meta.soKyHieu,
        shortTitle: meta.shortTitle,
        title: meta.title,
        issuer: meta.issuer,
        documentGroup: meta.documentGroup,
        primarySource: meta.primarySource,
        coTepGoc: item.coTepGoc === true,
        issuedDate: meta.issuedDate,
        ...(meta.effectiveFrom ? { effectiveFrom: meta.effectiveFrom } : {}),
        status: meta.status,
        fields: meta.fields,
        ...(meta.summary ? { summary: meta.summary } : {}),
      };
    });
  return {
    items,
    total: num(r?.total) ?? items.length,
    page: num(r?.page) ?? 1,
    limit: num(r?.limit) ?? items.length,
  };
}

/** Dựng facet từ chính kết quả khi API chưa trả facet. */
function deriveFacets(hits: SearchHit[]): SearchFacets {
  const count = (values: Array<string | undefined>) => {
    const map = new Map<string, number>();
    for (const value of values) {
      if (!value) continue;
      map.set(value, (map.get(value) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([value, n]) => ({ value, label: value, count: n }));
  };
  return {
    docType: count(hits.map((h) => h.docType)),
    issuer: [],
    field: [],
    status: count(hits.map((h) => h.status)),
    year: count(hits.map((h) => h.issuedDate?.slice(0, 4))),
  };
}

export function toSearchResponse(raw: unknown): SearchResponse {
  const r = asRecord(raw);
  const list = r?.hits;
  if (!Array.isArray(list)) throw new Error("Kết quả tìm kiếm không hợp lệ");
  const hits: SearchHit[] = list
    .map((item) => asRecord(item))
    .filter((item): item is Raw => item !== null)
    .map((item) => {
      const urn = str(item.urn) ?? "";
      const path = str(item.path) ?? parseUrn(urn)?.path ?? "";
      const matchedBy = strArray(item.matchedBy);
      const group = !path
        ? "van_ban"
        : matchedBy.some((m) => m.includes("citation") || m.includes("vien_dan"))
          ? "vien_dan"
          : "nut";
      return {
        urn,
        docTitle: str(item.docTitle) ?? str(item.shortTitle) ?? str(item.title) ?? urn,
        ...(str(item.title) ? { docFullTitle: str(item.title) as string } : {}),
        path,
        label: str(item.label) ?? (path ? path : "Toàn văn"),
        ...(str(item.heading) ? { heading: str(item.heading) as string } : {}),
        contextPath: str(item.contextPath) ?? str(item.issuer) ?? "",
        snippet: str(item.snippet) ?? str(item.text) ?? "",
        score: num(item.score) ?? 0,
        // docStatusAsOf là trạng thái tại ngày tra; docStatus chỉ là ảnh chụp hiện tại.
        status: docStatus(item.docStatusAsOf ?? item.docStatus ?? item.status),
        ...(str(item.docType) ? { docType: str(item.docType) as string } : {}),
        ...(str(item.soKyHieu) ? { soKyHieu: str(item.soKyHieu) as string } : {}),
        ...(str(item.issuedDate) ? { issuedDate: str(item.issuedDate) as string } : {}),
        group: group as SearchHit["group"],
      };
    });

  const facetsRaw = asRecord(r?.facets);
  const facets: SearchFacets = facetsRaw
    ? {
        docType: toFacetValues(facetsRaw.docType),
        issuer: toFacetValues(facetsRaw.issuer),
        field: toFacetValues(facetsRaw.field),
        status: toFacetValues(facetsRaw.status),
        year: toFacetValues(facetsRaw.year),
      }
    : deriveFacets(hits);

  return {
    hits,
    facets,
    total: num(r?.total) ?? hits.length,
    page: num(r?.page) ?? 1,
    limit: num(r?.limit) ?? hits.length,
  };
}

function toFacetValues(raw: unknown): SearchFacets["docType"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => asRecord(item))
    .filter((item): item is Raw => item !== null)
    .map((item) => ({
      value: str(item.value) ?? str(item.key) ?? "",
      label: str(item.label) ?? str(item.value) ?? str(item.key) ?? "",
      count: num(item.count) ?? 0,
    }))
    .filter((item) => item.value !== "");
}
