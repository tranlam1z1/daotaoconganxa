/**
 * Hậu xử lý Markdown: mã hóa các quy tắc nối đoạn/nối câu ở ke-hoach/05 §4.2.
 *
 * Nguyên tắc: quy tắc nào KIỂM TRA ĐƯỢC bằng luật thì làm bằng luật, không giao cho
 * mô hình. Prompt vẫn dạy đúng những quy tắc này, còn ở đây là lưới an toàn cuối cùng.
 */
import { chuanHoaDongLap, type DongLap, laDauTrangCongBao, laSoTrang, laTrangChuKy } from "./heads.ts";
import type { TrangText } from "./types.ts";

/** Dòng mở đầu một nút cấu trúc hoặc một khối riêng: không được nối vào đoạn trước. */
export function laNhanCauTruc(dong: string): boolean {
  const s = dong.trim();
  if (!s) return false;
  return (
    /^#{1,6}\s/.test(s) ||
    /^<!--/.test(s) ||
    /^\|/.test(s) ||
    /^\$\$/.test(s) ||
    /^<table/i.test(s) ||
    /^(Phần|PHẦN)\s+(thứ\s+)?[^\s]/.test(s) ||
    /^(Chương|CHƯƠNG)\s+[IVXLCDM\d]/.test(s) ||
    /^(Mục|MỤC|Tiểu mục|TIỂU MỤC)\s+\d/.test(s) ||
    /^(Điều|ĐIỀU)\s+\d+[a-zđ]?\s*[.:]/.test(s) ||
    /^(Phụ lục|PHỤ LỤC)\b/.test(s) ||
    /^\d+[a-zđ]?\.\s/.test(s) ||
    /^[a-zđ]\d?\)\s/.test(s) ||
    /^[-*+]\s/.test(s) ||
    /^\*?Căn cứ\s/.test(s)
  );
}

/**
 * Dòng đứng riêng thành khối (heading, marker, bảng, công thức): dòng sau nó không bao
 * giờ được nối vào. Khác với nhãn khoản/điểm — nhãn chỉ MỞ đoạn, các dòng in tiếp theo
 * vẫn thuộc đoạn đó.
 */
export function dongKhoiRieng(dong: string): boolean {
  const s = dong.trim();
  return /^#{1,6}\s/.test(s) || /^<!--/.test(s) || /^\|/.test(s) || /^\$\$/.test(s) || /^<table/i.test(s);
}

/** Dòng tiêu đề cấp Điều/Chương/Mục/Phần/Phụ lục. */
function laTieuDeCap(dong: string): boolean {
  const s = dong.trim();
  return (
    /^(Điều|ĐIỀU)\s+\d+[a-zđ]?\s*[.:]/u.test(s) ||
    /^(Chương|CHƯƠNG)\s+[IVXLCDM\d]/u.test(s) ||
    /^(Mục|MỤC|Tiểu mục|TIỂU MỤC)\s+\d/u.test(s) ||
    /^(Phần|PHẦN)\s+(thứ\s+)?\S/u.test(s) ||
    /^(Phụ lục|PHỤ LỤC)\b/u.test(s)
  );
}

/** Dòng kết thúc trọn vẹn một ý: dòng sau bắt đầu đoạn mới. */
export function ketThucCau(dong: string): boolean {
  return /[.;:!?…"”)]\s*$/.test(dong.trim());
}

export interface TuyChonDonDep {
  /** Mẫu dòng lặp cần loại (từ `phatHienDongLap`). */
  dongLap?: DongLap[];
  /** Giữ nguyên header/footer (khi cần soi lỗi). */
  giuDauTrang?: boolean;
  /**
   * Chỉ coi dòng toàn số là số trang khi nó nằm ở hai dòng đầu hoặc hai dòng cuối trang, và bỏ
   * dòng đầu trang Công báo ở cả trang chữ ký. Dùng khi KHÔNG có agent đối chiếu lại bản in
   * (nạp PDF từ trang quản trị): mặc định, mọi dòng toàn số đều bị bỏ, kể cả ô số trong bảng.
   */
  giuSoGiuaTrang?: boolean;
}

function laDongRac(dong: string, mauLap: Set<string>): boolean {
  const s = dong.trim();
  if (!s) return false;
  if (laSoTrang(s) || laDauTrangCongBao(s)) return true;
  return mauLap.has(chuanHoaDongLap(s));
}

/**
 * Nối các dòng in thành đoạn: bản in xuống dòng vì hết dòng, không phải hết đoạn.
 * Xử lý luôn gạch nối cuối dòng do ngắt từ (tiếng Việt hầu như không gạch nối).
 */
export function noiDongThanhDoan(dong: string[]): string[] {
  const ra: string[] = [];
  for (const raw of dong) {
    const d = raw.trimEnd();
    if (!d.trim()) {
      if (ra.length && ra.at(-1) !== "") ra.push("");
      continue;
    }
    const truoc = ra.at(-1);
    // Tiêu đề Điều/Chương/Mục chỉ nối tiếp khi dòng sau viết thường — đó là tiêu đề dài bị
    // ngắt dòng. Dòng sau viết hoa hoặc là nhãn khoản/điểm thì đã là NỘI DUNG, không được
    // hút vào tiêu đề (nếu không, "Điều 2. Đối tượng áp dụng" nuốt luôn cả nội dung điều).
    const tieuDeMo = truoc !== undefined && laTieuDeCap(truoc) && !/^\p{Ll}/u.test(d.trim());
    const noiDuoc =
      truoc !== undefined &&
      truoc !== "" &&
      !laNhanCauTruc(d) &&
      !dongKhoiRieng(truoc) &&
      !tieuDeMo &&
      !ketThucCau(truoc);
    if (!noiDuoc) {
      ra.push(d.trim());
      continue;
    }
    if (/[-\u2010\u2011\u2012\u2013]$/.test(truoc) && /^\p{Ll}/u.test(d.trim())) {
      // Gạch nối do ngắt từ giữa dòng: bỏ gạch, nối liền.
      ra[ra.length - 1] = truoc.replace(/[-\u2010\u2011\u2012\u2013]$/, "") + d.trim();
    } else {
      ra[ra.length - 1] = `${truoc} ${d.trim()}`;
    }
  }
  return ra;
}

/**
 * Bản nháp Markdown từ lớp văn bản của PDF (tuyến `pdf_text`).
 * Đây KHÔNG phải kết quả cuối: agent vẫn phải soát lại, đánh marker nút, dựng bảng.
 * Mục đích là để agent có sẵn nguyên văn chính xác, khỏi phải chép lại từ ảnh.
 */
export function nhapTuLopVanBan(trang: TrangText[], opts: TuyChonDonDep = {}): string {
  const mauLap = new Set((opts.dongLap ?? []).map((d) => d.mau));
  const dong: string[] = [];
  for (const t of trang) {
    const giuNguyenCuoiTrang = laTrangChuKy(t);
    const n = t.dong.length;
    const cua = t.dong.filter((d, i) => {
      if (opts.giuDauTrang) return true;
      if (!opts.giuSoGiuaTrang) return giuNguyenCuoiTrang || !laDongRac(d, mauLap);
      if (laDauTrangCongBao(d)) return false;
      // Trang chữ ký: không cắt gì ở cuối trang, kể cả dòng toàn số.
      if (laSoTrang(d)) return !(i < 2 || (i >= n - 2 && !giuNguyenCuoiTrang));
      return giuNguyenCuoiTrang || !mauLap.has(chuanHoaDongLap(d));
    });
    dong.push(...cua);
  }
  return noiDongThanhDoan(dong)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Dọn Markdown do agent nộp: bỏ dòng số trang còn sót, chuẩn hóa dòng trống,
 * gộp dòng bị ngắt giữa câu trong CÙNG một đoạn.
 */
export function donDepMarkdown(md: string): string {
  const dong = md.replaceAll("\r\n", "\n").split("\n");
  const giu: string[] = [];
  let trongBang = false;
  let trongCongThuc = false;
  for (const d of dong) {
    const s = d.trim();
    if (s.startsWith("$$")) trongCongThuc = !trongCongThuc;
    trongBang = s.startsWith("|") || /^<\/?(table|tr|td|th|thead|tbody)/i.test(s);
    if (!trongBang && !trongCongThuc && (laSoTrang(s) || laDauTrangCongBao(s))) continue;
    giu.push(d);
  }
  return giu
    .join("\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Ký tự "thật" của Markdown, bỏ marker và cú pháp — dùng để đối chiếu độ dài với lớp văn bản.
 * Phải bỏ cả thẻ HTML: bảng gộp ô xuất dạng <table> có hàng nghìn ký tự thẻ, đếm vào thì
 * văn bản nào có bảng lớn cũng bị coi là "dài quá ngưỡng".
 */
export function demKyTuNoiDung(md: string): number {
  return md
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[|*_`>]/g, "")
    .replace(/\s/g, "").length;
}
