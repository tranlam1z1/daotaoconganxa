/**
 * Ô 2 của biên bản (trò "Lập biên bản", docs/PLAN.md GĐ-G3): chọn Điều → khoản → điểm từ ba danh
 * sách thả xuống, dựng từ URN của các dòng mức phạt. Giá trị là URN của nút sâu nhất đã chọn.
 *
 * Căn cứ trong dữ liệu hiện mới ghi tới Điều; Điều nào chưa có khoản thì không hiện ô khoản, điểm.
 */
import { useId } from "react";

import { cn } from "../../lib/cn";
import type { NutDieuKhoan } from "../../lib/lap-bien-ban";
import { inputClass } from "../ui/Field";

/** Nút trong `ds` mà `urn` bằng hoặc nằm dưới nó. */
function nutChua(ds: NutDieuKhoan[], urn: string | null): NutDieuKhoan | null {
  if (!urn) return null;
  return ds.find((n) => urn === n.id || urn.startsWith(`${n.id}.`)) ?? null;
}

export function ChonDieuKhoan({
  cay,
  chon,
  datChon,
  khoa,
  nhan,
}: {
  cay: NutDieuKhoan[];
  chon: string | null;
  datChon: (urn: string | null) => void;
  khoa: boolean;
  nhan: string;
}) {
  const id = useId();
  const dieu = nutChua(cay, chon);
  const khoan = dieu ? nutChua(dieu.con, chon) : null;
  const diem = khoan ? nutChua(khoan.con, chon) : null;
  const lop = cn(inputClass, "min-h-12 text-base");

  return (
    <fieldset className="grid gap-2">
      <legend className="sr-only">{nhan}</legend>
      <div>
        <label htmlFor={`${id}-dieu`} className="sr-only">
          Điều
        </label>
        <select
          id={`${id}-dieu`}
          className={lop}
          value={dieu?.id ?? ""}
          disabled={khoa}
          onChange={(e) => datChon(e.target.value || null)}
        >
          <option value="">Chọn Điều</option>
          {cay.map((n) => (
            <option key={n.id} value={n.id}>
              {n.nhan}
            </option>
          ))}
        </select>
      </div>
      {dieu?.con.length ? (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={`${id}-khoan`} className="sr-only">
              Khoản
            </label>
            <select
              id={`${id}-khoan`}
              className={lop}
              value={khoan?.id ?? ""}
              disabled={khoa}
              onChange={(e) => datChon(e.target.value || dieu.id)}
            >
              <option value="">Khoản</option>
              {dieu.con.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nhan}
                </option>
              ))}
            </select>
          </div>
          {khoan?.con.length ? (
            <div>
              <label htmlFor={`${id}-diem`} className="sr-only">
                Điểm
              </label>
              <select
                id={`${id}-diem`}
                className={lop}
                value={diem?.id ?? ""}
                disabled={khoa}
                onChange={(e) => datChon(e.target.value || khoan.id)}
              >
                <option value="">Điểm</option>
                {khoan.con.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.nhan}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      ) : dieu ? (
        <p className="text-sm text-ink-3">Căn cứ của Điều này trong dữ liệu mới ghi tới mức Điều.</p>
      ) : null}
    </fieldset>
  );
}
