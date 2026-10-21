/**
 * Tạo việc AI sinh câu hỏi vào ngân hàng (docs/PLAN.md GĐ8), dùng chung cho hai lối vào:
 *  - /v1/quan-tri/ngan-hang/sinh-ai: biên tập viên chọn chủ đề và điều khoản;
 *  - /v1/quan-tri/dao-tao/bai/:id/sinh-cau-hoi: sinh cho một bài học, vào chủ đề của bài.
 *
 * Hai lối vào phải kiểm cùng một bộ luật (điều khoản có hiệu lực, không bị bãi bỏ, trần chi phí),
 * nên luật nằm ở đây chứ không chép vào từng route.
 */

import { atLeast, type Principal } from "@qdpl/auth";
import type { LoaiCauHoi, MucDoCauHoi } from "@qdpl/dao-tao";
import { BUOC_SINH_CAU_HOI, type ChuDeCauHoiRow, dieuKhoanNguCanh, taoViecSoanBai } from "@qdpl/db";
import { costOf, loadPrompt, modelFor } from "@qdpl/llm";
import { ghiNhatKy, KhongDuQuyen } from "./auth.ts";
import { khoiChayViecSoanBai } from "./chay-soan-bai.ts";
import { badRequest, conflict } from "./http.ts";
import { aiChuaCauHinh } from "./routes/ask.ts";

/** Ước tính chi phí vượt mức này (USD) thì cần vai trò pháp chế, như việc soạn bài lô lớn. */
export function tranChiPhiAi(): number {
  const n = Number(process.env.NGAN_HANG_AI_TRAN_USD ?? 2);
  return Number.isFinite(n) && n >= 0 ? n : 2;
}

/** Số token ra ước tính cho mỗi câu (đề, phương án, giải thích, căn cứ dạng JSON). */
const TOKEN_RA_MOI_CAU = 450;
/** Câu tự luận dài hơn: tình huống, dàn ý đáp án gợi ý và rubric nhiều tiêu chí. */
const TOKEN_RA_MOI_CAU_TU_LUAN = 900;

/** Token ra ước tính cho một lô: mô hình chia đều số câu cho các loại được yêu cầu. */
function tokenRa(soCau: number, loai: LoaiCauHoi[]): number {
  const tyLeTuLuan = loai.length ? loai.filter((l) => l === "tu_luan").length / loai.length : 0;
  return Math.ceil(soCau * (TOKEN_RA_MOI_CAU * (1 - tyLeTuLuan) + TOKEN_RA_MOI_CAU_TU_LUAN * tyLeTuLuan));
}

export interface YeuCauSinhCauHoi {
  urns: string[];
  /**
   * Chủ đề nhận câu hỏi. Chỉ gọi khi thật sự tạo việc (sau chạy thử và kiểm trần chi phí), để lối
   * vào nào tạo chủ đề khi cần thì chạy thử không để lại chủ đề rác.
   */
  layChuDe: () => Promise<ChuDeCauHoiRow>;
  loai: LoaiCauHoi[];
  mucDo: MucDoCauHoi | null;
  soCau: number;
  asOf: string;
  /** Chỉ trả điều khoản và ước tính chi phí, chưa tạo việc. */
  chayThu: boolean;
  /** Loại hẳn câu gần giống câu đã có, thay vì nhận kèm đánh dấu trùng. */
  loaiTrung?: boolean;
  /** Bài học mà câu hỏi được sinh cho, để truy vết từ việc về bài. */
  lessonId?: string | null;
  courseId?: string | null;
}

/**
 * Kiểm điều khoản, ước tính chi phí, rồi (nếu không chạy thử) tạo việc và cho chạy: qua hàng đợi
 * khi có worker đang nghe, không thì ngay trong API (chay-soan-bai.ts).
 * Trả `taoViec: false` khi chạy thử. Ném `badRequest` khi điều khoản không dùng được, và
 * `KhongDuQuyen` khi ước tính vượt trần mà người gọi chưa đủ vai trò pháp chế.
 */
export async function taoViecSinhCauHoi(p: Pick<Principal, "email" | "role">, y: YeuCauSinhCauHoi) {
  // Máy chủ khai không có dịch vụ AI (LLM_PROVIDER=none): provider giả lập chỉ trả câu giữ chỗ ghép từ
  // ngữ cảnh, không được để lọt vào ngân hàng và đề thi như câu hỏi thật.
  if (aiChuaCauHinh()) {
    throw conflict(
      "Máy chủ chưa cấu hình dịch vụ AI nên chưa sinh được câu hỏi. Hãy soạn câu hỏi thủ công hoặc nhập từ tệp Excel.",
    );
  }
  const dieuKhoan = await dieuKhoanNguCanh(y.urns, y.asOf);
  const coNut = new Set(dieuKhoan.map((d) => d.urn));
  const thieu = y.urns.filter((u) => !coNut.has(u) && !dieuKhoan.some((d) => d.doc_urn === u));
  if (thieu.length) {
    throw badRequest(
      `Không tìm thấy điều khoản có hiệu lực tại ${y.asOf}`,
      thieu.map((u) => `${u}: không có trong kho hoặc không có hiệu lực tại ngày này`),
    );
  }
  const biBo = dieuKhoan.filter((d) => d.node_status === "repealed" || d.node_status === "suspended");
  if (biBo.length) {
    throw badRequest(
      "Không sinh câu hỏi từ điều khoản đã bị bãi bỏ hoặc ngưng hiệu lực",
      biBo.map((d) => `${d.urn}: ${d.label}`),
    );
  }

  // Ước tính như provider mock đếm: khoảng 3 ký tự một token.
  const prompt = loadPrompt("dao-tao/sinh-cau-hoi-ngan-hang");
  const kyTu =
    prompt.system.length +
    prompt.user.length +
    dieuKhoan.reduce(
      (s, d) => s + d.urn.length + d.label.length + (d.heading?.length ?? 0) + d.text.length + 8,
      0,
    );
  const model = modelFor("bulk");
  const tokensIn = Math.ceil(kyTu / 3);
  const tokensOut = tokenRa(y.soCau, y.loai);
  const uocTinh = {
    model,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    chi_phi_usd: Math.round(costOf(model, tokensIn, tokensOut) * 10_000) / 10_000,
  };
  const dieuKhoanTraVe = dieuKhoan.map((d) => ({
    urn: d.urn,
    label: d.label,
    heading: d.heading,
    short_title: d.short_title,
  }));
  if (y.chayThu) return { taoViec: false as const, uocTinh, dieuKhoan: dieuKhoanTraVe };

  if (uocTinh.chi_phi_usd > tranChiPhiAi() && !atLeast(p.role, "phap_che"))
    throw new KhongDuQuyen("phap_che");

  const chuDe = await y.layChuDe();
  const viec = await taoViecSoanBai({
    courseId: y.courseId ?? null,
    lessonId: y.lessonId ?? null,
    step: BUOC_SINH_CAU_HOI,
    input: {
      urns: y.urns,
      topic_id: chuDe.id,
      topic_code: chuDe.code,
      topic_name: chuDe.name,
      muc_do: y.mucDo,
      loai: y.loai,
      so_cau: y.soCau,
      as_of: y.asOf,
      loai_trung: y.loaiTrung ?? false,
    },
    // Ngân sách của việc: gấp đôi ước tính, để mô hình trả dài hơn dự kiến vẫn nằm trong trần.
    budgetUsd: Math.max(0.01, Math.round(uocTinh.chi_phi_usd * 2 * 10_000) / 10_000),
    // Biên tập viên chờ kết quả để duyệt nên không đi Batch API.
    batch: false,
    requestedBy: p.email,
  });
  await ghiNhatKy(p.email, "ngan_hang.sinh_ai.tao", viec.id, {
    chu_de: chuDe.code,
    so_cau: y.soCau,
    uoc_tinh_usd: uocTinh.chi_phi_usd,
    ...(y.lessonId ? { bai: y.lessonId } : {}),
  });

  const cheDo = await khoiChayViecSoanBai(viec.id);
  return {
    taoViec: true as const,
    viec,
    chuDe,
    uocTinh,
    dieuKhoan: dieuKhoanTraVe,
    cheDo,
    daDayHangDoi: cheDo === "hang_doi",
  };
}
