/**
 * Chuyển đổi địa giới hành chính: chọn cách tra (nhập đơn vị cũ, vị trí GPS, địa chỉ cụ thể, tra ngược
 * từ xã mới). Khai riêng trong routes.ts nên thắng route chung cong-cu/:ma.
 */
import { NutLichSuDiaGioi, TheLuaChon } from "../components/dia-gioi/ChungDiaGioi";
import { Icon } from "../components/ui/Icon";
import { KhungTrang } from "../components/ui/KhungTrang";
import { DUONG_DIA_GIOI } from "../lib/dia-gioi";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/cong-cu.dia-gioi._index";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Chuyển đổi địa giới hành chính", {
    description:
      "Chuyển địa chỉ theo đơn vị hành chính cũ sang địa giới hành chính mới, tra ngược từ xã, phường mới.",
  });
}

const CACH_TRA = [
  {
    to: `${DUONG_DIA_GIOI}/thu-cong`,
    icon: "map",
    ten: "Chuyển đổi thủ công",
    moTa: "Chọn tỉnh/thành phố, quận/huyện, phường/xã cũ để chuyển sang địa giới hành chính mới.",
  },
  {
    to: `${DUONG_DIA_GIOI}/vi-tri`,
    icon: "dinhVi",
    ten: "Lấy vị trí hiện tại",
    moTa: "Dùng GPS của điện thoại để xác định địa chỉ hiện tại theo địa giới hành chính mới.",
  },
  {
    to: `${DUONG_DIA_GIOI}/dia-chi`,
    icon: "ghim",
    ten: "Tra cứu theo địa chỉ cụ thể",
    moTa: "Nhập số nhà, tên đường, phường/xã để tra địa chỉ theo địa giới hành chính mới.",
  },
  {
    to: `${DUONG_DIA_GIOI}/tra-nguoc`,
    icon: "turn",
    ten: "Tra ngược từ xã, phường mới",
    moTa: "Chọn xã, phường hiện nay để biết các xã, phường cũ đã nhập vào.",
  },
] as const;

export default function DiaGioiHanhChinh() {
  return (
    <KhungTrang className="wrap max-w-5xl py-6 sm:py-10">
      <header className="tra-cuu-tieu-de relative isolate mb-6 flex min-h-20 items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <Icon name="map" kieu="net" className="size-6" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight">Chuyển đổi địa giới hành chính</h1>
          <p className="mt-1 text-sm text-ink-2">
            Chọn cách tra cứu phù hợp để chuẩn hóa địa chỉ theo địa giới hành chính mới.
          </p>
        </div>
      </header>

      <div className="mt-4 flex justify-end">
        <NutLichSuDiaGioi className="-mr-2" />
      </div>
      <ul className="mt-1 grid gap-3 md:grid-cols-2">
        {CACH_TRA.map((c) => (
          <li key={c.to}>
            <TheLuaChon {...c} />
          </li>
        ))}
      </ul>

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-line bg-primary-soft p-4 text-base leading-relaxed text-primary">
        <Icon name="shield" className="mt-0.5 size-7 shrink-0" />
        <p>Thông tin tra cứu chỉ phục vụ nghiệp vụ chuẩn hóa địa chỉ theo địa giới hành chính mới.</p>
      </div>
      <p className="mt-4 text-center text-sm text-ink-2">
        Hệ thống chỉ lấy vị trí khi bạn bấm Lấy vị trí hiện tại và không lưu vị trí.
      </p>
    </KhungTrang>
  );
}
