/** Kiểm chứng nhanh: cùng một văn bản, hai thời điểm khác nhau phải cho nội dung khác nhau. */
import { getDocumentByUrn, getVersionAsOf, sql } from "@qdpl/db";
import { buildUrn } from "@qdpl/legal-model";

const urn = buildUrn({ docType: "nd", soKyHieu: "100/2026/NĐ-CP" });
const doc = await getDocumentByUrn(urn);
if (!doc) throw new Error("Chưa nạp dữ liệu mẫu. Chạy: bun run packages/db/src/seed.ts");

for (const asOf of ["2026-06-01", "2027-08-01"]) {
  const v: any = await getVersionAsOf(doc.id, asOf);
  const [n] = await sql`SELECT count(*)::int AS c FROM nodes WHERE version_id = ${v.id} AND kind = 'dieu'`;
  const [k1] =
    await sql`SELECT text_md, node_status FROM nodes WHERE version_id = ${v.id} AND path = 'dieu-3.khoan-1'`;
  const [dc] =
    await sql`SELECT node_status FROM nodes WHERE version_id = ${v.id} AND path = 'dieu-1.khoan-2.diem-c'`;
  console.log(`\n=== Tại ngày ${asOf} — phiên bản ${v.version_no} (${v.kind}) ===`);
  console.log(`Số điều: ${(n as any).c}`);
  console.log(`khoản 1 Điều 3: ${(k1 as any)?.text_md?.slice(0, 90)}…`);
  console.log(`điểm c khoản 2 Điều 1: trạng thái = ${(dc as any)?.node_status}`);
}
await sql.end();
