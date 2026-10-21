/**
 * BỘ ĐIỀU PHỐI NẠP KHO (backfill).
 *
 * Đọc KHUNG CẤU TRÚC kho (`corpus_targets`, xem src/bull/frame.ts), tạo một đợt nạp
 * (`ingest_runs`) rồi đẩy job `discover` cho từng ô của khung — theo ĐỢT (wave) tuần tự
 * theo ưu tiên: đợt sau chỉ bắt đầu khi đợt trước đạt ngưỡng hoàn thành (mặc định 95%
 * số mục ở trạng thái `xong` hoặc `bo_qua`).
 *
 * Vì sao chia đợt: nạp cả kho là việc nhiều ngày. Nếu đẩy hết mọi thứ vào hàng đợi cùng
 * lúc thì văn bản nền (Hiến pháp, luật) lẫn với thông tư, và khi có sự cố không biết đang
 * dở ở đâu. Chia đợt cho phép dừng, kiểm tra, rồi chạy tiếp.
 *
 * DỪNG VÀ CHẠY TIẾP: chạy lại cùng lệnh (hoặc `--resume <runId>`) sẽ dùng lại đúng đợt
 * đang chạy, bỏ qua những ô đã đẩy job (ghi trong `ingest_runs.pham_vi.da_day`) và dựa
 * thêm vào jobId tất định của BullMQ để không tạo job trùng.
 */
import { QUEUES } from "@qdpl/queue";
import {
  type CorpusTargetRow,
  ensureCorpusTargets,
  listTargets,
  planDiscover,
  refreshCoverage,
} from "./bull/frame.ts";
import {
  countItems,
  createRun,
  findActiveRun,
  getRun,
  type RunCounts,
  type RunProgress,
  refreshRunCounts,
  runProgress,
  setRunExpected,
  setRunState,
  updateRunScope,
} from "./bull/ledger.ts";
import { add, snapshotAll } from "./bull/queues.ts";
import { log } from "./log.ts";

export interface BackfillOptions {
  /** Nhóm ô khung cần nạp (ha_tang_phap_ly, luat, nghi_dinh…). Bỏ trống là toàn bộ khung. */
  nhom?: string;
  /** Chỉ các ô khung này. */
  ma?: string[];
  /** Số ô khung tối đa lấy từ khung. */
  limit?: number;
  /** Số mục mỗi trang danh mục khi discover. */
  perPage?: number;
  /** Chạy tiếp một đợt đã có. */
  runId?: string;
  /** Ép tạo đợt mới thay vì dùng lại đợt đang chạy cùng tên. */
  moi?: boolean;
  /** Ngưỡng hoàn thành để sang đợt sau (0..1). */
  nguong?: number;
  /** Chờ từng đợt xong mới sang đợt sau. Tắt thì chỉ đẩy đợt đầu tiên rồi thoát. */
  cho?: boolean;
  pollMs?: number;
  /** Thời gian chờ tối đa cho một đợt. */
  waveTimeoutMs?: number;
  /** Đợt không nhúc nhích lâu hơn ngần này (và hàng đợi rỗng) thì dừng. */
  stallMs?: number;
  /** Chỉ in kế hoạch, không đẩy job. */
  dryRun?: boolean;
}

export const DEFAULT_NGUONG = 0.95;
const DEFAULT_POLL_MS = Number(process.env.BACKFILL_POLL_MS ?? 5_000);
const DEFAULT_WAVE_TIMEOUT_MS = Number(process.env.BACKFILL_WAVE_TIMEOUT_MS ?? 30 * 60_000);
const DEFAULT_STALL_MS = Number(process.env.BACKFILL_STALL_MS ?? 5 * 60_000);

export type WaveOutcome = "dat_nguong" | "het_gio" | "dung_vi_khong_tien_trien" | "chua_cho" | "bo_qua";

export interface WaveSummary {
  uu_tien: number;
  targets: string[];
  /** Số job discover thật sự đẩy lần này (ô đã đẩy trước đó không tính lại). */
  da_day: number;
  ty_le: number;
  ket_qua: WaveOutcome;
  giay: number;
}

export interface BackfillSummary {
  runId: string;
  ten: string;
  nhom: string;
  moi_tao: boolean;
  o_khung: number;
  dot: WaveSummary[];
  tong_job_da_day: number;
  tien_do?: RunProgress;
  do_phu: { target_ma: string; so_luong_co: number; so_luong_ky_vong: number | null; ty_le: number | null }[];
}

/**
 * Tỉ lệ hoàn thành RIÊNG của một đợt: so số mục kết thúc (xong + bỏ qua) tăng thêm
 * với số mục phát hiện thêm kể từ lúc đợt bắt đầu. Không dùng tỉ lệ toàn đợt nạp,
 * vì đợt trước đã gần 100% sẽ che mất đợt sau vừa mới bắt đầu.
 */
export function waveRatio(
  truoc: RunCounts,
  hienTai: RunCounts,
): { tong: number; xong: number; tyLe: number } {
  const tong = hienTai.tong - truoc.tong;
  const xong = hienTai.xong + hienTai.bo_qua - (truoc.xong + truoc.bo_qua);
  if (tong <= 0) return { tong: 0, xong: Math.max(0, xong), tyLe: 1 };
  return { tong, xong, tyLe: Math.min(1, Math.max(0, xong) / tong) };
}

/** Tổng số job còn đang chờ/chạy/hẹn giờ trên mọi hàng đợi. */
export async function queueBacklog(): Promise<number> {
  const snaps = await snapshotAll();
  return snaps.reduce((n, s) => n + s.cho + s.dang_chay + s.tri_hoan, 0);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface WaitWaveOptions {
  runId: string;
  truoc: RunCounts;
  nguong: number;
  pollMs: number;
  timeoutMs: number;
  stallMs: number;
}

/** Chờ một đợt đạt ngưỡng hoàn thành. */
export async function waitForWave(
  o: WaitWaveOptions,
): Promise<{ ket_qua: WaveOutcome; tyLe: number; tong: number }> {
  const han = Date.now() + o.timeoutMs;
  let lanCuoiDoi = Date.now();
  let mocTruoc = "";
  while (Date.now() < han) {
    const hienTai = await countItems(o.runId);
    const w = waveRatio(o.truoc, hienTai);
    const backlog = await queueBacklog();
    const moc = `${hienTai.tong}/${hienTai.xong}/${hienTai.loi}/${hienTai.bo_qua}/${backlog}`;
    if (moc !== mocTruoc) {
      mocTruoc = moc;
      lanCuoiDoi = Date.now();
      log.info("Tiến độ đợt", {
        runId: o.runId,
        phat_hien: w.tong,
        xong: w.xong,
        ty_le: Number(w.tyLe.toFixed(3)),
        hang_doi: backlog,
      });
    }
    if (w.tong > 0 && w.tyLe >= o.nguong) return { ket_qua: "dat_nguong", tyLe: w.tyLe, tong: w.tong };
    if (w.tong === 0 && backlog === 0 && Date.now() - lanCuoiDoi >= o.stallMs) {
      return { ket_qua: "dung_vi_khong_tien_trien", tyLe: 1, tong: 0 };
    }
    if (backlog === 0 && Date.now() - lanCuoiDoi >= o.stallMs) {
      return { ket_qua: "dung_vi_khong_tien_trien", tyLe: w.tyLe, tong: w.tong };
    }
    await sleep(o.pollMs);
  }
  const hienTai = await countItems(o.runId);
  const w = waveRatio(o.truoc, hienTai);
  return { ket_qua: "het_gio", tyLe: w.tyLe, tong: w.tong };
}

/** Gom ô khung thành các đợt theo mức ưu tiên. */
export function groupWaves(targets: CorpusTargetRow[]): { uuTien: number; targets: CorpusTargetRow[] }[] {
  const map = new Map<number, CorpusTargetRow[]>();
  for (const t of targets) {
    const arr = map.get(t.uu_tien) ?? [];
    arr.push(t);
    map.set(t.uu_tien, arr);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([uuTien, ts]) => ({ uuTien, targets: ts }));
}

export function runName(nhom: string | undefined): string {
  return `backfill:${nhom ?? "toan-khung"}`;
}

export async function backfill(opts: BackfillOptions = {}): Promise<BackfillSummary> {
  const nguong = opts.nguong ?? DEFAULT_NGUONG;
  const cho = opts.cho ?? true;

  let targets = await listTargets({
    ...(opts.nhom ? { nhom: opts.nhom } : {}),
    ...(opts.ma ? { ma: opts.ma } : {}),
    ...(opts.limit ? { limit: opts.limit } : {}),
  });
  if (!targets.length && !opts.ma) {
    // Khung trống -> nạp khung mặc định rồi đọc lại (chạy lần đầu không cần lệnh riêng).
    const seeded = await ensureCorpusTargets();
    log.info("Khung cấu trúc trống, đã nạp khung mặc định", seeded as unknown as Record<string, unknown>);
    targets = await listTargets({
      ...(opts.nhom ? { nhom: opts.nhom } : {}),
      ...(opts.limit ? { limit: opts.limit } : {}),
    });
  }
  if (!targets.length) {
    throw new Error(
      `Không có ô khung nào khớp (nhom=${opts.nhom ?? "*"}). Xem \`bull frame --list\` hoặc nạp khung bằng \`bull frame --seed\`.`,
    );
  }

  const ten = runName(opts.nhom);
  let moiTao = false;
  let run = opts.runId ? await getRun(opts.runId) : opts.moi ? undefined : await findActiveRun(ten);
  if (opts.runId && !run) throw new Error(`Không có đợt nạp ${opts.runId} để chạy tiếp`);
  if (!run) {
    const nguon = [...new Set(targets.map((t) => t.nguon))];
    const id = await createRun({
      ten,
      nguon: nguon.length === 1 ? nguon[0]! : "nhieu-nguon",
      phamVi: {
        nhom: opts.nhom ?? null,
        nguong,
        o_khung: targets.map((t) => t.ma),
        da_day: [],
        tao_luc: new Date().toISOString(),
      },
    });
    run = await getRun(id);
    moiTao = true;
    const kyVong = targets.reduce((n, t) => n + (t.so_luong_ky_vong ?? 0), 0);
    if (kyVong > 0) await setRunExpected(id, kyVong);
  }
  if (!run) throw new Error("Không tạo được đợt nạp");

  const runId = run.id;
  const scope = { ...(run.pham_vi ?? {}) } as Record<string, unknown>;
  const daDay = new Set<string>(Array.isArray(scope.da_day) ? (scope.da_day as string[]) : []);
  log.info(moiTao ? "Tạo đợt nạp mới" : "Chạy tiếp đợt nạp", {
    runId,
    ten,
    o_khung: targets.length,
    da_day: daDay.size,
  });

  const summary: BackfillSummary = {
    runId,
    ten,
    nhom: opts.nhom ?? "toan-khung",
    moi_tao: moiTao,
    o_khung: targets.length,
    dot: [],
    tong_job_da_day: 0,
    do_phu: [],
  };

  for (const wave of groupWaves(targets)) {
    const batDau = Date.now();
    const truoc = await countItems(runId);
    let daDayDot = 0;

    for (const t of wave.targets) {
      if (daDay.has(t.ma)) {
        log.info("Ô khung đã đẩy job từ trước, bỏ qua", { runId, ma: t.ma });
        continue;
      }
      const plan = planDiscover(t, { runId, ...(opts.perPage ? { limit: opts.perPage } : {}) });
      if (opts.dryRun) {
        log.info("(dry-run) sẽ đẩy job discover", { ma: t.ma, key: plan.key, ...plan.data });
      } else {
        const jobId = await add(QUEUES.discover, plan.data, { key: plan.key });
        log.info("Đã đẩy job discover", { ma: t.ma, jobId, nguon: t.nguon, loai: plan.data.loai ?? null });
        daDay.add(t.ma);
        scope.da_day = [...daDay];
        await updateRunScope(runId, scope);
      }
      daDayDot += 1;
      summary.tong_job_da_day += 1;
    }

    if (opts.dryRun || !cho) {
      summary.dot.push({
        uu_tien: wave.uuTien,
        targets: wave.targets.map((t) => t.ma),
        da_day: daDayDot,
        ty_le: 0,
        ket_qua: "chua_cho",
        giay: 0,
      });
      break; // không chờ thì không thể biết lúc nào được phép sang đợt sau
    }

    const r = await waitForWave({
      runId,
      truoc,
      nguong,
      pollMs: opts.pollMs ?? DEFAULT_POLL_MS,
      timeoutMs: opts.waveTimeoutMs ?? DEFAULT_WAVE_TIMEOUT_MS,
      stallMs: opts.stallMs ?? DEFAULT_STALL_MS,
    });
    summary.dot.push({
      uu_tien: wave.uuTien,
      targets: wave.targets.map((t) => t.ma),
      da_day: daDayDot,
      ty_le: Number(r.tyLe.toFixed(3)),
      ket_qua: r.ket_qua,
      giay: Math.round((Date.now() - batDau) / 1000),
    });
    await refreshRunCounts(runId);

    if (r.ket_qua !== "dat_nguong") {
      log.warn("Đợt chưa đạt ngưỡng — dừng ở đây, chạy lại lệnh để tiếp tục", {
        runId,
        uu_tien: wave.uuTien,
        ty_le: r.tyLe,
        nguong,
        ket_qua: r.ket_qua,
      });
      break;
    }
  }

  if (!opts.dryRun) {
    for (const t of targets) summary.do_phu.push(await refreshCoverage(t));
    await refreshRunCounts(runId);
    const tienDo = await runProgress(runId);
    if (tienDo) summary.tien_do = tienDo;
    const hetDot = summary.dot.length === groupWaves(targets).length;
    const dat = summary.dot.every((d) => d.ket_qua === "dat_nguong");
    if (cho && hetDot && dat) {
      await setRunState(runId, "hoan_thanh", "mọi đợt đạt ngưỡng");
      log.info("Đợt nạp hoàn thành", { runId });
    }
  }
  return summary;
}
