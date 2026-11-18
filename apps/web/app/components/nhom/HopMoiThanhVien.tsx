import { useState } from "react";
import { useFetcher } from "react-router";

import { type KetQuaThaoTacNhom, loiCua } from "../../lib/nhom";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Field";
import { HopThoai } from "../ui/HopThoai";
import { KhoiLienKetMoi } from "./KhoiLienKetMoi";

/**
 * Mời thành viên: mã mời, liên kết mời, nút sao chép. Trưởng nhóm đổi được mã mời, có bước xác
 * nhận vì mã cũ và liên kết cũ hết dùng ngay.
 */
export function HopMoiThanhVien({
  mo,
  onDong,
  ma,
  laTruongNhom,
}: {
  mo: boolean;
  onDong: () => void;
  ma: string;
  laTruongNhom: boolean;
}) {
  const f = useFetcher<KetQuaThaoTacNhom>();
  const [xacNhan, datXacNhan] = useState(false);
  const dangGui = f.state !== "idle";
  const loi = loiCua(f.data);
  const daDoi = f.state === "idle" && f.data?.intent === "doi-ma" && !loi;

  return (
    <HopThoai mo={mo} onDong={onDong} tieuDe="Mời thành viên">
      <div className="grid gap-4">
        <p className="text-base text-ink-2">
          Người có tài khoản cán bộ nhập mã mời ở trang Nhóm học cùng, hoặc mở liên kết mời, để tham gia nhóm.
        </p>
        <KhoiLienKetMoi ma={ma} />
        {daDoi ? (
          <p role="status" className="text-sm text-ink-2">
            Đã đổi mã mời. Mã cũ không còn dùng được.
          </p>
        ) : null}
        {loi ? <Notice tone="danger">{loi}</Notice> : null}
        {laTruongNhom ? (
          xacNhan ? (
            <f.Form
              method="post"
              className="grid gap-3 rounded-card border border-line bg-surface-2 p-4"
              onSubmit={() => datXacNhan(false)}
            >
              <input type="hidden" name="intent" value="doi-ma" />
              <p className="text-sm">
                Mã cũ và liên kết cũ hết dùng ngay. Người chưa tham gia phải nhận mã mới. Thành viên đang ở
                trong nhóm không bị ảnh hưởng.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button size="lg" variant="secondary" onClick={() => datXacNhan(false)}>
                  Hủy
                </Button>
                <Button type="submit" size="lg" disabled={dangGui}>
                  Đổi mã mời
                </Button>
              </div>
            </f.Form>
          ) : (
            <Button size="lg" variant="ghost" onClick={() => datXacNhan(true)} className="w-full">
              Đổi mã mời
            </Button>
          )
        ) : null}
      </div>
    </HopThoai>
  );
}
