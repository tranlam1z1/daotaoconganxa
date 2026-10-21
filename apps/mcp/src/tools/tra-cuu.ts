/**
 * Công cụ TRA CỨU (chỉ đọc): tìm kiếm, đọc văn bản theo thời điểm, quan hệ,
 * so sánh phiên bản, phân giải và kiểm chứng viện dẫn.
 *
 * Thiết kế cho phía gọi là một mô hình ngôn ngữ: server KHÔNG tự sinh câu trả lời,
 * chỉ cung cấp căn cứ đã kiểm chứng để mô hình tự lập luận và trích dẫn.
 */
import { findCitations, formatCitation, toUrn } from "@qdpl/citation";
import { getAmendOpsFor, getStatusAsOf, getVersionAsOf, sql } from "@qdpl/db";
import {
  compareAuthority,
  consolidate,
  diffTrees,
  type LegalNode,
  parseUrn,
  serializeDocument,
  toAkomaNtoso,
  walk,
} from "@qdpl/legal-model";
import { search } from "@qdpl/search";
import { z } from "zod";
import {
  docTypeName,
  errorResult,
  isoDate,
  mustResolve,
  normalizeAsOf,
  result,
  STATUS_LABEL,
  ToolError,
  today,
} from "../context.ts";
import type { ToolRegistrar } from "../registrar.ts";

const AS_OF = z
  .string()
  .optional()
  .describe(
    "Thời điểm tra cứu, dạng YYYY-MM-DD. Bỏ trống thì lấy hôm nay. Đây là trục chính của mọi truy vấn.",
  );

/** Lấy cây nút của một văn bản tại một thời điểm, đã hợp nhất. */
async function treeAsOf(docId: string, docUrn: string, asOf: string) {
  const version: any = await getVersionAsOf(docId, asOf);
  if (!version) throw new ToolError(`Văn bản chưa có phiên bản nội dung nào trong kho.`);
  let root = version.tree as LegalNode;
  let conflicts: Array<{ reason: string }> = [];
  let applied = 0;
  if (version.kind === "original") {
    // Phiên bản gốc: áp các lệnh sửa đổi đã duyệt để dựng nội dung tại thời điểm.
    const ops = await getAmendOpsFor(docUrn);
    if (ops.length) {
      const r = consolidate(root, ops, asOf);
      root = r.root;
      applied = r.applied.length;
      conflicts = r.conflicts.map((c) => ({ reason: c.reason }));
    }
  }
  return { root, version, applied, conflicts };
}

function findNode(root: LegalNode, path: string): LegalNode | undefined {
  let hit: LegalNode | undefined;
  walk(root, (n) => {
    if (n.path === path) hit = n;
  });
  return hit;
}

export function registerLookupTools(reg: ToolRegistrar): void {
  reg.add(
    "tim_kiem_quy_dinh",
    {
      title: "Tìm kiếm quy định",
      description:
        "Tìm điều/khoản/điểm liên quan tới một câu hỏi hoặc từ khóa, tại một thời điểm hiệu lực. " +
        "Kết hợp tìm theo từ khóa, theo ngữ nghĩa và khớp viện dẫn. " +
        "Dùng công cụ này TRƯỚC khi trả lời bất kỳ câu hỏi pháp lý nào — không trả lời theo trí nhớ.",
      inputSchema: {
        cau_hoi: z
          .string()
          .min(2)
          .describe("Câu hỏi hoặc từ khóa. Có thể là viện dẫn: 'khoản 2 Điều 15 NĐ 45/2026'."),
        as_of: AS_OF,
        loai_van_ban: z
          .array(z.string())
          .optional()
          .describe("Lọc theo mã loại: hp, l, bl, pl, nd, tt, qd-ttg, nq-hdnd-t..."),
        thu_bac_toi_da: z
          .number()
          .int()
          .optional()
          .describe(
            "Chỉ lấy văn bản có thứ bậc hiệu lực từ mức này trở lên (số nhỏ = cao hơn). Ví dụ 50 = đến Nghị định.",
          ),
        linh_vuc: z.array(z.string()).optional().describe("Lọc theo lĩnh vực."),
        gom_het_hieu_luc: z
          .boolean()
          .optional()
          .describe("Có lấy cả nội dung đã bị bãi bỏ hay không. Mặc định không."),
        so_luong: z.number().int().min(1).max(50).optional().describe("Số kết quả, mặc định 10."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const asOf = normalizeAsOf(args.as_of);
        const res = await search({
          q: args.cau_hoi,
          asOf,
          ...(args.loai_van_ban ? { docTypes: args.loai_van_ban } : {}),
          ...(args.thu_bac_toi_da !== undefined ? { rankMax: args.thu_bac_toi_da } : {}),
          ...(args.linh_vuc ? { fields: args.linh_vuc } : {}),
          includeRepealed: args.gom_het_hieu_luc ?? false,
          limit: args.so_luong ?? 10,
        });
        if (!res.hits.length) {
          return result(
            `Không tìm thấy quy định nào khớp "${args.cau_hoi}" tại ngày ${asOf}.\n` +
              "Gợi ý: thử từ khóa khác, mở rộng thời điểm, hoặc bật gom_het_hieu_luc để tra cứu lịch sử.",
            { as_of: asOf, so_ket_qua: 0, ket_qua: [] },
          );
        }
        const lines = res.hits.map((h: any, i: number) => {
          const cite = formatCitation({
            path: h.path,
            docTypeName: docTypeName(h.docType),
            soKyHieu: h.soKyHieu,
            short: true,
          });
          const flag =
            h.nodeStatus === "repealed"
              ? " [ĐÃ BỊ BÃI BỎ]"
              : h.nodeStatus === "suspended"
                ? " [NGƯNG HIỆU LỰC]"
                : "";
          return (
            `${i + 1}. ${cite}${flag}\n` +
            `   URN: ${h.urn}\n` +
            `   ${h.contextPath ?? h.docTitle ?? ""}\n` +
            `   ${(h.snippet ?? h.text ?? "").replace(/\s+/g, " ").slice(0, 300)}`
          );
        });
        return result(
          `Tìm thấy ${res.hits.length} kết quả tại ngày ${asOf} cho "${args.cau_hoi}":\n\n${lines.join("\n\n")}\n\n` +
            "Dùng doc_dieu_khoan để đọc nguyên văn trước khi trích dẫn.",
          { as_of: asOf, so_ket_qua: res.hits.length, ket_qua: res.hits },
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  reg.add(
    "doc_van_ban",
    {
      title: "Đọc toàn văn văn bản tại một thời điểm",
      description:
        "Trả về nội dung văn bản đã hợp nhất tại thời điểm chỉ định, kèm chú thích sửa đổi. " +
        "Có thể đọc một phần bằng tham số duong_dan (ví dụ 'dieu-15' hoặc 'chuong-2').",
      inputSchema: {
        van_ban: z.string().describe("URN, số ký hiệu ('45/2026/NĐ-CP') hoặc tên gần đúng."),
        as_of: AS_OF,
        duong_dan: z
          .string()
          .optional()
          .describe("Chỉ đọc một nhánh, ví dụ 'dieu-15' hoặc 'dieu-15.khoan-2'."),
        dinh_dang: z
          .enum(["markdown", "akoma-ntoso"])
          .optional()
          .describe("Mặc định markdown. akoma-ntoso để liên thông dữ liệu."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const asOf = normalizeAsOf(args.as_of);
        const doc = await mustResolve(args.van_ban);
        const { root, version, applied, conflicts } = await treeAsOf(doc.id, doc.urn, asOf);
        const statusAsOf = await getStatusAsOf(doc.id, asOf);

        let subtree = root;
        if (args.duong_dan) {
          const hit = findNode(root, args.duong_dan);
          if (!hit)
            throw new ToolError(`Không có nút "${args.duong_dan}" trong ${doc.soKyHieu} tại ngày ${asOf}.`);
          subtree = { ...root, children: [hit] };
        }

        const body =
          args.dinh_dang === "akoma-ntoso"
            ? toAkomaNtoso(
                subtree,
                {
                  urn: doc.urn,
                  docType: doc.docType,
                  rank: doc.rank,
                  isNormative: true,
                  soKyHieu: doc.soKyHieu,
                  title: doc.title,
                  shortTitle: doc.shortTitle,
                  issuer: doc.issuer ?? "",
                  issuedDate: doc.issuedDate ?? "",
                  fields: [],
                  status: statusAsOf as any,
                },
                { asOf, notes: true },
              )
            : serializeDocument(subtree, { footnotes: true, asOf });

        const header =
          `${doc.shortTitle} — ${doc.title}\n` +
          `URN: ${doc.urn}\n` +
          `Cơ quan ban hành: ${doc.issuer ?? "?"} | Ngày ban hành: ${doc.issuedDate ?? "?"}\n` +
          `Trạng thái tại ngày ${asOf}: ${STATUS_LABEL[statusAsOf] ?? statusAsOf}\n` +
          `Phiên bản: ${version.kind}${applied ? ` (đã áp dụng ${applied} lệnh sửa đổi)` : ""}\n` +
          (conflicts.length
            ? `CẢNH BÁO: ${conflicts.length} lệnh sửa đổi không áp được — nội dung có thể chưa đầy đủ:\n` +
              conflicts.map((c) => `  - ${c.reason}`).join("\n") +
              "\n"
            : "") +
          (version.kind === "consolidated_auto"
            ? "Đây là bản hợp nhất do hệ thống tạo, dùng để tham khảo. Căn cứ chính thức là văn bản hợp nhất của cơ quan nhà nước hoặc các văn bản được hợp nhất.\n"
            : "");

        return result(`${header}\n---\n\n${body}`, {
          urn: doc.urn,
          as_of: asOf,
          trang_thai: statusAsOf,
          loai_phien_ban: version.kind,
          so_lenh_da_ap_dung: applied,
          xung_dot: conflicts,
        });
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  reg.add(
    "doc_dieu_khoan",
    {
      title: "Đọc một điều/khoản/điểm kèm lịch sử sửa đổi",
      description:
        "Đọc nguyên văn một nút cụ thể tại thời điểm chỉ định, kèm trạng thái và toàn bộ lịch sử sửa đổi của nút đó. " +
        "Dùng trước khi trích dẫn để bảo đảm trích đúng câu chữ đang có hiệu lực.",
      inputSchema: {
        urn_nut: z
          .string()
          .describe(
            "URN có phần nút, ví dụ 'vn:vbqppl:nd:45/2026/NĐ-CP#dieu-15.khoan-2'. Hoặc dùng cặp van_ban + duong_dan.",
          ),
        as_of: AS_OF,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const asOf = normalizeAsOf(args.as_of);
        const [docPart, path] = args.urn_nut.split("#");
        if (!path) throw new ToolError("Thiếu phần nút sau dấu '#'. Ví dụ: ...#dieu-15.khoan-2");
        const doc = await mustResolve(docPart!);
        const { root } = await treeAsOf(doc.id, doc.urn, asOf);
        const node = findNode(root, path.split("@")[0]!);
        if (!node) throw new ToolError(`Không có nút "${path}" trong ${doc.soKyHieu} tại ngày ${asOf}.`);

        const ops = (await getAmendOpsFor(doc.urn)).filter(
          (o) => o.targetPath === node.path || node.path.startsWith(`${o.targetPath}.`),
        );
        const history = ops.length
          ? ops
              .map(
                (o) =>
                  `  - ${o.effectiveFrom}: ${o.op} theo ${o.amendingLabel ?? ""} của ${o.amendingDocUrn} (trạng thái duyệt: ${o.reviewStatus})`,
              )
              .join("\n")
          : "  (chưa có lệnh sửa đổi nào)";

        const cite = formatCitation({
          path: node.path,
          docTypeName: docTypeName(doc.docType),
          soKyHieu: doc.soKyHieu,
          issuedDate: doc.issuedDate ?? undefined,
          issuer: doc.issuer ?? undefined,
          title: doc.title,
        });

        return result(
          `Viện dẫn chuẩn: ${cite}\n` +
            `URN: ${doc.urn}#${node.path}@${asOf}\n` +
            `Trạng thái nút: ${node.status}${node.status === "repealed" ? " — KHÔNG ĐƯỢC dùng làm căn cứ" : ""}\n` +
            (node.note ? `Chú thích hợp nhất: ${node.note}\n` : "") +
            `\nNguyên văn:\n${node.label} ${node.heading ? `${node.heading}\n` : ""}${node.text}\n` +
            (node.children.length
              ? `\nNội dung con:\n${node.children.map((c) => `${c.label} ${c.text}`).join("\n")}\n`
              : "") +
            `\nLịch sử sửa đổi của nút này:\n${history}`,
          { urn: `${doc.urn}#${node.path}`, as_of: asOf, trang_thai: node.status, vien_dan: cite },
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  reg.add(
    "kiem_tra_can_cu",
    {
      title: "Kiểm chứng danh sách căn cứ trước khi kết luận",
      description:
        "BẮT BUỘC dùng trước khi đưa ra kết luận pháp lý. Nhận danh sách viện dẫn (URN hoặc chuỗi tiếng Việt) " +
        "và kiểm tra từng cái: có tồn tại không, có hiệu lực tại thời điểm không, có bị bãi bỏ không, " +
        "câu chữ hiện tại là gì. Trả về cảnh báo rõ ràng cho từng căn cứ không hợp lệ.",
      inputSchema: {
        can_cu: z
          .array(z.string())
          .min(1)
          .describe(
            "Danh sách viện dẫn: URN đầy đủ hoặc chuỗi như 'khoản 2 Điều 15 Nghị định 45/2026/NĐ-CP'.",
          ),
        as_of: AS_OF,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const asOf = normalizeAsOf(args.as_of);
        const checks: Array<Record<string, unknown>> = [];
        const lines: string[] = [];

        for (const raw of args.can_cu) {
          let urn = raw.trim();
          if (!urn.startsWith("vn:")) {
            const found = findCitations(urn);
            const resolved = found.map((c) => toUrn(c)).find(Boolean);
            if (!resolved) {
              checks.push({ dau_vao: raw, hop_le: false, ly_do: "Không phân giải được thành URN" });
              lines.push(`[KHÔNG HỢP LỆ] "${raw}" — không phân giải được thành URN văn bản.`);
              continue;
            }
            urn = resolved;
          }
          const p = parseUrn(urn);
          const docUrn = urn.split("#")[0]!.split("@")[0]!;
          const [row] = (await sql`SELECT * FROM documents WHERE urn = ${docUrn} LIMIT 1`) as any[];
          if (!row) {
            checks.push({ dau_vao: raw, urn, hop_le: false, ly_do: "Văn bản không có trong kho" });
            lines.push(`[KHÔNG CÓ TRONG KHO] ${urn} — chưa nạp văn bản này, không được dùng làm căn cứ.`);
            continue;
          }
          const statusAsOf = await getStatusAsOf(row.id, asOf);
          if (!p?.path) {
            const ok = statusAsOf === "con_hieu_luc" || statusAsOf === "het_hieu_luc_mot_phan";
            checks.push({ dau_vao: raw, urn, hop_le: ok, trang_thai: statusAsOf });
            lines.push(
              `${ok ? "[HỢP LỆ]" : "[CẢNH BÁO]"} ${urn} — ${STATUS_LABEL[statusAsOf] ?? statusAsOf} tại ${asOf}.`,
            );
            continue;
          }
          const { root } = await treeAsOf(row.id, row.urn, asOf);
          const node = findNode(root, p.path);
          if (!node) {
            checks.push({ dau_vao: raw, urn, hop_le: false, ly_do: "Nút không tồn tại tại thời điểm" });
            lines.push(`[KHÔNG TỒN TẠI] ${urn} — không có nút này trong văn bản tại ngày ${asOf}.`);
            continue;
          }
          const ok = node.status !== "repealed" && node.status !== "suspended";
          checks.push({
            dau_vao: raw,
            urn,
            hop_le: ok,
            trang_thai_nut: node.status,
            trang_thai_van_ban: statusAsOf,
            nguyen_van: node.text,
          });
          lines.push(
            `${ok ? "[HỢP LỆ]" : "[KHÔNG ĐƯỢC DÙNG]"} ${urn}\n` +
              `   trạng thái nút: ${node.status}; văn bản: ${STATUS_LABEL[statusAsOf] ?? statusAsOf}\n` +
              `   nguyên văn: ${node.text.replace(/\s+/g, " ").slice(0, 220)}` +
              (node.note ? `\n   ${node.note}` : ""),
          );
        }

        const bad = checks.filter((c) => !c.hop_le).length;
        return result(
          `Đã kiểm chứng ${checks.length} căn cứ tại ngày ${asOf}. ${bad ? `${bad} căn cứ KHÔNG dùng được.` : "Tất cả hợp lệ."}\n\n` +
            lines.join("\n") +
            (bad ? "\n\nKhông được kết luận dựa trên các căn cứ không hợp lệ ở trên." : ""),
          { as_of: asOf, tong: checks.length, khong_hop_le: bad, chi_tiet: checks },
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  reg.add(
    "phan_giai_vien_dan",
    {
      title: "Phân giải chuỗi viện dẫn tiếng Việt thành URN",
      description:
        "Chuyển chuỗi như 'điểm a khoản 2 Điều 15 Nghị định số 45/2026/NĐ-CP' thành URN. " +
        "Xử lý được dạng liệt kê, khoảng điều, viết tắt và trật tự ngược.",
      inputSchema: {
        van_ban_dau_vao: z.string().min(2).describe("Đoạn văn bản chứa một hoặc nhiều viện dẫn."),
        urn_van_ban_hien_tai: z
          .string()
          .optional()
          .describe("URN của văn bản đang đọc, để phân giải viện dẫn nội bộ như 'Điều 5 của Nghị định này'."),
        as_of: AS_OF,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const asOf = normalizeAsOf(args.as_of);
        const refs = findCitations(args.van_ban_dau_vao);
        if (!refs.length)
          return result("Không tìm thấy viện dẫn nào trong đoạn văn bản này.", { so_luong: 0, vien_dan: [] });
        const items = refs.map((r) => ({
          chuoi_goc: r.raw,
          urn: toUrn(r, args.urn_van_ban_hien_tai, asOf) ?? null,
          noi_bo: r.selfRef,
          do_tin_cay: r.confidence,
          ten_van_ban: r.docName ?? null,
        }));
        const lines = items.map(
          (i) =>
            `- "${i.chuoi_goc}" -> ${i.urn ?? "(chưa xác định được văn bản)"}${i.noi_bo ? " [viện dẫn nội bộ]" : ""}`,
        );
        return result(`Phân giải được ${items.length} viện dẫn:\n${lines.join("\n")}`, {
          so_luong: items.length,
          vien_dan: items,
        });
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  reg.add(
    "xem_quan_he_van_ban",
    {
      title: "Xem quan hệ của một văn bản",
      description:
        "Liệt kê văn bản căn cứ, văn bản hướng dẫn, văn bản sửa đổi/bị sửa đổi, thay thế/bị thay thế, " +
        "hợp nhất, dẫn chiếu. Dùng để biết một quy định còn nguyên vẹn hay đã bị văn bản khác tác động.",
      inputSchema: { van_ban: z.string().describe("URN, số ký hiệu hoặc tên gần đúng.") },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const doc = await mustResolve(args.van_ban);
        const rows = (await sql`
          SELECT r.type, r.effective_from, 'out' AS direction, r.to_urn AS other_urn, d.short_title AS other_title
          FROM relations r LEFT JOIN documents d ON d.urn = split_part(r.to_urn, '#', 1)
          WHERE split_part(r.from_urn, '#', 1) = ${doc.urn}
          UNION ALL
          SELECT r.type, r.effective_from, 'in', r.from_urn, d.short_title
          FROM relations r LEFT JOIN documents d ON d.urn = split_part(r.from_urn, '#', 1)
          WHERE split_part(r.to_urn, '#', 1) = ${doc.urn}
          ORDER BY 1, 3`) as any[];
        if (!rows.length) {
          return result(`${doc.shortTitle}: chưa ghi nhận quan hệ nào trong kho.`, {
            urn: doc.urn,
            quan_he: [],
          });
        }
        const LABEL: Record<string, [string, string]> = {
          can_cu: ["Căn cứ vào", "Là căn cứ của"],
          huong_dan: ["Quy định chi tiết, hướng dẫn", "Được quy định chi tiết bởi"],
          sua_doi: ["Sửa đổi, bổ sung", "Bị sửa đổi, bổ sung bởi"],
          bai_bo: ["Bãi bỏ", "Bị bãi bỏ bởi"],
          thay_the: ["Thay thế", "Bị thay thế bởi"],
          dinh_chinh: ["Đính chính", "Được đính chính bởi"],
          hop_nhat: ["Hợp nhất", "Được hợp nhất tại"],
          dinh_chi: ["Đình chỉ", "Bị đình chỉ bởi"],
          dan_chieu: ["Dẫn chiếu tới", "Được dẫn chiếu bởi"],
          cha_con: ["Văn bản con", "Văn bản cha"],
        };
        const lines = rows.map((r) => {
          const pair = LABEL[r.type] ?? [r.type, r.type];
          const label = r.direction === "out" ? pair[0] : pair[1];
          return `- ${label}: ${r.other_title ?? r.other_urn} (${r.other_urn})${isoDate(r.effective_from) ? ` từ ${isoDate(r.effective_from)}` : ""}`;
        });
        return result(`Quan hệ của ${doc.shortTitle}:\n${lines.join("\n")}`, { urn: doc.urn, quan_he: rows });
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  reg.add(
    "so_sanh_thoi_diem",
    {
      title: "So sánh nội dung văn bản giữa hai thời điểm",
      description:
        "Cho biết chính xác điều/khoản nào được sửa, thêm, bãi bỏ giữa hai mốc thời gian, kèm diff mức từ. " +
        "Dùng để trả lời 'quy định này đã thay đổi thế nào'.",
      inputSchema: {
        van_ban: z.string().describe("URN, số ký hiệu hoặc tên gần đúng."),
        tu_ngay: z.string().describe("Mốc đầu, dạng YYYY-MM-DD."),
        den_ngay: z.string().describe("Mốc sau, dạng YYYY-MM-DD."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const from = normalizeAsOf(args.tu_ngay);
        const to = normalizeAsOf(args.den_ngay);
        const doc = await mustResolve(args.van_ban);
        const a = await treeAsOf(doc.id, doc.urn, from);
        const b = await treeAsOf(doc.id, doc.urn, to);
        const diffs = diffTrees(a.root, b.root);
        if (!diffs.length) {
          return result(`${doc.shortTitle}: không có thay đổi nào giữa ${from} và ${to}.`, { thay_doi: [] });
        }
        const lines = diffs.map((d) => {
          const head = `- ${d.label} (${d.path}): ${d.change === "added" ? "được bổ sung" : d.change === "removed" ? "bị bỏ" : "được sửa đổi"}`;
          const status =
            d.statusBefore !== d.statusAfter ? ` [trạng thái: ${d.statusBefore} -> ${d.statusAfter}]` : "";
          const words = d.words?.length
            ? `\n    trước: ${(d.before ?? "").replace(/\s+/g, " ").slice(0, 160)}\n    sau  : ${(d.after ?? "").replace(/\s+/g, " ").slice(0, 160)}`
            : "";
          return head + status + words;
        });
        return result(
          `${doc.shortTitle}: ${diffs.length} thay đổi giữa ${from} và ${to}.\n${lines.join("\n")}`,
          { urn: doc.urn, tu_ngay: from, den_ngay: to, so_thay_doi: diffs.length, thay_doi: diffs },
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  reg.add(
    "doi_chieu_thu_bac",
    {
      title: "Đối chiếu thứ bậc hiệu lực khi có xung đột",
      description:
        "Khi hai quy định mâu thuẫn, công cụ này cho biết văn bản nào được ưu tiên áp dụng theo Điều 4 " +
        "Luật Ban hành văn bản quy phạm pháp luật 2025: văn bản có hiệu lực pháp lý cao hơn được ưu tiên; " +
        "cùng cơ quan ban hành về cùng vấn đề thì áp dụng văn bản ban hành sau.",
      inputSchema: {
        van_ban_a: z.string().describe("Văn bản thứ nhất."),
        van_ban_b: z.string().describe("Văn bản thứ hai."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const a = await mustResolve(args.van_ban_a);
        const b = await mustResolve(args.van_ban_b);
        const cmp = compareAuthority(
          { docType: a.docType, issuedDate: a.issuedDate ?? undefined },
          { docType: b.docType, issuedDate: b.issuedDate ?? undefined },
        );
        const winner = cmp < 0 ? a : cmp > 0 ? b : undefined;
        const reason =
          a.rank !== b.rank
            ? `${docTypeName(a.docType)} có thứ bậc ${a.rank}, ${docTypeName(b.docType)} có thứ bậc ${b.rank}; số nhỏ hơn là hiệu lực pháp lý cao hơn.`
            : `Hai văn bản cùng thứ bậc ${a.rank}; áp dụng nguyên tắc văn bản ban hành sau (${a.issuedDate} so với ${b.issuedDate}).`;
        return result(
          `${a.shortTitle} (thứ bậc ${a.rank}, ban hành ${a.issuedDate ?? "?"})\n` +
            `${b.shortTitle} (thứ bậc ${b.rank}, ban hành ${b.issuedDate ?? "?"})\n\n` +
            (winner ? `Ưu tiên áp dụng: ${winner.shortTitle}.\n` : "Không phân định được thứ tự ưu tiên.\n") +
            `Lý do: ${reason}\n\n` +
            "Lưu ý: nguyên tắc này chỉ áp dụng khi hai quy định thực sự mâu thuẫn về cùng một vấn đề. " +
            "Nếu văn bản mới không quy định trách nhiệm pháp lý hoặc quy định nhẹ hơn thì áp dụng văn bản mới.",
          { uu_tien: winner?.urn ?? null, ly_do: reason },
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  reg.add(
    "danh_sach_van_ban",
    {
      title: "Liệt kê văn bản trong kho",
      description: "Liệt kê hoặc lọc văn bản theo loại, cơ quan, trạng thái, khoảng thời gian ban hành.",
      inputSchema: {
        loai_van_ban: z.array(z.string()).optional(),
        co_quan: z.string().optional(),
        trang_thai: z
          .array(z.string())
          .optional()
          .describe("con_hieu_luc, het_hieu_luc, het_hieu_luc_mot_phan..."),
        tu_khoa: z.string().optional(),
        so_luong: z.number().int().min(1).max(100).optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const limit = args.so_luong ?? 20;
        const rows = (await sql`
          SELECT urn, so_ky_hieu, short_title, title, issuer_name, issued_date, effective_from, status, rank
          FROM documents
          WHERE (${args.loai_van_ban ?? null}::text[] IS NULL OR doc_type = ANY(${args.loai_van_ban ?? null}))
            AND (${args.co_quan ?? null}::text IS NULL OR issuer_name ILIKE ${`%${args.co_quan ?? ""}%`})
            AND (${args.trang_thai ?? null}::text[] IS NULL OR status = ANY(${args.trang_thai ?? null}))
            AND (${args.tu_khoa ?? null}::text IS NULL OR title ILIKE ${`%${args.tu_khoa ?? ""}%`} OR so_ky_hieu ILIKE ${`%${args.tu_khoa ?? ""}%`})
          ORDER BY rank ASC, issued_date DESC NULLS LAST
          LIMIT ${limit}`) as any[];
        if (!rows.length)
          return result("Không có văn bản nào khớp điều kiện lọc.", { so_luong: 0, van_ban: [] });
        const lines = rows.map(
          (r) =>
            `- ${r.so_ky_hieu} — ${r.title.slice(0, 110)}\n  ${r.issuer_name ?? "?"} | ban hành ${isoDate(r.issued_date) ?? "?"} | ${STATUS_LABEL[r.status] ?? r.status}\n  URN: ${r.urn}`,
        );
        return result(`${rows.length} văn bản:\n${lines.join("\n")}`, {
          so_luong: rows.length,
          van_ban: rows,
        });
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}

export { findNode, today, treeAsOf };
