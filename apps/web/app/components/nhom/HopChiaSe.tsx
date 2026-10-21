import { useEffect, useState } from "react";
import { useFetcher } from "react-router";

import { cn } from "../../lib/cn";
import {
  GIOI_HAN_NHAP,
  type KetQuaThaoTacNhom,
  type LoaiMucNhom,
  loiCua,
  type NguonBaiHoc,
  type NguonChuDe,
  TEN_LOAI_MUC,
  xongCua,
} from "../../lib/nhom";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { inputClass, Label, Notice } from "../ui/Field";
import { HopThoai } from "../ui/HopThoai";
import { KhungCho } from "../ui/KhungCho";

const lopLuaChon =
  "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2 text-base has-[:checked]:border-primary has-[:checked]:bg-primary-soft";

/**
 * Chia sẻ vào nhóm, mở từ trong nhóm (docs/PLAN.md GĐ16b). Bài học: tìm và chọn một bài đã xuất
 * bản. Đề ôn tập: chọn chủ đề có từ 5 câu đã duyệt, số câu 5–20, đặt tên đề.
 */
export function HopChiaSe({ mo, onDong, nhomId }: { mo: boolean; onDong: () => void; nhomId: string }) {
  const [loai, datLoai] = useState<LoaiMucNhom>("bai_hoc");
  const [tim, datTim] = useState("");
  const bai = useFetcher<{ items: NguonBaiHoc[] }>();
  const chuDe = useFetcher<{ items: NguonChuDe[] }>();
  const gui = useFetcher<KetQuaThaoTacNhom>();
  const dangGui = gui.state !== "idle";
  const loi = loiCua(gui.data);

  // Tải danh sách khi mở hộp và khi đổi loại.
  const taiBai = bai.load;
  const taiChuDe = chuDe.load;
  useEffect(() => {
    if (!mo) return;
    if (loai === "bai_hoc") taiBai(`/nhom/nguon?loai=bai_hoc&q=`);
    else taiChuDe(`/nhom/nguon?loai=chu_de&q=`);
  }, [mo, loai, taiBai, taiChuDe]);

  useEffect(() => {
    if (gui.state === "idle" && xongCua(gui.data)) onDong();
  }, [gui.state, gui.data, onDong]);

  const dsBai = bai.data?.items ?? [];
  const dsChuDe = chuDe.data?.items ?? [];

  return (
    <HopThoai mo={mo} onDong={onDong} tieuDe="Chia sẻ vào nhóm">
      <div className="grid gap-4">
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="mb-1.5 text-sm font-medium text-ink-2">Loại</legend>
          {(["bai_hoc", "de_on_tap"] as const).map((l) => (
            <label key={l} className={lopLuaChon}>
              <input
                type="radio"
                name="loai-chia-se"
                value={l}
                checked={loai === l}
                onChange={() => datLoai(l)}
                className="size-5"
              />
              {TEN_LOAI_MUC[l]}
            </label>
          ))}
        </fieldset>

        {loai === "bai_hoc" ? (
          <>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                bai.load(`/nhom/nguon?loai=bai_hoc&q=${encodeURIComponent(tim)}`);
              }}
            >
              <label htmlFor="tim-bai" className="sr-only">
                Tìm bài học theo tên
              </label>
              <input
                id="tim-bai"
                type="search"
                value={tim}
                onChange={(e) => datTim(e.target.value)}
                placeholder="Tên bài hoặc chuyên đề"
                className={cn(inputClass, "min-h-12")}
              />
              <Button type="submit" size="lg" variant="secondary">
                Tìm
              </Button>
            </form>
            <gui.Form method="post" action={`/nhom/${nhomId}`} className="grid gap-3">
              <input type="hidden" name="intent" value="chia-se-bai" />
              {bai.state === "loading" && !dsBai.length ? (
                <KhungCho nhan="Đang tải danh sách bài." dong={4} />
              ) : dsBai.length ? (
                /* auto-rows-max: lưới có max-h thì Chrome co hàng về min-h-12 của lựa chọn cho vừa khung,
                   tên bài dài hai ba dòng tràn đè lên nhau; giữ hàng cao theo chữ và để khung cuộn. */
                <fieldset className="grid max-h-72 auto-rows-max gap-2 overflow-y-auto">
                  <legend className="sr-only">Chọn bài học</legend>
                  {dsBai.map((b) => (
                    <label key={b.id} className={lopLuaChon}>
                      <input
                        type="radio"
                        name="lesson_id"
                        value={b.id}
                        required
                        className="size-5 shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="block font-medium">{b.ten}</span>
                        <span className="block text-sm text-ink-2">
                          {b.chuyen_de} · khoảng {b.so_phut} phút
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              ) : (
                <EmptyState gon icon="search" title="Không có bài đã xuất bản khớp với từ tìm" />
              )}
              {loi ? <Notice tone="danger">{loi}</Notice> : null}
              <Button type="submit" size="lg" disabled={dangGui || !dsBai.length} className="w-full">
                {dangGui ? "Đang chia sẻ" : "Chia sẻ bài học"}
              </Button>
            </gui.Form>
          </>
        ) : (
          <gui.Form method="post" action={`/nhom/${nhomId}`} className="grid gap-4">
            <input type="hidden" name="intent" value="chia-se-de" />
            <div>
              <Label htmlFor="chu-de-de">Chủ đề</Label>
              <select id="chu-de-de" name="topic_id" required className={cn(inputClass, "min-h-12")}>
                {dsChuDe.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.ten} ({t.so_cau} câu)
                  </option>
                ))}
              </select>
              {chuDe.state === "idle" && !dsChuDe.length ? (
                <p className="mt-1 text-sm text-ink-2">Chưa có chủ đề nào có từ 5 câu đã duyệt.</p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="so-cau-de">
                Số câu ({GIOI_HAN_NHAP.soCau.toiThieu} đến {GIOI_HAN_NHAP.soCau.toiDa})
              </Label>
              <input
                id="so-cau-de"
                name="so_cau"
                type="number"
                inputMode="numeric"
                required
                min={GIOI_HAN_NHAP.soCau.toiThieu}
                max={GIOI_HAN_NHAP.soCau.toiDa}
                defaultValue={GIOI_HAN_NHAP.soCau.macDinh}
                className={cn(inputClass, "min-h-12")}
              />
            </div>
            <div>
              <Label htmlFor="ten-de">Tên đề</Label>
              <input
                id="ten-de"
                name="ten"
                required
                minLength={GIOI_HAN_NHAP.tenDe.toiThieu}
                maxLength={GIOI_HAN_NHAP.tenDe.toiDa}
                autoComplete="off"
                className={cn(inputClass, "min-h-12")}
              />
            </div>
            <p className="text-sm text-ink-2">
              Câu hỏi được chọn và chốt lúc chia sẻ, mọi thành viên làm cùng một bộ câu.
            </p>
            {loi ? <Notice tone="danger">{loi}</Notice> : null}
            <Button type="submit" size="lg" disabled={dangGui || !dsChuDe.length} className="w-full">
              {dangGui ? "Đang chia sẻ" : "Chia sẻ đề ôn tập"}
            </Button>
          </gui.Form>
        )}
      </div>
    </HopThoai>
  );
}
