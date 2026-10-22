/**
 * Biển báo đường bộ (docs/PLAN.md GĐ12): kiểu dữ liệu, nhãn nhóm, kiểm tra hợp lệ tệp
 * data/bien-bao/bien-bao.json. Không chạm CSDL, không đọc tệp: script nạp đọc tệp rồi gọi vào đây.
 *
 * Tên và ý nghĩa từng biển là nội dung pháp lý theo QCVN 41:2024/BGTVT. Dòng bản nháp (`nhap`)
 * không hiện cho người học; biên tập viên đối chiếu với văn bản rồi mới chuyển `da_duyet`.
 */

export const NHOM_BIEN_BAO = ["cam", "nguy_hiem", "hieu_lenh", "chi_dan", "phu"] as const;
export type NhomBienBao = (typeof NHOM_BIEN_BAO)[number];

export const TEN_NHOM_BIEN_BAO: Record<NhomBienBao, string> = {
  cam: "Biển báo cấm",
  nguy_hiem: "Biển báo nguy hiểm và cảnh báo",
  hieu_lenh: "Biển hiệu lệnh",
  chi_dan: "Biển chỉ dẫn",
  phu: "Biển phụ",
};

/** Chữ cái đầu mã biển theo nhóm (P.102 là biển cấm…), để bắt lỗi xếp nhầm nhóm. */
const TIEN_TO_MA: Record<NhomBienBao, string> = {
  cam: "P",
  nguy_hiem: "W",
  hieu_lenh: "R",
  chi_dan: "I",
  phu: "S",
};

export type TrangThaiBienBao = "nhap" | "da_duyet" | "ngung";

/** Một biển trong tệp dữ liệu. */
export interface BienBao {
  ma: string;
  nhom: NhomBienBao;
  ten: string;
  y_nghia: string;
  /** Tên tệp ảnh trong data/bien-bao/anh/. */
  anh: string;
  can_cu: string;
  trang_thai: TrangThaiBienBao;
  thu_tu?: number;
  ghi_chu?: string;
}

export interface LoiBienBao {
  ma: string;
  loi: string;
}

/** Mã biển dạng "P.102", "W.207a", "I.423b": một chữ cái nhóm, dấu chấm, số, hậu tố chữ thường. */
const MA_RE = /^[PWRIS]\.\d{3}[a-z]?$/;

/** Mã có đúng dạng mã biển không (dùng khi soạn biển mới trong ứng dụng). */
export const laMaBienBao = (ma: string) => MA_RE.test(ma);
/** Chữ cái đầu của mã biển có thuộc nhóm không (P.102 là biển cấm). */
export const maBienDungNhom = (ma: string, nhom: NhomBienBao) => ma[0] === TIEN_TO_MA[nhom];

/** Ảnh tối đa 20 KB mỗi biển (bảng kiểm GĐ12: lưới tải lần đầu dưới 2 giây trên 4G). */
export const KICH_THUOC_ANH_TOI_DA = 20 * 1024;

export function kiemTraBienBao(ds: BienBao[]): LoiBienBao[] {
  const loi: LoiBienBao[] = [];
  const daGap = new Set<string>();
  for (const b of ds) {
    const ma = b.ma ?? "(không mã)";
    if (!MA_RE.test(b.ma ?? "")) loi.push({ ma, loi: `Mã biển không đúng dạng (ví dụ P.102): "${b.ma}"` });
    if (daGap.has(b.ma)) loi.push({ ma, loi: "Mã biển bị trùng" });
    daGap.add(b.ma);
    if (!NHOM_BIEN_BAO.includes(b.nhom)) loi.push({ ma, loi: `Nhóm không hợp lệ: "${b.nhom}"` });
    else if (MA_RE.test(b.ma ?? "") && b.ma[0] !== TIEN_TO_MA[b.nhom]) {
      loi.push({ ma, loi: `Mã ${b.ma} không thuộc nhóm "${TEN_NHOM_BIEN_BAO[b.nhom]}"` });
    }
    if (!b.ten?.trim()) loi.push({ ma, loi: "Chưa có tên biển" });
    if (!b.y_nghia?.trim()) loi.push({ ma, loi: "Chưa có ý nghĩa" });
    if (!/^[\w.-]+\.(svg|png|webp)$/i.test(b.anh ?? ""))
      loi.push({ ma, loi: `Tên tệp ảnh không hợp lệ: "${b.anh}"` });
    if (!/^vn:\S+$/.test(b.can_cu ?? "")) loi.push({ ma, loi: `Căn cứ không đúng dạng URN: "${b.can_cu}"` });
    if (!["nhap", "da_duyet", "ngung"].includes(b.trang_thai)) {
      loi.push({ ma, loi: `Trạng thái không hợp lệ: "${b.trang_thai}"` });
    }
  }
  return loi;
}

/** Chuỗi tìm kiếm không dấu: mã và tên, viết thường. */
export function chuoiTimBienBao(b: Pick<BienBao, "ma" | "ten">): string {
  return `${b.ma} ${b.ten}`.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
}
