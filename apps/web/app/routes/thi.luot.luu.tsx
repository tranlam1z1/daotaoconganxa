/**
 * Lưu câu trả lời của một câu (resource route, không có giao diện). Trang làm bài gọi bằng
 * fetch() mỗi khi người thi chọn hoặc gõ xong, lần lượt từng yêu cầu một. Chuyển tiếp tới API
 * vì token phiên nằm trong cookie HttpOnly chỉ máy chủ web đọc được.
 *
 * Trả JSON: `{ ok: true }`, hoặc `{ ok: false, het_gio?: true, loi }` để trang xử lý tại chỗ.
 */
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { yeuCauDangNhap } from "../lib/session.server";
import type { Route } from "./+types/thi.luot.luu";

export async function action({ request, params }: Route.ActionArgs) {
  const { token } = await yeuCauDangNhap(request);
  const body = (await request.json().catch(() => null)) as { thu_tu?: number; tra_loi?: unknown } | null;
  if (!body || !Number.isInteger(body.thu_tu)) {
    return Response.json({ ok: false, loi: "Dữ liệu câu trả lời không hợp lệ." }, { status: 400 });
  }
  try {
    await goiApiQuanTri(token, `/v1/thi/luot/${params.id}/cau/${body.thu_tu}`, {
      method: "PUT",
      body: { tra_loi: body.tra_loi ?? {} },
    });
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof LoiApi) {
      return Response.json({ ok: false, het_gio: e.status === 409, loi: e.message }, { status: e.status });
    }
    throw e;
  }
}
