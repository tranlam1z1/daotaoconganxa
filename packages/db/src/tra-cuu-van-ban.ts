/** Tra cứu theo văn bản: đếm trên toàn tập trước phân trang; không lấy mẫu ứng viên RAG. */
import { sql } from "./client.ts";

export interface TraVanBanOptions {
  q: string;
  asOf: string;
  page: number;
  limit: number;
  docType?: string;
  status?: string;
  field?: string;
  issuer?: string;
  locality?: string;
  scope?: "trung_uong" | "dia_phuong";
  family?: string;
  sort: "phu_hop" | "moi_nhat" | "thu_bac";
}
export interface KetQuaVanBan {
  total: number;
  items: Array<
    Record<string, unknown> & {
      matches: Array<{
        path: string;
        label: string;
        heading: string | null;
        snippet: string;
        nodeStatus: string;
      }>;
      match_count: number;
    }
  >;
  facets: Record<string, Array<{ value: string; count: number }>>;
}
export async function traCuuVanBan(o: TraVanBanOptions): Promise<KetQuaVanBan> {
  const q = o.q.trim().replace(/\s+/g, " ");
  const article = /^(?:điều|dieu)\s+(\d+[a-zđ]*)\s*(.*)$/iu.exec(q);
  const dieu = article ? `dieu-${article[1]!.toLowerCase()}` : null;
  const textQuery = article ? article[2]!.replace(/^của\s+/iu, "") : q;
  const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const order =
    o.sort === "moi_nhat"
      ? sql`issued_date DESC NULLS LAST,rank,id`
      : o.sort === "thu_bac"
        ? sql`rank,issued_date DESC NULLS LAST,id`
        : sql`match_rank DESC,node_score DESC,issued_date DESC NULLS LAST,id`;
  const [row] = await sql`
    WITH query AS (SELECT plainto_tsquery('vietnamese',${textQuery}) AS tsq),
    base AS MATERIALIZED (
      SELECT d.*,v.id AS view_version_id,
        CASE WHEN d.document_group='dang' THEN d.status
          WHEN d.effective_to IS NOT NULL AND d.effective_to <= ${o.asOf}::date THEN 'het_hieu_luc'
          WHEN d.effective_from IS NOT NULL AND d.effective_from > ${o.asOf}::date THEN 'chua_hieu_luc'
          WHEN v.id IS NOT NULL THEN v.status
          WHEN d.effective_from IS NOT NULL THEN 'con_hieu_luc'
          ELSE 'khong_xac_dinh' END AS view_status
      FROM documents d LEFT JOIN LATERAL (
        SELECT id,status FROM document_versions v
        WHERE v.document_id=d.id AND v.valid_from<=${o.asOf}::date
          AND (v.valid_to IS NULL OR v.valid_to>${o.asOf}::date)
        ORDER BY v.valid_from DESC,v.version_no DESC LIMIT 1
      ) v ON true WHERE NOT d.is_draft
    ), scoped AS MATERIALIZED (
      SELECT * FROM base d WHERE
        (${o.docType || null}::text IS NULL OR d.doc_type=${o.docType || null})
        AND (${o.family || null}::text IS NULL OR d.document_group=${o.family || null})
        AND (${o.status || null}::text IS NULL OR d.view_status=${o.status || null})
        AND (${o.field || null}::text IS NULL OR ${o.field || null}=ANY(d.fields))
        AND (${o.issuer || null}::text IS NULL OR d.issuer_name=${o.issuer || null})
        AND (${o.locality || null}::text IS NULL OR d.locality=${o.locality || null})
        AND (${o.scope || null}::text IS NULL
          OR (${o.scope || null}='dia_phuong' AND ((d.locality IS NOT NULL AND d.locality<>'') OR d.doc_type IN ('nq-hdnd-t','qd-ubnd-t','qd-ctubnd-t','nq-hdnd-x','qd-ubnd-x')))
          OR (${o.scope || null}='trung_uong' AND (d.locality IS NULL OR d.locality='') AND d.doc_type IN ('hp','bl','l','nq-qh','pl','nq-ubtvqh','nqlt','lenh','qd-ctn','nd','nq-cp','qd-ttg','nq-hdtp','tt','ttlt')))
    ), node_matches AS MATERIALIZED (
      SELECT n.document_id,n.path,n.label,n.heading,n.node_status,
        n.text_plain AS snippet,
        ts_rank_cd(coalesce(n.tsv,to_tsvector('vietnamese',n.text_plain)),query.tsq) AS score,
        row_number() OVER (PARTITION BY n.document_id ORDER BY
          ts_rank_cd(coalesce(n.tsv,to_tsvector('vietnamese',n.text_plain)),query.tsq) DESC,n.ordinal,n.path) AS rn
      FROM scoped d JOIN nodes n ON n.version_id=d.view_version_id CROSS JOIN query
      WHERE ${q}<>'' AND (n.kind IN ('dieu','khoan','diem','phu_luc','bang','doan') OR (d.document_group='dang' AND n.kind IN ('van_ban','phan','chuong','muc')))
        AND n.node_status <> 'repealed'
        AND ((${dieu}::text IS NULL AND (n.tsv @@ query.tsq OR (n.tsv IS NULL AND to_tsvector('vietnamese',n.text_plain) @@ query.tsq)))
          OR (${dieu}::text IS NOT NULL AND (n.path=${dieu} OR n.path LIKE ${dieu ? `${dieu}.%` : null})
            AND (${textQuery}='' OR to_tsvector('vietnamese',d.title||' '||d.short_title||' '||d.so_ky_hieu) @@ query.tsq
              OR (n.tsv @@ query.tsq OR (n.tsv IS NULL AND to_tsvector('vietnamese',n.text_plain) @@ query.tsq)))))
    ), nodes_by_doc AS (
      SELECT document_id,count(*)::int AS match_count,max(score) AS node_score,
        jsonb_agg(jsonb_build_object('path',path,'label',label,'heading',heading,'snippet',ts_headline('vietnamese',snippet,plainto_tsquery('vietnamese',${textQuery}),'StartSel=<mark>, StopSel=</mark>, MaxWords=45, MinWords=20, MaxFragments=1'),'nodeStatus',node_status) ORDER BY rn)
          FILTER(WHERE rn<=3) AS matches FROM node_matches GROUP BY document_id
    ), results AS MATERIALIZED (
      SELECT d.*,coalesce(n.match_count,0) AS match_count,coalesce(n.matches,'[]'::jsonb) AS matches,
        coalesce(n.node_score,0) AS node_score,
        CASE WHEN regexp_replace(unaccent(lower(d.so_ky_hieu)),'\s','','g')=regexp_replace(unaccent(lower(${q})),'\s','','g') THEN 3
          WHEN to_tsvector('vietnamese',d.title||' '||d.short_title||' '||d.so_ky_hieu) @@ query.tsq THEN 2 ELSE 1 END AS match_rank
      FROM scoped d LEFT JOIN nodes_by_doc n ON n.document_id=d.id CROSS JOIN query
      WHERE ${q}='' OR n.document_id IS NOT NULL
        OR (${dieu}::text IS NULL AND (to_tsvector('vietnamese',d.title||' '||d.short_title||' '||d.so_ky_hieu) @@ query.tsq
        OR unaccent(d.so_ky_hieu) ILIKE unaccent(${pattern})
        OR regexp_replace(unaccent(lower(d.so_ky_hieu)),'\s','','g')=regexp_replace(unaccent(lower(${q})),'\s','','g')))
    ), page_rows AS (SELECT * FROM results ORDER BY ${order} LIMIT ${o.limit} OFFSET ${(o.page - 1) * o.limit})
    SELECT (SELECT count(*)::int FROM results) AS total,
      coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY ${order}) FROM page_rows p),'[]'::jsonb) AS items,
      jsonb_build_object(
        'docType',(SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM (SELECT doc_type AS value,count(*)::int AS count FROM base GROUP BY doc_type ORDER BY doc_type) t),
        'family',(SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM (SELECT document_group AS value,count(*)::int AS count FROM base GROUP BY document_group ORDER BY document_group) t),
        'status',(SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM (SELECT view_status AS value,count(*)::int AS count FROM base GROUP BY view_status ORDER BY view_status) t),
        'issuer',(SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM (SELECT issuer_name AS value,count(*)::int AS count FROM base WHERE issuer_name IS NOT NULL GROUP BY issuer_name ORDER BY issuer_name) t),
        'locality',(SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM (SELECT locality AS value,count(*)::int AS count FROM base WHERE locality IS NOT NULL AND locality<>'' GROUP BY locality ORDER BY locality) t),
        'field',(SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM (SELECT f AS value,count(DISTINCT id)::int AS count, coalesce((SELECT name FROM taxonomy tx WHERE tx.code=f LIMIT 1),f) AS label FROM base,unnest(fields) f GROUP BY f ORDER BY f) t)
      ) AS facets
  `;
  return row as unknown as KetQuaVanBan;
}
