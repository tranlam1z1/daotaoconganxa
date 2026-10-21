/**
 * Test hợp đồng adapter chạy NGOẠI TUYẾN trên HTML thật đã lưu ở test-fixtures/
 * (tải ngày 2026-09-06, HTTP 200). Khi nguồn đổi cấu trúc, test này đỏ trước.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  idFromDetailUrl,
  listUrl,
  parseDetailPage as parseCongbaoDetail,
  parseGazetteLabel,
  parseListPage,
  parseTotalPages,
} from "../src/crawler/adapters/congbao.ts";
import {
  detailUrl,
  docIdFromUrl,
  parseDetailPage as parseVbcpDetail,
} from "../src/crawler/adapters/vanban-chinhphu.ts";
import {
  mapRelationLabel,
  parseSitemap,
  parseSitemapIndex,
  parseDetailPage as parseVbplDetail,
  VBPL_RELATION_GROUPS,
  idFromDetailUrl as vbplId,
} from "../src/crawler/adapters/vbpl.ts";
import { isAllowed, parseRobots } from "../src/crawler/robots.ts";

const FX = (name: string) => readFileSync(join(import.meta.dir, "..", "test-fixtures", name), "utf8");

describe("congbao.chinhphu.vn — trang danh sách", () => {
  const html = FX("congbao-list-nghi-dinh.html");
  const items = parseListPage(html);

  test("URL danh sách và phân trang", () => {
    expect(listUrl("nghi-dinh")).toBe("https://congbao.chinhphu.vn/van-ban-dang-cong-bao/nghi-dinh-l1.htm");
    expect(listUrl("nghi-dinh", 2)).toBe(
      "https://congbao.chinhphu.vn/van-ban-dang-cong-bao/nghi-dinh-l1/trang-2.htm",
    );
    expect(listUrl("thong-tu", 3)).toBe(
      "https://congbao.chinhphu.vn/van-ban-dang-cong-bao/thong-tu-l3/trang-3.htm",
    );
    expect(() => listUrl("khong-ton-tai")).toThrow(/chưa có mã danh sách/);
  });

  test("đọc được tổng số trang từ biến JS totalPageSodo", () => {
    expect(parseTotalPages(html)).toBeGreaterThan(0);
  });

  test("tách đúng 3 mục kèm thuộc tính", () => {
    expect(items).toHaveLength(3);
    const first = items[0]!;
    expect(first.sourceId).toBe("470341");
    expect(first.url).toBe("https://congbao.chinhphu.vn/van-ban/nghi-dinh-so-336-2026-nd-cp-470341.htm");
    expect(first.preview?.soKyHieu).toBe("336/2026/NĐ-CP");
    expect(first.preview?.title).toContain("một cửa quốc gia");
    expect(first.preview?.issuedDate).toBe("2026-08-22");
    expect(first.preview?.effectiveFrom).toBe("2026-10-15");
    expect(first.preview?.gazetteNo).toBe("500");
    expect(first.preview?.gazetteDate).toBe("2026-09-05");
  });

  test("lấy được link DOCX và PDF", () => {
    const files = items[0]!.files ?? [];
    expect(files.map((f) => f.kind).sort()).toEqual(["docx", "pdf"]);
    for (const f of files) expect(f.url).toStartWith("https://");
  });

  test("id lấy từ URL chi tiết", () => {
    expect(idFromDetailUrl("/van-ban/nghi-dinh-so-336-2026-nd-cp-470341.htm")).toBe("470341");
    expect(idFromDetailUrl("/van-ban/x.htm#print")).toBeUndefined();
  });
});

describe("congbao.chinhphu.vn — trang chi tiết", () => {
  const { meta, files } = parseCongbaoDetail(FX("congbao-detail-336-2026.html"));

  test("trích đủ các trường theo ke-hoach/04 §2", () => {
    expect(meta.typeName).toBe("Nghị định");
    expect(meta.soKyHieu).toBe("336/2026/NĐ-CP");
    expect(meta.issuer).toBe("CHÍNH PHỦ");
    expect(meta.issuedDate).toBe("2026-08-22");
    expect(meta.effectiveFrom).toBe("2026-10-15");
    expect(meta.signer).toBe("Nguyễn Văn Thắng");
    expect(meta.summary).toContain("thủ tục hành chính");
    expect(meta.title).toContain("Nghị định số 336/2026/NĐ-CP");
    expect(meta.gazetteNo).toBe("500");
    expect(meta.gazetteDate).toBe("2026-09-05");
  });

  test("có cả file PDF và DOCX", () => {
    const kinds = new Set(files.map((f) => f.kind));
    expect(kinds.has("pdf")).toBe(true);
    expect(kinds.has("docx")).toBe(true);
  });

  test("đọc nhãn công báo", () => {
    expect(parseGazetteLabel("Công báo số 500 ngày 2026-09-05")).toEqual({ no: "500", date: "2026-09-05" });
    expect(parseGazetteLabel("Công báo số 12+13 ngày 01/02/2026")).toEqual({
      no: "12+13",
      date: "2026-02-01",
    });
  });
});

describe("vbpl.vn", () => {
  const parsed = parseVbplDetail(FX("vbpl-detail-69-2018.html"));

  test("lấy thuộc tính từ JSON-LD schema.org/Legislation", () => {
    expect(parsed.meta.soKyHieu).toBe("69/2018/NĐ-CP");
    expect(parsed.meta.typeName).toBe("Nghị định");
    expect(parsed.meta.issuer).toBe("Chính phủ");
    expect(parsed.meta.issuedDate).toBe("2018-05-15");
    expect(parsed.meta.sourceStatus).toBe("Hết hiệu lực");
    expect(parsed.meta.title).toContain("Quy định chi tiết một số điều của Luật Quản lý Ngoại thương");
  });

  test("nhận biết trang nạp bằng JS (hạn chế đã ghi trong README)", () => {
    expect(parsed.clientRendered).toBe(true);
    expect(parsed.relations).toEqual([]);
  });

  test("id lấy từ URL", () => {
    expect(vbplId("https://vbpl.vn/van-ban/chi-tiet/nghi-dinh-so-69-2018-nd-cp--129421")).toBe("129421");
  });

  test("ánh xạ đủ 12 nhóm quan hệ của lược đồ", () => {
    const NHOM_12 = [
      "Văn bản căn cứ",
      "Văn bản được hướng dẫn",
      "Văn bản bị sửa đổi bổ sung",
      "Văn bản bị thay thế",
      "Văn bản hướng dẫn",
      "Văn bản sửa đổi bổ sung",
      "Văn bản thay thế",
      "Văn bản hợp nhất",
      "Văn bản đính chính",
      "Văn bản dẫn chiếu",
      "Văn bản bị đình chỉ",
      "Văn bản quy định hết hiệu lực",
    ];
    for (const nhan of NHOM_12) {
      const m = mapRelationLabel(nhan);
      expect(m, `thiếu ánh xạ cho "${nhan}"`).toBeDefined();
      expect(["out", "in"]).toContain(m!.direction);
    }
    expect(mapRelationLabel("VĂN BẢN CĂN CỨ (3):")).toEqual({ type: "can_cu", direction: "out" });
    expect(mapRelationLabel("Không phải nhóm quan hệ")).toBeUndefined();
    expect(Object.keys(VBPL_RELATION_GROUPS).length).toBeGreaterThanOrEqual(12);
  });

  test("đọc sitemap", () => {
    const idx = parseSitemapIndex(
      "<sitemapindex><sitemap><loc>https://vbpl.vn/sitemap/1.xml</loc></sitemap></sitemapindex>",
    );
    expect(idx).toEqual(["https://vbpl.vn/sitemap/1.xml"]);
    const urls = parseSitemap(
      "<urlset><url><loc>https://vbpl.vn/van-ban/chi-tiet/a--1</loc><lastmod>2026-09-05</lastmod></url></urlset>",
    );
    expect(urls).toEqual([{ loc: "https://vbpl.vn/van-ban/chi-tiet/a--1", lastmod: "2026-09-05" }]);
  });
});

describe("vanban.chinhphu.vn", () => {
  const parsed = parseVbcpDetail(FX("vanban-chinhphu-detail-16-2025.html"));

  test("URL chi tiết theo pageid/docid", () => {
    expect(detailUrl(214090)).toBe("https://vanban.chinhphu.vn/?pageid=27160&docid=214090");
    expect(docIdFromUrl("/?pageid=27160&docid=219343")).toBe("219343");
  });

  test("trích thuộc tính từ bảng", () => {
    expect(parsed.meta.soKyHieu).toBe("16/2025/TT-BNNMT");
    expect(parsed.meta.typeName).toBe("Thông tư");
    expect(parsed.meta.issuer).toBe("Bộ Nông nghiệp và Môi trường");
    expect(parsed.meta.signer).toBe("Nguyễn Quốc Trị");
    expect(parsed.meta.issuedDate).toBe("2025-06-19");
    expect(parsed.meta.effectiveFrom).toBe("2025-07-01");
    expect(parsed.meta.summary).toContain("phân quyền, phân cấp");
    expect(parsed.meta.title).toContain("Thông tư số 16/2025/TT-BNNMT");
  });

  test("lấy file đính kèm và docid văn bản liên quan", () => {
    expect(parsed.files.some((f) => f.kind === "pdf")).toBe(true);
    expect(parsed.neighbours.length).toBeGreaterThan(0);
    for (const n of parsed.neighbours) expect(n).toMatch(/^\d+$/);
  });
});

describe("robots.txt", () => {
  test("congbao.chinhphu.vn cho phép tất cả (kể cả khi có BOM)", () => {
    const r = parseRobots("﻿User-agent: *\nAllow: /");
    expect(isAllowed(r, "quydinhphapluat.vn-bot/0.1", "https://congbao.chinhphu.vn/van-ban/x.htm")).toBe(
      true,
    );
  });

  test("vbpl.vn cấm /api/ và /Pages/ — adapter KHÔNG được gọi API nội bộ", () => {
    const r = parseRobots(
      "User-Agent: *\nAllow: /\nDisallow: /api/\nDisallow: /Pages/\n\nSitemap: https://vbpl.vn/sitemap.xml\n",
    );
    const ua = "quydinhphapluat.vn-bot/0.1";
    expect(isAllowed(r, ua, "https://vbpl.vn/van-ban/chi-tiet/abc--1")).toBe(true);
    expect(isAllowed(r, ua, "https://vbpl.vn/sitemap.xml")).toBe(true);
    expect(isAllowed(r, ua, "https://vbpl.vn/api/documents/1")).toBe(false);
    expect(isAllowed(r, ua, "https://vbpl.vn/Pages/home.aspx")).toBe(false);
    expect(r.sitemaps).toEqual(["https://vbpl.vn/sitemap.xml"]);
  });

  test("luật cụ thể hơn thắng (Allow dài hơn Disallow)", () => {
    const r = parseRobots("User-agent: *\nDisallow: /a/\nAllow: /a/b/");
    expect(isAllowed(r, "bot", "https://x.vn/a/c")).toBe(false);
    expect(isAllowed(r, "bot", "https://x.vn/a/b/c")).toBe(true);
  });

  test("nhóm User-agent riêng thắng nhóm *", () => {
    const r = parseRobots("User-agent: *\nDisallow: /\n\nUser-agent: quydinhphapluat\nAllow: /\n");
    expect(isAllowed(r, "quydinhphapluat.vn-bot/0.1", "https://x.vn/a")).toBe(true);
    expect(isAllowed(r, "othersbot", "https://x.vn/a")).toBe(false);
  });

  test("wildcard và neo cuối", () => {
    const r = parseRobots("User-agent: *\nDisallow: /*.pdf$\n");
    expect(isAllowed(r, "bot", "https://x.vn/a/b.pdf")).toBe(false);
    expect(isAllowed(r, "bot", "https://x.vn/a/b.pdf.html")).toBe(true);
  });
});
