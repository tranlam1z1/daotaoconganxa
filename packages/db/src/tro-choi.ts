/**
 * Truy vấn CSDL cho trò chơi (docs/PLAN.md GĐ10).
 *
 * Chỉ đọc và ghi; luật mở màn, sao, đồng hồ, ghép cặp và XP nằm ở packages/dao-tao/src/tro-choi/.
 * Phiên game là một dòng `practice_sessions` với `source = 'game:<mã>'`.
 */
import { sql, type Tx } from "./client.ts";
import type { NguonPhien } from "./luyen-tap.ts";

export type NguonGame = Extract<NguonPhien, `game:${string}`>;

/* ------------------------------------------------------------------ */
/* Màn                                                                 */
/* ------------------------------------------------------------------ */

export interface ManRow {
  id: string;
  topic_id: string;
  ordinal: number;
  question_count: number;
  pass_ratio: number;
}

/**
 * Bảo đảm chủ đề có đủ `soMan` màn (tạo màn còn thiếu). Không xóa màn thừa khi số câu giảm:
 * tiến độ đã có của người học gắn với màn đó.
 */
export async function damBaoMan(topicId: string, soMan: number, soCauMoiMan: number): Promise<ManRow[]> {
  if (soMan > 0) {
    await sql`
      INSERT INTO game_levels (topic_id, ordinal, question_count)
      SELECT ${topicId}, g, ${soCauMoiMan} FROM generate_series(1, ${soMan}) AS g
      ON CONFLICT (topic_id, ordinal) DO NOTHING`;
  }
  return await sql<ManRow[]>`
    SELECT id, topic_id, ordinal, question_count, pass_ratio::float AS pass_ratio
    FROM game_levels WHERE topic_id = ${topicId} AND ordinal <= ${soMan}
    ORDER BY ordinal`;
}

export async function manTheoId(id: string): Promise<ManRow | undefined> {
  const [row] = await sql<ManRow[]>`
    SELECT id, topic_id, ordinal, question_count, pass_ratio::float AS pass_ratio
    FROM game_levels WHERE id = ${id}`;
  return row;
}

export interface TienDoManRow {
  level_id: string;
  ordinal: number;
  best_ratio: number;
  stars: number;
  completed_at: Date | null;
}

export async function tienDoManCuaToi(accountId: string, topicId: string): Promise<TienDoManRow[]> {
  return await sql<TienDoManRow[]>`
    SELECT p.level_id, l.ordinal, p.best_ratio::float AS best_ratio, p.stars, p.completed_at
    FROM game_progress p JOIN game_levels l ON l.id = p.level_id
    WHERE p.account_id = ${accountId} AND l.topic_id = ${topicId}
    ORDER BY l.ordinal`;
}

/** Ghi tiến độ đã tính sẵn (giữ kết quả tốt nhất do luật `capNhatTienDoMan` quyết định). */
export async function ghiTienDoMan(
  tx: Tx,
  p: { accountId: string; levelId: string; best_ratio: number; stars: number; qua: boolean },
): Promise<void> {
  await tx`
    INSERT INTO game_progress (account_id, level_id, best_ratio, stars, completed_at)
    VALUES (${p.accountId}, ${p.levelId}, ${p.best_ratio}, ${p.stars}, ${p.qua ? new Date() : null})
    ON CONFLICT (account_id, level_id) DO UPDATE SET
      best_ratio = EXCLUDED.best_ratio,
      stars = EXCLUDED.stars,
      completed_at = COALESCE(game_progress.completed_at, EXCLUDED.completed_at),
      updated_at = now()`;
}

/** Tiến độ hiện tại của một màn, khóa dòng trong giao dịch để hai lần kết thúc không đè nhau. */
export async function tienDoManKhoa(
  tx: Tx,
  accountId: string,
  levelId: string,
): Promise<{ best_ratio: number; stars: number; qua: boolean } | null> {
  const [row] = await tx<Array<{ best_ratio: number; stars: number; completed_at: Date | null }>>`
    SELECT best_ratio::float AS best_ratio, stars, completed_at FROM game_progress
    WHERE account_id = ${accountId} AND level_id = ${levelId}
    FOR UPDATE`;
  return row ? { best_ratio: row.best_ratio, stars: row.stars, qua: Boolean(row.completed_at) } : null;
}

/* ------------------------------------------------------------------ */
/* Phiên game                                                          */
/* ------------------------------------------------------------------ */

export async function taoPhienGame(inp: {
  accountId: string;
  topicId: string | null;
  source: NguonGame;
  items: unknown[];
  gameLevelId?: string | null;
}): Promise<{ id: string; started_at: Date }> {
  const [row] = await sql<Array<{ id: string; started_at: Date }>>`
    INSERT INTO practice_sessions (account_id, topic_id, source, items, total, game_level_id)
    VALUES (${inp.accountId}, ${inp.topicId}, ${inp.source}, ${sql.json(inp.items as never)},
            ${inp.items.length}, ${inp.gameLevelId ?? null})
    RETURNING id, started_at`;
  return row!;
}

/** Phiên kèm màn đang chơi (nếu có), để kết thúc phiên cập nhật đúng màn. */
export async function manCuaPhien(sessionId: string): Promise<ManRow | undefined> {
  const [row] = await sql<ManRow[]>`
    SELECT l.id, l.topic_id, l.ordinal, l.question_count, l.pass_ratio::float AS pass_ratio
    FROM practice_sessions s JOIN game_levels l ON l.id = s.game_level_id
    WHERE s.id = ${sessionId}`;
  return row;
}

/** Chốt một ván ghép cặp (không đi qua practice_answers). Trả false khi ván đã chốt trước đó. */
export async function chotVanGhepCap(
  tx: Tx,
  p: { sessionId: string; correct: number; response: unknown },
): Promise<boolean> {
  const rows = await tx`
    UPDATE practice_sessions SET
      finished_at = now(),
      correct = ${p.correct},
      seconds_spent = extract(epoch FROM now() - started_at)::int,
      items = jsonb_set(items, '{0,tra_loi}', ${tx.json(p.response as never)}, true)
    WHERE id = ${p.sessionId} AND finished_at IS NULL
    RETURNING id`;
  return rows.length > 0;
}

/* ------------------------------------------------------------------ */
/* Điểm và kỷ lục                                                      */
/* ------------------------------------------------------------------ */

/** Ghi điểm một ván. Trả false khi phiên này đã có điểm (UNIQUE session_id). */
export async function ghiDiemGame(
  tx: Tx,
  p: {
    accountId: string;
    gameCode: "dua_thoi_gian" | "ghep_cap" | "doan_bien_bao" | "hoi_nhanh_giong_noi";
    sessionId: string;
    score: number;
  },
): Promise<boolean> {
  const rows = await tx`
    INSERT INTO game_scores (account_id, game_code, session_id, score)
    VALUES (${p.accountId}, ${p.gameCode}, ${p.sessionId}, ${p.score})
    ON CONFLICT (session_id) DO NOTHING
    RETURNING id`;
  return rows.length > 0;
}

/** Điểm cao nhất trước ván `truPhien` (để biết ván này có phá kỷ lục không). */
export async function kyLucTruoc(
  tx: Tx,
  accountId: string,
  gameCode: string,
  truPhien: string,
): Promise<number | null> {
  const [row] = await tx<Array<{ m: number | null }>>`
    SELECT max(score)::int AS m FROM game_scores
    WHERE account_id = ${accountId} AND game_code = ${gameCode} AND session_id <> ${truPhien}`;
  return row?.m ?? null;
}

export interface KyLucRow {
  ky_luc: number | null;
  so_van: number;
  gan_day: Array<{ score: number; played_at: Date }>;
}

export async function kyLucCuaToi(accountId: string, gameCode: string): Promise<KyLucRow> {
  const [tong] = await sql<Array<{ ky_luc: number | null; so_van: number }>>`
    SELECT max(score)::int AS ky_luc, count(*)::int AS so_van FROM game_scores
    WHERE account_id = ${accountId} AND game_code = ${gameCode}`;
  const ganDay = await sql<Array<{ score: number; played_at: Date }>>`
    SELECT score, played_at FROM game_scores
    WHERE account_id = ${accountId} AND game_code = ${gameCode}
    ORDER BY played_at DESC LIMIT 5`;
  return { ky_luc: tong?.ky_luc ?? null, so_van: tong?.so_van ?? 0, gan_day: ganDay };
}

/* ------------------------------------------------------------------ */
/* Nguồn nội dung                                                      */
/* ------------------------------------------------------------------ */

/** Câu đã duyệt cho đua thời gian: chỉ các loại cho phép, theo chủ đề (cả cây con) hoặc mọi chủ đề. */
export async function nguonDuaThoiGian(loai: readonly string[], topicId: string | null) {
  return await sql<
    Array<{
      id: string;
      version: number;
      topic_id: string;
      kind: string;
      level: string;
      stem: string;
      options: Record<string, unknown>;
      answer: Record<string, unknown>;
      explanation: string | null;
      citations: string[];
    }>
  >`
    WITH RECURSIVE cay AS (
      SELECT id FROM question_topics WHERE id = ${topicId}
      UNION ALL SELECT t.id FROM question_topics t JOIN cay ON t.parent_id = cay.id
    )
    SELECT q.id, q.version, COALESCE(q.topic_id::text, '') AS topic_id, q.kind, q.level, q.stem,
           q.options, q.answer, q.explanation, q.citations
    FROM questions q
    WHERE q.status = 'da_duyet' AND q.kind = ANY(${loai as string[]})
      AND (${topicId}::uuid IS NULL OR q.topic_id IN (SELECT id FROM cay))`;
}

/** Dòng mức phạt ĐÃ DUYỆT còn áp dụng tại `ngay`, cho game ghép cặp. */
export async function mucPhatChoGhepCap(ngay: string, xe: string | null) {
  return await sql<
    Array<{
      id: string;
      hanh_vi: string;
      loai_xe: string;
      fine_min: number;
      fine_max: number;
      citation_urn: string;
    }>
  >`
    SELECT id, behavior AS hanh_vi, vehicle AS loai_xe, fine_min::float AS fine_min, fine_max::float AS fine_max,
           citation_urn
    FROM violations
    WHERE status = 'da_duyet' AND effective_from <= ${ngay}::date
      AND (effective_to IS NULL OR effective_to > ${ngay}::date)
      AND (${xe}::text IS NULL OR vehicle = ${xe})`;
}
