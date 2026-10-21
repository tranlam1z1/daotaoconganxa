/**
 * Kiểm thử API trò chơi (docs/PLAN.md GĐ10) trên Postgres test thật: mở màn theo ngưỡng, màn
 * chưa mở trả 403, đồng hồ đua thời gian do máy chủ quyết định, ghép cặp chấm trên máy chủ, và
 * XP mỗi ván chỉ cộng một lần.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import { moTaMucPhat } from "@qdpl/dao-tao";
import { luuChuDeCauHoi, sql, type TaoCauHoiInput, taoNhieuCauHoi } from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();

const PREFIX = "test-qdpl-tro-choi";
const CHU_DE = `${PREFIX}-chu-de`;

const phanHoi: unknown[] = [];

async function goi(method: string, path: string, token?: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await app.request(`http://test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  phanHoi.push(json);
  return { status: res.status, body: json as any };
}

async function taoTaiKhoan(ten: string): Promise<{ id: string; token: string }> {
  const [acc] = await sql<Array<{ id: string }>>`
    INSERT INTO accounts (email, role) VALUES (${`${PREFIX}-${ten}@vidu.vn`}, 'can_bo') RETURNING id`;
  return { id: acc!.id, token: (await createSession(acc!.id, "test")).token };
}

async function donDep() {
  await sql`DELETE FROM questions WHERE created_by = ${PREFIX}`;
  await sql`DELETE FROM question_topics WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM violations WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM xp_ledger WHERE account_id IN (SELECT id FROM accounts WHERE email LIKE ${`${PREFIX}%`})`;
  await sql`DELETE FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
}

/** Đáp án đúng của từng câu trong phiên, đọc từ ảnh chụp trong CSDL. */
async function dapAn(phien: string): Promise<string[]> {
  const [p] = await sql<Array<{ items: any[] }>>`SELECT items FROM practice_sessions WHERE id = ${phien}`;
  return p!.items.map((c) => c.noi_dung.answer.dung[0]);
}

/** Chơi hết một phiên câu hỏi, trả lời đúng `soDung` câu đầu, rồi kết thúc. */
async function choiPhien(phien: string, token: string, soDung: number) {
  const da = await dapAn(phien);
  for (const [i, d] of da.entries()) {
    const sai = d === "a" ? "b" : "a";
    const r = await goi("POST", `/v1/luyen-tap/phien/${phien}/tra-loi`, token, {
      stt: i + 1,
      tra_loi: { chon: [i < soDung ? d : sai] },
    });
    expect(r.status).toBe(200);
  }
  return await goi("POST", `/v1/luyen-tap/phien/${phien}/ket-thuc`, token);
}

async function xpCua(accountId: string, nguon: string): Promise<number[]> {
  const rows = await sql<Array<{ xp: number }>>`
    SELECT xp FROM xp_ledger WHERE account_id = ${accountId} AND source_kind = ${nguon} ORDER BY id`;
  return rows.map((r) => r.xp);
}

let A: { id: string; token: string };
let B: { id: string; token: string };

beforeAll(async () => {
  await donDep();
  A = await taoTaiKhoan("a");
  B = await taoTaiKhoan("b");
  const t = await luuChuDeCauHoi({ code: CHU_DE, name: "Chủ đề trò chơi (test)" });
  // 30 câu một đáp án (ba màn) và 6 câu đúng/sai.
  const cau = (i: number): TaoCauHoiInput => ({
    code: `${PREFIX}-${i}`,
    topicId: t.id,
    level: (["de", "trung_binh", "kho"] as const)[i % 3]!,
    kind: i < 30 ? "mot_dap_an" : "dung_sai",
    stem: `${PREFIX} câu ${i}?`,
    options:
      i < 30
        ? {
            phuong_an: [
              { id: "a", text: "Một" },
              { id: "b", text: "Hai" },
            ],
          }
        : {},
    answer: { dung: [i < 30 ? "a" : "dung"] },
    explanation: "Giải thích.",
    citations: [],
    status: "da_duyet",
  });
  await taoNhieuCauHoi(
    Array.from({ length: 36 }, (_, i) => cau(i)),
    PREFIX,
  );
});

afterAll(async () => {
  await donDep();
});

describe("vượt màn", () => {
  let man: Array<{ id: string; thu_tu: number; mo: boolean }> = [];

  test("chưa đăng nhập nhận 401", async () => {
    expect((await goi("GET", `/v1/tro-choi/vuot-man/${CHU_DE}`)).status).toBe(401);
  });

  test("bản đồ có 3 màn; chỉ màn 1 mở", async () => {
    const r = await goi("GET", `/v1/tro-choi/vuot-man/${CHU_DE}`, A.token);
    expect(r.status).toBe(200);
    man = r.body.man;
    expect(man.map((m) => m.thu_tu)).toEqual([1, 2, 3]);
    expect(man.map((m) => m.mo)).toEqual([true, false, false]);
  });

  test("gọi thẳng màn 3 khi chưa mở nhận 403", async () => {
    const r = await goi("POST", `/v1/tro-choi/vuot-man/man/${man[2]!.id}/bat-dau`, A.token);
    expect(r.status).toBe(403);
    expect(r.body.error.message).toContain("chưa mở");
  });

  test("màn 1 đạt 70% thì màn 2 vẫn khóa", async () => {
    const bd = await goi("POST", `/v1/tro-choi/vuot-man/man/${man[0]!.id}/bat-dau`, A.token);
    expect(bd.status).toBe(201);
    expect(bd.body.tong).toBe(10);
    const kt = await choiPhien(bd.body.id, A.token, 7);
    expect(kt.body.tro_choi).toMatchObject({ ma: "vuot_man", man: 1, dat: false, sao: 0, xp: 14 });
    const r = await goi("GET", `/v1/tro-choi/vuot-man/${CHU_DE}`, A.token);
    expect(r.body.man[1].mo).toBe(false);
    expect((await goi("POST", `/v1/tro-choi/vuot-man/man/${man[1]!.id}/bat-dau`, A.token)).status).toBe(403);
  });

  test("qua màn 1 với 10/10 thì màn 2 mở, được 3 sao và thưởng qua màn lần đầu", async () => {
    const bd = await goi("POST", `/v1/tro-choi/vuot-man/man/${man[0]!.id}/bat-dau`, A.token);
    const kt = await choiPhien(bd.body.id, A.token, 10);
    expect(kt.body.tro_choi).toMatchObject({ dat: true, sao: 3, xp: 30 });
    // Kết thúc lại không cộng XP lần nữa.
    await goi("POST", `/v1/luyen-tap/phien/${bd.body.id}/ket-thuc`, A.token);
    expect(await xpCua(A.id, "game:vuot_man")).toEqual([14, 30]);

    const r = await goi("GET", `/v1/tro-choi/vuot-man/${CHU_DE}`, A.token);
    expect(r.body.man.map((m: { mo: boolean }) => m.mo)).toEqual([true, true, false]);
    expect(r.body.man[0]).toMatchObject({ sao: 3, qua: true });
    // Người B chưa chơi: vẫn chỉ màn 1 mở.
    const rb = await goi("GET", `/v1/tro-choi/vuot-man/${CHU_DE}`, B.token);
    expect(rb.body.man.map((m: { mo: boolean }) => m.mo)).toEqual([true, false, false]);
  });

  test("chơi lại màn 1 kém hơn không làm mất sao, không thưởng qua màn lần nữa", async () => {
    const bd = await goi("POST", `/v1/tro-choi/vuot-man/man/${man[0]!.id}/bat-dau`, A.token);
    const kt = await choiPhien(bd.body.id, A.token, 9);
    expect(kt.body.tro_choi).toMatchObject({ dat: true, sao: 2, xp: 18 });
    const r = await goi("GET", `/v1/tro-choi/vuot-man/${CHU_DE}`, A.token);
    expect(r.body.man[0].sao).toBe(3);
  });
});

describe("đua thời gian", () => {
  test("chỉ rút câu một đáp án và đúng/sai; không nhận câu trả lời sau 60 giây cộng dung sai", async () => {
    const bd = await goi("POST", "/v1/tro-choi/dua-thoi-gian/bat-dau", A.token, { chu_de: CHU_DE });
    expect(bd.status).toBe(201);
    expect(new Date(bd.body.han).getTime() - new Date(bd.body.bat_dau).getTime()).toBe(60_000);
    const id = bd.body.id;
    const [p] = await sql<Array<{ items: any[] }>>`SELECT items FROM practice_sessions WHERE id = ${id}`;
    expect(p!.items.every((c) => ["mot_dap_an", "dung_sai"].includes(c.noi_dung.kind))).toBe(true);

    const da = await dapAn(id);
    for (const i of [0, 1]) {
      const r = await goi("POST", `/v1/luyen-tap/phien/${id}/tra-loi`, A.token, {
        stt: i + 1,
        tra_loi: { chon: [da[i]!] },
      });
      expect(r.status).toBe(200);
    }
    // Lùi giờ bắt đầu 64 giây: đã quá 60 giây + 3 giây dung sai.
    await sql`UPDATE practice_sessions SET started_at = now() - interval '64 seconds' WHERE id = ${id}`;
    const muon = await goi("POST", `/v1/luyen-tap/phien/${id}/tra-loi`, A.token, {
      stt: 3,
      tra_loi: { chon: [da[2]!] },
    });
    expect(muon.status).toBe(409);
    expect(muon.body.error.message).toContain("Hết giờ");

    const kt = await goi("POST", `/v1/luyen-tap/phien/${id}/ket-thuc`, A.token);
    expect(kt.body.tro_choi).toMatchObject({
      ma: "dua_thoi_gian",
      diem: 2,
      ky_luc: 2,
      pha_ky_luc: true,
      xp: 7,
    });
    await goi("POST", `/v1/luyen-tap/phien/${id}/ket-thuc`, A.token);
    const kl = await goi("GET", "/v1/tro-choi/dua-thoi-gian", A.token);
    expect(kl.body).toMatchObject({ ky_luc: 2, so_van: 1 });
    expect(await xpCua(A.id, "game:dua_thoi_gian")).toEqual([7]);
  });
});

describe("ghép cặp lỗi – mức phạt", () => {
  beforeAll(async () => {
    const muc = [400_000, 800_000, 2_000_000, 4_000_000, 6_000_000, 10_000_000];
    for (const [i, m] of muc.entries()) {
      await sql`
        INSERT INTO violations (code, vehicle, behavior, fine_min, fine_max, citation_urn, effective_from, status)
        VALUES (${`${PREFIX}-${i}`}, 'mo_to', ${`Hành vi thử ${i}`}, ${m}, ${m * 1.5}, 'vn:vbqppl:nd:100/2026/NĐ-CP#dieu-3',
                '2020-01-01', 'da_duyet')`;
    }
    // Dòng bản nháp không bao giờ được vào game.
    await sql`
      INSERT INTO violations (code, vehicle, behavior, fine_min, fine_max, citation_urn, effective_from, status)
      VALUES (${`${PREFIX}-nhap`}, 'mo_to', 'Hành vi bản nháp', 1, 2, 'vn:x', '2020-01-01', 'nhap')`;
  });

  test("ván có 5 cặp; đề không có đáp án; nộp đúng hết được thưởng; nộp lại nhận 409", async () => {
    const bd = await goi("POST", "/v1/tro-choi/ghep-cap/bat-dau", A.token, { xe: "mo_to" });
    expect(bd.status).toBe(201);
    const de = bd.body.de;
    expect(de.trai).toHaveLength(5);
    expect(de.trai.some((t: { text: string }) => t.text === "Hành vi bản nháp")).toBe(false);
    expect(JSON.stringify(bd.body)).not.toContain("seed");

    // Người chơi biết đáp án qua dữ liệu tra cứu: tra ngược mức phạt đúng của từng hành vi.
    const rows = await sql<Array<{ id: string; fine_min: number; fine_max: number }>>`
      SELECT id, fine_min::float AS fine_min, fine_max::float AS fine_max FROM violations
      WHERE id = ANY(${de.trai.map((t: { id: string }) => t.id)}::uuid[])`;
    const theoText = new Map(de.phai.map((p: { id: string; text: string }) => [p.text, p.id]));
    const cap: Record<string, string> = {};
    for (const r of rows.reverse()) cap[r.id] = theoText.get(moTaMucPhat(r.fine_min, r.fine_max)) as string;

    expect((await goi("POST", `/v1/tro-choi/ghep-cap/${bd.body.id}/nop`, B.token, { cap })).status).toBe(403);
    const nop = await goi("POST", `/v1/tro-choi/ghep-cap/${bd.body.id}/nop`, A.token, { cap });
    expect(nop.status).toBe(200);
    expect(nop.body).toMatchObject({ dung: 5, tong: 5, xp: 10 });
    expect((await goi("POST", `/v1/tro-choi/ghep-cap/${bd.body.id}/nop`, A.token, { cap })).status).toBe(409);

    const xem = await goi("GET", `/v1/tro-choi/ghep-cap/${bd.body.id}`, A.token);
    expect(xem.body.ket_qua.dung).toBe(5);
    expect(await xpCua(A.id, "game:ghep_cap")).toEqual([10]);
  });

  test("ván ghép cặp không mở được qua API luyện tập", async () => {
    const bd = await goi("POST", "/v1/tro-choi/ghep-cap/bat-dau", A.token, { xe: "mo_to" });
    expect((await goi("GET", `/v1/luyen-tap/phien/${bd.body.id}`, A.token)).status).toBe(404);
  });
});

describe("tổng quan và ranh giới đáp án", () => {
  test("trang tổng quan có chủ đề vượt màn và kỷ lục", async () => {
    const r = await goi("GET", "/v1/tro-choi", A.token);
    expect(
      r.body.vuot_man.some((t: { code: string; so_man: number }) => t.code === CHU_DE && t.so_man === 3),
    ).toBe(true);
    expect(r.body.dua_thoi_gian.ky_luc).toBe(2);
    expect(r.body.ghep_cap.ky_luc).toBe(5);
  });

  test("không phản hồi nào có khóa answer", () => {
    const timKhoa = (v: unknown): boolean =>
      Array.isArray(v)
        ? v.some(timKhoa)
        : Boolean(
            v && typeof v === "object" && Object.entries(v).some(([k, x]) => k === "answer" || timKhoa(x)),
          );
    expect(phanHoi.filter(timKhoa)).toEqual([]);
  });
});
