/**
 * Soi một tệp Markdown số hóa bằng parser của packages/legal-model: in ra cây điều/khoản/điểm,
 * số bảng, công thức, khối chữ ký và căn cứ. Dùng khi cần xem tại sao một bản số hóa bị
 * kiểm chứng đánh trượt.
 *
 *   bun run scripts/verify-docproc.ts data/out/<documentId>/document.md
 *
 * Mặc định đọc data/fixtures/docproc-output.md — mẫu chuẩn của hợp đồng số hóa (ke-hoach/05).
 */
import { nodeKey, parseDocument, serializeDocument, walk } from "@qdpl/legal-model";

const file = process.argv[2] ?? "data/fixtures/docproc-output.md";
const md = await Bun.file(file).text();
const r = parseDocument(md);

const dieu: string[] = [];
const khoanTheoDieu: Record<string, string[]> = {};
const diemTheoKhoan: Record<string, string[]> = {};
let bang = 0;
let congThuc = 0;
let chuKy = 0;
let canCu = 0;

walk(r.root, (n) => {
  if (n.kind === "dieu") {
    dieu.push(nodeKey(n));
    khoanTheoDieu[n.path] = n.children.filter((c) => c.kind === "khoan").map(nodeKey);
  }
  if (n.kind === "khoan") {
    const diem = n.children.filter((c) => c.kind === "diem").map(nodeKey);
    if (diem.length) diemTheoKhoan[n.path] = diem;
  }
  if (n.kind === "bang") bang++;
  if (n.kind === "cong_thuc") congThuc++;
  if (n.kind === "chu_ky") chuKy++;
  if (n.kind === "can_cu") canCu++;
});

console.log(`Tệp: ${file}`);
console.log(`Điều: ${dieu.join(", ")}`);
for (const [p, ks] of Object.entries(khoanTheoDieu))
  console.log(`  ${p}: khoản ${ks.join(", ") || "(không)"}`);
for (const [p, ds] of Object.entries(diemTheoKhoan)) console.log(`  ${p}: điểm ${ds.join(", ")}`);
console.log(`Bảng: ${bang} | Công thức: ${congThuc} | Khối chữ ký: ${chuKy} | Khối căn cứ: ${canCu}`);
console.log(
  `Cảnh báo parser: ${r.warnings.length ? r.warnings.map((w) => w.message).join("; ") : "không có"}`,
);

// Kiểm tra bảng bị cắt qua trang có được ghép thành một bảng liền không.
let bangLon: any;
walk(r.root, (n) => {
  if (n.kind === "bang" && (!bangLon || n.text.length > bangLon.text.length)) bangLon = n;
});
if (bangLon) {
  const rows = bangLon.text.split("\n").filter((l: string) => l.trim().startsWith("|"));
  console.log(`Bảng lớn nhất: ${rows.length} dòng (gồm tiêu đề và dòng phân cách)`);
  const lapTieuDe = rows.filter((l: string) => l.includes("STT") && l.includes("Hạng mục")).length;
  console.log(
    `  số lần lặp hàng tiêu đề: ${lapTieuDe} ${lapTieuDe === 1 ? "(đúng, đã bỏ header lặp khi ghép trang)" : "(SAI: header bị lặp)"}`,
  );
}

// Kiểm tra không còn rác trang.
const rac = ["CÔNG BÁO/Số", "CÔNG BÁO / Số"].filter((x) => md.includes(x));
console.log(`Rác header còn sót: ${rac.length ? rac.join(", ") : "không"}`);

// Khứ hồi: parse -> serialize -> parse phải giữ nguyên cấu trúc.
const lai = parseDocument(serializeDocument(r.root));
const p1: string[] = [];
const p2: string[] = [];
walk(r.root, (n) => {
  if (["dieu", "khoan", "diem"].includes(n.kind)) p1.push(n.path);
});
walk(lai.root, (n) => {
  if (["dieu", "khoan", "diem"].includes(n.kind)) p2.push(n.path);
});
const khop = p1.length === p2.length && p1.every((x, i) => x === p2[i]);
console.log(`Khứ hồi parse/serialize: ${khop ? "khớp" : `LỆCH (${p1.length} so với ${p2.length})`}`);
if (!khop) {
  const thieu = p1.filter((x) => !p2.includes(x));
  const thua = p2.filter((x) => !p1.includes(x));
  if (thieu.length) console.log(`  mất: ${thieu.slice(0, 10).join(", ")}`);
  if (thua.length) console.log(`  thừa: ${thua.slice(0, 10).join(", ")}`);
}
