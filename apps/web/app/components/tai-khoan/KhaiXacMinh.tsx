import { cn } from "../../lib/cn";
import type { DonViChon, ThongTinXacMinh } from "../../lib/types";
import { inputClass, Label } from "../ui/Field";
import { Icon } from "../ui/Icon";
import { OCoIcon } from "../ui/OCoIcon";

/**
 * Các ô khai báo để được xác minh cán bộ (migration 0064): mã cán bộ (nếu có), cơ quan hoặc tổ chức Đảng, chức danh
 * và chức vụ, và (khi `coSoDienThoai`) số điện thoại. Dùng ở trang đăng ký và trang Tài khoản; tên
 * ô khớp với API (`so_hieu`, `don_vi_id`, `cap_bac_chuc_vu`, `so_dien_thoai`).
 */
export function KhaiXacMinh({
  donVi,
  macDinh,
  coSoDienThoai = false,
}: {
  donVi: DonViChon[];
  macDinh?: ThongTinXacMinh | null;
  coSoDienThoai?: boolean;
}) {
  const capGoc = Math.min(...donVi.map((d) => d.cap), 1);
  return (
    <>
      <Label htmlFor="so-hieu" className="mt-5">
        Mã cán bộ (không bắt buộc)
      </Label>
      <OCoIcon
        id="so-hieu"
        name="so_hieu"
        icon="shield"
        maxLength={30}
        autoCapitalize="characters"
        spellCheck={false}
        defaultValue={macDinh?.so_hieu ?? undefined}
        placeholder="Mã do đơn vị cấp, để trống nếu không có"
      />

      <Label htmlFor="don-vi" className="mt-5">
        Cơ quan, đơn vị hoặc tổ chức Đảng
      </Label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-2">
          <Icon name="home" kieu="net" className="size-5" />
        </span>
        <select
          id="don-vi"
          name="don_vi_id"
          required
          defaultValue={macDinh?.don_vi?.id ?? ""}
          className={cn(inputClass, "pl-10 text-base")}
          aria-describedby="don-vi-goi-y"
        >
          <option value="" disabled>
            {donVi.length ? "Chọn nơi công tác hoặc sinh hoạt Đảng" : "Chưa tải được danh sách đơn vị"}
          </option>
          {donVi.map((d) => (
            <option key={d.id} value={d.id}>
              {"· ".repeat(d.cap - capGoc)}
              {d.ten}
            </option>
          ))}
        </select>
      </div>
      <p id="don-vi-goi-y" className="mt-1.5 text-xs text-ink-3">
        Chọn nơi công tác hoặc sinh hoạt Đảng để người quản lý duyệt tài khoản. Nếu chưa có trong danh sách,
        liên hệ quản trị viên để bổ sung.
      </p>

      <Label htmlFor="cap-bac" className="mt-5">
        Chức vụ, chức danh (không bắt buộc)
      </Label>
      <OCoIcon
        id="cap-bac"
        name="cap_bac_chuc_vu"
        icon="star"
        maxLength={200}
        defaultValue={macDinh?.cap_bac_chuc_vu ?? undefined}
        placeholder="Ví dụ: Chuyên viên, Giáo viên, Bí thư chi bộ"
      />

      {coSoDienThoai ? (
        <>
          <Label htmlFor="so-dien-thoai" className="mt-5">
            Số điện thoại
          </Label>
          <OCoIcon
            id="so-dien-thoai"
            name="so_dien_thoai"
            type="tel"
            icon="phone"
            required
            inputMode="tel"
            maxLength={20}
            autoComplete="tel"
            defaultValue={macDinh?.so_dien_thoai ?? undefined}
            placeholder="Để người duyệt liên hệ khi cần"
          />
        </>
      ) : null}
    </>
  );
}
