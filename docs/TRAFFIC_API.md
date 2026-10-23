# API tra cứu giao thông

## Kiến trúc và phạm vi

Dự án dùng Bun/Hono, PostgreSQL với truy vấn tham số hóa, React Router SSR và token phiên opaque.
Giữ kiến trúc này để tái sử dụng authentication, CMS, ảnh và dữ liệu đang có. Không đưa NestJS,
Prisma hoặc cơ chế JWT thứ hai vào cùng ứng dụng. Vai trò hiện tại `quan_ly` soạn và duyệt,
`quan_tri` quản trị hệ thống; tài khoản thường chỉ đọc nội dung công khai. Đây là mô hình quyền
đang có của repository, chưa phải hai vai trò editor/reviewer độc lập.

Migration `0075_traffic_api.sql`:

| Nhu cầu | Cách lưu |
|---|---|
| Biển báo, hành vi | Mở rộng `traffic_signs`, `violations` hiện có; thêm soft delete |
| Nhóm | `sign_categories`, `violation_categories` |
| Khung phạt theo tình tiết | `violation_penalties` |
| Văn bản, điều khoản | View `legal_documents`, `legal_provisions` trên kho canonical `documents`, `document_versions`, `nodes` |
| Lịch sử tra cứu | `search_histories`, gắn tài khoản; tối đa 100 dòng mỗi tài khoản |
| Kiểm duyệt | Tái sử dụng `content_reviews`; khung phạt ghi người/ngày duyệt và `audit_log` |
| Nhập liệu | `import_jobs`, chỉ staging |
| Nhật ký | View `audit_logs` trên `audit_log` |
| Lịch sử sửa nội dung | `traffic_revisions`, trigger lưu OLD trước UPDATE/DELETE, kể cả script nhập cũ |
| Liên kết biển/hành vi | `traffic_sign_violations`, bắt buộc căn cứ và người duyệt |

Không có seed mức phạt mới. Dữ liệu tổng hợp trong tests chỉ vào CSDL test. Migration không tự
gắn ngày hiệu lực hoặc tự duyệt dữ liệu cũ. Nhóm hành vi ban đầu lấy từ nhóm đã có trong CSDL.

## Khởi chạy và cập nhật

1. Cài Bun theo `.bun-version`, chạy `bun install --frozen-lockfile`.
2. Cấu hình `.env` theo `.env.example`: CSDL, kho ảnh, cấu hình phiên và `CORS_ORIGINS`.
3. `bun run db:migrate`, sau đó `bun run dev`. Chỉ chạy migration vào CSDL thật sau khi sao lưu
   và xem xét migration. Bản triển khai này chỉ chạy migration trên CSDL Docker test riêng.
4. Test cục bộ: `docker compose -f infra/docker-compose.yml up -d postgres`; đặt
   `DATABASE_URL_TEST=postgres://qdpl:qdpl_dev@127.0.0.1:5436/quydinhphapluat_test`.
5. Chạy `bun test apps/api/src/traffic-contract.test.ts apps/api/src/traffic.test.ts apps/api/src/bien-bao.test.ts`.
6. Chạy `bun run typecheck`, `bun run lint`, `bun run build` trước khi merge.

API theo cấu hình cổng hiện tại, thông thường 3031. Web giữ thiết kế hai trang
`/tra-cuu-nhanh/bien-bao` và `/tra-cuu-nhanh/muc-phat`.

## API công khai và tương thích

API nghiêm ngặt cho web/mobile tại `/api/v1/traffic`:

| Method | Đường dẫn | Chức năng |
|---|---|---|
| GET | `/signs`, `/violations` | Phân trang SQL, tìm không dấu/gần đúng, từ đồng nghĩa trong keywords |
| GET | `/signs/categories`, `/violations/categories` | Nhóm |
| GET | `/signs/:code`, `/violations/:code` | Chi tiết, căn cứ, biển liên quan hoặc khung phạt |
| GET | `/openapi.json` | OpenAPI 3.0.3 cho các endpoint công khai; có thể mở bằng Swagger Editor/UI |
| GET/POST/DELETE | `/history` | Lịch sử của chính tài khoản, yêu cầu Bearer token phiên |

Query: `q`, `category`, `vehicle=o_to|mo_to`, `legal_document=<URN văn bản>`,
`as_of=YYYY-MM-DD`, `page` (1..10000), `page_size` (1..100, mặc định 24).
Ngày mặc định theo Việt Nam. Mọi khoảng hiệu lực là **[từ, đến)**.
Ví dụ: `/api/v1/traffic/violations?q=nong%20do%20con&vehicle=mo_to&as_of=2026-10-23`.

API nghiêm ngặt chỉ hiện bản ghi đã duyệt, chưa xóa, có ngày hiệu lực; điều khoản chính xác
phải active trong phiên bản đã duyệt tại ngày tra cứu, có nguồn HTTPS. Chưa có căn cứ trong
kho thì trả rỗng/404, không suy đoán. Kiểm duyệt vẫn cần đối chiếu tính chính thức của nguồn,
quan hệ sửa đổi và độ đúng của phép hợp nhất. Cổng này không tự chứng minh tính đúng của dữ liệu.

Để giữ tương thích hai giao diện cũ, `/api/v1/tra-cuu/*` là alias của `/v1/tra-cuu/*`.
Hai trang hiện tại dùng alias này, vẫn theo quy tắc dữ liệu legacy đã duyệt; **không áp dụng
đầy đủ cổng căn cứ nghiêm ngặt của `/traffic`**. Bật cờ bản nháp chỉ có tác dụng ngoài production.
Các alias hỗ trợ `page` với 24 dòng, nhưng mức phạt legacy còn giới hạn lấy tối đa 1.000 dòng
trước khi chia trang. Dùng `/traffic` khi cần phân trang SQL trên kho lớn.
Ảnh SVG/PNG tiếp tục phục vụ qua `/v1/tra-cuu/bien-bao/anh/:tep` hoặc web `/bien-bao/anh/:tep`.

Giao diện có debounce 400 ms, loading, empty/error state, thử lại, phân trang, và lịch sử 10
từ khóa trên thiết bị, có nút xóa. Lịch sử thiết bị không đồng bộ tài khoản; ứng dụng mobile có
thể dùng `/history`. Khung phạt bổ sung chỉ hiện trên trang mức phạt khi đã duyệt và đủ căn cứ.
`assessment=requires_case_review` yêu cầu đối chiếu tình tiết; `required_facts` chỉ rõ dữ liệu cần bổ sung.
`data_completeness=no_reviewed_penalty_frames` nghĩa là chưa có khung bổ sung đã được kiểm duyệt.

## Quản trị và nhập dữ liệu

Trang `/quan-tri/giao-thong` liên kết từ trang duyệt dữ liệu hiện tại: xem tài liệu staging,
nhập manifest, tạo và duyệt khung phạt. Biển báo, hành vi và văn bản tiếp tục soạn trong CMS hiện có.
Các API sau cần quyền `quan_ly` trở lên; thao tác review dùng ngưỡng `NGAN_HANG_VAI_TRO_DUYET`:

| Method | Đường dẫn dưới `/api/v1/traffic` |
|---|---|
| GET/POST | `/admin/imports` |
| GET/POST | `/admin/penalties` |
| PUT | `/admin/penalties/:id` (gửi version, sửa đưa về nháp) |
| POST | `/admin/penalties/:id/review` (`version`, `approve`) |
| PUT | `/admin/signs/:code/validity` (`version`, `effective_from`, `effective_to`; đưa về chờ duyệt) |
| DELETE | `/admin/:kind/:code` (`version`; kind signs/violations/penalties; soft delete) |
| GET | `/admin/revisions/:kind/:code` (kind traffic_signs/violations/violation_penalties) |
| GET | `/admin/export/:kind?format=json|csv&page=1&page_size=100` |

Xuất là từng trang; CSV escape dấu nháy và chặn công thức spreadsheet. Nhập production phải qua
biên tập và duyệt từng bản ghi. JSON xuất là bản sao quản trị, không phải payload tự xuất bản.
OpenAPI hiện mô tả các endpoint công khai; hợp đồng admin được liệt kê ở đây và kiểm bằng Zod.

Công cụ miễn phí, chạy cục bộ:

```sh
pip install -r scripts/requirements-traffic.txt
python scripts/import-traffic.py document.pdf --source-url https://nguon-chinh-thuc/... --output data/work/traffic
python scripts/test_import_traffic.py
```

Trích văn bản PDF/DOCX, bảng Word, ảnh nhúng; giữ trang PDF và không đoán trang Word.
Các đoạn được phân loại gợi ý, loại trùng và đánh dấu thiếu căn cứ, ngày, quan hệ sửa đổi, duyệt.
Không tự suy ra tiền phạt từ các dòng PDF bị ngắt trang; không tự ghép ảnh với mã biển.
PDF scan cần OCR/đối chiếu thủ công qua hệ thống docproc hiện có. `data/work/` đã được gitignore.
Manifest quá 1.000 đoạn hoặc 2 MB cần chia lô trước khi upload; API chặn nguồn trùng theo SHA-256.
Không tự tải tài liệu từ URL: URL chỉ là metadata nguồn, không gây SSRF.

Sau khi trích xuất: người biên tập đọc nguyên bản, chọn điều khoản chính xác và nhập nội dung
chuẩn hóa trong CMS; nhập khung bổ sung tại trang mới; người có quyền duyệt kiểm tra rồi công khai.
Staging không có chức năng tự động promote toàn bộ tài liệu thành dữ liệu pháp luật.

Payload tạo khung phạt (thay chỗ giữ bằng dữ liệu đã xác minh, không dùng làm seed):

```text
violation_code: mã hành vi tồn tại
conditions: danh sách tình tiết áp dụng
required_facts: danh sách dữ kiện cần người tra cung cấp
fine_min, fine_max: số nguyên đồng
point_deduction: 0..12 hoặc null khi chưa có thông tin
suspension_months_min, suspension_months_max: cùng null hoặc khoảng số tháng
additional_penalties, remedies: danh sách câu đã biên tập
citation_urn: URN có #đường-dẫn-điều-khoản
effective_from: YYYY-MM-DD
effective_to: YYYY-MM-DD hoặc null
```

## Nguồn đã đối chiếu ngày 23/10/2026

- [Nghị định 168/2024/NĐ-CP trên Cổng văn bản Chính phủ](https://vanban.chinhphu.vn/?classid=1&docid=212167&pageid=27160).
- [Thông tin Chính phủ về Nghị định 238/2026/NĐ-CP](https://xaydungchinhsach.chinhphu.vn/nghi-dinh-238-2026-nd-cp-nhung-quy-dinh-moi-lien-quan-den-hoat-dong-kinh-doanh-van-tai-hanh-khach-119260824105602537.htm):
  sửa đổi Nghị định 168; nguồn nêu ngày áp dụng 15/08/2026. Phải đối chiếu toàn văn từng điều khi biên tập.
- [QCVN 41:2024/BGTVT, tệp Chính phủ](https://datafiles.chinhphu.vn/cpp/files/vbpq/2024/11/51-bgtvt-kem.pdf).
- [Danh mục quy chuẩn của VSQI](https://tieuchuanxaydung.vsqi.gov.vn/quychuan/view?sohieu=QCVN%C2%A041%3A2024%2FBGTVT).

Các nguồn trên xác nhận đầu mối văn bản, không chứng nhận toàn bộ dữ liệu sẵn có trong repository.
Chưa nạp bộ dữ liệu pháp luật đầy đủ và chưa xác nhận tất cả quan hệ sửa đổi sau các văn bản trên.

## Bộ 31 biển đối chiếu từ QCVN 41:2024/BGTVT

`data/bien-bao/qcvn-41-2024-source.json` chứa 31 biển thuộc 5 nhóm, ảnh PNG
trích từ PDF Chính phủ và nội dung mục tương ứng. Đây là bộ trích chọn, không phải
toàn bộ quy chuẩn. Bộ mẫu `bien-bao.json` và SVG minh họa cũ không được tự công khai.

```sh
bun run bien-bao:nap:qcvn
bun run bien-bao:nap:qcvn --apply
```

Lệnh mặc định chỉ kiểm tra. `--apply` nạp vào CSDL và kho ảnh đang cấu hình;
nạp lại dữ liệu giống nhau không tạo bản ghi trùng. Bộ nạp kiểm SHA-256 của bộ dữ liệu,
PDF nguồn và từng ảnh theo `qcvn-41-2024-review.json`, lưu căn cứ, lịch sử duyệt
và bản trích canonical. Actor `codex:source-verification` ghi nhận đối chiếu bằng
công cụ, không đại diện cho người duyệt. Không ghi đè nội dung khác đã duyệt.

Có thể tái trích bằng `python scripts/extract-qcvn-signs.py path/to/51-bgtvt-kem.pdf`
(cần PyMuPDF). Kết quả trích luôn chờ duyệt; thay đổi dữ liệu làm mất hiệu lực
manifest đối chiếu cũ và phải đối chiếu lại trước khi nạp.

## Giới hạn triển khai

- Bản chụp `traffic_revisions` giữ lịch sử chỉnh sửa, nhưng API as_of đọc bảng nội dung hiện tại;
  chưa tự phục dựng nội dung cũ từ snapshot khi cùng mã bị sửa. Văn bản canonical có phiên bản riêng.
  Khi đổi pháp luật, lưu hành vi/khung theo mã phiên bản khác và đóng khoảng hiệu lực cũ.
- Giới hạn 120 request/phút hiện áp dụng trong tiến trình cho `/api/v1/*`, gồm alias. Chỉ đặt
  `TRAFFIC_TRUST_PROXY=1` khi reverse proxy tin cậy ghi đè X-Forwarded-For; mặc định dùng IP kết nối.
  Triển khai nhiều replica phải thêm limiter dùng chung tại reverse proxy/Redis.
- Chưa tách editor/reviewer độc lập và chưa đổi opaque session thành JWT. Không tự thay đổi thang
  quyền vừa được repository chuẩn hóa ở migration 0073.
- Trang admin mới hiển thị 100 khung/tài liệu gần đầu; API phân trang dùng được cho các trang kế.
- Cần chạy E2E trình duyệt trên bản triển khai có đăng nhập và dữ liệu đã duyệt trước khi mở production.
- Không tự merge vào main hoặc triển khai production.
