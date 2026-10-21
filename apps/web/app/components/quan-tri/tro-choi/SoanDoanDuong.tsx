/**
 * Trình soạn đoạn đường của trò "Cắm biển cho tuyến đường" (docs/PLAN.md GĐ-T3, GAME_DESIGN §3):
 * soạn theo lưới ô, không kéo thả tự do. Mỗi ô một dòng (ô trên cùng ở trên, xe chạy từ dưới lên):
 * đặc điểm của ô, có vị trí cắm biển không, biển đúng / chấp nhận được / để trống, lý do.
 *
 * Bộ kiểm hợp lệ là hàm thuần của trò (`kiemTraDoanDuong`), chạy mỗi lần sửa; lỗi hiện ngay cạnh
 * đúng ô, vị trí hoặc biển trong khay. Kết quả ghi vào các ô ẩn `payload`, `answer`, `refs` của biểu
 * mẫu trang soạn. "Chơi thử" dựng đúng giao diện trò từ bản nháp, chấm ngay trên máy, không ghi lượt.
 */
import { useMemo, useState } from "react";
import {
  TEN_THAO_TAC_BIEN_BAO,
  type ThaoTacBienBao,
} from "../../../../../../packages/dao-tao/src/bien-bao.ts";
import { LOAI_DAC_DIEM, TEN_DAC_DIEM } from "../../../../../../packages/dao-tao/src/mo-phong/duong.ts";
import {
  type DapAnDoanDuong,
  kiemTraDoanDuong,
  type PayloadDoanDuong,
  THONG_SO_MAN_CAM_BIEN,
  TRO_CHOI_CAM_BIEN,
} from "../../../../../../packages/dao-tao/src/tro-choi/cam-bien.ts";
import { urlAnhBien } from "../../../lib/cam-bien";
import { cn } from "../../../lib/cn";
import { CamBien, type TraLoiCamBienWeb } from "../../tro-choi/CamBien";
import { Button } from "../../ui/Button";
import { inputClass } from "../../ui/Field";

export interface BienSoan {
  ma: string;
  ten: string;
  anh: string;
  nhom: string;
  phan_ung: ThaoTacBienBao | null;
  da_duyet: boolean;
}

const DOAN_MOI: PayloadDoanDuong = { muc: 1, so_o: 8, dac_diem: [], vi_tri: [], khay: [] };

function docBanDau(p: unknown, a: unknown): { doan: PayloadDoanDuong; dapAn: DapAnDoanDuong } {
  const doan = p && typeof p === "object" && "so_o" in p ? (p as PayloadDoanDuong) : DOAN_MOI;
  const dapAn = a && typeof a === "object" && "vi_tri" in a ? (a as DapAnDoanDuong) : { vi_tri: {} };
  return { doan: structuredClone(doan), dapAn: structuredClone(dapAn) };
}

const idViTri = (o: number, ben: "phai" | "trai") => `v${o + 1}${ben === "trai" ? "t" : ""}`;

export function SoanDoanDuong({
  payload,
  answer,
  bien,
  khoa,
}: {
  payload: unknown;
  answer: unknown;
  bien: readonly BienSoan[];
  khoa: boolean;
}) {
  const [{ doan, dapAn }, dat] = useState(() => docBanDau(payload, answer));
  const [thu, datThu] = useState<{ khoa: number; ket?: unknown; tl: TraLoiCamBienWeb } | null>(null);
  const theoMa = useMemo(() => new Map(bien.map((b) => [b.ma, b])), [bien]);
  const daDuyet = useMemo(
    () => new Set(bien.filter((b) => b.da_duyet && b.phan_ung).map((b) => b.ma)),
    [bien],
  );
  const loi = kiemTraDoanDuong(doan, dapAn, daDuyet);
  const loiCua = (pt: string) => loi.filter((l) => l.phan_tu === pt).map((l) => l.loi);
  const ts = THONG_SO_MAN_CAM_BIEN[doan.muc];

  const sua = (f: (d: PayloadDoanDuong, a: DapAnDoanDuong) => void) =>
    dat((cu) => {
      const d = structuredClone(cu.doan);
      const a = structuredClone(cu.dapAn);
      f(d, a);
      return { doan: d, dapAn: a };
    });

  const doiKhay = (ma: string) =>
    sua((d, a) => {
      d.khay = d.khay.includes(ma) ? d.khay.filter((m) => m !== ma) : [...d.khay, ma];
      for (const v of Object.values(a.vi_tri)) {
        v.dung = v.dung.filter((m) => d.khay.includes(m));
        v.chap_nhan = v.chap_nhan.filter((m) => d.khay.includes(m));
      }
    });

  const doiViTri = (o: number, ben: "phai" | "trai") =>
    sua((d, a) => {
      const id = idViTri(o, ben);
      if (d.vi_tri.some((v) => v.id === id)) {
        d.vi_tri = d.vi_tri.filter((v) => v.id !== id);
        delete a.vi_tri[id];
      } else {
        d.vi_tri.push({ id, o, ben, toi_da: 1 });
        a.vi_tri[id] = { dung: [], chap_nhan: [], ly_do: "" };
      }
    });

  const doiBienViTri = (id: string, ma: string, loai: "dung" | "chap_nhan") =>
    sua((_, a) => {
      const v = a.vi_tri[id]!;
      const khac = loai === "dung" ? "chap_nhan" : "dung";
      v[loai] = v[loai].includes(ma) ? v[loai].filter((m) => m !== ma) : [...v[loai], ma];
      v[khac] = v[khac].filter((m) => m !== ma);
    });

  const refs = doan.khay.map((m) => `traffic_sign:${m}`).join("\n");
  const khayBien = doan.khay.map((m) => theoMa.get(m)).filter((b): b is BienSoan => Boolean(b));

  const deThu = () =>
    TRO_CHOI_CAM_BIEN.deChoNguoiChoi({
      thu_tu: 1,
      ref_kind: "game_content",
      ref_id: null,
      ref_version: null,
      topic_id: null,
      diem_toi_da: 0,
      noi_dung: {
        man: doan.muc,
        doan,
        dap_an: dapAn,
        bien: khayBien.map((b) => ({ ...b, version: 1, y_nghia: "", can_cu: "", nhom: b.nhom as never })),
      },
    });

  return (
    <section className="grid gap-4 rounded-xl border border-line bg-surface p-4" aria-label="Soạn đoạn đường">
      <input type="hidden" name="payload" value={JSON.stringify(doan)} />
      <input type="hidden" name="answer" value={JSON.stringify(dapAn)} />
      <input type="hidden" name="refs" value={refs} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold">
          Màn
          <select
            className={cn(inputClass, "min-h-11")}
            value={doan.muc}
            disabled={khoa}
            onChange={(e) =>
              sua((d) => {
                d.muc = Number(e.target.value);
              })
            }
          >
            {[1, 2, 3, 4, 5].map((m) => (
              <option key={m} value={m}>
                Màn {m}: {THONG_SO_MAN_CAM_BIEN[m]!.so_vi_tri} vị trí,{" "}
                {THONG_SO_MAN_CAM_BIEN[m]!.so_bien_khay} biển
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Số ô (mỗi ô 10 m)
          <input
            type="number"
            inputMode="numeric"
            min={6}
            max={16}
            className={cn(inputClass, "min-h-11")}
            value={doan.so_o}
            disabled={khoa}
            onChange={(e) =>
              sua((d) => {
                d.so_o = Math.max(6, Math.min(16, Number(e.target.value) || 6));
              })
            }
          />
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">
          Khay biển ({doan.khay.length}/{ts?.so_bien_khay ?? "?"}), gồm cả biển nhiễu
        </legend>
        <ul className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3">
          {bien
            .filter((b) => b.phan_ung && b.nhom !== "phu")
            .map((b) => (
              <li key={b.ma}>
                <label
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-lg border p-1 text-sm",
                    loiCua(`khay:${b.ma}`).length > 0 && "border-danger",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={doan.khay.includes(b.ma)}
                    disabled={khoa}
                    onChange={() => doiKhay(b.ma)}
                    className="size-5"
                  />
                  <img src={urlAnhBien(b.anh)} alt="" className="size-7" />
                  <span className="min-w-0">
                    <span className="block truncate">{b.ten}</span>
                    <span className="block text-xs text-ink-2">
                      {b.ma} · {TEN_THAO_TAC_BIEN_BAO[b.phan_ung!]}
                      {b.da_duyet ? "" : " · chưa duyệt"}
                    </span>
                  </span>
                </label>
              </li>
            ))}
        </ul>
        {doan.khay
          .flatMap((m) => loiCua(`khay:${m}`))
          .map((l) => (
            <p key={l} className="mt-1 text-sm text-danger">
              {l}
            </p>
          ))}
      </fieldset>

      <div>
        <p className="text-sm font-semibold">Đoạn đường (ô trên cùng ở trên, xe chạy từ dưới lên)</p>
        <ol className="mt-2 grid gap-2">
          {Array.from({ length: doan.so_o }, (_, i) => doan.so_o - 1 - i).map((o) => {
            const dd = doan.dac_diem.find((d) => d.o === o);
            const loiO = [
              ...loiCua(`o:${o}`),
              ...doan.vi_tri.filter((v) => v.o === o).flatMap((v) => loiCua(`vi_tri:${v.id}`)),
            ];
            return (
              <li
                key={o}
                className={cn("rounded-lg border p-2", loiO.length ? "border-danger" : "border-line")}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-12 text-sm font-semibold">Ô {o + 1}</span>
                  <select
                    aria-label={`Đặc điểm ô ${o + 1}`}
                    className={cn(inputClass, "min-h-11 w-auto")}
                    value={dd?.loai ?? ""}
                    disabled={khoa}
                    onChange={(e) =>
                      sua((d) => {
                        d.dac_diem = d.dac_diem.filter((x) => x.o !== o);
                        if (e.target.value) d.dac_diem.push({ o, loai: e.target.value as never });
                        d.dac_diem.sort((a, b) => a.o - b.o);
                      })
                    }
                  >
                    <option value="">Không có đặc điểm</option>
                    {LOAI_DAC_DIEM.map((l) => (
                      <option key={l} value={l}>
                        {TEN_DAC_DIEM[l]}
                      </option>
                    ))}
                  </select>
                  {(["phai", "trai"] as const).map((ben) => (
                    <label key={ben} className="flex min-h-11 items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        className="size-5"
                        disabled={khoa}
                        checked={doan.vi_tri.some((v) => v.id === idViTri(o, ben))}
                        onChange={() => doiViTri(o, ben)}
                      />
                      Cột biển bên {ben === "phai" ? "phải" : "trái"}
                    </label>
                  ))}
                </div>
                {doan.vi_tri
                  .filter((v) => v.o === o)
                  .map((v) => {
                    const a = dapAn.vi_tri[v.id] ?? { dung: [], chap_nhan: [], ly_do: "" };
                    return (
                      <div key={v.id} className="mt-2 grid gap-2 border-t border-line pt-2 text-sm">
                        <p className="font-semibold">
                          Cột {v.ben === "phai" ? "phải" : "trái"} ({v.id})
                          {ts?.nhieu_bien ? (
                            <label className="ml-3 font-normal">
                              Cắm được{" "}
                              <select
                                className="rounded border border-line"
                                value={v.toi_da}
                                disabled={khoa}
                                onChange={(e) =>
                                  sua((d) => {
                                    d.vi_tri.find((x) => x.id === v.id)!.toi_da = Number(e.target.value);
                                  })
                                }
                              >
                                <option value={1}>1 biển</option>
                                <option value={2}>2 biển</option>
                              </select>
                            </label>
                          ) : null}
                        </p>
                        {(["dung", "chap_nhan"] as const).map((loai) => (
                          <div key={loai} className="flex flex-wrap items-center gap-1">
                            <span className="w-28 text-ink-2">
                              {loai === "dung" ? "Biển đúng" : "Chấp nhận được"}
                            </span>
                            {khayBien.map((b) => (
                              <button
                                key={b.ma}
                                type="button"
                                disabled={khoa}
                                aria-pressed={a[loai].includes(b.ma)}
                                title={b.ten}
                                onClick={() => doiBienViTri(v.id, b.ma, loai)}
                                className={cn(
                                  "grid size-11 place-items-center rounded-lg border-2",
                                  a[loai].includes(b.ma) ? "border-primary" : "border-line opacity-60",
                                )}
                              >
                                <img src={urlAnhBien(b.anh)} alt={b.ten} className="size-8" />
                              </button>
                            ))}
                          </div>
                        ))}
                        {!a.dung.length ? (
                          <p className="text-ink-2">Không chọn biển đúng: vị trí nên để trống (chỉ màn 5).</p>
                        ) : null}
                        <label className="grid gap-1">
                          Lý do (hiện ở màn kết quả)
                          <input
                            className={cn(inputClass, "min-h-11")}
                            value={a.ly_do}
                            disabled={khoa}
                            onChange={(e) =>
                              sua((_, x) => {
                                x.vi_tri[v.id] = { ...a, ly_do: e.target.value };
                              })
                            }
                          />
                        </label>
                      </div>
                    );
                  })}
                {loiO.map((l) => (
                  <p key={l} className="mt-1 text-sm text-danger">
                    {l}
                  </p>
                ))}
              </li>
            );
          })}
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
          ? `Còn ${loi.length} lỗi; đoạn có lỗi không vào trò kể cả khi đã duyệt.`
          : "Bố cục hợp lệ."}{" "}
        Tham chiếu tới các biển trong khay được ghi tự động.
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
            <CamBien
              key={thu.khoa}
              de={deThu()}
              traLoi={thu.tl}
              datTraLoi={(tl) => datThu((t) => t && { ...t, tl })}
              daCham={thu.ket !== undefined}
              chiTiet={thu.ket}
              gui={(tl) => {
                if (!tl) return;
                const b = {
                  thu_tu: 1,
                  ref_kind: "game_content" as const,
                  ref_id: null,
                  ref_version: null,
                  topic_id: null,
                  diem_toi_da: 0,
                  noi_dung: {
                    man: doan.muc,
                    doan,
                    dap_an: dapAn,
                    bien: khayBien.map((x) => ({
                      ...x,
                      version: 1,
                      y_nghia: "",
                      can_cu: "",
                      nhom: x.nhom as never,
                    })),
                  },
                };
                const kq = TRO_CHOI_CAM_BIEN.chamBuoc(b, tl, { thoiGianMs: null, offline: true });
                datThu((t) => t && { ...t, tl, ket: kq.chiTiet });
              }}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
