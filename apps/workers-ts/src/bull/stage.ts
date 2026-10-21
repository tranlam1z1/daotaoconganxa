/**
 * Vỏ bọc chung cho mọi worker BullMQ của đường ống nạp kho.
 *
 * Mỗi giai đoạn chỉ cần viết phần việc của mình; vỏ bọc lo phần chung:
 *  - cập nhật sổ cái `ingest_items` (giai_doan, trang_thai, so_lan_thu, loi, job_id, bat_dau, ket_thuc)
 *  - `job.updateProgress()` để theo dõi trực tiếp
 *  - ghi `pipeline_runs` bằng `logRun()` của @qdpl/db
 *  - KHÔNG nuốt lỗi: ghi sổ xong thì ném lại để BullMQ thử lại có lùi thời gian.
 */
import { logRun } from "@qdpl/db";
import { type JobPayloads, QUEUE_STAGE, QUEUES, type QueueName, type Stage } from "@qdpl/queue";
import type { Job } from "bullmq";
import { errText, log } from "../log.ts";
import {
  type ItemPatch,
  type ItemState,
  type PatchOptions,
  patchItemBySource,
  patchItemByUrn,
  refreshRunCounts,
} from "./ledger.ts";

/** Kết quả một giai đoạn trả về cho vỏ bọc. */
export interface StageOutcome {
  /** Văn bản liên quan — để ghi pipeline_runs và nối sổ cái với URN. */
  documentId?: string;
  documentUrn?: string;
  /** Kết luận "không có gì để làm" (ví dụ không có file chuyển đổi được). */
  skipped?: boolean;
  reason?: string;
  route?: string;
  warnings?: unknown;
  /** Số job giai đoạn kế tiếp đã đẩy. */
  next?: number;
  detail?: Record<string, unknown>;
  /** Giai đoạn này là điểm cuối của mục (mặc định chỉ `index` mới là điểm cuối). */
  terminal?: boolean;
  /** Trường bổ sung cần ghi vào sổ cái (số ký hiệu, url…). */
  patch?: ItemPatch;
}

export interface StageContext {
  runId?: string;
  /** Ghi tiến độ 0..100 cho job hiện tại. */
  progress: (phanTram: number, ghiChu?: string) => Promise<void>;
  log: ReturnType<typeof log.child>;
}

export type StageHandler<K extends QueueName> = (
  job: Job<JobPayloads[K]>,
  ctx: StageContext,
) => Promise<StageOutcome>;

export interface StageDef<K extends QueueName = QueueName> {
  queue: K;
  handle: StageHandler<K>;
}

export function defineStage<K extends QueueName>(queue: K, handle: StageHandler<K>): StageDef<K> {
  return { queue, handle };
}

/** Giai đoạn cuối của một mục: xong bước lập chỉ mục là mục coi như hoàn tất. */
const TERMINAL_QUEUES: ReadonlySet<string> = new Set([QUEUES.index]);

interface ItemKey {
  runId: string;
  nguon?: string;
  sourceId?: string;
  documentUrn?: string;
}

/** Rút khóa sổ cái từ payload: hoặc (nguồn, sourceId), hoặc URN văn bản. */
export function itemKeyOf(data: unknown): ItemKey | undefined {
  const d = data as Record<string, unknown> | undefined;
  const runId = typeof d?.runId === "string" ? d.runId : undefined;
  if (!runId) return undefined;
  const nguon = typeof d?.nguon === "string" ? d.nguon : undefined;
  const sourceId = typeof d?.sourceId === "string" ? d.sourceId : undefined;
  const documentUrn = typeof d?.documentUrn === "string" ? d.documentUrn : undefined;
  if (nguon && sourceId) return { runId, nguon, sourceId };
  if (documentUrn) return { runId, documentUrn };
  return undefined;
}

async function patchItem(key: ItemKey | undefined, patch: ItemPatch, opts: PatchOptions = {}): Promise<void> {
  if (!key) return;
  if (key.nguon && key.sourceId) {
    await patchItemBySource(key.runId, key.nguon, key.sourceId, patch, opts);
    return;
  }
  if (key.documentUrn) await patchItemByUrn(key.runId, key.documentUrn, patch, opts);
}

/**
 * Số lần thử của job hiện tại (1-based).
 * BullMQ tăng `attemptsMade` SAU khi job hỏng, nên lần chạy đầu tiên là 0.
 */
export function attemptOf(job: { attemptsMade?: number }): number {
  return (job.attemptsMade ?? 0) + 1;
}

export type StageProcessor<K extends QueueName> = (job: Job<JobPayloads[K]>) => Promise<StageOutcome>;

/** Bọc một giai đoạn thành hàm xử lý cho `new Worker(...)`. */
export function wrapStage<K extends QueueName>(def: StageDef<K>): StageProcessor<K> {
  const stage: Stage = QUEUE_STAGE[def.queue] ?? "phat_hien";
  const terminal = TERMINAL_QUEUES.has(def.queue);

  return async (job) => {
    const started = Date.now();
    const key = itemKeyOf(job.data);
    const attempt = attemptOf(job);
    const jl = log.child({ queue: def.queue, jobId: String(job.id ?? "?"), attempt });

    // Nhánh phụ (quan hệ, trích lệnh, hợp nhất) có thể chạy sau bước lập chỉ mục;
    // chúng KHÔNG được kéo một mục đã hoàn tất về lại trạng thái đang chạy.
    await patchItem(
      key,
      {
        giaiDoan: stage,
        trangThai: "dang_chay",
        soLanThu: attempt,
        jobId: String(job.id ?? ""),
        loi: null,
        batDau: true,
        ketThuc: null,
      },
      { chiKhiChuaXong: true },
    );
    await job.updateProgress({ giai_doan: stage, phan_tram: 0 }).catch(() => undefined);

    const ctx: StageContext = {
      ...(key?.runId ? { runId: key.runId } : {}),
      log: jl,
      progress: async (phanTram, ghiChu) => {
        await job
          .updateProgress({ giai_doan: stage, phan_tram: phanTram, ...(ghiChu ? { ghi_chu: ghiChu } : {}) })
          .catch(() => undefined);
      },
    };

    try {
      const out = await def.handle(job, ctx);
      const durationMs = Date.now() - started;
      const isTerminal = out.terminal ?? terminal;
      const trangThai: ItemState = out.skipped ? "bo_qua" : isTerminal ? "xong" : "cho";
      // Mục đã xử lý xong ở giai đoạn này -> chờ giai đoạn kế tiếp (trạng thái "cho"),
      // trừ khi đây là điểm cuối hoặc bị bỏ qua.
      await patchItem(
        key,
        {
          ...(out.patch ?? {}),
          giaiDoan: isTerminal && !out.skipped ? "xong" : stage,
          trangThai,
          ...(out.documentUrn ? { documentUrn: out.documentUrn } : {}),
          ...(out.skipped ? { loi: out.reason ?? "bỏ qua" } : {}),
          ...(trangThai === "cho" ? {} : { ketThuc: true }),
        },
        // Chỉ trạng thái kết thúc "xong" mới được ghi đè lên mục đã xong.
        { chiKhiChuaXong: trangThai !== "xong" },
      );
      if (key && trangThai !== "cho") await refreshRunCounts(key.runId).catch(() => undefined);

      await logRun({
        ...(out.documentId ? { documentId: out.documentId } : {}),
        step: def.queue,
        ...(out.route ? { route: out.route } : {}),
        status: out.skipped ? "skipped" : "ok",
        durationMs,
        ...(out.warnings ? { warnings: out.warnings } : {}),
      });
      await job.updateProgress({ giai_doan: stage, phan_tram: 100 }).catch(() => undefined);
      jl.info(out.skipped ? "Giai đoạn bỏ qua" : "Giai đoạn xong", {
        durationMs,
        ...(out.reason ? { reason: out.reason } : {}),
        ...(out.next !== undefined ? { next: out.next } : {}),
        ...(out.detail ?? {}),
      });
      return out;
    } catch (e) {
      const durationMs = Date.now() - started;
      const error = errText(e);
      await patchItem(key, {
        giaiDoan: stage,
        trangThai: "loi",
        loi: error,
        soLanThu: attempt,
        ketThuc: true,
      });
      if (key) await refreshRunCounts(key.runId).catch(() => undefined);
      await logRun({ step: def.queue, status: "error", error, durationMs });
      jl.error("Giai đoạn lỗi", { durationMs, error: error.split("\n")[0] });
      throw e; // BullMQ tự thử lại có lùi thời gian; không nuốt lỗi.
    }
  };
}
