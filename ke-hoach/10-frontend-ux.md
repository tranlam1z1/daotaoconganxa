# 10. Frontend và trải nghiệm người dùng

## 1. Nền tảng
- React Router v7 framework mode (`react-router.config.ts`, `ssr: true`), Vite, TypeScript strict, Bun. Loader gọi API nội bộ qua HTTP hoặc gọi trực tiếp package `db` trên server (chọn HTTP để tách deploy).
- Tailwind CSS v4 + Radix; font hệ thống + `Be Vietnam Pro`/`Inter` với tiếng Việt đầy đủ; KaTeX cho công thức; bảng có cuộn ngang trong container.
- PWA: cache văn bản đã đọc để đọc offline; "Thêm vào màn hình chính".
- SEO: SSR toàn bộ trang văn bản, URL đẹp, JSON-LD `Legislation` (schema.org), sitemap theo văn bản/điều, `hreflang` khi có bản dịch.

## 2. Bản đồ route (rút gọn)
```
/                                   trang chủ: ô tìm kiếm, văn bản mới, chuyên đề nổi bật
/tim-kiem?q=&as_of=&loai=&cq=&tt=    kết quả tra cứu (nút + văn bản), facet
/van-ban/:doc_type/:so_ky_hieu        trang văn bản: toàn văn (mặc định hiệu lực hôm nay)
/van-ban/:.../:so_ky_hieu/thuoc-tinh  thuộc tính, lịch sử hiệu lực (timeline)
/van-ban/:.../:so_ky_hieu/luoc-do     lược đồ quan hệ (cây cha/con, ảnh hưởng, cấp nút)
/van-ban/:.../:so_ky_hieu/phien-ban   danh sách phiên bản, so sánh
/van-ban/:.../:so_ky_hieu/dieu-15     neo trực tiếp điều (SSR riêng cho SEO), hash #khoan-2
/hop-nhat/:so_ky_hieu?as_of=          bản hợp nhất tự động theo thời điểm (nhãn rõ ràng)
/so-sanh?a=&b=                        diff hai văn bản/phiên bản
/hoi-dap                              RAG hỏi đáp có trích dẫn
/ung-dung, /ung-dung/:slug            thư viện use case
/dao-tao, /dao-tao/:course, /dao-tao/:course/:lesson
/cong-cu/tinh-chi-phi-phan-mem, /cong-cu/dinh-tuyen-thu-tuc
/tai-khoan/*                          theo dõi văn bản, lịch sử, ghi chú
/quan-tri/*                           console biên tập (route bảo vệ, layout riêng)
```

## 3. Trang đọc văn bản (trọng tâm mobile)
- Thanh trên: tên ngắn văn bản, trạng thái (chip màu), "hiệu lực tại: [ngày]" (bấm để đổi thời điểm), nút mục lục.
- Mục lục dạng drawer (mobile) / cột trái (desktop): Phần/Chương/Mục/Điều; tìm nhanh trong mục lục.
- Thân: mỗi nút có anchor, icon "sao chép viện dẫn" (chuẩn 01 §6), "lịch sử khoản này", badge nếu `amended/repealed/added` với footnote NĐ 250/2026 mở rộng tại chỗ.
- Bảng: cuộn ngang trong khung, nút "xem toàn màn hình", nút "xem ảnh gốc"; công thức render KaTeX + nút "diễn giải".
- Cột phải (desktop) / tab (mobile): văn bản hướng dẫn điều này, văn bản sửa đổi, dẫn chiếu, use case liên quan.
- Cài đặt đọc: cỡ chữ, giãn dòng, nền tối, chế độ "chỉ điều đang xem".
- Điều hướng bằng bàn phím: `j/k` điều tiếp/trước; `/` tìm kiếm.

## 4. Tìm kiếm
- Ô tìm kiếm nhận: số ký hiệu, viện dẫn ("khoản 2 điều 15 nđ 45/2026"), câu hỏi tự nhiên; gợi ý tức thời.
- Kết quả: nhóm "Khớp viện dẫn", "Điều/khoản liên quan" (highlight, ngữ cảnh cha), "Văn bản", "Use case", "Bài học".
- Facet: thứ bậc, loại, cơ quan, lĩnh vực, trạng thái, năm, địa phương; công tắc "gồm hết hiệu lực"; chọn `as_of`.

## 5. Hỏi đáp
- Giao diện hội thoại; câu trả lời có thẻ căn cứ; nhấn thẻ mở panel đọc đúng khoản với ngữ cảnh; cảnh báo màu khi căn cứ hết hiệu lực; nút "báo sai" gửi vào eval.
- Tuyên bố miễn trừ cố định; giới hạn lượt cho khách.

## 6. Console biên tập
- Hàng đợi: chuyển đổi cần duyệt (ảnh ↔ Markdown), amendment ops, thay đổi trạng thái, use case/bài học `citation_health`, báo sai từ người dùng.
- Trình soạn Markdown có bảo vệ marker nút; citation picker; xem trước render.
- Nhật ký (audit) và thống kê năng suất.

## 7. Hiệu năng và khả năng truy cập
- SSR + streaming; văn bản lớn (bộ luật >1.000 điều) render theo cửa sổ (virtualized) với anchor vẫn hoạt động (SSR điều đích trước).
- Core Web Vitals mục tiêu: LCP < 2,5 s trên 4G, CLS < 0,1.
- WCAG 2.1 AA: tương phản, đọc màn hình cho bảng (caption, th scope), công thức có `alt`.
