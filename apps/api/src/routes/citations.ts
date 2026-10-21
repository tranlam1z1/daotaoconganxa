/** Endpoint phân giải chuỗi viện dẫn thành URN, kèm kiểm tra tồn tại trong CSDL. */

import { findCitations, formatCitation, toUrn } from "@qdpl/citation";
import { docTypeByCode, docUrnOf, parseUrn } from "@qdpl/legal-model";
import { Hono } from "hono";
import { z } from "zod";
import { parseBody, today } from "../http.ts";
import { type ResolvedUrn, resolveNodeUrn } from "../resolve.ts";

const schema = z.object({
  text: z.string().min(1, "Thiếu trường `text`").max(5000, "Chuỗi quá dài (tối đa 5000 ký tự)"),
  /** URN văn bản đang đọc, để phân giải viện dẫn nội bộ ("Nghị định này"). */
  selfDocUrn: z.string().trim().optional(),
  asOf: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải theo định dạng YYYY-MM-DD")
    .optional(),
});

export const citations = new Hono();

citations.post("/resolve", async (c) => {
  const body = await parseBody(c, schema);
  const asOf = body.asOf ?? today();
  const refs = findCitations(body.text);

  const items = await Promise.all(
    refs.map(async (ref) => {
      const urn = toUrn(ref, body.selfDocUrn, undefined);
      let resolved: ResolvedUrn | undefined;
      if (urn) resolved = await resolveNodeUrn(urn, asOf);
      const docType = ref.docType ?? (urn ? parseUrn(urn)?.docType : undefined);
      return {
        raw: ref.raw,
        start: ref.start,
        end: ref.end,
        selfRef: ref.selfRef,
        confidence: ref.confidence,
        dieu: ref.dieu ?? null,
        khoan: ref.khoan ?? null,
        diem: ref.diem ?? null,
        path: ref.path ?? null,
        soKyHieu: ref.soKyHieu ?? null,
        docName: ref.docName ?? null,
        docType: docType ?? null,
        urn: urn ?? null,
        docUrn: urn ? docUrnOf(urn) : null,
        // Kiểm tra thực tế trong CSDL, không chỉ dựa vào cú pháp.
        existsInDb: resolved?.documentFound ?? false,
        nodeFound: resolved?.nodeFound ?? false,
        effectiveAsOf: resolved?.effective ?? false,
        nodeStatus: resolved?.nodeStatus ?? null,
        docStatus: resolved?.docStatus ?? null,
        display:
          ref.soKyHieu && docType
            ? formatCitation({
                path: ref.path,
                docTypeName: docTypeByCode(docType)?.name ?? docType,
                soKyHieu: ref.soKyHieu,
                issuedDate: resolved?.issuedDate ?? undefined,
                issuer: resolved?.issuer ?? undefined,
                title: resolved?.title ?? undefined,
              })
            : ref.raw,
      };
    }),
  );

  return c.json({
    asOf,
    total: items.length,
    resolved: items.filter((i) => i.existsInDb).length,
    items,
  });
});
