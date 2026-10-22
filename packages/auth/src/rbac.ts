/**
 * Tài khoản, vai trò và phân quyền — dùng chung cho web, API và MCP server.
 *
 * Nguyên tắc: mặc định từ chối. Mỗi công cụ khai báo vai trò tối thiểu; danh sách công cụ
 * trả về cho client được LỌC theo vai trò, và mỗi lần gọi đều kiểm tra lại phía server
 * (không tin vào việc client đã lọc).
 */
import { sql, type Tx } from "@qdpl/db";
import { bootstrapAdminEnabled, defaultRole } from "./config.ts";

/**
 * Vai trò xếp theo mức tăng dần của quyền (docs/PLAN.md A5).
 *
 * Thang đơn 5 bậc theo tổ chức, không còn tách vai trò tổ chức và vai trò dòng công việc
 * (migration 0073):
 *
 * - `khach` — khách, chỉ tra cứu công khai.
 * - `can_bo` — cán bộ, công chức: học tập, luyện tập, thi, tra cứu.
 * - `lanh_dao` — lãnh đạo UBND xã: quản lý trong cây đơn vị của mình (cán bộ, báo cáo, đề thi, nhóm).
 * - `quan_ly` — Admin quản lý: quản trị nội dung toàn hệ thống, gồm cả duyệt và xuất bản.
 * - `quan_tri` — Admin quản trị hệ thống: toàn quyền, gồm quản lý tài khoản.
 *
 * Vai trò soạn nội dung và vai trò phê duyệt đã gộp làm một (`quan_ly`): người soạn cũng là
 * người duyệt. Muốn tách trở lại thì phải tách thứ bậc, không chỉ đổi nhãn.
 *
 * Thứ bậc chỉ quyết định VIỆC được làm; PHẠM VI dữ liệu theo đơn vị kiểm riêng bằng
 * `trongPhamVi`, không suy ra từ thứ bậc.
 */
export const ROLES = ["khach", "can_bo", "lanh_dao", "quan_ly", "quan_tri"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  khach: "Khách (chỉ tra cứu văn bản công khai)",
  can_bo: "Cán bộ, công chức (học tập, luyện tập, thi, tra cứu)",
  lanh_dao: "Lãnh đạo UBND xã (quản lý đơn vị mình: cán bộ, báo cáo, đề thi, nhóm)",
  quan_ly: "Admin quản lý (quản trị nội dung toàn hệ thống: soạn, duyệt, xuất bản)",
  quan_tri: "Admin quản trị hệ thống (toàn quyền, gồm quản lý tài khoản)",
};

export function roleRank(role: Role): number {
  return ROLES.indexOf(role);
}

export function atLeast(role: Role, required: Role): boolean {
  return roleRank(role) >= roleRank(required);
}

/**
 * Vai trò tối thiểu cho từng công cụ.
 *
 * Cân nhắc khi xếp mức:
 * - Tra cứu văn bản là dịch vụ công -> khách dùng được.
 * - Chẩn đoán kho lộ tình trạng nội bộ -> từ cán bộ trở lên.
 * - Hàng đợi biên tập và số hóa là công việc quản trị nội dung -> từ Admin quản lý.
 * - Duyệt lệnh sửa đổi làm thay đổi nội dung pháp lý người dân đọc -> từ Admin quản lý.
 */
export const TOOL_ROLE: Record<string, Role> = {
  // Tra cứu
  tim_kiem_quy_dinh: "khach",
  doc_van_ban: "khach",
  doc_dieu_khoan: "khach",
  kiem_tra_can_cu: "khach",
  phan_giai_vien_dan: "khach",
  xem_quan_he_van_ban: "khach",
  so_sanh_thoi_diem: "khach",
  doi_chieu_thu_bac: "khach",
  danh_sach_van_ban: "khach",
  // Chẩn đoán
  thong_ke_kho: "can_bo",
  // Quản trị nội dung
  kiem_tra_suc_khoe_du_lieu: "quan_ly",
  hang_doi_bien_tap: "quan_ly",
  xem_lenh_sua_doi: "quan_ly",
  thu_hop_nhat: "quan_ly",
  bao_van_de: "quan_ly",
  ra_soat_vien_dan: "quan_ly",
  xu_ly_viec_bien_tap: "quan_ly",
  // Số hóa văn bản (ke-hoach/05): agent đọc PDF và dựng Markdown. Đây là công việc
  // quản trị nội dung, không phải tra cứu, nên từ vai trò Admin quản lý trở lên.
  trang_thai_so_hoa: "quan_ly",
  nhan_viec_so_hoa: "quan_ly",
  lay_cua_so_trang: "quan_ly",
  nop_cua_so: "quan_ly",
  hoan_tat_so_hoa: "quan_ly",
  bo_qua_viec_so_hoa: "quan_ly",
  // Quyết định pháp lý
  duyet_lenh_sua_doi: "quan_ly",
  // Quản trị
  quan_ly_tai_khoan: "quan_tri",
};

/** Công cụ có ghi dữ liệu; dùng để yêu cầu thêm cờ cho phép ghi. */
export const WRITE_TOOLS = new Set([
  "duyet_lenh_sua_doi",
  "xu_ly_viec_bien_tap",
  "bao_van_de",
  "quan_ly_tai_khoan",
  "nhan_viec_so_hoa",
  "nop_cua_so",
  "hoan_tat_so_hoa",
  "bo_qua_viec_so_hoa",
]);

export interface Principal {
  accountId?: string;
  /**
   * Định danh hiển thị và ghi nhật ký. Tài khoản cán bộ không có email thì mang tên đăng nhập,
   * để mọi chỗ đang ghi `principal.email` (audit_log, người duyệt) vẫn có giá trị.
   */
  email: string;
  name?: string;
  role: Role;
  /** Nguồn danh tính: google (qua HTTP), mat_khau (tài khoản cán bộ) hoặc local (stdio MCP). */
  source: "google" | "mat_khau" | "local";
  /**
   * Tài khoản chưa được xác minh cán bộ, đang chờ duyệt hoặc đã bị từ chối (migration 0064): API chỉ
   * nhận danh tính ở nhóm tài khoản (apps/api/src/auth.ts) cho tới khi quản trị viên hoặc cán bộ
   * quản lý duyệt.
   */
  choXacMinh?: boolean;
  hostedDomain?: string;
  username?: string;
  unitId?: string;
  /** Đường dẫn ltree của đơn vị, ví dụ "u1a2b.u3c4d". */
  unitPath?: string;
  /** true thì phải đổi mật khẩu trước khi dùng tiếp (lần đầu đăng nhập, sau khi đặt lại). */
  mustChangePassword?: boolean;
}

/**
 * Người này có được xem dữ liệu của đơn vị mang đường dẫn `unitPath` không.
 *
 * - `quan_tri` và `quan_ly` xem mọi đơn vị: hai vai trò này quản trị toàn hệ thống.
 * - Người khác chỉ xem đơn vị của mình và các đơn vị con, cháu (so tiền tố đường dẫn ltree).
 *   Với `lanh_dao` đó là toàn bộ cây đơn vị của xã.
 * - Chưa gắn đơn vị thì không xem được đơn vị nào.
 *
 * Hàm chỉ trả lời câu hỏi PHẠM VI; vai trò tối thiểu (ví dụ `lanh_dao`) người gọi kiểm riêng.
 */
export function trongPhamVi(
  principal: Pick<Principal, "role" | "unitPath">,
  unitPath: string | null | undefined,
): boolean {
  if (principal.role === "quan_tri" || principal.role === "quan_ly") return true;
  if (!principal.unitPath || !unitPath) return false;
  return unitPath === principal.unitPath || unitPath.startsWith(`${principal.unitPath}.`);
}

export interface AccessDecision {
  allowed: boolean;
  reason?: string;
}

export function canUseTool(principal: Principal, tool: string, writeEnabled: boolean): AccessDecision {
  const required = TOOL_ROLE[tool];
  if (!required) {
    return {
      allowed: false,
      reason: `Công cụ "${tool}" chưa khai báo vai trò tối thiểu nên bị từ chối mặc định.`,
    };
  }
  if (!atLeast(principal.role, required)) {
    return {
      allowed: false,
      reason:
        `Công cụ "${tool}" yêu cầu vai trò "${required}" (${ROLE_LABEL[required]}). ` +
        `Tài khoản ${principal.email} đang có vai trò "${principal.role}".`,
    };
  }
  if (WRITE_TOOLS.has(tool) && !writeEnabled) {
    return {
      allowed: false,
      reason:
        `Công cụ "${tool}" ghi dữ liệu nhưng server đang chạy chế độ chỉ đọc. ` +
        "Người vận hành cần đặt QDPL_MCP_ALLOW_WRITE=1.",
    };
  }
  return { allowed: true };
}

/** Danh sách công cụ mà một vai trò được thấy. */
export function visibleTools(principal: Principal, writeEnabled: boolean): string[] {
  return Object.keys(TOOL_ROLE).filter((t) => canUseTool(principal, t, writeEnabled).allowed);
}

export interface AccountRow {
  id: string;
  email: string;
  role: Role;
  enabled: boolean;
  name: string | null;
  hosted_domain: string | null;
}

/**
 * Khóa tư vấn cho bước "người đầu tiên làm quản trị". Hai người bấm đăng nhập cùng lúc
 * trên một kho trống phải xếp hàng, nếu không cả hai đều đọc thấy bảng rỗng và cả hai
 * đều thành quản trị. Số cố định, chỉ dùng cho mục đích này.
 */
const BOOTSTRAP_LOCK = 0x71_64_70_6c;

export interface UpsertResult extends AccountRow {
  /** true khi lần đăng nhập này vừa tạo tài khoản (không phải đăng nhập lại). */
  vuaTao: boolean;
  /** true khi tài khoản này được cấp quyền quản trị vì là người đăng nhập đầu tiên. */
  laQuanTriDauTien: boolean;
}

/**
 * Tìm hoặc tạo tài khoản khi đăng nhập.
 *
 * Người đăng nhập ĐẦU TIÊN của một kho chưa có tài khoản nào nhận vai trò `quan_tri`:
 * hệ thống mới dựng phải có người quản trị, và cách duy nhất còn lại là sửa CSDL bằng
 * tay. Từ người thứ hai trở đi, vai trò là AUTH_DEFAULT_ROLE (mặc định "khach") —
 * không tự cấp quyền cao cho người lạ. Tắt bước này bằng AUTH_BOOTSTRAP_ADMIN=0.
 *
 * Tài khoản mới mang vai trò `khach` vào hàng chờ xác minh cán bộ (migration 0064). Người vận hành
 * đặt AUTH_DEFAULT_ROLE cao hơn là đã tin mọi tài khoản Google được nhận, nên không phải chờ.
 *
 * Đăng nhập lại KHÔNG đổi vai trò đã cấp: quyền do quản trị quyết định, không do
 * lần đăng nhập gần nhất.
 */
export async function upsertAccount(
  claims: {
    email: string;
    sub: string;
    name?: string;
    picture?: string;
    hd?: string;
  },
  /** Giao dịch của người gọi. Bỏ trống thì hàm tự mở một giao dịch riêng. */
  tx?: Tx,
): Promise<UpsertResult> {
  if (tx) return await ghiTaiKhoan(claims, tx);
  return (await sql.begin((t) => ghiTaiKhoan(claims, t))) as unknown as UpsertResult;
}

async function ghiTaiKhoan(
  claims: { email: string; sub: string; name?: string; picture?: string; hd?: string },
  tx: Tx,
): Promise<UpsertResult> {
  await tx`SELECT pg_advisory_xact_lock(${BOOTSTRAP_LOCK})`;
  // Tài khoản khách không tính: khách vào học trước không được làm mất lượt quản trị đầu tiên.
  const [tong] = (await tx`SELECT count(*)::int AS n FROM accounts WHERE NOT la_khach`) as any[];
  const khoTrong = Number(tong?.n ?? 0) === 0;
  const capQuanTri = khoTrong && bootstrapAdminEnabled();
  const role: Role = capQuanTri ? "quan_tri" : defaultRole();

  // Tài khoản tự đăng ký (dang-ky.ts) chưa xác minh email. Google chứng minh người này là chủ
  // email, nên bỏ mật khẩu do người đăng ký đặt và thu hồi mọi phiên cũ: người đã đăng ký trước
  // bằng email của người khác không giữ được quyền vào tài khoản.
  // Thông tin xác minh người kia khai (số hiệu, đơn vị) cũng không phải của chủ email: chưa duyệt
  // thì xóa để chủ email tự khai lại.
  const chiemCho = (await tx`
    UPDATE accounts SET password_hash = NULL, self_registered = false,
      so_hieu = CASE WHEN xac_minh = 'da_xac_minh' THEN so_hieu END,
      don_vi_khai = CASE WHEN xac_minh = 'da_xac_minh' THEN don_vi_khai END,
      rank_title = CASE WHEN xac_minh = 'da_xac_minh' THEN rank_title END,
      phone = CASE WHEN xac_minh = 'da_xac_minh' THEN phone END,
      xac_minh = CASE WHEN xac_minh = 'da_xac_minh' THEN xac_minh ELSE 'cho_duyet' END
    WHERE lower(email) = lower(${claims.email}) AND self_registered AND google_sub IS NULL
    RETURNING id`) as any[];
  for (const r of chiemCho) {
    await tx`UPDATE sessions SET revoked_at = now() WHERE account_id = ${r.id} AND revoked_at IS NULL`;
  }

  const [row] = (await tx`
    INSERT INTO accounts (email, google_sub, name, picture, hosted_domain, role, xac_minh, last_login_at)
    VALUES (${claims.email}, ${claims.sub}, ${claims.name ?? null}, ${claims.picture ?? null},
            ${claims.hd ?? null}, ${role}, ${role === "khach" ? "cho_duyet" : "da_xac_minh"}, now())
    ON CONFLICT (email) DO UPDATE SET
      google_sub = COALESCE(accounts.google_sub, EXCLUDED.google_sub),
      name = COALESCE(EXCLUDED.name, accounts.name),
      picture = COALESCE(EXCLUDED.picture, accounts.picture),
      hosted_domain = COALESCE(EXCLUDED.hosted_domain, accounts.hosted_domain),
      last_login_at = now()
    RETURNING id, email, role, enabled, name, hosted_domain,
              (xmax = 0) AS vua_tao`) as any[];

  const vuaTao = Boolean(row.vua_tao);
  const laQuanTriDauTien = vuaTao && capQuanTri;
  if (laQuanTriDauTien) {
    // Việc cấp quyền cao nhất phải để lại dấu vết, kể cả khi do hệ thống tự làm.
    await tx`INSERT INTO audit_log (actor, action, target, detail)
             VALUES ('he_thong', 'account:bootstrap_admin', ${claims.email},
                     ${tx.json({ ly_do: "nguoi dang nhap dau tien cua kho trong" } as any)})`;
  }
  return { ...row, vuaTao, laQuanTriDauTien } as UpsertResult;
}

export async function setRole(email: string, role: Role, actor: string): Promise<AccountRow> {
  if (!ROLES.includes(role)) throw new Error(`Vai trò không hợp lệ: ${role}`);
  const [row] = (await sql`
    UPDATE accounts SET role = ${role} WHERE email = ${email}
    RETURNING id, email, role, enabled, name, hosted_domain`) as any[];
  if (!row) throw new Error(`Không có tài khoản ${email}. Người dùng phải đăng nhập ít nhất một lần trước.`);
  await sql`INSERT INTO audit_log (actor, action, target, detail)
            VALUES (${actor}, 'account:set_role', ${email}, ${sql.json({ role } as any)})`;
  return row as AccountRow;
}

export async function setEnabled(email: string, enabled: boolean, actor: string): Promise<AccountRow> {
  const [row] = (await sql`
    UPDATE accounts SET enabled = ${enabled} WHERE email = ${email}
    RETURNING id, email, role, enabled, name, hosted_domain`) as any[];
  if (!row) throw new Error(`Không có tài khoản ${email}.`);
  await sql`INSERT INTO audit_log (actor, action, target, detail)
            VALUES (${actor}, ${enabled ? "account:enable" : "account:disable"}, ${email}, ${sql.json({} as any)})`;
  return row as AccountRow;
}

export async function listAccounts(limit = 100): Promise<AccountRow[]> {
  return (await sql`
    SELECT id, COALESCE(email, username) AS email, role, enabled, name, hosted_domain, last_login_at
    FROM accounts WHERE NOT la_khach ORDER BY last_login_at DESC NULLS LAST LIMIT ${limit}`) as unknown as AccountRow[];
}

/** Ghi nhật ký mọi lần gọi công cụ, kể cả lần bị từ chối. */
export async function logCall(entry: {
  principal: Principal;
  tool: string;
  args?: unknown;
  allowed: boolean;
  denyReason?: string;
  durationMs?: number;
  error?: string;
}): Promise<void> {
  await sql`
    INSERT INTO mcp_call_log (account_id, email, role, tool, args, allowed, deny_reason, duration_ms, error)
    VALUES (${entry.principal.accountId ?? null}, ${entry.principal.email}, ${entry.principal.role},
            ${entry.tool}, ${sql.json((entry.args ?? null) as any)}, ${entry.allowed},
            ${entry.denyReason ?? null}, ${entry.durationMs ?? null}, ${entry.error ?? null})`;
}
