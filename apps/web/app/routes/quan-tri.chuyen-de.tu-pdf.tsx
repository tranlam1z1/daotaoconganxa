/**
 * Tạo chuyên đề thẳng từ một tệp PDF văn bản: chọn tệp, bấm tạo. API lưu văn bản vào kho (đã có
 * thì dùng lại), tạo chuyên đề mang tên văn bản và cho AI soạn bài; trang chuyển sang trang chuyên
 * đề để theo dõi tiến độ và xuất bản.
 *
 * Số ký hiệu và loại văn bản chỉ cần nhập khi hệ thống không tự đọc được từ tệp. Quản trị viên có
 * thêm ô tích tạo luôn một đề thi từ cùng văn bản (tạo đề thi cần vai trò quản trị).
 */
import { useState } from "react";
import { Form, Link, redirect, useNavigation } from "react-router";
import { Button } from "../components/ui/Button";
import { Input, inputClass, Label, Notice } from "../components/ui/Field";
import { TieuDeTrang } from "../components/ui/KhungTrang";
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { LinhVucQuanTri } from "../lib/soan-bai-giang";
import { MAU_DE } from "../lib/thi";
import { API_VAN_BAN, type DanhMucVanBan, PDF_TOI_DA_MB } from "../lib/van-ban-quan-tri";
import type { Route } from "./+types/quan-tri.chuyen-de.tu-pdf";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Tạo chuyên đề từ tệp PDF", { index: false });
}

export async function loader({ request }: Route.LoaderArgs) {
  const { token, nguoiDung } = await yeuCauVaiTro(request, "quan_ly");
  const [{ items: linhVuc }, danhMuc] = await Promise.all([
    goiApiQuanTri<{ items: LinhVucQuanTri[] }>(token, "/v1/quan-tri/dao-tao/linh-vuc"),
    goiApiQuanTri<DanhMucVanBan>(token, `${API_VAN_BAN}/loai`),
  ]);
  return { linhVuc, loaiVanBan: danhMuc.items, laQuanTri: nguoiDung.la_quan_tri };
}

export async function action({ request }: Route.ActionArgs): Promise<{ loi: string }> {
  const { token } = await yeuCauVaiTro(request, "quan_ly");
  const f = await request.formData();
  const tep = f.get("tep");
  if (!(tep instanceof File) || !tep.size) return { loi: "Chưa chọn tệp PDF." };
  const form = new FormData();
  form.set("tep", tep, tep.name);
  for (const ten of ["linh_vuc_id", "tu_luan", "trac_nghiem", "so_ky_hieu", "loai", "tao_de_thi", "mau_de"]) {
    const v = String(f.get(ten) ?? "").trim();
    if (v) form.set(ten, v);
  }
  try {
    // PDF có lớp chữ vài trăm trang đọc mất vài giây; bản quét chỉ nhận tệp rồi chạy nền.
    const kq = await goiApiQuanTri<{ chuyen_de: { slug: string }; de_thi: { id: string } | null }>(
      token,
      "/v1/quan-tri/dao-tao/chuyen-de-tu-pdf",
      { form, timeoutMs: 120_000 },
    );
    // Đề thi tạo kèm: trang chuyên đề hiện lối sang đề đó.
    throw redirect(`/quan-tri/chuyen-de/${kq.chuyen_de.slug}${kq.de_thi ? `?deThi=${kq.de_thi.id}` : ""}`);
  } catch (e) {
    if (e instanceof LoiApi) return { loi: e.message };
    // Ước tính chi phí vượt trần: API trả 403 kèm lời giải thích, báo tại chỗ.
    if (e instanceof Response && e.status === 403) return { loi: await e.text() };
    throw e;
  }
}

export default function TaoChuyenDeTuPdf({ loaderData, actionData }: Route.ComponentProps) {
  const { linhVuc, loaiVanBan, laQuanTri } = loaderData;
  const dangGui = useNavigation().state === "submitting";
  const [loiTep, setLoiTep] = useState<string | null>(null);

  return (
    <section className="max-w-2xl">
      <Link
        to="/quan-tri/chuyen-de"
        className="hidden min-h-11 items-center text-sm font-medium text-primary md:flex"
      >
        Về danh sách chuyên đề
      </Link>
      <TieuDeTrang as="h2" icon="shield" className="text-xl font-semibold">
        Tạo chuyên đề từ tệp PDF
      </TieuDeTrang>
      <p className="mt-1 text-sm text-ink-2">
        Chọn tệp PDF của văn bản (luật, nghị định, thông tư). Hệ thống lưu văn bản vào kho, tạo chuyên đề mang
        tên văn bản và soạn sẵn các bài học. Bài soạn ra là bản nháp, học viên chỉ thấy sau khi bạn xuất bản.
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
            Bản có lớp chữ (bôi đen được chữ) xong trong vài giây. Bản quét được AI đọc từng trang nên mất vài
            phút và tốn chi phí AI hơn.
          </p>
          {loiTep ? (
            <Notice tone="danger" className="mt-2">
              {loiTep}
            </Notice>
          ) : null}
        </div>

        <div>
          <Label htmlFor="pdf-linh-vuc">Lĩnh vực</Label>
          <select id="pdf-linh-vuc" name="linh_vuc_id" defaultValue="" className={inputClass}>
            <option value="">Chưa gắn</option>
            {linhVuc.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">Soạn kèm cho mỗi bài</legend>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" name="tu_luan" value="1" defaultChecked className="size-5" />
            Một câu tự luận có thang chấm
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" name="trac_nghiem" value="1" defaultChecked className="size-5" />
            Sáu câu trắc nghiệm vào ngân hàng câu hỏi (ở trạng thái chờ duyệt)
          </label>
        </fieldset>

        {laQuanTri ? (
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">Đề thi</legend>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" name="tao_de_thi" value="1" className="size-5" />
              Tạo luôn một đề thi từ văn bản này
            </label>
            <div className="max-w-sm">
              <Label htmlFor="pdf-mau-de">Cấu trúc đề</Label>
              <select id="pdf-mau-de" name="mau_de" defaultValue="45" className={inputClass}>
                {MAU_DE.map((m) => (
                  <option key={m.ma} value={m.ma}>
                    {m.ten}: {m.moTa}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>
        ) : null}

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
          {dangGui ? "Đang đọc tệp…" : "Tạo chuyên đề"}
        </Button>
      </Form>
    </section>
  );
}
