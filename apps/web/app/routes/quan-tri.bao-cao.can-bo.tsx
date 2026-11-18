/**
 * Hồ sơ học tập của một cán bộ, mở từ danh sách cán bộ ở trang Báo cáo hoặc từ trang Tổng quan:
 * bài thi (từng đề), bài học (từng chuyên đề) và luyện tập (từng chủ đề).
 * Lọc được theo khoảng ngày; tải về Excel hoặc PDF.
 *
 * Phạm vi do API kiểm: cán bộ ngoài cây đơn vị của người xem trả 403, hiện trang "Không đủ quyền".
 */
import type { ReactNode } from "react";
import { Form, Link, useNavigation } from "react-router";
import { DINH, KhungBang, SO, TD, TH, TomTat, Trong } from "../components/quan-tri/BangBaoCao";
import { Badge } from "../components/ui/Badge";
import { Button, buttonClass } from "../components/ui/Button";
import { Input, Label, Notice } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { TieuDeTrang } from "../components/ui/KhungTrang";
import { type ChuDeManhYeu, type HoSoCanBo, soVn, TONE_TRANG_THAI_BAI_THI } from "../lib/bao-cao";
import { cn } from "../lib/cn";
import { formatNgayGio } from "../lib/format";
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/quan-tri.bao-cao.can-bo";

export function meta({ data }: Route.MetaArgs) {
  return pageMeta(data?.hoSo ? `Hồ sơ ${data.hoSo.nguoi.ho_ten}` : "Hồ sơ cán bộ", { index: false });
}

const NGAY = /^\d{4}-\d{2}-\d{2}$/;

export async function loader({ request, params }: Route.LoaderArgs) {
  const { token } = await yeuCauVaiTro(request, "lanh_dao");
  const p = new URL(request.url).searchParams;
  const loc: { tu?: string; den?: string } = {};
  for (const k of ["tu", "den"] as const) {
    const v = p.get(k);
    if (v && NGAY.test(v)) loc[k] = v;
  }
  try {
    const hoSo = await goiApiQuanTri<HoSoCanBo>(
      token,
      `/v1/bao-cao/can-bo/${encodeURIComponent(params.id)}?${new URLSearchParams(loc)}`,
    );
    return { hoSo, loi: null, loc };
  } catch (err) {
    if (!(err instanceof LoiApi)) throw err;
    return { hoSo: null, loi: err.message, loc };
  }
}

export default function HoSoCanBoTrang({ loaderData, params }: Route.ComponentProps) {
  const { hoSo, loi, loc } = loaderData;
  const busy = useNavigation().state !== "idle";
  const qsLoc = new URLSearchParams(loc).toString();
  const veDanhSach = `/quan-tri/bao-cao${qsLoc ? `?${qsLoc}` : ""}`;
  const duongTai = (dinhDang: "xlsx" | "pdf") =>
    `/quan-tri/bao-cao/can-bo/${params.id}/tai?${new URLSearchParams({ ...loc, dinh_dang: dinhDang })}`;

  return (
    <section>
      <p>
        <Link
          to={veDanhSach}
          className="inline-flex min-h-11 items-center gap-1 text-sm text-ink-2 underline"
        >
          <Icon name="arrowLeft" className="size-4" />
          Danh sách cán bộ
        </Link>
      </p>

      {loi ? (
        <Notice tone="danger" className="mt-2">
          {loi}
        </Notice>
      ) : null}

      {hoSo ? (
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <TieuDeTrang as="h2" icon="shield" className="text-xl font-semibold">
              {hoSo.nguoi.ho_ten}
            </TieuDeTrang>
            <p className="mt-1 text-sm text-ink-2">
              {[
                hoSo.nguoi.cap_bac,
                hoSo.nguoi.so_hieu ? `Số hiệu ${hoSo.nguoi.so_hieu}` : null,
                hoSo.nguoi.don_vi,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={duongTai("xlsx")} className={buttonClass()}>
              Tải Excel
            </a>
            <a href={duongTai("pdf")} className={buttonClass({ variant: "secondary" })}>
              Tải PDF
            </a>
          </div>
        </div>
      ) : null}

      {/* Bộ lọc hiện cả khi API báo lỗi (ví dụ ngày bắt đầu sau ngày kết thúc), để sửa lại được. */}
      <Form method="get" className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <Label htmlFor="hs-tu">Từ ngày</Label>
          <Input id="hs-tu" name="tu" type="date" defaultValue={loc.tu ?? ""} />
        </div>
        <div>
          <Label htmlFor="hs-den">Đến ngày</Label>
          <Input id="hs-den" name="den" type="date" defaultValue={loc.den ?? ""} />
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="secondary" className="w-full" disabled={busy}>
            {busy ? "Đang tải" : "Xem"}
          </Button>
        </div>
      </Form>

      {hoSo ? (
        <div className={cn(busy && "opacity-60")} aria-busy={busy}>
          <TomTat
            muc={[
              {
                nhan: "Bài học đã xong",
                giaTri: `${hoSo.tong_quan.bai_xong}/${hoSo.tong_quan.bai_ghi_danh}`,
                phu: soVn(hoSo.tong_quan.phan_tram_bai_hoc, "%"),
              },
              {
                nhan: "Luyện tập đúng",
                giaTri: soVn(hoSo.tong_quan.ty_le_dung, "%"),
                phu: `${hoSo.tong_quan.so_phien} phiên, ${hoSo.tong_quan.so_cau} câu`,
              },
              {
                nhan: "Bài thi đạt",
                giaTri: `${hoSo.tong_quan.bai_thi_dat}/${hoSo.tong_quan.bai_thi_duoc_giao}`,
                phu: `đã nộp ${hoSo.tong_quan.bai_thi_da_nop} đề`,
                canhBao: hoSo.tong_quan.bai_thi_duoc_giao > hoSo.tong_quan.bai_thi_da_nop,
              },
              {
                nhan: "Học gần nhất",
                giaTri: hoSo.tong_quan.lan_hoc_gan_nhat
                  ? formatNgayGio(hoSo.tong_quan.lan_hoc_gan_nhat)
                  : "Chưa học",
                canhBao: !hoSo.tong_quan.lan_hoc_gan_nhat,
              },
            ]}
          />
          <p className="mt-3 text-sm text-ink-2">
            Khoảng ngày áp cho bài thi đã nộp, bài học đã xong, bài tập và câu trả lời luyện tập. Số đề được
            giao, chủ đề mạnh yếu và lần học gần nhất không lọc theo ngày.
          </p>

          <BaiThi ds={hoSo.bai_thi} />
          <BaiHoc ds={hoSo.bai_hoc} />
          <LuyenTap lt={hoSo.luyen_tap} />
        </div>
      ) : null}
    </section>
  );
}

function Phan({ id, tieuDe, children }: { id: string; tieuDe: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-8">
      <h3 id={id} className="font-sans text-lg font-semibold">
        {tieuDe}
      </h3>
      {children}
    </section>
  );
}

function BaiThi({ ds }: { ds: HoSoCanBo["bai_thi"] }) {
  return (
    <Phan id="hs-bai-thi" tieuDe="Bài thi">
      {ds.length === 0 ? (
        <Trong title="Chưa được giao đề thi nào" />
      ) : (
        <KhungBang minRem={50}>
          <thead className="text-ink-3">
            <tr>
              <th scope="col" className={cn(TH, DINH)}>
                Đề thi
              </th>
              <th scope="col" className={TH}>
                Kết quả
              </th>
              <th scope="col" className={cn(TH, SO)}>
                Điểm
              </th>
              <th scope="col" className={cn(TH, SO)}>
                Câu đúng
              </th>
              <th scope="col" className={cn(TH, SO)}>
                Tự luận
              </th>
              <th scope="col" className={cn(TH, SO)}>
                Số lần
              </th>
              <th scope="col" className={TH}>
                Hạn làm bài
              </th>
              <th scope="col" className={TH}>
                Nộp lúc
              </th>
            </tr>
          </thead>
          <tbody>
            {ds.map((b) => (
              <tr key={b.de_thi_id} className="border-t border-line">
                <td className={cn(TD, DINH)}>
                  {b.ten_de}
                  <span className="block font-mono text-ink-3">{b.ma_de}</span>
                </td>
                <td className={TD}>
                  <Badge tone={TONE_TRANG_THAI_BAI_THI[b.trang_thai]}>{b.ket_qua}</Badge>
                </td>
                <td className={cn(TD, SO)}>
                  <span className="font-semibold">{soVn(b.diem)}</span>
                  <span className="block text-ink-3">đạt từ {b.nguong_dat}</span>
                </td>
                <td className={cn(TD, SO)}>
                  {b.so_cau_dung === null || b.so_cau === null ? "—" : `${b.so_cau_dung}/${b.so_cau}`}
                </td>
                <td className={cn(TD, SO)}>
                  {b.tu_luan_toi_da === null ? "—" : `${soVn(b.diem_tu_luan)}/${soVn(b.tu_luan_toi_da)}`}
                </td>
                <td className={cn(TD, SO)}>{b.so_lan}</td>
                <td className={TD}>{b.duoc_giao ? formatNgayGio(b.han) : "Bài giao đã hủy"}</td>
                <td className={TD}>{formatNgayGio(b.nop_luc)}</td>
              </tr>
            ))}
          </tbody>
        </KhungBang>
      )}
      {ds.length ? (
        <p className="mt-2 text-sm text-ink-3">
          Điểm và số câu đúng lấy ở lượt đã nộp có điểm cao nhất; cột Tự luận là điểm phần tự luận của lượt
          đó.
        </p>
      ) : null}
    </Phan>
  );
}

function BaiHoc({ ds }: { ds: HoSoCanBo["bai_hoc"] }) {
  return (
    <Phan id="hs-bai-hoc" tieuDe="Bài học">
      {ds.length === 0 ? (
        <Trong title="Chưa ghi danh chuyên đề nào" />
      ) : (
        <KhungBang minRem={44}>
          <thead className="text-ink-3">
            <tr>
              <th scope="col" className={cn(TH, DINH)}>
                Chuyên đề
              </th>
              <th scope="col" className={cn(TH, SO)}>
                Bài đã xong
              </th>
              <th scope="col" className={cn(TH, SO)}>
                Bài tập đã làm
              </th>
              <th scope="col" className={cn(TH, SO)}>
                Điểm bài tập
              </th>
              <th scope="col" className={TH}>
                Học gần nhất
              </th>
            </tr>
          </thead>
          <tbody>
            {ds.map((b) => (
              <tr key={b.chuyen_de_id} className="border-t border-line">
                <td className={cn(TD, DINH)}>{b.chuyen_de}</td>
                <td className={cn(TD, SO)}>
                  <span className="font-semibold">{soVn(b.phan_tram, "%")}</span>
                  <span className="block text-ink-3">
                    {b.bai_xong}/{b.tong_bai} bài
                  </span>
                </td>
                <td className={cn(TD, SO)}>
                  {b.so_bai_tap}
                  {b.so_tu_luan ? <span className="block text-ink-3">{b.so_tu_luan} bài tự luận</span> : null}
                </td>
                <td className={cn(TD, SO, "font-semibold")}>{soVn(b.diem_bai_tap, "%")}</td>
                <td className={TD}>{formatNgayGio(b.lan_hoc_gan_nhat)}</td>
              </tr>
            ))}
          </tbody>
        </KhungBang>
      )}
    </Phan>
  );
}

function DanhSachChuDe({ nhan, ds, tone }: { nhan: string; ds: ChuDeManhYeu[]; tone: "ok" | "warn" }) {
  return (
    <div className="rounded-card border border-line bg-surface p-3">
      <h4 className="font-sans text-sm font-semibold text-ink-2">{nhan}</h4>
      {ds.length === 0 ? (
        <p className="mt-2 text-sm text-ink-3">Chưa đủ lượt trả lời để xếp.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {ds.map((c) => (
            <li key={c.ten} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0">{c.ten}</span>
              <span className="shrink-0 text-ink-3">
                <Badge tone={tone}>{c.diem}%</Badge> {c.so_dung}/{c.so_luot} đúng
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LuyenTap({ lt }: { lt: HoSoCanBo["luyen_tap"] }) {
  return (
    <Phan id="hs-luyen-tap" tieuDe="Luyện tập">
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <DanhSachChuDe nhan="Chủ đề mạnh" ds={lt.manh} tone="ok" />
        <DanhSachChuDe nhan="Chủ đề yếu" ds={lt.yeu} tone="warn" />
      </div>
      <p className="mt-2 text-sm text-ink-3">
        Chủ đề mạnh, yếu tính từ mọi câu trả lời (luyện tập và thi), ưu tiên lượt gần đây.
      </p>
      {lt.chu_de.length === 0 ? (
        <Trong title="Chưa có câu trả lời luyện tập nào" />
      ) : (
        <KhungBang minRem={34}>
          <thead className="text-ink-3">
            <tr>
              <th scope="col" className={cn(TH, DINH)}>
                Chủ đề
              </th>
              <th scope="col" className={cn(TH, SO)}>
                Số phiên
              </th>
              <th scope="col" className={cn(TH, SO)}>
                Số câu
              </th>
              <th scope="col" className={cn(TH, SO)}>
                Câu đúng
              </th>
              <th scope="col" className={cn(TH, SO)}>
                Tỷ lệ đúng
              </th>
            </tr>
          </thead>
          <tbody>
            {lt.chu_de.map((c) => (
              <tr key={c.chu_de} className="border-t border-line">
                <td className={cn(TD, DINH)}>{c.chu_de}</td>
                <td className={cn(TD, SO)}>{c.so_phien}</td>
                <td className={cn(TD, SO)}>{c.so_cau}</td>
                <td className={cn(TD, SO)}>{c.so_dung}</td>
                <td className={cn(TD, SO, "font-semibold")}>{soVn(c.ty_le_dung, "%")}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line-strong font-semibold">
              <th scope="row" className={cn(TD, DINH, "text-left")}>
                Tổng
              </th>
              <td className={cn(TD, SO)}>{lt.so_phien}</td>
              <td className={cn(TD, SO)}>{lt.so_cau}</td>
              <td className={cn(TD, SO)}>{lt.so_dung}</td>
              <td className={cn(TD, SO)}>{soVn(lt.ty_le_dung, "%")}</td>
            </tr>
          </tfoot>
        </KhungBang>
      )}
    </Phan>
  );
}
