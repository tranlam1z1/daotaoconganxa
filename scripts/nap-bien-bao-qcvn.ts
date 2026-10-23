/** Import only the explicitly reviewed, hash-locked official source excerpts. Default: read-only. */
import { join } from "node:path";
import { sql } from "@qdpl/db";
import type { LegalNode } from "@qdpl/legal-model";
import { putFromFile } from "@qdpl/storage";
import { loadReviewedSigns, QCVN_URN } from "./qcvn-signs-source.ts";

const { source, review, dir } = await loadReviewedSigns();
console.log(
  `Đã kiểm tra ${source.bien.length} biển, căn cứ và SHA-256 từng ảnh; nguồn: ${source.source_url}`,
);
if (!process.argv.includes("--apply")) {
  console.log("Chỉ kiểm tra. Dùng --apply để nạp bộ đã đối chiếu, không nạp bộ nháp mẫu.");
  await sql.end();
  process.exit(0);
}
const groups: Record<string, string> = {
  b: "Biển báo cấm",
  c: "Biển báo nguy hiểm và cảnh báo",
  d: "Biển hiệu lệnh",
  e: "Biển chỉ dẫn",
  f: "Biển phụ",
};
const root: LegalNode = {
  path: "",
  fullPath: "",
  kind: "van_ban",
  label: "QCVN 41:2024/BGTVT",
  heading: "Trích các mục đã đối chiếu về biển báo",
  text: `Bản trích ${source.bien.length} biển báo, không phải toàn bộ quy chuẩn. Toàn văn chính thức: ${source.source_url}.\n\n${review.scope}`,
  children: [],
  status: "active",
};
const sections = new Map(source.bien.map((b) => [b.can_cu.split("#")[1]!, b]));
for (const [letter, name] of Object.entries(groups)) {
  const path = `phu-luc-${letter}`;
  root.children.push({
    path,
    fullPath: path,
    kind: "phu_luc",
    label: `Phụ lục ${letter.toUpperCase()}`,
    heading: name,
    text: "",
    status: "active",
    children: [...sections]
      .filter(([p]) => p.startsWith(`${path}.`))
      .map(([p, b]) => ({
        path: p,
        fullPath: p,
        kind: "muc" as const,
        label: `Mục ${b.muc}`,
        text: b.nguyen_van_muc,
        children: [],
        status: "active" as const,
        pageRefs: [{ file: source.source_url, page: b.trang_anh }],
      })),
  });
}
// Upload checked files before publishing references. Distinct names preserve existing images.
for (const b of source.bien) await putFromFile(`assets/bien-bao/${b.anh}`, join(dir, "anh-qcvn-2024", b.anh));

const count = await sql.begin(async (tx) => {
  await tx`SELECT pg_advisory_xact_lock(hashtext(${QCVN_URN}))`;
  await tx`INSERT INTO documents(urn,doc_type,rank,is_normative,so_ky_hieu,title,short_title,issuer_name,issued_date,effective_from,status,status_as_of,summary,primary_source)
    VALUES (${QCVN_URN},'qcvn',999,false,'QCVN 41:2024/BGTVT','Quy chuẩn kỹ thuật quốc gia về báo hiệu đường bộ','QCVN 41:2024/BGTVT',
    'Bộ Giao thông vận tải','2024-11-15',${source.effective_from},'con_hieu_luc',now(),${root.text},${source.source_url}) ON CONFLICT(urn) DO NOTHING`;
  const [doc] = await tx`SELECT id,primary_source FROM documents WHERE urn=${QCVN_URN} FOR UPDATE`;
  if (doc!.primary_source !== source.source_url)
    throw new Error("Văn bản đã có nguồn khác; không tự ghi đè.");
  let [version] =
    await tx`SELECT id,content_hash FROM document_versions WHERE document_id=${doc!.id} ORDER BY version_no DESC LIMIT 1`;
  if (version && version.content_hash !== source.source_sha256)
    throw new Error("Văn bản đã có phiên bản khác; cần xử lý phiên bản riêng.");
  if (!version) {
    [version] =
      await tx`INSERT INTO document_versions(document_id,version_no,kind,valid_from,status,markdown,tree,content_hash,quality,provenance,reviewed_by,reviewed_at)
      VALUES (${doc!.id},1,'original',${source.effective_from},'con_hieu_luc',${root.text},${tx.json(root as never)},${source.source_sha256},
      ${tx.json({ scope: "reviewed_sign_excerpts_only", sign_count: source.bien.length, full_document: false })},
      ${tx.json({ source_url: source.source_url, source_sha256: source.source_sha256, review } as never)},${review.reviewed_by},${review.reviewed_on}::date) RETURNING id,content_hash`;
    for (const parent of root.children)
      for (const n of [parent, ...parent.children]) {
        await tx`INSERT INTO nodes(document_id,version_id,path,full_path,kind,label,heading,text_md,text_plain,node_status,depth,ordinal,page_refs)
        VALUES (${doc!.id},${version!.id},${n.path},${n.fullPath},${n.kind},${n.label},${n.heading ?? null},${n.text},${n.text},'active',${n.fullPath.split(".").length},
        ${[...sections.keys()].indexOf(n.path) + 1},${tx.json((n.pageRefs ?? []) as never)})`;
      }
  }
  let changed = 0;
  for (const [index, b] of source.bien.entries()) {
    const [old] = await tx`SELECT * FROM traffic_signs WHERE code=${b.ma} FOR UPDATE`;
    const imageUri = `assets/bien-bao/${b.anh}`;
    if (old?.status === "da_duyet") {
      if (
        old.name === b.ten &&
        old.meaning === b.y_nghia &&
        old.image_uri === imageUri &&
        old.citation_urn === b.can_cu &&
        !old.deleted_at
      )
        continue;
      throw new Error(`${b.ma} đã có bản duyệt khác; không tự ghi đè.`);
    }
    if (old?.created_by && old.created_by !== review.reviewed_by)
      throw new Error(`${b.ma} đang được biên tập; không tự ghi đè.`);
    await tx`INSERT INTO traffic_signs(code,group_name,name,meaning,image_uri,citation_urn,ordinal,status,effective_from,approved_by,approved_at,note,created_by)
      VALUES (${b.ma},${b.nhom},${b.ten},${b.y_nghia},${imageUri},${b.can_cu},${index + 1},'da_duyet',${source.effective_from},${review.reviewed_by},now(),
      ${`Nguồn Chính phủ; mục ${b.muc}, ảnh trang ${b.trang_anh}, PDF SHA256 ${source.source_sha256}. Đối chiếu bởi tác nhân ${review.reviewed_by}; không giả danh người duyệt.`},${review.reviewed_by})
      ON CONFLICT(code) DO UPDATE SET group_name=EXCLUDED.group_name,name=EXCLUDED.name,meaning=EXCLUDED.meaning,image_uri=EXCLUDED.image_uri,
        citation_urn=EXCLUDED.citation_urn,ordinal=EXCLUDED.ordinal,status='da_duyet',effective_from=EXCLUDED.effective_from,
        effective_to=NULL,approved_by=EXCLUDED.approved_by,approved_at=EXCLUDED.approved_at,note=EXCLUDED.note,version=traffic_signs.version+1,updated_at=now(),deleted_at=NULL`;
    await tx`INSERT INTO content_reviews(kind,ref,version,action,actor,note)
      SELECT 'traffic_sign',code,version,'doi_chieu_nguon_va_duyet',${review.reviewed_by},${`Mục ${b.muc}; ${source.source_url}#page=${b.trang_anh}; ảnh SHA256 ${b.sha256_anh}`} FROM traffic_signs WHERE code=${b.ma}`;
    changed++;
  }
  if (changed)
    await tx`INSERT INTO audit_log(actor,action,target,detail) VALUES (${review.reviewed_by},'traffic.signs.import_verified_source',${QCVN_URN},${tx.json({ changed, review, source_url: source.source_url } as never)})`;
  return changed;
});
console.log(`Đã nạp ${count} biển đã đối chiếu; ${source.bien.length - count} biển đã đúng từ lần trước.`);
await sql.end();
