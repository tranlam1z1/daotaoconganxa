/**
 * Nạp dữ liệu nền và dữ liệu mẫu để hệ thống chạy được ngay:
 * - Cơ quan ban hành + bảng alias (xử lý sáp nhập bộ năm 2025)
 * - Phân loại (đọc content/taxonomy.json nếu có)
 * - Hai văn bản mẫu (gốc + văn bản sửa đổi) kèm lệnh sửa đổi đã duyệt và bản hợp nhất tự động
 * Chạy: bun run packages/db/src/seed.ts
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type AmendOp,
  buildUrn,
  changeDates,
  consolidate,
  type DocumentMeta,
  deriveDocStatus,
  parseDocument,
  rankOf,
  serializeDocument,
} from "@qdpl/legal-model";
import { sql } from "./client.ts";
import { getAmendOpsFor, saveAmendOps, saveRelations, saveVersion, upsertDocument } from "./repo.ts";

const ROOT = join(import.meta.dir, "..", "..", "..");

const AGENCIES: Array<{
  code: string;
  name: string;
  kind: string;
  validFrom?: string;
  validTo?: string;
  aliases?: string[];
}> = [
  { code: "qh", name: "Quốc hội", kind: "trung_uong" },
  { code: "ubtvqh", name: "Ủy ban Thường vụ Quốc hội", kind: "trung_uong" },
  { code: "ctn", name: "Chủ tịch nước", kind: "trung_uong" },
  { code: "cp", name: "Chính phủ", kind: "trung_uong" },
  { code: "ttg", name: "Thủ tướng Chính phủ", kind: "trung_uong" },
  {
    code: "bkhcn",
    name: "Bộ Khoa học và Công nghệ",
    kind: "bo",
    aliases: ["Bộ Thông tin và Truyền thông", "Bộ TT&TT", "Bộ KH&CN", "BKHCN", "BTTTT"],
  },
  {
    code: "btc",
    name: "Bộ Tài chính",
    kind: "bo",
    aliases: ["Bộ Kế hoạch và Đầu tư", "Bộ KH&ĐT", "BTC", "BKHĐT"],
  },
  { code: "btp", name: "Bộ Tư pháp", kind: "bo", aliases: ["BTP"] },
  { code: "bxd", name: "Bộ Xây dựng", kind: "bo", aliases: ["BXD", "Bộ Giao thông vận tải"] },
  { code: "tandtc", name: "Tòa án nhân dân tối cao", kind: "trung_uong" },
  { code: "vksndtc", name: "Viện kiểm sát nhân dân tối cao", kind: "trung_uong" },
  { code: "ktnn", name: "Kiểm toán nhà nước", kind: "trung_uong" },
  { code: "ubnd-thanh-hoa", name: "Ủy ban nhân dân tỉnh Thanh Hóa", kind: "tinh" },
  { code: "hdnd-thanh-hoa", name: "Hội đồng nhân dân tỉnh Thanh Hóa", kind: "tinh" },
];

async function seedAgencies() {
  for (const a of AGENCIES) {
    await sql`
      INSERT INTO agencies (code, name, kind, valid_from, valid_to)
      VALUES (${a.code}, ${a.name}, ${a.kind}, ${a.validFrom ?? null}, ${a.validTo ?? null})
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, kind = EXCLUDED.kind`;
    for (const alias of a.aliases ?? []) {
      await sql`
        INSERT INTO agency_aliases (agency_code, alias) VALUES (${a.code}, ${alias})
        ON CONFLICT (agency_code, alias) DO NOTHING`;
    }
  }
  console.log(`  cơ quan: ${AGENCIES.length}`);
}

async function seedTaxonomy() {
  let items: Array<{ code: string; name: string; parent?: string; kind?: string; ordinal?: number }> = [];
  try {
    const raw = await readFile(join(ROOT, "content", "taxonomy.json"), "utf8");
    const parsed = JSON.parse(raw);
    items = Array.isArray(parsed) ? parsed : (parsed.items ?? []);
  } catch {
    // content/ do nhánh nội dung tạo; nếu chưa có thì dùng bộ tối thiểu.
    items = [
      { code: "PD.09", name: "Khoa học, công nghệ", kind: "chu_de", ordinal: 9 },
      { code: "CNTT", name: "Công nghệ thông tin", parent: "PD.09", kind: "nhanh_noi_bo" },
      { code: "CNTT.DT", name: "Đầu tư ứng dụng công nghệ thông tin", parent: "CNTT", kind: "nhanh_noi_bo" },
      { code: "PD.24", name: "Tài chính", kind: "chu_de", ordinal: 24 },
      { code: "DTC", name: "Đầu tư công", parent: "PD.24", kind: "nhanh_noi_bo" },
    ];
  }
  // Chèn cha trước con.
  const byCode = new Map(items.map((i) => [i.code, i]));
  const inserted = new Set<string>();
  const insert = async (item: (typeof items)[number]) => {
    if (inserted.has(item.code)) return;
    if (item.parent && byCode.has(item.parent)) await insert(byCode.get(item.parent)!);
    await sql`
      INSERT INTO taxonomy (code, parent_code, name, kind, ordinal)
      VALUES (${item.code}, ${item.parent ?? null}, ${item.name}, ${item.kind ?? "de_muc"}, ${item.ordinal ?? 0})
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_code = EXCLUDED.parent_code`;
    inserted.add(item.code);
  };
  for (const i of items) await insert(i);
  console.log(`  phân loại: ${inserted.size}`);
}

/** Nạp một văn bản từ file Markdown fixture. */
async function seedDocument(opts: {
  file: string;
  meta: Omit<DocumentMeta, "rank" | "isNormative" | "status">;
}) {
  const md = await readFile(join(ROOT, opts.file), "utf8");
  const parsed = parseDocument(md);
  const meta: DocumentMeta = {
    ...opts.meta,
    rank: rankOf(opts.meta.docType),
    isNormative: true,
    status: "con_hieu_luc",
  };
  const doc = await upsertDocument(meta);
  const versionId = await saveVersion({
    documentId: doc.id,
    versionNo: 1,
    kind: "original",
    validFrom: meta.effectiveFrom ?? meta.issuedDate,
    root: parsed.root,
    markdown: md,
    docTitle: meta.shortTitle,
    quality: { warnings: parsed.warnings.length, counts: parsed.counts },
    provenance: { source: "fixture", file: opts.file },
    docEffectiveFrom: meta.effectiveFrom,
    docEffectiveTo: meta.effectiveTo,
  });
  console.log(
    `  ${meta.soKyHieu}: ${Object.values(parsed.counts).reduce((a, b) => a + b, 0)} nút, cảnh báo ${parsed.warnings.length}`,
  );
  return { doc, versionId, root: parsed.root, meta };
}

const URN_GOC = buildUrn({ docType: "nd", soKyHieu: "100/2026/NĐ-CP" });
const URN_SUA = buildUrn({ docType: "nd", soKyHieu: "150/2027/NĐ-CP" });

/** Lệnh sửa đổi mẫu, tương ứng Điều 1 của Nghị định 150/2027/NĐ-CP. */
const OPS: AmendOp[] = [
  {
    id: "",
    amendingDocUrn: URN_SUA,
    amendingLabel: "khoản 1 Điều 1",
    targetDocUrn: URN_GOC,
    targetPath: "dieu-3.khoan-1",
    op: "replace",
    ordinal: 1,
    effectiveFrom: "2027-07-01",
    extraction: "rule",
    confidence: 0.98,
    reviewStatus: "approved",
    payload: {
      text: "1. Cơ quan chủ trì lập kế hoạch thử nghiệm và gửi lấy ý kiến các cơ quan có liên quan.",
    },
  },
  {
    id: "",
    amendingDocUrn: URN_SUA,
    amendingLabel: "khoản 2 Điều 1",
    targetDocUrn: URN_GOC,
    targetPath: "dieu-3.khoan-3",
    op: "insert_after",
    ordinal: 2,
    effectiveFrom: "2027-07-01",
    extraction: "rule",
    confidence: 0.96,
    reviewStatus: "approved",
    payload: {
      newLabel: "4.",
      newKind: "khoan",
      text: "4. Kế hoạch thử nghiệm được công khai trên cổng thông tin điện tử của cơ quan chủ trì.",
    },
  },
  {
    id: "",
    amendingDocUrn: URN_SUA,
    amendingLabel: "khoản 3 Điều 1",
    targetDocUrn: URN_GOC,
    targetPath: "dieu-3",
    op: "insert_after",
    ordinal: 3,
    effectiveFrom: "2027-07-01",
    extraction: "rule",
    confidence: 0.94,
    reviewStatus: "approved",
    payload: {
      newLabel: "Điều 3a",
      newKind: "dieu",
      text: "Điều 3a. Điều chỉnh kế hoạch thử nghiệm\n1. Kế hoạch thử nghiệm được điều chỉnh khi có thay đổi về mục tiêu hoặc kinh phí.\n2. Trình tự điều chỉnh thực hiện như trình tự lập kế hoạch.",
    },
  },
  {
    id: "",
    amendingDocUrn: URN_SUA,
    amendingLabel: "khoản 4 Điều 1",
    targetDocUrn: URN_GOC,
    targetPath: "dieu-1.khoan-2.diem-c",
    op: "repeal",
    ordinal: 4,
    effectiveFrom: "2027-07-01",
    extraction: "rule",
    confidence: 0.99,
    reviewStatus: "approved",
  },
];

async function main() {
  console.log("Nạp dữ liệu nền...");
  await seedAgencies();
  await seedTaxonomy();

  console.log("Nạp văn bản mẫu...");
  const goc = await seedDocument({
    file: "data/fixtures/nd-mau-goc.md",
    meta: {
      urn: URN_GOC,
      docType: "nd",
      soKyHieu: "100/2026/NĐ-CP",
      title: "Nghị định quy định mẫu về quản lý hoạt động thử nghiệm",
      shortTitle: "Nghị định 100/2026/NĐ-CP",
      issuer: "Chính phủ",
      signer: "Thủ tướng",
      issuedDate: "2026-01-20",
      effectiveFrom: "2026-03-01",
      fields: ["CNTT.DT"],
      summary: "Văn bản mẫu dùng cho kiểm thử hệ thống.",
    },
  });
  await seedDocument({
    file: "data/fixtures/nd-mau-sua-doi.md",
    meta: {
      urn: URN_SUA,
      docType: "nd",
      soKyHieu: "150/2027/NĐ-CP",
      title: "Nghị định sửa đổi, bổ sung một số điều của Nghị định số 100/2026/NĐ-CP",
      shortTitle: "Nghị định 150/2027/NĐ-CP",
      issuer: "Chính phủ",
      signer: "Thủ tướng",
      issuedDate: "2027-05-15",
      effectiveFrom: "2027-07-01",
      fields: ["CNTT.DT"],
      summary: "Văn bản sửa đổi mẫu.",
    },
  });

  console.log("Nạp lệnh sửa đổi và quan hệ...");
  await sql`DELETE FROM amendment_ops WHERE amending_doc_urn = ${URN_SUA}`;
  await saveAmendOps(OPS);
  await saveRelations([
    { fromUrn: URN_SUA, toUrn: URN_GOC, type: "sua_doi", effectiveFrom: "2027-07-01", source: "editor" },
    {
      fromUrn: URN_GOC,
      toUrn: URN_SUA,
      type: "bi_sua_doi_boi",
      effectiveFrom: "2027-07-01",
      source: "editor",
    },
  ]);

  console.log("Sinh bản hợp nhất tự động...");
  const ops = await getAmendOpsFor(URN_GOC);
  const dates = changeDates(ops);
  let versionNo = 1;
  for (const date of dates) {
    versionNo += 1;
    const r = consolidate(goc.root, ops, date);
    const markdown = serializeDocument(r.root, {
      footnotes: true,
      meta: { ...goc.meta, status: "con_hieu_luc" },
      asOf: date,
    });
    await saveVersion({
      documentId: goc.doc.id,
      versionNo,
      kind: "consolidated_auto",
      validFrom: date,
      root: r.root,
      markdown,
      docTitle: goc.meta.shortTitle,
      quality: { applied: r.applied.length, conflicts: r.conflicts.length },
      provenance: { generatedBy: "seed", asOf: date },
      appliedOps: r.applied.map((o) => o.id),
      docEffectiveFrom: goc.meta.effectiveFrom,
      docEffectiveTo: goc.meta.effectiveTo,
    });
    const status = deriveDocStatus(r.root, goc.meta, date);
    await sql`UPDATE documents SET status = ${status}, status_as_of = now() WHERE id = ${goc.doc.id}`;
    console.log(
      `  phiên bản ${versionNo} tại ${date}: áp dụng ${r.applied.length} lệnh, xung đột ${r.conflicts.length}, trạng thái ${status}`,
    );
    // Đóng khoảng hiệu lực của phiên bản trước.
    await sql`
      UPDATE document_versions SET valid_to = ${date}
      WHERE document_id = ${goc.doc.id} AND version_no = ${versionNo - 1}`;
  }

  const [counts] = await sql`
    SELECT (SELECT count(*) FROM documents) AS documents,
           (SELECT count(*) FROM document_versions) AS versions,
           (SELECT count(*) FROM nodes) AS nodes,
           (SELECT count(*) FROM relations) AS relations,
           (SELECT count(*) FROM amendment_ops) AS ops`;
  console.log("Xong:", counts);
  await sql.end();
}

await main();
