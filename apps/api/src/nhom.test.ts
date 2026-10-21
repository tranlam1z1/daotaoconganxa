/**
 * Nhóm học cùng (docs/PLAN.md GĐ16a) trên Postgres test thật.
 *
 * Dữ liệu gieo chính: thành viên A (trưởng nhóm), B, C; bài 1 có 4 khối, bài 2 có 5 khối, cùng
 * một chuyên đề `xuat_ban`; một đề ôn tập 5 câu. B xong bài 1 TRƯỚC khi vào nhóm và kết thúc
 * phiên đề ôn tập; C đọc bài 2 tới khối 2 và trả lời 3/5 câu, chưa kết thúc. Phần trăm mong đợi
 * tính tay: A = 0; B = ⌊(100 + 0 + 100) / 3⌋ = 66; C = ⌊(0 + 40 + 60) / 3⌋ = 33; trung bình nhóm
 * = ⌊(0 + 66 + 33) / 3⌋ = 33.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import { sinhMaMoi } from "@qdpl/dao-tao";
import { chayNhacHoc, type GuiDay, luuCaiDatNhac, luuDangKyDay, sql } from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-gd16a";

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

interface TaiKhoan {
  id: string;
  token: string;
}

async function taoTaiKhoan(ten: string, role = "can_bo"): Promise<TaiKhoan> {
  const [r] = (await sql`
    INSERT INTO accounts (username, name, role) VALUES (${`${PREFIX}-${ten}`}, ${`Cán bộ ${ten}`}, ${role})
    RETURNING id`) as any[];
  return { id: r.id, token: (await createSession(r.id, "test")).token };
}

async function donDep() {
  const ds = `${PREFIX}%`;
  // owner_account_id là RESTRICT: xóa nhóm trước tài khoản.
  await sql`DELETE FROM study_groups WHERE owner_account_id IN (SELECT id FROM accounts WHERE username LIKE ${ds})`;
  await sql`DELETE FROM courses WHERE slug LIKE ${ds}`;
  await sql`DELETE FROM questions WHERE code LIKE ${ds}`;
  await sql`DELETE FROM question_topics WHERE code LIKE ${ds}`;
  await sql`DELETE FROM access_log WHERE account_id IN (SELECT id FROM accounts WHERE username LIKE ${ds})`;
  await sql`DELETE FROM accounts WHERE username LIKE ${ds}`;
}

const tk: Record<string, TaiKhoan> = {};
const bai: Record<string, string> = {};
const chuDe: Record<string, string> = {};
const cauChuDe: Record<string, string[]> = {};
let courseId = "";

async function taoChuDe(khoa: string, soCau: number) {
  const [t] = (await sql`
    INSERT INTO question_topics (code, name) VALUES (${`${PREFIX}-${khoa}`}, ${`Chủ đề thử GĐ16a ${khoa}`})
    RETURNING id`) as any[];
  chuDe[khoa] = t.id;
  cauChuDe[khoa] = [];
  for (let i = 1; i <= soCau; i++) {
    const [q] = (await sql`
      INSERT INTO questions (code, topic_id, level, kind, stem, options, answer, explanation, status)
      VALUES (${`${PREFIX}-${khoa}-${i}`}, ${t.id}, ${(["de", "trung_binh", "kho"] as const)[i % 3]!}, 'dung_sai',
              ${`Nhận định thử GĐ16a ${khoa} số ${i}`}, '{}', ${sql.json({ dung: ["dung"] })}, 'Giải thích.', 'da_duyet')
      RETURNING id`) as any[];
    cauChuDe[khoa]!.push(q.id);
  }
}

async function taoBai(course: string, slug: string, ordinal: number, soKhoi: number, status = "xuat_ban") {
  const [l] = (await sql`
    INSERT INTO lessons (course_id, slug, ordinal, title, status)
    VALUES (${course}, ${slug}, ${ordinal}, ${`Bài thử GĐ16a ${slug}`}, ${status})
    RETURNING id`) as any[];
  for (let k = 1; k <= soKhoi; k++) {
    await sql`
      INSERT INTO lesson_blocks (lesson_id, ordinal, kind, data, status)
      VALUES (${l.id}, ${k}, 'giang', ${sql.json({ md: `Khối ${k}` })}, 'xuat_ban')`;
  }
  return l.id as string;
}

/** Trả lời `soCau` câu đầu của phiên (đúng hay sai không quan trọng với phần trăm). */
async function traLoi(phienId: string, token: string, soCau: number) {
  for (let stt = 1; stt <= soCau; stt++) {
    const r = await goi("POST", `/v1/luyen-tap/phien/${phienId}/tra-loi`, token, {
      stt,
      tra_loi: { chon: ["dung"] },
    });
    expect(r.status).toBe(200);
  }
}

async function taoNhom(chu: TaiKhoan, ten: string): Promise<{ id: string; ma: string }> {
  const r = await goi("POST", "/v1/nhom", chu.token, { ten });
  expect(r.status).toBe(201);
  return { id: r.body.id, ma: r.body.ma_moi };
}

async function thamGia(ai: TaiKhoan, ma: string) {
  const r = await goi("POST", "/v1/nhom/tham-gia", ai.token, { ma });
  expect(r.status).toBe(200);
}

/** Tìm mọi khóa trùng tên cấm ở mọi độ sâu. */
function khoaCam(v: unknown, cam: ReadonlySet<string>, ra: string[] = []): string[] {
  if (Array.isArray(v)) for (const x of v) khoaCam(x, cam, ra);
  else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      if (cam.has(k)) ra.push(k);
      khoaCam(x, cam, ra);
    }
  }
  return ra;
}

beforeAll(async () => {
  await donDep();
  for (const ten of ["a", "b", "c", "d", "e", "g", "h", "x", "y", "z", "w", "n1", "n2", "n3"]) {
    tk[ten] = await taoTaiKhoan(ten);
  }
  tk.q = await taoTaiKhoan("q", "quan_ly");
  tk.k = await taoTaiKhoan("k", "khach");

  const [c] = (await sql`
    INSERT INTO courses (slug, title, status, as_of) VALUES (${`${PREFIX}-cd`}, 'Chuyên đề thử GĐ16a', 'xuat_ban', '2026-09-01')
    RETURNING id`) as any[];
  courseId = c.id;
  bai.b1 = await taoBai(courseId, "bai-1", 1, 4);
  bai.b2 = await taoBai(courseId, "bai-2", 2, 5);
  bai.nhap = await taoBai(courseId, "bai-nhap", 3, 1, "nhap");
  const [cNhap] = (await sql`
    INSERT INTO courses (slug, title, status, as_of) VALUES (${`${PREFIX}-cd-nhap`}, 'Chuyên đề nháp GĐ16a', 'nhap', '2026-09-01')
    RETURNING id`) as any[];
  bai.trongCdNhap = await taoBai(cNhap.id, "bai-x", 1, 1);

  await taoChuDe("t1", 5);
  await taoChuDe("t2", 4);
  await taoChuDe("t3", 6);
});

afterAll(async () => {
  await donDep();
});

/* ------------------------------------------------------------------ */
/* Tiến độ                                                             */
/* ------------------------------------------------------------------ */

describe("tiến độ trên dữ liệu gieo 3 thành viên, 2 bài học, 1 đề ôn tập", () => {
  const n = { id: "", ma: "", de: "", phienB: "", phienC: "" };

  beforeAll(async () => {
    // B xong bài 1 trước khi vào nhóm.
    const xong = await goi(
      "POST",
      `/v1/dao-tao/chuyen-de/${PREFIX}-cd/bai/bai-1/hoan-thanh`,
      tk.b!.token,
      {},
    );
    expect(xong.status).toBe(200);

    Object.assign(n, await taoNhom(tk.a!, "Nhóm thử GĐ16a"));
    await thamGia(tk.b!, n.ma);
    await thamGia(tk.c!, n.ma);
    for (const l of [bai.b1, bai.b2]) {
      expect(
        (await goi("POST", `/v1/nhom/${n.id}/muc`, tk.a!.token, { loai: "bai_hoc", lesson_id: l })).status,
      ).toBe(201);
    }
    const de = await goi("POST", `/v1/nhom/${n.id}/muc`, tk.a!.token, {
      loai: "de_on_tap",
      topic_id: chuDe.t1,
      so_cau: 5,
      ten: "Đề ôn tốc độ",
    });
    expect(de.status).toBe(201);
    n.de = de.body.id;

    // C đọc bài 2 tới khối 2 (trang web chưa gửi vị trí khối nên gieo thẳng).
    const [e] = (await sql`
      INSERT INTO enrollments (account_id, course_id) VALUES (${tk.c!.id}, ${courseId}) RETURNING id`) as any[];
    await sql`
      INSERT INTO lesson_progress (enrollment_id, lesson_id, state, last_block_ordinal)
      VALUES (${e.id}, ${bai.b2!}, 'dang_hoc', 2)`;

    const pB = await goi("POST", `/v1/nhom/${n.id}/muc/${n.de}/bat-dau`, tk.b!.token);
    expect(pB.status).toBe(201);
    expect(pB.body.tong).toBe(5);
    n.phienB = pB.body.phien_id;
    await traLoi(n.phienB, tk.b!.token, 5);
    expect((await goi("POST", `/v1/luyen-tap/phien/${n.phienB}/ket-thuc`, tk.b!.token)).status).toBe(200);

    const pC = await goi("POST", `/v1/nhom/${n.id}/muc/${n.de}/bat-dau`, tk.c!.token);
    n.phienC = pC.body.phien_id;
    await traLoi(n.phienC, tk.c!.token, 3);
  });

  test("phần trăm từng người và trung bình nhóm khớp phép tính tay", async () => {
    const r = await goi("GET", `/v1/nhom/${n.id}`, tk.a!.token);
    expect(r.status).toBe(200);
    const theoTen = Object.fromEntries(r.body.thanh_vien.map((t: any) => [t.ho_ten, t.phan_tram]));
    expect(theoTen).toEqual({ "Cán bộ a": 0, "Cán bộ b": 66, "Cán bộ c": 33 });
    expect(r.body.trung_binh_nhom).toBe(33);
    expect(r.body.phan_tram_cua_toi).toBe(0);
    expect(r.body.muc.map((m: any) => [m.loai, m.trang_thai])).toEqual([
      ["bai_hoc", "tinh"],
      ["bai_hoc", "tinh"],
      ["de_on_tap", "tinh"],
    ]);
    const cuaC = await goi("GET", `/v1/nhom/${n.id}`, tk.c!.token);
    expect(cuaC.body.muc.map((m: any) => m.phan_tram_cua_toi)).toEqual([0, 40, 60]);
  });

  test("bài xong trước khi vào nhóm tính 100; tiến độ từng mục của một thành viên", async () => {
    const r = await goi("GET", `/v1/nhom/${n.id}/thanh-vien/${tk.b!.id}/tien-do`, tk.c!.token);
    expect(r.status).toBe(200);
    expect(r.body.phan_tram).toBe(66);
    expect(r.body.muc.map((m: any) => m.phan_tram)).toEqual([100, 0, 100]);
  });

  test("danh sách nhóm của tôi có phần trăm của tôi và trung bình nhóm", async () => {
    const r = await goi("GET", "/v1/nhom", tk.b!.token);
    const g = r.body.items.find((x: any) => x.id === n.id);
    expect(g).toMatchObject({
      so_thanh_vien: 3,
      vai_tro: "thanh_vien",
      phan_tram_cua_toi: 66,
      trung_binh_nhom: 33,
    });
  });

  test("quét khóa cấm: phản hồi cho thành viên không có điểm, số câu đúng, kết quả", async () => {
    const cam = new Set(["score", "diem", "correct", "so_cau_dung", "passed", "dat"]);
    const ct = await goi("GET", `/v1/nhom/${n.id}`, tk.c!.token);
    const td = await goi("GET", `/v1/nhom/${n.id}/thanh-vien/${tk.b!.id}/tien-do`, tk.c!.token);
    expect(khoaCam(ct.body, cam)).toEqual([]);
    expect(khoaCam(td.body, cam)).toEqual([]);
  });

  test("phiên đề ôn tập trả tên đề và nhóm để quay về (Đ14)", async () => {
    const r = await goi("GET", `/v1/luyen-tap/phien/${n.phienB}`, tk.b!.token);
    expect(r.body.nguon).toBe("nhom");
    expect(r.body.nhom).toEqual({ id: n.id, ten_de: "Đề ôn tốc độ" });
  });

  test("bắt đầu đề ôn tập hai lần trả cùng một phiên", async () => {
    const r = await goi("POST", `/v1/nhom/${n.id}/muc/${n.de}/bat-dau`, tk.c!.token);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ phien_id: n.phienC, da_co: true });
  });

  test("kết thúc phiên thì mục là 100 và XP cộng đúng một lần; làm lại không cộng thêm (N17)", async () => {
    const khoa = `nhom:${n.de}:${tk.c!.id}`;
    expect((await goi("POST", `/v1/luyen-tap/phien/${n.phienC}/ket-thuc`, tk.c!.token)).status).toBe(200);
    const muc = await goi("GET", `/v1/nhom/${n.id}`, tk.c!.token);
    expect(muc.body.muc[2].phan_tram_cua_toi).toBe(100);
    const dem = async () =>
      ((await sql`SELECT count(*)::int AS n FROM xp_ledger WHERE source_id = ${khoa}`) as any[])[0]
        .n as number;
    expect(await dem()).toBe(1);

    const lai = await goi("POST", `/v1/nhom/${n.id}/muc/${n.de}/bat-dau`, tk.c!.token);
    expect(lai.status).toBe(201);
    expect(lai.body.phien_id).not.toBe(n.phienC);
    await traLoi(lai.body.phien_id, tk.c!.token, 5);
    expect((await goi("POST", `/v1/luyen-tap/phien/${lai.body.phien_id}/ket-thuc`, tk.c!.token)).status).toBe(
      200,
    );
    expect(await dem()).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* Quyền, mã mời, giới hạn                                             */
/* ------------------------------------------------------------------ */

describe("quyền và mã mời", () => {
  const n = { id: "", ma: "" };
  beforeAll(async () => {
    Object.assign(n, await taoNhom(tk.a!, "Nhóm quyền GĐ16a"));
    await thamGia(tk.b!, n.ma);
  });

  test("không phải thành viên và quản lý không là thành viên nhận 404; id sai dạng nhận 404; khách nhận 403", async () => {
    expect((await goi("GET", `/v1/nhom/${n.id}`, tk.d!.token)).status).toBe(404);
    expect((await goi("GET", `/v1/nhom/${n.id}`, tk.q!.token)).status).toBe(404);
    expect((await goi("GET", `/v1/nhom/${n.id}/thanh-vien/${tk.b!.id}/tien-do`, tk.d!.token)).status).toBe(
      404,
    );
    expect((await goi("GET", "/v1/nhom/khong-phai-uuid", tk.a!.token)).status).toBe(404);
    expect((await goi("GET", "/v1/nhom", tk.k!.token)).status).toBe(403);
    expect((await goi("GET", "/v1/nhom")).status).toBe(401);
  });

  test("thành viên thường đổi mã mời nhận 403; mã cũ sau khi đổi nhận 404, mã mới dùng được", async () => {
    expect((await goi("POST", `/v1/nhom/${n.id}/ma-moi`, tk.b!.token)).status).toBe(403);
    const doi = await goi("POST", `/v1/nhom/${n.id}/ma-moi`, tk.a!.token);
    expect(doi.status).toBe(200);
    expect(doi.body.ma_moi).not.toBe(n.ma);
    expect((await goi("POST", "/v1/nhom/tham-gia", tk.d!.token, { ma: n.ma })).status).toBe(404);
    const xem = await goi("GET", `/v1/nhom/ma/${doi.body.ma_moi}`, tk.d!.token);
    expect(xem.body).toMatchObject({ ten: "Nhóm quyền GĐ16a", so_thanh_vien: 2, truong_nhom: "Cán bộ a" });
    await thamGia(tk.d!, doi.body.ma_moi.toLowerCase());
    expect((await goi("GET", `/v1/nhom/${n.id}`, tk.d!.token)).status).toBe(200);
    n.ma = doi.body.ma_moi;
  });

  test("sai mã 10 lần thì lần thứ 11 trong 15 phút nhận 429, kể cả khi mã đúng", async () => {
    for (let i = 0; i < 10; i++) {
      expect((await goi("POST", "/v1/nhom/tham-gia", tk.e!.token, { ma: "22222222" })).status).toBe(404);
    }
    expect((await goi("POST", "/v1/nhom/tham-gia", tk.e!.token, { ma: "22222222" })).status).toBe(429);
    expect((await goi("GET", `/v1/nhom/ma/${n.ma}`, tk.e!.token)).status).toBe(429);
  });

  test("nhóm đủ 30 thành viên nhận 409", async () => {
    const chu = await taoTaiKhoan("day-chu");
    const g = await taoNhom(chu, "Nhóm đủ người GĐ16a");
    await sql`
      WITH moi AS (
        INSERT INTO accounts (username, name, role)
        SELECT ${`${PREFIX}-day-`} || i, 'Cán bộ đủ người ' || i, 'can_bo' FROM generate_series(1, 29) i
        RETURNING id)
      INSERT INTO study_group_members (group_id, account_id) SELECT ${g.id}, id FROM moi`;
    const r = await goi("POST", "/v1/nhom/tham-gia", tk.h!.token, { ma: g.ma });
    expect(r.status).toBe(409);
  });

  test("mời ra khỏi nhóm: người bị mời ra nhận 404 khi xem nhóm", async () => {
    expect((await goi("POST", `/v1/nhom/${n.id}/thanh-vien/${tk.d!.id}/moi-ra`, tk.b!.token)).status).toBe(
      403,
    );
    expect((await goi("POST", `/v1/nhom/${n.id}/thanh-vien/${tk.d!.id}/moi-ra`, tk.a!.token)).status).toBe(
      200,
    );
    expect((await goi("GET", `/v1/nhom/${n.id}`, tk.d!.token)).status).toBe(404);
  });
});

describe("nhóm đã lưu trữ", () => {
  test("cả 13 route ghi của nhóm nhận 409", async () => {
    const g = await taoNhom(tk.a!, "Nhóm lưu trữ GĐ16a");
    await thamGia(tk.b!, g.ma);
    const muc = await goi("POST", `/v1/nhom/${g.id}/muc`, tk.a!.token, {
      loai: "bai_hoc",
      lesson_id: bai.b1,
    });
    expect((await goi("POST", `/v1/nhom/${g.id}/luu-tru`, tk.a!.token)).status).toBe(200);
    const b = tk.b!.id;
    const ghi: Array<[string, string, unknown?]> = [
      ["PATCH", `/v1/nhom/${g.id}`, { ten: "Tên mới" }],
      ["POST", "/v1/nhom/tham-gia", { ma: g.ma }],
      ["POST", `/v1/nhom/${g.id}/ma-moi`],
      ["POST", `/v1/nhom/${g.id}/roi`],
      ["POST", `/v1/nhom/${g.id}/thanh-vien/${b}/moi-ra`],
      ["POST", `/v1/nhom/${g.id}/thanh-vien/${b}/truong-nhom`],
      ["POST", `/v1/nhom/${g.id}/muc`, { loai: "bai_hoc", lesson_id: bai.b2 }],
      ["DELETE", `/v1/nhom/${g.id}/muc/${muc.body.id}`],
      ["PUT", `/v1/nhom/${g.id}/muc/thu-tu`, { item_ids: [muc.body.id] }],
      ["PATCH", `/v1/nhom/${g.id}/muc/${muc.body.id}`, { han_goi_y: "2026-10-15" }],
      ["POST", `/v1/nhom/${g.id}/muc/${muc.body.id}/bat-dau`],
      ["POST", `/v1/nhom/${g.id}/co-vu/${b}`],
      ["POST", `/v1/nhom/${g.id}/luu-tru`],
    ];
    const ma = await Promise.all(
      ghi.map(([m, p, body]) =>
        goi(m, p, m === "POST" && p.endsWith("tham-gia") ? tk.d!.token : tk.a!.token, body),
      ),
    );
    expect(ma.map((r) => r.status)).toEqual(ghi.map(() => 409));
    // Vẫn đọc được.
    const doc = await goi("GET", `/v1/nhom/${g.id}`, tk.b!.token);
    expect(doc.status).toBe(200);
    expect(doc.body.trang_thai).toBe("luu_tru");
  });
});

/* ------------------------------------------------------------------ */
/* Chia sẻ                                                             */
/* ------------------------------------------------------------------ */

describe("chia sẻ, gỡ, sắp thứ tự, hạn gợi ý", () => {
  const n = { id: "", ma: "" };
  beforeAll(async () => {
    Object.assign(n, await taoNhom(tk.x!, "Nhóm chia sẻ GĐ16a"));
    await thamGia(tk.y!, n.ma);
  });
  const chiaSe = (ai: TaiKhoan, body: unknown) => goi("POST", `/v1/nhom/${n.id}/muc`, ai.token, body);

  test("bài chưa xuất bản, bài thuộc chuyên đề chưa xuất bản, chủ đề dưới 5 câu nhận 400; trùng bài nhận 409", async () => {
    expect((await chiaSe(tk.x!, { loai: "bai_hoc", lesson_id: bai.nhap })).status).toBe(400);
    expect((await chiaSe(tk.x!, { loai: "bai_hoc", lesson_id: bai.trongCdNhap })).status).toBe(400);
    const it = await chiaSe(tk.x!, { loai: "de_on_tap", topic_id: chuDe.t2, so_cau: 5, ten: "Đề thiếu câu" });
    expect(it.status).toBe(400);
    expect((await chiaSe(tk.x!, { loai: "bai_hoc", lesson_id: bai.b1 })).status).toBe(201);
    expect((await chiaSe(tk.y!, { loai: "bai_hoc", lesson_id: bai.b1 })).status).toBe(409);
    expect((await chiaSe(tk.x!, { loai: "bai_hoc", lesson_id: crypto.randomUUID() })).status).toBe(404);
  });

  test("gửi kèm khóa lạ phan_tram nhận 400; số câu ngoài 5–20 nhận 400; tên có thẻ HTML nhận 400", async () => {
    expect((await chiaSe(tk.x!, { loai: "bai_hoc", lesson_id: bai.b2, phan_tram: 100 })).status).toBe(400);
    expect(
      (await chiaSe(tk.x!, { loai: "de_on_tap", topic_id: chuDe.t1, so_cau: 4, ten: "Đề bốn câu" })).status,
    ).toBe(400);
    expect((await goi("POST", "/v1/nhom", tk.x!.token, { ten: "<b>Nhóm</b>" })).status).toBe(400);
    expect((await goi("POST", "/v1/nhom", tk.x!.token, { ten: "Nhóm hợp lệ", phan_tram: 50 })).status).toBe(
      400,
    );
  });

  test("nguồn chia sẻ: chỉ bài và chuyên đề xuất bản, chỉ chủ đề đủ 5 câu", async () => {
    const b = await goi("GET", `/v1/nhom/nguon?loai=bai_hoc&q=${encodeURIComponent("GĐ16a")}`, tk.x!.token);
    const ids = b.body.items.map((x: any) => x.id);
    expect(ids).toContain(bai.b1);
    expect(ids).not.toContain(bai.nhap);
    expect(ids).not.toContain(bai.trongCdNhap);
    const t = await goi(
      "GET",
      `/v1/nhom/nguon?loai=chu_de&q=${encodeURIComponent("thử GĐ16a")}`,
      tk.x!.token,
    );
    const tids = t.body.items.map((x: any) => x.id);
    expect(tids).toContain(chuDe.t1);
    expect(tids).not.toContain(chuDe.t2);
    expect((await goi("GET", "/v1/nhom/nguon?loai=bai_hoc&la=1", tk.x!.token)).status).toBe(400);
  });

  test("gỡ mục: thành viên chỉ gỡ mục mình chia sẻ, trưởng nhóm gỡ mọi mục", async () => {
    const muc = (await goi("GET", `/v1/nhom/${n.id}`, tk.x!.token)).body.muc;
    const cuaX = muc[0].id;
    expect((await goi("DELETE", `/v1/nhom/${n.id}/muc/${cuaX}`, tk.y!.token)).status).toBe(403);
    const cuaY = await chiaSe(tk.y!, { loai: "bai_hoc", lesson_id: bai.b2 });
    expect((await goi("DELETE", `/v1/nhom/${n.id}/muc/${cuaY.body.id}`, tk.y!.token)).status).toBe(200);
    expect((await goi("DELETE", `/v1/nhom/${n.id}/muc/${cuaX}`, tk.x!.token)).status).toBe(200);
    expect((await goi("GET", `/v1/nhom/${n.id}`, tk.x!.token)).body.muc).toEqual([]);
    // Gỡ rồi thì chia sẻ lại được.
    expect((await chiaSe(tk.x!, { loai: "bai_hoc", lesson_id: bai.b1 })).status).toBe(201);
  });

  test("sắp thứ tự phải là hoán vị đúng; đặt và bỏ hạn gợi ý (trưởng nhóm)", async () => {
    const de = await chiaSe(tk.x!, { loai: "de_on_tap", topic_id: chuDe.t1, so_cau: 5, ten: "Đề ôn thứ tự" });
    const truoc = (await goi("GET", `/v1/nhom/${n.id}`, tk.x!.token)).body.muc.map((m: any) => m.id);
    expect(truoc).toHaveLength(2);
    const dao = [...truoc].reverse();
    expect(
      (await goi("PUT", `/v1/nhom/${n.id}/muc/thu-tu`, tk.x!.token, { item_ids: [truoc[0]] })).status,
    ).toBe(400);
    expect(
      (await goi("PUT", `/v1/nhom/${n.id}/muc/thu-tu`, tk.x!.token, { item_ids: [truoc[0], truoc[0]] }))
        .status,
    ).toBe(400);
    expect((await goi("PUT", `/v1/nhom/${n.id}/muc/thu-tu`, tk.y!.token, { item_ids: dao })).status).toBe(
      403,
    );
    expect((await goi("PUT", `/v1/nhom/${n.id}/muc/thu-tu`, tk.x!.token, { item_ids: dao })).status).toBe(
      200,
    );
    const sau = (await goi("GET", `/v1/nhom/${n.id}`, tk.x!.token)).body.muc;
    expect(sau.map((m: any) => m.id)).toEqual(dao);

    const han = `/v1/nhom/${n.id}/muc/${de.body.id}`;
    expect((await goi("PATCH", han, tk.x!.token, { han_goi_y: "2026-10-15" })).status).toBe(200);
    const coHan = (await goi("GET", `/v1/nhom/${n.id}`, tk.y!.token)).body.muc.find(
      (m: any) => m.id === de.body.id,
    );
    expect(coHan.han_goi_y).toBe("2026-10-15");
    expect((await goi("PATCH", han, tk.x!.token, { han_goi_y: null })).status).toBe(200);
    expect((await goi("PATCH", han, tk.y!.token, { han_goi_y: null })).status).toBe(403);
  });

  test("câu bị gỡ duyệt sau khi chia sẻ: đề ngắn lại; còn dưới 5 câu thì không tính và không bắt đầu được", async () => {
    const de = await chiaSe(tk.x!, { loai: "de_on_tap", topic_id: chuDe.t3, so_cau: 6, ten: "Đề sáu câu" });
    const [ids] = (await sql`SELECT question_ids FROM study_group_items WHERE id = ${de.body.id}`) as any[];
    expect(ids.question_ids).toHaveLength(6);
    await sql`UPDATE questions SET status = 'luu_tru' WHERE id = ${ids.question_ids[0]}`;
    const p = await goi("POST", `/v1/nhom/${n.id}/muc/${de.body.id}/bat-dau`, tk.x!.token);
    expect(p.body.tong).toBe(5);
    await sql`UPDATE questions SET status = 'luu_tru' WHERE id = ${ids.question_ids[1]}`;
    const ct = await goi("GET", `/v1/nhom/${n.id}`, tk.y!.token);
    const muc = ct.body.muc.find((m: any) => m.id === de.body.id);
    expect(muc).toMatchObject({ trang_thai: "khong_du_cau", phan_tram_cua_toi: null });
    expect((await goi("POST", `/v1/nhom/${n.id}/muc/${de.body.id}/bat-dau`, tk.y!.token)).status).toBe(409);
  });
});

/* ------------------------------------------------------------------ */
/* Cổ vũ                                                               */
/* ------------------------------------------------------------------ */

describe("cổ vũ", () => {
  const n = { id: "", ma: "" };
  beforeAll(async () => {
    Object.assign(n, await taoNhom(tk.g!, "Nhóm cổ vũ GĐ16a"));
    await thamGia(tk.h!, n.ma);
    await thamGia(tk.z!, n.ma);
  });
  const coVu = (tu: TaiKhoan, den: string) => goi("POST", `/v1/nhom/${n.id}/co-vu/${den}`, tu.token);

  test("tự cổ vũ nhận 400; bấm hai lần trong ngày thì về 0; không cộng XP (N8)", async () => {
    const xp = async () =>
      ((await sql`SELECT count(*)::int AS n FROM xp_ledger WHERE account_id = ${tk.h!.id}`) as any[])[0]
        .n as number;
    const truoc = await xp();
    expect((await coVu(tk.g!, tk.g!.id)).status).toBe(400);
    const lan1 = await coVu(tk.g!, tk.h!.id);
    expect(lan1.body).toEqual({ da_co_vu: true, tong: 1 });
    const xemH = await goi("GET", `/v1/nhom/${n.id}`, tk.h!.token);
    expect(xemH.body.thanh_vien.find((t: any) => t.la_toi).luot_co_vu).toBe(1);
    const xemG = await goi("GET", `/v1/nhom/${n.id}`, tk.g!.token);
    expect(xemG.body.thanh_vien.find((t: any) => t.id === tk.h!.id).da_co_vu).toBe(true);
    expect((await coVu(tk.g!, tk.h!.id)).body).toEqual({ da_co_vu: false, tong: 0 });
    expect(await xp()).toBe(truoc);
  });

  test("không cổ vũ được người đã rời nhóm", async () => {
    expect((await goi("POST", `/v1/nhom/${n.id}/roi`, tk.z!.token)).status).toBe(200);
    expect((await coVu(tk.g!, tk.z!.id)).status).toBe(400);
    const [r] = (await sql`
      SELECT count(*)::int AS n FROM study_group_cheers WHERE group_id = ${n.id} AND to_account_id = ${tk.z!.id}`) as any[];
    expect(r.n).toBe(0);
    expect((await goi("GET", `/v1/nhom/${n.id}`, tk.z!.token)).status).toBe(404);
  });

  test("lần bấm thứ 61 trong một phút nhận 429", async () => {
    const kq: number[] = [];
    for (let i = 0; i < 61; i++) kq.push((await coVu(tk.h!, tk.g!.id)).status);
    expect(kq.slice(0, 60).every((s) => s === 200)).toBe(true);
    expect(kq[60]).toBe(429);
  });
});

/* ------------------------------------------------------------------ */
/* Rời nhóm, trưởng nhóm                                               */
/* ------------------------------------------------------------------ */

describe("rời nhóm và trưởng nhóm", () => {
  test("trưởng nhóm rời khi còn thành viên nhận 409; chuyển quyền rồi rời được; người cuối rời thì nhóm lưu trữ", async () => {
    const g = await taoNhom(tk.a!, "Nhóm rời GĐ16a");
    await thamGia(tk.b!, g.ma);
    expect((await goi("POST", `/v1/nhom/${g.id}/roi`, tk.a!.token)).status).toBe(409);
    expect(
      (await goi("POST", `/v1/nhom/${g.id}/thanh-vien/${tk.b!.id}/truong-nhom`, tk.a!.token)).status,
    ).toBe(200);
    expect((await goi("POST", `/v1/nhom/${g.id}/roi`, tk.a!.token)).status).toBe(200);
    const [chu] = (await sql`SELECT owner_account_id FROM study_groups WHERE id = ${g.id}`) as any[];
    expect(chu.owner_account_id).toBe(tk.b!.id);
    const cuoi = await goi("POST", `/v1/nhom/${g.id}/roi`, tk.b!.token);
    expect(cuoi.body).toEqual({ trang_thai_nhom: "luu_tru" });
    const [st] = (await sql`SELECT status FROM study_groups WHERE id = ${g.id}`) as any[];
    expect(st.status).toBe("luu_tru");
  });

  test("trưởng nhóm bị khóa tài khoản: quyền chuyển cho người vào sớm nhất; không còn ai thì lưu trữ (N16)", async () => {
    const w = await taoTaiKhoan("w2");
    const g = await taoNhom(w, "Nhóm khóa GĐ16a");
    await thamGia(tk.y!, g.ma);
    await thamGia(tk.x!, g.ma);
    await sql`UPDATE accounts SET enabled = false WHERE id = ${w.id}`;
    const r = await goi("GET", `/v1/nhom/${g.id}`, tk.x!.token);
    expect(r.body.thanh_vien.find((t: any) => t.vai_tro === "truong_nhom").id).toBe(tk.y!.id);

    const w3 = await taoTaiKhoan("w3");
    const g2 = await taoNhom(w3, "Nhóm khóa một người GĐ16a");
    await sql`UPDATE accounts SET enabled = false WHERE id = ${w3.id}`;
    const xem = await goi("GET", `/v1/nhom/ma/${g2.ma}`, tk.w!.token);
    expect(xem.body.trang_thai).toBe("luu_tru");
  });
});

/* ------------------------------------------------------------------ */
/* Thông báo nhóm (N9, N15)                                            */
/* ------------------------------------------------------------------ */

describe("thông báo nhóm học cùng", () => {
  test("được cổ vũ thì nhận một thông báo nhom_hoc trong ngày; tắt công tắc thì không nhận", async () => {
    const g = await taoNhom(tk.n1!, "Nhóm thông báo GĐ16a");
    await thamGia(tk.n2!, g.ma);
    await thamGia(tk.n3!, g.ma);
    const tatCa = {
      remind_at: null,
      streak_warning: false,
      new_exam: false,
      new_challenge: false,
      quiet_from: "00:00",
      quiet_to: "00:00",
    };
    for (const ai of [tk.n2!, tk.n3!]) {
      await luuDangKyDay({
        accountId: ai.id,
        endpoint: `https://push.test/${PREFIX}-${ai.id}`,
        p256dh: "k",
        auth: "a",
      });
      await luuCaiDatNhac(ai.id, tatCa);
    }
    const tat = await goi("PUT", "/v1/thong-bao/cai-dat", tk.n3!.token, { group_activity: false });
    expect(tat.body.group_activity).toBe(false);
    for (const den of [tk.n2!, tk.n3!]) {
      expect((await goi("POST", `/v1/nhom/${g.id}/co-vu/${den.id}`, tk.n1!.token)).status).toBe(200);
    }

    const daGui: Array<{ endpoint: string; noiDung: any }> = [];
    const gui: GuiDay = async (dk, noiDung) => {
      daGui.push({ endpoint: dk.endpoint, noiDung: JSON.parse(noiDung) });
      return { ok: true };
    };
    const cua = (ai: TaiKhoan) => daGui.filter((d) => d.endpoint.endsWith(ai.id)).map((d) => d.noiDung.loai);
    await chayNhacHoc(new Date(), gui);
    expect(cua(tk.n2!)).toEqual(["nhom_hoc"]);
    expect(cua(tk.n3!)).toEqual([]);
    await chayNhacHoc(new Date(), gui);
    expect(cua(tk.n2!)).toEqual(["nhom_hoc"]);
  });
});

/* ------------------------------------------------------------------ */
/* Migration, hiệu năng                                                */
/* ------------------------------------------------------------------ */

describe("CHECK nguồn phiên", () => {
  test("tạo được phiên với cả 9 giá trị source", async () => {
    const nguon = [
      "chu_de",
      "cau_sai",
      "thu_thach",
      "game:vuot_man",
      "game:dua_thoi_gian",
      "game:ghep_cap",
      "game:doan_bien_bao",
      "game:hoi_nhanh_giong_noi",
      "nhom",
    ];
    const tao = (await sql`
      INSERT INTO practice_sessions (account_id, source)
      SELECT ${tk.a!.id}, s FROM unnest(${nguon}::text[]) s
      RETURNING id`) as any[];
    expect(tao).toHaveLength(9);
    await sql`DELETE FROM practice_sessions WHERE id = ANY(${tao.map((r) => r.id as string)}::uuid[])`;
    let loiCheck = "";
    try {
      await sql`INSERT INTO practice_sessions (account_id, source) VALUES (${tk.a!.id}, 'game:khong_co')`;
    } catch (e) {
      loiCheck = (e as { constraint_name?: string }).constraint_name ?? "";
    }
    expect(loiCheck).toBe("practice_sessions_source_check");
  });
});

describe("hiệu năng", () => {
  test("GET /v1/nhom/:id với 30 thành viên, 30 mục: trung vị 5 lần gọi dưới 300 ms", async () => {
    const tv = (await sql`
      INSERT INTO accounts (username, name, role)
      SELECT ${`${PREFIX}-hn-`} || i, 'Cán bộ hiệu năng ' || i, 'can_bo' FROM generate_series(1, 30) i
      RETURNING id`) as any[];
    const ids = tv.map((r) => r.id as string);
    const [c] = (await sql`
      INSERT INTO courses (slug, title, status, as_of) VALUES (${`${PREFIX}-hn`}, 'Chuyên đề hiệu năng', 'xuat_ban', '2026-09-01')
      RETURNING id`) as any[];
    const bh = (await sql`
      INSERT INTO lessons (course_id, slug, ordinal, title, status)
      SELECT ${c.id}, 'hn-' || i, i, 'Bài hiệu năng ' || i, 'xuat_ban' FROM generate_series(1, 20) i
      RETURNING id`) as any[];
    const baiIds = bh.map((r) => r.id as string);
    await sql`
      INSERT INTO lesson_blocks (lesson_id, ordinal, kind, data, status)
      SELECT l, k, 'giang', '{"md":"x"}', 'xuat_ban' FROM unnest(${baiIds}::uuid[]) l, generate_series(1, 3) k`;
    await taoChuDe("hn", 20);
    const cau = cauChuDe.hn!;
    const [g] = (await sql`
      INSERT INTO study_groups (name, owner_account_id, invite_code)
      VALUES ('Nhóm hiệu năng GĐ16a', ${ids[0]!}, ${sinhMaMoi()}) RETURNING id`) as any[];
    await sql`
      INSERT INTO study_group_members (group_id, account_id, role)
      SELECT ${g.id}, a, CASE WHEN a = ${ids[0]!}::uuid THEN 'truong_nhom' ELSE 'thanh_vien' END
      FROM unnest(${ids}::uuid[]) a`;
    await sql`
      INSERT INTO study_group_items (group_id, kind, lesson_id, ordinal)
      SELECT ${g.id}, 'bai_hoc', l, o FROM unnest(${baiIds}::uuid[]) WITH ORDINALITY AS x(l, o)`;
    const de = (await sql`
      INSERT INTO study_group_items (group_id, kind, question_ids, title, ordinal)
      SELECT ${g.id}, 'de_on_tap', ${cau}::uuid[], 'Đề hiệu năng ' || i, 20 + i FROM generate_series(1, 10) i
      RETURNING id`) as any[];
    const deIds = de.map((r) => r.id as string);
    await sql`
      WITH e AS (
        INSERT INTO enrollments (account_id, course_id) SELECT a, ${c.id} FROM unnest(${ids}::uuid[]) a RETURNING id)
      INSERT INTO lesson_progress (enrollment_id, lesson_id, state, last_block_ordinal)
      SELECT e.id, l, CASE WHEN random() < 0.5 THEN 'xong' ELSE 'dang_hoc' END, 2
      FROM e, unnest(${baiIds}::uuid[]) l`;
    const phien = (await sql`
      INSERT INTO practice_sessions (account_id, source, group_item_id, total, finished_at)
      SELECT a, 'nhom', d, 20, CASE WHEN random() < 0.5 THEN now() END
      FROM unnest(${ids}::uuid[]) a, unnest(${deIds}::uuid[]) d
      RETURNING id`) as any[];
    await sql`
      INSERT INTO practice_answers (session_id, question_id, question_version, correct)
      SELECT s, q, 1, true FROM unnest(${phien.map((r) => r.id as string)}::uuid[]) s, unnest(${cau.slice(0, 5)}::uuid[]) q`;

    const token = (await createSession(ids[0]!, "test")).token;
    const thoiGian: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      const r = await goi("GET", `/v1/nhom/${g.id}`, token);
      thoiGian.push(performance.now() - t0);
      expect(r.status).toBe(200);
      expect(r.body.thanh_vien).toHaveLength(30);
      expect(r.body.muc).toHaveLength(30);
    }
    const trungVi = [...thoiGian].sort((x, y) => x - y)[2]!;
    console.info(`[nhom.test] GET chi tiết nhóm 30×30: ${thoiGian.map((t) => t.toFixed(0)).join(", ")} ms`);
    expect(trungVi).toBeLessThan(300);
  });
});
