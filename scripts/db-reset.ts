/**
 * Đưa CSDL phát triển về trạng thái sạch: xóa dữ liệu nghiệp vụ, giữ lược đồ,
 * rồi nạp lại dữ liệu mẫu và khung cấu trúc kho.
 *
 *   bun run scripts/db-reset.ts            # hỏi xác nhận
 *   bun run scripts/db-reset.ts --yes      # không hỏi
 *
 * KHÔNG chạy trên CSDL sản xuất: script từ chối nếu NODE_ENV=production.
 */
import { loadCorpusFramework, sql } from "@qdpl/db";

if (process.env.NODE_ENV === "production") {
  console.error("Từ chối: không xóa dữ liệu trên môi trường production.");
  process.exit(1);
}

const dbName = new URL(process.env.DATABASE_URL ?? "postgres://x/y").pathname.slice(1);
const auto = process.argv.includes("--yes") || process.argv.includes("-y");

const [before] = (await sql`SELECT count(*)::int AS c FROM documents`) as any[];
console.log(`CSDL: ${dbName} — hiện có ${before.c} văn bản.`);

if (!auto) {
  console.log("Thao tác này XÓA toàn bộ văn bản, phiên bản, nút, lệnh sửa đổi, hàng đợi và nhật ký.");
  process.stdout.write("Gõ 'xoa' để xác nhận: ");
  const answer = (await new Response(Bun.stdin.stream()).text()).trim();
  if (answer !== "xoa") {
    console.log("Đã hủy.");
    process.exit(0);
  }
}

await sql`TRUNCATE documents, amendment_ops, relations, taxonomy, agencies, jobs, review_queue,
          ask_logs, citations, source_records, pipeline_runs, audit_log,
          ingest_runs, ingest_items, corpus_coverage RESTART IDENTITY CASCADE`;
console.log("Đã xóa dữ liệu nghiệp vụ.");

const n = await loadCorpusFramework();
console.log(`Đã nạp lại khung cấu trúc: ${n} ô.`);
console.log("Chạy tiếp: bun run db:seed để nạp dữ liệu mẫu.");
await sql.end();
