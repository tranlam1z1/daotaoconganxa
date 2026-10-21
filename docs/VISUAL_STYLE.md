# PHONG CÁCH HÌNH ẢNH CHO TRÒ CHƠI

*Đề xuất cho các trò chơi ở [GAME_DESIGN.md](GAME_DESIGN.md). Lập ngày 25/9/2026. **Đã chọn hướng A "Cảnh phục"; V2–V6 theo đề xuất (§8). Bước 2 đã triển khai ngày 25/9/2026, kết quả đo ở §9.***

---

## 0. Tóm tắt

1. **Chỉ khu trò chơi đổi phong cách.** Tra cứu, đọc văn bản, thi và quản trị giữ hệ thiết kế "Công báo" hiện có (nền giấy, chữ mực, xanh chàm). Phong cách trò chơi gắn vào một vùng `data-khu="tro-choi"`, nên không đổi màu của phần còn lại.
2. **Ba hướng để chọn** (§2):
   - **A. Cảnh phục:** xanh lục đậm, nhấn vàng cam, nền sáng. Đề xuất chọn hướng này.
   - **B. Đèn tín hiệu:** nền than chì, ba màu xanh, vàng, đỏ.
   - **C. Tuần tra ban đêm:** nền xanh đêm, màu neon.
3. **Một bộ hoạt ảnh chuẩn gồm 10 hiệu ứng** dùng chung cho mọi trò (§3), mỗi hiệu ứng có phương án thay thế khi bật giảm chuyển động.
4. **Không cần thư viện hoạt ảnh lớn.** CSS, Web Animations API và Canvas 2D có sẵn trong trình duyệt đủ cho mọi hiệu ứng ở §3 và cho trò chạy đường (Cung đường biển báo). Ngân sách thêm cho cả lớp hình ảnh trò chơi: **≤ 12 KB JavaScript** và **≤ 4 KB CSS** sau nén, tải riêng theo trang trò chơi (§5).
5. **Âm thanh mặc định tắt, rung mặc định bật** (§4). Cán bộ thường chơi ở nơi làm việc.
6. **Font đang tải từ Google Fonts nên mất khi offline.** Đề xuất tự lưu tệp font trên máy chủ của mình để service worker giữ được (§2.4).

---

## 1. Nguyên tắc chung

- **Năng động nhưng chuyên nghiệp.**
  - Được dùng: màu mạnh, chuyển động nhanh và dứt khoát, số liệu nổi bật.
  - Không dùng: nhân vật hoạt hình, chữ bong bóng, màu kẹo ngọt, tiếng kêu vui nhộn, emoji, dấu chấm than.
  - Lời khen ngắn, trung tính: "Chính xác", "Chuỗi 5 câu đúng", "Hoàn thành màn".
- **Không dùng biểu tượng ngành chính thức.** Không dùng quân hiệu, cấp hiệu, phù hiệu, logo của lực lượng Công an. Màu gợi tinh thần, không sao chép trang phục hay biểu trưng.
- **Nghĩa không chỉ nằm ở màu.** Đúng/sai luôn có cả chữ ("Đúng", "Chưa đúng") và biểu tượng (dấu tích, dấu chéo), để người mù màu và người đứng ngoài nắng vẫn đọc được.
- **Chữ nội dung vẫn là chính.** Câu hỏi, giải thích, căn cứ giữ cỡ ≥ 16px và tương phản ≥ 4,5:1. Hiệu ứng chỉ bao quanh nội dung, không đè lên.
- **Đọc được ngoài trời.** Chữ nội dung đặt trên nền đặc, không đặt trên nền chuyển màu hay ảnh.

---

## 2. Ba hướng phong cách

Các cặp màu chữ/nền dưới đây đã được tính độ tương phản theo WCAG 2.1. Mọi cặp dùng cho chữ đều từ 4,5:1 trở lên.

### 2.1. Hướng A: "Cảnh phục" (đề xuất)

Đỏ cờ làm màu chính, vàng kim làm màu nhấn cho điểm, sao, chuỗi, cùng màu logo Khiên tri thức và phần còn lại của ứng dụng (05/10/2026: trước đó màu chính là xanh lục đậm `#1e4d3a`, nhấn vàng cam `#f2a516`). Nền sáng hơi ấm, gần với phần tra cứu, nên chuyển giữa học và chơi không bị hẫng. Có chế độ tối.

| Vai trò | Sáng | Tối | Dùng cho |
|---|---|---|---|
| Nền trang | `#f7f3ea` | `#15110f` | Nền khu trò chơi |
| Nền thẻ | `#ffffff` | `#1e1916` | Thẻ câu hỏi, thẻ xe, thẻ kết quả |
| Chữ | `#1d1a17` (15,6:1) | `#efe9e4` (15,6:1) | Nội dung |
| Chữ phụ | `#4f4a44` (7,9:1) | `#c3bab2` | Mô tả, nhãn |
| Chính (đỏ cờ) | `#c8201a`, chữ trắng 5,7:1 | `#ff7a70`, chữ `#1a0b0a` 7,5:1 | Nút chính, đầu trang trò chơi |
| Nhấn (vàng kim) | `#f4c20d`, chữ `#1a1407` 11,0:1 | `#f7cf3d` | Sao, điểm chạy số, chuỗi, huy hiệu |
| Đúng | `#14733a`, chữ trắng 5,9:1; trên nền `#e3f3e8` 5,2:1 | `#4ade80` | Viền và nhãn đúng. Bước 2 đổi từ `#15803d` (chỉ đạt 4,4:1 trên nền nhạt) |
| Sai | `#8e1b16` (đỏ sẫm, khác độ sáng màu chính), chữ trắng 9,1:1; trên nền `#f9e6df` 7,5:1 | `#fbbcb5` | Viền và nhãn sai, luôn kèm chữ hoặc biểu tượng ✕ |
| Cảnh báo giờ | `#f4c20d` → `#8e1b16` | tương tự | Đồng hồ 5 giây cuối |

- **Nút chính:**
  - khối đặc màu cảnh phục, bo 14px, cao 52px, chữ đậm 17px;
  - bóng đáy 0 4px 0 màu đậm hơn một bậc: nút trông "có độ dày" như nút game, không phẳng như nút văn phòng;
  - khi bấm, nút lún xuống 2px và bóng mỏng lại.
- **Nút lựa chọn:** nền thẻ trắng, viền 2px, bo 12px. Khi chọn: viền màu chính, nền xanh rất nhạt, chữ đậm. Khi chấm: viền và nền theo màu đúng/sai, kèm biểu tượng.
- **Thẻ:** bo 20px, bóng mềm 2 lớp. Thẻ tổng kết có dải màu nhấn 4px ở đỉnh.
- **Điểm nhấn trang trí:** họa tiết vạch kẻ đường chéo mảnh, độ mờ 6%, ở đầu trang trò chơi. Không dùng họa tiết khác.

Ưu điểm:
- gần hệ thiết kế hiện có, ít rủi ro nhất;
- đọc tốt ngoài nắng;
- chế độ sáng và tối đều đẹp.

Nhược điểm: ít "game" nhất trong ba hướng. Độ sinh động phải đến từ hoạt ảnh ở §3.

### 2.2. Hướng B: "Đèn tín hiệu"

Nền than chì, ba màu đèn giao thông làm ngôn ngữ trạng thái: xanh là đúng hoặc đi tiếp, vàng là chú ý hoặc sắp hết giờ, đỏ là sai hoặc dừng. Viền và đường phân cách dùng nét đứt như vạch kẻ đường. Hướng này mặc định tối; chế độ sáng là tùy chọn.

| Vai trò | Màu | Dùng cho |
|---|---|---|
| Nền trang | `#16191f` | |
| Nền thẻ | `#20242c` | |
| Chữ | `#f1f3f5` (15,8:1 trên nền) | |
| Chữ phụ | `#a8b0bb` (7,1:1 trên thẻ) | |
| Xanh đèn | `#22c55e`, chữ `#0b1a10` 7,9:1 | Nút chính, đúng |
| Vàng đèn | `#facc15`, chữ `#1a1500` 11,9:1 | Điểm, chuỗi, cảnh báo giờ |
| Đỏ đèn | `#dc2626`, chữ trắng 4,8:1 | Sai, hết giờ |

- **Nút chính:** khối xanh đèn, bo 12px, có chấm tròn phát sáng nhẹ ở đầu nút như bóng đèn.
- **Thẻ:** viền 1px, góc bo 16px, đường kẻ nét đứt phân tách các phần.
- **Đồng hồ:** ba chấm đèn đổi lần lượt xanh → vàng → đỏ theo thời gian còn lại.

Ưu điểm:
- rất hợp chủ đề giao thông;
- màu trạng thái có sẵn ý nghĩa, người chơi hiểu ngay;
- hợp với trò chạy đường (Cung đường biển báo).

Nhược điểm:
- nền tối khó đọc ngoài nắng gắt;
- tách biệt hẳn với phần tra cứu;
- dễ nhầm xanh "đúng" với xanh "được đi" nếu dùng lẫn.

### 2.3. Hướng C: "Tuần tra ban đêm"

Nền xanh đêm, màu neon xanh ngọc làm màu chính, xanh chanh cho đúng, hồng cảnh báo cho sai. Viền phát sáng mờ, số liệu dạng màn hình máy đo. Chỉ có chế độ tối.

| Vai trò | Màu | Dùng cho |
|---|---|---|
| Nền | `#0a1020` | |
| Chữ | `#e6f1ff` (16,6:1) | |
| Chính (xanh ngọc) | `#22d3ee`, chữ `#051018` 10,6:1 | Nút chính, viền phát sáng |
| Đúng (xanh chanh) | `#a3e635` (12,6:1 trên nền) | |
| Sai (hồng cảnh báo) | `#ff5c8a` (6,5:1 trên nền) | |

Ưu điểm: gây ấn tượng mạnh nhất, hợp với Súng bắn tốc độ và Bộ đàm (màn hình máy đo, bộ đàm).

Nhược điểm:
- khó giữ vẻ chuyên nghiệp: dễ giống game giải trí;
- viền phát sáng dùng `box-shadow` hoặc `filter: blur` lớn, tốn GPU trên điện thoại tầm trung (§6);
- khó đọc ngoài trời;
- tốn pin hơn trên màn hình LCD.

### 2.4. Font chữ tiếng Việt

Chữ nội dung giữ **Be Vietnam Pro** như hiện tại: font thiết kế cho tiếng Việt, dấu đặt đúng, đọc tốt cỡ nhỏ. Chỉ thêm một font cho tiêu đề và số liệu lớn (điểm, đồng hồ, tốc độ).

| Hướng | Font tiêu đề, số liệu | Vì sao |
|---|---|---|
| A | **Lexend** (600, 700) | Chữ tròn rõ, năng động mà nghiêm túc; có bộ ký tự tiếng Việt |
| B | **Barlow Semi Condensed** (600, 700) | Dáng biển báo, bảng chỉ dẫn đường; hẹp nên số lớn vẫn vừa màn 360px |
| C | **Chakra Petch** (600) | Dáng màn hình máy đo; có bộ ký tự tiếng Việt |

- Số liệu luôn dùng chữ số đều bề rộng (`font-variant-numeric: tabular-nums`), để điểm chạy số và đồng hồ không rung ngang.
- **Tự lưu font, không tải từ Google Fonts khi chạy.** Hiện `root.tsx` tải font từ `fonts.googleapis.com`. Service worker chỉ giữ tệp cùng tên miền, nên khi mất mạng trang rơi về font hệ thống.
  - Đã làm ở Bước 2: tệp WOFF2 đặt trong `apps/web/app/styles/fonts/`, khai báo ở `styles/fonts.css`. Vite gắn mã băm vào tên tệp nên service worker giữ được như các tệp build khác. Mỗi họ font chia ba bộ ký tự (latin, latin-ext, vietnamese) theo `unicode-range`, trình duyệt chỉ tải bộ mà trang thật sự dùng.
  - **Ước tính cũ 100–140 KB là sai.** Số đo thật (§9): trang tiếng Việt thường tải bộ latin và vietnamese, khoảng 136 KB cho Be Vietnam Pro (4 độ đậm), thêm 54 KB Lexend ở trang trò chơi, thêm 51 KB Noto Serif ở trang văn bản; tối đa khoảng 241 KB. Trước đây tải từ Google Fonts cũng khoảng 187 KB (Be Vietnam Pro và Noto Serif), nay chỉ thêm Lexend.
- Cần kiểm lại bằng mắt trên máy thật: dấu chồng như "ẫ", "ỗ", "ự" ở cỡ lớn phải không bị cắt đỉnh.

---

## 3. Bộ hoạt ảnh chuẩn

### 3.1. Token thời lượng và đường cong

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--td-nhanh` | 120 ms | Phản hồi chạm, đổi trạng thái nút |
| `--td-vua` | 220 ms | Hiện phản hồi, chuyển câu |
| `--td-cham` | 360 ms | Vào màn, thẻ tổng kết trượt lên |
| `--td-an-mung` | 900 ms | Lên cấp, huy hiệu, pháo hoa |
| `--cong-chuan` | `cubic-bezier(0.2, 0, 0, 1)` | Hầu hết chuyển động: vào nhanh, dừng êm |
| `--cong-bat` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Có nảy nhẹ: sao, huy hiệu, số combo |
| `--cong-ra` | `cubic-bezier(0.4, 0, 1, 1)` | Phần tử rời màn hình |

Không hoạt ảnh nào dài quá 1,2 giây, và không hoạt ảnh nào chặn thao tác: người chơi luôn bấm "Câu tiếp" được ngay.

### 3.2. Mười hiệu ứng

Cột "Giảm chuyển động" là cách hiển thị khi máy bật `prefers-reduced-motion` hoặc người chơi bật "Giảm hiệu ứng" trong trò chơi (§6.3).

| # | Hiệu ứng | Mô tả | Thời lượng | Thuộc tính động | Âm thanh, rung | Giảm chuyển động |
|---|---|---|---|---|---|---|
| 1 | **Vào màn** | Đầu trang trượt xuống; thẻ câu hỏi trượt lên và hiện dần; các nút lựa chọn hiện lần lượt, cách nhau 40ms | 360 ms | `transform: translateY`, `opacity` | Tiếng "khởi động" ngắn | Hiện dần 150ms, không trượt |
| 2 | **Trả lời đúng** | Nút đúng nảy nhẹ (phóng 1 → 1,04 → 1); dấu tích vẽ nét; điểm "+10" bay lên từ nút và mờ dần; thanh tiến độ nhích | 400 ms | `transform: scale`, `stroke-dashoffset`, `opacity` | Hai nốt đi lên; rung 1 nhịp 15ms | Tô màu, hiện dấu tích và "+10" tĩnh |
| 3 | **Trả lời sai** | Nút đã chọn rung ngang 3 nhịp, biên độ 6px; nút đúng sáng lên; nền phản hồi hiện từ dưới | 320 ms | `transform: translateX`, `opacity` | Một nốt trầm ngắn; rung 2 nhịp 30ms | Không rung ngang; tô màu và hiện chữ "Chưa đúng" |
| 4 | **Combo liên tiếp** | Từ 3 câu đúng liên tiếp: nhãn "Chuỗi 3" (4, 5…) bật ra ở góc, nảy theo `--cong-bat`; viền thẻ lóe màu nhấn một lần. Mốc 5 và 10 có thêm tia sáng nhỏ | 500 ms | `transform`, `opacity` | Nốt cao hơn theo độ dài chuỗi | Nhãn hiện tĩnh, không lóe viền |
| 5 | **Lên cấp** | Lớp phủ mờ; huy hiệu cấp phóng từ 0,6 lên 1 và nảy; số cấp đếm lên; vòng sáng xoay chậm một vòng rồi tắt | 900 ms | `transform: scale/rotate`, `opacity` | Hợp âm ba nốt; rung 2 nhịp | Hộp thông báo hiện dần, số cấp tĩnh |
| 6 | **Nhận huy hiệu** | Huy hiệu lật 180° theo trục dọc từ mặt sau sang mặt trước; ánh sáng quét chéo qua mặt huy hiệu một lần | 800 ms | `transform: rotateY`, dải sáng `translateX` | Như lên cấp, nhẹ hơn | Hiện dần, không lật, không quét |
| 7 | **Đếm ngược** | Vòng tròn quanh số giây rút dần; 5 giây cuối đổi sang màu nhấn rồi đỏ, số đập nhẹ mỗi giây (1 → 1,08) | Liên tục | `stroke-dashoffset`, `transform: scale` | Tiếng tích mỗi giây ở 3 giây cuối; không rung | Vòng tròn rút dần, không đập; đổi màu vẫn giữ |
| 8 | **Hết giờ** | Đồng hồ rung ngang một lần; lớp đỏ mờ 12% phủ thẻ 300ms; nhãn "Hết giờ" hiện | 400 ms | `transform`, `opacity` | Nốt trầm dài; rung 1 nhịp 60ms | Nhãn "Hết giờ" hiện tĩnh |
| 9 | **Kết thúc màn** | Thẻ tổng kết trượt lên; 3 sao lần lượt bật vào, cách nhau 250ms; điểm chạy số từ 0 trong 800ms; XP chạy số sau điểm; đạt 3 sao thì bắn pháo hoa nhẹ (§3.3) | 1,2 s | `transform`, `opacity`, số cập nhật bằng `requestAnimationFrame` | Mỗi sao một nốt; hợp âm khi xong | Hiện ngay số cuối và số sao, không pháo hoa |
| 10 | **Chuyển câu** | Thẻ cũ trượt trái và mờ; thẻ mới trượt vào từ phải | 220 ms | `transform: translateX`, `opacity` | Không | Đổi ngay, không trượt |

### 3.3. Pháo hoa nhẹ

- Chỉ dùng ở hai lúc: kết thúc màn đạt 3 sao, và lên cấp.
- **Tối đa 40 hạt, sống tối đa 1,2 giây**, vẽ trên một lớp canvas phủ, không bắt sự kiện chạm. Tắt hẳn khi bật giảm chuyển động.
- Màu hạt lấy từ bảng màu của hướng đã chọn (màu chính, màu nhấn, trắng), không dùng cầu vồng.
- Hình hạt là mảnh chữ nhật và chấm tròn nhỏ, không dùng ngôi sao hay trái tim, để giữ vẻ chuyên nghiệp.

### 3.4. Riêng cho từng trò

Các trò dùng chung 10 hiệu ứng trên. Phần riêng của từng trò chỉ thêm khi thật cần:

| Trò | Hiệu ứng riêng |
|---|---|
| Súng bắn tốc độ | Xe trượt ngang qua thẻ khi vào câu; số tốc độ đo được chạy số từ 0 lên trong 500ms như máy đo |
| Chốt tuần tra | Xe được chạm có viền nhấp nháy một lần; xe vi phạm bị bỏ sót nhấp nháy đỏ ở màn tổng kết |
| Cung đường biển báo | Đường chạy cuộn liên tục bằng canvas (§5.3); biển báo lớn dần khi tới gần |
| Hiện trường | Chuyển bước bằng hiệu ứng lật trang; hậu quả hiện như dòng tin khẩn |
| Bộ đàm | Sóng âm thanh động khi đang đọc câu hỏi và khi đang nghe người chơi nói |
| Đối đầu 1–1 | Hai thanh điểm chạy song song; tên người dẫn trước sáng lên |
| Mùa giải đơn vị | Hàng của đơn vị mình trượt lên hoặc xuống khi đổi hạng |

---

## 4. Âm thanh và rung

### 4.1. Âm thanh

- **Tự tạo bằng Web Audio API, không dùng tệp âm thanh.** Mỗi âm là 1–3 nốt ngắn, tạo bằng bộ dao động có trong trình duyệt.
  - Không tốn dung lượng tải, và có sẵn khi offline.
  - Âm sắc đơn giản kiểu "điện tử sạch", hợp với phong cách chuyên nghiệp.
  - Nếu sau này muốn âm thanh thu sẵn: một tệp gộp mọi âm, khoảng 30–50 KB dạng OGG/MP3, service worker giữ.
- **Mặc định tắt.** Cán bộ thường chơi ở cơ quan hoặc nơi công cộng (bản thiết kế cũ, [luu-tru/GAME_DESIGN_cu.md](luu-tru/GAME_DESIGN_cu.md) §7 câu Q16; nay là [GAME_DESIGN.md](GAME_DESIGN.md) §8 câu D12).
  - Nút loa ở góc `KhungGame` bật tắt ngay, lưu trên máy (localStorage).
  - Bộ đàm là ngoại lệ: trò đó cần giọng đọc, nên hỏi bật âm khi vào trò.
- **Âm lượng thấp** (tối đa 30%), không âm nào dài quá 0,6 giây, không nhạc nền.
- Trình duyệt chỉ cho phát âm sau lần chạm đầu tiên của người dùng. Bộ âm thanh khởi tạo ở lần chạm "Chơi".
- Âm thanh không bao giờ là tín hiệu duy nhất: mọi âm đều đi kèm chữ và hình trên màn hình.

### 4.2. Rung

- Dùng `navigator.vibrate`. **Mặc định bật**, có nút tắt riêng cạnh nút âm thanh.
- Chỉ rung ở 4 lúc: trả lời đúng (15ms), trả lời sai (30-40-30ms), hết giờ (60ms), lên cấp (2 nhịp 40ms).
- **Giới hạn nền tảng:** rung chạy trên Chrome Android. Safari trên iPhone hiện không hỗ trợ API này, nên trên iPhone sẽ không rung; nút rung ẩn đi khi trình duyệt không hỗ trợ.
- Web không biết điện thoại có đang để chế độ im lặng hay không, nên nút tắt trong trò chơi là cách chắc chắn nhất.

### 4.3. Nơi đặt nút tắt

- Hai nút nhỏ ở đầu `KhungGame`: loa và rung. Mỗi nút có nhãn cho trình đọc màn hình.
- Trang Tôi (`/toi`) có mục "Âm thanh và hiệu ứng" với ba công tắc: âm thanh, rung, giảm hiệu ứng.

---

## 5. Thư viện và dung lượng

### 5.1. Hiện trạng

Đo trên bản build ngày 25/9/2026, sau nén gzip:

| Phần | Dung lượng |
|---|---|
| JavaScript khởi động (`entry.client` + chunk chung) | 60 KB + 45 KB |
| CSS toàn ứng dụng | 7,9 KB |
| Trang chơi một lượt (`tro-choi.luot`) | 2,9 KB |
| Trang chơi offline (`tro-choi.offline`) | 6,9 KB |

Chưa có thư viện hoạt ảnh nào. React 19, React Router 7, Tailwind 4 đã có sẵn.

### 5.2. Đề xuất

**Nguyên tắc:** dùng khả năng có sẵn của trình duyệt trước. Chỉ thêm thư viện khi tự viết tốn công hơn hẳn dung lượng thêm vào.

| Nhu cầu | Đề xuất | Dung lượng thêm (ước tính, nén gzip) | Không chọn, vì sao |
|---|---|---|---|
| Hoạt ảnh giao diện (§3.2) | **CSS keyframes + Web Animations API** (`element.animate()`), bọc trong vài hook React nhỏ | 0 KB thư viện; khoảng 2–4 KB mã tự viết | **Framer Motion / `motion/react`**: khoảng 15 KB (bản rút gọn) đến trên 30 KB (bản đầy đủ). Mạnh cho hoạt ảnh bố cục, nhưng các hiệu ứng ở §3 không cần |
| Chuỗi hoạt ảnh phức tạp, lò xo (nếu cần) | **`motion`, hàm `animate` bản mini** | khoảng 2–4 KB | Chỉ thêm nếu lúc làm thấy Web Animations API không đủ |
| Pháo hoa nhẹ (§3.3) | **Tự viết** bằng canvas 2D, 40 hạt | khoảng 1 KB | **canvas-confetti** (khoảng 4–5 KB) được, nhưng không cần. **tsParticles**: hàng chục KB, quá nặng |
| Điểm chạy số | Tự viết bằng `requestAnimationFrame` | < 0,5 KB | Thư viện đếm số: không cần |
| Trò chạy đường, Cung đường biển báo (§5.3) | **Canvas 2D tự viết** + `requestAnimationFrame` | khoảng 4–6 KB mã trò | **PixiJS**: khoảng 100 KB trở lên, dùng WebGL, quá nặng cho vài chục hình. **Phaser**: vài trăm KB. **KAPLAY**: khoảng 50–70 KB |
| Hoạt ảnh vẽ tay (nhân vật, cảnh) | **Không dùng** | 0 KB | **Lottie** (`lottie-web` khoảng 60 KB trở lên, `dotlottie-web` kèm WebAssembly nặng hơn), cộng tệp JSON cho mỗi hoạt ảnh |
| Âm thanh (§4.1) | **Web Audio API** tự tạo âm | khoảng 1 KB | **Howler.js** (khoảng 7 KB): không cần khi không dùng tệp âm thanh |
| Rung (§4.2) | `navigator.vibrate` | 0 KB | |

Dung lượng thư viện ở bảng trên là **ước tính theo bản phát hành gần đây**. Bước 2 sẽ đo thật trên bản build, trước và sau.

### 5.3. Trò chạy đường (Cung đường biển báo)

- **Canvas 2D một lớp, tự viết:** mặt đường cuộn bằng cách vẽ lặp vạch kẻ; xe người chơi ở đáy; biển báo là ảnh SVG vẽ sẵn lên canvas ẩn một lần rồi dùng lại.
- Nút phản ứng là nút HTML thường đặt dưới canvas, không vẽ trong canvas: bấm được bằng bàn phím và có nhãn cho trình đọc màn hình.
- Vòng lặp chạy bằng `requestAnimationFrame`, tính theo thời gian thực (không theo số khung hình), nên máy chậm vẫn đúng nhịp. Tự dừng khi tab bị ẩn.
- Giới hạn độ phân giải canvas ở 2× điểm ảnh, để máy màn hình 3× không phải vẽ gấp đôi.

### 5.4. Ngân sách dung lượng

| Phần | Ngân sách (nén gzip) |
|---|---|
| Lớp hình ảnh trò chơi dùng chung: token, hoạt ảnh, âm thanh, rung, pháo hoa | ≤ 12 KB JavaScript, ≤ 4 KB CSS |
| Mã riêng mỗi trò | ≤ 8 KB (Cung đường biển báo ≤ 12 KB) |
| JavaScript khởi động của toàn ứng dụng | **Không tăng**: lớp trò chơi chỉ tải khi mở trang trò chơi |
| Font tự lưu (§2.4) | ~~≤ 140 KB~~ Thực tế tối đa khoảng 241 KB (bộ latin và vietnamese), tải một lần rồi service worker giữ. Vượt ước tính, xem §9 |

Vượt ngân sách thì bỏ bớt hiệu ứng, không nới ngân sách.

---

## 6. Nguyên tắc hiệu năng

### 6.1. Mục tiêu

- **60 khung hình mỗi giây** trên điện thoại tầm trung: Android khoảng 4 GB RAM, Chrome bản mới.
- Kiểm trên máy tính bằng Chrome DevTools với CPU chậm 4×, và soát tay trên một máy Android tầm trung thật.
- Không có khung hình nào kéo dài quá 50 ms khi chơi (đo bằng tab Performance).

### 6.2. Quy tắc viết hoạt ảnh

1. **Chỉ động `transform` và `opacity`.** Không động `width`, `height`, `top`, `left`, `margin`, `padding`, vì các thuộc tính này buộc trình duyệt tính lại bố cục mỗi khung hình.
2. **Không động `box-shadow` hay `filter`.**
   - Muốn bóng hoặc vòng sáng thay đổi: vẽ sẵn ở một lớp giả (`::after`) rồi chỉ động `opacity` của lớp đó.
   - Không dùng `filter: blur` trên vùng lớn. Đây là lý do chính khiến hướng C tốn máy.
3. **`will-change` chỉ đặt trong lúc hoạt ảnh chạy** rồi gỡ ra; không đặt sẵn cho mọi phần tử.
4. **Tối đa 3 hoạt ảnh chạy cùng lúc** trên màn hình (không kể đồng hồ); pháo hoa tối đa 40 hạt.
5. **Đồng hồ và điểm chạy số** cập nhật bằng `requestAnimationFrame`, chỉ ghi DOM khi con số đổi. Không dùng `setInterval` 16ms.
6. **Không để hoạt ảnh làm sai nhịp chấm điểm.** Đồng hồ trên máy chỉ để hiển thị; máy chủ vẫn tính giờ như khung chung GĐ-G0.
7. **Tải lười:** mã hoạt ảnh, âm thanh, pháo hoa nằm trong gói tải khi mở trang trò chơi, không nằm trong gói khởi động.
8. **Không nhấp nháy quá 3 lần mỗi giây** (WCAG 2.3.1), kể cả khi hết giờ hay combo.

### 6.3. Giảm chuyển động

- Đọc `prefers-reduced-motion: reduce` từ hệ điều hành. Có thêm công tắc "Giảm hiệu ứng" ở trang Tôi: bật công tắc thì áp dụng như cài đặt hệ điều hành, dù máy không bật.
- Khi giảm chuyển động:
  - thay trượt, nảy, lật, rung ngang bằng hiện dần ≤ 150ms hoặc đổi ngay (cột "Giảm chuyển động" ở §3.2);
  - tắt pháo hoa, vòng sáng xoay, ánh quét;
  - điểm và XP hiện ngay số cuối, không chạy số;
  - Cung đường biển báo chuyển sang chế độ từng bước ([luu-tru/GAME_DESIGN_cu.md](luu-tru/GAME_DESIGN_cu.md) §5.5); các trò mới có chế độ từng bước riêng ([GAME_DESIGN.md](GAME_DESIGN.md) §1.4);
  - âm thanh và rung **giữ theo công tắc riêng**, không tự tắt: giảm chuyển động không có nghĩa là muốn tắt âm.
- Kiểm tự động: kịch bản E2E bật `reducedMotion: "reduce"` và kiểm `animation-name` là `none`, như GĐ9 đã làm.

---

## 7. Cách triển khai ở Bước 2

Đã làm theo mô tả dưới đây. Tên component thực tế và số đo ở §9.

- **Token:**
  - thêm vào `apps/web/app/styles/app.css` một khối token riêng cho khu trò chơi, gồm màu, bo góc, bóng, thời lượng, đường cong;
  - các token chỉ áp dụng trong `[data-khu="tro-choi"]` và có giá trị riêng cho chế độ tối.
- **Component dùng chung** trong `components/tro-choi/hieu-ung/`:
  - `NutGame`, `TheGame`;
  - `HieuUngDung`, `HieuUngSai`, `NhanCombo`, `DongHoVong`, `SoChay`, `SaoTongKet`, `PhaoHoa`, `LopLenCap`, `LatHuyHieu`;
  - hook `useHieuUng()` (đọc giảm chuyển động), `useAmThanh()`, `useRung()`.
- **Trang `/game-style-demo`:**
  - hiện đủ 10 hiệu ứng, mỗi hiệu ứng một nút "Chạy lại";
  - có công tắc âm thanh, rung, giảm hiệu ứng, và nút đổi sáng/tối;
  - chỉ để duyệt, ẩn khỏi menu, và cần đăng nhập vai trò biên tập trở lên.
- **Áp dụng cho trò mẫu "Trắc nghiệm nhanh"** qua `KhungGame`, `PhanHoiBuoc`, `DongHoBuoc`, `TongKetLuot`:
  - chỉ đổi phần hiển thị;
  - không sửa logic chấm điểm, XP, đồng bộ offline.
- **Đo dung lượng:** build trước và sau; so từng gói (khởi động, trang trò chơi, CSS, font) với ngân sách ở §5.4.

---

## 8. Những điểm cần anh/chị quyết định

| # | Câu hỏi | Đề xuất |
|---|---|---|
| V1 | Chọn hướng phong cách nào: A (Cảnh phục), B (Đèn tín hiệu) hay C (Tuần tra ban đêm)? Có thể lấy hướng A làm chủ đạo, dùng thêm ba màu đèn của B làm màu trạng thái trong Cung đường biển báo | **A**, mượn màu đèn của B cho Cung đường biển báo |
| V2 | Khu trò chơi có chế độ tối riêng không, hay theo cài đặt sáng/tối chung của ứng dụng? | Theo cài đặt chung |
| V3 | Âm thanh mặc định tắt, rung mặc định bật: có đồng ý? | Đồng ý |
| V4 | Có tự lưu font (thay Google Fonts) để chơi offline vẫn đúng font không? Việc này đổi cả phần tra cứu, vì dùng chung font | Có |
| V5 | Pháo hoa chỉ khi đạt 3 sao và khi lên cấp: đủ, hay muốn nhiều hơn / ít hơn? | Giữ như đề xuất |
| V6 | Trang `/game-style-demo` chỉ cho vai trò biên tập trở lên xem, hay mở cho mọi người đăng nhập? | Biên tập trở lên |

---

## 9. Kết quả Bước 2 (25/9/2026)

### 9.1. Đã làm

- **Token và CSS khu trò chơi:** `components/tro-choi/hieu-ung/tro-choi.css`, chỉ áp trong `[data-khu="tro-choi"]`, có giá trị cho chế độ tối. Hai lớp đánh dấu:
  - `.g-a`: hoạt ảnh mang thông tin (vào màn, dấu đúng/sai, xe lao qua). Khi giảm chuyển động, chỉ còn hiện dần 150 ms;
  - `.g-t`: hoạt ảnh trang trí (rung ngang, lóe sáng, vệt xe, số đập). Khi giảm chuyển động thì tắt hẳn.
- **Component dùng chung** trong `components/tro-choi/hieu-ung/`: `VungTroChoi`, `DauMan`, `NhanCombo`, `SoChay`, `SaoTongKet`, `PhaoHoa`, `LopChucMung` (lên cấp, `HuyHieuLat`), `NutCaiDatGame`; cùng `am-thanh.ts` (Web Audio, không có tệp âm thanh), `rung.ts`, `cai-dat.ts`. Luật thuần (chuỗi đúng, mốc combo, lên cấp, huy hiệu trong lượt, đường cong số chạy) ở `lib/hieu-ung.ts`, có test.
- **Áp dụng cho khung chung:** `KhungGame`, `PhanHoiBuoc`, `DongHoBuoc` (vòng đếm ngược), `TongKetLuot`, trang lượt chơi và trang chơi offline. Không sửa logic chấm điểm, XP, đồng bộ offline.
- **Hai hiệu ứng riêng của Súng bắn tốc độ** (đã duyệt): xe lao qua có vệt, số tốc độ chạy trên máy đo rồi khóa số (lóe viền, số chuyển đỏ khi vượt). Khi khóa số có tiếng "bíp" ngắn, **chỉ phát khi người chơi bật âm thanh**.
- **Trang `/game-style-demo`:** 12 khối hiệu ứng, mỗi khối có nút "Chạy lại"; công tắc âm thanh, rung, giảm hiệu ứng, sáng/tối. Chỉ vai trò biên tập trở lên.

### 9.2. Dung lượng (gzip, bản build web)

| Phần | Trước | Sau |
|---|---|---|
| JavaScript khởi động (entry.client và chunk chung) | 59.797 B + 44.685 B | **Không đổi** |
| CSS gốc | 7.903 B | 8.804 B (+901 B, là các khai báo `@font-face`) |
| CSS khu trò chơi (chunk riêng, chỉ tải ở trang trò chơi) | — | 1.861 B |
| Lớp hiệu ứng dùng chung, đóng gói riêng để đo | — | 5.152 B JS (17.704 B chưa nén) |
| Trang lượt chơi `tro-choi.luot` | 2.870 B | 2.570 B |
| Trang chơi offline | 6.889 B | 7.101 B |
| Trang `/game-style-demo` | — | 3.827 B |
| Tổng JS và CSS mọi trang | 307.685 B | 319.883 B (+12.198 B, gồm cả trang demo) |
| Font tự lưu (18 tệp, trên đĩa) | tải từ Google | 515.664 B; trang tiếng Việt thường tải tối đa khoảng 241 KB |

Lớp hình ảnh nằm trong ngân sách ≤ 12 KB JS và ≤ 4 KB CSS. Font vượt ước tính ở §2.4. Nếu cần giảm, có thể bỏ độ đậm 500 của Be Vietnam Pro (khoảng 34 KB), vì giao diện hầu như chỉ dùng 400, 600, 700.

### 9.3. Độ mượt (E2E `tro-choi-muot`, khung 360×740, CPU chậm 4×)

| Chế độ | Số khung đo | Trung vị | p95 | Khung > 100 ms |
|---|---|---|---|---|
| Thường, âm thanh tắt | ~460 | 16,7 ms | 16,8 ms | 0,2% |
| Giảm chuyển động (hệ điều hành), âm thanh tắt | ~340 | 16,7 ms | 17,7 ms | 0,3% |

Có vài khung dài đơn lẻ (lớn nhất 116–233 ms tùy lần chạy), nhiều khả năng là lúc React dựng câu mới dưới CPU chậm 4×; chưa đo tách riêng. Kịch bản hỏng khi quá 5% khung dài hơn 100 ms. Kịch bản cũng kiểm:
- khi âm thanh tắt, không tạo AudioContext nào; bật loa thì có âm;
- khi giảm chuyển động, mọi `.g-a` chỉ còn `g-hien`, mọi `.g-t` là `none`, vệt xe ẩn, không có pháo hoa, chơi trọn 10 xe tới tổng kết;
- công tắc "Giảm hiệu ứng" trong trang demo đổi được cả khu trò chơi.

---

## 10. Bộ biểu tượng (01/10/2026)

Vẽ lại `apps/web/app/components/ui/Icon.tsx` theo [PROMPT_BO_ICON.md](PROMPT_BO_ICON.md), Prompt 1. Áp dụng cho toàn ứng dụng, không riêng khu trò chơi.

### 10.1. Hướng hình ảnh: "Nét đậm, hai lớp màu"

- **Lớp nét** (`net`): dày 2, đầu và góc nét bo tròn, màu `currentColor`. Lớp này một mình đủ nghĩa.
- **Lớp nền** (`nen`): mảng tô đặc dưới nét, lệch 1,25 đơn vị về phía dưới phải. Màu là sắc của biểu tượng, pha trong suốt 25% (sáng) hoặc 35% (tối).
- **Điểm nhấn** (`nhan`): tối đa một chi tiết, ví dụ cửa sổ vàng của ngôi nhà, dải đỏ của sách, chấm báo của chuông. Riêng đèn giao thông có ba đèn, phân biệt bằng vị trí.
- Lưới 24, lề 2, bo góc hình chữ nhật 2. Đầu mũi tên là tam giác nhỏ, ở nét 2 thì kín như tô đặc.
- **Ba kiểu** (`<Icon kieu>`):
  - `hai-lop` (mặc định): đủ ba lớp.
  - `net`: chỉ lớp nét, đơn sắc. Dùng trên nền đặc màu: ô trò chơi dự phòng, huy hiệu đã đạt, nút phát sách nói, mục chưa chọn của thanh điều hướng dưới.
  - `dac`: ô bo góc tô đặc màu sắc, hình thu 75% vào giữa, nét màu `--on-primary`. Riêng sắc vàng dùng `--g-tren-nhan`. Dùng cho mục đang chọn của thanh điều hướng dưới.
- `sac` ghi đè sắc mặc định, ví dụ EmptyState dùng `trung`.
- **Màu** chỉ khai ở `app.css`, khối "Bộ biểu tượng": `--ic-nen` và `--ic-nhan` tính bằng `color-mix` từ sắc. Sắc khai trên chính thẻ `<svg>`, nên trong khu trò chơi biểu tượng theo `--primary` xanh cảnh phục.
- **Hoạt ảnh**, tắt khi giảm chuyển động:
  - `.ic-lay`: ngọn lửa lay nhẹ khi chuỗi ngày đang giữ (chip đầu trang, lời nhắc ở `/toi`);
  - `.ic-lac`: chuông lắc một lần, chưa có chỗ dùng;
  - ngôi sao nảy khi lên cấp, giữ như cũ.
- **Trang xem trước** `/xem-bieu-tuong`: chỉ bật ở môi trường dev; bản build mở khi đặt `QDPL_XEM_BIEU_TUONG=1`. Chụp ảnh bằng `E2E_NHAN=<nhãn> QDPL_XEM_BIEU_TUONG=1 bun run e2e bieu-tuong`.

### 10.2. Bảng sắc màu

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

### 10.3. Số đo tương phản (WCAG 2.1, tiêu chí 1.4.11, yêu cầu ≥ 3:1)

Lớp nét được đo trên nền thật, lấy giá trị thấp nhất giữa nền trơn và phần nền đã phủ lớp tô 25% hoặc 35% của các sắc có mặt ở chỗ đó. Ngoài khu trò chơi.

| Ngữ cảnh | Cặp màu | Sáng | Tối |
|---|---|---|---|
| Nét, nơi mặc định | `ink` trên `surface`, kể cả trên nền tô mọi sắc | 10,91 | 5,69 |
| Nét, nơi mặc định | `ink` trên `canvas`, kể cả trên nền tô mọi sắc | 10,11 | 6,16 |
| Thanh điều hướng dưới, mục khác (`net`) | `ink-2` trên `canvas` | 8,51 | 10,43 |
| Ngăn "Thêm" (`hai-lop`) | `ink-2` trên `surface` và nền tô ngọc, tím, vàng, chính | 5,94 | 3,80 |
| FeatureGrid, LuoiTraCuuNhanh, TheBaiHoc, TheSoLieu | `primary` trên `primary-soft` (05/10/2026, chỉ đo nền trơn) | 4,95 | 6,16 |
| EmptyState (sắc trung) | `ink-3` trên `surface-2` và nền tô trung | 3,56 | 3,02 |
| Lời nhắc chuỗi ngày `/toi` | `warn` trên `warn-soft` và nền tô cam | 4,15 | 4,04 |
| Lời nhắc chuỗi ngày `/toi` | `ok` trên `ok-soft` và nền tô cam | 4,40 | 4,00 |
| Tô đặc, sắc chinh / vang / cam / do | nét trên ô | 5,71 / 10,96 / 6,85 / 4,93 | 7,54 / 12,16 / 12,37 / 6,87 |
| Tô đặc, sắc luc / tim / ngoc / trung | nét trên ô | 7,38 / 6,73 / 5,47 / 5,75 | 11,92 / 9,23 / 12,61 / 6,70 |
| Ô tô đặc của thanh dưới (chinh / luc / trung) | ô trên `canvas` | 5,24 / 6,78 / 5,28 | 7,32 / 11,89 / 6,69 |

Chỗ sát ngưỡng là EmptyState tối (3,02). Các hàng chinh, vang, do được đo lại ngày 05/10/2026 khi đổi màu theo logo (đỏ cờ, vàng kim); hàng màu chính trên nền tô sáu sắc chưa đo lại. Nếu đổi token nền tối thì phải đo lại.

### 10.4. Dung lượng

`Icon.tsx`: 2.292 B gzip (52 khóa) → 5.546 B gzip (63 khóa). Ngân sách là ≤ 9 KB.

---

## 11. Icon ứng dụng của trò chơi (01/10/2026)

Vẽ lại 15 icon ở `apps/web/app/assets/tro-choi/` và vẽ mới 6 icon còn thiếu, theo [PROMPT_BO_ICON.md](PROMPT_BO_ICON.md), Prompt 2. Đủ 21 trò có trong `INSERT INTO games` của các migration, nên lưới trò chơi và carousel trang chủ không còn trò nào dùng ô dự phòng. Ô dự phòng (mảnh ghép `puzzle` trên ô màu chính) chỉ còn cho trò mới chưa có tệp.

### 11.1. Khung chung

Mọi tệp cùng khung 128 × 128, ô bo góc 112 × 112, `rx=28`, nên `lib/anh-tro-choi.ts`, `BieuTuongTro` và `CategoryCarousel` không phải sửa. Thứ tự lớp:

1. **Nền:** chuyển màu chéo từ góc trên trái (sáng) xuống góc dưới phải (đậm), theo nhóm màu ở §11.2.
2. **Họa tiết:** vạch chéo 45°, rộng 2, cách 12, trắng 8%.
3. **Vệt sáng:** elip trắng 12% ở nửa trên (tâm 64, 36; bán kính 46 × 24).
4. **Cảnh nền** (nếu có, không đổ bóng): dãy phố của Tự lái, trăng và quầng đèn của Chốt đêm, tia quét của Soi camera, sóng âm của Hỏi nhanh.
5. **Vật chính:** một vật, chiếm khoảng 60% ô, tâm lệch lên khoảng 4 đơn vị. Thân tô chuyển màu dọc từ trắng xuống sắc nhạt của nhóm, viền 3 đơn vị màu bậc 950 của nhóm, góc và đầu nét bo tròn. Bóng đổ mềm: đen 20%, lệch (2, 4), mờ 3 (`feDropShadow`).
6. **Huy hiệu góc** (không bắt buộc): tròn bán kính 14 ở (100, 100), nền vàng `#FBBF24`, viền và ký hiệu màu viền của nhóm. Bốn ký hiệu: dấu cộng, dấu tích, tia chớp, kính lúp.

Ánh sáng luôn từ trên trái. Màu nhấn dùng chung: vàng `#FBBF24`, đỏ `#EF4444`, trắng, xanh lơ `#22D3EE`. Không emoji, không quân hiệu, cấp hiệu, không hình người mặc cảnh phục. Chữ trong icon chỉ có "MẪU" (Kiểm tra giấy tờ) và số "72" (Súng bắn tốc độ), là họa tiết, không mang nghĩa.

### 11.2. Nhóm màu

| Nhóm | Nền | Viền | Sắc nhạt của thân | Trò |
|---|---|---|---|---|
| Lục | `#34D399 → #047857` | `#022C22` | `#D1FAE5` | cam_bien, cung_duong_bien_bao, thu_nghiem |
| Lam | `#60A5FA → #1D4ED8` | `#172554` | `#DBEAFE` | dung_xe, kiem_tra_giay_to, lap_bien_ban, sung_ban_toc_do |
| Tím | `#A78BFA → #6D28D9` | `#2E1065` | `#EDE9FE` | duyet_phat_nguoi, soi_camera, truy_vet, tai_dung_hien_truong |
| Cam | `#FB923C → #C2410C` | `#431407` | `#FFEDD5` | len_xe_khach, soi_xe_cai_tao, tram_can, tu_lai |
| Vàng | `#F59E0B → #B45309` | `#451A03` | `#FEF3C7` | vuot_man, dua_thoi_gian |
| Đỏ | `#F87171 → #B91C1C` | `#450A0A` | `#FEE2E2` | doan_bien_bao, ghep_cap |
| Hồng | `#F472B6 → #BE185D` | `#500724` | `#FCE7F3` | hoi_nhanh_giong_noi |
| Đêm | `#1E40AF → #312E81` | `#020617` | `#E2E8F0` | chot_dem |

Hai nhóm lệch khỏi đề xuất ở PROMPT_BO_ICON.md §3.2 để các icon cùng độ sáng (§11.3):
- **Vàng:** đề xuất `#FCD34D → #D97706` làm hai icon nhóm này sáng hơn trung bình 14 điểm L*. Đổi sang hổ phách `#F59E0B → #B45309`.
- **Đêm:** đề xuất `#1E3A8A → #0F172A` tối hơn trung bình 30 điểm L*. Đổi sang `#1E40AF → #312E81`, vẫn đọc là trời đêm.

Viền dùng bậc 950 thay cho bậc 900 để đạt tương phản ở §11.4.

### 11.3. Độ sáng

Đo L* (CIELAB) trung bình trên phần ô của ảnh dựng 128 × 128 trong Chrome. Trung bình 21 icon: **56,2**.

| Mã trò | L* trước | L* sau | Tệp trước (B) | Tệp sau (B) |
|---|---|---|---|---|
| cam_bien | 59,1 | 58,4 | 1.098 | 1.845 |
| chot_dem | 27,9 | 41,6 | 1.491 | 2.431 |
| cung_duong_bien_bao | 56,4 | 53,2 | 1.545 | 1.638 |
| doan_bien_bao | — | 56,4 | — | 1.568 |
| dua_thoi_gian | — | 61,5 | — | 1.611 |
| dung_xe | 53,0 | 56,2 | 1.497 | 1.800 |
| duyet_phat_nguoi | 41,7 | 52,0 | 1.361 | 1.813 |
| ghep_cap | — | 57,4 | — | 1.601 |
| hoi_nhanh_giong_noi | — | 57,0 | — | 1.573 |
| kiem_tra_giay_to | 65,1 | 58,6 | 1.492 | 1.767 |
| lap_bien_ban | 66,0 | 56,3 | 1.418 | 1.652 |
| len_xe_khach | 65,9 | 56,7 | 1.201 | 2.164 |
| soi_camera | 51,6 | 51,6 | 1.044 | 1.556 |
| soi_xe_cai_tao | 57,0 | 55,0 | 1.239 | 1.927 |
| sung_ban_toc_do | 55,2 | 53,9 | 1.365 | 1.658 |
| tai_dung_hien_truong | — | 56,7 | — | 1.445 |
| thu_nghiem | 72,5 | 62,0 | 1.858 | 1.518 |
| tram_can | 60,4 | 56,7 | 1.321 | 1.928 |
| truy_vet | — | 58,4 | — | 1.747 |
| tu_lai | 61,5 | 58,1 | 983 | 1.662 |
| vuot_man | 72,5 | 62,2 | 1.114 | 1.643 |

- Trước: 15 icon, L* từ 27,9 đến 72,5 (chênh 44,6).
- Sau: 20 icon nằm trong khoảng ±6 quanh trung bình (51,6 đến 62,2).
- Riêng Chốt đêm thấp hơn trung bình 14,6 điểm, vì đây là cảnh đêm. Trăng, rào phản quang và đèn quay vẫn sáng, nên ở cỡ 36px icon này không chìm trên cả nền sáng lẫn nền tối.

### 11.4. Tương phản (WCAG 2.1, tiêu chí 1.4.11, yêu cầu ≥ 3:1)

Ranh giới của vật chính với nền ô có hai lớp:
- ở phần nền sáng, viền tối tách vật;
- ở phần nền đậm, thân sáng tách vật.

Bảng dưới lấy điểm thấp nhất dọc dải chuyển màu của nền. Ở mỗi điểm, tính cặp tốt hơn trong hai cặp (viền với nền, đáy thân với nền).

| Nhóm | Viền / nền sáng | Đáy thân / nền đậm | Thấp nhất dọc dải nền |
|---|---|---|---|
| Lục | 7,9 | 4,8 | 3,7 |
| Lam | 5,8 | 5,5 | 3,5 |
| Tím | 5,6 | 6,0 | 3,6 |
| Cam | 6,9 | 4,5 | 3,7 |
| Vàng | 7,0 | 4,5 | 3,7 |
| Đỏ | 5,8 | 5,3 | 3,6 |
| Hồng | 5,7 | 5,1 | 3,6 |
| Đêm | 2,3 | 9,3 | 7,1 (thân trắng trên nền) |

### 11.5. Dung lượng

- Mỗi tệp ≤ 4 KB chưa nén, lớn nhất là chot_dem 2.431 B (§11.3).
- Tổng: 20.027 B (15 tệp) → 36.547 B (21 tệp).
- Vite nhúng thẳng tệp dưới 4 KB vào chunk `anh-tro-choi`, chunk này tải ở trang chủ và trang trò chơi: 25.297 B, gzip 4.549 B → 47.408 B, gzip 6.273 B (+1.724 B gzip).

### 11.6. Thêm trò mới

1. Thêm tệp `<mã trò>.svg` vào `app/assets/tro-choi/`, theo khung §11.1 và một nhóm màu ở §11.2.
2. Kiểm tra: tệp ≤ 4 KB, vật chính nhận ra được ở 36px, L* trong khoảng ±6 quanh trung bình.

Chưa có tệp thì trò vẫn hiện, với ô dự phòng mảnh ghép.
