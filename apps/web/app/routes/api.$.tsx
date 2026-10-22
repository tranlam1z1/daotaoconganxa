/**
 * Cầu nối từ trình duyệt tới API cho màn hình chạy phía client (docs/PLAN.md GĐ13).
 *
 * Token phiên nằm trong cookie HttpOnly, JavaScript trên trang không đọc được; route này đọc
 * cookie ở máy chủ web rồi gọi API thay người dùng. Chỉ những đường dẫn trong DANH_SACH_CHO_PHEP
 * đi qua được, để cầu nối không thành lối gọi tùy ý mọi API bằng quyền của người dùng.
 */
import { apiBase } from "../lib/api";
import { layToken } from "../lib/auth.server";
import type { Route } from "./+types/api.$";

const DANH_SACH_CHO_PHEP: ReadonlyArray<{ phuongThuc: "GET" | "POST"; mau: RegExp }> = [
  { phuongThuc: "GET", mau: /^luyen-tap\/chu-de$/ },
  { phuongThuc: "GET", mau: /^luyen-tap\/goi-offline\/[A-Za-z0-9-]{1,80}$/ },
  { phuongThuc: "POST", mau: /^luyen-tap\/dong-bo$/ },
];

/** Thân yêu cầu tối đa (byte): 20 phiên × 50 câu trả lời dư sức nằm trong mức này. */
const THAN_TOI_DA = 512 * 1024;

function traJson(status: number, message: string) {
  return Response.json(
    { error: { code: status === 401 ? "chua_dang_nhap" : "khong_cho_phep", message } },
    { status },
  );
}

async function chuyenTiep(request: Request, duong: string, phuongThuc: "GET" | "POST") {
  if (!DANH_SACH_CHO_PHEP.some((d) => d.phuongThuc === phuongThuc && d.mau.test(duong))) {
    return traJson(404, "Không có đường dẫn này.");
  }
  const token = layToken(request);
  if (!token) return traJson(401, "Hãy đăng nhập.");

  let body: string | undefined;
  if (phuongThuc === "POST") {
    body = await request.text();
    if (body.length > THAN_TOI_DA) return traJson(413, "Dữ liệu gửi lên quá lớn.");
  }
  const res = await fetch(`${apiBase()}/v1/${duong}`, {
    method: phuongThuc,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body,
    signal: AbortSignal.timeout(30_000),
  });
  return new Response(res.body, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json",
      // Dữ liệu riêng của người dùng: không cho proxy hay service worker lưu lại.
      "cache-control": "no-store",
    },
  });
}

export function loader({ request, params }: Route.LoaderArgs) {
  return chuyenTiep(request, params["*"] ?? "", "GET");
}

export function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") return traJson(405, "Phương thức không được hỗ trợ.");
  return chuyenTiep(request, params["*"] ?? "", "POST");
}
