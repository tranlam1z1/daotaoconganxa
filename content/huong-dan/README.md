# Hướng dẫn sử dụng (`content/huong-dan/`)

Một nguồn nội dung, ba nơi hiển thị:

| Nơi hiển thị | Đường dẫn | Mã dựng |
|---|---|---|
| Khung Hướng dẫn trên mọi trang (nút trên thanh đầu trang) | mọi trang | `apps/web/app/components/HuongDanTrongTrang.tsx`, `routes/api.huong-dan.tsx` |
| Mục Hướng dẫn tập trung | `/huong-dan`, `/huong-dan/:bai` | `routes/huong-dan._index.tsx`, `routes/huong-dan.bai.tsx` |
| Bản PDF | `/tai-lieu/huong-dan-su-dung.pdf` | `scripts/huong-dan/pdf.ts` |

Phép dựng chung (Markdown → HTML, đánh số hình, chú giải) nằm ở `apps/web/app/lib/huong-dan.ts`.

## 1. Cấu trúc

```
content/huong-dan/
├── muc-luc.json        chương, thứ tự bài, route được miễn hướng dẫn
├── khoa.json           trạng thái đã phát sinh (DO MÁY GHI, không sửa tay)
└── bai/
    ├── <id>.json       tiêu đề, tóm tắt, route mà bài hướng dẫn, kịch bản chụp hình
    └── <id>.md         lời văn
apps/web/public/tai-lieu/
├── huong-dan/anh/<ten>.png   hình minh hoạ đã khoanh đỏ (do máy chụp)
└── huong-dan-su-dung.pdf     bản PDF (do máy dựng)
```

## 2. Tệp `<id>.json`

```json
{
  "tieu_de": "Tra cứu văn bản",
  "tom_tat": "Một câu nêu trang dùng để làm gì.",
  "routes": ["routes/search.tsx"],
  "nguon_them": ["components/SiteHeader.tsx"],
  "anh": [
    {
      "ten": "tim-kiem-bo-loc",
      "chu_thich": "Bộ lọc kết quả tra cứu",
      "url": "/tim-kiem?q=nghị định",
      "thiet_bi": "may-tinh",
      "dang_nhap": false,
      "thao_tac": [{ "bam": "role=button[name='Bộ lọc']" }, { "cho": "text=Loại văn bản" }],
      "vung": "main",
      "danh_dau": [
        { "o": "#o-tim-kiem", "ghi_chu": "Nhập từ khoá", "huong": "duoi" }
      ]
    }
  ]
}
```

- `routes`: tệp route (như khai trong `apps/web/app/routes.ts`). Khung Hướng dẫn chọn bài theo route
  đang mở; route lá được ưu tiên hơn route khung bao ngoài. Bài mô tả phần giao diện chung không gắn
  route nào thì để `[]` và khai tệp ở `nguon_them`.
- `anh[].ten`: duy nhất trong toàn bộ hướng dẫn, chữ thường không dấu, gạch nối.
- `thiet_bi`: `may-tinh` (1280×800) hoặc `dien-thoai` (390×844). Mặc định `may-tinh`.
- `dang_nhap`: hình cần phiên biên tập viên trở lên.
- `thao_tac`: chạy tuần tự trước khi chụp. `{ "bam": bộ chọn }`, `{ "nhap": bộ chọn, "gia_tri": "…" }`,
  `{ "cho": bộ chọn }`, `{ "doi_ms": 500 }`, `{ "phim": "Enter" }`.
- `vung`: bộ chọn phần trang cần cắt; bỏ trống thì lấy cả khung nhìn.
- `lam_mo`: bộ chọn các thành phần chứa thông tin cá nhân cần làm mờ (tên người, ảnh đại diện, nội
  dung do người học nhập…). Email, token phiên và số điện thoại luôn được làm mờ tự động.
- `danh_dau`: các vùng khoanh đỏ, đánh số 1, 2, 3… theo thứ tự khai. `huong` là phía đặt nhãn ghi
  chú: `phai` (mặc định), `trai`, `tren`, `duoi`. Ghi chú ngắn, tối đa khoảng 8 từ.
- Bộ chọn theo cú pháp Playwright: `role=button[name='Tìm']`, `text=Tóm tắt`, CSS như
  `section[aria-labelledby='van-ban-moi'] li`, thêm `>> nth=1` để lấy phần tử thứ hai. Ưu tiên
  vai trò và nhãn đọc được hơn lớp CSS, vì lớp CSS đổi thường xuyên.

## 3. Tệp `<id>.md`

- Không lặp lại tiêu đề và tóm tắt (đã hiển thị từ `.json`). Mục con bắt đầu từ `##`.
- Chèn hình bằng một dòng riêng: `![Chú thích](anh:ten-anh)`. Mỗi kịch bản trong `anh` phải được chèn
  đúng một lần. Dưới mỗi hình, hệ thống tự thêm số hình, chú thích và chú giải đánh số khớp với số
  khoanh đỏ trên hình.
- Lời văn nhắc vùng trên hình bằng số trong ngoặc: *Bấm **Tra cứu** (2)*.
- Tuân thủ `QUY-TAC-HANH-VAN.md`. Người đọc là người sử dụng: không nêu tên thành phần kỹ thuật
  (API, CSDL, hàng đợi…), không nêu lý do thiết kế nội bộ.

## 4. Hình cần đăng nhập và thông tin cá nhân

Hình khai `"dang_nhap": true` được chụp bằng **tài khoản minh hoạ** riêng
(`minh-hoa.huong-dan@quydinhphapluat.invalid`, tên "Tài khoản minh hoạ", vai trò quản trị). Tài
khoản này không đăng nhập được bằng Google và **bị khoá ngoài lúc chụp**: script mở khoá, cấp một phiên
hạn 2 giờ, chụp xong thì thu hồi phiên và khoá lại; mỗi lần mở khoá đều ghi `audit_log`. Có thể dùng
phiên khác bằng biến `HUONG_DAN_TOKEN`.

Hình được phát hành công khai nên mọi email, token, số điện thoại trên trang được làm mờ tự động trước
khi chụp; các thông tin cá nhân khác khai ở `lam_mo`. Không bấm nút làm thay đổi dữ liệu thật (xuất bản,
xoá, cấp token, gọi soạn bài bằng AI) trong `thao_tac`.

## 5. Lệnh và bộ bảo vệ

```bash
bun run thu                                   # bật web + api ở hồ sơ thu (cổng 3060) để chụp
bun run huong-dan:kiem-tra                    # báo bài cần cập nhật, trang chưa có hướng dẫn
bun run huong-dan:cap-nhat                    # chỉ chụp lại bài cần chụp, dựng lại PDF khi nội dung đổi
bun run huong-dan:cap-nhat -- --bai tim-kiem  # chỉ định bài
bun run huong-dan:cap-nhat -- --tat-ca        # phát sinh lại toàn bộ
bun run huong-dan:pdf                         # dựng lại PDF
bun run scripts/huong-dan.ts xem-truoc <bai>  # chụp thử vào data/work, không ghi khoa.json
bun run scripts/huong-dan.ts tao-bai <id> routes/x.tsx [--chuong <id>]
bun run scripts/huong-dan.ts xac-nhan <bai>   # đã rà soát lời văn sau khi giao diện đổi
```

Nội dung được gói vào bản build của web. Khi chạy web ở chế độ phát triển, sửa tệp bài đã có thì trang
tự cập nhật, nhưng **thêm tệp bài mới** thì phải khởi động lại web (`bun run thu`) mới thấy.

Bộ bảo vệ so từng bài với `khoa.json`:

| Tình huống | Bộ bảo vệ biết bằng cách | Việc được làm |
|---|---|---|
| Trang có thêm/bớt/đổi chức năng | **Chữ ký giao diện** của các tệp nguồn của bài đổi | Chụp lại hình của **riêng bài đó**, ghi danh sách thành phần thêm/bớt vào `cho_ra_soat` |
| Sửa kịch bản chụp | Băm của `anh` đổi | Chụp lại hình của bài đó |
| Chỉ sửa lời văn | Băm của `.md`/tiêu đề/tóm tắt đổi | Không chụp; dựng lại PDF |
| Thêm trang mới (route mới có giao diện) | Route không thuộc bài nào và không ở `khong_can_huong_dan` | Báo lỗi, gợi ý `tao-bai`; `bun test` đỏ |

**Chữ ký giao diện** gồm các thành phần người dùng nhìn thấy và thao tác được, rút từ mã TSX: nút,
liên kết, ô nhập, biểu mẫu, tiêu đề h1–h3, thành phần con được dùng, cùng nhãn tĩnh của chúng. Sửa
comment, lớp CSS hay logic không làm đổi chữ ký. **Tệp nguồn của bài** = tệp route + route khung bao
ngoài + các tệp trong `components/` và `routes/` mà chúng import (bắc cầu) + `nguon_them`.

Sau khi giao diện đổi và hình đã chụp lại, `kiem-tra` còn cảnh báo "lời văn chưa được rà soát" kèm
danh sách thành phần thêm/bớt, cho tới khi `.md` của bài được sửa hoặc chạy `xac-nhan`.
