/**
 * Sách nói (docs/PLAN.md GĐ14): tệp âm thanh từng khối bài giảng và vị trí nghe của người học.
 *
 * Tệp nằm trong kho đối tượng; bảng chỉ giữ URI, thời lượng và băm lời đọc. Lời đọc và cách băm
 * nằm ở packages/dao-tao/src/sach-noi.ts.
 */
import { sql } from "./client.ts";

export interface AmThanhKhoiRow {
  lesson_id: string;
  block_id: string;
  uri: string;
  seconds: number;
  text_hash: string;
  ordinal: number;
}

/** Bài đã xuất bản (worker quét để dựng sách nói). */
export async function baiDaXuatBanChoSachNoi(): Promise<Array<{ id: string }>> {
  return await sql<Array<{ id: string }>>`
    SELECT l.id FROM lessons l JOIN courses c ON c.id = l.course_id
    WHERE l.status = 'xuat_ban' AND c.status = 'xuat_ban'
    ORDER BY c.slug, l.ordinal`;
}

/** Âm thanh đã dựng của một bài, theo thứ tự khối. */
export async function amThanhCuaBai(lessonId: string): Promise<AmThanhKhoiRow[]> {
  return await sql<AmThanhKhoiRow[]>`
    SELECT a.lesson_id, a.block_id, a.uri, a.seconds::float8 AS seconds, a.text_hash, b.ordinal
    FROM lesson_audio a JOIN lesson_blocks b ON b.id = a.block_id
    WHERE a.lesson_id = ${lessonId}::uuid
    ORDER BY b.ordinal`;
}

/** Tệp đã có cho đúng lời đọc này (ở bất kỳ bài nào): dùng lại, không đọc lại. */
export async function amThanhTheoBam(
  textHash: string,
): Promise<{ uri: string; seconds: number } | undefined> {
  const [row] = await sql<Array<{ uri: string; seconds: number }>>`
    SELECT uri, seconds::float8 AS seconds FROM lesson_audio WHERE text_hash = ${textHash} LIMIT 1`;
  return row;
}

export async function luuAmThanhKhoi(p: {
  lessonId: string;
  blockId: string;
  uri: string;
  seconds: number;
  textHash: string;
}): Promise<void> {
  await sql`
    INSERT INTO lesson_audio (lesson_id, block_id, uri, seconds, text_hash)
    VALUES (${p.lessonId}::uuid, ${p.blockId}::uuid, ${p.uri}, ${p.seconds}, ${p.textHash})
    ON CONFLICT (lesson_id, block_id) DO UPDATE SET
      uri = EXCLUDED.uri, seconds = EXCLUDED.seconds, text_hash = EXCLUDED.text_hash, created_at = now()`;
}

/** Bỏ âm thanh của khối không còn đọc (khối bị xóa, đổi sang loại không đọc, hết lời). */
export async function xoaAmThanhNgoai(lessonId: string, blockIdsGiuLai: string[]): Promise<number> {
  const rows = await sql`
    DELETE FROM lesson_audio
    WHERE lesson_id = ${lessonId}::uuid AND NOT (block_id = ANY(${blockIdsGiuLai}::uuid[]))
    RETURNING block_id`;
  return rows.length;
}

export interface ViTriNgheRow {
  block_id: string | null;
  offset_seconds: number;
  updated_at: Date;
}

export async function viTriNghe(accountId: string, lessonId: string): Promise<ViTriNgheRow | undefined> {
  const [row] = await sql<ViTriNgheRow[]>`
    SELECT block_id, offset_seconds::float8 AS offset_seconds, updated_at
    FROM audio_positions WHERE account_id = ${accountId}::uuid AND lesson_id = ${lessonId}::uuid`;
  return row;
}

export async function luuViTriNghe(p: {
  accountId: string;
  lessonId: string;
  blockId: string | null;
  offsetSeconds: number;
}): Promise<void> {
  await sql`
    INSERT INTO audio_positions (account_id, lesson_id, block_id, offset_seconds)
    VALUES (${p.accountId}::uuid, ${p.lessonId}::uuid, ${p.blockId}::uuid, ${p.offsetSeconds})
    ON CONFLICT (account_id, lesson_id) DO UPDATE SET
      block_id = EXCLUDED.block_id, offset_seconds = EXCLUDED.offset_seconds, updated_at = now()`;
}
