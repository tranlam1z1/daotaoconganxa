/**
 * Tổng kết cuối lượt (docs/PLAN.md GĐ-G0): sao, điểm, thưởng nhanh, XP nhận được, và từng bước
 * đúng/sai để xem lại. Hai nút: chơi lại (một chạm) và về danh sách trò chơi.
 *
 * Hiệu ứng kết thúc màn (docs/VISUAL_STYLE.md §3.2, hiệu ứng 9): thẻ trượt lên; sao lần lượt bật vào;
 * điểm chạy số từ 0, XP chạy sau điểm; đạt 3 sao thì bắn pháo hoa nhẹ. `hoatAnh = false` khi mở lại
 * một lượt đã xem (không chúc mừng lần hai).
 */
import { type ReactNode, useEffect } from "react";

import { cn } from "../../lib/cn";
import { loaiKetQua, tieuDeKetQua } from "../../lib/ket-qua-cau";
import { type LuotChoiWeb, moTaDiem } from "../../lib/luot-choi";
import { phatAm } from "./hieu-ung/am-thanh";
import { PhaoHoa } from "./hieu-ung/PhaoHoa";
import { SaoTongKet, TRE_MOI_SAO_MS } from "./hieu-ung/SaoTongKet";
import { SoChay } from "./hieu-ung/SoChay";
import { lopChuKetQua } from "./PhanHoiBuoc";

export function TongKetLuot({
  luot,
  hanhDong,
  hoatAnh = true,
}: {
  luot: LuotChoiWeb;
  hanhDong?: ReactNode;
  hoatAnh?: boolean;
}) {
  const tk = luot.tong_ket;
  const treDiem = 150 + (tk?.sao ?? 0) * TRE_MOI_SAO_MS;
  useEffect(() => {
    if (!hoatAnh || !tk) return;
    const t = setTimeout(() => phatAm("hoan_thanh"), treDiem + 800);
    return () => clearTimeout(t);
  }, [hoatAnh, tk, treDiem]);

  if (!tk) return null;
  const phanTram = Math.round(tk.ty_le * 100);
  const ms = hoatAnh ? 800 : 0;
  return (
    <section
      aria-labelledby="tong-ket"
      className={cn("g-the g-the-nhan p-5 text-center", hoatAnh && "g-a g-vao-len")}
    >
      {hoatAnh && tk.sao === 3 ? <PhaoHoa /> : null}
      <h2 id="tong-ket" className="sr-only">
        Kết quả lượt chơi
      </h2>
      <SaoTongKet so={tk.sao} hoatAnh={hoatAnh} />
      <p className="mt-3 text-4xl font-bold">
        {/* Tổng gồm cả thưởng nhanh, khớp số ghi ở bảng lịch sử chơi; dòng dưới tách điểm bài và thưởng. */}
        <SoChay den={Math.round((tk.diem + tk.thuong) * 10) / 10} ms={ms} treMs={treDiem} thapPhan={1} />
        <span className="g-so text-2xl text-ink-2">/{tk.diem_toi_da.toLocaleString("vi-VN")}</span>
      </p>
      <p className="mt-1 text-[15px] text-ink-2">
        Đúng {tk.so_dung}/{luot.so_buoc} · {phanTram}%
        {tk.thuong > 0
          ? ` · điểm bài ${tk.diem.toLocaleString("vi-VN")}, thưởng nhanh +${tk.thuong.toLocaleString("vi-VN")}`
          : ""}
      </p>
      <p className={cn("mt-3 text-lg font-semibold", tk.xp > 0 ? "text-primary" : "text-ink-2")}>
        {tk.xp > 0 ? (
          <>
            +<SoChay den={tk.xp} ms={hoatAnh ? 600 : 0} treMs={treDiem + 800} /> điểm kinh nghiệm
          </>
        ) : (
          "Lượt này không cộng điểm kinh nghiệm"
        )}
      </p>
      {luot.trang_thai === "het_gio" ? (
        <p className="mt-1 text-sm text-ink-2">Lượt kết thúc vì hết giờ.</p>
      ) : null}
      {hanhDong ? <div className="mt-5 grid gap-2">{hanhDong}</div> : null}
    </section>
  );
}

/** Danh sách các bước đã chơi: số bước, đúng/sai, điểm. Dùng ở màn xem lại. */
export function DanhSachBuoc({
  luot,
  chiTiet,
}: {
  luot: LuotChoiWeb;
  chiTiet: (thuTu: number) => ReactNode;
}) {
  return (
    <ol className="grid gap-3">
      {luot.da_choi.map((b) => (
        <li key={b.thu_tu} className="g-the p-4">
          <p className="flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold">Câu {b.thu_tu}</span>
            <span className={cn("font-semibold", lopChuKetQua(loaiKetQua(b.ket_qua)))}>
              {tieuDeKetQua(b.ket_qua)} · {moTaDiem(b.ket_qua.diem, b.ket_qua.diem_toi_da)}
            </span>
          </p>
          <div className="mt-3">{chiTiet(b.thu_tu)}</div>
        </li>
      ))}
    </ol>
  );
}
