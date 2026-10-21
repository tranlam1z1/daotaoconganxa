/**
 * Phần "Xem chi tiết" của kết quả một câu (docs/PLAN.md GĐ17a, docs/PROMPT_HOP_KET_QUA_TRO_CHOI.md mục
 * 2.3, 2.6): giải thích, căn cứ pháp lý, rồi chi tiết riêng của trò (GĐ17c). Mặc định thu gọn; phần
 * thu gọn có `hidden` nên không nằm trong cây trợ năng. Mở ra thì không tự chuyển tiêu điểm.
 *
 * Căn cứ (H8): có mạng thì mỗi căn cứ là một nút mở rộng nguyên văn ngay tại chỗ (không mở ngăn kéo,
 * vì hộp kết quả không được lồng hộp khác); không có mạng thì chỉ nêu tên điều khoản.
 *
 * `cuonTrong`: phần chi tiết cuộn trong khung riêng có chiều cao tối đa, để nút chính của hộp luôn ở
 * trong khung nhìn (đề xuất Đ2). Khung cuộn nhận được tiêu điểm để cuộn bằng bàn phím.
 */
import { type ReactNode, useEffect, useId, useState } from "react";
import { useFetcher } from "react-router";

import { nhanVienDan } from "../../../lib/citation";
import { cn } from "../../../lib/cn";
import { coChiTiet, type KetQuaHienThi } from "../../../lib/ket-qua-cau";
import type { loader as canCuLoader } from "../../../routes/luyen-tap.can-cu";
import { NoiDungCanCu } from "../../luyen-tap/PhanHoiCauTraLoi";
import { Icon } from "../../ui/Icon";

export function ChiTietKetQua({
  ketQua,
  coMang = true,
  chiTietRieng,
  cuonTrong = false,
}: {
  ketQua: Pick<KetQuaHienThi, "giai_thich" | "can_cu">;
  coMang?: boolean;
  /** Chi tiết riêng của trò (danh sách lỗi, biên bản…), GĐ17c. */
  chiTietRieng?: ReactNode;
  cuonTrong?: boolean;
}) {
  const [mo, datMo] = useState(false);
  const id = useId();
  if (!coChiTiet(ketQua, Boolean(chiTietRieng))) return null;
  const giaiThich = ketQua.giai_thich?.trim();

  return (
    <div>
      <button
        type="button"
        aria-expanded={mo}
        aria-controls={id}
        onClick={() => datMo((x) => !x)}
        className="lun inline-flex min-h-12 w-full items-center justify-between gap-2 rounded-btn border border-line-strong bg-surface px-4 text-base font-semibold text-ink hover:bg-surface-2"
      >
        {mo ? "Ẩn chi tiết" : "Xem chi tiết"}
        <MuiTen mo={mo} className="size-5 text-ink-2" />
      </button>
      <div
        id={id}
        hidden={!mo}
        {...(cuonTrong ? { role: "region", "aria-label": "Chi tiết kết quả", tabIndex: 0 } : {})}
        className={cn("mt-3 space-y-4", cuonTrong && "max-h-[35dvh] overflow-y-auto overscroll-contain pr-1")}
      >
        {giaiThich ? <p className="text-base leading-relaxed text-ink">{giaiThich}</p> : null}
        {ketQua.can_cu.length ? (
          coMang ? (
            <div>
              <h3 className="font-sans text-base font-semibold">Căn cứ pháp lý</h3>
              <ul className="mt-2 grid gap-2">
                {ketQua.can_cu.map((urn) => (
                  <li key={urn}>
                    <CanCuMoRong urn={urn} />
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-base text-ink-2">
              Căn cứ: {ketQua.can_cu.map((u) => nhanVienDan(u)).join("; ")}
            </p>
          )
        ) : null}
        {chiTietRieng}
      </div>
    </div>
  );
}

/** Một căn cứ: nút mở rộng, bấm lần đầu mới tải nguyên văn. Ghép cặp dùng cho căn cứ từng cặp (GĐ17b). */
export function CanCuMoRong({ urn }: { urn: string }) {
  const [mo, datMo] = useState(false);
  const id = useId();
  const fetcher = useFetcher<typeof canCuLoader>();

  // biome-ignore lint/correctness/useExhaustiveDependencies: chỉ tải một lần, khi mở lần đầu
  useEffect(() => {
    if (mo && fetcher.state === "idle" && !fetcher.data)
      fetcher.load(`/luyen-tap/can-cu?urn=${encodeURIComponent(urn)}`);
  }, [mo, urn]);

  const d = fetcher.data;
  return (
    <div className="rounded-md border border-line bg-surface">
      <button
        type="button"
        aria-expanded={mo}
        aria-controls={id}
        onClick={() => datMo((x) => !x)}
        className="lun [--lun:0.985] flex min-h-12 w-full items-center gap-2 px-3 text-left text-base text-primary"
      >
        <Icon name="book" className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">{nhanVienDan(urn)}</span>
        <MuiTen mo={mo} className="size-4" />
      </button>
      <div id={id} hidden={!mo} className="border-t border-line px-3 pb-4 text-base">
        {mo ? <NoiDungCanCu d={d} dangTai={!d || fetcher.state === "loading"} /> : null}
      </div>
    </div>
  );
}

/** Mũi tên xuống (thu gọn) hoặc lên (đang mở). */
function MuiTen({ mo, className }: { mo: boolean; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", mo && "rotate-180", className)}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
