/**
 * Tài khoản khách (migration 0062): gộp tiến độ sang tài khoản thật và dọn khách lâu không dùng.
 *
 * Tạo khách, đổi tên và kiểm token nằm ở @qdpl/auth (khach.ts); tệp này chỉ lo dữ liệu học.
 *
 * Gộp: bảng lịch sử (phiên luyện tập…) chỉ đổi `account_id`. Bảng có khóa theo người (câu sai, ngày
 * học…) thì hợp hai dòng theo quy tắc riêng của từng bảng, ghi vào dòng của tài khoản thật; dòng
 * của khách bị xóa theo tài khoản khách (ON DELETE CASCADE).
 *
 * GOP_TIEN_DO_BANG liệt kê mọi bảng có khóa ngoại tới `accounts` mà khách có thể có dữ liệu; test
 * so danh sách này với khóa ngoại thật trong CSDL để bảng mới thêm sau không bị quên.
 */
import { sql, type Tx } from "./client.ts";

/** Bảng có cột tham chiếu `accounts` được gộp ở gopTienDoKhach. */
export const GOP_TIEN_DO_BANG = [
  "enrollments",
  "practice_sessions",
  "wrong_questions",
  "daily_activity",
  "audio_positions",
  "topic_stats",
] as const;

/** Số ngày khách không dùng phiên thì phiên hết tác dụng và tài khoản bị dọn. */
export const KHACH_NGAY_KHONG_HOAT_DONG = 30;

/**
 * Chuyển toàn bộ tiến độ của khách `khachId` sang tài khoản `thatId`, trong giao dịch `tx` của người
 * gọi. Không xóa tài khoản khách: người gọi xóa sau khi gộp xong (cascade dọn dòng còn lại).
 */
export async function gopTienDoKhach(tx: Tx, khachId: string, thatId: string): Promise<void> {
  // Bảng lịch sử: mỗi dòng là một sự kiện riêng, không trùng khóa theo người.
  await tx`UPDATE practice_sessions SET account_id = ${thatId} WHERE account_id = ${khachId}`;

  // Ngày có học: mỗi ngày một dòng, giữ dòng của tài khoản thật nếu đã có.
  await tx`
    INSERT INTO daily_activity (account_id, day, xp)
    SELECT ${thatId}, day, xp FROM daily_activity WHERE account_id = ${khachId}
    ON CONFLICT (account_id, day) DO NOTHING`;

  // Câu sai: còn sai ở một bên là còn trong danh sách.
  await tx`
    INSERT INTO wrong_questions (account_id, question_id, wrong_count, correct_streak, last_wrong_at, cleared_at)
    SELECT ${thatId}, question_id, wrong_count, correct_streak, last_wrong_at, cleared_at
    FROM wrong_questions WHERE account_id = ${khachId}
    ON CONFLICT (account_id, question_id) DO UPDATE SET
      wrong_count = wrong_questions.wrong_count + EXCLUDED.wrong_count,
      correct_streak = LEAST(wrong_questions.correct_streak, EXCLUDED.correct_streak),
      last_wrong_at = GREATEST(wrong_questions.last_wrong_at, EXCLUDED.last_wrong_at),
      cleared_at = CASE
        WHEN wrong_questions.cleared_at IS NULL OR EXCLUDED.cleared_at IS NULL THEN NULL
        ELSE GREATEST(wrong_questions.cleared_at, EXCLUDED.cleared_at)
      END`;

  // Điểm trung bình trượt: lấy trung bình theo số lần làm của hai bên.
  await tx`
    INSERT INTO topic_stats (account_id, topic_id, attempts, correct, score_ema, last_at)
    SELECT ${thatId}, topic_id, attempts, correct, score_ema, last_at
    FROM topic_stats WHERE account_id = ${khachId}
    ON CONFLICT (account_id, topic_id) DO UPDATE SET
      attempts = topic_stats.attempts + EXCLUDED.attempts,
      correct = topic_stats.correct + EXCLUDED.correct,
      score_ema = CASE
        WHEN topic_stats.attempts + EXCLUDED.attempts = 0 THEN topic_stats.score_ema
        ELSE (topic_stats.score_ema * topic_stats.attempts + EXCLUDED.score_ema * EXCLUDED.attempts)
             / (topic_stats.attempts + EXCLUDED.attempts)
      END,
      last_at = GREATEST(topic_stats.last_at, EXCLUDED.last_at)`;

  // Vị trí nghe sách nói: giữ chỗ nghe gần nhất.
  await tx`
    INSERT INTO audio_positions (account_id, lesson_id, block_id, offset_seconds, updated_at)
    SELECT ${thatId}, lesson_id, block_id, offset_seconds, updated_at
    FROM audio_positions WHERE account_id = ${khachId}
    ON CONFLICT (account_id, lesson_id) DO UPDATE SET
      block_id = EXCLUDED.block_id, offset_seconds = EXCLUDED.offset_seconds, updated_at = EXCLUDED.updated_at
    WHERE EXCLUDED.updated_at > audio_positions.updated_at`;

  await gopGhiDanh(tx, khachId, thatId);
}

/**
 * Ghi danh chuyên đề. Chuyên đề chỉ khách học thì chuyển nguyên ghi danh. Chuyên đề cả hai cùng học
 * thì chuyển dữ liệu con của ghi danh khách sang ghi danh thật; ghi danh khách bị xóa theo tài khoản.
 */
async function gopGhiDanh(tx: Tx, khachId: string, thatId: string): Promise<void> {
  await tx`
    UPDATE enrollments g SET account_id = ${thatId}
    WHERE g.account_id = ${khachId}
      AND NOT EXISTS (SELECT 1 FROM enrollments t WHERE t.account_id = ${thatId} AND t.course_id = g.course_id)`;

  const cap = (await tx`
    SELECT g.id AS ghi_danh_khach, t.id AS ghi_danh_that
    FROM enrollments g JOIN enrollments t ON t.course_id = g.course_id AND t.account_id = ${thatId}
    WHERE g.account_id = ${khachId}`) as unknown as { ghi_danh_khach: string; ghi_danh_that: string }[];

  for (const { ghi_danh_khach: g, ghi_danh_that: t } of cap) {
    await tx`
      UPDATE enrollments e SET
        state = CASE WHEN k.state = 'hoan_thanh' THEN 'hoan_thanh' ELSE e.state END,
        finished_at = LEAST(e.finished_at, k.finished_at),
        started_at = LEAST(e.started_at, k.started_at),
        last_seen_at = GREATEST(e.last_seen_at, k.last_seen_at)
      FROM enrollments k WHERE e.id = ${t} AND k.id = ${g}`;

    await tx`
      INSERT INTO lesson_progress (enrollment_id, lesson_id, state, seconds_spent, last_block_ordinal, score,
                                   started_at, finished_at, updated_at)
      SELECT ${t}, lesson_id, state, seconds_spent, last_block_ordinal, score, started_at, finished_at, updated_at
      FROM lesson_progress WHERE enrollment_id = ${g}
      ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
        state = CASE
          WHEN 'xong' IN (lesson_progress.state, EXCLUDED.state) THEN 'xong'
          WHEN 'dang_hoc' IN (lesson_progress.state, EXCLUDED.state) THEN 'dang_hoc'
          ELSE lesson_progress.state
        END,
        seconds_spent = lesson_progress.seconds_spent + EXCLUDED.seconds_spent,
        last_block_ordinal = GREATEST(lesson_progress.last_block_ordinal, EXCLUDED.last_block_ordinal),
        score = GREATEST(lesson_progress.score, EXCLUDED.score),
        started_at = LEAST(lesson_progress.started_at, EXCLUDED.started_at),
        finished_at = LEAST(lesson_progress.finished_at, EXCLUDED.finished_at),
        updated_at = GREATEST(lesson_progress.updated_at, EXCLUDED.updated_at)`;

    await tx`
      INSERT INTO mastery (enrollment_id, skill_id, p_known, attempts, correct, updated_at)
      SELECT ${t}, skill_id, p_known, attempts, correct, updated_at FROM mastery WHERE enrollment_id = ${g}
      ON CONFLICT (enrollment_id, skill_id) DO UPDATE SET
        p_known = CASE WHEN EXCLUDED.updated_at > mastery.updated_at THEN EXCLUDED.p_known ELSE mastery.p_known END,
        attempts = mastery.attempts + EXCLUDED.attempts,
        correct = mastery.correct + EXCLUDED.correct,
        updated_at = GREATEST(mastery.updated_at, EXCLUDED.updated_at)`;

    // Thẻ ôn tập trùng mục thì giữ thẻ của tài khoản thật (lịch ôn đang chạy).
    await tx`
      UPDATE srs_cards g SET enrollment_id = ${t}
      WHERE g.enrollment_id = ${g}
        AND NOT EXISTS (SELECT 1 FROM srs_cards t
                        WHERE t.enrollment_id = ${t} AND t.ref_kind = g.ref_kind AND t.ref_id = g.ref_id)`;

    await tx`UPDATE attempts SET enrollment_id = ${t} WHERE enrollment_id = ${g}`;
    await tx`UPDATE learning_events SET enrollment_id = ${t} WHERE enrollment_id = ${g}`;
    await tx`UPDATE certificates SET enrollment_id = ${t} WHERE enrollment_id = ${g}`;
    await tx`UPDATE mascot_events SET enrollment_id = ${t} WHERE enrollment_id = ${g}`;
  }
}

/**
 * Xóa khách không dùng phiên quá KHACH_NGAY_KHONG_HOAT_DONG ngày, cùng mọi tiến độ (cascade).
 * Trả số tài khoản đã xóa. Chạy định kỳ ở worker `qdpl-don-khach`.
 */
export async function donTaiKhoanKhach(now: Date = new Date()): Promise<number> {
  const rows = (await sql`
    DELETE FROM accounts a
    WHERE a.la_khach
      AND a.created_at < ${now}::timestamptz - (${KHACH_NGAY_KHONG_HOAT_DONG} * interval '1 day')
      AND NOT EXISTS (
        SELECT 1 FROM sessions s
        WHERE s.account_id = a.id AND s.revoked_at IS NULL
          AND COALESCE(s.last_used_at, s.created_at)
              > ${now}::timestamptz - (${KHACH_NGAY_KHONG_HOAT_DONG} * interval '1 day'))
    RETURNING a.id`) as any[];
  return rows.length;
}
