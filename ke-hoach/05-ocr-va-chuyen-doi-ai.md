# 05. Số hóa văn bản: agent đọc trang, máy giữ luật

> **Thay đổi so với bản đầu (2026-09-06):** bỏ toàn bộ nhánh Python (Docling / Marker /
> PaddleOCR / Tesseract trong `services/docproc`). Việc đọc trang do **chính agent** làm qua
> công cụ MCP chạy bằng `bun run`; phần cắt trang, ghép cụm và kiểm chứng làm bằng TypeScript.
> `services/docproc` được giữ lại trong kho mã ở trạng thái **ngưng dùng** để tham chiếu.

Yêu cầu bắt buộc (từ chủ đầu tư) không đổi:
1. Giữ **bảng biểu** dạng bảng, **công thức** dạng đọc/tính được, **hình ảnh** kèm chú thích.
2. Khi ngắt dòng hoặc sang trang mà vẫn cùng một đoạn/câu thì **không được ngắt đoạn, ngắt câu**.
3. Kết quả là Markdown (chuẩn nội bộ ở 03 §4) để đánh chỉ mục và viện dẫn.

## 0. Nguyên tắc phân vai

| Việc | Ai làm | Vì sao |
|------|--------|--------|
| Đếm trang, trích lớp văn bản + bbox, cắt cụm trang, kết xuất ảnh trang | TypeScript (MuPDF WASM + pdf-lib) | Tất định, rẻ, lặp lại được |
| **Đọc hiểu trang**: nhận ra bảng, công thức, cột, khối chữ ký, câu bị cắt | **Agent** (mô hình đọc thẳng trang PDF/ảnh) | Đây là việc mô hình làm tốt hơn hẳn chuỗi OCR + luật; cũng là chỗ bản Python tốn công nhất |
| Ghép cụm, bỏ trang chồng lấn, nối câu/bảng dang dở | TypeScript (`packages/sohoa/src/stitch.ts`) | Phải tất định để chạy lại ra đúng một kết quả |
| Kiểm chứng chất lượng, chấm điểm, quyết định có phải soát tay | TypeScript (`packages/sohoa/src/verify.ts`) | Không được để mô hình tự chấm điểm cho mình |
| Lưu trữ, hàng đợi, sổ cái | Postgres + R2 + BullMQ | Đã có sẵn |

Ranh giới cốt lõi: **mô hình chỉ được phép SAO CHÉP nội dung; mọi kết luận về chất lượng đều
do luật tính ra.**

## 1. Định tuyến theo loại đầu vào

```
Đầu vào
├── DOCX (Công báo, cổng bộ)   → A. mammoth → Markdown            (TypeScript, không cần agent)
├── HTML có cấu trúc (vbpl.vn) → B. turndown + quy tắc riêng       (TypeScript, không cần agent)
├── Markdown/txt               → dùng nguyên
└── PDF                        → đo lớp văn bản:
     ├── ≥70% số trang có ≥180 ký tự → tuyến `pdf_text`
     │     TypeScript trích nguyên văn + nối đoạn → **bản nháp**; agent soát bản nháp,
     │     dựng cấu trúc/bảng/marker, đối chiếu với trang gốc.
     └── còn lại                      → tuyến `pdf_anh`
           Agent đọc thẳng PDF cụm trang (hoặc ảnh 200–300 DPI) và chép nguyên văn.
```

Ngưỡng đặt ở `packages/sohoa/src/pdf.ts` (`NGUONG_KY_TU_MOI_TRANG`, `NGUONG_TY_LE_TRANG_CO_CHU`).
Tuyến và lý do chọn tuyến được ghi vào `sohoa_tasks.route` và nhật ký `pipeline_runs`.

Khi cùng văn bản có nhiều nguồn (DOCX Công báo + PDF scan), vẫn dùng DOCX làm nội dung chính,
PDF làm bản đối chiếu và nguồn `page_refs`.

## 2. Chuẩn bị bằng TypeScript (`packages/sohoa`)

| Việc | Thư viện | Hàm |
|------|----------|-----|
| Đếm trang, trích chữ theo khối kèm bbox | `mupdf` (WASM) | `docTrangPdf()` |
| Kết xuất ảnh trang PNG | `mupdf` | `renderTrangPng(bytes, trang, dpi)` |
| Cắt một cụm trang thành PDF con | `pdf-lib` | `catCuaSoPdf(bytes, từ, đến)` |
| Phân loại tuyến | — | `danhGiaLopVanBan()` |
| Chia cụm trang chồng lấn | — | `lapKeHoachCuaSo(soTrang, {kichThuoc: 5, chongLan: 1})` |
| Phát hiện header/footer/số trang lặp | — | `phatHienDongLap()` |
| Bản nháp nguyên văn từ lớp văn bản | — | `nhapTuLopVanBan()` |

Hai điểm đáng lưu ý trong `phatHienDongLap`: chỉ coi là nhiễu khi **nguyên văn** dòng lặp lại
trên phần lớn số trang, hoặc khi dòng đó là số trang / dòng "CÔNG BÁO/Số…" — nếu chỉ giống nhau
sau khi thay số thì đó là **nội dung khác nhau theo trang**, không được loại. Và trang có khối
chữ ký (`laTrangChuKy`) thì không cắt phần cuối trang.

Vì sao **không** rasterize mặc định: agent đọc thẳng PDF con giữ nguyên độ nét bản gốc và tốn ít
token hơn ảnh 300 DPI. Ảnh chỉ dùng khi client không đọc được tệp (`kem_anh: true`).

## 3. Vòng làm việc của agent (công cụ MCP)

```
worker `qdpl-sohoa`                      agent (qua MCP, bun run apps/mcp)
──────────────────────                   ─────────────────────────────────
đọc lớp văn bản, chọn tuyến
chia cụm trang, dựng bản nháp
ghi `sohoa_tasks` (state=cho)  ─────────► nhan_viec_so_hoa      → giữ việc, nhận kế hoạch cụm
                                          ┌── lay_cua_so_trang  → PDF cụm + lớp văn bản + dòng
                                          │                       lặp + đuôi cụm trước + open_state
                                    lặp   │   (agent ĐỌC tệp PDF đó)
                                          └── nop_cua_so        → Markdown + trạng thái mở + bảng
                                                                  + sửa lỗi + cảnh báo
                                          hoan_tat_so_hoa       → ghép, kiểm chứng, lưu, đẩy `parse`
```

| Công cụ | Vai trò tối thiểu | Ghi dữ liệu |
|---------|-------------------|-------------|
| `trang_thai_so_hoa` | biên tập | không |
| `nhan_viec_so_hoa` | biên tập | có |
| `lay_cua_so_trang` | biên tập | không (chỉ ghi tệp tạm) |
| `nop_cua_so` | biên tập | có |
| `hoan_tat_so_hoa` | biên tập | có |
| `bo_qua_viec_so_hoa` | biên tập | có |

Các công cụ ghi chỉ chạy khi `QDPL_MCP_ALLOW_WRITE=1` — số hóa là việc tạo ra nội dung pháp lý
người dùng sẽ đọc, không để mở mặc định.

**Giữ việc (lease).** `nhan_viec_so_hoa` giữ việc `SOHOA_LEASE_MINUTES` phút (mặc định 180).
Phiên khác không cướp được việc đang giữ; việc quá hạn (agent chết giữa chừng) thì tự nhả ra.
Chính phiên đang giữ nhận lại được — mất kết nối MCP rồi vào lại vẫn làm tiếp được.

**Nộp lại được.** `nop_cua_so` ghi đè cùng một cụm, nên khi kiểm chứng cuối báo sai ở cụm nào thì
lấy lại đúng cụm đó, sửa, nộp lại rồi chạy lại `hoan_tat_so_hoa` — không phải làm lại cả văn bản.

## 4. Quy tắc chuyển đổi

Toàn văn quy tắc nằm ở `prompts/convert/page-window.md` (có phiên bản, dùng cho cả agent lẫn
đánh giá): bố cục và nhãn cấu trúc, marker nút, nối đoạn/nối câu qua trang, bảng, công thức,
hình, chỗ không đọc được, trạng thái mở, và danh sách "KHÔNG ĐƯỢC LÀM". Bản rút gọn được trả
kèm trong mọi lần `lay_cua_so_trang` để agent luôn có quy tắc trước mắt.

Bốn quy tắc hay bị vi phạm nhất, nên được **kiểm tra lại bằng luật** ở bước sau:
1. Câu bị cắt giữa trang phải nối liền, không chèn ngắt đoạn, không tạo nút mới.
2. Số trang và header lặp phải bỏ; khối "Nơi nhận" và chữ ký phải giữ.
3. Điểm chỉ dùng dãy `a, b, c, d, đ, e, g, …` — không có `f, j, w, z`.
4. Mọi lần sửa lỗi OCR phải khai trong `sua_loi[]`.

## 5. Ghép cụm (`stitch.ts`)

1. Tách mỗi cụm thành **khối** (đoạn + marker đứng trên nó).
2. Dò phần chồng lấn: so khớp mờ (hệ số Dice trên bigram, ngưỡng 0,88) giữa các khối cuối của
   phần đã ghép và các khối đầu của cụm mới, tối đa 14 khối. Tìm thấy thì **bỏ phần đuôi của
   bản cũ** — ưu tiên bản của cụm sau vì nó nhìn thấy nhiều ngữ cảnh hơn. Không tìm thấy mà cụm
   có trang chồng lấn thì ghi cảnh báo "cần soát tay" chứ không im lặng.
3. `open_state.table_open` + hai đầu đều là bảng → nối hàng, bỏ dòng header lặp, và **không** dò
   chồng lấn cho khối đó (hai nửa của cùng một bảng rất giống nhau, dò mờ sẽ xóa nhầm).
4. `open_state.sentence_open` → nối khối đầu của cụm sau vào khối cuối của cụm trước bằng đúng
   một dấu cách, bỏ `<!-- cont -->`.

## 6. Kiểm chứng tự động (`verify.ts`)

| Mã | Kiểm tra | Trọng số | Bắt buộc |
|----|----------|----------|----------|
| `lien_tuc_dieu` | Điều 1..n liên tục, không trùng, không lùi (chấp nhận `12a`) | 0,25 | có |
| `khoan_diem` | Khoản 1,2,3… và điểm theo dãy chữ cái Việt Nam | 0,15 | |
| `marker` | Số marker `<!-- node: -->` không ít hơn số điều | 0,10 | |
| `khong_doc_duoc` | Số chỗ `[[không đọc được: …]]` | 0,10 | |
| `do_dai` | Ký tự Markdown so với lớp văn bản ±8% (tuyến `pdf_text`) | 0,15 | |
| `bang` | Số bảng, số hàng/cột khớp khai báo của agent ±1 | 0,15 | |
| `cong_thuc` | `$$` chẵn, ngoặc cân, mỗi công thức khối có `<!-- alt: -->` | 0,10 | |
| `chu_ky` | Có khối "Nơi nhận"/chức danh người ký | 0,10 | có |

`diem = tổng trọng số các mục đạt / tổng trọng số áp dụng`. Dưới **0,95** hoặc hỏng một mục bắt
buộc thì việc chuyển sang `cho_duyet` thay vì `xong`, và **không** đẩy bước `parse`. Điểm và chi
tiết từng mục ghi vào `sohoa_tasks.quality`, sau đó vào `document_versions.quality`.

Kiểm chứng chéo bằng mô hình lần hai (10% cụm ngẫu nhiên + 100% cụm có cảnh báo) vẫn giữ như
bản cũ, nhưng chạy như một lượt số hóa lại có chọn lọc, không phải một dịch vụ riêng.

## 7. Lưu trữ: cái gì ở R2, cái gì ở CSDL

**Quyết định: Markdown lấy Postgres làm nguồn sự thật, R2 giữ bản sao.**

| Dữ liệu | Nơi lưu | Vì sao |
|---------|---------|--------|
| PDF/DOCX gốc | **R2** `raw/…` | Lớn, không bao giờ xóa, không truy vấn |
| Ảnh trang, asset (bảng/hình/công thức cắt ra) | **R2** `pages/…`, `assets/…` | Chỉ đọc theo khóa |
| Bản nháp và Markdown của việc số hóa | **R2** `derived/{doc}/so-hoa/…` | Sản phẩm trung gian, để truy vết |
| Markdown từng cụm + trạng thái mở, sửa lỗi, cảnh báo | **CSDL** `sohoa_windows` | Nhỏ, cần truy vấn và chạy lại bộ ghép |
| **Markdown đã chốt của một phiên bản** | **CSDL** `document_versions.markdown` | Nguồn sự thật |
| Bản sao Markdown đã chốt | **R2** `derived/{doc}/v{n}/document.md`, ghi vào `markdown_uri` | Xuất bản, đối soát, khôi phục |
| Cây nút | **CSDL** `document_versions.tree` + `nodes` | Truy vấn theo điều/khoản/điểm |

Lý do chọn CSDL cho Markdown đã chốt:
- Markdown được parse thành `nodes`, được diff, hợp nhất và băm (`content_hash`). Nó phải nằm
  **cùng một giao dịch** với cây nút; để ở kho đối tượng thì luôn có cửa sổ lệch giữa
  `markdown_uri` và `tree` sau mỗi lần ghi.
- Kích thước không phải vấn đề: 100–300 KB/văn bản, TOAST nén còn khoảng một phần tư; 100 nghìn
  văn bản ≈ 10–20 GB — nhỏ so với chỉ mục và embedding của chính kho đó.
- Mọi truy vấn nội dung (tìm kiếm, đối chiếu thời điểm, hợp nhất) đều đi qua Postgres; thêm một
  chuyến đi mạng tới R2 cho mỗi lần đọc là chi phí không đổi lấy được gì.

Bản sao trên R2 vẫn bắt buộc: nó là thứ đem đi xuất bản/CDN, và là đường khôi phục khi CSDL hỏng.
Ghi bản sao hỏng thì **không** làm hỏng bước `parse` — chỉ ghi cảnh báo (xem `pipeline/parse.ts`).

Lớp kho là `packages/storage`: đủ bốn biến `R2_*` thì dùng R2 (qua `Bun.S3Client`), thiếu thì tự
lùi về thư mục `STORAGE_DIR`. Cùng một URI tương đối dùng được cho cả hai chế độ.

## 8. Vận hành

```bash
bun run pipeline so-hoa danh-sach              # còn bao nhiêu việc, việc nào đang treo
bun run pipeline so-hoa tao <urn>              # tạo việc số hóa cho PDF của một văn bản
bun run pipeline so-hoa dong-bo                # đẩy nốt job parse nếu lúc chốt thiếu Redis
bun run pipeline so-hoa don-dep --yes          # xóa thư mục làm việc của việc đã xong
```

Trong phiên có MCP: gọi mẫu nhắc việc `so-hoa-van-ban`, hoặc gọi thẳng `nhan_viec_so_hoa`.

**Quy mô.** Một agent làm tuần tự khoảng 5 trang/lượt. Với kho hàng chục nghìn văn bản, đây là
đường dùng cho: văn bản mới trong ngày, văn bản trọng điểm, và văn bản mà kiểm chứng bắt lỗi.
Muốn chạy hàng loạt thì mở nhiều phiên agent song song — lease trong `sohoa_tasks` bảo đảm hai
phiên không giẫm lên nhau. Khi cần backfill quy mô lớn hơn nữa, đường tiết kiệm nhất vẫn là gọi
Batch API bằng chính bộ prompt và bộ kiểm chứng này (giảm 50% chi phí, trả kết quả ≤ 24 giờ);
phần TypeScript ở trên dùng lại nguyên vẹn, chỉ thay chỗ "ai gọi mô hình".

**Chi phí.** Tuyến A/B ≈ 0. Tuyến `pdf_text`: agent đọc bản nháp + đối chiếu, khoảng 2–4k token
vào + 1,5k ra mỗi trang. Tuyến `pdf_anh`: PDF cụm 5 trang ≈ 4–6k token vào + 1,5–2k ra mỗi trang.

## 9. Giao diện duyệt (editorial console)

- Xem song song trang gốc ↔ Markdown, đồng bộ theo `bbox` của khối.
- Sửa trực tiếp Markdown với marker nút được bảo vệ; sửa bảng bằng trình soạn bảng.
- Nút "làm lại cụm này", "chấp nhận", "gửi pháp chế". Trạng thái `cho_duyet` của `sohoa_tasks`
  chính là hàng đợi của màn hình này.
- Mọi chỉnh sửa tạo `corrections` để làm dữ liệu few-shot và luật hậu xử lý về sau.

## 10. Cải tiến liên tục

- Bộ dữ liệu vàng 300 trang đa dạng (12) để đo CER/WER, độ chính xác bảng (TEDS), công thức, tỷ
  lệ nối đoạn đúng.
- `sohoa_windows` giữ nguyên vẹn đầu ra từng cụm, nên đổi luật ghép hay luật kiểm chứng là chạy
  lại được trên dữ liệu cũ, không phải gọi lại mô hình.
- Cảnh báo của bộ ghép ("không tìm thấy phần chồng lấn") là chỉ báo sớm tốt nhất cho lỗi ghép —
  theo dõi tỷ lệ này theo tuần.

## Phụ lục A. Bản Python cũ đi đâu

| Thành phần cũ (`services/docproc`) | Thay bằng |
|-----------------------------------|-----------|
| `ocr.py` (PaddleOCR/Tesseract) | Agent đọc thẳng trang |
| `layout.py` (Docling/TableFormer) | `pdf.ts` (khối + bbox của MuPDF) cho bố cục thô; phần hiểu bảng do agent |
| `ai_convert.py` (gọi Claude theo cụm) | Công cụ MCP `lay_cua_so_trang` / `nop_cua_so` |
| `stitch.py` | `packages/sohoa/src/stitch.ts` |
| `verify.py` | `packages/sohoa/src/verify.ts` |
| `preprocess.py` (deskew, nhị phân hóa) | Không cần cho tuyến đọc PDF; ảnh chỉ kết xuất khi client cần |
| `worker.py` (hàng đợi `docproc` trong bảng `jobs`) | Hàng đợi BullMQ `qdpl-sohoa` + bảng `sohoa_tasks` |
| `extract_docx.py`, `extract_html.py` | Đã có sẵn trong TypeScript từ trước |

Rủi ro đã cân nhắc: bỏ OCR chuyên dụng nghĩa là không còn số đo `confidence` ở mức dòng để bỏ
phiếu. Bù lại bằng ba thứ: đối chiếu độ dài với lớp văn bản, đối chiếu bảng theo khai báo, và
quy định "không đoán — đánh dấu `[[không đọc được]]`" vốn kiểm tra được bằng luật.
