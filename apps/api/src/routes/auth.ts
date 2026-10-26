/**
 * Xác thực người dùng bằng Google Identity Services (GIS).
 *
 * Trình duyệt KHÔNG bao giờ gọi thẳng các endpoint này: máy chủ web (apps/web) đứng giữa,
 * nhận ID token từ nút GIS rồi đổi lấy token phiên ở đây và cất vào cookie HttpOnly của
 * chính miền web. Nhờ vậy token phiên không nằm trong JavaScript của trang, và web với API
 * vẫn ở hai cổng khác nhau mà không phải chia sẻ cookie.
 *
 * Cùng một kho tài khoản với MCP server: token cấp ở đây dùng được cho cả `Authorization:
 * Bearer` khi gọi MCP, nên người dùng chỉ cần đăng nhập một lần.
 */

import {
  AuthError,
  capNhatKhaiBao,
  checkDemoPassword,
  createSession,
  dangKyTaiKhoan,
  dangNhapMatKhau,
  demoAccount,
  demoEnabled,
  demoQuanTriDuocPhep,
  doiMatKhau,
  gopKhachVaoTaiKhoan,
  LoiDangKy,
  LoiMatKhau,
  type Principal,
  principalFromToken,
  ROLE_LABEL,
  type Role,
  readAuthConfig,
  revokeSession,
  thongTinXacMinh,
  upsertAccount,
  verifyGoogleIdToken,
} from "@qdpl/auth";
import { danhSachDonVi, sql } from "@qdpl/db";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import { diaChiIp } from "../auth.ts";
import { ApiError, badRequest, notFound, parseBody } from "../http.ts";

export const auth = new Hono();

/**
 * Token phiên đang giữ trên máy (cookie), gửi kèm khi đăng nhập hoặc đăng ký. Là phiên của một tài
 * khoản khách cũ (chế độ khách đã tắt) thì tiến độ khách được gộp vào tài khoản thật (khach.ts).
 */
const tokenKhach = z.string().trim().min(10).max(200).optional();

const dangNhapSchema = z.object({
  credential: z.string().min(10, "Thiếu ID token của Google"),
  client: z.string().trim().max(100).optional(),
  token_khach: tokenKhach,
});

const dangNhapMatKhauSchema = z.object({
  ten_dang_nhap: z.string().trim().min(1, "Nhập tên đăng nhập").max(100),
  mat_khau: z.string().min(1, "Nhập mật khẩu").max(200),
  client: z.string().trim().max(100).optional(),
  token_khach: tokenKhach,
});

// Thông tin để được xác minh cán bộ (migration 0064). Quy tắc chi tiết kiểm ở @qdpl/auth dang-ky.ts.
const khaiBaoSchema = z.object({
  so_hieu: z.string().trim().min(1, "Nhập số hiệu CAND").max(30),
  don_vi_id: z.string().trim().min(1, "Chọn đơn vị công tác").max(50),
  cap_bac_chuc_vu: z.string().trim().max(300).optional(),
  so_dien_thoai: z.string().trim().min(1, "Nhập số điện thoại").max(30),
});

// Quy tắc chi tiết (độ dài tên, dạng số điện thoại, độ mạnh mật khẩu) kiểm ở dangKyTaiKhoan.
const dangKySchema = khaiBaoSchema.extend({
  ten: z.string().trim().min(1, "Nhập họ và tên").max(200),
  email: z.string().trim().min(1, "Nhập email").max(300),
  mat_khau: z.string().min(1, "Nhập mật khẩu").max(200),
  client: z.string().trim().max(100).optional(),
  token_khach: tokenKhach,
});

const doiMatKhauSchema = z.object({
  mat_khau_cu: z.string().min(1, "Nhập mật khẩu hiện tại").max(200),
  mat_khau_moi: z.string().min(1, "Nhập mật khẩu mới").max(200),
});

const dangNhapDemoSchema = z.object({
  mat_khau: z.string().min(1, "Nhập mật khẩu demo").max(200),
  vai_tro: z.enum(["hoc_vien", "quan_tri"]),
  client: z.string().trim().max(100).optional(),
  token_khach: tokenKhach,
});

/** 401 cho endpoint cần danh tính. ApiError không có mã này nên trả thẳng Response. */
function chuaDangNhap(c: Context): Response {
  return c.json(
    { error: { code: "chua_dang_nhap", message: "Thiếu hoặc sai token phiên. Hãy đăng nhập lại." } },
    401,
  );
}

async function danhTinh(c: Context): Promise<Principal | undefined> {
  const header = c.req.header("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return undefined;
  return await principalFromToken(header.slice(7).trim());
}

/**
 * Gộp tiến độ khách vào tài khoản vừa đăng nhập. Lỗi khi gộp không làm hỏng lần đăng nhập: chỉ ghi
 * log, tài khoản khách còn nguyên và được dọn theo hạn như mọi khách khác.
 */
async function gopKhach(token: string | undefined, accountId: string): Promise<boolean> {
  if (!token) return false;
  try {
    return await gopKhachVaoTaiKhoan(token, accountId);
  } catch (err) {
    console.error("[auth] không gộp được tiến độ khách:", err);
    return false;
  }
}

function loiDangKy(c: Context, e: LoiDangKy): Response {
  const status =
    e.code === "da_ton_tai" || e.code === "da_xac_minh" ? 409 : e.code === "qua_nhieu_lan" ? 429 : 400;
  return c.json({ error: { code: e.code, message: e.message } }, status);
}

/** Thông tin xác minh trả cho chính người dùng; dạng chung cho /me và PUT /xac-minh. */
function xacMinhJson(tt: NonNullable<Awaited<ReturnType<typeof thongTinXacMinh>>>) {
  return {
    trang_thai: tt.trangThai,
    so_hieu: tt.soHieu,
    don_vi: tt.donVi,
    cap_bac_chuc_vu: tt.capBacChucVu,
    so_dien_thoai: tt.soDienThoai,
    ly_do_tu_choi: tt.lyDo,
  };
}

async function moTa(principal: Principal) {
  const [donVi] = principal.unitId
    ? ((await sql`SELECT id, code, name FROM units WHERE id = ${principal.unitId}`) as any[])
    : [];
  const [tk] = principal.accountId
    ? ((await sql`SELECT avatar_uri FROM accounts WHERE id = ${principal.accountId}`) as any[])
    : [];
  const xacMinh =
    principal.choXacMinh && principal.accountId ? await thongTinXacMinh(principal.accountId) : null;
  return {
    email: principal.email,
    // Tên tệp ảnh đại diện (phục vụ ở /v1/toi/anh-dai-dien/:tep); null thì dùng chữ cái đầu tên.
    anh_dai_dien: tk?.avatar_uri ? String(tk.avatar_uri).replace(/^avatars\//, "") : null,
    ten_dang_nhap: principal.username ?? null,
    don_vi: donVi ? { id: donVi.id, ma: donVi.code, ten: donVi.name } : null,
    phai_doi_mat_khau: Boolean(principal.mustChangePassword),
    ten: principal.name ?? null,
    vai_tro: principal.role,
    nhom_doi_tuong: principal.nhomDoiTuong ?? [],
    mo_ta_vai_tro: ROLE_LABEL[principal.role],
    mien: principal.hostedDomain ?? null,
    la_quan_tri: principal.role === "quan_tri",
    // Tài khoản chưa được xác minh cán bộ: chỉ dùng trang Tài khoản cho tới khi được duyệt (migration 0064).
    cho_xac_minh: Boolean(principal.choXacMinh),
    xac_minh: xacMinh ? xacMinhJson(xacMinh) : null,
  };
}

/**
 * GET /v1/auth/config — trang đăng nhập cần Client ID để dựng nút GIS.
 * Client ID là thông tin công khai (Google in nó ra trong mọi trang dùng GIS).
 */
auth.get("/config", (c) => {
  const cfg = readAuthConfig();
  return c.json({
    google_client_id: cfg.googleClientId,
    da_cau_hinh: Boolean(cfg.googleClientId),
    mien_gioi_han: cfg.allowedDomains.length ? cfg.allowedDomains : null,
    vai_tro_mac_dinh: cfg.defaultRole,
    demo: demoEnabled(),
  });
});

/**
 * POST /v1/auth/demo — đăng nhập tài khoản demo bằng mật khẩu chung (AUTH_DEMO_PASSWORD).
 * Dùng để trình diễn khi đăng nhập Google chưa sẵn sàng. Không đặt biến thì như không tồn tại.
 */
auth.post("/demo", async (c) => {
  if (!demoEnabled()) throw notFound("Không có đăng nhập demo.");
  const body = await parseBody(c, dangNhapDemoSchema);
  // docs/PLAN.md GĐ0 S4: máy chủ thật không mở quyền quản trị bằng mật khẩu chung.
  if (body.vai_tro === "quan_tri" && !demoQuanTriDuocPhep()) {
    return c.json(
      {
        error: {
          code: "demo_quan_tri_tat",
          message: "Tài khoản demo quản trị đã tắt trên máy chủ này. Hãy đăng nhập bằng tài khoản riêng.",
        },
      },
      403,
    );
  }
  if (!checkDemoPassword(body.mat_khau)) {
    // Mỗi lần sai chậm lại một giây để dò mật khẩu tốn thời gian.
    await Bun.sleep(1000);
    return c.json({ error: { code: "sai_mat_khau", message: "Mật khẩu demo không đúng." } }, 401);
  }

  const account = await demoAccount(body.vai_tro);
  if (!account.enabled) {
    return c.json(
      { error: { code: "bi_khoa", message: "Tài khoản demo đã bị khóa. Liên hệ quản trị viên." } },
      403,
    );
  }

  const session = await createSession(account.id, body.client ?? "web-demo");
  const daGopKhach = await gopKhach(body.token_khach, account.id);
  return c.json({
    da_gop_khach: daGopKhach,
    token: session.token,
    het_han: session.expiresAt.toISOString(),
    email: account.email,
    ten: account.name,
    vai_tro: account.role,
    mo_ta_vai_tro: ROLE_LABEL[account.role as Role],
    la_quan_tri: account.role === "quan_tri",
    la_quan_tri_dau_tien: false,
  });
});

/**
 * POST /v1/auth/mat-khau — đăng nhập tài khoản cán bộ bằng tên đăng nhập và mật khẩu.
 * Sai 5 lần trong 15 phút thì khóa tạm (429). Tài khoản đang dùng mật khẩu tạm nhận
 * `phai_doi_mat_khau: true`; mọi endpoint cần đăng nhập chặn tới khi đổi xong.
 */
auth.post("/mat-khau", async (c) => {
  const body = await parseBody(c, dangNhapMatKhauSchema);
  const kq = await dangNhapMatKhau(body.ten_dang_nhap, body.mat_khau, diaChiIp(c));
  if (!kq.ok) {
    if (kq.lyDo === "khoa_tam") {
      return c.json(
        {
          error: {
            code: "khoa_tam",
            message: `Đăng nhập sai quá nhiều lần. Thử lại sau ${kq.conLaiPhut} phút.`,
          },
        },
        429,
      );
    }
    if (kq.lyDo === "bi_khoa") {
      return c.json(
        { error: { code: "bi_khoa", message: "Tài khoản đã bị khóa. Liên hệ quản trị viên." } },
        403,
      );
    }
    return c.json(
      { error: { code: "sai_mat_khau", message: "Tên đăng nhập hoặc mật khẩu không đúng." } },
      401,
    );
  }

  const tk = kq.taiKhoan;
  const session = await createSession(tk.id, body.client ?? "web");
  const daGopKhach = await gopKhach(body.token_khach, tk.id);
  return c.json({
    da_gop_khach: daGopKhach,
    token: session.token,
    het_han: session.expiresAt.toISOString(),
    email: tk.email ?? tk.username,
    ten_dang_nhap: tk.username,
    ten: tk.name,
    vai_tro: tk.role,
    mo_ta_vai_tro: ROLE_LABEL[tk.role],
    la_quan_tri: tk.role === "quan_tri",
    la_quan_tri_dau_tien: false,
    phai_doi_mat_khau: tk.mustChangePassword,
  });
});

/**
 * GET /v1/auth/don-vi — đơn vị đang hoạt động, theo thứ tự cây, để người đăng ký chọn đơn vị công
 * tác. Chỉ trả tên và độ sâu, không trả số người hay mã nội bộ.
 */
auth.get("/don-vi", async (c) => {
  const ds = await danhSachDonVi(null);
  // Đơn vị con của đơn vị đã ngừng cũng ẩn theo.
  const ngung = ds.filter((d) => !d.enabled).map((d) => d.path);
  const items = ds
    .filter((d) => !ngung.some((p) => d.path === p || d.path.startsWith(`${p}.`)))
    .map((d) => ({ id: d.id, ten: d.name, cap: d.cap }));
  return c.json({ items });
});

/**
 * POST /v1/auth/dang-ky — người dùng tự đăng ký, đăng nhập luôn. Tài khoản mới chờ xác minh cán bộ
 * và chỉ dùng được trang Tài khoản cho tới khi được duyệt. Email trùng trả 409, quá số lượt đăng ký
 * của một IP trong một giờ trả 429.
 */
auth.post("/dang-ky", async (c) => {
  const body = await parseBody(c, dangKySchema);
  let tk: Awaited<ReturnType<typeof dangKyTaiKhoan>>;
  try {
    tk = await dangKyTaiKhoan(
      {
        ten: body.ten,
        email: body.email,
        soDienThoai: body.so_dien_thoai,
        matKhau: body.mat_khau,
        soHieu: body.so_hieu,
        donViId: body.don_vi_id,
        capBacChucVu: body.cap_bac_chuc_vu ?? null,
      },
      diaChiIp(c),
    );
  } catch (e) {
    if (!(e instanceof LoiDangKy)) throw e;
    return loiDangKy(c, e);
  }

  const session = await createSession(tk.id, body.client ?? "web");
  const daGopKhach = await gopKhach(body.token_khach, tk.id);
  return c.json({
    da_gop_khach: daGopKhach,
    token: session.token,
    het_han: session.expiresAt.toISOString(),
    email: tk.email ?? tk.username,
    ten_dang_nhap: tk.username,
    ten: tk.name,
    vai_tro: tk.role,
    mo_ta_vai_tro: ROLE_LABEL[tk.role],
    la_quan_tri: false,
    la_quan_tri_dau_tien: false,
    phai_doi_mat_khau: false,
    cho_xac_minh: true,
  });
});

/**
 * PUT /v1/auth/xac-minh — người chưa được xác minh khai hoặc sửa thông tin (sau khi bị từ chối),
 * rồi vào lại hàng chờ duyệt. Tài khoản đã xác minh trả 409.
 */
auth.put("/xac-minh", async (c) => {
  const principal = await danhTinh(c);
  if (!principal?.accountId) return chuaDangNhap(c);
  const body = await parseBody(c, khaiBaoSchema);
  try {
    const tt = await capNhatKhaiBao(principal.accountId, {
      soHieu: body.so_hieu,
      donViId: body.don_vi_id,
      capBacChucVu: body.cap_bac_chuc_vu ?? null,
      soDienThoai: body.so_dien_thoai,
    });
    return c.json({ xac_minh: xacMinhJson(tt) });
  } catch (e) {
    if (!(e instanceof LoiDangKy)) throw e;
    return loiDangKy(c, e);
  }
});

/**
 * POST /v1/auth/doi-mat-khau — người dùng tự đổi mật khẩu. Không đi qua batBuocDangNhap vì
 * đây chính là lối ra cho tài khoản đang bị bắt đổi mật khẩu tạm.
 */
auth.post("/doi-mat-khau", async (c) => {
  const principal = await danhTinh(c);
  if (!principal?.accountId) return chuaDangNhap(c);
  const body = await parseBody(c, doiMatKhauSchema);
  try {
    await doiMatKhau(principal.accountId, body.mat_khau_cu, body.mat_khau_moi);
  } catch (e) {
    if (e instanceof LoiMatKhau) throw badRequest(e.message);
    throw e;
  }
  return c.json({ da_doi: true });
});

/** POST /v1/auth/google — đổi ID token của Google lấy token phiên của hệ thống. */
auth.post("/google", async (c) => {
  const body = await parseBody(c, dangNhapSchema);
  const cfg = readAuthConfig();
  let claims: Awaited<ReturnType<typeof verifyGoogleIdToken>>;
  try {
    claims = await verifyGoogleIdToken(body.credential, {
      clientId: cfg.googleClientId,
      allowedDomains: cfg.allowedDomains,
    });
  } catch (e) {
    if (!(e instanceof AuthError)) throw e;
    // Cấu hình thiếu là lỗi của người vận hành, không phải của người đăng nhập.
    if (e.code === "invalid_config") throw new ApiError(500, "loi_may_chu", e.message);
    return c.json({ error: { code: e.code, message: e.message } }, e.code === "forbidden" ? 403 : 401);
  }

  const account = await upsertAccount({
    email: claims.email,
    sub: claims.sub,
    ...(claims.name ? { name: claims.name } : {}),
    ...(claims.picture ? { picture: claims.picture } : {}),
    ...(claims.hd ? { hd: claims.hd } : {}),
  });
  if (!account.enabled) {
    return c.json(
      { error: { code: "bi_khoa", message: "Tài khoản đã bị khóa. Liên hệ quản trị viên." } },
      403,
    );
  }

  const session = await createSession(account.id, body.client ?? "web");
  const daGopKhach = await gopKhach(body.token_khach, account.id);
  return c.json({
    da_gop_khach: daGopKhach,
    token: session.token,
    het_han: session.expiresAt.toISOString(),
    email: account.email,
    ten: account.name,
    vai_tro: account.role,
    mo_ta_vai_tro: ROLE_LABEL[account.role as Role],
    la_quan_tri: account.role === "quan_tri",
    // Để trang đăng nhập nói rõ vì sao người này bỗng có toàn quyền.
    la_quan_tri_dau_tien: account.laQuanTriDauTien,
  });
});

/** GET /v1/auth/me — danh tính ứng với token phiên đang giữ. */
auth.get("/me", async (c) => {
  const principal = await danhTinh(c);
  if (!principal) return chuaDangNhap(c);
  return c.json(await moTa(principal));
});

/**
 * POST /v1/auth/mcp-token — cấp một token phiên MỚI để dán vào cấu hình MCP client.
 *
 * Không trả lại chính token đang nằm trong cookie: token đó là HttpOnly, đưa ra màn hình
 * là mất tác dụng bảo vệ. Token mới độc lập, thu hồi riêng được.
 */
auth.post("/mcp-token", async (c) => {
  const principal = await danhTinh(c);
  // Tài khoản chờ xác minh cán bộ vẫn nhận được token: MCP tự giới hạn theo vai trò `khach`, tức chỉ
  // các công cụ tra cứu văn bản công khai.
  if (!principal?.accountId) return chuaDangNhap(c);
  const session = await createSession(principal.accountId, "mcp-client");
  return c.json({ token: session.token, het_han: session.expiresAt.toISOString() });
});

/** POST /v1/auth/logout — thu hồi token phiên. */
auth.post("/logout", async (c) => {
  const header = c.req.header("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return chuaDangNhap(c);
  return c.json({ da_thu_hoi: await revokeSession(header.slice(7).trim()) });
});
