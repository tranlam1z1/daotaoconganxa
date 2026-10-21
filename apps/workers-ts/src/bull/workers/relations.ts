/**
 * Giai đoạn 8 — QUAN HỆ: trích `can_cu` / `huong_dan` / `dan_chieu` / `cha_con`
 * từ chính câu chữ của văn bản (ke-hoach/04 §3.1: tự suy ra, kiểm chứng được,
 * thay vì chép lược đồ của bên thứ ba).
 */
import { getDocumentByUrn } from "@qdpl/db";
import { QUEUES } from "@qdpl/queue";
import { extractRelationsForDocument } from "../../pipeline/relations.ts";
import { defineStage } from "../stage.ts";

export const relationsStage = defineStage(QUEUES.relations, async (job, ctx) => {
  const { documentUrn } = job.data;
  const doc = await getDocumentByUrn(documentUrn);
  if (!doc) throw new Error(`Không có văn bản ${documentUrn} trong CSDL`);

  const r = await extractRelationsForDocument(doc.id);
  await ctx.progress(90, `${r.saved} quan hệ`);

  return {
    documentId: doc.id,
    documentUrn,
    detail: { canCu: r.canCu, huongDan: r.huongDan, danChieu: r.danChieu, chaCon: r.chaCon, saved: r.saved },
  };
});
