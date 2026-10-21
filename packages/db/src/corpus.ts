/**
 * Khung cấu trúc kho văn bản và đối soát độ đầy đủ.
 *
 * Việc nạp kho chỉ đáng tin khi trả lời được câu hỏi "còn thiếu gì", chứ không chỉ
 * "đã nạp bao nhiêu". Khung (`corpus_targets`) mô tả kho ĐÁNG LẼ phải có gì; đối soát
 * (`reconcile`) so khung với thực tế trong CSDL và ghi lại độ phủ.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "./client.ts";

const ROOT = join(import.meta.dir, "..", "..", "..");

export interface CorpusTarget {
  ma: string;
  nhom: string;
  uu_tien: number;
  doc_type: string | null;
  co_quan: string | null;
  nam_tu: number | null;
  nam_den: number | null;
  chi_con_hieu_luc: boolean;
  nguon: string;
  so_luong_ky_vong: number | null;
  ghi_chu: string | null;
  /** Lọc theo tiêu đề ở bước phát hiện (ô khung theo lĩnh vực). Rỗng = lấy cả loại. */
  tu_khoa?: string[];
  loai_tru?: string[];
}

interface KhungFile {
  o: Array<Partial<CorpusTarget> & { ma: string; nhom: string; uu_tien: number }>;
}

/** Nạp khung từ content/khung-van-ban.json vào bảng corpus_targets. */
export async function loadCorpusFramework(file = "content/khung-van-ban.json"): Promise<number> {
  const raw = await readFile(join(ROOT, file), "utf8");
  const data = JSON.parse(raw) as KhungFile;
  let n = 0;
  for (const o of data.o) {
    await sql`
      INSERT INTO corpus_targets (ma, nhom, uu_tien, doc_type, co_quan, nam_tu, nam_den,
                                  chi_con_hieu_luc, nguon, so_luong_ky_vong, ghi_chu, tu_khoa, loai_tru, updated_at)
      VALUES (${o.ma}, ${o.nhom}, ${o.uu_tien}, ${o.doc_type ?? null}, ${o.co_quan ?? null},
              ${o.nam_tu ?? null}, ${o.nam_den ?? null}, ${o.chi_con_hieu_luc ?? true},
              ${o.nguon ?? "congbao"}, ${o.so_luong_ky_vong ?? null}, ${o.ghi_chu ?? null},
              ${o.tu_khoa ?? []}::text[], ${o.loai_tru ?? []}::text[], now())
      ON CONFLICT (ma) DO UPDATE SET
        nhom = EXCLUDED.nhom, uu_tien = EXCLUDED.uu_tien, doc_type = EXCLUDED.doc_type,
        co_quan = EXCLUDED.co_quan, nam_tu = EXCLUDED.nam_tu, nam_den = EXCLUDED.nam_den,
        chi_con_hieu_luc = EXCLUDED.chi_con_hieu_luc, nguon = EXCLUDED.nguon,
        so_luong_ky_vong = COALESCE(EXCLUDED.so_luong_ky_vong, corpus_targets.so_luong_ky_vong),
        ghi_chu = EXCLUDED.ghi_chu, tu_khoa = EXCLUDED.tu_khoa, loai_tru = EXCLUDED.loai_tru,
        updated_at = now()`;
    n++;
  }
  return n;
}

export async function listTargets(nhom?: string): Promise<CorpusTarget[]> {
  const rows = nhom
    ? await sql`SELECT * FROM corpus_targets WHERE nhom = ${nhom} ORDER BY uu_tien`
    : await sql`SELECT * FROM corpus_targets ORDER BY uu_tien`;
  return rows as unknown as CorpusTarget[];
}

/** Đếm số văn bản trong kho khớp một ô của khung. */
export async function countForTarget(t: CorpusTarget): Promise<number> {
  const [row] = (await sql`
    SELECT count(*)::int AS c FROM documents d
    WHERE (${t.doc_type}::text IS NULL OR d.doc_type = ${t.doc_type})
      AND (${t.co_quan}::text IS NULL OR d.issuer_name ILIKE ${t.co_quan ? `%${t.co_quan}%` : ""})
      AND (${t.nam_tu}::int IS NULL OR extract(year from d.issued_date) >= ${t.nam_tu})
      AND (${t.nam_den}::int IS NULL OR extract(year from d.issued_date) <= ${t.nam_den})
      AND (${t.chi_con_hieu_luc} = false OR d.status IN ('con_hieu_luc','het_hieu_luc_mot_phan','ngung_hieu_luc'))
      AND (cardinality(${t.tu_khoa ?? []}::text[]) = 0
           OR EXISTS (SELECT 1 FROM unnest(${t.tu_khoa ?? []}::text[]) k WHERE d.title ILIKE '%' || k || '%'))
      AND NOT EXISTS (SELECT 1 FROM unnest(${t.loai_tru ?? []}::text[]) k WHERE d.title ILIKE '%' || k || '%')
      AND d.is_draft = false`) as any[];
  return Number(row?.c ?? 0);
}

export interface CoverageRow {
  target_ma: string;
  nhom: string;
  uu_tien: number;
  so_luong_co: number;
  so_luong_ky_vong: number | null;
  ty_le: number | null;
  ghi_chu: string | null;
}

/**
 * Đối soát toàn bộ khung: đếm thực tế, tính độ phủ, ghi vào corpus_coverage.
 * Ô chưa biết số lượng kỳ vọng thì ty_le để trống — không bịa ra tỷ lệ.
 */
export async function reconcileCorpus(nhom?: string): Promise<CoverageRow[]> {
  const targets = await listTargets(nhom);
  const out: CoverageRow[] = [];
  for (const t of targets) {
    const co = await countForTarget(t);
    const kyVong = t.so_luong_ky_vong;
    const tyLe = kyVong && kyVong > 0 ? Math.min(1, co / kyVong) : null;
    await sql`
      INSERT INTO corpus_coverage (target_ma, so_luong_co, so_luong_ky_vong, ty_le, cap_nhat_luc)
      VALUES (${t.ma}, ${co}, ${kyVong}, ${tyLe}, now())
      ON CONFLICT (target_ma) DO UPDATE SET
        so_luong_co = EXCLUDED.so_luong_co,
        so_luong_ky_vong = EXCLUDED.so_luong_ky_vong,
        ty_le = EXCLUDED.ty_le,
        cap_nhat_luc = now()`;
    out.push({
      target_ma: t.ma,
      nhom: t.nhom,
      uu_tien: t.uu_tien,
      so_luong_co: co,
      so_luong_ky_vong: kyVong,
      ty_le: tyLe,
      ghi_chu: t.ghi_chu,
    });
  }
  return out;
}

/** Cập nhật số lượng kỳ vọng của một ô sau khi đếm được từ danh mục của nguồn. */
export async function setExpected(ma: string, soLuong: number): Promise<void> {
  await sql`UPDATE corpus_targets SET so_luong_ky_vong = ${soLuong}, updated_at = now() WHERE ma = ${ma}`;
}

export interface RunProgress {
  id: string;
  ten: string;
  nguon: string;
  trang_thai: string;
  da_phat_hien: number;
  da_nap: number;
  that_bai: number;
  bo_qua: number;
  theo_giai_doan: Record<string, number>;
  ty_le_hoan_thanh: number;
}

/** Tiến độ của một đợt nạp, gồm phân bố theo giai đoạn. */
export async function runProgress(runId: string): Promise<RunProgress | undefined> {
  const [run] = (await sql`SELECT * FROM ingest_runs WHERE id = ${runId}`) as any[];
  if (!run) return undefined;
  const stages = (await sql`
    SELECT giai_doan, count(*)::int AS c FROM ingest_items WHERE run_id = ${runId} GROUP BY 1`) as any[];
  const [done] = (await sql`
    SELECT count(*)::int AS xong,
           (SELECT count(*)::int FROM ingest_items WHERE run_id = ${runId}) AS tong
    FROM ingest_items WHERE run_id = ${runId} AND trang_thai IN ('xong','bo_qua')`) as any[];
  const tong = Number(done?.tong ?? 0);
  return {
    id: run.id,
    ten: run.ten,
    nguon: run.nguon,
    trang_thai: run.trang_thai,
    da_phat_hien: run.da_phat_hien,
    da_nap: run.da_nap,
    that_bai: run.that_bai,
    bo_qua: run.bo_qua,
    theo_giai_doan: Object.fromEntries(stages.map((s) => [s.giai_doan, s.c])),
    ty_le_hoan_thanh: tong ? Number(done.xong) / tong : 0,
  };
}

export async function activeRuns(): Promise<Array<Record<string, unknown>>> {
  return (await sql`
    SELECT id, ten, nguon, trang_thai, da_phat_hien, da_nap, that_bai, bat_dau
    FROM ingest_runs WHERE trang_thai = 'dang_chay' ORDER BY bat_dau DESC`) as unknown as Array<
    Record<string, unknown>
  >;
}
