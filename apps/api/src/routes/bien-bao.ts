/**
 * Biển báo (docs/PLAN.md GĐ12).
 *
 *  - `bienBao`, gắn ở /v1/tra-cuu/bien-bao: tra cứu công khai như phần tra cứu nhanh. Chỉ biển
 *    đã duyệt; bật TRA_CUU_NHANH_BAN_NHAP=1 để biên tập viên xem cả bản nháp.
 */

import { NHOM_BIEN_BAO } from "@qdpl/dao-tao";
import { type BienBaoRow, bienBaoTheoMa, danhSachBienBao } from "@qdpl/db";
import { docUrnOf } from "@qdpl/legal-model";
import { getObject } from "@qdpl/storage";
import { Hono } from "hono";
import { z } from "zod";
import { notFound, parseQuery } from "../http.ts";
import { vanBanCoTrongKho } from "./tra-cuu-nhanh.ts";

const gomBanNhap = () => process.env.TRA_CUU_NHANH_BAN_NHAP === "1";

/** Tên tệp ảnh trong image_uri (assets/bien-bao/P.102.svg -> P.102.svg). */
const tepAnh = (uri: string) => uri.split("/").pop() ?? uri;

function sangBienBao(r: BienBaoRow, coTrongKho: Set<string>) {
  return {
    ma: r.code,
    nhom: r.group_name,
    ten: r.name,
    y_nghia: r.meaning,
    anh: tepAnh(r.image_uri),
    can_cu: r.citation_urn,
    // Văn bản căn cứ chưa nạp vào kho thì giao diện chỉ ghi viện dẫn, không dẫn tới trang đọc.
    can_cu_mo_duoc: coTrongKho.has(docUrnOf(r.citation_urn)),
    ban_nhap: r.status !== "da_duyet",
  };
}

/* ------------------------------------------------------------------ */
/* Tra cứu                                                             */
/* ------------------------------------------------------------------ */

export const bienBao = new Hono();

bienBao.get("/", async (c) => {
  const p = parseQuery(
    c,
    z.object({ q: z.string().trim().max(100).optional(), nhom: z.enum(NHOM_BIEN_BAO).optional() }),
  );
  const rows = await danhSachBienBao({ q: p.q, nhom: p.nhom, gomBanNhap: gomBanNhap() });
  const coTrongKho = await vanBanCoTrongKho(rows.map((r) => r.citation_urn));
  return c.json({ items: rows.map((r) => sangBienBao(r, coTrongKho)), ban_nhap: gomBanNhap() });
});

const LOAI_ANH: Record<string, string> = { svg: "image/svg+xml", png: "image/png", webp: "image/webp" };

/** GET /v1/tra-cuu/bien-bao/anh/:tep: ảnh biển từ kho đối tượng, cho phép bộ nhớ đệm lâu. */
bienBao.get("/anh/:tep", async (c) => {
  const tep = c.req.param("tep");
  const duoi = /^[\w.-]+\.(svg|png|webp)$/i.exec(tep)?.[1]?.toLowerCase();
  if (!duoi) throw notFound("Không có ảnh này.");
  let du: Uint8Array;
  try {
    du = await getObject(`assets/bien-bao/${tep}`);
  } catch {
    throw notFound("Không có ảnh này.");
  }
  return new Response(du as BodyInit, {
    headers: {
      "content-type": LOAI_ANH[duoi]!,
      "cache-control": "public, max-age=86400",
      // Ảnh SVG tự soạn: không cho chạy mã nhúng nếu có ai mở thẳng tệp.
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
});

bienBao.get("/:ma", async (c) => {
  const r = await bienBaoTheoMa(c.req.param("ma"), gomBanNhap());
  if (!r) throw notFound("Không có biển báo này.");
  return c.json(sangBienBao(r, await vanBanCoTrongKho([r.citation_urn])));
});
