import { Link, useFetcher } from "react-router";

import { type KetQuaThaoTacNhom, loiCua, type NhomTomTat, xongCua } from "../../lib/nhom";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Field";
import { HopThoai } from "../ui/HopThoai";

/**
 * Chia sẻ bài đang đọc vào một hoặc nhiều nhóm (docs/PLAN.md GĐ16b), mở từ trang bài học. Gửi tới
 * action của trang bài học; kết quả hiện theo từng nhóm, nhóm đã có bài này thì báo riêng.
 */
export function HopChiaSeBai({
  mo,
  onDong,
  nhom,
  lessonId,
}: {
  mo: boolean;
  onDong: () => void;
  nhom: NhomTomTat[];
  lessonId: string;
}) {
  const f = useFetcher<KetQuaThaoTacNhom>();
  const dangGui = f.state !== "idle";
  const loi = loiCua(f.data);
  const ketQua = xongCua(f.data)?.chiaSe;

  return (
    <HopThoai mo={mo} onDong={onDong} tieuDe="Chia sẻ vào nhóm">
      {ketQua ? (
        <div className="grid gap-3">
          <ul className="grid gap-2">
            {ketQua.map((k) => (
              <li key={k.id} className="rounded-btn border border-line px-3 py-2 text-base">
                <span className="font-medium">{k.ten}:</span>{" "}
                {k.ok ? "Đã chia sẻ." : <span className="text-danger">{k.loi}</span>}
              </li>
            ))}
          </ul>
          <Button size="lg" variant="secondary" onClick={onDong} className="w-full">
            Xong
          </Button>
        </div>
      ) : (
        <f.Form method="post" className="grid gap-4">
          <input type="hidden" name="intent" value="chia-se-nhom" />
          <input type="hidden" name="lesson_id" value={lessonId} />
          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-sm font-medium text-ink-2">Chọn nhóm</legend>
            {nhom.map((g) => (
              <label
                key={g.id}
                className="flex min-h-12 cursor-pointer items-center gap-3 rounded-btn border border-line px-3 py-2 text-base has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
              >
                <input type="checkbox" name="nhom" value={g.id} className="size-5 shrink-0" />
                <span className="min-w-0">
                  <span className="block font-medium">{g.ten}</span>
                  <span className="block text-sm text-ink-2">{g.so_thanh_vien} thành viên</span>
                </span>
              </label>
            ))}
          </fieldset>
          {loi ? <Notice tone="danger">{loi}</Notice> : null}
          <Button type="submit" size="lg" disabled={dangGui} className="w-full">
            {dangGui ? "Đang chia sẻ" : "Chia sẻ bài học"}
          </Button>
          <p className="text-center text-sm">
            <Link to="/nhom" className="inline-flex min-h-12 items-center text-ink-2 underline">
              Xem các nhóm của tôi
            </Link>
          </p>
        </f.Form>
      )}
    </HopThoai>
  );
}
