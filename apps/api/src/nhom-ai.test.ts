/**
 * AI của nhóm học cùng (docs/PLAN.md GĐ16d) trên Postgres test thật, provider mock tất định hoặc
 * provider giả trả đầu ra cố định.
 *
 * Dữ liệu gieo (tiền tố `test-gd16d`): phòng P có đội A, đội B; cán bộ A1 (trưởng nhóm), A2, A3 ở
 * đội A; B1, B2 ở đội B; một `quan_ly` đội A, một `quan_tri`. Nhóm N gồm cả 5 người, 6 mục chia sẻ
 * theo thứ tự D1, L1, L2, D2, L3, L4 (Dn là đề ôn tập, Ln là bài học); L3 có hạn gợi ý sau 2 ngày.
 * Tiến độ: A1 xong L1 cách đây 10 ngày; B1 xong L1, L2. A2, A3, B2 chưa học.
 *
 * Mock AI-1 xếp bài học trước đề ôn tập, trong mỗi loại mục có hạn gần hơn trước, còn lại giữ thứ
 * tự cũ, nên thứ tự mong đợi là L3, L1, L2, L4, D1, D2.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSession } from "@qdpl/auth";
import { CANH_BAO_TOM_TAT, THONG_BAO_KHONG_GOI_Y } from "@qdpl/dao-tao";
import { sql, taoDonVi } from "@qdpl/db";
import {
  getProvider,
  type LlmProvider,
  type LlmRequest,
  type LlmResponse,
  MockProvider,
  setProvider,
} from "@qdpl/llm";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-gd16d";

async function goi(method: string, path: string, token?: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await app.request(`http://test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
}

const TEN_DOI = { P: "Phòng thử GĐ16d", A: "Đội thử GĐ16d Alpha", B: "Đội thử GĐ16d Bravo" } as const;
const CAN_BO = ["A1", "A2", "A3", "B1", "B2"] as const;
const hoTen = (ten: string) => `Phạm Thử ${ten}`;
const capBac = (ten: string) => `Cấp bậc thử ${ten}`;
const tenDangNhap = (ten: string) => `${PREFIX}-${ten.toLowerCase()}`;
const email = (ten: string) => `${tenDangNhap(ten)}@thu.example`;

const dv: Record<string, string> = {};
const acc: Record<string, string> = {};
const tk: Record<string, string> = {};
const muc: Record<string, string> = {};
let nhom = "";

/** Provider giữ lại mọi yêu cầu để kiểm dữ liệu gửi đi và số lần gọi. */
class ProviderThu implements LlmProvider {
  readonly yeuCau: LlmRequest[] = [];
  constructor(
    private tra: (req: LlmRequest) => Promise<LlmResponse>,
    readonly name = "mock",
  ) {}
  complete(req: LlmRequest) {
    this.yeuCau.push(req);
    return this.tra(req);
  }
}

const providerGoc = getProvider();
const mock = new MockProvider(mkdtempSync(join(tmpdir(), "qdpl-gd16d-llm-")));
let thu: ProviderThu;
const dungProvider = (p: ProviderThu) => {
  thu = p;
  setProvider(p);
};

const traJson = (json: unknown): LlmResponse => ({
  text: JSON.stringify(json),
  json,
  citations: [],
  model: "claude-haiku-4-5",
  tokensIn: 120,
  tokensOut: 40,
  cacheReadTokens: 0,
  costUsd: 0.00032,
});

/** Dòng JSON "DỮ LIỆU" trong yêu cầu gửi mô hình. */
const duLieuGui = (req: LlmRequest) => JSON.parse(req.user.split("\n").find((l) => l.startsWith("{"))!);

const thuTuHienTai = async () => (await goi("GET", `/v1/nhom/${nhom}`, tk.A1)).body.muc.map((m: any) => m.id);
const ghiChuCuaNhom = async () =>
  (await sql`
    SELECT kind, status, reject_reason, model, tokens_in, tokens_out, cost_usd::float AS cost_usd, requested_by
    FROM study_group_ai_notes WHERE group_id = ${nhom} ORDER BY created_at`) as any[];
const xoaGhiChu = () => sql`DELETE FROM study_group_ai_notes WHERE group_id = ${nhom}`;
const gieoLuotGoi = (kind: string, n: number, nguoi: string | null) => sql`
  INSERT INTO study_group_ai_notes (group_id, kind, requested_by, input_hash, status, reject_reason)
  SELECT ${nhom}, ${kind}, ${nguoi}, ${`${PREFIX}-gieo-`} || i, 'bi_loai', 'Gieo cho kiểm thử hạn mức.'
  FROM generate_series(1, ${n}) AS i`;

async function donDep() {
  const ds = `${PREFIX}%`;
  await sql`DELETE FROM study_groups WHERE owner_account_id IN (SELECT id FROM accounts WHERE username LIKE ${ds})`;
  await sql`DELETE FROM courses WHERE slug LIKE ${ds}`;
  await sql`DELETE FROM questions WHERE code LIKE ${ds}`;
  await sql`DELETE FROM question_topics WHERE code LIKE ${ds}`;
  await sql`DELETE FROM audit_log WHERE actor LIKE ${ds} OR target LIKE ${ds}`;
  await sql`DELETE FROM access_log WHERE account_id IN (SELECT id FROM accounts WHERE username LIKE ${ds})`;
  await sql`DELETE FROM accounts WHERE username LIKE ${ds}`;
  for (const cap of [3, 2, 1]) await sql`DELETE FROM units WHERE code LIKE ${ds} AND nlevel(path) = ${cap}`;
}

async function taoTaiKhoan(ten: string, role: string, unitId: string | null) {
  const [r] = (await sql`
    INSERT INTO accounts (username, email, name, role, unit_id, rank_title)
    VALUES (${tenDangNhap(ten)}, ${email(ten)}, ${hoTen(ten)}, ${role}, ${unitId}, ${capBac(ten)})
    RETURNING id`) as any[];
  return r.id as string;
}

async function xongBai(ai: string, course: string, lesson: string, luc: Date) {
  const [e] = (await sql`
    INSERT INTO enrollments (account_id, course_id) VALUES (${acc[ai]!}, ${course})
    ON CONFLICT (account_id, course_id) DO UPDATE SET account_id = EXCLUDED.account_id
    RETURNING id`) as any[];
  await sql`
    INSERT INTO lesson_progress (enrollment_id, lesson_id, state, last_block_ordinal, started_at, finished_at, updated_at)
    VALUES (${e.id}, ${lesson}, 'xong', 2, ${luc}, ${luc}, ${luc})`;
}

beforeAll(async () => {
  await donDep();
  const a = `${PREFIX}-seed`;
  dv.P = (await taoDonVi({ code: `${PREFIX}-P`, name: TEN_DOI.P }, a)).id;
  dv.A = (await taoDonVi({ code: `${PREFIX}-A`, name: TEN_DOI.A, parentId: dv.P, ordinal: 0 }, a)).id;
  dv.B = (await taoDonVi({ code: `${PREFIX}-B`, name: TEN_DOI.B, parentId: dv.P, ordinal: 1 }, a)).id;
  for (const n of CAN_BO) acc[n] = await taoTaiKhoan(n, "can_bo", dv[n[0]!]!);
  acc.quanLyA = await taoTaiKhoan("QLA", "quan_ly", dv.A!);
  acc.quanTri = await taoTaiKhoan("QT", "quan_tri", null);
  for (const k of Object.keys(acc)) tk[k] = (await createSession(acc[k]!, "test")).token;

  const [c] = (await sql`
    INSERT INTO courses (slug, title, status, as_of) VALUES (${`${PREFIX}-c1`}, 'Chuyên đề thử GĐ16d', 'xuat_ban', '2026-09-01')
    RETURNING id`) as any[];
  const bai: Record<string, string> = {};
  for (const [i, ten] of ["L1", "L2", "L3", "L4"].entries()) {
    const [l] = (await sql`
      INSERT INTO lessons (course_id, slug, ordinal, title, status)
      VALUES (${c.id}, ${`${PREFIX}-${ten.toLowerCase()}`}, ${i + 1}, ${`Bài thử GĐ16d ${ten}`}, 'xuat_ban')
      RETURNING id`) as any[];
    for (const k of [1, 2]) {
      await sql`
        INSERT INTO lesson_blocks (lesson_id, ordinal, kind, data, status)
        VALUES (${l.id}, ${k}, 'giang', ${sql.json({ md: `Khối ${k}` })}, 'xuat_ban')`;
    }
    bai[ten] = l.id;
  }
  const [t] = (await sql`
    INSERT INTO question_topics (code, name) VALUES (${`${PREFIX}-t`}, 'Chủ đề thử GĐ16d') RETURNING id`) as any[];
  for (let i = 1; i <= 5; i++) {
    await sql`
      INSERT INTO questions (code, topic_id, level, kind, stem, options, answer, explanation, status)
      VALUES (${`${PREFIX}-${i}`}, ${t.id}, 'de', 'dung_sai', ${`Nhận định thử GĐ16d số ${i}`}, '{}',
              ${sql.json({ dung: ["dung"] })}, 'Giải thích.', 'da_duyet')`;
  }

  const r = await goi("POST", "/v1/nhom", tk.A1, { ten: "Nhóm thử GĐ16d" });
  expect(r.status).toBe(201);
  nhom = r.body.id;
  for (const ai of ["A2", "A3", "B1", "B2"]) {
    expect((await goi("POST", "/v1/nhom/tham-gia", tk[ai], { ma: r.body.ma_moi })).status).toBe(200);
  }
  const chiaSe = async (body: unknown) => {
    const x = await goi("POST", `/v1/nhom/${nhom}/muc`, tk.A1, body);
    expect(x.status).toBe(201);
    return x.body.id as string;
  };
  const de = (ten: string) => ({ loai: "de_on_tap", topic_id: t.id, so_cau: 5, ten });
  muc.D1 = await chiaSe(de("Đề ôn thử GĐ16d một"));
  muc.L1 = await chiaSe({ loai: "bai_hoc", lesson_id: bai.L1 });
  muc.L2 = await chiaSe({ loai: "bai_hoc", lesson_id: bai.L2 });
  muc.D2 = await chiaSe(de("Đề ôn thử GĐ16d hai"));
  muc.L3 = await chiaSe({ loai: "bai_hoc", lesson_id: bai.L3 });
  muc.L4 = await chiaSe({ loai: "bai_hoc", lesson_id: bai.L4 });
  await sql`
    UPDATE study_group_items SET due_date = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 2 WHERE id = ${muc.L3!}`;

  await xongBai("A1", c.id, bai.L1!, new Date(Date.now() - 10 * 86_400_000));
  await xongBai("B1", c.id, bai.L1!, new Date(Date.now() - 86_400_000));
  await xongBai("B1", c.id, bai.L2!, new Date(Date.now() - 86_400_000));
});

beforeEach(() => dungProvider(new ProviderThu((req) => mock.complete(req))));

afterAll(async () => {
  setProvider(providerGoc);
  await donDep();
});

const THU_TU_MOCK = () => [muc.L3, muc.L1, muc.L2, muc.L4, muc.D1, muc.D2];
const THU_TU_CHIA_SE = () => [muc.D1, muc.L1, muc.L2, muc.D2, muc.L3, muc.L4];

describe("AI-1: gợi ý thứ tự học", () => {
  test("GET chi tiết nhóm có ai_bat (NODE_ENV=test, provider mock)", async () => {
    const r = await goi("GET", `/v1/nhom/${nhom}`, tk.A1);
    expect(r.status).toBe(200);
    expect(r.body.ai_bat).toBe(true);
  });

  test("chỉ trưởng nhóm gọi được; người ngoài nhóm nhận 404; provider không bị gọi", async () => {
    expect((await goi("POST", `/v1/nhom/${nhom}/ai/thu-tu`, tk.A2)).status).toBe(403);
    expect((await goi("POST", `/v1/nhom/${nhom}/ai/thu-tu`, tk.quanLyA)).status).toBe(404);
    expect(thu.yeuCau).toHaveLength(0);
  });

  test("mock trả hoán vị hợp lệ, không tự áp dụng; áp dụng qua PUT thì thứ tự đổi", async () => {
    await xoaGhiChu();
    const r = await goi("POST", `/v1/nhom/${nhom}/ai/thu-tu`, tk.A1);
    expect(r.status).toBe(200);
    expect(r.body.dat).toBe(true);
    expect(r.body.tu_bo_nho_dem).toBe(false);
    expect(r.body.thu_tu.map((m: any) => m.id)).toEqual(THU_TU_MOCK());
    expect(r.body.thu_tu[0].ten).toBe("Bài thử GĐ16d L3");
    expect(r.body.ghi_chu).toBe(
      "Bài học đặt trước đề ôn tập. Trong mỗi loại, mục có hạn gợi ý gần hơn đặt trước.",
    );

    // Chưa áp dụng.
    expect(await thuTuHienTai()).toEqual(THU_TU_CHIA_SE());
    const [g] = await ghiChuCuaNhom();
    expect(g).toMatchObject({
      kind: "thu_tu_hoc",
      status: "dat",
      model: "claude-haiku-4-5",
      requested_by: acc.A1,
    });
    expect(g.tokens_in).toBeGreaterThan(0);

    const ap = await goi("PUT", `/v1/nhom/${nhom}/muc/thu-tu`, tk.A1, {
      item_ids: r.body.thu_tu.map((m: any) => m.id),
    });
    expect(ap.status).toBe(200);
    expect(await thuTuHienTai()).toEqual(THU_TU_MOCK());

    // Trả lại thứ tự ban đầu cho các ca sau.
    await goi("PUT", `/v1/nhom/${nhom}/muc/thu-tu`, tk.A1, { item_ids: THU_TU_CHIA_SE() });
  });

  test("gọi lại với cùng dữ liệu thì dùng kết quả đã có, không gọi provider", async () => {
    await xoaGhiChu();
    const r1 = await goi("POST", `/v1/nhom/${nhom}/ai/thu-tu`, tk.A1);
    const r2 = await goi("POST", `/v1/nhom/${nhom}/ai/thu-tu`, tk.A1);
    expect(r1.body.tu_bo_nho_dem).toBe(false);
    expect(r2.status).toBe(200);
    expect(r2.body.tu_bo_nho_dem).toBe(true);
    expect(r2.body.thu_tu).toEqual(r1.body.thu_tu);
    expect(thu.yeuCau).toHaveLength(1);
    expect(await ghiChuCuaNhom()).toHaveLength(1);
  });

  test("dữ liệu gửi provider chỉ có mã M1…M6, không có thông tin người", async () => {
    await xoaGhiChu();
    await goi("POST", `/v1/nhom/${nhom}/ai/thu-tu`, tk.A1);
    const req = thu.yeuCau[0]!;
    const d = duLieuGui(req);
    expect(d.muc.map((m: any) => m.ma)).toEqual(["M1", "M2", "M3", "M4", "M5", "M6"]);
    const guiDi = `${req.cacheableSystem}\n${req.user}`;
    for (const ten of [...CAN_BO, "QLA"]) {
      for (const x of [hoTen(ten), tenDangNhap(ten), email(ten), capBac(ten)]) expect(guiDi).not.toContain(x);
    }
    for (const x of [...Object.values(TEN_DOI), ...Object.values(acc), nhom]) expect(guiDi).not.toContain(x);
  });

  test("quá 5 lần gọi mô hình trong ngày cho nhóm thì 429; kết quả đã có vẫn dùng lại được", async () => {
    await xoaGhiChu();
    expect((await goi("POST", `/v1/nhom/${nhom}/ai/thu-tu`, tk.A1)).status).toBe(200);
    await gieoLuotGoi("thu_tu_hoc", 4, acc.A1!);
    // Cùng dữ liệu: dùng lại, không tính hạn mức (đề xuất Đ17).
    const lai = await goi("POST", `/v1/nhom/${nhom}/ai/thu-tu`, tk.A1);
    expect(lai.status).toBe(200);
    expect(lai.body.tu_bo_nho_dem).toBe(true);
    // Dữ liệu đổi (đặt hạn cho L4): cần gọi mô hình, đã đủ 5 lần.
    await sql`UPDATE study_group_items SET due_date = '2026-12-31' WHERE id = ${muc.L4!}`;
    try {
      const r = await goi("POST", `/v1/nhom/${nhom}/ai/thu-tu`, tk.A1);
      expect(r.status).toBe(429);
      expect(r.body.error.code).toBe("qua_han_muc");
      expect(thu.yeuCau).toHaveLength(1);
    } finally {
      await sql`UPDATE study_group_items SET due_date = NULL WHERE id = ${muc.L4!}`;
    }
  });

  test("đầu ra có viện dẫn bị loại: ghi bi_loai kèm lý do, không hiện cho người dùng", async () => {
    await xoaGhiChu();
    dungProvider(
      new ProviderThu(async () =>
        traJson({
          thu_tu: ["M2", "M3", "M5", "M6", "M1", "M4"],
          ghi_chu: "Theo Nghị định mới, M2 đặt trước.",
        }),
      ),
    );
    const r = await goi("POST", `/v1/nhom/${nhom}/ai/thu-tu`, tk.A1);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ dat: false, thong_bao: THONG_BAO_KHONG_GOI_Y });
    const [g] = await ghiChuCuaNhom();
    expect(g).toMatchObject({ status: "bi_loai", model: "claude-haiku-4-5", tokens_in: 120, tokens_out: 40 });
    expect(g.reject_reason).toContain("Nghị định");
    expect(g.cost_usd).toBeCloseTo(0.00032, 6);
    // Kết quả bị loại không được dùng lại: lần sau gọi mô hình lại.
    await goi("POST", `/v1/nhom/${nhom}/ai/thu-tu`, tk.A1);
    expect(thu.yeuCau).toHaveLength(2);
    expect(await thuTuHienTai()).toEqual(THU_TU_CHIA_SE());
  });

  test("hoán vị sai và đầu ra không phải JSON cũng bị loại", async () => {
    await xoaGhiChu();
    dungProvider(new ProviderThu(async () => traJson({ thu_tu: ["M1", "M2", "M3"], ghi_chu: "" })));
    expect((await goi("POST", `/v1/nhom/${nhom}/ai/thu-tu`, tk.A1)).body.dat).toBe(false);
    dungProvider(
      new ProviderThu(async () => ({ ...traJson(null), text: "Không trả JSON.", json: undefined })),
    );
    expect((await goi("POST", `/v1/nhom/${nhom}/ai/thu-tu`, tk.A1)).body.dat).toBe(false);
    const ds = await ghiChuCuaNhom();
    expect(ds.map((g) => g.status)).toEqual(["bi_loai", "bi_loai"]);
    expect(ds[0].reject_reason).toContain("hoán vị");
    expect(ds[1].reject_reason).toContain("JSON");
  });

  test("hết giờ: trả câu cố định, không chờ provider, ghi bi_loai", async () => {
    await xoaGhiChu();
    const cu = process.env.NHOM_AI_HET_GIO_MS;
    process.env.NHOM_AI_HET_GIO_MS = "300";
    dungProvider(
      new ProviderThu(
        () => new Promise((xong) => setTimeout(() => xong(traJson({ thu_tu: [], ghi_chu: "" })), 1_500)),
      ),
    );
    try {
      const batDau = Date.now();
      const r = await goi("POST", `/v1/nhom/${nhom}/ai/thu-tu`, tk.A1);
      expect(Date.now() - batDau).toBeLessThan(1_200);
      expect(r.body).toEqual({ dat: false, thong_bao: THONG_BAO_KHONG_GOI_Y });
      const [g] = await ghiChuCuaNhom();
      expect(g.status).toBe("bi_loai");
      expect(g.reject_reason).toContain("Hết giờ");
      expect(g.model).toBeNull();
    } finally {
      if (cu === undefined) delete process.env.NHOM_AI_HET_GIO_MS;
      else process.env.NHOM_AI_HET_GIO_MS = cu;
    }
  });
});

describe("AI-2: tóm tắt tiến độ cho quản lý", () => {
  const tomTat = (token?: string) => goi("POST", `/v1/quan-tri/nhom/${nhom}/ai/tom-tat`, token);

  test("GET chi tiết quản trị có ai_bat; cán bộ không gọi được tóm tắt", async () => {
    expect((await goi("GET", `/v1/quan-tri/nhom/${nhom}`, tk.quanLyA)).body.ai_bat).toBe(true);
    expect((await tomTat(tk.A1)).status).toBe(403);
    expect(thu.yeuCau).toHaveLength(0);
  });

  test("quản lý đội A: tóm tắt có họ tên thật, câu cảnh báo, không có dữ liệu đội B", async () => {
    await xoaGhiChu();
    const r = await tomTat(tk.quanLyA);
    expect(r.status).toBe(200);
    expect(r.body.dat).toBe(true);
    expect(r.body.canh_bao).toBe(CANH_BAO_TOM_TAT);
    const chu = r.body.nhan_xet.join("\n");
    expect(chu).toContain(`Thành viên chưa bắt đầu mục nào: ${hoTen("A2")}, ${hoTen("A3")}.`);
    expect(chu).toContain(`${hoTen("A1")} chưa học trong 10 ngày gần đây.`);
    expect(chu).not.toMatch(/\b(?:TV|M)\d+\b/);
    for (const ten of ["B1", "B2"]) expect(chu).not.toContain(hoTen(ten));
    expect(r.body.muc_can_chu_y.every((m: any) => typeof m.id === "string" && m.ten)).toBe(true);

    // Dữ liệu gửi đi: 3 thành viên đội A; L2 (M3) chỉ B1 xong nên trong phạm vi là 0.
    const d = duLieuGui(thu.yeuCau[0]!);
    expect(d.so_thanh_vien).toBe(3);
    expect(d.thanh_vien.map((t: any) => t.ma)).toEqual(["TV1", "TV2", "TV3"]);
    expect(d.muc.find((m: any) => m.ma === "M3")).toMatchObject({
      so_nguoi_hoan_thanh: 0,
      ty_le_hoan_thanh: 0,
    });
    expect(d.muc.find((m: any) => m.ma === "M2")).toMatchObject({ so_nguoi_hoan_thanh: 1 });
    const guiDi = `${thu.yeuCau[0]!.cacheableSystem}\n${thu.yeuCau[0]!.user}`;
    for (const ten of [...CAN_BO, "QLA"]) {
      for (const x of [hoTen(ten), tenDangNhap(ten), email(ten), capBac(ten)]) expect(guiDi).not.toContain(x);
    }
    for (const x of Object.values(TEN_DOI)) expect(guiDi).not.toContain(x);

    const [g] = await ghiChuCuaNhom();
    expect(g).toMatchObject({ kind: "tom_tat_tien_do", status: "dat", requested_by: acc.quanLyA });
  });

  test("mỗi phạm vi một bản: quản trị thấy đủ 5 người, không dùng lại bản của đội A", async () => {
    const r = await tomTat(tk.quanTri);
    expect(r.body.dat).toBe(true);
    expect(r.body.tu_bo_nho_dem).toBe(false);
    const d = duLieuGui(thu.yeuCau[0]!);
    expect(d.so_thanh_vien).toBe(5);
    expect(d.muc.find((m: any) => m.ma === "M3")).toMatchObject({ so_nguoi_hoan_thanh: 1 });
    // Gọi lại cùng phạm vi thì dùng lại.
    expect((await tomTat(tk.quanLyA)).body.tu_bo_nho_dem).toBe(true);
    expect(thu.yeuCau).toHaveLength(1);
  });

  test("số không có trong dữ liệu thì bị loại, trả dat: false, không kèm câu nào", async () => {
    await xoaGhiChu();
    dungProvider(
      new ProviderThu(async () =>
        traJson({
          nhan_xet: ["TV1 đã xong M2.", "TV2 chưa bắt đầu mục nào.", "Tỷ lệ hoàn thành chung đạt 97%."],
          muc_can_chu_y: ["M3"],
        }),
      ),
    );
    const r = await tomTat(tk.quanLyA);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ dat: false });
    const [g] = await ghiChuCuaNhom();
    expect(g.status).toBe("bi_loai");
    expect(g.reject_reason).toBe("Số không có trong dữ liệu: 97.");
  });

  test("quá 20 lần gọi mô hình trong ngày của một người thì 429", async () => {
    await xoaGhiChu();
    await gieoLuotGoi("tom_tat_tien_do", 20, acc.quanLyA!);
    const r = await tomTat(tk.quanLyA);
    expect(r.status).toBe(429);
    expect(r.body.error.code).toBe("qua_han_muc");
    expect(thu.yeuCau).toHaveLength(0);
    // Hạn mức tính theo người: quản trị vẫn gọi được.
    expect((await tomTat(tk.quanTri)).status).toBe(200);
  });
});

describe("provider mock ngoài môi trường test", () => {
  test("API trả 503, chi tiết nhóm có ai_bat: false; bật rõ NHOM_AI_CHO_PHEP_MOCK=1 thì dùng được", async () => {
    const cu = { env: process.env.NODE_ENV, cho: process.env.NHOM_AI_CHO_PHEP_MOCK };
    process.env.NODE_ENV = "production";
    delete process.env.NHOM_AI_CHO_PHEP_MOCK;
    try {
      const r1 = await goi("POST", `/v1/nhom/${nhom}/ai/thu-tu`, tk.A1);
      expect(r1.status).toBe(503);
      expect(r1.body.error.code).toBe("chua_bat_ai");
      expect((await goi("POST", `/v1/quan-tri/nhom/${nhom}/ai/tom-tat`, tk.quanLyA)).status).toBe(503);
      expect((await goi("GET", `/v1/nhom/${nhom}`, tk.A1)).body.ai_bat).toBe(false);
      expect((await goi("GET", `/v1/quan-tri/nhom/${nhom}`, tk.quanLyA)).body.ai_bat).toBe(false);
      expect(thu.yeuCau).toHaveLength(0);

      process.env.NHOM_AI_CHO_PHEP_MOCK = "1";
      expect((await goi("GET", `/v1/nhom/${nhom}`, tk.A1)).body.ai_bat).toBe(true);
      delete process.env.NHOM_AI_CHO_PHEP_MOCK;

      // Provider thật (không phải mock) thì bật ở mọi môi trường.
      dungProvider(new ProviderThu((req) => mock.complete(req), "anthropic"));
      expect((await goi("GET", `/v1/nhom/${nhom}`, tk.A1)).body.ai_bat).toBe(true);
    } finally {
      process.env.NODE_ENV = cu.env;
      if (cu.cho === undefined) delete process.env.NHOM_AI_CHO_PHEP_MOCK;
      else process.env.NHOM_AI_CHO_PHEP_MOCK = cu.cho;
    }
  });
});
