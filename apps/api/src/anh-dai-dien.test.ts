/**
 * Kiểm thử ảnh đại diện: tải lên, /v1/auth/me trả tên tệp, tải ảnh về, đổi ảnh thì ảnh cũ bị gỡ,
 * bỏ ảnh, và từ chối tệp không phải ảnh.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession, upsertAccount } from "@qdpl/auth";
import { sql } from "@qdpl/db";
import { objectExists } from "@qdpl/storage";
import { createApp } from "./app.ts";

const app = createApp();
const EMAIL = "test-anh-dai-dien@vidu.vn";
let token = "";

// PNG 1×1 hợp lệ; bản thứ hai khác một byte cuối để có hash khác.
const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
  (ch) => ch.charCodeAt(0),
);
const PNG_2 = Uint8Array.from([...PNG, 0]);

beforeAll(async () => {
  const tk = await upsertAccount({ email: EMAIL, sub: "test-anh-dai-dien-sub", name: "Người thử ảnh" });
  token = (await createSession(tk.id, "test")).token;
});

afterAll(async () => {
  await app.request("http://test/v1/toi/anh-dai-dien", {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` },
  });
  await sql`DELETE FROM sessions WHERE account_id IN (SELECT id FROM accounts WHERE email = ${EMAIL})`;
  await sql`DELETE FROM accounts WHERE email = ${EMAIL}`;
});

async function taiLen(du: Uint8Array<ArrayBuffer>, ten = "a.png") {
  const form = new FormData();
  form.set("tep", new File([du], ten));
  const res = await app.request("http://test/v1/toi/anh-dai-dien", {
    method: "PUT",
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  return { status: res.status, body: (await res.json()) as any };
}

async function me() {
  const res = await app.request("http://test/v1/auth/me", { headers: { authorization: `Bearer ${token}` } });
  return (await res.json()) as any;
}

describe("ảnh đại diện", () => {
  test("chưa có ảnh thì anh_dai_dien là null", async () => {
    expect((await me()).anh_dai_dien).toBeNull();
  });

  test("tải ảnh lên, /me trả tên tệp và tải ảnh về được", async () => {
    const kq = await taiLen(PNG);
    expect(kq.status).toBe(200);
    expect(kq.body.anh_dai_dien).toMatch(/^[0-9a-f-]{36}-[0-9a-f]{16}\.png$/);
    expect((await me()).anh_dai_dien).toBe(kq.body.anh_dai_dien);

    const anh = await app.request(`http://test/v1/toi/anh-dai-dien/${kq.body.anh_dai_dien}`);
    expect(anh.status).toBe(200);
    expect(anh.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await anh.arrayBuffer())).toEqual(PNG);
  });

  test("đổi ảnh thì ảnh cũ bị gỡ khỏi kho", async () => {
    const cu = (await me()).anh_dai_dien as string;
    const kq = await taiLen(PNG_2);
    expect(kq.status).toBe(200);
    expect(kq.body.anh_dai_dien).not.toBe(cu);
    expect(await objectExists(`avatars/${cu}`)).toBe(false);
    expect(await objectExists(`avatars/${kq.body.anh_dai_dien}`)).toBe(true);
  });

  test("từ chối tệp không phải ảnh dù đặt đuôi .png", async () => {
    const kq = await taiLen(new TextEncoder().encode("<svg onload=alert(1)>"), "x.png");
    expect(kq.status).toBe(400);
  });

  test("bỏ ảnh thì /me trả null và tệp bị gỡ", async () => {
    const cu = (await me()).anh_dai_dien as string;
    const res = await app.request("http://test/v1/toi/anh-dai-dien", {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect((await me()).anh_dai_dien).toBeNull();
    expect(await objectExists(`avatars/${cu}`)).toBe(false);
  });

  test("chưa đăng nhập thì không tải ảnh lên được", async () => {
    const form = new FormData();
    form.set("tep", new File([PNG], "a.png"));
    const res = await app.request("http://test/v1/toi/anh-dai-dien", { method: "PUT", body: form });
    expect(res.status).toBe(401);
  });

  test("tên tệp lạ không đọc ra ngoài thư mục ảnh", async () => {
    const res = await app.request("http://test/v1/toi/anh-dai-dien/..%2F..%2Fsecret.png");
    expect(res.status).toBe(404);
  });
});
