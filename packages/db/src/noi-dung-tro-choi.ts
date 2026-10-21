/**
 * Nội dung trò chơi (`game_content`) và vòng đời duyệt của nó (docs/GAME_DESIGN.md §3).
 *
 * Luật chuyển trạng thái và luật tham chiếu ở @qdpl/dao-tao (vong-doi-duyet.ts, tham-chieu.ts);
 * tệp này đọc, ghi và ghi lịch sử vào `content_reviews`.
 *
 * `noiDungDungDuoc` là LỐI DUY NHẤT để trò chơi rút nội dung: chỉ tình huống đã duyệt mà mọi mục
 * được trỏ tới vẫn đã duyệt và đúng phiên bản đã ghi lúc duyệt.
 */
import {
  ghiPhienBanThamChieu,
  khoaThamChieu,
  kiemTraThamChieu,
  type LoaiThamChieu,
  type ThamChieu,
  type TrangThaiDuyet,
  type TrangThaiMuc,
} from "@qdpl/dao-tao";
import { sql, type Tx } from "./client.ts";

export interface NoiDungTroChoiRow {
  id: string;
  code: string;
  game_code: string;
  topic_id: string | null;
  topic_name: string | null;
  level: "de" | "trung_binh" | "kho";
  title: string;
  payload: Record<string, unknown>;
  answer: Record<string, unknown>;
  explanation: string | null;
  citations: string[];
  refs: Array<{ loai: LoaiThamChieu; ma: string; version?: number }>;
  asset_uris: string[];
  status: TrangThaiDuyet;
  source: string;
  version: number;
  created_by: string | null;
  updated_by: string | null;
  approved_by: string | null;
  approved_at: Date | null;
  reject_reason: string | null;
  needs_review_reason: string | null;
  offline_ok: boolean;
  created_at: Date;
  updated_at: Date;
}

const COT = sql`c.*, t.name AS topic_name`;

export interface NoiDungTroChoiInput {
  game_code: string;
  topic_id: string | null;
  level: "de" | "trung_binh" | "kho";
  title: string;
  payload: Record<string, unknown>;
  answer: Record<string, unknown>;
  explanation: string | null;
  citations: string[];
  refs: Array<{ loai: LoaiThamChieu; ma: string }>;
  offline_ok: boolean;
}

async function ghiLichSu(
  tx: Tx,
  kind: string,
  ref: string,
  version: number,
  action: string,
  actor: string,
  note?: string | null,
) {
  await tx`
    INSERT INTO content_reviews (kind, ref, version, action, actor, note)
    VALUES (${kind}, ${ref}, ${version}, ${action}, ${actor}, ${note ?? null})`;
}

export async function lichSuDuyetNoiDung(kind: string, ref: string) {
  return await sql`
    SELECT version, action, actor, note, created_at FROM content_reviews
    WHERE kind = ${kind} AND ref = ${ref} ORDER BY created_at, id`;
}

export async function taoNoiDungTroChoi(
  inp: NoiDungTroChoiInput & { status: "nhap" | "cho_duyet" },
  actor: string,
): Promise<NoiDungTroChoiRow> {
  const id = (await sql.begin(async (tx) => {
    const [r] = (await tx`
      INSERT INTO game_content (game_code, topic_id, level, title, payload, answer, explanation, citations,
        refs, status, offline_ok, created_by, updated_by)
      VALUES (${inp.game_code}, ${inp.topic_id}, ${inp.level}, ${inp.title}, ${tx.json(inp.payload as never)},
        ${tx.json(inp.answer as never)}, ${inp.explanation}, ${inp.citations}, ${tx.json(inp.refs as never)},
        ${inp.status}, ${inp.offline_ok}, ${actor}, ${actor})
      RETURNING id, version`) as any[];
    await ghiLichSu(tx, "game_content", r.id, r.version, "tao", actor);
    if (inp.status === "cho_duyet") await ghiLichSu(tx, "game_content", r.id, r.version, "gui_duyet", actor);
    return r.id as string;
  })) as string;
  return (await noiDungTroChoiTheoId(id))!;
}

export async function noiDungTroChoiTheoId(id: string): Promise<NoiDungTroChoiRow | undefined> {
  const [r] = await sql<NoiDungTroChoiRow[]>`
    SELECT ${COT} FROM game_content c LEFT JOIN question_topics t ON t.id = c.topic_id WHERE c.id = ${id}`;
  return r;
}

/**
 * Sửa nội dung. Chỉ ghi khi `version` khớp (khóa lạc quan). `sau` là hệ quả tính bằng `hauQuaSua`:
 * sửa nội dung đã duyệt thì về chờ duyệt và tăng phiên bản, tham chiếu bỏ phiên bản đã ghi.
 */
export async function suaNoiDungTroChoi(
  id: string,
  inp: NoiDungTroChoiInput,
  versionCu: number,
  sau: { status: TrangThaiDuyet; version: number },
  actor: string,
): Promise<NoiDungTroChoiRow | undefined> {
  const ok = (await sql.begin(async (tx) => {
    const r = await tx`
      UPDATE game_content SET
        game_code = ${inp.game_code}, topic_id = ${inp.topic_id}, level = ${inp.level}, title = ${inp.title},
        payload = ${tx.json(inp.payload as never)}, answer = ${tx.json(inp.answer as never)},
        explanation = ${inp.explanation}, citations = ${inp.citations}, refs = ${tx.json(inp.refs as never)},
        offline_ok = ${inp.offline_ok}, status = ${sau.status}, version = ${sau.version},
        needs_review_reason = NULL, updated_by = ${actor}, updated_at = now()
      WHERE id = ${id} AND version = ${versionCu}`;
    if (!r.count) return false;
    await ghiLichSu(tx, "game_content", id, sau.version, "sua", actor);
    return true;
  })) as boolean;
  return ok ? noiDungTroChoiTheoId(id) : undefined;
}

export async function danhSachNoiDungTroChoi(loc: {
  game?: string;
  status?: string;
  topicId?: string;
  q?: string;
  canXemLai?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ items: NoiDungTroChoiRow[]; tong: number }> {
  const dk = [sql`true`];
  if (loc.game) dk.push(sql`c.game_code = ${loc.game}`);
  if (loc.status) dk.push(sql`c.status = ${loc.status}`);
  if (loc.topicId) dk.push(sql`c.topic_id = ${loc.topicId}`);
  if (loc.q) dk.push(sql`(c.title ILIKE ${`%${loc.q}%`} OR c.code ILIKE ${`%${loc.q}%`})`);
  if (loc.canXemLai) dk.push(sql`c.status = 'da_duyet' AND c.needs_review_reason IS NOT NULL`);
  const where = dk.reduce((a, b) => sql`${a} AND ${b}`);
  const [items, [dem]] = await Promise.all([
    sql<NoiDungTroChoiRow[]>`
      SELECT ${COT} FROM game_content c LEFT JOIN question_topics t ON t.id = c.topic_id
      WHERE ${where}
      ORDER BY c.updated_at DESC, c.code
      LIMIT ${loc.limit ?? 200} OFFSET ${loc.offset ?? 0}`,
    sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM game_content c WHERE ${where}`,
  ]);
  return { items, tong: dem?.n ?? 0 };
}

export async function demNoiDungTheoTrangThai(): Promise<Record<string, number>> {
  const rows = (await sql`
    SELECT status, count(*)::int AS n FROM game_content GROUP BY status
    UNION ALL
    SELECT 'can_xem_lai', count(*)::int FROM game_content
    WHERE status = 'da_duyet' AND needs_review_reason IS NOT NULL`) as any[];
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

/* ------------------------------------------------------------------ */
/* Tham chiếu                                                          */
/* ------------------------------------------------------------------ */

/**
 * Trạng thái hiện tại của các mục được trỏ tới. Câu hỏi trỏ bằng mã (CH-00001); dữ liệu tra cứu
 * trỏ bằng mã của dòng. `ngung` của dữ liệu tra cứu là lưu trữ, nên không phải đã duyệt.
 */
export async function trangThaiThamChieu(
  refs: ReadonlyArray<{ loai: LoaiThamChieu; ma: string }>,
): Promise<Map<string, TrangThaiMuc>> {
  const theoLoai = new Map<LoaiThamChieu, string[]>();
  for (const r of refs) theoLoai.set(r.loai, [...(theoLoai.get(r.loai) ?? []), r.ma]);
  const kq = new Map<string, TrangThaiMuc>();
  const bang: Partial<Record<LoaiThamChieu, string>> = {
    question: "questions",
    violation: "violations",
    traffic_sign: "traffic_signs",
    procedure: "procedures",
  };
  for (const [loai, ma] of theoLoai) {
    const ten = bang[loai];
    if (!ten) continue; // tốc độ tối đa có bảng ở GĐ-G2; chưa có thì coi như không tồn tại
    const rows = (await sql`
      SELECT code, status, version FROM ${sql(ten)} WHERE code = ANY(${ma})`) as any[];
    for (const r of rows) kq.set(khoaThamChieu(loai, r.code), { status: r.status, version: r.version });
  }
  return kq;
}

/**
 * Chuyển trạng thái một nội dung. Duyệt thì ghi phiên bản của mọi mục được trỏ tới; có mục chưa
 * duyệt thì không duyệt được (trả `loi`). Trả `null` khi trạng thái vừa bị người khác đổi.
 */
export async function chuyenTrangThaiNoiDung(inp: {
  id: string;
  tu: readonly TrangThaiDuyet[];
  den: TrangThaiDuyet;
  hanhDong: string;
  actor: string;
  ghiChu?: string | null;
}): Promise<{ ok: true } | { ok: false; loi: string[] } | null> {
  const nd = await noiDungTroChoiTheoId(inp.id);
  if (!nd) return null;
  let refs: ThamChieu[] | null = null;
  if (inp.den === "da_duyet") {
    const kq = ghiPhienBanThamChieu(nd.refs, await trangThaiThamChieu(nd.refs));
    if (kq.loi.length) return { ok: false, loi: kq.loi };
    refs = kq.refs;
  }
  return (await sql.begin(async (tx) => {
    const r = (await tx`
      UPDATE game_content SET
        status = ${inp.den}, updated_at = now(),
        refs = CASE WHEN ${refs !== null} THEN ${tx.json((refs ?? []) as never)}::jsonb ELSE refs END,
        needs_review_reason = CASE WHEN ${inp.den} = 'da_duyet' THEN NULL ELSE needs_review_reason END,
        approved_by = CASE WHEN ${inp.den} = 'da_duyet' THEN ${inp.actor} ELSE approved_by END,
        approved_at = CASE WHEN ${inp.den} = 'da_duyet' THEN now() ELSE approved_at END,
        reject_reason = CASE WHEN ${inp.den} = 'tu_choi' THEN ${inp.ghiChu ?? null}
                             WHEN ${inp.den} = 'cho_duyet' THEN NULL ELSE reject_reason END
      WHERE id = ${inp.id} AND status = ANY(${inp.tu as string[]})
      RETURNING version`) as any[];
    if (!r.length) return null;
    await ghiLichSu(tx, "game_content", inp.id, r[0].version, inp.hanhDong, inp.actor, inp.ghiChu);
    return { ok: true } as const;
  })) as { ok: true } | null;
}

/**
 * Nội dung dùng được cho trò chơi: đã duyệt, và mọi mục được trỏ tới vẫn đã duyệt đúng phiên bản.
 * Tình huống không còn dùng được thì được gắn lý do `needs_review_reason` (hiện ở tab "Cần xem
 * lại"); tình huống dùng lại được thì xóa lý do.
 */
export async function noiDungDungDuoc(
  gameCode: string,
  loc: { topicId?: string; level?: string; chiOffline?: boolean } = {},
): Promise<NoiDungTroChoiRow[]> {
  const dk = [sql`c.game_code = ${gameCode}`, sql`c.status = 'da_duyet'`];
  if (loc.topicId) dk.push(sql`c.topic_id = ${loc.topicId}`);
  if (loc.level) dk.push(sql`c.level = ${loc.level}`);
  if (loc.chiOffline) dk.push(sql`c.offline_ok`);
  const ds = await sql<NoiDungTroChoiRow[]>`
    SELECT ${COT} FROM game_content c LEFT JOIN question_topics t ON t.id = c.topic_id
    WHERE ${dk.reduce((a, b) => sql`${a} AND ${b}`)}
    ORDER BY c.code`;
  return await locTheoThamChieu(ds);
}

/** Kiểm lại mọi nội dung đã duyệt (cho tab "Cần xem lại"). Trả số nội dung cần xem lại. */
export async function kiemTraToanBoThamChieu(): Promise<number> {
  const ds = await sql<NoiDungTroChoiRow[]>`
    SELECT ${COT} FROM game_content c LEFT JOIN question_topics t ON t.id = c.topic_id
    WHERE c.status = 'da_duyet'`;
  const dung = await locTheoThamChieu(ds);
  return ds.length - dung.length;
}

async function locTheoThamChieu(ds: NoiDungTroChoiRow[]): Promise<NoiDungTroChoiRow[]> {
  const hienTai = await trangThaiThamChieu(ds.flatMap((c) => c.refs));
  const dung: NoiDungTroChoiRow[] = [];
  for (const c of ds) {
    const lyDo = kiemTraThamChieu(c.refs as ThamChieu[], hienTai);
    const moi = lyDo.length ? lyDo.join(" ") : null;
    if (moi !== c.needs_review_reason) {
      await sql`UPDATE game_content SET needs_review_reason = ${moi} WHERE id = ${c.id}`;
    }
    if (!lyDo.length) dung.push({ ...c, needs_review_reason: null });
  }
  return dung;
}
