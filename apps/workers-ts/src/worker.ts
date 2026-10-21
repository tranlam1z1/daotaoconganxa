/**
 * Worker: vòng lặp lấy job từ bảng `jobs` (claimJob/finishJob của @qdpl/db),
 * xử lý các queue của pipeline, ghi `pipeline_runs`, tắt êm khi nhận SIGINT/SIGTERM.
 *
 *   bun run src/worker.ts                 # tất cả queue
 *   bun run src/worker.ts --queues parse,index
 */
import { claimJob, finishJob, logRun, sql } from "@qdpl/db";
import { config } from "./config.ts";
import { errText, log } from "./log.ts";
import { consolidateDocument } from "./pipeline/consolidate.ts";
import { awaitDocproc, convert } from "./pipeline/convert.ts";
import { extractOpsForDocument } from "./pipeline/extract-ops.ts";
import { indexVersion } from "./pipeline/index.ts";
import { ingestSourceRecord } from "./pipeline/ingest.ts";
import { parseAndSave } from "./pipeline/parse.ts";
import { extractRelationsForDocument } from "./pipeline/relations.ts";

export const ALL_QUEUES = [
  "ingest",
  "convert",
  "parse",
  "extract-ops",
  "consolidate",
  "relations",
  "index",
  "docproc-wait",
] as const;

export type Queue = (typeof ALL_QUEUES)[number];

export interface JobRow {
  id: string;
  queue: string;
  payload: any;
  attempts: number;
  max_attempts: number;
}

/** Kết quả xử lý: documentId (nếu có) để ghi vào pipeline_runs. */
export interface HandlerResult {
  documentId?: string;
  route?: string;
  warnings?: unknown;
  detail?: Record<string, unknown>;
}

type Handler = (payload: any) => Promise<HandlerResult>;

function need<T>(payload: any, key: string): T {
  const v = payload?.[key];
  if (v === undefined || v === null || v === "") {
    throw new Error(`Job thiếu trường bắt buộc "${key}" (payload=${JSON.stringify(payload)?.slice(0, 200)})`);
  }
  return v as T;
}

export const HANDLERS: Record<Queue, Handler> = {
  ingest: async (p) => {
    const r = await ingestSourceRecord(need<string>(p, "sourceRecordId"));
    return {
      documentId: r.documentId,
      ...(r.route ? { route: r.route } : {}),
      detail: { urn: r.urn, created: r.created },
    };
  },
  convert: async (p) => {
    const documentId = need<string>(p, "documentId");
    const r = await convert({
      documentId,
      sourceRecordId: p.sourceRecordId,
      fileUri: need<string>(p, "fileUri"),
      kind: p.kind,
      htmlSelector: p.htmlSelector,
    });
    return {
      documentId,
      route: r.route,
      warnings: r.warnings,
      detail: { deferred: r.deferred, markdownUri: r.markdownUri },
    };
  },
  parse: async (p) => {
    const documentId = need<string>(p, "documentId");
    const r = await parseAndSave({
      documentId,
      markdownUri: p.markdownUri,
      markdown: p.markdown,
      kind: p.kind,
      versionNo: p.versionNo,
    });
    return {
      documentId,
      warnings: r.warnings,
      detail: { versionId: r.versionId, nodes: r.nodeCount, isAmending: r.isAmending },
    };
  },
  "extract-ops": async (p) => {
    const documentId = need<string>(p, "documentId");
    const r = await extractOpsForDocument(documentId);
    return {
      documentId,
      warnings: r.warnings,
      detail: { ops: r.ops, needsLegal: r.needsLegal, targets: r.targets },
    };
  },
  consolidate: async (p) => {
    const r = await consolidateDocument(need<string>(p, "targetDocUrn"));
    return {
      documentId: r.documentId,
      warnings: r.conflicts,
      detail: { versions: r.versions.length, status: r.status, approvedOps: r.approvedOps },
    };
  },
  relations: async (p) => {
    const documentId = need<string>(p, "documentId");
    const r = await extractRelationsForDocument(documentId);
    return { documentId, detail: { canCu: r.canCu, danChieu: r.danChieu, chaCon: r.chaCon, saved: r.saved } };
  },
  "docproc-wait": async (p) => {
    const documentId = need<string>(p, "documentId");
    const r = await awaitDocproc({
      docprocJobId: String(need<string>(p, "docprocJobId")),
      documentId,
      markdownUri: need<string>(p, "markdownUri"),
      tries: p.tries,
    });
    return { documentId, route: "docproc", detail: { ready: r.ready, state: r.state } };
  },
  index: async (p) => {
    const documentId = need<string>(p, "documentId");
    const r = await indexVersion(documentId, need<string>(p, "versionId"));
    return { documentId, detail: { skipped: r.skipped, ...(r.reason ? { reason: r.reason } : {}) } };
  },
};

/** Xử lý một job đã claim. Trả về true nếu thành công. */
export async function runJob(job: JobRow): Promise<boolean> {
  const jl = log.child({ jobId: String(job.id), queue: job.queue, attempt: job.attempts });
  const handler = HANDLERS[job.queue as Queue];
  const started = Date.now();
  if (!handler) {
    const msg = `Không có handler cho queue "${job.queue}"`;
    jl.error(msg);
    await finishJob(String(job.id), msg);
    await logRun({ step: job.queue, status: "error", error: msg, durationMs: Date.now() - started });
    return false;
  }
  // Payload jsonb: phải là object. Chuỗi nghĩa là ai đó đã JSON.stringify hai lần.
  let payload = job.payload;
  if (typeof payload === "string") {
    jl.warn("jobs.payload là chuỗi thay vì object — thử parse lại", {});
    try {
      payload = JSON.parse(payload);
    } catch {
      /* giữ nguyên để handler báo lỗi rõ ràng */
    }
  }
  try {
    const res = await handler(payload);
    const durationMs = Date.now() - started;
    await finishJob(String(job.id));
    await logRun({
      ...(res.documentId ? { documentId: res.documentId } : {}),
      step: job.queue,
      ...(res.route ? { route: res.route } : {}),
      status: "ok",
      durationMs,
      ...(res.warnings ? { warnings: res.warnings } : {}),
    });
    jl.info("Job xong", { durationMs, ...(res.detail ?? {}) });
    return true;
  } catch (e) {
    const durationMs = Date.now() - started;
    const error = errText(e);
    await finishJob(String(job.id), error);
    await logRun({ step: job.queue, status: "error", error, durationMs });
    jl.error("Job lỗi", { durationMs, error });
    return false;
  }
}

export interface WorkerOptions {
  queues?: string[];
  /** Thoát khi hết job (dùng cho CLI/test). */
  once?: boolean;
  idleMs?: number;
  /** Số job tối đa rồi dừng (0 = không giới hạn). */
  maxJobs?: number;
}

/** Chạy vòng lặp worker cho tới khi bị dừng. */
export async function runWorker(opts: WorkerOptions = {}): Promise<{ processed: number; failed: number }> {
  const queues = opts.queues?.length ? opts.queues : [...ALL_QUEUES];
  const idleMs = opts.idleMs ?? 1000;
  let stopping = false;
  let processed = 0;
  let failed = 0;

  const stop = (signal: string) => {
    if (stopping) return;
    stopping = true;
    log.info("Nhận tín hiệu dừng, kết thúc job hiện tại rồi thoát", { signal });
  };
  const onInt = () => stop("SIGINT");
  const onTerm = () => stop("SIGTERM");
  process.on("SIGINT", onInt);
  process.on("SIGTERM", onTerm);

  log.info("Worker khởi động", { queues, storageDir: config.storageDir });
  try {
    while (!stopping) {
      const job = (await claimJob(queues)) as JobRow | undefined;
      if (!job) {
        if (opts.once) break;
        await new Promise((r) => setTimeout(r, idleMs));
        continue;
      }
      const ok = await runJob(job);
      processed += 1;
      if (!ok) failed += 1;
      if (opts.maxJobs && processed >= opts.maxJobs) break;
    }
  } finally {
    process.off("SIGINT", onInt);
    process.off("SIGTERM", onTerm);
  }
  log.info("Worker dừng", { processed, failed });
  return { processed, failed };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const qArg = args.indexOf("--queues");
  const queues = qArg >= 0 ? (args[qArg + 1] ?? "").split(",").filter(Boolean) : undefined;
  const once = args.includes("--once");
  const res = await runWorker({ ...(queues ? { queues } : {}), once });
  await sql.end({ timeout: 5 });
  process.exit(res.failed > 0 ? 1 : 0);
}
