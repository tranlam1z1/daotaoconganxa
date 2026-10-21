# Chạy bản demo trên máy

Tài liệu này hướng dẫn dựng bản demo của Quy định Pháp luật trên một máy tính, để xem và giới thiệu cho người khác góp ý. Bản demo dùng CSDL riêng trên máy, không nối với hệ thống thật và không gửi gì ra ngoài.

Kịch bản trình bày theo thứ tự từng bước, kèm dữ liệu nhập trong buổi demo: [KICH-BAN-DEMO.md](KICH-BAN-DEMO.md).

## 1. Bản demo gồm những gì

Hệ thống có **một ứng dụng web** dùng cho mọi vai trò. Không có ứng dụng Admin hay PWA riêng:

| Phần | Địa chỉ trên máy | Ghi chú |
|---|---|---|
| Web người dùng | http://localhost:3080 | Tra cứu, học, luyện tập, thi, trò chơi |
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
| Cán bộ, chiến sĩ | `canbo.d1.01`, `canbo.d1.02`, `canbo.d1.03` | Đội 1 | Học, luyện tập, thi, trò chơi |
| Cán bộ, chiến sĩ | `canbo.d2.01`, `canbo.d2.02` | Đội 2 | Như trên |
| Cán bộ, chiến sĩ | `canbo.d3.01`, `canbo.d3.02` | Đội 3 | Như trên |

Dữ liệu mẫu có sẵn:
- 4 đơn vị: Phòng PC08 và 3 đội.
- Câu hỏi đã duyệt chuyển từ bài tập của các bài giảng giao thông.
- Nội dung trò chơi "[Demo]" (mục 7a trở đi).

Không gieo sẵn câu hỏi mẫu, đề thi, lịch sử học, mùa giải hay nhóm học cùng: tạo trong ứng dụng khi cần.

## 5. Văn bản giao thông

Nội dung văn bản pháp luật **không được viết tay** vào dữ liệu mẫu. Script `packages/db/src/seed-demo-van-ban.ts` chép nguyên văn từ kho thật. Nó chép mọi văn bản mà nội dung trong CSDL demo đang trích (câu hỏi, bài giảng, hoạt động, trò chơi, tra cứu nhanh), cộng các văn bản bài giảng giao thông khai báo: Luật số 36/2024/QH15, Luật số 35/2024/QH15, Nghị định số 168/2024/NĐ-CP, các thông tư của Bộ Công an, QCVN 41:2024/BGTVT… Ngày 01/10/2026 danh sách có 42 văn bản. Vì đọc căn cứ từ CSDL demo, `bun run demo` chạy bước này sau khi đã gieo các nội dung đó.

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
| Tra cứu nhanh: mức phạt, tốc độ, quy trình, biển báo | `/tra-cuu-nhanh/...` | Xem được. Chỉ mức phạt theo tốc độ và 30 biển có phản ứng (gồm P.127) có kết quả (duyệt tự động cho trò chơi, mục 7a); dữ liệu khác còn là bản nháp. Ô "Loại đường" ở trang tốc độ chưa hiện: chưa có tốc độ tối đa theo loại đường nào được duyệt |
| Hỏi trợ lý AI | `/hoi-dap` | **Cần key AI.** Không có key thì báo "chưa cấu hình". Nút "Nói câu hỏi" vẫn điền câu hỏi vào ô |
| Bài giảng: danh mục, chuyên đề, bài | `/hoc/...` | Xem được. Có 9 bài đã xuất bản ở 5 chuyên đề. Sách nói **cần key Vbee** nên không hiện |
| Tiến độ học, ôn tập của chuyên đề | `/dao-tao/.../tien-do`, `/on-tap` | Còn là PageStub |
| Luyện tập: chọn chủ đề, làm bài, kết quả | `/luyen-tap` | Xem được. "Đọc câu hỏi" **cần key Vbee**; "Nói đáp án" dùng được trên Chrome |
| Luyện tập không cần mạng | `/luyen-tap/offline` | Xem được. Trên điện thoại cần HTTPS (mục 6) |
| Nhóm học cùng: danh sách, một nhóm, liên kết mời | `/nhom`, `/nhom/...`, `/nhom/tham-gia/...` | Xem được. Chưa có nhóm nào; tạo nhóm mới theo mục 7m. Lối vào: thẻ "Nhóm học cùng" ở `/luyen-tap`, dòng "Nhóm học cùng" trong ngăn "Thêm" trên điện thoại |
| Tôi (lịch sử, câu sai, huy hiệu, điểm mạnh và điểm yếu) | `/toi` | Xem được. Khối "Điểm mạnh, điểm yếu" cần từ 5 câu trả lời mỗi chủ đề. Khối "Nhắc học" báo chưa cấu hình (**cần khóa VAPID**) |
| Trò chơi: danh sách | `/tro-choi` | Xem được. Mỗi trò là một biểu tượng, như màn hình ứng dụng trên điện thoại; chạm biểu tượng mở ngăn chi tiết (mô tả, số liệu của tôi, nút "Chơi" hoặc danh sách màn). Bấm "Chơi" là vào câu đầu tiên. Đua thời gian và ghép lỗi với mức phạt đã ẩn khỏi danh sách (PRD §V.4); quản trị bật lại được |
| Trò chơi: Trắc nghiệm nhanh (trò mẫu của khung chung) | `/tro-choi/luot/...` | Xem được, chơi được. Trang chủ có nút "Chơi ngay". Đầu trang có nút âm thanh (mặc định tắt) và rung; hiệu ứng theo VISUAL_STYLE hướng A |
| Trò chơi: Súng bắn tốc độ | `/tro-choi/luot/...` | Xem được, chơi được. `bun run demo` tự nạp và duyệt dữ liệu demo (mục 7a); dữ liệu chưa đối chiếu với văn bản |
| Trò chơi: vượt màn, hỏi nhanh bằng giọng nói | `/tro-choi/vuot-man/...`, `/hoi-nhanh-giong-noi` | Xem được, chơi được |
| Trò chơi: Cung đường biển báo | `/tro-choi/cung-duong-bien-bao`, rồi `/tro-choi/luot/...` | Xem được, chơi được. 3 câu đoán biển khởi động rồi đường chạy 12 biển, có 3 mạng. `bun run demo` tự duyệt 30 biển demo có phản ứng (mục 7a); dữ liệu chưa đối chiếu QCVN 41:2024. Bật giảm chuyển động thì chơi theo từng bước |
| Trò chơi: Kiểm tra giấy tờ | `/tro-choi` (chạm biểu tượng, chọn màn), rồi `/tro-choi/luot/...` | Xem được, chơi được. 5 màn, mỗi màn 8 người lái; màn 1 mở sẵn, đạt từ 1 sao thì mở màn sau. Lượt đầu có màn hướng dẫn 3 bước. `bun run demo` tự duyệt 12 luật giấy tờ và 30 hồ sơ demo (mục 7c); dữ liệu chưa đối chiếu văn bản, biên bản ghi "Chưa có mức phạt đã duyệt" |
| Trò chơi: Soi camera | `/tro-choi` (chạm biểu tượng, chọn màn), rồi `/tro-choi/luot/...` | Xem được, chơi được. 5 màn, mỗi lượt một đoạn phim camera 20–40 giây dựng bằng mô phỏng (không video); dừng hình, khoanh xe, kéo thẻ lỗi; tua lại tối đa 3 lần. `bun run demo` tự duyệt 8 kịch bản và 3 dòng mức phạt (mục 7f); dữ liệu chưa đối chiếu Nghị định 168/2024 (chưa có trong kho) |
| Trò chơi: Tự lái qua phố | `/tro-choi` (chạm biểu tượng, chọn màn), rồi `/tro-choi/luot/...` | Xem được, chơi được. 3 màn, mỗi lượt một khu phố; lái bằng nút ga, phanh, trái, phải, xi nhan; game âm thầm ghi lỗi, cuối lượt có biên bản, chạm lỗi để tua lại. `bun run demo` tự duyệt 3 khu phố và bảng lỗi (mục 7g); chưa đối chiếu Luật 36/2024, Nghị định 168/2024 (chưa có trong kho) |
| Trò chơi: Duyệt hồ sơ phạt nguội | `/tro-choi` (chạm biểu tượng, chọn màn), rồi `/tro-choi/luot/...` | Xem được, chơi được. 5 màn, 10–15 hồ sơ camera mỗi ca; chạm chỗ thiếu trên thẻ, vuốt trái gửi thông báo, vuốt phải trả lại (có nút thay cho vuốt). `bun run demo` tự duyệt 6 luật kiểm hồ sơ và 30 hồ sơ demo (mục 7h); luật chưa đối chiếu văn bản (chưa có trong kho) |
| Trò chơi: Trạm cân tải trọng | `/tro-choi` (chạm biểu tượng, chọn màn), rồi `/tro-choi/luot/...` | Xem được, chơi được. 5 màn, 6–8 xe tải mỗi ca; ghim cặp số (hiện hiệu số kg), ước phần trăm vượt bằng thanh trượt, đóng dấu Cho đi, Hạ tải hoặc Lập biên bản. `bun run demo` tự duyệt 10 giới hạn tải trọng, 8 khung phần trăm quá tải và 30 xe demo (mục 7i); mọi con số, khung, số tiền là số minh họa, chưa đối chiếu văn bản |
| Trò chơi: Lên xe khách | `/tro-choi` (chạm biểu tượng, chọn màn), rồi `/tro-choi/luot/...` | Xem được, chơi được. 5 màn, 2–3 xe khách mỗi lượt; chạm từng người trên sơ đồ khoang xe để đếm, báo số người vượt bằng − và +; từ màn 3 chạm chỗ sai trên lệnh vận chuyển, phù hiệu, từ màn 4 trên màn giám sát hành trình; đóng dấu Cho đi hoặc Lập biên bản rồi sắp lỗi nặng đến nhẹ. `bun run demo` tự duyệt 10 luật vận tải hành khách, 4 dòng mức phạt và 20 xe demo (mục 7j); ngưỡng thời gian lái, số tiền là số minh họa; 3 xe có trẻ em không vào lượt vì chưa có luật cách tính trẻ em |
| Trò chơi: Dựng chốt an toàn ban đêm | `/tro-choi` (chạm biểu tượng, chọn màn), rồi `/tro-choi/luot/...` | Xem được, chơi được. 5 màn, một đoạn đường ban đêm mỗi lượt; đặt biển, cọc, đèn, xe tuần tra, chiến sĩ theo lưới 1 m, chạy thử 2 lần, nộp bố trí. `bun run demo` tự duyệt 3 bộ tiêu chí và 10 đoạn đường demo (mục 7k); ngưỡng chấm là số minh họa, chưa có căn cứ |
| Trò chơi: Soi xe cải tạo | `/tro-choi` (chạm biểu tượng, chọn màn), rồi `/tro-choi/luot/...` | Xem được, chơi được. 5 màn, 5–8 xe mỗi lượt; hai hình xe (nghiêng, sau) dựng từ tham số, khoanh chỗ khác giấy chứng nhận kiểm định (kéo khung, chạm, hoặc bàn phím), nối dòng giấy, phóng to, thước đo mm; đóng dấu Đạt hoặc Không đạt. `bun run demo` tự duyệt 4 dòng mức phạt, 7 biến thể và 16 xe demo (mục 7l); căn cứ chưa tra được kho, số tiền là số minh họa |
| Trò chơi: Truy vết xe bỏ trốn | `/tro-choi` (chạm biểu tượng, chọn màn), rồi `/tro-choi/luot/...` | Xem được, chơi được. 5 màn, một vụ mỗi lượt; đọc tin báo, mở camera trên bản đồ khu phố, xem đoạn cảnh 10 giây, chạm để khóa xe, đặt điểm chặn. `bun run demo` tự duyệt 8 vụ demo (mục 7o); căn cứ chưa có trong kho văn bản |
| Trò chơi: Tái dựng hiện trường | `/tro-choi` (chạm biểu tượng, chọn màn), rồi `/tro-choi/luot/...` | Xem được, chơi được. 5 màn, một vụ va chạm mỗi lượt; đọc dấu vết trên sơ đồ (vị trí cuối, vết phanh, vết trượt, mảnh vỡ), kéo xe tới vị trí ban đầu, xoay, chọn tốc độ và hành động, mô phỏng tối đa 20 lần, kéo thẻ lỗi vào xe rồi chốt kết luận. `bun run demo` tự duyệt 3 dòng mức phạt và 5 vụ demo (mục 7p); mô phỏng minh họa, căn cứ về xử lý tai nạn chờ khách hàng cung cấp |
| Trò chơi: Cắm biển cho tuyến đường | `/tro-choi` (chạm biểu tượng, chọn màn), rồi `/tro-choi/luot/...` | Xem được, chơi được. 5 màn, mỗi lượt một đoạn đường; kéo biển vào vị trí, cho xe chạy thử tối đa 3 lần, lần chạy cuối được chấm. `bun run demo` tự duyệt 6 đoạn đường demo (mục 7e); đáp án chưa đối chiếu QCVN 41:2024 (chưa có trong kho) |
| Trò chơi: Dừng xe đúng quy trình | `/tro-choi` (chạm biểu tượng, chọn màn), rồi `/tro-choi/luot/...` | Mã xong, **đang tắt**: `bun run demo` chưa tự chuẩn bị trò này (cách bật ở mục 7d). 5 màn, mỗi lượt một tình huống; chơi bằng vuốt, chạm, kéo, giữ. Quy trình và 5 tình huống là dữ liệu demo, **không bước nào có căn cứ trong kho**, màn kết quả ghi "Căn cứ đang được cập nhật" |
| Trò chơi: Lập biên bản | `/tro-choi/lap-bien-ban`, rồi `/tro-choi/luot/...` | Mã xong, **đang tắt**: `bun run demo` chưa tự chuẩn bị trò này. Muốn thử: `bun run db:seed:tro-choi` (42 tình huống demo, chờ duyệt), duyệt các dòng mức phạt ở `/quan-tri/du-lieu-tra-cuu`, duyệt tình huống và bật trò ở `/quan-tri/noi-dung-tro-choi`. 3 biên bản mỗi lượt, không tính giờ; dữ liệu chưa đối chiếu Nghị định 168/2024, ô Điều khoản mới chấm tới Điều |
| Trò chơi: đoán biển báo (cũ) | `/tro-choi/doan-bien-bao` | Chuyển về Cung đường biển báo: đoán biển nay là phần khởi động |
| Duyệt phong cách trò chơi | `/game-style-demo` | Xem được với tài khoản biên tập trở lên; học viên nhận trang "Không đủ quyền". Mỗi hiệu ứng có nút "Chạy lại"; có công tắc âm thanh, rung, giảm hiệu ứng |
| Chơi khi không có mạng | `/tro-choi/offline` | Xem được. Tải được Trắc nghiệm nhanh; Súng bắn tốc độ, Cung đường biển báo, Kiểm tra giấy tờ, Cắm biển cho tuyến đường, Soi camera, Tự lái qua phố, Duyệt hồ sơ phạt nguội, Trạm cân tải trọng, Lên xe khách, Dựng chốt an toàn ban đêm, Soi xe cải tạo, Truy vết xe bỏ trốn và Tái dựng hiện trường (các màn đang mở lúc tải) tải được khi đã bật (ảnh biển chỉ hiện nếu đã xem khi còn mạng). Trên điện thoại cần HTTPS (mục 6) |
| Bảng xếp hạng | `/bang-xep-hang` | Xem được |
| Mùa giải đơn vị | `/bang-xep-hang?pham_vi=mua_giai` (tab "Mùa giải") | Xem được. Nhóm của đội mình tính trực tiếp trong tuần, vùng lên/xuống hạng, kết quả tuần trước có sao và dấu kết quả. Chưa có mùa nào cho tới khi quản trị tạo (mục 7b) |
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
| Nội dung trò chơi: danh sách, soạn, duyệt, bật tắt trò | `/quan-tri/noi-dung-tro-choi` | Biên tập soạn, pháp chế duyệt, quản trị bật tắt trò | Xem được. Có 20 tình huống "[Demo]" của Súng bắn tốc độ đã duyệt tự động (mục 7a) |
| Duyệt dữ liệu tra cứu: mức phạt, biển báo, quy trình, tốc độ tối đa, luật giấy tờ, tải trọng | `/quan-tri/du-lieu-tra-cuu` | Biên tập sửa, pháp chế duyệt | Xem được. Tab Luật giấy tờ có 12 luật demo của trò Kiểm tra giấy tờ, 6 luật kiểm hồ sơ demo của trò Duyệt hồ sơ phạt nguội và 10 luật vận tải hành khách demo của trò Lên xe khách (hiện tham số ngưỡng), lọc theo nhóm. Tab Tải trọng có 10 giới hạn tải trọng demo của trò Trạm cân (số minh họa); tab Mức phạt có thêm 8 dòng khung phần trăm quá tải (số minh họa). Tab Tốc độ tối đa trống: tệp dữ liệu chưa có số liệu, chờ đơn vị chuyên môn điền. Tab Biển báo có thêm hai trường "Phản ứng đúng" và "Giải thích phản ứng" cho Cung đường biển báo |
| Đề thi: danh sách, soạn ma trận | `/quan-tri/de-thi` | Quản trị | Xem được |
| Giao bài | `/quan-tri/giao-bai` | Cả hai | Xem được |
| Báo cáo, xuất Excel và PDF | `/quan-tri/bao-cao` | Cả hai | Xem được. Chưa có số liệu cho tới khi cán bộ học và làm bài. Tab "Tiến độ học" có mỗi cán bộ một dòng, lọc được theo nhóm học cùng (mục 7n) |
| Nhóm học cùng: danh sách nhóm, tiến độ một nhóm, lưu trữ nhóm | `/quan-tri/nhom`, `/quan-tri/nhom/...` | Cả hai | Xem được. Quản lý chỉ thấy tên và tiến độ của thành viên thuộc đơn vị mình (mục 7n) |
| Mùa giải đơn vị: tạo mùa, sửa cấu hình, kết thúc sớm, chốt tuần | `/quan-tri/mua-giai` | Quản trị | Xem được. Chưa có mùa nào (mục 7b); cấu hình chỉ sửa được trước khi mùa bắt đầu |
| Chuyên đề | `/quan-tri/chuyen-de` | Quản trị | Còn là PageStub |

### 7a. Chơi thử Súng bắn tốc độ và Cung đường biển báo

`bun run demo` chuẩn bị sẵn hai trò này qua bước "Trò chơi Súng bắn tốc độ, Cung đường biển báo (dữ liệu demo)" (`scripts/demo-tro-choi.ts`):
- nạp 20 tình huống "[Demo]";
- **duyệt tự động** 7 khung phạt theo tốc độ, biển P.127 và 20 tình huống; người duyệt ghi là `demo-tu-dong`;
- **duyệt tự động** 30 biển có phản ứng (dữ liệu demo trong `data/bien-bao/bien-bao.json`);
- bật hai trò cho người học.

Đăng nhập cán bộ, mở `/tro-choi`, chạm biểu tượng Súng bắn tốc độ hoặc Cung đường biển báo, rồi bấm "Chơi" trong ngăn chi tiết. Cung đường: sau 3 câu khởi động, bấm "Xuất phát" rồi bấm nút thao tác khi biển xuất hiện; về đích thì bấm "Chốt đáp án".

Lưu ý khi giới thiệu:
- **Dữ liệu được duyệt tự động chưa đối chiếu với văn bản** (docs/luu-tru/GAME_DESIGN_cu.md §5.2, §5.5). Vì vậy script chỉ chạy trên CSDL demo trên máy (tên kết thúc bằng `_demo`).
- Mức phạt theo tốc độ cũng hiện ở Tra cứu nhanh của bản demo.
- Đang chạy demo mà muốn chuẩn bị lại, không cần dựng lại: `$env:DATABASE_URL="postgres://qdpl:qdpl_dev@127.0.0.1:5436/quydinhphapluat_demo"; bun run scripts/demo-tro-choi.ts` (PowerShell).

### 7b. Xem thử Mùa giải đơn vị

`bun run demo` không gieo mùa giải. Đăng nhập `quantri`, mở `/quan-tri/mua-giai`, bấm "Tạo mùa giải mới" (ngày bắt đầu phải là thứ Hai). Tab **Bảng xếp hạng → Mùa giải** có số liệu khi cán bộ có XP trong tuần.

Lưu ý khi giới thiệu:
- Số hạng, cỡ nhóm, số lên/xuống, trần XP là đề xuất (GAME_DESIGN câu Q11), chờ khách hàng chốt. Mùa giải có chạy song song với trò "Thành phố an toàn" hay không còn chờ câu D2.
- Bản demo không chạy worker (không có Redis). Tuần tự chốt ở lần đầu có người mở tab Mùa giải sau 06:00 thứ Hai, hoặc khi quản trị bấm "Chốt ngay các tuần đã tới hạn".

### 7c. Chơi thử Kiểm tra giấy tờ

`bun run demo` chuẩn bị sẵn qua cùng bước với mục 7a (`scripts/demo-tro-choi.ts`). **Toàn bộ là dữ liệu demo, chưa duyệt:**
- bước "Tra cứu nhanh" nạp 12 luật giấy tờ từ `data/tra-cuu/luat-giay-to.json`;
- nạp 30 hồ sơ "[Demo]" từ `data/tro-choi/kiem-tra-giay-to.json` (họ tên, biển số, số giấy tờ là dữ liệu giả);
- **duyệt tự động** luật và hồ sơ, người duyệt ghi là `demo-tu-dong`;
- bật trò cho người học.

Đăng nhập cán bộ, mở `/tro-choi`, chạm biểu tượng Kiểm tra giấy tờ, trong ngăn chi tiết bấm "Màn 1". Với mỗi người lái:
- chạm vào giấy tờ để phóng to, chạm dòng sai để đánh dấu, bấm "Xong";
- đóng dấu "Cho qua", hoặc "Giữ lại" (chỉ bấm được khi đã đánh dấu).

Đạt từ 1 sao thì màn kết quả có nút "Chơi màn 2". Màn 2 trở đi có đồng hồ cả ca ở góc phải.

Lưu ý khi giới thiệu:
- **Luật giấy tờ chưa đối chiếu văn bản**: kho chưa có Luật số 36/2024/QH15 và văn bản bảo hiểm bắt buộc. Danh sách cần đơn vị chuyên môn kiểm ở docs/GAME_DESIGN.md §5.1.
- Chưa có mức phạt cho lỗi giấy tờ, nên phần biên bản ghi "Chưa có mức phạt đã duyệt".
- Tiến độ màn lưu theo tài khoản. Muốn giới thiệu lại từ màn 1 thì dùng tài khoản khác.
- Muốn xem lại hướng dẫn: bấm "Cách chơi" cạnh số người lái.

### 7d. Chơi thử Dừng xe đúng quy trình

Chưa có trong `bun run demo`. Chuẩn bị bằng tay (chỉ trên CSDL demo hoặc phát triển):
1. `bun run tra-cuu:nap`: nạp quy trình "[Demo] Dừng xe kiểm tra" (`dung-xe-kiem-tra`) vào chờ duyệt;
2. `bun run db:seed:tro-choi`: nạp 5 tình huống "[Demo] DX-01…DX-05" (chờ duyệt);
3. ở `/quan-tri/du-lieu-tra-cuu`: duyệt quy trình `dung-xe-kiem-tra`, 12 luật giấy tờ, và mức phạt `oto-con-muc-2`, `mt-con-muc-3` (cho DX-04, DX-05);
4. ở `/quan-tri/noi-dung-tro-choi`: duyệt 5 tình huống, bật trò "Dừng xe đúng quy trình".

Cách chơi (màn 1 có mũi tên "Tiếp theo"): vuốt lên trong ô để ra hiệu lệnh (hoặc bấm "Không vuốt được?"); chạm chỗ cho xe dừng (từ màn 2); chạm lời thoại; kéo từng giấy tờ vào khay Đạt / Không đạt (hoặc chạm giấy rồi chạm khay); giữ nút máy đo (từ màn 3); kéo thẻ "Kết quả kiểm tra" vào hướng xử lý là nộp.

Nên giới thiệu: làm đúng một lượt, rồi một lượt cố ý đề nghị xuất trình trước khi nói lý do để thấy người lái bức xúc và bước "sai thứ tự" ở màn kết quả. Tình huống không hợp tác: DX-03 (màn 3), DX-05 (màn 5).

Lưu ý: quy trình, vị trí an toàn, thời gian thổi, hướng xử lý đều chưa đối chiếu văn bản; bảng câu hỏi cho đơn vị chuyên môn ở docs/GAME_DESIGN.md §5.4.

### 7e. Chơi thử Cắm biển cho tuyến đường

`bun run demo` chuẩn bị sẵn (`scripts/demo-tro-choi.ts`, bước 6), sau khi đã duyệt các biển có phản ứng cho Cung đường biển báo. **Toàn bộ là dữ liệu demo, chưa duyệt:**
- nạp 6 đoạn đường "[Demo]" từ `data/tro-choi/cam-bien.json` (CB-01, CB-02 màn 1; CB-03 đến CB-06 màn 2 đến 5);
- **duyệt tự động** các đoạn đó, người duyệt ghi là `demo-tu-dong`;
- bật trò cho người học.

Đăng nhập cán bộ, mở `/tro-choi`, chạm biểu tượng Cắm biển cho tuyến đường, trong ngăn chi tiết bấm "Màn 1":
- kéo một biển trong khay vào ô số cạnh đường (hoặc chạm biển rồi chạm ô); chạm ô đã cắm để gỡ;
- bấm "Cho xe chạy thử": xe chạy từ dưới lên; biển sai hoặc thiếu thì có dấu cảnh báo và danh sách tình huống nguy hiểm;
- "Chỉnh lại biển" rồi chạy thử lại, hoặc "Nộp bố trí này". Màn kết quả có biển đúng, lý do, căn cứ từng vị trí.

Lưu ý khi giới thiệu:
- **Đáp án chưa đối chiếu văn bản**: QCVN 41:2024/BGTVT chưa có trong kho; danh sách cần đơn vị chuyên môn kiểm ở docs/GAME_DESIGN.md §5.3.
- Hoạt cảnh chỉ minh họa: tốc độ an toàn của từng chỗ nguy hiểm là thông số mô phỏng, không phải tốc độ theo quy định.
- Giảm hiệu ứng (công tắc trong trò hoặc cài đặt máy): chạy thử theo từng bước bằng nút "Bước tiếp (1 giây)".
- Biên tập viên soạn đoạn đường mới ở `/quan-tri/noi-dung-tro-choi/moi`, chọn trò "Cắm biển cho tuyến đường": soạn theo lưới ô, có nút "Chơi thử".

### 7f. Chơi thử Soi camera

`bun run demo` chuẩn bị sẵn (`scripts/demo-tro-choi.ts`, bước 7). **Toàn bộ là dữ liệu demo, chưa duyệt:**
- duyệt 3 dòng mức phạt mà kịch bản trỏ tới (vượt đèn đỏ ô tô, xe máy; không đội mũ bảo hiểm), bản nháp chưa đối chiếu;
- nạp 8 kịch bản "[Demo]" từ `data/tro-choi/soi-camera.json` (SC-01, SC-02 màn 1; SC-03, SC-04 màn 2; SC-05, SC-06 màn 3; SC-07 màn 4; SC-08 màn 5, ban đêm);
- **duyệt tự động** các kịch bản, người duyệt ghi là `demo-tu-dong`; bật trò.

Đăng nhập cán bộ, mở `/tro-choi`, chạm biểu tượng Soi camera, trong ngăn chi tiết bấm "Màn 1", rồi "Bắt đầu xem":
- thấy xe vi phạm thì bấm "Dừng hình"; kéo khung hoặc vẽ vòng quanh xe (chạm thẳng vào xe cũng được);
- kéo thẻ lỗi vào khung vàng, rồi "Tiếp tục"; hết phim thì "Nộp kết quả";
- màn kết quả có khung hình lúc vi phạm, xe tô đỏ; "Tua lại xem chậm" chạy lùi rồi phát chậm; có biên bản mô phỏng.

Lưu ý khi giới thiệu:
- **Hành vi vi phạm và mã mức phạt chưa đối chiếu văn bản**: Nghị định 168/2024/NĐ-CP chưa có trong kho. Đi sai làn và dừng xe sai nơi chưa có dòng mức phạt, biên bản ghi "Chưa có mức phạt đã duyệt". Danh sách cần đơn vị chuyên môn kiểm ở docs/GAME_DESIGN.md §5.5.
- Giảm hiệu ứng: phim chạy từng đoạn bằng nút "Chạy 2 giây"; nhiễu hình đứng yên.
- Biên tập viên soạn kịch bản mới ở `/quan-tri/noi-dung-tro-choi/moi`, chọn trò "Soi camera": mỗi xe một dòng; danh sách vi phạm tự lấy từ mô phỏng; có nút "Chơi thử".

### 7g. Chơi thử Tự lái qua phố

`bun run demo` chuẩn bị sẵn (`scripts/demo-tro-choi.ts`, bước 8), sau bước duyệt biển (4), mức phạt tốc độ (2) và vượt đèn đỏ (7). **Toàn bộ là dữ liệu demo, chưa duyệt:**
- nạp 3 khu phố "[Demo]" từ `data/tro-choi/tu-lai.json` (KP-01 Phố Hoa Sữa màn 1, KP-02 Phố Chợ màn 2, KP-03 Khu Bến Cảng màn 3) và bảng lỗi → mức phạt "[Demo]";
- **duyệt tự động** các nội dung đó, người duyệt ghi là `demo-tu-dong`; bật trò.

Đăng nhập cán bộ, mở `/tro-choi`, chạm biểu tượng Tự lái qua phố, trong ngăn chi tiết bấm "Màn 1":
- chọn Ô tô con hoặc Xe mô tô, "Bắt đầu lái"; giữ Ga, giữ Phanh; mũi tên xanh chỉ hướng cờ đích;
- gần nơi giao nhau chạm "Rẽ trái"/"Rẽ phải"; giữa phố chạm để chuyển làn; đứng yên chạm "Quay đầu"; bật xi nhan bằng hai nút trên;
- tới cờ đích (hoặc "Dừng lượt, nộp", hoặc hết giờ) thì có biên bản: từng lỗi, lúc nào, đúng ra phải làm gì, mức phạt, căn cứ. Chạm số trên bản đồ hoặc "Xem lại lúc…" để tua lại 3 giây trước lỗi.
- Bàn phím: ↑ ga, ↓ phanh, ← → trái phải, Q E xi nhan, P tạm dừng.

Để thấy lỗi: màn 1 đi thẳng khi đèn đỏ (đèn hướng Đông–Tây đỏ 13 giây đầu), chạy quá 40 km/h, rẽ không xi nhan; màn 3 đi tắt lên cột 9 là đi ngược chiều; người đi bộ bước ra khi xe còn cách vạch 20 m.

Lưu ý khi giới thiệu:
- **Tên hành vi, mã mức phạt chưa đối chiếu văn bản**: Luật số 36/2024/QH15, Nghị định 168/2024/NĐ-CP chưa có trong kho, mọi căn cứ ghi "Căn cứ đang được cập nhật". Chỉ vượt đèn đỏ và quá tốc độ có dòng mức phạt; các lỗi khác ghi "Chưa có mức phạt đã duyệt". Danh sách cần đơn vị chuyên môn kiểm ở docs/GAME_DESIGN.md §5.9.
- Giảm hiệu ứng: khung nhìn đứng yên theo đoạn, tốc độ tối đa còn 70%, không tính giờ; xem lại là ảnh tĩnh, lùi/tới từng giây.
- Khu phố soạn theo mẫu (biểu mẫu lấy số liệu từ một nội dung đã có; hoặc bấm "Sửa dạng mã" để dán JSON) ở `/quan-tri/noi-dung-tro-choi/moi`, chọn trò "Tự lái qua phố" (định dạng ở đầu `packages/dao-tao/src/tro-choi/tu-lai-pho.ts` và `data/tro-choi/tu-lai.json`). Chưa có trình soạn riêng và nút "Chơi thử"; khu phố sai định dạng không vào lượt.

### 7h. Chơi thử Duyệt hồ sơ phạt nguội

`bun run demo` chuẩn bị sẵn: bước "Tra cứu nhanh" nạp 6 luật kiểm hồ sơ từ `data/tra-cuu/luat-ho-so-phat-nguoi.json` (nhóm `ho_so_phat_nguoi` của `document_rules`); `scripts/demo-tro-choi.ts` duyệt các luật đó ở bước 5 (cùng bảng với luật giấy tờ), rồi ở bước 9 nạp 30 hồ sơ "[Demo]" từ `data/tro-choi/phat-nguoi.json` (PN-01 đến PN-10 màn 1, mỗi màn sau 5 hồ sơ), **duyệt tự động** (người duyệt `demo-tu-dong`) và bật trò. Mức phạt mà hồ sơ trỏ tới (quá tốc độ, vượt đèn đỏ, mũ bảo hiểm) đã duyệt ở bước 2 và 7. **Toàn bộ là dữ liệu demo, chưa duyệt.**

Đăng nhập cán bộ, mở `/tro-choi`, chạm biểu tượng Duyệt hồ sơ phạt nguội, trong ngăn chi tiết bấm "Màn 1". Với mỗi hồ sơ:
- đối chiếu ảnh (đèn, vạch dừng, làn, mũ bảo hiểm, độ rõ), biển số trên ảnh phóng to với biển số hệ thống đọc, thời điểm, hạn kiểm định của thiết bị, hành vi đề xuất và số đo tốc độ;
- đủ căn cứ: vuốt trái trên ô vuốt (hoặc nút "← Gửi thông báo", hoặc phím ←). Gửi đúng thì kết quả có "Thông báo vi phạm (mô phỏng)";
- thiếu căn cứ: chạm vào chỗ thiếu trên thẻ (chạm lại để bỏ), rồi vuốt phải (hoặc nút "Trả lại →", hoặc phím →). Chưa chạm chỗ nào thì không trả lại được.

Để thấy từng loại chỗ thiếu: màn 1 có hồ sơ không có thời điểm (PN-05) và ảnh mờ hẳn (PN-08); màn 2 biển số mờ (PN-12), thiết bị hết hạn kiểm định (PN-14); màn 3 đề xuất vượt đèn đỏ mà đèn xanh (PN-17); màn 4 thiếu hai chỗ (PN-23); màn 5 hệ thống đọc "81" thay cho "B1" (PN-26), vào đường cấm lúc 09:12 khi biển cấm 06:00–09:00 (PN-28), hai xe chồng nhau (PN-30). Muốn chơi màn sau ngay, dùng tài khoản đã qua màn trước.

Lưu ý khi giới thiệu:
- **Căn cứ chưa đối chiếu:** kho văn bản chưa có văn bản về dữ liệu từ thiết bị kỹ thuật nghiệp vụ, thông báo vi phạm, kiểm định thiết bị; URN trong luật là dự kiến. Đi sai làn, đi vào đường cấm theo giờ ghi "Chưa có mức phạt đã duyệt". Danh sách cần đơn vị chuyên môn kiểm ở docs/GAME_DESIGN.md §5.11.
- Giảm hiệu ứng: thẻ không nghiêng theo ngón tay, không bay ra; quyết định là gửi ngay.
- Hồ sơ soạn theo mẫu (biểu mẫu lấy số liệu từ một nội dung đã có; hoặc bấm "Sửa dạng mã" để dán JSON) ở `/quan-tri/noi-dung-tro-choi/moi`, chọn trò "Duyệt hồ sơ phạt nguội" (định dạng như `data/tro-choi/phat-nguoi.json`, `answer` là `{ "cho_thieu": [...] }`). Chưa có trình soạn riêng; hồ sơ mà luật đã duyệt cho kết quả khác `cho_thieu` không vào lượt.

### 7i. Chơi thử Trạm cân tải trọng

`bun run demo` chuẩn bị sẵn: bước "Tra cứu nhanh" nạp 10 giới hạn tải trọng từ `data/tra-cuu/tai-trong.json` và 8 dòng mức phạt có khung phần trăm quá tải trong `data/tra-cuu/muc-phat.json`; `scripts/demo-tro-choi.ts` bước 10 duyệt các dòng đó, nạp 30 xe "[Demo]" từ `data/tro-choi/tram-can.json` (TC-01 đến TC-07 màn 1, TC-08 đến TC-13 màn 2, TC-14 đến TC-19 màn 3, TC-20 đến TC-25 màn 4, TC-26 đến TC-30 màn 5), **duyệt tự động** (người duyệt `demo-tu-dong`) và bật trò. **Mọi con số giới hạn, khung phần trăm, số tiền là số minh họa để chạy thử, không lấy từ văn bản.**

Đăng nhập cán bộ, mở `/tro-choi`, chạm biểu tượng Trạm cân tải trọng, trong ngăn chi tiết bấm "Màn 1". Với mỗi xe:
- chạm một số trên phiếu cân (tổng trọng lượng; màn 2 thêm khối lượng hàng; màn 3 thêm từng nhóm trục) rồi chạm số giới hạn cần so (giấy kiểm định; màn 3 thêm bảng tải trọng tại trạm; màn 4 thêm giấy phép lưu hành). Cặp số hiện hiệu số kg; ghim được nhiều cặp, chạm cặp để chọn làm căn cứ;
- kéo thanh trượt (hoặc −, +, phím mũi tên) tới phần trăm vượt của cặp căn cứ, không vượt thì 0%;
- đóng dấu Cho đi, Hạ tải hoặc Lập biên bản. Chưa ghim cặp nào thì dấu khóa. Xe lập biên bản có biên bản mô phỏng ở màn kết quả.

Để thấy từng tình huống: màn 1 xe đúng bằng giới hạn (TC-02, cho đi), vượt đúng 10% (TC-04, hạ tải), vượt 10,1% (TC-07, lập biên bản); màn 2 tổng chỉ vượt ít nhưng hàng vượt nhiều (TC-08); màn 3 cụm trục phải chọn đúng dòng theo khoảng cách trục (TC-15); màn 4 giấy phép còn hạn (TC-20), hết hạn (TC-21), sai tuyến (TC-22); màn 5 đầu kéo cụm 3 trục (TC-27, TC-28). Muốn chơi màn sau ngay, dùng tài khoản đã qua màn trước.

Lưu ý khi giới thiệu:
- **Số liệu chưa đối chiếu:** kho văn bản chưa có văn bản về tải trọng, giấy phép lưu hành, xử phạt quá tải. Căn cứ của giới hạn là URN dự kiến; căn cứ của khung phạt ghi "điều chưa xác định". Ý nghĩa "Hạ tải" và "Lập biên bản" đang chờ đơn vị chuyên môn. Danh sách cần kiểm ở docs/GAME_DESIGN.md §5.12.
- Sửa một giới hạn ở tab Tải trọng thì giới hạn về chờ duyệt, xe cần nó rời trò cho tới khi duyệt lại; duyệt con số mới thì đáp án của xe đổi theo.
- Giảm hiệu ứng: xe hiện dần tại chỗ, dấu không đập.
- Xe soạn theo mẫu (biểu mẫu lấy số liệu từ một nội dung đã có; hoặc bấm "Sửa dạng mã" để dán JSON) ở `/quan-tri/noi-dung-tro-choi/moi`, chọn trò "Trạm cân tải trọng" (định dạng như `data/tro-choi/tram-can.json`, `answer` để `{}`). Chưa có trình soạn riêng.

### 7j. Chơi thử Lên xe khách

`bun run demo` chuẩn bị sẵn: bước "Tra cứu nhanh" nạp 10 luật vận tải hành khách từ `data/tra-cuu/luat-van-tai-khach.json` (bước 5 của `scripts/demo-tro-choi.ts` duyệt cùng luật giấy tờ) và 4 dòng mức phạt `oto-khach-*` trong `data/tra-cuu/muc-phat.json`; bước 11 duyệt 4 dòng đó, nạp 20 xe "[Demo]" từ `data/tro-choi/xe-khach.json` (XK-01 đến XK-04 màn 1, XK-05 đến XK-08 màn 2, XK-09 đến XK-12 màn 3, XK-13 đến XK-16 màn 4, XK-17 đến XK-20 màn 5), **duyệt tự động** (người duyệt `demo-tu-dong`) và bật trò. **Ngưỡng thời gian lái (240 phút liên tục, 600 phút trong ngày, nghỉ tối thiểu 15 phút) và số tiền là số minh họa, không lấy từ văn bản.**

Đăng nhập cán bộ, mở `/tro-choi`, chạm biểu tượng Lên xe khách, trong ngăn chi tiết bấm "Màn 1". Với mỗi xe:
- chạm từng người trên sơ đồ khoang xe (ngồi, đứng lối đi; màn 5 nằm sàn) để đếm, người đã chạm hiện số thứ tự, chạm lại để bỏ. Hành lý, áo treo, túi không phải người;
- chỉnh ô Số người vượt bằng − và +, không vượt thì 0. Số chỗ hành khách ghi ở đầu thẻ xe (không kể lái xe);
- từ màn 3, thẻ Giấy tờ: chạm dòng sai trên lệnh vận chuyển, phù hiệu, hoặc nút "không có"; từ màn 4, thẻ Giám sát: chạm đoạn chạy của lần lái liên tục quá giờ, hoặc dòng tổng thời gian lái;
- đóng dấu Cho đi hoặc Lập biên bản (khóa khi chưa báo vượt, chưa chạm chỗ sai). Lập biên bản mà có từ hai lỗi thì kéo lỗi vào ô thứ tự (hoặc chạm lỗi rồi chạm ô), rồi "Nộp biên bản".

Để thấy từng tình huống: đúng bằng số chỗ là không vượt (XK-04); hành lý ở lối đi dễ đếm nhầm (XK-06); phù hiệu hết hạn đúng ngày kiểm tra vẫn còn giá trị (XK-11); hai lỗi cùng mức phạt, thứ tự nào cũng đúng (XK-12); lái liên tục đúng 4 giờ không vượt (XK-14); dừng 10 phút không ngắt lái liên tục (XK-17); ba lỗi chồng nhau (XK-18). Muốn chơi màn sau ngay, dùng tài khoản đã qua màn trước.

Lưu ý khi giới thiệu:
- **Căn cứ chưa có trong kho:** kho văn bản chưa có văn bản về chở quá số người, lệnh vận chuyển, phù hiệu, thiết bị giám sát hành trình, thời gian lái xe. Căn cứ của luật ghi `vn:chua-co-trong-kho`. Danh sách cần kiểm ở docs/GAME_DESIGN.md §5.13.
- **Chưa có luật cách tính trẻ em** (quy tắc dễ sai, không tự đặt): XK-07, XK-08, XK-20 không vào lượt cho tới khi đơn vị chuyên môn soạn và duyệt luật này.
- Tốc độ lớn nhất trên màn giám sát chỉ để đọc, chạm không được (chưa có căn cứ dùng làm lỗi).
- Giảm hiệu ứng: đổi thẻ không có hiệu ứng, số thứ tự hiện tĩnh, dấu không đập.
- Xe soạn theo mẫu (biểu mẫu lấy số liệu từ một nội dung đã có; hoặc bấm "Sửa dạng mã" để dán JSON) ở `/quan-tri/noi-dung-tro-choi/moi`, chọn trò "Lên xe khách" (định dạng như `data/tro-choi/xe-khach.json`, `answer` là `{ "loi": [...] }`). Chưa có trình soạn riêng; xe mà luật đã duyệt cho kết quả khác `loi` không vào lượt.

### 7k. Chơi thử Dựng chốt an toàn ban đêm

`bun run demo` chuẩn bị sẵn (bước 12 của `scripts/demo-tro-choi.ts`): nạp 3 bộ tiêu chí từ `data/tro-choi/tieu-chi-chot.json` và 10 đoạn đường "[Demo]" từ `data/tro-choi/chot-dem.json` (CD-01, CD-02 màn 1; CD-03, CD-04 màn 2; CD-05, CD-06 màn 3; CD-07, CD-08 màn 4; CD-09, CD-10 màn 5), **duyệt tự động** (người duyệt `demo-tu-dong`) và bật trò. **Mọi ngưỡng chấm là số minh họa, chưa có căn cứ** (chưa tra được kho văn bản; câu D21).

Đăng nhập cán bộ, mở `/tro-choi`, chạm biểu tượng Dựng chốt an toàn ban đêm, trong ngăn chi tiết bấm "Màn 1":
- đoạn đường ban đêm nhìn từ trên xuống, xe chạy từ dưới lên, chốt là vạch cam. Chạm một vật trong túi đồ (hoặc kéo vật vào đường), rồi chạm ô trên đường (ô 10 m, bốn cột: lề trái, làn trái, làn phải, lề phải). Chỉnh từng mét bằng −1, +1, −10, +10 (hoặc phím mũi tên), đổi cột, "Xoay" biển về phía xe tới, "Gỡ"; "Xong" để quay về túi đồ;
- "Chạy thử" (2 lần): 60 giây mô phỏng, tua nhanh 4 lần. Kết quả: xe phanh gấp, xe vào vùng nguy hiểm quanh chiến sĩ, hàng chờ dài nhất, biển quá gần hoặc bị khuất. Hết lượt chạy thử vẫn sửa được; "Nộp bố trí" thì máy chủ chấm bố trí lúc nộp theo sáu tiêu chí.

Bố trí đủ 100 điểm ở CD-01 (chốt mét 160, làn phải): biển ở mét 60 và 110, lề phải; 6 cọc làn phải mét 130, 135 … 155; đèn lề phải mét 128; hai chiến sĩ làn phải mét 162, 166. Để thấy lỗi: bỏ biển và đèn (xe phanh gấp), đặt một chiến sĩ ở làn trái (xe vào vùng nguy hiểm), đặt biển trong khúc cua ở CD-05 (biển bị khuất), đặt cọc chặn cả hai làn (hàng chờ dài).

Lưu ý khi giới thiệu:
- **Căn cứ chưa tra:** ngày 29/9/2026 công cụ tra kho văn bản không kết nối được; QCVN 41:2024/BGTVT chưa có trong kho (theo trò 3). Vị trí đứng của chiến sĩ theo "tài liệu nghiệp vụ do đơn vị cung cấp" (chưa có). Màn kết quả ghi rõ nguồn từng tiêu chí.
- Tầm nhìn ban đêm, bán kính vùng nguy hiểm (1,5 m), tốc độ giảm khi thấy cảnh báo là thông số mô phỏng, danh sách cần kiểm ở docs/GAME_DESIGN.md §5.15.
- Giảm hiệu ứng: chạy thử tính xong ngay, xem ảnh tĩnh từng mốc 10 giây bằng "Lùi 10 giây", "Tới 10 giây"; đèn cảnh báo sáng tĩnh. Chấm y hệt.
- Chưa có trình soạn riêng: đoạn đường và bộ tiêu chí soạn theo mẫu (biểu mẫu lấy số liệu từ một nội dung đã có; hoặc bấm "Sửa dạng mã" để dán JSON) ở `/quan-tri/noi-dung-tro-choi/moi`, chọn trò "Dựng chốt an toàn ban đêm" (`payload.kieu` là `doan_duong` hoặc `tieu_chi_chot`). Đoạn đường chỉ vào lượt khi bộ tiêu chí có mã `ma_tieu_chi` đã duyệt.

### 7l. Chơi thử Soi xe cải tạo

`bun run demo` chuẩn bị sẵn (bước 13 của `scripts/demo-tro-choi.ts`): duyệt 4 dòng mức phạt `oto-cai-tao-*` trong `data/tra-cuu/muc-phat.json`, nạp 7 biến thể từ `data/tro-choi/bien-the-cai-tao.json` và 16 xe "[Demo]" từ `data/tro-choi/xe-cai-tao.json` (SX-01 đến SX-05 màn 1, SX-06 đến SX-08 màn 2, SX-09 đến SX-11 màn 3, SX-12 đến SX-14 màn 4, SX-15, SX-16 màn 5), **duyệt tự động** (người duyệt `demo-tu-dong`) và bật trò. **Số tiền là số minh họa; căn cứ của biến thể chưa tra được kho.**

Đăng nhập cán bộ, mở `/tro-choi`, chạm biểu tượng Soi xe cải tạo, trong ngăn chi tiết bấm "Màn 1". Với mỗi xe:
- so hình nhìn nghiêng, nhìn sau với giấy chứng nhận kiểm định (kích thước bao, thùng, cỡ lốp, số chỗ, màu sơn, đèn);
- kéo khung hoặc vẽ vòng quanh chỗ khác giấy; chạm nhẹ để đặt khung nhỏ; hoặc "Thêm khung" rồi dời, đổi cỡ bằng nút hay phím mũi tên (Shift: đổi cỡ). Khung đang chọn: chạm dòng giấy để nối. Khung trên 25% hình bị loại;
- "Phóng to 2×", "Thước đo" (kéo hai đầu thước, đọc mm);
- đóng dấu Đạt hoặc Không đạt là nộp. Màn kết quả tô vùng đúng màu xanh, khung nhầm màu đỏ, có biên bản cho xe không đạt.

Để thấy từng tình huống: đổi màu sơn (SX-01), đèn nóc (SX-02), xe đạt (SX-06), lốp to (SX-09), ống xả độ nối với dòng kích thước bao (SX-10), thùng cơi cao thấy bằng mắt (SX-12), thêm ghế nhìn qua cửa sổ cuối (SX-13), thùng cơi 150 mm phải đo bằng thước (SX-15), ba chỗ sai có thùng dài thêm (SX-16).

Lưu ý khi giới thiệu:
- **Căn cứ chưa tra:** ngày 29/9/2026 máy chủ tra cứu văn bản mất kết nối; danh mục biến thể ghi căn cứ `vn:chua-co-trong-kho`. Danh sách cần đơn vị chuyên môn kiểm ở docs/GAME_DESIGN.md §5.14.
- Màu sơn chấm bằng khung nằm trong phần sơn (không cần khoanh cả xe); các chỗ khác chấm IoU ≥ 0,5.
- Giảm hiệu ứng: xe hiện dần tại chỗ, dấu không đập; nét khoanh hiện ngay. Chấm y hệt.
- Chưa có trình soạn riêng: biến thể và xe soạn theo mẫu (biểu mẫu lấy số liệu từ một nội dung đã có; hoặc bấm "Sửa dạng mã" để dán JSON) ở `/quan-tri/noi-dung-tro-choi/moi`, chọn trò "Soi xe cải tạo" (`payload.kieu` là `bien_the` hoặc `xe`, định dạng như hai tệp mẫu). Xe dùng biến thể chưa duyệt không vào lượt.

### 7m. Xem thử Nhóm học cùng

Không cần chuẩn bị thêm: `bun run demo` áp migration `0056_nhom_hoc_cung.sql`. Dùng hai trình duyệt (hoặc một cửa sổ thường, một cửa sổ ẩn danh) để thấy hai người cùng lúc.

1. Đăng nhập `canbo.d1.01`, mở **Học → Nhóm học cùng** (hoặc ngăn "Thêm" trên điện thoại). Bấm "Tạo nhóm", đặt tên, bấm "Tạo nhóm". Hộp thoại hiện mã mời và liên kết mời; bấm "Sao chép liên kết mời".
2. Ở cửa sổ thứ hai, mở liên kết mời khi chưa đăng nhập: trang chuyển sang đăng nhập. Đăng nhập `canbo.d2.01` (đội khác vẫn tham gia được), trang quay lại, nêu rõ thành viên khác thấy họ tên và phần trăm, không thấy điểm. Bấm "Tham gia nhóm".
3. Ở `canbo.d1.01`, mở nhóm, bấm "Chia sẻ vào nhóm": chọn "Bài học", tìm một bài, bấm "Chia sẻ bài học". Mở lại, chọn "Đề ôn tập", chọn chủ đề, số câu 5, đặt tên đề, bấm "Chia sẻ đề ôn tập".
4. Ở `canbo.d2.01`, tải lại nhóm, bấm "Học bài" rồi "Hoàn thành bài" ở cuối bài. Quay lại nhóm, bấm "Làm đề", làm hết 5 câu, bấm "Xem kết quả", rồi "Về nhóm".
5. Ở `canbo.d1.01`, tải lại: phần trăm chung của `canbo.d2.01` là 100 (hai mục đều xong), trung bình nhóm 50. Bấm "Cổ vũ" ở dòng của người đó; bên kia tải lại thấy 1 lượt cổ vũ. Bấm lại thì bỏ lượt.
6. Chạm vào họ tên một thành viên để xem phần trăm từng mục. Trưởng nhóm thấy thêm "Chuyển quyền trưởng nhóm", "Mời ra khỏi nhóm". Mục "Tùy chọn" của từng bài cho chuyển lên, chuyển xuống, đặt hạn gợi ý, gỡ khỏi nhóm.
7. Mở một bài giảng ở `/hoc/...` khi đã có nhóm: nút "Chia sẻ vào nhóm" dưới tên bài chia sẻ bài đó vào một hoặc nhiều nhóm.

Lưu ý khi giới thiệu:
- Thành viên chỉ thấy họ tên, phần trăm, số lượt cổ vũ của nhau; không thấy điểm. Cổ vũ không cộng điểm kinh nghiệm. Làm lại cùng một đề ôn tập không cộng thêm điểm kinh nghiệm.
- Trang bài học chưa gửi vị trí khối đang đọc, nên phần trăm một bài học là 0 hoặc 100 (câu N14).
- Thông báo khi được cổ vũ hoặc có bài mới **cần khóa VAPID và worker**; bản demo không chạy worker nên không có thông báo. Công tắc nằm trong khối "Nhắc học" ở trang Tôi.
- Trang quản lý nhóm và báo cáo tiến độ học cho cán bộ quản lý: mục 7n.

### 7n. Xem thử trang quản lý nhóm

`bun run demo` không gieo nhóm mẫu. Tạo nhóm theo mục 7m trước, rồi:

1. Đăng nhập `quanly.doi1`, mở **Quản trị → Nhóm học cùng**: quản lý chỉ thấy tên và tiến độ của thành viên thuộc đơn vị mình; thành viên đội khác tính vào "ngoài phạm vi".
2. Mở **Báo cáo → Tiến độ học**: mỗi cán bộ một dòng, lọc được theo nhóm học cùng; bấm "Tải Excel", "Tải PDF".
3. Đăng nhập `quanly.phong`: thấy mọi nhóm có người của phòng PC08.

Lưu ý khi giới thiệu:
- Lưu trữ là thật và không mở lại được.
- Quản lý chỉ xem và lưu trữ nhóm; không sửa nội dung, không giao bài qua nhóm, không cổ vũ từ trang quản trị (câu N11).

### 7o. Chơi thử Truy vết xe bỏ trốn

`bun run demo` chuẩn bị sẵn (bước 14 của `scripts/demo-tro-choi.ts`): nạp 8 vụ "[Demo]" từ `data/tro-choi/truy-vet.json` (tv-01, tv-02 màn 1; tv-03, tv-04 màn 2; tv-05, tv-06 màn 3; tv-07 màn 4; tv-08 màn 5), **duyệt tự động** (người duyệt `demo-tu-dong`) và bật trò. Bản đồ, tên phố, biển số là hư cấu; lộ trình, xe mồi, xe nền sinh từ seed. **Căn cứ chưa có trong kho văn bản** (tra ngày 30/9/2026).

Đăng nhập cán bộ, mở `/tro-choi`, chạm biểu tượng Truy vết xe bỏ trốn, trong ngăn chi tiết bấm "Màn 1":
- đọc tin báo (loại xe, màu, vài ký tự biển số, hướng chạy); "Nghe tin báo" đọc bằng giọng có sẵn khi máy chủ có dịch vụ giọng nói (bản demo thường không có, nút ẩn);
- chạm một camera trên bản đồ (hoặc chọn trong danh sách "Chọn camera"): trò báo xe tới đó sớm nhất lúc nào, có phải chờ không; bấm "Xem camera" hoặc "Chờ … giây rồi xem";
- "Phát" đoạn cảnh 10 giây, chạm vào xe (hoặc tạm dừng rồi chọn "Xe 1", "Xe 2"… bên dưới) để xem loại, màu, biển số; xe đang chọn được khóa khi mở camera tiếp theo. Xem xe rẽ về đâu để chọn camera kế tiếp;
- "Đặt điểm chặn trên bản đồ": chạm ô đường phía trước xe (hoặc dời bằng nút Lên, Xuống, Trái, Phải), "Chốt điểm chặn". Màn kết quả vẽ đường xe chạy thật, camera đã mở, điểm chặn.

Để thấy lỗi: mở một camera ở hướng khác (đồng hồ nhảy thêm 30 giây, không thấy xe); ở màn 2 trở lên khóa xe cùng màu khác loại hoặc khác biển (khóa nhầm −3); đặt điểm chặn ngay sau camera cuối khi đồng hồ đã muộn (xe tới sớm hơn 60 giây: chặn sai).

Lưu ý khi giới thiệu:
- Đồng hồ là giờ trong trò, không phải giờ thật; mỗi lần xem tốn 15 giây, camera sai hướng thêm 30 giây. Mọi con số là đề xuất (GAME_DESIGN §5.17).
- Trò dựa trên quan sát và suy luận chung; cần đơn vị xác nhận không lộ phương pháp nghiệp vụ không được công bố.
- Giảm hiệu ứng: đoạn cảnh hiện khung tĩnh từng giây, có nút tới, lùi. Chấm y hệt.
- Chơi offline được (câu D24): gói tải về mang cả lộ trình; nút nghe tin báo ẩn khi không có mạng.
- Chưa có trình soạn riêng: vụ soạn theo mẫu (biểu mẫu lấy số liệu từ một nội dung đã có; hoặc bấm "Sửa dạng mã" để dán JSON) ở `/quan-tri/noi-dung-tro-choi/moi`, chọn trò "Truy vết xe bỏ trốn", định dạng như tệp mẫu. Vụ mà mọi biến thể không sinh được lộ trình (đủ camera, còn chỗ chặn) không vào lượt.

### 7p. Chơi thử Tái dựng hiện trường

`bun run demo` chuẩn bị sẵn (bước 15 của `scripts/demo-tro-choi.ts`): duyệt 3 dòng mức phạt "khoảng cách", "chuyển làn", "nhường đường" (**số tiền là số minh họa**; tốc độ và vượt đèn đỏ đã duyệt ở bước 2, 7), nạp 5 vụ "[Demo]" từ `data/tro-choi/tai-dung.json` (TD-01 màn 1 … TD-05 màn 5), **duyệt tự động** (người duyệt `demo-tu-dong`) và bật trò. **Mô phỏng minh họa để học cách đọc dấu vết, không phải phương pháp giám định**; căn cứ về xử lý tai nạn chờ khách hàng cung cấp (câu D10), kho văn bản chưa có văn bản nào về tai nạn (tra ngày 30/9/2026).

Đăng nhập cán bộ, mở `/tro-choi`, chạm biểu tượng Tái dựng hiện trường, trong ngăn chi tiết bấm "Màn 1":
- sơ đồ nhìn từ trên xuống, phía trên là hướng bắc. Viền đứt là vị trí cuối của xe; vệt liền là vết phanh, vệt đứt là vết trượt sau va chạm; chấm nhỏ là mảnh vỡ ở chỗ va chạm; màu đèn lúc xảy ra ghi ở đầu trang;
- tab "Dựng xe": chọn xe, chạm lên sơ đồ để đặt (tâm xe), hoặc kéo xe đã đặt; chỉnh từng mét bằng nút mũi tên (hoặc phím mũi tên), xoay 45° bằng ⟲ ⟳ (hoặc phím [ ]); chọn tốc độ (Chậm, Vừa, Nhanh, Rất nhanh) và hành động (Đi thẳng, Phanh gấp, Rẽ, Chuyển làn);
- "Mô phỏng" (20 lần): xe chạy bằng cùng bộ mô phỏng máy chủ dùng; kết quả màu xanh phủ lên dấu vết, bảng "So với dấu vết" ghi vị trí cuối lệch bao nhiêu mét, vết bánh dài bao nhiêu;
- tab "Kết luận": kéo thẻ lỗi vào xe (hoặc chạm thẻ rồi chạm xe), tối đa 3 thẻ; "Chốt kết luận" (cần đã mô phỏng ít nhất một lần). Màn kết quả cho xem dựng cảnh gốc và dựng cảnh của mình, nút "Phát lại".

Lời giải TD-01 (mặt đường ướt, biển 50 km/h): xe A tâm ở x 12 m, y 64 m, hướng bắc, Rất nhanh, Phanh gấp; thẻ "Chạy quá tốc độ" vào xe A. Chọn Nhanh thì xe dừng trước rào, không va chạm: vết phanh cho biết tốc độ. Điểm: khớp dấu vết 50, kết luận 40, số lần mô phỏng 10 (1–3 lần đủ, 4–6 lần nửa, không mô phỏng hoặc nhiều hơn 0).

Lưu ý khi giới thiệu:
- Hệ số phanh theo mặt đường, cách hai xe dính nhau, xoay 45° và trượt sau va chạm là thông số mô phỏng, danh sách cần kiểm ở docs/GAME_DESIGN.md §5.10. Lỗi đúng của từng vụ và tên thẻ lỗi do hệ thống soạn.
- Giảm hiệu ứng: mô phỏng tính xong ngay, hiện luôn vị trí cuối; không có nút "Phát lại". Chấm y hệt.
- Biên tập viên soạn vụ mới ở `/quan-tri/noi-dung-tro-choi/moi`, chọn trò "Tái dựng hiện trường": sơ đồ theo mẫu (đoạn thẳng, ngã tư), mỗi xe một dòng kèm dựng cảnh gốc; dấu vết tự tính và hiện ở ô xem trước; lỗi đúng bắt buộc có mã mức phạt; có nút "Chơi thử".

### Dịch vụ tắt trong bản demo

| Dịch vụ | Ảnh hưởng | Bật bằng |
|---|---|---|
| AI (Anthropic) | Hỏi đáp AI, sinh câu hỏi | `ANTHROPIC_API_KEY`, `LLM_PROVIDER=auto` |
| Vbee | Đọc câu hỏi, sách nói, giọng đọc | `VBEE_APP_ID`, `VBEE_ACCESS_TOKEN` |
| Web Push | Nhắc học, thông báo đề thi mới | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` |
| Redis | Worker nền: sách nói, nhắc học, sinh câu hỏi, chốt tuần mùa giải (API chốt bù khi có người xem) | `REDIS_URL` và chạy thêm worker |
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
