import { useEffect, useId, useState } from "react";

import { cn } from "../../lib/cn";
import { lienKetMoi } from "../../lib/nhom";
import { Button } from "../ui/Button";
import { inputClass } from "../ui/Field";
import { Icon } from "../ui/Icon";

/** Mã mời, liên kết mời và nút sao chép liên kết. Trình duyệt chặn sao chép thì chọn sẵn liên kết. */
export function KhoiLienKetMoi({ ma }: { ma: string }) {
  const [goc, datGoc] = useState("");
  const [trangThai, datTrangThai] = useState<"" | "da_chep" | "tu_chep">("");
  const idLienKet = useId();
  useEffect(() => datGoc(window.location.origin), []);
  const lienKet = lienKetMoi(goc, ma);

  const chep = async () => {
    try {
      await navigator.clipboard.writeText(lienKet);
      datTrangThai("da_chep");
    } catch {
      const o = document.getElementById(idLienKet) as HTMLInputElement | null;
      o?.select();
      datTrangThai("tu_chep");
    }
  };

  return (
    <div className="grid gap-3">
      <div>
        <p className="text-sm text-ink-2">Mã mời</p>
        <p className="font-mono text-2xl font-semibold tracking-[0.2em]" data-ma-moi={ma}>
          {ma}
        </p>
      </div>
      <div>
        <label htmlFor={idLienKet} className="mb-1.5 block text-sm font-medium text-ink-2">
          Liên kết mời
        </label>
        <input
          id={idLienKet}
          readOnly
          value={lienKet}
          onFocus={(e) => e.currentTarget.select()}
          className={cn(inputClass, "min-h-12")}
        />
      </div>
      <Button size="lg" variant="secondary" onClick={chep} className="w-full">
        <Icon name="copy" />
        Sao chép liên kết mời
      </Button>
      {trangThai ? (
        <p role="status" className="text-sm text-ink-2">
          {trangThai === "da_chep"
            ? "Đã sao chép liên kết mời."
            : "Trình duyệt không cho sao chép tự động. Liên kết đã được chọn sẵn trong ô trên."}
        </p>
      ) : null}
    </div>
  );
}
