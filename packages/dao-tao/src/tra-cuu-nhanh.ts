/**
 * Tra cứu nhanh (docs/PLAN.md GĐ5): khớp khoảng tốc độ và kiểm tra hợp lệ dữ liệu
 * `data/tra-cuu/*.json` trước khi nạp.
 *
 * Luật thuần, không chạm CSDL: script nạp, API và test cùng dùng một bộ quy tắc, nên một
 * khoảng tốc độ chồng lên khoảng khác bị bắt ngay từ tệp dữ liệu, không đợi tới lúc tra.
 */

export const LOAI_XE = ["o_to", "mo_to"] as const;
export type LoaiXe = (typeof LOAI_XE)[number];

export const TEN_LOAI_XE: Record<LoaiXe, string> = {
  o_to: "Ô tô",
  mo_to: "Xe mô tô, xe gắn máy",
};

/**
 * Chủ đề của một dòng mức phạt (trường `nhom`), cũng là các ô "Tra cứu theo chủ đề" ở trang Tra cứu.
 * Thêm chủ đề thì sửa cả CHU_DE_MUC_PHAT ở apps/web/app/lib/tra-cuu-nhanh.ts.
 */
export const CHU_DE_MUC_PHAT = [
  "Hiệu lệnh, chỉ dẫn",
  "Giấy tờ",
  "Dừng xe, đỗ xe",
  "Thiết bị ưu tiên",
  "Tốc độ",
  "Vận chuyển người, hàng hóa",
  "Trang thiết bị phương tiện",
  "Đường cấm, đường một chiều",
  "Nồng độ cồn, chất kích thích",
  "Chuyển hướng, nhường đường",
  "Khác",
  "Đường sắt",
] as const;

export const TRANG_THAI_TRA_CUU = ["nhap", "da_duyet", "ngung"] as const;
export type TrangThaiTraCuu = (typeof TRANG_THAI_TRA_CUU)[number];

/** Cách viết cận theo khoảng Postgres: '[' gồm cận, '(' không gồm cận. */
export type BienKhoang = "[)" | "[]" | "(]" | "()";

/** Khoảng tốc độ vượt quá, km/h. `den = null` là không có cận trên. */
export interface KhoangTocDo {
  tu: number;
  den: number | null;
  bien: BienKhoang;
}

/** Một dòng mức phạt, đúng hình dạng trong data/tra-cuu/muc-phat.json. */
export interface DongMucPhat {
  ma: string;
  xe: LoaiXe;
  nhom?: string;
  hanh_vi: string;
  tu_khoa?: string[];
  phat_tu: number;
  phat_den: number;
  hinh_thuc_bo_sung?: string[];
  tru_diem?: number | null;
  toc_do_vuot?: KhoangTocDo | null;
  /**
   * Khung phần trăm quá tải (GĐ-T12): `loai` là quá tải so với giấy chứng nhận kiểm định hay so với tải
   * trọng cầu đường; khoảng tính bằng % vượt, cùng cách viết cận như khoảng tốc độ.
   */
  qua_tai?: KhungQuaTaiTep | null;
  can_cu: string;
  hieu_luc_tu: string;
  hieu_luc_den?: string | null;
  trang_thai: TrangThaiTraCuu;
  ghi_chu?: string;
}

export const LOAI_QUA_TAI = ["kiem_dinh", "cau_duong"] as const;
export type LoaiQuaTai = (typeof LOAI_QUA_TAI)[number];

/** Khung phần trăm quá tải trong tệp mức phạt. `den = null` là không có cận trên. */
export interface KhungQuaTaiTep extends KhoangTocDo {
  loai: LoaiQuaTai;
}

/** Cử chỉ của một bước quy trình khi đưa vào trò chơi (docs/PLAN.md GĐ-T4). */
export const THAO_TAC_BUOC = ["vuot", "cham", "keo", "giu"] as const;
export type ThaoTacBuoc = (typeof THAO_TAC_BUOC)[number];

/**
 * Nguồn của một bước: `van_ban` (có điều khoản trong kho, phải ghi `can_cu`), `tai_lieu_nghiep_vu`
 * (tài liệu nghiệp vụ do đơn vị cung cấp, không có trong văn bản công khai), `chua_co_can_cu`
 * (chưa đối chiếu được, chờ đơn vị chuyên môn).
 */
export const NGUON_BUOC = ["van_ban", "tai_lieu_nghiep_vu", "chua_co_can_cu"] as const;
export type NguonBuoc = (typeof NGUON_BUOC)[number];

/**
 * Phần trò chơi của một bước quy trình (GĐ-T4). Quy trình cũ không có phần này và không đổi. Trò
 * chơi biết cách chạy từng loại bước theo `ma`; dữ liệu quyết định thứ tự, bước nào bắt buộc và điều
 * kiện áp dụng.
 */
export interface BuocCoThaoTac {
  /** Loại bước, do trò chơi định nghĩa (ví dụ `hieu_lenh_dung`). */
  ma: string;
  thao_tac: ThaoTacBuoc;
  bat_buoc: boolean;
  /** Điều kiện áp dụng, do trò chơi định nghĩa (ví dụ `co_do_con`); null là luôn áp dụng. */
  dieu_kien?: string | null;
  nguon: NguonBuoc;
}

export interface BuocQuyTrinh {
  tieu_de: string;
  mo_ta: string;
  can_cu?: string | null;
  /** Chỉ có ở quy trình dùng cho trò chơi; tra cứu nhanh không hiện phần này. */
  tro_choi?: BuocCoThaoTac | null;
}

/** Một quy trình, đúng hình dạng trong data/tra-cuu/quy-trinh.json. */
export interface QuyTrinh {
  ma: string;
  loai: "vi_pham" | "tai_nan";
  tieu_de: string;
  tom_tat?: string;
  cac_buoc: BuocQuyTrinh[];
  trang_thai: TrangThaiTraCuu;
  ghi_chu?: string;
}

export interface LoiDuLieu {
  ma: string;
  loi: string;
}

/* ------------------------------------------------------------------ */
/* Khoảng tốc độ                                                       */
/* ------------------------------------------------------------------ */

/** `v` (km/h vượt quá) có nằm trong khoảng không. */
export function trongKhoang(k: KhoangTocDo, v: number): boolean {
  const duoiOk = k.bien[0] === "[" ? v >= k.tu : v > k.tu;
  const trenOk = k.den === null ? true : k.bien[1] === "]" ? v <= k.den : v < k.den;
  return duoiOk && trenOk;
}

/** Hai khoảng có chung ít nhất một giá trị không. */
export function khoangChongNhau(a: KhoangTocDo, b: KhoangTocDo): boolean {
  // Sắp để a là khoảng có cận dưới nhỏ hơn (hoặc bằng mà gồm cận).
  const [x, y] = a.tu < b.tu || (a.tu === b.tu && a.bien[0] === "[") ? [a, b] : [b, a];
  if (x.den === null) return true;
  if (x.den > y.tu) return true;
  if (x.den < y.tu) return false;
  // Chạm nhau đúng tại một điểm: chỉ chồng khi cả hai cùng gồm điểm đó.
  return x.bien[1] === "]" && y.bien[0] === "[";
}

/** Đọc khoảng thành chữ: "từ 10 km/h đến 20 km/h", "trên 20 km/h", "từ 5 km/h đến dưới 10 km/h". */
export function moTaKhoang(k: KhoangTocDo): string {
  const duoi = k.bien[0] === "[" ? `từ ${k.tu} km/h` : `trên ${k.tu} km/h`;
  if (k.den === null) return duoi;
  const tren = k.bien[1] === "]" ? `đến ${k.den} km/h` : `đến dưới ${k.den} km/h`;
  return `${duoi} ${tren}`;
}

/**
 * Tốc độ vượt quá = đo được − cho phép. Không vượt thì trả 0.
 * Làm tròn 1 chữ số thập phân để 60,1 − 50 ra 10,1 chứ không ra 10,099999.
 */
export function tocDoVuot(choPhep: number, doDuoc: number): number {
  return Math.max(0, Math.round((doDuoc - choPhep) * 10) / 10);
}

/** Chọn các dòng có khoảng tốc độ chứa `vuot`. Dữ liệu hợp lệ thì có tối đa một dòng mỗi loại xe. */
export function timTheoTocDo<T extends { toc_do_vuot?: KhoangTocDo | null }>(dong: T[], vuot: number): T[] {
  return dong.filter((d) => d.toc_do_vuot && trongKhoang(d.toc_do_vuot, vuot));
}

/* ------------------------------------------------------------------ */
/* Hiệu lực                                                            */
/* ------------------------------------------------------------------ */

/** Dòng có áp dụng tại `ngay` (YYYY-MM-DD) không. `hieu_luc_den` là ngày đầu tiên HẾT áp dụng. */
export function apDungTai(d: { hieu_luc_tu: string; hieu_luc_den?: string | null }, ngay: string): boolean {
  return d.hieu_luc_tu <= ngay && (!d.hieu_luc_den || d.hieu_luc_den > ngay);
}

function hieuLucChongNhau(
  a: { hieu_luc_tu: string; hieu_luc_den?: string | null },
  b: { hieu_luc_tu: string; hieu_luc_den?: string | null },
): boolean {
  const aDen = a.hieu_luc_den ?? "9999-12-31";
  const bDen = b.hieu_luc_den ?? "9999-12-31";
  return a.hieu_luc_tu < bDen && b.hieu_luc_tu < aDen;
}

/* ------------------------------------------------------------------ */
/* Kiểm tra hợp lệ dữ liệu                                             */
/* ------------------------------------------------------------------ */

const NGAY = /^\d{4}-\d{2}-\d{2}$/;
// URN phải trỏ tới một điều, khoản hoặc điểm: có phần "#dieu-...".
const URN_DIEU_KHOAN = /^vn:[a-z]+:[a-z0-9-]+:[^#@\s]+#dieu-[^@\s]+$/;

/**
 * Kiểm tra toàn bộ tệp mức phạt. Trả danh sách lỗi; rỗng là hợp lệ.
 *
 * Ngoài lỗi từng dòng, bắt cả lỗi giữa các dòng: trùng mã, và hai khoảng tốc độ cùng loại xe,
 * cùng thời gian hiệu lực mà chồng nhau (một tốc độ ra hai mức phạt).
 */
export function kiemTraMucPhat(ds: DongMucPhat[]): LoiDuLieu[] {
  const loi: LoiDuLieu[] = [];
  const daGap = new Set<string>();

  for (const d of ds) {
    const ma = d.ma || "(không có mã)";
    const bao = (s: string) => loi.push({ ma, loi: s });
    if (!d.ma?.trim()) bao("Thiếu mã dòng");
    else if (daGap.has(d.ma)) bao("Trùng mã với dòng khác");
    else daGap.add(d.ma);

    if (!LOAI_XE.includes(d.xe)) bao(`Loại xe không hợp lệ: ${d.xe}`);
    if (!d.hanh_vi?.trim()) bao("Thiếu mô tả hành vi");
    if (d.nhom != null && !(CHU_DE_MUC_PHAT as readonly string[]).includes(d.nhom))
      bao(`Chủ đề không có trong danh sách: ${d.nhom}`);
    if (!Number.isInteger(d.phat_tu) || !Number.isInteger(d.phat_den) || d.phat_tu < 0) {
      bao("Mức phạt phải là số nguyên đồng, không âm");
    } else if (d.phat_tu > d.phat_den) bao("Mức phạt tối thiểu lớn hơn mức tối đa");
    if (d.tru_diem != null && (!Number.isInteger(d.tru_diem) || d.tru_diem < 1 || d.tru_diem > 12)) {
      bao("Số điểm trừ phải là số nguyên từ 1 đến 12");
    }
    if (!URN_DIEU_KHOAN.test(d.can_cu ?? ""))
      bao(`Căn cứ phải là URN tới điều, khoản hoặc điểm: ${d.can_cu}`);
    if (!NGAY.test(d.hieu_luc_tu ?? "")) bao("Ngày bắt đầu hiệu lực phải theo dạng YYYY-MM-DD");
    if (d.hieu_luc_den != null) {
      if (!NGAY.test(d.hieu_luc_den)) bao("Ngày hết hiệu lực phải theo dạng YYYY-MM-DD");
      else if (d.hieu_luc_den <= d.hieu_luc_tu) bao("Ngày hết hiệu lực phải sau ngày bắt đầu");
    }
    if (!TRANG_THAI_TRA_CUU.includes(d.trang_thai)) bao(`Trạng thái không hợp lệ: ${d.trang_thai}`);

    const k = d.toc_do_vuot;
    if (k) {
      if (!["[)", "[]", "(]", "()"].includes(k.bien)) bao(`Cách viết cận không hợp lệ: ${k.bien}`);
      if (!(k.tu >= 0)) bao("Cận dưới tốc độ phải từ 0 trở lên");
      if (k.den !== null && !(k.den > k.tu)) bao("Cận trên tốc độ phải lớn hơn cận dưới");
    }
    const q = d.qua_tai;
    if (q) {
      if (!LOAI_QUA_TAI.includes(q.loai)) bao(`Loại quá tải không hợp lệ: ${q.loai}`);
      if (!["[)", "[]", "(]", "()"].includes(q.bien)) bao(`Cách viết cận không hợp lệ: ${q.bien}`);
      if (!(q.tu >= 0)) bao("Cận dưới phần trăm quá tải phải từ 0 trở lên");
      if (q.den !== null && !(q.den > q.tu)) bao("Cận trên phần trăm quá tải phải lớn hơn cận dưới");
      if (d.toc_do_vuot) bao("Một dòng không được có cả khoảng tốc độ và khung quá tải");
    }
  }

  // Khoảng tốc độ chồng nhau: chỉ so các dòng còn dùng (bỏ qua dòng đã ngừng).
  const coTocDo = ds.filter((d) => d.toc_do_vuot && d.trang_thai !== "ngung");
  for (let i = 0; i < coTocDo.length; i++) {
    for (let j = i + 1; j < coTocDo.length; j++) {
      const a = coTocDo[i]!;
      const b = coTocDo[j]!;
      if (a.xe !== b.xe || !hieuLucChongNhau(a, b)) continue;
      if (khoangChongNhau(a.toc_do_vuot!, b.toc_do_vuot!)) {
        loi.push({
          ma: a.ma,
          loi: `Khoảng tốc độ ${moTaKhoang(a.toc_do_vuot!)} chồng lên dòng ${b.ma} (${moTaKhoang(b.toc_do_vuot!)})`,
        });
      }
    }
  }
  // Khung quá tải chồng nhau: cùng loại xe, cùng loại quá tải, cùng thời gian hiệu lực.
  const coQuaTai = ds.filter((d) => d.qua_tai && d.trang_thai !== "ngung");
  for (let i = 0; i < coQuaTai.length; i++) {
    for (let j = i + 1; j < coQuaTai.length; j++) {
      const a = coQuaTai[i]!;
      const b = coQuaTai[j]!;
      if (a.xe !== b.xe || a.qua_tai!.loai !== b.qua_tai!.loai || !hieuLucChongNhau(a, b)) continue;
      if (khoangChongNhau(a.qua_tai!, b.qua_tai!))
        loi.push({ ma: a.ma, loi: `Khung quá tải của dòng này chồng lên dòng ${b.ma}` });
    }
  }
  return loi;
}

/** Kiểm tra tệp quy trình: mã, loại, có bước, mỗi bước có tiêu đề và căn cứ đúng dạng. */
export function kiemTraQuyTrinh(ds: QuyTrinh[]): LoiDuLieu[] {
  const loi: LoiDuLieu[] = [];
  const daGap = new Set<string>();
  for (const q of ds) {
    const ma = q.ma || "(không có mã)";
    const bao = (s: string) => loi.push({ ma, loi: s });
    if (!q.ma?.trim()) bao("Thiếu mã quy trình");
    else if (daGap.has(q.ma)) bao("Trùng mã với quy trình khác");
    else daGap.add(q.ma);
    if (q.loai !== "vi_pham" && q.loai !== "tai_nan") bao(`Loại quy trình không hợp lệ: ${q.loai}`);
    if (!q.tieu_de?.trim()) bao("Thiếu tiêu đề");
    if (!TRANG_THAI_TRA_CUU.includes(q.trang_thai)) bao(`Trạng thái không hợp lệ: ${q.trang_thai}`);
    if (!q.cac_buoc?.length) bao("Quy trình chưa có bước nào");
    const maBuoc = new Set<string>();
    (q.cac_buoc ?? []).forEach((b, i) => {
      if (!b.tieu_de?.trim()) bao(`Bước ${i + 1} thiếu tiêu đề`);
      if (b.can_cu && !URN_DIEU_KHOAN.test(b.can_cu)) bao(`Bước ${i + 1} có căn cứ sai dạng: ${b.can_cu}`);
      if (b.tro_choi != null) {
        for (const s of kiemTraBuocCoThaoTac(b)) bao(`Bước ${i + 1}: ${s}`);
        if (b.tro_choi.ma && maBuoc.has(b.tro_choi.ma))
          bao(`Bước ${i + 1}: trùng loại bước "${b.tro_choi.ma}"`);
        maBuoc.add(b.tro_choi.ma);
      }
    });
  }
  return loi;
}

/** Kiểm phần trò chơi của một bước quy trình. Trả danh sách lỗi; rỗng là hợp lệ. */
export function kiemTraBuocCoThaoTac(b: BuocQuyTrinh): string[] {
  const t = b.tro_choi;
  if (!t || typeof t !== "object") return ["thiếu phần thao tác"];
  const loi: string[] = [];
  if (typeof t.ma !== "string" || !/^[a-z_]{3,40}$/.test(t.ma))
    loi.push("loại bước phải là chữ thường không dấu");
  if (!(THAO_TAC_BUOC as readonly string[]).includes(t.thao_tac))
    loi.push(`thao tác không hợp lệ: ${t.thao_tac}`);
  if (typeof t.bat_buoc !== "boolean") loi.push("thiếu cờ bắt buộc");
  if (t.dieu_kien != null && (typeof t.dieu_kien !== "string" || !/^[a-z_]{3,40}$/.test(t.dieu_kien)))
    loi.push("điều kiện phải là chữ thường không dấu hoặc để trống");
  if (!(NGUON_BUOC as readonly string[]).includes(t.nguon)) loi.push(`nguồn không hợp lệ: ${t.nguon}`);
  else if (t.nguon === "van_ban" && !b.can_cu) loi.push("bước lấy từ văn bản phải có căn cứ");
  return loi;
}

/** Mọi URN căn cứ trong hai tệp, không trùng, để script nạp kiểm với kho. */
export function canCuCuaDuLieu(mucPhat: DongMucPhat[], quyTrinh: QuyTrinh[]): string[] {
  const s = new Set<string>();
  for (const d of mucPhat) if (d.can_cu) s.add(d.can_cu);
  for (const q of quyTrinh) for (const b of q.cac_buoc ?? []) if (b.can_cu) s.add(b.can_cu);
  return [...s];
}

/** "6000000" -> "6.000.000 đồng". */
export function dinhDangTien(dong: number): string {
  return `${dong.toLocaleString("vi-VN")} đồng`;
}

/* ------------------------------------------------------------------ */
/* Tốc độ tối đa theo loại đường (docs/PLAN.md GĐ-G2)                  */
/* ------------------------------------------------------------------ */

/**
 * Một dòng tốc độ tối đa, đúng hình dạng trong data/tra-cuu/toc-do-toi-da.json.
 *
 * `toc_do_toi_da` để `null` khi chưa có văn bản gốc trong kho để đối chiếu: dòng đó chỉ là khung
 * chờ đơn vị chuyên môn điền, không được nạp vào CSDL (GAME_DESIGN §7 câu Q6).
 */
export interface DongTocDoToiDa {
  ma: string;
  /** Loại xe chi tiết theo văn bản quy định tốc độ, ví dụ "xe ô tô con". */
  loai_xe_chi_tiet: string;
  /** Nhóm xe dùng để khớp với bảng mức phạt. */
  xe: LoaiXe;
  loai_duong: string;
  ten_loai_duong: string;
  toc_do_toi_da: number | null;
  can_cu: string | null;
  hieu_luc_tu: string;
  hieu_luc_den?: string | null;
  trang_thai: TrangThaiTraCuu;
  ghi_chu?: string;
}

/** Dòng đã có số liệu, nạp được vào CSDL. */
export function coSoLieuTocDo(
  d: DongTocDoToiDa,
): d is DongTocDoToiDa & { toc_do_toi_da: number; can_cu: string } {
  return d.toc_do_toi_da !== null && d.can_cu !== null;
}

/**
 * Kiểm tra tệp tốc độ tối đa. Dòng chưa có số liệu hợp lệ nếu đủ các trường khác; dòng có số liệu
 * phải có căn cứ tới điều, khoản. Không được có hai dòng cùng loại xe chi tiết, cùng loại đường,
 * hiệu lực chồng nhau.
 */
export function kiemTraTocDoToiDa(ds: DongTocDoToiDa[]): LoiDuLieu[] {
  const loi: LoiDuLieu[] = [];
  const daGap = new Set<string>();
  for (const d of ds) {
    const bao = (s: string) => loi.push({ ma: d.ma || "(không mã)", loi: s });
    if (!d.ma) bao("thiếu mã");
    else if (daGap.has(d.ma)) bao("trùng mã");
    daGap.add(d.ma);
    if (!(LOAI_XE as readonly string[]).includes(d.xe)) bao(`loại xe "${d.xe}" không hợp lệ`);
    if (!d.loai_xe_chi_tiet?.trim()) bao("thiếu loại xe chi tiết");
    if (!d.loai_duong?.trim() || !d.ten_loai_duong?.trim()) bao("thiếu loại đường");
    if (!NGAY.test(d.hieu_luc_tu ?? "")) bao("ngày hiệu lực phải dạng YYYY-MM-DD");
    if (d.toc_do_toi_da !== null) {
      if (!Number.isInteger(d.toc_do_toi_da) || d.toc_do_toi_da <= 0 || d.toc_do_toi_da > 200)
        bao("tốc độ tối đa phải là số nguyên dương, tối đa 200 km/h");
      if (!d.can_cu || !URN_DIEU_KHOAN.test(d.can_cu))
        bao("có tốc độ thì phải có căn cứ trỏ tới điều, khoản");
    } else if (d.trang_thai === "da_duyet") bao("dòng chưa có tốc độ không được ở trạng thái đã duyệt");
  }
  for (let i = 0; i < ds.length; i++) {
    for (let j = i + 1; j < ds.length; j++) {
      const a = ds[i]!;
      const b = ds[j]!;
      if (
        a.loai_xe_chi_tiet === b.loai_xe_chi_tiet &&
        a.loai_duong === b.loai_duong &&
        hieuLucChongNhau(a, b)
      ) {
        loi.push({ ma: b.ma, loi: `trùng loại xe và loại đường với ${a.ma} trong cùng thời gian hiệu lực` });
      }
    }
  }
  return loi;
}
