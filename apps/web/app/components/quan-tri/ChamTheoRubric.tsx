/**
 * Form chấm tự luận theo rubric: giảng viên chọn mức điểm từng tiêu chí, kèm nhận xét. Dùng chung
 * cho hàng chấm của đề thi và của bài học; trang gọi đưa các ô ẩn định danh bài qua `children`.
 */
import type { ReactNode } from "react";
import { Form, Link, useNavigation } from "react-router";

import { cn } from "../../lib/cn";
import type { Rubric } from "../../lib/ngan-hang";
import { Button } from "../ui/Button";
import { inputClass, Label } from "../ui/Field";
import { Icon } from "../ui/Icon";

/** Điểm từng tiêu chí trong form gửi lên (các ô `tc__<mã>`), khóa là mã tiêu chí. */
export function docDiemTieuChi(f: FormData): Record<string, number> {
  const diem: Record<string, number> = {};
  for (const [k, v] of f.entries()) {
    const m = /^tc__(.+)$/.exec(k);
    if (m) diem[m[1] as string] = Number(v);
  }
  return diem;
}

/** Công tắc đầu trang chấm tự luận: chấm bài tập trong bài giảng hay chấm câu tự luận của đề thi. */
export function NguonChamTuLuan({ dangXem }: { dangXem: "bai-giang" | "de-thi" }) {
  return (
    <nav
      aria-label="Nguồn bài chấm"
      className="mt-5 grid w-full grid-cols-2 overflow-hidden rounded-btn bg-primary-soft sm:max-w-[554px]"
    >
      {(
        [
          ["bai-giang", "Bài giảng", "/quan-tri/cham-tu-luan"],
          ["de-thi", "Đề thi", "/quan-tri/cham-tu-luan/de-thi"],
        ] as const
      ).map(([ma, nhan, to]) => (
        <Link
          key={ma}
          to={to}
          aria-current={dangXem === ma ? "page" : undefined}
          className={cn(
            "flex min-h-[52px] items-center justify-center gap-4 border-b-2 rounded-btn text-base font-semibold",
            dangXem === ma
              ? "border-primary bg-surface/50 text-primary shadow-[inset_0_0_0_1px_var(--line)]"
              : "border-transparent text-ink-2 hover:bg-surface/30 hover:text-ink",
          )}
        >
          <Icon name={ma === "bai-giang" ? "book" : "file"} kieu="net" className="size-6" />
          {nhan}
        </Link>
      ))}
    </nav>
  );
}

export function ChamTheoRubric({
  khoa,
  rubric,
  diemCu,
  nhanNhanXet,
  nhanNut,
  children,
}: {
  /** Phân biệt id các ô khi một trang có nhiều form chấm. */
  khoa: string;
  rubric: Rubric;
  /** Điểm đã chấm trước đó theo mã tiêu chí, để chọn sẵn. */
  diemCu: Map<string, number>;
  nhanNhanXet: string;
  nhanNut: string;
  children?: ReactNode;
}) {
  const busy = useNavigation().state !== "idle";
  return (
    <Form method="post" className="mt-4 grid gap-3">
      {children}
      {rubric.tieu_chi.map((tc) => {
        const id = `tc-${khoa}-${tc.ma}`;
        const cu = diemCu.get(tc.ma);
        return (
          <div key={tc.ma}>
            <Label htmlFor={id}>
              {tc.ten} (trọng số {tc.trong_so})
            </Label>
            <select
              id={id}
              name={`tc__${tc.ma}`}
              defaultValue={cu !== undefined ? String(cu) : ""}
              required
              className={inputClass}
            >
              <option value="" disabled>
                Chọn mức
              </option>
              {[...tc.muc]
                .sort((a, b) => a.diem - b.diem)
                .map((m) => (
                  <option key={m.diem} value={m.diem}>
                    {m.diem} điểm: {m.mo_ta || "(không mô tả)"}
                  </option>
                ))}
            </select>
          </div>
        );
      })}
      <div>
        <Label htmlFor={`nx-${khoa}`}>{nhanNhanXet}</Label>
        <textarea id={`nx-${khoa}`} name="nhan_xet" rows={2} className={cn(inputClass, "py-2")} />
      </div>
      <Button type="submit" disabled={busy} className="justify-self-start">
        {nhanNut}
      </Button>
    </Form>
  );
}
