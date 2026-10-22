/**
 * Bài giảng đơn giản (docs/PLAN.md GĐ11) trên Postgres test thật.
 *
 * Phần duyệt nội dung chạy trên mọi bài `xuat_ban` của lĩnh vực giao thông trong CSDL (seed
 * giao thông: `bun run db:seed:dao-tao:gtdb` rồi `bun run db:seed:ngan-hang`). CSDL chưa gieo thì
 * phần đó chỉ cảnh báo, như dao-tao.test.ts. Phần hoàn thành bài tự tạo chuyên đề riêng.
 * Kiểm tra hiển thị trong trình duyệt ở cả hai chế độ nằm ở scripts/e2e/bai-giang.ts.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import { KHOI_BAI_GIANG, NGUONG_DAT_KIEM_TRA_CUOI_BAI } from "@qdpl/dao-tao";
import { chuyenDeDaHoanThanh, sql } from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-gd11";

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

const tk = { a: "", b: "", c: "" };
const acc = { a: "", b: "", c: "" };
let chuDeId = "";

async function donDep() {
  await sql`DELETE FROM courses WHERE slug LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM fields WHERE slug LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM questions WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM question_topics WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM accounts WHERE username LIKE ${`${PREFIX}%`}`;
}

beforeAll(async () => {
  await donDep();
  for (const k of ["a", "b", "c"] as const) {
    const [r] = (await sql`
      INSERT INTO accounts (username, name, role) VALUES (${`${PREFIX}-${k}`}, ${`Cán bộ ${k}`}, 'can_bo')
      RETURNING id`) as any[];
    acc[k] = r.id;
    tk[k] = (await createSession(r.id, "test")).token;
  }
  // Một chuyên đề, hai bài; bài 1 gắn chủ đề có 6 câu đã duyệt.
  const [t] = (await sql`
    INSERT INTO question_topics (code, name) VALUES (${`${PREFIX}-td`}, 'Chủ đề thử GĐ11') RETURNING id`) as any[];
  chuDeId = t.id;
  for (let i = 1; i <= 6; i++) {
    await sql`
      INSERT INTO questions (code, topic_id, level, kind, stem, options, answer, explanation, status)
      VALUES (${`${PREFIX}-${i}`}, ${t.id}, ${(["de", "trung_binh", "kho"] as const)[i % 3]!}, 'dung_sai',
              ${`Nhận định thử GĐ11 số ${i}`}, '{}', ${sql.json({ dung: ["dung"] })}, 'Giải thích.', 'da_duyet')`;
  }
  const [c] = (await sql`
    INSERT INTO courses (slug, title, status, as_of) VALUES (${`${PREFIX}-cd`}, 'Chuyên đề thử GĐ11', 'xuat_ban', '2026-09-01')
    RETURNING id`) as any[];
  for (const [i, slug] of ["bai-1", "bai-2"].entries()) {
    const [l] = (await sql`
      INSERT INTO lessons (course_id, slug, ordinal, title, status, topic_id)
      VALUES (${c.id}, ${slug}, ${i + 1}, ${`Bài thử ${i + 1}`}, 'xuat_ban', ${i === 0 ? t.id : null})
      RETURNING id`) as any[];
    await sql`
      INSERT INTO lesson_blocks (lesson_id, ordinal, kind, data, status)
      VALUES (${l.id}, 1, 'giang', ${sql.json({ md: "Nội dung **bài thử**." })}, 'xuat_ban'),
             (${l.id}, 2, 'tom_tat', ${sql.json({ y: ["Ý một", "Ý hai"] })}, 'xuat_ban')`;
  }
});

afterAll(async () => {
  await donDep();
});

const BAI = `/v1/dao-tao/chuyen-de/${PREFIX}-cd/bai`;

describe("nội dung mọi bài xuất bản của lĩnh vực giao thông", () => {
  test("mở được, có khối, khối nào cũng có dữ liệu; loại khối lạ được liệt kê", async () => {
    const bai = (await sql`
      SELECT c.slug AS chuyen_de, l.slug, l.topic_id
      FROM lessons l JOIN courses c ON c.id = l.course_id JOIN fields f ON f.id = c.field_id
      WHERE l.status = 'xuat_ban' AND c.status = 'xuat_ban' AND f.slug = 'giao-thong-duong-bo'
      ORDER BY c.slug, l.ordinal`) as any[];
    if (!bai.length) {
      console.warn("[bai-giang.test] CSDL test chưa gieo bài giảng giao thông — bỏ qua phần duyệt nội dung.");
      return;
    }
    const khoiLa = new Set<string>();
    for (const b of bai) {
      const r = await goi("GET", `/v1/dao-tao/chuyen-de/${b.chuyen_de}/bai/${b.slug}?cheDo=day_du`, tk.a);
      expect(r.status).toBe(200);
      expect(r.body.khoi.length).toBeGreaterThan(0);
      for (const k of r.body.khoi) {
        expect(typeof k.kind).toBe("string");
        expect(Object.keys(k.data ?? {}).length).toBeGreaterThan(0);
        if (!(KHOI_BAI_GIANG as readonly string[]).includes(k.kind)) khoiLa.add(k.kind);
      }
      // Bài đã gắn chủ đề (seed ngân hàng) thì trả topicId.
      expect(r.body.bai.topicId).toBe(b.topic_id);
    }
    if (khoiLa.size) console.info(`[bai-giang.test] khối hiện dạng chữ thô: ${[...khoiLa].join(", ")}`);
  });
});

describe("kiểm tra cuối bài", () => {
  test("bài có chủ đề đủ câu thì có kiểm tra 5 câu; bài không chủ đề thì không có", async () => {
    const r1 = await goi("GET", `${BAI}/bai-1`, tk.c);
    expect(r1.body.bai.topicId).toBe(chuDeId);
    expect(r1.body.kiemTraCuoiBai).toEqual({ chuDe: `${PREFIX}-td`, tenChuDe: "Chủ đề thử GĐ11", soCau: 5 });
    const r2 = await goi("GET", `${BAI}/bai-2`, tk.c);
    expect(r2.body.kiemTraCuoiBai).toBeNull();
  });

  test("phiên kiểm tra rút đúng số câu yêu cầu từ chủ đề của bài", async () => {
    const r = await goi("POST", "/v1/luyen-tap/phien", tk.a, {
      nguon: "chu_de",
      chu_de: `${PREFIX}-td`,
      so_cau: 5,
    });
    expect(r.status).toBe(201);
    expect(r.body.tong).toBe(5);
    expect(
      (await goi("POST", "/v1/luyen-tap/phien", tk.a, { chu_de: `${PREFIX}-td`, so_cau: 2 })).status,
    ).toBe(400);
  });
});

describe("hoàn thành bài", () => {
  test("chưa đăng nhập nhận 401", async () => {
    expect((await goi("POST", `${BAI}/bai-1/hoan-thanh`, undefined, {})).status).toBe(401);
  });

  test("lesson_progress thành xong và chỉ ghi một lần", async () => {
    const lan1 = await goi("POST", `${BAI}/bai-1/hoan-thanh`, tk.a, {});
    expect(lan1.status).toBe(200);
    expect(lan1.body).toMatchObject({
      trangThai: "xong",
      daXongTruoc: false,
    });

    const lan2 = await goi("POST", `${BAI}/bai-1/hoan-thanh`, tk.a, {});
    expect(lan2.body).toMatchObject({ daXongTruoc: true });

    const [td] = (await sql`
      SELECT p.state, p.finished_at FROM lesson_progress p JOIN enrollments e ON e.id = p.enrollment_id
      JOIN lessons l ON l.id = p.lesson_id
      WHERE e.account_id = ${acc.a} AND l.slug = 'bai-1' AND l.course_id = (SELECT id FROM courses WHERE slug = ${`${PREFIX}-cd`})`) as any[];
    expect(td.state).toBe("xong");
    expect(td.finished_at).not.toBeNull();
  });

  test("mở lại bài đã xong vẫn giữ trạng thái xong", async () => {
    const r = await goi("GET", `${BAI}/bai-1`, tk.a);
    expect(r.body.trangThai).toBe("xong");
    const cd = await goi("GET", `/v1/dao-tao/chuyen-de/${PREFIX}-cd`, tk.a);
    expect(cd.body.loTrinh.map((b: any) => b.trangThai)).toEqual(["xong", "chua_mo"]);
  });

  test("hoàn thành qua tien-do (xong: true) cũng chỉ ghi một lần", async () => {
    const r = await goi("GET", `${BAI}/bai-2`, tk.b);
    expect(r.body.ghiDanhId).toBeNull();
    const ht = await goi("POST", `${BAI}/bai-2/hoan-thanh`, tk.b, {});
    const ghiDanhId = ht.body.ghiDanhId;
    const [l2] = (await sql`SELECT id FROM lessons WHERE slug = 'bai-2'
      AND course_id = (SELECT id FROM courses WHERE slug = ${`${PREFIX}-cd`})`) as any[];
    const lai = await goi("POST", `/v1/dao-tao/bai/${l2.id}/tien-do`, tk.b, { ghiDanhId, xong: true });
    expect(lai.status).toBe(200);
    expect(lai.body).toMatchObject({ tienDo: { state: "xong" } });
  });

  test("ghi tiến độ vào ghi danh của người khác nhận 403", async () => {
    const [e] = (await sql`
      SELECT e.id FROM enrollments e WHERE e.account_id = ${acc.a}
        AND e.course_id = (SELECT id FROM courses WHERE slug = ${`${PREFIX}-cd`})`) as any[];
    const [l1] = (await sql`SELECT id FROM lessons WHERE slug = 'bai-1'
      AND course_id = (SELECT id FROM courses WHERE slug = ${`${PREFIX}-cd`})`) as any[];
    const r = await goi("POST", `/v1/dao-tao/bai/${l1.id}/tien-do`, tk.b, { ghiDanhId: e.id, themGiay: 30 });
    expect(r.status).toBe(403);
  });
});

describe("phần trăm đã học trên thẻ bài và thẻ chuyên đề", () => {
  // Chuyên đề riêng nằm trong một lĩnh vực riêng để hiện ở /linh-vuc: ba bài xuất bản có 4, 4 và
  // 2 khối, cộng một bài nháp. Người học là tài khoản c, chưa đụng tới chuyên đề thử ở trên.
  const PT = `/v1/dao-tao/chuyen-de/${PREFIX}-pt`;
  const baiId: Record<string, string> = {};

  beforeAll(async () => {
    const [lv] = (await sql`
      INSERT INTO fields (slug, name, status) VALUES (${`${PREFIX}-lv`}, 'Lĩnh vực thử GĐ11', 'xuat_ban')
      RETURNING id`) as any[];
    const [c] = (await sql`
      INSERT INTO courses (slug, title, status, as_of, field_id)
      VALUES (${`${PREFIX}-pt`}, 'Chuyên đề thử phần trăm', 'xuat_ban', '2026-09-01', ${lv.id})
      RETURNING id`) as any[];
    const bai: Array<[string, string, number]> = [
      ["p-1", "xuat_ban", 4],
      ["p-2", "xuat_ban", 4],
      ["p-3", "xuat_ban", 2],
      ["p-nhap", "nhap", 1],
    ];
    for (const [i, [slug, status, soKhoi]] of bai.entries()) {
      const [l] = (await sql`
        INSERT INTO lessons (course_id, slug, ordinal, title, status)
        VALUES (${c.id}, ${slug}, ${i + 1}, ${`Bài phần trăm ${slug}`}, ${status})
        RETURNING id`) as any[];
      baiId[slug] = l.id;
      for (let k = 1; k <= soKhoi; k++) {
        await sql`
          INSERT INTO lesson_blocks (lesson_id, ordinal, kind, data)
          VALUES (${l.id}, ${k}, 'giang', ${sql.json({ md: `Khối ${k}.` })})`;
      }
    }
  });

  const phanTramBai = async (token?: string) =>
    Object.fromEntries(
      ((await goi("GET", PT, token)).body.loTrinh as any[]).map((b) => [b.slug, b.phanTram]),
    );
  const phanTramChuyenDe = async (token?: string) => {
    const r = await goi("GET", "/v1/dao-tao/linh-vuc", token);
    expect(r.status).toBe(200);
    const lv = (r.body.items as any[]).find((x) => x.slug === `${PREFIX}-lv`);
    const cd = lv.nhom.flatMap((n: any) => n.chuyenDe).find((x: any) => x.slug === `${PREFIX}-pt`);
    return cd.phanTram;
  };

  test("chưa đăng nhập: phanTram của bài và của chuyên đề đều là null", async () => {
    expect(await phanTramBai()).toEqual({ "p-1": null, "p-2": null, "p-3": null });
    expect(await phanTramChuyenDe()).toBeNull();
  });

  test("đã đăng nhập nhưng chưa ghi danh: vẫn là null, không phải 0", async () => {
    expect(await phanTramBai(tk.c)).toEqual({ "p-1": null, "p-2": null, "p-3": null });
    expect(await phanTramChuyenDe(tk.c)).toBeNull();
  });

  test("bài xong là 100, bài chưa mở là 0", async () => {
    expect((await goi("POST", `${PT}/bai/p-1/hoan-thanh`, tk.c, {})).status).toBe(200);
    expect(await phanTramBai(tk.c)).toEqual({ "p-1": 100, "p-2": 0, "p-3": 0 });
  });

  test("bài đang học tính theo khối xa nhất đã đọc, tối đa 99", async () => {
    // Mở bài: đang học nhưng chưa đọc khối nào.
    const mo = await goi("GET", `${PT}/bai/p-2`, tk.c);
    expect(mo.body.trangThai).toBe("dang_hoc");
    expect((await phanTramBai(tk.c))["p-2"]).toBe(0);

    const ghiDanhId = mo.body.ghiDanhId;
    const tienDo = (slug: string, lastBlockOrdinal: number) =>
      goi("POST", `/v1/dao-tao/bai/${baiId[slug]}/tien-do`, tk.c, { ghiDanhId, lastBlockOrdinal });
    expect((await tienDo("p-2", 3)).status).toBe(200);
    // Đọc tới khối cuối nhưng chưa bấm "Hoàn thành": 99, không phải 100.
    expect((await tienDo("p-3", 2)).status).toBe(200);
    expect(await phanTramBai(tk.c)).toEqual({ "p-1": 100, "p-2": 75, "p-3": 99 });
  });

  test("/linh-vuc: phanTram của chuyên đề = số bài xuất bản đã xong / số bài xuất bản", async () => {
    // Bài nháp đã xong không được tính, bài đang học cũng không.
    const [e] = (await sql`
      SELECT id FROM enrollments WHERE account_id = ${acc.c}
        AND course_id = (SELECT id FROM courses WHERE slug = ${`${PREFIX}-pt`})`) as any[];
    await sql`
      INSERT INTO lesson_progress (enrollment_id, lesson_id, state) VALUES (${e.id}, ${baiId["p-nhap"]!}, 'xong')`;
    expect(await phanTramChuyenDe(tk.c)).toBe(33);

    await goi("POST", `${PT}/bai/p-2/hoan-thanh`, tk.c, {});
    expect(await phanTramChuyenDe(tk.c)).toBe(67);
    // Người khác chưa ghi danh chuyên đề này vẫn nhận null.
    expect(await phanTramChuyenDe(tk.a)).toBeNull();
  });
});

describe("chuyên đề đã hoàn thành: xong mọi bài và đạt kiểm tra cuối bài", () => {
  const CD = `${PREFIX}-cd`;
  const idCuaChuyenDe = async (slug: string) =>
    ((await sql`SELECT id FROM courses WHERE slug = ${slug}`) as any[])[0].id as string;
  const nopPhien = (accountId: string, dung: number, tong: number) => sql`
    INSERT INTO practice_sessions (account_id, topic_id, source, total, correct, finished_at)
    VALUES (${accountId}, ${chuDeId}, 'chu_de', ${tong}, ${dung}, now())`;

  test("xong mọi bài nhưng chưa đạt kiểm tra của bài có chủ đề: chưa hoàn thành", async () => {
    const id = await idCuaChuyenDe(CD);
    // Tài khoản a đã xong bài 1 (có kiểm tra); bài 2 (không có kiểm tra) chưa xong.
    expect((await chuyenDeDaHoanThanh(acc.a)).has(id)).toBe(false);
    await goi("POST", `${BAI}/bai-2/hoan-thanh`, tk.a, {});
    expect((await chuyenDeDaHoanThanh(acc.a)).has(id)).toBe(false);
    // 3/5 = 60%, dưới ngưỡng.
    await nopPhien(acc.a, 3, 5);
    expect((await chuyenDeDaHoanThanh(acc.a)).has(id)).toBe(false);
  });

  test(`đạt từ ${NGUONG_DAT_KIEM_TRA_CUOI_BAI}% thì hoàn thành; người khác không bị tính theo`, async () => {
    const id = await idCuaChuyenDe(CD);
    await nopPhien(acc.a, 4, 5);
    expect((await chuyenDeDaHoanThanh(acc.a)).has(id)).toBe(true);
    // Tài khoản b mới xong bài 2, chưa xong bài 1.
    expect((await chuyenDeDaHoanThanh(acc.b)).has(id)).toBe(false);
  });

  test("/linh-vuc: daHoanThanh null khi chưa đăng nhập, true khi xong mọi bài (không bài nào có kiểm tra)", async () => {
    const daHoanThanh = async (token?: string) => {
      const r = await goi("GET", "/v1/dao-tao/linh-vuc", token);
      const lv = (r.body.items as any[]).find((x) => x.slug === `${PREFIX}-lv`);
      return lv.nhom.flatMap((n: any) => n.chuyenDe).find((x: any) => x.slug === `${PREFIX}-pt`).daHoanThanh;
    };
    expect(await daHoanThanh()).toBeNull();
    expect(await daHoanThanh(tk.c)).toBe(false);
    await goi("POST", `/v1/dao-tao/chuyen-de/${PREFIX}-pt/bai/p-3/hoan-thanh`, tk.c, {});
    expect(await daHoanThanh(tk.c)).toBe(true);
    expect(await daHoanThanh(tk.a)).toBe(false);
  });
});
