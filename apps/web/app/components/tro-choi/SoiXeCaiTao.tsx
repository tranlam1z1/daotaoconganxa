/**
 * Một xe trong trò "Soi xe cải tạo" (docs/PLAN.md GĐ-T14, docs/GAME_DESIGN.md §5.14).
 *
 * Hai hình (nhìn nghiêng, nhìn sau) dựng từ nét máy chủ gửi; giấy chứng nhận kiểm định ghi thông số xe gốc.
 * Khoanh chỗ khác giấy: kéo khung hoặc vẽ vòng (M2 `KhoanhVung`), chạm nhẹ để đặt khung nhỏ, hoặc nút "Thêm
 * khung" (đường cho bàn phím); khung đang chọn dời, nới bằng nút hoặc phím mũi tên (Shift: đổi cỡ). Chạm dòng
 * trên giấy để nối với khung đang chọn. Phóng to 2×, thước đo hai đầu (mm). Đóng dấu Đạt hoặc Không đạt là nộp.
 *
 * Trang không biết chỗ nào sai: đúng sai do máy chủ chấm.
 */
import { useRef, useState } from "react";

import { nhanVienDan } from "../../lib/citation";
import {
  type ChiTietSoiXe,
  type DauSoiXe,
  type DeSoiXe,
  DONG_THONG_SO,
  type DongThongSo,
  type GocNhin,
  type Hop,
  KHUNG_TOI_DA_MOI_HINH,
  type KhungKhoanh,
  type KieuNet,
  ngayVn,
  TEN_DAU_SOI_XE,
  TEN_DONG_THONG_SO,
} from "../../lib/soi-xe-cai-tao";
import { BienBan } from "./chung/BienBan";
import { TheGiayToChung } from "./chung/GiayTo";
import { DauMoc, NutDongDau } from "./chung/tuong-tac/DongDau";
import { KhoanhVung } from "./chung/tuong-tac/KhoanhVung";
import { phatAm } from "./hieu-ung/am-thanh";
import { dangGiamChuyenDong } from "./hieu-ung/cai-dat";
import { type DiemThuoc, ThuocDo } from "./ThuocDo";

export interface TraLoiSoiXeWeb {
  khung: KhungKhoanh[];
  dau: DauSoiXe | null;
}
export const TRA_LOI_RONG_SOI_XE: TraLoiSoiXeWeb = { khung: [], dau: null };

const TEN_GOC: Record<GocNhin, string> = { nghieng: "nhìn nghiêng", sau: "nhìn sau" };
const MAU_NET: Record<Exclude<KieuNet, "son">, string> = {
  hang: "var(--surface-2)",
  kinh: "#9cc3de",
  toi: "#23272e",
  ghe: "#6b7280",
  sang: "#f2c14e",
  do: "#d64045",
};
const BUOC = 5;

/**
 * Ảnh minh họa xe đứng trước mặt người chơi (đã cải tạo): PNG nền trong trong app/assets/tro-choi/soi-xe-cai-tao/,
 * tên tệp theo mã xe mẫu trong data/tro-choi/xe-cai-tao.json (docs/PROMPT_NHAN_VAT_XE.md §8). Đề không mang mã
 * xe nên tra theo biển số. Ảnh chỉ để nhìn; khoanh và đo vẫn trên hai hình dựng theo tham số. Xe không có ảnh
 * (xe do người soạn thêm) thì không hiện thẻ ảnh.
 */
const ANH_XE = import.meta.glob<string>("../../assets/tro-choi/soi-xe-cai-tao/*.png", {
  eager: true,
  import: "default",
});
const MA_ANH_THEO_BIEN_SO: Record<string, string> = {
  "30A-512.08": "sx-01",
  "29A-803.61": "sx-02",
  "29B-117.45": "sx-03",
  "29C-640.22": "sx-04",
  "51A-277.90": "sx-05",
  "30G-061.37": "sx-06",
  "15B-332.18": "sx-07",
  "34C-128.05": "sx-08",
  "30K-455.21": "sx-09",
  "29C-903.14": "sx-10",
  "43B-006.57": "sx-11",
  "36C-221.84": "sx-12",
  "29B-640.93": "sx-13",
  "30H-118.26": "sx-14",
  "29C-777.03": "sx-15",
  "51D-305.66": "sx-16",
};
const anhXe = (bienSo: string) => {
  const ma = MA_ANH_THEO_BIEN_SO[bienSo];
  return ma ? ANH_XE[`../../assets/tro-choi/soi-xe-cai-tao/${ma}.png`] : undefined;
};

const kt = (k: { dai_mm: number; rong_mm: number; cao_mm: number }) =>
  `${[k.dai_mm, k.rong_mm, k.cao_mm].map((n) => n.toLocaleString("vi-VN")).join(" × ")} mm`;

export function SoiXeCaiTao({
  de,
  traLoi,
  datTraLoi,
  chiTiet,
  daCham,
  gui,
}: {
  de: DeSoiXe;
  traLoi: TraLoiSoiXeWeb;
  datTraLoi: (t: TraLoiSoiXeWeb) => void;
  chiTiet?: unknown;
  daCham: boolean;
  gui?: (t: TraLoiSoiXeWeb) => void;
}) {
  const [chon, datChon] = useState<number | null>(null);
  const [phong, datPhong] = useState(false);
  const [thuoc, datThuoc] = useState<{ goc: GocNhin; dau: [DiemThuoc, DiemThuoc] } | null>(null);
  const [daDong, datDaDong] = useState<DauSoiXe | null>(null);
  const [nhac, datNhac] = useState("");
  const khungRef = { nghieng: useRef<HTMLDivElement>(null), sau: useRef<HTMLDivElement>(null) };
  const ct = daCham ? (chiTiet as ChiTietSoiXe | undefined) : undefined;
  const khoa = daCham || daDong !== null;
  const ds = traLoi.khung;

  /** Số đơn vị hình trên một px của hình đang hiện. */
  const tyLe = (g: GocNhin) => de.hinh[g].rong / (khungRef[g].current?.clientWidth || de.hinh[g].rong);
  const kep = (g: GocNhin, h: Hop): Hop => {
    const { rong, cao } = de.hinh[g];
    const x0 = Math.max(0, Math.min(rong - 2, Math.round(h[0])));
    const y0 = Math.max(0, Math.min(cao - 2, Math.round(h[1])));
    return [
      x0,
      y0,
      Math.max(x0 + 2, Math.min(rong, Math.round(h[2]))),
      Math.max(y0 + 2, Math.min(cao, Math.round(h[3]))),
    ];
  };
  const them = (g: GocNhin, h: Hop) => {
    if (khoa) return;
    if (ds.filter((k) => k.goc === g).length >= KHUNG_TOI_DA_MOI_HINH) {
      datNhac(`Mỗi hình tối đa ${KHUNG_TOI_DA_MOI_HINH} khung. Xóa bớt khung trước.`);
      return;
    }
    datNhac("");
    datTraLoi({ ...traLoi, khung: [...ds, { goc: g, hop: kep(g, h), dong: null }] });
    datChon(ds.length);
  };
  const sua = (i: number, k: Partial<KhungKhoanh>) =>
    datTraLoi({ ...traLoi, khung: ds.map((x, j) => (j === i ? { ...x, ...k } : x)) });
  const doi = (dx: number, dy: number, dw: number, dh: number) => {
    if (chon === null || khoa) return;
    const [a, b, c, d] = ds[chon]!.hop;
    sua(chon, { hop: kep(ds[chon]!.goc, [a + dx, b + dy, c + dx + dw, d + dy + dh]) });
  };
  const xoa = (i: number) => {
    datTraLoi({ ...traLoi, khung: ds.filter((_, j) => j !== i) });
    datChon(null);
  };
  const chamDong = (ma: string) => {
    if (khoa) return;
    if (chon === null) {
      datNhac("Chọn một khung trước, rồi chạm dòng giấy tương ứng.");
      return;
    }
    sua(chon, { dong: ds[chon]!.dong === ma ? null : (ma as DongThongSo) });
  };
  const dong = (d: DauSoiXe) => {
    if (khoa) return;
    const t = { ...traLoi, dau: d };
    datDaDong(d);
    datTraLoi(t);
    phatAm("tich");
    setTimeout(() => gui?.(t), dangGiamChuyenDong() ? 0 : 500);
  };

  // Kết quả: chỉ số khung đã khớp chỗ sai.
  const khop = new Set(ct?.cho_sai.map((c) => c.khung).filter((i): i is number => i !== null));
  const mauKhung = (i: number) =>
    ct
      ? khop.has(i)
        ? "var(--ok)"
        : ct.khung_trung.includes(i)
          ? "var(--ink-2)"
          : "var(--danger)"
      : i === chon
        ? "var(--primary)"
        : "var(--warn)";

  const ts = de.giay.thong_so;
  const giaTri: Record<DongThongSo, string> = {
    kich_thuoc_bao: kt(ts.kich_thuoc_bao),
    kich_thuoc_thung: ts.kich_thuoc_thung ? kt(ts.kich_thuoc_thung) : "",
    co_lop: ts.co_lop,
    so_cho: `${ts.so_cho} người`,
    mau_son: ts.mau_son,
    den: ts.den,
  };
  const dau = daDong ?? (daCham ? traLoi.dau : null);
  const anh = anhXe(de.bien_so);

  return (
    <div className="space-y-3">
      <div className="g-a gt-vao relative">
        <p className="flex flex-wrap justify-between gap-x-3 text-sm text-ink-2">
          <span>
            {de.ten_loai_xe} · <strong className="g-so text-ink">{de.bien_so}</strong>
          </span>
          <span>Kiểm tra {ngayVn(de.ngay_kiem_tra)}</span>
        </p>
        {anh ? (
          <img
            src={anh}
            alt={`Xe ${de.ten_loai_xe} biển ${de.bien_so} đang đứng trước mặt bạn`}
            width={170}
            height={100}
            className="mx-auto mt-2 block h-auto w-44 max-w-full"
            draggable={false}
          />
        ) : null}
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            aria-pressed={phong}
            onClick={() => datPhong(!phong)}
            className="min-h-12 flex-1 rounded-xl border text-[15px]"
            style={{ borderColor: "var(--line-strong)" }}
          >
            {phong ? "Thu nhỏ" : "Phóng to 2×"}
          </button>
        </div>
        {dau ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <DauMoc
              chon={dau}
              nhan={TEN_DAU_SOI_XE[dau]}
              mau={dau === "dat" ? "ok" : "danger"}
              hoatAnh={!daCham}
            />
          </div>
        ) : null}
      </div>

      {(["nghieng", "sau"] as const).map((g) => {
        const h = de.hinh[g];
        const nen = khungRef[g];
        return (
          <section key={g} aria-label={`Hình ${TEN_GOC[g]}`} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-semibold">Hình {TEN_GOC[g]}</h3>
              {!khoa ? (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      them(g, [h.rong / 2 - 20, h.cao / 2 - 15, h.rong / 2 + 20, h.cao / 2 + 15])
                    }
                    className="min-h-12 rounded-xl border px-2 text-sm"
                    style={{ borderColor: "var(--line-strong)" }}
                  >
                    Thêm khung
                  </button>
                  <button
                    type="button"
                    aria-pressed={thuoc?.goc === g}
                    onClick={() =>
                      datThuoc(
                        thuoc?.goc === g
                          ? null
                          : {
                              goc: g,
                              dau: [
                                [h.rong * 0.3, h.cao * 0.5],
                                [h.rong * 0.7, h.cao * 0.5],
                              ],
                            },
                      )
                    }
                    className="min-h-12 rounded-xl border px-2 text-sm"
                    style={{ borderColor: "var(--line-strong)" }}
                  >
                    Thước đo
                  </button>
                </div>
              ) : null}
            </div>
            <div
              className="overflow-auto rounded-2xl border bg-surface"
              style={{ borderColor: "var(--line)" }}
            >
              <div ref={nen} className="relative" style={{ width: phong ? "200%" : "100%" }}>
                <svg
                  viewBox={`0 0 ${h.rong} ${h.cao}`}
                  className="block h-auto w-full"
                  role="img"
                  aria-label={`Xe ${TEN_GOC[g]}, ${ds.filter((k) => k.goc === g).length} khung đã khoanh`}
                >
                  {h.net.map((n, i) => (
                    <path
                      // biome-ignore lint/suspicious/noArrayIndexKey: nét cố định theo đề
                      key={i}
                      d={n.d}
                      fill={n.kieu === "son" ? de.mau_ve : MAU_NET[n.kieu]}
                      stroke="var(--ink)"
                      strokeWidth={0.8}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                  {ct?.cho_sai.flatMap((c) =>
                    c.vung
                      .filter((v) => v.goc === g)
                      .map((v) => (
                        <rect
                          key={`${c.ma}-${v.hop.join()}`}
                          x={v.hop[0]}
                          y={v.hop[1]}
                          width={v.hop[2] - v.hop[0]}
                          height={v.hop[3] - v.hop[1]}
                          fill="var(--ok-soft)"
                          fillOpacity={0.35}
                          stroke="var(--ok)"
                          strokeDasharray="4 3"
                          vectorEffect="non-scaling-stroke"
                        />
                      )),
                  )}
                  {ds.map((k, i) =>
                    k.goc === g ? (
                      // biome-ignore lint/suspicious/noArrayIndexKey: khung đánh số theo thứ tự khoanh
                      <g key={i}>
                        <rect
                          x={k.hop[0]}
                          y={k.hop[1]}
                          width={k.hop[2] - k.hop[0]}
                          height={k.hop[3] - k.hop[1]}
                          fill="none"
                          stroke={mauKhung(i)}
                          strokeWidth={i === chon ? 3 : 2}
                          vectorEffect="non-scaling-stroke"
                        />
                        <text
                          x={k.hop[0] + 2}
                          y={k.hop[1] + 11}
                          fontSize={11}
                          fontWeight={700}
                          fill={mauKhung(i)}
                        >
                          {i + 1}
                        </text>
                      </g>
                    ) : null,
                  )}
                  {thuoc?.goc === g ? (
                    <ThuocDo
                      dau={thuoc.dau}
                      datDau={(d) => datThuoc({ goc: g, dau: d })}
                      rong={h.rong}
                      cao={h.cao}
                      tyLeMm={de.ty_le_mm}
                      banKinh={24 * tyLe(g)}
                    />
                  ) : null}
                </svg>
                <KhoanhVung
                  bat={!khoa && thuoc?.goc !== g}
                  onKhoanh={(p) => {
                    const s = tyLe(g);
                    them(g, [p[0] * s, p[1] * s, p[2] * s, p[3] * s]);
                  }}
                  onCham={(x, y) => {
                    const s = tyLe(g);
                    them(g, [x * s - 20, y * s - 15, x * s + 20, y * s + 15]);
                  }}
                  nhan={`Hình ${TEN_GOC[g]}: kéo khung hoặc vẽ vòng quanh chỗ khác giấy; chạm nhẹ để đặt khung nhỏ`}
                />
              </div>
            </div>
          </section>
        );
      })}

      {ds.length ? (
        <ul className="grid gap-1.5" aria-label="Các khung đã khoanh">
          {ds.map((k, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: khung đánh số theo thứ tự khoanh
            <li key={i} className="flex gap-1">
              <button
                type="button"
                aria-pressed={i === chon}
                disabled={khoa}
                onClick={() => datChon(i === chon ? null : i)}
                className="min-h-12 flex-1 rounded-xl border-2 px-3 text-left text-sm"
                style={{ borderColor: mauKhung(i) }}
              >
                Khung {i + 1} · {TEN_GOC[k.goc]} · {k.dong ? TEN_DONG_THONG_SO[k.dong] : "chưa nối dòng giấy"}
              </button>
              {!khoa ? (
                <button
                  type="button"
                  onClick={() => xoa(i)}
                  aria-label={`Xóa khung ${i + 1}`}
                  className="min-h-12 min-w-12 rounded-xl border text-lg"
                  style={{ borderColor: "var(--line)" }}
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {chon !== null && !khoa ? (
        <fieldset
          className="grid grid-cols-4 gap-1"
          aria-label={`Chỉnh khung ${chon + 1}`}
          onKeyDown={(e) => {
            const m: Record<string, [number, number]> = {
              ArrowLeft: [-1, 0],
              ArrowRight: [1, 0],
              ArrowUp: [0, -1],
              ArrowDown: [0, 1],
            };
            const v = m[e.key];
            if (!v) return;
            e.preventDefault();
            if (e.shiftKey) doi(0, 0, v[0] * BUOC, v[1] * BUOC);
            else doi(v[0] * BUOC, v[1] * BUOC, 0, 0);
          }}
        >
          <legend className="col-span-4 text-sm text-ink-2">
            Khung {chon + 1}: dời, đổi cỡ (hoặc phím mũi tên; giữ Shift để đổi cỡ)
          </legend>
          {(
            [
              ["◀", "Dời trái", -BUOC, 0, 0, 0],
              ["▶", "Dời phải", BUOC, 0, 0, 0],
              ["▲", "Dời lên", 0, -BUOC, 0, 0],
              ["▼", "Dời xuống", 0, BUOC, 0, 0],
              ["↔+", "Rộng thêm", 0, 0, BUOC, 0],
              ["↔−", "Hẹp lại", 0, 0, -BUOC, 0],
              ["↕+", "Cao thêm", 0, 0, 0, BUOC],
              ["↕−", "Thấp lại", 0, 0, 0, -BUOC],
            ] as const
          ).map(([ky, ten, dx, dy, dw, dh]) => (
            <button
              key={ten}
              type="button"
              aria-label={ten}
              onClick={() => doi(dx, dy, dw, dh)}
              className="min-h-12 rounded-xl border text-base"
              style={{ borderColor: "var(--line-strong)" }}
            >
              {ky}
            </button>
          ))}
        </fieldset>
      ) : null}

      <TheGiayToChung
        tieuDe={`Giấy chứng nhận kiểm định ${de.giay.so}`}
        mau="vang"
        dong={[
          { nhan: "Biển số", giaTri: de.giay.bien_so },
          { nhan: "Có giá trị đến", giaTri: ngayVn(de.giay.co_gia_tri_den) },
          ...DONG_THONG_SO.filter((d) => giaTri[d]).map((d) => ({
            ma: d,
            nhan: TEN_DONG_THONG_SO[d],
            giaTri: giaTri[d],
          })),
        ]}
        dangChon={new Set(chon !== null && ds[chon]?.dong ? [ds[chon]!.dong!] : [])}
        khoa={khoa}
        onCham={chamDong}
        nhanCham="Chạm để nối với khung đang chọn"
        kieuChon="ghim"
      />
      {nhac ? (
        <p role="status" className="text-sm text-warn">
          {nhac}
        </p>
      ) : null}

      {!khoa ? (
        <NutDongDau<DauSoiXe>
          onChon={dong}
          khoa={khoa}
          luaChon={[
            { ma: "dat", nhan: TEN_DAU_SOI_XE.dat, mau: "ok" },
            { ma: "khong_dat", nhan: TEN_DAU_SOI_XE.khong_dat, mau: "danger" },
          ]}
          nhac="Khoanh chỗ khác giấy, nối từng khung với dòng giấy, rồi đóng dấu. Đóng dấu là nộp."
        />
      ) : null}
    </div>
  );
}

/** Phần "Xem chi tiết" của một xe (GĐ17c): dấu đúng, điểm, các chỗ khác giấy, biên bản. */
export function ChiTietRiengSoiXe({ chiTiet }: { chiTiet: unknown }) {
  const ct = chiTiet as ChiTietSoiXe;
  return (
    <div className="space-y-3">
      <p className="text-[15px]">
        Đúng ra: <strong>{TEN_DAU_SOI_XE[ct.dau_dung]}</strong>. Khoanh và nối {ct.diem_khoanh}/
        {ct.diem_khoanh_toi_da} · dấu {ct.diem_dau}/5
        {ct.khung_nham.length ? ` · ${ct.khung_nham.length} khung nhầm (−2 mỗi khung)` : ""}
        {ct.khung_qua_lon.length ? `, trong đó ${ct.khung_qua_lon.length} khung quá lớn (trên 25% hình)` : ""}
        .
      </p>
      {ct.cho_sai.length ? (
        <section className="g-the rounded-2xl p-3" aria-label="Các chỗ khác giấy">
          <h3 className="text-base font-semibold">Các chỗ khác giấy (vùng xanh trên hình)</h3>
          <ul className="mt-2 grid gap-2 text-sm">
            {ct.cho_sai.map((c) => (
              <li
                key={c.ma}
                className="border-l-4 pl-2"
                style={{ borderColor: c.khung !== null ? "var(--ok)" : "var(--warn)" }}
              >
                <strong>{c.ten}</strong> ({TEN_DONG_THONG_SO[c.dong]}){" "}
                {c.khung === null
                  ? "· bỏ sót"
                  : c.noi_dung
                    ? `· khung ${c.khung + 1}, nối đúng`
                    : `· khung ${c.khung + 1}, nối sai dòng`}
                <span className="block">{c.mo_ta}</span>
                <span className="block text-ink-2">{c.giai_thich}</span>
                <span className="block text-ink-2">Căn cứ: {nhanVienDan(c.can_cu)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {ct.dau_dung === "khong_dat" ? <BienBan dong={ct.bien_ban} /> : null}
    </div>
  );
}
