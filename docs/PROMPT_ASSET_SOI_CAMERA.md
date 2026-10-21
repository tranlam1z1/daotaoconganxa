# PROMPT TẠO HÌNH CHO TRÒ "SOI CAMERA" (CHATGPT)

*Soạn ngày 06/10/2026. Nội dung lấy từ `packages/dao-tao/src/tro-choi/soi-camera.ts`, `apps/web/app/lib/ve-canh/ve-camera.ts`, `apps/web/app/components/tro-choi/SoiCamera.tsx` và [GAME_DESIGN.md](GAME_DESIGN.md) §5.5 tại ngày soạn; bố cục đường hoặc góc camera đổi thì phải cập nhật lại. Dùng cho công cụ tạo ảnh của ChatGPT. Prompt viết bằng tiếng Anh vì công cụ tạo ảnh hiểu tiếng Anh ổn định hơn, ghi chú viết bằng tiếng Việt.*

---

## 0. Cách dùng

1. **Mỗi nhóm hình một cuộc trò chuyện ChatGPT mới** (xe, đèn, nền đường, thẻ lỗi, hướng dẫn). Dán **Khối khởi động** (mục 1.1) làm tin nhắn đầu tiên, chờ ChatGPT trả lời "Ready", rồi gửi lần lượt từng prompt, mỗi tin một prompt.
2. **Mỗi prompt bắt đầu bằng một mã góc nhìn** (`[CAM-UP]`, `[CAM-DOWN]`…, mục 1.2). Mã này nhắc ChatGPT giữ đúng góc camera của trò chơi. Đây là chỗ dễ sai nhất: nếu ảnh ra góc nhìn thẳng từ trên xuống hoặc nhìn ngang thì tạo lại.
3. **Giữ đồng bộ phong cách.** Sau khi có ảnh ô tô đầu tiên ưng ý, các prompt sau thêm câu `Same style, outline weight and lighting as the approved car.` Nếu ChatGPT bắt đầu lệch phong cách, dán lại khối khởi động.
4. **Sửa ảnh bằng chỉnh sửa, không tạo lại từ đầu.** Ảnh gần đúng thì dùng công cụ chọn vùng của ChatGPT, ghi rõ chỗ cần sửa ("make the helmet brighter", "remove the text on the plate").
5. **Đặt tên tệp theo cột "Tệp".** Lưu PNG nền trong suốt vào thư mục làm việc, chưa đưa vào mã.
6. **Ảnh ChatGPT chỉ dùng làm mẫu.** Theo [GAME_DESIGN.md](GAME_DESIGN.md) §5.5 (bảng "Hình cần bổ sung") và [VISUAL_STYLE.md](VISUAL_STYLE.md), hình trong trò là SVG nhỏ (xe ≤ 3 KB mỗi hình, đèn 12×34 px). Ảnh raster dùng để chốt dáng, màu, tỷ lệ; sau đó vẽ lại bằng SVG. Không đưa thẳng PNG vào mã.
7. **Duyệt từng ảnh theo mục 4** trước khi chuyển sang vẽ SVG.

### Danh sách hình

| Nhóm | Số ảnh | Ưu tiên | Mục |
|---|---|---|---|
| Xe nhìn qua camera (ngày) | 10 | Cao | 2.1 |
| Xe nhìn qua camera (đêm) | 10 | Trung bình | 2.2 |
| Đèn tín hiệu | 2 | Cao | 2.3 |
| Nền đoạn đường (ngày, đêm) | 2 | Trung bình | 2.4 |
| Hình cho 4 thẻ lỗi | 4 | Cao | 2.5 |
| Hình cho 3 thẻ hướng dẫn | 3 | Thấp | 2.6 |
| Ảnh bìa trò chơi | 1 | Thấp | 2.7 |

---

## 1. Phần chung

### 1.1. Khối khởi động (dán vào tin nhắn đầu tiên)

```text
You will generate a series of game assets for "Soi camera" (Camera Watch), a serious mobile
training game about Vietnamese traffic law, used by traffic police officers and citizens.
The player watches a fixed traffic-camera view of a 4-lane road, pauses the footage when a
vehicle breaks the law, circles that vehicle and labels the violation (running a red light,
wrong lane, stopping in a no-stopping zone, riding without a helmet). Every asset must be
instantly readable on a small phone screen, at a size of about 40 pixels per vehicle.

STYLE
- Flat vector illustration, clean geometric shapes, simple two-tone shading, consistent
  medium-thick dark outline (#1d1f23), realistic muted colours. Professional, calm, modern.
- Not cartoonish, not cute, no chibi, no exaggerated proportions, no comic effects,
  no glossy 3D render, no photorealism.
- Light from the top-left. No cast shadow except a small soft shadow directly under each
  vehicle.
- Isolated assets (vehicles, lights, icons) on a fully TRANSPARENT background, centred, with
  an empty margin of about 10% on every side. Scenes only when I ask for a scene.
- Setting is Vietnam: vehicles typical of Vietnamese streets, right-hand traffic.

CAMERA VIEW (the most important rule)
- The game uses ONE fixed camera: mounted on a tall pole at the bottom edge of the frame,
  looking up along the road at a steep downward angle. It is a PARALLEL projection: no
  vanishing point, objects do not get smaller further up the road.
- Every vehicle is seen mainly from ABOVE (its roof fills most of the sprite), plus a narrow
  band of the face that is nearest to the camera, at the BOTTOM edge of the sprite (about one
  quarter of the sprite height).
  * A vehicle driving AWAY from the camera (up the screen) shows its roof and its REAR face at
    the bottom: rear window, tail lights, a blank plate.
  * A vehicle driving TOWARDS the camera (down the screen) shows its roof and its FRONT face at
    the bottom: windscreen, headlights, grille, a blank plate.
- The vehicle body is foreshortened: a car looks almost as tall as it is wide on screen.

PEOPLE
- Motorbike riders are seen from above. Faceless: no eyes, nose or mouth.
- A rider WITH a helmet: the head is a round helmet shell in a BRIGHT colour (red, white,
  yellow, blue, green or pink) with a white highlight spot. Never a black or dark brown helmet.
- A rider WITHOUT a helmet: dark brown-black hair (#2a1d16) on top of the head, skin-coloured
  neck and ears visible. The difference helmet / no helmet must be obvious at a glance.

HARD RULES (never break)
- No text, letters, numbers or symbols anywhere, including licence plates (plain white
  rectangle with a thin dark border), road markings, signs and screens.
- No car or motorbike brand logos, badges or model names. Vehicles are generic.
- No police insignia, badges, flags, national emblems, red crosses or official logos.
- No watermark, no frame, no caption.

Reply "Ready" and wait for my first request.
```

### 1.2. Mã góc nhìn

| Mã | Ý nghĩa | Khung |
|---|---|---|
| `[CAM-UP]` | Xe đi ra xa camera (lên màn hình): thấy nóc và mặt sau ở mép dưới | 1:1, nền trong suốt |
| `[CAM-DOWN]` | Xe đi về phía camera (xuống màn hình): thấy nóc và mặt trước ở mép dưới | 1:1, nền trong suốt |
| `[NIGHT]` | Thêm vào sau mã góc nhìn: bản ban đêm | như mã đi kèm |
| `[SCENE]` | Toàn cảnh khung camera, khung đứng | 2:3 |
| `[ICON]` | Hình minh họa nhỏ cho thẻ, không có cảnh nền | 1:1, nền trong suốt |

Nếu ChatGPT không nhớ nghĩa mã, gửi thêm khối này:

```text
Codes I will put at the start of each request:
[CAM-UP]   vehicle driving AWAY from the camera, seen from above, rear face visible as a band at
           the bottom of the sprite; square 1:1, transparent background.
[CAM-DOWN] vehicle driving TOWARDS the camera, seen from above, front face visible as a band at
           the bottom of the sprite; square 1:1, transparent background.
[NIGHT]    night version of the same asset: darker body tones, a thin light rim along the
           outline so it stands out on dark asphalt, lights switched on with a soft glow.
[SCENE]    the whole camera frame as one illustration, portrait 2:3.
[ICON]     a small flat illustration for a game card, no background scene; square 1:1,
           transparent background, bold simple shapes readable at 64 pixels.
```

### 1.3. Màu đang dùng trong trò (để ảnh khớp với cảnh đã vẽ)

| Phần | Ngày | Đêm |
|---|---|---|
| Mặt đường nhựa | `#555a61` | `#262b31` |
| Vỉa hè | `#d6d1c4` | `#1a1e23` |
| Bó vỉa | `#a39d90` | `#30353b` |
| Dải cỏ, nền ngoài | `#8f9a86` | `#0f1216` |
| Vạch tim đường (vàng đôi) | `#e0b43c` | `#e0b43c` |
| Vạch trắng (chia làn, người đi bộ, vạch dừng) | `#f2f2ee` | `#9aa3ad` |
| Vạch vàng cấm dừng | `#f2c230` | `#f2c230` |

Màu thân xe trong mã (chọn theo mã xe, cố định suốt phim để người chơi theo dõi "chiếc ô tô đỏ"):
- Ô tô: trắng `#f1f1ec`, bạc `#b9c0c8`, đỏ `#c0392b`, xanh dương `#2459a6`, xanh rêu `#3f6b4f`, vàng cát `#d8a13a`.
- Cabin xe tải: xanh dương `#2459a6`, đỏ `#c0392b`, trắng `#e9e7e1`, xanh lá `#2f7d4f`. Thùng: `#6f8a6a`, `#b8bcc2`, `#3d5a80`.
- Xe máy: đỏ `#c62828`, đen `#1d2733`, xanh dương `#1e5aa8`, trắng `#e6e4de`, tím `#7b3fa0`, xanh lá `#2e7d32`.
- Mũ bảo hiểm: `#e53935`, `#fafafa`, `#fdd835`, `#1e88e5`, `#43a047`, `#ec407a`.

Chỉ cần tạo **một màu cho mỗi loại xe** (prompt dưới đã chọn sẵn). Khi vẽ lại SVG, thân xe là một lớp màu riêng để mã đổi màu theo bảng trên.

---

## 2. Prompt theo nhóm

### 2.1. Xe nhìn qua camera, ban ngày

Tỷ lệ hình bao trên màn hình (rộng : cao) tính từ kích thước thật và phép chiếu camera: ô tô ≈ 9:10, xe tải ≈ 3:4, xe máy ≈ 9:10, xe cứu thương ≈ 7:8. Ghi ở cuối prompt để ChatGPT không vẽ xe dài ngoằng như nhìn thẳng từ trên.

| Tệp | Prompt |
|---|---|
| `sc-o-to-len.png` | `[CAM-UP] A generic white compact 4-door sedan driving away from the camera. Roof fills most of the sprite with a darker rear window; at the bottom edge the rear face: two red tail lights at the corners, a blank white plate in the middle, rear bumper. Side mirrors just visible. Sprite proportion about 9 wide by 10 tall.` |
| `sc-o-to-xuong.png` | `[CAM-DOWN] The same white sedan driving towards the camera. Roof fills most of the sprite; at the bottom edge the front face: dark windscreen with a soft reflection, two headlights at the corners, a simple grille, a blank white plate. Sprite proportion about 9 wide by 10 tall.` |
| `sc-xe-tai-len.png` | `[CAM-UP] A generic light box truck driving away from the camera: blue cab at the top (only its roof visible), a long grey-green cargo box behind it filling most of the sprite; at the bottom edge the rear of the cargo box with two closed doors, red tail lights and a blank plate. Sprite proportion about 3 wide by 4 tall.` |
| `sc-xe-tai-xuong.png` | `[CAM-DOWN] The same box truck driving towards the camera: cargo box at the top, blue cab at the bottom with its front face visible: wide windscreen, headlights, bumper, blank plate. Sprite proportion about 3 wide by 4 tall.` |
| `sc-xe-may-mu-len.png` | `[CAM-UP] A generic red step-through scooter with one rider, driving away from the camera, seen from above and behind. Rider in a blue jacket, back and shoulders visible, both hands on the handlebar. The rider wears a bright yellow open-face helmet: a round shell with a white highlight spot and a visible rim at the back. Red tail light at the bottom edge. Sprite proportion about 9 wide by 10 tall.` |
| `sc-xe-may-mu-xuong.png` | `[CAM-DOWN] The same scooter and rider driving towards the camera. Bright yellow open-face helmet seen from the front, with a dark visor area but no face details. Headlight at the bottom edge. Sprite proportion about 9 wide by 10 tall.` |
| `sc-xe-may-khong-mu-len.png` | `[CAM-UP] A generic dark blue underbone motorbike with one rider, driving away from the camera, seen from above and behind. Rider in a white shirt. NO helmet: short dark brown-black hair covering the top of the head, skin-coloured neck and ears clearly visible. Red tail light at the bottom edge. Sprite proportion about 9 wide by 10 tall.` |
| `sc-xe-may-khong-mu-xuong.png` | `[CAM-DOWN] The same bareheaded rider driving towards the camera. Dark hair covers the top half of the head, the lower half is plain skin with no facial features. Headlight at the bottom edge. Sprite proportion about 9 wide by 10 tall.` |
| `sc-cuu-thuong-len.png` | `[CAM-UP] A generic white ambulance-type van driving away from the camera, with a red-and-blue light bar across the roof and a plain red stripe along the sides. No crosses, no text, no emblems. Rear doors, tail lights and blank plate at the bottom edge. Sprite proportion about 7 wide by 8 tall.` |
| `sc-cuu-thuong-xuong.png` | `[CAM-DOWN] The same ambulance-type van driving towards the camera, light bar on, front face at the bottom edge: windscreen, headlights, blank plate. Sprite proportion about 7 wide by 8 tall.` |

**Bản đèn phanh (tùy chọn).** Trò sáng đèn phanh khi xe dừng ở vạch đèn đỏ. Với 4 ảnh `-len` của ô tô, xe tải, xe máy, cứu thương, gửi thêm: `Same sprite, brake lights on: tail lights bright red with a small soft glow.` Đặt tên thêm hậu tố `-phanh`.

### 2.2. Xe nhìn qua camera, ban đêm (màn 5)

Màn 5 chơi ban đêm: mặt đường tối, xe có viền sáng và quầng đèn pha. Xe và vạch kẻ phải tương phản với mặt đường từ 3:1 trở lên.

Với mỗi ảnh ở 2.1, gửi prompt dạng:

```text
[CAM-UP] [NIGHT] Night version of the approved <tên xe, ví dụ: white sedan driving away>.
Body tones darker, a thin pale rim light along the outline so it stays visible on dark
asphalt (#262b31). Tail lights glowing red. Show it over a small square of dark asphalt
for preview only.
```

Với `[CAM-DOWN]`: thay `Tail lights glowing red` bằng `Headlights on: two warm white beams fanning a short distance downwards in front of the vehicle, soft glow.` Riêng xe máy không mũ: thêm `Hair and skin must still be clearly distinguishable from a helmet in the dark.`

Tên tệp: thêm hậu tố `-dem`, ví dụ `sc-o-to-len-dem.png`.

### 2.3. Đèn tín hiệu

Trò có hai đầu đèn: một ở vỉa hè phải cạnh vạch dừng chiều đi lên, một ở vỉa hè trái cạnh vạch dừng chiều đi xuống. Kích thước hiển thị 12×34 px, nên hình phải rất đơn giản.

| Tệp | Prompt |
|---|---|
| `sc-den-tin-hieu.png` | `[ICON] A sheet of three identical generic vertical traffic-light heads side by side, as seen by a high camera (slightly from above): dark charcoal housing with rounded corners, three round lamps stacked red, amber, green, each with a small visor. Left one: only RED lit. Middle: only AMBER lit. Right: only GREEN lit. Lit lamp bright with a soft glow, unlit lamps dark and dull but still showing their colour faintly. Each head about 1 wide by 3 tall. Transparent background.` |
| `sc-cot-den.png` | `[ICON] One generic traffic-light pole seen from the same high camera: a slim grey pole with a short arm holding one dark three-lamp head, base on a small square of pale sidewalk. No signs, no text. Transparent background.` |

Đèn sáng phải phân biệt được bằng **vị trí** (trên, giữa, dưới), không chỉ bằng màu ([VISUAL_STYLE.md](VISUAL_STYLE.md) §1). Khi duyệt, xem ảnh ở thang xám.

### 2.4. Nền đoạn đường

Bố cục phải khớp với mô phỏng, vì máy chủ chấm theo tọa độ. Ảnh nền dùng để chốt chất liệu và cây cối bên đường; vạch kẻ cuối cùng vẫn do mã vẽ theo tọa độ. Không vẽ chữ "Ô TÔ", "XE MÁY" và vạch vàng cấm dừng: hai thứ này do mã vẽ theo từng đoạn phim.

Vị trí trong khung (tính từ `CAMERA` và `Y_VACH`, `Y_NGUOI_DI_BO` trong `soi-camera.ts`), theo phần trăm chiều cao khung tính từ mép trên:
- Vạch dừng chiều đi xuống (nửa trái mặt đường): 48%.
- Vạch người đi bộ sang đường: 52% → 58%.
- Vạch dừng chiều đi lên (nửa phải mặt đường): 61%.
- Mặt đường hơi nghiêng: mép trên lệch trái, mép dưới lệch phải (mép trái đi từ 6% chiều rộng ở trên tới 30% ở dưới; mép phải từ 70% tới 94%).

```text
[SCENE] The fixed traffic-camera frame of the game, portrait 2:3, daytime, no vehicles, no
people. A straight 4-lane two-way urban road running from the top to the bottom of the frame,
seen from the high pole-mounted camera described before (parallel projection, no vanishing
point). The road band is slightly slanted: near the top it sits a little to the left, near
the bottom a little to the right; it takes about two thirds of the frame width.
- Asphalt #555a61 with very subtle texture.
- Centre: a double solid yellow line (#e0b43c) separating the two directions.
- Each half has two lanes separated by a dashed white line. Right half: traffic goes up (away
  from camera). Left half: traffic comes down (towards camera).
- A zebra pedestrian crossing in white bars across the whole road, between 52% and 58% of the
  frame height. A solid white stop line across the LEFT half just above the crossing (48%),
  and across the RIGHT half just below the crossing (61%).
- Grey curb (#a39d90) on both edges, pale sidewalk (#d6d1c4) beyond, then a strip of muted
  green-grey (#8f9a86) with a few round tree canopies seen from above and a couple of generic
  low building roof edges at the far sides.
- Two traffic-light poles on the sidewalks next to the stop lines: one on the right sidewalk
  at 61%, one on the left sidewalk at 48%.
- No text, no road words, no arrows, no signs, no vehicles, no people.
```

Bản đêm (`sc-nen-dem.png`): gửi `Same scene at night: asphalt #262b31, sidewalk #1a1e23, background #0f1216, white markings dimmed to #9aa3ad but still clearly visible, a few warm street-lamp pools of light on the sidewalks. Keep every marking at exactly the same position.` Ảnh ngày đặt tên `sc-nen-ngay.png`.

### 2.5. Hình cho 4 thẻ lỗi

Bốn thẻ lỗi người chơi kéo vào khung đã khoanh. Hiện thẻ chỉ có chữ; thêm hình nhỏ để nhận ra nhanh. Chữ trên thẻ giữ nguyên, hình đứng bên trái chữ, cỡ khoảng 40 px. Mỗi hình chỉ nói một ý, hình khối đậm.

| Tệp | Thẻ | Prompt |
|---|---|---|
| `sc-the-vuot-den-do.png` | Vượt đèn đỏ | `[ICON] A small car seen from above crossing over a white stop line, next to a traffic-light head with only the top red lamp lit. A short motion trail behind the car. Bold simple shapes.` |
| `sc-the-sai-lan.png` | Đi sai làn đường | `[ICON] Two road lanes seen from above separated by a dashed white line; the left lane holds a small motorbike symbol painted on the asphalt, the right lane a small car symbol. A small car is driving inside the motorbike lane, with a curved arrow showing it came from the car lane. Bold simple shapes, no text.` |
| `sc-the-dung-sai.png` | Dừng xe sai nơi quy định | `[ICON] A small car seen from above stopped at the kerb right on top of a yellow zigzag no-stopping line, hazard lights blinking (small amber glows at the four corners). Bold simple shapes.` |
| `sc-the-khong-mu.png` | Không đội mũ bảo hiểm | `[ICON] A motorbike rider seen from above and behind with a bare head (dark hair clearly visible), and next to it a bright helmet shape with a diagonal strike-through bar. Bold simple shapes, no text.` |

Khi duyệt: đặt 4 hình cạnh nhau ở cỡ 40 px, chuyển thang xám. Bốn hình phải khác nhau rõ bằng **hình dáng**, không chỉ bằng màu.

### 2.6. Hình cho 3 thẻ hướng dẫn (tùy chọn)

Hướng dẫn đầu trò có 3 bước. Hình là ảnh tĩnh; bản hoạt ảnh (nếu làm) vẽ lại bằng SVG/CSS và phải có bản tĩnh khi bật giảm chuyển động.

| Tệp | Bước | Prompt |
|---|---|---|
| `sc-hd-1-dung-hinh.png` | Thấy vi phạm thì bấm "Dừng hình" | `[ICON] A phone-sized traffic-camera frame showing a road from above with a few vehicles, a small red recording dot in the top-left corner, and a large pause symbol in the centre. A fingertip (no hand details) pressing a wide button below the frame. No text.` |
| `sc-hd-2-khoanh.png` | Khoanh xe vi phạm | `[ICON] The same paused camera frame; one car is surrounded by a dashed amber rectangle being drawn by a fingertip dragging from one corner. The other vehicles are slightly dimmed. No text.` |
| `sc-hd-3-keo-the.png` | Kéo thẻ lỗi vào khung | `[ICON] The same paused frame with the dashed amber rectangle around the car; below the frame a row of four blank rounded cards, and one card is being dragged up by a fingertip into the rectangle, with a short dotted path showing the movement. Cards have no text. No text anywhere.` |

### 2.7. Ảnh bìa trò chơi (tùy chọn)

Dùng ở thẻ trò chơi trong trang `/tro-choi`, khung ngang. Icon ứng dụng của trò (sắc tím, camera trên cột, tia quét hình nón) đã có prompt riêng ở [PROMPT_BO_ICON.md](PROMPT_BO_ICON.md); ảnh bìa cần cùng ý.

```text
Cover illustration for the game card, landscape 3:2, same flat vector style. A generic
traffic surveillance camera on a tall pole in the left third, with a soft translucent
cyan scanning cone falling on a 4-lane road seen from above. Inside the cone one motorbike
rider without a helmet is highlighted by a dashed amber rectangle; other vehicles flow
normally. Background muted, the highlighted rider is the clear focal point. No text,
no logos, no police insignia.
```

---

## 3. Gợi ý khi ChatGPT làm sai

| Ảnh ra | Gửi thêm |
|---|---|
| Xe nhìn thẳng từ trên xuống, dài gấp đôi bề rộng | `Wrong angle. Use the high pole camera: the car must look almost as tall as it is wide, with the rear (or front) face visible as a band at the bottom.` |
| Xe nhìn chếch 3/4 ngang tầm mắt | `Too low. The camera is high above the road; the roof must fill most of the sprite.` |
| Có chữ hoặc số trên biển số | `Remove all text and numbers. The plate is a blank white rectangle.` |
| Mũ bảo hiểm màu đen hoặc nâu | `The helmet must be bright <màu> so it cannot be confused with hair.` |
| Người đi xe có mắt, mũi, miệng | `Faceless rider: remove all facial features.` |
| Nền không trong suốt | `Make the background fully transparent; keep only the vehicle and its small ground shadow.` |
| Xe ở xa nhỏ hơn xe ở gần (ảnh cảnh) | `Parallel projection: every vehicle and lane keeps the same size from top to bottom.` |

---

## 4. Duyệt ảnh trước khi vẽ lại SVG

- **Đúng góc camera:** nóc xe chiếm phần lớn hình, mặt gần camera ở mép dưới; xe đi lên thấy đuôi, xe đi xuống thấy đầu.
- **Đọc được ở cỡ thật:** thu ảnh xe xuống khoảng 40 px. Phải nhận ra ngay loại xe, hướng đi, và người đi xe máy có đội mũ hay không. Đây là điều kiện để trò công bằng: lỗi "không đội mũ bảo hiểm" chấm theo cái người chơi nhìn thấy.
- **Thang xám:** đèn tín hiệu phân biệt bằng vị trí bóng sáng; 4 hình thẻ lỗi khác nhau bằng hình dáng.
- **Ban đêm:** xe, vạch kẻ, đầu người lái vẫn tách khỏi mặt đường `#262b31` (tương phản từ 3:1).
- **Quy tắc cứng:** không chữ, không số, không logo hãng xe, không quân hiệu, cấp hiệu, phù hiệu, cờ, quốc huy, chữ thập đỏ, không mặt người chi tiết, không phong cách hoạt hình ([VISUAL_STYLE.md](VISUAL_STYLE.md) §1).
- **Toàn bộ hình xe nằm trong hình bao** (không có gương, đèn pha, quầng sáng thò ra xa), vì khung tô và vùng chạm khoanh theo hình bao xe (`hopXe` trong `mo-phong/camera.ts`).

## 5. Khi vẽ lại bằng SVG

- Xe: ≤ 3 KB mỗi hình, thân xe là một lớp tô riêng để đổi màu theo bảng ở 1.3; mũ bảo hiểm và áo người lái cũng là lớp riêng.
- Đèn tín hiệu: 12×34 px, ba bóng là ba lớp riêng để mã bật tắt.
- Thay cho các hàm vẽ Canvas hiện có: `veOTo`, `veXeTai`, `veCuuThuong`, `veXeMay`, `veDau`, `veDauDen` trong `apps/web/app/lib/ve-canh/ve-camera.ts`. Hình mới phải giữ đúng kích thước hình bao, để điểm chấm khoanh vùng không đổi.
- Nền đường tiếp tục vẽ bằng mã trong `veCanh` (`SoiCamera.tsx`); ảnh nền chỉ dùng để chọn lại màu, chất liệu và thêm cây cối, vỉa hè nếu muốn.
