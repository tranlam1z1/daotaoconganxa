import { cn } from "../../lib/cn";
import { congNgay, type KetQuaNgayHen, ngayDayDu, tenNgayLe, thuTrongTuan } from "../../lib/tinh-ngay-xu-ly";

const THU = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/** Các tháng (năm, tháng 1-12) từ tháng của ngày lập biên bản đến tháng của ngày hẹn. */
function cacThang(tu: string, den: string): [number, number][] {
  const kq: [number, number][] = [];
  let y = Number(tu.slice(0, 4));
  let m = Number(tu.slice(5, 7));
  const yDen = Number(den.slice(0, 4));
  const mDen = Number(den.slice(5, 7));
  while (y < yDen || (y === yDen && m <= mDen)) {
    kq.push([y, m]);
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  return kq;
}

/**
 * Lịch các tháng từ ngày lập biên bản đến ngày hẹn: tô ngày lập biên bản, ngày hẹn, đánh số các
 * ngày làm việc được đếm và tô ngày nghỉ lễ, tết.
 */
export function LichNgayHen({ kq }: { kq: KetQuaNgayHen }) {
  const soThu = new Map(kq.ngayLamViec.map((n, i) => [n, i + 1]));
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        {cacThang(kq.ngayLap, kq.ngayHen).map(([y, m]) => (
          <Thang key={`${y}-${m}`} y={y} m={m} kq={kq} soThu={soThu} />
        ))}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-2">
        <ChuGiai className="bg-info text-on-primary">Ngày lập biên bản</ChuGiai>
        <ChuGiai className="bg-primary text-on-primary">Ngày hẹn</ChuGiai>
        <ChuGiai className="bg-ok-soft text-ok">Ngày làm việc được đếm</ChuGiai>
        <ChuGiai className="bg-warn-soft text-warn">Ngày nghỉ lễ, tết</ChuGiai>
      </ul>
    </div>
  );
}

function ChuGiai({ className, children }: { className: string; children: string }) {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden="true" className={cn("size-4 rounded", className)} />
      {children}
    </li>
  );
}

function Thang({ y, m, kq, soThu }: { y: number; m: number; kq: KetQuaNgayHen; soThu: Map<string, number> }) {
  const dau = `${y}-${String(m).padStart(2, "0")}-01`;
  const soNgay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  // Ô trống trước ngày 1 để tuần bắt đầu từ thứ Hai.
  const lech = (thuTrongTuan(dau) + 6) % 7;
  const tieuDe = `Tháng ${m}/${y}`;

  return (
    <section aria-label={tieuDe} className="rounded-card border border-line bg-surface p-3 shadow-card">
      <h3 className="mb-2 text-center text-base font-semibold">{tieuDe}</h3>
      <div className="grid grid-cols-7 gap-1 text-center">
        {THU.map((t, i) => (
          <div
            key={t}
            aria-hidden="true"
            className={cn("py-1 text-xs font-medium text-ink-2", i >= 5 && "text-ink-3")}
          >
            {t}
          </div>
        ))}
        {Array.from({ length: lech }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: ô trống đầu tháng, không có định danh nào khác
          <div key={`trong-${i}`} aria-hidden="true" />
        ))}
        {Array.from({ length: soNgay }, (_, i) => {
          const ngay = congNgay(dau, i);
          return <ONgay key={ngay} ngay={ngay} kq={kq} thuTu={soThu.get(ngay)} />;
        })}
      </div>
    </section>
  );
}

function ONgay({ ngay, kq, thuTu }: { ngay: string; kq: KetQuaNgayHen; thuTu: number | undefined }) {
  const le = tenNgayLe(ngay);
  const cuoiTuan = thuTrongTuan(ngay) % 6 === 0;
  const laNgayLap = ngay === kq.ngayLap;
  const laNgayHen = ngay === kq.ngayHen;

  let moTa = ngayDayDu(ngay);
  let mau = cuoiTuan ? "text-ink-3" : "text-ink";
  if (laNgayLap) {
    moTa += ": ngày lập biên bản";
    mau = "bg-info font-bold text-on-primary";
  } else if (laNgayHen) {
    moTa += `: ngày hẹn lên làm việc (ngày làm việc thứ ${thuTu})`;
    mau = "bg-primary font-bold text-on-primary";
  } else if (thuTu) {
    moTa += `: ngày làm việc thứ ${thuTu}`;
    mau = "bg-ok-soft font-medium text-ok";
  } else if (le) {
    moTa += `: ${le}`;
    mau = "bg-warn-soft font-medium text-warn";
  }

  return (
    <div
      title={moTa}
      className={cn(
        "relative flex aspect-square min-h-9 items-center justify-center rounded-btn text-sm tabular-nums",
        mau,
      )}
    >
      <span className="sr-only">{moTa}</span>
      <span aria-hidden="true">{Number(ngay.slice(8))}</span>
      {thuTu && !laNgayHen ? (
        <span aria-hidden="true" className="absolute right-1 top-0.5 text-xs leading-none opacity-80">
          {thuTu}
        </span>
      ) : null}
    </div>
  );
}
