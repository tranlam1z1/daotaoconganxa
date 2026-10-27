/**
 * Truy vấn CSDL cho mô-đun đào tạo (ke-hoach/09-a).
 *
 * Dùng chung cho API học viên, API quản trị và worker soạn bài, nên đặt ở @qdpl/db chứ
 * không nằm trong một trong ba nơi đó.
 *
 * Một ranh giới được giữ nghiêm trong tệp này: hàm có tiền tố `congKhai` KHÔNG BAO GIỜ trả
 * về `answer` hay `rubric`. Đáp án rời máy chủ là mất luôn giá trị của cả ngân hàng câu hỏi.
 */

import {
  diemToiDaTieuChi,
  type LoaiKhoi,
  laRubric,
  NGUONG_DAT_KIEM_TRA_CUOI_BAI,
  NHAN_TRANG_THAI_NOI_DUNG,
  phutCuaBai,
  SO_CAU_KIEM_TRA_CUOI_BAI,
  type TrangThaiNoiDung,
  tinhDiemRubric,
} from "@qdpl/dao-tao";
import { sql } from "./client.ts";
import { LoiNghiepVu } from "./don-vi.ts";
import { ghiHoatDongHomNay } from "./hoat-dong.ts";
import { type ChuDeCauHoiRow, luuChuDeCauHoi } from "./ngan-hang.ts";

export type TrangThaiNoiDungDb =
  | "nhap"
  | "ai_soan"
  | "bien_tap"
  | "cho_phap_che"
  | "xuat_ban"
  | "can_cap_nhat"
  | "luu_tru";

/* ------------------------------------------------------------------ */
/* Lĩnh vực đào tạo                                                    */
/* ------------------------------------------------------------------ */

export interface FieldRow {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  audience_note: string | null;
  ordinal: number;
  status: string;
  updated_at: Date;
}

export interface DanhSachLinhVucOpts {
  /**
   * Chỉ lĩnh vực đã xuất bản. Phía công khai vẫn cần thấy lĩnh vực đang biên soạn để biết
   * lộ trình sắp có, nên tham số này mặc định false và nơi gọi tự quyết định.
   */
  chiXuatBan?: boolean;
  /** Bỏ lĩnh vực chưa dựng xong hoặc đã lưu trữ khỏi danh mục công khai. */
  boTrangThai?: string[];
}

export async function danhSachLinhVuc(o: DanhSachLinhVucOpts = {}) {
  const chiXuatBan = o.chiXuatBan ?? false;
  const bo = o.boTrangThai ?? [];
  return await sql<FieldRow[]>`
    SELECT * FROM fields
    WHERE (NOT ${chiXuatBan} OR status = 'xuat_ban')
      AND NOT (status = ANY(${bo}::text[]))
    ORDER BY ordinal, name`;
}

export async function linhVucTheoSlug(slug: string): Promise<FieldRow | undefined> {
  const [row] = await sql<FieldRow[]>`SELECT * FROM fields WHERE slug = ${slug} LIMIT 1`;
  return row;
}

export interface LuuLinhVucInput {
  slug: string;
  name: string;
  summary?: string | null;
  audienceNote?: string | null;
  ordinal?: number;
  status?: TrangThaiNoiDungDb;
}

export async function luuLinhVuc(inp: LuuLinhVucInput): Promise<FieldRow> {
  const [row] = await sql<FieldRow[]>`
    INSERT INTO fields (slug, name, summary, audience_note, ordinal, status)
    VALUES (${inp.slug}, ${inp.name}, ${inp.summary ?? null}, ${inp.audienceNote ?? null},
            ${inp.ordinal ?? 0}, ${inp.status ?? "nhap"})
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name, summary = EXCLUDED.summary, audience_note = EXCLUDED.audience_note,
      ordinal = EXCLUDED.ordinal, status = EXCLUDED.status, updated_at = now()
    RETURNING *`;
  return row!;
}

/* ------------------------------------------------------------------ */
/* Chuyên đề                                                           */
/* ------------------------------------------------------------------ */

export interface CourseRow {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  audience: string[];
  nhom_hoc_tap: string[];
  level: string;
  objectives: unknown;
  taxonomy_codes: string[];
  tags: string[];
  as_of: string;
  status: string;
  citation_health: string;
  duration_minutes: number | null;
  hero_asset: string | null;
  default_mode: string;
  legal_map: Record<string, unknown>;
  field_id: string | null;
  parent_id: string | null;
  follows_id: string | null;
  audience_group: string;
  ordinal: number;
  mascot_id: string | null;
  mascot_locked: boolean;
  mascot_costume: string | null;
  published_at: Date | null;
  updated_at: Date;
}

export interface DanhSachChuyenDeOpts {
  /** Chỉ chuyên đề đã xuất bản (mặc định true cho phía công khai). */
  chiXuatBan?: boolean;
  doiTuong?: string;
  /** undefined: tất cả; []: không khớp; nhiều nhóm: khớp ít nhất một nhóm. */
  nhomHocTap?: string[];
  chuaPhanNhom?: boolean;
  /**
   * Đếm bài đã xuất bản thay vì đếm mọi bài. Mặc định theo `chiXuatBan`; tách riêng để danh
   * mục công khai vừa hiện được chuyên đề đang biên soạn, vừa nói đúng số bài học được.
   */
  demBaiXuatBan?: boolean;
  /** Slug lĩnh vực đào tạo. */
  linhVuc?: string;
  /** Nhóm đối tượng: khach_hang | tu_van. */
  nhomDoiTuong?: string;
  tuKhoa?: string;
  limit?: number;
  offset?: number;
}

/** Chuyên đề kèm số bài và tên lĩnh vực — hình dạng dùng chung cho danh mục và bảng điều khiển. */
export type CourseListRow = CourseRow & {
  lesson_count: number;
  /** Tổng thời lượng của đúng những bài được đếm ở `lesson_count`. */
  lesson_minutes: number;
  field_slug: string | null;
  field_name: string | null;
  field_ordinal: number | null;
};

export async function danhSachChuyenDe(o: DanhSachChuyenDeOpts = {}) {
  const chiXuatBan = o.chiXuatBan ?? true;
  const demBaiXuatBan = o.demBaiXuatBan ?? chiXuatBan;
  const doiTuong = o.doiTuong ?? null;
  const linhVuc = o.linhVuc ?? null;
  const nhomDoiTuong = o.nhomDoiTuong ?? null;
  const tuKhoa = o.tuKhoa?.trim() ? `%${o.tuKhoa.trim()}%` : null;
  const rows = await sql<CourseListRow[]>`
    SELECT c.*,
           (SELECT count(*)::int FROM lessons l
             WHERE l.course_id = c.id AND (NOT ${demBaiXuatBan} OR l.status = 'xuat_ban')) AS lesson_count,
           (SELECT coalesce(sum(l.estimated_minutes), 0)::int FROM lessons l
             WHERE l.course_id = c.id AND (NOT ${demBaiXuatBan} OR l.status = 'xuat_ban')) AS lesson_minutes,
           f.slug AS field_slug, f.name AS field_name, f.ordinal AS field_ordinal
    FROM courses c
    LEFT JOIN fields f ON f.id = c.field_id
    WHERE (NOT ${chiXuatBan} OR (c.status = 'xuat_ban' AND cardinality(c.nhom_hoc_tap) > 0))
      AND (NOT ${o.chuaPhanNhom ?? false} OR cardinality(c.nhom_hoc_tap) = 0)
      AND (${doiTuong}::text IS NULL OR ${doiTuong}::text = ANY(c.audience))
      AND (${o.nhomHocTap === undefined} OR c.nhom_hoc_tap && ${o.nhomHocTap ?? []}::text[])
      AND (${linhVuc}::text IS NULL OR f.slug = ${linhVuc}::text)
      AND (${nhomDoiTuong}::text IS NULL OR c.audience_group = ${nhomDoiTuong}::text)
      AND (${tuKhoa}::text IS NULL OR c.title ILIKE ${tuKhoa}::text OR c.summary ILIKE ${tuKhoa}::text)
    ORDER BY f.ordinal NULLS LAST, c.audience_group, c.ordinal, c.updated_at DESC
    LIMIT ${o.limit ?? 50} OFFSET ${o.offset ?? 0}`;
  return rows;
}

/**
 * Chuyên đề đứng cạnh một chuyên đề trong cây của lĩnh vực.
 *
 * Trả về cả bốn phía vì trang chuyên đề phải nói được người học đang ở đâu: học tiếp từ đâu
 * (`noiTiepTu`), đi tiếp sang đâu (`noiTiepSang`), chuyên đề rộng hơn (`cha`) và các chuyên
 * đề thu hẹp phạm vi (`con`).
 */
export async function chuyenDeLienQuan(course: CourseRow) {
  const [cha, noiTiepTu, sau, con] = await Promise.all([
    course.parent_id ? chuyenDeTheoId(course.parent_id) : Promise.resolve(undefined),
    course.follows_id ? chuyenDeTheoId(course.follows_id) : Promise.resolve(undefined),
    sql<CourseRow[]>`SELECT * FROM courses WHERE follows_id = ${course.id}::uuid ORDER BY ordinal LIMIT 1`,
    sql<CourseRow[]>`SELECT * FROM courses WHERE parent_id = ${course.id}::uuid ORDER BY ordinal`,
  ]);
  const linhVuc = course.field_id
    ? await sql<FieldRow[]>`SELECT * FROM fields WHERE id = ${course.field_id}::uuid LIMIT 1`
    : [];
  return { linhVuc: linhVuc[0], cha, noiTiepTu, noiTiepSang: sau[0], con };
}

export async function chuyenDeTheoSlug(slug: string): Promise<CourseRow | undefined> {
  const [row] = await sql<CourseRow[]>`SELECT * FROM courses WHERE slug = ${slug} LIMIT 1`;
  return row;
}

export async function chuyenDeTheoId(id: string): Promise<CourseRow | undefined> {
  const [row] = await sql<CourseRow[]>`SELECT * FROM courses WHERE id = ${id}::uuid LIMIT 1`;
  return row;
}

export interface LuuChuyenDeInput {
  id?: string;
  slug: string;
  title: string;
  summary?: string | null;
  audience?: string[];
  nhomHocTap?: string[];
  level?: string;
  tags?: string[];
  taxonomyCodes?: string[];
  objectives?: unknown;
  asOf: string;
  durationMinutes?: number | null;
  defaultMode?: string;
  mascotId?: string | null;
  mascotLocked?: boolean;
  mascotCostume?: string | null;
  legalMap?: Record<string, unknown>;
  fieldId?: string | null;
  parentId?: string | null;
  followsId?: string | null;
  audienceGroup?: string;
  ordinal?: number;
}

export async function luuChuyenDe(inp: LuuChuyenDeInput): Promise<CourseRow> {
  const [row] = await sql<CourseRow[]>`
    INSERT INTO courses (id, slug, title, summary, audience, level, tags, taxonomy_codes, objectives,
                         as_of, duration_minutes, default_mode, mascot_id, mascot_locked, mascot_costume, legal_map,
                         field_id, parent_id, follows_id, audience_group, ordinal, status, nhom_hoc_tap)
    -- status ghi rõ 'nhap': mặc định của cột vẫn là 'draft' từ 0001, nằm ngoài vòng đời nội dung
    -- nên chuyên đề mới không chuyển được sang trạng thái nào. Cập nhật không đụng tới status.
    VALUES (COALESCE(${inp.id ?? null}::uuid, uuid_generate_v4()), ${inp.slug}, ${inp.title},
            ${inp.summary ?? null}, ${inp.audience ?? []}, ${inp.level ?? "co_ban"}, ${inp.tags ?? []},
            ${inp.taxonomyCodes ?? []}, ${sql.json((inp.objectives ?? []) as never)}, ${inp.asOf}::date,
            ${inp.durationMinutes ?? null}, ${inp.defaultMode ?? "day_du"}, ${inp.mascotId ?? null}::uuid,
            ${inp.mascotLocked ?? false}, ${inp.mascotCostume ?? null}, ${sql.json((inp.legalMap ?? {}) as never)},
            ${inp.fieldId ?? null}::uuid, ${inp.parentId ?? null}::uuid, ${inp.followsId ?? null}::uuid,
            ${inp.audienceGroup ?? "khach_hang"}, ${inp.ordinal ?? 0}, 'nhap', ${inp.nhomHocTap ?? []}::text[])
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title, summary = EXCLUDED.summary, audience = EXCLUDED.audience,
      level = EXCLUDED.level, tags = EXCLUDED.tags, taxonomy_codes = EXCLUDED.taxonomy_codes,
      objectives = EXCLUDED.objectives, as_of = EXCLUDED.as_of,
      duration_minutes = EXCLUDED.duration_minutes, default_mode = EXCLUDED.default_mode,
      mascot_id = EXCLUDED.mascot_id, mascot_locked = EXCLUDED.mascot_locked,
      mascot_costume = EXCLUDED.mascot_costume, legal_map = EXCLUDED.legal_map,
      field_id = EXCLUDED.field_id, parent_id = EXCLUDED.parent_id, follows_id = EXCLUDED.follows_id,
      audience_group = EXCLUDED.audience_group, ordinal = EXCLUDED.ordinal,
      nhom_hoc_tap = CASE WHEN ${inp.nhomHocTap !== undefined} THEN EXCLUDED.nhom_hoc_tap ELSE courses.nhom_hoc_tap END,
      updated_at = now()
    RETURNING *`;
  return row!;
}

/** Đổi trạng thái nội dung. Việc kiểm bước chuyển hợp lệ nằm ở @qdpl/dao-tao. */
export async function datTrangThaiChuyenDe(id: string, trangThai: TrangThaiNoiDungDb) {
  const [row] = await sql<CourseRow[]>`
    UPDATE courses
    SET status = ${trangThai}, updated_at = now(),
        published_at = CASE WHEN ${trangThai} = 'xuat_ban' THEN now() ELSE published_at END
    WHERE id = ${id}::uuid RETURNING *`;
  return row;
}

/* ------------------------------------------------------------------ */
/* Kỹ năng                                                             */
/* ------------------------------------------------------------------ */

export interface SkillRow {
  id: string;
  course_id: string;
  code: string;
  name: string;
  description: string | null;
  prerequisites: string[];
  ordinal: number;
}

export async function kyNangCuaChuyenDe(courseId: string) {
  return await sql<SkillRow[]>`
    SELECT * FROM skills WHERE course_id = ${courseId}::uuid ORDER BY ordinal, code`;
}

export async function luuKyNang(
  courseId: string,
  ds: Array<{
    code: string;
    name: string;
    description?: string | null;
    prerequisites?: string[];
    ordinal?: number;
  }>,
) {
  if (!ds.length) return [];
  const rows: SkillRow[] = [];
  for (const [i, k] of ds.entries()) {
    const [row] = await sql<SkillRow[]>`
      INSERT INTO skills (course_id, code, name, description, prerequisites, ordinal)
      VALUES (${courseId}::uuid, ${k.code}, ${k.name}, ${k.description ?? null}, ${k.prerequisites ?? []},
              ${k.ordinal ?? i})
      ON CONFLICT (course_id, code) DO UPDATE SET
        name = EXCLUDED.name, description = EXCLUDED.description,
        prerequisites = EXCLUDED.prerequisites, ordinal = EXCLUDED.ordinal
      RETURNING *`;
    if (row) rows.push(row);
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* Bài học và khối nội dung                                            */
/* ------------------------------------------------------------------ */

export interface LessonRow {
  id: string;
  course_id: string;
  slug: string;
  ordinal: number;
  title: string;
  summary: string | null;
  as_of: string | null;
  status: string;
  estimated_minutes: number;
  skills: string[];
  citation_health: string;
  source: string;
  mascot_id: string | null;
  /** Chủ đề ngân hàng câu hỏi để rút câu kiểm tra cuối bài (docs/PLAN.md GĐ11). */
  topic_id: string | null;
  updated_at: Date;
}

export async function baiHocCuaChuyenDe(courseId: string, chiXuatBan = false) {
  return await sql<LessonRow[]>`
    SELECT id, course_id, slug, ordinal, title, summary, as_of, status, estimated_minutes,
           skills, citation_health, source, mascot_id, topic_id, updated_at
    FROM lessons
    WHERE course_id = ${courseId}::uuid AND (NOT ${chiXuatBan} OR status = 'xuat_ban')
    ORDER BY ordinal`;
}

export async function baiHocTheoSlug(courseId: string, slug: string): Promise<LessonRow | undefined> {
  const [row] = await sql<LessonRow[]>`
    SELECT * FROM lessons WHERE course_id = ${courseId}::uuid AND slug = ${slug} LIMIT 1`;
  return row;
}

export async function baiHocTheoId(id: string): Promise<LessonRow | undefined> {
  const [row] = await sql<LessonRow[]>`SELECT * FROM lessons WHERE id = ${id}::uuid LIMIT 1`;
  return row;
}

export interface LuuBaiHocInput {
  id?: string;
  courseId: string;
  slug: string;
  ordinal: number;
  title: string;
  summary?: string | null;
  asOf?: string | null;
  estimatedMinutes?: number;
  skills?: string[];
  source?: string;
  mascotId?: string | null;
  updatedBy?: string | null;
  /**
   * Chủ đề ngân hàng cho kiểm tra cuối bài. `undefined` giữ nguyên chủ đề đang gắn: seed bài học
   * chạy lại không được xóa chủ đề mà seed-ngan-hang đã gắn; `null` là gỡ chủ đề.
   */
  topicId?: string | null;
}

export async function luuBaiHoc(inp: LuuBaiHocInput): Promise<LessonRow> {
  const doiChuDe = inp.topicId !== undefined;
  const [row] = await sql<LessonRow[]>`
    INSERT INTO lessons (id, course_id, slug, ordinal, title, summary, as_of, estimated_minutes,
                         skills, source, mascot_id, updated_by, body_md, topic_id)
    VALUES (COALESCE(${inp.id ?? null}::uuid, uuid_generate_v4()), ${inp.courseId}::uuid, ${inp.slug},
            ${inp.ordinal}, ${inp.title}, ${inp.summary ?? null}, ${inp.asOf ?? null}::date,
            ${inp.estimatedMinutes ?? 15}, ${inp.skills ?? []}, ${inp.source ?? "nguoi"},
            ${inp.mascotId ?? null}::uuid, ${inp.updatedBy ?? null}, '', ${inp.topicId ?? null}::uuid)
    ON CONFLICT (course_id, slug) DO UPDATE SET
      ordinal = EXCLUDED.ordinal, title = EXCLUDED.title, summary = EXCLUDED.summary,
      as_of = EXCLUDED.as_of, estimated_minutes = EXCLUDED.estimated_minutes,
      skills = EXCLUDED.skills, source = EXCLUDED.source, mascot_id = EXCLUDED.mascot_id,
      topic_id = CASE WHEN ${doiChuDe} THEN EXCLUDED.topic_id ELSE lessons.topic_id END,
      updated_by = EXCLUDED.updated_by, updated_at = now()
    RETURNING *`;
  return row!;
}

export async function datTrangThaiBaiHoc(id: string, trangThai: TrangThaiNoiDungDb) {
  const [row] = await sql<LessonRow[]>`
    UPDATE lessons
    SET status = ${trangThai}, updated_at = now(),
        published_at = CASE WHEN ${trangThai} = 'xuat_ban' THEN now() ELSE published_at END
    WHERE id = ${id}::uuid RETURNING *`;
  return row;
}

export async function xoaBaiHoc(id: string) {
  await sql`DELETE FROM lessons WHERE id = ${id}::uuid`;
}

/**
 * Xoá những bài không còn nằm trong lộ trình của chuyên đề.
 *
 * Cần cho việc gieo lại sau khi tách chuyên đề: nếu chỉ chèn lộ trình mới, các bài của lộ
 * trình cũ vẫn nằm lại trong kho và tiếp tục hiện ra ở trang quản trị.
 */
export async function xoaBaiNgoaiLoTrinh(courseId: string, slugGiuLai: string[]) {
  const rows = await sql<Array<{ slug: string }>>`
    DELETE FROM lessons
    WHERE course_id = ${courseId}::uuid AND NOT (slug = ANY(${slugGiuLai}::text[]))
    RETURNING slug`;
  return rows.map((r) => r.slug);
}

export interface BlockRow {
  id: string;
  lesson_id: string;
  ordinal: number;
  kind: string;
  data: Record<string, unknown>;
  citations: string[];
  citation_health: string;
  source: string;
  status: string;
  modes: string[];
  note: string | null;
}

export async function khoiCuaBai(lessonId: string) {
  return await sql<BlockRow[]>`
    SELECT * FROM lesson_blocks WHERE lesson_id = ${lessonId}::uuid ORDER BY ordinal`;
}

/** Số khối của từng bài trong chuyên đề, đếm bằng một truy vấn. Bài chưa có khối nào không có mặt. */
export async function soKhoiTheoBai(courseId: string): Promise<Map<string, number>> {
  const rows = await sql<Array<{ lesson_id: string; so_khoi: number }>>`
    SELECT k.lesson_id, count(*)::int AS so_khoi
    FROM lesson_blocks k JOIN lessons l ON l.id = k.lesson_id
    WHERE l.course_id = ${courseId}::uuid
    GROUP BY k.lesson_id`;
  return new Map(rows.map((r) => [r.lesson_id, r.so_khoi]));
}

export interface LuuKhoiInput {
  id?: string;
  lessonId: string;
  ordinal: number;
  kind: string;
  data: Record<string, unknown>;
  citations?: string[];
  source?: string;
  modes?: string[];
  note?: string | null;
}

export async function luuKhoi(inp: LuuKhoiInput): Promise<BlockRow> {
  if (inp.id) {
    const [row] = await sql<BlockRow[]>`
      UPDATE lesson_blocks
      SET ordinal = ${inp.ordinal}, kind = ${inp.kind}, data = ${sql.json(inp.data as never)},
          citations = ${inp.citations ?? []}, source = ${inp.source ?? "nguoi"},
          modes = ${inp.modes ?? []}, note = ${inp.note ?? null}, updated_at = now()
      WHERE id = ${inp.id}::uuid RETURNING *`;
    if (row) return row;
  }
  const [row] = await sql<BlockRow[]>`
    INSERT INTO lesson_blocks (lesson_id, ordinal, kind, data, citations, source, modes, note)
    VALUES (${inp.lessonId}::uuid, ${inp.ordinal}, ${inp.kind}, ${sql.json(inp.data as never)},
            ${inp.citations ?? []}, ${inp.source ?? "nguoi"}, ${inp.modes ?? []}, ${inp.note ?? null})
    RETURNING *`;
  return row!;
}

export async function xoaKhoi(id: string) {
  await sql`DELETE FROM lesson_blocks WHERE id = ${id}::uuid`;
}

/** Sắp xếp lại khối theo danh sách id. Chạy trong một giao dịch để không có trạng thái nửa vời. */
export async function sapXepKhoi(lessonId: string, thuTuId: string[]) {
  await sql.begin(async (tx) => {
    for (const [i, id] of thuTuId.entries()) {
      await tx`UPDATE lesson_blocks SET ordinal = ${i + 1}, updated_at = now()
               WHERE id = ${id}::uuid AND lesson_id = ${lessonId}::uuid`;
    }
  });
}

/* ------------------------------------------------------------------ */
/* Hoạt động                                                           */
/* ------------------------------------------------------------------ */

export interface ActivityRow {
  id: string;
  lesson_id: string | null;
  course_id: string;
  ordinal: number;
  kind: string;
  mode: string;
  title: string | null;
  prompt: Record<string, unknown>;
  answer: Record<string, unknown>;
  rubric: Record<string, unknown>;
  skills: string[];
  error_tags: string[];
  citations: string[];
  difficulty: string | number;
  points: number;
  level: number;
  source: string;
  status: string;
  retired: boolean;
}

export async function hoatDongCuaBai(lessonId: string) {
  return await sql<ActivityRow[]>`
    SELECT * FROM activities WHERE lesson_id = ${lessonId}::uuid AND NOT retired ORDER BY ordinal`;
}

export async function hoatDongTheoId(id: string): Promise<ActivityRow | undefined> {
  const [row] = await sql<ActivityRow[]>`SELECT * FROM activities WHERE id = ${id}::uuid LIMIT 1`;
  return row;
}

export async function hoatDongCuaChuyenDe(courseId: string, level?: number) {
  return await sql<ActivityRow[]>`
    SELECT * FROM activities
    WHERE course_id = ${courseId}::uuid AND NOT retired
      AND (${level ?? null}::int IS NULL OR level = ${level ?? null}::int)
    ORDER BY level, ordinal`;
}

export interface LuuHoatDongInput {
  id?: string;
  courseId: string;
  lessonId?: string | null;
  ordinal?: number;
  kind: string;
  mode?: string;
  title?: string | null;
  prompt: Record<string, unknown>;
  answer: Record<string, unknown>;
  rubric?: Record<string, unknown>;
  skills?: string[];
  errorTags?: string[];
  citations?: string[];
  difficulty?: number;
  points?: number;
  level?: number;
  source?: string;
}

export async function luuHoatDong(inp: LuuHoatDongInput): Promise<ActivityRow> {
  const chung = {
    ordinal: inp.ordinal ?? 0,
    mode: inp.mode ?? "may",
    rubric: inp.rubric ?? {},
    skills: inp.skills ?? [],
    errorTags: inp.errorTags ?? [],
    citations: inp.citations ?? [],
    difficulty: inp.difficulty ?? 0.5,
    points: inp.points ?? 1,
    level: inp.level ?? 1,
    source: inp.source ?? "nguoi",
  };
  if (inp.id) {
    const [row] = await sql<ActivityRow[]>`
      UPDATE activities SET
        lesson_id = ${inp.lessonId ?? null}::uuid, ordinal = ${chung.ordinal}, kind = ${inp.kind},
        mode = ${chung.mode}, title = ${inp.title ?? null},
        prompt = ${sql.json(inp.prompt as never)}, answer = ${sql.json(inp.answer as never)},
        rubric = ${sql.json(chung.rubric as never)}, skills = ${chung.skills}, error_tags = ${chung.errorTags},
        citations = ${chung.citations}, difficulty = ${chung.difficulty}, points = ${chung.points},
        level = ${chung.level}, source = ${chung.source}, updated_at = now()
      WHERE id = ${inp.id}::uuid RETURNING *`;
    if (row) return row;
  }
  const [row] = await sql<ActivityRow[]>`
    INSERT INTO activities (course_id, lesson_id, ordinal, kind, mode, title, prompt, answer, rubric,
                            skills, error_tags, citations, difficulty, points, level, source)
    VALUES (${inp.courseId}::uuid, ${inp.lessonId ?? null}::uuid, ${chung.ordinal}, ${inp.kind},
            ${chung.mode}, ${inp.title ?? null}, ${sql.json(inp.prompt as never)},
            ${sql.json(inp.answer as never)}, ${sql.json(chung.rubric as never)}, ${chung.skills},
            ${chung.errorTags}, ${chung.citations}, ${chung.difficulty}, ${chung.points},
            ${chung.level}, ${chung.source})
    RETURNING *`;
  return row!;
}

export async function goHoatDong(id: string, retired = true) {
  await sql`UPDATE activities SET retired = ${retired}, updated_at = now() WHERE id = ${id}::uuid`;
}

/**
 * Bản gửi ra cho người học: bỏ `answer` và `rubric`.
 * Đây là ranh giới bảo mật quan trọng nhất của mô-đun đào tạo.
 */
export function hoatDongCongKhai(a: ActivityRow) {
  return {
    id: a.id,
    lessonId: a.lesson_id,
    ordinal: a.ordinal,
    kind: a.kind,
    mode: a.mode,
    title: a.title,
    prompt: a.prompt,
    skills: a.skills,
    citations: a.citations,
    points: a.points,
    level: a.level,
  };
}

/* ------------------------------------------------------------------ */
/* Ghi danh và tiến độ                                                 */
/* ------------------------------------------------------------------ */

export interface EnrollmentRow {
  id: string;
  account_id: string;
  course_id: string;
  mode: string;
  goal_minutes_per_week: number;
  state: string;
  mascot_id: string | null;
  mascot_level: string;
  started_at: Date;
  finished_at: Date | null;
  last_seen_at: Date | null;
}

export async function ghiDanh(accountId: string, courseId: string, mode = "day_du"): Promise<EnrollmentRow> {
  const [row] = await sql<EnrollmentRow[]>`
    INSERT INTO enrollments (account_id, course_id, mode)
    VALUES (${accountId}::uuid, ${courseId}::uuid, ${mode})
    ON CONFLICT (account_id, course_id) DO UPDATE SET last_seen_at = now()
    RETURNING *`;
  return row!;
}

export async function ghiDanhCuaNguoiHoc(accountId: string, courseId: string) {
  const [row] = await sql<EnrollmentRow[]>`
    SELECT * FROM enrollments WHERE account_id = ${accountId}::uuid AND course_id = ${courseId}::uuid LIMIT 1`;
  return row;
}

export async function ghiDanhTheoId(id: string) {
  const [row] = await sql<EnrollmentRow[]>`SELECT * FROM enrollments WHERE id = ${id}::uuid LIMIT 1`;
  return row;
}

export async function capNhatGhiDanh(
  id: string,
  p: {
    mode?: string;
    goalMinutesPerWeek?: number;
    mascotId?: string | null;
    mascotLevel?: string;
    state?: string;
  },
) {
  const [row] = await sql<EnrollmentRow[]>`
    UPDATE enrollments SET
      mode = COALESCE(${p.mode ?? null}, mode),
      goal_minutes_per_week = COALESCE(${p.goalMinutesPerWeek ?? null}::int, goal_minutes_per_week),
      mascot_id = CASE WHEN ${p.mascotId === undefined} THEN mascot_id ELSE ${p.mascotId ?? null}::uuid END,
      mascot_level = COALESCE(${p.mascotLevel ?? null}, mascot_level),
      state = COALESCE(${p.state ?? null}, state),
      last_seen_at = now()
    WHERE id = ${id}::uuid RETURNING *`;
  return row;
}

export interface ProgressRow {
  enrollment_id: string;
  lesson_id: string;
  state: string;
  seconds_spent: number;
  last_block_ordinal: number;
  score: string | null;
  finished_at: Date | null;
}

export async function tienDoCuaGhiDanh(enrollmentId: string) {
  return await sql<ProgressRow[]>`
    SELECT * FROM lesson_progress WHERE enrollment_id = ${enrollmentId}::uuid`;
}

/**
 * Số bài đã xuất bản mà người học đã xong, theo từng chuyên đề đã ghi danh, trong một truy vấn.
 * Chuyên đề đã ghi danh nhưng chưa xong bài nào vẫn có mặt với 0; chưa ghi danh thì không có.
 */
export async function soBaiXongTheoChuyenDe(accountId: string): Promise<Map<string, number>> {
  const rows = await sql<Array<{ course_id: string; xong: number }>>`
    SELECT e.course_id, count(l.id)::int AS xong
    FROM enrollments e
    LEFT JOIN lesson_progress p ON p.enrollment_id = e.id AND p.state = 'xong'
    LEFT JOIN lessons l ON l.id = p.lesson_id AND l.course_id = e.course_id AND l.status = 'xuat_ban'
    WHERE e.account_id = ${accountId}::uuid
    GROUP BY e.course_id`;
  return new Map(rows.map((r) => [r.course_id, r.xong]));
}

/**
 * Chuyên đề người học đã hoàn thành: mọi bài đã xuất bản đều xong, và bài nào có kiểm tra cuối
 * bài (chủ đề ngân hàng có đủ câu đã duyệt, gồm cả chủ đề con) thì đã có ít nhất một phiên luyện
 * tập theo đúng chủ đề đó, đã nộp, đạt từ `NGUONG_DAT_KIEM_TRA_CUOI_BAI`% số câu trở lên.
 * Chuyên đề chưa có bài xuất bản nào không tính là hoàn thành.
 */
export async function chuyenDeDaHoanThanh(accountId: string): Promise<Set<string>> {
  const rows = await sql<Array<{ course_id: string }>>`
    WITH RECURSIVE bai AS (
      SELECT e.id AS enrollment_id, e.course_id, l.id AS lesson_id, l.topic_id
      FROM enrollments e
      JOIN lessons l ON l.course_id = e.course_id AND l.status = 'xuat_ban'
      WHERE e.account_id = ${accountId}::uuid
    ),
    cay AS (
      SELECT t.id AS goc, t.id FROM question_topics t
      WHERE t.id IN (SELECT topic_id FROM bai WHERE topic_id IS NOT NULL)
      UNION ALL
      SELECT cay.goc, t.id FROM question_topics t JOIN cay ON t.parent_id = cay.id
    ),
    co_kiem_tra AS (
      SELECT cay.goc AS topic_id
      FROM cay JOIN questions q ON q.topic_id = cay.id AND q.status = 'da_duyet'
      GROUP BY cay.goc
      HAVING count(*) >= ${SO_CAU_KIEM_TRA_CUOI_BAI.toiThieu}
    ),
    da_dat AS (
      SELECT DISTINCT s.topic_id FROM practice_sessions s
      WHERE s.account_id = ${accountId}::uuid AND s.source = 'chu_de' AND s.topic_id IS NOT NULL
        AND s.finished_at IS NOT NULL AND s.total > 0
        AND s.correct * 100 >= ${NGUONG_DAT_KIEM_TRA_CUOI_BAI} * s.total
    )
    SELECT b.course_id
    FROM bai b
    LEFT JOIN lesson_progress p
      ON p.enrollment_id = b.enrollment_id AND p.lesson_id = b.lesson_id AND p.state = 'xong'
    GROUP BY b.course_id
    HAVING bool_and(
      p.lesson_id IS NOT NULL
      AND (
        b.topic_id IS NULL
        OR b.topic_id NOT IN (SELECT topic_id FROM co_kiem_tra)
        OR b.topic_id IN (SELECT topic_id FROM da_dat)
      )
    )`;
  return new Set(rows.map((r) => r.course_id));
}

export async function ghiTienDo(p: {
  enrollmentId: string;
  lessonId: string;
  state?: string;
  themGiay?: number;
  lastBlockOrdinal?: number;
  score?: number | null;
}) {
  const [row] = await sql<ProgressRow[]>`
    INSERT INTO lesson_progress (enrollment_id, lesson_id, state, seconds_spent, last_block_ordinal, score,
                                 finished_at)
    VALUES (${p.enrollmentId}::uuid, ${p.lessonId}::uuid, ${p.state ?? "dang_hoc"}, ${p.themGiay ?? 0},
            ${p.lastBlockOrdinal ?? 0}, ${p.score ?? null},
            ${p.state === "xong" ? sql`now()` : null})
    ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
      -- Bài đã xong thì giữ xong: mở lại bài để ôn không được kéo trạng thái lùi về "đang học".
      state = CASE WHEN lesson_progress.state = 'xong' THEN 'xong'
                   ELSE COALESCE(${p.state ?? null}, lesson_progress.state) END,
      seconds_spent = lesson_progress.seconds_spent + ${p.themGiay ?? 0},
      -- Chỉ tiến, không lùi: người học cuộn ngược lên không được coi là mất tiến độ.
      last_block_ordinal = GREATEST(lesson_progress.last_block_ordinal, ${p.lastBlockOrdinal ?? 0}),
      score = COALESCE(${p.score ?? null}, lesson_progress.score),
      finished_at = CASE WHEN ${p.state ?? ""} = 'xong' THEN now() ELSE lesson_progress.finished_at END,
      updated_at = now()
    RETURNING *`;
  return row!;
}

/**
 * Đánh dấu một bài học đã xong, trong CÙNG một giao dịch. Chưa ghi danh chuyên đề thì ghi danh
 * luôn: người học mở bài từ danh mục `/hoc` không phải qua bước ghi danh riêng.
 *
 * Ghi thêm dòng ngày học hôm nay (để nhắc "đã học hôm nay"), không cộng điểm thưởng nào.
 */
export async function hoanThanhBaiHoc(p: {
  accountId: string;
  courseId: string;
  lessonId: string;
  themGiay?: number;
  now?: Date;
}): Promise<{ ghiDanhId: string; daXongTruoc: boolean }> {
  return (await sql.begin(async (tx) => {
    const [e] = (await tx`
      INSERT INTO enrollments (account_id, course_id)
      VALUES (${p.accountId}::uuid, ${p.courseId}::uuid)
      ON CONFLICT (account_id, course_id) DO UPDATE SET last_seen_at = now()
      RETURNING id`) as any[];
    const [cu] = (await tx`
      SELECT state FROM lesson_progress
      WHERE enrollment_id = ${e.id} AND lesson_id = ${p.lessonId}::uuid FOR UPDATE`) as any[];
    const daXongTruoc = cu?.state === "xong";
    await tx`
      INSERT INTO lesson_progress (enrollment_id, lesson_id, state, seconds_spent, finished_at)
      VALUES (${e.id}, ${p.lessonId}::uuid, 'xong', ${p.themGiay ?? 0}, now())
      ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
        state = 'xong',
        seconds_spent = lesson_progress.seconds_spent + ${p.themGiay ?? 0},
        finished_at = COALESCE(lesson_progress.finished_at, now()),
        updated_at = now()`;
    await tx`
      INSERT INTO learning_events (enrollment_id, kind, lesson_id)
      VALUES (${e.id}, 'xong_bai', ${p.lessonId}::uuid)`;
    await ghiHoatDongHomNay(tx, p.accountId, p.now);
    return { ghiDanhId: e.id as string, daXongTruoc };
  })) as unknown as { ghiDanhId: string; daXongTruoc: boolean };
}

export interface ChuDeCuaBai {
  id: string;
  code: string;
  name: string;
  /** Số câu đã duyệt của chủ đề, gồm cả chủ đề con. */
  so_cau: number;
}

/** Chủ đề ngân hàng của bài học kèm số câu đã duyệt, cho phần kiểm tra cuối bài. */
export async function chuDeCuaBaiHoc(topicId: string | null): Promise<ChuDeCuaBai | null> {
  if (!topicId) return null;
  const [r] = (await sql`
    WITH RECURSIVE cay AS (
      SELECT id FROM question_topics WHERE id = ${topicId}::uuid
      UNION ALL SELECT t.id FROM question_topics t JOIN cay ON t.parent_id = cay.id
    )
    SELECT t.id, t.code, t.name,
      (SELECT count(*)::int FROM questions q WHERE q.status = 'da_duyet' AND q.topic_id IN (SELECT id FROM cay)) AS so_cau
    FROM question_topics t WHERE t.id = ${topicId}::uuid`) as any[];
  return (r as ChuDeCuaBai) ?? null;
}

/* ------------------------------------------------------------------ */
/* Lượt làm bài                                                        */
/* ------------------------------------------------------------------ */

export interface AttemptRow {
  id: string;
  enrollment_id: string;
  activity_id: string;
  attempt_no: number;
  response: Record<string, unknown>;
  score: string;
  max_score: string;
  passed: boolean;
  feedback: Record<string, unknown>;
  error_tags: string[];
  seconds_spent: number;
  graded_by: string;
  review_state: string | null;
  reviewer_score: string | null;
  created_at: Date;
}

/** Tỷ lệ bài AI chấm được lấy mẫu cho người đối chiếu (09-a §4.3). */
export const TY_LE_LAY_MAU_CHAM_LAI = 0.1;

export async function ghiLuotLam(p: {
  enrollmentId: string;
  activityId: string;
  assessmentId?: string | null;
  response: unknown;
  score: number;
  maxScore: number;
  passed: boolean;
  feedback: unknown;
  errorTags?: string[];
  secondsSpent?: number;
  gradedBy?: string;
  model?: string | null;
  costUsd?: number;
  level?: number;
  /** Bắt buộc người chấm, ví dụ mô hình không chấm được bài này. */
  canNguoiCham?: boolean;
}): Promise<AttemptRow> {
  // Bài mức 3 luôn được người đối chiếu; bài AI chấm khác lấy mẫu theo tỷ lệ.
  const canChamLai =
    p.canNguoiCham ||
    (p.gradedBy === "ai" && ((p.level ?? 1) >= 3 || Math.random() < TY_LE_LAY_MAU_CHAM_LAI));
  const [row] = await sql<AttemptRow[]>`
    INSERT INTO attempts (enrollment_id, activity_id, assessment_id, attempt_no, response, score, max_score,
                          passed, feedback, error_tags, seconds_spent, graded_by, model, cost_usd, review_state)
    VALUES (${p.enrollmentId}::uuid, ${p.activityId}::uuid, ${p.assessmentId ?? null}::uuid,
            (SELECT COALESCE(max(attempt_no), 0) + 1 FROM attempts
              WHERE enrollment_id = ${p.enrollmentId}::uuid AND activity_id = ${p.activityId}::uuid),
            ${sql.json((p.response ?? {}) as never)}, ${p.score}, ${p.maxScore}, ${p.passed},
            ${sql.json((p.feedback ?? {}) as never)}, ${p.errorTags ?? []}, ${p.secondsSpent ?? 0},
            ${p.gradedBy ?? "may"}, ${p.model ?? null}, ${p.costUsd ?? 0},
            ${canChamLai ? "cho_doi_chieu" : null})
    RETURNING *`;
  return row!;
}

/** Số lượt AI đã chấm một bài của một ghi danh trong 24 giờ qua, để giới hạn chi phí chấm. */
export async function soLuotAiChamTrongNgay(enrollmentId: string, activityId: string): Promise<number> {
  const [r] = await sql<Array<{ n: number }>>`
    SELECT count(*)::int AS n FROM attempts
    WHERE enrollment_id = ${enrollmentId}::uuid AND activity_id = ${activityId}::uuid
      AND graded_by = 'ai' AND created_at > now() - interval '24 hours'`;
  return r?.n ?? 0;
}

export interface LuotGanNhat {
  activity_id: string;
  attempt_no: number;
  response: Record<string, unknown>;
  score: string;
  max_score: string;
  passed: boolean;
  feedback: Record<string, unknown>;
  graded_by: string;
  review_state: string | null;
  reviewer_score: string | null;
  created_at: Date;
}

/** Lượt làm gần nhất của từng bài tập, để trang học hiện lại bài đã nộp và kết quả. */
export async function luotGanNhatTheoHoatDong(enrollmentId: string, activityIds: string[]) {
  if (!activityIds.length) return new Map<string, LuotGanNhat>();
  const rows = await sql<LuotGanNhat[]>`
    SELECT DISTINCT ON (activity_id)
           activity_id, attempt_no, response, score, max_score, passed, feedback, graded_by,
           review_state, reviewer_score, created_at
    FROM attempts
    WHERE enrollment_id = ${enrollmentId}::uuid AND activity_id = ANY(${activityIds}::uuid[])
    ORDER BY activity_id, created_at DESC`;
  return new Map(rows.map((r) => [r.activity_id, r]));
}

/**
 * Người học đề nghị giảng viên chấm lại lượt AI chấm gần nhất của một bài (phúc khảo): đưa lượt
 * đó vào hàng chấm lại, ghi lý do vào `feedback.phuc_khao`. Lượt đã ở hàng chờ hay đã được giảng
 * viên chấm thì không đề nghị lại; trả `undefined`.
 */
export async function deNghiPhucKhao(enrollmentId: string, activityId: string, lyDo: string) {
  const [row] = await sql<AttemptRow[]>`
    UPDATE attempts
    SET review_state = 'cho_doi_chieu',
        feedback = feedback || ${sql.json({ phuc_khao: { ly_do: lyDo, luc: new Date().toISOString() } } as never)}
    WHERE id = (
      SELECT id FROM attempts
      WHERE enrollment_id = ${enrollmentId}::uuid AND activity_id = ${activityId}::uuid
      ORDER BY created_at DESC LIMIT 1)
      AND graded_by = 'ai' AND review_state IS NULL
    RETURNING *`;
  return row;
}

export async function luotLamCuaGhiDanh(enrollmentId: string, limit = 200) {
  return await sql<AttemptRow[]>`
    SELECT * FROM attempts WHERE enrollment_id = ${enrollmentId}::uuid
    ORDER BY created_at DESC LIMIT ${limit}`;
}

/** Mã lỗi mà người học đã mắc từ `nguong` lần trở lên — đầu vào của bài vá (09-a §6.3). */
export async function maLoiLapLai(enrollmentId: string, nguong = 2) {
  const rows = await sql<Array<{ ma_loi: string; so_lan: number }>>`
    SELECT t AS ma_loi, count(*)::int AS so_lan
    FROM attempts a, unnest(a.error_tags) AS t
    WHERE a.enrollment_id = ${enrollmentId}::uuid
    GROUP BY t HAVING count(*) >= ${nguong}
    ORDER BY 2 DESC`;
  return rows;
}

/**
 * Hàng chấm lại của giảng viên, kèm đề bài, đáp án gợi ý và người làm. Bài AI không chấm được
 * (người học đang chờ điểm) lên đầu, rồi tới bài phúc khảo, sau cùng là bài lấy mẫu đối chiếu.
 */
export async function hangDoiChamLai(limit = 50) {
  return await sql`
    SELECT a.*, act.kind, act.title, act.prompt, act.answer, act.rubric, act.citations, act.points,
           c.title AS course_title,
           COALESCE(acc.name, acc.username, acc.email) AS account_name, u.name AS unit_name
    FROM attempts a
    JOIN activities act ON act.id = a.activity_id
    JOIN courses c ON c.id = act.course_id
    JOIN enrollments en ON en.id = a.enrollment_id
    JOIN accounts acc ON acc.id = en.account_id
    LEFT JOIN units u ON u.id = acc.unit_id
    WHERE a.review_state = 'cho_doi_chieu'
    ORDER BY (a.graded_by = 'nguoi') DESC, (a.feedback ? 'phuc_khao') DESC, a.created_at ASC
    LIMIT ${limit}`;
}

/**
 * Giảng viên chấm một lượt trong hàng chấm lại theo rubric: điểm thô từng tiêu chí, quy về thang
 * điểm của bài bằng `tinhDiemRubric`. Điểm giảng viên vào `reviewer_score` và là điểm cuối cùng:
 * đạt hay chưa đạt tính lại theo điểm này. `score` và nhận xét của AI giữ nguyên để đối chiếu;
 * nhận xét của giảng viên nằm ở `feedback.giang_vien`. Không có lượt thì trả `undefined`.
 */
export async function chamLai(
  attemptId: string,
  diemTieuChi: Record<string, number>,
  nhanXet: string | null,
  reviewer: string,
) {
  const [cu] = await sql<Array<{ rubric: unknown; max_score: string }>>`
    SELECT act.rubric, a.max_score FROM attempts a
    JOIN activities act ON act.id = a.activity_id
    WHERE a.id = ${attemptId}::uuid`;
  if (!cu) return undefined;
  const rubric = cu.rubric;
  if (!laRubric(rubric)) throw new LoiNghiepVu("Bài này không có tiêu chí chấm.", "khong_hop_le");

  const phanTram = tinhDiemRubric(rubric, diemTieuChi);
  const diem = Math.round((phanTram / 100) * Number(cu.max_score) * 100) / 100;
  const giangVien = {
    tom_tat: nhanXet?.trim() || "Giảng viên đã chấm bài này.",
    tieu_chi: rubric.tieu_chi.map((tc) => ({
      ma: tc.ma,
      ten: tc.ten,
      diem: Math.min(Math.max(diemTieuChi[tc.ma] ?? 0, 0), diemToiDaTieuChi(tc)),
      diem_toi_da: diemToiDaTieuChi(tc),
    })),
  };
  const [row] = await sql<AttemptRow[]>`
    UPDATE attempts SET reviewer_score = ${diem}, reviewer = ${reviewer}, reviewed_at = now(),
                        review_state = 'da_doi_chieu', passed = ${phanTram >= rubric.nguong_dat},
                        feedback = feedback || ${sql.json({ giang_vien: giangVien } as never)}
    WHERE id = ${attemptId}::uuid RETURNING *`;
  return row;
}

/* ------------------------------------------------------------------ */
/* Mức thành thạo                                                      */
/* ------------------------------------------------------------------ */

export interface MasteryRow {
  enrollment_id: string;
  skill_id: string;
  p_known: string;
  attempts: number;
  correct: number;
}

export async function thanhThaoCuaGhiDanh(enrollmentId: string) {
  return await sql<MasteryRow[]>`
    SELECT * FROM mastery WHERE enrollment_id = ${enrollmentId}::uuid`;
}

export async function luuThanhThao(
  enrollmentId: string,
  skillId: string,
  pKnown: number,
  attempts: number,
  correct: number,
) {
  await sql`
    INSERT INTO mastery (enrollment_id, skill_id, p_known, attempts, correct)
    VALUES (${enrollmentId}::uuid, ${skillId}::uuid, ${pKnown}, ${attempts}, ${correct})
    ON CONFLICT (enrollment_id, skill_id) DO UPDATE SET
      p_known = EXCLUDED.p_known, attempts = EXCLUDED.attempts, correct = EXCLUDED.correct,
      updated_at = now()`;
}

/* ------------------------------------------------------------------ */
/* Thẻ ôn tập                                                          */
/* ------------------------------------------------------------------ */

export interface SrsRow {
  id: string;
  enrollment_id: string;
  ref_kind: string;
  ref_id: string;
  lesson_id: string | null;
  due_on: string;
  interval_days: number;
  ease: string;
  reps: number;
  lapses: number;
  suspended: boolean;
  suspend_reason: string | null;
}

export async function theOnCuaGhiDanh(enrollmentId: string) {
  return await sql<SrsRow[]>`
    SELECT * FROM srs_cards WHERE enrollment_id = ${enrollmentId}::uuid ORDER BY due_on`;
}

export async function theOnTheoId(id: string): Promise<SrsRow | undefined> {
  const [row] = await sql<SrsRow[]>`SELECT * FROM srs_cards WHERE id = ${id}::uuid LIMIT 1`;
  return row;
}

/**
 * Tài khoản sở hữu một ghi danh, hoặc undefined khi không có ghi danh này (docs/PLAN.md GĐ0 S3).
 * Id không phải UUID cũng trả undefined, để route trả 404 thay vì lỗi CSDL.
 */
export async function chuGhiDanh(id: string): Promise<string | undefined> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const [row] = await sql<Array<{ account_id: string }>>`
    SELECT account_id FROM enrollments WHERE id = ${id}::uuid`;
  return row?.account_id;
}

/** Tài khoản sở hữu một thẻ ôn (qua ghi danh chứa thẻ), hoặc undefined khi không có thẻ này. */
export async function chuTheOn(id: string): Promise<string | undefined> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const [row] = await sql<Array<{ account_id: string }>>`
    SELECT e.account_id FROM srs_cards s JOIN enrollments e ON e.id = s.enrollment_id
    WHERE s.id = ${id}::uuid`;
  return row?.account_id;
}

export async function taoTheOn(p: {
  enrollmentId: string;
  refKind: string;
  refId: string;
  lessonId?: string | null;
}) {
  const [row] = await sql<SrsRow[]>`
    INSERT INTO srs_cards (enrollment_id, ref_kind, ref_id, lesson_id)
    VALUES (${p.enrollmentId}::uuid, ${p.refKind}, ${p.refId}, ${p.lessonId ?? null}::uuid)
    ON CONFLICT (enrollment_id, ref_kind, ref_id) DO UPDATE SET lesson_id = EXCLUDED.lesson_id
    RETURNING *`;
  return row!;
}

export async function capNhatTheOn(
  id: string,
  p: { dueOn: string; intervalDays: number; ease: number; reps: number; lapses: number; suspended?: boolean },
) {
  const [row] = await sql<SrsRow[]>`
    UPDATE srs_cards SET due_on = ${p.dueOn}::date, interval_days = ${p.intervalDays}, ease = ${p.ease},
                         reps = ${p.reps}, lapses = ${p.lapses}, suspended = ${p.suspended ?? false},
                         updated_at = now()
    WHERE id = ${id}::uuid RETURNING *`;
  return row;
}

/**
 * Treo mọi thẻ có căn cứ nằm trong danh sách URN vừa đổi.
 * Đây là cơ chế giữ lời hứa "không bao giờ ôn một quy định đã hết hiệu lực" (09-a §6.4).
 */
export async function treoTheTheoCanCu(urns: string[], lyDo: string): Promise<number> {
  if (!urns.length) return 0;
  const rows = await sql<Array<{ id: string }>>`
    UPDATE srs_cards s SET suspended = true, suspend_reason = ${lyDo}, updated_at = now()
    WHERE NOT s.suspended
      AND s.lesson_id IN (
        SELECT DISTINCT b.lesson_id FROM lesson_blocks b
        WHERE b.citations && ${urns}::text[]
      )
    RETURNING s.id`;
  return rows.length;
}

/**
 * Thẻ ôn đến hạn kèm NỘI DUNG để hiển thị.
 *
 * Thẻ chỉ lưu tham chiếu (`ref_kind`, `ref_id`); phiên ôn cần chính đề bài hoặc mặt thẻ lật.
 * Ghép ở tầng CSDL để trang ôn tập không phải gọi thêm một vòng cho mỗi thẻ.
 */
export interface TheOnCoNoiDung extends SrsRow {
  lesson_slug: string | null;
  lesson_title: string | null;
  /** Đề bài (không kèm đáp án) khi thẻ trỏ tới một hoạt động. */
  prompt: Record<string, unknown> | null;
  activity_kind: string | null;
  points: number | null;
}

export async function theOnDenHan(enrollmentId: string, homNay: string, gioiHan = 20) {
  return await sql<TheOnCoNoiDung[]>`
    SELECT s.*, l.slug AS lesson_slug, l.title AS lesson_title,
           a.prompt, a.kind AS activity_kind, a.points
    FROM srs_cards s
    LEFT JOIN lessons l ON l.id = s.lesson_id
    -- Chỉ ghép khi thẻ trỏ tới hoạt động; ref_id của thẻ lật không phải uuid.
    LEFT JOIN activities a
      ON s.ref_kind = 'activity' AND a.id = s.ref_id::uuid AND NOT a.retired
    WHERE s.enrollment_id = ${enrollmentId}::uuid
      AND NOT s.suspended
      AND s.due_on <= ${homNay}::date
    ORDER BY s.due_on, s.lapses DESC
    LIMIT ${gioiHan}`;
}

/** Danh mục mã lỗi khái niệm. */
export interface ErrorTagRow {
  code: string;
  name: string;
  description: string | null;
  remedy: string | null;
}

export async function maLoiTheoCode(code: string): Promise<ErrorTagRow | undefined> {
  const [row] = await sql<ErrorTagRow[]>`SELECT * FROM error_tags WHERE code = ${code} LIMIT 1`;
  return row;
}

export async function danhSachMaLoi() {
  return await sql<ErrorTagRow[]>`SELECT * FROM error_tags ORDER BY code`;
}

/**
 * Nguyên liệu dựng một bài vá cho một mã lỗi (09-a §6.3): các khối căn cứ của bài dạy kỹ
 * năng liên quan, và các câu hỏi bắt đúng lỗi đó.
 */
export async function nguyenLieuBaiVa(courseId: string, maLoi: string) {
  const [hoatDong, khoiCanCu] = await Promise.all([
    // Trạng thái xuất bản của một câu hỏi do BÀI HỌC chứa nó quyết định, không do cột
    // `status` của chính nó: trình đọc bài học cũng phục vụ câu hỏi theo trạng thái của bài.
    // Lọc theo cột riêng của hoạt động sẽ làm bài vá rỗng trong khi bài học vẫn có câu hỏi.
    sql<ActivityRow[]>`
      SELECT a.* FROM activities a
      LEFT JOIN lessons l ON l.id = a.lesson_id
      WHERE a.course_id = ${courseId}::uuid AND NOT a.retired
        AND ${maLoi} = ANY(a.error_tags)
        AND (l.id IS NULL AND a.status = 'xuat_ban' OR l.status = 'xuat_ban')
      ORDER BY a.level, a.ordinal LIMIT 2`,
    sql<Array<BlockRow & { lesson_slug: string; lesson_title: string }>>`
      SELECT b.*, l.slug AS lesson_slug, l.title AS lesson_title
      FROM lesson_blocks b
      JOIN lessons l ON l.id = b.lesson_id
      WHERE l.course_id = ${courseId}::uuid
        AND l.status = 'xuat_ban'
        AND b.kind IN ('can_cu', 'canh_bao')
        AND b.citations && (
          SELECT COALESCE(array_agg(DISTINCT c), '{}')
          FROM activities a, unnest(a.citations) AS c
          WHERE a.course_id = ${courseId}::uuid AND ${maLoi} = ANY(a.error_tags)
        )
      ORDER BY b.kind, b.ordinal LIMIT 4`,
  ]);
  return { hoatDong, khoiCanCu };
}

/** Sản phẩm người học đã nộp — hồ sơ hiển thị ở trang tiến độ. */
export async function sanPhamDaNop(enrollmentId: string) {
  return await sql<
    Array<{
      attempt_id: string;
      activity_id: string;
      title: string | null;
      kind: string;
      lesson_slug: string | null;
      lesson_title: string | null;
      score: string;
      max_score: string;
      passed: boolean;
      created_at: Date;
    }>
  >`
    SELECT DISTINCT ON (a.activity_id)
           a.id AS attempt_id, a.activity_id, act.title, act.kind,
           l.slug AS lesson_slug, l.title AS lesson_title,
           a.score, a.max_score, a.passed, a.created_at
    FROM attempts a
    JOIN activities act ON act.id = a.activity_id
    LEFT JOIN lessons l ON l.id = act.lesson_id
    WHERE a.enrollment_id = ${enrollmentId}::uuid
      -- Chỉ dạng bài tạo ra sản phẩm hồ sơ, không phải câu trắc nghiệm.
      AND act.kind IN ('viet_co_can_cu', 'dien_bieu_mau', 'du_an_nho', 'dong_vai_hoi_dong')
    ORDER BY a.activity_id, a.created_at DESC`;
}

/** Số phút học theo tuần, tám tuần gần nhất — biểu đồ ở trang tiến độ. */
export async function phutHocTheoTuan(enrollmentId: string, soTuan = 8) {
  return await sql<Array<{ tuan: string; phut: number }>>`
    SELECT to_char(date_trunc('week', e.created_at), 'YYYY-MM-DD') AS tuan,
           (count(*) * 2)::int AS phut
    FROM learning_events e
    WHERE e.enrollment_id = ${enrollmentId}::uuid
      AND e.created_at >= now() - (${soTuan} || ' weeks')::interval
    GROUP BY 1 ORDER BY 1`;
}

/* ------------------------------------------------------------------ */
/* Sự kiện học                                                         */
/* ------------------------------------------------------------------ */

export async function ghiSuKienHoc(p: {
  enrollmentId: string;
  kind: string;
  lessonId?: string | null;
  blockId?: string | null;
  activityId?: string | null;
  payload?: unknown;
}) {
  await sql`
    INSERT INTO learning_events (enrollment_id, kind, lesson_id, block_id, activity_id, payload)
    VALUES (${p.enrollmentId}::uuid, ${p.kind}, ${p.lessonId ?? null}::uuid, ${p.blockId ?? null}::uuid,
            ${p.activityId ?? null}::uuid, ${sql.json((p.payload ?? {}) as never)})`;
}

/* ------------------------------------------------------------------ */
/* Việc soạn bài bằng AI                                               */
/* ------------------------------------------------------------------ */

export interface AuthoringJobRow {
  id: string;
  course_id: string | null;
  lesson_id: string | null;
  step: string;
  state: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  applied_at: Date | null;
  model: string | null;
  tokens_in: number;
  tokens_out: number;
  cost_usd: string;
  batch: boolean;
  error: string | null;
  requested_by: string | null;
  /** Việc cha `soan_tu_dong` đã giao việc này (0063). */
  parent_id: string | null;
  /** Xong thì tự nhận kết quả vào bản nháp của bài (0063). */
  auto_apply: boolean;
  created_at: Date;
}

export async function taoViecSoanBai(p: {
  courseId?: string | null;
  lessonId?: string | null;
  step: string;
  input: unknown;
  budgetUsd?: number | null;
  batch?: boolean;
  requestedBy?: string | null;
  parentId?: string | null;
  autoApply?: boolean;
}): Promise<AuthoringJobRow> {
  const [row] = await sql<AuthoringJobRow[]>`
    INSERT INTO authoring_jobs (course_id, lesson_id, step, input, budget_usd, batch, requested_by,
                                parent_id, auto_apply)
    VALUES (${p.courseId ?? null}::uuid, ${p.lessonId ?? null}::uuid, ${p.step},
            ${sql.json((p.input ?? {}) as never)}, ${p.budgetUsd ?? null}, ${p.batch ?? true},
            ${p.requestedBy ?? null}, ${p.parentId ?? null}::uuid, ${p.autoApply ?? false})
    RETURNING *`;
  return row!;
}

/** Bước của việc cha soạn cả chuyên đề từ văn bản (0063). */
export const BUOC_SOAN_TU_DONG = "soan_tu_dong";

export interface TienDoBaiSoanTuDong {
  lesson_id: string;
  slug: string;
  title: string;
  status: string;
  topic_code: string | null;
  /** Việc con của bài, theo bước. */
  viec: Array<{ id: string; step: string; state: string; applied: boolean; error: string | null }>;
  so_cau_cho_duyet: number;
  so_cau_da_duyet: number;
}

export interface TienDoSoanTuDong {
  id: string;
  state: string;
  error: string | null;
  created_at: Date;
  requested_by: string | null;
  batch: boolean;
  course: { id: string; slug: string; title: string } | null;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  /** Chi phí của việc cha cộng mọi việc con (USD). */
  tong_chi_phi: number;
  /** Số việc con theo trạng thái. */
  dem: Record<string, number>;
  bai: TienDoBaiSoanTuDong[];
}

/**
 * Các lần soạn tự động gần đây kèm tiến độ từng bài: trạng thái bài, trạng thái từng việc con,
 * số câu hỏi đang chờ duyệt và đã duyệt. Bốn truy vấn cho cả danh sách, không truy vấn theo bài.
 */
export async function tienDoSoanTuDong(limit = 10): Promise<TienDoSoanTuDong[]> {
  const cha = await sql<Array<AuthoringJobRow & { course_slug: string | null; course_title: string | null }>>`
    SELECT j.*, c.slug AS course_slug, c.title AS course_title
    FROM authoring_jobs j LEFT JOIN courses c ON c.id = j.course_id
    WHERE j.step = ${BUOC_SOAN_TU_DONG}
    ORDER BY j.created_at DESC LIMIT ${limit}`;
  if (!cha.length) return [];
  const idCha = cha.map((c) => c.id);
  const con = await sql<
    Array<{
      id: string;
      parent_id: string;
      lesson_id: string | null;
      step: string;
      state: string;
      applied_at: Date | null;
      error: string | null;
      cost_usd: string;
    }>
  >`
    SELECT id, parent_id, lesson_id, step, state, applied_at, error, cost_usd
    FROM authoring_jobs WHERE parent_id = ANY(${idCha}::uuid[]) ORDER BY created_at`;
  const idBai = [...new Set(con.map((v) => v.lesson_id).filter((x): x is string => Boolean(x)))];
  const bai = idBai.length
    ? await sql<
        Array<{
          id: string;
          slug: string;
          title: string;
          status: string;
          ordinal: number;
          topic_code: string | null;
        }>
      >`
        SELECT l.id, l.slug, l.title, l.status, l.ordinal, t.code AS topic_code
        FROM lessons l LEFT JOIN question_topics t ON t.id = l.topic_id
        WHERE l.id = ANY(${idBai}::uuid[]) ORDER BY l.ordinal`
    : [];
  const idViec = con.map((v) => v.id);
  const demCau = idViec.length
    ? await sql<Array<{ authoring_job_id: string; cho: number; duyet: number }>>`
        SELECT authoring_job_id,
               count(*) FILTER (WHERE status = 'cho_duyet')::int AS cho,
               count(*) FILTER (WHERE status = 'da_duyet')::int AS duyet
        FROM questions WHERE authoring_job_id = ANY(${idViec}::uuid[])
        GROUP BY authoring_job_id`
    : [];
  const cauTheoViec = new Map(demCau.map((d) => [d.authoring_job_id, d]));

  return cha.map((c) => {
    const conCuaCha = con.filter((v) => v.parent_id === c.id);
    const dem: Record<string, number> = {};
    for (const v of conCuaCha) dem[v.state] = (dem[v.state] ?? 0) + 1;
    const baiCuaCha = bai.filter((b) => conCuaCha.some((v) => v.lesson_id === b.id));
    return {
      id: c.id,
      state: c.state,
      error: c.error,
      created_at: c.created_at,
      requested_by: c.requested_by,
      batch: c.batch,
      course: c.course_id
        ? { id: c.course_id, slug: c.course_slug ?? "", title: c.course_title ?? "" }
        : null,
      input: c.input,
      output: c.output,
      tong_chi_phi: [c, ...conCuaCha].reduce((t, v) => t + Number(v.cost_usd ?? 0), 0),
      dem,
      bai: baiCuaCha.map((b) => {
        const viec = conCuaCha.filter((v) => v.lesson_id === b.id);
        return {
          lesson_id: b.id,
          slug: b.slug,
          title: b.title,
          status: b.status,
          topic_code: b.topic_code,
          viec: viec.map((v) => ({
            id: v.id,
            step: v.step,
            state: v.state,
            applied: Boolean(v.applied_at),
            error: v.error,
          })),
          so_cau_cho_duyet: viec.reduce((t, v) => t + (cauTheoViec.get(v.id)?.cho ?? 0), 0),
          so_cau_da_duyet: viec.reduce((t, v) => t + (cauTheoViec.get(v.id)?.duyet ?? 0), 0),
        };
      }),
    };
  });
}

export async function vieCSoanBaiTheoId(id: string): Promise<AuthoringJobRow | undefined> {
  const [row] = await sql<AuthoringJobRow[]>`SELECT * FROM authoring_jobs WHERE id = ${id}::uuid LIMIT 1`;
  return row;
}

export async function danhSachViecSoanBai(o: { courseId?: string; state?: string; limit?: number } = {}) {
  return await sql<AuthoringJobRow[]>`
    SELECT * FROM authoring_jobs
    WHERE (${o.courseId ?? null}::uuid IS NULL OR course_id = ${o.courseId ?? null}::uuid)
      AND (${o.state ?? null}::text IS NULL OR state = ${o.state ?? null}::text)
    ORDER BY created_at DESC LIMIT ${o.limit ?? 50}`;
}

export async function batDauViecSoanBai(id: string) {
  await sql`UPDATE authoring_jobs SET state = 'dang_chay', started_at = now() WHERE id = ${id}::uuid`;
}

export async function ketThucViecSoanBai(
  id: string,
  p: {
    output?: unknown;
    error?: string | null;
    model?: string | null;
    promptVersion?: string | null;
    tokensIn?: number;
    tokensOut?: number;
    costUsd?: number;
  },
) {
  await sql`
    UPDATE authoring_jobs SET
      state = ${p.error ? "loi" : "xong"}, output = ${sql.json((p.output ?? {}) as never)},
      error = ${p.error ?? null}, model = ${p.model ?? null}, prompt_version = ${p.promptVersion ?? null},
      tokens_in = ${p.tokensIn ?? 0}, tokens_out = ${p.tokensOut ?? 0}, cost_usd = ${p.costUsd ?? 0},
      finished_at = now()
    WHERE id = ${id}::uuid`;
}

export async function danhDauDaNhanKetQua(id: string, boi: string) {
  await sql`UPDATE authoring_jobs SET applied_at = now(), applied_by = ${boi} WHERE id = ${id}::uuid`;
}

/** `noi`: thêm sau phần đang có; `thay`: bỏ phần AI soạn trước đó của bài rồi ghi phần mới. */
export type CheDoNhanKetQua = "noi" | "thay";

/** Trạng thái bài còn nhận nội dung AI: bài đang soạn. Bài chờ duyệt hay đã xuất bản thì không. */
const TRANG_THAI_NHAN_DUOC_AI: readonly string[] = ["nhap", "ai_soan", "bien_tap", "can_cap_nhat"];

export type KetQuaNhanViec =
  | { ok: true; buoc: string; soKhoi: number; soBaiTap: number }
  | {
      ok: false;
      lyDo: "khong_co" | "chua_xong" | "da_nhan" | "thieu_bai" | "bai_khong_nhan" | "khong_co_noi_dung";
      thongDiep: string;
    };

/**
 * Nhận kết quả một việc soạn bài vào bản nháp của bài (09-c §4.3), trong một giao dịch.
 *
 * - `soan_bai`: ghi `output.khoi` vào `lesson_blocks`.
 * - `sinh_bai_tap`, `sinh_rubric`: ghi `output.baiTap` vào `activities`.
 * - Bước khác: chỉ đánh dấu đã nhận, như trước.
 *
 * Chỉ ghi phần đã qua hậu kiểm của worker; phần bị loại nằm lại trong `output.biLoai`. Mọi thứ
 * ghi vào đều mang `source = 'ai'`, và bài chỉ tới người học khi duyệt xuất bản: nhận vào
 * nháp không phải duyệt. Vì thế không nhận vào bài đang chờ duyệt hay đã xuất bản — trang
 * học đọc thẳng `lesson_blocks`, ghi vào đó là đổi nội dung người học đang thấy.
 */
export async function nhanKetQuaSoanBai(
  id: string,
  boi: string,
  cheDo: CheDoNhanKetQua = "noi",
): Promise<KetQuaNhanViec> {
  const viec = await vieCSoanBaiTheoId(id);
  if (!viec) return { ok: false, lyDo: "khong_co", thongDiep: "Không tìm thấy việc soạn bài" };
  if (viec.applied_at)
    return { ok: false, lyDo: "da_nhan", thongDiep: "Kết quả này đã được nhận vào bản nháp" };

  const laKhoi = viec.step === "soan_bai";
  const laBaiTap = viec.step === "sinh_bai_tap" || viec.step === "sinh_rubric";
  if (!laKhoi && !laBaiTap) {
    await danhDauDaNhanKetQua(id, boi);
    return { ok: true, buoc: viec.step, soKhoi: 0, soBaiTap: 0 };
  }

  if (viec.state !== "xong") {
    return { ok: false, lyDo: "chua_xong", thongDiep: "Việc chưa chạy xong, chưa có kết quả để nhận" };
  }
  const bai = viec.lesson_id ? await baiHocTheoId(viec.lesson_id) : undefined;
  if (!bai) return { ok: false, lyDo: "thieu_bai", thongDiep: "Việc này không gắn với bài học nào" };
  if (!TRANG_THAI_NHAN_DUOC_AI.includes(bai.status)) {
    const ten = NHAN_TRANG_THAI_NOI_DUNG[bai.status as TrangThaiNoiDung] ?? bai.status;
    return {
      ok: false,
      lyDo: "bai_khong_nhan",
      thongDiep: `Bài đang ở trạng thái "${ten}". Chỉ nhận nội dung AI vào bài đang soạn; bài đã xuất bản thì chuyển sang "Cần cập nhật" trước.`,
    };
  }

  const out = viec.output as { khoi?: unknown; baiTap?: unknown };
  const khoi = laKhoi && Array.isArray(out.khoi) ? (out.khoi as KhoiNhan[]) : [];
  const baiTap = laBaiTap && Array.isArray(out.baiTap) ? (out.baiTap as BaiTapNhan[]) : [];
  if (!khoi.length && !baiTap.length) {
    return {
      ok: false,
      lyDo: "khong_co_noi_dung",
      thongDiep: "Kết quả không còn phần nào qua hậu kiểm để nhận",
    };
  }

  return (await sql.begin(async (tx) => {
    // Khóa bằng chính điều kiện "chưa nhận": hai người bấm cùng lúc thì chỉ một người ghi.
    const [giu] = await tx`
      UPDATE authoring_jobs SET applied_at = now(), applied_by = ${boi}
      WHERE id = ${id}::uuid AND applied_at IS NULL RETURNING id`;
    if (!giu) return { ok: false, lyDo: "da_nhan", thongDiep: "Kết quả này đã được nhận vào bản nháp" };

    if (laKhoi) {
      if (cheDo === "thay")
        await tx`DELETE FROM lesson_blocks WHERE lesson_id = ${bai.id}::uuid AND source = 'ai'`;
      const [m] = await tx<Array<{ n: number }>>`
        SELECT COALESCE(max(ordinal), 0)::int AS n FROM lesson_blocks WHERE lesson_id = ${bai.id}::uuid`;
      for (const [i, k] of khoi.entries()) {
        await tx`
          INSERT INTO lesson_blocks (lesson_id, ordinal, kind, data, citations, source)
          VALUES (${bai.id}::uuid, ${m!.n + i + 1}, ${k.kind}, ${tx.json(k.data as never)},
                  ${k.citations ?? []}, 'ai')`;
      }
      const tatCa = await tx<Array<{ kind: LoaiKhoi; data: Record<string, unknown> }>>`
        SELECT kind, data FROM lesson_blocks WHERE lesson_id = ${bai.id}::uuid`;
      await tx`UPDATE lessons SET estimated_minutes = ${phutCuaBai(tatCa)} WHERE id = ${bai.id}::uuid`;
    } else {
      if (cheDo === "thay") {
        await tx`
          UPDATE activities SET retired = true, updated_at = now()
          WHERE lesson_id = ${bai.id}::uuid AND source = 'ai' AND NOT retired`;
      }
      const [m] = await tx<Array<{ n: number }>>`
        SELECT COALESCE(max(ordinal), 0)::int AS n FROM activities WHERE lesson_id = ${bai.id}::uuid`;
      for (const [i, b] of baiTap.entries()) {
        await tx`
          INSERT INTO activities (course_id, lesson_id, ordinal, kind, mode, title, prompt, answer, rubric,
                                  error_tags, citations, points, level, source)
          VALUES (${bai.course_id}::uuid, ${bai.id}::uuid, ${m!.n + i + 1}, ${b.kind}, ${b.mode},
                  ${b.title ?? null}, ${tx.json(b.prompt as never)}, ${tx.json(b.answer as never)},
                  ${tx.json((b.rubric ?? {}) as never)}, ${b.errorTags ?? []}, ${b.citations ?? []},
                  ${b.points ?? 1}, ${b.level ?? 1}, 'ai')`;
      }
    }
    await tx`
      UPDATE lessons
      SET status = CASE WHEN status = 'nhap' THEN 'ai_soan' ELSE status END,
          updated_by = ${boi}, updated_at = now()
      WHERE id = ${bai.id}::uuid`;
    return { ok: true, buoc: viec.step, soKhoi: khoi.length, soBaiTap: baiTap.length };
  })) as KetQuaNhanViec;
}

/** Khối trong `authoring_jobs.output.khoi`, do worker ghi sau hậu kiểm (`KhoiAi` của @qdpl/dao-tao). */
interface KhoiNhan {
  kind: string;
  data: Record<string, unknown>;
  citations?: string[];
}

/** Bài tập trong `authoring_jobs.output.baiTap` (`BaiTapAi` của @qdpl/dao-tao). */
interface BaiTapNhan {
  kind: string;
  mode: string;
  title?: string | null;
  prompt: Record<string, unknown>;
  answer: Record<string, unknown>;
  rubric?: Record<string, unknown>;
  citations?: string[];
  errorTags?: string[];
  level?: number;
  points?: number;
}

/**
 * Chủ đề ngân hàng câu hỏi của bài; bài chưa có thì tạo rồi gắn (docs/PLAN.md GĐ8, GĐ11).
 *
 * Câu AI sinh cho bài vào đúng chủ đề này, nên khi được duyệt nó vừa hiện ở kiểm tra cuối bài
 * (rút theo `lessons.topic_id`, gồm cả cây con), vừa dùng được cho luyện tập và đề thi.
 * Chủ đề của bài là con của chủ đề chuyên đề: chủ đề bài khác trong chuyên đề đã gắn (cách seed
 * đang làm), hoặc chủ đề `cd-<slug chuyên đề>` tạo mới. Bài đã có chủ đề thì giữ nguyên.
 */
export async function damBaoChuDeCuaBai(lessonId: string): Promise<ChuDeCauHoiRow | undefined> {
  const bai = await baiHocTheoId(lessonId);
  if (!bai) return undefined;
  if (bai.topic_id) {
    const [cu] = await sql<ChuDeCauHoiRow[]>`SELECT * FROM question_topics WHERE id = ${bai.topic_id}::uuid`;
    if (cu) return cu;
  }
  const course = await chuyenDeTheoId(bai.course_id);
  if (!course) return undefined;

  const [anhEm] = await sql<Array<{ topic_id: string }>>`
    SELECT topic_id FROM lessons
    WHERE course_id = ${course.id}::uuid AND topic_id IS NOT NULL AND id <> ${bai.id}::uuid
    ORDER BY ordinal LIMIT 1`;
  // Bài anh em gắn chủ đề chuyên đề (seed) thì lấy chính nó; gắn chủ đề riêng của bài (mã `bai-`,
  // do hàm này tạo) thì lấy chủ đề cha của nó.
  const [chuDeAnhEm] = anhEm
    ? await sql<ChuDeCauHoiRow[]>`SELECT * FROM question_topics WHERE id = ${anhEm.topic_id}::uuid`
    : [];
  const [chaDaCo] =
    chuDeAnhEm?.code.startsWith("bai-") && chuDeAnhEm.parent_id
      ? await sql<ChuDeCauHoiRow[]>`SELECT * FROM question_topics WHERE id = ${chuDeAnhEm.parent_id}::uuid`
      : [chuDeAnhEm];
  const cha =
    chaDaCo ??
    (await luuChuDeCauHoi({
      code: `cd-${course.slug}`.slice(0, 80),
      name: course.title,
      fieldId: course.field_id,
    }));

  const chuDe = await luuChuDeCauHoi({
    // Mã kèm 8 ký tự đầu của id bài để không trùng khi slug dài phải cắt.
    code: `bai-${bai.slug.slice(0, 60)}-${bai.id.slice(0, 8)}`,
    name: bai.title,
    fieldId: course.field_id,
    parentId: cha.id,
    ordinal: bai.ordinal,
  });
  await sql`UPDATE lessons SET topic_id = ${chuDe.id}::uuid, updated_at = now() WHERE id = ${bai.id}::uuid`;
  return chuDe;
}

/** Chi phí soạn bài trong tháng, để đối chiếu với hạn mức (09-c §3). */
export async function chiPhiSoanBaiThang(): Promise<number> {
  const [row] = await sql<Array<{ tong: string }>>`
    SELECT COALESCE(sum(cost_usd), 0) AS tong FROM authoring_jobs
    WHERE created_at >= date_trunc('month', now())`;
  return Number(row?.tong ?? 0);
}

/* ------------------------------------------------------------------ */
/* Chứng nhận                                                          */
/* ------------------------------------------------------------------ */

export async function capChungNhan(p: {
  enrollmentId: string;
  score: number;
  asOf: string;
  legalBasis: unknown;
  issuedBy?: string | null;
}) {
  const code = `QDPL-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const [row] = await sql`
    INSERT INTO certificates (enrollment_id, code, score, as_of, legal_basis, issued_by)
    VALUES (${p.enrollmentId}::uuid, ${code}, ${p.score}, ${p.asOf}::date,
            ${sql.json((p.legalBasis ?? []) as never)}, ${p.issuedBy ?? null})
    RETURNING *`;
  return row;
}

export async function thuHoiChungNhan(id: string, boi: string, lyDo: string) {
  const [row] = await sql`
    UPDATE certificates SET revoked_at = now(), revoked_by = ${boi}, revoke_reason = ${lyDo}
    WHERE id = ${id}::uuid RETURNING *`;
  return row;
}

export async function chungNhanCuaGhiDanh(enrollmentId: string) {
  return await sql`SELECT * FROM certificates WHERE enrollment_id = ${enrollmentId}::uuid ORDER BY issued_at DESC`;
}

/* ------------------------------------------------------------------ */
/* Thống kê quản trị                                                   */
/* ------------------------------------------------------------------ */

export async function tongQuanDaoTao() {
  const [[canCuHong], [choDuyet], [viecLoi], [choChamLai], chiPhi] = await Promise.all([
    sql<Array<{ so: number }>>`
      SELECT count(*)::int AS so FROM lessons
      WHERE status = 'xuat_ban' AND citation_health <> 'ok'`,
    sql<Array<{ so: number }>>`SELECT count(*)::int AS so FROM lessons WHERE status = 'cho_phap_che'`,
    sql<Array<{ so: number }>>`SELECT count(*)::int AS so FROM authoring_jobs WHERE state = 'loi'`,
    sql<Array<{ so: number }>>`SELECT count(*)::int AS so FROM attempts WHERE review_state = 'cho_doi_chieu'`,
    chiPhiSoanBaiThang(),
  ]);
  return {
    canCuHong: canCuHong?.so ?? 0,
    choDuyet: choDuyet?.so ?? 0,
    viecLoi: viecLoi?.so ?? 0,
    choChamLai: choChamLai?.so ?? 0,
    chiPhiThangUsd: chiPhi,
  };
}

/** Lượt làm bài của cả chuyên đề, làm đầu vào cho `chiSoCauHoi` của @qdpl/dao-tao. */
export async function luotLamCuaChuyenDe(courseId: string) {
  return await sql<
    Array<{
      activity_id: string;
      enrollment_id: string;
      attempt_no: number;
      score: string;
      max_score: string;
      passed: boolean;
      seconds_spent: number;
      error_tags: string[];
    }>
  >`
    SELECT a.activity_id, a.enrollment_id, a.attempt_no, a.score, a.max_score, a.passed,
           a.seconds_spent, a.error_tags
    FROM attempts a JOIN activities act ON act.id = a.activity_id
    WHERE act.course_id = ${courseId}::uuid`;
}

export async function pheuCuaChuyenDe(courseId: string) {
  const [row] = await sql<
    Array<{
      ghi_danh: number;
      vao_bai_dau: number;
      xong_bai_dau: number;
      xong_nua: number;
      hoan_thanh: number;
    }>
  >`
    WITH e AS (SELECT id FROM enrollments WHERE course_id = ${courseId}::uuid),
         tong AS (SELECT count(*)::int AS n FROM lessons WHERE course_id = ${courseId}::uuid AND status = 'xuat_ban'),
         xong AS (SELECT p.enrollment_id, count(*)::int AS n FROM lesson_progress p
                  JOIN e ON e.id = p.enrollment_id WHERE p.state = 'xong' GROUP BY 1)
    SELECT (SELECT count(*)::int FROM e) AS ghi_danh,
           (SELECT count(DISTINCT enrollment_id)::int FROM lesson_progress p JOIN e ON e.id = p.enrollment_id) AS vao_bai_dau,
           (SELECT count(*)::int FROM xong WHERE n >= 1) AS xong_bai_dau,
           (SELECT count(*)::int FROM xong, tong WHERE xong.n * 2 >= tong.n AND tong.n > 0) AS xong_nua,
           (SELECT count(*)::int FROM enrollments WHERE course_id = ${courseId}::uuid AND state = 'hoan_thanh') AS hoan_thanh`;
  return {
    ghiDanh: row?.ghi_danh ?? 0,
    vaoBaiDau: row?.vao_bai_dau ?? 0,
    xongBaiDau: row?.xong_bai_dau ?? 0,
    xongNuaChuyenDe: row?.xong_nua ?? 0,
    hoanThanh: row?.hoan_thanh ?? 0,
  };
}
