# Dữ liệu chuyển đổi địa giới hành chính

Ba tệp: `dia-gioi.json` (danh mục và đối chiếu cũ → mới, cả nước), `ranh-gioi.json` (ranh giới xã
để xác định vị trí GPS, hiện có tỉnh Thanh Hóa) và `thon.json` (thôn, tổ dân phố cũ → mới, hiện có tỉnh
Thanh Hóa).

`dia-gioi.json` phục vụ công cụ `/cong-cu/dia-gioi-hanh-chinh` (API `/v1/dia-gioi`, logic ở
`packages/dao-tao/src/dia-gioi.ts`). Tệp do `bun run dia-gioi:dung` (scripts/dia-gioi.ts) sinh ra, không sửa tay.

## Nội dung

| Khóa | Số lượng | Ý nghĩa |
|---|---|---|
| `tinhCu` | 63 | Tỉnh, thành phố trước ngày 01/7/2025 |
| `huyenCu` | 696 | Quận, huyện, thị xã, thành phố thuộc tỉnh trước ngày 01/7/2025 |
| `xaCu` | 10.035 | Xã, phường, thị trấn trước ngày 01/7/2025; `moi` là mã các xã mới nhận địa giới (471 xã có từ hai mã trở lên, tức bị chia); `tam` là tâm xã cũ `[kinh độ, vĩ độ]` (9.768 xã có) |
| `tinhMoi` | 34 | Tỉnh, thành phố hiện nay |
| `xaMoi` | 3.321 | Xã, phường, đặc khu hiện nay |

Năm huyện đảo không chia xã (Bạch Long Vĩ, Cồn Cỏ, Hoàng Sa, Lý Sơn, Côn Đảo) mang `moi` ở cấp huyện.
Mã đơn vị là mã thống kê (danhmuchanhchinh.gso.gov.vn). Dấu thanh đặt theo kiểu cũ (Hòa, Thủy) cho thống
nhất với văn bản trong kho.

## Nguồn (giấy phép MIT, ghim theo commit trong scripts/dia-gioi.ts)

1. [tranngocminhhieu/vietnamadminunits](https://github.com/tranngocminhhieu/vietnamadminunits), tệp
   `data/processed/convert_legacy_2025_with_location_and_default_ward.csv`: bảng đối chiếu xã cũ → xã mới,
   dựng từ danhmuchanhchinh.gso.gov.vn và sapnhap.bando.com.vn. Với xã bị chia, xã mới chứa trung tâm xã
   cũ theo nguồn này đứng đầu `moi`.
2. [thanglequoc/vietnamese-provinces-database](https://github.com/thanglequoc/vietnamese-provinces-database),
   tệp `json/full_json_generated_data_vn_units.json`: danh mục tỉnh, xã hiện nay, đã gồm các nghị quyết
   điều chỉnh sau ngày 01/7/2025. **Tên xã, tỉnh mới lấy theo nguồn này**, ghép với nguồn 1 theo mã.

## Khác biệt giữa hai nguồn (bản dựng ngày 09/10/2026)

Ngoài cách đặt dấu, 25 chỗ khác tên, đều do điều chỉnh sau ngày 01/7/2025:

- Bắc Ninh, Quảng Ninh, Đồng Nai: từ tỉnh thành thành phố trực thuộc trung ương.
- 12 xã của Bắc Ninh và 10 xã của Đồng Nai thành phường (ví dụ Xã Yên Phong → Phường Yên Phong).

Script in lại danh sách này mỗi lần dựng; danh sách đổi thì cập nhật mục này.

## Ranh giới xã (`ranh-gioi.json`)

Đa giác ranh giới xã, phường hiện nay, dùng cho Lấy vị trí hiện tại (`POST /v1/dia-gioi/vi-tri`) và Tra
theo địa chỉ (`/dia-chi`): tọa độ rơi vào đa giác nào thì thuộc xã đó (logic ở
`packages/dao-tao/src/ranh-gioi.ts`). Tệp do `bun run ranh-gioi:dung` (scripts/ranh-gioi.ts) sinh ra,
không sửa tay.

- Hiện có **tỉnh Thanh Hóa** (mã 38): đủ 166 xã, phường, mã khớp với `xaMoi` của `dia-gioi.json`.
  Thêm tỉnh: thêm mã vào `TINH` trong script rồi dựng lại.
- Nguồn: [thanglequoc/vietnamese-provinces-database](https://github.com/thanglequoc/vietnamese-provinces-database)
  (MIT), thư mục `json/geojson/<mã tỉnh>_<tên>/wards`, ghim cùng commit với danh mục xã mới ở trên. Ranh
  giới dựng từ Bản đồ đơn vị hành chính tham khảo (sapnhap.bando.com.vn) của NXB Tài nguyên – Môi trường
  và Bản đồ Việt Nam.
- Tọa độ WGS84 `[kinh độ, vĩ độ]`, làm tròn 5 chữ số và làm gọn ranh lệch tối đa ≈ 1 m (Douglas–Peucker).
  Ranh trả cho giao diện vẽ bản đồ làm gọn thêm, lệch tối đa ≈ 11 m.
- Bản dựng ngày 09/10/2026: không có chỗ hai xã chồng nhau; khoảng 0,6% điểm trong tỉnh (chủ yếu ven
  biển phía nam) không thuộc đa giác xã nào. Điểm như vậy lấy xã có ranh gần nhất trong 200 m, kết quả
  đánh dấu `ganRanh`.

Tên đường, số nhà không có trong tệp này: API lấy qua Nominatim (OpenStreetMap), xem
`apps/api/src/nominatim.ts`. Số nhà ở Việt Nam trên OpenStreetMap còn rất thưa.

Địa chỉ cũ tại một vị trí cũng không tra theo ranh giới (tệp chỉ có ranh xã mới). Xã cũ xác định theo ba
bước (`xaCuTaiViTri`, `xaCuGanNhat` trong `packages/dao-tao/src/dia-gioi.ts`):

1. Tên đơn vị OpenStreetMap ghi tại vị trí trùng đúng một xã cũ đã nhập vào xã mới. Bản dựng ngày
   10/10/2026: khu vực đô thị (thành phố Thanh Hóa cũ) OpenStreetMap còn giữ tên phường cũ nên xác định
   được; vùng nông thôn phần lớn chỉ ghi xã mới.
2. Bước 1 không xác định được thì, ở Tra theo địa chỉ, lấy tên xã cũ người dùng nêu trong địa chỉ gõ:
   viết kèm loại đơn vị ("phường Lam Sơn", "P. Lam Sơn") hoặc đứng riêng giữa hai dấu phẩy sau phần tên
   đường.
3. Không rõ theo tên thì **ước lượng**: lấy xã cũ có tâm (`tam`) gần vị trí nhất, kết quả mang nhãn Ước
   lượng và vẫn kèm danh sách các xã cũ còn lại. Ranh xã cũ không có trong dữ liệu nên vị trí gần ranh có
   thể thuộc xã bên cạnh.

Tâm xã cũ lấy từ cột `wardLat`, `wardLon` của nguồn 1 (nguồn định vị theo tên). Hai lớp lọc tâm sai: script
bỏ tâm khi hai xã cũ cùng một tọa độ (nguồn nhầm tên giống nhau khi bỏ dấu, ví dụ Hoằng Quỳ và Hoằng Quý);
API chỉ dùng tâm rơi vào một xã mới đã nhận địa giới của chính xã cũ đó, và không ước lượng khi xã mới có
xã cũ nào thiếu tâm dùng được. Bản dựng ngày 10/10/2026, tỉnh Thanh Hóa: 22 xã mới chỉ có một đơn vị cũ
(luôn rõ); trong 144 xã mới còn lại, 120 xã ước lượng được, 24 xã chỉ trả danh sách các xã cũ có thể.

## Thôn, tổ dân phố (`thon.json`)

Thôn, tổ dân phố cũ → tên mới theo từng xã mới, dùng cho ô Thôn/xóm của Chuyển đổi thủ công
(`GET /v1/dia-gioi/chuyen-doi?…&thon=`, logic `taoBoTraThon` ở `packages/dao-tao/src/dia-gioi.ts`). Tệp do
`bun run thon:dung` (scripts/thon.ts) sinh ra từ các phụ lục ở `nguon/`, không sửa tay.

- Hiện có **tỉnh Thanh Hóa**: `nguon/thon-thanh-hoa.md`, trích Phụ lục số 01 Phương án sắp xếp thôn, tổ
  dân phố kèm Quyết định 1717/QĐ-UBND ngày 09/6/2026 của UBND tỉnh Thanh Hóa. Bản dựng ngày 12/10/2026:
  166 xã, phường; 1.708 thôn, tổ dân phố mới. Thêm tỉnh: xem đầu scripts/thon.ts.
- **Tên mới là tên dự kiến** theo phương án (cột "Tên gọi mới (dự kiến)"); một số dòng còn ghi hai tên
  ("… hoặc …"). Giao diện ghi rõ "dự kiến" kèm căn cứ.
- Phụ lục chỉ ghi thôn được sắp xếp, tổ chức lại. Thôn không có trong phụ lục thì kết quả giữ tên đã
  nhập và báo không thấy trong danh sách.
- Tên thôn cũ giữ nguyên như nguồn, kể cả lỗi đánh máy (ví dụ "Thô 8"); tên nhập khớp không phân biệt
  dấu, có hay không có loại đơn vị (thôn, tổ dân phố, khu phố, bản, làng, xóm).
- Một tên thôn cũ có thể khớp nhiều dòng: thôn bị chia ("Một phần …"), hoặc các xã cũ nhập vào cùng xã
  mới có thôn trùng tên (Thôn 1, Thôn 2…). Nguồn ghi kèm tên xã cũ ("Thôn 5 (Minh Tân)") thì chọn theo
  xã cũ đã chọn; không thì trả mọi dòng để người dùng xác định theo vị trí.

## Giới hạn

Đây là dữ liệu tham khảo cho nghiệp vụ chuẩn hóa địa chỉ. Căn cứ chính thức là các nghị quyết của Ủy ban
Thường vụ Quốc hội về sắp xếp đơn vị hành chính của từng tỉnh, thành phố. Xã cũ bị chia thì phải xác định
xã mới theo vị trí cụ thể của địa chỉ.
