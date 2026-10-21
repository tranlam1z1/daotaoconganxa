/**
 * Một xe trong trò "Trạm cân tải trọng" (docs/PLAN.md GĐ-T12, docs/GAME_DESIGN.md §5.12).
 *
 * Xe lên bàn cân (hình nhìn ngang, đánh số trục). Các thẻ: phiếu cân, giấy chứng nhận kiểm định, giấy phép
 * lưu hành (màn 4 trở đi, nếu có), bảng tải trọng tại trạm (màn 3 trở đi). Chạm một số trên phiếu cân và
 * một số giới hạn (thứ tự nào cũng được) để ghim cặp; mỗi cặp hiện hiệu số kg, không hiện phần trăm (câu
 * D18). Cặp ghim sau cùng là căn cứ, chạm cặp khác để đổi. Kéo thanh trượt ước phần trăm vượt, rồi đóng
 * một trong ba dấu (M2); chưa ghim cặp nào thì các dấu khóa.
 *
 * Trang chỉ hiển thị và trừ hai số cho người chơi xem; đúng sai và phần trăm do máy chủ tính.
 */
import { useState } from "react";

import {
  type CapSo,
  type ChiTietTramCan,
  type DauTramCan,
  type DeTramCan,
  type NhomTruc,
  ngayVn,
  soTrucCuaNhom,
  TEN_DAU_TRAM_CAN,
  tenNhomTruc,
  UOC_TOI_DA,
} from "../../lib/tram-can";
import { BienBan } from "./chung/BienBan";
import { type DongTheChung, type KetQuaChiTiet, TheGiayToChung } from "./chung/GiayTo";
import { DauMoc, type DauTuyChon, type MauDau, NutDongDau } from "./chung/tuong-tac/DongDau";
import { phatAm } from "./hieu-ung/am-thanh";
import { dangGiamChuyenDong } from "./hieu-ung/cai-dat";

export interface TraLoiTramCanWeb {
  dau: DauTramCan | null;
  cap: CapSo | null;
  uoc: number;
}

export const TRA_LOI_RONG_TRAM_CAN: TraLoiTramCanWeb = { dau: null, cap: null, uoc: 0 };

const TRE_GUI_MS = 500;
const MAU_DAU: Record<DauTramCan, MauDau> = { cho_di: "ok", ha_tai: "warn", lap_bien_ban: "danger" };
const kg = (n: number) => `${n.toLocaleString("vi-VN")} kg`;
const hieu = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${kg(Math.abs(n))}`;

const LOP = "#16191d";
const BANH_Y = 84;

/**
 * Hình xe nhìn ngang trên bàn cân, đầu xe bên trái. Ca-bin có kính lái, cửa, tài xế ngồi sau kính; xe tải
 * chở thùng mui bạt, xe đầu kéo kéo sơ mi rơ moóc chở container (có chân chống). Bánh theo nhóm trục; số
 * nhóm trục ghi trong ô tròn dưới bàn cân, có ngoặc ôm các trục của cùng một cụm.
 */
function HinhXe({ nhom, dauKeo }: { nhom: readonly NhomTruc[]; dauKeo: boolean }) {
  const truc: Array<{ x: number; so: number }> = [];
  let x = 40;
  nhom.forEach((n, i) => {
    for (let k = 0; k < soTrucCuaNhom(n); k++) {
      truc.push({ x, so: i + 1 });
      x += 24;
    }
    x += (dauKeo ? [38, 96] : [66])[i] ?? 16;
  });
  const cuoi = truc.at(-1)!.x;
  const dai = Math.max(220, cuoi + 34);
  // Ca-bin chỉ trùm trục đầu tiên; xe hai trục trước thì trục thứ hai nằm sau ca-bin.
  const cb = truc[0]!.x + 26;
  const nhom2 = truc.filter((t) => t.so === 2);
  const romooc = dauKeo && nhom2.length ? nhom2[0]!.x - 28 : cb + 6;
  const nhomSo = [...new Set(truc.map((t) => t.so))];
  return (
    <svg
      viewBox={`0 0 ${dai} 124`}
      className="h-auto w-full"
      role="img"
      aria-label="Xe trên bàn cân, đánh số nhóm trục"
    >
      {/* Bàn cân và hai dốc lên xuống. */}
      <path d={`M0 101 L8 95 H${dai - 8} L${dai} 101 Z`} fill="var(--line-strong)" />
      <line x1={8} y1={95.5} x2={dai - 8} y2={95.5} stroke="var(--ink-2)" strokeWidth={1} opacity={0.5} />

      {/* Khung gầm. */}
      <rect
        x={12}
        y={70}
        width={(dauKeo ? (nhom2.at(-1)?.x ?? cb) + 20 : dai - 6) - 12}
        height={6}
        fill="#343a40"
      />

      {dauKeo ? (
        <>
          {/* Sơ mi rơ moóc: container có sóng, khung dưới, chân chống, mâm kéo. */}
          <rect x={romooc} y={64} width={dai - 4 - romooc} height={6} fill="#343a40" />
          <rect x={romooc} y={10} width={dai - 4 - romooc} height={54} rx={2} fill="#d9480f" />
          {Array.from({ length: Math.floor((dai - 10 - romooc) / 6) }, (_, k) => (
            <line
              // biome-ignore lint/suspicious/noArrayIndexKey: vạch sóng cố định
              key={k}
              x1={romooc + 6 + k * 6}
              y1={13}
              x2={romooc + 6 + k * 6}
              y2={61}
              stroke="#000"
              strokeWidth={1}
              opacity={0.18}
            />
          ))}
          {nhom2.length ? (
            <>
              <rect
                x={nhom2[0]!.x - 6}
                y={62}
                width={nhom2.at(-1)!.x - nhom2[0]!.x + 12}
                height={4}
                fill="#868e96"
              />
              <line
                x1={nhom2.at(-1)!.x + 46}
                y1={70}
                x2={nhom2.at(-1)!.x + 46}
                y2={91}
                stroke="#495057"
                strokeWidth={3}
              />
              <rect x={nhom2.at(-1)!.x + 41} y={90} width={10} height={4} fill="#495057" />
            </>
          ) : null}
        </>
      ) : (
        <>
          {/* Ống xả, thùng mui bạt: bạt phía trên, thành thùng có trụ phía dưới. */}
          <rect x={cb + 1} y={12} width={4} height={58} rx={1} fill="#868e96" />
          <path
            d={`M${romooc} 46 V20 Q${romooc} 14 ${romooc + 6} 14 H${dai - 10} Q${dai - 4} 14 ${dai - 4} 20 V46 Z`}
            fill="#5f7f4f"
          />
          {Array.from({ length: Math.floor((dai - 10 - romooc) / 28) }, (_, k) => (
            <line
              // biome-ignore lint/suspicious/noArrayIndexKey: dây chằng bạt cố định
              key={k}
              x1={romooc + 18 + k * 28}
              y1={16}
              x2={romooc + 18 + k * 28}
              y2={46}
              stroke="#2f4a27"
              strokeWidth={1.5}
              opacity={0.6}
            />
          ))}
          <rect x={romooc} y={46} width={dai - 4 - romooc} height={22} fill="#9c7a4b" />
          {Array.from({ length: Math.floor((dai - 4 - romooc) / 24) + 1 }, (_, k) => (
            <rect
              // biome-ignore lint/suspicious/noArrayIndexKey: trụ thành thùng cố định
              key={k}
              x={Math.min(romooc + k * 24, dai - 8)}
              y={46}
              width={4}
              height={22}
              fill="#6e5432"
            />
          ))}
        </>
      )}

      {/* Ca-bin: mặt trước, kính lái nghiêng, cửa, cửa sổ có tài xế, đèn pha, cản, gương, bậc lên xuống. */}
      <path d={`M6 74 V42 Q6 36 9 31 L17 20 Q19 18 23 18 H${cb} V74 Z`} fill="var(--primary)" />
      <path d="M8.5 41 L18.5 22.5 H24 V41 Z" fill="#25313d" />
      <rect x={26} y={23} width={cb - 32} height={19} rx={2} fill="#9fb8cc" />
      <circle cx={34} cy={31} r={4.6} fill="#e0a87a" />
      <path d="M29.4 30 Q30 25.6 34 25.6 Q38 25.6 38.6 30 Z" fill="#2b1d14" />
      <path d="M27 42 Q27 36.5 34 36 Q41 36.5 41 42 Z" fill="#1f6f8b" />
      <rect
        x={25}
        y={21}
        width={cb - 29}
        height={51}
        rx={2}
        fill="none"
        stroke="#000"
        strokeWidth={1}
        opacity={0.3}
      />
      <rect x={cb - 12} y={47} width={7} height={2.5} rx={1} fill="#000" opacity={0.45} />
      <rect x={6} y={56} width={5} height={7} rx={1} fill="#fff3bf" stroke="#000" strokeWidth={0.5} />
      <rect x={3} y={66} width={16} height={8} rx={2} fill="#2b2f33" />
      <path d="M14 24 L4 22" stroke="#343a40" strokeWidth={1.5} />
      <rect x={1.5} y={21} width={4} height={11} rx={1.5} fill="#343a40" />
      <rect x={26} y={72} width={10} height={3} fill="#343a40" />

      {/* Chắn bùn và bánh: lốp, vành, may-ơ. */}
      {truc.map((t, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: vị trí trục cố định trong một xe
        <g key={i}>
          <path d={`M${t.x - 14} ${BANH_Y} A14 14 0 0 1 ${t.x + 14} ${BANH_Y}`} fill="#212529" />
          <circle cx={t.x} cy={BANH_Y} r={11} fill={LOP} />
          <circle cx={t.x} cy={BANH_Y} r={6} fill="#adb5bd" />
          <circle cx={t.x} cy={BANH_Y} r={2.2} fill="#495057" />
        </g>
      ))}

      {/* Số nhóm trục dưới bàn cân. */}
      {nhomSo.map((so) => {
        const cac = truc.filter((t) => t.so === so);
        const dau = cac[0]!.x;
        const cuoiNhom = cac.at(-1)!.x;
        const giua = (dau + cuoiNhom) / 2;
        return (
          <g key={so}>
            {cac.length > 1 ? (
              <path
                d={`M${dau - 6} 103 V107 H${cuoiNhom + 6} V103`}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={1.5}
              />
            ) : null}
            <circle cx={giua} cy={114} r={8.5} fill="var(--primary)" />
            <text x={giua} y={118.5} fontSize={12} fontWeight={700} textAnchor="middle" fill="var(--surface)">
              {so}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function TramCan({
  de,
  traLoi,
  datTraLoi,
  chiTiet,
  daCham,
  gui,
}: {
  de: DeTramCan;
  traLoi: TraLoiTramCanWeb;
  datTraLoi: (t: TraLoiTramCanWeb) => void;
  chiTiet?: unknown;
  daCham: boolean;
  gui?: (t: TraLoiTramCanWeb) => void;
}) {
  const [cho, datCho] = useState<string | null>(null);
  const [ghim, datGhim] = useState<CapSo[]>(traLoi.cap ? [traLoi.cap] : []);
  const [daDong, datDaDong] = useState<DauTramCan | null>(null);
  const ct = daCham ? (chiTiet as ChiTietTramCan | undefined) : undefined;
  const khoa = daCham || daDong !== null;
  const p = de.phieu_can;

  // Số và tên của mọi ô chạm được.
  const so = new Map<string, { ten: string; kg: number }>();
  so.set("phieu.tong", { ten: "Tổng trọng lượng", kg: p.tong_kg });
  if (p.hang_kg !== null) so.set("phieu.hang", { ten: "Khối lượng hàng", kg: p.hang_kg });
  for (const [i, v] of p.truc_kg.entries())
    so.set(`phieu.truc.${i}`, { ten: tenNhomTruc(de.nhom_truc[i]!, i), kg: v });
  const k = de.giay_kiem_dinh;
  so.set("kd.toan_bo", { ten: "Khối lượng toàn bộ cho phép", kg: k.toan_bo_cho_phep_kg });
  if (p.hang_kg !== null)
    so.set("kd.hang", { ten: "Khối lượng hàng chuyên chở cho phép", kg: k.hang_cho_phep_kg });
  const gp = de.giay_phep_luu_hanh;
  if (gp) {
    so.set("gp.tong", { ten: "Tổng trọng lượng được phép (giấy phép)", kg: gp.tong_cho_phep_kg });
    so.set("gp.truc_don", { ten: "Trục đơn được phép (giấy phép)", kg: gp.truc_don_cho_phep_kg });
    so.set("gp.cum_truc", { ten: "Cụm trục được phép (giấy phép)", kg: gp.cum_truc_cho_phep_kg });
  }
  for (const b of de.bang) so.set(b.ma, { ten: b.ten, kg: b.gioi_han_kg });
  const laPhieu = (m: string) => m.startsWith("phieu.");
  const tenCap = (c: CapSo) =>
    `${so.get(c.phieu)?.ten ?? c.phieu} ↔ ${so.get(c.gioi_han)?.ten ?? c.gioi_han}`;
  const hieuCap = (c: CapSo) => (so.get(c.phieu)?.kg ?? 0) - (so.get(c.gioi_han)?.kg ?? 0);

  const datCanCu = (c: CapSo | null) => datTraLoi({ ...traLoi, cap: c });

  const cham = (m: string) => {
    if (khoa) return;
    if (!cho || cho === m || laPhieu(cho) === laPhieu(m)) {
      datCho(cho === m ? null : m);
      return;
    }
    const c: CapSo = laPhieu(m) ? { phieu: m, gioi_han: cho } : { phieu: cho, gioi_han: m };
    datCho(null);
    datGhim([...ghim.filter((g) => g.phieu !== c.phieu || g.gioi_han !== c.gioi_han), c]);
    datCanCu(c);
  };
  const boGhim = (c: CapSo) => {
    const con = ghim.filter((g) => g !== c);
    datGhim(con);
    if (traLoi.cap === c || (traLoi.cap?.phieu === c.phieu && traLoi.cap?.gioi_han === c.gioi_han))
      datCanCu(con.at(-1) ?? null);
  };

  const dong = (d: DauTramCan) => {
    if (khoa || !traLoi.cap) return;
    const t: TraLoiTramCanWeb = { ...traLoi, dau: d };
    datDaDong(d);
    datTraLoi(t);
    phatAm("tich");
    setTimeout(() => gui?.(t), dangGiamChuyenDong() ? 0 : TRE_GUI_MS);
  };

  // Sau khi chấm: cặp quyết định tô như "chỗ cần thấy", cặp người chơi chọn sai tô vàng.
  const ketQua = new Map<string, KetQuaChiTiet>();
  if (ct) {
    if (traLoi.cap && ct.diem_cap === 0)
      for (const m of [traLoi.cap.phieu, traLoi.cap.gioi_han]) ketQua.set(m, "nham");
    for (const m of [ct.cap_quyet.phieu, ct.cap_quyet.gioi_han]) ketQua.set(m, "loi");
  }
  const dangChon = new Set<string>([
    ...(cho ? [cho] : []),
    ...(traLoi.cap ? [traLoi.cap.phieu, traLoi.cap.gioi_han] : []),
  ]);
  const dongThe = (ds: Array<[string, string] | DongTheChung>): DongTheChung[] =>
    ds.map((d) =>
      Array.isArray(d) ? { ma: d[0], nhan: so.get(d[0])!.ten, giaTri: kg(so.get(d[0])!.kg) } : d,
    );
  const theChung = {
    dangChon,
    ketQua,
    khoa,
    onCham: cham,
    nhanCham: "Chạm để ghim",
    kieuChon: "ghim" as const,
  };
  const dau = daDong ?? (daCham ? traLoi.dau : null);
  const luaChon: DauTuyChon<DauTramCan>[] = (["cho_di", "ha_tai", "lap_bien_ban"] as const).map((d) => ({
    ma: d,
    nhan: TEN_DAU_TRAM_CAN[d],
    mau: MAU_DAU[d],
    khoa: !traLoi.cap,
  }));

  return (
    <div className="space-y-3">
      <div className="g-a gt-vao relative">
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm text-ink-2">
          <span>
            {de.ten_loai_xe} · <strong className="g-so text-ink">{de.bien_so}</strong>
          </span>
          <span>Đang đi: {de.tuyen_dang_di}</span>
        </p>
        <HinhXe nhom={de.nhom_truc} dauKeo={de.loai_xe === "dau_keo_so_mi"} />
        {dau ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <DauMoc chon={dau} nhan={TEN_DAU_TRAM_CAN[dau]} mau={MAU_DAU[dau]} hoatAnh={!daCham} />
          </div>
        ) : null}
      </div>

      <TheGiayToChung
        tieuDe={`Phiếu cân ${p.so} · ${ngayVn(p.ngay_can)}`}
        mau="xanh"
        dong={dongThe([
          ["phieu.tong", ""],
          ...(p.hang_kg !== null
            ? [
                ["phieu.hang", ""] as [string, string],
                { nhan: "Cách tính khối lượng hàng", giaTri: "tổng trừ tự trọng trên giấy kiểm định" },
              ]
            : []),
          ...p.truc_kg.map((_, i) => [`phieu.truc.${i}`, ""] as [string, string]),
        ])}
        {...theChung}
      />
      <TheGiayToChung
        tieuDe={`Giấy chứng nhận kiểm định ${k.so}`}
        mau="vang"
        dong={dongThe([
          { nhan: "Biển số", giaTri: k.bien_so },
          { nhan: "Tự trọng", giaTri: kg(k.tu_trong_kg) },
          ...(p.hang_kg !== null ? [["kd.hang", ""] as [string, string]] : []),
          ["kd.toan_bo", ""],
          { nhan: "Có giá trị đến", giaTri: ngayVn(k.co_gia_tri_den) },
        ])}
        {...theChung}
      />
      {gp ? (
        <TheGiayToChung
          tieuDe={`Giấy phép lưu hành ${gp.so}`}
          mau="do"
          dong={dongThe([
            { nhan: "Biển số", giaTri: gp.bien_so },
            { nhan: "Tuyến", giaTri: gp.tuyen },
            { nhan: "Thời hạn", giaTri: `${ngayVn(gp.tu_ngay)} – ${ngayVn(gp.den_ngay)}` },
            ["gp.tong", ""],
            ["gp.truc_don", ""],
            ["gp.cum_truc", ""],
          ])}
          {...theChung}
        />
      ) : null}
      {de.bang.length ? (
        <TheGiayToChung
          tieuDe="Bảng tải trọng cho phép tại trạm"
          mau="xanh"
          dong={de.bang.map((b) => ({ ma: b.ma, nhan: b.ten, giaTri: kg(b.gioi_han_kg) }))}
          {...theChung}
        />
      ) : null}

      {!daCham ? (
        <>
          <div aria-live="polite" className="text-sm">
            {cho ? (
              <p>
                Đã chọn <strong>{so.get(cho)?.ten}</strong>. Chạm{" "}
                {laPhieu(cho) ? "một số giới hạn" : "một số trên phiếu cân"} để ghim cặp.
              </p>
            ) : null}
            {ghim.length ? (
              <fieldset className="mt-1 grid gap-1.5">
                <legend className="sr-only">Cặp số làm căn cứ</legend>
                {ghim.map((c) => {
                  const la = traLoi.cap?.phieu === c.phieu && traLoi.cap?.gioi_han === c.gioi_han;
                  return (
                    <div key={`${c.phieu}|${c.gioi_han}`} className="flex items-stretch gap-1">
                      <button
                        type="button"
                        aria-pressed={la}
                        disabled={khoa}
                        onClick={() => datCanCu(c)}
                        className="min-h-12 flex-1 rounded-xl border-2 px-3 py-1 text-left text-sm"
                        style={{
                          borderColor: la ? "var(--primary)" : "var(--line)",
                          background: la ? "var(--primary-soft)" : "var(--surface)",
                        }}
                      >
                        <span className="block">{tenCap(c)}</span>
                        <span className="g-so font-semibold">Hiệu số: {hieu(hieuCap(c))}</span>
                        {la ? <span className="ml-2 text-xs text-primary">căn cứ</span> : null}
                      </button>
                      <button
                        type="button"
                        disabled={khoa}
                        onClick={() => boGhim(c)}
                        aria-label={`Bỏ ghim: ${tenCap(c)}`}
                        className="min-h-12 min-w-12 rounded-xl border text-lg"
                        style={{ borderColor: "var(--line)" }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </fieldset>
            ) : (
              <p className="text-ink-2">
                Chạm một số trên phiếu cân và một số giới hạn để ghim cặp số cần so.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="uoc-phan-tram" className="flex items-baseline justify-between text-[15px]">
              <span>Ước phần trăm vượt</span>
              <output htmlFor="uoc-phan-tram" className="g-so text-xl font-bold">
                {traLoi.uoc}%
              </output>
            </label>
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                disabled={khoa || traLoi.uoc <= 0}
                onClick={() => datTraLoi({ ...traLoi, uoc: traLoi.uoc - 1 })}
                aria-label="Giảm 1%"
                className="min-h-12 min-w-12 rounded-xl border text-xl"
                style={{ borderColor: "var(--line-strong)" }}
              >
                −
              </button>
              <input
                id="uoc-phan-tram"
                type="range"
                min={0}
                max={UOC_TOI_DA}
                step={1}
                value={traLoi.uoc}
                disabled={khoa}
                aria-valuetext={`${traLoi.uoc}%`}
                onChange={(e) => datTraLoi({ ...traLoi, uoc: Number(e.currentTarget.value) })}
                className="h-12 min-w-0 flex-1"
              />
              <button
                type="button"
                disabled={khoa || traLoi.uoc >= UOC_TOI_DA}
                onClick={() => datTraLoi({ ...traLoi, uoc: traLoi.uoc + 1 })}
                aria-label="Tăng 1%"
                className="min-h-12 min-w-12 rounded-xl border text-xl"
                style={{ borderColor: "var(--line-strong)" }}
              >
                +
              </button>
            </div>
            <p className="mt-1 text-sm text-ink-2">Không vượt thì để 0%.</p>
          </div>

          <NutDongDau<DauTramCan>
            onChon={dong}
            khoa={khoa}
            luaChon={luaChon}
            nhac={
              traLoi.cap
                ? `Căn cứ: ${tenCap(traLoi.cap)}. Đóng dấu là nộp.`
                : "Ghim một cặp số làm căn cứ trước khi đóng dấu."
            }
          />
        </>
      ) : null}
    </div>
  );
}

/** Phần "Xem chi tiết" của một xe (GĐ17c): dấu đúng, điểm, các cặp số phải so, biên bản. */
export function ChiTietRiengTramCan({ chiTiet }: { chiTiet: unknown }) {
  const ct = chiTiet as ChiTietTramCan;
  return (
    <div className="space-y-3">
      <p className="text-[15px]">
        Đúng ra: <strong>{TEN_DAU_TRAM_CAN[ct.dau_dung]}</strong>. Dấu {ct.diem_dau}/10 · cặp số {ct.diem_cap}
        /5 · ước phần trăm {ct.diem_uoc}/3 (bạn ước {ct.uoc}%, vượt thực{" "}
        {ct.phan_tram_vuot.toLocaleString("vi-VN")}%).
      </p>
      <section className="g-the rounded-2xl p-3" aria-label="Các cặp số">
        <h3 className="text-base font-semibold">Các cặp số phải so</h3>
        <ul className="mt-2 grid gap-2 text-sm">
          {ct.cac_cap.map((c) => {
            const quyet = c.phieu === ct.cap_quyet.phieu && c.gioi_han === ct.cap_quyet.gioi_han;
            return (
              <li
                key={`${c.phieu}|${c.gioi_han}`}
                className="border-l-4 pl-2"
                style={{ borderColor: quyet ? "var(--primary)" : "var(--line)" }}
              >
                <span className="block">{c.ten}</span>
                <span className="g-so">
                  {kg(c.so_kg)} / {kg(c.gioi_han_kg)} ·{" "}
                  {c.phan_tram > 0 ? `vượt ${c.phan_tram.toLocaleString("vi-VN")}%` : "không vượt"}
                </span>
                {quyet ? <strong className="ml-2 text-primary">cặp quyết định</strong> : null}
                {c.khung_ma ? <span className="ml-2 text-danger">vào khung bị xử phạt</span> : null}
              </li>
            );
          })}
        </ul>
      </section>
      {ct.dau_dung === "lap_bien_ban" ? <BienBan dong={ct.bien_ban} /> : null}
    </div>
  );
}
