# 04. Thu thập dữ liệu (crawler)

## 1. Mục tiêu và phạm vi
- Thu thập đầy đủ VBQPPL trung ương (ưu tiên) và địa phương, VBHN, đính chính, dự thảo (cảnh báo sớm), văn bản không QPPL phục vụ vận dụng (công văn hướng dẫn, TCVN/QCVN, án lệ).
- Cập nhật hằng ngày với văn bản mới; định kỳ quét lại để phát hiện thay đổi thuộc tính/trạng thái.
- Lưu **bản gốc nguyên vẹn** (PDF có dấu từ Công báo là bản có giá trị đối chiếu cao nhất).

## 2. Nguồn và chiến lược từng nguồn

| Nguồn | Chiến lược | Tần suất | Ghi chú |
|-------|-----------|----------|---------|
| congbao.chinhphu.vn | Duyệt danh sách theo loại (`/van-ban-dang-cong-bao/{loai}-l{n}.htm`), phân trang; trang chi tiết `/van-ban/{slug}-{id}.htm`; tải PDF + DOCX | 2 lần/ngày | Trường: loại, ký hiệu, cơ quan, ngày ban hành, trích yếu, người ký, ngày hiệu lực, số/ngày Công báo. Xử lý `?format=pdf` |
| vbpl.vn (bản mới 2026) | **Bắt buộc dùng trình duyệt thật** (Puppeteer + Chromium) — xem §3.1 dưới. Lấy thuộc tính từ khối JSON-LD `schema.org/Legislation` do máy chủ render; duyệt `sitemap.xml` để phát hiện văn bản mới | Hằng ngày + quét lại toàn bộ hàng tháng để bắt thay đổi trạng thái | Nguồn tốt nhất cho **trạng thái hiệu lực** và **lĩnh vực**. Lược đồ quan hệ hiện không lấy được (xem §3.1) |
| vanban.chinhphu.vn | `?pageid=27160&docid={n}`; quét docid tăng dần | Hằng ngày | Có file đính kèm |
| quochoi.vn / duthaoonline | Luật, nghị quyết; dự thảo | Hằng tuần | Dự thảo gắn `is_draft=true`, không vào chỉ mục áp dụng |
| Cổng bộ (mst, moj, mof, moc, mard…) | Adapter riêng từng bộ; mục "Văn bản pháp luật" và "VBHN"; RSS nếu có | Hằng ngày | Thông tư nhiều ở đây trước khi lên Công báo |
| phapdien.moj.gov.vn | Cây chủ đề/đề mục; điều đã pháp điển với ký hiệu | Hằng tháng | Taxonomy + kiểm chéo |
| Cổng 34 tỉnh | Bắt đầu với Thanh Hóa và các tỉnh trọng điểm; adapter theo mẫu cổng thông tin (đa số dùng cùng nền tảng) | Hằng tuần | Chủ yếu PDF scan |
| anle.toaan.gov.vn, tcvn.gov.vn | Án lệ, danh mục TCVN/QCVN | Hằng tháng | |

## 3.1 vbpl.vn: tường lửa ứng dụng và cách xử lý

**Kết quả điều tra thật ngày 06/9/2026.**

vbpl.vn nằm sau tường lửa ứng dụng có thử thách JavaScript. Mọi yêu cầu HTTP thông thường
đều nhận **403** kèm trang "Sorry, you have been blocked" — kể cả khi đặt User-Agent trình
duyệt và đầy đủ header, và kể cả với `/robots.txt` lẫn `/sitemap.xml`. Hệ quả đáng chú ý:
**không đọc được chính sách robots của nguồn này qua HTTP thường**, nên không thể lấy đó làm
căn cứ để quyết định.

Cách xử lý đã kiểm chứng chạy được:

1. Mở Chromium thật bằng Puppeteer (`apps/workers-ts/src/crawler/browser.ts`), tắt cờ
   `AutomationControlled`, đặt ngôn ngữ `vi-VN` và múi giờ `Asia/Ho_Chi_Minh`.
2. Mở trang chủ một lần để trình duyệt chạy thử thách, lấy cookie (`FECAS`, `FECWS`).
3. Tái sử dụng cookie đó cho mọi yêu cầu sau — có thể dùng lại bằng HTTP thường, không cần
   mở trình duyệt cho từng trang.
4. Giữ nhịp tối thiểu 2 giây một yêu cầu (`VBPL_MIN_INTERVAL_MS`).

**Cơ sở để làm việc này**: văn bản quy phạm pháp luật không thuộc phạm vi bảo hộ quyền tác giả
(Điều 15 Luật Sở hữu trí tuệ); Nghị định 52/2015/NĐ-CP quy định tổ chức, cá nhân được khai thác,
sử dụng cơ sở dữ liệu quốc gia về pháp luật. Hệ thống chỉ đọc nội dung công khai mà người dùng
bình thường xem được, ở nhịp chậm hơn người dùng thật.

**Lấy được**: số ký hiệu, loại văn bản, tên đầy đủ, cơ quan ban hành, ngày ban hành, trạng thái
hiệu lực, lĩnh vực; danh sách văn bản mới; toàn bộ URL văn bản qua `sitemap.xml`.

**Chưa lấy được — lược đồ 12 nhóm quan hệ.** Lược đồ nằm trong tab do React dựng sau khi hydrate.
Ở môi trường máy chủ, hydrate thất bại (React error #329 — Suspense không hoàn tất) nên tab không
dựng. Ba hướng xử lý, theo thứ tự ưu tiên:

1. **Tự suy ra quan hệ từ chính văn bản** (đang làm): `pipeline/relations.ts` trích `can_cu` và
   `dan_chieu` từ nội dung; `pipeline/extract-ops.ts` trích `sua_doi`, `bai_bo`, `thay_the` từ
   lệnh sửa đổi. Cách này **kiểm chứng được** vì suy ra từ câu chữ của văn bản, tốt hơn việc chép
   lại quan hệ của bên thứ ba.
2. **Liên hệ Cục Công nghệ thông tin, Bộ Tư pháp** xin kênh dữ liệu chính thức. Đây là hướng bền
   vững nhất và phù hợp với định hướng "phát triển hệ sinh thái kết nối và chia sẻ dữ liệu pháp lý"
   mà chính CSDL quốc gia công bố.
3. Theo dõi khi vbpl.vn sửa lỗi hydrate hoặc chuyển sang render sẵn phía máy chủ.

## 3. Thiết kế crawler

```
workers-ts/crawler/
├── adapters/          # mỗi nguồn một adapter: discover() → listItems(); fetchItem(id) → SourceRecord
├── scheduler.ts       # pg-boss cron: enqueue discover jobs
├── fetcher.ts         # HTTP client: retry, backoff, rate limit per host, ETag/If-Modified-Since, proxy tùy chọn
├── browser.ts         # Playwright pool cho trang JS (vbpl.vn)
├── normalize.ts       # chuẩn hóa số ký hiệu, ngày, tên cơ quan, loại văn bản
├── dedupe.ts          # hash file, so khớp số ký hiệu + cơ quan + ngày
└── store.ts           # ghi S3 + source_records
```

Quy tắc:
- **Lịch sự**: tôn trọng `robots.txt` khi đọc được; ≤ 1 request/giây/host (vbpl.vn: 1 request/2 giây); User-Agent có thông tin liên hệ ở những nguồn không chặn; chạy giờ thấp điểm cho quét lại toàn bộ.
- **Trình duyệt thật chỉ dùng khi cần**: chỉ với nguồn chặn client không phải trình duyệt, và chỉ để đọc nội dung công khai. Không dùng để vượt qua đăng nhập, giới hạn trả phí hay bất kỳ rào chắn truy cập nào.
- **Idempotent**: mỗi `source_record` khóa bởi `(source, source_id)`; tải lại chỉ khi ETag/Last-Modified/hash đổi.
- **Phân biệt bản gốc**: cùng một văn bản có thể có ở nhiều nguồn; giữ tất cả `source_records`, chọn `primary_source` theo thứ tự Công báo PDF > vbpl.vn > cổng bộ > khác.
- **Chuẩn hóa số ký hiệu**: regex `^(\d+)\/(\d{4})\/([A-ZĐ\-]+)$` và các biến thể ("Số: 45/2026/NĐ-CP", "45/2026/NÐ-CP" với chữ Ð Latin), chuẩn hóa Unicode NFC, chữ Đ.
- **Chuẩn hóa cơ quan**: bảng alias, xử lý sáp nhập (2025: Bộ TT&TT nhập vào Bộ KH&CN; Bộ KH&ĐT nhập vào Bộ Tài chính; …) với khoảng thời gian hiệu lực của tên.
- **Phát hiện thay đổi trạng thái**: so sánh snapshot thuộc tính vbpl.vn theo ngày; sinh sự kiện `status_changed` → hàng đợi biên tập.

## 4. Đầu ra của crawler

`source_records` + file S3 theo layout:
```
raw/{source}/{yyyy}/{doc_type}/{so_ky_hieu_slug}/{hash}.{pdf|docx|html}
raw/{source}/.../metadata.json        # thuộc tính thô đã chuẩn hóa
```

Sau đó job `ingest` tạo/cập nhật `documents` và kích hoạt `convert` (05).

## 5. Nạp lịch sử (backfill)

Thứ tự ưu tiên nạp:
1. Nhóm "hạ tầng pháp lý" (01 §1): Luật BHVBQPPL và các văn bản hướng dẫn, hợp nhất, pháp điển.
2. Hiến pháp 2013 (và sửa đổi 2025), toàn bộ bộ luật/luật còn hiệu lực (~250), nghị định còn hiệu lực (~1.500), thông tư còn hiệu lực (~6.000). Số liệu ước tính, xác nhận qua vbpl.vn.
3. VBHN chính thức của tất cả văn bản trên.
4. Văn bản hết hiệu lực nhưng vẫn cần cho tra cứu lịch sử (từ 2005 trở lại).
5. Chuyên đề ưu tiên (09): toàn bộ văn bản về đầu tư công, đấu thầu, ngân sách, CNTT/chuyển đổi số, KH&CN.
6. Địa phương: Thanh Hóa trước, rồi mở rộng.

Ước lượng khối lượng: ~60.000 văn bản TW, ~3–5 triệu trang; địa phương gấp 2–3 lần. Kế hoạch tính chi phí ở 11.

## 6. Pháp lý và đạo đức
- VBQPPL không được bảo hộ quyền tác giả (Điều 15 Luật SHTT); CSDL quốc gia cho phép tổ chức, cá nhân khai thác. Vẫn ghi rõ nguồn trên từng văn bản.
- Không cào nội dung biên tập của bên thứ ba (bình luận, tóm tắt, bản dịch có bản quyền).
- Không thu thập dữ liệu cá nhân ngoài phạm vi (ví dụ quyết định cá biệt có thông tin cá nhân → mặc định không nạp).
- Có cơ chế gỡ theo yêu cầu cơ quan chủ quản nguồn.

## 7. Giám sát
- Dashboard: số văn bản mới/ngày theo nguồn, tỷ lệ lỗi tải, độ trễ từ ngày đăng Công báo tới khi lên hệ thống (mục tiêu ≤ 24 giờ), số văn bản đang chờ chuyển đổi.
- Cảnh báo khi một nguồn không có văn bản mới quá 3 ngày (có thể đổi cấu trúc trang).
- Test hợp đồng (contract test) cho adapter: chạy hằng ngày với 3 URL mẫu.
