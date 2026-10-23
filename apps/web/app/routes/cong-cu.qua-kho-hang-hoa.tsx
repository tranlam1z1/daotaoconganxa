/**
 * Tính quá khổ hàng hóa: chọn loại thùng xe, nhập kích thước xếp hàng đo được (m) và thông số của
 * xe, ra phần vượt giới hạn xếp hàng từng chiều và khung xử phạt (lib/qua-kho.ts). Khai riêng trong
 * routes.ts nên thắng route chung cong-cu/:ma.
 */
import { useState } from "react";
import { Form, useNavigation } from "react-router";
import { DauTrangCongCu, lopLuaChon, ONhapSo } from "../components/cong-cu/BieuMau";
import { DongCanCu, LuuYDoiChieu, TheKhungPhat } from "../components/cong-cu/TheKhungPhat";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Notice } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { KhungTrang } from "../components/ui/KhungTrang";
import { docSoLe } from "../lib/doc-so";
import {
  LOAI_THUNG,
  type LoaiThung,
  laLoaiThung,
  type NhapQuaKho,
  type SoSanhKho,
  tinhQuaKho,
} from "../lib/qua-kho";
import { pageMeta } from "../lib/site";
import { docSoKg } from "../lib/tinh-qua-tai";
import type { Route } from "./+types/cong-cu.qua-kho-hang-hoa";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Tính quá khổ hàng hóa", {
    description:
      "Tính phần hàng hóa vượt quá chiều cao, chiều rộng, chiều dài xếp hàng cho phép của xe ô tô tải.",
  });
}

const DS_LOAI = Object.keys(LOAI_THUNG) as LoaiThung[];
/** Tên tham số trên URL, cũng là `name` của các ô nhập. */
const O = ["cao_do", "hang", "cao_thung", "rong_do", "rong_thung", "dai_do", "dai_xe"] as const;

const met = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 3 });
const phanTram = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

export function loader({ request }: Route.LoaderArgs) {
  const sp = new URL(request.url).searchParams;
  const l = sp.get("loai");
  const loai: LoaiThung = laLoaiThung(l) ? l : "khong-mui";
  const nhap = Object.fromEntries(O.map((o) => [o, sp.get(o) ?? ""])) as Record<(typeof O)[number], string>;
  if (!sp.has("cao_do")) return { loai, nhap, loi: null, kq: null };
  const loi = (m: string) => ({ loai, nhap, loi: m, kq: null });

  /** Đọc một ô theo mét; ô trống trả undefined, ô sai trả null. */
  const m = (o: (typeof O)[number]) => {
    const v = nhap[o].trim();
    if (!v) return undefined;
    const n = docSoLe(v);
    return n !== null && n > 0 ? n : null;
  };
  const so: NhapQuaKho = { loai };

  const caoDo = m("cao_do");
  if (caoDo === null) return loi("Chiều cao xếp hàng không hợp lệ. Hãy nhập số mét lớn hơn 0, ví dụ 4,35.");
  if (caoDo !== undefined) {
    so.cao = { doDuoc: caoDo };
    if (loai === "khong-mui") {
      const hang = docSoKg(nhap.hang);
      if (hang === null || hang <= 0) {
        return loi(
          "Hãy nhập khối lượng hàng chuyên chở theo thiết kế (số kg lớn hơn 0) để xác định chiều cao cho phép.",
        );
      }
      so.cao.hangKg = hang;
    } else if (loai === "co-mui") {
      const caoThung = m("cao_thung");
      if (!caoThung) return loi("Hãy nhập chiều cao giới hạn của thùng xe theo thiết kế (số mét lớn hơn 0).");
      so.cao.caoThung = caoThung;
    }
  }

  const rongDo = m("rong_do");
  const rongThung = m("rong_thung");
  if (rongDo !== undefined || rongThung !== undefined) {
    if (!rongDo || !rongThung) {
      return loi(
        "Chiều rộng: hãy nhập đủ chiều rộng xếp hàng đo được và chiều rộng thùng xe (số mét lớn hơn 0).",
      );
    }
    so.rong = { doDuoc: rongDo, rongThung };
  }

  const daiDo = m("dai_do");
  const daiXe = m("dai_xe");
  if (daiDo !== undefined || daiXe !== undefined) {
    if (!daiDo || !daiXe) {
      return loi(
        "Chiều dài: hãy nhập đủ chiều dài xếp hàng đo được và chiều dài toàn bộ của xe (số mét lớn hơn 0).",
      );
    }
    so.dai = { doDuoc: daiDo, daiXe };
  }

  if (!so.cao && !so.rong && !so.dai) return loi("Hãy nhập ít nhất một chiều xếp hàng đã đo.");
  return { loai, nhap, loi: null, kq: tinhQuaKho(so) };
}

function TheChieu({ c }: { c: SoSanhKho }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{c.ten}</h3>
        {c.viPham ? <Badge tone="danger">Vượt giới hạn</Badge> : <Badge tone="ok">Trong giới hạn</Badge>}
      </div>
      <dl className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-sm font-medium text-ink-2">Giới hạn</dt>
          <dd className="mt-1 text-xl font-bold tabular-nums [overflow-wrap:anywhere]">{met(c.gioiHan)} m</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-ink-2">Đo được</dt>
          <dd className="mt-1 text-xl font-bold tabular-nums [overflow-wrap:anywhere]">{met(c.doDuoc)} m</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-ink-2">{c.viPham ? "Vượt" : "Còn dưới giới hạn"}</dt>
          <dd
            className={`mt-1 text-xl font-bold tabular-nums [overflow-wrap:anywhere] ${c.viPham ? "text-danger" : ""}`}
          >
            {met(Math.abs(c.vuot))} m
            {c.viPham ? <span className="text-sm font-medium"> ({phanTram(c.phanTram)}%)</span> : null}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-ink-2">Giới hạn: {c.moTaGioiHan}.</p>
      <DongCanCu nhan={c.canCuGioiHan} daDoiChieu={false} />
    </Card>
  );
}

export default function QuaKhoHangHoa({ loaderData }: Route.ComponentProps) {
  const { loai: loaiDaTinh, nhap, loi, kq } = loaderData;
  const busy = useNavigation().state !== "idle";
  const [loai, datLoai] = useState<LoaiThung>(loaiDaTinh);
  // Đổi loại thùng thì ẩn kết quả và lỗi của lần tính trước; lần tính mới (loaderData mới) hiện lại.
  const [anKetQua, datAnKetQua] = useState(false);
  const [duLieuTruoc, datDuLieuTruoc] = useState(loaderData);
  if (duLieuTruoc !== loaderData) {
    datDuLieuTruoc(loaderData);
    datAnKetQua(false);
  }

  return (
    <KhungTrang className="wrap max-w-3xl py-6 sm:py-10">
      <DauTrangCongCu tieuDe="Tính quá khổ hàng hóa">
        Nhập kích thước xếp hàng đo được theo mét. Chiều nào không đo thì để trống cả hai ô của chiều đó.
      </DauTrangCongCu>

      <Form method="get" action="/cong-cu/qua-kho-hang-hoa" replace className="mt-5 grid gap-5">
        <fieldset className="grid gap-2 sm:grid-cols-3">
          <legend className="mb-1.5 text-base font-medium">Loại thùng xe</legend>
          {DS_LOAI.map((ma) => (
            <label key={ma} className={lopLuaChon}>
              <input
                type="radio"
                name="loai"
                value={ma}
                checked={loai === ma}
                onChange={() => {
                  datLoai(ma);
                  datAnKetQua(true);
                }}
                className="size-5 shrink-0"
              />
              <span className="min-w-0">
                <span className="block font-medium">{LOAI_THUNG[ma].ten}</span>
                <span className="block text-sm text-ink-2">{LOAI_THUNG[ma].moTa}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-1.5 text-base font-semibold">Chiều cao</legend>
          <ONhapSo
            name="cao_do"
            nhan="Chiều cao xếp hàng đo được (m)"
            giaTri={nhap.cao_do}
            goiY={
              loai === "co-mui"
                ? "Đo cùng mốc với chiều cao giới hạn của thùng xe."
                : "Tính từ điểm cao nhất của mặt đường xe chạy trở lên."
            }
          />
          {loai === "khong-mui" ? (
            <ONhapSo
              name="hang"
              nhan="Khối lượng hàng chuyên chở theo thiết kế (kg)"
              giaTri={nhap.hang}
              goiY="Ghi trong giấy chứng nhận kiểm định; dùng để xác định chiều cao cho phép."
            />
          ) : null}
          {loai === "co-mui" ? (
            <ONhapSo
              name="cao_thung"
              nhan="Chiều cao giới hạn của thùng xe (m)"
              giaTri={nhap.cao_thung}
              goiY="Chiều cao trong phạm vi thùng xe theo thiết kế."
            />
          ) : null}
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-1.5 text-base font-semibold">Chiều rộng</legend>
          <ONhapSo name="rong_do" nhan="Chiều rộng xếp hàng đo được (m)" giaTri={nhap.rong_do} />
          <ONhapSo name="rong_thung" nhan="Chiều rộng thùng xe theo thiết kế (m)" giaTri={nhap.rong_thung} />
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-1.5 text-base font-semibold">Chiều dài</legend>
          <ONhapSo name="dai_do" nhan="Chiều dài xếp hàng đo được (m)" giaTri={nhap.dai_do} />
          <ONhapSo name="dai_xe" nhan="Chiều dài toàn bộ của xe theo thiết kế (m)" giaTri={nhap.dai_xe} />
        </fieldset>

        <div>
          <Button type="submit" size="lg" disabled={busy}>
            <Icon name="layers" className="size-5" />
            Tra cứu kết quả
          </Button>
        </div>
      </Form>

      {loi && !anKetQua ? (
        <Notice tone="danger" className="mt-4">
          {loi}
        </Notice>
      ) : null}

      {kq && !anKetQua ? (
        <section aria-labelledby="ket-qua-tieu-de" className="mt-8">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="ket-qua-tieu-de" className="text-xl font-bold">
              Kết quả: {LOAI_THUNG[loaiDaTinh].ten.toLowerCase()}
            </h2>
            {kq.quaKho ? <Badge tone="danger">Quá khổ</Badge> : <Badge tone="ok">Không quá khổ</Badge>}
          </div>
          <div className="mt-3 grid gap-4">
            {kq.chieu.map((c) => (
              <TheChieu key={c.chieu} c={c} />
            ))}
          </div>

          {kq.khung.length > 0 ? (
            <>
              <h2 className="mt-8 text-xl font-bold">Khung xử phạt</h2>
              <div className="mt-3 grid gap-4">
                {kq.khung.map((k) => (
                  <TheKhungPhat key={k.canCu} khung={k} />
                ))}
              </div>
            </>
          ) : kq.quaKho ? (
            // Chỉ còn trường hợp chiều dài vượt mốc 20 m mà chưa vượt 1,1 lần chiều dài xe (lib/qua-kho.ts).
            <Notice className="mt-6">
              Chiều dài xếp hàng vượt mốc 20 m nhưng chưa vượt 1,1 lần chiều dài toàn bộ của xe: trang chưa
              gắn khung xử phạt cho trường hợp này. Hãy đối chiếu Điều 21 Nghị định số 168/2024/NĐ-CP.
            </Notice>
          ) : null}
          <LuuYDoiChieu coKhungPhat={kq.khung.length > 0} />
        </section>
      ) : null}
    </KhungTrang>
  );
}
