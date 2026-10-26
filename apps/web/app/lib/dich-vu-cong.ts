/** Danh mục chọn lọc, đối chiếu liên kết trên cổng Bộ Công an ngày 26/10/2026. */
export const CONG_DICH_VU = "https://dichvucong.bocongan.gov.vn";
export interface DichVuCong {
  ma: string;
  ten: string;
  linhVuc: string;
  url: string;
  phoBien: boolean;
}
const thuTuc = (ma: string, ten: string, linhVuc: string, phoBien = false): DichVuCong => ({
  ma,
  ten,
  linhVuc,
  phoBien,
  url: `${CONG_DICH_VU}/bocongan/bothutuc/tthc?matt=${ma}`,
});
export const DICH_VU_CONG: DichVuCong[] = [
  thuTuc(
    "56952",
    "Đăng ký xe lần đầu trực tuyến toàn trình đối với xe sản xuất lắp ráp trong nước",
    "Đăng ký, quản lý phương tiện giao thông",
    true,
  ),
  thuTuc("26345", "Gia hạn tạm trú", "Quản lý cư trú", true),
  thuTuc("26094", "Cấp đổi thẻ căn cước (thực hiện tại cấp tỉnh)", "Căn cước", true),
  thuTuc(
    "29497",
    "Cấp hộ chiếu phổ thông ở trong nước (thực hiện tại cấp tỉnh)",
    "Quản lý xuất nhập cảnh",
    true,
  ),
  thuTuc(
    "58712",
    "Đăng ký xe lần đầu trực tuyến toàn trình đối với xe nhập khẩu",
    "Đăng ký, quản lý phương tiện giao thông",
  ),
  thuTuc(
    "62012",
    "Thu hồi giấy chứng nhận đăng ký, biển số xe thực hiện bằng dịch vụ công trực tuyến một phần hoặc trực tiếp tại cơ quan đăng ký xe thực hiện tại cấp trung ương, cấp tỉnh, cấp xã",
    "Đăng ký, quản lý phương tiện giao thông",
  ),
  thuTuc("26093", "Cấp lại thẻ căn cước (thực hiện tại cấp tỉnh)", "Căn cước"),
  thuTuc("26096", "Cấp lại thẻ căn cước (thực hiện tại cấp trung ương)", "Căn cước"),
  thuTuc(
    "26270",
    "Cấp hộ chiếu phổ thông ở trong nước (thực hiện tại cấp trung ương)",
    "Quản lý xuất nhập cảnh",
  ),
  thuTuc(
    "40857",
    "Cấp mới Giấy chứng nhận đủ điều kiện về an ninh, trật tự (thực hiện tại cấp tỉnh)",
    "Quản lý ngành, nghề kinh doanh có điều kiện",
  ),
  thuTuc("40853", "Đăng ký lại mẫu con dấu (thực hiện tại cấp tỉnh)", "Đăng ký, quản lý con dấu"),
  thuTuc("40854", "Đăng ký thêm con dấu (thực hiện tại cấp tỉnh)", "Đăng ký, quản lý con dấu"),
];
export function timDichVuCong(q: string): DichVuCong[] {
  const chuanHoa = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase();
  const tu = chuanHoa(q).trim().split(/\s+/).filter(Boolean);
  return DICH_VU_CONG.filter((d) => tu.every((t) => chuanHoa(`${d.ten} ${d.linhVuc}`).includes(t)));
}
