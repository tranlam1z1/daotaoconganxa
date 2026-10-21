/**
 * Giọng nói (docs/PLAN.md GĐ14) trên Postgres test thật: /v1/giong-doc bắt đăng nhập (cả bí
 * danh /v1/mascot/giong-doc), khớp lời nói, sách nói (danh sách, tải tệp, nhớ vị trí nghe) và
 * game hỏi nhanh bằng giọng nói. Không gọi Vbee thật: phần đọc thành tiếng chỉ kiểm quyền và
 * dữ liệu vào; tệp sách nói ghi sẵn vào kho cục bộ tạm.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSession } from "@qdpl/auth";
import { luuAmThanhKhoi, sql } from "@qdpl/db";
import { putObject } from "@qdpl/storage";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-giong-noi";

async function goi(method: string, path: string, token?: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await app.request(`http://test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return res;
}
async function goiJson(method: string, path: string, token?: string, body?: unknown) {
  const res = await goi(method, path, token, body);
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

let token = "";
let accountId = "";
let baiId = "";
let baiNhap = "";
const khoi: string[] = [];
let khoDir = "";
const envCu = { backend: process.env.STORAGE_BACKEND, dir: process.env.STORAGE_DIR };

async function donDep() {
  await sql`DELETE FROM courses WHERE slug LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM questions WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM accounts WHERE username LIKE ${`${PREFIX}%`}`;
}

beforeAll(async () => {
  // Kho cục bộ tạm: test không ghi lên R2 dù .env có cấu hình.
  khoDir = await mkdtemp(join(tmpdir(), "qdpl-giong-noi-"));
  process.env.STORAGE_BACKEND = "local";
  process.env.STORAGE_DIR = khoDir;

  await donDep();
  const [acc] = (await sql`
    INSERT INTO accounts (username, name, role) VALUES (${`${PREFIX}-a`}, 'Cán bộ thử', 'can_bo') RETURNING id`) as any[];
  accountId = acc.id;
  token = (await createSession(acc.id, "test")).token;

  const [c] = (await sql`
    INSERT INTO courses (slug, title, status, as_of) VALUES (${`${PREFIX}-cd`}, 'Chuyên đề thử giọng nói', 'xuat_ban', '2026-09-01')
    RETURNING id`) as any[];
  const [l] = (await sql`
    INSERT INTO lessons (course_id, slug, ordinal, title, status, body_md)
    VALUES (${c.id}, 'bai-1', 1, 'Bài thử', 'xuat_ban', '') RETURNING id`) as any[];
  const [n] = (await sql`
    INSERT INTO lessons (course_id, slug, ordinal, title, status, body_md)
    VALUES (${c.id}, 'bai-nhap', 2, 'Bài nháp', 'nhap', '') RETURNING id`) as any[];
  baiId = l.id;
  baiNhap = n.id;
  for (const i of [1, 2]) {
    const [b] = (await sql`
      INSERT INTO lesson_blocks (lesson_id, ordinal, kind, data, status)
      VALUES (${baiId}, ${i}, 'giang', ${sql.json({ md: `Đoạn ${i}` })}, 'xuat_ban') RETURNING id`) as any[];
    khoi.push(b.id);
    const uri = `giong-doc/${PREFIX}-${i}.mp3`;
    await putObject(uri, new Uint8Array(32_000).fill(i), { contentType: "audio/mpeg" });
    await luuAmThanhKhoi({ lessonId: baiId, blockId: b.id, uri, seconds: 2, textHash: `${PREFIX}-${i}` });
  }

  // Ba câu đúng/sai đã duyệt, bảo đảm game có đủ câu kể cả khi CSDL test chưa gieo ngân hàng.
  for (const i of [1, 2, 3]) {
    await sql`
      INSERT INTO questions (code, level, kind, stem, options, answer, explanation, status)
      VALUES (${`${PREFIX}-${i}`}, 'de', 'dung_sai', ${`Nhận định thử giọng nói ${i}`}, '{}',
              ${sql.json({ dung: ["dung"] })}, 'Giải thích.', 'da_duyet')`;
  }
});

afterAll(async () => {
  await donDep();
  process.env.STORAGE_BACKEND = envCu.backend;
  process.env.STORAGE_DIR = envCu.dir;
  if (envCu.backend === undefined) delete process.env.STORAGE_BACKEND;
  if (envCu.dir === undefined) delete process.env.STORAGE_DIR;
  await rm(khoDir, { recursive: true, force: true });
});

describe("đọc thành tiếng bắt buộc đăng nhập", () => {
  test("khách gọi /v1/giong-doc và bí danh /v1/mascot/giong-doc đều nhận 401", async () => {
    for (const path of [
      "/v1/giong-doc",
      "/v1/mascot/giong-doc",
      "/v1/giong-doc/chuan-bi",
      "/v1/mascot/giong-doc/chuan-bi",
    ]) {
      const body = path.endsWith("chuan-bi") ? { texts: ["Xin chào"] } : { text: "Xin chào" };
      expect((await goi("POST", path, undefined, body)).status).toBe(401);
    }
    expect((await goi("GET", "/v1/giong-doc")).status).toBe(401);
  });

  test("đã đăng nhập: lời rỗng hoặc quá dài bị từ chối trước khi gọi dịch vụ đọc", async () => {
    expect((await goi("POST", "/v1/giong-doc", token, { text: "  " })).status).toBe(400);
    expect((await goi("POST", "/v1/giong-doc", token, { text: "a".repeat(1501) })).status).toBe(400);
    const tt = await goiJson("GET", "/v1/giong-doc", token);
    expect(tt.status).toBe(200);
    expect(typeof tt.body.doc_thanh_tieng).toBe("boolean");
  });
});

describe("khớp lời nói", () => {
  const phuongAn = [
    { id: "p1", text: "Phạt tiền" },
    { id: "p2", text: "Cảnh cáo" },
  ];
  test("chữ cái và nội dung khớp; lời mơ hồ trả không chắc", async () => {
    const a = await goiJson("POST", "/v1/giong-doc/khop", token, {
      loi_noi: "đáp án bê",
      phuong_an: phuongAn,
    });
    expect(a.body).toMatchObject({ loai: "khop", id: "p2", cach: "chu_cai" });
    const b = await goiJson("POST", "/v1/giong-doc/khop", token, {
      loi_noi: "phạt tiền",
      phuong_an: phuongAn,
    });
    expect(b.body).toMatchObject({ loai: "khop", id: "p1", cach: "noi_dung" });
    const c = await goiJson("POST", "/v1/giong-doc/khop", token, {
      loi_noi: "a hoặc b",
      phuong_an: phuongAn,
    });
    expect(c.body.loai).toBe("khong_chac");
  });

  test("khách không dùng được", async () => {
    expect(
      (await goi("POST", "/v1/giong-doc/khop", undefined, { loi_noi: "a", phuong_an: phuongAn })).status,
    ).toBe(401);
  });
});

describe("sách nói", () => {
  test("danh sách khối có bản đọc, theo thứ tự; bài nháp 404", async () => {
    const r = await goiJson("GET", `/v1/giong-doc/sach-noi/${baiId}`, token);
    expect(r.status).toBe(200);
    expect(r.body.khoi.map((k: any) => k.block_id)).toEqual(khoi);
    expect(r.body.khoi[0].giay).toBe(2);
    expect(r.body.vi_tri).toBeNull();
    expect((await goi("GET", `/v1/giong-doc/sach-noi/${baiNhap}`, token)).status).toBe(404);
    expect((await goi("GET", "/v1/giong-doc/sach-noi/khong-phai-uuid", token)).status).toBe(404);
  });

  test("tải tệp MP3 của một khối", async () => {
    const res = await goi("GET", `/v1/giong-doc/sach-noi/${baiId}/${khoi[1]}`, token);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    const mp3 = new Uint8Array(await res.arrayBuffer());
    expect(mp3.byteLength).toBe(32_000);
    expect(mp3[0]).toBe(2);
    expect((await goi("GET", `/v1/giong-doc/sach-noi/${baiId}/${crypto.randomUUID()}`, token)).status).toBe(
      404,
    );
  });

  test("lưu vị trí nghe rồi mở lại đúng chỗ; khối lạ bị từ chối", async () => {
    const luu = await goiJson("POST", `/v1/giong-doc/sach-noi/${baiId}/vi-tri`, token, {
      block_id: khoi[1],
      giay: 1.5,
    });
    expect(luu.status).toBe(200);
    const r = await goiJson("GET", `/v1/giong-doc/sach-noi/${baiId}`, token);
    expect(r.body.vi_tri).toEqual({ block_id: khoi[1], giay: 1.5 });
    const [row] =
      (await sql`SELECT count(*)::int AS n FROM audio_positions WHERE account_id = ${accountId}`) as any[];
    expect(row.n).toBe(1);
    const sai = await goi("POST", `/v1/giong-doc/sach-noi/${baiId}/vi-tri`, token, {
      block_id: crypto.randomUUID(),
      giay: 1,
    });
    expect(sai.status).toBe(400);
  });
});

describe("game hỏi nhanh bằng giọng nói", () => {
  test("chơi hết lượt đúng mọi câu: ghi kỷ lục và cộng XP một lần", async () => {
    const bd = await goiJson("POST", "/v1/tro-choi/hoi-nhanh-giong-noi/bat-dau", token);
    expect(bd.status).toBe(201);
    const id = bd.body.id as string;
    const [p] = (await sql`SELECT items FROM practice_sessions WHERE id = ${id}`) as any[];
    const items = p.items as any[];
    expect(items.every((c) => ["mot_dap_an", "dung_sai"].includes(c.noi_dung.kind))).toBe(true);
    for (const [i, c] of items.entries()) {
      const r = await goi("POST", `/v1/luyen-tap/phien/${id}/tra-loi`, token, {
        stt: i + 1,
        tra_loi: { chon: [c.noi_dung.answer.dung[0]] },
      });
      expect(r.status).toBe(200);
    }
    const kt = await goiJson("POST", `/v1/luyen-tap/phien/${id}/ket-thuc`, token);
    expect(kt.body.tro_choi).toMatchObject({
      ma: "hoi_nhanh_giong_noi",
      diem: items.length,
      tong: items.length,
      pha_ky_luc: true,
      xp: items.length + 5,
    });
    const kyLuc = await goiJson("GET", "/v1/tro-choi/hoi-nhanh-giong-noi", token);
    expect(kyLuc.body.ky_luc).toBe(items.length);
    const xp = (await sql`
      SELECT xp FROM xp_ledger WHERE account_id = ${accountId} AND source_kind = 'game:hoi_nhanh_giong_noi'`) as any[];
    expect(xp.map((r) => r.xp)).toEqual([items.length + 5]);
  });
});
