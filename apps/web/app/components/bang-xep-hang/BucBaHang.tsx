/**
 * Bục ba hạng đầu của trang Bảng xếp hạng (routes/bang-xep-hang.tsx). Xếp 2 – 1 – 3, người hạng 1
 * đứng cao nhất, chữ số lớn nhất. Hạng càng cao thì thẻ càng nổi, theo ba nấc:
 *  - hạng 1: nền vàng cam đặc (màu nhấn --g-nhan), vòng sáng; bật lên có nảy, số hạng và XP bật ra,
 *    rồi một dải sáng quét qua thẻ một lần;
 *  - hạng 2: nền màu chính đặc; trượt lên có nảy nhẹ;
 *  - hạng 3: nền màu chính nhạt; trượt lên.
 * Bảng từ hạng 4 giữ nền trung tính, không có hoạt ảnh.
 *
 * Màu và hoạt ảnh vào xét theo số hạng, nên người đồng hạng giống nhau. Hiệu ứng trang trí (bật số,
 * dải sáng) chỉ ở ô đầu, để không quá 3 hoạt ảnh chạy cùng lúc (docs/VISUAL_STYLE.md §6.2). Mỗi hiệu
 * ứng dài nhất 800ms, cả chuỗi xong trong khoảng 1,7 giây, không lặp. Hoạt ảnh là CSS nên chạy đúng
 * từ lần vẽ đầu của HTML máy chủ; không dùng số chạy (SoChay) vì số cuối sẽ lóe trước khi hydrate.
 * Không dùng huy chương, sao hay vạch giống cấp hiệu (§1).
 */
import "../tro-choi/hieu-ung/tro-choi.css"; // keyframe g-vao-len, g-bat, g-hien, lớp .g-so
import "./buc-ba-hang.css";

import { type DongXepHang, diemXep, khoaDong, laCuaToi, laDongHang } from "../../lib/bang-xep-hang";
import { cn } from "../../lib/cn";
import type { BangXepHang } from "../../lib/diem-thuong";
import { useCaiDatGame } from "../tro-choi/hieu-ung/cai-dat";
import { ChipCap, NhanCuaToi } from "./NhanXepHang";

/** Cột của từng dòng: dòng đầu ở giữa, dòng hai bên trái, dòng ba bên phải (2 – 1 – 3). */
const COT = ["col-start-2", "col-start-1", "col-start-3"] as const;
/** Theo số hạng, không theo thứ tự dòng: đồng hạng thì đứng cao bằng nhau, chữ số cỡ bằng nhau. */
const DEM = { 1: "pt-0", 2: "pt-6", 3: "pt-10" } as const;
const CO_SO = { 1: "text-5xl", 2: "text-4xl", 3: "text-3xl" } as const;

export function BucBaHang({ bang, coDiem }: { bang: BangXepHang; coDiem: DongXepHang[] }) {
  const caNhan = bang.pham_vi === "don_vi";
  const { giamHieuUng } = useCaiDatGame();
  return (
    <section
      aria-labelledby="ba-hang-dau"
      data-giam-hieu-ung={giamHieuUng ? "1" : "0"}
      className="bxh-buc mt-6"
    >
      <h2 id="ba-hang-dau" className="sr-only">
        Ba hạng đầu
      </h2>
      {/* Đổi phạm vi hoặc kỳ thì dựng lại danh sách để hoạt ảnh chạy lại với dữ liệu mới. */}
      <ol key={`${bang.pham_vi}-${bang.ky}`} className="grid grid-cols-3 gap-2">
        {coDiem.slice(0, 3).map((d, i) => {
          const muc = Math.min(d.hang, 3) as 1 | 2 | 3;
          const laMinh = laCuaToi(bang, d);
          const trangTri = i === 0;
          return (
            <li
              key={khoaDong(d)}
              aria-current={laMinh ? "true" : undefined}
              className={cn("row-start-1 flex min-w-0 flex-col", COT[i], DEM[muc])}
            >
              <div
                className={cn(
                  "bxh-o bxh-a relative flex flex-1 flex-col items-center overflow-hidden rounded-xl px-1.5 pb-3 pt-2 text-center",
                  `bxh-o-${muc}`,
                  // Viền của mình vẽ ngoài thẻ, để vẫn thấy trên cả ba nền màu.
                  laMinh && "outline-2 outline-offset-2 outline-primary",
                )}
              >
                <span className="bxh-phu text-xs font-semibold">
                  {laDongHang(coDiem, i) ? "Đồng hạng" : "Hạng"}
                </span>
                <span
                  className={cn(
                    "g-so mt-0.5 font-bold leading-none",
                    CO_SO[muc],
                    trangTri && "bxh-t bxh-bat",
                  )}
                >
                  {d.hang}
                </span>
                <span className="mt-2 line-clamp-2 w-full break-words text-sm font-medium">{d.ten}</span>
                {laMinh ? <NhanCuaToi caNhan={caNhan} className="bxh-phu" /> : null}
                <span className="mt-auto flex flex-col items-center pt-2">
                  {caNhan && d.cap ? <ChipCap cap={d.cap} /> : null}
                  <span className={cn("g-so mt-1.5 font-semibold", trangTri && "bxh-t bxh-bat-xp")}>
                    {diemXep(bang, d).toLocaleString("vi-VN")}
                  </span>
                  <span className="bxh-phu text-xs">{caNhan ? "XP" : "XP/người"}</span>
                </span>
                {trangTri ? <span aria-hidden="true" className="bxh-t bxh-quet" /> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
