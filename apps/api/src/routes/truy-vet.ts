/**
 * Route riêng của trò "Truy vết xe bỏ trốn" (docs/PLAN.md GĐ-T17, câu D23), gắn ở /v1/truy-vet.
 *
 * Khung lượt chơi sinh mọi đề lúc tạo lượt, nên không trả được đoạn cảnh theo camera người chơi chọn. Route
 * này mở một camera cho lượt online: kiểm thao tác bằng cùng hàm với bộ chấm, ghi thao tác vào ảnh chụp
 * bước, trả đoạn cảnh. Bước cuối (đặt điểm chặn) vẫn nộp qua /v1/luot-choi như mọi trò.
 *
 * Chốt bảo mật (như /v1/luot-choi): bắt buộc đăng nhập; người chơi lấy từ phiên; lượt của người khác nhận
 * 403; phản hồi không có lộ trình, xe cần tìm hay điểm chặn đúng; id xe sinh riêng cho từng đoạn cảnh.
 */
import type { Principal } from "@qdpl/auth";
import { moCameraTruyVet } from "@qdpl/db";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { batBuocDangNhap } from "../auth.ts";
import { ApiError, badRequest, conflict, notFound, parseBody } from "../http.ts";

export const truyVetRoute = new Hono();

function taiKhoan(p: Principal): string {
  if (!p.accountId) throw badRequest("Phiên đăng nhập không gắn với tài khoản nào.");
  return p.accountId;
}

const yeuCau = z.object({
  camera: z.string().trim().min(1).max(12),
  cho: z.boolean().optional(),
  khoa: z.object({ doan: z.number().int().min(0).max(49), xe: z.string().trim().min(1).max(12) }).nullish(),
});

/**
 * POST /v1/truy-vet/luot/:id/camera: mở một camera (kèm khóa xe trong đoạn cảnh vừa xem, nếu có). Chưa
 * tới lúc xem được mà không chọn chờ: 409 kèm số giây phải chờ trong trò.
 */
truyVetRoute.post("/luot/:id/camera", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  const id = c.req.param("id");
  if (!z.string().uuid().safeParse(id).success) throw notFound("Không có lượt chơi này.");
  const b = await parseBody(c, yeuCau);
  const kq = await moCameraTruyVet(id, acc, { camera: b.camera, cho: Boolean(b.cho), khoa: b.khoa ?? null });
  if (kq.ok) return c.json({ doan: kq.doan, trang_thai: kq.trang_thai });
  if (kq.ly_do !== "thao_tac") {
    if (kq.ly_do === "khong_co_luot") throw notFound(kq.thong_bao);
    if (kq.ly_do === "khong_phai_cua_ban") throw new HTTPException(403, { message: kq.thong_bao });
    throw conflict(kq.thong_bao);
  }
  const l = kq.loi;
  if (l.ma === "khong_co_camera" || l.ma === "khoa_sai" || l.ma === "khong_toi_duoc")
    throw new ApiError(400, "tham_so_khong_hop_le", l.thong_bao, { ma: l.ma });
  throw conflict(l.thong_bao, { ma: l.ma, ...(l.cho_giay !== undefined ? { cho_giay: l.cho_giay } : {}) });
});
