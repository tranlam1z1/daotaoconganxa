import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";

import { type KetQuaThaoTacNhom, loiCua, type MucNhom, xongCua } from "../../lib/nhom";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Field";
import { HopThoai } from "../ui/HopThoai";

/** Kết quả `POST /v1/nhom/:id/ai/thu-tu` (docs/PLAN.md GĐ16d). Tên mục do máy chủ thay sau hậu kiểm. */
export type GoiYThuTu =
  | { dat: true; tu_bo_nho_dem: boolean; thu_tu: Array<{ id: string; ten: string }>; ghi_chu: string }
  | { dat: false; thong_bao: string };

/** Kết quả action `goi-y-thu-tu` của trang nhóm. */
export type KetQuaGoiYThuTu = { intent: string; ok: true; goiY: GoiYThuTu } | { intent: string; loi: string };

/**
 * Hộp "Gợi ý thứ tự học" cho trưởng nhóm (docs/PLAN.md GĐ16d, AI-1). Mở hộp thì gửi yêu cầu gợi ý;
 * gợi ý chỉ để xem trước, không tự áp dụng. "Áp dụng thứ tự này" gửi thao tác sắp thứ tự có sẵn
 * (intent `thu-tu`), "Giữ thứ tự hiện tại" đóng hộp. Gợi ý bị hậu kiểm loại thì hộp chỉ hiện câu
 * cố định của máy chủ.
 */
export function HopGoiYThuTu({
  mo,
  onDong,
  muc,
}: {
  mo: boolean;
  onDong: () => void;
  muc: readonly MucNhom[];
}) {
  const goiY = useFetcher<KetQuaGoiYThuTu>();
  const apDung = useFetcher<KetQuaThaoTacNhom>();
  const daGui = useRef(false);
  const dangApDung = apDung.state !== "idle";

  useEffect(() => {
    if (!mo || daGui.current) return;
    daGui.current = true;
    goiY.submit({ intent: "goi-y-thu-tu" }, { method: "post" });
  }, [mo, goiY.submit]);

  useEffect(() => {
    if (apDung.state === "idle" && xongCua(apDung.data)) onDong();
  }, [apDung.state, apDung.data, onDong]);

  const kq = goiY.data;
  const loi = kq && "loi" in kq ? kq.loi : null;
  const g = kq && "goiY" in kq ? kq.goiY : null;
  const viTriCu = new Map(muc.map((m, i) => [m.id, i + 1]));
  const thuTuMoi = g?.dat ? g.thu_tu.map((m) => m.id) : [];
  const khongDoi = thuTuMoi.length > 0 && thuTuMoi.every((id, i) => muc[i]?.id === id);

  const nutDong = (
    <Button size="lg" variant="secondary" onClick={onDong}>
      Đóng
    </Button>
  );

  return (
    <HopThoai mo={mo} onDong={onDong} tieuDe="Gợi ý thứ tự học">
      <div className="grid gap-4" aria-busy={goiY.state !== "idle"}>
        {goiY.state !== "idle" || !kq ? (
          <p role="status" className="text-base text-ink-2">
            Đang soạn gợi ý, có thể mất tới 20 giây.
          </p>
        ) : loi ? (
          <>
            <Notice tone="danger">{loi}</Notice>
            <div className="flex justify-end">{nutDong}</div>
          </>
        ) : g && !g.dat ? (
          <>
            <Notice>{g.thong_bao}</Notice>
            <div className="flex justify-end">{nutDong}</div>
          </>
        ) : g?.dat ? (
          <>
            <p role="status" className="text-base text-ink-2">
              {khongDoi
                ? "Thứ tự hiện tại đã khớp với gợi ý, không cần đổi."
                : "Thứ tự gợi ý dưới đây chưa được áp dụng. Chọn “Áp dụng thứ tự này” thì cả nhóm thấy thứ tự mới."}
            </p>
            <ol className="grid gap-2" data-goi-y-thu-tu="">
              {g.thu_tu.map((m, i) => {
                const cu = viTriCu.get(m.id);
                return (
                  <li key={m.id} className="rounded-btn border border-line bg-surface px-3 py-2 text-base">
                    <span className="font-semibold tabular-nums">{i + 1}.</span>{" "}
                    <span className="break-words">{m.ten}</span>
                    {cu !== undefined && cu !== i + 1 ? (
                      <span className="block text-sm text-ink-3">Đang ở vị trí {cu}</span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
            {g.ghi_chu ? (
              <div>
                <h3 className="font-sans text-base font-semibold">Lý do sắp</h3>
                <p className="mt-1 break-words text-base text-ink-2">{g.ghi_chu}</p>
              </div>
            ) : null}
            <p className="text-sm text-ink-3">
              Gợi ý do AI soạn từ loại mục, chủ đề, độ dài và hạn gợi ý của từng mục; không dùng thông tin
              thành viên.
            </p>
            {loiCua(apDung.data) ? <Notice tone="danger">{loiCua(apDung.data)}</Notice> : null}
            {khongDoi ? (
              <div className="flex justify-end">{nutDong}</div>
            ) : (
              <apDung.Form method="post" className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <input type="hidden" name="intent" value="thu-tu" />
                <input type="hidden" name="item_ids" value={JSON.stringify(thuTuMoi)} />
                <Button size="lg" variant="secondary" onClick={onDong} disabled={dangApDung}>
                  Giữ thứ tự hiện tại
                </Button>
                <Button size="lg" type="submit" disabled={dangApDung}>
                  {dangApDung ? "Đang áp dụng" : "Áp dụng thứ tự này"}
                </Button>
              </apDung.Form>
            )}
          </>
        ) : null}
      </div>
    </HopThoai>
  );
}
