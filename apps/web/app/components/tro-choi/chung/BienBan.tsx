/**
 * "Biên bản" cuối lượt (mô-đun M4, docs/GAME_DESIGN.md §4): hành vi, chi tiết, căn cứ và mức phạt lấy
 * từ bảng mức phạt đã duyệt. Là phần mô phỏng trong trò chơi, không theo mẫu biên bản thật và ghi rõ
 * điều đó. Lỗi chưa có mức phạt đã duyệt thì ghi "Chưa có mức phạt đã duyệt".
 */
import { nhanVienDan } from "../../../lib/citation";
import { type DongBienBan, moTaMucPhatBienBan } from "../../../lib/kiem-tra-giay-to";

export function BienBan({
  dong,
  tieuDe = "Biên bản (mô phỏng)",
}: {
  dong: readonly DongBienBan[];
  tieuDe?: string;
}) {
  if (!dong.length) return null;
  return (
    <section
      aria-label={tieuDe}
      className="rounded-2xl border-2 border-dashed p-4"
      style={{ borderColor: "var(--line-strong)", background: "var(--surface)" }}
    >
      <h3 className="g-tieu-de text-base font-semibold uppercase tracking-wide">{tieuDe}</h3>
      <p className="text-xs text-ink-2">Phần mô phỏng trong trò chơi, không phải biểu mẫu biên bản thật.</p>
      <ol className="mt-3 grid gap-3">
        {dong.map((d, i) => (
          <li key={d.hanh_vi} className="text-[15px] leading-relaxed">
            <p className="font-semibold">
              {i + 1}. {d.hanh_vi}
            </p>
            <p>{d.chi_tiet}</p>
            <p className={d.muc_phat ? "" : "text-ink-2"}>Mức phạt: {moTaMucPhatBienBan(d.muc_phat)}</p>
            {d.can_cu.length ? (
              <p className="text-sm text-ink-2">Căn cứ: {d.can_cu.map(nhanVienDan).join("; ")}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
