/**
 * Giai đoạn phụ — ĐỐI SOÁT: đếm lại kho theo từng ô của khung `corpus_targets`
 * và ghi `corpus_coverage`, trả lời câu hỏi "kho còn THIẾU gì" chứ không chỉ
 * "đã nạp được bao nhiêu".
 */
import { QUEUES } from "@qdpl/queue";
import { listTargets, refreshCoverage } from "../frame.ts";
import { refreshRunCounts } from "../ledger.ts";
import { defineStage } from "../stage.ts";

export const reconcileStage = defineStage(QUEUES.reconcile, async (job, ctx) => {
  const { targetMa, runId } = job.data;
  const targets = await listTargets(targetMa?.length ? { ma: targetMa } : {});
  const coverage = [];
  for (const [i, t] of targets.entries()) {
    coverage.push(await refreshCoverage(t));
    await ctx.progress(Math.round(((i + 1) / Math.max(1, targets.length)) * 100), t.ma);
  }
  if (runId) await refreshRunCounts(runId);
  return {
    detail: {
      o_khung: targets.length,
      thieu: coverage.filter((c) => c.ty_le !== null && c.ty_le < 1).length,
    },
  };
});
