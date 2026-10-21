/**
 * CLI vận hành thủ công cho crawler + pipeline.
 *
 *   bun run src/cli.ts crawl congbao --type nghi-dinh --limit 5
 *   bun run src/cli.ts ingest-file data/fixtures/nd-mau-goc.md --so-ky-hieu 100/2026/NĐ-CP --title "..."
 *   bun run src/cli.ts pipeline vn:vbqppl:nd:100/2026/NĐ-CP
 *   bun run src/cli.ts stats
 */
import { basename, extname, join } from "node:path";
import {
  capNhatViecSoHoa,
  danhSachViecSoHoa,
  getDocumentByUrn,
  ghiCuaSo,
  ghiThongKeNguon,
  layCacCuaSo,
  layViecSoHoa,
  NHAN_TRANG_THAI_VIEC,
  sql,
  thongKeSoHoa,
  tienDoNapKho,
} from "@qdpl/db";
import { soKyHieuSlug } from "@qdpl/legal-model";
import { closeConnection, hasRedis, QUEUES, redisUrl } from "@qdpl/queue";
import { hoanTatSoHoa } from "@qdpl/sohoa";
import {
  clearWorkDir,
  deleteObject,
  getObject,
  getText,
  listObjects,
  objectExists,
  objectUrl,
  putFromFile,
  putObject,
  storageConfig,
  writeWorkFile,
} from "@qdpl/storage";
import { backfill } from "./backfill.ts";
import { ensureCorpusTargets, listTargets } from "./bull/frame.ts";
import { activeRuns, runProgress } from "./bull/ledger.ts";
import {
  add,
  closeQueues,
  drainAll,
  failuresOf,
  pauseAll,
  recentFailures,
  resumeAll,
  retryFailed,
  snapshotAll,
} from "./bull/queues.ts";
import { resolveQueueName } from "./bull/registry.ts";
import { startWorkers } from "./bull/runner.ts";
import { pickFileToConvert, pickPdfFile } from "./bull/workers/convert.ts";
import { CongbaoAdapter } from "./crawler/adapters/congbao.ts";
import { crawl } from "./crawler/crawl.ts";
import { fileHash } from "./crawler/dedupe.ts";
import { normalizeDocType, normalizeSoKyHieu, parseVietnameseDate } from "./crawler/normalize.ts";
import { rawDir, saveMetadata, saveRawFile, upsertSourceRecord } from "./crawler/store.ts";
import { errText, log } from "./log.ts";
import { approveOps, consolidateDocument } from "./pipeline/consolidate.ts";
import { convert, taoViecSoHoaChoTep } from "./pipeline/convert.ts";
import { extractOpsForDocument } from "./pipeline/extract-ops.ts";
import { indexVersion } from "./pipeline/index.ts";
import { ingestSourceRecord } from "./pipeline/ingest.ts";
import { isAmendingDocument, parseAndSave } from "./pipeline/parse.ts";
import { chuanBiPdfSoHoa } from "./pipeline/pdf-phan.ts";
import { extractRelationsForDocument } from "./pipeline/relations.ts";
import { runWorker } from "./worker.ts";

/* ------------------------------------------------------------------ */
/* Phân tích tham số dòng lệnh                                         */
/* ------------------------------------------------------------------ */

interface Args {
  _: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out.flags[key] = true;
      else {
        out.flags[key] = next;
        i++;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

const str = (a: Args, k: string): string | undefined =>
  typeof a.flags[k] === "string" ? (a.flags[k] as string) : undefined;
const num = (a: Args, k: string): number | undefined => {
  const v = str(a, k);
  return v === undefined ? undefined : Number(v);
};
const bool = (a: Args, k: string): boolean => a.flags[k] === true || a.flags[k] === "true";

function print(obj: unknown) {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

const USAGE = `
quydinhphapluat — CLI crawler & pipeline

  crawl <adapter> [--type nghi-dinh] [--limit 5] [--page 1] [--since YYYY-MM-DD]
                  [--dry-run] [--no-files] [--no-ingest] [--start-docid N]
        adapter: congbao | vbpl | vanban-chinhphu

  ingest-file <path.md|.docx|.html> --so-ky-hieu <SKH> --title <tên>
              [--issuer <cơ quan>] [--signer <người ký>] [--issued-date <ngày>]
              [--effective-from <ngày>] [--type-name <loại>] [--summary <trích yếu>]
              [--no-pipeline]

  pipeline <urn> [--auto-approve] [--as-of YYYY-MM-DD]
  extract-ops <urn>
  approve-ops <urn> [--min-confidence 0.8]
  consolidate <urn> [--as-of YYYY-MM-DD]
  relations <urn>
  worker [--queues a,b] [--once]          # worker CŨ, hàng đợi trong bảng jobs của Postgres
  stats

  bull worker [--queues a,b] [--concurrency N] [--max-active N] [--cpu-duty 0.5] [--until-idle 5000]
              # --max-active: số job chạy đồng thời tối đa của CẢ tiến trình (BULL_MAX_ACTIVE, mặc định 2)
              # --cpu-duty: tỷ lệ chiếm CPU 0<x<=1, nghỉ giữa các job (BULL_CPU_DUTY, mặc định 1)
  bull backfill [--nhom ha_tang_phap_ly] [--ma o1,o2] [--limit N] [--per-page N] [--nguong 0.95]
                [--resume <runId>] [--new] [--no-wait] [--dry-run]
                # --ma: chỉ đẩy các ô khung này (dùng khi muốn tự điều phối từng ô)
  bull status                             # số liệu mọi hàng đợi + tiến độ đợt nạp
  bull failures [--queue fetch] [--limit 20]
  bull retry [--queue fetch] [--limit 1000]
  bull pause | bull resume | bull drain --yes
  bull frame [--seed] [--kiem-thu] [--list] [--nhom X]

  nguon dem [--loai nghi-dinh,thong-tu]   # đếm TỔNG số văn bản ở nguồn (mẫu số của tiến độ)
  nguon tien-do                           # đã nạp bao nhiêu phần trăm so với nguồn

  so-hoa danh-sach [--trang-thai cho|dang_lam|cho_duyet|xong|loi|bo_qua] [--limit N]
  so-hoa tao <urn> [--tep <uri trong kho>]  # tạo việc số hóa cho bản PDF của một văn bản
                                          # (văn bản đăng nhiều kỳ Công báo được ghép các phần PDF trước)
  so-hoa ghep-phan [--yes]                # việc đang chờ mà văn bản có nhiều phần PDF: tạo lại trên tệp ghép
  so-hoa tach-anh <viec_id> [--cua-so N] [--dpi 150]   # dựng ảnh PNG từng trang (pdftoppm) để đọc ảnh trực tiếp
  so-hoa hoan-tat <viec_id> [--bo-qua-canh-bao]   # ghép + kiểm chứng lại từ các cụm đã nộp
  so-hoa dong-bo                          # đẩy job parse cho việc đã xong mà chưa đẩy được
  so-hoa don-dep [--yes]                  # xóa thư mục làm việc của các việc đã xong

  kho                                     # kho đối tượng đang dùng (R2 hay thư mục)
  kho kiem-tra                            # chạy thử ghi -> đọc -> liệt kê -> xóa một tệp
  kho cors [--dat]                        # xem CORS của bucket; --dat để ghi infra/r2-cors.json lên
  kho dong-bo [--tien-to raw,pages] [--dry-run] [--ghi-de]
                                          # đẩy tệp còn ở đĩa lên kho R2
`;

/* ------------------------------------------------------------------ */
/* Lệnh                                                                */
/* ------------------------------------------------------------------ */

async function cmdCrawl(args: Args) {
  const adapter = args._[1];
  if (!adapter) throw new Error("Thiếu tên adapter. Ví dụ: crawl congbao --type nghi-dinh --limit 3");
  const res = await crawl({
    adapter,
    ...(str(args, "type") ? { type: str(args, "type")! } : {}),
    limit: num(args, "limit") ?? 5,
    ...(num(args, "page") ? { page: num(args, "page")! } : {}),
    ...(str(args, "since") ? { since: str(args, "since")! } : {}),
    ...(num(args, "start-docid") ? { startDocId: num(args, "start-docid")! } : {}),
    dryRun: bool(args, "dry-run"),
    skipFiles: bool(args, "no-files"),
    enqueueIngest: !bool(args, "no-ingest"),
  });
  print(res);
  if (res.errors.length) process.exitCode = 1;
}

async function cmdIngestFile(args: Args) {
  const path = args._[1];
  if (!path) throw new Error("Thiếu đường dẫn file");
  const soKyHieu = str(args, "so-ky-hieu");
  if (!soKyHieu) throw new Error("Thiếu --so-ky-hieu");
  const title = str(args, "title") ?? basename(path);
  const ext = extname(path).replace(".", "").toLowerCase() || "md";

  const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
  const sk = normalizeSoKyHieu(soKyHieu);
  const issuedDate = parseVietnameseDate(str(args, "issued-date"));
  const effectiveFrom = parseVietnameseDate(str(args, "effective-from"));
  const dt = normalizeDocType({ soKyHieu: sk, typeName: str(args, "type-name"), title });

  const dir = rawDir({
    source: "manual",
    year: (issuedDate ?? new Date().toISOString()).slice(0, 4),
    docType: dt.docType,
    soKyHieu: sk,
  });
  const stored = await saveRawFile({
    dir,
    kind: (ext === "md" || ext === "txt" ? "other" : ext) as any,
    bytes,
    ext,
  });
  const meta = {
    soKyHieu: sk,
    title,
    ...(str(args, "type-name") ? { typeName: str(args, "type-name") } : {}),
    ...(str(args, "issuer") ? { issuer: str(args, "issuer") } : {}),
    ...(str(args, "signer") ? { signer: str(args, "signer") } : {}),
    ...(issuedDate ? { issuedDate } : {}),
    ...(effectiveFrom ? { effectiveFrom } : {}),
    ...(str(args, "summary") ? { summary: str(args, "summary") } : {}),
  };
  const fileUri = stored.uri;
  const metadata = {
    source: "manual",
    sourceId: `${dt.docType}-${soKyHieuSlug(sk)}`,
    url: `file://${path}`,
    meta,
    files: [{ kind: ext, url: `file://${path}` }],
    relations: [],
    storedFiles: [{ kind: ext, uri: fileUri, hash: stored.hash, bytes: stored.bytes }],
    fetchedAt: new Date().toISOString(),
  };
  await saveMetadata(dir, metadata);
  const recordId = await upsertSourceRecord({
    source: "manual",
    sourceId: metadata.sourceId,
    url: metadata.url,
    fileUri,
    contentType: ext,
    fileHash: fileHash(bytes),
    metadata,
  });

  const ing = await ingestSourceRecord(recordId, { enqueueConvert: false });
  const conv = await convert({
    documentId: ing.documentId,
    sourceRecordId: recordId,
    fileUri,
    kind: ext,
    enqueueParse: false,
  });
  if (conv.deferred) {
    print({
      ...ing,
      convert: conv,
      note: "PDF đã được đưa vào hàng đợi số hóa; agent xử lý qua MCP (nhan_viec_so_hoa) rồi mới có Markdown",
    });
    return;
  }
  const parsed = await parseAndSave({
    documentId: ing.documentId,
    markdown: conv.markdown!,
    markdownUri: conv.markdownUri!,
    enqueueNext: false,
  });
  const rel = bool(args, "no-pipeline") ? undefined : await extractRelationsForDocument(ing.documentId);
  print({
    sourceRecordId: recordId,
    documentId: ing.documentId,
    urn: ing.urn,
    created: ing.created,
    fileUri,
    convert: { route: conv.route, markdownUri: conv.markdownUri, stats: conv.stats, warnings: conv.warnings },
    parse: {
      versionId: parsed.versionId,
      nodes: parsed.nodeCount,
      counts: parsed.counts,
      warnings: parsed.warnings,
      isAmending: parsed.isAmending,
    },
    ...(rel
      ? {
          relations: {
            canCu: rel.canCu,
            huongDan: rel.huongDan,
            danChieu: rel.danChieu,
            chaCon: rel.chaCon,
            saved: rel.saved,
          },
        }
      : {}),
  });
}

async function cmdPipeline(args: Args) {
  const urn = args._[1];
  if (!urn) throw new Error("Thiếu URN. Ví dụ: pipeline vn:vbqppl:nd:100/2026/NĐ-CP");
  const doc = await getDocumentByUrn(urn);
  if (!doc) throw new Error(`Không có văn bản ${urn}`);
  const out: Record<string, unknown> = { urn: doc.urn, documentId: doc.id };

  // 1) Bảo đảm có phiên bản gốc: nếu chưa, chuyển đổi + phân tích từ source_record.
  const [ver] = await sql`
    SELECT id, version_no, markdown FROM document_versions WHERE document_id = ${doc.id} ORDER BY version_no ASC LIMIT 1`;
  if (!ver) {
    const [rec] = await sql`
      SELECT id, file_uri, content_type FROM source_records WHERE document_id = ${doc.id} AND file_uri IS NOT NULL LIMIT 1`;
    if (!rec) throw new Error(`${urn} chưa có phiên bản và cũng chưa có file nguồn để chuyển đổi`);
    const conv = await convert({
      documentId: doc.id,
      sourceRecordId: (rec as any).id,
      fileUri: (rec as any).file_uri,
      kind: (rec as any).content_type,
      enqueueParse: false,
    });
    out.convert = { route: conv.route, deferred: conv.deferred };
    if (conv.deferred) {
      print(out);
      return;
    }
    const p = await parseAndSave({
      documentId: doc.id,
      markdown: conv.markdown!,
      markdownUri: conv.markdownUri!,
      enqueueNext: false,
    });
    out.parse = { versionId: p.versionId, nodes: p.nodeCount, warnings: p.warnings.length };
  }

  // 2) Quan hệ.
  const rel = await extractRelationsForDocument(doc.id);
  out.relations = {
    canCu: rel.canCu,
    huongDan: rel.huongDan,
    danChieu: rel.danChieu,
    chaCon: rel.chaCon,
    saved: rel.saved,
  };

  // 3) Lệnh sửa đổi (nếu là văn bản sửa đổi).
  const [v0] =
    await sql`SELECT tree FROM document_versions WHERE document_id = ${doc.id} ORDER BY version_no ASC LIMIT 1`;
  const tree = (v0 as any)?.tree;
  const amending = tree
    ? isAmendingDocument(doc.title, typeof tree === "string" ? JSON.parse(tree) : tree)
    : false;
  out.isAmending = amending;
  if (amending) {
    const ops = await extractOpsForDocument(doc.id, { enqueueConsolidate: false });
    out.extractOps = {
      ops: ops.ops,
      needsLegal: ops.needsLegal,
      targets: ops.targets,
      warnings: ops.warnings,
      llm: ops.llm,
    };
    if (bool(args, "auto-approve")) {
      out.approved = await approveOps(doc.urn, { reviewer: "cli:auto-approve" });
      const consolidated: unknown[] = [];
      for (const t of ops.targets) {
        try {
          consolidated.push(
            await consolidateDocument(t, {
              ...(str(args, "as-of") ? { asOf: str(args, "as-of")! } : {}),
              enqueueIndex: false,
            }),
          );
        } catch (e) {
          consolidated.push({ target: t, error: errText(e) });
        }
      }
      out.consolidate = consolidated;
    }
  }

  // 4) Lập chỉ mục mọi phiên bản.
  const versions =
    await sql`SELECT id FROM document_versions WHERE document_id = ${doc.id} ORDER BY version_no`;
  const indexed: unknown[] = [];
  for (const v of versions as any[]) indexed.push(await indexVersion(doc.id, v.id));
  out.index = indexed;

  print(out);
}

async function cmdStats() {
  const [docs] = await sql`SELECT count(*)::int AS n FROM documents`;
  const byType =
    await sql`SELECT doc_type, count(*)::int AS n FROM documents GROUP BY doc_type ORDER BY n DESC`;
  const byStatus =
    await sql`SELECT status, count(*)::int AS n FROM documents GROUP BY status ORDER BY n DESC`;
  const [versions] = await sql`SELECT count(*)::int AS n FROM document_versions`;
  const byVersionKind =
    await sql`SELECT kind, count(*)::int AS n FROM document_versions GROUP BY kind ORDER BY n DESC`;
  const [nodes] = await sql`SELECT count(*)::int AS n FROM nodes`;
  const byNodeKind =
    await sql`SELECT kind, count(*)::int AS n FROM nodes GROUP BY kind ORDER BY n DESC LIMIT 12`;
  const rels = await sql`SELECT type, count(*)::int AS n FROM relations GROUP BY type ORDER BY n DESC`;
  const ops =
    await sql`SELECT op, review_status, count(*)::int AS n FROM amendment_ops GROUP BY op, review_status ORDER BY n DESC`;
  const sources =
    await sql`SELECT source, count(*)::int AS n FROM source_records GROUP BY source ORDER BY n DESC`;
  const jobs =
    await sql`SELECT queue, state, count(*)::int AS n FROM jobs GROUP BY queue, state ORDER BY queue, state`;
  const reviews =
    await sql`SELECT kind, state, count(*)::int AS n FROM review_queue GROUP BY kind, state ORDER BY n DESC`;
  const runs = await sql`SELECT step, status, count(*)::int AS n, round(avg(duration_ms))::int AS avg_ms
                         FROM pipeline_runs GROUP BY step, status ORDER BY n DESC`;
  print({
    documents: (docs as any).n,
    documentsByType: byType,
    documentsByStatus: byStatus,
    versions: (versions as any).n,
    versionsByKind: byVersionKind,
    nodes: (nodes as any).n,
    nodesByKind: byNodeKind,
    relations: rels,
    amendmentOps: ops,
    sourceRecords: sources,
    jobs,
    reviewQueue: reviews,
    pipelineRuns: runs,
  });
}

/* ------------------------------------------------------------------ */
/* Lệnh `bull …` — đường ống BullMQ (Redis)                            */
/* ------------------------------------------------------------------ */

/** Mọi lệnh bull đều cần Redis; báo lỗi rõ ràng thay vì hỏng giữa chừng. */
function requireRedis(): string {
  if (!hasRedis()) {
    throw new Error(
      "Chưa đặt REDIS_URL — các lệnh `bull` cần Redis.\n" +
        "  Ví dụ: REDIS_URL=redis://127.0.0.1:6380 bun run apps/workers-ts/src/cli.ts bull status\n" +
        "  Khởi động Redis: docker compose -f infra/docker-compose.yml up -d redis",
    );
  }
  return redisUrl();
}

async function cmdBullWorker(args: Args) {
  requireRedis();
  const q = str(args, "queues");
  const handle = startWorkers({
    ...(q ? { queues: q.split(",").filter(Boolean).map(resolveQueueName) } : {}),
    ...(num(args, "concurrency") ? { concurrency: num(args, "concurrency")! } : {}),
    ...(num(args, "max-active") ? { maxActive: num(args, "max-active")! } : {}),
    ...(num(args, "cpu-duty") ? { cpuDuty: num(args, "cpu-duty")! } : {}),
    ...(num(args, "until-idle") ? { untilIdleMs: num(args, "until-idle")! } : {}),
  });
  const lyDo = await handle.done;
  print({ dung: lyDo });
}

async function cmdBullBackfill(args: Args) {
  requireRedis();
  const res = await backfill({
    ...(str(args, "nhom") ? { nhom: str(args, "nhom")! } : {}),
    ...(num(args, "limit") ? { limit: num(args, "limit")! } : {}),
    ...(num(args, "per-page") ? { perPage: num(args, "per-page")! } : {}),
    ...(str(args, "ma")
      ? {
          ma: str(args, "ma")!
            .split(",")
            .map((m) => m.trim())
            .filter(Boolean),
        }
      : {}),
    ...(num(args, "nguong") ? { nguong: num(args, "nguong")! } : {}),
    ...(str(args, "resume") ? { runId: str(args, "resume")! } : {}),
    ...(bool(args, "new") ? { moi: true } : {}),
    ...(bool(args, "dry-run") ? { dryRun: true } : {}),
    ...(num(args, "wave-timeout") ? { waveTimeoutMs: num(args, "wave-timeout")! } : {}),
    ...(num(args, "poll") ? { pollMs: num(args, "poll")! } : {}),
    ...(num(args, "stall") ? { stallMs: num(args, "stall")! } : {}),
    cho: !bool(args, "no-wait"),
  });
  print(res);
}

async function cmdBullStatus() {
  requireRedis();
  const hangDoi = await snapshotAll();
  const dot = [];
  for (const r of await activeRuns(5)) dot.push(await runProgress(r.id));
  print({ hang_doi: hangDoi, dot_nap_dang_chay: dot });
}

async function cmdBullFailures(args: Args) {
  requireRedis();
  const limit = num(args, "limit") ?? 20;
  const ten = str(args, "queue");
  if (!ten) {
    print(await recentFailures(limit));
    return;
  }
  print(await failuresOf(resolveQueueName(ten), limit));
}

async function cmdBullRetry(args: Args) {
  requireRedis();
  const ten = str(args, "queue");
  const n = await retryFailed(ten ? resolveQueueName(ten) : undefined, num(args, "limit") ?? 1000);
  print({ da_thu_lai: n, hang_doi: ten ?? "tất cả" });
}

async function cmdBullFrame(args: Args) {
  const out: Record<string, unknown> = {};
  if (bool(args, "seed")) out.seed = await ensureCorpusTargets({ kiemThu: bool(args, "kiem-thu") });
  out.khung = await listTargets({
    ...(str(args, "nhom") ? { nhom: str(args, "nhom")! } : {}),
    ...(num(args, "limit") ? { limit: num(args, "limit")! } : {}),
  });
  print(out);
}

async function cmdBull(args: Args) {
  const sub = args._[1];
  switch (sub) {
    case "worker":
      await cmdBullWorker(args);
      break;
    case "backfill":
      await cmdBullBackfill(args);
      break;
    case "status":
      await cmdBullStatus();
      break;
    case "failures":
      await cmdBullFailures(args);
      break;
    case "retry":
      await cmdBullRetry(args);
      break;
    case "pause":
      requireRedis();
      await pauseAll();
      print({ tam_dung: true });
      break;
    case "resume":
      requireRedis();
      await resumeAll();
      print({ chay_lai: true });
      break;
    case "drain":
      requireRedis();
      if (!bool(args, "yes")) {
        throw new Error("`bull drain` xóa sạch mọi hàng đợi. Thêm --yes nếu thật sự muốn.");
      }
      await drainAll();
      print({ da_xoa_sach: true });
      break;
    case "frame":
      await cmdBullFrame(args);
      break;
    default:
      throw new Error(
        `Lệnh con "bull ${sub ?? ""}" không có. Dùng: worker | backfill | status | failures | retry | pause | resume | drain | frame`,
      );
  }
}

/* ------------------------------------------------------------------ */
/* Số hóa (ke-hoach/05) — agent làm phần đọc trang, CLI lo phần vận hành */
/* ------------------------------------------------------------------ */

async function cmdSoHoa(args: Args) {
  const sub = args._[1];
  switch (sub) {
    case "danh-sach": {
      const ds = await danhSachViecSoHoa({
        ...(str(args, "trang-thai") ? { state: str(args, "trang-thai") as never } : {}),
        limit: num(args, "limit") ?? 30,
      });
      print({
        thongKe: await thongKeSoHoa(),
        viec: ds.map((t) => ({
          id: t.id,
          soKyHieu: t.so_ky_hieu,
          trangThai: NHAN_TRANG_THAI_VIEC[t.state] ?? t.state,
          tuyen: t.route,
          soTrang: t.page_count,
          cum: `${t.so_cua_so_da_nop}/${(t.windows ?? []).length}`,
          giuBoi: t.claimed_by,
          diem: (t.quality as { diem?: number })?.diem ?? null,
        })),
      });
      break;
    }
    case "tao": {
      const urn = args._[2];
      if (!urn) throw new Error("Thiếu URN. Ví dụ: so-hoa tao vn:vbqppl:nd:45/2026/NĐ-CP");
      const doc = await getDocumentByUrn(urn);
      if (!doc) throw new Error(`Không có văn bản ${urn}`);
      // Số hóa đọc trang in nên phải lấy đúng bản PDF, không lấy DOCX. Văn bản đăng nhiều kỳ
      // Công báo có nhiều tệp PDF -> ghép lại thành một tệp trước.
      const pdf = str(args, "tep") ? undefined : await chuanBiPdfSoHoa(doc.id);
      const file = str(args, "tep")
        ? { uri: str(args, "tep")!, kind: "pdf", sourceRecordId: undefined }
        : pdf
          ? { uri: pdf.uri, kind: "pdf", sourceRecordId: pdf.sourceRecordId }
          : await pickPdfFile(doc.id);
      if (!file) {
        const co = await pickFileToConvert(doc.id);
        throw new Error(
          co
            ? `Văn bản ${urn} chưa có bản PDF trong kho (chỉ có ${co.kind}). Số hóa cần bản PDF; dùng --tep <uri> nếu muốn chỉ định tệp khác.`
            : `Văn bản ${urn} chưa có tệp nào trong kho`,
        );
      }
      const r = await taoViecSoHoaChoTep({
        documentId: doc.id,
        fileUri: file.uri,
        ...(file.sourceRecordId ? { sourceRecordId: file.sourceRecordId } : {}),
        kind: file.kind,
      });
      print({
        urn,
        tep: file.uri,
        ...(pdf && pdf.soPhan > 1 ? { so_phan: pdf.soPhan, cac_phan: pdf.cacPhan.map((p) => p.ten) } : {}),
        ...r,
      });
      break;
    }
    case "ghep-phan": {
      // Việc số hóa tạo trước khi có bước ghép phần chỉ trỏ tới tệp PDF của kỳ Công báo đầu tiên.
      // Với văn bản nhiều phần: tạo việc mới trên tệp ghép, chép lại các cụm đã nộp có cùng khoảng
      // trang (các cụm đầu không đổi vì kế hoạch chia cụm giống nhau), đánh dấu việc cũ là bỏ qua.
      const apDung = bool(args, "yes");
      const ketQua: unknown[] = [];
      for (const state of ["cho", "cho_duyet", "dang_lam"] as const) {
        const ds = await danhSachViecSoHoa({ state, limit: 500 });
        for (const t of ds) {
          const pdf = await chuanBiPdfSoHoa(t.document_id, t.source_record_id ?? undefined);
          if (!pdf || pdf.soPhan <= 1 || pdf.uri === t.file_uri) continue;
          const dong: Record<string, unknown> = {
            viec_cu: t.id,
            so_ky_hieu: t.so_ky_hieu,
            trang_thai_cu: t.state,
            so_phan: pdf.soPhan,
            cac_phan: pdf.cacPhan.map((p) => p.ten),
          };
          if (apDung) {
            const r = await taoViecSoHoaChoTep({
              documentId: t.document_id,
              fileUri: pdf.uri,
              sourceRecordId: pdf.sourceRecordId,
              kind: "pdf",
            });
            if (!r.taskId)
              throw new Error(`Không tạo được việc mới cho ${t.so_ky_hieu}: ${r.warnings.join("; ")}`);
            const moi = await layViecSoHoa(r.taskId);
            const keHoach = (moi?.windows ?? []) as { idx: number; tuTrang: number; denTrang: number }[];
            let chep = 0;
            for (const w of await layCacCuaSo(t.id)) {
              const k = keHoach.find(
                (x) => x.idx === w.idx && x.tuTrang === w.page_from && x.denTrang === w.page_to,
              );
              if (!k) continue;
              await ghiCuaSo({
                taskId: r.taskId,
                idx: w.idx,
                pageFrom: w.page_from,
                pageTo: w.page_to,
                markdown: w.markdown,
                openState: (w.open_state ?? {}) as Record<string, unknown>,
                tables: (w.tables ?? []) as unknown[],
                formulas: (w.formulas ?? []) as unknown[],
                figures: (w.figures ?? []) as unknown[],
                corrections: (w.corrections ?? []) as unknown[],
                warnings: (w.warnings ?? []) as unknown[],
                unreadableCount: w.unreadable_count ?? 0,
                ...(w.submitted_by ? { submittedBy: w.submitted_by } : {}),
                ...(w.model ? { model: w.model } : {}),
              });
              chep += 1;
            }
            await capNhatViecSoHoa(t.id, {
              state: "bo_qua",
              error: `Thay bằng việc ${r.taskId} trên tệp ghép ${pdf.soPhan} phần (${pdf.uri})`,
              finished: true,
            });
            Object.assign(dong, { viec_moi: r.taskId, so_trang_moi: moi?.page_count, cum_da_chep: chep });
          }
          ketQua.push(dong);
        }
      }
      print({
        ap_dung: apDung,
        so_viec: ketQua.length,
        viec: ketQua,
        ...(apDung ? {} : { ghi_chu: "Thêm --yes để thực hiện" }),
      });
      break;
    }
    case "tach-anh": {
      // Dựng ảnh PNG từng trang của tệp PDF gốc bằng pdftoppm (poppler-utils) trên máy vận hành,
      // để trợ lý đọc trực tiếp ảnh trang khi lớp văn bản thiếu hoặc không đáng tin (bản quét).
      // Chạy cục bộ, không đụng CSDL ngoài một lần đọc bản ghi việc.
      const viecId = args._[2];
      if (!viecId) throw new Error("Thiếu mã việc. Ví dụ: so-hoa tach-anh 132e3bc1-…");
      const t = await layViecSoHoa(viecId);
      if (!t) throw new Error(`Không có việc số hóa ${viecId}`);
      const dpi = num(args, "dpi") ?? 150;
      const cuaSo = num(args, "cua-so");
      const keHoach = (t.windows ?? []) as { idx: number; tuTrang: number; denTrang: number }[];
      const cs = cuaSo ? keHoach.find((w) => w.idx === cuaSo) : undefined;
      if (cuaSo && !cs) throw new Error(`Việc ${viecId} không có cụm ${cuaSo} (có ${keHoach.length} cụm)`);
      const tuTrang = cs?.tuTrang ?? 1;
      const denTrang = cs?.denTrang ?? t.page_count ?? 1;

      const tepPdf = await writeWorkFile(t.id, "goc.pdf", await getObject(t.file_uri));
      const thuMuc = join(tepPdf, "..", "anh");
      await Bun.$`mkdir -p ${thuMuc}`.quiet();
      const tienTo = join(thuMuc, "trang");
      const pdftoppm = Bun.spawn(
        [
          "pdftoppm",
          "-png",
          "-r",
          String(dpi),
          "-f",
          String(tuTrang),
          "-l",
          String(denTrang),
          tepPdf,
          tienTo,
        ],
        { stderr: "pipe" },
      );
      const ma = await pdftoppm.exited;
      if (ma !== 0) {
        throw new Error(
          `pdftoppm lỗi (mã ${ma}): ${await new Response(pdftoppm.stderr).text()}. Cài bằng: sudo apt install poppler-utils`,
        );
      }
      const tep = [...new Bun.Glob("trang-*.png").scanSync(thuMuc)]
        .map((f) => ({ f, trang: Number(/(\d+)\.png$/.exec(f)?.[1] ?? 0) }))
        .filter((x) => x.trang >= tuTrang && x.trang <= denTrang)
        .sort((a, b) => a.trang - b.trang)
        .map((x) => join(thuMuc, x.f));
      print({ viecId: t.id, tuTrang, denTrang, dpi, soAnh: tep.length, thuMuc, tep });
      break;
    }
    case "hoan-tat": {
      // Ghép lại và kiểm chứng lại từ `sohoa_windows` — dùng sau khi sửa luật ghép/luật
      // kiểm chứng, không phải gọi lại mô hình (ke-hoach/05 §10).
      const viecId = args._[2];
      if (!viecId) throw new Error("Thiếu mã việc. Ví dụ: so-hoa hoan-tat 9eecb5e4-…");
      const r = await hoanTatSoHoa({
        viecId,
        ...(bool(args, "bo-qua-canh-bao") ? { boQuaCanhBao: true } : {}),
      });
      print({
        viecId: r.viecId,
        soKyHieu: r.soKyHieu,
        trangThai: r.trangThai,
        diem: r.diem,
        kyTu: r.markdown.length,
        markdownUri: r.markdownUri,
        soKhoiTrung: r.soKhoiTrung,
        dayParse: r.dayParse ? r.cachDay : false,
        kiemTra: r.kiemTra.map((m) => `${m.dat ? "đạt" : "HỎNG"} — ${m.ten}: ${m.chiTiet}`),
        canhBao: r.canhBao.map((c) => c.message),
      });
      break;
    }
    case "dong-bo": {
      // MCP có thể đã chốt bản số hóa lúc không nối được Redis; đẩy nốt job parse ở đây.
      const cho = await sql`
        SELECT t.id, t.markdown_uri, d.urn FROM sohoa_tasks t JOIN documents d ON d.id = t.document_id
        WHERE t.state = 'xong' AND t.parse_queued = false AND t.markdown_uri IS NOT NULL`;
      let day = 0;
      for (const row of cho as unknown as Array<{ id: string; markdown_uri: string; urn: string }>) {
        await add(
          QUEUES.parse,
          { documentUrn: row.urn, markdownPath: row.markdown_uri },
          { key: `sohoa:${row.urn}` },
        );
        await capNhatViecSoHoa(row.id, { parseQueued: true });
        day++;
      }
      print({ dayParse: day });
      break;
    }
    case "don-dep": {
      if (!bool(args, "yes"))
        throw new Error("Thêm --yes để xác nhận xóa thư mục làm việc của các việc đã xong");
      const xong = await sql`SELECT id FROM sohoa_tasks WHERE state IN ('xong', 'bo_qua')`;
      let n = 0;
      for (const row of xong as unknown as Array<{ id: string }>) {
        await clearWorkDir(row.id);
        n++;
      }
      print({ daXoaThuMucLamViec: n });
      break;
    }
    default:
      throw new Error("Lệnh con: danh-sach | tao | hoan-tat | dong-bo | don-dep");
  }
}

/* ------------------------------------------------------------------ */

/** Token quản trị Cloudflare: biến môi trường, hoặc .env.cloudflare (không do Bun nạp). */
async function cloudflareToken(): Promise<string> {
  const tu = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (tu) return tu;
  const f = Bun.file(".env.cloudflare");
  if (await f.exists()) {
    const m = (await f.text()).match(/^\s*CLOUDFLARE_API_TOKEN\s*=\s*(.+)$/m);
    if (m?.[1]) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error(
    "Thiếu CLOUDFLARE_API_TOKEN. Cần token R2 quyền Admin Read & Write (chép ô 'Token value' " +
      "khi tạo token), đặt vào .env.cloudflare — khóa S3 trong .env KHÔNG sửa được cấu hình bucket.",
  );
}

/**
 * CORS của bucket. Đọc/ghi qua REST API của Cloudflare chứ không qua giao thức S3, vì
 * khóa S3 của ứng dụng chỉ có quyền trên đối tượng. Chính sách nằm ở infra/r2-cors.json
 * để sửa danh sách tên miền không phải chạm vào mã.
 */
async function cmdKhoCors(cfg: ReturnType<typeof storageConfig>, dat: boolean) {
  if (cfg.mode !== "r2") throw new Error("Kho đang chạy cục bộ, không có CORS để cấu hình.");
  const account = process.env.R2_ACCOUNT_ID?.trim();
  if (!account) throw new Error("Thiếu R2_ACCOUNT_ID để gọi REST API của Cloudflare.");
  const token = await cloudflareToken();
  const url = `https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/${cfg.bucket}/cors`;

  let body: string | undefined;
  if (dat) {
    const chinhSach = await Bun.file("infra/r2-cors.json").json();
    body = JSON.stringify(chinhSach);
  }
  const res = await fetch(url, {
    method: dat ? "PUT" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(dat ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body } : {}),
  });
  const ket = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    result?: unknown;
    errors?: unknown;
  };
  if (!res.ok || ket.success === false) {
    print({ bucket: cfg.bucket, http: res.status, loi: ket.errors ?? ket });
    process.exitCode = 1;
    return;
  }
  if (!dat) {
    print({ bucket: cfg.bucket, cors: ket.result ?? null });
    return;
  }
  // Đọc lại để chắc chắn Cloudflare đã nhận đúng thứ vừa gửi, không tin mỗi mã 200.
  const lai = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  print({ bucket: cfg.bucket, daDat: true, corsHienTai: ((await lai.json()) as any).result ?? null });
}

/** Tiền tố kho được đồng bộ mặc định. Bỏ `work/` vì đó là tệp tạm của việc số hóa. */
const TIEN_TO_KHO = ["raw", "pages", "assets", "derived"];

/**
 * Đẩy tệp còn nằm ở đĩa lên R2. Cần vì phần dữ liệu thu thập trước khi bật R2 chỉ có ở
 * `data/`, mà từ nay mọi thành phần đều đọc kho qua URI. Mặc định BỎ QUA khóa đã có trên
 * R2 — bản gốc là thứ không bao giờ ghi đè; muốn ghi đè phải nêu rõ `--ghi-de`.
 */
async function cmdKhoDongBo(cfg: ReturnType<typeof storageConfig>, args: Args) {
  if (cfg.mode !== "r2") throw new Error("Kho đang chạy cục bộ, không có gì để đẩy lên.");
  const thu = bool(args, "dry-run");
  const ghiDe = bool(args, "ghi-de");
  const tienTo = (str(args, "tien-to") ?? TIEN_TO_KHO.join(","))
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const daDay: string[] = [];
  const boQua: string[] = [];
  const loi: { uri: string; loi: string }[] = [];
  let byte = 0;

  for (const tt of tienTo) {
    const goc = join(cfg.dir, tt);
    const dsRel: string[] = [];
    try {
      for await (const rel of new Bun.Glob("**/*").scan({ cwd: goc, onlyFiles: true })) dsRel.push(rel);
    } catch {
      continue; // tiền tố chưa có thư mục nào ở đĩa
    }
    for (const rel of dsRel) {
      const uri = `${tt}/${rel.replaceAll("\\", "/")}`;
      const duongDan = join(goc, rel);
      try {
        if (!ghiDe && (await objectExists(uri))) {
          boQua.push(uri);
          continue;
        }
        if (thu) {
          daDay.push(uri);
          continue;
        }
        const loai = Bun.file(duongDan).type || "application/octet-stream";
        const kq = await putFromFile(uri, duongDan, { contentType: loai });
        byte += kq.bytes;
        daDay.push(uri);
      } catch (e) {
        loi.push({ uri, loi: errText(e) });
      }
    }
  }

  print({
    bucket: cfg.bucket,
    cheDo: thu ? "chạy thử (chưa ghi)" : "đã ghi",
    tienTo,
    daDay: daDay.length,
    tongByte: byte,
    boQuaVìĐãCó: boQua.length,
    loi,
    danhSach: daDay,
  });
  if (loi.length) process.exitCode = 1;
}

/**
 * Chẩn đoán kho đối tượng. Không tham số: in cấu hình đang có hiệu lực (khóa bí mật
 * chỉ hiện dạng rút gọn). `kiem-tra`: đi trọn một vòng ghi -> đọc -> liệt kê -> xóa
 * trên chính kho đó, nên nếu quyền của khóa R2 thiếu thì lỗi lộ ra ngay ở đây
 * chứ không phải giữa một đợt nạp kho.
 */
async function cmdKho(args: Args) {
  const cfg = storageConfig();
  const thongTin = {
    cheDo: cfg.mode,
    bucket: cfg.bucket || null,
    endpoint: cfg.endpoint || null,
    region: cfg.region,
    accessKeyId: cfg.accessKeyId ? `${cfg.accessKeyId.slice(0, 4)}…${cfg.accessKeyId.slice(-4)}` : null,
    secretAccessKey: cfg.secretAccessKey ? "đã đặt" : "chưa đặt",
    publicUrl: cfg.publicUrl || null,
    thuMuc: cfg.dir,
    thuMucBanSao: cfg.mode === "r2" ? cfg.cacheDir : null,
  };
  if (args._[1] === "dong-bo") {
    await cmdKhoDongBo(cfg, args);
    return;
  }
  if (args._[1] === "cors") {
    await cmdKhoCors(cfg, bool(args, "dat"));
    return;
  }
  if (args._[1] !== "kiem-tra") {
    print(thongTin);
    return;
  }

  const uri = `work/kiem-tra-kho/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`;
  const noiDung = `kiểm tra kho quydinhphapluat — ${new Date().toISOString()}`;
  const buoc: Record<string, string> = {};
  try {
    const ghi = await putObject(uri, noiDung, { contentType: "text/plain; charset=utf-8" });
    buoc.ghi = `${ghi.bytes} byte -> ${uri}`;
    buoc.doc = (await getText(uri)) === noiDung ? "khớp nguyên văn" : "LỆCH nội dung";
    const ds = await listObjects("work/kiem-tra-kho/", 20);
    buoc.lietKe = ds.includes(uri) ? "thấy khóa vừa ghi" : "KHÔNG thấy khóa vừa ghi";
    // Che chữ ký để dán nhật ký đi nơi khác không lộ khóa.
    buoc.url = objectUrl(uri, 300).replace(/([?&](?:X-Amz-)?Signature=)[^&]+/i, "$1…");
    await deleteObject(uri);
    buoc.xoa = (await objectExists(uri)) ? "VẪN CÒN" : "đã xóa";
  } catch (e) {
    print({ ...thongTin, buoc, ketQua: "LỖI", loi: errText(e) });
    process.exitCode = 1;
    return;
  }
  const hong = Object.values(buoc).some((v) => /LỆCH|KHÔNG|VẪN CÒN/.test(v));
  print({ ...thongTin, buoc, ketQua: hong ? "CÓ BƯỚC SAI" : "kho hoạt động" });
  if (hong) process.exitCode = 1;
}

/* ------------------------------------------------------------------ */
/* Mẫu số của việc nạp kho: đếm tổng số văn bản ở nguồn                */
/* ------------------------------------------------------------------ */

/** Slug loại văn bản ở Công báo -> mã loại nội bộ dùng trong kho. */
export const LOAI_CONGBAO_SANG_DOC_TYPE: Record<string, string> = {
  "hien-phap": "hp",
  "bo-luat": "bl",
  luat: "l",
  "phap-lenh": "pl",
  lenh: "lenh",
  "nghi-dinh": "nd",
  "nghi-quyet": "nq-qh",
  "nghi-quyet-lien-tich": "nqlt",
  "quyet-dinh": "qd-ttg",
  "thong-tu": "tt",
  "thong-tu-lien-tich": "ttlt",
  "van-ban-hop-nhat": "vbhn",
};

/** Các loại đếm mặc định: đúng những loại có trong khung cấu trúc kho. */
const LOAI_MAC_DINH = [
  "hien-phap",
  "bo-luat",
  "luat",
  "phap-lenh",
  "lenh",
  "nghi-dinh",
  "nghi-quyet",
  "quyet-dinh",
  "thong-tu",
  "thong-tu-lien-tich",
  "van-ban-hop-nhat",
];

async function cmdNguon(args: Args) {
  const sub = args._[1];
  switch (sub) {
    case "dem": {
      const loai =
        str(args, "loai")
          ?.split(",")
          .map((x) => x.trim())
          .filter(Boolean) ?? LOAI_MAC_DINH;
      const adapter = new CongbaoAdapter();
      const ra: Array<Record<string, unknown>> = [];
      for (const l of loai) {
        try {
          const d = await adapter.demTong(l);
          const docType = LOAI_CONGBAO_SANG_DOC_TYPE[l] ?? null;
          await ghiThongKeNguon({
            nguon: "congbao",
            loai: l,
            docType,
            tong: d.tong,
            soTrang: d.soTrang,
            moiTrang: d.moiTrang,
            chinhXac: d.chinhXac,
          });
          ra.push({ loai: l, docType, tong: d.tong, soTrang: d.soTrang, moiTrang: d.moiTrang });
          log.info("Đã đếm tổng ở nguồn", { loai: l, tong: d.tong, soTrang: d.soTrang });
        } catch (e) {
          ra.push({ loai: l, loi: errText(e) });
        }
      }
      print({ da_dem: ra, tien_do: await tienDoNapKho() });
      break;
    }
    case "tien-do": {
      const t = await tienDoNapKho();
      print({
        tong_o_nguon: t.tong,
        da_co_trong_kho: t.daCo,
        ty_le: `${(t.tyLe * 100).toFixed(1)}%`,
        so_loai_chua_dem: t.soLoaiChuaDem,
        theo_loai: t.theoLoai.map((x) => ({
          loai: x.loai,
          da_co: x.daCo,
          tong: x.tongONguon,
          ty_le: `${(x.tyLe * 100).toFixed(1)}%`,
        })),
      });
      break;
    }
    default:
      throw new Error("Lệnh con: dem | tien-do");
  }
}

/* ------------------------------------------------------------------ */

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  switch (cmd) {
    case "crawl":
      await cmdCrawl(args);
      break;
    case "ingest-file":
      await cmdIngestFile(args);
      break;
    case "pipeline":
      await cmdPipeline(args);
      break;
    case "extract-ops": {
      const urn = args._[1];
      if (!urn) throw new Error("Thiếu URN");
      const doc = await getDocumentByUrn(urn);
      if (!doc) throw new Error(`Không có văn bản ${urn}`);
      print(await extractOpsForDocument(doc.id, { enqueueConsolidate: false }));
      break;
    }
    case "approve-ops": {
      const urn = args._[1];
      if (!urn) throw new Error("Thiếu URN của văn bản sửa đổi");
      print({ approved: await approveOps(urn, { minConfidence: num(args, "min-confidence") ?? 0 }) });
      break;
    }
    case "consolidate": {
      const urn = args._[1];
      if (!urn) throw new Error("Thiếu URN của văn bản bị sửa đổi");
      print(
        await consolidateDocument(urn, {
          ...(str(args, "as-of") ? { asOf: str(args, "as-of")! } : {}),
          enqueueIndex: false,
        }),
      );
      break;
    }
    case "relations": {
      const urn = args._[1];
      if (!urn) throw new Error("Thiếu URN");
      const doc = await getDocumentByUrn(urn);
      if (!doc) throw new Error(`Không có văn bản ${urn}`);
      const r = await extractRelationsForDocument(doc.id);
      print({
        urn: r.urn,
        canCu: r.canCu,
        huongDan: r.huongDan,
        danChieu: r.danChieu,
        chaCon: r.chaCon,
        saved: r.saved,
      });
      break;
    }
    case "doc": {
      const urn = args._[1];
      if (!urn) throw new Error("Thiếu URN");
      const doc = await getDocumentByUrn(urn);
      if (!doc) throw new Error(`Không có văn bản ${urn}`);
      print({
        ...doc,
        versions:
          await sql`SELECT version_no, kind, valid_from, valid_to FROM document_versions WHERE document_id = ${doc.id} ORDER BY version_no`,
      });
      break;
    }
    case "worker": {
      const q = str(args, "queues");
      await runWorker({ ...(q ? { queues: q.split(",") } : {}), once: bool(args, "once") });
      break;
    }
    case "bull":
      await cmdBull(args);
      break;
    case "so-hoa":
      await cmdSoHoa(args);
      break;
    case "nguon":
      await cmdNguon(args);
      break;
    case "stats":
      await cmdStats();
      break;
    case "kho":
      await cmdKho(args);
      break;
    default:
      process.stdout.write(USAGE);
      if (cmd) process.exitCode = 1;
  }
}

if (import.meta.main) {
  try {
    await main();
  } catch (e) {
    log.error("CLI lỗi", { error: errText(e) });
    process.exitCode = 1;
  } finally {
    if (hasRedis()) {
      // Đóng cả Queue lẫn kết nối Redis dùng chung, nếu không tiến trình không thoát.
      await closeQueues().catch(() => {});
      await closeConnection().catch(() => {});
    }
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}
