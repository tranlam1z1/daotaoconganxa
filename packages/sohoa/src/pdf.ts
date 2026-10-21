/**
 * Đọc PDF hoàn toàn bằng TypeScript — thay cho PyMuPDF/pdftoppm/Docling ở bản Python.
 *
 *  - MuPDF (WASM, gói `mupdf`): số trang, lớp văn bản kèm bbox, kết xuất ảnh trang.
 *  - pdf-lib: cắt một cụm trang thành PDF con để agent đọc trực tiếp bản gốc.
 *
 * Ảnh trang chỉ cần khi client không đọc được tệp PDF; đọc thẳng PDF con giữ được
 * độ nét của bản gốc và tốn ít token hơn ảnh 300 DPI.
 */
import * as mupdf from "mupdf";
import { PDFDocument } from "pdf-lib";
import type { KhoiText, TrangText, TuyenSoHoa } from "./types.ts";

type MuDoc = ReturnType<typeof mupdf.Document.openDocument>;

function mo(bytes: Uint8Array): MuDoc {
  return mupdf.Document.openDocument(bytes, "application/pdf");
}

export function soTrangPdf(bytes: Uint8Array): number {
  const doc = mo(bytes);
  try {
    return doc.countPages();
  } finally {
    (doc as { destroy?: () => void }).destroy?.();
  }
}

interface MuBBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

function bboxCua(b: MuBBox | undefined): [number, number, number, number] {
  if (!b) return [0, 0, 0, 0];
  const r = (n: number) => Math.round(n * 10) / 10;
  return [r(b.x), r(b.y), r(b.x + b.w), r(b.y + b.h)];
}

/**
 * Đọc lớp văn bản của các trang trong khoảng [tuTrang, denTrang] (đánh số từ 1).
 * Bỏ trống hai tham số là đọc toàn bộ tài liệu.
 */
export function docTrangPdf(bytes: Uint8Array, tuTrang = 1, denTrang?: number): TrangText[] {
  const doc = mo(bytes);
  try {
    const tong = doc.countPages();
    const dau = Math.max(1, tuTrang);
    const cuoi = Math.min(tong, denTrang ?? tong);
    const out: TrangText[] = [];
    for (let i = dau; i <= cuoi; i++) {
      const page = doc.loadPage(i - 1);
      const bounds = page.getBounds() as [number, number, number, number];
      const st = JSON.parse(page.toStructuredText("preserve-whitespace").asJSON()) as {
        blocks?: Array<{ type?: string; bbox?: MuBBox; lines?: Array<{ bbox?: MuBBox; text?: string }> }>;
      };
      const khoi: KhoiText[] = [];
      const dong: string[] = [];
      for (const b of st.blocks ?? []) {
        if (b.type === "image") {
          khoi.push({ bbox: bboxCua(b.bbox), text: "", loai: "image" });
          continue;
        }
        const chu = (b.lines ?? []).map((l) => l.text ?? "").join("\n");
        khoi.push({ bbox: bboxCua(b.bbox), text: chu, loai: "text" });
        for (const l of b.lines ?? []) {
          const t = (l.text ?? "").trim();
          if (t) dong.push(t);
        }
      }
      const text = dong.join("\n");
      out.push({
        trang: i,
        text,
        dong,
        soKyTu: text.replace(/\s/g, "").length,
        khoi,
        rong: Math.round(bounds[2] - bounds[0]),
        cao: Math.round(bounds[3] - bounds[1]),
      });
      (page as { destroy?: () => void }).destroy?.();
    }
    return out;
  } finally {
    (doc as { destroy?: () => void }).destroy?.();
  }
}

type MuPixmap = ReturnType<ReturnType<MuDoc["loadPage"]>["toPixmap"]>;

function veTrang(bytes: Uint8Array, trang: number, dpi: number, xuat: (pix: MuPixmap) => Uint8Array) {
  const doc = mo(bytes);
  try {
    const page = doc.loadPage(trang - 1);
    const ti = dpi / 72;
    const pix = page.toPixmap(mupdf.Matrix.scale(ti, ti), mupdf.ColorSpace.DeviceRGB, false, true);
    const anh = xuat(pix);
    (pix as { destroy?: () => void }).destroy?.();
    (page as { destroy?: () => void }).destroy?.();
    return new Uint8Array(anh);
  } finally {
    (doc as { destroy?: () => void }).destroy?.();
  }
}

/** Kết xuất một trang thành PNG. DPI 200 đủ đọc; 300 cho bản quét mờ. */
export function renderTrangPng(bytes: Uint8Array, trang: number, dpi = 200): Uint8Array {
  return veTrang(bytes, trang, dpi, (pix) => pix.asPNG());
}

/** Kết xuất một trang thành JPEG: nhẹ hơn PNG nhiều lần với trang quét, để xem trên điện thoại. */
export function renderTrangJpeg(bytes: Uint8Array, trang: number, dpi = 130, chatLuong = 75): Uint8Array {
  return veTrang(bytes, trang, dpi, (pix) => pix.asJPEG(chatLuong));
}

/**
 * Ghép nhiều tệp PDF thành một, theo đúng thứ tự đưa vào. Dùng cho văn bản dài mà Công báo
 * đăng thành nhiều kỳ (mỗi kỳ một tệp): số hóa phải đọc trọn văn bản, không chỉ phần đầu.
 */
export async function ghepPdf(cacPhan: Uint8Array[]): Promise<Uint8Array> {
  if (cacPhan.length === 1) return cacPhan[0]!;
  const out = await PDFDocument.create();
  for (const bytes of cacPhan) {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const p of pages) out.addPage(p);
  }
  return await out.save();
}

/** Cắt một cụm trang thành PDF con (giữ nguyên nội dung, không kết xuất lại). */
export async function catCuaSoPdf(bytes: Uint8Array, tuTrang: number, denTrang: number): Promise<Uint8Array> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const tong = src.getPageCount();
  const dau = Math.max(1, tuTrang);
  const cuoi = Math.min(tong, denTrang);
  if (cuoi < dau)
    throw new Error(`Khoảng trang không hợp lệ: ${tuTrang}-${denTrang} (tài liệu có ${tong} trang)`);
  const out = await PDFDocument.create();
  const chiSo: number[] = [];
  for (let i = dau; i <= cuoi; i++) chiSo.push(i - 1);
  const pages = await out.copyPages(src, chiSo);
  for (const p of pages) out.addPage(p);
  return await out.save();
}

export interface DanhGiaLopVanBan {
  soTrang: number;
  /** Tỷ lệ trang có lượng chữ đủ để coi là có lớp văn bản. */
  tyLeTrangCoChu: number;
  kyTuMoiTrang: number;
  tuyen: Extract<TuyenSoHoa, "pdf_text" | "pdf_anh">;
  lyDo: string;
}

/** Ngưỡng "trang có chữ": ít hơn thì gần như chắc chắn là ảnh quét. */
export const NGUONG_KY_TU_MOI_TRANG = 180;
/** Tỷ lệ trang có chữ tối thiểu để đi tuyến PDF có lớp văn bản. */
export const NGUONG_TY_LE_TRANG_CO_CHU = 0.7;

/**
 * Phân loại đầu vào (05 §1): PDF có lớp văn bản dùng được, hay là bản quét phải đọc ảnh.
 * Chỉ dựa vào lượng chữ trích được — đơn giản, không cần mô hình.
 */
export function danhGiaLopVanBan(trang: TrangText[]): DanhGiaLopVanBan {
  const n = trang.length;
  if (!n) {
    return {
      soTrang: 0,
      tyLeTrangCoChu: 0,
      kyTuMoiTrang: 0,
      tuyen: "pdf_anh",
      lyDo: "Tài liệu không có trang nào",
    };
  }
  const coChu = trang.filter((t) => t.soKyTu >= NGUONG_KY_TU_MOI_TRANG).length;
  const tyLe = coChu / n;
  const tb = Math.round(trang.reduce((s, t) => s + t.soKyTu, 0) / n);
  const tuyen = tyLe >= NGUONG_TY_LE_TRANG_CO_CHU ? "pdf_text" : "pdf_anh";
  return {
    soTrang: n,
    tyLeTrangCoChu: Math.round(tyLe * 100) / 100,
    kyTuMoiTrang: tb,
    tuyen,
    lyDo:
      tuyen === "pdf_text"
        ? `${coChu}/${n} trang có lớp văn bản (trung bình ${tb} ký tự/trang)`
        : `chỉ ${coChu}/${n} trang có lớp văn bản (trung bình ${tb} ký tự/trang) — coi là bản quét`,
  };
}
