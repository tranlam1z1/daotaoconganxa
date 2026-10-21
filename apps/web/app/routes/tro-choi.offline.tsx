/**
 * Chơi trò chơi khi không có mạng, `/tro-choi/offline` (docs/PLAN.md GĐ-G0).
 *
 * Route chỉ chạy phía client như luyện tập offline (GĐ13): dữ liệu đọc từ IndexedDB, service worker
 * giữ sẵn trang. Khi có mạng, trang tải gói nội dung của từng trò qua cầu nối /api/*.
 *
 * Lượt sinh trên máy bằng cùng hàm của máy chủ (`taoLuot` với seed của lượt). Mỗi bước chấm trên
 * máy để hiện kết quả ngay (hộp kết quả, GĐ17a; căn cứ chỉ nêu tên), lưu vào IndexedDB kèm `client_id`; khi có mạng, máy chủ sinh lại lượt
 * từ gói và seed, chấm lại, bỏ bản trùng. Lượt offline không tính giờ và không có thưởng nhanh.
 *
 * Cả lượt chạy trong state của trang, không đổi URL (đổi URL làm React Router gọi loader máy chủ
 * của trang gốc, việc hỏng khi mất mạng).
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";

import { HopKetQuaCau, NutXemLaiKetQua } from "../components/tro-choi/chung/HopKetQuaCau";
import { chiTietRieng, giaoDienCua } from "../components/tro-choi/giao-dien";
import { NhanCombo } from "../components/tro-choi/hieu-ung/NhanCombo";
import { NutCaiDatGame } from "../components/tro-choi/hieu-ung/NutCaiDatGame";
import { SaoTongKet } from "../components/tro-choi/hieu-ung/SaoTongKet";
import { SoChay } from "../components/tro-choi/hieu-ung/SoChay";
import { VungTroChoi } from "../components/tro-choi/hieu-ung/VungTroChoi";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Notice } from "../components/ui/Field";
import { KhungCho } from "../components/ui/KhungCho";
import { cn } from "../lib/cn";
import { chuoiDung } from "../lib/hieu-ung";
import { dapAnNgan } from "../lib/ket-qua-cau";
import type { KetQuaBuocWeb, TongQuanLuotChoi } from "../lib/luot-choi";
import type { DeCauHoi, KetQuaCauHoi } from "../lib/ngan-hang";
import { batDongBoTuDong, dongBo, type KetQuaDongBo, SU_KIEN_DONG_BO } from "../lib/offline/dong-bo";
import {
  danhSachGoiTroChoi,
  type GoiTroChoiOffline,
  type LuotOffline,
  layGoiTroChoi,
  layLuotOffline,
  luotChoDongBo,
  luotGanDay,
  luuGoiTroChoi,
  luuLuot,
  xoaGoiTroChoi,
} from "../lib/offline/kho";
import { chamBuocCoGio, layTroChoi, taoRng, tongKetLuot } from "../lib/offline/tro-choi";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/tro-choi.offline";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Chơi khi không có mạng", { index: false });
}

async function docKho() {
  const [goi, cho, ganDay] = await Promise.all([danhSachGoiTroChoi(), luotChoDongBo(), luotGanDay(10)]);
  return { goi, soLuotCho: cho.length, dangChoi: ganDay.find((l) => !l.ket_thuc) ?? null };
}

export async function clientLoader() {
  return await docKho();
}

export function HydrateFallback() {
  return (
    <div className="wrap max-w-xl py-8">
      <p className="text-base text-ink-2">Đang mở dữ liệu trò chơi trên máy…</p>
    </div>
  );
}

function useCoMang() {
  const [coMang, datCoMang] = useState(true);
  useEffect(() => {
    datCoMang(navigator.onLine);
    const bat = () => datCoMang(true);
    const tat = () => datCoMang(false);
    window.addEventListener("online", bat);
    window.addEventListener("offline", tat);
    return () => {
      window.removeEventListener("online", bat);
      window.removeEventListener("offline", tat);
    };
  }, []);
  return [coMang, datCoMang] as const;
}

function luuTrangChoOffline() {
  navigator.serviceWorker?.controller?.postMessage({ type: "luu-trang", url: "/tro-choi/offline" });
}

export default function TroChoiOffline({ loaderData }: Route.ComponentProps) {
  const [duLieu, datDuLieu] = useState(loaderData);
  const docLai = useCallback(() => void docKho().then(datDuLieu), []);
  const [coMang, datCoMang] = useCoMang();
  const [luot, datLuot] = useState<LuotOffline | null>(loaderData.dangChoi);
  const [dongBoGanNhat, datDongBoGanNhat] = useState<KetQuaDongBo | null>(null);

  useEffect(() => {
    const nghe = (e: Event) => {
      const kq = (e as CustomEvent<KetQuaDongBo>).detail;
      datDongBoGanNhat(kq);
      if (kq.trangThai === "khong_co_mang") datCoMang(false);
      docLai();
      datLuot((l) => {
        if (l?.ket_thuc) void layLuotOffline(l.client_id).then((moi) => moi && datLuot(moi));
        return l;
      });
    };
    window.addEventListener(SU_KIEN_DONG_BO, nghe);
    batDongBoTuDong();
    luuTrangChoOffline();
    return () => window.removeEventListener(SU_KIEN_DONG_BO, nghe);
  }, [docLai, datCoMang]);

  const batDau = async (ma: string, man: number | null = null) => {
    const g = await layGoiTroChoi(ma);
    if (!g) return;
    const seed = crypto.randomUUID();
    const dn = layTroChoi(g.ma);
    if (!dn) return;
    const moi: LuotOffline = {
      man,
      client_id: crypto.randomUUID(),
      ma: g.ma,
      ten: g.ten,
      goi_id: g.goi_id,
      seed,
      bat_dau: new Date().toISOString(),
      ket_thuc: null,
      so_buoc: dn.taoLuot(g.nguon, taoRng(seed), man ?? undefined).length,
      buoc: [],
      da_dong_bo: null,
      xp: null,
    };
    await luuLuot(moi);
    datLuot(moi);
  };

  if (luot) {
    return (
      <VungTroChoi>
        <LuotLam
          luot={luot}
          coMang={coMang}
          doiLuot={datLuot}
          thoat={() => {
            datLuot(null);
            docLai();
          }}
        />
      </VungTroChoi>
    );
  }

  const { goi, soLuotCho } = duLieu;
  return (
    <VungTroChoi>
      <div className="wrap max-w-xl py-8">
        <p className="hidden text-sm md:block">
          <Link to="/tro-choi" className="inline-flex min-h-11 items-center text-ink-2 underline">
            Trò chơi
          </Link>
        </p>
        <h1 className="text-3xl font-semibold">Chơi khi không có mạng</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
          Tải trò chơi về máy khi có mạng. Khi mất mạng vẫn chơi được; kết quả tự gửi khi có mạng trở lại.
          Chơi offline không tính giờ và không có thưởng nhanh.
        </p>

        {!coMang ? (
          <Notice className="mt-4">Đang không có mạng. Bạn chơi được các trò đã tải về máy.</Notice>
        ) : null}
        {soLuotCho > 0 ? (
          <div className="mt-4 rounded-xl border border-line bg-surface p-4">
            <p className="text-base">
              {soLuotCho} lượt chơi trên máy chưa gửi lên.{coMang ? "" : " Kết quả sẽ tự gửi khi có mạng."}
            </p>
            {coMang ? (
              <Button
                variant="secondary"
                className="mt-3 min-h-12 w-full text-base"
                onClick={() => void dongBo()}
              >
                Gửi kết quả ngay
              </Button>
            ) : null}
          </div>
        ) : null}
        {dongBoGanNhat?.trangThai === "xong" && dongBoGanNhat.soPhien ? (
          <Notice className="mt-4">
            Đã gửi kết quả lên máy chủ{dongBoGanNhat.xp ? `, +${dongBoGanNhat.xp} điểm kinh nghiệm` : ""}.
          </Notice>
        ) : null}
        {dongBoGanNhat && dongBoGanNhat.trangThai === "can_dang_nhap" ? (
          <Notice tone="danger" className="mt-4">
            {dongBoGanNhat.thongBao}{" "}
            <Link to="/dang-nhap?tiep=/tro-choi/offline" className="underline">
              Đăng nhập
            </Link>
          </Notice>
        ) : null}

        <h2 className="mt-8 text-xl font-semibold">Trò chơi đã tải về máy</h2>
        {goi.length === 0 ? (
          <div className="mt-3">
            <EmptyState icon="trophy" title="Chưa tải trò chơi nào">
              <p>
                {coMang ? "Chọn trò chơi ở phần bên dưới để tải về." : "Cần có mạng để tải trò chơi về máy."}
              </p>
            </EmptyState>
          </div>
        ) : (
          <ul className="mt-3 grid gap-3">
            {goi.map((g) => (
              <li key={g.ma} className="rounded-xl border border-line bg-surface p-4">
                <p className="text-base font-semibold">{g.ten}</p>
                <p className="mt-1 text-sm text-ink-2">
                  Tải lúc {new Date(g.tai_luc).toLocaleString("vi-VN")} · dùng tới{" "}
                  {new Date(g.het_han).toLocaleDateString("vi-VN")}
                </p>
                {g.man?.length ? (
                  // Trò có màn (GĐ-T1): chơi được các màn đang mở lúc tải gói.
                  <div className="mt-3 grid gap-2">
                    {g.man
                      .filter((m) => m.da_mo)
                      .map((m) => (
                        <Button
                          key={m.so}
                          variant="secondary"
                          className="min-h-12 w-full justify-start text-base"
                          onClick={() => void batDau(g.ma, m.so)}
                        >
                          {m.ten}
                        </Button>
                      ))}
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {g.man?.length ? null : (
                    <Button className="min-h-12 flex-1 text-base" onClick={() => void batDau(g.ma)}>
                      Chơi
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    className="min-h-12"
                    onClick={async () => {
                      await xoaGoiTroChoi(g.ma);
                      docLai();
                    }}
                  >
                    Xóa khỏi máy
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {coMang ? (
          <TaiTroChoi daTai={new Set(goi.map((g) => g.ma))} xong={docLai} matMang={() => datCoMang(false)} />
        ) : null}
      </div>
    </VungTroChoi>
  );
}

function TaiTroChoi({ daTai, xong, matMang }: { daTai: Set<string>; xong: () => void; matMang: () => void }) {
  const [ds, datDs] = useState<TongQuanLuotChoi["tro_choi"] | null>(null);
  const [loi, datLoi] = useState<string | null>(null);
  const [dangTai, datDangTai] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/luot-choi")
      .then(async (r) => {
        if (r.status === 401)
          throw new Error("Đăng nhập bằng tài khoản đã được xác minh để tải trò chơi về máy.");
        if (!r.ok) throw new Error("Không tải được danh sách trò chơi.");
        datDs(((await r.json()) as TongQuanLuotChoi).tro_choi.filter((g) => g.offline));
      })
      .catch((e: unknown) => {
        if (e instanceof TypeError) matMang();
        datLoi(e instanceof Error ? e.message : "Không tải được danh sách trò chơi.");
      });
  }, [matMang]);

  const taiVe = async (ma: string) => {
    datDangTai(ma);
    datLoi(null);
    try {
      const r = await fetch(`/api/luot-choi/goi-offline/${encodeURIComponent(ma)}`);
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(j?.error?.message ?? "Không tải được trò chơi. Hãy thử lại.");
      }
      await luuGoiTroChoi((await r.json()) as GoiTroChoiOffline);
      luuTrangChoOffline();
      xong();
    } catch (e) {
      if (e instanceof TypeError) matMang();
      datLoi(e instanceof Error ? e.message : "Không tải được trò chơi.");
    } finally {
      datDangTai(null);
    }
  };

  return (
    <section className="mt-8" aria-labelledby="tai-tro-choi">
      <h2 id="tai-tro-choi" className="text-xl font-semibold">
        Tải trò chơi về máy
      </h2>
      {loi ? (
        <Notice tone="danger" className="mt-3">
          {loi}
        </Notice>
      ) : null}
      {ds === null && !loi ? (
        <KhungCho nhan="Đang tải danh sách trò chơi…" dong={4} cao="h-16" className="mt-3" />
      ) : null}
      {ds?.length === 0 ? (
        <p className="mt-3 text-ink-2">Chưa có trò chơi nào chơi được khi mất mạng.</p>
      ) : null}
      {ds?.length ? (
        <ul className="mt-3 grid gap-2">
          {ds.map((g) => (
            <li
              key={g.ma}
              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3"
            >
              <span className="min-w-0">
                <span className="block text-base">{g.ten}</span>
                <span className="block text-sm text-ink-2">{g.so_buoc} câu mỗi lượt</span>
              </span>
              <Button
                variant={daTai.has(g.ma) ? "secondary" : "primary"}
                className="min-h-12 shrink-0"
                disabled={dangTai !== null}
                onClick={() => void taiVe(g.ma)}
              >
                {dangTai === g.ma ? "Đang tải" : daTai.has(g.ma) ? "Tải lại" : "Tải về"}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Một lượt                                                            */
/* ------------------------------------------------------------------ */

function LuotLam({
  luot,
  coMang,
  doiLuot,
  thoat,
}: {
  luot: LuotOffline;
  coMang: boolean;
  doiLuot: (l: LuotOffline) => void;
  thoat: () => void;
}) {
  const [goi, datGoi] = useState<GoiTroChoiOffline | null | undefined>(undefined);
  useEffect(() => {
    void layGoiTroChoi(luot.ma).then((g) => datGoi(g ?? null));
  }, [luot.ma]);
  const dn = layTroChoi(luot.ma);
  const gd = giaoDienCua(luot.ma);
  const [thuTuXem, datThuTuXem] = useState<number | null>(null);
  const [traLoi, datTraLoi] = useState<unknown>(gd?.traLoiRong ?? {});
  // Hộp kết quả (GĐ17a): mở khi vừa chốt; đóng bằng X/Esc thì đáy trang có "Xem lại kết quả".
  const [moHop, datMoHop] = useState(false);
  const [lanMoHop, datLanMoHop] = useState(0);
  const [vuaDongHop, datVuaDongHop] = useState(false);

  if (goi === undefined) return <div className="wrap max-w-xl py-8 text-ink-2">Đang mở lượt chơi…</div>;
  if (!goi || goi.goi_id !== luot.goi_id || !dn || !gd) {
    return (
      <div className="wrap max-w-xl py-8">
        <Notice tone="danger">
          Gói của lượt này không còn trên máy. Lượt đã chơi vẫn được gửi khi có mạng.
        </Notice>
        <Button className="mt-4 min-h-12 w-full text-base" onClick={thoat}>
          Về danh sách
        </Button>
      </div>
    );
  }

  const items = dn.taoLuot(goi.nguon, taoRng(luot.seed), luot.man ?? undefined);
  const daLam = new Map(luot.buoc.map((b) => [b.thu_tu, b]));
  const hienTai = items.find((b) => !daLam.has(b.thu_tu));
  const dangXem = thuTuXem !== null ? daLam.get(thuTuXem) : undefined;

  const ketThuc = async () => {
    const xong = { ...luot, ket_thuc: new Date().toISOString(), da_dong_bo: null };
    await luuLuot(xong);
    doiLuot(xong);
    await dongBo();
    const sau = await layLuotOffline(xong.client_id);
    if (sau) doiLuot(sau);
  };

  if (luot.ket_thuc || (!hienTai && !dangXem)) {
    const tk = tongKetLuot(
      luot.buoc.map((b) => ({ diem: b.diem, thuong: 0, dung: b.dung })),
      items,
    );
    return (
      <div className="wrap max-w-xl py-8">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink-2">{luot.ten} · chơi offline</p>
          <NutCaiDatGame />
        </div>
        <div className="g-a g-vao-len g-the g-the-nhan mt-4 p-5 text-center">
          <SaoTongKet so={tk.sao} />
          <p className="mt-3 text-4xl font-bold">
            <SoChay den={tk.diem} treMs={900} thapPhan={1} />
            <span className="g-so text-2xl text-ink-2">/{tk.diemToiDa.toLocaleString("vi-VN")}</span>
          </p>
          <p className="mt-1 text-[15px] text-ink-2">
            Đúng {tk.soDung}/{items.length}
          </p>
          <p className="mt-3 text-base">
            {luot.da_dong_bo
              ? luot.xp
                ? `Đã gửi lên máy chủ, +${luot.xp} điểm kinh nghiệm.`
                : "Đã gửi lên máy chủ."
              : coMang
                ? "Đang gửi kết quả lên máy chủ…"
                : "Kết quả đã lưu trên máy và sẽ tự gửi khi có mạng."}
          </p>
        </div>
        {!luot.ket_thuc ? (
          <Button className="g-nut mt-4 w-full" onClick={() => void ketThuc()}>
            Chốt kết quả
          </Button>
        ) : null}
        <Button
          variant={luot.ket_thuc ? "primary" : "secondary"}
          className="mt-3 min-h-12 w-full text-base"
          onClick={thoat}
        >
          Về danh sách
        </Button>
      </div>
    );
  }

  const buoc = dangXem ? items[dangXem.thu_tu - 1]! : hienTai!;
  const daCham = dangXem ?? null;

  const chot = async (t: unknown = traLoi) => {
    const kq = chamBuocCoGio(dn, buoc, t, { moLuc: null, luc: new Date(), offline: true });
    const moi: LuotOffline = {
      ...luot,
      da_dong_bo: null,
      buoc: [
        ...luot.buoc,
        {
          client_id: crypto.randomUUID(),
          thu_tu: buoc.thu_tu,
          tra_loi: t,
          luc: new Date().toISOString(),
          diem: kq.diem,
          diem_toi_da: kq.diemToiDa,
          dung: kq.dung,
          giai_thich: kq.giaiThich,
          can_cu: kq.canCu,
          chi_tiet: kq.chiTiet ?? null,
        },
      ],
    };
    await luuLuot(moi);
    doiLuot(moi);
    datThuTuXem(buoc.thu_tu);
    datMoHop(true);
    datVuaDongHop(false);
  };

  const conBuoc = items.some((b) => !daLam.has(b.thu_tu) && b.thu_tu !== buoc.thu_tu);

  const chuoi = chuoiDung([...luot.buoc].sort((a, b) => a.thu_tu - b.thu_tu).map((b) => b.dung));

  const ketQua: KetQuaBuocWeb | null = daCham
    ? {
        diem: daCham.diem,
        thuong: 0,
        diem_toi_da: daCham.diem_toi_da,
        dung: daCham.dung,
        het_gio: false,
        thoi_gian_ms: null,
        giai_thich: daCham.giai_thich,
        can_cu: daCham.can_cu,
        chi_tiet: daCham.chi_tiet,
      }
    : null;
  const dapAn =
    ketQua && luot.ma === "thu_nghiem" && (ketQua.chi_tiet as KetQuaCauHoi | null)?.dap_an
      ? dapAnNgan(dn.deChoNguoiChoi(buoc) as DeCauHoi, ketQua.chi_tiet as KetQuaCauHoi)
      : null;
  // Nút đi tiếp: trong hộp khi hộp mở, ở đáy trang khi hộp đã đóng. Lượt offline không đổi URL.
  const nutDiTiep = conBuoc ? (
    <Button
      className="min-h-12 w-full text-base"
      onClick={() => {
        datThuTuXem(null);
        datTraLoi(gd.traLoiRong);
        datMoHop(false);
      }}
    >
      {gd.nutTiep ?? "Câu tiếp"}
    </Button>
  ) : (
    <Button className="min-h-12 w-full text-base" onClick={() => void ketThuc()}>
      Xem kết quả
    </Button>
  );

  return (
    <div className="wrap max-w-xl py-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-2">
          {luot.ten} · {gd.tenBuoc ?? "Câu"} {buoc.thu_tu}/{items.length}
          {!coMang ? " · đang không có mạng" : ""}
        </p>
        <NutCaiDatGame />
      </div>
      <div className="mt-2 flex min-h-8 justify-end">
        <NhanCombo n={chuoi} />
      </div>
      <div key={buoc.thu_tu} className={cn("mt-2 g-a g-truot-vao")}>
        <div className={cn(daCham && daCham.dung !== true && "g-t g-rung-ngang")}>
          <gd.Buoc
            key={buoc.thu_tu}
            de={dn.deChoNguoiChoi(buoc)}
            traLoi={daCham ? daCham.tra_loi : traLoi}
            datTraLoi={datTraLoi}
            chiTiet={daCham?.chi_tiet}
            daCham={Boolean(daCham)}
            idGoc={`off-${buoc.thu_tu}`}
            gui={(t) => void chot(t)}
            buocOffline={buoc.noi_dung}
          />
        </div>
      </div>
      <div className="mt-6">
        {!daCham ? (
          gd.anNutChot ? null : (
            <Button
              className="min-h-12 w-full text-base"
              disabled={!gd.daChon(traLoi)}
              onClick={() => void chot()}
            >
              Chốt đáp án
            </Button>
          )
        ) : moHop ? null : (
          <div className="grid gap-3">
            <NutXemLaiKetQua
              layTieuDiem={vuaDongHop}
              onClick={() => {
                datMoHop(true);
                datLanMoHop((n) => n + 1);
              }}
            />
            {nutDiTiep}
          </div>
        )}
      </div>
      {ketQua ? (
        <HopKetQuaCau
          key={buoc.thu_tu}
          mo={moHop}
          lanMo={lanMoHop}
          onDong={() => {
            datMoHop(false);
            datVuaDongHop(true);
          }}
          ketQua={ketQua}
          nutChinh={nutDiTiep}
          coMang={false}
          dapAn={dapAn}
          chiTietRieng={chiTietRieng(gd, dn.deChoNguoiChoi(buoc), ketQua)}
        />
      ) : null}
      <p className="mt-6 text-center text-sm">
        <button
          type="button"
          onClick={thoat}
          className="inline-flex min-h-11 items-center text-ink-2 underline"
        >
          Tạm dừng, chơi tiếp sau
        </button>
      </p>
    </div>
  );
}
