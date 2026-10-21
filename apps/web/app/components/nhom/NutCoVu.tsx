import { useFetcher } from "react-router";

import { cn } from "../../lib/cn";
import { type KetQuaThaoTacNhom, loiCua, type ThanhVienNhom } from "../../lib/nhom";
import { Icon } from "../ui/Icon";

/**
 * Nút "Cổ vũ" một thành viên (docs/PLAN.md GĐ16b, câu N7). Bấm là đổi ngay trên màn hình trong lúc
 * gửi; máy chủ báo lỗi thì trở lại trạng thái cũ và hiện lỗi. Bấm lại trong ngày thì bỏ lượt.
 */
export function NutCoVu({ thanhVien }: { thanhVien: ThanhVienNhom }) {
  const f = useFetcher<KetQuaThaoTacNhom>();
  const dangGui = f.state !== "idle";
  // Đang gửi: hiện trạng thái sau khi bấm. Xong: trang tải lại dữ liệu nên đọc lại từ props.
  const daCoVu = dangGui ? !thanhVien.da_co_vu : thanhVien.da_co_vu;
  const tong = dangGui ? thanhVien.luot_co_vu + (daCoVu ? 1 : -1) : thanhVien.luot_co_vu;
  const loi = !dangGui ? loiCua(f.data) : null;

  return (
    <div className="shrink-0 text-right">
      <f.Form method="post">
        <input type="hidden" name="intent" value="co-vu" />
        <input type="hidden" name="account_id" value={thanhVien.id} />
        <button
          type="submit"
          disabled={dangGui}
          aria-pressed={daCoVu}
          aria-label={`Cổ vũ ${thanhVien.ho_ten}, đã nhận ${tong} lượt`}
          className={cn(
            "lun inline-flex min-h-12 items-center gap-2 rounded-btn border px-3 text-sm font-semibold",
            daCoVu
              ? "border-primary bg-primary-soft text-primary"
              : "border-line-strong bg-surface text-ink hover:bg-surface-2",
          )}
        >
          <Icon name="coVu" className="size-5" />
          Cổ vũ
          <span className="tabular-nums">{tong}</span>
        </button>
      </f.Form>
      {loi ? (
        <p role="alert" className="mt-1 max-w-48 text-xs text-danger">
          {loi}
        </p>
      ) : null}
    </div>
  );
}
