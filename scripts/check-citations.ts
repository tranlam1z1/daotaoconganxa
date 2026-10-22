/**
 * Rà soát sức khỏe viện dẫn của toàn bộ nội dung biên tập.
 * Chạy sau mỗi lần hợp nhất, hoặc theo lịch hằng ngày.
 *
 * Dùng: bun run scripts/check-citations.ts [--as-of YYYY-MM-DD] [--enqueue]
 */
import {
  canCuLuatGiayToDaDuyet,
  canCuTaiTrongDaDuyet,
  canCuTraCuuDaDuyet,
  checkCitations,
  kiemTraCanCuTraCuu,
  sql,
} from "@qdpl/db";

const args = process.argv.slice(2);
const asOfIdx = args.indexOf("--as-of");
const asOf = asOfIdx >= 0 ? args[asOfIdx + 1] : undefined;
const enqueue = args.includes("--enqueue");

const r = await checkCitations({ asOf, enqueueReview: enqueue });

console.log(`Đã kiểm tra ${r.total} viện dẫn tại ngày ${asOf ?? "hôm nay"}`);
console.log(`  còn đúng: ${r.ok}`);
console.log(`  đã thay đổi: ${r.changed}`);
console.log(`  đã bị bãi bỏ: ${r.repealed}`);
console.log(`  không tìm thấy: ${r.missing}`);
if (r.issues.length) {
  console.log("\nCần rà soát:");
  for (const i of r.issues) {
    console.log(`  [${i.health}] ${i.ownerKind} ${i.ownerId}`);
    console.log(`          ${i.nodeUrn}`);
    console.log(`          ${i.detail}`);
  }
  if (enqueue) console.log(`\nĐã tạo việc trong hàng đợi biên tập.`);
}

// Dữ liệu tra cứu nhanh đã duyệt (docs/PLAN.md GĐ5): căn cứ phải còn tồn tại và còn áp dụng.
// Luật giấy tờ đã duyệt (GĐ-T1), luật kiểm hồ sơ phạt nguội (GĐ-T11) và luật vận tải hành khách (GĐ-T13,
// cùng bảng document_rules) cũng là dữ liệu tra cứu có căn cứ; giới hạn tải trọng đã duyệt (GĐ-T12) cũng vậy.
const urnTraCuu = [
  ...new Set([
    ...(await canCuTraCuuDaDuyet()),
    ...(await canCuLuatGiayToDaDuyet()),
    ...(await canCuTaiTrongDaDuyet()),
  ]),
];
const hongTraCuu = await kiemTraCanCuTraCuu(urnTraCuu, asOf ?? new Date().toISOString().slice(0, 10));
console.log(`\nTra cứu nhanh: ${urnTraCuu.length} căn cứ đã duyệt, ${hongTraCuu.length} hỏng`);
for (const h of hongTraCuu) console.log(`  ${h.urn}\n          ${h.lyDo}`);


await sql.end();
process.exit(r.repealed || r.missing || hongTraCuu.length ? 1 : 0);
