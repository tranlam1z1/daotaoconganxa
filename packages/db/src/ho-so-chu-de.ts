/**
 * Hồ sơ điểm mạnh, điểm yếu theo chủ đề (docs/GAME_DESIGN.md §6.2). Luật ở
 * packages/dao-tao/src/ho-so-chu-de.ts; tệp này đọc và ghi `topic_stats`.
 *
 * `ghiKetQuaChuDe` gọi TRONG giao dịch của câu trả lời (luyện tập, nộp bài thi, bước trò chơi),
 * nên hồ sơ không lệch với kết quả đã ghi.
 */
import { capNhatHoSo, type DongHoSo, manhYeu } from "@qdpl/dao-tao";
import { sql, type Tx } from "./client.ts";

export async function ghiKetQuaChuDe(
  tx: Tx,
  p: { accountId: string; topicId: string | null | undefined; dung: boolean; luc?: Date },
): Promise<void> {
  if (!p.topicId) return;
  const [cu] = (await tx`
    SELECT attempts, correct, score_ema FROM topic_stats
    WHERE account_id = ${p.accountId} AND topic_id = ${p.topicId} FOR UPDATE`) as any[];
  const moi = capNhatHoSo(
    cu ? { attempts: cu.attempts, correct: cu.correct, score_ema: Number(cu.score_ema) } : null,
    p.dung,
  );
  // Chủ đề đã bị xóa giữa chừng thì bỏ qua (khóa ngoại), không làm hỏng câu trả lời.
  await tx`
    INSERT INTO topic_stats (account_id, topic_id, attempts, correct, score_ema, last_at)
    SELECT ${p.accountId}, ${p.topicId}, ${moi.attempts}, ${moi.correct}, ${moi.score_ema}, ${p.luc ?? new Date()}
    WHERE EXISTS (SELECT 1 FROM question_topics WHERE id = ${p.topicId})
    ON CONFLICT (account_id, topic_id) DO UPDATE SET
      attempts = EXCLUDED.attempts, correct = EXCLUDED.correct, score_ema = EXCLUDED.score_ema,
      last_at = GREATEST(topic_stats.last_at, EXCLUDED.last_at)`;
}

/** Hồ sơ của một người: chủ đề mạnh, yếu (tối đa 3 mỗi phía) và tổng số lượt đã tính. */
export async function hoSoChuDe(accountId: string) {
  const [dong, cay] = await Promise.all([
    sql`
      SELECT s.topic_id, t.name AS ten, t.parent_id, s.attempts, s.correct, s.score_ema::float8 AS score_ema
      FROM topic_stats s JOIN question_topics t ON t.id = s.topic_id
      WHERE s.account_id = ${accountId}` as unknown as Promise<DongHoSo[]>,
    sql`SELECT id AS topic_id, name AS ten, parent_id FROM question_topics` as unknown as Promise<
      Array<{ topic_id: string; ten: string; parent_id: string | null }>
    >,
  ]);
  return { ...manhYeu(dong, cay), tong_luot: dong.reduce((s, d) => s + d.attempts, 0) };
}

/**
 * Tính lại toàn bộ hồ sơ từ lịch sử (luyện tập, bài thi đã nộp, bước trò chơi), theo đúng thứ tự
 * thời gian. Dùng khi đổi công thức hoặc sau khi nạp dữ liệu cũ. Trả số câu trả lời đã tính.
 */
export async function tinhLaiHoSoChuDe(accountId?: string): Promise<number> {
  return (await sql.begin(async (tx) => {
    const loc = accountId ? tx`AND account_id = ${accountId}` : tx``;
    await tx`DELETE FROM topic_stats WHERE true ${loc}`;
    const rows = (await tx`
      SELECT account_id, topic_id, dung, luc FROM (
        SELECT s.account_id, q.topic_id::text AS topic_id, a.correct AS dung, a.created_at AS luc
        FROM practice_answers a
        JOIN practice_sessions s ON s.id = a.session_id
        JOIN questions q ON q.id = a.question_id
        UNION ALL
        SELECT t.account_id, q.topic_id::text, e.correct, t.submitted_at
        FROM exam_answers e
        JOIN exam_attempts t ON t.id = e.attempt_id
        JOIN questions q ON q.id = e.question_id
        WHERE t.status = 'da_nop' AND e.correct IS NOT NULL
        UNION ALL
        SELECT r.account_id, st.topic_id::text, st.correct, st.answered_at
        FROM game_run_steps st JOIN game_runs r ON r.id = st.run_id
        WHERE st.correct IS NOT NULL
      ) x
      WHERE topic_id IS NOT NULL AND topic_id <> '' ${loc}
      ORDER BY luc`) as any[];
    for (const r of rows) {
      await ghiKetQuaChuDe(tx, { accountId: r.account_id, topicId: r.topic_id, dung: r.dung, luc: r.luc });
    }
    return rows.length;
  })) as number;
}
