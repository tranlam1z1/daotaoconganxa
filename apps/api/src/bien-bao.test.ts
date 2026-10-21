/**
 * Kiểm thử API biển báo (docs/PLAN.md GĐ12) trên Postgres test thật: tra cứu chỉ thấy biển đã
 * duyệt, ảnh phục vụ từ kho đối tượng, game đoán biển báo chấm trên máy chủ và XP một lần mỗi ván.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import { sql } from "@qdpl/db";
import { deleteObject, putObject } from "@qdpl/storage";
import { createApp } from "./app.ts";

const app = createApp();

const PREFIX = "test-qdpl-bien-bao";
const ANH = `${PREFIX}.svg`;
const MA = (i: number) => `${PREFIX}-${i}`;

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
    headers: res.headers,
    body: ct.includes("json") ? ((await res.json()) as any) : await res.text(),
  };
}

async function taoTaiKhoan(ten: string) {
  const [acc] = await sql<Array<{ id: string }>>`
    INSERT INTO accounts (email, role) VALUES (${`${PREFIX}-${ten}@vidu.vn`}, 'can_bo') RETURNING id`;
  return { id: acc!.id, token: (await createSession(acc!.id, "test")).token };
}

async function donDep() {
  await sql`DELETE FROM traffic_signs WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM xp_ledger WHERE account_id IN (SELECT id FROM accounts WHERE email LIKE ${`${PREFIX}%`})`;
  await sql`DELETE FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
  await deleteObject(`assets/bien-bao/${ANH}`).catch(() => {});
}

let A: { id: string; token: string };
let B: { id: string; token: string };
let soDaDuyet = 0;

beforeAll(async () => {
  await donDep();
  A = await taoTaiKhoan("a");
  B = await taoTaiKhoan("b");
  await putObject(
    `assets/bien-bao/${ANH}`,
    new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'),
  );
  const dong = [
    ...[0, 1, 2, 3, 4, 5].map((i) => ({
      i,
      nhom: "cam",
      ten: `Cấm đi ngược chiều thử ${i}`,
      status: "da_duyet",
    })),
    ...[6, 7].map((i) => ({ i, nhom: "phu", ten: `Biển phụ thử ${i}`, status: "da_duyet" })),
    { i: 8, nhom: "cam", ten: "Biển bản nháp thử", status: "nhap" },
  ];
  for (const d of dong) {
    await sql`
      INSERT INTO traffic_signs (code, group_name, name, meaning, search_text, image_uri, citation_urn, ordinal, status)
      VALUES (${MA(d.i)}, ${d.nhom}, ${d.ten}, ${`Ý nghĩa ${d.i}`}, ${`${MA(d.i)} ${d.ten}`.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase()},
              ${`assets/bien-bao/${ANH}`}, 'vn:vbqppl:qcvn:41/2024/BGTVT', ${d.i}, ${d.status})`;
  }
  const [n] = await sql<
    Array<{ n: number }>
  >`SELECT count(*)::int AS n FROM traffic_signs WHERE status = 'da_duyet'`;
  soDaDuyet = n!.n;
});

afterAll(async () => {
  await donDep();
});

describe("tra cứu biển báo", () => {
  test("chỉ thấy biển đã duyệt; lọc theo nhóm", async () => {
    const r = await goi("GET", "/v1/tra-cuu/bien-bao?nhom=cam");
    expect(r.status).toBe(200);
    const cua = r.body.items.filter((b: { ma: string }) => b.ma.startsWith(PREFIX));
    expect(cua).toHaveLength(6);
    expect(cua.every((b: { nhom: string; ban_nhap: boolean }) => b.nhom === "cam" && !b.ban_nhap)).toBe(true);
    expect(cua.some((b: { ten: string }) => b.ten === "Biển bản nháp thử")).toBe(false);
  });

  test("tìm theo tên không dấu hoặc theo mã", async () => {
    const r = await goi("GET", `/v1/tra-cuu/bien-bao?q=${encodeURIComponent("nguoc chieu thu 3")}`);
    expect(r.body.items.map((b: { ma: string }) => b.ma)).toEqual([MA(3)]);
    const r2 = await goi("GET", `/v1/tra-cuu/bien-bao?q=${encodeURIComponent(MA(7))}`);
    expect(r2.body.items[0].ma).toBe(MA(7));
  });

  test("chi tiết một biển; biển bản nháp trả 404", async () => {
    const r = await goi("GET", `/v1/tra-cuu/bien-bao/${MA(2)}`);
    expect(r.body).toMatchObject({
      ma: MA(2),
      nhom: "cam",
      anh: ANH,
      can_cu: "vn:vbqppl:qcvn:41/2024/BGTVT",
    });
    expect((await goi("GET", `/v1/tra-cuu/bien-bao/${MA(8)}`)).status).toBe(404);
  });

  test("ảnh phục vụ từ kho đối tượng, có bộ nhớ đệm; tên tệp lạ trả 404", async () => {
    const r = await goi("GET", `/v1/tra-cuu/bien-bao/anh/${ANH}`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/svg+xml");
    expect(r.headers.get("cache-control")).toContain("max-age");
    expect((await goi("GET", "/v1/tra-cuu/bien-bao/anh/khong-co.svg")).status).toBe(404);
    expect((await goi("GET", "/v1/tra-cuu/bien-bao/anh/..%2F..%2Fsecret.txt")).status).toBe(404);
  });
});

describe("game đoán biển báo", () => {
  test("chưa đăng nhập nhận 401", async () => {
    expect((await goi("POST", "/v1/tro-choi/doan-bien-bao/bat-dau")).status).toBe(401);
  });

  test("ván đầy đủ: 4 phương án mỗi câu, không lộ mã; chấm đúng; trả lời lại 409; XP một lần", async () => {
    const bd = await goi("POST", "/v1/tro-choi/doan-bien-bao/bat-dau", A.token);
    expect(bd.status).toBe(201);
    const soCau = Math.min(10, soDaDuyet);
    expect(bd.body.cau).toHaveLength(soCau);
    expect(bd.body.cau.every((c: { phuong_an: unknown[] }) => c.phuong_an.length === 4)).toBe(true);
    const json = JSON.stringify(bd.body);
    expect(json).not.toContain(`${PREFIX}-`);
    expect(json).not.toContain('"answer"');

    // Đáp án đọc từ ảnh chụp trong CSDL.
    const [p] = await sql<Array<{ items: Array<{ ma: string; phuong_an: string[] }> }>>`
      SELECT items FROM practice_sessions WHERE id = ${bd.body.id}`;
    const dung = p!.items.map((c) => String(c.phuong_an.indexOf(c.ma)));

    expect(
      (
        await goi("POST", `/v1/tro-choi/doan-bien-bao/${bd.body.id}/tra-loi`, B.token, {
          stt: 1,
          chon: dung[0],
        })
      ).status,
    ).toBe(403);
    for (const [i, chon] of dung.entries()) {
      const r = await goi("POST", `/v1/tro-choi/doan-bien-bao/${bd.body.id}/tra-loi`, A.token, {
        stt: i + 1,
        chon,
      });
      expect(r.status).toBe(200);
      expect(r.body.dung).toBe(true);
      expect(r.body.dap_an).toBe(chon);
    }
    const lai = await goi("POST", `/v1/tro-choi/doan-bien-bao/${bd.body.id}/tra-loi`, A.token, {
      stt: 1,
      chon: dung[0],
    });
    expect(lai.status).toBe(409);

    const kt = await goi("POST", `/v1/tro-choi/doan-bien-bao/${bd.body.id}/ket-thuc`, A.token);
    expect(kt.body).toMatchObject({ dung: soCau, tong: soCau, xp: soCau + 5 });
    const kt2 = await goi("POST", `/v1/tro-choi/doan-bien-bao/${bd.body.id}/ket-thuc`, A.token);
    expect(kt2.body.dung).toBe(soCau);
    const xp =
      await sql`SELECT xp FROM xp_ledger WHERE account_id = ${A.id} AND source_kind = 'game:doan_bien_bao'`;
    expect(xp).toHaveLength(1);

    // Ván đoán biển báo không mở được qua API luyện tập.
    expect((await goi("GET", `/v1/luyen-tap/phien/${bd.body.id}`, A.token)).status).toBe(404);
  });

  test("chọn sai thì trả về phương án đúng và ý nghĩa biển", async () => {
    const bd = await goi("POST", "/v1/tro-choi/doan-bien-bao/bat-dau", A.token);
    const [p] = await sql<Array<{ items: Array<{ ma: string; phuong_an: string[] }> }>>`
      SELECT items FROM practice_sessions WHERE id = ${bd.body.id}`;
    const dungO = p!.items[0]!.phuong_an.indexOf(p!.items[0]!.ma);
    const r = await goi("POST", `/v1/tro-choi/doan-bien-bao/${bd.body.id}/tra-loi`, A.token, {
      stt: 1,
      chon: String((dungO + 1) % 4),
    });
    expect(r.body).toMatchObject({ dung: false, dap_an: String(dungO) });
    expect(r.body.y_nghia).toBeTruthy();
  });
});
