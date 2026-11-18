# Hệ giao diện công vụ: hướng "Công văn"

Áp dụng ngày 17/11/2026, thay bản 28/10/2026 (nút chính đỏ đô `#A61C30`, font Be Vietnam Pro) và các chỉ dẫn màu, font cũ trong `docs/brand` và `VISUAL_STYLE.md`. Logo hiện có giữ nguyên hình và màu. Không dùng quân hiệu, cấp hiệu, phù hiệu hay biểu trưng chính thức của lực lượng Công an.

Bản mẫu đã duyệt: ba màn trang chủ, đọc văn bản và luyện tập, xem ở cỡ điện thoại và máy tính (artifact "Bản mẫu Công văn").

## Định hướng

| | |
|---|---|
| Người dùng | Cán bộ Công an xã, công chức, viên chức, đảng viên, chủ yếu 30–60 tuổi; nhiều người dùng điện thoại, mạng ở xã có thể yếu. |
| Việc chính | Tra cứu và đọc văn bản pháp luật, học chuyên đề, luyện tập và thi, dùng công cụ nghiệp vụ. |
| Giọng | Nghiêm trang, rõ ràng, tĩnh. Giao diện là công cụ dùng hằng ngày, không phải trang quảng bá. |
| Chi tiết nhận diện | Mượn quy ước trình bày công văn: kẻ mảnh và gạch ngắn đỏ son dưới tiêu đề (như dưới tên cơ quan), dấu viền đôi cho trạng thái hiệu lực, chữ có chân cho nội dung văn bản. |

## Nguyên tắc

1. **Nền giấy đặc, không ảnh trang trí.** Không dùng ảnh nền trống đồng, hoa sen, banner, watermark hay gradient phía sau nội dung. Lý do: trang tải nhanh trên mạng yếu, chữ đọc được ngoài trời.
2. **Kẻ dòng thay cho thẻ nổi.** Mục trên trang dùng tiêu đề viết hoa với kẻ mực đậm bên dưới, danh sách kẻ dòng mảnh. Chỉ đóng khung (viền mảnh, bo 12px) cho vùng nội dung chính và các ô bấm được. Không lồng thẻ trong thẻ khi làm mới.
3. **Màu có kỷ luật.**
   - Lục `--primary` cho mọi thao tác chính, liên kết, mục đang chọn.
   - Đỏ son `--seal` chỉ dùng cho gạch ngắn dưới tiêu đề, dấu trạng thái pháp lý, câu trả lời sai và lỗi.
   - Vàng `--accent` chỉ là nét kẻ (viền chân trang, viền khẩu hiệu), không làm chữ nhỏ trên nền trắng.
   - Trạng thái luôn có nhãn chữ và biểu tượng, không chỉ dựa vào màu.
4. **Hai họ chữ.** Public Sans cho giao diện; Noto Serif cho nội dung văn bản pháp luật.
5. **Chuyển động tối thiểu.** Chỉ dùng để báo trạng thái; tôn trọng `prefers-reduced-motion` (xem `VISUAL_STYLE.md` §3).

## Token

Khai báo trong `apps/web/app/styles/app.css`; Tailwind sinh lớp tiện ích tương ứng (`bg-canvas`, `text-ink-3`, `rounded-card`, `font-doc`…). Không viết mã màu cứng trong component.

| Token | Sáng | Tối | Vai trò |
|---|---|---|---|
| `--canvas` | `#F4F6F5` | `#0E1512` | Nền trang (giấy) |
| `--surface` | `#FFFFFF` | `#151E1A` | Bề mặt thẻ, header |
| `--surface-2` | `#EDF1EF` | `#1C2722` | Nền phụ, đầu bảng |
| `--ink` | `#14201B` | `#E3EAE6` | Chữ chính, kẻ đậm tiêu đề mục |
| `--ink-2` | `#3E4B45` | `#B9C5BF` | Chữ phụ |
| `--ink-3` | `#5A6761` | `#8F9C96` | Chú thích (≥ 5.2:1 trên mọi nền) |
| `--line` | `#DBE1DE` | `#2A3631` | Kẻ mảnh, viền thẻ |
| `--line-strong` | `#74817B` | `#6B7A73` | Viền ô nhập (≥ 3:1, WCAG 1.4.11) |
| `--primary` | `#1B4D3E` | `#8FD4B5` | Thao tác chính |
| `--primary-soft` | `#E3EFE9` | `#173229` | Nền nhấn nhẹ |
| `--seal` / `--danger` | `#B3261E` | `#FF8A80` | Đỏ son: dấu hiệu lực, lỗi, sai |
| `--accent` | `#A8841C` | `#D9B85A` | Nét kẻ vàng |
| `--ok` / `--warn` / `--info` | `#1F7A4D` / `#7A5A00` / `#2A4A86` | `#7FDCAB` / `#F0D36B` / `#A3BDF5` | Trạng thái |
| `--brand-luc`, `--brand-vang` | `#1B4D3E`, `#D4AF37` | không đổi | Chân trang, tên đơn vị |

Mọi cặp chữ/nền đạt ≥ 4.5:1; đã đo lại ngày 17/11/2026.

**Chữ.** Thang 14 (xs) / 15 (sm) / 16 (thân) / 18 / 20 / 24 / 30px; nhỏ nhất 14px, không dùng `text-[..px]` nhỏ hơn. Tiêu đề trang 24–28px đậm 700. Tiêu đề mục 16px viết hoa, giãn chữ 0.04em. Nội dung văn bản pháp luật (`.prose-legal`, lớp `font-doc`): Noto Serif 17px, dòng 1.8, tối đa 68 ký tự mỗi dòng. Số liệu dùng `tabular-nums`.

**Bo góc.** Ba mức: `rounded-btn` / `--radius-btn` 8px (nút, ô nhập), `rounded-card` / `--radius-card` 12px (thẻ, khung, ô biểu tượng), `rounded-full` (nhãn, ảnh đại diện).

**Bóng.** `--shadow-card` chỉ còn một nét rất nhẹ; thẻ tách khỏi nền bằng viền. `--bong-noi` dành cho lớp nổi (hộp thoại, menu).

**Khoảng cách.** Thang Tailwind bội số 4px: 4, 8, 12, 16, 24, 32, 48px.

## Thành phần chính

| Thành phần | Cách trình bày |
|---|---|
| Header (`SiteHeader`) | Nền trắng, viền lục 3px trên cùng, kẻ mảnh dưới. Mục đang chọn gạch chân lục 2px, không tô nền. |
| Đầu trang (`TieuDeTrang`, `PageHeader`, `.tra-cuu-tieu-de`) | Không khung, không nền; kẻ mảnh toàn chiều rộng và gạch đỏ son 56px ở mép trái (`site-theme.css`). |
| Tiêu đề mục (`.home-section-heading`, `LuoiLoiTat`) | Viết hoa, kẻ mực đậm 2px bên dưới, liên kết "Xem tất cả" màu lục. |
| Bảng | Đầu cột nền `--surface-2`, kẻ `--line-strong` dưới đầu cột; bảng rộng cuộn trong khung. |
| Chân trang | Nền lục đặc `--brand-luc`, viền vàng 3px, không họa tiết. |
| Trang chủ | Dải lục đặc `--brand-luc` (cùng màu chân trang, viền vàng 3px dưới), không ảnh, không gradient. Bố cục phần đầu công văn: trái là "dành cho…" và tên đơn vị với gạch vàng ngắn, phải là khẩu hiệu chữ vàng với nét vàng và dòng ngày in nghiêng; dưới là lời chào, mô tả, nút chính trắng và nút phụ viền trắng canh phải. Trên nền lục, nét ngắn dùng vàng thay đỏ son (đỏ son không đủ tương phản). Dưới 768px ẩn khẩu hiệu. |
| Làm bài (luyện tập `luyen-tap.phien`, thi `thi.luot`) | Thanh tiến độ chia ô từng câu (`ThanhTienDo`, tối đa 40 ô, dài hơn thì thanh liền). Nhãn "CÂU x / n" viết hoa. Đáp án dòng cao ≥ 56px, chữ cái A–D trong vòng 32px. Từ 1024px lưới câu luôn hiện ở cột phải; dưới đó mở bằng nút. Thi: thanh dính nền đặc ngay dưới header (`--cao-header`) gồm đồng hồ viền mảnh (5 phút cuối đỏ son), tên đề, nút nộp. |
| Phản hồi đúng/sai (`PhanHoi`, `PhanHoiCauTraLoi`) | Tách bằng kẻ mảnh, không thanh màu bên trái; màu chỉ ở dòng kết luận "Đúng." / "Chưa đúng."; căn cứ là liên kết gạch chân "Căn cứ: …". |
| Dấu kết luận (`.dau-cong-van`) | Viền đôi theo màu chữ, chữ hoa giãn rộng, không xuống dòng. Chỉ cho kết luận có giá trị như văn bản: "Đạt" / "Chưa đạt" / "Đang chờ chấm" của bài thi. |
| Tiêu đề trang dạng thường (`TieuDeTrang`) | Mọi trang nội dung có gạch đỏ son 56px dưới tiêu đề (trừ dạng `status` căn giữa và tiêu đề trong `PageHeader`). |
| Khối bài giảng (`KhoiNoiDung`) | Nhãn khối viết hoa (Căn cứ, Ghi nhớ, Lưu ý, Tự kiểm tra). "Lưu ý" viền đủ bốn cạnh, không thanh màu bên trái. Trích nguyên văn trong thẻ căn cứ dùng Noto Serif. "Dòng thời gian hiệu lực" (`dong_thoi_gian`): mốc xếp dọc trên đường kẻ, ngày dd/mm/yyyy in đậm, nhãn loại mốc bằng chữ, ghi chú chuyển tiếp cuối khối. |
| Khu quản trị (`.co-cot-trai`) | Cột trái nền trắng, mọi nhóm luôn mở (tên nhóm là tiêu đề tĩnh viết hoa, không gập), chỉ một dòng họ tên người dùng; mục đang chọn nền `--primary-soft` và vạch lục 3px bên trái; dưới 1024px là hàng cuộn ngang. Tiêu đề trang (`TieuDeTrang`, hoặc lớp `.dau-trang-quan-tri` cho trang dựng tay) cùng cỡ `--text-page`, ô biểu tượng 44px, gạch đỏ son 56px bên dưới; trong khung có lề trong thì đặt `--dau-le`. Tiêu đề mục viết hoa kẻ đậm. Ô số liệu viền `--line`, chữ số đều; bộ lọc nền phẳng, ô nhập viền `--line-strong`. Kiểu gom ở cuối `site-theme.css`, đè các chỉnh riêng từng trang trong `app.css`. |
| Kết quả (luyện tập, thi) | Khối điểm nền trắng có nhãn viết hoa; số liệu trên một hàng kẻ chia ba cột; danh sách câu xem lại là các dòng kẻ dưới tiêu đề mục viết hoa. |

Tái sử dụng Button, Field, Card, Badge, PageHeader, KhungTrang, KhungNoiDung, HopThoai, KhungCho, EmptyState. Không thêm bộ component cạnh tranh, không thêm thư viện.

## Trạng thái nội dung

| Trạng thái | Trigger / phản hồi / thao tác tiếp |
|---|---|
| Đang tải | Chuyển trang hoặc tra cứu; thanh tải, skeleton, aria-busy hiện có |
| Rỗng | Bộ lọc không khớp; thông báo rỗng có hướng dẫn sửa bộ lọc |
| Lỗi | Không tải được dữ liệu; thông báo nói rõ lỗi, có nút thử lại hoặc về trang chủ |
| Một phần | Dữ liệu nguồn chỉ có một phần; giữ cách xử lý hiện có, chưa kiểm thử đầy đủ |
| Thành công | Lưu hoặc hoàn thành; thông báo ngắn trung tính ("Đã lưu", "Hoàn thành") |
| Quyền | Trang cần đăng nhập chuyển tới `/dang-nhap?tiep=…` |

## Responsive và xác minh

Kích thước mục tiêu: 375, 390, 768, 1280, 1440px. Không có cuộn ngang ở cấp trang; bảng cuộn trong khung. Dưới 768px dùng thanh điều hướng dưới; từ 1280px hiện menu chính trên header.

Đợt 17/11/2026 đã chụp và kiểm ở 390px và 1280px các trang `/`, `/tra-cuu`, `/cong-cu`, `/dang-nhap`, một trang văn bản `/van-ban/...`: không tràn ngang. Cùng ngày đã kiểm `/luyen-tap`, một phiên luyện tập và trang kết quả, `/thi`, một lượt thi và trang kết quả bằng tài khoản mẫu `cax.05` trên dữ liệu dev: không tràn ngang. Đã kiểm khu quản trị bằng tài khoản `quantri`: `/quan-tri`, `nguoi-dung`, `bao-cao`, `giao-bai`, `de-thi`, `chuyen-de`, `cau-hoi`, `don-vi` ở 1280px và bốn trang ở 390px, không tràn ngang. Đã kiểm khu học tập bằng `cax.05`: `/hoc`, một chuyên đề, một bài học (chế độ đọc cuộn), `/nhom` ở 1280px và 390px, không tràn ngang. Chưa kiểm các trang sửa chi tiết trong quản trị (sửa đề, ma trận, sửa chuyên đề, sửa văn bản…), chế độ xem từng trang của bài học, trang chi tiết nhóm. Script cũ `scripts/kiem-tra-ui-cong-vu.cjs` vẫn dùng được với `UI_BASE_URL`.
