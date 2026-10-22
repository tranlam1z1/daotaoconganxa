/**
 * Một phiên luyện tập (docs/PLAN.md GĐ4): mỗi câu một màn hình, nút "Câu trước"/"Câu sau", lưới số
 * câu và "Nộp bài". Dùng cho luyện theo chủ đề, luyện câu sai, đề ôn tập của nhóm, kiểm
 * tra cuối bài giảng và màn của trò Vượt màn.
 *
 * Trong lúc làm KHÔNG báo đúng/sai: câu trả lời được lưu tạm lên máy chủ (chờ 0,6 giây sau lần sửa
 * cuối), sửa được tới khi nộp. Nộp bài thì máy chủ mới chấm cả phiên; đúng/sai, đáp án, giải thích
 * xem ở trang kết quả. Tải lại trang hay mất mạng rồi mở lại thì thấy đúng các câu đã chọn.
 *
 * Câu đang xem nằm trên URL (?cau=5) nên tải lại trang vẫn ở câu đó. Đổi câu không gọi lại loader.
 */
import { useMemo, useState } from "react";
import {
  Link,
  redirect,
  replace,
  type ShouldRevalidateFunctionArgs,
  useNavigation,
  useSearchParams,
  useSubmit,
} from "react-router";

import { HienThiCauHoi } from "../components/cau-hoi/HienThiCauHoi";
import { ThanhGiongNoiCauHoi } from "../components/giong-noi/ThanhGiongNoiCauHoi";
import { ThanhTienDo } from "../components/luyen-tap/ThanhTienDo";
import { coTraLoi, useLuuTam } from "../components/luyen-tap/useLuuTam";
import { HopXacNhanNop } from "../components/thi/HopXacNhanNop";
import { LuoiCauHoi } from "../components/thi/LuoiCauHoi";
import { Button } from "../components/ui/Button";
import { Notice } from "../components/ui/Field";
import { cn } from "../lib/cn";
import { ketThuc, layPhien } from "../lib/luyen-tap.server";
import type { TraLoiCauHoi } from "../lib/ngan-hang";
import { TEN_MUC_DO } from "../lib/ngan-hang";
import { tenPhienLuyenTap } from "../lib/nhom";
import { khongTimThay, LoiApi } from "../lib/quan-tri.server";
import { yeuCauDangNhap } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/luyen-tap.phien";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Phiên luyện tập", { index: false });
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { token } = await yeuCauDangNhap(request);
  const phien = await layPhien(token, params.phien).catch(khongTimThay);
  if (phien.ket_thuc) throw redirect(`/luyen-tap/${phien.id}/ket-qua`);
  const yeuCau = Number(new URL(request.url).searchParams.get("cau"));
  if (Number.isInteger(yeuCau) && yeuCau >= 1 && yeuCau <= phien.tong) return { phien };
  // Không nêu câu: chuyển tới câu đầu tiên chưa làm (làm hết thì câu cuối, để bấm "Nộp bài").
  const chuaLam = phien.cau.findIndex((c) => !coTraLoi(c.tra_loi));
  // Dựng từ id phiên, không từ request.url: khi điều hướng phía trình duyệt, request.url mang đuôi ".data".
  throw redirect(`/luyen-tap/${phien.id}?cau=${chuaLam >= 0 ? chuaLam + 1 : phien.tong}`);
}

/** Chỉ đổi câu đang xem (?cau=) thì không tải lại phiên: câu trả lời đã nằm trong state của trang. */
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (!formMethod && currentUrl.pathname === nextUrl.pathname && nextUrl.searchParams.has("cau"))
    return false;
  return defaultShouldRevalidate;
}

export async function action({ request, params }: Route.ActionArgs) {
  const { token } = await yeuCauDangNhap(request);
  try {
    await ketThuc(token, params.phien);
    // Nộp xong thì trang đích THAY CHỖ trang làm bài trong lịch sử (replace): phiên đã kết thúc,
    // bấm quay lại mà về trang làm bài thì loader lại đẩy sang kết quả, người dùng bị kẹt.
    return replace(`/luyen-tap/${params.phien}/ket-qua`);
  } catch (err) {
    if (err instanceof LoiApi) return { loi: err.message };
    throw err;
  }
}

export default function PhienLuyenTap({ loaderData, actionData }: Route.ComponentProps) {
  const { phien } = loaderData;
  const [params, setParams] = useSearchParams();
  const submit = useSubmit();
  const dangNop = useNavigation().state !== "idle";

  const soTrenUrl = Number(params.get("cau"));
  const stt = Number.isInteger(soTrenUrl) && soTrenUrl >= 1 && soTrenUrl <= phien.tong ? soTrenUrl : 1;
  const cau = phien.cau[stt - 1]!;
  // Câu đã chấm từ trước (phiên làm dở từ bản cũ, khi còn chấm từng câu): chỉ xem, không sửa.
  const daCham = Boolean(cau.ket_qua);

  const [traLoi, datTraLoi] = useState<Record<number, TraLoiCauHoi>>(() =>
    Object.fromEntries(phien.cau.filter((c) => c.tra_loi).map((c) => [c.stt, c.tra_loi!])),
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
  const luuTam = useLuuTam(phien.id, stt);
  const [moLuoi, datMoLuoi] = useState(false);
  const [moXacNhan, datMoXacNhan] = useState(false);
  const [chuaLuuHet, datChuaLuuHet] = useState(false);

  const doiTraLoi = (t: TraLoiCauHoi) => {
    if (daCham) return;
    datTraLoi((cu) => ({ ...cu, [stt]: t }));
    luuTam.doi(stt, t);
  };

  const denCau = (n: number) => {
    void luuTam.guiHet();
    datMoLuoi(false);
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

  const nop = async () => {
    // Chưa lưu được hết (mất mạng) thì không nộp: máy chủ chỉ chấm những gì đã nhận.
    if (!(await luuTam.guiHet())) {
      datChuaLuuHet(true);
      datMoXacNhan(false);
      return;
    }
    datChuaLuuHet(false);
    submit(null, { method: "post" });
  };

  const laCauCuoi = stt === phien.tong;

  return (
    <div className="wrap max-w-xl py-6">
      <p className="text-sm text-ink-2">
        {tenPhienLuyenTap(phien)} · {TEN_MUC_DO[cau.muc_do]}
      </p>
      <div className="mt-2">
        <ThanhTienDo hienTai={stt} tong={phien.tong} daLam={daLam.size} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => datMoLuoi((v) => !v)}
          aria-expanded={moLuoi}
          aria-controls="luoi-cau"
          className="lun flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-ink-2 underline hover:bg-surface-2"
        >
          {moLuoi ? "Ẩn danh sách câu" : "Danh sách câu"}
        </button>
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "ml-auto text-xs",
            luuTam.trangThai === "loi" ? "font-semibold text-danger" : "text-ink-3",
          )}
        >
          {luuTam.trangThai === "dang_luu"
            ? "Đang lưu"
            : luuTam.trangThai === "loi"
              ? "Chưa lưu được, kiểm tra mạng"
              : daLam.size
                ? "Đã lưu"
                : ""}
        </p>
      </div>
      {moLuoi ? (
        <div id="luoi-cau" className="mt-2">
          <LuoiCauHoi soCau={phien.tong} daLam={daLam} dangXem={stt} onChon={denCau} />
        </div>
      ) : null}

      <div className="mt-6">
        <HienThiCauHoi
          key={stt}
          de={cau.de}
          traLoi={traLoi[stt] ?? {}}
          onChange={doiTraLoi}
          khoa={daCham}
          idGoc={`cau-${stt}`}
        />
      </div>

      {/* Đọc câu hỏi và nói đáp án (docs/PLAN.md GĐ14): nói chỉ chọn đáp án, vẫn sửa được tới khi nộp. */}
      {!daCham ? (
        <div className="mt-4">
          <ThanhGiongNoiCauHoi key={stt} de={cau.de} onChon={(id) => doiTraLoi({ chon: [id] })} />
        </div>
      ) : null}

      {luuTam.loi || actionData?.loi ? (
        <Notice tone="danger" className="mt-4">
          {actionData?.loi ?? luuTam.loi}
        </Notice>
      ) : null}
      {chuaLuuHet ? (
        <Notice tone="danger" className="mt-4">
          Chưa lưu được hết câu trả lời nên chưa nộp. Kiểm tra kết nối mạng rồi bấm "Nộp bài" lại.
        </Notice>
      ) : null}

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
          <Button className="min-h-12 text-base" onClick={() => datMoXacNhan(true)} disabled={dangNop}>
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
          disabled={dangNop}
        >
          Nộp bài
        </Button>
      ) : null}

      <p className="mt-6 text-center text-sm">
        <Link to="/luyen-tap" className="inline-flex min-h-11 items-center text-ink-2 underline">
          Tạm dừng, làm tiếp sau
        </Link>
      </p>

      <HopXacNhanNop
        mo={moXacNhan}
        soChuaLam={phien.tong - daLam.size}
        dangNop={dangNop}
        onDong={() => datMoXacNhan(false)}
        onNop={() => void nop()}
      />
    </div>
  );
}
