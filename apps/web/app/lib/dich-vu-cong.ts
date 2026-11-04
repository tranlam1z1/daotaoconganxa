export const CONG_DICH_VU = "https://dichvucong.gov.vn/";
export const NHOM_DICH_VU = ["Công chức", "Viên chức", "Đảng viên"] as const;
export type NhomDichVu = (typeof NHOM_DICH_VU)[number];
export interface DichVuCong {
  ma: string;
  ten: string;
  linhVuc: string;
  tuKhoa: string;
  nhom: readonly NhomDichVu[];
  phoBien: boolean;
  url: string;
}
// Chủ đề tra cứu, không phải mã thủ tục. Người dùng chọn cơ quan và thủ tục trên cổng quốc gia.
const muc = (
  ma: string,
  ten: string,
  linhVuc: string,
  tuKhoa: string,
  nhom: readonly NhomDichVu[],
  phoBien = false,
): DichVuCong => ({ ma, ten, linhVuc, tuKhoa, nhom, phoBien, url: CONG_DICH_VU });
export const DICH_VU_CONG: DichVuCong[] = [
  muc("cong-chuc", "Tuyển dụng công chức", "Công vụ", "tuyển dụng công chức", ["Công chức"], true),
  muc("vien-chuc", "Tuyển dụng viên chức", "Viên chức", "tuyển dụng viên chức", ["Viên chức"], true),
  muc(
    "dang",
    "Dịch vụ công trực tuyến của Đảng",
    "Công tác Đảng",
    "Dịch vụ công trực tuyến của Đảng",
    ["Đảng viên"],
    true,
  ),
  muc("chung-thuc", "Chứng thực bản sao, chữ ký", "Chứng thực", "chứng thực", NHOM_DICH_VU, true),
  muc(
    "bhxh",
    "Cấp lại, đổi sổ bảo hiểm xã hội",
    "Bảo hiểm xã hội",
    "cấp lại đổi sổ bảo hiểm xã hội",
    NHOM_DICH_VU,
  ),
  muc(
    "bhyt",
    "Cấp lại, đổi thẻ bảo hiểm y tế",
    "Bảo hiểm y tế",
    "cấp lại đổi thẻ bảo hiểm y tế",
    NHOM_DICH_VU,
  ),
  muc("huu-tri", "Giải quyết hưởng chế độ hưu trí", "Bảo hiểm xã hội", "hưởng chế độ hưu trí", NHOM_DICH_VU),
  muc("ly-lich", "Cấp phiếu lý lịch tư pháp", "Lý lịch tư pháp", "cấp phiếu lý lịch tư pháp", NHOM_DICH_VU),
];
export function timDichVuCong(q: string, nhom?: NhomDichVu): DichVuCong[] {
  const chuanHoa = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase();
  const tu = chuanHoa(q).trim().split(/\s+/).filter(Boolean);
  return DICH_VU_CONG.filter(
    (d) =>
      (!nhom || d.nhom.includes(nhom)) &&
      tu.every((t) => chuanHoa(`${d.ten} ${d.linhVuc} ${d.nhom.join(" ")}`).includes(t)),
  );
}
