/**
 * Tầng đọc của trang "Quy trình, Biểu mẫu" (/tra-cuu-nhanh/quy-trinh): tra chung quy trình dạng các
 * bước (`procedures`) và biểu mẫu, hướng dẫn dạng tệp (`form_templates`, migration 0066).
 *
 * Người học chỉ thấy dòng `da_duyet`, như mọi dữ liệu tra cứu nhanh. Soạn, thay tệp, phân loại và
 * duyệt nằm ở du-lieu-tra-cuu.ts.
 */
import type { LoaiXe } from "@qdpl/dao-tao";
import { sql } from "./client.ts";
import { trangThaiXem } from "./tra-cuu-nhanh.ts";

/** Loại của một tệp tải lên (`form_templates.kind`). */
export const LOAI_TEP_TAI_LIEU = ["bieu_mau", "huong_dan"] as const;
export type LoaiTepTaiLieu = (typeof LOAI_TEP_TAI_LIEU)[number];

/** Giá trị của ô "Loại tài liệu": quy trình dạng các bước, hoặc một loại tệp. */
export const LOAI_TAI_LIEU = ["quy_trinh", ...LOAI_TEP_TAI_LIEU] as const;
export type LoaiTaiLieu = (typeof LOAI_TAI_LIEU)[number];

/** Đuôi tệp nhận khi tải lên (khớp form_templates_ext_check). */
export const DUOI_TEP_TAI_LIEU = ["pdf", "docx", "doc", "xlsx", "xls"] as const;
export type DuoiTepTaiLieu = (typeof DUOI_TEP_TAI_LIEU)[number];

export interface TepTaiLieu {
  uri: string;
  ten: string;
  duoi: DuoiTepTaiLieu;
  kichThuoc: number;
}

export interface TaiLieuRow {
  loai: LoaiTaiLieu;
  ma: string;
  tieuDe: string;
  tomTat: string | null;
  /** null: áp dụng cho mọi phương tiện. */
  xe: LoaiXe | null;
  /** Loại vi phạm (CHU_DE_MUC_PHAT); null: chưa phân loại. */
  nhom: string | null;
  /** Số bước, chỉ có với quy trình. */
  soBuoc: number | null;
  /** Tệp đính kèm, chỉ có với biểu mẫu và hướng dẫn. */
  tep: TepTaiLieu | null;
  ghim: boolean;
  luotXem: number;
  trangThai: string;
}

function toTaiLieu(r: any): TaiLieuRow {
  return {
    loai: r.loai,
    ma: r.code,
    tieuDe: r.title,
    tomTat: r.summary,
    xe: r.vehicle,
    nhom: r.group_name,
    soBuoc: r.so_buoc,
    tep: r.file_uri
      ? { uri: r.file_uri, ten: r.file_name, duoi: r.file_ext, kichThuoc: Number(r.file_size) }
      : null,
    ghim: r.pinned,
    luotXem: Number(r.view_count),
    trangThai: r.status,
  };
}

/**
 * Tra quy trình và biểu mẫu theo từ khóa (không phân biệt dấu), loại tài liệu, phương tiện, loại vi phạm.
 * Có từ khóa thì xếp theo độ khớp; ngang nhau, và khi không có từ khóa, thì mục ghim đứng trước rồi
 * tới mục được mở nhiều (danh sách "phổ biến" là lời gọi không có bộ lọc nào).
 *
 * Lọc phương tiện giữ cả mục không gắn phương tiện (áp dụng chung); lọc loại vi phạm thì chỉ lấy mục
 * đã gắn đúng loại đó.
 */
export async function timTaiLieu(
  opts: {
    q?: string;
    loai?: LoaiTaiLieu;
    xe?: LoaiXe;
    nhom?: string;
    gomBanNhap?: boolean;
    limit?: number;
  } = {},
): Promise<TaiLieuRow[]> {
  const tu = (opts.q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 12);
  const q = tu.join(" ");
  const rows = await sql`
    SELECT * FROM (
      SELECT 'quy_trinh' AS loai, code, title, summary, vehicle, group_name, pinned, view_count, status,
        jsonb_array_length(steps) AS so_buoc,
        NULL::text AS file_uri, NULL::text AS file_name, NULL::text AS file_ext, NULL::int AS file_size,
        unaccent(lower(title || ' ' || coalesce(summary, '') || ' ' || coalesce(group_name, ''))) AS tim
      FROM procedures
      UNION ALL
      SELECT kind, code, title, summary, vehicle, group_name, pinned, view_count, status,
        NULL::int, file_uri, file_name, file_ext, file_size,
        unaccent(lower(title || ' ' || coalesce(summary, '') || ' ' || coalesce(group_name, '') || ' ' || file_name))
      FROM form_templates
    ) t
    WHERE status = ANY(${trangThaiXem(!!opts.gomBanNhap)})
      ${opts.loai ? sql`AND loai = ${opts.loai}` : sql``}
      ${opts.xe ? sql`AND (vehicle = ${opts.xe} OR vehicle IS NULL)` : sql``}
      ${opts.nhom ? sql`AND group_name = ${opts.nhom}` : sql``}
      ${tu.reduce((acc, t) => sql`${acc} AND tim LIKE '%' || unaccent(lower(${t})) || '%'`, sql``)}
    ORDER BY ${q ? sql`word_similarity(unaccent(lower(${q})), tim) DESC,` : sql``}
      pinned DESC, view_count DESC, title, code
    LIMIT ${opts.limit ?? 200}`;
  return rows.map(toTaiLieu);
}

/** Một biểu mẫu (hoặc hướng dẫn) theo mã, kèm tệp. */
export async function bieuMauTheoMa(
  ma: string,
  opts: { gomBanNhap?: boolean } = {},
): Promise<TaiLieuRow | undefined> {
  const [r] = await sql`
    SELECT kind AS loai, NULL::int AS so_buoc, * FROM form_templates
    WHERE code = ${ma} AND status = ANY(${trangThaiXem(!!opts.gomBanNhap)})`;
  return r ? toTaiLieu(r) : undefined;
}

/** Ghi một lượt mở trang chi tiết; dùng để xếp mục "phổ biến". */
export async function tangLuotXem(loai: "quy-trinh" | "bieu-mau", ma: string): Promise<void> {
  if (loai === "quy-trinh") await sql`UPDATE procedures SET view_count = view_count + 1 WHERE code = ${ma}`;
  else await sql`UPDATE form_templates SET view_count = view_count + 1 WHERE code = ${ma}`;
}
