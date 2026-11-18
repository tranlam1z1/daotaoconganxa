import { Link } from "react-router";
import { getDocumentUrnBySlug, getRelations } from "../lib/api";
import { voiNgay } from "../lib/bo-loc-van-ban";
import { docHref } from "../lib/citation";
import { isIsoDate } from "../lib/format";
import type { Route } from "./+types/document.diagram";
export async function loader({ params, request }: Route.LoaderArgs) {
  const urn = await getDocumentUrnBySlug(params.docType, params.slug);
  const asOf = new URL(request.url).searchParams.get("asOf");
  return { groups: await getRelations(urn), asOf: isIsoDate(asOf) ? asOf : undefined };
}
export default function DocumentDiagram({ loaderData }: Route.ComponentProps) {
  const { groups, asOf } = loaderData;
  return (
    <section>
      <h2 className="text-xl font-semibold">Văn bản liên quan</h2>
      {!groups.some((g) => g.items.length) ? (
        <p className="mt-3 text-ink-2">Chưa có quan hệ văn bản được ghi nhận trong kho.</p>
      ) : (
        groups
          .filter((g) => g.items.length)
          .map((g) => (
            <section key={g.type} className="mt-5">
              <h3 className="font-semibold">{g.label}</h3>
              <ul className="mt-2 grid gap-2">
                {g.items.map((v, i) => (
                  <li key={v.urn + String(i)}>
                    <Link
                      to={voiNgay(docHref(v.docType, v.soKyHieu), asOf)}
                      className="block rounded-btn border border-line p-3 text-primary underline"
                    >
                      {v.title || v.shortTitle}
                      {v.targetLabel ? ` · ${v.targetLabel}` : ""}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
      )}
    </section>
  );
}
