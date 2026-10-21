/**
 * Tài khoản khách (migration 0062): gộp tiến độ sang tài khoản thật và dọn khách lâu không dùng.
 *
 * Tạo khách, đổi tên và kiểm token nằm ở @qdpl/auth (khach.ts); tệp này chỉ lo dữ liệu học.
 *
 * Gộp: bảng lịch sử (phiên, lượt chơi, sổ XP…) chỉ đổi `account_id`. Bảng có khóa theo người (tiến
 * độ màn, câu sai, XP theo ngày…) thì hợp hai dòng theo quy tắc riêng của từng bảng, ghi vào dòng
 * của tài khoản thật; dòng của khách bị xóa theo tài khoản khách (ON DELETE CASCADE).
 *
 * XP lúc làm khách giữ `unit_id` rỗng: đơn vị là đơn vị TẠI LÚC nhận XP (diem-thuong.ts), và lúc đó
 * khách chưa thuộc đơn vị nào, nên mùa giải đơn vị không được cộng bù.
 *
 * GOP_TIEN_DO_BANG liệt kê mọi bảng có khóa ngoại tới `accounts` mà khách có thể có dữ liệu; test
 * so danh sách này với khóa ngoại thật trong CSDL để bảng mới thêm sau không bị quên.
 */
import { ghiNgayHoc, type TrangThaiChuoi } from "@qdpl/dao-tao";
import { sql, type Tx } from "./client.ts";
import { xetHuyHieu } from "./diem-thuong.ts";

/** Bảng có cột tham chiếu `accounts` được gộp ở gopTienDoKhach. */
export const GOP_TIEN_DO_BANG = [
  "enrollments",
  "practice_sessions",
  "wrong_questions",
  "xp_ledger",
  "daily_activity",
  "streaks",
  "account_badges",
  "game_progress",
  "game_scores",
  "audio_positions",
  "game_packs",
  "game_runs",
  "topic_stats",
  "game_level_progress",
] as const;

/** Số ngày khách không dùng phiên thì phiên hết tác dụng và tài khoản bị dọn. */
export const KHACH_NGAY_KHONG_HOAT_DONG = 30;

/** Ngày kiểu date của DB (Date nửa đêm UTC) về dạng YYYY-MM-DD. */
function chuoiNgay(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

/**
 * Chuyển toàn bộ tiến độ của khách `khachId` sang tài khoản `thatId`, trong giao dịch `tx` của người
 * gọi. Không xóa tài khoản khách: người gọi xóa sau khi gộp xong (cascade dọn dòng còn lại).
 */
export async function gopTienDoKhach(tx: Tx, khachId: string, thatId: string): Promise<void> {
  // Bảng lịch sử: mỗi dòng là một sự kiện riêng, không trùng khóa theo người.
  await tx`UPDATE practice_sessions SET account_id = ${thatId} WHERE account_id = ${khachId}`;
  await tx`UPDATE game_scores SET account_id = ${thatId} WHERE account_id = ${khachId}`;
  await tx`UPDATE game_packs SET account_id = ${thatId} WHERE account_id = ${khachId}`;
  await tx`UPDATE game_runs SET account_id = ${thatId} WHERE account_id = ${khachId}`;
  await tx`UPDATE xp_ledger SET account_id = ${thatId} WHERE account_id = ${khachId}`;

  await tx`
    INSERT INTO daily_activity (account_id, day, xp)
    SELECT ${thatId}, day, xp FROM daily_activity WHERE account_id = ${khachId}
    ON CONFLICT (account_id, day) DO UPDATE SET xp = daily_activity.xp + EXCLUDED.xp`;

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

  // Tiến độ màn và hồ sơ chủ đề: giữ kết quả tốt hơn, cộng số lần. LEAST/GREATEST bỏ qua NULL.
  await tx`
    INSERT INTO game_progress (account_id, level_id, best_ratio, stars, completed_at, updated_at)
    SELECT ${thatId}, level_id, best_ratio, stars, completed_at, updated_at
    FROM game_progress WHERE account_id = ${khachId}
    ON CONFLICT (account_id, level_id) DO UPDATE SET
      best_ratio = GREATEST(game_progress.best_ratio, EXCLUDED.best_ratio),
      stars = GREATEST(game_progress.stars, EXCLUDED.stars),
      completed_at = LEAST(game_progress.completed_at, EXCLUDED.completed_at),
      updated_at = GREATEST(game_progress.updated_at, EXCLUDED.updated_at)`;

  await tx`
    INSERT INTO game_level_progress (account_id, game_code, level, best_stars, best_score, plays, cleared_at, updated_at)
    SELECT ${thatId}, game_code, level, best_stars, best_score, plays, cleared_at, updated_at
    FROM game_level_progress WHERE account_id = ${khachId}
    ON CONFLICT (account_id, game_code, level) DO UPDATE SET
      best_stars = GREATEST(game_level_progress.best_stars, EXCLUDED.best_stars),
      best_score = GREATEST(game_level_progress.best_score, EXCLUDED.best_score),
      plays = game_level_progress.plays + EXCLUDED.plays,
      cleared_at = LEAST(game_level_progress.cleared_at, EXCLUDED.cleared_at),
      updated_at = GREATEST(game_level_progress.updated_at, EXCLUDED.updated_at)`;

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

  await tx`
    INSERT INTO account_badges (account_id, badge_code, awarded_at)
    SELECT ${thatId}, badge_code, awarded_at FROM account_badges WHERE account_id = ${khachId}
    ON CONFLICT (account_id, badge_code) DO UPDATE SET
      awarded_at = LEAST(account_badges.awarded_at, EXCLUDED.awarded_at)`;

  const best = await tinhLaiChuoi(tx, khachId, thatId);
  // Gộp số liệu có thể vừa đủ ngưỡng một huy hiệu mà riêng bên nào cũng chưa đạt.
  await xetHuyHieu(tx, thatId, best);
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
 * Chuỗi ngày học tính lại từ đầu trên các ngày học của cả hai (đã gộp vào daily_activity của tài
 * khoản thật), cùng luật với lúc ghi từng ngày. Trả chuỗi dài nhất để xét huy hiệu.
 */
async function tinhLaiChuoi(tx: Tx, khachId: string, thatId: string): Promise<number> {
  const cu = (await tx`
    SELECT best FROM streaks WHERE account_id IN (${khachId}, ${thatId}) FOR UPDATE`) as unknown as {
    best: number;
  }[];
  const ngay = (await tx`
    SELECT day FROM daily_activity WHERE account_id = ${thatId} AND xp > 0 ORDER BY day`) as unknown as {
    day: unknown;
  }[];
  if (!ngay.length) return Math.max(0, ...cu.map((r) => r.best));

  let s: TrangThaiChuoi | null = null;
  for (const r of ngay) s = ghiNgayHoc(s, chuoiNgay(r.day)!);
  const sau = s!;
  const best = Math.max(sau.best, ...cu.map((r) => r.best));
  await tx`
    INSERT INTO streaks (account_id, current, best, last_day, freezes_left, freeze_week, updated_at)
    VALUES (${thatId}, ${sau.current}, ${best}, ${sau.last_day}, ${sau.freezes_left}, ${sau.freeze_week}, now())
    ON CONFLICT (account_id) DO UPDATE SET
      current = EXCLUDED.current, best = EXCLUDED.best, last_day = EXCLUDED.last_day,
      freezes_left = EXCLUDED.freezes_left, freeze_week = EXCLUDED.freeze_week, updated_at = now()`;
  return best;
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
