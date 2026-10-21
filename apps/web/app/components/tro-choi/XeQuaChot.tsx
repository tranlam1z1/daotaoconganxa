/**
 * Thẻ một xe đi qua chốt (trò "Súng bắn tốc độ", docs/PLAN.md GĐ-G2): loại xe, bối cảnh, biển
 * hạn chế tốc độ P.127 và tốc độ đo được in lớn.
 *
 * Biển P.127 vẽ bằng SVG đơn giản. Ảnh xe cắt từ bộ ảnh tạo theo docs/PROMPT_NHAN_VAT_XE.md §6.
 */
import { useState } from "react";

import { cn } from "../../lib/cn";
import { phatAm } from "./hieu-ung/am-thanh";
import { SoChay } from "./hieu-ung/SoChay";

export interface DeSungBanWeb {
  loai_xe: "o_to" | "mo_to";
  ten_loai_xe: string;
  mo_ta_xe: string;
  boi_canh: string;
  bien_toc_do: number;
  toc_do_do: number;
  lua_chon_khung: Array<{ id: string; text: string }>;
  lua_chon_bo_sung: Array<{ id: string; text: string }>;
}

/** Biển P.127 tạm: vòng tròn viền đỏ, số km/h ở giữa. */
export function BienP127({ so, className }: { so: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={`Biển tốc độ tối đa cho phép ${so} km/h`}
      className={className}
    >
      <circle cx="50" cy="50" r="46" fill="#fff" stroke="#d6211f" strokeWidth="10" />
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Arial, sans-serif"
        fontWeight="700"
        fontSize={so >= 100 ? 34 : 42}
        fill="#111"
      >
        {so}
      </text>
    </svg>
  );
}

/**
 * Ảnh xe: WebP 273 × 178 trong app/assets/tro-choi/sung-ban-toc-do/, tên tệp theo loại và màu
 * (`o-to-con-trang`, `gan-may-do`, `phan-khoi-lon`…). Mọi xe quay đầu sang phải, cùng hướng xe lao vào.
 */
const ANH_XE = import.meta.glob<string>("../../assets/tro-choi/sung-ban-toc-do/*.webp", {
  eager: true,
  import: "default",
});
const anhXe = (ten: string) => ANH_XE[`../../assets/tro-choi/sung-ban-toc-do/${ten}.webp`];

const MAU_XE: Record<string, string> = {
  trắng: "trang",
  đen: "den",
  bạc: "bac",
  xanh: "xanh",
  đỏ: "do",
  xám: "xam",
  vàng: "vang",
};

/**
 * Chọn ảnh theo mô tả xe do người soạn nhập ("Xe ô tô con màu trắng", "Xe gắn máy màu đỏ"…).
 * Không có ảnh đúng màu thì lấy ảnh cùng dáng xe, cuối cùng là ô tô con bạc hoặc mô tô đen.
 */
function chonAnhXe(loai: "o_to" | "mo_to", moTa: string): string {
  const s = moTa.toLowerCase();
  const mau = MAU_XE[s.match(/màu (trắng|đen|bạc|xanh|đỏ|xám|vàng)/u)?.[1] ?? ""];
  const thu: string[] = [];
  if (loai === "o_to") {
    if (s.includes("bán tải")) thu.push(mau === "den" ? "ban-tai-den" : "ban-tai");
    else if (s.includes("khách")) thu.push("khach-nho");
    else if (s.includes("tải")) thu.push("tai-nhe");
    else if (mau) thu.push(`o-to-con-${mau}`);
    thu.push("o-to-con-bac");
  } else {
    if (s.includes("phân khối lớn")) thu.push("phan-khoi-lon");
    if (mau && s.includes("gắn máy")) thu.push(`gan-may-${mau}`);
    if (mau) thu.push(`mo-to-${mau}`, `gan-may-${mau}`);
    thu.push("mo-to-den");
  }
  for (const ten of thu) {
    const url = anhXe(ten);
    if (url) return url;
  }
  throw new Error("Thiếu ảnh xe mặc định trong assets/tro-choi/sung-ban-toc-do.");
}

/**
 * Hai hiệu ứng riêng của trò (đã duyệt, docs/VISUAL_STYLE.md §3.4):
 *  - xe lao từ trái vào trong 450ms, phía sau có vệt chuyển động mờ dần;
 *  - số tốc độ chạy từ 0 lên trong 500ms như màn hình máy đo, rồi "khóa": viền lóe một lần, số
 *    chuyển đỏ nếu vượt số trên biển, kèm tiếng bíp (khi bật âm thanh).
 * Giảm chuyển động: xe hiện tĩnh, số hiện ngay, không lóe viền.
 */
export function XeQuaChot({
  de,
  tinh = false,
}: {
  de: DeSungBanWeb /** Màn xem lại: không hoạt ảnh. */;
  tinh?: boolean;
}) {
  const vuot = de.toc_do_do > de.bien_toc_do;
  const [daKhoa, datDaKhoa] = useState(false);
  return (
    <div className="g-the overflow-hidden p-4">
      <p className="text-sm text-ink-2">{de.boi_canh}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="relative block w-full max-w-56">
            <span
              aria-hidden="true"
              className={cn(
                tinh ? "hidden" : "g-t g-vet g-an-khi-giam",
                "absolute top-1/2 right-full h-6 w-24 -translate-y-1/2 rounded-full",
              )}
              style={{ background: "linear-gradient(90deg, transparent, var(--line-strong))" }}
            />
            <span className={cn("block", !tinh && "g-a g-xe-lao")}>
              <img
                src={chonAnhXe(de.loai_xe, de.mo_ta_xe)}
                alt=""
                width={273}
                height={178}
                decoding="async"
                className="block h-auto w-full rounded-lg"
              />
            </span>
          </span>
          <p className="mt-1 text-base font-medium">{de.mo_ta_xe}</p>
          <p className="text-sm text-ink-2">{de.ten_loai_xe}</p>
        </div>
        <BienP127 so={de.bien_toc_do} className={cn("size-20 shrink-0", !tinh && "g-a g-hien")} />
      </div>
      <div className="relative mt-4 overflow-hidden rounded-lg bg-surface-2 px-4 py-3 text-center">
        {daKhoa ? (
          <span
            aria-hidden="true"
            className="g-t g-loe pointer-events-none absolute inset-0 rounded-lg"
            style={{ boxShadow: `inset 0 0 0 3px ${vuot ? "var(--danger)" : "var(--primary)"}` }}
          />
        ) : null}
        <p className="text-sm text-ink-2">Súng bắn tốc độ đo được</p>
        <p className={cn("g-so text-5xl font-semibold", daKhoa && vuot ? "text-danger" : "text-ink")}>
          <SoChay
            den={de.toc_do_do}
            ms={tinh ? 0 : 500}
            treMs={250}
            thapPhan={1}
            onXong={() => {
              datDaKhoa(true);
              if (!tinh) phatAm("bip");
            }}
          />
          <span className="ml-1 text-2xl">km/h</span>
        </p>
      </div>
    </div>
  );
}
