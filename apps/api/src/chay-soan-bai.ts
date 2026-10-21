/**
 * Chạy việc soạn bài: qua hàng đợi khi có worker `soan-bai` đang nghe, không thì chạy ngay trong
 * tiến trình API.
 *
 * Cấu hình gọn (.do/app-gon.yaml, infra/vps-demo) không có worker, nên chỉ đẩy vào hàng đợi thì
 * việc nằm ở `cho` mãi. Chạy trong API không có cơ chế thử lại của BullMQ: việc lỗi ghi `loi` vào
 * sổ, người soạn bấm "Chạy tiếp" để chạy lại phần chưa xong. API khởi động lại giữa chừng cũng
 * dùng nút đó.
 *
 * Biến môi trường `SOAN_BAI_TRONG_API`: `1` luôn chạy trong API, `0` luôn đẩy hàng đợi, bỏ trống
 * thì tự dò worker.
 */

import { BUOC_SOAN_TU_DONG, sql, vieCSoanBaiTheoId } from "@qdpl/db";

export type CheDoChay = "hang_doi" | "trong_api";

/**
 * Đẩy việc vào hàng đợi soạn bài. Không nối được Redis (chưa cấu hình, hoặc quá 3 giây) thì
 * việc nằm ở trạng thái `cho`; yêu cầu không bị treo theo Redis.
 */
export async function dayViecSoanBai(jobId: string): Promise<boolean> {
  try {
    const { add, hasRedis, QUEUES } = await import("@qdpl/queue");
    if (!hasRedis()) return false;
    return await Promise.race([
      add(QUEUES.soanBai, { jobId }, { key: jobId }).then(() => true),
      new Promise<boolean>((r) => setTimeout(() => r(false), 3000)),
    ]);
  } catch {
    return false;
  }
}

/** Số việc con chạy cùng lúc khi soạn trong API; mỗi việc là một lời gọi mô hình. */
function soSongSong(): number {
  const n = Number(process.env.SOAN_BAI_SONG_SONG ?? 3);
  return Number.isFinite(n) && n >= 1 ? Math.min(8, Math.floor(n)) : 3;
}

/** Có worker nào đang nghe hàng đợi soạn bài không. Không nối được Redis trong 2 giây thì coi là không. */
export async function coWorkerSoanBai(): Promise<boolean> {
  if (process.env.SOAN_BAI_TRONG_API === "1") return false;
  try {
    const { getQueue, hasRedis, QUEUES } = await import("@qdpl/queue");
    if (!hasRedis()) return false;
    return await Promise.race([
      getQueue(QUEUES.soanBai)
        .getWorkers()
        .then((w) => w.length > 0),
      new Promise<boolean>((r) => setTimeout(() => r(false), 2000)),
    ]);
  } catch {
    return false;
  }
}

/** Việc đang chạy nền trong tiến trình này, để không chạy một việc hai lần. */
const dangChay = new Set<string>();

/** Chạy nền một hàm cho một việc; lỗi chỉ ghi log vì trạng thái việc đã nằm trong sổ. */
export function chayNen(jobId: string, lam: () => Promise<unknown>): boolean {
  if (dangChay.has(jobId)) return false;
  dangChay.add(jobId);
  void lam()
    .catch((e) => console.error(`[api] việc soạn bài ${jobId} lỗi:`, e))
    .finally(() => dangChay.delete(jobId));
  return true;
}

/**
 * Bắt đầu chạy một việc soạn bài theo đường phù hợp với cấu hình đang chạy. Trả `cho` khi phải đi
 * hàng đợi mà không đẩy được: việc nằm ở trạng thái `cho` tới khi có người bấm "Chạy tiếp".
 */
export async function khoiChayViecSoanBai(jobId: string): Promise<CheDoChay | "cho"> {
  if (process.env.SOAN_BAI_TRONG_API === "0" || (await coWorkerSoanBai())) {
    return (await dayViecSoanBai(jobId)) ? "hang_doi" : "cho";
  }
  chayNen(jobId, () => chayViecTrongApi(jobId));
  return "trong_api";
}

/** Bối cảnh giả cho phần việc của worker khi gọi ngoài BullMQ. */
const ctx = {
  progress: async () => {},
  log: {
    info: () => {},
    debug: () => {},
    warn: (m: string, d?: unknown) => console.warn(`[api] soạn bài: ${m}`, d ?? ""),
    error: (m: string, d?: unknown) => console.error(`[api] soạn bài: ${m}`, d ?? ""),
  },
} as never;

/**
 * Việc con còn phải chạy của một lần soạn tự động. Việc đang chạy dưới 10 phút thì bỏ qua: có
 * thể một lượt khác (worker, hoặc lượt trước của chính API) vẫn đang làm.
 */
async function viecConCanChay(parentId: string): Promise<string[]> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT id FROM authoring_jobs
    WHERE parent_id = ${parentId}::uuid
      AND (state IN ('cho', 'loi')
           OR (state = 'dang_chay' AND started_at < now() - interval '10 minutes'))
    ORDER BY created_at`;
  return rows.map((r) => r.id);
}

/**
 * Chạy một việc tới khi xong, kể cả mọi việc con nếu là việc cha soạn tự động. Gọi lại trên một
 * việc cha đã giao việc con thì chỉ chạy phần chưa xong. Lỗi của từng việc con không dừng các
 * việc còn lại.
 */
export async function chayViecTrongApi(jobId: string): Promise<void> {
  // Nạp lười: phần việc của worker kéo theo cả gói hàng đợi, chỉ cần khi thật sự chạy trong API.
  const { soanBaiStage } = await import("../../workers-ts/src/bull/workers/soan-bai.ts");
  const chayMot = (id: string) => soanBaiStage.handle({ data: { jobId: id } } as never, ctx);

  const viec = await vieCSoanBaiTheoId(jobId);
  if (!viec) return;
  if (viec.step !== BUOC_SOAN_TU_DONG) {
    await chayMot(jobId);
    return;
  }

  const { chaySoanTuDong } = await import("../../workers-ts/src/bull/workers/soan-tu-dong.ts");
  await chaySoanTuDong(viec);
  const hang = await viecConCanChay(viec.id);
  await Promise.all(
    Array.from({ length: soSongSong() }, async () => {
      for (let id = hang.shift(); id; id = hang.shift()) {
        await chayMot(id).catch((e) => console.error(`[api] việc soạn bài ${id} lỗi:`, e));
      }
    }),
  );
}
