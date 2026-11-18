import { Link, useFetcher } from "react-router";

import { cn } from "../../lib/cn";
import { CAU_QUYEN_RIENG_TU, type KetQuaThaoTacNhom, loiCua, xongCua } from "../../lib/nhom";
import { Button, buttonClass } from "../ui/Button";
import { inputClass, Label, Notice } from "../ui/Field";
import { HopThoai } from "../ui/HopThoai";

/**
 * Tham gia nhóm bằng mã mời: nhập mã, xem trước tên nhóm và số thành viên, rồi bấm "Tham gia nhóm".
 * Hộp nêu rõ thành viên khác thấy gì của bạn (câu N4).
 */
export function HopThamGia({ mo, onDong }: { mo: boolean; onDong: () => void }) {
  const xem = useFetcher<KetQuaThaoTacNhom>();
  const vao = useFetcher<KetQuaThaoTacNhom>();
  const xemTruoc = xongCua(xem.data)?.xemTruoc;
  const loi = loiCua(vao.data) ?? loiCua(xem.data);

  return (
    <HopThoai mo={mo} onDong={onDong} tieuDe="Tham gia nhóm">
      <div className="grid gap-4">
        <xem.Form method="post" className="grid gap-2">
          <input type="hidden" name="intent" value="xem-truoc" />
          <Label htmlFor="ma-moi">Mã mời</Label>
          <div className="flex gap-2">
            <input
              id="ma-moi"
              name="ma"
              required
              maxLength={20}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className={cn(inputClass, "min-h-12 font-mono uppercase tracking-widest")}
            />
            <Button type="submit" size="lg" variant="secondary" disabled={xem.state !== "idle"}>
              Xem nhóm
            </Button>
          </div>
        </xem.Form>

        {loi ? <Notice tone="danger">{loi}</Notice> : null}

        {xemTruoc ? (
          <div className="grid gap-3 rounded-card border border-line bg-surface-2 p-4">
            <div>
              <p className="text-base font-semibold">{xemTruoc.ten}</p>
              <p className="text-sm text-ink-2">
                Trưởng nhóm: {xemTruoc.truong_nhom} · {xemTruoc.so_thanh_vien} thành viên
              </p>
            </div>
            {xemTruoc.da_la_thanh_vien ? (
              <Link
                to={`/nhom/${xemTruoc.id}`}
                className={buttonClass({ size: "lg", className: "w-full py-2" })}
              >
                <span className="whitespace-normal text-center">Bạn đã ở trong nhóm này. Mở nhóm</span>
              </Link>
            ) : xemTruoc.trang_thai === "luu_tru" ? (
              <p className="text-sm text-ink-2">Nhóm đã lưu trữ, không nhận thêm thành viên.</p>
            ) : (
              <vao.Form method="post" className="grid gap-3">
                <input type="hidden" name="intent" value="tham-gia" />
                <input type="hidden" name="ma" value={xongCua(xem.data)?.ma ?? ""} />
                <p className="text-base leading-relaxed text-ink-2">{CAU_QUYEN_RIENG_TU}</p>
                <Button type="submit" size="lg" disabled={vao.state !== "idle"} className="w-full">
                  {vao.state !== "idle" ? "Đang tham gia" : "Tham gia nhóm"}
                </Button>
              </vao.Form>
            )}
          </div>
        ) : null}
      </div>
    </HopThoai>
  );
}
