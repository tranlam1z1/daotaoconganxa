/**
 * Cây đơn vị (docs/PLAN.md GĐ2). Cán bộ quản lý xem cây đơn vị của mình; quản trị viên thêm,
 * sửa, chuyển đơn vị sang cấp trên khác. API kiểm quyền và chặn chuyển tạo vòng.
 * Bấm tên đơn vị mở hộp thông tin chi tiết; quản trị viên sửa ngay trong hộp đó.
 *
 * Mỗi đơn vị có loại chuẩn (migration 0087); đơn vị loại xã gắn mã xã theo danh mục hành chính.
 * Danh sách tìm được theo tên, lọc theo loại, thu gọn từng nhánh
 * (docs/superpowers/plans/2026-11-10-quan-ly-don-vi.md).
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useFetcher } from "react-router";
import { ChonXaHanhChinh } from "../components/quan-tri/ChonXaHanhChinh";
import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { ChonDonVi } from "../components/ui/ChonDonVi";
import { EmptyState } from "../components/ui/EmptyState";
import { Input, inputClass, Label, Notice } from "../components/ui/Field";
import { HopThoai, useHop, VungNutHop } from "../components/ui/HopThoai";
import { Icon } from "../components/ui/Icon";
import { DS_LOAI, type LoaiDonVi, locCay, locTheoThu, NHAN_LOAI, thanhMucDonVi } from "../lib/cay-don-vi";
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
  loai: LoaiDonVi;
  ma_hanh_chinh: string | null;
  ordinal: number;
  enabled: boolean;
  cap: number;
  so_nguoi: number;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { token, nguoiDung } = await yeuCauVaiTro(request, "lanh_dao");
  const { items } = await goiApiQuanTri<{ items: DonVi[] }>(token, "/v1/quan-tri/don-vi");
  return { items, laQuanTri: nguoiDung.la_quan_tri };
}

export async function action({ request }: Route.ActionArgs) {
  const { token } = await yeuCauVaiTro(request, "quan_tri");
  const f = await request.formData();
  const chuoi = (k: string) => String(f.get(k) ?? "").trim();
  const loai = (chuoi("loai") || "khac") as LoaiDonVi;
  const duLieu = {
    code: chuoi("code"),
    name: chuoi("name"),
    loai,
    // Ô mã xã chỉ có khi loại là xã; đổi sang loại khác thì gửi null để API bỏ mã cũ.
    maHanhChinh: loai === "xa" ? chuoi("maHanhChinh") || null : null,
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
  const [ten, datTen] = useState(d?.name ?? "");
  const [ma, datMa] = useState(d?.code ?? "");
  const [loai, datLoai] = useState<LoaiDonVi>(d?.loai ?? "khac");
  const capTren = useMemo(() => thanhMucDonVi(items.filter((x) => !boQua.has(x.id))), [items, boQua]);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label htmlFor={`loai-${id}`}>Loại đơn vị</Label>
        <select
          id={`loai-${id}`}
          name="loai"
          value={loai}
          onChange={(e) => datLoai(e.target.value as LoaiDonVi)}
          className={inputClass}
        >
          {DS_LOAI.map((l) => (
            <option key={l} value={l}>
              {NHAN_LOAI[l]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor={`cha-${id}`}>Đơn vị cấp trên</Label>
        <ChonDonVi
          id={`cha-${id}`}
          name="parentId"
          items={capTren}
          defaultValue={d?.parent_id}
          placeholder="Không có (đơn vị gốc)"
        />
      </div>
      {loai === "xa" ? (
        <ChonXaHanhChinh
          id={`xa-${id}`}
          maHienTai={d?.ma_hanh_chinh ?? null}
          onChonXa={(xa) => {
            if (!ten.trim()) datTen(xa.ten);
            if (!ma.trim()) datMa(`XA-${xa.ma}`);
          }}
        />
      ) : null}
      <div>
        <Label htmlFor={`ten-${id}`}>Tên đơn vị</Label>
        <Input id={`ten-${id}`} name="name" required value={ten} onChange={(e) => datTen(e.target.value)} />
      </div>
      <div>
        <Label htmlFor={`ma-${id}`}>Mã đơn vị</Label>
        <Input
          id={`ma-${id}`}
          name="code"
          required
          maxLength={40}
          value={ma}
          onChange={(e) => datMa(e.target.value)}
        />
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
  const boQua = useMemo(
    () =>
      new Set(
        d ? items.filter((x) => x.path === d.path || x.path.startsWith(`${d.path}.`)).map((x) => x.id) : [],
      ),
    [d, items],
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
        <dt className="text-ink-3">Loại</dt>
        <dd className="font-medium">{NHAN_LOAI[d.loai]}</dd>
        {d.ma_hanh_chinh ? (
          <>
            <dt className="text-ink-3">Mã xã</dt>
            <dd className="font-mono font-medium">{d.ma_hanh_chinh}</dd>
          </>
        ) : null}
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
        <ul className="mt-3 divide-y divide-line rounded-btn border border-line">
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

  const [q, datQ] = useState("");
  const [loaiLoc, datLoaiLoc] = useState<LoaiDonVi | "">("");
  const coCon = useMemo(() => new Set(items.map((d) => d.parent_id).filter(Boolean) as string[]), [items]);
  // Mặc định mở hai cấp đầu: thu các đơn vị cấp hai có cấp dưới.
  const thuMacDinh = useMemo(
    () => new Set(items.filter((d) => d.cap - capGoc >= 1 && coCon.has(d.id)).map((d) => d.id)),
    [items, capGoc, coCon],
  );
  const [dangThu, datDangThu] = useState<Set<string>>(thuMacDinh);
  const loc = useMemo(() => locCay(items, q, loaiLoc), [items, q, loaiLoc]);
  // Đang lọc thì mở hết và chỉ hiện đơn vị khớp cùng cấp trên của chúng.
  const hienThi = useMemo(
    () => (loc ? items.filter((d) => loc.has(d.id)) : locTheoThu(items, dangThu)),
    [items, loc, dangThu],
  );
  const doiThu = (id: string) =>
    datDangThu((cu) => {
      const moi = new Set(cu);
      if (moi.has(id)) moi.delete(id);
      else moi.add(id);
      return moi;
    });
  const xoaLoc = () => {
    datQ("");
    datLoaiLoc("");
  };

  const xong = (tin: string) => {
    datThongBao(tin);
    hop.dong();
    // Thông báo nằm ở đầu trang, danh sách có thể đang cuộn xa.
    window.scrollTo({ top: 0 });
  };

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 flex-1 items-start gap-4 sm:gap-6">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-card bg-primary-soft text-primary"
            aria-hidden="true"
          >
            <Icon name="shield" kieu="net" className="size-6" />
          </span>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold leading-tight sm:text-[28px]">Đơn vị</h2>
            <p className="mt-1 text-sm text-ink-2">
              {laQuanTri
                ? "Toàn bộ cây đơn vị. Bấm tên đơn vị để xem chi tiết hoặc sửa."
                : "Đơn vị của bạn và các đơn vị cấp dưới. Bấm tên đơn vị để xem chi tiết."}
            </p>
          </div>
        </div>
        {laQuanTri ? (
          <Button icon="plus" className="min-h-11 px-5" onClick={() => hop.mo("them")}>
            Thêm đơn vị
          </Button>
        ) : null}
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
          <p className="mt-6 flex min-h-[60px] items-center gap-5 rounded-card bg-primary-soft px-5 py-4 text-sm font-semibold text-ink">
            <Icon name="nhom" kieu="net" className="size-6 shrink-0 text-primary" />
            {loc
              ? `Hiện ${hienThi.length}/${items.length} đơn vị`
              : `${items.length} đơn vị, ${tongNguoi} người`}
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-[2_1_14rem]">
              <Label htmlFor="tim-don-vi">Tìm đơn vị</Label>
              <Input
                id="tim-don-vi"
                type="search"
                value={q}
                onChange={(e) => datQ(e.target.value)}
                placeholder="Gõ tên, mã đơn vị hoặc mã xã"
                autoComplete="off"
              />
            </div>
            <div className="min-w-0 flex-[1_1_10rem]">
              <Label htmlFor="loc-loai">Loại</Label>
              <select
                id="loc-loai"
                value={loaiLoc}
                onChange={(e) => datLoaiLoc(e.target.value as LoaiDonVi | "")}
                className={inputClass}
              >
                <option value="">Mọi loại</option>
                {DS_LOAI.map((l) => (
                  <option key={l} value={l}>
                    {NHAN_LOAI[l]}
                  </option>
                ))}
              </select>
            </div>
            {!loc && coCon.size ? (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => datDangThu(new Set(coCon))}>
                  Thu gọn tất cả
                </Button>
                <Button variant="secondary" onClick={() => datDangThu(new Set())}>
                  Mở tất cả
                </Button>
              </div>
            ) : null}
          </div>

          {hienThi.length === 0 ? (
            <div className="mt-5">
              <EmptyState icon="layers" title="Không có đơn vị khớp">
                <p>Thử từ khóa khác hoặc chọn mọi loại.</p>
                <Button variant="secondary" className="mt-3" onClick={xoaLoc}>
                  Xóa bộ lọc
                </Button>
              </EmptyState>
            </div>
          ) : null}

          <ul className="mt-5 space-y-3">
            {hienThi.map((d) => {
              const thu = dangThu.has(d.id);
              const nutThu = !loc && coCon.has(d.id);
              return (
                <li
                  key={d.id}
                  className="flex items-center overflow-hidden rounded-card border border-line bg-surface transition-colors hover:border-primary/40"
                  style={{ paddingLeft: `${(d.cap - capGoc) * 1.5}rem` }}
                >
                  {nutThu ? (
                    <button
                      type="button"
                      onClick={() => doiThu(d.id)}
                      aria-expanded={!thu}
                      aria-label={`${thu ? "Mở" : "Thu gọn"} ${d.name}`}
                      className="grid min-h-11 w-11 shrink-0 place-items-center self-stretch text-ink-2 hover:bg-surface-2"
                    >
                      <Icon
                        name="chevronRight"
                        kieu="net"
                        className={cn("size-5 transition-transform", !thu && "rotate-90")}
                      />
                    </button>
                  ) : (
                    <span className="w-11 shrink-0" aria-hidden="true" />
                  )}
                  <button
                    type="button"
                    onClick={() => hop.mo("chiTiet", d.id)}
                    className="lun flex min-h-[88px] min-w-0 flex-1 items-center gap-4 py-3 pr-2 text-left hover:bg-surface-2 sm:gap-6"
                  >
                    <span
                      className="grid size-12 shrink-0 place-items-center rounded-card bg-primary-soft text-primary sm:size-[60px]"
                      aria-hidden="true"
                    >
                      <Icon name="toaNha" kieu="net" className="size-7" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block text-base font-bold sm:text-lg",
                          !d.enabled && "text-ink-3 line-through",
                        )}
                      >
                        {d.name}
                      </span>
                      <span className="mt-1 block break-words text-sm text-ink-3">
                        {NHAN_LOAI[d.loai]} · {d.code}
                        {d.ma_hanh_chinh ? ` · Mã xã ${d.ma_hanh_chinh}` : ""}
                      </span>
                    </span>
                    {!d.enabled ? <Badge tone="muted">Ngừng dùng</Badge> : null}
                  </button>
                  <Link
                    to={`/quan-tri/nguoi-dung?don_vi=${d.id}`}
                    aria-label={`${d.so_nguoi} người thuộc ${d.name}, xem danh sách`}
                    className="flex min-h-11 shrink-0 items-center gap-2 px-3 text-sm font-semibold text-primary hover:underline sm:gap-4 sm:px-5 sm:text-base"
                  >
                    {d.so_nguoi} người
                    <Icon name="chevronRight" kieu="net" className="size-5" />
                  </Link>
                </li>
              );
            })}
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
