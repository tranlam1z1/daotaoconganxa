import type { ThanhVienNhom } from "../../lib/nhom";
import { Badge } from "../ui/Badge";
import { NutCoVu } from "./NutCoVu";
import { ThanhPhanTram } from "./ThanhPhanTram";

/**
 * Thành viên đang ở trong nhóm: họ tên, phần trăm chung, nút "Cổ vũ" kèm số lượt đã nhận. Chạm vào
 * họ tên thì mở hộp tiến độ của người đó. Không có điểm hay kết quả làm bài (quy tắc 2 mục 1.4).
 */
export function DanhSachThanhVien({
  thanhVien,
  choGhi,
  onXemTienDo,
}: {
  thanhVien: ThanhVienNhom[];
  choGhi: boolean;
  onXemTienDo: (t: ThanhVienNhom) => void;
}) {
  return (
    <ul className="grid gap-3">
      {thanhVien.map((t) => (
        <li key={t.id} className="rounded-card border border-line bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onXemTienDo(t)}
                aria-haspopup="dialog"
                className="flex min-h-12 w-full items-center text-left text-base font-semibold text-primary hover:underline"
              >
                <span className="min-w-0 break-words">
                  {t.ho_ten}
                  {t.la_toi ? <span className="font-normal text-ink-2"> (bạn)</span> : null}
                </span>
              </button>
              {t.vai_tro === "truong_nhom" ? <Badge tone="info">Trưởng nhóm</Badge> : null}
            </div>
            {!t.la_toi && choGhi ? (
              <NutCoVu thanhVien={t} />
            ) : (
              <p className="shrink-0 pt-3 text-sm text-ink-2">{t.luot_co_vu} lượt cổ vũ</p>
            )}
          </div>
          <div className="mt-2">
            <ThanhPhanTram giaTri={t.phan_tram} nhan={`Tiến độ chung của ${t.ho_ten}`} />
          </div>
        </li>
      ))}
    </ul>
  );
}
