/** Mẫu nhắc việc (prompt) cho các tác vụ pháp lý thường gặp. */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "tra-loi-co-can-cu",
    {
      title: "Trả lời câu hỏi pháp lý có căn cứ",
      description: "Quy trình chuẩn: truy xuất, đọc nguyên văn, kiểm chứng căn cứ rồi mới kết luận.",
      argsSchema: {
        cau_hoi: z.string().describe("Câu hỏi của người dùng."),
        as_of: z.string().optional().describe("Thời điểm áp dụng, mặc định hôm nay."),
      },
    },
    ({ cau_hoi, as_of }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              `Trả lời câu hỏi pháp lý sau theo đúng quy trình, không trả lời theo trí nhớ.\n\n` +
              `Câu hỏi: ${cau_hoi}\n` +
              `Thời điểm áp dụng: ${as_of ?? "hôm nay"}\n\n` +
              `Các bước bắt buộc:\n` +
              `1. Gọi tim_kiem_quy_dinh để tìm điều/khoản liên quan.\n` +
              `2. Gọi doc_dieu_khoan cho từng điều/khoản định dùng, đọc nguyên văn.\n` +
              `3. Gọi kiem_tra_can_cu với toàn bộ viện dẫn định trích. Loại bỏ căn cứ không hợp lệ.\n` +
              `4. Nếu có quy định mâu thuẫn, gọi doi_chieu_thu_bac.\n\n` +
              `Cấu trúc câu trả lời:\n` +
              `- Kết luận ngắn gọn\n` +
              `- Căn cứ: trích nguyên văn kèm viện dẫn đầy đủ theo chuẩn Việt Nam\n` +
              `- Lưu ý về hiệu lực và quy định chuyển tiếp\n` +
              `- Điều kiện, ngoại lệ\n` +
              `- Nêu rõ nếu không đủ căn cứ để kết luận\n\n` +
              `Kết thúc bằng dòng: "Thông tin tham khảo, không thay thế tư vấn pháp lý."`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "ra-soat-hieu-luc",
    {
      title: "Rà soát hiệu lực của một tập văn bản",
      description: "Kiểm tra một danh mục văn bản còn hiệu lực hay đã bị thay thế, sửa đổi.",
      argsSchema: { danh_muc: z.string().describe("Danh sách số ký hiệu, mỗi dòng một văn bản.") },
    },
    ({ danh_muc }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              `Rà soát hiệu lực của các văn bản sau tại thời điểm hôm nay:\n\n${danh_muc}\n\n` +
              `Với mỗi văn bản: dùng danh_sach_van_ban hoặc doc_van_ban để lấy trạng thái, ` +
              `dùng xem_quan_he_van_ban để biết văn bản nào đã sửa đổi hoặc thay thế nó.\n` +
              `Lập bảng: số ký hiệu | tên | trạng thái | văn bản tác động | việc cần làm.\n` +
              `Nêu rõ văn bản nào KHÔNG được dùng làm căn cứ nữa và văn bản thay thế là gì.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "doi-chieu-hai-van-ban",
    {
      title: "Đối chiếu quy định cũ và mới",
      description: "So sánh hai văn bản hoặc hai thời điểm của cùng một văn bản.",
      argsSchema: {
        van_ban_a: z.string(),
        van_ban_b: z.string().optional().describe("Bỏ trống nếu so sánh hai thời điểm của cùng một văn bản."),
        chu_de: z.string().optional().describe("Chủ đề cần tập trung, ví dụ 'thẩm quyền phê duyệt'."),
      },
    },
    ({ van_ban_a, van_ban_b, chu_de }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: van_ban_b
              ? `Đối chiếu ${van_ban_a} và ${van_ban_b}${chu_de ? ` về chủ đề: ${chu_de}` : ""}.\n` +
                `Đọc cả hai bằng doc_van_ban, đối chiếu từng nội dung tương ứng, chỉ rõ điểm khác biệt ` +
                `và nêu văn bản nào được ưu tiên áp dụng (dùng doi_chieu_thu_bac).`
              : `So sánh nội dung của ${van_ban_a} giữa hai thời điểm bằng so_sanh_thoi_diem, ` +
                `giải thích ý nghĩa của từng thay đổi${chu_de ? ` liên quan tới: ${chu_de}` : ""}.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "so-hoa-van-ban",
    {
      title: "Số hóa một văn bản PDF thành Markdown",
      description: "Vòng làm việc đầy đủ: nhận việc, đọc từng cụm trang, nộp Markdown, ghép và kiểm chứng.",
      argsSchema: {
        van_ban: z.string().optional().describe("Số ký hiệu hoặc URN. Bỏ trống là lấy việc đang chờ."),
      },
    },
    ({ van_ban }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              `Hãy số hóa ${van_ban ? `văn bản ${van_ban}` : "văn bản đang chờ trong hàng đợi số hóa"} ` +
              `thành Markdown theo chuẩn nội bộ.\n\n` +
              `Vòng làm việc:\n` +
              `1. nhan_viec_so_hoa${van_ban ? ` với van_ban="${van_ban}"` : ""} — nhận việc và xem kế hoạch chia cụm trang.\n` +
              `2. Với TỪNG cụm theo đúng thứ tự: lay_cua_so_trang, rồi ĐỌC tệp PDF của cụm đó\n` +
              `   (đường dẫn nằm trong kết quả; nếu không đọc được tệp thì gọi lại với kem_anh=true),\n` +
              `   rồi nop_cua_so kèm trang_thai_mo mô tả đúng phần dang dở ở cuối cụm.\n` +
              `3. hoan_tat_so_hoa để ghép, kiểm chứng và chốt.\n\n` +
              `Nguyên tắc: bạn là NGƯỜI SAO CHÉP, không phải người biên tập.\n` +
              `- Nguyên văn tuyệt đối: không tóm tắt, không sửa văn phong, không sửa chính tả bản gốc,\n` +
              `  không tự đánh lại số điều/khoản/điểm, không bỏ sót khối căn cứ và khối chữ ký.\n` +
              `- Câu hoặc bảng bị cắt giữa trang thì nối liền, không ngắt đoạn, không tạo nút mới.\n` +
              `- Chỗ mờ không đọc chắc: [[không đọc được: mô tả]] — TUYỆT ĐỐI không đoán.\n` +
              `- Mọi lỗi OCR đã sửa phải khai trong sua_loi[].\n\n` +
              `Nếu kiểm chứng cuối không đạt, hãy xem cụm nào sai, gọi lại lay_cua_so_trang cho cụm đó,\n` +
              `sửa và nop_cua_so lại, rồi chạy lại hoan_tat_so_hoa. Chỉ dùng bo_qua_canh_bao=true khi\n` +
              `bạn đã kiểm tra và khẳng định được cảnh báo là sai (ví dụ bản gốc vốn nhảy số điều).`,
          },
        },
      ],
    }),
  );
}
