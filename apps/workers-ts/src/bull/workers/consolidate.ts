/**
 * Giai đoạn 7 — HỢP NHẤT: sinh phiên bản hợp nhất của văn bản BỊ sửa đổi tại từng
 * mốc hiệu lực, rồi đẩy `index` để lập lại chỉ mục cho phiên bản mới.
 */
import { getDocumentByUrn } from "@qdpl/db";
import { QUEUES } from "@qdpl/queue";
import { consolidateDocument } from "../../pipeline/consolidate.ts";
import { add } from "../queues.ts";
import { defineStage } from "../stage.ts";

export const consolidateStage = defineStage(QUEUES.consolidate, async (job, ctx) => {
  const { documentUrn, runId } = job.data;

  // Văn bản bị sửa đổi có thể chưa được nạp (nằm ngoài phạm vi đợt này) — đó là
  // kết luận hợp lệ, không phải lỗi: ghi bỏ qua để đối soát nhìn thấy.
  const doc = await getDocumentByUrn(documentUrn);
  if (!doc) {
    return { documentUrn, skipped: true, reason: `chưa có ${documentUrn} trong kho để hợp nhất` };
  }

  const r = await consolidateDocument(documentUrn, { enqueueIndex: false });
  await ctx.progress(70, `${r.versions.length} phiên bản`);

  let next = 0;
  if (r.versions.length) {
    await add(
      QUEUES.index,
      { ...(runId ? { runId } : {}), documentUrn },
      { key: `${runId ?? "adhoc"}:${documentUrn}:sau-hop-nhat` },
    );
    next = 1;
  }

  return {
    documentId: r.documentId,
    documentUrn,
    next,
    ...(r.conflicts.length ? { warnings: r.conflicts } : {}),
    detail: {
      versions: r.versions.length,
      approvedOps: r.approvedOps,
      pendingOps: r.pendingOps,
      status: r.status,
    },
  };
});
