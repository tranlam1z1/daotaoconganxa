/**
 * Giai đoạn 4b — CẦU NỐI SANG services/docproc (Python) cho PDF/DOC.
 *
 * docproc chỉ biết bảng `jobs` của Postgres (xem services/docproc/docproc/worker.py:
 * claim theo `queue`, cập nhật `state`), nên worker này:
 *   1. ghi một job vào `jobs` đúng hợp đồng DocprocJobPayload,
 *   2. CHỜ kết quả bằng cách đọc lại `jobs.state` — hết thời gian chờ thì ném lỗi để
 *      BullMQ thử lại có lùi thời gian (không giữ mãi một chỗ chạy),
 *   3. xong thì kiểm tra file document.md rồi đẩy job `parse`.
 *
 * Bước 1 idempotent: nếu đã có job docproc cho cùng (documentId, inputPath) và job đó
 * chưa chết thì dùng lại, không tạo job trùng khi BullMQ thử lại.
 */

import { access } from "node:fs/promises";
import { join } from "node:path";
import { enqueue, getDocumentByUrn, sql } from "@qdpl/db";
import { QUEUES } from "@qdpl/queue";
import { config } from "../../config.ts";
import { absolutePath } from "../../crawler/store.ts";
import { DOCPROC_MARKDOWN, type DocprocJobPayload } from "../../pipeline/convert.ts";
import { add } from "../queues.ts";
import { defineStage } from "../stage.ts";

/** Nhịp hỏi lại trạng thái job docproc. */
export const DOCPROC_POLL_MS = Number(process.env.DOCPROC_POLL_MS ?? 5000);
/** Thời gian chờ tối đa TRONG MỘT lần thử; hết giờ thì để BullMQ hẹn lại. */
export const DOCPROC_WAIT_MS = Number(process.env.DOCPROC_WAIT_MS ?? 10 * 60_000);

interface JobRow {
  id: string;
  state: string;
  last_error: string | null;
}

/** Job docproc đã có cho cùng file của cùng văn bản (nếu còn dùng lại được). */
export async function findDocprocJob(documentId: string, inputPath: string): Promise<JobRow | undefined> {
  const rows = await sql`
    SELECT id, state, last_error FROM jobs
    WHERE queue = ${config.docprocQueue}
      AND payload->>'documentId' = ${documentId}
      AND payload->>'inputPath' = ${inputPath}
    ORDER BY id DESC LIMIT 1`;
  return rows[0] as JobRow | undefined;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const docprocStage = defineStage(QUEUES.docproc, async (job, ctx) => {
  const { documentUrn, inputPath, outputDir, useLlm, runId } = job.data;
  const doc = await getDocumentByUrn(documentUrn);
  if (!doc) throw new Error(`Không có văn bản ${documentUrn} trong CSDL`);

  const markdownUri = join(outputDir, DOCPROC_MARKDOWN);

  let existing = await findDocprocJob(doc.id, inputPath);
  if (!existing || existing.state === "dead") {
    const payload: DocprocJobPayload = {
      inputPath,
      outputDir,
      documentId: doc.id,
      useLlm: useLlm ?? (process.env.DOCPROC_USE_LLM ?? "0") === "1",
      windowSize: 5,
      overlap: 1,
      dpi: 300,
      keepRunningHeads: false,
      promptVersion: "v1",
      kind: inputPath.toLowerCase().endsWith(".pdf") ? "pdf" : "doc",
    };
    const id = await enqueue(config.docprocQueue, payload, { priority: 5 });
    existing = { id: String(id), state: "pending", last_error: null };
    ctx.log.info("Đã đẩy job cho services/docproc", { docprocJobId: id, inputPath, outputDir });
  }

  const han = Date.now() + DOCPROC_WAIT_MS;
  let state = existing.state;
  while (Date.now() < han) {
    const [row] = await sql`SELECT id, state, last_error FROM jobs WHERE id = ${existing.id}`;
    const cur = row as JobRow | undefined;
    if (!cur) throw new Error(`Job docproc ${existing.id} biến mất khỏi bảng jobs`);
    state = cur.state;
    if (state === "dead") {
      throw new Error(`Job docproc ${existing.id} thất bại hẳn: ${cur.last_error ?? "không rõ lý do"}`);
    }
    if (state === "done") break;
    await ctx.progress(50, `docproc: ${state}`);
    await sleep(DOCPROC_POLL_MS);
  }

  if (state !== "done") {
    // Chưa xong: ném lỗi để BullMQ hẹn lại (job docproc vẫn đang chạy, không tạo lại).
    throw new Error(
      `Job docproc ${existing.id} vẫn ở trạng thái "${state}" sau ${Math.round(DOCPROC_WAIT_MS / 1000)}s — sẽ chờ tiếp ở lần thử sau`,
    );
  }

  const abs = absolutePath(markdownUri);
  try {
    await access(abs);
  } catch {
    throw new Error(`docproc báo xong nhưng không thấy ${abs}`);
  }

  await add(
    QUEUES.parse,
    { ...(runId ? { runId } : {}), documentUrn, markdownPath: markdownUri },
    { key: `${runId ?? "adhoc"}:${documentUrn}` },
  );

  return {
    documentId: doc.id,
    documentUrn,
    route: "docproc",
    next: 1,
    detail: { docprocJobId: existing.id, markdownUri },
  };
});
