/**
 * Loại dữ liệu tra cứu soạn được dòng mới trong ứng dụng: mức phạt, quy trình, tốc độ tối đa, luật giấy
 * tờ, tải trọng (LOAI_SOAN_DUOC ở @qdpl/db, gửi JSON), biển báo và biểu mẫu (kèm ảnh hoặc tệp, gửi form
 * multipart).
 */
export const LOAI_SOAN = [
  { id: "muc-phat", ten: "Mức phạt" },
  { id: "bien-bao", ten: "Biển báo" },
  { id: "quy-trinh", ten: "Quy trình" },
  { id: "toc-do-toi-da", ten: "Tốc độ tối đa" },
  { id: "luat-giay-to", ten: "Luật giấy tờ" },
  { id: "tai-trong", ten: "Tải trọng" },
  { id: "bieu-mau", ten: "Biểu mẫu" },
] as const;
export type LoaiSoan = (typeof LOAI_SOAN)[number]["id"];

export const laLoaiSoan = (v: string | null): v is LoaiSoan => LOAI_SOAN.some((l) => l.id === v);

/** Cử chỉ của bước quy trình trong trò chơi (khớp THAO_TAC_BUOC của @qdpl/dao-tao). */
export const THAO_TAC_BUOC = [
  { id: "vuot", ten: "Vuốt" },
  { id: "cham", ten: "Chạm" },
  { id: "keo", ten: "Kéo" },
  { id: "giu", ten: "Giữ" },
] as const;

/** Nguồn của bước quy trình trong trò chơi (khớp NGUON_BUOC của @qdpl/dao-tao). */
export const NGUON_BUOC = [
  { id: "van_ban", ten: "Văn bản trong kho (phải ghi căn cứ)" },
  { id: "tai_lieu_nghiep_vu", ten: "Tài liệu nghiệp vụ của đơn vị" },
  { id: "chua_co_can_cu", ten: "Chưa có căn cứ" },
] as const;

/** Phần trò chơi của một bước quy trình (BuocCoThaoTac của @qdpl/dao-tao). */
export interface TroChoiCuaBuoc {
  ma: string;
  thao_tac: string;
  bat_buoc: boolean;
  dieu_kien?: string | null;
  nguon: string;
}

/** Một bước quy trình như API nhận và trả (BuocQuyTrinh của @qdpl/dao-tao). */
export interface BuocQuyTrinh {
  tieu_de: string;
  mo_ta: string;
  can_cu?: string | null;
  tro_choi?: TroChoiCuaBuoc | null;
}

/** Loại giới hạn tải trọng (khớp `load_limits.kind`). */
export const LOAI_TAI_TRONG = [
  { id: "tong", ten: "Tổng trọng lượng theo loại xe" },
  { id: "truc_don", ten: "Trục đơn" },
  { id: "cum_truc", ten: "Cụm trục" },
] as const;

/** Loại xe tải của giới hạn tải trọng (khớp LOAI_XE_TAI của @qdpl/dao-tao). */
export const LOAI_XE_TAI = [
  { id: "xe_tai_2_truc", ten: "Xe tải hai trục" },
  { id: "xe_tai_3_truc", ten: "Xe tải ba trục" },
  { id: "xe_tai_4_truc", ten: "Xe tải bốn trục" },
  { id: "dau_keo_so_mi", ten: "Xe đầu kéo kéo sơ mi rơ moóc" },
] as const;

const chu = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const soHoacNull = (v: unknown) => (chu(v) === "" ? null : Number(chu(v)));

/** Cách viết cận của một khoảng (tốc độ vượt, phần trăm quá tải), như `bien` trong tệp nạp. */
export const BIEN_KHOANG = [
  { id: "[)", ten: "Từ … đến dưới …" },
  { id: "[]", ten: "Từ … đến …" },
  { id: "(]", ten: "Trên … đến …" },
  { id: "()", ten: "Trên … đến dưới …" },
] as const;

/** Mốc so sánh của khung phần trăm quá tải (khớp LOAI_QUA_TAI của @qdpl/dao-tao). */
export const LOAI_QUA_TAI = [
  { id: "kiem_dinh", ten: "So với giấy chứng nhận kiểm định" },
  { id: "cau_duong", ten: "So với tải trọng cho phép của cầu, đường" },
] as const;

const tach = (v: unknown, dau: RegExp) =>
  String(v ?? "")
    .split(dau)
    .map((s) => s.trim())
    .filter(Boolean);

/** Trường của dòng mức phạt, đọc từ khung nhập dùng chung cho soạn mới và sửa. */
export function docMucPhat(f: FormData) {
  return {
    vehicle: chu(f.get("vehicle")),
    group_name: chu(f.get("group_name")) || null,
    behavior: chu(f.get("behavior")),
    keywords: tach(f.get("keywords"), /[,\r\n]/),
    fine_min: Number(f.get("fine_min")),
    fine_max: Number(f.get("fine_max")),
    point_deduction: soHoacNull(f.get("point_deduction")),
    extra_penalties: tach(f.get("extra_penalties"), /\r?\n/),
    speed_over_min: soHoacNull(f.get("speed_over_min")),
    speed_over_max: soHoacNull(f.get("speed_over_max")),
    speed_bounds: chu(f.get("speed_bounds")) || "[)",
    qua_tai_loai: chu(f.get("qua_tai_loai")) || null,
    qua_tai_tu: soHoacNull(f.get("qua_tai_tu")),
    qua_tai_den: soHoacNull(f.get("qua_tai_den")),
    qua_tai_bien: chu(f.get("qua_tai_bien")) || "(]",
    citation_urn: chu(f.get("citation_urn")),
    effective_from: chu(f.get("effective_from")),
    effective_to: chu(f.get("effective_to")) || null,
  };
}

/** Loại tệp ảnh biển báo nhận khi tải lên. */
export const NHAN_ANH_BIEN_BAO = ".svg,.png,.webp";

/** Đường dẫn ảnh của một biển trên web, từ cột `image_uri` (assets/bien-bao/<tệp>). */
export const urlAnhBienBao = (imageUri: unknown) =>
  `/bien-bao/anh/${encodeURIComponent(String(imageUri ?? "").replace(/^.*\//, ""))}`;

/** Trường của biển báo, đọc từ khung nhập dùng chung cho soạn mới và sửa (ảnh gửi riêng). */
export function docBienBao(f: FormData) {
  return {
    group_name: chu(f.get("group_name")),
    name: chu(f.get("name")),
    meaning: chu(f.get("meaning")),
    citation_urn: chu(f.get("citation_urn")),
    reaction: chu(f.get("reaction")) || null,
    reaction_note: chu(f.get("reaction_note")) || null,
  };
}

/** Nhóm luật giấy tờ (khớp NHOM_LUAT của @qdpl/dao-tao); mỗi nhóm phục vụ một trò chơi. */
export const NHOM_LUAT = [
  { id: "giay_to_nguoi_lai", ten: "Giấy tờ người lái" },
  { id: "ho_so_phat_nguoi", ten: "Hồ sơ phạt nguội" },
  { id: "van_tai_khach", ten: "Vận tải hành khách" },
] as const;

/**
 * Kiểu kiểm của luật giấy tờ, gộp cả ba nhóm (KIEU_KIEM, KIEU_KIEM_PHAT_NGUOI, KIEU_KIEM_VAN_TAI của
 * @qdpl/dao-tao). Kiểu nào dùng được với nhóm nào do API kiểm và báo lại.
 */
export const KIEU_KIEM_LUAT = [
  { id: "phai_co", ten: "Phải có" },
  { id: "con_han", ten: "Còn hạn" },
  { id: "khop_xe", ten: "Khớp với xe" },
  { id: "khop_nguoi", ten: "Khớp với người lái (giấy tờ người lái)" },
  { id: "hang_gplx", ten: "Hạng giấy phép hợp loại xe (giấy tờ người lái)" },
  { id: "doc_duoc", ten: "Đọc được (phạt nguội)" },
  { id: "thay_hanh_vi", ten: "Ảnh thấy rõ hành vi (phạt nguội)" },
  { id: "khop_hanh_vi", ten: "Hành vi khớp với ảnh (phạt nguội)" },
  { id: "trong_khung_gio", ten: "Trong khung giờ (phạt nguội)" },
  { id: "so_nguoi", ten: "Số người được chở (vận tải khách)" },
  { id: "tre_em", ten: "Cách tính trẻ em (vận tải khách)" },
  { id: "khop_lai_xe", ten: "Khớp với lái xe (vận tải khách)" },
  { id: "dung_ngay", ten: "Đúng ngày (vận tải khách)" },
  { id: "lai_lien_tuc", ten: "Thời gian lái liên tục (vận tải khách)" },
  { id: "lai_trong_ngay", ten: "Thời gian lái trong ngày (vận tải khách)" },
] as const;

/** Giấy tờ hoặc phần được kiểm (cột `doc_kind`), gộp cả ba nhóm. */
export const PHAN_KIEM_LUAT = [
  { id: "gplx", ten: "Giấy phép lái xe" },
  { id: "dang_ky", ten: "Giấy chứng nhận đăng ký xe" },
  { id: "bao_hiem", ten: "Bảo hiểm bắt buộc" },
  { id: "thoi_diem", ten: "Thời điểm (phạt nguội)" },
  { id: "bien_so", ten: "Biển số (phạt nguội)" },
  { id: "anh", ten: "Ảnh (phạt nguội)" },
  { id: "hanh_vi", ten: "Hành vi (phạt nguội)" },
  { id: "thiet_bi", ten: "Thiết bị (phạt nguội)" },
  { id: "khoang_xe", ten: "Khoang xe (vận tải khách)" },
  { id: "lenh_van_chuyen", ten: "Lệnh vận chuyển (vận tải khách)" },
  { id: "phu_hieu", ten: "Phù hiệu (vận tải khách)" },
  { id: "giam_sat_hanh_trinh", ten: "Giám sát hành trình (vận tải khách)" },
] as const;

/** Loại xe áp dụng của luật giấy tờ người lái (khớp PHAN_LOAI_XE của @qdpl/dao-tao). */
export const PHAN_LOAI_XE = [
  { id: "mo_to_nho", ten: "Mô tô đến 125 cm³" },
  { id: "mo_to_lon", ten: "Mô tô trên 125 cm³" },
  { id: "o_to_con", ten: "Ô tô chở người đến 8 chỗ" },
] as const;

/** Tham số dạng số nguyên của luật giấy tờ; kiểu kiểm nào cần tham số nào do API kiểm. */
export const THAM_SO_SO_LUAT = [
  { id: "do_mo_toi_da", ten: "Độ mờ tối đa của ảnh (0 đến 3)" },
  { id: "toi_da_phut", ten: "Thời gian lái tối đa (phút)" },
  { id: "nghi_toi_thieu_phut", ten: "Nghỉ tối thiểu (phút)" },
  { id: "so_tre", ten: "Trẻ em: số trẻ" },
  { id: "bang_nguoi", ten: "Trẻ em: tính bằng số người" },
] as const;

/** Trường của luật giấy tờ, đọc từ khung nhập dùng chung cho soạn mới và sửa; tham số trống thì bỏ. */
export function docLuatGiayTo(f: FormData) {
  const params: Record<string, unknown> = {};
  if (chu(f.get("truong"))) params.truong = chu(f.get("truong"));
  const hang = tach(f.get("hang"), /,/);
  if (hang.length) params.hang = hang;
  for (const t of THAM_SO_SO_LUAT) {
    const v = soHoacNull(f.get(t.id));
    if (v !== null) params[t.id] = v;
  }
  if (chu(f.get("lam_tron"))) params.lam_tron = chu(f.get("lam_tron"));
  return {
    nhom: chu(f.get("nhom")),
    check_kind: chu(f.get("check_kind")),
    doc_kind: chu(f.get("doc_kind")) || null,
    vehicle_classes: f.getAll("vehicle_classes").map(String),
    params,
    name: chu(f.get("name")),
    explanation: chu(f.get("explanation")),
    violation_code: chu(f.get("violation_code")) || null,
    citation_urn: chu(f.get("citation_urn")),
    effective_from: chu(f.get("effective_from")),
    effective_to: chu(f.get("effective_to")) || null,
  };
}

/** Trường của dòng tốc độ tối đa, đọc từ khung nhập dùng chung cho soạn mới và sửa. */
export function docTocDoToiDa(f: FormData) {
  return {
    vehicle_class: chu(f.get("vehicle_class")),
    violation_vehicle: chu(f.get("violation_vehicle")),
    road_type: chu(f.get("road_type")),
    road_type_name: chu(f.get("road_type_name")),
    max_speed: Number(f.get("max_speed")),
    citation_urn: chu(f.get("citation_urn")),
    effective_from: chu(f.get("effective_from")),
    effective_to: chu(f.get("effective_to")) || null,
  };
}

/** Trường của dòng giới hạn tải trọng, đọc từ khung nhập dùng chung cho soạn mới và sửa. */
export function docTaiTrong(f: FormData) {
  return {
    kind: chu(f.get("kind")),
    vehicle_class: chu(f.get("vehicle_class")) || null,
    group_axles: soHoacNull(f.get("group_axles")),
    spacing_from_cm: soHoacNull(f.get("spacing_from_cm")),
    spacing_to_cm: soHoacNull(f.get("spacing_to_cm")),
    limit_kg: Number(f.get("limit_kg")),
    name: chu(f.get("name")),
    citation_urn: chu(f.get("citation_urn")),
    effective_from: chu(f.get("effective_from")),
    effective_to: chu(f.get("effective_to")) || null,
  };
}

/**
 * Đọc ô ẩn `steps` của khung nhập bước (components/quan-tri/SuaBuocQuyTrinh.tsx) thành các bước gửi
 * API: cắt khoảng trắng, căn cứ trống thành null, bỏ bước để trống hoàn toàn. Bước không dùng trong
 * trò chơi thì không có khóa `tro_choi`. Trả null khi ô ẩn không đọc được.
 */
export function docBuocQuyTrinh(raw: FormDataEntryValue | null): BuocQuyTrinh[] | null {
  let ds: unknown;
  try {
    ds = JSON.parse(String(raw ?? "[]"));
  } catch {
    return null;
  }
  if (!Array.isArray(ds)) return null;
  const buoc: BuocQuyTrinh[] = [];
  for (const b of ds as Array<Record<string, unknown>>) {
    const t = b?.tro_choi as Record<string, unknown> | null | undefined;
    const mot: BuocQuyTrinh = {
      tieu_de: chu(b?.tieu_de),
      mo_ta: chu(b?.mo_ta),
      can_cu: chu(b?.can_cu) || null,
    };
    if (t && typeof t === "object") {
      mot.tro_choi = {
        ma: chu(t.ma),
        thao_tac: chu(t.thao_tac),
        bat_buoc: t.bat_buoc === true,
        dieu_kien: chu(t.dieu_kien) || null,
        nguon: chu(t.nguon),
      };
    }
    if (mot.tieu_de || mot.mo_ta || mot.can_cu || mot.tro_choi) buoc.push(mot);
  }
  return buoc;
}
