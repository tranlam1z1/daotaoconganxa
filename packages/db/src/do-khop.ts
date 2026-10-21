/**
 * Xếp kết quả tra cứu nhanh theo độ khớp với truy vấn.
 *
 * Bộ lọc SQL so không dấu theo mảnh chữ, nên gõ "đỏ" lọt cả dòng chỉ có "độ" hay "do". Hàm ở đây
 * đưa dòng khớp thật lên trước, theo ba bậc: chứa nguyên cụm từ tìm kiếm > có đủ mọi từ (nguyên từ,
 * cùng một dòng) > chỉ khớp vài từ lẻ hoặc mảnh chữ.
 */

const boDau = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");

const tachTu = (s: string) =>
  s
    .normalize("NFC")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/** Cụm `a` có nằm liền nhau, đúng thứ tự trong `b` không, và bao nhiêu từ của `a` có trong `b`. */
function dem(a: string[], b: string[], khop: (x: string, y: string) => boolean) {
  const cum = b.some((_, i) => a.every((x, j) => i + j < b.length && khop(x, b[i + j]!)));
  return { cum, soTu: a.filter((x) => b.some((y) => khop(x, y))).length };
}

/** Các từ của truy vấn được gõ có dấu (chữ thường): người gõ đã nói rõ dấu nên phải khớp đúng dấu. */
export function tuCoDau(q: string): string[] {
  return tachTu(q).filter((t) => t !== boDau(t));
}

const khopChac = (x: string, y: string) => x === y || (x === boDau(x) && x === boDau(y));

/** Trả hàm kiểm một chữ có khớp chắc với từ nào của truy vấn không: "phát" không khớp "phạt". */
export function khopTuTruyVan(q: string): (chu: string) => boolean {
  const tu = tachTu(q);
  return (chu) => tachTu(chu).some((y) => tu.some((x) => khopChac(x, y)));
}

/**
 * Từ gõ có dấu phải khớp đúng dấu mới tính là khớp chắc; từ gõ không dấu thì khớp mọi dấu. Bậc tính
 * theo khớp chắc: 2 = chứa nguyên cụm, 1 = có đủ mọi từ, 0 = còn lại. Khớp chỉ đúng sau khi bỏ dấu
 * (gõ lệch dấu, đặt dấu kiểu khác) dùng để phân hạng phụ trong cùng bậc.
 */
function soKhop(q: string, doan: string[], nguCanh: string[] = []) {
  const tu = tachTu(q);
  // Từ rỗng ngăn giữa các đoạn để cụm không khớp vắt qua hai đoạn.
  const vb = doan.flatMap((d) => [...tachTu(d), ""]);
  const chac = dem(tu, vb, khopChac);
  const long = dem(tu.map(boDau), vb.map(boDau), (x, y) => x === y);
  // Ngữ cảnh chỉ bù từ còn thiếu để đạt bậc 1; nguyên cụm phải nằm ngay trong `doan`.
  const duTu = nguCanh.length
    ? dem(tu, [...vb, ...nguCanh.flatMap(tachTu)], khopChac).soTu === tu.length
    : chac.soTu === tu.length;
  const bac = tu.length === 0 ? 0 : chac.cum ? 2 : duTu ? 1 : 0;
  const n = tu.length + 1;
  // Chuỗi dài nhất gồm các từ liền nhau của truy vấn cũng nằm liền nhau, đúng thứ tự trong `doan`.
  let lien = 0;
  for (let i = 0; i < tu.length; i++)
    for (let j = 0; j < vb.length; j++) {
      let k = 0;
      while (i + k < tu.length && j + k < vb.length && khopChac(tu[i + k]!, vb[j + k]!)) k++;
      if (k > lien) lien = k;
    }
  return {
    bac,
    lien: tu.length ? lien / tu.length : 0,
    diem: ((bac * n + chac.soTu) * 2 + Number(long.cum)) * n + long.soTu,
  };
}

/** Bậc khớp của truy vấn với các đoạn văn bản: 2 = nguyên cụm, 1 = đủ mọi từ, 0 = còn lại. */
export const bacKhop = (q: string, doan: string[]): number => soKhop(q, doan).bac;

/**
 * Độ khớp của một điều, khoản, điểm. `nguCanh` là chữ của điều, khoản chứa nó: điểm "có nồng độ cồn"
 * nằm dưới khoản "Phạt tiền… một trong các hành vi sau" vẫn đủ từ cho "phạt nồng độ cồn" (bậc 1).
 * `lien` trong [0, 1]: phần truy vấn giữ được liền nhau trong `doan` (1 = nguyên cụm), để xếp trong
 * cùng một bậc.
 */
export function khopNut(q: string, doan: string[], nguCanh: string[]): { bac: number; lien: number } {
  const { bac, lien } = soKhop(q, doan, nguCanh);
  return { bac, lien };
}

/** Điểm khớp của truy vấn với các đoạn văn bản của một dòng; lớn hơn là liên quan hơn. */
export const diemKhop = (q: string, doan: string[]): number => soKhop(q, doan).diem;

/** Xếp ổn định theo điểm khớp giảm dần; ngang điểm giữ thứ tự sẵn có. Truy vấn rỗng thì giữ nguyên. */
export function xepTheoDoKhop<T>(rows: T[], q: string, doan: (r: T) => string[]): T[] {
  if (tachTu(q).length === 0) return rows;
  return rows
    .map((r) => ({ r, d: diemKhop(q, doan(r)) }))
    .sort((a, b) => b.d - a.d)
    .map((x) => x.r);
}
