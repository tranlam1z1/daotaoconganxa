import { Link, useRouteLoaderData } from "react-router";
import { voiNgay } from "../lib/bo-loc-van-ban";
import { formatDate, VERSION_KIND_LABEL } from "../lib/format";
import type { loader } from "./document";
export default function DocumentVersions() {
  const data = useRouteLoaderData<typeof loader>("routes/document");
  if (!data) return null;
  const versions = [...data.detail.versions].sort(
    (a, b) => a.validFrom.localeCompare(b.validFrom) || a.versionNo - b.versionNo,
  );
  return (
    <section>
      <h2 className="text-xl font-semibold">Các phiên bản trong kho</h2>
      {!versions.length ? (
        <p className="mt-3 text-ink-2">Chưa có phiên bản nội dung được lưu.</p>
      ) : (
        <ol className="mt-4 grid gap-3">
          {versions.map((v, i) => (
            <li key={v.versionNo} className="rounded-card border border-line p-4">
              <h3 className="font-semibold">
                Phiên bản {v.versionNo} · {VERSION_KIND_LABEL[v.kind]}
              </h3>
              <p className="mt-2 text-sm text-ink-2">
                Từ {formatDate(v.validFrom)}
                {v.validTo ? ` đến trước ${formatDate(v.validTo)}` : " · Chưa có mốc kết thúc"}
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                <Link
                  to={voiNgay(data.basePath, v.validFrom)}
                  className="inline-flex min-h-11 items-center text-primary underline"
                >
                  Đọc tại mốc này
                </Link>
                {i > 0 && versions[i - 1]!.validFrom !== v.validFrom ? (
                  <Link
                    to={
                      "/so-sanh?" +
                      new URLSearchParams({
                        urn: data.urn,
                        from: versions[i - 1]!.validFrom,
                        to: v.validFrom,
                      })
                    }
                    className="inline-flex min-h-11 items-center text-primary underline"
                  >
                    So sánh với mốc trước
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-4 text-sm text-ink-2">
        Danh sách phản ánh các phiên bản có trong kho; không khẳng định đã có đủ mọi lần sửa đổi.
      </p>
    </section>
  );
}
