/**
 * Câu khởi động của "Cung đường biển báo" (docs/PLAN.md GĐ-G8): trò "Đoán biển báo" (GĐ12) thu
 * gọn thành 3 câu đầu lượt. Nhìn biển, chọn đúng tên trong 4 phương án cùng nhóm.
 */
import { cn } from "../../lib/cn";
import type { DeCungDuong } from "../../lib/cung-duong";
import { urlAnhBien } from "./DuongChay";

export type DeKhoiDong = Extract<DeCungDuong, { loai: "doan" }>;
export interface ChiTietKhoiDong {
  loai: "doan";
  dung: boolean;
  dap_an: string;
  ten: string;
}

export function CauKhoiDongBienBao({
  de,
  chon,
  datChon,
  chiTiet,
  daCham,
  idGoc,
}: {
  de: DeKhoiDong;
  chon: string | null;
  datChon: (id: string) => void;
  chiTiet?: ChiTietKhoiDong | null;
  daCham: boolean;
  idGoc: string;
}) {
  return (
    <div className="space-y-4">
      <div className="g-the grid place-items-center p-4">
        <img
          src={urlAnhBien(de.anh)}
          alt="Biển báo cần đoán tên"
          width={144}
          height={144}
          className="size-36"
        />
      </div>
      <fieldset id={`${idGoc}-hoi`} className="grid gap-2">
        <legend className="mb-2 text-[15px] text-ink-2">Khởi động: đây là biển gì?</legend>
        {de.phuong_an.map((p) => {
          const laDapAn = daCham && chiTiet?.dap_an === p.id;
          const chonSai = daCham && chon === p.id && !laDapAn;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={chon === p.id}
              disabled={daCham}
              onClick={() => datChon(p.id)}
              className={cn(
                "lun [--lun:0.985] flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border bg-surface px-4 py-2 text-left text-base",
                laDapAn ? "border-ok" : chonSai ? "border-danger" : "border-line",
              )}
            >
              <span>{p.text}</span>
              {laDapAn ? <span className="text-sm font-semibold text-ok">Đáp án đúng</span> : null}
              {chonSai ? <span className="text-sm font-semibold text-danger">Bạn chọn</span> : null}
            </button>
          );
        })}
      </fieldset>
    </div>
  );
}
