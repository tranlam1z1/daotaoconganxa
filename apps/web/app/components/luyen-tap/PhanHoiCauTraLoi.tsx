/**
 * Phản hồi sau khi kiểm tra một câu luyện tập: đúng hay chưa đúng, một câu giải thích và nút
 * mở căn cứ. Căn cứ mở trong ngăn kéo ngay trên trang (tái dùng NoiDungDieu của phần tra cứu),
 * để người học đọc điều khoản gốc mà không rời phiên đang làm.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";

import { nhanVienDan } from "../../lib/citation";
import { cn } from "../../lib/cn";
import type { KetQuaCauHoi } from "../../lib/ngan-hang";
import type { loader as canCuLoader } from "../../routes/luyen-tap.can-cu";
import { NoiDungDieu } from "../tra-cuu/NoiDungDieu";
import { Icon } from "../ui/Icon";
import { KhungCho } from "../ui/KhungCho";

export function PhanHoiCauTraLoi({ ketQua }: { ketQua: KetQuaCauHoi }) {
  const [urnMo, datUrnMo] = useState<string | null>(null);
  const dong = useCallback(() => datUrnMo(null), []);
  return (
    <div
      role="status"
      className={cn(
        "rounded-lg border-l-4 px-4 py-3",
        ketQua.dung ? "border-ok bg-ok-soft" : "border-danger bg-danger-soft",
      )}
    >
      <p
        className={cn(
          "flex items-center gap-2 text-lg font-semibold",
          ketQua.dung ? "text-ok" : "text-danger",
        )}
      >
        <Icon name={ketQua.dung ? "check" : "x"} kieu="net" className="size-5 shrink-0" />
        {ketQua.dung ? "Đúng." : "Chưa đúng."}
      </p>
      {ketQua.giai_thich ? (
        <p className="mt-1 text-base leading-relaxed text-ink">{ketQua.giai_thich}</p>
      ) : null}
      {ketQua.can_cu.length ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {ketQua.can_cu.map((urn) => (
            <li key={urn}>
              <button
                type="button"
                onClick={() => datUrnMo(urn)}
                aria-haspopup="dialog"
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line bg-surface px-3 text-left text-sm text-primary dong-bam"
              >
                <Icon name="book" className="size-4 shrink-0" />
                {nhanVienDan(urn)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {urnMo ? <NganKeoCanCu urn={urnMo} dong={dong} /> : null}
    </div>
  );
}

function NganKeoCanCu({ urn, dong }: { urn: string; dong: () => void }) {
  const fetcher = useFetcher<typeof canCuLoader>();
  const khung = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: chỉ tải lại khi đổi căn cứ
  useEffect(() => {
    fetcher.load(`/luyen-tap/can-cu?urn=${encodeURIComponent(urn)}`);
  }, [urn]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dong();
    };
    document.addEventListener("keydown", onKey);
    const cu = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    khung.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = cu;
    };
  }, [dong]);

  const d = fetcher.data;
  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Đóng căn cứ"
        onClick={dong}
        className="absolute inset-0 size-full bg-black/40"
      />
      <div
        ref={khung}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Căn cứ pháp lý"
        // Điện thoại: toàn màn hình; từ 768px: ngăn kéo bên phải.
        className="absolute inset-0 flex flex-col bg-surface pb-[env(safe-area-inset-bottom)] shadow-xl outline-none md:left-auto md:w-[min(94vw,36rem)] md:pb-0"
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
          <h2 className="min-w-0 font-sans text-base font-semibold">{d?.nhan ?? nhanVienDan(urn)}</h2>
          <button
            type="button"
            onClick={dong}
            aria-label="Đóng căn cứ"
            className="lun grid size-11 shrink-0 place-items-center rounded-lg text-ink-2 hover:bg-surface-2"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-6 text-base">
          <NoiDungCanCu d={d} dangTai={!d || fetcher.state === "loading"} />
        </div>
      </div>
    </div>
  );
}

type DuLieuCanCu = ReturnType<typeof useFetcher<typeof canCuLoader>>["data"];

/**
 * Nguyên văn một căn cứ đã tải từ /luyen-tap/can-cu. Dùng chung cho ngăn kéo căn cứ ở trên và phần
 * "Xem chi tiết" của hộp kết quả trò chơi (docs/PLAN.md GĐ17a, H8).
 */
export function NoiDungCanCu({ d, dangTai }: { d: DuLieuCanCu; dangTai: boolean }) {
  return (
    <>
      {dangTai ? <KhungCho nhan="Đang tải điều khoản." dong={4} cao="h-5" className="mt-4" /> : null}
      {d && "loi" in d && d.loi ? <p className="mt-4 text-ink-2">{d.loi}</p> : null}
      {d && "dieu" in d && d.dieu ? (
        <>
          {d.nguCanh.length ? <p className="mt-4 text-sm text-ink-3">{d.nguCanh.join(" · ")}</p> : null}
          <NoiDungDieu node={d.dieu} ctx={{ meta: d.meta, asOf: d.asOf, versionKind: d.versionKind }} />
        </>
      ) : null}
      {d?.href ? (
        <Link to={d.href} className="mt-6 inline-flex min-h-11 items-center text-primary underline">
          Mở trong trang đọc văn bản
        </Link>
      ) : null}
    </>
  );
}
