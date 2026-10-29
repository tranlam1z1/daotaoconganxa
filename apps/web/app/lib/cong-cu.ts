import type { IconName } from "../components/ui/Icon";

/**
 * Bộ công cụ nghiệp vụ ở trang chủ. Mỗi công cụ có trang riêng `/cong-cu/:ma` (routes/cong-cu.tsx);
 * công cụ chưa dựng thì trang đó là khung tạm liệt kê chức năng sẽ có (`chucNang`).
 */
export const CONG_CU: ReadonlyArray<{
  ma: string;
  ten: string;
  icon: IconName;
  moTa: string;
  chucNang: string[];
}> = [
  {
    ma: "dia-gioi-hanh-chinh",
    ten: "Chuyển đổi địa giới hành chính",
    icon: "banDo",
    moTa: "Đối chiếu tên đơn vị hành chính trước và sau sắp xếp.",
    chucNang: [
      "Nhập tên xã, tỉnh cũ để biết đơn vị hành chính hiện nay.",
      "Tra ngược từ đơn vị hiện nay ra các đơn vị cũ đã nhập vào.",
    ],
  },
  {
    ma: "tinh-ngay-xu-ly",
    ten: "Tính ngày xử lý vi phạm",
    icon: "calendar",
    moTa: "Tính ngày hẹn người vi phạm lên làm việc từ ngày lập biên bản.",
    chucNang: [
      "Nhập ngày lập biên bản để biết ngày hẹn lên làm việc.",
      "Xem lịch đánh dấu ngày lập biên bản, ngày hẹn và các ngày nghỉ lễ, tết đã bỏ qua.",
    ],
  },
  {
    ma: "xac-dinh-tuoi",
    ten: "Xác định tuổi vi phạm",
    icon: "idCard",
    moTa: "Tính tuổi của người vi phạm đến hôm nay.",
    chucNang: [
      "Nhập ngày sinh (hoặc chỉ tháng, năm) để biết tuổi chính xác đến từng ngày.",
      "Cho biết nhóm tuổi khi xử phạt vi phạm hành chính, chịu trách nhiệm hình sự và điều khiển phương tiện, kèm căn cứ.",
    ],
  },
  {
    ma: "tinh-qua-tai",
    ten: "Tính % quá tải",
    icon: "trongTai",
    moTa: "Tính khối lượng và phần trăm quá tải của xe tải, đầu kéo, sơ mi rơ moóc.",
    chucNang: [
      "Chọn loại xe: xe tải, đầu kéo hoặc sơ mi rơ moóc.",
      "Nhập khối lượng cân được và khối lượng theo thiết kế để biết khối lượng và phần trăm quá tải.",
    ],
  },
  {
    ma: "coi-noi-thanh-thung",
    ten: "Tính cơi nới thành thùng xe",
    icon: "truck",
    moTa: "Đối chiếu kích thước thùng xe thực tế với kích thước ghi trong giấy chứng nhận.",
    chucNang: [
      "Nhập kích thước thùng xe đo được và kích thước theo giấy chứng nhận để biết phần cơi nới.",
      "Cho biết hành vi cơi nới thuộc khung xử phạt nào, kèm căn cứ.",
    ],
  },
  {
    ma: "qua-kho-hang-hoa",
    ten: "Tính quá khổ hàng hóa",
    icon: "thuocDo",
    moTa: "Tính phần hàng hóa vượt quá kích thước giới hạn xếp hàng của xe.",
    chucNang: [
      "Chọn loại thùng xe, nhập chiều cao, chiều rộng, chiều dài xếp hàng để biết phần vượt giới hạn.",
      "Cho biết mức vượt thuộc khung xử phạt nào, kèm căn cứ.",
    ],
  },
  {
    ma: "do-dac-dien-tu",
    ten: "Đo đạc điện tử xe và hiện trường",
    icon: "camera",
    moTa: "Ghi số đo kích thước xe, khoảng cách tại hiện trường lên ảnh chụp trên điện thoại.",
    chucNang: [
      "Chụp ảnh xe hoặc hiện trường rồi ghim vị trí đã đo, nhập số đo bằng thước.",
      "Tải ảnh kèm bảng số đo để đưa vào hồ sơ vụ việc.",
    ],
  },
  {
    ma: "loai-gplx",
    ten: "Xác định loại GPLX theo phương tiện",
    icon: "car",
    moTa: "Cho biết hạng giấy phép lái xe cần có để điều khiển một loại phương tiện.",
    chucNang: [
      "Chọn loại xe, số chỗ ngồi hoặc khối lượng để biết hạng GPLX phù hợp.",
      "Đối chiếu hạng GPLX người lái đang có với phương tiện đang điều khiển, kèm căn cứ.",
    ],
  },
  {
    ma: "nong-do-con",
    ten: "Tính mức xử phạt nồng độ cồn",
    icon: "alert",
    moTa: "Tra mức xử phạt theo kết quả đo nồng độ cồn và loại phương tiện.",
    chucNang: [
      "Nhập kết quả đo nồng độ cồn và chọn loại xe để biết mức phạt tiền.",
      "Cho biết hình thức xử phạt bổ sung và biện pháp khắc phục hậu quả, kèm căn cứ.",
    ],
  },
];

/** Lối tắt "Nghiệp vụ nhanh" ở trang chủ, dẫn tới các trang đã có. */
export const NGHIEP_VU_NHANH: ReadonlyArray<{ to: string; ten: string; icon: IconName }> = [
  { to: "/tim-kiem", ten: "Tra cứu văn bản", icon: "book" },
  { to: "/tra-cuu-nhanh/quy-trinh", ten: "Quy trình biểu mẫu", icon: "file" },
  { to: "/hoc", ten: "Danh mục bài học", icon: "cap" },
];

/** Hai nhóm trên dạng ô lối tắt (LuoiLoiTat), dùng chung cho trang chủ và trang /cong-cu. */
export const O_CONG_CU = CONG_CU.filter((c) => c.ma === "dia-gioi-hanh-chinh").map((c) => ({
  to: `/cong-cu/${c.ma}`,
  ten: c.ten,
  icon: c.icon,
}));
