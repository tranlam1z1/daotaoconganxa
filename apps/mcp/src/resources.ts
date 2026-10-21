/**
 * Tài nguyên MCP: cho phép client đọc thẳng nội dung văn bản theo URN,
 * kể cả tại một thời điểm cụ thể.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sql } from "@qdpl/db";
import { serializeDocument } from "@qdpl/legal-model";
import { isoDate, normalizeAsOf } from "./context.ts";
import { treeAsOf } from "./tools/tra-cuu.ts";

export function registerResources(server: McpServer): void {
  server.registerResource(
    "van-ban-moi-nhat",
    "vbqppl://danh-sach/moi-nhat",
    {
      title: "Văn bản mới nhất trong kho",
      description: "Danh sách văn bản mới cập nhật, kèm URN để đọc chi tiết.",
      mimeType: "text/markdown",
    },
    async (uri) => {
      const rows = (await sql`
        SELECT urn, so_ky_hieu, title, issuer_name, issued_date, status
        FROM documents ORDER BY issued_date DESC NULLS LAST, updated_at DESC LIMIT 50`) as any[];
      const text = rows
        .map(
          (r) =>
            `- **${r.so_ky_hieu}** — ${r.title}\n  ${r.issuer_name ?? "?"} | ${isoDate(r.issued_date) ?? "?"} | ${r.status}\n  \`${r.urn}\``,
        )
        .join("\n");
      return {
        contents: [{ uri: uri.href, mimeType: "text/markdown", text: `# Văn bản mới nhất\n\n${text}` }],
      };
    },
  );

  server.registerResource(
    "van-ban",
    new ResourceTemplate("vbqppl://van-ban/{urn}", { list: undefined }),
    {
      title: "Toàn văn một văn bản",
      description:
        "Đọc toàn văn theo URN. Thêm hậu tố @YYYY-MM-DD vào cuối URN để lấy nội dung tại một thời điểm, " +
        "ví dụ: vbqppl://van-ban/vn:vbqppl:nd:100%2F2026%2FNĐ-CP@2027-08-01",
      mimeType: "text/markdown",
    },
    async (uri, params) => {
      const raw = decodeURIComponent(String(params.urn));
      const [docUrn = "", at] = raw.split("@");
      const asOf = normalizeAsOf(at);
      const [doc] = (await sql`SELECT * FROM documents WHERE urn = ${docUrn} LIMIT 1`) as any[];
      if (!doc) {
        return {
          contents: [
            { uri: uri.href, mimeType: "text/plain", text: `Không có văn bản ${docUrn} trong kho.` },
          ],
        };
      }
      const { root, version } = await treeAsOf(doc.id, doc.urn, asOf);
      const md = serializeDocument(root, { footnotes: true, asOf });
      const header = `# ${doc.title}\n\n- Số ký hiệu: ${doc.so_ky_hieu}\n- URN: ${doc.urn}\n- Nội dung tại ngày: ${asOf}\n- Loại phiên bản: ${version.kind}\n\n---\n\n`;
      return { contents: [{ uri: uri.href, mimeType: "text/markdown", text: header + md }] };
    },
  );
}
