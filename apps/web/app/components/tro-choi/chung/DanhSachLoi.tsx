/**
 * Danh sách lỗi trong màn kết quả (mô-đun M3, docs/GAME_DESIGN.md §1.6): mỗi lỗi một dòng gồm lỗi gì,
 * cụ thể thế nào, người chơi đã chỉ ra chưa, vì sao là lỗi, và căn cứ. Căn cứ hiện bằng tên điều
 * khoản đọc được (không hiện URN); mở nguyên văn qua nút "Xem điều khoản" của phản hồi bước.
 * Nghĩa không chỉ nằm ở màu: luôn có chữ "Đã chỉ ra" / "Chưa chỉ ra".
 */
import { nhanVienDan } from "../../../lib/citation";
import { cn } from "../../../lib/cn";

export interface MucLoi {
  ten: string;
  moTa: string;
  /** null: không chấm phần chỉ ra (ví dụ người chơi đã cho qua). */
  daChiRa: boolean | null;
  giaiThich: string;
  canCu: string[];
}

export function DanhSachLoi({
  loi,
  nham = [],
  tieuDe = "Lỗi của người lái này",
}: {
  loi: readonly MucLoi[];
  /** Chi tiết người chơi đánh dấu nhầm. */
  nham?: readonly string[];
  tieuDe?: string;
}) {
  if (!loi.length && !nham.length) return null;
  return (
    <section className="g-the rounded-2xl p-4" aria-label={tieuDe}>
      {loi.length ? (
        <>
          <h3 className="text-base font-semibold">{tieuDe}</h3>
          <ul className="mt-2 grid gap-3">
            {loi.map((l) => (
              <li key={l.ten} className="border-l-4 pl-3" style={{ borderColor: "var(--danger)" }}>
                <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-[15px] font-semibold">{l.ten}</span>
                  {l.daChiRa !== null ? (
                    <span className={cn("text-sm font-semibold", l.daChiRa ? "text-ok" : "text-danger")}>
                      {l.daChiRa ? "✓ Đã chỉ ra" : "✗ Chưa chỉ ra"}
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-[15px] leading-relaxed">{l.moTa}</p>
                {l.giaiThich ? (
                  <p className="mt-1 text-sm leading-relaxed text-ink-2">{l.giaiThich}</p>
                ) : null}
                {l.canCu.length ? (
                  <p className="mt-1 text-sm text-ink-2">Căn cứ: {l.canCu.map(nhanVienDan).join("; ")}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {nham.length ? (
        <div className={cn(loi.length > 0 && "mt-4")}>
          <h3 className="text-base font-semibold">Chi tiết đánh dấu nhầm</h3>
          <p className="mt-0.5 text-sm text-ink-2">
            Các chi tiết này không sai; mỗi chi tiết đánh dấu nhầm bị trừ điểm.
          </p>
          <ul className="mt-1 list-disc pl-5 text-[15px]">
            {nham.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
