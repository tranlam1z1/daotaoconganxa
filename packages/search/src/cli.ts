/**
 * Sinh embedding cho các phiên bản văn bản trong CSDL.
 *
 * Chạy:
 *   bun run packages/search/src/cli.ts                 # toàn bộ văn bản
 *   bun run packages/search/src/cli.ts <urn|versionId> # một văn bản hoặc một phiên bản
 *
 * Cần chạy lại sau khi nạp/hợp nhất văn bản mới, vì tầng vector chỉ tìm được nút đã có
 * embedding. Thao tác idempotent: chạy lại ghi đè embedding cũ của cùng model.
 */
import { sql } from "@qdpl/db";
import { EMBEDDING_DIM, embeddingMode, embeddingModel } from "./embedding.ts";
import { indexVersion } from "./index.ts";

const arg = process.argv[2];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function versionIds(): Promise<string[]> {
  if (arg && UUID_RE.test(arg)) {
    const rows = await sql<Array<{ id: string }>>`SELECT id FROM document_versions WHERE id = ${arg}::uuid`;
    if (!rows.length) throw new Error(`Không tìm thấy phiên bản ${arg}`);
    return rows.map((r) => r.id);
  }
  if (arg) {
    const rows = await sql<Array<{ id: string }>>`
      SELECT v.id FROM document_versions v
      JOIN documents d ON d.id = v.document_id
      WHERE d.urn = ${arg}
      ORDER BY v.version_no`;
    if (!rows.length) throw new Error(`Không tìm thấy văn bản có URN ${arg}`);
    return rows.map((r) => r.id);
  }
  const rows = await sql<Array<{ id: string }>>`
    SELECT v.id FROM document_versions v
    JOIN documents d ON d.id = v.document_id
    ORDER BY d.urn, v.version_no`;
  return rows.map((r) => r.id);
}

const ids = await versionIds();
console.log(
  `Index ${ids.length} phiên bản bằng model ${embeddingModel()} (chế độ ${embeddingMode()}, ${EMBEDDING_DIM} chiều)`,
);

let chunks = 0;
let nodes = 0;
const t0 = performance.now();
for (const id of ids) {
  const r = await indexVersion(id);
  chunks += r.chunks;
  nodes += r.nodes;
}
console.log(`Xong: ${chunks} chunk từ ${nodes} nút, ${Math.round(performance.now() - t0)} ms`);

await sql.end({ timeout: 5 });
