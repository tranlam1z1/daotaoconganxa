/**
 * Trình soạn kịch bản xe của trò "Soi camera" (docs/PLAN.md GĐ-T5, GAME_DESIGN §3).
 *
 * Soạn bằng biểu mẫu: thông số đoạn phim, chu kỳ đèn, vùng cấm dừng, và mỗi xe một dòng (loại, làn,
 * giờ vào, tốc độ, mũ bảo hiểm, không dừng theo đèn, dừng lại ở đâu bao lâu). Danh sách vi phạm KHÔNG
 * soạn tay: chạy mô phỏng mỗi lần sửa và lấy đúng những gì mô phỏng thấy; người soạn chỉ chọn mã mức
 * phạt và viết mô tả cho từng vi phạm. Bộ kiểm (`kiemTraKichBan`) báo lỗi ngay cạnh xe hoặc vi phạm.
 * Kết quả ghi vào các ô ẩn `payload`, `answer`, `refs`. "Chơi thử" chấm ngay trên máy, không ghi lượt.
 */
import { useMemo, useState } from "react";

import {
  chayKichBan,
  type DapAnKichBan,
  KIEU_XE_CAMERA,
  kiemTraKichBan,
  kieuXeCamera,
  MA_LAN,
  type PayloadKichBan,
  phatHienViPham,
  TEN_LAN,
  TEN_VI_PHAM,
  THONG_TIN_KIEU_XE,
  TRO_CHOI_SOI_CAMERA,
  type XeKichBan,
} from "../../../../../../packages/dao-tao/src/tro-choi/soi-camera.ts";
import { cn } from "../../../lib/cn";

/**
 * Lựa chọn "Loại xe" gộp kiểu xe (ô tô, xe tải các kiểu) với xe máy, xe ưu tiên. Giá trị là mã kiểu,
 * hoặc mã loại với hai loại không có kiểu.
 */
const CHON_XE: ReadonlyArray<{ ma: string; ten: string }> = [
  ...KIEU_XE_CAMERA.map((k) => ({ ma: k, ten: THONG_TIN_KIEU_XE[k].ten })),
  { ma: "xe_may", ten: "xe máy" },
  { ma: "xe_uu_tien", ten: "xe ưu tiên" },
];

import { SoiCamera, type TraLoiSoiCameraWeb } from "../../tro-choi/SoiCamera";
import { Button } from "../../ui/Button";
import { inputClass } from "../../ui/Field";

export interface MucPhatSoan {
  ma: string;
  ten: string;
  da_duyet: boolean;
}

const MOI: PayloadKichBan = {
  muc: 1,
  ban_dem: false,
  gio_bat_dau: "07:30:00",
  thoi_luong: 20,
  den: { xanh: 20, vang: 3, do: 20, lech: 0 },
  vung_cam_dung: [],
  xe: [{ id: "x1", loai: "o_to", lan: "bac-oto", vao: 0 }],
};

const o = (cls?: string) => cn(inputClass, "min-h-11", cls);

export function SoanKichBanXe({
  payload,
  answer,
  mucPhat,
  khoa,
}: {
  payload: unknown;
  answer: unknown;
  mucPhat: readonly MucPhatSoan[];
  khoa: boolean;
}) {
  const [p, datP] = useState<PayloadKichBan>(() =>
    payload && typeof payload === "object" && "xe" in payload
      ? structuredClone(payload as PayloadKichBan)
      : MOI,
  );
  const [khai, datKhai] = useState<DapAnKichBan["vi_pham"]>(() =>
    answer && typeof answer === "object" && "vi_pham" in answer
      ? structuredClone((answer as DapAnKichBan).vi_pham)
      : [],
  );
  const [thu, datThu] = useState<{ khoa: number; tl: TraLoiSoiCameraWeb; ket?: unknown } | null>(null);

  // Vi phạm mô phỏng thấy; đáp án = đúng danh sách này, giữ mã mức phạt và mô tả đã soạn.
  const thay = useMemo(() => {
    try {
      return phatHienViPham(p, chayKichBan(p));
    } catch {
      return [];
    }
  }, [p]);
  const dapAn: DapAnKichBan = {
    vi_pham: thay.map((t) => {
      const cu = khai.find((k) => k.xe === t.xe && k.loai === t.loai);
      return { xe: t.xe, loai: t.loai, ma_muc_phat: cu?.ma_muc_phat ?? null, mo_ta: cu?.mo_ta ?? "" };
    }),
  };
  const loi = kiemTraKichBan(p, dapAn);
  const loiCua = (pt: string) => loi.filter((l) => l.phan_tu === pt).map((l) => l.loi);

  const sua = (f: (x: PayloadKichBan) => void) =>
    datP((cu) => {
      const x = structuredClone(cu);
      f(x);
      return x;
    });
  const suaXe = (i: number, f: (x: XeKichBan) => void) => sua((x) => f(x.xe[i]!));
  const suaKhai = (xe: string, loai: string, f: (k: DapAnKichBan["vi_pham"][number]) => void) =>
    datKhai(() => {
      const ds = structuredClone(dapAn.vi_pham);
      const k = ds.find((v) => v.xe === xe && v.loai === loai);
      if (k) f(k);
      return ds;
    });
  const so = (v: string) => (v === "" ? 0 : Number(v));
  const refs = [...new Set(dapAn.vi_pham.map((v) => v.ma_muc_phat).filter(Boolean))]
    .map((m) => `violation:${m}`)
    .join("\n");

  const buocThu = () => {
    const [b] = TRO_CHOI_SOI_CAMERA.taoLuot(
      [{ id: "thu", code: "thu", version: 1, topic_id: null, kich_ban: p, dap_an: dapAn, muc_phat: {} }],
      () => 0,
      p.muc,
    );
    return b;
  };

  return (
    <section
      className="grid gap-4 rounded-xl border border-line bg-surface p-4"
      aria-label="Soạn kịch bản xe"
    >
      <input type="hidden" name="payload" value={JSON.stringify(p)} />
      <input type="hidden" name="answer" value={JSON.stringify(dapAn)} />
      <input type="hidden" name="refs" value={refs} />

      <fieldset className="grid gap-3 sm:grid-cols-3" disabled={khoa}>
        <legend className="mb-1 text-sm font-semibold">Đoạn phim</legend>
        <label className="grid gap-1 text-sm">
          Màn
          <select
            className={o()}
            value={p.muc}
            onChange={(e) => sua((x) => void Object.assign(x, { muc: Number(e.target.value) }))}
          >
            {[1, 2, 3, 4, 5].map((m) => (
              <option key={m} value={m}>
                Màn {m}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Dài (giây, 20–40)
          <input
            type="number"
            inputMode="numeric"
            min={20}
            max={40}
            className={o()}
            value={p.thoi_luong}
            onChange={(e) => sua((x) => void Object.assign(x, { thoi_luong: so(e.target.value) }))}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Giờ trên camera
          <input
            className={o()}
            value={p.gio_bat_dau}
            onChange={(e) => sua((x) => void Object.assign(x, { gio_bat_dau: e.target.value }))}
          />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-5"
            checked={p.ban_dem}
            onChange={(e) => sua((x) => void Object.assign(x, { ban_dem: e.target.checked }))}
          />
          Ban đêm
        </label>
        {(["xanh", "vang", "do", "lech"] as const).map((k) => (
          <label key={k} className="grid gap-1 text-sm">
            {k === "xanh"
              ? "Đèn xanh (giây)"
              : k === "vang"
                ? "Đèn vàng (giây)"
                : k === "do"
                  ? "Đèn đỏ (giây)"
                  : "Lệch pha lúc bắt đầu (giây)"}
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className={o()}
              value={p.den[k]}
              onChange={(e) =>
                sua((x) => {
                  x.den[k] = so(e.target.value);
                })
              }
            />
          </label>
        ))}
      </fieldset>

      <fieldset disabled={khoa}>
        <legend className="text-sm font-semibold">Vùng cấm dừng (mét tính từ mép trên khung, 0–60)</legend>
        <ul className="mt-2 grid gap-2">
          {p.vung_cam_dung.map((v, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: dòng chỉ định danh theo thứ tự.
            <li key={i} className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Làn"
                className={o("w-auto")}
                value={v.lan}
                onChange={(e) =>
                  sua((x) => {
                    x.vung_cam_dung[i]!.lan = e.target.value as never;
                  })
                }
              >
                {MA_LAN.map((l) => (
                  <option key={l} value={l}>
                    {TEN_LAN[l]}
                  </option>
                ))}
              </select>
              <input
                aria-label="Từ mét"
                type="number"
                className={o("w-20")}
                value={v.y_tu}
                onChange={(e) =>
                  sua((x) => {
                    x.vung_cam_dung[i]!.y_tu = so(e.target.value);
                  })
                }
              />
              <input
                aria-label="Đến mét"
                type="number"
                className={o("w-20")}
                value={v.y_den}
                onChange={(e) =>
                  sua((x) => {
                    x.vung_cam_dung[i]!.y_den = so(e.target.value);
                  })
                }
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => sua((x) => void x.vung_cam_dung.splice(i, 1))}
              >
                Xóa
              </Button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="secondary"
          className="mt-2"
          onClick={() => sua((x) => void x.vung_cam_dung.push({ lan: "bac-oto", y_tu: 10, y_den: 25 }))}
        >
          Thêm vùng cấm dừng
        </Button>
      </fieldset>

      <fieldset disabled={khoa}>
        <legend className="text-sm font-semibold">Xe ({p.xe.length})</legend>
        <ol className="mt-2 grid gap-2">
          {p.xe.map((x, i) => {
            const le = loiCua(`xe:${x.id}`);
            return (
              <li
                key={x.id}
                className={cn(
                  "grid gap-2 rounded-lg border p-2 text-sm",
                  le.length ? "border-danger" : "border-line",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="w-10">{x.id}</strong>
                  <select
                    aria-label="Loại xe"
                    className={o("w-auto")}
                    value={kieuXeCamera(x) ?? x.loai}
                    onChange={(e) =>
                      suaXe(i, (c) => {
                        const ma = e.target.value;
                        const kieu = KIEU_XE_CAMERA.find((k) => k === ma);
                        const loai = kieu ? THONG_TIN_KIEU_XE[kieu].loai : (ma as XeKichBan["loai"]);
                        c.loai = loai;
                        if (kieu) c.kieu = kieu;
                        else delete c.kieu;
                        if (loai !== "xe_may") delete c.mu_bao_hiem;
                      })
                    }
                  >
                    {CHON_XE.map((l) => (
                      <option key={l.ma} value={l.ma}>
                        {l.ten}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Làn"
                    className={o("w-auto")}
                    value={x.lan}
                    onChange={(e) =>
                      suaXe(i, (c) => {
                        c.lan = e.target.value as never;
                      })
                    }
                  >
                    {MA_LAN.map((l) => (
                      <option key={l} value={l}>
                        {TEN_LAN[l]}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1">
                    vào giây
                    <input
                      type="number"
                      inputMode="decimal"
                      step={0.5}
                      className={o("w-20")}
                      value={x.vao}
                      onChange={(e) =>
                        suaXe(i, (c) => {
                          c.vao = so(e.target.value);
                        })
                      }
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    km/h
                    <input
                      type="number"
                      inputMode="numeric"
                      className={o("w-20")}
                      value={x.toc_do ?? 40}
                      onChange={(e) =>
                        suaXe(i, (c) => {
                          c.toc_do = so(e.target.value);
                        })
                      }
                    />
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {x.loai === "xe_may" ? (
                    <label className="flex min-h-11 items-center gap-1">
                      <input
                        type="checkbox"
                        className="size-5"
                        checked={x.mu_bao_hiem !== false}
                        onChange={(e) =>
                          suaXe(i, (c) => {
                            c.mu_bao_hiem = e.target.checked;
                          })
                        }
                      />
                      Đội mũ bảo hiểm
                    </label>
                  ) : null}
                  <label className="flex min-h-11 items-center gap-1">
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={Boolean(x.khong_dung_den)}
                      onChange={(e) =>
                        suaXe(i, (c) => {
                          c.khong_dung_den = e.target.checked || undefined;
                        })
                      }
                    />
                    Không dừng theo đèn
                  </label>
                  <label className="flex min-h-11 items-center gap-1">
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={Boolean(x.dung)}
                      onChange={(e) =>
                        suaXe(i, (c) => {
                          c.dung = e.target.checked ? { y: 20, giay: 5 } : undefined;
                        })
                      }
                    />
                    Dừng lại
                  </label>
                  {x.dung ? (
                    <>
                      <input
                        aria-label="Dừng ở mét"
                        type="number"
                        className={o("w-20")}
                        value={x.dung.y}
                        onChange={(e) =>
                          suaXe(i, (c) => {
                            c.dung!.y = so(e.target.value);
                          })
                        }
                      />
                      <input
                        aria-label="Dừng bao nhiêu giây"
                        type="number"
                        inputMode="decimal"
                        className={o("w-20")}
                        value={x.dung.giay}
                        onChange={(e) =>
                          suaXe(i, (c) => {
                            c.dung!.giay = so(e.target.value);
                          })
                        }
                      />
                    </>
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => sua((k) => void k.xe.splice(i, 1))}
                  >
                    Xóa xe
                  </Button>
                </div>
                {le.map((l) => (
                  <p key={l} className="text-danger">
                    {l}
                  </p>
                ))}
              </li>
            );
          })}
        </ol>
        <Button
          type="button"
          variant="secondary"
          className="mt-2"
          onClick={() =>
            sua((k) => {
              let n = k.xe.length + 1;
              while (k.xe.some((x) => x.id === `x${n}`)) n++;
              k.xe.push({ id: `x${n}`, loai: "o_to", lan: "bac-oto", vao: 0 });
            })
          }
        >
          Thêm xe
        </Button>
      </fieldset>

      <div>
        <p className="text-sm font-semibold">Vi phạm mô phỏng thấy ({dapAn.vi_pham.length})</p>
        <ol className="mt-2 grid gap-2">
          {dapAn.vi_pham.map((v, i) => (
            <li key={`${v.xe}-${v.loai}`} className="grid gap-2 rounded-lg border border-line p-2 text-sm">
              <p className="font-semibold">
                Xe {v.xe}: {TEN_VI_PHAM[v.loai]}
              </p>
              <select
                aria-label="Mã mức phạt"
                className={o()}
                disabled={khoa}
                value={v.ma_muc_phat ?? ""}
                onChange={(e) =>
                  suaKhai(v.xe, v.loai, (k) => {
                    k.ma_muc_phat = e.target.value || null;
                  })
                }
              >
                <option value="">Chưa có dòng mức phạt</option>
                {mucPhat.map((m) => (
                  <option key={m.ma} value={m.ma}>
                    {m.ma} · {m.ten.slice(0, 60)}
                    {m.da_duyet ? "" : " (chưa duyệt)"}
                  </option>
                ))}
              </select>
              <input
                aria-label="Mô tả tình huống"
                className={o()}
                disabled={khoa}
                placeholder="Mô tả tình huống cho màn kết quả và biên bản"
                value={v.mo_ta}
                onChange={(e) =>
                  suaKhai(v.xe, v.loai, (k) => {
                    k.mo_ta = e.target.value;
                  })
                }
              />
              {loiCua(`vi_pham:${i}`).map((l) => (
                <p key={l} className="text-danger">
                  {l}
                </p>
              ))}
            </li>
          ))}
        </ol>
      </div>

      {loiCua("doan").length ? (
        <ul className="grid gap-1 text-sm text-danger">
          {loiCua("doan").map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      ) : null}
      <p className="text-sm text-ink-2">
        {loi.length
          ? `Còn ${loi.length} lỗi; kịch bản có lỗi không vào trò kể cả khi đã duyệt.`
          : "Kịch bản hợp lệ."}{" "}
        Tham chiếu tới các dòng mức phạt được ghi tự động.
      </p>

      <div>
        <Button
          type="button"
          variant="secondary"
          disabled={loi.length > 0}
          onClick={() => datThu(thu ? null : { khoa: Date.now(), tl: null })}
        >
          {thu ? "Đóng chơi thử" : "Chơi thử"}
        </Button>
        {thu ? (
          <div className="mt-3 rounded-xl border border-line p-3">
            <p className="mb-2 text-sm text-ink-2">Chơi thử từ bản nháp: không ghi lượt, không cộng XP.</p>
            {(() => {
              const b = buocThu();
              if (!b) return null;
              return (
                <SoiCamera
                  key={thu.khoa}
                  de={TRO_CHOI_SOI_CAMERA.deChoNguoiChoi(b)}
                  traLoi={thu.tl}
                  datTraLoi={(tl) => datThu((t) => t && { ...t, tl })}
                  daCham={thu.ket !== undefined}
                  chiTiet={thu.ket}
                  gui={(tl) => {
                    if (!tl) return;
                    const kq = TRO_CHOI_SOI_CAMERA.chamBuoc(b, tl, { thoiGianMs: null, offline: true });
                    datThu((t) => t && { ...t, tl, ket: kq.chiTiet });
                  }}
                />
              );
            })()}
          </div>
        ) : null}
      </div>
    </section>
  );
}
