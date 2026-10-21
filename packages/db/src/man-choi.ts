/**
 * Tiến độ màn chơi (mô-đun M8, docs/GAME_DESIGN.md §2.4): `game_level_progress`, một dòng mỗi người, mỗi trò,
 * mỗi màn. Luật mở màn ở @qdpl/dao-tao (tro-choi/chung/man-choi.ts). Ghi tiến độ nằm trong giao dịch
 * kết thúc lượt (luot-choi.ts), nên lượt kết thúc hai lần không cộng lượt chơi hai lần.
 */
import { SAO_QUA_MAN } from "@qdpl/dao-tao";
import { sql, type Tx } from "./client.ts";

/** Số sao tốt nhất của từng màn của một người ở một trò. */
export async function saoTheoMan(accountId: string, gameCode: string): Promise<Map<number, number>> {
  const rows = (await sql`
    SELECT level, best_stars FROM game_level_progress WHERE account_id = ${accountId} AND game_code = ${gameCode}`) as any[];
  return new Map(rows.map((r) => [Number(r.level), Number(r.best_stars)]));
}

/** Ghi kết quả một lượt vào tiến độ màn, trong giao dịch của người gọi. */
export async function ghiTienDoManLuot(
  tx: Tx,
  inp: { accountId: string; gameCode: string; level: number; sao: number; diem: number; luc: Date },
): Promise<void> {
  const qua = inp.sao >= SAO_QUA_MAN;
  await tx`
    INSERT INTO game_level_progress (account_id, game_code, level, best_stars, best_score, plays, cleared_at, updated_at)
    VALUES (${inp.accountId}, ${inp.gameCode}, ${inp.level}, ${inp.sao}, ${inp.diem}, 1,
            ${qua ? inp.luc : null}, now())
    ON CONFLICT (account_id, game_code, level) DO UPDATE SET
      best_stars = GREATEST(game_level_progress.best_stars, EXCLUDED.best_stars),
      best_score = GREATEST(game_level_progress.best_score, EXCLUDED.best_score),
      plays = game_level_progress.plays + 1,
      cleared_at = COALESCE(game_level_progress.cleared_at, EXCLUDED.cleared_at),
      updated_at = now()`;
}
