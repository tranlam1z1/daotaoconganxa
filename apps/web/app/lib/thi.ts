/**
 * Kiểu dữ liệu và nhãn của thi sát hạch (docs/PLAN.md GĐ6), phản chiếu API /v1/thi,
 * /v1/giao-bai và /v1/quan-tri/de-thi. Không có mã máy chủ nên dùng được ở trình duyệt.
 */
import type { Tone } from "./format";
import type { DeCauHoi, DiemTieuChi, KetQuaCauHoi, MucDoCauHoi, Rubric, TraLoiCauHoi } from "./ngan-hang";

export type TrangThaiBaiThi = "chua_mo" | "chua_lam" | "dang_lam" | "da_xong" | "het_han";

export const TEN_TRANG_THAI_BAI: Record<TrangThaiBaiThi, string> = {
  chua_mo: "Chưa mở",
  chua_lam: "Chưa làm",
  dang_lam: "Đang làm",
  da_xong: "Đã làm",
  het_han: "Đã quá hạn",
};

export const TONE_TRANG_THAI_BAI: Record<TrangThaiBaiThi, Tone> = {
  chua_mo: "muted",
  chua_lam: "info",
  dang_lam: "warn",
  da_xong: "ok",
  het_han: "danger",
};

export interface BaiThi {
  assignment_id: string;
  exam_id: string;
  exam_title: string;
  question_count: number;
  duration_minutes: number;
  pass_score: number;
  max_attempts: number;
  opens_at: string;
  due_at: string;
  so_luot_nop: number;
  luot_dang_lam: string | null;
  luot_gan_nhat: string | null;
  diem_cao_nhat: number | null;
  da_dat: boolean;
  trang_thai: TrangThaiBaiThi;
  con_luot: number;
  duoc_bat_dau: boolean;
}

/** `cho_cham`: đã nộp, còn câu tự luận chưa có điểm. */
export type TrangThaiLuot = "dang_lam" | "cho_cham" | "da_nop";

export interface LuotThi {
  id: string;
  exam_title: string;
  trang_thai: TrangThaiLuot;
  so_cau: number;
  deadline_at: string;
  server_now: string;
  giay_con_lai: number;
  cau: Array<{ thu_tu: number; de: DeCauHoi; tra_loi: TraLoiCauHoi | null }>;
}

/** Nhận xét câu tự luận đã chấm (KetQuaCham.feedback của @qdpl/dao-tao). */
export interface NhanXetTuLuan {
  tom_tat: string;
  tieu_chi?: DiemTieuChi[];
  can_cu?: string[];
}

export type TrangThaiChamCau = "xong" | "cho_ai" | "dang_ai" | "cho_nguoi";

export interface KetQuaThi {
  id: string;
  exam_title: string;
  trang_thai: TrangThaiLuot;
  kieu_nop: "nguoi_thi" | "het_gio" | null;
  /** null khi lượt còn chờ chấm tự luận. */
  dung: number | null;
  tong: number;
  diem: number | null;
  diem_dat: number;
  dat: boolean | null;
  lan_thu: number;
  giay_lam_bai: number | null;
  co_tu_luan: boolean;
  so_cau_cho_cham: number;
  /** Điểm theo thang của đề (trước khi quy về 100). */
  diem_tho: number | null;
  tong_diem_tho: number;
  xem_dap_an: boolean;
  xem_dap_an_tu?: string;
  chi_tiet?: Array<{
    thu_tu: number;
    de: DeCauHoi;
    tra_loi: TraLoiCauHoi | null;
    ket_qua: KetQuaCauHoi;
    /** null khi câu chưa có điểm. */
    diem: number | null;
    diem_toi_da: number;
    /** Chỉ câu tự luận. */
    trang_thai_cham?: TrangThaiChamCau;
    cham_boi?: "may" | "ai" | "nguoi" | null;
    nhan_xet?: NhanXetTuLuan | null;
  }>;
}

/** Một câu trong hàng chấm tự luận của giảng viên (GET /v1/quan-tri/de-thi/cham-tu-luan). */
export interface CauTuLuanCanCham {
  attempt_id: string;
  ordinal: number;
  exam_id: string;
  exam_title: string;
  account_name: string | null;
  unit_name: string | null;
  submitted_at: string | null;
  attempt_status: TrangThaiLuot;
  grading_state: TrangThaiChamCau;
  graded_by: "ai" | "nguoi" | null;
  points: number | null;
  max_points: number | null;
  feedback: NhanXetTuLuan | null;
  reviewer: string | null;
  response: TraLoiCauHoi;
  item: {
    diem?: number;
    noi_dung: {
      stem: string;
      explanation: string | null;
      citations: string[];
      rubric?: Rubric | Record<string, never>;
    };
  };
}

export type TrangThaiDeThi = "nhap" | "xuat_ban" | "dong";

export const TEN_TRANG_THAI_DE: Record<TrangThaiDeThi, string> = {
  nhap: "Bản nháp",
  xuat_ban: "Đang mở",
  dong: "Đã đóng",
};

export const TONE_TRANG_THAI_DE: Record<TrangThaiDeThi, Tone> = {
  nhap: "muted",
  xuat_ban: "ok",
  dong: "warn",
};

export type CheDoXemDapAn = "khong" | "sau_nop" | "sau_han";

export const TEN_XEM_DAP_AN: Record<CheDoXemDapAn, string> = {
  sau_nop: "Ngay sau khi nộp bài",
  sau_han: "Sau hạn làm bài",
  khong: "Không cho xem",
};

export type DangCau = "trac_nghiem" | "tu_luan";

export const TEN_DANG_CAU: Record<DangCau, string> = { trac_nghiem: "Trắc nghiệm", tu_luan: "Tự luận" };

/** Giới hạn của đề (khớp SO_CAU_TOI_THIEU/TOI_DA, DIEM_MOI_CAU của @qdpl/dao-tao). */
export const SO_CAU_DE = { toiThieu: 1, toiDa: 60 } as const;
export const DIEM_MOI_CAU = { toiThieu: 0.25, toiDa: 20 } as const;

export interface OMaTran {
  topic_id: string;
  level: MucDoCauHoi;
  so_cau: number;
  /** Thiếu là trắc nghiệm (đề tạo trước khi có tự luận). */
  dang?: DangCau;
  /** Thiếu là 1. */
  diem_moi_cau?: number;
}

/** Một việc AI sinh câu hỏi đi kèm đề sinh từ văn bản. */
export interface ViecSinhCuaDe {
  id: string;
  state: "cho" | "dang_chay" | "xong" | "loi" | "huy";
  input: { muc_do?: string | null; loai?: string[]; so_cau?: number };
  output: { so_nhan?: number; so_loai?: number };
  error: string | null;
  so_cau: number;
  so_cho_duyet: number;
  so_da_duyet: number;
}

export interface DeThi {
  id: string;
  code: string;
  title: string;
  description: string | null;
  matrix: OMaTran[];
  question_count: number;
  duration_minutes: number;
  pass_score: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  max_attempts: number;
  show_answers: CheDoXemDapAn;
  status: TrangThaiDeThi;
  authoring_job_ids?: string[];
  so_bai_giao?: number;
  so_luot_nop?: number;
}

export interface GiaoBai {
  id: string;
  exam_id: string;
  exam_code: string;
  exam_title: string;
  unit_id: string | null;
  unit_name: string | null;
  account_id: string | null;
  account_name: string | null;
  include_subunits: boolean;
  opens_at: string;
  due_at: string;
  assigned_by: string;
  cancelled_at: string | null;
  so_nguoi: number;
  so_da_nop: number;
}

/** "mm:ss" hoặc "h:mm:ss" cho đồng hồ đếm ngược. */
export function dinhDangDemNguoc(giay: number): string {
  const s = Math.max(0, Math.floor(giay));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${String(m).padStart(2, "0")}:${ss}`;
}

/** Điểm theo kiểu số Việt Nam, tối đa hai chữ số thập phân: "53,33". Dùng chung cho danh sách và kết quả. */
export const diemSo = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

/** "12 phút 5 giây" cho thời gian làm bài. */
export function dinhDangThoiLuong(giay: number): string {
  const m = Math.floor(giay / 60);
  const s = giay % 60;
  return m ? `${m} phút${s ? ` ${s} giây` : ""}` : `${s} giây`;
}

/**
 * Ba mẫu cấu trúc đề của luồng tạo từ tệp PDF. Số câu phải khớp `MAU_DE` ở
 * apps/api/src/sinh-de-tu-van-ban.ts; API chỉ nhận mã mẫu.
 */
export const MAU_DE: ReadonlyArray<{ ma: "15" | "45" | "90"; ten: string; moTa: string }> = [
  { ma: "15", ten: "15 phút", moTa: "10 câu trắc nghiệm" },
  { ma: "45", ten: "45 phút", moTa: "20 câu trắc nghiệm, 2 câu tự luận" },
  { ma: "90", ten: "90 phút", moTa: "40 câu trắc nghiệm, 3 câu tự luận" },
];

/**
 * Tiến độ các việc AI của một đề (trường `tien_do` của GET /v1/quan-tri/de-thi/:id). `doc_pdf`
 * chỉ có khi đề tạo từ PDF bản quét.
 */
export interface TienDoSinhDe {
  dang_chay: boolean;
  con_loi: boolean;
  doc_pdf: {
    state: string;
    error: string | null;
    cum_xong: number;
    so_cum: number;
    so_trang: number;
    so_cho_khong_doc: number;
  } | null;
  so_viec: number;
  xong: number;
  loi: number;
  loi_dau: string | null;
}

/** Một chủ đề của ngân hàng kèm số câu đã duyệt theo mức và dạng (GET /v1/quan-tri/de-thi/kha-dung). */
export interface ChuDeKhaDung {
  id: string;
  code: string;
  name: string;
  field_name: string | null;
  kha_dung: Record<MucDoCauHoi, number>;
  kha_dung_tu_luan: Record<MucDoCauHoi, number>;
}

/** Tóm tắt một ma trận: số câu và điểm theo dạng, cùng các chủ đề đang rút câu. */
export function tomTatMaTran(matrix: OMaTran[]) {
  const soCau: Record<DangCau, number> = { trac_nghiem: 0, tu_luan: 0 };
  const theoChuDe = new Map<string, Record<DangCau, number>>();
  let diem = 0;
  for (const o of matrix) {
    if (o.so_cau <= 0) continue;
    const dang = o.dang ?? "trac_nghiem";
    soCau[dang] += o.so_cau;
    diem += o.so_cau * (o.diem_moi_cau ?? 1);
    const cd = theoChuDe.get(o.topic_id) ?? { trac_nghiem: 0, tu_luan: 0 };
    cd[dang] += o.so_cau;
    theoChuDe.set(o.topic_id, cd);
  }
  return {
    tong: soCau.trac_nghiem + soCau.tu_luan,
    soCau,
    diem,
    chuDe: [...theoChuDe].map(([id, so]) => ({ id, ...so })),
  };
}
