/** Kiểm thử lớp đọc PDF bằng TypeScript (không dùng Python). */
import { describe, expect, test } from "bun:test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { catCuaSoPdf, danhGiaLopVanBan, docTrangPdf, renderTrangPng, soTrangPdf } from "../src/pdf.ts";

async function pdfMau(soTrang: number, chuMoiTrang = 40): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= soTrang; i++) {
    const p = doc.addPage([595, 842]);
    p.drawText(`CONG BAO/So 145 + 146 ngay 10/02/2026`, { x: 50, y: 800, size: 9, font });
    for (let d = 0; d < chuMoiTrang; d++) {
      p.drawText(`Dieu ${i} khoan ${d} noi dung mau de kiem thu lop van ban cua trang ${i}`, {
        x: 50,
        y: 760 - d * 16,
        size: 11,
        font,
      });
    }
    p.drawText(`- ${i} -`, { x: 290, y: 40, size: 10, font });
  }
  return await doc.save();
}

describe("đọc PDF bằng MuPDF/pdf-lib", () => {
  test("đếm trang và trích lớp văn bản kèm bbox", async () => {
    const bytes = await pdfMau(3);
    expect(soTrangPdf(bytes)).toBe(3);
    const trang = docTrangPdf(bytes);
    expect(trang).toHaveLength(3);
    expect(trang[0]?.trang).toBe(1);
    expect(trang[0]?.text).toContain("Dieu 1");
    expect(trang[0]?.soKyTu).toBeGreaterThan(200);
    expect(trang[0]?.khoi[0]?.bbox).toHaveLength(4);
    expect(trang[0]?.cao).toBe(842);
  });

  test("đọc theo khoảng trang", async () => {
    const bytes = await pdfMau(6);
    const trang = docTrangPdf(bytes, 3, 5);
    expect(trang.map((t) => t.trang)).toEqual([3, 4, 5]);
  });

  test("cắt cụm trang thành PDF con", async () => {
    const bytes = await pdfMau(6);
    const con = await catCuaSoPdf(bytes, 2, 4);
    expect(soTrangPdf(con)).toBe(3);
    expect(docTrangPdf(con)[0]?.text).toContain("Dieu 2");
  });

  test("kết xuất ảnh trang PNG", async () => {
    const bytes = await pdfMau(1);
    const png = renderTrangPng(bytes, 1, 100);
    expect(png.length).toBeGreaterThan(1000);
    // Chữ ký tệp PNG
    expect([...png.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  test("phân loại PDF có lớp văn bản và PDF quét", async () => {
    const coChu = danhGiaLopVanBan(docTrangPdf(await pdfMau(4)));
    expect(coChu.tuyen).toBe("pdf_text");
    const quet = danhGiaLopVanBan([
      { trang: 1, text: "", dong: [], soKyTu: 0, khoi: [], rong: 595, cao: 842 },
      { trang: 2, text: "x", dong: ["x"], soKyTu: 1, khoi: [], rong: 595, cao: 842 },
    ]);
    expect(quet.tuyen).toBe("pdf_anh");
  });
});
