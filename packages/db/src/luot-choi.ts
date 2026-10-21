/**
 * Lượt chơi trên khung trò chơi chung (docs/PLAN.md GĐ-G0, docs/GAME_DESIGN.md §2).
 *
 * Chỉ đọc và ghi. Luật (sinh lượt, chấm, giờ, tổng kết, XP) nằm ở packages/dao-tao/src/tro-choi.
 * `game_runs.items` có ĐÁP ÁN (ảnh chụp để chấm), nên hàm trả lượt chỉ dùng ở máy chủ; route
 * người chơi tự lọc ra phần đề trước khi gửi đi.
 *
 * Chống cộng trùng:
 *  - một bước chỉ ghi một lần (khóa chính run_id + ordinal; client_id UNIQUE cho bước offline);
 *  - lượt chỉ kết thúc một lần (`status = 'dang_choi'` trong điều kiện UPDATE, khóa FOR UPDATE);
 *  - XP qua `congXp`, khóa (game:<mã>, id lượt) trong xp_ledger.
 */
import { type BuocLuot, capNhatCauSai, ngayVietNam, tongKetLuot, xpLuotChoi } from "@qdpl/dao-tao";
import { sql } from "./client.ts";
import { congXp } from "./diem-thuong.ts";
import { ghiKetQuaChuDe } from "./ho-so-chu-de.ts";
import { capNhatCauSaiTrongGiaoDich } from "./luyen-tap.ts";
import { ghiTienDoManLuot } from "./man-choi.ts";

/* ------------------------------------------------------------------ */
/* Bảng đăng ký trò chơi                                               */
/* ------------------------------------------------------------------ */

export interface TroChoiRow {
  code: string;
  name: string;
  description: string | null;
  offline_ok: boolean;
  enabled: boolean;
  ordinal: number;
  config: Record<string, unknown>;
  engine: "luot_choi" | "cu";
}

export async function danhSachTroChoiDb(opts: { chiDangBat?: boolean } = {}): Promise<TroChoiRow[]> {
  return await sql<TroChoiRow[]>`
    SELECT code, name, description, offline_ok, enabled, ordinal, config, engine FROM games
    WHERE ${opts.chiDangBat ? sql`enabled` : sql`true`}
    ORDER BY ordinal, code`;
}

export async function troChoiTheoMa(code: string): Promise<TroChoiRow | undefined> {
  const [r] = await sql<TroChoiRow[]>`
    SELECT code, name, description, offline_ok, enabled, ordinal, config, engine FROM games WHERE code = ${code}`;
  return r;
}

export async function datBatTroChoi(code: string, enabled: boolean): Promise<boolean> {
  const r = await sql`UPDATE games SET enabled = ${enabled}, updated_at = now() WHERE code = ${code}`;
  return r.count > 0;
}

/* ------------------------------------------------------------------ */
/* Nguồn nội dung                                                      */
/* ------------------------------------------------------------------ */

const COT_CAU_HOI = sql`q.id, q.version, COALESCE(q.topic_id::text, '') AS topic_id, q.kind, q.level, q.stem,
                        q.options, q.answer, q.explanation, q.citations, q.image_uris`;

/**
 * Câu hỏi ngân hàng ĐÃ DUYỆT làm nguồn cho trò chơi. `chiOffline` chỉ lấy câu được phép dùng
 * offline (gói offline). Sắp theo mã để gói offline có thứ tự ổn định.
 */
export async function nguonCauHoiTroChoi(opts: {
  loai: readonly string[];
  chiOffline?: boolean;
  gioiHan?: number;
}): Promise<unknown[]> {
  return (await sql`
    SELECT ${COT_CAU_HOI} FROM questions q
    WHERE q.status = 'da_duyet' AND q.kind = ANY(${opts.loai as string[]})
      AND ${opts.chiOffline ? sql`q.offline_ok` : sql`true`}
    ORDER BY q.code
    LIMIT ${opts.gioiHan ?? 2000}`) as unknown as unknown[];
}

/** Trạng thái hiện tại của các câu hỏi (để biết câu nào đã bị gỡ duyệt sau khi tải gói). */
export async function trangThaiCauHoi(
  ids: string[],
): Promise<Map<string, { status: string; version: number }>> {
  if (!ids.length) return new Map();
  const rows = (await sql`
    SELECT id, status, version FROM questions WHERE id = ANY(${ids}::uuid[])`) as any[];
  return new Map(
    rows.map((r) => [r.id as string, { status: r.status as string, version: r.version as number }]),
  );
}

/* ------------------------------------------------------------------ */
/* Lượt                                                                */
/* ------------------------------------------------------------------ */

export type TrangThaiLuot = "dang_choi" | "xong" | "het_gio" | "bo_do";

export interface LuotChoiRow {
  id: string;
  game_code: string;
  account_id: string;
  unit_id: string | null;
  seed: string;
  items: BuocLuot[];
  step_opened_at: Record<string, string>;
  status: TrangThaiLuot;
  started_at: Date;
  deadline_at: Date | null;
  finished_at: Date | null;
  played_at: Date;
  score: number | null;
  bonus: number | null;
  max_score: number | null;
  stars: number | null;
  xp: number | null;
  offline: boolean;
  client_id: string | null;
  pack_id: string | null;
  /** Màn của lượt (trò có màn, GĐ-T1); null với trò không có màn. */
  level: number | null;
}

const COT_LUOT = sql`id, game_code, account_id, unit_id, seed, items, step_opened_at, status, started_at,
                     deadline_at, finished_at, played_at, score::float8 AS score, bonus::float8 AS bonus,
                     max_score::float8 AS max_score, stars, xp, offline, client_id, pack_id, level`;

export async function taoLuotChoi(inp: {
  gameCode: string;
  accountId: string;
  seed: string;
  items: BuocLuot[];
  deadlineAt?: Date | null;
  level?: number | null;
}): Promise<LuotChoiRow> {
  const [row] = await sql<LuotChoiRow[]>`
    INSERT INTO game_runs (game_code, account_id, unit_id, seed, items, deadline_at, level)
    VALUES (${inp.gameCode}, ${inp.accountId}, (SELECT unit_id FROM accounts WHERE id = ${inp.accountId}),
            ${inp.seed}, ${sql.json(inp.items as never)}, ${inp.deadlineAt ?? null}, ${inp.level ?? null})
    RETURNING ${COT_LUOT}`;
  return row!;
}

export async function luotChoi(id: string): Promise<LuotChoiRow | undefined> {
  const [row] = await sql<LuotChoiRow[]>`SELECT ${COT_LUOT} FROM game_runs WHERE id = ${id}`;
  return row;
}

export interface BuocDaChoiRow {
  ordinal: number;
  response: unknown;
  correct: boolean | null;
  points: number;
  bonus: number;
  max_points: number;
  timed_out: boolean;
  elapsed_ms: number | null;
  answered_at: Date;
}

export async function buocDaChoi(runId: string): Promise<BuocDaChoiRow[]> {
  return await sql<BuocDaChoiRow[]>`
    SELECT ordinal, response, correct, points::float8 AS points, bonus::float8 AS bonus,
           max_points::float8 AS max_points, timed_out, elapsed_ms, answered_at
    FROM game_run_steps WHERE run_id = ${runId} ORDER BY ordinal`;
}

/**
 * Ghi thời điểm đề của bước được gửi cho người chơi, nếu chưa ghi. Trả thời điểm đã ghi (lần mở
 * ĐẦU TIÊN): tải lại trang không làm đồng hồ của bước chạy lại từ đầu.
 */
export async function moBuoc(runId: string, thuTu: number, luc: Date = new Date()): Promise<Date> {
  const khoa = String(thuTu);
  const [r] = (await sql`
    UPDATE game_runs SET step_opened_at = CASE
        WHEN jsonb_exists(step_opened_at, ${khoa}) THEN step_opened_at
        ELSE jsonb_set(step_opened_at, ARRAY[${khoa}]::text[], to_jsonb(${luc.toISOString()}::text))
      END
    WHERE id = ${runId}
    RETURNING step_opened_at ->> ${khoa} AS luc`) as any[];
  return new Date(r?.luc ?? luc);
}

export interface GhiBuocInput {
  runId: string;
  accountId: string;
  buoc: BuocLuot;
  moLuc: Date | null;
  traLoiLuc: Date;
  thoiGianMs: number | null;
  response: unknown;
  dung: boolean | null;
  diem: number;
  thuong: number;
  hetGio: boolean;
  clientId?: string | null;
}

/**
 * Ghi một bước đã chấm và cập nhật những gì đi kèm, trong một giao dịch: danh sách câu sai (bước
 * là câu hỏi ngân hàng), hồ sơ chủ đề. Chỉ ghi khi lượt còn đang chơi.
 *
 * Trả `"da_tra_loi"` khi bước đã được ghi (hoặc client_id đã dùng), `"luot_da_xong"` khi lượt đã
 * kết thúc; người gọi báo 409, không chấm hai lần.
 */
export async function ghiBuoc(inp: GhiBuocInput): Promise<"ok" | "da_tra_loi" | "luot_da_xong"> {
  return (await sql.begin(async (tx) => {
    const [luot] = (await tx`SELECT status FROM game_runs WHERE id = ${inp.runId} FOR UPDATE`) as any[];
    if (luot?.status !== "dang_choi") return "luot_da_xong";
    const b = inp.buoc;
    const [moi] = (await tx`
      INSERT INTO game_run_steps (run_id, ordinal, ref_kind, ref_id, ref_version, topic_id, opened_at,
        answered_at, elapsed_ms, response, correct, points, bonus, max_points, timed_out, client_id)
      VALUES (${inp.runId}, ${b.thu_tu}, ${b.ref_kind}, ${b.ref_id}, ${b.ref_version},
        ${b.topic_id || null}, ${inp.moLuc}, ${inp.traLoiLuc}, ${inp.thoiGianMs},
        ${tx.json((inp.response ?? {}) as never)}, ${inp.dung}, ${inp.diem}, ${inp.thuong}, ${b.diem_toi_da},
        ${inp.hetGio}, ${inp.clientId ?? null})
      ON CONFLICT DO NOTHING
      RETURNING ordinal`) as any[];
    if (!moi) return "da_tra_loi";

    if (inp.dung !== null) {
      if (b.ref_kind === "question" && b.ref_id) {
        await capNhatCauSaiTrongGiaoDich(tx, {
          accountId: inp.accountId,
          questionId: b.ref_id,
          correct: inp.dung,
          tinhCauSai: capNhatCauSai,
        });
      }
      await ghiKetQuaChuDe(tx, {
        accountId: inp.accountId,
        topicId: b.topic_id,
        dung: inp.dung,
        luc: inp.traLoiLuc,
      });
    }
    return "ok";
  })) as "ok" | "da_tra_loi" | "luot_da_xong";
}

/** Số ngày tối đa từ lúc chơi mà lượt offline còn được cộng XP khi đồng bộ (như luyện tập GĐ13). */
export const SO_NGAY_CONG_XP_LUOT_OFFLINE = 7;

export interface KetThucLuotKq {
  /** true khi lần gọi này là lần kết thúc lượt (lần đầu). */
  moiKetThuc: boolean;
  luot: LuotChoiRow;
}

/**
 * Kết thúc lượt: tổng kết từ các bước đã ghi, tính XP theo thứ tự lượt trong ngày, cộng XP, tất cả
 * trong một giao dịch. Gọi lại trên lượt đã kết thúc thì trả nguyên kết quả cũ, không cộng lại.
 *
 * `luc` là thời điểm chơi thật (lượt offline), không muộn hơn `now`. Lượt offline chơi quá
 * SO_NGAY_CONG_XP_LUOT_OFFLINE ngày trước khi gửi thì vẫn lưu kết quả nhưng không có XP.
 */
export async function ketThucLuot(
  id: string,
  opts: { xpCoBan: number; trangThai?: "xong" | "het_gio"; luc?: Date; now?: Date },
): Promise<KetThucLuotKq> {
  const now = opts.now ?? new Date();
  const luc = opts.luc && opts.luc < now ? opts.luc : now;
  const moiKetThuc = (await sql.begin(async (tx) => {
    const [l] = (await tx`
      SELECT account_id, game_code, items, status, offline, level FROM game_runs WHERE id = ${id} FOR UPDATE`) as any[];
    if (l?.status !== "dang_choi") return false;

    const buoc = (await tx`
      SELECT points::float8 AS diem, bonus::float8 AS thuong, correct AS dung
      FROM game_run_steps WHERE run_id = ${id}`) as any[];
    const tk = tongKetLuot(buoc, l.items as BuocLuot[]);

    const ngay = ngayVietNam(luc);
    const [truoc] = (await tx`
      SELECT count(*)::int AS n FROM game_runs
      WHERE account_id = ${l.account_id} AND game_code = ${l.game_code} AND id <> ${id}
        AND status IN ('xong', 'het_gio')
        AND (played_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = ${ngay}::date`) as any[];
    const quaHan = now.getTime() - luc.getTime() > SO_NGAY_CONG_XP_LUOT_OFFLINE * 24 * 3600 * 1000;
    const xp = quaHan
      ? 0
      : xpLuotChoi({ xpCoBan: opts.xpCoBan, tyLe: tk.tyLe, thuTuTrongNgay: Number(truoc?.n ?? 0) + 1 });
    const daCong = await congXp(tx, {
      accountId: l.account_id,
      nguon: `game:${l.game_code}`,
      nguonId: id,
      xp,
      luc,
    });

    await tx`
      UPDATE game_runs SET status = ${opts.trangThai ?? "xong"}, finished_at = ${now}, played_at = ${luc},
        score = ${tk.diem + tk.thuong}, bonus = ${tk.thuong}, max_score = ${tk.diemToiDa},
        stars = ${tk.sao}, xp = ${daCong ? xp : 0}
      WHERE id = ${id}`;
    // Trò có màn (GĐ-T1): tiến độ màn, trong cùng giao dịch nên kết thúc hai lần không ghi hai lần.
    if (l.level !== null && l.level !== undefined) {
      await ghiTienDoManLuot(tx, {
        accountId: l.account_id,
        gameCode: l.game_code,
        level: Number(l.level),
        sao: tk.sao,
        diem: tk.diem + tk.thuong,
        luc,
      });
    }
    return true;
  })) as boolean;
  return { moiKetThuc, luot: (await luotChoi(id))! };
}

/**
 * Chuyển các lượt đang chơi quá 24 giờ của một người sang "bỏ dở" (không có XP), để danh sách
 * "đang chơi dở" không giữ lượt cũ mãi.
 */
export async function donLuotBoDo(accountId: string, now: Date = new Date()): Promise<number> {
  const r = await sql`
    UPDATE game_runs SET status = 'bo_do', finished_at = ${now}
    WHERE account_id = ${accountId} AND status = 'dang_choi' AND NOT offline
      AND started_at < ${new Date(now.getTime() - 24 * 3600 * 1000)}`;
  return r.count;
}

export interface LuotTomTatRow {
  id: string;
  game_code: string;
  ten_tro_choi: string;
  status: TrangThaiLuot;
  started_at: Date;
  played_at: Date;
  score: number | null;
  max_score: number | null;
  stars: number | null;
  xp: number | null;
  offline: boolean;
}

export async function lichSuLuotChoi(accountId: string, limit = 20): Promise<LuotTomTatRow[]> {
  return await sql<LuotTomTatRow[]>`
    SELECT r.id, r.game_code, g.name AS ten_tro_choi, r.status, r.started_at, r.played_at,
           r.score::float8 AS score, r.max_score::float8 AS max_score, r.stars, r.xp, r.offline
    FROM game_runs r JOIN games g ON g.code = r.game_code
    WHERE r.account_id = ${accountId}
    ORDER BY r.started_at DESC
    LIMIT ${limit}`;
}

/** Số lượt đã xong hôm nay và điểm tốt nhất của tôi, theo từng trò. */
export async function thongKeTroChoiCuaToi(
  accountId: string,
  now: Date = new Date(),
): Promise<Map<string, { hom_nay: number; tot_nhat: number | null; sao_tot_nhat: number | null }>> {
  const rows = (await sql`
    SELECT game_code,
      count(*) FILTER (WHERE (played_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = ${ngayVietNam(now)}::date)::int AS hom_nay,
      max(score)::float8 AS tot_nhat, max(stars)::int AS sao_tot_nhat
    FROM game_runs WHERE account_id = ${accountId} AND status IN ('xong', 'het_gio')
    GROUP BY game_code`) as any[];
  return new Map(
    rows.map((r) => [
      r.game_code,
      { hom_nay: r.hom_nay, tot_nhat: r.tot_nhat, sao_tot_nhat: r.sao_tot_nhat },
    ]),
  );
}

/* ------------------------------------------------------------------ */
/* Offline                                                             */
/* ------------------------------------------------------------------ */

/** Hạn dùng của gói offline: lượt chơi sau hạn này không được nhận khi đồng bộ. */
export const SO_NGAY_HAN_GOI = 14;

export interface GoiTroChoiRow {
  id: string;
  account_id: string;
  game_code: string;
  items: unknown[];
  issued_at: Date;
  expires_at: Date;
}

export async function taoGoiTroChoi(inp: {
  accountId: string;
  gameCode: string;
  items: unknown[];
  now?: Date;
}): Promise<GoiTroChoiRow> {
  const now = inp.now ?? new Date();
  const [r] = await sql<GoiTroChoiRow[]>`
    INSERT INTO game_packs (account_id, game_code, items, issued_at, expires_at)
    VALUES (${inp.accountId}, ${inp.gameCode}, ${sql.json(inp.items as never)}, ${now},
            ${new Date(now.getTime() + SO_NGAY_HAN_GOI * 24 * 3600 * 1000)})
    RETURNING *`;
  return r!;
}

export async function goiTroChoi(id: string): Promise<GoiTroChoiRow | undefined> {
  const [r] = await sql<GoiTroChoiRow[]>`SELECT * FROM game_packs WHERE id = ${id}`;
  return r;
}

/**
 * Tạo lượt offline theo `client_id`, hoặc trả lượt đã có. `cuaNguoiKhac` khi `client_id` đã thuộc
 * tài khoản khác: người gọi bỏ qua lượt đó, không ghi gì vào.
 */
export async function layHoacTaoLuotOffline(inp: {
  accountId: string;
  gameCode: string;
  clientId: string;
  packId: string;
  seed: string;
  items: BuocLuot[];
  batDau: Date;
  level?: number | null;
}): Promise<{ id: string; moi: boolean; cuaNguoiKhac: boolean; daKetThuc: boolean }> {
  const [moi] = (await sql`
    INSERT INTO game_runs (game_code, account_id, unit_id, seed, items, started_at, played_at, offline, client_id, pack_id, level)
    VALUES (${inp.gameCode}, ${inp.accountId}, (SELECT unit_id FROM accounts WHERE id = ${inp.accountId}),
            ${inp.seed}, ${sql.json(inp.items as never)}, ${inp.batDau}, ${inp.batDau}, true, ${inp.clientId},
            ${inp.packId}, ${inp.level ?? null})
    ON CONFLICT (client_id) WHERE client_id IS NOT NULL DO NOTHING
    RETURNING id`) as any[];
  if (moi) return { id: moi.id, moi: true, cuaNguoiKhac: false, daKetThuc: false };
  const [cu] = (await sql`
    SELECT id, account_id, game_code, status FROM game_runs WHERE client_id = ${inp.clientId}`) as any[];
  return {
    id: cu.id,
    moi: false,
    cuaNguoiKhac: cu.account_id !== inp.accountId || cu.game_code !== inp.gameCode,
    daKetThuc: cu.status !== "dang_choi",
  };
}
