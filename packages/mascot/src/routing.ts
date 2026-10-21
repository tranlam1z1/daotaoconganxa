/**
 * Chọn nhân vật cho một chuyên đề / một bài / một ngữ cảnh (ke-hoach/09-b §3).
 *
 * Có 7 nhân vật và 6 tầng ưu tiên, nên câu hỏi "vì sao chuyên đề này lại hiện nhân vật kia"
 * không thể trả lời bằng mắt. Hàm chọn vì vậy luôn trả về kèm `lyDo` — màn hình quản trị
 * hiển thị thẳng lý do đó thay vì bắt người vận hành đoán.
 */

import type { NhanVat } from "./types.ts";

export type LyDoChon =
  | "nguoi_hoc_chon"
  | "ban_giao_ngu_canh"
  | "bai_chi_dinh"
  | "chuyen_de_chi_dinh"
  | "khop_doi_tuong"
  | "mac_dinh"
  | "khong_co_nhan_vat";

export const NHAN_LY_DO: Record<LyDoChon, string> = {
  nguoi_hoc_chon: "Người học tự chọn",
  ban_giao_ngu_canh: "Bàn giao theo ngữ cảnh",
  bai_chi_dinh: "Bài học chỉ định",
  chuyen_de_chi_dinh: "Chuyên đề chỉ định",
  khop_doi_tuong: "Khớp đối tượng và chủ đề",
  mac_dinh: "Nhân vật mặc định",
  khong_co_nhan_vat: "Không có nhân vật nào dùng được",
};

export interface NguCanhChon {
  /** Nhân vật đang bật, đã nạp từ CSDL. */
  nhanVat: NhanVat[];
  /** Người học đã chọn (enrollments.mascot_id). */
  nguoiHocChonId?: string | null;
  /** Chuyên đề có khoá quyền đổi của người học không. */
  khoaDoi?: boolean;
  /** Ngữ cảnh đang chiếm quyền: bai_danh_gia, may_tinh_chi_phi… */
  nguCanh?: string | null;
  /** Bảng bàn giao: ngữ cảnh -> id nhân vật. */
  banGiao?: Map<string, string>;
  baiChiDinhId?: string | null;
  chuyenDeChiDinhId?: string | null;
  /** Đối tượng của chuyên đề. */
  audiences?: string[];
  /** Thẻ chủ đề của chuyên đề (taxonomy + tags). */
  topics?: string[];
}

export interface KetQuaChon {
  nhanVat: NhanVat | null;
  lyDo: LyDoChon;
  /** Điểm khớp khi đi theo nhánh `khop_doi_tuong`; 0 với các nhánh khác. */
  diem: number;
}

/**
 * Điểm khớp giữa một nhân vật và một chuyên đề.
 * Đối tượng nặng hơn chủ đề: một chuyên đề chi phí dành cho lãnh đạo thì Sếu Đầu Đỏ vẫn hợp
 * hơn Đắn Đo, vì cách trình bày quyết định người học có theo được hay không.
 */
export function diemKhop(nv: NhanVat, audiences: string[] = [], topics: string[] = []): number {
  if (!nv.enabled) return -1;
  const giao = (a: string[], b: string[]) => a.filter((x) => b.includes(x)).length;
  return giao(nv.audiences, audiences) * 10 + giao(nv.topics, topics) * 3;
}

export function chonNhanVat(nc: NguCanhChon): KetQuaChon {
  const bat = nc.nhanVat.filter((n) => n.enabled);
  const theoId = new Map(bat.map((n) => [n.id, n]));
  const khong: KetQuaChon = { nhanVat: null, lyDo: "khong_co_nhan_vat", diem: 0 };
  if (!bat.length) return khong;

  // 1. Người học tự chọn — trừ khi chuyên đề khoá quyền đổi.
  if (!nc.khoaDoi && nc.nguoiHocChonId) {
    const nv = theoId.get(nc.nguoiHocChonId);
    if (nv) return { nhanVat: nv, lyDo: "nguoi_hoc_chon", diem: 0 };
  }

  // 2. Ngữ cảnh chiếm quyền tạm thời (bài đánh giá, máy tính chi phí…).
  if (nc.nguCanh && nc.banGiao) {
    const id = nc.banGiao.get(nc.nguCanh);
    const nv = id ? theoId.get(id) : undefined;
    if (nv) return { nhanVat: nv, lyDo: "ban_giao_ngu_canh", diem: 0 };
  }

  // 3–4. Bài học rồi tới chuyên đề chỉ định.
  for (const [id, lyDo] of [
    [nc.baiChiDinhId, "bai_chi_dinh"],
    [nc.chuyenDeChiDinhId, "chuyen_de_chi_dinh"],
  ] as const) {
    const nv = id ? theoId.get(id) : undefined;
    if (nv) return { nhanVat: nv, lyDo, diem: 0 };
  }

  // 5. Chấm điểm khớp đối tượng và chủ đề.
  let tot: { nv: NhanVat; diem: number } | undefined;
  for (const nv of bat) {
    const d = diemKhop(nv, nc.audiences, nc.topics);
    if (d > 0 && (!tot || d > tot.diem || (d === tot.diem && nv.ordinal < tot.nv.ordinal))) {
      tot = { nv, diem: d };
    }
  }
  if (tot) return { nhanVat: tot.nv, lyDo: "khop_doi_tuong", diem: tot.diem };

  // 6. Mặc định.
  const macDinh = bat.find((n) => n.isDefault) ?? bat[0];
  return macDinh ? { nhanVat: macDinh, lyDo: "mac_dinh", diem: 0 } : khong;
}

/**
 * Bảng giải thích định tuyến cho toàn bộ chuyên đề — nguồn dữ liệu của bảng ở màn hình
 * `/quan-tri/mascot`. Trả về một dòng cho mỗi chuyên đề, kèm lý do đọc được.
 */
export interface DongDinhTuyen {
  courseId: string;
  courseTitle: string;
  audiences: string[];
  personaCode: string | null;
  personaName: string | null;
  lyDo: LyDoChon;
  nhanLyDo: string;
  khoaDoi: boolean;
}

export function bangDinhTuyen(
  chuyenDe: Array<{
    id: string;
    title: string;
    audiences: string[];
    topics: string[];
    mascotId: string | null;
    mascotLocked: boolean;
  }>,
  nhanVat: NhanVat[],
): DongDinhTuyen[] {
  return chuyenDe.map((cd) => {
    const kq = chonNhanVat({
      nhanVat,
      chuyenDeChiDinhId: cd.mascotId,
      audiences: cd.audiences,
      topics: cd.topics,
      khoaDoi: cd.mascotLocked,
    });
    return {
      courseId: cd.id,
      courseTitle: cd.title,
      audiences: cd.audiences,
      personaCode: kq.nhanVat?.code ?? null,
      personaName: kq.nhanVat ? kq.nhanVat.fullName : null,
      lyDo: kq.lyDo,
      nhanLyDo: NHAN_LY_DO[kq.lyDo],
      khoaDoi: cd.mascotLocked,
    };
  });
}
