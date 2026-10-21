# PROMPT VẼ LẠI TOÀN BỘ BIỂU TƯỢNG (ICON)

*Soạn ngày 01/10/2026. Dùng cho phiên trợ lý lập trình (Claude Code) làm việc trong repo này. Mục tiêu: bộ biểu tượng sinh động, nổi bật hơn, nhưng vẫn giữ quy tắc của dự án (không emoji, không biểu trưng ngành, nghĩa không chỉ nằm ở màu).*

---

## 0. Cách dùng

1. **Mỗi prompt một phiên riêng.** Dán nguyên prompt ở mục 2, 3 hoặc 4 vào một phiên mới. Mỗi prompt tự trỏ về Phần chung (mục 1).
2. **Thứ tự làm:** Prompt 1 (bộ biểu tượng giao diện) → Prompt 2 (icon ứng dụng của trò chơi) → Prompt 3 (biểu tượng vẽ riêng trong trò chơi). Prompt 3 dùng các khóa mới mà Prompt 1 thêm vào `Icon.tsx`.
3. **Phụ lục A** là prompt cho công cụ sinh ảnh (Midjourney, Ideogram, DALL·E…), dùng khi muốn lấy ảnh mẫu để tham khảo trước khi vẽ lại bằng SVG. Không đưa ảnh raster sinh ra vào mã.

### Phạm vi

| Nhóm | Vị trí | Số lượng | Prompt |
|---|---|---|---|
| Bộ biểu tượng nét của giao diện | `apps/web/app/components/ui/Icon.tsx` | 52 khóa | 1 |
| Icon ứng dụng của trò chơi | `apps/web/app/assets/tro-choi/*.svg` | 15 có sẵn, 6 trò còn thiếu | 2 |
| Biểu tượng vẽ riêng trong trò chơi | `apps/web/app/components/tro-choi/**` | khoảng 25 hình, 1 emoji, các ký tự Unicode | 3 |

**Không thuộc phạm vi:**
- Logo "Khiên tri thức" (`apps/web/public/logo.svg`) và các icon PWA sinh từ logo (`scripts/pwa-icons.ts`). Logo là nhận diện thương hiệu, đổi phải có quyết định riêng.
- 31 biển báo giao thông ở `data/bien-bao/anh/`. Đây là nội dung theo quy chuẩn, phải giữ đúng hình biển thật.
- Bục ba hạng (`components/bang-xep-hang/BucBaHang.tsx`) cố ý không dùng huy chương. Giữ nguyên quyết định đó.

---

## 1. Phần chung (mọi prompt đều trỏ về đây)

> Mọi phiên vẽ lại biểu tượng phải đọc và theo đúng phần này.

**Tài liệu phải đọc trước khi làm:**
- [VISUAL_STYLE.md](VISUAL_STYLE.md) §1 (nguyên tắc chung) và §2.1 (hướng "Cảnh phục" đã chọn cho khu trò chơi).
- [QUY-TAC-HANH-VAN.md](../QUY-TAC-HANH-VAN.md) §3.4 (không emoji).
- `apps/web/app/styles/app.css` (token màu sáng và tối) và `apps/web/app/components/tro-choi/hieu-ung/tro-choi.css` (màu nhấn `--g-nhan`).

**Hướng hình ảnh: "Nét đậm, hai lớp màu".**
- **Lớp nét:** nét chính dày 2 (trước đây 1,75), đầu và góc nét bo tròn, màu `currentColor`. Lớp này một mình phải đủ nghĩa.
- **Lớp nền:** một mảng tô đặc nằm dưới nét, màu theo "sắc" của biểu tượng (bảng dưới), độ đậm khoảng 25% ở chế độ sáng và 35% ở chế độ tối. Mảng nền lệch nhẹ khỏi nét (1–1,5 đơn vị về phía dưới phải) để tạo cảm giác có khối.
- **Điểm nhấn (không bắt buộc):** một chi tiết nhỏ tô đặc màu nhấn, ví dụ ngọn lửa có lõi vàng, ngôi sao có vệt sáng, chuông có chấm báo. Mỗi biểu tượng tối đa một điểm nhấn.
- **Hình khối đơn giản, nhận ra ngay ở 16px.** Không vẽ chi tiết nhỏ hơn 1,5 đơn vị trên lưới 24. Không phối cảnh, không bóng đổ ngoài khung.
- **Đồng bộ:** cùng độ dày nét, cùng bán kính bo góc (2 đơn vị cho hình chữ nhật), cùng lề an toàn 2 đơn vị trên lưới 24×24.

**Bảng sắc màu.** Dùng lại token có sẵn. Hai sắc mới (`tim`, `ngoc`) phải thêm token sáng và tối vào `app.css`.

| Sắc | Màu sáng | Màu tối | Dùng cho nhóm nghĩa |
|---|---|---|---|
| `chinh` | `--color-primary` | `--color-primary` | Điều hướng, học, tài liệu |
| `vang` | `--g-nhan` | `--g-nhan` | Thành tích, điểm, xếp hạng |
| `cam` | `--color-warn` | `--color-warn` | Chuỗi ngày, cảnh báo, thời gian |
| `do` | `--color-seal` | `--color-seal` | Cấm, vi phạm, nguy hiểm |
| `luc` | `--color-ok` | `--color-ok` | Quy trình, an toàn, xác nhận |
| `tim` | mới, đề xuất `#6d3fc0` | mới, đề xuất `#c4a8ff` | Trợ lý AI, giọng nói, camera |
| `ngoc` | mới, đề xuất `#0f766e` | mới, đề xuất `#5eead4` | Tra cứu nhanh, tốc độ, đường |
| `trung` | `--color-ink-3` | `--color-ink-3` | Thao tác chung (đóng, mũi tên, menu) |

**Quy tắc cứng:**
1. **Không emoji, không ảnh raster** cho biểu tượng giao diện. Chỉ SVG nội tuyến hoặc tệp SVG.
2. **Không dùng biểu trưng ngành chính thức:** quân hiệu, cấp hiệu, phù hiệu, logo lực lượng, hình người mặc cảnh phục có chi tiết nhận dạng.
3. **Nghĩa không chỉ nằm ở màu.** Đúng/sai, cấm/cho phép phải phân biệt được bằng hình khi chuyển sang thang xám.
4. **Tương phản:** lớp nét đạt ≥ 3:1 với nền nó nằm trên (WCAG 2.1 tiêu chí 1.4.11), ở cả chế độ sáng và tối. Tính và ghi số đo vào báo cáo cuối phiên.
5. **Biểu tượng luôn `aria-hidden`.** Nghĩa nằm ở chữ hoặc `aria-label` của phần tử bao ngoài, như hiện nay.
6. **Giảm chuyển động:** hoạt ảnh của biểu tượng (nảy, lắc, xoay) phải tắt khi `prefers-reduced-motion: reduce`.
7. **Ngân sách:** `Icon.tsx` sau khi vẽ lại ≤ 9 KB gzip. Mỗi tệp icon trò chơi ≤ 4 KB chưa nén.
8. **Không đổi tên khóa hiện có.** Mọi chỗ gọi `<Icon name="…" />` phải chạy như cũ mà không cần sửa.

**Kiểm tra trước khi xong:**
- `bun run typecheck`, `bun run test` đạt.
- Chụp màn hình bằng `scripts/e2e` ở 360×740 cho: trang chủ, thanh điều hướng dưới (cả ngăn "Thêm"), `/tro-choi`, `/toi`, `/bang-xep-hang`, `/tra-cuu-nhanh`, một trang bài giảng. Chụp cả sáng và tối. Đặt ảnh trước/sau cạnh nhau trong báo cáo.
- Cập nhật [VISUAL_STYLE.md](VISUAL_STYLE.md): thêm mục "Bộ biểu tượng" ghi hướng hình ảnh, bảng sắc màu và số đo tương phản.

---

## 2. Prompt 1: Bộ biểu tượng giao diện (`Icon.tsx`)

```text
Vẽ lại toàn bộ bộ biểu tượng ở apps/web/app/components/ui/Icon.tsx theo hướng "Nét đậm, hai lớp màu".
Đọc và theo đúng docs/PROMPT_BO_ICON.md mục 1 (Phần chung) trước khi làm.

1. Đổi cấu trúc dữ liệu: mỗi khóa có { net: string; nen?: string; nhan?: string; sac: Sac }.
   - net: đường nét chính (stroke currentColor, strokeWidth 2).
   - nen: mảng tô đặc nằm dưới nét, tô bằng var(--ic-nen).
   - nhan: chi tiết điểm nhấn, tô bằng var(--ic-nhan).
   - sac: sắc mặc định của biểu tượng (bảng mục 2.1).
2. Giữ API cũ, thêm hai tham số tùy chọn:
   <Icon name className? sac? kieu? />
   - sac ghi đè sắc mặc định.
   - kieu = "hai-lop" (mặc định) | "net" (chỉ lớp nét, đơn sắc) | "dac" (nền tô đặc 100%, nét màu on-primary).
   Chỗ nào đang đặt màu bằng class text-* thì lớp nét vẫn theo class đó.
3. Thanh điều hướng dưới (BottomNav): mục đang chọn dùng kieu="dac", mục khác dùng kieu="net".
   Ngăn "Thêm" và các ô FeatureGrid, LuoiTraCuuNhanh, TheBaiHoc, TheSoLieu (toi.tsx) dùng "hai-lop".
   EmptyState dùng "hai-lop" với sắc trung.
4. Thêm token --color-tim, --color-ngoc (sáng và tối) vào app.css. Biến --ic-nen và --ic-nhan
   tính bằng color-mix từ sắc, đặt trong CSS, không viết màu cứng trong TSX.
5. Thêm các khóa mới để Prompt 3 dùng: check, x, chevronLeft, chevronRight, chevronUp, chevronDown,
   bolt, volumeOff, vibrate, vibrateOff, moto. Vẽ cùng phong cách.
6. Hoạt ảnh nhẹ, tắt khi giảm chuyển động: star nảy khi lên cấp (đã có, giữ), flame lay nhẹ khi
   chuỗi ngày đang giữ, bell lắc một lần khi có thông báo mới (nếu sau này dùng).
7. Làm một trang xem trước chỉ bật ở môi trường dev: lưới mọi biểu tượng ở 16, 20, 24, 40px,
   ba kiểu, sáng và tối, kèm tên khóa. Dùng trang này để chụp ảnh trước/sau.
8. Chạy phần "Kiểm tra trước khi xong" ở mục 1. Báo cáo: bảng số đo tương phản, ảnh trước/sau,
   kích thước gzip của Icon.tsx trước và sau.
```

### 2.1. Bảng biểu tượng: hình mới và sắc màu

Hình mới là gợi ý. Giữ ý nghĩa ở cột "Dùng ở đâu"; được vẽ khác nếu rõ nghĩa hơn ở 16px.

**Điều hướng và thao tác chung**

| Khóa | Dùng ở đâu | Hình mới | Sắc | Điểm nhấn |
|---|---|---|---|---|
| home | BottomNav "Trang chủ" | Ngôi nhà mái nhọn, cửa bo tròn | chinh | Cửa sổ nhỏ vàng |
| cap | BottomNav "Học", FeatureGrid "Học", mặc định của chuyên đề | Mũ tốt nghiệp nghiêng nhẹ, có tua | chinh | Tua vàng |
| steps | BottomNav "Thi", "Quy trình" | Bảng kẹp giấy, hai dòng có dấu tích | luc | Dấu tích |
| user | "Tôi", "Đăng nhập" | Bán thân tròn trong khung tròn | chinh | — |
| menu | Nút "Thêm", mục lục | Ba vạch, vạch giữa ngắn hơn | trung | — |
| close | Đóng hộp thoại, ngăn kéo | Dấu X nét đậm | trung | — |
| arrowLeft / arrowRight / arrowUp | Quay lại, chuyển trang, lên đầu trang, tăng hạng | Mũi tên có đầu tam giác đặc | trung | — |
| search | Tra cứu, ô tìm kiếm | Kính lúp, mặt kính tô nền | ngoc | Vệt sáng trên mặt kính |
| layers | "Quản trị", mặc định của EmptyState | Ba lớp xếp chồng, lớp trên tô nền | chinh | — |
| help | "Hướng dẫn sử dụng" | Dấu hỏi trong vòng tròn | chinh | — |
| logout | "Đăng xuất" | Cửa mở, mũi tên ra ngoài | do | — |
| copy | Sao chép trích dẫn, link mời | Hai tờ giấy lệch nhau | chinh | — |
| sun / moon / monitor | Đổi giao diện sáng/tối/hệ thống | Mặt trời có tia, trăng khuyết có sao nhỏ, màn hình | vang / tim / trung | Lõi mặt trời, ngôi sao |

**Học, tài liệu, trợ lý**

| Khóa | Dùng ở đâu | Hình mới | Sắc | Điểm nhấn |
|---|---|---|---|---|
| book | Bài giảng, căn cứ pháp lý, mặc định của bài | Sách mở, hai trang cong | chinh | Dải đánh dấu đỏ |
| chat | "Hỏi trợ lý AI", bài ứng xử | Bong bóng thoại có ba chấm | tim | Tia lấp lánh nhỏ ở góc |
| scale | Bài về luật, tình tiết | Cân hai đĩa cân bằng | chinh | Trục vàng |
| file | Biên bản, hồ sơ, quyết định | Tờ giấy gấp góc, hai dòng chữ | chinh | Góc gấp |
| list | Câu sai cần luyện, danh sách | Ba dòng có chấm đầu dòng | chinh | — |
| calendar | Ngày áp dụng, thời hạn | Tờ lịch có hai khuyên | cam | Ô ngày tô đậm |
| chart | Thống kê, báo cáo | Ba cột tăng dần | ngoc | Cột cao nhất |
| bell | Bài tiếp nhận | Chuông | cam | Chấm báo đỏ |
| idCard | Giấy phép, GPLX | Thẻ có ảnh và hai dòng | chinh | — |
| nhom | "Nhóm học cùng" | Hai người, người trước to hơn | chinh | — |
| coVu | Nút "Cổ vũ" | Bàn tay giơ lên, ba vạch tỏa | vang | Vạch tỏa |

**Thành tích và tiến độ**

| Khóa | Dùng ở đâu | Hình mới | Sắc | Điểm nhấn |
|---|---|---|---|---|
| star | XP, "Đánh giá", mục tiêu | Ngôi sao năm cánh bo góc | vang | Vệt sáng |
| trophy | Bảng xếp hạng, huy hiệu, "Chơi nhanh" | Cúp hai quai, đế hai bậc | vang | Ngôi sao nhỏ trên thân cúp |
| flame | Chuỗi ngày | Ngọn lửa hai tầng | cam | Lõi lửa vàng |
| gauge | Tốc độ, tỷ lệ đúng | Đồng hồ nửa vòng, kim | ngoc | Đầu kim |
| timer | Đua thời gian 60 giây | Đồng hồ bấm giờ có núm | cam | Cung thời gian đã chạy |
| lock | Huy hiệu chưa đạt, màn khóa | Ổ khóa thân bo tròn | trung | Lỗ khóa |
| puzzle | Mặc định của trò chơi | Mảnh ghép có hai núm | tim | — |

**Giao thông và nghiệp vụ**

| Khóa | Dùng ở đâu | Hình mới | Sắc | Điểm nhấn |
|---|---|---|---|---|
| sign | Biển báo, "Đoán biển báo" | Tam giác cảnh báo có dấu chấm than | vang | Viền đỏ trong |
| banknote | Mức phạt | Tờ tiền có vòng tròn giữa | luc | Vòng tròn giữa |
| car | Xe cơ giới, phương tiện | Ô tô nhìn nghiêng, hai bánh | chinh | Đèn pha vàng |
| truck | Vận tải | Xe tải đầu kéo, thùng hàng | cam | — |
| moto (mới) | Thay emoji 🛵 ở DungXe | Xe máy nhìn nghiêng | chinh | Đèn pha vàng |
| camera | Phạt nguội, thiết bị | Máy ảnh có ống kính tròn | tim | Đèn ghi đỏ |
| shield | Thẩm quyền, tuần tra | Khiên có dấu tích, không có ngôi sao hay chữ | luc | Dấu tích |
| ban | Nồng độ cồn, vi phạm | Vòng tròn có vạch chéo | do | — |
| alert | Tai nạn | Dấu chấm than trong vòng tròn | do | — |
| road | Cao tốc | Con đường phối cảnh, vạch giữa đứt | ngoc | Vạch giữa vàng |
| turn | Chuyển hướng, vượt | Mũi tên rẽ cong | ngoc | — |
| trafficLight | Điều khiển giao thông | Cột đèn ba ô | trung | Ba đèn đỏ, vàng, xanh (vẫn phân biệt được bằng vị trí) |

**Giọng nói và phát âm thanh**

| Khóa | Dùng ở đâu | Hình mới | Sắc | Điểm nhấn |
|---|---|---|---|---|
| mic | Nhập bằng giọng nói | Micro có chân | tim | Chấm đỏ khi đang nghe |
| loa | Đọc to câu hỏi | Loa có hai sóng | tim | — |
| play / pause | Trình phát sách nói | Tam giác bo góc / hai thanh bo tròn | tim | — |
| doan-truoc / doan-sau | Đoạn trước / đoạn sau | Tam giác kèm vạch | tim | — |

---

## 3. Prompt 2: Icon ứng dụng của trò chơi

```text
Vẽ lại 15 icon ứng dụng ở apps/web/app/assets/tro-choi/*.svg và vẽ mới icon cho các trò còn thiếu.
Đọc và theo đúng docs/PROMPT_BO_ICON.md mục 1 (Phần chung) và mục 3 trước khi làm.

1. Lấy danh sách trò đầy đủ từ các câu INSERT INTO games trong packages/db/migrations/*.sql.
   Đối chiếu với tệp có trong assets/tro-choi. Trò nào chưa có tệp thì vẽ mới (tối thiểu 6 trò
   ở bảng 3.2; nếu migration có thêm trò thì vẽ luôn).
2. Khung chung cho mọi icon (bảng 3.1). Giữ khung 128×128, ô bo góc 112×112 rx=28, để
   lib/anh-tro-choi.ts và BieuTuongTro không phải sửa.
3. Vẽ theo bảng 3.2. Mỗi icon có đúng một vật chính, nhận ra được ở 36px (cỡ nhỏ nhất đang dùng
   trong lịch sử chơi).
4. Sau khi có đủ icon, bỏ nhánh dự phòng bằng Icon stroke ở lib/trang-chu.ts (TRO_CHOI_CU) và
   tro-choi._index.tsx nếu không còn trò nào thiếu tệp. Giữ dự phòng puzzle cho trò mới sau này.
5. Kiểm tra: xem lưới 21 icon cạnh nhau ở 36, 48, 64px trên nền sáng và tối. Mọi icon phải cùng
   độ sáng tổng thể, không icon nào nổi hẳn hay chìm hẳn so với icon khác.
6. Chạy phần "Kiểm tra trước khi xong" ở mục 1. Báo cáo kích thước từng tệp trước và sau.
```

### 3.1. Khung chung

- **Nền:** chuyển màu chéo từ góc trên trái (sáng) xuống góc dưới phải (đậm), theo nhóm màu ở bảng 3.2. Thêm một vệt sáng trắng 12% hình elip ở nửa trên, tạo cảm giác bóng như kính.
- **Họa tiết nền:** vạch kẻ đường chéo mảnh, trắng 8%, như VISUAL_STYLE §2.1. Không dùng họa tiết khác.
- **Vật chính:** chiếm khoảng 60% ô, đặt lệch lên trên 4 đơn vị. Tô bằng chuyển màu dọc 2 bước (sáng trên, đậm dưới), viền tối 3 đơn vị cùng tông màu nền, có bóng đổ mềm ngay dưới vật (đen 20%, lệch 4, mờ 6).
- **Huy hiệu góc (không bắt buộc):** hình tròn 28 đơn vị ở góc dưới phải, nền vàng `--g-nhan`, chứa một ký hiệu đơn giản (dấu tích, tia chớp, dấu cộng, kính lúp).
- **Ánh sáng thống nhất:** nguồn sáng luôn từ trên trái. Mọi vệt sáng nằm ở cạnh trên trái của vật.
- **Màu nhấn dùng chung:** vàng `#FBBF24`, đỏ `#EF4444`, trắng `#FFFFFF`, xanh lơ `#22D3EE`.

### 3.2. Danh sách icon

| Mã trò | Tên | Nhóm màu nền | Vật chính | Huy hiệu góc |
|---|---|---|---|---|
| cam_bien | Cắm biển cho tuyến đường | Lục `#34D399→#047857` | Cột biển báo tròn đỏ cắm xuống nền đất, có vết đất bắn | Dấu cộng |
| cung_duong_bien_bao | Cung đường biển báo | Lục | Đường cong chữ S nhìn từ trên cao, vạch vàng, biển tam giác bên đường | — |
| thu_nghiem | Trắc nghiệm nhanh | Lục | Tờ phiếu, hai ô có dấu tích | Tia chớp |
| dung_xe | Dừng xe đúng quy trình | Lam `#60A5FA→#1D4ED8` | Ô tô nhìn thẳng, đèn pha sáng, gậy chỉ huy sọc đỏ trắng chắn ngang | — |
| kiem_tra_giay_to | Kiểm tra giấy tờ | Lam | Thẻ giấy phép lái xe giản lược, chữ "MẪU" | Kính lúp |
| lap_bien_ban | Lập biên bản | Lam | Bảng kẹp giấy và bút đang ký | — |
| sung_ban_toc_do | Súng bắn tốc độ | Lam | Súng đo tốc độ, màn hình số xanh, sóng vàng tỏa ra | — |
| duyet_phat_nguoi | Duyệt hồ sơ phạt nguội | Tím `#A78BFA→#6D28D9` | Khung hình camera có ô tô, bốn góc ngắm xanh lơ | Dấu tích |
| soi_camera | Soi camera | Tím | Camera giám sát trên cột, tia quét xanh lơ hình nón | — |
| truy_vet | Truy vết xe bỏ trốn (mới) | Tím | Bản đồ gấp, đường đi đứt nét, ghim vị trí đỏ | Kính lúp |
| tai_dung_hien_truong | Tái dựng hiện trường (mới) | Tím | Sơ đồ ngã tư nhìn từ trên, hai xe, mũi tên hướng đi | — |
| len_xe_khach | Lên xe khách | Cam `#FB923C→#C2410C` | Xe khách trắng cửa mở, hàng ghế qua cửa sổ | Dấu tích |
| soi_xe_cai_tao | Soi xe cải tạo | Cam | Xe nâng gầm bánh to, cờ lê | Kính lúp |
| tram_can | Trạm cân tải trọng | Cam | Xe tải trên bàn cân, đồng hồ cân kim đỏ | — |
| tu_lai | Tự lái qua phố | Cam | Vô lăng trước dãy nhà phố | — |
| vuot_man | Vượt màn | Vàng `#FCD34D→#D97706` | Ba bậc thang, cờ đỏ trên đỉnh, sao trắng | — |
| dua_thoi_gian | Đua thời gian 60 giây (mới) | Vàng | Đồng hồ bấm giờ, cung đỏ chạy gần hết vòng | Tia chớp |
| doan_bien_bao | Đoán biển báo (mới) | Đỏ `#F87171→#B91C1C` | Biển tam giác vàng viền đỏ, dấu hỏi lớn ở giữa | — |
| ghep_cap | Ghép lỗi với mức phạt (mới) | Đỏ | Hai mảnh ghép khớp nhau, một mảnh có biển cấm, một mảnh có tờ tiền | — |
| hoi_nhanh_giong_noi | Hỏi nhanh bằng giọng nói (mới) | Hồng `#F472B6→#BE185D` | Micro, ba sóng âm hai bên | — |
| chot_dem | Dựng chốt an toàn ban đêm | Đêm `#1E3A8A→#0F172A` | Rào phản quang sọc, nón cam, trăng khuyết vàng, đèn quay đỏ phát sáng | — |

---

## 4. Prompt 3: Biểu tượng vẽ riêng trong trò chơi

```text
Thống nhất các biểu tượng vẽ riêng trong apps/web/app/components/tro-choi/** theo bộ biểu tượng
mới ở Icon.tsx (Prompt 1 đã làm xong). Đọc docs/PROMPT_BO_ICON.md mục 1 và mục 4 trước khi làm.

1. Bỏ emoji: DungXe.tsx dòng có {moTo ? "🛵" : "🚗"} thay bằng <Icon name={moTo ? "moto" : "car"} />
   hoặc hình SVG xe nhìn từ trên xuống nếu cảnh cần góc nhìn đó. Sau khi sửa, grep toàn bộ
   apps/web/app để chắc chắn không còn emoji nào.
2. Thay ký tự Unicode đang dùng làm biểu tượng bằng Icon (bảng 4.1). Ký tự nằm trong câu chữ
   bình thường thì giữ.
3. Vẽ lại các hình ở bảng 4.2 theo khung chung mục 1: nét 2–3, hai lớp màu, dùng token của
   khu trò chơi (--g-nhan, màu đúng/sai của VISUAL_STYLE §2.1).
4. Những gì là "vật trong cảnh" (xe, người, biển P.127, bàn cân, camera trong DuyetPhatNguoi,
   bóng người trong DungXe) giữ nét 5 hiện có, chỉ thêm lớp nền tô và vệt sáng cho có khối.
   Không vẽ quân phục, quân hiệu, cấp hiệu.
5. Kết quả đúng/sai (PhanHoiBuoc, MauBienBan, DanhSachLoi) giữ nguyên chữ "Đúng"/"Chưa đúng" bên
   cạnh biểu tượng. Dấu tích và dấu chéo phải khác nhau rõ ở thang xám.
6. Chạy phần "Kiểm tra trước khi xong" ở mục 1. Chụp thêm màn chơi của từng trò có sửa.
```

### 4.1. Ký tự Unicode cần thay

| Ký tự | Nghĩa | Thay bằng |
|---|---|---|
| ✓ | Đúng | `check` |
| ✗ ✕ × | Sai, xóa | `x` |
| ◀ ▶ ◀◀ | Lùi, tới, tua về | `chevronLeft`, `chevronRight`, `doan-truoc` |
| ▲ ▼ | Lên, xuống | `chevronUp`, `chevronDown` |
| ⇦ ⇨ ↔ ↕ | Hướng kéo, hướng di chuyển | `arrowLeft`, `arrowRight` (xoay bằng CSS) |
| ↑↗→↘↓↙←↖ (`lib/tai-dung.ts`) | Tám hướng đi | Một khóa `arrowUp` xoay theo bội số 45°; giữ ký tự trong dữ liệu, chỉ đổi cách hiển thị |
| ▪ ▭ ■ – | Chú giải bản đồ | Ô vuông SVG tô màu thật của lớp bản đồ |

Tệp có ký tự cần xem: CamBien, ChotDem, DuongChay, DungXe, TuLai, TruyVet, SoiCamera, TaiDung, SoiXeCaiTao, SoDoKhoangXe, NutLai, DuyetPhatNguoi, TramCan, KiemTraGiayTo, chung/DanhSachLoi.

### 4.2. Hình vẽ riêng cần làm lại

| Tệp | Hình | Hướng vẽ lại |
|---|---|---|
| `NutPhanUng.tsx` (`HINH`) | giam_toc, dung_lai, khong_vao, di_tiep | Nút tròn lớn, nền tô đặc theo nghĩa (cam, đỏ, đỏ, lục), hình trắng nét 2,4, có viền sáng trên. Mỗi nút một hình khác hẳn nhau để nhận ra khi không nhìn màu |
| `hieu-ung/NhanCombo.tsx` | Tia chớp "Chuỗi N" | Dùng `bolt`, tô vàng `--g-nhan`, viền đậm, hiệu ứng lóe khi tăng chuỗi |
| `hieu-ung/DauMan.tsx` | Tam giác "Bắt đầu" | Dùng `play` kiểu `dac`, nền vòng tròn có vầng sáng |
| `hieu-ung/LopChucMung.tsx` | Khiên có dấu tích | Dùng `shield` kiểu `dac` màu đúng, tỏa tia vàng |
| `hieu-ung/SaoTongKet.tsx` | 1–3 sao kết quả | Sao bo góc, chuyển màu vàng hai bước, vệt sáng; sao chưa đạt chỉ có viền, nền `surface-2` |
| `NutCaiDatGame.tsx` | Bật/tắt âm thanh, rung | Dùng `loa`, `volumeOff`, `vibrate`, `vibrateOff` |
| `chung/ChonMan.tsx`, `BanDoMan` | Màn khóa | Dùng `lock` |
| `chung/ChiTietKetQua.tsx` | Mở rộng/thu gọn | Dùng `chevronDown`/`chevronUp` |
| `PhanHoiBuoc.tsx` (`DauKetQua`) | Tích/chéo động trong vòng tròn | Giữ hoạt ảnh vẽ nét, thêm nền tô màu đúng/sai 20%, viền 3 |
| `DuongChay.tsx` (`VoLang`) | Mạng chơi hình vô lăng | Vô lăng tô đặc khi còn, chỉ viền khi mất |
| `DongHoBuoc.tsx` | Vòng đếm ngược | Giữ, đổi màu cung từ vàng sang đỏ ở 5 giây cuối như VISUAL_STYLE |

---

## Phụ lục A. Prompt cho công cụ sinh ảnh

Dùng để lấy ảnh mẫu tham khảo cho Prompt 2. Viết bằng tiếng Anh vì các công cụ này hiểu tiếng Anh tốt hơn. Ảnh sinh ra chỉ để tham khảo bố cục và màu. Icon thật vẫn vẽ lại bằng SVG.

**Phần phong cách dùng chung** (đặt trước mỗi chủ thể):

```text
Mobile game app icon, rounded square, 1024x1024, vibrant diagonal gradient background with subtle
diagonal road-stripe pattern, glossy highlight on the top half, one bold central object in flat
vector style with soft two-tone shading, thick dark outline, soft drop shadow under the object,
light source from top-left, clean, high contrast, readable at small size, professional and modern,
no text, no letters, no emoji, no police insignia, no badges or uniforms, no human faces
```

**Chủ thể cho từng trò** (nối sau phần phong cách):

| Mã trò | Chủ thể |
|---|---|
| cam_bien | `green gradient, a red round traffic sign on a pole being planted into the ground, small dirt splash, yellow plus badge in the corner` |
| cung_duong_bien_bao | `green gradient, top-down S-shaped road with yellow dashed centre line, yellow triangle warning sign beside the road` |
| thu_nghiem | `green gradient, a checklist sheet with two ticked boxes, yellow lightning bolt badge in the corner` |
| dung_xe | `blue gradient, front view of a car with glowing headlights, a red-and-white striped traffic baton across the front` |
| kiem_tra_giay_to | `blue gradient, a simplified driving licence card with a blank photo square, yellow magnifying glass badge` |
| lap_bien_ban | `blue gradient, a clipboard with lined paper and a pen signing` |
| sung_ban_toc_do | `blue gradient, a handheld radar speed gun with a green digital screen, yellow radar waves` |
| duyet_phat_nguoi | `violet gradient, a camera viewfinder frame with a car inside, cyan corner brackets, cyan check badge` |
| soi_camera | `violet gradient, a CCTV camera on a pole projecting a cyan scanning cone` |
| truy_vet | `violet gradient, a folded city map with a dashed route line and a red location pin, magnifying glass badge` |
| tai_dung_hien_truong | `violet gradient, top-down intersection diagram with two small cars and direction arrows` |
| len_xe_khach | `orange gradient, a white coach bus with the door open and rows of seats visible through windows, check badge` |
| soi_xe_cai_tao | `orange gradient, a lifted car with oversized wheels, a wrench, magnifying glass badge` |
| tram_can | `orange gradient, a truck on a weighbridge platform, a round scale dial with a red needle` |
| tu_lai | `orange gradient, a white steering wheel in front of a city skyline` |
| vuot_man | `amber gradient, three-step stairs with a red flag on top, white stars` |
| dua_thoi_gian | `amber gradient, a stopwatch with a red arc almost completing the circle, lightning bolt badge` |
| doan_bien_bao | `red gradient, a yellow triangle warning sign with red border and a big question mark in the middle` |
| ghep_cap | `red gradient, two interlocking puzzle pieces, one showing a prohibition sign, one showing a banknote` |
| hoi_nhanh_giong_noi | `pink gradient, a microphone with sound waves on both sides` |
| chot_dem | `deep navy night gradient, striped reflective road barrier, orange traffic cone, yellow crescent moon, glowing red beacon` |

**Mẫu cho bộ biểu tượng giao diện** (nếu muốn xem trước hướng "hai lớp màu"):

```text
Icon set, 24x24 grid, 2px rounded stroke in dark navy, each icon has a soft tinted fill shape
slightly offset behind the outline (duotone), one small accent detail in a brighter colour,
consistent corner radius, flat, no gradients, no text, white background, arranged in a grid:
house, graduation cap, clipboard with checks, person, magnifying glass, open book, speech bubble
with sparkle, balance scale, trophy, star, flame, speedometer, stopwatch, padlock, puzzle piece,
warning triangle, banknote, car, truck, motorbike, camera, shield with check, prohibition circle,
road, traffic light, microphone, speaker, calendar, bar chart, two people, raised hand
```
