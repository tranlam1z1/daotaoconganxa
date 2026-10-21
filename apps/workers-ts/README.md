# @qdpl/workers — Crawler và pipeline xử lý văn bản

Bun workers cho quydinhphapluat.vn: thu thập văn bản từ nguồn chính thống
(ke-hoach/04), chuyển đổi sang Markdown chuẩn nội bộ, phân tích cấu trúc,
trích lệnh sửa đổi, hợp nhất theo thời điểm và lập chỉ mục
(ke-hoach/02 §4.1 — 8 bước).

```
src/
├── config.ts              # biến môi trường
├── log.ts                 # log JSON có cấu trúc
├── worker.ts              # vòng lặp claimJob/finishJob + pipeline_runs
├── cli.ts                 # CLI vận hành thủ công
├── crawler/
│   ├── fetcher.ts         # rate limit theo host, retry+backoff, ETag/IMS, robots, AIA
│   ├── robots.ts          # parser robots.txt (REP)
│   ├── normalize.ts       # số ký hiệu, ngày VN, tên cơ quan (sáp nhập 2025), loại VB
│   ├── dedupe.ts          # hash file + (số ký hiệu, cơ quan, ngày)
│   ├── store.ts           # kho raw/ + bảng source_records
│   ├── crawl.ts           # điều phối một lượt crawl
│   └── adapters/          # congbao, vbpl, vanban-chinhphu
└── pipeline/
    ├── ingest.ts          # source_records -> documents
    ├── zip.ts, xml.ts     # đọc DOCX không cần thư viện ngoài
    ├── docx.ts            # DOCX -> Markdown (giữ bảng)
    ├── html-md.ts         # HTML -> Markdown
    ├── convert.ts         # định tuyến chuyển đổi (DOCX/HTML trong TS, PDF -> việc số hóa)
    ├── parse.ts           # parseDocument() -> saveVersion() + review_queue
    ├── extract-ops.ts     # trích lệnh sửa đổi (rule-based là chính)
    ├── consolidate.ts     # hợp nhất theo thời điểm + duyệt lệnh
    ├── relations.ts       # can_cu / huong_dan / dan_chieu / cha_con
    └── index.ts           # gọi @qdpl/search (import động, chịu được thiếu package)
```

## 1. Chạy nhanh

```bash
# Cào thật 3 nghị định mới nhất từ Công báo (≤ 1 req/s, có robots)
bun run apps/workers-ts/src/cli.ts crawl congbao --type nghi-dinh --limit 3

# Chạy worker xử lý hàng đợi (ingest -> convert -> parse -> relations -> index)
bun run apps/workers-ts/src/cli.ts worker --once     # hết job thì thoát
bun run --cwd apps/workers-ts dev                    # chạy liên tục

# Nạp một file có sẵn
bun run apps/workers-ts/src/cli.ts ingest-file data/fixtures/nd-mau-goc.md \
  --so-ky-hieu "100/2026/NĐ-CP" --title "Quy định mẫu về quản lý hoạt động thử nghiệm" \
  --type-name "Nghị định" --issuer "CHÍNH PHỦ" --issued-date 20/01/2026 --effective-from 01/03/2026

# Chạy toàn chuỗi cho một văn bản (trích lệnh, duyệt, hợp nhất, chỉ mục)
bun run apps/workers-ts/src/cli.ts pipeline "vn:vbqppl:nd:150/2027/NĐ-CP" --auto-approve

bun run apps/workers-ts/src/cli.ts stats
```

Các lệnh khác: `extract-ops <urn>`, `approve-ops <urn> [--min-confidence]`,
`consolidate <urn> [--as-of]`, `relations <urn>`, `doc <urn>`.

## 2. Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|------|----------|---------|
| `DATABASE_URL` | — | CSDL. **Bắt buộc.** Postgres trên DigitalOcean, xem `.env.example` |
| `STORAGE_DIR` | `./data` | Kho file cục bộ; **đường dẫn tương đối tính từ gốc monorepo**, không phải cwd |
| `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | — | Đủ bốn biến thì kho đối tượng dùng Cloudflare R2; thiếu thì lùi về `STORAGE_DIR` |
| `STORAGE_BACKEND` | — | `local` hoặc `r2` để ép chế độ |
| `SOHOA_LEASE_MINUTES` | `180` | Thời gian một phiên MCP giữ một việc số hóa |
| `CRAWLER_USER_AGENT` | `quydinhphapluat.vn-bot/0.1 (+…)` | Bắt buộc có thông tin liên hệ |
| `CRAWLER_RPS` | `1` | Số request/giây cho **mỗi host** |
| `CRAWLER_TIMEOUT_MS` | `30000` | Timeout mỗi request |
| `CRAWLER_MAX_RETRIES` | `3` | Số lần thử lại (backoff mũ + jitter) |
| `CRAWLER_OBEY_ROBOTS` | `1` | Đặt `0` chỉ khi có thỏa thuận riêng với chủ nguồn |
| `CRAWLER_CA_FILE` | — | PEM CA bổ sung (nguồn dùng CA nội bộ) |
| `DOCPROC_*` | — | **Đã ngưng dùng** (cầu nối Python cũ), chỉ còn tác dụng với job tồn đọng |
| `REDIS_URL` | — | **Bắt buộc** cho mọi lệnh `bull …` |
| `BULL_DISCOVER_MAX_PAGES` | `20` | Chặn trên số trang danh mục tự đi tiếp |
| `BULL_REDIS_DOWN_MS` | `60000` | Mất Redis lâu hơn ngần này thì worker tự dừng |
| `BULL_HEALTH_INTERVAL_MS` | `5000` | Nhịp kiểm tra Redis / kiểm tra hết việc |
| `BACKFILL_POLL_MS` | `5000` | Nhịp đo tiến độ đợt nạp |
| `BACKFILL_WAVE_TIMEOUT_MS` | `1800000` | Thời gian chờ tối đa một đợt |
| `BACKFILL_STALL_MS` | `300000` | Đợt đứng yên (hàng đợi rỗng) lâu hơn ngần này thì dừng |
| `FIXTURE_DIR` | `data/fixtures` | Thư mục cho adapter `fixture` |
| `LOG_LEVEL`, `LOG_PRETTY` | `info`, `0` | Log |

## 3. Kết quả điều tra nguồn (thật, ngày 2026-09-06)

### 3.1 congbao.chinhphu.vn — HTML tĩnh, dùng được đầy đủ

* `robots.txt` → `User-agent: * / Allow: /` (có BOM ở đầu file, parser đã xử lý).
* Danh sách: `GET /van-ban-dang-cong-bao/{slug}-l{code}.htm` → **HTTP 200**, ~760 KB
  HTML tĩnh, 10 mục/trang. Mã `code` lấy từ chính menu "Loại văn bản"
  (`nghi-dinh=1`, `quyet-dinh=2`, `thong-tu=3`, `luat=13`, `van-ban-hop-nhat=7`…),
  đã hard-code trong `CONGBAO_TYPE_CODES`.
* Phân trang: `…/{slug}-l{code}/trang-{n}.htm` (đã kiểm chứng: `trang-2` trả nội
  dung khác trang 1; `?page=2` **không** đổi nội dung nên không dùng). Tổng số
  trang nằm ở biến JS `var totalPageSodo = 268;` trong chính trang danh sách.
* Mỗi mục: `div.item--vb[data-id]` → `.top .kh` (Ký hiệu), `.middle a.sapo`
  (tiêu đề + link chi tiết), `.share a[href^="/cong-bao/"]` (số + ngày Công báo),
  `.bot .days` (`[Ban hành: dd/mm/yyyy] [Hiệu lực: dd/mm/yyyy]`),
  `a[data-atc="download"][data-file]` (DOCX và PDF).
* Chi tiết: `/van-ban/{slug}-{id}.htm` → `div.popup__detail--thuoctinh .row`
  chứa đủ **loại văn bản, số ký hiệu, cơ quan ban hành, ngày ban hành, trích yếu,
  người ký, ngày hiệu lực, Công báo**.
* Công báo **không** công bố lược đồ quan hệ.

**Sự cố TLS đã xử lý.** File DOCX/PDF nằm trên `g7.cdnchinhphu.vn`, host này gửi
**chuỗi chứng thư thiếu chứng thư trung gian** (`GlobalSign RSA OV SSL CA 2018`):
`openssl s_client` báo `Verify return code: 21 (unable to verify the first
certificate)`, `curl` thoát mã 60, `fetch` của Bun ném
`unable to verify the first certificate`. Cách xử lý trong `fetcher.ts` là
**AIA chasing** — đọc trường `Authority Information Access` của chứng thư máy chủ,
tải chứng thư trung gian (`http://secure.globalsign.com/cacert/gsrsaovsslca2018.crt`),
thêm vào CA store *chỉ cho host đó* rồi thử lại. **Không tắt xác thực TLS.**

### 3.2 vbpl.vn — cần trình duyệt thật

vbpl.vn nằm sau tường lửa ứng dụng có thử thách JavaScript. Kiểm chứng ngày 06/9/2026:
mọi yêu cầu HTTP thường trả **403** ("Sorry, you have been blocked"), kể cả `/robots.txt`
và `/sitemap.xml`, kể cả khi đặt User-Agent trình duyệt và đủ header.

Adapter dùng `src/crawler/browser.ts` (Puppeteer + Chromium):

```bash
# Cài Chromium một lần
bunx playwright install chromium
# hoặc trỏ tới Chrome sẵn có
export CHROMIUM_PATH=/usr/bin/google-chrome

# Cào thật
bun run apps/workers-ts/src/cli.ts crawl vbpl --limit 3
```

Cơ chế: mở trang chủ một lần để trình duyệt chạy thử thách và lấy cookie, sau đó tái sử dụng
cookie cho mọi yêu cầu (không mở trình duyệt cho từng trang). Nhịp mặc định 1 yêu cầu / 2 giây,
đổi bằng `VBPL_MIN_INTERVAL_MS`.

**Lấy được**: số ký hiệu, loại văn bản, tên, cơ quan ban hành, ngày ban hành, trạng thái hiệu lực,
lĩnh vực (từ khối JSON-LD `schema.org/Legislation` do máy chủ render); danh sách URL văn bản
qua `sitemap.xml`.

**Chưa lấy được**: lược đồ 12 nhóm quan hệ — nằm trong tab do React dựng sau hydrate, mà hydrate
thất bại ở môi trường máy chủ (React error #329). Quan hệ được bù bằng `pipeline/relations.ts`
và `pipeline/extract-ops.ts`, suy ra từ chính câu chữ văn bản nên kiểm chứng được.
Xem thêm `ke-hoach/04-thu-thap-du-lieu.md` §3.1.

Test mạng thật tắt theo mặc định; bật bằng `VBPL_LIVE_TEST=1 bun test apps/workers-ts/tests/browser.test.ts`.

## 4. Số hóa PDF: giao việc cho agent (ke-hoach/05)

`pipeline/convert.ts` định tuyến theo loại file:

| Loại | Xử lý |
|------|-------|
| `.docx` | `docx.ts` — đọc `word/document.xml` từ ZIP, chuyển `w:p`/`w:tbl` sang Markdown **ngay trong TypeScript**, giữ bảng dạng GFM |
| `.html` | `html-md.ts` — node-html-parser |
| `.md`, `.txt` | dùng nguyên |
| `.pdf` | **đẩy job sang hàng đợi `qdpl-sohoa`** |
| `.doc`, `.rtf` | không đọc được — tạo việc trong `review_queue` để lấy bản PDF/DOCX khác |

Giai đoạn `sohoa` (`bull/workers/sohoa.ts`) **không gọi mô hình và không chờ ai**. Nó chỉ:

1. đọc lớp văn bản của PDF bằng MuPDF (`@qdpl/sohoa`), phân loại tuyến `pdf_text` / `pdf_anh`;
2. chia cụm trang chồng lấn (mặc định 5 trang, chồng 1);
3. tuyến `pdf_text` thì dựng sẵn **bản nháp nguyên văn** vào `derived/{doc}/so-hoa/nhap.md`;
4. ghi một hàng `sohoa_tasks` ở trạng thái `cho`.

Sau đó agent nhận việc qua MCP (`nhan_viec_so_hoa` → `lay_cua_so_trang` → `nop_cua_so` →
`hoan_tat_so_hoa`). **Chính agent** đẩy job `parse` khi hoàn tất; worker không ngồi chờ.
Nếu lúc chốt phiên MCP không nối được Redis, việc được đánh dấu `parse_queued = false` và
lệnh `bun run pipeline so-hoa dong-bo` đẩy nốt.

Lệnh vận hành:

```bash
bun run pipeline so-hoa danh-sach [--trang-thai cho] [--limit 30]
bun run pipeline so-hoa tao <urn>
bun run pipeline so-hoa dong-bo
bun run pipeline so-hoa don-dep --yes
```

> Cầu nối cũ sang `services/docproc` (Python) — `bull/workers/docproc.ts`, `awaitDocproc()`,
> job `docproc-wait`, các biến `DOCPROC_*` — **đã ngưng dùng**. Mã còn trong repo để xử lý nốt
> job tồn đọng trong bảng `jobs`, nhưng không còn giai đoạn nào đăng ký hàng đợi `qdpl-docproc`.

## 5. Trích lệnh sửa đổi (`extract-ops.ts`)

**Rule-based là chính** (ke-hoach/06 §2.3 bước 1); LLM chỉ đối chiếu.

Cách làm: quét Markdown, tách theo `Điều N.`, rồi theo từng khoản `n.` —
**máy trạng thái theo dõi dấu ngoặc kép** nên nội dung mới trích dẫn nhiều dòng
(kể cả khi bên trong có `Điều 3a.`, `1.`, `2.`) không bị tách nhầm thành lệnh.

Mẫu câu đã hỗ trợ (ke-hoach/06 §2.2):

| Mẫu | op |
|-----|----|
| "Sửa đổi, bổ sung khoản 1 Điều 3 như sau: `"…"`" | `replace` |
| "Bổ sung khoản 4 vào sau khoản 3 Điều 3 như sau:" | `insert_after` (+ `newLabel`, `newKind`) |
| "Bổ sung Điều 3a vào sau Điều 3 như sau:" | `insert_after` cấp điều |
| "Bổ sung khoản 5 vào Điều 7" | `append_child` |
| "Bãi bỏ điểm c khoản 2 Điều 1" / "Bãi bỏ Điều 20, Điều 21" | `repeal` (tách thành nhiều lệnh) |
| "Bãi bỏ Nghị định số 50/2020/NĐ-CP" | `repeal` cấp văn bản (`targetPath` rỗng) |
| "Thay thế cụm từ `"X"` bằng cụm từ `"Y"` tại …" | `replace_phrase` (+ `scopePaths`) |
| "Sửa đổi tên Điều 5 như sau:" | `rename` |
| "Ngưng hiệu lực khoản 3 Điều 7 từ ngày … đến ngày …" | `suspend` (+ `effectiveTo`) |

Quy tắc quan trọng:

* **`payload` luôn là object**, ghi bằng `sql.json`. Lệnh chèn luôn có đủ
  `text` **và** `newLabel` — thiếu thì `consolidate()` của @qdpl/legal-model từ
  chối và đẩy vào `conflicts` (có test khẳng định điều này).
* Văn bản bị sửa đổi lấy theo thứ tự: số ký hiệu trong chính câu lệnh → trong tiêu
  đề/phần mở đầu của Điều → trong tên văn bản; **luôn loại trừ số ký hiệu của
  chính văn bản sửa đổi**.
* Ngày hiệu lực lấy từ "…có hiệu lực thi hành từ ngày …" trong chính văn bản.
* **Kiểm tra nút đích**: `targetPath` phải tồn tại trong phiên bản mới nhất của
  văn bản bị sửa; không có → `review_status = 'needs_legal'`. Chưa nạp văn bản
  đích → giữ `pending` nhưng hạ `confidence` 10%.
* Mỗi lệnh sinh một mục `review_queue(kind='amend_op')`; chỉ lệnh
  `review_status='approved'` mới được `consolidate()` áp dụng.
* **Văn bản bị sửa đổi chưa nạp**: không đẩy job `consolidate` (tránh job chết
  oan sau 3 lần thử), thay vào đó ghi `review_queue(kind='status_change')`.
  Khi văn bản đó được nạp, `ingest.ts` thấy có `amendment_ops` trỏ tới nó và tự
  đẩy job `consolidate` — vòng lặp khép kín, không cần thao tác tay.
* Chỉ quét những Điều "trông giống Điều sửa đổi" và những khoản bắt đầu bằng động
  từ lệnh — nếu không, một nghị định thường sẽ sinh hàng trăm cảnh báo rác
  (đã gặp thật: 177 cảnh báo trên NĐ 336/2026/NĐ-CP trước khi thêm bộ lọc).

LLM: `crossCheckWithLlm()` gọi `complete()` với `jsonSchema` (`AMEND_OPS_SCHEMA`).
Khi `isMock()` (không có `ANTHROPIC_API_KEY`) hàm trả `{ used: false }` ngay và
**không** gọi mạng — pipeline chạy đúng ở cả hai chế độ.

## 6. Kho file thô

Theo ke-hoach/04 §4:

```
{STORAGE_DIR}/raw/{source}/{yyyy}/{doc_type}/{so_ky_hieu_slug}/{sha256}.{pdf|docx|html}
{STORAGE_DIR}/raw/{source}/{yyyy}/{doc_type}/{so_ky_hieu_slug}/metadata.json
{STORAGE_DIR}/out/{documentId}/{hash}.md               # Markdown sau chuyển đổi (đã có trong .gitignore)
```

Tên file là SHA-256 nội dung ⇒ tải lại cùng nội dung không tạo file mới.
`source_records` khóa `(source, source_id)`; ETag/Last-Modified được gửi lại ở
lần sau để nhận `304 Not Modified`.

## 7. Đường ống BullMQ và bộ điều phối nạp kho

### 7.1 Dùng worker nào?

Trong repo có **hai** worker, cố ý giữ cả hai:

| | Worker cũ (`src/worker.ts`) | Worker BullMQ (`src/bull/`) |
|---|---|---|
| Hàng đợi | bảng `jobs` của Postgres | Redis (BullMQ) |
| Lệnh | `cli.ts worker` | `cli.ts bull worker` |
| Hợp cho | việc lẻ, chạy tay, job tồn đọng trong bảng `jobs` | **nạp kho nhiều ngày**: giới hạn tốc độ theo nguồn, thử lại có lùi thời gian, ưu tiên, theo dõi trực tiếp |
| Sổ cái | `pipeline_runs` | `pipeline_runs` + `ingest_runs`/`ingest_items` (đối soát được) |

Quy tắc: **nạp lịch sử / cào định kỳ → BullMQ**; chạy lại một văn bản hoặc gỡ lỗi tay →
worker cũ. Worker cũ không bị đụng tới để những gì đang chạy không hỏng.

```
src/bull/
├── queues.ts     # lớp đệm tên hàng đợi (xem §7.5) + add/addBulk/snapshot…
├── ledger.ts     # ingest_runs / ingest_items: ghi sổ và tính tiến độ
├── frame.ts      # corpus_targets: KHUNG kho cần có gì + đối soát corpus_coverage
├── stage.ts      # vỏ bọc chung: sổ cái + updateProgress + logRun + không nuốt lỗi
├── registry.ts   # hàng đợi -> giai đoạn
├── runner.ts     # khởi chạy worker, tắt êm, tự dừng khi mất Redis
└── workers/      # discover, fetch, ingest, convert, sohoa, parse,
                  # extract-ops, consolidate, relations, index, reconcile
src/backfill.ts   # bộ điều phối nạp kho theo đợt (wave)
```

### 7.2 Lệnh

```bash
export REDIS_URL='rediss://default:<mat-khau>@db-valkey-sgp1-39341-do-user-17889737-0.m.db.ondigitalocean.com:25061'   # Valkey trên DigitalOcean

# Khung cấu trúc kho (chạy một lần; --kiem-thu thêm ô khung dùng adapter fixture)
bun run apps/workers-ts/src/cli.ts bull frame --seed

# Nạp kho theo nhóm ưu tiên; chờ từng đợt đạt ngưỡng rồi mới sang đợt sau
bun run apps/workers-ts/src/cli.ts bull backfill --nhom ha_tang_phap_ly
bun run apps/workers-ts/src/cli.ts bull backfill --nhom luat --resume <runId>
bun run apps/workers-ts/src/cli.ts bull backfill --nhom luat --no-wait   # chỉ đẩy đợt đầu

# Worker (chạy nhiều tiến trình được; --until-idle dùng cho chạy một lượt)
bun run apps/workers-ts/src/cli.ts bull worker
bun run apps/workers-ts/src/cli.ts bull worker --queues fetch,convert --concurrency 2

# Vận hành
bun run apps/workers-ts/src/cli.ts bull status
bun run apps/workers-ts/src/cli.ts bull failures --queue fetch --limit 20
bun run apps/workers-ts/src/cli.ts bull retry --queue fetch
bun run apps/workers-ts/src/cli.ts bull pause | bull resume | bull drain --yes
```

Mọi lệnh `bull …` báo lỗi rõ ràng nếu thiếu `REDIS_URL`.

### 7.3 Sổ cái và trạng thái một mục

`ingest_items` là sổ cái đối soát: mỗi mục nguồn công bố một dòng.
`giai_doan` đi theo đường ống `phat_hien → tai_ve → chuyen_doi → phan_tich →
trich_lenh → hop_nhat → quan_he → chi_muc → xong`; `trang_thai` là
`cho | dang_chay | xong | loi | bo_qua`.

* Mục chuyển sang **`xong`** khi qua bước `index` — tức là đã đi hết đường ống nạp.
* Các nhánh phụ (`relations`, `extract-ops`, `consolidate`) có thể chạy **sau** bước
  `index`; chúng **không** kéo mục đã `xong` về lại `cho` (xem `PatchOptions.chiKhiChuaXong`).
* Lỗi luôn được ghi (`trang_thai='loi'`, `loi` = thông báo đầy đủ) kể cả khi BullMQ
  còn thử lại; lần thử sau ghi đè `so_lan_thu` và xóa lỗi cũ.

### 7.4 Bộ điều phối nạp kho (`src/backfill.ts`)

* Đọc `corpus_targets` theo `nhom`, sắp theo `uu_tien` rồi **gom thành đợt**.
* Đợt sau chỉ bắt đầu khi đợt trước đạt ngưỡng (mặc định **95 %** mục ở
  `xong`/`bo_qua`) — tính riêng phần TĂNG THÊM của đợt (`waveRatio`), nên đợt trước
  gần xong không che được đợt sau vừa bắt đầu.
* **Dừng và chạy tiếp**: chạy lại đúng lệnh sẽ dùng lại đợt `dang_chay` cùng tên
  (`--new` để ép tạo đợt mới), bỏ qua ô khung đã đẩy job (ghi ở
  `ingest_runs.pham_vi.da_day`), và jobId tất định chặn job trùng ở Redis.
* Kết thúc đợt: cập nhật `corpus_coverage` (kho **đang có** bao nhiêu so với kỳ vọng).

### 7.5 Ghi chú kỹ thuật đang phải đi vòng

`packages/queue` đặt tên hàng đợi có dấu hai chấm (`qdpl:discover`), nhưng BullMQ
(kiểm chứng ở 5.81.4 và 6.3.4) **từ chối** cả tên hàng đợi lẫn jobId tự đặt có `:`
(`Queue name cannot contain :`, `Custom Id cannot contain :`). Vì nhánh này không
được sửa `packages/`, `src/bull/queues.ts` đổi `:` thành `-` khi nói chuyện với
BullMQ và giữ nguyên mọi thứ khác của `@qdpl/queue` (chính sách thử lại, giới hạn
tốc độ, số chạy song song, jobId tất định). Khi `packages/queue` đổi tên thì xóa
lớp đệm này — ánh xạ là 1-1 nên khóa Redis không đổi.

### 7.6 Adapter `fixture`

`src/crawler/adapters/fixture.ts` đọc `data/fixtures/*.md` và trả về URL `file://`
(`fetch-item.ts` đọc thẳng từ đĩa cho giao thức này). Không phải nguồn thật — dùng để
chạy thử toàn chuỗi discover → … → index ngoại tuyến, không đụng máy chủ nhà nước.

## 8. Kiểm thử

```bash
bun test apps/workers-ts                 # 110 test; nhóm cần Redis tự bỏ qua nếu thiếu REDIS_URL
bun run --cwd apps/workers-ts typecheck
```

* `tests/adapters.test.ts` chạy trên HTML **thật** đã lưu ở `test-fixtures/`
  (tải 2026-09-06). Đây là "contract test" của ke-hoach/04 §7: nguồn đổi cấu trúc
  thì test đỏ trước khi crawler âm thầm trả rỗng.
* `tests/extract-ops.test.ts` khẳng định 5 lệnh trên `data/fixtures/nd-mau-sua-doi.md`
  và áp dụng chúng bằng `consolidate()` thật.
* `tests/convert.test.ts` dựng file ZIP/DOCX ngay trong test (không cần file nhị phân).

## 9. Tồn đọng đã biết

1. **vbpl.vn**: chưa lấy được lược đồ 12 nhóm quan hệ, lịch sử hiệu lực và toàn
   văn (xem §3.2). Cần quyết định hướng 1/2/3.
2. **`.doc` nhị phân cũ** chưa đọc được bằng TypeScript: hiện đưa vào `review_queue` để
   người vận hành lấy bản PDF/DOCX thay thế.
3. **Ảnh trong DOCX** mới chỉ chèn `![Hình trong văn bản gốc](#)`; chưa trích
   file ảnh ra `assets`.
4. Đánh số tự động của Word (`w:numPr`) không được diễn giải — văn bản Công báo
   đánh số bằng chữ trong nội dung nên không ảnh hưởng; cần xem lại nếu gặp nguồn
   dùng numbering thật.
5. `discover()` của `vanban-chinhphu` cần `--start-docid`; chưa có lịch quét
   docid tăng dần tự động (`scheduler.ts` của ke-hoach/04 §3 chưa làm).
6. Parser của @qdpl/legal-model coi nội dung trong ngoặc kép của văn bản sửa đổi
   là khoản thật → sinh cảnh báo `gap`/`duplicate` (đã đẩy vào `review_queue`,
   không mất dữ liệu). Đây là hành vi của package dùng chung, **không sửa** theo
   phạm vi nhánh này.
