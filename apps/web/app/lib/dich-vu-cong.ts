export const CONG_DICH_VU = "https://dichvucong.gov.vn/";
export const NHOM_DICH_VU = ["Công chức", "Viên chức", "Đảng viên"] as const;
export type NhomDichVu = (typeof NHOM_DICH_VU)[number];
export interface DichVuCong {
  ma: string;
  ten: string;
  linhVuc: string;
  // Chỉ có khi chưa có trang thủ tục riêng: url là trang chủ cổng, người dùng tự tìm theo từ khóa.
  tuKhoa?: string;
  nhom: readonly NhomDichVu[];
  phoBien: boolean;
  url: string;
}
// shortcut: cổng mới báo "Trang không tồn tại" với link thủ tục cũ nên dùng bản vpcp, chuyển lại khi cổng mới có link thủ tục ổn định.
const CONG_TRA_CUU_THU_TUC = "https://vpcp.dichvucong.gov.vn/";
const trangThuTuc = (trang: string, ma: string) =>
  `${CONG_TRA_CUU_THU_TUC}p/home/${trang}.html?ma_thu_tuc=${ma}`;
const muc = (
  ma: string,
  ten: string,
  linhVuc: string,
  url: string,
  nhom: readonly NhomDichVu[],
  phoBien = false,
): DichVuCong => ({ ma, ten, linhVuc, nhom, phoBien, url });
const BHXH_BHYT = trangThuTuc("dvc-chi-tiet-thu-tuc-hanh-chinh", "1.002759");
export const DICH_VU_CONG: DichVuCong[] = [
  muc(
    "cong-chuc",
    "Tuyển dụng công chức: xét tuyển",
    "Công vụ",
    trangThuTuc("dvc-chi-tiet-thu-tuc-dung-chung", "1.014113"),
    ["Công chức"],
    true,
  ),
  muc(
    "vien-chuc",
    "Tuyển dụng viên chức: thi tuyển",
    "Viên chức",
    trangThuTuc("dvc-chi-tiet-thu-tuc-hanh-chinh", "1.012299"),
    ["Viên chức"],
    true,
  ),
  {
    ...muc("dang", "Dịch vụ công trực tuyến của Đảng", "Công tác Đảng", CONG_DICH_VU, ["Đảng viên"], true),
    tuKhoa: "Dịch vụ công trực tuyến của Đảng",
  },
  muc(
    "chung-thuc-ban-sao",
    "Chứng thực bản sao từ bản chính",
    "Chứng thực",
    trangThuTuc("dvc-cap-ban-sao-tu-ban-chinh", "2.000843"),
    NHOM_DICH_VU,
    true,
  ),
  muc(
    "chung-thuc-chu-ky",
    "Chứng thực chữ ký",
    "Chứng thực",
    trangThuTuc("dvc-chi-tiet-thu-tuc-hanh-chinh", "2.000884"),
    NHOM_DICH_VU,
    true,
  ),
  muc("bhxh", "Cấp lại, đổi sổ bảo hiểm xã hội", "Bảo hiểm xã hội", BHXH_BHYT, NHOM_DICH_VU),
  muc("bhyt", "Cấp lại, đổi thẻ bảo hiểm y tế", "Bảo hiểm y tế", BHXH_BHYT, NHOM_DICH_VU),
  muc(
    "huu-tri",
    "Hưởng chế độ hưu trí (BHXH tự nguyện, bảo lưu thời gian đóng)",
    "Bảo hiểm xã hội",
    trangThuTuc("dvc-chi-tiet-thu-tuc-hanh-chinh", "1.000846"),
    NHOM_DICH_VU,
  ),
  muc(
    "ly-lich",
    "Cấp phiếu lý lịch tư pháp",
    "Lý lịch tư pháp",
    trangThuTuc("dvc-chi-tiet-thu-tuc-nganh-doc", "3.000333"),
    NHOM_DICH_VU,
  ),
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
