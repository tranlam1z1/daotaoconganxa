/**
 * Bộ hành động gieo sẵn (ke-hoach/09-b §5, §7.1).
 *
 * Đây là bản dựng đầu cho các cảnh chính; quản trị viên sửa, thêm, tắt qua màn hình
 * `/quan-tri/mascot/hanh-dong` mà không cần đụng mã.
 *
 * Bốn luật viết lời thoại được tuân thủ trong toàn bộ tệp này (QUY-TAC-HANH-VAN.md §8):
 *  1. Không câu nào khẳng định nội dung pháp lý — nhân vật chỉ dẫn tới thẻ căn cứ.
 *  2. Khi người học sai, không tiết lộ đáp án; nêu LOẠI lỗi rồi mời mở căn cứ.
 *  3. Không lời nào trách móc, không lời nào tạo áp lực thời gian.
 *  4. Giọng công vụ: xưng "tôi", gọi "bạn"; câu trần thuật, không tiểu từ tình thái
 *     (nhé, nha, ạ), không dấu chấm than, không câu hỏi tu từ.
 */

import type { DieuKien, HanhDong } from "./types.ts";

/** Hành động gieo sẵn; `id` và `personaId` do CSDL điền khi gieo. */
export type HanhDongGoc = Omit<HanhDong, "id" | "personaId"> & {
  /** Mã nhân vật cố định cho hành động này; rỗng = theo định tuyến. */
  personaCode?: string;
};

/** Giá trị mặc định chung. Là hàm chứ không phải hằng: mỗi hành động phải có mảng
 * riêng, nếu dùng chung một tham chiếu thì sửa điều kiện của một hành động sẽ sửa
 * điều kiện của tất cả. */
function chung() {
  return {
    conditions: [] as DieuKien[],
    audiences: [] as string[],
    courseIds: [] as string[],
    enabled: true,
  };
}

export const HANH_DONG_GOC: readonly HanhDongGoc[] = [
  /* ---------------- Vào ra ---------------- */
  {
    ...chung(),
    code: "chao_vao_chuyen_de",
    trigger: "vao_chuyen_de",
    priority: 80,
    cooldownSeconds: 86_400,
    maxPerSession: 1,
    maxPerDay: 1,
    anchor: "giua_man_hinh",
    state: "vui",
    pose: "vay_tay",
    effect: "bong_thoai",
    speech: [
      {
        text: "Tôi đi cùng bạn trong chuyên đề này. Ba câu hỏi ngắn giúp hệ thống chọn nhịp học phù hợp.",
        loai: "loi_dan",
      },
    ],
    cta: { nhan: "Trả lời ba câu hỏi", duong_dan: "?buoc=lam-quen" },
  },
  {
    ...chung(),
    code: "mo_bai",
    trigger: "vao_bai",
    priority: 45,
    cooldownSeconds: 600,
    maxPerSession: 4,
    maxPerDay: 12,
    anchor: "goc_phai_duoi",
    state: "giai_thich",
    pose: "chi_tay",
    effect: "khong",
    // Không tóm tắt nội dung: tóm tắt là việc của khối `tom_tat`. Hành động này dùng chung cho
    // mọi chuyên đề nên lời không được giả định bài cho ra sản phẩm gì (hồ sơ dự án chỉ có ở
    // chuyên đề đầu tư); chỉ nói thời lượng và cách dùng căn cứ.
    speech: [
      {
        text: "Bài này khoảng {{phut}} phút. Căn cứ của từng phần nằm trong khung có viền riêng.",
        loai: "loi_dan",
      },
      {
        text: "Thời lượng bài khoảng {{phut}} phút. Cần xem lại phần nào, bạn gọi tôi.",
        loai: "loi_dan",
      },
    ],
    cta: null,
  },
  {
    ...chung(),
    code: "tro_lai_sau_ky_nghi",
    trigger: "vang_mat_tro_lai",
    priority: 75,
    cooldownSeconds: 86_400,
    maxPerSession: 1,
    maxPerDay: 1,
    anchor: "goc_phai_duoi",
    state: "vui",
    pose: "vay_tay",
    effect: "khong",
    // Không trách móc: người học nghỉ vài hôm là chuyện bình thường của người đi làm.
    speech: [
      {
        text: "Bạn đang dừng ở bài {{bai}}. Có thể ôn lại 5 phút trước khi học tiếp.",
        loai: "loi_dan",
      },
    ],
    cta: { nhan: "Ôn lại 5 phút", duong_dan: "on-tap" },
  },

  /* ---------------- Đọc bài ---------------- */
  {
    ...chung(),
    code: "dung_lau_moi_giang_lai",
    trigger: "dung_lau_o_khoi",
    conditions: [{ truong: "giay_o_khoi", toan_tu: "lon_hon", gia_tri: 90 }],
    priority: 60,
    cooldownSeconds: 900,
    maxPerSession: 2,
    maxPerDay: 6,
    anchor: "canh_khoi",
    state: "suy_nghi",
    pose: "chi_tay",
    effect: "dau_hoi",
    speech: [
      { text: "Phần này có thể được trình bày lại ở mức đơn giản hơn.", loai: "loi_dan" },
      { text: "Đoạn này có một ví dụ cụ thể kèm theo.", loai: "loi_dan" },
    ],
    // Giảng lại bằng mô hình chưa được triển khai. Trong lúc chờ, mời một việc CÓ THẬT là
    // mở căn cứ của phần đang đọc — không mời người học làm việc hệ thống chưa làm được.
    cta: { nhan: "Mở căn cứ của phần này", lenh: "mo_can_cu" },
  },

  /* ---------------- Làm bài ---------------- */
  {
    ...chung(),
    code: "khen_dung_co_can_cu",
    trigger: "tra_loi_dung",
    priority: 40,
    cooldownSeconds: 240,
    maxPerSession: 4,
    maxPerDay: 20,
    anchor: "tren_cau_hoi",
    state: "vui",
    pose: "dung",
    effect: "khong",
    // Không khen rỗng: mỗi lời khen kèm một lý do và một đường tới căn cứ.
    speech: [
      { text: "Đúng. Nội dung quyết định nằm ở khoản được mở bên cạnh.", loai: "loi_dan" },
      { text: "Đúng. Bạn đã đọc đúng khoản phân định thẩm quyền.", loai: "loi_dan" },
    ],
    cta: { nhan: "Xem căn cứ", lenh: "mo_can_cu" },
  },
  {
    ...chung(),
    code: "sai_lan_dau",
    trigger: "tra_loi_sai",
    conditions: [{ truong: "so_lan_sai", toan_tu: "nho_hon", gia_tri: 2 }],
    priority: 65,
    cooldownSeconds: 120,
    maxPerSession: 5,
    maxPerDay: 25,
    anchor: "tren_cau_hoi",
    state: "khich_le",
    pose: "chi_tay",
    effect: "khong",
    // Không tiết lộ đáp án. Nêu loại lỗi rồi mở căn cứ.
    speech: [
      {
        text: "Chưa đúng. Đây là lỗi {{ten_loi}}. Mở căn cứ để đối chiếu.",
        loai: "loi_dan",
      },
      { text: "Đây là nội dung thường bị áp dụng sai. Tôi mở đúng khoản để bạn đối chiếu.", loai: "loi_dan" },
    ],
    cta: { nhan: "Mở căn cứ", lenh: "mo_can_cu" },
  },
  {
    ...chung(),
    code: "sai_lap_lai_de_nghi_va",
    trigger: "sai_lap_lai",
    conditions: [{ truong: "so_lan_cung_ma_loi", toan_tu: "lon_hon", gia_tri: 1 }],
    priority: 85,
    cooldownSeconds: 3600,
    maxPerSession: 2,
    maxPerDay: 4,
    anchor: "tren_cau_hoi",
    state: "giai_thich",
    pose: "chi_tay",
    effect: "khong",
    speech: [
      {
        text: "Lỗi này lặp lại lần thứ hai. Có một bài vá 4 phút, không ảnh hưởng tiến độ chung.",
        loai: "loi_dan",
      },
    ],
    cta: { nhan: "Làm bài vá 4 phút", lenh: "chen_bai_va" },
  },

  /* ---------------- Đánh giá ---------------- */
  {
    ...chung(),
    code: "mo_dau_danh_gia",
    personaCode: "can_nhac",
    trigger: "bat_dau_danh_gia",
    priority: 90,
    cooldownSeconds: 3600,
    maxPerSession: 2,
    maxPerDay: 6,
    anchor: "giua_man_hinh",
    state: "nghiem_tuc",
    pose: "gio_bang",
    costume: "hoi_dong_tham_dinh",
    prop: "can_dia",
    effect: "khong",
    // Trong lúc làm bài, mascot im lặng tuyệt đối: không có hành động nào cho trigger đọc bài.
    speech: [
      {
        text: "Bài đánh giá gồm {{so_cau}} câu, {{phut}} phút, ngưỡng đạt {{nguong}}%. Anh/chị có quyền phúc khảo kết quả.",
        loai: "loi_dan",
      },
    ],
    cta: { nhan: "Bắt đầu làm bài" },
  },
  {
    ...chung(),
    code: "truot_bai_kiem_tra",
    personaCode: "can_nhac",
    trigger: "truot_bai_kiem_tra",
    priority: 88,
    cooldownSeconds: 1800,
    maxPerSession: 2,
    maxPerDay: 5,
    anchor: "giua_man_hinh",
    state: "nghiem_tuc",
    pose: "gio_bang",
    effect: "khong",
    // Không an ủi sáo rỗng: đưa thẳng kỹ năng yếu và đường ngắn nhất để thi lại.
    speech: [
      {
        text: "Kết quả chưa đạt ngưỡng. Ba kỹ năng cần củng cố được liệt kê bên dưới; hoàn thành thì làm lại bài đánh giá.",
        loai: "loi_dan",
      },
    ],
    cta: { nhan: "Xem ba kỹ năng cần củng cố", duong_dan: "?xem=ky-nang-yeu" },
  },

  /* ---------------- Pháp lý ---------------- */
  {
    ...chung(),
    code: "canh_bao_het_hieu_luc",
    trigger: "can_cu_het_hieu_luc",
    priority: 100,
    cooldownSeconds: 0,
    maxPerSession: 99,
    maxPerDay: 99,
    anchor: "canh_khoi",
    state: "canh_bao",
    pose: "chi_tay",
    effect: "dau_cham_than",
    // Ưu tiên cao nhất và không có thời gian nghỉ: căn cứ hết hiệu lực là thứ không được im,
    // kể cả khi người học đã bật chế độ yên lặng.
    speech: [
      {
        text: "Cảnh báo hiệu lực: căn cứ ở khối này đã hết hiệu lực từ {{ngay}}. Văn bản thay thế là {{van_ban_moi}}.",
        loai: "loi_dan",
      },
    ],
    cta: { nhan: "Xem đối chiếu trước/sau", lenh: "so_sanh" },
  },
  {
    ...chung(),
    code: "khong_du_can_cu",
    trigger: "khong_du_can_cu",
    priority: 95,
    cooldownSeconds: 60,
    maxPerSession: 10,
    maxPerDay: 30,
    anchor: "goc_phai_duoi",
    state: "bo_tay",
    pose: "gio_bang",
    effect: "khong",
    // Trạng thái `bo_tay` tồn tại để việc "không biết" có hình ảnh riêng, thay vì bị giấu đi.
    speech: [
      {
        text: "Kho dữ liệu chưa có đủ căn cứ cho nội dung này. Tôi đã chuyển yêu cầu tới biên tập viên.",
        loai: "loi_dan",
      },
      {
        text: "Chưa có văn bản nào trong kho trả lời được nội dung này. Hệ thống không suy đoán.",
        loai: "loi_dan",
      },
    ],
    cta: { nhan: "Đặt câu hỏi tại chỗ", lenh: "hoi_tai_cho" },
  },

  /* ---------------- Duy trì ---------------- */
  {
    ...chung(),
    code: "nhac_on_tap",
    trigger: "den_han_on_tap",
    conditions: [{ truong: "so_the_den_han", toan_tu: "lon_hon", gia_tri: 4 }],
    priority: 55,
    cooldownSeconds: 43_200,
    maxPerSession: 1,
    maxPerDay: 2,
    anchor: "thanh_tien_do",
    state: "binh_thuong",
    pose: "dung",
    effect: "khong",
    speech: [{ text: "Có {{so_the}} thẻ ôn tập đến hạn. Thời gian ôn khoảng 5 phút.", loai: "loi_dan" }],
    cta: { nhan: "Mở phần ôn tập", duong_dan: "on-tap" },
  },
  {
    ...chung(),
    code: "dat_muc_tieu_tuan",
    trigger: "dat_muc_tieu_tuan",
    priority: 50,
    cooldownSeconds: 86_400,
    maxPerSession: 1,
    maxPerDay: 1,
    anchor: "goc_phai_duoi",
    state: "hao_hung",
    pose: "nhay",
    effect: "phao_giay",
    speech: [{ text: "Bạn đã đạt mục tiêu học tập của tuần này.", loai: "loi_dan" }],
    cta: null,
  },

  /* ---------------- Công cụ ---------------- */
  {
    ...chung(),
    code: "vao_may_tinh_chi_phi",
    personaCode: "dan_do",
    trigger: "mo_may_tinh_chi_phi",
    priority: 70,
    cooldownSeconds: 1800,
    maxPerSession: 2,
    maxPerDay: 6,
    anchor: "canh_khoi",
    state: "giai_thich",
    pose: "cam_but",
    prop: "may_tinh_cam_tay",
    effect: "khong",
    speech: [
      {
        text: "Hai việc cần kiểm trước khi tính: đơn vị tính của từng dòng, và căn cứ của từng định mức.",
        loai: "loi_dan",
      },
    ],
    cta: { nhan: "Điền sẵn số liệu từ bài", lenh: "mo_cong_cu", tham_so: { cong_cu: "chi_phi_phan_mem" } },
  },

  /* ---------------- Cột mốc ---------------- */
  {
    ...chung(),
    code: "hoan_thanh_bai",
    trigger: "hoan_thanh_bai",
    priority: 48,
    cooldownSeconds: 300,
    maxPerSession: 5,
    maxPerDay: 15,
    anchor: "goc_phai_duoi",
    state: "vui",
    pose: "dung",
    effect: "khong",
    speech: [{ text: "Hoàn thành bài. Sản phẩm vừa làm đã được lưu vào hồ sơ của bạn.", loai: "loi_dan" }],
    cta: { nhan: "Bước kế tiếp", duong_dan: "tien-do" },
  },
  {
    ...chung(),
    code: "nhan_chung_nhan",
    trigger: "nhan_chung_nhan",
    priority: 92,
    cooldownSeconds: 86_400,
    maxPerSession: 1,
    maxPerDay: 1,
    anchor: "giua_man_hinh",
    state: "an_mung",
    pose: "nhay",
    costume: "tot_nghiep",
    effect: "phao_giay",
    // Nhắc luôn hạn của chứng nhận: khung pháp lý đổi thì kiến thức cũng phải học bù.
    speech: [
      {
        text: "Hoàn thành chuyên đề. Chứng nhận gắn với khung pháp lý tại {{as_of}}; khi văn bản thay đổi, hệ thống sẽ mời bạn học bổ sung.",
        loai: "loi_dan",
      },
    ],
    cta: { nhan: "Xem chứng nhận", duong_dan: "chung-nhan" },
  },
];

/** Thay biến {{ten}} trong lời thoại bằng giá trị thật của phiên học. */
export function thayBien(text: string, bien: Record<string, string | number | boolean>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (goc, k: string) => {
    const v = bien[k];
    return v === undefined || v === null || v === "" ? goc : String(v);
  });
}

/**
 * Kiểm tra một hành động trước khi lưu — dùng cho màn hình quản trị và cho test.
 * Trả về danh sách lỗi; rỗng là hợp lệ.
 */
export function kiemTraHanhDong(
  hd: Pick<HanhDong, "speech" | "cta" | "priority" | "cooldownSeconds">,
): string[] {
  const loi: string[] = [];
  if (!hd.speech.length) loi.push("Phải có ít nhất một biến thể lời thoại");
  for (const [i, s] of hd.speech.entries()) {
    if (!s.text.trim()) loi.push(`Biến thể ${i + 1} rỗng`);
    if (s.text.length > 140) loi.push(`Biến thể ${i + 1} dài quá 140 ký tự`);
    if (s.loai === "loi_phap_ly" && !(s.citations?.length ?? 0)) {
      loi.push(`Biến thể ${i + 1} là lời pháp lý nhưng chưa gắn viện dẫn`);
    }
  }
  if (hd.priority < 0 || hd.priority > 100) loi.push("Ưu tiên phải nằm trong 0–100");
  if (hd.cooldownSeconds < 0) loi.push("Thời gian nghỉ không được âm");
  if (hd.cta && !hd.cta.nhan.trim()) loi.push("Lời mời phải có nhãn");
  return loi;
}
