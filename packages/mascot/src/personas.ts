/**
 * Bộ bảy nhân vật đồng hành (ke-hoach/09-b §2).
 *
 * Đây là dữ liệu GIEO SẴN, không phải danh sách đóng: `mascot_personas` cho phép quản trị
 * viên thêm nhân vật mới cho đối tượng và chuyên đề khác. Tệp này là bản gốc để gieo và là
 * bản dự phòng khi CSDL chưa có nhân vật nào.
 *
 * Tên đều thuần Việt và đều là một từ có nghĩa: "mực thước" là khuôn phép, "cân nhắc" là sự
 * xét đoán, "đắn đo" là sự cẩn trọng. Đọc tên là biết nhân vật làm gì.
 */

import type { NhanVat, TrangPhuc } from "./types.ts";

/**
 * Xưng hô của mọi nhân vật thống nhất theo QUY-TAC-HANH-VAN.md §4: tự xưng "tôi", gọi người
 * học là "bạn" (hoặc "anh/chị" trong ngữ cảnh đánh giá, thẩm định). Không dùng biệt danh
 * kiểu "bé", "bác", "cô" trước tên nhân vật.
 */

/** Danh mục đối tượng người học, dùng chung cho chuyên đề và cho nhân vật. */
export const DOI_TUONG = {
  can_bo_chuyen_mon: "Cán bộ chuyên môn",
  can_bo_moi: "Cán bộ mới vào nghề",
  lanh_dao: "Lãnh đạo, quản lý dự án",
  ke_toan: "Kế toán, tài chính",
  thanh_tra: "Thanh tra, kiểm toán",
  tra_cuu: "Cán bộ tra cứu, lưu trữ",
  nguoi_dan: "Người dân, doanh nghiệp",
} as const;
export type MaDoiTuong = keyof typeof DOI_TUONG;

const CHUNG: TrangPhuc[] = ["thuong_ngay", "cong_so", "tot_nghiep", "tet"];

/**
 * `id` để rỗng: id thật do CSDL sinh khi gieo. Mã `code` mới là khoá ổn định mà mọi nơi
 * khác tham chiếu tới.
 */
export const NHAN_VAT_GOC: ReadonlyArray<Omit<NhanVat, "id">> = [
  {
    code: "muc_thuoc",
    fullName: "Mực Thước",
    nickName: "Mực Thước",
    roleLine: "Cố vấn trưởng — đi cùng bạn suốt chuyên đề",
    bio: "Thân là cây thước gỗ có vạch chia chạy dọc sườn. Không kết luận điều gì trước khi mở văn bản ra đối chiếu.",
    audiences: ["can_bo_chuyen_mon"],
    topics: ["dau_tu_cong", "cntt", "phap_che", "dau_thau", "chung"],
    voice: {
      tu_xung: "tôi",
      goi_nguoi_hoc: "bạn",
      do_dai_cau_toi_da: 140,
      muc_trang_trong: "trung_tinh",
      tu_nen_dung: ["căn cứ", "tại thời điểm", "theo điều"],
      tu_cam: ["chắc là", "khoảng", "hình như"],
    },
    palette: {
      chinh: "#1d3a97",
      phu: "#e8ecf7",
      nhan: "#e0a13a",
      da: "#f6d9b8",
      vien: "#14203f",
      mat: "#14181f",
    },
    body: "thuoc",
    headGear: "khan_xep",
    defaultProp: "thuoc_vang",
    allowedCostumes: [...CHUNG, "ao_dai_khan_dong", "bao_ho_cong_truong", "hoi_dong_tham_dinh"],
    characterSheet:
      "nhân vật hoạt hình vector phẳng, thân là cây thước gỗ đứng màu xanh mực với vạch chia " +
      "màu vàng dọc sườn phải, đầu tròn to bằng hai phần ba thân, khăn xếp xanh mực trên đầu, " +
      "hai chấm mắt tròn đen, không có mũi, tay chân dạng ống bo tròn, nét viền dày đều, " +
      "không dùng chuyển sắc, không đổ bóng mềm",
    enabled: true,
    isDefault: true,
    ordinal: 1,
  },
  {
    code: "hoi_han",
    fullName: "Hỏi Han",
    nickName: "Hỏi Han",
    roleLine: "Người đặt câu hỏi — nêu thay người học những câu hỏi cơ bản",
    bio: "Một giọt mực tròn với chỏm tóc xoáy hình dấu hỏi. Không tự trả lời câu hỏi pháp lý; nhiệm vụ là hỏi tiếp cho tới khi câu trả lời có căn cứ.",
    audiences: ["can_bo_moi"],
    topics: ["nhap_mon", "co_ban", "thuat_ngu", "chung"],
    voice: {
      tu_xung: "tôi",
      goi_nguoi_hoc: "bạn",
      do_dai_cau_toi_da: 110,
      muc_trang_trong: "trung_tinh",
      tu_nen_dung: ["thế còn", "tại sao", "cụ thể là"],
      tu_cam: ["theo quy định thì", "chắc chắn là", "kết luận là"],
    },
    palette: {
      chinh: "#2f6f5e",
      phu: "#e6f2ee",
      nhan: "#f2a33c",
      da: "#f6d9b8",
      vien: "#1c453a",
      mat: "#14181f",
    },
    body: "giot_muc",
    headGear: "toc_xoay",
    defaultProp: "so_can_cu",
    allowedCostumes: [...CHUNG, "tinh_nguyen"],
    characterSheet:
      "nhân vật hoạt hình vector phẳng hình giọt mực tròn màu xanh lá trầm, chỏm tóc xoáy " +
      "cong hình dấu hỏi màu cam, mắt tròn to chiếm một phần ba khuôn mặt, má hồng nhạt, " +
      "tay chân ngắn bo tròn, nét viền dày đều, không dùng chuyển sắc",
    enabled: true,
    isDefault: false,
    ordinal: 2,
  },
  {
    code: "rua_da",
    fullName: "Rùa Đá",
    nickName: "Rùa Đá",
    roleLine: "Người giữ sổ — theo dõi mốc hiệu lực của từng văn bản",
    bio: "Rùa đội một tấm bia đá kiểu bia tiến sĩ; mặt bia là nơi hiện dòng thời gian hiệu lực. Không nêu một quy định mà thiếu ngày hiệu lực đi kèm.",
    audiences: ["tra_cuu", "can_bo_chuyen_mon"],
    topics: ["hieu_luc", "hop_nhat", "tra_cuu", "lich_su_van_ban"],
    voice: {
      tu_xung: "tôi",
      goi_nguoi_hoc: "bạn",
      do_dai_cau_toi_da: 140,
      muc_trang_trong: "trung_tinh",
      tu_nen_dung: ["từ ngày", "hết hiệu lực", "bản hợp nhất"],
      tu_cam: ["nhanh lên", "đại khái", "cứ thế mà làm"],
    },
    palette: {
      chinh: "#5c5346",
      phu: "#efeae0",
      nhan: "#8fa37a",
      da: "#d8cbb4",
      vien: "#332d25",
      mat: "#14181f",
    },
    body: "rua",
    headGear: "bia_da",
    defaultProp: "bia_da",
    allowedCostumes: ["thuong_ngay", "ao_dai_khan_dong", "tet", "tot_nghiep"],
    characterSheet:
      "nhân vật hoạt hình vector phẳng hình rùa già màu nâu đá, mai rùa hình lục giác đều, " +
      "trên lưng cõng một tấm bia đá chữ nhật bo góc màu be nhạt để trống chữ, cổ dài vươn " +
      "ra trước, mắt híp hiền, nét viền dày đều, không dùng chuyển sắc",
    enabled: true,
    isDefault: false,
    ordinal: 3,
  },
  {
    code: "can_nhac",
    fullName: "Cân Nhắc",
    nickName: "Cân Nhắc",
    roleLine: "Người chủ trì đánh giá — nêu tiêu chí và kết quả đối chiếu",
    bio: "Hai bàn tay là hai đĩa cân. Không khen, không chê; chỉ nêu tiêu chí và kết quả đối chiếu với tiêu chí đó.",
    audiences: ["thanh_tra", "can_bo_chuyen_mon"],
    topics: ["danh_gia", "thanh_tra", "kiem_toan", "tuan_thu"],
    voice: {
      tu_xung: "tôi",
      goi_nguoi_hoc: "anh/chị",
      do_dai_cau_toi_da: 140,
      muc_trang_trong: "trang_trong",
      tu_nen_dung: ["tiêu chí", "đối chiếu", "ngưỡng đạt"],
      tu_cam: ["giỏi quá", "tiếc quá", "cố lên nào"],
    },
    palette: {
      chinh: "#4a4f63",
      phu: "#eceef4",
      nhan: "#b08b57",
      da: "#f6d9b8",
      vien: "#2b2f3c",
      mat: "#14181f",
    },
    body: "nguoi_can",
    headGear: "khong",
    defaultProp: "can_dia",
    allowedCostumes: ["cong_so", "hoi_dong_tham_dinh", "kiem_toan", "ao_dai_nu", "tot_nghiep"],
    characterSheet:
      "nhân vật hoạt hình vector phẳng dáng người trung tính màu xám xanh, hai cánh tay kết " +
      "thúc bằng hai đĩa cân tròn màu đồng treo cân bằng, thân áo vest tối màu, mắt thẳng " +
      "nghiêm, nét viền dày đều, không dùng chuyển sắc",
    enabled: true,
    isDefault: false,
    ordinal: 4,
  },
  {
    code: "seu_dau_do",
    fullName: "Sếu Đầu Đỏ",
    nickName: "Sếu Đầu Đỏ",
    roleLine: "Người vạch lộ trình — trình bày theo mốc và bước",
    bio: "Sếu đầu đỏ Tràm Chim, cổ vươn cao để quan sát cả chặng. Trình bày bằng mốc thời gian và bước thực hiện, không đi vào chi tiết kỹ thuật.",
    audiences: ["lanh_dao"],
    topics: ["chu_truong_dau_tu", "lo_trinh", "ke_hoach", "quan_ly_du_an"],
    voice: {
      tu_xung: "tôi",
      goi_nguoi_hoc: "anh/chị",
      do_dai_cau_toi_da: 120,
      muc_trang_trong: "trang_trong",
      tu_nen_dung: ["bước tiếp theo", "mốc", "thẩm quyền"],
      tu_cam: ["chi tiết kỹ thuật", "cấu hình", "mã nguồn"],
    },
    palette: {
      chinh: "#e4e7ec",
      phu: "#ffffff",
      nhan: "#c0392b",
      da: "#f0f2f5",
      vien: "#3c4250",
      mat: "#14181f",
    },
    body: "seu",
    headGear: "mao_do",
    defaultProp: "ban_do_lo_trinh",
    allowedCostumes: ["thuong_ngay", "cong_so", "hoi_dong_tham_dinh", "tot_nghiep", "tet"],
    characterSheet:
      "nhân vật hoạt hình vector phẳng hình chim sếu đầu đỏ, thân trắng ngà, đỉnh đầu và " +
      "gáy màu đỏ son, cổ dài mảnh vươn cao, mỏ dài thẳng màu xám, chân cao mảnh, cánh mở " +
      "nhẹ như đang mở một tấm bản đồ, nét viền dày đều, không dùng chuyển sắc",
    enabled: true,
    isDefault: false,
    ordinal: 5,
  },
  {
    code: "dan_do",
    fullName: "Đắn Đo",
    nickName: "Đắn Đo",
    roleLine: "Người kiểm số liệu — soát đơn vị tính và căn cứ định mức",
    bio: "Thân là cuộn thước dây, tay cầm máy tính bỏ túi. Trước khi chốt một con số luôn soát hai việc: đơn vị tính và căn cứ của định mức.",
    audiences: ["ke_toan", "can_bo_chuyen_mon"],
    topics: ["chi_phi", "du_toan", "dinh_muc", "tong_muc_dau_tu"],
    voice: {
      tu_xung: "tôi",
      goi_nguoi_hoc: "anh/chị",
      do_dai_cau_toi_da: 130,
      muc_trang_trong: "trung_tinh",
      tu_nen_dung: ["đơn vị", "định mức", "làm tròn"],
      tu_cam: ["tạm tính", "cứ lấy tròn", "gần đúng là được"],
    },
    palette: {
      chinh: "#7a4a8c",
      phu: "#f2eaf6",
      nhan: "#e0a13a",
      da: "#f6d9b8",
      vien: "#432a4d",
      mat: "#14181f",
    },
    body: "thuoc_day",
    headGear: "khong",
    defaultProp: "may_tinh_cam_tay",
    allowedCostumes: ["thuong_ngay", "cong_so", "ao_dai_nu", "kiem_toan", "tot_nghiep", "tet"],
    characterSheet:
      "nhân vật hoạt hình vector phẳng, thân là cuộn thước dây tròn màu tím với dải thước " +
      "vàng có vạch chia thò ra một đoạn cuộn lại, đầu tròn, tay phải cầm máy tính bỏ túi " +
      "nhỏ, mắt tròn chăm chú, nét viền dày đều, không dùng chuyển sắc",
    enabled: true,
    isDefault: false,
    ordinal: 6,
  },
  {
    code: "sang_to",
    fullName: "Sáng Tỏ",
    nickName: "Sáng Tỏ",
    roleLine: "Người diễn giải thuật ngữ — chuyển từ Hán Việt sang tiếng thường",
    bio: "Một chiếc đèn dầu kiểu cũ, ngọn lửa thay cho chỏm tóc. Mỗi từ Hán Việt đều được diễn giải sang tiếng thường trước khi trình bày tiếp.",
    audiences: ["nguoi_dan"],
    topics: ["thu_tuc_hanh_chinh", "huong_dan_cong_dan", "doanh_nghiep"],
    voice: {
      tu_xung: "tôi",
      goi_nguoi_hoc: "bạn",
      do_dai_cau_toi_da: 110,
      muc_trang_trong: "trung_tinh",
      tu_nen_dung: ["nói ngắn gọn", "ví dụ", "hồ sơ cần mang theo"],
      tu_cam: ["chủ thể", "khách thể", "quy phạm"],
    },
    palette: {
      chinh: "#c9772b",
      phu: "#fdf1e3",
      nhan: "#f5c542",
      da: "#f6d9b8",
      vien: "#7a4415",
      mat: "#14181f",
    },
    body: "den_dau",
    headGear: "ngon_lua",
    defaultProp: "den_pin",
    allowedCostumes: ["thuong_ngay", "cong_so", "tinh_nguyen", "tet", "tot_nghiep"],
    characterSheet:
      "nhân vật hoạt hình vector phẳng hình chiếc đèn dầu cũ màu cam đất, bầu đèn tròn làm " +
      "thân, ống khói thuỷ tinh trong suốt làm cổ, ngọn lửa vàng nhỏ trên đỉnh thay cho tóc, " +
      "mắt tròn thân thiện trên bầu đèn, tay chân ngắn bo tròn, nét viền dày đều",
    enabled: true,
    isDefault: false,
    ordinal: 7,
  },
];

export const NHAN_VAT_THEO_CODE = new Map(NHAN_VAT_GOC.map((n) => [n.code, n]));

/** Ngữ cảnh chiếm quyền tạm thời (09-b §3, mức ưu tiên 2). */
export const BAN_GIAO_GOC: ReadonlyArray<{ context: string; personaCode: string; note: string }> = [
  {
    context: "bai_danh_gia",
    personaCode: "can_nhac",
    note: "Vào bài đánh giá mức 2–3, Cân Nhắc chủ trì; xong bài thì trả lại nhân vật trước đó.",
  },
  {
    context: "may_tinh_chi_phi",
    personaCode: "dan_do",
    note: "Khối máy tính chi phí: Đắn Đo xuất hiện ở lề để soát đơn vị tính và căn cứ định mức.",
  },
  {
    context: "tra_cuu_hieu_luc",
    personaCode: "rua_da",
    note: "Khối dòng thời gian hiệu lực và bảng đối chiếu trước/sau.",
  },
  {
    context: "thu_tuc_cong_dan",
    personaCode: "sang_to",
    note: "Nội dung hướng dẫn người dân, doanh nghiệp.",
  },
];
