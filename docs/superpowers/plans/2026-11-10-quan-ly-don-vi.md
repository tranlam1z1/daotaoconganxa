# Quản lý đơn vị: loại chuẩn, nơi sinh hoạt Đảng, cây tìm được — Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Mục tiêu:** Đơn vị có loại chuẩn và mã hành chính; tài khoản ghi riêng nơi công tác và nơi sinh hoạt Đảng; trang quản trị và ô chọn đơn vị dùng được khi có hàng trăm đơn vị.

**Kiến trúc:** Thêm cột `units.loai`, `units.ma_hanh_chinh`, `accounts.party_unit_id` (migration 0087). Tầng `@qdpl/db` và `@qdpl/auth` nhận các trường mới; API kiểm mã hành chính bằng bộ tra địa giới sẵn có. Phía web, logic lọc cây nằm trong một tệp thuần (`lib/cay-don-vi.ts`, có test), một ô chọn có tìm kiếm (`ChonDonVi`) thay mọi `<select>` liệt kê toàn bộ đơn vị.

**Công nghệ:** Bun, Hono + zod (API), postgres.js + ltree, React Router 7 SSR, Tailwind 4, `bun:test`.

**Spec:** Mục "Giải pháp đề xuất" A, B, D trong cuộc trao đổi ngày 2026-11-10 (tóm tắt ở mục Phạm vi dưới đây).

## Phạm vi

- **A.** Loại đơn vị chuẩn thay ô "Tên cấp" gõ tự do; đơn vị loại xã gắn mã xã 5 số trong `data/dia-gioi/dia-gioi.json`.
- **B.** Tài khoản có nơi công tác (`unit_id`, giữ nguyên) và nơi sinh hoạt Đảng (`party_unit_id`, chỉ đơn vị loại `to_chuc_dang`, không bắt buộc).
- **D.** Trang `/quan-tri/don-vi` có ô tìm, lọc loại, thu gọn/mở nhánh; ô chọn cấp trên, ô chọn đơn vị lúc đăng ký và lúc sửa người dùng đều là ô gõ để tìm, hiện đường dẫn cấp trên.

**Thay đổi so với đề xuất ban đầu:** đăng ký không chọn theo bậc Tỉnh → Xã → Cơ quan, mà dùng một ô tìm hiện đường dẫn ("UBND xã Minh Hòa — Xã Minh Hòa"). Lý do: chọn theo bậc chỉ đúng khi mọi đơn vị nằm dưới một xã có mã hành chính, cây hiện tại không bảo đảm điều đó.

**Ngoài phạm vi:** báo cáo theo cây tổ chức Đảng, quyền quản lý theo `party_unit_id`, nhập Excel đơn vị, xóa/gộp đơn vị (C, E, F).

## Ràng buộc chung

- Giá trị `loai`: `xa`, `co_quan_hanh_chinh`, `don_vi_su_nghiep`, `to_chuc_dang`, `doan_the`, `khac`. Mặc định `khac`.
- Nhãn hiển thị: Xã, phường · Cơ quan hành chính · Đơn vị sự nghiệp · Tổ chức Đảng · Đoàn thể · Khác.
- `ma_hanh_chinh`: đúng 5 chữ số, chỉ có khi `loai = 'xa'`, không trùng giữa các đơn vị, phải có trong danh mục xã mới (`BoTraDiaGioi.xaMoi(ma)`).
- `party_unit_id` trỏ tới đơn vị `loai = 'to_chuc_dang'` đang hoạt động (kiểm ở tầng ứng dụng khi ghi); xóa đơn vị thì `SET NULL`.
- Chữ trên giao diện, thông báo lỗi, chú thích mã: tiếng Việt, theo giọng các tệp hiện có.
- Không đổi `path`, `unit_id`, `don_vi_khai`, phạm vi quyền (`phamViCua`, `batBuocPhamViDonVi`).
- Tìm kiếm không phân biệt hoa thường, dấu, và `đ`/`d`.
- Chạy `bun run lint` và `bun run typecheck` sạch trước mỗi commit.

## Trọng tâm review

1. Đổi loại một đơn vị từ `xa` sang loại khác khi đang có `ma_hanh_chinh`: mã bị xóa cùng lúc, không báo lỗi ràng buộc CSDL thô. Test ở Task 1.
2. Mã hành chính đã gắn cho đơn vị khác: trả 409 "Mã xã … đã gắn với đơn vị …", không phải lỗi 500. Test ở Task 1 (tầng db) và Task 2 (API).
3. Tổ chức Đảng bị ngừng dùng sau khi người dùng đã chọn: người đó vẫn giữ `party_unit_id`, chỉ không chọn mới được. Test ở Task 3.
4. Gõ "minh hoa" hoặc "dang uy" vẫn tìm thấy "Minh Hòa", "Đảng ủy". Test ở Task 4.
5. Trang đăng ký trước khi JavaScript chạy (SSR, mạng chậm): ô chọn đơn vị vẫn gửi được form. `ChonDonVi` hiện `<select>` gốc cho tới khi hydrate. Kiểm bằng tay ở Task 5.

---

### Task 1: Migration và tầng `@qdpl/db`

**Files:**
- Create: `packages/db/migrations/0087_loai_don_vi.sql`
- Modify: `packages/db/src/don-vi.ts` (interface `DonVi`, `COT`, `DuLieuDonVi`, `SuaDonVi`, `taoDonVi`, `suaDonVi`)
- Modify: `packages/db/src/seed-don-vi.ts` (bộ mẫu ghi `loai`)
- Test: `apps/api/src/nguoi-dung.test.ts` (khối `describe` mới "loại đơn vị")

**Interfaces:**
- Produces:
  - `export const LOAI_DON_VI = ["xa","co_quan_hanh_chinh","don_vi_su_nghiep","to_chuc_dang","doan_the","khac"] as const;` và `export type LoaiDonVi = (typeof LOAI_DON_VI)[number];` trong `don-vi.ts`, export qua `@qdpl/db`.
  - `DonVi` thêm `loai: LoaiDonVi; ma_hanh_chinh: string | null`.
  - `DuLieuDonVi` thêm `loai?: LoaiDonVi; maHanhChinh?: string | null`. `SuaDonVi` thêm cùng hai trường (`undefined` = giữ nguyên).

- [ ] **Step 1: Viết migration `0087_loai_don_vi.sql`**

  - `ALTER TABLE units ADD COLUMN IF NOT EXISTS loai text NOT NULL DEFAULT 'khac'` kèm `CHECK (loai IN (...6 giá trị))`.
  - `ADD COLUMN IF NOT EXISTS ma_hanh_chinh text`, `CHECK (ma_hanh_chinh ~ '^\d{5}$')`, `CHECK (ma_hanh_chinh IS NULL OR loai = 'xa')`, `CREATE UNIQUE INDEX IF NOT EXISTS units_ma_hanh_chinh_key ON units(ma_hanh_chinh) WHERE ma_hanh_chinh IS NOT NULL`.
  - Điền `loai` từ `level_label` hiện có: `'Xã'`→`xa`, `'Cơ quan hành chính'`→`co_quan_hanh_chinh`, `'Đơn vị sự nghiệp'`→`don_vi_su_nghiep`, `'Tổ chức Đảng'`→`to_chuc_dang`; còn lại giữ `khac`. So khớp `lower(trim(level_label))`.
  - `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS party_unit_id uuid REFERENCES units(id) ON DELETE SET NULL`, index `accounts_party_unit_idx`.
  - Chú thích đầu tệp theo kiểu 0011/0064: vì sao tách nơi sinh hoạt Đảng, vì sao giữ `level_label` (cột cũ, không còn ô nhập).

- [ ] **Step 2: Chạy migration**

  Run: `bun run db:migrate`
  Expected: áp dụng `0087_loai_don_vi.sql`, không lỗi; chạy lại lần hai không làm gì.

- [ ] **Step 3: Viết test thất bại** (trong `nguoi-dung.test.ts`, dữ liệu mang `PREFIX`)

```ts
test("tạo đơn vị loại xã kèm mã hành chính", async () => {
  const d = await taoDonVi({ code: `${PREFIX}-xa1`, name: "Xã A", loai: "xa", maHanhChinh: "00004" }, ACTOR);
  expect(d.loai).toBe("xa");
  expect(d.ma_hanh_chinh).toBe("00004");
});
test("mặc định loại khác", async () => {
  const d = await taoDonVi({ code: `${PREFIX}-k1`, name: "Đơn vị K" }, ACTOR);
  expect(d.loai).toBe("khac");
});
test("mã hành chính trên đơn vị không phải xã bị từ chối", async () => {
  await expect(taoDonVi({ code: `${PREFIX}-cq1`, name: "CQ", loai: "co_quan_hanh_chinh", maHanhChinh: "00004" }, ACTOR))
    .rejects.toMatchObject({ loai: "khong_hop_le" });
});
test("mã hành chính trùng trả xung đột", async () => {
  await expect(taoDonVi({ code: `${PREFIX}-xa2`, name: "Xã B", loai: "xa", maHanhChinh: "00004" }, ACTOR))
    .rejects.toMatchObject({ loai: "xung_dot" });
});
test("đổi loại xã sang loại khác thì xóa mã hành chính", async () => {
  const d = await layDonViTheoMa(`${PREFIX}-xa1`);
  const s = await suaDonVi(d!.id, { loai: "khac" }, ACTOR);
  expect(s.loai).toBe("khac");
  expect(s.ma_hanh_chinh).toBeNull();
});
```

  Dùng mã xã có thật trong `data/dia-gioi/dia-gioi.json` thay `"00004"` nếu mã đó không có (tầng db không kiểm danh mục, nhưng giữ dữ liệu test thật). Bổ sung `units WHERE code LIKE PREFIX%` vào `donDep()` nếu chưa có.

- [ ] **Step 4: Chạy test, thấy thất bại**

  Run: `bun test apps/api/src/nguoi-dung.test.ts -t "loại đơn vị"`
  Expected: FAIL (`loai` undefined / không ném lỗi).

- [ ] **Step 5: Sửa `don-vi.ts`**

  - `COT` thêm `u.loai, u.ma_hanh_chinh`.
  - `kiemLoai(loai, maHanhChinh)`: mã khác null mà loại khác `xa` → `LoiNghiepVu("Chỉ đơn vị loại xã, phường mới có mã hành chính.", "khong_hop_le")`; mã không đúng 5 số → `"Mã xã gồm đúng 5 chữ số."`.
  - Trùng mã (kiểm trong giao dịch, trước INSERT/UPDATE) → `LoiNghiepVu(\`Mã xã ${ma} đã gắn với đơn vị "${ten}".\`, "xung_dot")`.
  - `suaDonVi`: loại sau khi sửa khác `xa` thì ghi `ma_hanh_chinh = NULL`; `maHanhChinh: undefined` giữ nguyên, `null` xóa.
  - Nhật ký `don_vi:tao`/`don_vi:sua` ghi thêm `loai`, `maHanhChinh`.

- [ ] **Step 6: Cập nhật `seed-don-vi.ts`**: mỗi dòng `donVi` thêm loại (`xa`, `co_quan_hanh_chinh`, `don_vi_su_nghiep`, `to_chuc_dang`); INSERT và nhánh `--cap-nhat-mau` ghi `loai`. Không gắn mã hành chính cho xã mẫu.

- [ ] **Step 7: Chạy test, thấy qua**

  Run: `bun test apps/api/src/nguoi-dung.test.ts`
  Expected: PASS toàn tệp (cả test cũ).

- [ ] **Step 8: Commit**

```bash
git add packages/db/migrations/0087_loai_don_vi.sql packages/db/src/don-vi.ts packages/db/src/seed-don-vi.ts apps/api/src/nguoi-dung.test.ts
git commit -m "feat(don-vi): thêm loại đơn vị chuẩn và mã hành chính cho xã"
```

---

### Task 2: API đơn vị nhận loại, kiểm mã theo danh mục; danh sách chọn có đường dẫn

**Files:**
- Modify: `apps/api/src/routes/dia-gioi.ts` (export `layBoTra`)
- Modify: `apps/api/src/routes/nguoi-dung.ts:80-114` (`donViSchema`, POST, PATCH)
- Modify: `apps/api/src/routes/auth.ts:281-293` (`GET /v1/auth/don-vi`)
- Test: `apps/api/src/nguoi-dung.test.ts`, `apps/api/src/auth.test.ts`

**Interfaces:**
- Consumes: `LOAI_DON_VI`, `DuLieuDonVi.loai/maHanhChinh` (Task 1); `BoTraDiaGioi.xaMoi(ma)`.
- Produces:
  - `export async function layBoTra(): Promise<BoTraDiaGioi>` từ `routes/dia-gioi.ts`.
  - Body POST/PATCH `/v1/quan-tri/don-vi`: thêm `loai?: LoaiDonVi`, `maHanhChinh?: string | null`.
  - `GET /v1/auth/don-vi` → `{ items: Array<{ id: string; ten: string; cap: number; loai: LoaiDonVi; duong: string }> }`, `duong` là tên các cấp trên nối bằng `" › "` (rỗng nếu là gốc).

- [ ] **Step 1: Viết test thất bại**

  - `nguoi-dung.test.ts`: POST `{ code, name, loai: "xa", maHanhChinh: "99999" }` bằng token quản trị → 400, `body.error` chứa "Không có xã, phường mã 99999". POST với mã có thật → 201, `item.ma_hanh_chinh` đúng. POST trùng mã → 409. POST `loai: "abc"` → 400.
  - `auth.test.ts`: tạo cha `${PREFIX} Xã` và con `${PREFIX} UBND`, GET `/v1/auth/don-vi` → phần tử con có `duong === "<tên cha>"`, `loai` đúng; con của đơn vị ngừng dùng vẫn bị ẩn như trước.

- [ ] **Step 2: Chạy test, thấy thất bại**

  Run: `bun test apps/api/src/nguoi-dung.test.ts apps/api/src/auth.test.ts`
  Expected: FAIL ở các test mới.

- [ ] **Step 3: Sửa code**

  - `donViSchema`: `loai: z.enum(LOAI_DON_VI).optional()`, `maHanhChinh: z.string().regex(/^\d{5}$/, "Mã xã gồm đúng 5 chữ số").nullable().optional()`. Giữ `levelLabel` trong schema để client cũ không vỡ.
  - POST/PATCH: có `maHanhChinh` thì `(await layBoTra()).xaMoi(ma)`; không có → `badRequest(\`Không có xã, phường mã ${ma} trong danh mục hiện hành.\`)`.
  - `/v1/auth/don-vi`: dựng `duong` từ `parent_id` trên chính danh sách `ds` (đã theo thứ tự cây), chỉ trả trường nêu ở Interfaces.

- [ ] **Step 4: Chạy test, thấy qua**

  Run: `bun test apps/api/src/nguoi-dung.test.ts apps/api/src/auth.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/dia-gioi.ts apps/api/src/routes/nguoi-dung.ts apps/api/src/routes/auth.ts apps/api/src/nguoi-dung.test.ts apps/api/src/auth.test.ts
git commit -m "feat(api): đơn vị nhận loại, kiểm mã xã theo danh mục; danh sách chọn kèm đường dẫn"
```

---

### Task 3: Nơi sinh hoạt Đảng trên tài khoản

**Files:**
- Modify: `packages/auth/src/dang-ky.ts` (`KhaiBaoXacMinh`, `kiemKhaiBao`, `dangKyTaiKhoan`, `ThongTinXacMinh`, `thongTinXacMinh`, `capNhatKhaiBao`)
- Modify: `apps/api/src/routes/auth.ts` (body `/dang-ky`, `PUT /xac-minh`)
- Modify: `apps/api/src/routes/nguoi-dung.ts` (`taoNguoiDungSchema`, `suaNguoiDungSchema`, danh sách người dùng trả `don_vi_dang`)
- Modify: hàm tạo/sửa người dùng trong `packages/db/src/nguoi-dung.ts` (nhận `partyUnitId`)
- Test: `packages/auth/tests/dang-ky.test.ts`, `apps/api/src/nguoi-dung.test.ts`

**Interfaces:**
- Consumes: cột `accounts.party_unit_id`, `units.loai` (Task 1).
- Produces:
  - `KhaiBaoXacMinh.donViDangId?: string | null`.
  - `ThongTinXacMinh.donViDang: { id: string; ten: string } | null`; JSON API `xac_minh.don_vi_dang`.
  - Body API: `don_vi_dang_id` (đăng ký, khai lại), `partyUnitId` (quản trị tạo/sửa người dùng).
  - `export async function kiemDonViDang(id: string): Promise<void>` trong `packages/db/src/don-vi.ts`, ném `LoiNghiepVu("Nơi sinh hoạt Đảng phải là tổ chức Đảng đang hoạt động.", "khong_hop_le")`.

- [ ] **Step 1: Viết test thất bại**

  - `dang-ky.test.ts`: đăng ký với `donViDangId` là đơn vị `to_chuc_dang` → `thongTinXacMinh(id).donViDang.id` đúng. Với đơn vị `co_quan_hanh_chinh` → ném `LoiDangKy` chứa "tổ chức Đảng". Bỏ trống → `donViDang === null`.
  - `nguoi-dung.test.ts`: PATCH người dùng `{ partyUnitId }` hợp lệ → 200; sau đó PATCH đơn vị Đảng `{ enabled: false }`, GET người dùng vẫn có `don_vi_dang.id` đó (Trọng tâm review 3); đăng ký mới chọn đơn vị đã ngừng → lỗi.

- [ ] **Step 2: Chạy test, thấy thất bại**

  Run: `bun test packages/auth/tests/dang-ky.test.ts apps/api/src/nguoi-dung.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Sửa code**

  - `kiemKhaiBao`: `donViDangId` rỗng → `null`; có giá trị → gọi `kiemDonViDang` (đổi lỗi sang `LoiDangKy` cùng câu chữ).
  - `dangKyTaiKhoan`/`capNhatKhaiBao` ghi thẳng `party_unit_id` (không chờ duyệt: đây là thông tin khai, không cấp quyền).
  - `thongTinXacMinh`: `LEFT JOIN units pu ON pu.id = a.party_unit_id`.
  - Quản trị tạo/sửa người dùng: `partyUnitId: uuid.nullable().optional()`, có giá trị thì `kiemDonViDang`; `null` xóa.

- [ ] **Step 4: Chạy test, thấy qua**

  Run: `bun test packages/auth apps/api/src/nguoi-dung.test.ts apps/api/src/auth.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/auth packages/db/src/don-vi.ts packages/db/src/nguoi-dung.ts apps/api/src/routes apps/api/src/*.test.ts
git commit -m "feat(tai-khoan): ghi riêng nơi sinh hoạt Đảng bên cạnh nơi công tác"
```

---

### Task 4: Logic cây đơn vị phía web

**Files:**
- Create: `apps/web/app/lib/cay-don-vi.ts`
- Test: `apps/web/tests/cay-don-vi.test.ts`

**Interfaces:**
- Produces:
  - `export const NHAN_LOAI: Record<LoaiDonVi, string>` (nhãn ở Ràng buộc chung) và `export type LoaiDonVi` (bản sao 6 giá trị; CSDL và zod là nguồn kiểm).
  - `export function khoaTimDonVi(s: string): string` — bỏ dấu (`normalize("NFD")` + bỏ `\p{M}`), `đ`→`d`, chữ thường, gộp khoảng trắng.
  - `export function timDonVi<T extends { ten: string; duong: string }>(ds: T[], q: string, gioiHan = 50): T[]` — khớp mọi từ của `q` trong `ten + " " + duong`; tên khớp ở đầu xếp trước; `q` rỗng trả `ds.slice(0, gioiHan)`.
  - `export function locCay(ds: Array<{ id: string; parent_id: string | null; name: string; loai: LoaiDonVi }>, q: string, loai: LoaiDonVi | ""): Set<string> | null` — `null` khi không lọc; ngược lại là id các đơn vị khớp cộng mọi cấp trên của chúng.
  - `export function canHien(ds, id, dangThu: Set<string>): boolean` — false khi có cấp trên nằm trong `dangThu`.

- [ ] **Step 1: Viết test thất bại**

```ts
test("tìm không dấu", () => {
  expect(timDonVi([{ ten: "Đảng ủy xã Minh Hòa", duong: "" }], "dang uy minh hoa")).toHaveLength(1);
});
test("tìm theo đường dẫn cấp trên", () => {
  expect(timDonVi([{ ten: "UBND", duong: "Xã Minh Hòa" }], "minh hoa")).toHaveLength(1);
});
test("locCay giữ cấp trên của đơn vị khớp", () => {
  const ds = [
    { id: "a", parent_id: null, name: "Xã A", loai: "xa" },
    { id: "b", parent_id: "a", name: "Trường B", loai: "don_vi_su_nghiep" },
    { id: "c", parent_id: "a", name: "UBND", loai: "co_quan_hanh_chinh" },
  ] as const;
  expect(locCay([...ds], "truong", "")).toEqual(new Set(["a", "b"]));
  expect(locCay([...ds], "", "co_quan_hanh_chinh")).toEqual(new Set(["a", "c"]));
  expect(locCay([...ds], "", "")).toBeNull();
});
test("canHien ẩn con của nhánh đang thu", () => {
  // ds như trên; thu "a" thì "b" ẩn, "a" vẫn hiện
});
```

- [ ] **Step 2: Chạy test, thấy thất bại**

  Run: `bun test apps/web/tests/cay-don-vi.test.ts`
  Expected: FAIL, "Cannot find module".

- [ ] **Step 3: Viết `cay-don-vi.ts` theo Interfaces.**

- [ ] **Step 4: Chạy test, thấy qua**

  Run: `bun test apps/web/tests/cay-don-vi.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/lib/cay-don-vi.ts apps/web/tests/cay-don-vi.test.ts
git commit -m "feat(web): thêm hàm tìm và lọc cây đơn vị"
```

---

### Task 5: Ô chọn đơn vị có tìm kiếm, dùng ở đăng ký, tài khoản, người dùng

**Files:**
- Create: `apps/web/app/components/ui/ChonDonVi.tsx`
- Modify: `apps/web/app/components/tai-khoan/KhaiXacMinh.tsx`
- Modify: `apps/web/app/lib/types.ts` (`DonViChon` thêm `loai`, `duong`; `ThongTinXacMinh` thêm `don_vi_dang`)
- Modify: `apps/web/app/routes/dang-ky.tsx`, `apps/web/app/routes/tai-khoan.tsx` (gửi `don_vi_dang_id`)
- Modify: `apps/web/app/routes/quan-tri.nguoi-dung.tsx` (ô nơi công tác dùng `ChonDonVi`; thêm ô nơi sinh hoạt Đảng, gửi `partyUnitId`)

**Interfaces:**
- Consumes: `timDonVi`, `NHAN_LOAI` (Task 4); `GET /v1/auth/don-vi` (Task 2); `don_vi_dang_id`, `partyUnitId`, `xac_minh.don_vi_dang` (Task 3).
- Produces: `export function ChonDonVi(props: { id: string; name: string; items: DonViChon[]; defaultValue?: string | null; required?: boolean; placeholder: string; chiLoai?: LoaiDonVi; moTaId?: string }): JSX.Element`.

- [ ] **Step 1: Viết `ChonDonVi`**

  - Trước khi hydrate (`useEffect` bật cờ): render `<select name={name}>` gốc với danh sách đã lọc `chiLoai`, để form gửi được khi chưa có JS (Trọng tâm review 5).
  - Sau khi hydrate: `<input role="combobox" aria-expanded aria-controls aria-activedescendant>` + `<ul role="listbox">`, `<input type="hidden" name={name}>` mang id. Mỗi dòng: tên in đậm, dưới là `duong` và nhãn loại. Phím ↑/↓/Enter/Esc; ô trống hiện 50 mục đầu; không khớp hiện "Không có đơn vị khớp. Liên hệ quản trị viên để bổ sung." Không `required` thì có dòng "Bỏ chọn".
  - Chiều cao chạm tối thiểu 44px, cùng `inputClass` với các ô khác.

- [ ] **Step 2: `KhaiXacMinh`**: ô "Nơi công tác" (`don_vi_id`, bắt buộc, mọi loại) và ô "Nơi sinh hoạt Đảng (nếu là đảng viên)" (`don_vi_dang_id`, `chiLoai="to_chuc_dang"`, không bắt buộc). Bỏ câu "nơi công tác hoặc sinh hoạt Đảng". Action của `dang-ky.tsx`, `tai-khoan.tsx` đọc thêm `don_vi_dang_id`.

- [ ] **Step 3: `quan-tri.nguoi-dung.tsx`**: thay `<select>` đơn vị bằng `ChonDonVi`; thêm ô nơi sinh hoạt Đảng; hiện tên tổ chức Đảng trong hộp chi tiết người dùng. Dữ liệu chọn lấy từ cùng danh sách loader đang dùng, map sang `DonViChon` (`duong` dựng bằng `parent_id`).

- [ ] **Step 4: Kiểm**

  Run: `bun run typecheck; bun run lint; bun test apps/web`
  Expected: sạch, PASS.
  Bằng tay (`bun run dev`): đăng ký, gõ "minh hoa" ra đơn vị mẫu; chọn tổ chức Đảng; vào Tài khoản thấy đã lưu cả hai; tắt JavaScript trong trình duyệt, trang đăng ký vẫn gửi được.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/components apps/web/app/lib/types.ts apps/web/app/routes/dang-ky.tsx apps/web/app/routes/tai-khoan.tsx apps/web/app/routes/quan-tri.nguoi-dung.tsx
git commit -m "feat(web): ô chọn đơn vị có tìm kiếm, khai riêng nơi sinh hoạt Đảng"
```

---

### Task 6: Trang `/quan-tri/don-vi` dạng cây tìm được, biểu mẫu theo loại

**Files:**
- Modify: `apps/web/app/routes/quan-tri.don-vi.tsx`

**Interfaces:**
- Consumes: `locCay`, `canHien`, `NHAN_LOAI`, `timDonVi` (Task 4); `ChonDonVi` (Task 5); body `loai`, `maHanhChinh` (Task 2); `GET /v1/dia-gioi/moi/tinh`, `GET /v1/dia-gioi/moi/tinh/:ma/xa` (đã có).

- [ ] **Step 1: Thanh công cụ trên danh sách**: ô tìm (`type="search"`, nhãn hiển thị "Tìm đơn vị"), `<select>` lọc loại ("Mọi loại" + 6 loại), nút "Thu gọn tất cả" / "Mở tất cả". Dòng tổng "N đơn vị, M người" đổi thành "Hiện K/N đơn vị" khi đang lọc.

- [ ] **Step 2: Danh sách cây**: mỗi dòng có nút mũi tên thu/mở (chỉ khi có con, `aria-expanded`, nhãn "Thu gọn <tên>"/"Mở <tên>"). Mặc định mở hai cấp đầu tính từ `capGoc`; lúc đang lọc thì mở hết và chỉ hiện id trong `locCay(...)`. Dòng phụ hiện `NHAN_LOAI[d.loai]` thay `level_label`, kèm mã xã nếu có. Lọc không ra gì: `EmptyState` "Không có đơn vị khớp" kèm nút "Xóa bộ lọc". Trạng thái thu/mở giữ trong `useState`, không lưu.

- [ ] **Step 3: Biểu mẫu thêm/sửa (`TruongDonVi`)**: bỏ ô "Tên cấp"; thêm `<select name="loai">` (mặc định `khac` khi thêm, giá trị hiện tại khi sửa). Ô "Đơn vị cấp trên" dùng `ChonDonVi` (không bắt buộc, `placeholder="Không có (đơn vị gốc)"`), bỏ qua chính nó và con cháu như `boQua` hiện nay. Khi loại là `xa`: hiện hai ô Tỉnh → Xã (gọi API địa giới phía client qua `apiBase`), chọn xã thì gửi `maHanhChinh`, và điền tên ("<tên xã>") cùng mã (`XA-<mã 5 số>`) nếu hai ô đó đang trống. Đổi loại khỏi `xa` thì gửi `maHanhChinh: null`. Action đọc `loai`, `maHanhChinh`, không gửi `levelLabel` nữa.

- [ ] **Step 4: Hộp chi tiết**: dòng "Cấp" đổi thành "Loại" (`NHAN_LOAI`), thêm "Mã xã" khi có, kèm tên tỉnh nếu tra được.

- [ ] **Step 5: Kiểm**

  Run: `bun run typecheck; bun run lint; bun test`
  Expected: sạch, PASS toàn bộ.
  Bằng tay: tìm "truong" thấy trường mẫu cùng xã cha; lọc "Tổ chức Đảng"; thu gọn xã mẫu; thêm một xã từ danh mục (tên, mã tự điền); đổi loại xã đó sang "Khác" thì mã xã mất; màn 375px không cuộn ngang.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/routes/quan-tri.don-vi.tsx
git commit -m "feat(quan-tri): cây đơn vị có tìm, lọc loại, thu gọn; thêm xã từ danh mục hành chính"
```
