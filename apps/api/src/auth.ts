/**
 * Danh tính và phân quyền dùng chung cho các route của API.
 *
 * `routes/auth.ts` lo việc CẤP phiên; tệp này lo việc ĐỌC phiên ở mọi route khác. Nguyên tắc
 * giống MCP server: mặc định từ chối, và luôn kiểm lại phía máy chủ chứ không tin giao diện
 * đã ẩn nút.
 */
import { atLeast, type Principal, principalFromToken, type Role, trongPhamVi } from "@qdpl/auth";
import { sql } from "@qdpl/db";
import type { Context, Next } from "hono";

declare module "hono" {
  interface ContextVariableMap {
    /** Danh tính đã tra trong request này; middleware nhật ký truy cập đọc lại, không tra lần hai. */
    nguoiDung: Principal | null;
  }
}

/** Đọc danh tính từ header Authorization. Trả undefined khi chưa đăng nhập. */
export async function danhTinh(c: Context): Promise<Principal | undefined> {
  const daTra = c.get("nguoiDung");
  if (daTra !== undefined) return daTra ?? undefined;
  const header = c.req.header("authorization");
  const p = header?.toLowerCase().startsWith("bearer ")
    ? await principalFromToken(header.slice(7).trim())
    : undefined;
  c.set("nguoiDung", p ?? null);
  return p;
}

/**
 * Nhóm API tài khoản chưa được xác minh cán bộ (chờ duyệt hoặc bị từ chối, migration 0064) được dùng
 * với danh tính của mình: chỉ đủ cho trang Tài khoản (xem trạng thái xét duyệt, khai lại thông tin,
 * đổi mật khẩu, ảnh đại diện, đăng xuất). Ngoài các nhóm này, tài khoản đó bị coi như người chưa
 * đăng nhập: endpoint công khai (tra cứu) vẫn trả lời, endpoint cần đăng nhập (học, luyện tập, thi…)
 * trả 401. Mặc định từ chối, nên nhóm API thêm sau không tự mở cho tài khoản chưa duyệt.
 */
export const CHO_XAC_MINH_DUOC_GOI: readonly string[] = ["/v1/auth", "/v1/toi/anh-dai-dien"];

export function choXacMinhDuocGoi(path: string): boolean {
  return CHO_XAC_MINH_DUOC_GOI.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Middleware: tài khoản chưa được xác minh cán bộ gọi ngoài CHO_XAC_MINH_DUOC_GOI thì bỏ danh tính,
 * các route phía sau thấy chưa đăng nhập.
 */
export async function gioiHanChoXacMinh(c: Context, next: Next): Promise<void> {
  const p = await danhTinh(c);
  if (p?.choXacMinh && !choXacMinhDuocGoi(c.req.path)) c.set("nguoiDung", null);
  await next();
}

/** 401 cho endpoint cần đăng nhập. ApiError không có mã này nên trả thẳng Response. */
export class ChuaDangNhap extends Error {
  readonly status = 401;
}
export class KhongDuQuyen extends Error {
  readonly status = 403;
  constructor(readonly canVaiTro: Role) {
    super(`Cần vai trò ${canVaiTro} trở lên để làm việc này.`);
  }
}
/** Đúng vai trò nhưng dữ liệu thuộc đơn vị ngoài cây đơn vị của người gọi. */
export class NgoaiPhamVi extends Error {
  readonly status = 403;
}
/** Tài khoản đang bị bắt đổi mật khẩu (lần đăng nhập đầu hoặc sau khi được đặt lại). */
export class PhaiDoiMatKhau extends Error {
  readonly status = 403;
}

/**
 * Bắt buộc đăng nhập; ném ChuaDangNhap nếu không. Tài khoản chưa đổi mật khẩu tạm bị chặn ở
 * đây, nên mọi endpoint cần đăng nhập đều không dùng được cho tới khi đổi xong. Các endpoint
 * trong routes/auth.ts (xem danh tính, đổi mật khẩu, đăng xuất) không đi qua hàm này.
 */
export async function batBuocDangNhap(c: Context): Promise<Principal> {
  const p = await danhTinh(c);
  if (!p) throw new ChuaDangNhap("Thiếu hoặc sai token phiên. Hãy đăng nhập lại.");
  if (p.mustChangePassword) {
    throw new PhaiDoiMatKhau("Tài khoản đang dùng mật khẩu tạm. Hãy đổi mật khẩu trước khi tiếp tục.");
  }
  return p;
}

/** Bắt buộc vai trò tối thiểu. */
export async function batBuocVaiTro(c: Context, canVaiTro: Role): Promise<Principal> {
  const p = await batBuocDangNhap(c);
  if (!atLeast(p.role, canVaiTro)) throw new KhongDuQuyen(canVaiTro);
  return p;
}

/**
 * Phạm vi đơn vị người gọi được xem: null là toàn bộ (quản trị), chuỗi là đường dẫn ltree của
 * đơn vị mình. Người chưa gắn đơn vị (và không phải quản trị) không có phạm vi nào.
 */
export function phamViCua(p: Principal): string | null | "khong_co" {
  if (p.role === "quan_tri") return null;
  return p.unitPath ?? "khong_co";
}

/**
 * Bắt buộc vai trò tối thiểu (mặc định `quan_ly`) VÀ đơn vị `unitId` nằm trong cây đơn vị của
 * người gọi. Trả danh tính và đường dẫn của đơn vị đích.
 */
export async function batBuocPhamViDonVi(
  c: Context,
  unitId: string,
  canVaiTro: Role = "quan_ly",
): Promise<{ nguoiDung: Principal; unitPath: string }> {
  const p = await batBuocVaiTro(c, canVaiTro);
  const [u] = (await sql`SELECT path::text AS path FROM units WHERE id = ${unitId}`) as any[];
  // Đơn vị không tồn tại trả cùng lỗi với đơn vị ngoài phạm vi: không lộ id nào có thật.
  if (!u || !trongPhamVi(p, u.path)) {
    throw new NgoaiPhamVi("Đơn vị này nằm ngoài phạm vi quản lý của tài khoản.");
  }
  return { nguoiDung: p, unitPath: u.path };
}

/** Bộ xử lý lỗi cho các lớp trên; gọi từ app.onError trước khi rơi về handleError. */
export function loiXacThuc(err: Error, c: Context): Response | undefined {
  if (err instanceof ChuaDangNhap) {
    return c.json({ error: { code: "chua_dang_nhap", message: err.message } }, 401);
  }
  if (err instanceof KhongDuQuyen) {
    return c.json({ error: { code: "khong_du_quyen", message: err.message } }, 403);
  }
  if (err instanceof NgoaiPhamVi) {
    return c.json({ error: { code: "ngoai_pham_vi", message: err.message } }, 403);
  }
  if (err instanceof PhaiDoiMatKhau) {
    return c.json({ error: { code: "phai_doi_mat_khau", message: err.message } }, 403);
  }
  return undefined;
}

/** Địa chỉ IP của client: sau proxy (DigitalOcean) lấy từ X-Forwarded-For, không thì từ kết nối. */
export function diaChiIp(c: Context): string | null {
  const fwd = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  if (fwd) return fwd;
  try {
    // Bun.serve truyền server vào env; app.request() trong test thì không có.
    const server =
      (c.env as { requestIP?: (r: Request) => { address: string } | null } | undefined) ?? undefined;
    return server?.requestIP?.(c.req.raw)?.address ?? null;
  } catch {
    return null;
  }
}

/**
 * Ghi nhật ký một hành động quản trị. Mọi thay đổi nội dung đào tạo và mascot đều đi qua
 * đây — không có nút nào đổi nội dung mà không để lại dấu vết (09-c §2, §8).
 */
export async function ghiNhatKy(
  actor: string,
  action: string,
  target: string | null,
  detail?: unknown,
): Promise<void> {
  await sql`
    INSERT INTO audit_log (actor, action, target, detail)
    VALUES (${actor}, ${action}, ${target}, ${sql.json((detail ?? {}) as never)})`;
}
