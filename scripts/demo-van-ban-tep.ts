/**
 * Nạp văn bản từ tệp Markdown trong docs/demo/van-ban vào CSDL demo (docs/DEMO.md mục 5).
 *
 * Dùng cho văn bản mà kho thật chưa có: người dùng tải bản chính thức (Công báo, Cổng TTĐT Chính
 * phủ), chuyển sang Markdown và soát lại theo bản gốc, rồi đặt vào thư mục này. Thuộc tính đọc từ
 * frontmatter của tệp, không đoán:
 *
 *   so_hieu: 89/2026/NĐ-CP                 (bắt buộc)
 *   loai_van_ban: Nghị định                (bắt buộc)
 *   ten: Nghị định quy định về …           (bắt buộc)
 *   co_quan_ban_hanh: Chính phủ
 *   ngay_ban_hanh | ngay_thong_qua: 2026-03-30
 *   ngay_hieu_luc: 2026-07-01 (ghi chú sau ngày được bỏ qua)
 *   nguoi_ky: Trần Hồng Hà (chức danh trong ngoặc được bỏ qua)
 *
 * Văn bản đã có trong CSDL demo (chép từ kho thật hoặc nạp lần trước) thì bỏ qua, không ghi đè.
 * Chạy sau bước chép từ kho thật và trước bước dựng chỉ mục tìm kiếm.
 *
 * Chạy: bun run scripts/demo-van-ban-tep.ts (qua `bun run demo`, hoặc đặt DATABASE_URL trỏ vào
 * quydinhphapluat_demo).
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { sql } from "../packages/db/src/client.ts";
import { normalizeSoKyHieu } from "../packages/legal-model/src/urn.ts";

const THU_MUC = "docs/demo/van-ban";

const url = process.env.DATABASE_URL ?? "";
const laDemo = /@(127\.0\.0\.1|localhost)(:\d+)?\/[^/?]*_demo(\?|$)/.test(url);
if (!laDemo) {
  console.error("Dừng: script này chỉ chạy trên CSDL demo trên máy (tên CSDL kết thúc bằng _demo).");
  console.error("Chạy qua `bun run demo`, hoặc đặt DATABASE_URL trỏ vào quydinhphapluat_demo.");
  process.exit(1);
}

/** Frontmatter dạng `khoa: gia tri` mỗi dòng, giữa hai dòng `---` ở đầu tệp. */
function docFrontmatter(md: string): Record<string, string> {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const dong of m[1]!.split(/\r?\n/)) {
    const i = dong.indexOf(":");
    if (i > 0) out[dong.slice(0, i).trim()] = dong.slice(i + 1).trim();
  }
  return out;
}

/** "2026-07-01 (riêng …)" -> "01/07/2026", dạng ngày mà lệnh ingest-file nhận. */
function ngay(raw: string | undefined): string | undefined {
  const m = raw ? /(\d{4})-(\d{2})-(\d{2})/.exec(raw) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : undefined;
}

const tep = readdirSync(THU_MUC)
  .filter((f) => f.toLowerCase().endsWith(".md"))
  .sort();
let daNap = 0;
for (const f of tep) {
  const duongDan = join(THU_MUC, f);
  const fm = docFrontmatter(await Bun.file(duongDan).text());
  const thieu = ["so_hieu", "loai_van_ban", "ten"].filter((k) => !fm[k]);
  if (thieu.length) {
    console.warn(`! bỏ qua ${f}: frontmatter thiếu ${thieu.join(", ")}`);
    continue;
  }
  const soKyHieu = normalizeSoKyHieu(fm.so_hieu!);
  const [co] = await sql`SELECT urn FROM documents WHERE so_ky_hieu = ${soKyHieu} LIMIT 1`;
  if (co) {
    console.log(`= ${soKyHieu}: đã có (${co.urn}), bỏ qua`);
    continue;
  }

  const thamSo = [
    "ingest-file",
    duongDan,
    "--so-ky-hieu",
    soKyHieu,
    "--type-name",
    fm.loai_van_ban!,
    "--title",
    fm.ten!,
  ];
  // "Quốc hội khóa XV" -> "Quốc hội": cơ quan ban hành ghi theo tên cơ quan, không kèm khóa.
  const coQuan = fm.co_quan_ban_hanh?.replace(/\s+khóa\s+[IVXLC]+$/i, "").trim();
  if (coQuan) thamSo.push("--issuer", coQuan);
  const nguoiKy = fm.nguoi_ky?.replace(/\s*\(.*\)\s*$/, "").trim();
  if (nguoiKy) thamSo.push("--signer", nguoiKy);
  const banHanh = ngay(fm.ngay_ban_hanh ?? fm.ngay_thong_qua);
  if (banHanh) thamSo.push("--issued-date", banHanh);
  const hieuLuc = ngay(fm.ngay_hieu_luc);
  if (hieuLuc) thamSo.push("--effective-from", hieuLuc);

  const p = Bun.spawnSync(["bun", "run", "apps/workers-ts/src/cli.ts", ...thamSo], {
    env: process.env,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (p.exitCode !== 0) {
    console.error(`! ${soKyHieu}: nạp lỗi\n${p.stderr.toString().slice(-2000)}`);
    process.exitCode = 1;
    continue;
  }
  // stdout gồm các dòng log JSON một dòng, rồi kết quả in thụt lề bắt đầu bằng dòng "{" đứng riêng.
  const out = p.stdout.toString();
  const kq = JSON.parse(out.slice(out.search(/^\{\r?\n/m)));
  console.log(`+ ${soKyHieu}: ${kq.parse?.nodes ?? "?"} nút, ${kq.parse?.counts?.dieu ?? 0} điều`);
  daNap += 1;
}
console.log(`Nạp ${daNap}/${tep.length} tệp từ ${THU_MUC}.`);
await sql.end();
