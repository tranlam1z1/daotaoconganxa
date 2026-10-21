# Sổ tay vận hành quydinhphapluat.vn

Tài liệu thao tác hằng ngày. Kế hoạch tổng thể ở [ke-hoach/11-van-hanh-devops.md](../ke-hoach/11-van-hanh-devops.md).

## 1. Kiểm tra sức khỏe hệ thống

```bash
bun run scripts/smoke.ts          # kiểm thử khói xuyên tầng
curl -s localhost:3001/health     # API
docker compose -f infra/docker-compose.prod.yml ps
```

Truy vấn sức khỏe dữ liệu:

```sql
-- Văn bản chưa có phiên bản nào (nạp lỗi)
SELECT urn FROM documents d
WHERE NOT EXISTS (SELECT 1 FROM document_versions v WHERE v.document_id = d.id);

-- Phiên bản không có nút nào (parse lỗi)
SELECT v.id, d.so_ky_hieu FROM document_versions v
JOIN documents d ON d.id = v.document_id
LEFT JOIN nodes n ON n.version_id = v.id
GROUP BY v.id, d.so_ky_hieu HAVING count(n.id) = 0;

-- payload lệnh sửa đổi sai kiểu (lỗi mã hóa JSON hai lần) — phải luôn bằng 0
SELECT count(*) FROM amendment_ops WHERE payload IS NOT NULL AND jsonb_typeof(payload) <> 'object';

-- Hàng đợi ùn tắc
SELECT queue, state, count(*) FROM jobs GROUP BY 1, 2 ORDER BY 3 DESC;

-- Việc chờ biên tập
SELECT kind, count(*) FROM review_queue WHERE state = 'open' GROUP BY 1;

-- Chi phí LLM hôm nay
SELECT step, sum(cost_usd)::numeric(10,2) AS usd, sum(tokens_in) AS vao, sum(tokens_out) AS ra
FROM pipeline_runs WHERE started_at > current_date GROUP BY 1 ORDER BY 2 DESC;
```

## 2. Nhịp công việc

| Tần suất | Việc | Lệnh / nơi làm |
|----------|------|----------------|
| Liên tục | Worker xử lý hàng đợi | `bun run worker` (hoặc container `worker`) |
| 2 lần/ngày | Cào Công báo | `bun run --cwd apps/workers-ts pipeline crawl congbao` |
| Hằng ngày | Cào vbpl.vn, cổng bộ | như trên, đổi adapter |
| Hằng ngày | Sao lưu | `scripts/backup.sh /backup` (cron 02:00) |
| Hằng ngày | Kiểm tra hàng đợi biên tập | Console `/quan-tri` |
| Hằng tuần | Quét lại trạng thái hiệu lực từ vbpl.vn | adapter `vbpl` chế độ refresh |
| Hằng tháng | **Thử khôi phục sao lưu** | `scripts/restore.sh <dump> <db-tạm>` |
| Hằng tháng | Chấm mẫu chất lượng trả lời | `evals/`, pháp chế chấm 50 câu |
| Khi đổi prompt/model | Chạy lại bộ đánh giá | `bun run evals/*.ts`, so với baseline |

## 3. Sự cố thường gặp

### 3.1 Adapter cào không lấy được văn bản mới
Dấu hiệu: một nguồn không có văn bản mới quá 3 ngày.
1. Kiểm tra HTTP thật: `curl -sI <url danh sách>` — nếu 403/429 thì bị chặn, giảm `CRAWLER_RPS`, kiểm tra User-Agent.
2. Nếu 200 nhưng không parse được: cấu trúc trang đã đổi. Chạy contract test của adapter, cập nhật selector, thêm HTML mẫu mới vào `apps/workers-ts/test-fixtures/`.
3. Trong lúc chờ sửa: nạp thủ công bằng `pipeline ingest-file`.

### 3.2 Hợp nhất báo xung đột
Xung đột nghĩa là lệnh sửa đổi không áp được (nút đích không tồn tại, thiếu nội dung mới…). **Không được bỏ qua.**
1. Xem chi tiết: `SELECT * FROM amendment_ops WHERE review_status = 'needs_legal'`.
2. Đối chiếu văn bản sửa đổi gốc với nút đích trong console biên tập.
3. Nguyên nhân hay gặp: văn bản đích parse sai số điều; văn bản sửa đổi trỏ tới bản đã được sửa trước đó; nội dung mới nằm trong ngoặc kép nhiều đoạn bị cắt.

### 3.3 Bản hợp nhất tự động lệch với văn bản hợp nhất chính thức
1. Chạy diff giữa `consolidated_auto` và `consolidated_official` cùng thời điểm.
2. Nếu bản tự động sai: sửa lệnh sửa đổi, sinh lại phiên bản.
3. Nếu bản chính thức có vẻ sai: **vẫn ưu tiên hiển thị bản chính thức**, ghi chú cảnh báo, báo cơ quan ban hành. Theo Pháp lệnh hợp nhất, khi có mâu thuẫn thì các văn bản được hợp nhất mới là căn cứ.

### 3.4 Chi phí LLM vượt ngân sách
1. Xem `pipeline_runs` theo `step` để biết bước nào tốn.
2. Hạ tuyến xử lý: chuyển văn bản có text-layer từ tuyến AI sang tuyến trích trực tiếp.
3. Bật Batch API cho backfill; kiểm tra tỷ lệ cache đọc (`cache_read_input_tokens` > 0).
4. Đặt hạn mức ngày và cho worker dừng khi chạm hạn mức.

### 3.5 Câu trả lời không có trích dẫn
API phải trả `insufficientBasis: true` chứ không được kết luận. Nếu thấy câu trả lời có kết luận mà không có căn cứ:
1. Đây là lỗi nghiêm trọng — tắt tính năng hỏi đáp công khai trước.
2. Kiểm tra hậu kiểm trong `apps/api` có bị bỏ qua không; kiểm tra `ask_logs` để tái hiện.

## 3.6 Dữ liệu test lẫn vào CSDL phát triển
Từ khi có `bunfig.toml`, `bun test` luôn chạy trên CSDL riêng `quydinhphapluat_test`
(tự tạo, tự migrate, tự nạp dữ liệu mẫu qua `packages/db/src/test-setup.ts`).
Nếu thấy CSDL phát triển có dữ liệu lạ (lệnh sửa đổi không thuộc văn bản nào đang theo dõi,
hàng đợi biên tập phình bất thường), nghĩa là có script chạy với `NODE_ENV` khác `test`.
Dọn và nạp lại:

```bash
bun -e 'import {sql} from "@qdpl/db"; await sql`TRUNCATE documents, amendment_ops, relations, taxonomy, agencies, jobs, review_queue, ask_logs, citations, source_records, pipeline_runs, audit_log RESTART IDENTITY CASCADE`; await sql.end();'
bun run packages/db/src/seed.ts
```

## 4. Quy trình phát hành

```bash
bun install --frozen-lockfile
bun run --filter '*' typecheck
bunx @biomejs/biome check .
bun test                               # chạy trên CSDL riêng quydinhphapluat_test
bun run packages/db/src/migrate.ts     # migration phải tương thích ngược
bun run scripts/smoke.ts
```

Nguyên tắc: migration chỉ thêm, không xóa cột trong cùng một lần phát hành; xóa ở lần sau khi đã chắc không còn mã nào dùng.

## 5. Xử lý dữ liệu nhạy cảm

- Bản gốc PDF/DOCX **không bao giờ xóa** — là căn cứ đối chiếu.
- Nhật ký câu hỏi (`ask_logs`) ẩn danh hóa sau 90 ngày:
  ```sql
  UPDATE ask_logs SET question = '[đã ẩn danh]' WHERE created_at < now() - interval '90 days' AND question <> '[đã ẩn danh]';
  ```
- Yêu cầu gỡ nội dung từ cơ quan chủ quản nguồn: đánh dấu `documents.status`, giữ bản gốc, ghi `audit_log`.

## 6. Liên hệ leo thang

| Mức | Tình huống | Người xử lý |
|-----|-----------|-------------|
| 1 | Lỗi hiển thị, chậm | Trực kỹ thuật |
| 2 | Sai nội dung văn bản, sai trạng thái hiệu lực | Biên tập viên + pháp chế |
| 3 | Bản hợp nhất sai lệch có thể gây hiểu sai pháp luật; hỏng dữ liệu | Trưởng nhóm pháp chế + trưởng nhóm kỹ thuật, tạm ẩn nội dung liên quan |
