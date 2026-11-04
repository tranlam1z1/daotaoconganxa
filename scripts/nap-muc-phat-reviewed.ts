/** Only the hash-locked, individually checked source set can be published. */
import { createHash } from "node:crypto";
import { sql } from "@qdpl/db";
import type { LegalNode } from "@qdpl/legal-model";
import { loadPenaltySource, PENALTY_URN } from "./penalty-source.ts";

const { source, review } = await loadPenaltySource();
console.log(`Đã kiểm tra ${source.dong.length} hành vi và căn cứ chính thức.`);
if (!process.argv.includes("--apply")) {
  console.log("Chỉ kiểm tra. Dùng --apply để nạp bộ đã đối chiếu.");
  await sql.end();
  process.exit(0);
}
const root: LegalNode = {
  path: "",
  fullPath: "",
  kind: "van_ban",
  label: "Nghị định 168/2024/NĐ-CP",
  heading: "Các điểm trích chọn đã đối chiếu",
  text: `Bản trích chọn, không phải toàn văn hay bản hợp nhất. ${review.scope}\nToàn văn: ${source.source_url}\n${source.amendment_check}`,
  children: [],
  status: "active",
};
const allNodes = new Map<string, LegalNode>();
for (const [path, text] of Object.entries(source.provisions)) {
  const parts = path.split(".");
  for (let i = 0; i < parts.length; i++) {
    const p = parts.slice(0, i + 1).join(".");
    if (!allNodes.has(p)) {
      const part = parts[i]!;
      const [kind, n] = part.split("-");
      const node: LegalNode = {
        path: p,
        fullPath: p,
        kind: kind as "dieu" | "khoan" | "diem",
        label: `${kind === "dieu" ? "Điều" : kind === "khoan" ? "Khoản" : "Điểm"} ${n}`,
        text: source.provisions[p] ?? "Trích các khoản, điểm được chọn; xem toàn văn chính thức.",
        children: [],
        status: "active",
      };
      allNodes.set(p, node);
      if (i === 0) root.children.push(node);
      else allNodes.get(parts.slice(0, i).join("."))!.children.push(node);
    }
  }
  allNodes.get(path)!.text = text;
}
const changed = await sql.begin(async (tx) => {
  await tx`SELECT pg_advisory_xact_lock(hashtext(${PENALTY_URN}))`;
  await tx`INSERT INTO documents(urn,doc_type,rank,is_normative,so_ky_hieu,title,short_title,issuer_name,issued_date,effective_from,status,status_as_of,summary,primary_source)
  VALUES (${PENALTY_URN},'nd',50,true,'168/2024/NĐ-CP','Quy định xử phạt vi phạm hành chính về trật tự, an toàn giao thông trong lĩnh vực giao thông đường bộ; trừ điểm, phục hồi điểm giấy phép lái xe','Nghị định 168/2024/NĐ-CP','Chính phủ','2024-12-26','2025-01-01','het_hieu_luc_mot_phan',now(),${root.text},${source.signed_pdf_url}) ON CONFLICT(urn) DO NOTHING`;
  const [doc] = await tx`SELECT id,primary_source FROM documents WHERE urn=${PENALTY_URN} FOR UPDATE`;
  if (doc!.primary_source !== source.signed_pdf_url) throw new Error("Văn bản có nguồn khác; không ghi đè.");
  let [version] =
    await tx`SELECT id,content_hash FROM document_versions WHERE document_id=${doc!.id} ORDER BY version_no DESC LIMIT 1`;
  if (version && version.content_hash !== review.dataset_sha256)
    throw new Error("Văn bản có phiên bản khác; không ghi đè.");
  if (!version) {
    [version] =
      await tx`INSERT INTO document_versions(document_id,version_no,kind,valid_from,status,markdown,tree,content_hash,quality,provenance,reviewed_by,reviewed_at)
    VALUES (${doc!.id},1,'original','2025-01-01','con_hieu_luc',${root.text},${tx.json(root as never)},${review.dataset_sha256},
    ${tx.json({ full_document: false, scope: "selected_unchanged_provisions", rows: source.dong.length })},${tx.json({ review, source_url: source.source_url, signed_pdf_sha256: source.signed_pdf_sha256, amendment_url: source.amendment_url, amendment_sha256: source.amendment_sha256 } as never)},${review.reviewed_by},${review.reviewed_on}::date) RETURNING id,content_hash`;
    let ordinal = 0;
    for (const n of allNodes.values())
      await tx`INSERT INTO nodes(document_id,version_id,path,full_path,kind,label,text_md,text_plain,node_status,depth,ordinal)
    VALUES (${doc!.id},${version!.id},${n.path},${n.fullPath},${n.kind},${n.label},${n.text},${n.text},'active',${n.path.split(".").length},${++ordinal})`;
  }
  let count = 0;
  for (const b of source.dong) {
    const [old] = await tx`SELECT code,status,note FROM violations WHERE code=${b.ma} FOR UPDATE`;
    const marker = `verified-dataset:${review.dataset_sha256}`;
    if (old) {
      if (old.status === "da_duyet" && old.note === marker) continue;
      throw new Error(`${b.ma} đã tồn tại; không ghi đè.`);
    }
    await tx`INSERT INTO violation_categories(code,name) VALUES (${b.nhom},${b.nhom}) ON CONFLICT DO NOTHING`;
    const speed = b.toc_do_vuot;
    await tx`INSERT INTO violations(code,vehicle,group_name,behavior,keywords,search_text,fine_min,fine_max,extra_penalties,point_deduction,speed_over_min,speed_over_max,speed_bounds,citation_urn,effective_from,status,note,created_by,approved_by,approved_at)
    VALUES (${b.ma},${b.xe},${b.nhom},${b.hanh_vi},${b.tu_khoa},unaccent(lower(${[b.hanh_vi, ...b.tu_khoa].join(" ")})),${b.phat_tu},${b.phat_den},${tx.json(b.hinh_thuc_bo_sung)},${b.tru_diem},${speed?.tu ?? null},${speed?.den ?? null},${speed?.bien ?? "[)"},${b.can_cu},${b.hieu_luc_tu},'da_duyet',${marker},${review.reviewed_by},${review.reviewed_by},now())`;
    const hash = createHash("sha256").update(`reviewed-168:${b.ma}`).digest("hex");
    const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
    await tx`INSERT INTO violation_penalties(id,violation_code,conditions,required_facts,fine_min,fine_max,point_deduction,suspension_months_min,suspension_months_max,additional_penalties,citation_urn,effective_from,status,created_by,reviewed_by,reviewed_at)
    VALUES (${id},${b.ma},${b.conditions},${b.required_facts},${b.phat_tu},${b.phat_den},${b.tru_diem},${b.suspension_months?.[0] ?? null},${b.suspension_months?.[1] ?? null},${b.hinh_thuc_bo_sung},${b.can_cu},${b.hieu_luc_tu},'da_duyet',${review.reviewed_by},${review.reviewed_by},now())`;
    await tx`INSERT INTO content_reviews(kind,ref,version,action,actor,note) VALUES ('violation',${b.ma},1,'doi_chieu_nguon_va_duyet',${review.reviewed_by},${`${b.can_cu}; ${source.source_url}; ${marker}; ${source.amendment_check}`})`;
    count++;
  }
  if (count)
    await tx`INSERT INTO audit_log(actor,action,target,detail) VALUES (${review.reviewed_by},'traffic.penalties.import_verified_source',${PENALTY_URN},${tx.json({ count, review } as never)})`;
  return count;
});
console.log(`Đã nạp ${changed} hành vi; ${source.dong.length - changed} đã có từ lần trước.`);
await sql.end();
