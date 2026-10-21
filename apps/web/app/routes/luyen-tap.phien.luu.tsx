/**
 * Lưu tạm câu trả lời của một câu trong phiên luyện tập (resource route, không có giao diện). Trang
 * phiên và trò Hỏi nhanh giọng nói gọi bằng fetch() mỗi khi người học chọn hoặc gõ xong, lần lượt
 * từng yêu cầu một. Chuyển tiếp tới API vì token phiên nằm trong cookie HttpOnly.
 *
 * Trả JSON: `{ ok: true }`, hoặc `{ ok: false, loi }` để trang xử lý tại chỗ. Không có đúng/sai.
 */
import { luuTam } from "../lib/luyen-tap.server";
import type { TraLoiCauHoi } from "../lib/ngan-hang";
import { LoiApi } from "../lib/quan-tri.server";
import { yeuCauDangNhap } from "../lib/session.server";
import type { Route } from "./+types/luyen-tap.phien.luu";

export async function action({ request, params }: Route.ActionArgs) {
  const { token } = await yeuCauDangNhap(request);
  const body = (await request.json().catch(() => null)) as {
    stt?: number;
    tra_loi?: TraLoiCauHoi;
    giay?: number;
  } | null;
  if (!body || !Number.isInteger(body.stt)) {
    return Response.json({ ok: false, loi: "Dữ liệu câu trả lời không hợp lệ." }, { status: 400 });
  }
  const giay = Number(body.giay);
  try {
    await luuTam(token, params.phien, {
      stt: body.stt!,
      tra_loi: body.tra_loi ?? {},
      ...(Number.isFinite(giay) && giay >= 0 ? { giay: Math.round(giay) } : {}),
    });
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof LoiApi) return Response.json({ ok: false, loi: e.message }, { status: e.status });
    throw e;
  }
}
