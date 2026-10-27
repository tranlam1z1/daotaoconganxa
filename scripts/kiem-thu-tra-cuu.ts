/** Bộ kiểm thử tra cứu trên CSDL cục bộ riêng, không làm sạch hoặc sửa kho đang xem thử. */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const target = new URL(process.env.DATABASE_URL_TEST ?? "");
if (!["127.0.0.1", "localhost"].includes(target.hostname))
  throw new Error("DATABASE_URL_TEST phải trỏ tới PostgreSQL kiểm thử cục bộ.");
target.pathname = "/quydinhphapluat_dot3_test";
const files = [
  "apps/web/tests",
  "apps/api/src/search-documents.test.ts",
  "apps/api/src/documents.test.ts",
  "apps/api/src/quan-tri-van-ban.test.ts",
  "apps/api/src/bieu-mau.test.ts",
  "apps/api/src/du-lieu-tra-cuu.test.ts",
  "apps/api/src/tra-cuu-nhanh.test.ts",
  "packages/legal-model",
  "packages/dao-tao/tests/tra-cuu-nhanh.test.ts",
  "packages/db/src/ba-nhom-migration.test.ts",
];
const result = spawnSync("bun", ["test", ...files], {
  cwd: root,
  env: { ...process.env, DATABASE_URL_TEST: target.href },
  encoding: "utf8",
  maxBuffer: 12 * 1024 * 1024,
});
const output = result.stdout + result.stderr;
mkdirSync(resolve(root, "outputs"), { recursive: true });
writeFileSync(resolve(root, "outputs/dot-3-tests.log"), output);
console.log(output.split("\n").slice(-25).join("\n"));
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
