/**
 * Xác định loại GPLX theo phương tiện: chọn loại xe và thông số, ra hạng giấy phép lái xe cần có;
 * chọn thêm hạng người lái đang có (cấp từ hoặc trước 01/01/2025) thì đối chiếu phù hợp hay không
 * (lib/loai-gplx.ts). Khai riêng trong routes.ts nên thắng route chung cong-cu/:ma.
 */
import { useState } from "react";
import { Form, useNavigation } from "react-router";
import { DauTrangCongCu, lopLuaChon, lopO, ONhapSo } from "../components/cong-cu/BieuMau";
import { DongCanCu, LuuYDoiChieu, TheKhungPhat } from "../components/cong-cu/TheKhungPhat";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Notice } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { KhungTrang } from "../components/ui/KhungTrang";
import { docSoLe } from "../lib/doc-so";
import {
  CAN_CU_GPLX,
  type DongCo,
  doiChieuHangCu,
  doiChieuHangMoi,
  HANG_CU,
  HANG_MOI,
  hangCanCo,
  type KetLuanGplx,
  khungKhongPhuHop,
  LOAI_PHUONG_TIEN,
  type LoaiPhuongTien,
  laHangCu,
  laHangMoi,
  laLoaiPhuongTien,
  PHAM_VI_HANG_MOI,
  type PhuongTien,
  TUOI_TOI_THIEU,
  tenHangCu,
} from "../lib/loai-gplx";
import { pageMeta } from "../lib/site";
import { docSoKg } from "../lib/tinh-qua-tai";
import type { Route } from "./+types/cong-cu.loai-gplx";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Xác định loại GPLX theo phương tiện", {
    description:
      "Cho biết hạng giấy phép lái xe cần có để điều khiển một loại phương tiện và đối chiếu với hạng người lái đang có.",
  });
}

/** Hệ hạng của GPLX người lái đang có; rỗng là không đối chiếu. */
type He = "" | "moi" | "cu";

const DS_LOAI = Object.keys(LOAI_PHUONG_TIEN) as LoaiPhuongTien[];
const DS_HE: ReadonlyArray<{ ma: He; ten: string }> = [
  { ma: "", ten: "Không đối chiếu" },
  { ma: "moi", ten: "Cấp từ 01/01/2025" },
  { ma: "cu", ten: "Cấp trước 01/01/2025" },
];
const O = ["dung_tich", "cong_suat", "so_cho", "khoi_luong", "trong_tai", "ro_mooc"] as const;

const KET_LUAN: Record<KetLuanGplx, { nhan: string; tone: "ok" | "danger" | "warn" }> = {
  "phu-hop": { nhan: "Phù hợp", tone: "ok" },
  "khong-phu-hop": { nhan: "Không phù hợp", tone: "danger" },
  "can-xem-them": { nhan: "Cần xem thêm", tone: "warn" },
};

export function loader({ request }: Route.LoaderArgs) {
  const sp = new URL(request.url).searchParams;
  const l = sp.get("loai");
  const loai: LoaiPhuongTien = laLoaiPhuongTien(l) ? l : "mo-to-2";
  const dongCo: DongCo = sp.get("dong_co") === "dien" ? "dien" : "xang";
  const h = sp.get("he");
  const he: He = h === "moi" || h === "cu" ? h : "";
  const nhap = {
    loai,
    dongCo,
    giuongNam: sp.get("giuong_nam") === "1",
    he,
    hangMoi: sp.get("hang_moi") ?? "",
    hangCu: sp.get("hang_cu") ?? "",
    ...(Object.fromEntries(O.map((o) => [o, sp.get(o) ?? ""])) as Record<(typeof O)[number], string>),
  };
  if (!sp.has("loai")) return { nhap, loi: null, kq: null };
  const loi = (m: string) => ({ nhap, loi: m, kq: null });

  const pt: PhuongTien = { loai };
  if (loai === "mo-to-2") {
    pt.dongCo = dongCo;
    if (dongCo === "dien") {
      const kw = docSoLe(nhap.cong_suat);
      if (kw === null || kw <= 0) return loi("Hãy nhập công suất động cơ điện (số kW lớn hơn 0).");
      if (kw < 4)
        return loi("Xe có công suất động cơ điện dưới 4 kW là xe gắn máy. Hãy chọn loại Xe gắn máy.");
      pt.congSuat = kw;
    } else {
      const cc = docSoKg(nhap.dung_tich);
      if (cc === null || cc <= 0) return loi("Hãy nhập dung tích xi-lanh (số cm³ lớn hơn 0).");
      if (cc < 50) return loi("Xe có dung tích xi-lanh dưới 50 cm³ là xe gắn máy. Hãy chọn loại Xe gắn máy.");
      pt.dungTich = cc;
    }
  }
  if (loai === "cho-nguoi") {
    const cho = Number(nhap.so_cho.trim());
    if (!Number.isInteger(cho) || cho < 1 || cho > 200) {
      return loi("Hãy nhập số chỗ ngồi không kể chỗ của người lái xe (số nguyên từ 1).");
    }
    pt.soCho = cho;
    pt.giuongNam = nhap.giuongNam;
  }
  if (loai === "tai") {
    const kl = docSoKg(nhap.khoi_luong);
    if (kl === null || kl <= 0) return loi("Hãy nhập khối lượng toàn bộ theo thiết kế (số kg lớn hơn 0).");
    pt.khoiLuongToanBo = kl;
    if (nhap.trong_tai.trim() || he === "cu") {
      const tt = docSoKg(nhap.trong_tai);
      if (tt === null || tt <= 0) {
        return loi(
          "Giấy phép lái xe cấp trước 01/01/2025 xét xe tải theo trọng tải. Hãy nhập khối lượng hàng chuyên chở theo thiết kế (số kg lớn hơn 0).",
        );
      }
      if (tt >= kl) return loi("Khối lượng hàng chuyên chở phải nhỏ hơn khối lượng toàn bộ theo thiết kế.");
      pt.trongTai = tt;
    }
  }
  if ((loai === "cho-nguoi" || loai === "tai") && nhap.ro_mooc.trim()) {
    const rm = docSoKg(nhap.ro_mooc);
    if (rm === null)
      return loi("Khối lượng rơ moóc không hợp lệ. Hãy nhập số kg hoặc để trống nếu không kéo rơ moóc.");
    pt.roMooc = rm;
  }

  const can = hangCanCo(pt);
  let doiChieu = null;
  if (he === "moi") {
    if (!laHangMoi(nhap.hangMoi)) return loi("Hãy chọn hạng giấy phép lái xe người lái đang có.");
    doiChieu = { hang: nhap.hangMoi, ...doiChieuHangMoi(pt, nhap.hangMoi) };
  } else if (he === "cu") {
    if (!laHangCu(nhap.hangCu)) return loi("Hãy chọn hạng giấy phép lái xe người lái đang có.");
    doiChieu = { hang: tenHangCu(nhap.hangCu), ...doiChieuHangCu(pt, nhap.hangCu) };
  }
  return {
    nhap,
    loi: null,
    kq: {
      can,
      doiChieu,
      khung: doiChieu?.ketLuan === "khong-phu-hop" ? khungKhongPhuHop(pt) : null,
    },
  };
}

export default function LoaiGplx({ loaderData }: Route.ComponentProps) {
  const { nhap, loi, kq } = loaderData;
  const busy = useNavigation().state !== "idle";
  const [loai, datLoai] = useState<LoaiPhuongTien>(nhap.loai);
  const [dongCo, datDongCo] = useState<DongCo>(nhap.dongCo);
  const [he, datHe] = useState<He>(nhap.he);
  // Đổi loại xe thì ẩn kết quả và lỗi của lần tra trước; lần tra mới (loaderData mới) hiện lại.
  const [anKetQua, datAnKetQua] = useState(false);
  const [duLieuTruoc, datDuLieuTruoc] = useState(loaderData);
  if (duLieuTruoc !== loaderData) {
    datDuLieuTruoc(loaderData);
    datAnKetQua(false);
  }
  const coRoMooc = loai === "cho-nguoi" || loai === "tai";

  return (
    <KhungTrang className="wrap max-w-3xl py-6 sm:py-10">
      <DauTrangCongCu tieuDe="Xác định loại GPLX theo phương tiện">
        Chọn loại xe và nhập thông số ghi trong giấy chứng nhận đăng ký, giấy chứng nhận kiểm định để biết
        hạng giấy phép lái xe cần có.
      </DauTrangCongCu>

      <Form method="get" action="/cong-cu/loai-gplx" replace className="mt-5 grid gap-5">
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="mb-1.5 text-base font-medium">Loại phương tiện</legend>
          {DS_LOAI.map((m) => (
            <label key={m} className={lopLuaChon}>
              <input
                type="radio"
                name="loai"
                value={m}
                checked={loai === m}
                onChange={() => {
                  datLoai(m);
                  datAnKetQua(true);
                }}
                className="size-5 shrink-0"
              />
              {LOAI_PHUONG_TIEN[m]}
            </label>
          ))}
        </fieldset>

        {loai === "mo-to-2" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <fieldset className="grid grid-cols-2 gap-2">
              <legend className="mb-1.5 text-base font-medium">Động cơ</legend>
              {(["xang", "dien"] as const).map((d) => (
                <label key={d} className={lopLuaChon}>
                  <input
                    type="radio"
                    name="dong_co"
                    value={d}
                    checked={dongCo === d}
                    onChange={() => datDongCo(d)}
                    className="size-5 shrink-0"
                  />
                  {d === "xang" ? "Xăng" : "Điện"}
                </label>
              ))}
            </fieldset>
            {dongCo === "xang" ? (
              <ONhapSo
                name="dung_tich"
                nhan="Dung tích xi-lanh (cm³)"
                giaTri={nhap.dung_tich}
                required
                soNguyen
              />
            ) : (
              <ONhapSo name="cong_suat" nhan="Công suất động cơ điện (kW)" giaTri={nhap.cong_suat} required />
            )}
          </div>
        ) : null}

        {loai === "cho-nguoi" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <ONhapSo
              name="so_cho"
              nhan="Số chỗ (không kể chỗ của người lái xe)"
              giaTri={nhap.so_cho}
              required
              soNguyen
            />
            <label className={`${lopLuaChon} self-end`}>
              <input
                type="checkbox"
                name="giuong_nam"
                value="1"
                defaultChecked={nhap.giuongNam}
                className="size-5 shrink-0"
              />
              Xe giường nằm
            </label>
          </div>
        ) : null}

        {loai === "tai" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <ONhapSo
              name="khoi_luong"
              nhan="Khối lượng toàn bộ theo thiết kế (kg)"
              giaTri={nhap.khoi_luong}
              required
            />
            <ONhapSo
              name="trong_tai"
              nhan="Khối lượng hàng chuyên chở theo thiết kế (kg)"
              giaTri={nhap.trong_tai}
              required={he === "cu"}
              goiY="Chỉ cần khi đối chiếu giấy phép lái xe cấp trước 01/01/2025."
            />
          </div>
        ) : null}

        {coRoMooc ? (
          <ONhapSo
            name="ro_mooc"
            nhan="Khối lượng toàn bộ theo thiết kế của rơ moóc kéo theo (kg)"
            giaTri={nhap.ro_mooc}
            goiY="Để trống nếu xe không kéo rơ moóc."
            className="sm:max-w-md"
          />
        ) : null}

        <fieldset className="grid gap-2 sm:grid-cols-3">
          <legend className="mb-1.5 text-base font-medium">Giấy phép lái xe người lái đang có</legend>
          {DS_HE.map((k) => (
            <label key={k.ma} className={lopLuaChon}>
              <input
                type="radio"
                name="he"
                value={k.ma}
                checked={he === k.ma}
                onChange={() => datHe(k.ma)}
                className="size-5 shrink-0"
              />
              {k.ten}
            </label>
          ))}
        </fieldset>

        {he ? (
          <div className="sm:max-w-xs">
            <label htmlFor="hang" className="mb-1.5 block text-base font-medium">
              Hạng ghi trên giấy phép lái xe
            </label>
            <select
              // Mỗi hệ một danh sách hạng: đổi hệ thì dựng lại ô chọn.
              key={he}
              id="hang"
              name={he === "moi" ? "hang_moi" : "hang_cu"}
              required
              defaultValue={he === "moi" ? nhap.hangMoi : nhap.hangCu}
              className={lopO}
            >
              <option value="" disabled>
                Chọn hạng
              </option>
              {he === "moi"
                ? HANG_MOI.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))
                : HANG_CU.map((x) => (
                    <option key={x} value={x}>
                      {tenHangCu(x)}
                    </option>
                  ))}
            </select>
          </div>
        ) : null}

        <div>
          <Button type="submit" size="lg" disabled={busy}>
            <Icon name="idCard" className="size-5" />
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
          <h2 id="ket-qua-tieu-de" className="text-xl font-bold">
            Kết quả: {LOAI_PHUONG_TIEN[nhap.loai].toLowerCase()}
          </h2>

          <Card className="mt-3">
            <h3 className="text-base font-medium text-ink-2">Hạng giấy phép lái xe cần có</h3>
            <p className="mt-1 text-2xl font-bold text-primary">
              {kq.can.hang ? `Hạng ${kq.can.hang}` : "Không cần giấy phép lái xe"}
            </p>
            <p className="mt-2 text-base">{kq.can.lyDo}.</p>
            {kq.can.hang ? (
              <ul className="mt-2 grid list-disc gap-1 pl-5 text-base">
                <li>
                  Phạm vi của hạng {kq.can.hang}: {PHAM_VI_HANG_MOI[kq.can.hang]}.
                </li>
                {kq.can.hangKhac.length > 0 ? (
                  <li>Các hạng cũng điều khiển được xe này: {kq.can.hangKhac.join(", ")}.</li>
                ) : null}
                <li>
                  Tuổi tối thiểu được cấp hạng {kq.can.hang}: đủ {TUOI_TOI_THIEU[kq.can.hang]} tuổi.
                </li>
              </ul>
            ) : null}
            <DongCanCu {...CAN_CU_GPLX[kq.can.canCu]} />
          </Card>

          {kq.doiChieu ? (
            <Card className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-medium text-ink-2">
                  Đối chiếu giấy phép lái xe hạng {kq.doiChieu.hang}
                  {nhap.he === "cu" ? " (cấp trước 01/01/2025)" : ""}
                </h3>
                <Badge tone={KET_LUAN[kq.doiChieu.ketLuan].tone}>{KET_LUAN[kq.doiChieu.ketLuan].nhan}</Badge>
              </div>
              <p className="mt-2 text-base">{kq.doiChieu.lyDo}</p>
              <DongCanCu {...CAN_CU_GPLX[kq.doiChieu.canCu]} />
            </Card>
          ) : null}

          {kq.khung ? (
            <>
              <h2 className="mt-8 text-xl font-bold">Khung xử phạt</h2>
              <div className="mt-3">
                <TheKhungPhat khung={kq.khung} />
              </div>
            </>
          ) : null}
          <LuuYDoiChieu coKhungPhat={kq.khung !== null} />
        </section>
      ) : null}
    </KhungTrang>
  );
}
