import { useEffect, useState } from "react";
import { useFetcher } from "react-router";

import { cn } from "../../lib/cn";
import { type KetQuaThaoTacNhom, loiCua, type MucNhom, xongCua } from "../../lib/nhom";
import { Button } from "../ui/Button";
import { inputClass, Label, Notice } from "../ui/Field";
import { HopThoai } from "../ui/HopThoai";

/**
 * Tùy chọn một mục (docs/PLAN.md GĐ16b). Trưởng nhóm: chuyển lên, chuyển xuống, đặt hoặc bỏ hạn
 * gợi ý, gỡ mục. Người đã chia sẻ mục: gỡ mục. Gỡ mục đi qua hộp xác nhận (`onGo`).
 */
export function HopTuyChonMuc({
  mo,
  onDong,
  muc,
  thuTu,
  laTruongNhom,
  onGo,
}: {
  mo: boolean;
  onDong: () => void;
  muc: MucNhom | null;
  /** Id các mục theo thứ tự đang hiện. */
  thuTu: string[];
  laTruongNhom: boolean;
  onGo: (m: MucNhom) => void;
}) {
  const f = useFetcher<KetQuaThaoTacNhom>();
  const dangGui = f.state !== "idle";
  const loi = loiCua(f.data);
  const [han, datHan] = useState(muc?.han_goi_y ?? "");
  const [thongBao, datThongBao] = useState("");

  useEffect(() => {
    if (f.state === "idle" && xongCua(f.data)) {
      datThongBao(f.data?.intent === "dat-han" ? "Đã lưu hạn gợi ý." : "Đã đổi thứ tự.");
    }
  }, [f.state, f.data]);

  if (!muc) {
    return (
      <HopThoai mo={mo} onDong={onDong} tieuDe="Tùy chọn mục">
        {null}
      </HopThoai>
    );
  }
  const viTri = thuTu.indexOf(muc.id);
  const doiCho = (buoc: -1 | 1) => {
    const moi = [...thuTu];
    const j = viTri + buoc;
    [moi[viTri], moi[j]] = [moi[j]!, moi[viTri]!];
    return JSON.stringify(moi);
  };

  return (
    <HopThoai mo={mo} onDong={onDong} tieuDe={`Tùy chọn: ${muc.ten}`}>
      <div className="grid gap-5">
        {laTruongNhom ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  [-1, "Chuyển lên", viTri <= 0],
                  [1, "Chuyển xuống", viTri < 0 || viTri >= thuTu.length - 1],
                ] as const
              ).map(([buoc, nhan, khoa]) => (
                <f.Form key={nhan} method="post">
                  <input type="hidden" name="intent" value="thu-tu" />
                  <input type="hidden" name="item_ids" value={khoa ? "" : doiCho(buoc)} />
                  <Button
                    type="submit"
                    size="lg"
                    variant="secondary"
                    disabled={khoa || dangGui}
                    className="w-full"
                  >
                    {nhan}
                  </Button>
                </f.Form>
              ))}
            </div>
            <f.Form method="post" className="grid gap-2">
              <input type="hidden" name="intent" value="dat-han" />
              <input type="hidden" name="item_id" value={muc.id} />
              <Label htmlFor="han-goi-y">Hạn gợi ý (không khóa việc học)</Label>
              <input
                id="han-goi-y"
                name="han_goi_y"
                type="date"
                value={han}
                onChange={(e) => datHan(e.target.value)}
                className={cn(inputClass, "min-h-12")}
              />
              <div className="grid grid-cols-2 gap-2">
                <Button type="submit" size="lg" variant="secondary" disabled={dangGui || !han}>
                  Lưu hạn
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  variant="ghost"
                  disabled={dangGui || !muc.han_goi_y}
                  onClick={() => datHan("")}
                  name="bo_han"
                  value="1"
                >
                  Bỏ hạn
                </Button>
              </div>
            </f.Form>
          </>
        ) : null}
        {loi ? <Notice tone="danger">{loi}</Notice> : null}
        {thongBao && !loi ? (
          <p role="status" className="text-sm text-ink-2">
            {thongBao}
          </p>
        ) : null}
        <Button size="lg" variant="secondary" onClick={() => onGo(muc)} className="text-danger">
          Gỡ khỏi nhóm
        </Button>
      </div>
    </HopThoai>
  );
}
