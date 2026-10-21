/**
 * Adapter vanban.chinhphu.vn (nguồn ưu tiên 2, ke-hoach/01 §7).
 *
 * Kiểm chứng 2026-09-06: robots.txt `Allow: /`; trang chi tiết
 * `/?pageid=27160&docid={n}` là HTML tĩnh (ASP.NET WebForms), thuộc tính nằm
 * trong `div.Detail .Content table` dạng cặp `<td class="col1">Nhãn</td><td>Giá trị</td>`;
 * file đính kèm ở `a.view-file` trỏ datafiles.chinhphu.vn.
 * Khối "Các văn bản khác" chứa link `/?pageid=27160&docid=…` -> dùng để dò docid.
 */
import { parse } from "node-html-parser";
import { fetcher, requireOk } from "../fetcher.ts";
import { normalizeSoKyHieu, normalizeText, parseVietnameseDate } from "../normalize.ts";
import {
  type DiscoveredItem,
  type DiscoverOptions,
  fileKindOf,
  type RawDocMeta,
  type SourceAdapter,
  type SourceFile,
  type SourceItem,
} from "./types.ts";

export const VBCP_BASE = "https://vanban.chinhphu.vn";
export const VBCP_PAGE_ID = 27160;

export function detailUrl(docid: string | number): string {
  return `${VBCP_BASE}/?pageid=${VBCP_PAGE_ID}&docid=${docid}`;
}

export function docIdFromUrl(url: string): string | undefined {
  return /[?&]docid=(\d+)/i.exec(url)?.[1];
}

const ATTR_MAP: Record<string, keyof RawDocMeta> = {
  "số ký hiệu": "soKyHieu",
  "số, ký hiệu": "soKyHieu",
  "ngày ban hành": "issuedDate",
  "ngày có hiệu lực": "effectiveFrom",
  "ngày hiệu lực": "effectiveFrom",
  "ngày hết hiệu lực": "effectiveTo",
  "loại văn bản": "typeName",
  "cơ quan ban hành": "issuer",
  "người ký": "signer",
  "trích yếu": "summary",
};

export interface ParsedVbcpDetail {
  meta: RawDocMeta;
  files: SourceFile[];
  /** docid của các văn bản liên quan hiển thị ở khối "Các văn bản khác". */
  neighbours: string[];
}

export function parseDetailPage(html: string): ParsedVbcpDetail {
  const root = parse(html);
  const meta: RawDocMeta = { soKyHieu: "", title: "" };

  const title = normalizeText(
    root.querySelector(".Detail .Title h4.title")?.text ?? root.querySelector("h4.title")?.text ?? "",
  );
  if (title) meta.title = title;

  for (const tr of root.querySelectorAll(".Content table tr")) {
    const tds = tr.querySelectorAll("td");
    if (tds.length < 2) continue;
    const name = normalizeText(tds[0]!.text).toLowerCase().replace(/\s+/g, " ").trim();
    const key = ATTR_MAP[name];
    if (!key) continue;
    const value = normalizeText(tds[1]!.text);
    if (!value) continue;
    if (key === "issuedDate" || key === "effectiveFrom" || key === "effectiveTo") {
      const d = parseVietnameseDate(value);
      if (d) meta[key] = d;
      continue;
    }
    if (key === "soKyHieu") {
      meta.soKyHieu = normalizeSoKyHieu(value);
      continue;
    }
    (meta as any)[key] = value;
  }

  const files: SourceFile[] = [];
  const seen = new Set<string>();
  for (const a of root.querySelectorAll(".doc-list a[href], a.view-file[href]")) {
    const href = a.getAttribute("href");
    if (!href || href.startsWith("javascript:")) continue;
    const url = href.startsWith("http") ? href : `${VBCP_BASE}${href.startsWith("/") ? "" : "/"}${href}`;
    if (seen.has(url)) continue;
    seen.add(url);
    const label = normalizeText(a.text);
    files.push({ kind: fileKindOf(url), url, ...(label ? { fileName: label, label } : {}) });
  }

  const neighbours: string[] = [];
  for (const a of root.querySelectorAll('.similar-document-control a[href*="docid="]')) {
    const id = docIdFromUrl(a.getAttribute("href") ?? "");
    if (id && !neighbours.includes(id)) neighbours.push(id);
  }

  return { meta, files, neighbours };
}

export class VanBanChinhPhuAdapter implements SourceAdapter {
  readonly id = "vanban-chinhphu";
  readonly name = "Hệ thống văn bản Chính phủ (vanban.chinhphu.vn)";
  readonly priority = 3;

  constructor(private http = fetcher) {}

  /**
   * Nguồn này không có trang danh sách tĩnh tiện dụng; ke-hoach/04 §2 quy định
   * "quét docid tăng dần". `opts.page` dùng làm docid bắt đầu; mặc định lấy
   * docid mới nhất bằng cách đi theo khối "Các văn bản khác".
   */
  async discover(opts: DiscoverOptions & { startDocId?: number }): Promise<DiscoveredItem[]> {
    const limit = opts.limit ?? 10;
    const out: DiscoveredItem[] = [];
    const start = opts.startDocId ?? opts.page;
    if (!start) {
      throw new Error("vanban-chinhphu.discover cần startDocId (docid bắt đầu). Ví dụ: --start-docid 219343");
    }
    const queue: string[] = [String(start)];
    const visited = new Set<string>();
    while (queue.length && out.length < limit) {
      const docid = queue.shift()!;
      if (visited.has(docid)) continue;
      visited.add(docid);
      const url = detailUrl(docid);
      const res = await this.http.fetchIfAllowed(url);
      if (!res?.ok) continue;
      const parsed = parseDetailPage(res.text());
      if (!parsed.meta.soKyHieu && !parsed.meta.title) continue;
      if (opts.since && parsed.meta.issuedDate && parsed.meta.issuedDate < opts.since) continue;
      out.push({ sourceId: docid, url, preview: parsed.meta, files: parsed.files });
      for (const n of parsed.neighbours) if (!visited.has(n)) queue.push(n);
    }
    return out.slice(0, limit);
  }

  async fetchItem(id: string): Promise<SourceItem> {
    const url = /^https?:/i.test(id) ? id : detailUrl(id);
    const res = requireOk(await this.http.fetch(url));
    const html = res.text();
    const parsed = parseDetailPage(html);
    return {
      source: this.id,
      sourceId: docIdFromUrl(url) ?? id,
      url,
      meta: parsed.meta,
      files: parsed.files,
      relations: [],
      rawHtml: html,
      ...(res.etag ? { etag: res.etag } : {}),
      ...(res.lastModified ? { lastModified: res.lastModified } : {}),
    };
  }
}

export const vanbanChinhPhu = new VanBanChinhPhuAdapter();
