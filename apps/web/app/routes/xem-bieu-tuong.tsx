/**
 * Trang xem trước bộ biểu tượng `/xem-bieu-tuong` (docs/PROMPT_BO_ICON.md, Prompt 1 bước 7): lưới mọi
 * khóa của components/ui/Icon.tsx ở 16, 20, 24, 40px, ba kiểu vẽ, đặt cạnh nhau ở giao diện sáng và
 * tối, để soát hình và chụp ảnh trước/sau khi vẽ lại.
 *
 * Chỉ bật ở môi trường dev. Bản build chỉ mở khi đặt QDPL_XEM_BIEU_TUONG=1 (lượt chụp E2E
 * scripts/e2e/bieu-tuong.ts); không có trong menu, không gọi API.
 */
import { Icon, type IconName, sacCua, TEN_BIEU_TUONG } from "../components/ui/Icon";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/xem-bieu-tuong";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Xem trước bộ biểu tượng", { index: false });
}

export function loader() {
  if (!import.meta.env.DEV && process.env.QDPL_XEM_BIEU_TUONG !== "1")
    throw new Response("Không tìm thấy trang.", { status: 404 });
  return null;
}

const CO = [16, 20, 24, 40] as const;
const KIEU = ["hai-lop", "net", "dac"] as const;

function OBieuTuong({ ten }: { ten: IconName }) {
  return (
    <li className="rounded-card border border-line bg-surface p-3">
      <p className="mb-2 flex justify-between gap-2 font-mono text-xs text-ink-2">
        {ten}
        <span className="text-ink-3">{sacCua(ten)}</span>
      </p>
      <div className="flex flex-col gap-2">
        {KIEU.map((kieu) => (
          <div key={kieu} className="flex items-end gap-3" title={kieu}>
            {CO.map((co) => (
              <span key={co} className="grid place-items-center" style={{ width: co, height: co }}>
                <Icon name={ten} kieu={kieu} className="size-full" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </li>
  );
}

function BangGiaoDien({ theme, nhan }: { theme: "light" | "dark"; nhan: string }) {
  return (
    <section data-theme={theme} className="min-w-0 flex-1 rounded-card bg-canvas p-4 text-ink">
      <h2 className="mb-1 text-lg font-semibold">{nhan}</h2>
      <p className="mb-4 text-sm text-ink-2">
        Mỗi ô: ba dòng là ba kiểu hai lớp, chỉ nét, tô đặc; cỡ 16, 20, 24, 40px.
      </p>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-3">
        {TEN_BIEU_TUONG.map((ten) => (
          <OBieuTuong key={ten} ten={ten} />
        ))}
      </ul>
    </section>
  );
}

export default function XemBieuTuong() {
  return (
    <main className="wrap py-6">
      <h1 className="text-2xl font-semibold">Bộ biểu tượng ({TEN_BIEU_TUONG.length} khóa)</h1>
      <div className="mt-4 flex flex-col gap-4 lg:flex-row">
        <BangGiaoDien theme="light" nhan="Sáng" />
        <BangGiaoDien theme="dark" nhan="Tối" />
      </div>
    </main>
  );
}
