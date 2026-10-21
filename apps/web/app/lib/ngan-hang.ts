/**
 * Kiểu dữ liệu và nhãn tiếng Việt của ngân hàng câu hỏi phía web (docs/PLAN.md GĐ3).
 *
 * Web chỉ gọi API (giả định A2), không import gói @qdpl/dao-tao; các kiểu ở đây chép theo
 * packages/dao-tao/src/cau-hoi.ts và phải đổi cùng lúc khi bên đó đổi.
 */
import type { Tone } from "./format";

export type LoaiCauHoi =
  | "mot_dap_an"
  | "nhieu_dap_an"
  | "dung_sai"
  | "dien_khuyet"
  | "sap_xep"
  | "ghep_cap"
  | "tu_luan";
export type MucDoCauHoi = "de" | "trung_binh" | "kho";
export type TrangThaiCauHoi = "nhap" | "cho_duyet" | "da_duyet" | "tu_choi" | "luu_tru";
export type NguonCauHoi = "nguoi" | "ai" | "nhap_excel";

export const TEN_LOAI: Record<LoaiCauHoi, string> = {
  mot_dap_an: "Một đáp án",
  nhieu_dap_an: "Nhiều đáp án",
  dung_sai: "Đúng/sai",
  dien_khuyet: "Điền chỗ trống",
  sap_xep: "Sắp xếp thứ tự",
  ghep_cap: "Ghép cặp",
  tu_luan: "Tự luận",
};

/** Độ dài bài viết tự luận chấp nhận được (khớp DO_DAI_BAI_VIET của @qdpl/dao-tao). */
export const DO_DAI_BAI_VIET = { toiThieu: 50, toiDa: 6000 } as const;

export const TEN_MUC_DO: Record<MucDoCauHoi, string> = { de: "Dễ", trung_binh: "Trung bình", kho: "Khó" };

export const TEN_TRANG_THAI: Record<TrangThaiCauHoi, string> = {
  nhap: "Bản nháp",
  cho_duyet: "Chờ duyệt",
  da_duyet: "Đã duyệt",
  tu_choi: "Bị từ chối",
  luu_tru: "Lưu trữ",
};

export const TONE_TRANG_THAI: Record<TrangThaiCauHoi, Tone> = {
  nhap: "muted",
  cho_duyet: "warn",
  da_duyet: "ok",
  tu_choi: "danger",
  luu_tru: "muted",
};

export const TEN_NGUON: Record<NguonCauHoi, string> = {
  nguoi: "Người soạn",
  ai: "AI sinh",
  nhap_excel: "Nhập Excel",
};

export const TEN_HANH_DONG: Record<string, string> = {
  tao: "Tạo câu",
  sua: "Sửa",
  gui_duyet: "Gửi duyệt",
  duyet: "Duyệt",
  tu_choi: "Từ chối",
  luu_tru: "Lưu trữ",
  nhap_excel: "Nhập từ Excel",
  ai_sinh: "AI sinh",
};

export interface MucLuaChon {
  id: string;
  text: string;
  /** Hình của phương án (URI trong kho); phương án có hình thì chữ được để trống. */
  image_uri?: string | null;
}

export interface LuaChonCauHoi {
  phuong_an?: MucLuaChon[];
  trai?: MucLuaChon[];
  phai?: MucLuaChon[];
}

export interface DapAnCauHoi {
  dung?: string[];
  thu_tu?: string[];
  cap?: Record<string, string>;
  o_trong?: Record<string, string[]>;
}

/** Đề bài đúng như người học nhận: không có đáp án. */
export interface DeCauHoi {
  kind: LoaiCauHoi;
  stem: string;
  options: LuaChonCauHoi;
  so_o_trong?: number;
  /** Các ảnh minh họa của đề (URI trong kho) theo thứ tự hiển thị; hiện bằng `urlAnhBienBao`. */
  image_uris?: string[];
}

export interface TraLoiCauHoi {
  chon?: string[];
  thu_tu?: string[];
  cap?: Record<string, string>;
  o_trong?: Record<string, string>;
  /** Bài viết của câu tự luận. */
  bai_viet?: string;
}

/** Tiêu chí chấm câu tự luận (Rubric của @qdpl/dao-tao). */
export interface MucRubric {
  diem: number;
  mo_ta: string;
}

export interface TieuChiRubric {
  ma: string;
  ten: string;
  trong_so: number;
  muc: MucRubric[];
}

export interface Rubric {
  tieu_chi: TieuChiRubric[];
  nguong_dat: number;
}

/** Rubric mặc định của câu tự luận (khớp RUBRIC_TU_LUAN_MAC_DINH của @qdpl/dao-tao). */
export const RUBRIC_TU_LUAN_MAC_DINH: Rubric = {
  tieu_chi: [
    {
      ma: "can_cu",
      ten: "Căn cứ pháp lý",
      trong_so: 40,
      muc: [
        { diem: 0, mo_ta: "Không nêu căn cứ, nêu sai, hoặc dùng văn bản đã hết hiệu lực." },
        { diem: 2, mo_ta: "Nêu đúng văn bản nhưng chưa chỉ đúng điều, khoản." },
        { diem: 4, mo_ta: "Viện dẫn đúng điều, khoản đang có hiệu lực." },
      ],
    },
    {
      ma: "noi_dung",
      ten: "Nội dung giải quyết",
      trong_so: 40,
      muc: [
        { diem: 0, mo_ta: "Không giải quyết được tình huống hoặc kết luận sai." },
        { diem: 2, mo_ta: "Giải quyết đúng một phần, còn thiếu ý quan trọng." },
        { diem: 4, mo_ta: "Giải quyết đúng và đủ các ý của tình huống." },
      ],
    },
    {
      ma: "trinh_bay",
      ten: "Lập luận, trình bày",
      trong_so: 20,
      muc: [
        { diem: 0, mo_ta: "Lộn xộn, không theo được lập luận." },
        { diem: 2, mo_ta: "Có lập luận nhưng chưa chặt chẽ." },
        { diem: 4, mo_ta: "Mạch lạc, đi từ căn cứ tới kết luận." },
      ],
    },
  ],
  nguong_dat: 50,
};

/** Rubric có ít nhất một tiêu chí (khớp laRubric của @qdpl/dao-tao). */
export function laRubric(r: unknown): r is Rubric {
  return Boolean(r && Array.isArray((r as Rubric).tieu_chi) && (r as Rubric).tieu_chi.length > 0);
}

/** Điểm và nhận xét một tiêu chí sau khi chấm tự luận. */
export interface DiemTieuChi {
  ma: string;
  ten: string;
  diem: number;
  diem_toi_da: number;
  nhan_xet?: string;
  bang_chung?: string;
}

export interface KetQuaCauHoi {
  dung: boolean;
  ty_le: number;
  dap_an: DapAnCauHoi;
  giai_thich: string | null;
  can_cu: string[];
  chi_tiet?: Array<{ ma: string; dung: boolean }>;
}

export interface CauHoi {
  id: string;
  code: string;
  topic_id: string | null;
  topic_code: string | null;
  topic_name: string | null;
  level: MucDoCauHoi;
  kind: LoaiCauHoi;
  stem: string;
  options: LuaChonCauHoi;
  answer: DapAnCauHoi;
  explanation: string | null;
  citations: string[];
  image_uris: string[];
  /** Tiêu chí chấm, chỉ có ở câu tự luận. */
  rubric: Rubric | Record<string, never>;
  status: TrangThaiCauHoi;
  source: NguonCauHoi;
  version: number;
  created_by: string | null;
  updated_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  reject_reason: string | null;
  /** Việc AI đã sinh câu này (GĐ8). */
  authoring_job_id: string | null;
  /** Câu đã có mà câu này gần giống, do hậu kiểm AI đánh dấu (GĐ8). */
  duplicate_of: string | null;
  duplicate_code: string | null;
  updated_at: string;
}

/** Một việc AI sinh câu hỏi (GĐ8), như `GET /v1/quan-tri/ngan-hang/sinh-ai` trả về. */
export interface ViecSinhCauHoi {
  id: string;
  state: "cho" | "dang_chay" | "xong" | "loi" | "huy";
  input: { topic_name?: string; so_cau?: number; urns?: string[]; as_of?: string };
  output: {
    so_nhan?: number;
    so_loai?: number;
    /** Lượt sinh cũ: câu trùng vẫn được nhận, chỉ gắn nhãn. */
    so_danh_dau_trung?: number;
    /** Số câu bị loại vì gần giống câu đã có; nằm trong `so_loai`. */
    so_loai_trung?: number;
    bi_loai?: Array<{ stem: string; ly_do: string[] }>;
  };
  error: string | null;
  cost_usd: string;
  requested_by: string | null;
  created_at: string;
  so_cau: number;
  so_cho_duyet: number;
  so_da_duyet: number;
}

export const TEN_TRANG_THAI_VIEC: Record<ViecSinhCauHoi["state"], string> = {
  cho: "Đang chờ",
  dang_chay: "Đang sinh",
  xong: "Xong",
  loi: "Lỗi",
  huy: "Đã hủy",
};

export const TONE_TRANG_THAI_VIEC: Record<ViecSinhCauHoi["state"], Tone> = {
  cho: "muted",
  dang_chay: "info",
  xong: "ok",
  loi: "danger",
  huy: "muted",
};

export interface ChuDeCauHoi {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
  field_name: string | null;
  so_cau: number;
  so_da_duyet: number;
}

/** Ô trống trong đề điền khuyết: ba dấu gạch dưới trở lên (khớp soOTrong ở @qdpl/dao-tao). */
export const O_TRONG_RE = /_{3,}/g;

/** Tách đề điền khuyết thành các đoạn chữ xen giữa ô trống. */
export function tachDeDienKhuyet(stem: string): string[] {
  return stem.split(O_TRONG_RE);
}

/** Chủ đề xếp theo cây, kèm độ sâu để thụt lề trong ô chọn. */
export function sapXepCayChuDe(ds: ChuDeCauHoi[]): Array<ChuDeCauHoi & { cap: number }> {
  const con = new Map<string | null, ChuDeCauHoi[]>();
  const coId = new Set(ds.map((t) => t.id));
  for (const t of ds) {
    const cha = t.parent_id && coId.has(t.parent_id) ? t.parent_id : null;
    con.set(cha, [...(con.get(cha) ?? []), t]);
  }
  const ra: Array<ChuDeCauHoi & { cap: number }> = [];
  const di = (cha: string | null, cap: number) => {
    for (const t of con.get(cha) ?? []) {
      ra.push({ ...t, cap });
      di(t.id, cap + 1);
    }
  };
  di(null, 0);
  return ra;
}
