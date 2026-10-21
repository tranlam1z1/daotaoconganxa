/**
 * Mùa giải đơn vị (docs/PLAN.md GĐ-G6).
 *
 * - `GET /v1/mua-giai`: hạng, nhóm của đơn vị tôi (điểm trực tiếp trong tuần), số điểm cần để lên
 *   hạng, kết quả tuần trước. Cán bộ chỉ thấy nhóm của đơn vị mình; cán bộ quản lý thấy thêm các
 *   nhóm có đơn vị trong phạm vi của mình; quản trị thấy mọi nhóm.
 * - `/v1/quan-tri/mua-giai`: quản trị tạo mùa, sửa cấu hình trước khi mùa bắt đầu, kết thúc sớm.
 *
 * Chốt tuần do worker `qdpl-mua-giai` làm mỗi giờ. Khi có tuần tới hạn mà chưa chốt (máy không chạy
 * worker, hoặc worker lỡ nhịp), lần gọi GET đầu tiên chốt bù trước khi đọc; bước chốt idempotent.
 */
import { atLeast } from "@qdpl/auth";
import {
  chayMuaGiai,
  danhSachMuaGiai,
  ketThucMuaGiai,
  LoiNghiepVu,
  muaGiaiCanXuLy,
  suaMuaGiai,
  taoMuaGiai,
  xemMuaGiai,
} from "@qdpl/db";
import { Hono } from "hono";
import { z } from "zod";
import { batBuocDangNhap, batBuocVaiTro, ghiNhatKy } from "../auth.ts";
import { badRequest, conflict, notFound, parseBody, parseQuery } from "../http.ts";

function doiLoi(e: unknown): never {
  if (e instanceof LoiNghiepVu) {
    if (e.loai === "khong_tim_thay") throw notFound(e.message);
    if (e.loai === "xung_dot") throw conflict(e.message);
    throw badRequest(e.message);
  }
  throw e;
}

const idHopLe = (raw: string | undefined) => {
  const r = z
    .string()
    .uuid()
    .safeParse(raw ?? "");
  if (!r.success) throw badRequest("Id phải là UUID hợp lệ");
  return r.data;
};

export const muaGiaiRoute = new Hono();

muaGiaiRoute.get("/", async (c) => {
  const p = await batBuocDangNhap(c);
  const q = parseQuery(c, z.object({ mua: z.string().uuid().optional() }));
  const now = new Date();
  if (await muaGiaiCanXuLy(now)) await chayMuaGiai(now);
  const phamVi = p.role === "quan_tri" ? "tat_ca" : atLeast(p.role, "quan_ly") ? (p.unitPath ?? null) : null;
  return c.json(await xemMuaGiai({ unitPath: p.unitPath ?? null, phamVi, now, muaId: q.mua }));
});

/* ------------------------------------------------------------------ */
/* Quản trị                                                             */
/* ------------------------------------------------------------------ */

const cauHinh = z
  .object({
    so_tuan: z.number().int(),
    so_hang: z.number().int(),
    co_nhom: z.number().int(),
    so_len: z.number().int(),
    so_xuong: z.number().int(),
    tran_xp_tuan: z.number().int(),
    toi_thieu_thanh_vien: z.number().int(),
  })
  .partial();

const taoSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9-]{1,40}$/i, "Mã chỉ gồm chữ không dấu, số và dấu gạch ngang"),
  name: z.string().trim().min(1).max(120),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  unit_level_label: z.string().trim().min(1).max(40),
  config: cauHinh.optional(),
});

const suaSchema = taoSchema.omit({ code: true }).partial();

export const quanTriMuaGiaiRoute = new Hono();

quanTriMuaGiaiRoute.get("/", async (c) => {
  await batBuocVaiTro(c, "quan_tri");
  return c.json({ items: await danhSachMuaGiai() });
});

quanTriMuaGiaiRoute.post("/", async (c) => {
  const p = await batBuocVaiTro(c, "quan_tri");
  const b = await parseBody(c, taoSchema);
  const mua = await taoMuaGiai(
    {
      code: b.code,
      name: b.name,
      startsOn: b.starts_on,
      unitLevelLabel: b.unit_level_label,
      config: b.config,
    },
    p.email,
  ).catch(doiLoi);
  return c.json(mua, 201);
});

quanTriMuaGiaiRoute.patch("/:id", async (c) => {
  const p = await batBuocVaiTro(c, "quan_tri");
  const id = idHopLe(c.req.param("id"));
  const b = await parseBody(c, suaSchema);
  const mua = await suaMuaGiai(
    id,
    { name: b.name, startsOn: b.starts_on, unitLevelLabel: b.unit_level_label, config: b.config },
    p.email,
  ).catch(doiLoi);
  return c.json(mua);
});

quanTriMuaGiaiRoute.post("/:id/ket-thuc", async (c) => {
  const p = await batBuocVaiTro(c, "quan_tri");
  const mua = await ketThucMuaGiai(idHopLe(c.req.param("id")), p.email).catch(doiLoi);
  return c.json(mua);
});

/** Chạy ngay việc định kỳ (bắt đầu mùa, chốt tuần đã tới hạn). Không chốt tuần chưa tới 06:00 thứ Hai. */
quanTriMuaGiaiRoute.post("/chay", async (c) => {
  const p = await batBuocVaiTro(c, "quan_tri");
  const kq = await chayMuaGiai(new Date());
  await ghiNhatKy(p.email, "mua_giai:chay", null, kq);
  return c.json(kq);
});
