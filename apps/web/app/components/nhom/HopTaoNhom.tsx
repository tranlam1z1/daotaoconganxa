import { Link, useFetcher } from "react-router";

import { cn } from "../../lib/cn";
import { GIOI_HAN_NHAP, type KetQuaThaoTacNhom, loiCua, xongCua } from "../../lib/nhom";
import { Button, buttonClass } from "../ui/Button";
import { inputClass, Label, Notice } from "../ui/Field";
import { HopThoai, VungNutHop } from "../ui/HopThoai";
import { KhoiLienKetMoi } from "./KhoiLienKetMoi";

/** Tạo nhóm: tên, mô tả. Tạo xong hiện mã mời, liên kết mời và nút mở nhóm. */
export function HopTaoNhom({ mo, onDong }: { mo: boolean; onDong: () => void }) {
  const f = useFetcher<KetQuaThaoTacNhom>();
  const dangGui = f.state !== "idle";
  const loi = loiCua(f.data);
  const xong = xongCua(f.data)?.taoXong;

  return (
    <HopThoai mo={mo} onDong={onDong} tieuDe={xong ? "Đã tạo nhóm" : "Tạo nhóm"}>
      {xong ? (
        <div className="grid gap-4">
          <p className="text-base text-ink-2">
            Nhóm "{xong.ten}" đã được tạo. Gửi mã mời hoặc liên kết mời cho đồng đội để cùng học.
          </p>
          <KhoiLienKetMoi ma={xong.ma_moi} />
          <Link to={`/nhom/${xong.id}`} className={buttonClass({ size: "lg", className: "w-full" })}>
            Mở nhóm
          </Link>
        </div>
      ) : (
        <f.Form method="post" className="grid gap-4">
          <input type="hidden" name="intent" value="tao" />
          <div>
            <Label htmlFor="ten-nhom">Tên nhóm</Label>
            <input
              id="ten-nhom"
              name="ten"
              required
              minLength={GIOI_HAN_NHAP.tenNhom.toiThieu}
              maxLength={GIOI_HAN_NHAP.tenNhom.toiDa}
              autoComplete="off"
              className={cn(inputClass, "min-h-12")}
            />
            <p className="mt-1 text-sm text-ink-2">
              Từ {GIOI_HAN_NHAP.tenNhom.toiThieu} đến {GIOI_HAN_NHAP.tenNhom.toiDa} ký tự.
            </p>
          </div>
          <div>
            <Label htmlFor="mo-ta-nhom">Mô tả (không bắt buộc)</Label>
            <textarea
              id="mo-ta-nhom"
              name="mo_ta"
              rows={3}
              maxLength={GIOI_HAN_NHAP.moTa}
              className={cn(inputClass, "min-h-24 py-2")}
            />
          </div>
          {loi ? <Notice tone="danger">{loi}</Notice> : null}
          <VungNutHop>
            <Button type="submit" size="lg" disabled={dangGui} className="w-full sm:w-auto">
              {dangGui ? "Đang tạo" : "Tạo nhóm"}
            </Button>
          </VungNutHop>
        </f.Form>
      )}
    </HopThoai>
  );
}
