import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { Form, useNavigation, useSearchParams } from "react-router";

import { KhaiXacMinh } from "../components/tai-khoan/KhaiXacMinh";
import { AnhDaiDien } from "../components/ui/AnhDaiDien";
import { Button, ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Notice } from "../components/ui/Field";
import { PageHeader } from "../components/ui/PageHeader";
import {
  danhSachDonViChon,
  doiAnhDaiDien,
  khaiXacMinh,
  LoiDangNhap,
  xoaAnhDaiDien,
} from "../lib/auth.server";
import { duVaiTro, yeuCauDangNhap } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { DonViChon, NguoiDung } from "../lib/types";
import type { Route } from "./+types/tai-khoan";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Tài khoản", { index: false });
}

export async function loader({ request }: Route.LoaderArgs) {
  const { nguoiDung } = await yeuCauDangNhap(request, { choPhepChoXacMinh: true });
  // Cán bộ quản lý vào thẳng danh sách người dùng; biên tập trở lên vào trang tổng quan quản trị.
  const trangQuanTri = duVaiTro(nguoiDung, "bien_tap")
    ? "/quan-tri"
    : duVaiTro(nguoiDung, "quan_ly")
      ? "/quan-tri/nguoi-dung"
      : null;
  // Chưa được xác minh thì cần danh sách đơn vị để khai hoặc sửa thông tin.
  const donVi = nguoiDung.cho_xac_minh ? await danhSachDonViChon() : [];
  return { nguoiDung, trangQuanTri, donVi };
}

type KetQua = { ok: string; xacMinh?: boolean } | { loi: string; xacMinh?: boolean };

export async function action({ request }: Route.ActionArgs): Promise<KetQua> {
  const { token } = await yeuCauDangNhap(request, { choPhepChoXacMinh: true });
  const form = await request.formData();
  try {
    if (form.get("intent") === "khai-xac-minh") {
      await khaiXacMinh(token, {
        so_hieu: String(form.get("so_hieu") ?? ""),
        don_vi_id: String(form.get("don_vi_id") ?? ""),
        cap_bac_chuc_vu: String(form.get("cap_bac_chuc_vu") ?? ""),
        so_dien_thoai: String(form.get("so_dien_thoai") ?? ""),
      });
      return { ok: "Đã gửi thông tin. Tài khoản đang chờ xác minh.", xacMinh: true };
    }
    if (form.get("intent") === "xoa-anh") {
      await xoaAnhDaiDien(token);
      return { ok: "Đã bỏ ảnh đại diện." };
    }
    const tep = form.get("tep");
    if (!(tep instanceof File) || tep.size === 0) return { loi: "Chọn một ảnh trước khi lưu." };
    await doiAnhDaiDien(token, tep);
    return { ok: "Đã đổi ảnh đại diện." };
  } catch (e) {
    if (e instanceof LoiDangNhap) {
      return { loi: e.message, xacMinh: form.get("intent") === "khai-xac-minh" };
    }
    throw e;
  }
}

/** Cạnh ảnh đại diện sau khi thu nhỏ (px): đủ nét cho ô 56px trên màn hình mật độ cao. */
const CANH_ANH = 256;

/**
 * Cắt giữa thành hình vuông và thu nhỏ về CANH_ANH ngay trên trình duyệt, để ảnh chụp điện thoại
 * vài MB chỉ còn vài chục KB khi gửi lên. Trình duyệt không xuất được WebP thì toBlob trả PNG.
 */
async function thuNhoAnh(tep: File): Promise<File> {
  const bmp = await createImageBitmap(tep);
  const canh = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = CANH_ANH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Không vẽ được ảnh");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, (bmp.width - canh) / 2, (bmp.height - canh) / 2, canh, canh, 0, 0, CANH_ANH, CANH_ANH);
  bmp.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.85));
  if (!blob) throw new Error("Không xuất được ảnh");
  const duoi = blob.type === "image/webp" ? "webp" : "png";
  return new File([blob], `anh-dai-dien.${duoi}`, { type: blob.type });
}

function DoiAnhDaiDien({
  nguoiDung,
  ketQua,
}: {
  nguoiDung: NguoiDung;
  ketQua: { ok: string } | { loi: string } | undefined;
}) {
  const busy = useNavigation().state === "submitting";
  const inputRef = useRef<HTMLInputElement>(null);
  const [xemTruoc, setXemTruoc] = useState<string | null>(null);
  const [loiChon, setLoiChon] = useState<string | null>(null);

  // Lưu xong (hoặc bỏ ảnh) thì xóa ảnh xem trước: ảnh mới đến từ loader.
  useEffect(() => {
    if (ketQua && "ok" in ketQua) {
      setXemTruoc(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [ketQua]);

  useEffect(() => () => void (xemTruoc && URL.revokeObjectURL(xemTruoc)), [xemTruoc]);

  async function chonAnh(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const tep = input.files?.[0];
    setLoiChon(null);
    if (!tep) return setXemTruoc(null);
    try {
      const nho = await thuNhoAnh(tep);
      const dt = new DataTransfer();
      dt.items.add(nho);
      input.files = dt.files;
      setXemTruoc(URL.createObjectURL(nho));
    } catch {
      input.value = "";
      setXemTruoc(null);
      setLoiChon("Không đọc được ảnh này. Hãy chọn ảnh JPG, PNG hoặc WebP.");
    }
  }

  const loi = loiChon ?? (ketQua && "loi" in ketQua ? ketQua.loi : null);

  return (
    <Card id="anh-dai-dien" className="mt-8 scroll-mt-24">
      <h2 className="text-lg font-semibold">Ảnh đại diện</h2>
      <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
        <AnhDaiDien nguoiDung={nguoiDung} src={xemTruoc} className="size-24 text-4xl" />
        <div className="min-w-0 flex-1">
          <Form method="post" encType="multipart/form-data" className="flex flex-wrap items-center gap-2">
            <label className="lun inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium hover:bg-surface-2 focus-within:ring-2 focus-within:ring-primary">
              Chọn ảnh…
              <input
                ref={inputRef}
                type="file"
                name="tep"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={chonAnh}
              />
            </label>
            {xemTruoc ? (
              <Button type="submit" disabled={busy}>
                {busy ? "Đang lưu…" : "Lưu ảnh"}
              </Button>
            ) : null}
            {!xemTruoc && nguoiDung.anh_dai_dien ? (
              <Button type="submit" name="intent" value="xoa-anh" variant="ghost" disabled={busy}>
                Bỏ ảnh
              </Button>
            ) : null}
          </Form>
          <p className="mt-2 text-sm text-ink-3">
            Ảnh JPG, PNG hoặc WebP. Ảnh được cắt vuông ở giữa và thu nhỏ trước khi gửi.
          </p>
        </div>
      </div>
      {loi ? (
        <Notice tone="danger" className="mt-4">
          {loi}
        </Notice>
      ) : ketQua && "ok" in ketQua ? (
        <Notice className="mt-4">{ketQua.ok}</Notice>
      ) : null}
    </Card>
  );
}

/**
 * Trạng thái xác minh cán bộ (migration 0064) và ô khai báo. Chờ duyệt thì hiện thông tin đã khai,
 * sửa được; bị từ chối thì hiện lý do và mở sẵn ô khai lại; tài khoản Google chưa khai thì mở sẵn.
 */
function XacMinhCanBo({
  nguoiDung,
  donVi,
  ketQua,
}: {
  nguoiDung: NguoiDung;
  donVi: DonViChon[];
  ketQua: KetQua | undefined;
}) {
  const busy = useNavigation().state === "submitting";
  const xm = nguoiDung.xac_minh;
  const tuChoi = xm?.trang_thai === "tu_choi";
  const chuaKhai = !xm?.so_hieu || !xm.don_vi;
  const loi = ketQua && "loi" in ketQua ? ketQua.loi : null;

  return (
    <Card id="xac-minh" className="mt-8 scroll-mt-24">
      <h2 className="text-lg font-semibold">Xác minh cán bộ</h2>
      {tuChoi ? (
        <Notice tone="danger" className="mt-4">
          Thông tin chưa được chấp nhận
          {xm?.ly_do_tu_choi ? (
            <>
              : <strong>{xm.ly_do_tu_choi}</strong>
            </>
          ) : null}
          . Sửa lại thông tin bên dưới rồi gửi lại.
        </Notice>
      ) : chuaKhai ? (
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Khai số hiệu và đơn vị công tác để cán bộ quản lý đơn vị hoặc quản trị viên xác minh. Học, luyện
          tập, trò chơi và thi mở sau khi tài khoản được duyệt.
        </p>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Tài khoản đang chờ cán bộ quản lý đơn vị hoặc quản trị viên xác minh. Học, luyện tập, trò chơi, thi,
          nhóm học và bảng xếp hạng mở sau khi được duyệt; tra cứu và bộ công cụ dùng được ngay.
        </p>
      )}

      {xm && !chuaKhai ? (
        <dl className="mt-4 grid gap-3 text-sm [overflow-wrap:anywhere] sm:grid-cols-[10rem_1fr]">
          <dt className="text-ink-3">Số hiệu CAND</dt>
          <dd className="font-mono font-medium">{xm.so_hieu}</dd>
          <dt className="text-ink-3">Đơn vị đã khai</dt>
          <dd className="font-medium">{xm.don_vi?.ten}</dd>
          {xm.cap_bac_chuc_vu ? (
            <>
              <dt className="text-ink-3">Cấp bậc, chức vụ</dt>
              <dd className="font-medium">{xm.cap_bac_chuc_vu}</dd>
            </>
          ) : null}
          {xm.so_dien_thoai ? (
            <>
              <dt className="text-ink-3">Số điện thoại</dt>
              <dd className="font-medium">{xm.so_dien_thoai}</dd>
            </>
          ) : null}
        </dl>
      ) : null}

      <details className="mt-4" open={tuChoi || chuaKhai || Boolean(loi)}>
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-primary">
          {chuaKhai ? "Khai thông tin" : "Sửa thông tin đã khai"}
        </summary>
        <Form method="post" className="pb-2">
          <input type="hidden" name="intent" value="khai-xac-minh" />
          <KhaiXacMinh donVi={donVi} macDinh={xm} coSoDienThoai />
          <Button type="submit" className="mt-6" disabled={busy}>
            {busy ? "Đang gửi…" : "Gửi xác minh"}
          </Button>
        </Form>
      </details>

      {loi ? (
        <Notice tone="danger" className="mt-4">
          {loi}
        </Notice>
      ) : ketQua && "ok" in ketQua ? (
        <Notice className="mt-4">{ketQua.ok}</Notice>
      ) : null}
    </Card>
  );
}

export default function TaiKhoan({ loaderData, actionData }: Route.ComponentProps) {
  const { nguoiDung, trangQuanTri, donVi } = loaderData;
  const [params] = useSearchParams();
  const ketQuaXacMinh = actionData?.xacMinh ? actionData : undefined;
  const ketQuaAnh = actionData?.xacMinh ? undefined : actionData;

  return (
    <div className="wrap max-w-3xl py-10">
      <PageHeader
        eyebrow="Tài khoản"
        title={nguoiDung.ten ?? nguoiDung.email}
        actions={
          <Form method="post" action="/dang-xuat">
            <Button type="submit" variant="secondary">
              Đăng xuất
            </Button>
          </Form>
        }
      />

      {params.get("quan-tri-dau-tien") ? (
        <Notice className="mt-6">
          Tài khoản này là tài khoản đầu tiên của hệ thống nên được cấp vai trò quản trị.
        </Notice>
      ) : null}
      {params.get("da-doi-mat-khau") ? <Notice className="mt-6">Đã đổi mật khẩu.</Notice> : null}
      {params.get("can-xac-minh") && nguoiDung.cho_xac_minh ? (
        <Notice className="mt-6">
          Trang vừa mở cần tài khoản cán bộ đã được xác minh. Xem trạng thái xác minh bên dưới.
        </Notice>
      ) : null}

      <Card className="mt-8">
        <dl className="grid gap-4 text-sm [overflow-wrap:anywhere] sm:grid-cols-[10rem_1fr]">
          {nguoiDung.ten_dang_nhap ? (
            <>
              <dt className="text-ink-3">Tên đăng nhập</dt>
              <dd className="font-mono font-medium">{nguoiDung.ten_dang_nhap}</dd>
            </>
          ) : (
            <>
              <dt className="text-ink-3">Email</dt>
              <dd className="font-medium">{nguoiDung.email}</dd>
            </>
          )}
          {nguoiDung.don_vi ? (
            <>
              <dt className="text-ink-3">Đơn vị</dt>
              <dd className="font-medium">{nguoiDung.don_vi.ten}</dd>
            </>
          ) : null}
          <dt className="text-ink-3">Vai trò</dt>
          <dd className="font-medium">
            {nguoiDung.cho_xac_minh
              ? nguoiDung.xac_minh?.trang_thai === "tu_choi"
                ? "Chưa được xác minh"
                : "Chờ xác minh cán bộ"
              : nguoiDung.mo_ta_vai_tro}
          </dd>
          {nguoiDung.mien ? (
            <>
              <dt className="text-ink-3">Miền</dt>
              <dd className="font-medium">{nguoiDung.mien}</dd>
            </>
          ) : null}
        </dl>
        <div className="mt-6 flex flex-wrap gap-2">
          {nguoiDung.ten_dang_nhap ? (
            <ButtonLink to="/doi-mat-khau?tiep=%2Ftai-khoan%3Fda-doi-mat-khau%3D1" variant="secondary">
              Đổi mật khẩu
            </ButtonLink>
          ) : null}
          {trangQuanTri ? (
            <ButtonLink to={trangQuanTri} variant="secondary">
              Mở trang quản trị
            </ButtonLink>
          ) : null}
        </div>
      </Card>

      {nguoiDung.cho_xac_minh ? (
        <XacMinhCanBo nguoiDung={nguoiDung} donVi={donVi} ketQua={ketQuaXacMinh} />
      ) : null}

      <DoiAnhDaiDien nguoiDung={nguoiDung} ketQua={ketQuaAnh} />
    </div>
  );
}
