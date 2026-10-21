# PROMPT LÀM HỘP KẾT QUẢ ĐÚNG/SAI CHO TRÒ CHƠI

*Soạn ngày 30/9/2026. Dùng cho phiên trợ lý lập trình (Claude Code) làm việc trong repo này. Cùng khuôn với [PROMPT_NHOM_HOC_CUNG.md](PROMPT_NHOM_HOC_CUNG.md).*

**Chức năng:** trong các trò chơi, khi người chơi trả lời (chốt đáp án) thì kết quả hiện trong một hộp thoại (modal): hộp "Đúng" hoặc hộp "Chưa đúng". Phần giải thích vì sao đúng hoặc sai (giải thích, căn cứ pháp lý, danh sách lỗi) **thu gọn** sau nút "Xem chi tiết" trong hộp. Người chơi bấm nút đó thì phần chi tiết mới hiện ra.

Chức năng này chỉ sửa giao diện web. Không sửa API, không có migration.

---

## 0. Cách dùng

1. **Chạy Prompt 0 trước, một lần.** Prompt này đưa chức năng vào [PLAN.md](PLAN.md) thành GĐ17a đến GĐ17c. Chưa viết mã.
2. **Trả lời các câu H1–H11 ở mục 2.8 và đề xuất Đ1–Đ12 ở mục 2.9** (ghi vào cột "Trả lời"). Câu nào còn trống thì phiên làm mã sẽ dừng lại hỏi.
3. **Mỗi giai đoạn một phiên riêng.** Dán nguyên khối prompt của giai đoạn (mục 4) vào phiên mới. Mỗi prompt đã tự trỏ về Phần chung (mục 1) và Đặc tả (mục 2).
4. **Thứ tự bắt buộc:** GĐ17a → GĐ17b → GĐ17c. GĐ17b và GĐ17c đều dùng component làm ở GĐ17a.
5. **Không chạy song song** với phiên khác đang sửa `apps/web/app/routes/tro-choi.luot.tsx`, `apps/web/app/components/tro-choi/**` hoặc các tệp `scripts/e2e/` của trò chơi.

| GĐ | Nội dung | Phụ thuộc | Migration |
|---|---|---|---|
| 17a | Component hộp kết quả và khối "Xem chi tiết"; áp cho khung chơi chung (`/tro-choi/luot/:id`), chơi offline, Vượt màn | GĐ-G0, GĐ16b (`HopThoai`) | Không |
| 17b | Ba trò riêng lẻ: Đua thời gian, Hỏi nhanh giọng nói, Ghép cặp | 17a | Không |
| 17c | Chuyển khối kết quả dài của từng trò (danh sách lỗi, biên bản, bảng so sánh) vào "Xem chi tiết" | 17a | Không |

---

## 1. Phần chung (mọi prompt đều trỏ về đây)

> Mọi phiên làm GĐ17a–17c phải đọc và theo đúng phần này.

### 1.1. Người dùng

- Cán bộ, chiến sĩ CSGT, chơi trên điện thoại xen giữa ca trực, thường chơi một tay.
- Sau mỗi câu, người chơi cần biết ngay **đúng hay chưa đúng** và điểm được. Phần lớn người chơi bấm sang câu tiếp ngay. Người muốn học kỹ thì bấm "Xem chi tiết" để đọc giải thích và căn cứ.
- Hiện nay giải thích và căn cứ luôn bày sẵn dưới câu hỏi, đẩy nút "Câu tiếp" xuống xa trên màn hình 360×740.

### 1.2. Tài liệu phải đọc trước khi làm

- [PLAN.md](PLAN.md) §0 (cổng kiểm §0.2, bảng kiểm giao diện §0.4), GĐ-G0 (khung chơi chung) và GĐ16b (hộp thoại dùng chung) làm mẫu cách ghi "Trạng thái".
- [GAME_DESIGN.md](GAME_DESIGN.md) §1 (quy tắc chung của trò chơi).
- [QUY-TAC-HANH-VAN.md](../QUY-TAC-HANH-VAN.md) và [VISUAL_STYLE.md](VISUAL_STYLE.md).
- Mục 2 của tệp này và câu trả lời ở mục 2.8.

### 1.3. Hiện trạng mã (khảo sát ngày 30/9/2026, kiểm lại trước khi dựa vào)

*Đối chiếu lại với mã ngày 30/9/2026 (Prompt 0). Tên tệp, tên hàm, số mili giây ở bản khảo sát đều khớp. Đã sửa hoặc bổ sung:*
- *HopThoai đang dùng ở 10 hộp `components/nhom/Hop*.tsx` (thêm `HopGoiYThuTu` của GĐ16d), không phải 9; tổng cộng 11 hộp tính cả hộp ở `/tro-choi`.*
- *Danh sách kịch bản e2e thiếu `cam-bien.ts`, `chot-dem.ts`, `soi-camera.ts`, `tu-lai.ts` (và `dung-xe.ts` ở nhóm này). Các kịch bản đó bấm nút "Xem kết quả" trên trang sau bước cuối. Phần chơi offline của trò chơi nằm trong `tro-choi-khung.ts`. `offline.ts` là luyện tập offline (`/luyen-tap/offline`), không phải trò chơi offline.*
- *Bổ sung các điểm ảnh hưởng tới đặc tả: `DongDiem` không được export; `DauKetQua` chỉ có hai màu; `DanhSachBuoc` cũng in "Chưa đúng" khi `dung === null`; kiểu `nguon` ở web chưa có `game:*`; trang Vượt màn không nằm trong vùng trò chơi; `.sheet` không có vùng nút dính đáy; hiệu ứng của `HopThoai` không tắt theo `data-giam-hieu-ung`; `DongHoBuoc` tự phát âm và tính mốc lúc gắn; `routes/game-style-demo.tsx` cũng dùng `PhanHoiBuoc`. Đề xuất xử lý ở mục 2.9.*

**Chưa trò nào dùng hộp thoại để báo kết quả.** Kết quả luôn là một khối nằm ngay dưới câu hỏi. Có ba đường hiển thị khác nhau:

**A. Phiên luyện tập** (`routes/luyen-tap.phien.tsx`, trang `/luyen-tap/:phien`)
- Chỉ trò Vượt màn đi đường này: action của `routes/tro-choi.vuot-man.tsx` chuyển sang `/luyen-tap/{id}?cau=1`. Luyện tập thường, thử thách hằng ngày và đề ôn tập của nhóm cũng dùng trang này.
- Khối kết quả là `components/luyen-tap/PhanHoiCauTraLoi.tsx`:
  - hộp `role="status"` viền trái xanh hoặc đỏ, chữ "Đúng." hoặc "Chưa đúng.", đoạn `giai_thich`;
  - mỗi URN trong `can_cu` là một nút `aria-haspopup="dialog"`, bấm vào mở `NganKeoCanCu` (cùng tệp).
- `NganKeoCanCu` **không phải** `<dialog>` gốc: là thẻ `div` `fixed inset-0 z-50`, `role="dialog"`, `aria-label="Căn cứ pháp lý"`, tự nghe phím Esc trên `document`, tự khóa cuộn `body`. Nó tải `/luyen-tap/can-cu?urn=` rồi hiện bằng `NoiDungDieu`.
- Đi tiếp: nút "Kiểm tra", rồi liên kết "Câu tiếp" (`?cau=N+1`) hoặc biểu mẫu "Xem kết quả". Không tự chuyển câu, không có đồng hồ. Vượt màn: "Xem kết quả" chuyển về `/tro-choi/vuot-man/:chu_de_id?man=…&sao=…`.
- Nhận biết Vượt màn: API trả `nguon` là `practice_sessions.source`, phiên Vượt màn có `game:vuot_man`. Nhưng kiểu web `PhienLuyenTap.nguon` (`lib/luyen-tap.server.ts`) chỉ khai `"chu_de" | "cau_sai" | "thu_thach" | "nhom"`. Trong các nguồn `game:*`, chỉ Vượt màn mở trang này; Đua và Hỏi nhanh có trang riêng.
- Trang không bọc `KhungGame` hay `VungTroChoi`: không có `data-khu="tro-choi"`, `data-giam-hieu-ung`, không nạp `hieu-ung/tro-choi.css`, không phát âm thanh hay rung.
- Kết quả kiểu `KetQuaCauHoi` (`dung: boolean`, `ty_le`, `dap_an`, `giai_thich`, `can_cu`), **không có** điểm, thưởng, `het_gio`.
- `ketQua = cau.ket_qua ?? tuFetcher`: action không chặn tải lại loader, nên sau khi chấm `cau.ket_qua` có ngay. "Vừa chấm" chỉ nhận ra qua `tuFetcher`. Component không đặt `key` theo câu.

**B. Khung chơi chung** (`routes/tro-choi.luot.tsx`, hàm `BuocDangChoi`; chơi offline ở `routes/tro-choi.offline.tsx`)
- Dùng cho mọi trò mới đăng ký trong `components/tro-choi/giao-dien.tsx`: cung đường biển báo, lập biên bản, súng bắn tốc độ, thử nghiệm, kiểm tra giấy tờ, dừng xe, cắm biển, soi camera, tự lái, duyệt phạt nguội, trạm cân, lên xe khách, chốt đêm, soi xe cải tạo.
- Sau khi chấm, trang vẽ hai thứ:
  1. `gd.Buoc` với `daCham` và `chiTiet`: bảng chơi của từng trò, tự tô đáp án và nhiều trò vẽ thêm khối kết quả dài ngay tại chỗ (xem GĐ17c);
  2. `components/tro-choi/PhanHoiBuoc.tsx` bên dưới.
- `PhanHoiBuoc`:
  - `DauKetQua` (dấu tích hoặc dấu chéo có hiệu ứng, export, chỉ nhận `dung: boolean` nên chỉ có hai màu `ok`/`danger`) và `DongDiem` (hàm nội bộ, **chưa export**; tiêu đề "Hết giờ" / "Đúng" / "Chưa đúng", "Điểm: x/y", "thưởng nhanh +N", số "+N" bay lên);
  - `dung === null` hiện thành "Chưa đúng" màu đỏ, kể cả khi được một phần điểm (xem H6);
  - phát âm thanh `phatAm` và rung `rung` một lần trong `useEffect`, bỏ qua khi `het_gio` hoặc `hoatAnh = false`;
  - có mạng: bọc `PhanHoiCauTraLoi` (giải thích và ngăn kéo căn cứ); offline: khối tĩnh có chữ "Căn cứ: …".
  - Ngoài khung chơi, `routes/game-style-demo.tsx` (trang duyệt hiệu ứng) cũng dựng `PhanHoiBuoc coMang={false}`.
- Trả lời chưa đúng (`dung !== true`, kể cả `null`) và không hết giờ thì bảng chơi rung ngang (`g-rung-ngang`). Hết giờ thì phủ lớp đỏ "Hết giờ".
- Nhiều trò tự có `role="status"` trong bảng chơi: `CamBien`, `SoiCamera`, `TuLai`, `ChotDem`, `SoiXeCaiTao`, `DuongChay`, `MauBienBan` (dấu "ĐẠT"/"CHƯA ĐẠT").
- Trò thay cả bảng chơi bằng khối kết quả khi `daCham`: Cắm biển, Soi camera, Tự lái, Chốt đêm, và **Cung đường biển báo** (đoạn đường chạy thay bằng `KetQuaDuong`).
- Đi tiếp: trước khi chấm là nút "Chốt đáp án" (trò có `anNutChot` thì cử chỉ của trò tự gửi); sau khi chấm là `ButtonLink` tới `?buoc=N+1` với nhãn `gd.nutTiep ?? "Câu tiếp"`, hoặc biểu mẫu "Xem kết quả". Bước sau chỉ được tải khi người chơi bấm, để đồng hồ bước sau chưa chạy trong lúc đọc kết quả (`shouldRevalidate` trong cùng tệp).
- **Đồng hồ:**
  - Đồng hồ từng bước (`DongHoBuoc` có `dung={Boolean(ketQua) || dangGui}`) dừng khi đã có kết quả.
  - Đồng hồ cả lượt (`DongHoBuoc ... phutGiay`) **không dừng** khi đang xem kết quả. Hết giờ thì `hetCa` hiện "Hết giờ" và sau 2500 ms tự gửi `ket-thuc`. Hạn giờ do máy chủ giữ.
  - Hết giờ từng bước: `onHet` bật lớp "Hết giờ" và tự gửi câu trả lời đang có.
  - `DongHoBuoc` không chỉ hiển thị: tự phát tiếng tích 3 giây cuối, âm "hết giờ" và rung khi về 0, gọi `onHet`, đọc mốc 10 và 5 giây qua `aria-live`. Mốc hết giờ tính bằng `Date.now() + conLaiMs` lúc component gắn vào trang.
  - Hai đồng hồ nằm ở `benPhai` của `KhungGame` (góc phải đầu trang).
- Màn cuối lượt: `TongKetLuot` và danh sách "Xem lại từng câu" (`DanhSachBuoc`, cùng tệp `TongKetLuot.tsx`) dùng lại `gd.Buoc` và `PhanHoiBuoc hoatAnh={false}`. Dòng đầu mỗi câu của `DanhSachBuoc` ghi "Câu N" và "Hết giờ" / "Đúng" / "Chưa đúng" · điểm; `dung === null` cũng ra "Chưa đúng" màu đỏ.

**B'. Chơi offline** (`routes/tro-choi.offline.tsx`, hàm `LuotLam`)
- Không dùng `KhungGame`; trang bọc thẳng `VungTroChoi` nên vẫn có `data-khu`, `data-giam-hieu-ung`.
- Chấm trên máy (`chamBuocCoGio`), lưu lượt trên máy (`luuLuot`). Không có đồng hồ, không có `hetCa`.
- Sau khi chốt: `PhanHoiBuoc coMang={false}` dưới bảng chơi, cùng rung ngang khi chưa đúng.
- Đi tiếp: "Câu tiếp" / `gd.nutTiep` là **nút** (`button`) đổi state `thuTuXem`, không đổi URL; bước cuối là nút "Xem kết quả". Tải lại trang thì mở bước chưa làm kế tiếp, kết quả bước vừa làm không hiện lại.
- Không có màn "Xem lại từng câu".

**C. Ba trò riêng lẻ**
- **Đua thời gian** (`routes/tro-choi.dua-thoi-gian.tsx`): action chỉ giữ `{ stt, dung }`, bỏ `giai_thich` và `can_cu` mà API đã trả. Chỉ nháy màu và chữ "Đúng"/"Sai" trong `aria-live="assertive"`, tự sang câu sau 350 ms. Đồng hồ `DongHoNguoc` chạy liên tục, máy chủ từ chối câu trả lời trễ (409).
- **Hỏi nhanh giọng nói** (`routes/tro-choi.hoi-nhanh-giong-noi.tsx`): action giữ `{ stt, dung, dapAn }`. Hiện "Đúng" hoặc "Sai. Đáp án: …" trong `aria-live="assertive"`, tự sang câu sau `CHO_CAU_TIEP_MS = 1800`. Câu hỏi tự đọc to. Không có đồng hồ.
- **Ghép cặp** (`routes/tro-choi.ghep-cap.tsx`, `components/tro-choi/BangGhepCap.tsx`): nộp một lần cho cả ván. Hiện dải "Ghép đúng hết." hoặc "Đúng x/y cặp.", tô màu từng cặp, rồi mục "Mức phạt đúng" có liên kết "Xem điều khoản" (rời trang). API chỉ trả `chi_tiet[{ id, dung, muc_phat_dung, citation_urn }]`, **không có** trường giải thích.
  - Số cặp mặc định `SO_CAP_GHEP = 5`, tối thiểu `SO_CAP_TOI_THIEU = 3` (`packages/dao-tao/src/tro-choi/ghep-cap-muc-phat.ts`), nên y có thể từ 3 đến 5.
  - Dải kết quả là `role="status"`, viền `warn` (không phải đỏ) khi chưa đúng hết.
  - Mục "Mức phạt đúng" nằm trong tệp route, không nằm trong `BangGhepCap`.
  - Không có "Câu tiếp": sau khi nộp chỉ có "Chơi ván mới" (biểu mẫu) và "Trò chơi khác".
- **Đoán biển báo** (`routes/tro-choi.doan-bien-bao.tsx`) chỉ chuyển hướng 301 sang cung đường biển báo. Không cần sửa.

**Dữ liệu giải thích luôn đến sau khi chấm**, không gửi trước:
- Luyện tập, Vượt màn, Đua, Hỏi nhanh: `POST /v1/luyen-tap/phien/:id/tra-loi` trả `{ stt, dung, ty_le, dap_an, giai_thich, can_cu, chi_tiet? }` (kiểu `KetQuaCauHoi`, `packages/dao-tao/src/cau-hoi.ts`; bản web ở `apps/web/app/lib/ngan-hang.ts`). `dap_an.dung` là mã phương án, muốn hiện chữ phải tra trong đề.
- Khung chung: `POST /v1/luot-choi/luot/:id/buoc/:thuTu` trả `{ thu_tu, ket_qua, con_buoc }`. `ket_qua` có `diem, thuong, diem_toi_da, dung (boolean | null), het_gio, thoi_gian_ms, giai_thich, can_cu, chi_tiet`. Kiểu web `KetQuaBuocWeb` ở `apps/web/app/lib/luot-choi.ts`.

**Hộp thoại có sẵn**
- `components/ui/HopThoai.tsx` (GĐ16b): `HopThoai({ mo, tieuDe, onDong, children, hanhDong, className })` và hook `useHop()`.
  - `<dialog>` gốc mở bằng `showModal()`, `aria-labelledby` trỏ vào tiêu đề (`h2`), nút X "Đóng", Esc để đóng. Không đóng khi bấm nền.
  - Nút X là phần tử nhận tiêu điểm đầu tiên trong hộp, nên `showModal()` đặt tiêu điểm vào nút X. React không ghi thuộc tính `autofocus` ra DOM ở trình duyệt (chỉ tự gọi `focus()` lúc gắn, khi đó hộp còn đóng), nên `autoFocus` trên nút trong `hanhDong` không có tác dụng.
  - Lớp `.sheet` (`styles/app.css`, dưới 48rem): tấm bám đáy, `max-height: 85dvh`, `overflow-y: auto` trên **chính thẻ dialog**. Từ 768px là hộp giữa màn hình. Vùng `hanhDong` là một `div` thường (`mt-6 flex flex-col-reverse gap-2`) ở cuối hộp, không dính đáy, không có prop đổi lớp riêng; `className` chỉ áp cho thẻ dialog.
  - Hiệu ứng trượt lên dùng biến thể `motion-safe:` và `starting:` của Tailwind: chỉ tắt theo `prefers-reduced-motion`, **không** tắt theo công tắc `data-giam-hieu-ung` của trò chơi.
  - Khóa cuộn đặt ở `<html>` (`document.documentElement`), khác `NganKeoCanCu` khóa ở `body`. Đóng thì trả tiêu điểm về phần tử đã mở hộp rồi gọi `onDong`; chỉ gọi `onDong` khi người dùng tự đóng (Esc, X). Hộp bị gỡ khỏi trang lúc đang mở thì gỡ khóa cuộn.
  - Đang dùng ở 10 hộp `components/nhom/Hop*.tsx` (`HopChiaSe`, `HopChiaSeBai`, `HopGoiYThuTu`, `HopMoiThanhVien`, `HopSuaNhom`, `HopTaoNhom`, `HopThamGia`, `HopTienDoThanhVien`, `HopTuyChonMuc`, `HopXacNhanNhom`) và hộp chi tiết trò ở `routes/tro-choi._index.tsx`: 11 hộp. `useHop` dùng ở `nhom.tsx`, `nhom.chi-tiet.tsx`, `training.lesson.tsx`.
- Các lớp phủ tự viết khác trong khu trò chơi: `tro-choi/chung/HuongDan.tsx`, `hieu-ung/LopChucMung.tsx`, `chung/GiayTo.tsx` (phóng to giấy tờ, `role="dialog"` không tên, nút "Xong").
- `KhungGame` bọc nội dung trong `VungTroChoi` (`hieu-ung/VungTroChoi.tsx`): vùng `data-khu="tro-choi"`, đặt màu riêng của trò chơi và `data-giam-hieu-ung`. Hộp đặt bên trong vùng này nhận màu (biến CSS kế thừa theo cây DOM, kể cả khi dialog ở lớp trên cùng). `data-giam-hieu-ung="1"` chỉ tắt các lớp `.g-a`, `.g-t`, `.g-an-khi-giam`.
- Màu cảnh báo có sẵn: token `--warn`, `--warn-soft` (lớp `text-warn`, `bg-warn-soft`, `border-warn`).

**Hiệu ứng:** âm thanh `hieu-ung/am-thanh.ts` (mặc định tắt), rung `hieu-ung/rung.ts` (mặc định bật), mặc định ở `CAI_DAT_MAC_DINH` (`lib/hieu-ung.ts`), đọc qua `hieu-ung/cai-dat.ts`. Lớp hoạt ảnh ở `hieu-ung/tro-choi.css`, tắt khi `data-giam-hieu-ung="1"` hoặc `prefers-reduced-motion`. `styles/app.css` còn ép mọi `animation-duration`, `transition-duration` về 0,01 ms khi `prefers-reduced-motion`.

**Kiểm thử đang dựa vào khối kết quả cũ** (phải sửa theo hộp mới):
- Tìm `[role=status]` lọc theo `/Đúng\.|Chưa đúng\./` rồi bấm **liên kết** "Câu tiếp" hoặc `nutTiep`: `scripts/e2e/tro-choi-khung.ts`, `sung-ban-toc-do.ts`, `cung-duong.ts`, `kiem-tra-giay-to.ts`, `duyet-phat-nguoi.ts`, `len-xe-khach.ts`, `soi-xe-cai-tao.ts`, `tram-can.ts`, `tro-choi.ts` (Vượt màn, lọc `hasText: "Đúng."`).
  - `tro-choi-khung.ts` có cả phần chơi offline của trò chơi: ở đó "Câu tiếp" và "Xem kết quả" là **nút** (`getByRole("button")`), không phải liên kết.
- Chỉ bấm nút "Xem kết quả" trên trang sau bước cuối, không đọc khối kết quả: `cam-bien.ts`, `chot-dem.ts`, `soi-camera.ts`, `tu-lai.ts`, `dung-xe.ts`. Nút này sẽ chuyển vào hộp, phải chạy lại.
- Luyện tập thường: `luyen-tap.ts` (mở `dialog` "Căn cứ pháp lý", nhấn Esc), `nhom-hoc.ts`, `offline.ts` (luyện tập offline ở `/luyen-tap/offline`, không phải trò chơi offline). Chỉ sửa nếu H1 chọn áp cho cả luyện tập.
- Khác:
  - `lap-bien-ban.ts`: `[role=status]` lọc `/^(ĐẠT|CHƯA ĐẠT)$/` (dấu trên mẫu biên bản); đếm `getByText("Đúng", { exact: true })` phải ít nhất 4 (hộp tên "Đúng" sẽ cộng thêm vào số đếm); bấm liên kết "Câu tiếp".
  - `tro-choi.ts`: "Ghép đúng hết.", `/^(Đúng|Sai)$/` của Đua.
  - `giong-noi.ts`: `[aria-live=assertive] p` hiện rồi mất.
  - `dung-xe.ts`: "Căn cứ: Căn cứ đang được cập nhật" (chữ trong khối kết quả của `DungXe`).
  - `tro-choi-muot.ts`: chơi Súng bắn tốc độ, bấm liên kết "Câu tiếp", đo khung hình của hiệu ứng phản hồi; bấm `/^(Đóng|Tiếp tục)$/` là để đóng lớp chúc mừng ở `/game-style-demo`.
- Nhiều kịch bản gọi `getByRole("dialog", { name: "<tên trò>" })` cho hộp chi tiết ở `/tro-choi` và hộp hướng dẫn. `kiem-tra-giay-to.ts` gọi `getByRole("dialog")` không kèm tên (dòng 59–72, lớp phóng to giấy tờ, nút "Xong"): sẽ trùng khi có hộp kết quả.

### 1.4. Quy tắc cứng

1. **Không sửa API, không có migration.** Chấm vẫn ở máy chủ. Hộp chỉ hiện dữ liệu máy chủ đã trả sau khi chấm. Không đưa đáp án hay giải thích xuống máy khách trước khi chấm.
2. **Dùng `HopThoai` có sẵn**, không tự viết lớp phủ mới. Không sửa `HopThoai.tsx`. Cần thêm prop thì hỏi trước, và prop mới phải không bắt buộc, không đổi hành vi của 11 hộp đang dùng.
3. **"Xem chi tiết" mặc định thu gọn** mỗi lần hộp mở ra. Phần chi tiết không có trong cây trợ năng khi đang thu gọn (dùng `hidden`, không chỉ ẩn bằng màu hay chiều cao 0).
4. **Không lồng hộp thoại.** Trong hộp kết quả không mở `NganKeoCanCu` hay bất kỳ lớp phủ nào khác (xem H8).
5. **Không đổi luật chơi:** không đổi điểm, thời gian, số bước, cách tính đúng/sai. Đồng hồ cả lượt vẫn do máy chủ giữ (xem H2).
6. **Không đổi nhịp của bảng chơi:** bảng chơi vẫn tô đáp án (đúng xanh, chọn sai đỏ, "Đáp án đúng") và vẫn rung khi sai, để người chơi đóng hộp ra vẫn thấy mình sai ở đâu.
7. **Giao diện điện thoại:** khung 360×740, không cuộn ngang, chữ nội dung ≥ 16px, vùng chạm ≥ 48px. Nút chính trong hộp nằm trong tầm ngón cái (đáy tấm), không bị đẩy khỏi màn hình khi phần chi tiết dài: phần chi tiết cuộn bên trong hộp.
8. **Trợ năng:** không cần nhìn màu mới biết kết quả (luôn có chữ "Đúng"/"Chưa đúng" và biểu tượng). Nút "Xem chi tiết" có `aria-expanded` và `aria-controls`. Làm được hoàn toàn bằng bàn phím.
9. **Hành văn** theo QUY-TAC-HANH-VAN: không emoji, không dấu chấm than, không lời khen kiểu "Tuyệt vời", "Giỏi quá". Nhãn cố định ở mục 2.2.
10. **Tôn trọng giảm chuyển động:** `prefers-reduced-motion` và cài đặt `data-giam-hieu-ung` tắt mọi hoạt ảnh của hộp; âm thanh và rung vẫn theo cài đặt hiện có, chỉ phát một lần mỗi câu.
11. **Phạm vi sửa:** chỉ sửa tệp ghi ở mục "File sửa" của giai đoạn đang làm. Cần sửa tệp khác thì **hỏi trước**: sửa gì, vì sao, ảnh hưởng chức năng nào.
12. **Câu hỏi quyết định:** đọc cột "Trả lời" ở mục 2.8 và 2.9 trước khi làm. Câu liên quan còn trống thì dừng và hỏi, không tự chọn cột "Đề xuất". Làm khác đặc tả theo câu trả lời thì sửa luôn mục 2 của tệp này và giai đoạn trong PLAN.md.
13. **Bài hướng dẫn:** bài nào trong `content/huong-dan/` tả cách xem kết quả trò chơi thì sửa cho khớp. Test `scripts/huong-dan/bao-ve.test.ts` phải đạt.
14. **Không tự commit.** Cuối phiên đưa bản tóm tắt thay đổi để người dùng commit.

### 1.5. Xong một giai đoạn khi

- Qua cổng chung PLAN §0.2: `typecheck`, `lint`, `bun test`, `build:web`, `smoke`.
- Mọi kịch bản e2e trò chơi ở mục 1.3 đạt (đã sửa theo hộp mới), cộng kịch bản mới của giai đoạn.
- Mã riêng mỗi trò vẫn ≤ 8 KB gzip (≤ 12 KB nếu dùng bộ mô phỏng), theo GAME_DESIGN §1.
- PLAN.md được cập nhật: đánh `[x]`, ghi "Trạng thái", "Thay đổi so với dự kiến", "Quy tắc nghiệp vụ đã chốt".
- Test đã hỏng từ trước (ví dụ `packages/config/src/ports.test.ts` trên Windows) thì ghi rõ, không che.

---

## 2. Đặc tả

### 2.1. Luồng

1. Người chơi chốt đáp án (nút "Chốt đáp án", "Kiểm tra", hoặc cử chỉ của trò).
2. Trong lúc chờ chấm: giữ như hiện nay ("Đang chấm").
3. Máy chủ trả kết quả:
   - bảng chơi tô đáp án và rung nếu sai, như hiện nay;
   - **hộp kết quả mở ra**, phát âm thanh và rung một lần (chuyển từ `PhanHoiBuoc` sang hộp);
   - phần chi tiết trong hộp đang thu gọn.
4. Người chơi:
   - bấm nút chính ("Câu tiếp" / `gd.nutTiep` / "Xem kết quả") ngay trong hộp để đi tiếp; hoặc
   - bấm "Xem chi tiết" để mở phần giải thích, đọc xong bấm nút chính; hoặc
   - đóng hộp (X, Esc) để nhìn lại bảng chơi (H11).
5. Hộp đã đóng thì đáy trang có hai nút: "Xem lại kết quả" (mở lại hộp, phần chi tiết thu gọn) và nút chính như trong hộp.
6. Sang bước mới thì hộp đóng hẳn; bước mới không có hộp cho tới khi chấm.

### 2.2. Nội dung hộp

Component mới `components/tro-choi/chung/HopKetQuaCau.tsx`, dựng trên `HopThoai`.

| Phần | Nội dung |
|---|---|
| Tiêu đề (`tieuDe` của `HopThoai`, cũng là tên truy cập của hộp) | "Đúng", "Chưa đúng", "Đúng một phần" (H6) hoặc "Hết giờ" |
| Dòng đầu | Biểu tượng tích hoặc chéo (dùng lại `DauKetQua`), màu `ok` hoặc `danger`. Với "Đúng một phần" dùng màu cảnh báo có sẵn trong VISUAL_STYLE |
| Dòng điểm | "Điểm: x/y", "thưởng nhanh +N" nếu có (dùng lại `DongDiem`, bỏ tiêu đề trùng). Hết giờ thêm câu "Câu trả lời gửi sau thời gian cho phép nên không tính điểm." |
| Đáp án đúng, một dòng | Chỉ khi chưa đúng và trò có đáp án ngắn đọc được: Vượt màn và trò mẫu `thu_nghiem` (GĐ17a), Hỏi nhanh (GĐ17b) (Đ9). Không có thì bỏ, không bịa |
| Nút "Xem chi tiết" | Chỉ hiện khi có ít nhất một nội dung chi tiết (mục 2.3). Bấm thì đổi nhãn thành "Ẩn chi tiết" |
| Phần chi tiết (thu gọn) | Mục 2.3 |
| Vùng nút (`hanhDong`) | Nút chính: "Câu tiếp" / `gd.nutTiep` / "Xem kết quả". Nút chính nhận tiêu điểm khi hộp mở (chuyển bằng `focus()` sau `showModal()`, không dựa vào `autoFocus`, Đ1) để Enter đi tiếp ngay. Không thêm nút "Đóng" thứ hai, đã có nút X |

- Đồng hồ cả lượt đang chạy thì hộp có dòng "Thời gian còn lại của lượt: m:ss", tính từ cùng mốc với đồng hồ đầu trang, chỉ hiển thị: không âm thanh, không báo đọc, không tự chốt lượt (H2, Đ4).
- Hộp không có ô nhập, không có biểu mẫu nào khác ngoài biểu mẫu "Xem kết quả".

### 2.3. Phần "Xem chi tiết"

Component `components/tro-choi/chung/ChiTietKetQua.tsx`, dùng chung cho hộp và cho màn "Xem lại từng câu" (H10). Thứ tự:

1. **Giải thích:** `giai_thich` của máy chủ, văn bản thuần.
2. **Căn cứ pháp lý:** mỗi URN trong `can_cu` hiện nhãn `nhanVienDan(urn)`. Cách xem nguyên văn theo H8.
3. **Chi tiết riêng của trò** (từ GĐ17c): danh sách lỗi (`DanhSachLoi`), biên bản, bảng so sánh với quy trình chuẩn, bảng từng biển báo… theo bảng ở mục 2.5.

- Không có `giai_thich`, không có `can_cu` và trò không có chi tiết riêng thì không hiện nút "Xem chi tiết".
- Căn cứ chưa có trong kho hiện đúng chữ máy chủ trả, không tự thêm viện dẫn.
- Phần chi tiết cuộn trong khung riêng, cao tối đa `35dvh`, nhận tiêu điểm được (tên "Chi tiết kết quả"); nút chính ở vùng `hanhDong` luôn thấy được mà không cần dính đáy (Đ2).

### 2.4. Đóng, mở lại, chuyển bước

- Đóng bằng X hoặc Esc: hộp đóng, tiêu điểm về nút "Xem lại kết quả" ở đáy trang (không về nút "Chốt đáp án" đã biến mất).
- Chuyển bước bằng `ButtonLink` trong hộp: hộp phải đóng khi `buoc.thu_tu` đổi (đặt `key` theo bước, hoặc đóng khi kết quả về `null`), và không để khóa cuộn còn sót (`HopThoai` đã gỡ khi bị gỡ khỏi trang; kiểm lại bằng e2e).
- Hết giờ cả lượt trong lúc hộp mở: giữ hành vi `hetCa` hiện có. Hộp đóng, lớp "Hết giờ" hiện, lượt tự chốt sau 2500 ms.
- Tải lại trang sau khi đã chấm (bước đã có kết quả trong `luot.da_choi`): không tự mở hộp, hiện hai nút ở đáy như khi đã đóng hộp.

### 2.5. Áp cho từng trò

| Trò / đường | Hộp mỗi câu | Nội dung "Xem chi tiết" | GĐ |
|---|---|---|---|
| Khung chung (mọi trò trong `giao-dien.tsx`) | Có, mỗi bước | Giải thích, căn cứ | 17a |
| Chơi offline (`tro-choi.offline.tsx`) | Có, mỗi bước | Giải thích, "Căn cứ: …" dạng chữ (không tải được nguyên văn khi offline) | 17a |
| Vượt màn (`luyen-tap.phien.tsx`) | Có, mỗi câu (H1) | Giải thích, căn cứ | 17a |
| Đua thời gian | Theo H3 | Theo H3 | 17b |
| Hỏi nhanh giọng nói | Theo H4 | Giải thích, căn cứ (giữ lại trong action) | 17b |
| Ghép cặp | Theo H5 | Danh sách "Mức phạt đúng", căn cứ từng cặp | 17b |
| Kiểm tra giấy tờ, Duyệt phạt nguội | Có (17a) | Thêm `DanhSachLoi`, biên bản | 17c |
| Dừng xe | Có (17a) | Thêm bảng so sánh quy trình, điểm trừ, `DanhSachLoi`, biên bản | 17c |
| Cắm biển, Tự lái, Chốt đêm | Có (17a) | Thêm phần chữ của khối kết quả (các mục "Căn cứ: …") | 17c |
| Soi camera | Có (17a) | Thêm phần chữ của khối kết quả (các mục "Căn cứ: …") và biên bản (Đ12) | 17c |
| Trạm cân, Lên xe khách, Soi xe cải tạo | Có (17a) | Thêm khối kết quả nối dưới bảng chơi | 17c |
| Cung đường biển báo | Có (17a) | Thêm bảng `KetQuaDuong` (từng biển, hành động cần làm, lựa chọn, điểm); vùng chơi giữ tóm tắt số biển xử lý đúng trên tổng (Đ12) | 17c |
| Lập biên bản | Có (17a) | Giữ `KetQuaO` trên từng ô và dấu "ĐẠT"/"CHƯA ĐẠT" trên mẫu biên bản; chỉ "Đáp án: …" của từng ô vào chi tiết (H7) | 17c |
| Súng bắn tốc độ | Có (17a) | Giữ tô màu phương án; không có chi tiết riêng | — |

Ở GĐ17c, cách làm đề xuất: thêm trường không bắt buộc `ChiTiet` vào mô tả trò trong `giao-dien.tsx` (nhận `de`, `chiTiet`, `ketQua`), và cho `gd.Buoc` bỏ phần chữ dài khi đã có `ChiTiet`. Phần đánh dấu trực quan trên bảng chơi ở lại (quy tắc cứng 6). Trò nào "thay cả bảng chơi bằng khối kết quả" (Dừng xe, Cắm biển, Soi camera, Tự lái, Chốt đêm, và Cung đường biển báo theo Đ12) thì sau khi chấm vẫn giữ bảng chơi có đánh dấu nếu có; phần chữ chuyển vào hộp.

### 2.6. Hiệu ứng và trợ năng

- Âm thanh, rung: chuyển `useEffect` phát âm/rung từ `PhanHoiBuoc` sang lúc hộp mở lần đầu cho mỗi câu. Mở lại bằng "Xem lại kết quả" không phát lại.
- Hoạt ảnh: dùng hiệu ứng trượt lên có sẵn của `HopThoai`; dấu tích/chéo giữ `g-bat g-ve-net`. Tất cả tắt khi giảm chuyển động. `tro-choi-muot.ts` đo lại khung hình với hộp mới.
- Rung ngang của bảng chơi khi sai giữ nguyên (chạy phía sau nền mờ).
- `role="status"` cũ của `PhanHoiBuoc` bỏ khỏi trang chơi (tên hộp đã được đọc khi mở). Màn "Xem lại từng câu" không có hộp nên giữ dòng "Đúng"/"Chưa đúng" dạng chữ thường.
- Nút "Xem chi tiết": `<button type="button" aria-expanded aria-controls="<id phần chi tiết>">`, phần chi tiết có `id` và `hidden` khi thu gọn. Mở ra thì không tự chuyển tiêu điểm.

### 2.7. Kiểm thử

**Chọn phần tử trong e2e:**
- Hộp kết quả: `page.getByRole("dialog", { name: /^(Đúng|Chưa đúng|Đúng một phần|Hết giờ)$/ })`.
- Sửa `kiem-tra-giay-to.ts` và mọi chỗ gọi `getByRole("dialog")` không kèm tên để không trùng.
- Nút đi tiếp nằm trong hộp: `hop.getByRole("link", { name: "Câu tiếp" })` (hoặc `nutTiep`), `hop.getByRole("button", { name: "Xem kết quả" })`.

**Unit** (`apps/web/tests/ket-qua-cau.test.ts`): hàm thuần `tieuDeKetQua(ketQua)` và `coChiTiet(ketQua, coChiTietRieng)` đặt ở `apps/web/app/lib/ket-qua-cau.ts`:
- `dung: true` → "Đúng"; `dung: false` → "Chưa đúng"; `het_gio: true` → "Hết giờ" dù `dung` là gì;
- `dung: null` với điểm tối đa, 0 điểm, một phần điểm → theo H6;
- không giải thích, không căn cứ, không chi tiết riêng → không có nút "Xem chi tiết".

**E2E mới** `scripts/e2e/hop-ket-qua.ts`, khung 360×740 (chi tiết ở từng prompt mục 4).

### 2.8. Câu hỏi cần quyết định

| Mã | Câu hỏi | Đề xuất | Trả lời |
|---|---|---|---|
| H1 | Trang `/luyen-tap/:phien` dùng chung cho Vượt màn, luyện tập thường, thử thách hằng ngày, đề ôn tập của nhóm. Hộp kết quả áp cho những nguồn nào? | Chỉ trò chơi (`source` bắt đầu bằng `game:`). Luyện tập thường, thử thách, đề ôn tập của nhóm giữ khối cũ, để không phải sửa `luyen-tap.ts`, `nhom-hoc.ts`, `offline.ts` | Theo đề xuất: chỉ Vượt màn (30/9/2026) |
| H2 | Đồng hồ cả lượt có dừng khi hộp mở không? | Không dừng. Hạn giờ do máy chủ giữ; dừng phải sửa API và mở kẽ để mở hộp rồi tra cứu. Hiện đồng hồ trong hộp để người chơi thấy giờ còn lại | Theo đề xuất (30/9/2026) |
| H3 | Đua thời gian (tự sang câu sau 350 ms, đồng hồ chung chạy liên tục): có hộp mỗi câu không? | Không. Giữ nháy màu mỗi câu. Action giữ lại `giai_thich`, `can_cu` từng câu ở phía máy khách; màn kết thúc có danh sách câu sai, mỗi câu một nút "Xem chi tiết" thu gọn | Theo đề xuất: không có hộp mỗi câu (30/9/2026) |
| H4 | Hỏi nhanh giọng nói (tự sang câu sau 1800 ms, không có đồng hồ): có hộp mỗi câu không? | Có. Bỏ tự sang câu; nút "Câu tiếp" trong hộp nhận tiêu điểm. Action giữ lại `giai_thich`, `can_cu`. Câu sau vẫn tự đọc to khi hiện ra | Theo đề xuất: có hộp mỗi câu (30/9/2026) |
| H5 | Ghép cặp nộp một lần cho 5 cặp và API không có giải thích. Làm thế nào? | Một hộp sau khi "Nộp": tiêu đề "Đúng" khi ghép đúng hết, còn lại "Chưa đúng", dòng "Đúng x/5 cặp". "Xem chi tiết" chứa mục "Mức phạt đúng" và căn cứ từng cặp. Không thêm trường giải thích vào API | Một hộp, tiêu đề theo H6 ("Đúng một phần" khi đúng một số cặp), xem Đ11 (30/9/2026) |
| H6 | Kết quả `dung: null` (chấm theo điểm) hiện thế nào? Hiện đang ra "Chưa đúng" màu đỏ | Theo điểm: bằng điểm tối đa là "Đúng"; 0 điểm là "Chưa đúng"; còn lại là "Đúng một phần" màu cảnh báo | Theo đề xuất: theo điểm, có "Đúng một phần" (30/9/2026) |
| H7 | Khối kết quả dài riêng của từng trò có chuyển vào "Xem chi tiết" không? | Có, ở GĐ17c theo bảng mục 2.5. Đánh dấu trực quan trên bảng chơi ở lại | Theo đề xuất (30/9/2026) |
| H8 | Trong hộp, xem nguyên văn căn cứ thế nào khi không được lồng `NganKeoCanCu`? | Mỗi căn cứ là một nút mở rộng nguyên văn ngay trong phần chi tiết (tải `/luyen-tap/can-cu?urn=`, hiện bằng `NoiDungDieu`). Offline chỉ hiện nhãn | Theo đề xuất (30/9/2026) |
| H9 | Người chơi đã mở "Xem chi tiết" ở câu trước thì câu sau có tự mở không? | Không. Mỗi hộp mở ra đều thu gọn | Theo đề xuất (30/9/2026) |
| H10 | Màn "Xem lại từng câu" cuối lượt có dùng hộp không? | Không. Mỗi câu hiện dòng "Đúng"/"Chưa đúng" và `ChiTietKetQua` thu gọn tại chỗ | Theo đề xuất (30/9/2026) |
| H11 | Cho đóng hộp để nhìn lại bảng chơi không? | Có (X, Esc). Đáy trang hiện "Xem lại kết quả" và nút đi tiếp | Theo đề xuất (30/9/2026) |

### 2.9. Đề xuất khi đối chiếu đặc tả với mã (30/9/2026)

Những chỗ mục 2 không làm được đúng như viết, hoặc cần sửa tệp ngoài danh sách. Mọi đề xuất dưới đây **không sửa `HopThoai.tsx`**. Trả lời ở cột "Trả lời" ("Đồng ý", "Không", hoặc cách khác). Đề xuất còn trống thì phiên làm mã dừng lại hỏi, như câu H.

| Mã | GĐ | Chỗ trong đặc tả | Vấn đề trong mã | Đề xuất | Trả lời |
|---|---|---|---|---|---|
| Đ1 | 17a | 2.2: nút chính có `autoFocus` | `showModal()` đặt tiêu điểm vào nút X "Đóng" (phần tử nhận tiêu điểm đầu tiên). React không ghi thuộc tính `autofocus` ra DOM ở trình duyệt, nên `autoFocus` không có tác dụng | `HopKetQuaCau` giữ `ref` tới nút chính, gọi `focus()` trong `useEffect` khi `mo` chuyển sang `true`. Effect của `HopThoai` (component con) chạy trước nên `showModal()` đã xong. E2E đo `document.activeElement` là nút chính, Enter đi tiếp | Đồng ý (30/9/2026) |
| Đ2 | 17a | 2.3 và quy tắc 7: vùng nút luôn thấy, "giữ vùng nút dính đáy nếu cần" | `.sheet` cuộn cả thẻ dialog; vùng `hanhDong` là `div` thường ở cuối, không có prop đổi lớp. Chi tiết dài thì nút chính bị đẩy xuống dưới, phải cuộn mới thấy | Phần chi tiết cuộn trong khung riêng có chiều cao tối đa (khoảng `max-h-[35dvh]`, đo lại ở 360×740 sao cho cả hộp ≤ 85dvh), khung có `tabIndex={0}` và tên truy cập "Chi tiết kết quả" để cuộn được bằng bàn phím. Nút chính ở `hanhDong` không phải dính đáy. Không đồng ý thì phương án khác là thêm prop không bắt buộc vào `HopThoai` (phải hỏi theo quy tắc 2) | Đồng ý (30/9/2026) |
| Đ3 | 17a | Quy tắc 10, 2.6: `data-giam-hieu-ung` tắt mọi hoạt ảnh của hộp | Hiệu ứng trượt của `HopThoai` chỉ dùng `motion-safe:`, không tắt theo công tắc "Giảm hiệu ứng" của trò chơi | `HopKetQuaCau` truyền thêm `className` cho `HopThoai` với biến thể Tailwind 4 `in-data-[giam-hieu-ung=1]:transition-none` (hộp nằm trong vùng `data-khu`). E2E bật công tắc "Giảm hiệu ứng" rồi đo `transition-duration` của hộp | Đồng ý (30/9/2026) |
| Đ4 | 17a | 2.2 và H2: hiện đồng hồ cả lượt (bản nhỏ, chỉ đọc) trong hộp | Đặt thêm một `DongHoBuoc` trong hộp thì: phát tiếng tích, âm hết giờ, rung và gọi `onHet` hai lần; `aria-live` đọc hai lần; mốc tính từ `conLaiMs` lúc gắn nên đồng hồ trong hộp chạy **chậm hơn** đồng hồ thật một khoảng bằng thời gian đã chơi bước đó | `BuocDangChoi` giữ một mốc hết giờ chung (`Date.now() + con_lai_luot_ms` lúc gắn bước). Hộp hiện một dòng chữ "Còn m:ss" tự tính từ mốc đó: chỉ hiển thị, không âm thanh, không `onHet`, không `aria-live`. Đồng hồ đầu trang giữ nguyên và vẫn là nơi duy nhất gọi `hetCa`. Không sửa `DongHoBuoc.tsx` | Đồng ý (30/9/2026) |
| Đ5 | 17a, 17b | 2.2, 2.7: `tieuDeKetQua(ketQua)`, dòng điểm dùng lại `DongDiem`, "Đúng một phần" màu cảnh báo | Có ba dạng kết quả: `KetQuaBuocWeb` (khung chung, offline: có điểm, `het_gio`), `KetQuaCauHoi` (Vượt màn: không có điểm, không `het_gio`), dữ liệu rút gọn trong action của Đua, Hỏi nhanh. `DongDiem` chưa export và có tiêu đề riêng; `DauKetQua` chỉ có hai màu | `lib/ket-qua-cau.ts` khai kiểu đầu vào chung `KetQuaHienThi { dung: boolean \| null; het_gio?; diem?; diem_toi_da?; thuong?; giai_thich; can_cu }` và hàm chuyển từ hai kiểu có sẵn. Hộp bỏ dòng điểm khi không có `diem_toi_da` (Vượt màn, Hỏi nhanh). "Đúng một phần" (H6) chỉ xét khi có điểm. Trong `PhanHoiBuoc.tsx`: export `DongDiem` kèm prop ẩn tiêu đề; `DauKetQua` nhận thêm trạng thái "một phần" dùng token `--warn` | Đồng ý (30/9/2026) |
| Đ6 | 17a | H1, việc 7: hộp cho câu của Vượt màn trên `/luyen-tap/:phien` | Kiểu `PhienLuyenTap.nguon` ở web không có `game:*` (API trả `game:vuot_man`). Trang không nằm trong `VungTroChoi`: không có màu trò chơi, `tro-choi.css`, công tắc giảm hiệu ứng; hiện không phát âm thanh, không rung | (1) Thêm `` `game:${string}` `` vào kiểu `nguon` trong `lib/luyen-tap.server.ts` (chỉ đổi kiểu); điều kiện áp hộp là `phien.nguon === "game:vuot_man"`. (2) Ở trang này, `HopKetQuaCau` bọc trong `VungTroChoi` (`className="min-h-0"`) để có màu, CSS và công tắc của trò chơi. (3) Âm thanh, rung phát theo cài đặt trò chơi như khung chung (rung mặc định bật, nên Vượt màn bắt đầu có rung). (4) "Vừa chấm" là khi `tuFetcher` khác `null`; hộp đặt `key={stt}` | Đồng ý, có âm thanh và rung theo cài đặt trò chơi (30/9/2026) |
| Đ7 | 17a | 2.4: đóng hộp thì tiêu điểm về "Xem lại kết quả" | `HopThoai` trả tiêu điểm về phần tử đang có tiêu điểm lúc mở: nút "Chốt đáp án" (đang khóa và sắp bị gỡ) hoặc một nút trong bảng chơi, rồi mới gọi `onDong`. Nút "Xem lại kết quả" chỉ có sau khi hộp đóng | Trong `onDong`, trang đặt cờ; `useEffect` đưa tiêu điểm vào "Xem lại kết quả" khi nút này hiện ra (chạy sau lệnh `focus()` của `HopThoai` nên được giữ). Mở lại bằng "Xem lại kết quả" thì `HopThoai` tự trả tiêu điểm về đúng nút đó | Đồng ý (30/9/2026) |
| Đ8 | 17a | Quy tắc 11, "File sửa" của GĐ17a | Cần sửa thêm tệp ngoài danh sách: `components/tro-choi/TongKetLuot.tsx` (`DanhSachBuoc` in "Chưa đúng" khi `dung === null`, cần theo H6, H10); `lib/luyen-tap.server.ts` (Đ6). `routes/game-style-demo.tsx` dùng `PhanHoiBuoc` | Thêm `TongKetLuot.tsx` và `lib/luyen-tap.server.ts` (chỉ kiểu `nguon`) vào "File sửa" GĐ17a. Giữ `PhanHoiBuoc` tương thích (mặc định vẫn phát âm, rung khi `hoatAnh`), trang chơi không dùng `PhanHoiBuoc` cho kết quả vừa chấm nữa; nhờ vậy không phải sửa `game-style-demo.tsx` | Đồng ý (30/9/2026) |
| Đ9 | 17a, 17b | 2.2: dòng "Đáp án đúng" một dòng | Khung chung không có trường đáp án ngắn chung (`chi_tiet` riêng từng trò, kiểu `unknown`). `KetQuaCauHoi.dap_an.dung` là mã phương án, phải tra chữ trong đề | Chỉ hiện dòng này ở: Vượt màn và trò mẫu `thu_nghiem` (tra chữ phương án trong `de`) ở GĐ17a; Hỏi nhanh (đã có `dapAn`) ở GĐ17b. Các trò khung chung khác không có dòng này, bảng chơi đã tô "Đáp án đúng" | Đồng ý (30/9/2026) |
| Đ10 | 17a | 2.1, 2.7: nút đi tiếp là liên kết `hop.getByRole("link", …)`; tải lại trang thì hiện hai nút ở đáy | Chơi offline: nút đi tiếp là `button` đổi state, không đổi URL; tải lại trang thì mở bước chưa làm kế tiếp, không còn kết quả bước vừa làm | Offline giữ nút `button` trong hộp; e2e phần offline dùng `hop.getByRole("button", …)`. Mục 2.4 "tải lại trang" chỉ áp cho khung chung và Vượt màn | Đồng ý (30/9/2026) |
| Đ11 | 17b | H5: hộp Ghép cặp, "Đúng x/5 cặp" | Không có "Câu tiếp": sau khi nộp chỉ có "Chơi ván mới" (biểu mẫu) và "Trò chơi khác". Số cặp từ 3 đến 5. Dải kết quả hiện nay viền `warn` khi chưa đúng hết | Nút chính của hộp là "Chơi ván mới" (cùng biểu mẫu); "Trò chơi khác" ở đáy trang. Dòng điểm ghi "Đúng x/y cặp" theo `tong`. Tiêu đề theo H6: đúng hết là "Đúng", 0 cặp là "Chưa đúng", còn lại "Đúng một phần" màu cảnh báo (nếu H6 theo đề xuất) | Đồng ý (30/9/2026) |
| Đ12 | 17c | Bảng mục 2.5, việc 3 của GĐ17c | Soi camera ngoài "Căn cứ: …" còn có `BienBan`. Cung đường biển báo cũng thay cả đoạn đường chạy bằng `KetQuaDuong`: chuyển bảng này vào "Xem chi tiết" thì vùng chơi trống | Sửa bảng 2.5: Soi camera thêm biên bản. Đưa Cung đường biển báo vào nhóm "thay cả bảng chơi" của việc 3; vùng chơi sau khi chấm giữ phần tóm tắt trực quan (số biển xử lý đúng trên tổng), bảng từng biển vào chi tiết | Đồng ý (30/9/2026) |

---

## 3. Prompt 0: đưa chức năng vào kế hoạch

```text
Đọc docs/PROMPT_HOP_KET_QUA_TRO_CHOI.md (cả tệp) và docs/PLAN.md.
Việc làm, chưa viết mã:
1. Kiểm lại mục 1.3 "Hiện trạng mã" với mã hiện tại: tên tệp, tên hàm, số mili giây, danh sách kịch bản e2e. Chỗ nào sai thì sửa ngay trong mục 1.3 và ghi ngày đối chiếu.
2. Thêm vào PLAN.md ba giai đoạn GĐ17a, GĐ17b, GĐ17c theo bảng mục 0, cùng khuôn với GĐ16a–16d: mục tiêu, việc làm, file sửa, file tạo, "Kiểm tra đã xong", trạng thái [ ]. Ghi rõ không có migration.
3. Đối chiếu mục 2 với mã. Chỗ nào đặc tả không làm được như viết (ví dụ HopThoai thiếu khả năng cần dùng, vùng nút không dính đáy được trong .sheet) thì thêm đề xuất Đ1, Đ2… vào một mục 2.9 mới, dạng bảng có cột "Trả lời" để trống.
4. Liệt kê các câu H1–H11 còn trống để tôi trả lời.
Không sửa tệp nào khác ngoài docs/PLAN.md và docs/PROMPT_HOP_KET_QUA_TRO_CHOI.md. Không commit.
```

---

## 4. Prompt cho từng giai đoạn

Mỗi khối dưới đây là **một prompt hoàn chỉnh**. Chép cả khối vào phiên mới.

### GĐ17a. Hộp kết quả cho khung chơi chung, chơi offline, Vượt màn

```text
Làm GĐ17a "Hộp kết quả đúng/sai: component chung và khung chơi chung" theo docs/PLAN.md.
Trước khi làm, đọc và theo docs/PROMPT_HOP_KET_QUA_TRO_CHOI.md mục 1 (Phần chung) và mục 2 (Đặc tả).
Câu hỏi quyết định liên quan: H1, H2, H6, H8, H9, H10, H11 và đề xuất Đ1–Đ10. Đọc cột "Trả lời" ở mục 2.8 và 2.9; câu còn trống thì dừng và hỏi tôi.

Việc làm:
1. apps/web/app/lib/ket-qua-cau.ts: hàm thuần tieuDeKetQua(ketQua) theo H6 và coChiTiet(...) theo mục 2.3. Unit test ở apps/web/tests/ket-qua-cau.test.ts.
2. components/tro-choi/chung/ChiTietKetQua.tsx: nút "Xem chi tiết"/"Ẩn chi tiết" (aria-expanded, aria-controls), phần chi tiết hidden khi thu gọn: giải thích, căn cứ theo H8 (có mạng: mở rộng nguyên văn tại chỗ bằng NoiDungDieu; offline: chỉ nhãn). Có chỗ nhận chi tiết riêng của trò (dùng ở GĐ17c).
3. components/tro-choi/chung/HopKetQuaCau.tsx: dựng trên components/ui/HopThoai.tsx theo mục 2.2. Tiêu đề từ tieuDeKetQua; dùng lại DauKetQua, DongDiem; đồng hồ cả lượt chỉ đọc theo H2; vùng hanhDong chứa nút chính có autoFocus. Không sửa HopThoai.tsx; thiếu gì thì hỏi trước.
4. components/tro-choi/PhanHoiBuoc.tsx: tách phần âm thanh/rung để gọi một lần khi hộp mở lần đầu mỗi câu (mục 2.6); phần hiển thị tĩnh dùng cho màn "Xem lại từng câu" theo H10.
5. routes/tro-choi.luot.tsx (BuocDangChoi và phần "Xem lại từng câu"): mở hộp khi có ketQua; bỏ khối PhanHoiBuoc dưới bảng chơi; nút đi tiếp chuyển vào hộp; đóng hộp thì đáy trang có "Xem lại kết quả" và nút đi tiếp (H11); hộp đóng khi đổi bước; tải lại trang không tự mở hộp (mục 2.4). Giữ nguyên shouldRevalidate, DongHoBuoc, hetCa, rung ngang, lớp "Hết giờ".
6. routes/tro-choi.offline.tsx: như việc 5, căn cứ dạng chữ.
7. routes/luyen-tap.phien.tsx: hộp kết quả cho câu của Vượt màn theo H1; nguồn không thuộc H1 giữ PhanHoiCauTraLoi như cũ. Không đổi hành vi luyện tập thường.
8. Sửa các kịch bản e2e ở mục 1.3 theo cách chọn phần tử mục 2.7 (chỉ những kịch bản thuộc đường đã đổi; luyen-tap.ts, nhom-hoc.ts, offline.ts chỉ sửa nếu H1 áp cho cả luyện tập).
9. Sửa bài hướng dẫn trong content/huong-dan/ nếu có bài tả cách xem kết quả trò chơi.

File sửa: apps/web/app/routes/tro-choi.luot.tsx, apps/web/app/routes/tro-choi.offline.tsx, apps/web/app/routes/luyen-tap.phien.tsx (chỉ nhánh trò chơi theo H1), apps/web/app/components/tro-choi/PhanHoiBuoc.tsx, apps/web/app/components/luyen-tap/PhanHoiCauTraLoi.tsx (chỉ tách phần dùng lại được, không đổi hành vi luyện tập thường), apps/web/app/components/tro-choi/TongKetLuot.tsx và apps/web/app/lib/luyen-tap.server.ts (chỉ kiểu nguon) nếu Đ8 được đồng ý, scripts/e2e/tro-choi-khung.ts, sung-ban-toc-do.ts, cung-duong.ts, kiem-tra-giay-to.ts, duyet-phat-nguoi.ts, len-xe-khach.ts, soi-xe-cai-tao.ts, tram-can.ts, lap-bien-ban.ts, dung-xe.ts, cam-bien.ts, chot-dem.ts, soi-camera.ts, tu-lai.ts, tro-choi.ts (phần Vượt màn), tro-choi-muot.ts, content/huong-dan/ (nếu cần), docs/PLAN.md.
File tạo: apps/web/app/lib/ket-qua-cau.ts, apps/web/tests/ket-qua-cau.test.ts, apps/web/app/components/tro-choi/chung/HopKetQuaCau.tsx, apps/web/app/components/tro-choi/chung/ChiTietKetQua.tsx, scripts/e2e/hop-ket-qua.ts.
Kiểm lại tên tệp thật trước khi sửa; tên khác thì dùng tên thật và ghi vào "Thay đổi so với dự kiến".

Test bắt buộc:
- Unit ket-qua-cau.test.ts theo mục 2.7.
- bun run e2e hop-ket-qua, khung 360×740, trên một trò khung chung có đồng hồ cả lượt (cung đường biển báo) và một trò không có đồng hồ:
  - chốt đáp án đúng thì hộp tên "Đúng" hiện; chốt sai thì hộp tên "Chưa đúng" hiện và bảng chơi vẫn tô đáp án;
  - lúc mở hộp, giải thích không nhìn thấy; bấm "Xem chi tiết" thì giải thích và căn cứ hiện, aria-expanded="true"; bấm lại thì ẩn;
  - câu sau mở hộp thì phần chi tiết lại thu gọn (H9);
  - Esc đóng hộp, tiêu điểm ở nút "Xem lại kết quả"; bấm nút đó mở lại hộp; không phát lại âm thanh;
  - bấm "Câu tiếp" trong hộp thì sang bước sau, không còn dialog nào mở, trang cuộn được (khóa cuộn đã gỡ);
  - đồng hồ cả lượt vẫn giảm trong lúc hộp mở (H2);
  - bấm "Xem chi tiết" với phần chi tiết dài thì nút chính vẫn nằm trong khung nhìn;
  - không cuộn ngang; vùng chạm của "Xem chi tiết" và nút chính ≥ 48px;
  - bật giảm chuyển động (emulateMedia reducedMotion) thì hộp không có hoạt ảnh;
  - chơi offline: hộp hiện, "Xem chi tiết" có "Căn cứ: …" dạng chữ;
  - Vượt màn: hộp hiện cho câu của màn; luyện tập thường vẫn là khối cũ (nếu H1 chọn đề xuất).
- Mọi kịch bản e2e trò chơi ở mục 1.3 đạt sau khi sửa.

Cuối phiên: cập nhật PLAN.md GĐ17a (Trạng thái, Thay đổi so với dự kiến, Quy tắc nghiệp vụ đã chốt) và đưa tóm tắt để tôi commit.
```

### GĐ17b. Đua thời gian, Hỏi nhanh giọng nói, Ghép cặp

```text
Làm GĐ17b "Hộp kết quả đúng/sai: Đua thời gian, Hỏi nhanh giọng nói, Ghép cặp" theo docs/PLAN.md.
Trước khi làm, đọc và theo docs/PROMPT_HOP_KET_QUA_TRO_CHOI.md mục 1 (Phần chung), mục 2.2, 2.3, 2.5, 2.6, 2.7. Component HopKetQuaCau, ChiTietKetQua và lib/ket-qua-cau.ts đã có từ GĐ17a; dùng lại, không viết lại.
Câu hỏi quyết định liên quan: H3, H4, H5, H8, H9 và đề xuất Đ5, Đ9, Đ11. Đọc cột "Trả lời" ở mục 2.8 và 2.9; câu còn trống thì dừng và hỏi tôi.

Việc làm:
1. Đua thời gian (routes/tro-choi.dua-thoi-gian.tsx) theo H3. Action giữ thêm giai_thich, can_cu của từng câu (dữ liệu API đã trả, không sửa API). Không làm chậm nhịp 350 ms, không dừng DongHoNguoc.
2. Hỏi nhanh giọng nói (routes/tro-choi.hoi-nhanh-giong-noi.tsx) theo H4. Action giữ thêm giai_thich, can_cu. Bỏ tự sang câu nếu H4 chọn có hộp; câu sau vẫn tự đọc khi hiện. Hộp không che thanh giọng nói của câu đang chờ.
3. Ghép cặp (routes/tro-choi.ghep-cap.tsx, components/tro-choi/BangGhepCap.tsx) theo H5. Mục "Mức phạt đúng" chuyển vào "Xem chi tiết"; liên kết "Xem điều khoản" đổi theo H8. Bảng ghép vẫn tô màu từng cặp.
4. Sửa e2e tro-choi.ts (phần Đua, Ghép cặp) và giong-noi.ts theo cách chọn phần tử mục 2.7.

File sửa: apps/web/app/routes/tro-choi.dua-thoi-gian.tsx, apps/web/app/routes/tro-choi.hoi-nhanh-giong-noi.tsx, apps/web/app/routes/tro-choi.ghep-cap.tsx, apps/web/app/components/tro-choi/BangGhepCap.tsx (chỉ nếu cần tách mục mức phạt), apps/web/app/components/tro-choi/chung/ChiTietKetQua.tsx (chỉ thêm chỗ nhận danh sách nếu thiếu, không đổi hành vi GĐ17a), scripts/e2e/tro-choi.ts, scripts/e2e/giong-noi.ts, scripts/e2e/hop-ket-qua.ts (thêm trường hợp), docs/PLAN.md.

Test bắt buộc (khung 360×740):
- Đua: nhịp câu không đổi (đo thời gian từ bấm tới câu sau vẫn khoảng 350 ms); màn kết thúc có danh sách câu sai, mỗi câu "Xem chi tiết" thu gọn, mở ra thấy giải thích (theo H3).
- Hỏi nhanh: trả lời bằng chạm thì hộp "Đúng"/"Chưa đúng" hiện, chưa đúng có dòng "Đáp án: …"; không tự sang câu; "Câu tiếp" nhận tiêu điểm; câu sau tự đọc (theo H4).
- Ghép cặp: nộp xong một hộp hiện với "Đúng x/5 cặp"; mức phạt đúng chỉ hiện sau khi bấm "Xem chi tiết" (theo H5).
- Không cuộn ngang, vùng chạm ≥ 48px, giảm chuyển động tắt hoạt ảnh.

Cuối phiên: cập nhật PLAN.md GĐ17b và đưa tóm tắt để tôi commit.
```

### GĐ17c. Chuyển khối kết quả dài của từng trò vào "Xem chi tiết"

```text
Làm GĐ17c "Hộp kết quả đúng/sai: chi tiết riêng của từng trò" theo docs/PLAN.md.
Trước khi làm, đọc và theo docs/PROMPT_HOP_KET_QUA_TRO_CHOI.md mục 1 (Phần chung), mục 2.3, 2.5 và quy tắc cứng 6. GĐ17a đã có HopKetQuaCau và ChiTietKetQua.
Câu hỏi quyết định liên quan: H7, H8 và đề xuất Đ12. Đọc cột "Trả lời" ở mục 2.8 và 2.9; câu còn trống thì dừng và hỏi tôi. H7 chọn "không" thì dừng, không làm giai đoạn này.

Việc làm:
1. components/tro-choi/giao-dien.tsx: thêm trường không bắt buộc ChiTiet vào mô tả trò (nhận de, chiTiet, ketQua). BuocDangChoi (tro-choi.luot.tsx), tro-choi.offline.tsx và màn "Xem lại từng câu" đưa ChiTiet vào ChiTietKetQua.
2. Với từng trò ở bảng mục 2.5 (cột GĐ = 17c): chuyển phần chữ của khối kết quả (DanhSachLoi, BienBan, bảng so sánh quy trình, KetQuaDuong, "Căn cứ: …", "Đáp án: …" của từng ô lập biên bản) sang ChiTiet. Phần đánh dấu trên bảng chơi (tô màu, "Đáp án đúng", "Đúng/Chưa đúng" trên từng ô, dấu ĐẠT/CHƯA ĐẠT) ở lại.
3. Trò thay cả bảng chơi bằng khối kết quả (Dừng xe, Cắm biển, Soi camera, Tự lái, Chốt đêm): sau khi chấm, vùng chơi hiện phần tóm tắt trực quan (nếu có); phần chữ vào ChiTiet. Trò nào không tách được mà không đổi luật chơi thì ghi vào "Thay đổi so với dự kiến" và hỏi tôi trước khi làm khác.
4. Mỗi trò làm xong thì chạy lại e2e của trò đó rồi mới sang trò sau.
5. Kiểm dung lượng mã riêng từng trò (≤ 8 KB gzip, ≤ 12 KB nếu dùng bộ mô phỏng).

File sửa: apps/web/app/components/tro-choi/giao-dien.tsx, apps/web/app/routes/tro-choi.luot.tsx (chỉ chỗ đưa ChiTiet vào hộp), apps/web/app/routes/tro-choi.offline.tsx (như trên), apps/web/app/components/tro-choi/KiemTraGiayTo.tsx, DuyetPhatNguoi.tsx, DungXe.tsx, CamBien.tsx, SoiCamera.tsx, TuLai.tsx, ChotDem.tsx, TramCan.tsx, LenXeKhach.tsx, SoiXeCaiTao.tsx, DuongChay.tsx, MauBienBan.tsx, chung/DanhSachLoi.tsx (nếu cần), scripts/e2e/ của các trò trên, scripts/e2e/hop-ket-qua.ts, docs/PLAN.md.
Kiểm lại tên tệp thật trước khi sửa.

Test bắt buộc (khung 360×740):
- Với mỗi trò ở bảng mục 2.5 (GĐ 17c): sau khi chấm, danh sách lỗi / biên bản / bảng so sánh không nhìn thấy trên trang; mở hộp, bấm "Xem chi tiết" thì thấy đủ, nội dung giống hệt trước khi chuyển (so số mục lỗi, số dòng căn cứ).
- Bảng chơi vẫn tô đáp án sau khi đóng hộp.
- Màn "Xem lại từng câu" hiện đủ chi tiết của từng trò sau khi bấm "Xem chi tiết".
- dung-xe.ts vẫn thấy "Căn cứ: Căn cứ đang được cập nhật" (sau khi mở chi tiết); lap-bien-ban.ts vẫn thấy dấu ĐẠT/CHƯA ĐẠT và chữ "Đúng" trên từng ô.
- Không cuộn ngang; phần chi tiết dài cuộn trong hộp, nút chính vẫn trong khung nhìn.

Cuối phiên: cập nhật PLAN.md GĐ17c và đưa tóm tắt để tôi commit.
```
