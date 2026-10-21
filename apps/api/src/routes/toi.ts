/**
 * Dữ liệu học tập của chính người đang đăng nhập (docs/PLAN.md GĐ4), gắn ở /v1/toi.
 * Chỉ trả dữ liệu của người gọi, nên không có tham số tài khoản nào.
 */

import { cauSaiCuaToi, hoSoChuDe, lichSuPhienCuaToi, sql, tongQuanDiem } from "@qdpl/db";
import { deleteObject, getObject, putObject } from "@qdpl/storage";
import { Hono } from "hono";
import { batBuocDangNhap } from "../auth.ts";
import { badRequest, notFound } from "../http.ts";

export const toi = new Hono();

async function taiKhoan(c: Parameters<typeof batBuocDangNhap>[0]): Promise<string> {
  const p = await batBuocDangNhap(c);
  if (!p.accountId) throw badRequest("Phiên đăng nhập không gắn với tài khoản nào.");
  return p.accountId;
}

/** GET /v1/toi/lich-su: 20 phiên luyện tập gần nhất. */
toi.get("/lich-su", async (c) => {
  return c.json({ items: await lichSuPhienCuaToi(await taiKhoan(c), 20) });
});

/** GET /v1/toi/cau-sai: câu sai còn trong danh sách (chỉ đề, không có đáp án). */
toi.get("/cau-sai", async (c) => {
  const items = await cauSaiCuaToi(await taiKhoan(c));
  return c.json({ items, tong: items.length });
});

/**
 * GET /v1/toi/tong-quan: XP (tổng và tuần này), cấp độ, chuỗi ngày học, huy hiệu, thử thách hôm
 * nay (docs/PLAN.md GĐ9).
 */
toi.get("/tong-quan", async (c) => {
  return c.json(await tongQuanDiem(await taiKhoan(c)));
});

/**
 * GET /v1/toi/ho-so-chu-de: chủ đề mạnh nhất và yếu nhất của tôi, tính từ mọi câu trả lời trong
 * luyện tập, thi và trò chơi (docs/PLAN.md GĐ-G0).
 */
toi.get("/ho-so-chu-de", async (c) => {
  return c.json(await hoSoChuDe(await taiKhoan(c)));
});

/** Ảnh đại diện tải lên tối đa 2 MB; trang web đã thu nhỏ về 256×256 trước khi gửi. */
const ANH_TOI_DA = 2 * 1024 * 1024;
const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };
const MAU_TEP_ANH = /^[0-9a-f-]{36}-[0-9a-f]{16}\.(png|jpg|webp)$/;

/** Nhận dạng ảnh theo byte đầu tệp, không tin phần mở rộng hay content-type trình duyệt gửi. */
export function loaiAnh(du: Uint8Array): "png" | "jpg" | "webp" | null {
  const la = (tu: number, ...b: number[]) => b.every((x, i) => du[tu + i] === x);
  if (la(0, 0x89, 0x50, 0x4e, 0x47)) return "png";
  if (la(0, 0xff, 0xd8, 0xff)) return "jpg";
  if (la(0, 0x52, 0x49, 0x46, 0x46) && la(8, 0x57, 0x45, 0x42, 0x50)) return "webp";
  return null;
}

/** Gỡ ảnh cũ khỏi kho; lỗi kho không làm hỏng thao tác chính. */
async function xoaAnhCu(uri: string | null | undefined) {
  if (!uri) return;
  await deleteObject(uri).catch((e) => console.warn("[toi] không xóa được ảnh đại diện cũ:", uri, e));
}

/**
 * PUT /v1/toi/anh-dai-dien (multipart: `tep`): đặt ảnh đại diện mới (PNG, JPEG, WebP).
 * Tên tệp gồm id tài khoản và hash nội dung, nên đổi ảnh là đổi URI (đệm lâu không bị cũ).
 */
toi.put("/anh-dai-dien", async (c) => {
  const accountId = await taiKhoan(c);
  const tep = (await c.req.parseBody()).tep;
  if (!(tep instanceof File) || tep.size === 0) throw badRequest("Chưa chọn ảnh.");
  if (tep.size > ANH_TOI_DA) throw badRequest("Ảnh quá lớn, tối đa 2 MB.");
  const du = new Uint8Array(await tep.arrayBuffer());
  const duoi = loaiAnh(du);
  if (!duoi) throw badRequest("Chỉ nhận ảnh PNG, JPEG hoặc WebP.");

  const hash = new Bun.CryptoHasher("sha256").update(du).digest("hex").slice(0, 16);
  const ten = `${accountId}-${hash}.${duoi}`;
  const uri = `avatars/${ten}`;
  await putObject(uri, du, { contentType: MIME[duoi]! });

  const [cu] = (await sql`SELECT avatar_uri FROM accounts WHERE id = ${accountId}`) as any[];
  await sql`UPDATE accounts SET avatar_uri = ${uri} WHERE id = ${accountId}`;
  if (cu?.avatar_uri !== uri) await xoaAnhCu(cu?.avatar_uri);
  return c.json({ anh_dai_dien: ten });
});

/** DELETE /v1/toi/anh-dai-dien: bỏ ảnh đại diện, quay về chữ cái đầu của tên. */
toi.delete("/anh-dai-dien", async (c) => {
  const accountId = await taiKhoan(c);
  const [cu] = (await sql`SELECT avatar_uri FROM accounts WHERE id = ${accountId}`) as any[];
  await sql`UPDATE accounts SET avatar_uri = NULL WHERE id = ${accountId}`;
  await xoaAnhCu(cu?.avatar_uri);
  return c.json({ anh_dai_dien: null });
});

/**
 * GET /v1/toi/anh-dai-dien/:tep: tệp ảnh đại diện, KHÔNG cần đăng nhập để thẻ <img> tải được
 * qua máy chủ web. Tên tệp có hash nội dung nên cho đệm vĩnh viễn.
 */
toi.get("/anh-dai-dien/:tep", async (c) => {
  const tep = c.req.param("tep");
  const duoi = MAU_TEP_ANH.exec(tep)?.[1];
  if (!duoi) throw notFound("Không có ảnh này.");
  let du: Uint8Array;
  try {
    du = await getObject(`avatars/${tep}`);
  } catch {
    throw notFound("Không có ảnh này.");
  }
  return new Response(du as BodyInit, {
    headers: {
      "content-type": MIME[duoi]!,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
});
