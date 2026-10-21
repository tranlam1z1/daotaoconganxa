/**
 * Dựng hình nhân vật bằng SVG tham số (ke-hoach/09-b §4).
 *
 * Vì sao dựng bằng mã chứ không vẽ tay: 7 nhân vật × 12 trạng thái × 10 trang phục là 840
 * biến thể nền, chưa nhân với tư thế, đạo cụ và hiệu ứng. Vẽ tay thì không bao giờ đủ, và
 * mỗi lần thêm một trang phục lại phải vẽ lại toàn bộ. Dựng theo tham số thì thêm một trạng
 * thái là thêm một mục trong bảng `MAT` bên dưới.
 *
 * Hàm ở đây KHÔNG phụ thuộc DOM: chạy được cả khi kết xuất phía máy chủ (SSR, sinh ảnh tham
 * chiếu cho prompt tạo ảnh) lẫn trong trình duyệt.
 *
 * Bố cục cố định trong `viewBox="0 0 200 240"`, gốc toạ độ ở góc trên trái:
 *   y  20– 96  đầu
 *   y  96–186  thân
 *   y 186–210  chân
 *   y 210–224  bóng đổ
 */

import type { BangMau, DangThan, DaoCu, HieuUng, NhanVat, TrangPhuc, TrangThai, TuThe } from "./types.ts";

export interface YeuCauVe {
  persona: Pick<NhanVat, "code" | "palette" | "body" | "headGear" | "fullName" | "nickName">;
  state?: TrangThai;
  pose?: TuThe;
  costume?: TrangPhuc;
  prop?: DaoCu;
  effect?: HieuUng;
  /** Cạnh của ảnh vuông kết xuất, px. Bỏ trống thì SVG co giãn theo khung chứa. */
  size?: number;
  /** Tắt mọi chuyển động (tôn trọng prefers-reduced-motion và chế độ in). */
  tinh?: boolean;
  /** Tiền tố id để nhiều nhân vật trên cùng một trang không đụng id của nhau. */
  idPrefix?: string;
}

const VIEN = 3;

/** Escape nội dung chèn vào thuộc tính SVG — tên nhân vật do người dùng đặt. */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ------------------------------------------------------------------ */
/* Mắt, lông mày, miệng theo trạng thái                                */
/* ------------------------------------------------------------------ */

interface NetMat {
  /** Mắt trái và phải; dùng cùng một mô tả, lật theo trục đứng. */
  mat: string;
  mieng: string;
  /** Lông mày, rỗng nếu trạng thái không cần. */
  may?: string;
  /** Chi tiết phụ: má hồng, giọt mồ hôi… */
  them?: string;
}

/**
 * Một mắt vẽ quanh gốc (0,0); hàm `datMat` đặt vào vị trí trái/phải.
 * Giữ mọi hình trong bán kính ~9px để không tràn khỏi khuôn mặt.
 */
function netTheoTrangThai(tt: TrangThai, p: BangMau): NetMat {
  const m = p.mat;
  switch (tt) {
    case "vui":
      return {
        mat: `<path d="M -7 1 Q 0 -7 7 1" fill="none" stroke="${m}" stroke-width="3.2" stroke-linecap="round"/>`,
        mieng: `<path d="M -11 4 Q 0 15 11 4" fill="none" stroke="${m}" stroke-width="3" stroke-linecap="round"/>`,
        them: `<circle cx="-26" cy="8" r="6" fill="${p.nhan}" opacity="0.35"/><circle cx="26" cy="8" r="6" fill="${p.nhan}" opacity="0.35"/>`,
      };
    case "hao_hung":
      return {
        mat: `<path d="M -7 2 Q 0 -8 7 2" fill="none" stroke="${m}" stroke-width="3.4" stroke-linecap="round"/>`,
        mieng: `<path d="M -13 2 Q 0 19 13 2 Z" fill="${m}"/><path d="M -8 11 Q 0 16 8 11 Z" fill="#ffffff" opacity="0.85"/>`,
        them: `<circle cx="-27" cy="9" r="6.5" fill="${p.nhan}" opacity="0.4"/><circle cx="27" cy="9" r="6.5" fill="${p.nhan}" opacity="0.4"/>`,
      };
    case "suy_nghi":
      return {
        // Mắt liếc lên: con ngươi lệch lên trên.
        mat: `<circle cx="0" cy="0" r="6.5" fill="#ffffff" stroke="${m}" stroke-width="2"/><circle cx="1" cy="-2.4" r="3.2" fill="${m}"/>`,
        mieng: `<path d="M -7 8 L 6 6" fill="none" stroke="${m}" stroke-width="3" stroke-linecap="round"/>`,
        may: `<path d="M -26 -14 L -12 -17" stroke="${m}" stroke-width="2.6" stroke-linecap="round"/><path d="M 12 -17 L 26 -14" stroke="${m}" stroke-width="2.6" stroke-linecap="round"/>`,
      };
    case "giai_thich":
      return {
        mat: `<circle cx="0" cy="0" r="6.5" fill="#ffffff" stroke="${m}" stroke-width="2"/><circle cx="0" cy="0.5" r="3.4" fill="${m}"/>`,
        mieng: `<ellipse cx="0" cy="9" rx="7" ry="6" fill="${m}"/>`,
      };
    case "canh_bao":
      return {
        mat: `<circle cx="0" cy="0" r="6.8" fill="#ffffff" stroke="${m}" stroke-width="2.2"/><circle cx="0" cy="0" r="3.6" fill="${m}"/>`,
        mieng: `<path d="M -9 10 Q 0 4 9 10" fill="none" stroke="${m}" stroke-width="3" stroke-linecap="round"/>`,
        may: `<path d="M -26 -18 L -11 -12" stroke="${m}" stroke-width="3" stroke-linecap="round"/><path d="M 11 -12 L 26 -18" stroke="${m}" stroke-width="3" stroke-linecap="round"/>`,
      };
    case "nghiem_tuc":
      return {
        mat: `<circle cx="0" cy="0" r="6" fill="#ffffff" stroke="${m}" stroke-width="2"/><circle cx="0" cy="0" r="3" fill="${m}"/>`,
        mieng: `<path d="M -10 9 L 10 9" stroke="${m}" stroke-width="3" stroke-linecap="round"/>`,
        may: `<path d="M -26 -15 L -11 -15" stroke="${m}" stroke-width="3" stroke-linecap="round"/><path d="M 11 -15 L 26 -15" stroke="${m}" stroke-width="3" stroke-linecap="round"/>`,
      };
    case "tiec":
      return {
        // Mắt cụp nhẹ — tiếc, không phải buồn thảm: nhân vật không được làm người học thấy tệ.
        mat: `<path d="M -7 -1 Q 0 5 7 -1" fill="none" stroke="${m}" stroke-width="3.2" stroke-linecap="round"/>`,
        mieng: `<path d="M -9 11 Q 0 5 9 11" fill="none" stroke="${m}" stroke-width="3" stroke-linecap="round"/>`,
        may: `<path d="M -26 -13 L -11 -17" stroke="${m}" stroke-width="2.4" stroke-linecap="round"/><path d="M 11 -17 L 26 -13" stroke="${m}" stroke-width="2.4" stroke-linecap="round"/>`,
      };
    case "khich_le":
      return {
        mat: `<circle cx="0" cy="0" r="6.8" fill="#ffffff" stroke="${m}" stroke-width="2"/><circle cx="0" cy="-0.6" r="3.6" fill="${m}"/><circle cx="2.2" cy="-2.6" r="1.4" fill="#ffffff"/>`,
        mieng: `<path d="M -10 4 Q 0 13 10 4" fill="none" stroke="${m}" stroke-width="3" stroke-linecap="round"/>`,
      };
    case "an_mung":
      return {
        mat: `<path d="M -7 2 Q 0 -8 7 2" fill="none" stroke="${m}" stroke-width="3.4" stroke-linecap="round"/>`,
        mieng: `<path d="M -12 2 Q 0 18 12 2 Z" fill="${m}"/>`,
        them: `<circle cx="-27" cy="9" r="6.5" fill="${p.nhan}" opacity="0.45"/><circle cx="27" cy="9" r="6.5" fill="${p.nhan}" opacity="0.45"/>`,
      };
    case "ngu":
      return {
        mat: `<path d="M -7 0 Q 0 5 7 0" fill="none" stroke="${m}" stroke-width="3" stroke-linecap="round"/>`,
        mieng: `<ellipse cx="0" cy="9" rx="4" ry="5" fill="${m}" opacity="0.75"/>`,
      };
    case "bo_tay":
      return {
        // Nhún vai, hai tay mở: "chưa đủ căn cứ" phải nhìn ra ngay từ nét mặt.
        mat: `<path d="M -7 -1 L 7 -1" stroke="${m}" stroke-width="3" stroke-linecap="round"/>`,
        mieng: `<path d="M -8 9 Q 0 12 8 7" fill="none" stroke="${m}" stroke-width="3" stroke-linecap="round"/>`,
        may: `<path d="M -26 -17 Q -18 -21 -11 -16" fill="none" stroke="${m}" stroke-width="2.4" stroke-linecap="round"/><path d="M 11 -16 Q 18 -21 26 -17" fill="none" stroke="${m}" stroke-width="2.4" stroke-linecap="round"/>`,
      };
    default:
      return {
        mat: `<circle cx="0" cy="0" r="6.5" fill="#ffffff" stroke="${m}" stroke-width="2"/><circle cx="0" cy="0.4" r="3.4" fill="${m}"/>`,
        mieng: `<path d="M -8 7 Q 0 12 8 7" fill="none" stroke="${m}" stroke-width="3" stroke-linecap="round"/>`,
      };
  }
}

/** Đặt một mắt vào vị trí trái (x âm) và phải, lật ngang bản mô tả. */
function datMat(net: string): string {
  return `<g transform="translate(-16 0)">${net}</g><g transform="translate(16 0) scale(-1 1)">${net}</g>`;
}

/* ------------------------------------------------------------------ */
/* Thân theo nhân vật                                                  */
/* ------------------------------------------------------------------ */

function veThan(body: DangThan, p: BangMau): string {
  const v = `stroke="${p.vien}" stroke-width="${VIEN}" stroke-linejoin="round"`;
  switch (body) {
    case "thuoc":
      // Thân là cây thước: vạch chia dọc sườn phải là dấu nhận dạng của Mực Thước.
      return `
        <rect x="62" y="98" width="76" height="88" rx="14" fill="${p.chinh}" ${v}/>
        <rect x="120" y="106" width="14" height="72" rx="5" fill="${p.nhan}" opacity="0.95"/>
        ${[0, 1, 2, 3, 4, 5]
          .map(
            (i) =>
              `<rect x="120" y="${112 + i * 11}" width="${i % 2 ? 6 : 10}" height="2.6" fill="${p.vien}" opacity="0.7"/>`,
          )
          .join("")}`;
    case "giot_muc":
      // Giọt mực: đỉnh nhọn, đáy tròn.
      return `<path d="M 100 92 C 128 124 140 146 140 160 A 40 40 0 0 1 60 160 C 60 146 72 124 100 92 Z" fill="${p.chinh}" ${v}/>`;
    case "rua":
      return `
        <ellipse cx="100" cy="150" rx="50" ry="36" fill="${p.chinh}" ${v}/>
        ${[-26, 0, 26]
          .map(
            (dx) =>
              `<path d="M ${100 + dx} 128 l 11 8 -4 13 h -14 l -4 -13 Z" fill="${p.nhan}" opacity="0.65" stroke="${p.vien}" stroke-width="1.6"/>`,
          )
          .join("")}`;
    case "nguoi_can":
      return `<path d="M 74 100 h 52 a 12 12 0 0 1 12 12 v 62 a 12 12 0 0 1 -12 12 h -52 a 12 12 0 0 1 -12 -12 v -62 a 12 12 0 0 1 12 -12 Z" fill="${p.chinh}" ${v}/>
        <path d="M 100 100 v 86" stroke="${p.phu}" stroke-width="2.4" opacity="0.55"/>`;
    case "seu":
      // Cổ dài là dấu nhận dạng: sếu nhìn xa hơn mọi nhân vật khác.
      return `
        <path d="M 92 100 q 8 -4 16 0 v 34 q 0 8 -8 8 t -8 -8 Z" fill="${p.chinh}" ${v}/>
        <ellipse cx="100" cy="162" rx="42" ry="30" fill="${p.chinh}" ${v}/>
        <path d="M 62 156 q -16 8 -6 22 q 14 4 24 -8 Z" fill="${p.phu}" ${v}/>`;
    case "thuoc_day":
      return `
        <circle cx="100" cy="146" r="44" fill="${p.chinh}" ${v}/>
        <circle cx="100" cy="146" r="17" fill="${p.phu}" stroke="${p.vien}" stroke-width="2.4"/>
        <path d="M 143 152 q 18 6 14 24 q -3 12 -17 10" fill="none" stroke="${p.nhan}" stroke-width="9" stroke-linecap="round"/>
        <path d="M 143 152 q 18 6 14 24 q -3 12 -17 10" fill="none" stroke="${p.vien}" stroke-width="1.4" stroke-dasharray="3 5"/>`;
    case "den_dau":
      return `
        <path d="M 66 132 h 68 l -6 46 a 12 12 0 0 1 -12 10 h -32 a 12 12 0 0 1 -12 -10 Z" fill="${p.chinh}" ${v}/>
        <rect x="80" y="100" width="40" height="34" rx="6" fill="${p.phu}" opacity="0.65" ${v}/>`;
  }
}

/** Đầu: hình dạng thay đổi theo thân để nhân vật không trông như ghép nhầm. */
function veDau(body: DangThan, p: BangMau): string {
  const v = `stroke="${p.vien}" stroke-width="${VIEN}" stroke-linejoin="round"`;
  if (body === "rua") {
    return `<path d="M 148 118 q 30 -4 34 -22 q 2 -18 -16 -22 q -20 -4 -26 14 Z" fill="${p.da}" ${v}/>`;
  }
  if (body === "seu") {
    return `<ellipse cx="100" cy="62" rx="26" ry="24" fill="${p.phu}" ${v}/>
      <path d="M 124 62 l 34 6 -34 8 Z" fill="${p.nhan}" ${v}/>`;
  }
  if (body === "giot_muc") return `<circle cx="100" cy="76" r="0" fill="none"/>`;
  if (body === "den_dau") return `<circle cx="100" cy="0" r="0" fill="none"/>`;
  return `<circle cx="100" cy="62" r="38" fill="${p.da}" ${v}/>`;
}

/**
 * Tâm khuôn mặt — nơi đặt mắt và miệng. Khác nhau theo thân vì giọt mực và đèn dầu mang
 * mặt ngay trên thân chứ không có đầu riêng.
 */
function tamMat(body: DangThan): { x: number; y: number; scale: number } {
  switch (body) {
    case "giot_muc":
      return { x: 100, y: 150, scale: 1.15 };
    case "den_dau":
      return { x: 100, y: 152, scale: 1 };
    case "rua":
      return { x: 162, y: 92, scale: 0.62 };
    case "seu":
      return { x: 98, y: 60, scale: 0.66 };
    default:
      return { x: 100, y: 62, scale: 1 };
  }
}

/* ------------------------------------------------------------------ */
/* Phụ kiện đầu                                                        */
/* ------------------------------------------------------------------ */

function vePhuKienDau(gear: string | null | undefined, p: BangMau): string {
  const v = `stroke="${p.vien}" stroke-width="${VIEN}" stroke-linejoin="round"`;
  switch (gear) {
    case "khan_xep":
      return `<path d="M 66 40 q 34 -22 68 0 q -6 10 -34 10 t -34 -10 Z" fill="${p.chinh}" ${v}/>
        <path d="M 70 34 q 30 -14 60 0" fill="none" stroke="${p.phu}" stroke-width="2.4" opacity="0.6"/>`;
    case "toc_xoay":
      return `<path d="M 100 96 q 4 -22 22 -20 q 16 2 12 16 q -3 10 -13 8" fill="none" stroke="${p.nhan}" stroke-width="7" stroke-linecap="round"/>`;
    case "bia_da":
      // Bia tiến sĩ trên lưng rùa — mặt bia để trống, không bao giờ có chữ giả.
      return `<rect x="66" y="72" width="66" height="58" rx="10" fill="${p.phu}" ${v}/>
        <path d="M 66 84 q 33 -18 66 0" fill="none" stroke="${p.vien}" stroke-width="2"/>`;
    case "mao_do":
      return `<path d="M 86 42 q 14 -12 28 0 q -14 6 -28 0 Z" fill="${p.nhan}" ${v}/>`;
    case "ngon_lua":
      return `<path d="M 100 62 q 14 16 4 28 q -4 5 -10 1 q -10 -8 6 -29 Z" fill="${p.nhan}" ${v}/>
        <path d="M 100 76 q 6 8 1 14 q -4 3 -6 -1 q -3 -6 5 -13 Z" fill="#ffffff" opacity="0.7"/>`;
    default:
      return "";
  }
}

/* ------------------------------------------------------------------ */
/* Trang phục                                                          */
/* ------------------------------------------------------------------ */

function veTrangPhuc(costume: TrangPhuc, body: DangThan, p: BangMau): string {
  const v = `stroke="${p.vien}" stroke-width="2.4" stroke-linejoin="round"`;
  // Thân tròn (giọt mực, thước dây, rùa) mang trang phục ở dải cổ, không mang thân áo.
  const thanTron = body === "giot_muc" || body === "thuoc_day" || body === "rua" || body === "den_dau";
  const co = (mau: string) =>
    thanTron
      ? `<path d="M 72 112 q 28 16 56 0 l 4 12 q -32 18 -64 0 Z" fill="${mau}" ${v}/>`
      : `<path d="M 74 100 q 26 20 52 0 l 8 16 q -34 22 -68 0 Z" fill="${mau}" ${v}/>`;

  switch (costume) {
    case "cong_so":
      return `${co("#ffffff")}
        <path d="M 96 108 l 4 10 4 -10 -4 -5 Z" fill="${p.nhan}"/>
        <path d="M 100 118 l 5 24 -5 6 -5 -6 Z" fill="${p.nhan}" ${v}/>
        <rect x="112" y="140" width="20" height="14" rx="3" fill="${p.phu}" ${v}/>`;
    case "ao_dai_khan_dong":
      return `<path d="M 66 106 q 34 18 68 0 l 6 76 q -40 16 -80 0 Z" fill="${p.chinh}" ${v}/>
        <path d="M 100 106 v 78" stroke="${p.nhan}" stroke-width="3"/>
        <path d="M 66 40 q 34 -22 68 0 q -6 10 -34 10 t -34 -10 Z" fill="${p.chinh}" ${v}/>`;
    case "ao_dai_nu":
      return `<path d="M 72 106 q 28 16 56 0 l 8 80 q -36 14 -72 0 Z" fill="${p.phu}" ${v}/>
        <path d="M 100 106 q -10 40 -6 80" fill="none" stroke="${p.nhan}" stroke-width="2.6"/>`;
    case "bao_ho_cong_truong":
      return `${co(p.phu)}
        <path d="M 64 46 q 36 -30 72 0 h -72 Z" fill="#f2b705" ${v}/>
        <rect x="60" y="44" width="80" height="7" rx="3.5" fill="#f2b705" ${v}/>
        <rect x="70" y="140" width="60" height="9" rx="4" fill="#f5f070" ${v}/>`;
    case "hoi_dong_tham_dinh":
      return `${co("#ffffff")}
        <path d="M 74 100 l -10 84 h 20 l 6 -78 Z" fill="#2a2f3d" ${v}/>
        <path d="M 126 100 l 10 84 h -20 l -6 -78 Z" fill="#2a2f3d" ${v}/>
        <rect x="112" y="132" width="26" height="16" rx="3" fill="#ffffff" ${v}/>`;
    case "kiem_toan":
      return `${co("#dfe3ea")}
        <path d="M 66 104 l -6 82 h 78 l -6 -82 q -34 18 -66 0 Z" fill="#2f3645" ${v}/>
        <rect x="126" y="146" width="26" height="20" rx="3" fill="${p.nhan}" ${v}/>`;
    case "tot_nghiep":
      return `${co(p.phu)}
        <path d="M 60 36 l 40 -14 40 14 -40 14 Z" fill="#1f2430" ${v}/>
        <path d="M 140 36 v 18" stroke="${p.nhan}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="140" cy="56" r="4" fill="${p.nhan}"/>`;
    case "tet":
      return `<path d="M 68 106 q 32 18 64 0 l 6 78 q -38 14 -76 0 Z" fill="#c62828" ${v}/>
        <path d="M 100 106 v 78" stroke="#f5c542" stroke-width="3"/>
        <circle cx="132" cy="128" r="5" fill="#f5c542"/><circle cx="140" cy="140" r="4" fill="#f5c542"/>`;
    case "tinh_nguyen":
      return `${co("#1f8a5b")}
        <path d="M 74 100 q 26 20 52 0 l 6 84 q -32 14 -64 0 Z" fill="#1f8a5b" ${v}/>
        <path d="M 86 126 h 20 M 96 116 v 20" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>`;
    default:
      return co(p.phu);
  }
}

/* ------------------------------------------------------------------ */
/* Tay theo tư thế                                                     */
/* ------------------------------------------------------------------ */

interface Tay {
  trai: string;
  phai: string;
  /** Điểm đặt đạo cụ vào tay phải. */
  tayPhai: { x: number; y: number; xoay: number };
}

function veTay(pose: TuThe, p: BangMau): Tay {
  const net = `fill="none" stroke="${p.da}" stroke-width="11" stroke-linecap="round"`;
  const vien = `fill="none" stroke="${p.vien}" stroke-width="${11 + VIEN}" stroke-linecap="round"`;
  const tay = (d: string) => `<path d="${d}" ${vien}/><path d="${d}" ${net}/>`;

  switch (pose) {
    case "chi_tay":
      return {
        trai: tay("M 68 122 q -16 14 -12 34"),
        phai: tay("M 132 122 q 22 -12 34 -30"),
        tayPhai: { x: 168, y: 88, xoay: -35 },
      };
    case "gio_bang":
      return {
        trai: tay("M 68 122 q -20 -4 -26 -22"),
        phai: tay("M 132 122 q 20 -4 26 -22"),
        tayPhai: { x: 158, y: 96, xoay: -12 },
      };
    case "cam_but":
      return {
        trai: tay("M 68 124 q -16 16 -10 34"),
        phai: tay("M 132 124 q 10 12 2 26"),
        tayPhai: { x: 136, y: 154, xoay: 24 },
      };
    case "khoanh_tay":
      return {
        trai: tay("M 68 128 q 22 10 46 4"),
        phai: tay("M 132 138 q -22 -10 -46 -4"),
        tayPhai: { x: 92, y: 138, xoay: 0 },
      };
    case "nhay":
      return {
        trai: tay("M 68 118 q -22 -18 -22 -38"),
        phai: tay("M 132 118 q 22 -18 22 -38"),
        tayPhai: { x: 156, y: 76, xoay: -40 },
      };
    case "ngoi":
      return {
        trai: tay("M 68 126 q -14 16 -8 30"),
        phai: tay("M 132 126 q 14 16 8 30"),
        tayPhai: { x: 142, y: 158, xoay: 12 },
      };
    case "vay_tay":
      return {
        trai: tay("M 68 124 q -14 14 -10 30"),
        phai: tay("M 132 120 q 24 -8 28 -30"),
        tayPhai: { x: 162, y: 86, xoay: -28 },
      };
    default:
      return {
        trai: tay("M 68 122 q -14 18 -10 38"),
        phai: tay("M 132 122 q 14 18 10 38"),
        tayPhai: { x: 144, y: 162, xoay: 8 },
      };
  }
}

/* ------------------------------------------------------------------ */
/* Đạo cụ                                                              */
/* ------------------------------------------------------------------ */

function veDaoCu(prop: DaoCu, p: BangMau): string {
  const v = `stroke="${p.vien}" stroke-width="2.4" stroke-linejoin="round"`;
  switch (prop) {
    case "thuoc_vang":
      return `<rect x="-5" y="-34" width="10" height="68" rx="3" fill="${p.nhan}" ${v}/>
        ${[0, 1, 2, 3, 4].map((i) => `<rect x="-5" y="${-28 + i * 13}" width="${i % 2 ? 4 : 7}" height="2" fill="${p.vien}" opacity="0.7"/>`).join("")}`;
    case "but_long":
      return `<rect x="-3" y="-30" width="6" height="46" rx="3" fill="#6b4b2a" ${v}/>
        <path d="M -4 16 L 0 30 L 4 16 Z" fill="#1a1a1a" ${v}/>`;
    case "so_can_cu":
      return `<rect x="-20" y="-15" width="40" height="30" rx="3" fill="${p.phu}" ${v}/>
        <path d="M 0 -15 v 30" stroke="${p.vien}" stroke-width="2"/>
        <path d="M -14 -6 h 10 M -14 0 h 10 M 4 -6 h 10 M 4 0 h 10" stroke="${p.vien}" stroke-width="1.6" opacity="0.55"/>`;
    case "kinh_lup":
      return `<circle cx="0" cy="-8" r="15" fill="#cfe4f7" opacity="0.6" ${v}/>
        <path d="M 10 4 L 22 18" stroke="${p.vien}" stroke-width="6" stroke-linecap="round"/>`;
    case "can_dia":
      return `<path d="M 0 -26 v 8 M -26 -18 h 52" stroke="${p.nhan}" stroke-width="4" stroke-linecap="round"/>
        <path d="M -26 -18 v 12 M 26 -18 v 12" stroke="${p.vien}" stroke-width="1.8"/>
        <path d="M -38 -6 a 12 8 0 0 0 24 0 Z" fill="${p.nhan}" ${v}/>
        <path d="M 14 -6 a 12 8 0 0 0 24 0 Z" fill="${p.nhan}" ${v}/>`;
    case "ban_do_lo_trinh":
      return `<rect x="-26" y="-18" width="52" height="36" rx="3" fill="${p.phu}" ${v}/>
        <path d="M -18 12 q 10 -16 0 -24 q 12 -6 22 4 q 8 8 18 2" fill="none" stroke="${p.nhan}" stroke-width="3" stroke-dasharray="5 4"/>`;
    case "may_tinh_cam_tay":
      return `<rect x="-14" y="-20" width="28" height="40" rx="4" fill="#2f3645" ${v}/>
        <rect x="-10" y="-16" width="20" height="10" rx="2" fill="#a8d5a2"/>
        ${[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => `<circle cx="${-7 + c * 7}" cy="${1 + r * 6}" r="2" fill="#cfd4de"/>`)).join("")}`;
    case "xap_ho_so":
      return `<rect x="-20" y="-14" width="40" height="28" rx="2" fill="${p.phu}" ${v}/>
        <rect x="-17" y="-19" width="40" height="28" rx="2" fill="#ffffff" ${v}/>
        <path d="M -10 -10 h 24 M -10 -4 h 24 M -10 2 h 16" stroke="${p.vien}" stroke-width="1.6" opacity="0.5"/>`;
    case "den_pin":
      return `<rect x="-7" y="-6" width="26" height="14" rx="3" fill="#2f3645" ${v}/>
        <path d="M -7 -12 L -26 -22 -26 20 -7 10 Z" fill="${p.nhan}" opacity="0.55" ${v}/>`;
    case "dong_ho_cat":
      return `<path d="M -14 -20 h 28 l -14 20 14 20 h -28 l 14 -20 Z" fill="${p.phu}" ${v}/>
        <path d="M -14 -20 h 28 M -14 20 h 28" stroke="${p.vien}" stroke-width="3.4" stroke-linecap="round"/>
        <path d="M -6 -12 h 12 l -6 9 Z" fill="${p.nhan}"/>`;
    case "bia_da":
      return `<rect x="-18" y="-24" width="36" height="44" rx="6" fill="${p.phu}" ${v}/>
        <path d="M -18 -14 q 18 -14 36 0" fill="none" stroke="${p.vien}" stroke-width="2"/>`;
    default:
      return "";
  }
}

/* ------------------------------------------------------------------ */
/* Hiệu ứng                                                            */
/* ------------------------------------------------------------------ */

function veHieuUng(effect: HieuUng, p: BangMau, tinh: boolean): string {
  const nhipNhay = (dur: string, gia_tri: string) =>
    tinh
      ? ""
      : `<animate attributeName="opacity" values="${gia_tri}" dur="${dur}" repeatCount="indefinite"/>`;
  switch (effect) {
    case "bong_thoai":
      return `<g><path d="M 140 26 h 52 a 8 8 0 0 1 8 8 v 26 a 8 8 0 0 1 -8 8 h -34 l -12 12 v -12 h -6 a 8 8 0 0 1 -8 -8 v -26 a 8 8 0 0 1 8 -8 Z" fill="#ffffff" stroke="${p.vien}" stroke-width="2.4"/>
        <path d="M 148 40 h 36 M 148 50 h 24" stroke="${p.vien}" stroke-width="2.4" stroke-linecap="round" opacity="0.55"/></g>`;
    case "tia_sang":
      return `<g opacity="0.9">${[0, 45, 90, 135, 180, 225, 270, 315]
        .map(
          (a) =>
            `<path d="M 100 62 L ${100 + 62 * Math.cos((a * Math.PI) / 180)} ${62 + 62 * Math.sin((a * Math.PI) / 180)}" stroke="${p.nhan}" stroke-width="3" stroke-linecap="round" opacity="0.55"/>`,
        )
        .join("")}${nhipNhay("2.4s", "0.35;0.9;0.35")}</g>`;
    case "dau_hoi":
      return `<text x="152" y="46" font-size="42" font-weight="700" fill="${p.nhan}" font-family="system-ui, sans-serif">?${nhipNhay("1.8s", "0.4;1;0.4")}</text>`;
    case "dau_cham_than":
      return `<text x="156" y="46" font-size="42" font-weight="700" fill="#c0392b" font-family="system-ui, sans-serif">!${nhipNhay("1.2s", "0.5;1;0.5")}</text>`;
    case "phao_giay":
      return `<g>${[
        [28, 30, "#e0a13a"],
        [58, 18, "#c0392b"],
        [150, 24, "#2f6f5e"],
        [176, 44, "#7a4a8c"],
        [40, 66, "#1d3a97"],
        [166, 76, "#f2a33c"],
      ]
        .map(
          ([x, y, c]) =>
            `<rect x="${x}" y="${y}" width="9" height="5" rx="1.6" fill="${c}" transform="rotate(${Number(x) % 60} ${x} ${y})"/>`,
        )
        .join("")}</g>`;
    case "giot_mo_hoi":
      return `<path d="M 142 44 q 7 11 0 15 q -7 -4 0 -15 Z" fill="#6fa8dc" stroke="${p.vien}" stroke-width="1.6"/>`;
    case "vong_tron_nhip":
      return `<circle cx="100" cy="120" r="88" fill="none" stroke="${p.nhan}" stroke-width="4" stroke-linecap="round" stroke-dasharray="60 500" opacity="0.85">${
        tinh
          ? ""
          : `<animateTransform attributeName="transform" type="rotate" from="0 100 120" to="360 100 120" dur="1.6s" repeatCount="indefinite"/>`
      }</circle>`;
    default:
      return "";
  }
}

/** Chữ "z" của trạng thái ngủ — gắn với trạng thái chứ không phải hiệu ứng. */
function veNgu(p: BangMau, tinh: boolean): string {
  return `<g fill="${p.vien}" font-family="system-ui, sans-serif" font-weight="700" opacity="0.75">
    <text x="146" y="46" font-size="22">z</text><text x="164" y="30" font-size="16">z</text>
    ${tinh ? "" : `<animateTransform attributeName="transform" type="translate" values="0 0; 0 -5; 0 0" dur="2.6s" repeatCount="indefinite"/>`}
  </g>`;
}

/* ------------------------------------------------------------------ */
/* Điểm vào                                                            */
/* ------------------------------------------------------------------ */

/**
 * Kết xuất một biến thể nhân vật thành chuỗi SVG hoàn chỉnh.
 *
 * Tổ hợp không hợp lệ (trang phục ngoài `allowedCostumes`) KHÔNG ném lỗi mà rơi về trang
 * phục đầu tiên được phép: một hành động cấu hình sai không được phép làm trắng màn hình
 * của người học.
 */
export function veMascot(yc: YeuCauVe): string {
  const {
    persona,
    state = "binh_thuong",
    pose = "dung",
    prop,
    effect = "khong",
    size,
    tinh = false,
    idPrefix = "mascot",
  } = yc;
  const p = persona.palette;
  const body = persona.body;

  // Renderer không tự kiểm trang phục hợp lệ: người gọi lọc trước bằng `chonTrangPhuc`,
  // để hàm này không cần biết `allowedCostumes` và vẫn vẽ được từ dữ liệu tối thiểu.
  const costume: TrangPhuc = yc.costume ?? "thuong_ngay";
  const daoCu = prop ?? "khong";

  const net = netTheoTrangThai(state, p);
  const tam = tamMat(body);
  const tay = veTay(state === "bo_tay" ? "gio_bang" : state === "an_mung" ? "nhay" : pose, p);

  // Nhân vật nhún nhẹ khi vui/hào hứng; đứng yên ở trạng thái nghiêm túc và khi tắt chuyển động.
  const nhun =
    tinh || !["vui", "hao_hung", "an_mung", "khich_le"].includes(state)
      ? ""
      : `<animateTransform attributeName="transform" type="translate" values="0 0; 0 -4; 0 0" dur="${state === "an_mung" ? "0.9s" : "2.2s"}" repeatCount="indefinite" additive="sum"/>`;

  const nhan = persona.fullName;
  const kichThuoc = size ? ` width="${size}" height="${size}"` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240"${kichThuoc} role="img" aria-labelledby="${idPrefix}-ten" class="mascot mascot-${persona.code} mascot-${state}">
  <title id="${idPrefix}-ten">${esc(nhan)}</title>
  <g class="mascot-hieu-ung-sau">${effect === "tia_sang" ? veHieuUng(effect, p, tinh) : ""}</g>
  <ellipse cx="100" cy="216" rx="52" ry="9" fill="${p.vien}" opacity="0.16"/>
  <g class="mascot-than">${nhun}
    <path d="M 84 182 v 22 M 116 182 v 22" stroke="${p.vien}" stroke-width="13" stroke-linecap="round"/>
    <path d="M 84 182 v 22 M 116 182 v 22" stroke="${p.da}" stroke-width="9" stroke-linecap="round"/>
    ${veThan(body, p)}
    ${veTrangPhuc(costume, body, p)}
    <g class="mascot-tay-trai">${tay.trai}</g>
    <g class="mascot-tay-phai">${tay.phai}</g>
    <g class="mascot-dao-cu" transform="translate(${tay.tayPhai.x} ${tay.tayPhai.y}) rotate(${tay.tayPhai.xoay})">${veDaoCu(daoCu, p)}</g>
    ${veDau(body, p)}
    ${vePhuKienDau(persona.headGear, p)}
    <g class="mascot-mat" transform="translate(${tam.x} ${tam.y}) scale(${tam.scale})">
      ${net.may ?? ""}
      ${datMat(net.mat)}
      <g transform="translate(0 16)">${net.mieng}</g>
      ${net.them ?? ""}
    </g>
  </g>
  <g class="mascot-hieu-ung-truoc">${effect !== "tia_sang" ? veHieuUng(effect, p, tinh) : ""}${state === "ngu" ? veNgu(p, tinh) : ""}</g>
</svg>`;
}

/** Data URI để nhúng vào `<img src>` hoặc gửi làm ảnh tham chiếu cho prompt sinh ảnh. */
export function mascotDataUri(yc: YeuCauVe): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(veMascot(yc))}`;
}

/**
 * Trang phục hợp lệ cho một nhân vật. Ghép sai bị chặn ở đây, ở API và ở giao diện —
 * Rùa Đá không mặc áo bảo hộ công trường.
 */
export function trangPhucHopLe(persona: Pick<NhanVat, "allowedCostumes">, costume: TrangPhuc): boolean {
  return persona.allowedCostumes.length === 0 || persona.allowedCostumes.includes(costume);
}

export function chonTrangPhuc(
  persona: Pick<NhanVat, "allowedCostumes">,
  mongMuon?: TrangPhuc | null,
): TrangPhuc {
  if (mongMuon && trangPhucHopLe(persona, mongMuon)) return mongMuon;
  return persona.allowedCostumes[0] ?? "thuong_ngay";
}
