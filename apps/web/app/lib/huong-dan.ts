/**
 * Hướng dẫn sử dụng: kiểu dữ liệu và phép dựng dùng chung.
 *
 * Một nguồn nội dung (content/huong-dan) hiển thị ở ba nơi: khung hướng dẫn mở từ bất kỳ trang
 * nào, mục Hướng dẫn tập trung (/huong-dan) và bản PDF do scripts/huong-dan.ts dựng. Tệp này
 * thuần — không đọc đĩa, không dùng API riêng của Vite hay Bun — để máy chủ web (chạy trên Node)
 * và script (chạy trên Bun) nạp chung, nhờ vậy ba nơi không lệch nội dung nhau.
 */
import { escapeHtml, renderMarkdown } from "./markdown";

export type HuongGhiChu = "tren" | "duoi" | "trai" | "phai";

/** Một vùng giao diện được khoanh đỏ trên hình, đánh số theo thứ tự khai báo. */
export interface DanhDau {
  /** Bộ chọn Playwright: `role=button[name="Tìm"]`, `text=…` hoặc CSS. */
  o: string;
  ghi_chu: string;
  /** Phía đặt nhãn ghi chú so với vùng được khoanh. Mặc định: phải. */
  huong?: HuongGhiChu;
}

export type ThaoTac =
  | { bam: string }
  | { nhap: string; gia_tri: string }
  | { cho: string }
  | { doi_ms: number }
  | { phim: string };

export type ThietBi = "may-tinh" | "dien-thoai";

/** Kịch bản chụp một hình minh hoạ. */
export interface KichBanAnh {
  /** Tên tệp ảnh, không đuôi; duy nhất trong toàn bộ hướng dẫn. */
  ten: string;
  chu_thich: string;
  url: string;
  thiet_bi?: ThietBi;
  /** Cần phiên biên tập viên trở lên. */
  dang_nhap?: boolean;
  thao_tac?: ThaoTac[];
  /** Bộ chọn vùng cần cắt. Bỏ trống thì lấy cả khung nhìn. */
  vung?: string;
  /**
   * Bộ chọn các thành phần chứa thông tin cá nhân cần làm mờ (tên người, ảnh đại diện…).
   * Email, token phiên và số điện thoại luôn được làm mờ tự động.
   */
  lam_mo?: string[];
  danh_dau: DanhDau[];
}

/** Phần khai báo của một bài (tệp `<id>.json`). */
export interface MetaBai {
  tieu_de: string;
  tom_tat: string;
  /** Tệp route mà bài hướng dẫn, dạng `routes/search.tsx`. */
  routes: string[];
  /** Tệp giao diện khác mà bài mô tả, tính từ apps/web/app, dạng `components/SiteHeader.tsx`. */
  nguon_them?: string[];
  anh: KichBanAnh[];
}

export interface ChuongMucLuc {
  id: string;
  tieu_de: string;
  tom_tat?: string;
  bai: string[];
}

export interface MucLuc {
  tieu_de: string;
  chuong: ChuongMucLuc[];
  /** Route có giao diện nhưng không cần bài hướng dẫn riêng. */
  khong_can_huong_dan: Array<{ route: string; ly_do: string }>;
}

export interface BaiHuongDan extends MetaBai {
  id: string;
  /** Số mục dạng "2.3": chương 2, bài thứ 3. */
  so: string;
  chuong: { id: string; tieu_de: string; so: number };
  markdown: string;
}

export interface KhoHuongDan {
  mucLuc: MucLuc;
  dsBai: BaiHuongDan[];
  /** Bài có trong mục lục nhưng thiếu tệp .md hoặc .json. */
  thieu: string[];
}

/** Trạng thái đã phát sinh của một bài, ghi trong content/huong-dan/khoa.json. */
export interface KhoaBai {
  /** Băm của tập đặc điểm giao diện lúc chụp. */
  giao_dien: string;
  /** Đặc điểm giao diện theo từng tệp nguồn, để chỉ ra phần nào đã đổi. */
  dac_diem: Record<string, string[]>;
  kich_ban: string;
  noi_dung: string;
  /** Băm SHA-256 của từng tệp ảnh. */
  anh: Record<string, string>;
  chup_luc: string;
  /** Giao diện đã đổi và hình đã chụp lại, nhưng lời văn chưa được rà soát. */
  cho_ra_soat: { them: string[]; bot: string[]; noi_dung_luc_chup: string } | null;
}

export interface Khoa {
  phien_ban: 1;
  bai: Record<string, KhoaBai>;
  pdf: { chu_ky: string; tao_luc: string; so_trang: number; sha: string } | null;
}

export const DUONG_DAN_ANH = "/tai-lieu/huong-dan/anh";
export const DUONG_DAN_PDF = "/tai-lieu/huong-dan-su-dung.pdf";

export function dungKho(
  mucLuc: MucLuc,
  meta: Record<string, MetaBai>,
  markdown: Record<string, string>,
): KhoHuongDan {
  const dsBai: BaiHuongDan[] = [];
  const thieu: string[] = [];
  mucLuc.chuong.forEach((chuong, i) => {
    let stt = 0;
    for (const id of chuong.bai) {
      const m = meta[id];
      const md = markdown[id];
      if (!m || md === undefined) {
        thieu.push(id);
        continue;
      }
      stt++;
      dsBai.push({
        ...m,
        id,
        so: `${i + 1}.${stt}`,
        chuong: { id: chuong.id, tieu_de: chuong.tieu_de, so: i + 1 },
        markdown: md,
      });
    }
  });
  return { mucLuc, dsBai, thieu };
}

/** `routes/search.tsx` -> `routes/search`, trùng với id route mà useMatches trả về. */
export function routeId(file: string): string {
  return file.replace(/\.[jt]sx?$/, "");
}

/**
 * Bài hướng dẫn cho trang đang xem. `routeIds` theo thứ tự từ gốc tới lá như useMatches;
 * route lá được ưu tiên, không có thì lùi dần về route cha (khung trang).
 */
export function timBaiChoTrang(kho: KhoHuongDan, routeIds: string[]): BaiHuongDan | null {
  for (let i = routeIds.length - 1; i >= 0; i--) {
    const id = routeIds[i];
    const bai = kho.dsBai.find((b) => b.routes.some((r) => routeId(r) === id));
    if (bai) return bai;
  }
  return null;
}

/** Ảnh chèn trong Markdown bằng một dòng riêng: `![mô tả](anh:ten-anh)`. */
const ANH_RE = /^!\[[^\]]*\]\(anh:([a-z0-9-]+)\)[ \t]*$/gm;

export function tenAnhTrongMarkdown(markdown: string): string[] {
  return [...markdown.matchAll(ANH_RE)].map((m) => m[1]!);
}

export interface TuyChonHtml {
  /** Trả null khi hình chưa chụp được: hiện ô chờ thay cho ảnh vỡ. */
  urlAnh: (ten: string) => string | null;
  /** Hạ cấp tiêu đề thêm n bậc (bản PDF đặt tiêu đề bài ở h2 nên hạ mục con xuống h3). */
  lechTieuDe?: number;
}

/** Nội dung bài thành HTML đã lọc; ảnh thành hình có số, chú thích và chú giải đánh số. */
export function htmlBai(bai: BaiHuongDan, tuyChon: TuyChonHtml): string {
  const kichBan = new Map(bai.anh.map((a) => [a.ten, a]));
  const hinh: string[] = [];
  let md = bai.markdown.replace(ANH_RE, (_m, ten: string) => {
    const kb = kichBan.get(ten);
    if (!kb) return "";
    hinh.push(htmlHinh(kb, `${bai.so}.${hinh.length + 1}`, tuyChon.urlAnh(ten)));
    return `\n\nhdhinh${hinh.length - 1}zz\n\n`;
  });
  const lech = tuyChon.lechTieuDe ?? 0;
  if (lech > 0) {
    md = md.replace(/^(#{1,6}) /gm, (_m, muc: string) => `${"#".repeat(Math.min(6, muc.length + lech))} `);
  }
  // Hình dựng từ khai báo tin cậy nên chèn SAU bước lọc HTML, giống cách chèn công thức KaTeX.
  let html = renderMarkdown(md);
  hinh.forEach((h, i) => {
    html = html.split(`<p>hdhinh${i}zz</p>`).join(h).split(`hdhinh${i}zz`).join(h);
  });
  return html;
}

function htmlHinh(kb: KichBanAnh, so: string, src: string | null): string {
  const chuGiai = kb.danh_dau
    .map(
      (d, i) =>
        `<li><span class="hd-so" aria-hidden="true">${i + 1}</span><span><span class="sr-only">Vùng ${i + 1}: </span>${escapeHtml(d.ghi_chu)}</span></li>`,
    )
    .join("");
  return (
    `<figure class="hd-hinh hd-hinh--${kb.thiet_bi ?? "may-tinh"}">` +
    (src
      ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(kb.chu_thich)}" loading="lazy" decoding="async" />`
      : `<div class="hd-hinh-cho" role="img" aria-label="${escapeHtml(kb.chu_thich)}">Hình minh hoạ đang được cập nhật.</div>`) +
    `<figcaption>Hình ${so}. ${escapeHtml(kb.chu_thich)}</figcaption>` +
    (chuGiai ? `<ol class="hd-chu-giai">${chuGiai}</ol>` : "") +
    "</figure>"
  );
}
