/** Số liệu hàng đợi cho việc giám sát. */
import { allQueueNames, getQueue } from "./queues.ts";
import type { QueueName } from "./types.ts";

export interface QueueSnapshot {
  ten: QueueName;
  cho: number;
  dang_chay: number;
  hoan_thanh: number;
  that_bai: number;
  tri_hoan: number;
  tam_dung: boolean;
}

export async function snapshot(name: QueueName): Promise<QueueSnapshot> {
  const q = getQueue(name);
  const counts = await q.getJobCounts("waiting", "active", "completed", "failed", "delayed");
  return {
    ten: name,
    cho: counts.waiting ?? 0,
    dang_chay: counts.active ?? 0,
    hoan_thanh: counts.completed ?? 0,
    that_bai: counts.failed ?? 0,
    tri_hoan: counts.delayed ?? 0,
    tam_dung: await q.isPaused(),
  };
}

export async function snapshotAll(): Promise<QueueSnapshot[]> {
  return await Promise.all(allQueueNames().map(snapshot));
}

export interface FailedJobInfo {
  hang_doi: QueueName;
  id: string;
  ten: string;
  du_lieu: unknown;
  loi: string;
  so_lan_thu: number;
  luc: string;
}

/** Job hỏng của MỘT hàng đợi. */
export async function failuresOf(name: QueueName, limit = 20): Promise<FailedJobInfo[]> {
  const jobs = await getQueue(name).getFailed(0, limit);
  return jobs.map((j) => ({
    hang_doi: name,
    id: String(j.id),
    ten: j.name,
    du_lieu: j.data,
    loi: (j.failedReason ?? "").slice(0, 400),
    so_lan_thu: j.attemptsMade,
    luc: new Date(j.finishedOn ?? j.timestamp).toISOString(),
  }));
}

export async function recentFailures(limit = 20): Promise<FailedJobInfo[]> {
  const out: FailedJobInfo[] = [];
  for (const name of allQueueNames()) {
    const jobs = await getQueue(name).getFailed(0, limit);
    for (const j of jobs) {
      out.push({
        hang_doi: name,
        id: String(j.id),
        ten: j.name,
        du_lieu: j.data,
        loi: (j.failedReason ?? "").slice(0, 400),
        so_lan_thu: j.attemptsMade,
        luc: new Date(j.finishedOn ?? j.timestamp).toISOString(),
      });
    }
  }
  return out.sort((a, b) => (a.luc < b.luc ? 1 : -1)).slice(0, limit);
}

/** Thử lại toàn bộ job hỏng của một hàng đợi (hoặc tất cả). */
export async function retryFailed(name?: QueueName, limit = 1000): Promise<number> {
  const names = name ? [name] : allQueueNames();
  let n = 0;
  for (const q of names.map(getQueue)) {
    for (const job of await q.getFailed(0, limit)) {
      await job.retry();
      n++;
    }
  }
  return n;
}
