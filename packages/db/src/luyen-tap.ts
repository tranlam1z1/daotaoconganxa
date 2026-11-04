/**
 * Truy vấn CSDL cho luyện tập (docs/PLAN.md GĐ4).
 *
 * Chỉ đọc và ghi; luật rút câu, đảo phương án, chấm và danh sách câu sai nằm ở
 * packages/dao-tao/src/luyen-tap.ts. `items` của phiên có đáp án (ảnh chụp để chấm), nên hàm
 * trả phiên chỉ dùng ở máy chủ; route người học tự lọc ra phần đề trước khi gửi đi.
 */
import { type CauHoiNguon, ngayVietNam } from "@qdpl/dao-tao";
import { sql, type Tx } from "./client.ts";
import { ghiKetQuaChuDe } from "./ho-so-chu-de.ts";
import { ghiHoatDong, ghiHoatDongHomNay } from "./hoat-dong.ts";

/**
 * `nhom` là phiên đề ôn tập của nhóm học cùng (GĐ16a), gắn với mục qua `group_item_id`.
 */
export type NguonPhien = "chu_de" | "cau_sai" | "nhom";

/* ------------------------------------------------------------------ */
/* Chủ đề và nguồn câu                                                 */
/* ------------------------------------------------------------------ */

export interface ChuDeLuyenTapRow {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
  ordinal: number;
  /** Số câu đã duyệt trong chủ đề và mọi chủ đề con. */
  so_cau: number;
  /** Số câu trong số đó mà người học đã từng làm đúng. */
  da_lam_dung: number;
}

export async function chuDeLuyenTap(accountId: string): Promise<ChuDeLuyenTapRow[]> {
  return await sql<ChuDeLuyenTapRow[]>`
    WITH RECURSIVE cay AS (
      SELECT id AS goc, id FROM question_topics
      UNION ALL
      SELECT cay.goc, t.id FROM question_topics t JOIN cay ON t.parent_id = cay.id
    ),
    dung AS (
      SELECT DISTINCT a.question_id
      FROM practice_answers a JOIN practice_sessions s ON s.id = a.session_id
      WHERE s.account_id = ${accountId} AND a.correct
    )
    SELECT t.id, t.code, t.name, t.parent_id, t.ordinal,
           count(DISTINCT q.id)::int AS so_cau,
           count(DISTINCT q.id) FILTER (WHERE dung.question_id IS NOT NULL)::int AS da_lam_dung
    FROM question_topics t
    JOIN cay ON cay.goc = t.id
    LEFT JOIN questions q ON q.topic_id = cay.id AND q.status = 'da_duyet'
    LEFT JOIN dung ON dung.question_id = q.id
    -- Bỏ chủ đề bị ẩn và mọi chủ đề nằm dưới nó.
    WHERE NOT EXISTS (
      SELECT 1 FROM cay c JOIN question_topics h ON h.id = c.goc AND h.hidden WHERE c.id = t.id
    )
    GROUP BY t.id
    ORDER BY t.ordinal, t.name`;
}

export async function chuDeTheoMaHoacId(
  khoa: string,
): Promise<{ id: string; code: string; name: string } | undefined> {
  const laUuid = /^[0-9a-f-]{36}$/i.test(khoa);
  const [row] = await sql<Array<{ id: string; code: string; name: string }>>`
    SELECT id, code, name FROM question_topics WHERE ${laUuid ? sql`id = ${khoa}::uuid` : sql`code = ${khoa}`}`;
  return row;
}

/** Câu hỏi đã duyệt dạng đủ để chụp vào phiên (khớp CauHoiNguon của @qdpl/dao-tao). */
export interface CauHoiNguonRow {
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
}

const COT_NGUON = sql`q.id, q.version, COALESCE(q.topic_id::text, '') AS topic_id, q.kind, q.level, q.stem,
                      q.options, q.answer, q.explanation, q.citations, q.image_uris`;

/** Câu đã duyệt thuộc chủ đề và mọi chủ đề con. */
export async function nguonTheoChuDe(topicId: string): Promise<CauHoiNguonRow[]> {
  return await sql<CauHoiNguonRow[]>`
    WITH RECURSIVE cay AS (
      SELECT id FROM question_topics WHERE id = ${topicId}
      UNION ALL SELECT t.id FROM question_topics t JOIN cay ON t.parent_id = cay.id
    )
    SELECT ${COT_NGUON} FROM questions q
    WHERE q.status = 'da_duyet' AND q.kind <> 'tu_luan' AND q.topic_id IN (SELECT id FROM cay)`;
}

/** Câu đã duyệt đang nằm trong danh sách câu sai của người học. */
export async function nguonCauSai(accountId: string): Promise<CauHoiNguonRow[]> {
  return await sql<CauHoiNguonRow[]>`
    SELECT ${COT_NGUON} FROM wrong_questions w JOIN questions q ON q.id = w.question_id
    WHERE w.account_id = ${accountId} AND w.cleared_at IS NULL AND q.status = 'da_duyet'
      AND q.kind <> 'tu_luan'`;
}

/** Số lần làm và số lần sai của người học với từng câu (mọi phiên). */
export async function lichSuCauCuaToi(
  accountId: string,
  questionIds: string[],
): Promise<Map<string, { so_lan: number; so_sai: number }>> {
  if (!questionIds.length) return new Map();
  const rows = await sql<Array<{ question_id: string; so_lan: number; so_sai: number }>>`
    SELECT a.question_id, count(*)::int AS so_lan, count(*) FILTER (WHERE NOT a.correct)::int AS so_sai
    FROM practice_answers a JOIN practice_sessions s ON s.id = a.session_id
    WHERE s.account_id = ${accountId} AND a.question_id = ANY(${questionIds}::uuid[])
    GROUP BY a.question_id`;
  return new Map(rows.map((r) => [r.question_id, { so_lan: r.so_lan, so_sai: r.so_sai }]));
}

/* ------------------------------------------------------------------ */
/* Phiên                                                               */
/* ------------------------------------------------------------------ */

export interface PhienLuyenTapRow {
  id: string;
  account_id: string;
  topic_id: string | null;
  topic_name: string | null;
  source: NguonPhien;
  items: Array<Record<string, any>>;
  started_at: Date;
  finished_at: Date | null;
  correct: number | null;
  total: number;
  seconds_spent: number | null;
  /** Mục nhóm học cùng của phiên nguồn `nhom`; các nguồn khác là null. */
  group_item_id: string | null;
  /** Câu trả lời chưa chấm, theo số thứ tự câu (chuỗi). Chấm khi kết thúc phiên. */
  draft_answers: Record<string, BanNhapCau>;
}

export interface BanNhapCau {
  tra_loi: Record<string, unknown>;
  /** Số giây cộng dồn qua các lần mở câu. */
  giay: number;
}

export async function taoPhienLuyenTap(inp: {
  accountId: string;
  topicId: string | null;
  source: NguonPhien;
  items: unknown[];
  groupItemId?: string | null;
}): Promise<{ id: string }> {
  const [row] = await sql<Array<{ id: string }>>`
    INSERT INTO practice_sessions (account_id, topic_id, source, items, total, group_item_id)
    VALUES (${inp.accountId}, ${inp.topicId}, ${inp.source}, ${sql.json(inp.items as never)}, ${inp.items.length},
            ${inp.groupItemId ?? null})
    RETURNING id`;
  return row!;
}

export async function phienLuyenTap(id: string): Promise<PhienLuyenTapRow | undefined> {
  const [row] = await sql<PhienLuyenTapRow[]>`
    SELECT s.*, t.name AS topic_name
    FROM practice_sessions s LEFT JOIN question_topics t ON t.id = s.topic_id
    WHERE s.id = ${id}`;
  return row;
}

export interface CauTraLoiRow {
  question_id: string;
  question_version: number;
  response: Record<string, unknown>;
  correct: boolean;
  seconds: number | null;
  created_at: Date;
}

export async function cauTraLoiCuaPhien(sessionId: string): Promise<CauTraLoiRow[]> {
  return await sql<CauTraLoiRow[]>`
    SELECT question_id, question_version, response, correct, seconds, created_at
    FROM practice_answers WHERE session_id = ${sessionId} ORDER BY id`;
}

/**
 * Lưu tạm câu trả lời của câu `stt` (chưa chấm), cộng thêm `giayThem` vào số giây của câu. Phiên đã
 * kết thúc thì không lưu, trả false.
 */
export async function luuBanNhap(inp: {
  sessionId: string;
  stt: number;
  traLoi: unknown;
  giayThem: number;
}): Promise<boolean> {
  const khoa = String(inp.stt);
  const rows = await sql`
    UPDATE practice_sessions SET draft_answers = draft_answers || jsonb_build_object(
      ${khoa}::text,
      jsonb_build_object(
        'tra_loi', ${sql.json(inp.traLoi as never)}::jsonb,
        'giay', COALESCE((draft_answers -> ${khoa}::text ->> 'giay')::int, 0) + ${Math.round(inp.giayThem)}::int
      )
    )
    WHERE id = ${inp.sessionId} AND finished_at IS NULL
    RETURNING id`;
  return rows.length > 0;
}

export interface TrangThaiCauSaiDb {
  wrong_count: number;
  correct_streak: number;
  trong_danh_sach: boolean;
}

/**
 * Ghi một câu trả lời và cập nhật danh sách câu sai trong cùng một giao dịch. `tinhCauSai` là
 * luật `capNhatCauSai` của @qdpl/dao-tao, truyền vào để tệp này không chứa luật nghiệp vụ.
 *
 * Trả `"da_tra_loi"` khi câu này đã được trả lời trong phiên (hoặc `client_id` đã được ghi),
 * để route báo 409 thay vì chấm hai lần.
 */
export async function ghiCauTraLoi(inp: {
  sessionId: string;
  accountId: string;
  questionId: string;
  version: number;
  response: unknown;
  correct: boolean;
  seconds: number | null;
  clientId: string | null;
  tinhCauSai: (hienTai: TrangThaiCauSaiDb | null, dung: boolean) => TrangThaiCauSaiDb | null;
  /** Chủ đề của câu, để cập nhật hồ sơ chủ đề. Bỏ trống thì không cập nhật. */
  topicId?: string | null;
}): Promise<"ok" | "da_tra_loi"> {
  return (await sql.begin(async (tx) => {
    const [moi] = await tx`
      INSERT INTO practice_answers (session_id, question_id, question_version, response, correct, seconds, client_id)
      VALUES (${inp.sessionId}, ${inp.questionId}, ${inp.version}, ${tx.json(inp.response as never)},
              ${inp.correct}, ${inp.seconds}, ${inp.clientId})
      ON CONFLICT DO NOTHING
      RETURNING id`;
    if (!moi) return "da_tra_loi";

    await capNhatCauSaiTrongGiaoDich(tx, inp);
    // Hồ sơ chủ đề (docs/PLAN.md GĐ-G0), cùng giao dịch với câu trả lời.
    await ghiKetQuaChuDe(tx, { accountId: inp.accountId, topicId: inp.topicId, dung: inp.correct });
    return "ok";
  })) as "ok" | "da_tra_loi";
}

/**
 * Cập nhật danh sách câu sai cho một câu trả lời, trong giao dịch `tx` của người gọi. Luyện tập
 * (GĐ4) và các nơi khác có câu hỏi ngân hàng (GĐ-G0) dùng chung.
 */
export async function capNhatCauSaiTrongGiaoDich(
  tx: Tx,
  inp: {
    accountId: string;
    questionId: string;
    correct: boolean;
    tinhCauSai: (hienTai: TrangThaiCauSaiDb | null, dung: boolean) => TrangThaiCauSaiDb | null;
  },
): Promise<void> {
  const [cu] = await tx<Array<{ wrong_count: number; correct_streak: number; cleared_at: Date | null }>>`
    SELECT wrong_count, correct_streak, cleared_at FROM wrong_questions
    WHERE account_id = ${inp.accountId} AND question_id = ${inp.questionId}
    FOR UPDATE`;
  const sau = inp.tinhCauSai(
    cu
      ? { wrong_count: cu.wrong_count, correct_streak: cu.correct_streak, trong_danh_sach: !cu.cleared_at }
      : null,
    inp.correct,
  );
  if (!sau) return;
  await tx`
    INSERT INTO wrong_questions (account_id, question_id, wrong_count, correct_streak, last_wrong_at, cleared_at)
    VALUES (${inp.accountId}, ${inp.questionId}, ${sau.wrong_count}, ${sau.correct_streak},
            ${inp.correct ? null : new Date()}, ${sau.trong_danh_sach ? null : new Date()})
    ON CONFLICT (account_id, question_id) DO UPDATE SET
      wrong_count = EXCLUDED.wrong_count,
      correct_streak = EXCLUDED.correct_streak,
      last_wrong_at = COALESCE(EXCLUDED.last_wrong_at, wrong_questions.last_wrong_at),
      cleared_at = EXCLUDED.cleared_at`;
}

/**
 * Kết thúc phiên: đếm câu đúng từ các câu đã trả lời. Gọi lại trên phiên đã kết thúc thì trả
 * nguyên kết quả cũ (không đếm lại).
 */
export async function ketThucPhien(id: string): Promise<PhienLuyenTapRow> {
  await sql.begin(async (tx) => {
    const [xong] = (await tx`
      UPDATE practice_sessions s SET
        finished_at = now(),
        correct = (SELECT count(*) FROM practice_answers a WHERE a.session_id = s.id AND a.correct),
        seconds_spent = COALESCE(
          (SELECT sum(seconds) FROM practice_answers a WHERE a.session_id = s.id),
          extract(epoch FROM now() - s.started_at)
        )::int
      WHERE s.id = ${id} AND s.finished_at IS NULL
      RETURNING account_id, source, correct, group_item_id,
        (SELECT count(*)::int FROM practice_answers a WHERE a.session_id = s.id) AS da_tra_loi`) as any[];
    // Ghi nhật hoạt động học trong cùng giao dịch (dùng cho nhắc học). Phiên đã kết thúc thì
    // UPDATE không trả dòng nào nên không ghi lại.
    if (!xong) return;
    await ghiHoatDongHomNay(tx, xong.account_id);
  });
  return (await phienLuyenTap(id))!;
}

/* ------------------------------------------------------------------ */
/* Của tôi                                                             */
/* ------------------------------------------------------------------ */

export interface PhienTomTatRow {
  id: string;
  source: NguonPhien;
  topic_name: string | null;
  started_at: Date;
  finished_at: Date | null;
  correct: number | null;
  total: number;
  da_tra_loi: number;
}

export async function lichSuPhienCuaToi(accountId: string, limit = 20): Promise<PhienTomTatRow[]> {
  return await sql<PhienTomTatRow[]>`
    SELECT s.id, s.source, t.name AS topic_name, s.started_at, s.finished_at, s.correct, s.total,
           (SELECT count(*)::int FROM practice_answers a WHERE a.session_id = s.id) AS da_tra_loi
    FROM practice_sessions s LEFT JOIN question_topics t ON t.id = s.topic_id
    WHERE s.account_id = ${accountId}
    ORDER BY s.started_at DESC
    LIMIT ${limit}`;
}

export interface CauSaiRow {
  question_id: string;
  code: string;
  stem: string;
  topic_name: string | null;
  wrong_count: number;
  correct_streak: number;
  last_wrong_at: Date | null;
}

/** Danh sách câu sai còn luyện được (câu đã duyệt). Chỉ có đề, không có đáp án. */
export async function cauSaiCuaToi(accountId: string): Promise<CauSaiRow[]> {
  return await sql<CauSaiRow[]>`
    SELECT w.question_id, q.code, q.stem, t.name AS topic_name, w.wrong_count, w.correct_streak, w.last_wrong_at
    FROM wrong_questions w
    JOIN questions q ON q.id = w.question_id
    LEFT JOIN question_topics t ON t.id = q.topic_id
    WHERE w.account_id = ${accountId} AND w.cleared_at IS NULL AND q.status = 'da_duyet'
    ORDER BY w.last_wrong_at DESC NULLS LAST`;
}

/* ------------------------------------------------------------------ */
/* Offline (docs/PLAN.md GĐ13)                                         */
/* ------------------------------------------------------------------ */

/** Số câu tối đa của một gói offline, để gói tải được nhanh trên mạng yếu. */
export const SO_CAU_GOI_OFFLINE_TOI_DA = 300;

/**
 * Gói offline của một chủ đề (gồm chủ đề con): câu đã duyệt và được phép dùng offline, KÈM ĐÁP
 * ÁN để chấm trên máy. Chỉ dùng cho luyện tập; thi sát hạch chỉ làm online (giả định A7).
 */
export async function goiOfflineTheoChuDe(topicId: string): Promise<CauHoiNguonRow[]> {
  return await sql<CauHoiNguonRow[]>`
    WITH RECURSIVE cay AS (
      SELECT id FROM question_topics WHERE id = ${topicId}
      UNION ALL SELECT t.id FROM question_topics t JOIN cay ON t.parent_id = cay.id
    )
    SELECT ${COT_NGUON} FROM questions q
    WHERE q.status = 'da_duyet' AND q.offline_ok AND q.topic_id IN (SELECT id FROM cay)
    ORDER BY q.code
    LIMIT ${SO_CAU_GOI_OFFLINE_TOI_DA}`;
}

/** Nội dung hiện tại của các câu (mọi trạng thái), để chấm lại câu trả lời offline ở máy chủ. */
export async function cauHoiTheoIds(ids: string[]): Promise<CauHoiNguonRow[]> {
  if (!ids.length) return [];
  return await sql<CauHoiNguonRow[]>`
    SELECT ${COT_NGUON}, q.status FROM questions q WHERE q.id = ANY(${ids}::uuid[])`;
}

/**
 * Nội dung câu đã duyệt theo đúng danh sách id. Câu không còn ở trạng thái `da_duyet` (bị gỡ
 * duyệt) thì không trả về, nên người gọi tự quyết định dùng bao nhiêu câu còn lại.
 */
export async function cauHoiDaDuyetTheoId(ids: string[]): Promise<CauHoiNguon[]> {
  if (!ids.length) return [];
  return (await sql`
    SELECT id, version, topic_id, kind, level, stem, options, answer, explanation, citations, image_uris
    FROM questions WHERE status = 'da_duyet' AND id = ANY(${ids}::uuid[])`) as unknown as CauHoiNguon[];
}

/**
 * Tạo phiên offline theo `client_id`, hoặc trả phiên đã có. `cuaNguoiKhac` khi `client_id` đã
 * thuộc tài khoản khác: người gọi bỏ qua phiên đó, không ghi gì vào.
 */
export async function layHoacTaoPhienOffline(inp: {
  accountId: string;
  clientId: string;
  topicId: string | null;
  items: unknown[];
  batDau: Date;
}): Promise<{ id: string; moi: boolean; cuaNguoiKhac: boolean; daKetThuc: boolean }> {
  const [moi] = await sql<Array<{ id: string }>>`
    INSERT INTO practice_sessions (account_id, topic_id, source, items, total, started_at, client_id, offline)
    VALUES (${inp.accountId}, ${inp.topicId}, 'chu_de', ${sql.json(inp.items as never)}, ${inp.items.length},
            ${inp.batDau}, ${inp.clientId}, true)
    ON CONFLICT (client_id) WHERE client_id IS NOT NULL DO NOTHING
    RETURNING id`;
  if (moi) return { id: moi.id, moi: true, cuaNguoiKhac: false, daKetThuc: false };
  const [cu] = await sql<Array<{ id: string; account_id: string; finished_at: Date | null }>>`
    SELECT id, account_id, finished_at FROM practice_sessions WHERE client_id = ${inp.clientId}`;
  return {
    id: cu!.id,
    moi: false,
    cuaNguoiKhac: cu!.account_id !== inp.accountId,
    daKetThuc: cu!.finished_at !== null,
  };
}

/** Số ngày tối đa tính từ lúc làm bài mà kết quả offline còn được ghi nhận khi đồng bộ. */
export const SO_NGAY_GHI_NHAN_OFFLINE = 7;

/**
 * Kết thúc phiên offline theo thời điểm làm bài thật `ketThuc` (không muộn hơn `now`). Hoạt động
 * học ghi theo ngày làm bài thật, nhưng chỉ khi ngày đó còn trong SO_NGAY_GHI_NHAN_OFFLINE ngày:
 * kết quả để quá lâu mới gửi vẫn được lưu, không ghi nhận hoạt động.
 * Phiên đã kết thúc thì không làm gì (gửi lại không ghi hai lần).
 */
export async function ketThucPhienOffline(
  id: string,
  ketThuc: Date,
  now: Date = new Date(),
): Promise<{ daKetThuc: boolean }> {
  const luc = ketThuc > now ? now : ketThuc;
  return (await sql.begin(async (tx) => {
    const [xong] = (await tx`
      UPDATE practice_sessions s SET
        finished_at = ${luc},
        correct = (SELECT count(*) FROM practice_answers a WHERE a.session_id = s.id AND a.correct),
        seconds_spent = COALESCE((SELECT sum(seconds) FROM practice_answers a WHERE a.session_id = s.id), 0)::int
      WHERE s.id = ${id} AND s.finished_at IS NULL
      RETURNING account_id`) as any[];
    if (!xong) return { daKetThuc: false };
    const quaHan = now.getTime() - luc.getTime() > SO_NGAY_GHI_NHAN_OFFLINE * 24 * 3600 * 1000;
    if (!quaHan) await ghiHoatDong(tx, xong.account_id, ngayVietNam(luc));
    return { daKetThuc: true };
  })) as { daKetThuc: boolean };
}
