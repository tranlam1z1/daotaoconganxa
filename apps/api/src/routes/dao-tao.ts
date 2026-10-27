import { maNhomHocTapSchema } from "../nhom-hoc-tap.ts";
/**
 * API cho người học (ke-hoach/09-a).
 *
 * Ranh giới quan trọng nhất của tệp này: **đáp án và rubric không bao giờ đi ra**. Trình
 * đọc bài học nhận `prompt` của hoạt động; việc chấm chạy ở endpoint `nop-bai` phía máy chủ.
 * Nếu một ngày nào đó tiện tay trả cả `answer` cho client "để chấm nhanh hơn", toàn bộ ngân
 * hàng câu hỏi mất giá trị trong một buổi chiều.
 */

import {
  buocKeTiep,
  type CheDoHoc,
  capNhatThanhThao,
  chamBaiTap,
  DO_DAI_BAI_VIET,
  type HoatDong,
  type KhoiNoiDung,
  laRubric,
  locTheoCheDo,
  mucThanhThao,
  nhomHocTapHienHanh,
  onThe,
  phanTramBai,
  SO_CAU_KIEM_TRA_CUOI_BAI,
  SO_LAN_NOP_AI_MOI_NGAY,
  thamSoCho,
  tomTatTienDo,
} from "@qdpl/dao-tao";
import {
  baiHocCuaChuyenDe,
  baiHocTheoSlug,
  capNhatGhiDanh,
  capNhatTheOn,
  chuDeCuaBaiHoc,
  chuGhiDanh,
  chuTheOn,
  chuyenDeDaHoanThanh,
  chuyenDeLienQuan,
  chuyenDeTheoSlug,
  danhSachChuyenDe,
  danhSachLinhVuc,
  danhSachMaLoi,
  deNghiPhucKhao,
  ghiDanh,
  ghiDanhCuaNguoiHoc,
  ghiDanhTheoId,
  ghiLuotLam,
  ghiSuKienHoc,
  ghiTienDo,
  hoanThanhBaiHoc,
  hoatDongCongKhai,
  hoatDongCuaBai,
  hoatDongTheoId,
  khoiCuaBai,
  kyNangCuaChuyenDe,
  type LuotGanNhat,
  luotGanNhatTheoHoatDong,
  luuThanhThao,
  maLoiLapLai,
  maLoiTheoCode,
  nguyenLieuBaiVa,
  type ProgressRow,
  phutHocTheoTuan,
  sanPhamDaNop,
  soBaiXongTheoChuyenDe,
  soKhoiTheoBai,
  soLuotAiChamTrongNgay,
  taoTheOn,
  thanhThaoCuaGhiDanh,
  theOnCuaGhiDanh,
  theOnDenHan,
  theOnTheoId,
  tienDoCuaGhiDanh,
} from "@qdpl/db";
import { Hono } from "hono";
import { z } from "zod";
import { batBuocDangNhap, danhTinh, NgoaiPhamVi } from "../auth.ts";
import { chamTuLuanBangAi } from "../cham-tu-luan-ai.ts";
import { asDate, badRequest, conflict, notFound, parseBody, parseQuery, today } from "../http.ts";

export const daoTao = new Hono();

const locNhomHocTapSchema = z.union([z.enum(["cua_toi", "tat_ca"]), maNhomHocTapSchema]).default("tat_ca");

/** Bộ lọc danh mục; không dùng làm quyết định cấp quyền đọc bài. */
async function nhomLoc(c: Parameters<typeof danhTinh>[0]): Promise<string[] | undefined> {
  const { nhom } = parseQuery(c, z.object({ nhom: locNhomHocTapSchema }));
  if (nhom === "tat_ca") return undefined;
  if (nhom === "cua_toi") return nhomHocTapHienHanh((await batBuocDangNhap(c)).nhomDoiTuong ?? []);
  return [nhom];
}

/**
 * Chặn đọc, ghi dữ liệu học tập của người khác (docs/PLAN.md GĐ0 S3). Không có bản ghi thì 404;
 * có nhưng thuộc tài khoản khác thì 403. Id lấy từ URL hay từ body đều phải qua đây.
 */
async function batBuocChuGhiDanh(id: string, accountId: string | undefined): Promise<void> {
  const chu = await chuGhiDanh(id);
  if (!chu) throw notFound("Không tìm thấy ghi danh");
  if (chu !== accountId) throw new NgoaiPhamVi("Ghi danh này không thuộc tài khoản đang đăng nhập.");
}

async function batBuocChuTheOn(id: string, accountId: string | undefined): Promise<void> {
  const chu = await chuTheOn(id);
  if (!chu) throw notFound("Không tìm thấy thẻ ôn");
  if (chu !== accountId) throw new NgoaiPhamVi("Thẻ ôn này không thuộc tài khoản đang đăng nhập.");
}

const cheDoSchema = z.enum(["day_du", "nhanh", "tra_cuu", "on_thi"]);

/* ------------------------------------------------------------------ */
/* Cây lĩnh vực đào tạo                                                */
/* ------------------------------------------------------------------ */

/**
 * Trạng thái được hiện trong danh mục công khai.
 *
 * Chuyên đề đang biên soạn vẫn hiện tên, vì người học cần thấy trọn lộ trình của lĩnh vực
 * trước khi quyết định bắt đầu từ đâu. Nội dung bài thì không ra: chỉ chuyên đề `xuat_ban`
 * mới mở được. Bản nháp chưa dựng xong và bản lưu trữ không hiện.
 */
const TRANG_THAI_HIEN_DANH_MUC = new Set(["xuat_ban", "bien_tap", "cho_phap_che", "can_cap_nhat"]);

/**
 * GET /v1/dao-tao/linh-vuc — cây lĩnh vực → nhóm đối tượng → chuyên đề.
 *
 * Có đăng nhập thì mỗi chuyên đề kèm `phanTram` (tỷ lệ bài đã xuất bản đã xong, cùng công thức
 * với `tomTatTienDo`); chưa đăng nhập hoặc chưa ghi danh chuyên đề đó thì `phanTram` là null.
 * `daHoanThanh` (có đăng nhập): xong mọi bài và đạt kiểm tra cuối bài, xem `chuyenDeDaHoanThanh`;
 * chưa đăng nhập thì null.
 */
daoTao.get("/linh-vuc", async (c) => {
  const principal = await danhTinh(c);
  const nhomHocTap = await nhomLoc(c);
  const [linhVuc, chuyenDe, xongTheoChuyenDe, hoanThanh] = await Promise.all([
    danhSachLinhVuc({ boTrangThai: ["nhap", "ai_soan", "luu_tru"] }),
    danhSachChuyenDe({ chiXuatBan: false, demBaiXuatBan: true, limit: 500, nhomHocTap }),
    principal?.accountId ? soBaiXongTheoChuyenDe(principal.accountId) : new Map<string, number>(),
    principal?.accountId ? chuyenDeDaHoanThanh(principal.accountId) : null,
  ]);
  const phanTram = (r: (typeof chuyenDe)[number]) => {
    const xong = xongTheoChuyenDe.get(r.id);
    if (xong === undefined) return null;
    return r.lesson_count ? Math.round((xong / r.lesson_count) * 100) : 0;
  };

  const hien = chuyenDe.filter((r) => TRANG_THAI_HIEN_DANH_MUC.has(r.status) && r.nhom_hoc_tap.length > 0);
  const slugTheoId = new Map(hien.map((r) => [r.id, r.slug]));

  /** Bậc trong cây: chuyên đề cụ thể hoá nằm dưới chuyên đề cha, tối đa 5 bậc để chặn dữ liệu vòng. */
  const capDo = (r: (typeof hien)[number]) => {
    let cap = 0;
    let cha = r.parent_id;
    const daQua = new Set<string>([r.id]);
    while (cha && !daQua.has(cha) && cap < 5) {
      daQua.add(cha);
      cap++;
      cha = hien.find((x) => x.id === cha)?.parent_id ?? null;
    }
    return cap;
  };

  return c.json({
    items: [
      ...linhVuc,
      // Biểu mẫu chuyên đề không còn yêu cầu lĩnh vực; vẫn hiển thị chuyên đề chưa gắn.
      ...(hien.some((r) => r.field_id === null)
        ? [
            {
              id: null,
              slug: "chuyen-de-khac",
              name: "Chuyên đề",
              summary: null,
              audience_note: null,
              status: "xuat_ban",
            },
          ]
        : []),
    ].map((lv) => {
      const cua = hien.filter((r) => r.field_id === lv.id);
      const nhom = (["khach_hang", "tu_van"] as const)
        .map((ma) => ({
          nhom: ma,
          chuyenDe: cua
            .filter((r) => r.audience_group === ma)
            .map((r) => ({
              slug: r.slug,
              title: r.title,
              summary: r.summary,
              nhomHocTap: r.nhom_hoc_tap,
              level: r.level,
              lessonCount: r.lesson_count,
              durationMinutes: r.lesson_minutes || null,
              asOf: asDate(r.as_of) ?? "",
              citationHealth: r.citation_health,
              daXuatBan: r.status === "xuat_ban",
              phanTram: phanTram(r),
              daHoanThanh: hoanThanh ? hoanThanh.has(r.id) : null,
              capDo: capDo(r),
              cha: r.parent_id ? (slugTheoId.get(r.parent_id) ?? null) : null,
              noiTiepTu: r.follows_id ? (slugTheoId.get(r.follows_id) ?? null) : null,
            })),
        }))
        .filter((n) => n.chuyenDe.length > 0);

      return {
        slug: lv.slug,
        name: lv.name,
        summary: lv.summary,
        doiTuongChinh: lv.audience_note,
        daXuatBan: lv.status === "xuat_ban",
        nhom,
      };
    }),
  });
});

/* ------------------------------------------------------------------ */
/* Danh mục chuyên đề                                                  */
/* ------------------------------------------------------------------ */

/** GET /v1/dao-tao/chuyen-de — danh sách chuyên đề đã xuất bản. */
daoTao.get("/chuyen-de", async (c) => {
  const p = parseQuery(
    c,
    z.object({
      doiTuong: z.string().trim().optional(),
      q: z.string().trim().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    }),
  );
  const nhomHocTap = await nhomLoc(c);
  const rows = await danhSachChuyenDe({
    nhomHocTap,
    chiXuatBan: true,
    ...(p.doiTuong ? { doiTuong: p.doiTuong } : {}),
    ...(p.q ? { tuKhoa: p.q } : {}),
    limit: p.limit,
  });
  return c.json({
    items: rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      level: r.level,
      audience: r.audience,
      nhomHocTap: r.nhom_hoc_tap,
      tags: r.tags,
      lessonCount: r.lesson_count,
      // Thời lượng của đúng số bài đang mở được, không phải thời lượng của cả lộ trình dự kiến.
      durationMinutes: r.lesson_minutes || r.duration_minutes,
      asOf: asDate(r.as_of) ?? "",
      citationHealth: r.citation_health,
      linhVuc: r.field_slug ? { slug: r.field_slug, name: r.field_name ?? r.field_slug } : null,
      nhomDoiTuong: r.audience_group,
    })),
  });
});

/** Phần trăm đã học của một bài; công thức ở `phanTramBai` của @qdpl/dao-tao (dùng chung với nhóm học cùng). */
function phanTramCuaBai(t: ProgressRow | undefined, soKhoi: number): number {
  return phanTramBai(t?.state, t?.last_block_ordinal ?? 0, soKhoi);
}

function tomTatLienQuan(r: { slug: string; title: string; status: string } | undefined) {
  if (!r || !TRANG_THAI_HIEN_DANH_MUC.has(r.status)) return null;
  return { slug: r.slug, title: r.title, daXuatBan: r.status === "xuat_ban" };
}

/** GET /v1/dao-tao/chuyen-de/:slug — chi tiết chuyên đề, lộ trình và tiến độ của người học. */
daoTao.get("/chuyen-de/:slug", async (c) => {
  const course = await chuyenDeTheoSlug(c.req.param("slug"));
  if (course?.status !== "xuat_ban" || !course.nhom_hoc_tap.length)
    throw notFound("Không tìm thấy chuyên đề");

  const [bai, kyNang, lienQuan] = await Promise.all([
    baiHocCuaChuyenDe(course.id, true),
    kyNangCuaChuyenDe(course.id),
    chuyenDeLienQuan(course),
  ]);

  const principal = await danhTinh(c);
  const enrollment = principal?.accountId
    ? await ghiDanhCuaNguoiHoc(principal.accountId, course.id)
    : undefined;

  let tienDo: ProgressRow[] = [];
  let soKhoi = new Map<string, number>();
  let tomTat: ReturnType<typeof tomTatTienDo> | null = null;
  let buoc: ReturnType<typeof buocKeTiep> | null = null;
  let banDoNangLuc: Array<{ code: string; name: string; muc: string; pKnown: number }> = [];

  if (enrollment) {
    const [td, sk, thanhThao, theOn, maLoi] = await Promise.all([
      tienDoCuaGhiDanh(enrollment.id),
      soKhoiTheoBai(course.id),
      thanhThaoCuaGhiDanh(enrollment.id),
      theOnCuaGhiDanh(enrollment.id),
      maLoiLapLai(enrollment.id),
    ]);
    tienDo = td;
    soKhoi = sk;

    const mapThanhThao = new Map(
      thanhThao.map((m) => [
        m.skill_id,
        { pKnown: Number(m.p_known), attempts: m.attempts, correct: m.correct },
      ]),
    );
    banDoNangLuc = kyNang.map((k) => {
      const t = mapThanhThao.get(k.id) ?? { pKnown: 0.1, attempts: 0, correct: 0 };
      return { code: k.code, name: k.name, muc: mucThanhThao(t), pKnown: t.pKnown };
    });

    const nguCanh = {
      courseSlug: course.slug,
      bai: bai.map((b) => ({
        id: b.id,
        slug: b.slug,
        ordinal: b.ordinal,
        title: b.title,
        estimatedMinutes: b.estimated_minutes,
        skills: b.skills,
        status: b.status,
      })),
      tienDo: new Map(
        td.map((p) => [
          p.lesson_id,
          {
            lessonId: p.lesson_id,
            state: p.state as "chua_mo" | "dang_hoc" | "xong",
            lastBlockOrdinal: p.last_block_ordinal,
            secondsSpent: p.seconds_spent,
          },
        ]),
      ),
      theOn: theOn.map((t) => ({
        intervalDays: t.interval_days,
        ease: Number(t.ease),
        reps: t.reps,
        lapses: t.lapses,
        dueOn: asDate(t.due_on) ?? "",
        suspended: t.suspended,
      })),
      maLoiLapLai: maLoi.map((m) => m.ma_loi),
      thanhThao: mapThanhThao,
    };
    tomTat = tomTatTienDo(nguCanh);
    buoc = buocKeTiep(nguCanh);
  }

  const tienDoTheoBai = new Map(tienDo.map((t) => [t.lesson_id, t]));
  return c.json({
    chuyenDe: {
      slug: course.slug,
      title: course.title,
      summary: course.summary,
      level: course.level,
      audience: course.audience,
      tags: course.tags,
      objectives: course.objectives,
      asOf: asDate(course.as_of) ?? "",
      // Số bài và thời lượng của lộ trình đang mở được, khớp với danh sách `loTrinh` bên dưới.
      lessonCount: bai.length,
      durationMinutes: bai.reduce((t, b) => t + b.estimated_minutes, 0) || course.duration_minutes,
      citationHealth: course.citation_health,
      mascotLocked: course.mascot_locked,
      nhomDoiTuong: course.audience_group,
      linhVuc: lienQuan.linhVuc ? { slug: lienQuan.linhVuc.slug, name: lienQuan.linhVuc.name } : null,
    },
    // Vị trí trong cây của lĩnh vực: chuyên đề rộng hơn, chuyên đề liền trước, liền sau và
    // các chuyên đề thu hẹp phạm vi. Chỉ hiện những chuyên đề đã có mặt trong danh mục.
    viTri: {
      cha: tomTatLienQuan(lienQuan.cha),
      noiTiepTu: tomTatLienQuan(lienQuan.noiTiepTu),
      noiTiepSang: tomTatLienQuan(lienQuan.noiTiepSang),
      con: lienQuan.con.map(tomTatLienQuan).filter((x) => x !== null),
    },
    // `soBai` là số hiển thị cho người học, đánh liên tục theo lộ trình đã xuất bản.
    // `ordinal` giữ nguyên giá trị trong kho để phía quản trị còn biết chỗ đứng khi biên tập.
    loTrinh: bai.map((b, i) => ({
      id: b.id,
      slug: b.slug,
      soBai: i + 1,
      ordinal: b.ordinal,
      title: b.title,
      summary: b.summary,
      estimatedMinutes: b.estimated_minutes,
      skills: b.skills,
      trangThai: tienDoTheoBai.get(b.id)?.state ?? "chua_mo",
      phanTram: enrollment ? phanTramCuaBai(tienDoTheoBai.get(b.id), soKhoi.get(b.id) ?? 0) : null,
    })),
    kyNang: kyNang.map((k) => ({ code: k.code, name: k.name, prerequisites: k.prerequisites })),
    banDoNangLuc,
    ghiDanh: enrollment
      ? {
          id: enrollment.id,
          mode: enrollment.mode,
          goalMinutesPerWeek: enrollment.goal_minutes_per_week,
          mascotLevel: enrollment.mascot_level,
          state: enrollment.state,
        }
      : null,
    tomTat,
    buocKeTiep: buoc,
  });
});

/** POST /v1/dao-tao/chuyen-de/:slug/ghi-danh */
daoTao.post("/chuyen-de/:slug/ghi-danh", async (c) => {
  const principal = await batBuocDangNhap(c);
  const course = await chuyenDeTheoSlug(c.req.param("slug"));
  if (!course) throw notFound("Không tìm thấy chuyên đề");
  const body = await parseBody(c, z.object({ mode: cheDoSchema.default("day_du") }));
  const e = await ghiDanh(principal.accountId!, course.id, body.mode);
  await ghiSuKienHoc({ enrollmentId: e.id, kind: "vao_chuyen_de" });
  return c.json({ ghiDanh: { id: e.id, mode: e.mode, state: e.state } });
});

/** PATCH /v1/dao-tao/ghi-danh/:id — đổi chế độ học, mục tiêu tuần, mức xuất hiện của mascot. */
daoTao.patch("/ghi-danh/:id", async (c) => {
  const principal = await batBuocDangNhap(c);
  await batBuocChuGhiDanh(c.req.param("id"), principal.accountId);
  const body = await parseBody(
    c,
    z.object({
      mode: cheDoSchema.optional(),
      goalMinutesPerWeek: z.number().int().min(10).max(2000).optional(),
      mascotId: z.string().uuid().nullable().optional(),
      mascotLevel: z.enum(["day_du", "it", "yen_lang", "tat"]).optional(),
    }),
  );
  const row = await capNhatGhiDanh(c.req.param("id"), body);
  if (!row) throw notFound("Không tìm thấy ghi danh");
  return c.json({ ghiDanh: { id: row.id, mode: row.mode, mascotLevel: row.mascot_level } });
});

/* ------------------------------------------------------------------ */
/* Bài học                                                             */
/* ------------------------------------------------------------------ */

/**
 * GET /v1/dao-tao/chuyen-de/:slug/bai/:baiSlug — nội dung một bài, lọc theo chế độ học. Cần đăng
 * nhập bằng tài khoản đã được xác minh: danh mục chuyên đề công khai, nội dung bài thì không.
 */
daoTao.get("/chuyen-de/:slug/bai/:baiSlug", async (c) => {
  const principal = await batBuocDangNhap(c);
  const course = await chuyenDeTheoSlug(c.req.param("slug"));
  if (course?.status !== "xuat_ban" || !course.nhom_hoc_tap.length)
    throw notFound("Không tìm thấy chuyên đề");
  const bai = await baiHocTheoSlug(course.id, c.req.param("baiSlug"));
  if (bai?.status !== "xuat_ban") throw notFound("Bài học chưa xuất bản");

  const p = parseQuery(c, z.object({ cheDo: cheDoSchema.optional() }));
  const enrollment = principal.accountId
    ? await ghiDanhCuaNguoiHoc(principal.accountId, course.id)
    : undefined;
  const cheDo = (p.cheDo ?? enrollment?.mode ?? course.default_mode) as CheDoHoc;

  const [khoiRows, hoatDongRows] = await Promise.all([khoiCuaBai(bai.id), hoatDongCuaBai(bai.id)]);
  const luotGanNhat = enrollment
    ? await luotGanNhatTheoHoatDong(
        enrollment.id,
        hoatDongRows.map((h) => h.id),
      )
    : new Map<string, LuotGanNhat>();
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
    modes: k.modes as CheDoHoc[],
    note: k.note,
  }));

  let trangThai = "chua_mo";
  if (enrollment) {
    await ghiSuKienHoc({ enrollmentId: enrollment.id, kind: "vao_bai", lessonId: bai.id });
    // ghiTienDo không kéo bài đã xong lùi về "đang học".
    trangThai = (await ghiTienDo({ enrollmentId: enrollment.id, lessonId: bai.id, state: "dang_hoc" })).state;
  }

  // Kiểm tra cuối bài (docs/PLAN.md GĐ11): 3–5 câu rút từ ngân hàng theo chủ đề của bài, qua
  // phiên luyện tập của GĐ4. Chủ đề chưa đủ 3 câu đã duyệt thì không có phần này.
  const chuDe = await chuDeCuaBaiHoc(bai.topic_id ?? null);
  const kiemTraCuoiBai =
    chuDe && chuDe.so_cau >= SO_CAU_KIEM_TRA_CUOI_BAI.toiThieu
      ? {
          chuDe: chuDe.code,
          tenChuDe: chuDe.name,
          soCau: Math.min(SO_CAU_KIEM_TRA_CUOI_BAI.toiDa, chuDe.so_cau),
        }
      : null;

  return c.json({
    bai: {
      id: bai.id,
      slug: bai.slug,
      ordinal: bai.ordinal,
      title: bai.title,
      summary: bai.summary,
      asOf: asDate(bai.as_of),
      estimatedMinutes: bai.estimated_minutes,
      skills: bai.skills,
      citationHealth: bai.citation_health,
      topicId: bai.topic_id ?? null,
    },
    cheDo,
    khoi: locTheoCheDo(khoi, cheDo),
    hoatDong: hoatDongRows.map((h) => {
      const l = luotGanNhat.get(h.id);
      return {
        ...hoatDongCongKhai(h),
        // Lần nộp gần nhất của chính người học: hiện lại bài đã viết và kết quả khi mở lại bài.
        luotGanNhat: l
          ? {
              attemptNo: l.attempt_no,
              traLoi: l.response,
              score: Number(l.score),
              maxScore: Number(l.max_score),
              passed: l.passed,
              feedback: l.feedback,
              gradedBy: l.graded_by,
              // Giảng viên đã chấm lại thì điểm của giảng viên là điểm cuối cùng.
              diemGiangVien: l.reviewer_score === null ? null : Number(l.reviewer_score),
              choGiangVien: l.review_state === "cho_doi_chieu" && l.reviewer_score === null,
              createdAt: l.created_at,
            }
          : null,
      };
    }),
    ghiDanhId: enrollment?.id ?? null,
    trangThai,
    kiemTraCuoiBai,
  });
});

/**
 * POST /v1/dao-tao/chuyen-de/:slug/bai/:baiSlug/hoan-thanh — người học bấm "Hoàn thành bài".
 * Ghi danh nếu chưa có, đánh dấu bài xong (GĐ11) trong một giao dịch.
 */
daoTao.post("/chuyen-de/:slug/bai/:baiSlug/hoan-thanh", async (c) => {
  const principal = await batBuocDangNhap(c);
  const course = await chuyenDeTheoSlug(c.req.param("slug"));
  if (course?.status !== "xuat_ban" || !course.nhom_hoc_tap.length)
    throw notFound("Không tìm thấy chuyên đề");
  const bai = await baiHocTheoSlug(course.id, c.req.param("baiSlug"));
  if (bai?.status !== "xuat_ban") throw notFound("Bài học chưa xuất bản");
  const body = await parseBody(c, z.object({ themGiay: z.number().int().min(0).max(7200).default(0) }));
  const kq = await hoanThanhBaiHoc({
    accountId: principal.accountId!,
    courseId: course.id,
    lessonId: bai.id,
    themGiay: body.themGiay,
  });
  return c.json({ trangThai: "xong", ...kq });
});

/** POST /v1/dao-tao/bai/:id/tien-do — ghi thời gian học và khối đang đọc. */
daoTao.post("/bai/:id/tien-do", async (c) => {
  const principal = await batBuocDangNhap(c);
  const body = await parseBody(
    c,
    z.object({
      ghiDanhId: z.string().uuid(),
      themGiay: z.number().int().min(0).max(7200).default(0),
      lastBlockOrdinal: z.number().int().min(0).max(500).default(0),
      xong: z.boolean().default(false),
      blockId: z.string().uuid().optional(),
    }),
  );
  // Chỉ ghi tiến độ vào ghi danh của chính người gọi (docs/PLAN.md GĐ0, S3).
  const ghiDanhCua = await ghiDanhTheoId(body.ghiDanhId);
  if (!ghiDanhCua || ghiDanhCua.account_id !== principal.accountId) {
    throw new NgoaiPhamVi("Ghi danh này không thuộc tài khoản đang đăng nhập.");
  }
  if (body.xong) {
    // Hoàn thành bài đi qua cùng một lối với nút "Hoàn thành" để trạng thái được ghi đúng một lần.
    await hoanThanhBaiHoc({
      accountId: principal.accountId!,
      courseId: ghiDanhCua.course_id,
      lessonId: c.req.param("id"),
      themGiay: body.themGiay,
    });
    return c.json({ tienDo: { state: "xong" } });
  }
  const row = await ghiTienDo({
    enrollmentId: body.ghiDanhId,
    lessonId: c.req.param("id"),
    themGiay: body.themGiay,
    lastBlockOrdinal: body.lastBlockOrdinal,
    ...(body.xong ? { state: "xong" as const } : {}),
  });
  await ghiSuKienHoc({
    enrollmentId: body.ghiDanhId,
    kind: body.xong ? "xong_bai" : "mo_khoi",
    lessonId: c.req.param("id"),
    blockId: body.blockId ?? null,
    payload: { ordinal: body.lastBlockOrdinal },
  });
  return c.json({ tienDo: { state: row.state, secondsSpent: row.seconds_spent } });
});

/* ------------------------------------------------------------------ */
/* Nộp bài                                                             */
/* ------------------------------------------------------------------ */

/**
 * POST /v1/dao-tao/hoat-dong/:id/nop — chấm một lượt làm bài.
 *
 * Chấm luôn chạy ở đây. Dạng bài cần mô hình đọc bài viết trả về `choCham = true` và lượt
 * làm được ghi với điểm 0 kèm cờ chờ chấm — KHÔNG bịa điểm cho phần chưa chấm được.
 */
daoTao.post("/hoat-dong/:id/nop", async (c) => {
  const principal = await batBuocDangNhap(c);
  const body = await parseBody(
    c,
    z.object({
      ghiDanhId: z.string().uuid(),
      traLoi: z.unknown(),
      secondsSpent: z.number().int().min(0).max(7200).default(0),
    }),
  );
  // Lượt làm, mức thành thạo và thẻ ôn đều ghi vào ghi danh này: phải là của người nộp.
  await batBuocChuGhiDanh(body.ghiDanhId, principal.accountId);

  const row = await hoatDongTheoId(c.req.param("id"));
  if (row?.retired !== false) throw notFound("Không tìm thấy hoạt động");

  const hd: HoatDong = {
    id: row.id,
    lessonId: row.lesson_id,
    courseId: row.course_id,
    ordinal: row.ordinal,
    kind: row.kind as HoatDong["kind"],
    mode: row.mode as HoatDong["mode"],
    title: row.title,
    prompt: row.prompt as HoatDong["prompt"],
    answer: row.answer as HoatDong["answer"],
    rubric: row.rubric as HoatDong["rubric"],
    skills: row.skills,
    errorTags: row.error_tags,
    citations: row.citations,
    difficulty: Number(row.difficulty),
    points: row.points,
    level: row.level,
    status: row.status as HoatDong["status"],
    retired: row.retired,
  };

  let kq = chamBaiTap(hd, body.traLoi);
  let model: string | null = null;
  let costUsd = 0;
  let canNguoiCham = false;

  // Tự luận AI chấm: gọi mô hình ngay trong lượt nộp. Mô hình không chấm được thì bài sang
  // giảng viên (hàng chấm lại), điểm vẫn là 0 chờ chấm — không bịa điểm.
  if (hd.kind === "viet_co_can_cu" && hd.mode === "ai" && laRubric(hd.rubric)) {
    const baiViet = String((body.traLoi as { bai_viet?: unknown } | null)?.bai_viet ?? "").trim();
    if (baiViet.length < DO_DAI_BAI_VIET.toiThieu || baiViet.length > DO_DAI_BAI_VIET.toiDa) {
      throw badRequest(
        `Bài viết cần từ ${DO_DAI_BAI_VIET.toiThieu} đến ${DO_DAI_BAI_VIET.toiDa.toLocaleString("vi-VN")} ký tự.`,
      );
    }
    if ((await soLuotAiChamTrongNgay(body.ghiDanhId, hd.id)) >= SO_LAN_NOP_AI_MOI_NGAY) {
      throw conflict(
        `Bạn đã nộp bài này ${SO_LAN_NOP_AI_MOI_NGAY} lần trong 24 giờ qua. Hãy xem lại nhận xét và nộp lại sau.`,
      );
    }
    const ai = await chamTuLuanBangAi(hd, hd.rubric, baiViet, today());
    if (ai) {
      kq = ai.kq;
      model = ai.model;
      costUsd = ai.costUsd;
    } else {
      canNguoiCham = true;
      kq = {
        ...kq,
        gradedBy: "nguoi",
        feedback: { tom_tat: "AI chưa chấm được bài này. Bài đã được chuyển cho giảng viên chấm." },
      };
    }
  }

  const luot = await ghiLuotLam({
    enrollmentId: body.ghiDanhId,
    activityId: hd.id,
    response: body.traLoi,
    score: kq.score,
    maxScore: kq.maxScore,
    passed: kq.passed,
    feedback: kq.feedback,
    errorTags: kq.errorTags,
    secondsSpent: body.secondsSpent,
    gradedBy: kq.gradedBy,
    model,
    costUsd,
    canNguoiCham,
    level: hd.level,
  });

  await ghiSuKienHoc({
    enrollmentId: body.ghiDanhId,
    kind: "lam_bai",
    lessonId: hd.lessonId,
    activityId: hd.id,
    payload: { passed: kq.passed, errorTags: kq.errorTags },
  });

  // Cập nhật mức thành thạo cho từng kỹ năng của câu này.
  if (!kq.canChamTiep && hd.skills.length) {
    const [kyNang, thanhThao] = await Promise.all([
      kyNangCuaChuyenDe(hd.courseId),
      thanhThaoCuaGhiDanh(body.ghiDanhId),
    ]);
    const theoId = new Map(thanhThao.map((m) => [m.skill_id, m]));
    for (const code of hd.skills) {
      const k = kyNang.find((x) => x.code === code);
      if (!k) continue;
      const cu = theoId.get(k.id);
      const moi = capNhatThanhThao(
        { pKnown: Number(cu?.p_known ?? 0.1), attempts: cu?.attempts ?? 0, correct: cu?.correct ?? 0 },
        kq.passed,
        thamSoCho(hd.kind),
      );
      await luuThanhThao(body.ghiDanhId, k.id, moi.pKnown, moi.attempts, moi.correct);
    }
  }

  // Câu sai được đưa vào lịch ôn giãn cách để gặp lại đúng lúc sắp quên.
  if (!kq.passed && !kq.canChamTiep) {
    await taoTheOn({
      enrollmentId: body.ghiDanhId,
      refKind: "activity",
      refId: hd.id,
      lessonId: hd.lessonId,
    });
  }

  return c.json({
    ketQua: {
      attemptId: luot.id,
      attemptNo: luot.attempt_no,
      score: kq.score,
      maxScore: kq.maxScore,
      passed: kq.passed,
      feedback: kq.feedback,
      errorTags: kq.errorTags,
      choCham: kq.canChamTiep || canNguoiCham,
    },
  });
});

/**
 * POST /v1/dao-tao/hoat-dong/:id/phuc-khao — người học đề nghị giảng viên chấm lại lượt AI chấm
 * gần nhất của bài này. Lượt vào hàng chấm lại (`/v1/quan-tri/dao-tao/cham-lai`); điểm của giảng
 * viên là điểm cuối cùng.
 */
daoTao.post("/hoat-dong/:id/phuc-khao", async (c) => {
  const principal = await batBuocDangNhap(c);
  const body = await parseBody(
    c,
    z.object({ ghiDanhId: z.string().uuid(), lyDo: z.string().trim().min(5).max(1000) }),
  );
  await batBuocChuGhiDanh(body.ghiDanhId, principal.accountId);
  const row = await deNghiPhucKhao(body.ghiDanhId, c.req.param("id"), body.lyDo);
  if (!row) {
    throw conflict("Bài này không có lượt AI chấm nào chờ phúc khảo, hoặc đã được gửi giảng viên chấm lại.");
  }
  await ghiSuKienHoc({
    enrollmentId: body.ghiDanhId,
    kind: "phuc_khao",
    activityId: row.activity_id,
    payload: { attemptId: row.id },
  });
  return c.json({ ok: true, attemptId: row.id });
});

/* ------------------------------------------------------------------ */
/* Ôn tập                                                              */
/* ------------------------------------------------------------------ */

/**
 * GET /v1/dao-tao/ghi-danh/:id/on-tap — phiên ôn hôm nay, kèm nội dung từng thẻ.
 *
 * Trả cả `daTreo`: thẻ bị treo vì văn bản căn cứ đã đổi. Nói rõ số thẻ bị treo chứ không
 * lặng lẽ bỏ qua — người học cần biết phần nào của kiến thức đang chờ cập nhật.
 */
daoTao.get("/ghi-danh/:id/on-tap", async (c) => {
  const principal = await batBuocDangNhap(c);
  const enrollmentId = c.req.param("id");
  await batBuocChuGhiDanh(enrollmentId, principal.accountId);
  const homNay = today();
  const [denHan, tatCa] = await Promise.all([
    theOnDenHan(enrollmentId, homNay),
    theOnCuaGhiDanh(enrollmentId),
  ]);

  return c.json({
    homNay,
    tong: tatCa.length,
    daTreo: tatCa
      .filter((t) => t.suspended)
      .map((t) => ({ id: t.id, lyDo: t.suspend_reason ?? "Văn bản căn cứ đã thay đổi" })),
    the: denHan.map((t) => ({
      id: t.id,
      refKind: t.ref_kind,
      refId: t.ref_id,
      lessonSlug: t.lesson_slug,
      lessonTitle: t.lesson_title,
      dueOn: asDate(t.due_on) ?? "",
      lapses: t.lapses,
      // Đề bài không kèm đáp án; chấm vẫn chạy ở máy chủ như mọi lượt làm bài khác.
      hoatDong: t.prompt ? { id: t.ref_id, kind: t.activity_kind, prompt: t.prompt, points: t.points } : null,
    })),
  });
});

/** POST /v1/dao-tao/the-on/:id/on — ghi kết quả một lượt ôn. */
daoTao.post("/the-on/:id/on", async (c) => {
  const principal = await batBuocDangNhap(c);
  await batBuocChuTheOn(c.req.param("id"), principal.accountId);
  const body = await parseBody(
    c,
    // Giao diện chỉ có ba nút: quên (1), khó (3), dễ (5). Năm mức của SM-2 là quá nhiều
    // lựa chọn cho một phiên ôn năm phút.
    z.object({ chatLuong: z.union([z.literal(1), z.literal(3), z.literal(5)]) }),
  );
  const id = c.req.param("id");
  const row = await theOnTheoId(id);
  if (!row) throw notFound("Không tìm thấy thẻ ôn");
  if (row.suspended) {
    // Thẻ bị treo vì văn bản căn cứ đã đổi: không cho ôn tiếp cho tới khi biên tập cập nhật.
    throw notFound("Thẻ này đang tạm treo vì văn bản căn cứ đã thay đổi");
  }

  const capNhat = onThe(
    {
      intervalDays: row.interval_days,
      ease: Number(row.ease),
      reps: row.reps,
      lapses: row.lapses,
      dueOn: asDate(row.due_on) ?? "",
      suspended: row.suspended,
    },
    body.chatLuong,
  );
  await capNhatTheOn(id, capNhat);
  await ghiSuKienHoc({
    enrollmentId: row.enrollment_id,
    kind: "on_tap",
    lessonId: row.lesson_id,
    payload: { chatLuong: body.chatLuong, khoangCachMoi: capNhat.intervalDays },
  });
  return c.json({ the: capNhat });
});

/* ------------------------------------------------------------------ */
/* Tiến độ và bài vá                                                   */
/* ------------------------------------------------------------------ */

/** GET /v1/dao-tao/ghi-danh/:id/tien-do — số liệu cho trang tiến độ của người học (09-a §7.1). */
daoTao.get("/ghi-danh/:id/tien-do", async (c) => {
  const principal = await batBuocDangNhap(c);
  const id = c.req.param("id");
  await batBuocChuGhiDanh(id, principal.accountId);
  const enrollment = await ghiDanhTheoId(id);
  if (!enrollment) throw notFound("Không tìm thấy ghi danh");

  const [maLoi, danhMucLoi, sanPham, theoTuan, theOn] = await Promise.all([
    maLoiLapLai(id, 2),
    danhSachMaLoi(),
    sanPhamDaNop(id),
    phutHocTheoTuan(id),
    theOnCuaGhiDanh(id),
  ]);
  const tenLoi = new Map(danhMucLoi.map((m) => [m.code, m]));
  const homNay = today();

  return c.json({
    ghiDanh: {
      id: enrollment.id,
      mode: enrollment.mode,
      goalMinutesPerWeek: enrollment.goal_minutes_per_week,
      state: enrollment.state,
    },
    // Ba lỗi hay mắc nhất, kèm cách vá — không chỉ nêu tên lỗi.
    loiHayMac: maLoi.slice(0, 3).map((m) => ({
      ma: m.ma_loi,
      soLan: m.so_lan,
      ten: tenLoi.get(m.ma_loi)?.name ?? m.ma_loi,
      moTa: tenLoi.get(m.ma_loi)?.description ?? null,
      cachSua: tenLoi.get(m.ma_loi)?.remedy ?? null,
    })),
    sanPham: sanPham.map((s) => ({
      attemptId: s.attempt_id,
      title: s.title ?? s.kind,
      lessonSlug: s.lesson_slug,
      lessonTitle: s.lesson_title,
      score: Number(s.score),
      maxScore: Number(s.max_score),
      passed: s.passed,
      nopLuc: s.created_at,
    })),
    phutTheoTuan: theoTuan,
    onTap: {
      denHan: theOn.filter((t) => !t.suspended && (asDate(t.due_on) ?? "") <= homNay).length,
      daTreo: theOn.filter((t) => t.suspended).length,
      tong: theOn.length,
    },
  });
});

/**
 * GET /v1/dao-tao/chuyen-de/:slug/va-loi/:ma — nguyên liệu một bài vá lỗi khái niệm.
 *
 * Bài vá không phải hình phạt kéo dài lộ trình: nó là một đường tắt sửa hiểu sai, gồm mô tả
 * lỗi, các khối căn cứ liên quan và hai câu hỏi cùng loại lỗi. Là nội dung bài nên cần đăng nhập.
 */
daoTao.get("/chuyen-de/:slug/va-loi/:ma", async (c) => {
  await batBuocDangNhap(c);
  const course = await chuyenDeTheoSlug(c.req.param("slug"));
  if (course?.status !== "xuat_ban" || !course.nhom_hoc_tap.length)
    throw notFound("Không tìm thấy chuyên đề");

  const ma = c.req.param("ma");
  const loi = await maLoiTheoCode(ma);
  if (!loi) throw notFound(`Không có mã lỗi "${ma}"`);

  const { hoatDong, khoiCanCu } = await nguyenLieuBaiVa(course.id, ma);
  return c.json({
    loi: { ma: loi.code, ten: loi.name, moTa: loi.description, cachSua: loi.remedy },
    khoi: khoiCanCu.map((k) => ({
      id: k.id,
      ordinal: k.ordinal,
      kind: k.kind,
      data: k.data,
      citations: k.citations,
      citationHealth: k.citation_health,
      source: k.source,
      modes: k.modes,
      lessonSlug: k.lesson_slug,
      lessonTitle: k.lesson_title,
    })),
    hoatDong: hoatDong.map(hoatDongCongKhai),
  });
});
