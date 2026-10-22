# MCP server quydinhphapluat.vn

Cho phép trợ lý AI (Claude Code, Claude Desktop, hoặc bất kỳ MCP client nào) tra cứu và
vận dụng kho văn bản quy phạm pháp luật của hệ thống, có **xác thực bằng Google** và
**phân quyền theo vai trò**.

## 1. Vì sao thiết kế như thế này

- **Server không tự sinh câu trả lời.** Phía gọi đã là một mô hình ngôn ngữ; việc của server
  là cung cấp **căn cứ đã kiểm chứng** để mô hình tự lập luận và trích dẫn. Vì vậy có công cụ
  `kiem_tra_can_cu` thay cho một công cụ "hỏi đáp".
- **Mặc định chỉ đọc.** Công cụ ghi dữ liệu chỉ bật khi đặt `QDPL_MCP_ALLOW_WRITE=1`.
- **Mặc định từ chối.** Công cụ nào chưa khai báo vai trò tối thiểu thì không ai gọi được.
- **Công cụ ngoài quyền không được đăng ký**, nên client không nhìn thấy và không gọi được.
- **Ghi nhật ký mọi lời gọi**, kể cả lời gọi bị từ chối, kèm danh tính người gọi.

## 2. Chạy

### Chế độ HTTP (nhiều người dùng, có xác thực)

```bash
export DATABASE_URL='postgresql://qdpl:<mat-khau>@db-postgresql-sgp1-06837-do-user-17889737-0.g.db.ondigitalocean.com:25060/qdpl?sslmode=require'
export GOOGLE_CLIENT_ID=<client-id-ung-dung-web>.apps.googleusercontent.com
export MCP_PUBLIC_URL=https://mcp.quydinhphapluat.vn     # URL công khai
export AUTH_ALLOWED_DOMAINS=quydinhphapluat.vn,coquan.gov.vn  # tùy chọn, giới hạn miền
export AUTH_DEFAULT_ROLE=khach
export QDPL_MCP_ALLOW_WRITE=0                            # bật 1 khi cần công cụ ghi

bun run apps/mcp/src/index.ts --http
```

Chuẩn bị phía Google Cloud Console:
1. Tạo **OAuth client ID** loại **Web application**.
2. Thêm `MCP_PUBLIC_URL` vào **Authorized JavaScript origins**.
3. Không cần redirect URI: GIS trả ID token ngay trong trang, server tự kiểm chứng.

### Chế độ stdio (một người dùng, trên chính máy đó)

```bash
DATABASE_URL=... MCP_LOCAL_ROLE=can_bo bun run apps/mcp/src/index.ts
```

Chế độ này không xác thực vì client và server chạy dưới cùng một tài khoản hệ điều hành.
Vai trò lấy từ `MCP_LOCAL_ROLE` (mặc định `can_bo`; thang vai trò mới: `khach` < `can_bo` <
`lanh_dao` < `quan_ly` < `quan_tri`).

## 3. Đăng nhập và lấy token

1. Mở `MCP_PUBLIC_URL` trên trình duyệt.
2. Bấm **Đăng nhập với Google**.
3. Trang hiển thị **token phiên** và đoạn cấu hình sẵn để dán vào MCP client.

Token phiên là của hệ thống này (không phải token của Google), có hạn `AUTH_SESSION_TTL_HOURS`
(mặc định 14 ngày), thu hồi được, và chỉ lưu dạng băm SHA-256 trong CSDL.

Cấu hình cho Claude Code (`.mcp.json` trong dự án hoặc `~/.claude.json`):

```json
{
  "mcpServers": {
    "quydinhphapluat": {
      "type": "http",
      "url": "https://mcp.quydinhphapluat.vn/mcp",
      "headers": { "Authorization": "Bearer qdpl_..." }
    }
  }
}
```

## 4. Vai trò và quyền

| Vai trò | Dùng được |
|---------|-----------|
| `khach` | Tra cứu văn bản, đọc điều khoản, kiểm chứng căn cứ, phân giải viện dẫn, xem quan hệ, so sánh thời điểm, đối chiếu thứ bậc |
| `tra_cuu` | Như trên, thêm thống kê kho |
| `bien_tap` | Thêm: kiểm tra sức khỏe dữ liệu, hàng đợi biên tập, xem lệnh sửa đổi, thử hợp nhất, rà soát viện dẫn, xử lý việc, báo vấn đề |
| `phap_che` | Thêm: **duyệt lệnh sửa đổi** |
| `quan_tri` | Thêm: quản lý tài khoản và vai trò |

Người đăng nhập ĐẦU TIÊN của kho trống nhận vai trò `quan_tri` (tắt bằng `AUTH_BOOTSTRAP_ADMIN=0`).
Các tài khoản sau nhận vai trò `AUTH_DEFAULT_ROLE` (mặc định `khach`). Nâng quyền bằng công cụ
`quan_ly_tai_khoan` (chỉ `quan_tri`), hoặc trực tiếp trong CSDL:

```sql
UPDATE accounts SET role = 'quan_tri' WHERE email = 'nguoi-quan-tri@coquan.gov.vn';
```

Quản trị viên đầu tiên phải đặt bằng SQL vì chưa có ai có quyền cấp quyền.

## 5. Danh sách công cụ

**Tra cứu** — `tim_kiem_quy_dinh`, `doc_van_ban`, `doc_dieu_khoan`, `kiem_tra_can_cu`,
`phan_giai_vien_dan`, `xem_quan_he_van_ban`, `so_sanh_thoi_diem`, `doi_chieu_thu_bac`,
`danh_sach_van_ban`

**Vận hành** — `thong_ke_kho`, `kiem_tra_suc_khoe_du_lieu`, `hang_doi_bien_tap`,
`xem_lenh_sua_doi`, `thu_hop_nhat`, `ra_soat_vien_dan`, `xu_ly_viec_bien_tap`, `bao_van_de`

**Quyết định pháp lý** — `duyet_lenh_sua_doi`

**Quản trị** — `quan_ly_tai_khoan`

**Tài nguyên** — `vbqppl://danh-sach/moi-nhat`, `vbqppl://van-ban/{urn}` (thêm `@YYYY-MM-DD`
để đọc theo thời điểm)

**Mẫu nhắc việc** — `tra-loi-co-can-cu`, `ra-soat-hieu-luc`, `doi-chieu-hai-van-ban`

## 6. Điểm cuối HTTP

| Đường dẫn | Mô tả |
|-----------|-------|
| `GET /` | Trang đăng nhập Google |
| `POST /auth/google` | Đổi ID token của Google lấy token phiên |
| `POST /auth/logout` | Thu hồi token phiên hiện tại |
| `GET /me` | Danh tính, vai trò, danh sách công cụ khả dụng |
| `GET /health` | Tình trạng CSDL và cấu hình xác thực |
| `GET /.well-known/oauth-protected-resource` | Metadata theo đặc tả MCP Authorization |
| `POST /mcp` | Điểm cuối MCP (Streamable HTTP), yêu cầu `Authorization: Bearer` |

## 7. Kiểm chứng bảo mật đã có test

`bun test apps/mcp` — 45 test, gồm:
- Từ chối token có **chữ ký giả**, **`alg=none`**, **sai audience**, **issuer giả**,
  **hết hạn**, **chưa tới hiệu lực**, **email chưa xác minh**, **dị dạng**
- Từ chối khi **chưa cấu hình `GOOGLE_CLIENT_ID`** (không bỏ qua kiểm tra audience)
- Giới hạn theo **miền tổ chức**
- Token phiên **chỉ lưu dạng băm**; thu hồi và khóa tài khoản có hiệu lực ngay
- **Leo thang đặc quyền**: vai trò `khach` gọi `duyet_lenh_sua_doi` bị chặn và
  **trạng thái dữ liệu không thay đổi**
- Danh sách công cụ **lọc đúng theo vai trò**; chế độ chỉ đọc gỡ hết công cụ ghi

## 8. Giới hạn cần biết

- Chế độ stdio không xác thực. Chỉ chạy trên máy của chính người vận hành.
- Token phiên là bearer token: ai có token thì có quyền của tài khoản đó. Phải chạy sau HTTPS.
- Chưa có giới hạn tần suất gọi (rate limit). Khi mở ra ngoài cần đặt ở tầng reverse proxy.
