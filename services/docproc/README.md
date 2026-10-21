# services/docproc — ĐÃ NGƯNG DÙNG

> **Trạng thái: ngưng dùng từ 06/9/2026.** Đường ống không còn gọi dịch vụ này nữa.
> Việc số hóa PDF hiện do agent thực hiện qua công cụ MCP, phần cắt trang / ghép cụm /
> kiểm chứng viết bằng TypeScript trong `packages/sohoa`. Xem `ke-hoach/05-ocr-va-chuyen-doi-ai.md`
> (Phụ lục A có bảng ánh xạ từng tệp Python sang phần thay thế).
>
> Thư mục này được giữ lại **chỉ để tham chiếu** (luật ghép trang, luật kiểm chứng, bộ test).
> Không cài đặt, không chạy worker, không thêm tính năng mới ở đây. Hàng đợi `docproc` trong
> bảng `jobs` không còn được worker TypeScript ghi vào.

Chuyển DOCX / HTML / PDF (text layer hoặc scan) của văn bản quy phạm pháp luật
sang **Markdown mở rộng chuẩn nội bộ** (ke-hoach/03 §4), giữ bảng biểu, công thức
và hình ảnh, và **không ngắt câu, ngắt đoạn khi văn bản chạy qua trang**
(ke-hoach/05 §4.2).

Đặc tả: `ke-hoach/05-ocr-va-chuyen-doi-ai.md`, `ke-hoach/03-mo-hinh-du-lieu.md` §4,
`ke-hoach/01-nen-tang-phap-ly.md` §5.

---

## 1. Cài đặt

Môi trường tham chiếu: Python 3.12, CPU, không GPU, không `uv`.

```bash
cd services/docproc
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

> **Máy không có `ensurepip`** (Debian/Ubuntu thiếu gói `python3.12-venv`, không có
> quyền `sudo`): tạo venv rỗng rồi cài bằng `pip` của hệ thống, chỉ định trình
> thông dịch đích:
>
> ```bash
> python3 -m venv --without-pip .venv
> python3 -m pip --python .venv/bin/python install -r requirements.txt
> ```
>
> (Lưu ý thứ tự: `--python` phải đứng **trước** tên lệnh con `install`.)

Kiểm tra:

```bash
.venv/bin/python -m pytest        # bộ kiểm thử
.venv/bin/python -m docproc route tests/fixtures/nghi-dinh-45-2026-nd-cp.pdf
```

Tổng dung lượng gói bắt buộc ≈ 175 MB. Không gói nào vượt 300 MB.

## 2. Dùng dòng lệnh

```bash
# Phân loại đầu vào (tuyến A/B/C/D/E) + độ tin cậy + lý do
python -m docproc route <file>

# Chuyển đổi; ghi document.md, assets.json, result.json vào <dir>
python -m docproc convert <file> --out <dir>
python -m docproc convert <file> --out <dir> --print          # in Markdown ra stdout
python -m docproc convert <file> --out <dir> --llm            # gọi thêm agent AI
python -m docproc convert <file> --out <dir> --window-size 6 --overlap 1

# Worker hàng đợi `docproc`
python -m docproc worker
python -m docproc worker --max-jobs 1 --queue docproc
```

Mã thoát của `convert`: `0` khi điểm chất lượng ≥ 0,8; `2` khi thấp hơn (để CI/cron
phát hiện văn bản cần biên tập).

Tệp đầu ra trong `--out`:

| Tệp | Nội dung |
|-----|----------|
| `document.md` | Markdown chuẩn nội bộ (front matter + marker nút) |
| `assets.json` | Danh sách `assets` (bảng/hình/công thức) để nạp vào bảng `assets` |
| `result.json` | Tuyến, độ tin cậy, điểm chất lượng, cảnh báo, `corrections`, `open_state`, các dòng đã loại |
| `assets/` | Hình trích từ tệp gốc |
| `pages/` | Ảnh trang 300 DPI (chỉ tuyến D/E) |

## 3. Kiến trúc

```
router.py            phân loại đầu vào -> Route A/B/C/D/E + confidence + lý do
extract_docx.py      tuyến A: DOCX -> Markdown (bảng GFM, gộp ô -> <table>)
extract_html.py      tuyến B: HTML có cấu trúc -> Markdown
extract_pdf_text.py  tuyến C: PDF có text layer -> PageChunk (qua layout engine)
preprocess.py        tuyến D/E: PDF -> ảnh 300 DPI, khử nghiêng/nhiễu, nhị phân hóa,
                     phát hiện header/footer/số trang lặp theo vị trí + tần suất
ocr.py               OcrEngine: Tesseract (vie) + PaddleOCR (vi); bỏ phiếu mức dòng
layout.py            LayoutEngine: PyMuPDF (mặc định) / Docling / Marker
stitch.py            ⭐ bộ ghép: nối câu/đoạn/bảng qua trang, cửa sổ trang chồng lấn
ai_convert.py        agent LLM tái cấu trúc theo cửa sổ, structured output
llm.py               LlmClient: Anthropic thật + mock/replay cache đĩa
markdown.py          dựng Markdown chuẩn nội bộ (marker nút, assets)
formula.py           nhận diện công thức -> LaTeX + diễn giải cho RAG
verify.py            kiểm chứng tự động, điểm chất lượng 0..1
pipeline.py          điều phối: route -> trích -> ghép -> dựng -> kiểm chứng
worker.py            worker hàng đợi `docproc` (Postgres, FOR UPDATE SKIP LOCKED)
cli.py               giao diện dòng lệnh
prompts/             prompt có phiên bản (convert_window.v1.yaml)
```

### Bộ ghép (`stitch.py`) — phần quan trọng nhất

Mã hóa đúng 5 quy tắc cơ học của ke-hoach/05 §4.2:

1. **Nối câu qua trang** — dòng cuối trang không kết thúc bằng `.` `;` `:` và dòng
   đầu trang sau không phải nhãn (`Điều`, `Chương`, `số.`, `chữ cái)`) → nối cùng
   đoạn, thay ngắt dòng bằng dấu cách.
2. **Bỏ rác đầu/cuối trang** — số trang, "CÔNG BÁO/Số …", header cơ quan lặp (phát
   hiện theo vị trí + tần suất ≥ 60% số trang). Khối **"Nơi nhận"/chữ ký được giữ**.
3. **Bảng qua trang** — cùng số cột và không có tiêu đề bảng mới → nối hàng; hàng
   tiêu đề lặp ở đầu trang sau bị bỏ.
4. **Khoản/điểm dang dở** — giữ nút đang mở, không tạo nút mới.
5. **Gạch nối OCR** — tiếng Việt không gạch nối khi ngắt dòng; `đầu-` + `tư` → `đầutư`.

Ngoài ra `build_windows` / `merge_windows` thực hiện **cửa sổ trang chồng lấn**
(4–6 trang, chồng 1 trang) và hợp nhất bằng so khớp mờ (`difflib`) trên trang
chồng lấn, ưu tiên bản của cửa sổ sau, không chèn ngắt đoạn khi `open_state` báo
câu chưa kết thúc.

## 4. LLM và cache

`llm.py` là bản Python của `packages/llm` (TypeScript).

* Có `ANTHROPIC_API_KEY` → `AnthropicProvider`:
  * `claude-opus-5` cho tuyến D/E và bước kiểm chứng; `claude-sonnet-5` cho tuyến C
    (đặt qua `LLM_MODEL_HEAVY` / `LLM_MODEL_BULK`);
  * `thinking: {"type": "adaptive"}`, `output_config.effort` (`high` cho D/E,
    `medium` cho C);
  * **prompt caching**: quy tắc + few-shot đặt trước, `cache_control: ephemeral` ở
    khối ổn định, phần biến đổi (ảnh trang, layout) đặt sau;
  * **structured output** `output_config.format` với schema
    `{markdown, open_state, tables, corrections, warnings}`;
  * streaming (`beta.messages.stream` + `get_final_message`) để không timeout khi
    `max_tokens` lớn, kèm `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`);
  * **Batch API** cho backfill: `submit_batch` / `fetch_batch` (giảm 50% chi phí;
    Batch API không nhận `fallbacks` nên lô chạy không có fallback).
* Không có khóa → `MockProvider`: đọc/ghi cache đĩa `LLM_CACHE_DIR`
  (mặc định `./data/llm-cache`), không có bản ghi thì sinh kết quả tất định để
  pipeline vẫn chạy end-to-end.

**Cache LLM.** `request_hash` băm đúng danh sách trường như `requestHash` trong
`packages/llm/src/mock.ts` (`tier`, `promptName`, `promptVersion`, `system`,
`cacheableSystem`, `user`, hash của ảnh/PDF/docs, `jsonSchema`). Khác biệt: bên
TypeScript dùng `Bun.hash`, bên Python dùng `sha256`; vì vậy tệp cache Python có
tiền tố `py-` (`convert_window.py-<hash>.json`) để hai phía không lẫn bản ghi của
nhau. Muốn dùng chung một kho cache thì phải thống nhất một hàm băm ở cả hai phía.

## 5. Engine nặng (Docling / Marker / PaddleOCR)

Mặc định chạy **engine nhẹ** (`PyMuPDF` cho layout, không OCR) để hoạt động được
trên máy không GPU. Ba engine nặng đã có adapter đầy đủ theo `LayoutEngine` /
`OcrEngine`, import bên trong hàm và kiểm tra khả dụng lúc chạy:

```bash
# Chỉ cài trên máy có GPU và đĩa trống (mỗi gói vài GB)
.venv/bin/pip install -r requirements-heavy.txt

export DOCPROC_LAYOUT_ENGINE=docling      # hoặc marker
export DOCPROC_OCR_ENGINES=paddleocr,tesseract
```

* **Docling** (`docling`) — phân vùng layout, TableFormer, thứ tự đọc; kéo theo
  torch (~3 GB đĩa). Bật bằng `DOCPROC_LAYOUT_ENGINE=docling`.
* **Marker** (`marker-pdf`) — trích LaTeX tốt hơn cho trang có công thức; cần GPU.
  Bật bằng `DOCPROC_LAYOUT_ENGINE=marker`.
* **PaddleOCR** (`paddlepaddle` + `paddleocr`, mô hình `vi`) — engine OCR chính.
* **Tesseract** — engine dự phòng, cài ở mức hệ điều hành:
  `sudo apt install tesseract-ocr tesseract-ocr-vie` (không cài trong repo này).

Khi có ≥ 2 engine OCR, `ocr.vote_lines` **bỏ phiếu ở mức dòng**: gom dòng theo
chồng lấn trục y, chọn chuỗi được nhiều engine đồng ý, hòa phiếu thì lấy dòng có
confidence cao nhất.

Nếu engine được yêu cầu không khả dụng, `get_layout_engine` / `recognize_page`
**ném lỗi kèm hướng dẫn cài** thay vì âm thầm chạy sai.

## 6. Worker và giao diện job với TypeScript

Worker Python lấy job giống hệt `claimJob` trong `packages/db/src/repo.ts`:

```sql
UPDATE jobs SET state='active', attempts=attempts+1, started_at=now()
WHERE id = (SELECT id FROM jobs
            WHERE queue = ANY($1) AND state='pending' AND run_after <= now()
            ORDER BY priority DESC, id ASC
            FOR UPDATE SKIP LOCKED LIMIT 1)
RETURNING ...
```

nên worker TypeScript và Python chạy song song an toàn.

### Payload job (`jobs.payload`, hàng đợi `docproc`)

```jsonc
{
  "inputPath":  "raw/congbao/45-2026-nd-cp.pdf", // BẮT BUỘC. Tuyệt đối, hoặc tương đối STORAGE_DIR
  "outputDir":  "out/6f0c…",                     // tùy chọn, mặc định "out/{documentId|jobId}"
  "documentId": "6f0c…-uuid",                    // tùy chọn, ghi vào pipeline_runs.document_id
  "sourceRecordId": "1a2b…-uuid",                // tùy chọn, để truy nguồn
  "useLlm":     true,                            // mặc định false; bắt buộc cho tuyến D/E
  "windowSize": 5,                               // 4–6 trang mỗi cửa sổ
  "overlap":    1,                               // số trang chồng lấn
  "dpi":        300,                             // DPI render ảnh trang
  "keepRunningHeads": false,                     // giữ header/footer lặp (để so sánh)
  "promptVersion": "v1"                          // ghi vào pipeline_runs.prompt_version
}
```

Chấp nhận cả dạng `snake_case` (`input_path`, `output_dir`, `document_id`).

### Kết quả

* Ghi `document.md`, `assets.json`, `result.json` (+ `assets/`, `pages/`) vào
  `STORAGE_DIR/outputDir`.
* Thêm một hàng `pipeline_runs` với `step='convert'`, `route`, `status`
  (`ok` khi điểm ≥ 0,95, ngược lại `needs_review`), `prompt_version`, `duration_ms`,
  `warnings`.
* Cập nhật `jobs`: `done` khi thành công; khi lỗi thì `pending` + lùi lịch
  `now() + 1 phút × attempts`, hết `max_attempts` thì `dead` (giống `finishJob`).

Phía TypeScript chỉ cần đẩy job và, sau khi job `done`, đọc `document.md` +
`assets.json` để tạo `document_versions` (`markdown`, `quality`, `provenance`) và
`assets`. `result.json.quality` đã đúng dạng để đưa thẳng vào
`document_versions.quality`.

Đẩy job từ Python (tiện cho vận hành):

```python
import psycopg
from docproc.worker import enqueue

with psycopg.connect(DATABASE_URL, autocommit=True) as conn:
    enqueue(conn, {"inputPath": "raw/45-2026-nd-cp.pdf", "documentId": doc_id})
```

## 7. Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|------|----------|---------|
| `DATABASE_URL` | — | Postgres cho worker (bắt buộc khi chạy `worker`) |
| `STORAGE_DIR` | `./data` | Gốc cho đường dẫn tương đối trong payload |
| `ANTHROPIC_API_KEY` | — | Trống → provider mock/replay |
| `LLM_PROVIDER` | `auto` | `auto` \| `anthropic` \| `mock` |
| `LLM_MODEL_HEAVY` | `claude-opus-5` | Tuyến D/E, kiểm chứng |
| `LLM_MODEL_BULK` | `claude-sonnet-5` | Tuyến C |
| `LLM_CACHE_DIR` | `./data/llm-cache` | Kho cache mock/replay |
| `DOCPROC_LAYOUT_ENGINE` | `pymupdf` | `pymupdf` \| `docling` \| `marker` |
| `DOCPROC_OCR_ENGINES` | `paddleocr,tesseract` | Danh sách engine OCR ưu tiên |
| `TESSERACT_BIN` | `tesseract` | Đường dẫn binary Tesseract |
| `DOCPROC_MIN_CHARS_PER_PAGE` | `180` | Ngưỡng text layer để vào tuyến C |
| `DOCPROC_MIN_TEXT_PAGE_RATIO` | `0.7` | Tỷ lệ trang có text tối thiểu |
| `DOCPROC_MIN_SCAN_DPI` | `200` | Dưới ngưỡng → nghi scan chất lượng thấp |
| `DOCPROC_MIN_OCR_CONFIDENCE` | `0.72` | Dưới ngưỡng → tuyến E |

## 8. Kiểm chứng chất lượng (`verify.py`)

Điểm 0..1 theo trọng số, ghi vào `document_versions.quality`:

| Phép kiểm | Trọng số | Ngưỡng |
|-----------|----------|--------|
| Điều liên tục, không trùng/thiếu (chấp nhận "Điều 12a") | 0,22 | sai → cảnh báo |
| Khoản liên tục (1, 2, 3…; chấp nhận "2a") | 0,13 | |
| Điểm liên tục theo a, b, c, d, đ, e, g… (không f, j, w, z) | 0,13 | |
| Đối chiếu độ dài Markdown ↔ ký tự trích được | 0,14 | ±8% |
| Số bảng và số hàng/cột khớp layout | 0,12 | ±1 |
| LaTeX parse được (cân bằng `$`, `{}`, đối số `\frac`) | 0,08 | |
| Tỷ lệ "từ lạ" (kiểm tra cấu trúc âm tiết tiếng Việt) | 0,10 | > 0,5% → review |
| Có khối "Nơi nhận"/chữ ký, tên người ký khớp metadata | 0,08 | |
| Đối chiếu bản tham chiếu (HTML/DOCX) nếu có | ×0,8 khi sai | similarity ≥ 0,985 |

`needs_review = score < 0,95` hoặc có bất kỳ cảnh báo nào.

## 9. Dữ liệu thử

`tests/fixtures/nghi-dinh-45-2026-nd-cp.pdf` (5 trang) do
`tools/make_fixture_pdf.py` sinh bằng PyMuPDF + font DejaVu (hỗ trợ tiếng Việt).
Cố ý chứa: câu bị ngắt qua ba ranh giới trang, điểm `d)` mở ở cuối trang 3 và tiếp
tục ở trang 4, bảng 4 cột bị cắt qua trang 4→5 với hàng tiêu đề lặp, điểm
`a) b) c) d) đ)`, một công thức, header "CÔNG BÁO/Số 123 + 124" và số trang ở mọi
trang, khối "Nơi nhận" + chữ ký cuối văn bản.

Sinh lại:

```bash
.venv/bin/python tools/make_fixture_pdf.py tests/fixtures/nghi-dinh-45-2026-nd-cp.pdf
```

## 10. Kiểm thử

```bash
.venv/bin/python -m pytest                      # tất cả
.venv/bin/python -m pytest -m "not integration" # bỏ qua bài cần Postgres/Tesseract
```

Bài kiểm thử cần dịch vụ ngoài (Postgres ở `DATABASE_URL`, Tesseract) tự bỏ qua
khi dịch vụ không có, kèm lý do rõ ràng.
