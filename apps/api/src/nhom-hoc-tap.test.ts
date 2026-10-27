import { afterAll, beforeAll, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import { luuChuyenDe, luuLinhVuc, sql } from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();
const prefix = "test-nhom-hoc-tap";
let token = "";
let admin = "";
let fieldId = "";

async function clean() {
  await sql`DELETE FROM audit_log WHERE target IN (SELECT id::text FROM courses WHERE slug LIKE ${`${prefix}%`})`;
  await sql`DELETE FROM courses WHERE slug LIKE ${`${prefix}%`}`;
  await sql`DELETE FROM fields WHERE slug = ${prefix}`;
  await sql`DELETE FROM accounts WHERE username LIKE ${`${prefix}%`}`;
}

async function request(path: string, bearer?: string, body?: unknown) {
  const res = await app.request(`http://test${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
}

beforeAll(async () => {
  await clean();
  fieldId = (await luuLinhVuc({ slug: prefix, name: "Lĩnh vực kiểm thử nhóm", status: "xuat_ban" })).id;
  for (const [suffix, groups] of [
    ["chung", ["cong_chuc", "vien_chuc", "dang_vien"]],
    ["vc", ["vien_chuc"]],
    ["dv", ["dang_vien"]],
    ["cc", ["cong_chuc"]],
    ["vc-dv", ["vien_chuc", "dang_vien"]],
  ] as const) {
    await luuChuyenDe({
      slug: `${prefix}-${suffix}`,
      title: `Chuyên đề ${suffix}`,
      fieldId,
      asOf: "2026-10-26",
      nhomHocTap: [...groups],
      audience: ["Nhãn cũ cần giữ"],
    });
  }
  await sql`UPDATE courses SET status = 'xuat_ban' WHERE field_id = ${fieldId}`;
  for (const role of ["can_bo", "quan_tri"]) {
    const [row] = await sql`INSERT INTO accounts (username, role, nhom_doi_tuong)
      VALUES (${`${prefix}-${role}`}, ${role}, ARRAY['vien_chuc', 'dang_vien']) RETURNING id`;
    const session = await createSession(row!.id, "test");
    if (role === "can_bo") token = session.token;
    else admin = session.token;
  }
});
afterAll(clean);

test("xuất bản bắt buộc nhóm, không bắt buộc lĩnh vực; chặn cả xuất bản hàng loạt", async () => {
  const slug = `${prefix}-dieu-kien-xuat-ban`;
  const course = await luuChuyenDe({ slug, title: "Kiểm tra xuất bản", asOf: "2026-10-26" });
  await sql`UPDATE courses SET status = 'cho_phap_che' WHERE id = ${course.id}`;
  const path = `/v1/quan-tri/dao-tao/chuyen-de/${course.id}`;
  expect((await request(`${path}/trang-thai`, admin, { trangThai: "xuat_ban" })).status).toBe(400);
  expect((await request(`${path}/bai/trang-thai`, admin, { den: "xuat_ban" })).status).toBe(400);
  const check = await request(`/v1/quan-tri/dao-tao/chuyen-de/${slug}/kiem-tra`, admin);
  expect(check.body.chanBoi.chuaChonNhomHocTap).toBe(true);
  await sql`UPDATE courses SET nhom_hoc_tap = ARRAY['dang_vien'] WHERE id = ${course.id}`;
  const published = await request(`${path}/trang-thai`, admin, { trangThai: "xuat_ban" });
  expect(published.status).toBe(200);
  expect(published.body.chuyenDe.field_id).toBeNull();
  expect((await request(`/v1/dao-tao/chuyen-de/${slug}`, token)).status).toBe(200);
  // Dữ liệu xuất bản cũ thiếu nhóm không được hiện hoặc đọc như bài đã công bố.
  await sql`UPDATE courses SET nhom_hoc_tap = '{}' WHERE id = ${course.id}`;
  expect((await request(`/v1/dao-tao/chuyen-de/${slug}`, token)).status).toBe(404);
  const tree = await request("/v1/dao-tao/linh-vuc", token);
  expect(
    tree.body.items
      .flatMap((f: any) => f.nhom.flatMap((n: any) => n.chuyenDe))
      .some((c: any) => c.slug === slug),
  ).toBe(false);
  await sql`DELETE FROM audit_log WHERE target = ${course.id}`;
  await sql`DELETE FROM courses WHERE id = ${course.id}`;
});

test("chuyên đề không gắn lĩnh vực vẫn xuất hiện trong danh mục theo nhóm", async () => {
  const slug = `${prefix}-khong-linh-vuc`;
  await luuChuyenDe({
    slug,
    title: "Chuyên đề không gắn lĩnh vực",
    asOf: "2026-10-26",
    nhomHocTap: ["vien_chuc"],
  });
  await sql`UPDATE courses SET status = 'xuat_ban' WHERE slug = ${slug}`;
  try {
    const res = await request("/v1/dao-tao/linh-vuc?nhom=vien_chuc", token);
    expect(res.status).toBe(200);
    const courses = res.body.items.flatMap((f: any) => f.nhom.flatMap((n: any) => n.chuyenDe));
    expect(courses.some((c: any) => c.slug === slug)).toBe(true);
  } finally {
    await sql`DELETE FROM courses WHERE slug = ${slug}`;
  }
});

test("tài khoản chưa gắn nhóm không nhận chuyên đề khi lọc theo nhóm của tôi", async () => {
  const [row] = await sql`INSERT INTO accounts (username, role)
    VALUES (${`${prefix}-chua-gan-nhom`}, 'can_bo') RETURNING id`;
  const session = await createSession(row!.id, "test");
  const res = await request("/v1/dao-tao/linh-vuc?nhom=cua_toi", session.token);
  expect(res.status).toBe(200);
  const field = res.body.items.find((f: any) => f.slug === prefix);
  expect(field.nhom.flatMap((n: any) => n.chuyenDe.map((c: any) => c.slug))).toEqual([]);
});

test("lọc một nhóm kèm dùng chung, nhiều nhóm của tôi và bỏ lọc", async () => {
  const list = async (nhom: string, bearer?: string) => {
    const res = await request(`/v1/dao-tao/chuyen-de?q=${prefix}&nhom=${nhom}`, bearer);
    expect(res.status).toBe(200);
    return res.body.items.map((c: any) => c.slug.replace(`${prefix}-`, "")).sort();
  };
  // Lọc q theo tiêu đề, nên dùng tiêu đề có prefix trong các bản ghi kiểm thử.
  await sql`UPDATE courses SET title = slug WHERE field_id = ${fieldId}`;
  expect(await list("vien_chuc")).toEqual(["chung", "vc", "vc-dv"]);
  expect(await list("cua_toi", token)).toEqual(["chung", "dv", "vc", "vc-dv"]);
  expect((await request("/v1/dao-tao/chuyen-de?nhom=dung_chung")).status).toBe(400);
  expect(await list("cong_chuc")).toEqual(["cc", "chung"]);
  expect(await list("tat_ca")).toEqual(["cc", "chung", "dv", "vc", "vc-dv"]);
  expect((await request("/v1/dao-tao/chuyen-de?nhom=cua_toi")).status).toBe(401);
  expect((await request("/v1/dao-tao/linh-vuc?nhom=sai")).status).toBe(400);
});

test("cây lĩnh vực dùng cùng bộ lọc; bộ lọc không khóa đường dẫn chuyên đề", async () => {
  const res = await request("/v1/dao-tao/linh-vuc?nhom=cua_toi", token);
  expect(res.status).toBe(200);
  const field = res.body.items.find((f: any) => f.slug === prefix);
  expect(field.nhom.flatMap((n: any) => n.chuyenDe.map((c: any) => c.slug)).sort()).toEqual(
    ["chung", "dv", "vc", "vc-dv"].map((s) => `${prefix}-${s}`),
  );
  expect((await request(`/v1/dao-tao/chuyen-de/${prefix}-cc`, token)).status).toBe(200);
});

test("soạn chuyên đề lưu nhóm, giữ nhãn cũ, bỏ trường giữ nhóm và [] xóa nhóm", async () => {
  const path = "/v1/quan-tri/dao-tao/chuyen-de";
  const base = { slug: `${prefix}-vc`, title: "Chuyên đề kiểm thử", asOf: "2026-10-26" };
  expect((await request(path, token, { ...base, nhomHocTap: ["dang_vien"] })).status).toBe(403);
  expect((await request(path, admin, { ...base, nhomHocTap: ["sai"] })).status).toBe(400);
  const saved = await request(path, admin, { ...base, nhomHocTap: ["dang_vien", "dang_vien"] });
  expect(saved.status).toBe(200);
  expect(saved.body.chuyenDe.nhom_hoc_tap).toEqual(["dang_vien"]);
  expect(saved.body.chuyenDe.audience).toEqual(["Nhãn cũ cần giữ"]);
  const unchanged = await request(path, admin, base);
  expect(unchanged.body.chuyenDe.nhom_hoc_tap).toEqual(["dang_vien"]);
  const detail = await request(`/v1/quan-tri/dao-tao/chuyen-de/${base.slug}`, admin);
  expect(detail.body.chuyenDe.nhomHocTap).toEqual(["dang_vien"]);
  const cleared = await request(path, admin, { ...base, nhomHocTap: [] });
  expect(cleared.status).toBe(400);
  await sql`UPDATE courses SET status = 'bien_tap' WHERE slug = ${base.slug}`;
  const draft = await request(path, admin, { ...base, nhomHocTap: [] });
  expect(draft.status).toBe(200);
  expect(draft.body.chuyenDe.nhom_hoc_tap).toEqual([]);
});

test("mã công chức cũ tương thích; nhóm công an bị từ chối ở đọc và ghi", async () => {
  const old = await request("/v1/dao-tao/chuyen-de?nhom=cong_chuc_cap_xa", token);
  const current = await request("/v1/dao-tao/chuyen-de?nhom=cong_chuc", token);
  expect(old.status).toBe(200);
  expect(old.body).toEqual(current.body);
  expect((await request("/v1/dao-tao/chuyen-de?nhom=cong_an_cap_xa", token)).status).toBe(400);
  expect(
    (
      await request("/v1/quan-tri/dao-tao/chuyen-de", admin, {
        slug: `${prefix}-ngoai-pham-vi`,
        title: "Nội dung ngoài phạm vi",
        asOf: "2026-10-27",
        nhomHocTap: ["cong_an_cap_xa"],
      })
    ).status,
  ).toBe(400);
  const saved = await request("/v1/quan-tri/dao-tao/chuyen-de", admin, {
    slug: `${prefix}-tuong-thich`,
    title: "Tương thích mã nhóm cũ",
    asOf: "2026-10-27",
    nhomHocTap: ["cong_chuc_cap_xa", "cong_chuc", "dang_vien"],
  });
  expect(saved.status).toBe(200);
  expect(saved.body.chuyenDe.nhom_hoc_tap).toEqual(["cong_chuc", "dang_vien"]);
});

test("quản trị lọc chuyên đề chưa phân nhóm, người học không xem được", async () => {
  const course = await luuChuyenDe({
    slug: `${prefix}-can-ra-soat`,
    title: "Chuyên đề cần rà soát",
    asOf: "2026-10-27",
  });
  await sql`UPDATE courses SET status='xuat_ban' WHERE id=${course.id}`;
  expect((await request("/v1/quan-tri/dao-tao/chuyen-de?nhom=chua_phan_nhom", token)).status).toBe(403);
  const review = await request("/v1/quan-tri/dao-tao/chuyen-de?nhom=chua_phan_nhom", admin);
  expect(review.status).toBe(200);
  expect(review.body.items.some((c: any) => c.id === course.id)).toBe(true);
  expect(review.body.items.every((c: any) => c.nhomHocTap.length === 0)).toBe(true);
  expect((await request(`/v1/dao-tao/chuyen-de/${course.slug}`, token)).status).toBe(404);
});

test("khung ba nhóm là bản nháp và không xuất hiện trong danh mục người học", async () => {
  const slugs = [
    "cong-chuc-cong-vu-va-xu-ly-cong-viec",
    "vien-chuc-vi-tri-va-dao-duc-nghe-nghiep",
    "dang-vien-sinh-hoat-va-cong-tac-dang",
  ];
  const rows = await sql`SELECT slug,status,nhom_hoc_tap FROM courses WHERE slug=ANY(${slugs}::text[])`;
  expect(rows).toHaveLength(3);
  expect(rows.every((r) => r.status === "nhap" && r.nhom_hoc_tap.length === 1)).toBe(true);
  const publicList = await request("/v1/dao-tao/chuyen-de?nhom=tat_ca", token);
  expect(publicList.body.items.some((r: any) => slugs.includes(r.slug))).toBe(false);
});
