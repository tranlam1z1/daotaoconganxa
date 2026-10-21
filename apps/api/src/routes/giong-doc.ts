/**
 * API giọng nói (docs/PLAN.md GĐ14), gắn ở /v1/giong-doc. Mọi endpoint bắt buộc đăng nhập.
 *
 *  - Đọc thành tiếng (TTS, Vbee): đọc câu hỏi, lời thoại. `/v1/mascot/giong-doc` là bí danh cũ,
 *    dùng chung hai handler dưới đây.
 *  - Khớp lời nói với phương án: trình duyệt nhận dạng giọng nói (Web Speech API) thành chữ, máy
 *    chủ quyết định chữ đó chỉ phương án nào (packages/dao-tao/src/khop-loi-noi.ts).
 *  - Sách nói: danh sách tệp âm thanh của một bài, tải từng tệp, lưu vị trí nghe.
 */
import type { Principal } from "@qdpl/auth";
import { khopLoiNoi } from "@qdpl/dao-tao";
import { amThanhCuaBai, baiHocTheoId, chuyenDeTheoId, luuViTriNghe, viTriNghe } from "@qdpl/db";
import { getObject } from "@qdpl/storage";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { batBuocDangNhap } from "../auth.ts";
import {
  choPhepDoc,
  chuanBiGiongDoc,
  coGiongDoc,
  daCoSan,
  TOI_DA_CHUAN_BI,
  TOI_DA_KY_TU,
  tongHopGiongDoc,
} from "../giong-doc.ts";
import { badRequest, notFound, parseBody } from "../http.ts";

export const giongDoc = new Hono();

const uuid = z.string().uuid();

/** Hạn mức đọc tính theo tài khoản. */
function khoaHanMuc(p: Principal): string {
  return `tk:${p.accountId ?? p.email}`;
}

/** POST /v1/giong-doc — đọc một lời thành tiếng, trả MP3. Lời đã có sẵn không tính vào hạn mức. */
export async function docThanhTieng(c: Context) {
  const p = await batBuocDangNhap(c);
  const body = await parseBody(c, z.object({ text: z.string().trim().min(1).max(TOI_DA_KY_TU) }));
  if (!coGiongDoc()) {
    return c.json({ error: { code: "chua_ho_tro", message: "Chưa bật giọng đọc" } }, 501);
  }
  if (!(await daCoSan(body.text)) && !choPhepDoc(khoaHanMuc(p))) {
    return c.json(
      { error: { code: "qua_han_muc", message: "Đọc quá nhiều trong thời gian ngắn, thử lại sau." } },
      429,
    );
  }
  try {
    const mp3 = await tongHopGiongDoc(body.text);
    return c.body(mp3, 200, { "content-type": "audio/mpeg", "cache-control": "private, max-age=86400" });
  } catch (e) {
    console.error("[giong-doc] không đọc được lời:", e instanceof Error ? e.message : e);
    return c.json({ error: { code: "loi_may_chu", message: "Không đọc được lời này" } }, 502);
  }
}

/** POST /v1/giong-doc/chuan-bi — đọc trước các lời sắp dùng. Trả ngay, không chờ đọc xong. */
export async function chuanBiDoc(c: Context) {
  const p = await batBuocDangNhap(c);
  const body = await parseBody(
    c,
    z.object({ texts: z.array(z.string().trim().max(TOI_DA_KY_TU)).max(TOI_DA_CHUAN_BI) }),
  );
  if (!coGiongDoc()) return c.json({ ok: false });
  chuanBiGiongDoc(body.texts, khoaHanMuc(p)).catch((e) =>
    console.warn("[giong-doc] không đọc trước được:", e instanceof Error ? e.message : e),
  );
  return c.json({ ok: true });
}

/** GET /v1/giong-doc — máy chủ có đọc thành tiếng được không (giao diện ẩn nút khi không). */
giongDoc.get("/", async (c) => {
  await batBuocDangNhap(c);
  return c.json({ doc_thanh_tieng: coGiongDoc() });
});

giongDoc.post("/", docThanhTieng);
giongDoc.post("/chuan-bi", chuanBiDoc);

/**
 * POST /v1/giong-doc/khop — lời nói chỉ phương án nào. `phuong_an` theo đúng thứ tự đang hiện
 * trên màn hình (chữ cái A, B, C tính theo thứ tự này). Không chắc thì trả `khong_chac`.
 */
giongDoc.post("/khop", async (c) => {
  await batBuocDangNhap(c);
  const b = await parseBody(
    c,
    z.object({
      loi_noi: z.string().max(500),
      phuong_an: z
        .array(z.object({ id: z.string().min(1).max(80), text: z.string().max(1000) }))
        .min(1)
        .max(12),
    }),
  );
  return c.json(khopLoiNoi(b.loi_noi, b.phuong_an));
});

/* ------------------------------------------------------------------ */
/* Sách nói                                                            */
/* ------------------------------------------------------------------ */

/** Bài đã xuất bản (của chuyên đề đã xuất bản), không thì 404. */
async function baiDaXuatBan(id: string) {
  if (!uuid.safeParse(id).success) throw notFound("Không có bài học này.");
  const bai = await baiHocTheoId(id);
  const course = bai ? await chuyenDeTheoId(bai.course_id) : undefined;
  if (bai?.status !== "xuat_ban" || course?.status !== "xuat_ban") throw notFound("Không có bài học này.");
  return bai;
}

/** GET /v1/giong-doc/sach-noi/:bai — tệp âm thanh từng khối của bài và vị trí nghe dở. */
giongDoc.get("/sach-noi/:bai", async (c) => {
  const p = await batBuocDangNhap(c);
  const bai = await baiDaXuatBan(c.req.param("bai"));
  const [ds, viTri] = await Promise.all([
    amThanhCuaBai(bai.id),
    p.accountId ? viTriNghe(p.accountId, bai.id) : Promise.resolve(undefined),
  ]);
  return c.json({
    khoi: ds.map((a) => ({ block_id: a.block_id, thu_tu: a.ordinal, giay: Number(a.seconds) })),
    vi_tri: viTri ? { block_id: viTri.block_id, giay: Number(viTri.offset_seconds) } : null,
  });
});

/** GET /v1/giong-doc/sach-noi/:bai/:khoi — tệp MP3 của một khối. */
giongDoc.get("/sach-noi/:bai/:khoi", async (c) => {
  await batBuocDangNhap(c);
  const bai = await baiDaXuatBan(c.req.param("bai"));
  const a = (await amThanhCuaBai(bai.id)).find((x) => x.block_id === c.req.param("khoi"));
  if (!a) throw notFound("Khối này chưa có bản đọc.");
  try {
    const mp3 = await getObject(a.uri);
    return c.body(mp3 as Uint8Array<ArrayBuffer>, 200, {
      "content-type": "audio/mpeg",
      "cache-control": "private, max-age=86400",
    });
  } catch (e) {
    console.error("[sach-noi] không đọc được tệp:", a.uri, e instanceof Error ? e.message : e);
    throw notFound("Không tải được bản đọc của khối này.");
  }
});

/** POST /v1/giong-doc/sach-noi/:bai/vi-tri — lưu vị trí nghe (khối và giây trong khối). */
giongDoc.post("/sach-noi/:bai/vi-tri", async (c) => {
  const p = await batBuocDangNhap(c);
  if (!p.accountId) throw badRequest("Phiên đăng nhập không gắn với tài khoản nào.");
  const bai = await baiDaXuatBan(c.req.param("bai"));
  const b = await parseBody(c, z.object({ block_id: uuid.nullable(), giay: z.number().min(0).max(36_000) }));
  if (b.block_id && !(await amThanhCuaBai(bai.id)).some((x) => x.block_id === b.block_id)) {
    throw badRequest("Khối này không thuộc sách nói của bài.");
  }
  await luuViTriNghe({
    accountId: p.accountId,
    lessonId: bai.id,
    blockId: b.block_id,
    offsetSeconds: b.giay,
  });
  return c.json({ ok: true });
});
