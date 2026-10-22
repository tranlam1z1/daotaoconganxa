# THIẾT KẾ TRÒ CHƠI — DANH SÁCH CŨ (LƯU TRỮ)

*Lưu ngày 27/9/2026, khi danh sách trò chơi được thay bằng 10 trò mới ở [../PRD.md](../PRD.md) mục V. Chỉ để tra lại quyết định và dữ liệu cần kiểm của các trò đã làm (Súng bắn tốc độ, Cung đường biển báo). Không còn là yêu cầu.*

*Ghi chú (21/10/2026): toàn bộ trò chơi và lớp trò chơi hóa (XP, cấp độ, huy hiệu, chuỗi ngày, bảng xếp hạng, mùa giải, thử thách hằng ngày) đã gỡ khỏi sản phẩm. Tài liệu này chỉ còn để tra lại, không phải yêu cầu.*

---


*Cho 10 trò chơi ở [PRD.md](../PRD.md) mục V. Lập ngày 25/9/2026. Chưa triển khai. Kế hoạch làm: [PLAN.md](../PLAN.md), GĐ-G0 đến GĐ-G10.*

---

## 0. Tóm tắt

1. **Phần nền đã có khá nhiều** (GĐ9–GĐ14): sổ XP chống cộng trùng, cấp độ, chuỗi ngày, huy hiệu, bảng xếp hạng tuần, 5 trò chơi nhỏ, luyện tập offline có đồng bộ chống trùng, đọc thành tiếng và nhận dạng giọng nói. Thiết kế này **mở rộng** phần đó, không làm lại.
2. **Thêm một bộ máy lượt chơi chung** (`game_runs` + `game_run_steps`). Mỗi trò chơi chỉ viết phần riêng: sinh lượt, dựng đề, chấm từng bước. Phần riêng này là mã TypeScript thuần trong `packages/dao-tao`, chạy được cả trên máy chủ và trên điện thoại khi offline.
3. **Nội dung trò chơi dùng chung một quy trình duyệt với câu hỏi.** Tình huống, cảnh đường phố, cây xử lý hiện trường nằm trong một bảng `game_content` có đúng vòng đời của `questions`. Dữ liệu tra cứu (mức phạt, biển báo, quy trình, tốc độ tối đa) **chuyển sang duyệt trong ứng dụng**, thay cho việc sửa trường `trang_thai` trong tệp JSON.
4. **Không sao chép nội dung.** Trò chơi trỏ tới câu hỏi, mức phạt, biển báo, điều khoản bằng mã; khi nội dung được trỏ tới rời trạng thái đã duyệt hoặc đổi phiên bản, tình huống dùng nó tự rút khỏi trò chơi cho tới khi được duyệt lại.
5. **Bốn trò khó nhất** là Chốt tuần tra, Cung đường biển báo (đồ họa, chuyển động), Đối đầu 1–1 (thời gian thực) và Mùa giải đơn vị (luật công bằng giữa đơn vị). Bốn trò dễ nhất dùng lại gần như toàn bộ phần đã có: Lệnh trực, Người vi phạm nói gì?, Bộ đàm, Lập biên bản.
6. Các điểm cần anh/chị quyết định ở §7.

---

## 1. Phần đã có và cách dùng lại

| Đã có | Ở đâu | Dùng cho |
|---|---|---|
| Ngân hàng câu hỏi, duyệt từng câu, 6 loại chấm máy | `questions`, `packages/dao-tao/src/cau-hoi.ts`, `packages/db/src/ngan-hang.ts` | Lệnh trực, Người vi phạm nói gì?, Bộ đàm, Đối đầu |
| Mức phạt theo hành vi và khoảng tốc độ vượt, có hiệu lực theo ngày | `violations` (GĐ5), `data/tra-cuu/muc-phat.json` | Chốt tuần tra, Súng bắn tốc độ, Lập biên bản |
| Quy trình xử lý theo bước | `procedures` (GĐ5) | Hiện trường |
| Biển báo QCVN 41, ảnh | `traffic_signs` (GĐ12) | Cung đường biển báo |
| Văn bản đến điều/khoản/điểm, kiểm URN còn hiệu lực | `nodes`, `packages/db/src/citation-health.ts` | Căn cứ của mọi nội dung trò chơi |
| Sổ XP chỉ ghi thêm, `congXp(tx, …)` | `xp_ledger`, `packages/db/src/diem-thuong.ts` | Mọi trò |
| Cấp độ, chuỗi ngày, huy hiệu | `streaks`, `badges`, `packages/dao-tao/src/diem-thuong.ts` | Lớp trò chơi hóa |
| Bảng xếp hạng tuần theo đơn vị (XP trung bình mỗi người) | `bangXepHangDonVi` | Nền của Mùa giải |
| Ôn giãn cách SM-2 | `packages/dao-tao/src/srs.ts` | Lệnh trực |
| Offline: gói câu hỏi trong IndexedDB, chấm trên máy, đồng bộ bằng `client_id`, máy chủ chấm lại | `lib/offline/*`, `POST /v1/luyen-tap/dong-bo` (GĐ13) | Mọi trò chơi offline |
| Đọc thành tiếng (Vbee, có bộ nhớ đệm), nhận dạng giọng nói (Web Speech), khớp lời nói với phương án | `/v1/giong-doc`, `khop-loi-noi.ts` (GĐ14) | Bộ đàm |
| Khung giao diện game, đồng hồ đếm ngược | `components/tro-choi/KhungGame.tsx`, `DongHoNguoc.tsx` | Mọi trò |

Hai điểm của thiết kế cũ **không** nên kéo dài:

- Mỗi game mới phải viết lại CHECK của `practice_sessions.source` và `game_scores.game_code` (migration 0020, 0022, 0024 đều làm việc này). Thay bằng bảng đăng ký `games` và khóa ngoại.
- `practice_answers.question_id` là NOT NULL, nên các trò không dựa trên câu hỏi (ghép cặp) phải nộp cả ván qua một đường riêng. Bộ máy lượt chơi mới cho mỗi bước trỏ tới bất kỳ loại nội dung nào.

---

## 2. Kiến trúc chung

### 2.1. Chia phần dùng chung và phần riêng

```
packages/dao-tao/src/tro-choi/
  khung.ts          ← dùng chung: kiểu DinhNghiaTroChoi, vòng đời lượt, tổng kết, sao, thưởng nhanh
  dang-ky.ts        ← dùng chung: bảng mã → định nghĩa, import được ở máy chủ và trình duyệt
  xp.ts             ← dùng chung: XP theo tỷ lệ điểm, giảm dần khi chơi lặp
  lenh-truc.ts, sung-ban-toc-do.ts, lap-bien-ban.ts, …   ← phần riêng, mỗi trò một tệp
packages/db/src/
  luot-choi.ts      ← dùng chung: tạo lượt, ghi bước, kết thúc, đồng bộ offline (trong giao dịch)
  noi-dung-tro-choi.ts ← dùng chung: soạn, duyệt, kiểm tham chiếu
  ho-so-chu-de.ts   ← dùng chung: hồ sơ điểm mạnh/yếu
apps/api/src/routes/luot-choi.ts  ← API chung /v1/luot-choi/*
apps/web/app/components/tro-choi/ ← KhungGame, DongHoBuoc, TongKetLuot, useLuotChoi …
```

Phần riêng của một trò là một đối tượng thỏa kiểu sau (viết tay, rút gọn):

```ts
interface DinhNghiaTroChoi<NoiDung, Buoc, De, TraLoi> {
  ma: MaTroChoi;
  offline: boolean;                       // có gói offline không
  thoiGian: { moiBuocMs?: number; caLuotMs?: number } | null;
  nguon: NguonNoiDung[];                  // cần nội dung gì: cau_hoi | game_content | violation | sign | speed_limit | procedure
  /** Sinh các bước của một lượt từ nội dung ĐÃ DUYỆT và một seed. Kết quả có cả đáp án, chỉ máy chủ giữ. */
  taoLuot(nguon: NoiDung[], rng: Rng, boiCanh: BoiCanhLuot): Buoc[];
  /** Phần gửi cho người chơi: không đáp án, không giải thích. */
  deChoNguoiChoi(buoc: Buoc): De;
  /** Chấm một bước. Hàm thuần: cùng đầu vào thì cùng kết quả, ở máy chủ và ở điện thoại. */
  chamBuoc(buoc: Buoc, traLoi: TraLoi, thoiGianMs: number | null): KetQuaBuoc;
  /** Buộc kết thúc sớm (hết mạng sống, sai liên tiếp…). Mặc định: không. */
  ketThucSom?(ketQua: KetQuaBuoc[]): boolean;
  /** Bước tiếp theo phụ thuộc câu trả lời (Hiện trường). Mặc định: đi tuần tự. */
  buocTiep?(buoc: Buoc[], ketQua: KetQuaBuoc[]): number | null;
}

interface KetQuaBuoc {
  diem: number; diemToiDa: number;
  dung: boolean | null;                   // null: bước không có đúng/sai (bước kể chuyện)
  chuDe: string | null;                   // để cập nhật hồ sơ chủ đề
  chiTiet: unknown;                       // phần riêng: chấm từng ô, hậu quả…
  giaiThich: string; canCu: string[];     // chỉ gửi SAU khi bước đã chấm
}
```

### 2.2. Khung màn chơi (vòng đời một lượt)

```
bat_dau ──► dang_choi ──(bước 1..n: mở đề → trả lời → chấm → phản hồi)──► xong
                │                                                         │
                ├── hết giờ cả lượt ─────────────────────────► het_gio ───┤
                └── bỏ dở quá 24 giờ (job dọn) ──────────────► bo_do      │
                                                                          ▼
                                            tổng kết → cộng XP → hồ sơ chủ đề → huy hiệu
```

- **Bắt đầu:** máy chủ rút nội dung đã duyệt, sinh seed, gọi `taoLuot`, lưu **ảnh chụp** các bước (kèm đáp án) vào `game_runs.items`. Giống `practice_sessions.items`: sửa nội dung sau đó không đổi lượt đang chơi hay kết quả đã chấm.
- **Mỗi bước:** mở đề thì ghi `opened_at`; trả lời thì chấm, trả kết quả kèm giải thích và căn cứ. Trả lời hai lần một bước nhận 409.
- **Kết thúc:** gọi được nhiều lần, chỉ tổng kết và cộng XP một lần (khóa `game:<mã>` + id lượt trong `xp_ledger`).
- **Làm tiếp khi rớt mạng:** mở lại lượt đang chơi thì về đúng bước chưa trả lời.

### 2.3. Tính giờ

| Loại | Trò | Cách làm |
|---|---|---|
| Không tính giờ | Lập biên bản, Hiện trường, Lệnh trực | — |
| Giờ từng bước | Súng bắn tốc độ, Người vi phạm nói gì?, Bộ đàm, Đối đầu | Hạn = `opened_at` + thời gian bước. Trả lời sau hạn + 2 giây dung sai: bước được chấm **0 điểm** (không trả 409, để lượt vẫn đi tiếp) |
| Giờ cả lượt | Chốt tuần tra | `deadline_at = started_at + thời gian lượt`, như đua thời gian (GĐ10) |
| Nhịp thời gian thực trên máy | Cung đường biển báo | Máy chủ sinh chuỗi biển và nhịp xuất hiện từ seed. Điện thoại gửi nhật ký phản ứng (biển số mấy, thao tác gì, sau bao nhiêu ms). Máy chủ chấm lại từ nhật ký và loại các mốc thời gian không thể xảy ra (trước khi biển hiện, hoặc tổng thời gian lượt lệch quá 10% so với đồng hồ máy chủ) |

**Thưởng nhanh** (nếu trò có): tối đa +50% điểm bước, giảm tuyến tính theo thời gian đã dùng. **Lượt offline không có thưởng nhanh**, vì máy chủ không kiểm được đồng hồ của điện thoại.

### 2.4. Chấm điểm

- Mọi trò trả điểm dạng `diem / diemToiDa`. Tổng kết lượt tính **tỷ lệ** (0–1), từ đó ra **sao**: 1 sao từ 50%, 2 sao từ 70%, 3 sao từ 90%.
- **Chấm trên máy chủ** bằng `chamBuoc`. Khi offline, điện thoại chấm bằng chính hàm đó để hiện phản hồi ngay, nhưng khi đồng bộ **máy chủ chấm lại** và bỏ kết quả điện thoại gửi lên (cùng quy tắc GĐ13).
- **Câu hỏi ngân hàng trong trò chơi** được chấm bằng `chamCauHoi` có sẵn, không viết lại.
- Không trò nào gửi đáp án cho người chơi trước khi bước được chấm. Test quét khóa cấm (`answer`, `dap_an`, `giai_thich`, `can_cu`) của GĐ3/GĐ6 mở rộng sang `/v1/luot-choi/*`. Ngoại lệ duy nhất là gói offline, như GĐ13.

### 2.5. Cộng XP

- Lối duy nhất vẫn là `congXp(tx, …)`, gọi trong giao dịch kết thúc lượt. Nguồn `game:<mã>`, khóa theo id lượt.
- **XP của một lượt** = `XP_CO_BAN[mã] × tỷ lệ điểm` + thưởng riêng của trò (qua màn lần đầu, thắng đối đầu…). Bảng số nằm ở `tro-choi/xp.ts`.
- **Chống chơi lặp để lấy XP:** trong một ngày, lượt thứ 1–3 của cùng một trò nhận đủ XP, lượt 4–6 nhận một nửa, từ lượt 7 không nhận XP (vẫn lưu kết quả). Lệnh trực chỉ có một lượt tính XP mỗi ngày. Đây là đề xuất, xem §7 câu Q12.
- `xp_ledger` thêm cột `unit_id`: đơn vị của người chơi **tại thời điểm** nhận XP. Mùa giải tính theo cột này, nên chuyển đơn vị giữa tuần không kéo XP cũ theo.

### 2.6. Lưu kết quả

- `game_runs`: một dòng mỗi lượt (trò, người, đơn vị, seed, ảnh chụp, điểm, sao, XP, offline hay không).
- `game_run_steps`: một dòng mỗi bước (trỏ tới câu hỏi, nội dung trò chơi hay dòng dữ liệu tra cứu kèm phiên bản; câu trả lời; điểm; thời gian).
- Sau mỗi bước có `chuDe`, gọi `ghiKetQuaChuDe` để cập nhật **hồ sơ chủ đề** (§6.2). Bước trỏ tới câu hỏi ngân hàng còn cập nhật `wrong_questions` (Câu sai của tôi) và `question_memory` (ôn giãn cách, §5.8), cùng giao dịch.
- Báo cáo GĐ7 "Câu hỏi khó" đọc thêm `game_run_steps` có `ref_kind = 'question'`.
- **5 trò cũ giữ nguyên** trên `practice_sessions`, không chuyển dữ liệu (xem §7 câu Q2).

### 2.7. Đồng bộ offline

Mở rộng đúng cơ chế của GĐ13, không làm cơ chế thứ hai:

1. **Gói offline** `GET /v1/luot-choi/goi-offline/:ma`: nội dung đã duyệt, `offline_ok = true`, **kèm đáp án**, cùng phiên bản của từng mục. Mỗi gói có `goi_id` và hạn dùng 14 ngày. Ảnh (biển báo, hình nền cảnh) do service worker giữ.
2. **Trên điện thoại:** route chạy phía client `/tro-choi/offline` đọc gói từ IndexedDB, gọi `taoLuot` và `chamBuoc` của `dang-ky.ts` (cùng mã với máy chủ). Lượt lưu vào kho `luot_choi` với `client_id`, mỗi bước có `client_id` riêng.
3. **Đồng bộ** `POST /v1/luot-choi/dong-bo`: máy chủ kiểm mọi mục trong lượt có trong một gói đã cấp cho chính người đó, chấm lại từng bước bằng **ảnh chụp nội dung trong gói** (không phải bản mới nhất, vì người chơi đã thấy bản trong gói), rồi kết thúc lượt. Trùng `client_id` thì bỏ qua.
4. **XP và chuỗi ngày** tính theo thời điểm chơi thật, không quá 7 ngày (quy tắc GĐ13). Mùa giải chỉ nhận lượt đồng bộ trước giờ chốt tuần (§5.10).
5. Nội dung trong gói đã **bị gỡ duyệt** trước khi đồng bộ: vẫn lưu kết quả, không cộng XP cho bước đó.

Trò không chạy offline: Bộ đàm (nhận dạng giọng nói của Chrome cần mạng), Đối đầu (cần đối thủ). Mùa giải tính trên máy chủ.

### 2.8. Giao diện dùng chung

- `KhungGame` (đã có): nút quay lại, tên trò, góc phải cho điểm hoặc đồng hồ.
- Thêm `DongHoBuoc` (đồng hồ từng bước, đổi màu 3 giây cuối, có nhãn chữ cho trình đọc màn hình), `PhanHoiBuoc` (đúng/sai, một câu giải thích, nút "Xem điều khoản" mở ngăn kéo căn cứ của GĐ4), `TongKetLuot` (sao, điểm, XP nhận được, danh sách bước sai kèm căn cứ, nút "Chơi lại" và "Luyện chủ đề yếu").
- Hook `useLuotChoi(ma)`: cùng một giao diện cho online (gọi API qua action/fetcher) và offline (gọi mã chấm trên máy). Trang trò chơi không cần biết đang ở chế độ nào.
- Mọi trò qua bảng kiểm PLAN §0.4. Chuyển động tắt khi `prefers-reduced-motion`; trò có chuyển động (Cung đường) chuyển sang chế độ từng bước.

### 2.9. API chung

| Phương thức | Đường dẫn | Việc |
|---|---|---|
| GET | `/v1/luot-choi` | Danh sách trò đang bật, kỷ lục và số lượt hôm nay của tôi |
| POST | `/v1/luot-choi/:ma/bat-dau` | Tạo lượt; trả id và đề bước đầu |
| GET | `/v1/luot-choi/luot/:id` | Lượt đang chơi: bước hiện tại, thời gian còn lại, các bước đã chấm |
| POST | `/v1/luot-choi/luot/:id/buoc/:thuTu` | Trả lời một bước; trả kết quả, giải thích, căn cứ, đề bước tiếp |
| POST | `/v1/luot-choi/luot/:id/ket-thuc` | Tổng kết, cộng XP (gọi lại không cộng lần hai) |
| GET | `/v1/luot-choi/goi-offline/:ma` | Gói offline |
| POST | `/v1/luot-choi/dong-bo` | Đồng bộ lượt offline |
| GET | `/v1/toi/ho-so-chu-de` | Hồ sơ điểm mạnh/yếu |

Tiền tố là `/v1/luot-choi`, không dùng `/v1/tro-choi/:ma/…`, vì `/v1/tro-choi/dua-thoi-gian/bat-dau` của GĐ10 đã chiếm dạng đường dẫn đó.

### 2.10. Phần riêng của từng trò

| Trò | Nguồn nội dung | Dạng bước | Tính giờ | Phần riêng phải viết |
|---|---|---|---|---|
| Chốt tuần tra | `game_content` (cảnh) → `violations` | Chạm xe → chọn lỗi → chọn mức phạt | Cả lượt | Dựng cảnh SVG từ dữ liệu; trình soạn cảnh |
| Súng bắn tốc độ | `speed_limits` + `violations` (sinh tự động) | 3 câu nhỏ mỗi xe | Từng bước | Bộ sinh xe và suy đáp án từ dữ liệu |
| Lập biên bản | `game_content` → `violations` | Một biểu mẫu 4 ô | Không | Chấm từng ô, chọn hành vi có tìm kiếm |
| Người vi phạm nói gì? | `questions` có ngữ cảnh | Câu một đáp án | Từng bước | Bong bóng thoại, phản ứng theo phương án |
| Cung đường biển báo | `traffic_signs` có `reaction` | Phản ứng trong cửa sổ thời gian | Nhịp thời gian thực | Hoạt cảnh đường chạy, chấm từ nhật ký |
| Hiện trường | `game_content` (cây) → `procedures`, URN | Chọn nhánh | Không | Kiểm cây hợp lệ, trình soạn cây |
| Bộ đàm | `questions` | Nghe và nói | Từng bước | Khớp lời nói với con số, hiệu ứng bộ đàm |
| Lệnh trực | `questions` + `question_memory` | Câu hỏi | Không | Chọn 5 câu theo ưu tiên, SM-2 |
| Đối đầu 1–1 | `questions` | Câu hỏi, hai người cùng lúc | Từng bước | WebSocket, ghép cặp, phát lại lượt ghi |
| Mùa giải đơn vị | `xp_ledger` | — | — | Chia hạng, chốt tuần, lên/xuống hạng |

---

## 3. Quy trình duyệt nội dung trò chơi

### 3.1. Một vòng đời cho mọi nội dung

Vòng đời của câu hỏi (GĐ3) được tách từ `cau-hoi.ts` ra `packages/dao-tao/src/vong-doi-duyet.ts` và dùng cho mọi loại nội dung:

```
nhap ──gửi duyệt──► cho_duyet ──duyệt──► da_duyet ──lưu trữ──► luu_tru
  ▲                     │                    │
  └──── sửa ◄── tu_choi ◄┘ từ chối           └── sửa ──► cho_duyet (version + 1)
```

| Loại nội dung | Bảng | Hiện nay | Sau GĐ-G0 |
|---|---|---|---|
| Câu hỏi (kể cả câu có ngữ cảnh trò chơi) | `questions` | Duyệt trong ứng dụng | Không đổi |
| Tình huống, cảnh, cây hiện trường | `game_content` (mới) | — | Duyệt trong ứng dụng |
| Mức phạt | `violations` | Sửa `trang_thai` trong JSON, nạp bằng script | Duyệt trong ứng dụng |
| Biển báo | `traffic_signs` | Như trên | Duyệt trong ứng dụng |
| Quy trình | `procedures` | Như trên | Duyệt trong ứng dụng |
| Tốc độ tối đa theo loại đường | `speed_limits` (mới, GĐ-G2) | — | Duyệt trong ứng dụng |

- **Quyền:** `bien_tap` soạn, sửa, gửi duyệt; vai trò duyệt đọc từ `NGAN_HANG_VAI_TRO_DUYET` (mặc định `phap_che`), dùng chung với câu hỏi.
- **Lịch sử duyệt** của mọi loại trừ câu hỏi ghi vào một bảng `content_reviews` (câu hỏi giữ `question_reviews`).
- **Tệp JSON trong `data/`** trở thành nguồn nhập, không còn là nơi duyệt: script nạp đưa dòng mới hoặc dòng đổi nội dung vào `cho_duyet`; dòng không đổi giữ nguyên trạng thái. Trường `trang_thai: "da_duyet"` trong tệp bị bỏ qua, trừ khi chạy với `--chap-nhan-trang-thai` (chỉ dùng cho CSDL phát triển).
- **Xem trước như người chơi:** màn hình soạn có nút "Chơi thử" dựng đúng giao diện trò chơi từ bản nháp, không ghi lượt chơi.
- **Căn cứ:** nội dung đã duyệt phải có ít nhất một URN; `scripts/check-citations.ts` kiểm thêm `game_content`, `speed_limits`. Căn cứ không còn hiệu lực thì CI báo lỗi, như GĐ5.

### 3.2. Trò chơi chỉ lấy nội dung đã duyệt, kể cả gián tiếp

Một tình huống Lập biên bản trỏ tới mức phạt `oto-toc-do-10-20`. Nếu mức phạt đó bị sửa (quay về `cho_duyet`), tình huống cũng không được dùng nữa, dù bản thân nó vẫn `da_duyet`.

- Lúc duyệt, `game_content.refs` ghi lại **mã và phiên bản** của từng mục được trỏ tới: `[{ loai: "violation", ma: "oto-toc-do-10-20", version: 3 }]`.
- Truy vấn rút nội dung cho trò chơi chỉ nhận tình huống mà **mọi** mục được trỏ tới đang `da_duyet` **và** cùng phiên bản đã ghi. Hàm `noiDungDungDuoc(game, bộ lọc)` là lối rút duy nhất; test API kiểm không route nào đọc `game_content` bằng đường khác.
- Mục được trỏ tới đổi phiên bản hoặc rời `da_duyet`: tình huống bị gắn cờ `needs_review_reason` và hiện trong tab "Cần xem lại" của biên tập viên. Duyệt lại thì cập nhật phiên bản trong `refs`.
- Súng bắn tốc độ sinh xe từ dữ liệu, không có tình huống soạn tay: chỉ sinh từ các dòng `speed_limits` và `violations` đang `da_duyet` và còn hiệu lực tại ngày chơi.

### 3.3. AI soạn nội dung trò chơi

Không làm trong các giai đoạn này. Khi cần, dùng lại bước sinh của GĐ8: kết quả vào `game_content` ở `cho_duyet`, `source = 'ai'`, qua cùng hậu kiểm căn cứ. **Trong lúc chơi, AI không sinh nội dung mới** cho người chơi; AI chỉ đọc thành tiếng và (nếu được chọn ở Q9) chấm câu trả lời nói tự do của Bộ đàm.

---

## 4. Mô hình dữ liệu

### 4.1. Dùng lại, không sao chép

| Bảng có sẵn | Thay đổi |
|---|---|
| `questions` | Thêm `context jsonb` (GĐ-G4) cho Người vi phạm nói gì?. Không thêm loại câu mới |
| `question_topics` | Không đổi; là khóa của hồ sơ chủ đề |
| `violations`, `traffic_signs`, `procedures` | Thêm cột vòng đời duyệt (`version`, `approved_by`, `approved_at`, `reject_reason`), thêm `topic_id`; nới CHECK `status` gồm `cho_duyet`, `tu_choi`. Giữ `ngung` (tương đương `luu_tru`) để không đổi dữ liệu cũ |
| `traffic_signs` | Thêm `reaction`, `reaction_note` (GĐ-G8) |
| `xp_ledger` | Thêm `unit_id` |
| `badges` | Thêm dòng huy hiệu cho trò chơi; `rule` nhận thêm chỉ số theo trò |
| `nodes`, `documents` | Không đổi; mọi căn cứ là URN trỏ vào đây |

### 4.2. Bảng mới

**Nền (GĐ-G0, migration `0027_tro_choi_nen.sql`)**

```sql
-- Bảng đăng ký trò chơi. Thay cho việc sửa CHECK mỗi khi thêm trò.
games (
  code text PRIMARY KEY,                -- lenh_truc, sung_ban_toc_do, …
  name text NOT NULL,
  offline_ok boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT false,
  ordinal int NOT NULL DEFAULT 0,
  config jsonb NOT NULL DEFAULT '{}'    -- số bước, thời gian, XP cơ bản: ghi đè bảng mặc định trong mã
)

-- Nội dung riêng của trò chơi ("tình huống"). Vòng đời giống hệt questions.
game_content (
  id uuid PK, code text UNIQUE,         -- TC-00001
  game_code text NOT NULL REFERENCES games(code),
  topic_id uuid REFERENCES question_topics(id), level text CHECK (de|trung_binh|kho),
  title text NOT NULL,
  payload jsonb NOT NULL,               -- phần người chơi được thấy; lược đồ theo từng trò, kiểm trong packages/dao-tao
  answer jsonb NOT NULL DEFAULT '{}',   -- đáp án; KHÔNG BAO GIỜ gửi cho người chơi trước khi chấm
  explanation text,
  citations text[] NOT NULL DEFAULT '{}',
  refs jsonb NOT NULL DEFAULT '[]',     -- [{loai, ma, version}] ghi lúc duyệt
  asset_uris text[] NOT NULL DEFAULT '{}',
  status, source, version, created_by, updated_by, approved_by, approved_at, reject_reason,
  needs_review_reason text,             -- khác NULL khi mục được trỏ tới đã đổi
  offline_ok boolean NOT NULL DEFAULT true,
  created_at, updated_at
)
INDEX (game_code, status, topic_id, level)

-- Lịch sử duyệt mọi loại nội dung trừ câu hỏi.
content_reviews (
  id bigserial PK,
  kind text CHECK (game_content|violation|traffic_sign|procedure|speed_limit),
  ref text NOT NULL, version int NOT NULL,
  action text NOT NULL, actor text NOT NULL, note text, created_at
)

-- Lượt chơi.
game_runs (
  id uuid PK,
  game_code text NOT NULL REFERENCES games(code),
  account_id uuid NOT NULL REFERENCES accounts(id),
  unit_id uuid REFERENCES units(id),    -- đơn vị lúc chơi
  seed bigint NOT NULL,
  items jsonb NOT NULL,                 -- ảnh chụp các bước, kèm đáp án; chỉ máy chủ đọc
  status text CHECK (dang_choi|xong|het_gio|bo_do),
  started_at, deadline_at NULL, finished_at NULL,
  played_at timestamptz,                -- thời điểm chơi thật (lượt offline)
  score numeric, max_score numeric, stars smallint, xp int,
  offline boolean NOT NULL DEFAULT false,
  client_id uuid, pack_id uuid,         -- UNIQUE một phần trên client_id
  match_id uuid NULL                    -- Đối đầu (GĐ-G10)
)
INDEX (account_id, game_code, started_at DESC), (game_code, finished_at) WHERE status = 'xong'

game_run_steps (
  run_id uuid REFERENCES game_runs(id) ON DELETE CASCADE, ordinal int,
  ref_kind text CHECK (question|game_content|violation|traffic_sign|speed_limit|procedure|sinh),
  ref_id text, ref_version int,
  topic_id uuid,
  opened_at, answered_at, elapsed_ms int,
  response jsonb, correct boolean NULL, points numeric, max_points numeric,
  client_id uuid UNIQUE NULL,
  PRIMARY KEY (run_id, ordinal)
)

-- Gói offline đã cấp: để kiểm lượt đồng bộ chỉ dùng nội dung đã cấp cho chính người đó.
game_packs (id uuid PK, account_id, game_code, items jsonb, issued_at, expires_at)

-- Hồ sơ điểm mạnh/yếu.
topic_stats (
  account_id, topic_id, attempts int, correct int,
  score_ema numeric,                    -- trung bình trượt, nghiêng về các lần gần đây
  last_at timestamptz,
  PRIMARY KEY (account_id, topic_id)
)

ALTER TABLE xp_ledger ADD COLUMN unit_id uuid REFERENCES units(id);
-- violations, traffic_signs, procedures: cột vòng đời + topic_id (xem 4.1)
```

**Theo từng trò**

| Migration | GĐ | Bảng |
|---|---|---|
| `0028_lenh_truc.sql` | G1 | `question_memory(account_id, question_id, ease, interval_days, reps, lapses, due_on, last_seen_at, suspended, PK)`: trạng thái ôn giãn cách theo người và câu (khác `srs_cards` vốn gắn với ghi danh chuyên đề). `duty_orders(account_id, day, question_ids uuid[], run_id, offline, created_at, PK(account_id, day))`: lệnh trực của từng ngày |
| `0029_toc_do_toi_da.sql` | G2 | `speed_limits(id, code UNIQUE, vehicle_class, violation_vehicle CHECK (o_to\|mo_to), road_type, max_speed int, citation_urn, effective_from, effective_to, topic_id, cột vòng đời)`. Đây là "khung tốc độ"; **khung mức phạt theo tốc độ đã có** ở `violations.speed_over_min/max`, không tạo bảng thứ hai |
| `0030_lap_bien_ban.sql` | G3 | Chỉ đăng ký trò; tình huống nằm trong `game_content` |
| `0031_cau_hoi_ngu_canh.sql` | G4 | `questions.context jsonb`: `{ nguoi_noi, loi_bao_chua, phan_ung: { <id phương án>: "…" } }`. "Lời bào chữa" là câu hỏi ngân hàng, không phải bảng riêng (Q5) |
| `0032_hien_truong.sql` | G5 | Chỉ đăng ký trò; cây nhánh nằm trong `game_content.payload` (§5.6) |
| `0033_mua_giai.sql` | G6 | `seasons(id, code, name, starts_on, ends_on, unit_level_label, config jsonb, status)`, `season_standings(season_id, week_start, unit_id, tier, group_no, members, active_members, xp_counted, score, rank_in_group, outcome CHECK (len\|giu\|xuong) NULL, closed_at, PK(season_id, week_start, unit_id))` |
| `0034_chot_tuan_tra.sql` | G7 | Chỉ đăng ký trò; cảnh nằm trong `game_content.payload` |
| `0035_bien_bao_phan_ung.sql` | G8 | `traffic_signs.reaction`, `reaction_note` |
| `0036_bo_dam.sql` | G9 | Đăng ký trò; tắt `hoi_nhanh_giong_noi` trong `games` |
| `0037_doi_dau.sql` | G10 | `duel_matches(id, mode CHECK (truc_tiep\|bong\|bong_may), seed, question_ids uuid[], status, created_at, started_at, finished_at)`, `duel_players(match_id, account_id, run_id, is_ghost, ghost_run_id, score, result CHECK (thang\|thua\|hoa), PK)` |

**Vì sao cây hiện trường và cảnh tuần tra nằm trong `payload` mà không tách bảng nút:** cả cây là **một đơn vị duyệt**. Người duyệt duyệt cả kịch bản; sửa một nhánh thì phải xem lại cả cây. Để trong một tài liệu JSON có phiên bản thì ảnh chụp lượt chơi, so sánh bản sửa, gói offline đều đơn giản. Tính hợp lệ của cây (không chu trình, mọi nhánh kết thúc) kiểm bằng hàm thuần khi lưu và khi duyệt.

### 4.3. Quan hệ

```
question_topics ◄── questions ◄──────────────┐
      ▲   ▲                                   │ ref_kind = question
      │   └── game_content ──refs──► violations, traffic_signs, procedures, speed_limits
      │            ▲                                ▲
      │            │ ref_kind = game_content        │ ref_kind = violation | …
topic_stats   game_run_steps ─────────────────────────┘
                   │
               game_runs ──► games
                   │  └──► duel_players ──► duel_matches
                   ▼
               xp_ledger(unit_id) ──► season_standings ──► seasons
```

---

## 5. Từng trò chơi

Độ khó triển khai: **Thấp** (dưới 1 tuần một người), **Trung bình** (1–2 tuần), **Cao** (trên 2 tuần hoặc có rủi ro kỹ thuật). Tính khi GĐ-G0 đã xong.

### 5.1. Chốt tuần tra

**Luật chơi**
- Một lượt gồm 3 cảnh, 90 giây cho cả lượt. Mỗi cảnh là một đoạn đường vẽ bằng SVG, có 4–8 xe; 1–4 xe vi phạm.
- Chạm vào xe để "dừng xe". Nếu xe vi phạm: chọn **lỗi** (4 phương án), rồi chọn **mức phạt** (4 phương án). Nếu xe không vi phạm: báo "Dừng xe không có căn cứ".
- Bấm "Xong cảnh" để sang cảnh sau; hết giờ thì các xe chưa xử lý tính là bỏ sót.

**Chấm điểm**
- Đúng lỗi +10, đúng mức phạt +5. Dừng nhầm xe không vi phạm −5 (không âm dưới 0 trong một cảnh). Bỏ sót: 0.
- Tổng kết chỉ ra từng xe: vi phạm gì, căn cứ, người chơi đã làm gì.

**Dữ liệu cần**
- `game_content` loại `chot_tuan_tra`, `payload`: loại đường, hướng, đèn tín hiệu, biển báo trên cảnh, danh sách xe `{id, loai_xe, lan, vi_tri, trang_thai: [khong_mu, cho_3_nguoi, vuot_den_do, …]}`; `answer`: xe nào vi phạm, mã `violations` tương ứng.
- Phương án nhiễu cho "lỗi" và "mức phạt" sinh từ `violations` cùng nhóm, cùng loại xe, như ghép cặp GĐ10.
- **Bộ hình vẽ** (xe máy, ô tô, người, mũ bảo hiểm, đèn, vạch kẻ) là tệp SVG tĩnh trong `apps/web/public/tro-choi/tuan-tra/`. Cảnh dựng từ dữ liệu, nên không cần một ảnh riêng cho mỗi cảnh.
- Trình soạn cảnh: đặt xe theo lưới (làn × vị trí), chọn trạng thái từ danh sách; không kéo thả tự do ở bản đầu.

**Offline:** Có. Bộ hình vẽ do service worker giữ; giờ cả lượt vẫn chạy trên máy nhưng lượt offline không có thưởng nhanh.

**Độ khó triển khai: Cao.** Phần tốn công là bộ hình vẽ đủ rõ trên màn 360px và trình soạn cảnh. Cần quyết định nguồn hình vẽ (Q8).

### 5.2. Súng bắn tốc độ

**Luật chơi**
- Một lượt 10 xe. Mỗi xe hiện: loại xe, loại đường (ví dụ "đường đôi ngoài khu dân cư"), biển hạn chế tốc độ nếu có, và tốc độ đo được.
- Mỗi xe có 12 giây, trả lời tối đa 3 câu nhỏ:
  1. Có vi phạm tốc độ không? (Có / Không)
  2. Nếu có: vượt bao nhiêu, thuộc khung phạt nào? (chọn trong các khoảng của loại xe đó)
  3. Có hình thức xử phạt bổ sung hoặc trừ điểm giấy phép lái xe không? (chọn trong 3–4 phương án)
- Trả lời sai câu 1 thì xe kết thúc, sang xe sau.

**Chấm điểm**
- Câu 1: 3 điểm; câu 2: 4 điểm; câu 3: 3 điểm; tối đa 10 điểm mỗi xe.
- Xe không vi phạm mà trả lời đúng "Không": đủ 10 điểm.
- Thưởng nhanh theo §2.3 (chỉ khi online).

**Dữ liệu cần**
- `speed_limits` (mới): tốc độ tối đa theo loại xe × loại đường, có căn cứ và hiệu lực. Nguồn là văn bản quy định tốc độ khai thác trên đường bộ; **biên tập viên xác định văn bản đang hiệu lực và nạp vào kho trước** (Q6).
- `violations` có khoảng tốc độ vượt (đã có): suy ra khung phạt, mức tiền, hình thức bổ sung, điểm trừ.
- Biển hạn chế tốc độ trên cảnh lấy từ `traffic_signs` (ví dụ biển tốc độ tối đa cho phép); có biển thì tốc độ tối đa là số trên biển.
- **Không có tình huống soạn tay.** Bộ sinh chọn loại xe, loại đường, biển (có/không), rồi chọn tốc độ đo được sao cho các khung đều xuất hiện, có cả ca ở sát biên ở mức khó. Đáp án **suy ra từ dữ liệu đã duyệt** bằng cùng hàm khớp khoảng của tra cứu tốc độ GĐ5 (`tra-cuu-nhanh.ts`). Tổ hợp nào thiếu dữ liệu đã duyệt thì không sinh.

**Offline:** Có. Gói gồm `speed_limits` và các dòng `violations` theo tốc độ, dưới 20 KB.

**Độ khó triển khai: Trung bình.** Mã không khó; rủi ro nằm ở dữ liệu tốc độ tối đa (nhiều loại xe, loại đường) phải đối chiếu đúng văn bản.

**Đã làm ở GĐ-G2 (25/9/2026).** Hai thay đổi so với thiết kế trên:
- **Xe là tình huống soạn sẵn, không sinh ngẫu nhiên.**
  - Mỗi tình huống lưu ở `game_content` và qua duyệt như mọi nội dung trò chơi.
  - Tình huống chỉ có dữ kiện: loại xe, mô tả, bối cảnh, số trên biển P.127, tốc độ đo được.
  - Khung phạt, mức tiền, trừ điểm, hình thức bổ sung vẫn suy ra từ các dòng mức phạt theo tốc độ đã duyệt.
  - Tham chiếu của mỗi tình huống gồm mọi khung phạt theo tốc độ của loại xe đó và biển P.127. Sửa một khung thì mọi tình huống của loại xe đó rút khỏi trò chơi.
  - Có 20 tình huống demo ở `data/tro-choi/sung-ban-toc-do.json`, nạp vào trạng thái chờ duyệt bằng `bun run packages/db/src/seed-tro-choi.ts`.
- **Tốc độ tối đa chỉ lấy từ số trên biển P.127** (câu Q6).
  - Kho văn bản chưa có văn bản quy định tốc độ theo loại đường, nên chưa có dòng `speed_limits` nào.
  - `data/tra-cuu/toc-do-toi-da.json` là khung 8 dòng (ô tô con, xe mô tô × 4 loại đường) để trống số liệu.
  - Tra cứu tốc độ (GĐ5) đã nhận `duong=`; ô chọn loại đường tự hiện khi có dòng được duyệt.
  - Bộ chơi chưa dùng loại đường. Khi có dữ liệu đã duyệt, thêm dữ kiện `loai_duong` vào tình huống.
- Câu 1 hỏi "Có bị xử phạt vì chạy quá tốc độ không?", không hỏi "có vi phạm không": xe vượt dưới cận của khung phạt thấp nhất (hiện là 5 km/h) được tính là không bị xử phạt. Cách hỏi này cần đơn vị chuyên môn xác nhận (xem bên dưới).

**Cần đơn vị chuyên môn kiểm tra trước khi duyệt dữ liệu của trò này:**

| # | Nội dung | Ở đâu | Vì sao cần kiểm |
|---|---|---|---|
| 1 | 7 khung phạt theo tốc độ (4 cho ô tô, 3 cho xe mô tô, xe gắn máy): cận khoảng tốc độ vượt, cách viết cận (gồm hay không gồm), mức tiền từ–đến | `data/tra-cuu/muc-phat.json`, mã `oto-toc-do-*`, `mt-toc-do-*` | Soạn ở GĐ5 khi kho chưa có Nghị định số 168/2024/NĐ-CP, chưa đối chiếu nguyên văn. Căn cứ mới trỏ ở mức Điều (Điều 6, Điều 7) |
| 2 | Số điểm trừ giấy phép lái xe của từng khung | Như trên, trường `tru_diem` | Câu 3 của trò chấm theo trường này |
| 3 | Hình thức xử phạt bổ sung (ví dụ tước quyền sử dụng giấy phép lái xe) | Như trên, trường `hinh_thuc_bo_sung`, hiện **để trống ở cả 7 khung** | Nếu văn bản có hình thức bổ sung cho khung nào thì phải điền, nếu không câu 3 chấm sai |
| 4 | Sửa đổi của Nghị định số 238/2026/NĐ-CP với các khung trên | Như trên | Mức phạt có thể đã đổi; cần tách dòng theo hiệu lực |
| 5 | Vượt dưới 5 km/h có bị xử phạt về tốc độ không; cách hỏi câu 1 có đúng nghiệp vụ không | Luật chơi ở trên | Trò đang coi là không bị xử phạt |
| 6 | Văn bản quy định tốc độ tối đa theo loại xe, loại đường; cách phân loại xe và loại đường; số liệu | `data/tra-cuu/toc-do-toi-da.json` | Chưa có văn bản trong kho, mọi ô để trống |
| 7 | Tên, ý nghĩa, căn cứ của biển P.127 | `data/bien-bao/bien-bao.json` | Bản nháp từ GĐ12, chưa đối chiếu QCVN 41:2024/BGTVT |

**Ảnh cần bổ sung** (hiện dùng hình SVG tự vẽ trong `components/tro-choi/XeQuaChot.tsx`):

| Ảnh | Hiện dùng | Yêu cầu |
|---|---|---|
| Biển P.127 "Tốc độ tối đa cho phép", có chỗ ghi số | Vòng tròn viền đỏ, số ở giữa | Ảnh theo QCVN 41:2024/BGTVT, dạng SVG để ghép số theo từng tình huống; rõ ở cỡ 80px |
| Xe ô tô con | Hình khối nét đơn giản | SVG nhìn ngang, dưới 8 KB, một màu để đổi được màu nền sáng và tối |
| Xe mô tô, xe gắn máy | Hình nét đơn giản có khối động cơ | Như trên; phân biệt rõ với xe đạp |
| Xe tải nhẹ, xe khách nhỏ, xe bán tải (các tình huống có nhắc tới) | Dùng chung hình ô tô con | Tùy chọn; nếu có thì chọn hình theo `mo_ta_xe` |
| Súng bắn tốc độ hoặc màn hình máy đo | Khung chữ "Súng bắn tốc độ đo được" | Tùy chọn, minh họa nhỏ cạnh số tốc độ |
| Nền đoạn đường có biển | Không có | Tùy chọn; chỉ làm nếu không làm chậm trang trên điện thoại cấu hình thấp |

### 5.3. Lập biên bản

**Luật chơi**
- Đọc một tình huống (có thể kèm hình minh họa): ai, phương tiện gì, ở đâu, hành vi gì, có tình tiết gì.
- Điền biểu mẫu rút gọn gồm 4 ô:
  1. **Hành vi vi phạm:** chọn từ danh sách mức phạt, có ô tìm kiếm không dấu (dùng lại tìm kiếm GĐ5).
  2. **Điều khoản áp dụng:** chọn điểm – khoản – Điều từ 3 danh sách thả xuống, dựng từ URN của các dòng `violations` cùng nhóm.
  3. **Mức phạt tiền:** nhập số tiền.
  4. **Hình thức xử phạt bổ sung, biện pháp khắc phục:** đánh dấu trong danh sách.
- Bấm "Ký biên bản" để nộp. Không tính giờ.
- Tình huống khó có 2 hành vi: biểu mẫu có 2 dòng hành vi.

**Chấm điểm**
- Mỗi ô 25 điểm, chấm riêng và hiện kết quả ngay trên từng ô.
- Hành vi, điều khoản: đúng hoặc sai.
- Mức phạt: đúng khi nằm trong khung `fine_min`–`fine_max` của hành vi. Quy tắc chọn mức cụ thể (mức trung bình của khung, tăng giảm theo tình tiết) cần khách hàng xác nhận (Q7); khi được xác nhận thì chấm theo mức cụ thể.
- Hình thức bổ sung: đúng khi chọn đủ và không thừa; chọn đủ nhưng thừa một mục thì được một nửa.
- Tình huống 2 hành vi: ghép dòng người chơi điền với hành vi đúng theo cách cho điểm cao nhất, không phụ thuộc thứ tự.

**Dữ liệu cần**
- `game_content` loại `lap_bien_ban`: `payload` là lời kể tình huống, hình minh họa (tùy chọn); `answer` là danh sách mã `violations` và (nếu có) mức phạt cụ thể kèm lý do.
- Điều khoản và hình thức bổ sung **không lưu lại** trong tình huống: lấy từ dòng `violations` được trỏ tới.

**Offline:** Có.

**Độ khó triển khai: Trung bình.** Phần tốn công là biểu mẫu dùng tốt trên điện thoại và nội dung tình huống.

**Cách làm khác bản thiết kế (27/9/2026)**
- Ô Điều khoản: Điều lấy từ mọi dòng mức phạt; khoản, điểm lấy từ các dòng cùng nhóm. Nếu chỉ lấy cùng nhóm thì ô Điều thường chỉ còn một lựa chọn, vì căn cứ hiện mới ghi tới mức Điều.
- Tìm hành vi chạy trên máy theo cùng quy tắc với tìm mức phạt GĐ5 (mỗi từ đã bỏ dấu phải có trong hành vi hoặc từ khóa), không gọi API, để chơi được khi offline.
- Danh sách hành vi chỉ gồm các dòng cùng loại xe với tình huống.

**Dữ liệu cần đơn vị chuyên môn kiểm tra** (20 tình huống demo ở `data/tro-choi/lap-bien-ban.json`, ghi chú từng tình huống ở trường `ghi_chu_kiem_tra`):

| # | Nội dung | Nguồn | Tình trạng |
|---|---|---|---|
| 1 | Khung tiền, hình thức bổ sung, số điểm trừ của 16 dòng mức phạt mà tình huống trỏ tới | `data/tra-cuu/muc-phat.json` | Bản nháp GĐ5, chưa đối chiếu Nghị định số 168/2024/NĐ-CP (văn bản chưa có trong kho) |
| 2 | Khoản, điểm của từng dòng mức phạt | Như trên, trường `can_cu` | Mới ghi tới Điều 6, Điều 7. Chưa bổ sung thì ô "Điều khoản" chỉ chấm tới Điều |
| 3 | Ngưỡng nồng độ cồn đúng biên 0,25 mg/l (lbb-11) và sai số thiết bị đo | Tình huống lbb-11 | Cần xác nhận thuộc mức 1 |
| 4 | Cách ghi biên bản khi một người thực hiện 2 hành vi (lbb-18, 19, 20) | — | Trò chơi chấm mỗi hành vi một khung tiền riêng |
| 5 | Xe bán tải, xe tải nhẹ, xe khách 16 chỗ dùng dòng mức phạt "ô tô" (lbb-06, 10, 17) | — | Cần xác nhận cách phân loại |

**Ảnh cần bổ sung** (hiện dùng ô giữ chỗ vẽ SVG theo loại xe trong `components/tro-choi/MauBienBan.tsx`; tình huống nhận ảnh qua `payload.hinh`):

| Ảnh | Hiện dùng | Yêu cầu |
|---|---|---|
| Minh họa cho từng tình huống (20 ảnh, theo `ma` lbb-01 đến lbb-20) | Khung nét đứt, hình xe nét đơn giản, chữ "Hình minh họa đang bổ sung" | Ảnh vẽ hoặc ảnh dựng, không lộ biển số thật, không có người thật nhận ra được; ngang, tỉ lệ khoảng 3:1, dưới 40 KB (WebP) để gói offline gọn; không dùng quân hiệu, phù hiệu |
| Xe mô tô, ô tô con dùng chung khi tình huống chưa có ảnh riêng | Hình nét tự vẽ | SVG một màu, dưới 4 KB |
| Máy đo nồng độ cồn hiện số đo (lbb-08 đến lbb-14, lbb-20) | Không có | Tùy chọn; số trên máy phải khớp lời kể |
| Máy đo tốc độ có số đo (lbb-15 đến lbb-17) | Không có | Tùy chọn; có thể dùng lại hình máy đo của Súng bắn tốc độ nếu có |

### 5.4. Người vi phạm nói gì?

**Luật chơi**
- Một lượt 8 tình huống. Mỗi tình huống: một câu dẫn ngắn ("Dừng xe máy không đội mũ bảo hiểm"), bong bóng thoại lời bào chữa của người vi phạm ("Tôi chỉ đi ra đầu ngõ thôi mà").
- Chọn 1 trong 3–4 câu đáp của cán bộ; 20 giây mỗi tình huống.
- Sau khi chọn: hiện **phản ứng** của người vi phạm với câu đã chọn, câu đáp đúng, giải thích và căn cứ.

**Chấm điểm**
- Đúng 10 điểm, sai 0. Thưởng nhanh theo §2.3.
- Các phương án sai được soạn theo 3 kiểu, để phần giải thích chỉ ra đúng lỗi: sai luật; đúng luật nhưng sai tác phong (quát, đe dọa, hứa bỏ qua); vượt thẩm quyền.

**Dữ liệu cần**
- **Câu hỏi ngân hàng loại `mot_dap_an`**, thêm `questions.context`: người nói, lời bào chữa, phản ứng theo từng phương án. Câu có `context` dùng được cả trong luyện tập và thi (hiển thị lời bào chữa trong phần đề).
- Soạn và duyệt trên màn hình câu hỏi GĐ3, thêm khối "Ngữ cảnh trò chơi"; mẫu Excel thêm 3 cột.
- Rút câu theo chủ đề như luyện tập, lọc `context IS NOT NULL`.

**Offline:** Có (dùng gói câu hỏi, lọc câu có ngữ cảnh).

**Độ khó triển khai: Thấp.** Chủ yếu là nội dung.

### 5.5. Cung đường biển báo

**Luật chơi**
- Xe của người chơi tự chạy trên một cung đường cuộn dọc màn hình, khoảng 60–90 giây.
- Biển báo xuất hiện lần lượt. Mỗi biển có một **cửa sổ phản ứng** khoảng 3 giây, giảm dần khi lên cấp. Người chơi bấm một trong 4 nút lớn ở đáy màn hình: **Giảm tốc · Dừng lại · Không rẽ/không vào · Đi tiếp**. (Bộ thao tác cuối cùng chốt theo dữ liệu biển báo, xem Q8.)
- Có 3 mạng. Phản ứng sai hoặc không phản ứng với biển cần phản ứng thì mất một mạng. Hết mạng thì kết thúc.
- Mở đầu lượt có 3 câu "đoán biển báo" (dùng lại trò GĐ12) để làm quen.

**Chấm điểm**
- Đúng trong cửa sổ: +10, cộng thưởng nhanh tới +5.
- Biển chỉ dẫn không cần phản ứng mà người chơi bấm "Giảm tốc" hay "Dừng": không trừ mạng, 0 điểm (không phạt người thận trọng).
- Máy chủ chấm lại từ nhật ký sự kiện theo §2.3.

**Dữ liệu cần**
- `traffic_signs` thêm `reaction` (thao tác đúng) và `reaction_note` (giải thích ngắn). Sửa hai cột này là sửa nội dung biển, nên biển quay về `cho_duyet`.
- Ảnh biển báo đã có, mỗi ảnh ≤ 20 KB (GĐ12).
- Chuỗi biển và nhịp xuất hiện sinh từ seed, lấy biển đã duyệt có `reaction`.

**Offline:** Có. Nhật ký sự kiện lưu trong lượt offline; khi đồng bộ, máy chủ chấm lại như online nhưng không có thưởng nhanh.

**Độ khó triển khai: Cao.** Hoạt cảnh mượt trên điện thoại cấu hình thấp (dùng SVG và `requestAnimationFrame`, không dùng thư viện game), chế độ từng bước cho người bật giảm chuyển động, và kiểm nhật ký thời gian ở máy chủ.

**Đã làm (GĐ-G8, 25/9/2026).** Luật và số liệu đã chốt khi làm:
- Một lượt gồm 4 bước trên khung chung:
  - bước 1–3 là câu khởi động đoán tên biển, mỗi câu 5 điểm, không tính giờ;
  - bước 4 là đường chạy 12 biển, mỗi biển 10 điểm, thưởng nhanh tới 5 điểm mỗi biển.
- Cửa sổ phản ứng 3,0 giây ở 4 biển đầu, 2,6 giây ở 4 biển giữa, 2,2 giây ở 4 biển cuối. Cả đường chạy khoảng 64 giây.
- Bộ 4 thao tác: **Giảm tốc · Dừng lại · Không rẽ, không vào · Đi tiếp**. Người chơi được giả định lái **ô tô con**.
- Chấm từng biển:
  - chỉ tính thao tác đầu tiên trong cửa sổ;
  - bấm sai hoặc không bấm ở biển cần phản ứng thì mất một mạng;
  - ở biển có thao tác đúng là "Đi tiếp":
    - không bấm, hoặc bấm "Giảm tốc"/"Dừng lại": 0 điểm, không mất mạng;
    - bấm "Không rẽ, không vào": sai, mất mạng.
  - hết 3 mạng thì các biển sau không tính.
- Nhật ký bị chấm 0 cả bước đường chạy, không từ chối và không cho gửi lại (người dùng chọn ngày 25/9/2026), khi:
  - tổng thời gian dài hơn thời gian máy chủ đo quá 10%, cộng dung sai mạng 2 giây;
  - hoặc có mốc sau lúc kết thúc.
- Thao tác đúng được gửi kèm đề đường chạy:
  - để điện thoại phản hồi ngay và tính mạng bằng cùng hàm chấm của máy chủ;
  - máy chủ vẫn chấm lại từ nhật ký;
  - tên biển, giải thích và căn cứ chỉ hiện sau khi chấm.
  - Đây là đánh đổi: người biết lập trình có thể đọc được đáp án. Điểm XP vẫn bị giới hạn theo số lượt trong ngày.
- Tab ẩn thì đường chạy tạm dừng. Ẩn quá 10 giây thì kết thúc; các biển chưa tới không tính.
- Chế độ giảm chuyển động (chế độ từng bước):
  - đường đứng yên;
  - biển hiện tĩnh giữa màn, đếm số giây còn lại của cửa sổ (2–3 giây, không cố định 3 giây như dự kiến), để chấm giống hệt chế độ thường.
- Biển phụ (S.) không dùng trong trò, vì không đứng một mình trên đường. Biển có phản ứng phủ 4 nhóm: cấm, nguy hiểm, hiệu lệnh, chỉ dẫn.
- Trò không có mức phạt: kho văn bản chưa có văn bản xử phạt lỗi không chấp hành biển báo (Nghị định số 168/2024/NĐ-CP chưa có trong kho). Lời giải thích chỉ nói thao tác đúng.
- Offline:
  - Gói offline có danh sách biển, không kèm ảnh. Ảnh hiện được khi đã có trong bộ nhớ đệm của service worker, tức là đã xem hoặc đã được đường chạy tải trước khi còn mạng.
  - Khi đồng bộ, khung chung chỉ kiểm lại trạng thái duyệt của câu hỏi. Biển bị gỡ duyệt sau khi tải gói vẫn được chấm.
- Hiệu ứng riêng đã duyệt: đèn phanh và đường chậm lại khi bấm Giảm tốc/Dừng; biển xử lý xong lướt về dải "biển đã qua" kèm dấu; mạng là 3 vô lăng, mất mạng thì vô lăng nứt.

**Dữ liệu demo, chưa duyệt.**
- `data/bien-bao/bien-bao.json` có 31 biển:
  - 13 biển cũ từ GĐ12, trong đó 12 biển được thêm phản ứng;
  - 18 biển mới soạn cho trò này.
- Có 30 biển có `phan_ung` và `ghi_chu_phan_ung`, tất cả ở trạng thái nháp, `ghi_chu` ghi "dữ liệu demo, chưa duyệt".
- Mã, tên, ý nghĩa của 18 biển mới soạn theo hiểu biết của người soạn về QCVN 41 (bản 2019), **chưa đối chiếu QCVN 41:2024/BGTVT**, vì kho chưa có văn bản này.

**Cần đơn vị chuyên môn kiểm tra trước khi duyệt dữ liệu của trò này:**

| # | Nội dung | Ở đâu | Vì sao cần kiểm |
|---|---|---|---|
| 1 | Mã, tên, ý nghĩa, căn cứ của cả 31 biển, nhất là 18 biển mới (P.101, P.123b, P.124a, P.128, P.136, W.201a, W.203b, W.207a, W.208, W.210, W.211a, W.227, W.245a, R.122, R.301a, I.409, I.423b, I.434a) | `data/bien-bao/bien-bao.json` | Soạn khi kho chưa có QCVN 41:2024/BGTVT; mã biển có thể đã đổi giữa bản 2019 và 2024 |
| 2 | Bộ 4 thao tác có đủ và đúng nghiệp vụ không | Luật chơi ở trên | Một số biển khó diễn đạt bằng 4 nút (đi theo hướng chỉ, cấm quay đầu) |
| 3 | P.127 Tốc độ tối đa: "Giảm tốc" | Trường `phan_ung` | Đúng hay không phụ thuộc tốc độ đang chạy; trò giả định xe đang chạy nhanh hơn số trên biển. Có nên giữ biển này không? |
| 4 | P.106a Cấm xe ô tô tải: "Đi tiếp" | Như trên | Biển có cấm cả loại xe khác, có biển phụ khối lượng không |
| 5 | P.124a Cấm quay đầu: "Không rẽ, không vào" | Như trên | Nhãn nút có phù hợp không |
| 6 | R.302a, R.301a (biển hiệu lệnh hướng đi): "Đi tiếp" | Như trên | "Đi tiếp" có đủ nghĩa "đi theo hướng biển chỉ" không |
| 7 | R.122 Dừng lại (STOP): mã và nhóm trong QCVN 41:2024 | Như trên | Soạn theo bản 2019 |
| 8 | W.207a (đường không ưu tiên): "Đi tiếp"; W.208 (đường ưu tiên): "Giảm tốc" | Như trên | Có trường hợp nào phải dừng; giảm tốc ở W.207a có nên tính đúng không |
| 9 | W.211a Giao nhau với đường sắt không có rào chắn: "Giảm tốc" | Như trên | Quy tắc có bắt buộc dừng lại để quan sát không; nếu có thì đổi thành "Dừng lại" |
| 10 | I.423b Đường người đi bộ sang ngang (biển chỉ dẫn): "Giảm tốc" bắt buộc | Như trên | Bỏ qua biển chỉ dẫn này có nên mất mạng không |
| 11 | Mọi lời giải thích phản ứng (`ghi_chu_phan_ung`) | Như trên | Hiện cho người chơi sau khi chấm |

**Ảnh cần bổ sung** (hiện dùng hình SVG tự vẽ tối giản trong `data/bien-bao/anh/` và `components/tro-choi/DuongChay.tsx`):

| Ảnh | Hiện dùng | Yêu cầu |
|---|---|---|
| Ảnh chính thức của 31 biển | Hình tự vẽ theo dáng biển; W.207a, W.208, W.210, W.211a còn thô | Theo QCVN 41:2024/BGTVT, SVG ≤ 20 KB mỗi biển, rõ ở cỡ 32px (dải biển đã qua) và 128px (chế độ từng bước) |
| Xe của người chơi nhìn từ trên xuống | Khối chữ nhật bo góc, kính, đèn phanh | SVG ≤ 8 KB, có đèn phanh tách lớp để bật sáng |
| Mặt đường, lề đường | Nền phẳng, vạch kẻ giữa | Tùy chọn: vạch kẻ hai bên, cây, cột mốc (giữ ≤ 30 phần tử động) |
| Biển trên cột bên đường | Chỉ có biển | Tùy chọn: cột biển, để biển trông như cắm bên đường |

### 5.6. Hiện trường

**Luật chơi**
- Một kịch bản gồm 4–8 bước quyết định. Mỗi bước: mô tả diễn biến (có thể kèm hình), 2–4 lựa chọn.
- Mỗi lựa chọn dẫn tới một bước khác và có **hậu quả** hiện ngay (ví dụ "Chưa đặt biển cảnh báo: xe phía sau suýt đâm vào hiện trường").
- Kịch bản kết thúc ở một nút kết thúc. Màn **đánh giá cuối lượt** liệt kê từng quyết định, lựa chọn tốt nhất ở bước đó, căn cứ (URN điều khoản hoặc bước quy trình).
- Không tính giờ; có thể chơi lại để thử nhánh khác.

**Chấm điểm**
- Mỗi lựa chọn có điểm do người soạn đặt (ví dụ tốt nhất 10, chấp nhận được 5, sai 0, nguy hiểm −5).
- Tỷ lệ = tổng điểm đường đã đi / tổng điểm của **đường tốt nhất** trong cây (tính bằng duyệt cây khi lưu, nên đường dài hay ngắn đều so sánh công bằng).
- Nút kết thúc có mức đánh giá (Xuất sắc / Đạt / Chưa đạt) theo tỷ lệ, kèm lời nhận xét do người soạn viết.

**Dữ liệu cần**
- `game_content` loại `hien_truong`. `payload`: `{ bat_dau, nut: { <id>: { loai: "quyet_dinh" | "ket_thuc", noi_dung, hinh?, lua_chon?: [{ id, text, den, hau_qua }] } } }`. `answer`: điểm, lời giải thích, căn cứ của từng lựa chọn.
- Kiểm khi lưu: một nút bắt đầu; mọi nút tới được từ nút bắt đầu; không có chu trình; mọi đường đều tới nút kết thúc; tối đa 8 bước trên một đường; mỗi lựa chọn có căn cứ hoặc trỏ tới một bước của `procedures`.
- Kịch bản vi phạm soạn từ 2 quy trình có sẵn ở `data/tra-cuu/quy-trinh.json`. Kịch bản **tai nạn** chờ văn bản nghiệp vụ khách hàng cung cấp (GAP 4.5-25).

**Offline:** Có.

**Độ khó triển khai: Trung bình.** Phần tốn công là trình soạn cây cho biên tập viên (danh sách thụt lề, có sơ đồ xem trước), không phải phần chơi.

### 5.7. Bộ đàm

**Luật chơi**
- Một lượt 5 "cuộc gọi". Mỗi cuộc gọi: hệ thống đọc câu hỏi bằng giọng nói, có tiếng rè và tiếng "bíp" như bộ đàm.
- Người chơi **giữ nút bộ đàm** để nói câu trả lời, thả ra để gửi. Mỗi cuộc gọi 20 giây tính từ lúc đọc xong câu hỏi.
- Câu hỏi là câu trắc nghiệm, đúng/sai, hoặc điền con số (mức phạt, tốc độ, số điểm trừ).
- Không chắc đã nghe đúng thì hệ thống hỏi lại một lần ("Nhắc lại, hết"), không đoán.

**Chấm điểm**
- Đúng 10 điểm, cộng thưởng nhanh. Hỏi lại không trừ điểm; hỏi lại lần hai vẫn không rõ thì tính sai.
- Trắc nghiệm, đúng/sai: dùng `khop-loi-noi.ts` của GĐ14.
- Câu điền con số: mở rộng `khop-loi-noi.ts` để đọc số nói bằng chữ ("tám trăm nghìn", "một triệu hai") và so với đáp án trong ngân hàng.
- Câu trả lời tự do chấm bằng AI: **không làm ở bản đầu**, chờ Q9.

**Dữ liệu cần**
- Câu hỏi ngân hàng đã duyệt, loại `mot_dap_an`, `dung_sai`, `dien_khuyet` có đáp án là số. Không cần bảng mới.
- Âm thanh câu hỏi dựng trước và lưu đệm theo băm nội dung (đã có).

**Offline:** Không. Nhận dạng giọng nói của Chrome gửi âm thanh lên máy chủ Google.

**Độ khó triển khai: Thấp.** Nâng cấp trò "Hỏi nhanh bằng giọng nói" đã có; phần mới là đọc số bằng chữ và hiệu ứng âm thanh.

### 5.8. Lệnh trực hằng ngày

**Luật chơi**
- Mỗi ngày (theo giờ Việt Nam) mỗi người nhận một "lệnh trực" gồm 5 câu **riêng cho mình**. Mở lại trong ngày thì vẫn là 5 câu đó.
- Làm đủ 5 câu thì hoàn thành lệnh trực của ngày và giữ chuỗi ngày.
- Thẻ "Lệnh trực hôm nay" ở trang chủ thay cho thẻ "Thử thách hôm nay" (Q3).

**Chọn 5 câu, theo thứ tự ưu tiên**
1. Câu **đến hạn ôn** trong `question_memory` (quá hạn lâu nhất trước).
2. Câu trong **Câu sai của tôi** chưa đến hạn.
3. Câu chưa làm thuộc **chủ đề yếu nhất** trong hồ sơ chủ đề.
4. Câu chưa làm bất kỳ, trộn mức độ.

Tối đa 3 câu từ nhóm 1–2, để lệnh trực không toàn câu đã sai. Câu có căn cứ vừa thay đổi (thẻ bị treo theo `srs.ts`) không được chọn.

**Chấm điểm**
- Đúng 1 điểm mỗi câu. Hoàn thành lệnh trực (làm đủ 5 câu, không cần đúng hết) được XP cố định + XP theo câu đúng.
- Cập nhật SM-2 bằng `onThe` của `srs.ts`: sai → chất lượng 1; đúng → 4. Ngày tính theo giờ Việt Nam (`ngayVietNam`), không dùng `ngayHomNay` (UTC) của `srs.ts`.

**Dữ liệu cần**
- Câu hỏi ngân hàng đã duyệt. `question_memory`, `duty_orders` (§4.2).

**Offline:** Có. Gói offline gồm lệnh trực của hôm nay và một kho dự phòng khoảng 40 câu (câu đến hạn trong 7 ngày tới, câu sai, câu chủ đề yếu). Ngày không có mạng, điện thoại tự chọn 5 câu từ kho dự phòng bằng cùng hàm chọn. Khi đồng bộ, máy chủ ghi `duty_orders` của ngày đó theo lượt offline nếu ngày đó chưa có lệnh trực online.

**Độ khó triển khai: Thấp.** Mọi mảnh đã có: rút câu, SM-2, chuỗi ngày, gói offline.

### 5.9. Đối đầu 1–1

**Luật chơi**
- Bấm "Tìm đối thủ". Hệ thống ghép với người đang chờ, ưu tiên cùng cấp độ (chênh không quá 2 cấp), trong tối đa 20 giây.
- Hai người nhận **cùng 7 câu**, cùng lúc; mỗi câu 15 giây. Sau mỗi câu, cả hai thấy đáp án đúng và điểm của nhau.
- **Không có đối thủ sau 20 giây:** đấu với **lượt đã ghi** của một người khác (gọi là "đấu với bóng"). Bóng là một trận đã chơi xong trên cùng bộ 7 câu; hệ thống phát lại đúng đáp án và thời gian trả lời của người đó.

**Chấm điểm**
- Mỗi câu đúng: 10 điểm + thưởng nhanh tới 5 điểm. Tổng điểm cao hơn thì thắng; bằng điểm thì hòa.
- Thắng nhận thêm XP; thua vẫn nhận XP theo câu đúng. Thắng bóng nhận XP như thắng người thật.
- Người rời trận giữa chừng thì các câu còn lại tính 0; người ở lại thắng.

**Dữ liệu cần**
- Câu hỏi ngân hàng đã duyệt, loại một đáp án hoặc đúng/sai (trả lời được trong 15 giây).
- `duel_matches`, `duel_players`; mỗi người trong trận có một `game_runs` riêng với đủ thời gian từng bước, nên lượt đó dùng được làm bóng cho người sau.
- **Chọn bóng:** một lượt đối đầu đã xong trong 30 ngày, của người khác, chênh không quá 2 cấp, người đó chưa bị ghép làm bóng với người chơi này trong 7 ngày. Bộ câu của trận mới lấy theo bộ câu của lượt bóng.
- **Khởi động khi chưa có lượt ghi nào:** cần một ít lượt mẫu do cán bộ thật chơi trước, hoặc một "bóng máy" sinh từ tỷ lệ đúng và thời gian trung vị của từng câu (Q10).

**Kỹ thuật**
- WebSocket trên API: Hono có `upgradeWebSocket` cho Bun, `Bun.serve` đã dùng ở `apps/api/src/index.ts`.
- Token đăng nhập nằm trong cookie HttpOnly của web, nên trình duyệt xin một **vé kết nối** dùng một lần (30 giây) qua resource route của web, rồi mở WebSocket thẳng tới API bằng vé đó.
- Máy chủ giữ đồng hồ và chấm. API hiện chạy **1 instance** (`.do/app.yaml`), nên phòng đấu giữ trong bộ nhớ là đủ. Khi tăng lên 2 instance trở lên, chuyển hàng chờ và phòng sang Redis (Valkey có sẵn).
- Rớt kết nối: cho 10 giây để nối lại vào đúng phòng; quá hạn thì tính rời trận.

**Offline:** Không.

**Độ khó triển khai: Cao.** Kênh thời gian thực, ghép cặp, nối lại khi rớt mạng, và test cho các trường hợp đó.

### 5.10. Mùa giải đơn vị

**Luật chơi**
- Một **mùa** kéo dài 12 tuần (đề xuất). Đơn vị cùng cấp (ví dụ các Đội) thi với nhau; cấp thi đua do quản trị chọn khi tạo mùa.
- Các đơn vị chia thành **4 hạng** (Hạng 1 cao nhất). Mỗi hạng chia **nhóm** khoảng 8–12 đơn vị.
- **Điểm tuần của đơn vị** = tổng XP tính mùa giải của thành viên trong tuần / **quân số** của đơn vị (mọi tài khoản đang hoạt động, không chỉ người có chơi). Chia cho quân số để đơn vị đông người không luôn đứng đầu, và để khuyến khích mọi người cùng tham gia.
- **XP tính mùa giải** của một người trong một tuần có trần (đề xuất 700 XP), để một người không gánh cả đơn vị.
- Đơn vị có dưới 3 thành viên đang hoạt động không xếp hạng, vì quá dễ có điểm trung bình cao. Bằng điểm thì đơn vị có tỷ lệ người tham gia cao hơn đứng trên.
- Cuối tuần, trong mỗi nhóm: **2 đơn vị đầu lên hạng, 2 đơn vị cuối xuống hạng** (hạng cao nhất không lên, hạng thấp nhất không xuống). Tuần sau chia nhóm lại.
- Mùa đầu tiên: xếp hạng ban đầu theo XP trung bình của 4 tuần trước đó. Mùa sau: mỗi đơn vị xuống một hạng so với cuối mùa trước (đặt lại mềm), để mùa mới vẫn có chỗ tiến.

**Chấm điểm**
- Không có lượt chơi riêng. Nguồn là `xp_ledger` theo `unit_id` (§2.5), gồm XP từ mọi trò chơi, luyện tập, thi, bài giảng.
- **Chốt tuần:** job lặp chạy **06:00 thứ Hai** giờ Việt Nam (để lượt offline chơi tới nửa đêm Chủ nhật kịp đồng bộ). XP của tuần đã chốt mà đồng bộ muộn hơn vẫn vào hồ sơ cá nhân, không vào mùa giải.
- Trong tuần, bảng hạng tính trực tiếp từ `daily_activity` và `xp_ledger`, không lưu.

**Dữ liệu cần**
- `seasons`, `season_standings` (§4.2). Cây đơn vị `units` (GĐ2).

**Offline:** Không áp dụng. Màn hình mùa giải cần mạng.

**Độ khó triển khai: Trung bình.** Tính toán đơn giản; phần cần cẩn thận là luật công bằng (đơn vị ít người, đơn vị mới, đơn vị đổi cây) và test qua mốc chốt tuần.

---

## 6. Lớp trò chơi hóa dùng chung

### 6.1. XP, cấp độ, huy hiệu, chuỗi ngày

Giữ nguyên phần GĐ9, thêm:

- **XP** theo §2.5, có giảm dần khi chơi lặp.
- **Cấp độ:** không đổi bảng ngưỡng `NGUONG_CAP`. Cấp dùng thêm để ghép đối thủ (§5.9).
- **Huy hiệu:** `badges.rule` nhận thêm các chỉ số theo trò: `so_luot:<mã>`, `sao_3:<mã>`, `thang_doi_dau`, `lenh_truc_lien_tiep`, `len_hang_mua_giai`. Đề xuất 1–2 huy hiệu mỗi trò, ví dụ "Mắt tinh" (Chốt tuần tra 3 sao, không dừng nhầm xe nào), "Biên bản chuẩn" (10 biên bản đúng cả 4 ô), "Trực đủ tháng" (30 lệnh trực liên tiếp).
- **Chuỗi ngày:** không đổi. Một ngày có học = một ngày có XP > 0 (luyện tập, trò chơi, bài giảng, thi).

### 6.2. Hồ sơ điểm mạnh, điểm yếu theo chủ đề

- **Cập nhật:** mỗi bước đã chấm có chủ đề gọi `ghiKetQuaChuDe(tx, người, chủ đề, đúng)`: tăng `attempts`, `correct`, cập nhật `score_ema = 0,8 × cũ + 0,2 × (đúng ? 1 : 0)`. Nguồn gồm luyện tập (GĐ4), thi (GĐ6, khi nộp) và mọi trò chơi.
- **Chủ đề của từng loại nội dung:** câu hỏi đã có `topic_id`; `game_content`, `violations`, `traffic_signs`, `procedures`, `speed_limits` thêm `topic_id` ở GĐ-G0. Dòng chưa gắn chủ đề thì không cập nhật hồ sơ.
- **Chủ đề mạnh/yếu:** chỉ tính chủ đề có từ 5 lượt trả lời. Yếu = `score_ema` thấp nhất; mạnh = cao nhất. Chủ đề con gộp lên chủ đề cha khi chủ đề con chưa đủ 5 lượt.
- **Hiển thị ở `/toi`:** 3 chủ đề mạnh nhất, 3 chủ đề yếu nhất (thanh ngang và phần trăm), mỗi chủ đề yếu có nút "Luyện chủ đề này".
- **Dùng ở đâu:** Lệnh trực (§5.8), gợi ý trò chơi ở trang Trò chơi, và (nếu Q14 cho phép) báo cáo của cán bộ quản lý.
- Hồ sơ tính lại được từ `practice_answers`, `exam_answers`, `game_run_steps` bằng script, nên đổi công thức không mất dữ liệu.

---

## 7. Những điểm cần anh/chị quyết định

Mỗi câu có đề xuất; kế hoạch đang làm theo đề xuất, trả lời khác thì sửa phần ghi ở cột cuối.

| # | Câu hỏi | Đề xuất | Nếu chọn khác |
|---|---|---|---|
| Q1 | `docs/PRD.md` hiện chỉ có mục V. Anh/chị có bản PRD đầy đủ để đưa vào repo không? | Dán các mục còn lại vào đúng chỗ đánh dấu trong tệp | — |
| Q2 | 5 trò đã làm (vượt màn, đua thời gian, ghép cặp, đoán biển báo, hỏi nhanh giọng nói) xử lý thế nào? | Theo PRD §V.4: vượt màn giữ trong Luyện tập; hỏi nhanh → Bộ đàm; đoán biển báo → phần khởi động của Cung đường; đua thời gian, ghép cặp ẩn khỏi menu, không xóa mã, không chuyển dữ liệu sang `game_runs` |
| Q3 | Lệnh trực **thay** thử thách hằng ngày (5 câu chung cho mọi người), hay có cả hai? | Thay. Hai thẻ "5 câu mỗi ngày" trên trang chủ dễ gây nhầm | 
| Q4 | Mức phạt, biển báo, quy trình chuyển sang **duyệt trong ứng dụng** (như câu hỏi), thay cho duyệt qua tệp JSON trong repo? | Có. Đây là điều kiện để "mọi nội dung trò chơi qua cùng một quy trình duyệt" | 
| Q5 | Lời bào chữa (Người vi phạm nói gì?) lưu là **câu hỏi ngân hàng có ngữ cảnh**, dùng được cả trong luyện tập và thi? | Có. Không phải duy trì bảng thứ hai, và câu đếm vào mục tiêu 1.000 câu | Tách bảng: chuyển sang `game_content`, không dùng được trong thi |
| Q6 | Văn bản nào làm căn cứ tốc độ tối đa theo loại đường và loại xe? Khách hàng cung cấp bảng, hay đội dự án trích từ văn bản rồi khách hàng duyệt? | **Đã chốt 25/9/2026:** chưa có văn bản trong kho, Súng bắn tốc độ chỉ dùng số trên biển P.127. Bảng tốc độ theo loại đường để trống, chờ đơn vị chuyên môn điền (§5.2) | Có văn bản và số liệu đã duyệt: thêm dữ kiện loại đường vào tình huống, không đổi cách chấm |
| Q7 | Lập biên bản chấm mức phạt thế nào: đúng khi **trong khung**, hay phải đúng **mức cụ thể** (mức trung bình của khung, tăng giảm theo tình tiết)? Biểu mẫu là bản rút gọn 4 ô hay theo mẫu biên bản thật? | Trong khung, biểu mẫu 4 ô ở bản đầu | Mức cụ thể: thêm quy tắc tình tiết vào `lap-bien-ban.ts` và trường tình tiết vào tình huống |
| Q8 | Hình vẽ cho Chốt tuần tra và Cung đường: đội dự án tự vẽ SVG đơn giản, hay thuê họa sĩ? Ảnh biển báo chính thức lấy từ đâu (GAP 4.5-24)? | Tự vẽ bộ hình SVG tối giản ở bản đầu | Thuê vẽ: thêm 2–3 tuần chờ, mã không đổi (cảnh dựng từ dữ liệu) |
| Q9 | Bộ đàm có dùng AI chấm câu trả lời nói tự do không? (tốn phí, và gửi nội dung ra dịch vụ nước ngoài) | Không ở bản đầu; chỉ trắc nghiệm, đúng/sai, con số | Có: thêm chấm bằng mô hình nhỏ, có hạn mức mỗi người mỗi ngày như hỏi đáp AI |
| Q10 | Đối đầu: hiện họ tên thật hay biệt danh? Có cần người chơi đồng ý cho lượt của mình được dùng làm "bóng"? Khi chưa có lượt ghi nào, dùng "bóng máy" sinh từ thống kê được không? | Họ tên và đơn vị (như bảng xếp hạng GĐ9); không cần đồng ý riêng, ghi trong hướng dẫn; có bóng máy, ghi rõ "Đối thủ mô phỏng" | Biệt danh: thêm trường biệt danh ở `/toi` |
| Q11 | Mùa giải: cấp đơn vị nào thi với nhau? Độ dài mùa, số hạng, số đơn vị lên/xuống, trần XP mỗi người mỗi tuần? Có gắn với thi đua khen thưởng thật không? | Cấp Đội; 12 tuần; 4 hạng; lên 2 xuống 2; trần 700 XP. Không gắn khen thưởng ở bản đầu |
| Q12 | XP từ lượt chơi lặp lại trong ngày có giảm dần không (§2.5)? | Có: lượt 1–3 đủ, 4–6 một nửa, từ lượt 7 không có | Không giảm: mùa giải dễ bị "cày" |
| Q13 | Lượt chơi offline có tính vào mùa giải không? | Có, nếu đồng bộ trước 06:00 thứ Hai; không có thưởng nhanh | Không: mùa giải chỉ tính lượt online |
| Q14 | Cán bộ quản lý có được xem **hồ sơ điểm yếu** của từng người trong đơn vị không? | Chỉ xem tổng hợp theo đơn vị (chủ đề đơn vị yếu), không xem từng người | Xem từng người: thêm cột vào báo cáo GĐ7 |
| Q15 | Kịch bản Hiện trường về **tai nạn** dựa trên văn bản nào? Có tài liệu nghiệp vụ nội bộ không được đưa lên máy chủ Internet không (GAP 4.5-25)? | Bản đầu chỉ có kịch bản xử lý vi phạm, từ quy trình công khai | — |
| Q16 | Có cần âm thanh (tiếng còi, tiếng bộ đàm, nhạc nền) không? Trong môi trường công tác có thể phải tắt tiếng. | Chỉ Bộ đàm có âm thanh (bắt buộc). Các trò khác không có âm thanh ở bản đầu | Có âm thanh: thêm nút tắt tiếng dùng chung ở `KhungGame` |

---

## 8. Rủi ro

| Rủi ro | Ảnh hưởng | Cách giảm |
|---|---|---|
| Dữ liệu mức phạt, biển báo, tốc độ tối đa vẫn là bản nháp (GĐ5, GĐ12 ghi rõ) | Súng bắn tốc độ, Lập biên bản, Chốt tuần tra, Cung đường **không có nội dung để chơi** trên dữ liệu thật | Đưa việc đối chiếu dữ liệu vào đầu GĐ-G0 (màn hình duyệt), làm song song với mã. Mỗi giai đoạn trò chơi có mục kiểm tra "đủ nội dung đã duyệt" |
| Kho chưa có NĐ 168/2024, QCVN 41:2024 | Căn cứ không mở được, CI kiểm căn cứ báo hỏng | Nạp văn bản trước (LENH.md §3.1a, số hóa QCVN 41 qua MCP) |
| Người chơi tối ưu cho XP thay vì cho kiến thức | Mùa giải lệch | Giảm dần XP khi chơi lặp, trần XP tuần, chia theo quân số |
| Hoạt cảnh chậm trên điện thoại cũ | Cung đường khó chơi | Ngân sách khung hình: ≤ 30 phần tử SVG động; đo trên Chrome giả lập CPU chậm 4×; có chế độ từng bước |
| Đối đầu ít người online cùng lúc | Người chơi chủ yếu đấu với bóng | Thiết kế đã coi đấu với bóng là đường chính; ghép người thật là phần thêm |
| Nội dung một trò lệch với văn bản sau khi văn bản được sửa | Dạy sai quy định | Kiểm căn cứ trong CI; nội dung trỏ tới mức phạt đã đổi tự rút khỏi trò chơi (§3.2) |
