/** Áp dụng migration theo thứ tự tên file; ghi nhận vào bảng schema_migrations. */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";
import { databaseUrl } from "./client.ts";

const dir = join(import.meta.dir, "..", "migrations");

/**
 * Migration chạy THẲNG vào Postgres, không qua PgBouncer.
 * PgBouncer chế độ transaction không giữ trạng thái phiên giữa các câu lệnh, nên DDL nhiều
 * lệnh trong một file có thể hỏng khó lường. Luôn dùng pool riêng một kết nối, kể cả khi
 * không đặt DATABASE_URL_DIRECT, để các migration có BEGIN/COMMIT chạy được trong CI.
 */
/**
 * Chỉ dùng kết nối trực tiếp khi nó trỏ đúng CSDL mà DATABASE_URL đang trỏ. Không có điều
 * kiện này thì `test-setup.ts` — vốn đặt DATABASE_URL sang CSDL test rồi gọi migrate — vẫn
 * bị đẩy sang CSDL phát triển, và CSDL test không bao giờ có migration mới.
 */
function directUrl(): string | undefined {
  const direct = process.env.DATABASE_URL_DIRECT;
  if (!direct) return undefined;
  const main = process.env.DATABASE_URL;
  if (!main) return direct;
  try {
    const a = new URL(direct);
    const b = new URL(main);
    return a.pathname === b.pathname && a.hostname === b.hostname ? direct : undefined;
  } catch {
    return undefined;
  }
}

const direct = directUrl();
const sql = postgres(direct ?? databaseUrl, { max: 1, prepare: false, onnotice: () => {} });

await sql`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
const applied = new Set((await sql`SELECT name FROM schema_migrations`).map((r: any) => r.name as string));

const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
let count = 0;
for (const f of files) {
  if (applied.has(f)) continue;
  const text = await readFile(join(dir, f), "utf8");
  process.stdout.write(`áp dụng ${f} ... `);
  await sql.unsafe(text);
  await sql`INSERT INTO schema_migrations (name) VALUES (${f})`;
  console.log("xong");
  count++;
}
console.log(count ? `Đã áp dụng ${count} migration.` : "Không có migration mới.");
await sql.end();
