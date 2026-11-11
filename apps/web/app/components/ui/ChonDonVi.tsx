/**
 * Ô chọn đơn vị có tìm kiếm, thay `<select>` liệt kê toàn bộ cây (docs/superpowers/plans/
 * 2026-11-10-quan-ly-don-vi.md, Task 5). Gõ một phần tên đơn vị hoặc tên cấp trên, không cần dấu.
 *
 * Trước khi JavaScript chạy (trang SSR, mạng chậm) ô hiện `<select>` gốc để biểu mẫu vẫn gửi được.
 * Sau khi hydrate thành ô gõ kiểu combobox (WAI-ARIA 1.2): ↑/↓ chọn dòng, Enter nhận, Esc đóng.
 * Giá trị gửi đi nằm trong ô ẩn `name`; ô gõ mang `required` để trình duyệt chặn gửi khi chưa chọn.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { dsChon, ketQuaChon, type LoaiDonVi, type MucDonVi, NHAN_LOAI } from "../../lib/cay-don-vi";
import { cn } from "../../lib/cn";
import { phimCombobox, viTriKhiMo } from "../../lib/combobox";
import { inputClass } from "./Field";

const BO_CHON = "__bo_chon__";

function nhanDayDu(d: MucDonVi): string {
  return d.duong ? `${d.ten} — ${d.duong}` : d.ten;
}

export function ChonDonVi({
  id,
  name,
  items,
  defaultValue,
  tenMacDinh,
  required = false,
  placeholder,
  chiLoai,
  moTaId,
  className,
}: {
  id: string;
  name: string;
  items: MucDonVi[];
  defaultValue?: string | null;
  /**
   * Tên của `defaultValue`. Có thì giá trị đang gắn được giữ (ghi "ngừng dùng") cả khi đơn vị đó
   * không còn trong `items` hay không đúng `chiLoai`, để lưu biểu mẫu không âm thầm xóa nó.
   */
  tenMacDinh?: string | null;
  required?: boolean;
  placeholder: string;
  /** Chỉ cho chọn đơn vị loại này (ví dụ nơi sinh hoạt Đảng: `to_chuc_dang`). */
  chiLoai?: LoaiDonVi;
  moTaId?: string;
  className?: string;
}) {
  const ds = useMemo(
    () => dsChon(items, chiLoai, defaultValue && tenMacDinh ? { id: defaultValue, ten: tenMacDinh } : null),
    [items, chiLoai, defaultValue, tenMacDinh],
  );
  const [chon, datChon] = useState<string>(
    defaultValue && ds.some((d) => d.id === defaultValue) ? defaultValue : "",
  );
  const [daHydrate, datHydrate] = useState(false);
  const selectGoc = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    // Người dùng có thể đã chọn trên <select> gốc trước khi JavaScript chạy: giữ lựa chọn đó.
    const daChonTruoc = selectGoc.current?.value;
    if (daChonTruoc !== undefined) datChon(daChonTruoc);
    datHydrate(true);
  }, []);
  const [q, datQ] = useState("");
  const [mo, datMo] = useState(false);
  const [viTri, datViTri] = useState(-1);
  const listId = useId();
  const dongId = (i: number) => `${listId}-${i}`;
  // Bấm ↑/↓ qua mép khung danh sách thì cuộn theo dòng đang đánh dấu.
  useEffect(() => {
    if (mo && viTri >= 0) document.getElementById(`${listId}-${viTri}`)?.scrollIntoView({ block: "nearest" });
  }, [mo, viTri, listId]);

  if (!daHydrate) {
    return (
      <select
        ref={selectGoc}
        id={id}
        name={name}
        required={required}
        defaultValue={chon}
        aria-describedby={moTaId}
        className={cn(inputClass, className)}
      >
        <option value="" disabled={required}>
          {placeholder}
        </option>
        {ds.map((d) => (
          <option key={d.id} value={d.id}>
            {nhanDayDu(d)}
          </option>
        ))}
      </select>
    );
  }

  const { muc: ketQua, conLai } = ketQuaChon(ds, q, chon);
  // Dòng "Bỏ chọn" đứng đầu khi ô không bắt buộc và đang có giá trị.
  const dong: Array<MucDonVi | typeof BO_CHON> = !required && chon ? [BO_CHON, ...ketQua] : ketQua;
  const dangChon = ds.find((d) => d.id === chon);

  const nhan = (d: MucDonVi | typeof BO_CHON | undefined) => {
    if (!d) return;
    datChon(d === BO_CHON ? "" : d.id);
    datMo(false);
    datQ("");
  };
  const moDanhSach = () => {
    datMo(true);
    datQ("");
    // Đánh dấu dòng đang chọn (không mặc định dòng đầu), để Enter không thay giá trị.
    const idsKhiMo = [
      ...(!required && chon ? [BO_CHON] : []),
      ...ketQuaChon(ds, "", chon).muc.map((d) => d.id),
    ];
    datViTri(viTriKhiMo(idsKhiMo, chon));
  };

  return (
    <div className={cn("relative", className)}>
      <input type="hidden" name={name} value={chon} />
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={mo}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={mo && viTri >= 0 && viTri < dong.length ? dongId(viTri) : undefined}
        aria-describedby={moTaId}
        autoComplete="off"
        spellCheck={false}
        required={required}
        placeholder={dangChon ? nhanDayDu(dangChon) : placeholder}
        value={mo ? q : dangChon ? nhanDayDu(dangChon) : ""}
        onFocus={moDanhSach}
        onClick={() => !mo && moDanhSach()}
        onBlur={() => datMo(false)}
        onChange={(e) => {
          datQ(e.target.value);
          datMo(true);
          datViTri(0);
        }}
        onKeyDown={(e) => {
          const kq = phimCombobox(e.key, viTri, dong.length, mo);
          if (!kq.hanhDong) return;
          // `dong_gui`: đóng danh sách nhưng để Enter gửi biểu mẫu như ô nhập thường.
          if (kq.hanhDong !== "dong_gui") e.preventDefault();
          if (kq.hanhDong === "mo") return moDanhSach();
          if (kq.hanhDong === "nhan") return nhan(dong[kq.viTri]);
          if (kq.hanhDong === "dong" || kq.hanhDong === "dong_gui") {
            datMo(false);
            datQ("");
            return;
          }
          datViTri(kq.viTri);
        }}
        className={cn(inputClass, "pr-9")}
      />
      <span
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-3"
        aria-hidden="true"
      >
        ▾
      </span>
      {mo ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-line-strong bg-surface py-1 shadow-lg"
        >
          {dong.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-ink-3">
              Không có đơn vị khớp. Liên hệ quản trị viên để bổ sung.
            </p>
          ) : (
            dong.map((d, i) => (
              // biome-ignore lint/a11y/useFocusableInteractive: mẫu combobox: tiêu điểm ở ô gõ, dòng đang chọn báo qua aria-activedescendant
              // biome-ignore lint/a11y/useKeyWithClickEvents: phím ↑/↓/Enter xử lý ở ô gõ
              <div
                key={d === BO_CHON ? BO_CHON : d.id}
                id={dongId(i)}
                role="option"
                aria-selected={d === BO_CHON ? chon === "" : d.id === chon}
                // Giữ focus ở ô gõ: chọn bằng chuột không làm ô mất focus trước khi nhận.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => nhan(d)}
                onMouseEnter={() => datViTri(i)}
                className={cn(
                  "flex min-h-11 cursor-pointer flex-col justify-center px-3 py-1.5 text-sm",
                  i === viTri && "bg-surface-2",
                )}
              >
                {d === BO_CHON ? (
                  <span className="text-ink-2">Bỏ chọn</span>
                ) : (
                  <>
                    <span className={cn("font-medium text-ink", d.id === chon && "text-primary")}>
                      {d.ten}
                    </span>
                    <span className="text-xs text-ink-3">
                      {NHAN_LOAI[d.loai]}
                      {d.duong ? ` · ${d.duong}` : ""}
                    </span>
                  </>
                )}
              </div>
            ))
          )}
          {conLai > 0 ? (
            <p className="px-3 py-2 text-xs text-ink-3">Còn {conLai} đơn vị nữa. Gõ tên để tìm.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
