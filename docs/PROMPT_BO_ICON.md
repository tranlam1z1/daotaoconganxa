# PROMPT VẼ LẠI TOÀN BỘ BIỂU TƯỢNG (ICON)

*Soạn ngày 01/10/2026. Dùng cho phiên trợ lý lập trình (Claude Code) làm việc trong repo này. Mục tiêu: bộ biểu tượng sinh động, nổi bật hơn, nhưng vẫn giữ quy tắc của dự án (không emoji, không biểu trưng ngành, nghĩa không chỉ nằm ở màu).*

---

## 0. Cách dùng

1. **Mỗi prompt một phiên riêng.** Dán nguyên prompt ở mục 2 vào một phiên mới. Prompt tự trỏ về Phần chung (mục 1).

### Phạm vi

| Nhóm | Vị trí | Số lượng | Prompt |
|---|---|---|---|
| Bộ biểu tượng nét của giao diện | `apps/web/app/components/ui/Icon.tsx` | 107 khóa | 1 |

**Không thuộc phạm vi:**
- Logo "Khiên tri thức" (`apps/web/public/logo.svg`) và các icon PWA sinh từ logo (`scripts/pwa-icons.ts`). Logo là nhận diện thương hiệu, đổi phải có quyết định riêng.
- 31 biển báo giao thông ở `data/bien-bao/anh/`. Đây là nội dung theo quy chuẩn, phải giữ đúng hình biển thật.

---

## 1. Phần chung

> Mọi phiên vẽ lại biểu tượng phải đọc và theo đúng phần này.

**Tài liệu phải đọc trước khi làm:**
- [VISUAL_STYLE.md](VISUAL_STYLE.md) §1 (nguyên tắc chung) và §4 (bộ biểu tượng: hướng hình ảnh, bảng sắc màu, số đo tương phản).
- [QUY-TAC-HANH-VAN.md](../QUY-TAC-HANH-VAN.md) §3.4 (không emoji).
- `apps/web/app/styles/app.css` (token màu sáng và tối).

**Hướng hình ảnh: "Nét đậm, hai lớp màu".**
- **Lớp nét:** nét chính dày 2 (trước đây 1,75), đầu và góc nét bo tròn, màu `currentColor`. Lớp này một mình phải đủ nghĩa.
- **Lớp nền:** một mảng tô đặc nằm dưới nét, màu theo "sắc" của biểu tượng (bảng dưới), độ đậm khoảng 25% ở chế độ sáng và 35% ở chế độ tối. Mảng nền lệch nhẹ khỏi nét (1–1,5 đơn vị về phía dưới phải) để tạo cảm giác có khối.
- **Điểm nhấn (không bắt buộc):** một chi tiết nhỏ tô đặc màu nhấn, ví dụ cửa sổ vàng của ngôi nhà, dải đỏ của sách, chấm báo của chuông. Mỗi biểu tượng tối đa một điểm nhấn.
- **Hình khối đơn giản, nhận ra ngay ở 16px.** Không vẽ chi tiết nhỏ hơn 1,5 đơn vị trên lưới 24. Không phối cảnh, không bóng đổ ngoài khung.
- **Đồng bộ:** cùng độ dày nét, cùng bán kính bo góc (2 đơn vị cho hình chữ nhật), cùng lề an toàn 2 đơn vị trên lưới 24×24.

**Bảng sắc màu.** Dùng lại token có sẵn. Hai sắc `tim`, `ngoc` khai cả sáng và tối trong `app.css`.

| Sắc | Màu sáng | Màu tối | Dùng cho nhóm nghĩa |
|---|---|---|---|
| `chinh` | `--color-primary` | `--color-primary` | Điều hướng, học, tài liệu |
| `vang` | `--g-nhan` | `--g-nhan` | Điểm thi, số liệu nổi bật, xác nhận |
| `cam` | `--color-warn` | `--color-warn` | Cảnh báo, thời gian, nhắc học |
| `do` | `--color-seal` | `--color-seal` | Cấm, vi phạm, nguy hiểm |
| `luc` | `--color-ok` | `--color-ok` | Quy trình, an toàn, xác nhận |
| `tim` | mới, đề xuất `#6d3fc0` | mới, đề xuất `#c4a8ff` | Trợ lý AI, giọng nói |
| `ngoc` | mới, đề xuất `#0f766e` | mới, đề xuất `#5eead4` | Tra cứu nhanh, tốc độ, đường |
| `trung` | `--color-ink-3` | `--color-ink-3` | Thao tác chung (đóng, mũi tên, menu) |

**Quy tắc cứng:**
1. **Không emoji, không ảnh raster** cho biểu tượng giao diện. Chỉ SVG nội tuyến hoặc tệp SVG.
2. **Không dùng biểu trưng ngành chính thức:** quân hiệu, cấp hiệu, phù hiệu, logo lực lượng, hình người mặc trang phục lực lượng có chi tiết nhận dạng.
3. **Nghĩa không chỉ nằm ở màu.** Đúng/sai, cấm/cho phép phải phân biệt được bằng hình khi chuyển sang thang xám.
4. **Tương phản:** lớp nét đạt ≥ 3:1 với nền nó nằm trên (WCAG 2.1 tiêu chí 1.4.11), ở cả chế độ sáng và tối. Tính và ghi số đo vào báo cáo cuối phiên.
5. **Biểu tượng luôn `aria-hidden`.** Nghĩa nằm ở chữ hoặc `aria-label` của phần tử bao ngoài, như hiện nay.
6. **Giảm chuyển động:** hoạt ảnh của biểu tượng (nảy, lắc, xoay) phải tắt khi `prefers-reduced-motion: reduce`.
7. **Ngân sách:** `Icon.tsx` sau khi vẽ lại ≤ 9 KB gzip.
8. **Không đổi tên khóa hiện có.** Mọi chỗ gọi `<Icon name="…" />` phải chạy như cũ mà không cần sửa.

**Kiểm tra trước khi xong:**
- `bun run typecheck`, `bun run test` đạt.
- Chụp màn hình bằng `scripts/e2e` ở 360×740 cho: trang chủ, thanh điều hướng dưới (cả ngăn "Thêm"), `/toi`, `/luyen-tap`, `/tra-cuu-nhanh`, một trang bài giảng. Chụp cả sáng và tối. Đặt ảnh trước/sau cạnh nhau trong báo cáo.
- Cập nhật mục "Bộ biểu tượng" ở [VISUAL_STYLE.md](VISUAL_STYLE.md) §4: hướng hình ảnh, bảng sắc màu và số đo tương phản.

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
   Ngăn "Thêm" và các ô lưới lối tắt (LuoiLoiTat), lưới tra cứu nhanh (LuoiTraCuuNhanh), thẻ bài học
   (TheBaiHoc) và thẻ số liệu ở /toi dùng "hai-lop".
   EmptyState dùng "hai-lop" với sắc trung.
4. Khai token --color-tim, --color-ngoc (sáng và tối) trong app.css. Biến --ic-nen và --ic-nhan
   tính bằng color-mix từ sắc, đặt trong CSS, không viết màu cứng trong TSX.
5. Giữ các khóa đã có và vẽ cùng phong cách: check, x, chevronLeft, chevronRight, chevronUp,
   chevronDown, bolt, volumeOff, vibrate, vibrateOff, moto, clock, map, ghim.
6. Hoạt ảnh nhẹ, tắt khi giảm chuyển động: bell lắc một lần khi có thông báo mới (nếu sau này dùng).
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
| cap | BottomNav "Học", lối tắt "Bài giảng", mặc định của chuyên đề | Mũ tốt nghiệp nghiêng nhẹ, có tua | chinh | Tua vàng |
| steps | BottomNav "Thi", "Quy trình" | Bảng kẹp giấy, hai dòng có dấu tích | luc | Dấu tích |
| user | "Tôi", "Đăng nhập" | Bán thân tròn trong khung tròn | chinh | — |
| menu | Nút "Thêm", mục lục | Ba vạch, vạch giữa ngắn hơn | trung | — |
| close | Đóng hộp thoại, ngăn kéo | Dấu X nét đậm | trung | — |
| arrowLeft / arrowRight / arrowUp | Quay lại, chuyển trang, lên đầu trang | Mũi tên có đầu tam giác đặc | trung | — |
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
| scale | Bài về luật, tính % quá tải | Cân hai đĩa cân bằng | chinh | Trục vàng |
| file | Biên bản, hồ sơ, quyết định, biểu mẫu | Tờ giấy gấp góc, hai dòng chữ | chinh | Góc gấp |
| list | Câu sai cần luyện, danh sách | Ba dòng có chấm đầu dòng | chinh | — |
| calendar | Ngày áp dụng, thời hạn, lịch sử luyện tập | Tờ lịch có hai khuyên | cam | Ô ngày tô đậm |
| chart | Thống kê, báo cáo | Ba cột tăng dần | ngoc | Cột cao nhất |
| bell | Bài tiếp nhận | Chuông | cam | Chấm báo đỏ |
| idCard | Giấy phép, GPLX, xác định tuổi | Thẻ có ảnh và hai dòng | chinh | — |
| nhom | "Nhóm học cùng" | Hai người, người trước to hơn | chinh | — |
| coVu | Nút "Cổ vũ" | Bàn tay giơ lên, ba vạch tỏa | vang | Vạch tỏa |

**Kết quả và tiến độ**

| Khóa | Dùng ở đâu | Hình mới | Sắc | Điểm nhấn |
|---|---|---|---|---|
| star | Xác minh cán bộ, "Đánh giá" | Ngôi sao năm cánh bo góc | vang | Vệt sáng |
| trophy | Hồ sơ chủ đề (thống kê theo chuyên đề) | Cúp hai quai, đế hai bậc | vang | Ngôi sao nhỏ trên thân CUP |
| gauge | Tỷ lệ đúng, tốc độ, khoảng cách | Đồng hồ nửa vòng, kim | ngoc | Đầu kim |
| timer | Thời gian chờ (định vị, lịch sử) | Đồng hồ bấm giờ có núm | cam | Cung thời gian đã chạy |
| clock | Giờ trong ngày | Đồng hồ tròn có hai kim | cam | — |
| lock | Mật khẩu, trạng thái khoá | Ổ khóa thân bo tròn | trung | Lỗ khóa |

**Giao thông và nghiệp vụ**

| Khóa | Dùng ở đâu | Hình mới | Sắc | Điểm nhấn |
|---|---|---|---|---|
| sign | Biển báo, "Tra cứu biển báo" | Tam giác cảnh báo có dấu chấm than | vang | Viền đỏ trong |
| banknote | Mức phạt | Tờ tiền có vòng tròn giữa | luc | Vòng tròn giữa |
| car | Xe cơ giới, phương tiện | Ô tô nhìn nghiêng, hai bánh | chinh | Đèn pha vàng |
| truck | Vận tải, cơi nới thùng xe | Xe tải đầu kéo, thùng hàng | cam | — |
| moto | Xe máy, chip loại xe ở ô "Tra cứu vi phạm" | Xe máy nhìn nghiêng | chinh | Đèn pha vàng |
| camera | Phạt nguội, thiết bị, đo đạc điện tử | Máy ảnh có ống kính tròn | tim | Đèn ghi đỏ |
| shield | Thẩm quyền, tuần tra, "Bộ công cụ nghiệp vụ" | Khiên có dấu tích, không có ngôi sao hay chữ | luc | Dấu tích |
| ban | Nồng độ cồn, vi phạm | Vòng tròn có vạch chéo | do | — |
| alert | Tai nạn, mức xử phạt nồng độ cồn | Dấu chấm than trong vòng tròn | do | — |
| road | Cao tốc | Con đường phối cảnh, vạch giữa đứt | ngoc | Vạch giữa vàng |
| turn | Chuyển hướng, vượt | Mũi tên rẽ cong | ngoc | — |
| trafficLight | Điều khiển giao thông | Cột đèn ba ô | trung | Ba đèn đỏ, vàng, xanh (vẫn phân biệt được bằng vị trí) |
| puzzle | Trang thiết bị phương tiện (tra cứu nhanh) | Mảnh ghép có cạnh lõm | tim | — |
| map | Chuyển đổi địa giới hành chính | Bản đồ gấp có đường nối | ngoc | Ghim địa điểm |
| ghim | Vị trí trên bản đồ | Ghim bản đồ có đầu nhọn | do | Chấm tròn trung tâm |

**Giọng nói và phát âm thanh**

| Khóa | Dùng ở đâu | Hình mới | Sắc | Điểm nhấn |
|---|---|---|---|---|
| mic | Nhập bằng giọng nói | Micro có chân | tim | Chấm đỏ khi đang nghe |
| loa | Đọc to câu hỏi | Loa có hai sóng | tim | — |
| play / pause | Trình phát sách nói | Tam giác bo góc / hai thanh bo tròn | tim | — |
| doan-truoc / doan-sau | Đoạn trước / đoạn sau | Tam giác kèm vạch | tim | — |
