/**
 * Ba câu nhỏ của một xe (trò "Súng bắn tốc độ", docs/PLAN.md GĐ-G2), hiện lần lượt:
 *   1. Có bị xử phạt vì chạy quá tốc độ không?
 *   2. Khung tốc độ vượt nào? (chỉ khi chọn "Có")
 *   3. Hình thức bổ sung, trừ điểm? (khi đã chọn khung)
 * Sau khi chấm, mỗi câu tô đúng/sai theo `chiTiet` máy chủ trả về; vùng bấm cao từ 48px.
 */
import { cn } from "../../lib/cn";
import type { DeSungBanWeb } from "./XeQuaChot";

export interface TraLoiSungBanWeb {
  vi_pham: boolean | null;
  khung: string | null;
  bo_sung: string | null;
}

interface ChiTietSungBan {
  cham: { vi_pham: boolean; khung: boolean; bo_sung: boolean };
  dap_an: { vi_pham: boolean; khung: string | null; bo_sung: string | null };
}

function NutChon({
  chon,
  dung,
  sai,
  khoa,
  onClick,
  children,
}: {
  chon: boolean;
  dung?: boolean;
  sai?: boolean;
  khoa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={chon}
      disabled={khoa}
      onClick={onClick}
      className={cn(
        "lun [--lun:0.985] flex min-h-12 w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border px-4 py-2 text-left text-base",
        chon ? "border-primary bg-primary-soft font-semibold" : "border-line-strong bg-surface",
        dung && "border-ok bg-ok-soft",
        sai && "border-danger bg-danger-soft",
      )}
    >
      <span className="min-w-0">{children}</span>
      {dung ? <span className="shrink-0 text-sm font-semibold text-ok">Đáp án đúng</span> : null}
    </button>
  );
}

export function ChonKhungPhat({
  de,
  traLoi,
  datTraLoi,
  chiTiet,
  daCham,
}: {
  de: DeSungBanWeb;
  traLoi: TraLoiSungBanWeb;
  datTraLoi: (t: TraLoiSungBanWeb) => void;
  chiTiet?: unknown;
  daCham: boolean;
}) {
  const ct = daCham ? (chiTiet as ChiTietSungBan | null | undefined) : null;
  const da = ct?.dap_an;
  const hienCau2 = traLoi.vi_pham === true || (da?.vi_pham ?? false);
  const hienCau3 = (traLoi.vi_pham === true && traLoi.khung !== null) || (da?.vi_pham ?? false);

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="text-[17px] font-medium">1. Có bị xử phạt vì chạy quá tốc độ không?</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[
            { v: true, text: "Có" },
            { v: false, text: "Không" },
          ].map((o) => (
            <NutChon
              key={o.text}
              chon={traLoi.vi_pham === o.v}
              khoa={daCham}
              dung={da ? da.vi_pham === o.v : false}
              sai={da ? traLoi.vi_pham === o.v && da.vi_pham !== o.v : false}
              onClick={() => datTraLoi({ vi_pham: o.v, khung: null, bo_sung: null })}
            >
              {o.text}
            </NutChon>
          ))}
        </div>
      </fieldset>

      {hienCau2 ? (
        <fieldset>
          <legend className="text-[17px] font-medium">2. Tốc độ vượt thuộc khung nào?</legend>
          <div className="mt-2 grid gap-2">
            {de.lua_chon_khung.map((k) => (
              <NutChon
                key={k.id}
                chon={traLoi.khung === k.id}
                khoa={daCham || traLoi.vi_pham !== true}
                dung={da ? da.khung === k.id : false}
                sai={da ? traLoi.khung === k.id && da.khung !== k.id : false}
                onClick={() => datTraLoi({ ...traLoi, khung: k.id })}
              >
                {k.text}
              </NutChon>
            ))}
          </div>
        </fieldset>
      ) : null}

      {hienCau3 ? (
        <fieldset>
          <legend className="text-[17px] font-medium">
            3. Hình thức xử phạt bổ sung, trừ điểm giấy phép lái xe?
          </legend>
          <div className="mt-2 grid gap-2">
            {de.lua_chon_bo_sung.map((b) => (
              <NutChon
                key={b.id}
                chon={traLoi.bo_sung === b.id}
                khoa={daCham || traLoi.vi_pham !== true}
                dung={da ? da.bo_sung === b.id : false}
                sai={da ? traLoi.bo_sung === b.id && da.bo_sung !== b.id : false}
                onClick={() => datTraLoi({ ...traLoi, bo_sung: b.id })}
              >
                {b.text}
              </NutChon>
            ))}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}

/** Đủ để gửi: chọn "Không", hoặc chọn "Có" kèm khung và hình thức bổ sung. */
export function daChonSungBan(t: TraLoiSungBanWeb): boolean {
  return t.vi_pham === false || (t.vi_pham === true && t.khung !== null && t.bo_sung !== null);
}
