/**
 * Đóng dấu (mô-đun M2, phần chạm và đóng dấu; docs/GAME_DESIGN.md §4). Hai nút lớn ở đáy màn hình,
 * bấm được bằng ngón cái; dấu mộc "đập xuống" xấp giấy tờ khi chọn.
 *
 * Hiệu ứng riêng (VISUAL_STYLE §3.4, đã được yêu cầu cho trò Kiểm tra giấy tờ): dấu phóng từ to xuống,
 * nảy nhẹ, bàn giật nhẹ một nhịp. Chỉ động transform và opacity. Giảm chuyển động: dấu hiện tĩnh.
 *
 * Mở rộng ở GĐ-T12: trò truyền danh sách dấu (`luaChon`: mã, nhãn, màu, khóa riêng) và dòng nhắc; không
 * truyền thì giữ nguyên hai dấu "Cho qua / Giữ lại" của trò Kiểm tra giấy tờ.
 */
import "../giay-to.css";

import { cn } from "../../../../lib/cn";

export type LuaChonDau = "cho_qua" | "giu_lai";

export const NHAN_DAU: Record<LuaChonDau, string> = { cho_qua: "Cho qua", giu_lai: "Giữ lại" };

/** Màu của một dấu theo token hướng A. */
export type MauDau = "ok" | "warn" | "danger";

/** Một dấu do trò truyền vào (GĐ-T12). */
export interface DauTuyChon<T extends string = string> {
  ma: T;
  nhan: string;
  mau: MauDau;
  /** Khóa riêng dấu này (ví dụ chưa chỉ ra căn cứ). */
  khoa?: boolean;
}

/**
 * Dấu mộc đã đóng. `hoatAnh = false` khi xem lại (tĩnh). Trò 1 truyền `chon` là "cho_qua"/"giu_lai";
 * trò khác truyền thêm `nhan` và `mau`.
 */
export function DauMoc({
  chon,
  hoatAnh = true,
  nhan,
  mau,
}: {
  chon: string;
  hoatAnh?: boolean;
  nhan?: string;
  mau?: MauDau;
}) {
  const chu = nhan ?? NHAN_DAU[chon as LuaChonDau] ?? chon;
  return (
    <span
      data-quyet-dinh={chon}
      className={cn("gt-dau", hoatAnh && "g-a gt-dap")}
      style={mau ? { color: `var(--${mau})` } : undefined}
      role="img"
      aria-label={`Đã đóng dấu ${chu}`}
    >
      {chu}
    </span>
  );
}

/**
 * Hai nút đóng dấu. "Giữ lại" chỉ bấm được khi đã đánh dấu ít nhất một chi tiết (`choGiuLai`);
 * dòng nhắc dưới nút nói rõ vì sao.
 */
export function NutDongDau<T extends string = LuaChonDau>({
  onChon,
  choGiuLai = false,
  khoa,
  luaChon,
  nhac,
}: {
  onChon: (c: T) => void;
  /** Chỉ dùng khi không truyền `luaChon` (hai dấu của trò 1). */
  choGiuLai?: boolean;
  khoa: boolean;
  luaChon?: readonly DauTuyChon<T>[];
  /** Dòng nhắc dưới các nút khi trò truyền `luaChon`. */
  nhac?: string;
}) {
  if (luaChon) {
    return (
      <div>
        <div className={cn("grid gap-2", luaChon.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
          {luaChon.map((d) => (
            <button
              key={d.ma}
              type="button"
              disabled={khoa || d.khoa}
              aria-describedby={nhac ? "nhac-dong-dau" : undefined}
              onClick={() => onChon(d.ma)}
              className="g-nut min-h-14 rounded-2xl border-2 px-1 text-base font-bold leading-tight disabled:opacity-50"
              style={{
                borderColor: `var(--${d.mau})`,
                color: `var(--${d.mau})`,
                background: `var(--${d.mau}-soft)`,
              }}
            >
              {d.nhan}
            </button>
          ))}
        </div>
        {nhac ? (
          <p id="nhac-dong-dau" className="mt-2 text-center text-sm text-ink-2">
            {nhac}
          </p>
        ) : null}
      </div>
    );
  }
  const chon = onChon as unknown as (c: LuaChonDau) => void;
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={khoa}
          onClick={() => chon("cho_qua")}
          className="g-nut min-h-14 rounded-2xl border-2 text-lg font-bold"
          style={{ borderColor: "var(--ok)", color: "var(--ok)", background: "var(--ok-soft)" }}
        >
          Cho qua
        </button>
        <button
          type="button"
          disabled={khoa || !choGiuLai}
          aria-describedby="nhac-giu-lai"
          onClick={() => chon("giu_lai")}
          className="g-nut min-h-14 rounded-2xl border-2 text-lg font-bold disabled:opacity-50"
          style={{ borderColor: "var(--danger)", color: "var(--danger)", background: "var(--danger-soft)" }}
        >
          Giữ lại
        </button>
      </div>
      <p id="nhac-giu-lai" className="mt-2 text-center text-sm text-ink-2">
        {choGiuLai
          ? "Giữ lại: các chi tiết đã đánh dấu là lý do."
          : "Muốn giữ lại, hãy chạm vào chi tiết sai trên giấy tờ để đánh dấu trước."}
      </p>
    </div>
  );
}
