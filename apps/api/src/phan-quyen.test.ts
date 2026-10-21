/**
 * Kiểm thử phân quyền của GĐ0 (docs/PLAN.md): mỗi khối describe ứng với một mục S1–S5 trong
 * phần "Kiểm tra đã xong". Chạy trên Postgres test thật; chỉ tạo/xóa dữ liệu mang tiền tố riêng.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession, type Role } from "@qdpl/auth";
import { sql } from "@qdpl/db";
import { createApp } from "./app.ts";
import { HAN_MUC_HOI_MAC_DINH, hanMucHoiMoiNgay } from "./routes/ask.ts";

const app = createApp();

/** Tiền tố riêng để nhận diện và dọn sạch dữ liệu do test tạo. */
const PREFIX = "test-qdpl-phan-quyen";
const TARGET_URN = `vn:doc:${PREFIX}:001`;
const AMENDING_URN = `vn:doc:${PREFIX}:002`;

const emailCua = (ten: string) => `${PREFIX}-${ten}@vidu.vn`;

/** Tạo tài khoản với vai trò cho trước, trả token phiên. */
async function taoTaiKhoan(ten: string, role: Role): Promise<string> {
  const [acc] = await sql<Array<{ id: string }>>`
    INSERT INTO accounts (email, role) VALUES (${emailCua(ten)}, ${role}) RETURNING id`;
  return (await createSession(acc!.id, "test")).token;
}

async function goi(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<{ status: number; body: any; headers: Headers }> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const res = await app.request(`http://test${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const ct = res.headers.get("content-type") ?? "";
  return {
    status: res.status,
    body: ct.includes("json") ? await res.json() : await res.text(),
    headers: res.headers,
  };
}

async function taoLenhSuaDoi(ordinal: number): Promise<string> {
  const [row] = await sql<Array<{ id: string }>>`
    INSERT INTO amendment_ops (amending_doc_urn, amending_label, target_doc_urn, target_path, op, payload,
                               effective_from, ordinal, extraction, confidence, review_status)
    VALUES (${AMENDING_URN}, ${`khoản ${ordinal} Điều 1`}, ${TARGET_URN}, 'dieu-1', 'replace',
            ${sql.json({ text: `${PREFIX}: nội dung mới` })}, '2027-07-01', ${ordinal}, 'llm', 0.9, 'pending')
    RETURNING id`;
  return row!.id;
}

async function donDep() {
  await sql`DELETE FROM jobs WHERE payload::text LIKE ${`%${PREFIX}%`}`;
  await sql`DELETE FROM audit_log WHERE actor LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM review_queue WHERE document_urn = ${TARGET_URN}`;
  await sql`DELETE FROM amendment_ops WHERE amending_doc_urn = ${AMENDING_URN}`;
  // sessions xóa dây chuyền theo accounts.
  await sql`DELETE FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
}

const tk: Record<"khach" | "bienTap" | "phapChe", string> = { khach: "", bienTap: "", phapChe: "" };

beforeAll(async () => {
  await donDep();
  tk.khach = await taoTaiKhoan("khach", "khach");
  tk.bienTap = await taoTaiKhoan("bien-tap", "bien_tap");
  tk.phapChe = await taoTaiKhoan("phap-che", "phap_che");
});

afterAll(async () => {
  await donDep();
});

describe("S1 — API biên tập phải kiểm quyền", () => {
  let lenhDuyet = "";
  let lenhTuChoi = "";
  let mucHangDoi = "";

  beforeAll(async () => {
    lenhDuyet = await taoLenhSuaDoi(1);
    lenhTuChoi = await taoLenhSuaDoi(2);
    const [q] = await sql<Array<{ id: string }>>`
      INSERT INTO review_queue (kind, ref_id, document_urn, priority, payload, state)
      VALUES ('user_report', ${`${PREFIX}-bao-cao`}, ${TARGET_URN}, 1, ${sql.json({})}, 'open')
      RETURNING id`;
    mucHangDoi = q!.id;
  });

  test("duyệt lệnh sửa đổi không có token trả 401", async () => {
    const { status, body } = await goi("POST", `/v1/amend-ops/${lenhDuyet}/approve`, { body: {} });
    expect(status).toBe(401);
    expect(body.error.code).toBe("chua_dang_nhap");
  });

  test("duyệt lệnh sửa đổi với vai trò bien_tap trả 403", async () => {
    const { status, body } = await goi("POST", `/v1/amend-ops/${lenhDuyet}/approve`, {
      token: tk.bienTap,
      body: {},
    });
    expect(status).toBe(403);
    expect(body.error.code).toBe("khong_du_quyen");
  });

  test("từ chối lệnh sửa đổi cũng cần phap_che", async () => {
    const khongToken = await goi("POST", `/v1/amend-ops/${lenhTuChoi}/reject`, { body: {} });
    expect(khongToken.status).toBe(401);
    const bienTap = await goi("POST", `/v1/amend-ops/${lenhTuChoi}/reject`, { token: tk.bienTap, body: {} });
    expect(bienTap.status).toBe(403);
  });

  test("phap_che duyệt được; reviewer_id là email người duyệt, bỏ qua reviewerId trong body", async () => {
    const { status, body } = await goi("POST", `/v1/amend-ops/${lenhDuyet}/approve`, {
      token: tk.phapChe,
      body: { reviewerId: "gia-mao", notes: `${PREFIX}: đã kiểm tra` },
    });
    expect(status).toBe(200);
    expect(body.op.reviewStatus).toBe("approved");
    expect(body.op.reviewerId).toBe(emailCua("phap-che"));

    const [row] = await sql<Array<{ reviewer_id: string }>>`
      SELECT reviewer_id FROM amendment_ops WHERE id = ${lenhDuyet}::uuid`;
    expect(row!.reviewer_id).toBe(emailCua("phap-che"));

    const [log] = await sql<Array<{ actor: string }>>`
      SELECT actor FROM audit_log WHERE action = 'amendment_ops.approved' AND target = ${lenhDuyet}`;
    expect(log!.actor).toBe(emailCua("phap-che"));
  });

  test("xem hàng đợi: không token 401, khach 403, bien_tap 200", async () => {
    const path = `/v1/review-queue?documentUrn=${encodeURIComponent(TARGET_URN)}`;
    expect((await goi("GET", path)).status).toBe(401);
    expect((await goi("GET", path, { token: tk.khach })).status).toBe(403);
    const ok = await goi("GET", path, { token: tk.bienTap });
    expect(ok.status).toBe(200);
    expect(ok.body.items.some((i: any) => i.id === mucHangDoi)).toBe(true);
  });

  test("xử lý mục hàng đợi: khach 403, bien_tap 200 và ghi nhật ký theo email", async () => {
    const path = `/v1/review-queue/${mucHangDoi}/resolve`;
    expect((await goi("POST", path, { body: {} })).status).toBe(401);
    expect((await goi("POST", path, { token: tk.khach, body: {} })).status).toBe(403);
    const ok = await goi("POST", path, { token: tk.bienTap, body: { resolution: "đã xem" } });
    expect(ok.status).toBe(200);
    expect(ok.body.item.state).toBe("resolved");

    const [log] = await sql<Array<{ actor: string }>>`
      SELECT actor FROM audit_log WHERE action = 'review_queue.resolved' AND target = ${mucHangDoi}`;
    expect(log!.actor).toBe(emailCua("bien-tap"));
  });
});

/* ------------------------------------------------------------------ */
/* S2 — Hỏi đáp AI: bắt đăng nhập, hạn mức theo ngày giờ Việt Nam      */
/* ------------------------------------------------------------------ */

describe("S2 — hỏi đáp AI bắt đăng nhập và có hạn mức", () => {
  const MARK = `[${PREFIX}-ask]`;
  let accountId = "";
  let token = "";
  const envCu = { quota: process.env.ASK_QUOTA_PER_DAY, llm: process.env.LLM_PROVIDER };

  function datLai(k: "ASK_QUOTA_PER_DAY" | "LLM_PROVIDER", v: string | undefined) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }

  /** Ghi sẵn câu hỏi vào ask_logs ở một thời điểm cho trước, không gọi mô hình. */
  async function ghiCauHoi(soCau: number, luc: "hom_nay" | "hom_qua_vn") {
    // 0 giờ hôm nay theo giờ Việt Nam. "hom_qua_vn" là 1 phút trước mốc đó: có thể vẫn là hôm nay
    // theo UTC, nhưng ở Việt Nam đã là hôm qua nên không được tính.
    const lech = luc === "hom_nay" ? "30 seconds" : "-1 minute";
    for (let i = 0; i < soCau; i++) {
      await sql`
        INSERT INTO ask_logs (question, as_of, account_id, created_at)
        VALUES (${`${MARK} câu có sẵn ${luc} ${i}`}, CURRENT_DATE, ${accountId}::uuid,
          (date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh')
            + ${lech}::interval)`;
    }
  }
  const hoi = (t?: string, cau = `${MARK} Ai phê duyệt kế hoạch thử nghiệm?`) =>
    goi("POST", "/v1/ask", { token: t, body: { question: cau, skipAnalysis: true } });

  beforeAll(async () => {
    const [acc] = await sql<Array<{ id: string }>>`
      INSERT INTO accounts (email, role) VALUES (${emailCua("hoi-dap")}, 'can_bo') RETURNING id`;
    accountId = acc!.id;
    token = (await createSession(accountId, "test")).token;
  });
  afterAll(async () => {
    await sql`DELETE FROM ask_logs WHERE question LIKE ${`${MARK}%`}`;
    datLai("ASK_QUOTA_PER_DAY", envCu.quota);
    datLai("LLM_PROVIDER", envCu.llm);
  });

  test("không token trả 401 và không ghi ask_logs", async () => {
    const cau = `${MARK} khách hỏi`;
    const { status, body } = await hoi(undefined, cau);
    expect(status).toBe(401);
    expect(body.error.code).toBe("chua_dang_nhap");
    const [r] = await sql<
      Array<{ n: number }>
    >`SELECT count(*)::int AS n FROM ask_logs WHERE question = ${cau}`;
    expect(r!.n).toBe(0);
  });

  test("đã đăng nhập: trả lời được và ask_logs ghi account_id", async () => {
    process.env.ASK_QUOTA_PER_DAY = "30";
    const { status, body } = await hoi(token, `${MARK} ghi tài khoản`);
    expect(status).toBe(200);
    const [r] = await sql<
      Array<{ account_id: string }>
    >`SELECT account_id FROM ask_logs WHERE id = ${body.id}::uuid`;
    expect(r!.account_id).toBe(accountId);
  });

  test("câu thứ ASK_QUOTA_PER_DAY + 1 trong ngày trả 429; câu của hôm qua (giờ Việt Nam) không tính", async () => {
    await sql`DELETE FROM ask_logs WHERE account_id = ${accountId}::uuid`;
    process.env.ASK_QUOTA_PER_DAY = "3";
    await ghiCauHoi(2, "hom_nay");
    await ghiCauHoi(5, "hom_qua_vn");
    // Hôm nay mới 2 câu (5 câu kia thuộc hôm qua theo giờ Việt Nam): câu thứ 3 còn được hỏi.
    expect((await hoi(token)).status).toBe(200);
    const { status, body } = await hoi(token);
    expect(status).toBe(429);
    expect(body.error.code).toBe("het_luot");
    expect(body.error.message).toContain("3 câu");
  });

  test("ASK_QUOTA_PER_DAY sai hoặc thiếu thì dùng mặc định 30", () => {
    for (const v of ["abc", "0", "-5", "2.5", ""]) {
      process.env.ASK_QUOTA_PER_DAY = v;
      expect(hanMucHoiMoiNgay()).toBe(HAN_MUC_HOI_MAC_DINH);
    }
    delete process.env.ASK_QUOTA_PER_DAY;
    expect(hanMucHoiMoiNgay()).toBe(30);
    process.env.ASK_QUOTA_PER_DAY = "7";
    expect(hanMucHoiMoiNgay()).toBe(7);
  });

  test("LLM_PROVIDER=none: báo chưa cấu hình (503) sau khi kiểm đăng nhập, không tính lượt", async () => {
    process.env.LLM_PROVIDER = "none";
    try {
      expect((await hoi(undefined)).status).toBe(401);
      const cau = `${MARK} chưa cấu hình`;
      const { status, body } = await hoi(token, cau);
      expect(status).toBe(503);
      expect(body.error.code).toBe("chua_cau_hinh");
      const [r] = await sql<
        Array<{ n: number }>
      >`SELECT count(*)::int AS n FROM ask_logs WHERE question = ${cau}`;
      expect(r!.n).toBe(0);
    } finally {
      datLai("LLM_PROVIDER", envCu.llm);
    }
  });
});

/* ------------------------------------------------------------------ */
/* S3 — API học tập: chỉ chủ ghi danh, chủ thẻ ôn được đọc và ghi       */
/* ------------------------------------------------------------------ */

describe("S3 — dữ liệu học tập của người khác bị chặn", () => {
  const SLUG = `${PREFIX}-cd`;
  const A = { id: "", token: "" };
  const B = { id: "", token: "" };
  let ghiDanhA = "";
  let theOnA = "";

  async function taoNguoiHoc(ten: string) {
    const [acc] = await sql<Array<{ id: string }>>`
      INSERT INTO accounts (email, role) VALUES (${emailCua(ten)}, 'can_bo') RETURNING id`;
    return { id: acc!.id, token: (await createSession(acc!.id, "test")).token };
  }

  beforeAll(async () => {
    await sql`DELETE FROM courses WHERE slug = ${SLUG}`;
    Object.assign(A, await taoNguoiHoc("hoc-a"));
    Object.assign(B, await taoNguoiHoc("hoc-b"));
    await sql`
      INSERT INTO courses (slug, title, status, as_of)
      VALUES (${SLUG}, 'Chuyên đề thử phân quyền', 'xuat_ban', '2026-09-01')`;
    const gd = await goi("POST", `/v1/dao-tao/chuyen-de/${SLUG}/ghi-danh`, { token: A.token, body: {} });
    expect(gd.status).toBe(200);
    ghiDanhA = gd.body.ghiDanh.id;
    const [the] = await sql<Array<{ id: string }>>`
      INSERT INTO srs_cards (enrollment_id, ref_kind, ref_id)
      VALUES (${ghiDanhA}::uuid, 'activity', ${crypto.randomUUID()}) RETURNING id`;
    theOnA = the!.id;
  });
  afterAll(async () => {
    await sql`DELETE FROM courses WHERE slug = ${SLUG}`;
  });

  test("B gọi GET /ghi-danh/<id của A>/tien-do nhận 403; A nhận 200", async () => {
    const b = await goi("GET", `/v1/dao-tao/ghi-danh/${ghiDanhA}/tien-do`, { token: B.token });
    expect(b.status).toBe(403);
    expect(b.body.error.code).toBe("ngoai_pham_vi");
    expect((await goi("GET", `/v1/dao-tao/ghi-danh/${ghiDanhA}/tien-do`, { token: A.token })).status).toBe(
      200,
    );
  });

  test("B không đọc được phiên ôn và không đổi được ghi danh của A", async () => {
    expect((await goi("GET", `/v1/dao-tao/ghi-danh/${ghiDanhA}/on-tap`, { token: B.token })).status).toBe(
      403,
    );
    const sua = await goi("PATCH", `/v1/dao-tao/ghi-danh/${ghiDanhA}`, {
      token: B.token,
      body: { goalMinutesPerWeek: 999 },
    });
    expect(sua.status).toBe(403);
    const [e] = await sql<Array<{ goal_minutes_per_week: number | null }>>`
      SELECT goal_minutes_per_week FROM enrollments WHERE id = ${ghiDanhA}::uuid`;
    expect(e!.goal_minutes_per_week).not.toBe(999);
    expect((await goi("GET", `/v1/dao-tao/ghi-danh/${ghiDanhA}/on-tap`, { token: A.token })).status).toBe(
      200,
    );
  });

  test("B không nộp bài vào ghi danh của A (ghiDanhId trong body)", async () => {
    const r = await goi("POST", `/v1/dao-tao/hoat-dong/${crypto.randomUUID()}/nop`, {
      token: B.token,
      body: { ghiDanhId: ghiDanhA, traLoi: {} },
    });
    expect(r.status).toBe(403);
  });

  test("B không ôn được thẻ của A; A ôn được", async () => {
    const path = `/v1/dao-tao/the-on/${theOnA}/on`;
    expect((await goi("POST", path, { token: B.token, body: { chatLuong: 5 } })).status).toBe(403);
    expect((await goi("POST", path, { token: A.token, body: { chatLuong: 5 } })).status).toBe(200);
  });

  test("id không tồn tại trả 404", async () => {
    const khongCo = crypto.randomUUID();
    expect((await goi("GET", `/v1/dao-tao/ghi-danh/${khongCo}/tien-do`, { token: B.token })).status).toBe(
      404,
    );
    expect(
      (await goi("GET", "/v1/dao-tao/ghi-danh/khong-phai-uuid/tien-do", { token: B.token })).status,
    ).toBe(404);
    const the = await goi("POST", `/v1/dao-tao/the-on/${khongCo}/on`, {
      token: B.token,
      body: { chatLuong: 5 },
    });
    expect(the.status).toBe(404);
  });

  test("không token vẫn là 401", async () => {
    expect((await goi("GET", `/v1/dao-tao/ghi-danh/${ghiDanhA}/tien-do`)).status).toBe(401);
  });
});

/* ------------------------------------------------------------------ */
/* S4 — Tài khoản demo quan_tri tắt ở production                        */
/* ------------------------------------------------------------------ */

describe("S4 — demo quan_tri tắt khi NODE_ENV=production", () => {
  type Bien = "NODE_ENV" | "AUTH_DEMO_PASSWORD" | "AUTH_DEMO_ADMIN";
  const envCu: Record<Bien, string | undefined> = {
    NODE_ENV: process.env.NODE_ENV,
    AUTH_DEMO_PASSWORD: process.env.AUTH_DEMO_PASSWORD,
    AUTH_DEMO_ADMIN: process.env.AUTH_DEMO_ADMIN,
  };
  const MK = `${PREFIX}-mat-khau-demo`;
  const EMAIL_DEMO = ["quan-tri@demo.quydinhphapluat.vn", "hoc-vien@demo.quydinhphapluat.vn"];
  let demoCoTruoc: string[] = [];

  const datLai = (k: Bien, v: string | undefined) => {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  };
  const dangNhapDemo = (vaiTro: "quan_tri" | "hoc_vien") =>
    goi("POST", "/v1/auth/demo", { body: { mat_khau: MK, vai_tro: vaiTro } });

  beforeAll(async () => {
    // Chỉ xóa tài khoản demo nào do chính test này tạo ra.
    const co = await sql<
      Array<{ email: string }>
    >`SELECT email FROM accounts WHERE email = ANY(${EMAIL_DEMO})`;
    demoCoTruoc = co.map((r) => r.email);
    process.env.AUTH_DEMO_PASSWORD = MK;
  });
  afterAll(async () => {
    for (const k of Object.keys(envCu) as Bien[]) datLai(k, envCu[k]);
    const taoMoi = EMAIL_DEMO.filter((e) => !demoCoTruoc.includes(e));
    if (taoMoi.length) await sql`DELETE FROM accounts WHERE email = ANY(${taoMoi})`;
  });

  test("production, không đặt AUTH_DEMO_ADMIN: quan_tri bị từ chối (403), học viên vẫn vào được", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_DEMO_ADMIN;
    const qt = await dangNhapDemo("quan_tri");
    expect(qt.status).toBe(403);
    expect(qt.body.error.code).toBe("demo_quan_tri_tat");
    expect(qt.body.token).toBeUndefined();
    expect((await dangNhapDemo("hoc_vien")).status).toBe(200);
  });

  test("production với AUTH_DEMO_ADMIN khác 1 vẫn bị từ chối", async () => {
    process.env.NODE_ENV = "production";
    for (const v of ["0", "true", "yes", ""]) {
      process.env.AUTH_DEMO_ADMIN = v;
      expect((await dangNhapDemo("quan_tri")).status).toBe(403);
    }
  });

  test("production với AUTH_DEMO_ADMIN=1, hoặc máy phát triển: quan_tri vào được", async () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_DEMO_ADMIN = "1";
    expect((await dangNhapDemo("quan_tri")).status).toBe(200);
    process.env.NODE_ENV = "development";
    delete process.env.AUTH_DEMO_ADMIN;
    expect((await dangNhapDemo("quan_tri")).status).toBe(200);
  });
});

/* ------------------------------------------------------------------ */
/* S5 — CORS                                                            */
/* ------------------------------------------------------------------ */

describe("S5 — CORS cho phép PATCH, PUT, DELETE và đọc origin từ CORS_ORIGINS", () => {
  const envCu = { origins: process.env.CORS_ORIGINS, node: process.env.NODE_ENV };
  afterAll(() => {
    if (envCu.origins === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = envCu.origins;
    if (envCu.node === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = envCu.node;
  });

  /** CORS đọc biến môi trường lúc dựng app, nên mỗi ca dựng app riêng. */
  async function preflight(origin: string, method: string) {
    const res = await createApp().request("http://test/v1/quan-tri/nguoi-dung/x", {
      method: "OPTIONS",
      headers: { origin, "access-control-request-method": method },
    });
    return {
      status: res.status,
      origin: res.headers.get("access-control-allow-origin"),
      methods: res.headers.get("access-control-allow-methods") ?? "",
    };
  }

  test("preflight DELETE từ origin hợp lệ được chấp nhận", async () => {
    process.env.CORS_ORIGINS = "http://localhost:3030, http://192.168.1.10:3080";
    const r = await preflight("http://localhost:3030", "DELETE");
    expect(r.status).toBe(204);
    expect(r.origin).toBe("http://localhost:3030");
    for (const m of ["PATCH", "PUT", "DELETE"]) expect(r.methods).toContain(m);
    expect((await preflight("http://192.168.1.10:3080", "PATCH")).origin).toBe("http://192.168.1.10:3080");
  });

  test("origin ngoài danh sách không được cho phép", async () => {
    process.env.CORS_ORIGINS = "http://localhost:3030";
    expect((await preflight("http://ke-la.example", "DELETE")).origin).toBeNull();
  });

  test("thiếu CORS_ORIGINS trên máy chủ thật: không cho origin nào", async () => {
    delete process.env.CORS_ORIGINS;
    process.env.NODE_ENV = "production";
    expect((await preflight("http://localhost:3030", "DELETE")).origin).toBeNull();
  });
});
