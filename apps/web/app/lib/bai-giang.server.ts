/**
 * Gọi API bài giảng phía máy chủ web (docs/PLAN.md GĐ11).
 *
 * Các trang /hoc cần tài khoản đã được xác minh cán bộ (loader gọi `yeuCauDangNhap`); token gửi
 * kèm để API trả nội dung bài và tiến độ của người học. Ghi (hoàn thành bài, tạo phiên kiểm tra) đi
 * qua `goiApiQuanTri`.
 */
import { apiBase } from "./api";
import { layToken } from "./auth.server";
import type { BaiGiang, ChuyenDeHoc, LinhVucHoc } from "./bai-giang";

async function docApi<T>(request: Request, path: string): Promise<T> {
  const token = layToken(request);
  const res = await fetch(`${apiBase()}${path}`, {
    headers: { accept: "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 404) throw new Response("Không tìm thấy bài giảng này.", { status: 404 });
  if (!res.ok) throw new Response("Không tải được bài giảng. Hãy thử lại sau.", { status: res.status });
  return (await res.json()) as T;
}

interface LinhVucApi {
  items: Array<{
    slug: string;
    name: string;
    summary: string | null;
    nhom: Array<{ nhom: string; chuyenDe: LinhVucHoc["chuyenDe"] }>;
  }>;
}

/**
 * Danh mục `/hoc`: lĩnh vực → chuyên đề đã mở được. Bỏ lớp nhóm đối tượng và cấp độ của
 * `/v1/dao-tao/linh-vuc`: gộp mọi nhóm, chỉ giữ chuyên đề đã xuất bản và có bài. Chỉ chép những
 * trường trang dùng, gồm `phanTram` (null khi chưa ghi danh) và `daHoanThanh`.
 */
export async function danhMucHoc(request: Request, nhom = "tat_ca"): Promise<LinhVucHoc[]> {
  const { items } = await docApi<LinhVucApi>(
    request,
    `/v1/dao-tao/linh-vuc?nhom=${encodeURIComponent(nhom)}`,
  );
  return items
    .map((lv) => ({
      slug: lv.slug,
      name: lv.name,
      summary: lv.summary,
      chuyenDe: lv.nhom
        .flatMap((n) => n.chuyenDe)
        .filter((c) => c.daXuatBan && c.lessonCount > 0)
        .map((c) => ({
          slug: c.slug,
          title: c.title,
          summary: c.summary,
          lessonCount: c.lessonCount,
          durationMinutes: c.durationMinutes,
          daXuatBan: c.daXuatBan,
          phanTram: c.phanTram ?? null,
          daHoanThanh: c.daHoanThanh ?? null,
        })),
    }))
    .filter((lv) => lv.chuyenDe.length > 0);
}

export const chuyenDeHoc = (request: Request, slug: string) =>
  docApi<ChuyenDeHoc>(request, `/v1/dao-tao/chuyen-de/${encodeURIComponent(slug)}`);

export const baiGiang = (request: Request, chuyenDe: string, bai: string) =>
  // Chế độ "đầy đủ": bài giảng đơn giản hiện mọi khối, không lọc theo chế độ học cũ.
  docApi<BaiGiang>(
    request,
    `/v1/dao-tao/chuyen-de/${encodeURIComponent(chuyenDe)}/bai/${encodeURIComponent(bai)}?cheDo=day_du`,
  );
