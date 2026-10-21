/**
 * Trình soạn vụ của trò "Tái dựng hiện trường" (docs/PLAN.md GĐ-T10, GAME_DESIGN §3, §5.10).
 *
 * Soạn bằng biểu mẫu: sơ đồ theo mẫu có sẵn (đoạn thẳng hoặc ngã tư, số làn, mặt đường, biển tốc độ, vật cố
 * định, màu đèn lúc xảy ra), mỗi xe một dòng kèm DỰNG CẢNH GỐC (vị trí tâm xe theo mét, hướng, mức tốc độ,
 * hành động), lời kể, lỗi đúng và mã mức phạt, diễn biến. Dấu vết KHÔNG soạn tay: mỗi lần sửa, M5 chạy dựng
 * cảnh gốc và vẽ dấu vết ở ô xem trước. Bộ kiểm (`kiemTraVuTaiDung`) báo lỗi ngay cạnh xe, lỗi, sơ đồ. Kết
 * quả ghi vào các ô ẩn `payload`, `answer`, `refs`. "Chơi thử" chấm ngay trên máy, không ghi lượt.
 */
import { useMemo, useState } from "react";

import type { Huong } from "../../../../../../packages/dao-tao/src/mo-phong/duong.ts";
import {
  HANH_DONG_XE,
  MAT_DUONG,
  type MucTocDo,
} from "../../../../../../packages/dao-tao/src/mo-phong/va-cham.ts";
import {
  chayTaiDung,
  type DapAnTaiDung,
  dungCanhGoc,
  kiemTraVuTaiDung,
  LOAI_LOI_TAI_DUNG,
  LOAI_VAT_TAI_DUNG,
  LOAI_XE_TAI_DUNG,
  type PayloadTaiDung,
  TEN_HANH_DONG_XE,
  TEN_LOAI_XE_TAI_DUNG,
  TEN_LOI_TAI_DUNG,
  TEN_MAT_DUONG,
  TEN_MUC_TOC_DO,
  TEN_VAT_TAI_DUNG,
  TRO_CHOI_TAI_DUNG,
} from "../../../../../../packages/dao-tao/src/tro-choi/tai-dung.ts";
import { cn } from "../../../lib/cn";
import { TEN_HUONG } from "../../../lib/tai-dung";
import { docBangMau } from "../../../lib/ve-canh/mau";
import { veDauVet, veSoDo, veXe } from "../../../lib/ve-canh/ve-tai-dung";
import { CanhTrenXuong } from "../../tro-choi/chung/CanhTrenXuong";
import { TaiDung, type TraLoiTaiDungWeb } from "../../tro-choi/TaiDung";
import { Button } from "../../ui/Button";
import { inputClass } from "../../ui/Field";
import type { MucPhatSoan } from "./SoanKichBanXe";

const MOI: { p: PayloadTaiDung; da: DapAnTaiDung } = {
  p: {
    muc: 1,
    tin_bao: "",
    so_do: {
      kieu: "doan_thang",
      rong_m: 20,
      cao_m: 70,
      so_lan: 1,
      mat_duong: "kho",
      toc_do_toi_da_kmh: 50,
      vat: [{ id: "R1", loai: "rao", x: 12, y: 20, rong: 3, dai: 0.6 }],
      den: [],
    },
    xe: [{ id: "A", loai: "o_to", nhan: "Xe A (ô tô con)" }],
    loi_ke: [],
  },
  da: {
    dung_canh: [{ xe: "A", x: 12, y: 60, huong: 0, muc: 3, hanh_dong: "phanh" }],
    loi: [{ xe: "A", loi: "qua_toc_do", ma_muc_phat: "", mo_ta: "" }],
    giai_thich: "",
  },
};

const o = (cls?: string) => cn(inputClass, "min-h-11", cls);
const so = (v: string) => (v === "" ? 0 : Number(v));

export function SoanDungCanh({
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
  const [p, datP] = useState<PayloadTaiDung>(() =>
    payload && typeof payload === "object" && "so_do" in payload
      ? structuredClone(payload as PayloadTaiDung)
      : structuredClone(MOI.p),
  );
  const [da, datDa] = useState<DapAnTaiDung>(() =>
    answer && typeof answer === "object" && "dung_canh" in answer
      ? structuredClone(answer as DapAnTaiDung)
      : structuredClone(MOI.da),
  );
  const [thu, datThu] = useState<{ khoa: number; tl: TraLoiTaiDungWeb; ket?: unknown } | null>(null);

  const loi = kiemTraVuTaiDung(p, da);
  const loiCua = (pt: string) => loi.filter((l) => l.phan_tu === pt).map((l) => l.loi);
  // Dấu vết do M5 tính từ dựng cảnh gốc, để người soạn thấy người chơi sẽ nhìn thấy gì.
  const dauVet = useMemo(() => {
    try {
      return chayTaiDung(p, dungCanhGoc(da)).dau_vet;
    } catch {
      return null;
    }
  }, [p, da]);

  const suaP = (f: (x: PayloadTaiDung) => void) =>
    datP((cu) => {
      const x = structuredClone(cu);
      f(x);
      return x;
    });
  const suaDa = (f: (x: DapAnTaiDung) => void) =>
    datDa((cu) => {
      const x = structuredClone(cu);
      f(x);
      return x;
    });
  const refs = [...new Set(da.loi.map((l) => l.ma_muc_phat).filter(Boolean))]
    .map((m) => `violation:${m}`)
    .join("\n");
  const sd = p.so_do;
  const loaiXe = new Map(p.xe.map((x) => [x.id, x.loai]));

  const themXe = () => {
    const id = "ABC".split("").find((c) => !p.xe.some((x) => x.id === c));
    if (!id) return;
    suaP((x) => void x.xe.push({ id, loai: "o_to", nhan: `Xe ${id} (ô tô con)` }));
    suaDa(
      (x) =>
        void x.dung_canh.push({
          xe: id,
          x: Math.floor(sd.rong_m / 2),
          y: 10,
          huong: 4,
          muc: 1,
          hanh_dong: "di_thang",
        }),
    );
  };
  const xoaXe = (id: string) => {
    suaP((x) => {
      x.xe = x.xe.filter((v) => v.id !== id);
    });
    suaDa((x) => {
      x.dung_canh = x.dung_canh.filter((v) => v.xe !== id);
      x.loi = x.loi.filter((v) => v.xe !== id);
    });
  };

  return (
    <section className="grid gap-4 rounded-xl border border-line bg-surface p-4" aria-label="Soạn vụ va chạm">
      <input type="hidden" name="payload" value={JSON.stringify(p)} />
      <input type="hidden" name="answer" value={JSON.stringify(da)} />
      <input type="hidden" name="refs" value={refs} />

      <fieldset className="grid gap-3 sm:grid-cols-3" disabled={khoa}>
        <legend className="mb-1 text-sm font-semibold">
          Vụ và sơ đồ (mét; gốc ở góc trên trái, trục y đi xuống)
        </legend>
        <label className="grid gap-1 text-sm">
          Màn
          <select
            className={o()}
            value={p.muc}
            onChange={(e) =>
              suaP((x) => {
                x.muc = Number(e.target.value);
              })
            }
          >
            {[1, 2, 3, 4, 5].map((m) => (
              <option key={m} value={m}>
                Màn {m}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Kiểu sơ đồ
          <select
            className={o()}
            value={sd.kieu}
            onChange={(e) =>
              suaP((x) => {
                x.so_do.kieu = e.target.value as "doan_thang" | "nga_tu";
              })
            }
          >
            <option value="doan_thang">Đoạn đường thẳng</option>
            <option value="nga_tu">Ngã tư</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Mặt đường
          <select
            className={o()}
            value={sd.mat_duong}
            onChange={(e) =>
              suaP((x) => {
                x.so_do.mat_duong = e.target.value as never;
              })
            }
          >
            {MAT_DUONG.map((m) => (
              <option key={m} value={m}>
                {TEN_MAT_DUONG[m]}
              </option>
            ))}
          </select>
        </label>
        {(
          [
            ["rong_m", "Rộng (10–80 m)"],
            ["cao_m", "Cao (20–120 m)"],
          ] as const
        ).map(([k, nhan]) => (
          <label key={k} className="grid gap-1 text-sm">
            {nhan}
            <input
              type="number"
              inputMode="numeric"
              className={o()}
              value={sd[k]}
              onChange={(e) =>
                suaP((x) => {
                  x.so_do[k] = so(e.target.value);
                })
              }
            />
          </label>
        ))}
        <label className="grid gap-1 text-sm">
          Số làn mỗi chiều
          <select
            className={o()}
            value={sd.so_lan}
            onChange={(e) =>
              suaP((x) => {
                x.so_do.so_lan = Number(e.target.value) as 1 | 2;
              })
            }
          >
            <option value={1}>1 làn</option>
            <option value={2}>2 làn</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Biển tốc độ tối đa (km/h, để trống nếu không có)
          <input
            type="number"
            inputMode="numeric"
            className={o()}
            value={sd.toc_do_toi_da_kmh ?? ""}
            onChange={(e) =>
              suaP((x) => {
                x.so_do.toc_do_toi_da_kmh = e.target.value === "" ? null : so(e.target.value);
              })
            }
          />
        </label>
        <label className="grid gap-1 text-sm sm:col-span-3">
          Tin báo
          <textarea
            className={cn(inputClass)}
            rows={2}
            value={p.tin_bao}
            onChange={(e) =>
              suaP((x) => {
                x.tin_bao = e.target.value;
              })
            }
          />
        </label>
      </fieldset>

      <fieldset disabled={khoa}>
        <legend className="text-sm font-semibold">Vật cố định (tâm và cỡ theo mét, bước 0,1 m)</legend>
        <ul className="mt-2 grid gap-2">
          {sd.vat.map((v, i) => (
            <li key={v.id} className="grid grid-cols-3 gap-2 sm:grid-cols-7">
              <input
                aria-label="Mã vật"
                className={o()}
                value={v.id}
                onChange={(e) =>
                  suaP((x) => {
                    x.so_do.vat[i]!.id = e.target.value;
                  })
                }
              />
              <select
                aria-label="Loại vật"
                className={o()}
                value={v.loai}
                onChange={(e) =>
                  suaP((x) => {
                    x.so_do.vat[i]!.loai = e.target.value as never;
                  })
                }
              >
                {LOAI_VAT_TAI_DUNG.map((l) => (
                  <option key={l} value={l}>
                    {TEN_VAT_TAI_DUNG[l]}
                  </option>
                ))}
              </select>
              {(["x", "y", "rong", "dai"] as const).map((k) => (
                <input
                  key={k}
                  aria-label={k === "rong" ? "Rộng" : k === "dai" ? "Dài" : `Tâm ${k}`}
                  type="number"
                  step={0.1}
                  className={o()}
                  value={v[k]}
                  onChange={(e) =>
                    suaP((x) => {
                      x.so_do.vat[i]![k] = so(e.target.value);
                    })
                  }
                />
              ))}
              <Button
                type="button"
                variant="secondary"
                onClick={() => suaP((x) => void x.so_do.vat.splice(i, 1))}
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
          onClick={() =>
            suaP(
              (x) =>
                void x.so_do.vat.push({
                  id: `V${x.so_do.vat.length + 1}`,
                  loai: "cot",
                  x: 1,
                  y: 1,
                  rong: 0.4,
                  dai: 0.4,
                }),
            )
          }
        >
          Thêm vật
        </Button>
        {sd.kieu === "nga_tu" ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([0, 2, 4, 6] as const).map((h) => {
              const d = sd.den.find((x) => x.huong === h);
              return (
                <label key={h} className="grid gap-1 text-sm">
                  Đèn cho xe đi hướng {TEN_HUONG[h]}
                  <select
                    className={o()}
                    value={d?.mau ?? ""}
                    onChange={(e) =>
                      suaP((x) => {
                        x.so_do.den = x.so_do.den.filter((k) => k.huong !== h);
                        if (e.target.value) x.so_do.den.push({ huong: h, mau: e.target.value as never });
                      })
                    }
                  >
                    <option value="">Không có đèn</option>
                    <option value="xanh">Xanh</option>
                    <option value="vang">Vàng</option>
                    <option value="do">Đỏ</option>
                  </select>
                </label>
              );
            })}
          </div>
        ) : null}
        {loiCua("so_do").map((l) => (
          <p key={l} className="mt-1 text-sm text-danger">
            {l}
          </p>
        ))}
      </fieldset>

      <fieldset disabled={khoa}>
        <legend className="text-sm font-semibold">Xe và dựng cảnh gốc (tâm xe, mét nguyên)</legend>
        <ul className="mt-2 grid gap-3">
          {p.xe.map((v, i) => {
            const d = da.dung_canh.find((k) => k.xe === v.id);
            const suaD = (f: (k: DapAnTaiDung["dung_canh"][number]) => void) =>
              suaDa((x) => {
                const k = x.dung_canh.find((z) => z.xe === v.id);
                if (k) f(k);
              });
            return (
              <li key={v.id} className="grid gap-2 rounded-lg border border-line p-2">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <p className="self-center font-semibold">Xe {v.id}</p>
                  <select
                    aria-label="Loại xe"
                    className={o()}
                    value={v.loai}
                    onChange={(e) =>
                      suaP((x) => {
                        x.xe[i]!.loai = e.target.value as never;
                      })
                    }
                  >
                    {LOAI_XE_TAI_DUNG.map((l) => (
                      <option key={l} value={l}>
                        {TEN_LOAI_XE_TAI_DUNG[l]}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="Nhãn hiện cho người chơi"
                    className={o("sm:col-span-2")}
                    value={v.nhan}
                    onChange={(e) =>
                      suaP((x) => {
                        x.xe[i]!.nhan = e.target.value;
                      })
                    }
                  />
                </div>
                {d ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                    {(["x", "y"] as const).map((k) => (
                      <label key={k} className="grid gap-1 text-sm">
                        {k} (m)
                        <input
                          type="number"
                          inputMode="numeric"
                          className={o()}
                          value={d[k]}
                          onChange={(e) =>
                            suaD((z) => {
                              z[k] = so(e.target.value);
                            })
                          }
                        />
                      </label>
                    ))}
                    <label className="grid gap-1 text-sm">
                      Hướng
                      <select
                        className={o()}
                        value={d.huong}
                        onChange={(e) =>
                          suaD((z) => {
                            z.huong = Number(e.target.value) as Huong;
                          })
                        }
                      >
                        {TEN_HUONG.map((t, h) => (
                          <option key={t} value={h}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm">
                      Tốc độ
                      <select
                        className={o()}
                        value={d.muc}
                        onChange={(e) =>
                          suaD((z) => {
                            z.muc = Number(e.target.value) as MucTocDo;
                          })
                        }
                      >
                        {TEN_MUC_TOC_DO.map((t, m) => (
                          <option key={t} value={m}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm sm:col-span-2">
                      Hành động
                      <select
                        className={o()}
                        value={d.hanh_dong}
                        onChange={(e) =>
                          suaD((z) => {
                            z.hanh_dong = e.target.value as never;
                          })
                        }
                      >
                        {HANH_DONG_XE.map((h) => (
                          <option key={h} value={h}>
                            {TEN_HANH_DONG_XE[h]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}
                {loiCua(`xe:${v.id}`).map((l) => (
                  <p key={l} className="text-sm text-danger">
                    {l}
                  </p>
                ))}
                {p.xe.length > 1 ? (
                  <Button type="button" variant="secondary" onClick={() => xoaXe(v.id)}>
                    Xóa xe {v.id}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
        {p.xe.length < 3 ? (
          <Button type="button" variant="secondary" className="mt-2" onClick={themXe}>
            Thêm xe
          </Button>
        ) : null}
      </fieldset>

      <fieldset disabled={khoa}>
        <legend className="text-sm font-semibold">Lời kể (tối đa 4)</legend>
        <ul className="mt-2 grid gap-2">
          {p.loi_ke.map((k, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: dòng chỉ định danh theo thứ tự.
            <li key={i} className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]">
              <input
                aria-label="Người kể"
                className={o()}
                value={k.nguoi}
                onChange={(e) =>
                  suaP((x) => {
                    x.loi_ke[i]!.nguoi = e.target.value;
                  })
                }
              />
              <input
                aria-label="Lời kể"
                className={o()}
                value={k.ke}
                onChange={(e) =>
                  suaP((x) => {
                    x.loi_ke[i]!.ke = e.target.value;
                  })
                }
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => suaP((x) => void x.loi_ke.splice(i, 1))}
              >
                Xóa
              </Button>
            </li>
          ))}
        </ul>
        {p.loi_ke.length < 4 ? (
          <Button
            type="button"
            variant="secondary"
            className="mt-2"
            onClick={() => suaP((x) => void x.loi_ke.push({ nguoi: "", ke: "" }))}
          >
            Thêm lời kể
          </Button>
        ) : null}
      </fieldset>

      <fieldset disabled={khoa}>
        <legend className="text-sm font-semibold">Lỗi đúng (1–2 lỗi, bắt buộc có mã mức phạt)</legend>
        <ol className="mt-2 grid gap-2">
          {da.loi.map((l, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: dòng chỉ định danh theo thứ tự.
            <li key={i} className="grid gap-2 rounded-lg border border-line p-2 text-sm sm:grid-cols-3">
              <select
                aria-label="Xe có lỗi"
                className={o()}
                value={l.xe}
                onChange={(e) =>
                  suaDa((x) => {
                    x.loi[i]!.xe = e.target.value;
                  })
                }
              >
                {p.xe.map((v) => (
                  <option key={v.id} value={v.id}>
                    Xe {v.id}
                  </option>
                ))}
              </select>
              <select
                aria-label="Lỗi"
                className={o()}
                value={l.loi}
                onChange={(e) =>
                  suaDa((x) => {
                    x.loi[i]!.loi = e.target.value as never;
                  })
                }
              >
                {LOAI_LOI_TAI_DUNG.map((k) => (
                  <option key={k} value={k}>
                    {TEN_LOI_TAI_DUNG[k]}
                  </option>
                ))}
              </select>
              <select
                aria-label="Mã mức phạt"
                className={o()}
                value={l.ma_muc_phat}
                onChange={(e) =>
                  suaDa((x) => {
                    x.loi[i]!.ma_muc_phat = e.target.value;
                  })
                }
              >
                <option value="">Chọn dòng mức phạt</option>
                {mucPhat.map((m) => (
                  <option key={m.ma} value={m.ma}>
                    {m.ma} · {m.ten.slice(0, 60)}
                    {m.da_duyet ? "" : " (chưa duyệt)"}
                  </option>
                ))}
              </select>
              <input
                aria-label="Mô tả tình huống"
                placeholder="Mô tả tình huống cho màn kết quả và biên bản"
                className={o("sm:col-span-2")}
                value={l.mo_ta}
                onChange={(e) =>
                  suaDa((x) => {
                    x.loi[i]!.mo_ta = e.target.value;
                  })
                }
              />
              <Button type="button" variant="secondary" onClick={() => suaDa((x) => void x.loi.splice(i, 1))}>
                Xóa lỗi
              </Button>
              {loiCua(`loi:${i}`).map((k) => (
                <p key={k} className="text-danger sm:col-span-3">
                  {k}
                </p>
              ))}
            </li>
          ))}
        </ol>
        {da.loi.length < 2 ? (
          <Button
            type="button"
            variant="secondary"
            className="mt-2"
            onClick={() =>
              suaDa(
                (x) => void x.loi.push({ xe: p.xe[0]!.id, loi: "qua_toc_do", ma_muc_phat: "", mo_ta: "" }),
              )
            }
          >
            Thêm lỗi
          </Button>
        ) : null}
        <label className="mt-3 grid gap-1 text-sm">
          Diễn biến đúng (hiện ở màn kết quả)
          <textarea
            className={cn(inputClass)}
            rows={3}
            value={da.giai_thich}
            onChange={(e) =>
              suaDa((x) => {
                x.giai_thich = e.target.value;
              })
            }
          />
        </label>
      </fieldset>

      {dauVet && sd.rong_m > 0 && sd.cao_m > 0 ? (
        <div>
          <p className="text-sm font-semibold">Xem trước: dấu vết M5 tính từ dựng cảnh gốc</p>
          <div className="mx-auto mt-2" style={{ width: Math.min(360, (420 * sd.rong_m) / sd.cao_m) }}>
            <CanhTrenXuong
              khung={{ x0: 0, y0: 0, x1: sd.rong_m * 100, y1: sd.cao_m * 100 }}
              cao={0}
              tyLeCao={sd.cao_m / sd.rong_m}
              chay={false}
              phienBan={JSON.stringify([p, da])}
              ve={(ctx, bd) => {
                const m = docBangMau(ctx.canvas);
                veSoDo(ctx, bd, m, sd);
                veDauVet(ctx, bd, m, dauVet, loaiXe, m.chu);
                for (const d of da.dung_canh)
                  veXe(
                    ctx,
                    bd,
                    m,
                    {
                      id: d.xe,
                      loai: loaiXe.get(d.xe) ?? "o_to",
                      x: d.x * 100,
                      y: d.y * 100,
                      huong: d.huong,
                    },
                    "dac",
                    m.chinh,
                  );
              }}
              nhan="Xem trước sơ đồ, vị trí ban đầu theo dựng cảnh gốc và dấu vết mô phỏng."
              className="overflow-hidden rounded-2xl border border-line"
            />
          </div>
        </div>
      ) : null}

      {loiCua("vu").length ? (
        <ul className="grid gap-1 text-sm text-danger">
          {loiCua("vu").map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      ) : null}
      <p className="text-sm text-ink-2">
        {loi.length ? `Còn ${loi.length} lỗi; vụ có lỗi không vào trò kể cả khi đã duyệt.` : "Vụ hợp lệ."}{" "}
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
        {thu && !loi.length ? (
          <div className="mt-3 rounded-xl border border-line p-3">
            <p className="mb-2 text-sm text-ink-2">Chơi thử từ bản nháp: không ghi lượt, không cộng XP.</p>
            {(() => {
              const [b] = TRO_CHOI_TAI_DUNG.taoLuot(
                [{ id: "thu", code: "thu", version: 1, topic_id: null, vu: p, dap_an: da, muc_phat: {} }],
                () => 0,
                p.muc,
              );
              if (!b) return null;
              return (
                <TaiDung
                  key={thu.khoa}
                  de={TRO_CHOI_TAI_DUNG.deChoNguoiChoi(b)}
                  traLoi={thu.tl}
                  datTraLoi={(tl) => datThu((t) => t && { ...t, tl })}
                  daCham={thu.ket !== undefined}
                  chiTiet={thu.ket}
                  gui={(tl) => {
                    if (!tl) return;
                    const kq = TRO_CHOI_TAI_DUNG.chamBuoc(b, tl, { thoiGianMs: null, offline: true });
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
