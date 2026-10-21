/**
 * Giai đoạn 1 — PHÁT HIỆN: hỏi danh mục của nguồn xem có những văn bản nào,
 * ghi vào sổ cái `ingest_items` rồi đẩy job `fetch` cho từng mục.
 *
 * Phân trang: nếu nguồn trả về đủ một trang thì tự đẩy job `discover` cho trang kế tiếp,
 * nên một job ban đầu có thể quét hết cả danh mục mà không cần vòng lặp dài trong worker.
 */
import { QUEUES } from "@qdpl/queue";
import { getAdapter } from "../../crawler/adapters/index.ts";
import type { DiscoveredItem, DiscoverOptions } from "../../crawler/adapters/types.ts";
import { khopTuKhoa } from "../../crawler/tu-khoa.ts";
import { recordDiscovered, refreshRunCounts } from "../ledger.ts";
import { add, addBulk } from "../queues.ts";
import { defineStage } from "../stage.ts";

/** Chặn trên số trang tự đi tiếp, tránh cào vô hạn khi nguồn phân trang lạ. */
export const MAX_DISCOVER_PAGES = Number(process.env.BULL_DISCOVER_MAX_PAGES ?? 20);

/** Khóa job tất định cho một mục: cùng đợt + cùng nguồn + cùng sourceId = một job. */
export function fetchKey(runId: string | undefined, nguon: string, sourceId: string): string {
  return `${runId ?? "adhoc"}:${nguon}:${sourceId}`;
}

export const discoverStage = defineStage(QUEUES.discover, async (job, ctx) => {
  const { nguon, loai, since, limit, page = 1, runId, tuKhoa, loaiTru, toiDaTrang } = job.data;
  const adapter = getAdapter(nguon);
  const perPage = limit ?? 20;
  const maxPages = toiDaTrang ?? MAX_DISCOVER_PAGES;

  const opts: DiscoverOptions = { limit: perPage, page };
  if (loai) opts.type = loai;
  if (since) opts.since = since;

  const tho: DiscoveredItem[] = await adapter.discover(opts);
  // Ô khung theo lĩnh vực: chỉ giữ mục có tiêu đề khớp. Mục không có tiêu đề xem trước thì
  // bỏ (không tải "cho chắc" — mục đích của bộ lọc là không tải thứ ngoài lĩnh vực).
  const locTheoTieuDe = Boolean(tuKhoa?.length);
  const found = locTheoTieuDe ? tho.filter((d) => khopTuKhoa(d.preview?.title, tuKhoa, loaiTru)) : tho;
  await ctx.progress(
    40,
    locTheoTieuDe ? `đọc ${tho.length} mục, khớp ${found.length}` : `phát hiện ${found.length} mục`,
  );

  let moi = 0;
  if (runId && found.length) {
    moi = await recordDiscovered(
      runId,
      found.map((d) => ({
        nguon,
        sourceId: d.sourceId,
        url: d.url,
        ...(d.preview?.soKyHieu ? { soKyHieu: d.preview.soKyHieu } : {}),
      })),
    );
  }
  await ctx.progress(70, `ghi sổ ${moi} mục mới`);

  const daDay = await addBulk(
    QUEUES.fetch,
    found.map((d) => ({
      data: { ...(runId ? { runId } : {}), nguon, sourceId: d.sourceId, url: d.url },
      key: fetchKey(runId, nguon, d.sourceId),
    })),
  );

  // Trang đầy -> còn trang sau. Trang vơi -> hết danh mục. Xét số mục THÔ (trước lọc),
  // vì sau lọc trang nào cũng "vơi" và sẽ dừng quét sớm.
  let trangKeTiep: number | undefined;
  if (tho.length >= perPage && page < maxPages) {
    trangKeTiep = page + 1;
    await add(
      QUEUES.discover,
      { ...job.data, page: trangKeTiep },
      { key: `${runId ?? "adhoc"}:${nguon}:${loai ?? "all"}:p${trangKeTiep}` },
    );
  }

  if (runId) await refreshRunCounts(runId);

  return {
    next: daDay,
    detail: {
      nguon,
      loai: loai ?? null,
      page,
      doc: tho.length,
      phat_hien: found.length,
      moi,
      ...(trangKeTiep ? { trang_ke_tiep: trangKeTiep } : {}),
    },
  };
});
