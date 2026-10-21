/**
 * Đua thời gian 60 giây (docs/PLAN.md GĐ10). Chạm một phương án là gửi chấm ngay, hiện đúng/sai
 * trong chốc lát rồi sang câu tiếp. Đồng hồ trên màn hình chỉ để xem: máy chủ tính giờ từ lúc tạo
 * phiên và không nhận câu trả lời sau 60 giây cộng dung sai.
 *
 * Không có hộp kết quả mỗi câu (GĐ17b, H3): nhịp 350 ms giữ nguyên. Giải thích và căn cứ của từng câu
 * (máy chủ đã trả khi chấm) được giữ lại; màn kết thúc liệt kê các câu chưa đúng, mỗi câu một phần
 * "Xem chi tiết" thu gọn.
 */
import { useEffect, useState } from "react";
import { Form, type ShouldRevalidateFunctionArgs, useFetcher, useNavigation } from "react-router";

import { HienThiCauHoi } from "../components/cau-hoi/HienThiCauHoi";
import { ChiTietKetQua } from "../components/tro-choi/chung/ChiTietKetQua";
import { DongHoNguoc } from "../components/tro-choi/DongHoNguoc";
import { KhungGame } from "../components/tro-choi/KhungGame";
import { Button, ButtonLink } from "../components/ui/Button";
import { Notice } from "../components/ui/Field";
import { cn } from "../lib/cn";
import { dapAnNgan } from "../lib/ket-qua-cau";
import { ketThuc, layPhien, traLoi } from "../lib/luyen-tap.server";
import type { DapAnCauHoi, DeCauHoi, TraLoiCauHoi } from "../lib/ngan-hang";
import { LoiApi } from "../lib/quan-tri.server";
import { yeuCauDangNhap } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import { batDauDua, kyLucDua } from "../lib/tro-choi.server";
import type { Route } from "./+types/tro-choi.dua-thoi-gian";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Đua thời gian", { index: false });
}

export async function loader({ request }: Route.LoaderArgs) {
  const { token } = await yeuCauDangNhap(request);
  return { kyLuc: await kyLucDua(token) };
}

/** Trả lời từng câu không cần tải lại kỷ lục: chỉ tải lại khi bắt đầu hoặc kết thúc lượt. */
export function shouldRevalidate({ formData, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  return formData?.get("intent") === "tra-loi" ? false : defaultShouldRevalidate;
}

export async function action({ request }: Route.ActionArgs) {
  const { token } = await yeuCauDangNhap(request);
  const f = await request.formData();
  const intent = String(f.get("intent") ?? "");
  const id = String(f.get("id") ?? "");
  try {
    if (intent === "bat-dau") {
      const bd = await batDauDua(token);
      const phien = await layPhien(token, bd.id);
      return {
        batDau: {
          id: bd.id,
          thoiLuongMs: new Date(bd.han).getTime() - new Date(bd.bat_dau).getTime(),
          cau: phien.cau.map((c) => ({ stt: c.stt, de: c.de })),
        },
      };
    }
    if (intent === "tra-loi") {
      const kq = await traLoi(token, id, {
        stt: Number(f.get("stt")),
        tra_loi: JSON.parse(String(f.get("tra_loi") ?? "{}")) as TraLoiCauHoi,
      });
      return {
        traLoi: { stt: kq.stt, dung: kq.dung, dapAn: kq.dap_an, giaiThich: kq.giai_thich, canCu: kq.can_cu },
      };
    }
    if (intent === "ket-thuc") {
      const kq = await ketThuc(token, id);
      return { ketThuc: kq.tro_choi?.ma === "dua_thoi_gian" ? kq.tro_choi : null };
    }
    return { loi: "Thao tác không hợp lệ." };
  } catch (err) {
    // 409 "Hết giờ" từ máy chủ cũng rơi vào đây: câu đó không được tính, lượt kết thúc.
    if (err instanceof LoiApi) return { loi: err.message, hetGio: err.status === 409 };
    throw err;
  }
}

type BatDau = {
  id: string;
  thoiLuongMs: number;
  cau: Array<{ stt: number; de: DeCauHoi }>;
};

/** Một câu trả lời chưa đúng, giữ lại để xem ở màn kết thúc. */
type CauSai = { stt: number; de: DeCauHoi; dapAn: DapAnCauHoi; giaiThich: string | null; canCu: string[] };

export default function DuaThoiGian({ loaderData, actionData }: Route.ComponentProps) {
  const { kyLuc } = loaderData;
  const dangBatDau = useNavigation().state !== "idle";
  const batDau = actionData && "batDau" in actionData ? (actionData.batDau as BatDau) : null;

  if (!batDau) {
    return (
      <KhungGame tieuDe="Đua thời gian 60 giây">
        <p className="text-[15px] leading-relaxed text-ink-2">
          Trả lời đúng nhiều câu nhất trong 60 giây. Chạm một phương án là chấm ngay, không có nút kiểm tra.
        </p>
        <div className="mt-6 rounded-xl border border-line bg-surface p-5 text-center">
          <p className="text-sm text-ink-2">Kỷ lục của bạn</p>
          <p className="mt-1 text-4xl font-semibold">{kyLuc.ky_luc ?? "–"}</p>
          <p className="mt-1 text-sm text-ink-2">{kyLuc.so_van} lượt đã chơi</p>
        </div>
        {actionData && "loi" in actionData ? (
          <Notice tone="danger" className="mt-4">
            {actionData.loi}
          </Notice>
        ) : null}
        <Form method="post" className="mt-6">
          <input type="hidden" name="intent" value="bat-dau" />
          <Button type="submit" className="min-h-12 w-full text-base" disabled={dangBatDau}>
            Bắt đầu
          </Button>
        </Form>
      </KhungGame>
    );
  }
  // key theo id phiên: "Chơi lại" dựng lượt mới từ đầu.
  return <LuotDua key={batDau.id} batDau={batDau} />;
}

function LuotDua({ batDau }: { batDau: BatDau }) {
  const fTraLoi = useFetcher<typeof action>();
  const fKetThuc = useFetcher<typeof action>();
  const [viTri, datViTri] = useState(0);
  const [soDung, datSoDung] = useState(0);
  const [loe, datLoe] = useState<"dung" | "sai" | null>(null);
  const [xong, datXong] = useState(false);
  const [cauSai, datCauSai] = useState<CauSai[]>([]);

  const ketThucLuot = () => {
    if (xong) return;
    datXong(true);
    fKetThuc.submit({ intent: "ket-thuc", id: batDau.id }, { method: "post" });
  };

  // Nhận kết quả chấm: lóe màu 350 ms rồi sang câu tiếp; hết câu hoặc máy chủ báo hết giờ thì kết thúc.
  // biome-ignore lint/correctness/useExhaustiveDependencies: chỉ phản ứng khi có kết quả chấm mới
  useEffect(() => {
    const d = fTraLoi.data;
    if (!d || fTraLoi.state !== "idle") return;
    if ("traLoi" in d && d.traLoi) {
      const { stt, dung, dapAn, giaiThich, canCu } = d.traLoi;
      if (dung) datSoDung((n) => n + 1);
      else {
        const de = batDau.cau.find((c) => c.stt === stt)?.de;
        if (de)
          datCauSai((ds) =>
            ds.some((c) => c.stt === stt) ? ds : [...ds, { stt, de, dapAn, giaiThich, canCu }],
          );
      }
      datLoe(dung ? "dung" : "sai");
      const t = window.setTimeout(() => {
        datLoe(null);
        if (viTri + 1 >= batDau.cau.length) ketThucLuot();
        else datViTri((i) => i + 1);
      }, 350);
      return () => window.clearTimeout(t);
    }
    if ("loi" in d) ketThucLuot();
  }, [fTraLoi.data, fTraLoi.state]);

  const kq = fKetThuc.data && "ketThuc" in fKetThuc.data ? fKetThuc.data.ketThuc : null;

  if (xong) {
    return (
      <KhungGame tieuDe="Đua thời gian 60 giây">
        <div className="rounded-xl border border-line bg-surface p-6 text-center" role="status">
          {!kq ? (
            <p className="text-ink-2">Đang tính điểm.</p>
          ) : (
            <>
              <p className="text-sm text-ink-2">Số câu đúng</p>
              <p className="mt-1 text-5xl font-semibold">{kq.diem}</p>
              <p className={cn("mt-2 text-lg", kq.pha_ky_luc ? "font-semibold text-ok" : "text-ink-2")}>
                {kq.pha_ky_luc ? "Kỷ lục mới." : `Kỷ lục: ${kq.ky_luc}`}
              </p>
              {kq.xp > 0 ? <p className="mt-1 text-sm text-primary">+{kq.xp} XP</p> : null}
            </>
          )}
        </div>
        {cauSai.length ? (
          <section aria-labelledby="cau-sai" className="mt-6">
            <h2 id="cau-sai" className="font-sans text-lg font-semibold">
              Câu chưa đúng
            </h2>
            <ol className="mt-3 grid gap-3">
              {cauSai.map((c) => {
                const dapAn = dapAnNgan(c.de, { dap_an: c.dapAn });
                return (
                  <li key={c.stt} className="rounded-xl border border-line bg-surface p-4">
                    <p className="text-sm text-ink-2">
                      Câu {batDau.cau.findIndex((x) => x.stt === c.stt) + 1}
                    </p>
                    <p className="mt-1 text-base">{c.de.stem}</p>
                    {dapAn ? (
                      <p className="mt-2 text-base">
                        Đáp án: <span className="font-semibold">{dapAn}</span>
                      </p>
                    ) : null}
                    <div className="mt-3">
                      <ChiTietKetQua ketQua={{ giai_thich: c.giaiThich, can_cu: c.canCu }} />
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}
        <div className="mt-6 grid gap-3">
          <Form method="post">
            <input type="hidden" name="intent" value="bat-dau" />
            <Button type="submit" className="min-h-12 w-full text-base">
              Chơi lại
            </Button>
          </Form>
          <ButtonLink to="/tro-choi" variant="secondary" className="min-h-12 w-full text-base">
            Trò chơi khác
          </ButtonLink>
        </div>
      </KhungGame>
    );
  }

  const cau = batDau.cau[viTri]!;
  return (
    <KhungGame
      tieuDe="Đua thời gian 60 giây"
      benPhai={
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold" aria-live="polite">
            Đúng {soDung}
          </span>
          <DongHoNguoc thoiLuongMs={batDau.thoiLuongMs} onHetGio={ketThucLuot} />
        </span>
      }
    >
      <div
        className={cn(
          "rounded-xl p-1 transition-colors motion-reduce:transition-none",
          loe === "dung" && "bg-ok-soft",
          loe === "sai" && "bg-danger-soft",
        )}
      >
        <p className="mb-2 text-sm text-ink-2">Câu {viTri + 1}</p>
        <HienThiCauHoi
          key={cau.stt}
          de={cau.de}
          traLoi={{}}
          idGoc={`dua-${cau.stt}`}
          khoa={fTraLoi.state !== "idle" || loe !== null}
          onChange={(t) =>
            fTraLoi.submit(
              { intent: "tra-loi", id: batDau.id, stt: String(cau.stt), tra_loi: JSON.stringify(t) },
              { method: "post" },
            )
          }
        />
      </div>
      <p className="mt-2 h-6 text-center font-semibold" aria-live="assertive">
        {loe === "dung" ? (
          <span className="text-ok">Đúng</span>
        ) : loe === "sai" ? (
          <span className="text-danger">Sai</span>
        ) : null}
      </p>
    </KhungGame>
  );
}
