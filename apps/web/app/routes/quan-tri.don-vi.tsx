/**
 * Cây đơn vị (docs/PLAN.md GĐ2). Cán bộ quản lý xem cây đơn vị của mình; quản trị viên thêm,
 * sửa, chuyển đơn vị sang cấp trên khác. API kiểm quyền và chặn chuyển tạo vòng.
 * Bấm tên đơn vị mở hộp thông tin chi tiết; quản trị viên sửa ngay trong hộp đó.
 */
import { useEffect, useState } from "react";
import { Link, useFetcher } from "react-router";

import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Input, inputClass, Label, Notice } from "../components/ui/Field";
import { HopThoai, useHop, VungNutHop } from "../components/ui/HopThoai";
import { Icon } from "../components/ui/Icon";
import { cn } from "../lib/cn";
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/quan-tri.don-vi";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Đơn vị", { index: false });
}

interface DonVi {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
  path: string;
  level_label: string | null;
  ordinal: number;
  enabled: boolean;
  cap: number;
  so_nguoi: number;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { token, nguoiDung } = await yeuCauVaiTro(request, "quan_ly");
  const { items } = await goiApiQuanTri<{ items: DonVi[] }>(token, "/v1/quan-tri/don-vi");
  return { items, laQuanTri: nguoiDung.la_quan_tri };
}

export async function action({ request }: Route.ActionArgs) {
  const { token } = await yeuCauVaiTro(request, "quan_tri");
  const f = await request.formData();
  const chuoi = (k: string) => String(f.get(k) ?? "").trim();
  const duLieu = {
    code: chuoi("code"),
    name: chuoi("name"),
    levelLabel: chuoi("levelLabel") || null,
    ordinal: Number(chuoi("ordinal") || 0),
    parentId: chuoi("parentId") || null,
  };
  try {
    if (f.get("intent") === "tao") {
      await goiApiQuanTri(token, "/v1/quan-tri/don-vi", { body: duLieu });
      return { ok: `Đã thêm đơn vị ${duLieu.name}.` };
    }
    await goiApiQuanTri(token, `/v1/quan-tri/don-vi/${chuoi("id")}`, {
      method: "PATCH",
      body: { ...duLieu, enabled: f.get("enabled") === "on" },
    });
    return { ok: `Đã lưu đơn vị ${duLieu.name}.` };
  } catch (e) {
    if (e instanceof LoiApi) return { loi: e.message };
    throw e;
  }
}

/** Các trường chung của biểu mẫu thêm và sửa. `boQua` là các id không được chọn làm cấp trên. */
function TruongDonVi({ d, items, boQua }: { d?: DonVi; items: DonVi[]; boQua: Set<string> }) {
  const id = d?.id ?? "moi";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label htmlFor={`ten-${id}`}>Tên đơn vị</Label>
        <Input id={`ten-${id}`} name="name" required defaultValue={d?.name} />
      </div>
      <div>
        <Label htmlFor={`ma-${id}`}>Mã đơn vị</Label>
        <Input id={`ma-${id}`} name="code" required defaultValue={d?.code} maxLength={40} />
      </div>
      <div>
        <Label htmlFor={`cha-${id}`}>Đơn vị cấp trên</Label>
        <select id={`cha-${id}`} name="parentId" defaultValue={d?.parent_id ?? ""} className={inputClass}>
          <option value="">Không có (đơn vị gốc)</option>
          {items
            .filter((x) => !boQua.has(x.id))
            .map((x) => (
              <option key={x.id} value={x.id}>
                {"· ".repeat(x.cap - 1)}
                {x.name} ({x.code})
              </option>
            ))}
        </select>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor={`cap-${id}`}>Tên cấp</Label>
          <Input id={`cap-${id}`} name="levelLabel" defaultValue={d?.level_label ?? ""} placeholder="Đội" />
        </div>
        <div>
          <Label htmlFor={`tt-${id}`}>Thứ tự</Label>
          <Input
            id={`tt-${id}`}
            name="ordinal"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={d?.ordinal ?? 0}
          />
        </div>
      </div>
    </div>
  );
}

/** Biểu mẫu thêm (không có `d`) hoặc sửa một đơn vị. Gửi bằng fetcher để lỗi hiện ngay trong hộp. */
function BieuMauDonVi({
  d,
  items,
  onXong,
  onHuy,
}: {
  d?: DonVi;
  items: DonVi[];
  onXong: (tin: string) => void;
  onHuy?: () => void;
}) {
  const f = useFetcher<typeof action>();
  const dangGui = f.state !== "idle";
  useEffect(() => {
    if (f.state === "idle" && f.data?.ok) onXong(f.data.ok);
  }, [f.state, f.data, onXong]);

  // Chính đơn vị và mọi đơn vị con cháu: không được chọn làm cấp trên của nó.
  const boQua = new Set(
    d ? items.filter((x) => x.path === d.path || x.path.startsWith(`${d.path}.`)).map((x) => x.id) : [],
  );

  return (
    <f.Form method="post">
      <input type="hidden" name="intent" value={d ? "sua" : "tao"} />
      {d ? <input type="hidden" name="id" value={d.id} /> : null}
      <TruongDonVi d={d} items={items} boQua={boQua} />
      {d ? (
        <label className="mt-3 flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="enabled" defaultChecked={d.enabled} />
          Đang sử dụng
        </label>
      ) : null}
      {f.data?.loi ? (
        <Notice tone="danger" className="mt-3">
          {f.data.loi}
        </Notice>
      ) : null}
      <VungNutHop className="mt-4">
        {onHuy ? (
          <Button variant="secondary" onClick={onHuy} disabled={dangGui}>
            Hủy
          </Button>
        ) : null}
        <Button type="submit" disabled={dangGui}>
          {dangGui ? "Đang lưu" : d ? "Lưu đơn vị" : "Thêm đơn vị"}
        </Button>
      </VungNutHop>
    </f.Form>
  );
}

/** Nội dung hộp chi tiết một đơn vị; quản trị viên chuyển sang biểu mẫu sửa ngay trong hộp. */
function ChiTietDonVi({
  d,
  items,
  laQuanTri,
  onMo,
  onXong,
}: {
  d: DonVi;
  items: DonVi[];
  laQuanTri: boolean;
  onMo: (id: string) => void;
  onXong: (tin: string) => void;
}) {
  const [sua, datSua] = useState(false);
  if (sua) return <BieuMauDonVi d={d} items={items} onXong={onXong} onHuy={() => datSua(false)} />;

  // `items` đã theo thứ tự cây nên cấp trên xếp sẵn từ gốc xuống.
  const tren = items.filter((x) => d.path.startsWith(`${x.path}.`));
  const capDuoi = items.filter((x) => x.path.startsWith(`${d.path}.`));
  const con = capDuoi.filter((x) => x.parent_id === d.id);
  const tongNguoi = capDuoi.reduce((s, x) => s + x.so_nguoi, d.so_nguoi);

  return (
    <>
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[9rem_1fr]">
        <dt className="text-ink-3">Mã đơn vị</dt>
        <dd className="font-mono font-medium">{d.code}</dd>
        <dt className="text-ink-3">Cấp</dt>
        <dd className="font-medium">{d.level_label ?? `Cấp ${d.cap}`}</dd>
        <dt className="text-ink-3">Đơn vị cấp trên</dt>
        <dd>
          {tren.length
            ? tren.map((x) => x.name).join(" › ")
            : d.parent_id
              ? "Ngoài phạm vi được xem"
              : "Không có (đơn vị gốc)"}
        </dd>
        <dt className="text-ink-3">Trạng thái</dt>
        <dd>
          <Badge tone={d.enabled ? "ok" : "muted"}>{d.enabled ? "Đang sử dụng" : "Ngừng dùng"}</Badge>
        </dd>
        <dt className="text-ink-3">Số người</dt>
        <dd>
          {d.so_nguoi} thuộc trực tiếp
          {capDuoi.length ? `, ${tongNguoi} tính cả cấp dưới` : ""}
        </dd>
        <dt className="text-ink-3">Đơn vị cấp dưới</dt>
        <dd>
          {con.length
            ? `${con.length} trực thuộc${capDuoi.length > con.length ? `, ${capDuoi.length} trong cả nhánh` : ""}`
            : "Không có"}
        </dd>
      </dl>

      {con.length ? (
        <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
          {con.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                onClick={() => onMo(x.id)}
                className="lun flex min-h-11 w-full items-center gap-3 px-3 py-1.5 text-left text-sm hover:bg-surface-2"
              >
                <span className={cn("min-w-0 flex-1 font-medium", !x.enabled && "text-ink-3 line-through")}>
                  {x.name}
                </span>
                <span className="shrink-0 text-ink-3">{x.so_nguoi} người</span>
                <Icon name="chevronRight" className="size-4 shrink-0 text-ink-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <VungNutHop className="mt-4">
        {laQuanTri ? (
          <Button variant="secondary" onClick={() => datSua(true)}>
            Sửa đơn vị
          </Button>
        ) : null}
        <ButtonLink to={`/quan-tri/nguoi-dung?don_vi=${d.id}`}>Xem danh sách {tongNguoi} người</ButtonLink>
      </VungNutHop>
    </>
  );
}

export default function QuanTriDonVi({ loaderData }: Route.ComponentProps) {
  const { items, laQuanTri } = loaderData;
  const hop = useHop<"them" | "chiTiet", string>();
  const [thongBao, datThongBao] = useState<string | null>(null);
  // Tra theo id mỗi lần hiển thị: sau khi lưu, hộp thấy dữ liệu mới của loader.
  const dangXem = hop.la("chiTiet") ? items.find((d) => d.id === hop.duLieu) : undefined;
  const capGoc = Math.min(...items.map((d) => d.cap));
  const tongNguoi = items.reduce((s, d) => s + d.so_nguoi, 0);

  const xong = (tin: string) => {
    datThongBao(tin);
    hop.dong();
    // Thông báo nằm ở đầu trang, danh sách có thể đang cuộn xa.
    window.scrollTo({ top: 0 });
  };

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">Đơn vị</h2>
          <p className="mt-1 text-sm text-ink-2">
            {laQuanTri
              ? "Toàn bộ cây đơn vị. Bấm tên đơn vị để xem chi tiết hoặc sửa."
              : "Đơn vị của bạn và các đơn vị cấp dưới. Bấm tên đơn vị để xem chi tiết."}
          </p>
        </div>
        {laQuanTri ? <Button onClick={() => hop.mo("them")}>Thêm đơn vị</Button> : null}
      </div>

      {thongBao ? <Notice className="mt-4">{thongBao}</Notice> : null}

      {items.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon="layers" title="Chưa có đơn vị nào">
            <p>
              {laQuanTri
                ? "Thêm đơn vị gốc trước, sau đó thêm các đơn vị cấp dưới."
                : "Tài khoản chưa được gắn vào đơn vị nào. Liên hệ quản trị viên."}
            </p>
          </EmptyState>
        </div>
      ) : (
        <>
          <p className="mt-4 text-sm text-ink-3">
            {items.length} đơn vị, {tongNguoi} người
          </p>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {items.map((d) => (
              <li key={d.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => hop.mo("chiTiet", d.id)}
                  className="lun flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pr-2 text-left hover:bg-surface-2"
                  style={{ paddingLeft: `${1 + (d.cap - capGoc) * 1.5}rem` }}
                >
                  <span className="min-w-0 flex-1">
                    <span className={cn("block font-semibold", !d.enabled && "text-ink-3 line-through")}>
                      {d.name}
                    </span>
                    <span className="block text-sm text-ink-3">
                      {d.level_label ? `${d.level_label} · ` : ""}
                      {d.code}
                    </span>
                  </span>
                  {!d.enabled ? <Badge tone="muted">Ngừng dùng</Badge> : null}
                </button>
                <Link
                  to={`/quan-tri/nguoi-dung?don_vi=${d.id}`}
                  aria-label={`${d.so_nguoi} người thuộc ${d.name}, xem danh sách`}
                  className="flex min-h-11 shrink-0 items-center gap-1 px-3 text-sm font-medium text-primary hover:underline"
                >
                  {d.so_nguoi} người
                  <Icon name="chevronRight" className="size-4" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {laQuanTri ? (
        <HopThoai mo={hop.la("them")} onDong={hop.dong} tieuDe="Thêm đơn vị">
          <BieuMauDonVi key={hop.lan} items={items} onXong={xong} />
        </HopThoai>
      ) : null}
      <HopThoai mo={dangXem !== undefined} onDong={hop.dong} tieuDe={dangXem?.name ?? ""}>
        {dangXem ? (
          <ChiTietDonVi
            key={hop.lan}
            d={dangXem}
            items={items}
            laQuanTri={laQuanTri}
            onMo={(id) => hop.mo("chiTiet", id)}
            onXong={xong}
          />
        ) : null}
      </HopThoai>
    </section>
  );
}
