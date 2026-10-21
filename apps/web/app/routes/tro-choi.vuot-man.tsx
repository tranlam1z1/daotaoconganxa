/**
 * Bản đồ màn của một chủ đề (docs/PLAN.md GĐ10). Bấm màn đang mở thì vào chơi bằng màn hình
 * luyện tập (mỗi câu một màn hình, câu trước/câu sau, nộp bài); chơi xong trang phiên chuyển về đây,
 * kèm kết quả màn vừa chơi trên URL (`?man=&dung=&tong=&sao=&dat=&xp=&phien=`). Trong lúc chơi
 * không báo đúng/sai; xem lại từng câu ở trang kết quả của phiên.
 */
import { Link, redirect, useNavigation } from "react-router";

import { BanDoMan } from "../components/tro-choi/BanDoMan";
import { KhungGame, Sao } from "../components/tro-choi/KhungGame";
import { Notice } from "../components/ui/Field";
import { cn } from "../lib/cn";
import { khongTimThay, LoiApi } from "../lib/quan-tri.server";
import { yeuCauDangNhap } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import { banDoMan, batDauMan } from "../lib/tro-choi.server";
import type { Route } from "./+types/tro-choi.vuot-man";

export function meta({ data }: Route.MetaArgs) {
  return pageMeta(data ? `Vượt màn: ${data.chu_de.name}` : "Vượt màn", { index: false });
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { token } = await yeuCauDangNhap(request);
  const bd = await banDoMan(token, params.chuDe).catch(khongTimThay);
  // Kết quả màn vừa chơi, do trang phiên chuyển về kèm theo (lấy từ phản hồi kết thúc phiên).
  const q = new URL(request.url).searchParams;
  const so = (k: string) => Number(q.get(k));
  const man = so("man");
  const ketQua =
    Number.isInteger(man) && man >= 1 && so("tong") > 0
      ? {
          man,
          dung: so("dung"),
          tong: so("tong"),
          sao: Math.min(3, Math.max(0, so("sao") || 0)),
          xp: so("xp") || 0,
          dat: q.get("dat") === "1",
          // Phiên vừa chơi, để xem lại đúng/sai từng câu ở trang kết quả luyện tập.
          phien: /^[0-9a-f-]{36}$/i.test(q.get("phien") ?? "") ? q.get("phien") : null,
          moManSau: bd.man.find((m) => m.thu_tu === man + 1)?.mo ?? false,
        }
      : null;
  return { ...bd, ketQua };
}

export async function action({ request }: Route.ActionArgs) {
  const { token } = await yeuCauDangNhap(request);
  const f = await request.formData();
  try {
    const { id } = await batDauMan(token, String(f.get("man") ?? ""));
    return redirect(`/luyen-tap/${id}?cau=1`);
  } catch (err) {
    if (err instanceof LoiApi) return { loi: err.message };
    throw err;
  }
}

export default function VuotMan({ loaderData, actionData }: Route.ComponentProps) {
  const { chu_de, man, ketQua } = loaderData;
  const dangMo = useNavigation().state !== "idle";
  const daQua = man.filter((m) => m.qua).length;
  const tongSao = man.reduce((s, m) => s + m.sao, 0);

  return (
    <KhungGame
      tieuDe={chu_de.name}
      benPhai={
        <span className="text-sm text-ink-2">
          {daQua}/{man.length} màn · {tongSao} sao
        </span>
      }
    >
      {ketQua ? (
        <div
          role="status"
          className={cn(
            "mb-4 rounded-xl border-l-4 px-4 py-3",
            ketQua.dat ? "border-ok bg-ok-soft" : "border-warn bg-warn-soft",
          )}
        >
          <p className="font-semibold">
            Màn {ketQua.man}: đúng {ketQua.dung}/{ketQua.tong} câu
          </p>
          <p className="mt-1">
            <Sao so={ketQua.sao} lon />
          </p>
          <p className="mt-1 text-[15px]">
            {ketQua.dat
              ? ketQua.moManSau
                ? `Đã mở màn ${ketQua.man + 1}.`
                : "Đã qua màn."
              : `Cần đúng từ ${Math.ceil(ketQua.tong * 0.8)} câu để qua màn. Chơi lại để mở màn tiếp theo.`}
            {ketQua.xp > 0 ? ` +${ketQua.xp} XP.` : ""}
          </p>
          {ketQua.phien ? (
            <p className="mt-2">
              <Link
                to={`/luyen-tap/${ketQua.phien}/ket-qua`}
                className="inline-flex min-h-11 items-center font-medium text-primary underline"
              >
                Xem lại từng câu
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      {actionData?.loi ? (
        <Notice tone="danger" className="mb-4">
          {actionData.loi}
        </Notice>
      ) : null}

      <BanDoMan man={man} dangMo={dangMo} />
    </KhungGame>
  );
}
