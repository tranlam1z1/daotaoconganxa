/**
 * Kiểm thử AI sinh câu hỏi vào ngân hàng (docs/PLAN.md GĐ8) trên Postgres test thật, với
 * LLM_PROVIDER=mock: API tạo việc → worker sinh và hậu kiểm → câu vào `cho_duyet`, `source = ai`.
 *
 * Dữ liệu văn bản là Nghị định 100/2026/NĐ-CP của seed: bản gốc hiệu lực 01/3/2026–01/7/2027,
 * bản sửa đổi từ 01/7/2027 thêm Điều 3a và bãi bỏ điểm c khoản 2 Điều 1.
 */
process.env.LLM_PROVIDER = "mock";
// Việc sinh do test tự chạy từng bước; không để API chạy nền song song.
process.env.SOAN_BAI_TRONG_API = "0";
// Test chạy worker trực tiếp; không đẩy vào Redis để worker thật (nếu đang chạy) không nhận việc.
// Trả lại ở afterAll, vì các tệp test khác chạy chung tiến trình.
const REDIS_GOC = process.env.REDIS_URL;
delete process.env.REDIS_URL;

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession, type Role } from "@qdpl/auth";
import { deBaiDaCoTheoCanCu, luuChuDeCauHoi, nguonCauHoiChoMaTran, sql, vieCSoanBaiTheoId } from "@qdpl/db";
import { chaySinhCauHoi } from "../../workers-ts/src/bull/workers/sinh-cau-hoi.ts";
import { createApp } from "./app.ts";

const app = createApp();

const PREFIX = "test-qdpl-sinh-cau-hoi";
const CHU_DE = `${PREFIX}-chu-de`;
const BASE = "/v1/quan-tri/ngan-hang";
const VB = "vn:vbqppl:nd:100/2026/NĐ-CP";
const NGAY = "2026-09-24";
const DIEU = [1, 2, 3, 4, 5, 6].map((i) => `${VB}#dieu-${i}`);

async function taoTaiKhoan(ten: string, role: Role): Promise<string> {
  const [acc] = await sql<Array<{ id: string }>>`
    INSERT INTO accounts (email, role) VALUES (${`${PREFIX}-${ten}@vidu.vn`}, ${role}) RETURNING id`;
  return (await createSession(acc!.id, "test")).token;
}

async function goi(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const res = await app.request(`http://test${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function donDep() {
  await sql`DELETE FROM questions WHERE topic_id IN (SELECT id FROM question_topics WHERE code LIKE ${`${PREFIX}%`})`;
  await sql`DELETE FROM authoring_jobs WHERE requested_by LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM question_topics WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
}

async function cauCuaViec(jobId: string) {
  return await sql<
    Array<{ id: string; status: string; source: string; level: string; duplicate_of: string | null }>
  >`
    SELECT id, status, source, level, duplicate_of FROM questions
    WHERE authoring_job_id = ${jobId}::uuid ORDER BY code`;
}

/** Tạo việc qua API rồi chạy worker ngay (test không có Redis). */
async function sinhVaChay(token: string, body: Record<string, unknown>) {
  const tao = await goi("POST", `${BASE}/sinh-ai`, { token, body });
  expect(tao.status).toBe(202);
  const viec = await vieCSoanBaiTheoId(tao.body.viec.id);
  expect(viec?.state).toBe("cho");
  const kq = await chaySinhCauHoi(viec!);
  return { jobId: tao.body.viec.id as string, kq };
}

const tk = { canBo: "", bienTap: "", phapChe: "" };
let topicId = "";

beforeAll(async () => {
  await donDep();
  tk.canBo = await taoTaiKhoan("can-bo", "can_bo");
  tk.bienTap = await taoTaiKhoan("bien-tap", "bien_tap");
  tk.phapChe = await taoTaiKhoan("phap-che", "phap_che");
  topicId = (await luuChuDeCauHoi({ code: CHU_DE, name: "Chủ đề thử sinh câu hỏi" })).id;
});

afterAll(async () => {
  await donDep();
  if (REDIS_GOC !== undefined) process.env.REDIS_URL = REDIS_GOC;
});

describe("phân quyền và đầu vào", () => {
  test("chưa đăng nhập nhận 401; cán bộ nhận 403", async () => {
    const body = { urns: [DIEU[1]], chu_de: CHU_DE };
    expect((await goi("POST", `${BASE}/sinh-ai`, { body })).status).toBe(401);
    expect((await goi("POST", `${BASE}/sinh-ai`, { token: tk.canBo, body })).status).toBe(403);
    expect((await goi("GET", `${BASE}/sinh-ai`, { token: tk.canBo })).status).toBe(403);
  });

  test("chạy thử trả điều khoản và ước tính chi phí, không tạo việc", async () => {
    const r = await goi("POST", `${BASE}/sinh-ai`, {
      token: tk.bienTap,
      body: { urns: [DIEU[1], DIEU[4]], chu_de: CHU_DE, so_cau: 5, as_of: NGAY, chay_thu: true },
    });
    expect(r.status).toBe(200);
    expect(r.body.dieu_khoan.map((d: { urn: string }) => d.urn)).toEqual([DIEU[1], DIEU[4]]);
    expect(r.body.uoc_tinh.tokens_in).toBeGreaterThan(0);
    expect(r.body.uoc_tinh.chi_phi_usd).toBeGreaterThan(0);
    const [dem] = await sql<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM authoring_jobs WHERE requested_by LIKE ${`${PREFIX}%`}`;
    expect(dem!.n).toBe(0);
  });

  test("URN văn bản được mở thành các điều của văn bản", async () => {
    const r = await goi("POST", `${BASE}/sinh-ai`, {
      token: tk.bienTap,
      body: { urns: [VB], chu_de: CHU_DE, as_of: NGAY, chay_thu: true },
    });
    expect(r.status).toBe(200);
    expect(r.body.dieu_khoan.length).toBeGreaterThanOrEqual(6);
  });

  test("điều khoản chưa có hiệu lực tại ngày soạn bị từ chối (400)", async () => {
    const r = await goi("POST", `${BASE}/sinh-ai`, {
      token: tk.bienTap,
      body: { urns: [`${VB}#dieu-3a`], chu_de: CHU_DE, as_of: NGAY, chay_thu: true },
    });
    expect(r.status).toBe(400);
  });

  test("điều khoản đã bãi bỏ bị từ chối (400)", async () => {
    const r = await goi("POST", `${BASE}/sinh-ai`, {
      token: tk.bienTap,
      body: { urns: [`${VB}#dieu-1.khoan-2.diem-c`], chu_de: CHU_DE, as_of: "2027-08-01", chay_thu: true },
    });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).toContain("bãi bỏ");
  });

  test("chủ đề không có bị từ chối (400)", async () => {
    const r = await goi("POST", `${BASE}/sinh-ai`, {
      token: tk.bienTap,
      body: { urns: [DIEU[1]], chu_de: `${PREFIX}-khong-co`, chay_thu: true },
    });
    expect(r.status).toBe(400);
  });
});

describe("sinh câu hỏi với LLM_PROVIDER=mock", () => {
  let jobDau = "";

  // 3 câu trên 3 điều có nội dung: mô hình giả lập cho mỗi điều một câu, không câu nào gần giống nhau.
  test("job sinh 3 câu vào cho_duyet với source = ai; chi phí được ghi vào authoring_jobs", async () => {
    const { jobId, kq } = await sinhVaChay(tk.bienTap, {
      urns: DIEU,
      chu_de: CHU_DE,
      so_cau: 3,
      as_of: NGAY,
      loai: ["mot_dap_an", "dung_sai"],
    });
    jobDau = jobId;
    expect(kq.so_nhan).toBe(3);
    expect(kq.so_loai).toBe(0);

    const cau = await cauCuaViec(jobId);
    expect(cau.length).toBe(3);
    expect(cau.every((c) => c.status === "cho_duyet" && c.source === "ai")).toBe(true);

    const [viec] = await sql<
      Array<{
        state: string;
        model: string | null;
        tokens_in: number;
        tokens_out: number;
        cost_usd: string | null;
        output: any;
      }>
    >`SELECT state, model, tokens_in, tokens_out, cost_usd, output FROM authoring_jobs WHERE id = ${jobId}::uuid`;
    expect(viec!.state).toBe("xong");
    expect(viec!.model).toBeTruthy();
    expect(viec!.tokens_in).toBeGreaterThan(0);
    expect(viec!.tokens_out).toBeGreaterThan(0);
    expect(viec!.cost_usd).not.toBeNull();
    expect(viec!.output.so_nhan).toBe(3);
    expect(viec!.output.cau_hoi.length).toBe(3);

    // Lịch sử duyệt ghi rõ câu do AI sinh.
    const [ls] = await sql<Array<{ action: string }>>`
      SELECT action FROM question_reviews WHERE question_id = ${cau[0]!.id}::uuid`;
    expect(ls!.action).toBe("ai_sinh");
  });

  test("tab Chờ duyệt lọc được câu AI, và danh sách việc có số câu", async () => {
    const ds = await goi("GET", `${BASE}/cau-hoi?chu_de=${CHU_DE}&trang_thai=cho_duyet&nguon=ai`, {
      token: tk.bienTap,
    });
    expect(ds.status).toBe(200);
    expect(ds.body.tong).toBe(3);

    const viec = await goi("GET", `${BASE}/sinh-ai`, { token: tk.bienTap });
    const dong = viec.body.items.find((v: { id: string }) => v.id === jobDau);
    expect(dong.so_cau).toBe(3);
    expect(dong.so_cho_duyet).toBe(3);
  });

  test("chạy lại cùng một việc không sinh thêm câu", async () => {
    await sql`UPDATE authoring_jobs SET state = 'cho' WHERE id = ${jobDau}::uuid`;
    await chaySinhCauHoi((await vieCSoanBaiTheoId(jobDau))!);
    expect((await cauCuaViec(jobDau)).length).toBe(3);
  });

  test("câu AI chưa duyệt không được rút vào đề thi; duyệt rồi mới được rút", async () => {
    const maTran = (["de", "trung_binh", "kho"] as const).map((level) => ({
      topic_id: topicId,
      level,
      so_cau: 5,
    }));
    expect(await nguonCauHoiChoMaTran(maTran)).toEqual([]);

    const [dau] = await cauCuaViec(jobDau);
    const duyet = await goi("POST", `${BASE}/cau-hoi/${dau!.id}/duyet`, { token: tk.phapChe });
    expect(duyet.status).toBe(200);
    expect((await nguonCauHoiChoMaTran(maTran)).map((c) => c.id)).toEqual([dau!.id]);
  });

  test("sinh lại trên cùng điều khoản: mô hình được xem câu đã có, câu vẫn trùng bị loại", async () => {
    // Đề bài của lượt đầu là thứ lượt sau đưa vào mục CÂU ĐÃ CÓ của prompt.
    const daCo = await deBaiDaCoTheoCanCu(DIEU);
    const [dau] = await sql<Array<{ stem: string }>>`
      SELECT stem FROM questions WHERE authoring_job_id = ${jobDau}::uuid LIMIT 1`;
    expect(daCo).toContain(dau!.stem);
    expect(await deBaiDaCoTheoCanCu([`${VB}#dieu-99`])).not.toContain(dau!.stem);

    // Mô hình giả lập không đọc mục đó nên trả lại đúng các câu cũ: hậu kiểm loại hết.
    const { jobId, kq } = await sinhVaChay(tk.bienTap, {
      urns: DIEU,
      chu_de: CHU_DE,
      so_cau: 3,
      as_of: NGAY,
      loai: ["mot_dap_an", "dung_sai"],
    });
    expect(kq.so_nhan).toBe(0);
    expect(kq.so_loai_trung).toBe(3);
    expect((await cauCuaViec(jobId)).length).toBe(0);

    const [viec] = await sql<Array<{ state: string; output: any }>>`
      SELECT state, output FROM authoring_jobs WHERE id = ${jobId}::uuid`;
    expect(viec!.state).toBe("xong");
    expect(viec!.output.so_loai_trung).toBe(3);
    expect(viec!.output.bi_loai[0].ly_do[0]).toMatch(/^Gần giống câu CH-\d+ trong ngân hàng$/);
  });

  test("ước tính vượt trần chi phí thì biên tập viên nhận 403, pháp chế tạo được", async () => {
    const cu = process.env.NGAN_HANG_AI_TRAN_USD;
    process.env.NGAN_HANG_AI_TRAN_USD = "0";
    try {
      const body = { urns: [DIEU[1]], chu_de: CHU_DE, so_cau: 1, as_of: NGAY };
      expect((await goi("POST", `${BASE}/sinh-ai`, { token: tk.bienTap, body })).status).toBe(403);
      expect((await goi("POST", `${BASE}/sinh-ai`, { token: tk.phapChe, body })).status).toBe(202);
    } finally {
      if (cu === undefined) delete process.env.NGAN_HANG_AI_TRAN_USD;
      else process.env.NGAN_HANG_AI_TRAN_USD = cu;
    }
  });
});

describe("chạy tiếp một lượt sinh", () => {
  test("việc còn chờ được chạy trong API tới khi xong; việc đã xong thì không chạy lại", async () => {
    const tao = await goi("POST", `${BASE}/sinh-ai`, {
      token: tk.bienTap,
      body: { urns: [DIEU[1]], chu_de: CHU_DE, so_cau: 2, as_of: NGAY },
    });
    expect(tao.body.che_do).toBe("cho");
    const duong = `${BASE}/sinh-ai/${tao.body.viec.id}/chay-tiep`;
    expect((await goi("POST", duong, { token: tk.canBo })).status).toBe(403);
    expect(
      (await goi("POST", `${BASE}/sinh-ai/khong-phai-uuid/chay-tiep`, { token: tk.bienTap })).status,
    ).toBe(404);

    expect((await goi("POST", duong, { token: tk.bienTap })).body.da_chay).toBe(true);
    let state: string | undefined;
    for (let i = 0; i < 100 && state !== "xong" && state !== "loi"; i++) {
      await new Promise((r) => setTimeout(r, 100));
      state = (await vieCSoanBaiTheoId(tao.body.viec.id))?.state;
    }
    expect(state).toBe("xong");
    expect((await goi("POST", duong, { token: tk.bienTap })).body.da_chay).toBe(false);
  });
});

describe("máy chủ không có dịch vụ AI", () => {
  test("LLM_PROVIDER=none: từ chối sinh câu hỏi, không tạo việc cho bộ giả lập chạy", async () => {
    const cu = process.env.LLM_PROVIDER;
    process.env.LLM_PROVIDER = "none";
    try {
      const r = await goi("POST", `${BASE}/sinh-ai`, {
        token: tk.bienTap,
        body: { urns: [DIEU[1]], chu_de: CHU_DE, so_cau: 2, as_of: NGAY },
      });
      expect(r.status).toBe(409);
      expect(r.body.error.message).toContain("chưa cấu hình dịch vụ AI");
    } finally {
      if (cu === undefined) delete process.env.LLM_PROVIDER;
      else process.env.LLM_PROVIDER = cu;
    }
  });
});
