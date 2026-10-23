/**
 * Luyện tập offline `/luyen-tap/offline` (docs/PLAN.md GĐ13).
 *
 * Route chỉ chạy phía client (`clientLoader`, không có loader máy chủ): dữ liệu đọc từ
 * IndexedDB (lib/offline/kho.ts), nên mở được khi mất mạng nhờ service worker giữ sẵn trang.
 * Khi có mạng, trang tải gói câu hỏi và gửi kết quả qua cầu nối /api/* (routes/api.$.tsx).
 *
 * Cả phiên 10 câu chạy trong state của trang, không đổi URL giữa các câu: đổi URL sẽ làm React
 * Router gọi lại loader máy chủ của trang gốc, việc không làm được khi mất mạng. Mỗi câu trả
 * lời được lưu ngay vào IndexedDB, nên tải lại trang giữa chừng vẫn làm tiếp được.
 *
 * Trong lúc làm KHÔNG báo đúng/sai: có "Câu trước"/"Câu sau", sửa được câu trả lời tới khi nộp bài.
 * Nộp bài thì máy mới chấm; màn kết quả nêu từng câu đúng/sai kèm giải thích. Phiên chỉ được gửi
 * lên máy chủ sau khi nộp (máy chủ không cho sửa câu đã nhận).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { HienThiCauHoi } from "../components/cau-hoi/HienThiCauHoi";
import { ThanhTienDo } from "../components/luyen-tap/ThanhTienDo";
import { coTraLoi } from "../components/luyen-tap/useLuuTam";
import { HopXacNhanNop } from "../components/thi/HopXacNhanNop";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Notice } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { KhungCho } from "../components/ui/KhungCho";
import { DauTrangAnh, KhungTrang, TieuDeTrang } from "../components/ui/KhungTrang";
import { nhanVienDan } from "../lib/citation";
import { cn } from "../lib/cn";
import { TEN_MUC_DO } from "../lib/ngan-hang";
import {
  chamCauHoi,
  type KetQuaCauHoi,
  rutCauLuyenTap,
  SO_CAU_MOI_PHIEN,
  type TraLoiCauHoi,
} from "../lib/offline/cham";
import { batDongBoTuDong, dongBo, type KetQuaDongBo, SU_KIEN_DONG_BO } from "../lib/offline/dong-bo";
import {
  danhSachGoi,
  type GoiOffline,
  layGoi,
  layPhien,
  luuGoi,
  luuPhien,
  type PhienOffline,
  phienChoDongBo,
  phienGanDay,
  xoaGoi,
} from "../lib/offline/kho";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/luyen-tap.offline";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Luyện tập không cần mạng", { index: false });
}

/**
 * Đọc dữ liệu trang từ kho trên máy. Tách khỏi clientLoader vì React Router (v8_splitRouteModules)
 * đưa clientLoader sang tệp riêng, component không gọi thẳng được.
 */
async function docKho() {
  const [goi, cho, ganDay] = await Promise.all([danhSachGoi(), phienChoDongBo(), phienGanDay(10)]);
  // Phiên đang làm dở gần nhất (chưa kết thúc), để mở lại trang thì làm tiếp.
  const dangLam = ganDay.find((p) => !p.ket_thuc) ?? null;
  return {
    goi: goi.map((g) => ({ ...g.chu_de, soCau: g.cau.length, taiLuc: g.tai_luc })),
    soPhienCho: cho.length,
    dangLam,
  };
}

export async function clientLoader() {
  return await docKho();
}

export function HydrateFallback() {
  return (
    <KhungTrang className="wrap max-w-xl py-8">
      <p className="text-base text-ink-2">Đang mở dữ liệu luyện tập trên máy…</p>
    </KhungTrang>
  );
}

/**
 * Có mạng hay không. `navigator.onLine` chỉ biết máy có nối mạng cục bộ (Wi-Fi không có Internet
 * vẫn báo "có"), nên thêm cờ `baoMatKetNoi`: một lần gọi máy chủ hỏng vì lỗi mạng thì coi như mất
 * mạng, tới khi trình duyệt báo có mạng trở lại.
 */
function useCoMang(): { coMang: boolean; baoMatKetNoi: () => void; baoCoKetNoi: () => void } {
  const [onLine, datOnLine] = useState(true);
  const [matKetNoi, datMatKetNoi] = useState(false);
  useEffect(() => {
    datOnLine(navigator.onLine);
    const bat = () => {
      datOnLine(true);
      datMatKetNoi(false);
    };
    const tat = () => datOnLine(false);
    window.addEventListener("online", bat);
    window.addEventListener("offline", tat);
    return () => {
      window.removeEventListener("online", bat);
      window.removeEventListener("offline", tat);
    };
  }, []);
  const baoMatKetNoi = useCallback(() => datMatKetNoi(true), []);
  const baoCoKetNoi = useCallback(() => datMatKetNoi(false), []);
  return { coMang: onLine && !matKetNoi, baoMatKetNoi, baoCoKetNoi };
}

/** Lỗi của fetch khi không tới được máy chủ (khác lỗi HTTP do máy chủ trả về). */
class LoiMang extends Error {}

async function goiMang(url: string): Promise<Response> {
  try {
    return await fetch(url);
  } catch {
    throw new LoiMang("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
  }
}

/** Nhờ service worker giữ sẵn trang này và các tệp của nó, để mở lại được khi mất mạng. */
function luuTrangChoOffline() {
  navigator.serviceWorker?.controller?.postMessage({ type: "luu-trang", url: "/luyen-tap/offline" });
}

export default function LuyenTapOffline({ loaderData }: Route.ComponentProps) {
  // Dữ liệu kho giữ trong state và đọc lại bằng chính clientLoader, KHÔNG dùng useRevalidator:
  // revalidate gọi lại cả loader máy chủ của trang gốc, việc hỏng khi mất mạng.
  const [duLieu, datDuLieu] = useState(loaderData);
  const { goi, soPhienCho, dangLam } = duLieu;
  const revalidate = useCallback(() => {
    void docKho().then(datDuLieu);
  }, []);
  const { coMang, baoMatKetNoi, baoCoKetNoi } = useCoMang();
  const [phien, datPhien] = useState<PhienOffline | null>(dangLam);
  const [dongBoGanNhat, datDongBoGanNhat] = useState<KetQuaDongBo | null>(null);

  // Mỗi lượt gửi (kể cả lượt tự thử lại chạy nền): cập nhật trạng thái mạng, số phiên chờ, và
  // trạng thái đã gửi của phiên đang xem kết quả.
  useEffect(() => {
    const nghe = (e: Event) => {
      const kq = (e as CustomEvent<KetQuaDongBo>).detail;
      datDongBoGanNhat(kq);
      if (kq.trangThai === "khong_co_mang") baoMatKetNoi();
      else if (kq.trangThai === "xong") baoCoKetNoi();
      revalidate();
      datPhien((p) => {
        if (p?.ket_thuc) void layPhien(p.client_id).then((moi) => moi && datPhien(moi));
        return p;
      });
    };
    window.addEventListener(SU_KIEN_DONG_BO, nghe);
    batDongBoTuDong();
    luuTrangChoOffline();
    return () => window.removeEventListener(SU_KIEN_DONG_BO, nghe);
  }, [baoMatKetNoi, baoCoKetNoi, revalidate]);

  const guiKetQua = useCallback(async () => {
    await dongBo();
  }, []);

  // Có mạng trở lại thì gửi ngay và cập nhật số phiên chờ.
  useEffect(() => {
    if (coMang && soPhienCho > 0) void guiKetQua();
  }, [coMang, soPhienCho, guiKetQua]);

  const batDau = async (ma: string) => {
    const g = await layGoi(ma);
    if (!g) return;
    const clientId = crypto.randomUUID();
    const moi: PhienOffline = {
      client_id: clientId,
      chu_de: g.chu_de,
      bat_dau: new Date().toISOString(),
      ket_thuc: null,
      items: rutCauLuyenTap({ nguon: g.cau, seed: clientId, soCau: SO_CAU_MOI_PHIEN }),
      cau_tra_loi: [],
      da_dong_bo: null,
    };
    await luuPhien(moi);
    datPhien(moi);
  };

  if (phien) {
    return (
      <PhienLam
        phien={phien}
        coMang={coMang}
        doiPhien={datPhien}
        ketThuc={async () => {
          await guiKetQua();
        }}
        thoat={() => {
          datPhien(null);
          revalidate();
        }}
      />
    );
  }

  return (
    <KhungTrang className="wrap max-w-3xl py-8">
      <DauTrangAnh icon="cap" tieuDe="Luyện tập không cần mạng">
        Tải câu hỏi của chủ đề về máy khi có mạng. Sau đó luyện được cả khi mất mạng; kết quả tự gửi lên khi
        có mạng trở lại.
      </DauTrangAnh>

      {!coMang ? (
        <Notice className="mt-4">Đang không có mạng. Bạn vẫn luyện được các chủ đề đã tải về máy.</Notice>
      ) : null}

      {soPhienCho > 0 ? (
        <div className="mt-4 rounded-xl border border-line bg-surface p-4">
          <p className="text-base">
            {soPhienCho} phiên đã làm trên máy chưa gửi lên.
            {coMang ? "" : " Kết quả sẽ tự gửi khi có mạng."}
          </p>
          {coMang ? (
            <Button
              variant="secondary"
              className="mt-3 min-h-12 w-full text-base"
              onClick={() => void guiKetQua()}
            >
              Gửi kết quả ngay
            </Button>
          ) : null}
        </div>
      ) : null}
      <ThongBaoDongBo kq={dongBoGanNhat} />

      <h2 className="mt-8 text-xl font-semibold">Chủ đề đã tải về máy</h2>
      {goi.length === 0 ? (
        <div className="mt-3">
          <EmptyState icon="cap" title="Chưa tải chủ đề nào">
            <p>{coMang ? "Chọn chủ đề ở phần bên dưới để tải về." : "Cần có mạng để tải chủ đề về máy."}</p>
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-3 grid gap-3">
          {goi.map((g) => (
            <li key={g.code} className="rounded-xl border border-line bg-surface p-4">
              <p className="text-base font-semibold">{g.name}</p>
              <p className="mt-1 text-sm text-ink-2">
                {g.soCau} câu · tải lúc {new Date(g.taiLuc).toLocaleString("vi-VN")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  className="min-h-12 flex-1 text-base"
                  disabled={g.soCau === 0}
                  onClick={() => void batDau(g.code)}
                >
                  Luyện {Math.min(SO_CAU_MOI_PHIEN, g.soCau)} câu
                </Button>
                <Button
                  variant="secondary"
                  className="min-h-12"
                  onClick={async () => {
                    await xoaGoi(g.code);
                    revalidate();
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
        <TaiThemChuDe daTai={new Set(goi.map((g) => g.code))} xong={revalidate} matMang={baoMatKetNoi} />
      ) : null}
    </KhungTrang>
  );
}

function ThongBaoDongBo({ kq }: { kq: KetQuaDongBo | null }) {
  if (!kq) return null;
  if (kq.trangThai === "xong") {
    if (!kq.soPhien) return null;
    return <Notice className="mt-4">Đã gửi {kq.soPhien} phiên lên máy chủ.</Notice>;
  }
  return (
    <Notice tone={kq.trangThai === "can_dang_nhap" ? "danger" : "info"} className="mt-4">
      {kq.thongBao}
      {kq.trangThai === "can_dang_nhap" ? (
        <>
          {" "}
          <Link to="/dang-nhap?tiep=/luyen-tap/offline" className="underline">
            Đăng nhập
          </Link>
        </>
      ) : null}
    </Notice>
  );
}

interface ChuDeCoSan {
  id: string;
  code: string;
  name: string;
  so_cau: number;
  parent_id: string | null;
}

/** Danh sách chủ đề trên máy chủ để tải về (chỉ khi có mạng). */
function TaiThemChuDe({
  daTai,
  xong,
  matMang,
}: {
  daTai: Set<string>;
  xong: () => void;
  /** Báo cho trang biết không tới được máy chủ, để chuyển sang giao diện mất mạng. */
  matMang: () => void;
}) {
  const [ds, datDs] = useState<ChuDeCoSan[] | null>(null);
  const [loi, datLoi] = useState<string | null>(null);
  const [dangTai, datDangTai] = useState<string | null>(null);

  useEffect(() => {
    goiMang("/api/luyen-tap/chu-de")
      .then(async (r) => {
        if (r.status === 401)
          throw new Error("Đăng nhập bằng tài khoản đã được xác minh để tải chủ đề về máy.");
        if (!r.ok) throw new Error("Không tải được danh sách chủ đề.");
        const d = (await r.json()) as { items: ChuDeCoSan[] };
        datDs(d.items.filter((t) => t.so_cau > 0));
      })
      .catch((e: unknown) => {
        if (e instanceof LoiMang) matMang();
        datLoi(e instanceof Error ? e.message : "Không tải được danh sách chủ đề.");
      });
  }, [matMang]);

  const taiVe = async (t: ChuDeCoSan) => {
    datDangTai(t.code);
    datLoi(null);
    try {
      const r = await goiMang(`/api/luyen-tap/goi-offline/${encodeURIComponent(t.code)}`);
      if (!r.ok) throw new Error("Không tải được chủ đề. Hãy thử lại.");
      const goi = (await r.json()) as GoiOffline;
      if (!goi.cau.length) throw new Error("Chủ đề này chưa có câu nào được phép luyện offline.");
      await luuGoi(goi);
      luuTrangChoOffline();
      xong();
    } catch (e) {
      if (e instanceof LoiMang) matMang();
      datLoi(e instanceof Error ? e.message : "Không tải được chủ đề.");
    } finally {
      datDangTai(null);
    }
  };

  return (
    <section className="mt-8" aria-labelledby="tai-them">
      <h2 id="tai-them" className="text-xl font-semibold">
        Tải thêm chủ đề
      </h2>
      {loi ? (
        <Notice tone="danger" className="mt-3">
          {loi}{" "}
          {loi.startsWith("Đăng nhập") ? (
            <Link to="/dang-nhap?tiep=/luyen-tap/offline" className="underline">
              Đăng nhập
            </Link>
          ) : null}
        </Notice>
      ) : null}
      {ds === null && !loi ? (
        <KhungCho nhan="Đang tải danh sách chủ đề…" dong={4} cao="h-16" className="mt-3" />
      ) : null}
      {ds ? (
        <ul className="mt-3 grid gap-2">
          {ds.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3"
            >
              <span className="min-w-0">
                <span className="block text-base">{t.name}</span>
                <span className="block text-sm text-ink-2">{t.so_cau} câu</span>
              </span>
              <Button
                variant={daTai.has(t.code) ? "secondary" : "primary"}
                className="min-h-12 shrink-0"
                disabled={dangTai !== null}
                onClick={() => void taiVe(t)}
              >
                {dangTai === t.code ? "Đang tải" : daTai.has(t.code) ? "Tải lại" : "Tải về"}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Một phiên                                                           */
/* ------------------------------------------------------------------ */

function PhienLam({
  phien,
  coMang,
  doiPhien,
  ketThuc,
  thoat,
}: {
  phien: PhienOffline;
  coMang: boolean;
  doiPhien: (p: PhienOffline) => void;
  ketThuc: () => Promise<void>;
  thoat: () => void;
}) {
  const daLam = new Map(phien.cau_tra_loi.map((a) => [a.question_id, a]));
  const viTriDau = phien.items.findIndex((c) => !daLam.has(c.question_id));
  const tong = phien.items.length;
  const [stt, datStt] = useState(viTriDau < 0 ? tong : viTriDau + 1);
  const [moXacNhan, datMoXacNhan] = useState(false);
  const [dangNop, datDangNop] = useState(false);
  // Mốc tính giây làm câu đang xem: đặt lại khi đổi câu và sau mỗi lần ghi câu trả lời.
  const mocCau = useRef({ stt, luc: Date.now() });
  if (mocCau.current.stt !== stt) mocCau.current = { stt, luc: Date.now() };

  if (phien.ket_thuc) return <KetQuaOffline phien={phien} coMang={coMang} thoat={thoat} />;

  const cau = phien.items[Math.min(stt, tong) - 1]!;
  const daCo = daLam.get(cau.question_id);
  const laCauCuoi = stt >= tong;

  /** Ghi câu trả lời của câu đang xem vào kho (thay câu trả lời cũ). Bỏ trống hết thì xóa. */
  const doiTraLoi = async (t: TraLoiCauHoi) => {
    const now = Date.now();
    const giay = (daCo?.giay ?? 0) + Math.round((now - mocCau.current.luc) / 1000);
    mocCau.current.luc = now;
    const khac = phien.cau_tra_loi.filter((a) => a.question_id !== cau.question_id);
    const moi: PhienOffline = {
      ...phien,
      da_dong_bo: null,
      cau_tra_loi: coTraLoi(t)
        ? [
            ...khac,
            {
              client_id: daCo?.client_id ?? crypto.randomUUID(),
              question_id: cau.question_id,
              question_version: cau.version,
              tra_loi: t,
              dung: chamCauHoi(cau.noi_dung, t).dung,
              giay,
            },
          ]
        : khac,
    };
    doiPhien(moi);
    await luuPhien(moi);
  };

  const denCau = (n: number) => {
    datStt(n);
    window.scrollTo({ top: 0 });
  };

  const nop = async () => {
    datDangNop(true);
    const xong = { ...phien, ket_thuc: new Date().toISOString(), da_dong_bo: null };
    await luuPhien(xong);
    doiPhien(xong);
    datMoXacNhan(false);
    datDangNop(false);
    await ketThuc();
    // Đọc lại để biết đã gửi được chưa.
    const sau = await layPhien(xong.client_id);
    if (sau) doiPhien(sau);
  };

  return (
    <KhungTrang className="wrap max-w-xl py-6">
      <p className="text-sm text-ink-2">
        {phien.chu_de.name} · {TEN_MUC_DO[cau.level]}
        {!coMang ? " · đang không có mạng" : ""}
      </p>
      <div className="mt-2">
        <ThanhTienDo hienTai={stt} tong={tong} daLam={daLam.size} />
      </div>

      <div className="mt-6">
        <HienThiCauHoi
          key={stt}
          de={cau.de}
          traLoi={daCo?.tra_loi ?? {}}
          onChange={(t) => void doiTraLoi(t)}
          idGoc={`off-${stt}`}
        />
      </div>

      <nav aria-label="Chuyển câu" className="mt-6 grid grid-cols-2 gap-3">
        <Button
          variant="secondary"
          className="min-h-12 text-base"
          disabled={stt <= 1}
          onClick={() => denCau(stt - 1)}
        >
          Câu trước
        </Button>
        {laCauCuoi ? (
          <Button className="min-h-12 text-base" onClick={() => datMoXacNhan(true)}>
            Nộp bài
          </Button>
        ) : (
          <Button className="min-h-12 text-base" onClick={() => denCau(stt + 1)}>
            Câu sau
          </Button>
        )}
      </nav>
      {!laCauCuoi ? (
        <Button
          variant="secondary"
          className="mt-3 min-h-12 w-full text-base"
          onClick={() => datMoXacNhan(true)}
        >
          Nộp bài
        </Button>
      ) : null}

      <p className="mt-6 text-center text-sm">
        <button
          type="button"
          onClick={thoat}
          className="inline-flex min-h-11 items-center text-ink-2 underline"
        >
          Tạm dừng, làm tiếp sau
        </button>
      </p>

      <HopXacNhanNop
        mo={moXacNhan}
        soChuaLam={tong - daLam.size}
        dangNop={dangNop}
        onDong={() => datMoXacNhan(false)}
        onNop={() => void nop()}
      />
    </KhungTrang>
  );
}

/** Màn kết quả sau khi nộp: số câu đúng, rồi từng câu với đúng/sai, đáp án, giải thích, căn cứ. */
function KetQuaOffline({
  phien,
  coMang,
  thoat,
}: {
  phien: PhienOffline;
  coMang: boolean;
  thoat: () => void;
}) {
  const daLam = new Map(phien.cau_tra_loi.map((a) => [a.question_id, a]));
  const dung = phien.cau_tra_loi.filter((a) => a.dung).length;
  return (
    <KhungTrang className="wrap max-w-xl py-8">
      <p className="text-sm text-ink-2">{phien.chu_de.name}</p>
      <TieuDeTrang icon="cap" className="mt-2">
        Đúng {dung}/{phien.items.length} câu
      </TieuDeTrang>
      <p className="mt-2 text-base text-ink-2">
        {phien.da_dong_bo
          ? "Kết quả đã gửi lên máy chủ."
          : coMang
            ? "Đang gửi kết quả lên máy chủ…"
            : "Kết quả đã lưu trên máy và sẽ tự gửi khi có mạng."}
      </p>
      <Button className="mt-6 min-h-12 w-full text-base" onClick={thoat}>
        Về danh sách chủ đề
      </Button>

      <section aria-labelledby="xem-lai-off" className="mt-8">
        <h2 id="xem-lai-off" className="font-sans text-lg font-semibold">
          Xem lại từng câu
        </h2>
        <ol className="mt-3 grid gap-4">
          {phien.items.map((c, i) => {
            const a = daLam.get(c.question_id);
            const traLoi = a?.tra_loi ?? {};
            return (
              <li key={c.question_id} className="rounded-xl border border-line bg-surface p-4">
                <p className="text-sm text-ink-2">
                  Câu {i + 1}
                  {a ? "" : " · chưa trả lời"}
                </p>
                <div className="mt-2">
                  <HienThiCauHoi
                    de={c.de}
                    traLoi={traLoi}
                    ketQua={chamCauHoi(c.noi_dung, traLoi)}
                    khoa
                    idGoc={`off-xem-${i + 1}`}
                    anPhanHoi
                  />
                </div>
                <PhanHoiOffline ketQua={chamCauHoi(c.noi_dung, traLoi)} />
              </li>
            );
          })}
        </ol>
      </section>
    </KhungTrang>
  );
}

/**
 * Phản hồi của một câu ở màn kết quả. Khác bản online (PhanHoiCauTraLoi) ở chỗ không mở ngăn kéo nguyên văn
 * căn cứ, vì việc đó cần mạng; vẫn nêu điều khoản làm căn cứ.
 */
function PhanHoiOffline({ ketQua }: { ketQua: KetQuaCauHoi }) {
  return (
    <div
      role="status"
      className={cn(
        "mt-4 rounded-lg border-l-4 px-4 py-3",
        ketQua.dung ? "border-ok bg-ok-soft" : "border-danger bg-danger-soft",
      )}
    >
      <p
        className={cn(
          "flex items-center gap-2 text-lg font-semibold",
          ketQua.dung ? "text-ok" : "text-danger",
        )}
      >
        <Icon name={ketQua.dung ? "check" : "x"} kieu="net" className="size-5 shrink-0" />
        {ketQua.dung ? "Đúng." : "Chưa đúng."}
      </p>
      {ketQua.giai_thich ? <p className="mt-1 text-base leading-relaxed">{ketQua.giai_thich}</p> : null}
      {ketQua.can_cu.length ? (
        <p className="mt-2 text-sm text-ink-2">
          Căn cứ: {ketQua.can_cu.map((u) => nhanVienDan(u)).join("; ")}
        </p>
      ) : null}
    </div>
  );
}
