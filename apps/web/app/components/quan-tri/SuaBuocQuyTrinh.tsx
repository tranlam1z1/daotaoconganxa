/**
 * Khung nhập các bước của một quy trình: mỗi bước một khối có việc cần làm, mô tả, căn cứ; thêm, xóa,
 * đổi thứ tự bước. Dùng chung cho trang soạn mới và khung sửa ở trang Duyệt dữ liệu tra cứu.
 *
 * `coTroChoi`: hiện thêm phần trò chơi của bước (loại bước, cử chỉ, bắt buộc, điều kiện, nguồn) cho quy
 * trình dùng trong trò chơi. Các bước gửi theo biểu mẫu qua ô ẩn `steps`; phía máy chủ đọc lại bằng
 * `docBuocQuyTrinh` (lib/du-lieu-tra-cuu.ts).
 */
import { useState } from "react";

import { cn } from "../../lib/cn";
import { type BuocQuyTrinh, NGUON_BUOC, THAO_TAC_BUOC, type TroChoiCuaBuoc } from "../../lib/du-lieu-tra-cuu";
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
  /** Bỏ tích thì phần trò chơi không gửi đi, nhưng các ô vẫn giữ giá trị để tích lại không phải nhập lại. */
  dungTroChoi: boolean;
  tro_choi: Required<TroChoiCuaBuoc> & { dieu_kien: string };
}

let demBuoc = 0;
const troChoiTrong = (): BuocDangSua["tro_choi"] => ({
  ma: "",
  thao_tac: "cham",
  bat_buoc: true,
  dieu_kien: "",
  nguon: "van_ban",
});
const buocTrong = (): BuocDangSua => ({
  k: ++demBuoc,
  tieu_de: "",
  mo_ta: "",
  can_cu: "",
  dungTroChoi: false,
  tro_choi: troChoiTrong(),
});
const tuBuoc = (b: BuocQuyTrinh): BuocDangSua => ({
  k: ++demBuoc,
  tieu_de: b.tieu_de ?? "",
  mo_ta: b.mo_ta ?? "",
  can_cu: b.can_cu ?? "",
  dungTroChoi: Boolean(b.tro_choi),
  tro_choi: b.tro_choi ? { ...b.tro_choi, dieu_kien: b.tro_choi.dieu_kien ?? "" } : troChoiTrong(),
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
  coTroChoi = false,
  khiDoi,
}: {
  banDau?: BuocQuyTrinh[];
  coTroChoi?: boolean;
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
  const suaTroChoi = (i: number, thay: Partial<BuocDangSua["tro_choi"]>) =>
    doi((ds) => ds.map((b, j) => (j === i ? { ...b, tro_choi: { ...b.tro_choi, ...thay } } : b)));
  const doiCho = (i: number, j: number) =>
    doi((ds) => {
      const moi = [...ds];
      [moi[i], moi[j]] = [moi[j]!, moi[i]!];
      return moi;
    });

  const o = cn(inputClass, "min-h-11");
  const gui = buoc.map(({ k: _k, dungTroChoi, tro_choi, ...b }) => (dungTroChoi ? { ...b, tro_choi } : b));

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
          {coTroChoi ? (
            <>
              <label
                htmlFor={`buoc-${i}-tro-choi`}
                className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]"
              >
                <input
                  id={`buoc-${i}-tro-choi`}
                  type="checkbox"
                  checked={b.dungTroChoi}
                  onChange={(e) => sua(i, { dungTroChoi: e.target.checked })}
                  className="size-5 shrink-0"
                />
                Bước này dùng trong trò chơi
              </label>
              {b.dungTroChoi ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Truong
                    id={`buoc-${i}-ma`}
                    nhan="Loại bước"
                    goiY="Mã do trò chơi định nghĩa: chữ thường không dấu, nối bằng gạch dưới."
                  >
                    <input
                      id={`buoc-${i}-ma`}
                      value={b.tro_choi.ma}
                      onChange={(e) => suaTroChoi(i, { ma: e.target.value })}
                      required
                      pattern="[a-z_]{3,40}"
                      className={cn(o, "font-mono text-sm")}
                    />
                  </Truong>
                  <Truong id={`buoc-${i}-thao-tac`} nhan="Cử chỉ">
                    <select
                      id={`buoc-${i}-thao-tac`}
                      value={b.tro_choi.thao_tac}
                      onChange={(e) => suaTroChoi(i, { thao_tac: e.target.value })}
                      className={o}
                    >
                      {THAO_TAC_BUOC.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.ten}
                        </option>
                      ))}
                    </select>
                  </Truong>
                  <Truong
                    id={`buoc-${i}-dieu-kien`}
                    nhan="Điều kiện áp dụng"
                    goiY="Mã do trò chơi định nghĩa; bỏ trống là luôn áp dụng."
                  >
                    <input
                      id={`buoc-${i}-dieu-kien`}
                      value={b.tro_choi.dieu_kien}
                      onChange={(e) => suaTroChoi(i, { dieu_kien: e.target.value })}
                      pattern="[a-z_]{3,40}"
                      className={cn(o, "font-mono text-sm")}
                    />
                  </Truong>
                  <Truong id={`buoc-${i}-nguon`} nhan="Nguồn của bước">
                    <select
                      id={`buoc-${i}-nguon`}
                      value={b.tro_choi.nguon}
                      onChange={(e) => suaTroChoi(i, { nguon: e.target.value })}
                      className={o}
                    >
                      {NGUON_BUOC.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.ten}
                        </option>
                      ))}
                    </select>
                  </Truong>
                  <label
                    htmlFor={`buoc-${i}-bat-buoc`}
                    className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] sm:col-span-2"
                  >
                    <input
                      id={`buoc-${i}-bat-buoc`}
                      type="checkbox"
                      checked={b.tro_choi.bat_buoc}
                      onChange={(e) => suaTroChoi(i, { bat_buoc: e.target.checked })}
                      className="size-5 shrink-0"
                    />
                    Bước bắt buộc
                  </label>
                </div>
              ) : null}
            </>
          ) : null}
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
