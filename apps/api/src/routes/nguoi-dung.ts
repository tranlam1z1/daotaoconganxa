import { danhSachNhomHocTapSchema } from "../nhom-hoc-tap.ts";
/**
 * Quản lý đơn vị và người dùng (docs/PLAN.md GĐ2).
 *
 * - Xem: từ `quan_ly` trở lên, chỉ trong cây đơn vị của mình (`quan_tri` xem tất cả).
 * - Tạo, sửa, khóa, đặt lại mật khẩu, nhập Excel: chỉ `quan_tri` (PRD: Quản trị viên quản lý
 *   người dùng, đơn vị, phân quyền).
 * - Xác minh cán bộ tự đăng ký (migration 0064): `quan_ly` trở lên, với tài khoản khai đơn vị trong
 *   cây đơn vị của mình và chỉ gắn vào đơn vị trong cây đó.
 * Mọi thay đổi ghi `audit_log` (làm trong packages/db).
 */

import {
  bamMatKhau,
  chuanHoaTenDangNhap,
  datLaiMatKhau,
  LoiMatKhau,
  loiTenDangNhap,
  ROLES,
  taoMatKhauTam,
  trongPhamVi,
} from "@qdpl/auth";
import {
  COT_NHAP_NGUOI_DUNG,
  danhSachDonVi,
  danhSachNguoiDung,
  demChoXacMinh,
  docBangExcel,
  duyetTaiKhoan,
  LoiNghiepVu,
  LoiTepExcel,
  layDonVi,
  layNguoiDung,
  nhapNguoiDung,
  suaDonVi,
  suaNguoiDung,
  taoDonVi,
  taoMauNhapNguoiDung,
  taoNguoiDung,
  tuChoiXacMinh,
} from "@qdpl/db";
import { Hono } from "hono";
import { z } from "zod";
import { batBuocPhamViDonVi, batBuocVaiTro, NgoaiPhamVi, phamViCua } from "../auth.ts";
import { ApiError, badRequest, conflict, notFound, parseBody, parseQuery } from "../http.ts";

const uuid = z.string().uuid("Id phải là UUID hợp lệ");

/** Lỗi nghiệp vụ của packages/db thành lỗi HTTP có mã ổn định. */
function doiLoi(e: unknown): never {
  if (e instanceof LoiNghiepVu) {
    if (e.loai === "khong_tim_thay") throw notFound(e.message);
    if (e.loai === "xung_dot") throw conflict(e.message);
    throw badRequest(e.message);
  }
  if (e instanceof LoiMatKhau || e instanceof LoiTepExcel) throw badRequest(e.message);
  throw e;
}

function idHopLe(raw: string | undefined): string {
  const r = uuid.safeParse(raw ?? "");
  if (!r.success) throw badRequest("Id phải là UUID hợp lệ");
  return r.data;
}

/* ------------------------------------------------------------------ */
/* Đơn vị                                                               */
/* ------------------------------------------------------------------ */

export const donViRoute = new Hono();

/** GET /v1/quan-tri/don-vi — cây đơn vị trong phạm vi của người gọi. */
donViRoute.get("/", async (c) => {
  const p = await batBuocVaiTro(c, "lanh_dao");
  const phamVi = phamViCua(p);
  const items = phamVi === "khong_co" ? [] : await danhSachDonVi(phamVi);
  return c.json({ items });
});

const donViSchema = z.object({
  code: z.string().trim().min(1, "Nhập mã đơn vị").max(40),
  name: z.string().trim().min(1, "Nhập tên đơn vị").max(200),
  parentId: uuid.nullable().optional(),
  levelLabel: z.string().trim().max(50).nullable().optional(),
  ordinal: z.coerce.number().int().min(0).max(100_000).optional(),
});

donViRoute.post("/", async (c) => {
  const p = await batBuocVaiTro(c, "quan_tri");
  const body = await parseBody(c, donViSchema);
  try {
    return c.json({ item: await taoDonVi(body, p.email) }, 201);
  } catch (e) {
    doiLoi(e);
  }
});

const suaDonViSchema = donViSchema.partial().extend({ enabled: z.boolean().optional() });

donViRoute.patch("/:id", async (c) => {
  const p = await batBuocVaiTro(c, "quan_tri");
  const id = idHopLe(c.req.param("id"));
  const body = await parseBody(c, suaDonViSchema);
  try {
    return c.json({ item: await suaDonVi(id, body, p.email) });
  } catch (e) {
    doiLoi(e);
  }
});

/* ------------------------------------------------------------------ */
/* Người dùng                                                           */
/* ------------------------------------------------------------------ */

export const nguoiDungRoute = new Hono();

const locSchema = z.object({
  don_vi: uuid.optional(),
  chua_phan_nhom: z.enum(["1", ""]).optional(),
  q: z.string().trim().max(100).optional(),
  xac_minh: z.enum(["cho_duyet", "tu_choi", "chua_xac_minh"]).optional(),
  trang: z.coerce.number().int().min(1).max(10_000).default(1),
  gioi_han: z.coerce.number().int().min(1).max(200).default(50),
});

/**
 * GET /v1/quan-tri/nguoi-dung — danh sách trong phạm vi. Lọc theo một đơn vị ngoài cây đơn vị
 * của mình thì nhận 403 ngoai_pham_vi, không nhận danh sách rỗng: người gọi phải biết là bị chặn.
 */
nguoiDungRoute.get("/", async (c) => {
  const q = parseQuery(c, locSchema);
  let nguoiGoi = await batBuocVaiTro(c, "lanh_dao");
  let donViPath: string | null = null;
  if (q.don_vi) {
    const kq = await batBuocPhamViDonVi(c, q.don_vi);
    nguoiGoi = kq.nguoiDung;
    donViPath = kq.unitPath;
  }
  const phamVi = phamViCua(nguoiGoi);
  if (phamVi === "khong_co") {
    return c.json({ items: [], total: 0, trang: q.trang, gioi_han: q.gioi_han, so_cho_xac_minh: 0 });
  }
  const [kq, soChoXacMinh] = await Promise.all([
    danhSachNguoiDung({
      phamVi,
      donViPath,
      q: q.q,
      xacMinh: q.xac_minh,
      chuaPhanNhom: q.chua_phan_nhom === "1",
      trang: q.trang,
      gioiHan: q.gioi_han,
    }),
    demChoXacMinh(phamVi),
  ]);
  return c.json({ ...kq, trang: q.trang, gioi_han: q.gioi_han, so_cho_xac_minh: soChoXacMinh });
});

/** GET /v1/quan-tri/nguoi-dung/mau — tệp mẫu nhập người dùng, kèm danh mục mã đơn vị hiện có. */
nguoiDungRoute.get("/mau", async (c) => {
  await batBuocVaiTro(c, "quan_tri");
  const tep = await taoMauNhapNguoiDung();
  return new Response(tep as Uint8Array<ArrayBuffer>, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="mau-nhap-nguoi-dung.xlsx"',
    },
  });
});

/**
 * POST /v1/quan-tri/nguoi-dung/nhap — nhập danh sách từ Excel (multipart: `tep`, `chay_thu`).
 * Chạy thử (`chay_thu=1`) chỉ kiểm tra, không ghi. Chạy thật trả mật khẩu tạm của từng người
 * một lần duy nhất; hệ thống chỉ lưu bản băm.
 */
nguoiDungRoute.post("/nhap", async (c) => {
  const p = await batBuocVaiTro(c, "quan_tri");
  const form = await c.req.parseBody();
  const tep = form.tep;
  if (!(tep instanceof File)) throw badRequest("Chưa chọn tệp Excel.");
  if (tep.size > 5 * 1024 * 1024) throw badRequest("Tệp lớn hơn 5 MB.");
  const chayThu = ["1", "true", "on"].includes(String(form.chay_thu ?? ""));
  try {
    const dong = await docBangExcel(new Uint8Array(await tep.arrayBuffer()), COT_NHAP_NGUOI_DUNG);
    if (!dong.length) throw badRequest("Tệp không có dòng dữ liệu nào dưới dòng tiêu đề.");
    if (dong.length > 2000) throw badRequest("Mỗi lần nhập tối đa 2.000 dòng.");
    const kq = await nhapNguoiDung(dong, {
      chayThu,
      actor: p.email,
      chuanHoaTen: chuanHoaTenDangNhap,
      loiTen: loiTenDangNhap,
      taoMatKhau: taoMatKhauTam,
      bamMatKhau,
    });
    return c.json(kq);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    doiLoi(e);
  }
});

const nhomDoiTuongSchema = danhSachNhomHocTapSchema;

const taoNguoiDungSchema = z.object({
  nhomDoiTuong: nhomDoiTuongSchema.default([]),
  username: z.string().trim().min(1, "Nhập tên đăng nhập").max(50),
  name: z.string().trim().min(1, "Nhập họ và tên").max(200),
  role: z.enum(ROLES).default("can_bo"),
  unitId: uuid.nullable().optional(),
  rankTitle: z.string().trim().max(200).nullable().optional(),
  email: z.string().trim().email("Email không hợp lệ").max(200).nullable().optional().or(z.literal("")),
});

/** POST /v1/quan-tri/nguoi-dung — tạo một tài khoản; trả mật khẩu tạm một lần. */
nguoiDungRoute.post("/", async (c) => {
  const p = await batBuocVaiTro(c, "quan_tri");
  const body = await parseBody(c, taoNguoiDungSchema);
  const username = chuanHoaTenDangNhap(body.username);
  const loi = loiTenDangNhap(username);
  if (loi) throw badRequest(loi);
  if (body.unitId && !(await layDonVi(body.unitId))) throw notFound("Không tìm thấy đơn vị.");
  const matKhauTam = taoMatKhauTam();
  try {
    const item = await taoNguoiDung(
      {
        username,
        name: body.name,
        role: body.role,
        nhomDoiTuong: body.nhomDoiTuong,
        unitId: body.unitId ?? null,
        rankTitle: body.rankTitle ?? null,
        email: body.email ? body.email.toLowerCase() : null,
        passwordHash: await bamMatKhau(matKhauTam),
      },
      p.email,
    );
    return c.json({ item, mat_khau_tam: matKhauTam }, 201);
  } catch (e) {
    doiLoi(e);
  }
});

const suaNguoiDungSchema = z.object({
  nhomDoiTuong: nhomDoiTuongSchema.optional(),
  name: z.string().trim().min(1).max(200).optional(),
  role: z.enum(ROLES).optional(),
  unitId: uuid.nullable().optional(),
  rankTitle: z.string().trim().max(200).nullable().optional(),
  enabled: z.boolean().optional(),
});

/** PATCH /v1/quan-tri/nguoi-dung/:id — sửa, đổi vai trò, chuyển đơn vị, khóa hoặc mở khóa. */
nguoiDungRoute.patch("/:id", async (c) => {
  const p = await batBuocVaiTro(c, "quan_tri");
  const id = idHopLe(c.req.param("id"));
  const body = await parseBody(c, suaNguoiDungSchema);
  // Quản trị không tự khóa hay tự hạ quyền mình: hệ thống có thể mất người quản trị cuối cùng.
  if (id === p.accountId && (body.enabled === false || (body.role && body.role !== "quan_tri"))) {
    throw badRequest("Không tự khóa hoặc tự hạ vai trò của chính tài khoản đang đăng nhập.");
  }
  if (body.unitId && !(await layDonVi(body.unitId))) throw notFound("Không tìm thấy đơn vị.");
  try {
    return c.json({ item: await suaNguoiDung(id, body, p.email) });
  } catch (e) {
    doiLoi(e);
  }
});

/** POST /v1/quan-tri/nguoi-dung/:id/dat-lai-mat-khau — cấp mật khẩu tạm mới, thu hồi mọi phiên. */
nguoiDungRoute.post("/:id/dat-lai-mat-khau", async (c) => {
  const p = await batBuocVaiTro(c, "quan_tri");
  const id = idHopLe(c.req.param("id"));
  try {
    return c.json({ mat_khau_tam: await datLaiMatKhau(id, p.email) });
  } catch (e) {
    doiLoi(e);
  }
});

const xacMinhSchema = z.discriminatedUnion("duyet", [
  z.object({ duyet: z.literal(true), unitId: uuid.optional() }),
  z.object({
    duyet: z.literal(false),
    ly_do: z.string().trim().min(1, "Nhập lý do từ chối để người đăng ký biết cần sửa gì").max(500),
  }),
]);

/**
 * POST /v1/quan-tri/nguoi-dung/:id/xac-minh — duyệt (`{duyet: true, unitId?}`) hoặc từ chối
 * (`{duyet: false, ly_do}`) một tài khoản chưa xác minh. Bỏ trống `unitId` thì gắn vào đơn vị người
 * đăng ký đã khai. Cán bộ quản lý chỉ xử lý tài khoản khai đơn vị trong cây của mình và chỉ gắn vào
 * đơn vị trong cây đó. Tài khoản đã xác minh trả 409.
 */
nguoiDungRoute.post("/:id/xac-minh", async (c) => {
  const p = await batBuocVaiTro(c, "lanh_dao");
  const id = idHopLe(c.req.param("id"));
  const body = await parseBody(c, xacMinhSchema);
  const item = await layNguoiDung(id);
  // Không có và ngoài phạm vi trả cùng một lỗi: không lộ tài khoản nào có thật.
  if (!item || !trongPhamVi(p, item.pham_vi_path)) {
    throw new NgoaiPhamVi("Tài khoản này nằm ngoài phạm vi quản lý của tài khoản đang đăng nhập.");
  }
  if (item.xac_minh === "da_xac_minh") throw conflict("Tài khoản này đã được xác minh.");
  try {
    if (!body.duyet) return c.json({ item: await tuChoiXacMinh(id, body.ly_do, p.email) });
    const unitId = body.unitId ?? item.don_vi_khai;
    if (!unitId) throw badRequest("Chọn đơn vị để gắn tài khoản này vào.");
    await batBuocPhamViDonVi(c, unitId);
    return c.json({ item: await duyetTaiKhoan(id, unitId, p.email) });
  } catch (e) {
    if (e instanceof ApiError || e instanceof NgoaiPhamVi) throw e;
    doiLoi(e);
  }
});

/** GET /v1/quan-tri/nguoi-dung/:id — một tài khoản, trong phạm vi của người gọi. */
nguoiDungRoute.get("/:id", async (c) => {
  const p = await batBuocVaiTro(c, "lanh_dao");
  const item = await layNguoiDung(idHopLe(c.req.param("id")));
  if (!item || !trongPhamVi(p, item.pham_vi_path)) {
    throw new NgoaiPhamVi("Tài khoản này nằm ngoài phạm vi quản lý của tài khoản đang đăng nhập.");
  }
  return c.json({ item });
});
