/**
 * Thông báo đẩy của chính người đang đăng nhập (docs/PLAN.md GĐ15), gắn ở /v1/thong-bao:
 * đăng ký, hủy đăng ký một trình duyệt, và cài đặt giờ nhắc học.
 *
 * Việc gửi do worker `qdpl-nhac-hoc` làm (thư viện web-push, khóa VAPID riêng của worker); API chỉ
 * cần khóa CÔNG KHAI để trình duyệt đăng ký.
 */

import { caiDatNhac, huyDangKyDay, luuCaiDatNhac, luuDangKyDay, soThietBiDaDangKy } from "@qdpl/db";
import { Hono } from "hono";
import { z } from "zod";
import { batBuocDangNhap } from "../auth.ts";
import { badRequest, parseBody } from "../http.ts";

export const thongBao = new Hono();

async function taiKhoan(c: Parameters<typeof batBuocDangNhap>[0]): Promise<string> {
  const p = await batBuocDangNhap(c);
  if (!p.accountId) throw badRequest("Phiên đăng nhập không gắn với tài khoản nào.");
  return p.accountId;
}

const gio = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Giờ phải có dạng HH:MM, ví dụ 19:30");

/** GET /v1/thong-bao: khóa công khai VAPID, số thiết bị đã đăng ký, cài đặt nhắc học. */
thongBao.get("/", async (c) => {
  const acc = await taiKhoan(c);
  const khoa = process.env.VAPID_PUBLIC_KEY?.trim() || null;
  const [soThietBi, caiDat] = await Promise.all([soThietBiDaDangKy(acc), caiDatNhac(acc)]);
  return c.json({
    vapid_public_key: khoa,
    da_cau_hinh: Boolean(khoa),
    so_thiet_bi: soThietBi,
    cai_dat: caiDat,
  });
});

/** POST /v1/thong-bao/dang-ky: lưu PushSubscription của trình duyệt (dạng JSON chuẩn). */
thongBao.post("/dang-ky", async (c) => {
  const acc = await taiKhoan(c);
  const b = await parseBody(
    c,
    z.object({
      endpoint: z.string().url().startsWith("https://").max(1000),
      keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
    }),
  );
  await luuDangKyDay({
    accountId: acc,
    endpoint: b.endpoint,
    p256dh: b.keys.p256dh,
    auth: b.keys.auth,
    userAgent: c.req.header("user-agent")?.slice(0, 300) ?? null,
  });
  return c.json({ so_thiet_bi: await soThietBiDaDangKy(acc) }, 201);
});

/** POST /v1/thong-bao/huy: bỏ đăng ký một trình duyệt của chính mình. */
thongBao.post("/huy", async (c) => {
  const acc = await taiKhoan(c);
  const b = await parseBody(c, z.object({ endpoint: z.string().max(1000) }));
  const daXoa = await huyDangKyDay(acc, b.endpoint);
  return c.json({ da_xoa: daXoa, so_thiet_bi: await soThietBiDaDangKy(acc) });
});

/** PUT /v1/thong-bao/cai-dat: giờ nhắc học (null là tắt), các loại cảnh báo, giờ yên lặng. */
thongBao.put("/cai-dat", async (c) => {
  const acc = await taiKhoan(c);
  const cu = await caiDatNhac(acc);
  const b = await parseBody(
    c,
    z.object({
      remind_at: gio.nullable().optional(),
      streak_warning: z.boolean().optional(),
      new_exam: z.boolean().optional(),
      new_challenge: z.boolean().optional(),
      // Thông báo nhóm học cùng (docs/PLAN.md GĐ16a, câu N15).
      group_activity: z.boolean().optional(),
      quiet_from: gio.optional(),
      quiet_to: gio.optional(),
    }),
  );
  const moi = await luuCaiDatNhac(acc, {
    remind_at: b.remind_at === undefined ? cu.remind_at : b.remind_at,
    streak_warning: b.streak_warning ?? cu.streak_warning,
    new_exam: b.new_exam ?? cu.new_exam,
    new_challenge: b.new_challenge ?? cu.new_challenge,
    group_activity: b.group_activity ?? cu.group_activity,
    quiet_from: b.quiet_from ?? cu.quiet_from,
    quiet_to: b.quiet_to ?? cu.quiet_to,
  });
  return c.json(moi);
});
