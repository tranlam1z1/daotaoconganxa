/**
 * Luyện tập offline (docs/PLAN.md GĐ13) trên Postgres test thật: gói offline và đồng bộ kết quả.
 * Dữ liệu riêng: một chủ đề có 12 câu đã duyệt (2 câu không cho offline) và 1 câu chờ duyệt.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import { ngayVietNam } from "@qdpl/dao-tao";
import { sql } from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-gd13";
const CHU_DE = `${PREFIX}-td`;

async function goi(method: string, path: string, token?: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await app.request(`http://test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

const tk = { a: "", b: "" };
const acc = { a: "", b: "" };
/** id câu → true nếu câu cho phép offline. */
const cau: Array<{ id: string; offline: boolean }> = [];

async function donDep() {
  await sql`DELETE FROM questions WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM question_topics WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM accounts WHERE username LIKE ${`${PREFIX}%`}`;
}

beforeAll(async () => {
  await donDep();
  for (const k of ["a", "b"] as const) {
    const [r] = (await sql`
      INSERT INTO accounts (username, name, role) VALUES (${`${PREFIX}-${k}`}, ${`Cán bộ ${k}`}, 'can_bo')
      RETURNING id`) as any[];
    acc[k] = r.id;
    tk[k] = (await createSession(r.id, "test")).token;
  }
  const [t] =
    (await sql`INSERT INTO question_topics (code, name) VALUES (${CHU_DE}, 'Offline thử') RETURNING id`) as any[];
  for (let i = 1; i <= 13; i++) {
    const offline = i > 2;
    const [q] = (await sql`
      INSERT INTO questions (code, topic_id, level, kind, stem, options, answer, explanation, status, offline_ok)
      VALUES (${`${PREFIX}-${String(i).padStart(2, "0")}`}, ${t.id}, 'de', 'mot_dap_an', ${`Câu offline ${i}`},
              ${sql.json({
                phuong_an: [
                  { id: "a", text: "Có" },
                  { id: "b", text: "Không" },
                ],
              })},
              ${sql.json({ dung: ["a"] })}, 'Giải thích.', ${i === 13 ? "cho_duyet" : "da_duyet"}, ${offline})
      RETURNING id`) as any[];
    if (i <= 12) cau.push({ id: q.id, offline });
  }
});

afterAll(async () => {
  await donDep();
});

/** Một phiên offline 10 câu từ gói: câu thứ i trả lời đúng khi `dung(i)`. */
function phienMau(goi: any[], dung: (i: number) => boolean, ketThuc: Date = new Date()) {
  const ds = goi.slice(0, 10);
  return {
    client_id: crypto.randomUUID(),
    chu_de: ds[0].topic_id,
    bat_dau: new Date(ketThuc.getTime() - 5 * 60_000).toISOString(),
    ket_thuc: ketThuc.toISOString(),
    items: ds.map((q) => ({ question_id: q.id, version: q.version })),
    cau_tra_loi: ds.map((q, i) => ({
      client_id: crypto.randomUUID(),
      question_id: q.id,
      question_version: q.version,
      tra_loi: { chon: [dung(i) ? "a" : "b"] },
      giay: 12,
    })),
  };
}

async function demCauTraLoi(clientId: string): Promise<number> {
  const [r] = (await sql`
    SELECT count(*)::int AS n FROM practice_answers a JOIN practice_sessions s ON s.id = a.session_id
    WHERE s.client_id = ${clientId}`) as any[];
  return r.n;
}

describe("gói offline", () => {
  test("cần đăng nhập", async () => {
    expect((await goi("GET", `/v1/luyen-tap/goi-offline/${CHU_DE}`)).status).toBe(401);
  });

  test("chỉ có câu đã duyệt và cho phép offline, kèm đáp án để chấm trên máy", async () => {
    const r = await goi("GET", `/v1/luyen-tap/goi-offline/${CHU_DE}`, tk.a);
    expect(r.status).toBe(200);
    expect(r.body.chu_de.code).toBe(CHU_DE);
    const ids = new Set(r.body.cau.map((q: any) => q.id));
    expect(ids).toEqual(new Set(cau.filter((c) => c.offline).map((c) => c.id)));
    expect(r.body.cau.every((q: any) => q.answer?.dung?.length === 1)).toBe(true);
  });

  test("chủ đề không có nhận 404", async () => {
    expect((await goi("GET", `/v1/luyen-tap/goi-offline/${PREFIX}-khong-co`, tk.a)).status).toBe(404);
  });
});

describe("đồng bộ", () => {
  let goiA: any[] = [];
  beforeAll(async () => {
    goiA = (await goi("GET", `/v1/luyen-tap/goi-offline/${CHU_DE}`, tk.a)).body.cau;
  });

  test("10 câu làm offline thành đúng 10 practice_answers; gửi lại không sinh bản trùng", async () => {
    const p = phienMau(goiA, (i) => i < 7);
    const lan1 = await goi("POST", "/v1/luyen-tap/dong-bo", tk.a, { phien: [p] });
    expect(lan1.status).toBe(200);
    expect(lan1.body.ket_qua[0]).toMatchObject({ client_id: p.client_id, so_cau_moi: 10, so_cau_trung: 0 });
    expect(await demCauTraLoi(p.client_id)).toBe(10);

    const lan2 = await goi("POST", "/v1/luyen-tap/dong-bo", tk.a, { phien: [p] });
    expect(lan2.body.ket_qua[0]).toMatchObject({
      id: lan1.body.ket_qua[0].id,
      so_cau_moi: 0,
      so_cau_trung: 10,
    });
    expect(await demCauTraLoi(p.client_id)).toBe(10);

    const [s] = (await sql`
      SELECT offline, correct, total, finished_at, account_id FROM practice_sessions WHERE client_id = ${p.client_id}`) as any[];
    expect(s).toMatchObject({ offline: true, correct: 7, total: 10, account_id: acc.a });
    expect(s.finished_at).not.toBeNull();
  });

  test("đồng bộ xong thì ghi nhận hoạt động học của ngày đó", async () => {
    const p = phienMau(goiA, () => true);
    const r = await goi("POST", "/v1/luyen-tap/dong-bo", tk.a, { phien: [p] });
    expect(r.body.ket_qua[0].da_ket_thuc).toBe(true);
    const [hoatDong] = (await sql`
      SELECT count(*)::int AS n FROM daily_activity
      WHERE account_id = ${acc.a} AND day = ${ngayVietNam(new Date())}::date`) as any[];
    expect(hoatDong.n).toBe(1);
  });

  test("máy chủ chấm lại: gửi câu sai kèm cờ đúng cũng không được tính đúng", async () => {
    const p = phienMau(goiA, () => false);
    // Trường lạ (ví dụ `dung: true` do máy tự chấm) bị bỏ qua.
    const gian = { ...p, cau_tra_loi: p.cau_tra_loi.map((a) => ({ ...a, dung: true })) };
    await goi("POST", "/v1/luyen-tap/dong-bo", tk.a, { phien: [gian] });
    const [s] = (await sql`SELECT correct FROM practice_sessions WHERE client_id = ${p.client_id}`) as any[];
    expect(s.correct).toBe(0);
  });

  test("kết quả làm quá 7 ngày trước vẫn được lưu nhưng không ghi nhận hoạt động", async () => {
    const p = phienMau(goiA, () => true, new Date(Date.now() - 9 * 24 * 3600 * 1000));
    const r = await goi("POST", "/v1/luyen-tap/dong-bo", tk.a, { phien: [p] });
    expect(r.body.ket_qua[0]).toMatchObject({ so_cau_moi: 10 });
    const [hoatDong] = (await sql`
      SELECT count(*)::int AS n FROM daily_activity WHERE account_id = ${acc.a}`) as any[];
    // Chỉ ngày học hôm nay được ghi, phiên cũ không sinh dòng hoạt động nào khác.
    expect(hoatDong.n).toBeLessThanOrEqual(1);
  });

  test("mã phiên của người khác bị bỏ qua, không ghi vào phiên của họ", async () => {
    const p = phienMau(goiA, () => true);
    await goi("POST", "/v1/luyen-tap/dong-bo", tk.a, { phien: [{ ...p, ket_thuc: null }] });
    const khac = {
      ...p,
      cau_tra_loi: p.cau_tra_loi.map((a) => ({ ...a, client_id: crypto.randomUUID() })),
    };
    const r = await goi("POST", "/v1/luyen-tap/dong-bo", tk.b, { phien: [khac] });
    expect(r.body.ket_qua[0].loi).toBeTruthy();
    expect(await demCauTraLoi(p.client_id)).toBe(10);
  });

  test("phiên chưa kết thúc được lưu dở, gửi tiếp phần còn lại thì kết thúc", async () => {
    const p = phienMau(goiA, () => true);
    const dau = { ...p, ket_thuc: null, cau_tra_loi: p.cau_tra_loi.slice(0, 4) };
    const r1 = await goi("POST", "/v1/luyen-tap/dong-bo", tk.a, { phien: [dau] });
    expect(r1.body.ket_qua[0]).toMatchObject({ so_cau_moi: 4, da_ket_thuc: false });
    const r2 = await goi("POST", "/v1/luyen-tap/dong-bo", tk.a, { phien: [p] });
    expect(r2.body.ket_qua[0]).toMatchObject({ so_cau_moi: 6, so_cau_trung: 4, da_ket_thuc: true });
  });

  test("dữ liệu sai dạng nhận 400", async () => {
    const r = await goi("POST", "/v1/luyen-tap/dong-bo", tk.a, { phien: [{ client_id: "khong-phai-uuid" }] });
    expect(r.status).toBe(400);
  });
});
