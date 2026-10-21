# PROMPT CHO STITCH: THIẾT KẾ LẠI GIAO DIỆN

*Lập ngày 2/10/2026. Bộ prompt để dán vào Google Stitch (stitch.withgoogle.com), sinh bản thiết kế mới cho web app. Prompt viết bằng tiếng Anh vì Stitch hiểu tiếng Anh ổn định hơn; mọi chữ trên giao diện yêu cầu bằng tiếng Việt.*

## Cách dùng

1. Dán **Prompt 0 (hệ thiết kế)** trước, chế độ *Mobile*. Chọn bản ưng nhất làm gốc.
2. Trong cùng dự án Stitch, dán lần lượt từng prompt màn hình (1 → 10). Mỗi lần **một màn hình**: Stitch làm tốt khi prompt ngắn và tập trung.
3. Sửa bằng prompt ngắn, mỗi lần một thay đổi (ví dụ: "Make the bottom navigation labels 13px and increase icon size to 24px"). Không dán lại cả prompt dài.
4. Màn hình máy tính: sau khi chốt bản điện thoại, dùng prompt "Create the desktop version (1280px) of this screen..." ở cuối tệp.
5. Xuất mã HTML/Tailwind từ Stitch chỉ để tham khảo bố cục và token; mã thật vẫn viết lại trong `apps/web` theo component sẵn có (`components/ui/*`).

---

## Prompt 0: Hệ thiết kế và khung chung

```text
Design a mobile-first web app (360–430px wide) for Vietnamese traffic police officers to look up legal regulations, study, play training games, and take certification exams. App name: "Quy định Pháp luật". All UI text must be in Vietnamese with correct diacritics.

AUDIENCE & TONE
- Users are working police officers and civil servants handling real cases, often on mid-range Android phones, sometimes outdoors in bright sunlight.
- Tone: serious, official, trustworthy, modern — like a well-made government service app, not a consumer social app.
- No cartoon characters, no emoji, no exclamation marks, no candy colors, no stock photos of people.
- Do NOT use any official police insignia, badges, emblems or uniform imagery. A simple abstract shield logo mark is fine.

VISUAL STYLE ("Công báo" — official gazette, modernized)
- Warm paper background #F7F5F0, white cards #FFFFFF, secondary surface #F0EDE5.
- Ink text #1A1C22, secondary text #434753, muted text #62666F, borders #E3DED3.
- Primary: deep indigo #233E8B (hover #1B3172), soft tint #E7ECF8.
- Accent "seal red" #B3261E used sparingly (stamps, key status).
- Status: success #17623A on #E4F2E9, warning #8A4A0B on #FBEFD9, danger #9B1C1C on #FBE6E3, info #1D4D86 on #E3EDF8.
- Gamification accent (XP, stars, streaks only): amber #F2A516 with dark text #1A1407.
- Provide a dark mode too: background #111317, cards #181B21, text #EDEBE5, primary #A3B8FF.
- Typography: "Be Vietnam Pro" for all UI and body text (body 16px minimum, line-height 1.6); "Noto Serif" only for the body of legal documents; "Lexend" for big numbers (scores, timers) with tabular figures.
- Corner radius: cards 12px, buttons 10px. Soft two-layer card shadow. Generous whitespace, clear hierarchy, 8px spacing grid.
- Icons: consistent outline icon set, 1.75px stroke, 24px.
- Contrast WCAG AA (4.5:1 for text). Touch targets at least 44px. Meaning never conveyed by color alone (always icon + label for correct/incorrect, status).

APP SHELL
- Top app bar: small shield logo + "Quy định Pháp luật" on the home screen; on inner screens a back arrow + page title. Right side: search icon and avatar.
- Fixed bottom navigation (5 items): "Trang chủ" (home), "Học" (graduation cap), "Thi" (checklist), "Tôi" (user), "Thêm" (grid / more). Active item uses primary color with a soft pill behind the icon.
- "Thêm" opens a bottom sheet with: Tra cứu, Hỏi trợ lý AI, Bảng xếp hạng, Nhóm học cùng, Hướng dẫn sử dụng, Quản trị (managers only), and a light/dark theme toggle.

FIRST SCREEN TO GENERATE: Home ("Trang chủ")
- Greeting line with officer name and unit, e.g. "Chào đồng chí Nguyễn Văn An · Đội CSGT số 3".
- Prominent search field: placeholder "Tìm văn bản, điều khoản, mức phạt…" with a microphone icon.
- Progress strip: current level, XP bar, day streak chip ("Chuỗi 6 ngày"), and today's goal.
- 2×2 feature grid of cards with icon, title and one-line description: "Học" (bài giảng theo chuyên đề), "Tra cứu" (văn bản, mức phạt, biển báo), "Đánh giá" (luyện tập và thi sát hạch), "Trợ lý AI" (hỏi đáp có trích dẫn căn cứ).
- Horizontal carousel "Tra cứu nhanh": Mức phạt, Tốc độ tối đa, Quy trình xử lý, Biển báo.
- Section "Học tập qua trò chơi" with 2–3 game cards (title, number of levels, estimated minutes).
- Section "Văn bản mới cập nhật": list rows with document type chip (Luật / Nghị định / Thông tư), number/symbol like "168/2024/NĐ-CP", short title, and effective-status chip ("Còn hiệu lực" green, "Sắp có hiệu lực" amber, "Hết hiệu lực" red).
```

---

## Prompt 1: Tra cứu (trang chọn và kết quả tìm kiếm)

```text
Using the same design system, design the "Tra cứu" search results screen.
- Top: search field with the query "nồng độ cồn xe máy", a filter button, and a date chip "Hiệu lực tại: 02/10/2026" that opens a date picker.
- Horizontal filter chips: Tất cả, Điều khoản, Văn bản, Mức phạt, Biển báo.
- Result group "Khớp viện dẫn" at the top, then "Điều/khoản liên quan".
- Each result card: breadcrumb (Nghị định 168/2024/NĐ-CP › Chương II › Điều 7), bold title of the article, 2–3 line excerpt with the matched words highlighted in soft indigo, status chip, and a small "Sao chép trích dẫn" icon button.
- Below, a filter bottom sheet design: Loại văn bản, Cơ quan ban hành, Lĩnh vực, Trạng thái hiệu lực, toggle "Gồm văn bản hết hiệu lực".
```

## Prompt 2: Đọc văn bản pháp luật

```text
Design the legal document reading screen, the most important screen of the app, optimized for long reading on a phone.
- Sticky top bar: short document name "NĐ 168/2024/NĐ-CP", status chip "Còn hiệu lực", "Hiệu lực tại: 02/10/2026" (tappable), and a table-of-contents button.
- Tabs under the bar: Toàn văn, Thuộc tính, Lược đồ, Phiên bản.
- Body in Noto Serif 17px, line-height 1.7, comfortable 16px side margins: Chương heading, Điều heading in bold sans, numbered Khoản (1., 2.) and lettered Điểm (a), b)).
- One khoản is marked as amended: a small amber "Được sửa đổi" badge and an expandable footnote box explaining which document amended it and from which date.
- Long-press/selection actions on a khoản: Sao chép trích dẫn, Lịch sử khoản này, Hỏi trợ lý AI.
- Table of contents as a left drawer: searchable tree of Phần / Chương / Mục / Điều, current article highlighted.
- Floating reading-settings button: font size, line spacing, dark background.
```

## Prompt 3: Tra cứu nhanh — Mức phạt

```text
Design the quick lookup screen "Tra cứu nhanh · Mức phạt" for officers checking fines in the field.
- Segmented control for vehicle type: Ô tô, Xe máy, Xe đạp/xe thô sơ, Người đi bộ.
- Search field "Tìm hành vi vi phạm…".
- List of violation cards: violation description (bold), fine range in large Lexend numbers "6.000.000 – 8.000.000 đ", additional penalties as chips ("Trừ 4 điểm GPLX", "Tạm giữ xe 7 ngày"), and a footer link with the legal basis "Điểm a khoản 6 Điều 7 NĐ 168/2024/NĐ-CP".
- Readable in sunlight: solid backgrounds behind text, strong contrast, no gradients behind numbers.
```

## Prompt 4: Học & luyện tập (trung tâm học)

```text
Design the "Học & luyện tập" hub.
- Header card with level, XP progress bar (amber), streak chip, and a short "Mục tiêu hôm nay: 20 câu" with progress.
- Tabs: Bài giảng, Luyện tập, Trò chơi, Nhóm.
- "Bài giảng" tab content: list of topics (chuyên đề) grouped by field, each card with icon, title, number of lessons, progress ring, and "Tiếp tục bài 3" button for the one in progress.
- Section "Điểm yếu cần ôn": 3 topic chips with low accuracy percentages and an "Ôn ngay" action.
```

## Prompt 5: Màn luyện tập một câu hỏi

```text
Design a single practice question screen.
- Top: close button, progress bar "Câu 4/10", timer is optional.
- Question text 18px, then 4 answer options as large tappable cards (white, 2px border, 12px radius).
- Show the "answered" state: chosen wrong option with red border, cross icon and label "Chưa đúng"; correct option with green border, check icon and label "Đúng".
- Explanation panel slides up from the bottom: short explanation plus a legal-basis card "Căn cứ: Khoản 2 Điều 9 Luật Trật tự, an toàn giao thông đường bộ 2024" with "Xem điều khoản" link.
- Primary button at the bottom: "Câu tiếp".
```

## Prompt 6: Trò chơi (khu trò chơi, phong cách "Cảnh phục")

```text
Design the games hub "Trò chơi". This area uses a slightly more energetic sub-theme called "Cảnh phục" while staying professional:
- Page background #F4F1E8, cards white with 20px radius, primary deep green #1E4D3A (white text), accent amber #F2A516 for stars, points and streaks, correct #14733A, wrong #C2261D.
- Headings and numbers in Lexend. A very subtle diagonal road-marking stripe pattern (6% opacity) only in the page header.
- Primary buttons: solid deep green, 52px tall, 14px radius, with a 4px darker bottom shadow so they feel "pressable" like game buttons.
- Content: weekly unit season banner with rank; grid of game cards — "Kiểm tra giấy tờ", "Cắm biển cho tuyến đường", "Dừng xe đúng quy trình", "Soi camera", "Điều tiết giao lộ", "Tự lái qua phố" — each with a simple flat illustration (vehicles, road signs, documents, no people's faces), level progress (e.g. "Màn 3/8"), stars earned, and duration "3–5 phút".
- Badge "Chơi được khi mất mạng" on games that work offline.
- Also design the game result screen: big score with stars, XP gained, streak, and a list of mistakes, each with the correct answer and its legal basis.
```

## Prompt 7: Thi sát hạch

```text
Design the exam taking screen "Thi sát hạch".
- Sticky header: exam name, countdown timer in Lexend (turns amber under 5 minutes, red under 1 minute, with an icon, not color only), and a "Nộp bài" button.
- Question area like the practice screen but without instant feedback; a "Đánh dấu xem lại" flag toggle.
- Bottom sheet "Danh sách câu hỏi": grid of numbered squares showing states answered / not answered / flagged, with a legend.
- Submit confirmation dialog: "Còn 3 câu chưa trả lời. Nộp bài?" with buttons "Quay lại làm tiếp" and "Nộp bài".
- Result screen: pass/fail status with icon and label, score, time used, breakdown by topic as horizontal bars.
```

## Prompt 8: Hỏi trợ lý AI

```text
Design the AI assistant chat screen "Hỏi trợ lý AI".
- Fixed disclaimer line at the top in muted text: "Câu trả lời là thông tin tham khảo. Căn cứ chính thức là văn bản do cơ quan nhà nước ban hành."
- User message bubbles on the right (indigo soft background), assistant answers on the left as full-width white cards, not bubbles.
- Each assistant answer contains inline numbered citations [1] [2] and, below, citation cards: article reference, document number, status chip; a warning style when the cited article is no longer in effect.
- Actions under an answer: Sao chép, Báo sai.
- Input bar at the bottom with microphone button and send button; suggested questions as chips when the conversation is empty.
```

## Prompt 9: Trang cá nhân "Tôi"

```text
Design the personal profile screen "Tôi".
- Header: avatar, full name, rank-free job title and unit (no insignia), level and XP bar.
- Stats row: Chuỗi ngày, Tổng XP, Huy hiệu, Hạng trong đơn vị.
- Section "Huy hiệu": horizontal list of flat geometric badges (locked ones greyed out with a lock icon).
- Section "Điểm mạnh, điểm yếu theo chủ đề": list with percentage bars.
- Section "Nhắc học": time picker row and toggle for push reminders.
- Settings list: Tài khoản, Đổi mật khẩu, Giao diện sáng/tối, Kết nối trợ lý AI, Đăng xuất.
```

## Prompt 10: Bảng điều khiển quản trị (máy tính)

```text
Design a desktop admin dashboard (1440px) for unit managers, same design system but denser.
- Left sidebar groups: Tổng quan; Tổ chức (Đơn vị, Người dùng); Nội dung (Ngân hàng câu hỏi, Bài giảng, Nội dung trò chơi, Dữ liệu tra cứu, Kho văn bản); Thi (Đề thi, Giao bài); Báo cáo; Nhóm học cùng; Mùa giải.
- Overview page: KPI cards (Cán bộ hoạt động tuần này, Tỉ lệ hoàn thành bài giao, Điểm thi trung bình, Nội dung chờ duyệt), a line chart of weekly activity, a table of units ranked by completion, and a "Chờ duyệt" queue list with status chips (Nháp, Chờ duyệt, Đã duyệt, Từ chối).
- Tables: zebra-free, 1px row dividers, sticky header, row actions on hover, bulk actions bar when rows are selected, filters above the table.
```

---

## Prompt bổ sung

**Bản máy tính cho một màn hình đã chốt:**

```text
Create the desktop version (1280px) of this screen. Replace the bottom navigation with a top navigation bar: logo left; menu items "Tra cứu", "Học & luyện tập", "Thi"; search, theme toggle and avatar on the right. Use a centered content column (max 1120px) and a two-column layout where it helps (e.g. table of contents on the left for documents, related items on the right).
```

**Chế độ tối:**

```text
Show this screen in dark mode using the dark tokens of the design system. Keep text contrast at least 4.5:1 and keep status colors distinguishable.
```

**Trạng thái rỗng, đang tải, lỗi:**

```text
Design the empty state, loading skeleton, and offline error state for this screen. Empty state: simple line illustration, one sentence explaining why it is empty, one action button. Offline: banner "Đang mất kết nối. Nội dung đã lưu vẫn đọc được."
```

---

## Ràng buộc cần soát lại khi nhận bản thiết kế

- Chữ trên giao diện theo [QUY-TAC-HANH-VAN.md](../QUY-TAC-HANH-VAN.md): giọng nghiêm túc, không emoji, không dấu chấm than, không câu quảng cáo. Stitch hay chèn câu kiểu "Chào mừng bạn trở lại!": cần sửa.
- Không có quân hiệu, cấp hiệu, phù hiệu, logo lực lượng ([VISUAL_STYLE.md §1](VISUAL_STYLE.md)).
- Phong cách "Cảnh phục" chỉ cho khu trò chơi; tra cứu, đọc văn bản, thi, quản trị giữ hệ "Công báo".
- Dấu tiếng Việt chồng ("ẫ", "ỗ", "ự") không bị cắt ở cỡ chữ lớn.
- Menu điện thoại giữ tối đa 4 mục chính cộng "Thêm" (`apps/web/app/lib/site.ts`).
- Tên route không đổi khi làm lại giao diện (`apps/web/app/routes.ts`).
