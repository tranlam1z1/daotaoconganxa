/**
 * Giai đoạn 9 — LẬP CHỈ MỤC: phiên bản mới nhất của văn bản vào chỉ mục tìm kiếm.
 * Đây là ĐIỂM CUỐI của một mục trong sổ cái: xong bước này thì `ingest_items`
 * chuyển sang giai_doan='xong'.
 */
import { getDocumentByUrn, sql } from "@qdpl/db";
import { QUEUES } from "@qdpl/queue";
import { indexVersion } from "../../pipeline/index.ts";
import { defineStage } from "../stage.ts";

export const indexStage = defineStage(QUEUES.index, async (job, ctx) => {
  const { documentUrn } = job.data;
  const doc = await getDocumentByUrn(documentUrn);
  if (!doc) throw new Error(`Không có văn bản ${documentUrn} trong CSDL`);

  const rows = await sql`
    SELECT id, version_no FROM document_versions
    WHERE document_id = ${doc.id} ORDER BY version_no DESC LIMIT 1`;
  const version = rows[0] as { id: string; version_no: number } | undefined;
  if (!version) {
    return { documentId: doc.id, documentUrn, skipped: true, reason: "văn bản chưa có phiên bản nào" };
  }

  const r = await indexVersion(doc.id, version.id);
  await ctx.progress(100);

  // @qdpl/search vắng mặt hoặc chưa xuất indexVersion() KHÔNG phải lỗi của mục này:
  // mục vẫn coi như đã đi hết đường ống, chỉ ghi lý do vào nhật ký.
  return {
    documentId: doc.id,
    documentUrn,
    detail: {
      versionId: version.id,
      versionNo: version.version_no,
      indexed: r.indexed ?? null,
      ...(r.skipped ? { bo_qua_chi_muc: r.reason ?? true } : {}),
    },
  };
});
