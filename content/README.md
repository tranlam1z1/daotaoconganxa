# Nội dung biên tập (content/)

Thư mục này chứa **nội dung do người biên soạn tạo ra**: phân loại lĩnh vực, chuyên đề đào tạo và thư viện trường hợp ứng dụng. Đây là dữ liệu dạng tệp, sẽ được nạp vào cơ sở dữ liệu qua script seed.

Phân biệt với các thư mục khác:

| Thư mục | Chứa gì |
|---------|---------|
| `data/` | Văn bản quy phạm pháp luật đã số hóa (dữ liệu gốc, không phải nội dung biên tập) |
| `prompts/` | Prompt sản xuất, có phiên bản |
| `evals/` | Bộ dữ liệu vàng và script đánh giá |
| **`content/`** | **Nội dung biên tập: taxonomy, chuyên đề, trường hợp ứng dụng** |

---

## 1. Cấu trúc thư mục

```
content/
├── README.md                       tệp này
├── taxonomy.json                   cây phân loại lĩnh vực văn bản (166 bản ghi)
├── linh-vuc.json                   cây đào tạo: lĩnh vực → nhóm đối tượng → chuyên đề
├── courses/
│   └── dau-tu-cntt-nsnn/           bản thảo của chuyên đề dau-tu-cntt-ngan-sach-nha-nuoc
│       ├── course.json             metadata chuyên đề, bản đồ pháp lý, lộ trình bài học
│       ├── vi-du-du-an.md          ví dụ xuyên suốt dùng chung cho 12 bài
│       ├── doi-chieu-nd45-nd224.md bảng đối chiếu hai nghị định
│       ├── 01-…md … 12-…md         12 bản thảo bài học
│       └── bieu-mau/               06 biểu mẫu
└── use-cases/
    └── uc-cntt-0001…0010.yaml      10 trường hợp ứng dụng
```

`taxonomy.json` phân loại **văn bản**; `linh-vuc.json` phân loại **nội dung đào tạo**. Hai cây khác nhau và không trộn vào nhau.

---

## 2. `taxonomy.json`

Khớp bảng `taxonomy` trong `packages/db/migrations/0001_init.sql`: `(code, parent_code, name, kind, ordinal)`.

| `kind` | Số bản ghi | Tiền tố mã | Nguồn |
|--------|-----------|------------|-------|
| `chu_de` | 45 | `PD.01` … `PD.45` | Điều 7 Pháp lệnh pháp điển hệ thống quy phạm pháp luật số 03/2012/UBTVQH13, đối chiếu dữ liệu vận hành của phapdien.moj.gov.vn |
| `de_muc` | 32 | `PD.xx.yyy` | Dữ liệu vận hành phapdien.moj.gov.vn, bản cập nhật 30/6/2026 |
| `nhanh_noi_bo` | 89 | `NB.…` | Biên tập nội bộ, bám cấu trúc Nghị định 45/2026/NĐ-CP, Luật Đầu tư công, Luật Đấu thầu, Luật Ban hành văn bản quy phạm pháp luật |

Hiện chỉ nạp đề mục của **04 chủ đề** liên quan trực tiếp tới phạm vi giai đoạn 1: chủ đề 3 (Bưu chính, viễn thông), 19 (Khoa học, công nghệ), 26 (Tài chính), 34 (Thương mại, đầu tư, chứng khoán). Các chủ đề còn lại mới có bản ghi cấp chủ đề.

Nhánh nội bộ gồm 7 nhánh gốc: `NB.CNTT` (công nghệ thông tin và chuyển đổi số), `NB.DTC` (đầu tư công), `NB.DT` (đấu thầu), `NB.NSNN` (ngân sách nhà nước), `NB.KHCN` (khoa học, công nghệ), `NB.DP` (văn bản địa phương), `NB.BHVB` (ban hành văn bản quy phạm pháp luật).

**Quy tắc mở rộng**: mã đã cấp thì không đổi, không tái sử dụng. Thêm nhánh mới ở cuối cấp tương ứng, `ordinal` tăng dần. Mọi bản ghi phải có `parent_code` tồn tại (trừ cấp gốc).

---

## 3. Chuyên đề đào tạo (`courses/`)

Mỗi chuyên đề là một thư mục. `course.json` khớp bảng `courses`; mỗi bài học khớp một bản ghi của bảng `lessons`.

### 3.0 Vị trí của chuyên đề trong cây đào tạo

`linh-vuc.json` khai báo ba bậc **lĩnh vực → nhóm đối tượng → chuyên đề** (ke-hoach/09 §1), và hai quan hệ giữa các chuyên đề: `noi_tiep_tu` (chuyên đề sau tiếp tục công việc của chuyên đề trước trên cùng một hồ sơ) và `cha` (chuyên đề con thu hẹp phạm vi của chuyên đề cha). Hai nhóm đối tượng: `khach_hang` — người trực tiếp áp dụng quy định; `tu_van` — người tư vấn và đào tạo lại cho nhóm trên.

Lĩnh vực `dau-tu-cong-nsnn` gồm bốn chuyên đề: *Lập dự án đầu tư sử dụng ngân sách Nhà nước*, *Thực hiện dự án đầu tư sử dụng ngân sách Nhà nước* (nối tiếp), *Dự án đầu tư công nghệ thông tin sử dụng ngân sách Nhà nước* (cụ thể hoá) và *Tư vấn đầu tư và phương pháp sư phạm cho người đi tư vấn* (nhóm `tu_van`). Chỉ chuyên đề thứ ba có thư mục nội dung; ba chuyên đề còn lại mới có lộ trình.

Gói 12 bản thảo trong `courses/dau-tu-cntt-nsnn/` được viết khi phạm vi còn là một chuyên đề gộp. Phần trình tự dùng chung cho mọi loại dự án đầu tư công là **nguồn** để viết hai chuyên đề chung, và khi viết lại thì căn cứ phải chuyển sang Luật Đầu tư công, Luật Đấu thầu, Luật Ngân sách nhà nước — không sao chép nguyên viện dẫn của nghị định về đầu tư ứng dụng công nghệ thông tin. Chi tiết ở trường `tach_chuyen_de` của `course.json`.

### 3.1 Cấu trúc một bài học

Mỗi tệp bài học có frontmatter YAML (`course`, `slug`, `ordinal`, `title`, `as_of`, `status`, `review_state`) và mười phần theo đúng thứ tự:

1. Khối cảnh báo `as_of`, trạng thái duyệt và **cảnh báo hiệu lực**
2. `## Mục tiêu bài học` — động từ hành vi quan sát được
3. `## Căn cứ pháp lý của bài học` — bảng viện dẫn dạng đầy đủ
4. `## Nội dung` — các tiểu mục, kết thúc bằng "Những điểm dễ nhầm"
5. `## Áp dụng cho dự án ví dụ` — có bảng và phân tích độ nhạy
6. `## Hoạt động thực hành` — 02 hoạt động, mỗi hoạt động đủ 06 thành phần
7. `## Câu hỏi kiểm tra` — 05 câu (02 cơ bản, 02 trung bình, 01 tình huống)
8. `## Tóm tắt` — mỗi gạch đầu dòng kèm viện dẫn dạng ngắn

### 3.2 Ví dụ xuyên suốt

Toàn bộ 12 bài dùng chung một ví dụ: dự án "Hệ thống quản lý nhiệm vụ khoa học và công nghệ cấp
tỉnh", chủ đầu tư Sở Khoa học và Công nghệ tỉnh T, tổng mức đầu tư 14.500.000.000 đồng, 08 nhóm chức
năng, 13 tác nhân, dự án nhóm C, thiết kế 01 bước. Dữ kiện gốc nằm ở `vi-du-du-an.md`.

**Không được đổi dữ kiện của ví dụ** khi viết bài mới. Nếu cần biến thể để phân tích độ nhạy thì ghi
rõ đó là biến thể, ví dụ bài 07 đổi tổng mức đầu tư thành 26 tỷ đồng để chuyển sang thiết kế 02 bước.

Ví dụ là **tình huống minh họa được xây dựng cho mục đích đào tạo**. Tên cơ quan, số liệu và tình
huống là giả định, không phải hồ sơ của một dự án có thật.

---

## 4. Trường hợp ứng dụng (`use-cases/`)

Mỗi tệp YAML khớp một bản ghi của bảng `use_cases`, cấu trúc theo `ke-hoach/08-truong-hop-ung-dung.md` §3.

Các trường bắt buộc: `slug`, `title`, `taxonomy_codes`, `actor_kinds`, `work_kinds`, `as_of`,
`situation`, `questions`, `analysis`, `conclusion`, `procedure`, `risks`, `status`, `citation_health`.

Giá trị hợp lệ:

- `actor_kinds`: `co_quan_nha_nuoc`, `don_vi_su_nghiep`, `doanh_nghiep_nha_nuoc`, `doanh_nghiep_tu_nhan`, `ho_kinh_doanh`, `ca_nhan`, `to_chuc_tu_van`, `nha_thau`
- `work_kinds`: `thu_tuc_hanh_chinh`, `nghia_vu_tuan_thu`, `quyen_loi`, `xu_phat_che_tai`, `hop_dong`, `tranh_chap`, `lap_ke_hoach_du_an`, `bao_cao_dinh_ky`
- `status`: `draft`, `published`, `needs_update`
- `citation_health`: `ok`, `changed`, `repealed`

Yêu cầu chất lượng với mỗi trường hợp ứng dụng:

- `situation` **đã ẩn danh hóa**: dùng "Sở X", "tỉnh T", "đơn vị Y"; không dùng tên thật.
- Mỗi bước trong `analysis` có `claim`, `citations`, `quote` (trích nguyên văn) và `reasoning`.
- Bước cuối của `analysis` dẫn thẳng tới `conclusion`.
- Mỗi bước trong `procedure` có `authority` và `timeline`; nếu văn bản không quy định thời hạn thì ghi rõ "Văn bản không quy định thời hạn cho bước này".
- `risks` có `consequence` (hệ quả pháp lý) và `mitigation` (cách phòng tránh).
- `gaps` liệt kê mọi chỗ thiếu căn cứ. **Bỏ trống `gaps` khi thực sự còn thiếu là lỗi nặng.**

Mười trường hợp hiện có bao phủ: thiết kế 01 bước hay 02 bước; phân loại dự án đầu tư hệ thống với
dự án mua sắm; vốn hỗn hợp; chi phí vận hành sau bàn giao; phần mềm phổ biến; thẩm quyền thẩm định
thiết kế và xung đột lợi ích; bảo hành; bàn giao mã nguồn; chuyển tiếp giữa hai nghị định; phân định
vốn đầu tư công với kinh phí chi thường xuyên.

---

## 5. Quy ước viện dẫn

Áp dụng cho **mọi** nội dung trong thư mục này. Chuẩn theo `ke-hoach/01-nen-tang-phap-ly.md` §6.

### 5.1 Ba dạng viện dẫn

**Dạng đầy đủ** — dùng trong bảng "Căn cứ pháp lý của bài học" và trong phần căn cứ của văn bản chính thức:

```
điểm a khoản 2 Điều 9 Nghị định số 45/2026/NĐ-CP ngày 26/01/2026 của Chính phủ quy định quản lý
đầu tư ứng dụng công nghệ thông tin sử dụng nguồn vốn ngân sách nhà nước
```

Trật tự: điểm → khoản → Điều → tên loại văn bản → **số** ký hiệu → **ngày** ban hành → **của** cơ quan ban hành → trích yếu.

**Dạng ngắn** — dùng trong thân bài, đặt trong ngoặc đơn:

```
(khoản 2 Điều 9 Nghị định 45/2026/NĐ-CP)
```

**Dạng máy (URN)** — dùng trong trường `citations` của YAML và JSON:

```
vn:vbqppl:nd:45/2026/NĐ-CP#dieu-9.khoan-2.diem-a@2026-03-01
```

Hậu tố `@ngày` là ngày mà nội dung nút được xác nhận đúng, thường là ngày văn bản có hiệu lực hoặc
ngày `as_of` của nội dung biên tập.

### 5.2 Quy tắc hình thức

- Viết hoa chữ Đ trong `Điều`; viết thường `khoản`, `điểm`.
- Không viết `Điều 9.2`, `Đ.9 K.2`, `Điều 9 khoản 2` (sai trật tự).
- Dạng đầy đủ **phải có** ngày ban hành, cơ quan ban hành và trích yếu.
- Chữ `Đ` trong số ký hiệu phải là ký tự `Đ` (U+0110), không phải `Ð` (U+00D0).
- Số tiền kiểu Việt Nam: `20 tỷ đồng`, `14,5 tỷ đồng`, `14.500.000.000 đồng`. Dấu phẩy là dấu thập phân.
- Ngày tháng: `01/3/2026` hoặc `ngày 26 tháng 01 năm 2026` theo cách viết của văn bản gốc.

### 5.3 Quy tắc `[CẦN ĐỐI CHIẾU]` — bắt buộc

> **Không bao giờ ghi một số điều mà người biên soạn chưa đối chiếu với toàn văn văn bản.**

Khi cần nhắc tới một quy định mà chưa xác minh được số điều, khoản, điểm, số hiệu văn bản hoặc ngày
ban hành, ghi theo mẫu:

```
[CẦN ĐỐI CHIẾU: <mô tả cụ thể điều cần tra>]
```

Ví dụ đúng:

```
[CẦN ĐỐI CHIẾU: số hiệu nghị định về bảo đảm an toàn hệ thống thông tin theo cấp độ đang có hiệu lực]
[CẦN ĐỐI CHIẾU: nguyên văn từng điểm a đến k khoản 6 Điều 19 Nghị định số 45/2026/NĐ-CP]
```

Mô tả phải đủ cụ thể để người tra cứu biết phải mở văn bản nào và tìm gì. Ghi `[CẦN ĐỐI CHIẾU]` trống
hoặc mơ hồ là không đạt.

Một tài liệu trung thực về chỗ chưa rõ thì hữu ích hơn một tài liệu điền đầy số điều do phỏng đoán.
Mọi dấu `[CẦN ĐỐI CHIẾU]` phải được xử lý hết trước khi chuyển trạng thái sang `published`.

---

## 6. Cảnh báo hiệu lực đang áp dụng cho toàn bộ chuyên đề

Lĩnh vực đầu tư ứng dụng công nghệ thông tin thay đổi hai lần trong năm 2026:

```
Nghị định 73/2019/NĐ-CP + Nghị định 82/2024/NĐ-CP
        │  bị thay thế từ 01/3/2026
        ▼
Nghị định 45/2026/NĐ-CP        hiệu lực 01/3/2026 → 30/6/2026
        │  bị thay thế từ 01/7/2026 (điểm a khoản 2 Điều 90 Nghị định 224/2026/NĐ-CP)
        ▼
Nghị định 224/2026/NĐ-CP       hiệu lực từ 01/7/2026
```

Ở tầng luật, **Luật Chuyển đổi số số 148/2025/QH15** (hiệu lực 01/7/2026) làm **Luật Công nghệ thông
tin số 67/2006/QH11 hết hiệu lực** kể từ ngày 01/7/2026 (khoản 2 Điều 47 Luật số 148/2025/QH15).

Chuyên đề `dau-tu-cntt-nsnn` trình bày chi tiết theo **Nghị định số 45/2026/NĐ-CP** vì đây là văn bản
đã được đối chiếu toàn văn 43 điều và là văn bản áp dụng cho **nhóm dự án chuyển tiếp** theo khoản 2
Điều 91 Nghị định số 224/2026/NĐ-CP. Tệp `doi-chieu-nd45-nd224.md` cung cấp bảng đối chiếu điều theo
điều sang văn bản hiện hành.

**Việc phải làm trước khi xuất bản cho học viên**: bổ sung nội dung chi tiết của Nghị định số
224/2026/NĐ-CP, Thông tư số 39/2026/TT-BKHCN và Thông tư số 41/2026/TT-BKHCN.

---

## 7. Quy trình biên tập và trạng thái duyệt

### 7.1 Vòng đời một đơn vị nội dung

```
draft  ──► review_bien_tap  ──► cho_phap_che_duyet  ──► published
  ▲                                                        │
  └──────────────── needs_update ◄─────────────────────────┘
                    (khi citation_health != ok)
```

| Trạng thái | Nghĩa | Ai chuyển tiếp |
|-----------|-------|----------------|
| `draft` | Bản nháp, có thể do AI dựng hoặc biên tập viên viết | Biên tập viên |
| `review_bien_tap` | Đang được biên tập viên rà nội dung nghiệp vụ và văn phong | Biên tập viên |
| `cho_phap_che_duyet` | Nội dung đã ổn, chờ pháp chế kiểm tra căn cứ | Pháp chế |
| `published` | Đã duyệt, hiển thị cho người dùng | Pháp chế |
| `needs_update` | Căn cứ đã thay đổi, cần rà lại | Hệ thống tự đặt qua `citation_health` |

**Toàn bộ nội dung hiện tại đang ở `draft` và `review_state: cho_phap_che_duyet`.**

### 7.2 Điều kiện để pháp chế duyệt

Một đơn vị nội dung chỉ được chuyển sang `published` khi đủ **tất cả** các điều kiện:

1. Không còn dấu `[CẦN ĐỐI CHIẾU]` nào.
2. Mọi URN trong `citations` tồn tại trong cơ sở dữ liệu và có hiệu lực tại `as_of`.
3. Mọi đoạn trích nguyên văn khớp từng ký tự với nội dung nút trong cơ sở dữ liệu.
4. Mọi khẳng định pháp lý đều có viện dẫn; không có câu khẳng định trần.
5. `as_of` phản ánh đúng ngày căn cứ được xác nhận, không phải ngày viết.
6. Trạng thái hiệu lực của mọi văn bản được viện dẫn đã được kiểm tra tại `as_of`.
7. Không trình bày quy định đã bị bãi bỏ như đang còn hiệu lực; nếu dùng để so sánh cũ với mới thì ghi rõ trạng thái.
8. Với bài học: câu hỏi kiểm tra có đáp án suy ra được từ căn cứ nêu trong bài; phương án nhiễu hợp lý.
9. Với trường hợp ứng dụng: `situation` đã ẩn danh hóa hoàn toàn.
10. Không có nội dung tư vấn cách lách quy định.

Người duyệt ghi tên vào `legal_reviewer` và ngày vào `reviewed_at`.

### 7.3 Theo dõi sau khi xuất bản

Mỗi `citation` lưu hash nội dung nút tại thời điểm viện dẫn. Job `citation_watch` chạy sau mỗi lần
hợp nhất văn bản:

| Kết quả | `citation_health` | Hành động |
|---------|-------------------|-----------|
| Hash không đổi | `ok` | Không làm gì |
| Hash đổi | `changed` | Tạo ticket rà lại; hiển thị banner "nội dung đang được rà soát" |
| Nút bị bãi bỏ | `repealed` | Cảnh báo công khai "căn cứ đã bị bãi bỏ"; chuyển `needs_update` |
| Nút không còn tồn tại | `missing` | Chặn hiển thị; tạo ticket ưu tiên cao |

Tái duyệt định kỳ 6 tháng, hoặc ngay khi `citation_health` khác `ok`.

---

## 8. Danh mục tự kiểm tra trước khi gửi pháp chế

- [ ] Không còn dấu `[CẦN ĐỐI CHIẾU]`, hoặc đã liệt kê đầy đủ trong phần bàn giao để pháp chế xử lý.
- [ ] Mọi viện dẫn đúng trật tự điểm → khoản → Điều → văn bản.
- [ ] Dạng đầy đủ có đủ ngày ban hành, cơ quan ban hành và trích yếu.
- [ ] Mọi URN đúng cú pháp `vn:vbqppl:{loai}:{so_ky_hieu}#{path}@{ngay}`.
- [ ] Mã trong `taxonomy_codes` đều tồn tại trong `taxonomy.json`.
- [ ] `as_of` được ghi ở đầu mọi tệp nội dung.
- [ ] Có khối cảnh báo trạng thái duyệt ở đầu mọi tệp bài học và biểu mẫu.
- [ ] Trích nguyên văn đặt trong khối `>` và không bị sửa một ký tự nào.
- [ ] Số tiền và ngày tháng theo quy ước Việt Nam.
- [ ] Tên cơ quan, cá nhân trong tình huống đã được ẩn danh hóa.
- [ ] Tệp JSON và YAML parse được (`bun -e` hoặc `python3 -c "import yaml"`).

Lệnh kiểm tra nhanh:

```bash
# JSON
bun -e 'await Bun.file("content/taxonomy.json").json(); await Bun.file("content/linh-vuc.json").json(); await Bun.file("content/courses/dau-tu-cntt-nsnn/course.json").json(); console.log("JSON hợp lệ")'

# YAML
python3 -c "import yaml,glob; [yaml.safe_load(open(f)) for f in glob.glob('content/use-cases/*.yaml')]; print('YAML hợp lệ')"

# Đếm các chỗ còn cần đối chiếu
grep -rc "CẦN ĐỐI CHIẾU" content/ | grep -v ':0'
```
