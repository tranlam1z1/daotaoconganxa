/**
 * Vòng số hóa đi qua đúng các công cụ MCP mà agent sẽ gọi:
 * nhan_viec_so_hoa -> lay_cua_so_trang -> nop_cua_so -> hoan_tat_so_hoa.
 *
 * Test dùng PDF tự sinh và kho cục bộ trong thư mục tạm, không cần R2 và không cần Redis.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Principal } from "@qdpl/auth";
import { getDocumentByUrn, sql } from "@qdpl/db";
import { buildUrn } from "@qdpl/legal-model";
import { putObject } from "@qdpl/storage";
import { PDFDocument, StandardFonts } from "pdf-lib";
import type { ToolConfig, ToolRegistrar } from "../src/registrar.ts";
import { registerSoHoaTools } from "../src/tools/so-hoa.ts";

const URN = buildUrn({ docType: "nd", soKyHieu: "100/2026/NĐ-CP" });
const FILE_URI = "raw/kiem-thu/2026/nghi-dinh/100-2026-nd-cp/so-hoa-test.pdf";

interface KetQuaCongCu {
  content: Array<{ type: string; text?: string }>;
  structuredContent?: Record<string, any>;
  isError?: boolean;
}

const handlers = new Map<string, (args: any) => Promise<KetQuaCongCu>>();
const cauHinh = new Map<string, ToolConfig>();

const principal: Principal = { email: "bt@vd.vn", role: "quan_ly", source: "local" };
const reg: ToolRegistrar = {
  principal,
  registered: [],
  add(name: string, config: ToolConfig, handler: (...a: any[]) => any) {
    cauHinh.set(name, config);
    handlers.set(name, handler);
    reg.registered.push(name);
    return true;
  },
};

async function goi(ten: string, args: Record<string, unknown> = {}): Promise<KetQuaCongCu> {
  const h = handlers.get(ten);
  if (!h) throw new Error(`Chưa đăng ký công cụ ${ten}`);
  return await h(args);
}

const chu = (r: KetQuaCongCu): string => r.content.map((c) => c.text ?? "").join("\n");

let thuMuc = "";
let documentId = "";

/** PDF 9 trang có lớp văn bản, đủ để chia thành 2 cụm. */
async function pdfMau(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 9; i++) {
    const p = doc.addPage([595, 842]);
    p.drawText("CONG BAO/So 145 + 146 ngay 10/02/2026", { x: 50, y: 800, size: 9, font });
    for (let d = 0; d < 25; d++) {
      p.drawText(`Dieu ${i}. Noi dung dong ${d} cua trang ${i} de kiem thu so hoa.`, {
        x: 50,
        y: 760 - d * 20,
        size: 11,
        font,
      });
    }
    p.drawText(`- ${i} -`, { x: 290, y: 40, size: 10, font });
  }
  return await doc.save();
}

beforeAll(async () => {
  thuMuc = await mkdtemp(join(tmpdir(), "qdpl-sohoa-"));
  process.env.STORAGE_DIR = thuMuc;
  process.env.STORAGE_BACKEND = "local";
  process.env.QDPL_MCP_ALLOW_WRITE = "1";
  // Không có Redis trong test: hoan_tat_so_hoa phải tự lùi về hàng đợi trong bảng `jobs`.
  process.env.REDIS_URL = "";

  const doc = await getDocumentByUrn(URN);
  documentId = doc!.id;
  await sql`DELETE FROM sohoa_tasks WHERE document_id = ${documentId}`;
  await putObject(FILE_URI, await pdfMau(), { contentType: "application/pdf" });
  const { taoViecSoHoa } = await import("@qdpl/db");
  const { lapKeHoachCuaSo } = await import("@qdpl/sohoa");
  await taoViecSoHoa({
    documentId,
    fileUri: FILE_URI,
    route: "pdf_text",
    pageCount: 9,
    windows: lapKeHoachCuaSo(9),
  });
  registerSoHoaTools(reg);
});

afterAll(async () => {
  await rm(thuMuc, { recursive: true, force: true });
});

describe("công cụ số hóa", () => {
  test("đăng ký đủ công cụ của vòng làm việc", () => {
    expect(reg.registered).toEqual([
      "nhan_viec_so_hoa",
      "lay_cua_so_trang",
      "nop_cua_so",
      "hoan_tat_so_hoa",
      "bo_qua_viec_so_hoa",
      "trang_thai_so_hoa",
    ]);
    // Công cụ đọc trang không được đánh dấu ghi dữ liệu.
    expect(cauHinh.get("lay_cua_so_trang")?.annotations?.readOnlyHint).toBe(true);
  });

  let viecId = "";

  test("nhận việc trả về kế hoạch cụm trang", async () => {
    const r = await goi("nhan_viec_so_hoa", { van_ban: "100/2026/NĐ-CP" });
    expect(r.isError).toBeUndefined();
    viecId = r.structuredContent!.viec_id;
    expect(r.structuredContent!.cua_so).toHaveLength(2);
    expect(r.structuredContent!.so_trang).toBe(9);
    expect(chu(r)).toContain("Sao chép NGUYÊN VĂN");
  });

  test("lấy cụm trang: có PDF con, lớp văn bản và cảnh báo dòng lặp", async () => {
    const r = await goi("lay_cua_so_trang", { viec_id: viecId, cua_so: 1 });
    const sc = r.structuredContent!;
    expect(sc.cua_so.tuTrang).toBe(1);
    expect(sc.cua_so.denTrang).toBe(5);
    expect(sc.duong_dan_pdf).toEndWith("cum-001.pdf");
    expect(await Bun.file(sc.duong_dan_pdf).exists()).toBe(true);
    expect(sc.trang).toHaveLength(5);
    expect(sc.dong_lap.some((d: any) => d.viDu.startsWith("CONG BAO"))).toBe(true);
    expect(chu(r)).toContain("Bản nháp trích từ lớp văn bản");
    expect(chu(r)).not.toContain("- 3 -");
  });

  test("kèm ảnh trang khi client không đọc được tệp", async () => {
    const r = await goi("lay_cua_so_trang", { viec_id: viecId, cua_so: 2, kem_anh: true, dpi: 72 });
    const anh = r.content.filter((c) => c.type === "image");
    expect(anh.length).toBeGreaterThan(0);
    expect(anh.length).toBeLessThanOrEqual(6);
  });

  test("nộp cụm và biết cụm kế tiếp", async () => {
    const r1 = await goi("nop_cua_so", {
      viec_id: viecId,
      cua_so: 1,
      markdown: "<!-- node: dieu-1 -->\n### Điều 1. Phạm vi\n\n1. Nội dung khoản một chưa kết thúc và",
      trang_thai_mo: { sentence_open: true, table_open: false, last_text_tail: "chưa kết thúc và" },
    });
    expect(chu(r1)).toContain("Cụm kế tiếp");
    const r2 = await goi("nop_cua_so", {
      viec_id: viecId,
      cua_so: 2,
      markdown: "<!-- cont -->\ncòn tiếp phần sau.\n\n<!-- node: dieu-2 -->\n### Điều 2. Giải thích",
      trang_thai_mo: { sentence_open: false, table_open: false },
    });
    expect(chu(r2)).toContain("hoan_tat_so_hoa");
    expect(r2.structuredContent!.con_lai).toEqual([]);
  });

  test("nộp thiếu cụm thì không hoàn tất được", async () => {
    await sql`DELETE FROM sohoa_windows WHERE task_id = ${viecId} AND idx = 2`;
    const r = await goi("hoan_tat_so_hoa", { viec_id: viecId });
    expect(r.isError).toBe(true);
    expect(chu(r)).toContain("thiếu");
    // nộp lại cho các test sau
    await goi("nop_cua_so", {
      viec_id: viecId,
      cua_so: 2,
      markdown: "<!-- cont -->\ncòn tiếp phần sau.\n\n<!-- node: dieu-2 -->\n### Điều 2. Giải thích",
      trang_thai_mo: { sentence_open: false, table_open: false },
    });
  });

  test("hoàn tất: ghép, kiểm chứng, lưu Markdown và không mất bước parse khi thiếu Redis", async () => {
    const r = await goi("hoan_tat_so_hoa", { viec_id: viecId });
    const sc = r.structuredContent!;
    expect(sc.markdown_uri).toBe(`derived/${documentId}/so-hoa/document.md`);
    const md = await Bun.file(join(thuMuc, sc.markdown_uri)).text();
    // Câu bị cắt giữa hai cụm phải được nối liền, không ngắt đoạn.
    expect(md).toContain("chưa kết thúc và còn tiếp phần sau.");
    expect(md).toContain("### Điều 2. Giải thích");
    // Thiếu khối chữ ký -> phải đưa vào diện soát, không được tự chốt.
    expect(sc.trang_thai).toBe("cho_duyet");
    expect(sc.kiem_tra.find((m: any) => m.ma === "chu_ky").dat).toBe(false);
    expect(chu(r)).toContain("Điểm chất lượng");
  });

  test("bỏ qua canh_bao thì chốt và đẩy được bước phân tích", async () => {
    const r = await goi("hoan_tat_so_hoa", { viec_id: viecId, bo_qua_canh_bao: true });
    expect(r.structuredContent!.trang_thai).toBe("xong");
    // Không có Redis: job `parse` phải nằm trong bảng jobs để lệnh so-hoa dong-bo xử lý tiếp.
    const jobs = await sql`SELECT payload FROM jobs WHERE queue = 'parse' ORDER BY id DESC LIMIT 1`;
    expect((jobs[0] as any).payload.source).toBe("so_hoa");
    const [task] = await sql`SELECT state, parse_queued FROM sohoa_tasks WHERE id = ${viecId}`;
    expect((task as any).state).toBe("xong");
    expect((task as any).parse_queued).toBe(false);
  });

  test("chế độ chỉ đọc chặn mọi công cụ ghi", async () => {
    process.env.QDPL_MCP_ALLOW_WRITE = "0";
    const r = await goi("nhan_viec_so_hoa", {});
    expect(r.isError).toBe(true);
    expect(chu(r)).toContain("CHỈ ĐỌC");
    process.env.QDPL_MCP_ALLOW_WRITE = "1";
  });

  test("bỏ qua việc kèm lý do", async () => {
    const r = await goi("bo_qua_viec_so_hoa", { viec_id: viecId, ly_do: "Bản quét thiếu 3 trang giữa." });
    expect(r.structuredContent!.trang_thai).toBe("bo_qua");
    const tt = await goi("trang_thai_so_hoa", { trang_thai: "bo_qua" });
    expect(chu(tt)).toContain("bỏ qua");
  });
});
