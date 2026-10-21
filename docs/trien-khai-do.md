# Triển khai lên DigitalOcean App Platform

Tài liệu này mô tả cách đưa quydinhphapluat.vn lên **DigitalOcean App Platform** bằng
**bảng điều khiển web**, dùng **buildpack Bun** (không có Dockerfile).

Kho mã: <https://github.com/KHCN-Thanh-Hoa/qdpl>. Nhánh triển khai: `main`.

## 1. Vì sao chia thành hai ứng dụng

| Ứng dụng | Thành phần | Mở ra Internet |
|---|---|---|
| `qdpl` | `web` (giao diện), `api` (nội bộ), `worker` (BullMQ), việc `migrate` chạy trước mỗi lần triển khai | chỉ `web` |
| `qdpl-mcp` | `mcp` (MCP server có đăng nhập Google) | có, ở tên miền riêng |

MCP server phải chiếm **gốc một tên miền**: client tìm metadata ở
`/.well-known/oauth-protected-resource`, người vận hành đăng nhập ở `/`, giao thức đi qua `/mcp`.
App Platform chỉ định tuyến theo đường dẫn chứ không theo tên miền, nên để chung với `web`
sẽ đụng đường dẫn gốc. Vì vậy MCP đứng riêng.

`api` **không** khai đường dẫn công khai. Trang web gọi API qua mạng nội bộ của ứng dụng
(`${api.PRIVATE_URL}`), trình duyệt không gọi thẳng API bao giờ.

## 2. Buildpack Bun nhận diện dự án thế nào

App Platform thấy `bun.lock` ở gốc kho thì dùng buildpack Bun; phiên bản lấy từ tệp
`.bun-version` (đang ghim **1.3.14**). Không cần Dockerfile, không cần khai `environment_slug`.

Mọi thành phần đều đặt **Source Directory = `/`** (gốc kho), kể cả `web`. Đây là kho
đơn thể (bun workspaces): các gói `@qdpl/*` khai bằng `workspace:*`, cài từ thư mục con sẽ
không giải được phụ thuộc.

Lệnh của từng thành phần, tất cả đều là script trong `package.json` ở gốc:

| Thành phần | Build Command | Run Command |
|---|---|---|
| `web` | `bun install --frozen-lockfile && bun run build:web` | `bun run start:web` |
| `api` | `bun install --frozen-lockfile && bun run build:server` | `bun run start:api` |
| `worker` | `bun install --frozen-lockfile && bun run build:server` | `bun run start:worker -- --queues reconcile,soan-bai,mascot-anh` (kèm `BULL_MAX_ACTIVE=1`, `BULL_CPU_DUTY=0.5`) |
| `mcp` | `bun install --frozen-lockfile && bun run build:server` | `bun run start:mcp` |
| việc `migrate` | `bun install --frozen-lockfile && bun run build:server` | `bun run deploy:migrate` |

`build:server` chỉ in một dòng thông báo: api, worker và mcp chạy thẳng TypeScript bằng Bun
nên không có bước build. Phải khai lệnh này, nếu để trống thì buildpack chạy `bun run build`
mặc định và sẽ build cả giao diện web một cách vô ích.

## 3. Chuẩn bị trước khi bấm Create App

1. **CSDL và Redis đã có sẵn**: Postgres `db-postgresql-sgp1-06837` (CSDL `qdpl`) và
   Valkey `db-valkey-sgp1-39341`, đều ở vùng `sgp1`. Chọn vùng ứng dụng là **Singapore**
   để không phải trả tiền và độ trễ cho lưu lượng liên vùng.
2. **Cho ứng dụng vào danh sách tin cậy của CSDL**: sau khi tạo xong ứng dụng, vào
   Databases → cụm Postgres → Settings → **Trusted Sources**, thêm ứng dụng `qdpl` (và
   `qdpl-mcp`). Làm tương tự với cụm Valkey. Bỏ qua bước này thì mọi kết nối bị chặn.
3. **Kho đối tượng Cloudflare R2**: hệ thống tệp của App Platform là tạm thời, khởi động lại
   là mất. Bản gốc PDF, ảnh trang và bản sao Markdown **bắt buộc** nằm trên R2.
   Đặt `STORAGE_BACKEND=r2` để hệ thống báo lỗi ngay nếu thiếu khóa, thay vì âm thầm
   ghi vào đĩa tạm rồi mất dữ liệu.
4. **Quyền truy cập kho GitHub**: tài khoản DigitalOcean phải được cài GitHub App và cấp
   quyền đọc kho `KHCN-Thanh-Hoa/qdpl`.

## 4. Tạo ứng dụng `qdpl` trên bảng điều khiển

1. **Apps → Create App → GitHub**, chọn kho `KHCN-Thanh-Hoa/qdpl`, nhánh `main`,
   bật **Autodeploy on push**.
2. Ở bước **Resources**, App Platform tự dò ra một thành phần. Sửa nó thành `web`:
   - Type: **Web Service**
   - Source Directory: `/`
   - Build Command: `bun install --frozen-lockfile && bun run build:web` (buildpack Bun khôi phục `node_modules` từ bộ đệm rồi bỏ qua bước cài; bộ đệm thiếu lối tắt bin của workspace `apps/web` nên `react-router` báo command not found)
   - Run Command: `bun run start:web`
   - HTTP Port: `8080`
   - HTTP Routes: `/`
   - Plan: Basic, 1 vCPU / 1 GB
3. **Add Resource → From Source Code**, cùng kho và nhánh, để tạo `api`:
   - Type: **Web Service** (dịch vụ nội bộ vẫn là Web Service)
   - Build Command: `bun install --frozen-lockfile && bun run build:server`, Run Command: `bun run start:api`, HTTP Port `8080`
   - **Xóa hết HTTP Routes** của thành phần này. Không có route nghĩa là không có đường vào
     từ Internet, chỉ các thành phần cùng ứng dụng gọi được.
   - Health Check → HTTP Path: `/health`
4. **Add Resource** lần nữa để tạo `worker`:
   - Type: **Worker**
   - Build Command: `bun run build:server`
   - Run Command: `bun run start:worker -- --queues reconcile,soan-bai,mascot-anh`
   - Environment Variables riêng của worker: `BULL_MAX_ACTIVE=1`, `BULL_CPU_DUTY=0.5`
   - Vì sao chỉ ba hàng đợi: đường ống nạp kho (`convert`, `sohoa`, `parse`, `index`…) tốn CPU theo số
     trang PDF (job `index` trung bình 31 giây, `convert`/`sohoa` tới 50 giây với PDF 200–300 trang) và
     ghi rất nhiều vào CSDL. Redis là hàng đợi chung, worker nào nghe hàng đợi đó sẽ nhận việc. Đường
     ống nạp kho chạy ở máy vận hành (LENH.md mục 3.7).
   - Lưu ý hạ tầng: cụm Postgres `db-postgresql-sgp1-06837` là cỡ `db-s-1vcpu-1gb`, dùng chung cho 23 CSDL
     của nhiều dự án, `max_connections = 25`. Ngày 08/9/2026 (khi `qdpl` chưa triển khai lên App
     Platform) đợt nạp kho từ máy vận hành đã làm CPU cụm này lên 100%. CSDL `qdpl` là CSDL lớn nhất
     cụm (1,2 GB, trong đó chỉ mục HNSW của `embeddings` 433 MB, lớn hơn RAM của cụm).
5. **Add Resource** lần nữa để tạo việc `migrate`:
   - Type: **Job**, thời điểm chạy: **Before every deploy** (PRE_DEPLOY)
   - Build Command: `bun run build:server`, Run Command: `bun run deploy:migrate`
6. Ở bước **Environment Variables**, khai các biến ở mục 5 dưới đây vào **cấp ứng dụng**
   (Global) để cả bốn thành phần cùng thấy. Riêng `API_URL` chỉ khai cho `web`.
7. **Info**: đặt tên app `qdpl`, vùng **Singapore (sgp)**. Tạo và chờ lần triển khai đầu.

Muốn nhanh hơn: tạo app rỗng rồi vào **Settings → App Spec**, dán nội dung
[`.do/app.yaml`](../.do/app.yaml) và Save. Tệp đó là bản đối chiếu chính xác của các bước trên.

## 5. Biến môi trường

Khai ở cấp ứng dụng, đánh dấu **Encrypt** cho mọi giá trị có mật khẩu hoặc khóa.

| Biến | Giá trị | Ghi chú |
|---|---|---|
| `NODE_ENV` | `production` | Bắt buộc. Quyết định dịch vụ nghe ở `0.0.0.0` và không tự kết thúc tiến trình giữ cổng. |
| `DATABASE_URL` | chuỗi kết nối cổng **25061** | Cổng PgBouncer. Bắt buộc cho ứng dụng. |
| `DATABASE_URL_DIRECT` | chuỗi kết nối cổng **25060** | Chỉ việc `migrate` dùng. |
| `PG_POOL_MAX` | `3` | Mỗi tiến trình mở pool riêng, xem mục 8. |
| `REDIS_URL` | `rediss://default:…:25061` | Hàng đợi BullMQ. |
| `ANTHROPIC_API_KEY` | khóa API | Thiếu thì LLM chạy chế độ mock. |
| `LLM_PROVIDER` | `auto` | |
| `GOOGLE_CLIENT_ID` | Client ID web của Google | Thiếu thì không ai đăng nhập được. |
| `AUTH_ALLOWED_DOMAINS` | rỗng, hoặc `thanhhoa.gov.vn` | Rỗng = không giới hạn miền. |
| `AUTH_DEFAULT_ROLE` | `khach` | |
| `AUTH_BOOTSTRAP_ADMIN` | `1` | Người đăng nhập đầu tiên thành quản trị. **Đổi về `0` ngay sau khi đã có quản trị.** |
| `STORAGE_BACKEND` | `r2` | |
| `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | khóa Cloudflare R2 | |
| `API_URL` | `${api.PRIVATE_URL}` | **Chỉ khai cho thành phần `web`.** |

Không khai `PORT`: App Platform tự đặt, mã nguồn đã đọc đúng biến đó.

## 6. Tạo ứng dụng `qdpl-mcp`

Làm lại mục 4 với một ứng dụng mới tên `qdpl-mcp`, chỉ một thành phần Web Service:
Build `bun run build:server`, Run `bun run start:mcp`, HTTP Port `8080`, route `/`,
health check `/health`. Đối chiếu [`.do/mcp.yaml`](../.do/mcp.yaml).

Biến môi trường như mục 5, bỏ `API_URL` và `DATABASE_URL_DIRECT`, thêm:

| Biến | Giá trị | Ghi chú |
|---|---|---|
| `QDPL_MCP_ALLOW_WRITE` | `1` | Bật nhóm công cụ ghi (số hóa, biên tập). Để `0` nếu chỉ cho tra cứu. |
| `MCP_PUBLIC_URL` | `https://mcp.quydinhphapluat.vn` | Chỉ cần khi dùng tên miền riêng; nếu không, mã tự lấy `APP_URL` do nền tảng đặt. |

## 7. Tên miền và đăng nhập Google

1. Trong ứng dụng `qdpl` → **Settings → Domains**, thêm `quydinhphapluat.vn`.
   Trong `qdpl-mcp`, thêm `mcp.quydinhphapluat.vn`.
2. Google Cloud Console → OAuth 2.0 Client ID (loại Web application) →
   **Authorized JavaScript origins**, thêm đúng các gốc sẽ hiện nút đăng nhập:
   `https://quydinhphapluat.vn`, `https://mcp.quydinhphapluat.vn`, và cả URL
   `*.ondigitalocean.app` nếu còn dùng để chạy thử. Sai bước này thì nút đăng nhập
   hiện ra nhưng Google từ chối, không báo lỗi gì rõ ràng.

## 8. Những điều đã biết trước, để khỏi mất công dò

- **Giới hạn kết nối Postgres.** Cụm dùng chung, chỉ khoảng 22 kết nối cho ~20 CSDL.
  Mỗi tiến trình (`api`, `worker`, `mcp`, mỗi script) mở một pool riêng, `PG_POOL_MAX=3`.
  Tăng số bản sao (instance count) là tăng số pool — tính trước rồi hãy tăng.
- **Crawler cần Chromium.** Hai giai đoạn `discover` và `fetch` chạy trình duyệt thật;
  buildpack không cài Chromium nên worker trên App Platform **không** chạy hai hàng đợi đó
  (xem danh sách `--queues` ở mục 2). Việc thu thập chạy từ máy vận hành theo LENH.md mục 3,
  job vẫn nằm trong cùng hàng đợi Redis nên phần còn lại của đường ống xử lý bình thường.
- **Đĩa là tạm.** Không ghi gì cần giữ lại vào `STORAGE_DIR`. Mọi tệp đi qua R2.
- **`migrate` chạy trước mỗi lần triển khai.** Migration phải luôn tương thích ngược với
  bản mã đang chạy, vì trong lúc job chạy thì bản cũ vẫn đang phục vụ.
- **Nạp kho lần đầu.** Sau lần triển khai đầu tiên, chạy `bun run corpus:load` từ máy vận hành
  (trỏ vào cùng `DATABASE_URL`) để dựng khung cấu trúc kho.

## 9. Kiểm tra sau khi triển khai

```bash
curl -s https://<app>.ondigitalocean.app/            # web trả về HTML
curl -s https://mcp.quydinhphapluat.vn/health        # MCP: status ok, db ok
```

API không có đường ra Internet nên không kiểm tra trực tiếp được. Xem sức khỏe của nó ở
**Runtime Logs** của thành phần `api`, hoặc gián tiếp qua một trang có dữ liệu như `/tim-kiem`.
Trạng thái hàng đợi xem bằng `bun run pipeline bull status` từ máy vận hành.
