/**
 * Tệp của biểu mẫu, hướng dẫn (trang "Quy trình, Biểu mẫu"): nhận tệp tải lên ở trang quản trị, cất
 * vào kho đối tượng dưới tiền tố `bieu-mau/`, và trả tệp cho cán bộ xem hoặc tải về.
 */
import { DUOI_TEP_TAI_LIEU, type DuoiTepTaiLieu, type TepTaiLieu } from "@qdpl/db";
import { deleteObject, getObject, putObject, slugKey } from "@qdpl/storage";
import { badRequest, notFound } from "./http.ts";

/** Biểu mẫu Word, PDF thường dưới 1 MB; bản quét nhiều trang có thể tới chục MB. */
export const TEP_TAI_LIEU_TOI_DA = 20 * 1024 * 1024;

const MIME: Record<DuoiTepTaiLieu, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
};

/** Họ định dạng theo byte đầu tệp: PDF, gói ZIP (docx, xlsx) hoặc OLE (doc, xls). */
function hoDinhDang(du: Uint8Array): "pdf" | "zip" | "ole" | null {
  const la = (...b: number[]) => b.every((x, i) => du[i] === x);
  if (la(0x25, 0x50, 0x44, 0x46, 0x2d)) return "pdf";
  if (la(0x50, 0x4b, 0x03, 0x04)) return "zip";
  if (la(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)) return "ole";
  return null;
}

const HO_CUA_DUOI: Record<DuoiTepTaiLieu, "pdf" | "zip" | "ole"> = {
  pdf: "pdf",
  docx: "zip",
  xlsx: "zip",
  doc: "ole",
  xls: "ole",
};

/**
 * Kiểm tệp gửi lên ở trường `tep` của form multipart rồi cất vào kho. Đuôi lấy từ tên tệp nhưng
 * phải khớp byte đầu tệp, không tin content-type trình duyệt gửi. Tên trong kho gồm mã biểu mẫu và
 * hash nội dung, nên thay tệp là đổi URI.
 */
export async function luuTepTaiLieu(ma: string, tep: unknown): Promise<TepTaiLieu> {
  if (!(tep instanceof File) || tep.size === 0) throw badRequest('Thiếu tệp trong trường "tep".');
  if (tep.size > TEP_TAI_LIEU_TOI_DA) throw badRequest("Tệp quá lớn, tối đa 20 MB.");
  // Bỏ phần thư mục và ký tự điều khiển; tên này hiện cho cán bộ và làm tên tệp khi tải về.
  const ten = tep.name
    .replace(/^.*[\\/]/, "")
    // biome-ignore lint/suspicious/noControlCharactersInRegex: gỡ ký tự điều khiển khỏi tên tệp
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 200);
  const duoi = /\.([a-z0-9]+)$/i.exec(ten)?.[1]?.toLowerCase() as DuoiTepTaiLieu | undefined;
  const loiDinhDang = "Chỉ nhận tệp PDF, Word (.docx, .doc) hoặc Excel (.xlsx, .xls).";
  if (!duoi || !(DUOI_TEP_TAI_LIEU as readonly string[]).includes(duoi)) throw badRequest(loiDinhDang);
  const du = new Uint8Array(await tep.arrayBuffer());
  if (hoDinhDang(du) !== HO_CUA_DUOI[duoi])
    throw badRequest(`Nội dung tệp không phải định dạng .${duoi}. ${loiDinhDang}`);

  const hash = new Bun.CryptoHasher("sha256").update(du).digest("hex").slice(0, 16);
  const uri = `bieu-mau/${ma}-${hash}.${duoi}`;
  await putObject(uri, du, { contentType: MIME[duoi] });
  return { uri, ten, duoi, kichThuoc: du.byteLength };
}

/** Gỡ tệp khỏi kho; lỗi kho không làm hỏng thao tác chính. */
export async function xoaTepTaiLieu(uri: string | null | undefined) {
  if (!uri) return;
  await deleteObject(uri).catch((e) => console.warn("[bieu-mau] không xóa được tệp cũ:", uri, e));
}

/**
 * Trả tệp. PDF mở ngay trong trình duyệt, trừ khi `taiVe`; Word, Excel luôn tải về. Tên tải về là tên
 * tệp lúc tải lên (dạng không dấu cho trình duyệt cũ, dạng đầy đủ qua `filename*`).
 */
export async function traTepTaiLieu(tep: TepTaiLieu, taiVe: boolean): Promise<Response> {
  let du: Uint8Array;
  try {
    du = await getObject(tep.uri);
  } catch {
    throw notFound("Không còn tệp của biểu mẫu này trong kho.");
  }
  const khongDau = `${slugKey(tep.ten.replace(/\.[^.]*$/, "")) || "bieu-mau"}.${tep.duoi}`;
  const kieu = tep.duoi === "pdf" && !taiVe ? "inline" : "attachment";
  return new Response(du as BodyInit, {
    headers: {
      "content-type": MIME[tep.duoi],
      "content-disposition": `${kieu}; filename="${khongDau}"; filename*=UTF-8''${encodeURIComponent(tep.ten)}`,
      // Tệp có thể bị thay hoặc ngừng dùng: không cho đệm lâu.
      "cache-control": "private, max-age=60",
      "x-content-type-options": "nosniff",
    },
  });
}
