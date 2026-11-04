import { Form, Link } from "react-router";
import { KhungTraCuu } from "../components/tra-cuu/KhungTraCuu";
import { Button } from "../components/ui/Button";
import { ApiKhongTimThay, getDiff } from "../lib/api";
import { pathToCitationPhrase } from "../lib/citation";
import { formatDate, isIsoDate, NODE_STATUS_LABEL } from "../lib/format";
import { pageMeta } from "../lib/site";
import type { DiffResponse } from "../lib/types";
import type { Route } from "./+types/compare";
export function meta(_: Route.MetaArgs) {
  return pageMeta("So sánh văn bản", { index: false });
}
export async function loader({ request }: Route.LoaderArgs) {
  const p = new URL(request.url).searchParams;
  const urn = (p.get("urn") ?? "").trim();
  const from = p.get("from") ?? "";
  const to = p.get("to") ?? "";
  let loi: string | null = null;
  let diff: DiffResponse | null = null;
  if (urn && (from || to)) {
    if (!isIsoDate(from) || !isIsoDate(to) || from > to)
      loi = "Chọn hai ngày tồn tại trên lịch; ngày trước không được sau ngày đối chiếu.";
    else
      try {
        diff = await getDiff(urn, from, to);
      } catch (e) {
        if (e instanceof ApiKhongTimThay) loi = "Kho chưa có nội dung tại một trong hai mốc đã chọn.";
        else throw e;
      }
  }
  return { urn, from, to, loi, diff };
}
function tokenVoiKhoa(tokens: DiffResponse["nodes"][number]["tokens"]) {
  let offset = 0;
  return tokens.map((t) => {
    const item = { ...t, key: `${t.kind}:${offset}` };
    offset += t.text.length;
    return item;
  });
}
export default function Compare({ loaderData }: Route.ComponentProps) {
  const { urn, from, to, loi, diff } = loaderData;
  return (
    <KhungTraCuu
      title="So sánh hai mốc nội dung"
      description="Đối chiếu nội dung cùng một văn bản giữa hai ngày trong kho."
    >
      {!urn ? (
        <p>
          Mở mục Phiên bản của một{" "}
          <Link to="/tim-kiem" className="text-primary underline">
            văn bản
          </Link>{" "}
          để chọn hai mốc so sánh.
        </p>
      ) : (
        <Form method="get" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="urn" value={urn} />
          <label className="text-sm">
            Mốc trước
            <input
              required
              type="date"
              name="from"
              defaultValue={from}
              className="mt-1 block min-h-11 rounded-lg border border-line-strong bg-surface px-3"
            />
          </label>
          <label className="text-sm">
            Mốc đối chiếu
            <input
              required
              type="date"
              name="to"
              defaultValue={to}
              className="mt-1 block min-h-11 rounded-lg border border-line-strong bg-surface px-3"
            />
          </label>
          <Button type="submit">So sánh</Button>
        </Form>
      )}
      {loi ? (
        <p role="alert" className="mt-4 text-danger">
          {loi}
        </p>
      ) : null}
      {diff ? (
        <section className="mt-5">
          <h2 className="text-lg font-semibold">
            Từ {formatDate(diff.from)} đến {formatDate(diff.to)}
          </h2>
          <p className="mt-2 text-sm">
            {diff.stats.added} mục thêm · {diff.stats.removed} mục bỏ · {diff.stats.changed} mục thay đổi
          </p>
          {!diff.nodes.length ? (
            <p className="mt-4">Không ghi nhận khác biệt nội dung giữa hai mốc trong kho.</p>
          ) : (
            <ol className="mt-4 grid gap-3">
              {diff.nodes.map((n) => (
                <li key={n.path} className="rounded-xl border border-line p-4">
                  <h3 className="font-semibold">
                    {pathToCitationPhrase(n.path) || n.label} ·{" "}
                    {n.changeKind === "added" ? "Thêm" : n.changeKind === "removed" ? "Bỏ" : "Thay đổi"}
                  </h3>
                  {n.statusBefore !== n.statusAfter ? (
                    <p className="mt-2 text-sm">
                      Trạng thái:{" "}
                      {NODE_STATUS_LABEL[n.statusBefore as keyof typeof NODE_STATUS_LABEL] ||
                        n.statusBefore ||
                        "Chưa có"}{" "}
                      →{" "}
                      {NODE_STATUS_LABEL[n.statusAfter as keyof typeof NODE_STATUS_LABEL] ||
                        n.statusAfter ||
                        "Chưa có"}
                    </p>
                  ) : null}
                  <p className="mt-2 whitespace-pre-wrap break-words">
                    {tokenVoiKhoa(n.tokens).map((w) =>
                      w.kind === "add" ? (
                        <ins key={w.key} className="bg-ok-soft">
                          {w.text}
                        </ins>
                      ) : w.kind === "del" ? (
                        <del key={w.key} className="bg-danger-soft">
                          {w.text}
                        </del>
                      ) : (
                        <span key={w.key}>{w.text}</span>
                      ),
                    )}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}
    </KhungTraCuu>
  );
}
