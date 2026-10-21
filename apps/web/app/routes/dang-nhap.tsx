import { useEffect, useRef } from "react";
import { Form, Link, useNavigation, useSubmit } from "react-router";

import { Button, ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Label, Notice } from "../components/ui/Field";
import { LogoHocTap } from "../components/ui/LogoHocTap";
import { OCoIcon } from "../components/ui/OCoIcon";
import {
  cauHinhDangNhap,
  cookieDangNhap,
  dangNhapDemo,
  dangNhapMatKhau,
  doiIdTokenLayPhien,
  type KetQuaDangNhap,
  LoiDangNhap,
  layToken,
  nguoiDungHienTai,
} from "../lib/auth.server";
import { pageMeta, SITE_NAME, SITE_TAGLINE } from "../lib/site";
import type { Route } from "./+types/dang-nhap";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Đăng nhập", { index: false });
}

/** Chỉ nhận đường dẫn nội bộ: ?tiep= đến từ URL nên không được tin (chống chuyển hướng mở). */
function noiDenAnToan(raw: string | null): string {
  if (!raw?.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
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
  return { tiep, nguoiDung, cauHinh: nguoiDung ? null : await cauHinhDangNhap() };
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
      const dich = phien.phai_doi_mat_khau ? `/doi-mat-khau?tiep=${encodeURIComponent(tiep)}` : tiep;
      return chuyenKemPhien(request, phien, dich);
    }
    if (form.get("intent") === "demo") {
      const vaiTro = form.get("vai_tro") === "quan_tri" ? "quan_tri" : "hoc_vien";
      return chuyenKemPhien(
        request,
        await dangNhapDemo(String(form.get("mat_khau") ?? ""), vaiTro, tokenKhach),
        tiep,
      );
    }

    const credential = String(form.get("credential") ?? "");
    if (!credential) return { loi: "Không nhận được thông tin đăng nhập từ Google. Hãy thử lại." };
    const phien = await doiIdTokenLayPhien(credential, tokenKhach);
    // Người đầu tiên của hệ thống được cấp quyền quản trị: trang tài khoản nói rõ điều đó.
    return chuyenKemPhien(
      request,
      phien,
      phien.la_quan_tri_dau_tien ? "/tai-khoan?quan-tri-dau-tien=1" : tiep,
    );
  } catch (e) {
    if (e instanceof LoiDangNhap) return { loi: e.message };
    throw e;
  }
}

declare global {
  interface Window {
    // Thư viện Google Identity Services không có kiểu.
    google?: any;
  }
}

/** Nạp Google Identity Services rồi vẽ nút đăng nhập vào `target`. */
function useGoogleButton(clientId: string, tiep: string) {
  const target = useRef<HTMLDivElement>(null);
  const submit = useSubmit();

  useEffect(() => {
    if (!clientId || !target.current) return;
    let cancelled = false;

    function render() {
      if (cancelled || !window.google?.accounts?.id || !target.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (res: { credential?: string }) => {
          if (res.credential) submit({ credential: res.credential, tiep }, { method: "post" });
        },
      });
      window.google.accounts.id.renderButton(target.current, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        locale: "vi",
        width: 300,
      });
    }

    if (window.google?.accounts?.id) {
      render();
    } else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = render;
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
    };
  }, [clientId, tiep, submit]);

  return target;
}

export default function DangNhap({ loaderData, actionData }: Route.ComponentProps) {
  const { tiep, nguoiDung, cauHinh } = loaderData;
  const googleButton = useGoogleButton(cauHinh?.da_cau_hinh ? cauHinh.google_client_id : "", tiep);
  const busy = useNavigation().state === "submitting";

  return (
    <div className="wrap flex max-w-md flex-col items-center py-12">
      {/* Trang này không có thanh đầu trang: logo đứng trên, tên và dòng phụ căn giữa bên dưới. */}
      <Link to="/" className="flex flex-col items-center gap-3 text-center">
        <LogoHocTap className="h-20 w-auto" />
        <span className="flex flex-col gap-1">
          <span className="font-display text-xl font-bold uppercase leading-tight text-primary">
            {SITE_NAME}
          </span>
          <span className="text-xs uppercase tracking-[0.14em] leading-tight text-ink-2">
            {SITE_TAGLINE}
          </span>
        </span>
      </Link>

      {nguoiDung ? (
        <Card className="mt-8 w-full text-center">
          <h1 className="text-2xl font-semibold">Đã đăng nhập</h1>
          <p className="mt-2 text-sm text-ink-2">
            {nguoiDung.ten ?? nguoiDung.email} · {nguoiDung.mo_ta_vai_tro}
          </p>
          <ButtonLink to="/" className="mt-6">
            Về trang chủ
          </ButtonLink>
        </Card>
      ) : (
        <Card className="mt-8 w-full">
          <h1 className="text-2xl font-semibold">Đăng nhập</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            {cauHinh?.da_cau_hinh
              ? "Dùng email đã đăng ký hoặc tên đăng nhập do quản trị viên đơn vị cấp, hoặc tài khoản Google."
              : "Dùng email đã đăng ký hoặc tên đăng nhập do quản trị viên đơn vị cấp."}{" "}
            Tra cứu văn bản không cần đăng nhập.
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

          {/* Chưa đặt GOOGLE_CLIENT_ID thì ẩn hẳn: người dùng không làm gì được với thông báo cấu hình. */}
          {cauHinh?.da_cau_hinh ? (
            <div className="mt-6">
              <div className="flex items-center gap-3 text-xs text-ink-3">
                <span className="h-px flex-1 bg-line" />
                hoặc
                <span className="h-px flex-1 bg-line" />
              </div>
              <div ref={googleButton} className="mt-4 flex min-h-11 justify-center" />
              <noscript>
                <p className="text-center text-sm text-ink-2">Đăng nhập bằng Google cần bật JavaScript.</p>
              </noscript>
              {cauHinh.mien_gioi_han ? (
                <p className="mt-3 text-center text-xs text-ink-3">
                  Chỉ nhận tài khoản thuộc miền: {cauHinh.mien_gioi_han.join(", ")}
                </p>
              ) : null}
              <p className="mt-3 text-center text-xs leading-relaxed text-ink-3">
                Với tài khoản Google, hệ thống chỉ lưu email, tên và ảnh đại diện để phân quyền và ghi nhật
                ký.
              </p>
            </div>
          ) : null}

          {cauHinh?.demo ? (
            <details className="mt-6 border-t border-line pt-4">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-ink-2">
                Tài khoản demo
              </summary>
              <div className="pb-2">
                <Form method="post" className="mt-3">
                  <input type="hidden" name="intent" value="demo" />
                  <input type="hidden" name="tiep" value={tiep} />
                  <fieldset>
                    <legend className="font-semibold">Vai trò</legend>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {[
                        { value: "hoc_vien", label: "Học viên" },
                        { value: "quan_tri", label: "Quản trị" },
                      ].map((r, i) => (
                        <label
                          key={r.value}
                          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line-strong px-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
                        >
                          <input type="radio" name="vai_tro" value={r.value} defaultChecked={i === 0} />
                          {r.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <Label htmlFor="mat-khau-demo" className="mt-4">
                    Mật khẩu demo
                  </Label>
                  <Input id="mat-khau-demo" name="mat_khau" type="password" required autoComplete="off" />
                  <Button type="submit" variant="secondary" className="mt-4 w-full" disabled={busy}>
                    Đăng nhập bằng tài khoản demo
                  </Button>
                </Form>
              </div>
            </details>
          ) : null}
        </Card>
      )}
    </div>
  );
}
