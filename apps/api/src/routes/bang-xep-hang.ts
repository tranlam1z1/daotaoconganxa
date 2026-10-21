/**
 * Bảng xếp hạng theo tuần hoặc tháng (docs/PLAN.md GĐ9), gắn ở /v1/bang-xep-hang.
 *
 * - `pham_vi=don_vi` (mặc định): người trong CÙNG đơn vị với người xem, hiện họ tên. Người đơn vị
 *   khác không bao giờ có mặt, nên không lộ tên ra ngoài đơn vị.
 * - `pham_vi=cac_don_vi`: các đơn vị ngang cấp với đơn vị của người xem (cùng đơn vị cấp trên),
 *   xếp theo XP trung bình mỗi người. Chỉ hiện tên đơn vị, không hiện tên người.
 *
 * Mọi phản hồi kèm `nguong_cap` (NGUONG_CAP) để trang web dựng chú giải "Cách tính cấp" mà không
 * phải import @qdpl/dao-tao. Bảng cá nhân chỉ trả `cap` của đồng nghiệp, không trả tổng XP.
 */
import { dauKy, NGUONG_CAP } from "@qdpl/dao-tao";
import { bangXepHangCaNhan, bangXepHangDonVi, sql } from "@qdpl/db";
import { Hono } from "hono";
import { z } from "zod";
import { batBuocDangNhap } from "../auth.ts";
import { parseQuery } from "../http.ts";

export const bangXepHang = new Hono();

const schema = z.object({
  pham_vi: z.enum(["don_vi", "cac_don_vi"]).default("don_vi"),
  ky: z.enum(["tuan", "thang"]).default("tuan"),
});

bangXepHang.get("/", async (c) => {
  const p = await batBuocDangNhap(c);
  const q = parseQuery(c, schema);
  const tuNgay = dauKy(q.ky);
  const chung = { pham_vi: q.pham_vi, ky: q.ky, tu_ngay: tuNgay, nguong_cap: NGUONG_CAP };

  if (!p.unitId) {
    return c.json({
      ...chung,
      don_vi: null,
      items: [],
      ghi_chu: "Tài khoản chưa gắn đơn vị nên chưa có bảng xếp hạng.",
    });
  }
  const [dv] = (await sql`SELECT id, name, parent_id FROM units WHERE id = ${p.unitId}`) as any[];

  if (q.pham_vi === "don_vi") {
    const items = await bangXepHangCaNhan(p.unitId, tuNgay);
    return c.json({
      ...chung,
      don_vi: { id: dv.id, ten: dv.name },
      items: items.map((r) => ({ ...r, la_toi: r.account_id === p.accountId })),
    });
  }
  const items = await bangXepHangDonVi(dv.parent_id ?? null, tuNgay);
  return c.json({
    ...chung,
    don_vi: { id: dv.id, ten: dv.name },
    items: items.map((r) => ({ ...r, la_cua_toi: r.unit_id === p.unitId })),
  });
});
