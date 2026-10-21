import { useEffect } from "react";
import { useFetcher } from "react-router";

import { type KetQuaThaoTacNhom, loiCua, xongCua } from "../../lib/nhom";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Field";
import { HopThoai, VungNutHop } from "../ui/HopThoai";

export interface XacNhanNhom {
  tieuDe: string;
  /** Hậu quả của thao tác, nêu rõ trước khi bấm. */
  noiDung: string;
  nhanNut: string;
  intent: string;
  truong?: Record<string, string>;
}

/**
 * Hộp xác nhận cho rời nhóm, gỡ mục, mời ra, chuyển quyền, lưu trữ (docs/PLAN.md GĐ16b). Lỗi hiện
 * ngay trong hộp và hộp không đóng; làm xong thì đóng (thao tác chuyển trang thì trang tự chuyển).
 */
export function HopXacNhanNhom({
  mo,
  onDong,
  xacNhan,
}: {
  mo: boolean;
  onDong: () => void;
  xacNhan: XacNhanNhom | null;
}) {
  const f = useFetcher<KetQuaThaoTacNhom>();
  const dangGui = f.state !== "idle";
  const loi = loiCua(f.data);

  useEffect(() => {
    if (f.state === "idle" && xongCua(f.data)) onDong();
  }, [f.state, f.data, onDong]);

  return (
    <HopThoai mo={mo} onDong={onDong} tieuDe={xacNhan?.tieuDe ?? "Xác nhận"} quanTrong>
      {xacNhan ? (
        <f.Form method="post" className="grid gap-4">
          <p className="text-base text-ink-2">{xacNhan.noiDung}</p>
          <input type="hidden" name="intent" value={xacNhan.intent} />
          {Object.entries(xacNhan.truong ?? {}).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          {loi ? <Notice tone="danger">{loi}</Notice> : null}
          <VungNutHop>
            <Button size="lg" variant="secondary" onClick={onDong} disabled={dangGui}>
              Hủy
            </Button>
            <Button size="lg" type="submit" disabled={dangGui}>
              {dangGui ? "Đang xử lý" : xacNhan.nhanNut}
            </Button>
          </VungNutHop>
        </f.Form>
      ) : null}
    </HopThoai>
  );
}
