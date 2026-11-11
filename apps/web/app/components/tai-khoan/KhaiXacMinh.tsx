import type { DonViChon, ThongTinXacMinh } from "../../lib/types";
import { ChonDonVi } from "../ui/ChonDonVi";
import { Label } from "../ui/Field";
import { OCoIcon } from "../ui/OCoIcon";

/**
 * Các ô khai báo để được xác minh cán bộ (migration 0064, 0087): mã cán bộ (nếu có), nơi công tác,
 * nơi sinh hoạt Đảng (không bắt buộc), chức danh và chức vụ, và (khi `coSoDienThoai`) số điện thoại.
 * Dùng ở trang đăng ký và trang Tài khoản; tên ô khớp với API (`so_hieu`, `don_vi_id`,
 * `don_vi_dang_id`, `cap_bac_chuc_vu`, `so_dien_thoai`).
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
        Nơi công tác
      </Label>
      <ChonDonVi
        id="don-vi"
        name="don_vi_id"
        items={donVi}
        required
        defaultValue={macDinh?.don_vi?.id}
        moTaId="don-vi-goi-y"
        placeholder={donVi.length ? "Gõ tên cơ quan, đơn vị để tìm" : "Chưa tải được danh sách đơn vị"}
      />
      <p id="don-vi-goi-y" className="mt-1.5 text-xs text-ink-3">
        Người quản lý nơi công tác sẽ duyệt tài khoản. Nếu chưa có trong danh sách, liên hệ quản trị viên để
        bổ sung.
      </p>

      <Label htmlFor="don-vi-dang" className="mt-5">
        Nơi sinh hoạt Đảng (nếu là đảng viên)
      </Label>
      <ChonDonVi
        id="don-vi-dang"
        name="don_vi_dang_id"
        items={donVi}
        chiLoai="to_chuc_dang"
        defaultValue={macDinh?.don_vi_dang?.id}
        tenMacDinh={macDinh?.don_vi_dang?.ten}
        placeholder="Gõ tên chi bộ, đảng bộ để tìm; bỏ trống nếu không có"
      />

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
