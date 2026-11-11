/**
 * Tự đăng ký tài khoản. Đăng ký xong là đăng nhập luôn (không gửi email kích hoạt) và tới trang Tài
 * khoản xem trạng thái xác minh. Sau này đăng nhập bằng email và mật khẩu ở /dang-nhap.
 *
 * Người đăng ký khai mã cán bộ (nếu có), cơ quan hoặc tổ chức Đảng, chức danh và chức vụ. Tài khoản chờ quản trị viên
 * hoặc cán bộ quản lý đơn vị xác minh (migration 0064); trong lúc chờ chỉ dùng được trang Tài khoản
 * và các trang tra cứu công khai.
 */
import { Form, Link, redirect, useNavigation } from "react-router";
import { KhaiXacMinh } from "../components/tai-khoan/KhaiXacMinh";
import { BrandName } from "../components/ui/BrandName";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Label, Notice } from "../components/ui/Field";
import { KhungTrang, TieuDeTrang } from "../components/ui/KhungTrang";
import { LogoHocTap } from "../components/ui/LogoHocTap";
import { OCoIcon } from "../components/ui/OCoIcon";
import {
  cookieDangNhap,
  dangKyTaiKhoan,
  danhSachDonViChon,
  LoiDangNhap,
  layToken,
  nguoiDungHienTai,
} from "../lib/auth.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/dang-ky";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Đăng ký tài khoản", { index: false });
}

/** Chỉ nhận đường dẫn nội bộ: ?tiep= đến từ URL nên không được tin (chống chuyển hướng mở). */
function noiDenAnToan(raw: string | null): string {
  if (!raw?.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export async function loader({ request }: Route.LoaderArgs) {
  const tiep = noiDenAnToan(new URL(request.url).searchParams.get("tiep"));
  if (await nguoiDungHienTai(request)) throw redirect(tiep);
  return { tiep, donVi: await danhSachDonViChon() };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const matKhau = String(form.get("mat_khau") ?? "");
  if (matKhau !== String(form.get("nhap_lai") ?? "")) return { loi: "Hai lần nhập mật khẩu không khớp." };

  try {
    const phien = await dangKyTaiKhoan(
      {
        ten: String(form.get("ten") ?? ""),
        email: String(form.get("email") ?? ""),
        so_dien_thoai: String(form.get("so_dien_thoai") ?? ""),
        so_hieu: String(form.get("so_hieu") ?? ""),
        don_vi_id: String(form.get("don_vi_id") ?? ""),
        don_vi_dang_id: String(form.get("don_vi_dang_id") ?? ""),
        cap_bac_chuc_vu: String(form.get("cap_bac_chuc_vu") ?? ""),
        mat_khau: matKhau,
      },
      // Phiên của một tài khoản khách cũ còn sót trên máy (nếu có): API gộp tiến độ vào tài khoản mới.
      layToken(request),
    );
    return new Response(null, {
      status: 302,
      // Tài khoản mới chưa được xác minh: trang định mở chưa dùng được, tới trang Tài khoản.
      headers: { location: "/tai-khoan", "set-cookie": cookieDangNhap(request, phien.token, phien.het_han) },
    });
  } catch (e) {
    if (e instanceof LoiDangNhap) return { loi: e.message };
    throw e;
  }
}

export default function DangKy({ loaderData, actionData }: Route.ComponentProps) {
  const { tiep, donVi } = loaderData;
  const busy = useNavigation().state === "submitting";
  const sauTiep = tiep === "/" ? "" : `?tiep=${encodeURIComponent(tiep)}`;

  return (
    <KhungTrang variant="auth" className="wrap flex max-w-md flex-col items-center py-12">
      {/* Như trang đăng nhập: không có thanh đầu trang, logo đứng trên, tên căn giữa bên dưới. */}
      <Link to="/" className="flex flex-col items-center gap-3 text-center">
        <LogoHocTap className="h-20 w-auto" />
        <BrandName />
      </Link>

      <Card className="mt-8 w-full">
        <TieuDeTrang variant="status" icon="user" className="">
          Đăng ký tài khoản
        </TieuDeTrang>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Dành cho cán bộ, công chức, viên chức và đảng viên đăng ký học tập, luyện tập và thi. Tra cứu văn
          bản không cần đăng nhập.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Tài khoản cần được cán bộ quản lý đơn vị hoặc quản trị viên xác minh. Học, luyện tập và thi mở sau
          khi tài khoản được duyệt.
        </p>

        {actionData?.loi ? (
          <Notice tone="danger" className="mt-5">
            {actionData.loi}
          </Notice>
        ) : null}

        <Form method="post" className="mt-6">
          <input type="hidden" name="tiep" value={tiep} />

          <Label htmlFor="ten">Họ và tên</Label>
          <OCoIcon
            id="ten"
            name="ten"
            icon="user"
            required
            minLength={2}
            maxLength={100}
            autoComplete="name"
            placeholder="Nhập họ và tên của bạn"
          />

          <Label htmlFor="email" className="mt-5">
            Email
          </Label>
          <OCoIcon
            id="email"
            name="email"
            type="email"
            icon="mail"
            required
            maxLength={254}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Nhập email của bạn"
            aria-describedby="email-goi-y"
          />
          <p id="email-goi-y" className="mt-1.5 text-xs text-ink-3">
            Dùng email này để đăng nhập.
          </p>

          <Label htmlFor="so-dien-thoai" className="mt-5">
            Số điện thoại
          </Label>
          <OCoIcon
            id="so-dien-thoai"
            name="so_dien_thoai"
            type="tel"
            icon="phone"
            required
            inputMode="tel"
            maxLength={20}
            autoComplete="tel"
            placeholder="Nhập số điện thoại"
          />

          <KhaiXacMinh donVi={donVi} />

          <Label htmlFor="mat-khau" className="mt-5">
            Mật khẩu
          </Label>
          <OCoIcon
            id="mat-khau"
            name="mat_khau"
            type="password"
            icon="lock"
            required
            minLength={8}
            maxLength={200}
            autoComplete="new-password"
            placeholder="Tạo một mật khẩu"
            aria-describedby="mat-khau-goi-y"
          />
          <p id="mat-khau-goi-y" className="mt-1.5 text-xs text-ink-3">
            Tối thiểu 8 ký tự, có cả chữ và chữ số.
          </p>

          <Label htmlFor="nhap-lai" className="mt-5">
            Xác nhận mật khẩu
          </Label>
          <OCoIcon
            id="nhap-lai"
            name="nhap_lai"
            type="password"
            icon="lock"
            required
            maxLength={200}
            autoComplete="new-password"
            placeholder="Xác nhận lại mật khẩu của bạn"
          />

          <Button type="submit" className="mt-8 min-h-12 w-full text-base" disabled={busy}>
            {busy ? "Đang tạo tài khoản" : "Tạo tài khoản"}
          </Button>
        </Form>

        <p className="mt-6 text-center text-sm text-ink-2">
          Đã có tài khoản?{" "}
          <Link to={`/dang-nhap${sauTiep}`} className="font-semibold text-primary hover:underline">
            Đăng nhập
          </Link>
        </p>
      </Card>
    </KhungTrang>
  );
}
