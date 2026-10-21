/**
 * Kiểm thử tìm kiếm lai trên Postgres THẬT (không mock).
 * Dùng dữ liệu mẫu do packages/db/src/seed.ts nạp; không xóa dữ liệu chung.
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "@qdpl/db";
import { coSoKyHieu, indexVersion, retrieveForAsk, search } from "./index.ts";
import { AS_OF_SAU, AS_OF_TRUOC, ensureIndexed, ensureSeed, URN_GOC, URN_SUA } from "./testing.ts";

beforeAll(async () => {
  await ensureSeed();
  await ensureIndexed();
});

describe("search — tầng từ khóa", () => {
  test("trả đúng nút cho truy vấn từ khóa", async () => {
    const res = await search({ q: "thẩm định kế hoạch thử nghiệm", asOf: AS_OF_TRUOC, limit: 10 });
    expect(res.hits.length).toBeGreaterThan(0);
    expect(res.hits.some((h) => h.docUrn === URN_GOC)).toBe(true);
    // Điều 4 "Thẩm định kế hoạch" phải nằm trong top 5.
    const top5 = res.hits.slice(0, 5).map((h) => h.path);
    expect(top5.some((p) => p.startsWith("dieu-4"))).toBe(true);
  });

  test("truy vấn không dấu vẫn khớp nhờ cấu hình vietnamese (unaccent)", async () => {
    const res = await search({ q: "tham dinh ke hoach", asOf: AS_OF_TRUOC, limit: 10 });
    expect(res.hits.length).toBeGreaterThan(0);
    expect(res.hits.some((h) => h.path.startsWith("dieu-4"))).toBe(true);
  });

  test("truy vấn gõ sai bắt được nhờ nhánh trigram", async () => {
    const res = await search({ q: "kê hoach thu nghiem", asOf: AS_OF_TRUOC, limit: 10 });
    expect(res.hits.length).toBeGreaterThan(0);
  });

  test("có đoạn trích được đánh dấu <mark>", async () => {
    const res = await search({ q: "kế hoạch thử nghiệm", asOf: AS_OF_TRUOC, limit: 5 });
    expect(res.hits[0]!.snippet).toContain("<mark>");
  });

  test("đoạn trích không tô chữ chỉ trùng sau khi bỏ dấu", async () => {
    const res = await search({ q: "kể hoạch thử nghiệm", asOf: AS_OF_TRUOC, limit: 20 });
    const trich = res.hits.map((h) => h.snippet).join(" ");
    expect(trich).toContain("<mark>hoạch</mark>");
    expect(trich).not.toMatch(/<mark>kế<\/mark>/i);
  });

  test("tầng nào tìm ra được ghi lại trong matchedBy", async () => {
    const res = await search({ q: "kế hoạch thử nghiệm", asOf: AS_OF_TRUOC, limit: 5 });
    expect(res.hits[0]!.matchedBy.length).toBeGreaterThan(0);
    expect(res.timings.bm25).toBeGreaterThanOrEqual(0);
  });
});

describe("search — bậc khớp", () => {
  test("coSoKyHieu: không phân biệt dấu, hoa thường; không khớp mảnh số", () => {
    expect(coSoKyHieu("36/2024/QH15", "36/2024/QH15")).toBe(true);
    expect(coSoKyHieu("nghị định 100/2026/nd-cp quy định gì", "100/2026/NĐ-CP")).toBe(true);
    expect(coSoKyHieu("136/2024/QH15", "36/2024/QH15")).toBe(false);
    expect(coSoKyHieu("phạt nồng độ cồn", "36/2024/QH15")).toBe(false);
  });

  test("gõ đúng số ký hiệu: văn bản mang số đó đứng đầu", async () => {
    const res = await search({ q: "100/2026/NĐ-CP", asOf: AS_OF_SAU, limit: 10 });
    expect(res.hits[0]!.docUrn).toBe(URN_GOC);
  });

  test("nút chứa nguyên cụm từ đứng trước nút chỉ khớp từ lẻ", async () => {
    const res = await search({ q: "kế hoạch thử nghiệm", asOf: AS_OF_TRUOC, limit: 50 });
    const coCum = res.hits.map((h) =>
      `${h.heading ?? ""} ${h.text}`.toLowerCase().includes("kế hoạch thử nghiệm"),
    );
    expect(coCum[0]).toBe(true);
    // Sau nút đầu tiên không chứa cụm thì không còn nút nào chứa cụm.
    expect(coCum.slice(coCum.indexOf(false)).includes(true)).toBe(coCum.indexOf(false) < 0);
  });

  test("dropLooseMatches: bỏ nút chỉ khớp từ lẻ, giữ nút đủ từ; gõ sai vẫn còn kết quả", async () => {
    const q = "thẩm định kế hoạch";
    const het = await search({ q, asOf: AS_OF_TRUOC, limit: 100 });
    const gon = await search({ q, asOf: AS_OF_TRUOC, limit: 100, dropLooseMatches: true });
    const giu = new Set(gon.hits.map((h) => h.urn));
    expect(gon.hits.length).toBeGreaterThan(0);
    expect(gon.hits.length).toBeLessThan(het.hits.length);
    // Nút bị bỏ đều dưới bậc 1 và không giữ nổi nửa cụm liền nhau (0.9 × 0.5 + RRF dưới 0.06).
    expect(het.hits.filter((h) => !giu.has(h.urn)).every((h) => h.score < 0.51)).toBe(true);
    expect(het.hits.filter((h) => h.score >= 1).every((h) => giu.has(h.urn))).toBe(true);
    const sai = await search({
      q: "kê hoach thu nghiem",
      asOf: AS_OF_TRUOC,
      limit: 10,
      dropLooseMatches: true,
    });
    expect(sai.hits.length).toBeGreaterThan(0);
  });
});

describe("search — tầng vector", () => {
  test("có embedding và tầng vector trả kết quả", async () => {
    const res = await search({
      q: "kinh phí thử nghiệm được xác định theo công thức nào",
      asOf: AS_OF_TRUOC,
      limit: 20,
    });
    expect(res.hits.some((h) => h.matchedBy.includes("vector"))).toBe(true);
  });

  test("indexVersion là idempotent (chạy lại không nhân đôi chunk)", async () => {
    const [v] = await sql<Array<{ id: string }>>`
      SELECT v.id FROM document_versions v JOIN documents d ON d.id = v.document_id
      WHERE d.urn = ${URN_GOC} AND v.version_no = 1`;
    const a = await indexVersion(v!.id);
    const b = await indexVersion(v!.id);
    expect(b.chunks).toBe(a.chunks);
    expect(a.chunks).toBeGreaterThan(0);
  });
});

describe("search — lọc theo thời điểm (asOf)", () => {
  test("loại đúng phiên bản chưa có hiệu lực", async () => {
    const truoc = await search({
      q: "gửi lấy ý kiến các cơ quan có liên quan",
      asOf: AS_OF_TRUOC,
      limit: 20,
    });
    // Nội dung sửa đổi (hiệu lực 2027-07-01) không được xuất hiện ở 2026-06-01.
    expect(truoc.hits.some((h) => h.docUrn === URN_GOC && h.text.includes("gửi lấy ý kiến"))).toBe(false);
    // Văn bản sửa đổi 150/2027 cũng chưa hiệu lực tại thời điểm đó.
    expect(truoc.hits.some((h) => h.docUrn === URN_SUA)).toBe(false);

    const sau = await search({ q: "gửi lấy ý kiến các cơ quan có liên quan", asOf: AS_OF_SAU, limit: 20 });
    expect(sau.hits.some((h) => h.docUrn === URN_GOC && h.text.includes("gửi lấy ý kiến"))).toBe(true);
  });

  test("Điều 3a chỉ tồn tại từ 2027-07-01", async () => {
    const truoc = await search({ q: "điều chỉnh kế hoạch thử nghiệm", asOf: AS_OF_TRUOC, limit: 20 });
    expect(truoc.hits.some((h) => h.path.startsWith("dieu-3a"))).toBe(false);
    const sau = await search({ q: "điều chỉnh kế hoạch thử nghiệm", asOf: AS_OF_SAU, limit: 20 });
    expect(sau.hits.some((h) => h.path.startsWith("dieu-3a"))).toBe(true);
  });

  test("nút bị bãi bỏ bị loại trừ mặc định, hiện lại khi includeRepealed", async () => {
    const macDinh = await search({ q: "Tổ chức, cá nhân có liên quan", asOf: AS_OF_SAU, limit: 20 });
    expect(macDinh.hits.some((h) => h.path === "dieu-1.khoan-2.diem-c")).toBe(false);
    const gom = await search({
      q: "Tổ chức, cá nhân có liên quan",
      asOf: AS_OF_SAU,
      includeRepealed: true,
      limit: 20,
    });
    const diemC = gom.hits.find((h) => h.path === "dieu-1.khoan-2.diem-c");
    expect(diemC).toBeDefined();
    expect(diemC!.nodeStatus).toBe("repealed");
  });
});

describe("search — bộ lọc", () => {
  // CSDL dev dùng chung nhiều nhánh nên có thể xuất hiện văn bản khác; khẳng định theo
  // BẤT BIẾN của bộ lọc (mọi kết quả đều thỏa) thay vì theo tổng số tuyệt đối.
  test("docTypes loại văn bản khác", async () => {
    const res = await search({ q: "kế hoạch", asOf: AS_OF_TRUOC, docTypes: ["tt"], limit: 10 });
    expect(res.hits.every((h) => h.docType === "tt")).toBe(true);
    expect(res.hits.some((h) => h.docUrn === URN_GOC)).toBe(false);
  });

  test("rankMax loại văn bản thứ bậc thấp hơn", async () => {
    const res = await search({ q: "kế hoạch", asOf: AS_OF_TRUOC, rankMax: 20, limit: 10 });
    expect(res.hits.every((h) => h.rank <= 20)).toBe(true);
    expect(res.hits.some((h) => h.docUrn === URN_GOC)).toBe(false);
  });

  test("fields và issuer lọc đúng", async () => {
    const co = await search({
      q: "kế hoạch",
      asOf: AS_OF_TRUOC,
      fields: ["CNTT.DT"],
      issuer: "Chính phủ",
      limit: 10,
    });
    expect(co.hits.length).toBeGreaterThan(0);
    const khong = await search({ q: "kế hoạch", asOf: AS_OF_TRUOC, fields: ["KHONG-CO"], limit: 10 });
    expect(khong.hits.length).toBe(0);
    expect(co.hits.every((h) => h.fields.includes("CNTT.DT"))).toBe(true);
  });

  test("status lọc theo TRẠNG THÁI TẠI asOf, không theo documents.status", async () => {
    // documents.status của 100/2026 luôn là "het_hieu_luc_mot_phan" (ảnh chụp hiện tại),
    // nhưng tại 2026-06-01 văn bản còn hiệu lực nguyên vẹn.
    const truoc = await search({
      q: "kế hoạch thử nghiệm",
      asOf: AS_OF_TRUOC,
      status: ["con_hieu_luc"],
      limit: 20,
    });
    expect(truoc.hits.length).toBeGreaterThan(0);
    expect(truoc.hits.some((h) => h.docUrn === URN_GOC)).toBe(true);
    expect(truoc.hits.every((h) => h.docStatusAsOf === "con_hieu_luc")).toBe(true);
    expect(truoc.hits.every((h) => h.matchedBy.length > 0)).toBe(true);

    // Sau khi bị sửa đổi, chính văn bản đó không còn khớp "con_hieu_luc".
    const sau = await search({
      q: "kế hoạch thử nghiệm",
      asOf: AS_OF_SAU,
      status: ["con_hieu_luc"],
      limit: 20,
    });
    expect(sau.hits.some((h) => h.docUrn === URN_GOC)).toBe(false);

    const motPhan = await search({
      q: "kế hoạch thử nghiệm",
      asOf: AS_OF_SAU,
      status: ["het_hieu_luc_mot_phan"],
      limit: 20,
    });
    expect(motPhan.hits.some((h) => h.docUrn === URN_GOC)).toBe(true);
  });

  test("docStatusAsOf tính theo thời điểm, độc lập với ảnh chụp documents.status", async () => {
    // Không khẳng định giá trị của `docStatus` vì đó là cache do pipeline ghi lại,
    // các nhánh khác có thể cập nhật bất cứ lúc nào. Chỉ khẳng định phần mình sở hữu.
    const truoc = await search({ q: "kế hoạch thử nghiệm", asOf: AS_OF_TRUOC, limit: 20 });
    expect(truoc.hits.find((h) => h.docUrn === URN_GOC)!.docStatusAsOf).toBe("con_hieu_luc");

    const sau = await search({
      q: "kế hoạch thử nghiệm",
      asOf: AS_OF_SAU,
      status: ["het_hieu_luc_mot_phan"],
      limit: 20,
    });
    expect(sau.hits.find((h) => h.docUrn === URN_GOC)!.docStatusAsOf).toBe("het_hieu_luc_mot_phan");
  });

  test("kinds giới hạn loại nút", async () => {
    const res = await search({ q: "kế hoạch thử nghiệm", asOf: AS_OF_TRUOC, kinds: ["dieu"], limit: 20 });
    expect(res.hits.length).toBeGreaterThan(0);
    expect(res.hits.every((h) => h.kind === "dieu")).toBe(true);
  });
});

describe("search — khớp viện dẫn", () => {
  test("viện dẫn đưa đúng nút lên đầu", async () => {
    const res = await search({ q: "khoản 1 Điều 3 Nghị định 100/2026/NĐ-CP", asOf: AS_OF_TRUOC, limit: 10 });
    expect(res.citations.length).toBeGreaterThan(0);
    expect(res.citations[0]!.found).toBe(true);
    expect(res.hits[0]!.path).toBe("dieu-3.khoan-1");
    expect(res.hits[0]!.matchedBy).toContain("citation");
    expect(res.hits[0]!.docUrn).toBe(URN_GOC);
  });

  test("viện dẫn cấp điều lấy cả điều lẫn khoản con", async () => {
    const res = await search({ q: "Điều 4 Nghị định số 100/2026/NĐ-CP", asOf: AS_OF_TRUOC, limit: 10 });
    expect(res.hits[0]!.path).toBe("dieu-4");
    expect(res.hits.some((h) => h.path === "dieu-4.khoan-1")).toBe(true);
  });
});

describe("retrieveForAsk", () => {
  test("gộp truy vấn con và mở rộng ngữ cảnh bằng đồ thị", async () => {
    const res = await retrieveForAsk({
      q: "Thời hạn thẩm định kế hoạch thử nghiệm là bao lâu?",
      subQueries: ["thời hạn thẩm định", "cơ quan chuyên môn thẩm định"],
      asOf: AS_OF_SAU,
      topK: 8,
      maxExpand: 10,
    });
    expect(res.hits.length).toBeGreaterThan(0);
    expect(res.hits.some((h) => h.path.startsWith("dieu-4"))).toBe(true);
    // Nút cha cấp điều và văn bản sửa đổi được kéo thêm vào bằng đồ thị quan hệ.
    expect(res.expanded).toBeGreaterThan(0);
    expect(res.hits.some((h) => h.matchedBy.includes("graph"))).toBe(true);
    expect(res.hits.some((h) => h.matchedBy.includes("graph") && h.kind === "dieu")).toBe(true);
    expect(res.hits.length).toBeLessThanOrEqual(8 + 10);
  });

  test("không trả nút của phiên bản chưa hiệu lực", async () => {
    const res = await retrieveForAsk({
      q: "công khai trên cổng thông tin điện tử",
      asOf: AS_OF_TRUOC,
      topK: 10,
    });
    expect(res.hits.every((h) => !h.text.includes("công khai trên cổng thông tin"))).toBe(true);
  });
});
