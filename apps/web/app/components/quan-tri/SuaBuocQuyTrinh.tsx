/**
 * Khung nhập các bước của một quy trình: mỗi bước một khối có việc cần làm, mô tả, căn cứ; thêm, xóa,
 * đổi thứ tự bước. Dùng chung cho trang soạn mới và khung sửa ở trang Duyệt dữ liệu tra cứu.
 *
 * Các bước gửi theo biểu mẫu qua ô ẩn `steps`; phía máy chủ đọc lại bằng `docBuocQuyTrinh`
 * (lib/du-lieu-tra-cuu.ts).
 */
import { useState } from "react";

import { cn } from "../../lib/cn";
import type { BuocQuyTrinh } from "../../lib/du-lieu-tra-cuu";
import { Button } from "../ui/Button";
import { inputClass, Label } from "../ui/Field";
import { Icon } from "../ui/Icon";
import { OCanCu } from "./OCanCu";

const SO_BUOC_TOI_DA = 40;

interface BuocDangSua {
  /** Khóa React của bước; không gửi đi, không dùng làm id (bộ đếm ở máy chủ và trình duyệt khác nhau). */
  k: number;
  tieu_de: string;
  mo_ta: string;
  can_cu: string;
}

let demBuoc = 0;
const buocTrong = (): BuocDangSua => ({
  k: ++demBuoc,
  tieu_de: "",
  mo_ta: "",
  can_cu: "",
});
const tuBuoc = (b: BuocQuyTrinh): BuocDangSua => ({
  k: ++demBuoc,
  tieu_de: b.tieu_de ?? "",
  mo_ta: b.mo_ta ?? "",
  can_cu: b.can_cu ?? "",
});

function Truong({
  id,
  nhan,
  goiY,
  children,
}: {
  id: string;
  nhan: string;
  goiY?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id}>{nhan}</Label>
      <div className="mt-1">{children}</div>
      {goiY ? <p className="mt-1 text-xs text-ink-3">{goiY}</p> : null}
    </div>
  );
}

export function SuaBuocQuyTrinh({
  banDau,
  khiDoi,
}: {
  banDau?: BuocQuyTrinh[];
  /** Báo cho trang chứa biết các bước vừa đổi (thêm, xóa, đổi thứ tự không sinh sự kiện change của form). */
  khiDoi?: () => void;
}) {
  const [buoc, datBuoc] = useState<BuocDangSua[]>(() =>
    banDau?.length ? banDau.map(tuBuoc) : [buocTrong()],
  );
  const doi = (f: (ds: BuocDangSua[]) => BuocDangSua[]) => {
    datBuoc(f);
    khiDoi?.();
  };
  const sua = (i: number, thay: Partial<BuocDangSua>) =>
    doi((ds) => ds.map((b, j) => (j === i ? { ...b, ...thay } : b)));
  const doiCho = (i: number, j: number) =>
    doi((ds) => {
      const moi = [...ds];
      [moi[i], moi[j]] = [moi[j]!, moi[i]!];
      return moi;
    });

  const o = cn(inputClass, "min-h-11");
  const gui = buoc.map(({ k: _k, ...b }) => b);

  return (
    <fieldset className="grid gap-3">
      <legend className="text-sm font-medium">Các bước, theo đúng thứ tự thực hiện</legend>
      <input type="hidden" name="steps" value={JSON.stringify(gui)} />
      {buoc.map((b, i) => (
        <div key={b.k} className="grid gap-3 rounded-lg border border-line p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold">Bước {i + 1}</span>
            <span className="flex flex-wrap gap-1">
              {i > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Đưa bước ${i + 1} lên`}
                  onClick={() => doiCho(i, i - 1)}
                >
                  <Icon name="chevronUp" className="size-4" />
                </Button>
              ) : null}
              {i < buoc.length - 1 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Đưa bước ${i + 1} xuống`}
                  onClick={() => doiCho(i, i + 1)}
                >
                  <Icon name="chevronDown" className="size-4" />
                </Button>
              ) : null}
              {buoc.length > 1 ? (
                <Button variant="ghost" size="sm" onClick={() => doi((ds) => ds.filter((_, j) => j !== i))}>
                  <Icon name="x" className="size-4" />
                  Xóa bước
                </Button>
              ) : null}
            </span>
          </div>
          <Truong id={`buoc-${i}-tieu-de`} nhan="Việc cần làm">
            <input
              id={`buoc-${i}-tieu-de`}
              value={b.tieu_de}
              onChange={(e) => sua(i, { tieu_de: e.target.value })}
              required
              minLength={2}
              maxLength={300}
              className={o}
            />
          </Truong>
          <Truong id={`buoc-${i}-mo-ta`} nhan="Mô tả">
            <textarea
              id={`buoc-${i}-mo-ta`}
              value={b.mo_ta}
              onChange={(e) => sua(i, { mo_ta: e.target.value })}
              required
              minLength={2}
              maxLength={3000}
              rows={2}
              className={inputClass}
            />
          </Truong>
          <Truong id={`buoc-${i}-can-cu`} nhan="Căn cứ (không bắt buộc)">
            <OCanCu id={`buoc-${i}-can-cu`} macDinh={b.can_cu} khiDoi={(urn) => sua(i, { can_cu: urn })} />
          </Truong>
        </div>
      ))}
      {buoc.length < SO_BUOC_TOI_DA ? (
        <div>
          <Button variant="secondary" onClick={() => doi((ds) => [...ds, buocTrong()])}>
            Thêm bước
          </Button>
        </div>
      ) : null}
    </fieldset>
  );
}
