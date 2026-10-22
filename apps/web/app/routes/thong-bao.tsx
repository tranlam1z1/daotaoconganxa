/**
 * Cầu nối thông báo đẩy (resource route, không có giao diện) cho khối "Nhắc học" ở /toi
 * (docs/PLAN.md GĐ15). Token phiên nằm trong cookie HttpOnly nên trình duyệt không gọi thẳng API;
 * route này đọc cấu hình (loader) và chuyển tiếp đăng ký, hủy, cài đặt (action).
 */
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { yeuCauDangNhap } from "../lib/session.server";
import type { Route } from "./+types/thong-bao";

export interface CauHinhThongBao {
  vapid_public_key: string | null;
  da_cau_hinh: boolean;
  so_thiet_bi: number;
  cai_dat: {
    remind_at: string | null;
    new_exam: boolean;
    quiet_from: string;
    quiet_to: string;
  };
}

export async function loader({ request }: Route.LoaderArgs) {
  const { token } = await yeuCauDangNhap(request);
  return await goiApiQuanTri<CauHinhThongBao>(token, "/v1/thong-bao");
}

export async function action({ request }: Route.ActionArgs) {
  const { token } = await yeuCauDangNhap(request);
  const f = await request.formData();
  const intent = String(f.get("intent") ?? "");
  const duLieu = JSON.parse(String(f.get("du_lieu") ?? "{}"));
  try {
    if (intent === "dang-ky") {
      await goiApiQuanTri(token, "/v1/thong-bao/dang-ky", { body: duLieu });
      return { ok: "Đã bật nhắc học trên thiết bị này." };
    }
    if (intent === "huy") {
      await goiApiQuanTri(token, "/v1/thong-bao/huy", { body: duLieu });
      return { ok: "Đã tắt thông báo trên thiết bị này." };
    }
    if (intent === "cai-dat") {
      await goiApiQuanTri(token, "/v1/thong-bao/cai-dat", { method: "PUT", body: duLieu });
      return { ok: "Đã lưu cài đặt nhắc học." };
    }
    return { loi: "Thao tác không hợp lệ." };
  } catch (err) {
    if (err instanceof LoiApi) return { loi: err.message };
    throw err;
  }
}
