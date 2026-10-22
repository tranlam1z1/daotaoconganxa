/**
 * Đề thi và giao bài (docs/PLAN.md GĐ6).
 *
 * - Đề thi (`/v1/quan-tri/de-thi`): quản trị viên tạo, sửa, xem trước, xuất bản, đóng. Cán bộ
 *   quản lý chỉ xem đề đã xuất bản để giao.
 * - Giao bài (`/v1/giao-bai`): từ `quan_ly` trở lên, chỉ giao trong cây đơn vị của mình
 *   (quản trị giao cho mọi đơn vị). Giao cho một đơn vị hoặc một người, kèm hạn làm bài.
 */
import { atLeast, trongPhamVi } from "@qdpl/auth";
import {
  DANG_CAU,
  type DangCau,
  DIEM_MOI_CAU,
  deChoNguoiHoc,
  khoaO,
  kiemTraMaTran,
  type LoaiCauHoi,
  LoiSinhDe,
  MUC_DO_CAU_HOI,
  SO_CAU_TOI_DA,
  SO_CAU_TOI_THIEU,
  sinhDe,
  tongSoCau,
} from "@qdpl/dao-tao";
import {
  chamTayCauTuLuan,
  chuyenTrangThaiCauHoiDb,
  type DeThiRow,
  danhSachChuDeCauHoi,
  danhSachDeThi,
  danhSachGiaoBai,
  danhSachViecSinhCauHoi,
  demCauKhaDung,
  doiTrangThaiDeThi,
  hangChamTuLuanThi,
  huyGiaoBai,
  LoiNghiepVu,
  layDeThi,
  layGiaoBai,
  layLuot,
  layNguoiDung,
  nguonCauHoiChoMaTran,
  sql,
  suaDeThi,
  suaTenDeThi,
  taoDeThi,
  taoGiaoBai,
} from "@qdpl/db";
import { Hono } from "hono";
import { z } from "zod";
import { batBuocPhamViDonVi, batBuocVaiTro, KhongDuQuyen, NgoaiPhamVi, phamViCua } from "../auth.ts";
import { sinhTiepDeThi, taoTuPdf, tienDoSinhDe } from "../chuyen-de-tu-pdf.ts";
import { badRequest, conflict, notFound, parseBody, parseQuery } from "../http.ts";
import { laMauDe } from "../sinh-de-tu-van-ban.ts";
import { vaiTroDuyet } from "./ngan-hang.ts";
import { docTepPdf } from "./quan-tri-van-ban.ts";

const uuid = z.string().uuid("Id phải là UUID hợp lệ");

function idHopLe(raw: string | undefined): string {
  const r = uuid.safeParse(raw ?? "");
  if (!r.success) throw badRequest("Id phải là UUID hợp lệ");
  return r.data;
}

function doiLoi(e: unknown): never {
  if (e instanceof LoiNghiepVu) {
    if (e.loai === "khong_tim_thay") throw notFound(e.message);
    if (e.loai === "xung_dot") throw conflict(e.message);
    throw badRequest(e.message);
  }
  throw e;
}

/** Tên chủ đề theo id, để thông báo lỗi ma trận nói bằng tên chứ không bằng id. */
async function tenChuDe(): Promise<Map<string, string>> {
  return new Map((await danhSachChuDeCauHoi()).map((t) => [t.id, t.name]));
}

/** Lỗi khả thi của ma trận so với ngân hàng hiện tại (rỗng là sinh đề được). */
async function loiMaTran(de: Pick<DeThiRow, "matrix" | "question_count">): Promise<string[]> {
  return kiemTraMaTran(de.matrix, await demCauKhaDung(), {
    soCau: de.question_count,
    tenChuDe: await tenChuDe(),
  });
}

/* ------------------------------------------------------------------ */
/* Đề thi                                                              */
/* ------------------------------------------------------------------ */

export const deThiRoute = new Hono();

const oMaTranSchema = z.object({
  topic_id: uuid,
  level: z.enum(MUC_DO_CAU_HOI),
  so_cau: z.coerce.number().int().min(0).max(SO_CAU_TOI_DA),
  dang: z.enum(DANG_CAU).default("trac_nghiem"),
  diem_moi_cau: z.coerce
    .number()
    .min(DIEM_MOI_CAU.toiThieu, `Điểm mỗi câu tối thiểu ${DIEM_MOI_CAU.toiThieu}`)
    .max(DIEM_MOI_CAU.toiDa, `Điểm mỗi câu tối đa ${DIEM_MOI_CAU.toiDa}`)
    .default(1),
});

const deThiSchema = z.object({
  title: z.string().trim().min(1, "Nhập tên đề thi").max(300),
  description: z.string().trim().max(2000).nullable().optional(),
  field_id: uuid.nullable().optional(),
  matrix: z.array(oMaTranSchema).max(200),
  duration_minutes: z.coerce
    .number()
    .int()
    .min(5, "Thời gian tối thiểu 5 phút")
    .max(240, "Thời gian tối đa 240 phút"),
  pass_score: z.coerce.number().int().min(0).max(100).default(70),
  shuffle_questions: z.boolean().default(true),
  shuffle_options: z.boolean().default(true),
  max_attempts: z.coerce.number().int().min(1).max(10).default(1),
  show_answers: z.enum(["khong", "sau_nop", "sau_han"]).default("sau_nop"),
});

/** Chuẩn hóa ma trận: bỏ ô 0 câu; số câu của đề là tổng ma trận, phải trong khoảng cho phép. */
function chuanHoa(body: z.infer<typeof deThiSchema>) {
  const matrix = body.matrix.filter((o) => o.so_cau > 0);
  const soCau = tongSoCau(matrix);
  if (soCau < SO_CAU_TOI_THIEU || soCau > SO_CAU_TOI_DA) {
    throw badRequest(`Ma trận có ${soCau} câu; đề thi cần từ ${SO_CAU_TOI_THIEU} đến ${SO_CAU_TOI_DA} câu.`);
  }
  return { ...body, matrix, question_count: soCau };
}

/** GET /v1/quan-tri/de-thi — quản trị thấy mọi đề; cán bộ quản lý chỉ thấy đề đang mở để giao. */
deThiRoute.get("/", async (c) => {
  const p = await batBuocVaiTro(c, "lanh_dao");
  const items = await danhSachDeThi(p.role === "quan_tri" ? undefined : ["xuat_ban"]);
  return c.json({ items });
});

/**
 * GET /v1/quan-tri/de-thi/kha-dung — số câu đã duyệt theo chủ đề × mức độ, cho form ma trận:
 * `kha_dung` là câu trắc nghiệm (mọi loại chấm máy), `kha_dung_tu_luan` là câu tự luận.
 */
deThiRoute.get("/kha-dung", async (c) => {
  await batBuocVaiTro(c, "quan_tri");
  const [chuDe, dem] = await Promise.all([danhSachChuDeCauHoi(), demCauKhaDung()]);
  const theoMuc = (id: string, dang: DangCau) =>
    Object.fromEntries(MUC_DO_CAU_HOI.map((l) => [l, dem.get(khoaO(id, l, dang)) ?? 0]));
  return c.json({
    chu_de: chuDe.map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      field_name: t.field_name,
      kha_dung: theoMuc(t.id, "trac_nghiem"),
      kha_dung_tu_luan: theoMuc(t.id, "tu_luan"),
    })),
  });
});

/* ------------------------------------------------------------------ */
/* Chấm tự luận                                                        */
/* ------------------------------------------------------------------ */

/**
 * GET /v1/quan-tri/de-thi/cham-tu-luan?che_do=cho_nguoi|da_cham_ai — hàng chấm tự luận: câu mô
 * hình không chấm được (lượt đang chờ điểm), hoặc câu mô hình đã chấm để lấy mẫu đối chiếu và
 * phúc khảo. Cùng vai trò và cùng phạm vi với hàng chấm lại bài tập trong bài học
 * (`/v1/quan-tri/dao-tao/cham-lai`): Admin quản lý trở lên, mọi đơn vị.
 */
deThiRoute.get("/cham-tu-luan", async (c) => {
  await batBuocVaiTro(c, "quan_ly");
  const q = parseQuery(c, z.object({ che_do: z.enum(["cho_nguoi", "da_cham_ai"]).default("cho_nguoi") }));
  return c.json({ items: await hangChamTuLuanThi({ cheDo: q.che_do, phamVi: null }) });
});

const chamTaySchema = z.object({
  diem: z.record(z.string(), z.number().min(0).max(100)),
  nhan_xet: z.string().trim().max(2000).nullish(),
});

/**
 * POST /v1/quan-tri/de-thi/cham-tu-luan/:luot/:cau — giảng viên chấm (hoặc phúc khảo) một câu
 * tự luận theo rubric: điểm thô từng tiêu chí. Lượt đủ điểm thì được chốt; lượt đã chốt thì
 * tính lại điểm.
 */
deThiRoute.post("/cham-tu-luan/:luot/:cau", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  const attemptId = idHopLe(c.req.param("luot"));
  const ordinal = Number(c.req.param("cau"));
  if (!Number.isInteger(ordinal) || ordinal < 1) throw badRequest("Số thứ tự câu không hợp lệ.");
  const b = await parseBody(c, chamTaySchema);
  try {
    const kq = await chamTayCauTuLuan({
      attemptId,
      ordinal,
      diemTieuChi: b.diem,
      nhanXet: b.nhan_xet ?? null,
      reviewer: p.email,
    });
    const sau = (await layLuot(attemptId)) as NonNullable<Awaited<ReturnType<typeof layLuot>>>;
    return c.json({
      diem_cau: kq.points,
      diem_toi_da: kq.maxPoints,
      luot: { trang_thai: sau.status, diem: sau.score, dat: sau.passed },
    });
  } catch (e) {
    doiLoi(e);
  }
});

deThiRoute.get("/:id", async (c) => {
  const p = await batBuocVaiTro(c, "lanh_dao");
  const de = await layDeThi(idHopLe(c.req.param("id")));
  if (!de || (p.role !== "quan_tri" && de.status !== "xuat_ban")) throw notFound("Không tìm thấy đề thi.");
  const laQuanTri = p.role === "quan_tri";
  return c.json({
    item: de,
    canh_bao: laQuanTri ? await loiMaTran(de) : [],
    // Việc đọc bản quét và các việc sinh câu hỏi: còn chạy, lỗi ở đâu, để trang đề tự cập nhật.
    tien_do: laQuanTri ? await tienDoSinhDe(de) : null,
    // Đề sinh từ văn bản: tiến độ các việc AI sinh câu hỏi đi kèm, để biết còn chờ duyệt bao nhiêu.
    viec_sinh:
      laQuanTri && de.authoring_job_ids?.length
        ? await danhSachViecSinhCauHoi(de.authoring_job_ids.length, de.authoring_job_ids)
        : [],
  });
});

/* ------------------------------------------------------------------ */
/* Tạo đề từ tệp PDF                                                   */
/* ------------------------------------------------------------------ */

/**
 * POST /v1/quan-tri/de-thi/tu-pdf — tạo đề thẳng từ một tệp PDF văn bản.
 *
 * Form multipart: `tep` (PDF), `mau` (15, 45 hoặc 90 phút), cùng `so_ky_hieu` và `loai` khi hệ
 * thống không tự đọc được từ tệp. Hệ thống lưu văn bản vào kho (đã có thì dùng lại), tạo đề nháp
 * mang tên văn bản và cho AI sinh câu hỏi. Chi tiết ở chuyen-de-tu-pdf.ts.
 */
deThiRoute.post("/tu-pdf", async (c) => {
  const p = await batBuocVaiTro(c, "quan_tri");
  const form = await c.req.raw.formData().catch(() => null);
  const tep = form?.get("tep");
  const bytes = await docTepPdf(tep);
  const chu = (ten: string) => String(form?.get(ten) ?? "").trim();
  const mau = chu("mau") || "45";
  if (!laMauDe(mau)) throw badRequest("Mẫu cấu trúc đề không hợp lệ.");
  const kq = await taoTuPdf(p, bytes, tep instanceof File ? tep.name : "van-ban.pdf", {
    so_ky_hieu: chu("so_ky_hieu").slice(0, 100) || undefined,
    loai: chu("loai").slice(0, 20) || undefined,
    de_thi: { mau },
  });
  return c.json(kq, 202);
});

/** Câu AI sinh cho đề còn chờ duyệt, kèm đáp án, để người duyệt xem ngay ở trang đề. */
async function cauChoDuyetCuaDe(de: DeThiRow) {
  const ids = de.authoring_job_ids ?? [];
  if (!ids.length) return [];
  const rows = await sql<
    Array<{
      id: string;
      code: string;
      kind: LoaiCauHoi;
      level: string;
      stem: string;
      options: never;
      answer: unknown;
      explanation: string | null;
      citations: string[];
      image_uris: string[];
    }>
  >`
    SELECT id, code, kind, level, stem, options, answer, explanation, citations, image_uris
    FROM questions
    WHERE authoring_job_id = ANY(${ids}::uuid[]) AND status = 'cho_duyet'
    ORDER BY (kind = 'tu_luan'), level, created_at
    LIMIT 200`;
  return rows.map((r) => ({
    question_id: r.id,
    code: r.code,
    kind: r.kind,
    level: r.level,
    de: deChoNguoiHoc(r),
    noi_dung: { answer: r.answer, explanation: r.explanation, citations: r.citations },
  }));
}

/** GET /v1/quan-tri/de-thi/:id/cau-cho-duyet — các câu AI sinh cho đề đang chờ duyệt. */
deThiRoute.get("/:id/cau-cho-duyet", async (c) => {
  await batBuocVaiTro(c, "quan_tri");
  const de = await layDeThi(idHopLe(c.req.param("id")));
  if (!de) throw notFound("Không tìm thấy đề thi.");
  return c.json({ items: await cauChoDuyetCuaDe(de) });
});

/**
 * POST /v1/quan-tri/de-thi/:id/sinh-tiep — chạy tiếp các việc AI của đề còn dở hoặc bị lỗi. Việc
 * đọc bản quét lỗi vì thiếu số ký hiệu thì gửi kèm `so_ky_hieu` (và `loai`) nhập tay.
 */
deThiRoute.post("/:id/sinh-tiep", async (c) => {
  await batBuocVaiTro(c, "quan_tri");
  const de = await layDeThi(idHopLe(c.req.param("id")));
  if (!de) throw notFound("Không tìm thấy đề thi.");
  const b = await parseBody(
    c,
    z.object({
      so_ky_hieu: z.string().trim().max(100).optional(),
      loai: z.string().trim().max(20).optional(),
    }),
  );
  return c.json({ da_chay: await sinhTiepDeThi(de, b) });
});

/**
 * POST /v1/quan-tri/de-thi/:id/duyet-xuat-ban — duyệt mọi câu AI sinh cho đề còn chờ duyệt rồi
 * xuất bản đề, thay cho việc duyệt từng câu ở ngân hàng rồi quay lại xuất bản.
 *
 * Không nới quy tắc nào: người gọi phải đủ vai trò duyệt câu hỏi, câu được duyệt qua đúng đường
 * chuyển trạng thái của ngân hàng (có nhật ký), và đề vẫn phải đủ câu đã duyệt mới xuất bản được.
 * Thiếu câu thì các câu vừa duyệt giữ nguyên là đã duyệt, đề ở lại bản nháp kèm lý do.
 */
deThiRoute.post("/:id/duyet-xuat-ban", async (c) => {
  const p = await batBuocVaiTro(c, "quan_tri");
  if (!atLeast(p.role, vaiTroDuyet())) throw new KhongDuQuyen(vaiTroDuyet());
  const de = await layDeThi(idHopLe(c.req.param("id")));
  if (!de) throw notFound("Không tìm thấy đề thi.");
  if (de.status === "xuat_ban") throw conflict("Đề thi đã xuất bản.");
  const tienDo = await tienDoSinhDe(de);
  if (tienDo?.dang_chay) throw conflict("AI còn đang sinh câu hỏi cho đề. Hãy chờ xong rồi duyệt.");

  const choDuyet = await sql<Array<{ id: string }>>`
    SELECT id FROM questions
    WHERE authoring_job_id = ANY(${de.authoring_job_ids ?? []}::uuid[]) AND status = 'cho_duyet'`;
  const daDuyet = choDuyet.length
    ? await chuyenTrangThaiCauHoiDb(
        choDuyet.map((q) => q.id),
        ["cho_duyet"],
        "da_duyet",
        "duyet",
        p.email,
      )
    : [];
  const loi = await loiMaTran(de);
  if (loi.length) {
    throw badRequest(
      `Đã duyệt ${daDuyet.length} câu nhưng chưa xuất bản được: ma trận chưa đủ câu đã duyệt.`,
      { loi, da_duyet: daDuyet.length },
    );
  }
  return c.json({ item: await doiTrangThaiDeThi(de.id, "xuat_ban", p.email), da_duyet: daDuyet.length });
});

/**
 * POST /v1/quan-tri/de-thi — tạo đề ở trạng thái nháp. Ma trận chưa đủ câu vẫn lưu được (trả
 * `canh_bao`), vì ngân hàng có thể đang được bổ sung; chỉ khi xuất bản mới bắt buộc đủ.
 */
deThiRoute.post("/", async (c) => {
  const p = await batBuocVaiTro(c, "quan_tri");
  const d = chuanHoa(await parseBody(c, deThiSchema));
  const item = await taoDeThi(d, p.email);
  return c.json({ item, canh_bao: await loiMaTran(item) }, 201);
});

/** PUT /v1/quan-tri/de-thi/:id — đề nháp sửa toàn bộ; đề đã xuất bản chỉ sửa tên và mô tả. */
deThiRoute.put("/:id", async (c) => {
  const p = await batBuocVaiTro(c, "quan_tri");
  const id = idHopLe(c.req.param("id"));
  const cu = await layDeThi(id);
  if (!cu) throw notFound("Không tìm thấy đề thi.");
  const body = await parseBody(c, deThiSchema);
  try {
    const item =
      cu.status === "nhap"
        ? await suaDeThi(id, chuanHoa(body), p.email)
        : await suaTenDeThi(id, body.title, body.description ?? null, p.email);
    return c.json({
      item,
      canh_bao: await loiMaTran(item),
      ...(cu.status !== "nhap"
        ? { ghi_chu: "Đề đã xuất bản: chỉ lưu tên và mô tả, cấu hình giữ nguyên." }
        : {}),
    });
  } catch (e) {
    doiLoi(e);
  }
});

/** POST /v1/quan-tri/de-thi/:id/xem-truoc — sinh thử một đề (kèm đáp án) để quản trị soát. */
deThiRoute.post("/:id/xem-truoc", async (c) => {
  await batBuocVaiTro(c, "quan_tri");
  const de = await layDeThi(idHopLe(c.req.param("id")));
  if (!de) throw notFound("Không tìm thấy đề thi.");
  const loi = await loiMaTran(de);
  if (loi.length) throw badRequest("Ma trận chưa sinh được đề.", { loi });
  try {
    const items = sinhDe({
      maTran: de.matrix,
      nguon: await nguonCauHoiChoMaTran(de.matrix),
      seed: `xem-truoc-${crypto.randomUUID()}`,
      tronCau: de.shuffle_questions,
      tronPhuongAn: de.shuffle_options,
    });
    return c.json({ items });
  } catch (e) {
    if (e instanceof LoiSinhDe) throw badRequest(e.message);
    throw e;
  }
});

const trangThaiSchema = z.object({ status: z.enum(["xuat_ban", "dong"]) });

/**
 * POST /v1/quan-tri/de-thi/:id/trang-thai — xuất bản (bắt buộc ma trận đủ câu) hoặc đóng.
 * Đề đã đóng mở lại được bằng cách xuất bản lần nữa; lượt đang làm dở vẫn nộp được.
 */
deThiRoute.post("/:id/trang-thai", async (c) => {
  const p = await batBuocVaiTro(c, "quan_tri");
  const id = idHopLe(c.req.param("id"));
  const { status } = await parseBody(c, trangThaiSchema);
  const de = await layDeThi(id);
  if (!de) throw notFound("Không tìm thấy đề thi.");
  if (de.status === status) throw conflict("Đề thi đã ở trạng thái này.");
  if (status === "xuat_ban") {
    const loi = await loiMaTran(de);
    if (loi.length) throw badRequest("Chưa xuất bản được: ma trận chưa đủ câu đã duyệt.", { loi });
  }
  return c.json({ item: await doiTrangThaiDeThi(id, status, p.email) });
});

/* ------------------------------------------------------------------ */
/* Giao bài                                                            */
/* ------------------------------------------------------------------ */

export const giaoBaiRoute = new Hono();

giaoBaiRoute.get("/", async (c) => {
  const p = await batBuocVaiTro(c, "lanh_dao");
  const q = parseQuery(c, z.object({ exam_id: uuid.optional() }));
  const phamVi = phamViCua(p);
  if (phamVi === "khong_co") return c.json({ items: [] });
  return c.json({ items: await danhSachGiaoBai({ phamVi, examId: q.exam_id }) });
});

const giaoBaiSchema = z
  .object({
    exam_id: uuid,
    unit_id: uuid.nullable().optional(),
    account_id: uuid.nullable().optional(),
    include_subunits: z.boolean().default(true),
    opens_at: z.coerce.date().optional(),
    due_at: z.coerce.date(),
    note: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((d) => Boolean(d.unit_id) !== Boolean(d.account_id), {
    message: "Chọn đúng một nơi nhận: một đơn vị hoặc một người.",
  });

/**
 * POST /v1/giao-bai — giao đề đã xuất bản cho một đơn vị hoặc một người. Cán bộ quản lý giao
 * ngoài cây đơn vị của mình nhận 403 ngoai_pham_vi.
 */
giaoBaiRoute.post("/", async (c) => {
  const p = await batBuocVaiTro(c, "lanh_dao");
  const body = await parseBody(c, giaoBaiSchema);
  const de = await layDeThi(body.exam_id);
  if (!de) throw notFound("Không tìm thấy đề thi.");
  if (de.status !== "xuat_ban") throw conflict("Chỉ giao được đề thi đã xuất bản và chưa đóng.");

  if (body.unit_id) {
    await batBuocPhamViDonVi(c, body.unit_id);
  } else {
    const nguoi = await layNguoiDung(body.account_id as string);
    if (!nguoi || !trongPhamVi(p, nguoi.unit_path)) {
      throw new NgoaiPhamVi("Người này nằm ngoài phạm vi quản lý của tài khoản đang đăng nhập.");
    }
  }
  const opensAt = body.opens_at ?? new Date();
  if (body.due_at <= opensAt) throw badRequest("Hạn làm bài phải sau thời điểm mở bài.");
  if (body.due_at <= new Date()) throw badRequest("Hạn làm bài phải ở tương lai.");

  const item = await taoGiaoBai(
    {
      exam_id: body.exam_id,
      unit_id: body.unit_id ?? null,
      account_id: body.account_id ?? null,
      include_subunits: body.include_subunits,
      opens_at: opensAt,
      due_at: body.due_at,
      note: body.note ?? null,
    },
    p.email,
    p.accountId ?? null,
  );
  return c.json({ item }, 201);
});

/** POST /v1/giao-bai/:id/huy — hủy bài giao trong phạm vi. Lượt đã nộp vẫn giữ để báo cáo. */
giaoBaiRoute.post("/:id/huy", async (c) => {
  const p = await batBuocVaiTro(c, "lanh_dao");
  const bai = await layGiaoBai(idHopLe(c.req.param("id")));
  if (!bai || !trongPhamVi(p, bai.unit_path ?? bai.account_unit_path)) {
    throw new NgoaiPhamVi("Bài giao này nằm ngoài phạm vi quản lý của tài khoản đang đăng nhập.");
  }
  try {
    await huyGiaoBai(bai.id, p.email);
  } catch (e) {
    doiLoi(e);
  }
  return c.json({ da_huy: true });
});
