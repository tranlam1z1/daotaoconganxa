---
description: Số hóa một văn bản PDF thành Markdown qua công cụ MCP quydinhphapluat
argument-hint: "[số ký hiệu hoặc URN, bỏ trống là lấy việc đang chờ]"
---

Số hóa văn bản $ARGUMENTS thành Markdown chuẩn nội bộ, dùng nhóm công cụ số hóa của MCP
`quydinhphapluat`. Quy trình đầy đủ ở `ke-hoach/05-ocr-va-chuyen-doi-ai.md`, quy tắc chuyển đổi
ở `prompts/convert/page-window.md`.

Vòng làm việc:

1. `nhan_viec_so_hoa` (kèm `van_ban` nếu có tham số) — nhận việc và xem kế hoạch chia cụm trang.
   Nếu công cụ báo server đang chỉ đọc: dừng lại, báo người dùng đặt `MCP_LOCAL_ROLE=bien_tap`
   và `QDPL_MCP_ALLOW_WRITE=1` trong `.mcp.json` rồi khởi động lại phiên.
2. Với **từng cụm theo đúng thứ tự**:
   - `lay_cua_so_trang` với `viec_id` và `cua_so`;
   - **đọc tệp PDF của cụm** ở đường dẫn mà công cụ trả về (dùng công cụ đọc tệp; nếu không đọc
     được thì gọi lại với `kem_anh: true` để nhận ảnh trang);
   - `nop_cua_so` với Markdown nguyên văn, `trang_thai_mo` mô tả đúng phần dang dở ở cuối cụm,
     khai báo bảng, và `sua_loi[]` cho mọi lỗi OCR đã sửa.
3. `hoan_tat_so_hoa` để ghép, kiểm chứng và chốt.

Nguyên tắc khi chép: bạn là **người sao chép**, không phải người biên tập. Không tóm tắt, không
sửa văn phong hay chính tả của bản gốc, không tự đánh lại số điều/khoản/điểm, không bỏ khối căn
cứ và khối chữ ký. Câu hoặc bảng bị cắt giữa trang thì nối liền. Chỗ mờ ghi
`[[không đọc được: mô tả]]`, tuyệt đối không đoán.

Nếu kiểm chứng cuối không đạt: xem mục kiểm tra nào hỏng, lấy lại đúng cụm liên quan
(`lay_cua_so_trang`), sửa và `nop_cua_so` lại, rồi chạy lại `hoan_tat_so_hoa`. Chỉ dùng
`bo_qua_canh_bao: true` khi đã kiểm tra và khẳng định được cảnh báo là sai (ví dụ bản gốc vốn
nhảy số điều) — và nói rõ lý do cho người dùng.

Kết thúc: báo lại điểm chất lượng, số điều/bảng, các cảnh báo còn lại và nơi lưu bản Markdown.
