/**
 * Dựng McpServer với bộ công cụ đã lọc theo vai trò của người gọi.
 *
 * Mỗi phiên kết nối tạo MỘT server riêng gắn với một danh tính: nhờ vậy danh sách
 * công cụ mà client nhìn thấy đúng bằng quyền của người đó, và mọi lần gọi đều được
 * kiểm tra lại phía server rồi ghi nhật ký.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type Principal, ROLE_LABEL } from "@qdpl/auth";
import { registerPrompts } from "./prompts.ts";
import { createRegistrar } from "./registrar.ts";
import { registerResources } from "./resources.ts";
import { registerAdminTools } from "./tools/quan-tri.ts";
import { registerSoHoaTools } from "./tools/so-hoa.ts";
import { registerLookupTools } from "./tools/tra-cuu.ts";
import { registerOpsTools, writeEnabled } from "./tools/van-hanh.ts";

export const SERVER_INFO = {
  name: "quydinhphapluat",
  version: "0.1.0",
  title: "Quy định Pháp luật — tra cứu, đối chiếu, vận dụng quy định pháp luật",
} as const;

const INSTRUCTIONS = `Máy chủ này cho phép tra cứu và vận dụng văn bản quy phạm pháp luật Việt Nam
từ kho dữ liệu của Quy định Pháp luật.

Nguyên tắc bắt buộc khi dùng:
1. KHÔNG trả lời câu hỏi pháp lý theo trí nhớ. Luôn dùng tim_kiem_quy_dinh rồi doc_dieu_khoan
   để lấy nguyên văn quy định đang có hiệu lực.
2. Mọi truy vấn đều có tham số as_of (thời điểm). Nếu người dùng không nêu, mặc định là hôm nay,
   và phải nói rõ câu trả lời áp dụng cho thời điểm nào.
3. TRƯỚC KHI KẾT LUẬN, gọi kiem_tra_can_cu với danh sách viện dẫn định dùng. Nếu có căn cứ nào
   bị bãi bỏ, chưa có hiệu lực hoặc không tồn tại thì không được dùng nó để kết luận.
4. Khi hai quy định mâu thuẫn, dùng doi_chieu_thu_bac để xác định văn bản được ưu tiên áp dụng.
5. Bản hợp nhất do hệ thống tạo là tài liệu THAM KHẢO. Căn cứ chính thức để viện dẫn và áp dụng
   là văn bản hợp nhất của cơ quan nhà nước hoặc chính các văn bản được hợp nhất.
6. Nếu phát hiện dữ liệu sai hoặc đáng ngờ, dùng bao_van_de để báo cho người biên tập,
   không tự suy đoán và không tự sửa.
7. Số hóa văn bản (nếu vai trò của bạn có nhóm công cụ này) đi theo đúng vòng:
   nhan_viec_so_hoa -> lay_cua_so_trang -> nop_cua_so -> hoan_tat_so_hoa. Khi chuyển
   trang thành Markdown, bạn là NGƯỜI SAO CHÉP: không tóm tắt, không sửa văn phong,
   không đoán chỗ mờ; chỗ không đọc được thì đánh dấu [[không đọc được: …]].

Trích dẫn theo chuẩn Việt Nam, ví dụ: "điểm a khoản 2 Điều 15 Nghị định số 45/2026/NĐ-CP
ngày 26/01/2026 của Chính phủ".`;

export function buildServer(principal: Principal): McpServer {
  const server = new McpServer(SERVER_INFO, {
    instructions: `${INSTRUCTIONS}\n\nBạn đang kết nối với vai trò: ${principal.role} — ${ROLE_LABEL[principal.role]} (${principal.email}).`,
    capabilities: { tools: {}, resources: {}, prompts: {}, logging: {} },
  });

  // Chỉ đăng ký công cụ mà vai trò này được dùng: client không thấy công cụ ngoài quyền.
  const reg = createRegistrar(server, principal, writeEnabled());
  registerLookupTools(reg);
  registerOpsTools(reg);
  registerSoHoaTools(reg);
  registerAdminTools(reg);
  registerResources(server);
  registerPrompts(server);

  return server;
}
