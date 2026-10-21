/**
 * Quản lý xem nhóm học cùng và báo cáo "Tiến độ học" (docs/PLAN.md GĐ16c) trên Postgres test thật.
 *
 * Dữ liệu gieo (tiền tố `test-gd16c`): phòng P có đội A, đội B; 10 cán bộ A1–A5, B1–B5; một
 * `quan_ly` đội A, một `quan_ly` phòng P, một `quan_tri`, một `quan_ly` chưa gắn đơn vị; X0 là cán
 * bộ chưa gắn đơn vị (đề xuất Đ11).
 *   - N1: A1 (trưởng nhóm), A2, A3, X0. Mục: bài L1, bài L2, đề ôn tập D1.
 *   - N2: B1 (trưởng nhóm), A4, A5, B2, B3. Mục: bài L1, đề ôn tập D2.
 *   - N3: B4 (trưởng nhóm), B5, chưa có mục. Chỉ có người đội B, để kiểm 404 với quản lý đội A.
 * Tiến độ gieo thẳng bằng SQL với mốc giờ cố định, để "lần học gần nhất" tính tay được. Số liệu
 * mong đợi tính tay ở hằng `MONG_DOI`, không đọc lại từ CSDL.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import { docOExcelTho, sql, taoDonVi } from "@qdpl/db";
import * as mupdf from "mupdf";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-gd16c";

async function goi(method: string, path: string, token?: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await app.request(`http://test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const ct = res.headers.get("content-type") ?? "";
  return {
    status: res.status,
    ct,
    body: ct.includes("json") ? ((await res.json()) as any) : new Uint8Array(await res.arrayBuffer()),
  };
}
const get = (path: string, token?: string) => goi("GET", path, token);

const TEN_DOI = { A: "Đội Cảnh sát giao thông", B: "Đội Cảnh sát trật tự" } as const;
const CAN_BO = ["A1", "A2", "A3", "A4", "A5", "B1", "B2", "B3", "B4", "B5"] as const;

const dv: Record<string, string> = {};
const acc: Record<string, string> = {};
const tk: Record<string, string> = {};
const bai: Record<string, string> = {};
const nhom: Record<string, string> = {};
const muc: Record<string, string> = {};
const cau: string[] = [];
let topicId = "";

/**
 * Mong đợi tính tay (13 cột của báo cáo, khoảng ngày không lọc):
 * - A1: ghi danh chuyên đề C1 (3 bài xuất bản L1–L3, bài L4 nháp không tính) và chuyên đề nháp C2
 *   (không tính). Xong L1 → 1/3 = 33,3%. Luyện tập: phiên chủ đề 3 câu (2 đúng) + phiên D1 5 câu
 *   (4 đúng); phiên trò chơi 2 câu không tính → 2 phiên, 6/8 = 75%. Đề thi: E1 (giao phòng P kèm
 *   cấp dưới), E2 (giao thẳng A1), E3 (giao đội A không kèm cấp dưới); E5 bị hủy giao không tính →
 *   3 được giao; nộp E1 (đạt), E2 (không đạt) → 2 đã nộp, 1 đạt. Nhóm N1: L1 = 100, L2 đọc 1/2
 *   khối = 50, D1 xong = 100 → ⌊250/3⌋ = 83. Học gần nhất: câu trò chơi lúc 20/9 02:00 UTC.
 * - A4: chưa ghi danh → 0/0, phần trăm trống. Phiên D2 đang làm, trả lời 2/5 (1 đúng) → 1 phiên,
 *   50%. Được giao E1, E3; chưa nộp. N2: L1 = 0, D2 = ⌊2/5·100⌋ = 40 → ⌊40/2⌋ = 20.
 * - B1: xong L1, L3 → 2/3 = 66,7%. Phiên D2 xong 5 câu (3 đúng) → 1 phiên, 60%. Được giao E1 (E3
 *   giao đội A, E4 chỉ giao phòng P), nộp đạt. N2: 100, 100 → 100. Học gần nhất: nộp E1 lúc
 *   19/9 05:00 UTC.
 */
const MONG_DOI = {
  A1: {
    ho_ten: "Cán bộ A1",
    don_vi: TEN_DOI.A,
    bai_xong: 1,
    bai_ghi_danh: 3,
    phan_tram_bai_hoc: 33.3,
    so_phien: 2,
    so_cau: 8,
    ty_le_dung: 75,
    bai_thi_duoc_giao: 3,
    bai_thi_da_nop: 2,
    bai_thi_dat: 1,
    so_nhom: 1,
    phan_tram_nhom: 83,
    lan_hoc_gan_nhat: "2026-09-20T02:00:00.000Z",
  },
  A4: {
    ho_ten: "Cán bộ A4",
    don_vi: TEN_DOI.A,
    bai_xong: 0,
    bai_ghi_danh: 0,
    phan_tram_bai_hoc: null,
    so_phien: 1,
    so_cau: 2,
    ty_le_dung: 50,
    bai_thi_duoc_giao: 2,
    bai_thi_da_nop: 0,
    bai_thi_dat: 0,
    so_nhom: 1,
    phan_tram_nhom: 20,
    lan_hoc_gan_nhat: "2026-09-14T02:02:00.000Z",
  },
  B1: {
    ho_ten: "Cán bộ B1",
    don_vi: TEN_DOI.B,
    bai_xong: 2,
    bai_ghi_danh: 3,
    phan_tram_bai_hoc: 66.7,
    so_phien: 1,
    so_cau: 5,
    ty_le_dung: 60,
    bai_thi_duoc_giao: 1,
    bai_thi_da_nop: 1,
    bai_thi_dat: 1,
    so_nhom: 1,
    phan_tram_nhom: 100,
    lan_hoc_gan_nhat: "2026-09-19T05:00:00.000Z",
  },
} as const;

async function taoTaiKhoan(ten: string, role: string, unitId: string | null) {
  const [r] = (await sql`
    INSERT INTO accounts (username, name, role, unit_id)
    VALUES (${`${PREFIX}-${ten.toLowerCase()}`}, ${`Cán bộ ${ten}`}, ${role}, ${unitId})
    RETURNING id`) as any[];
  return r.id as string;
}

async function donDep() {
  const ds = `${PREFIX}%`;
  // owner_account_id là RESTRICT: xóa nhóm trước tài khoản.
  await sql`DELETE FROM study_groups WHERE owner_account_id IN (SELECT id FROM accounts WHERE username LIKE ${ds})`;
  await sql`DELETE FROM courses WHERE slug LIKE ${ds}`;
  await sql`DELETE FROM exams WHERE title LIKE ${ds}`;
  await sql`DELETE FROM questions WHERE code LIKE ${ds}`;
  await sql`DELETE FROM question_topics WHERE code LIKE ${ds}`;
  await sql`DELETE FROM audit_log WHERE actor LIKE ${ds} OR target LIKE ${ds}`;
  await sql`DELETE FROM access_log WHERE account_id IN (SELECT id FROM accounts WHERE username LIKE ${ds})`;
  await sql`DELETE FROM accounts WHERE username LIKE ${ds}`;
  for (const cap of [3, 2, 1]) await sql`DELETE FROM units WHERE code LIKE ${ds} AND nlevel(path) = ${cap}`;
}

async function taoChuyenDe(slug: string, status: string) {
  const [c] = (await sql`
    INSERT INTO courses (slug, title, status, as_of) VALUES (${`${PREFIX}-${slug}`}, ${`Chuyên đề thử GĐ16c ${slug}`}, ${status}, '2026-09-01')
    RETURNING id`) as any[];
  return c.id as string;
}

async function taoBai(course: string, slug: string, ordinal: number, status = "xuat_ban") {
  const [l] = (await sql`
    INSERT INTO lessons (course_id, slug, ordinal, title, status)
    VALUES (${course}, ${slug}, ${ordinal}, ${`Bài thử GĐ16c ${slug}`}, ${status})
    RETURNING id`) as any[];
  for (const k of [1, 2]) {
    await sql`
      INSERT INTO lesson_blocks (lesson_id, ordinal, kind, data, status)
      VALUES (${l.id}, ${k}, 'giang', ${sql.json({ md: `Khối ${k}` })}, 'xuat_ban')`;
  }
  return l.id as string;
}

/** Tiến độ một bài; mọi mốc giờ ghi rõ để "lần học gần nhất" tính tay được. */
async function tienDoBai(ai: string, course: string, lesson: string, state: string, luc: string, khoi = 0) {
  const [e] = (await sql`
    INSERT INTO enrollments (account_id, course_id) VALUES (${acc[ai]!}, ${course})
    ON CONFLICT (account_id, course_id) DO UPDATE SET account_id = EXCLUDED.account_id
    RETURNING id`) as any[];
  await sql`
    INSERT INTO lesson_progress (enrollment_id, lesson_id, state, last_block_ordinal, started_at, finished_at, updated_at)
    VALUES (${e.id}, ${lesson}, ${state}, ${khoi}, ${luc}, ${state === "xong" ? luc : null}, ${luc})`;
}

/** Một phiên với `dung` là đúng/sai từng câu; câu thứ k trả lời lúc `batDau` + k phút. */
async function phien(
  ai: string,
  p: { source: string; batDau: string; dung: boolean[]; xong: boolean; tong?: number; mucId?: string },
) {
  const bd = new Date(p.batDau);
  const [s] = (await sql`
    INSERT INTO practice_sessions (account_id, topic_id, source, group_item_id, total, started_at, finished_at, correct)
    VALUES (${acc[ai]!}, ${topicId}, ${p.source}, ${p.mucId ?? null}, ${p.tong ?? p.dung.length}, ${bd},
            ${p.xong ? new Date(bd.getTime() + 10 * 60_000) : null}, ${p.xong ? p.dung.filter(Boolean).length : null})
    RETURNING id`) as any[];
  for (const [k, d] of p.dung.entries()) {
    await sql`
      INSERT INTO practice_answers (session_id, question_id, question_version, correct, created_at)
      VALUES (${s.id}, ${cau[k]!}, 1, ${d}, ${new Date(bd.getTime() + (k + 1) * 60_000)})`;
  }
}

async function taoDe(ten: string) {
  const [de] = (await sql`
    INSERT INTO exams (title, matrix, question_count, duration_minutes, pass_score, status, published_at)
    VALUES (${`${PREFIX} ${ten}`}, '[]', 30, 45, 70, 'xuat_ban', now())
    RETURNING id`) as any[];
  return de.id as string;
}

async function giao(
  examId: string,
  dich: { unitId?: string; accountId?: string; kemCapDuoi?: boolean; huy?: boolean },
) {
  const [g] = (await sql`
    INSERT INTO exam_assignments (exam_id, unit_id, account_id, include_subunits, opens_at, due_at, assigned_by, cancelled_at)
    VALUES (${examId}, ${dich.unitId ?? null}, ${dich.accountId ?? null}, ${dich.kemCapDuoi ?? true},
            '2026-09-01', '2026-10-31', ${`${PREFIX}-seed`}, ${dich.huy ? new Date("2026-09-02T00:00:00Z") : null})
    RETURNING id`) as any[];
  return g.id as string;
}

async function nop(examId: string, giaoId: string, ai: string, luc: string, diem: number) {
  const n = new Date(luc);
  await sql`
    INSERT INTO exam_attempts (exam_id, assignment_id, account_id, attempt_no, items, started_at, deadline_at,
                               submitted_at, submit_kind, correct, total, score, passed, status)
    VALUES (${examId}, ${giaoId}, ${acc[ai]!}, 1, '[]', ${new Date(n.getTime() - 20 * 60_000)},
            ${new Date(n.getTime() + 25 * 60_000)}, ${n}, 'nguoi_thi', ${Math.round((diem * 30) / 100)}, 30,
            ${diem}, ${diem >= 70}, 'da_nop')`;
}

/** Tạo nhóm và tham gia qua API người học có sẵn (GĐ16a). */
async function lapNhom(ten: string, truong: string, thanhVien: string[]): Promise<string> {
  const r = await goi("POST", "/v1/nhom", tk[truong], { ten });
  expect(r.status).toBe(201);
  for (const ai of thanhVien) {
    expect((await goi("POST", "/v1/nhom/tham-gia", tk[ai], { ma: r.body.ma_moi })).status).toBe(200);
  }
  return r.body.id as string;
}

async function chiaSe(groupId: string, truong: string, body: unknown): Promise<string> {
  const r = await goi("POST", `/v1/nhom/${groupId}/muc`, tk[truong], body);
  expect(r.status).toBe(201);
  return r.body.id as string;
}

beforeAll(async () => {
  await donDep();
  const a = `${PREFIX}-seed`;
  dv.P = (await taoDonVi({ code: `${PREFIX}-P`, name: "Phòng thử GĐ16c" }, a)).id;
  dv.A = (await taoDonVi({ code: `${PREFIX}-A`, name: TEN_DOI.A, parentId: dv.P, ordinal: 0 }, a)).id;
  dv.B = (await taoDonVi({ code: `${PREFIX}-B`, name: TEN_DOI.B, parentId: dv.P, ordinal: 1 }, a)).id;
  for (const n of CAN_BO) acc[n] = await taoTaiKhoan(n, "can_bo", dv[n[0]!]!);
  acc.X0 = await taoTaiKhoan("X0", "can_bo", null);
  acc.quanLyA = await taoTaiKhoan("quan-ly-a", "quan_ly", dv.A!);
  acc.quanLyP = await taoTaiKhoan("quan-ly-p", "quan_ly", dv.P!);
  acc.quanTri = await taoTaiKhoan("quan-tri", "quan_tri", null);
  acc.quanLyTrong = await taoTaiKhoan("quan-ly-trong", "quan_ly", null);
  for (const k of Object.keys(acc)) tk[k] = (await createSession(acc[k]!, "test")).token;

  // Nội dung: chuyên đề C1 xuất bản (L1–L3 xuất bản, L4 nháp), chuyên đề C2 nháp (L5).
  const c1 = await taoChuyenDe("c1", "xuat_ban");
  const c2 = await taoChuyenDe("c2", "nhap");
  bai.L1 = await taoBai(c1, "l1", 1);
  bai.L2 = await taoBai(c1, "l2", 2);
  bai.L3 = await taoBai(c1, "l3", 3);
  bai.L4 = await taoBai(c1, "l4", 4, "nhap");
  bai.L5 = await taoBai(c2, "l5", 1);
  const [t] = (await sql`
    INSERT INTO question_topics (code, name) VALUES (${`${PREFIX}-t`}, 'Chủ đề thử GĐ16c') RETURNING id`) as any[];
  topicId = t.id;
  for (let i = 1; i <= 5; i++) {
    const [q] = (await sql`
      INSERT INTO questions (code, topic_id, level, kind, stem, options, answer, explanation, status)
      VALUES (${`${PREFIX}-${i}`}, ${topicId}, ${(["de", "trung_binh", "kho"] as const)[i % 3]!}, 'dung_sai',
              ${`Nhận định thử GĐ16c số ${i}`}, '{}', ${sql.json({ dung: ["dung"] })}, 'Giải thích.', 'da_duyet')
      RETURNING id`) as any[];
    cau.push(q.id);
  }

  // Nhóm, lập bằng API người học.
  nhom.N1 = await lapNhom("Nhóm thử GĐ16c một", "A1", ["A2", "A3", "X0"]);
  nhom.N2 = await lapNhom("Nhóm thử GĐ16c hai", "B1", ["A4", "A5", "B2", "B3"]);
  nhom.N3 = await lapNhom("Nhóm thử GĐ16c ba", "B4", ["B5"]);
  const de = { loai: "de_on_tap", topic_id: topicId, so_cau: 5, ten: "Đề ôn thử GĐ16c" };
  muc.N1L1 = await chiaSe(nhom.N1, "A1", { loai: "bai_hoc", lesson_id: bai.L1 });
  muc.N1L2 = await chiaSe(nhom.N1, "A1", { loai: "bai_hoc", lesson_id: bai.L2 });
  muc.D1 = await chiaSe(nhom.N1, "A1", de);
  muc.N2L1 = await chiaSe(nhom.N2, "B1", { loai: "bai_hoc", lesson_id: bai.L1 });
  muc.D2 = await chiaSe(nhom.N2, "B1", de);

  // Bài học.
  await tienDoBai("A1", c1, bai.L1!, "xong", "2026-09-10T03:00:00Z");
  await tienDoBai("A1", c1, bai.L2!, "dang_hoc", "2026-09-11T03:00:00Z", 1);
  await tienDoBai("A1", c2, bai.L5!, "xong", "2026-09-11T04:00:00Z");
  await tienDoBai("B1", c1, bai.L1!, "xong", "2026-09-09T02:00:00Z");
  await tienDoBai("B1", c1, bai.L3!, "xong", "2026-09-18T02:00:00Z");

  // Luyện tập.
  await phien("A1", {
    source: "chu_de",
    batDau: "2026-09-12T02:04:00Z",
    dung: [true, false, true],
    xong: true,
  });
  await phien("A1", {
    source: "nhom",
    mucId: muc.D1,
    batDau: "2026-09-13T02:00:00Z",
    dung: [true, true, true, true, false],
    xong: true,
  });
  await phien("A1", {
    source: "game:vuot_man",
    batDau: "2026-09-20T01:58:00Z",
    dung: [true, true],
    xong: true,
  });
  await phien("A4", {
    source: "nhom",
    mucId: muc.D2,
    batDau: "2026-09-14T02:00:00Z",
    dung: [true, false],
    tong: 5,
    xong: false,
  });
  await phien("B1", {
    source: "nhom",
    mucId: muc.D2,
    batDau: "2026-09-19T02:00:00Z",
    dung: [true, true, true, false, false],
    xong: true,
  });

  // Thi.
  const e1 = await taoDe("Đề E1");
  const e2 = await taoDe("Đề E2");
  const e3 = await taoDe("Đề E3");
  const e4 = await taoDe("Đề E4");
  const e5 = await taoDe("Đề E5");
  const g1 = await giao(e1, { unitId: dv.P, kemCapDuoi: true });
  const g2 = await giao(e2, { accountId: acc.A1 });
  await giao(e3, { unitId: dv.A, kemCapDuoi: false });
  await giao(e4, { unitId: dv.P, kemCapDuoi: false });
  const g5 = await giao(e5, { unitId: dv.A, huy: true });
  await nop(e1, g1, "A1", "2026-09-15T02:00:00Z", 80);
  await nop(e2, g2, "A1", "2026-09-16T02:00:00Z", 50);
  await nop(e5, g5, "A1", "2026-09-17T02:00:00Z", 90);
  await nop(e1, g1, "B1", "2026-09-19T05:00:00Z", 75);
}, 60_000);

afterAll(async () => {
  await donDep();
});

/** Mọi chuỗi trong phản hồi ghép lại, để kiểm không lộ họ tên hay id của người ngoài phạm vi. */
const chuoi = (v: unknown) => JSON.stringify(v);

/* ------------------------------------------------------------------ */
/* Quyền và phạm vi của API quản lý nhóm                               */
/* ------------------------------------------------------------------ */

describe("quyền", () => {
  test("chưa đăng nhập 401; can_bo 403 ở cả ba route; quan_ly chưa gắn đơn vị 403", async () => {
    expect((await get("/v1/quan-tri/nhom")).status).toBe(401);
    expect((await get("/v1/quan-tri/nhom", tk.A1)).status).toBe(403);
    expect((await get(`/v1/quan-tri/nhom/${nhom.N1}`, tk.A1)).status).toBe(403);
    expect((await goi("POST", `/v1/quan-tri/nhom/${nhom.N1}/luu-tru`, tk.A1)).status).toBe(403);
    const r = await get("/v1/quan-tri/nhom", tk.quanLyTrong);
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe("ngoai_pham_vi");
  });

  test("quan_ly đội A lọc đơn vị đội B nhận 403; tham số lạ nhận 400", async () => {
    expect((await get(`/v1/quan-tri/nhom?don_vi=${dv.B}`, tk.quanLyA)).status).toBe(403);
    expect((await get("/v1/quan-tri/nhom?phan_tram=100", tk.quanLyA)).status).toBe(400);
  });
});

describe("phạm vi", () => {
  test("quan_ly đội A: thấy N1, N2, không thấy N3; N2 có 2 người trong và 3 người ngoài phạm vi", async () => {
    const r = await get("/v1/quan-tri/nhom", tk.quanLyA);
    expect(r.status).toBe(200);
    const theoId = new Map(r.body.items.map((g: any) => [g.id, g]));
    expect(theoId.has(nhom.N1)).toBe(true);
    expect(theoId.has(nhom.N3)).toBe(false);
    // N1: A1, A2, A3 trong phạm vi; X0 chưa gắn đơn vị là ngoài phạm vi (Đ11). ⌊(83 + 0 + 0) / 3⌋ = 27.
    expect(theoId.get(nhom.N1)).toMatchObject({
      truong_nhom: "Cán bộ A1",
      so_trong_pham_vi: 3,
      so_ngoai_pham_vi: 1,
      so_muc: 3,
      trung_binh_trong_pham_vi: 27,
      luu_tru_duoc: true,
    });
    // N2: A4 (20), A5 (0) → ⌊20 / 2⌋ = 10. Trưởng nhóm B1 ngoài phạm vi: không có tên.
    expect(theoId.get(nhom.N2)).toMatchObject({
      truong_nhom: null,
      truong_nhom_trong_pham_vi: false,
      so_trong_pham_vi: 2,
      so_ngoai_pham_vi: 3,
      trung_binh_trong_pham_vi: 10,
      luu_tru_duoc: false,
    });
    for (const ai of ["B1", "B2", "B3", "B4", "B5", "X0"]) {
      expect(chuoi(r.body)).not.toContain(`Cán bộ ${ai}`);
      expect(chuoi(r.body)).not.toContain(acc[ai]!);
    }
  });

  test("quan_ly đội A xem chi tiết N2: chỉ A4, A5 kèm tiến độ từng mục; không có tên, id người đội B", async () => {
    const r = await get(`/v1/quan-tri/nhom/${nhom.N2}`, tk.quanLyA);
    expect(r.status).toBe(200);
    expect(r.body.so_trong_pham_vi).toBe(2);
    expect(r.body.so_ngoai_pham_vi).toBe(3);
    expect(r.body.truong_nhom).toBeNull();
    expect(r.body.muc.map((m: any) => [m.id, m.loai, m.trang_thai])).toEqual([
      [muc.N2L1, "bai_hoc", "tinh"],
      [muc.D2, "de_on_tap", "tinh"],
    ]);
    expect(r.body.thanh_vien.map((t: any) => t.ho_ten)).toEqual(["Cán bộ A4", "Cán bộ A5"]);
    const a4 = r.body.thanh_vien[0];
    expect(a4).toMatchObject({
      don_vi: TEN_DOI.A,
      phan_tram: 20,
      muc: { [muc.N2L1!]: 0, [muc.D2!]: 40 },
      ket_qua_de: { [muc.D2!]: null },
      lan_hoc_gan_nhat: MONG_DOI.A4.lan_hoc_gan_nhat,
    });
    expect(r.body.trung_binh_trong_pham_vi).toBe(10);
    for (const ai of ["B1", "B2", "B3"]) {
      expect(chuoi(r.body)).not.toContain(`Cán bộ ${ai}`);
      expect(chuoi(r.body)).not.toContain(acc[ai]!);
    }
  });

  test("quan_ly đội A xem N3 (không có ai trong phạm vi) nhận 404; id sai dạng 404", async () => {
    expect((await get(`/v1/quan-tri/nhom/${nhom.N3}`, tk.quanLyA)).status).toBe(404);
    expect((await get("/v1/quan-tri/nhom/khong-phai-id", tk.quanLyA)).status).toBe(404);
  });

  test("quan_ly phòng P thấy cả hai đội; kết quả đề ôn tập của B1 hiện cho quản lý", async () => {
    const r = await get("/v1/quan-tri/nhom", tk.quanLyP);
    const theoId = new Map(r.body.items.map((g: any) => [g.id, g]));
    // N2: B1 (100), A4 (20), A5, B2, B3 (0) → ⌊120 / 5⌋ = 24.
    expect(theoId.get(nhom.N2)).toMatchObject({
      truong_nhom: "Cán bộ B1",
      so_trong_pham_vi: 5,
      so_ngoai_pham_vi: 0,
      trung_binh_trong_pham_vi: 24,
      luu_tru_duoc: true,
    });
    expect(theoId.get(nhom.N3)).toMatchObject({
      so_trong_pham_vi: 2,
      so_muc: 0,
      trung_binh_trong_pham_vi: null,
    });
    // X0 chưa gắn đơn vị vẫn ngoài phạm vi của quản lý cấp phòng (Đ11).
    expect(theoId.get(nhom.N1)).toMatchObject({ so_trong_pham_vi: 3, so_ngoai_pham_vi: 1 });

    const ct = await get(`/v1/quan-tri/nhom/${nhom.N2}`, tk.quanLyP);
    expect(ct.body.thanh_vien.map((t: any) => t.ho_ten)).toEqual([
      "Cán bộ B1",
      "Cán bộ A4",
      "Cán bộ A5",
      "Cán bộ B2",
      "Cán bộ B3",
    ]);
    expect(ct.body.thanh_vien[0]).toMatchObject({
      vai_tro: "truong_nhom",
      phan_tram: 100,
      ket_qua_de: { [muc.D2!]: { so_cau_dung: 3, so_cau: 5 } },
    });
  });

  test("quan_tri thấy tất cả, kể cả thành viên chưa gắn đơn vị; lọc tên và trạng thái", async () => {
    const r = await get(`/v1/quan-tri/nhom?don_vi=${dv.P}`, tk.quanTri);
    const theoId = new Map(r.body.items.map((g: any) => [g.id, g]));
    expect([nhom.N1, nhom.N2, nhom.N3].every((id) => theoId.has(id))).toBe(true);
    // N1: A1 (83), A2, A3, X0 (0) → ⌊83 / 4⌋ = 20.
    expect(theoId.get(nhom.N1)).toMatchObject({
      so_trong_pham_vi: 4,
      so_ngoai_pham_vi: 0,
      trung_binh_trong_pham_vi: 20,
    });
    const ct = await get(`/v1/quan-tri/nhom/${nhom.N1}`, tk.quanTri);
    expect(ct.body.thanh_vien.map((t: any) => t.ho_ten)).toContain("Cán bộ X0");
    expect(ct.body.thanh_vien.find((t: any) => t.ho_ten === "Cán bộ A1")).toMatchObject({
      phan_tram: 83,
      muc: { [muc.N1L1!]: 100, [muc.N1L2!]: 50, [muc.D1!]: 100 },
      ket_qua_de: { [muc.D1!]: { so_cau_dung: 4, so_cau: 5 } },
    });

    const tim = await get(`/v1/quan-tri/nhom?q=${encodeURIComponent("GĐ16c hai")}`, tk.quanTri);
    expect(tim.body.items.map((g: any) => g.id)).toEqual([nhom.N2]);
    const luuTru = await get(`/v1/quan-tri/nhom?don_vi=${dv.P}&trang_thai=luu_tru`, tk.quanTri);
    expect(luuTru.body.items.some((g: any) => [nhom.N1, nhom.N2, nhom.N3].includes(g.id))).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Báo cáo tiến độ học                                                 */
/* ------------------------------------------------------------------ */

const BAO_CAO = "/v1/bao-cao/tien-do-hoc";
const KHOA_13 = [
  "ho_ten",
  "don_vi",
  "bai_xong",
  "bai_ghi_danh",
  "phan_tram_bai_hoc",
  "so_phien",
  "ty_le_dung",
  "bai_thi_duoc_giao",
  "bai_thi_da_nop",
  "bai_thi_dat",
  "so_nhom",
  "phan_tram_nhom",
  "lan_hoc_gan_nhat",
] as const;
const TIEU_DE_13 = [
  "Họ tên",
  "Đơn vị",
  "Bài đã xong",
  "Bài ghi danh",
  "Bài học (%)",
  "Số phiên",
  "Đúng (%)",
  "Được giao",
  "Đã nộp",
  "Đạt",
  "Số nhóm",
  "TB nhóm (%)",
  "Học gần nhất",
];

describe("báo cáo tiến độ học: phạm vi", () => {
  test("can_bo 403; quan_ly chưa gắn đơn vị 403; quan_ly đội A lọc đội B 403", async () => {
    expect((await get(BAO_CAO, tk.A1)).status).toBe(403);
    expect((await get(BAO_CAO, tk.quanLyTrong)).status).toBe(403);
    expect((await get(`${BAO_CAO}?don_vi=${dv.B}`, tk.quanLyA)).status).toBe(403);
  });

  test("quan_ly đội A chỉ thấy người đội A (5 cán bộ và chính mình)", async () => {
    const r = await get(BAO_CAO, tk.quanLyA);
    expect(r.status).toBe(200);
    expect(r.body.dong.map((d: any) => d.ho_ten).sort()).toEqual(
      ["Cán bộ A1", "Cán bộ A2", "Cán bộ A3", "Cán bộ A4", "Cán bộ A5", "Cán bộ quan-ly-a"].sort(),
    );
    expect(r.body.dong.every((d: any) => d.don_vi === TEN_DOI.A)).toBe(true);
    expect(chuoi(r.body)).not.toContain("Cán bộ B");
  });

  test("quan_ly phòng P thấy đủ 10 cán bộ của hai đội; quan_tri lọc phòng P cũng vậy", async () => {
    for (const token of [tk.quanLyP, tk.quanTri]) {
      const r = await get(`${BAO_CAO}?don_vi=${dv.P}`, token);
      expect(r.status).toBe(200);
      const ten = r.body.dong.map((d: any) => d.ho_ten);
      for (const n of CAN_BO) expect(ten).toContain(`Cán bộ ${n}`);
      // 10 cán bộ và hai tài khoản quản lý thuộc phòng P; X0 chưa gắn đơn vị không có dòng.
      expect(r.body.dong.length).toBe(12);
      expect(ten).not.toContain("Cán bộ X0");
    }
  });

  test("lọc nhóm N2 với quan_ly đội A trả đúng 2 dòng; nhóm không có ai trong phạm vi nhận 404", async () => {
    const r = await get(`${BAO_CAO}?nhom=${nhom.N2}`, tk.quanLyA);
    expect(r.status).toBe(200);
    expect(r.body.dong.map((d: any) => d.ho_ten).sort()).toEqual(["Cán bộ A4", "Cán bộ A5"]);
    expect(r.body.nhom).toEqual({ id: nhom.N2, ten: "Nhóm thử GĐ16c hai" });
    expect((await get(`${BAO_CAO}?nhom=${nhom.N3}`, tk.quanLyA)).status).toBe(404);
  });
});

describe("báo cáo tiến độ học: số liệu khớp phép tính tay", () => {
  test("13 cột của A1, A4, B1", async () => {
    const r = await get(`${BAO_CAO}?don_vi=${dv.P}`, tk.quanTri);
    const theoTen = new Map(r.body.dong.map((d: any) => [d.ho_ten, d]));
    for (const ai of ["A1", "A4", "B1"] as const) {
      const d = theoTen.get(`Cán bộ ${ai}`) as any;
      expect(d).toMatchObject(MONG_DOI[ai]);
      for (const k of KHOA_13) expect(k in d).toBe(true);
    }
    // Không học gì: số 0, phần trăm trống, không có lần học.
    expect(theoTen.get("Cán bộ A2")).toMatchObject({
      bai_ghi_danh: 0,
      phan_tram_bai_hoc: null,
      so_phien: 0,
      ty_le_dung: null,
      bai_thi_duoc_giao: 2,
      so_nhom: 1,
      phan_tram_nhom: 0,
      lan_hoc_gan_nhat: null,
    });
    // B4 ở nhóm N3 chưa có mục: có nhóm nhưng phần trăm trống.
    expect(theoTen.get("Cán bộ B4")).toMatchObject({ so_nhom: 1, phan_tram_nhom: null });
    // Quản lý phòng P: E1 (phòng P kèm cấp dưới) và E4 (chỉ phòng P).
    expect(theoTen.get("Cán bộ quan-ly-p")).toMatchObject({
      bai_thi_duoc_giao: 2,
      don_vi: "Phòng thử GĐ16c",
    });
  });

  test("lọc khoảng ngày 12/9–16/9: bài xong, luyện tập, bài nộp theo mốc; được giao không đổi", async () => {
    const r = await get(`${BAO_CAO}?don_vi=${dv.P}&tu=2026-09-12&den=2026-09-16`, tk.quanTri);
    const theoTen = new Map(r.body.dong.map((d: any) => [d.ho_ten, d]));
    // A1: L1 xong 10/9 nằm ngoài khoảng; hai phiên 12/9, 13/9 trong khoảng; E1 15/9 và E2 16/9 trong khoảng.
    expect(theoTen.get("Cán bộ A1")).toMatchObject({
      bai_xong: 0,
      bai_ghi_danh: 3,
      phan_tram_bai_hoc: 0,
      so_phien: 2,
      bai_thi_duoc_giao: 3,
      bai_thi_da_nop: 2,
      bai_thi_dat: 1,
    });
    // B1: mọi hoạt động từ 18/9 trở đi.
    expect(theoTen.get("Cán bộ B1")).toMatchObject({
      bai_xong: 0,
      so_phien: 0,
      ty_le_dung: null,
      bai_thi_duoc_giao: 1,
      bai_thi_da_nop: 0,
    });
  });
});

describe("báo cáo tiến độ học: xuất tệp", () => {
  const demNhatKy = async () =>
    (
      (await sql`
      SELECT count(*)::int AS n FROM audit_log
      WHERE action = 'bao_cao.xuat' AND target = 'tien-do-hoc' AND actor = ${`${PREFIX}-quan-ly-p`}`) as any[]
    )[0].n as number;

  test("Excel: đúng 13 tiêu đề cột, đúng số dòng, cột số là kiểu số; mỗi lần xuất một dòng nhật ký", async () => {
    const truoc = await demNhatKy();
    const r = await get(`${BAO_CAO}?don_vi=${dv.P}&dinh_dang=xlsx`, tk.quanLyP);
    expect(r.status).toBe(200);
    expect(r.ct).toContain("spreadsheetml");
    const [tieuDe, ...conLai] = await docOExcelTho(r.body as Uint8Array);
    expect(tieuDe).toEqual(TIEU_DE_13);
    const hetDuLieu = conLai.findIndex((d) => d.every((o) => o === null || o === undefined));
    const dong = hetDuLieu < 0 ? conLai : conLai.slice(0, hetDuLieu);
    expect(dong.length).toBe(12);
    for (const d of dong) {
      // Cột đếm luôn là số; cột phần trăm là số hoặc ô trống (exceljs đọc ô trống thành undefined).
      for (const cot of [2, 3, 5, 7, 8, 9, 10]) expect(typeof d[cot]).toBe("number");
      for (const cot of [4, 6, 11]) expect(d[cot] == null || typeof d[cot] === "number").toBe(true);
    }
    const a1 = dong.find((d) => d[0] === "Cán bộ A1")!;
    expect(a1.slice(2, 12)).toEqual([1, 3, 33.3, 2, 75, 3, 2, 1, 1, 83]);
    expect(conLai.flat()).toContain("Đơn vị: Phòng thử GĐ16c");
    expect(await demNhatKy()).toBe(truoc + 1);
  });

  test("PDF: có trang, đủ 13 tiêu đề không bị cắt, chữ tiếng Việt đúng dấu; ghi nhật ký kèm nhóm", async () => {
    const truoc = await demNhatKy();
    const r = await get(`${BAO_CAO}?don_vi=${dv.P}&nhom=${nhom.N2}&dinh_dang=pdf`, tk.quanLyP);
    expect(r.status).toBe(200);
    expect(r.ct).toBe("application/pdf");
    const doc = mupdf.Document.openDocument(r.body as Uint8Array, "application/pdf");
    expect(doc.countPages()).toBeGreaterThanOrEqual(1);
    const chu = doc.loadPage(0).toStructuredText().asText();
    expect(chu).toContain("Tiến độ học, nhóm Nhóm thử GĐ16c hai");
    // Tiêu đề cột không bị cắt; tên đơn vị dài thì PDF cắt kèm "…" (bản đầy đủ ở Excel).
    for (const t of TIEU_DE_13) expect(chu).toContain(t);
    expect(chu).toContain("Cán bộ A4");
    expect(chu).toContain("Đội Cảnh sát");
    expect(chu).toContain("Nhóm học cùng: Nhóm thử GĐ16c hai");
    expect(chu).toContain("Người xuất: Cán bộ quan-ly-p");
    expect(await demNhatKy()).toBe(truoc + 1);
    const [nk] = (await sql`
      SELECT detail FROM audit_log WHERE action = 'bao_cao.xuat' AND target = 'tien-do-hoc'
        AND actor = ${`${PREFIX}-quan-ly-p`} ORDER BY id DESC LIMIT 1`) as any[];
    expect(nk.detail).toMatchObject({ dinh_dang: "pdf", nhom: nhom.N2, so_dong: 5 });
  });
});

/* ------------------------------------------------------------------ */
/* Hiệu năng                                                           */
/* ------------------------------------------------------------------ */

describe("hiệu năng", () => {
  test("báo cáo 1.000 cán bộ, 50 nhóm (20 thành viên, 10 mục mỗi nhóm) trả JSON và Excel dưới 2 giây", async () => {
    const a = `${PREFIX}-seed`;
    const q = (await taoDonVi({ code: `${PREFIX}-Q`, name: "Phòng thử hiệu năng GĐ16c" }, a)).id;
    const doi: string[] = [];
    for (let d = 0; d < 10; d++) {
      doi.push((await taoDonVi({ code: `${PREFIX}-Q${d}`, name: `Đội hiệu năng ${d}`, parentId: q }, a)).id);
    }
    await sql`
      INSERT INTO accounts (username, name, role, unit_id)
      SELECT ${`${PREFIX}-q-`} || lpad(i::text, 4, '0'), 'Cán bộ hiệu năng ' || i, 'can_bo', (${doi}::uuid[])[(i % 10) + 1]
      FROM generate_series(0, 999) i`;
    const ids = (
      (await sql`SELECT id FROM accounts WHERE username LIKE ${`${PREFIX}-q-%`} ORDER BY username`) as any[]
    ).map((r) => r.id as string);
    expect(ids.length).toBe(1000);

    // Chuyên đề riêng 5 bài; mỗi người xong 3 bài, đang học 2 bài.
    const cp = await taoChuyenDe("cp", "xuat_ban");
    const baiP: string[] = [];
    for (let k = 1; k <= 5; k++) baiP.push(await taoBai(cp, `p${k}`, k));
    await sql`INSERT INTO enrollments (account_id, course_id) SELECT unnest(${ids}::uuid[]), ${cp}`;
    await sql`
      INSERT INTO lesson_progress (enrollment_id, lesson_id, state, last_block_ordinal, finished_at, updated_at)
      SELECT e.id, l.id, CASE WHEN l.ordinal <= 3 THEN 'xong' ELSE 'dang_hoc' END, 1,
             CASE WHEN l.ordinal <= 3 THEN now() - interval '2 days' END, now() - interval '2 days'
      FROM enrollments e JOIN lessons l ON l.course_id = ${cp}
      WHERE e.course_id = ${cp}`;

    // 50 nhóm × 20 thành viên; 5 bài học và 5 đề ôn tập mỗi nhóm. Mã mời có số 0 nên không trùng mã thật.
    await sql`
      INSERT INTO study_groups (name, owner_account_id, unit_id, invite_code)
      SELECT 'Nhóm hiệu năng ' || g, (${ids}::uuid[])[g * 20 + 1], ${q}, 'Q' || lpad(g::text, 7, '0')
      FROM generate_series(0, 49) g`;
    const nhomP = (await sql`
      SELECT id, substr(invite_code, 2)::int AS g FROM study_groups
      WHERE owner_account_id = ANY(${ids}::uuid[])`) as any[];
    expect(nhomP.length).toBe(50);
    const nhomIds = nhomP.map((r) => r.id as string);
    await sql`
      INSERT INTO study_group_members (group_id, account_id, role)
      SELECT n.id, (${ids}::uuid[])[n.g * 20 + k + 1], CASE WHEN k = 0 THEN 'truong_nhom' ELSE 'thanh_vien' END
      FROM (SELECT id, substr(invite_code, 2)::int AS g FROM study_groups WHERE id = ANY(${nhomIds}::uuid[])) n,
           generate_series(0, 19) k`;
    await sql`
      INSERT INTO study_group_items (group_id, kind, lesson_id, ordinal)
      SELECT n, 'bai_hoc', (${baiP}::uuid[])[j + 1], j FROM unnest(${nhomIds}::uuid[]) n, generate_series(0, 4) j`;
    await sql`
      INSERT INTO study_group_items (group_id, kind, topic_id, question_ids, title, ordinal)
      SELECT n, 'de_on_tap', ${topicId}, ${cau}::uuid[], 'Đề hiệu năng ' || j, 5 + j
      FROM unnest(${nhomIds}::uuid[]) n, generate_series(0, 4) j`;

    // Mỗi thành viên một phiên đã kết thúc cho mỗi đề ôn tập (5.000 phiên, 25.000 câu trả lời),
    // cộng một phiên chủ đề 5 câu mỗi người.
    await sql`
      INSERT INTO practice_sessions (account_id, topic_id, source, group_item_id, total, started_at, finished_at, correct)
      SELECT m.account_id, ${topicId}, 'nhom', i.id, 5, now() - interval '1 day', now() - interval '1 day' + interval '10 minutes', 3
      FROM study_group_members m JOIN study_group_items i ON i.group_id = m.group_id AND i.kind = 'de_on_tap'
      WHERE m.group_id = ANY(${nhomIds}::uuid[])`;
    await sql`
      INSERT INTO practice_sessions (account_id, topic_id, source, total, started_at, finished_at, correct)
      SELECT unnest(${ids}::uuid[]), ${topicId}, 'chu_de', 5, now() - interval '3 hours', now() - interval '2 hours', 4`;
    await sql`
      INSERT INTO practice_answers (session_id, question_id, question_version, correct, created_at)
      SELECT s.id, (${cau}::uuid[])[k], 1, k <= 3, s.started_at + k * interval '1 minute'
      FROM practice_sessions s, generate_series(1, 5) k
      WHERE s.account_id = ANY(${ids}::uuid[])`;

    // Một đề giao cả phòng, mỗi người một lượt đã nộp.
    const de = await taoDe("Đề hiệu năng");
    const g = await giao(de, { unitId: q, kemCapDuoi: true });
    await sql`
      INSERT INTO exam_attempts (exam_id, assignment_id, account_id, attempt_no, items, started_at, deadline_at,
                                 submitted_at, submit_kind, correct, total, score, passed, status)
      SELECT ${de}, ${g}, x.id, 1, '[]', now() - interval '5 hours', now() - interval '4 hours',
             now() - interval '4 hours 30 minutes', 'nguoi_thi', 20, 30, 66.67, false, 'da_nop'
      FROM unnest(${ids}::uuid[]) AS x(id)`;

    // Trung vị của 5 lần gọi mỗi đường, như test hiệu năng GĐ16a: máy dev chạy Postgres trong
    // Docker, một lần gọi lẻ có thể bị chậm vì đĩa ảo đang ghi dữ liệu vừa nạp.
    const doDuoc: Record<string, number[]> = {};
    for (const [ten, duong] of [
      ["JSON", `${BAO_CAO}?don_vi=${q}`],
      ["Excel", `${BAO_CAO}?don_vi=${q}&dinh_dang=xlsx`],
      ["Danh sách nhóm", `/v1/quan-tri/nhom?don_vi=${q}`],
    ] as const) {
      doDuoc[ten] = [];
      for (let lan = 0; lan < 5; lan++) {
        const batDau = performance.now();
        const r = await get(duong, tk.quanTri);
        doDuoc[ten]!.push(Math.round(performance.now() - batDau));
        expect(r.status).toBe(200);
      }
    }
    console.log("[quan-tri-nhom.test] thời gian (ms):", JSON.stringify(doDuoc));
    const trungVi = (ms: number[]) => [...ms].sort((x, y) => x - y)[Math.floor(ms.length / 2)]!;
    for (const ms of Object.values(doDuoc)) expect(trungVi(ms)).toBeLessThan(2000);

    const r = await get(`${BAO_CAO}?don_vi=${q}`, tk.quanTri);
    expect(r.body.dong.length).toBe(1000);
    // Mỗi người: 3/5 bài xong; 6 phiên, 18/30 câu đúng; 1 nhóm, ⌊(100·3 + 50·2 + 100·5) / 10⌋ = 90.
    expect(r.body.dong[0]).toMatchObject({
      bai_xong: 3,
      bai_ghi_danh: 5,
      phan_tram_bai_hoc: 60,
      so_phien: 6,
      ty_le_dung: 60,
      bai_thi_duoc_giao: 1,
      bai_thi_da_nop: 1,
      bai_thi_dat: 0,
      so_nhom: 1,
      phan_tram_nhom: 90,
    });
    const ds = await get(`/v1/quan-tri/nhom?don_vi=${q}`, tk.quanTri);
    expect(ds.body.items.length).toBe(50);
  }, 120_000);
});

/* ------------------------------------------------------------------ */
/* Lưu trữ nhóm từ trang quản trị (chạy sau cùng: đổi trạng thái N2)   */
/* ------------------------------------------------------------------ */

describe("lưu trữ nhóm (N11)", () => {
  test("quan_ly đội A lưu trữ N2 (trưởng nhóm đội B) nhận 403; N3 nhận 404", async () => {
    const r = await goi("POST", `/v1/quan-tri/nhom/${nhom.N2}/luu-tru`, tk.quanLyA);
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe("ngoai_pham_vi");
    expect((await goi("POST", `/v1/quan-tri/nhom/${nhom.N3}/luu-tru`, tk.quanLyA)).status).toBe(404);
    const [g] = (await sql`SELECT status FROM study_groups WHERE id = ${nhom.N2!}`) as any[];
    expect(g.status).toBe("hoat_dong");
  });

  test("quan_ly phòng P lưu trữ N2 được, có đúng 1 dòng audit_log nhom.luu_tru; lần hai nhận 409", async () => {
    const r = await goi("POST", `/v1/quan-tri/nhom/${nhom.N2}/luu-tru`, tk.quanLyP);
    expect(r.status).toBe(200);
    const [g] = (await sql`SELECT status, archived_by FROM study_groups WHERE id = ${nhom.N2!}`) as any[];
    expect(g).toEqual({ status: "luu_tru", archived_by: acc.quanLyP });
    const nk = (await sql`
      SELECT actor, detail FROM audit_log WHERE action = 'nhom.luu_tru' AND target = ${nhom.N2!}`) as any[];
    expect(nk.length).toBe(1);
    expect(nk[0]).toMatchObject({ actor: `${PREFIX}-quan-ly-p`, detail: { so_thanh_vien: 5 } });
    expect((await goi("POST", `/v1/quan-tri/nhom/${nhom.N2}/luu-tru`, tk.quanLyP)).status).toBe(409);

    // Thành viên vẫn xem được nhóm đã lưu trữ; báo cáo không còn tính N2 là nhóm đang tham gia.
    const tv = await get(`/v1/nhom/${nhom.N2}`, tk.A4);
    expect(tv.body.trang_thai).toBe("luu_tru");
    const bc = await get(`${BAO_CAO}?nhom=${nhom.N2}`, tk.quanLyA);
    expect(bc.body.dong.find((d: any) => d.ho_ten === "Cán bộ A4")).toMatchObject({
      so_nhom: 0,
      phan_tram_nhom: null,
    });
  });
});
