# LENH.md — Hướng dẫn chạy thử hệ thống

Toàn bộ lệnh chạy từ thư mục gốc của repo. Điều kiện: **Bun ≥ 1.3** và **Docker**. Không cần Python.

## 0. Bảng cổng

Hệ thống có hai **hồ sơ cổng** chạy song song được, không giẫm chân nhau:

| Dịch vụ | Hồ sơ `dev` (của bạn) | Hồ sơ `thu` (trợ lý chạy thử) |
|---------|----------------------|-------------------------------|
| Web | **3030** | **3060** |
| API | 3031 | 3061 |
| MCP | 3032 | 3062 |

Hạ tầng đều nằm trên DigitalOcean: Postgres (cụm `db-postgresql-sgp1-06837`, CSDL `qdpl`,
đặt trong `DATABASE_URL`) và Valkey/Redis (cụm `db-valkey-sgp1-39341`, đặt trong `REDIS_URL`).
Postgres cục bộ ở cổng `5436` chỉ còn phục vụ `bun test`; container Redis `6380` là phương án
dự phòng khi chạy ngoại tuyến. Bản gốc PDF/DOCX, ảnh trang và bản sao Markdown nằm trên
**Cloudflare R2** (bucket đặt trong `R2_BUCKET`); thiếu khóa R2 thì hệ thống lùi về thư mục
`STORAGE_DIR`.

> **Cổng bị chiếm sẽ tự được giải phóng.** Trước khi mở cổng, hệ thống kiểm tra tiến trình
> đang giữ cổng đó. Nếu là **tiến trình khác** thì gửi `SIGTERM`, chờ 5 giây, còn sống thì
> `SIGKILL`, rồi mở lại. Nếu chính tiến trình hiện tại đang giữ thì không làm gì.
> Ở `NODE_ENV=production` thì **không** tự kết thúc tiến trình (báo lỗi để bạn tự quyết định);
> đặt `QDPL_KILL_PORT=0` để tắt hẳn hành vi này.

## 1. Chuẩn bị lần đầu

```bash
bun install                 # cài phụ thuộc
cp .env.example .env        # điền DATABASE_URL, REDIS_URL, ANTHROPIC_API_KEY và bộ khóa R2_*
bun run infra:up            # bật Redis + Postgres cục bộ (Postgres chỉ dùng để chạy test)
bun run db:migrate          # tạo lược đồ trên CSDL trong DATABASE_URL (DigitalOcean)
bun run db:seed             # nạp dữ liệu mẫu để chạy thử ngay
bun run corpus:load         # nạp khung cấu trúc kho văn bản
```

Kiểm tra nhanh mọi thứ đã sẵn sàng:

```bash
bun run monitor
```

## 2. Chạy dịch vụ

```bash
bun run dev            # web (3030) + api (3031) — dùng hằng ngày
bun run dev:web        # chỉ web
bun run dev:api        # chỉ api
bun run dev:mcp        # chỉ MCP server (HTTP, cổng 3032)
bun run dev:all        # cả ba
```

Mở trình duyệt: <http://127.0.0.1:3030>

Dừng bằng `Ctrl+C` — script sẽ dừng cả nhóm dịch vụ, không để lại tiến trình mồ côi.

### Ứng dụng `qdpl` trên DigitalOcean App Platform

> **Đang chạy từ 14/9/2026: <https://qdpl-wyo3f.ondigitalocean.app>**

| Hạng mục | Giá trị |
|---|---|
| Tên app / ID | `qdpl` / `75b42663-d895-4f2d-9768-94fc226315c2` |
| Tài khoản | doctl context `tkx`, nhóm *Team SaaS DO Cloud* (cùng nhóm với cụm Postgres và Valkey) |
| Vùng | Singapore (`sgp`) |
| Thành phần | MỘT service `web`, gói `apps-s-1vcpu-0.5gb` — **$5/tháng**, 512 MiB |
| Mã nguồn | `KHCN-Thanh-Hoa/qdpl`, nhánh `main`, **tự triển khai mỗi lần push** |
| Đặc tả | [.do/app-gon.yaml](.do/app-gon.yaml) (giá trị bí mật để trống; bản thật nằm trên DO) |

**Cách chạy.** web và api chung một container:
`HOST=127.0.0.1 API_PORT=3031 bun run start:api & exec bun run start:web`.
api chỉ nghe loopback nên không có đường vào từ Internet; web nghe cổng 8080 do nền tảng đặt
và gọi api qua `API_URL=http://127.0.0.1:3031`. Đo thực tế: api ~100 MB + web ~125 MB.
`PG_POOL_MAX=3` — app chiếm tối đa 3 kết nối trên cụm Postgres dùng chung.

**Chỉ những gì đã push lên `main` mới lên app.** Thay đổi chưa commit ở máy vận hành không có trên đó.

**App này KHÔNG có:**
- **worker** — job `soan-bai`, `mascot-anh` do trang quản trị đẩy vào Redis sẽ **nằm chờ** tới khi
  máy vận hành bật worker cho các hàng đợi đó:
  `bun run pipeline bull worker --queues reconcile,soan-bai,mascot-anh`.
  Không thêm worker nghe `ingest, convert, sohoa, parse, …` lên DO: Redis là hàng đợi chung, worker
  nào nghe cũng nhận job nạp kho nặng (xem mục 3.7).
- **việc migrate trước khi triển khai** — lược đồ CSDL chạy từ máy vận hành
  (`bun run db:migrate`) **trước** khi push mã cần lược đồ mới.
- **MCP server** — vẫn chạy cục bộ (mục 7).
- `AUTH_BOOTSTRAP_ADMIN=0`: người đăng nhập đầu tiên trên app công khai không tự thành quản trị.

**Vấn đề đã biết — tìm kiếm làm nghẽn cả app.** Truy vấn `word_similarity(unaccent(heading || text_plain))`
ở `packages/search/src/index.ts` không dùng được chỉ mục trigram nên quét cả bảng `nodes`, mất
**hơn 40 giây** trên cụm dùng chung. Web bỏ chờ sau 10 giây (trang `/tim-kiem` báo 500) nhưng truy vấn
vẫn chạy và giữ hết pool 3 kết nối, kéo `/dao-tao` và cả health check `GET /` hết giờ theo. Khi app
đứng, hủy các truy vấn tìm kiếm treo:

```bash
psql "$DATABASE_URL" -c "select pg_cancel_backend(pid) from pg_stat_activity
  where datname='qdpl' and state='active' and query ilike '%word_similarity%'
  and now()-query_start > interval '10 seconds'"
```

Vận hành:

```bash
doctl auth switch --context tkx
APP=75b42663-d895-4f2d-9768-94fc226315c2
doctl apps get $APP --format Spec.Name,DefaultIngress,ActiveDeployment.ID
doctl apps list-deployments $APP                   # lịch sử triển khai
doctl apps logs $APP web --type run                # log chạy (--type build cho log build)
doctl apps create-deployment $APP                  # triển khai lại không cần push
# Sửa biến môi trường / cấu hình: tải đặc tả thật về NGOÀI kho mã, sửa, rồi đẩy lại.
# doctl cài qua snap không đọc được /tmp nên dùng stdin/stdout:
doctl apps spec get $APP > ~/qdpl-spec.yaml
doctl apps update $APP --spec - < ~/qdpl-spec.yaml
```

Còn phải làm:
- **Xóa app thừa `qdpl-demo`** (ID `25acb1d6-4478-4f5f-84da-e87858cc395d`, tạo nhầm tên, cùng cấu hình):
  bảng điều khiển → Apps → `qdpl-demo` → Settings → Destroy. Token doctl hiện tại không có quyền xóa
  (403). Để lâu thì tốn thêm $5/tháng và thêm một pool 3 kết nối trên cụm Postgres chỉ có 25 kết nối.
- Thêm `https://qdpl-wyo3f.ondigitalocean.app` vào **Authorized JavaScript origins** của OAuth Client
  Google, nếu không nút đăng nhập ở `/dang-nhap` bị Google từ chối.
- Gắn tên miền riêng khi đã chốt (Settings → Domains).
- Đổi sang cấu hình đầy đủ [.do/app.yaml](.do/app.yaml) (web + api + worker + migrate) bằng
  `doctl apps update` sẽ **thay** cấu hình một-thành-phần hiện tại — thống nhất trước khi làm.

### Cổng

```bash
bun run port:free                    # giải phóng cổng của hồ sơ dev
bun run port:free -- --profile thu   # giải phóng cổng của hồ sơ thử nghiệm
bun run port:free -- 3030 3031       # giải phóng cổng cụ thể
bun run port:free -- 3030 --xem      # CHỈ XEM ai đang giữ cổng, không kết thúc
```

## 3. Nạp kho văn bản

Đây là việc **chạy dài ngày**, dùng hàng đợi bền vững BullMQ trên Redis: job không mất khi
khởi động lại, tự thử lại khi lỗi mạng, giới hạn tốc độ để không gây tải cho máy chủ nhà nước,
và dừng/tiếp tục được.

### 3.1 Quy trình chuẩn

```bash
# Bước 1 — Bảo đảm hạ tầng và khung cấu trúc đã sẵn sàng
bun run infra:up
bun run corpus:load
bun run corpus:check          # xem kho hiện có gì so với khung

# Bước 2 — Bật worker (mở một cửa sổ terminal riêng, để chạy liên tục)
bun run pipeline bull worker

# Bước 3 — Khởi động một đợt nạp, theo nhóm ưu tiên
bun run pipeline bull frame --seed          # nạp khung vào CSDL (tương đương corpus:load)
bun run pipeline bull backfill --nhom ha_tang_phap_ly
bun run pipeline bull backfill --nhom chuyen_de
bun run pipeline bull backfill --nhom hien_phap
bun run pipeline bull backfill --nhom luat
bun run pipeline bull backfill --nhom nghi_dinh
bun run pipeline bull backfill --nhom thong_tu

# Chạy thử một đợt nhỏ trước: --per-page giới hạn số văn bản lấy về mỗi ô khung
bun run pipeline bull backfill --nhom ha_tang_phap_ly --per-page 3

# Bước 4 — Theo dõi (cửa sổ terminal khác)
bun run monitor:watch

# Bước 5 — Đối soát độ đầy đủ sau khi đợt chạy xong
bun run corpus:check
```

**Nạp theo nhóm, không nạp tất cả một lần.** Nhóm sau chỉ nên bắt đầu khi nhóm trước đã đạt
ngưỡng hoàn thành, để lỗi hệ thống lộ ra sớm trên tập nhỏ thay vì hỏng cả trăm nghìn văn bản.

### 3.1a Nạp theo LĨNH VỰC (ví dụ: giao thông đường bộ)

Công báo chỉ liệt kê theo **loại** văn bản, không tìm được theo lĩnh vực. Ô khung theo lĩnh vực
(`tu_khoa`, `loai_tru` trong `corpus_targets`) giải quyết việc này ở bước phát hiện: worker đọc
trọn danh mục của từng loại (chỉ tốn trang danh mục, ~10 mục/trang) rồi **chỉ tải** những mục có
tiêu đề khớp từ khóa. Nhóm `gtdb` (giao thông đường bộ, phục vụ đào tạo cảnh sát giao thông) có 8 ô
theo thứ bậc: luật → pháp lệnh → nghị định → nghị quyết → quyết định → thông tư → thông tư liên
tịch → văn bản hợp nhất. Từ khóa định nghĩa ở `apps/workers-ts/src/crawler/tu-khoa.ts`.

```bash
bun run pipeline bull frame --seed                       # khung có sẵn 8 ô gtdb-*
bun run pipeline bull worker --concurrency 1             # chạy CHẬM: mỗi hàng đợi một job, CSDL nhẹ tải
bun run pipeline bull backfill --nhom gtdb --ma gtdb-nghi-dinh --per-page 10 --no-wait
bun run corpus:check                                     # độ phủ ô gtdb-* đếm theo tiêu đề khớp từ khóa
```

Vì sao điều phối **từng ô** bằng `--ma` thay vì để `backfill --nhom gtdb` tự chạy hết các đợt:
văn bản luật trên Công báo chỉ có PDF, mục sẽ đứng ở trạng thái chờ số hóa (agent làm qua MCP), nên
đợt luật không bao giờ đạt ngưỡng 95% và bộ điều phối sẽ dừng thay vì sang đợt nghị định. Đẩy ô kế
tiếp khi `bull status` cho thấy hàng đợi `discover`/`fetch`/`ingest`/`convert` đã trống.
Danh mục thông tư có ~950 trang: quét hết mất khoảng 35 phút ở nhịp 1 trang/2 giây.

### 3.2 Khung cấu trúc kho

`content/khung-van-ban.json` mô tả kho **đáng lẽ phải có gì**: 33 ô, mỗi ô là một lát cắt
(loại văn bản × cơ quan × khoảng năm × trạng thái hiệu lực). Nhờ đó việc nạp trả lời được
câu hỏi *"còn thiếu gì"*, chứ không chỉ *"đã nạp bao nhiêu"*.

```bash
bun run corpus:load                                   # nạp/cập nhật khung vào CSDL
bun run corpus:check                                  # đối soát toàn bộ
bun run scripts/corpus.ts doi-soat thong_tu           # đối soát một nhóm
bun run scripts/corpus.ts ky-vong nghi-dinh-2024-2026 850   # đặt số lượng kỳ vọng cho một ô
```

### 3.3 Theo dõi và xử lý sự cố hàng đợi

```bash
bun run pipeline bull status              # số liệu mọi hàng đợi + tiến độ đợt nạp
bun run pipeline bull failures            # danh sách job hỏng kèm lý do
bun run pipeline bull retry               # thử lại toàn bộ job hỏng
bun run pipeline bull retry --queue fetch      # nhận cả "fetch", "qdpl-fetch", "qdpl:fetch"
bun run pipeline bull pause               # tạm dừng (khi cần hạ tải)
bun run pipeline bull resume
bun run pipeline bull drain               # xóa sạch hàng đợi — chỉ dùng khi phát triển
bun run pipeline bull worker --until-idle 5000   # chạy tới khi hết việc rồi tự thoát (dùng để chạy thử)
bun run pipeline bull frame               # xem khung cấu trúc kho
```

Ghi chú về hành vi đã kiểm chứng:
- **Thử lại có lùi thời gian**: job hỏng được thử lại 5 lần theo cấp số nhân 5s → 10s → 20s → 40s
  rồi mới vào `failed`; `ingest_items` ghi `trang_thai='loi'` kèm lý do.
- **Chạy lại không tạo trùng**: chạy đúng lệnh backfill lần thứ hai sẽ dùng lại đợt đang chạy,
  không đẩy thêm job nào. Thêm `--new` nếu muốn ép tạo đợt mới.
- **Tắt êm**: `SIGTERM` khiến worker ngừng nhận job mới và chờ job đang chạy xong; job dở dang
  quay lại hàng đợi, không mất.
- Nếu quên bật worker, `bull backfill` sẽ dừng sau `BACKFILL_STALL_MS` (mặc định 5 phút) và
  báo `dung_vi_khong_tien_trien`.

### 3.4 Cào thủ công một nguồn

```bash
bun run crawl congbao --type nghi-dinh --limit 5
bun run crawl vbpl --limit 3                # cần Chromium: bunx playwright install chromium
bun run crawl vanban-chinhphu --start-docid 216790 --limit 3
```

### 3.5 Nạp một file có sẵn

```bash
bun run pipeline ingest-file data/fixtures/nd-mau-goc.md \
  --so-ky-hieu "100/2026/NĐ-CP" --title "Quy định mẫu về quản lý hoạt động thử nghiệm" \
  --type-name "Nghị định" --issuer "CHÍNH PHỦ" --issued-date 20/01/2026 --effective-from 01/03/2026

bun run pipeline pipeline "vn:vbqppl:nd:100/2026/NĐ-CP" --auto-approve
```

### 3.6 Số hóa PDF (agent đọc trang qua MCP)

PDF không đi qua dịch vụ Python nữa. Worker `qdpl-sohoa` chỉ **dựng việc** (đọc lớp văn bản,
chọn tuyến, chia cụm trang, dựng bản nháp); phần đọc trang do chính trợ lý AI làm qua công cụ
MCP. Xem `ke-hoach/05-ocr-va-chuyen-doi-ai.md`.

**Khi nào cần đến số hóa.** Công báo trả cả DOCX lẫn PDF cho mỗi văn bản, nên đường ống chuyển
thẳng DOCX → Markdown trong TypeScript, không tốn token nào — đó là đường rẻ và chính xác hơn.
Số hóa bằng agent chỉ vào cuộc với nguồn **chỉ có PDF** (vbpl.vn, văn bản cũ, bản quét), hoặc khi
bạn chủ động tạo việc để đối chiếu với bản DOCX.

**Nạp một tệp PDF lẻ từ trang quản trị.** Biên tập viên mở `/quan-tri/van-ban/moi`, chọn tệp PDF:
API (`POST /v1/quan-tri/van-ban/tu-pdf`) cất tệp vào kho làm tệp gốc (`van-ban-goc/`) và, nếu PDF có
lớp chữ, đoán số ký hiệu, tên, cơ quan, ngày, người ký để điền biểu mẫu; bản quét thì người soạn
điền tay. Người soạn soát lại rồi lưu, ô Nội dung để trống: văn bản lưu kèm tệp gốc
(`documents.original_file_uri`) và trang đọc hiện tệp đó trong khung xem PDF. Trên điện thoại (không
hiện được PDF trong khung) trang đọc xếp ảnh từng trang; ảnh kết xuất ở lượt xem đầu rồi cất cạnh tệp
gốc (`van-ban-goc/<hash>.pdf.trang-<số>.jpg`).

**Bản chữ của văn bản nạp từ PDF.** Ở trang đọc, biên tập viên trở lên bấm **Đọc bằng AI**
(`POST /v1/quan-tri/van-ban/:urn/doc-tep-goc`); kết quả lưu thành nội dung gốc, mọi người đọc thấy
ngay. PDF có lớp chữ thì lấy chữ sẵn có, không gọi mô hình, xong tức thì; bảng và công thức chỉ còn
là chữ thường. Bản quét thì mô hình đọc từng cụm trang (cần `ANTHROPIC_API_KEY`, trần
`DOC_PDF_QUET_TRANG_TOI_DA` trang), chạy nền trong API vài phút và tốn chi phí; việc ghi ở
`authoring_jobs` bước `doc_tep_goc`, lỗi thì bấm lại để chạy tiếp. Bản chữ chưa có người soát: soát
ở trang sửa văn bản. Số hóa bằng agent ở dưới vẫn dùng được cho nguồn cần đối chiếu kỹ.

```bash
bun run pipeline so-hoa danh-sach                              # còn bao nhiêu việc, việc nào đang treo
bun run pipeline so-hoa danh-sach --trang-thai cho --limit 50
bun run pipeline so-hoa tao "vn:vbqppl:nd:315/2026/NĐ-CP"      # tạo việc cho BẢN PDF của một văn bản
bun run pipeline so-hoa tao "<urn>" --tep "raw/…/abc.pdf"      # chỉ định tệp cụ thể trong kho
bun run pipeline so-hoa dong-bo                                # đẩy nốt job parse nếu lúc chốt thiếu Redis
bun run pipeline so-hoa don-dep --yes                          # xóa thư mục làm việc của việc đã xong
bun run pipeline so-hoa ghep-phan [--yes]                      # văn bản đăng nhiều kỳ Công báo: tạo lại việc trên tệp PDF ghép
bun run pipeline so-hoa tach-anh <viec_id> [--cua-so N] [--dpi 150]   # dựng ảnh PNG từng trang để trợ lý đọc ảnh trực tiếp
```

**Số hóa bằng cách đọc ảnh trang.** Với bản quét (tuyến `pdf_anh`) hoặc khi muốn đối chiếu bản in
thay vì tin lớp văn bản, chạy `so-hoa tach-anh <viec_id>` để dựng ảnh từng trang vào
`data/work/<viec_id>/anh/trang-NNN.png`; trợ lý đọc từng ảnh bằng công cụ đọc tệp, chép thành
Markdown và nộp theo vòng `nhan_viec_so_hoa → lay_cua_so_trang → nop_cua_so`, rồi chốt bằng
`so-hoa hoan-tat <viec_id>`.

**Văn bản đăng nhiều kỳ Công báo.** Luật và nghị định dài được Công báo đăng thành 2–3 kỳ, mỗi kỳ một tệp
PDF (ví dụ Luật 36/2024/QH15: kỳ 977 + 978 và kỳ 979 + 980). Bước chuyển đổi tự ghép các phần theo số kỳ
thành `derived/{documentId}/so-hoa/goc-ghep.pdf` trước khi tạo việc số hóa (`pipeline/pdf-phan.ts`). Việc đã
tạo trước khi có bước này chỉ có phần đầu: chạy `so-hoa ghep-phan --yes` để tạo lại (các cụm đã nộp có cùng
khoảng trang được chép sang việc mới, việc cũ chuyển `bo_qua`).

`so-hoa tao` in ra số trang, tuyến (`pdf_text` khi PDF có lớp văn bản, `pdf_anh` khi là bản quét)
và số cụm trang. Ví dụ thật: Nghị định 315/2026/NĐ-CP — 26 trang, 26/26 trang có lớp văn bản,
chia 6 cụm, bản nháp ghi vào `derived/{documentId}/so-hoa/nhap.md` trên R2.

**Để trợ lý làm phần đọc trang**, MCP server phải chạy với vai trò **biên tập** và bật ghi dữ liệu
(`.mcp.json` trong repo đã đặt sẵn):

```json
"env": {
  "MCP_LOCAL_ROLE": "bien_tap",
  "QDPL_MCP_ALLOW_WRITE": "1"
}
```

Sau khi đổi `.mcp.json` hoặc sau khi cập nhật mã của MCP server, **phải khởi động lại phiên trợ lý**
(hoặc kết nối lại bằng `/mcp`) thì nhóm công cụ số hóa mới xuất hiện. Rồi trong phiên:

```
/so-hoa 315/2026/NĐ-CP        # lệnh tắt, xem .claude/commands/so-hoa.md
```

hoặc gọi mẫu nhắc việc `so-hoa-van-ban`, hoặc gọi thẳng chuỗi công cụ:
`nhan_viec_so_hoa` → `lay_cua_so_trang` → `nop_cua_so` (lặp cho từng cụm) → `hoan_tat_so_hoa`.

`hoan_tat_so_hoa` ghép các cụm, chạy bộ kiểm chứng (liên tục số điều, khoản/điểm, độ dài so với
lớp văn bản, bảng, công thức, khối chữ ký) và chấm điểm. Dưới 0,95 hoặc hỏng mục bắt buộc thì việc
chuyển sang `cho_duyet` và **không** đẩy bước `parse` — sửa lại đúng cụm sai rồi nộp lại.

### 3.7 Chống quá tải cụm CSDL dùng chung

Worker trên App Platform (`.do/app.yaml`) chỉ còn ba hàng đợi `reconcile, soan-bai, mascot-anh`. Toàn bộ
đường ống nạp kho chạy ở máy vận hành (có Chromium, 20 nhân). Hai lớp chống quá tải, đều là biến môi
trường hoặc cờ của `bull worker`:

| Cơ chế | Biến / cờ | Ý nghĩa |
|---|---|---|
| Concurrency từng hàng đợi | `BULL_CONCURRENCY=N`, `BULL_CONCURRENCY_SOHOA=1`, `--concurrency N` | Mặc định đã hạ: convert 1, sohoa 1, index 1, parse 2 |
| Chặn trên cả tiến trình | `BULL_MAX_ACTIVE=N`, `--max-active N` | Tối đa N job đang chạy dù có 13 hàng đợi (mặc định 2) |
| Tỷ lệ chiếm CPU | `BULL_CPU_DUTY=0.5`, `--cpu-duty 0.5` | Sau job dài d giây, chỗ chạy nghỉ d·(1/x − 1) giây |

```bash
# Máy vận hành, khi nạp kho: nặng nhưng vẫn chừa CPU cho việc khác
bun run pipeline bull worker --queues ingest,convert,sohoa,parse,extract-ops,consolidate,relations,index --max-active 2 --cpu-duty 0.6
```

| Tốc độ theo hàng đợi (áp cho mọi worker, nằm trong Redis) | `BULL_RATE_INDEX=1/20000`, `BULL_RATE_PARSE=0` (bỏ giới hạn) | Mặc định: parse 1 job/5 s, index 1 job/10 s, relations 1 job/3 s |
| Tạm không sinh embedding | `QDPL_EMBEDDINGS=0` | Bỏ qua bước ghi vector (chế độ `local` hiện chỉ là băm n-gram, không phải mô hình ngữ nghĩa); chạy lại `bun run index` giờ thấp điểm |

Bài học 08/9/2026 (khi `qdpl` chưa triển khai lên App Platform): worker ở máy vận hành chạy với
`--concurrency 1`, nhưng cờ này áp cho TỪNG hàng đợi nên vẫn có tới 13 job cùng lúc. Đợt nạp 755 văn bản
làm bảng `nodes` nhận 142 nghìn lượt chèn và 142 nghìn lượt sửa (mỗi nút được ghi hai lần), bảng
`embeddings` nhận 113 nghìn vector vào chỉ mục HNSW 433 MB. Cụm Postgres `db-s-1vcpu-1gb` dùng chung cho
23 CSDL lên 100% CPU, kéo theo các ứng dụng khác trên cùng cụm.

## 4. Giám sát

```bash
bun run monitor            # in một lần: dịch vụ, kho, hàng đợi, đợt nạp, độ phủ khung
bun run monitor:watch      # cập nhật mỗi 5 giây
bun run monitor -- --json  # xuất JSON để đưa vào hệ thống giám sát khác
bun run quality            # báo cáo chất lượng dữ liệu, thoát mã 1 nếu không đạt ngưỡng
bun run smoke              # kiểm thử khói xuyên tầng (cần api và web đang chạy)
```

## 5. Kiểm thử và chất lượng

```bash
bun test                   # 435 test, tự chạy trên CSDL riêng quydinhphapluat_test
bun run typecheck          # kiểm tra kiểu toàn bộ workspace
bun run lint               # kiểm tra định dạng và lint
bun run lint:fix
bun run eval               # bộ đánh giá: phân giải viện dẫn và parser cấu trúc
```

## 6. Biên tập và vận hành dữ liệu

```bash
bun run citations:check              # rà soát sức khỏe viện dẫn
bun run citations:check -- --enqueue # tạo việc trong hàng đợi biên tập
bun run index                        # sinh embedding cho toàn bộ (chạy sau khi nạp)
bun run scripts/check-point-in-time.ts   # kiểm chứng tra cứu theo thời điểm
bash scripts/backup.sh ./backups     # sao lưu CSDL + kho file
bash scripts/restore.sh backups/qdpl-<thời-điểm>.dump <DATABASE_URL_đích>
```

## 7. MCP server (kết nối trợ lý AI)

```bash
bun run mcp                # stdio, dùng cho client trên cùng máy (xem .mcp.json)
bun run dev:mcp            # HTTP có đăng nhập Google, cổng 3032
```

Chi tiết vai trò và bảo mật: [apps/mcp/README.md](apps/mcp/README.md).

## 8. Làm lại từ đầu

```bash
bun run db:reset           # xóa dữ liệu nghiệp vụ, giữ lược đồ, nạp lại khung
bun run db:seed            # nạp lại dữ liệu mẫu
```

## 9. Xử lý sự cố thường gặp

| Hiện tượng | Nguyên nhân và cách xử lý |
|---|---|
| `Cổng 3030 đang bận` mà không tự giải phóng | Tiến trình thuộc người dùng khác. Xem `bun run port:free -- 3030 --xem` rồi xử lý thủ công. |
| `Chưa đặt REDIS_URL` | Điền `REDIS_URL` vào `.env` (Valkey trên DigitalOcean). Chạy ngoại tuyến thì `bun run redis:up` rồi trỏ về `redis://127.0.0.1:6380`. |
| `Không kết nối được CSDL` | Kiểm tra `DATABASE_URL` trong `.env` (CSDL chính ở DigitalOcean) và mạng ra ngoài. Cần cả `sslmode=require`. |
| Test không chạy được vì thiếu CSDL | `bun run infra:up`, rồi `docker ps` xem container `qdpl-postgres` có khỏe không. Test dùng Postgres cục bộ, không dùng CSDL chính. |
| Job hỏng dồn nhiều | `bun run pipeline bull failures` xem lý do. Nếu do nguồn đổi cấu trúc thì sửa adapter rồi `bull retry`. |
| Cào bị chặn 403 ở vbpl.vn | Nguồn dùng tường lửa có thử thách JavaScript. Cần Chromium: `bunx playwright install chromium`. Xem `ke-hoach/04-thu-thap-du-lieu.md` §3.1. |
| Test hỏng hàng loạt sau khi sửa CSDL | Test chạy trên `quydinhphapluat_test` riêng. Xóa nó đi rồi chạy lại `bun test` để tạo mới. |
| Web báo "dữ liệu mẫu" | API chưa chạy hoặc văn bản chưa có trong kho. Chạy `bun run dev` để bật cả hai. |
| Trợ lý không thấy công cụ số hóa | MCP server nạp trước khi mã/`.mcp.json` đổi. Khởi động lại phiên trợ lý hoặc `/mcp` để kết nối lại. Kiểm tra vai trò là `bien_tap` và `QDPL_MCP_ALLOW_WRITE=1`. |
| `Server đang chạy ở chế độ CHỈ ĐỌC` khi nhận việc số hóa | Thiếu `QDPL_MCP_ALLOW_WRITE=1` trong `.mcp.json`. |
| `hoan_tat_so_hoa` qua MCP ghép sai dù mã `packages/sohoa` đã sửa | MCP server (stdio) nạp mã lúc khởi động phiên, không tự nạp lại. Kết nối lại bằng `/mcp`, hoặc chốt bằng CLI cùng hàm: `bun run pipeline so-hoa hoan-tat <viec_id>`. |
| Bước phát hiện đọc quá tổng số trang danh mục Công báo | Công báo chuyển hướng số trang vượt tổng về trang 1; adapter đã dừng theo `totalPageSodo` và URL sau chuyển hướng (08/9/2026). Nếu tái diễn, xem `bull status` và `BULL_DISCOVER_MAX_PAGES`. |
| Luật số hóa xong nhưng rơi vào `cho_duyet` vì "thiếu khối chữ ký" | Bộ kiểm chứng đã nhận dạng khối kết thúc của luật ("Luật này được Quốc hội … thông qua", "CHỦ TỊCH QUỐC HỘI"). Với bản cũ, dùng `so-hoa hoan-tat <viec_id> --bo-qua-canh-bao` sau khi tự soát. |
| `so-hoa tao` báo "chưa có bản PDF trong kho" | Văn bản chỉ có DOCX/HTML — không cần số hóa. Muốn ép thì `--tep <uri>`. |
| `STORAGE_BACKEND=r2 nhưng thiếu biến môi trường` | Thiếu một trong `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID`. Bỏ `STORAGE_BACKEND` đi thì hệ thống lùi về thư mục `STORAGE_DIR`. |

## 10. Biến môi trường chính

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `DATABASE_URL` | — | Kết nối Postgres. **Bắt buộc.** Phải là cổng PgBouncer `25061`, xem `.env.example` |
| `DATABASE_URL_DIRECT` | — | Nối thẳng cổng `25060`, chỉ dùng cho migration |
| `PG_POOL_MAX` | `3` | Kết nối tối đa mỗi tiến trình. Cụm dùng chung chỉ có ~22 slot |
| `DATABASE_URL_TEST` | suy ra từ `DATABASE_URL` | CSDL cho `bun test`. Phải trỏ về Postgres cục bộ `5436` |
| `REDIS_URL` | — | Kết nối Redis/Valkey cho BullMQ. **Bắt buộc để nạp kho.** Mặc định dùng Valkey trên DigitalOcean |
| `QDPL_PROFILE` | `dev` | Hồ sơ cổng: `dev` hoặc `thu` |
| `QDPL_KILL_PORT` | bật ở dev | Đặt `0` để không tự kết thúc tiến trình giữ cổng |
| `ANTHROPIC_API_KEY` | trống | Trống thì lớp LLM chạy chế độ mock, không tốn chi phí |
| `STORAGE_DIR` | `./data` | Kho cục bộ khi chưa có R2; khi dùng R2 thì là nơi giữ bản sao và tệp tạm của việc số hóa |
| `R2_BUCKET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | — | Đủ bốn biến thì kho đối tượng dùng Cloudflare R2; thiếu bất kỳ biến nào thì lùi về `STORAGE_DIR` |
| `STORAGE_BACKEND` | suy ra | `r2` để bắt buộc dùng R2 (thiếu khóa sẽ báo lỗi thay vì âm thầm ghi vào đĩa), `local` để ép dùng thư mục |
| `SOHOA_LEASE_MINUTES` | `180` | Thời gian một phiên trợ lý giữ một việc số hóa; quá hạn thì phiên khác nhận lại được |
| `GOOGLE_CLIENT_ID` | — | Client ID ứng dụng web. Bắt buộc cho đăng nhập trên web và cho MCP chế độ HTTP |
| `AUTH_ALLOWED_DOMAINS` | trống | Chỉ nhận tài khoản thuộc các miền này, phân tách bằng dấu phẩy |
| `AUTH_DEFAULT_ROLE` | `khach` | Vai trò cho tài khoản mới |
| `AUTH_BOOTSTRAP_ADMIN` | `1` | Người đăng nhập **đầu tiên** của kho trống thành `quan_tri`. Đặt `0` để tắt |
| `AUTH_SESSION_TTL_HOURS` | `336` | Hạn token phiên (14 ngày) |
| `AUTH_DEMO_PASSWORD` | trống | Mật khẩu đăng nhập tài khoản demo (Học viên / Quản trị) ở `/dang-nhap`. Trống = tắt. Đổi hoặc xóa sau buổi trình diễn |
| `QDPL_MCP_ALLOW_WRITE` | `0` | Đặt `1` để bật công cụ ghi dữ liệu của MCP |
