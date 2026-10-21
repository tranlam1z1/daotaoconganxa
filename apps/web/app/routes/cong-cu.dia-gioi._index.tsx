/**
 * Chuyển đổi địa giới hành chính: chọn cách tra (nhập đơn vị cũ, vị trí GPS, địa chỉ cụ thể, tra ngược
 * từ xã mới). Khai riêng trong routes.ts nên thắng route chung cong-cu/:ma.
 */
import { Link } from "react-router";

import { NutLichSuDiaGioi, TheLuaChon } from "../components/dia-gioi/ChungDiaGioi";
import { Icon } from "../components/ui/Icon";
import { LogoKhien } from "../components/ui/LogoKhien";
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
    <div className="wrap max-w-2xl py-6 sm:py-10">
      <p className="hidden md:block">
        <Link to="/cong-cu" className="inline-flex min-h-11 items-center gap-1 text-sm text-ink-2 underline">
          <Icon name="arrowLeft" className="size-4" />
          Công cụ nghiệp vụ
        </Link>
      </p>
      <div className="text-center">
        <LogoKhien className="mx-auto size-20 sm:size-24" />
        <h1 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">Chuyển đổi địa giới hành chính</h1>
        <p className="mx-auto mt-2 max-w-md text-base text-ink-2">
          Chọn cách tra cứu phù hợp để chuẩn hóa địa chỉ theo địa giới hành chính mới.
        </p>
      </div>

      <div className="mt-4 flex justify-end">
        <NutLichSuDiaGioi className="-mr-2" />
      </div>
      <ul className="mt-1 grid gap-3">
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
    </div>
  );
}
