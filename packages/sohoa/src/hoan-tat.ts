/**
 * Chốt một việc số hóa: ghép các cụm đã nộp -> kiểm chứng -> lưu Markdown -> đẩy bước phân tích.
 *
 * Dùng chung cho hai lối vào, cố ý KHÔNG viết hai lần:
 *   - công cụ MCP `hoan_tat_so_hoa` (agent gọi ngay sau khi nộp đủ cụm);
 *   - lệnh `bun run pipeline so-hoa hoan-tat <viec_id>` (chạy lại sau khi sửa luật ghép
 *     hoặc luật kiểm chứng — ke-hoach/05 §10: `sohoa_windows` giữ nguyên đầu ra từng cụm
 *     nên ghép lại được mà không phải gọi lại mô hình).
 */
import { capNhatViecSoHoa, enqueue, layCacCuaSo, layViecSoHoa, type SoHoaTaskRow, sql } from "@qdpl/db";
import { getObject, putText } from "@qdpl/storage";
import { docTrangPdf } from "./pdf.ts";
import { ghepCacCuaSo } from "./stitch.ts";
import type { BangKhaiBao, CanhBao, CuaSo } from "./types.ts";
import { TRANG_THAI_MO_RONG } from "./types.ts";
import { kiemChung, type MucKiemTra } from "./verify.ts";
import { lapKeHoachCuaSo } from "./windows.ts";

export interface KetQuaHoanTat {
  viecId: string;
  documentId: string;
  documentUrn: string;
  soKyHieu: string;
  trangThai: "xong" | "cho_duyet";
  diem: number;
  markdown: string;
  markdownUri: string;
  kiemTra: MucKiemTra[];
  canhBao: CanhBao[];
  soLieu: Record<string, number>;
  /** Số khối trùng đã cắt ở mỗi mối nối; số 0 giữa tài liệu là dấu hiệu ghép hụt. */
  soKhoiTrung: number[];
  dayParse: boolean;
  cachDay: string;
}

export interface VanBanCuaViec {
  id: string;
  urn: string;
  so_ky_hieu: string;
  title: string;
}

export async function vanBanCuaViec(task: SoHoaTaskRow): Promise<VanBanCuaViec> {
  const [row] = await sql`SELECT id, urn, so_ky_hieu, title FROM documents WHERE id = ${task.document_id}`;
  if (!row) throw new Error(`Việc số hóa ${task.id} trỏ tới văn bản không còn trong CSDL`);
  return row as unknown as VanBanCuaViec;
}

export function keHoachCuaViec(task: SoHoaTaskRow): CuaSo[] {
  const kh = (task.windows ?? []) as CuaSo[];
  if (kh.length) return kh;
  return lapKeHoachCuaSo(task.page_count ?? 0, { kichThuoc: task.window_size, chongLan: task.overlap });
}

export async function hoanTatSoHoa(opts: { viecId: string; boQuaCanhBao?: boolean }): Promise<KetQuaHoanTat> {
  const task = await layViecSoHoa(opts.viecId);
  if (!task) throw new Error(`Không có việc số hóa ${opts.viecId}`);
  const doc = await vanBanCuaViec(task);
  const kh = keHoachCuaViec(task);
  const rows = await layCacCuaSo(task.id);
  if (!rows.length) throw new Error("Chưa có cụm nào được nộp cho việc này.");
  const thieu = kh.filter((c) => !rows.some((r) => r.idx === c.idx));
  if (thieu.length) {
    throw new Error(
      `Còn thiếu ${thieu.length} cụm chưa nộp: ${thieu.map((c) => `${c.idx} (trang ${c.tuTrang}–${c.denTrang})`).join(", ")}`,
    );
  }

  const ghep = ghepCacCuaSo(
    rows.map((r) => ({
      cuaSo: (kh.find((c) => c.idx === r.idx) ?? {
        idx: r.idx,
        tuTrang: r.page_from,
        denTrang: r.page_to,
      }) as CuaSo,
      ketQua: {
        markdown: r.markdown,
        open_state: { ...TRANG_THAI_MO_RONG, ...(r.open_state as object) },
        tables: r.tables as BangKhaiBao[],
      },
    })),
  );

  // Đối chiếu độ dài chỉ có nghĩa khi nguồn có lớp văn bản đọc được.
  const bytes = task.route === "pdf_text" ? await getObject(task.file_uri).catch(() => undefined) : undefined;
  const trang = bytes ? docTrangPdf(bytes) : undefined;
  const bangKhai = rows.flatMap((r) => (r.tables as BangKhaiBao[]) ?? []);
  const kq = kiemChung({
    markdown: ghep.markdown,
    ...(trang ? { trang } : {}),
    ...(bangKhai.length ? { bang: bangKhai } : {}),
    toanVanBan: true,
  });

  const canhBao = [...ghep.canhBao, ...kq.canhBao];
  const dat = !kq.canDuyet || opts.boQuaCanhBao === true;
  const uri = `derived/${task.document_id}/so-hoa/document.md`;
  await putText(uri, ghep.markdown);

  // Đẩy bước phân tích cấu trúc. BullMQ là đường chính; không có Redis thì ghi vào bảng
  // `jobs` để không mất việc và đánh dấu parse_queued=false cho lệnh `so-hoa dong-bo`.
  let dayParse = false;
  let cachDay = "";
  if (dat) {
    try {
      const q = await import("@qdpl/queue");
      await q.add(q.QUEUES.parse, { documentUrn: doc.urn, markdownPath: uri }, { key: `sohoa:${doc.urn}` });
      dayParse = true;
      cachDay = "BullMQ";
    } catch (e) {
      await enqueue("parse", { documentId: task.document_id, markdownUri: uri, source: "so_hoa" }).catch(
        () => undefined,
      );
      cachDay = `bảng jobs (không nối được Redis: ${e instanceof Error ? e.message : e})`;
    }
  }

  await capNhatViecSoHoa(task.id, {
    state: dat ? "xong" : "cho_duyet",
    markdownUri: uri,
    quality: { diem: kq.diem, muc: kq.muc, so_lieu: kq.soLieu },
    warnings: canhBao,
    parseQueued: dayParse,
    finished: dat,
  });

  return {
    viecId: task.id,
    documentId: task.document_id,
    documentUrn: doc.urn,
    soKyHieu: doc.so_ky_hieu,
    trangThai: dat ? "xong" : "cho_duyet",
    diem: kq.diem,
    markdown: ghep.markdown,
    markdownUri: uri,
    kiemTra: kq.muc,
    canhBao,
    soLieu: kq.soLieu,
    soKhoiTrung: ghep.soKhoiTrung,
    dayParse,
    cachDay,
  };
}
