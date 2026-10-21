/**
 * Lập biên bản (docs/PLAN.md GĐ-G3, GAME_DESIGN §5.3): trang giới thiệu luật chơi và nút "Chơi".
 * Lượt chạy trên khung chung ở /tro-choi/luot/:id: 3 tình huống, mỗi tình huống một biểu mẫu 4 ô.
 */
import { Form, redirect, useNavigation } from "react-router";

import { KhungGame } from "../components/tro-choi/KhungGame";
import { Button } from "../components/ui/Button";
import { Notice } from "../components/ui/Field";
import { batDauLuot } from "../lib/luot-choi.server";
import { LoiApi } from "../lib/quan-tri.server";
import { yeuCauDangNhap } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/tro-choi.lap-bien-ban";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Lập biên bản", { index: false });
}

export async function loader({ request }: Route.LoaderArgs) {
  await yeuCauDangNhap(request);
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const { token } = await yeuCauDangNhap(request);
  try {
    const l = await batDauLuot(token, "lap_bien_ban");
    return redirect(`/tro-choi/luot/${l.id}`);
  } catch (err) {
    if (err instanceof LoiApi) return { loi: err.message };
    throw err;
  }
}

export default function LapBienBan({ actionData }: Route.ComponentProps) {
  const busy = useNavigation().state !== "idle";
  return (
    <KhungGame tieuDe="Lập biên bản">
      <ol className="space-y-2 text-[15px] leading-relaxed text-ink-2">
        <li>1. Mỗi lượt 3 tình huống. Đọc lời kể: ai, phương tiện gì, hành vi gì.</li>
        <li>2. Điền biểu mẫu 4 ô: hành vi vi phạm, điều khoản áp dụng, mức phạt tiền, hình thức bổ sung.</li>
        <li>3. Mỗi ô 25 điểm. Mức phạt đúng khi nằm trong khung tiền của hành vi.</li>
        <li>4. Tình huống có 2 hành vi thì biểu mẫu có 2 dòng; điền theo thứ tự nào cũng được.</li>
        <li>5. Không tính giờ.</li>
      </ol>
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
