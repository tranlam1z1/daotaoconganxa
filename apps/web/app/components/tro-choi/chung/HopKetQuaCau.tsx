/**
 * Hộp kết quả đúng/sai sau khi chốt một câu (docs/PLAN.md GĐ17a, docs/PROMPT_HOP_KET_QUA_TRO_CHOI.md
 * mục 2.1–2.6). Dựng trên hộp thoại dùng chung `HopThoai`, không sửa hộp đó.
 *
 * - Tên hộp là tiêu đề kết quả: "Đúng", "Chưa đúng", "Đúng một phần" (H6) hoặc "Hết giờ".
 * - Dấu kết quả, dòng điểm (khi có điểm), đồng hồ cả lượt (khi có, H2), đáp án đúng một dòng (khi có).
 * - "Xem chi tiết" thu gọn mỗi lần hộp mở (H9): phần chi tiết đặt `key` theo lần mở.
 * - Nút chính ở vùng nút đáy hộp, nhận tiêu điểm khi hộp mở (đề xuất Đ1: `showModal()` tự đặt tiêu
 *   điểm vào nút "Đóng", nên hộp chuyển tiêu điểm sau đó).
 * - Âm thanh và rung một lần, khi hộp mở lần đầu với kết quả vừa chấm (`phat`). Mở lại không phát.
 * - Công tắc "Giảm hiệu ứng" của trò chơi tắt hiệu ứng trượt của hộp (đề xuất Đ3); giảm chuyển động
 *   của hệ điều hành đã được `HopThoai` xử lý.
 */
import { type ReactNode, useEffect, useRef, useState } from "react";

import { type KetQuaHienThi, loaiKetQua, phutGiay, tieuDeKetQua } from "../../../lib/ket-qua-cau";
import { Button } from "../../ui/Button";
import { HopThoai } from "../../ui/HopThoai";
import { DauKetQua, DongDiem, phatKetQua } from "../PhanHoiBuoc";
import { ChiTietKetQua } from "./ChiTietKetQua";

export function HopKetQuaCau({
  mo,
  lanMo,
  onDong,
  ketQua,
  nutChinh,
  coMang = true,
  phat = true,
  dapAn,
  hetLuotLuc,
  chiTietRieng,
  dongDiem,
}: {
  mo: boolean;
  /** Tăng mỗi lần mở hộp: phần chi tiết thu gọn lại. */
  lanMo: number;
  onDong: () => void;
  ketQua: KetQuaHienThi;
  /** Nút đi tiếp ("Câu tiếp", nhãn riêng của trò, hoặc biểu mẫu "Xem kết quả"). */
  nutChinh: ReactNode;
  coMang?: boolean;
  /** Kết quả vừa chấm: phát âm thanh, rung một lần khi hộp mở lần đầu. */
  phat?: boolean;
  /** Đáp án đúng viết một dòng, chỉ hiện khi chưa đúng (Đ9). */
  dapAn?: string | null;
  /** Mốc hết giờ cả lượt (Date.now() + thời gian còn lại lúc mở bước), để hiện giờ còn lại (Đ4). */
  hetLuotLuc?: number | null;
  chiTietRieng?: ReactNode;
  /**
   * Dòng riêng của trò đặt cạnh dấu kết quả, thay cho dòng "Điểm: x/y" (GĐ17b, Ghép cặp: "Đúng x/y
   * cặp"). Không truyền thì hộp như cũ.
   */
  dongDiem?: ReactNode;
}) {
  const vungNut = useRef<HTMLDivElement>(null);
  const daPhat = useRef(false);
  const loai = loaiKetQua(ketQua);
  const coDiem = ketQua.diem !== undefined && ketQua.diem_toi_da !== undefined;

  // Chạy sau effect của HopThoai (component con), tức sau showModal().
  // biome-ignore lint/correctness/useExhaustiveDependencies: chỉ khi hộp mở hoặc mở lại
  useEffect(() => {
    if (!mo) return;
    vungNut.current?.querySelector<HTMLElement>("a[href], button:not([disabled])")?.focus();
    if (phat && !daPhat.current) {
      daPhat.current = true;
      phatKetQua(ketQua);
    }
  }, [mo, lanMo]);

  return (
    <HopThoai
      mo={mo}
      tieuDe={tieuDeKetQua(ketQua)}
      onDong={onDong}
      className="in-data-[giam-hieu-ung=1]:transition-none!"
      hanhDong={
        <div ref={vungNut} className="contents">
          {nutChinh}
        </div>
      }
    >
      <div className="space-y-3">
        {dongDiem ? (
          <div className="flex items-center gap-3">
            <DauKetQua loai={loai} />
            <div className="min-w-0 flex-1 text-base text-ink-2">{dongDiem}</div>
          </div>
        ) : coDiem ? (
          <DongDiem
            kq={{
              dung: ketQua.dung,
              het_gio: Boolean(ketQua.het_gio),
              diem: ketQua.diem!,
              diem_toi_da: ketQua.diem_toi_da!,
              thuong: ketQua.thuong ?? 0,
            }}
            hoatAnh
            anTieuDe
          />
        ) : (
          <DauKetQua loai={loai} />
        )}
        {hetLuotLuc ? <GioConLai hetLuc={hetLuotLuc} chay={mo} /> : null}
        {dapAn && loai !== "dung" ? (
          <p className="text-base">
            Đáp án: <span className="font-semibold">{dapAn}</span>
          </p>
        ) : null}
        <ChiTietKetQua key={lanMo} ketQua={ketQua} coMang={coMang} chiTietRieng={chiTietRieng} cuonTrong />
      </div>
    </HopThoai>
  );
}

/**
 * Giờ còn lại của cả lượt, chỉ để xem (đề xuất Đ4): tính từ cùng mốc với đồng hồ ở đầu trang, không
 * âm thanh, không báo đọc, không tự chốt lượt. Đồng hồ ở đầu trang vẫn là nơi duy nhất xử lý hết giờ.
 */
function GioConLai({ hetLuc, chay }: { hetLuc: number; chay: boolean }) {
  const [bayGio, datBayGio] = useState(() => Date.now());
  useEffect(() => {
    if (!chay) return;
    datBayGio(Date.now());
    const t = setInterval(() => datBayGio(Date.now()), 250);
    return () => clearInterval(t);
  }, [chay]);
  return (
    <p className="text-base text-ink-2">
      Thời gian còn lại của lượt:{" "}
      <span data-gio-con-lai="" className="g-so font-semibold text-ink">
        {phutGiay(hetLuc - bayGio)}
      </span>
    </p>
  );
}

/**
 * Nút "Xem lại kết quả" ở đáy trang khi hộp đã đóng (H11). `layTieuDiem`: vừa đóng hộp bằng X hoặc Esc
 * thì nhận tiêu điểm (đề xuất Đ7; chạy sau lệnh trả tiêu điểm của HopThoai).
 */
export function NutXemLaiKetQua({ onClick, layTieuDiem }: { onClick: () => void; layTieuDiem: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: chỉ lúc nút hiện ra
  useEffect(() => {
    if (layTieuDiem) ref.current?.focus();
  }, []);
  return (
    <Button ref={ref} variant="secondary" className="g-nut min-h-12 w-full text-base" onClick={onClick}>
      Xem lại kết quả
    </Button>
  );
}
