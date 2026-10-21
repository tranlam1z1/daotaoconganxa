/**
 * Nhóm học cùng (docs/PLAN.md GĐ16a, docs/PROMPT_NHOM_HOC_CUNG.md mục 2): đọc và ghi CSDL.
 * Luật tính phần trăm, mã mời và giới hạn ở packages/dao-tao/src/nhom-hoc.ts.
 *
 * Ranh giới:
 * - Mọi hàm nhận id tài khoản của người gọi và tự kiểm tư cách thành viên. Người không đang ở
 *   trong nhóm (kể cả đã rời, kể cả quản lý) nhận `khong_tim_thay`, để không lộ nhóm có tồn tại.
 * - Nhóm `luu_tru` đọc được; mọi thao tác ghi báo `xung_dot`. Thứ tự kiểm khi ghi: thành viên
 *   (404), trạng thái nhóm (409), quyền trưởng nhóm (403).
 * - Hàm chỉ trả phần trăm, không trả điểm, số câu đúng, số lần làm.
 * - Trưởng nhóm bị khóa tài khoản (N16): lần đọc hoặc ghi kế tiếp chuyển quyền cho thành viên vào
 *   sớm nhất còn hoạt động; không còn ai thì nhóm chuyển `luu_tru`.
 */
import { createHash } from "node:crypto";
import {
  type BangMa,
  type CauHoiNguon,
  chuanHoaMaMoi,
  type DauVaoGoiYThuTu,
  type DauVaoTomTat,
  type DuLieuMucCuaNguoi,
  dungCauThuThach,
  dungDauVaoGoiYThuTu,
  dungDauVaoTomTat,
  GIOI_HAN_NHOM,
  khoaDuLieuMuc,
  type LoaiMucNhom,
  type MucNhomTinh,
  ngayCoVu,
  ngayVietNam,
  phanTramMuc,
  rutCauLuyenTap,
  sinhMaMoi,
  type TrangThaiMucNhom,
  tinhTienDoNhom,
  trangThaiMuc,
} from "@qdpl/dao-tao";
import { sql, type Tx } from "./client.ts";
import { cauHoiDaDuyetTheoId } from "./diem-thuong.ts";
import { chuDeLuyenTap, nguonTheoChuDe, taoPhienLuyenTap } from "./luyen-tap.ts";

export type LoaiLoiNhom =
  | "khong_tim_thay"
  | "xung_dot"
  | "khong_hop_le"
  | "khong_du_quyen"
  | "qua_han_muc"
  | "ngoai_pham_vi";

export class LoiNhom extends Error {
  constructor(
    message: string,
    readonly loai: LoaiLoiNhom,
  ) {
    super(message);
  }
}

const KHONG_CO_NHOM = "Không tìm thấy nhóm.";
const loi = (message: string, loai: LoaiLoiNhom) => new LoiNhom(message, loai);

export type VaiTroNhom = "truong_nhom" | "thanh_vien";
export type TrangThaiNhom = "hoat_dong" | "luu_tru";

/* ------------------------------------------------------------------ */
/* Tư cách thành viên, khóa khi ghi                                    */
/* ------------------------------------------------------------------ */

async function doiTruongNhom(tx: Tx, groupId: string, cu: string, moi: string): Promise<void> {
  // Hạ trưởng nhóm cũ trước để không vi phạm chỉ mục "mỗi nhóm một trưởng nhóm".
  await tx`UPDATE study_group_members SET role = 'thanh_vien' WHERE group_id = ${groupId} AND account_id = ${cu}`;
  await tx`UPDATE study_group_members SET role = 'truong_nhom' WHERE group_id = ${groupId} AND account_id = ${moi}`;
  await tx`UPDATE study_groups SET owner_account_id = ${moi}, updated_at = now() WHERE id = ${groupId}`;
}

/** N16: trưởng nhóm bị khóa tài khoản thì chuyển quyền, hoặc lưu trữ nhóm khi không còn ai. */
async function xuLyTruongNhomBiKhoa(groupId: string): Promise<void> {
  const [g] = (await sql`
    SELECT g.status, a.enabled FROM study_groups g JOIN accounts a ON a.id = g.owner_account_id
    WHERE g.id = ${groupId}`) as any[];
  if (g?.status !== "hoat_dong" || g.enabled) return;
  await sql.begin(async (tx) => {
    const [k] = (await tx`
      SELECT g.owner_account_id, g.status, a.enabled FROM study_groups g
      JOIN accounts a ON a.id = g.owner_account_id
      WHERE g.id = ${groupId} FOR UPDATE OF g`) as any[];
    if (k?.status !== "hoat_dong" || k.enabled) return;
    const [moi] = (await tx`
      SELECT m.account_id FROM study_group_members m JOIN accounts a ON a.id = m.account_id
      WHERE m.group_id = ${groupId} AND m.left_at IS NULL AND a.enabled AND m.account_id <> ${k.owner_account_id}
      ORDER BY m.joined_at, m.account_id LIMIT 1`) as any[];
    if (moi) await doiTruongNhom(tx, groupId, k.owner_account_id, moi.account_id);
    else
      await tx`
        UPDATE study_groups SET status = 'luu_tru', archived_at = now(), archived_by = NULL, updated_at = now()
        WHERE id = ${groupId}`;
  });
}

interface NhomCuaThanhVien {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  status: TrangThaiNhom;
  role: VaiTroNhom;
}

/** Nhóm và vai trò của người đang ở trong nhóm; không phải thì 404. */
async function layThanhVien(groupId: string, accountId: string): Promise<NhomCuaThanhVien> {
  await xuLyTruongNhomBiKhoa(groupId);
  const [r] = (await sql`
    SELECT g.id, g.name, g.description, g.invite_code, g.status, m.role
    FROM study_groups g
    JOIN study_group_members m ON m.group_id = g.id AND m.account_id = ${accountId} AND m.left_at IS NULL
    WHERE g.id = ${groupId}`) as any[];
  if (!r) throw loi(KHONG_CO_NHOM, "khong_tim_thay");
  return r as NhomCuaThanhVien;
}

/** Khóa dòng nhóm trong giao dịch rồi kiểm: thành viên (404), nhóm còn hoạt động (409), trưởng nhóm (403). */
async function khoaNhomDeGhi(
  tx: Tx,
  groupId: string,
  accountId: string,
  canTruongNhom: boolean,
): Promise<{ vai_tro: VaiTroNhom }> {
  const [g] = (await tx`SELECT status FROM study_groups WHERE id = ${groupId} FOR UPDATE`) as any[];
  const [m] = g
    ? ((await tx`
        SELECT role FROM study_group_members
        WHERE group_id = ${groupId} AND account_id = ${accountId} AND left_at IS NULL`) as any[])
    : [];
  if (!g || !m) throw loi(KHONG_CO_NHOM, "khong_tim_thay");
  if (g.status !== "hoat_dong") throw loi("Nhóm đã lưu trữ, chỉ còn xem được.", "xung_dot");
  if (canTruongNhom && m.role !== "truong_nhom")
    throw loi("Chỉ trưởng nhóm làm được việc này.", "khong_du_quyen");
  return { vai_tro: m.role };
}

async function ghiTrongNhom<T>(
  groupId: string,
  accountId: string,
  canTruongNhom: boolean,
  fn: (tx: Tx, ng: { vai_tro: VaiTroNhom }) => Promise<T>,
): Promise<T> {
  await xuLyTruongNhomBiKhoa(groupId);
  return (await sql.begin(async (tx) =>
    fn(tx, await khoaNhomDeGhi(tx, groupId, accountId, canTruongNhom)),
  )) as T;
}

/** Thành viên đang ở trong nhóm (dùng cho người được cổ vũ, mời ra, nhận quyền). */
async function trangThaiThanhVien(
  tx: Tx,
  groupId: string,
  accountId: string,
): Promise<"dang_o" | "da_roi" | "khong_co"> {
  const [m] = (await tx`
    SELECT left_at FROM study_group_members WHERE group_id = ${groupId} AND account_id = ${accountId}`) as any[];
  if (!m) return "khong_co";
  return m.left_at ? "da_roi" : "dang_o";
}

/** Khóa dòng tài khoản để các lần tạo nhóm, tham gia nhóm của cùng một người chạy lần lượt. */
async function khoaTaiKhoan(tx: Tx, accountId: string): Promise<void> {
  await tx`SELECT id FROM accounts WHERE id = ${accountId} FOR UPDATE`;
}

async function kiemSoNhomThamGia(tx: Tx, accountId: string): Promise<void> {
  const [r] = (await tx`
    SELECT count(*)::int AS n FROM study_group_members m JOIN study_groups g ON g.id = m.group_id
    WHERE m.account_id = ${accountId} AND m.left_at IS NULL AND g.status = 'hoat_dong'`) as any[];
  if (r.n >= GIOI_HAN_NHOM.nhomThamGia) {
    throw loi(`Mỗi người tham gia tối đa ${GIOI_HAN_NHOM.nhomThamGia} nhóm đang hoạt động.`, "xung_dot");
  }
}

async function maMoiMoi(tx: Tx): Promise<string> {
  for (;;) {
    const ma = sinhMaMoi();
    const [co] = (await tx`SELECT 1 FROM study_groups WHERE invite_code = ${ma}`) as any[];
    if (!co) return ma;
  }
}

/* ------------------------------------------------------------------ */
/* Tiến độ                                                             */
/* ------------------------------------------------------------------ */

interface MucDb {
  id: string;
  group_id: string;
  kind: LoaiMucNhom;
  title: string;
  topic_id: string | null;
  topic_name: string | null;
  due_date: string | null;
  shared_by: string | null;
  lesson_slug: string | null;
  course_slug: string | null;
  con_xuat_ban: boolean;
  so_khoi: number;
  so_cau: number;
  so_cau_con_duyet: number;
}

/** Mục chưa gỡ của các nhóm, trong MỘT truy vấn; mỗi nhóm theo thứ tự trưởng nhóm đã sắp. */
async function docMucCacNhom(groupIds: readonly string[]): Promise<MucDb[]> {
  if (!groupIds.length) return [];
  return (await sql`
    SELECT i.id, i.group_id, i.kind, COALESCE(l.title, i.title) AS title, i.topic_id, t.name AS topic_name,
           i.due_date::text AS due_date, i.shared_by, l.slug AS lesson_slug, c.slug AS course_slug,
           COALESCE(l.status = 'xuat_ban' AND c.status = 'xuat_ban', false) AS con_xuat_ban,
           (SELECT count(*)::int FROM lesson_blocks b WHERE b.lesson_id = i.lesson_id) AS so_khoi,
           COALESCE(cardinality(i.question_ids), 0) AS so_cau,
           (SELECT count(*)::int FROM questions q
             WHERE q.id = ANY(i.question_ids) AND q.status = 'da_duyet') AS so_cau_con_duyet
    FROM study_group_items i
    LEFT JOIN lessons l ON l.id = i.lesson_id
    LEFT JOIN courses c ON c.id = l.course_id
    LEFT JOIN question_topics t ON t.id = i.topic_id
    WHERE i.group_id = ANY(${groupIds as string[]}::uuid[]) AND i.removed_at IS NULL
    ORDER BY i.group_id, i.ordinal, i.created_at, i.id`) as unknown as MucDb[];
}

async function docMuc(groupId: string): Promise<MucDb[]> {
  return await docMucCacNhom([groupId]);
}

/** Gom mục theo nhóm, giữ thứ tự. */
function mucTheoNhom(muc: readonly MucDb[]): Map<string, MucDb[]> {
  const ra = new Map<string, MucDb[]>();
  for (const m of muc) {
    const ds = ra.get(m.group_id);
    if (ds) ds.push(m);
    else ra.set(m.group_id, [m]);
  }
  return ra;
}

/**
 * Dữ liệu gốc của mọi (thành viên đang ở trong nhóm × mục chưa gỡ) trong MỘT truy vấn: tiến độ bài
 * học qua ghi danh của chuyên đề chứa bài, và các phiên `nhom` của đề ôn tập. `chiNguoi` giới hạn
 * một người (xem tiến độ của một thành viên).
 */
async function docDuLieuTienDo(groupId: string, chiNguoi?: string): Promise<Map<string, DuLieuMucCuaNguoi>> {
  return await docDuLieuTienDoCacNhom([groupId], chiNguoi ? [chiNguoi] : undefined);
}

/**
 * Như `docDuLieuTienDo` cho nhiều nhóm cùng lúc, vẫn MỘT truy vấn. Khóa là (người, mục) và id mục
 * không trùng giữa các nhóm, nên một người ở nhiều nhóm không bị lẫn. `chiNguoi` giới hạn danh
 * sách người (thành viên trong phạm vi của quản lý, người trong báo cáo).
 */
async function docDuLieuTienDoCacNhom(
  groupIds: readonly string[],
  chiNguoi?: readonly string[],
): Promise<Map<string, DuLieuMucCuaNguoi>> {
  const ra = new Map<string, DuLieuMucCuaNguoi>();
  if (!groupIds.length || chiNguoi?.length === 0) return ra;
  // Chỉ đếm câu đã trả lời của phiên đang làm: phiên đã kết thúc luôn là 100 (N6) nên không cần
  // đếm, và phần lớn phiên đã kết thúc (báo cáo nhiều người đỡ hàng nghìn lượt đếm).
  const rows = (await sql`
    SELECT m.account_id, i.id AS item_id, lp.state, lp.last_block_ordinal,
           CASE WHEN i.kind = 'de_on_tap' THEN (
             SELECT COALESCE(json_agg(json_build_object(
                      'da_ket_thuc', s.finished_at IS NOT NULL,
                      'tong', s.total,
                      'da_tra_loi', CASE WHEN s.finished_at IS NULL
                                         THEN (SELECT count(*) FROM practice_answers a WHERE a.session_id = s.id)
                                         ELSE 0 END)), '[]'::json)
             FROM practice_sessions s WHERE s.group_item_id = i.id AND s.account_id = m.account_id)
           END AS phien
    FROM study_group_members m
    JOIN study_group_items i ON i.group_id = m.group_id AND i.removed_at IS NULL
    LEFT JOIN lessons l ON l.id = i.lesson_id
    LEFT JOIN enrollments e ON e.account_id = m.account_id AND e.course_id = l.course_id
    LEFT JOIN lesson_progress lp ON lp.enrollment_id = e.id AND lp.lesson_id = i.lesson_id
    WHERE m.group_id = ANY(${groupIds as string[]}::uuid[]) AND m.left_at IS NULL
      ${chiNguoi ? sql`AND m.account_id = ANY(${chiNguoi as string[]}::uuid[])` : sql``}`) as any[];
  for (const r of rows) {
    ra.set(khoaDuLieuMuc(r.account_id, r.item_id), {
      bai: r.state ? { state: r.state, last_block_ordinal: Number(r.last_block_ordinal ?? 0) } : null,
      phien: r.phien ?? [],
    });
  }
  return ra;
}

const sangMucTinh = (m: MucDb): MucNhomTinh => ({
  id: m.id,
  loai: m.kind,
  con_xuat_ban: m.con_xuat_ban,
  so_khoi: m.so_khoi,
  so_cau_con_duyet: m.so_cau_con_duyet,
});

interface ThanhVienDb {
  account_id: string;
  ho_ten: string;
  role: VaiTroNhom;
  luot_co_vu: number;
  da_co_vu: boolean;
}

async function docThanhVien(groupId: string, nguoiXem: string, ngay: string): Promise<ThanhVienDb[]> {
  return (await sql`
    SELECT m.account_id, COALESCE(NULLIF(a.name, ''), a.username, 'Thành viên') AS ho_ten, m.role,
           (SELECT count(*)::int FROM study_group_cheers c
             WHERE c.group_id = m.group_id AND c.to_account_id = m.account_id) AS luot_co_vu,
           EXISTS (SELECT 1 FROM study_group_cheers c
                    WHERE c.group_id = m.group_id AND c.to_account_id = m.account_id
                      AND c.from_account_id = ${nguoiXem} AND c.day = ${ngay}::date) AS da_co_vu
    FROM study_group_members m JOIN accounts a ON a.id = m.account_id
    WHERE m.group_id = ${groupId} AND m.left_at IS NULL
    ORDER BY (m.role = 'truong_nhom') DESC, m.joined_at, m.account_id`) as unknown as ThanhVienDb[];
}

/* ------------------------------------------------------------------ */
/* Đọc                                                                 */
/* ------------------------------------------------------------------ */

export interface NhomTomTat {
  id: string;
  ten: string;
  trang_thai: TrangThaiNhom;
  vai_tro: VaiTroNhom;
  so_thanh_vien: number;
  phan_tram_cua_toi: number | null;
  trung_binh_nhom: number | null;
}

/** Nhóm tôi đang ở trong, kèm phần trăm của tôi và trung bình nhóm (mỗi nhóm một lượt truy vấn). */
export async function nhomCuaToi(accountId: string): Promise<NhomTomTat[]> {
  const ds = (await sql`
    SELECT g.id, g.name, g.status, m.role,
           (SELECT count(*)::int FROM study_group_members x WHERE x.group_id = g.id AND x.left_at IS NULL) AS so_thanh_vien
    FROM study_group_members m JOIN study_groups g ON g.id = m.group_id
    WHERE m.account_id = ${accountId} AND m.left_at IS NULL
    ORDER BY (g.status = 'hoat_dong') DESC, g.updated_at DESC, g.id`) as any[];
  return await Promise.all(
    ds.map(async (g): Promise<NhomTomTat> => {
      const [muc, duLieu, thanhVien] = await Promise.all([
        docMuc(g.id),
        docDuLieuTienDo(g.id),
        sql`SELECT account_id FROM study_group_members WHERE group_id = ${g.id} AND left_at IS NULL`,
      ]);
      const td = tinhTienDoNhom({
        muc: muc.map(sangMucTinh),
        thanhVien: (thanhVien as any[]).map((r) => r.account_id as string),
        duLieu,
      });
      return {
        id: g.id,
        ten: g.name,
        trang_thai: g.status,
        vai_tro: g.role,
        so_thanh_vien: g.so_thanh_vien,
        phan_tram_cua_toi: td.thanh_vien.find((t) => t.account_id === accountId)?.phan_tram ?? null,
        trung_binh_nhom: td.trung_binh,
      };
    }),
  );
}

export interface MucChoThanhVien {
  id: string;
  loai: LoaiMucNhom;
  ten: string;
  chu_de: string | null;
  /** Đề ôn tập: số câu chốt lúc chia sẻ. */
  so_cau: number | null;
  han_goi_y: string | null;
  trang_thai: TrangThaiMucNhom;
  phan_tram_cua_toi: number | null;
  /** Tôi là người chia sẻ (được gỡ mục này). */
  cua_toi: boolean;
}

export interface ChiTietNhom {
  id: string;
  ten: string;
  mo_ta: string | null;
  trang_thai: TrangThaiNhom;
  ma_moi: string;
  vai_tro_cua_toi: VaiTroNhom;
  phan_tram_cua_toi: number | null;
  trung_binh_nhom: number | null;
  muc: MucChoThanhVien[];
  thanh_vien: Array<{
    id: string;
    ho_ten: string;
    vai_tro: VaiTroNhom;
    phan_tram: number | null;
    luot_co_vu: number;
    da_co_vu: boolean;
    la_toi: boolean;
  }>;
}

/** Chi tiết cho thành viên: mục kèm phần trăm của tôi, thành viên kèm phần trăm chung và lượt cổ vũ. */
export async function chiTietNhom(
  groupId: string,
  accountId: string,
  now = new Date(),
): Promise<ChiTietNhom> {
  const g = await layThanhVien(groupId, accountId);
  const [muc, duLieu, thanhVien] = await Promise.all([
    docMuc(groupId),
    docDuLieuTienDo(groupId),
    docThanhVien(groupId, accountId, ngayCoVu(now)),
  ]);
  const mucTinh = muc.map(sangMucTinh);
  const td = tinhTienDoNhom({ muc: mucTinh, thanhVien: thanhVien.map((t) => t.account_id), duLieu });
  const cuaToi = td.thanh_vien.find((t) => t.account_id === accountId);
  const theoNguoi = new Map(td.thanh_vien.map((t) => [t.account_id, t]));
  return {
    id: g.id,
    ten: g.name,
    mo_ta: g.description,
    trang_thai: g.status,
    ma_moi: g.invite_code,
    vai_tro_cua_toi: g.role,
    phan_tram_cua_toi: cuaToi?.phan_tram ?? null,
    trung_binh_nhom: td.trung_binh,
    muc: muc.map((m, i) => ({
      id: m.id,
      loai: m.kind,
      ten: m.title,
      chu_de: m.topic_name,
      so_cau: m.kind === "de_on_tap" ? m.so_cau : null,
      han_goi_y: m.due_date,
      trang_thai: trangThaiMuc(mucTinh[i]!),
      phan_tram_cua_toi: cuaToi?.muc[m.id] ?? null,
      cua_toi: m.shared_by === accountId,
    })),
    thanh_vien: thanhVien.map((t) => ({
      id: t.account_id,
      ho_ten: t.ho_ten,
      vai_tro: t.role,
      phan_tram: theoNguoi.get(t.account_id)?.phan_tram ?? null,
      luot_co_vu: t.luot_co_vu,
      da_co_vu: t.da_co_vu,
      la_toi: t.account_id === accountId,
    })),
  };
}

/** Phần trăm từng mục của một thành viên đang ở trong nhóm, cho thành viên khác xem. */
export async function tienDoThanhVien(groupId: string, nguoiXem: string, accountId: string) {
  await layThanhVien(groupId, nguoiXem);
  const [t] = (await sql`
    SELECT COALESCE(NULLIF(a.name, ''), a.username, 'Thành viên') AS ho_ten
    FROM study_group_members m JOIN accounts a ON a.id = m.account_id
    WHERE m.group_id = ${groupId} AND m.account_id = ${accountId} AND m.left_at IS NULL`) as any[];
  if (!t) throw loi("Không có thành viên này trong nhóm.", "khong_tim_thay");
  const [muc, duLieu] = await Promise.all([docMuc(groupId), docDuLieuTienDo(groupId, accountId)]);
  const mucTinh = muc.map(sangMucTinh);
  const td = tinhTienDoNhom({ muc: mucTinh, thanhVien: [accountId], duLieu });
  return {
    thanh_vien: { id: accountId, ho_ten: t.ho_ten as string },
    phan_tram: td.thanh_vien[0]?.phan_tram ?? null,
    muc: muc.map((m, i) => ({
      id: m.id,
      loai: m.kind,
      ten: m.title,
      trang_thai: trangThaiMuc(mucTinh[i]!),
      phan_tram: phanTramMuc(mucTinh[i]!, duLieu.get(khoaDuLieuMuc(accountId, m.id))),
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Mã mời                                                              */
/* ------------------------------------------------------------------ */

/** Đ8: sai mã mời quá số lần cho phép trong cửa sổ thì từ chối, kể cả khi xem trước. */
async function kiemLanThuMa(accountId: string, now: Date): Promise<void> {
  const [r] = (await sql`
    SELECT count(*)::int AS n FROM study_group_join_attempts
    WHERE account_id = ${accountId} AND NOT ok
      AND created_at > ${now}::timestamptz - make_interval(mins => ${GIOI_HAN_NHOM.maMoiCuaSoPhut})`) as any[];
  if (r.n >= GIOI_HAN_NHOM.maMoiSaiToiDa) {
    throw loi(
      `Nhập sai mã mời quá nhiều lần. Thử lại sau ${GIOI_HAN_NHOM.maMoiCuaSoPhut} phút.`,
      "qua_han_muc",
    );
  }
}

/** Tìm nhóm theo mã; ghi lượt thử (đúng hoặc sai). Mã sai dạng hay không có nhóm đều là 404. */
async function timTheoMa(raw: string, accountId: string, now: Date): Promise<{ id: string }> {
  await kiemLanThuMa(accountId, now);
  const ma = chuanHoaMaMoi(raw);
  const [g] = ma ? ((await sql`SELECT id FROM study_groups WHERE invite_code = ${ma}`) as any[]) : [];
  await sql`INSERT INTO study_group_join_attempts (account_id, ok, created_at) VALUES (${accountId}, ${Boolean(g)}, ${now})`;
  if (!g) throw loi("Mã mời không đúng hoặc đã được đổi.", "khong_tim_thay");
  return g;
}

/** Xem trước nhóm trước khi tham gia: tên, số thành viên, họ tên trưởng nhóm. */
export async function xemTruocTheoMa(raw: string, accountId: string, now = new Date()) {
  const { id } = await timTheoMa(raw, accountId, now);
  await xuLyTruongNhomBiKhoa(id);
  const [g] = (await sql`
    SELECT g.id, g.name, g.status,
           COALESCE(NULLIF(a.name, ''), a.username, 'Thành viên') AS truong_nhom,
           (SELECT count(*)::int FROM study_group_members m WHERE m.group_id = g.id AND m.left_at IS NULL) AS so_thanh_vien,
           EXISTS (SELECT 1 FROM study_group_members m
                    WHERE m.group_id = g.id AND m.account_id = ${accountId} AND m.left_at IS NULL) AS da_la_thanh_vien
    FROM study_groups g JOIN accounts a ON a.id = g.owner_account_id
    WHERE g.id = ${id}`) as any[];
  return {
    id: g.id as string,
    ten: g.name as string,
    trang_thai: g.status as TrangThaiNhom,
    truong_nhom: g.truong_nhom as string,
    so_thanh_vien: g.so_thanh_vien as number,
    da_la_thanh_vien: g.da_la_thanh_vien as boolean,
  };
}

/** Tham gia bằng mã mời. Đã ở trong nhóm thì trả nhóm đó; đã rời thì vào lại. */
export async function thamGiaNhom(raw: string, accountId: string, now = new Date()): Promise<{ id: string }> {
  const { id } = await timTheoMa(raw, accountId, now);
  await xuLyTruongNhomBiKhoa(id);
  await sql.begin(async (tx) => {
    const [g] = (await tx`SELECT status FROM study_groups WHERE id = ${id} FOR UPDATE`) as any[];
    if (g.status !== "hoat_dong") throw loi("Nhóm đã lưu trữ, không nhận thêm thành viên.", "xung_dot");
    const trangThai = await trangThaiThanhVien(tx, id, accountId);
    if (trangThai === "dang_o") return;
    const [n] = (await tx`
      SELECT count(*)::int AS n FROM study_group_members WHERE group_id = ${id} AND left_at IS NULL`) as any[];
    if (n.n >= GIOI_HAN_NHOM.thanhVienMoiNhom) {
      throw loi(`Nhóm đã đủ ${GIOI_HAN_NHOM.thanhVienMoiNhom} thành viên.`, "xung_dot");
    }
    await khoaTaiKhoan(tx, accountId);
    await kiemSoNhomThamGia(tx, accountId);
    await tx`
      INSERT INTO study_group_members (group_id, account_id, role, joined_at)
      VALUES (${id}, ${accountId}, 'thanh_vien', now())
      ON CONFLICT (group_id, account_id) DO UPDATE SET
        role = 'thanh_vien', joined_at = now(), left_at = NULL, removed_by = NULL`;
    await tx`UPDATE study_groups SET updated_at = now() WHERE id = ${id}`;
  });
  return { id };
}

/* ------------------------------------------------------------------ */
/* Ghi: nhóm, thành viên                                               */
/* ------------------------------------------------------------------ */

export async function taoNhom(p: {
  accountId: string;
  ten: string;
  moTa?: string | null;
}): Promise<{ id: string; ten: string; ma_moi: string }> {
  return (await sql.begin(async (tx) => {
    await khoaTaiKhoan(tx, p.accountId);
    const [dangLam] = (await tx`
      SELECT count(*)::int AS n FROM study_groups WHERE owner_account_id = ${p.accountId} AND status = 'hoat_dong'`) as any[];
    if (dangLam.n >= GIOI_HAN_NHOM.nhomTruongNhomDangHoatDong) {
      throw loi(
        `Mỗi người làm trưởng nhóm tối đa ${GIOI_HAN_NHOM.nhomTruongNhomDangHoatDong} nhóm đang hoạt động.`,
        "xung_dot",
      );
    }
    await kiemSoNhomThamGia(tx, p.accountId);
    const ma = await maMoiMoi(tx);
    const [g] = (await tx`
      INSERT INTO study_groups (name, description, owner_account_id, unit_id, invite_code)
      VALUES (${p.ten}, ${p.moTa ?? null}, ${p.accountId},
              (SELECT unit_id FROM accounts WHERE id = ${p.accountId}), ${ma})
      RETURNING id, name`) as any[];
    await tx`
      INSERT INTO study_group_members (group_id, account_id, role) VALUES (${g.id}, ${p.accountId}, 'truong_nhom')`;
    return { id: g.id as string, ten: g.name as string, ma_moi: ma };
  })) as { id: string; ten: string; ma_moi: string };
}

export async function suaNhom(
  groupId: string,
  accountId: string,
  p: { ten?: string; moTa?: string | null },
): Promise<void> {
  await ghiTrongNhom(groupId, accountId, true, async (tx) => {
    await tx`
      UPDATE study_groups SET
        name = COALESCE(${p.ten ?? null}, name),
        description = CASE WHEN ${p.moTa !== undefined} THEN ${p.moTa ?? null} ELSE description END,
        updated_at = now()
      WHERE id = ${groupId}`;
  });
}

/** Đổi mã mời: mã cũ hết dùng ngay. */
export async function doiMaMoi(groupId: string, accountId: string): Promise<{ ma_moi: string }> {
  return await ghiTrongNhom(groupId, accountId, true, async (tx) => {
    const ma = await maMoiMoi(tx);
    await tx`UPDATE study_groups SET invite_code = ${ma}, updated_at = now() WHERE id = ${groupId}`;
    return { ma_moi: ma };
  });
}

/**
 * Rời nhóm. Trưởng nhóm phải chuyển quyền trước khi rời, trừ khi là người cuối; người cuối rời
 * thì nhóm tự chuyển `luu_tru`.
 */
export async function roiNhom(
  groupId: string,
  accountId: string,
): Promise<{ trang_thai_nhom: TrangThaiNhom }> {
  return await ghiTrongNhom(groupId, accountId, false, async (tx, ng) => {
    const [con] = (await tx`
      SELECT count(*)::int AS n FROM study_group_members
      WHERE group_id = ${groupId} AND left_at IS NULL AND account_id <> ${accountId}`) as any[];
    if (ng.vai_tro === "truong_nhom" && con.n > 0) {
      throw loi("Chuyển quyền trưởng nhóm cho một thành viên khác trước khi rời nhóm.", "xung_dot");
    }
    await tx`
      UPDATE study_group_members SET left_at = now() WHERE group_id = ${groupId} AND account_id = ${accountId}`;
    if (con.n === 0) {
      await tx`
        UPDATE study_groups SET status = 'luu_tru', archived_at = now(), archived_by = NULL, updated_at = now()
        WHERE id = ${groupId}`;
      return { trang_thai_nhom: "luu_tru" as const };
    }
    await tx`UPDATE study_groups SET updated_at = now() WHERE id = ${groupId}`;
    return { trang_thai_nhom: "hoat_dong" as const };
  });
}

export async function moiRaKhoiNhom(groupId: string, truongNhom: string, accountId: string): Promise<void> {
  await ghiTrongNhom(groupId, truongNhom, true, async (tx) => {
    if (accountId === truongNhom)
      throw loi("Trưởng nhóm không tự mời mình ra; dùng Rời nhóm.", "khong_hop_le");
    if ((await trangThaiThanhVien(tx, groupId, accountId)) !== "dang_o") {
      throw loi("Không có thành viên này trong nhóm.", "khong_tim_thay");
    }
    await tx`
      UPDATE study_group_members SET left_at = now(), removed_by = ${truongNhom}
      WHERE group_id = ${groupId} AND account_id = ${accountId}`;
    await tx`UPDATE study_groups SET updated_at = now() WHERE id = ${groupId}`;
  });
}

export async function chuyenTruongNhom(
  groupId: string,
  truongNhom: string,
  accountId: string,
): Promise<void> {
  await ghiTrongNhom(groupId, truongNhom, true, async (tx) => {
    if (accountId === truongNhom) throw loi("Bạn đang là trưởng nhóm.", "khong_hop_le");
    if ((await trangThaiThanhVien(tx, groupId, accountId)) !== "dang_o") {
      throw loi("Không có thành viên này trong nhóm.", "khong_tim_thay");
    }
    const [a] = (await tx`SELECT enabled FROM accounts WHERE id = ${accountId}`) as any[];
    if (!a?.enabled)
      throw loi("Tài khoản này đang bị khóa, không nhận được quyền trưởng nhóm.", "khong_hop_le");
    await doiTruongNhom(tx, groupId, truongNhom, accountId);
  });
}

export async function luuTruNhom(groupId: string, accountId: string): Promise<void> {
  await ghiTrongNhom(groupId, accountId, true, async (tx) => {
    await tx`
      UPDATE study_groups SET status = 'luu_tru', archived_at = now(), archived_by = ${accountId}, updated_at = now()
      WHERE id = ${groupId}`;
  });
}

/* ------------------------------------------------------------------ */
/* Ghi: mục chia sẻ                                                    */
/* ------------------------------------------------------------------ */

const thoatLike = (s: string) => s.replace(/[\\%_]/g, (k) => `\\${k}`);

/** Bài có thể chia sẻ: bài và chuyên đề đều `xuat_ban` (Đ1). */
export async function nguonBaiHoc(q?: string) {
  const tim = q?.trim() ? `%${thoatLike(q.trim())}%` : null;
  return (await sql`
    SELECT l.id, l.title AS ten, c.title AS chuyen_de, l.estimated_minutes AS so_phut
    FROM lessons l JOIN courses c ON c.id = l.course_id
    WHERE l.status = 'xuat_ban' AND c.status = 'xuat_ban'
      ${tim ? sql`AND (l.title ILIKE ${tim} OR c.title ILIKE ${tim})` : sql``}
    ORDER BY c.title, l.ordinal, l.id
    LIMIT 30`) as unknown as Array<{ id: string; ten: string; chuyen_de: string; so_phut: number }>;
}

/** Chủ đề có từ 5 câu đã duyệt trở lên (gồm chủ đề con), để dựng đề ôn tập. */
export async function nguonChuDe(accountId: string, q?: string) {
  const tim = q?.trim().toLocaleLowerCase("vi");
  return (await chuDeLuyenTap(accountId))
    .filter((t) => t.so_cau >= GIOI_HAN_NHOM.cauDeOnTap.toiThieu)
    .filter((t) => !tim || t.name.toLocaleLowerCase("vi").includes(tim))
    .map((t) => ({ id: t.id, ten: t.name, so_cau: t.so_cau }));
}

export type MucChiaSe =
  | { loai: "bai_hoc"; lessonId: string }
  | { loai: "de_on_tap"; topicId: string; soCau: number; ten: string };

export async function chiaSeMuc(groupId: string, accountId: string, m: MucChiaSe): Promise<{ id: string }> {
  // Chọn câu trước khi khóa nhóm: chỉ đọc, và không để việc rút câu kéo dài thời gian giữ khóa.
  let questionIds: string[] | null = null;
  if (m.loai === "de_on_tap") {
    const [t] = (await sql`SELECT id FROM question_topics WHERE id = ${m.topicId}`) as any[];
    if (!t) throw loi("Không có chủ đề này.", "khong_tim_thay");
    const nguon = (await nguonTheoChuDe(m.topicId)) as unknown as CauHoiNguon[];
    if (nguon.length < GIOI_HAN_NHOM.cauDeOnTap.toiThieu) {
      throw loi(
        `Chủ đề cần có từ ${GIOI_HAN_NHOM.cauDeOnTap.toiThieu} câu đã duyệt trở lên.`,
        "khong_hop_le",
      );
    }
    const seed = `${groupId}|${Date.now()}|${crypto.randomUUID()}`;
    questionIds = rutCauLuyenTap({ nguon, seed, soCau: m.soCau }).map((c) => c.question_id);
  }
  return await ghiTrongNhom(groupId, accountId, false, async (tx) => {
    const [n] = (await tx`
      SELECT count(*)::int AS n, COALESCE(max(ordinal) + 1, 0)::int AS tiep
      FROM study_group_items WHERE group_id = ${groupId} AND removed_at IS NULL`) as any[];
    if (n.n >= GIOI_HAN_NHOM.mucMoiNhom)
      throw loi(`Nhóm đã có đủ ${GIOI_HAN_NHOM.mucMoiNhom} mục.`, "xung_dot");
    if (m.loai === "bai_hoc") {
      const [l] = (await tx`
        SELECT l.status, c.status AS course_status FROM lessons l JOIN courses c ON c.id = l.course_id
        WHERE l.id = ${m.lessonId}`) as any[];
      if (!l) throw loi("Không có bài học này.", "khong_tim_thay");
      if (l.status !== "xuat_ban" || l.course_status !== "xuat_ban") {
        throw loi("Chỉ chia sẻ được bài học đã xuất bản.", "khong_hop_le");
      }
      const [trung] = (await tx`
        SELECT 1 FROM study_group_items
        WHERE group_id = ${groupId} AND lesson_id = ${m.lessonId} AND kind = 'bai_hoc' AND removed_at IS NULL`) as any[];
      if (trung) throw loi("Bài học này đã có trong nhóm.", "xung_dot");
      const [r] = (await tx`
        INSERT INTO study_group_items (group_id, kind, lesson_id, shared_by, ordinal)
        VALUES (${groupId}, 'bai_hoc', ${m.lessonId}, ${accountId}, ${n.tiep})
        RETURNING id`) as any[];
      return { id: r.id as string };
    }
    const [r] = (await tx`
      INSERT INTO study_group_items (group_id, kind, topic_id, question_ids, title, shared_by, ordinal)
      VALUES (${groupId}, 'de_on_tap', ${m.topicId}, ${questionIds}::uuid[], ${m.ten}, ${accountId}, ${n.tiep})
      RETURNING id`) as any[];
    return { id: r.id as string };
  });
}

async function mucDangCo(tx: Tx, groupId: string, itemId: string): Promise<{ shared_by: string | null }> {
  const [i] = (await tx`
    SELECT shared_by FROM study_group_items
    WHERE id = ${itemId} AND group_id = ${groupId} AND removed_at IS NULL`) as any[];
  if (!i) throw loi("Không có mục này trong nhóm.", "khong_tim_thay");
  return i;
}

/** Gỡ mục: trưởng nhóm gỡ mọi mục, thành viên chỉ gỡ mục do mình chia sẻ. Không xóa dòng. */
export async function goMuc(groupId: string, accountId: string, itemId: string): Promise<void> {
  await ghiTrongNhom(groupId, accountId, false, async (tx, ng) => {
    const i = await mucDangCo(tx, groupId, itemId);
    if (ng.vai_tro !== "truong_nhom" && i.shared_by !== accountId) {
      throw loi("Chỉ trưởng nhóm hoặc người chia sẻ gỡ được mục này.", "khong_du_quyen");
    }
    await tx`
      UPDATE study_group_items SET removed_at = now(), removed_by = ${accountId} WHERE id = ${itemId}`;
  });
}

/** Sắp thứ tự: `itemIds` phải là hoán vị đúng các mục đang có. */
export async function sapThuTuMuc(groupId: string, accountId: string, itemIds: string[]): Promise<void> {
  await ghiTrongNhom(groupId, accountId, true, async (tx) => {
    const dangCo = (
      (await tx`
      SELECT id FROM study_group_items WHERE group_id = ${groupId} AND removed_at IS NULL`) as any[]
    ).map((r) => r.id as string);
    const gui = new Set(itemIds);
    if (
      gui.size !== itemIds.length ||
      itemIds.length !== dangCo.length ||
      dangCo.some((id) => !gui.has(id))
    ) {
      throw loi("Danh sách phải gồm đúng mỗi mục đang có trong nhóm một lần.", "khong_hop_le");
    }
    await tx`
      UPDATE study_group_items i SET ordinal = x.thu_tu
      FROM unnest(${itemIds}::uuid[]) WITH ORDINALITY AS x(id, thu_tu)
      WHERE i.id = x.id`;
  });
}

/** Đặt hoặc bỏ hạn gợi ý (không khóa việc học). */
export async function datHanGoiY(groupId: string, accountId: string, itemId: string, han: string | null) {
  await ghiTrongNhom(groupId, accountId, true, async (tx) => {
    await mucDangCo(tx, groupId, itemId);
    await tx`UPDATE study_group_items SET due_date = ${han}::date WHERE id = ${itemId}`;
  });
}

export type BatDauMuc =
  | { loai: "bai_hoc"; duong_dan: string }
  | { loai: "de_on_tap"; phien_id: string; tong: number; da_co: boolean };

/**
 * Bắt đầu học một mục. Bài học: trả đường dẫn `/hoc/...`. Đề ôn tập: tạo phiên `nhom` theo đường
 * của thử thách hằng ngày (câu còn duyệt theo đúng thứ tự đã chốt, đảo phương án theo seed); đã có
 * phiên đang làm thì trả phiên đó.
 */
export async function batDauMuc(groupId: string, accountId: string, itemId: string): Promise<BatDauMuc> {
  const i = await ghiTrongNhom(groupId, accountId, false, async (tx) => {
    const [r] = (await tx`
      SELECT i.kind, i.topic_id, i.question_ids, l.slug AS lesson_slug, c.slug AS course_slug,
             COALESCE(l.status = 'xuat_ban' AND c.status = 'xuat_ban', false) AS con_xuat_ban
      FROM study_group_items i
      LEFT JOIN lessons l ON l.id = i.lesson_id
      LEFT JOIN courses c ON c.id = l.course_id
      WHERE i.id = ${itemId} AND i.group_id = ${groupId} AND i.removed_at IS NULL`) as any[];
    if (!r) throw loi("Không có mục này trong nhóm.", "khong_tim_thay");
    return r;
  });
  if (i.kind === "bai_hoc") {
    if (!i.con_xuat_ban) throw loi("Nội dung không còn được xuất bản.", "xung_dot");
    return { loai: "bai_hoc", duong_dan: `/hoc/${i.course_slug}/${i.lesson_slug}` };
  }
  const phienCu = async () => {
    const [p] = (await sql`
      SELECT id, total FROM practice_sessions
      WHERE group_item_id = ${itemId} AND account_id = ${accountId} AND finished_at IS NULL`) as any[];
    return p as { id: string; total: number } | undefined;
  };
  const cu = await phienCu();
  if (cu) return { loai: "de_on_tap", phien_id: cu.id, tong: cu.total, da_co: true };
  const ids = i.question_ids as string[];
  const nguon = await cauHoiDaDuyetTheoId(ids);
  if (nguon.length < GIOI_HAN_NHOM.cauDeOnTap.toiThieu) throw loi("Nội dung không còn đủ câu.", "xung_dot");
  const ds = dungCauThuThach(ids, nguon, `${itemId}|${accountId}|${Date.now()}`);
  try {
    const { id } = await taoPhienLuyenTap({
      accountId,
      topicId: i.topic_id,
      source: "nhom",
      items: ds,
      groupItemId: itemId,
    });
    return { loai: "de_on_tap", phien_id: id, tong: ds.length, da_co: false };
  } catch (e) {
    // Hai lần bấm cùng lúc: chỉ mục duy nhất `practice_sessions_nhom_dang_lam` giữ một phiên đang làm.
    const trung = await phienCu();
    if ((e as { code?: string }).code === "23505" && trung) {
      return { loai: "de_on_tap", phien_id: trung.id, tong: trung.total, da_co: true };
    }
    throw e;
  }
}

/** Mục nhóm của một phiên `nhom`, cho trang làm bài hiện tên đề và nút về nhóm (Đ14). */
export async function mucNhomCuaPhien(groupItemId: string): Promise<{ id: string; ten_de: string } | null> {
  const [r] = (await sql`
    SELECT group_id, title FROM study_group_items WHERE id = ${groupItemId}`) as any[];
  return r ? { id: r.group_id as string, ten_de: (r.title as string | null) ?? "" } : null;
}

/* ------------------------------------------------------------------ */
/* Cổ vũ                                                               */
/* ------------------------------------------------------------------ */

/**
 * Cổ vũ hoặc bỏ cổ vũ hôm nay (N7): mỗi người cổ vũ một thành viên khác tối đa một lần mỗi ngày
 * giờ Việt Nam trong mỗi nhóm; bấm lại trong ngày thì bỏ lượt. Không cộng XP (N8).
 */
export async function coVu(
  groupId: string,
  tu: string,
  den: string,
  now = new Date(),
): Promise<{ da_co_vu: boolean; tong: number }> {
  return await ghiTrongNhom(groupId, tu, false, async (tx) => {
    if (tu === den) throw loi("Không tự cổ vũ mình.", "khong_hop_le");
    const tt = await trangThaiThanhVien(tx, groupId, den);
    if (tt === "khong_co") throw loi("Không có thành viên này trong nhóm.", "khong_tim_thay");
    if (tt === "da_roi") throw loi("Thành viên này đã rời nhóm.", "khong_hop_le");
    const ngay = ngayCoVu(now);
    const bo = (await tx`
      DELETE FROM study_group_cheers
      WHERE group_id = ${groupId} AND from_account_id = ${tu} AND to_account_id = ${den} AND day = ${ngay}::date
      RETURNING id`) as any[];
    if (!bo.length) {
      await tx`
        INSERT INTO study_group_cheers (group_id, from_account_id, to_account_id, day)
        VALUES (${groupId}, ${tu}, ${den}, ${ngay}::date)
        ON CONFLICT ON CONSTRAINT study_group_cheers_mot_lan_moi_ngay DO NOTHING`;
    }
    const [t] = (await tx`
      SELECT count(*)::int AS n FROM study_group_cheers WHERE group_id = ${groupId} AND to_account_id = ${den}`) as any[];
    return { da_co_vu: bo.length === 0, tong: t.n as number };
  });
}

/* ------------------------------------------------------------------ */
/* Quản lý xem nhóm (GĐ16c)                                            */
/* ------------------------------------------------------------------ */

/**
 * Phạm vi quản lý áp ở câu truy vấn (docs/PLAN.md GĐ16c, N11, đề xuất Đ11):
 * - `phamVi` là đường dẫn ltree đơn vị gốc người gọi được xem; null là toàn bộ (quản trị).
 * - Thành viên "trong phạm vi" khi đơn vị HIỆN TẠI của tài khoản nằm trong cây đó. Tài khoản chưa
 *   gắn đơn vị ngoài phạm vi của mọi quản lý, chỉ quản trị thấy.
 * - Thành viên ngoài phạm vi chỉ được đếm: không trả họ tên, không trả id, không vào trung bình.
 * - Quản lý chỉ thấy nhóm có ít nhất một thành viên đang ở trong nhóm thuộc phạm vi; nhóm khác
 *   trả `khong_tim_thay` như nhóm không tồn tại.
 */
function trongPhamViSql(cot: ReturnType<typeof sql>, phamVi: string | null) {
  return phamVi === null ? sql`true` : sql`COALESCE(${cot} <@ ${phamVi}::ltree, false)`;
}

/** Nhóm có ít nhất một thành viên đang ở trong nhóm thuộc phạm vi (quản trị: mọi nhóm). */
function coThanhVienTrongPhamViSql(groupCot: ReturnType<typeof sql>, phamVi: string | null) {
  if (phamVi === null) return sql`true`;
  return sql`EXISTS (
    SELECT 1 FROM study_group_members pm
    JOIN accounts pa ON pa.id = pm.account_id
    JOIN units pu ON pu.id = pa.unit_id
    WHERE pm.group_id = ${groupCot} AND pm.left_at IS NULL AND pu.path <@ ${phamVi}::ltree)`;
}

/**
 * Lần học gần nhất của từng người (đề xuất Đ12): thời điểm lớn nhất trong
 * `lesson_progress.updated_at`, `practice_answers.created_at` (mọi nguồn phiên, kể cả trò chơi) và
 * `exam_attempts.submitted_at`. Không lọc theo khoảng ngày. Dùng chung cho trang quản lý nhóm và
 * báo cáo "Tiến độ học".
 */
export async function lanHocGanNhat(accountIds: readonly string[]): Promise<Map<string, Date | null>> {
  if (!accountIds.length) return new Map();
  // Gộp theo người trên từng bảng (mỗi bảng quét một lần) thay vì subquery tương quan theo từng
  // người: subquery chạy N lần và rất chậm khi thống kê bảng chưa kịp cập nhật sau đợt ghi lớn.
  const ids = accountIds as string[];
  const rows = (await sql`
    WITH bh AS (
      SELECT e.account_id, max(lp.updated_at) AS luc
      FROM enrollments e JOIN lesson_progress lp ON lp.enrollment_id = e.id
      WHERE e.account_id = ANY(${ids}::uuid[])
      GROUP BY e.account_id
    ),
    lt AS (
      SELECT s.account_id, max(pa.created_at) AS luc
      FROM practice_sessions s JOIN practice_answers pa ON pa.session_id = s.id
      WHERE s.account_id = ANY(${ids}::uuid[])
      GROUP BY s.account_id
    ),
    th AS (
      SELECT t.account_id, max(t.submitted_at) AS luc
      FROM exam_attempts t
      WHERE t.account_id = ANY(${ids}::uuid[]) AND t.status = 'da_nop'
      GROUP BY t.account_id
    )
    SELECT x.id, GREATEST(bh.luc, lt.luc, th.luc) AS luc
    FROM unnest(${ids}::uuid[]) AS x(id)
    LEFT JOIN bh ON bh.account_id = x.id
    LEFT JOIN lt ON lt.account_id = x.id
    LEFT JOIN th ON th.account_id = x.id`) as any[];
  return new Map(rows.map((r) => [r.id as string, (r.luc as Date | null) ?? null]));
}

/**
 * Phần trăm chung của từng người trong từng nhóm ĐANG HOẠT ĐỘNG mà người đó đang ở trong, tính
 * như trang nhóm (`tinhTienDoNhom`). Mỗi người một mảng, mỗi nhóm một phần tử; null là nhóm chưa
 * có mục nào được tính. Ba truy vấn cố định, không lặp theo người hay theo nhóm.
 */
export async function phanTramCacNhomCuaNguoi(
  accountIds: readonly string[],
): Promise<Map<string, Array<number | null>>> {
  const ra = new Map<string, Array<number | null>>();
  if (!accountIds.length) return ra;
  const thanhVien = (await sql`
    SELECT m.group_id, m.account_id FROM study_group_members m
    JOIN study_groups g ON g.id = m.group_id AND g.status = 'hoat_dong'
    WHERE m.left_at IS NULL AND m.account_id = ANY(${accountIds as string[]}::uuid[])`) as any[];
  if (!thanhVien.length) return ra;
  const groupIds = [...new Set(thanhVien.map((r) => r.group_id as string))];
  const [muc, duLieu] = await Promise.all([
    docMucCacNhom(groupIds),
    docDuLieuTienDoCacNhom(groupIds, accountIds),
  ]);
  const theoNhom = mucTheoNhom(muc);
  for (const r of thanhVien) {
    const td = tinhTienDoNhom({
      muc: (theoNhom.get(r.group_id) ?? []).map(sangMucTinh),
      thanhVien: [r.account_id],
      duLieu,
    });
    const ds = ra.get(r.account_id) ?? [];
    ds.push(td.thanh_vien[0]?.phan_tram ?? null);
    ra.set(r.account_id, ds);
  }
  return ra;
}

/** Nhóm người gọi được xem theo phạm vi, để lọc báo cáo theo nhóm; không thấy thì null. */
export async function nhomTrongPhamVi(
  groupId: string,
  phamVi: string | null,
): Promise<{ id: string; ten: string } | null> {
  const [g] = (await sql`
    SELECT g.id, g.name FROM study_groups g
    WHERE g.id = ${groupId} AND ${coThanhVienTrongPhamViSql(sql`g.id`, phamVi)}`) as any[];
  return g ? { id: g.id as string, ten: g.name as string } : null;
}

export interface LocNhomQuanLy {
  phamVi: string | null;
  /** Đường dẫn ltree đơn vị đang lọc (đã kiểm nằm trong phạm vi): nhóm có thành viên thuộc đơn vị này. */
  donVi?: string | null;
  /** Tìm theo tên nhóm. */
  q?: string | null;
  trangThai?: TrangThaiNhom | null;
}

export interface NhomChoQuanLy {
  id: string;
  ten: string;
  trang_thai: TrangThaiNhom;
  tao_luc: Date;
  /** Họ tên trưởng nhóm; null khi trưởng nhóm ngoài phạm vi. */
  truong_nhom: string | null;
  truong_nhom_trong_pham_vi: boolean;
  so_trong_pham_vi: number;
  so_ngoai_pham_vi: number;
  so_muc: number;
  /** Trung bình phần trăm chung của thành viên trong phạm vi, làm tròn xuống. */
  trung_binh_trong_pham_vi: number | null;
  /** Quản lý này lưu trữ được nhóm (N11): nhóm đang hoạt động, trưởng nhóm trong phạm vi. */
  luu_tru_duoc: boolean;
}

/** Số nhóm tối đa trả về một lần; nhiều hơn thì người dùng thu hẹp bằng bộ lọc. */
export const GIOI_HAN_DANH_SACH_NHOM = 300;

/** N16 cho các nhóm quản lý sắp xem: trưởng nhóm bị khóa thì chuyển quyền trước khi đọc. */
async function xuLyTruongNhomBiKhoaTrongPhamVi(phamVi: string | null): Promise<void> {
  const ds = (await sql`
    SELECT g.id FROM study_groups g JOIN accounts o ON o.id = g.owner_account_id
    WHERE g.status = 'hoat_dong' AND NOT o.enabled AND ${coThanhVienTrongPhamViSql(sql`g.id`, phamVi)}`) as any[];
  for (const r of ds) await xuLyTruongNhomBiKhoa(r.id);
}

/**
 * Các nhóm có ít nhất một thành viên đang ở trong nhóm thuộc phạm vi (và thuộc đơn vị đang lọc).
 * Nhóm không còn ai (người cuối đã rời) không có trong danh sách.
 */
export async function danhSachNhomQuanLy(loc: LocNhomQuanLy): Promise<NhomChoQuanLy[]> {
  await xuLyTruongNhomBiKhoaTrongPhamVi(loc.phamVi);
  const tim = loc.q?.trim() ? `%${thoatLike(loc.q.trim())}%` : null;
  const ds = (await sql`
    WITH tv AS (
      SELECT m.group_id, m.account_id,
             ${trongPhamViSql(sql`u.path`, loc.phamVi)} AS trong,
             ${loc.donVi ? sql`COALESCE(u.path <@ ${loc.donVi}::ltree, false)` : sql`true`} AS khop
      FROM study_group_members m
      JOIN accounts a ON a.id = m.account_id
      LEFT JOIN units u ON u.id = a.unit_id
      WHERE m.left_at IS NULL
    )
    SELECT g.id, g.name, g.status, g.created_at,
           count(*) FILTER (WHERE tv.trong)::int AS so_trong,
           count(*) FILTER (WHERE NOT tv.trong)::int AS so_ngoai,
           COALESCE(bool_or(tv.trong AND tv.account_id = g.owner_account_id), false) AS truong_trong,
           CASE WHEN bool_or(tv.trong AND tv.account_id = g.owner_account_id)
                THEN COALESCE(NULLIF(o.name, ''), o.username, 'Thành viên') END AS truong_nhom,
           (SELECT count(*)::int FROM study_group_items i WHERE i.group_id = g.id AND i.removed_at IS NULL) AS so_muc
    FROM study_groups g
    JOIN tv ON tv.group_id = g.id
    JOIN accounts o ON o.id = g.owner_account_id
    WHERE true
      ${tim ? sql`AND g.name ILIKE ${tim}` : sql``}
      ${loc.trangThai ? sql`AND g.status = ${loc.trangThai}` : sql``}
    GROUP BY g.id, o.id
    HAVING bool_or(tv.trong AND tv.khop)
    ORDER BY (g.status = 'hoat_dong') DESC, g.updated_at DESC, g.id
    LIMIT ${GIOI_HAN_DANH_SACH_NHOM}`) as any[];
  if (!ds.length) return [];

  // Trung bình trong phạm vi: chỉ thành viên trong phạm vi vào mẫu số.
  const groupIds = ds.map((g) => g.id as string);
  const trong = (await sql`
    SELECT m.group_id, m.account_id FROM study_group_members m
    JOIN accounts a ON a.id = m.account_id
    LEFT JOIN units u ON u.id = a.unit_id
    WHERE m.group_id = ANY(${groupIds}::uuid[]) AND m.left_at IS NULL
      AND ${trongPhamViSql(sql`u.path`, loc.phamVi)}`) as any[];
  const [muc, duLieu] = await Promise.all([
    docMucCacNhom(groupIds),
    docDuLieuTienDoCacNhom(
      groupIds,
      trong.map((r) => r.account_id as string),
    ),
  ]);
  const mucNhom = mucTheoNhom(muc);
  const nguoiNhom = new Map<string, string[]>();
  for (const r of trong) nguoiNhom.set(r.group_id, [...(nguoiNhom.get(r.group_id) ?? []), r.account_id]);

  return ds.map((g) => ({
    id: g.id,
    ten: g.name,
    trang_thai: g.status,
    tao_luc: g.created_at,
    truong_nhom: g.truong_trong ? g.truong_nhom : null,
    truong_nhom_trong_pham_vi: g.truong_trong,
    so_trong_pham_vi: g.so_trong,
    so_ngoai_pham_vi: g.so_ngoai,
    so_muc: g.so_muc,
    trung_binh_trong_pham_vi: tinhTienDoNhom({
      muc: (mucNhom.get(g.id) ?? []).map(sangMucTinh),
      thanhVien: nguoiNhom.get(g.id) ?? [],
      duLieu,
    }).trung_binh,
    luu_tru_duoc: g.status === "hoat_dong" && g.truong_trong,
  }));
}

export interface ThanhVienChoQuanLy {
  id: string;
  ho_ten: string;
  cap_bac: string | null;
  don_vi: string | null;
  vai_tro: VaiTroNhom;
  vao_nhom_luc: Date;
  phan_tram: number | null;
  /** Phần trăm từng mục theo id mục; null là mục không được tính. */
  muc: Record<string, number | null>;
  /** Đề ôn tập: phiên đã kết thúc có tỷ lệ đúng cao nhất; null là chưa kết thúc phiên nào. */
  ket_qua_de: Record<string, { so_cau_dung: number; so_cau: number } | null>;
  lan_hoc_gan_nhat: Date | null;
}

export interface ChiTietNhomQuanLy {
  id: string;
  ten: string;
  mo_ta: string | null;
  trang_thai: TrangThaiNhom;
  tao_luc: Date;
  luu_tru_luc: Date | null;
  truong_nhom: string | null;
  truong_nhom_trong_pham_vi: boolean;
  so_trong_pham_vi: number;
  so_ngoai_pham_vi: number;
  trung_binh_trong_pham_vi: number | null;
  luu_tru_duoc: boolean;
  muc: Array<{
    id: string;
    loai: LoaiMucNhom;
    ten: string;
    chu_de: string | null;
    so_cau: number | null;
    han_goi_y: string | null;
    trang_thai: TrangThaiMucNhom;
  }>;
  thanh_vien: ThanhVienChoQuanLy[];
}

/**
 * Chi tiết một nhóm cho quản lý: thành viên trong phạm vi kèm phần trăm từng mục, kết quả đề ôn
 * tập, lần học gần nhất; thành viên ngoài phạm vi chỉ có số lượng. Không thấy nhóm thì 404.
 */
export async function chiTietNhomQuanLy(groupId: string, phamVi: string | null): Promise<ChiTietNhomQuanLy> {
  await xuLyTruongNhomBiKhoa(groupId);
  const [g] = (await sql`
    SELECT g.id, g.name, g.description, g.status, g.created_at, g.archived_at,
           COALESCE(NULLIF(o.name, ''), o.username, 'Thành viên') AS truong_nhom,
           ${trongPhamViSql(sql`ou.path`, phamVi)} AS truong_trong,
           (SELECT count(*)::int FROM study_group_members m
             JOIN accounts a ON a.id = m.account_id LEFT JOIN units u ON u.id = a.unit_id
             WHERE m.group_id = g.id AND m.left_at IS NULL
               AND NOT ${trongPhamViSql(sql`u.path`, phamVi)}) AS so_ngoai
    FROM study_groups g
    JOIN accounts o ON o.id = g.owner_account_id
    LEFT JOIN units ou ON ou.id = o.unit_id
    WHERE g.id = ${groupId} AND ${coThanhVienTrongPhamViSql(sql`g.id`, phamVi)}`) as any[];
  if (!g) throw loi(KHONG_CO_NHOM, "khong_tim_thay");

  const thanhVien = (await sql`
    SELECT m.account_id, m.role, m.joined_at,
           COALESCE(NULLIF(a.name, ''), a.username, 'Thành viên') AS ho_ten, a.rank_title, u.name AS don_vi
    FROM study_group_members m
    JOIN accounts a ON a.id = m.account_id
    LEFT JOIN units u ON u.id = a.unit_id
    WHERE m.group_id = ${groupId} AND m.left_at IS NULL AND ${trongPhamViSql(sql`u.path`, phamVi)}
    ORDER BY (m.role = 'truong_nhom') DESC, m.joined_at, m.account_id`) as any[];
  const ids = thanhVien.map((t) => t.account_id as string);

  const [muc, duLieu, ganNhat, ketQua] = await Promise.all([
    docMuc(groupId),
    docDuLieuTienDoCacNhom([groupId], ids),
    lanHocGanNhat(ids),
    ids.length ? docKetQuaDe(groupId, ids) : Promise.resolve([]),
  ]);
  const mucTinh = muc.map(sangMucTinh);
  const td = tinhTienDoNhom({ muc: mucTinh, thanhVien: ids, duLieu });
  const theoNguoi = new Map(td.thanh_vien.map((t) => [t.account_id, t]));
  const kq = new Map(ketQua.map((r) => [khoaDuLieuMuc(r.account_id, r.group_item_id), r]));

  return {
    id: g.id,
    ten: g.name,
    mo_ta: g.description,
    trang_thai: g.status,
    tao_luc: g.created_at,
    luu_tru_luc: g.archived_at,
    truong_nhom: g.truong_trong ? g.truong_nhom : null,
    truong_nhom_trong_pham_vi: g.truong_trong,
    so_trong_pham_vi: ids.length,
    so_ngoai_pham_vi: g.so_ngoai,
    trung_binh_trong_pham_vi: td.trung_binh,
    luu_tru_duoc: g.status === "hoat_dong" && g.truong_trong,
    muc: muc.map((m, i) => ({
      id: m.id,
      loai: m.kind,
      ten: m.title,
      chu_de: m.topic_name,
      so_cau: m.kind === "de_on_tap" ? m.so_cau : null,
      han_goi_y: m.due_date,
      trang_thai: trangThaiMuc(mucTinh[i]!),
    })),
    thanh_vien: thanhVien.map((t) => {
      const ketQuaDe: ThanhVienChoQuanLy["ket_qua_de"] = {};
      for (const m of muc) {
        if (m.kind !== "de_on_tap") continue;
        const r = kq.get(khoaDuLieuMuc(t.account_id, m.id));
        ketQuaDe[m.id] = r ? { so_cau_dung: r.correct, so_cau: r.total } : null;
      }
      return {
        id: t.account_id,
        ho_ten: t.ho_ten,
        cap_bac: t.rank_title,
        don_vi: t.don_vi,
        vai_tro: t.role,
        vao_nhom_luc: t.joined_at,
        phan_tram: theoNguoi.get(t.account_id)?.phan_tram ?? null,
        muc: theoNguoi.get(t.account_id)?.muc ?? {},
        ket_qua_de: ketQuaDe,
        lan_hoc_gan_nhat: ganNhat.get(t.account_id) ?? null,
      };
    }),
  };
}

/** Kết quả đề ôn tập cho quản lý: mỗi (mục, người) lấy phiên đã kết thúc có tỷ lệ đúng cao nhất. */
async function docKetQuaDe(
  groupId: string,
  accountIds: readonly string[],
): Promise<Array<{ group_item_id: string; account_id: string; correct: number; total: number }>> {
  return (await sql`
    SELECT DISTINCT ON (s.group_item_id, s.account_id)
           s.group_item_id, s.account_id, COALESCE(s.correct, 0) AS correct, s.total
    FROM practice_sessions s
    JOIN study_group_items i ON i.id = s.group_item_id AND i.group_id = ${groupId}
    WHERE s.account_id = ANY(${accountIds as string[]}::uuid[]) AND s.finished_at IS NOT NULL
    ORDER BY s.group_item_id, s.account_id,
             COALESCE(s.correct, 0)::float / NULLIF(s.total, 0) DESC NULLS LAST, s.finished_at`) as any[];
}

/**
 * Quản lý lưu trữ nhóm (N11). Thứ tự kiểm: không thấy nhóm (404), nhóm đã lưu trữ (409), trưởng
 * nhóm ngoài phạm vi (403). Nơi gọi ghi `audit_log` `nhom.luu_tru` sau khi thành công.
 */
export async function luuTruNhomQuanLy(
  groupId: string,
  phamVi: string | null,
  nguoiLam: string | null,
): Promise<{ ten: string; so_thanh_vien: number }> {
  await xuLyTruongNhomBiKhoa(groupId);
  return (await sql.begin(async (tx) => {
    const [khoa] = (await tx`SELECT id FROM study_groups WHERE id = ${groupId} FOR UPDATE`) as any[];
    const [g] = khoa
      ? ((await tx`
          SELECT g.name, g.status, ${trongPhamViSql(sql`ou.path`, phamVi)} AS truong_trong,
                 ${coThanhVienTrongPhamViSql(sql`g.id`, phamVi)} AS thay_duoc,
                 (SELECT count(*)::int FROM study_group_members m
                   WHERE m.group_id = g.id AND m.left_at IS NULL) AS so_thanh_vien
          FROM study_groups g
          JOIN accounts o ON o.id = g.owner_account_id
          LEFT JOIN units ou ON ou.id = o.unit_id
          WHERE g.id = ${groupId}`) as any[])
      : [];
    if (!g?.thay_duoc) throw loi(KHONG_CO_NHOM, "khong_tim_thay");
    if (g.status !== "hoat_dong") throw loi("Nhóm đã lưu trữ.", "xung_dot");
    if (!g.truong_trong) {
      throw loi(
        "Trưởng nhóm thuộc đơn vị ngoài phạm vi quản lý của tài khoản, nên không lưu trữ được nhóm này.",
        "ngoai_pham_vi",
      );
    }
    await tx`
      UPDATE study_groups SET status = 'luu_tru', archived_at = now(), archived_by = ${nguoiLam}, updated_at = now()
      WHERE id = ${groupId}`;
    return { ten: g.name as string, so_thanh_vien: g.so_thanh_vien as number };
  })) as { ten: string; so_thanh_vien: number };
}

/* ------------------------------------------------------------------ */
/* AI (docs/PLAN.md GĐ16d)                                             */
/* ------------------------------------------------------------------ */

export type LoaiGhiChuAi = "thu_tu_hoc" | "tom_tat_tien_do";

/** Băm dữ liệu vào đã ẩn danh cùng tên và phiên bản prompt: đổi prompt thì không dùng lại kết quả cũ. */
export function bamDauVaoAi(prompt: string, phienBan: string, dauVao: unknown): string {
  return createHash("sha256")
    .update(`${prompt}@${phienBan}\n${JSON.stringify(dauVao)}`)
    .digest("hex");
}

/**
 * AI-1: dữ liệu vào đã ẩn danh cho gợi ý thứ tự học. Thứ tự kiểm như thao tác ghi: không ở trong nhóm
 * (404), nhóm đã lưu trữ (409), không phải trưởng nhóm (403). Không có thông tin người.
 */
export async function nguCanhGoiYThuTu(
  groupId: string,
  accountId: string,
  now = new Date(),
): Promise<{ dauVao: DauVaoGoiYThuTu; bang: BangMa }> {
  const g = await layThanhVien(groupId, accountId);
  if (g.status !== "hoat_dong") throw loi("Nhóm đã lưu trữ, chỉ còn xem được.", "xung_dot");
  if (g.role !== "truong_nhom") throw loi("Chỉ trưởng nhóm làm được việc này.", "khong_du_quyen");
  const [muc, phut] = await Promise.all([
    docMuc(groupId),
    sql`
      SELECT i.id, l.estimated_minutes FROM study_group_items i JOIN lessons l ON l.id = i.lesson_id
      WHERE i.group_id = ${groupId} AND i.removed_at IS NULL`,
  ]);
  const soPhut = new Map((phut as any[]).map((r) => [r.id as string, r.estimated_minutes as number]));
  return dungDauVaoGoiYThuTu(
    muc.map((m, i) => ({
      id: m.id,
      ten: m.title,
      loai: m.kind,
      chu_de: m.topic_name,
      so_khoi: m.so_khoi,
      so_cau: m.so_cau,
      so_phut: soPhut.get(m.id) ?? null,
      han_goi_y: m.due_date,
      trang_thai: trangThaiMuc(sangMucTinh(muc[i]!)),
    })),
    now,
  );
}

/**
 * AI-2: dữ liệu vào đã ẩn danh cho tóm tắt tiến độ, chỉ gồm thành viên TRONG PHẠM VI của quản lý đang
 * xem (dựng từ `chiTietNhomQuanLy`, nên cùng kiểm phạm vi và cùng lỗi 404).
 */
export async function nguCanhTomTat(
  groupId: string,
  phamVi: string | null,
  now = new Date(),
): Promise<{ dauVao: DauVaoTomTat; bang: BangMa }> {
  const ct = await chiTietNhomQuanLy(groupId, phamVi);
  return dungDauVaoTomTat(
    {
      muc: ct.muc.map((m) => ({
        id: m.id,
        ten: m.ten,
        loai: m.loai,
        chu_de: m.chu_de,
        so_khoi: null,
        so_cau: m.so_cau,
        so_phut: null,
        han_goi_y: m.han_goi_y,
        trang_thai: m.trang_thai,
      })),
      thanhVien: ct.thanh_vien.map((t) => ({
        id: t.id,
        ho_ten: t.ho_ten,
        phan_tram: t.phan_tram,
        muc: t.muc,
        lan_hoc_gan_nhat: t.lan_hoc_gan_nhat,
      })),
      trungBinh: ct.trung_binh_trong_pham_vi,
    },
    now,
  );
}

/** Kết quả đã đạt cho cùng (nhóm, loại, phạm vi, dữ liệu vào): dùng lại, không gọi mô hình. */
export async function ketQuaAiDaCo(p: {
  groupId: string;
  kind: LoaiGhiChuAi;
  scopePath: string | null;
  inputHash: string;
}): Promise<unknown | null> {
  const [r] = (await sql`
    SELECT content FROM study_group_ai_notes
    WHERE group_id = ${p.groupId} AND kind = ${p.kind} AND status = 'dat' AND input_hash = ${p.inputHash}
      AND COALESCE(scope_path::text, '') = ${p.scopePath ?? ""}`) as any[];
  return r ? r.content : null;
}

/**
 * Số lần gọi mô hình thật trong ngày giờ Việt Nam (đề xuất Đ17: lần dùng lại kết quả cũ không ghi
 * dòng nên không tính). AI-1 đếm theo nhóm, AI-2 đếm theo người yêu cầu.
 */
export async function soLanGoiAiHomNay(
  p: { kind: "thu_tu_hoc"; groupId: string } | { kind: "tom_tat_tien_do"; requestedBy: string | null },
  now = new Date(),
): Promise<number> {
  const tu = sql`(${ngayVietNam(now)}::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`;
  const theo =
    p.kind === "thu_tu_hoc"
      ? sql`group_id = ${p.groupId}`
      : sql`requested_by IS NOT DISTINCT FROM ${p.requestedBy}::uuid`;
  const [r] = (await sql`
    SELECT count(*)::int AS n FROM study_group_ai_notes
    WHERE kind = ${p.kind} AND ${theo} AND created_at >= ${tu}`) as any[];
  return r.n as number;
}

/** Ghi một lần gọi mô hình thật: đạt (kèm nội dung đã hậu kiểm, còn dạng mã) hoặc bị loại (kèm lý do). */
export async function ghiChuAi(p: {
  groupId: string;
  kind: LoaiGhiChuAi;
  requestedBy: string | null;
  scopePath: string | null;
  inputHash: string;
  dat: boolean;
  content?: unknown;
  lyDo?: string;
  model?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  costUsd?: number | null;
}): Promise<void> {
  await sql`
    INSERT INTO study_group_ai_notes (group_id, kind, requested_by, scope_path, input_hash, status, content,
                                      reject_reason, model, tokens_in, tokens_out, cost_usd)
    VALUES (${p.groupId}, ${p.kind}, ${p.requestedBy}, ${p.scopePath}::ltree, ${p.inputHash},
            ${p.dat ? "dat" : "bi_loai"}, ${p.dat ? sql.json(p.content as never) : null}, ${p.dat ? null : (p.lyDo ?? null)},
            ${p.model ?? null}, ${p.tokensIn ?? null}, ${p.tokensOut ?? null}, ${p.costUsd ?? null})
    ON CONFLICT DO NOTHING`;
}
