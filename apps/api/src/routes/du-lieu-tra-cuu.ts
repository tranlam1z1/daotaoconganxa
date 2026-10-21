/**
 * API duyệt dữ liệu tra cứu trong ứng dụng (docs/PLAN.md GĐ-G0), gắn ở
 * /v1/quan-tri/du-lieu-tra-cuu/:loai với `loai` là muc-phat, bien-bao, quy-trinh, toc-do-toi-da (GĐ-G2),
 * luat-giay-to (GĐ-T1; lọc theo nhóm `nhom` từ GĐ-T11), tai-trong (GĐ-T12), bieu-mau (tệp tải lên của
 * trang "Quy trình, Biểu mẫu").
 *
 * Cùng quyền và cùng vòng đời với ngân hàng câu hỏi: `bien_tap` soạn, sửa, gửi duyệt, lưu trữ, khôi
 * phục dòng đã lưu trữ, xóa hẳn dòng chưa từng duyệt; vai trò
 * duyệt (NGAN_HANG_VAI_TRO_DUYET) duyệt và từ chối. Sửa dòng đã duyệt thì dòng về chờ duyệt, tăng
 * phiên bản, rời khỏi tra cứu nhanh và khỏi mọi tình huống trò chơi trỏ tới nó cho tới khi duyệt lại.
 */

import type { Role } from "@qdpl/auth";
import {
  CHU_DE_MUC_PHAT,
  chuyenTrangThai,
  type HanhDongDuyet,
  hauQuaSua,
  kiemTraLuatGiayTo,
  LOAI_QUA_TAI,
  LOAI_XE,
  LOAI_XE_TAI,
  laMaBienBao,
  maBienDungNhom,
  NHOM_BIEN_BAO,
  NHOM_LUAT,
  type NhomBienBao,
  PHAN_LOAI_XE,
  TEN_NHOM_BIEN_BAO,
  THAO_TAC_BIEN_BAO,
  TRANG_THAI_DUYET,
  TRUONG_KHOP_XE,
  trangThaiTruoc,
} from "@qdpl/dao-tao";
import {
  chuyenTrangThaiDuLieu,
  type DongDuLieuRow,
  type DuoiTepTaiLieu,
  danhSachDuLieuTraCuu,
  demChoDuyetMoiLoai,
  demDuLieuTheoTrangThai,
  dongDuLieuTraCuu,
  LOAI_CO_PHAN_LOAI,
  LOAI_DU_LIEU_TRA_CUU,
  LOAI_SOAN_DUOC,
  LOAI_TEP_TAI_LIEU,
  type LoaiCoPhanLoai,
  type LoaiDuLieuTraCuu,
  type LoaiSoanDuoc,
  lichSuDuyetDuLieu,
  phanLoaiTaiLieu,
  sangTrangThaiChung,
  suaDuLieuTraCuu,
  taoBienBao,
  taoBieuMau,
  taoDuLieuTraCuu,
  tenLichSuDuLieu,
  thayAnhBienBao,
  thayTepBieuMau,
  xoaDuLieuTraCuu,
} from "@qdpl/db";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { luuAnhBienBao, xoaAnhBienBaoMoCoi } from "../anh-bien-bao.ts";
import { batBuocVaiTro } from "../auth.ts";
import { badRequest, conflict, notFound, parseBody, parseQuery } from "../http.ts";
import { luuTepTaiLieu, traTepTaiLieu, xoaTepTaiLieu } from "../tep-tai-lieu.ts";
import { vaiTroDuyet } from "./ngan-hang.ts";

export const duLieuTraCuuRoute = new Hono();

const urn = z
  .string()
  .trim()
  .regex(/^vn:\S+$/, "Căn cứ phải là URN dạng vn:...");
const topic = z.string().uuid().nullish();
const ghiChu = z.string().trim().max(2000).nullish();
const ngay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có dạng YYYY-MM-DD.");

const mucPhat = z.object({
  behavior: z.string().trim().min(3).max(1000),
  group_name: z.string().trim().max(200).nullish(),
  fine_min: z.number().int().min(0),
  fine_max: z.number().int().min(0),
  point_deduction: z.number().int().min(0).max(12).nullish(),
  extra_penalties: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  citation_urn: urn,
  note: ghiChu,
  topic_id: topic,
});
const phatTuNhoHon = [
  (d: { fine_min: number; fine_max: number }) => d.fine_min <= d.fine_max,
  "Mức phạt từ phải nhỏ hơn hoặc bằng mức phạt đến.",
] as const;
const bienKhoang = z.enum(["[)", "[]", "(]", "()"]);
const LOAI_QUY_TRINH = z.enum(["vi_pham", "tai_nan"]);
/**
 * Trường của mức phạt ngoài nhóm sửa ban đầu: loại xe, từ khóa, khoảng tốc độ vượt, khung phần trăm quá
 * tải, hiệu lực. Ràng buộc giữa các trường kiểm ở `kiemDong`.
 */
const mucPhatThem = {
  vehicle: z.enum(LOAI_XE),
  keywords: z.array(z.string().trim().min(1).max(100)).max(30),
  speed_over_min: z.number().min(0).max(300).nullish(),
  speed_over_max: z.number().min(0).max(300).nullish(),
  speed_bounds: bienKhoang,
  qua_tai_loai: z.enum(LOAI_QUA_TAI).nullish(),
  qua_tai_tu: z.number().min(0).max(1000).nullish(),
  qua_tai_den: z.number().min(0).max(1000).nullish(),
  qua_tai_bien: bienKhoang,
  effective_from: ngay,
  effective_to: ngay.nullish(),
};

const bienBao = z.object({
  name: z.string().trim().min(2).max(300),
  meaning: z.string().trim().min(3).max(3000),
  citation_urn: urn,
  // Cung đường biển báo (GĐ-G8): thao tác đúng và giải thích; bỏ trống thì biển không vào trò.
  reaction: z.enum(THAO_TAC_BIEN_BAO).nullish(),
  reaction_note: z.string().trim().max(500).nullish(),
  note: ghiChu,
  topic_id: topic,
});
const coGiaiThich = [
  (d: { reaction?: string | null; reaction_note?: string | null }) =>
    !d.reaction || (d.reaction_note ?? "").length >= 3,
  "Có phản ứng thì cần giải thích ngắn.",
] as const;

const luatGiayTo = z.object({
  name: z.string().trim().min(5).max(300),
  explanation: z.string().trim().min(10).max(2000),
  citation_urn: urn,
  violation_code: z.string().trim().min(1).max(80).nullish(),
  note: ghiChu,
  topic_id: topic,
});
/**
 * Trường của luật giấy tờ ngoài nhóm sửa ban đầu (GĐ-T1, T11, T13): nhóm, kiểu kiểm, phần được kiểm,
 * loại xe, tham số, hiệu lực. Kiểu kiểm, phần và tham số hợp nhau hay không do `kiemTraLuatGiayTo` kiểm
 * ở `kiemDong`; tham số ngoài danh sách dưới đây bị bỏ.
 */
const luatThem = {
  nhom: z.enum(NHOM_LUAT),
  check_kind: z.string().trim().min(1).max(40),
  doc_kind: z.string().trim().min(1).max(40).nullish(),
  vehicle_classes: z.array(z.enum(PHAN_LOAI_XE)).max(10),
  params: z.object({
    truong: z.enum(TRUONG_KHOP_XE).optional(),
    hang: z.array(z.string().trim().min(1).max(5)).max(20).optional(),
    do_mo_toi_da: z.number().int().optional(),
    toi_da_phut: z.number().int().optional(),
    nghi_toi_thieu_phut: z.number().int().optional(),
    so_tre: z.number().int().optional(),
    bang_nguoi: z.number().int().optional(),
    lam_tron: z.enum(["len", "xuong"]).optional(),
  }),
  effective_from: ngay,
  effective_to: ngay.nullish(),
};

const tocDoToiDa = z.object({
  vehicle_class: z.string().trim().min(2).max(200),
  violation_vehicle: z.enum(LOAI_XE),
  road_type: z.string().trim().min(2).max(80),
  road_type_name: z.string().trim().min(2).max(200),
  max_speed: z.number().int().min(5).max(200),
  citation_urn: urn,
  effective_from: ngay,
  effective_to: ngay.nullish(),
  note: ghiChu,
  topic_id: topic,
});
// Giới hạn tải trọng (GĐ-T12). Ràng buộc giữa loại, loại xe và cụm trục kiểm ở `kiemDong`.
const taiTrong = z.object({
  kind: z.enum(["tong", "truc_don", "cum_truc"]),
  vehicle_class: z.enum(LOAI_XE_TAI).nullish(),
  group_axles: z.union([z.literal(2), z.literal(3)]).nullish(),
  spacing_from_cm: z.number().int().min(0).max(5000).nullish(),
  spacing_to_cm: z.number().int().min(1).max(5000).nullish(),
  limit_kg: z.number().int().min(1).max(200_000),
  name: z.string().trim().min(3).max(300),
  citation_urn: urn,
  effective_from: ngay,
  effective_to: ngay.nullish(),
  note: ghiChu,
  topic_id: topic,
});

/**
 * Trường mở sửa sau các trường ban đầu: yêu cầu sửa không gửi thì giữ giá trị của dòng đang có, nên
 * yêu cầu chỉ gửi con số và căn cứ như trước vẫn dùng được. Chủ đề cũng giữ như vậy ở mọi loại.
 */
const TRUONG_GIU: Partial<Record<LoaiDuLieuTraCuu, readonly string[]>> = {
  "muc-phat": Object.keys(mucPhatThem),
  "bien-bao": ["group_name"],
  "luat-giay-to": Object.keys(luatThem),
  "quy-trinh": ["kind"],
  "toc-do-toi-da": [
    "vehicle_class",
    "violation_vehicle",
    "road_type",
    "road_type_name",
    "effective_from",
    "effective_to",
  ],
  "tai-trong": [
    "kind",
    "vehicle_class",
    "group_axles",
    "spacing_from_cm",
    "spacing_to_cm",
    "name",
    "effective_from",
    "effective_to",
  ],
};

const SCHEMA_SUA = {
  "muc-phat": mucPhat.extend(z.object(mucPhatThem).partial().shape).refine(...phatTuNhoHon),
  "bien-bao": bienBao.extend({ group_name: z.enum(NHOM_BIEN_BAO).optional() }).refine(...coGiaiThich),
  "toc-do-toi-da": tocDoToiDa.partial({
    vehicle_class: true,
    violation_vehicle: true,
    road_type: true,
    road_type_name: true,
    effective_from: true,
  }),
  "tai-trong": taiTrong.partial({ kind: true, name: true, effective_from: true }),
  // `hang` là cách gửi cũ của danh sách hạng (luật hạng giấy phép); cách mới gửi cả `params`.
  "luat-giay-to": luatGiayTo.extend(z.object(luatThem).partial().shape).extend({
    hang: z.array(z.string().trim().min(1).max(5)).min(1).max(20).nullish(),
  }),
  "quy-trinh": quyTrinhSchema().extend({ kind: LOAI_QUY_TRINH.optional() }),
  // Biểu mẫu: tệp thay ở POST /bieu-mau/:ma/tep, phân loại ở PUT /:loai/:ma/phan-loai.
  "bieu-mau": z.object({
    title: z.string().trim().min(3).max(300),
    summary: z.string().trim().max(2000).nullish(),
    kind: z.enum(LOAI_TEP_TAI_LIEU),
    note: ghiChu,
    topic_id: topic,
  }),
} as const;

/** Phương tiện và loại vi phạm của quy trình, biểu mẫu; bỏ trống là không gắn. */
const phanLoai = {
  vehicle: z.enum(LOAI_XE, { message: "Phương tiện không hợp lệ." }).nullish(),
  group_name: z.enum(CHU_DE_MUC_PHAT, { message: "Loại vi phạm không có trong danh sách." }).nullish(),
};

function quyTrinhSchema() {
  return z.object({
    title: z.string().trim().min(3).max(300),
    summary: z.string().trim().max(2000).nullish(),
    steps: z
      .array(
        z.object({
          tieu_de: z.string().trim().min(2).max(300),
          mo_ta: z.string().trim().min(2).max(3000),
          can_cu: urn.nullish(),
        }),
      )
      .min(1)
      .max(40),
    note: ghiChu,
    topic_id: topic,
  });
}

/** Mã dòng soạn mới: chữ thường không dấu, số, nối bằng gạch ngang, như mã trong tệp nạp. */
const maMoi = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Mã chỉ gồm chữ thường không dấu, số và dấu gạch ngang.");
const guiDuyet = z.boolean().default(false);

const SCHEMA_TAO = {
  "muc-phat": mucPhat
    .extend({
      code: maMoi,
      ...mucPhatThem,
      keywords: mucPhatThem.keywords.default([]),
      speed_bounds: bienKhoang.default("[)"),
      qua_tai_bien: bienKhoang.default("(]"),
      gui_duyet: guiDuyet,
    })
    .refine(...phatTuNhoHon),
  "quy-trinh": quyTrinhSchema().extend({
    code: maMoi,
    kind: LOAI_QUY_TRINH,
    ...phanLoai,
    gui_duyet: guiDuyet,
  }),
  "toc-do-toi-da": tocDoToiDa.extend({ code: maMoi, gui_duyet: guiDuyet }),
  "luat-giay-to": luatGiayTo.extend({ code: maMoi, ...luatThem, gui_duyet: guiDuyet }),
  "tai-trong": taiTrong.extend({ code: maMoi, gui_duyet: guiDuyet }),
} as const;

/** Trường bỏ trống lúc soạn mới thì ghi NULL. */
const NULL_KHI_TAO: Record<LoaiSoanDuoc, readonly string[]> = {
  "muc-phat": [
    "note",
    "topic_id",
    "group_name",
    "point_deduction",
    "speed_over_min",
    "speed_over_max",
    "qua_tai_loai",
    "qua_tai_tu",
    "qua_tai_den",
    "effective_to",
  ],
  "quy-trinh": ["note", "topic_id", "summary", "vehicle", "group_name"],
  "toc-do-toi-da": ["note", "topic_id", "effective_to"],
  "luat-giay-to": ["note", "topic_id", "effective_to", "doc_kind", "violation_code"],
  "tai-trong": [
    "note",
    "topic_id",
    "effective_to",
    "vehicle_class",
    "group_axles",
    "spacing_from_cm",
    "spacing_to_cm",
  ],
};

/**
 * Ràng buộc giữa các trường mà CSDL cũng kiểm, báo ở đây để người soạn đọc được lý do. Tải trọng không
 * phải cụm trục thì bỏ số trục và khoảng cách trục; mức phạt không theo quá tải thì bỏ phần trăm quá tải.
 */
function kiemDong(loai: LoaiDuLieuTraCuu, d: Record<string, unknown>) {
  if (d.effective_to && String(d.effective_to) <= String(d.effective_from))
    throw badRequest("Hiệu lực đến phải sau hiệu lực từ.");
  if (loai === "muc-phat") {
    // Cột numeric đọc từ CSDL là chuỗi: so bằng số.
    const nho = (a: unknown, b: unknown) => a != null && b != null && Number(a) >= Number(b);
    if (d.speed_over_min == null && d.speed_over_max != null)
      throw badRequest("Có tốc độ vượt đến thì cần tốc độ vượt từ.");
    if (nho(d.speed_over_min, d.speed_over_max))
      throw badRequest("Tốc độ vượt từ phải nhỏ hơn tốc độ vượt đến.");
    if (!d.qua_tai_loai) d.qua_tai_tu = d.qua_tai_den = null;
    else if (d.qua_tai_tu == null) throw badRequest("Khung quá tải cần phần trăm vượt từ.");
    else if (nho(d.qua_tai_tu, d.qua_tai_den))
      throw badRequest("Phần trăm quá tải từ phải nhỏ hơn phần trăm quá tải đến.");
  }
  if (loai === "luat-giay-to") {
    if (d.hang != null && d.check_kind === "hang_gplx") d.params = { ...(d.params as object), hang: d.hang };
    delete d.hang;
    // Cùng bộ kiểm với lệnh nạp tệp: kiểu kiểm, phần được kiểm và tham số phải hợp nhau theo nhóm.
    const loi = kiemTraLuatGiayTo({
      nhom: d.nhom,
      kiem: d.check_kind,
      giay_to: d.doc_kind ?? null,
      phan: d.doc_kind,
      phan_loai: d.vehicle_classes,
      tham_so: d.params,
      ten: d.name,
      giai_thich: d.explanation,
      can_cu: d.citation_urn,
    } as never);
    if (loi.length) throw badRequest(loi.join(" "));
  }
  if (loai !== "tai-trong") return;
  if (d.kind === "tong" && !d.vehicle_class) throw badRequest("Tổng trọng lượng cần chọn loại xe.");
  if (d.kind !== "cum_truc") {
    d.group_axles = d.spacing_from_cm = d.spacing_to_cm = null;
    return;
  }
  if (d.group_axles == null || d.spacing_from_cm == null)
    throw badRequest("Cụm trục cần số trục trong cụm và khoảng cách trục từ.");
  if (d.spacing_to_cm != null && Number(d.spacing_to_cm) <= Number(d.spacing_from_cm))
    throw badRequest("Khoảng cách trục đến phải lớn hơn khoảng cách trục từ.");
}

/** Giá trị đang có của một cột, ngày về dạng YYYY-MM-DD như yêu cầu gửi lên. */
const giaTriCu = (cu: DongDuLieuRow, k: string) =>
  cu[k] instanceof Date ? (cu[k] as Date).toISOString().slice(0, 10) : cu[k];

/** CSDL báo trùng khóa duy nhất: tốc độ tối đa không có hai dòng cùng loại xe, loại đường, ngày hiệu lực. */
const TRUNG_DONG = "Đã có dòng cùng loại xe, loại đường và ngày hiệu lực từ.";
function nemTrungDong(e: unknown): never {
  if ((e as { code?: string } | null)?.code === "23505") throw conflict(TRUNG_DONG);
  throw e;
}

/** Trường chữ của form multipart khi tải biểu mẫu lên; trường trống coi như không gửi. */
const bieuMauMoi = SCHEMA_SUA["bieu-mau"].extend({ code: maMoi, ...phanLoai, gui_duyet: z.boolean() });

/** Trường chữ của form multipart khi soạn biển báo mới kèm ảnh. Mã theo dạng mã biển (P.102). */
const bienBaoMoi = bienBao
  .extend({
    code: z.string().trim().refine(laMaBienBao, "Mã biển không đúng dạng (ví dụ P.102, W.207a)."),
    group_name: z.enum(NHOM_BIEN_BAO),
    gui_duyet: z.boolean(),
  })
  .refine(...coGiaiThich);

/** Mã biển đúng dạng thì chữ cái đầu phải thuộc nhóm (P là biển cấm, W là biển nguy hiểm…). */
function kiemNhomBien(code: string, nhom: unknown) {
  if (laMaBienBao(code) && !maBienDungNhom(code, nhom as NhomBienBao))
    throw badRequest(`Mã ${code} không thuộc nhóm "${TEN_NHOM_BIEN_BAO[nhom as NhomBienBao]}".`);
}

const TEN_HANH_DONG: Record<HanhDongDuyet, string> = {
  gui_duyet: "gửi duyệt",
  duyet: "duyệt",
  tu_choi: "từ chối",
  luu_tru: "lưu trữ",
};

function loaiTu(raw: string): LoaiDuLieuTraCuu {
  if (!(LOAI_DU_LIEU_TRA_CUU as readonly string[]).includes(raw))
    throw notFound("Không có loại dữ liệu này.");
  return raw as LoaiDuLieuTraCuu;
}

const DA_SUA = "Dòng dữ liệu đã được người khác sửa. Hãy tải lại trang rồi sửa tiếp.";

async function layDong(loai: LoaiDuLieuTraCuu, ma: string) {
  const d = await dongDuLieuTraCuu(loai, ma);
  if (!d) throw notFound("Không có dòng dữ liệu này.");
  return d;
}

duLieuTraCuuRoute.get("/:loai", async (c) => {
  await batBuocVaiTro(c, "bien_tap");
  const loai = loaiTu(c.req.param("loai"));
  const q = parseQuery(
    c,
    z.object({
      status: z.enum(TRANG_THAI_DUYET).optional(),
      q: z.string().trim().max(200).optional(),
      // Nhóm luật giấy tờ (GĐ-T11, GĐ-T13): giay_to_nguoi_lai, ho_so_phat_nguoi hoặc van_tai_khach.
      nhom: z.enum(NHOM_LUAT).optional(),
      trang: z.coerce.number().int().min(1).default(1),
      co: z.coerce.number().int().min(1).max(500).default(500),
    }),
  );
  const [ds, dem, demLoai] = await Promise.all([
    danhSachDuLieuTraCuu(loai, { ...q, limit: q.co, offset: (q.trang - 1) * q.co }),
    demDuLieuTheoTrangThai(loai, q.nhom),
    demChoDuyetMoiLoai(),
  ]);
  return c.json({
    items: ds.items.map((d) => ({ ...d, trang_thai: sangTrangThaiChung(d.status) })),
    tong: ds.tong,
    trang: q.trang,
    co: q.co,
    dem,
    // Số dòng chờ duyệt của mọi loại, không theo bộ lọc: hiện trên các tab loại.
    dem_cho_duyet: demLoai,
    vai_tro_duyet: vaiTroDuyet(),
  });
});

/** Đọc form multipart: trường chữ đã cắt khoảng trắng (trống thì bỏ), và tệp ở trường `tep`. */
async function docFormCoTep(c: Context) {
  const form = await c.req.raw.formData().catch(() => null);
  if (!form) throw badRequest("Yêu cầu phải là form multipart có trường tệp.");
  const chu: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string" && v.trim()) chu[k] = v.trim();
  return { chu, tep: form.get("tep") };
}

function kiemForm<S extends z.ZodType>(schema: S, du: unknown): z.infer<S> {
  const r = schema.safeParse(du);
  if (!r.success) throw badRequest(r.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.", r.error.issues);
  return r.data;
}

/**
 * Tải biểu mẫu mới lên (form multipart: tệp ở `tep`, còn lại là trường chữ). Khai trước POST /:loai
 * để không rơi vào luồng soạn bằng JSON. Dòng vào bản nháp, hoặc chờ duyệt khi `gui_duyet` = "1".
 */
duLieuTraCuuRoute.post("/bieu-mau", async (c) => {
  const p = await batBuocVaiTro(c, "bien_tap");
  const { chu, tep } = await docFormCoTep(c);
  const b = kiemForm(bieuMauMoi, { ...chu, gui_duyet: chu.gui_duyet === "1" });
  if (await dongDuLieuTraCuu("bieu-mau", b.code)) throw conflict(`Mã "${b.code}" đã có. Chọn mã khác.`);
  const daLuu = await luuTepTaiLieu(b.code, tep);
  const daCo = await taoBieuMau(
    {
      code: b.code,
      kind: b.kind,
      title: b.title,
      summary: b.summary ?? null,
      vehicle: b.vehicle ?? null,
      group_name: b.group_name ?? null,
      note: b.note ?? null,
      topic_id: b.topic_id ?? null,
      tep: daLuu,
    },
    b.gui_duyet ? "cho_duyet" : "nhap",
    p.email,
  );
  if (!daCo) throw conflict(`Mã "${b.code}" đã có. Chọn mã khác.`);
  const d = (await dongDuLieuTraCuu("bieu-mau", b.code))!;
  return c.json({ ...d, trang_thai: sangTrangThaiChung(d.status) }, 201);
});

/**
 * Soạn biển báo mới (form multipart: ảnh biển ở `tep`, còn lại là trường chữ). Khai trước POST /:loai
 * như biểu mẫu. Biển vào bản nháp, hoặc chờ duyệt khi `gui_duyet` = "1".
 */
duLieuTraCuuRoute.post("/bien-bao", async (c) => {
  const p = await batBuocVaiTro(c, "bien_tap");
  const { chu, tep } = await docFormCoTep(c);
  const b = kiemForm(bienBaoMoi, { ...chu, gui_duyet: chu.gui_duyet === "1" });
  kiemNhomBien(b.code, b.group_name);
  if (await dongDuLieuTraCuu("bien-bao", b.code)) throw conflict(`Mã "${b.code}" đã có. Chọn mã khác.`);
  const anh = await luuAnhBienBao(b.code, tep);
  const daCo = await taoBienBao(
    {
      code: b.code,
      group_name: b.group_name,
      name: b.name,
      meaning: b.meaning,
      image_uri: anh,
      citation_urn: b.citation_urn,
      reaction: b.reaction ?? null,
      reaction_note: b.reaction ? (b.reaction_note ?? null) : null,
      note: b.note ?? null,
      topic_id: b.topic_id ?? null,
    },
    b.gui_duyet ? "cho_duyet" : "nhap",
    p.email,
  );
  if (!daCo) throw conflict(`Mã "${b.code}" đã có. Chọn mã khác.`);
  const d = (await dongDuLieuTraCuu("bien-bao", b.code))!;
  return c.json({ ...d, trang_thai: sangTrangThaiChung(d.status) }, 201);
});

/**
 * Thay ảnh của một biển báo (form multipart: `tep`, `version`). Ảnh là nội dung được duyệt: biển đã
 * duyệt về chờ duyệt và tăng phiên bản, như khi sửa dòng khác.
 */
duLieuTraCuuRoute.post("/bien-bao/:ma/anh", async (c) => {
  const p = await batBuocVaiTro(c, "bien_tap");
  const cu = await layDong("bien-bao", c.req.param("ma"));
  const { chu, tep } = await docFormCoTep(c);
  if (Number(chu.version) !== cu.version) throw conflict(DA_SUA);
  const sau = hauQuaSua(sangTrangThaiChung(cu.status), cu.version);
  if (!sau) throw conflict("Biển báo đã ngừng dùng, không thay ảnh được.");
  const anh = await luuAnhBienBao(cu.code, tep);
  if (!(await thayAnhBienBao(cu.code, anh, cu.version, sau, p.email))) throw conflict(DA_SUA);
  await xoaAnhBienBaoMoCoi(cu.image_uri as string);
  const d = (await dongDuLieuTraCuu("bien-bao", cu.code))!;
  return c.json({ ...d, trang_thai: sangTrangThaiChung(d.status) });
});

/**
 * Thay tệp của một biểu mẫu (form multipart: `tep`, `version`). Tệp là nội dung được duyệt: biểu mẫu
 * đã duyệt về chờ duyệt và tăng phiên bản, như khi sửa dòng khác.
 */
duLieuTraCuuRoute.post("/bieu-mau/:ma/tep", async (c) => {
  const p = await batBuocVaiTro(c, "bien_tap");
  const cu = await layDong("bieu-mau", c.req.param("ma"));
  const { chu, tep } = await docFormCoTep(c);
  if (Number(chu.version) !== cu.version) throw conflict(DA_SUA);
  const sau = hauQuaSua(sangTrangThaiChung(cu.status), cu.version);
  if (!sau) throw conflict("Biểu mẫu đã ngừng dùng, không thay tệp được.");
  const daLuu = await luuTepTaiLieu(cu.code, tep);
  if (!(await thayTepBieuMau(cu.code, daLuu, cu.version, sau, p.email))) throw conflict(DA_SUA);
  if (cu.file_uri !== daLuu.uri) await xoaTepTaiLieu(cu.file_uri as string);
  const d = (await dongDuLieuTraCuu("bieu-mau", cu.code))!;
  return c.json({ ...d, trang_thai: sangTrangThaiChung(d.status) });
});

/** Tệp của một biểu mẫu ở mọi trạng thái, để người soạn và người duyệt xem trước khi duyệt. */
duLieuTraCuuRoute.get("/bieu-mau/:ma/tep", async (c) => {
  await batBuocVaiTro(c, "bien_tap");
  const d = await layDong("bieu-mau", c.req.param("ma"));
  return traTepTaiLieu(
    {
      uri: String(d.file_uri),
      ten: String(d.file_name),
      duoi: d.file_ext as DuoiTepTaiLieu,
      kichThuoc: Number(d.file_size),
    },
    c.req.query("tai") === "1",
  );
});

/**
 * Đặt phương tiện, loại vi phạm và ghim của một quy trình hoặc biểu mẫu. Không đổi trạng thái hay
 * phiên bản: đây là phân loại để lọc và xếp mục "phổ biến", không phải nội dung được duyệt.
 */
duLieuTraCuuRoute.put("/:loai/:ma/phan-loai", async (c) => {
  const p = await batBuocVaiTro(c, "bien_tap");
  const loai = loaiTu(c.req.param("loai"));
  if (!(LOAI_CO_PHAN_LOAI as readonly string[]).includes(loai))
    throw badRequest("Loại dữ liệu này không có phân loại.");
  const cu = await layDong(loai, c.req.param("ma"));
  const b = await parseBody(c, z.object({ ...phanLoai, pinned: z.boolean().default(false) }));
  await phanLoaiTaiLieu(
    loai as LoaiCoPhanLoai,
    cu.code,
    { vehicle: b.vehicle ?? null, group_name: b.group_name ?? null, pinned: b.pinned },
    p.email,
  );
  const d = (await dongDuLieuTraCuu(loai, cu.code))!;
  return c.json({ ...d, trang_thai: sangTrangThaiChung(d.status) });
});

// Soạn dòng mới (mức phạt, quy trình, tốc độ tối đa, tải trọng). Dòng vào bản nháp, hoặc chờ duyệt khi `gui_duyet`.
duLieuTraCuuRoute.post("/:loai", async (c) => {
  const p = await batBuocVaiTro(c, "bien_tap");
  const loai = loaiTu(c.req.param("loai"));
  if (!(LOAI_SOAN_DUOC as readonly string[]).includes(loai))
    throw badRequest("Loại dữ liệu này chưa soạn được trong ứng dụng; thêm qua tệp nạp.");
  const { gui_duyet, ...b } = await parseBody(c, SCHEMA_TAO[loai as LoaiSoanDuoc]);
  const tho = b as Record<string, unknown>;
  const du = {
    ...tho,
    ...Object.fromEntries(NULL_KHI_TAO[loai as LoaiSoanDuoc].map((k) => [k, tho[k] ?? null])),
  };
  kiemDong(loai, du);
  const daCo = await taoDuLieuTraCuu(
    loai as LoaiSoanDuoc,
    du as never,
    gui_duyet ? "cho_duyet" : "nhap",
    p.email,
  ).catch(nemTrungDong);
  if (!daCo) throw conflict(`Mã "${b.code}" đã có. Chọn mã khác.`);
  const d = (await dongDuLieuTraCuu(loai, b.code))!;
  return c.json({ ...d, trang_thai: sangTrangThaiChung(d.status) }, 201);
});

duLieuTraCuuRoute.get("/:loai/:ma", async (c) => {
  await batBuocVaiTro(c, "bien_tap");
  const loai = loaiTu(c.req.param("loai"));
  const d = await layDong(loai, c.req.param("ma"));
  return c.json({
    ...d,
    trang_thai: sangTrangThaiChung(d.status),
    lich_su: await lichSuDuyetDuLieu(tenLichSuDuLieu(loai), d.code),
  });
});

duLieuTraCuuRoute.put("/:loai/:ma", async (c) => {
  const p = await batBuocVaiTro(c, "bien_tap");
  const loai = loaiTu(c.req.param("loai"));
  const cu = await layDong(loai, c.req.param("ma"));
  const b = await parseBody(c, SCHEMA_SUA[loai].and(z.object({ version: z.number().int().min(1) })));
  if (b.version !== cu.version) throw conflict(DA_SUA);
  const sau = hauQuaSua(sangTrangThaiChung(cu.status), cu.version);
  if (!sau) throw conflict("Dòng dữ liệu đã ngừng dùng, không sửa được.");
  const { version: _v, ...du } = b as Record<string, unknown>;
  if (loai === "bien-bao" && du.group_name !== undefined) kiemNhomBien(cu.code, du.group_name);
  for (const k of TRUONG_GIU[loai] ?? []) if (du[k] === undefined) du[k] = giaTriCu(cu, k);
  kiemDong(loai, du);
  const chuan = {
    ...du,
    note: du.note ?? null,
    topic_id: du.topic_id === undefined ? cu.topic_id : du.topic_id,
    ...(loai === "muc-phat"
      ? { group_name: du.group_name ?? null, point_deduction: du.point_deduction ?? null }
      : {}),
    ...(loai === "quy-trinh" || loai === "bieu-mau" ? { summary: du.summary ?? null } : {}),
    ...(loai === "luat-giay-to" ? { violation_code: du.violation_code ?? null } : {}),
    ...(loai === "bien-bao"
      ? { reaction: du.reaction ?? null, reaction_note: du.reaction ? (du.reaction_note ?? null) : null }
      : {}),
  };
  if (!(await suaDuLieuTraCuu(loai, cu.code, chuan as never, cu.version, sau, p.email).catch(nemTrungDong)))
    throw conflict(DA_SUA);
  const d = (await dongDuLieuTraCuu(loai, cu.code))!;
  return c.json({ ...d, trang_thai: sangTrangThaiChung(d.status) });
});

// Xóa hẳn dòng chưa từng duyệt (nháp, bị từ chối). Dòng đã từng duyệt chỉ ngừng dùng được.
duLieuTraCuuRoute.delete("/:loai/:ma", async (c) => {
  const p = await batBuocVaiTro(c, "bien_tap");
  const loai = loaiTu(c.req.param("loai"));
  const cu = await layDong(loai, c.req.param("ma"));
  const da = await xoaDuLieuTraCuu(loai, cu.code, p.email);
  if (!da)
    throw conflict("Chỉ xóa được dòng nháp hoặc bị từ chối chưa từng được duyệt. Dòng khác thì ngừng dùng.");
  if (loai === "bieu-mau") await xoaTepTaiLieu(da.file_uri as string);
  if (loai === "bien-bao") await xoaAnhBienBaoMoCoi(da.image_uri as string);
  return c.json({ da_xoa: da.code });
});

// Đưa dòng đã ngừng dùng về bản nháp để sửa và gửi duyệt lại.
duLieuTraCuuRoute.post("/:loai/:ma/khoi-phuc", async (c) => {
  const p = await batBuocVaiTro(c, "bien_tap");
  const loai = loaiTu(c.req.param("loai"));
  const cu = await layDong(loai, c.req.param("ma"));
  const rows = await chuyenTrangThaiDuLieu({
    loai,
    codes: [cu.code],
    tu: ["luu_tru"],
    den: "nhap",
    hanhDong: "khoi_phuc",
    actor: p.email,
  });
  if (!rows.length) throw conflict("Chỉ khôi phục được dòng đã ngừng dùng.");
  const d = (await dongDuLieuTraCuu(loai, cu.code))!;
  return c.json({ ...d, trang_thai: sangTrangThaiChung(d.status) });
});

function vaiTroCho(hd: HanhDongDuyet): Role {
  return hd === "duyet" || hd === "tu_choi" ? vaiTroDuyet() : "bien_tap";
}

function routeHanhDong(duongDan: string, hd: HanhDongDuyet) {
  duLieuTraCuuRoute.post(`/:loai/:ma/${duongDan}`, async (c) => {
    const p = await batBuocVaiTro(c, vaiTroCho(hd));
    const loai = loaiTu(c.req.param("loai"));
    const cu = await layDong(loai, c.req.param("ma"));
    let ly_do: string | null = null;
    if (hd === "tu_choi")
      ly_do = (await parseBody(c, z.object({ ly_do: z.string().trim().min(3).max(1000) }))).ly_do;
    const den = chuyenTrangThai(sangTrangThaiChung(cu.status), hd);
    if (!den) throw conflict(`Không ${TEN_HANH_DONG[hd]} được dòng đang ở trạng thái "${cu.status}".`);
    const rows = await chuyenTrangThaiDuLieu({
      loai,
      codes: [cu.code],
      tu: trangThaiTruoc(hd),
      den,
      hanhDong: hd,
      actor: p.email,
      ghiChu: ly_do,
    });
    if (!rows.length) throw conflict("Trạng thái dòng dữ liệu vừa thay đổi. Hãy tải lại trang.");
    const d = (await dongDuLieuTraCuu(loai, cu.code))!;
    return c.json({ ...d, trang_thai: sangTrangThaiChung(d.status) });
  });
}

routeHanhDong("gui-duyet", "gui_duyet");
routeHanhDong("duyet", "duyet");
routeHanhDong("tu-choi", "tu_choi");
routeHanhDong("luu-tru", "luu_tru");

duLieuTraCuuRoute.post("/:loai/duyet-hang-loat", async (c) => {
  const p = await batBuocVaiTro(c, vaiTroDuyet());
  const loai = loaiTu(c.req.param("loai"));
  const b = await parseBody(c, z.object({ ma: z.array(z.string().trim().min(1).max(80)).min(1).max(500) }));
  const ma = [...new Set(b.ma)];
  if (!ma.length) throw badRequest("Chưa chọn dòng nào.");
  const rows = await chuyenTrangThaiDuLieu({
    loai,
    codes: ma,
    tu: trangThaiTruoc("duyet"),
    den: "da_duyet",
    hanhDong: "duyet",
    actor: p.email,
  });
  const da = new Set(rows.map((r) => r.code));
  return c.json({ da_duyet: rows.length, bo_qua: ma.filter((m) => !da.has(m)) });
});
