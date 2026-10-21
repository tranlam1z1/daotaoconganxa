/**
 * Đọc và ghi tệp Excel dùng chung: nhập người dùng (GĐ2), nhập câu hỏi (GĐ3), xuất báo cáo (GĐ7).
 *
 * Đọc theo TÊN CỘT chứ không theo vị trí: người soạn tệp hay chèn thêm cột hoặc đổi thứ tự.
 * Tên cột so khớp không phân biệt hoa thường và không phân biệt dấu tiếng Việt, nhận nhiều
 * cách viết cho cùng một cột.
 */
import ExcelJS from "exceljs";

/** "Họ và tên" -> "ho va ten": bỏ dấu, chữ thường, gộp khoảng trắng. */
export function chuanHoaTieuDe(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Mô tả một cột cần đọc: khóa nội bộ và các tên cột được chấp nhận. */
export interface CotDoc<K extends string> {
  khoa: K;
  tieuDe: string[];
  batBuoc?: boolean;
}

export interface DongExcel<K extends string> {
  /** Số dòng trong tệp Excel (dòng tiêu đề là 1), để báo lỗi đúng chỗ người dùng nhìn thấy. */
  dong: number;
  giaTri: Record<K, string>;
}

export class LoiTepExcel extends Error {}

/** Giá trị ô thành chuỗi: công thức lấy kết quả, chữ nhiều định dạng ghép lại, ngày ra ISO. */
function oThanhChuoi(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v)
      return v.richText
        .map((r) => r.text)
        .join("")
        .trim();
    if ("result" in v) return oThanhChuoi(v.result as ExcelJS.CellValue);
    if ("text" in v) return String(v.text).trim();
    if ("hyperlink" in v) return String((v as { hyperlink: string }).hyperlink).trim();
  }
  return String(v).trim();
}

/**
 * Đọc trang tính đầu tiên. Dòng 1 là tiêu đề; dòng trống hoàn toàn bị bỏ qua.
 * Thiếu cột bắt buộc thì ném LoiTepExcel nêu rõ tên cột.
 */
export async function docBangExcel<K extends string>(
  noiDung: ArrayBuffer | Uint8Array,
  cot: CotDoc<K>[],
): Promise<DongExcel<K>[]> {
  const wb = new ExcelJS.Workbook();
  try {
    const bytes = noiDung instanceof Uint8Array ? noiDung : new Uint8Array(noiDung);
    // Kiểu Buffer của exceljs khai theo @types/node cũ; dữ liệu thật là Uint8Array nên ép kiểu.
    await wb.xlsx.load(Buffer.from(bytes) as unknown as ExcelJS.Buffer);
  } catch {
    throw new LoiTepExcel("Không đọc được tệp. Tệp phải ở định dạng Excel .xlsx.");
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new LoiTepExcel("Tệp không có trang tính nào.");

  const viTri = new Map<K, number>();
  ws.getRow(1).eachCell((cell, soCot) => {
    const ten = chuanHoaTieuDe(oThanhChuoi(cell.value));
    for (const c of cot) {
      if (!viTri.has(c.khoa) && c.tieuDe.some((t) => chuanHoaTieuDe(t) === ten)) viTri.set(c.khoa, soCot);
    }
  });
  const thieu = cot.filter((c) => c.batBuoc && !viTri.has(c.khoa));
  if (thieu.length) {
    throw new LoiTepExcel(`Tệp thiếu cột: ${thieu.map((c) => `"${c.tieuDe[0]}"`).join(", ")}.`);
  }

  const ketQua: DongExcel<K>[] = [];
  ws.eachRow({ includeEmpty: false }, (row, soDong) => {
    if (soDong === 1) return;
    const giaTri = {} as Record<K, string>;
    let coDuLieu = false;
    for (const c of cot) {
      const so = viTri.get(c.khoa);
      const v = so ? oThanhChuoi(row.getCell(so).value) : "";
      giaTri[c.khoa] = v;
      if (v) coDuLieu = true;
    }
    if (coDuLieu) ketQua.push({ dong: soDong, giaTri });
  });
  return ketQua;
}

export interface CotGhi {
  tieuDe: string;
  khoa: string;
  rong?: number;
}

export interface TrangGhi {
  ten: string;
  cot: CotGhi[];
  dong: Array<Record<string, string | number | null>>;
  /** Ghi chú in nghiêng dưới bảng, ví dụ hướng dẫn điền. Không đặt ở trang được đọc khi nhập. */
  ghiChu?: string[];
}

/**
 * Giá trị thô từng ô của trang tính đầu tiên, giữ nguyên kiểu (số, chuỗi, ngày) như exceljs
 * đọc được; mỗi dòng là mảng theo cột, bắt đầu từ cột A. Dùng để kiểm tệp xuất ra trong test.
 */
export async function docOExcelTho(duLieu: ArrayBuffer | Uint8Array): Promise<unknown[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((duLieu instanceof Uint8Array ? duLieu : new Uint8Array(duLieu)) as never);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const ra: unknown[][] = [];
  ws.eachRow({ includeEmpty: true }, (row, so) => {
    ra[so - 1] = (row.values as unknown[]).slice(1);
  });
  return Array.from(ra, (d) => d ?? []);
}

/** Tạo tệp .xlsx nhiều trang tính; dòng tiêu đề in đậm và cố định khi cuộn. */
export async function taoTepExcel(trang: TrangGhi[]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "quydinhphapluat.vn";
  for (const t of trang) {
    const ws = wb.addWorksheet(t.ten, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = t.cot.map((c) => ({ header: c.tieuDe, key: c.khoa, width: c.rong ?? 20 }));
    ws.getRow(1).font = { bold: true };
    for (const d of t.dong) ws.addRow(d);
    if (t.ghiChu?.length) {
      ws.addRow([]);
      for (const g of t.ghiChu) ws.addRow([g]).font = { italic: true };
    }
  }
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
