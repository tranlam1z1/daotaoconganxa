/**
 * Trang đích của liên kết mời `/nhom/tham-gia/:ma` (docs/PLAN.md GĐ16b). Chưa đăng nhập thì chuyển
 * sang đăng nhập rồi quay lại đây. Đã ở trong nhóm thì mở thẳng nhóm.
 */
import { Form, Link, redirect, useNavigation } from "react-router";

import { Button, buttonClass } from "../components/ui/Button";
import { Notice } from "../components/ui/Field";
import { CAU_QUYEN_RIENG_TU } from "../lib/nhom";
import { thamGiaNhom, xemTruocNhom } from "../lib/nhom.server";
import { LoiApi } from "../lib/quan-tri.server";
import { yeuCauDangNhap } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/nhom.tham-gia";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Tham gia nhóm học cùng", { index: false });
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { token } = await yeuCauDangNhap(request);
  try {
    const xemTruoc = await xemTruocNhom(token, params.ma);
    if (xemTruoc.da_la_thanh_vien) throw redirect(`/nhom/${xemTruoc.id}`);
    return { xemTruoc, loi: null };
  } catch (err) {
    if (err instanceof LoiApi) return { xemTruoc: null, loi: err.message };
    throw err;
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { token } = await yeuCauDangNhap(request);
  try {
    const { id } = await thamGiaNhom(token, params.ma);
    return redirect(`/nhom/${id}`);
  } catch (err) {
    if (err instanceof LoiApi) return { loi: err.message };
    throw err;
  }
}

export default function ThamGiaNhom({ loaderData, actionData }: Route.ComponentProps) {
  const { xemTruoc } = loaderData;
  const loi = actionData?.loi ?? loaderData.loi;
  const dangGui = useNavigation().state !== "idle";

  return (
    <div className="wrap max-w-xl py-8" data-nhom="">
      <h1 className="text-3xl font-semibold">Tham gia nhóm học cùng</h1>
      {loi ? (
        <Notice tone="danger" className="mt-4">
          {loi}
        </Notice>
      ) : null}
      {xemTruoc ? (
        <div className="mt-6 grid gap-4 rounded-xl border border-line bg-surface p-5">
          <div>
            <p className="break-words text-xl font-semibold">{xemTruoc.ten}</p>
            <p className="mt-1 text-sm text-ink-2">
              Trưởng nhóm: {xemTruoc.truong_nhom} · {xemTruoc.so_thanh_vien} thành viên
            </p>
          </div>
          {xemTruoc.trang_thai === "luu_tru" ? (
            <p className="text-base text-ink-2">Nhóm đã lưu trữ, không nhận thêm thành viên.</p>
          ) : (
            <Form method="post" className="grid gap-4">
              <p className="text-base leading-relaxed text-ink-2">{CAU_QUYEN_RIENG_TU}</p>
              <Button type="submit" size="lg" disabled={dangGui} className="w-full">
                {dangGui ? "Đang tham gia" : "Tham gia nhóm"}
              </Button>
            </Form>
          )}
        </div>
      ) : null}
      <p className="mt-6">
        <Link to="/nhom" className={buttonClass({ size: "lg", variant: "ghost" })}>
          Về danh sách nhóm của tôi
        </Link>
      </p>
    </div>
  );
}
