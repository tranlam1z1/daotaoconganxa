/**
 * Dữ liệu cho ô chọn căn cứ (components/quan-tri/OCanCu.tsx), resource route không có giao diện:
 * `?q=` tìm văn bản trong kho theo số ký hiệu hoặc tên, `?urn=` trả mục lục điều, khoản, điểm của
 * văn bản. Chuyển tiếp từ API vì token phiên nằm trong cookie HttpOnly.
 */
import { toContent } from "../lib/adapters";
import { type DieuCanCu, rutMucLuc, type VanBanTimThay } from "../lib/can-cu";
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { yeuCauVaiTro } from "../lib/session.server";
import { API_VAN_BAN, type DongVanBan } from "../lib/van-ban-quan-tri";
import type { Route } from "./+types/quan-tri.can-cu";

export type DuLieuCanCu = { items: VanBanTimThay[] } | { urn: string; dieu: DieuCanCu[] } | { loi: string };

export async function loader({ request }: Route.LoaderArgs) {
  const { token } = await yeuCauVaiTro(request, "quan_ly");
  const p = new URL(request.url).searchParams;
  const urn = p.get("urn");
  try {
    if (urn) {
      const raw = await goiApiQuanTri<unknown>(
        token,
        `/v1/documents/${encodeURIComponent(urn)}/content?format=json`,
      );
      return Response.json({ urn, dieu: rutMucLuc(toContent(raw).root) } satisfies DuLieuCanCu);
    }
    const q = p.get("q")?.trim() ?? "";
    if (q.length < 2) return Response.json({ items: [] } satisfies DuLieuCanCu);
    const { items } = await goiApiQuanTri<{ items: DongVanBan[] }>(
      token,
      `${API_VAN_BAN}?${new URLSearchParams({ q, limit: "8" })}`,
    );
    return Response.json({
      items: items.map((v) => ({
        urn: v.urn,
        soKyHieu: v.soKyHieu,
        title: v.title,
        status: v.status,
        coNoiDung: v.coNoiDung,
      })),
    } satisfies DuLieuCanCu);
  } catch (e) {
    if (e instanceof LoiApi) return Response.json({ loi: e.message } satisfies DuLieuCanCu);
    throw e;
  }
}

/** Gửi biểu mẫu của trang đang dùng ô chọn không làm đổi kết quả tìm hay mục lục: khỏi tải lại. */
export function shouldRevalidate() {
  return false;
}
