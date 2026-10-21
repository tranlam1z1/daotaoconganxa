/**
 * Truy vấn CSDL cho biển báo và game đoán biển báo (docs/PLAN.md GĐ12).
 *
 * Mặc định chỉ trả biển `da_duyet`. `gomBanNhap` chỉ bật khi biên tập viên xem trước dữ liệu
 * đang soạn (biến TRA_CUU_NHANH_BAN_NHAP=1, như mức phạt ở GĐ5).
 */
import type { BienPhanUng, NhomBienBao, ThaoTacBienBao } from "@qdpl/dao-tao";
import { sql, type Tx } from "./client.ts";
import { type CheDoNap, giuTrangThai, trangThaiNap } from "./tra-cuu-nhanh.ts";

export interface BienBaoRow {
  code: string;
  group_name: string;
  name: string;
  meaning: string;
  image_uri: string;
  citation_urn: string;
  ordinal: number;
  status: string;
}

const COT = sql`code, group_name, name, meaning, image_uri, citation_urn, ordinal, status`;
const locTrangThai = (gomBanNhap: boolean) =>
  gomBanNhap ? sql`status IN ('da_duyet', 'nhap')` : sql`status = 'da_duyet'`;

/** Tìm theo tên hoặc mã (không dấu), lọc theo nhóm. */
export async function danhSachBienBao(opts: {
  q?: string;
  nhom?: string;
  gomBanNhap?: boolean;
}): Promise<BienBaoRow[]> {
  const q = opts.q?.trim() ? `%${opts.q.trim()}%` : null;
  return await sql<BienBaoRow[]>`
    SELECT ${COT} FROM traffic_signs
    WHERE ${locTrangThai(Boolean(opts.gomBanNhap))}
      AND (${opts.nhom ?? null}::text IS NULL OR group_name = ${opts.nhom ?? null})
      AND (${q}::text IS NULL OR search_text LIKE lower(unaccent(${q})) OR code ILIKE ${q})
    ORDER BY group_name, ordinal, code`;
}

export async function bienBaoTheoMa(code: string, gomBanNhap = false): Promise<BienBaoRow | undefined> {
  const [row] = await sql<BienBaoRow[]>`
    SELECT ${COT} FROM traffic_signs WHERE code = ${code} AND ${locTrangThai(gomBanNhap)}`;
  return row;
}

/** Nạp (thêm hoặc cập nhật theo mã) trong một giao dịch. */
export async function napBienBao(
  ds: Array<{
    code: string;
    group_name: string;
    name: string;
    meaning: string;
    search_text: string;
    image_uri: string;
    citation_urn: string;
    ordinal: number;
    status: string;
    note: string | null;
    /** Thao tác đúng trong trò Cung đường biển báo (GĐ-G8). */
    reaction?: string | null;
    reaction_note?: string | null;
  }>,
  opts: { cheDo?: CheDoNap } = {},
): Promise<number> {
  const theoTep = (opts.cheDo ?? "theo_tep") === "theo_tep";
  await sql.begin(async (tx) => {
    for (const b of ds) {
      await tx`
        INSERT INTO traffic_signs (code, group_name, name, meaning, search_text, image_uri, citation_urn, ordinal, status, note,
                                   reaction, reaction_note)
        VALUES (${b.code}, ${b.group_name}, ${b.name}, ${b.meaning}, ${b.search_text}, ${b.image_uri},
                ${b.citation_urn}, ${b.ordinal}, ${trangThaiNap(b.status, theoTep)}, ${b.note},
                ${b.reaction ?? null}, ${b.reaction_note ?? null})
        ON CONFLICT (code) DO UPDATE SET
          group_name = EXCLUDED.group_name, name = EXCLUDED.name, meaning = EXCLUDED.meaning,
          search_text = EXCLUDED.search_text, image_uri = EXCLUDED.image_uri,
          citation_urn = EXCLUDED.citation_urn, ordinal = EXCLUDED.ordinal,
          note = EXCLUDED.note, reaction = EXCLUDED.reaction, reaction_note = EXCLUDED.reaction_note,
          updated_at = now(),
          ${giuTrangThai(
            tx,
            "traffic_signs",
            theoTep,
            tx`(traffic_signs.group_name, traffic_signs.name,
            traffic_signs.meaning, traffic_signs.image_uri, traffic_signs.citation_urn,
            traffic_signs.reaction, traffic_signs.reaction_note)
            IS DISTINCT FROM (EXCLUDED.group_name, EXCLUDED.name, EXCLUDED.meaning, EXCLUDED.image_uri,
            EXCLUDED.citation_urn, EXCLUDED.reaction, EXCLUDED.reaction_note)`,
          )}`;
    }
  });
  return ds.length;
}

/**
 * Nguồn của trò "Cung đường biển báo" (GĐ-G8): biển ĐÃ DUYỆT có thao tác phản ứng. Biển phụ không
 * dùng (không đứng một mình trên đường). Ảnh là tên tệp, web phục vụ ở /bien-bao/anh/<tệp>.
 */
export async function nguonBienBaoPhanUng(): Promise<BienPhanUng[]> {
  const rows = (await sql`
    SELECT code, version, group_name, name, meaning, image_uri, citation_urn, topic_id, reaction, reaction_note
    FROM traffic_signs
    WHERE status = 'da_duyet' AND reaction IS NOT NULL AND group_name <> 'phu'
    ORDER BY code`) as any[];
  return rows.map((r) => ({
    ma: r.code,
    version: r.version,
    nhom: r.group_name as NhomBienBao,
    ten: r.name,
    y_nghia: r.meaning,
    anh: String(r.image_uri).split("/").at(-1)!,
    can_cu: r.citation_urn,
    topic_id: r.topic_id,
    phan_ung: r.reaction as ThaoTacBienBao,
    ghi_chu_phan_ung: r.reaction_note,
  }));
}

/* ------------------------------------------------------------------ */
/* Ván đoán biển báo (practice_sessions.source = 'game:doan_bien_bao')  */
/* ------------------------------------------------------------------ */

/**
 * Ghi câu trả lời cho câu thứ `viTri` (từ 0) của ván, chỉ khi ván chưa kết thúc và câu chưa được
 * trả lời. Trả false khi không ghi được (người gọi báo 409).
 */
export async function ghiTraLoiDoan(
  sessionId: string,
  viTri: number,
  chon: string,
  dung: boolean,
): Promise<boolean> {
  const rows = await sql`
    UPDATE practice_sessions SET
      items = jsonb_set(items, ${[String(viTri), "tra_loi"]}::text[], ${sql.json({ chon, dung } as never)}, true)
    WHERE id = ${sessionId} AND finished_at IS NULL
      AND jsonb_array_length(items) > ${viTri}::int
      AND (items -> ${viTri}::int) -> 'tra_loi' IS NULL
    RETURNING id`;
  return rows.length > 0;
}

/** Kết thúc ván: đếm câu đúng từ items. Trả số câu đúng, hoặc null khi ván đã kết thúc trước đó. */
export async function ketThucVanDoan(tx: Tx, sessionId: string): Promise<number | null> {
  const [row] = await tx<Array<{ correct: number }>>`
    UPDATE practice_sessions s SET
      finished_at = now(),
      correct = (SELECT count(*) FROM jsonb_array_elements(s.items) e WHERE (e -> 'tra_loi' ->> 'dung')::boolean),
      seconds_spent = extract(epoch FROM now() - s.started_at)::int
    WHERE s.id = ${sessionId} AND s.finished_at IS NULL
    RETURNING correct`;
  return row ? row.correct : null;
}
