# Chạy bản demo trên máy

Tài liệu này hướng dẫn dựng bản demo của Quy định Pháp luật trên một máy tính, để xem và giới thiệu cho người khác góp ý. Bản demo dùng CSDL riêng trên máy, không nối với hệ thống thật và không gửi gì ra ngoài.

Kịch bản trình bày theo thứ tự từng bước, kèm dữ liệu nhập trong buổi demo: [KICH-BAN-DEMO.md](KICH-BAN-DEMO.md).

## 1. Bản demo gồm những gì

Hệ thống có **một ứng dụng web** dùng cho mọi vai trò. Không có ứng dụng Admin hay PWA riêng:

| Phần | Địa chỉ trên máy | Ghi chú |
|---|---|---|
| Web người dùng | http://localhost:3080 | Tra cứu, học, luyện tập, thi |
| Trang quản trị (Admin) | http://localhost:3080/quan-tri | Cùng ứng dụng web; chỉ hiện với quản trị viên và cán bộ quản lý |
| PWA (cài lên điện thoại) | Địa chỉ HTTPS của đường hầm, xem mục 6 | Cũng là ứng dụng web trên, cài ra màn hình chính |
| API | http://localhost:3081/health | Web gọi API; người dùng không cần mở |

Cổng 3080 và 3081 được chọn để không đụng máy chủ phát triển (3030, 3031). Muốn đổi thì đặt `DEMO_WEB_PORT`, `DEMO_API_PORT` trong `.env.demo.local`.

## 2. Chuẩn bị máy mới

Cần cài:

1. **Git**, để lấy mã nguồn.
2. **Bun** 1.4 trở lên: https://bun.sh (Windows: `powershell -c "irm bun.sh/install.ps1 | iex"`).
3. **Docker Desktop**, và phải đang chạy. Bản demo dùng Postgres 16 có pgvector trong Docker (`infra/docker-compose.yml`, cổng 5436).
4. **Google Chrome**, để xem, và để nói bằng micro ở phần hỏi đáp và luyện tập.

Rồi chạy trong thư mục dự án:

```
bun install
```

Không cần tạo `.env`. Bản demo đọc cấu hình từ `.env.demo` có sẵn trong kho.

## 3. Chạy

```
bun run demo
```

Lần đầu mất vài phút. Lệnh này làm lần lượt:

1. Bật Postgres trong Docker.
2. Tạo CSDL `quydinhphapluat_demo` nếu chưa có.
3. Chạy migration.
4. Gieo dữ liệu mẫu.
5. Build giao diện web.
6. Bật API và web, rồi in các địa chỉ và tài khoản.

Nhấn **Ctrl+C** để tắt API và web. Postgres vẫn chạy; tắt bằng `docker compose -f infra/docker-compose.yml stop`.

| Lệnh | Dùng khi |
|---|---|
| `bun run demo` | Chạy bình thường. Gieo lại dữ liệu mà không sinh bản trùng, và build lại web |
| `bun run demo --nhanh` | Đã gieo dữ liệu từ lần trước, muốn bật nhanh |
| `bun run demo --khong-build` | Dùng bản build web có sẵn |
| `bun run demo --duong-ham` | Mở thêm địa chỉ HTTPS để cài PWA trên điện thoại (mục 6) |
| `bun run demo --lam-lai` | Xóa CSDL demo và dựng lại từ đầu, ví dụ sau buổi giới thiệu có người sửa nhiều dữ liệu |
| `bun run demo --chi-chuan-bi` | Chỉ dựng CSDL và gieo dữ liệu, không bật máy chủ |

### Cấu hình riêng của máy

Giá trị riêng đặt ở tệp `.env.demo.local` ở thư mục gốc. Tệp này không vào git và đè lên `.env.demo`. **Không ghi key hay mật khẩu vào `.env.demo`.**

```
# Văn bản giao thông: chuỗi kết nối kho thật, quyền chỉ đọc là đủ (mục 5)
DEMO_NGUON_DATABASE_URL=postgresql://...

# Bật hỏi đáp AI thật
ANTHROPIC_API_KEY=sk-ant-...
LLM_PROVIDER=auto
```

Không có key AI thì hệ thống vẫn chạy bình thường. Trang "Hỏi trợ lý AI" báo "Hỏi đáp AI chưa được cấu hình trên máy chủ này", không sập và không đưa câu trả lời giả.

## 4. Tài khoản demo

Mật khẩu chung là `Matkhau2026`. Tài khoản mẫu không bị bắt đổi mật khẩu khi đăng nhập lần đầu.

| Vai trò | Tên đăng nhập | Đơn vị | Xem được |
|---|---|---|---|
| Quản trị viên | `quantri` | Toàn hệ thống | Mọi trang, gồm ngân hàng câu hỏi, soạn đề |
| Cán bộ quản lý | `quanly.phong` | Phòng CSGT (PC08) | Giao bài, báo cáo của phòng và các đội |
| Cán bộ quản lý | `quanly.doi1` | Đội 1 | Như trên, trong phạm vi Đội 1 |
| Cán bộ, chiến sĩ | `canbo.d1.01`, `canbo.d1.02`, `canbo.d1.03` | Đội 1 | Học, luyện tập, thi |
| Cán bộ, chiến sĩ | `canbo.d2.01`, `canbo.d2.02` | Đội 2 | Như trên |
| Cán bộ, chiến sĩ | `canbo.d3.01`, `canbo.d3.02` | Đội 3 | Như trên |

Dữ liệu mẫu có sẵn:
- 4 đơn vị: Phòng PC08 và 3 đội.
- Câu hỏi đã duyệt chuyển từ bài tập của các bài giảng giao thông.
- Dữ liệu tra cứu nhanh: mức phạt, quy trình, tốc độ tối đa, biển báo, luật giấy tờ, giới hạn tải trọng (nạp ở trạng thái chờ duyệt, mục 8).

Không gieo sẵn câu hỏi mẫu, đề thi, lịch sử học hay nhóm học cùng: tạo trong ứng dụng khi cần.

## 5. Văn bản giao thông

Nội dung văn bản pháp luật **không được viết tay** vào dữ liệu mẫu. Script `packages/db/src/seed-demo-van-ban.ts` chép nguyên văn từ kho thật. Nó chép mọi văn bản mà nội dung trong CSDL demo đang trích (câu hỏi, bài giảng, hoạt động, tra cứu nhanh), cộng các văn bản bài giảng giao thông khai báo: Luật số 36/2024/QH15, Luật số 35/2024/QH15, Nghị định số 168/2024/NĐ-CP, các thông tư của Bộ Công an, QCVN 41:2024/BGTVT… Ngày 01/10/2026 danh sách có 42 văn bản. Vì đọc căn cứ từ CSDL demo, `bun run demo` chạy bước này sau khi đã gieo các nội dung đó.

- Đặt `DEMO_NGUON_DATABASE_URL` trong `.env.demo.local`, rồi chạy lại `bun run demo`. Chỉ chép văn bản, không dựng lại: `$env:DATABASE_URL="postgres://qdpl:qdpl_dev@127.0.0.1:5436/quydinhphapluat_demo"; bun run packages/db/src/seed-demo-van-ban.ts` (PowerShell, cần đặt cả `DEMO_NGUON_DATABASE_URL`), sau đó chạy `bun run packages/search/src/cli.ts` để đánh chỉ mục.
- Văn bản kho thật chưa có: đặt bản Markdown đã soát theo bản chính thức vào `docs/demo/van-ban/`, kèm frontmatter `so_hieu`, `loai_van_ban`, `ten` (bắt buộc), `co_quan_ban_hanh`, `ngay_ban_hanh`, `ngay_hieu_luc`, `nguoi_ky`. `bun run demo` nạp các tệp này bằng `scripts/demo-van-ban-tep.ts` sau bước chép từ kho thật; văn bản đã có thì bỏ qua. Ngày 01/10/2026 thư mục có Luật số 36/2024/QH15 (chỉ Điều 1–23, phần Công báo số 977 + 978), Luật số 118/2025/QH15, Nghị định số 89/2026/NĐ-CP.
- Script chỉ **đọc** kho thật, trong giao dịch READ ONLY, và chỉ ghi vào CSDL nằm trên máy.
- Chạy lại nhiều lần không sinh bản trùng. Văn bản nào kho thật chưa có thì script liệt kê ra.
- Chưa đặt biến này thì tra cứu văn bản chỉ có 2 văn bản mẫu: Nghị định số 100/2026/NĐ-CP và văn bản sửa đổi, là dữ liệu thử, không phải văn bản thật. Bài giảng vẫn có các đoạn trích căn cứ đã soạn sẵn.

## 6. Mở trên điện thoại

### Cùng mạng Wi-Fi, xem giao diện

1. Điện thoại và máy tính dùng chung một mạng Wi-Fi.
2. Chạy `bun run demo`. Dòng "Cùng mạng Wi-Fi" in ra địa chỉ dạng `http://192.168.x.x:3080`. Chọn địa chỉ cùng dải với điện thoại; địa chỉ 172.x thường là card mạng ảo của Docker hay WSL.
3. Lần đầu, Windows có thể hỏi cho phép Bun hay Node dùng mạng. Chọn cho phép ở **mạng riêng (Private)**.
4. Mở địa chỉ đó bằng Chrome hoặc Safari trên điện thoại.

Cách này xem và dùng được mọi trang. Nhưng **không cài được PWA và không luyện tập offline được**: trình duyệt chỉ cho cài ứng dụng qua HTTPS.

### Cài PWA qua đường hầm HTTPS

1. Cài cloudflared một lần. Windows: `winget install --id Cloudflare.cloudflared`; macOS: `brew install cloudflared`.
2. Chạy `bun run demo --duong-ham`. Dòng "HTTPS (cài PWA)" in ra địa chỉ dạng `https://<tên>.trycloudflare.com`.
3. Mở địa chỉ đó trên điện thoại và đăng nhập.
   - **Chrome Android:** menu ba chấm, chọn "Cài đặt ứng dụng" hoặc "Thêm vào màn hình chính".
   - **Safari iOS:** nút Chia sẻ, chọn "Thêm vào MH chính".
4. Để thử offline:
   - vào **Luyện tập**, chọn thẻ "Luyện tập không cần mạng";
   - bấm **Tải về** ở một chủ đề;
   - tắt mạng rồi làm bài.

   Bật mạng lại thì kết quả tự gửi lên.

Lưu ý:
- **Ai có đường dẫn đường hầm cũng mở được bản demo.** Chỉ gửi cho người cần xem, và tắt demo (Ctrl+C) sau buổi giới thiệu.
- Mỗi lần chạy, địa chỉ đường hầm đổi.
- Micro (nói câu hỏi, nói đáp án) cần HTTPS hoặc localhost. Trên điện thoại, micro chỉ dùng được qua đường hầm.

## 7. Các màn hình

Bảng dưới đây lập từ lượt rà tự động ngày 25/9/2026:
- đăng nhập bằng từng vai trò;
- mở trang ở khổ điện thoại 360px;
- kiểm lỗi và cuộn ngang: không trang nào lỗi hay cuộn ngang.

**Xem được**: trang dựng xong và có dữ liệu mẫu. **Còn là PageStub**: trang mới có khung, hiện dòng "Trang đang được dựng lại trên giao diện mới" và danh sách chức năng sẽ có. **Cần key AI hoặc dịch vụ**: trang chạy, nhưng phần chính cần cấu hình thêm.

### Người dùng (cán bộ, chiến sĩ)

| Màn hình | Đường dẫn | Tình trạng |
|---|---|---|
| Trang chủ | `/` | Xem được |
| Tìm kiếm | `/tim-kiem` | Xem được. Chỉ tìm trong các văn bản có trong CSDL demo (mục 5) |
| Đọc văn bản | `/van-ban/...` | Xem được |
| Thuộc tính, lược đồ, phiên bản của văn bản | `/van-ban/.../thuoc-tinh`, `/luoc-do`, `/phien-ban` | Còn là PageStub |
| So sánh văn bản | `/so-sanh` | Còn là PageStub |
| Trường hợp ứng dụng | `/ung-dung` | Còn là PageStub |
| Tra cứu nhanh: mức phạt, tốc độ, quy trình, biển báo | `/tra-cuu-nhanh/...` | Xem được. Dữ liệu mẫu nạp ở trạng thái chờ duyệt, người học chỉ thấy dữ liệu đã duyệt (mục 8). Ô "Loại đường" ở trang tốc độ chưa hiện: chưa có tốc độ tối đa theo loại đường nào được duyệt |
| Hỏi trợ lý AI | `/hoi-dap` | **Cần key AI.** Không có key thì báo "chưa cấu hình". Nút "Nói câu hỏi" vẫn điền câu hỏi vào ô |
| Bài giảng: danh mục, chuyên đề, bài | `/hoc/...` | Xem được. Có 9 bài đã xuất bản ở 5 chuyên đề. Sách nói **cần key Vbee** nên không hiện |
| Tiến độ học, ôn tập của chuyên đề | `/dao-tao/.../tien-do`, `/on-tap` | Còn là PageStub |
| Luyện tập: chọn chủ đề, làm bài, kết quả | `/luyen-tap` | Xem được. "Đọc câu hỏi" **cần key Vbee**; "Nói đáp án" dùng được trên Chrome |
| Luyện tập không cần mạng | `/luyen-tap/offline` | Xem được. Trên điện thoại cần HTTPS (mục 6) |
| Nhóm học cùng: danh sách, một nhóm, liên kết mời | `/nhom`, `/nhom/...`, `/nhom/tham-gia/...` | Xem được. Chưa có nhóm nào; tạo nhóm mới theo mục 7a. Lối vào: thẻ "Nhóm học cùng" ở `/luyen-tap`, dòng "Nhóm học cùng" trong ngăn "Thêm" trên điện thoại |
| Tôi (lịch sử luyện tập, câu sai, điểm mạnh và điểm yếu) | `/toi` | Xem được. Khối "Điểm mạnh, điểm yếu" cần từ 5 câu trả lời mỗi chủ đề. Khối "Nhắc học" báo chưa cấu hình (**cần khóa VAPID**) |
| Thi: bài được giao, làm bài, kết quả | `/thi` | Xem được. Chưa có đề nào cho tới khi quản trị soạn và giao |
| Tài khoản, đổi mật khẩu | `/tai-khoan`, `/doi-mat-khau` | Xem được |
| Hướng dẫn sử dụng | `/huong-dan` | Còn là PageStub |

### Quản trị (cán bộ quản lý, quản trị viên)

| Màn hình | Đường dẫn | Ai dùng | Tình trạng |
|---|---|---|---|
| Trang đầu quản trị | `/quan-tri` | Cả hai | Còn là PageStub. Các mục con ở thanh trên vẫn dùng được |
| Đơn vị | `/quan-tri/don-vi` | Quản lý xem, quản trị sửa | Xem được |
| Người dùng, nhập Excel | `/quan-tri/nguoi-dung` | Quản lý xem, quản trị sửa | Xem được |
| Ngân hàng câu hỏi: danh sách, soạn, duyệt | `/quan-tri/cau-hoi` | Quản trị | Xem được. Nút "Sinh bằng AI" **cần key AI và Redis** |
| Duyệt dữ liệu tra cứu: mức phạt, biển báo, quy trình, tốc độ tối đa, luật giấy tờ, tải trọng | `/quan-tri/du-lieu-tra-cuu` | Biên tập sửa, pháp chế duyệt | Xem được. Dữ liệu mẫu của `bun run demo` nằm ở trạng thái chờ duyệt; duyệt xong thì người học mới thấy ở Tra cứu nhanh. Tab Tốc độ tối đa trống: tệp dữ liệu chưa có số liệu, chờ đơn vị chuyên môn điền |
| Đề thi: danh sách, soạn ma trận | `/quan-tri/de-thi` | Quản trị | Xem được |
| Giao bài | `/quan-tri/giao-bai` | Cả hai | Xem được |
| Báo cáo, xuất Excel và PDF | `/quan-tri/bao-cao` | Cả hai | Xem được. Chưa có số liệu cho tới khi cán bộ học và làm bài. Tab "Tiến độ học" có mỗi cán bộ một dòng, lọc được theo nhóm học cùng (mục 7b) |
| Nhóm học cùng: danh sách nhóm, tiến độ một nhóm, lưu trữ nhóm | `/quan-tri/nhom`, `/quan-tri/nhom/...` | Cả hai | Xem được. Quản lý chỉ thấy tên và tiến độ của thành viên thuộc đơn vị mình (mục 7b) |
| Chuyên đề | `/quan-tri/chuyen-de` | Quản trị | Còn là PageStub |

### 7a. Xem thử Nhóm học cùng

Không cần chuẩn bị thêm: `bun run demo` áp migration `0056_nhom_hoc_cung.sql`. Dùng hai trình duyệt (hoặc một cửa sổ thường, một cửa sổ ẩn danh) để thấy hai người cùng lúc.

1. Đăng nhập `canbo.d1.01`, mở **Học → Nhóm học cùng** (hoặc ngăn "Thêm" trên điện thoại). Bấm "Tạo nhóm", đặt tên, bấm "Tạo nhóm". Hộp thoại hiện mã mời và liên kết mời; bấm "Sao chép liên kết mời".
2. Ở cửa sổ thứ hai, mở liên kết mời khi chưa đăng nhập: trang chuyển sang đăng nhập. Đăng nhập `canbo.d2.01` (đội khác vẫn tham gia được), trang quay lại, nêu rõ thành viên khác thấy họ tên và phần trăm, không thấy điểm số. Bấm "Tham gia nhóm".
3. Ở `canbo.d1.01`, mở nhóm, bấm "Chia sẻ vào nhóm": chọn "Bài học", tìm một bài, bấm "Chia sẻ bài học". Mở lại, chọn "Đề ôn tập", chọn chủ đề, số câu 5, đặt tên đề, bấm "Chia sẻ đề ôn tập".
4. Ở `canbo.d2.01`, tải lại nhóm, bấm "Học bài" rồi "Hoàn thành bài" ở cuối bài. Quay lại nhóm, bấm "Làm đề", làm hết 5 câu, bấm "Xem kết quả", rồi "Về nhóm".
5. Ở `canbo.d1.01`, tải lại: phần trăm chung của `canbo.d2.01` là 100 (hai mục đều xong), trung bình nhóm 50. Bấm "Cổ vũ" ở dòng của người đó; bên kia tải lại thấy 1 lượt cổ vũ. Bấm lại thì bỏ lượt.
6. Chạm vào họ tên một thành viên để xem phần trăm từng mục. Trưởng nhóm thấy thêm "Chuyển quyền trưởng nhóm", "Mời ra khỏi nhóm". Mục "Tùy chọn" của từng bài cho chuyển lên, chuyển xuống, đặt hạn gợi ý, gỡ khỏi nhóm.
7. Mở một bài giảng ở `/hoc/...` khi đã có nhóm: nút "Chia sẻ vào nhóm" dưới tên bài chia sẻ bài đó vào một hoặc nhiều nhóm.

Lưu ý khi giới thiệu:
- Thành viên chỉ thấy họ tên, phần trăm, số lượt cổ vũ của nhau; không thấy điểm số. Cổ vũ không làm thay đổi phần trăm. Làm lại cùng một đề ôn tập không cộng thêm phần trăm.
- Trang bài học chưa gửi vị trí khối đang đọc, nên phần trăm một bài học là 0 hoặc 100 (câu N14).
- Thông báo khi được cổ vũ hoặc có bài mới **cần khóa VAPID và worker**; bản demo không chạy worker nên không có thông báo. Công tắc nằm trong khối "Nhắc học" ở trang Tôi.
- Trang quản lý nhóm và báo cáo tiến độ học cho cán bộ quản lý: mục 7b.

### 7b. Xem thử trang quản lý nhóm

`bun run demo` không gieo nhóm mẫu. Tạo nhóm theo mục 7a trước, rồi:

1. Đăng nhập `quanly.doi1`, mở **Quản trị → Nhóm học cùng**: quản lý chỉ thấy tên và tiến độ của thành viên thuộc đơn vị mình; thành viên đội khác tính vào "ngoài phạm vi".
2. Mở **Báo cáo → Tiến độ học**: mỗi cán bộ một dòng, lọc được theo nhóm học cùng; bấm "Tải Excel", "Tải PDF".
3. Đăng nhập `quanly.phong`: thấy mọi nhóm có người của phòng PC08.

Lưu ý khi giới thiệu:
- Lưu trữ là thật và không mở lại được.
- Quản lý chỉ xem và lưu trữ nhóm; không sửa nội dung, không giao bài qua nhóm, không cổ vũ từ trang quản trị (câu N11).

### Dịch vụ tắt trong bản demo

| Dịch vụ | Ảnh hưởng | Bật bằng |
|---|---|---|
| AI (Anthropic) | Hỏi đáp AI, sinh câu hỏi | `ANTHROPIC_API_KEY`, `LLM_PROVIDER=auto` |
| Vbee | Đọc câu hỏi, sách nói, giọng đọc | `VBEE_APP_ID`, `VBEE_ACCESS_TOKEN` |
| Web Push | Nhắc học, thông báo đề thi mới | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` |
| Redis | Worker nền: sách nói, nhắc học, sinh câu hỏi | `REDIS_URL` và chạy thêm worker |
| Google | Đăng nhập bằng Google | `GOOGLE_CLIENT_ID` |

## 8. Những điều cần nói trước khi giới thiệu

- **Dữ liệu là mẫu.**
  - Tên người và đơn vị là giả định.
- **Mức phạt, biển báo, quy trình** đang là bản nháp chờ đối chiếu, nên chưa hiện cho người học. Đây là quy tắc có chủ đích: người học chỉ thấy dữ liệu đã duyệt.
- **Tài khoản demo quản trị** dùng mật khẩu chung. `.env.demo` có `AUTH_DEMO_ADMIN=1`; chỉ dùng trên máy demo, không chép sang máy chủ thật.

## 9. Khắc phục sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| "Không bật được Postgres" | Mở Docker Desktop, chờ báo "Engine running", rồi chạy lại |
| "Cổng 3080 (hoặc 3081) đang có tiến trình khác" | Tắt bản demo cũ, hoặc đặt `DEMO_WEB_PORT`, `DEMO_API_PORT` khác trong `.env.demo.local` |
| Điện thoại không mở được địa chỉ `192.168...` | Kiểm tra cùng Wi-Fi; cho phép Bun, Node trong tường lửa Windows ở mạng riêng; thử địa chỉ khác trong danh sách |
| Không thấy nút micro | Trình duyệt không hỗ trợ (ví dụ Firefox), hoặc trang không chạy trên HTTPS hay localhost |
| Dữ liệu bị sửa lung tung sau buổi thử | `bun run demo --lam-lai` |
