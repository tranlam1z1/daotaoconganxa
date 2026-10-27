import { traCuuVanBan } from "@qdpl/db";
import { Hono } from "hono";
import { z } from "zod";
import { parseQuery, today } from "../http.ts";
import { ngayTraCuuSchema } from "../ngay-tra-cuu.ts";
import { shapeDocument } from "./documents.ts";

export const traVanBanSchema = z.object({
  q: z.string().trim().max(500).default(""),
  asOf: ngayTraCuuSchema.optional(),
  docType: z.string().trim().max(50).optional(),
  status: z
    .enum([
      "chua_hieu_luc",
      "con_hieu_luc",
      "het_hieu_luc_mot_phan",
      "het_hieu_luc",
      "ngung_hieu_luc",
      "khong_xac_dinh",
    ])
    .optional(),
  family: z.enum(["phap_luat", "dang", "khac", "chua_phan_loai"]).optional(),
  field: z.string().trim().max(100).optional(),
  issuer: z.string().trim().max(300).optional(),
  locality: z.string().trim().max(100).optional(),
  scope: z.enum(["trung_uong", "dia_phuong"]).optional(),
  sort: z.enum(["phu_hop", "moi_nhat", "thu_bac"]).default("phu_hop"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const searchDocuments = new Hono();
searchDocuments.get("/", async (c) => {
  const p = parseQuery(c, traVanBanSchema);
  const asOf = p.asOf ?? today();
  const res = await traCuuVanBan({ ...p, asOf });
  return c.json({
    ...p,
    asOf,
    total: res.total,
    pages: Math.max(1, Math.ceil(res.total / p.limit)),
    facets: res.facets,
    facetScope: "kho_tai_ngay_tra",
    items: res.items.map((r) => ({
      ...shapeDocument({ ...r, status_as_of: r.view_status }),
      matchCount: r.match_count,
      matches: r.matches.map((m) => ({ ...m })),
    })),
  });
});
