/**
 * Bộ kiểm hành văn phải bắt đúng những ví dụ mà QUY-TAC-HANH-VAN.md nêu là sai, và phải
 * để yên những câu mà chính tài liệu đó nêu là đúng. Test này chép thẳng các cặp ví dụ
 * trong tài liệu, nên khi quy tắc đổi thì test hỏng trước — đúng thứ tự mong muốn.
 */
import { describe, expect, test } from "bun:test";
import { coLoiChan, soatCauTruc, soatChu } from "../src/index.ts";

const ma = (s: string) => soatChu(s).map((l) => l.ma);

describe("câu sai theo tài liệu thì bị bắt", () => {
  const sai: Array<[string, string]> = [
    ["Chào bạn. Mình đi cùng bạn chuyên đề này nhé?", "tieu_tu_tinh_thai"],
    ["Chưa đúng, nhưng gần rồi.", "khau_ngu"],
    ["Chỗ này mình chịu.", "khau_ngu"],
    ["Khoan đã. Căn cứ này đã hết hiệu lực.", "khau_ngu"],
    ["Chỗ này hơi rối.", "khau_ngu"],
    ["Đúng rồi!", "dau_cham_than"],
    ["Xong bài 🎉", "emoji"],
    ["Tớ nghĩ cậu nên xem lại.", "xung_ho"],
    ["Đừng bao giờ chép danh mục căn cứ từ hồ sơ cũ.", "ra_lenh"],
    ["Yên tâm, hệ thống lo hết.", "ra_lenh"],
    ["Chắc bạn đang thắc mắc vì sao.", "du_doan_phan_ung"],
    ["Nghe thì đơn giản, nhưng thử rồi mới thấy.", "du_doan_phan_ung"],
    ["Áp dụng NĐ 224/2026 cho dự án này.", "so_hieu_viet_tat"],
    ["Thẩm quyền xác định theo quy định hiện hành.", "quy_dinh_hien_hanh"],
    ["Đây là phần quan trọng nhất của bài.", "tu_nhan_manh"],
    ["Chuyên đề này là xương sống của chương trình.", "an_du"],
  ];

  for (const [cau, maLoi] of sai) {
    test(`bắt được "${cau.slice(0, 42)}…"`, () => {
      expect(ma(cau)).toContain(maLoi);
    });
  }
});

describe("câu đúng theo tài liệu thì không bị báo", () => {
  const dung = [
    "Tôi đi cùng bạn trong chuyên đề này. Ba câu hỏi ngắn giúp hệ thống chọn nhịp học phù hợp.",
    "Đúng. Nội dung quyết định nằm ở khoản được mở bên cạnh.",
    "Chưa đúng. Đây là lỗi nhầm quy định chuyển tiếp. Mở căn cứ để đối chiếu.",
    "Kho dữ liệu chưa có đủ căn cứ cho nội dung này. Tôi đã chuyển yêu cầu tới Admin quản lý.",
    "Không sử dụng lại danh mục căn cứ của hồ sơ cũ mà chưa tra lại hiệu lực.",
    "Cảnh báo hiệu lực: căn cứ ở khối này đã hết hiệu lực từ 01/7/2026.",
    "Nghị định số 224/2026/NĐ-CP ngày 24/6/2026 của Chính phủ, hiệu lực từ 01/7/2026.",
    // Thuật ngữ "động cơ" cuối câu hoặc trước dấu chấm phẩy không phải tiểu từ "cơ".
    "Hai mươi (20) năm tính từ năm sản xuất đối với xe chở hàng bốn bánh có gắn động cơ.",
    "Niên hạn của xe chở người bốn bánh có gắn động cơ; xe tương tự áp dụng như trên.",
    "Bài đánh giá gồm 20 câu, 45 phút, ngưỡng đạt 80%. Anh/chị có quyền phúc khảo kết quả.",
    "Trình tự gồm bốn bước: xác định thời điểm, tra hiệu lực, đọc điều khoản chuyển tiếp, chốt danh mục.",
  ];

  for (const cau of dung) {
    test(`không báo "${cau.slice(0, 42)}…"`, () => {
      expect(soatChu(cau)).toEqual([]);
    });
  }
});

describe("nhãn tiêu đề", () => {
  test('"Làm thử" và "Chốt lại" bị đổi theo bảng §5', () => {
    expect(ma("Làm thử")).toContain("tieu_de_cam");
    expect(ma("Chốt lại")).toContain("tieu_de_cam");
    expect(soatChu("Bài tập")).toEqual([]);
    expect(soatChu("Tóm tắt")).toEqual([]);
  });
});

describe("soát cấu trúc", () => {
  test("đi vào mọi chuỗi và chỉ đúng vị trí vi phạm", () => {
    const khoi = {
      md: "Nội dung bình thường.",
      y: ["Ý một.", "Nhớ nhé, phải kiểm lại."],
    };
    const loi = soatCauTruc(khoi, "bai-1.khoi-3");
    // "Nhớ nhé" phạm hai quy tắc cùng lúc: ra lệnh trống không (§1) và tiểu từ cuối câu (§3.1).
    expect(loi.map((l) => l.ma).sort()).toEqual(["ra_lenh", "tieu_tu_tinh_thai"]);
    // Chỉ đúng phần tử vi phạm, không đổ lỗi cho cả khối.
    expect(new Set(loi.map((l) => l.o))).toEqual(new Set(["bai-1.khoi-3.y[1]"]));
    expect(coLoiChan(loi)).toBe(true);
  });

  test("bỏ qua khoá kỹ thuật: URN và mã không phải chữ người đọc", () => {
    // "vn:vbqppl:nd:224/2026/NĐ-CP" không được coi là số hiệu viết tắt.
    expect(soatCauTruc({ urn: "vn:vbqppl:nd:224/2026/NĐ-CP", ma: "NĐ 224/2026" })).toEqual([]);
  });

  test("nội dung sạch thì không báo gì", () => {
    expect(
      soatCauTruc({
        md: "Xác định văn bản áp dụng theo thời điểm của hồ sơ.",
        nguyen_van: "Điều 91 quy định chuyển tiếp.",
      }),
    ).toEqual([]);
  });
});

describe("nguyên văn văn bản quy phạm trong thẻ căn cứ", () => {
  test("không áp §6 và số hiệu viết tắt cho trường nguyen_van, nhưng vẫn áp cho trường khác", () => {
    const khoi = {
      urn: "vn:vbqppl:l:36/2024/QH15",
      nhan: "Khoản 1 Điều 35 Luật số 36/2024/QH15",
      nguyen_van:
        "a) Được cấp chứng nhận đăng ký xe và gắn biển số xe theo quy định của pháp luật; b) Bảo đảm chất lượng " +
        "an toàn kỹ thuật và bảo vệ môi trường theo quy định của pháp luật. Chính phủ quy định chi tiết Điều này của Luật này.",
      ghi_chu: "Thẩm quyền xác định theo quy định hiện hành.",
    };
    const loi = soatCauTruc(khoi, "khối 3 (can_cu)");
    expect(loi.filter((l) => l.o?.endsWith("nguyen_van")).map((l) => l.ma)).toEqual([]);
    expect(loi.filter((l) => l.o?.endsWith("ghi_chu")).map((l) => l.ma)).toContain("quy_dinh_hien_hanh");
  });
});
