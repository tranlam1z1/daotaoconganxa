/**
 * Kiểm thử endpoint tra cứu văn bản trên Postgres THẬT.
 * Dùng dữ liệu mẫu của packages/db/src/seed.ts, chỉ đọc, không xóa.
 */
import { beforeAll, describe, expect, test } from "bun:test";
import {
  AS_OF_SAU,
  AS_OF_TRUOC,
  ensureSeed,
  URN_GOC,
  URN_SUA,
} from "../../../packages/search/src/testing.ts";
import { createApp } from "./app.ts";

const app = createApp();
const E = encodeURIComponent;

async function get(path: string): Promise<{ status: number; body: any }> {
  const res = await app.request(`http://test${path}`);
  return { status: res.status, body: await res.json() };
}

beforeAll(async () => {
  await ensureSeed();
});

describe("GET /health", () => {
  test("trả trạng thái ok và thông tin cấu hình", async () => {
    const { status, body } = await get("/health");
    expect(status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.db).toBe("ok");
    expect(body.embedding.mode).toBe("local");
    expect(["mock", "anthropic"]).toContain(body.llm);
  });
});

describe("xử lý lỗi thống nhất", () => {
  test("endpoint không tồn tại trả 404 có mã lỗi tiếng Việt", async () => {
    const { status, body } = await get("/v1/khong-co-endpoint-nay");
    expect(status).toBe(404);
    expect(body.error.code).toBe("khong_tim_thay");
    expect(typeof body.error.message).toBe("string");
  });

  test("tham số sai kiểu trả 400 kèm chi tiết", async () => {
    const { status, body } = await get(`/v1/documents/${E(URN_GOC)}/content?asOf=01-01-2026`);
    expect(status).toBe(400);
    expect(body.error.code).toBe("tham_so_khong_hop_le");
    expect(Array.isArray(body.error.details)).toBe(true);
  });

  test("URN không hợp lệ trả 400", async () => {
    const { status, body } = await get(`/v1/documents/${E("khong-phai-urn")}`);
    expect(status).toBe(400);
    expect(body.error.code).toBe("tham_so_khong_hop_le");
  });

  test("văn bản không tồn tại trả 404", async () => {
    const { status, body } = await get(`/v1/documents/${E("vn:vbqppl:nd:999/2099/NĐ-CP")}`);
    expect(status).toBe(404);
    expect(body.error.code).toBe("khong_tim_thay");
  });
});

describe("GET /v1/documents/by-slug/:docType/:slug", () => {
  test("trả URN thật của văn bản ở đường dẫn web", async () => {
    const { status, body } = await get("/v1/documents/by-slug/nd/100-2026-nd-cp");
    expect(status).toBe(200);
    expect(body.urn).toBe(URN_GOC);
  });

  test("đường dẫn không ứng với văn bản nào trả 404", async () => {
    const { status, body } = await get("/v1/documents/by-slug/nd/999-2099-nd-cp");
    expect(status).toBe(404);
    expect(body.error.code).toBe("khong_tim_thay");
  });
});

describe("GET /v1/documents", () => {
  test("phân trang và facet counts", async () => {
    const { status, body } = await get("/v1/documents?limit=1&page=1");
    expect(status).toBe(200);
    expect(body.items.length).toBe(1);
    expect(body.total).toBeGreaterThanOrEqual(2);
    expect(body.pages).toBeGreaterThanOrEqual(2);
    expect(body.facets.docType.some((f: any) => f.value === "nd" && f.label === "Nghị định")).toBe(true);
    expect(body.facets.status.every((f: any) => typeof f.label === "string")).toBe(true);
    expect(body.facets.field.some((f: any) => f.value === "CNTT.DT")).toBe(true);
  });

  test("lọc theo q khớp cả có dấu lẫn không dấu", async () => {
    const codau = await get(`/v1/documents?q=${E("thử nghiệm")}`);
    expect(codau.body.items.some((d: any) => d.urn === URN_GOC)).toBe(true);
    const khongdau = await get(`/v1/documents?q=${E("thu nghiem")}`);
    expect(khongdau.body.items.some((d: any) => d.urn === URN_GOC)).toBe(true);
  });

  test("lọc status theo asOf dùng document_versions.status", async () => {
    // Đúng yêu cầu nghiệp vụ: 100/2026 CÓ trong danh sách "còn hiệu lực" ở 2026-06-01
    // nhưng KHÔNG có ở 2027-08-01 (khi đó đã hết hiệu lực một phần).
    const truoc = await get(`/v1/documents?status=con_hieu_luc&asOf=${AS_OF_TRUOC}`);
    expect(truoc.status).toBe(200);
    expect(truoc.body.asOf).toBe(AS_OF_TRUOC);
    expect(truoc.body.items.some((d: any) => d.urn === URN_GOC)).toBe(true);

    const sau = await get(`/v1/documents?status=con_hieu_luc&asOf=${AS_OF_SAU}`);
    expect(sau.body.items.some((d: any) => d.urn === URN_GOC)).toBe(false);
    // Văn bản sửa đổi thì ngược lại: chưa hiệu lực ở 2026, còn hiệu lực ở 2027.
    expect(sau.body.items.some((d: any) => d.urn === URN_SUA)).toBe(true);
    expect(truoc.body.items.some((d: any) => d.urn === URN_SUA)).toBe(false);

    const motPhan = await get(`/v1/documents?status=het_hieu_luc_mot_phan&asOf=${AS_OF_SAU}`);
    expect(motPhan.body.items.some((d: any) => d.urn === URN_GOC)).toBe(true);
  });

  test("văn bản chưa hiệu lực được nhận diện đúng tại thời điểm trước ngày hiệu lực", async () => {
    const { body } = await get(`/v1/documents?status=chua_hieu_luc&asOf=2026-01-01`);
    expect(body.items.some((d: any) => d.urn === URN_GOC)).toBe(true);
    const item = body.items.find((d: any) => d.urn === URN_GOC);
    expect(item.statusAsOf).toBe("chua_hieu_luc");
    expect(item.statusAsOfLabel).toBe("Chưa có hiệu lực");
  });

  test("facet trạng thái đếm theo trạng thái tại asOf", async () => {
    const { body } = await get(`/v1/documents?asOf=${AS_OF_TRUOC}&limit=100`);
    const facet = body.facets.status;
    expect(facet.some((f: any) => f.value === "con_hieu_luc")).toBe(true);
    // Tổng các facet phải bằng tổng số văn bản khớp bộ lọc.
    const tong = facet.reduce((a: number, f: any) => a + f.count, 0);
    expect(tong).toBe(body.total);
    // Mỗi mục trong trang phải rơi đúng vào một giá trị facet.
    for (const item of body.items) {
      expect(facet.some((f: any) => f.value === item.statusAsOf)).toBe(true);
    }
  });

  test("sort=moi_nhat xếp theo ngày ban hành giảm dần", async () => {
    const { status, body } = await get("/v1/documents?sort=moi_nhat&limit=100");
    expect(status).toBe(200);
    const ngay: string[] = body.items.map((d: any) => d.issuedDate).filter(Boolean);
    expect(ngay.length).toBeGreaterThanOrEqual(2);
    expect(ngay).toEqual([...ngay].sort().reverse());
    const sai = await get("/v1/documents?sort=khong-co");
    expect(sai.status).toBe(400);
  });

  test("lọc theo docType và field", async () => {
    const khong = await get("/v1/documents?docType=tt");
    expect(khong.body.items.every((d: any) => d.docType === "tt")).toBe(true);
    const co = await get("/v1/documents?docType=nd&field=CNTT.DT");
    expect(co.body.total).toBeGreaterThanOrEqual(2);
    expect(co.body.items.every((d: any) => d.fields.includes("CNTT.DT"))).toBe(true);
  });
});

describe("GET /v1/documents/:urn", () => {
  test("metadata + danh sách phiên bản + trạng thái", async () => {
    const { status, body } = await get(`/v1/documents/${E(URN_GOC)}`);
    expect(status).toBe(200);
    expect(body.document.urn).toBe(URN_GOC);
    expect(body.document.docTypeName).toBe("Nghị định");
    expect(typeof body.document.statusLabel).toBe("string");
    expect(body.versions.length).toBeGreaterThanOrEqual(2);
    expect(body.versions[0].kind).toBe("original");
    // `status` (ảnh chụp) do pipeline ghi, không khẳng định giá trị cụ thể; chỉ cần còn trường.
    expect(typeof body.document.status).toBe("string");
    expect(body.versions.some((v: any) => v.kind === "consolidated_auto")).toBe(true);
    expect(body.amendmentOps.approved).toBeGreaterThan(0);
  });
});

describe("GET /v1/documents/:urn — statusAsOf", () => {
  test("trả statusAsOf theo tham số asOf, giữ nguyên status cũ", async () => {
    const truoc = await get(`/v1/documents/${E(URN_GOC)}?asOf=${AS_OF_TRUOC}`);
    expect(truoc.body.asOf).toBe(AS_OF_TRUOC);
    expect(truoc.body.document.statusAsOf).toBe("con_hieu_luc");
    expect(truoc.body.document.statusAsOfLabel).toBe("Còn hiệu lực");
    // Trường `status` cũ vẫn còn để không phá vỡ client đang có.
    expect(typeof truoc.body.document.status).toBe("string");

    const sau = await get(`/v1/documents/${E(URN_GOC)}?asOf=${AS_OF_SAU}`);
    expect(sau.body.document.statusAsOf).toBe("het_hieu_luc_mot_phan");

    const chua = await get(`/v1/documents/${E(URN_GOC)}?asOf=2026-01-01`);
    expect(chua.body.document.statusAsOf).toBe("chua_hieu_luc");
  });
});

describe("GET /v1/documents/:urn/content", () => {
  test("nội dung tại hai thời điểm KHÁC NHAU sau khi hợp nhất", async () => {
    const truoc = await get(`/v1/documents/${E(URN_GOC)}/content?asOf=${AS_OF_TRUOC}&format=md`);
    const sau = await get(`/v1/documents/${E(URN_GOC)}/content?asOf=${AS_OF_SAU}&format=md`);
    expect(truoc.status).toBe(200);
    expect(sau.status).toBe(200);
    expect(truoc.body.markdown).not.toBe(sau.body.markdown);

    // Trước 2027-07-01: chưa có nội dung sửa đổi, chưa có Điều 3a.
    expect(truoc.body.markdown).not.toContain("gửi lấy ý kiến");
    expect(truoc.body.markdown).not.toContain("Điều 3a");
    expect(truoc.body.versionKind).toBe("original");
    expect(truoc.body.statusAsOf).toBe("con_hieu_luc");
    expect(truoc.body.statusAsOfLabel).toBe("Còn hiệu lực");
    expect(truoc.body.appliedOps.length).toBe(0);
    expect(truoc.body.footnotes.length).toBe(0);

    // Sau 2027-07-01: có nội dung sửa đổi, Điều 3a, khoản 4 và điểm c bị bãi bỏ.
    expect(sau.body.markdown).toContain("gửi lấy ý kiến");
    expect(sau.body.markdown).toContain("Điều 3a");
    expect(sau.body.markdown).toContain("được bãi bỏ");
    expect(sau.body.versionKind).toBe("consolidated_auto");
    expect(sau.body.versionKindLabel).toBe("Bản hợp nhất tự động");
    expect(sau.body.statusAsOf).toBe("het_hieu_luc_mot_phan");
    expect(sau.body.appliedOps.length).toBeGreaterThan(0);
  });

  test("trả footnotes chú thích hợp nhất", async () => {
    const { body } = await get(`/v1/documents/${E(URN_GOC)}/content?asOf=${AS_OF_SAU}`);
    expect(body.footnotes.length).toBeGreaterThan(0);
    const fn = body.footnotes[0];
    expect(fn.index).toBe(1);
    expect(typeof fn.note).toBe("string");
    expect(fn.note).toContain("Nghị định");
    // Số thứ tự footnote phải khớp với marker [^n] trong Markdown.
    expect(body.markdown).toContain(`[^${body.footnotes.length}]:`);
  });

  test("không nuốt xung đột: trường conflicts luôn có mặt", async () => {
    const { body } = await get(`/v1/documents/${E(URN_GOC)}/content?asOf=${AS_OF_SAU}`);
    expect(Array.isArray(body.conflicts)).toBe(true);
    expect(body.conflicts.length).toBe(0);
  });

  test("format=json trả cây cấu trúc", async () => {
    const { body } = await get(`/v1/documents/${E(URN_GOC)}/content?asOf=${AS_OF_SAU}&format=json`);
    expect(body.format).toBe("json");
    expect(body.tree.kind).toBe("van_ban");
    expect(Array.isArray(body.tree.children)).toBe(true);
    expect(body.markdown).toBeUndefined();
  });

  test("mặc định asOf là hôm nay", async () => {
    const { body } = await get(`/v1/documents/${E(URN_GOC)}/content`);
    expect(body.asOf).toBe(new Date().toISOString().slice(0, 10));
  });
});

describe("GET /v1/documents/:urn/relations", () => {
  test("nhóm theo chiều và có nhãn tiếng Việt", async () => {
    const { status, body } = await get(`/v1/documents/${E(URN_GOC)}/relations`);
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThan(0);
    const anhHuong = body.groups.find((g: any) => g.group === "anh_huong");
    expect(anhHuong.label).toBe("Văn bản ảnh hưởng liên quan");
    expect(anhHuong.items.length).toBeGreaterThan(0);
    const item = anhHuong.items.find((i: any) => i.otherDocUrn === URN_SUA);
    expect(item).toBeDefined();
    expect(item.label).toMatch(/sửa đổi/i);
    expect(["out", "in"]).toContain(item.direction);
    expect(body.groups.map((g: any) => g.group)).toEqual(["van_ban_cha", "van_ban_con", "anh_huong", "khac"]);
  });
});

describe("GET /v1/documents/:urn/versions và /diff", () => {
  test("versions kèm lý do thay đổi", async () => {
    const { body } = await get(`/v1/documents/${E(URN_GOC)}/versions`);
    expect(body.versions.length).toBeGreaterThanOrEqual(2);
    const hopNhat = body.versions.find((v: any) => v.kind === "consolidated_auto");
    expect(hopNhat.causedBy).toContain(URN_SUA);
  });

  test("diff giữa hai thời điểm cho đúng thay đổi", async () => {
    const { status, body } = await get(
      `/v1/documents/${E(URN_GOC)}/diff?from=${AS_OF_TRUOC}&to=${AS_OF_SAU}`,
    );
    expect(status).toBe(200);
    expect(body.summary.added).toBeGreaterThan(0);
    expect(body.summary.modified).toBeGreaterThan(0);
    const k1 = body.diffs.find((d: any) => d.path === "dieu-3.khoan-1");
    expect(k1.change).toBe("modified");
    expect(k1.after).toContain("gửi lấy ý kiến");
    const diemC = body.diffs.find((d: any) => d.path === "dieu-1.khoan-2.diem-c");
    expect(diemC.statusAfter).toBe("repealed");
    expect(body.diffs.some((d: any) => d.path.startsWith("dieu-3a") && d.change === "added")).toBe(true);
  });

  test("from > to trả 400", async () => {
    const { status, body } = await get(`/v1/documents/${E(URN_GOC)}/diff?from=2027-08-01&to=2026-06-01`);
    expect(status).toBe(400);
    expect(body.error.message).toContain("from");
  });
});

describe("GET /v1/nodes/:urn", () => {
  test("trả nút kèm lịch sử sửa đổi", async () => {
    const urn = `${URN_GOC}#dieu-3.khoan-1`;
    const { status, body } = await get(`/v1/nodes/${E(urn)}?asOf=${AS_OF_TRUOC}`);
    expect(status).toBe(200);
    expect(body.node.path).toBe("dieu-3.khoan-1");
    expect(body.node.text).toBe("Cơ quan chủ trì lập kế hoạch thử nghiệm.");
    expect(body.node.statusLabel).toBe("Đang áp dụng");
    expect(body.version.kind).toBe("original");
    expect(body.history.length).toBeGreaterThan(0);
    expect(body.history[0].op).toBe("replace");
    expect(body.history[0].opLabel).toContain("Sửa đổi");
    expect(body.history[0].payload.text).toContain("gửi lấy ý kiến");
    expect(body.timeline.length).toBeGreaterThanOrEqual(2);
  });

  test("cùng nút ở thời điểm sau có nội dung đã sửa đổi", async () => {
    const urn = `${URN_GOC}#dieu-3.khoan-1`;
    const { body } = await get(`/v1/nodes/${E(urn)}?asOf=${AS_OF_SAU}`);
    expect(body.node.text).toContain("gửi lấy ý kiến");
    expect(body.node.status).toBe("amended");
    expect(body.version.kind).toBe("consolidated_auto");
  });

  test("URN thiếu #path trả 400", async () => {
    const { status } = await get(`/v1/nodes/${E(URN_GOC)}`);
    expect(status).toBe(400);
  });

  test("nút không tồn tại trả 404", async () => {
    const { status } = await get(`/v1/nodes/${E(`${URN_GOC}#dieu-999`)}`);
    expect(status).toBe(404);
  });
});
