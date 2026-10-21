/**
 * Phản hồi sau khi một bước được chấm (docs/PLAN.md GĐ-G0): đúng/sai hoặc hết giờ, điểm, rồi giải
 * thích và căn cứ thu gọn sau nút "Xem chi tiết" (GĐ17a). Có mạng thì căn cứ mở rộng nguyên văn tại
 * chỗ; không có mạng thì chỉ nêu tên điều khoản.
 *
 * Từ GĐ17a, trang chơi báo kết quả vừa chấm bằng hộp (chung/HopKetQuaCau.tsx), dựng từ các mảnh ở tệp
 * này. `PhanHoiBuoc` còn dùng cho màn "Xem lại từng câu" (tĩnh, H10) và trang duyệt hiệu ứng.
 *
 * Hiệu ứng (docs/VISUAL_STYLE.md §3.2, hiệu ứng 2, 3, 8): dấu tích hoặc dấu chéo vẽ nét, điểm "+N"
 * bay lên, âm thanh và rung một lần khi phản hồi hiện ra. Nghĩa luôn có cả chữ ("Đúng", "Chưa đúng",
 * "Đúng một phần", "Hết giờ"), không chỉ nằm ở màu. `hoatAnh = false` ở màn xem lại: tĩnh, không âm
 * thanh.
 */
import { useEffect } from "react";

import { cn } from "../../lib/cn";
import { type KetQuaHienThi, type LoaiKetQua, loaiKetQua, TIEU_DE_KET_QUA } from "../../lib/ket-qua-cau";
import { type KetQuaBuocWeb, moTaDiem } from "../../lib/luot-choi";
import { ChiTietKetQua } from "./chung/ChiTietKetQua";
import { phatAm } from "./hieu-ung/am-thanh";
import { rung } from "./hieu-ung/rung";

/** Màu nền của dấu và màu chữ của tiêu đề theo loại kết quả; "Đúng một phần" dùng màu cảnh báo (H6). */
const MAU: Record<LoaiKetQua, { nen: string; chu: string }> = {
  dung: { nen: "var(--ok)", chu: "text-ok" },
  mot_phan: { nen: "var(--warn)", chu: "text-warn" },
  chua_dung: { nen: "var(--danger)", chu: "text-danger" },
  het_gio: { nen: "var(--danger)", chu: "text-danger" },
};

export function lopChuKetQua(loai: LoaiKetQua): string {
  return MAU[loai].chu;
}

/** Âm thanh và rung một lần cho một kết quả (hết giờ đã có âm báo riêng ở đồng hồ). */
export function phatKetQua(kq: Pick<KetQuaHienThi, "dung" | "het_gio" | "diem" | "diem_toi_da">): void {
  const loai = loaiKetQua(kq);
  if (loai === "het_gio") return;
  phatAm(loai === "dung" ? "dung" : "sai");
  rung(loai === "dung" ? "dung" : "sai");
}

/**
 * Dấu tích hoặc dấu chéo vẽ nét trong vòng tròn màu trạng thái. "Đúng một phần" là dấu tích màu cảnh
 * báo (H6); "Hết giờ" là dấu chéo.
 */
export function DauKetQua({ loai, hoatAnh = true }: { loai: LoaiKetQua; hoatAnh?: boolean }) {
  const tich = loai === "dung" || loai === "mot_phan";
  return (
    <span
      aria-hidden="true"
      className={cn("grid size-10 shrink-0 place-items-center rounded-full", hoatAnh && "g-a g-bat")}
      style={{ background: MAU[loai].nen, color: "var(--surface)" }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {tich ? (
          <path
            d="m5 12.5 4.5 4.5L19 7.5"
            className={cn(hoatAnh && "g-t g-ve-net")}
            style={{ "--g-dai-net": 22 } as React.CSSProperties}
          />
        ) : (
          <path
            d="M7 7l10 10M17 7 7 17"
            className={cn(hoatAnh && "g-t g-ve-net")}
            style={{ "--g-dai-net": 30 } as React.CSSProperties}
          />
        )}
      </svg>
    </span>
  );
}

type DiemBuoc = Pick<KetQuaBuocWeb, "dung" | "het_gio" | "diem" | "diem_toi_da" | "thuong">;

/**
 * Dấu kết quả, tiêu đề, điểm và thưởng nhanh. Trong hộp kết quả, tiêu đề đã là tên hộp nên bỏ
 * (`anTieuDe`).
 */
export function DongDiem({
  kq,
  hoatAnh,
  anTieuDe = false,
}: {
  kq: DiemBuoc;
  hoatAnh: boolean;
  anTieuDe?: boolean;
}) {
  const loai = loaiKetQua(kq);
  const cong = kq.diem + kq.thuong;
  return (
    <div className={cn("relative flex items-center gap-3", hoatAnh && "g-a g-vao-len")}>
      <DauKetQua loai={loai} hoatAnh={hoatAnh} />
      <div className="min-w-0 flex-1">
        {anTieuDe ? null : (
          <p className={cn("g-tieu-de text-lg font-semibold", MAU[loai].chu)}>{TIEU_DE_KET_QUA[loai]}</p>
        )}
        <p className={cn(anTieuDe ? "text-base" : "text-[15px]", "text-ink-2")}>
          {kq.het_gio ? "Câu trả lời gửi sau thời gian cho phép nên không tính điểm. " : ""}
          Điểm: <span className="g-so font-semibold text-ink">{moTaDiem(kq.diem, kq.diem_toi_da)}</span>
          {kq.thuong > 0 ? (
            <>
              {" "}
              · thưởng nhanh{" "}
              <span className="g-so font-semibold text-ok">+{kq.thuong.toLocaleString("vi-VN")}</span>
            </>
          ) : null}
        </p>
      </div>
      {hoatAnh && cong > 0 ? (
        <span
          aria-hidden="true"
          className="g-t g-bay-len g-so pointer-events-none absolute right-0 -top-2 text-2xl font-bold"
          style={{ color: "var(--g-nhan)" }}
        >
          +{cong.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Phản hồi tại chỗ, không có hộp: dòng điểm và "Xem chi tiết" thu gọn. Màn "Xem lại từng câu" dùng bản
 * tĩnh (`hoatAnh = false`, H10).
 */
export function PhanHoiBuoc({
  ketQua,
  coMang = true,
  hoatAnh = true,
}: {
  ketQua: KetQuaBuocWeb;
  coMang?: boolean;
  hoatAnh?: boolean;
}) {
  // Âm thanh và rung một lần khi phản hồi hiện ra.
  // biome-ignore lint/correctness/useExhaustiveDependencies: chỉ phát khi kết quả đổi
  useEffect(() => {
    if (hoatAnh) phatKetQua(ketQua);
  }, [hoatAnh, ketQua.dung, ketQua.het_gio, ketQua.diem]);

  return (
    <div className="space-y-3">
      <DongDiem kq={ketQua} hoatAnh={hoatAnh} />
      <ChiTietKetQua ketQua={ketQua} coMang={coMang} />
    </div>
  );
}
