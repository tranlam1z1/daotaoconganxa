/**
 * Cầu nối tới lớp hàng đợi dùng chung.
 *
 * Trước đây file này là LỚP ĐỆM đổi dấu ":" thành "-" trong tên hàng đợi, vì
 * `packages/queue` đặt tên "qdpl:discover" mà BullMQ từ chối dấu hai chấm
 * ("Queue name cannot contain :"). Lỗi đó đã được sửa tận gốc ở packages/queue
 * (tên nay là "qdpl-discover", jobId cũng không còn dấu hai chấm), nên file này
 * chỉ còn tái xuất để các module hiện có không phải đổi đường dẫn nhập.
 */
export {
  type AddOptions,
  add,
  addBulk,
  allQueueNames,
  closeQueues,
  drainAll,
  type FailedJobInfo,
  failuresOf,
  getQueue,
  getQueueEvents,
  jobId,
  pauseAll,
  type QueueSnapshot,
  recentFailures,
  resumeAll,
  retryFailed,
  snapshot,
  snapshotAll,
} from "@qdpl/queue";

/** Tên hàng đợi dùng cho BullMQ. Nay trùng luôn tên logic, không cần chuyển đổi. */
export function bullName(name: string): string {
  return name;
}

/** Giữ tên cũ cho tương thích; sinh jobId tất định. */
export { jobId as safeJobId } from "@qdpl/queue";
