/**
 * Dựng tệp PDF dạng bảng cho các báo cáo (docs/PLAN.md GĐ7).
 *
 * Dùng pdf-lib + @pdf-lib/fontkit và nhúng phông Noto Sans (assets/fonts, giấy phép OFL), vì
 * phông chuẩn của PDF không có dấu tiếng Việt. Khổ A4 ngang; mỗi trang lặp lại dòng tiêu đề
 * cột; chữ dài quá ô thì cắt, thêm dấu "…" (bản đầy đủ nằm ở tệp Excel).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont, type PDFPage, rgb } from "pdf-lib";

const THU_MUC_PHONG = join(import.meta.dir, "..", "..", "..", "assets", "fonts");

export interface CotPdf {
  tieuDe: string;
  khoa: string;
  /** Độ rộng tương đối; các cột được co giãn cho vừa bề ngang trang. */
  rong?: number;
  /** Căn phải cho cột số. */
  canPhai?: boolean;
}

export interface BangPdf {
  tieuDe: string;
  /** Các dòng dưới tiêu đề: đơn vị, bộ lọc, ngày xuất, người xuất. */
  moTa: string[];
  cot: CotPdf[];
  dong: Array<Record<string, string | number | null>>;
  /** Dòng cuối trang cuối, ví dụ tổng hợp. */
  ghiChu?: string[];
}

let phongDem: Promise<{ thuong: Uint8Array; dam: Uint8Array }> | undefined;

function docPhong() {
  phongDem ??= Promise.all([
    readFile(join(THU_MUC_PHONG, "NotoSans-Regular.ttf")),
    readFile(join(THU_MUC_PHONG, "NotoSans-Bold.ttf")),
  ]).then(([thuong, dam]) => ({ thuong: new Uint8Array(thuong), dam: new Uint8Array(dam) }));
  return phongDem;
}

const KHO = { rong: 841.89, cao: 595.28 };
const LE = 36;
const CO_CHU = 9;
const CAO_DONG = 16;
const DEM_O = 4;
const MAU_KE = rgb(0.8, 0.8, 0.8);
const MAU_NEN_TIEU_DE = rgb(0.93, 0.94, 0.96);
const MAU_PHU = rgb(0.35, 0.35, 0.35);

function oChu(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return v.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
  return String(v).replace(/\s+/g, " ").trim();
}

/** Cắt chữ cho vừa bề rộng, thêm "…" khi phải cắt. */
function vuaO(chu: string, phong: PDFFont, co: number, rong: number): string {
  if (phong.widthOfTextAtSize(chu, co) <= rong) return chu;
  let lo = 0;
  let hi = chu.length;
  while (lo < hi) {
    const giua = Math.ceil((lo + hi) / 2);
    if (phong.widthOfTextAtSize(`${chu.slice(0, giua)}…`, co) <= rong) lo = giua;
    else hi = giua - 1;
  }
  return `${chu.slice(0, lo)}…`;
}

/** Một bảng trong tài liệu nhiều bảng; `tieuDe` là dòng chữ đậm đứng trên bảng. */
export interface PhanPdf {
  tieuDe?: string;
  cot: CotPdf[];
  dong: Array<Record<string, string | number | null>>;
  /** Dòng chữ ngay dưới bảng. */
  ghiChu?: string[];
  /** Chữ hiện thay cho bảng khi không có dòng nào. */
  trong?: string;
}

export interface TaiLieuPdf {
  tieuDe: string;
  moTa: string[];
  phan: PhanPdf[];
}

/** Tạo PDF một bảng, nhiều trang nếu cần. */
export async function taoPdfBang(b: BangPdf): Promise<Uint8Array> {
  return taoPdfNhieuBang({
    tieuDe: b.tieuDe,
    moTa: b.moTa,
    phan: [{ cot: b.cot, dong: b.dong, ghiChu: b.ghiChu }],
  });
}

/**
 * Tạo PDF gồm nhiều bảng nối nhau (hồ sơ một cán bộ: bài thi, bài học, luyện tập). Mỗi
 * bảng có bộ cột riêng; bảng tràn sang trang mới thì lặp lại dòng tiêu đề cột của chính nó.
 */
export async function taoPdfNhieuBang(t: TaiLieuPdf): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const phong = await docPhong();
  // Tắt các tính năng ghép glyph: với dấu tiếng Việt (ví dụ "ị"), fontkit ghép "i" thành glyph
  // i không chấm rồi ghi sai bảng ToUnicode, nên chép hoặc tìm chữ trong PDF ra "vi�", "Độị".
  const tinhNang = { ccmp: false, liga: false, locl: false };
  const thuong = await doc.embedFont(phong.thuong, { subset: true, features: tinhNang });
  const dam = await doc.embedFont(phong.dam, { subset: true, features: tinhNang });
  doc.setTitle(t.tieuDe);
  doc.setCreator("quydinhphapluat.vn");
  doc.setProducer("quydinhphapluat.vn");

  const rongBang = KHO.rong - 2 * LE;
  const CO_TIEU_DE_PHAN = 11;

  let trang!: PDFPage;
  let y = 0;
  // Cột của bảng đang vẽ.
  let cot: CotPdf[] = [];
  let rongCot: number[] = [];

  const veDong = (giaTri: string[], phongDong: PDFFont, nen?: ReturnType<typeof rgb>) => {
    if (nen) trang.drawRectangle({ x: LE, y: y - CAO_DONG, width: rongBang, height: CAO_DONG, color: nen });
    let x = LE;
    giaTri.forEach((v, i) => {
      const rong = rongCot[i]!;
      const chu = vuaO(v, phongDong, CO_CHU, rong - 2 * DEM_O);
      const rongChu = phongDong.widthOfTextAtSize(chu, CO_CHU);
      const xChu = cot[i]?.canPhai ? x + rong - DEM_O - rongChu : x + DEM_O;
      trang.drawText(chu, { x: xChu, y: y - CAO_DONG + 4.5, size: CO_CHU, font: phongDong });
      x += rong;
    });
    trang.drawLine({
      start: { x: LE, y: y - CAO_DONG },
      end: { x: LE + rongBang, y: y - CAO_DONG },
      thickness: 0.5,
      color: MAU_KE,
    });
    y -= CAO_DONG;
  };

  const veTieuDeCot = () =>
    veDong(
      cot.map((c) => c.tieuDe),
      dam,
      MAU_NEN_TIEU_DE,
    );

  const trangMoi = () => {
    trang = doc.addPage([KHO.rong, KHO.cao]);
    y = KHO.cao - LE;
  };

  trangMoi();
  trang.drawText(vuaO(t.tieuDe, dam, 15, rongBang), { x: LE, y: y - 15, size: 15, font: dam });
  y -= 24;
  for (const m of t.moTa) {
    trang.drawText(vuaO(m, thuong, 10, rongBang), {
      x: LE,
      y: y - 10,
      size: 10,
      font: thuong,
      color: MAU_PHU,
    });
    y -= 14;
  }
  y -= 6;

  t.phan.forEach((p, thuTu) => {
    cot = p.cot;
    const tongTyLe = cot.reduce((s, c) => s + (c.rong ?? 10), 0);
    rongCot = cot.map((c) => ((c.rong ?? 10) / tongTyLe) * rongBang);

    // Bảng sau cách bảng trước một khoảng; không đủ chỗ cho tiêu đề, dòng cột và một dòng dữ liệu
    // thì sang trang mới, để tiêu đề bảng không nằm trơ trọi cuối trang.
    const caoTieuDe = p.tieuDe ? CO_TIEU_DE_PHAN + 9 : 0;
    if (thuTu > 0) {
      y -= 14;
      if (y - caoTieuDe - 2 * CAO_DONG < LE + 14) trangMoi();
    }
    if (p.tieuDe) {
      trang.drawText(vuaO(p.tieuDe, dam, CO_TIEU_DE_PHAN, rongBang), {
        x: LE,
        y: y - CO_TIEU_DE_PHAN,
        size: CO_TIEU_DE_PHAN,
        font: dam,
      });
      y -= caoTieuDe;
    }
    veTieuDeCot();
    if (!p.dong.length) {
      trang.drawText(p.trong ?? "Không có dữ liệu khớp bộ lọc.", {
        x: LE + DEM_O,
        y: y - 14,
        size: CO_CHU,
        font: thuong,
      });
      y -= 18;
    }
    for (const d of p.dong) {
      if (y - CAO_DONG < LE + 14) {
        trangMoi();
        veTieuDeCot();
      }
      veDong(
        cot.map((c) => oChu(d[c.khoa])),
        thuong,
      );
    }
    for (const g of p.ghiChu ?? []) {
      if (y - 14 < LE + 14) {
        trangMoi();
        veTieuDeCot();
      }
      y -= 14;
      trang.drawText(vuaO(g, thuong, 10, rongBang), { x: LE, y, size: 10, font: thuong });
    }
  });

  const cacTrang = doc.getPages();
  cacTrang.forEach((p, i) => {
    const chu = `Trang ${i + 1}/${cacTrang.length}`;
    p.drawText(chu, {
      x: KHO.rong - LE - thuong.widthOfTextAtSize(chu, 8),
      y: LE / 2,
      size: 8,
      font: thuong,
      color: MAU_PHU,
    });
  });
  return await doc.save();
}
