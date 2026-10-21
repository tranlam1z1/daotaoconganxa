/**
 * Truy vấn cho việc SỐ HÓA do agent thực hiện (ke-hoach/05).
 *
 * Dùng chung cho hai phía: worker BullMQ tạo việc, còn MCP server (agent) nhận việc,
 * nộp kết quả từng cụm trang và chốt bản Markdown. Vì vậy các truy vấn nằm ở @qdpl/db
 * chứ không nằm trong một trong hai ứng dụng.
 */
import { sql } from "./client.ts";

export type TrangThaiViecSoHoa = "cho" | "dang_lam" | "cho_duyet" | "xong" | "loi" | "bo_qua";

export const NHAN_TRANG_THAI_VIEC: Record<TrangThaiViecSoHoa, string> = {
  cho: "chờ số hóa",
  dang_lam: "đang số hóa",
  cho_duyet: "chờ biên tập duyệt",
  xong: "đã xong",
  loi: "lỗi",
  bo_qua: "bỏ qua",
};

export interface SoHoaTaskRow {
  id: string;
  document_id: string;
  source_record_id: string | null;
  file_uri: string;
  file_hash: string | null;
  route: string;
  page_count: number | null;
  window_size: number;
  overlap: number;
  windows: Array<{ idx: number; tuTrang: number; denTrang: number; trangChongLan?: number }>;
  state: TrangThaiViecSoHoa;
  priority: number;
  claimed_by: string | null;
  claimed_at: Date | null;
  lease_until: Date | null;
  prompt_version: string;
  draft_uri: string | null;
  markdown_uri: string | null;
  version_id: string | null;
  quality: Record<string, unknown>;
  warnings: unknown[];
  error: string | null;
  run_id: string | null;
  parse_queued: boolean;
  created_at: Date;
  updated_at: Date;
  finished_at: Date | null;
}

export interface SoHoaWindowRow {
  id: string;
  task_id: string;
  idx: number;
  page_from: number;
  page_to: number;
  markdown: string;
  open_state: Record<string, unknown>;
  tables: unknown[];
  formulas: unknown[];
  figures: unknown[];
  corrections: unknown[];
  warnings: unknown[];
  unreadable_count: number;
  submitted_by: string | null;
  model: string | null;
  submitted_at: Date;
}

export interface TaoViecSoHoaInput {
  documentId: string;
  fileUri: string;
  sourceRecordId?: string | null;
  fileHash?: string | null;
  route?: string;
  pageCount?: number | null;
  windowSize?: number;
  overlap?: number;
  windows?: unknown[];
  draftUri?: string | null;
  promptVersion?: string;
  priority?: number;
  runId?: string | null;
}

/**
 * Tạo (hoặc làm mới) việc số hóa cho một tệp của một văn bản.
 * Idempotent theo (document_id, file_uri): worker chạy lại không sinh việc trùng, và
 * việc đang làm dở KHÔNG bị đặt lại về "chờ" (tránh mất công agent đã làm).
 */
export async function taoViecSoHoa(input: TaoViecSoHoaInput): Promise<SoHoaTaskRow> {
  const [row] = await sql`
    INSERT INTO sohoa_tasks (document_id, source_record_id, file_uri, file_hash, route, page_count,
                             window_size, overlap, windows, draft_uri, prompt_version, priority, run_id)
    VALUES (${input.documentId}, ${input.sourceRecordId ?? null}, ${input.fileUri}, ${input.fileHash ?? null},
            ${input.route ?? "pdf_anh"}, ${input.pageCount ?? null}, ${input.windowSize ?? 5},
            ${input.overlap ?? 1}, ${sql.json((input.windows ?? []) as never)}, ${input.draftUri ?? null},
            ${input.promptVersion ?? "v1"}, ${input.priority ?? 5}, ${input.runId ?? null})
    ON CONFLICT (document_id, file_uri) DO UPDATE SET
      route        = EXCLUDED.route,
      page_count   = EXCLUDED.page_count,
      window_size  = EXCLUDED.window_size,
      overlap      = EXCLUDED.overlap,
      windows      = EXCLUDED.windows,
      draft_uri    = COALESCE(EXCLUDED.draft_uri, sohoa_tasks.draft_uri),
      run_id       = COALESCE(EXCLUDED.run_id, sohoa_tasks.run_id),
      state        = CASE WHEN sohoa_tasks.state IN ('loi', 'bo_qua') THEN 'cho' ELSE sohoa_tasks.state END,
      error        = CASE WHEN sohoa_tasks.state = 'loi' THEN NULL ELSE sohoa_tasks.error END,
      updated_at   = now()
    RETURNING *`;
  return row as unknown as SoHoaTaskRow;
}

export async function layViecSoHoa(id: string): Promise<SoHoaTaskRow | undefined> {
  const [row] = await sql`SELECT * FROM sohoa_tasks WHERE id = ${id}`;
  return row as unknown as SoHoaTaskRow | undefined;
}

export interface NhanViecInput {
  /** Ai nhận việc — email của phiên MCP, để biết ai đang giữ. */
  nguoiNhan: string;
  /** Thời hạn giữ việc, hết hạn thì người khác nhận được. */
  hanPhut?: number;
  /** Nhận đúng việc này. */
  viecId?: string;
  /** Nhận việc của đúng văn bản này. */
  documentId?: string;
}

/**
 * Nhận một việc số hóa (khóa bằng FOR UPDATE SKIP LOCKED nên nhiều phiên chạy song song
 * không giẫm lên nhau). Việc quá hạn giữ, hoặc việc do chính mình đang giữ, đều nhận lại được.
 */
export async function nhanViecSoHoa(input: NhanViecInput): Promise<SoHoaTaskRow | undefined> {
  const han = Math.max(5, input.hanPhut ?? 120);
  const [row] = await sql`
    UPDATE sohoa_tasks SET
      state       = 'dang_lam',
      claimed_by  = ${input.nguoiNhan},
      claimed_at  = now(),
      lease_until = now() + make_interval(mins => ${han}),
      updated_at  = now()
    WHERE id = (
      SELECT t.id FROM sohoa_tasks t
      WHERE (
              t.state = 'cho'
              OR (t.state IN ('dang_lam', 'cho_duyet') AND (t.lease_until IS NULL OR t.lease_until < now()))
              OR (t.state = 'dang_lam' AND t.claimed_by = ${input.nguoiNhan})
            )
        AND (${input.viecId ?? null}::uuid IS NULL OR t.id = ${input.viecId ?? null}::uuid)
        AND (${input.documentId ?? null}::uuid IS NULL OR t.document_id = ${input.documentId ?? null}::uuid)
      ORDER BY t.priority DESC, t.created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *`;
  return row as unknown as SoHoaTaskRow | undefined;
}

export interface CapNhatViecSoHoa {
  state?: TrangThaiViecSoHoa;
  route?: string;
  pageCount?: number;
  windows?: unknown[];
  draftUri?: string | null;
  markdownUri?: string | null;
  versionId?: string | null;
  quality?: Record<string, unknown>;
  warnings?: unknown[];
  error?: string | null;
  parseQueued?: boolean;
  leaseUntil?: Date | null;
  finished?: boolean;
}

export async function capNhatViecSoHoa(
  id: string,
  patch: CapNhatViecSoHoa,
): Promise<SoHoaTaskRow | undefined> {
  const [row] = await sql`
    UPDATE sohoa_tasks SET
      state        = COALESCE(${patch.state ?? null}, state),
      route        = COALESCE(${patch.route ?? null}, route),
      page_count   = COALESCE(${patch.pageCount ?? null}, page_count),
      windows      = COALESCE(${patch.windows ? sql.json(patch.windows as never) : null}, windows),
      draft_uri    = COALESCE(${patch.draftUri ?? null}, draft_uri),
      markdown_uri = COALESCE(${patch.markdownUri ?? null}, markdown_uri),
      version_id   = COALESCE(${patch.versionId ?? null}, version_id),
      quality      = COALESCE(${patch.quality ? sql.json(patch.quality as never) : null}, quality),
      warnings     = COALESCE(${patch.warnings ? sql.json(patch.warnings as never) : null}, warnings),
      error        = ${patch.error === undefined ? sql`error` : patch.error},
      parse_queued = COALESCE(${patch.parseQueued ?? null}, parse_queued),
      lease_until  = ${patch.leaseUntil === undefined ? sql`lease_until` : patch.leaseUntil},
      finished_at  = CASE WHEN ${patch.finished ?? false} THEN now() ELSE finished_at END,
      updated_at   = now()
    WHERE id = ${id}
    RETURNING *`;
  return row as unknown as SoHoaTaskRow | undefined;
}

export interface GhiCuaSoInput {
  taskId: string;
  idx: number;
  pageFrom: number;
  pageTo: number;
  markdown: string;
  openState?: Record<string, unknown>;
  tables?: unknown[];
  formulas?: unknown[];
  figures?: unknown[];
  corrections?: unknown[];
  warnings?: unknown[];
  unreadableCount?: number;
  submittedBy?: string;
  model?: string;
}

/** Ghi kết quả một cụm trang. Nộp lại cùng cụm thì ghi đè (agent được sửa bài của mình). */
export async function ghiCuaSo(input: GhiCuaSoInput): Promise<SoHoaWindowRow> {
  const [row] = await sql`
    INSERT INTO sohoa_windows (task_id, idx, page_from, page_to, markdown, open_state, tables, formulas,
                               figures, corrections, warnings, unreadable_count, submitted_by, model)
    VALUES (${input.taskId}, ${input.idx}, ${input.pageFrom}, ${input.pageTo}, ${input.markdown},
            ${sql.json((input.openState ?? {}) as never)}, ${sql.json((input.tables ?? []) as never)},
            ${sql.json((input.formulas ?? []) as never)}, ${sql.json((input.figures ?? []) as never)},
            ${sql.json((input.corrections ?? []) as never)}, ${sql.json((input.warnings ?? []) as never)},
            ${input.unreadableCount ?? 0}, ${input.submittedBy ?? null}, ${input.model ?? null})
    ON CONFLICT (task_id, idx) DO UPDATE SET
      page_from = EXCLUDED.page_from,
      page_to   = EXCLUDED.page_to,
      markdown  = EXCLUDED.markdown,
      open_state = EXCLUDED.open_state,
      tables    = EXCLUDED.tables,
      formulas  = EXCLUDED.formulas,
      figures   = EXCLUDED.figures,
      corrections = EXCLUDED.corrections,
      warnings  = EXCLUDED.warnings,
      unreadable_count = EXCLUDED.unreadable_count,
      submitted_by = EXCLUDED.submitted_by,
      model     = EXCLUDED.model,
      submitted_at = now()
    RETURNING *`;
  return row as unknown as SoHoaWindowRow;
}

export async function layCacCuaSo(taskId: string): Promise<SoHoaWindowRow[]> {
  return (await sql`SELECT * FROM sohoa_windows WHERE task_id = ${taskId} ORDER BY idx`) as unknown as SoHoaWindowRow[];
}

export interface ViecSoHoaKemVanBan extends SoHoaTaskRow {
  urn: string;
  so_ky_hieu: string;
  title: string;
  doc_type: string;
  so_cua_so_da_nop: number;
}

export async function danhSachViecSoHoa(
  opts: { state?: TrangThaiViecSoHoa; limit?: number } = {},
): Promise<ViecSoHoaKemVanBan[]> {
  return (await sql`
    SELECT t.*, d.urn, d.so_ky_hieu, d.title, d.doc_type,
           (SELECT count(*)::int FROM sohoa_windows w WHERE w.task_id = t.id) AS so_cua_so_da_nop
    FROM sohoa_tasks t JOIN documents d ON d.id = t.document_id
    WHERE (${opts.state ?? null}::text IS NULL OR t.state = ${opts.state ?? null})
    ORDER BY t.priority DESC, t.created_at
    LIMIT ${Math.min(opts.limit ?? 50, 500)}`) as unknown as ViecSoHoaKemVanBan[];
}

export async function thongKeSoHoa(): Promise<{
  theoTrangThai: Record<string, number>;
  theoTuyen: Record<string, number>;
  soCuaSoDaNop: number;
  choDayParse: number;
}> {
  const tt = (await sql`SELECT state, count(*)::int AS n FROM sohoa_tasks GROUP BY 1`) as Array<{
    state: string;
    n: number;
  }>;
  const tuyen = (await sql`SELECT route, count(*)::int AS n FROM sohoa_tasks GROUP BY 1`) as Array<{
    route: string;
    n: number;
  }>;
  const [w] = (await sql`SELECT count(*)::int AS n FROM sohoa_windows`) as Array<{ n: number }>;
  const [p] = (await sql`
    SELECT count(*)::int AS n FROM sohoa_tasks WHERE state = 'xong' AND parse_queued = false`) as Array<{
    n: number;
  }>;
  return {
    theoTrangThai: Object.fromEntries(tt.map((r) => [r.state, r.n])),
    theoTuyen: Object.fromEntries(tuyen.map((r) => [r.route, r.n])),
    soCuaSoDaNop: w?.n ?? 0,
    choDayParse: p?.n ?? 0,
  };
}
