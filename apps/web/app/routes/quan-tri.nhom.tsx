/**
 * Nhóm học cùng cho cán bộ quản lý (docs/PLAN.md GĐ16c): các nhóm có ít nhất một thành viên trong
 * phạm vi, kèm số thành viên trong và ngoài phạm vi, phần trăm trung bình của người trong phạm vi.
 *
 * Phạm vi do API áp trong câu truy vấn: thành viên ngoài phạm vi chỉ có số lượng, trưởng nhóm
 * ngoài phạm vi không có tên. Trang chỉ hiện đơn vị API cho phép chọn.
 */
import { Form, Link, useNavigation } from "react-router";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Input, inputClass, Label, Notice } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { type BoLocBaoCao, soVn } from "../lib/bao-cao";
import { cn } from "../lib/cn";
import { goiApiQuanTri } from "../lib/quan-tri.server";
import { yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/quan-tri.nhom";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Nhóm học cùng", { index: false });
}

/** Chép theo `NhomChoQuanLy` ở packages/db/src/nhom-hoc.ts. */
interface NhomChoQuanLy {
  id: string;
  ten: string;
  trang_thai: "hoat_dong" | "luu_tru";
  truong_nhom: string | null;
  truong_nhom_trong_pham_vi: boolean;
  so_trong_pham_vi: number;
  so_ngoai_pham_vi: number;
  so_muc: number;
  trung_binh_trong_pham_vi: number | null;
}

/** Bằng `GIOI_HAN_DANH_SACH_NHOM` của API. */
const GIOI_HAN = 300;

const LOC = ["don_vi", "q", "trang_thai"] as const;

export async function loader({ request }: Route.LoaderArgs) {
  const { token } = await yeuCauVaiTro(request, "lanh_dao");
  const p = new URL(request.url).searchParams;
  const loc: Record<string, string> = {};
  for (const k of LOC) {
    const v = p.get(k)?.trim();
    if (v) loc[k] = v;
  }
  const [boLoc, ds] = await Promise.all([
    goiApiQuanTri<BoLocBaoCao>(token, "/v1/bao-cao/bo-loc"),
    goiApiQuanTri<{ items: NhomChoQuanLy[] }>(token, `/v1/quan-tri/nhom?${new URLSearchParams(loc)}`),
  ]);
  return { donVi: boLoc.don_vi, loc, items: ds.items };
}

const TH = "py-2 pr-3 font-medium";
const TD = "py-2 pr-3 align-top";
const SO = "text-right tabular-nums";

export default function QuanTriNhom({ loaderData }: Route.ComponentProps) {
  const { donVi, loc, items } = loaderData;
  const busy = useNavigation().state !== "idle";
  const oChon = cn(inputClass, "pr-8");
  const capGoc = donVi[0]?.path.split(".").length ?? 1;

  return (
    <section className="khung-trang min-w-0 space-y-4">
      <header className="flex items-start gap-4 rounded-2xl border border-line bg-surface px-4 py-6 shadow-card sm:gap-5 sm:px-6">
        <span
          className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary sm:size-16"
          aria-hidden="true"
        >
          <Icon name="shield" kieu="net" className="size-8" />
        </span>
        <div className="min-w-0">
          <h2 className="text-2xl font-bold sm:text-[28px]">Nhóm học cùng</h2>
          <p className="mt-2 max-w-[100ch] text-sm leading-relaxed text-ink-2">
            Nhóm do cán bộ tự lập. Danh sách gồm nhóm có ít nhất một thành viên thuộc đơn vị trong phạm vi
            quản lý. Thành viên thuộc đơn vị khác chỉ hiện số lượng, không hiện họ tên.
          </p>
        </div>
      </header>

      <Form
        method="get"
        className="grid gap-x-5 gap-y-3 rounded-2xl border border-line bg-surface px-4 py-5 shadow-card sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.6fr_1.15fr_1fr]"
      >
        <div className="sm:col-span-2 lg:col-span-1">
          <Label htmlFor="nhom-don-vi">Đơn vị của thành viên (gồm cả đơn vị cấp dưới)</Label>
          <select id="nhom-don-vi" name="don_vi" defaultValue={loc.don_vi ?? ""} className={oChon}>
            <option value="">Mọi đơn vị trong phạm vi</option>
            {donVi.map((d) => (
              <option key={d.id} value={d.id}>
                {"  ".repeat(Math.max(0, d.path.split(".").length - capGoc))}
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="nhom-q">Tên nhóm</Label>
          <Input id="nhom-q" name="q" type="search" maxLength={80} defaultValue={loc.q ?? ""} />
        </div>
        <div>
          <Label htmlFor="nhom-trang-thai">Trạng thái</Label>
          <select
            id="nhom-trang-thai"
            name="trang_thai"
            defaultValue={loc.trang_thai ?? ""}
            className={oChon}
          >
            <option value="">Mọi trạng thái</option>
            <option value="hoat_dong">Đang hoạt động</option>
            <option value="luu_tru">Đã lưu trữ</option>
          </select>
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-3">
          <Button
            type="submit"
            variant="secondary"
            disabled={busy}
            className="bg-primary-soft/30 px-5 text-base text-primary"
          >
            {busy ? "Đang tải" : "Lọc danh sách"}
          </Button>
        </div>
      </Form>

      <div className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
        {items.length >= GIOI_HAN ? (
          <Notice className="mb-4">
            Danh sách chỉ hiện {GIOI_HAN} nhóm cập nhật gần nhất. Chọn đơn vị hoặc nhập tên nhóm để thu hẹp.
          </Notice>
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            icon="nhom"
            title="Không có nhóm nào khớp bộ lọc"
            className="min-h-[178px] justify-center py-8 text-lg [&>span]:size-14 [&>span]:bg-primary-soft [&>span>svg]:size-7"
          />
        ) : (
          <>
            {/* Điện thoại: mỗi nhóm một thẻ, chạm cả thẻ để mở; từ 768px: bảng đủ cột. */}
            <ul className="grid gap-3 md:hidden">
              {items.map((g) => (
                <li key={g.id}>
                  <Link
                    to={`/quan-tri/nhom/${g.id}`}
                    className="block rounded-xl border border-line bg-surface p-4 the-bam"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0 break-words text-base font-semibold text-primary">
                        {g.ten}
                      </span>
                      <Badge tone={g.trang_thai === "hoat_dong" ? "ok" : "muted"}>
                        {g.trang_thai === "hoat_dong" ? "Đang hoạt động" : "Đã lưu trữ"}
                      </Badge>
                    </span>
                    <span className="mt-1 block text-sm text-ink-2">
                      Trưởng nhóm: {g.truong_nhom ?? "thuộc đơn vị ngoài phạm vi"}
                    </span>
                    <span className="mt-2 block text-sm text-ink-2">
                      Tiến độ trung bình{" "}
                      <strong className="text-ink tabular-nums">
                        {soVn(g.trung_binh_trong_pham_vi, "%")}
                      </strong>{" "}
                      · {g.so_trong_pham_vi} trong phạm vi · {g.so_ngoai_pham_vi} ngoài phạm vi · {g.so_muc}{" "}
                      mục
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="bang-cuon hidden rounded-xl border border-line p-3 md:block">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead className="text-ink-3">
                  <tr>
                    <th scope="col" className={TH}>
                      Nhóm
                    </th>
                    <th scope="col" className={TH}>
                      Trưởng nhóm
                    </th>
                    <th scope="col" className={cn(TH, SO)}>
                      Trong phạm vi
                    </th>
                    <th scope="col" className={cn(TH, SO)}>
                      Ngoài phạm vi
                    </th>
                    <th scope="col" className={cn(TH, SO)}>
                      Số mục
                    </th>
                    <th scope="col" className={cn(TH, SO)}>
                      Tiến độ trung bình
                    </th>
                    <th scope="col" className={TH}>
                      Trạng thái
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((g) => (
                    <tr key={g.id} className="border-t border-line">
                      <td className={TD}>
                        <Link
                          to={`/quan-tri/nhom/${g.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {g.ten}
                        </Link>
                      </td>
                      <td className={TD}>
                        {g.truong_nhom ?? <span className="text-ink-3">Thuộc đơn vị ngoài phạm vi</span>}
                      </td>
                      <td className={cn(TD, SO)}>{g.so_trong_pham_vi}</td>
                      <td className={cn(TD, SO)}>{g.so_ngoai_pham_vi}</td>
                      <td className={cn(TD, SO)}>{g.so_muc}</td>
                      <td className={cn(TD, SO, "font-semibold")}>{soVn(g.trung_binh_trong_pham_vi, "%")}</td>
                      <td className={cn(TD, "whitespace-nowrap")}>
                        <Badge tone={g.trang_thai === "hoat_dong" ? "ok" : "muted"}>
                          {g.trang_thai === "hoat_dong" ? "Đang hoạt động" : "Đã lưu trữ"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <p className="mt-4 text-sm leading-relaxed text-ink-2">
          Tiến độ trung bình tính trên thành viên trong phạm vi, làm tròn xuống. Báo cáo tiến độ học của từng
          cán bộ, kèm tải Excel và PDF, ở{" "}
          <Link to="/quan-tri/bao-cao?tab=tien-do-hoc" className="text-primary hover:underline">
            Báo cáo, tab Tiến độ học
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
