import { Form, Link, useNavigation } from "react-router";
import { BrandName } from "../components/ui/BrandName";
import { Button, ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Label, Notice } from "../components/ui/Field";
import { KhungTrang, TieuDeTrang } from "../components/ui/KhungTrang";
import { LogoHocTap } from "../components/ui/LogoHocTap";
import { OCoIcon } from "../components/ui/OCoIcon";
import {
  cookieDangNhap,
  dangNhapMatKhau,
  type KetQuaDangNhap,
  LoiDangNhap,
  layToken,
  nguoiDungHienTai,
} from "../lib/auth.server";
import { duVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/dang-nhap";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Đăng nhập", { index: false });
}

/** Chỉ nhận đường dẫn nội bộ: ?tiep= đến từ URL nên không được tin (chống chuyển hướng mở). */
function noiDenAnToan(raw: string | null): string {
  if (!raw?.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

/** Không có ?tiep= riêng: tài khoản vào được khu quản trị (lãnh đạo trở lên) đi thẳng tới /quan-tri. */
function noiDenSauDangNhap(tiep: string, nguoiDung: { vai_tro: string }): string {
  return tiep === "/" && duVaiTro(nguoiDung, "lanh_dao") ? "/quan-tri" : tiep;
}

function chuyenKemPhien(request: Request, phien: KetQuaDangNhap, dich: string): Response {
  return new Response(null, {
    status: 302,
    headers: { location: dich, "set-cookie": cookieDangNhap(request, phien.token, phien.het_han) },
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  const tiep = noiDenAnToan(new URL(request.url).searchParams.get("tiep"));
  const nguoiDung = await nguoiDungHienTai(request);
  return { tiep, nguoiDung, vaoQuanTri: duVaiTro(nguoiDung, "lanh_dao") };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const tiep = noiDenAnToan(String(form.get("tiep") ?? ""));
  // Phiên còn sót trên máy: là phiên của một tài khoản khách cũ (chế độ khách đã tắt) thì API gộp
  // tiến độ khách vào tài khoản vừa đăng nhập.
  const tokenKhach = layToken(request);

  try {
    if (form.get("intent") === "mat_khau") {
      const phien = await dangNhapMatKhau(
        String(form.get("ten_dang_nhap") ?? ""),
        String(form.get("mat_khau") ?? ""),
        tokenKhach,
      );
      // Mật khẩu tạm (lần đầu, hoặc vừa được đặt lại) phải đổi trước khi vào hệ thống.
      const noiDen = noiDenSauDangNhap(tiep, phien);
      const dich = phien.phai_doi_mat_khau ? `/doi-mat-khau?tiep=${encodeURIComponent(noiDen)}` : noiDen;
      return chuyenKemPhien(request, phien, dich);
    }
    return { loi: "Phương thức đăng nhập không được hỗ trợ." };
  } catch (e) {
    if (e instanceof LoiDangNhap) return { loi: e.message };
    throw e;
  }
}

export default function DangNhap({ loaderData, actionData }: Route.ComponentProps) {
  const { tiep, nguoiDung, vaoQuanTri } = loaderData;
  const busy = useNavigation().state === "submitting";

  return (
    <KhungTrang variant="auth" className="wrap flex max-w-md flex-col items-center py-12">
      {/* Trang này không có thanh đầu trang: logo đứng trên, tên và dòng phụ căn giữa bên dưới. */}
      <Link to="/" className="flex flex-col items-center gap-3 text-center">
        <LogoHocTap className="h-20 w-auto" />
        <BrandName />
      </Link>

      {nguoiDung ? (
        <Card className="mt-8 w-full text-center">
          <TieuDeTrang variant="status" icon="user" className="">
            Đã đăng nhập
          </TieuDeTrang>
          <p className="mt-2 text-sm text-ink-2">
            {nguoiDung.ten ?? nguoiDung.email} · {nguoiDung.mo_ta_vai_tro}
          </p>
          <ButtonLink to={vaoQuanTri ? "/quan-tri" : "/"} className="mt-6">
            {vaoQuanTri ? "Vào trang quản trị" : "Về trang chủ"}
          </ButtonLink>
        </Card>
      ) : (
        <Card className="mt-8 w-full">
          <TieuDeTrang variant="status" icon="user" className="">
            Đăng nhập
          </TieuDeTrang>
          <p className="mt-2 text-sm text-ink-2">
            Dùng email đã đăng ký hoặc tên đăng nhập do quản trị viên đơn vị cấp. Tra cứu văn bản không cần
            đăng nhập.
          </p>

          {actionData?.loi ? (
            <Notice tone="danger" className="mt-5">
              {actionData.loi}
            </Notice>
          ) : null}

          <Form method="post" className="mt-6">
            <input type="hidden" name="intent" value="mat_khau" />
            <input type="hidden" name="tiep" value={tiep} />
            <Label htmlFor="ten-dang-nhap">Email hoặc tên đăng nhập</Label>
            <OCoIcon
              id="ten-dang-nhap"
              name="ten_dang_nhap"
              icon="user"
              required
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Nhập email hoặc tên đăng nhập"
            />
            <Label htmlFor="mat-khau" className="mt-4">
              Mật khẩu
            </Label>
            <OCoIcon
              id="mat-khau"
              name="mat_khau"
              type="password"
              icon="lock"
              required
              autoComplete="current-password"
              placeholder="Nhập mật khẩu của bạn"
            />
            <Button type="submit" className="mt-6 min-h-12 w-full text-base" disabled={busy}>
              {busy ? "Đang đăng nhập" : "Đăng nhập"}
            </Button>
          </Form>
          <p className="mt-4 text-sm text-ink-3">
            Quên mật khẩu: liên hệ quản trị viên của đơn vị để được cấp mật khẩu tạm.
          </p>
          <p className="mt-4 text-center text-sm text-ink-2">
            Chưa có tài khoản?{" "}
            <Link
              to={tiep === "/" ? "/dang-ky" : `/dang-ky?tiep=${encodeURIComponent(tiep)}`}
              className="font-semibold text-primary hover:underline"
            >
              Đăng ký
            </Link>
          </p>
        </Card>
      )}
    </KhungTrang>
  );
}
