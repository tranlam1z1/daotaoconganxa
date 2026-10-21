/**
 * Sổ cái nạp kho: bảng `ingest_runs` (đợt nạp) và `ingest_items` (từng văn bản).
 * Xem packages/db/migrations/0004_ingest.sql.
 *
 * Vì sao cần sổ cái riêng thay vì chỉ nhìn hàng đợi Redis: BullMQ xóa job đã xong
 * sau 24 giờ, còn việc nạp kho kéo dài nhiều ngày và phải ĐỐI SOÁT được — mỗi mục
 * nguồn công bố phải có đúng một dòng với trạng thái cuối cùng rõ ràng.
 *
 * LƯU Ý: cột jsonb (`pham_vi`, `thieu_mau`) PHẢI ghi bằng `sql.json()`,
 * không dùng JSON.stringify (postgres.js tự tuần tự hóa; mã hóa hai lần gây hỏng dữ liệu).
 */
import { sql } from "@qdpl/db";
import type { Stage } from "@qdpl/queue";

/** Trạng thái của một mục trong sổ cái. */
export type ItemState = "cho" | "dang_chay" | "xong" | "loi" | "bo_qua";

/** Trạng thái của một đợt nạp. */
export type RunState = "dang_chay" | "hoan_thanh" | "that_bai" | "da_dung";

export interface IngestRunRow {
  id: string;
  ten: string;
  nguon: string;
  pham_vi: Record<string, unknown>;
  trang_thai: RunState;
  tong_du_kien: number | null;
  da_phat_hien: number;
  da_nap: number;
  that_bai: number;
  bo_qua: number;
  ghi_chu: string | null;
  bat_dau: Date;
  ket_thuc: Date | null;
}

export interface IngestItemRow {
  id: string;
  run_id: string;
  nguon: string;
  source_id: string;
  url: string | null;
  so_ky_hieu: string | null;
  document_urn: string | null;
  giai_doan: string;
  trang_thai: ItemState;
  so_lan_thu: number;
  loi: string | null;
  job_id: string | null;
  bat_dau: Date | null;
  ket_thuc: Date | null;
}

/* ------------------------------------------------------------------ */
/* Đợt nạp                                                             */
/* ------------------------------------------------------------------ */

export interface CreateRunInput {
  ten: string;
  nguon: string;
  phamVi?: Record<string, unknown>;
  tongDuKien?: number;
  ghiChu?: string;
}

export async function createRun(input: CreateRunInput): Promise<string> {
  const [row] = await sql`
    INSERT INTO ingest_runs (ten, nguon, pham_vi, tong_du_kien, ghi_chu)
    VALUES (${input.ten}, ${input.nguon}, ${sql.json((input.phamVi ?? {}) as never)},
            ${input.tongDuKien ?? null}, ${input.ghiChu ?? null})
    RETURNING id`;
  return (row as { id: string }).id;
}

export async function getRun(runId: string): Promise<IngestRunRow | undefined> {
  const [row] = await sql`SELECT * FROM ingest_runs WHERE id = ${runId}`;
  return row as IngestRunRow | undefined;
}

/**
 * Đợt nạp đang chạy gần nhất khớp tên (để chạy lại cùng một lệnh backfill
 * không tạo đợt trùng).
 */
export async function findActiveRun(ten: string): Promise<IngestRunRow | undefined> {
  const [row] = await sql`
    SELECT * FROM ingest_runs
    WHERE ten = ${ten} AND trang_thai = 'dang_chay'
    ORDER BY bat_dau DESC LIMIT 1`;
  return row as IngestRunRow | undefined;
}

/** Ghi đè phạm vi (jsonb) — dùng để nhớ những ô khung đã đẩy job, phục vụ resume. */
export async function updateRunScope(runId: string, phamVi: Record<string, unknown>): Promise<void> {
  await sql`UPDATE ingest_runs SET pham_vi = ${sql.json(phamVi as never)} WHERE id = ${runId}`;
}

export async function setRunState(runId: string, trangThai: RunState, ghiChu?: string): Promise<void> {
  const ketThuc = trangThai === "dang_chay" ? null : new Date();
  await sql`
    UPDATE ingest_runs
    SET trang_thai = ${trangThai},
        ghi_chu = COALESCE(${ghiChu ?? null}, ghi_chu),
        ket_thuc = ${ketThuc}
    WHERE id = ${runId}`;
}

export async function setRunExpected(runId: string, tongDuKien: number): Promise<void> {
  await sql`UPDATE ingest_runs SET tong_du_kien = ${tongDuKien} WHERE id = ${runId}`;
}

/* ------------------------------------------------------------------ */
/* Mục trong đợt nạp                                                   */
/* ------------------------------------------------------------------ */

export interface DiscoveredRow {
  nguon: string;
  sourceId: string;
  url?: string;
  soKyHieu?: string;
}

/**
 * Ghi các mục vừa phát hiện. Idempotent nhờ UNIQUE (run_id, nguon, source_id):
 * chạy lại cùng một job discover không nhân đôi dòng.
 * Trả về số dòng MỚI thật sự được thêm.
 */
export async function recordDiscovered(runId: string, rows: DiscoveredRow[]): Promise<number> {
  if (!rows.length) return 0;
  const values = rows.map((r) => ({
    run_id: runId,
    nguon: r.nguon,
    source_id: r.sourceId,
    url: r.url ?? null,
    so_ky_hieu: r.soKyHieu ?? null,
    giai_doan: "phat_hien" as const,
    trang_thai: "cho" as const,
  }));
  const inserted = await sql`
    INSERT INTO ingest_items ${sql(values, "run_id", "nguon", "source_id", "url", "so_ky_hieu", "giai_doan", "trang_thai")}
    ON CONFLICT (run_id, nguon, source_id) DO NOTHING
    RETURNING id`;
  return inserted.length;
}

export interface ItemPatch {
  giaiDoan?: Stage;
  trangThai?: ItemState;
  /** Lý do lỗi; `null` để xóa lỗi cũ khi thử lại. */
  loi?: string | null;
  jobId?: string;
  soLanThu?: number;
  documentUrn?: string;
  url?: string;
  soKyHieu?: string;
  /** Đặt bat_dau = now(). */
  batDau?: boolean;
  /** Đặt ket_thuc = now() (hoặc null nếu mục quay lại chạy). */
  ketThuc?: boolean | null;
}

function toColumns(p: ItemPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.giaiDoan !== undefined) out.giai_doan = p.giaiDoan;
  if (p.trangThai !== undefined) out.trang_thai = p.trangThai;
  if (p.loi !== undefined) out.loi = p.loi === null ? null : p.loi.slice(0, 4000);
  if (p.jobId !== undefined) out.job_id = p.jobId;
  if (p.soLanThu !== undefined) out.so_lan_thu = p.soLanThu;
  if (p.documentUrn !== undefined) out.document_urn = p.documentUrn;
  if (p.url !== undefined) out.url = p.url;
  if (p.soKyHieu !== undefined) out.so_ky_hieu = p.soKyHieu;
  if (p.batDau) out.bat_dau = new Date();
  if (p.ketThuc === true) out.ket_thuc = new Date();
  if (p.ketThuc === null) out.ket_thuc = null;
  return out;
}

export interface PatchOptions {
  /**
   * Không hạ cấp mục ĐÃ XONG.
   * Cần vì các nhánh phụ (`relations`, `extract-ops`, `consolidate`) có thể chạy SAU
   * bước lập chỉ mục; nếu không chặn, chúng sẽ kéo mục đã hoàn tất về lại "chờ".
   */
  chiKhiChuaXong?: boolean;
}

/** Cập nhật mục theo khóa nguồn. Trả về số dòng đã đổi (0 nếu mục không thuộc đợt nào). */
export async function patchItemBySource(
  runId: string,
  nguon: string,
  sourceId: string,
  patch: ItemPatch,
  opts: PatchOptions = {},
): Promise<number> {
  const cols = toColumns(patch);
  if (!Object.keys(cols).length) return 0;
  const rows = await sql`
    UPDATE ingest_items SET ${sql(cols)}
    WHERE run_id = ${runId} AND nguon = ${nguon} AND source_id = ${sourceId}
      ${opts.chiKhiChuaXong ? sql`AND trang_thai <> 'xong'` : sql``}
    RETURNING id`;
  return rows.length;
}

/**
 * Cập nhật mục theo URN văn bản — các giai đoạn sau `ingest` chỉ biết URN.
 * Một văn bản có thể xuất hiện ở nhiều nguồn trong cùng đợt, nên cập nhật tất cả.
 */
export async function patchItemByUrn(
  runId: string,
  documentUrn: string,
  patch: ItemPatch,
  opts: PatchOptions = {},
): Promise<number> {
  const cols = toColumns(patch);
  if (!Object.keys(cols).length) return 0;
  const rows = await sql`
    UPDATE ingest_items SET ${sql(cols)}
    WHERE run_id = ${runId} AND document_urn = ${documentUrn}
      ${opts.chiKhiChuaXong ? sql`AND trang_thai <> 'xong'` : sql``}
    RETURNING id`;
  return rows.length;
}

export async function getItem(
  runId: string,
  nguon: string,
  sourceId: string,
): Promise<IngestItemRow | undefined> {
  const [row] = await sql`
    SELECT * FROM ingest_items
    WHERE run_id = ${runId} AND nguon = ${nguon} AND source_id = ${sourceId}`;
  return row as IngestItemRow | undefined;
}

/* ------------------------------------------------------------------ */
/* Tiến độ                                                             */
/* ------------------------------------------------------------------ */

export interface RunCounts {
  tong: number;
  cho: number;
  dang_chay: number;
  xong: number;
  loi: number;
  bo_qua: number;
}

export const EMPTY_COUNTS: RunCounts = { tong: 0, cho: 0, dang_chay: 0, xong: 0, loi: 0, bo_qua: 0 };

/**
 * Tỉ lệ hoàn thành của một đợt/một đợt con: mục ở trạng thái `xong` HOẶC `bo_qua`
 * đều tính là đã xử lý xong (bỏ qua là kết luận cuối cùng, không phải việc dở dang).
 * Đợt rỗng coi như hoàn thành 100% để không chặn đợt kế tiếp.
 */
export function completionRatio(c: Pick<RunCounts, "tong" | "xong" | "bo_qua">): number {
  if (c.tong <= 0) return 1;
  return (c.xong + c.bo_qua) / c.tong;
}

export async function countItems(runId: string): Promise<RunCounts> {
  const rows = (await sql`
    SELECT trang_thai, count(*)::int AS n FROM ingest_items
    WHERE run_id = ${runId} GROUP BY trang_thai`) as { trang_thai: ItemState; n: number }[];
  const out: RunCounts = { ...EMPTY_COUNTS };
  for (const r of rows) {
    out.tong += r.n;
    out[r.trang_thai] = r.n;
  }
  return out;
}

/** Đếm lại và ghi số liệu tổng hợp vào `ingest_runs`. */
export async function refreshRunCounts(runId: string): Promise<RunCounts> {
  const c = await countItems(runId);
  await sql`
    UPDATE ingest_runs
    SET da_phat_hien = ${c.tong}, da_nap = ${c.xong}, that_bai = ${c.loi}, bo_qua = ${c.bo_qua}
    WHERE id = ${runId}`;
  return c;
}

export interface RunProgress extends RunCounts {
  runId: string;
  ten: string;
  trangThai: RunState;
  tyLe: number;
  theoGiaiDoan: { giai_doan: string; trang_thai: string; n: number }[];
}

export async function runProgress(runId: string): Promise<RunProgress | undefined> {
  const run = await getRun(runId);
  if (!run) return undefined;
  const c = await countItems(runId);
  const theoGiaiDoan = (await sql`
    SELECT giai_doan, trang_thai, count(*)::int AS n FROM ingest_items
    WHERE run_id = ${runId} GROUP BY giai_doan, trang_thai
    ORDER BY giai_doan, trang_thai`) as { giai_doan: string; trang_thai: string; n: number }[];
  return { runId, ten: run.ten, trangThai: run.trang_thai, ...c, tyLe: completionRatio(c), theoGiaiDoan };
}

/** Các đợt đang chạy, mới nhất trước. */
export async function activeRuns(limit = 5): Promise<IngestRunRow[]> {
  return (await sql`
    SELECT * FROM ingest_runs WHERE trang_thai = 'dang_chay'
    ORDER BY bat_dau DESC LIMIT ${limit}`) as IngestRunRow[];
}
