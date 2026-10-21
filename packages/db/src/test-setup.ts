/**
 * Chuẩn bị CSDL test trước khi chạy bất kỳ file test nào.
 * Được nạp qua `preload` trong bunfig.toml nên chạy đúng một lần cho cả phiên test.
 *
 * Việc làm: tạo CSDL test nếu chưa có -> áp dụng migration -> nạp dữ liệu mẫu.
 * Nhờ vậy test không bao giờ ghi vào CSDL phát triển.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import postgres from "postgres";

const ROOT = join(import.meta.dir, "..", "..", "..");
// Ưu tiên DATABASE_URL_TEST (xem dưới): DATABASE_URL trỏ ra Postgres của DigitalOcean,
// nơi user qdpl không tạo được CSDL <tên>_test. Test luôn chạy trên Postgres cục bộ.
const base = process.env.DATABASE_URL ?? "postgres://qdpl:qdpl_dev@127.0.0.1:5436/quydinhphapluat";
const testUrl = (() => {
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST;
  const u = new URL(base);
  const name = u.pathname.replace(/^\//, "").replace(/\/$/, "");
  u.pathname = name.endsWith("_test") ? `/${name}` : `/${name}_test`;
  return u.toString();
})();

const dbName = new URL(testUrl).pathname.slice(1);

async function ensureDatabase(): Promise<boolean> {
  const admin = new URL(testUrl);
  admin.pathname = "/postgres";
  const sql = postgres(admin.toString(), { max: 1, onnotice: () => {} });
  try {
    const rows = await sql`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
    if (!rows.length) {
      await sql.unsafe(`CREATE DATABASE "${dbName}"`);
      console.log(`[test-setup] đã tạo CSDL ${dbName}`);
    }
    // CSDL thật đi qua PgBouncer nên không dùng prepared statement (client.ts): mỗi lần chạy
    // Postgres lập kế hoạch theo tham số thật. Ép CSDL test làm như vậy. Nếu không, một câu
    // truy vấn chạy quá 5 lần với dữ liệu nhỏ ở test này sẽ để lại kế hoạch chung trên kết nối,
    // và test hiệu năng chạy sau với 1.000 cán bộ dùng lại kế hoạch đó, chậm gấp chục lần.
    await sql
      .unsafe(`ALTER DATABASE "${dbName}" SET plan_cache_mode = force_custom_plan`)
      .catch((e) => console.warn(`[test-setup] không đặt được plan_cache_mode: ${e?.message ?? e}`));
    return true;
  } catch (e) {
    console.warn(`[test-setup] không kết nối được Postgres: ${e instanceof Error ? e.message : e}`);
    console.warn(
      "[test-setup] các test cần CSDL sẽ hỏng. Chạy: docker compose -f infra/docker-compose.yml up -d postgres",
    );
    return false;
  } finally {
    await sql.end({ timeout: 2 });
  }
}

function run(script: string) {
  const r = spawnSync("bun", ["run", script], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: "production", DATABASE_URL: testUrl },
    stdio: "pipe",
    encoding: "utf8",
  });
  if (r.status !== 0) {
    console.error(`[test-setup] ${script} lỗi:\n${r.stdout}\n${r.stderr}`);
    throw new Error(`[test-setup] không chuẩn bị được CSDL test (${script})`);
  }
}

if (await ensureDatabase()) {
  run("packages/db/src/migrate.ts");
  run("packages/db/src/seed.ts");
  // Quan trọng: đặt lại DATABASE_URL cho cả tiến trình test.
  // Không có dòng này thì mọi tiến trình con do test spawn (ví dụ helper tự chạy lại seed)
  // vẫn kế thừa DATABASE_URL trỏ CSDL phát triển và ghi nhầm vào đó.
  process.env.DATABASE_URL = testUrl;
  process.env.DATABASE_URL_TEST = testUrl;
  console.log(`[test-setup] CSDL test sẵn sàng: ${dbName}`);
}
