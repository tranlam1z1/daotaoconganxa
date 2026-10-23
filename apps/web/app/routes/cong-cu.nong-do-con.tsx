/**
 * Tính mức xử phạt nồng độ cồn: chọn loại xe, cách đo (khí thở, máu hoặc không chấp hành kiểm tra),
 * nhập kết quả đo, ra mức vi phạm và khung xử phạt (lib/nong-do-con.ts). Khai riêng trong routes.ts
 * nên thắng route chung cong-cu/:ma.
 */
import { useState } from "react";
import { Form, useNavigation } from "react-router";
import { DauTrangCongCu, lopLuaChon, lopO } from "../components/cong-cu/BieuMau";
import { LuuYDoiChieu, TheKhungPhat } from "../components/cong-cu/TheKhungPhat";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Notice } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { KhungTrang } from "../components/ui/KhungTrang";
import { docSoLe } from "../lib/doc-so";
import {
  CACH_DO,
  type CachDo,
  khongChapHanhKiemTra,
  LOAI_XE_CON,
  type LoaiXeCon,
  laCachDo,
  laLoaiXeCon,
  moTaMuc,
  tinhMucPhatCon,
} from "../lib/nong-do-con";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/cong-cu.nong-do-con";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Tính mức xử phạt nồng độ cồn", {
    description:
      "Tra mức xử phạt theo kết quả đo nồng độ cồn trong khí thở hoặc trong máu và loại phương tiện.",
  });
}

/** Cách đo trên biểu mẫu: hai cách đo thật và trường hợp không chấp hành yêu cầu kiểm tra. */
type CachNhap = CachDo | "khong-chap-hanh";

const DS_LOAI = Object.keys(LOAI_XE_CON) as LoaiXeCon[];
const DS_CACH: ReadonlyArray<{ ma: CachNhap; ten: string }> = [
  { ma: "khi-tho", ten: "Đo khí thở" },
  { ma: "mau", ten: "Xét nghiệm máu" },
  { ma: "khong-chap-hanh", ten: "Không chấp hành kiểm tra" },
];

/** Kết quả đo lớn hơn mức này gần như chắc chắn là gõ nhầm đơn vị của cách đo kia. */
const TRAN: Record<CachDo, number> = { "khi-tho": 5, mau: 1000 };

const so = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 3 });

export function loader({ request }: Route.LoaderArgs) {
  const sp = new URL(request.url).searchParams;
  const l = sp.get("loai");
  const loai: LoaiXeCon = laLoaiXeCon(l) ? l : "o-to";
  const c = sp.get("cach");
  const cach: CachNhap = laCachDo(c) || c === "khong-chap-hanh" ? c : "khi-tho";
  const nhap = { loai, cach, giaTri: sp.get("gia_tri") ?? "" };
  if (!sp.has("cach")) return { nhap, loi: null, kq: null, giaTri: null };
  if (cach === "khong-chap-hanh") return { nhap, loi: null, kq: khongChapHanhKiemTra(loai), giaTri: null };

  const v = docSoLe(nhap.giaTri);
  if (v === null) return { nhap, loi: "Hãy nhập kết quả đo (số từ 0 trở lên).", kq: null, giaTri: null };
  if (v > TRAN[cach]) {
    return {
      nhap,
      loi: `Kết quả ${so(v)} ${CACH_DO[cach].donVi} lớn bất thường. Hãy kiểm tra lại số đo và cách đo đã chọn.`,
      kq: null,
      giaTri: null,
    };
  }
  return { nhap, loi: null, kq: tinhMucPhatCon(loai, cach, v), giaTri: v };
}

export default function NongDoCon({ loaderData }: Route.ComponentProps) {
  const { nhap, loi, kq, giaTri } = loaderData;
  const busy = useNavigation().state !== "idle";
  const [loai, datLoai] = useState<LoaiXeCon>(nhap.loai);
  const [cach, datCach] = useState<CachNhap>(nhap.cach);
  // Đổi loại xe hoặc cách đo thì ẩn kết quả và lỗi của lần tra trước; lần tra mới hiện lại.
  const [anKetQua, datAnKetQua] = useState(false);
  const [duLieuTruoc, datDuLieuTruoc] = useState(loaderData);
  if (duLieuTruoc !== loaderData) {
    datDuLieuTruoc(loaderData);
    datAnKetQua(false);
  }
  const cachDaTra = nhap.cach;

  return (
    <KhungTrang className="wrap max-w-3xl py-6 sm:py-10">
      <DauTrangCongCu tieuDe="Tính mức xử phạt nồng độ cồn">
        Chọn loại xe và nhập kết quả đo nồng độ cồn để biết mức vi phạm và khung xử phạt.
      </DauTrangCongCu>

      <Form method="get" action="/cong-cu/nong-do-con" replace className="mt-5 grid gap-4">
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="mb-1.5 text-base font-medium">Loại xe</legend>
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
              <span className="min-w-0">
                <span className="block font-medium">{LOAI_XE_CON[m].ten}</span>
                <span className="block text-sm text-ink-2">{LOAI_XE_CON[m].moTa}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="grid gap-2 sm:grid-cols-3">
          <legend className="mb-1.5 text-base font-medium">Cách đo</legend>
          {DS_CACH.map((k) => (
            <label key={k.ma} className={lopLuaChon}>
              <input
                type="radio"
                name="cach"
                value={k.ma}
                checked={cach === k.ma}
                onChange={() => {
                  datCach(k.ma);
                  datAnKetQua(true);
                }}
                className="size-5 shrink-0"
              />
              {k.ten}
            </label>
          ))}
        </fieldset>

        <div className="flex flex-wrap items-end gap-3">
          {cach !== "khong-chap-hanh" ? (
            <div className="min-w-0 flex-1 basis-56">
              <label htmlFor="gia-tri" className="mb-1.5 block text-base font-medium">
                Kết quả đo ({CACH_DO[cach].donVi})
              </label>
              <input
                // Đổi cách đo thì dựng lại ô: số của đơn vị kia không còn nghĩa.
                key={cach}
                id="gia-tri"
                name="gia_tri"
                type="text"
                inputMode="decimal"
                required
                placeholder={cach === "khi-tho" ? "0,25" : "50"}
                defaultValue={cach === cachDaTra ? nhap.giaTri : ""}
                className={lopO}
              />
            </div>
          ) : null}
          <Button type="submit" size="lg" disabled={busy}>
            <Icon name="alert" className="size-5" />
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
              Kết quả: {LOAI_XE_CON[nhap.loai].ten.toLowerCase()}
            </h2>
            {kq.muc === null ? (
              <Badge tone="danger">Không chấp hành kiểm tra</Badge>
            ) : kq.muc === 0 ? (
              <Badge tone="ok">Không vi phạm</Badge>
            ) : (
              <Badge tone="danger">Vi phạm mức {kq.muc}</Badge>
            )}
          </div>

          {giaTri !== null && cachDaTra !== "khong-chap-hanh" ? (
            <Card className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-ink-2">Kết quả đo</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {so(giaTri)} <span className="text-base font-medium">{CACH_DO[cachDaTra].donVi}</span>
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-ink-2">Mức nồng độ cồn</p>
                <p className="mt-1 text-lg font-semibold">
                  {kq.muc ? moTaMuc(cachDaTra, kq.muc) : "Không có nồng độ cồn"}
                </p>
              </div>
            </Card>
          ) : null}

          {kq.khung ? (
            <>
              <div className="mt-4">
                <TheKhungPhat khung={kq.khung} />
              </div>
              <LuuYDoiChieu />
            </>
          ) : (
            <p className="mt-4 text-base">
              Kết quả đo bằng 0: người điều khiển không vi phạm quy định về nồng độ cồn.
            </p>
          )}
        </section>
      ) : null}
    </KhungTrang>
  );
}
