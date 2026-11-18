import { useFetcher } from "react-router";

import {
  type KetQuaThaoTacNhom,
  loiCua,
  type MucNhom,
  ngayVn,
  TEN_LOAI_MUC,
  TEN_TRANG_THAI_MUC,
} from "../../lib/nhom";
import { Button } from "../ui/Button";
import { ThanhPhanTram } from "./ThanhPhanTram";

/** Nút bắt đầu học một mục: bài học mở trang bài, đề ôn tập mở phiên làm đề. */
export function NutHocMuc({ muc, chinh = false, nhan }: { muc: MucNhom; chinh?: boolean; nhan?: string }) {
  const f = useFetcher<KetQuaThaoTacNhom>();
  const dangGui = f.state !== "idle";
  const loi = loiCua(f.data);
  return (
    <div>
      <f.Form method="post">
        <input type="hidden" name="intent" value="bat-dau" />
        <input type="hidden" name="item_id" value={muc.id} />
        <Button
          type="submit"
          size="lg"
          variant={chinh ? "primary" : "secondary"}
          disabled={dangGui}
          className="w-full py-2 sm:w-auto"
        >
          {/* Nhãn dài (tên bài) xuống dòng trong nút, không tràn ra ngoài. */}
          <span className="min-w-0 whitespace-normal break-words text-center">
            {dangGui ? "Đang mở" : (nhan ?? (muc.loai === "bai_hoc" ? "Học bài" : "Làm đề"))}
          </span>
        </Button>
      </f.Form>
      {loi ? (
        <p role="alert" className="mt-1 text-sm text-danger">
          {loi}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Các mục trong nhóm: tên, loại, hạn gợi ý, phần trăm của tôi, nút học. Trưởng nhóm, hoặc người đã
 * chia sẻ mục, có thêm nút "Tùy chọn" (sắp thứ tự, hạn gợi ý, gỡ mục).
 */
export function DanhSachMuc({
  muc,
  laTruongNhom,
  choGhi,
  onTuyChon,
}: {
  muc: MucNhom[];
  laTruongNhom: boolean;
  choGhi: boolean;
  onTuyChon: (m: MucNhom) => void;
}) {
  return (
    <ul className="grid gap-3">
      {muc.map((m) => {
        const coTuyChon = choGhi && (laTruongNhom || m.cua_toi);
        return (
          <li key={m.id} className="rounded-card border border-line bg-surface p-4">
            <p className="text-base font-semibold leading-snug">{m.ten}</p>
            <p className="mt-1 text-sm text-ink-2">
              {TEN_LOAI_MUC[m.loai]}
              {m.loai === "de_on_tap" && m.so_cau ? ` · ${m.so_cau} câu` : ""}
              {m.chu_de ? ` · ${m.chu_de}` : ""}
              {m.han_goi_y ? ` · Hạn gợi ý ${ngayVn(m.han_goi_y)}` : ""}
            </p>
            {m.trang_thai === "tinh" ? (
              <div className="mt-3">
                <ThanhPhanTram giaTri={m.phan_tram_cua_toi} nhan={`Tiến độ của tôi: ${m.ten}`} />
              </div>
            ) : (
              <p className="mt-3 text-sm text-warn">
                {TEN_TRANG_THAI_MUC[m.trang_thai]}. Mục này không tính vào tiến độ.
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-start gap-2">
              {m.trang_thai === "tinh" && choGhi ? <NutHocMuc muc={m} /> : null}
              {coTuyChon ? (
                <Button size="lg" variant="ghost" onClick={() => onTuyChon(m)}>
                  Tùy chọn
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
