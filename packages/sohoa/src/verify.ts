/**
 * Kiểm chứng tự động sau chuyển đổi (ke-hoach/05 §5).
 *
 * Đây là phần KHÔNG giao cho mô hình: mọi kết luận về chất lượng phải tính được
 * bằng luật, lặp lại được, và giải thích được cho quản trị viên nội dung.
 */
import { demKyTuNoiDung } from "./postprocess.ts";
import type { BangKhaiBao, CanhBao, TrangText } from "./types.ts";

/** Dãy chữ cái đánh số điểm trong VBQPPL Việt Nam — không có f, j, w, z. */
export const DAY_DIEM = [
  "a",
  "b",
  "c",
  "d",
  "đ",
  "e",
  "g",
  "h",
  "i",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "x",
  "y",
] as const;

export interface MucKiemTra {
  ma: string;
  ten: string;
  dat: boolean;
  chiTiet: string;
  trongSo: number;
  /** Sai mục này thì bắt buộc đưa vào hàng đợi biên tập, dù điểm tổng còn cao. */
  batBuoc?: boolean;
}

export interface KetQuaKiemChung {
  /** Điểm chất lượng 0..1, ghi vào document_versions.quality. */
  diem: number;
  canDuyet: boolean;
  muc: MucKiemTra[];
  canhBao: CanhBao[];
  soLieu: Record<string, number>;
}

export interface DauVaoKiemChung {
  markdown: string;
  /** Lớp văn bản của các trang (nếu có) để đối chiếu độ dài. */
  trang?: TrangText[];
  /** Bảng do agent khai báo, để đối chiếu với bảng đếm được trong Markdown. */
  bang?: BangKhaiBao[];
  /** Có phải bản đầy đủ của một văn bản không (mới kiểm khối chữ ký). */
  toanVanBan?: boolean;
}

export interface SoDieu {
  so: number;
  hau: string;
  dong: number;
}

/** Trích danh sách Điều theo thứ tự xuất hiện. */
export function trichDieu(md: string): SoDieu[] {
  const ra: SoDieu[] = [];
  const dong = md.split("\n");
  for (const [i, d] of dong.entries()) {
    const m = /^\s*(?:#{1,6}\s*)?(?:\*\*)?Điều\s+(\d+)([a-zđ]\d*)?\s*[.:]/u.exec(d);
    if (m) ra.push({ so: Number(m[1]), hau: m[2] ?? "", dong: i + 1 });
  }
  return ra;
}

function kiemTraLienTucDieu(md: string): MucKiemTra {
  const dieu = trichDieu(md);
  if (!dieu.length) {
    return {
      ma: "lien_tuc_dieu",
      ten: "Tính liên tục số điều",
      dat: false,
      chiTiet: "Không nhận ra Điều nào trong bản Markdown",
      trongSo: 0.25,
      batBuoc: true,
    };
  }
  const loi: string[] = [];
  let truoc = 0;
  const daGap = new Set<string>();
  for (const d of dieu) {
    const khoa = `${d.so}${d.hau}`;
    if (daGap.has(khoa)) loi.push(`Điều ${khoa} xuất hiện hai lần (dòng ${d.dong})`);
    daGap.add(khoa);
    if (!d.hau) {
      if (truoc && d.so !== truoc + 1) {
        loi.push(
          d.so > truoc ? `nhảy từ Điều ${truoc} sang Điều ${d.so}` : `lùi từ Điều ${truoc} về Điều ${d.so}`,
        );
      }
      truoc = d.so;
    }
  }
  return {
    ma: "lien_tuc_dieu",
    ten: "Tính liên tục số điều",
    dat: loi.length === 0,
    chiTiet: loi.length ? loi.slice(0, 5).join("; ") : `${dieu.length} điều liên tục từ Điều ${dieu[0]?.so}`,
    trongSo: 0.25,
    batBuoc: true,
  };
}

function kiemTraKhoanDiem(md: string): MucKiemTra {
  const loi: string[] = [];
  let khoanTruoc = 0;
  let diemTruoc = -1;
  let soKhoan = 0;
  let soDiem = 0;
  for (const raw of md.split("\n")) {
    // Nhãn khoản/điểm trong phụ lục thường được in đậm ("**1. Chuẩn bị...**"); bỏ dấu
    // nhấn mạnh trước khi so, nếu không bộ đếm sẽ không thấy khoản và tưởng điểm nhảy dãy.
    const d = raw.trim().replace(/^[*_]{1,3}\s*/, "");
    // Ranh giới đánh số lại: Điều, Chương, Mục, Phần, Phụ lục và từng biểu mẫu.
    // Phụ lục và biểu mẫu đánh số 1., 2., a)… độc lập với thân văn bản; không đặt lại thì
    // mọi văn bản có phụ lục đều bị báo "khoản 5 -> khoản 1".
    if (
      /^(?:#{1,6}\s*)?(?:\*\*)?(Điều|ĐIỀU)\s+\d/u.test(d) ||
      /^(?:#{1,6}\s*)?(?:\*\*)?(Chương|CHƯƠNG|Mục|MỤC|Tiểu mục|Phần|PHẦN|Phụ lục|PHỤ LỤC)\b/u.test(d) ||
      /^(?:\*|_)*Mẫu số\s*\d/u.test(d) ||
      // Phần đánh số La Mã trong phụ lục ("I. CẤU TRÚC BẢN TIN", "II. …"): mỗi phần đánh khoản lại từ 1.
      /^[IVXLC]+\.\s+\S/u.test(d) ||
      /^<!--\s*kind:\s*bieu_mau/u.test(raw.trim())
    ) {
      khoanTruoc = 0;
      diemTruoc = -1;
      continue;
    }
    const mKhoan = /^(\d+)([a-zđ]\d*)?\.\s/u.exec(d);
    if (mKhoan) {
      soKhoan++;
      const so = Number(mKhoan[1]);
      if (!mKhoan[2]) {
        if (khoanTruoc && so !== khoanTruoc + 1) loi.push(`khoản ${khoanTruoc} -> khoản ${so}`);
        khoanTruoc = so;
      }
      diemTruoc = -1;
      continue;
    }
    const mDiem = /^([a-zđ])(\d*)\)\s/u.exec(d);
    if (mDiem) {
      soDiem++;
      const chu = mDiem[1] as string;
      const vt = DAY_DIEM.indexOf(chu as (typeof DAY_DIEM)[number]);
      if (vt < 0) {
        loi.push(`điểm "${chu})" không thuộc dãy chữ cái dùng cho VBQPPL Việt Nam`);
      } else if (!mDiem[2]) {
        if (diemTruoc >= 0 && vt !== diemTruoc + 1) {
          loi.push(`điểm ${DAY_DIEM[diemTruoc]}) -> điểm ${chu})`);
        }
        diemTruoc = vt;
      }
    }
  }
  return {
    ma: "khoan_diem",
    ten: "Tính liên tục khoản và điểm",
    dat: loi.length === 0,
    chiTiet: loi.length ? loi.slice(0, 5).join("; ") : `${soKhoan} khoản, ${soDiem} điểm đúng dãy`,
    trongSo: 0.15,
  };
}

/** Một bảng đếm được trong Markdown. */
export interface BangDemDuoc {
  format: "gfm" | "html";
  /** Số hàng dữ liệu (không tính hàng tiêu đề). */
  hang: number;
  cot: number;
  /**
   * Bảng dùng để DỰNG BỐ CỤC chứ không chứa dữ liệu: khối tiêu ngữ hai ô, khối chữ ký
   * hai ô của biểu mẫu. Không đối chiếu với khai báo của agent.
   */
  boCuc: boolean;
}

function demBangGfm(md: string): BangDemDuoc[] {
  const dong = md.split("\n");
  const ra: BangDemDuoc[] = [];
  let dangTrong = false;
  let hang = 0;
  let cot = 0;
  const dong_xong = () => {
    ra.push({ format: "gfm", hang, cot, boCuc: cot <= 2 && hang <= 1 });
  };
  for (const d of dong) {
    const laDongBang = /^\s*\|/.test(d);
    if (laDongBang && !dangTrong) {
      dangTrong = true;
      cot = d.split("|").filter((_o, i, a) => i > 0 && i < a.length - 1).length;
      hang = 0;
    } else if (laDongBang && dangTrong) {
      // Dòng phân cách phải CÓ gạch ngang; hàng để trống của biểu mẫu ("|  |  |  |")
      // vẫn là một hàng dữ liệu, không được bỏ đếm.
      if (!/^\s*\|[\s:|-]*-[\s:|-]*\|?\s*$/.test(d)) hang++;
    } else if (!laDongBang && dangTrong) {
      dangTrong = false;
      dong_xong();
    }
  }
  if (dangTrong) dong_xong();
  return ra;
}

function demBangHtml(md: string): BangDemDuoc[] {
  const ra: BangDemDuoc[] = [];
  for (const bang of md.match(/<table[\s\S]*?<\/table>/gi) ?? []) {
    const than = bang.replace(/<thead[\s\S]*?<\/thead>/gi, "");
    const hangs = than.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
    let cot = 0;
    for (const h of hangs) {
      let n = 0;
      for (const o of h.match(/<t[dh][^>]*>/gi) ?? []) {
        const cs = /colspan\s*=\s*"?(\d+)/i.exec(o);
        n += cs ? Number(cs[1]) : 1;
      }
      cot = Math.max(cot, n);
    }
    // Bảng HTML luôn do người viết cố ý dựng (gộp ô, khung tem) nên không xếp vào "bố cục".
    ra.push({ format: "html", hang: hangs.length, cot, boCuc: false });
  }
  return ra;
}

/** Đếm bảng trong Markdown: bảng GFM (khối dòng bắt đầu bằng "|") và bảng HTML. */
export function demBang(md: string): {
  gfm: number;
  html: number;
  hang: number[];
  cot: number[];
  chiTiet: BangDemDuoc[];
} {
  const g = demBangGfm(md);
  const h = demBangHtml(md);
  return {
    gfm: g.length,
    html: h.length,
    hang: g.map((b) => b.hang),
    cot: g.map((b) => b.cot),
    chiTiet: [...g, ...h],
  };
}

function kiemTraBang(md: string, khai?: BangKhaiBao[]): MucKiemTra | undefined {
  if (!khai?.length) return undefined;
  const dem = demBang(md);
  const loi: string[] = [];

  // Khai báo gộp từ mọi cụm trang có hai loại nhiễu phải bỏ trước khi đối chiếu (lộ ra khi số hóa
  // Nghị định 151/2024/NĐ-CP, văn bản nhiều biểu mẫu, ngày 14/9/2026):
  //  - bảng nằm ở TRANG CHỒNG LẤN được hai cụm cùng khai: giữ khai báo đầu tiên theo node_path;
  //  - bảng bố cục GFM (≤ 2 cột, ≤ 1 hàng: tiêu ngữ, khối chữ ký biểu mẫu) — phía đếm đã bỏ qua
  //    loại này (`boCuc`), phía khai cũng phải bỏ, nếu không số lượng luôn lệch.
  const daThay = new Set<string>();
  const sach = khai.filter((b) => {
    if ((b.format ?? "gfm") === "gfm" && b.cols <= 2 && b.rows <= 1) return false;
    if (b.node_path && !b.continued_from_previous) {
      if (daThay.has(b.node_path)) return false;
      daThay.add(b.node_path);
    }
    return true;
  });

  // Gộp khai báo của cùng một bảng bị cắt qua nhiều cụm trang thành MỘT bảng.
  const gop: BangKhaiBao[] = [];
  for (const b of sach) {
    const truoc = gop.at(-1);
    if (b.continued_from_previous && truoc) {
      truoc.rows += b.rows;
      continue;
    }
    gop.push({ ...b });
  }

  for (const dinhDang of ["gfm", "html"] as const) {
    // Bảng bố cục (tiêu ngữ, khối chữ ký của biểu mẫu) không phải bảng dữ liệu, không đối chiếu.
    const thuc = dem.chiTiet.filter((b) => b.format === dinhDang && !b.boCuc);
    const khaiTheoDang = gop.filter((b) => (b.format ?? "gfm") === dinhDang);
    if (thuc.length !== khaiTheoDang.length) {
      loi.push(`bảng ${dinhDang}: khai ${khaiTheoDang.length} nhưng đếm được ${thuc.length}`);
    }
    khaiTheoDang.forEach((b, i) => {
      const t = thuc[i];
      if (!t) return;
      if (Math.abs(t.hang - b.rows) > 1)
        loi.push(`bảng ${dinhDang} ${i + 1}: khai ${b.rows} hàng, đếm ${t.hang}`);
      if (Math.abs(t.cot - b.cols) > 1)
        loi.push(`bảng ${dinhDang} ${i + 1}: khai ${b.cols} cột, đếm ${t.cot}`);
    });
  }

  const soBoCuc = dem.chiTiet.filter((b) => b.boCuc).length;
  return {
    ma: "bang",
    ten: "Đối chiếu bảng",
    dat: loi.length === 0,
    chiTiet: loi.length
      ? loi.slice(0, 5).join("; ")
      : `${gop.length} bảng dữ liệu khớp khai báo${soBoCuc ? ` (bỏ qua ${soBoCuc} bảng bố cục)` : ""}`,
    trongSo: 0.15,
  };
}

function kiemTraDoDai(md: string, trang?: TrangText[]): MucKiemTra | undefined {
  if (!trang?.length) return undefined;
  const ocr = trang.reduce((s, t) => s + t.soKyTu, 0);
  // Dưới ngưỡng này phép so độ dài không có ý nghĩa (một trích đoạn ngắn, một trang bìa).
  if (ocr < 120) return undefined;
  const mdKyTu = demKyTuNoiDung(md);
  const lech = (mdKyTu - ocr) / ocr;
  const dat = Math.abs(lech) <= 0.08;
  return {
    ma: "do_dai",
    ten: "Đối chiếu độ dài với lớp văn bản",
    dat,
    chiTiet: `Markdown ${mdKyTu} ký tự / nguồn ${ocr} ký tự (lệch ${(lech * 100).toFixed(1)}%, ngưỡng ±8%)`,
    trongSo: 0.15,
  };
}

function kiemTraCongThuc(md: string): MucKiemTra | undefined {
  const khoi = md.match(/\$\$[\s\S]*?\$\$/g) ?? [];
  const trongDong = (md.match(/(?<!\$)\$(?!\$)[^\n$]+\$(?!\$)/g) ?? []).length;
  if (!khoi.length && !trongDong) return undefined;
  const loi: string[] = [];
  const doiDau = (md.match(/\$\$/g) ?? []).length;
  if (doiDau % 2 !== 0) loi.push("số dấu $$ lẻ — có công thức khối chưa đóng");
  for (const [i, k] of khoi.entries()) {
    const mo = (k.match(/{/g) ?? []).length;
    const dong = (k.match(/}/g) ?? []).length;
    if (mo !== dong) loi.push(`công thức khối ${i + 1}: ngoặc nhọn lệch (${mo} mở / ${dong} đóng)`);
  }
  const soAlt = (md.match(/<!--\s*alt:/g) ?? []).length;
  if (soAlt < khoi.length)
    loi.push(`${khoi.length} công thức khối nhưng chỉ ${soAlt} chú thích <!-- alt: -->`);
  return {
    ma: "cong_thuc",
    ten: "Công thức LaTeX",
    dat: loi.length === 0,
    chiTiet: loi.length
      ? loi.slice(0, 5).join("; ")
      : `${khoi.length} công thức khối, ${trongDong} công thức trong dòng`,
    trongSo: 0.1,
  };
}

/**
 * Khối chữ ký theo loại văn bản:
 *  - Nghị định, thông tư, quyết định: "Nơi nhận:" và chức danh "TM."/"KT.".
 *  - Luật, nghị quyết của Quốc hội, pháp lệnh: không có "Nơi nhận"; kết bằng câu "Luật này được
 *    Quốc hội … thông qua ngày …" và chức danh "CHỦ TỊCH QUỐC HỘI" (lệnh của Chủ tịch nước:
 *    "CHỦ TỊCH NƯỚC"). Thiếu mẫu này thì mọi luật số hóa đều rơi vào chờ duyệt (lộ ra khi số hóa
 *    Luật 36/2024/QH15 ngày 08/9/2026).
 */
const MAU_CHU_KY: RegExp[] = [
  /Nơi nhận\s*:/i,
  /\b(TM\.|KT\.)\s/,
  /(Luật|Nghị quyết|Pháp lệnh|Bộ luật) này (đã )?được (Quốc hội|Ủy ban Thường vụ Quốc hội)[^\n]{0,200}thông qua/i,
  /CHỦ TỊCH (QUỐC HỘI|NƯỚC)/,
  /<!--\s*node:\s*chu-ky\s*-->/,
];

function kiemTraChuKy(md: string, toanVanBan?: boolean): MucKiemTra | undefined {
  if (!toanVanBan) return undefined;
  const co = MAU_CHU_KY.some((re) => re.test(md));
  return {
    ma: "chu_ky",
    ten: "Khối chữ ký cuối văn bản",
    dat: co,
    chiTiet: co
      ? "Có khối 'Nơi nhận'/chức danh người ký hoặc câu thông qua của Quốc hội"
      : "Không thấy khối chữ ký — có thể đã bị cắt nhầm như footer",
    trongSo: 0.1,
    batBuoc: true,
  };
}

function kiemTraKhongDocDuoc(md: string): MucKiemTra {
  const so = (md.match(/\[\[không đọc được/g) ?? []).length;
  const kyTu = Math.max(1, demKyTuNoiDung(md));
  const tyLe = so / (kyTu / 1000);
  const dat = so === 0;
  return {
    ma: "khong_doc_duoc",
    ten: "Chỗ không đọc được",
    dat,
    chiTiet: so
      ? `${so} chỗ đánh dấu không đọc được (${tyLe.toFixed(2)} chỗ/1000 ký tự)`
      : "Không có chỗ nào không đọc được",
    trongSo: 0.1,
  };
}

function kiemTraMarker(md: string): MucKiemTra {
  const dieu = trichDieu(md).length;
  const marker = (md.match(/<!--\s*node:/g) ?? []).length;
  const dat = dieu === 0 || marker >= dieu;
  return {
    ma: "marker",
    ten: "Marker nút",
    dat,
    chiTiet: dat
      ? `${marker} marker cho ${dieu} điều`
      : `chỉ ${marker} marker <!-- node: --> cho ${dieu} điều`,
    trongSo: 0.1,
  };
}

/** Ngưỡng điểm để không phải đưa vào hàng đợi biên tập. */
export const NGUONG_DAT = 0.95;

export function kiemChung(dv: DauVaoKiemChung): KetQuaKiemChung {
  const md = dv.markdown ?? "";
  const muc: MucKiemTra[] = [
    kiemTraLienTucDieu(md),
    kiemTraKhoanDiem(md),
    kiemTraMarker(md),
    kiemTraKhongDocDuoc(md),
  ];
  for (const m of [
    kiemTraDoDai(md, dv.trang),
    kiemTraBang(md, dv.bang),
    kiemTraCongThuc(md),
    kiemTraChuKy(md, dv.toanVanBan),
  ]) {
    if (m) muc.push(m);
  }

  const tongTrongSo = muc.reduce((s, m) => s + m.trongSo, 0) || 1;
  const dat = muc.filter((m) => m.dat).reduce((s, m) => s + m.trongSo, 0);
  const diem = Math.round((dat / tongTrongSo) * 10000) / 10000;
  const hongBatBuoc = muc.some((m) => m.batBuoc && !m.dat);

  const canhBao: CanhBao[] = muc
    .filter((m) => !m.dat)
    .map((m) => ({
      kind: m.ma === "bang" ? "table" : m.ma === "cong_thuc" ? "formula" : "layout",
      message: `${m.ten}: ${m.chiTiet}`,
    }));

  return {
    diem,
    canDuyet: hongBatBuoc || diem < NGUONG_DAT,
    muc,
    canhBao,
    soLieu: {
      ky_tu: demKyTuNoiDung(md),
      dieu: trichDieu(md).length,
      bang: demBang(md).gfm + demBang(md).html,
    },
  };
}
