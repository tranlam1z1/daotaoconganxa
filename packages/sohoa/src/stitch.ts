/**
 * Ghép các cụm trang thành một bản Markdown liền mạch (ke-hoach/05 §4.1).
 *
 * Hai việc khó nằm ở đây:
 *  1. **Trang chồng lấn**: cụm sau xuất lại trang cuối của cụm trước. So khớp mờ theo
 *     khối, ưu tiên bản của cụm sau (nó nhìn thấy nhiều ngữ cảnh phía sau hơn).
 *  2. **Câu và bảng dang dở**: khi cụm trước khai `sentence_open` hoặc `table_open`,
 *     phần đầu cụm sau phải nối liền, KHÔNG được chèn ngắt đoạn.
 */
import { donDepMarkdown } from "./postprocess.ts";
import type { CanhBao, CuaSo, KetQuaCuaSo, TrangThaiMo } from "./types.ts";

export interface CuaSoDaNop {
  cuaSo: CuaSo;
  ketQua: KetQuaCuaSo;
}

/** Độ tương đồng hai chuỗi theo hệ số Dice trên bigram — đủ nhạy cho lỗi OCR lẻ tẻ. */
export function doTuongDong(a: string, b: string): number {
  const chuanHoa = (s: string) =>
    s
      .toLowerCase()
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  const x = chuanHoa(a);
  const y = chuanHoa(b);
  if (!x && !y) return 1;
  if (!x || !y) return 0;
  if (x === y) return 1;
  // Chuỗi quá ngắn không có bigram để so — so khớp nguyên văn cho chắc.
  if (x.length < 2 || y.length < 2) return 0;
  const bigram = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };
  const ma = bigram(x);
  const mb = bigram(y);
  let chung = 0;
  let tongA = 0;
  let tongB = 0;
  for (const v of ma.values()) tongA += v;
  for (const [g, v] of mb) {
    tongB += v;
    chung += Math.min(v, ma.get(g) ?? 0);
  }
  return (2 * chung) / (tongA + tongB);
}

/** Tách Markdown thành khối: mỗi khối là một đoạn, kèm các dòng marker ngay trên nó. */
export function tachKhoi(md: string): string[] {
  const khoi = md
    .replaceAll("\r\n", "\n")
    .split(/\n{2,}/)
    .map((k) => k.trim())
    .filter(Boolean);
  const ra: string[] = [];
  for (const k of khoi) {
    // Marker đứng một mình thì gắn vào khối sau, để so khớp không lệch.
    if (/^<!--[\s\S]*-->$/.test(k) && !k.includes("\n")) {
      ra.push(k);
      continue;
    }
    const truoc = ra.at(-1);
    if (truoc && /^<!--[\s\S]*-->$/.test(truoc) && !truoc.includes("\n")) {
      ra[ra.length - 1] = `${truoc}\n${k}`;
    } else {
      ra.push(k);
    }
  }
  return ra;
}

/** Ngưỡng coi hai khối là cùng một nội dung. */
export const NGUONG_TRUNG = 0.88;
/**
 * Số khối tối đa dò tìm phần chồng lấn.
 * Phải lớn hơn số khối của MỘT trang chồng lấn: một trang biểu mẫu toàn dòng để trống
 * sinh ra vài chục khối, đặt ngưỡng thấp thì không bao giờ khớp được.
 */
export const SO_KHOI_DO = 60;

/**
 * Tìm số khối cuối của `truoc` trùng với số khối đầu của `sau`.
 * Trả về 0 nếu không thấy phần chồng lấn.
 */
export function timChongLan(truoc: string[], sau: string[]): number {
  const toiDa = Math.min(SO_KHOI_DO, truoc.length, sau.length);
  for (let k = toiDa; k >= 1; k--) {
    let khop = true;
    for (let i = 0; i < k; i++) {
      const a = truoc[truoc.length - k + i] as string;
      const b = sau[i] as string;
      if (doTuongDong(a, b) < NGUONG_TRUNG) {
        khop = false;
        break;
      }
    }
    if (khop) return k;
  }
  return 0;
}

/** Bỏ các dòng marker đứng đầu khối để nhận dạng nội dung thật của khối. */
function boMarkerDau(khoi: string): string {
  return khoi.replace(/^(?:\s*<!--[\s\S]*?-->\s*\n?)+/, "").trimStart();
}

function laBangGfm(khoi: string): boolean {
  return boMarkerDau(khoi).startsWith("|");
}

function laBangHtml(khoi: string): boolean {
  return /^<table\b/i.test(boMarkerDau(khoi));
}

function laBang(khoi: string): boolean {
  return laBangGfm(khoi) || laBangHtml(khoi);
}

/** Bỏ dòng header lặp lại của một bảng GFM bị cắt qua cụm (05 §4.2 quy tắc 3). */
function boHeaderBangLap(khoi: string): string {
  const dong = khoi.split("\n");
  if (dong.length >= 2 && /^\s*\|/.test(dong[0] ?? "") && /^\s*\|[\s:-]+\|/.test(dong[1] ?? "")) {
    return dong.slice(2).join("\n");
  }
  return khoi;
}

/**
 * Nối hai nửa của MỘT bảng HTML bị cắt qua cụm trang.
 *
 * Bảng có gộp ô (rowspan/colspan) phải xuất dạng HTML, mà bảng định mức hay danh mục
 * thiết bị thì thường dài hơn một cụm trang. Mỗi cụm vẫn xuất một bảng HTML ĐẦY ĐỦ
 * (đứng riêng vẫn đọc được, mở lại từng cụm vẫn xem được); ở đây lấy các hàng của
 * nửa sau chèn vào trước thẻ đóng của nửa trước, và bỏ luôn phần <thead> lặp.
 */
export function noiBangHtml(truoc: string, sau: string): string {
  const hangSau = layThanBangHtml(sau);
  if (!hangSau.trim()) return truoc;
  const dong = /<\/tbody>/i.test(truoc) ? "</tbody>" : "</table>";
  const vt = truoc.toLowerCase().lastIndexOf(dong);
  if (vt < 0) return `${truoc}\n${hangSau}`;
  return `${truoc.slice(0, vt).replace(/\s+$/, "")}\n${hangSau}\n${truoc.slice(vt)}`;
}

/** Lấy phần hàng dữ liệu của một bảng HTML: ưu tiên <tbody>, không có thì lấy mọi <tr> ngoài <thead>. */
function layThanBangHtml(khoi: string): string {
  const tbody = /<tbody[^>]*>([\s\S]*?)<\/tbody>/i.exec(khoi);
  if (tbody?.[1]) return tbody[1].replace(/^\n+|\n+$/g, "");
  const khongThead = khoi.replace(/<thead[\s\S]*?<\/thead>/gi, "");
  const rows = khongThead.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  return rows.join("\n");
}

/** Tách các dòng marker (`<!-- node: … -->`) đứng đầu khối khỏi phần chữ của khối. */
function tachMarkerDau(khoi: string): { marker: string; chu: string } {
  const m = /^((?:[ \t]*<!--[^>]*-->[ \t]*\n)+)/.exec(khoi);
  if (!m) return { marker: "", chu: khoi };
  return { marker: m[1]!.trim(), chu: khoi.slice(m[1]!.length) };
}

export interface KetQuaGhep {
  markdown: string;
  canhBao: CanhBao[];
  /** Số khối bị loại vì trùng phần chồng lấn — số 0 ở giữa tài liệu là dấu hiệu ghép hụt. */
  soKhoiTrung: number[];
}

export function ghepCacCuaSo(items: CuaSoDaNop[]): KetQuaGhep {
  const sap = [...items].sort((a, b) => a.cuaSo.idx - b.cuaSo.idx);
  const canhBao: CanhBao[] = [];
  const soKhoiTrung: number[] = [];
  let tichLuy: string[] = [];
  let moTruoc: TrangThaiMo | undefined;

  for (const [i, it] of sap.entries()) {
    const md = donDepMarkdown(it.ketQua.markdown ?? "");
    if (!md.trim()) {
      canhBao.push({ kind: "layout", message: `Cụm ${it.cuaSo.idx} nộp Markdown rỗng` });
      continue;
    }
    let khoi = tachKhoi(md.replace(/^\s*<!--\s*cont\s*-->\s*/i, ""));
    if (i === 0 || !tichLuy.length) {
      tichLuy = khoi;
      moTruoc = it.ketQua.open_state;
      continue;
    }

    const bangConTiep = Boolean(moTruoc?.table_open && laBang(tichLuy.at(-1) ?? "") && laBang(khoi[0] ?? ""));

    if (bangConTiep) {
      // Bảng còn tiếp qua cụm: nối hàng, bỏ header lặp. KHÔNG dò chồng lấn ở đây —
      // hai nửa của cùng một bảng rất giống nhau, dò mờ sẽ tưởng nhầm là trùng và xóa mất.
      const cuoiTruoc = tichLuy.at(-1) as string;
      const dauSau = khoi[0] as string;
      tichLuy[tichLuy.length - 1] = laBangHtml(cuoiTruoc)
        ? noiBangHtml(cuoiTruoc, dauSau)
        : `${cuoiTruoc}\n${boHeaderBangLap(dauSau)}`;
      khoi = khoi.slice(1);
      soKhoiTrung.push(0);
    } else {
      const k = timChongLan(tichLuy, khoi);
      soKhoiTrung.push(k);
      if (k > 0) {
        // Ưu tiên bản của cụm sau cho phần chồng lấn: bỏ phần đuôi của bản đã tích lũy.
        tichLuy = tichLuy.slice(0, tichLuy.length - k);
        khoi = khoi.slice(0);
      } else if (it.cuaSo.trangChongLan) {
        canhBao.push({
          kind: "layout",
          page: it.cuaSo.trangChongLan,
          message:
            `Không tìm thấy phần chồng lấn giữa cụm ${it.cuaSo.idx - 1} và cụm ${it.cuaSo.idx} ` +
            `(trang ${it.cuaSo.trangChongLan}). Nội dung có thể bị lặp hoặc thiếu — cần soát tay.`,
        });
      }

      const dauSau = khoi[0];
      const cuoiTruoc = tichLuy.at(-1);
      if (moTruoc?.sentence_open && cuoiTruoc && dauSau && !laBang(dauSau) && !dauSau.startsWith("#")) {
        // Câu chưa kết thúc: nối liền bằng một dấu cách, không chèn ngắt đoạn.
        // Chỉ gộp khoảng trắng ở phần CHỮ. Marker nút đứng đầu khối phải giữ nguyên dòng riêng,
        // nếu không bộ phân tích cấu trúc đọc lệch nút (lỗi lộ ra khi số hóa Luật 36/2024/QH15).
        const { marker, chu } = tachMarkerDau(cuoiTruoc);
        const noi = `${chu} ${dauSau.replace(/^<!--[^>]*-->\s*/, "")}`.replace(/\s+/g, " ").trim();
        tichLuy[tichLuy.length - 1] = marker ? `${marker}\n${noi}` : noi;
        khoi = khoi.slice(1);
      }
    }

    tichLuy = tichLuy.concat(khoi);
    moTruoc = it.ketQua.open_state;
  }

  return { markdown: `${tichLuy.join("\n\n")}\n`, canhBao, soKhoiTrung };
}
