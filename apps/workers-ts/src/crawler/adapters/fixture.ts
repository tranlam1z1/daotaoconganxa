/**
 * Adapter "fixture": đọc văn bản Markdown có sẵn trong thư mục cục bộ
 * (mặc định `data/fixtures`). KHÔNG phải nguồn thật — dùng để kiểm chứng toàn
 * chuỗi discover -> fetch -> ingest -> convert -> parse -> ... -> index mà không
 * đụng tới máy chủ nhà nước.
 *
 * URL của mục là `file://…`, `fetch-item.ts` đọc thẳng từ đĩa cho giao thức này.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, extname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeSoKyHieu, normalizeText, parseVietnameseDate } from "../normalize.ts";
import type { DiscoveredItem, DiscoverOptions, RawDocMeta, SourceAdapter, SourceItem } from "./types.ts";

/** Gốc monorepo, suy từ vị trí file này (apps/workers-ts/src/crawler/adapters). */
const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..", "..", "..");

export function fixtureDir(): string {
  const dir = process.env.FIXTURE_DIR?.trim() || "data/fixtures";
  return isAbsolute(dir) ? dir : resolve(REPO_ROOT, dir);
}

const TYPE_LINES = [
  "HIẾN PHÁP",
  "BỘ LUẬT",
  "LUẬT",
  "PHÁP LỆNH",
  "NGHỊ ĐỊNH",
  "NGHỊ QUYẾT",
  "QUYẾT ĐỊNH",
  "THÔNG TƯ",
  "VĂN BẢN HỢP NHẤT",
];

function titleCase(s: string): string {
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Đọc thuộc tính từ chính nội dung Markdown.
 * Fixture không có trang thuộc tính như nguồn thật, nên suy từ phần mở đầu:
 * cơ quan (dòng đầu), "Số: …", dòng tên loại viết hoa, dòng trích yếu ngay sau đó.
 */
export function parseFixtureMeta(markdown: string, fallbackId: string): RawDocMeta {
  const lines = markdown
    .split(/\r?\n/)
    .map((l) => normalizeText(l))
    .filter((l) => l.length > 0);

  const soKyHieuRaw = lines.find((l) => /^Số:\s*/i.test(l))?.replace(/^Số:\s*/i, "") ?? "";
  const soKyHieu = normalizeSoKyHieu(soKyHieuRaw);
  const typeIdx = lines.findIndex((l) => TYPE_LINES.includes(l.toUpperCase()));
  const typeName = typeIdx >= 0 ? titleCase(lines[typeIdx]!) : undefined;
  const title = typeIdx >= 0 ? (lines[typeIdx + 1] ?? "") : (lines[0] ?? fallbackId);
  const issuer = lines[0] && lines[0] !== typeName ? lines[0] : undefined;

  // Ngày ban hành: dòng kiểu "Hà Nội, ngày 20 tháng 01 năm 2026" nếu có.
  const issuedLine = lines.find((l) => /,\s*ngày\s+\d{1,2}\s+tháng/i.test(l));
  const year = /\/(\d{4})\//.exec(soKyHieu)?.[1];
  const issuedDate =
    parseVietnameseDate(issuedLine) ?? (year ? `${year}-01-01` : new Date().toISOString().slice(0, 10));

  const effLine = lines.find((l) => /có hiệu lực (thi hành )?(kể )?từ ngày/i.test(l));
  const effectiveFrom = parseVietnameseDate(effLine);

  return {
    soKyHieu,
    ...(typeName ? { typeName } : {}),
    title: title || fallbackId,
    ...(issuer ? { issuer } : {}),
    issuedDate,
    ...(effectiveFrom ? { effectiveFrom } : {}),
  };
}

export class FixtureAdapter implements SourceAdapter {
  readonly id = "fixture";
  readonly name = "Fixture cục bộ (kiểm chứng)";
  /** Ưu tiên thấp nhất: không bao giờ được chọn làm nguồn chính khi có nguồn thật. */
  readonly priority = 99;

  constructor(private readonly dir: string = fixtureDir()) {}

  private pathOf(idOrUrl: string): string {
    if (idOrUrl.startsWith("file://")) return new URL(idOrUrl).pathname;
    if (isAbsolute(idOrUrl)) return idOrUrl;
    return join(this.dir, idOrUrl.endsWith(".md") ? idOrUrl : `${idOrUrl}.md`);
  }

  async discover(opts: DiscoverOptions): Promise<DiscoveredItem[]> {
    const names = (await readdir(this.dir)).filter((n) => extname(n) === ".md").sort();
    const limit = opts.limit ?? 20;
    const page = Math.max(1, opts.page ?? 1);
    const slice = names.slice((page - 1) * limit, page * limit);
    const out: DiscoveredItem[] = [];
    for (const name of slice) {
      const abs = join(this.dir, name);
      const markdown = await readFile(abs, "utf8");
      const meta = parseFixtureMeta(markdown, name);
      if (!meta.soKyHieu) continue; // file không phải văn bản -> bỏ qua
      const url = pathToFileURL(abs).toString();
      out.push({
        sourceId: basename(name, ".md"),
        url,
        preview: meta,
        files: [{ kind: "other", url, fileName: name }],
      });
    }
    return out;
  }

  async fetchItem(id: string): Promise<SourceItem> {
    const abs = this.pathOf(id);
    const [markdown, st] = await Promise.all([readFile(abs, "utf8"), stat(abs)]);
    const name = basename(abs);
    const meta = parseFixtureMeta(markdown, name);
    const url = pathToFileURL(abs).toString();
    return {
      source: this.id,
      sourceId: basename(name, ".md"),
      url,
      meta,
      files: [{ kind: "other", url, fileName: name }],
      relations: [],
      lastModified: st.mtime.toISOString(),
      notes: ["Nguồn fixture cục bộ — chỉ dùng để kiểm chứng đường ống"],
    };
  }
}

export const fixture = new FixtureAdapter();
