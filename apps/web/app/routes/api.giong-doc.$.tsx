/**
 * Cầu nối giọng nói (docs/PLAN.md GĐ14): trình duyệt gọi `/api/giong-doc/...`, máy chủ web đọc
 * cookie phiên rồi gọi `/v1/giong-doc/...` của API thay người dùng.
 *
 * Tách khỏi cầu nối chung `api/*` (GĐ13) vì hai lẽ: đọc một lời mới ở Vbee mất tới 90 giây, và
 * phản hồi là tệp MP3 chứ không phải JSON. Chỉ các đường dẫn trong danh sách dưới đây đi qua.
 *
 * Route tài nguyên: không có thành phần mặc định.
 */
import { apiBase } from "../lib/api";
import { layToken } from "../lib/auth.server";
import type { Route } from "./+types/api.giong-doc.$";

const UUID = "[0-9a-fA-F-]{36}";
const DANH_SACH_CHO_PHEP: ReadonlyArray<{ phuongThuc: "GET" | "POST"; mau: RegExp }> = [
  { phuongThuc: "GET", mau: /^$/ },
  { phuongThuc: "POST", mau: /^$/ },
  { phuongThuc: "POST", mau: /^chuan-bi$/ },
  { phuongThuc: "POST", mau: /^khop$/ },
  { phuongThuc: "GET", mau: new RegExp(`^sach-noi/${UUID}$`) },
  { phuongThuc: "GET", mau: new RegExp(`^sach-noi/${UUID}/${UUID}$`) },
  { phuongThuc: "POST", mau: new RegExp(`^sach-noi/${UUID}/vi-tri$`) },
];

/** API tự dừng chờ Vbee sau 90 giây; cầu nối chờ lâu hơn một chút. */
const CHO_TOI_DA_MS = 100_000;
const THAN_TOI_DA = 64 * 1024;

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
  try {
    const res = await fetch(`${apiBase()}/v1/giong-doc${duong ? `/${duong}` : ""}`, {
      method: phuongThuc,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body,
      signal: AbortSignal.timeout(CHO_TOI_DA_MS),
    });
    const laAmThanh = (res.headers.get("content-type") ?? "").startsWith("audio/");
    return new Response(res.body, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") ?? "application/json",
        // Âm thanh giống nhau với mọi người nên cho trình duyệt giữ lại; dữ liệu riêng thì không.
        "cache-control": laAmThanh && res.ok ? "private, max-age=86400" : "no-store",
      },
    });
  } catch {
    return traJson(502, "Không kết nối được dịch vụ giọng nói.");
  }
}

export function loader({ request, params }: Route.LoaderArgs) {
  return chuyenTiep(request, params["*"] ?? "", "GET");
}

export function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") return traJson(405, "Phương thức không được hỗ trợ.");
  return chuyenTiep(request, params["*"] ?? "", "POST");
}
