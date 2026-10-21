/**
 * Tiện ích cho kiểm thử: bảo đảm Postgres đã có dữ liệu mẫu và đã index embedding.
 * KHÔNG import từ index.ts của package để tránh vòng phụ thuộc khi dùng ở apps/api.
 *
 * Nguyên tắc: test dùng LẠI dữ liệu mẫu do `packages/db/src/seed.ts` nạp
 * (vn:vbqppl:nd:100/2026/NĐ-CP và vn:vbqppl:nd:150/2027/NĐ-CP) và không xóa nó.
 * Dữ liệu riêng của test phải dùng tiền tố URN riêng rồi tự dọn.
 */
import { databaseUrl, sql } from "@qdpl/db";
import { embeddingModel } from "./embedding.ts";
import { indexVersion } from "./index.ts";

/** Văn bản mẫu gốc (Nghị định 100/2026/NĐ-CP). */
export const URN_GOC = "vn:vbqppl:nd:100/2026/NĐ-CP";
/** Văn bản sửa đổi mẫu (Nghị định 150/2027/NĐ-CP). */
export const URN_SUA = "vn:vbqppl:nd:150/2027/NĐ-CP";
/** Ngày trước khi văn bản sửa đổi có hiệu lực. */
export const AS_OF_TRUOC = "2026-06-01";
/** Ngày sau khi văn bản sửa đổi có hiệu lực. */
export const AS_OF_SAU = "2027-08-01";

/** Tiền tố dành riêng cho dữ liệu do test tạo ra, để dọn dẹp an toàn. */
export const TEST_PREFIX = "test-qdpl";

let seeded = false;

/**
 * Kiểm tra dữ liệu mẫu có ĐÚNG HÌNH DẠNG mà test dựa vào hay không:
 * hai văn bản mẫu tồn tại, và phiên bản gốc của 100/2026 đã được đóng khoảng hiệu lực
 * tại 2027-07-01 (nếu không thì hai phiên bản cùng "có hiệu lực" ở 2027-08-01 và mọi
 * khẳng định về asOf đều sai). CSDL dev dùng chung nhiều nhánh nên phải kiểm, không đoán.
 */
async function seedIsHealthy(): Promise<boolean> {
  const [row] = await sql<Array<{ docs: string; closed: string }>>`
    SELECT (SELECT count(*)::text FROM documents WHERE urn IN (${URN_GOC}, ${URN_SUA})) AS docs,
           (SELECT count(*)::text FROM document_versions v
              JOIN documents d ON d.id = v.document_id
             WHERE d.urn = ${URN_GOC} AND v.kind = 'original'
               AND v.valid_to = ${CHANGE_DATE}::date) AS closed`;
  return Number(row?.docs ?? 0) >= 2 && Number(row?.closed ?? 0) >= 1;
}

/** Ngày văn bản sửa đổi bắt đầu có hiệu lực (mốc chia hai phiên bản của 100/2026). */
export const CHANGE_DATE = "2027-07-01";

/** Chạy `packages/db/src/seed.ts` nếu Postgres chưa có (hoặc đã hỏng) dữ liệu mẫu. */
export async function ensureSeed(): Promise<void> {
  if (seeded) return;
  if (!(await seedIsHealthy())) {
    // Phải truyền ĐÚNG CSDL đang kết nối: dưới `bun test`, @qdpl/db tự chuyển sang
    // CSDL `*_test`, trong khi process.env.DATABASE_URL vẫn trỏ CSDL phát triển.
    const proc = Bun.spawnSync(["bun", "run", "packages/db/src/seed.ts"], {
      cwd: new URL("../../..", import.meta.url).pathname,
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    if (proc.exitCode !== 0) {
      throw new Error(
        `Nạp dữ liệu mẫu thất bại (mã ${proc.exitCode}): ${new TextDecoder().decode(proc.stderr)}`,
      );
    }
    if (!(await seedIsHealthy())) {
      throw new Error(
        "Đã chạy seed nhưng dữ liệu mẫu vẫn sai hình dạng (kiểm tra valid_to của phiên bản gốc)",
      );
    }
  }
  seeded = true;
}

let indexed = false;

/** Sinh embedding cho mọi phiên bản của hai văn bản mẫu (idempotent). */
export async function ensureIndexed(): Promise<number> {
  await ensureSeed();
  if (indexed) return 0;
  const versions = await sql<Array<{ id: string }>>`
    SELECT v.id FROM document_versions v
    JOIN documents d ON d.id = v.document_id
    WHERE d.urn IN (${URN_GOC}, ${URN_SUA})
    ORDER BY d.urn, v.version_no`;
  let chunks = 0;
  for (const v of versions) chunks += (await indexVersion(v.id)).chunks;
  indexed = true;
  return chunks;
}

/** Số embedding hiện có của model đang dùng, cho hai văn bản mẫu. */
export async function countEmbeddings(): Promise<number> {
  const [row] = await sql<Array<{ n: string }>>`
    SELECT count(*)::text AS n FROM embeddings e
    JOIN documents d ON d.id = e.document_id
    WHERE d.urn IN (${URN_GOC}, ${URN_SUA}) AND e.model = ${embeddingModel()}`;
  return Number(row?.n ?? 0);
}

/** Xóa mọi hàng do test tạo ra (nhận diện bằng TEST_PREFIX). Không đụng dữ liệu mẫu. */
export async function cleanupTestRows(): Promise<void> {
  await sql`DELETE FROM review_queue WHERE ref_id LIKE ${`${TEST_PREFIX}%`}`;
  await sql`DELETE FROM amendment_ops WHERE amending_doc_urn LIKE ${`%${TEST_PREFIX}%`}`;
  await sql`DELETE FROM ask_logs WHERE question LIKE ${`%${TEST_PREFIX}%`}`;
  await sql`DELETE FROM jobs WHERE payload::text LIKE ${`%${TEST_PREFIX}%`}`;
}
