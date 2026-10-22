# PHONG CÁCH HÌNH ẢNH

*Lập ngày 25/9/2026; cập nhật sau khi rút gọn phạm vi. Tài liệu nêu nguyên tắc hình ảnh chung của toàn ứng dụng: chữ, hiệu năng và bộ biểu tượng. Mọi màn hình dùng chung hệ "Công báo" (nền giấy, chữ mực, màu nhấn của thương hiệu).*

---

## 0. Tóm tắt

1. **Một hệ hình ảnh cho toàn ứng dụng.** Tra cứu, đọc văn bản, bài giảng, luyện tập, thi, hỏi đáp AI, nhóm học cùng và quản trị dùng chung nền giấy, chữ mực và màu nhấn của thương hiệu. Không có vùng nào đổi phong cách riêng.
2. **Nguyên tắc chung** (§1): năng động nhưng chuyên nghiệp, nghĩa không chỉ nằm ở màu, chữ nội dung là chính, đọc được ngoài trời.
3. **Font tự lưu** (§2), không phụ thuộc Google Fonts lúc offline.
4. **Nguyên tắc hiệu năng và giảm chuyển động** (§3).
5. **Bộ biểu tượng "Nét đậm, hai lớp màu"** (§4), dùng chung cho toàn ứng dụng.

---

## 1. Nguyên tắc chung

- **Năng động nhưng chuyên nghiệp.**
  - Được dùng: màu mạnh, chuyển động nhanh và dứt khoát, số liệu nổi bật.
  - Không dùng: nhân vật hoạt hình, chữ bong bóng, màu kẹo ngọt, tiếng kêu vui nhộn, emoji, dấu chấm than.
  - Lời khen ngắn, trung tính: "Chính xác", "Đã lưu", "Hoàn thành".
- **Không dùng biểu tượng ngành chính thức.** Không dùng quân hiệu, cấp hiệu, phù hiệu, logo của lực lượng Công an. Màu gợi tinh thần, không sao chép trang phục hay biểu trưng.
- **Nghĩa không chỉ nằm ở màu.** Đúng/sai luôn có cả chữ ("Đúng", "Chưa đúng") và biểu tượng (dấu tích, dấu chéo), để người mù màu và người đứng ngoài nắng vẫn đọc được.
- **Chữ nội dung vẫn là chính.** Câu hỏi, giải thích, căn cứ giữ cỡ ≥ 16px và tương phản ≥ 4,5:1. Hiệu ứng chỉ bao quanh nội dung, không đè lên.
- **Đọc được ngoài trời.** Chữ nội dung đặt trên nền đặc, không đặt trên nền chuyển màu hay ảnh.

---

## 2. Font chữ tiếng Việt

*(Mục này là §2.4 của bản trước; `apps/web/app/root.tsx` và `styles/fonts.css` vẫn trỏ tới §2.4.)*

Chữ nội dung giữ **Be Vietnam Pro**: font thiết kế cho tiếng Việt, dấu đặt đúng, đọc tốt cỡ nhỏ. Bộ font theo thương hiệu (`docs/brand`) bổ sung Inter cho chữ chạy và Poppins cho chữ hiển thị; Lexend giữ làm chữ số lớn và chữ của phần biểu tượng.

| Họ | Vai trò |
|---|---|
| Be Vietnam Pro | Chữ chạy (thân bài, giao diện). Có đủ dấu tiếng Việt, dùng làm dự phòng cho mọi họ khác. |
| Inter | Chữ chạy theo thương hiệu. |
| Poppins | Chữ hiển thị (tiêu đề, chữ nhấn). Không có bộ ký tự tiếng Việt nên chuỗi font kèm "Be Vietnam Pro" làm dự phòng. |
| Lexend | Số liệu lớn (điểm thi, thời gian) và phần biểu tượng. |

- Số liệu luôn dùng chữ số đều bề rộng (`font-variant-numeric: tabular-nums`), để số không rung ngang.
- **Tự lưu font, không tải từ Google Fonts khi chạy.** Tệp WOFF2 đặt trong `apps/web/app/styles/fonts/`, khai báo ở `styles/fonts.css`. Vite gắn mã băm vào tên tệp nên service worker giữ được như các tệp build khác. Mỗi họ font chia ba bộ ký tự (latin, latin-ext, vietnamese) theo `unicode-range`, trình duyệt chỉ tải bộ mà trang thật sự dùng.
  - **Ước tính cũ 100–140 KB là sai.** Số đo thật (25/9/2026): trang tiếng Việt thường tải bộ latin và vietnamese, khoảng 136 KB cho Be Vietnam Pro (4 độ đậm), thêm 54 KB Lexend, thêm 51 KB Noto Serif ở trang văn bản; tối đa khoảng 241 KB. Trước đây tải từ Google Fonts cũng khoảng 187 KB (Be Vietnam Pro và Noto Serif).
  - Nếu cần giảm, có thể bỏ độ đậm 500 của Be Vietnam Pro (khoảng 34 KB), vì giao diện hầu như chỉ dùng 400, 600, 700.
- Cần kiểm lại bằng mắt trên máy thật: dấu chồng như "ẫ", "ỗ", "ự" ở cỡ lớn phải không bị cắt đỉnh.

---

## 3. Nguyên tắc hiệu năng

### 3.1. Mục tiêu

- **60 khung hình mỗi giây** trên điện thoại tầm trung: Android khoảng 4 GB RAM, Chrome bản mới.
- Kiểm trên máy tính bằng Chrome DevTools với CPU chậm 4×, và soát tay trên một máy Android tầm trung thật.
- Không có khung hình nào kéo dài quá 50 ms khi dùng (đo bằng tab Performance).

### 3.2. Quy tắc viết hoạt ảnh

1. **Chỉ động `transform` và `opacity`.** Không động `width`, `height`, `top`, `left`, `margin`, `padding`, vì các thuộc tính này buộc trình duyệt tính lại bố cục mỗi khung hình.
2. **Không động `box-shadow` hay `filter`.**
   - Muốn bóng hoặc vòng sáng thay đổi: vẽ sẵn ở một lớp giả (`::after`) rồi chỉ động `opacity` của lớp đó.
   - Không dùng `filter: blur` trên vùng lớn; đây là lý do chính khiến hiệu ứng phát sáng tốn máy.
3. **`will-change` chỉ đặt trong lúc hoạt ảnh chạy** rồi gỡ ra; không đặt sẵn cho mọi phần tử.
4. **Tối đa 3 hoạt ảnh chạy cùng lúc** trên màn hình.
5. **Số liệu chạy số** cập nhật bằng `requestAnimationFrame`, chỉ ghi DOM khi con số đổi. Không dùng `setInterval` 16ms.
6. **Tải lười:** mã chỉ dùng ở một màn hình phải nằm trong gói tải của màn hình đó, không nằm trong gói khởi động.
7. **Không nhấp nháy quá 3 lần mỗi giây** (WCAG 2.3.1), kể cả khi hết giờ hay kết quả vừa hiện.

### 3.3. Giảm chuyển động

- Đọc `prefers-reduced-motion: reduce` từ hệ điều hành.
- Khi giảm chuyển động:
  - thay trượt, nảy, lật, rung ngang bằng hiện dần ≤ 150ms hoặc đổi ngay;
  - tắt vòng sáng xoay, ánh quét;
  - số liệu hiện ngay số cuối, không chạy số.
- Kiểm tự động: kịch bản E2E bật `reducedMotion: "reduce"` và kiểm `animation-name` là `none`.

---

## 4. Bộ biểu tượng (01/10/2026)

Vẽ lại `apps/web/app/components/ui/Icon.tsx` theo [PROMPT_BO_ICON.md](PROMPT_BO_ICON.md), Prompt 1. Áp dụng cho toàn ứng dụng.

### 4.1. Hướng hình ảnh: "Nét đậm, hai lớp màu"

- **Lớp nét** (`net`): dày 2, đầu và góc nét bo tròn, màu `currentColor`. Lớp này một mình đủ nghĩa.
- **Lớp nền** (`nen`): mảng tô đặc dưới nét, lệch 1,25 đơn vị về phía dưới phải. Màu là sắc của biểu tượng, pha trong suốt 25% (sáng) hoặc 35% (tối).
- **Điểm nhấn** (`nhan`): tối đa một chi tiết, ví dụ cửa sổ vàng của ngôi nhà, dải đỏ của sách, chấm báo của chuông. Riêng đèn giao thông có ba đèn, phân biệt bằng vị trí.
- Lưới 24, lề 2, bo góc hình chữ nhật 2. Đầu mũi tên là tam giác nhỏ, ở nét 2 thì kín như tô đặc.
- **Ba kiểu** (`<Icon kieu>`):
  - `hai-lop` (mặc định): đủ ba lớp.
  - `net`: chỉ lớp nét, đơn sắc. Dùng trên nền đặc màu: nút phát sách nói, mục chưa chọn của thanh điều hướng dưới.
  - `dac`: ô bo góc tô đặc màu sắc, hình thu 75% vào giữa, nét màu `--on-primary`. Riêng sắc vàng dùng `--g-tren-nhan`. Dùng cho mục đang chọn của thanh điều hướng dưới.
- `sac` ghi đè sắc mặc định, ví dụ EmptyState dùng `trung`.
- **Màu** chỉ khai ở `app.css`, khối "Bộ biểu tượng": `--ic-nen` và `--ic-nhan` tính bằng `color-mix` từ sắc. Sắc khai trên chính thẻ `<svg>`.
- **Hoạt ảnh**, tắt khi giảm chuyển động:
  - `.ic-lac`: chuông lắc một lần, chưa có chỗ dùng.
- **Trang xem trước** `/xem-bieu-tuong`: chỉ bật ở môi trường dev; bản build mở khi đặt `QDPL_XEM_BIEU_TUONG=1`. Chụp ảnh bằng `E2E_NHAN=<nhãn> QDPL_XEM_BIEU_TUONG=1 bun run e2e bieu-tuong`.

### 4.2. Bảng sắc màu

| Sắc | Token | Sáng | Tối |
|---|---|---|---|
| `chinh` | `--primary` | `#c8201a` | `#ff7a70` |
| `vang` | `--g-nhan` (nay khai cả ở `:root`) | `#f4c20d` | `#f7cf3d` |
| `cam` | `--warn` | `#8a4a0b` | `#f7cc85` |
| `do` | `--seal` | `#da251d` | `#ff6b62` |
| `luc` | `--ok` | `#17623a` | `#8ee0ae` |
| `tim` | `--tim` (mới, `--color-tim`) | `#6d3fc0` | `#c4a8ff` |
| `ngoc` | `--ngoc` (mới, `--color-ngoc`) | `#0f766e` | `#5eead4` |
| `trung` | `--ink-3` | `#62666f` | `#9d9b94` |

### 4.3. Số đo tương phản (WCAG 2.1, tiêu chí 1.4.11, yêu cầu ≥ 3:1)

Lớp nét được đo trên nền thật, lấy giá trị thấp nhất giữa nền trơn và phần nền đã phủ lớp tô 25% hoặc 35% của các sắc có mặt ở chỗ đó.

| Ngữ cảnh | Cặp màu | Sáng | Tối |
|---|---|---|---|
| Nét, nơi mặc định | `ink` trên `surface`, kể cả trên nền tô mọi sắc | 10,91 | 5,69 |
| Nét, nơi mặc định | `ink` trên `canvas`, kể cả trên nền tô mọi sắc | 10,11 | 6,16 |
| Thanh điều hướng dưới, mục khác (`net`) | `ink-2` trên `canvas` | 8,51 | 10,43 |
| Ngăn "Thêm" (`hai-lop`) | `ink-2` trên `surface` và nền tô ngọc, tím, vàng, chính | 5,94 | 3,80 |
| Lưới lối tắt, lưới tra cứu nhanh, thẻ bài học, thẻ số liệu | `primary` trên `primary-soft` (05/10/2026, chỉ đo nền trơn) | 4,95 | 6,16 |
| EmptyState (sắc trung) | `ink-3` trên `surface-2` và nền tô trung | 3,56 | 3,02 |
| Tô đặc, sắc chinh / vang / cam / do | nét trên ô | 5,71 / 10,96 / 6,85 / 4,93 | 7,54 / 12,16 / 12,37 / 6,87 |
| Tô đặc, sắc luc / tim / ngoc / trung | nét trên ô | 7,38 / 6,73 / 5,47 / 5,75 | 11,92 / 9,23 / 12,61 / 6,70 |
| Ô tô đặc của thanh dưới (chinh / luc / trung) | ô trên `canvas` | 5,24 / 6,78 / 5,28 | 7,32 / 11,89 / 6,69 |

Chỗ sát ngưỡng là EmptyState tối (3,02). Các hàng chinh, vang, do được đo lại ngày 05/10/2026 khi đổi màu theo logo (đỏ cờ, vàng kim); hàng màu chính trên nền tô sáu sắc chưa đo lại. Nếu đổi token nền tối thì phải đo lại.

### 4.4. Dung lượng

`Icon.tsx`: 2.292 B gzip (52 khóa) → 5.546 B gzip (63 khóa). Ngân sách là ≤ 9 KB.
