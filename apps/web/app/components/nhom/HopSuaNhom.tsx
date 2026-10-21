import { useEffect } from "react";
import { useFetcher } from "react-router";

import { cn } from "../../lib/cn";
import { GIOI_HAN_NHAP, type KetQuaThaoTacNhom, loiCua, xongCua } from "../../lib/nhom";
import { Button } from "../ui/Button";
import { inputClass, Label, Notice } from "../ui/Field";
import { HopThoai, VungNutHop } from "../ui/HopThoai";

/** Trưởng nhóm sửa tên và mô tả nhóm. */
export function HopSuaNhom({
  mo,
  onDong,
  ten,
  moTa,
}: {
  mo: boolean;
  onDong: () => void;
  ten: string;
  moTa: string | null;
}) {
  const f = useFetcher<KetQuaThaoTacNhom>();
  const dangGui = f.state !== "idle";
  const loi = loiCua(f.data);
  useEffect(() => {
    if (f.state === "idle" && xongCua(f.data)) onDong();
  }, [f.state, f.data, onDong]);

  return (
    <HopThoai mo={mo} onDong={onDong} tieuDe="Sửa tên và mô tả">
      <f.Form method="post" className="grid gap-4">
        <input type="hidden" name="intent" value="sua" />
        <div>
          <Label htmlFor="sua-ten-nhom">Tên nhóm</Label>
          <input
            id="sua-ten-nhom"
            name="ten"
            required
            defaultValue={ten}
            minLength={GIOI_HAN_NHAP.tenNhom.toiThieu}
            maxLength={GIOI_HAN_NHAP.tenNhom.toiDa}
            className={cn(inputClass, "min-h-12")}
          />
        </div>
        <div>
          <Label htmlFor="sua-mo-ta">Mô tả</Label>
          <textarea
            id="sua-mo-ta"
            name="mo_ta"
            rows={3}
            defaultValue={moTa ?? ""}
            maxLength={GIOI_HAN_NHAP.moTa}
            className={cn(inputClass, "min-h-24 py-2")}
          />
        </div>
        {loi ? <Notice tone="danger">{loi}</Notice> : null}
        <VungNutHop>
          <Button type="submit" size="lg" disabled={dangGui} className="w-full sm:w-auto">
            {dangGui ? "Đang lưu" : "Lưu"}
          </Button>
        </VungNutHop>
      </f.Form>
    </HopThoai>
  );
}
