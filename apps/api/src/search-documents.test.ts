import { afterAll, beforeAll, expect, test } from "bun:test";
import { sql } from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();
const key = "kiemkephantrangdotba";
const prefix = "vn:vbqppl:nd:test-dotba-";
async function clean() {
  await sql`DELETE FROM documents WHERE urn LIKE ${`${prefix}%`}`;
}
async function get(p: Record<string, string | number | undefined> = {}) {
  const r = await app.request(
    "http://test/v1/search/documents?" +
      new URLSearchParams({
        q: key,
        family: "phap_luat",
        asOf: "2026-10-27",
        ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])),
      }),
  );
  return { status: r.status, body: (await r.json()) as any };
}
beforeAll(async () => {
  await clean();
  await sql`INSERT INTO documents(urn,doc_type,rank,is_normative,so_ky_hieu,title,short_title,issued_date,effective_from,issuer_name,fields,status,document_group,primary_source)
 SELECT ${prefix}||i,'nd',50,true,'DOTBA-'||i,'Văn bản kiểm thử '||i,'Văn bản '||i,'2020-01-01','2020-01-01',
 CASE WHEN i%2=0 THEN 'Cơ quan kiểm thử A' ELSE 'Cơ quan kiểm thử B' END,ARRAY['test-dotba'],'con_hieu_luc','phap_luat','https://example.invalid/nguon'
 FROM generate_series(1,125)i`;
  await sql`INSERT INTO document_versions(document_id,version_no,kind,valid_from,valid_to,status)
 SELECT id,1,'original','2020-01-01',CASE WHEN urn=${`${prefix}1`} THEN '2027-01-01'::date ELSE NULL END,'con_hieu_luc' FROM documents WHERE urn LIKE ${`${prefix}%`}`;
  await sql`INSERT INTO nodes(version_id,document_id,path,full_path,kind,label,text_md,text_plain,tsv,ordinal)
 SELECT v.id,d.id,'dieu-'||i,'dieu-'||i,'dieu','Điều '||i,${`${key} công vụ`},${`${key} công vụ`},to_tsvector('vietnamese',${`${key} công vụ`}),i
 FROM documents d JOIN document_versions v ON v.document_id=d.id CROSS JOIN generate_series(1,150)i
 WHERE d.urn LIKE ${`${prefix}%`} AND (d.urn=${`${prefix}1`} OR i=1)`;
  await sql`INSERT INTO document_versions(document_id,version_no,kind,valid_from,status) SELECT id,2,'consolidated_auto','2027-01-01','het_hieu_luc_mot_phan' FROM documents WHERE urn=${`${prefix}1`}`;
  await sql`INSERT INTO nodes(version_id,document_id,path,full_path,kind,label,text_plain,text_md,tsv)
 SELECT v.id,v.document_id,'dieu-1','dieu-1','dieu','Điều 1','Nội dung mới','Nội dung mới',to_tsvector('vietnamese','Nội dung mới') FROM document_versions v JOIN documents d ON d.id=v.document_id WHERE d.urn=${`${prefix}1`} AND v.version_no=2`;
  await sql`INSERT INTO documents(urn,doc_type,rank,is_normative,so_ky_hieu,title,short_title,status,document_group,effective_from)
 VALUES(${`${prefix}party`},'vb-dang',999,false,'VB-DANG-TEST',${key},${key},'khong_xac_dinh','dang','2030-01-01'),
 (${`${prefix}draft`},'nd',50,true,'NHAP-TEST',${key},${key},'con_hieu_luc','phap_luat','2020-01-01')`;
  await sql`UPDATE documents SET is_draft=true WHERE urn=${`${prefix}draft`}`;
  await sql`INSERT INTO document_versions(document_id,version_no,kind,valid_from,status) SELECT id,1,'original','2020-01-01','khong_xac_dinh' FROM documents WHERE urn=${`${prefix}party`}`;
  await sql`INSERT INTO nodes(version_id,document_id,path,full_path,kind,label,text_plain,text_md,tsv) SELECT v.id,v.document_id,'doan-1','doan-1','doan','Đoạn 1','doanvanbancongtacdang','doanvanbancongtacdang',to_tsvector('vietnamese','doanvanbancongtacdang') FROM document_versions v JOIN documents d ON d.id=v.document_id WHERE d.urn=${`${prefix}party`}`;
});
afterAll(clean);
test("đếm toàn bộ 125 văn bản kể cả khi một văn bản có 150 điều khớp", async () => {
  const r = await get({ limit: 20 });
  expect(r.status).toBe(200);
  expect(r.body.total).toBe(125);
  expect(r.body.pages).toBe(7);
  const all = [] as string[];
  for (let page = 1; page <= 7; page++) {
    const p = await get({ page, limit: 20 });
    expect(p.body.total).toBe(125);
    all.push(...p.body.items.map((d: any) => d.urn));
  }
  expect(new Set(all).size).toBe(125);
  expect(all.length).toBe(125);
  const exact = await get({ q: "DOTBA-1" });
  const d = exact.body.items.find((d: any) => d.urn === `${prefix}1`);
  expect(d).toBeDefined();
  const many = await get({ limit: 100 });
  const first =
    many.body.items.find((d: any) => d.urn === `${prefix}1`) ??
    (await get({ limit: 100, page: 2 })).body.items.find((d: any) => d.urn === `${prefix}1`);
  expect(first.matchCount).toBe(150);
  expect(first.matches).toHaveLength(3);
});
test("trang vượt cuối vẫn trả tổng thật và danh sách rỗng", async () => {
  const r = await get({ page: 100 });
  expect(r.body.total).toBe(125);
  expect(r.body.items).toEqual([]);
});
test("lọc cơ quan/lĩnh vực và giữ đối chiếu không dấu", async () => {
  const a = await get({ issuer: "Cơ quan kiểm thử A", field: "test-dotba" });
  expect(a.body.total).toBe(62);
  const b = await get({ q: "cong vu", field: "test-dotba" });
  expect(b.body.total).toBe(125);
  expect((await get({ issuer: "Cơ quan không có" })).body.total).toBe(0);
});
test("không tìm nội dung phiên bản cũ sau mốc thay đổi", async () => {
  const r = await get({ asOf: "2028-01-01" });
  expect(r.body.total).toBe(124);
  expect(r.body.items.every((d: any) => d.urn !== `${prefix}1`)).toBe(true);
  const s = await get({ q: "DOTBA-1", asOf: "2028-01-01", status: "het_hieu_luc_mot_phan" });
  expect(s.body.items[0].statusAsOf).toBe("het_hieu_luc_mot_phan");
});
test("văn bản Đảng dùng phân loại và trạng thái riêng; bản nháp không hiện", async () => {
  const r = await get({ family: "dang" });
  expect(r.body.total).toBe(1);
  expect(r.body.items[0].statusAsOf).toBe("khong_xac_dinh");
  const all = await get({ family: "", limit: 100 });
  expect(all.status).toBe(400);
  expect((await get()).body.total).toBe(125);
});
test("ngày không tồn tại và tham số phân trang không hợp lệ trả 400", async () => {
  for (const p of [
    { asOf: "2026-02-30" },
    { asOf: "2026-13-01" },
    { page: 0 },
    { limit: 101 },
    { status: "sai" },
    { family: "sai" },
  ])
    expect((await get(p)).status).toBe(400);
});

test("tìm Điều cụ thể không nhầm Điều 15 với Điều 150", async () => {
  const r = await get({ q: "Điều 150 DOTBA-1" });
  expect(r.status).toBe(200);
  expect(r.body.total).toBe(1);
  expect(r.body.items[0].matches[0].path).toBe("dieu-150");
  const d = await get({ q: "dieu 15 DOTBA-1" });
  expect(d.body.total).toBe(1);
  expect(d.body.items[0].matchCount).toBe(1);
  expect(d.body.items[0].matches[0].path).toBe("dieu-15");
});

test("hiệu lực hết hạn khớp giữa danh sách và chi tiết dù phiên bản đã đóng", async () => {
  const urn = `${prefix}125`;
  await sql`UPDATE documents SET effective_to='2025-01-01' WHERE urn=${urn}`;
  await sql`UPDATE document_versions SET valid_to='2025-01-01' WHERE document_id=(SELECT id FROM documents WHERE urn=${urn})`;
  try {
    const list = await get({ q: "DOTBA-125", status: "het_hieu_luc" });
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].statusAsOf).toBe("het_hieu_luc");
    const detail = await app.request(`http://test/v1/documents/${encodeURIComponent(urn)}?asOf=2026-10-27`);
    expect(((await detail.json()) as any).document.statusAsOf).toBe("het_hieu_luc");
  } finally {
    await sql`UPDATE documents SET effective_to=NULL WHERE urn=${urn}`;
    await sql`UPDATE document_versions SET valid_to=NULL WHERE document_id=(SELECT id FROM documents WHERE urn=${urn})`;
  }
});
test("văn bản chưa có phiên bản nội dung suy hiệu lực theo ngày, danh sách khớp chi tiết", async () => {
  await sql`INSERT INTO documents(urn,doc_type,rank,is_normative,so_ky_hieu,title,short_title,status,document_group,effective_from)
 VALUES(${`${prefix}chi-pdf`},'nd',50,true,'CHIPDF-TEST','Chỉ có tệp gốc','Chỉ có tệp gốc','con_hieu_luc','phap_luat','2025-07-01'),
 (${`${prefix}khong-ngay`},'nd',50,true,'KHONGNGAY-TEST','Không có ngày','Không có ngày','con_hieu_luc','phap_luat',NULL)`;
  for (const [soKyHieu, urn, mong] of [
    ["CHIPDF-TEST", `${prefix}chi-pdf`, "con_hieu_luc"],
    ["KHONGNGAY-TEST", `${prefix}khong-ngay`, "khong_xac_dinh"],
  ]) {
    const list = await app.request(`http://test/v1/documents?q=${soKyHieu}&asOf=2026-10-27`);
    expect(((await list.json()) as any).items[0].statusAsOf).toBe(mong);
    const detail = await app.request(`http://test/v1/documents/${encodeURIComponent(urn!)}?asOf=2026-10-27`);
    expect(((await detail.json()) as any).document.statusAsOf).toBe(mong);
  }
  const truoc = await app.request(`http://test/v1/documents?q=CHIPDF-TEST&asOf=2025-06-30`);
  expect(((await truoc.json()) as any).items[0].statusAsOf).toBe("chua_hieu_luc");
});
test("không mở văn bản nháp bằng URN công khai; ký tự % không mở rộng truy vấn", async () => {
  const r = await app.request(`http://test/v1/documents/${encodeURIComponent(`${prefix}draft`)}`);
  expect(r.status).toBe(404);
  expect((await get({ q: "%" })).body.total).toBe(0);
});

test("tra toàn văn đoạn văn bản Đảng không có cấu trúc Điều, Khoản", async () => {
  const r = await get({ q: "doanvanbancongtacdang", family: "dang" });
  expect(r.status).toBe(200);
  expect(r.body.total).toBe(1);
  expect(r.body.items[0].matches[0].path).toBe("doan-1");
});
