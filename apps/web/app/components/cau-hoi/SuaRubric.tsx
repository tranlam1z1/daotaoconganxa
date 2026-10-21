/**
 * Sửa tiêu chí chấm (rubric) của câu tự luận. Component có điều khiển: trang giữ `rubric`,
 * nhận bản mới qua `onChange`. Luật hợp lệ (tiêu chí `can_cu` nặng nhất, có mức 0...) do API kiểm
 * và trả lỗi; ở đây chỉ nhắc trước để người soạn khỏi phải đoán.
 */
import { cn } from "../../lib/cn";
import type { Rubric, TieuChiRubric } from "../../lib/ngan-hang";
import { Button } from "../ui/Button";
import { Input, inputClass, Label } from "../ui/Field";

export function SuaRubric({ rubric, onChange }: { rubric: Rubric; onChange: (r: Rubric) => void }) {
  const doiTieuChi = (i: number, tc: TieuChiRubric) =>
    onChange({ ...rubric, tieu_chi: rubric.tieu_chi.map((x, j) => (j === i ? tc : x)) });
  const tongTrongSo = rubric.tieu_chi.reduce((s, tc) => s + (Number(tc.trong_so) || 0), 0);

  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1.5 text-sm font-medium text-ink-2">Tiêu chí chấm</legend>
      <p className="text-sm text-ink-2">
        Bắt buộc có tiêu chí mã <code>can_cu</code> (viện dẫn đúng, còn hiệu lực), trọng số lớn nhất và có mức
        0 điểm cho việc dùng văn bản đã hết hiệu lực. Mỗi mức ghi rõ bài làm phải có gì.
      </p>
      {rubric.tieu_chi.map((tc, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: tiêu chí nhập theo vị trí, mã có thể đang sửa
        <div key={i} className="grid gap-2 rounded-lg border border-line p-3">
          <div className="grid gap-2 sm:grid-cols-[8rem_1fr_6rem_auto]">
            <Input
              aria-label={`Mã tiêu chí ${i + 1}`}
              placeholder="ma_tieu_chi"
              value={tc.ma}
              onChange={(e) => doiTieuChi(i, { ...tc, ma: e.target.value.trim() })}
              className="font-mono text-sm"
            />
            <Input
              aria-label={`Tên tiêu chí ${i + 1}`}
              placeholder="Tên tiêu chí"
              value={tc.ten}
              onChange={(e) => doiTieuChi(i, { ...tc, ten: e.target.value })}
            />
            <Input
              aria-label={`Trọng số tiêu chí ${i + 1}`}
              type="number"
              min={0}
              max={100}
              value={tc.trong_so}
              onChange={(e) => doiTieuChi(i, { ...tc, trong_so: Number(e.target.value) })}
            />
            <Button
              variant="ghost"
              disabled={rubric.tieu_chi.length <= 1}
              onClick={() => onChange({ ...rubric, tieu_chi: rubric.tieu_chi.filter((_, j) => j !== i) })}
            >
              Bỏ
            </Button>
          </div>
          <ul className="grid gap-1.5 pl-2">
            {tc.muc.map((m, k) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: mức điểm nhập theo vị trí
              <li key={k} className="grid grid-cols-[5rem_1fr_auto] items-center gap-2">
                <Input
                  aria-label={`Điểm mức ${k + 1} của tiêu chí ${i + 1}`}
                  type="number"
                  min={0}
                  value={m.diem}
                  onChange={(e) =>
                    doiTieuChi(i, {
                      ...tc,
                      muc: tc.muc.map((x, j) => (j === k ? { ...x, diem: Number(e.target.value) } : x)),
                    })
                  }
                />
                <Input
                  aria-label={`Mô tả mức ${k + 1} của tiêu chí ${i + 1}`}
                  placeholder="Bài làm đạt mức này khi…"
                  value={m.mo_ta}
                  onChange={(e) =>
                    doiTieuChi(i, {
                      ...tc,
                      muc: tc.muc.map((x, j) => (j === k ? { ...x, mo_ta: e.target.value } : x)),
                    })
                  }
                />
                <Button
                  variant="ghost"
                  disabled={tc.muc.length <= 1}
                  onClick={() => doiTieuChi(i, { ...tc, muc: tc.muc.filter((_, j) => j !== k) })}
                >
                  Bỏ
                </Button>
              </li>
            ))}
          </ul>
          {tc.muc.length < 10 ? (
            <Button
              variant="ghost"
              className="justify-self-start"
              onClick={() => doiTieuChi(i, { ...tc, muc: [...tc.muc, { diem: 0, mo_ta: "" }] })}
            >
              Thêm mức điểm
            </Button>
          ) : null}
        </div>
      ))}
      {rubric.tieu_chi.length < 10 ? (
        <Button
          variant="secondary"
          onClick={() =>
            onChange({
              ...rubric,
              tieu_chi: [
                ...rubric.tieu_chi,
                {
                  ma: "",
                  ten: "",
                  trong_so: 10,
                  muc: [
                    { diem: 0, mo_ta: "" },
                    { diem: 4, mo_ta: "" },
                  ],
                },
              ],
            })
          }
        >
          Thêm tiêu chí
        </Button>
      ) : null}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label htmlFor="nguong-dat">Ngưỡng đạt (%)</Label>
          <input
            id="nguong-dat"
            type="number"
            min={0}
            max={100}
            value={rubric.nguong_dat}
            onChange={(e) => onChange({ ...rubric, nguong_dat: Number(e.target.value) })}
            className={cn(inputClass, "w-28")}
          />
        </div>
        <p className="pb-3 text-sm text-ink-2">Tổng trọng số: {tongTrongSo}</p>
      </div>
    </fieldset>
  );
}
