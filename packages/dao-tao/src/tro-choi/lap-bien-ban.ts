/**
 * Trò "Lập biên bản" (docs/PLAN.md GĐ-G3, docs/GAME_DESIGN.md §5.3).
 *
 * Mỗi bước là một tình huống: người chơi đọc lời kể rồi điền biểu mẫu rút gọn 4 ô, mỗi ô 25 điểm:
 *   1. Hành vi vi phạm: chọn trong danh sách mức phạt của loại xe, có ô tìm không dấu.
 *   2. Điều khoản áp dụng: chọn Điều – khoản – điểm, dựng từ URN của các dòng mức phạt.
 *   3. Mức phạt tiền: nhập số tiền; đúng khi nằm trong khung `phat_tu`–`phat_den` (Q7).
 *   4. Hình thức bổ sung, trừ điểm giấy phép lái xe: đánh dấu trong danh sách. Đủ và không thừa
 *      được 25; đủ nhưng thừa đúng một mục được một nửa; thiếu bất kỳ mục nào được 0.
 * Tình huống 2 hành vi có 2 dòng (ô 1–3 mỗi dòng); ô 1–3 chia đều điểm cho từng dòng, ghép dòng
 * người chơi điền với hành vi đúng theo cách cho điểm cao nhất. Không tính giờ.
 *
 * Tình huống (`game_content`) chỉ lưu lời kể và MÃ các dòng `violations`. Điều khoản, khung tiền,
 * hình thức bổ sung lấy từ dòng mức phạt đã duyệt được trỏ tới, không chép lại.
 */

import { tron } from "../de-thi.ts";
import { chuanHoa } from "../grading.ts";
import type { LoaiXe } from "../tra-cuu-nhanh.ts";
import { TEN_LOAI_XE } from "../tra-cuu-nhanh.ts";
import type { BuocLuot, DinhNghiaTroChoi } from "./khung.ts";

export const MA_LAP_BIEN_BAN = "lap_bien_ban";
export const DIEM_MOI_O = 25;
export const DIEM_MOI_BIEN_BAN = DIEM_MOI_O * 4;
export const SO_BIEN_BAN_MOI_LUOT = 3;
export const SO_HANH_VI_TOI_DA = 2;

/* ------------------------------------------------------------------ */
/* Dữ liệu                                                             */
/* ------------------------------------------------------------------ */

/** Phần người chơi thấy (game_content.payload). */
export interface TinhHuongBienBan {
  /** Lời kể: ai, phương tiện gì, ở đâu, hành vi gì, có tình tiết gì. */
  loi_ke: string;
  /** Đường dẫn hình minh họa (tùy chọn). Chưa có thì giao diện vẽ hình giữ chỗ theo loại xe. */
  hinh?: string | null;
}

/** Đáp án (game_content.answer): chỉ mã mức phạt; mức cụ thể là tùy chọn, chưa dùng để chấm (Q7). */
export interface DapAnBienBanGoc {
  vi_pham: string[];
  muc_cu_the?: Array<{ ma: string; so_tien: number; ly_do: string }>;
}

/** Một dòng mức phạt đã duyệt, còn hiệu lực tại ngày chơi. */
export interface MucPhatBienBan {
  ma: string;
  version: number;
  xe: LoaiXe;
  nhom: string | null;
  hanh_vi: string;
  tu_khoa: string[];
  phat_tu: number;
  phat_den: number;
  tru_diem: number | null;
  hinh_thuc_bo_sung: string[];
  can_cu: string;
}

/**
 * Một nguồn của trò: tình huống đã duyệt kèm các dòng mức phạt đã duyệt CÙNG LOẠI XE với hành vi
 * đúng (để dựng lựa chọn), và URN căn cứ của các dòng loại xe khác (chỉ để dựng ô Điều). Không mang
 * cả bảng mức phạt cho mỗi tình huống, để gói offline gọn.
 */
export interface NguonLapBienBan {
  id: string;
  code: string;
  version: number;
  topic_id: string | null;
  tinh_huong: TinhHuongBienBan;
  dap_an: DapAnBienBanGoc;
  muc_phat: MucPhatBienBan[];
  can_cu_khac: string[];
}

export interface LuaChonHanhVi {
  id: string;
  text: string;
  nhom: string | null;
  /** Hành vi và từ khóa đã bỏ dấu, hạ chữ thường: để tìm không dấu ngay trên máy (cả khi offline). */
  tim: string;
}

/** Cây Điều → khoản → điểm. `id` của mỗi nút là URN tới đúng nút đó. */
export interface NutDieuKhoan {
  id: string;
  nhan: string;
  con: NutDieuKhoan[];
}

export interface LuaChonBoSung {
  id: string;
  text: string;
}

/** Một dòng đáp án đúng, dựng từ dòng mức phạt (chỉ máy chủ và gói offline giữ). */
export interface DongDapAn {
  ma: string;
  hanh_vi: string;
  hanh_vi_text: string;
  dieu_khoan: string;
  dieu_khoan_text: string;
  phat_tu: number;
  phat_den: number;
}

/** Nội dung một bước trong ảnh chụp của lượt. */
export interface BuocBienBan {
  tinh_huong: TinhHuongBienBan;
  loai_xe: LoaiXe;
  lua_chon_hanh_vi: LuaChonHanhVi[];
  dieu_khoan: NutDieuKhoan[];
  lua_chon_bo_sung: LuaChonBoSung[];
  dap_an: {
    dong: DongDapAn[];
    bo_sung: string[];
    muc_cu_the: Array<{ ma: string; so_tien: number; ly_do: string }>;
  };
}

/** Phần đề gửi người chơi: lời kể và các lựa chọn. Không có mã mức phạt, khung tiền hay đáp án. */
export interface DeBienBan {
  loi_ke: string;
  hinh: string | null;
  loai_xe: LoaiXe;
  ten_loai_xe: string;
  so_dong: number;
  lua_chon_hanh_vi: LuaChonHanhVi[];
  dieu_khoan: NutDieuKhoan[];
  lua_chon_bo_sung: LuaChonBoSung[];
}

export interface DongTraLoi {
  hanh_vi: string | null;
  dieu_khoan: string | null;
  tien: number | null;
}

export interface TraLoiBienBan {
  dong: DongTraLoi[];
  bo_sung: string[];
}

/** Kết quả chấm từng ô, gửi cho người chơi SAU khi chấm (`chiTiet`). */
export interface ChiTietBienBan {
  /** Điểm từng ô (0–25). */
  diem_o: { hanh_vi: number; dieu_khoan: number; tien: number; bo_sung: number };
  /** Theo thứ tự dòng người chơi điền: ghép với dòng đáp án nào, và từng ô của dòng đó đúng không. */
  dong: Array<{ dap_an: number; hanh_vi: boolean; dieu_khoan: boolean; tien: boolean }>;
  dap_an: {
    dong: Array<{
      hanh_vi: string;
      hanh_vi_text: string;
      dieu_khoan: string;
      dieu_khoan_text: string;
      tien_tu: number;
      tien_den: number;
    }>;
    bo_sung: string[];
  };
  /** Mục bổ sung chọn thừa, mục bổ sung còn thiếu (id). */
  bo_sung_thua: string[];
  bo_sung_thieu: string[];
}

/* ------------------------------------------------------------------ */
/* Điều khoản từ URN                                                   */
/* ------------------------------------------------------------------ */

const TEN_LOAI_VAN_BAN: Record<string, string> = {
  hp: "Hiến pháp",
  l: "Luật",
  bl: "Bộ luật",
  nd: "Nghị định",
  tt: "Thông tư",
  nq: "Nghị quyết",
  qd: "Quyết định",
};

export interface PhanDieuKhoan {
  /** URN văn bản, không có phần nút. */
  van_ban: string;
  ten_van_ban: string;
  /** Số, ký hiệu, ví dụ "168/2024/NĐ-CP": nhãn ngắn cho ô chọn Điều trên điện thoại. */
  so_ky_hieu: string;
  dieu: string | null;
  khoan: string | null;
  diem: string | null;
}

/** Tách URN "vn:vbqppl:nd:168/2024/NĐ-CP#dieu-6.khoan-2.diem-a" thành văn bản, Điều, khoản, điểm. */
export function tachDieuKhoan(urn: string): PhanDieuKhoan | null {
  const [vanBan, nut = ""] = urn.trim().split("#", 2);
  const m = /^vn:vbqppl:([a-z-]+):(.+)$/.exec(vanBan ?? "");
  if (!m) return null;
  const phan: PhanDieuKhoan = {
    van_ban: vanBan!,
    ten_van_ban: `${TEN_LOAI_VAN_BAN[m[1]!] ?? m[1]!.toUpperCase()} số ${m[2]}`,
    so_ky_hieu: m[2]!,
    dieu: null,
    khoan: null,
    diem: null,
  };
  for (const seg of nut.split(".").filter(Boolean)) {
    const s = /^(dieu|khoan|diem)-([0-9a-zđ]+)$/i.exec(seg);
    if (!s) return null;
    phan[s[1]!.toLowerCase() as "dieu" | "khoan" | "diem"] = s[2]!.toLowerCase();
  }
  if (phan.diem && !phan.khoan) return null;
  if (phan.khoan && !phan.dieu) return null;
  return phan;
}

function urnNut(p: PhanDieuKhoan, muc: "dieu" | "khoan" | "diem"): string {
  const seg = [`dieu-${p.dieu}`];
  if (muc !== "dieu") seg.push(`khoan-${p.khoan}`);
  if (muc === "diem") seg.push(`diem-${p.diem}`);
  return `${p.van_ban}#${seg.join(".")}`;
}

/** Cách đọc chuẩn Việt Nam: "điểm a khoản 2 Điều 6 Nghị định số 168/2024/NĐ-CP". */
export function moTaDieuKhoan(urn: string): string {
  const p = tachDieuKhoan(urn);
  if (!p) return urn;
  const phan = [
    p.diem ? `điểm ${p.diem}` : null,
    p.khoan ? `khoản ${p.khoan}` : null,
    p.dieu ? `Điều ${p.dieu}` : null,
    p.ten_van_ban,
  ].filter(Boolean);
  const s = phan.join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Chuẩn hóa URN để so: bỏ khoảng trắng, hạ chữ thường phần nút. */
function chuanUrn(urn: string): string {
  const p = tachDieuKhoan(urn);
  if (!p?.dieu) return urn.trim();
  return urnNut(p, p.diem ? "diem" : p.khoan ? "khoan" : "dieu");
}

const soTuNhien = (s: string) => {
  const n = Number.parseInt(s, 10);
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
};
const sapNut = (a: NutDieuKhoan, b: NutDieuKhoan, lay: (id: string) => string) =>
  soTuNhien(lay(a.id)) - soTuNhien(lay(b.id)) || a.id.localeCompare(b.id, "vi");

/**
 * Dựng cây Điều → khoản → điểm cho ô 2.
 *  - khoản, điểm: từ URN của các dòng cùng nhóm với hành vi đúng (danh sách ngắn, sát tình huống);
 *  - Điều: thêm Điều của mọi dòng mức phạt, để ô Điều luôn có lựa chọn thật (dữ liệu hiện chỉ ghi
 *    căn cứ tới mức Điều, nếu chỉ lấy cùng nhóm thì thường chỉ còn một Điều).
 */
export function dungCayDieuKhoan(
  cungNhom: readonly Pick<MucPhatBienBan, "can_cu">[],
  tatCa: readonly Pick<MucPhatBienBan, "can_cu">[],
): NutDieuKhoan[] {
  const dieu = new Map<string, NutDieuKhoan>();
  const them = (urn: string, chiDieu: boolean) => {
    const p = tachDieuKhoan(urn);
    if (!p?.dieu) return;
    const idDieu = urnNut(p, "dieu");
    let d = dieu.get(idDieu);
    if (!d) {
      d = { id: idDieu, nhan: `Điều ${p.dieu} · ${p.so_ky_hieu}`, con: [] };
      dieu.set(idDieu, d);
    }
    if (chiDieu || !p.khoan) return;
    const idKhoan = urnNut(p, "khoan");
    let k = d.con.find((x) => x.id === idKhoan);
    if (!k) {
      k = { id: idKhoan, nhan: `Khoản ${p.khoan}`, con: [] };
      d.con.push(k);
    }
    if (!p.diem) return;
    const idDiem = urnNut(p, "diem");
    if (!k.con.some((x) => x.id === idDiem)) k.con.push({ id: idDiem, nhan: `Điểm ${p.diem}`, con: [] });
  };
  for (const r of cungNhom) them(r.can_cu, false);
  for (const r of tatCa) them(r.can_cu, true);
  const layDieu = (id: string) => /dieu-([^.]+)/.exec(id)?.[1] ?? "";
  const layKhoan = (id: string) => /khoan-([^.]+)/.exec(id)?.[1] ?? "";
  const kq = [...dieu.values()].sort((a, b) => sapNut(a, b, layDieu));
  for (const d of kq) {
    d.con.sort((a, b) => sapNut(a, b, layKhoan));
    for (const k of d.con) k.con.sort((a, b) => a.id.localeCompare(b.id, "vi"));
  }
  return kq;
}

/* ------------------------------------------------------------------ */
/* Hình thức bổ sung                                                   */
/* ------------------------------------------------------------------ */

/** Các mục bổ sung của một dòng mức phạt: hình thức bổ sung, biện pháp khắc phục, trừ điểm. */
export function mucBoSung(r: Pick<MucPhatBienBan, "hinh_thuc_bo_sung" | "tru_diem">): string[] {
  const ds = r.hinh_thuc_bo_sung.map((s) => s.trim()).filter(Boolean);
  if (r.tru_diem) ds.push(`Trừ ${r.tru_diem} điểm giấy phép lái xe`);
  return ds;
}

const khoaMuc = (s: string) => chuanHoa(s);

/* ------------------------------------------------------------------ */
/* Kiểm tra tình huống                                                 */
/* ------------------------------------------------------------------ */

/**
 * Kiểm một tình huống với bảng mức phạt hiện có. Trả danh sách lỗi; rỗng là hợp lệ.
 * `mucPhat` là các dòng mà tình huống có thể trỏ tới (mã → dòng).
 */
export function kiemTraTinhHuongBienBan(
  payload: Partial<TinhHuongBienBan> | null | undefined,
  answer: Partial<DapAnBienBanGoc> | null | undefined,
  mucPhat: ReadonlyMap<
    string,
    Pick<MucPhatBienBan, "ma" | "xe" | "phat_tu" | "phat_den" | "hinh_thuc_bo_sung" | "tru_diem">
  >,
): string[] {
  const loi: string[] = [];
  if (!payload || typeof payload !== "object") return ["Thiếu lời kể tình huống."];
  const loiKe = typeof payload.loi_ke === "string" ? payload.loi_ke.trim() : "";
  if (loiKe.length < 30) loi.push("Lời kể quá ngắn: cần nêu ai, phương tiện gì, ở đâu, hành vi gì.");
  if (loiKe.length > 1500) loi.push("Lời kể dài quá 1.500 ký tự.");
  if (payload.hinh != null && (typeof payload.hinh !== "string" || payload.hinh.length > 300))
    loi.push("Đường dẫn hình minh họa không hợp lệ.");

  const ma = answer && Array.isArray(answer.vi_pham) ? answer.vi_pham : null;
  if (!ma || ma.length < 1 || ma.length > SO_HANH_VI_TOI_DA || ma.some((x) => typeof x !== "string")) {
    loi.push(`Đáp án phải có 1 đến ${SO_HANH_VI_TOI_DA} mã mức phạt (answer.vi_pham).`);
    return loi;
  }
  if (new Set(ma).size !== ma.length) loi.push("Hai dòng hành vi trùng mã mức phạt.");
  const dong = ma.map((m) => mucPhat.get(m));
  ma.forEach((m, i) => {
    if (!dong[i]) loi.push(`Mức phạt "${m}" không tồn tại.`);
  });
  const co = dong.filter((d): d is NonNullable<typeof d> => Boolean(d));
  if (co.length === 2 && co[0]!.xe !== co[1]!.xe)
    loi.push(
      `Hai hành vi khác loại xe (${TEN_LOAI_XE[co[0]!.xe]}, ${TEN_LOAI_XE[co[1]!.xe]}): một biên bản chỉ lập cho một phương tiện.`,
    );
  if (co.length === 2) {
    const a = new Set(mucBoSung(co[0]!).map(khoaMuc));
    const trung = mucBoSung(co[1]!).filter((s) => a.has(khoaMuc(s)));
    if (trung.length)
      loi.push(
        `Hai hành vi có cùng mục bổ sung "${trung[0]}": biểu mẫu chưa phân biệt được, chọn tình huống khác hoặc chỉ giữ một hành vi.`,
      );
  }
  for (const c of answer?.muc_cu_the ?? []) {
    const d = mucPhat.get(c?.ma);
    if (!ma.includes(c?.ma) || !d) loi.push(`Mức cụ thể trỏ tới "${c?.ma}" không có trong đáp án.`);
    else if (!(c.so_tien >= d.phat_tu && c.so_tien <= d.phat_den))
      loi.push(`Mức cụ thể của "${c.ma}" nằm ngoài khung ${d.phat_tu}–${d.phat_den}.`);
    else if (typeof c.ly_do !== "string" || c.ly_do.trim().length < 5)
      loi.push(`Mức cụ thể của "${c.ma}" cần ghi lý do.`);
  }
  return loi;
}

/* ------------------------------------------------------------------ */
/* Tìm hành vi không dấu                                               */
/* ------------------------------------------------------------------ */

/**
 * Lọc lựa chọn hành vi theo chuỗi tìm: mọi từ (đã bỏ dấu) phải có trong hành vi hoặc từ khóa, cùng
 * quy tắc với tìm mức phạt GĐ5 (`search_text LIKE %từ%` cho từng từ). Chạy trên máy để dùng được
 * cả khi offline.
 */
export function timHanhVi<T extends Pick<LuaChonHanhVi, "tim">>(ds: readonly T[], q: string): T[] {
  const tu = chuanHoa(q).split(" ").filter(Boolean);
  if (!tu.length) return [...ds];
  return ds.filter((o) => tu.every((t) => o.tim.includes(t)));
}

/* ------------------------------------------------------------------ */
/* Chấm                                                                */
/* ------------------------------------------------------------------ */

/** Điểm ô bổ sung: đủ và không thừa 25; đủ, thừa đúng một mục 12,5; còn lại 0. */
export function diemBoSung(chon: readonly string[], dung: readonly string[]): number {
  const c = new Set(chon);
  const d = new Set(dung);
  if ([...d].some((x) => !c.has(x))) return 0;
  const thua = [...c].filter((x) => !d.has(x)).length;
  return thua === 0 ? DIEM_MOI_O : thua === 1 ? DIEM_MOI_O / 2 : 0;
}

function chamDong(t: DongTraLoi | undefined, d: DongDapAn) {
  return {
    hanh_vi: t?.hanh_vi === d.hanh_vi,
    dieu_khoan: t?.dieu_khoan != null && chuanUrn(t.dieu_khoan) === chuanUrn(d.dieu_khoan),
    tien: typeof t?.tien === "number" && t.tien >= d.phat_tu && t.tien <= d.phat_den,
  };
}

/** Các hoán vị của [0..n-1] (n ≤ 2 trong trò này, viết chung cho gọn). */
function hoanVi(n: number): number[][] {
  if (n <= 1) return [[0]];
  const kq: number[][] = [];
  for (const p of hoanVi(n - 1))
    for (let i = 0; i <= p.length; i++) kq.push([...p.slice(0, i), n - 1, ...p.slice(i)]);
  return kq;
}

/**
 * Chấm một biên bản. Ghép dòng người chơi với dòng đáp án theo hoán vị cho tổng ô 1–3 cao nhất
 * (hòa thì giữ thứ tự người chơi điền).
 */
export function chamBienBan(b: BuocBienBan, tl: TraLoiBienBan): { diem: number; chiTiet: ChiTietBienBan } {
  const dapAn = b.dap_an.dong;
  const n = dapAn.length;
  let tot: { ghep: number[]; cham: ReturnType<typeof chamDong>[]; tong: number } | null = null;
  for (const p of hoanVi(n)) {
    // p[i]: dòng đáp án ghép với dòng người chơi thứ i.
    const cham = p.map((j, i) => chamDong(tl.dong[i], dapAn[j]!));
    const tong = cham.reduce((s, c) => s + Number(c.hanh_vi) + Number(c.dieu_khoan) + Number(c.tien), 0);
    if (!tot || tong > tot.tong) tot = { ghep: p, cham, tong };
  }
  const { ghep, cham } = tot!;
  const oDong = (k: "hanh_vi" | "dieu_khoan" | "tien") => (DIEM_MOI_O * cham.filter((c) => c[k]).length) / n;
  const boSung = [...new Set(tl.bo_sung)];
  const diemO = {
    hanh_vi: oDong("hanh_vi"),
    dieu_khoan: oDong("dieu_khoan"),
    tien: oDong("tien"),
    bo_sung: diemBoSung(boSung, b.dap_an.bo_sung),
  };
  return {
    diem: diemO.hanh_vi + diemO.dieu_khoan + diemO.tien + diemO.bo_sung,
    chiTiet: {
      diem_o: diemO,
      dong: ghep.map((j, i) => ({ dap_an: j, ...cham[i]! })),
      dap_an: {
        dong: dapAn.map((d) => ({
          hanh_vi: d.hanh_vi,
          hanh_vi_text: d.hanh_vi_text,
          dieu_khoan: d.dieu_khoan,
          dieu_khoan_text: d.dieu_khoan_text,
          tien_tu: d.phat_tu,
          tien_den: d.phat_den,
        })),
        bo_sung: b.dap_an.bo_sung,
      },
      bo_sung_thua: boSung.filter((x) => !b.dap_an.bo_sung.includes(x)),
      bo_sung_thieu: b.dap_an.bo_sung.filter((x) => !boSung.includes(x)),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Dựng bước                                                           */
/* ------------------------------------------------------------------ */

const tien = (n: number) => `${n.toLocaleString("vi-VN")} đồng`;

/** Nguồn dùng được: tình huống hợp lệ và mọi mã trong đáp án có dòng mức phạt đã duyệt tại ngày chơi. */
function dungDuoc(n: NguonLapBienBan): boolean {
  const bang = new Map(n.muc_phat.map((r) => [r.ma, r]));
  return kiemTraTinhHuongBienBan(n.tinh_huong, n.dap_an, bang).length === 0;
}

/**
 * Dựng một bước. Id lựa chọn là id mờ sinh theo lượt (hv-1, bs-2…), để phần đề không chứa mã mức
 * phạt; bảng id → mã nằm trong đáp án, chỉ máy chủ và gói offline giữ.
 */
export function dungBuocBienBan(
  n: NguonLapBienBan,
  thuTu: number,
  rng: () => number,
): BuocLuot<BuocBienBan> | null {
  if (!dungDuoc(n)) return null;
  const bang = new Map(n.muc_phat.map((r) => [r.ma, r]));
  const dung = n.dap_an.vi_pham.map((m) => bang.get(m)!);
  const xe = dung[0]!.xe;
  const cungXe = n.muc_phat.filter((r) => r.xe === xe);

  const hanhVi = tron(
    [...cungXe].sort((a, b) => a.ma.localeCompare(b.ma)),
    rng,
  );
  const idHv = new Map(hanhVi.map((r, i) => [r.ma, `hv-${i + 1}`]));
  const luaChonHanhVi: LuaChonHanhVi[] = hanhVi
    .map((r) => ({
      id: idHv.get(r.ma)!,
      text: r.hanh_vi,
      nhom: r.nhom,
      tim: chuanHoa([r.hanh_vi, r.nhom ?? "", ...r.tu_khoa].join(" ")),
    }))
    // Danh sách đọc theo nhóm rồi theo hành vi; thứ tự id đã trộn nên id không lộ vị trí gốc.
    .sort((a, b) => (a.nhom ?? "").localeCompare(b.nhom ?? "", "vi") || a.text.localeCompare(b.text, "vi"));

  const nhom = new Set(dung.map((r) => r.nhom));
  const dieuKhoan = dungCayDieuKhoan(
    n.muc_phat.filter((r) => nhom.has(r.nhom)),
    [...n.muc_phat, ...n.can_cu_khac.map((can_cu) => ({ can_cu }))],
  );

  // Mục bổ sung: của mọi dòng cùng loại xe (gồm mục đúng), gộp theo nội dung đã bỏ dấu.
  const muc = new Map<string, string>();
  for (const r of [...dung, ...cungXe])
    for (const s of mucBoSung(r)) if (!muc.has(khoaMuc(s))) muc.set(khoaMuc(s), s);
  const boSung = tron(
    [...muc.entries()].sort(([a], [b]) => a.localeCompare(b)),
    rng,
  ).map(([k, text], i) => ({
    k,
    id: `bs-${i + 1}`,
    text,
  }));
  const idBs = new Map(boSung.map((o) => [o.k, o.id]));

  return {
    thu_tu: thuTu,
    ref_kind: "game_content",
    ref_id: n.id,
    ref_version: n.version,
    topic_id: n.topic_id,
    diem_toi_da: DIEM_MOI_BIEN_BAN,
    noi_dung: {
      tinh_huong: { loi_ke: n.tinh_huong.loi_ke.trim(), hinh: n.tinh_huong.hinh ?? null },
      loai_xe: xe,
      lua_chon_hanh_vi: luaChonHanhVi,
      dieu_khoan: dieuKhoan,
      lua_chon_bo_sung: boSung.map(({ id, text }) => ({ id, text })),
      dap_an: {
        dong: dung.map((r) => ({
          ma: r.ma,
          hanh_vi: idHv.get(r.ma)!,
          hanh_vi_text: r.hanh_vi,
          dieu_khoan: chuanUrn(r.can_cu),
          dieu_khoan_text: moTaDieuKhoan(r.can_cu),
          phat_tu: r.phat_tu,
          phat_den: r.phat_den,
        })),
        bo_sung: [...new Set(dung.flatMap((r) => mucBoSung(r).map((s) => idBs.get(khoaMuc(s))!)))],
        muc_cu_the: n.dap_an.muc_cu_the ?? [],
      },
    },
  };
}

function giaiThich(b: BuocBienBan): string {
  const tenBs = new Map(b.lua_chon_bo_sung.map((o) => [o.id, o.text]));
  const dong = b.dap_an.dong.map((d) => {
    const cuThe = b.dap_an.muc_cu_the.find((c) => c.ma === d.ma);
    return `${d.hanh_vi_text}: ${d.dieu_khoan_text}; phạt tiền từ ${tien(d.phat_tu)} đến ${tien(d.phat_den)}${
      cuThe ? ` (mức đề xuất ${tien(cuThe.so_tien)}: ${cuThe.ly_do.trim()})` : ""
    }.`;
  });
  const bs = b.dap_an.bo_sung.map((id) => tenBs.get(id)).filter(Boolean);
  return `${dong.join(" ")} ${bs.length ? `Hình thức bổ sung, trừ điểm: ${bs.join("; ")}.` : "Không có hình thức bổ sung, không trừ điểm giấy phép lái xe."}`;
}

/* ------------------------------------------------------------------ */
/* Định nghĩa trò                                                      */
/* ------------------------------------------------------------------ */

const chuoiNgan = (v: unknown, max = 300) => v === null || (typeof v === "string" && v.length <= max);

export const TRO_CHOI_LAP_BIEN_BAN: DinhNghiaTroChoi<BuocBienBan, DeBienBan, TraLoiBienBan> = {
  ma: MA_LAP_BIEN_BAN,
  ten: "Lập biên bản",
  moTa: "Đọc tình huống, điền biểu mẫu 4 ô: hành vi, điều khoản, mức phạt, hình thức bổ sung. Chấm từng ô.",
  offline: true,
  nguon: "lap_bien_ban_tinh_huong",
  soBuoc: SO_BIEN_BAN_MOI_LUOT,
  thoiGian: null,
  thuongNhanh: false,
  xpCoBan: 20,

  locNguon(nguon) {
    return (nguon as NguonLapBienBan[]).filter(dungDuoc);
  },

  taoLuot(nguon, rng) {
    // Sắp theo id trước khi trộn: lượt chỉ phụ thuộc tập nguồn và seed (máy chủ sinh lại lượt offline).
    const goc = tron(
      [...(this.locNguon(nguon) as NguonLapBienBan[])].sort((a, b) => a.id.localeCompare(b.id)),
      rng,
    );
    return goc
      .slice(0, this.soBuoc)
      .map((n, i) => dungBuocBienBan(n, i + 1, rng))
      .filter((b): b is BuocLuot<BuocBienBan> => b !== null);
  },

  deChoNguoiChoi(buoc) {
    const b = buoc.noi_dung;
    return {
      loi_ke: b.tinh_huong.loi_ke,
      hinh: b.tinh_huong.hinh ?? null,
      loai_xe: b.loai_xe,
      ten_loai_xe: TEN_LOAI_XE[b.loai_xe],
      so_dong: b.dap_an.dong.length,
      lua_chon_hanh_vi: b.lua_chon_hanh_vi,
      dieu_khoan: b.dieu_khoan,
      lua_chon_bo_sung: b.lua_chon_bo_sung,
    };
  },

  docTraLoi(raw) {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    if (!Array.isArray(r.dong) || r.dong.length < 1 || r.dong.length > SO_HANH_VI_TOI_DA) return null;
    if (
      !Array.isArray(r.bo_sung) ||
      r.bo_sung.length > 50 ||
      !r.bo_sung.every((x) => typeof x === "string" && x.length <= 40)
    )
      return null;
    const dong: DongTraLoi[] = [];
    for (const d of r.dong) {
      if (!d || typeof d !== "object") return null;
      const x = d as Record<string, unknown>;
      const hv = x.hanh_vi ?? null;
      const dk = x.dieu_khoan ?? null;
      const t = x.tien ?? null;
      if (!chuoiNgan(hv, 40) || !chuoiNgan(dk)) return null;
      if (t !== null && (typeof t !== "number" || !Number.isFinite(t) || t < 0 || t > 1e12)) return null;
      dong.push({ hanh_vi: hv as string | null, dieu_khoan: dk as string | null, tien: t as number | null });
    }
    return { dong, bo_sung: r.bo_sung as string[] };
  },

  chamBuoc(buoc, traLoi) {
    const b = buoc.noi_dung;
    const { diem, chiTiet } = chamBienBan(b, traLoi);
    return {
      diem,
      diemToiDa: buoc.diem_toi_da,
      dung: diem >= buoc.diem_toi_da,
      chiTiet,
      giaiThich: giaiThich(b),
      canCu: [...new Set(b.dap_an.dong.map((d) => d.dieu_khoan))],
    };
  },
};
