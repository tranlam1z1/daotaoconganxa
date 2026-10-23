/**
 * Báo cáo cho lãnh đạo và cán bộ quản lý (docs/PLAN.md GĐ7), lấy cán bộ làm trung tâm: tab mở đầu
 * "Cán bộ" là danh sách từng người (báo cáo tiến độ học của GĐ16c, lọc được theo nhóm học cùng), bấm
 * tên để mở hồ sơ chi tiết. Bốn báo cáo theo đề thi, đơn vị, luyện tập, câu hỏi khó nằm chung trong
 * tab "Báo cáo tổng hợp". Bộ lọc ở trên cùng, nút "Tải Excel" và "Tải PDF". Không vẽ biểu đồ.
 *
 * Phạm vi đơn vị do API áp trong câu truy vấn; trang chỉ hiện đơn vị API cho phép chọn.
 */
import type { ReactNode } from "react";
import { Form, Link, useNavigation, useSearchParams } from "react-router";
import { DINH, KhungBang, SO, TD, TH, TomTat, Trong } from "../components/quan-tri/BangBaoCao";
import { Badge } from "../components/ui/Badge";
import { Button, buttonClass } from "../components/ui/Button";
import { Input, inputClass, Label, Notice } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { TieuDeTrang } from "../components/ui/KhungTrang";
import {
  BAO_CAO_CAN_BO,
  BAO_CAO_TONG_HOP,
  type BaoCaoCauHoiKho,
  type BaoCaoLuyenTap,
  type BaoCaoTienDoHoc,
  type BoLocBaoCao,
  CAN_DE_THI,
  duongHoSoCanBo,
  type KetQuaDeThi,
  LOAI_BAO_CAO,
  LOC_BAO_CAO,
  type LoaiBaoCao,
  type NhomBoLoc,
  type NhomLuyenTap,
  soVn,
  TEN_BAO_CAO,
  TEN_NHOM_LUYEN_TAP,
  type TongHopDonVi,
} from "../lib/bao-cao";
import { cn } from "../lib/cn";
import { formatNgayGio } from "../lib/format";
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/quan-tri.bao-cao";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Báo cáo", { index: false });
}

type DuLieu =
  | { loai: "ket-qua-thi"; data: KetQuaDeThi }
  | { loai: "don-vi"; data: TongHopDonVi }
  | { loai: "luyen-tap"; data: BaoCaoLuyenTap }
  | { loai: "cau-hoi-kho"; data: BaoCaoCauHoiKho }
  | { loai: "tien-do-hoc"; data: BaoCaoTienDoHoc };

export async function loader({ request }: Route.LoaderArgs) {
  const { token } = await yeuCauVaiTro(request, "lanh_dao");
  const p = new URL(request.url).searchParams;
  const tabRaw = p.get("tab") ?? BAO_CAO_CAN_BO;
  const tab: LoaiBaoCao = (LOAI_BAO_CAO as readonly string[]).includes(tabRaw)
    ? (tabRaw as LoaiBaoCao)
    : BAO_CAO_CAN_BO;
  // Tab tiến độ học lọc được theo nhóm: chỉ các nhóm có thành viên trong phạm vi (API lọc sẵn).
  const [boLoc, nhomLoc] = await Promise.all([
    goiApiQuanTri<BoLocBaoCao>(token, "/v1/bao-cao/bo-loc"),
    tab === "tien-do-hoc"
      ? goiApiQuanTri<{ items: NhomBoLoc[] }>(token, "/v1/quan-tri/nhom").then((r) => r.items)
      : Promise.resolve([] as NhomBoLoc[]),
  ]);

  const loc: Record<string, string> = {};
  for (const k of LOC_BAO_CAO) {
    const v = p.get(k);
    if (v) loc[k] = v;
  }
  // Báo cáo theo đề mà chưa chọn đề thì lấy đề mới nhất.
  if (CAN_DE_THI[tab] && !loc.de_thi && boLoc.de_thi[0]) loc.de_thi = boLoc.de_thi[0].id;
  if (tab === "luyen-tap") loc.theo ??= "nguoi";
  if (tab === "cau-hoi-kho") loc.toi_thieu ??= "5";

  let duLieu: DuLieu | null = null;
  let loi: string | null = null;
  if (CAN_DE_THI[tab] && !loc.de_thi) {
    loi = "Chưa có đề thi nào đã xuất bản để báo cáo.";
  } else {
    try {
      const qs = new URLSearchParams(loc);
      duLieu = { loai: tab, data: await goiApiQuanTri(token, `/v1/bao-cao/${tab}?${qs}`) } as DuLieu;
    } catch (err) {
      if (!(err instanceof LoiApi)) throw err;
      loi = err.message;
    }
  }
  return { tab, boLoc, nhomLoc, loc, duLieu, loi };
}

export default function QuanTriBaoCao({ loaderData }: Route.ComponentProps) {
  const { tab, boLoc, nhomLoc, loc, duLieu, loi } = loaderData;
  const busy = useNavigation().state !== "idle";

  const qsTai = (dinhDang: "xlsx" | "pdf") => new URLSearchParams({ ...loc, dinh_dang: dinhDang }).toString();
  const lienKetTab = (t: LoaiBaoCao) => {
    // Giữ bộ lọc chung khi đổi tab; báo cáo luyện tập bỏ qua đề thi.
    const q = new URLSearchParams({ tab: t });
    for (const k of ["don_vi", "tu", "den", "de_thi"] as const) if (loc[k]) q.set(k, loc[k]);
    return `/quan-tri/bao-cao?${q}`;
  };
  const coDuLieu = duLieu && duLieu.data.dong.length > 0;
  const laCanBo = tab === BAO_CAO_CAN_BO;

  return (
    <section className="bao-cao-trang">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TieuDeTrang as="h2" icon="shield" className="text-xl font-semibold">
          Báo cáo
        </TieuDeTrang>
        {coDuLieu ? (
          <div className="flex flex-wrap gap-2">
            <a href={`/quan-tri/bao-cao/tai/${tab}?${qsTai("xlsx")}`} className={buttonClass()}>
              Tải Excel
            </a>
            <a
              href={`/quan-tri/bao-cao/tai/${tab}?${qsTai("pdf")}`}
              className={buttonClass({ variant: "secondary" })}
            >
              Tải PDF
            </a>
          </div>
        ) : null}
      </div>

      <nav aria-label="Loại báo cáo" className="mt-4 flex gap-1 border-b border-line">
        <TabChinh to={lienKetTab(BAO_CAO_CAN_BO)} chon={laCanBo}>
          {TEN_BAO_CAO[BAO_CAO_CAN_BO]}
        </TabChinh>
        <TabChinh to={lienKetTab(laCanBo ? BAO_CAO_TONG_HOP[0] : tab)} chon={!laCanBo}>
          Báo cáo tổng hợp
        </TabChinh>
      </nav>

      {laCanBo ? null : (
        <nav aria-label="Báo cáo tổng hợp" className="mt-3">
          <ul className="flex flex-wrap gap-2">
            {BAO_CAO_TONG_HOP.map((t) => (
              <li key={t}>
                <Link
                  to={lienKetTab(t)}
                  aria-current={t === tab ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-full border px-4 text-sm",
                    t === tab
                      ? "border-primary bg-primary-soft font-semibold text-primary"
                      : "border-line-strong text-ink-2 hover:text-ink",
                  )}
                >
                  {TEN_BAO_CAO[t]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="bao-cao-noi-dung">
        <BoLoc tab={tab} boLoc={boLoc} nhomLoc={nhomLoc} loc={loc} busy={busy} />

        {loi ? (
          <Notice tone="danger" className="mt-4">
            {loi}
          </Notice>
        ) : null}

        {duLieu?.loai === "ket-qua-thi" ? <BangKetQuaThi d={duLieu.data} /> : null}
        {duLieu?.loai === "don-vi" ? <BangDonVi d={duLieu.data} /> : null}
        {duLieu?.loai === "luyen-tap" ? <BangLuyenTap d={duLieu.data} /> : null}
        {duLieu?.loai === "cau-hoi-kho" ? <BangCauHoiKho d={duLieu.data} /> : null}
        {duLieu?.loai === "tien-do-hoc" ? <BangCanBo d={duLieu.data} loc={loc} /> : null}
      </div>
    </section>
  );
}

function TabChinh({ to, chon, children }: { to: string; chon: boolean; children: ReactNode }) {
  return (
    <Link
      to={to}
      aria-current={chon ? "page" : undefined}
      className={cn(
        "-mb-px flex min-h-11 shrink-0 items-center border-b-2 px-4 text-sm",
        chon ? "border-primary font-semibold text-primary" : "border-transparent text-ink-2 hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}

function BoLoc({
  tab,
  boLoc,
  nhomLoc,
  loc,
  busy,
}: {
  tab: LoaiBaoCao;
  boLoc: BoLocBaoCao;
  nhomLoc: NhomBoLoc[];
  loc: Record<string, string>;
  busy: boolean;
}) {
  const oChon = cn(inputClass, "pr-8");
  return (
    <Form method="get" className="bao-cao-bo-loc grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <h3 className="bao-cao-bo-loc-ten">
        <span>
          <Icon name="loc" sac="chinh" className="size-6" />
        </span>
        Tìm kiếm và lọc báo cáo
      </h3>
      <input type="hidden" name="tab" value={tab} />
      {tab === "tien-do-hoc" ? (
        <div className="sm:col-span-2">
          <Label htmlFor="bc-q">Tìm cán bộ</Label>
          <div className="bao-cao-tim">
            <Icon name="search" sac="trung" className="size-5" />
            <Input
              id="bc-q"
              name="q"
              type="search"
              maxLength={100}
              defaultValue={loc.q ?? ""}
              placeholder="Họ tên, tên đăng nhập hoặc số hiệu"
            />
          </div>
        </div>
      ) : null}
      {tab === "tien-do-hoc" ? (
        <div className="sm:col-span-2">
          <Label htmlFor="bc-nhom">Nhóm học cùng</Label>
          <select id="bc-nhom" name="nhom" defaultValue={loc.nhom ?? ""} className={oChon}>
            <option value="">Mọi người trong phạm vi</option>
            {nhomLoc.map((g) => (
              <option key={g.id} value={g.id}>
                {g.ten}
                {g.trang_thai === "luu_tru" ? " (đã lưu trữ)" : ""}
              </option>
            ))}
          </select>
        </div>
      ) : tab !== "luyen-tap" ? (
        <div className="sm:col-span-2">
          <Label htmlFor="bc-de-thi">Đề thi</Label>
          <select id="bc-de-thi" name="de_thi" defaultValue={loc.de_thi ?? ""} className={oChon}>
            {!CAN_DE_THI[tab] ? <option value="">Mọi đề thi và luyện tập</option> : null}
            {boLoc.de_thi.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code}: {d.title}
                {d.status === "dong" ? " (đã đóng)" : ""}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="sm:col-span-2">
          <Label htmlFor="bc-theo">Gom theo</Label>
          <select id="bc-theo" name="theo" defaultValue={loc.theo ?? "nguoi"} className={oChon}>
            {(Object.keys(TEN_NHOM_LUYEN_TAP) as NhomLuyenTap[]).map((k) => (
              <option key={k} value={k}>
                {TEN_NHOM_LUYEN_TAP[k]}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="sm:col-span-2">
        <Label htmlFor="bc-don-vi">Đơn vị (gồm cả đơn vị cấp dưới)</Label>
        <select id="bc-don-vi" name="don_vi" defaultValue={loc.don_vi ?? ""} className={oChon}>
          <option value="">Mọi đơn vị trong phạm vi</option>
          {boLoc.don_vi.map((d) => (
            <option key={d.id} value={d.id}>
              {"  ".repeat(
                Math.max(0, d.path.split(".").length - (boLoc.don_vi[0]?.path.split(".").length ?? 1)),
              )}
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="bc-tu">Từ ngày</Label>
        <Input id="bc-tu" name="tu" type="date" defaultValue={loc.tu ?? ""} />
      </div>
      <div>
        <Label htmlFor="bc-den">Đến ngày</Label>
        <Input id="bc-den" name="den" type="date" defaultValue={loc.den ?? ""} />
      </div>
      {tab === "cau-hoi-kho" ? (
        <div>
          <Label htmlFor="bc-toi-thieu">Tối thiểu số lượt</Label>
          <Input
            id="bc-toi-thieu"
            name="toi_thieu"
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            defaultValue={loc.toi_thieu}
          />
        </div>
      ) : null}
      <div className="flex items-end">
        <Button type="submit" icon="chart" className="bao-cao-xem w-full" disabled={busy}>
          {busy ? "Đang tải" : "Xem báo cáo"}
        </Button>
      </div>
    </Form>
  );
}

/* ------------------------------------------------------------------ */
/* Bảng                                                                */
/* ------------------------------------------------------------------ */

const MOI_TRANG = 10;

/**
 * Chia bảng danh sách người thành trang theo `?trang=` trên URL. Chỉ cắt phần hiển thị: số liệu tóm
 * tắt và tệp tải về vẫn tính đủ mọi dòng. Bấm "Xem báo cáo" hoặc đổi tab thì về trang 1.
 */
function usePhanTrang<T>(dong: T[], moiTrang = MOI_TRANG) {
  const [p] = useSearchParams();
  const soTrang = Math.max(1, Math.ceil(dong.length / moiTrang));
  const trang = Math.min(soTrang, Math.max(1, Number.parseInt(p.get("trang") ?? "", 10) || 1));
  const lienKet = (t: number) => {
    const q = new URLSearchParams(p);
    q.set("trang", String(t));
    return `/quan-tri/bao-cao?${q}`;
  };
  const thanh =
    soTrang > 1 ? (
      <nav aria-label="Phân trang" className="mt-4 flex flex-wrap items-center justify-between gap-2">
        {trang > 1 ? (
          <Link to={lienKet(trang - 1)} className={buttonClass({ variant: "secondary" })}>
            Trang trước
          </Link>
        ) : (
          <span />
        )}
        <span className="text-sm text-ink-2">
          Trang {trang}/{soTrang}
        </span>
        {trang < soTrang ? (
          <Link to={lienKet(trang + 1)} className={buttonClass({ variant: "secondary" })}>
            Trang sau
          </Link>
        ) : (
          <span />
        )}
      </nav>
    ) : null;
  return { dong: dong.slice((trang - 1) * moiTrang, trang * moiTrang), thanh };
}

function BangKetQuaThi({ d }: { d: KetQuaDeThi }) {
  const pt = usePhanTrang(d.dong);
  return (
    <>
      <TomTat
        muc={[
          { nhan: "Số người đã làm", giaTri: soVn(d.tong_hop.so_nguoi) },
          { nhan: "Điểm trung bình", giaTri: soVn(d.tong_hop.diem_trung_binh) },
          { nhan: "Số người đạt", giaTri: soVn(d.tong_hop.so_dat) },
          { nhan: "Tỷ lệ đạt", giaTri: soVn(d.tong_hop.ty_le_dat, "%") },
        ]}
      />
      <p className="mt-3 text-sm text-ink-2">
        Mỗi người tính lượt có điểm cao nhất. Ngưỡng đạt {d.de.pass_score} điểm.
      </p>
      {d.dong.length === 0 ? (
        <Trong />
      ) : (
        <>
          <KhungBang minRem={48}>
            <thead className="text-ink-3">
              <tr>
                <th className={cn(TH, SO)}>Hạng</th>
                <th className={cn(TH, DINH)}>Họ tên</th>
                <th className={TH}>Đơn vị</th>
                <th className={cn(TH, SO)}>Điểm</th>
                <th className={TH}>Kết quả</th>
                <th className={TH}>Thời gian làm</th>
                <th className={cn(TH, SO)}>Số lần</th>
                <th className={TH}>Nộp lúc</th>
              </tr>
            </thead>
            <tbody>
              {pt.dong.map((r, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: bảng chỉ đọc, thứ tự do máy chủ xếp
                <tr key={i} className="border-t border-line">
                  <td className={cn(TD, SO)}>{r.xep_hang}</td>
                  <td className={cn(TD, DINH)}>
                    {r.ho_ten}
                    {r.cap_bac ? <span className="block text-ink-3">{r.cap_bac}</span> : null}
                  </td>
                  <td className={TD}>{r.don_vi ?? "—"}</td>
                  <td className={cn(TD, SO, "font-semibold")}>{soVn(r.diem)}</td>
                  <td className={TD}>
                    <Badge tone={r.dat ? "ok" : "danger"}>{r.dat ? "Đạt" : "Không đạt"}</Badge>
                  </td>
                  <td className={TD}>{r.thoi_gian_lam}</td>
                  <td className={cn(TD, SO)}>{r.so_lan}</td>
                  <td className={TD}>{formatNgayGio(r.nop_luc)}</td>
                </tr>
              ))}
            </tbody>
          </KhungBang>
          {pt.thanh}
        </>
      )}
    </>
  );
}

function BangDonVi({ d }: { d: TongHopDonVi }) {
  if (d.dong.length === 0) return <Trong />;
  return (
    <>
      <p className="mt-4 text-sm text-ink-2">
        Các đơn vị cùng cấp ngay dưới đơn vị đang chọn; mỗi dòng cộng cả đơn vị cấp dưới. Xếp hạng theo tỷ lệ
        đạt, rồi điểm trung bình; đơn vị chưa ai làm không xếp hạng.
      </p>
      <KhungBang minRem={44}>
        <thead className="text-ink-3">
          <tr>
            <th className={cn(TH, SO)}>Hạng</th>
            <th className={cn(TH, DINH)}>Đơn vị</th>
            <th className={cn(TH, SO)}>Được giao</th>
            <th className={cn(TH, SO)}>Đã làm</th>
            <th className={cn(TH, SO)}>Hoàn thành</th>
            <th className={cn(TH, SO)}>Tỷ lệ đạt</th>
            <th className={cn(TH, SO)}>Điểm TB</th>
          </tr>
        </thead>
        <tbody>
          {d.dong.map((r) => (
            <tr key={r.don_vi_id} className="border-t border-line">
              <td className={cn(TD, SO)}>{r.xep_hang ?? "—"}</td>
              <td className={cn(TD, DINH)}>
                <Link
                  to={`/quan-tri/bao-cao?tab=don-vi&de_thi=${d.de.id}&don_vi=${r.don_vi_id}`}
                  className="text-primary hover:underline"
                >
                  {r.don_vi}
                </Link>
              </td>
              <td className={cn(TD, SO)}>{r.so_duoc_giao}</td>
              <td className={cn(TD, SO)}>{r.so_da_lam}</td>
              <td className={cn(TD, SO)}>{soVn(r.ty_le_hoan_thanh, "%")}</td>
              <td className={cn(TD, SO)}>
                {soVn(r.ty_le_dat, "%")} <span className="text-ink-3">({r.so_dat})</span>
              </td>
              <td className={cn(TD, SO, "font-semibold")}>{soVn(r.diem_trung_binh)}</td>
            </tr>
          ))}
        </tbody>
      </KhungBang>
    </>
  );
}

function BangLuyenTap({ d }: { d: BaoCaoLuyenTap }) {
  // Chỉ phân trang khi mỗi dòng là một người; gom theo chủ đề, đơn vị thì hiện đủ.
  const pt = usePhanTrang(d.dong, d.theo === "nguoi" ? MOI_TRANG : Number.POSITIVE_INFINITY);
  if (d.dong.length === 0) return <Trong />;
  return (
    <>
      <KhungBang minRem={d.theo === "nguoi" ? 40 : 30}>
        <thead className="text-ink-3">
          <tr>
            <th className={cn(TH, DINH)}>{TEN_NHOM_LUYEN_TAP[d.theo]}</th>
            {d.theo === "nguoi" ? <th className={TH}>Đơn vị</th> : null}
            <th className={cn(TH, SO)}>Số phiên</th>
            <th className={cn(TH, SO)}>Số câu</th>
            <th className={cn(TH, SO)}>Câu đúng</th>
            <th className={cn(TH, SO)}>Tỷ lệ đúng</th>
          </tr>
        </thead>
        <tbody>
          {pt.dong.map((r, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: bảng chỉ đọc, thứ tự do máy chủ xếp
            <tr key={i} className="border-t border-line">
              <td className={cn(TD, DINH)}>{r.nhom}</td>
              {d.theo === "nguoi" ? <td className={TD}>{r.don_vi ?? "—"}</td> : null}
              <td className={cn(TD, SO)}>{r.so_phien}</td>
              <td className={cn(TD, SO)}>{r.so_cau}</td>
              <td className={cn(TD, SO)}>{r.so_dung}</td>
              <td className={cn(TD, SO, "font-semibold")}>{soVn(r.ty_le_dung, "%")}</td>
            </tr>
          ))}
        </tbody>
      </KhungBang>
      {pt.thanh}
    </>
  );
}

function BangCauHoiKho({ d }: { d: BaoCaoCauHoiKho }) {
  if (d.dong.length === 0) return <Trong />;
  return (
    <>
      <p className="mt-4 text-sm text-ink-2">
        Gộp câu trả lời thi và luyện tập; chỉ tính câu có từ {d.toi_thieu} lượt trả lời trở lên.
      </p>
      <KhungBang minRem={44}>
        <thead className="text-ink-3">
          <tr>
            <th className={TH}>Câu hỏi</th>
            <th className={TH}>Chủ đề</th>
            <th className={cn(TH, SO)}>Số lượt</th>
            <th className={cn(TH, SO)}>Tỷ lệ sai</th>
            <th className={TH}>Nhận xét</th>
          </tr>
        </thead>
        <tbody>
          {d.dong.map((r) => (
            <tr key={r.cau_hoi_id} className="border-t border-line">
              <td className={TD}>
                <Link
                  to={`/quan-tri/cau-hoi/${r.cau_hoi_id}`}
                  className="font-mono text-primary hover:underline"
                >
                  {r.ma_cau}
                </Link>
                <span className="mt-0.5 line-clamp-2 block">{r.cau_hoi}</span>
              </td>
              <td className={TD}>
                {r.chu_de ?? "—"}
                <span className="block text-ink-3">{r.muc_do}</span>
              </td>
              <td className={cn(TD, SO)}>{r.so_luot}</td>
              <td className={cn(TD, SO, "font-semibold")}>{soVn(r.ty_le_sai, "%")}</td>
              <td className={TD}>{r.nhan_xet}</td>
            </tr>
          ))}
        </tbody>
      </KhungBang>
    </>
  );
}

/**
 * Danh sách cán bộ: mỗi người một dòng, bấm tên mở hồ sơ chi tiết. Bảng trên màn hình gọn hơn tệp
 * tải về (tệp có đủ 13 cột); cột nhóm học cùng chỉ hiện khi đang lọc theo một nhóm.
 */
function BangCanBo({ d, loc }: { d: BaoCaoTienDoHoc; loc: Record<string, string> }) {
  type Dong = BaoCaoTienDoHoc["dong"][number];
  const chuaNop = (r: Dong) => r.bai_thi_duoc_giao - r.bai_thi_da_nop;
  const tyLeDat = (r: Dong) => (r.bai_thi_duoc_giao ? r.bai_thi_dat / r.bai_thi_duoc_giao : 0);
  // Người tốt nhất lên đầu; chưa có số liệu xếp cuối. Array.prototype.sort ổn định: người bằng nhau
  // giữ thứ tự đơn vị, họ tên của API (tệp tải về vẫn theo thứ tự đó).
  const xepHang = [...d.dong].sort(
    (a, b) =>
      tyLeDat(b) - tyLeDat(a) ||
      (b.phan_tram_bai_hoc ?? -1) - (a.phan_tram_bai_hoc ?? -1) ||
      (b.ty_le_dung ?? -1) - (a.ty_le_dung ?? -1),
  );
  const pt = usePhanTrang(xepHang);
  return (
    <>
      <TomTat
        muc={[
          { icon: "nhom", nhan: "Số cán bộ", giaTri: soVn(d.dong.length) },
          {
            icon: "cap",
            nhan: "Chưa học lần nào",
            giaTri: soVn(d.dong.filter((r) => !r.lan_hoc_gan_nhat).length),
          },
          {
            icon: "taiLieu",
            nhan: "Còn đề chưa nộp",
            giaTri: soVn(d.dong.filter((r) => chuaNop(r) > 0).length),
          },
          {
            icon: "alert",
            nhan: "Có đề chưa đạt",
            giaTri: soVn(d.dong.filter((r) => r.bai_thi_da_nop > r.bai_thi_dat).length),
          },
        ]}
      />
      <p className="mt-3 text-sm text-ink-2">
        {d.nhom ? `Chỉ gồm thành viên nhóm "${d.nhom.ten}" thuộc phạm vi quản lý. ` : null}
        Bấm tên cán bộ để xem chi tiết từng bài thi, chuyên đề, chủ đề luyện tập. Khoảng ngày áp cho bài học
        đã xong, câu trả lời luyện tập và bài thi đã nộp; số đề được giao và lần học gần nhất không lọc theo
        ngày. Danh sách xếp người tốt nhất lên đầu: tỷ lệ bài thi đạt, rồi bài học, rồi luyện tập.
      </p>
      {d.dong.length === 0 ? (
        <Trong />
      ) : (
        <>
          <KhungBang minRem={d.nhom ? 56 : 50}>
            <thead className="text-ink-3">
              <tr>
                <th scope="col" className={cn(TH, DINH)}>
                  Họ tên
                </th>
                <th scope="col" className={TH}>
                  Đơn vị
                </th>
                <th scope="col" className={cn(TH, SO)}>
                  Bài học
                </th>
                <th scope="col" className={cn(TH, SO)}>
                  Luyện tập
                </th>
                <th scope="col" className={cn(TH, SO)}>
                  Bài thi đạt
                </th>
                {d.nhom ? (
                  <th scope="col" className={cn(TH, SO)}>
                    Nhóm
                  </th>
                ) : null}
                <th scope="col" className={TH}>
                  Học gần nhất
                </th>
              </tr>
            </thead>
            <tbody>
              {pt.dong.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className={cn(TD, DINH)}>
                    <Link to={duongHoSoCanBo(r.id, loc)} className="font-semibold text-ink hover:underline">
                      {r.ho_ten}
                    </Link>
                    {r.cap_bac ? <span className="block text-ink-3">{r.cap_bac}</span> : null}
                  </td>
                  <td className={TD}>{r.don_vi}</td>
                  <td className={cn(TD, SO)}>
                    <span className="font-semibold">{soVn(r.phan_tram_bai_hoc, "%")}</span>
                    <span className="block text-ink-3">
                      {r.bai_xong}/{r.bai_ghi_danh} bài
                    </span>
                  </td>
                  <td className={cn(TD, SO)}>
                    <span className="font-semibold">{soVn(r.ty_le_dung, "%")}</span>
                    <span className="block text-ink-3">{r.so_phien} phiên</span>
                  </td>
                  <td className={cn(TD, SO)}>
                    <span className="font-semibold">
                      {r.bai_thi_dat}/{r.bai_thi_duoc_giao}
                    </span>
                    {chuaNop(r) > 0 ? (
                      <span className="block text-warn">{chuaNop(r)} đề chưa nộp</span>
                    ) : r.bai_thi_duoc_giao > 0 ? (
                      <span className="block text-ink-3">đã nộp đủ</span>
                    ) : null}
                  </td>
                  {d.nhom ? <td className={cn(TD, SO)}>{soVn(r.phan_tram_nhom, "%")}</td> : null}
                  <td className={TD}>
                    {r.lan_hoc_gan_nhat ? (
                      formatNgayGio(r.lan_hoc_gan_nhat)
                    ) : (
                      <Badge tone="warn">Chưa học</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </KhungBang>
          {pt.thanh}
        </>
      )}
    </>
  );
}
