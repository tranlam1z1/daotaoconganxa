/** Bảng tra: hàng đợi -> giai đoạn xử lý. Dùng chung cho runner và test. */
import { QUEUES, type QueueName } from "@qdpl/queue";
import type { StageDef } from "./stage.ts";
import { consolidateStage } from "./workers/consolidate.ts";
import { convertStage } from "./workers/convert.ts";
import { discoverStage } from "./workers/discover.ts";
import { donKhachStage } from "./workers/don-khach.ts";
import { extractOpsStage } from "./workers/extract-ops.ts";
import { fetchStage } from "./workers/fetch.ts";
import { indexStage } from "./workers/index.ts";
import { ingestStage } from "./workers/ingest.ts";
import { mascotAnhStage } from "./workers/mascot-anh.ts";
import { muaGiaiStage } from "./workers/mua-giai.ts";
import { nhacHocStage } from "./workers/nhac-hoc.ts";
import { parseStage } from "./workers/parse.ts";
import { reconcileStage } from "./workers/reconcile.ts";
import { relationsStage } from "./workers/relations.ts";
import { sachNoiStage } from "./workers/sach-noi.ts";
import { soanBaiStage } from "./workers/soan-bai.ts";
import { sohoaStage } from "./workers/sohoa.ts";
import { thiHetGioStage } from "./workers/thi-het-gio.ts";

/** Mọi giai đoạn, theo đúng thứ tự của đường ống (ke-hoach/02 §4.1). */
export const STAGES: StageDef<QueueName>[] = [
  discoverStage,
  fetchStage,
  ingestStage,
  convertStage,
  // Số hóa PDF: worker chỉ dựng việc, agent đọc trang qua MCP (ke-hoach/05).
  // Cầu nối cũ sang services/docproc (Python) đã ngưng dùng — xem workers/docproc.ts.
  sohoaStage,
  parseStage,
  extractOpsStage,
  consolidateStage,
  relationsStage,
  indexStage,
  reconcileStage,
  // Hai giai đoạn của mô-đun đào tạo: soạn bài bằng AI và sinh ảnh nhân vật (ke-hoach/09-a, 09-b).
  // Chúng không nằm trong đường ống nạp kho — chạy độc lập, do người vận hành kích hoạt.
  soanBaiStage,
  mascotAnhStage,
  // Thi sát hạch: tự nộp lượt quá hạn, chạy lặp mỗi phút (docs/PLAN.md GĐ6).
  thiHetGioStage,
  // Nhắc học, thông báo đẩy: chạy lặp mỗi 15 phút (docs/PLAN.md GĐ15).
  nhacHocStage,
  // Sách nói: đọc trước bài giảng đã xuất bản, chạy lặp 6 giờ một lần (docs/PLAN.md GĐ14).
  sachNoiStage,
  // Mùa giải đơn vị: bắt đầu mùa, chốt tuần lúc 06:00 thứ Hai; chạy lặp mỗi giờ (docs/PLAN.md GĐ-G6).
  muaGiaiStage,
  // Dọn tài khoản khách bỏ không quá 30 ngày; chạy lặp 6 giờ một lần (migration 0062).
  donKhachStage,
] as StageDef<QueueName>[];

export const STAGE_BY_QUEUE = new Map<QueueName, StageDef<QueueName>>(STAGES.map((s) => [s.queue, s]));

/** Tên hàng đợi rút gọn (bỏ tiền tố "qdpl:") -> tên đầy đủ. */
export function resolveQueueName(name: string): QueueName {
  // Tên hàng đợi dùng dấu gạch ngang (BullMQ cấm dấu hai chấm), nhưng người dùng vẫn hay
  // gõ "qdpl:fetch" theo tài liệu cũ — chấp nhận cả hai cách viết.
  const rut = name.replace(/^qdpl[:-]/, "");
  const full = `qdpl-${rut}` as QueueName;
  if (!STAGE_BY_QUEUE.has(full)) {
    throw new Error(
      `Không có hàng đợi "${name}". Hỗ trợ: ${[...STAGE_BY_QUEUE.keys()].map((q) => q.replace("qdpl-", "")).join(", ")}`,
    );
  }
  return full;
}

export { QUEUES };
