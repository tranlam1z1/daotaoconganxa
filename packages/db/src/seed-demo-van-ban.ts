/**
 * Chép văn bản pháp luật từ kho thật sang CSDL demo (docs/DEMO.md).
 *
 * Nội dung pháp luật không được viết tay: script này chép NGUYÊN VĂN văn bản, phiên bản, cây
 * điều khoản, quan hệ và lệnh sửa đổi từ kho thật (`DEMO_NGUON_DATABASE_URL`, chỉ đọc) sang CSDL
 * demo (`DATABASE_URL`). Danh sách văn bản gồm các văn bản bài giảng giao thông khai báo (`VB`
 * trong seed-dao-tao-gtdb.ts), QCVN 41:2024/BGTVT về biển báo, và mọi văn bản mà nội dung trong
 * CSDL demo đang trích: câu hỏi, bài giảng, hoạt động, nội dung trò chơi, dữ liệu tra cứu nhanh.
 * Vì đọc căn cứ từ CSDL demo, `bun run demo` chạy bước này SAU khi đã gieo các nội dung đó.
 *
 * An toàn:
 *  - Mọi truy vấn vào kho thật chạy trong giao dịch READ ONLY: không ghi được gì lên kho thật.
 *  - Chỉ ghi vào CSDL nằm trên máy (127.0.0.1, localhost): chặn việc lỡ tay đặt DATABASE_URL
 *    trỏ vào máy chủ thật.
 *  - Chạy lại được: bản ghi giữ nguyên id của kho thật, trùng thì bỏ qua (ON CONFLICT DO NOTHING).
 *
 * Không đặt DEMO_NGUON_DATABASE_URL thì script chỉ báo và thoát bình thường: demo vẫn chạy với
 * hai văn bản mẫu của seed.ts.
 *
 * Chạy: bun run packages/db/src/seed-demo-van-ban.ts
 */
import postgres from "postgres";
import { sql } from "./client.ts";
import { VB } from "./seed-dao-tao-gtdb.ts";

const LO = 500;

/**
 * Văn bản cần chép. DEMO_VAN_BAN (các URN phân tách bằng dấu phẩy) thay danh sách mặc định khi cần.
 * Căn cứ trỏ tới điều khoản (`urn#dieu-5`) hay thời điểm (`urn@2026-01-01`) quy về URN văn bản;
 * căn cứ giữ chỗ như `vn:chua-co-trong-kho` bị bỏ qua.
 */
async function danhSachVanBan(): Promise<string[]> {
  if (process.env.DEMO_VAN_BAN?.trim()) {
    return process.env.DEMO_VAN_BAN.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const trich = await sql<Array<{ urn: string }>>`
    WITH cc AS (
      SELECT unnest(citations) AS u FROM questions
      UNION ALL SELECT unnest(citations) FROM game_content
      UNION ALL SELECT unnest(citations) FROM lesson_blocks
      UNION ALL SELECT unnest(citations) FROM activities
      UNION ALL SELECT node_urn FROM citations
      UNION ALL SELECT citation_urn FROM violations
      UNION ALL SELECT citation_urn FROM traffic_signs
      UNION ALL SELECT citation_urn FROM speed_limits
      UNION ALL SELECT citation_urn FROM document_rules
      UNION ALL SELECT citation_urn FROM load_limits
      UNION ALL SELECT s->>'can_cu' FROM procedures, jsonb_array_elements(steps) AS s
    )
    SELECT DISTINCT split_part(split_part(u, '#', 1), '@', 1) AS urn
    FROM cc WHERE u ~ '^vn:(vbqppl|vbhn|doc):[a-z0-9-]+:'`;
  return [
    ...new Set([...Object.values(VB), "vn:vbqppl:qcvn:41/2024/BGTVT", ...trich.map((r) => r.urn)]),
  ].sort();
}

function laCsdlTrenMay(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h === "127.0.0.1" || h === "localhost" || h === "::1";
  } catch {
    return false;
  }
}

/** Cột ghi được của một bảng ở CSDL đích (bỏ cột sinh tự động), kèm kiểu dữ liệu. */
async function cotGhiDuoc(bang: string): Promise<Array<{ ten: string; kieu: string }>> {
  const rows = await sql<Array<{ column_name: string; data_type: string }>>`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${bang} AND is_generated = 'NEVER'
    ORDER BY ordinal_position`;
  return rows.map((r) => ({ ten: r.column_name, kieu: r.data_type }));
}

/** Ghi các dòng vào bảng đích theo lô, chỉ các cột mà cả hai phía cùng có. */
async function ghi(bang: string, dong: Array<Record<string, unknown>>): Promise<number> {
  if (!dong.length) return 0;
  const coNguon = new Set(Object.keys(dong[0]!));
  const cotDich = (await cotGhiDuoc(bang)).filter((c) => coNguon.has(c.ten));
  const cot = cotDich.map((c) => c.ten);
  const laJson = new Set(cotDich.filter((c) => c.kieu === "jsonb" || c.kieu === "json").map((c) => c.ten));
  let so = 0;
  for (let i = 0; i < dong.length; i += LO) {
    const lo = dong.slice(i, i + LO).map((d) => {
      const out: Record<string, unknown> = {};
      for (const c of cot) {
        const v = d[c];
        // Cột json: bọc sql.json, để mảng JSON không bị hiểu thành mảng Postgres.
        out[c] = laJson.has(c) && v !== null && v !== undefined ? sql.json(v as never) : v;
      }
      return out;
    });
    const r = await sql`INSERT INTO ${sql(bang)} ${sql(lo as never, cot)} ON CONFLICT DO NOTHING RETURNING 1`;
    so += r.length;
  }
  return so;
}

export async function chepVanBanDemo(): Promise<void> {
  const nguonUrl = process.env.DEMO_NGUON_DATABASE_URL?.trim();
  if (!nguonUrl) {
    console.warn(
      "! Chưa đặt DEMO_NGUON_DATABASE_URL: bỏ qua chép văn bản giao thông. Tra cứu văn bản chỉ có hai " +
        'văn bản mẫu. Xem docs/DEMO.md mục "Văn bản giao thông".',
    );
    return;
  }
  const dichUrl = process.env.DATABASE_URL ?? "";
  if (!laCsdlTrenMay(dichUrl)) {
    throw new Error(
      "DATABASE_URL không trỏ vào CSDL trên máy (127.0.0.1/localhost): dừng để không ghi nhầm kho thật.",
    );
  }
  if (nguonUrl === dichUrl) throw new Error("DEMO_NGUON_DATABASE_URL trùng DATABASE_URL.");
  const URN_VAN_BAN = await danhSachVanBan();
  console.log(`Cần chép ${URN_VAN_BAN.length} văn bản.`);

  const nguon = postgres(nguonUrl, { max: 1, connect_timeout: 15, idle_timeout: 5, onnotice: () => {} });
  try {
    await nguon.begin("read only", async (tx) => {
      const vanBan = (await tx`SELECT * FROM documents WHERE urn = ANY(${URN_VAN_BAN})`) as unknown as Array<
        Record<string, unknown>
      >;
      const thieu = URN_VAN_BAN.filter((u) => !vanBan.some((v) => v.urn === u));
      console.log(`Kho thật có ${vanBan.length}/${URN_VAN_BAN.length} văn bản trong danh sách.`);
      if (thieu.length) console.log(`  chưa có trong kho thật: ${thieu.join(", ")}`);
      if (!vanBan.length) return;
      const ids = vanBan.map((v) => v.id as string);

      const phienBan = (await tx`
        SELECT * FROM document_versions WHERE document_id = ANY(${ids}::uuid[])
        ORDER BY document_id, version_no`) as unknown as Array<Record<string, unknown>>;
      const nut = (await tx`
        SELECT * FROM nodes WHERE document_id = ANY(${ids}::uuid[])`) as unknown as Array<
        Record<string, unknown>
      >;
      const quanHe = (await tx`
        SELECT * FROM relations
        WHERE split_part(from_urn, '#', 1) = ANY(${URN_VAN_BAN}) AND split_part(to_urn, '#', 1) = ANY(${URN_VAN_BAN})`) as unknown as Array<
        Record<string, unknown>
      >;
      const lenhSua = (await tx`
        SELECT * FROM amendment_ops
        WHERE target_doc_urn = ANY(${URN_VAN_BAN}) AND amending_doc_urn = ANY(${URN_VAN_BAN})`) as unknown as Array<
        Record<string, unknown>
      >;

      // Phiên bản trỏ về phiên bản gốc (basis_version_id): ghi theo thứ tự version_no là đủ.
      console.log(`+ văn bản: ${await ghi("documents", vanBan)} mới / ${vanBan.length}`);
      // Văn bản đã có ở CSDL demo với id khác (ví dụ gieo từ nguồn khác): không chép phần con của
      // nó, vì phiên bản và nút của kho thật trỏ tới id văn bản của kho thật.
      const daCo = await sql<Array<{ id: string; urn: string }>>`
        SELECT id, urn FROM documents WHERE urn = ANY(${vanBan.map((v) => v.urn as string)})`;
      const cungId = new Set(daCo.filter((d) => ids.includes(d.id)).map((d) => d.id));
      for (const d of daCo.filter((d) => !cungId.has(d.id))) {
        console.warn(`  bỏ qua ${d.urn}: CSDL demo đã có văn bản này với id khác`);
      }
      const giu = (r: Record<string, unknown>) => cungId.has(r.document_id as string);
      console.log(
        `+ phiên bản: ${await ghi("document_versions", phienBan.filter(giu))} mới / ${phienBan.length}`,
      );
      console.log(`+ nút điều khoản: ${await ghi("nodes", nut.filter(giu))} mới / ${nut.length}`);
      console.log(`+ quan hệ: ${await ghi("relations", quanHe)} mới / ${quanHe.length}`);
      console.log(`+ lệnh sửa đổi: ${await ghi("amendment_ops", lenhSua)} mới / ${lenhSua.length}`);
    });
  } finally {
    await nguon.end();
  }
}

if (import.meta.main) {
  try {
    await chepVanBanDemo();
  } finally {
    await sql.end();
  }
}
