import { danhSachNhomHocTapSchema, maNhomHocTapSchema } from "../nhom-hoc-tap.ts";
/**
 * API quản trị mô-đun đào tạo và mascot (ke-hoach/09-c).
 *
 * Hai nguyên tắc chi phối toàn bộ tệp:
 *  1. **Quyền kiểm ở đây**, không kiểm ở giao diện. Giao diện ẩn nút chỉ để cho gọn.
 *  2. **Không nút nào đổi nội dung mà không ghi nhật ký.** Mọi thao tác gọi `ghiNhatKy`.
 */

import { atLeast } from "@qdpl/auth";
import {
  chiSoCauHoi,
  chuyenDuoc,
  type KhoiNoiDung,
  kiemTraBaiHoc,
  kiemTraRubric,
  LOAI_CAU_HOI,
  lechCham,
  MUC_DO_CAU_HOI,
  pheuHoanThanh,
  type TrangThaiNoiDung,
  timChuTrinh,
  VAI_TRO_DAT_TRANG_THAI,
} from "@qdpl/dao-tao";
import {
  baiHocCuaChuyenDe,
  baiHocTheoId,
  batTatHanhDong,
  batTatNhanVat,
  caiDatMascot,
  capChungNhan,
  capNhatLoSinhAnh,
  chamLai,
  chungNhanCuaGhiDanh,
  chuyenDeTheoId,
  chuyenDeTheoSlug,
  damBaoChuDeCuaBai,
  danhSachAnh,
  danhSachBanGiao,
  danhSachChuyenDe,
  danhSachHanhDong,
  danhSachLinhVuc,
  danhSachLoSinhAnh,
  danhSachNhanVat,
  danhSachViecSoanBai,
  datTinhTrangAnh,
  datTrangThaiBaiHoc,
  datTrangThaiChuyenDe,
  goHoatDong,
  hangDoiChamLai,
  hieuQuaMascot,
  hoatDongCuaBai,
  khoiCuaBai,
  kyNangCuaChuyenDe,
  LoiNghiepVu,
  luotLamCuaChuyenDe,
  luuBaiHoc,
  luuBanGiao,
  luuCaiDatMascot,
  luuChuyenDe,
  luuHanhDong,
  luuHoatDong,
  luuKhoi,
  luuKyNang,
  luuNhanVat,
  nhanKetQuaSoanBai,
  nhanVatTheoId,
  pheuCuaChuyenDe,
  sapXepKhoi,
  soKhoiTheoBai,
  soLieuHanhDong,
  taoLoSinhAnh,
  taoViecSoanBai,
  thuHoiChungNhan,
  tienDoSoanTuDong,
  tongQuanDaoTao,
  xoaBaiHoc,
  xoaHanhDong,
  xoaKhoi,
} from "@qdpl/db";
import {
  bangDinhTuyen,
  chonTrangPhuc,
  danhGiaHanhDong,
  kiemTraHanhDong,
  type NhanVat,
  TRANG_PHUC,
  TRANG_THAI,
  veMascot,
} from "@qdpl/mascot";
import { Hono } from "hono";
import { z } from "zod";
import { batBuocVaiTro, ghiNhatKy, KhongDuQuyen } from "../auth.ts";
import { dayViecSoanBai } from "../chay-soan-bai.ts";
import { soanTiepChuyenDe, taoTuPdf, tienDoSoanCuaChuyenDe } from "../chuyen-de-tu-pdf.ts";
import { asDate, badRequest, conflict, notFound, parseBody, parseQuery } from "../http.ts";
import { taoViecSinhCauHoi } from "../sinh-cau-hoi-ai.ts";
import { laMauDe } from "../sinh-de-tu-van-ban.ts";
import { taoLanSoanTuDong, tranChiPhiSoanTuDong } from "../soan-tu-dong.ts";
import { toNhanVat } from "./mascot.ts";
import { docTepPdf } from "./quan-tri-van-ban.ts";

export const quanTri = new Hono();

const uuid = z.string().uuid();

/* ------------------------------------------------------------------ */
/* Tổng quan                                                           */
/* ------------------------------------------------------------------ */

/** GET /v1/quan-tri/dao-tao/tong-quan — sáu thẻ số liệu ở 09-c §3. */
quanTri.get("/dao-tao/tong-quan", async (c) => {
  await batBuocVaiTro(c, "quan_ly");
  const [tq, anhChoDuyet, hieuQua] = await Promise.all([
    tongQuanDaoTao(),
    danhSachAnh({ status: "cho_duyet", limit: 500 }),
    hieuQuaMascot(),
  ]);
  return c.json({
    ...tq,
    anhChoDuyet: anhChoDuyet.length,
    // Chỉ số nghiêm khắc nhất: mascot có giúp người học hoàn thành bài hơn không.
    hieuQuaMascot: hieuQua,
  });
});

/* ------------------------------------------------------------------ */
/* Chuyên đề                                                           */
/* ------------------------------------------------------------------ */

quanTri.get("/dao-tao/chuyen-de", async (c) => {
  await batBuocVaiTro(c, "quan_ly");
  const { nhom } = parseQuery(
    c,
    z.object({ nhom: z.union([z.enum(["tat_ca", "chua_phan_nhom"]), maNhomHocTapSchema]).default("tat_ca") }),
  );
  const rows = await danhSachChuyenDe({
    chiXuatBan: false,
    limit: 200,
    chuaPhanNhom: nhom === "chua_phan_nhom",
    nhomHocTap: nhom === "tat_ca" || nhom === "chua_phan_nhom" ? undefined : [nhom],
  });
  return c.json({
    items: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      status: r.status,
      level: r.level,
      audience: r.audience,
      nhomHocTap: r.nhom_hoc_tap,
      tags: r.tags,
      lessonCount: r.lesson_count,
      asOf: asDate(r.as_of) ?? "",
      citationHealth: r.citation_health,
      linhVuc: r.field_slug ? { slug: r.field_slug, name: r.field_name ?? r.field_slug } : null,
      nhomDoiTuong: r.audience_group,
      chaId: r.parent_id,
      noiTiepTuId: r.follows_id,
      mascotId: r.mascot_id,
      mascotLocked: r.mascot_locked,
      updatedAt: r.updated_at,
    })),
  });
});

/** GET /v1/quan-tri/dao-tao/linh-vuc — lĩnh vực đào tạo để gắn chuyên đề (kể cả lĩnh vực đang biên soạn). */
quanTri.get("/dao-tao/linh-vuc", async (c) => {
  await batBuocVaiTro(c, "quan_ly");
  const rows = await danhSachLinhVuc();
  return c.json({ items: rows.map((r) => ({ id: r.id, slug: r.slug, name: r.name, status: r.status })) });
});

/** GET /v1/quan-tri/dao-tao/chuyen-de/:slug — một chuyên đề kèm mọi bài (mọi trạng thái), cho trang soạn. */
quanTri.get("/dao-tao/chuyen-de/:slug", async (c) => {
  await batBuocVaiTro(c, "quan_ly");
  const r = await chuyenDeTheoSlug(c.req.param("slug"));
  if (!r) throw notFound("Không tìm thấy chuyên đề");
  const [bai, soKhoi] = await Promise.all([baiHocCuaChuyenDe(r.id), soKhoiTheoBai(r.id)]);
  return c.json({
    chuyenDe: {
      id: r.id,
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      status: r.status,
      level: r.level,
      asOf: asDate(r.as_of) ?? "",
      fieldId: r.field_id,
      audienceGroup: r.audience_group,
      nhomHocTap: r.nhom_hoc_tap,
      ordinal: r.ordinal,
      defaultMode: r.default_mode,
    },
    bai: bai.map((b) => ({
      id: b.id,
      slug: b.slug,
      ordinal: b.ordinal,
      title: b.title,
      status: b.status,
      estimatedMinutes: b.estimated_minutes,
      soKhoi: soKhoi.get(b.id) ?? 0,
    })),
  });
});

const chuyenDeSchema = z.object({
  id: uuid.optional(),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Slug chỉ gồm chữ thường, số và dấu gạch ngang"),
  title: z.string().trim().min(3).max(500),
  summary: z.string().trim().max(2000).nullable().optional(),
  audience: z.array(z.string().trim()).default([]),
  nhomHocTap: danhSachNhomHocTapSchema.optional(),
  level: z.enum(["co_ban", "nang_cao", "chuyen_sau"]).default("co_ban"),
  tags: z.array(z.string().trim()).default([]),
  taxonomyCodes: z.array(z.string().trim()).default([]),
  objectives: z.array(z.string().trim()).default([]),
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMinutes: z.number().int().min(0).max(100_000).nullable().optional(),
  defaultMode: z.enum(["day_du", "nhanh", "tra_cuu", "on_thi"]).default("day_du"),
  mascotId: uuid.nullable().optional(),
  mascotLocked: z.boolean().default(false),
  mascotCostume: z.string().trim().nullable().optional(),
  fieldId: uuid.nullable().optional(),
  parentId: uuid.nullable().optional(),
  followsId: uuid.nullable().optional(),
  audienceGroup: z.enum(["khach_hang", "tu_van"]).default("khach_hang"),
  ordinal: z.number().int().min(0).max(1000).default(0),
});

quanTri.post("/dao-tao/chuyen-de", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  const body = await parseBody(c, chuyenDeSchema);
  // Sửa chuyên đề đã có: trường không gửi lên thì giữ giá trị cũ, không để mặc định của schema
  // xóa mục tiêu, thẻ, mascot… mà seed đã nạp. Bản đồ pháp lý không sửa qua API này nên luôn giữ.
  const cu = await chuyenDeTheoSlug(body.slug);
  const daGui = new Set(Object.keys((await c.req.json()) as Record<string, unknown>));
  const giu = <T>(khoa: string, moi: T, cot: unknown): T => (cu && !daGui.has(khoa) ? (cot as T) : moi);
  if (cu?.status === "xuat_ban" && body.nhomHocTap?.length === 0) {
    throw badRequest("Chuyên đề đã xuất bản phải có ít nhất một nhóm đối tượng học tập.");
  }
  const row = await luuChuyenDe({
    ...body,
    summary: giu("summary", body.summary, cu?.summary),
    audience: giu("audience", body.audience, cu?.audience),
    level: giu("level", body.level, cu?.level),
    tags: giu("tags", body.tags, cu?.tags),
    taxonomyCodes: giu("taxonomyCodes", body.taxonomyCodes, cu?.taxonomy_codes),
    objectives: giu("objectives", body.objectives, cu?.objectives),
    durationMinutes: giu("durationMinutes", body.durationMinutes, cu?.duration_minutes),
    defaultMode: giu("defaultMode", body.defaultMode, cu?.default_mode),
    mascotId: giu("mascotId", body.mascotId, cu?.mascot_id),
    mascotLocked: giu("mascotLocked", body.mascotLocked, cu?.mascot_locked),
    mascotCostume: giu("mascotCostume", body.mascotCostume, cu?.mascot_costume),
    fieldId: giu("fieldId", body.fieldId, cu?.field_id),
    parentId: giu("parentId", body.parentId, cu?.parent_id),
    followsId: giu("followsId", body.followsId, cu?.follows_id),
    audienceGroup: giu("audienceGroup", body.audienceGroup, cu?.audience_group),
    ordinal: giu("ordinal", body.ordinal, cu?.ordinal),
    legalMap: cu?.legal_map ?? {},
  });
  await ghiNhatKy(p.email, "dao_tao.chuyen_de.luu", row.id, { slug: row.slug });
  return c.json({ chuyenDe: row });
});

/** POST /v1/quan-tri/dao-tao/chuyen-de/:id/trang-thai — xuất bản chỉ dành cho Admin quản lý. */
quanTri.post("/dao-tao/chuyen-de/:id/trang-thai", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  const body = await parseBody(c, z.object({ trangThai: z.string().trim() }));
  const moi = body.trangThai as TrangThaiNoiDung;
  const cu = await chuyenDeTheoId(c.req.param("id"));
  if (!cu) throw notFound("Không tìm thấy chuyên đề");
  if (!chuyenDuoc(cu.status as TrangThaiNoiDung, moi)) {
    throw badRequest(`Không chuyển được từ "${cu.status}" sang "${moi}"`);
  }
  const canVaiTro = VAI_TRO_DAT_TRANG_THAI[moi];
  if (!atLeast(p.role, canVaiTro)) throw new KhongDuQuyen(canVaiTro);

  if (moi === "xuat_ban" && !cu.nhom_hoc_tap.length) {
    throw badRequest("Chọn và lưu ít nhất một nhóm đối tượng học tập trước khi xuất bản.");
  }
  const row = await datTrangThaiChuyenDe(cu.id, moi);
  await ghiNhatKy(p.email, `dao_tao.chuyen_de.${moi}`, cu.id, { tu: cu.status, den: moi });
  return c.json({ chuyenDe: row });
});

/**
 * GET /v1/quan-tri/dao-tao/chuyen-de/:slug/kiem-tra — bảng kiểm trước xuất bản (09-c §4.1).
 * Trả về đúng thứ chặn xuất bản, không phải một điểm số chung chung.
 */
quanTri.get("/dao-tao/chuyen-de/:slug/kiem-tra", async (c) => {
  await batBuocVaiTro(c, "quan_ly");
  const course = await chuyenDeTheoSlug(c.req.param("slug"));
  if (!course) throw notFound("Không tìm thấy chuyên đề");

  const [bai, kyNang] = await Promise.all([baiHocCuaChuyenDe(course.id), kyNangCuaChuyenDe(course.id)]);
  const chuTrinh = timChuTrinh(
    kyNang.map((k) => ({ id: k.id, code: k.code, name: k.name, prerequisites: k.prerequisites })),
  );

  const theoBai = [];
  for (const b of bai) {
    const khoiRows = await khoiCuaBai(b.id);
    const khoi: KhoiNoiDung[] = khoiRows.map((k) => ({
      id: k.id,
      lessonId: k.lesson_id,
      ordinal: k.ordinal,
      kind: k.kind as KhoiNoiDung["kind"],
      data: k.data,
      citations: k.citations,
      citationHealth: k.citation_health as KhoiNoiDung["citationHealth"],
      source: k.source as KhoiNoiDung["source"],
      status: k.status as KhoiNoiDung["status"],
      modes: k.modes as KhoiNoiDung["modes"],
      note: k.note,
    }));
    const kq = kiemTraBaiHoc(khoi);
    const hd = await hoatDongCuaBai(b.id);
    const loiRubric = hd
      .filter((a) => a.mode === "ai" || a.mode === "nguoi")
      .flatMap((a) => kiemTraRubric(a.rubric).map((l) => `${a.title ?? a.kind}: ${l}`));
    theoBai.push({
      id: b.id,
      slug: b.slug,
      ordinal: b.ordinal,
      title: b.title,
      status: b.status,
      dat: kq.dat && loiRubric.length === 0,
      phut: kq.phut,
      soKhoi: khoi.length,
      soHoatDong: hd.length,
      loi: [...kq.loi, ...loiRubric.map((l) => ({ muc: "loi" as const, ma: "rubric", thong_diep: l }))],
    });
  }

  const tuoiAsOf = Math.floor(
    (Date.now() - new Date(asDate(course.as_of) ?? 0).getTime()) / (24 * 3600 * 1000),
  );

  return c.json({
    dat:
      theoBai.filter((b) => b.status === "xuat_ban").every((b) => b.dat) &&
      chuTrinh.length === 0 &&
      tuoiAsOf <= 90 &&
      course.nhom_hoc_tap.length > 0,
    chanBoi: {
      chuaChonNhomHocTap: course.nhom_hoc_tap.length === 0,
      baiHong: theoBai.filter((b) => !b.dat).map((b) => b.slug),
      chuTrinhKyNang: chuTrinh,
      // as_of quá 90 ngày: khung pháp lý có thể đã đổi mà chưa ai rà lại.
      asOfQuaCu: tuoiAsOf > 90 ? tuoiAsOf : null,
    },
    theoBai,
  });
});

/* ------------------------------------------------------------------ */
/* Kỹ năng                                                             */
/* ------------------------------------------------------------------ */

quanTri.put("/dao-tao/chuyen-de/:id/ky-nang", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  const body = await parseBody(
    c,
    z.object({
      kyNang: z.array(
        z.object({
          code: z.string().trim().min(1),
          name: z.string().trim().min(1),
          description: z.string().trim().nullable().optional(),
          prerequisites: z.array(z.string().trim()).default([]),
        }),
      ),
    }),
  );
  const vong = timChuTrinh(body.kyNang.map((k) => ({ id: k.code, ...k })));
  if (vong.length) throw badRequest(`Đồ thị tiên quyết có chu trình: ${vong.join(", ")}`);
  const rows = await luuKyNang(c.req.param("id"), body.kyNang);
  await ghiNhatKy(p.email, "dao_tao.ky_nang.luu", c.req.param("id"), { so: rows.length });
  return c.json({ kyNang: rows });
});

/* ------------------------------------------------------------------ */
/* Bài học và khối                                                     */
/* ------------------------------------------------------------------ */

quanTri.get("/dao-tao/bai/:id", async (c) => {
  await batBuocVaiTro(c, "quan_ly");
  const bai = await baiHocTheoId(c.req.param("id"));
  if (!bai) throw notFound("Không tìm thấy bài học");
  const [khoi, hoatDong] = await Promise.all([khoiCuaBai(bai.id), hoatDongCuaBai(bai.id)]);
  // Quản trị viên ĐƯỢC xem đáp án và rubric — đó là việc của họ.
  // `asOf` là ngày dạng chuỗi: `bai.as_of` là Date, đổi ở trình duyệt dễ lệch múi giờ.
  return c.json({ bai: { ...bai, asOf: asDate(bai.as_of) }, khoi, hoatDong });
});

quanTri.post("/dao-tao/bai", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  const body = await parseBody(
    c,
    z.object({
      id: uuid.optional(),
      courseId: uuid,
      slug: z
        .string()
        .trim()
        .regex(/^[a-z0-9-]+$/),
      ordinal: z.number().int().min(1).max(500),
      title: z.string().trim().min(3).max(500),
      summary: z.string().trim().max(2000).nullable().optional(),
      asOf: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .optional(),
      estimatedMinutes: z.number().int().min(1).max(600).default(15),
      skills: z.array(z.string().trim()).default([]),
      mascotId: uuid.nullable().optional(),
      /** Chủ đề ngân hàng câu hỏi cho phần kiểm tra cuối bài; bỏ trống thì giữ chủ đề đang gắn. */
      topicId: uuid.nullable().optional(),
    }),
  );
  // Như chuyên đề: sửa bài đã có thì trường không gửi lên giữ giá trị cũ (kỹ năng, mascot, nguồn soạn).
  const cu = body.id ? await baiHocTheoId(body.id) : undefined;
  const daGui = new Set(Object.keys((await c.req.json()) as Record<string, unknown>));
  const giu = <T>(khoa: string, moi: T, cot: unknown): T => (cu && !daGui.has(khoa) ? (cot as T) : moi);
  const row = await luuBaiHoc({
    ...body,
    summary: giu("summary", body.summary, cu?.summary),
    asOf: giu("asOf", body.asOf, asDate(cu?.as_of)),
    estimatedMinutes: giu("estimatedMinutes", body.estimatedMinutes, cu?.estimated_minutes),
    skills: giu("skills", body.skills, cu?.skills),
    mascotId: giu("mascotId", body.mascotId, cu?.mascot_id),
    source: cu?.source ?? "nguoi",
    updatedBy: p.email,
  });
  await ghiNhatKy(p.email, "dao_tao.bai.luu", row.id, { slug: row.slug });
  return c.json({ bai: row });
});

quanTri.post("/dao-tao/bai/:id/trang-thai", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  const body = await parseBody(c, z.object({ trangThai: z.string().trim() }));
  const moi = body.trangThai as TrangThaiNoiDung;
  const cu = await baiHocTheoId(c.req.param("id"));
  if (!cu) throw notFound("Không tìm thấy bài học");
  if (!chuyenDuoc(cu.status as TrangThaiNoiDung, moi)) {
    throw badRequest(`Không chuyển được từ "${cu.status}" sang "${moi}"`);
  }
  const canVaiTro = VAI_TRO_DAT_TRANG_THAI[moi];
  if (!atLeast(p.role, canVaiTro)) throw new KhongDuQuyen(canVaiTro);

  // Không xuất bản một bài chưa qua bảng kiểm: đây là nơi ràng buộc sư phạm thành ràng buộc máy.
  if (moi === "xuat_ban") {
    const loi = await loiBangKiemCuaBai(cu.id);
    if (loi.length) throw badRequest("Bài chưa đạt bảng kiểm, không xuất bản được", loi);
  }

  const row = await datTrangThaiBaiHoc(cu.id, moi);
  await ghiNhatKy(p.email, `dao_tao.bai.${moi}`, cu.id, { tu: cu.status, den: moi });
  if (moi === "xuat_ban") void xepDungSachNoi(cu.id);
  return c.json({ bai: row });
});

/** Lỗi mức `loi` của bảng kiểm bài học: còn lỗi nào thì bài chưa xuất bản được. */
async function loiBangKiemCuaBai(lessonId: string) {
  const khoiRows = await khoiCuaBai(lessonId);
  const kq = kiemTraBaiHoc(
    khoiRows.map((k) => ({
      id: k.id,
      lessonId: k.lesson_id,
      ordinal: k.ordinal,
      kind: k.kind as KhoiNoiDung["kind"],
      data: k.data,
      citations: k.citations,
      citationHealth: k.citation_health as KhoiNoiDung["citationHealth"],
      source: k.source as KhoiNoiDung["source"],
      status: k.status as KhoiNoiDung["status"],
      modes: k.modes as KhoiNoiDung["modes"],
      note: k.note,
    })),
  );
  return kq.dat ? [] : kq.loi.filter((l) => l.muc === "loi");
}

/**
 * Chặng phải đi qua để đưa một bài (hoặc chuyên đề) từ trạng thái hiện tại tới đích. Mỗi chặng
 * vẫn là một bước chuyển hợp lệ của CHUYEN_TRANG_THAI và được ghi nhật ký riêng; trạng thái không
 * có ở đây (đã xuất bản, lưu trữ) thì để nguyên.
 */
const CHANG_TOI: Record<
  "cho_phap_che" | "xuat_ban",
  Partial<Record<TrangThaiNoiDung, TrangThaiNoiDung[]>>
> = {
  cho_phap_che: {
    nhap: ["bien_tap", "cho_phap_che"],
    ai_soan: ["bien_tap", "cho_phap_che"],
    bien_tap: ["cho_phap_che"],
    can_cap_nhat: ["bien_tap", "cho_phap_che"],
  },
  xuat_ban: {
    nhap: ["bien_tap", "cho_phap_che", "xuat_ban"],
    ai_soan: ["bien_tap", "cho_phap_che", "xuat_ban"],
    bien_tap: ["cho_phap_che", "xuat_ban"],
    cho_phap_che: ["xuat_ban"],
    can_cap_nhat: ["xuat_ban"],
  },
};

/**
 * POST /v1/quan-tri/dao-tao/chuyen-de/:id/bai/trang-thai — gửi duyệt hoặc xuất bản nhiều bài
 * của một chuyên đề trong một lần, thay cho việc mở từng bài và bấm từng bước chuyển.
 *
 * Không nới quy tắc nào: xuất bản vẫn cần vai trò Admin quản lý, bài chưa đạt bảng kiểm bị bỏ qua kèm
 * lý do (cả khi chỉ gửi duyệt, vì gửi một bài chắc chắn bị trả lại là vô ích). `bai` giới hạn
 * vào một số bài, ví dụ các bài của một lần soạn tự động; bỏ trống là mọi bài của chuyên đề.
 * Xuất bản được ít nhất một bài thì chuyên đề cũng được xuất bản, vì học viên chỉ thấy bài của
 * chuyên đề đã xuất bản.
 */
quanTri.post("/dao-tao/chuyen-de/:id/bai/trang-thai", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  const body = await parseBody(
    c,
    z.object({ den: z.enum(["cho_phap_che", "xuat_ban"]), bai: z.array(uuid).min(1).max(200).optional() }),
  );
  const id = uuid.safeParse(c.req.param("id"));
  const course = id.success ? await chuyenDeTheoId(id.data) : undefined;
  if (!course) throw notFound("Không tìm thấy chuyên đề");
  const canVaiTro = VAI_TRO_DAT_TRANG_THAI[body.den];
  if (!atLeast(p.role, canVaiTro)) throw new KhongDuQuyen(canVaiTro);

  if (body.den === "xuat_ban" && !course.nhom_hoc_tap.length) {
    throw badRequest("Chọn và lưu ít nhất một nhóm đối tượng học tập trước khi xuất bản.");
  }
  const chon = body.bai ? new Set(body.bai) : null;
  const bai = (await baiHocCuaChuyenDe(course.id)).filter((b) => !chon || chon.has(b.id));
  const daChuyen: Array<{ id: string; title: string }> = [];
  const boQua: Array<{ id: string; title: string; ly_do: string[] }> = [];

  for (const b of bai) {
    const chang = CHANG_TOI[body.den][b.status as TrangThaiNoiDung];
    if (!chang) continue;
    const loi = await loiBangKiemCuaBai(b.id);
    if (loi.length) {
      boQua.push({ id: b.id, title: b.title, ly_do: loi.map((l) => l.thong_diep) });
      continue;
    }
    let tu = b.status as TrangThaiNoiDung;
    for (const den of chang) {
      if (!chuyenDuoc(tu, den)) throw badRequest(`Không chuyển được từ "${tu}" sang "${den}"`);
      await datTrangThaiBaiHoc(b.id, den);
      await ghiNhatKy(p.email, `dao_tao.bai.${den}`, b.id, { tu, den, hang_loat: true });
      tu = den;
    }
    if (body.den === "xuat_ban") void xepDungSachNoi(b.id);
    daChuyen.push({ id: b.id, title: b.title });
  }

  let trangThaiChuyenDe = course.status as TrangThaiNoiDung;
  if (body.den === "xuat_ban" && daChuyen.length) {
    for (const den of CHANG_TOI.xuat_ban[trangThaiChuyenDe] ?? []) {
      await datTrangThaiChuyenDe(course.id, den);
      await ghiNhatKy(p.email, `dao_tao.chuyen_de.${den}`, course.id, {
        tu: trangThaiChuyenDe,
        den,
        hang_loat: true,
      });
      trangThaiChuyenDe = den;
    }
  }

  return c.json({ den: body.den, da_chuyen: daChuyen, bo_qua: boQua, chuyen_de: trangThaiChuyenDe });
});

/**
 * Xếp việc dựng sách nói cho bài vừa xuất bản (docs/PLAN.md GĐ14). Không có Redis hoặc quá 3 giây
 * thì bỏ qua: job lặp 6 giờ của worker sẽ dựng sau, xuất bản không phải chờ.
 */
async function xepDungSachNoi(lessonId: string): Promise<void> {
  try {
    const { add, hasRedis, QUEUES } = await import("@qdpl/queue");
    if (!hasRedis()) return;
    await Promise.race([add(QUEUES.sachNoi, { lessonId }), new Promise((r) => setTimeout(r, 3000))]);
  } catch {
    // Sách nói là việc phụ của xuất bản.
  }
}

quanTri.delete("/dao-tao/bai/:id", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  await xoaBaiHoc(c.req.param("id"));
  await ghiNhatKy(p.email, "dao_tao.bai.xoa", c.req.param("id"));
  return c.json({ ok: true });
});

quanTri.post("/dao-tao/khoi", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  const body = await parseBody(
    c,
    z.object({
      id: uuid.optional(),
      lessonId: uuid,
      ordinal: z.number().int().min(1).max(500),
      kind: z.string().trim().min(1),
      data: z.record(z.string(), z.unknown()).default({}),
      citations: z.array(z.string().trim()).default([]),
      source: z.enum(["nguoi", "ai", "ai_da_sua"]).default("nguoi"),
      modes: z.array(z.string().trim()).default([]),
      note: z.string().trim().max(2000).nullable().optional(),
    }),
  );
  const row = await luuKhoi(body);
  await ghiNhatKy(p.email, "dao_tao.khoi.luu", row.id, { kind: row.kind, lessonId: row.lesson_id });
  return c.json({ khoi: row });
});

quanTri.delete("/dao-tao/khoi/:id", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  await xoaKhoi(c.req.param("id"));
  await ghiNhatKy(p.email, "dao_tao.khoi.xoa", c.req.param("id"));
  return c.json({ ok: true });
});

quanTri.post("/dao-tao/bai/:id/sap-xep-khoi", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  const body = await parseBody(c, z.object({ thuTu: z.array(uuid).min(1) }));
  await sapXepKhoi(c.req.param("id"), body.thuTu);
  await ghiNhatKy(p.email, "dao_tao.khoi.sap_xep", c.req.param("id"), { so: body.thuTu.length });
  return c.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Hoạt động                                                           */
/* ------------------------------------------------------------------ */

quanTri.post("/dao-tao/hoat-dong", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  const body = await parseBody(
    c,
    z.object({
      id: uuid.optional(),
      courseId: uuid,
      lessonId: uuid.nullable().optional(),
      ordinal: z.number().int().min(0).max(500).default(0),
      kind: z.string().trim().min(1),
      mode: z.enum(["may", "ai", "nguoi", "tu_danh_gia"]).default("may"),
      title: z.string().trim().max(500).nullable().optional(),
      prompt: z.record(z.string(), z.unknown()),
      answer: z.record(z.string(), z.unknown()).default({}),
      rubric: z.record(z.string(), z.unknown()).default({}),
      skills: z.array(z.string().trim()).default([]),
      errorTags: z.array(z.string().trim()).default([]),
      citations: z.array(z.string().trim()).default([]),
      difficulty: z.number().min(0).max(1).default(0.5),
      points: z.number().int().min(1).max(100).default(1),
      level: z.number().int().min(0).max(3).default(1),
      source: z.enum(["nguoi", "ai", "ai_da_sua"]).default("nguoi"),
    }),
  );
  // Bài chấm bằng AI hoặc người bắt buộc có rubric hợp lệ; không có thì chấm bằng cảm tính.
  if (body.mode === "ai" || body.mode === "nguoi") {
    const loi = kiemTraRubric(body.rubric);
    if (loi.length) throw badRequest("Rubric chưa hợp lệ", loi);
  }
  const row = await luuHoatDong(body);
  await ghiNhatKy(p.email, "dao_tao.hoat_dong.luu", row.id, { kind: row.kind });
  return c.json({ hoatDong: row });
});

quanTri.post("/dao-tao/hoat-dong/:id/go", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  const body = await parseBody(c, z.object({ go: z.boolean().default(true) }));
  await goHoatDong(c.req.param("id"), body.go);
  await ghiNhatKy(
    p.email,
    body.go ? "dao_tao.hoat_dong.go" : "dao_tao.hoat_dong.dung_lai",
    c.req.param("id"),
  );
  return c.json({ ok: true });
});

/** GET /v1/quan-tri/dao-tao/chuyen-de/:id/ngan-hang — chỉ số từng câu hỏi (09-c §4.4). */
quanTri.get("/dao-tao/chuyen-de/:id/ngan-hang", async (c) => {
  await batBuocVaiTro(c, "quan_ly");
  const luot = await luotLamCuaChuyenDe(c.req.param("id"));
  const chiSo = chiSoCauHoi(
    luot.map((l) => ({
      activityId: l.activity_id,
      enrollmentId: l.enrollment_id,
      attemptNo: l.attempt_no,
      score: Number(l.score),
      maxScore: Number(l.max_score),
      passed: l.passed,
      secondsSpent: l.seconds_spent,
      errorTags: l.error_tags,
    })),
  );
  return c.json({ chiSo });
});

/* ------------------------------------------------------------------ */
/* Soạn bài bằng AI                                                    */
/* ------------------------------------------------------------------ */

const BUOC_SOAN = [
  "ban_do_phap_ly",
  "dan_y",
  "soan_bai",
  "sinh_bai_tap",
  "sinh_rubric",
  "kiem_can_cu",
  "soat_loi",
] as const;

quanTri.get("/dao-tao/soan-bai", async (c) => {
  await batBuocVaiTro(c, "quan_ly");
  const p = parseQuery(c, z.object({ chuyenDe: uuid.optional(), state: z.string().trim().optional() }));
  const rows = await danhSachViecSoanBai({
    ...(p.chuyenDe ? { courseId: p.chuyenDe } : {}),
    ...(p.state ? { state: p.state } : {}),
  });
  return c.json({ items: rows });
});

/**
 * POST /v1/quan-tri/dao-tao/soan-bai — tạo việc soạn bài.
 * Chỉ TẠO việc; worker `qdpl-soan-bai` chạy. Tạo lô lớn tốn tiền nên cần vai trò Admin quản trị hệ thống
 * khi vượt trần chi phí mặc định.
 */
quanTri.post("/dao-tao/soan-bai", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  const body = await parseBody(
    c,
    z.object({
      courseId: uuid.nullable().optional(),
      lessonId: uuid.nullable().optional(),
      step: z.enum(BUOC_SOAN),
      input: z.record(z.string(), z.unknown()).default({}),
      budgetUsd: z.number().min(0).max(1000).nullable().optional(),
      batch: z.boolean().default(true),
    }),
  );
  if ((body.budgetUsd ?? 0) > 20 && !atLeast(p.role, "quan_tri")) {
    throw new KhongDuQuyen("quan_tri");
  }
  const row = await taoViecSoanBai({ ...body, requestedBy: p.email });
  await ghiNhatKy(p.email, "dao_tao.soan_bai.tao", row.id, { step: row.step });

  // Đẩy vào hàng đợi nếu Redis sẵn sàng; không nối được thì việc vẫn nằm ở trạng thái `cho`
  // và người vận hành chạy tay được — không im lặng đánh mất việc.
  return c.json({ viec: row, daDayHangDoi: await dayViecSoanBai(row.id) });
});

/**
 * POST /v1/quan-tri/dao-tao/soan-bai/:id/nhan?cheDo=noi|thay — nhận kết quả AI vào bản nháp.
 *
 * Bước `soan_bai` ghi khối nội dung, `sinh_bai_tap`/`sinh_rubric` ghi bài tập vào bài của việc;
 * `cheDo=thay` bỏ phần AI soạn trước đó của bài. Chỉ phần đã qua hậu kiểm được ghi. Nhận vào
 * nháp không phải duyệt: bài vẫn phải qua duyệt mới tới người học.
 */
quanTri.post("/dao-tao/soan-bai/:id/nhan", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  const id = uuid.safeParse(c.req.param("id"));
  if (!id.success) throw notFound("Không tìm thấy việc soạn bài");
  const q = parseQuery(c, z.object({ cheDo: z.enum(["noi", "thay"]).default("noi") }));

  const kq = await nhanKetQuaSoanBai(id.data, p.email, q.cheDo);
  if (!kq.ok) {
    if (kq.lyDo === "khong_co") throw notFound(kq.thongDiep);
    if (kq.lyDo === "da_nhan" || kq.lyDo === "bai_khong_nhan") throw conflict(kq.thongDiep);
    throw badRequest(kq.thongDiep);
  }
  await ghiNhatKy(p.email, "dao_tao.soan_bai.nhan", id.data, {
    buoc: kq.buoc,
    che_do: q.cheDo,
    so_khoi: kq.soKhoi,
    so_bai_tap: kq.soBaiTap,
  });
  return c.json(kq);
});

/** Trần số điều khoản lấy từ viện dẫn của bài khi không nêu `urns`. */
const SO_URN_TOI_DA_CUA_BAI = 20;

/**
 * POST /v1/quan-tri/dao-tao/bai/:id/sinh-cau-hoi — AI sinh câu hỏi trắc nghiệm cho một bài.
 *
 * Câu vào ngân hàng chung, ở chủ đề của bài (bài chưa có thì tạo và gắn), trạng thái
 * `cho_duyet`. Được duyệt rồi thì câu hiện ở kiểm tra cuối bài, luyện tập và đề thi; chưa duyệt
 * thì không ở đâu cả. Không nêu `urns` thì dùng các điều khoản mà khối nội dung của bài viện dẫn.
 */
quanTri.post("/dao-tao/bai/:id/sinh-cau-hoi", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  const id = uuid.safeParse(c.req.param("id"));
  if (!id.success) throw notFound("Không tìm thấy bài học");
  const b = await parseBody(
    c,
    z.object({
      urns: z
        .array(
          z
            .string()
            .trim()
            .regex(/^vn:\S+$/, "Căn cứ phải là URN dạng vn:..."),
        )
        .max(SO_URN_TOI_DA_CUA_BAI)
        .optional(),
      loai: z.array(z.enum(LOAI_CAU_HOI)).min(1).max(LOAI_CAU_HOI.length).default(["mot_dap_an", "dung_sai"]),
      muc_do: z.enum(MUC_DO_CAU_HOI).nullish(),
      so_cau: z.number().int().min(1).max(20).default(6),
      as_of: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      chay_thu: z.boolean().default(false),
    }),
  );
  const bai = await baiHocTheoId(id.data);
  if (!bai) throw notFound("Không tìm thấy bài học");

  const urns = b.urns?.length
    ? b.urns
    : [...new Set((await khoiCuaBai(bai.id)).flatMap((k) => k.citations))].slice(0, SO_URN_TOI_DA_CUA_BAI);
  if (!urns.length) {
    throw badRequest("Bài chưa có khối nào viện dẫn điều khoản. Nêu điều khoản (urns) để sinh câu hỏi.");
  }
  const asOf = b.as_of ?? asDate(bai.as_of) ?? new Date().toISOString().slice(0, 10);

  const kq = await taoViecSinhCauHoi(p, {
    urns,
    layChuDe: async () => {
      const chuDe = await damBaoChuDeCuaBai(bai.id);
      if (!chuDe) throw notFound("Không tìm thấy bài học");
      return chuDe;
    },
    loai: b.loai,
    mucDo: b.muc_do ?? null,
    soCau: b.so_cau,
    asOf,
    chayThu: b.chay_thu,
    lessonId: bai.id,
    courseId: bai.course_id,
  });
  if (!kq.taoViec)
    return c.json({ chay_thu: true, as_of: asOf, uoc_tinh: kq.uocTinh, dieu_khoan: kq.dieuKhoan });
  return c.json(
    {
      viec: kq.viec,
      chu_de: { id: kq.chuDe.id, code: kq.chuDe.code, name: kq.chuDe.name },
      uoc_tinh: kq.uocTinh,
      dieu_khoan: kq.dieuKhoan,
      da_day_hang_doi: kq.daDayHangDoi,
    },
    202,
  );
});

/* ------------------------------------------------------------------ */
/* Soạn tự động cả chuyên đề từ văn bản                                */
/* ------------------------------------------------------------------ */

const urnCanCu = z
  .string()
  .trim()
  .regex(/^vn:\S+$/, "Căn cứ phải là URN dạng vn:...");

quanTri.get("/dao-tao/soan-tu-dong", async (c) => {
  await batBuocVaiTro(c, "quan_ly");
  return c.json({ items: await tienDoSoanTuDong(10), tran_chi_phi_usd: tranChiPhiSoanTuDong() });
});

/**
 * POST /v1/quan-tri/dao-tao/soan-tu-dong — soạn cả chuyên đề từ văn bản đã có trong kho.
 *
 * Chọn văn bản (hoặc điều khoản) và chuyên đề có sẵn, hoặc đặt tên chuyên đề mới. Phần việc nằm ở
 * soan-tu-dong.ts, dùng chung với luồng tạo chuyên đề từ PDF.
 *
 * `chay_thu` chỉ trả điều khoản và ước tính, không tạo chuyên đề hay việc nào.
 */
quanTri.post("/dao-tao/soan-tu-dong", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  const b = await parseBody(
    c,
    z
      .object({
        urns: z.array(urnCanCu).min(1).max(20),
        course_id: uuid.optional(),
        ten_chuyen_de: z.string().trim().min(3).max(300).optional(),
        linh_vuc_id: uuid.optional(),
        so_bai: z.number().int().min(1).max(20).default(6),
        so_cau_hoi: z.number().int().min(0).max(20).default(6),
        tu_luan: z.boolean().default(true),
        loai_cau_hoi: z
          .array(z.enum(LOAI_CAU_HOI))
          .min(1)
          .max(LOAI_CAU_HOI.length)
          .default(["mot_dap_an", "dung_sai"]),
        as_of: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        vi_du: z.string().trim().max(1000).optional(),
        batch: z.boolean().default(false),
        chay_thu: z.boolean().default(false),
      })
      .refine((x) => Boolean(x.course_id) !== Boolean(x.ten_chuyen_de), {
        message: "Chọn một chuyên đề có sẵn hoặc đặt tên chuyên đề mới (chỉ một trong hai)",
      }),
  );
  const kq = await taoLanSoanTuDong(p, b);
  if (kq.chayThu) return c.json({ chay_thu: true, ...kq.chuanBi });
  return c.json(
    {
      viec: kq.viec,
      chuyen_de: { id: kq.course.id, slug: kq.course.slug, title: kq.course.title },
      ...kq.chuanBi,
      che_do: kq.cheDo,
      da_day_hang_doi: kq.cheDo === "hang_doi",
    },
    202,
  );
});

/**
 * POST /v1/quan-tri/dao-tao/chuyen-de-tu-pdf — tạo chuyên đề thẳng từ một tệp PDF văn bản.
 *
 * Form multipart: `tep` (PDF), `linh_vuc_id`, `tu_luan` và `trac_nghiem` ("1" là có), cùng
 * `so_ky_hieu` và `loai` khi hệ thống không tự đọc được từ tệp. `tao_de_thi` = "1" (chỉ quản
 * trị viên) tạo luôn một đề thi từ cùng văn bản theo mẫu `mau_de` (15, 45 hoặc 90 phút). Hệ thống lưu văn bản vào kho (đã có
 * thì dùng lại), tạo chuyên đề mang tên văn bản và cho AI soạn bài. Chi tiết ở chuyen-de-tu-pdf.ts.
 */
quanTri.post("/dao-tao/chuyen-de-tu-pdf", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  const form = await c.req.raw.formData().catch(() => null);
  const tep = form?.get("tep");
  const bytes = await docTepPdf(tep);
  const chu = (ten: string) => String(form?.get(ten) ?? "").trim();
  const o = z
    .object({
      linh_vuc_id: uuid.optional(),
      so_ky_hieu: z.string().max(100).optional(),
      loai: z.string().max(20).optional(),
    })
    .safeParse({
      linh_vuc_id: chu("linh_vuc_id") || undefined,
      so_ky_hieu: chu("so_ky_hieu") || undefined,
      loai: chu("loai") || undefined,
    });
  if (!o.success) throw badRequest("Tùy chọn gửi kèm tệp không hợp lệ.");
  const taoDeThi = chu("tao_de_thi") === "1";
  const mauDe = chu("mau_de") || "45";
  if (taoDeThi && !atLeast(p.role, "quan_tri")) throw new KhongDuQuyen("quan_tri");
  if (taoDeThi && !laMauDe(mauDe)) throw badRequest("Mẫu cấu trúc đề không hợp lệ.");
  const kq = await taoTuPdf(p, bytes, tep instanceof File ? tep.name : "van-ban.pdf", {
    so_ky_hieu: o.data.so_ky_hieu,
    loai: o.data.loai,
    chuyen_de: {
      linh_vuc_id: o.data.linh_vuc_id,
      tu_luan: chu("tu_luan") === "1",
      so_cau_hoi: chu("trac_nghiem") === "1" ? 6 : 0,
    },
    ...(taoDeThi && laMauDe(mauDe) ? { de_thi: { mau: mauDe } } : {}),
  });
  await ghiNhatKy(p.email, "dao_tao.chuyen_de.tu_pdf", kq.chuyen_de?.id ?? "", {
    chuyen_de: kq.chuyen_de?.slug ?? null,
    de_thi: kq.de_thi?.code ?? null,
    van_ban: kq.van_ban?.urn ?? null,
    ban_quet: kq.ban_quet,
  });
  return c.json(kq, 202);
});

/** GET /v1/quan-tri/dao-tao/chuyen-de/:id/soan — tiến độ soạn tự động của một chuyên đề. */
quanTri.get("/dao-tao/chuyen-de/:id/soan", async (c) => {
  await batBuocVaiTro(c, "quan_ly");
  const id = uuid.safeParse(c.req.param("id"));
  if (!id.success || !(await chuyenDeTheoId(id.data))) throw notFound("Không tìm thấy chuyên đề");
  return c.json({ tien_do: await tienDoSoanCuaChuyenDe(id.data) });
});

/**
 * POST /v1/quan-tri/dao-tao/chuyen-de/:id/soan-tiep — chạy tiếp phần soạn còn dở hoặc bị lỗi.
 * Việc đọc bản quét lỗi vì thiếu số ký hiệu thì gửi kèm `so_ky_hieu` (và `loai`) nhập tay.
 */
quanTri.post("/dao-tao/chuyen-de/:id/soan-tiep", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  const id = uuid.safeParse(c.req.param("id"));
  if (!id.success) throw notFound("Không tìm thấy chuyên đề");
  const b = await parseBody(
    c,
    z.object({
      so_ky_hieu: z.string().trim().max(100).optional(),
      loai: z.string().trim().max(20).optional(),
    }),
  );
  const daChay = await soanTiepChuyenDe(id.data, b);
  await ghiNhatKy(p.email, "dao_tao.soan_tu_dong.chay_tiep", id.data, { da_chay: daChay });
  return c.json({ da_chay: daChay });
});

/* ------------------------------------------------------------------ */
/* Chấm lại                                                            */
/* ------------------------------------------------------------------ */

quanTri.get("/dao-tao/cham-lai", async (c) => {
  await batBuocVaiTro(c, "quan_ly");
  return c.json({ items: await hangDoiChamLai() });
});

/**
 * POST /v1/quan-tri/dao-tao/cham-lai/:id — giảng viên chấm một lượt tự luận trong bài học theo
 * rubric: điểm thô từng tiêu chí kèm nhận xét. Điểm của giảng viên là điểm cuối cùng.
 */
quanTri.post("/dao-tao/cham-lai/:id", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  const id = z.string().uuid().safeParse(c.req.param("id"));
  if (!id.success) throw notFound("Không tìm thấy lượt làm bài");
  const body = await parseBody(
    c,
    z.object({
      diem: z.record(z.string(), z.number().min(0).max(100)),
      nhan_xet: z.string().trim().max(2000).nullish(),
    }),
  );
  const row = await chamLai(id.data, body.diem, body.nhan_xet ?? null, p.email).catch((e) => {
    if (e instanceof LoiNghiepVu) throw badRequest(e.message);
    throw e;
  });
  if (!row) throw notFound("Không tìm thấy lượt làm bài");
  await ghiNhatKy(p.email, "dao_tao.cham_lai", row.id, {
    diemAi: Number(row.score),
    diemNguoi: Number(row.reviewer_score),
  });
  return c.json({ luot: row });
});

/* ------------------------------------------------------------------ */
/* Thống kê                                                            */
/* ------------------------------------------------------------------ */

quanTri.get("/dao-tao/chuyen-de/:id/thong-ke", async (c) => {
  await batBuocVaiTro(c, "quan_ly");
  const id = c.req.param("id");
  const [pheu, luot, chamLaiRows] = await Promise.all([
    pheuCuaChuyenDe(id),
    luotLamCuaChuyenDe(id),
    hangDoiChamLai(500),
  ]);
  const daDoiChieu = (chamLaiRows as Array<Record<string, unknown>>)
    .filter((r) => r.reviewer_score !== null && r.reviewer_score !== undefined)
    .map((r) => ({ ai: Number(r.score), nguoi: Number(r.reviewer_score), max: Number(r.max_score) }));
  return c.json({
    pheu: pheuHoanThanh(pheu),
    chiSoCauHoi: chiSoCauHoi(
      luot.map((l) => ({
        activityId: l.activity_id,
        enrollmentId: l.enrollment_id,
        attemptNo: l.attempt_no,
        score: Number(l.score),
        maxScore: Number(l.max_score),
        passed: l.passed,
        secondsSpent: l.seconds_spent,
        errorTags: l.error_tags,
      })),
    ),
    lechCham: lechCham(daDoiChieu),
  });
});

/* ------------------------------------------------------------------ */
/* Chứng nhận                                                          */
/* ------------------------------------------------------------------ */

quanTri.post("/dao-tao/ghi-danh/:id/chung-nhan", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  const body = await parseBody(
    c,
    z.object({
      score: z.number().min(0).max(100),
      asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      legalBasis: z.array(z.string().trim()).default([]),
    }),
  );
  const row = await capChungNhan({ enrollmentId: c.req.param("id"), ...body, issuedBy: p.email });
  await ghiNhatKy(p.email, "dao_tao.chung_nhan.cap", c.req.param("id"));
  return c.json({ chungNhan: row });
});

quanTri.post("/dao-tao/chung-nhan/:id/thu-hoi", async (c) => {
  const p = await batBuocVaiTro(c, "quan_tri");
  const body = await parseBody(c, z.object({ lyDo: z.string().trim().min(5).max(2000) }));
  const row = await thuHoiChungNhan(c.req.param("id"), p.email, body.lyDo);
  if (!row) throw notFound("Không tìm thấy chứng nhận");
  await ghiNhatKy(p.email, "dao_tao.chung_nhan.thu_hoi", c.req.param("id"), { lyDo: body.lyDo });
  return c.json({ chungNhan: row });
});

quanTri.get("/dao-tao/ghi-danh/:id/chung-nhan", async (c) => {
  await batBuocVaiTro(c, "quan_ly");
  return c.json({ items: await chungNhanCuaGhiDanh(c.req.param("id")) });
});

/* ------------------------------------------------------------------ */
/* Mascot — nhân vật và định tuyến (09-c §6.1)                         */
/* ------------------------------------------------------------------ */

quanTri.get("/mascot/nhan-vat", async (c) => {
  await batBuocVaiTro(c, "quan_ly");
  const [rows, chuyenDe, banGiao, caiDat] = await Promise.all([
    danhSachNhanVat(false),
    danhSachChuyenDe({ chiXuatBan: false, limit: 200 }),
    danhSachBanGiao(),
    caiDatMascot(),
  ]);
  const nhanVat: NhanVat[] = rows.map(toNhanVat);
  return c.json({
    items: nhanVat.map((nv) => ({
      ...nv,
      svg: veMascot({ persona: nv, state: "binh_thuong", costume: chonTrangPhuc(nv) }),
      dungBoiChuyenDe: chuyenDe.filter((cd) => cd.mascot_id === nv.id).map((cd) => cd.slug),
    })),
    // Bảng "chuyên đề nào đang hiện nhân vật nào và VÌ SAO".
    dinhTuyen: bangDinhTuyen(
      chuyenDe.map((cd) => ({
        id: cd.id,
        title: cd.title,
        audiences: cd.audience,
        topics: [...cd.tags, ...cd.taxonomy_codes],
        mascotId: cd.mascot_id,
        mascotLocked: cd.mascot_locked,
      })),
      nhanVat,
    ),
    banGiao,
    caiDat,
  });
});

const nhanVatSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]+$/, "Mã chỉ gồm chữ thường, số và dấu gạch dưới"),
  fullName: z.string().trim().min(2).max(100),
  nickName: z.string().trim().min(2).max(100),
  roleLine: z.string().trim().min(3).max(200),
  bio: z.string().trim().max(2000).nullable().optional(),
  audiences: z.array(z.string().trim()).default([]),
  topics: z.array(z.string().trim()).default([]),
  voice: z.record(z.string(), z.unknown()).default({}),
  palette: z.record(z.string(), z.string()).default({}),
  body: z.string().trim().default("thuoc"),
  headGear: z.string().trim().nullable().optional(),
  defaultProp: z.string().trim().default("khong"),
  allowedCostumes: z.array(z.enum(TRANG_PHUC)).default([]),
  characterSheet: z.string().trim().max(4000).default(""),
  enabled: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  ordinal: z.number().int().min(0).max(999).default(0),
});

quanTri.post("/mascot/nhan-vat", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  const body = await parseBody(c, nhanVatSchema);
  const row = await luuNhanVat(body);
  await ghiNhatKy(p.email, "mascot.nhan_vat.luu", row.id, { code: row.code });
  return c.json({ nhanVat: toNhanVat(row) });
});

quanTri.post("/mascot/nhan-vat/:id/bat-tat", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  const body = await parseBody(c, z.object({ bat: z.boolean() }));
  const row = await batTatNhanVat(c.req.param("id"), body.bat);
  if (!row) throw notFound("Không tìm thấy nhân vật");
  await ghiNhatKy(p.email, body.bat ? "mascot.nhan_vat.bat" : "mascot.nhan_vat.tat", row.id);
  return c.json({ nhanVat: toNhanVat(row) });
});

/** GET /v1/quan-tri/mascot/nhan-vat/:id/bang-bieu-cam — lưới 12 trạng thái × trang phục. */
quanTri.get("/mascot/nhan-vat/:id/bang-bieu-cam", async (c) => {
  await batBuocVaiTro(c, "quan_ly");
  const row = await nhanVatTheoId(c.req.param("id"));
  if (!row) throw notFound("Không tìm thấy nhân vật");
  const p = parseQuery(c, z.object({ trangPhuc: z.enum(TRANG_PHUC).optional() }));
  const nv = toNhanVat(row);
  const costume = chonTrangPhuc(nv, p.trangPhuc ?? null);
  return c.json({
    code: nv.code,
    trangPhuc: costume,
    trangPhucChoPhep: nv.allowedCostumes,
    o: TRANG_THAI.map((tt) => ({
      trangThai: tt,
      svg: veMascot({ persona: nv, state: tt, costume, tinh: true }),
    })),
  });
});

quanTri.post("/mascot/ban-giao", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  const body = await parseBody(
    c,
    z.object({
      context: z.string().trim().min(1).max(100),
      personaId: uuid,
      note: z.string().trim().max(1000).nullable().optional(),
      enabled: z.boolean().default(true),
    }),
  );
  const row = await luuBanGiao(body.context, body.personaId, body.note, body.enabled);
  await ghiNhatKy(p.email, "mascot.ban_giao.luu", row.id, { context: row.context });
  return c.json({ banGiao: row });
});

/* ------------------------------------------------------------------ */
/* Mascot — hành động (09-c §6.2)                                      */
/* ------------------------------------------------------------------ */

quanTri.get("/mascot/hanh-dong", async (c) => {
  await batBuocVaiTro(c, "quan_ly");
  const [rows, soLieu] = await Promise.all([danhSachHanhDong(), soLieuHanhDong()]);
  const theoId = new Map(soLieu.map((s) => [s.action_id, s]));
  return c.json({
    items: rows.map((r) => {
      const sl = theoId.get(r.id) ?? { hien: 0, bam_cta: 0, dong: 0, tat_mascot: 0 };
      return {
        ...r,
        soLieu: danhGiaHanhDong({
          hien: sl.hien,
          bamCta: sl.bam_cta,
          dong: sl.dong,
          tatMascot: sl.tat_mascot,
        }),
        luotHien: sl.hien,
      };
    }),
  });
});

quanTri.post("/mascot/hanh-dong", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  const body = await parseBody(
    c,
    z.object({
      code: z
        .string()
        .trim()
        .regex(/^[a-z0-9_]+$/),
      personaId: uuid.nullable().optional(),
      trigger: z.string().trim().min(1),
      conditions: z.array(z.record(z.string(), z.unknown())).default([]),
      priority: z.number().int().min(0).max(100).default(50),
      cooldownSeconds: z.number().int().min(0).max(604_800).default(180),
      maxPerSession: z.number().int().min(1).max(99).default(3),
      maxPerDay: z.number().int().min(1).max(99).default(10),
      anchor: z.string().trim().default("goc_phai_duoi"),
      state: z.string().trim().default("binh_thuong"),
      pose: z.string().trim().default("dung"),
      costume: z.string().trim().nullable().optional(),
      prop: z.string().trim().nullable().optional(),
      effect: z.string().trim().default("khong"),
      speech: z
        .array(
          z.object({
            text: z.string().trim().min(1).max(140),
            tone: z.string().trim().optional(),
            loai: z.enum(["loi_dan", "loi_phap_ly"]).default("loi_dan"),
            citations: z.array(z.string().trim()).default([]),
          }),
        )
        .min(1),
      cta: z.record(z.string(), z.unknown()).nullable().optional(),
      audiences: z.array(z.string().trim()).default([]),
      courseIds: z.array(uuid).default([]),
      enabled: z.boolean().default(true),
    }),
  );

  // Kiểm ở tầng máy chủ: lời pháp lý không có viện dẫn thì không được lưu, dù giao diện
  // có cho bấm hay không.
  const loi = kiemTraHanhDong({
    speech: body.speech,
    cta: (body.cta as never) ?? null,
    priority: body.priority,
    cooldownSeconds: body.cooldownSeconds,
  });
  if (loi.length) throw badRequest("Hành động chưa hợp lệ", loi);

  const row = await luuHanhDong(body);
  await ghiNhatKy(p.email, "mascot.hanh_dong.luu", row.id, { code: row.code });
  return c.json({ hanhDong: row });
});

quanTri.post("/mascot/hanh-dong/:id/bat-tat", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  const body = await parseBody(
    c,
    z.object({ bat: z.boolean(), lyDo: z.string().trim().max(500).optional() }),
  );
  const row = await batTatHanhDong(c.req.param("id"), body.bat, body.lyDo ?? null);
  if (!row) throw notFound("Không tìm thấy hành động");
  await ghiNhatKy(p.email, body.bat ? "mascot.hanh_dong.bat" : "mascot.hanh_dong.tat", row.id, {
    lyDo: body.lyDo ?? null,
  });
  return c.json({ hanhDong: row });
});

quanTri.delete("/mascot/hanh-dong/:id", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  await xoaHanhDong(c.req.param("id"));
  await ghiNhatKy(p.email, "mascot.hanh_dong.xoa", c.req.param("id"));
  return c.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Mascot — ảnh (09-c §6.3)                                            */
/* ------------------------------------------------------------------ */

quanTri.get("/mascot/anh", async (c) => {
  await batBuocVaiTro(c, "quan_ly");
  const p = parseQuery(
    c,
    z.object({
      nhanVat: uuid.optional(),
      loai: z.string().trim().optional(),
      tinhTrang: z.string().trim().optional(),
    }),
  );
  const [anh, lo] = await Promise.all([
    danhSachAnh({
      ...(p.nhanVat ? { personaId: p.nhanVat } : {}),
      ...(p.loai ? { kind: p.loai } : {}),
      ...(p.tinhTrang ? { status: p.tinhTrang } : {}),
    }),
    danhSachLoSinhAnh(),
  ]);
  return c.json({ items: anh, lo });
});

const LOAI_ANH = [
  "avatar",
  "chan_dung",
  "toan_than",
  "sticker",
  "bang_bieu_cam",
  "anh_bia",
  "khung_hoat_hoa",
  "anh_in",
] as const;

/**
 * POST /v1/quan-tri/mascot/anh/lo — tạo lô sinh ảnh theo tổ hợp.
 * Tốn tiền thật nên cần vai trò Admin quản lý (09-c §7).
 */
quanTri.post("/mascot/anh/lo", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  const body = await parseBody(
    c,
    z.object({
      personaId: uuid,
      kind: z.enum(LOAI_ANH),
      states: z.array(z.enum(TRANG_THAI)).min(1),
      costumes: z.array(z.enum(TRANG_PHUC)).min(1),
      poses: z.array(z.string().trim()).default(["dung"]),
      props: z.array(z.string().trim()).default([]),
      effects: z.array(z.string().trim()).default(["khong"]),
      soAnhMoiToHop: z.number().int().min(1).max(8).default(1),
      model: z.string().trim().optional(),
      seed: z.string().trim().optional(),
      budgetUsd: z.number().min(0).max(500).nullable().optional(),
    }),
  );

  const row = await nhanVatTheoId(body.personaId);
  if (!row) throw notFound("Không tìm thấy nhân vật");
  const nv = toNhanVat(row);

  // Ghép sai bị chặn ở đây, không chỉ ở giao diện: Rùa Đá không mặc áo bảo hộ công trường.
  const sai = body.costumes.filter((tp) => !nv.allowedCostumes.includes(tp));
  if (sai.length) {
    throw badRequest(`Nhân vật ${nv.fullName} không mặc được trang phục: ${sai.join(", ")}`);
  }

  const total = body.states.length * body.costumes.length * body.poses.length * body.soAnhMoiToHop;
  const lo = await taoLoSinhAnh({
    personaId: body.personaId,
    spec: body,
    total,
    model: body.model ?? null,
    budgetUsd: body.budgetUsd ?? null,
    requestedBy: p.email,
  });
  await ghiNhatKy(p.email, "mascot.anh.tao_lo", lo.id, { total, kind: body.kind });

  let daDay = false;
  try {
    const { add, QUEUES } = await import("@qdpl/queue");
    await add(QUEUES.mascotAnh, { jobId: lo.id }, { key: lo.id });
    daDay = true;
  } catch {
    daDay = false;
  }
  return c.json({ lo, total, daDayHangDoi: daDay });
});

quanTri.post("/mascot/anh/:id/tinh-trang", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  const body = await parseBody(
    c,
    z.object({
      tinhTrang: z.enum(["nhap", "cho_duyet", "duyet", "dung_chinh", "tu_choi", "go_bo"]),
      lyDo: z.string().trim().max(1000).optional(),
    }),
  );
  if (body.tinhTrang === "tu_choi" && !body.lyDo) throw badRequest("Từ chối ảnh phải nêu lý do");
  const row = await datTinhTrangAnh(c.req.param("id"), body.tinhTrang, p.email, body.lyDo ?? null);
  if (!row) throw notFound("Không tìm thấy ảnh");
  await ghiNhatKy(p.email, `mascot.anh.${body.tinhTrang}`, row.id, { lyDo: body.lyDo ?? null });
  return c.json({ anh: row });
});

quanTri.post("/mascot/anh/lo/:id/huy", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  const row = await capNhatLoSinhAnh(c.req.param("id"), { state: "huy" });
  await ghiNhatKy(p.email, "mascot.anh.huy_lo", c.req.param("id"));
  return c.json({ lo: row });
});

/* ------------------------------------------------------------------ */
/* Mascot — tương tác và cài đặt (09-c §6.4)                           */
/* ------------------------------------------------------------------ */

quanTri.get("/mascot/tuong-tac", async (c) => {
  await batBuocVaiTro(c, "quan_ly");
  const p = parseQuery(c, z.object({ chuyenDe: uuid.optional() }));
  const [soLieu, hieuQua, caiDat, hanhDong] = await Promise.all([
    soLieuHanhDong(),
    hieuQuaMascot(p.chuyenDe),
    caiDatMascot(),
    danhSachHanhDong(),
  ]);

  // Lệnh nào đang được bao nhiêu hành động dùng.
  const dungLenh = new Map<string, number>();
  for (const hd of hanhDong) {
    const lenh = (hd.cta as { lenh?: string } | null)?.lenh;
    if (lenh) dungLenh.set(lenh, (dungLenh.get(lenh) ?? 0) + 1);
  }

  return c.json({
    soLieu: soLieu.map((s) => ({
      code: s.code,
      trigger: s.trigger,
      luotHien: s.hien,
      ...danhGiaHanhDong({ hien: s.hien, bamCta: s.bam_cta, dong: s.dong, tatMascot: s.tat_mascot }),
    })),
    hieuQua,
    // Câu kết luận thẳng thắn mà tài liệu yêu cầu hiển thị (09-b §9).
    ketLuan: !hieuQua.duDuLieu
      ? "Chưa đủ dữ liệu để kết luận mascot có giúp người học hay không."
      : hieuQua.chenhLech > 0
        ? `Nhóm bật mascot hoàn thành bài cao hơn ${(hieuQua.chenhLech * 100).toFixed(1)} điểm phần trăm.`
        : "Mascot hiện không giúp người học hoàn thành bài tốt hơn — cần xem lại kịch bản.",
    lenh: [...dungLenh.entries()].map(([lenh, so]) => ({ lenh, so })),
    caiDat,
  });
});

quanTri.put("/mascot/cai-dat", async (c) => {
  const p = await batBuocVaiTro(c, "quan_tri");
  const body = await parseBody(
    c,
    z.object({
      enabled: z.boolean().default(true),
      default_level: z.enum(["day_du", "it", "yen_lang", "tat"]).default("day_du"),
      max_per_session: z.number().int().min(1).max(50).default(8),
      min_gap_seconds: z.number().int().min(0).max(3600).default(180),
      motion: z.boolean().default(true),
      sound: z.boolean().default(false),
    }),
  );
  const row = await luuCaiDatMascot({ ...body, updatedBy: p.email });
  await ghiNhatKy(p.email, "mascot.cai_dat.luu", null, body);
  return c.json({ caiDat: row });
});
