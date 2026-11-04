import { Link, useRouteLoaderData } from "react-router";
import { NutSaoChepTrichDan } from "../components/tra-cuu/NutSaoChepTrichDan";
import { NHOM_VAN_BAN, nguonAnToan } from "../lib/bo-loc-van-ban";
import { DOC_STATUS_LABEL, formatDate } from "../lib/format";
import type { loader } from "./document";
export default function DocumentProperties() {
  const data = useRouteLoaderData<typeof loader>("routes/document");
  if (!data) return null;
  const m = data.detail.meta;
  const source = nguonAnToan(m.primarySource);
  const rows = [
    ["Số ký hiệu", m.soKyHieu],
    ["Nhóm văn bản", NHOM_VAN_BAN[m.documentGroup || ""] || "Chưa phân loại"],
    ["Cơ quan ban hành", m.issuer],
    ["Người ký", m.signer || "Chưa có dữ liệu"],
    ["Ngày ban hành", formatDate(m.issuedDate)],
    ["Có hiệu lực từ", m.effectiveFrom ? formatDate(m.effectiveFrom) : "Chưa có dữ liệu"],
    ["Hết hiệu lực từ", m.effectiveTo ? formatDate(m.effectiveTo) : "Chưa có dữ liệu"],
    [
      m.documentGroup === "dang" ? "Trạng thái ghi nhận" : "Trạng thái tại ngày xem",
      DOC_STATUS_LABEL[data.detail.status],
    ],
    ["Lĩnh vực", m.fields.join(", ") || "Chưa phân loại"],
  ];
  return (
    <section aria-labelledby="thuoc-tinh">
      <h2 id="thuoc-tinh" className="text-xl font-semibold">
        Thuộc tính văn bản
      </h2>
      <dl className="mt-4 divide-y divide-line">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 py-3 sm:grid-cols-[11rem_1fr]">
            <dt className="font-medium">{label}</dt>
            <dd className="min-w-0 break-words text-ink-2">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4">
        Nguồn:{" "}
        {source ? (
          <a href={source} target="_blank" rel="noreferrer" className="text-primary underline">
            Mở đường dẫn nguồn
          </a>
        ) : m.primarySource === "quan-tri" ? (
          "Nhập trong quản trị; chưa có đường dẫn nguồn công khai."
        ) : (
          "Chưa có đường dẫn nguồn."
        )}
      </p>
      {data.detail.coTepGoc ? (
        <a
          href={`${data.basePath}/tep-goc`}
          target="_blank"
          rel="noreferrer"
          className="my-3 inline-flex min-h-11 items-center text-primary underline"
        >
          Mở tệp PDF gốc
        </a>
      ) : (
        <p className="my-3 text-sm text-ink-2">Kho chưa có tệp PDF gốc.</p>
      )}
      {m.documentGroup === "dang" ? (
        <p className="my-3 text-sm text-ink-2">
          Trạng thái văn bản Đảng do kho ghi nhận; cần đối chiếu bản gốc và văn bản thay thế.
        </p>
      ) : null}
      <NutSaoChepTrichDan meta={m} asOf={data.asOf} />
      <Link
        to={`${data.basePath}/phien-ban${data.asOf ? `?asOf=${data.asOf}` : ""}`}
        className="ml-3 inline-flex min-h-11 items-center text-primary underline"
      >
        Xem phiên bản
      </Link>
    </section>
  );
}
