/**
 * Đo đạc điện tử xe và hiện trường, dạng sổ ghi số đo kèm ảnh: chụp hoặc chọn ảnh, chạm vào chỗ đã
 * đo để ghim số thứ tự, nhập tên và số đo của từng ghim, rồi tải về một ảnh có ghim và bảng số đo
 * (lib/so-do.ts). Công cụ không tự đo trên ảnh: số đo do cán bộ đo bằng thước và nhập vào.
 *
 * Chạy hoàn toàn trên trình duyệt, không có loader: ảnh và số đo không gửi lên máy chủ. Khai riêng
 * trong routes.ts nên thắng route chung cong-cu/:ma.
 */
import { type ChangeEvent, type MouseEvent, useEffect, useRef, useState } from "react";

import { DauTrangCongCu } from "../components/cong-cu/BieuMau";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { inputClass, Notice } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { cn } from "../lib/cn";
import { pageMeta } from "../lib/site";
import { DON_VI, type DonVi, GOI_Y_TEN, type SoDo, tenTepSoDo, veAnhSoDo } from "../lib/so-do";
import type { Route } from "./+types/cong-cu.do-dac-dien-tu";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Đo đạc điện tử xe và hiện trường", {
    description:
      "Ghi số đo kích thước xe, khoảng cách tại hiện trường lên ảnh chụp để đưa vào hồ sơ vụ việc.",
  });
}

const lopNutTep =
  "lun inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-btn px-5 text-base font-semibold focus-within:ring-2 focus-within:ring-primary";

/** Tải một tệp ảnh thành thẻ img đã giải mã, kèm URL tạm để hiển thị. */
async function docAnh(tep: File): Promise<{ url: string; el: HTMLImageElement }> {
  const url = URL.createObjectURL(tep);
  const el = new Image();
  el.src = url;
  try {
    await el.decode();
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  return { url, el };
}

export default function DoDacDienTu() {
  const [anh, datAnh] = useState<{ url: string; el: HTMLImageElement } | null>(null);
  const [soDo, datSoDo] = useState<SoDo[]>([]);
  const [tieuDe, datTieuDe] = useState("");
  const [ghiChu, datGhiChu] = useState("");
  const [loi, datLoi] = useState<string | null>(null);
  /** Ghim đang chờ dời: lần chạm ảnh kế tiếp đặt lại vị trí của nó thay vì thêm ghim mới. */
  const [dangDoi, datDangDoi] = useState<number | null>(null);
  const [dangXuat, datDangXuat] = useState(false);
  const idKe = useRef(1);
  /** Ghim vừa thêm, để đưa con trỏ vào ô tên của nó. */
  const [vuaThem, datVuaThem] = useState<number | null>(null);

  useEffect(() => () => void (anh && URL.revokeObjectURL(anh.url)), [anh]);
  useEffect(() => {
    if (vuaThem === null) return;
    document.getElementById(`ten-${vuaThem}`)?.focus();
    datVuaThem(null);
  }, [vuaThem]);

  async function chonAnh(e: ChangeEvent<HTMLInputElement>) {
    const tep = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (!tep) return;
    datLoi(null);
    try {
      datAnh(await docAnh(tep));
      datSoDo([]);
      datDangDoi(null);
    } catch {
      datLoi("Không đọc được ảnh này. Hãy chụp lại hoặc chọn ảnh JPG, PNG.");
    }
  }

  function chamAnh(e: MouseEvent<HTMLButtonElement>) {
    const khung = e.currentTarget.getBoundingClientRect();
    // Bấm bằng bàn phím không có tọa độ: đặt ghim ở giữa ảnh, sau đó dời bằng nút "Dời ghim".
    const bangPhim = e.detail === 0;
    const kep = (n: number) => Math.min(1, Math.max(0, n));
    const x = bangPhim ? 0.5 : kep((e.clientX - khung.left) / khung.width);
    const y = bangPhim ? 0.5 : kep((e.clientY - khung.top) / khung.height);
    if (dangDoi !== null) {
      datSoDo((ds) => ds.map((d) => (d.id === dangDoi ? { ...d, x, y } : d)));
      datDangDoi(null);
      return;
    }
    const id = idKe.current++;
    datSoDo((ds) => [...ds, { id, ten: "", giaTri: "", donVi: ds.at(-1)?.donVi ?? "m", x, y }]);
    datVuaThem(id);
  }

  const sua = (id: number, patch: Partial<SoDo>) =>
    datSoDo((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  async function taiAnh() {
    if (!anh) return;
    datLoi(null);
    datDangXuat(true);
    try {
      const thoiGian = new Date();
      const canvas = veAnhSoDo(anh.el, { tieuDe, ghiChu, thoiGian, soDo });
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.92));
      if (!blob) throw new Error("Không xuất được ảnh");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = tenTepSoDo(thoiGian);
      a.click();
      // Thu hồi sau một nhịp để trình duyệt kịp bắt đầu tải.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      datLoi("Không xuất được ảnh. Hãy thử lại với ảnh nhỏ hơn.");
    } finally {
      datDangXuat(false);
    }
  }

  return (
    <div className="wrap max-w-3xl py-6 sm:py-10">
      <DauTrangCongCu tieuDe="Đo đạc điện tử xe và hiện trường">
        Chụp ảnh xe hoặc hiện trường, chạm vào chỗ đã đo để ghim, nhập số đo bằng thước rồi tải về ảnh kèm
        bảng số đo để đưa vào hồ sơ.
      </DauTrangCongCu>

      <div className="mt-5 flex flex-wrap gap-3">
        <label className={cn(lopNutTep, "bg-primary text-on-primary hover:bg-primary-hover")}>
          <Icon name="camera" className="size-5" />
          Chụp ảnh
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={chonAnh} />
        </label>
        <label className={cn(lopNutTep, "border border-line-strong bg-surface hover:bg-surface-2")}>
          <Icon name="file" className="size-5" />
          Chọn ảnh có sẵn
          <input type="file" accept="image/*" className="sr-only" onChange={chonAnh} />
        </label>
      </div>

      {loi ? (
        <Notice tone="danger" className="mt-4">
          {loi}
        </Notice>
      ) : null}

      {anh ? (
        <>
          <p className="mt-5 text-base" aria-live="polite">
            {dangDoi !== null
              ? `Chạm vào vị trí mới của ghim số ${soDo.findIndex((d) => d.id === dangDoi) + 1}.`
              : "Chạm vào ảnh tại chỗ đã đo để thêm một số đo."}
          </p>
          <div className="relative mt-2 overflow-hidden rounded-lg border border-line">
            <button
              type="button"
              onClick={chamAnh}
              aria-label={dangDoi !== null ? "Đặt lại vị trí ghim trên ảnh" : "Thêm số đo trên ảnh"}
              className="block w-full cursor-crosshair"
            >
              <img src={anh.url} alt="Ảnh xe hoặc hiện trường đang ghi số đo" className="block w-full" />
            </button>
            {soDo.map((d, i) => (
              <span
                key={d.id}
                aria-hidden="true"
                style={{ left: `${d.x * 100}%`, top: `${d.y * 100}%` }}
                className={cn(
                  "pointer-events-none absolute flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-danger text-sm font-bold text-white shadow",
                  dangDoi === d.id && "ring-4 ring-primary",
                )}
              >
                {i + 1}
              </span>
            ))}
          </div>

          <datalist id="goi-y-ten-so-do">
            {GOI_Y_TEN.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>

          {soDo.length > 0 ? (
            <ol className="mt-4 grid gap-3">
              {soDo.map((d, i) => (
                <li key={d.id}>
                  <Card className="grid gap-3 p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-danger text-sm font-bold text-white">
                        {i + 1}
                      </span>
                      <label htmlFor={`ten-${d.id}`} className="sr-only">
                        Tên số đo {i + 1}
                      </label>
                      <input
                        id={`ten-${d.id}`}
                        type="text"
                        list="goi-y-ten-so-do"
                        placeholder="Tên số đo, ví dụ: Chiều cao thành thùng"
                        value={d.ten}
                        onChange={(e) => sua(d.id, { ten: e.currentTarget.value })}
                        className={cn(inputClass, "min-h-12 flex-1 text-base")}
                      />
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
                      <label htmlFor={`gia-tri-${d.id}`} className="sr-only">
                        Số đo {i + 1}
                      </label>
                      <input
                        id={`gia-tri-${d.id}`}
                        type="text"
                        inputMode="decimal"
                        placeholder="Số đo"
                        value={d.giaTri}
                        onChange={(e) => sua(d.id, { giaTri: e.currentTarget.value })}
                        className={cn(inputClass, "min-h-12 text-lg tabular-nums")}
                      />
                      <label htmlFor={`don-vi-${d.id}`} className="sr-only">
                        Đơn vị của số đo {i + 1}
                      </label>
                      <select
                        id={`don-vi-${d.id}`}
                        value={d.donVi}
                        onChange={(e) => sua(d.id, { donVi: e.currentTarget.value as DonVi })}
                        className={cn(inputClass, "min-h-12 text-base")}
                      >
                        {DON_VI.map((dv) => (
                          <option key={dv} value={dv}>
                            {dv}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        aria-pressed={dangDoi === d.id}
                        onClick={() => datDangDoi(dangDoi === d.id ? null : d.id)}
                      >
                        <Icon name="ghim" className="size-4" />
                        {dangDoi === d.id ? "Thôi dời" : "Dời ghim"}
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label={`Xóa số đo ${i + 1}`}
                        onClick={() => {
                          datSoDo((ds) => ds.filter((x) => x.id !== d.id));
                          if (dangDoi === d.id) datDangDoi(null);
                        }}
                      >
                        <Icon name="x" className="size-4" />
                        Xóa
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ol>
          ) : null}

          <div className="mt-5 grid gap-3">
            <div>
              <label htmlFor="tieu-de" className="mb-1.5 block text-base font-medium">
                Tiêu đề ghi trên ảnh
              </label>
              <input
                id="tieu-de"
                type="text"
                placeholder="Ví dụ: Xe tải 36C-123.45, Quốc lộ 1A km 320"
                value={tieuDe}
                onChange={(e) => datTieuDe(e.currentTarget.value)}
                className={cn(inputClass, "min-h-12 text-base")}
              />
            </div>
            <div>
              <label htmlFor="ghi-chu" className="mb-1.5 block text-base font-medium">
                Ghi chú
              </label>
              <textarea
                id="ghi-chu"
                rows={2}
                value={ghiChu}
                onChange={(e) => datGhiChu(e.currentTarget.value)}
                className={cn(inputClass, "py-2 text-base")}
              />
            </div>
          </div>

          <div className="mt-5">
            <Button size="lg" onClick={taiAnh} disabled={dangXuat || soDo.length === 0}>
              <Icon name="file" className="size-5" />
              {dangXuat ? "Đang xuất ảnh…" : "Tải ảnh kèm số đo"}
            </Button>
            {soDo.length === 0 ? (
              <p className="mt-2 text-sm text-ink-2">Thêm ít nhất một số đo để tải ảnh.</p>
            ) : null}
          </div>
        </>
      ) : null}

      <Notice className="mt-6">
        Ảnh và số đo chỉ nằm trên máy này, không gửi lên máy chủ và mất khi rời trang: hãy tải ảnh về trước
        khi thoát. Công cụ không tự đo trên ảnh, số đo là số cán bộ đo được bằng thước.
      </Notice>
    </div>
  );
}
