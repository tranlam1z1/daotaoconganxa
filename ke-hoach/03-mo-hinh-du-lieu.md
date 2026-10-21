# 03. Mô hình dữ liệu

Nguyên tắc: (a) văn bản là thực thể bất biến về danh tính, nội dung thay đổi theo **phiên bản**; (b) đơn vị nhỏ nhất có định danh là **nút cấu trúc**; (c) mọi quan hệ và trạng thái đều có **thời điểm hiệu lực**; (d) mọi nội dung đều truy ngược được **nguồn gốc**.

## 1. Định danh (URN)

```
vn:vbqppl:{doc_type}:{so_ky_hieu}            văn bản
vn:vbqppl:{doc_type}:{so_ky_hieu}#{node_path}  nút
vn:vbqppl:{doc_type}:{so_ky_hieu}#{node_path}@{YYYY-MM-DD}  nút tại thời điểm
vn:vbhn:{so_ky_hieu_vbhn}                    VBHN chính thức
vn:doc:{loai}:{so_ky_hieu}                   văn bản không phải QPPL (công văn, TCVN, án lệ…)
```

`node_path` dùng `ltree`: `phan-1.chuong-2.muc-1.dieu-15.khoan-2.diem-a`. Điều đánh số liên tục nên **path rút gọn** `dieu-15.khoan-2.diem-a` là khóa tra cứu chính; path đầy đủ chỉ để hiển thị mục lục.

Với văn bản có số ký hiệu trùng giữa các năm/cơ quan (địa phương), thêm mã cơ quan: `vn:vbqppl:qd-ubnd-t:12/2026/QĐ-UBND:thanh-hoa`.

## 2. Các bảng chính (PostgreSQL)

### 2.1 `documents` — danh tính văn bản
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid | |
| urn | text unique | |
| doc_type | text | mã loại (01 §2) |
| rank | int | thứ bậc hiệu lực |
| is_normative | bool | VBQPPL hay không |
| so_ky_hieu | text | "45/2026/NĐ-CP" |
| title | text | tên đầy đủ |
| short_title | text | "Nghị định 45/2026/NĐ-CP" |
| issuer_id | fk → `agencies` | cơ quan ban hành |
| signer | text | người ký, chức vụ |
| issued_date | date | ngày ban hành |
| effective_from | date | ngày có hiệu lực (bản gốc) |
| effective_to | date null | ngày hết hiệu lực toàn bộ |
| gazette_no, gazette_date | text, date | số/ngày Công báo |
| fields[] | text[] | lĩnh vực (mã đề mục Bộ pháp điển + taxonomy nội bộ) |
| status | enum | trạng thái hiện tại (tính từ nút, cache) |
| status_as_of | timestamptz | lần tính gần nhất |
| language | text | `vi`; văn bản song ngữ lưu `en` ở `document_translations` |
| summary | text | trích yếu |
| ai_summary | text | tóm tắt do AI sinh (có đánh dấu) |
| created_at, updated_at | | |

### 2.2 `document_versions` — nội dung theo thời điểm
| Cột | Ghi chú |
|-----|---------|
| id, document_id | |
| version_no | int, tăng dần |
| kind | `original` / `corrigendum` (đính chính) / `consolidated_official` (VBHN cơ quan) / `consolidated_auto` (hệ thống) / `reissue` |
| valid_from, valid_to | khoảng thời gian phiên bản này phản ánh đúng nội dung |
| basis_version_id | phiên bản gốc dùng để hợp nhất |
| applied_amendments[] | mảng id `amendment_ops` đã áp dụng |
| markdown_uri | S3 key bản Markdown đầy đủ |
| tree_uri | S3 key cây JSON |
| content_hash | sha256 |
| quality | jsonb: điểm OCR, số bảng, số công thức, số cảnh báo |
| provenance | jsonb: source_record_id, pipeline run id, model ids |
| reviewed_by, reviewed_at | duyệt biên tập |

### 2.3 `nodes` — nút cấu trúc (một hàng cho mỗi nút của mỗi phiên bản)
| Cột | Ghi chú |
|-----|---------|
| id | |
| version_id | fk |
| document_id | fk (denormalize để truy vấn nhanh) |
| path | `ltree` rút gọn (`dieu-15.khoan-2.diem-a`) |
| full_path | `ltree` đầy đủ có phần/chương/mục |
| kind | `phan`/`chuong`/`muc`/`tieu_muc`/`dieu`/`khoan`/`diem`/`doan`/`bang`/`cong_thuc`/`hinh`/`phu_luc`/`loi_noi_dau`/`can_cu`/`chu_ky` |
| label | "Điều 15", "2.", "a)" |
| heading | tiêu đề (điều, chương) |
| text_md | nội dung Markdown của riêng nút (không gồm con) |
| text_plain | để BM25 và embedding |
| ordinal | thứ tự trong cha |
| node_status | `active` / `amended` / `repealed` / `suspended` / `added` |
| status_since | ngày |
| status_source_op | fk → `amendment_ops` |
| stable_key | khóa ổn định qua các phiên bản (điều 15 khoản 2 ở v1 và v3 cùng `stable_key`) để nối lịch sử |
| page_refs | jsonb [{file, page, bbox}] để "xem bản gốc" |
| char_count, token_count | |

Chỉ mục: GIST trên `path`, btree `(document_id, stable_key)`, GIN trên `text_plain` (trgm) cho gợi ý.

### 2.4 `assets` — bảng, hình, công thức tách rời
| Cột | Ghi chú |
|-----|---------|
| id, node_id | |
| kind | `table` / `image` / `formula` |
| md | bảng dạng GFM/HTML, công thức LaTeX |
| image_uri | ảnh cắt từ trang gốc (luôn có, để đối chiếu) |
| caption | |
| extraction_confidence | 0..1 |
| needs_review | bool |

### 2.5 `relations` — quan hệ giữa văn bản / nút (đồ thị)
| Cột | Ghi chú |
|-----|---------|
| id | |
| from_urn, to_urn | có thể là văn bản hoặc nút |
| type | xem bảng 2.6 |
| effective_from, effective_to | |
| source | `vbpl` / `parsed` / `llm` / `editor` |
| confidence | |
| evidence | jsonb: đoạn trích, node_id nơi phát hiện |
| reviewed | bool |

### 2.6 Loại quan hệ (mở rộng từ 12 nhóm của vbpl.vn)
| type | Nghĩa (from → to) | Đối xứng |
|------|------------------|----------|
| `can_cu` | from căn cứ vào to | `la_can_cu_cua` |
| `huong_dan` | from quy định chi tiết/hướng dẫn to | `duoc_huong_dan_boi` |
| `sua_doi` | from sửa đổi, bổ sung to (cấp nút) | `bi_sua_doi_boi` |
| `bai_bo` | from bãi bỏ to (cấp nút hoặc văn bản) | `bi_bai_bo_boi` |
| `thay_the` | from thay thế to | `bi_thay_the_boi` |
| `dinh_chinh` | from đính chính to | |
| `hop_nhat` | VBHN from hợp nhất to | |
| `dinh_chi` | from đình chỉ/ngưng hiệu lực to | |
| `cong_bo_het_hieu_luc` | from công bố to hết hiệu lực | |
| `dan_chieu` | from dẫn chiếu to (trích dẫn trong nội dung) | `duoc_dan_chieu_boi` |
| `ap_dung_chuyen_tiep` | quy định chuyển tiếp cho phép tiếp tục áp dụng | |
| `cha_con` | văn bản cha (luật) → văn bản con (nghị định, thông tư) — suy ra từ `huong_dan` + `can_cu`, lưu tường minh để hiển thị cây | |

"Văn bản cha / văn bản con" theo yêu cầu: cha = văn bản có thứ bậc cao hơn mà văn bản này căn cứ hoặc quy định chi tiết; con = ngược lại. "Văn bản ảnh hưởng liên quan" = tập hợp `sua_doi`, `bai_bo`, `thay_the`, `dinh_chi`, `dinh_chinh`, `huong_dan`, `dan_chieu`.

### 2.7 `amendment_ops` — lệnh sửa đổi có cấu trúc
| Cột | Ghi chú |
|-----|---------|
| id | |
| amending_document_id, amending_node_id | văn bản/khoản chứa lệnh |
| target_document_id, target_stable_key | nút bị tác động |
| op | `replace` / `insert_after` / `insert_before` / `append_child` / `delete` / `repeal` / `suspend` / `rename` / `replace_phrase` |
| payload | jsonb: nội dung mới (Markdown), hoặc `{find, replace}` cho thay cụm từ, vị trí chèn |
| effective_from, effective_to | ngày hiệu lực lệnh (có thể khác ngày hiệu lực chung) |
| extraction | `llm` / `rule` / `editor` |
| confidence | |
| review_status | `pending` / `approved` / `rejected` / `needs_legal` |
| reviewer_id, reviewed_at, notes | |

### 2.8 `source_records`, `pipeline_runs`, `pipeline_steps`
Lưu URL nguồn, thời điểm cào, hash file, headers; mỗi bước xử lý (convert, parse, extract, consolidate, index) với model id, prompt version, token in/out, chi phí, thời gian, cảnh báo. Phục vụ audit và tính lại khi đổi mô hình.

### 2.9 Bảng nghiệp vụ khác
- `agencies` (cơ quan; hợp nhất tên theo lịch sử sáp nhập bộ 2025: Bộ TT&TT → Bộ KH&CN…), `agency_aliases`.
- `taxonomy` (chủ đề/đề mục Bộ pháp điển + nhánh nội bộ), `document_taxonomy`.
- `use_cases`, `use_case_citations` (08); `courses`, `lessons`, `lesson_citations`, `quizzes` (09).
- `citation_watch` (theo dõi nút được viện dẫn để cảnh báo khi đổi).
- `users`, `roles`, `review_queue`, `audit_log`.
- `embeddings` (`node_id`, `chunk_no`, `model`, `vector(1024)`, `text_hash`).

## 3. Trường thông tin "khoa học" của một văn bản (checklist hiển thị)

Nhóm định danh: số ký hiệu, loại, tên đầy đủ, URN, cơ quan ban hành, người ký, ngày ban hành, ngày ký (nếu khác), số/ngày Công báo, ngày đăng CSDL quốc gia, lĩnh vực, từ khóa, tình trạng dự thảo trước đó.

Nhóm hiệu lực: ngày có hiệu lực, ngày hết hiệu lực, trạng thái (6 loại), phạm vi áp dụng (địa bàn, đối tượng), quy định chuyển tiếp, lịch sử trạng thái (timeline).

Nhóm quan hệ: căn cứ; cha/con; sửa đổi/bị sửa đổi (đến cấp khoản); thay thế/bị thay thế; hướng dẫn/được hướng dẫn; dẫn chiếu/được dẫn chiếu; đính chính; đình chỉ; VBHN chính thức; bản hợp nhất tự động.

Nhóm phiên bản: danh sách phiên bản với khoảng thời gian, lý do (văn bản sửa đổi nào), diff.

Nhóm nguồn gốc: file gốc, trang, chất lượng OCR, ngày cào, kiểm duyệt bởi ai.

## 4. Định dạng Markdown mở rộng (chuẩn nội bộ)

```markdown
---
urn: vn:vbqppl:nd:45/2026/NĐ-CP
version: 1
valid_from: 2026-03-01
---
# NGHỊ ĐỊNH
## Quy định quản lý đầu tư ứng dụng công nghệ thông tin sử dụng nguồn vốn ngân sách nhà nước

<!-- node: can_cu -->
*Căn cứ Luật Tổ chức Chính phủ …;*

<!-- node: chuong-1 -->
## Chương I. QUY ĐỊNH CHUNG

<!-- node: dieu-1 -->
### Điều 1. Phạm vi điều chỉnh
<!-- node: dieu-1.khoan-1 -->
1. Nghị định này quy định …
<!-- node: dieu-1.khoan-1.diem-a -->
   a) Dự án đầu tư …

<!-- node: phu-luc-1.bang-1 | asset: 7f3a… -->
| STT | Hạng mục | Định mức |
|-----|----------|----------|
| 1   | …        | …        |

<!-- node: phu-luc-2.cong-thuc-1 | asset: 9c1b… -->
$$ G_{PM} = \sum_{i=1}^{n} (E_i \times k_i) $$

<!-- node: phu-luc-3.hinh-1 | asset: 2d0e… -->
![Sơ đồ quy trình thẩm định](asset://2d0e…)
```

Quy tắc: marker HTML comment giữ mapping nút ↔ Markdown; nội dung hiển thị vẫn là Markdown thuần nên render được ở mọi nơi. Bảng phức tạp (gộp ô) dùng HTML `<table>` inline; luôn kèm ảnh gốc trong `assets`.

## 5. Chú thích hợp nhất (render theo NĐ 250/2026)

Nút bị sửa đổi khi render phiên bản `consolidated_*` sẽ có footnote:

```
2.[^3] Chủ đầu tư có trách nhiệm …
[^3]: Khoản này được sửa đổi theo quy định tại khoản 5 Điều 1 của Nghị định số …/2027/NĐ-CP ngày … , có hiệu lực kể từ ngày … .
```

Nút bị bãi bỏ: giữ nhãn, thân thay bằng "(được bãi bỏ)" + footnote. Nút bổ sung: label "Điều 12a" + footnote "được bổ sung theo…". Mẫu câu chú thích lấy đúng theo Phụ lục NĐ 250/2026 sau khi đội pháp lý đối chiếu.
