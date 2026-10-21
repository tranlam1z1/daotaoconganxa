/**
 * Dựng bản PDF của tài liệu hướng dẫn từ cùng nội dung với web.
 *
 * - Chromium in HTML ra PDF: đánh số trang, đầu trang, chân trang, bookmark theo tiêu đề.
 * - Mục lục là liên kết nội bộ nên bấm được. Số trang của mục lục lấy từ chính bản PDF vừa in
 *   (mupdf phân giải đích của từng liên kết), rồi in lại cho tới khi số trang ổn định.
 * - Chromium vẽ đầu/chân trang lên mọi trang, kể cả trang bìa; pdf-lib phủ trang bìa in riêng
 *   lên trang 1 sau cùng, không động tới liên kết và bookmark của các trang khác.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import * as mupdf from "mupdf";
import { PDFDocument } from "pdf-lib";
import type { Browser } from "playwright-core";
import { htmlBai, type KhoHuongDan } from "../../apps/web/app/lib/huong-dan.ts";
import { escapeHtml } from "../../apps/web/app/lib/markdown.ts";
import { tepAnh } from "./bao-ve.ts";
import { MAU_DO } from "./chup.ts";
import { bam, GOC } from "./nguon.ts";

const MAU_CHU_DAO = "#1d3a97";
const PHONG = `"Be Vietnam Pro", "Noto Sans", "DejaVu Sans", Arial, sans-serif`;
const THU_MUC_TAM = join(GOC, "data/work/huong-dan/pdf");

/**
 * Bản ảnh nhẹ cho PDF, tham chiếu bằng file://.
 *
 * Ảnh chụp ở tỉ lệ điểm ảnh 2 (rộng 2560 px) giải nén ra hàng chục MB mỗi hình; in cả tài liệu với
 * ảnh gốc từng làm tiến trình treo trên máy ít bộ nhớ, còn nhúng data URI thì làm setContent treo.
 * Thu về tối đa 1600 px (khoảng 230 dpi trên khổ A4), nén JPEG, lưu đệm theo băm của ảnh gốc.
 */
async function thuNhoAnh(browser: Browser, kho: KhoHuongDan): Promise<Map<string, string>> {
  const thuMuc = join(THU_MUC_TAM, "anh");
  mkdirSync(thuMuc, { recursive: true });
  const kq = new Map<string, string>();
  const page = await browser.newPage();
  try {
    for (const kb of kho.dsBai.flatMap((b) => b.anh)) {
      const goc = tepAnh(kb.ten);
      if (!existsSync(goc)) continue;
      const du = readFileSync(goc);
      const tep = join(thuMuc, `${kb.ten}-${bam(du).slice(0, 12)}.jpg`);
      if (!existsSync(tep)) {
        const jpeg = await page.evaluate(
          async ({ src, rong }) => {
            const img = new Image();
            img.src = src;
            await img.decode();
            const tiLe = Math.min(1, rong / img.naturalWidth);
            const c = document.createElement("canvas");
            c.width = Math.round(img.naturalWidth * tiLe);
            c.height = Math.round(img.naturalHeight * tiLe);
            const g = c.getContext("2d")!;
            g.fillStyle = "#ffffff";
            g.fillRect(0, 0, c.width, c.height);
            g.imageSmoothingQuality = "high";
            g.drawImage(img, 0, 0, c.width, c.height);
            return c.toDataURL("image/jpeg", 0.88).split(",")[1]!;
          },
          {
            src: `data:image/png;base64,${du.toString("base64")}`,
            rong: kb.thiet_bi === "dien-thoai" ? 700 : 1600,
          },
        );
        writeFileSync(tep, Buffer.from(jpeg, "base64"));
      }
      kq.set(kb.ten, pathToFileURL(tep).href);
    }
  } finally {
    await page.close();
  }
  return kq;
}

/** Chặn treo: báo lỗi khi quá hạn hoặc khi Chromium chết giữa chừng, thay vì chờ mãi. */
function canhGac<T>(browser: Browser, viec: Promise<T>, ms: number, ten: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const hen = setTimeout(() => reject(new Error(`${ten}: quá ${ms / 1000} giây.`)), ms);
    const chet = () => reject(new Error(`${ten}: Chromium đã dừng giữa chừng (thường do thiếu bộ nhớ).`));
    browser.once("disconnected", chet);
    viec.then(resolve, reject).finally(() => {
      clearTimeout(hen);
      browser.off("disconnected", chet);
    });
  });
}

const CSS = `
@page { size: A4; margin: 24mm 17mm 20mm; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: ${PHONG}; font-size: 10.5pt; line-height: 1.55; color: #14181f; }
a { color: ${MAU_CHU_DAO}; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.bia-cho { height: 240mm; break-after: page; }
.muc-luc h1 { font-size: 20pt; color: ${MAU_CHU_DAO}; margin: 0 0 6mm; }
.muc-luc a { display: flex; align-items: baseline; gap: 2mm; color: inherit; text-decoration: none; padding: 1.1mm 0; }
.muc-luc .cham { flex: 1; border-bottom: 0.8pt dotted #8a92a0; transform: translateY(-1mm); }
.muc-luc .trang { min-width: 8mm; text-align: right; font-variant-numeric: tabular-nums; }
.muc-luc .dong-chuong { font-weight: 700; margin-top: 3.5mm; font-size: 11pt; }
.muc-luc .dong-bai { padding-left: 7mm; }
.muc-luc .so { min-width: 9mm; }
.chuong { break-before: page; padding-top: 45mm; }
.chuong .nhan { font-size: 11pt; letter-spacing: 0.08em; text-transform: uppercase; color: #646c7a; }
.chuong h1 { font-size: 26pt; line-height: 1.2; color: ${MAU_CHU_DAO}; margin: 2mm 0 5mm; }
.chuong .tom-tat { font-size: 12pt; color: #454c58; max-width: 140mm; }
.chuong ol { margin: 10mm 0 0; padding: 0; list-style: none; border-top: 0.6pt solid #d8dce3; }
.chuong li { padding: 2.2mm 0; border-bottom: 0.6pt solid #d8dce3; }
.chuong li a { color: inherit; text-decoration: none; }
.bai { break-before: page; }
.bai > .nhan { margin: 0 0 1mm; font-size: 8.5pt; letter-spacing: 0.06em; text-transform: uppercase; color: #646c7a; }
.bai > h2 { font-size: 17pt; line-height: 1.25; color: ${MAU_CHU_DAO}; margin: 0 0 2mm; }
.bai > .tom-tat { color: #454c58; margin: 0 0 5mm; padding-bottom: 3mm; border-bottom: 0.6pt solid #d8dce3; }
.bai h3 { font-size: 12.5pt; margin: 6mm 0 2mm; break-after: avoid; }
.bai h4 { font-size: 11pt; margin: 4mm 0 1.5mm; break-after: avoid; }
.bai p { margin: 0 0 2.4mm; }
.bai ul, .bai ol:not(.hd-chu-giai) { margin: 0 0 2.4mm; padding-left: 6mm; }
.bai li { margin-bottom: 1mm; }
.bai strong { font-weight: 600; }
.bai code, .bai kbd { font-size: 0.92em; background: #eceef2; padding: 0 1mm; border-radius: 1mm; }
.table-scroll { margin: 0 0 3mm; }
.table-scroll table { border-collapse: collapse; width: 100%; font-size: 9.5pt; }
.table-scroll th, .table-scroll td { border: 0.6pt solid #c9ced6; padding: 1.4mm 2mm; text-align: left; vertical-align: top; }
.table-scroll th { background: #f1f3f6; }
.hd-hinh { margin: 3mm 0 5mm; break-inside: avoid; }
.hd-hinh img { display: block; max-width: 100%; max-height: 165mm; margin: 0 auto; border: 0.6pt solid #d8dce3; border-radius: 1.5mm; }
.hd-hinh--dien-thoai img { max-width: 72mm; }
.hd-hinh-cho { padding: 18mm 4mm; border: 0.8pt dashed #c9ced6; border-radius: 1.5mm; background: #f6f7f9; color: #646c7a; text-align: center; font-size: 9.5pt; }
.hd-hinh figcaption { margin-top: 1.8mm; font-size: 9pt; color: #646c7a; text-align: center; }
.hd-chu-giai { margin: 2.5mm 0 0; padding: 0; list-style: none; font-size: 9.5pt; }
.hd-chu-giai li { display: flex; gap: 2mm; align-items: flex-start; margin-bottom: 1.2mm; }
.hd-so { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 4.6mm; height: 4.6mm;
  border-radius: 50%; background: ${MAU_DO}; color: #fff; font-size: 7.5pt; font-weight: 700; line-height: 1; margin-top: 0.4mm; }
`;

export function htmlTaiLieu(
  kho: KhoHuongDan,
  trang: Map<string, number>,
  urlAnh: (ten: string) => string | null = (ten) =>
    existsSync(tepAnh(ten)) ? pathToFileURL(tepAnh(ten)).href : null,
): string {
  const soTrang = (id: string) => (trang.get(id) ? String(trang.get(id)) : "");
  const dongMucLuc = kho.mucLuc.chuong
    .map((ch, i) => {
      const dsBai = kho.dsBai.filter((b) => b.chuong.id === ch.id);
      if (!dsBai.length) return "";
      const dong = (id: string, so: string, ten: string, lop: string) =>
        `<a class="${lop}" href="#${id}"><span class="so">${so}</span><span>${escapeHtml(ten)}</span><span class="cham"></span><span class="trang">${soTrang(id)}</span></a>`;
      return (
        dong(`chuong-${ch.id}`, `${i + 1}.`, ch.tieu_de, "dong-chuong") +
        dsBai.map((b) => dong(`bai-${b.id}`, b.so, b.tieu_de, "dong-bai")).join("")
      );
    })
    .join("");

  const noiDung = kho.mucLuc.chuong
    .map((ch, i) => {
      const dsBai = kho.dsBai.filter((b) => b.chuong.id === ch.id);
      if (!dsBai.length) return "";
      const trangChuong =
        `<section class="chuong" id="chuong-${ch.id}"><p class="nhan">Chương ${i + 1}</p>` +
        `<h1>${escapeHtml(ch.tieu_de)}</h1>` +
        (ch.tom_tat ? `<p class="tom-tat">${escapeHtml(ch.tom_tat)}</p>` : "") +
        `<ol>${dsBai.map((b) => `<li><a href="#bai-${b.id}">${b.so}. ${escapeHtml(b.tieu_de)}</a></li>`).join("")}</ol></section>`;
      const cacBai = dsBai
        .map(
          (b) =>
            // Dòng nhãn chương đứng trước h2 là bắt buộc: Chromium (PDF có gắn thẻ) nhân đôi tiêu đề
            // bookmark khi tiêu đề là nội dung đầu tiên sau một lần ngắt trang cưỡng bức.
            `<article class="bai" id="bai-${b.id}"><p class="nhan">Chương ${i + 1}. ${escapeHtml(ch.tieu_de)}</p>` +
            `<h2>${b.so}. ${escapeHtml(b.tieu_de)}</h2>` +
            `<p class="tom-tat">${escapeHtml(b.tom_tat)}</p>` +
            htmlBai(b, { urlAnh, lechTieuDe: 1 }) +
            "</article>",
        )
        .join("");
      return trangChuong + cacBai;
    })
    .join("");

  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(kho.mucLuc.tieu_de)}</title>
<style>${CSS}</style></head><body>
<div class="bia-cho" aria-hidden="true"></div>
<nav class="muc-luc"><h1>Mục lục</h1>${dongMucLuc}</nav>
${noiDung}
</body></html>`;
}

function htmlBia(kho: KhoHuongDan, ngay: string): string {
  const soHinh = kho.dsBai.reduce((n, b) => n + b.anh.length, 0);
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>
@page { size: A4; margin: 0; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: ${PHONG}; }
.bia { box-sizing: border-box; width: 210mm; height: 297mm; padding: 28mm 22mm 24mm; background: ${MAU_CHU_DAO}; color: #fff;
  display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; position: relative; }
.ky-hieu { position: absolute; right: -8mm; top: 60mm; font-size: 210pt; line-height: 1; color: rgba(255,255,255,.08); font-family: Georgia, serif; }
.dau { font-size: 12pt; letter-spacing: .12em; text-transform: uppercase; opacity: .85; }
h1 { font-size: 38pt; line-height: 1.12; margin: 0 0 6mm; font-weight: 700; }
.phu { font-size: 14pt; line-height: 1.45; max-width: 140mm; opacity: .92; margin: 0; }
.cuoi { font-size: 10.5pt; opacity: .9; border-top: 0.8pt solid rgba(255,255,255,.35); padding-top: 5mm; }
</style></head><body><section class="bia">
<div class="ky-hieu">§</div>
<p class="dau">Quy định Pháp luật</p>
<div><h1>Hướng dẫn sử dụng</h1>
<p class="phu">Tra cứu, đọc và đối chiếu văn bản quy phạm pháp luật; hỏi đáp có trích dẫn; trường hợp ứng dụng; đào tạo chuyên đề và quản trị đào tạo.</p></div>
<p class="cuoi">Cập nhật ngày ${ngay} · ${kho.dsBai.length} bài hướng dẫn · ${soHinh} hình minh hoạ</p>
</section></body></html>`;
}

function mauDauChanTrang(noiDung: string, dem: string): string {
  return `<div style="box-sizing:border-box;width:100%;padding:${dem};font-family:${PHONG.replace(/"/g, "'")};font-size:8pt;color:#646c7a;display:flex;justify-content:space-between;align-items:center;">${noiDung}</div>`;
}

/** id đích (không có #) -> số trang, đọc từ các liên kết nội bộ trong PDF. */
function trangCuaDich(pdf: Uint8Array): Map<string, number> {
  const doc = mupdf.Document.openDocument(pdf, "application/pdf");
  const kq = new Map<string, number>();
  for (let i = 0; i < doc.countPages(); i++) {
    for (const lk of doc.loadPage(i).getLinks()) {
      const uri = lk.getURI();
      const m = /^#nameddest=(.+)$/.exec(uri);
      if (!m || lk.isExternal()) continue;
      kq.set(decodeURIComponent(m[1]!), doc.resolveLink(uri) + 1);
    }
  }
  return kq;
}

function giongNhau(a: Map<string, number>, b: Map<string, number>): boolean {
  return a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);
}

export interface KetQuaPdf {
  bytes: Uint8Array;
  soTrang: number;
}

export async function dungPdf(browser: Browser, kho: KhoHuongDan, ngay: string): Promise<KetQuaPdf> {
  const page = await browser.newPage();
  try {
    const tuyChon = {
      format: "A4" as const,
      printBackground: true,
      preferCSSPageSize: true,
      outline: true,
      tagged: true,
      displayHeaderFooter: true,
      headerTemplate: mauDauChanTrang(
        `<span>Hướng dẫn sử dụng Quy định Pháp luật</span><span>Cập nhật ${ngay}</span>`,
        "0 17mm 0; margin-top: 9mm",
      ),
      footerTemplate: mauDauChanTrang(
        `<span>Tài liệu tham khảo cho người sử dụng</span><span>Trang <span class="pageNumber"></span> / <span class="totalPages"></span></span>`,
        "0 17mm; margin-bottom: 8mm",
      ),
    };

    const anhThuNho = await thuNhoAnh(browser, kho);
    const urlAnh = (ten: string) => anhThuNho.get(ten) ?? null;
    let trang = new Map<string, number>();
    let pdf: Uint8Array = new Uint8Array();
    for (let lan = 0; lan < 4; lan++) {
      // Mở từ tệp (file://) để trang được nạp ảnh file:// và không phải truyền cả tài liệu qua setContent.
      mkdirSync(THU_MUC_TAM, { recursive: true });
      const tepHtml = join(THU_MUC_TAM, "tai-lieu.html");
      writeFileSync(tepHtml, htmlTaiLieu(kho, trang, urlAnh));
      await canhGac(
        browser,
        page.goto(pathToFileURL(tepHtml).href, { waitUntil: "load", timeout: 300_000 }),
        320_000,
        "Mở tài liệu",
      );
      await page.evaluate(() => document.fonts.ready);
      pdf = await canhGac(browser, page.pdf(tuyChon), 600_000, `In PDF lượt ${lan + 1}`);
      console.log(`  In lượt ${lan + 1}: ${(pdf.length / 1024 / 1024).toFixed(1)} MB`);
      const moi = trangCuaDich(pdf);
      if (lan > 0 && giongNhau(moi, trang)) break;
      trang = moi;
    }

    await page.setContent(htmlBia(kho, ngay), { waitUntil: "load" });
    const bia = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });

    const chinh = await PDFDocument.load(pdf, { updateMetadata: false });
    const [trangBia] = await chinh.embedPdf(await PDFDocument.load(bia), [0]);
    const trang1 = chinh.getPage(0);
    const { width, height } = trang1.getSize();
    trang1.drawPage(trangBia!, { x: 0, y: 0, width, height });
    chinh.setTitle(kho.mucLuc.tieu_de);
    chinh.setAuthor("Quy định Pháp luật");
    chinh.setSubject("Tài liệu hướng dẫn sử dụng hệ thống");
    chinh.setLanguage("vi-VN");
    chinh.setCreator("scripts/huong-dan.ts");
    const bytes = await chinh.save();

    // Kiểm lại: phủ trang bìa không được làm mất bookmark hay liên kết mục lục.
    const kiem = mupdf.Document.openDocument(bytes, "application/pdf");
    const soDich = trangCuaDich(bytes).size;
    if (!kiem.loadOutline()?.length || soDich < kho.dsBai.length) {
      throw new Error("Bản PDF sau khi phủ trang bìa bị mất bookmark hoặc liên kết mục lục.");
    }
    return { bytes, soTrang: kiem.countPages() };
  } finally {
    await page.close();
  }
}
