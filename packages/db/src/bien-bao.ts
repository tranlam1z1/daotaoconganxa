/**
 * Truy vấn CSDL cho biển báo (docs/PLAN.md GĐ12).
 *
 * Mặc định chỉ trả biển `da_duyet`. `gomBanNhap` chỉ bật khi quản trị viên nội dung xem trước dữ liệu
 * đang soạn (biến TRA_CUU_NHANH_BAN_NHAP=1, như mức phạt ở GĐ5).
 */
import { sql } from "./client.ts";
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
  const rows = await sql<BienBaoRow[]>`
    SELECT ${COT} FROM traffic_signs
    WHERE ${locTrangThai(Boolean(opts.gomBanNhap))}
      AND (${opts.nhom ?? null}::text IS NULL OR group_name = ${opts.nhom ?? null})
      AND deleted_at IS NULL
      AND (${q}::text IS NULL OR search_text LIKE lower(unaccent(${q})) OR code ILIKE ${q}
        OR lower(unaccent(meaning)) LIKE lower(unaccent(${q})))
    ORDER BY group_name, ordinal, code`;
  if (rows.length || !opts.q?.trim()) return rows;
  return sql<BienBaoRow[]>`SELECT ${COT} FROM traffic_signs
    WHERE ${locTrangThai(Boolean(opts.gomBanNhap))} AND deleted_at IS NULL
    AND (${opts.nhom ?? null}::text IS NULL OR group_name = ${opts.nhom ?? null})
    AND search_text % lower(unaccent(${opts.q.trim()}))
    ORDER BY similarity(search_text, lower(unaccent(${opts.q.trim()}))) DESC, code LIMIT 100`;
}

export async function bienBaoTheoMa(code: string, gomBanNhap = false): Promise<BienBaoRow | undefined> {
  const [row] = await sql<BienBaoRow[]>`
    SELECT ${COT} FROM traffic_signs WHERE code = ${code} AND deleted_at IS NULL AND ${locTrangThai(gomBanNhap)}`;
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
