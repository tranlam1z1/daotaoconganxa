import { describe, expect, test } from "bun:test";
import {
  fieldsFromKeywords,
  parseDetailPage,
  parseSitemap,
  parseSitemapIndex,
} from "../src/crawler/adapters/vbpl.ts";
import { BrowserSession, findChromium } from "../src/crawler/browser.ts";

/**
 * Test mạng chỉ chạy khi bật rõ ràng: VBPL_LIVE_TEST=1.
 * Mặc định CI không gọi ra ngoài để không phụ thuộc mạng và không gây tải cho nguồn.
 */
const LIVE = process.env.VBPL_LIVE_TEST === "1";

describe("phiên trình duyệt", () => {
  test("dò được Chromium hoặc báo rõ là không có", () => {
    const p = findChromium();
    // Không khẳng định có Chromium (máy CI có thể chưa cài), chỉ khẳng định giá trị hợp lệ.
    expect(p === undefined || p.length > 0).toBe(true);
  });

  test("thiếu Chromium thì báo lỗi có hướng dẫn, không im lặng", async () => {
    const s = new BrowserSession({
      warmupUrl: "https://example.invalid/",
      executablePath: "/khong/ton/tai/chrome",
    });
    await expect(s.warmup()).rejects.toThrow(
      /Không tìm thấy Chromium|not found|ENOENT|spawn|Failed to launch/i,
    );
  });
});

describe("phân tích trang vbpl.vn từ HTML đã lưu", () => {
  // HTML rút gọn mô phỏng đúng khối JSON-LD mà máy chủ vbpl.vn render sẵn.
  const html = `<!doctype html><html><head><title>Thông tư 18/2026/TT-BNV | CSDL quốc gia về pháp luật</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Legislation",
"name":"Thông tư số 18/2026/TT-BNV Quy định tặng kỷ niệm chương",
"legislationIdentifier":"18/2026/TT-BNV","legislationType":"Thông tư",
"legislationDate":"2026-08-12T00:00:00","legislationLegalForce":"InForce",
"legislationPassedBy":{"@type":"Organization","name":"Bộ Nội vụ"},
"keywords":"Thông tư, Thi đua, khen thưởng, Bộ Nội vụ, văn bản pháp luật, pháp luật Việt Nam"}</script>
</head><body><div>Đang tải dữ liệu...</div></body></html>`;

  const parsed = parseDetailPage(html);

  test("lấy đúng thuộc tính từ JSON-LD", () => {
    expect(parsed.meta.soKyHieu).toBe("18/2026/TT-BNV");
    expect(parsed.meta.typeName).toBe("Thông tư");
    expect(parsed.meta.issuer).toBe("Bộ Nội vụ");
    expect(parsed.meta.issuedDate).toBe("2026-08-12");
    expect(parsed.meta.sourceStatus).toBe("Còn hiệu lực");
  });

  test("giữ nguyên tên lĩnh vực có dấu phẩy, loại từ khóa rác", () => {
    // "Thi đua, khen thưởng" là MỘT lĩnh vực; tách theo dấu phẩy sẽ làm vỡ tên.
    expect(parsed.meta.fields).toEqual(["Thi đua, khen thưởng"]);
  });

  test("nhận biết trang do client dựng", () => {
    expect(parsed.clientRendered).toBe(true);
  });

  test("tách lĩnh vực từ keywords", () => {
    expect(
      fieldsFromKeywords(
        "Thông tư, Thi đua, khen thưởng, Bộ Nội vụ, văn bản pháp luật, pháp luật Việt Nam",
        "Thông tư",
        "Bộ Nội vụ",
      ),
    ).toEqual(["Thi đua, khen thưởng"]);
    expect(
      fieldsFromKeywords(
        "Nghị định, Công nghệ thông tin, Chính phủ, văn bản pháp luật",
        "Nghị định",
        "Chính phủ",
      ),
    ).toEqual(["Công nghệ thông tin"]);
    // Không còn gì sau khi loại thì trả mảng rỗng, không trả rác.
    expect(fieldsFromKeywords("Thông tư, Bộ Nội vụ, văn bản pháp luật", "Thông tư", "Bộ Nội vụ")).toEqual([]);
    expect(
      fieldsFromKeywords("Luật, Khoa học, công nghệ và đổi mới sáng tạo, Quốc hội", "Luật", "Quốc hội"),
    ).toEqual(["Khoa học, công nghệ và đổi mới sáng tạo"]);
  });

  test("đọc sitemap", () => {
    const idx = parseSitemapIndex(
      `<?xml version="1.0"?><sitemapindex><sitemap><loc>https://vbpl.vn/sitemap-1.xml</loc></sitemap></sitemapindex>`,
    );
    expect(idx).toEqual(["https://vbpl.vn/sitemap-1.xml"]);
    const entries = parseSitemap(
      `<?xml version="1.0"?><urlset><url><loc>https://vbpl.vn/van-ban/chi-tiet/abc--1</loc><lastmod>2026-09-01</lastmod></url></urlset>`,
    );
    expect(entries[0]?.loc).toContain("/van-ban/chi-tiet/");
    expect(entries[0]?.lastmod).toBe("2026-09-01");
  });
});

describe.if(LIVE)("vbpl.vn qua trình duyệt thật (bật bằng VBPL_LIVE_TEST=1)", () => {
  test("vượt tường lửa và lấy được thuộc tính văn bản", async () => {
    const { vbpl } = await import("../src/crawler/adapters/vbpl.ts");
    const { closeAllSessions } = await import("../src/crawler/browser.ts");
    try {
      const items = await vbpl.discover({ limit: 1 });
      expect(items.length).toBeGreaterThan(0);
      const doc = await vbpl.fetchItem(items[0]!.url);
      expect(doc.meta.soKyHieu).toMatch(/^\d+\/\d{4}\//);
      expect(doc.meta.issuer).toBeTruthy();
      expect(doc.meta.issuedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    } finally {
      await closeAllSessions();
    }
  }, 180_000);
});
