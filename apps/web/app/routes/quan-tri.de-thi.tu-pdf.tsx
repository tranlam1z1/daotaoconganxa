/**
 * Tạo đề thi thẳng từ một tệp PDF văn bản: chọn tệp, chọn một trong ba mẫu cấu trúc đề, bấm tạo.
 * API lưu văn bản vào kho (đã có thì dùng lại), tạo đề nháp mang tên văn bản và cho AI sinh câu
 * hỏi; trang chuyển sang trang đề để theo dõi tiến độ, duyệt câu và xuất bản.
 *
 * Số ký hiệu và loại văn bản chỉ cần nhập khi hệ thống không tự đọc được từ tệp.
 */
import { useState } from "react";
import { Form, Link, redirect, useNavigation } from "react-router";
import { Button } from "../components/ui/Button";
import { Input, inputClass, Label, Notice } from "../components/ui/Field";
import { TieuDeTrang } from "../components/ui/KhungTrang";
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import { MAU_DE } from "../lib/thi";
import { API_VAN_BAN, type DanhMucVanBan, PDF_TOI_DA_MB } from "../lib/van-ban-quan-tri";
import type { Route } from "./+types/quan-tri.de-thi.tu-pdf";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Tạo đề thi từ tệp PDF", { index: false });
}

export async function loader({ request }: Route.LoaderArgs) {
  const { token } = await yeuCauVaiTro(request, "quan_tri");
  const danhMuc = await goiApiQuanTri<DanhMucVanBan>(token, `${API_VAN_BAN}/loai`);
  return { loaiVanBan: danhMuc.items };
}

export async function action({ request }: Route.ActionArgs): Promise<{ loi: string }> {
  const { token } = await yeuCauVaiTro(request, "quan_tri");
  const f = await request.formData();
  const tep = f.get("tep");
  if (!(tep instanceof File) || !tep.size) return { loi: "Chưa chọn tệp PDF." };
  const form = new FormData();
  form.set("tep", tep, tep.name);
  for (const ten of ["mau", "so_ky_hieu", "loai"]) {
    const v = String(f.get(ten) ?? "").trim();
    if (v) form.set(ten, v);
  }
  try {
    // PDF có lớp chữ vài trăm trang đọc mất vài giây; bản quét chỉ nhận tệp rồi chạy nền.
    const kq = await goiApiQuanTri<{ de_thi: { id: string } }>(token, "/v1/quan-tri/de-thi/tu-pdf", {
      form,
      timeoutMs: 120_000,
    });
    throw redirect(`/quan-tri/de-thi/${kq.de_thi.id}`);
  } catch (e) {
    if (e instanceof LoiApi) return { loi: e.message };
    throw e;
  }
}

export default function TaoDeThiTuPdf({ loaderData, actionData }: Route.ComponentProps) {
  const { loaiVanBan } = loaderData;
  const dangGui = useNavigation().state === "submitting";
  const [loiTep, setLoiTep] = useState<string | null>(null);

  return (
    <section className="max-w-2xl">
      <Link
        to="/quan-tri/de-thi"
        className="hidden min-h-11 items-center text-sm font-medium text-primary md:flex"
      >
        Về danh sách đề thi
      </Link>
      <TieuDeTrang as="h2" icon="shield" className="text-xl font-semibold">
        Tạo đề thi từ tệp PDF
      </TieuDeTrang>
      <p className="mt-1 text-sm text-ink-2">
        Chọn tệp PDF của văn bản (luật, nghị định, thông tư). Hệ thống lưu văn bản vào kho, tạo đề mang tên
        văn bản và cho AI sinh câu hỏi. Cán bộ chỉ làm được đề sau khi bạn duyệt câu hỏi và xuất bản đề.
      </p>

      {actionData?.loi ? (
        <Notice tone="danger" className="mt-4">
          {actionData.loi}
        </Notice>
      ) : null}

      <Form method="post" encType="multipart/form-data" className="mt-6 space-y-5">
        <div>
          <Label htmlFor="pdf-tep">Tệp PDF (tối đa {PDF_TOI_DA_MB} MB)</Label>
          <input
            id="pdf-tep"
            name="tep"
            type="file"
            required
            accept=".pdf,application/pdf"
            className="block w-full text-sm file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-btn file:border file:border-line-strong file:bg-surface file:px-4 file:font-semibold"
            aria-describedby="pdf-tep-goi-y"
            onChange={(e) => {
              const tep = e.target.files?.[0];
              setLoiTep(
                tep && tep.size > PDF_TOI_DA_MB * 1024 * 1024
                  ? `Tệp PDF quá lớn (tối đa ${PDF_TOI_DA_MB} MB).`
                  : null,
              );
            }}
          />
          <p id="pdf-tep-goi-y" className="mt-1 text-xs text-ink-3">
            Bản có lớp chữ (bôi đen được chữ) đọc xong trong vài giây. Bản quét được AI đọc từng trang nên mất
            vài phút và tốn chi phí AI hơn.
          </p>
          {loiTep ? (
            <Notice tone="danger" className="mt-2">
              {loiTep}
            </Notice>
          ) : null}
        </div>

        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">Cấu trúc đề</legend>
          {MAU_DE.map((m) => (
            <label key={m.ma} className="flex min-h-11 items-center gap-3 text-sm">
              <input type="radio" name="mau" value={m.ma} defaultChecked={m.ma === "45"} className="size-5" />
              <span>
                <span className="font-medium">{m.ten}</span>: {m.moTa}
              </span>
            </label>
          ))}
          <p className="text-xs text-ink-3">
            Điểm đạt 70. Trước khi xuất bản, thời gian và điểm đạt sửa được ở trang đề, số câu và điểm mỗi câu
            sửa được ở trang ma trận của đề.
          </p>
        </fieldset>

        <details
          className="rounded-xl border border-line bg-surface px-4 py-3"
          open={Boolean(actionData?.loi)}
        >
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
            Nhập tay số ký hiệu khi hệ thống không tự đọc được
          </summary>
          <div className="mt-2 grid gap-4 pb-2 sm:grid-cols-2">
            <div>
              <Label htmlFor="pdf-so-ky-hieu">Số ký hiệu</Label>
              <Input id="pdf-so-ky-hieu" name="so_ky_hieu" placeholder="12/2026/TT-BCA" maxLength={100} />
            </div>
            <div>
              <Label htmlFor="pdf-loai">Loại văn bản</Label>
              <select id="pdf-loai" name="loai" defaultValue="" className={inputClass}>
                <option value="">Tự xác định theo số ký hiệu</option>
                {loaiVanBan.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </details>

        <Button type="submit" size="lg" disabled={dangGui || Boolean(loiTep)} className="w-full md:w-auto">
          {dangGui ? "Đang đọc tệp…" : "Tạo đề thi"}
        </Button>
      </Form>
    </section>
  );
}
