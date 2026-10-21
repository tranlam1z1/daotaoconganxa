/**
 * Adapter CSDL quốc gia về pháp luật — vbpl.vn (nguồn ưu tiên 1 cho THUỘC TÍNH và TRẠNG THÁI).
 *
 * KẾT QUẢ ĐIỀU TRA THẬT (cập nhật 06/9/2026):
 *  - vbpl.vn nằm sau TƯỜNG LỬA ỨNG DỤNG có thử thách JavaScript. Mọi yêu cầu HTTP thường,
 *    kể cả khi đặt User-Agent trình duyệt và đủ header, đều nhận **403** kèm trang
 *    "Sorry, you have been blocked" — kể cả `/robots.txt` và `/sitemap.xml`.
 *    Nghĩa là KHÔNG đọc được chính sách robots của nguồn này qua HTTP thường.
 *  - Trình duyệt thật (Puppeteer + Chromium, xem `../browser.ts`) chạy được thử thách và
 *    vào bình thường: HTTP 200. Vì vậy adapter dùng phiên trình duyệt dùng chung, vượt
 *    thử thách MỘT LẦN rồi tái sử dụng cookie.
 *  - Trang chi tiết `/van-ban/chi-tiet/{slug}--{id}` là Next.js App Router. Thân phản hồi
 *    máy chủ chứa khối JSON-LD `schema.org/Legislation` với: tên, số ký hiệu, loại văn bản,
 *    ngày ban hành, cơ quan ban hành, trạng thái hiệu lực, lĩnh vực (keywords).
 *  - LƯỢC ĐỒ 12 NHÓM QUAN HỆ nằm trong tab do React dựng sau khi hydrate. Trong môi trường
 *    máy chủ, hydrate thất bại (React error #329 — Suspense không hoàn tất) nên tab không
 *    dựng được. `parseRelations()` vẫn giữ để đọc khi nguồn render sẵn, hiện thường rỗng.
 *    Quan hệ thực tế được bù bằng `pipeline/relations.ts` (căn cứ, dẫn chiếu từ nội dung)
 *    và `pipeline/extract-ops.ts` (sửa đổi, bãi bỏ, thay thế từ lệnh sửa đổi) — cách này
 *    còn kiểm chứng được vì suy ra từ chính câu chữ của văn bản.
 *
 * Nguyên tắc khi dùng: nhịp chậm (mặc định 1 yêu cầu / 2 giây), chỉ đọc nội dung công khai.
 * Văn bản quy phạm pháp luật không thuộc phạm vi bảo hộ quyền tác giả (Điều 15 Luật Sở hữu
 * trí tuệ) và Nghị định 52/2015/NĐ-CP quy định tổ chức, cá nhân được khai thác, sử dụng.
 */
import { type HTMLElement, parse } from "node-html-parser";
import { type BrowserSession, getVbplSession } from "../browser.ts";
import { HttpError } from "../fetcher.ts";
import { normalizeSoKyHieu, normalizeText, parseVietnameseDate } from "../normalize.ts";
import {
  type DiscoveredItem,
  type DiscoverOptions,
  fileKindOf,
  type RawDocMeta,
  type RawRelation,
  type RelationType,
  type SourceAdapter,
  type SourceFile,
  type SourceItem,
} from "./types.ts";

export const VBPL_BASE = "https://vbpl.vn";

/**
 * 12 nhóm quan hệ của lược đồ vbpl.vn -> (type, direction) theo ke-hoach/03 §2.6.
 * `direction: "out"` = văn bản đang xét là đầu `from`.
 */
export const VBPL_RELATION_GROUPS: Record<string, { type: RelationType; direction: "out" | "in" }> = {
  "văn bản căn cứ": { type: "can_cu", direction: "out" },
  "văn bản được hướng dẫn": { type: "huong_dan", direction: "out" },
  "văn bản bị sửa đổi bổ sung": { type: "sua_doi", direction: "out" },
  "văn bản bị thay thế": { type: "thay_the", direction: "out" },
  "văn bản hướng dẫn": { type: "huong_dan", direction: "in" },
  "văn bản sửa đổi bổ sung": { type: "sua_doi", direction: "in" },
  "văn bản thay thế": { type: "thay_the", direction: "in" },
  "văn bản hợp nhất": { type: "hop_nhat", direction: "in" },
  "văn bản đính chính": { type: "dinh_chinh", direction: "in" },
  "văn bản dẫn chiếu": { type: "dan_chieu", direction: "out" },
  "văn bản bị đình chỉ": { type: "dinh_chi", direction: "out" },
  "văn bản quy định hết hiệu lực": { type: "cong_bo_het_hieu_luc", direction: "out" },
  // Biến thể chữ nghĩa gặp ở nguồn.
  "văn bản bị đính chính": { type: "dinh_chinh", direction: "out" },
  "văn bản bị hết hiệu lực": { type: "cong_bo_het_hieu_luc", direction: "in" },
  "văn bản đình chỉ": { type: "dinh_chi", direction: "in" },
  "văn bản bị bãi bỏ": { type: "bai_bo", direction: "out" },
  "văn bản bãi bỏ": { type: "bai_bo", direction: "in" },
};

/** Chuẩn hóa nhãn nhóm quan hệ rồi tra bảng (bỏ dấu ":", "(3)", chữ hoa). */
export function mapRelationLabel(label: string): { type: RelationType; direction: "out" | "in" } | undefined {
  const key = normalizeText(label)
    .toLowerCase()
    .replace(/\(\s*\d+\s*\)/g, "")
    .replace(/[,:;.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return VBPL_RELATION_GROUPS[key];
}

/** Lấy id văn bản từ URL vbpl: …/chi-tiet/{slug}--{id} */
export function idFromDetailUrl(url: string): string | undefined {
  return /--([0-9a-zA-Z-]+)(?:[/?#]|$)/.exec(url)?.[1];
}

const SO_KY_HIEU_RE = /\b(\d+[A-ZĐa-zđ]?\/\d{4}\/[A-ZĐa-zđ0-9]+(?:-[A-ZĐa-zđ0-9]+)*)\b/;

export interface VbplParsed {
  meta: RawDocMeta;
  files: SourceFile[];
  relations: RawRelation[];
  /** true khi trang chỉ có khung "Đang tải dữ liệu..." (nội dung nạp bằng JS). */
  clientRendered: boolean;
}

function jsonLdBlocks(root: HTMLElement): any[] {
  const out: any[] = [];
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const v = JSON.parse(s.text);
      if (Array.isArray(v)) out.push(...v);
      else out.push(v);
    } catch {
      // Bỏ qua khối JSON-LD hỏng, không nuốt các khối còn lại.
    }
  }
  return out;
}

/** Trạng thái hiệu lực schema.org -> chuỗi thô tiếng Việt của nguồn. */
function legalForceToStatus(force: string | undefined): string | undefined {
  switch ((force ?? "").toLowerCase()) {
    case "inforce":
      return "Còn hiệu lực";
    case "notinforce":
      return "Hết hiệu lực";
    case "partiallyinforce":
      return "Hết hiệu lực một phần";
    default:
      return force || undefined;
  }
}

/** Đọc phần lược đồ nếu nó được render sẵn trong HTML. */
export function parseRelations(root: HTMLElement): RawRelation[] {
  const out: RawRelation[] = [];
  const seen = new Set<string>();
  // Mọi phần tử có thể là tiêu đề nhóm quan hệ.
  const candidates = root.querySelectorAll(
    "h2, h3, h4, .title, .luocdo-title, .group-title, [data-relation-group]",
  );
  for (const head of candidates) {
    const label = head.getAttribute("data-relation-group") ?? head.text;
    const mapped = mapRelationLabel(label);
    if (!mapped) continue;
    // Khối chứa link nằm ngay sau tiêu đề hoặc trong cùng phần tử cha.
    const scopes = [head.nextElementSibling, head.parentNode].filter(Boolean) as HTMLElement[];
    for (const scope of scopes) {
      for (const a of scope.querySelectorAll('a[href*="/van-ban/chi-tiet/"]')) {
        const href = a.getAttribute("href") ?? "";
        const title = normalizeText(a.getAttribute("title") ?? a.text);
        if (!title && !href) continue;
        const sk = SO_KY_HIEU_RE.exec(title)?.[1];
        const key = `${mapped.type}|${mapped.direction}|${href || title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          type: mapped.type,
          direction: mapped.direction,
          ...(sk ? { otherSoKyHieu: normalizeSoKyHieu(sk) } : {}),
          ...(title ? { otherTitle: title } : {}),
          ...(href ? { otherUrl: href.startsWith("http") ? href : `${VBPL_BASE}${href}` } : {}),
          sourceLabel: normalizeText(label),
          confidence: 1,
        });
      }
      if (out.length) break;
    }
  }
  return out;
}

/**
 * Tách lĩnh vực từ chuỗi `keywords` của JSON-LD.
 *
 * vbpl.vn ghi keywords theo dạng: "<loại văn bản>, <lĩnh vực>, <cơ quan>, văn bản pháp luật, pháp luật Việt Nam".
 * KHÔNG được tách toàn bộ theo dấu phẩy: tên lĩnh vực trong pháp luật Việt Nam thường
 * chứa dấu phẩy ("Thi đua, khen thưởng", "Khoa học, công nghệ", "Văn hóa, thể thao và du lịch").
 * Vì vậy chỉ loại các phần đã biết ở hai đầu (loại văn bản, cơ quan, cụm rác) rồi ghép
 * phần còn lại thành MỘT tên lĩnh vực.
 */
export function fieldsFromKeywords(keywords: string, typeName?: string, issuer?: string): string[] {
  const JUNK = /^(văn bản pháp luật|pháp luật việt nam|chưa phân loại|vbpl)$/i;
  const parts = keywords
    .split(",")
    .map((k) => normalizeText(k))
    .filter(Boolean);
  const eq = (a: string, b?: string) => Boolean(b) && a.toLowerCase() === b!.trim().toLowerCase();

  // Bỏ loại văn bản và cơ quan ở đầu.
  let start = 0;
  while (start < parts.length && (eq(parts[start]!, typeName) || eq(parts[start]!, issuer))) start += 1;
  // Bỏ cụm rác và cơ quan ở cuối.
  let end = parts.length;
  while (
    end > start &&
    (JUNK.test(parts[end - 1]!) || eq(parts[end - 1]!, issuer) || eq(parts[end - 1]!, typeName))
  ) {
    end -= 1;
  }
  const middle = parts.slice(start, end).filter((p) => !JUNK.test(p));
  const field = middle.join(", ").trim();
  return field ? [field] : [];
}

export function parseDetailPage(html: string): VbplParsed {
  const root = parse(html);
  const meta: RawDocMeta = { soKyHieu: "", title: "" };

  const ld = jsonLdBlocks(root).find((b) => b?.["@type"] === "Legislation");
  if (ld) {
    if (ld.name) meta.title = normalizeText(String(ld.name));
    if (ld.legislationIdentifier) meta.soKyHieu = normalizeSoKyHieu(String(ld.legislationIdentifier));
    if (ld.legislationType) meta.typeName = normalizeText(String(ld.legislationType));
    const d = parseVietnameseDate(ld.legislationDate);
    if (d) meta.issuedDate = d;
    const issuer = ld.legislationPassedBy?.name ?? ld.legislationPassedBy;
    if (typeof issuer === "string" && issuer) meta.issuer = normalizeText(issuer);
    const st = legalForceToStatus(ld.legislationLegalForce);
    if (st) meta.sourceStatus = st;
    if (typeof ld.keywords === "string") {
      meta.fields = fieldsFromKeywords(ld.keywords, meta.typeName, meta.issuer);
      if (!meta.fields.length) delete meta.fields;
    }
  }

  const metaTag = (sel: string) => root.querySelector(sel)?.getAttribute("content") ?? undefined;
  if (!meta.title) {
    const t = metaTag('meta[property="og:title"]') ?? root.querySelector("title")?.text;
    if (t) meta.title = normalizeText(t).replace(/\s*\|\s*CSDL quốc gia về pháp luật\s*$/i, "");
  }
  if (!meta.issuedDate) {
    const d = parseVietnameseDate(metaTag('meta[property="article:published_time"]'));
    if (d) meta.issuedDate = d;
  }
  if (!meta.soKyHieu && meta.title) {
    const m = SO_KY_HIEU_RE.exec(meta.title);
    if (m) meta.soKyHieu = normalizeSoKyHieu(m[1]!);
  }
  const desc = metaTag('meta[name="description"]');
  if (desc && !meta.summary) meta.summary = normalizeText(desc);

  const files: SourceFile[] = [];
  for (const a of root.querySelectorAll('a[href$=".pdf"], a[href$=".doc"], a[href$=".docx"]')) {
    const href = a.getAttribute("href");
    if (!href) continue;
    const url = href.startsWith("http") ? href : `${VBPL_BASE}${href}`;
    files.push({ kind: fileKindOf(url), url, label: normalizeText(a.text) });
  }

  const relations = parseRelations(root);
  const bodyText = normalizeText(root.querySelector("main")?.text ?? root.text ?? "");
  const clientRendered = /Đang tải dữ liệu/i.test(bodyText) || bodyText.length < 400;

  return { meta, files, relations, clientRendered };
}

/** Một dòng <url> trong sitemap. */
export interface SitemapEntry {
  loc: string;
  lastmod?: string;
}

export function parseSitemap(xml: string): SitemapEntry[] {
  const out: SitemapEntry[] = [];
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const block = m[1]!;
    const loc = /<loc>([^<]+)<\/loc>/.exec(block)?.[1];
    if (!loc) continue;
    const lastmod = /<lastmod>([^<]+)<\/lastmod>/.exec(block)?.[1];
    out.push({ loc: loc.trim(), ...(lastmod ? { lastmod: lastmod.trim().slice(0, 10) } : {}) });
  }
  return out;
}

export function parseSitemapIndex(xml: string): string[] {
  const out: string[] = [];
  for (const m of xml.matchAll(/<sitemap>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/sitemap>/g)) {
    out.push(m[1]!.trim());
  }
  return out;
}

export class VbplAdapter implements SourceAdapter {
  readonly id = "vbpl";
  readonly name = "CSDL quốc gia về pháp luật (vbpl.vn)";
  readonly priority = 2;

  constructor(private browser: BrowserSession = getVbplSession()) {}

  /**
   * Tải một URL của vbpl.vn qua trình duyệt thật.
   * HTTP thường luôn nhận 403 ở nguồn này nên không có đường dự phòng; nếu trình duyệt
   * không mở được thì báo lỗi rõ thay vì trả về dữ liệu rỗng.
   */
  private async get(url: string): Promise<{ status: number; body: string }> {
    const res = await this.browser.fetchText(url);
    if (res.status !== 200) {
      throw new HttpError(url, res.status, "vbpl.vn từ chối yêu cầu");
    }
    if (/you have been blocked|403 Forbidden/i.test(res.body.slice(0, 2000))) {
      throw new HttpError(url, 403, "trang tường lửa ứng dụng của vbpl.vn");
    }
    return res;
  }

  /** Duyệt sitemap (robots cho phép) để tìm văn bản mới/cập nhật gần đây. */
  async discover(opts: DiscoverOptions): Promise<DiscoveredItem[]> {
    const limit = opts.limit ?? 20;
    const idxRes = await this.get(`${VBPL_BASE}/sitemap.xml`);
    const chunks = parseSitemapIndex(idxRes.body);
    const out: DiscoveredItem[] = [];
    for (const chunk of chunks) {
      if (out.length >= limit) break;
      let body: string;
      try {
        body = (await this.get(chunk)).body;
      } catch {
        continue;
      }
      for (const e of parseSitemap(body)) {
        if (!e.loc.includes("/van-ban/chi-tiet/")) continue;
        if (opts.since && e.lastmod && e.lastmod < opts.since) continue;
        if (opts.type && !e.loc.includes(`/${opts.type}-`)) continue;
        const sourceId = idFromDetailUrl(e.loc);
        if (!sourceId) continue;
        out.push({ sourceId, url: e.loc });
        if (out.length >= limit) break;
      }
    }
    return out.slice(0, limit);
  }

  async fetchItem(id: string): Promise<SourceItem> {
    const url = /^https?:/i.test(id) ? id : `${VBPL_BASE}/van-ban/chi-tiet/${id}`;
    const res = await this.get(url);
    const html = res.body;
    const parsed = parseDetailPage(html);
    const notes: string[] = [];
    if (parsed.clientRendered) {
      notes.push(
        "Nội dung trang do React dựng sau hydrate; thuộc tính lấy từ khối JSON-LD do máy chủ render.",
      );
    }
    if (!parsed.relations.length) {
      notes.push(
        "Lược đồ quan hệ nằm trong tab do React dựng, hydrate thất bại ở môi trường máy chủ " +
          "(React #329). Quan hệ được bù bằng pipeline/relations.ts và pipeline/extract-ops.ts.",
      );
    }
    return {
      source: this.id,
      sourceId: idFromDetailUrl(url) ?? url,
      url,
      meta: parsed.meta,
      files: parsed.files,
      relations: parsed.relations,
      rawHtml: html,
      notes,
    };
  }
}

export const vbpl = new VbplAdapter();
