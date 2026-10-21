# Các ca sai của bộ `gold-citation`

> Tệp này do `evals/run-citation-eval.ts` sinh tự động. Không sửa tay.
> Lần chạy gần nhất: 2026-09-06. Ngưỡng chấp nhận: F1 ≥ 0,9800 (ke-hoach/12 §2).

## Kết quả tổng hợp

| Chỉ số | Giá trị |
|--------|---------|
| Số ca | 80 |
| Số ca khớp hoàn toàn | 74 (92,50%) |
| TP / FP / FN | 85 / 6 / 5 |
| Precision | 0,9341 |
| Recall | 0,9444 |
| F1 | 0,9392 |
| Đạt ngưỡng 0,9800 | **KHÔNG ĐẠT** |

## Danh sách ca sai

Mỗi ca nêu: chuỗi đầu vào, tập URN kỳ vọng, tập URN bộ phân giải trả về, phần thiếu (FN) và phần thừa (FP).

### Nhóm `noi_bo` — 2 ca sai

#### `cit-028-noibo` (độ khó: kho)

**Chuỗi đầu vào:**

```
Mẫu biểu ban hành kèm theo Thông tư này được sử dụng thống nhất.
```

**URN văn bản chứa viện dẫn:** `vn:vbqppl:tt:39/2026/TT-BKHCN`
**Kỳ vọng (0):** _(rỗng)_
**Trả về (1):** `vn:vbqppl:tt:39/2026/TT-BKHCN`
**Thừa (FP):** `vn:vbqppl:tt:39/2026/TT-BKHCN`
**Ghi chú của bộ dữ liệu vàng:** Chỉ nhắc tên văn bản, không có nút; không sinh URN cấp nút.

#### `cit-030-noibo` (độ khó: kho)

**Chuỗi đầu vào:**

```
Hồ sơ trình thực hiện theo Mẫu số 01 tại Phụ lục ban hành kèm theo Nghị định này.
```

**URN văn bản chứa viện dẫn:** `vn:vbqppl:nd:45/2026/NĐ-CP`
**Kỳ vọng (0):** _(rỗng)_
**Trả về (1):** `vn:vbqppl:nd:45/2026/NĐ-CP`
**Thừa (FP):** `vn:vbqppl:nd:45/2026/NĐ-CP`
**Ghi chú của bộ dữ liệu vàng:** Viện dẫn phụ lục, không phải nút điều khoản.

### Nhóm `day_du` — 1 ca sai

#### `cit-007-daydu` (độ khó: de)

**Chuỗi đầu vào:**

```
Thẩm quyền quyết định đầu tư xác định theo Điều 38 Luật số 58/2024/QH15.
```

**Kỳ vọng (1):** `vn:vbqppl:l:58/2024/QH15#dieu-38`
**Trả về (1):** `vn:vbqppl:l:58/2024/QH15`
**Thiếu (FN):** `vn:vbqppl:l:58/2024/QH15#dieu-38`
**Thừa (FP):** `vn:vbqppl:l:58/2024/QH15`

### Nhóm `nhieu_vien_dan` — 1 ca sai

#### `cit-036-nhieu` (độ khó: trung_binh)

**Chuỗi đầu vào:**

```
Theo khoản 2 Điều 9 của Nghị định này và Điều 8 Luật số 22/2023/QH15 thì hồ sơ được lập một lần.
```

**URN văn bản chứa viện dẫn:** `vn:vbqppl:nd:45/2026/NĐ-CP`
**Kỳ vọng (2):** `vn:vbqppl:nd:45/2026/NĐ-CP#dieu-9.khoan-2`, `vn:vbqppl:l:22/2023/QH15#dieu-8`
**Trả về (2):** `vn:vbqppl:nd:45/2026/NĐ-CP#dieu-9.khoan-2`, `vn:vbqppl:l:22/2023/QH15`
**Thiếu (FN):** `vn:vbqppl:l:22/2023/QH15#dieu-8`
**Thừa (FP):** `vn:vbqppl:l:22/2023/QH15`

### Nhóm `viet_tat` — 1 ca sai

#### `cit-079-kho` (độ khó: kho)

**Chuỗi đầu vào:**

```
khoản 2 điều 15 nđ 45/2026
```

**Kỳ vọng (1):** `vn:vbqppl:nd:45/2026/NĐ-CP#dieu-15.khoan-2`
**Trả về (1):** `vn:vbqppl:nd:45/2026#dieu-15.khoan-2`
**Thiếu (FN):** `vn:vbqppl:nd:45/2026/NĐ-CP#dieu-15.khoan-2`
**Thừa (FP):** `vn:vbqppl:nd:45/2026#dieu-15.khoan-2`
**Ghi chú của bộ dữ liệu vàng:** Người dùng gõ trên ô tìm kiếm: chữ thường, thiếu hậu tố NĐ-CP.

### Nhóm `liet_ke_khoan` — 1 ca sai

#### `cit-080-kho` (độ khó: kho)

**Chuỗi đầu vào:**

```
Các khoản 1, 2 và 3 Điều 16 Nghị định số 45/2026/NĐ-CP quy định về tổng mức đầu tư.
```

**Kỳ vọng (3):** `vn:vbqppl:nd:45/2026/NĐ-CP#dieu-16.khoan-1`, `vn:vbqppl:nd:45/2026/NĐ-CP#dieu-16.khoan-2`, `vn:vbqppl:nd:45/2026/NĐ-CP#dieu-16.khoan-3`
**Trả về (2):** `vn:vbqppl:nd:45/2026/NĐ-CP#dieu-16.khoan-1`, `vn:vbqppl:nd:45/2026/NĐ-CP#dieu-16`
**Thiếu (FN):** `vn:vbqppl:nd:45/2026/NĐ-CP#dieu-16.khoan-2`, `vn:vbqppl:nd:45/2026/NĐ-CP#dieu-16.khoan-3`
**Thừa (FP):** `vn:vbqppl:nd:45/2026/NĐ-CP#dieu-16`
**Ghi chú của bộ dữ liệu vàng:** Liệt kê nhiều khoản dùng chung một Điều.

## Ghi chú

Bộ dữ liệu vàng gán nhãn theo **cách hiểu pháp lý đúng**, không theo hành vi hiện tại của mã nguồn. Vì vậy một số ca sai phản ánh **giới hạn đã biết** của bộ phân giải chứ không phải lỗi hồi quy. Khi sửa `packages/citation`, chạy lại script này và so sánh với lần chạy trước để bảo đảm không giảm điểm ở các nhóm đang đạt.
