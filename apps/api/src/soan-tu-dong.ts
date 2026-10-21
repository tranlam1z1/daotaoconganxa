/**
 * Tạo một lần soạn tự động cả chuyên đề từ văn bản trong kho. Dùng chung cho
 * `POST /v1/quan-tri/dao-tao/soan-tu-dong` (chọn văn bản có sẵn) và luồng tạo chuyên đề từ PDF.
 *
 * Việc cha lập dàn ý, tạo bài nháp, rồi giao mỗi bài: soạn khối nội dung, một bài tự luận (cả hai
 * tự nhận vào bản nháp) và câu trắc nghiệm vào ngân hàng ở `cho_duyet`. Không có gì tới người học
 * trước khi bài được xuất bản và câu hỏi được duyệt.
 */

import { atLeast, type Role } from "@qdpl/auth";
import { type LoaiCauHoi, slugTuTieuDe } from "@qdpl/dao-tao";
import {
  type AuthoringJobRow,
  BUOC_SOAN_TU_DONG,
  type CourseRow,
  chuyenDeTheoId,
  chuyenDeTheoSlug,
  dieuKhoanNguCanh,
  luuChuyenDe,
  taoViecSoanBai,
} from "@qdpl/db";
import { costOf, loadPrompt, modelFor } from "@qdpl/llm";
import { ghiNhatKy, KhongDuQuyen } from "./auth.ts";
import { type CheDoChay, khoiChayViecSoanBai } from "./chay-soan-bai.ts";
import { badRequest, notFound } from "./http.ts";

/** Ước tính vượt mức này (USD) thì cần pháp chế, như việc soạn bài lô lớn. */
export function tranChiPhiSoanTuDong(): number {
  const n = Number(process.env.SOAN_TU_DONG_TRAN_USD ?? 20);
  return Number.isFinite(n) && n >= 0 ? n : 20;
}

/** Token ra ước tính: dàn ý mỗi bài, khối nội dung một bài, một bài tự luận, một câu hỏi ngân hàng. */
const TOKEN_RA = { danY: 300, khoi: 4_000, tuLuan: 1_500, cauHoi: 450 } as const;

/**
 * Ước tính thô chi phí cả lần soạn: một lời gọi dàn ý trên toàn văn bản, rồi mỗi bài tối đa ba lời
 * gọi trên phần văn bản của bài (coi như chia đều). Khoảng 3 ký tự một token, như provider mock đếm.
 */
function uocTinhSoanTuDong(
  kyTuNguCanh: number,
  soBai: number,
  soCauHoi: number,
  tuLuan: boolean,
  batch: boolean,
) {
  const kyTuPrompt = (ten: string) => {
    const p = loadPrompt(ten);
    return p.system.length + p.user.length;
  };
  const nguCanh = kyTuNguCanh / 3;
  const moiBai = (nguCanh / soBai) * 1.5;
  const tokensIn = Math.ceil(
    kyTuPrompt("dao-tao/dan-y-tu-van-ban") / 3 +
      nguCanh +
      soBai *
        (kyTuPrompt("dao-tao/soan-bai-hoc") / 3 +
          moiBai +
          (tuLuan ? kyTuPrompt("dao-tao/sinh-bai-tap") / 3 + moiBai : 0) +
          (soCauHoi ? kyTuPrompt("dao-tao/sinh-cau-hoi-ngan-hang") / 3 + moiBai : 0)),
  );
  const tokensOut =
    soBai * (TOKEN_RA.danY + TOKEN_RA.khoi + (tuLuan ? TOKEN_RA.tuLuan : 0) + soCauHoi * TOKEN_RA.cauHoi);
  const model = modelFor("bulk");
  return {
    model,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    chi_phi_usd: Math.round(costOf(model, tokensIn, tokensOut, 0, batch) * 10_000) / 10_000,
    so_viec: 1 + soBai * (1 + (tuLuan ? 1 : 0) + (soCauHoi ? 1 : 0)),
  };
}

/** Slug chuyên đề chưa dùng: thêm hậu tố số khi trùng. */
export async function slugChuyenDeMoi(tieuDe: string): Promise<string> {
  const goc = slugTuTieuDe(tieuDe, 70) || "chuyen-de";
  for (let i = 1; ; i++) {
    const slug = i === 1 ? goc : `${goc}-${i}`;
    if (!(await chuyenDeTheoSlug(slug))) return slug;
  }
}

/** Số bài khi người soạn không nêu: khoảng bốn Điều một bài, tối đa 12 bài. */
export function soBaiTheoSoDieu(soDieu: number): number {
  return Math.min(12, Math.max(1, Math.ceil(soDieu / 4)));
}

export interface YeuCauSoanTuDong {
  urns: string[];
  /** Đúng một trong hai: chuyên đề có sẵn, hoặc tên chuyên đề mới. */
  course_id?: string | undefined;
  ten_chuyen_de?: string | undefined;
  linh_vuc_id?: string | undefined;
  /** Bỏ trống thì tính theo số Điều (`soBaiTheoSoDieu`). */
  so_bai?: number | undefined;
  so_cau_hoi: number;
  tu_luan: boolean;
  loai_cau_hoi: LoaiCauHoi[];
  as_of?: string | undefined;
  vi_du?: string | undefined;
  batch: boolean;
  chay_thu: boolean;
}

export interface ChuanBiSoanTuDong {
  as_of: string;
  uoc_tinh: ReturnType<typeof uocTinhSoanTuDong>;
  dieu_khoan: Array<{ urn: string; label: string; heading: string | null; short_title: string | null }>;
  bo_qua: Array<{ urn: string; label: string }>;
}

export type KetQuaSoanTuDong =
  | { chayThu: true; chuanBi: ChuanBiSoanTuDong }
  | {
      chayThu: false;
      chuanBi: ChuanBiSoanTuDong;
      viec: AuthoringJobRow;
      course: CourseRow;
      cheDo: CheDoChay | "cho";
    };

export async function taoLanSoanTuDong(
  nguoi: { email: string; role: Role },
  b: YeuCauSoanTuDong,
): Promise<KetQuaSoanTuDong> {
  const asOf = b.as_of ?? new Date().toISOString().slice(0, 10);

  const courseCo = b.course_id ? await chuyenDeTheoId(b.course_id) : undefined;
  if (b.course_id && !courseCo) throw notFound("Không tìm thấy chuyên đề");

  const dieuKhoan = await dieuKhoanNguCanh(b.urns, asOf);
  const coNut = new Set(dieuKhoan.map((d) => d.urn));
  const thieu = b.urns.filter((u) => !coNut.has(u) && !dieuKhoan.some((d) => d.doc_urn === u));
  if (thieu.length) {
    throw badRequest(
      `Không tìm thấy điều khoản có hiệu lực tại ${asOf}`,
      thieu.map((u) => `${u}: không có trong kho hoặc không có hiệu lực tại ngày này`),
    );
  }
  // Điều khoản bị bãi bỏ hay ngưng hiệu lực: bỏ qua và báo lại, không chặn cả văn bản.
  const boQua = dieuKhoan.filter((d) => d.node_status === "repealed" || d.node_status === "suspended");
  const dung = dieuKhoan.filter((d) => !boQua.includes(d));
  if (!dung.length) throw badRequest("Mọi điều khoản đã chọn đều đã bị bãi bỏ hoặc ngưng hiệu lực");

  const kyTu = dung.reduce(
    (s, d) => s + d.urn.length + d.label.length + (d.heading?.length ?? 0) + d.text.length + 8,
    0,
  );
  const soBai = Math.min(b.so_bai ?? soBaiTheoSoDieu(dung.length), dung.length);
  const uocTinh = uocTinhSoanTuDong(kyTu, soBai, b.so_cau_hoi, b.tu_luan, b.batch);
  const chuanBi: ChuanBiSoanTuDong = {
    as_of: asOf,
    uoc_tinh: uocTinh,
    dieu_khoan: dung.map((d) => ({
      urn: d.urn,
      label: d.label,
      heading: d.heading,
      short_title: d.short_title,
    })),
    bo_qua: boQua.map((d) => ({ urn: d.urn, label: d.label })),
  };
  if (b.chay_thu) return { chayThu: true, chuanBi };

  if (uocTinh.chi_phi_usd > tranChiPhiSoanTuDong() && !atLeast(nguoi.role, "phap_che")) {
    throw new KhongDuQuyen("phap_che");
  }

  const course =
    courseCo ??
    (await luuChuyenDe({
      slug: await slugChuyenDeMoi(b.ten_chuyen_de!),
      title: b.ten_chuyen_de!,
      summary: `Soạn tự động từ ${[...new Set(dung.map((d) => d.short_title ?? d.doc_urn))].join(", ")}.`,
      asOf,
      fieldId: b.linh_vuc_id ?? null,
    }));
  const viec = await taoViecSoanBai({
    courseId: course.id,
    step: BUOC_SOAN_TU_DONG,
    input: {
      urns: b.urns,
      so_bai: soBai,
      so_cau_hoi: b.so_cau_hoi,
      tu_luan: b.tu_luan,
      loai_cau_hoi: b.loai_cau_hoi,
      as_of: asOf,
      ...(b.vi_du ? { vi_du: b.vi_du } : {}),
    },
    // Ngân sách: gấp đôi ước tính, để mô hình trả dài hơn dự kiến vẫn nằm trong trần.
    budgetUsd: Math.max(0.01, Math.round(uocTinh.chi_phi_usd * 2 * 10_000) / 10_000),
    batch: b.batch,
    requestedBy: nguoi.email,
  });
  await ghiNhatKy(nguoi.email, "dao_tao.soan_tu_dong.tao", viec.id, {
    chuyen_de: course.slug,
    chuyen_de_moi: !courseCo,
    so_bai: soBai,
    uoc_tinh_usd: uocTinh.chi_phi_usd,
  });

  return { chayThu: false, chuanBi, viec, course, cheDo: await khoiChayViecSoanBai(viec.id) };
}
