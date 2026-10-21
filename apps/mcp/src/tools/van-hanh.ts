/**
 * Công cụ VẬN HÀNH: chẩn đoán kho dữ liệu và xử lý việc biên tập.
 *
 * Các công cụ có ghi dữ liệu chỉ được bật khi đặt QDPL_MCP_ALLOW_WRITE=1.
 * Mặc định server chạy CHỈ ĐỌC: duyệt lệnh sửa đổi hay nạp văn bản là hành vi
 * làm thay đổi nội dung pháp lý người dùng nhìn thấy, không nên để mô hình tự
 * thực hiện khi chưa được cho phép rõ ràng.
 */
import { addReview, checkCitations, enqueue, getAmendOpsFor, sql } from "@qdpl/db";
import { changeDates, consolidate, deriveDocStatus, serializeDocument } from "@qdpl/legal-model";
import { z } from "zod";
import {
  errorResult,
  isoDate,
  mustResolve,
  normalizeAsOf,
  result,
  STATUS_LABEL,
  ToolError,
} from "../context.ts";
import type { ToolRegistrar } from "../registrar.ts";

export function writeEnabled(): boolean {
  return process.env.QDPL_MCP_ALLOW_WRITE === "1";
}

function requireWrite(): void {
  if (!writeEnabled()) {
    throw new ToolError(
      "Server đang chạy ở chế độ CHỈ ĐỌC. Công cụ này thay đổi dữ liệu pháp lý nên bị chặn. " +
        "Người vận hành cần đặt QDPL_MCP_ALLOW_WRITE=1 rồi khởi động lại server.",
    );
  }
}

export function registerOpsTools(reg: ToolRegistrar): void {
  reg.add(
    "thong_ke_kho",
    {
      title: "Thống kê kho văn bản",
      description:
        "Số lượng văn bản, phiên bản, nút, quan hệ, lệnh sửa đổi; phân bố theo loại và trạng thái.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const [t] = (await sql`
          SELECT (SELECT count(*) FROM documents) AS van_ban,
                 (SELECT count(*) FROM document_versions) AS phien_ban,
                 (SELECT count(*) FROM nodes) AS nut,
                 (SELECT count(*) FROM nodes WHERE kind='dieu') AS dieu,
                 (SELECT count(*) FROM relations) AS quan_he,
                 (SELECT count(*) FROM amendment_ops) AS lenh_sua_doi,
                 (SELECT count(*) FROM amendment_ops WHERE review_status='pending') AS lenh_cho_duyet,
                 (SELECT count(*) FROM review_queue WHERE state='open') AS viec_bien_tap,
                 (SELECT count(*) FROM embeddings) AS vector`) as any[];
        const byType = (await sql`
          SELECT doc_type, count(*)::int AS n FROM documents GROUP BY 1 ORDER BY 2 DESC LIMIT 12`) as any[];
        const byStatus = (await sql`
          SELECT status, count(*)::int AS n FROM documents GROUP BY 1 ORDER BY 2 DESC`) as any[];
        const text =
          `Kho văn bản:\n` +
          `  văn bản: ${t.van_ban} | phiên bản: ${t.phien_ban} | nút: ${t.nut} (điều: ${t.dieu})\n` +
          `  quan hệ: ${t.quan_he} | lệnh sửa đổi: ${t.lenh_sua_doi} (chờ duyệt: ${t.lenh_cho_duyet})\n` +
          `  việc biên tập đang mở: ${t.viec_bien_tap} | vector đã đánh chỉ mục: ${t.vector}\n\n` +
          `Theo loại: ${byType.map((r) => `${r.doc_type}=${r.n}`).join(", ")}\n` +
          `Theo trạng thái: ${byStatus.map((r) => `${STATUS_LABEL[r.status] ?? r.status}=${r.n}`).join(", ")}`;
        return result(text, { tong_hop: t, theo_loai: byType, theo_trang_thai: byStatus });
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  reg.add(
    "kiem_tra_suc_khoe_du_lieu",
    {
      title: "Kiểm tra sức khỏe dữ liệu",
      description:
        "Phát hiện lỗi dữ liệu: phiên bản không có nút (parse hỏng), điều thiếu tiêu đề, tiêu đề nuốt nội dung, " +
        "khoản rỗng, payload lệnh sửa đổi sai kiểu, lệnh chờ duyệt quá hạn, viện dẫn hỏng. " +
        "Dùng khi nghi ngờ dữ liệu có vấn đề hoặc trước khi phát hành.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const checks: Array<{
          ten: string;
          gia_tri: number;
          nguong: string;
          dat: boolean;
          chi_tiet?: string;
        }> = [];
        const one = async (ten: string, q: Promise<any>, nguong: string) => {
          const [r] = (await q) as any[];
          const v = Number(r?.c ?? 0);
          checks.push({ ten, gia_tri: v, nguong, dat: v === 0 });
        };
        await one(
          "Phiên bản không có nút (parse hỏng)",
          sql`SELECT count(*)::int c FROM document_versions v WHERE NOT EXISTS (SELECT 1 FROM nodes n WHERE n.version_id=v.id)`,
          "= 0",
        );
        await one(
          "Điều có tiêu đề quá dài (nghi nuốt nội dung)",
          sql`SELECT count(*)::int c FROM nodes WHERE kind='dieu' AND length(heading) > 200`,
          "= 0",
        );
        await one(
          "Khoản/điểm rỗng không có con",
          sql`SELECT count(*)::int c FROM nodes n WHERE n.kind IN ('khoan','diem') AND coalesce(n.text_md,'')=''
              AND NOT EXISTS (SELECT 1 FROM nodes c WHERE c.version_id=n.version_id AND c.path LIKE n.path || '.%')`,
          "= 0",
        );
        await one(
          "payload lệnh sửa đổi sai kiểu",
          sql`SELECT count(*)::int c FROM amendment_ops WHERE payload IS NOT NULL AND jsonb_typeof(payload) <> 'object'`,
          "= 0",
        );
        await one(
          "Lệnh sửa đổi chờ duyệt quá 7 ngày",
          sql`SELECT count(*)::int c FROM amendment_ops WHERE review_status='pending' AND created_at < now() - interval '7 days'`,
          "= 0",
        );
        await one(
          "Nút trùng path trong cùng phiên bản",
          sql`SELECT count(*)::int c FROM (SELECT version_id, path FROM nodes WHERE path <> '' GROUP BY 1,2 HAVING count(*)>1) t`,
          "= 0",
        );
        const bad = checks.filter((c) => !c.dat);
        const lines = checks.map(
          (c) => `${c.dat ? "[ĐẠT]" : "[LỖI]"} ${c.ten}: ${c.gia_tri} (ngưỡng ${c.nguong})`,
        );
        return result(
          `Kiểm tra sức khỏe dữ liệu:\n${lines.join("\n")}\n\n` +
            (bad.length
              ? `${bad.length} chỉ số KHÔNG đạt — cần xử lý trước khi phát hành.`
              : "Toàn bộ chỉ số đạt."),
          { so_chi_so: checks.length, khong_dat: bad.length, chi_tiet: checks },
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  reg.add(
    "hang_doi_bien_tap",
    {
      title: "Xem hàng đợi biên tập",
      description:
        "Liệt kê việc đang chờ người biên tập xử lý: cảnh báo chuyển đổi, lệnh sửa đổi cần duyệt, " +
        "thay đổi trạng thái hiệu lực, viện dẫn hỏng, báo sai từ người dùng.",
      inputSchema: {
        loai: z.string().optional().describe("conversion, amend_op, status_change, citation, user_report"),
        so_luong: z.number().int().min(1).max(100).optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const limit = args.so_luong ?? 20;
        const rows = (await sql`
          SELECT id, kind, ref_id, document_urn, priority, payload, created_at
          FROM review_queue
          WHERE state='open' AND (${args.loai ?? null}::text IS NULL OR kind = ${args.loai ?? null})
          ORDER BY priority DESC, created_at ASC LIMIT ${limit}`) as any[];
        if (!rows.length) return result("Hàng đợi biên tập trống.", { so_luong: 0, viec: [] });
        const lines = rows.map(
          (r) =>
            `- [${r.kind}] ưu tiên ${r.priority} | ${r.document_urn ?? ""}\n  id: ${r.id}\n  ${JSON.stringify(r.payload).slice(0, 220)}`,
        );
        return result(`${rows.length} việc đang mở:\n${lines.join("\n")}`, {
          so_luong: rows.length,
          viec: rows,
        });
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  reg.add(
    "ra_soat_vien_dan",
    {
      title: "Rà soát sức khỏe viện dẫn của nội dung biên tập",
      description:
        "Kiểm tra toàn bộ viện dẫn trong trường hợp ứng dụng và bài học: căn cứ nào đã đổi câu chữ, " +
        "bị bãi bỏ hoặc không còn tồn tại. Chạy sau mỗi lần hợp nhất hoặc định kỳ.",
      inputSchema: {
        as_of: z.string().optional(),
        tao_viec_bien_tap: z
          .boolean()
          .optional()
          .describe("Có tạo việc trong hàng đợi biên tập hay không (cần quyền ghi)."),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (args) => {
      try {
        const asOf = normalizeAsOf(args.as_of);
        if (args.tao_viec_bien_tap) requireWrite();
        const r = await checkCitations({ asOf, enqueueReview: args.tao_viec_bien_tap ?? false });
        const lines = r.issues.map(
          (i) => `- [${i.health}] ${i.ownerKind} ${i.ownerId}\n    ${i.nodeUrn}\n    ${i.detail}`,
        );
        return result(
          `Đã rà soát ${r.total} viện dẫn tại ngày ${asOf}:\n` +
            `  còn đúng: ${r.ok} | đã đổi: ${r.changed} | bị bãi bỏ: ${r.repealed} | không tìm thấy: ${r.missing}\n` +
            (lines.length ? `\nCần xử lý:\n${lines.join("\n")}` : "\nKhông có viện dẫn nào cần xử lý."),
          { as_of: asOf, ...r },
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  reg.add(
    "xem_lenh_sua_doi",
    {
      title: "Xem lệnh sửa đổi của một văn bản",
      description:
        "Liệt kê các lệnh sửa đổi tác động tới một văn bản, kèm trạng thái duyệt và độ tin cậy trích xuất. " +
        "Dùng để rà soát trước khi duyệt.",
      inputSchema: {
        van_ban: z.string().describe("Văn bản BỊ sửa đổi."),
        chi_cho_duyet: z.boolean().optional().describe("Chỉ lấy lệnh đang chờ duyệt."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const doc = await mustResolve(args.van_ban);
        let ops = await getAmendOpsFor(doc.urn);
        if (args.chi_cho_duyet) ops = ops.filter((o) => o.reviewStatus !== "approved");
        if (!ops.length)
          return result(`${doc.shortTitle}: không có lệnh sửa đổi nào.`, { urn: doc.urn, lenh: [] });
        const lines = ops.map(
          (o) =>
            `- ${o.op} tại "${o.targetPath || "(cấp văn bản)"}" hiệu lực ${o.effectiveFrom}\n` +
            `  nguồn: ${o.amendingLabel ?? ""} của ${o.amendingDocUrn}\n` +
            `  duyệt: ${o.reviewStatus} | trích xuất: ${o.extraction} | tin cậy: ${o.confidence}\n` +
            (o.payload?.text
              ? `  nội dung mới: ${o.payload.text.replace(/\s+/g, " ").slice(0, 180)}\n`
              : "") +
            `  id: ${o.id}`,
        );
        return result(`${doc.shortTitle}: ${ops.length} lệnh sửa đổi\n${lines.join("\n")}`, {
          urn: doc.urn,
          so_luong: ops.length,
          lenh: ops,
        });
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  reg.add(
    "thu_hop_nhat",
    {
      title: "Thử hợp nhất (không ghi dữ liệu)",
      description:
        "Chạy thử engine hợp nhất tại một thời điểm và cho biết kết quả: bao nhiêu lệnh áp được, " +
        "có xung đột gì, nội dung sau hợp nhất ra sao. KHÔNG thay đổi dữ liệu. " +
        "Dùng để kiểm tra trước khi duyệt lệnh sửa đổi.",
      inputSchema: {
        van_ban: z.string(),
        as_of: z.string().optional(),
        gom_ca_lenh_chua_duyet: z
          .boolean()
          .optional()
          .describe("Thử cả lệnh chưa duyệt để xem trước kết quả."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const asOf = normalizeAsOf(args.as_of);
        const doc = await mustResolve(args.van_ban);
        const [v] = (await sql`
          SELECT tree FROM document_versions WHERE document_id=${doc.id} AND kind='original' LIMIT 1`) as any[];
        if (!v) throw new ToolError("Văn bản chưa có phiên bản gốc trong kho.");
        let ops = await getAmendOpsFor(doc.urn);
        if (args.gom_ca_lenh_chua_duyet) ops = ops.map((o) => ({ ...o, reviewStatus: "approved" as const }));
        const r = consolidate(v.tree, ops, asOf);
        const status = deriveDocStatus(
          r.root,
          { effectiveFrom: doc.effectiveFrom ?? undefined, effectiveTo: doc.effectiveTo ?? undefined },
          asOf,
        );
        const dates = changeDates(ops);
        const md = serializeDocument(r.root, { footnotes: true, asOf });
        return result(
          `Thử hợp nhất ${doc.shortTitle} tại ngày ${asOf}:\n` +
            `  áp dụng: ${r.applied.length}/${ops.length} lệnh\n` +
            `  xung đột: ${r.conflicts.length}${r.conflicts.length ? `\n${r.conflicts.map((c) => `    - ${c.reason}`).join("\n")}` : ""}\n` +
            `  trạng thái sau hợp nhất: ${STATUS_LABEL[status] ?? status}\n` +
            `  các mốc thời gian nội dung thay đổi: ${dates.join(", ") || "(không có)"}\n\n` +
            `Trích 2000 ký tự đầu của bản hợp nhất:\n---\n${md.slice(0, 2000)}`,
          {
            urn: doc.urn,
            as_of: asOf,
            ap_dung: r.applied.length,
            tong_lenh: ops.length,
            xung_dot: r.conflicts,
            trang_thai: status,
            moc_thay_doi: dates,
          },
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  reg.add(
    "duyet_lenh_sua_doi",
    {
      title: "Duyệt hoặc từ chối lệnh sửa đổi",
      description:
        "GHI DỮ LIỆU. Đổi trạng thái duyệt của một lệnh sửa đổi và đẩy job hợp nhất lại. " +
        "Chỉ dùng sau khi đã xem bằng xem_lenh_sua_doi và thử bằng thu_hop_nhat. " +
        "Việc duyệt làm thay đổi nội dung pháp lý mà người dùng cuối nhìn thấy.",
      inputSchema: {
        id_lenh: z.string().describe("id của lệnh sửa đổi."),
        quyet_dinh: z.enum(["duyet", "tu_choi", "can_phap_che"]),
        nguoi_duyet: z.string().describe("Định danh người chịu trách nhiệm cho quyết định này."),
        ghi_chu: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        requireWrite();
        const map: Record<string, "approved" | "rejected" | "needs_legal"> = {
          duyet: "approved",
          tu_choi: "rejected",
          can_phap_che: "needs_legal",
        };
        const status = map[args.quyet_dinh as string];
        if (!status) throw new ToolError(`Quyết định không hợp lệ: ${args.quyet_dinh}`);
        const [row] = (await sql`
          UPDATE amendment_ops
          SET review_status=${status}, reviewer_id=${args.nguoi_duyet}, reviewed_at=now(),
              notes=COALESCE(${args.ghi_chu ?? null}, notes)
          WHERE id=${args.id_lenh}
          RETURNING id, target_doc_urn, op, target_path, effective_from`) as any[];
        if (!row) throw new ToolError(`Không có lệnh sửa đổi nào với id ${args.id_lenh}.`);
        let jobId: string | undefined;
        if (status === "approved") {
          jobId = await enqueue(
            "consolidate",
            { targetDocUrn: row.target_doc_urn, opId: row.id },
            { priority: 5 },
          );
        }
        await sql`INSERT INTO audit_log (actor, action, target, detail)
                  VALUES (${args.nguoi_duyet}, ${`amend_op:${args.quyet_dinh}`}, ${args.id_lenh},
                          ${sql.json({ qua: "mcp", ghi_chu: args.ghi_chu ?? null } as any)})`;
        return result(
          `Đã ghi quyết định "${args.quyet_dinh}" cho lệnh ${row.op} tại ${row.target_path || "(cấp văn bản)"} ` +
            `của ${row.target_doc_urn} (hiệu lực ${isoDate(row.effective_from) ?? "?"}).` +
            (jobId ? `\nĐã đẩy job hợp nhất lại: ${jobId}.` : ""),
          { id: row.id, trang_thai: status, job_hop_nhat: jobId ?? null },
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  reg.add(
    "xu_ly_viec_bien_tap",
    {
      title: "Đóng một việc trong hàng đợi biên tập",
      description: "GHI DỮ LIỆU. Đánh dấu một việc đã xử lý, kèm ghi chú cách xử lý.",
      inputSchema: {
        id_viec: z.string(),
        ket_qua: z.string().describe("Mô tả ngắn cách đã xử lý."),
        nguoi_xu_ly: z.string(),
      },
      annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        requireWrite();
        const [row] = (await sql`
          UPDATE review_queue SET state='resolved', resolution=${args.ket_qua}, assignee=${args.nguoi_xu_ly}, resolved_at=now()
          WHERE id=${args.id_viec} RETURNING id, kind`) as any[];
        if (!row) throw new ToolError(`Không có việc nào với id ${args.id_viec}.`);
        await sql`INSERT INTO audit_log (actor, action, target, detail)
                  VALUES (${args.nguoi_xu_ly}, 'review:resolve', ${args.id_viec}, ${sql.json({ qua: "mcp", ket_qua: args.ket_qua } as any)})`;
        return result(`Đã đóng việc ${row.kind} (${row.id}).`, { id: row.id });
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  reg.add(
    "bao_van_de",
    {
      title: "Báo một vấn đề cho người biên tập",
      description:
        "GHI DỮ LIỆU. Tạo việc trong hàng đợi biên tập khi phát hiện nội dung sai, thiếu, hoặc căn cứ đáng ngờ. " +
        "Dùng công cụ này thay vì tự sửa dữ liệu.",
      inputSchema: {
        mo_ta: z.string().min(10).describe("Mô tả vấn đề, càng cụ thể càng tốt."),
        urn_lien_quan: z.string().optional(),
        muc_do: z.enum(["thap", "trung_binh", "cao"]).optional(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (args) => {
      try {
        requireWrite();
        const priority = args.muc_do === "cao" ? 10 : args.muc_do === "trung_binh" ? 5 : 1;
        const id = await addReview({
          kind: "user_report",
          refId: `mcp-${Date.now()}`,
          ...(args.urn_lien_quan ? { documentUrn: args.urn_lien_quan } : {}),
          priority,
          payload: { mo_ta: args.mo_ta, nguon: "mcp" },
        });
        return result(`Đã tạo việc biên tập ${id} với mức ưu tiên ${priority}.`, { id, uu_tien: priority });
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}
