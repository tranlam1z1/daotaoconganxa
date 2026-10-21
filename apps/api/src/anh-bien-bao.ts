/**
 * Ảnh biển báo tải lên ở trang quản trị: kiểm rồi cất vào kho đối tượng dưới tiền tố `assets/bien-bao/`,
 * cùng chỗ với ảnh do `bun run bien-bao:nap` tải lên, nên GET /v1/tra-cuu/bien-bao/anh/:tep trả được.
 */
import { anhBienBaoConDung } from "@qdpl/db";
import { deleteObject, putObject } from "@qdpl/storage";
import { badRequest } from "./http.ts";

/** Ảnh biển là hình vẽ đơn giản; 2 MB đủ cho cả ảnh chụp biển thật. */
const ANH_BIEN_TOI_DA = 2 * 1024 * 1024;
const MIME = { svg: "image/svg+xml", png: "image/png", webp: "image/webp" } as const;
type DuoiAnh = keyof typeof MIME;

/** Nội dung có đúng định dạng của đuôi không, theo byte đầu tệp chứ không tin content-type gửi lên. */
function dungDinhDang(du: Uint8Array, duoi: DuoiAnh): boolean {
  const la = (tu: number, ...b: number[]) => b.every((x, i) => du[tu + i] === x);
  if (duoi === "png") return la(0, 0x89, 0x50, 0x4e, 0x47);
  if (duoi === "webp") return la(0, 0x52, 0x49, 0x46, 0x46) && la(8, 0x57, 0x45, 0x42, 0x50);
  return new TextDecoder().decode(du.subarray(0, 2048)).includes("<svg");
}

/**
 * Kiểm ảnh gửi lên ở trường `tep` của form multipart rồi cất vào kho, trả URI. Tên trong kho gồm mã
 * biển và hash nội dung, nên thay ảnh là đổi URI và bộ nhớ đệm một ngày của ảnh cũ không gây nhầm.
 */
export async function luuAnhBienBao(ma: string, tep: unknown): Promise<string> {
  if (!(tep instanceof File) || tep.size === 0) throw badRequest('Thiếu ảnh biển trong trường "tep".');
  if (tep.size > ANH_BIEN_TOI_DA) throw badRequest("Ảnh quá lớn, tối đa 2 MB.");
  const loi = "Chỉ nhận ảnh SVG, PNG hoặc WebP.";
  const duoi = /\.(svg|png|webp)$/i.exec(tep.name)?.[1]?.toLowerCase() as DuoiAnh | undefined;
  if (!duoi) throw badRequest(loi);
  const du = new Uint8Array(await tep.arrayBuffer());
  if (!dungDinhDang(du, duoi)) throw badRequest(`Nội dung tệp không phải ảnh .${duoi}. ${loi}`);
  const hash = new Bun.CryptoHasher("sha256").update(du).digest("hex").slice(0, 16);
  const uri = `assets/bien-bao/${ma}-${hash}.${duoi}`;
  await putObject(uri, du, { contentType: MIME[duoi] });
  return uri;
}

/** Gỡ ảnh không còn biển nào dùng; lỗi kho không làm hỏng thao tác chính. */
export async function xoaAnhBienBaoMoCoi(uri: string | null | undefined) {
  if (!uri || (await anhBienBaoConDung(uri))) return;
  await deleteObject(uri).catch((e) => console.warn("[bien-bao] không xóa được ảnh cũ:", uri, e));
}
