/**
 * Kịch bản dẫn dắt bài học (ke-hoach/09-b §7, §8).
 *
 * Nhân vật đóng vai gia sư: đưa người học đi lần lượt qua từng khối, nói khối đó là gì và
 * cần làm gì với nó, rồi chuyển sang phần bài tập.
 *
 * RÀNG BUỘC QUAN TRỌNG: lời dẫn ở đây là lời ĐIỀU HƯỚNG, không phải nội dung pháp lý. Nó nói
 * "đây là nguyên văn quy định, mọi kết luận trong bài dựa vào khối này", chứ không bao giờ
 * tóm tắt hay diễn giải chính quy định đó. Diễn giải là việc của khối nội dung đã qua pháp
 * chế duyệt; nhân vật chỉ dẫn đường tới đó.
 *
 * Hàm thuần: không chạm DOM, không gọi mạng, nên kiểm thử được và chạy được ở cả hai phía.
 */

import type { TrangThai } from "./types.ts";

export interface KhoiDeDanDat {
  id: string;
  ordinal: number;
  kind: string;
}

export interface BuocDanDat {
  /** Khối tương ứng; rỗng với bước mở đầu và bước kết thúc. */
  blockId: string | null;
  /** Số thứ tự khối, dùng để cuộn tới; 0 với bước không gắn khối. */
  ordinal: number;
  nhan: string;
  loi: string;
  /** Việc người học cần làm ở bước này; bỏ trống nếu chỉ cần đọc. */
  viec?: string;
  trangThai: TrangThai;
}

interface MoTaKhoi {
  nhan: string;
  loi: string;
  viec?: string;
  trangThai: TrangThai;
}

/**
 * Lời dẫn cho từng kiểu khối. Viết theo QUY-TAC-HANH-VAN.md: câu trần thuật, không tiểu từ
 * tình thái, không dấu chấm than, không khen rỗng.
 */
const THEO_KIEU: Record<string, MoTaKhoi> = {
  kich_ban: {
    nhan: "Tình huống mở đầu",
    loi: "Đoạn hội thoại này nêu bối cảnh của bài. Đọc để biết vấn đề đang được đặt ra là gì.",
    trangThai: "giai_thich",
  },
  giang: {
    nhan: "Nội dung",
    loi: "Phần trình bày của bài. Đây là chỗ nêu cách làm, chưa phải căn cứ.",
    trangThai: "giai_thich",
  },
  can_cu: {
    nhan: "Căn cứ",
    loi: "Nguyên văn quy định. Mọi kết luận trong bài đều phải dựa vào khối này.",
    viec: "Mở toàn văn nếu cần đọc trọn điều khoản.",
    trangThai: "nghiem_tuc",
  },
  so_do_trinh_tu: {
    nhan: "Sơ đồ trình tự",
    loi: "Các bước của thủ tục, xếp theo thứ tự thực hiện.",
    viec: "Đối chiếu với hồ sơ bạn đang xử lý để biết đang ở bước nào.",
    trangThai: "giai_thich",
  },
  dong_thoi_gian: {
    nhan: "Dòng thời gian hiệu lực",
    loi: "Các mốc hiệu lực của những văn bản liên quan.",
    viec: "Xác định hồ sơ của bạn rơi vào khoảng nào giữa các mốc.",
    trangThai: "nghiem_tuc",
  },
  doi_chieu: {
    nhan: "Đối chiếu trước và sau",
    loi: "Hai cột đặt cạnh nhau: quy định trước khi sửa đổi và quy định sau khi sửa đổi.",
    trangThai: "giai_thich",
  },
  bang_tra: {
    nhan: "Bảng tra",
    loi: "Bảng tra cứu theo tiêu chí.",
    viec: "Dùng ô tìm kiếm phía trên bảng để lọc theo từ khoá.",
    trangThai: "giai_thich",
  },
  cong_thuc: {
    nhan: "Công thức",
    loi: "Công thức kèm các ô nhập biến.",
    viec: "Thay số vào từng ô để xem kết quả thay đổi theo.",
    trangThai: "giai_thich",
  },
  the_lat: {
    nhan: "Thẻ lật",
    loi: "Bộ thuật ngữ của bài.",
    viec: "Bấm từng thẻ để kiểm tra mình đã nhớ định nghĩa chưa.",
    trangThai: "khich_le",
  },
  hoi_nhanh: {
    nhan: "Hỏi nhanh",
    loi: "Một câu hỏi giữa bài, không tính điểm.",
    viec: "Chọn một phương án để xem phản hồi.",
    trangThai: "khich_le",
  },
  canh_bao: {
    nhan: "Cảnh báo",
    loi: "Nội dung ở khối này thường bị áp dụng sai trong thực tế.",
    trangThai: "canh_bao",
  },
  ho_so: {
    nhan: "Danh mục hồ sơ",
    loi: "Các tài liệu bắt buộc và tuỳ chọn của giai đoạn này.",
    viec: "Đối chiếu với bộ hồ sơ bạn đang chuẩn bị.",
    trangThai: "giai_thich",
  },
  may_tinh: {
    nhan: "Công cụ tính",
    loi: "Công cụ tính gắn với nội dung của bài.",
    viec: "Mở công cụ và thử với số liệu của dự án bạn đang làm.",
    trangThai: "giai_thich",
  },
  cay_quyet_dinh: {
    nhan: "Cây quyết định",
    loi: "Chuỗi câu hỏi dẫn tới kết luận về lối đi pháp lý.",
    viec: "Trả lời lần lượt từng câu.",
    trangThai: "giai_thich",
  },
  bieu_mau: {
    nhan: "Biểu mẫu",
    loi: "Biểu mẫu theo phụ lục của văn bản.",
    viec: "Điền thử để thấy từng trường cần dữ liệu gì.",
    trangThai: "giai_thich",
  },
  diem_nong: {
    nhan: "Ảnh chú giải",
    loi: "Ảnh biểu mẫu có các điểm chú giải bấm được.",
    viec: "Bấm từng chấm để đọc chú giải của mục đó.",
    trangThai: "giai_thich",
  },
  ban_do_khai_niem: {
    nhan: "Bản đồ khái niệm",
    loi: "Quan hệ giữa các khái niệm của bài.",
    trangThai: "giai_thich",
  },
  video: {
    nhan: "Video",
    loi: "Video có phụ đề và bản chép lời.",
    trangThai: "giai_thich",
  },
  tom_tat: {
    nhan: "Tóm tắt",
    loi: "Các ý chính của bài và danh mục căn cứ đã dùng.",
    viec: "Đọc lại để chốt nội dung trước khi làm bài tập.",
    trangThai: "vui",
  },
};

const MAC_DINH: MoTaKhoi = {
  nhan: "Nội dung",
  loi: "Phần nội dung của bài.",
  trangThai: "giai_thich",
};

export interface TuyChonDanDat {
  /** Tên nhân vật, dùng trong lời tự giới thiệu. */
  tenNhanVat: string;
  vaiNhanVat: string;
  tieuDeBai: string;
  soPhut: number;
  /** Số bài tập ở cuối bài; 0 thì bỏ bước bài tập. */
  soBaiTap: number;
  /** Bài đang có căn cứ cần cập nhật. */
  canCuHong?: boolean;
}

/**
 * Dựng lộ trình dẫn dắt cho một bài học: mở đầu, từng khối, phần bài tập, kết thúc.
 */
export function lapLoTrinhDanDat(khoi: KhoiDeDanDat[], o: TuyChonDanDat): BuocDanDat[] {
  const buoc: BuocDanDat[] = [];

  buoc.push({
    blockId: null,
    ordinal: 0,
    nhan: "Bắt đầu",
    loi: `Bài "${o.tieuDeBai}" gồm ${khoi.length} phần, khoảng ${o.soPhut} phút. Tôi đi cùng bạn từng phần.`,
    trangThai: "vui",
  });

  // Căn cứ hỏng là việc phải nói ngay từ đầu, trước khi người học đọc bất cứ nội dung nào.
  if (o.canCuHong) {
    buoc.push({
      blockId: null,
      ordinal: 0,
      nhan: "Cảnh báo hiệu lực",
      loi: "Bài này đang có căn cứ cần cập nhật. Không dùng nội dung ở đây cho hồ sơ thật cho tới khi bộ phận biên tập xác nhận lại.",
      trangThai: "canh_bao",
    });
  }

  const theoThuTu = [...khoi].sort((a, b) => a.ordinal - b.ordinal);
  for (const [i, k] of theoThuTu.entries()) {
    const m = THEO_KIEU[k.kind] ?? MAC_DINH;
    buoc.push({
      blockId: k.id,
      ordinal: i + 1,
      nhan: `Phần ${i + 1} trên ${theoThuTu.length} — ${m.nhan}`,
      loi: m.loi,
      ...(m.viec ? { viec: m.viec } : {}),
      trangThai: m.trangThai,
    });
  }

  if (o.soBaiTap > 0) {
    buoc.push({
      blockId: null,
      ordinal: theoThuTu.length,
      nhan: "Bài tập",
      loi: `Phần bài tập gồm ${o.soBaiTap} câu. Bài chấm ở máy chủ, phản hồi luôn kèm căn cứ.`,
      viec: "Trả lời sai không bị trừ lượt; bạn làm lại được.",
      trangThai: "khich_le",
    });
  }

  buoc.push({
    blockId: null,
    ordinal: theoThuTu.length,
    nhan: "Hết bài",
    loi: "Bạn đã đi hết bài. Tôi vẫn ở đây nếu bạn cần mở lại căn cứ của phần nào.",
    trangThai: "vui",
  });

  return buoc;
}

/**
 * Soát nhanh một câu lời dẫn theo các quy tắc hành văn dễ vi phạm nhất
 * (QUY-TAC-HANH-VAN.md §3.1, §3.4). Bộ soát đầy đủ nằm ở `@qdpl/dao-tao`; ở đây chỉ giữ
 * phần gói mascot tự kiểm được mà không phải phụ thuộc gói khác.
 */
export function soatChuMascot(chu: string): string[] {
  const loi: string[] = [];
  if (/!/.test(chu)) loi.push("dau_cham_than");
  if (/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/u.test(chu)) loi.push("emoji");
  if (/(?<=[\p{L}\p{N}])\s+(nhé|nha|ạ|đấy|nhỉ)\s*(?=[.?,;]|$)/giu.test(chu)) loi.push("tieu_tu_tinh_thai");
  if (/(gần rồi|mình chịu|khoan đã|hơi rối|chuẩn luôn)/iu.test(chu)) loi.push("khau_ngu");
  if (/(?<=^|\s)(tớ|cậu|lão|chúng ta)(?=$|\s|[.,])/iu.test(chu)) loi.push("xung_ho");
  return loi;
}
