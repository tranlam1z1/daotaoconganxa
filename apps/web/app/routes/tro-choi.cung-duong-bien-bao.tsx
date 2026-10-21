/**
 * Cung đường biển báo (docs/PLAN.md GĐ-G8, GAME_DESIGN §5.5): trang giới thiệu luật chơi và nút
 * "Chơi". Lượt chạy trên khung chung ở /tro-choi/luot/:id: 3 câu khởi động đoán biển, rồi đường
 * chạy. "Đoán biển báo" cũ (/tro-choi/doan-bien-bao) chuyển hướng về đây.
 */
import { Form, redirect, useNavigation } from "react-router";

import { KhungGame } from "../components/tro-choi/KhungGame";
import { NutPhanUng } from "../components/tro-choi/NutPhanUng";
import { Button } from "../components/ui/Button";
import { Notice } from "../components/ui/Field";
import { batDauLuot } from "../lib/luot-choi.server";
import { LoiApi } from "../lib/quan-tri.server";
import { yeuCauDangNhap } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/tro-choi.cung-duong-bien-bao";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Cung đường biển báo", { index: false });
}

export async function loader({ request }: Route.LoaderArgs) {
  await yeuCauDangNhap(request);
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const { token } = await yeuCauDangNhap(request);
  try {
    const l = await batDauLuot(token, "cung_duong_bien_bao");
    return redirect(`/tro-choi/luot/${l.id}`);
  } catch (err) {
    if (err instanceof LoiApi) return { loi: err.message };
    throw err;
  }
}

export default function CungDuongBienBao({ actionData }: Route.ComponentProps) {
  const busy = useNavigation().state !== "idle";
  return (
    <KhungGame tieuDe="Cung đường biển báo">
      <ol className="space-y-2 text-[15px] leading-relaxed text-ink-2">
        <li>1. Khởi động: 3 câu đoán tên biển.</li>
        <li>2. Xe tự chạy qua 12 biển. Mỗi biển có vài giây để bấm đúng thao tác, càng về sau càng ngắn.</li>
        <li>3. Có 3 mạng. Bấm sai hoặc bỏ lỡ biển cần phản ứng thì mất một mạng.</li>
        <li>4. Biển chỉ để biết thì bấm "Đi tiếp". Bấm "Giảm tốc" hay "Dừng lại" ở đó không mất mạng.</li>
      </ol>
      <p className="mt-4 text-sm text-ink-2">Bốn thao tác (xem trước, chưa bấm được):</p>
      <div className="mt-2 opacity-70">
        <NutPhanUng onBam={() => {}} khoa />
      </div>
      {actionData && "loi" in actionData ? (
        <Notice tone="danger" className="mt-4">
          {actionData.loi}
        </Notice>
      ) : null}
      <Form method="post" className="mt-6">
        <Button type="submit" className="g-nut w-full" disabled={busy}>
          Chơi
        </Button>
      </Form>
    </KhungGame>
  );
}
