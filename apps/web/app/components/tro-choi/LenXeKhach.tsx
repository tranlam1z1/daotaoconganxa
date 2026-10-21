/**
 * Một xe trong trò "Lên xe khách" (docs/PLAN.md GĐ-T13, docs/GAME_DESIGN.md §5.13).
 *
 * Ba thẻ chuyển qua lại (bề rộng điện thoại): Khoang xe (sơ đồ, chạm từng người để đếm, ô "số người vượt"
 * chỉnh bằng − và +), Giấy tờ (lệnh vận chuyển, phù hiệu; từ màn 3), Giám sát (thiết bị giám sát hành
 * trình; từ màn 4). Chạm chỗ sai trên giấy tờ và màn giám sát; đóng dấu Cho đi hoặc Lập biên bản (M2).
 * Lập biên bản thì kéo các lỗi đã chỉ ra vào biên bản theo thứ tự nặng đến nhẹ (`KeoTha`, có đường thay
 * thế bằng chạm và bàn phím), rồi nộp.
 *
 * Trang không biết ai là người, lỗi nào đúng: đúng sai, số người vượt đúng do máy chủ tính.
 */
import { useState } from "react";

import { nhanVienDan } from "../../lib/citation";
import {
  type ChiTietXeKhach,
  type DauXeKhach,
  type DeXeKhach,
  MUC_SO_NGUOI,
  ngayVn,
  phutCuaGio,
  SO_VUOT_TOI_DA,
  TEN_DAU_XE_KHACH,
} from "../../lib/len-xe-khach";
import { BienBan } from "./chung/BienBan";
import { type DongTheChung, type KetQuaChiTiet, TheGiayToChung } from "./chung/GiayTo";
import { DauMoc, NutDongDau } from "./chung/tuong-tac/DongDau";
import { lopVungTha, useKeoTha } from "./chung/tuong-tac/KeoTha";
import { phatAm } from "./hieu-ung/am-thanh";
import { dangGiamChuyenDong } from "./hieu-ung/cai-dat";
import { SoDoKhoangXe } from "./SoDoKhoangXe";

export interface TraLoiXeKhachWeb {
  dem: string[];
  so_vuot: number;
  cham: string[];
  dau: DauXeKhach | null;
  thu_tu: string[];
}

export const TRA_LOI_RONG_XE_KHACH: TraLoiXeKhachWeb = {
  dem: [],
  so_vuot: 0,
  cham: [],
  dau: null,
  thu_tu: [],
};

type The = "khoang" | "giay_to" | "giam_sat";
const TEN_THE: Record<The, string> = { khoang: "Khoang xe", giay_to: "Giấy tờ", giam_sat: "Giám sát" };
const TRE_GUI_MS = 500;
const gp = (p: number) => `${Math.floor(p / 60)} giờ ${String(p % 60).padStart(2, "0")} phút`;

/** Dòng chạm được của lệnh vận chuyển, phù hiệu: trường, nhãn trên thẻ, nhãn ngắn ở bước sắp lỗi. */
const DONG_LENH = [
  ["so", "Số lệnh", "số lệnh"],
  ["don_vi", "Đơn vị vận tải", "đơn vị"],
  ["bien_so", "Biển số xe", "biển số"],
  ["lai_xe", "Lái xe", "lái xe"],
  ["ngay", "Ngày thực hiện", "ngày"],
  ["tuyen", "Tuyến", "tuyến"],
] as const;
const DONG_PHU_HIEU = [
  ["so", "Số phù hiệu", "số"],
  ["loai", "Loại", "loại"],
  ["bien_so", "Biển số xe", "biển số"],
  ["co_gia_tri_den", "Có giá trị đến", "thời hạn"],
] as const;
const NHAN_CHO: Record<string, string> = {
  ...Object.fromEntries(DONG_LENH.map(([t, , n]) => [`lvc.${t}`, `Lệnh vận chuyển: ${n}`])),
  ...Object.fromEntries(DONG_PHU_HIEU.map(([t, , n]) => [`ph.${t}`, `Phù hiệu: ${n}`])),
  "thieu.lenh_van_chuyen": "Không có lệnh vận chuyển",
  "thieu.phu_hieu": "Không có phù hiệu",
  "gs.tong": "Giám sát: tổng thời gian lái",
};

/** Nhãn một chỗ chạm (dùng ở bước sắp lỗi và màn kết quả). */
function nhanCho(ma: string, de: DeXeKhach, soVuot: number): string {
  if (ma === MUC_SO_NGUOI) return `Chở quá số người (vượt ${soVuot})`;
  const d = ma.startsWith("gs.doan.") ? de.giam_sat?.doan[Number(ma.slice(8))] : undefined;
  return d ? `Giám sát: đoạn chạy ${d.tu}–${d.den}` : (NHAN_CHO[ma] ?? ma);
}

/** Thẻ giấy tờ không xuất trình: khung đứt nét, nút đánh dấu "không có". */
function Thieu({
  ten,
  ma,
  chon,
  kq,
  khoa,
  onCham,
}: {
  ten: string;
  ma: string;
  chon: boolean;
  kq?: KetQuaChiTiet;
  khoa: boolean;
  onCham: (m: string) => void;
}) {
  return (
    <div className="rounded-[14px] border-2 border-dashed p-3" style={{ borderColor: "var(--line-strong)" }}>
      <p className="text-[15px]">
        Lái xe <strong>không xuất trình</strong> {ten}.
      </p>
      <button
        type="button"
        disabled={khoa}
        aria-pressed={chon}
        data-ket-qua={kq}
        onClick={() => onCham(ma)}
        className="gt-dong mt-2 justify-center font-semibold"
      >
        {chon ? `Đã đánh dấu: không có ${ten}` : `Đánh dấu: không có ${ten}`}
      </button>
    </div>
  );
}

export function LenXeKhach({
  de,
  traLoi,
  datTraLoi,
  chiTiet,
  daCham,
  gui,
}: {
  de: DeXeKhach;
  traLoi: TraLoiXeKhachWeb;
  datTraLoi: (t: TraLoiXeKhachWeb) => void;
  chiTiet?: unknown;
  daCham: boolean;
  gui?: (t: TraLoiXeKhachWeb) => void;
}) {
  const [the, datThe] = useState<The>("khoang");
  const [daDong, datDaDong] = useState<DauXeKhach | null>(null);
  const [sap, datSap] = useState<Array<string | null>>([]);
  const ct = daCham ? (chiTiet as ChiTietXeKhach | undefined) : undefined;
  const khoa = daCham || daDong !== null;
  const cacThe: The[] = [
    "khoang",
    ...(de.giay_to ? (["giay_to"] as const) : []),
    ...(de.giam_sat ? (["giam_sat"] as const) : []),
  ];

  const nop = (t: TraLoiXeKhachWeb) => setTimeout(() => gui?.(t), dangGiamChuyenDong() ? 0 : TRE_GUI_MS);
  const chamNguoi = (id: string) => {
    if (khoa) return;
    datTraLoi({
      ...traLoi,
      dem: traLoi.dem.includes(id) ? traLoi.dem.filter((x) => x !== id) : [...traLoi.dem, id],
    });
  };
  const chamCho = (ma: string) => {
    if (khoa) return;
    datTraLoi({
      ...traLoi,
      cham: traLoi.cham.includes(ma) ? traLoi.cham.filter((x) => x !== ma) : [...traLoi.cham, ma],
    });
  };
  const muc = [...(traLoi.so_vuot > 0 ? [MUC_SO_NGUOI] : []), ...traLoi.cham];

  const dong = (d: DauXeKhach) => {
    if (khoa) return;
    datDaDong(d);
    phatAm("tich");
    if (d === "lap_bien_ban" && muc.length >= 2) {
      datTraLoi({ ...traLoi, dau: d });
      datSap(muc.map(() => null));
      return;
    }
    const t = { ...traLoi, dau: d, thu_tu: d === "lap_bien_ban" ? muc : [] };
    datTraLoi(t);
    nop(t);
  };
  const keo = useKeoTha((vat, vung) => {
    const i = Number(vung.slice(3));
    const moi = sap.map((x) => (x === vat ? null : x));
    moi[i] = vat;
    datSap(moi);
  });
  const dangSap = !daCham && daDong === "lap_bien_ban" && sap.length > 0;
  const nopSap = () => {
    const t = { ...traLoi, thu_tu: sap as string[] };
    datTraLoi(t);
    gui?.(t);
  };

  // Sau khi chấm: chỗ chỉ ra lỗi tô "loi", chỗ chạm nhầm tô "nham".
  const ketQua = new Map<string, KetQuaChiTiet>();
  if (ct) {
    for (const l of ct.loi) for (const c of l.cho) ketQua.set(c, "loi");
    for (const c of ct.cho_nham) ketQua.set(c, "nham");
  }
  const theChung = {
    dangChon: new Set(traLoi.cham),
    ketQua,
    khoa,
    onCham: chamCho,
    nhanCham: "Chạm để đánh dấu chỗ sai",
  };
  const dongThe = (ds: Array<[string | null, string, string]>): DongTheChung[] =>
    ds.map(([ma, nhan, giaTri]) => (ma ? { ma, nhan, giaTri } : { nhan, giaTri }));
  const lenh = de.giay_to?.lenh_van_chuyen;
  const ph = de.giay_to?.phu_hieu;
  const gs = de.giam_sat;
  const dau = daDong ?? (daCham ? traLoi.dau : null);

  return (
    <div className="space-y-3">
      <div className="g-a gt-vao relative">
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm text-ink-2">
          <span>
            {de.ten_loai_xe} · <strong className="g-so text-ink">{de.bien_so}</strong>
          </span>
          <span>
            {de.gio_kiem_tra} · {ngayVn(de.ngay_kiem_tra)}
          </span>
        </p>
        <p className="text-[15px]">
          Số chỗ hành khách (không kể lái xe): <strong className="g-so">{de.so_cho}</strong>
          {de.lai_xe ? (
            <>
              {" "}
              · Người đang lái: <strong>{de.lai_xe}</strong>
            </>
          ) : null}
        </p>
        {dau ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <DauMoc
              chon={dau}
              nhan={TEN_DAU_XE_KHACH[dau]}
              mau={dau === "cho_di" ? "ok" : "danger"}
              hoatAnh={!daCham}
            />
          </div>
        ) : null}
      </div>

      {cacThe.length > 1 ? (
        <div
          role="tablist"
          aria-label="Phần kiểm tra"
          className="grid grid-flow-col gap-1 rounded-2xl border p-1"
          style={{ borderColor: "var(--line)" }}
        >
          {cacThe.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`the-${t}`}
              aria-selected={the === t}
              aria-controls={`bang-${t}`}
              onClick={() => datThe(t)}
              className="min-h-12 rounded-xl text-[15px] font-semibold"
              style={the === t ? { background: "var(--primary-soft)", color: "var(--primary)" } : undefined}
            >
              {TEN_THE[t]}
            </button>
          ))}
        </div>
      ) : null}

      <div
        role="tabpanel"
        id={`bang-${the}`}
        aria-labelledby={cacThe.length > 1 ? `the-${the}` : undefined}
        className="space-y-3"
      >
        {the === "khoang" ? (
          <>
            <SoDoKhoangXe
              de={de}
              dem={traLoi.dem}
              onCham={chamNguoi}
              khoa={khoa}
              ketQua={
                ct
                  ? { dung: new Set(ct.dem_dung), du: new Set(ct.dem_du), sot: new Set(ct.bo_sot) }
                  : undefined
              }
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p aria-live="polite" className="text-[15px]">
                Đã đếm: <strong className="g-so">{traLoi.dem.length}</strong>
              </p>
              <div className="flex items-center gap-2">
                <span id="nhan-so-vuot" className="text-[15px]">
                  Số người vượt
                </span>
                <button
                  type="button"
                  disabled={khoa || traLoi.so_vuot <= 0}
                  onClick={() => datTraLoi({ ...traLoi, so_vuot: traLoi.so_vuot - 1 })}
                  aria-label="Giảm số người vượt"
                  className="min-h-12 min-w-12 rounded-xl border text-xl"
                  style={{ borderColor: "var(--line-strong)" }}
                >
                  −
                </button>
                <output
                  aria-labelledby="nhan-so-vuot"
                  aria-live="polite"
                  className="g-so min-w-8 text-center text-xl font-bold"
                >
                  {traLoi.so_vuot}
                </output>
                <button
                  type="button"
                  disabled={khoa || traLoi.so_vuot >= SO_VUOT_TOI_DA}
                  onClick={() => datTraLoi({ ...traLoi, so_vuot: traLoi.so_vuot + 1 })}
                  aria-label="Tăng số người vượt"
                  className="min-h-12 min-w-12 rounded-xl border text-xl"
                  style={{ borderColor: "var(--line-strong)" }}
                >
                  +
                </button>
              </div>
            </div>
            <p className="text-sm text-ink-2">Chạm từng người để đếm, chạm lại để bỏ. Không vượt thì để 0.</p>
          </>
        ) : null}
        {the === "giay_to" ? (
          <>
            {lenh ? (
              <TheGiayToChung
                tieuDe="Lệnh vận chuyển"
                mau="xanh"
                dong={dongThe(
                  DONG_LENH.map(([t, nhan]) => [
                    `lvc.${t}`,
                    nhan,
                    t === "ngay" ? ngayVn(lenh.ngay) : lenh[t],
                  ]),
                )}
                {...theChung}
              />
            ) : (
              <Thieu
                ten="lệnh vận chuyển"
                ma="thieu.lenh_van_chuyen"
                chon={traLoi.cham.includes("thieu.lenh_van_chuyen")}
                kq={ketQua.get("thieu.lenh_van_chuyen")}
                khoa={khoa}
                onCham={chamCho}
              />
            )}
            {ph ? (
              <TheGiayToChung
                tieuDe="Phù hiệu"
                mau="vang"
                dong={dongThe(
                  DONG_PHU_HIEU.map(([t, nhan]) => [
                    `ph.${t}`,
                    nhan,
                    t === "co_gia_tri_den" ? ngayVn(ph.co_gia_tri_den) : ph[t],
                  ]),
                )}
                {...theChung}
              />
            ) : (
              <Thieu
                ten="phù hiệu"
                ma="thieu.phu_hieu"
                chon={traLoi.cham.includes("thieu.phu_hieu")}
                kq={ketQua.get("thieu.phu_hieu")}
                khoa={khoa}
                onCham={chamCho}
              />
            )}
          </>
        ) : null}
        {the === "giam_sat" && gs ? (
          <TheGiayToChung
            tieuDe="Thiết bị giám sát hành trình"
            mau="do"
            dong={dongThe([
              [null, "Thiết bị", `${gs.thiet_bi} · ${ngayVn(gs.ngay)}`],
              ...gs.doan.map(
                (d, i) =>
                  [
                    `gs.doan.${i}`,
                    `${d.tu}–${d.den}`,
                    `${d.chay ? "Chạy" : "Dừng"} · ${gp(phutCuaGio(d.den) - phutCuaGio(d.tu))}`,
                  ] as [string, string, string],
              ),
              ["gs.tong", "Tổng thời gian lái trong ngày", gp(gs.tong_lai_phut)],
              [null, "Tốc độ lớn nhất ghi được", `${gs.toc_do_toi_da_kmh} km/h`],
            ])}
            {...theChung}
          />
        ) : null}
      </div>

      {dangSap ? (
        <section className="g-the space-y-2 rounded-2xl p-3" aria-label="Sắp lỗi vào biên bản">
          <h3 className="text-base font-semibold">Sắp lỗi vào biên bản, nặng đến nhẹ</h3>
          <p className="text-sm text-ink-2">Kéo từng lỗi vào ô thứ tự, hoặc chạm lỗi rồi chạm ô.</p>
          <div className="flex flex-wrap gap-2">
            {muc
              .filter((m) => !sap.includes(m))
              .map((m) => {
                const v = keo.vat(m);
                return (
                  <button
                    key={m}
                    {...v}
                    className={`${v.className} min-h-12 rounded-xl border-2 bg-surface px-3 text-left text-sm`}
                    style={{
                      ...v.style,
                      borderColor: keo.chon === m ? "var(--primary)" : "var(--line-strong)",
                    }}
                  >
                    {nhanCho(m, de, traLoi.so_vuot)}
                  </button>
                );
              })}
          </div>
          <ol className="grid gap-1.5">
            {sap.map((m, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: ô thứ tự cố định
              <li key={i}>
                <button
                  {...keo.vung(`vt-${i}`)}
                  className={`${lopVungTha(keo.chon !== null)} w-full text-left`}
                  style={{ borderColor: "var(--line-strong)" }}
                >
                  {i + 1}. {m ? nhanCho(m, de, traLoi.so_vuot) : "(chưa có)"}
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            disabled={sap.includes(null)}
            onClick={nopSap}
            className="g-nut min-h-12 w-full rounded-2xl bg-primary font-bold text-on-primary disabled:opacity-50"
          >
            Nộp biên bản
          </button>
        </section>
      ) : null}

      {!daCham && !daDong ? (
        <NutDongDau<DauXeKhach>
          onChon={dong}
          khoa={khoa}
          luaChon={[
            { ma: "cho_di", nhan: TEN_DAU_XE_KHACH.cho_di, mau: "ok" },
            {
              ma: "lap_bien_ban",
              nhan: TEN_DAU_XE_KHACH.lap_bien_ban,
              mau: "danger",
              khoa: muc.length === 0,
            },
          ]}
          nhac={
            muc.length
              ? "Đóng dấu là nộp. Lập biên bản thì sắp lỗi trước khi nộp."
              : "Muốn lập biên bản, hãy báo số người vượt hoặc chạm chỗ sai trước."
          }
        />
      ) : null}
    </div>
  );
}

/** Phần "Xem chi tiết" của một xe (GĐ17c): dấu đúng, điểm, các lỗi nặng đến nhẹ, chạm nhầm, biên bản. */
export function ChiTietRiengXeKhach({ de, chiTiet }: { de: DeXeKhach; chiTiet: unknown }) {
  const ct = chiTiet as ChiTietXeKhach;
  return (
    <div className="space-y-3">
      <p className="text-[15px]">
        Đúng ra: <strong>{TEN_DAU_XE_KHACH[ct.dau_dung]}</strong>. Đếm {ct.diem_dem}/10 (báo vượt {ct.so_vuot}
        , đúng {ct.so_vuot_dung}: {ct.so_quy_doi} người trên {ct.so_cho} chỗ; đếm dư {ct.dem_du.length}, bỏ
        sót {ct.bo_sot.length}){ct.diem_loi_toi_da ? ` · lỗi ${ct.diem_loi}/${ct.diem_loi_toi_da}` : ""} · dấu{" "}
        {ct.diem_dau}/5
        {ct.diem_thu_tu_toi_da ? ` · thứ tự ${ct.diem_thu_tu}/${ct.diem_thu_tu_toi_da}` : ""}.
      </p>
      {ct.loi.length ? (
        <section className="g-the rounded-2xl p-3" aria-label="Các lỗi">
          <h3 className="text-base font-semibold">Các lỗi, nặng đến nhẹ</h3>
          <ul className="mt-2 grid gap-2 text-sm">
            {[...ct.loi]
              .sort((a, b) => (b.phat_toi_da ?? -1) - (a.phat_toi_da ?? -1))
              .map((l) => (
                <li
                  key={l.ma}
                  className="border-l-4 pl-2"
                  style={{ borderColor: l.da_chi_ra ? "var(--ok)" : "var(--warn)" }}
                >
                  <strong>{l.ten}</strong> {l.da_chi_ra ? "(đã chỉ ra)" : "(bỏ sót)"}
                  <span className="block">{l.mo_ta}</span>
                  <span className="block text-ink-2">{l.giai_thich}</span>
                  <span className="block text-ink-2">Căn cứ: {nhanVienDan(l.can_cu)}</span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
      {ct.cho_nham.length ? (
        <p className="text-sm">
          Chạm nhầm (−2 mỗi chỗ): {ct.cho_nham.map((c) => nhanCho(c, de, ct.so_vuot)).join("; ")}.
        </p>
      ) : null}
      {ct.dau_dung === "lap_bien_ban" ? <BienBan dong={ct.bien_ban} /> : null}
    </div>
  );
}
