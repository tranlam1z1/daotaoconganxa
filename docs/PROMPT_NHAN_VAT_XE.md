# PROMPT TẠO NHÂN VẬT, Ô TÔ, XE MÁY CHO TRÒ CHƠI (GEMINI)

*Soạn ngày 02/10/2026. Nội dung lấy từ `data/tro-choi/*.json` tại ngày soạn; dữ liệu trò chơi đổi thì phải cập nhật lại. Dùng cho công cụ tạo ảnh Gemini. Prompt viết bằng tiếng Anh vì công cụ tạo ảnh hiểu tiếng Anh ổn định hơn, ghi chú viết bằng tiếng Việt.*

---

## 0. Cách dùng

1. **Mỗi trò một cuộc trò chuyện Gemini mới.** Dán **Khối khởi động** (mục 1.1) làm tin nhắn đầu tiên. Sau đó gửi lần lượt từng prompt trong bảng của trò đó, mỗi tin một prompt.
2. **Mỗi prompt bắt đầu bằng một mã kiểu** (`[PORTRAIT]`, `[SIDE]`, `[TOP]`…). Mã kiểu nhắc Gemini dùng đúng góc nhìn và khung hình đã khai trong khối khởi động (mục 1.2).
3. **Nếu Gemini quên phong cách** sau nhiều tin nhắn, dán lại khối khởi động hoặc mở cuộc trò chuyện mới.
4. **Đặt tên tệp theo cột "Tệp".** Ví dụ `ktgt-01-chan-dung.png`.
5. **Ảnh Gemini chỉ dùng làm mẫu.** Theo [GAME_DESIGN.md](GAME_DESIGN.md) §1.5 và [VISUAL_STYLE.md](VISUAL_STYLE.md), hình trong trò chơi là SVG nhỏ (≤ 8 KB mỗi hình, có biến thể màu). Ảnh raster do Gemini tạo dùng để chốt dáng và màu, sau đó vẽ lại bằng SVG. Không đưa thẳng ảnh PNG vào mã.
6. **Duyệt từng ảnh theo quy tắc cứng** (mục 1.3) trước khi dùng. Ảnh nào có chữ, logo, quân hiệu hoặc mặt người chi tiết thì tạo lại.

**Về giới tính nhân vật.** Hồ sơ Kiểm tra giấy tờ, Dừng xe và Lên xe khách chỉ ghi họ tên, ngày sinh, không ghi giới tính. Prompt của các hồ sơ này để trung tính (`adult`). Nếu nhóm nội dung muốn chọn rõ, thay `adult` bằng `man` hoặc `woman`. Riêng Lập biên bản, lời kể đã ghi "anh", "chị", "ông", "bà" nên prompt theo đúng cách gọi đó.

---

## 1. Phần chung

### 1.1. Khối khởi động (dán vào tin nhắn đầu tiên)

```text
You will generate a series of illustrations for a serious mobile training game about
Vietnamese traffic law, used by traffic police officers and citizens. Every image I ask for
in this conversation must follow these rules:

STYLE
- Flat vector illustration, clean geometric shapes, soft two-tone shading, consistent thick
  dark outline (#16211c), muted realistic colours. Professional, calm and modern.
- Not cartoonish, not cute, no chibi, no exaggerated expressions, no comic effects.
- Light source from the top-left. No drop shadow outside the subject except a soft ground
  shadow directly under vehicles.
- Plain solid background #f4f1e8 unless the prompt describes a scene. Subject centred with
  generous empty margin so it can be cut out.
- Setting is Vietnam: Vietnamese people in everyday Vietnamese clothing, vehicles typical of
  Vietnamese roads, right-hand traffic.

PEOPLE
- People are faceless: the head is a smooth shape with hair, no eyes, no nose, no mouth.
  Emotion and behaviour are shown only through posture and gestures.
- Realistic adult proportions. Age is shown through hair colour, hairstyle and posture.

HARD RULES (never break)
- No text, letters, numbers or symbols anywhere in the image, including on signs, screens,
  documents and licence plates. Licence plates are a plain white rectangle with a thin dark
  border and nothing written on it.
- No car or motorbike brand logos, badges or model names. Vehicles are generic.
- No police insignia, badges, shoulder boards, rank marks, flags, national emblems or exact
  copies of real uniforms. Officers wear a plain dark olive jacket, a generic fluorescent
  yellow-green reflective vest and a plain cap with no emblem.
- No real persons, no photorealism, no watermark.

Reply "Ready" and wait for my first request.
```

### 1.2. Mã kiểu (góc nhìn và khung hình)

| Mã | Góc nhìn | Khung | Dùng cho |
|---|---|---|---|
| `[PORTRAIT]` | Chân dung kiểu ảnh thẻ: đầu và vai, nhìn thẳng, nền xanh xám nhạt `#dfe6ec` | 1:1 | Ảnh trên giấy phép lái xe |
| `[STAND]` | Toàn thân, nhìn nghiêng 3/4, đứng cạnh xe của mình, xe nhìn ngang | 4:3 | Người lái đứng cạnh xe |
| `[SIDE]` | Xe nhìn ngang đúng mặt bên, đầu xe quay sang trái, bánh xe chạm một đường nền mảnh | 16:9 | Xe trong thẻ hồ sơ |
| `[FRONT34]` | Xe đang chạy tới, nhìn chếch 3/4 phía trước từ ngang tầm mắt người đứng lề đường | 4:3 | Súng bắn tốc độ |
| `[TOP]` | Nhìn thẳng từ trên xuống (trực giao), đầu xe hướng lên trên, không phối cảnh | 1:1 | Mô phỏng: Soi camera, Chốt đêm, Tự lái, Tái dựng |
| `[CAM]` | Ảnh từ camera giao thông gắn trên cột cao, nhìn chếch xuống, vẫn là tranh phẳng | 16:9 | Duyệt phạt nguội, Truy vết |
| `[SHEET]` | Bảng nhiều hình trên lưới đều, mỗi ô một hình, cùng tỷ lệ, cách nhau rộng | 16:9 | Bộ hình dùng chung |

Khi gửi prompt, Gemini cần biết nghĩa của mã. Nếu Gemini không hiểu, dán thêm bảng này sau khối khởi động, dưới dạng: `[PORTRAIT] = head-and-shoulders ID photo, front view, background #dfe6ec, 1:1` và tương tự cho các mã còn lại. Bản tiếng Anh đầy đủ:

```text
Shot codes I will use at the start of each request:
[PORTRAIT] head-and-shoulders ID-photo style, front view, plain light blue-grey background #dfe6ec, square 1:1.
[STAND]    full body, three-quarter view, the person standing beside their vehicle; vehicle in side view; 4:3.
[SIDE]     vehicle in exact side profile facing left, wheels on a thin ground line; 16:9.
[FRONT34]  vehicle approaching, front three-quarter view from eye level at the roadside; 4:3.
[TOP]      strict top-down orthographic view, vehicle nose pointing up, no perspective; 1:1.
[CAM]      still frame from a pole-mounted traffic camera, high angle looking down at the road,
           still flat vector style; 16:9.
[SHEET]    several items on an even grid, one item per cell, same scale, wide spacing; 16:9.
```

### 1.3. Quy tắc cứng khi duyệt ảnh

- Không chữ, không số, kể cả trên biển số, biển báo, màn hình máy đo. Trò chơi tự vẽ chữ và biển số đè lên sau.
- Không logo hãng xe. Dáng xe chỉ gợi kiểu xe (sedan, MPV, tay ga, xe số), không sao chép mẫu xe thật.
- Không quân hiệu, cấp hiệu, phù hiệu, cờ, quốc huy. Không vẽ đúng mẫu cảnh phục thật ([VISUAL_STYLE.md](VISUAL_STYLE.md) §1).
- Không mặt người chi tiết ([GAME_DESIGN.md](GAME_DESIGN.md) §5.1: "hình khối trung tính, không mặt chi tiết").
- Không phong cách hoạt hình, không màu kẹo ngọt ([VISUAL_STYLE.md](VISUAL_STYLE.md) §1).

---

## 2. Bộ hình dùng chung cho nhiều trò

| Tệp | Prompt | Dùng ở |
|---|---|---|
| `chung-can-bo-dung.png` | `[STAND] A traffic officer standing at the roadside without a vehicle, plain dark olive jacket and trousers, fluorescent yellow-green reflective vest, plain cap with no emblem, holding a red-and-white striped baton raised to signal a vehicle to stop.` | Dừng xe, Kiểm tra giấy tờ, Lập biên bản |
| `chung-can-bo-may-do.png` | `[STAND] The same traffic officer holding a handheld breath alcohol tester with a blank screen, arm extended toward an unseen driver.` | Dừng xe, Lập biên bản |
| `chung-can-bo-sung-toc-do.png` | `[STAND] The same traffic officer at the roadside aiming a handheld radar speed gun with a blank screen at oncoming traffic.` | Súng bắn tốc độ |
| `chung-can-bo-tren-xuong.png` | `[TOP] Top-down view of a standing traffic officer: cap, shoulders with the reflective vest, one arm extended with a red-and-white baton. Small, readable at 32 px.` | Chốt đêm |
| `chung-nguoi-di-bo.png` | `[SHEET] Six top-down pedestrians walking, seen from directly above: adult with backpack, adult with umbrella, elderly person with a cane, adult carrying a shopping bag, adult holding a child's hand, teenager with a school bag. Small, readable at 32 px.` | Tự lái |
| `chung-o-to-tren-xuong.png` | `[SHEET] [TOP] Eight identical generic compact sedans from directly above in white, black, silver, grey, red, blue, yellow and green. Visible roof, windscreen and rear window, side mirrors.` | Soi camera, Chốt đêm, Tự lái, Tái dựng |
| `chung-xe-may-tren-xuong.png` | `[SHEET] [TOP] Top-down motorbikes with one rider: four riders wearing a helmet (helmet clearly visible as a round shell) and four riders bareheaded with visible hair, in mixed bike colours.` | Soi camera, Tự lái, Duyệt phạt nguội |
| `chung-xe-tai-tren-xuong.png` | `[SHEET] [TOP] Generic light box trucks from directly above in blue, white and green: cab at the top, long cargo box behind.` | Soi camera, Chốt đêm, Tự lái |
| `chung-xe-khach-tren-xuong.png` | `[SHEET] [TOP] Generic coaches from directly above: 16-seat minibus, 29-seat bus, 45-seat coach. White with a plain coloured stripe.` | Chốt đêm |
| `chung-xe-uu-tien-tren-xuong.png` | `[SHEET] [TOP] Generic emergency vehicles from directly above: a white ambulance-type van and a red fire-engine-type truck, each with a light bar on the roof. No text, no crosses, no emblems.` | Soi camera, Chốt đêm, Tái dựng |


---

## 3. Kiểm tra giấy tờ (30 hồ sơ)

Mỗi hồ sơ có hai ảnh: chân dung trên giấy phép (`[PORTRAIT]`) và người lái đứng cạnh xe (`[STAND]`). Tuổi tính tại ngày kiểm tra trong hồ sơ. Người lái xe máy cầm mũ bảo hiểm trên tay để không che đầu.

| Mã | Người lái (tuổi) | Xe | Tệp | Prompt |
|---|---|---|---|---|
| KTGT-01 | Ngô Quốc Long (30) | Mitsubishi Xpander, trắng | `ktgt-01-chan-dung.png` | `[PORTRAIT] a 30-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-01-canh-xe.png` | `[STAND] a 30-year-old Vietnamese adult wearing a neat collared shirt and trousers, standing beside a white 7-seat compact MPV, holding out a few papers with one hand.` |
| KTGT-02 | Ngô Mai Trang (31) | Honda Vision, bạc | `ktgt-02-chan-dung.png` | `[PORTRAIT] a 31-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-02-canh-xe.png` | `[STAND] a 31-year-old Vietnamese adult wearing a light windbreaker jacket and jeans, holding an open-face helmet, standing beside a silver small step-through scooter (about 110 cc), holding out a few papers with one hand.` |
| KTGT-03 | Hoàng Mai Hạnh (54) | Yamaha Exciter, xanh | `ktgt-03-chan-dung.png` | `[PORTRAIT] a 54-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-03-canh-xe.png` | `[STAND] a 54-year-old Vietnamese adult wearing a light windbreaker jacket and jeans, holding an open-face helmet, standing beside a blue underbone sport motorbike with manual clutch (about 155 cc), holding out a few papers with one hand.` |
| KTGT-04 | Đỗ Kim Vy (35) | Kia Morning, xanh | `ktgt-04-chan-dung.png` | `[PORTRAIT] a 35-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-04-canh-xe.png` | `[STAND] a 35-year-old Vietnamese adult wearing a neat collared shirt and trousers, standing beside a blue small 5-door city hatchback, holding out a few papers with one hand.` |
| KTGT-05 | Lê Văn Sơn (32) | Honda SH 160i, xanh | `ktgt-05-chan-dung.png` | `[PORTRAIT] a 32-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-05-canh-xe.png` | `[STAND] a 32-year-old Vietnamese adult wearing a light windbreaker jacket and jeans, holding an open-face helmet, standing beside a blue large premium scooter with flat floorboard (about 160 cc), holding out a few papers with one hand.` |
| KTGT-06 | Hoàng Văn Bình (53) | Hyundai Accent, xanh | `ktgt-06-chan-dung.png` | `[PORTRAIT] a 53-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-06-canh-xe.png` | `[STAND] a 53-year-old Vietnamese adult wearing a neat collared shirt and trousers, standing beside a blue compact 4-door sedan, holding out a few papers with one hand.` |
| KTGT-07 | Hoàng Quốc Hùng (38) | Mitsubishi Xpander, đỏ | `ktgt-07-chan-dung.png` | `[PORTRAIT] a 38-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-07-canh-xe.png` | `[STAND] a 38-year-old Vietnamese adult wearing a neat collared shirt and trousers, standing beside a red 7-seat compact MPV, holding out a few papers with one hand.` |
| KTGT-08 | Lê Hữu Bình (54) | Mitsubishi Xpander, bạc | `ktgt-08-chan-dung.png` | `[PORTRAIT] a 54-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-08-canh-xe.png` | `[STAND] a 54-year-old Vietnamese adult wearing a neat collared shirt and trousers, standing beside a silver 7-seat compact MPV, holding out a few papers with one hand.` |
| KTGT-09 | Phạm Công An (32) | Honda SH 160i, đỏ | `ktgt-09-chan-dung.png` | `[PORTRAIT] a 32-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-09-canh-xe.png` | `[STAND] a 32-year-old Vietnamese adult wearing a light windbreaker jacket and jeans, holding an open-face helmet, standing beside a red large premium scooter with flat floorboard (about 160 cc), holding out a few papers with one hand.` |
| KTGT-10 | Bùi Minh Việt (41) | Honda SH 160i, đỏ | `ktgt-10-chan-dung.png` | `[PORTRAIT] a 41-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-10-canh-xe.png` | `[STAND] a 41-year-old Vietnamese adult wearing a light windbreaker jacket and jeans, holding an open-face helmet, standing beside a red large premium scooter with flat floorboard (about 160 cc), holding out a few papers with one hand.` |
| KTGT-11 | Ngô Ngọc Lan (46) | Honda Winner X, bạc | `ktgt-11-chan-dung.png` | `[PORTRAIT] a 46-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-11-canh-xe.png` | `[STAND] a 46-year-old Vietnamese adult wearing a light windbreaker jacket and jeans, holding an open-face helmet, standing beside a silver underbone sport motorbike with manual clutch (about 150 cc), holding out a few papers with one hand.` |
| KTGT-12 | Lê Thanh Hà (24) | Suzuki Raider, vàng | `ktgt-12-chan-dung.png` | `[PORTRAIT] a 24-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-12-canh-xe.png` | `[STAND] a 24-year-old Vietnamese adult wearing a light windbreaker jacket and jeans, holding an open-face helmet, standing beside a yellow slim underbone sport motorbike (about 115 cc), holding out a few papers with one hand.` |
| KTGT-13 | Ngô Kim Chi (54) | Yamaha NVX, trắng | `ktgt-13-chan-dung.png` | `[PORTRAIT] a 54-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-13-canh-xe.png` | `[STAND] a 54-year-old Vietnamese adult wearing a light windbreaker jacket and jeans, holding an open-face helmet, standing beside a white sporty maxi-scooter (about 155 cc), holding out a few papers with one hand.` |
| KTGT-14 | Phạm Thanh Chi (42) | Hyundai Accent, xanh | `ktgt-14-chan-dung.png` | `[PORTRAIT] a 42-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-14-canh-xe.png` | `[STAND] a 42-year-old Vietnamese adult wearing a neat collared shirt and trousers, standing beside a blue compact 4-door sedan, holding out a few papers with one hand.` |
| KTGT-15 | Lê Quốc An (30) | Mitsubishi Xpander, đen | `ktgt-15-chan-dung.png` | `[PORTRAIT] a 30-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-15-canh-xe.png` | `[STAND] a 30-year-old Vietnamese adult wearing a neat collared shirt and trousers, standing beside a black 7-seat compact MPV, holding out a few papers with one hand.` |
| KTGT-16 | Dương Thị Phương (51) | Honda Wave Alpha, đen | `ktgt-16-chan-dung.png` | `[PORTRAIT] a 51-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-16-canh-xe.png` | `[STAND] a 51-year-old Vietnamese adult wearing a light windbreaker jacket and jeans, holding an open-face helmet, standing beside a black basic cub-style underbone motorbike (about 110 cc), holding out a few papers with one hand.` |
| KTGT-17 | Lê Đức Việt (23) | Honda Air Blade, bạc | `ktgt-17-chan-dung.png` | `[PORTRAIT] a 23-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-17-canh-xe.png` | `[STAND] a 23-year-old Vietnamese adult wearing a light windbreaker jacket and jeans, holding an open-face helmet, standing beside a silver sporty mid-size scooter (about 125 cc), holding out a few papers with one hand.` |
| KTGT-18 | Ngô Công Hùng (45) | Honda SH 160i, đen | `ktgt-18-chan-dung.png` | `[PORTRAIT] a 45-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-18-canh-xe.png` | `[STAND] a 45-year-old Vietnamese adult wearing a light windbreaker jacket and jeans, holding an open-face helmet, standing beside a black large premium scooter with flat floorboard (about 160 cc), holding out a few papers with one hand.` |
| KTGT-19 | Trần Hữu Quang (46) | Honda Winner X, đỏ | `ktgt-19-chan-dung.png` | `[PORTRAIT] a 46-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-19-canh-xe.png` | `[STAND] a 46-year-old Vietnamese adult wearing a light windbreaker jacket and jeans, holding an open-face helmet, standing beside a red underbone sport motorbike with manual clutch (about 150 cc), holding out a few papers with one hand.` |
| KTGT-20 | Trần Hữu Tuấn (37) | Mitsubishi Xpander, đỏ | `ktgt-20-chan-dung.png` | `[PORTRAIT] a 37-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-20-canh-xe.png` | `[STAND] a 37-year-old Vietnamese adult wearing a neat collared shirt and trousers, standing beside a red 7-seat compact MPV, holding out a few papers with one hand.` |
| KTGT-21 | Đỗ Đức Hùng (25) | Mitsubishi Xpander, xám | `ktgt-21-chan-dung.png` | `[PORTRAIT] a 25-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-21-canh-xe.png` | `[STAND] a 25-year-old Vietnamese adult wearing a neat collared shirt and trousers, standing beside a grey 7-seat compact MPV, holding out a few papers with one hand.` |
| KTGT-22 | Bùi Hữu Cường (25) | Honda SH 160i, xám | `ktgt-22-chan-dung.png` | `[PORTRAIT] a 25-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-22-canh-xe.png` | `[STAND] a 25-year-old Vietnamese adult wearing a light windbreaker jacket and jeans, holding an open-face helmet, standing beside a grey large premium scooter with flat floorboard (about 160 cc), holding out a few papers with one hand.` |
| KTGT-23 | Phạm Quốc Bình (30) | Yamaha Exciter, trắng | `ktgt-23-chan-dung.png` | `[PORTRAIT] a 30-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-23-canh-xe.png` | `[STAND] a 30-year-old Vietnamese adult wearing a light windbreaker jacket and jeans, holding an open-face helmet, standing beside a white underbone sport motorbike with manual clutch (about 155 cc), holding out a few papers with one hand.` |
| KTGT-24 | Ngô Công Cường (36) | Yamaha NVX, vàng | `ktgt-24-chan-dung.png` | `[PORTRAIT] a 36-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-24-canh-xe.png` | `[STAND] a 36-year-old Vietnamese adult wearing a light windbreaker jacket and jeans, holding an open-face helmet, standing beside a yellow sporty maxi-scooter (about 155 cc), holding out a few papers with one hand.` |
| KTGT-25 | Đặng Công Tuấn (35) | Yamaha NVX, trắng | `ktgt-25-chan-dung.png` | `[PORTRAIT] a 35-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-25-canh-xe.png` | `[STAND] a 35-year-old Vietnamese adult wearing a light windbreaker jacket and jeans, holding an open-face helmet, standing beside a white sporty maxi-scooter (about 155 cc), holding out a few papers with one hand.` |
| KTGT-26 | Đặng Công Hùng (57) | Yamaha Exciter, đen | `ktgt-26-chan-dung.png` | `[PORTRAIT] a 57-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-26-canh-xe.png` | `[STAND] a 57-year-old Vietnamese adult wearing a light windbreaker jacket and jeans, holding an open-face helmet, standing beside a black underbone sport motorbike with manual clutch (about 155 cc), holding out a few papers with one hand.` |
| KTGT-27 | Dương Quốc Dũng (35) | Honda SH 160i, đen | `ktgt-27-chan-dung.png` | `[PORTRAIT] a 35-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-27-canh-xe.png` | `[STAND] a 35-year-old Vietnamese adult wearing a light windbreaker jacket and jeans, holding an open-face helmet, standing beside a black large premium scooter with flat floorboard (about 160 cc), holding out a few papers with one hand.` |
| KTGT-28 | Phạm Thanh Ngân (35) | Honda City, đen | `ktgt-28-chan-dung.png` | `[PORTRAIT] a 31-year-old Vietnamese adult, plain collared shirt. This must look clearly like a different person from the 35-year-old driver: different hairstyle and build.` Giấy phép của người khác (sinh 1995-04-01, 31 tuổi): chân dung phải khác người lái. |
| | | | `ktgt-28-canh-xe.png` | `[STAND] a 35-year-old Vietnamese adult wearing a neat collared shirt and trousers, standing beside a black compact 4-door sedan, holding out a few papers with one hand.` |
| KTGT-29 | Vũ Gia Quang (36) | Yamaha Sirius, đỏ | `ktgt-29-chan-dung.png` | `[PORTRAIT] a 36-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-29-canh-xe.png` | `[STAND] a 36-year-old Vietnamese adult wearing a light windbreaker jacket and jeans, holding an open-face helmet, standing beside a red basic cub-style underbone motorbike (about 110 cc), holding out a few papers with one hand.` |
| KTGT-30 | Lê Hữu Bình (32) | Honda Air Blade, xanh | `ktgt-30-chan-dung.png` | `[PORTRAIT] a 32-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| | | | `ktgt-30-canh-xe.png` | `[STAND] a 32-year-old Vietnamese adult wearing a light windbreaker jacket and jeans, holding an open-face helmet, standing beside a blue sporty mid-size scooter (about 125 cc), holding out a few papers with one hand.` |

---

## 4. Dừng xe đúng quy trình (5 tình huống)

Dáng người theo diễn biến tình huống: thái độ, giờ trong ngày, có dấu hiệu đã uống rượu bia hay không. Mỗi tình huống có thêm một chân dung `[PORTRAIT]` như mục 3 nếu màn chơi hiện giấy phép.

| Mã | Người lái (tuổi) | Bối cảnh | Tệp | Prompt |
|---|---|---|---|---|
| DX-01 | Ngô Thu Lan (26) | Buổi sáng, tổ công tác làm nhiệm vụ trên đường tỉnh. Một xe mô tô đi tới, chạy đúng làn. | `dx-01-canh-xe.png` | `[STAND] a 26-year-old Vietnamese adult holding an open-face helmet, standing beside a blue slim underbone sport motorbike (about 115 cc), standing calmly and cooperatively, handing over papers. Morning light.` |
| | | | `dx-01-chan-dung.png` | `[PORTRAIT] a 26-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| DX-02 | Lê Thanh Hương (52) | Buổi chiều, trên quốc lộ gần một khúc cua và một cây cầu hẹp. Một xe ô tô con đi tới. | `dx-02-canh-xe.png` | `[STAND] a 52-year-old Vietnamese adult standing beside a yellow compact 4-door sedan, standing calmly, handing over papers, relaxed posture.` |
| | | | `dx-02-chan-dung.png` | `[PORTRAIT] a 52-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| DX-03 | Vũ Quốc Tuấn (33) | Buổi tối, gần khu quán ăn. Một xe mô tô đi tới; người lái tỏ ra khó chịu khi thấy tổ công tác. | `dx-03-canh-xe.png` | `[STAND] a 33-year-old Vietnamese adult holding an open-face helmet, standing beside a silver sporty mid-size scooter (about 125 cc), arms crossed, body turned slightly away, impatient and irritated posture. Evening.` |
| | | | `dx-03-chan-dung.png` | `[PORTRAIT] a 33-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| DX-04 | Đặng Bảo Linh (27) | Tối thứ Bảy, trên đường vành đai. Một xe ô tô con đi tới, người lái vừa rời một nhà hàng. | `dx-04-canh-xe.png` | `[STAND] a 27-year-old Vietnamese adult standing beside a red sporty compact 4-door sedan, dressed for a dinner out, slightly unsteady stance with one hand on the car roof. Night.` |
| | | | `dx-04-chan-dung.png` | `[PORTRAIT] a 27-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |
| DX-05 | Vũ Văn Sơn (44) | Gần nửa đêm, trên đường ven sông. Một xe mô tô phân khối lớn đi tới khá nhanh. | `dx-05-canh-xe.png` | `[STAND] a 44-year-old Vietnamese adult holding an open-face helmet, standing beside a red underbone sport motorbike with manual clutch (about 150 cc), both palms pressed together in a pleading gesture, leaning toward the viewer. Late night.` |
| | | | `dx-05-chan-dung.png` | `[PORTRAIT] a 44-year-old Vietnamese adult, plain collared shirt, neat hair suited to their age.` |

---

## 5. Lập biên bản (42 tình huống)

Ảnh minh họa lời kể, nên vẽ người lái **đang thực hiện hành vi** trong lời kể. Tuổi ước theo cách gọi: "anh", "chị" khoảng 20–40; "ông", "bà" khoảng 50 trở lên. Khung `[SIDE]` mở rộng thành cảnh có nền đường giản lược.

| Mã | Người vi phạm | Hành vi | Tệp | Prompt |
|---|---|---|---|---|
| lbb-01 | anh Trần Văn H. | mt-mu-bao-hiem | `lbb-01.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 30s riding a generic underbone motorbike on a city street with no helmet, hair blowing, no passenger. Morning.` |
| lbb-02 | chị Lê Thị M. | mt-mu-bao-hiem | `lbb-02.png` | `[SIDE] Simple roadside scene: a Vietnamese woman in her 40s riding a small step-through scooter, wearing a helmet with the chin strap unbuckled and the helmet tilted far back on her head, a shopping bag hanging from the hook.` |
| lbb-03 | ông Phạm Quốc T. | oto-day-an-toan | `lbb-03.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 50s driving a 5-seat sedan, seen through the side window, seatbelt clearly hanging unused beside him.` |
| lbb-04 | Anh Đỗ Minh K. | oto-dien-thoai | `lbb-04.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 30s driving a sedan, seen through the side window, holding a phone to his ear with one hand while driving.` |
| lbb-05 | anh Vũ Đức L. | mt-dien-thoai | `lbb-05.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 20s riding a scooter wearing a helmet, looking down at a phone in one hand while riding, weaving slightly.` |
| lbb-06 | ông Nguyễn Hữu P. | oto-den-do | `lbb-06.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 50s driving a pickup truck past a stop line at an intersection while the traffic light is red.` |
| lbb-07 | Anh Hoàng Văn S. | mt-den-do | `lbb-07.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 30s riding a motorbike wearing a helmet straight through an intersection on a red light while other vehicles wait behind the stop line.` |
| lbb-08 | ông Bùi Văn C. | oto-con-muc-1 | `lbb-08.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 50s standing beside his sedan, calmly blowing into a handheld breath tester held by an officer, cooperative posture.` |
| lbb-09 | anh Trịnh Quang V. | oto-con-muc-2 | `lbb-09.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 30s standing beside his sedan at night at a checkpoint, blowing into a breath tester. Night lighting.` |
| lbb-10 | ông Lý Thành D. | oto-con-muc-3 | `lbb-10.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 50s standing beside a light truck at night, head lowered, admitting he drank at dinner.` |
| lbb-11 | Anh Đặng Văn Q. | mt-con-muc-1 | `lbb-11.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 30s standing beside his motorbike holding a helmet, raising one finger as if saying he only had one beer.` |
| lbb-12 | anh Mai Xuân B. | mt-con-muc-3 | `lbb-12.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 30s riding a scooter slowly and unsteadily late at night, front wheel turned at an awkward angle.` |
| lbb-13 | Anh Tạ Văn N. | mt-con-khong-chap-hanh | `lbb-13.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 30s standing beside his motorbike, holding up one palm to refuse a breath tester offered by an officer, head shaking.` |
| lbb-14 | bà Hồ Thị Y. | oto-con-khong-chap-hanh | `lbb-14.png` | `[SIDE] Simple roadside scene: a Vietnamese woman in her 50s sitting in a sedan with the window closed, talking on a phone, ignoring an officer who is holding a breath tester at the window.` |
| lbb-15 | anh Lương Đình G. | oto-toc-do-10-20 | `lbb-15.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 30s driving a sedan fast along an urban road, subtle speed lines behind the car.` |
| lbb-16 | chị Kiều Thị Ph. | mt-toc-do-5-10 | `lbb-16.png` | `[SIDE] Simple roadside scene: a Vietnamese woman in her 30s riding a motorbike wearing a helmet along a road, subtle speed lines behind the bike.` |
| lbb-17 | ông Chu Văn E. | oto-toc-do-tren-35 | `lbb-17.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 50s driving a white 16-seat minibus very fast on a national highway, strong speed lines behind the vehicle.` |
| lbb-18 | Anh Tô Văn R. | mt-mu-bao-hiem, mt-den-do | `lbb-18.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 30s riding a motorbike with no helmet straight through an intersection on a red light.` |
| lbb-19 | ông Quách Minh X. | oto-dien-thoai, oto-day-an-toan | `lbb-19.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 50s driving a sedan, seen through the side window, phone in his right hand at his ear, seatbelt hanging unused.` |
| lbb-20 | anh Ninh Văn Z. | mt-con-muc-1, mt-mu-bao-hiem | `lbb-20.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 30s riding a scooter at night with no helmet, then standing beside it blowing into a breath tester.` |
| lbb-21 | chị Phan Thị A. | oto-toc-do-5-10 | `lbb-21.png` | `[SIDE] Simple roadside scene: a Vietnamese woman in her 30s driving a compact sedan through a residential street, a 50 km/h speed limit sign at the roadside, subtle speed lines behind the car.` |
| lbb-22 | anh Hà Văn T. | oto-toc-do-20-35 | `lbb-22.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 30s driving a box truck fast along a rural national highway, a 70 km/h speed limit sign at the roadside, speed lines behind the truck.` |
| lbb-23 | ông Lã Văn K. | oto-toc-do-10-20 | `lbb-23.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 50s standing beside his sedan, holding up thumb and finger close together as if saying "just a little over", officer holding a printed speed reading.` |
| lbb-24 | anh Viên Đức M. | oto-toc-do-20-35 | `lbb-24.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 30s driving a sedan fast on a national highway, an 80 km/h speed limit sign at the roadside, strong speed lines behind the car.` |
| lbb-25 | anh Lục Văn D. | mt-toc-do-10-20 | `lbb-25.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 20s riding a motorbike wearing a helmet past a school gate, a 40 km/h speed limit sign at the roadside, subtle speed lines behind the bike.` |
| lbb-26 | anh Thân Quốc B. | mt-toc-do-tren-20 | `lbb-26.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 30s riding a large-displacement motorbike wearing a full-face helmet fast along a bypass road, strong speed lines behind the bike. Afternoon.` |
| lbb-27 | anh Cù Văn H. | mt-con-muc-2 | `lbb-27.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 30s standing beside his scooter near a roadside eatery, blowing into a breath tester held by an officer. Evening.` |
| lbb-28 | ông Âu Minh S. | oto-con-muc-2 | `lbb-28.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 50s standing beside his sedan, one hand on his chest breathing with difficulty, an officer gesturing kindly toward a clinic sign nearby.` |
| lbb-29 | chị Quan Thị L. | mt-den-do | `lbb-29.png` | `[SIDE] Simple roadside scene: a Vietnamese woman in her 30s riding a motorbike wearing a helmet, accelerating toward an intersection while the traffic light shows yellow, stop line still ahead of her.` |
| lbb-30 | anh Kha Văn P. | oto-den-do | `lbb-30.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 30s driving a sedan turning right at an intersection while the traffic light is red, no right-turn-allowed sign present.` |
| lbb-31 | chị Đinh Thị G. | mt-dien-thoai | `lbb-31.png` | `[SIDE] Simple roadside scene: a Vietnamese woman in her 30s riding a scooter in light rain, wearing a buckled helmet, holding an open umbrella in her left hand while steering with her right.` |
| lbb-32 | anh Lò Văn E. | mt-dien-thoai | `lbb-32.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 20s riding a motorbike wearing a helmet and over-ear headphones, music notes drawn near his head, a car behind him honking.` |
| lbb-33 | anh Mạc Văn I. | oto-toc-do-20-35, oto-day-an-toan | `lbb-33.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 30s driving a sedan fast, seen through the side window, seatbelt hanging unused beside him, speed lines behind the car.` |
| lbb-34 | anh Giang Văn O. | oto-con-muc-2, oto-den-do | `lbb-34.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 30s driving a sedan straight through an intersection on a red light at night. Night lighting.` |
| lbb-35 | anh Ông Văn U. | mt-toc-do-tren-20, mt-mu-bao-hiem | `lbb-35.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 30s riding a motorbike fast with no helmet on his head, a helmet hanging from the hook under the seat, speed lines behind the bike.` |
| lbb-36 | anh Văn Đình C. | mt-con-muc-2, mt-dien-thoai | `lbb-36.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 30s riding a scooter wearing a helmet, holding a phone to his ear with one hand while riding. Evening.` |
| lbb-37 | ông Doãn Văn N. | oto-con-khong-chap-hanh, oto-day-an-toan | `lbb-37.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 50s sitting in a sedan with no seatbelt on, arms crossed, refusing a breath tester offered by an officer at the open window.` |
| lbb-38 | anh Khổng Văn J. | mt-con-muc-3, mt-mu-bao-hiem | `lbb-38.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 30s riding a motorbike unsteadily at night with no helmet, front wheel wobbling. Night lighting.` |
| lbb-39 | chị Tôn Nữ Q. | oto-toc-do-5-10, oto-dien-thoai | `lbb-39.png` | `[SIDE] Simple roadside scene: a Vietnamese woman in her 30s driving a compact sedan, seen through the side window, texting on a phone held in one hand while driving.` |
| lbb-40 | anh Lại Văn W. | mt-toc-do-10-20, mt-den-do | `lbb-40.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 30s riding a motorbike wearing a helmet fast through an intersection on a red light, subtle speed lines behind the bike.` |
| lbb-41 | bà Ngô Thị V. | mt-mu-bao-hiem | `lbb-41.png` | `[SIDE] Simple roadside scene: a Vietnamese woman in her 50s riding a step-through scooter wearing a wide-brimmed cloth sun hat instead of a helmet. Sunny midday.` |
| lbb-42 | anh Sầm Văn F. | oto-con-muc-1 | `lbb-42.png` | `[SIDE] Simple roadside scene: a Vietnamese man in his 30s standing beside his sedan at midday, blowing into a breath tester held by an officer, looking surprised.` |

---

## 6. Súng bắn tốc độ (20 tình huống)

Chỉ cần xe. Tốc độ đo được không thấy bằng mắt, nên không vẽ vệt tốc độ: người chơi phải đọc máy đo, không đoán theo hình.

| Mã | Xe (dữ liệu) | Bối cảnh | Tệp | Prompt |
|---|---|---|---|---|
| sbtd-01 | Xe ô tô con màu trắng | Đoạn đường có biển P.127 giới hạn 50 km/h, đo 48 km/h | `sbtd-01.png` | `[FRONT34] a white compact sedan approaching on an asphalt road, no motion blur.` |
| sbtd-02 | Xe ô tô con màu đen | Đoạn đường có biển P.127 giới hạn 60 km/h, đo 63 km/h | `sbtd-02.png` | `[FRONT34] a black compact sedan approaching on an asphalt road, no motion blur.` |
| sbtd-03 | Xe ô tô bán tải | Đoạn đường có biển P.127 giới hạn 80 km/h, đo 86 km/h | `sbtd-03.png` | `[FRONT34] a pickup truck approaching on an asphalt road, no motion blur.` |
| sbtd-04 | Xe ô tô con màu bạc | Đoạn đường có biển P.127 giới hạn 50 km/h, đo 60 km/h | `sbtd-04.png` | `[FRONT34] a silver compact sedan approaching on an asphalt road, no motion blur.` |
| sbtd-05 | Xe ô tô khách nhỏ | Đoạn đường có biển P.127 giới hạn 90 km/h, đo 104 km/h | `sbtd-05.png` | `[FRONT34] a white 16-seat minibus approaching on an asphalt road, no motion blur.` |
| sbtd-06 | Xe ô tô con màu xanh | Đoạn đường có biển P.127 giới hạn 60 km/h, đo 80 km/h | `sbtd-06.png` | `[FRONT34] a blue compact sedan approaching on an asphalt road, no motion blur.` |
| sbtd-07 | Xe ô tô tải nhẹ | Đoạn đường có biển P.127 giới hạn 60 km/h, đo 81 km/h | `sbtd-07.png` | `[FRONT34] a light box truck approaching on an asphalt road, no motion blur.` |
| sbtd-08 | Xe ô tô con màu đỏ | Đoạn đường có biển P.127 giới hạn 80 km/h, đo 115 km/h | `sbtd-08.png` | `[FRONT34] a red compact sedan approaching on an asphalt road, no motion blur.` |
| sbtd-09 | Xe ô tô con màu trắng | Đoạn đường có biển P.127 giới hạn 50 km/h, đo 86 km/h | `sbtd-09.png` | `[FRONT34] a white compact sedan approaching on an asphalt road, no motion blur.` |
| sbtd-10 | Xe ô tô con màu xám | Đoạn đường có biển P.127 giới hạn 70 km/h, đo 74.5 km/h | `sbtd-10.png` | `[FRONT34] a grey compact sedan approaching on an asphalt road, no motion blur.` |
| sbtd-11 | Xe ô tô con màu vàng | Đoạn đường có biển P.127 giới hạn 40 km/h, đo 45 km/h | `sbtd-11.png` | `[FRONT34] a yellow compact sedan approaching on an asphalt road, no motion blur.` |
| sbtd-12 | Xe ô tô bán tải màu đen | Đoạn đường có biển P.127 giới hạn 100 km/h, đo 128 km/h | `sbtd-12.png` | `[FRONT34] a black pickup truck approaching on an asphalt road, no motion blur.` |
| sbtd-13 | Xe mô tô màu đen | Đoạn đường có biển P.127 giới hạn 40 km/h, đo 38 km/h | `sbtd-13.png` | `[FRONT34] a black underbone motorbike with one rider wearing a helmet approaching on an asphalt road, no motion blur.` |
| sbtd-14 | Xe gắn máy màu đỏ | Đoạn đường có biển P.127 giới hạn 50 km/h, đo 54 km/h | `sbtd-14.png` | `[FRONT34] a red small step-through scooter with one rider wearing a helmet approaching on an asphalt road, no motion blur.` |
| sbtd-15 | Xe mô tô màu xanh | Đoạn đường có biển P.127 giới hạn 40 km/h, đo 47 km/h | `sbtd-15.png` | `[FRONT34] a blue underbone motorbike with one rider wearing a helmet approaching on an asphalt road, no motion blur.` |
| sbtd-16 | Xe mô tô màu trắng | Đoạn đường có biển P.127 giới hạn 60 km/h, đo 70 km/h | `sbtd-16.png` | `[FRONT34] a white underbone motorbike with one rider wearing a helmet approaching on an asphalt road, no motion blur.` |
| sbtd-17 | Xe gắn máy màu xám | Đoạn đường có biển P.127 giới hạn 50 km/h, đo 65 km/h | `sbtd-17.png` | `[FRONT34] a grey small step-through scooter with one rider wearing a helmet approaching on an asphalt road, no motion blur.` |
| sbtd-18 | Xe mô tô màu đỏ | Đoạn đường có biển P.127 giới hạn 40 km/h, đo 60 km/h | `sbtd-18.png` | `[FRONT34] a red underbone motorbike with one rider wearing a helmet approaching on an asphalt road, no motion blur.` |
| sbtd-19 | Xe mô tô màu vàng | Đoạn đường có biển P.127 giới hạn 50 km/h, đo 72 km/h | `sbtd-19.png` | `[FRONT34] a yellow underbone motorbike with one rider wearing a helmet approaching on an asphalt road, no motion blur.` |
| sbtd-20 | Xe mô tô phân khối lớn | Đoạn đường có biển P.127 giới hạn 60 km/h, đo 95 km/h | `sbtd-20.png` | `[FRONT34] a large sport motorcycle with one rider wearing a full-face helmet approaching on an asphalt road, no motion blur.` |

---

## 7. Trạm cân tải trọng (30 xe)

Trọng lượng hàng không thấy bằng mắt; xe khác nhau ở **số trục và cách bố trí trục**. Vẽ 4 kiểu xe, mỗi hồ sơ dùng lại kiểu tương ứng. Số trục trên hình phải đúng tuyệt đối, vì người chơi đếm trục trên hình.

| Kiểu | Hồ sơ dùng | Tệp | Prompt |
|---|---|---|---|
| xe_tai_2_truc | TC-01, TC-02, TC-03, TC-04, TC-05, TC-06, TC-07, TC-08, TC-09, TC-10, TC-13 | `tc-xe-2-truc.png` | `[SIDE] A generic medium cargo truck with 2 axles: one single front axle and one single rear axle with dual wheels, open-top cargo bed loaded with covered sacks, standing on a flat weighbridge platform.` |
| xe_tai_3_truc | TC-11, TC-12, TC-14, TC-15, TC-16, TC-17, TC-18, TC-20, TC-21, TC-22, TC-23, TC-25 | `tc-xe-3-truc.png` | `[SIDE] A generic heavy cargo truck with 3 axles: one single front axle and a tandem pair of rear axles close together, cargo bed loaded with covered sacks, standing on a flat weighbridge platform.` |
| xe_tai_4_truc | TC-19, TC-24 | `tc-xe-4-truc.png` | `[SIDE] A generic heavy cargo truck with 4 axles: two single front steering axles and a tandem pair of rear axles, cargo bed loaded with covered sacks, standing on a flat weighbridge platform.` |
| dau_keo_so_mi | TC-26, TC-27, TC-28, TC-29, TC-30 | `tc-dau-keo.png` | `[SIDE] A generic tractor unit pulling a flatbed semi-trailer: tractor with one front axle and a tandem pair of drive axles, semi-trailer with a group of three axles at the rear, carrying a covered container-sized load, standing on a long weighbridge platform.` |

---

## 8. Soi xe cải tạo (16 xe)

Vẽ **xe đang đứng trước mặt người chơi**, tức là xe sau khi đã cải tạo. Màu ghi trên giấy chứng nhận nằm ở cột "Giấy ghi"; xe có đổi màu thì màu trên hình khác màu giấy. Xe đúng giấy tờ vẽ nguyên bản, không thêm gì.

| Mã | Giấy ghi | Cải tạo | Tệp | Prompt |
|---|---|---|---|---|
| SX-01 | o_to_con, trang | doi-mau-son | `sx-01.png` | `[SIDE] a generic compact 5-seat sedan, body colour red, otherwise stock with no other modifications.` |
| SX-02 | o_to_con, bac | den-noc | `sx-02.png` | `[SIDE] a generic compact 5-seat sedan, body colour silver, with an aftermarket bar of extra lamps mounted on the roof.` |
| SX-03 | xe_khach_16, bac | doi-mau-son | `sx-03.png` | `[SIDE] a generic 16-seat high-roof minibus, body colour blue, otherwise stock with no other modifications.` |
| SX-04 | xe_tai_thung, xanh | den-noc | `sx-04.png` | `[SIDE] a generic light truck with a closed cargo box, body colour blue, with an aftermarket bar of extra lamps mounted on the roof.` |
| SX-05 | o_to_con, den | doi-mau-son | `sx-05.png` | `[SIDE] a generic compact 5-seat sedan, body colour yellow, otherwise stock with no other modifications.` |
| SX-06 | o_to_con, bac | không | `sx-06.png` | `[SIDE] a generic compact 5-seat sedan, body colour silver, completely stock with no modifications.` |
| SX-07 | xe_khach_16, bac | doi-mau-son, den-noc | `sx-07.png` | `[SIDE] a generic 16-seat high-roof minibus, body colour red, with an aftermarket bar of extra lamps mounted on the roof.` |
| SX-08 | xe_tai_thung, xanh | không | `sx-08.png` | `[SIDE] a generic light truck with a closed cargo box, body colour blue, completely stock with no modifications.` |
| SX-09 | o_to_con, trang | lop-lon | `sx-09.png` | `[SIDE] a generic compact 5-seat sedan, body colour white, with noticeably oversized wheels and tyres that look too big for the wheel arches.` |
| SX-10 | xe_tai_thung, xanh | ong-xa, doi-mau-son | `sx-10.png` | `[SIDE] a generic light truck with a closed cargo box, body colour white, with an oversized aftermarket exhaust pipe sticking out beyond the rear bumper.` |
| SX-11 | xe_khach_16, bac | lop-lon | `sx-11.png` | `[SIDE] a generic 16-seat high-roof minibus, body colour silver, with noticeably oversized wheels and tyres that look too big for the wheel arches.` |
| SX-12 | xe_tai_thung, xanh | thung-coi-cao | `sx-12.png` | `[SIDE] a generic light truck with a closed cargo box, body colour blue, with cargo box walls visibly extended upward by about 600 mm with a different-coloured extension band.` |
| SX-13 | xe_khach_16, bac | them-ghe | `sx-13.png` | `[SIDE] a generic 16-seat high-roof minibus, body colour silver, with extra seats visible through the windows in the rear luggage area.` |
| SX-14 | o_to_con, bac | ong-xa, den-noc | `sx-14.png` | `[SIDE] a generic compact 5-seat sedan, body colour silver, with an oversized aftermarket exhaust pipe sticking out beyond the rear bumper, and an aftermarket bar of extra lamps mounted on the roof.` |
| SX-15 | xe_tai_thung, trang | thung-coi-cao, lop-lon | `sx-15.png` | `[SIDE] a generic light truck with a closed cargo box, body colour white, with cargo box walls visibly extended upward by about 150 mm with a different-coloured extension band, and noticeably oversized wheels and tyres that look too big for the wheel arches.` |
| SX-16 | xe_tai_thung, trang | thung-dai, doi-mau-son, den-noc | `sx-16.png` | `[SIDE] a generic light truck with a closed cargo box, body colour yellow, with cargo box visibly extended backward by about 400 mm, overhanging the rear, and an aftermarket bar of extra lamps mounted on the roof.` |

---

## 9. Truy vết xe bỏ trốn (8 vụ)

Mỗi vụ cần ảnh xe bỏ chạy như camera dọc đường ghi lại. Biển số để trống, trò chơi tự in ký tự nhìn rõ (`ky_tu`) lên.

| Mã | Xe | Tệp | Prompt |
|---|---|---|---|
| tv-01 | o_to, do, 30A-586.21 | `tv-01.png` | `[CAM] A red compact sedan seen from behind and above, driving away along a city street, slight motion blur, other traffic faint in the background.` |
| tv-02 | xe_may, xanh_duong, 29H-307.48 | `tv-02.png` | `[CAM] A blue underbone motorbike with one rider wearing a helmet seen from behind and above, driving away along a city street, slight motion blur, other traffic faint in the background.` |
| tv-03 | o_to, trang, 51G-912.07 | `tv-03.png` | `[CAM] A white compact sedan seen from behind and above, driving away along a city street, slight motion blur, other traffic faint in the background.` |
| tv-04 | xe_tai, xanh_la, 34C-455.19 | `tv-04.png` | `[CAM] A green light box truck seen from behind and above, driving away along a city street, slight motion blur, other traffic faint in the background.` |
| tv-05 | o_to, den, 30K-248.63 | `tv-05.png` | `[CAM] A black compact sedan seen from behind and above, driving away along a city street, slight motion blur, other traffic faint in the background.` |
| tv-06 | xe_may, do, 29D-731.56 | `tv-06.png` | `[CAM] A red underbone motorbike with one rider wearing a helmet seen from behind and above, driving away along a city street, slight motion blur, other traffic faint in the background.` |
| tv-07 | o_to, bac, 30E-619.84 | `tv-07.png` | `[CAM] A silver compact sedan seen from behind and above, driving away along a city street, slight motion blur, other traffic faint in the background.` |
| tv-08 | o_to, den, 30F-368.02 | `tv-08.png` | `[CAM] A black compact sedan seen from behind and above, driving away along a city street, slight motion blur, other traffic faint in the background.` |

---

## 10. Duyệt hồ sơ phạt nguội (30 hồ sơ)

Ảnh camera đúng như dữ liệu hồ sơ: cảnh, màu đèn, xe đã qua vạch hay chưa, người lái có mũ hay không, độ mờ, ban đêm, bị che. Một số hồ sơ cố ý **không có vi phạm** (đèn xanh, có đội mũ, đi đúng làn). Ảnh phải thể hiện đúng điều đó, không vẽ theo hành vi đề xuất.

| Mã | Xe | Cảnh (dữ liệu) | Tệp | Prompt |
|---|---|---|---|---|
| PN-01 | o_to | giao_lo, đèn do, qua vạch | `pn-01.png` | `[CAM] a white compact sedan at a signalised intersection. The traffic light facing it is clearly RED, and the vehicle is already past the white stop line.` |
| PN-02 | mo_to | duong_thang, không mũ | `pn-02.png` | `[CAM] a motorbike with one rider on a straight urban road, the rider is NOT wearing a helmet, bare head and hair clearly visible.` |
| PN-03 | o_to | duong_thang | `pn-03.png` | `[CAM] a silver compact sedan on a straight urban road.` |
| PN-04 | mo_to | giao_lo, đèn do, qua vạch | `pn-04.png` | `[CAM] a motorbike with one rider at a signalised intersection. The traffic light facing it is clearly RED, and the vehicle is already past the white stop line.` |
| PN-05 | o_to | giao_lo, đèn do, qua vạch | `pn-05.png` | `[CAM] a red compact sedan at a signalised intersection. The traffic light facing it is clearly RED, and the vehicle is already past the white stop line.` |
| PN-06 | mo_to | duong_thang, không mũ | `pn-06.png` | `[CAM] a motorbike with one rider on a straight urban road, the rider is NOT wearing a helmet, bare head and hair clearly visible.` |
| PN-07 | o_to | duong_thang | `pn-07.png` | `[CAM] a white compact sedan on a straight urban road.` |
| PN-08 | o_to | giao_lo, đèn do, qua vạch, mờ 3 | `pn-08.png` | `[CAM] a black compact sedan at a signalised intersection. The traffic light facing it is clearly RED, and the vehicle is already past the white stop line. The image is very blurry and grainy.` |
| PN-09 | mo_to | duong_thang, không mũ, đêm, mờ 3 | `pn-09.png` | `[CAM] a motorbike with one rider on a straight urban road, the rider is NOT wearing a helmet, bare head and hair clearly visible. Night, street lights and headlights. The image is very blurry and grainy.` |
| PN-10 | mo_to | giao_lo, đèn do, qua vạch, mờ 3 | `pn-10.png` | `[CAM] a motorbike with one rider at a signalised intersection. The traffic light facing it is clearly RED, and the vehicle is already past the white stop line. The image is very blurry and grainy.` |
| PN-11 | o_to | giao_lo, đèn do, qua vạch, đêm, mờ 1 | `pn-11.png` | `[CAM] a red compact sedan at a signalised intersection. The traffic light facing it is clearly RED, and the vehicle is already past the white stop line. Night, street lights and headlights. The image is slightly blurry.` |
| PN-12 | o_to | giao_lo, đèn do, qua vạch | `pn-12.png` | `[CAM] a blue compact sedan at a signalised intersection. The traffic light facing it is clearly RED, and the vehicle is already past the white stop line.` |
| PN-13 | mo_to | duong_thang, không mũ | `pn-13.png` | `[CAM] a motorbike with one rider on a straight urban road, the rider is NOT wearing a helmet, bare head and hair clearly visible.` |
| PN-14 | o_to | duong_thang | `pn-14.png` | `[CAM] a black compact sedan on a straight urban road.` |
| PN-15 | mo_to | giao_lo, đèn do, qua vạch | `pn-15.png` | `[CAM] a motorbike with one rider at a signalised intersection. The traffic light facing it is clearly RED, and the vehicle is already past the white stop line.` |
| PN-16 | o_to | duong_lan, làn xe_may | `pn-16.png` | `[CAM] a grey compact sedan on a multi-lane road, driving in the lane marked for motorbikes (painted motorbike symbol on the asphalt, the car is in that lane).` |
| PN-17 | o_to | giao_lo, đèn xanh, qua vạch | `pn-17.png` | `[CAM] a red compact sedan at a signalised intersection. The traffic light facing it is clearly GREEN, and the vehicle is already past the white stop line.` |
| PN-18 | o_to | duong_thang | `pn-18.png` | `[CAM] a blue compact sedan on a straight urban road.` |
| PN-19 | mo_to | duong_thang, có mũ | `pn-19.png` | `[CAM] a motorbike with one rider on a straight urban road, the rider IS wearing a helmet, clearly visible.` |
| PN-20 | o_to | giao_lo, đèn do, qua vạch, che: xe_khac | `pn-20.png` | `[CAM] a black compact sedan at a signalised intersection. The traffic light facing it is clearly RED, and the vehicle is already past the white stop line. Another vehicle in front partly blocks the view of it.` |
| PN-21 | mo_to | duong_thang, không mũ, đêm, mờ 1 | `pn-21.png` | `[CAM] a motorbike with one rider on a straight urban road, the rider is NOT wearing a helmet, bare head and hair clearly visible. Night, street lights and headlights. The image is slightly blurry.` |
| PN-22 | o_to | duong_thang | `pn-22.png` | `[CAM] a grey compact sedan on a straight urban road.` |
| PN-23 | o_to | giao_lo, đèn do, qua vạch | `pn-23.png` | `[CAM] a red compact sedan at a signalised intersection. The traffic light facing it is clearly RED, and the vehicle is already past the white stop line.` |
| PN-24 | o_to | giao_lo, đèn do, qua vạch | `pn-24.png` | `[CAM] a blue compact sedan at a signalised intersection. The traffic light facing it is clearly RED, and the vehicle is already past the white stop line.` |
| PN-25 | o_to | duong_lan, làn o_to | `pn-25.png` | `[CAM] a white compact sedan on a multi-lane road, driving in the lane marked for cars (painted car symbol on the asphalt).` |
| PN-26 | mo_to | duong_thang, không mũ | `pn-26.png` | `[CAM] a motorbike with one rider on a straight urban road, the rider is NOT wearing a helmet, bare head and hair clearly visible.` |
| PN-27 | o_to | giao_lo, đèn do, qua vạch | `pn-27.png` | `[CAM] a silver compact sedan at a signalised intersection. The traffic light facing it is clearly RED, and the vehicle is already past the white stop line.` |
| PN-28 | o_to | loi_vao_cam | `pn-28.png` | `[CAM] a grey compact sedan turning into a side street entrance that has a round red-bordered prohibition sign for cars (pictogram only, no text).` |
| PN-29 | o_to | loi_vao_cam | `pn-29.png` | `[CAM] a red compact sedan turning into a side street entrance that has a round red-bordered prohibition sign for cars (pictogram only, no text).` |
| PN-30 | mo_to | giao_lo, đèn do, qua vạch, che: chong_xe | `pn-30.png` | `[CAM] a motorbike with one rider at a signalised intersection. The traffic light facing it is clearly RED, and the vehicle is already past the white stop line. A second motorbike overlaps it in the frame.` |

---

## 11. Lên xe khách (20 xe)

Trò chơi đếm người và đồ trên sơ đồ nhìn từ trên xuống, nên phần cần vẽ là **bộ hình đếm** và **sơ đồ khoang xe**. Số lượng từng hình trong mỗi xe do trò chơi xếp theo dữ liệu, không vẽ vào ảnh.

**Bộ hình đếm (một lần, dùng cho mọi xe):**

| Tệp | Prompt |
|---|---|
| `xk-hinh-dem.png` | `[SHEET] [TOP] Small top-down icons for counting people on a bus, each clearly distinct at 40 px: an adult seated, an adult standing in the aisle, a child seated (clearly smaller), an adult lying on a bunk, an adult lying on the floor, a handbag on a seat, a jacket hanging over a seat back, a suitcase on a seat.` |

**Xe và khoang (theo loại):**

| Loại | Xe dùng | Tệp | Prompt |
|---|---|---|---|
| xe_16_cho | XK-01, XK-02, XK-03, XK-04 | `xk-xe-16-cho-ngoai.png` | `[SIDE] a 16-seat high-roof minibus, white with a plain coloured stripe, passenger door open.` |
| | | `xk-xe-16-cho-khoang.png` | `[TOP] Empty interior floor plan of a 16-seat high-roof minibus seen from directly above with the roof removed: driver seat at the top, every seat clearly separated, central aisle, door position marked by a gap.` |
| xe_29_cho | XK-05, XK-06, XK-07, XK-08, XK-09, XK-12 | `xk-xe-29-cho-ngoai.png` | `[SIDE] a 29-seat medium bus, white with a plain coloured stripe, passenger door open.` |
| | | `xk-xe-29-cho-khoang.png` | `[TOP] Empty interior floor plan of a 29-seat medium bus seen from directly above with the roof removed: driver seat at the top, every seat clearly separated, central aisle, door position marked by a gap.` |
| xe_45_cho | XK-10, XK-11, XK-13, XK-14, XK-15, XK-16 | `xk-xe-45-cho-ngoai.png` | `[SIDE] a 45-seat long-distance coach, white with a plain coloured stripe, passenger door open.` |
| | | `xk-xe-45-cho-khoang.png` | `[TOP] Empty interior floor plan of a 45-seat long-distance coach seen from directly above with the roof removed: driver seat at the top, every seat clearly separated, central aisle, door position marked by a gap.` |
| xe_giuong_nam | XK-17, XK-18, XK-19, XK-20 | `xk-xe-giuong-nam-ngoai.png` | `[SIDE] a long-distance sleeper coach with two decks of bunk beds, white with a plain coloured stripe, passenger door open.` |
| | | `xk-xe-giuong-nam-khoang.png` | `[TOP] Empty interior floor plan of a long-distance sleeper coach with two decks of bunk beds seen from directly above with the roof removed: driver seat at the top, every bunk clearly separated, central aisle, door position marked by a gap.` |

**Số hình trong từng xe (để đối chiếu khi ráp cảnh):**

| Mã | Lái xe | Loại | Người lớn | Trẻ em | Túi | Áo treo | Hành lý |
|---|---|---|---|---|---|---|---|
| XK-01 | Nguyễn Văn Hải | xe_16_cho | 12 | 0 | 2 | 0 | 0 |
| XK-02 | Trần Minh Tuấn | xe_16_cho | 17 | 0 | 0 | 1 | 0 |
| XK-03 | Lê Quốc Việt | xe_16_cho | 16 | 0 | 0 | 0 | 1 |
| XK-04 | Phạm Hữu Long | xe_16_cho | 15 | 0 | 2 | 0 | 0 |
| XK-05 | Đỗ Thành Nam | xe_29_cho | 29 | 0 | 2 | 0 | 0 |
| XK-06 | Vũ Công Sơn | xe_29_cho | 28 | 0 | 0 | 0 | 2 |
| XK-07 | Bùi Gia Khánh | xe_29_cho | 29 | 2 | 0 | 0 | 0 |
| XK-08 | Ngô Đức Bình | xe_29_cho | 18 | 4 | 0 | 1 | 0 |
| XK-09 | Hoàng Văn An | xe_29_cho | 25 | 0 | 1 | 0 | 0 |
| XK-10 | Lý Minh Quang | xe_45_cho | 46 | 0 | 0 | 0 | 1 |
| XK-11 | Dương Quốc Cường | xe_45_cho | 40 | 0 | 2 | 1 | 1 |
| XK-12 | Đặng Thành Công | xe_29_cho | 22 | 0 | 0 | 1 | 0 |
| XK-13 | Nguyễn Hữu Phong | xe_45_cho | 38 | 0 | 2 | 0 | 0 |
| XK-14 | Trần Văn Dũng | xe_45_cho | 41 | 0 | 0 | 0 | 1 |
| XK-15 | Phạm Minh Sơn | xe_45_cho | 30 | 0 | 1 | 0 | 0 |
| XK-16 | Vũ Hoàng Nam | xe_45_cho | 45 | 0 | 0 | 0 | 0 |
| XK-17 | Lê Văn Hùng | xe_giuong_nam | 39 | 0 | 0 | 0 | 1 |
| XK-18 | Hoàng Quốc Toàn | xe_giuong_nam | 34 | 0 | 0 | 0 | 2 |
| XK-19 | Bùi Văn Thành | xe_giuong_nam | 38 | 0 | 1 | 0 | 2 |
| XK-20 | Ngô Minh Việt | xe_giuong_nam | 31 | 4 | 0 | 0 | 0 |

---

## 12. Tái dựng hiện trường (5 vụ)

Các vụ hiện chỉ có ô tô con. Hai xe A và B phải phân biệt được bằng hình chứ không chỉ bằng màu, nên mỗi xe có thêm một dấu trên nóc.

| Tệp | Prompt |
|---|---|
| `td-xe-a-b.png` | `[SHEET] [TOP] Two generic compact sedans from directly above: car A in blue with a white circle on the roof, car B in orange with a white square on the roof. Same size and shape otherwise.` |
| `td-nguoi-ke.png` | `[SHEET] Two adults standing side by side, half body, front view, each gesturing as if explaining what happened; one wearing a blue shirt, one wearing an orange shirt to match car A and car B.` |

| Mã | Xe trong vụ | Người kể |
|---|---|---|
| TD-01 | Xe A (ô tô con) | Người lái xe A |
| TD-02 | Xe A (ô tô con, xe sau); Xe B (ô tô con, xe trước) | Người lái xe A, Người lái xe B |
| TD-03 | Xe A (ô tô con); Xe B (ô tô con) | Người lái xe A, Người lái xe B |
| TD-04 | Xe A (ô tô con); Xe B (ô tô con) | Người lái xe A, Người lái xe B |
| TD-05 | Xe A (ô tô con, rẽ trái); Xe B (ô tô con, đi thẳng) | Người lái xe A, Người lái xe B |

---

## 13. Các trò mô phỏng nhìn từ trên xuống

Các trò này dùng bộ hình chung ở mục 2, không cần hình riêng cho từng màn.

| Trò | Nhân vật và xe trong dữ liệu | Dùng bộ hình |
|---|---|---|
| Soi camera (8 đoạn) | o_to: 29; xe_may không mũ: 4; xe_may có mũ: 22; xe_tai: 4; mã trò chơi còn có xe ưu tiên | `chung-o-to-tren-xuong`, `chung-xe-may-tren-xuong`, `chung-xe-tai-tren-xuong`, `chung-xe-uu-tien-tren-xuong` |
| Dựng chốt ban đêm (10 màn) | Cán bộ 2–4 người mỗi màn; luồng xe: o_to, xe_may, xe_tai, xe_khach | `chung-can-bo-tren-xuong`, các bộ xe nhìn từ trên. Vẽ thêm bản ban đêm: thêm vào prompt `Night version: dark surroundings, headlights on, reflective vest glowing.` |
| Tự lái qua phố (3 bản đồ) | Người chơi lái ô tô hoặc xe máy; xe khác: o_to: 7; xe_may: 4; xe_tai: 1; người đi bộ: 7 | `chung-o-to-tren-xuong`, `chung-xe-may-tren-xuong`, `chung-xe-tai-tren-xuong`, `chung-nguoi-di-bo`. Xe người chơi: thêm `Player vehicle: same shape, bright amber #f2a516 body with a dark green #1e4d3a roof stripe.` |

Các trò Vượt màn, Ghép cặp, Đua thời gian, Hỏi nhanh bằng giọng nói, Đoán biển báo, Cung đường biển báo và Cắm biển không có nhân vật hay xe, nên không có prompt ở đây.
