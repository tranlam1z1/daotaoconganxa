/**
 * Kiểm tra khối nội dung và kiểm tra nhịp bài học (ke-hoach/09-a §2).
 *
 * Vì sao kiểm ở đây chứ không ở CSDL: hình dạng của `data` khác nhau theo từng kiểu khối,
 * và quy tắc nhịp bài ("không để người học đi quá 6 phút mà không có tương tác") là quy tắc
 * sư phạm, không phải ràng buộc quan hệ. Đặt chung một chỗ để cả API, worker soạn bài và
 * script kiểm tra trước xuất bản dùng lại đúng một bộ luật.
 */

import { type CheDoHoc, KHOI_THEO_KIND, type KhoiNoiDung, type LoaiKhoi, THU_VIEN_KHOI } from "./types.ts";

export interface LoiKiemTra {
  /** canh_bao = xuất bản được nhưng nên sửa; loi = chặn xuất bản. */
  muc: "loi" | "canh_bao";
  ma: string;
  thong_diep: string;
  blockId?: string;
  ordinal?: number;
}

/** Tốc độ đọc tiếng Việt của người lớn khi đọc văn bản hành chính. */
const TU_MOI_PHUT = 180;

export function demTu(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** Rút toàn bộ chữ trong `data` của một khối để ước lượng thời gian đọc. */
export function chuTrongKhoi(khoi: Pick<KhoiNoiDung, "data">): string {
  const phan: string[] = [];
  const duyet = (v: unknown) => {
    if (typeof v === "string") phan.push(v);
    else if (Array.isArray(v)) v.forEach(duyet);
    else if (v && typeof v === "object") Object.values(v as Record<string, unknown>).forEach(duyet);
  };
  duyet(khoi.data);
  return phan.join(" ");
}

/** Thời gian ước tính (phút) để đi hết một khối. */
export function phutCuaKhoi(khoi: Pick<KhoiNoiDung, "kind" | "data">): number {
  const doc = demTu(chuTrongKhoi(khoi)) / TU_MOI_PHUT;
  // Khối tương tác tốn thêm thời gian thao tác, không chỉ thời gian đọc.
  const thaoTac = KHOI_THEO_KIND.get(khoi.kind)?.tuong_tac ? 0.75 : 0;
  return doc + thaoTac;
}

export function phutCuaBai(khoi: Array<Pick<KhoiNoiDung, "kind" | "data">>): number {
  return Math.max(1, Math.round(khoi.reduce((t, k) => t + phutCuaKhoi(k), 0)));
}

/** Trường bắt buộc của từng kiểu khối. Thiếu là lỗi chặn xuất bản. */
const TRUONG_BAT_BUOC: Partial<Record<LoaiKhoi, string[]>> = {
  giang: ["md"],
  can_cu: ["urn", "nguyen_van"],
  so_do_trinh_tu: ["buoc"],
  dong_thoi_gian: ["moc"],
  doi_chieu: ["truoc", "sau"],
  bang_tra: ["cot", "dong"],
  cong_thuc: ["latex", "bien"],
  diem_nong: ["anh", "diem"],
  the_lat: ["the"],
  hoi_nhanh: ["cau_hoi", "phuong_an"],
  bieu_mau: ["ma_mau", "truong"],
  may_tinh: ["cong_cu"],
  cay_quyet_dinh: ["goc", "nut"],
  ban_do_khai_niem: ["nut"],
  ho_so: ["tai_lieu"],
  kich_ban: ["luot"],
  video: ["nguon"],
  canh_bao: ["md", "loai"],
  tom_tat: ["y"],
};

/** Tên trường như người soạn thấy trên biểu mẫu, để lời báo không lộ tên khóa dữ liệu. */
const TEN_TRUONG: Record<string, string> = {
  md: "nội dung",
  urn: "mã văn bản (URN)",
  nguyen_van: "nguyên văn",
  buoc: "các bước",
  moc: "các mốc thời gian",
  truoc: "nội dung trước",
  sau: "nội dung sau",
  cot: "cột",
  dong: "dòng",
  latex: "công thức",
  bien: "biến",
  anh: "ảnh",
  diem: "điểm trên ảnh",
  the: "thẻ",
  cau_hoi: "câu hỏi",
  phuong_an: "phương án",
  ma_mau: "mã mẫu",
  truong: "các trường của mẫu",
  cong_cu: "công cụ",
  goc: "nút gốc",
  nut: "các nút",
  tai_lieu: "tài liệu",
  luot: "lượt thoại",
  nguon: "nguồn video",
  loai: "loại lưu ý",
  y: "các ý",
};

function thieuTruong(khoi: Pick<KhoiNoiDung, "kind" | "data">): string[] {
  const can = TRUONG_BAT_BUOC[khoi.kind] ?? [];
  return can.filter((t) => {
    const v = (khoi.data as Record<string, unknown>)[t];
    if (v === undefined || v === null || v === "") return true;
    if (Array.isArray(v) && v.length === 0) return true;
    return false;
  });
}

/** Kiểm tra một khối đơn lẻ. */
export function kiemTraKhoi(khoi: KhoiNoiDung): LoiKiemTra[] {
  const loi: LoiKiemTra[] = [];
  const mo = KHOI_THEO_KIND.get(khoi.kind);
  const viTri = { blockId: khoi.id, ordinal: khoi.ordinal };

  if (!mo) {
    loi.push({ muc: "loi", ma: "kieu_khoi_la", thong_diep: `Không có kiểu khối "${khoi.kind}"`, ...viTri });
    return loi;
  }

  for (const t of thieuTruong(khoi)) {
    loi.push({
      muc: "loi",
      ma: "thieu_truong",
      thong_diep: `Khối ${mo.ten} thiếu ${TEN_TRUONG[t] ?? `trường "${t}"`}`,
      ...viTri,
    });
  }

  if (mo.can_can_cu && khoi.citations.length === 0) {
    loi.push({
      muc: "loi",
      ma: "thieu_can_cu",
      thong_diep: `Khối ${mo.ten} phải có ít nhất một viện dẫn`,
      ...viTri,
    });
  }

  if (khoi.citationHealth === "broken") {
    loi.push({ muc: "loi", ma: "can_cu_hong", thong_diep: `Khối ${mo.ten} có viện dẫn hỏng`, ...viTri });
  } else if (khoi.citationHealth === "warning") {
    loi.push({
      muc: "canh_bao",
      ma: "can_cu_thay_doi",
      thong_diep: `Khối ${mo.ten} có viện dẫn đã thay đổi, cần đối chiếu lại`,
      ...viTri,
    });
  }

  if (khoi.kind === "giang" && demTu(String(khoi.data.md ?? "")) > 320) {
    loi.push({
      muc: "canh_bao",
      ma: "khoi_giang_dai",
      thong_diep: "Đoạn giảng dài hơn 320 từ; nên tách thành hai khối",
      ...viTri,
    });
  }

  return loi;
}

export interface KetQuaKiemTraBai {
  dat: boolean;
  loi: LoiKiemTra[];
  phut: number;
  soKhoiTuongTac: number;
}

/**
 * Kiểm tra cả bài học trước khi xuất bản (09-a §2, "Quy tắc dựng bài").
 * `dat` chỉ true khi không còn lỗi mức `loi`.
 */
export function kiemTraBaiHoc(khoi: KhoiNoiDung[]): KetQuaKiemTraBai {
  const loi: LoiKiemTra[] = khoi.flatMap(kiemTraKhoi);
  const theoThuTu = [...khoi].sort((a, b) => a.ordinal - b.ordinal);

  if (theoThuTu.length === 0) {
    loi.push({ muc: "loi", ma: "bai_rong", thong_diep: "Bài học chưa có khối nội dung nào" });
  }

  if (!theoThuTu.some((k) => k.kind === "can_cu")) {
    loi.push({
      muc: "loi",
      ma: "khong_co_can_cu",
      thong_diep: "Bài học phải có ít nhất một thẻ căn cứ — không có căn cứ thì không dạy",
    });
  }

  if (theoThuTu.length && !theoThuTu.some((k) => k.kind === "tom_tat")) {
    loi.push({ muc: "canh_bao", ma: "khong_co_tom_tat", thong_diep: "Bài học nên kết bằng khối chốt lại" });
  }

  // Nhịp bài: khoảng cách giữa hai khối tương tác không quá 6 phút đọc.
  let donDoc = 0;
  for (const k of theoThuTu) {
    const mo = KHOI_THEO_KIND.get(k.kind);
    if (mo?.tuong_tac) {
      donDoc = 0;
      continue;
    }
    donDoc += phutCuaKhoi(k);
    if (donDoc > 6) {
      loi.push({
        muc: "canh_bao",
        ma: "nhip_qua_dai",
        thong_diep: `Đã ${donDoc.toFixed(1)} phút không có khối tương tác nào — chèn thêm hỏi nhanh`,
        blockId: k.id,
        ordinal: k.ordinal,
      });
      donDoc = 0;
    }
  }

  // Hai khối giảng liên tiếp quá 500 từ.
  for (let i = 1; i < theoThuTu.length; i++) {
    const a = theoThuTu[i - 1]!;
    const b = theoThuTu[i]!;
    if (a.kind !== "giang" || b.kind !== "giang") continue;
    const tong = demTu(String(a.data.md ?? "")) + demTu(String(b.data.md ?? ""));
    if (tong > 500) {
      loi.push({
        muc: "canh_bao",
        ma: "hai_khoi_giang_lien_tiep",
        thong_diep: `Hai đoạn giảng liên tiếp dài ${tong} từ — chèn khối trực quan vào giữa`,
        blockId: b.id,
        ordinal: b.ordinal,
      });
    }
  }

  const soThuTu = theoThuTu.map((k) => k.ordinal);
  if (new Set(soThuTu).size !== soThuTu.length) {
    loi.push({ muc: "loi", ma: "trung_thu_tu", thong_diep: "Có khối trùng số thứ tự" });
  }

  return {
    dat: !loi.some((l) => l.muc === "loi"),
    loi,
    phut: phutCuaBai(theoThuTu),
    soKhoiTuongTac: theoThuTu.filter((k) => KHOI_THEO_KIND.get(k.kind)?.tuong_tac).length,
  };
}

/**
 * Lọc khối theo chế độ học (09-a §6.5).
 *
 * Khối khai `modes` rỗng thì hiện ở mọi chế độ. Ngoài ra mỗi chế độ có luật riêng: chế độ
 * `nhanh` bỏ phần giảng nền nhưng GIỮ nguyên thẻ căn cứ và cảnh báo — rút gọn thời gian
 * không được phép rút gọn căn cứ.
 */
export function locTheoCheDo<T extends Pick<KhoiNoiDung, "kind" | "modes">>(khoi: T[], cheDo: CheDoHoc): T[] {
  const luat: Record<CheDoHoc, (k: T) => boolean> = {
    day_du: () => true,
    // Bỏ phần dẫn dắt và giảng nền; giữ nguyên khối trực quan và bài tập.
    nhanh: (k) => !(["giang", "kich_ban", "video"] as LoaiKhoi[]).includes(k.kind),
    tra_cuu: (k) =>
      [
        "so_do_trinh_tu",
        "bang_tra",
        "bieu_mau",
        "may_tinh",
        "cay_quyet_dinh",
        "can_cu",
        "canh_bao",
        "ho_so",
      ].includes(k.kind),
    on_thi: (k) => ["the_lat", "hoi_nhanh", "tom_tat", "can_cu", "canh_bao"].includes(k.kind),
  };
  const giuLuon: LoaiKhoi[] = ["can_cu", "canh_bao"];
  return khoi.filter((k) => {
    if (k.modes.length && !k.modes.includes(cheDo)) return false;
    if (giuLuon.includes(k.kind)) return true;
    return luat[cheDo](k);
  });
}

export { THU_VIEN_KHOI };

/* ------------------------------------------------------------------ */
/* Bài giảng đơn giản (docs/PLAN.md GĐ11)                              */
/* ------------------------------------------------------------------ */

/**
 * Loại khối mà trang bài giảng mới dựng đầy đủ. Đây là các loại cần cho nội dung giao thông
 * đang có; loại khác hiện dạng văn bản thô, kèm cảnh báo trong nhật ký.
 */
export const KHOI_BAI_GIANG: readonly LoaiKhoi[] = [
  "giang",
  "can_cu",
  "tom_tat",
  "canh_bao",
  "bang_tra",
  "so_do_trinh_tu",
  "the_lat",
  "hoi_nhanh",
  "kich_ban",
  "dong_thoi_gian",
];

/** Số câu kiểm tra nhanh cuối bài, rút từ ngân hàng theo chủ đề của bài. */
export const SO_CAU_KIEM_TRA_CUOI_BAI = { toiThieu: 3, toiDa: 5 } as const;

/** Tỷ lệ câu đúng (%) để một lượt kiểm tra cuối bài được tính là đạt. */
export const NGUONG_DAT_KIEM_TRA_CUOI_BAI = 70;
