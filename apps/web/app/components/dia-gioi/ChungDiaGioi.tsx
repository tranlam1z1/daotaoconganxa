/**
 * Thành phần dùng chung của công cụ Chuyển đổi địa giới hành chính (routes/cong-cu.dia-gioi.*): thẻ
 * chọn cách tra, ô biểu tượng, bảng địa chỉ kết quả, các dòng địa chỉ cũ, ghi chú nguồn dữ liệu và nút
 * Lịch sử.
 */
import { type ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router";

import { cn } from "../../lib/cn";
import {
  type DiaChiCu,
  docLichSuDiaGioi,
  ghiLichSuDiaGioi,
  type MucLichSuDiaGioi,
  type NguonDuLieu,
  themLichSuDiaGioi,
} from "../../lib/dia-gioi";
import { formatDate } from "../../lib/format";
import { Badge } from "../ui/Badge";
import { Icon, type IconName } from "../ui/Icon";
import { NganLichSu } from "../ui/NganLichSu";

/** Ô vuông bo góc chứa biểu tượng, đặt bên trái thẻ và dòng địa chỉ. */
export function OBieuTuong({ icon, className }: { icon: IconName; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-12 shrink-0 place-items-center rounded-card border border-line bg-surface-2 sm:size-14",
        className,
      )}
    >
      <Icon name={icon} className="size-7 sm:size-8" />
    </span>
  );
}

/** Thẻ chọn một cách tra: biểu tượng, tên, mô tả, mũi tên. Cả thẻ là liên kết. */
export function TheLuaChon({
  to,
  icon,
  ten,
  moTa,
}: {
  to: string;
  icon: IconName;
  ten: string;
  moTa: string;
}) {
  return (
    <Link
      to={to}
      className="lun [--lun:0.985] flex h-full items-center gap-3 rounded-card border border-line bg-surface p-3 shadow-card hover:border-primary sm:gap-4 sm:p-5"
    >
      <OBieuTuong icon={icon} />
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold leading-snug">{ten}</span>
        <span className="mt-1 block text-base leading-snug text-ink-2">{moTa}</span>
      </span>
      <Icon name="chevronRight" kieu="net" className="size-6 shrink-0 text-primary" />
    </Link>
  );
}

/** Một dòng của bảng địa chỉ: biểu tượng, nhãn nhỏ, giá trị đậm. */
export function DongDiaChi({ icon, nhan, children }: { icon: IconName; nhan: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-3.5">
      <OBieuTuong icon={icon} className="size-11 sm:size-12" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink-2">{nhan}</p>
        <div className="mt-0.5 text-lg font-semibold leading-snug break-words">{children}</div>
      </div>
    </div>
  );
}

/** Khung kết quả: tiêu đề có ghim vị trí, các DongDiaChi cách nhau bằng đường kẻ. */
export function BangDiaChi({
  tieuDe,
  children,
  className,
}: {
  tieuDe: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-card border border-line bg-surface shadow-card", className)}>
      <h2 className="flex items-start gap-2 border-b border-line px-4 py-3.5 text-lg font-semibold leading-snug text-primary sm:px-5">
        <Icon name="ghim" className="mt-0.5 size-6 shrink-0" />
        {tieuDe}
      </h2>
      <div className="divide-y divide-line px-4 sm:px-5">{children}</div>
    </section>
  );
}

/** Nhãn đặt sau giá trị ước lượng theo vị trí. */
function NhanUocLuong() {
  return (
    <span className="ml-2 inline-block align-middle">
      <Badge tone="warn">Ước lượng</Badge>
    </span>
  );
}

/**
 * Các dòng địa chỉ theo đơn vị trước sắp xếp, đặt trong BangDiaChi. Chưa xác định được xã cũ thì hiện
 * xã cũ có tâm gần vị trí nhất kèm nhãn Ước lượng và các xã cũ còn lại; không ước lượng được thì chỉ
 * liệt kê các xã cũ đã nhập vào xã mới và không ghép địa chỉ đầy đủ.
 */
export function DongDiaChiCu({ cu }: { cu: DiaChiCu }) {
  const chuaRo = cu.coThe.length > 0;
  const gan = chuaRo ? cu.ganNhat : null;
  // Huyện, tỉnh chung của mọi đơn vị cũ thì chắc chắn; lấy theo xã ước lượng thì cũng là ước lượng.
  const huyen = cu.huyen ?? gan?.huyen ?? null;
  const tinh = cu.tinh ?? gan?.tinh ?? null;
  const lietKe = (ds: DiaChiCu["coThe"]) =>
    ds.map((c) => (cu.huyen ? c.xa.ten : `${c.xa.ten} (${c.huyen.ten})`)).join(", ");
  return (
    <>
      {cu.xa || chuaRo ? (
        <DongDiaChi icon="map" nhan="Phường/xã cũ">
          {cu.xa ? (
            cu.xa.ten
          ) : gan ? (
            <>
              {gan.xa.ten}
              <NhanUocLuong />
              <span className="mt-1 block text-base font-normal leading-relaxed text-ink-2">
                Đơn vị cũ có trung tâm gần vị trí nhất; ở gần ranh giới có thể là đơn vị bên cạnh. Các đơn vị
                cũ khác đã nhập vào phường/xã mới: {lietKe(cu.coThe.filter((c) => c.xa.ma !== gan.xa.ma))}.
              </span>
            </>
          ) : (
            <>
              <span className="font-normal text-ink-3">Chưa xác định được chính xác</span>
              <span className="mt-1 block text-base font-normal leading-relaxed text-ink-2">
                Là một trong {cu.coThe.length} đơn vị cũ đã nhập vào phường/xã mới: {lietKe(cu.coThe)}.
              </span>
            </>
          )}
        </DongDiaChi>
      ) : null}
      {huyen ? (
        <DongDiaChi icon="layers" nhan="Quận/huyện cũ">
          {huyen.ten}
          {cu.huyen ? null : <NhanUocLuong />}
        </DongDiaChi>
      ) : null}
      {tinh ? (
        <DongDiaChi icon="toaNha" nhan="Tỉnh/thành phố cũ">
          {tinh.ten}
          {cu.tinh ? null : <NhanUocLuong />}
        </DongDiaChi>
      ) : null}
      <DongDiaChi icon="ghim" nhan="Địa chỉ đầy đủ (cũ)">
        {cu.diaChiDayDu ? (
          <>
            {cu.diaChiDayDu}
            {gan ? <NhanUocLuong /> : null}
          </>
        ) : (
          <span className="font-normal text-ink-3">Chưa xác định được phường/xã cũ nên chưa ghép được</span>
        )}
      </DongDiaChi>
    </>
  );
}

/** Nguồn và ngày dựng dữ liệu đối chiếu, đặt dưới kết quả. */
export function GhiChuNguon({ nguon }: { nguon: NguonDuLieu | null }) {
  if (!nguon) return null;
  return (
    <p className="mt-4 text-sm leading-relaxed text-ink-2">
      Dữ liệu đối chiếu dựng ngày {formatDate(nguon.phienBan)} từ danh mục đơn vị hành chính
      (danhmuchanhchinh.gso.gov.vn) và bản đồ sắp xếp đơn vị hành chính (sapnhap.bando.com.vn), qua bộ dữ liệu
      mở{" "}
      {nguon.nguon.map((n, i) => (
        <span key={n.url}>
          {i ? " và " : ""}
          <a href={n.url} target="_blank" rel="noreferrer" className="underline">
            {n.ten}
          </a>
        </span>
      ))}
      . Khi cần căn cứ chính thức, đối chiếu nghị quyết sắp xếp đơn vị hành chính của tỉnh, thành phố.
    </p>
  );
}

/**
 * Nút Lịch sử của công cụ. Truyền `them` khi trang đang hiện kết quả: lần tra đó (đường dẫn của trang
 * hiện tại) được ghi lên đầu lịch sử, chỉ lưu trên máy đang dùng.
 */
export function NutLichSuDiaGioi({
  them,
  className,
}: {
  them?: Pick<MucLichSuDiaGioi, "nhan" | "phu"> | null;
  className?: string;
}) {
  const { pathname, search } = useLocation();
  const dangXem = `${pathname}${search}`;
  const [ds, setDs] = useState<MucLichSuDiaGioi[]>([]);
  const khoaThem = them ? `${dangXem}\n${them.nhan}` : "";
  // Đọc sau khi gắn vào trang để HTML dựng ở máy chủ khớp với lần vẽ đầu ở trình duyệt.
  // biome-ignore lint/correctness/useExhaustiveDependencies: chỉ ghi lại khi lần tra đổi (khoaThem)
  useEffect(() => {
    setDs(them ? themLichSuDiaGioi({ ...them, href: dangXem }) : docLichSuDiaGioi());
  }, [khoaThem]);

  return (
    <NganLichSu
      className={className}
      muc={ds.map((m) => ({
        khoa: m.href,
        nhan: m.nhan,
        phu: m.phu,
        href: m.href,
        luc: m.luc,
        dangXem: m.href === dangXem,
      }))}
      xoa={(khoa) => {
        const moi = khoa === null ? [] : ds.filter((m) => m.href !== khoa);
        ghiLichSuDiaGioi(moi);
        setDs(moi);
      }}
    />
  );
}
