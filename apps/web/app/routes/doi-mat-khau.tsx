/**
 * Đổi mật khẩu (docs/PLAN.md GĐ2). Tài khoản đang dùng mật khẩu tạm bị root.tsx chuyển về
 * đây từ mọi trang; đổi xong thì đi tiếp tới trang định mở, mặc định là trang chủ.
 */
import { Form, redirect, useNavigation } from "react-router";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Label, Notice } from "../components/ui/Field";
import { KhungTrang, TieuDeTrang } from "../components/ui/KhungTrang";
import { doiMatKhau, LoiDangNhap } from "../lib/auth.server";
import { yeuCauDangNhap } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/doi-mat-khau";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Đổi mật khẩu", { index: false });
}

function noiDenAnToan(raw: string | null): string {
  if (!raw?.startsWith("/") || raw.startsWith("//") || raw.startsWith("/doi-mat-khau")) return "/";
  return raw;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { nguoiDung } = await yeuCauDangNhap(request, { choPhepChoXacMinh: true });
  // Tài khoản Google không có mật khẩu trong hệ thống.
  if (!nguoiDung.ten_dang_nhap) throw redirect("/tai-khoan");
  return {
    batBuoc: Boolean(nguoiDung.phai_doi_mat_khau),
    tiep: noiDenAnToan(new URL(request.url).searchParams.get("tiep")),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { token } = await yeuCauDangNhap(request, { choPhepChoXacMinh: true });
  const form = await request.formData();
  const cu = String(form.get("mat_khau_cu") ?? "");
  const moi = String(form.get("mat_khau_moi") ?? "");
  if (moi !== String(form.get("nhap_lai") ?? "")) return { loi: "Hai lần nhập mật khẩu mới không khớp." };
  try {
    await doiMatKhau(token, cu, moi);
  } catch (e) {
    if (e instanceof LoiDangNhap) return { loi: e.message };
    throw e;
  }
  throw redirect(noiDenAnToan(String(form.get("tiep") ?? "")));
}

export default function DoiMatKhau({ loaderData, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state === "submitting";
  return (
    <KhungTrang className="wrap max-w-md py-12">
      <Card>
        <TieuDeTrang icon="user" className="">
          Đổi mật khẩu
        </TieuDeTrang>
        {loaderData.batBuoc ? (
          <Notice className="mt-4">
            Tài khoản đang dùng mật khẩu tạm do quản trị viên cấp. Đặt mật khẩu mới để tiếp tục sử dụng hệ
            thống.
          </Notice>
        ) : null}
        {actionData?.loi ? (
          <Notice tone="danger" className="mt-4">
            {actionData.loi}
          </Notice>
        ) : null}

        <Form method="post" className="mt-6">
          <input type="hidden" name="tiep" value={loaderData.tiep} />
          <Label htmlFor="mk-cu">{loaderData.batBuoc ? "Mật khẩu tạm" : "Mật khẩu hiện tại"}</Label>
          <Input id="mk-cu" name="mat_khau_cu" type="password" required autoComplete="current-password" />
          <Label htmlFor="mk-moi" className="mt-4">
            Mật khẩu mới
          </Label>
          <Input
            id="mk-moi"
            name="mat_khau_moi"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            aria-describedby="mk-quy-tac"
          />
          <p id="mk-quy-tac" className="mt-1.5 text-sm text-ink-3">
            Tối thiểu 8 ký tự, có cả chữ và chữ số.
          </p>
          <Label htmlFor="mk-nhap-lai" className="mt-4">
            Nhập lại mật khẩu mới
          </Label>
          <Input id="mk-nhap-lai" name="nhap_lai" type="password" required autoComplete="new-password" />
          <Button type="submit" className="mt-6 min-h-12 w-full text-base" disabled={busy}>
            {busy ? "Đang lưu" : "Lưu mật khẩu mới"}
          </Button>
        </Form>
      </Card>
    </KhungTrang>
  );
}
