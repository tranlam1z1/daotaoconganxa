/**
 * Phát hiện header/footer lặp lại giữa các trang (ke-hoach/05 §2).
 *
 * Cách làm: chuẩn hóa hai dòng đầu và hai dòng cuối của mỗi trang (số bị thay bằng "#"
 * để "- 12 -" và "- 13 -" gộp làm một), rồi đếm tần suất. Dòng nào lặp trên phần lớn
 * số trang thì là nhiễu đầu/cuối trang, KHÔNG phải nội dung.
 */
import type { TrangText } from "./types.ts";

export interface DongLap {
  /** Mẫu đã chuẩn hóa (số thay bằng "#"). */
  mau: string;
  /** Một ví dụ nguyên văn, để người đọc nhận ra. */
  viDu: string;
  soTrang: number;
  tyLe: number;
  viTri: "dau" | "cuoi";
}

export function chuanHoaDongLap(s: string): string {
  return s.trim().replace(/\d+/g, "#").replace(/\s+/g, " ").toLowerCase();
}

/** Dòng chỉ có số trang: "12", "- 12 -", "Trang 12/45". */
export function laSoTrang(s: string): boolean {
  const t = s.trim();
  return /^[-–—\s.]*\d{1,4}[-–—\s.]*$/.test(t) || /^trang\s+\d+(\s*\/\s*\d+)?$/i.test(t);
}

/** Dòng đầu trang của Công báo: "CÔNG BÁO/Số 145 + 146 ngày 10/02/2026". */
export function laDauTrangCongBao(s: string): boolean {
  return /^c[ÔO]NG\s*B[ÁA]O\s*\/\s*S[ỐO]/i.test(s.trim());
}

export function phatHienDongLap(trang: TrangText[], nguong = 0.5): DongLap[] {
  if (trang.length < 3) return [];
  interface Gom {
    trangTheoMau: Set<number>;
    /** Đếm theo nguyên văn: chỉ nguyên văn lặp lại mới chắc chắn là header. */
    trangTheoNguyenVan: Map<string, Set<number>>;
    viDu: string;
    viTri: "dau" | "cuoi";
  }
  const dem = new Map<string, Gom>();
  for (const t of trang) {
    const ung: Array<[string, "dau" | "cuoi"]> = [];
    for (const d of t.dong.slice(0, 2)) ung.push([d, "dau"]);
    for (const d of t.dong.slice(-2)) ung.push([d, "cuoi"]);
    for (const [d, viTri] of ung) {
      const mau = chuanHoaDongLap(d);
      if (mau.length < 3 || mau.length > 120) continue;
      const khoa = `${viTri}|${mau}`;
      let g = dem.get(khoa);
      if (!g) {
        g = { trangTheoMau: new Set(), trangTheoNguyenVan: new Map(), viDu: d.trim(), viTri };
        dem.set(khoa, g);
      }
      g.trangTheoMau.add(t.trang);
      const nv = d.trim();
      const set = g.trangTheoNguyenVan.get(nv) ?? new Set<number>();
      set.add(t.trang);
      g.trangTheoNguyenVan.set(nv, set);
    }
  }
  const ra: DongLap[] = [];
  for (const [khoa, g] of dem) {
    const tyLeMau = g.trangTheoMau.size / trang.length;
    if (tyLeMau < nguong) continue;
    const tyLeNguyenVan = Math.max(...[...g.trangTheoNguyenVan.values()].map((s) => s.size)) / trang.length;
    // Nguyên văn lặp lại -> chắc chắn là header/footer. Nguyên văn khác nhau (chỉ giống
    // sau khi thay số) thì chỉ coi là nhiễu khi bản thân dòng là số trang hoặc dòng Công báo;
    // nếu không, đó là NỘI DUNG khác nhau theo trang, không được loại.
    const laNhieuTheoMau = [...g.trangTheoNguyenVan.keys()].every(
      (nv) => laSoTrang(nv) || laDauTrangCongBao(nv),
    );
    if (tyLeNguyenVan < nguong && !laNhieuTheoMau) continue;
    ra.push({
      mau: khoa.slice(khoa.indexOf("|") + 1),
      viDu: g.viDu,
      soTrang: g.trangTheoMau.size,
      tyLe: Math.round(tyLeMau * 100) / 100,
      viTri: g.viTri,
    });
  }
  return ra.sort((a, b) => b.tyLe - a.tyLe);
}

/**
 * Trang có khối chữ ký cuối văn bản: TUYỆT ĐỐI không cắt phần cuối trang này,
 * vì "Nơi nhận", chức danh và tên người ký phải được giữ (05 §2).
 */
export function laTrangChuKy(t: TrangText): boolean {
  const s = t.text.toLowerCase();
  return /nơi nhận\s*:/.test(s) || /(tm\.|kt\.)\s*(chính phủ|thủ tướng|bộ trưởng)/.test(s);
}
