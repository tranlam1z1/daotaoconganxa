/**
 * Adapter Công báo điện tử — congbao.chinhphu.vn (nguồn ưu tiên 1, ke-hoach/01 §7).
 *
 * Cấu trúc đã kiểm chứng ngày 2026-09-06 (HTTP 200, HTML tĩnh, robots: Allow /):
 *  - Danh sách:  /van-ban-dang-cong-bao/{slug}-l{code}.htm   (10 mục/trang)
 *  - Phân trang: /van-ban-dang-cong-bao/{slug}-l{code}/trang-{n}.htm
 *                (tổng số trang nằm trong biến JS `totalPageSodo`)
 *  - Chi tiết:   /van-ban/{slug}-{id}.htm
 *  - Thuộc tính: div.popup__detail--thuoctinh .row > span.name + .value .child-value
 *  - File:       a[data-atc="download"] có data-file (…​.docx / ….pdf)
 */
import { type HTMLElement, parse } from "node-html-parser";
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

export const CONGBAO_BASE = "https://congbao.chinhphu.vn";

/** Mã danh sách theo loại văn bản, lấy từ menu "Loại văn bản" của chính trang. */
export const CONGBAO_TYPE_CODES: Record<string, number> = {
  "nghi-dinh": 1,
  "quyet-dinh": 2,
  "thong-tu": 3,
  "chi-thi": 4,
  "thong-tu-lien-tich": 5,
  "nghi-quyet": 6,
  "van-ban-hop-nhat": 7,
  "thong-bao": 8,
  "cong-van": 9,
  "sao-luc": 11,
  lenh: 12,
  luat: 13,
  "phap-lenh": 14,
  "ke-hoach": 15,
  "dinh-chinh": 18,
  "cong-dien": 20,
  "huong-dan": 21,
  "hien-phap": 26,
  "nghi-quyet-lien-tich": 28,
  "bao-cao": 34,
  "quy-che": 36,
  "quy-dinh": 37,
  "thong-cao": 38,
  "chuong-trinh": 39,
  "ket-luan": 64,
  "sac-lenh": 66,
};

export function listUrl(type: string, page = 1): string {
  const code = CONGBAO_TYPE_CODES[type];
  if (!code) {
    throw new Error(
      `Loại văn bản "${type}" chưa có mã danh sách Công báo. Các loại hỗ trợ: ${Object.keys(CONGBAO_TYPE_CODES).join(", ")}`,
    );
  }
  const base = `${CONGBAO_BASE}/van-ban-dang-cong-bao/${type}-l${code}`;
  return page <= 1 ? `${base}.htm` : `${base}/trang-${page}.htm`;
}

const txt = (el: HTMLElement | null | undefined): string => normalizeText(el?.text ?? "");

/** Lấy id số của văn bản từ URL chi tiết: /van-ban/{slug}-{id}.htm */
export function idFromDetailUrl(url: string): string | undefined {
  return /-(\d+)\.htm(?:[?#]|$)/.exec(url)?.[1];
}

function absolute(href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  return `${CONGBAO_BASE}${href.startsWith("/") ? "" : "/"}${href}`;
}

/** Đọc các link tải file (docx/pdf) trong một khối HTML. */
function parseFiles(scope: HTMLElement): SourceFile[] {
  const out = new Map<string, SourceFile>();
  for (const a of scope.querySelectorAll('a[data-atc="download"]')) {
    const href = a.getAttribute("href");
    if (!href) continue;
    const name = normalizeText(a.getAttribute("data-file") ?? a.getAttribute("title") ?? a.text);
    const file: SourceFile = { kind: fileKindOf(name || href), url: absolute(href) };
    if (name) {
      file.fileName = name;
      file.label = name;
    }
    if (!out.has(file.url)) out.set(file.url, file);
  }
  return [...out.values()];
}

/** Đọc "Công báo số 500 ngày 2026-09-05" -> { no: "500", date: "2026-09-05" }. */
export function parseGazetteLabel(label: string): { no?: string; date?: string } {
  const s = normalizeText(label);
  const no = /Công báo số\s+([0-9A-Za-z+/-]+)/i.exec(s)?.[1];
  const date = parseVietnameseDate(s.replace(/Công báo số\s+\S+/i, ""));
  return { ...(no ? { no } : {}), ...(date ? { date } : {}) };
}

/** Phân tích trang danh sách -> các mục kèm thuộc tính đọc được ngay. */
export function parseListPage(html: string): DiscoveredItem[] {
  const root = parse(html);
  const items: DiscoveredItem[] = [];
  for (const el of root.querySelectorAll(".item--vb")) {
    const link =
      el.querySelector(".middle a.sapo") ??
      el.querySelector('a[href^="/van-ban/"]:not([href*="#"])') ??
      el.querySelector('a[href^="/van-ban/"]');
    const href = link?.getAttribute("href")?.split("#")[0];
    if (!href) continue;
    const url = absolute(href);
    const sourceId = el.getAttribute("data-id") ?? idFromDetailUrl(url);
    if (!sourceId) continue;

    const preview: Partial<RawDocMeta> = {};
    const kh = txt(el.querySelector(".top .kh")).replace(/^.*?Ký hiệu\s*:\s*/i, "");
    if (kh) preview.soKyHieu = normalizeSoKyHieu(kh);
    const title = normalizeText(link.getAttribute("title") ?? link.text);
    if (title) preview.title = title;

    const days = txt(el.querySelector(".bot .days"));
    const issued = /Ban hành\s*:\s*([^\]]+)/i.exec(days)?.[1];
    const effective = /Hiệu lực\s*:\s*([^\]]+)/i.exec(days)?.[1];
    const d1 = parseVietnameseDate(issued);
    if (d1) preview.issuedDate = d1;
    const d2 = parseVietnameseDate(effective);
    if (d2) preview.effectiveFrom = d2;

    const gz = el.querySelector('.share a[href^="/cong-bao/"]');
    if (gz) {
      const g = parseGazetteLabel(gz.getAttribute("title") ?? gz.text);
      if (g.no) preview.gazetteNo = g.no;
      if (g.date) preview.gazetteDate = g.date;
    }

    const files = parseFiles(el);
    items.push({ sourceId, url, preview, ...(files.length ? { files } : {}) });
  }
  return items;
}

/** Tổng số trang, lấy từ biến JS `totalPageSodo` nhúng trong trang danh sách. */
export function parseTotalPages(html: string): number | undefined {
  const m = /var\s+totalPageSodo\s*=\s*(\d+)/.exec(html);
  return m ? Number(m[1]) : undefined;
}

/** Nhãn thuộc tính ở popup "Thuộc tính" -> khóa nội bộ. */
const ATTR_MAP: Record<string, keyof RawDocMeta | "gazette"> = {
  "loại văn bản": "typeName",
  "số, ký hiệu": "soKyHieu",
  "số ký hiệu": "soKyHieu",
  "cơ quan ban hành": "issuer",
  "ngày ban hành": "issuedDate",
  "trích yếu": "summary",
  "người ký": "signer",
  "ngày hiệu lực": "effectiveFrom",
  "ngày hết hiệu lực": "effectiveTo",
  "công báo": "gazette",
};

export interface ParsedDetail {
  meta: RawDocMeta;
  files: SourceFile[];
}

/** Phân tích trang chi tiết -> thuộc tính + file. */
export function parseDetailPage(html: string): ParsedDetail {
  const root = parse(html);
  const meta: RawDocMeta = { soKyHieu: "", title: "" };

  const h1 = txt(root.querySelector("h1.title")) || txt(root.querySelector(".box-section--main .title"));
  if (h1) meta.title = h1;

  const rows =
    root.querySelectorAll(".popup__detail--thuoctinh .row").length > 0
      ? root.querySelectorAll(".popup__detail--thuoctinh .row")
      : root.querySelectorAll(".document--focus .row");

  for (const row of rows) {
    const name = txt(row.querySelector(".name")).toLowerCase().replace(/\s+/g, " ").trim();
    const key = ATTR_MAP[name];
    if (!key) continue;
    const valueEl = row.querySelector(".value");
    const raw = txt(valueEl);
    if (!raw) continue;
    if (key === "gazette") {
      const a = row.querySelector("a");
      const g = parseGazetteLabel(a?.getAttribute("title") ?? raw);
      if (g.no) meta.gazetteNo = g.no;
      else meta.gazetteNo = raw;
      if (g.date) meta.gazetteDate = g.date;
      continue;
    }
    if (key === "issuedDate" || key === "effectiveFrom" || key === "effectiveTo") {
      const d = parseVietnameseDate(raw);
      if (d) meta[key] = d;
      continue;
    }
    if (key === "soKyHieu") {
      meta.soKyHieu = normalizeSoKyHieu(raw);
      continue;
    }
    (meta as any)[key] = raw;
  }

  // Dự phòng khi popup thuộc tính vắng mặt: đọc dòng "Ban hành: … - Hiệu lực: …".
  if (!meta.issuedDate || !meta.effectiveFrom) {
    const line = txt(root.querySelector(".box-section--main .text"));
    if (!meta.issuedDate) {
      const d = parseVietnameseDate(/Ban hành\s*:\s*([\d/.-]+)/i.exec(line)?.[1]);
      if (d) meta.issuedDate = d;
    }
    if (!meta.effectiveFrom) {
      const d = parseVietnameseDate(/Hiệu lực\s*:\s*([\d/.-]+)/i.exec(line)?.[1]);
      if (d) meta.effectiveFrom = d;
    }
  }
  if (!meta.soKyHieu && meta.title) {
    const m = /\b(\d+[A-ZĐ]?\/\d{4}\/[A-ZĐ0-9-]+)\b/.exec(normalizeText(meta.title));
    if (m) meta.soKyHieu = normalizeSoKyHieu(m[1]!);
  }

  return { meta, files: parseFiles(root) };
}

/** Kết quả đếm tổng số văn bản của một loại ở nguồn. */
export interface DemNguon {
  loai: string;
  soTrang: number;
  moiTrang: number;
  tong: number;
  /** false khi trang cuối không đọc được mục nào (số liệu là chặn trên). */
  chinhXac: boolean;
}

export class CongbaoAdapter implements SourceAdapter {
  readonly id = "congbao";
  readonly name = "Công báo điện tử (congbao.chinhphu.vn)";
  readonly priority = 1;

  constructor(private http = fetcher) {}

  async discover(opts: DiscoverOptions): Promise<DiscoveredItem[]> {
    const type = opts.type ?? "nghi-dinh";
    const limit = opts.limit ?? 20;
    const startPage = opts.page ?? 1;
    const out: DiscoveredItem[] = [];
    let totalPages: number | undefined;

    for (let page = startPage; out.length < limit; page++) {
      if (totalPages !== undefined && page > totalPages) break;
      const url = listUrl(type, page);
      const res = requireOk(await this.http.fetch(url));
      const html = res.text();
      if (totalPages === undefined) totalPages = parseTotalPages(html);
      // Công báo CHUYỂN HƯỚNG số trang vượt quá tổng về trang 1 (đã kiểm chứng 08/9/2026 với
      // danh mục quyết định: trang 628+ trả về nội dung trang 1). Worker phát hiện chạy mỗi
      // trang một job bắt đầu từ `page`, nên phải kiểm tra tổng số trang đọc được từ chính trang
      // này và kiểm tra URL sau chuyển hướng; nếu không, chuỗi phân trang chạy tới chặn trên.
      if (totalPages !== undefined && page > totalPages) break;
      if (page > 1 && res.url && !res.url.includes(`/trang-${page}.htm`)) break;
      const items = parseListPage(html);
      if (!items.length) break;
      for (const it of items) {
        if (opts.since && it.preview?.issuedDate && it.preview.issuedDate < opts.since) continue;
        out.push(it);
        if (out.length >= limit) break;
      }
      // Chặn vòng lặp vô hạn khi trang không đổi nội dung.
      if (page - startPage > 200) break;
    }
    return out.slice(0, limit);
  }

  /**
   * Đếm TỔNG số văn bản của một loại đang có trên Công báo — mẫu số thật để tính tiến độ.
   *
   * Cách đếm: trang danh sách nhúng biến JS `totalPageSodo` (tổng số trang) và mỗi trang có
   * số mục cố định; lấy thêm TRANG CUỐI để biết phần dư, nên kết quả là số đếm chứ không
   * phải ước lượng. Tốn đúng 2 request cho mỗi loại.
   */
  async demTong(type: string): Promise<DemNguon> {
    const html1 = requireOk(await this.http.fetch(listUrl(type, 1))).text();
    const soTrang = parseTotalPages(html1) ?? 1;
    const moiTrang = parseListPage(html1).length;
    if (soTrang <= 1) return { loai: type, soTrang, moiTrang, tong: moiTrang, chinhXac: true };
    const htmlCuoi = requireOk(await this.http.fetch(listUrl(type, soTrang))).text();
    const trangCuoi = parseListPage(htmlCuoi).length;
    return {
      loai: type,
      soTrang,
      moiTrang,
      tong: (soTrang - 1) * moiTrang + trangCuoi,
      chinhXac: trangCuoi > 0,
    };
  }

  async fetchItem(id: string): Promise<SourceItem> {
    const url = /^https?:/i.test(id)
      ? id
      : id.startsWith("/")
        ? absolute(id)
        : `${CONGBAO_BASE}/van-ban/${id}.htm`;
    const res = requireOk(await this.http.fetch(url));
    const html = res.text();
    const { meta, files } = parseDetailPage(html);
    const sourceId = idFromDetailUrl(res.url) ?? idFromDetailUrl(url) ?? url;
    return {
      source: this.id,
      sourceId,
      url: res.url || url,
      meta,
      files,
      relations: [],
      rawHtml: html,
      ...(res.etag ? { etag: res.etag } : {}),
      ...(res.lastModified ? { lastModified: res.lastModified } : {}),
      notes: ["Công báo không công bố lược đồ quan hệ; quan hệ lấy từ nội dung và vbpl.vn."],
    };
  }
}

export const congbao = new CongbaoAdapter();
