/**
 * Ngân hàng câu hỏi (docs/PLAN.md GĐ3): kiểu dữ liệu, kiểm tra hợp lệ theo loại, vòng đời
 * duyệt, và chấm.
 *
 * Câu hỏi chấm máy không viết lại cách chấm: câu hỏi được ánh xạ sang `HoatDong` rồi đi qua
 * `chamBaiTap` của grading.ts, để luyện tập, thi và bài tập trong bài học chấm cùng một thuật toán.
 *
 * Câu `tu_luan` chỉ dùng trong đề thi: chấm theo `rubric` bằng mô hình (cham-tu-luan.ts) hoặc
 * giảng viên. Luyện tập và gói offline chỉ rút các loại trong `LOAI_CHAM_MAY`.
 *
 * Ranh giới giữ nghiêm như grading.ts: `answer` không bao giờ rời máy chủ trước khi người học
 * trả lời. Phần gửi cho người học đi qua `deChoNguoiHoc`.
 */

import { chamBaiTap, kiemTraRubric } from "./grading.ts";
import type { DapAn, HoatDong, LoaiBaiTap, PhuongAn, Rubric } from "./types.ts";
import { chuyenTrangThai, TRANG_THAI_DUYET, type TrangThaiDuyet } from "./vong-doi-duyet.ts";

// Vòng đời duyệt tách sang vong-doi-duyet.ts (GĐ-G0) để dùng chung cho mọi loại nội dung.
export { type HanhDongDuyet, hauQuaSua } from "./vong-doi-duyet.ts";

export const LOAI_CAU_HOI = [
  "mot_dap_an",
  "nhieu_dap_an",
  "dung_sai",
  "dien_khuyet",
  "sap_xep",
  "ghep_cap",
  "tu_luan",
] as const;
export type LoaiCauHoi = (typeof LOAI_CAU_HOI)[number];

/** Loại câu máy chấm được ngay: nguồn câu của luyện tập và gói offline. */
export const LOAI_CHAM_MAY = [
  "mot_dap_an",
  "nhieu_dap_an",
  "dung_sai",
  "dien_khuyet",
  "sap_xep",
  "ghep_cap",
] as const satisfies readonly LoaiCauHoi[];

export const TEN_LOAI_CAU_HOI: Record<LoaiCauHoi, string> = {
  mot_dap_an: "Một đáp án",
  nhieu_dap_an: "Nhiều đáp án",
  dung_sai: "Đúng/sai",
  dien_khuyet: "Điền chỗ trống",
  sap_xep: "Sắp xếp thứ tự",
  ghep_cap: "Ghép cặp",
  tu_luan: "Tự luận",
};

export const MUC_DO_CAU_HOI = ["de", "trung_binh", "kho"] as const;
export type MucDoCauHoi = (typeof MUC_DO_CAU_HOI)[number];

export const TEN_MUC_DO: Record<MucDoCauHoi, string> = {
  de: "Dễ",
  trung_binh: "Trung bình",
  kho: "Khó",
};

export const TRANG_THAI_CAU_HOI = TRANG_THAI_DUYET;
export type TrangThaiCauHoi = TrangThaiDuyet;

export const TEN_TRANG_THAI_CAU_HOI: Record<TrangThaiCauHoi, string> = {
  nhap: "Bản nháp",
  cho_duyet: "Chờ duyệt",
  da_duyet: "Đã duyệt",
  tu_choi: "Bị từ chối",
  luu_tru: "Lưu trữ",
};

export const NGUON_CAU_HOI = ["nguoi", "ai", "nhap_excel"] as const;
export type NguonCauHoi = (typeof NGUON_CAU_HOI)[number];

export const TEN_NGUON_CAU_HOI: Record<NguonCauHoi, string> = {
  nguoi: "Người soạn",
  ai: "AI sinh",
  nhap_excel: "Nhập Excel",
};

/** Một mục hiển thị: phương án, bước cần xếp, vế ghép cặp. */
export interface MucLuaChon {
  id: string;
  /** Chữ của phương án; được để trống khi phương án là một hình (`image_uri`). */
  text: string;
  /** Hình của phương án (câu "chọn một biển trong các biển"), URI như `NoiDungCauHoi.image_uris`. */
  image_uri?: string | null;
}

/**
 * Phương án của câu hỏi, không chứa đáp án.
 * - `mot_dap_an`, `nhieu_dap_an`, `sap_xep`: `phuong_an`
 * - `ghep_cap`: `trai` và `phai`
 * - `dung_sai`, `dien_khuyet`: rỗng (ô trống đánh dấu bằng `___` trong đề)
 */
export interface LuaChonCauHoi {
  phuong_an?: MucLuaChon[];
  trai?: MucLuaChon[];
  phai?: MucLuaChon[];
}

/** Đáp án. Tên khóa trùng với `DapAn` của grading.ts để ánh xạ thẳng. */
export interface DapAnCauHoi {
  /** Id phương án đúng; với `dung_sai` là `["dung"]` hoặc `["sai"]`. */
  dung?: string[];
  /** Thứ tự đúng của `phuong_an` (sap_xep). */
  thu_tu?: string[];
  /** Cặp đúng { idTrai: idPhai } (ghep_cap). */
  cap?: Record<string, string>;
  /** Mỗi ô trống "1", "2"… và các cách viết được chấp nhận (dien_khuyet). */
  o_trong?: Record<string, string[]>;
}

/**
 * Phần nội dung của một câu hỏi, đủ để kiểm tra hợp lệ và chấm.
 *
 * Câu `tu_luan`: `options` và `answer` rỗng; `explanation` là đáp án gợi ý (dàn ý có viện dẫn),
 * chỉ hiện cho người thi theo cấu hình xem đáp án và KHÔNG đưa cho mô hình chấm; `rubric` là
 * tiêu chí chấm.
 */
export interface NoiDungCauHoi {
  kind: LoaiCauHoi;
  level: MucDoCauHoi;
  stem: string;
  options: LuaChonCauHoi;
  answer: DapAnCauHoi;
  explanation: string | null;
  citations: string[];
  rubric?: Rubric | Record<string, never>;
  /** Các ảnh minh họa của đề (ảnh biển báo…) theo thứ tự hiển thị, URI trong kho dạng `assets/bien-bao/<tệp>`. */
  image_uris?: string[] | null;
}

/**
 * Rubric mặc định của câu tự luận (câu nhập Excel, câu AI sinh thiếu rubric). Hợp lệ theo
 * `kiemTraRubric`: tiêu chí `can_cu` nặng nhất và có mức 0 cho căn cứ đã hết hiệu lực.
 */
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

/** Hai phương án cố định của câu đúng/sai. */
export const PHUONG_AN_DUNG_SAI: readonly MucLuaChon[] = [
  { id: "dung", text: "Đúng" },
  { id: "sai", text: "Sai" },
];

/** Ô trống trong đề điền khuyết: ba dấu gạch dưới trở lên. */
const O_TRONG_RE = /_{3,}/g;

export function soOTrong(stem: string): number {
  return (stem.match(O_TRONG_RE) ?? []).length;
}

/** Tách đề điền khuyết thành các đoạn chữ xen giữa ô trống, để giao diện dựng ô nhập. */
export function tachDeDienKhuyet(stem: string): string[] {
  return stem.split(O_TRONG_RE);
}

/* ------------------------------------------------------------------ */
/* Kiểm tra hợp lệ                                                     */
/* ------------------------------------------------------------------ */

function kiemTraDanhSach(
  ten: string,
  ds: MucLuaChon[] | undefined,
  toiThieu: number,
  loi: string[],
  /** Mục được phép chỉ có hình, không có chữ (phương án trắc nghiệm). */
  choAnh = false,
): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(ds) || ds.length < toiThieu) {
    loi.push(`Cần ít nhất ${toiThieu} ${ten}`);
    return ids;
  }
  for (const [i, m] of ds.entries()) {
    const id = String(m?.id ?? "").trim();
    if (!id) loi.push(`${ten} thứ ${i + 1} thiếu mã`);
    else if (ids.has(id)) loi.push(`Mã ${ten} "${id}" bị trùng`);
    ids.add(id);
    if (!String(m?.text ?? "").trim() && !(choAnh && m?.image_uri))
      loi.push(`${ten} thứ ${i + 1} chưa có nội dung`);
  }
  return ids;
}

function laHoanVi(a: string[], ids: Set<string>): boolean {
  return a.length === ids.size && new Set(a).size === a.length && a.every((x) => ids.has(x));
}

/**
 * Kiểm tra một câu hỏi theo loại. Trả danh sách lỗi tiếng Việt; rỗng là hợp lệ.
 * Câu hợp lệ mới được lưu, gửi duyệt hoặc nhập từ Excel.
 */
export function kiemTraCauHoi(c: Partial<NoiDungCauHoi>): string[] {
  const loi: string[] = [];
  const kind = c.kind as LoaiCauHoi;
  if (!LOAI_CAU_HOI.includes(kind)) {
    loi.push(`Loại câu hỏi không hợp lệ: ${String(c.kind ?? "(trống)")}`);
    return loi;
  }
  if (!MUC_DO_CAU_HOI.includes(c.level as MucDoCauHoi)) {
    loi.push(`Mức độ không hợp lệ: ${String(c.level ?? "(trống)")}`);
  }
  const stem = String(c.stem ?? "").trim();
  if (!stem) loi.push("Chưa có nội dung câu hỏi");
  if (!String(c.explanation ?? "").trim()) loi.push("Chưa có giải thích đáp án");
  for (const urn of c.citations ?? []) {
    if (!/^vn:\S+$/.test(urn)) loi.push(`Căn cứ không đúng dạng URN: ${urn}`);
  }

  const options = c.options ?? {};
  const answer = c.answer ?? {};

  switch (kind) {
    case "mot_dap_an":
    case "nhieu_dap_an": {
      const ids = kiemTraDanhSach("phương án", options.phuong_an, kind === "mot_dap_an" ? 2 : 3, loi, true);
      const dung = answer.dung ?? [];
      if (dung.some((d) => !ids.has(d))) loi.push("Đáp án trỏ tới phương án không có");
      if (new Set(dung).size !== dung.length) loi.push("Đáp án bị lặp");
      if (kind === "mot_dap_an" && dung.length !== 1) loi.push("Câu một đáp án phải có đúng một đáp án đúng");
      if (kind === "nhieu_dap_an") {
        if (dung.length < 2) loi.push("Câu nhiều đáp án phải có ít nhất hai đáp án đúng");
        if (ids.size > 0 && dung.length >= ids.size) loi.push("Phải có ít nhất một phương án sai");
      }
      break;
    }
    case "dung_sai": {
      const dung = answer.dung ?? [];
      if (dung.length !== 1 || !["dung", "sai"].includes(dung[0]!)) {
        loi.push('Câu đúng/sai phải có đáp án là "Đúng" hoặc "Sai"');
      }
      break;
    }
    case "dien_khuyet": {
      const n = soOTrong(stem);
      if (n === 0) loi.push("Câu điền chỗ trống phải có ít nhất một ô trống (___) trong đề");
      const o = answer.o_trong ?? {};
      for (let i = 1; i <= n; i++) {
        const cach = (o[String(i)] ?? []).filter((s) => String(s).trim());
        if (!cach.length) loi.push(`Ô trống ${i} chưa có đáp án`);
      }
      if (Object.keys(o).some((k) => !/^\d+$/.test(k) || Number(k) < 1 || Number(k) > n)) {
        loi.push("Số đáp án nhiều hơn số ô trống trong đề");
      }
      break;
    }
    case "sap_xep": {
      const ids = kiemTraDanhSach("bước", options.phuong_an, 3, loi);
      if (ids.size && !laHoanVi(answer.thu_tu ?? [], ids)) {
        loi.push("Thứ tự đúng phải gồm đủ mọi bước, mỗi bước một lần");
      }
      break;
    }
    case "ghep_cap": {
      const trai = kiemTraDanhSach("vế trái", options.trai, 2, loi);
      const phai = kiemTraDanhSach("vế phải", options.phai, 2, loi);
      const cap = answer.cap ?? {};
      for (const t of trai) {
        if (!cap[t]) loi.push(`Vế trái "${t}" chưa được ghép`);
        else if (!phai.has(cap[t]!)) loi.push(`Vế trái "${t}" ghép với vế phải không có`);
      }
      if (Object.keys(cap).some((t) => !trai.has(t))) loi.push("Đáp án có cặp trỏ tới vế trái không có");
      break;
    }
    case "tu_luan": {
      if (!(c.citations ?? []).length) loi.push("Câu tự luận phải có ít nhất một căn cứ");
      for (const l of kiemTraRubric(c.rubric)) loi.push(`Tiêu chí chấm: ${l}`);
      break;
    }
  }
  return loi;
}

/* ------------------------------------------------------------------ */
/* Vòng đời duyệt                                                      */
/* ------------------------------------------------------------------ */

/**
 * Trạng thái sau hành động, hoặc null khi hành động không áp dụng được. Luật chung ở
 * vong-doi-duyet.ts; tên cũ giữ lại cho các nơi gọi của GĐ3.
 */
export const chuyenTrangThaiCauHoi = chuyenTrangThai;

/* ------------------------------------------------------------------ */
/* Phần gửi cho người học                                              */
/* ------------------------------------------------------------------ */

export interface DeCauHoi {
  kind: LoaiCauHoi;
  stem: string;
  options: LuaChonCauHoi;
  /** Số ô trống, chỉ có ở câu điền chỗ trống. */
  so_o_trong?: number;
  /** Các ảnh minh họa của đề, hiện dưới đề theo thứ tự "Hình 1", "Hình 2"…; vắng khi câu không có ảnh. */
  image_uris?: string[];
}

/**
 * Đề bài cho người học: KHÔNG có đáp án, giải thích hay căn cứ (hai thứ sau chỉ hiện sau khi
 * trả lời). Câu đúng/sai được thêm hai phương án cố định để giao diện dựng như trắc nghiệm.
 */
export function deChoNguoiHoc(c: Pick<NoiDungCauHoi, "kind" | "stem" | "options" | "image_uris">): DeCauHoi {
  const sach = (ds?: MucLuaChon[]) =>
    ds?.map((m) => ({ id: m.id, text: m.text, ...(m.image_uri ? { image_uri: m.image_uri } : {}) }));
  // Vế phải của ghép cặp và các bước cần xếp thường được soạn theo đúng thứ tự đáp án; xếp lại
  // theo chữ cái để thứ tự hiển thị không lộ đáp án. Luyện tập và thi (GĐ4, GĐ6) đảo tiếp theo phiên.
  const theoChu = (ds?: MucLuaChon[]) => sach(ds)?.sort((a, b) => a.text.localeCompare(b.text, "vi"));
  const de: DeCauHoi = { kind: c.kind, stem: c.stem, options: {} };
  if (c.image_uris?.length) de.image_uris = c.image_uris;
  if (c.kind === "dung_sai") de.options = { phuong_an: [...PHUONG_AN_DUNG_SAI] };
  else if (c.kind === "ghep_cap") de.options = { trai: sach(c.options.trai), phai: theoChu(c.options.phai) };
  else if (c.kind === "dien_khuyet") de.so_o_trong = soOTrong(c.stem);
  else if (c.kind === "sap_xep") de.options = { phuong_an: theoChu(c.options.phuong_an) };
  else if (c.kind === "tu_luan") de.options = {};
  else de.options = { phuong_an: sach(c.options.phuong_an) };
  return de;
}

/* ------------------------------------------------------------------ */
/* Chấm                                                                */
/* ------------------------------------------------------------------ */

/**
 * Câu trả lời của người học, theo loại:
 * - `mot_dap_an`, `nhieu_dap_an`, `dung_sai`: `{ chon: string[] }`
 * - `sap_xep`: `{ thu_tu: string[] }`
 * - `ghep_cap`: `{ cap: { idTrai: idPhai } }`
 * - `dien_khuyet`: `{ o_trong: { "1": "...", "2": "..." } }`
 * - `tu_luan`: `{ bai_viet: "..." }`
 */
export interface TraLoiCauHoi {
  chon?: string[];
  thu_tu?: string[];
  cap?: Record<string, string>;
  o_trong?: Record<string, string>;
  bai_viet?: string;
}

const SANG_LOAI_BAI_TAP: Record<LoaiCauHoi, LoaiBaiTap> = {
  mot_dap_an: "trac_nghiem",
  nhieu_dap_an: "trac_nghiem",
  dung_sai: "dung_sai",
  dien_khuyet: "dien_khuyet",
  sap_xep: "sap_xep",
  ghep_cap: "ghep_cap",
  tu_luan: "viet_co_can_cu",
};

/** Ánh xạ câu hỏi ngân hàng sang `HoatDong` để chấm bằng grading.ts. */
export function sangHoatDong(c: NoiDungCauHoi & { id?: string }): HoatDong {
  const phuongAn: PhuongAn[] | undefined =
    c.kind === "mot_dap_an" || c.kind === "nhieu_dap_an"
      ? (c.options.phuong_an ?? []).map((m) => ({ ...m, dung: (c.answer.dung ?? []).includes(m.id) }))
      : undefined;
  const answer: DapAn = {
    ...(c.answer.dung ? { dung: c.answer.dung } : {}),
    ...(c.answer.thu_tu ? { thu_tu: c.answer.thu_tu } : {}),
    ...(c.answer.cap ? { cap: c.answer.cap } : {}),
    ...(c.answer.o_trong ? { o_trong: c.answer.o_trong } : {}),
    ...(c.explanation ? { giai_thich: c.explanation } : {}),
    ...(phuongAn ? { phuong_an: phuongAn } : {}),
  };
  return {
    id: c.id ?? "cau-hoi",
    lessonId: null,
    courseId: "",
    ordinal: 0,
    kind: SANG_LOAI_BAI_TAP[c.kind],
    mode: c.kind === "tu_luan" ? "ai" : "may",
    prompt: { cau_hoi: c.stem },
    answer,
    rubric: c.rubric ?? {},
    skills: [],
    errorTags: [],
    citations: c.citations,
    difficulty: 0.5,
    points: 1,
    level: 1,
    status: "xuat_ban",
    retired: false,
  };
}

export interface KetQuaCauHoi {
  /** Đúng hoàn toàn. Luyện tập và thi tính câu đúng theo cờ này, không theo ngưỡng 70%. */
  dung: boolean;
  /** Tỷ lệ đúng từng phần, 0–1. */
  ty_le: number;
  /** Đáp án đúng, chỉ gửi SAU khi người học đã trả lời. */
  dap_an: DapAnCauHoi;
  giai_thich: string | null;
  can_cu: string[];
  /** Chi tiết từng ô, từng cặp với loại nhiều phần. */
  chi_tiet?: Array<{ ma: string; dung: boolean }>;
}

/**
 * Chấm máy một câu. Câu tự luận không chấm máy được: trả sai, tỷ lệ 0; điểm thật do mô hình
 * (cham-tu-luan.ts) hoặc giảng viên đưa vào.
 */
export function chamCauHoi(c: NoiDungCauHoi & { id?: string }, traLoi: TraLoiCauHoi): KetQuaCauHoi {
  if (c.kind === "tu_luan") {
    return { dung: false, ty_le: 0, dap_an: c.answer, giai_thich: c.explanation, can_cu: c.citations };
  }
  const kq = chamBaiTap(sangHoatDong(c), traLoi);
  const tyLe = kq.maxScore > 0 ? kq.score / kq.maxScore : 0;
  return {
    dung: tyLe >= 0.9999,
    ty_le: Math.round(tyLe * 1000) / 1000,
    dap_an: c.answer,
    giai_thich: c.explanation,
    can_cu: c.citations,
    ...(kq.feedback.chi_tiet ? { chi_tiet: kq.feedback.chi_tiet.map(({ ma, dung }) => ({ ma, dung })) } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Dòng Excel theo mẫu nhập câu hỏi                                    */
/* ------------------------------------------------------------------ */

/** Chữ cái của các cột phương án trong tệp mẫu. */
export const COT_PHUONG_AN = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

/**
 * Cột của tệp mẫu, theo thứ tự. `khoa` là tên nội bộ; `tieuDe` là dòng tiêu đề người dùng thấy.
 * Đổi tiêu đề thì phải đổi cả tệp data/mau/mau-nhap-cau-hoi.xlsx (sinh lại bằng seed).
 */
export const COT_EXCEL_CAU_HOI: ReadonlyArray<{ khoa: string; tieuDe: string; rong: number }> = [
  { khoa: "ma", tieuDe: "Mã câu", rong: 12 },
  { khoa: "chu_de", tieuDe: "Mã chủ đề", rong: 22 },
  { khoa: "ten_chu_de", tieuDe: "Tên chủ đề", rong: 28 },
  { khoa: "muc_do", tieuDe: "Mức độ", rong: 12 },
  { khoa: "loai", tieuDe: "Loại câu", rong: 16 },
  { khoa: "cau_hoi", tieuDe: "Câu hỏi", rong: 60 },
  ...COT_PHUONG_AN.map((c) => ({ khoa: c, tieuDe: `Phương án ${c}`, rong: 30 })),
  { khoa: "dap_an", tieuDe: "Đáp án", rong: 16 },
  { khoa: "giai_thich", tieuDe: "Giải thích", rong: 50 },
  { khoa: "can_cu", tieuDe: "Căn cứ", rong: 36 },
];

/** Dấu nối hai vế trong ô phương án của câu ghép cặp. */
const NOI_CAP_RE = /\s*(?:=>|->|→)\s*/;

/** So khớp không phân biệt hoa thường và dấu, cho các ô người dùng gõ tay. */
function khop(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[\s/_-]+/g, " ")
    .trim();
}

function timTheoTen<T extends string>(raw: string, nhan: Record<T, string>): T | undefined {
  const k = khop(raw);
  if (!k) return undefined;
  for (const [ma, ten] of Object.entries(nhan) as Array<[T, string]>) {
    if (k === khop(ma) || k === khop(ten)) return ma;
  }
  return undefined;
}

function tachDanhSach(s: string): string[] {
  return s
    .split(/[\s,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export interface CauHoiTuExcel extends NoiDungCauHoi {
  code: string | null;
  topic_code: string | null;
}

/**
 * Đọc một dòng của tệp mẫu thành câu hỏi. Chỉ đổi định dạng, không kiểm tra hợp lệ: người gọi
 * chạy `kiemTraCauHoi` trên kết quả. Trả `loi` khi dòng không đọc được thành câu hỏi.
 */
export function dongExcelSangCauHoi(o: Record<string, string>): { cau?: CauHoiTuExcel; loi: string[] } {
  const loi: string[] = [];
  const g = (k: string) => String(o[k] ?? "").trim();

  const kind = timTheoTen(g("loai"), TEN_LOAI_CAU_HOI);
  if (!kind) loi.push(`Loại câu không hợp lệ: "${g("loai")}"`);
  const level = timTheoTen(g("muc_do"), TEN_MUC_DO);
  if (!level) loi.push(`Mức độ không hợp lệ: "${g("muc_do")}"`);
  if (!kind || !level) return { loi };

  const cot = COT_PHUONG_AN.map((c) => ({ chu: c.toLowerCase(), text: g(c) })).filter((x) => x.text);
  const dapAn = g("dap_an");
  const options: LuaChonCauHoi = {};
  const answer: DapAnCauHoi = {};
  let rubric: Rubric | undefined;

  switch (kind) {
    case "mot_dap_an":
    case "nhieu_dap_an":
      options.phuong_an = cot.map((x) => ({ id: x.chu, text: x.text }));
      answer.dung = tachDanhSach(dapAn).map((x) => x.toLowerCase());
      break;
    case "sap_xep":
      options.phuong_an = cot.map((x) => ({ id: x.chu, text: x.text }));
      answer.thu_tu = tachDanhSach(dapAn).map((x) => x.toLowerCase());
      break;
    case "dung_sai": {
      const k = khop(dapAn);
      const dung = ["dung", "d", "true"].includes(k)
        ? "dung"
        : ["sai", "s", "false"].includes(k)
          ? "sai"
          : null;
      if (!dung) loi.push(`Đáp án câu đúng/sai phải là "Đúng" hoặc "Sai", đang là "${dapAn}"`);
      answer.dung = dung ? [dung] : [];
      break;
    }
    case "ghep_cap": {
      options.trai = [];
      options.phai = [];
      answer.cap = {};
      cot.forEach((x, i) => {
        const [trai, phai, ...du] = x.text.split(NOI_CAP_RE);
        if (!trai || !phai || du.length) {
          loi.push(`Phương án ${x.chu.toUpperCase()} của câu ghép cặp phải có dạng "Vế trái => Vế phải"`);
          return;
        }
        // Nhiều vế trái có thể cùng ghép một vế phải (câu phân loại): vế phải trùng chữ gộp làm một.
        let p = options.phai!.find((m) => khop(m.text) === khop(phai));
        if (!p) {
          p = { id: `p${options.phai!.length + 1}`, text: phai };
          options.phai!.push(p);
        }
        options.trai!.push({ id: `t${i + 1}`, text: trai });
        answer.cap![`t${i + 1}`] = p.id;
      });
      break;
    }
    case "dien_khuyet": {
      answer.o_trong = {};
      dapAn
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((o, i) => {
          answer.o_trong![String(i + 1)] = o
            .split("|")
            .map((s) => s.trim())
            .filter(Boolean);
        });
      break;
    }
    case "tu_luan":
      // Tiêu chí chấm không gõ gọn được trong một ô: dùng rubric mặc định, sửa trên giao diện.
      rubric = RUBRIC_TU_LUAN_MAC_DINH;
      break;
  }

  if (loi.length) return { loi };
  return {
    cau: {
      code: g("ma") || null,
      topic_code: g("chu_de") || null,
      kind,
      level,
      stem: g("cau_hoi"),
      options,
      answer,
      explanation: g("giai_thich") || null,
      citations: g("can_cu")
        .split(/[;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      ...(rubric ? { rubric } : {}),
    },
    loi,
  };
}

/** Chiều ngược lại, cho xuất Excel. Phương án được đánh chữ lại theo thứ tự đang lưu. */
export function cauHoiSangDongExcel(
  c: NoiDungCauHoi & { code: string; topic_code: string | null },
): Record<string, string> {
  const dong: Record<string, string> = {
    ma: c.code,
    chu_de: c.topic_code ?? "",
    muc_do: TEN_MUC_DO[c.level],
    loai: TEN_LOAI_CAU_HOI[c.kind],
    cau_hoi: c.stem,
    dap_an: "",
    giai_thich: c.explanation ?? "",
    can_cu: c.citations.join("; "),
  };
  const chuCua = new Map<string, string>();
  const ghi = (ds: MucLuaChon[] | undefined) =>
    (ds ?? []).slice(0, COT_PHUONG_AN.length).forEach((m, i) => {
      const chu = COT_PHUONG_AN[i]!;
      chuCua.set(m.id, chu);
      dong[chu] = m.text;
    });

  switch (c.kind) {
    case "mot_dap_an":
    case "nhieu_dap_an":
      ghi(c.options.phuong_an);
      dong.dap_an = (c.answer.dung ?? []).map((id) => chuCua.get(id) ?? id).join(", ");
      break;
    case "sap_xep":
      ghi(c.options.phuong_an);
      dong.dap_an = (c.answer.thu_tu ?? []).map((id) => chuCua.get(id) ?? id).join(", ");
      break;
    case "dung_sai":
      dong.dap_an = c.answer.dung?.[0] === "sai" ? "Sai" : "Đúng";
      break;
    case "ghep_cap": {
      const phai = new Map((c.options.phai ?? []).map((m) => [m.id, m.text]));
      (c.options.trai ?? []).slice(0, COT_PHUONG_AN.length).forEach((t, i) => {
        dong[COT_PHUONG_AN[i]!] = `${t.text} => ${phai.get(c.answer.cap?.[t.id] ?? "") ?? ""}`;
      });
      break;
    }
    case "dien_khuyet":
      dong.dap_an = Object.keys(c.answer.o_trong ?? {})
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => (c.answer.o_trong?.[k] ?? []).join(" | "))
        .join("; ");
      break;
    case "tu_luan":
      break;
  }
  return dong;
}

/** Ghi chú trang "Hướng dẫn" của tệp mẫu và tệp xuất: cách điền từng loại câu. Dòng đầu là tiêu đề. */
export const HUONG_DAN_TEP_CAU_HOI: readonly string[] = [
  "Cách điền tệp nhập câu hỏi",
  "Mỗi dòng là một câu. Giữ nguyên dòng tiêu đề; có thể đổi thứ tự cột hoặc thêm cột ghi chú riêng.",
  "Mã câu: để trống thì hệ thống tự cấp. Mã chủ đề: lấy ở màn hình Ngân hàng câu hỏi.",
  "Tên chủ đề: chỉ điền khi mã chủ đề chưa có trong hệ thống. Mã mới chỉ gồm chữ thường không dấu, số và dấu gạch ngang. Khi nhập, tích ô Tự tạo chủ đề chưa có để hệ thống tạo chủ đề với tên này; để trống thì lấy mã làm tên.",
  "Mức độ: Dễ, Trung bình hoặc Khó.",
  "Loại câu: Một đáp án, Nhiều đáp án, Đúng/sai, Điền chỗ trống, Sắp xếp thứ tự, Ghép cặp hoặc Tự luận.",
  "Một đáp án, Nhiều đáp án: điền các phương án vào cột Phương án A, B, C…; cột Đáp án ghi chữ cái, ví dụ B hoặc A, C.",
  "Đúng/sai: để trống các cột phương án; cột Đáp án ghi Đúng hoặc Sai.",
  "Sắp xếp thứ tự: mỗi bước một cột phương án, theo thứ tự tùy ý; cột Đáp án ghi thứ tự đúng, ví dụ C, A, B.",
  "Ghép cặp: mỗi cột phương án ghi một cặp đúng dạng Vế trái => Vế phải; cột Đáp án để trống. Hệ thống tự đảo vế phải khi hiển thị.",
  "Điền chỗ trống: trong câu hỏi, mỗi ô trống viết bằng ba dấu gạch dưới ___. Cột Đáp án ghi đáp án từng ô, cách nhau bằng dấu chấm phẩy; một ô có nhiều cách viết thì ngăn bằng dấu |, ví dụ 36; 2025 | năm 2025.",
  "Tự luận: chỉ dùng trong đề thi. Để trống các cột phương án và cột Đáp án; cột Giải thích ghi đáp án gợi ý (dàn ý có viện dẫn); cột Căn cứ bắt buộc. Tiêu chí chấm lấy theo mẫu mặc định (căn cứ 40%, nội dung 40%, trình bày 20%), sửa được trên màn hình Ngân hàng câu hỏi.",
  "Giải thích: bắt buộc, một đến hai câu nêu vì sao đáp án đúng.",
  "Căn cứ: URN của văn bản, điều, khoản trong kho, cách nhau bằng dấu chấm phẩy.",
  "Câu nhập vào ở trạng thái Chờ duyệt, chưa dùng cho luyện tập hay thi cho tới khi được duyệt.",
];

/** Dòng mẫu trong tệp mẫu: mỗi loại câu một dòng, để người nhập chép theo. */
export const DONG_MAU_CAU_HOI: Array<Record<string, string>> = [
  {
    chu_de: "gt-he-thong-phap-luat",
    muc_do: "Dễ",
    loai: "Một đáp án",
    cau_hoi: "Luật Trật tự, an toàn giao thông đường bộ năm 2024 có số hiệu là gì?",
    A: "Luật số 35/2024/QH15",
    B: "Luật số 36/2024/QH15",
    C: "Luật số 23/2008/QH12",
    dap_an: "B",
    giai_thich: "Luật Trật tự, an toàn giao thông đường bộ là Luật số 36/2024/QH15.",
    can_cu: "vn:vbqppl:l:36/2024/QH15",
  },
  {
    chu_de: "gt-he-thong-phap-luat",
    muc_do: "Dễ",
    loai: "Đúng/sai",
    cau_hoi:
      "Nghị định số 168/2024/NĐ-CP quy định xử phạt vi phạm hành chính về trật tự, an toàn giao thông.",
    dap_an: "Đúng",
    giai_thich: "Điều 1 Nghị định số 168/2024/NĐ-CP nêu phạm vi điều chỉnh gồm xử phạt vi phạm hành chính.",
    can_cu: "vn:vbqppl:nd:168/2024/NĐ-CP",
  },
  {
    chu_de: "gt-he-thong-phap-luat",
    muc_do: "Trung bình",
    loai: "Ghép cặp",
    cau_hoi: "Ghép mỗi nghị định với nội dung nghị định đó quy định.",
    A: "Nghị định số 168/2024/NĐ-CP => Xử phạt vi phạm hành chính, trừ điểm giấy phép lái xe",
    B: "Nghị định số 158/2024/NĐ-CP => Hoạt động vận tải đường bộ",
    giai_thich: "Nội dung lấy theo Điều 1 (phạm vi điều chỉnh) của từng nghị định.",
    can_cu: "vn:vbqppl:nd:168/2024/NĐ-CP; vn:vbqppl:nd:158/2024/NĐ-CP",
  },
  {
    chu_de: "gt-he-thong-phap-luat",
    muc_do: "Khó",
    loai: "Tự luận",
    cau_hoi:
      "Tổ tuần tra phát hiện người điều khiển xe mô tô không đội mũ bảo hiểm. Nêu căn cứ xử phạt và các bước tổ tuần tra cần làm.",
    giai_thich:
      "Xác định hành vi và mức phạt theo Nghị định số 168/2024/NĐ-CP; lập biên bản vi phạm hành chính; nêu thẩm quyền xử phạt.",
    can_cu: "vn:vbqppl:nd:168/2024/NĐ-CP",
  },
];
