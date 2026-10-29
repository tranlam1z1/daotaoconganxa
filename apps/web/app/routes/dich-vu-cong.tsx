import { useState } from "react";
import { KhungTraCuu } from "../components/tra-cuu/KhungTraCuu";
import { Icon } from "../components/ui/Icon";
import { CONG_DICH_VU, NHOM_DICH_VU, type NhomDichVu, timDichVuCong } from "../lib/dich-vu-cong";
import { pageMeta } from "../lib/site";

export function meta() {
  return pageMeta("Dịch vụ công trực tuyến", {
    description:
      "Tra cứu dịch vụ công dành cho công chức, viên chức, đảng viên trên Cổng Dịch vụ công Quốc gia.",
  });
}
export default function DichVuCong() {
  const [q, datQ] = useState("");
  const [nhom, datNhom] = useState<NhomDichVu>();
  const ketQua = timDichVuCong(q, nhom);
  return (
    <KhungTraCuu
      title="Dịch vụ công trực tuyến"
      icon="file"
      description="Danh mục tra cứu dành cho công chức, viên chức, đảng viên. Mở Cổng Dịch vụ công Quốc gia để thực hiện dịch vụ."
    >
      <div className="loi-vao-dich-vu rounded-xl border border-line bg-surface-2 p-4 sm:p-6">
        <div className="relative">
          <h2 className="text-lg font-semibold">Cổng Dịch vụ công Quốc gia</h2>
          <p className="mt-2 text-sm text-ink-2">
            Đăng nhập bằng VNeID theo hướng dẫn trên cổng. Tìm theo từ khóa bên dưới, chọn cơ quan thực hiện
            và xem yêu cầu hồ sơ. Với công tác Đảng, chọn mục “Dịch vụ công trực tuyến của Đảng” trên cổng.
          </p>
          <a
            href={CONG_DICH_VU}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-semibold text-white"
          >
            Mở Cổng Dịch vụ công Quốc gia ↗<span className="sr-only"> (tab mới)</span>
          </a>
        </div>
      </div>
      <div className="my-5 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Tìm dịch vụ
          <input
            type="search"
            value={q}
            onChange={(e) => datQ(e.target.value)}
            placeholder="Ví dụ: bảo hiểm, chứng thực…"
            className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink"
          />
        </label>
        <label className="text-sm font-medium">
          Nhóm người dùng
          <select
            value={nhom ?? ""}
            onChange={(e) => datNhom(e.target.value ? (e.target.value as NhomDichVu) : undefined)}
            className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink"
          >
            <option value="">Tất cả nhóm</option>
            {NHOM_DICH_VU.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
      <p role="status" className="mb-3 text-sm text-ink-2">
        {ketQua.length} nội dung phù hợp
      </p>
      {ketQua.length === 0 ? (
        <p className="rounded-xl border border-line p-4">
          Không tìm thấy nội dung. Thử từ khóa khác hoặc chọn tất cả nhóm.
        </p>
      ) : null}
      {[true, false].map((phoBien) => {
        const ds = ketQua.filter((d) => d.phoBien === phoBien);
        return ds.length ? (
          <section
            key={String(phoBien)}
            className="mb-6"
            aria-label={phoBien ? "Dịch vụ thường dùng" : "Dịch vụ khác"}
          >
            <h2 className="mb-3 font-semibold">{phoBien ? "Dịch vụ thường dùng" : "Dịch vụ khác"}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {ds.map((d) => (
                <a
                  key={d.ma}
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="the-bam flex items-start gap-3 rounded-xl border border-line bg-surface p-4"
                >
                  <Icon name="file" className="mt-1 size-6 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{d.ten}</span>
                    <span className="mt-1 block text-sm text-ink-2">{d.linhVuc}</span>
                    <span className="mt-2 block text-sm">Từ khóa trên cổng: {d.tuKhoa}</span>
                    <span className="mt-2 block text-sm text-primary">
                      Mở cổng quốc gia ↗<span className="sr-only"> (tab mới)</span>
                    </span>
                  </span>
                </a>
              ))}
            </div>
          </section>
        ) : null;
      })}
    </KhungTraCuu>
  );
}
