/**
 * Đọc PDF bản quét bằng mô hình: mỗi cụm trang một lời gọi kèm chính các trang PDF đó, rồi ghép
 * các cụm thành một bản Markdown. Cùng prompt và cùng bộ ghép với đường số hóa qua MCP
 * (LENH.md mục 3.6), chỉ khác là API tự gọi mô hình thay cho một agent bên ngoài.
 *
 * Các cụm phải đọc lần lượt: cụm sau cần trạng thái dang dở và đoạn cuối của cụm trước để nối câu.
 * Thuộc tính (số ký hiệu, tên, cơ quan, ngày) lấy bằng một lời gọi riêng trên trang đầu.
 *
 * Tầng mô hình lấy từ `DOC_PDF_QUET_TANG` (`bulk` mặc định, `heavy` khi cần chính xác hơn và chấp
 * nhận chi phí gấp nhiều lần).
 */

import { sql } from "@qdpl/db";
import { inferDocType } from "@qdpl/legal-model";
import { complete, loadPrompt, type ModelTier, render, safeJson } from "@qdpl/llm";
import type { CuaSoDaNop, KetQuaCuaSo } from "@qdpl/sohoa";
import { getObject, getText, objectExists, putText } from "@qdpl/storage";
import type { ThuocTinhTuPdf } from "./routes/quan-tri-van-ban.ts";

const PROMPT_CUM_TRANG = "convert/page-window";
const PROMPT_THUOC_TINH = "extract/metadata";

/** Trần số trang một lần đọc bản quét, để một tệp nhầm không đốt cả ngân sách. */
export function soTrangQuetToiDa(): number {
  const n = Number(process.env.DOC_PDF_QUET_TRANG_TOI_DA ?? 150);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 150;
}

function tang(): ModelTier {
  return process.env.DOC_PDF_QUET_TANG === "heavy" ? "heavy" : "bulk";
}

const base64 = (b: Uint8Array) => Buffer.from(b).toString("base64");
const NGAY = /^\d{4}-\d{2}-\d{2}$/;
const chuoi = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export interface KetQuaDocQuet {
  markdown: string;
  thuocTinh: ThuocTinhTuPdf;
  soTrang: number;
  soCum: number;
  /** Số chỗ mô hình đánh dấu không đọc được, cộng qua các cụm. */
  soChoKhongDoc: number;
  soCanhBao: number;
  chiPhiUsd: number;
}

/** Bản Markdown và thuộc tính đã đọc được, lưu cạnh tệp gốc để chạy lại không phải đọc lại bản quét. */
type BanDaDoc = Pick<
  KetQuaDocQuet,
  "markdown" | "thuocTinh" | "soCum" | "soChoKhongDoc" | "soCanhBao" | "chiPhiUsd"
>;

/** Bản mô hình đã đọc của tệp này có sẵn trong kho chưa (đọc lại không tốn lời gọi mô hình). */
export async function coBanDaDoc(fileUri: string): Promise<boolean> {
  return (await objectExists(`${fileUri}.md`)) && (await objectExists(`${fileUri}.json`));
}

/**
 * Đọc bản quét ở `fileUri`, hoặc lấy bản đã đọc lần trước. Tiến độ từng cụm trang ghi vào
 * `authoring_jobs.output` của việc `viecId`.
 */
export async function docHoacLayBanDaDoc(fileUri: string, viecId: string): Promise<BanDaDoc> {
  const mdUri = `${fileUri}.md`;
  const ttUri = `${fileUri}.json`;
  if (await coBanDaDoc(fileUri)) {
    const tt = JSON.parse(await getText(ttUri)) as Omit<BanDaDoc, "markdown" | "chiPhiUsd">;
    return { ...tt, markdown: await getText(mdUri), chiPhiUsd: 0 };
  }
  const kq = await docPdfQuet(await getObject(fileUri), async (xong, tong) => {
    await sql`UPDATE authoring_jobs SET output = ${sql.json({ cum_xong: xong, so_cum: tong } as never)}
              WHERE id = ${viecId}::uuid`;
  });
  await putText(mdUri, kq.markdown);
  await putText(
    ttUri,
    JSON.stringify({
      thuocTinh: kq.thuocTinh,
      soCum: kq.soCum,
      soChoKhongDoc: kq.soChoKhongDoc,
      soCanhBao: kq.soCanhBao,
    }),
    "application/json",
  );
  return kq;
}

/** Điều "Hiệu lực thi hành" trong bản Markdown, để mô hình trích ngày có hiệu lực. */
function dieuHieuLuc(md: string): string {
  const m = /^#+\s*Điều\s+\d+[a-z]?\.\s*(?:Hiệu lực|Điều khoản thi hành)[^\n]*\n[\s\S]{0,1500}/imu.exec(md);
  return m ? m[0] : "";
}

async function docThuocTinh(trangDau: Uint8Array, md: string): Promise<{ tt: ThuocTinhTuPdf; usd: number }> {
  const prompt = loadPrompt(PROMPT_THUOC_TINH);
  const res = await complete({
    tier: "bulk",
    promptName: PROMPT_THUOC_TINH,
    promptVersion: prompt.version,
    cacheableSystem: prompt.system,
    user: render(prompt.user, {
      source_uri: "(tệp tải lên từ trang quản trị)",
      source_name: "quan-tri",
      first_page_text: md.slice(0, 4000),
      last_page_text: md.slice(-3000),
      effect_clause_text: dieuHieuLuc(md),
    }),
    pdfs: [{ base64: base64(trangDau), mediaType: "application/pdf" }],
    maxTokens: 4000,
    effort: "medium",
  });
  const o = (res.json ?? safeJson(res.text) ?? {}) as Record<string, unknown>;
  const soKyHieu = chuoi(o.soKyHieu);
  const docType = chuoi(o.docType) ?? (soKyHieu ? inferDocType(soKyHieu) : undefined);
  const ngay = (v: unknown) => (typeof v === "string" && NGAY.test(v) ? v : undefined);
  const tt: ThuocTinhTuPdf = {};
  if (soKyHieu) tt.soKyHieu = soKyHieu;
  if (docType) tt.docType = docType;
  const title = chuoi(o.title);
  if (title) tt.title = title;
  const issuer = chuoi(o.issuer);
  if (issuer) tt.issuer = issuer;
  const signer = chuoi((o.signer as { name?: unknown } | null)?.name);
  if (signer) tt.signer = signer;
  const issuedDate = ngay(o.issuedDate);
  if (issuedDate) tt.issuedDate = issuedDate;
  const effectiveFrom = ngay(o.effectiveFrom);
  if (effectiveFrom) tt.effectiveFrom = effectiveFrom;
  return { tt, usd: res.costUsd };
}

/**
 * Đọc cả tệp. `tienDo(xong, tong)` được gọi sau mỗi cụm trang. Ném lỗi khi một cụm không trả
 * Markdown: thiếu một cụm thì văn bản thủng giữa chừng, không dùng làm căn cứ được.
 */
export async function docPdfQuet(
  bytes: Uint8Array,
  tienDo: (xong: number, tong: number) => Promise<void> = async () => {},
): Promise<KetQuaDocQuet> {
  const { catCuaSoPdf, ghepCacCuaSo, lapKeHoachCuaSo, soTrangPdf, TRANG_THAI_MO_RONG } = await import(
    "@qdpl/sohoa"
  );
  const soTrang = soTrangPdf(bytes);
  if (soTrang > soTrangQuetToiDa()) {
    throw new Error(`Bản quét dài ${soTrang} trang, vượt mức ${soTrangQuetToiDa()} trang của một lần đọc.`);
  }
  const keHoach = lapKeHoachCuaSo(soTrang);
  const prompt = loadPrompt(PROMPT_CUM_TRANG);

  const daNop: CuaSoDaNop[] = [];
  let chiPhiUsd = 0;
  let soChoKhongDoc = 0;
  let soCanhBao = 0;
  let moTruoc = TRANG_THAI_MO_RONG;
  let duoiTruoc = "";

  for (const cuaSo of keHoach) {
    const cum = await catCuaSoPdf(bytes, cuaSo.tuTrang, cuaSo.denTrang);
    const res = await complete({
      tier: tang(),
      promptName: PROMPT_CUM_TRANG,
      promptVersion: prompt.version,
      cacheableSystem: prompt.system,
      user: render(prompt.user, {
        doc_urn: "(chưa xác định)",
        so_ky_hieu: "(chưa xác định)",
        doc_type_name: "(chưa xác định)",
        title: "(chưa xác định)",
        asset_prefix: "",
        page_range: `${cuaSo.tuTrang}-${cuaSo.denTrang}`,
        overlap_page: cuaSo.trangChongLan ?? "(không có)",
        open_state_prev: JSON.stringify(moTruoc),
        tail_context: duoiTruoc,
        layer_text: "",
        running_heads: "",
        window_pdf: "(đính kèm)",
      }),
      pdfs: [{ base64: base64(cum), mediaType: "application/pdf" }],
      maxTokens: 32_000,
    });
    chiPhiUsd += res.costUsd;
    const kq = (res.json ?? safeJson(res.text)) as KetQuaCuaSo | null;
    if (!kq || typeof kq.markdown !== "string" || !kq.markdown.trim()) {
      throw new Error(`Mô hình không đọc được cụm trang ${cuaSo.tuTrang}-${cuaSo.denTrang}.`);
    }
    daNop.push({ cuaSo, ketQua: { ...kq, open_state: kq.open_state ?? TRANG_THAI_MO_RONG } });
    moTruoc = kq.open_state ?? TRANG_THAI_MO_RONG;
    duoiTruoc = kq.markdown
      .trim()
      .split(/\n{2,}/)
      .slice(-3)
      .join("\n\n");
    soChoKhongDoc += Number(kq.unreadable_count ?? 0) || 0;
    soCanhBao += kq.warnings?.length ?? 0;
    await tienDo(cuaSo.idx, keHoach.length);
  }

  const ghep = ghepCacCuaSo(daNop);
  const tt = await docThuocTinh(await catCuaSoPdf(bytes, 1, 1), ghep.markdown);
  return {
    markdown: ghep.markdown,
    thuocTinh: tt.tt,
    soTrang,
    soCum: keHoach.length,
    soChoKhongDoc,
    soCanhBao: soCanhBao + ghep.canhBao.length,
    chiPhiUsd: chiPhiUsd + tt.usd,
  };
}
