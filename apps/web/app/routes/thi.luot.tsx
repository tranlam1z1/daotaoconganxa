/**
 * Làm bài thi (docs/PLAN.md GĐ6): đồng hồ ở đầu trang, mỗi câu một màn hình, lưới số câu,
 * nộp bài có hộp xác nhận.
 *
 * - Mỗi câu trả lời được lưu lên máy chủ ngay (chờ 0,6 giây sau lần sửa cuối, để câu điền chỗ
 *   trống không gửi từng phím). Tải lại trang hay mất mạng rồi mở lại thì thấy đúng câu đã chọn.
 * - Câu đang xem nằm trên URL (?cau=5) nên tải lại trang vẫn ở câu đó.
 * - Hết giờ: trang tự nộp. Máy chủ cũng tự nộp nếu trang đã đóng.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Form, redirect, useNavigate, useNavigation, useSearchParams, useSubmit } from "react-router";
import { HienThiCauHoi } from "../components/cau-hoi/HienThiCauHoi";
import { DongHo } from "../components/thi/DongHo";
import { HopXacNhanNop } from "../components/thi/HopXacNhanNop";
import { LuoiCauHoi } from "../components/thi/LuoiCauHoi";
import { Button } from "../components/ui/Button";
import { Notice } from "../components/ui/Field";
import { KhungTrang } from "../components/ui/KhungTrang";
import { cn } from "../lib/cn";
import type { TraLoiCauHoi } from "../lib/ngan-hang";
import { goiApiQuanTri, khongTimThay, LoiApi } from "../lib/quan-tri.server";
import { yeuCauDangNhap } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { LuotThi } from "../lib/thi";
import type { Route } from "./+types/thi.luot";

export function meta({ data }: Route.MetaArgs) {
  return pageMeta(data?.luot.exam_title ? `Làm bài: ${data.luot.exam_title}` : "Làm bài thi", {
    index: false,
  });
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { token } = await yeuCauDangNhap(request);
  const luot = await goiApiQuanTri<LuotThi>(token, `/v1/thi/luot/${params.id}`).catch(khongTimThay);
  if (luot.trang_thai !== "dang_lam") throw redirect(`/thi/luot/${params.id}/ket-qua`);
  return { luot };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { token } = await yeuCauDangNhap(request);
  try {
    await goiApiQuanTri(token, `/v1/thi/luot/${params.id}/nop`, { method: "POST" });
  } catch (e) {
    if (e instanceof LoiApi) return { loi: e.message };
    throw e;
  }
  throw redirect(`/thi/luot/${params.id}/ket-qua`);
}

function coTraLoi(t: TraLoiCauHoi | null | undefined): boolean {
  if (!t) return false;
  return Boolean(
    t.chon?.length ||
      t.thu_tu?.length ||
      Object.keys(t.cap ?? {}).length ||
      Object.values(t.o_trong ?? {}).some((v) => String(v).trim()) ||
      t.bai_viet?.trim(),
  );
}

type TrangThaiLuu = "da_luu" | "dang_luu" | "loi";

export default function LamBai({ loaderData, actionData }: Route.ComponentProps) {
  const { luot } = loaderData;
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const submit = useSubmit();
  const dangNop = useNavigation().state !== "idle";

  const [traLoi, setTraLoi] = useState<Record<number, TraLoiCauHoi | null>>(() =>
    Object.fromEntries(luot.cau.map((c) => [c.thu_tu, c.tra_loi])),
  );
  const daLam = useMemo(
    () =>
      new Set(
        Object.entries(traLoi)
          .filter(([, t]) => coTraLoi(t))
          .map(([k]) => Number(k)),
      ),
    [traLoi],
  );

  const cauDau = luot.cau.find((c) => !coTraLoi(c.tra_loi))?.thu_tu ?? 1;
  const soTrenUrl = Number(params.get("cau"));
  const dangXem = soTrenUrl >= 1 && soTrenUrl <= luot.so_cau ? soTrenUrl : cauDau;
  const cau = luot.cau[dangXem - 1];

  const [luu, setLuu] = useState<TrangThaiLuu>("da_luu");
  const [moLuoi, setMoLuoi] = useState(false);
  const [moXacNhan, setMoXacNhan] = useState(false);

  /* Lưu tuần tự: một hàng đợi promise, và bộ hẹn giờ chờ theo từng câu. */
  const hangDoi = useRef<Promise<void>>(Promise.resolve());
  const cho = useRef(new Map<number, { timer: number; traLoi: TraLoiCauHoi }>());
  /** Câu gửi thất bại (mất mạng): gửi lại ở lần chuyển câu hoặc nộp bài kế tiếp. */
  const thatBai = useRef(new Map<number, TraLoiCauHoi>());

  const gui = useCallback(
    (thuTu: number, t: TraLoiCauHoi) => {
      hangDoi.current = hangDoi.current.then(async () => {
        setLuu("dang_luu");
        try {
          const res = await fetch(`/thi/luot/${luot.id}/luu`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ thu_tu: thuTu, tra_loi: t }),
          });
          const kq = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; het_gio?: boolean };
          if (kq.het_gio) {
            navigate(`/thi/luot/${luot.id}/ket-qua`, { replace: true });
            return;
          }
          if (kq.ok) thatBai.current.delete(thuTu);
          else thatBai.current.set(thuTu, t);
          setLuu(thatBai.current.size ? "loi" : "da_luu");
        } catch {
          thatBai.current.set(thuTu, t);
          setLuu("loi");
        }
      });
    },
    [luot.id, navigate],
  );

  /** Gửi ngay mọi câu đang chờ, rồi đợi hàng đợi lưu chạy xong. */
  const guiHet = useCallback(async () => {
    for (const [thuTu, v] of cho.current) {
      window.clearTimeout(v.timer);
      gui(thuTu, v.traLoi);
    }
    cho.current.clear();
    const guiLai = [...thatBai.current];
    thatBai.current.clear();
    for (const [thuTu, t] of guiLai) gui(thuTu, t);
    await hangDoi.current;
  }, [gui]);

  const doiTraLoi = (t: TraLoiCauHoi) => {
    setTraLoi((cu) => ({ ...cu, [dangXem]: t }));
    setLuu("dang_luu");
    const cu = cho.current.get(dangXem);
    if (cu) window.clearTimeout(cu.timer);
    const thuTu = dangXem;
    cho.current.set(thuTu, {
      traLoi: t,
      timer: window.setTimeout(() => {
        cho.current.delete(thuTu);
        gui(thuTu, t);
      }, 600),
    });
  };

  const denCau = (n: number) => {
    void guiHet();
    setMoLuoi(false);
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.set("cau", String(n));
        return next;
      },
      { replace: true },
    );
    window.scrollTo({ top: 0 });
  };

  const nop = useCallback(async () => {
    await guiHet();
    submit(null, { method: "post" });
  }, [guiHet, submit]);

  // Hết giờ thì tự nộp, không hỏi lại.
  const hetGio = useCallback(() => void nop(), [nop]);

  // Rời trang khi còn câu chưa lưu thì trình duyệt hỏi lại.
  useEffect(() => {
    const truocKhiRoi = (e: BeforeUnloadEvent) => {
      if (cho.current.size || luu === "dang_luu") e.preventDefault();
    };
    window.addEventListener("beforeunload", truocKhiRoi);
    return () => window.removeEventListener("beforeunload", truocKhiRoi);
  }, [luu]);

  const soChuaLam = luot.so_cau - daLam.size;
  const cauTuLuan = useMemo(
    () => new Set(luot.cau.filter((c) => c.de.kind === "tu_luan").map((c) => c.thu_tu)),
    [luot.cau],
  );

  return (
    <KhungTrang variant="workspace" className="wrap max-w-3xl pb-28">
      <div className="sticky top-16 z-30 -mx-4 border-b border-line bg-canvas/95 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-2">
          <DongHo giayConLai={luot.giay_con_lai} onHetGio={hetGio} />
          <button
            type="button"
            onClick={() => setMoLuoi((v) => !v)}
            aria-expanded={moLuoi}
            aria-controls="luoi-cau"
            className="lun flex min-h-11 items-center rounded-lg px-3 text-[15px] font-medium text-ink-2 hover:bg-surface-2"
          >
            Câu {dangXem}/{luot.so_cau}
            <span className="ml-1 text-sm text-ink-3">({daLam.size} đã làm)</span>
          </button>
          <Button className="ml-auto" onClick={() => setMoXacNhan(true)} disabled={dangNop}>
            Nộp bài
          </Button>
        </div>
        <p
          role="status"
          aria-live="polite"
          className={cn("mt-1 min-h-4 text-xs", luu === "loi" ? "font-semibold text-danger" : "text-ink-3")}
        >
          {luu === "dang_luu"
            ? "Đang lưu câu trả lời"
            : luu === "loi"
              ? "Chưa lưu được câu trả lời. Kiểm tra kết nối mạng; câu trả lời sẽ được gửi lại khi chuyển câu."
              : daLam.size
                ? "Câu trả lời đã được lưu"
                : ""}
        </p>
        {moLuoi ? (
          <div id="luoi-cau" className="mt-2 max-h-[50vh] overflow-y-auto pb-2">
            <LuoiCauHoi
              soCau={luot.so_cau}
              daLam={daLam}
              dangXem={dangXem}
              onChon={denCau}
              tuLuan={cauTuLuan}
            />
          </div>
        ) : null}
      </div>

      <h1 className="sr-only">{luot.exam_title}</h1>
      {dangNop && cauTuLuan.size ? (
        <Notice tone="info" className="mt-4">
          Đang nộp bài và chấm phần tự luận. Việc này mất vài giây, đừng đóng trang.
        </Notice>
      ) : null}
      {actionData?.loi ? (
        <Notice tone="danger" className="mt-4">
          {actionData.loi}
        </Notice>
      ) : null}

      {cau ? (
        <section aria-labelledby="cau-hien-tai" className="mt-6">
          <h2 id="cau-hien-tai" className="font-sans text-sm font-semibold text-ink-3">
            Câu {dangXem}
          </h2>
          <div className="mt-2">
            <HienThiCauHoi
              key={dangXem}
              de={cau.de}
              traLoi={traLoi[dangXem] ?? {}}
              onChange={doiTraLoi}
              idGoc={`cau-${dangXem}`}
            />
          </div>
        </section>
      ) : null}

      <nav aria-label="Chuyển câu" className="mt-8 grid grid-cols-2 gap-3">
        <Button
          variant="secondary"
          className="min-h-12 text-base"
          disabled={dangXem <= 1}
          onClick={() => denCau(dangXem - 1)}
        >
          Câu trước
        </Button>
        {dangXem < luot.so_cau ? (
          <Button className="min-h-12 text-base" onClick={() => denCau(dangXem + 1)}>
            Câu sau
          </Button>
        ) : (
          <Button className="min-h-12 text-base" onClick={() => setMoXacNhan(true)} disabled={dangNop}>
            Nộp bài
          </Button>
        )}
      </nav>

      {/* Nộp không cần JavaScript cũng được: biểu mẫu thật, hộp xác nhận chỉ là lớp bên trên. */}
      <noscript>
        <Form method="post" className="mt-6">
          <Button type="submit">Nộp bài</Button>
        </Form>
      </noscript>

      <HopXacNhanNop
        mo={moXacNhan}
        soChuaLam={soChuaLam}
        dangNop={dangNop}
        onDong={() => setMoXacNhan(false)}
        onNop={() => void nop()}
      />
    </KhungTrang>
  );
}
