/**
 * Bước 3 (ke-hoach/02 §4.1): định tuyến chuyển đổi file thô -> Markdown.
 *  - DOCX / HTML / MD : chuyển NGAY trong TypeScript.
 *  - PDF              : tạo một VIỆC SỐ HÓA cho agent (ke-hoach/05); agent đọc trang
 *                       qua MCP rồi tự đẩy job `parse` khi xong.
 * Kết quả Markdown ghi vào kho `out/{documentId}/…` rồi đẩy job `parse`.
 */
import { access } from "node:fs/promises";
import { join } from "node:path";
import { enqueue, sql, taoViecSoHoa } from "@qdpl/db";
import {
  danhGiaLopVanBan,
  docTrangPdf,
  lapKeHoachCuaSo,
  nhapTuLopVanBan,
  phatHienDongLap,
} from "@qdpl/sohoa";
import { getObject, putText } from "@qdpl/storage";
import { fileHash } from "../crawler/dedupe.ts";
import { absolutePath } from "../crawler/store.ts";
import { log } from "../log.ts";
import { docxToMarkdown } from "./docx.ts";
import { htmlToMarkdown, tidyMarkdown } from "./html-md.ts";

export type ConvertRoute = "docx" | "html" | "markdown" | "sohoa";

export interface ConvertResult {
  route: ConvertRoute;
  /** Có Markdown ngay (docx/html/md) hay phải chờ agent số hóa. */
  deferred: boolean;
  markdown?: string;
  markdownUri?: string;
  parseJobId?: string;
  /** Việc số hóa đã tạo cho agent (tuyến `sohoa`). */
  soHoaTaskId?: string;
  warnings: string[];
  stats?: Record<string, number>;
}

/**
 * @deprecated Hợp đồng với service Python `services/docproc` — ĐÃ NGƯNG DÙNG.
 * Giữ lại để đọc được job tồn đọng trong bảng `jobs`. Đường số hóa hiện tại là
 * `sohoa_tasks` + công cụ MCP (ke-hoach/05).
 */
export interface DocprocJobPayload {
  /** BẮT BUỘC. Tuyệt đối hoặc tương đối STORAGE_DIR. */
  inputPath: string;
  /** Thư mục kết quả; docproc ghi document.md / assets.json / result.json vào đây. */
  outputDir: string;
  documentId: string;
  sourceRecordId?: string;
  useLlm: boolean;
  windowSize: number;
  overlap: number;
  dpi: number;
  keepRunningHeads: boolean;
  promptVersion: string;
  /** Không thuộc hợp đồng docproc; worker TS dùng để biết loại file. */
  kind: "pdf" | "doc" | "rtf" | "other";
}

/** @deprecated Tên file Markdown mà docproc (Python) ghi ra trong `outputDir`. */
export const DOCPROC_MARKDOWN = "document.md";

/**
 * Thư mục kết quả chuyển đổi của một văn bản (tương đối kho).
 * Nằm dưới `out/` để trùng với mục `data/out/` đã có trong .gitignore.
 */
export function derivedDir(documentId: string): string {
  return join("out", documentId);
}

/** Ghi Markdown vào kho và trả về URI tương đối. */
export async function saveMarkdown(documentId: string, markdown: string): Promise<string> {
  const uri = join(derivedDir(documentId), `${fileHash(markdown).slice(0, 16)}.md`);
  await putText(uri, markdown);
  return uri;
}

export async function readStoredFile(uri: string): Promise<Uint8Array> {
  return await getObject(uri);
}

/** Tuyến chuyển đổi theo loại file: docx/html/markdown xử lý trong TS, còn lại đi đường số hóa. */
export function routeOf(kind: string, uri: string): ConvertRoute {
  const k = (kind || uri.split(".").pop() || "").toLowerCase();
  if (k === "docx") return "docx";
  if (k === "html" || k === "htm") return "html";
  if (k === "md" || k === "markdown" || k === "txt") return "markdown";
  return "sohoa";
}

/**
 * Chuẩn bị việc số hóa cho một tệp PDF: đọc lớp văn bản, phân loại tuyến, chia cụm trang,
 * dựng bản nháp nếu có lớp văn bản. Không gọi mô hình — phần đọc trang là việc của agent.
 */
export async function taoViecSoHoaChoTep(input: {
  documentId: string;
  fileUri: string;
  sourceRecordId?: string;
  kind?: string;
  runId?: string;
}): Promise<{ taskId?: string; warnings: string[] }> {
  const k = (input.kind || input.fileUri.split(".").pop() || "").toLowerCase();
  if (k !== "pdf" && !input.fileUri.toLowerCase().endsWith(".pdf")) {
    return {
      warnings: [
        `Định dạng "${k || "không rõ"}" của ${input.fileUri} không số hóa được bằng đường đọc trang PDF. ` +
          `Cần lấy bản PDF hoặc DOCX của văn bản này.`,
      ],
    };
  }
  const bytes = await getObject(input.fileUri);
  const trang = docTrangPdf(bytes);
  const danhGia = danhGiaLopVanBan(trang);
  const keHoach = lapKeHoachCuaSo(danhGia.soTrang);

  let draftUri: string | undefined;
  if (danhGia.tuyen === "pdf_text") {
    const nhap = nhapTuLopVanBan(trang, { dongLap: phatHienDongLap(trang) });
    if (nhap.trim()) {
      draftUri = `derived/${input.documentId}/so-hoa/nhap.md`;
      await putText(draftUri, nhap);
    }
  }

  const task = await taoViecSoHoa({
    documentId: input.documentId,
    fileUri: input.fileUri,
    ...(input.sourceRecordId ? { sourceRecordId: input.sourceRecordId } : {}),
    route: danhGia.tuyen,
    pageCount: danhGia.soTrang,
    windows: keHoach,
    ...(draftUri ? { draftUri } : {}),
    ...(input.runId ? { runId: input.runId } : {}),
  });
  log.info("Đã tạo việc số hóa cho agent", {
    viecId: task.id,
    tuyen: danhGia.tuyen,
    soTrang: danhGia.soTrang,
    soCum: keHoach.length,
  });
  return {
    taskId: task.id,
    warnings: [
      `PDF ${danhGia.soTrang} trang (${danhGia.lyDo}) — đã tạo việc số hóa ${task.id}, ` +
        `${keHoach.length} cụm chờ agent xử lý qua MCP (nhan_viec_so_hoa).`,
    ],
  };
}

export interface ConvertInput {
  documentId: string;
  sourceRecordId?: string;
  fileUri: string;
  kind?: string;
  /** Selector giới hạn vùng nội dung khi nguồn là HTML. */
  htmlSelector?: string;
  enqueueParse?: boolean;
}

export async function convert(input: ConvertInput): Promise<ConvertResult> {
  const route = routeOf(input.kind ?? "", input.fileUri);
  const warnings: string[] = [];

  if (route === "sohoa") {
    const r = await taoViecSoHoaChoTep(input);
    return {
      route,
      deferred: true,
      ...(r.taskId ? { soHoaTaskId: r.taskId } : {}),
      warnings: r.warnings,
    };
  }

  const bytes = await readStoredFile(input.fileUri);
  let markdown = "";
  let stats: Record<string, number> = {};

  if (route === "docx") {
    const r = docxToMarkdown(bytes);
    markdown = r.markdown;
    warnings.push(...r.warnings);
    stats = r.stats as any;
  } else if (route === "html") {
    const r = htmlToMarkdown(new TextDecoder("utf-8").decode(bytes), input.htmlSelector);
    markdown = r.markdown;
    warnings.push(...r.warnings);
    stats = r.stats as any;
  } else {
    markdown = new TextDecoder("utf-8").decode(bytes);
  }

  markdown = tidyMarkdown(markdown);
  if (!markdown.trim()) {
    throw new Error(`Chuyển đổi ${input.fileUri} (tuyến ${route}) ra Markdown rỗng`);
  }
  const markdownUri = await saveMarkdown(input.documentId, markdown);

  const result: ConvertResult = { route, deferred: false, markdown, markdownUri, warnings, stats };
  if (input.enqueueParse !== false) {
    result.parseJobId = await enqueue("parse", {
      documentId: input.documentId,
      markdownUri,
      source: route,
    });
  }
  log.info("Đã chuyển đổi sang Markdown", {
    route,
    documentId: input.documentId,
    bytes: markdown.length,
    ...stats,
  });
  return result;
}

export interface AwaitDocprocResult {
  ready: boolean;
  state: string;
  markdownUri?: string;
  parseJobId?: string;
  retryJobId?: string;
}

/** Số lần chờ tối đa (30 giây/lần) trước khi coi như hỏng. */
const MAX_DOCPROC_WAITS = Number(process.env.DOCPROC_MAX_WAITS ?? 240);

/**
 * @deprecated Theo dõi một job `docproc` của service Python — ĐÃ NGƯNG DÙNG.
 * Giữ lại để xử lý nốt job tồn đọng trong bảng `jobs` (xem worker.ts).
 */
export async function awaitDocproc(p: {
  docprocJobId: string;
  documentId: string;
  markdownUri: string;
  tries?: number;
}): Promise<AwaitDocprocResult> {
  const [row] = await sql`SELECT state, last_error FROM jobs WHERE id = ${p.docprocJobId}`;
  const job = row as { state: string; last_error: string | null } | undefined;
  if (!job) throw new Error(`Không tìm thấy job docproc ${p.docprocJobId}`);
  if (job.state === "dead") {
    throw new Error(`Job docproc ${p.docprocJobId} thất bại hẳn: ${job.last_error ?? "không rõ"}`);
  }
  if (job.state !== "done") {
    const tries = (p.tries ?? 0) + 1;
    if (tries > MAX_DOCPROC_WAITS) {
      throw new Error(`Job docproc ${p.docprocJobId} vẫn ở trạng thái "${job.state}" sau ${tries} lần chờ`);
    }
    const retryJobId = await enqueue(
      "docproc-wait",
      { ...p, tries },
      { runAfter: new Date(Date.now() + 30_000) },
    );
    return { ready: false, state: job.state, retryJobId };
  }
  const abs = absolutePath(p.markdownUri);
  try {
    await access(abs);
  } catch {
    throw new Error(`docproc báo xong nhưng không thấy ${abs}`);
  }
  const parseJobId = await enqueue("parse", {
    documentId: p.documentId,
    markdownUri: p.markdownUri,
    source: "docproc",
  });
  log.info("docproc đã xong, chuyển sang parse", { documentId: p.documentId, markdownUri: p.markdownUri });
  return { ready: true, state: job.state, markdownUri: p.markdownUri, parseJobId };
}
