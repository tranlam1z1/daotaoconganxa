/**
 * Sinh đề thi từ văn bản trong kho: tạo các việc AI sinh câu hỏi (trắc nghiệm theo từng mức, tự
 * luận) từ điều khoản đã chọn, và một đề NHÁP có ma trận trỏ vào chủ đề nhận câu. Dùng cho luồng
 * tạo đề từ tệp PDF (chọn một mẫu cấu trúc).
 *
 * Câu AI sinh vào ngân hàng ở `cho_duyet` như mọi câu AI khác; đề chỉ xuất bản được khi đủ câu đã
 * duyệt, nên không câu nào chưa duyệt lọt vào đề. Kiểm tra điều khoản (có hiệu lực, không bị bãi
 * bỏ) và trần chi phí dùng chung với `/ngan-hang/sinh-ai` qua `taoViecSinhCauHoi`; trần chi phí
 * xét trên TỔNG các việc.
 */

import { atLeast, type Role } from "@qdpl/auth";
import {
  DIEM_MOI_CAU,
  LOAI_CHAM_MAY,
  MUC_DO_CAU_HOI,
  SO_CAU_TOI_DA,
  SO_CAU_TOI_THIEU,
  tongSoCau,
} from "@qdpl/dao-tao";
import { type ChuDeCauHoiRow, chuDeTheoMa, type DeThiRow, luuChuDeCauHoi, sql, taoDeThi } from "@qdpl/db";
import { z } from "zod";
import { KhongDuQuyen } from "./auth.ts";
import { badRequest } from "./http.ts";
import { taoViecSinhCauHoi, tranChiPhiAi } from "./sinh-cau-hoi-ai.ts";

/** Số câu tối đa một việc sinh câu hỏi (trần của worker); lô lớn hơn chia thành nhiều việc. */
const SO_CAU_MOI_VIEC = 20;

/**
 * Số câu yêu cầu mô hình sinh cho một ô cần `n` câu: dư 50% (ít nhất 2 câu) để bù câu bị hậu
 * kiểm loại hoặc bị người duyệt từ chối. Chia thành các việc tối đa `SO_CAU_MOI_VIEC` câu.
 */
function chiaViec(n: number): number[] {
  if (n <= 0) return [];
  let con = Math.max(n + 2, Math.ceil(n * 1.5));
  const ra: number[] = [];
  while (con > 0) {
    ra.push(Math.min(SO_CAU_MOI_VIEC, con));
    con -= SO_CAU_MOI_VIEC;
  }
  return ra;
}

const soCauMuc = z.coerce.number().int().min(0).max(SO_CAU_TOI_DA).default(0);

export const sinhTuVanBanSchema = z.object({
  title: z.string().trim().min(1, "Nhập tên đề thi").max(300),
  description: z.string().trim().max(2000).nullish(),
  /** URN văn bản (lấy mọi điều) hoặc điều, khoản cụ thể. */
  urns: z
    .array(
      z
        .string()
        .trim()
        .regex(/^vn:\S+$/, "Căn cứ phải là URN dạng vn:..."),
    )
    .min(1, "Chọn ít nhất một văn bản hoặc điều khoản")
    .max(20),
  as_of: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /** Mã chủ đề nhận câu hỏi; trống thì tạo chủ đề mới mang tên đề. */
  chu_de: z.string().trim().max(80).nullish(),
  trac_nghiem: z.object({ de: soCauMuc, trung_binh: soCauMuc, kho: soCauMuc }).default({
    de: 0,
    trung_binh: 0,
    kho: 0,
  }),
  loai_trac_nghiem: z
    .array(z.enum(LOAI_CHAM_MAY))
    .min(1)
    .max(LOAI_CHAM_MAY.length)
    .default(["mot_dap_an", "dung_sai"]),
  tu_luan: z
    .object({
      so_cau: z.coerce.number().int().min(0).max(10).default(0),
      muc_do: z.enum(MUC_DO_CAU_HOI).default("kho"),
    })
    .default({ so_cau: 0, muc_do: "kho" }),
  diem_trac_nghiem: z.coerce.number().min(DIEM_MOI_CAU.toiThieu).max(DIEM_MOI_CAU.toiDa).default(1),
  diem_tu_luan: z.coerce.number().min(DIEM_MOI_CAU.toiThieu).max(DIEM_MOI_CAU.toiDa).default(5),
  duration_minutes: z.coerce.number().int().min(5).max(240).default(45),
  pass_score: z.coerce.number().int().min(0).max(100).default(70),
  chay_thu: z.boolean().default(false),
});

export type YeuCauSinhDe = z.infer<typeof sinhTuVanBanSchema>;

/** Ba mẫu cấu trúc đề của luồng tạo từ tệp PDF, theo thời gian làm bài. */
export const MAU_DE = {
  "15": { trac_nghiem: { de: 5, trung_binh: 4, kho: 1 }, tu_luan: 0, phut: 15 },
  "45": { trac_nghiem: { de: 10, trung_binh: 8, kho: 2 }, tu_luan: 2, phut: 45 },
  "90": { trac_nghiem: { de: 18, trung_binh: 16, kho: 6 }, tu_luan: 3, phut: 90 },
} as const;

export type MauDe = keyof typeof MAU_DE;

export function laMauDe(v: unknown): v is MauDe {
  return typeof v === "string" && v in MAU_DE;
}

/** Yêu cầu sinh đề theo một mẫu cấu trúc; điểm, điểm đạt và loại câu lấy mặc định của lược đồ. */
export function yeuCauTheoMau(mau: MauDe, o: { title: string; urn: string; asOf: string }): YeuCauSinhDe {
  const m = MAU_DE[mau];
  return sinhTuVanBanSchema.parse({
    title: o.title,
    urns: [o.urn],
    as_of: o.asOf,
    trac_nghiem: m.trac_nghiem,
    tu_luan: { so_cau: m.tu_luan, muc_do: "kho" },
    duration_minutes: m.phut,
  });
}

/** Ma trận của đề: mỗi mức trắc nghiệm một ô, thêm một ô tự luận; ô 0 câu bị bỏ. */
export function maTranCuaDe(b: YeuCauSinhDe, topicId: string) {
  return [
    ...MUC_DO_CAU_HOI.map((level) => ({
      topic_id: topicId,
      level,
      so_cau: b.trac_nghiem[level],
      dang: "trac_nghiem" as const,
      diem_moi_cau: b.diem_trac_nghiem,
    })),
    {
      topic_id: topicId,
      level: b.tu_luan.muc_do,
      so_cau: b.tu_luan.so_cau,
      dang: "tu_luan" as const,
      diem_moi_cau: b.diem_tu_luan,
    },
  ].filter((o) => o.so_cau > 0);
}

/** Cấu hình đề nháp sinh từ văn bản, trừ danh sách việc AI. */
export function cauHinhDe(b: YeuCauSinhDe, topicId: string, asOf: string) {
  const matrix = maTranCuaDe(b, topicId);
  return {
    title: b.title,
    description:
      b.description ??
      `Sinh từ ${b.urns.join(", ")} (áp dụng tại ${asOf}). Câu hỏi AI sinh phải được duyệt trước khi xuất bản đề.`,
    matrix,
    question_count: tongSoCau(matrix),
    duration_minutes: b.duration_minutes,
    pass_score: b.pass_score,
    shuffle_questions: true,
    shuffle_options: true,
    max_attempts: 1,
    show_answers: "sau_nop" as const,
  };
}

type Nguoi = { email: string; role: Role };

export interface ViecSinhDe {
  id: string;
  dang: string;
  muc_do: string;
  so_cau: number;
  da_day_hang_doi: boolean;
}

/**
 * Sinh đề từ văn bản. `chay_thu` chỉ trả điều khoản, kế hoạch các việc và ước tính chi phí.
 *
 * `deCo`: đề nháp và chủ đề đã tạo sẵn (luồng PDF bản quét tạo đề trước khi đọc xong văn bản).
 * Khi có, các việc sinh câu hỏi được nối vào đề đó và tên, mô tả đề được ghi lại theo văn bản.
 */
export async function sinhDeTuVanBan(
  p: Nguoi,
  b: YeuCauSinhDe,
  deCo?: { de: DeThiRow; chuDe: ChuDeCauHoiRow },
) {
  const asOf = b.as_of ?? new Date().toISOString().slice(0, 10);
  const soCau = tongSoCau(maTranCuaDe(b, ""));
  if (soCau < SO_CAU_TOI_THIEU || soCau > SO_CAU_TOI_DA) {
    throw badRequest(`Đề có ${soCau} câu; đề thi cần từ ${SO_CAU_TOI_THIEU} đến ${SO_CAU_TOI_DA} câu.`);
  }

  let chuDeCo = deCo?.chuDe;
  if (!chuDeCo && b.chu_de) {
    chuDeCo = await chuDeTheoMa(b.chu_de);
    if (!chuDeCo) throw badRequest(`Không có chủ đề mã "${b.chu_de}"`);
  }
  // Chủ đề mới chỉ tạo khi thật sự tạo việc (không tạo khi chạy thử), và tạo một lần cho mọi việc.
  let chuDeMoi: Promise<ChuDeCauHoiRow> | undefined;
  const layChuDe = async () => {
    if (chuDeCo) return chuDeCo;
    chuDeMoi ??= luuChuDeCauHoi({ code: `de-thi-${crypto.randomUUID().slice(0, 8)}`, name: b.title });
    return chuDeMoi;
  };

  const keHoach = [
    ...MUC_DO_CAU_HOI.flatMap((muc) =>
      chiaViec(b.trac_nghiem[muc]).map((n) => ({
        dang: "trac_nghiem" as const,
        muc_do: muc,
        loai: b.loai_trac_nghiem,
        so_cau: n,
      })),
    ),
    ...chiaViec(b.tu_luan.so_cau).map((n) => ({
      dang: "tu_luan" as const,
      muc_do: b.tu_luan.muc_do,
      loai: ["tu_luan" as const],
      so_cau: n,
    })),
  ];
  const yeuCau = (k: (typeof keHoach)[number], chayThu: boolean) =>
    taoViecSinhCauHoi(p, {
      urns: b.urns,
      layChuDe,
      loai: [...k.loai],
      mucDo: k.muc_do,
      soCau: k.so_cau,
      asOf,
      chayThu,
    });

  // Chạy thử mọi việc trước: kiểm điều khoản một lần cho tất cả và cộng chi phí ước tính.
  const thu = await Promise.all(keHoach.map((k) => yeuCau(k, true)));
  const uocTinh = {
    model: thu[0]?.uocTinh.model ?? null,
    tokens_in: thu.reduce((s, t) => s + t.uocTinh.tokens_in, 0),
    tokens_out: thu.reduce((s, t) => s + t.uocTinh.tokens_out, 0),
    chi_phi_usd: Math.round(thu.reduce((s, t) => s + t.uocTinh.chi_phi_usd, 0) * 10_000) / 10_000,
  };
  const chuanBi = {
    as_of: asOf,
    so_cau: soCau,
    ke_hoach: keHoach,
    uoc_tinh: uocTinh,
    dieu_khoan: thu[0]?.dieuKhoan ?? [],
  };
  if (b.chay_thu) return { chayThu: true as const, ...chuanBi };
  if (uocTinh.chi_phi_usd > tranChiPhiAi() && !atLeast(p.role, "quan_tri"))
    throw new KhongDuQuyen("quan_tri");

  const viec: ViecSinhDe[] = [];
  for (const k of keHoach) {
    const kq = await yeuCau(k, false);
    if (!kq.taoViec) continue;
    viec.push({
      id: kq.viec.id,
      dang: k.dang,
      muc_do: k.muc_do,
      so_cau: k.so_cau,
      da_day_hang_doi: kq.daDayHangDoi,
    });
  }
  const chuDe = await layChuDe();
  const cauHinh = cauHinhDe(b, chuDe.id, asOf);
  let item: DeThiRow;
  if (deCo) {
    // Đề tạo trước khi đọc xong bản quét: giữ ma trận đã lập, ghi tên theo văn bản và nối việc sinh.
    const ids = [...(deCo.de.authoring_job_ids ?? []), ...viec.map((v) => v.id)];
    const [row] = await sql<DeThiRow[]>`
      UPDATE exams SET title = ${cauHinh.title}, description = ${cauHinh.description},
                       authoring_job_ids = ${ids}::uuid[], updated_by = ${p.email}, updated_at = now()
      WHERE id = ${deCo.de.id} RETURNING *`;
    item = row ?? deCo.de;
    await sql`UPDATE question_topics SET name = ${b.title} WHERE id = ${chuDe.id}::uuid`;
  } else {
    item = await taoDeThi({ ...cauHinh, authoring_job_ids: viec.map((v) => v.id) }, p.email);
  }
  return { chayThu: false as const, ...chuanBi, item, chuDe, viec };
}
