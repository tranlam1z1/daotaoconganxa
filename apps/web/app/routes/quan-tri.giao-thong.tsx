import { Form, Link, useNavigation } from "react-router";
import { Button } from "../components/ui/Button";
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { yeuCauVaiTro } from "../lib/session.server";
import type { Route } from "./+types/quan-tri.giao-thong";

interface StagedJob {
  id: string;
  source_url: string;
  status: string;
  payload: { records: Array<{ text: string; kind: string; missing: string[] }> };
}
interface Penalty {
  id: string;
  violation_code: string;
  fine_min: string;
  fine_max: string;
  citation_urn: string;
  version: number;
  status: string;
  conditions: string[];
  required_facts: string[];
}
const api = "/api/v1/traffic";
export async function loader({ request }: Route.LoaderArgs) {
  const { token } = await yeuCauVaiTro(request, "quan_ly");
  const [jobs, penalties] = await Promise.all([
    goiApiQuanTri<{ items: StagedJob[] }>(token, `${api}/admin/imports?page_size=100`),
    goiApiQuanTri<{ items: Penalty[] }>(token, `${api}/admin/penalties?page_size=100`),
  ]);
  return { jobs: jobs.items, penalties: penalties.items };
}
export async function action({ request }: Route.ActionArgs) {
  const { token } = await yeuCauVaiTro(request, "quan_ly");
  const form = await request.formData();
  const intent = String(form.get("intent"));
  try {
    if (intent === "stage" || intent === "penalty") {
      const raw = String(form.get("json") ?? "");
      if (raw.length > 2 * 1024 * 1024) return { error: "Tệp vượt quá 2 MB." };
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        return { error: "Nội dung JSON không hợp lệ." };
      }
      await goiApiQuanTri(token, `${api}/admin/${intent === "stage" ? "imports" : "penalties"}`, {
        method: "POST",
        body,
      });
    } else if (intent === "approve" || intent === "reject") {
      const id = String(form.get("id"));
      if (!/^[a-f0-9-]{36}$/i.test(id)) return { error: "ID không hợp lệ." };
      await goiApiQuanTri(token, `${api}/admin/penalties/${id}/review`, {
        method: "POST",
        body: { version: Number(form.get("version")), approve: intent === "approve" },
      });
    } else return { error: "Thao tác không hợp lệ." };
    return { error: null };
  } catch (e) {
    if (e instanceof LoiApi) return { error: e.message };
    throw e;
  }
}
export default function TrafficAdmin({ loaderData, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state !== "idle";
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <h1 className="text-2xl font-semibold">Dữ liệu giao thông</h1>
      <p>
        Đối chiếu văn bản gốc và ngày áp dụng trước khi duyệt. Dữ liệu nhập chỉ nằm trong vùng chờ biên tập.
      </p>
      <Link to="/quan-tri/du-lieu-tra-cuu" className="text-primary underline">
        Quản lý biển báo, hành vi và lịch sử duyệt
      </Link>
      {actionData?.error ? (
        <p role="alert" className="text-danger">
          {actionData.error}
        </p>
      ) : null}
      <section className="rounded-card border border-line bg-surface p-4">
        <h2 className="text-lg font-semibold">Nhập tài liệu vào vùng chờ</h2>
        <Form method="post" className="mt-3 space-y-3">
          <input type="hidden" name="intent" value="stage" />
          <label className="block" htmlFor="traffic-import">
            Nội dung manifest.json từ công cụ trích xuất
          </label>
          <textarea
            id="traffic-import"
            name="json"
            required
            rows={6}
            className="w-full rounded-btn border border-line bg-surface p-3 font-mono text-sm"
          />
          <Button type="submit" disabled={busy}>
            Đưa vào vùng chờ
          </Button>
        </Form>
        {loaderData.jobs.map((job) => (
          <details key={job.id} className="mt-4 border-t border-line pt-3">
            <summary>
              {job.source_url} · {job.status} · {job.payload.records.length} đoạn
            </summary>
            <ul className="mt-3 space-y-3">
              {job.payload.records.map((r) => (
                <li key={`${job.id}-${r.text}`} className="rounded-btn bg-page p-3">
                  <p className="whitespace-pre-wrap">{r.text}</p>
                  <p className="mt-1 text-sm text-ink-3">Chưa đủ: {r.missing.join(", ")}</p>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </section>
      <section className="rounded-card border border-line bg-surface p-4">
        <h2 className="text-lg font-semibold">Khung phạt theo tình tiết</h2>
        <p className="mt-2 text-sm text-ink-2">
          Nhập bản ghi đã biên tập theo mẫu trong hướng dẫn API. Khung mới ở trạng thái nháp; duyệt kiểm tra
          căn cứ trước khi công khai.
        </p>
        <Form method="post" className="mt-3 space-y-3">
          <input type="hidden" name="intent" value="penalty" />
          <label className="block" htmlFor="traffic-penalty">
            Bản ghi khung phạt JSON
          </label>
          <textarea
            id="traffic-penalty"
            name="json"
            required
            rows={6}
            className="w-full rounded-btn border border-line bg-surface p-3 font-mono text-sm"
          />
          <Button type="submit" disabled={busy}>
            Lưu bản nháp
          </Button>
        </Form>
        <ul className="mt-4 space-y-3">
          {loaderData.penalties.map((p) => (
            <li key={p.id} className="rounded-btn border border-line p-3">
              <p className="font-semibold">
                {p.violation_code} · {Number(p.fine_min).toLocaleString("vi-VN")} –{" "}
                {Number(p.fine_max).toLocaleString("vi-VN")} đồng
              </p>
              <p>{p.conditions.join("; ")}</p>
              <p>Cần bổ sung: {p.required_facts.join("; ") || "Đối chiếu tình tiết cụ thể"}</p>
              <p className="text-sm text-ink-3">
                {p.citation_urn} · {p.status} · Phiên bản {p.version}
              </p>
              <Form method="post" className="mt-2 flex gap-3">
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="version" value={p.version} />
                <Button name="intent" value="approve" type="submit" disabled={busy}>
                  Duyệt
                </Button>
                <Button name="intent" value="reject" type="submit" disabled={busy}>
                  Ngừng công khai
                </Button>
              </Form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
