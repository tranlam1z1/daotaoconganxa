/** Kiểm thử endpoint GET /v1/search và POST /v1/citations/resolve trên Postgres thật. */
import { beforeAll, describe, expect, test } from "bun:test";
import {
  AS_OF_SAU,
  AS_OF_TRUOC,
  ensureIndexed,
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

async function post(path: string, payload: unknown): Promise<{ status: number; body: any }> {
  const res = await app.request(`http://test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json() };
}

beforeAll(async () => {
  await ensureIndexed();
});

describe("GET /v1/search", () => {
  test("thiếu q trả 400", async () => {
    const { status, body } = await get("/v1/search");
    expect(status).toBe(400);
    expect(body.error.code).toBe("tham_so_khong_hop_le");
  });

  test("trả đúng nút cho truy vấn từ khóa, có nhãn tiếng Việt", async () => {
    const { status, body } = await get(`/v1/search?q=${E("thẩm định kế hoạch")}&asOf=${AS_OF_TRUOC}`);
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThan(0);
    const hit = body.hits[0];
    expect(hit.docUrn).toBe(URN_GOC);
    expect(hit.docTypeName).toBe("Nghị định");
    expect(hit.nodeStatusLabel).toBe("Đang áp dụng");
    expect(hit.versionKindLabel).toBe("Bản gốc");
    expect(hit.snippet).toContain("<mark>");
    expect(hit.urn).toStartWith(`${URN_GOC}#`);
  });

  test("phân trang", async () => {
    const p1 = await get(`/v1/search?q=${E("kế hoạch")}&asOf=${AS_OF_TRUOC}&limit=2&page=1`);
    const p2 = await get(`/v1/search?q=${E("kế hoạch")}&asOf=${AS_OF_TRUOC}&limit=2&page=2`);
    expect(p1.body.hits.length).toBeLessThanOrEqual(2);
    expect(p1.body.total).toBe(p2.body.total);
    const urns1 = p1.body.hits.map((h: any) => h.urn);
    const urns2 = p2.body.hits.map((h: any) => h.urn);
    expect(urns1.some((u: string) => urns2.includes(u))).toBe(false);
  });

  test("lọc asOf loại phiên bản chưa hiệu lực", async () => {
    const truoc = await get(`/v1/search?q=${E("gửi lấy ý kiến")}&asOf=${AS_OF_TRUOC}`);
    expect(truoc.body.hits.some((h: any) => h.text.includes("gửi lấy ý kiến"))).toBe(false);
    expect(truoc.body.hits.some((h: any) => h.docUrn === URN_SUA)).toBe(false);

    const sau = await get(`/v1/search?q=${E("gửi lấy ý kiến")}&asOf=${AS_OF_SAU}`);
    expect(sau.body.hits.some((h: any) => h.text.includes("gửi lấy ý kiến"))).toBe(true);
  });

  test("includeRepealed=true hiện nút đã bãi bỏ", async () => {
    const macDinh = await get(`/v1/search?q=${E("Tổ chức, cá nhân có liên quan")}&asOf=${AS_OF_SAU}`);
    expect(macDinh.body.hits.some((h: any) => h.path === "dieu-1.khoan-2.diem-c")).toBe(false);
    const gom = await get(
      `/v1/search?q=${E("Tổ chức, cá nhân có liên quan")}&asOf=${AS_OF_SAU}&includeRepealed=true`,
    );
    const diemC = gom.body.hits.find((h: any) => h.path === "dieu-1.khoan-2.diem-c");
    expect(diemC).toBeDefined();
    expect(diemC.nodeStatusLabel).toBe("Đã bị bãi bỏ");
  });

  test("viện dẫn đưa đúng nút lên đầu kết quả", async () => {
    const { body } = await get(
      `/v1/search?q=${E("khoản 1 Điều 3 Nghị định 100/2026/NĐ-CP")}&asOf=${AS_OF_TRUOC}`,
    );
    expect(body.citations.length).toBeGreaterThan(0);
    expect(body.citations[0].found).toBe(true);
    expect(body.citations[0].urn).toBe(`${URN_GOC}#dieu-3.khoan-1`);
    expect(body.hits[0].path).toBe("dieu-3.khoan-1");
    expect(body.hits[0].matchedBy).toContain("citation");
  });

  test("bộ lọc docType / kind / rankMax", async () => {
    const tt = await get(`/v1/search?q=${E("kế hoạch")}&asOf=${AS_OF_TRUOC}&docType=tt`);
    expect(tt.body.hits.every((h: any) => h.docType === "tt")).toBe(true);
    expect(tt.body.hits.some((h: any) => h.docUrn === URN_GOC)).toBe(false);
    const dieu = await get(`/v1/search?q=${E("kế hoạch thử nghiệm")}&asOf=${AS_OF_TRUOC}&kind=dieu`);
    expect(dieu.body.hits.every((h: any) => h.kind === "dieu")).toBe(true);
    const luat = await get(`/v1/search?q=${E("kế hoạch")}&asOf=${AS_OF_TRUOC}&rankMax=20`);
    expect(luat.body.hits.every((h: any) => h.rank <= 20)).toBe(true);
    expect(luat.body.hits.some((h: any) => h.docUrn === URN_GOC)).toBe(false);
  });

  test("lọc status theo asOf: con_hieu_luc loại đúng văn bản đã bị sửa đổi", async () => {
    const truoc = await get(
      `/v1/search?q=${E("kế hoạch thử nghiệm")}&asOf=${AS_OF_TRUOC}&status=con_hieu_luc`,
    );
    expect(truoc.body.hits.some((h: any) => h.docUrn === URN_GOC)).toBe(true);

    const sau = await get(`/v1/search?q=${E("kế hoạch thử nghiệm")}&asOf=${AS_OF_SAU}&status=con_hieu_luc`);
    expect(sau.body.hits.some((h: any) => h.docUrn === URN_GOC)).toBe(false);
  });

  test("hit trả cả docStatus (ảnh chụp) lẫn docStatusAsOf (theo thời điểm)", async () => {
    const { body } = await get(`/v1/search?q=${E("kế hoạch thử nghiệm")}&asOf=${AS_OF_TRUOC}`);
    const hit = body.hits.find((h: any) => h.docUrn === URN_GOC);
    expect(typeof hit.docStatus).toBe("string");
    expect(hit.docStatusAsOf).toBe("con_hieu_luc");
    expect(hit.docStatusAsOfLabel).toBe("Còn hiệu lực");
  });

  test("báo cáo thời gian từng tầng truy xuất", async () => {
    const { body } = await get(`/v1/search?q=${E("kế hoạch thử nghiệm")}&asOf=${AS_OF_TRUOC}`);
    expect(typeof body.timings.bm25).toBe("number");
    expect(typeof body.timings.vector).toBe("number");
    expect(body.warnings).toEqual([]);
  });
});

describe("POST /v1/citations/resolve", () => {
  test("phân giải viện dẫn thành URN và kiểm tra tồn tại", async () => {
    const { status, body } = await post("/v1/citations/resolve", {
      text: "Theo khoản 1 Điều 3 Nghị định số 100/2026/NĐ-CP thì cơ quan chủ trì lập kế hoạch.",
      asOf: AS_OF_TRUOC,
    });
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThan(0);
    const item = body.items.find((i: any) => i.soKyHieu === "100/2026/NĐ-CP");
    expect(item.urn).toBe(`${URN_GOC}#dieu-3.khoan-1`);
    expect(item.existsInDb).toBe(true);
    expect(item.nodeFound).toBe(true);
    expect(item.effectiveAsOf).toBe(true);
    expect(item.display).toContain("Nghị định số 100/2026/NĐ-CP");
  });

  test("viện dẫn tới văn bản không có trong CSDL được đánh dấu existsInDb=false", async () => {
    const { body } = await post("/v1/citations/resolve", {
      text: "Điều 99 Nghị định số 999/2099/NĐ-CP",
      asOf: AS_OF_TRUOC,
    });
    const item = body.items[0];
    expect(item.urn).toBe("vn:vbqppl:nd:999/2099/NĐ-CP#dieu-99");
    expect(item.existsInDb).toBe(false);
    expect(item.effectiveAsOf).toBe(false);
  });

  test("nút bị bãi bỏ báo effectiveAsOf=false", async () => {
    const { body } = await post("/v1/citations/resolve", {
      text: "điểm c khoản 2 Điều 1 Nghị định số 100/2026/NĐ-CP",
      asOf: AS_OF_SAU,
    });
    const item = body.items[0];
    expect(item.nodeFound).toBe(true);
    expect(item.nodeStatus).toBe("repealed");
    expect(item.effectiveAsOf).toBe(false);
  });

  test("thiếu text trả 400", async () => {
    const { status, body } = await post("/v1/citations/resolve", {});
    expect(status).toBe(400);
    expect(body.error.code).toBe("tham_so_khong_hop_le");
  });

  test("body không phải JSON trả 400", async () => {
    const res = await app.request("http://test/v1/citations/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "khong-phai-json",
    });
    expect(res.status).toBe(400);
  });
});
