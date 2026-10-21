# 01. Nền tảng pháp lý mà hệ thống phải mô hình hóa

Mục đích: xác định "luật chơi" của chính hệ thống pháp luật để thiết kế dữ liệu, thuật toán hợp nhất, trạng thái hiệu lực và chuẩn viện dẫn cho đúng. Đây là tài liệu tham chiếu cho 03, 06, 07, 08.

> Lưu ý: nội dung dưới đây tổng hợp từ nguồn công khai. Trước khi khóa schema, đội biên tập pháp lý phải đối chiếu toàn văn Luật 64/2025/QH15, Luật 87/2025/QH15, Nghị định 78/2025/NĐ-CP, Pháp lệnh 01/2012/UBTVQH13 (sửa đổi bởi Pháp lệnh 01/2026/UBTVQH16), Nghị định 250/2026/NĐ-CP. Chính hệ thống sẽ nạp các văn bản này đầu tiên (xem 13-lo-trinh).

## 1. Văn bản điều chỉnh việc ban hành, hiệu lực, hợp nhất

| Văn bản | Vai trò với hệ thống |
|---------|---------------------|
| Luật Ban hành VBQPPL số 64/2025/QH15 (hiệu lực 01/4/2025) | Định nghĩa hệ thống VBQPPL (Điều 4), thứ bậc, hiệu lực, ngưng/hết hiệu lực, nguyên tắc áp dụng, Công báo, CSDL quốc gia |
| Luật số 87/2025/QH15 (hiệu lực 01/7/2025) sửa đổi Luật 64/2025 | Điều chỉnh theo mô hình chính quyền địa phương 2 cấp: bỏ thẩm quyền cấp huyện, bổ sung quyết định của Chủ tịch UBND cấp tỉnh, nghị quyết HĐND cấp xã, quyết định UBND cấp xã |
| Nghị định 78/2025/NĐ-CP (01/4/2025) | Quy định chi tiết, kỹ thuật trình bày, đăng Công báo điện tử; là nguồn cho quy tắc bố cục phần/chương/mục/tiểu mục/điều/khoản/điểm |
| Pháp lệnh hợp nhất VBQPPL 01/2012/UBTVQH13 + Pháp lệnh 01/2026/UBTVQH16 (hiệu lực 01/7/2026) | Thẩm quyền, thời hạn, kỹ thuật hợp nhất; VBHN được sử dụng làm căn cứ chính thức trong viện dẫn, áp dụng |
| Nghị định 250/2026/NĐ-CP (hiệu lực 01/7/2026) | Kỹ thuật trình bày VBHN: số/ký hiệu, tên, lời nói đầu, căn cứ, cách thể hiện nội dung sửa đổi/bổ sung/bãi bỏ/hết hiệu lực/ngưng hiệu lực, chú thích, đánh số trang, xử lý sai sót kỹ thuật |
| Nghị định 52/2015/NĐ-CP về CSDL quốc gia về pháp luật | Trường thông tin văn bản trong CSDL quốc gia (vbpl.vn); quy định khai thác, sử dụng |
| Pháp lệnh pháp điển 2012 + Bộ pháp điển (phapdien.moj.gov.vn) | Cấu trúc 45 chủ đề / 271 đề mục → dùng làm **taxonomy gốc** cho phân loại lĩnh vực |
| Luật Sở hữu trí tuệ, Điều 15 | VBQPPL, văn bản hành chính không thuộc phạm vi bảo hộ quyền tác giả → được phép sao chép, phân phối; bản dịch/bình luận của bên thứ ba thì có bảo hộ (không được cào) |

## 2. Hệ thống VBQPPL và thứ bậc hiệu lực (Điều 4 Luật 64/2025, sửa đổi 87/2025)

Hệ thống có 25 hình thức văn bản do 14 chủ thể ban hành (theo tổng hợp của Bộ Tư pháp). Bảng dưới là **mã thứ bậc dùng trong hệ thống** (`rank`, số nhỏ = hiệu lực cao). Các dòng cùng `rank` là ngang cấp.

| rank | Hình thức văn bản | Chủ thể ban hành | Mã loại (`doc_type`) |
|------|-------------------|------------------|---------------------|
| 10 | Hiến pháp | Quốc hội | `hp` |
| 20 | Bộ luật, Luật | Quốc hội | `bl`, `l` |
| 20 | Nghị quyết | Quốc hội | `nq-qh` |
| 30 | Pháp lệnh, Nghị quyết | Ủy ban Thường vụ Quốc hội | `pl`, `nq-ubtvqh` |
| 30 | Nghị quyết liên tịch | UBTVQH với Đoàn Chủ tịch UBTW MTTQVN; UBTVQH + Chính phủ + Đoàn Chủ tịch UBTW MTTQVN | `nqlt` |
| 40 | Lệnh, Quyết định | Chủ tịch nước | `lenh`, `qd-ctn` |
| 50 | Nghị định, Nghị quyết | Chính phủ | `nd`, `nq-cp` |
| 50 | Nghị quyết liên tịch | Chính phủ với Đoàn Chủ tịch UBTW MTTQVN | `nqlt-cp` |
| 60 | Quyết định | Thủ tướng Chính phủ | `qd-ttg` |
| 70 | Nghị quyết | Hội đồng Thẩm phán TANDTC | `nq-hdtp` |
| 80 | Thông tư | Chánh án TANDTC; Viện trưởng VKSNDTC; Bộ trưởng, Thủ trưởng cơ quan ngang bộ; Tổng Kiểm toán nhà nước | `tt` |
| 80 | Thông tư liên tịch | Giữa các chủ thể trên | `ttlt` |
| 90 | Nghị quyết HĐND cấp tỉnh; Quyết định UBND cấp tỉnh; Quyết định Chủ tịch UBND cấp tỉnh | Chính quyền cấp tỉnh | `nq-hdnd-t`, `qd-ubnd-t`, `qd-ctubnd-t` |
| 90 | VBQPPL của chính quyền địa phương ở đơn vị hành chính – kinh tế đặc biệt | | `dbkt` |
| 100 | Nghị quyết HĐND cấp xã; Quyết định UBND cấp xã | Chính quyền cấp xã | `nq-hdnd-x`, `qd-ubnd-x` |

Ghi chú thiết kế:
- Văn bản cấp huyện (ban hành trước 01/7/2025) vẫn tồn tại trong kho với `rank` lịch sử 95 và trạng thái theo văn bản chuyển tiếp.
- Ngoài VBQPPL, hệ thống còn lưu **văn bản không phải QPPL** (công văn, quyết định cá biệt, hướng dẫn, tiêu chuẩn/quy chuẩn TCVN/QCVN, án lệ, văn bản của Đảng) với `is_normative = false`, `rank = 999`, để phục vụ vận dụng nhưng không được xếp vào thứ bậc hiệu lực.
- Nguyên tắc áp dụng (Luật 64/2025): văn bản có hiệu lực pháp lý cao hơn được ưu tiên; cùng cơ quan ban hành về cùng vấn đề thì áp dụng văn bản ban hành sau; văn bản mới không quy định trách nhiệm pháp lý hoặc nhẹ hơn thì áp dụng văn bản mới. Engine "đối chiếu" phải mã hóa 3 nguyên tắc này thành quy tắc xếp hạng khi phát hiện xung đột.

## 3. Hiệu lực văn bản – các trạng thái hệ thống phải theo dõi

| Trạng thái (`status`) | Điều kiện | Nguồn xác định |
|-----------------------|-----------|----------------|
| `chua_hieu_luc` | Đã ban hành, chưa đến ngày có hiệu lực | Ngày hiệu lực trong văn bản; tối thiểu 45 ngày (TW) / 10 ngày (địa phương) sau ban hành, trừ trình tự rút gọn |
| `con_hieu_luc` | Đang có hiệu lực toàn bộ | |
| `het_hieu_luc_mot_phan` | Một hoặc nhiều nút bị sửa đổi/bãi bỏ | Văn bản sửa đổi, bổ sung, bãi bỏ |
| `het_hieu_luc` | Hết hiệu lực toàn bộ: hết thời hạn; bị thay thế/bãi bỏ; văn bản được quy định chi tiết hết hiệu lực (trừ trường hợp được tiếp tục áp dụng) | Văn bản thay thế/bãi bỏ; quyết định công bố hết hiệu lực |
| `ngung_hieu_luc` | Bị đình chỉ/ngưng hiệu lực một phần hoặc toàn bộ trong thời hạn | Quyết định đình chỉ |
| `khong_xac_dinh` | Chưa đủ dữ liệu, cần biên tập viên | |

Trạng thái phải được tính **ở cấp nút** (điều/khoản/điểm) và **tại thời điểm** (`as_of`), sau đó suy ra trạng thái cấp văn bản. Xem 03 và 06.

Hiệu lực trở về trước: chỉ trong trường hợp luật định; hệ thống lưu `effective_from` có thể nhỏ hơn `issued_date`.

## 4. Hợp nhất văn bản

- **Chủ thể**: cơ quan ban hành văn bản được sửa đổi (hoặc theo quy định của Pháp lệnh) thực hiện hợp nhất trong thời hạn quy định sau khi văn bản sửa đổi được công bố; VBHN đăng Công báo và CSDL quốc gia.
- **Giá trị**: VBHN được sử dụng làm căn cứ chính thức để viện dẫn và áp dụng; khi có mâu thuẫn giữa VBHN và văn bản được hợp nhất thì văn bản được hợp nhất là căn cứ.
- **Kỹ thuật trình bày (NĐ 250/2026)**: số/ký hiệu VBHN; tên VBHN; lời nói đầu ghi rõ các văn bản được hợp nhất; căn cứ ban hành; nội dung sửa đổi/bổ sung được thể hiện kèm **chú thích** nêu rõ văn bản, điều khoản sửa đổi và thời điểm có hiệu lực; nội dung bãi bỏ/hết hiệu lực/ngưng hiệu lực được ghi rõ; xử lý sai sót kỹ thuật; đánh số trang.

Hệ quả cho thiết kế:
1. Engine hợp nhất tự động (06) phải sinh **chú thích đúng mẫu NĐ 250/2026** để người dùng quen thuộc, và gắn nhãn "Bản hợp nhất do hệ thống tạo – tham khảo; căn cứ chính thức là VBHN của cơ quan nhà nước hoặc các văn bản được hợp nhất".
2. Khi cơ quan nhà nước ban hành VBHN chính thức, hệ thống nạp và **đối chiếu tự động** với bản tự sinh; sai khác được đưa vào hàng đợi kiểm tra (có thể phát hiện lỗi của cả hai phía).

## 5. Kỹ thuật trình bày và bố cục văn bản (cơ sở cho parser)

Bố cục chuẩn (theo NĐ 78/2025 và tập quán soạn thảo):

```
Văn bản
├── Phần (Phần thứ nhất, Phần thứ hai …)      — hiếm, chỉ bộ luật lớn
│   └── Chương (Chương I, II …)
│       └── Mục (Mục 1, 2 …)
│           └── Tiểu mục (Tiểu mục 1, 2 …)
│               └── Điều (Điều 1, 2 … đánh số liên tục toàn văn bản)
│                   └── Khoản (1., 2., 3. …; điều 1 khoản có thể không đánh số)
│                       └── Điểm (a), b), c) … ; điểm có thể có đoạn con gạch đầu dòng)
└── Phụ lục (Phụ lục I, II …; biểu mẫu, bảng định mức, công thức)
```

Quy tắc parser cần xử lý:
- Điều có tiêu đề ("Điều 5. Giải thích từ ngữ"); khoản không có tiêu đề; điểm bắt đầu bằng chữ cái thường + ")".
- Điều bổ sung dùng số kèm chữ: "Điều 12a", "khoản 2a", "điểm đ1".
- Văn bản sửa đổi có cấu trúc đặc thù: "Điều 1. Sửa đổi, bổ sung một số điều của Nghị định số …" → mỗi khoản là một **lệnh sửa đổi** trỏ đến nút của văn bản khác.
- Chữ cái tiếng Việt trong đánh số điểm: a, b, c, d, đ, e, g, h, i, k, l, m, n, o, p, q, r, s, t, u, v, x, y (không dùng f, j, w, z).
- Phụ lục thường là bảng, biểu mẫu, công thức tính định mức → giữ nguyên dạng bảng/LaTeX.

## 6. Chuẩn viện dẫn (dùng trong 07, 08, 09)

Chuẩn viện dẫn của hệ thống bám cách viết thông dụng trong văn bản nhà nước:

```
điểm a khoản 2 Điều 15 Nghị định số 45/2026/NĐ-CP ngày 26/01/2026 của Chính phủ quy định quản lý đầu tư ứng dụng công nghệ thông tin sử dụng nguồn vốn ngân sách nhà nước
```

Dạng ngắn: `điểm a khoản 2 Điều 15 Nghị định 45/2026/NĐ-CP`.
Dạng máy (URN): `vn:vbqppl:nd:45/2026/NĐ-CP#dieu-15.khoan-2.diem-a@2026-03-01` (hậu tố `@ngày` chỉ phiên bản tại thời điểm).

Khi viện dẫn từ VBHN: ghi rõ "(được hợp nhất tại Văn bản hợp nhất số …/VBHN-… )" nếu là VBHN chính thức, hoặc "(bản hợp nhất tự động, hiệu lực tại ngày …)" nếu do hệ thống sinh.

## 7. Nguồn văn bản chính thống (xếp theo độ ưu tiên)

| Ưu tiên | Nguồn | Nội dung | Định dạng | Ghi chú kỹ thuật |
|---------|-------|----------|-----------|------------------|
| 1 | Công báo điện tử `congbao.chinhphu.vn` | Văn bản TW đăng Công báo, VBHN | PDF (bản chụp có dấu) + DOCX | Danh sách theo loại văn bản, có trường: loại, ký hiệu, cơ quan, ngày ban hành, trích yếu, người ký, ngày hiệu lực, số/ngày Công báo. Có link PDF và DOCX |
| 1 | CSDL quốc gia về pháp luật `vbpl.vn` (phiên bản mới từ 23/4/2026) | VBQPPL TW + 34 tỉnh; thuộc tính, lược đồ, lịch sử hiệu lực, VBHN | HTML có cấu trúc đến điều/khoản/điểm; file đính kèm | Lược đồ có 12 nhóm quan hệ (căn cứ, được hướng dẫn, bị sửa đổi, bị thay thế, hướng dẫn, sửa đổi, thay thế, hợp nhất, đính chính, dẫn chiếu, bị đình chỉ, quy định hết hiệu lực). Trang mới tải dữ liệu động (cần render JS hoặc gọi API nội bộ) |
| 2 | `vanban.chinhphu.vn` | Văn bản Chính phủ, TTg | HTML + file | Có docid ổn định |
| 2 | `quochoi.vn`, `duthaoonline` | Luật, nghị quyết, dự thảo | PDF/DOC | Dự thảo phục vụ cảnh báo sớm |
| 2 | Cổng các bộ (`mst.gov.vn`, `moj.gov.vn`, `mof.gov.vn`…) | Thông tư, VBHN của bộ, dự thảo | PDF/DOC | Cấu trúc khác nhau từng bộ |
| 2 | Bộ pháp điển `phapdien.moj.gov.vn` | Cấu trúc chủ đề/đề mục, các điều đã pháp điển | HTML | Dùng làm taxonomy và kiểm chéo cấu trúc điều |
| 3 | Cổng tỉnh/thành, Công báo địa phương | VBQPPL địa phương | PDF chủ yếu là bản scan | Cần OCR nhiều |
| 3 | TANDTC (`anle.toaan.gov.vn`), TCVN/QCVN | Án lệ, tiêu chuẩn | PDF | Không phải VBQPPL, phục vụ vận dụng |

Không cào từ thuvienphapluat.vn, luatvietnam.vn (nội dung biên tập có bản quyền, vi phạm điều khoản dịch vụ).
