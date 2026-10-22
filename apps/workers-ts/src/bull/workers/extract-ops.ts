/**
 * Giai đoạn 6 — TRÍCH LỆNH SỬA ĐỔI (chỉ chạy với văn bản sửa đổi).
 * Lệnh trích ra vào `amendment_ops` ở trạng thái chờ duyệt; sau khi quản trị viên nội dung
 * duyệt thì mới hợp nhất. Ở đây vẫn đẩy job `consolidate` cho từng văn bản bị sửa
 * đổi: bước hợp nhất tự bỏ qua lệnh chưa duyệt.
 */
import { getDocumentByUrn } from "@qdpl/db";
import { QUEUES } from "@qdpl/queue";
import { extractOpsForDocument } from "../../pipeline/extract-ops.ts";
import { add } from "../queues.ts";
import { defineStage } from "../stage.ts";

export const extractOpsStage = defineStage(QUEUES.extractOps, async (job, ctx) => {
  const { documentUrn, runId } = job.data;
  const doc = await getDocumentByUrn(documentUrn);
  if (!doc) throw new Error(`Không có văn bản ${documentUrn} trong CSDL`);

  const r = await extractOpsForDocument(doc.id, { enqueueConsolidate: false });
  await ctx.progress(70, `${r.ops} lệnh`);

  let next = 0;
  for (const target of r.targets) {
    await add(
      QUEUES.consolidate,
      { ...(runId ? { runId } : {}), documentUrn: target },
      { key: `${runId ?? "adhoc"}:${target}:tu:${documentUrn}`, priority: 2 },
    );
    next += 1;
  }

  return {
    documentId: doc.id,
    documentUrn,
    next,
    ...(r.warnings.length ? { warnings: r.warnings } : {}),
    detail: {
      ops: r.ops,
      needsLegal: r.needsLegal,
      targets: r.targets.length,
      missingTargets: r.missingTargets.length,
    },
  };
});
