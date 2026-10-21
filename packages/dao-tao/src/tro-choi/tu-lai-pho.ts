/**
 * Khu phố của trò "Tự lái qua phố" (docs/PLAN.md GĐ-T9, docs/GAME_DESIGN.md §5.9): bản đồ dạng ô,
 * đèn, biển, người đi bộ, xe khác, và bộ phát hiện lỗi lái.
 *
 * Bản đồ là DỮ LIỆU (game_content.payload): lưới ký tự, mỗi ô 10 m, cùng danh sách đèn, biển, vạch
 * người đi bộ, người đi bộ, luồng xe. Thêm khu phố mới là thêm dữ liệu, không sửa mã. Ký tự:
 *   `-` đường ngang hai chiều   `|` đường dọc hai chiều   `+` nơi giao nhau
 *   `>` `<` đường ngang một chiều   `^` `v` đường dọc một chiều (theo chiều mũi tên)
 *   `.` nhà   `T` trường học   `C` chợ   `V` công viên (chỉ để vẽ, xe không vào được)
 * Đi bên phải: đường hai chiều có một làn mỗi chiều, đường một chiều có hai làn cùng chiều.
 *
 * Xe khác chạy bằng bộ mô phỏng M5 của trò 3, không sửa M5: mỗi luồng xe là một làn M5 dựng từ tuyến
 * ô. Trước mỗi nhịp M5, tệp này đặt TRẦN TỐC ĐỘ (`v_max`) của từng xe để xe dừng trước đèn đỏ, trước
 * vạch có người đi bộ, trước xe khác hay xe người chơi trên đường đi, và chờ lượt vào nơi giao nhau
 * (mỗi nơi giao nhau một xe tự chạy một lúc). M5 lo phần còn lại: tăng tốc, phanh, bám xe cùng làn.
 *
 * Xe người chơi đi theo làn (mo-phong/xe-nguoi-lai.ts): nút trái/phải gần nơi giao nhau là chọn
 * hướng rẽ, giữa phố là chuyển làn, đứng yên thì nút trái là quay đầu. Game âm thầm ghi lỗi:
 * vượt đèn đỏ, quá tốc độ theo biển, đi sai phần đường, không nhường người đi bộ, chuyển hướng không
 * xi nhan, đi vào đường cấm, rẽ nơi cấm rẽ, không nhường xe trong nơi giao nhau, va chạm.
 *
 * Tất định (GAME_DESIGN §2.3): số nguyên, nhịp 50 ms, không hàm lượng giác, không Math.random,
 * không Date.now. Máy chủ và điện thoại chạy cùng mã này.
 */
import {
  BUOC_HUONG,
  dungLan,
  type Huong,
  type LanDaDung,
  O_CM,
  RONG_LAN_CM,
  viTriTrenLan,
} from "../mo-phong/duong.ts";
import {
  buocMoPhong,
  chongNhau,
  dungMoPhong,
  type HopBao,
  hopBao,
  type MoPhong,
  NHIP_MS,
  NHIP_TOI_DA,
  type TrangThaiMoPhong,
  trangThaiDau,
} from "../mo-phong/mo-phong.ts";
import {
  KICH_THUOC_XE,
  type LoaiXe,
  PHANH_DU_KIEN,
  PHANH_THUONG,
  type Xe,
  type XeKhoiTao,
} from "../mo-phong/xe.ts";
import {
  type DiemMm,
  diChuyen,
  huongDoan,
  kmh,
  type LoaiXeNguoiLai,
  mmNhip,
  tocDoSau,
  vMaxXe,
  type XeNguoiLai,
} from "../mo-phong/xe-nguoi-lai.ts";

/* ------------------------------------------------------------------ */
/* Hằng số                                                            */
/* ------------------------------------------------------------------ */

const O = O_CM;
/** Tim làn cách tim đường chừng này (cm). */
const LECH_LAN = RONG_LAN_CM / 2;
/** Mặt đường chiếm [VIA, O - VIA] theo bề ngang ô; hai bên là vỉa hè. */
const VIA = 150;
/** Vát góc khi rẽ phải, rẽ trái (cm): đoạn chéo 45° thay cho góc vuông. */
const VAT_RE_PHAI = 200;
const VAT_RE_TRAI = 400;
/** Nửa bề rộng dải vạch người đi bộ theo chiều xe chạy (cm). */
const NUA_VACH = 150;
/** Nút trái/phải là chọn hướng rẽ khi nơi giao nhau ở trong số ô này phía trước. */
export const O_CHUAN_BI_RE = 3;
/** Xe người chơi dừng trước chỗ hết đường (ngõ cụt, ngã ba không chọn hướng) chừng này (mm). */
const DUNG_TRUOC_CUT_MM = 1500;
/** Quá vạch dừng chừng này (cm) khi đèn đỏ mới tính vượt đèn: nhích qua vạch một chút không tính. */
export const DUNG_SAI_VACH_CM = 50;
/** Quá tốc độ từ mức này (km/h) liên tục quá 1 giây mới tính lỗi. */
export const NGUONG_QUA_TOC_DO_KMH = 5;
export const NHIP_QUA_TOC_DO = 20;
/** Lệch sang trái tim đường quá chừng này (cm) mới tính đi sai phần đường (chạm vạch không tính). */
export const DUNG_SAI_LAN_CM = 50;
/** Người đi bộ: 1,2 m/s, đi từ vỉa hè này sang vỉa hè kia (từ 1 m tới 9 m của ô). */
const TOC_DO_DI_BO = 60;
const DAI_DI_BO_MM = 8000;
/** Xe va chạm đứng lại chừng này nhịp rồi được kéo đi (gỡ khỏi đường). */
const NHIP_GO_XE_HONG = 40;
/** Xe tự chạy xin vào nơi giao nhau khi còn cách chừng này (mm). */
const GIU_CHO_MM = 40_000;
/** Xe tự chạy nhường xe người chơi đang tới nơi giao nhau trong khoảng này (mm). */
const NHUONG_NGUOI_CHOI_MM = 15_000;
/** Xe tự chạy nhìn phía trước chừng này (cm) để thấy vật cản ở làn khác, bước 1 m. */
const NHIN_VAT_CAN_CM = 3000;
const KHOANG_DUNG_VAT_CAN_CM = 300;
/** Lấy vết xe người chơi mỗi chừng này nhịp (bản đồ đường đã đi ở màn kết quả). */
export const NHIP_VET = 10;

export type TenHuong = "bac" | "dong" | "nam" | "tay";
export const HUONG_THEO_TEN: Readonly<Record<TenHuong, Huong>> = { bac: 0, dong: 2, nam: 4, tay: 6 };
export const TEN_THEO_HUONG: Readonly<Record<number, TenHuong>> = { 0: "bac", 2: "dong", 4: "nam", 6: "tay" };
const laTenHuong = (v: unknown): v is TenHuong => v === "bac" || v === "dong" || v === "nam" || v === "tay";

export type OLuoi = readonly [number, number];
export type TrucDuong = "doc" | "ngang";
export type MauDenPho = "xanh" | "vang" | "do";

/* ------------------------------------------------------------------ */
/* Dữ liệu bản đồ                                                      */
/* ------------------------------------------------------------------ */

/** Đèn tín hiệu ở một nơi giao nhau. Thời gian tính bằng giây. */
export interface DenBanDo {
  o: OLuoi;
  xanh: number;
  vang: number;
  /** Cả hai hướng cùng đỏ khi chuyển pha. */
  do_chung: number;
  /** Trục được xanh trước ở giây 0. */
  truc_dau: TrucDuong;
  /** Lệch pha, giây. */
  lech?: number;
}

/**
 * Biển trên bản đồ. `huong` là chiều đi của người lái mà biển hướng tới.
 *  - `P.127` (tốc độ tối đa, kèm `toc_do` km/h): hiệu lực từ ô đặt biển tới trước nơi giao nhau kế tiếp.
 *  - `P.123a`, `P.123b`, `P.136` (cấm rẽ trái, rẽ phải, đi thẳng): đặt ở ô nơi giao nhau, `huong` là
 *    chiều đi vào nơi giao nhau.
 *  - `P.102`, `P.101` (cấm đi ngược chiều, đường cấm): đặt ở ô đầu đoạn cấm, `huong` là chiều bị cấm.
 *  - Mã khác: chỉ để vẽ (ví dụ `W.224` báo có vạch người đi bộ).
 */
export interface BienBanDo {
  ma: string;
  o: OLuoi;
  huong: TenHuong;
  toc_do?: number;
}

export interface VachDiBoBanDo {
  o: OLuoi;
}

/** Người đi bộ sang đường ở một vạch. Bắt đầu theo giờ (`luc`, giây) hoặc khi xe người chơi tới gần (`khi_xe_cach`, m). */
export interface NguoiDiBoBanDo {
  id: string;
  o: OLuoi;
  di: TenHuong;
  luc?: number;
  khi_xe_cach?: number;
}

/** Luồng xe tự chạy: `so_xe` xe đi cùng tuyến, xe đầu vào đường lúc `bat_dau` giây, cách nhau `cach` giây. */
export interface LuongXe {
  id: string;
  loai: "o_to" | "xe_tai" | "xe_may";
  /** Ô đầu, các nơi giao nhau có rẽ, ô cuối. Hai ô liền nhau phải cùng hàng hoặc cùng cột. */
  tuyen: OLuoi[];
  bat_dau: number;
  cach: number;
  so_xe: number;
  /** km/h. */
  toc_do: number;
}

/** Bản đồ khu phố, lưu ở game_content.payload (kieu = "ban_do"). */
export interface PayloadBanDo {
  kieu: "ban_do";
  man: number;
  ten_pho?: string;
  o: string[];
  xuat_phat: { o: OLuoi; huong: TenHuong };
  dich: { o: OLuoi };
  /** Giờ của lượt (giây mô phỏng); null: không tính giờ (vẫn tối đa 5 phút). */
  gio_giay: number | null;
  den: DenBanDo[];
  bien: BienBanDo[];
  vach_di_bo: VachDiBoBanDo[];
  nguoi_di_bo: NguoiDiBoBanDo[];
  xe_khac: LuongXe[];
  /** Ô đường cấm cả hai chiều (có biển P.101 ở lối vào). */
  duong_cam?: OLuoi[];
}

export const MA_BIEN_TOC_DO = "P.127";
export const MA_BIEN_CAM_RE: Readonly<Record<string, "trai" | "phai" | "thang">> = {
  "P.123a": "trai",
  "P.123b": "phai",
  "P.136": "thang",
};
export const MA_BIEN_CAM_VAO = ["P.102", "P.101"] as const;

/* ------------------------------------------------------------------ */
/* Lưới ô                                                              */
/* ------------------------------------------------------------------ */

const KY_TU_HOP_LE = new Set(["-", "|", "+", "<", ">", "^", "v", ".", "T", "C", "V"]);
export const laDuong = (ch: string) =>
  ch === "-" || ch === "|" || ch === "+" || ch === "<" || ch === ">" || ch === "^" || ch === "v";
export const trucCua = (h: number): TrucDuong => (h === 0 || h === 4 ? "doc" : "ngang");
/** Ô đường cho xe đi theo trục của hướng `h` không. */
export function nhanTruc(ch: string, h: number): boolean {
  if (ch === "+") return true;
  const t = trucCua(h);
  return t === "ngang" ? ch === "-" || ch === "<" || ch === ">" : ch === "|" || ch === "^" || ch === "v";
}
/** Chiều được đi của ô một chiều; null là hai chiều. */
export function chieuMotChieu(ch: string): Huong | null {
  return ch === ">" ? 2 : ch === "<" ? 6 : ch === "^" ? 0 : ch === "v" ? 4 : null;
}
export const laHaiChieu = (ch: string) => ch === "-" || ch === "|";

export const khoaO = (r: number, c: number) => `${r},${c}`;
const khoaOH = (r: number, c: number, h: number) => `${r},${c},${h}`;

function kyTuO(luoi: readonly string[], r: number, c: number): string {
  if (r < 0 || r >= luoi.length) return "#";
  return luoi[r]![c] ?? "#";
}

/** Ô kề theo hướng chính. */
const oKe = (r: number, c: number, h: number): [number, number] => {
  const [dx, dy] = BUOC_HUONG[h as Huong];
  return [r + dy, c + dx];
};

/* ------------------------------------------------------------------ */
/* Hình học làn                                                        */
/* ------------------------------------------------------------------ */

export interface DiemCm {
  x: number;
  y: number;
}

const tamO = (r: number, c: number): DiemCm => ({ x: c * O + O / 2, y: r * O + O / 2 });
/** Vectơ "bên phải" của chiều đi `h` (hướng chính). */
const benPhai = (h: number) => BUOC_HUONG[((h + 2) % 8) as Huong];

/** Điểm trên tim làn `l` (+1 làn phải, −1 làn trái theo chiều đi) tại tâm ô. */
function diemLan(r: number, c: number, h: number, l: number): DiemCm {
  const t = tamO(r, c);
  const [px, py] = benPhai(h);
  return { x: t.x + px * LECH_LAN * l, y: t.y + py * LECH_LAN * l };
}
/** Chỗ làn đi vào ô (mép ô phía sau theo chiều đi). */
function cuaVao(r: number, c: number, h: number, l: number): DiemCm {
  const p = diemLan(r, c, h, l);
  const [dx, dy] = BUOC_HUONG[h as Huong];
  return { x: p.x - (dx * O) / 2, y: p.y - (dy * O) / 2 };
}
/** Chỗ làn ra khỏi ô (mép ô phía trước). */
function cuaRa(r: number, c: number, h: number, l: number): DiemCm {
  const p = diemLan(r, c, h, l);
  const [dx, dy] = BUOC_HUONG[h as Huong];
  return { x: p.x + (dx * O) / 2, y: p.y + (dy * O) / 2 };
}

/**
 * Đường rẽ trong ô nơi giao nhau: từ làn `l` chiều `h` sang làn phải chiều `h2`. Góc vuông được vát
 * bằng một đoạn chéo 45° (đúng 8 hướng như làn M5). Trả các mốc (cm): đầu đoạn chéo, cuối đoạn chéo,
 * mép ra của ô.
 */
export function duongRe(r: number, c: number, h: number, l: number, h2: number): DiemCm[] {
  const a = diemLan(r, c, h, l);
  const b = diemLan(r, c, h2, 1);
  const [dx, dy] = BUOC_HUONG[h as Huong];
  const [ex, ey] = BUOC_HUONG[h2 as Huong];
  const P = dx === 0 ? { x: a.x, y: b.y } : { x: b.x, y: a.y };
  const vao = cuaVao(r, c, h, l);
  const ra = cuaRa(r, c, h2, 1);
  const tuVao = Math.abs(P.x - vao.x) + Math.abs(P.y - vao.y);
  const toiRa = Math.abs(ra.x - P.x) + Math.abs(ra.y - P.y);
  const k = Math.max(50, Math.min(h2 === (h + 2) % 8 ? VAT_RE_PHAI : VAT_RE_TRAI, tuVao - 50, toiRa - 50));
  return [{ x: P.x - dx * k, y: P.y - dy * k }, { x: P.x + ex * k, y: P.y + ey * k }, ra];
}

/* ------------------------------------------------------------------ */
/* Đèn                                                                 */
/* ------------------------------------------------------------------ */

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Màu đèn cho trục `truc` ở nhịp `nhip`. Hai trục thay nhau xanh, giữa hai pha có `do_chung` giây cùng đỏ. */
export function mauDenPho(d: DenBanDo, nhip: number, truc: TrucDuong): MauDenPho {
  const g = d.xanh * 20;
  const y = d.vang * 20;
  const r0 = d.do_chung * 20;
  const nua = g + y + r0;
  const t = mod(nhip + (d.lech ?? 0) * 20, 2 * nua);
  const t2 = truc === d.truc_dau ? t : mod(t - nua, 2 * nua);
  return t2 < g ? "xanh" : t2 < g + y ? "vang" : "do";
}

/* ------------------------------------------------------------------ */
/* Kiểm bản đồ                                                         */
/* ------------------------------------------------------------------ */

/** Một lỗi bố cục, chỉ đúng phần tử: "ban_do", "o:<hàng>,<cột>", "den:<i>", "bien:<i>", "nguoi:<id>", "xe:<id>". */
export interface LoiBanDo {
  phan_tu: string;
  loi: string;
}

export const SO_MAN_TU_LAI = 3;
const HANG_TOI_THIEU = 4;
const HANG_TOI_DA = 30;
const SO_XE_TOI_DA = 40;

const laO = (v: unknown): v is OLuoi =>
  Array.isArray(v) && v.length === 2 && Number.isInteger(v[0]) && Number.isInteger(v[1]);
const soNguyenTrong = (v: unknown, a: number, b: number): v is number =>
  Number.isInteger(v) && (v as number) >= a && (v as number) <= b;
const tenO = (o: OLuoi) => `hàng ${o[0] + 1}, cột ${o[1] + 1}`;

/** Ô bị cấm đi theo chiều `h` (đường một chiều đi ngược, hoặc đường cấm). */
function biCamDi(
  luoi: readonly string[],
  cam: ReadonlySet<string>,
  r: number,
  c: number,
  h: number,
): boolean {
  const ch = kyTuO(luoi, r, c);
  if (ch === "+") return false;
  if (cam.has(khoaO(r, c))) return true;
  const mc = chieuMotChieu(ch);
  return mc !== null && mc !== h;
}

/**
 * Kiểm một bản đồ. `bienDaDuyet` (mã biển đã duyệt) vắng thì bỏ qua phần kiểm duyệt biển. Rỗng là hợp
 * lệ. Chạy khi soạn, khi nạp dữ liệu mẫu, khi lấy nguồn.
 */
export function kiemTraBanDo(
  p: Partial<PayloadBanDo> | null | undefined,
  bienDaDuyet?: ReadonlySet<string>,
): LoiBanDo[] {
  const loi: LoiBanDo[] = [];
  const them = (phan_tu: string, l: string) => loi.push({ phan_tu, loi: l });
  if (!p || typeof p !== "object") return [{ phan_tu: "ban_do", loi: "Thiếu bản đồ." }];
  if (p.kieu !== "ban_do") them("ban_do", 'Nội dung phải có kieu = "ban_do".');
  if (!soNguyenTrong(p.man, 1, SO_MAN_TU_LAI)) them("ban_do", `Màn (man) phải từ 1 đến ${SO_MAN_TU_LAI}.`);
  if (p.gio_giay !== null && !soNguyenTrong(p.gio_giay, 30, 300))
    them("ban_do", "Giờ của lượt (gio_giay) phải từ 30 đến 300 giây, hoặc null.");

  // Lưới.
  const luoi = p.o;
  if (
    !Array.isArray(luoi) ||
    luoi.length < HANG_TOI_THIEU ||
    luoi.length > HANG_TOI_DA ||
    luoi.some((h) => typeof h !== "string")
  ) {
    them("ban_do", `Lưới ô (o) phải là ${HANG_TOI_THIEU}–${HANG_TOI_DA} dòng chữ.`);
    return loi;
  }
  const cot = luoi[0]!.length;
  if (cot < HANG_TOI_THIEU || cot > HANG_TOI_DA || luoi.some((h) => h.length !== cot)) {
    them("ban_do", `Mọi dòng của lưới phải dài bằng nhau, ${HANG_TOI_THIEU}–${HANG_TOI_DA} ô.`);
    return loi;
  }
  const kt = (r: number, c: number) => kyTuO(luoi, r, c);
  const trong = (o: unknown): o is OLuoi =>
    laO(o) && o[0] >= 0 && o[0] < luoi.length && o[1] >= 0 && o[1] < cot;
  for (let r = 0; r < luoi.length; r++)
    for (let c = 0; c < cot; c++) {
      const ch = kt(r, c);
      if (!KY_TU_HOP_LE.has(ch)) {
        them(`o:${r},${c}`, `Ô ${tenO([r, c])}: ký tự "${ch}" không dùng được.`);
        continue;
      }
      if (!laDuong(ch) || ch === "+") continue;
      // Đường nối với ô kề theo trục của nó phải cùng trục (hoặc là nơi giao nhau).
      for (const h of ch === "-" || ch === "<" || ch === ">" ? [2, 6] : [0, 4]) {
        const [r2, c2] = oKe(r, c, h);
        const ke = kt(r2, c2);
        if (laDuong(ke) && !nhanTruc(ke, h))
          them(`o:${r},${c}`, `Ô ${tenO([r, c])}: đường không nối được với ô kề (${tenO([r2, c2])}).`);
        const m1 = chieuMotChieu(ch);
        const m2 = chieuMotChieu(ke);
        if (m1 !== null && m2 !== null && m1 !== m2)
          them(`o:${r},${c}`, `Ô ${tenO([r, c])}: hai đoạn một chiều liền nhau ngược chiều.`);
      }
    }

  const cam = new Set<string>();
  for (const o of p.duong_cam ?? []) {
    if (!trong(o) || !laDuong(kt(o[0], o[1])) || kt(o[0], o[1]) === "+")
      them("ban_do", `Đường cấm ở ${laO(o) ? tenO(o) : "?"} phải là ô đường, không phải nơi giao nhau.`);
    else cam.add(khoaO(o[0], o[1]));
  }

  // Xuất phát, đích.
  const xp = p.xuat_phat;
  let xpHopLe = false;
  if (!xp || !trong(xp.o) || !laTenHuong(xp.huong))
    them("ban_do", "Thiếu điểm xuất phát (xuat_phat: o, huong).");
  else {
    const ch = kt(xp.o[0], xp.o[1]);
    const h = HUONG_THEO_TEN[xp.huong];
    if (!laDuong(ch) || ch === "+" || !nhanTruc(ch, h))
      them("ban_do", `Điểm xuất phát ở ${tenO(xp.o)} phải là đoạn đường theo hướng ${xp.huong}.`);
    else if (biCamDi(luoi, cam, xp.o[0], xp.o[1], h))
      them("ban_do", "Điểm xuất phát đi ngược chiều hoặc trong đường cấm.");
    else xpHopLe = true;
  }
  const dich = p.dich;
  let dichHopLe = false;
  if (!dich || !trong(dich.o)) them("ban_do", "Thiếu điểm đích (dich: o).");
  else if (!laDuong(kt(dich.o[0], dich.o[1])) || kt(dich.o[0], dich.o[1]) === "+")
    them("ban_do", `Điểm đích ở ${tenO(dich.o)} phải là đoạn đường, không phải nơi giao nhau.`);
  else if (xp && laO(xp.o) && xp.o[0] === dich.o[0] && xp.o[1] === dich.o[1])
    them("ban_do", "Điểm đích trùng điểm xuất phát.");
  else dichHopLe = true;

  // Đèn.
  const coDen = new Set<string>();
  (p.den ?? []).forEach((d, i) => {
    const pt = `den:${i}`;
    if (!d || !trong(d.o) || kt(d.o[0], d.o[1]) !== "+") {
      them(pt, `Đèn ${i + 1} phải đặt ở ô nơi giao nhau (+).`);
      return;
    }
    if (coDen.has(khoaO(d.o[0], d.o[1]))) them(pt, `Nơi giao nhau ${tenO(d.o)} có hai đèn.`);
    coDen.add(khoaO(d.o[0], d.o[1]));
    if (!soNguyenTrong(d.xanh, 3, 90)) them(pt, `Đèn ${i + 1}: thời gian xanh phải từ 3 đến 90 giây.`);
    if (!soNguyenTrong(d.vang, 1, 5)) them(pt, `Đèn ${i + 1}: thời gian vàng phải từ 1 đến 5 giây.`);
    if (!soNguyenTrong(d.do_chung, 0, 5)) them(pt, `Đèn ${i + 1}: thời gian cùng đỏ phải từ 0 đến 5 giây.`);
    if (d.truc_dau !== "doc" && d.truc_dau !== "ngang")
      them(pt, `Đèn ${i + 1}: truc_dau phải là "doc" hoặc "ngang".`);
    if (d.lech !== undefined && !soNguyenTrong(d.lech, 0, 300))
      them(pt, `Đèn ${i + 1}: lệch pha phải từ 0 đến 300 giây.`);
  });

  // Biển.
  const camVaoCoBien = new Set<string>();
  const camRe = new Map<string, Set<string>>();
  (p.bien ?? []).forEach((b, i) => {
    const pt = `bien:${i}`;
    if (!b || typeof b.ma !== "string" || !b.ma || b.ma.length > 20 || !trong(b.o) || !laTenHuong(b.huong)) {
      them(pt, `Biển ${i + 1} cần mã (ma), ô (o) và hướng (huong).`);
      return;
    }
    if (bienDaDuyet && !bienDaDuyet.has(b.ma)) them(pt, `Biển ${b.ma} chưa được duyệt.`);
    const ch = kt(b.o[0], b.o[1]);
    const h = HUONG_THEO_TEN[b.huong];
    if (!laDuong(ch)) {
      them(pt, `Biển ${b.ma} ở ${tenO(b.o)} phải đặt ở ô đường.`);
      return;
    }
    if (b.ma === MA_BIEN_TOC_DO) {
      if (!soNguyenTrong(b.toc_do, 5, 120))
        them(pt, `Biển ${b.ma} ở ${tenO(b.o)} cần tốc độ (toc_do) từ 5 đến 120 km/h.`);
      if (ch === "+" || !nhanTruc(ch, h))
        them(pt, `Biển ${b.ma} ở ${tenO(b.o)} phải đặt trên đoạn đường theo hướng ${b.huong}.`);
    } else if (Object.hasOwn(MA_BIEN_CAM_RE, b.ma)) {
      const [r0, c0] = oKe(b.o[0], b.o[1], (h + 4) % 8);
      if (ch !== "+" || !nhanTruc(kt(r0, c0), h))
        them(pt, `Biển ${b.ma} phải đặt ở ô nơi giao nhau, có đường đi vào theo hướng ${b.huong}.`);
      const k = khoaOH(b.o[0], b.o[1], h);
      camRe.set(k, (camRe.get(k) ?? new Set()).add(MA_BIEN_CAM_RE[b.ma]!));
    } else if ((MA_BIEN_CAM_VAO as readonly string[]).includes(b.ma)) {
      if (!biCamDi(luoi, cam, b.o[0], b.o[1], h))
        them(
          pt,
          `Biển ${b.ma} ở ${tenO(b.o)}: chiều ${b.huong} ở ô này không bị cấm (không phải một chiều ngược, không phải đường cấm).`,
        );
      camVaoCoBien.add(khoaOH(b.o[0], b.o[1], h));
    } else if (b.toc_do !== undefined)
      them(pt, `Biển ${b.ma} không nhận tốc độ; chỉ biển ${MA_BIEN_TOC_DO} có toc_do.`);
  });

  // Mọi lối vào đoạn cấm (từ ô được đi) phải có biển cấm.
  for (let r = 0; r < luoi.length; r++)
    for (let c = 0; c < cot; c++)
      for (const h of [0, 2, 4, 6]) {
        if (!laDuong(kt(r, c)) || !nhanTruc(kt(r, c), h) || !biCamDi(luoi, cam, r, c, h)) continue;
        const [r0, c0] = oKe(r, c, (h + 4) % 8);
        const truoc = kt(r0, c0);
        if (!laDuong(truoc) || !nhanTruc(truoc, h) || biCamDi(luoi, cam, r0, c0, h)) continue;
        if (!camVaoCoBien.has(khoaOH(r, c, h)))
          them(
            `o:${r},${c}`,
            `Lối vào ô ${tenO([r, c])} theo hướng ${TEN_THEO_HUONG[h]} bị cấm nhưng chưa có biển P.102 hoặc P.101.`,
          );
      }

  // Vạch người đi bộ, người đi bộ.
  const vach = new Set<string>();
  (p.vach_di_bo ?? []).forEach((v, i) => {
    if (!v || !trong(v.o) || !laDuong(kt(v.o[0], v.o[1])) || kt(v.o[0], v.o[1]) === "+")
      them("ban_do", `Vạch người đi bộ ${i + 1} phải ở đoạn đường, không ở nơi giao nhau.`);
    else if (vach.has(khoaO(v.o[0], v.o[1]))) them("ban_do", `Ô ${tenO(v.o)} có hai vạch người đi bộ.`);
    else vach.add(khoaO(v.o[0], v.o[1]));
  });
  const idNguoi = new Set<string>();
  for (const n of p.nguoi_di_bo ?? []) {
    const pt = `nguoi:${n?.id}`;
    if (!n || typeof n.id !== "string" || !n.id || n.id.length > 20 || idNguoi.has(n.id)) {
      them("ban_do", "Người đi bộ cần mã (id) riêng, tối đa 20 ký tự.");
      continue;
    }
    idNguoi.add(n.id);
    if (!trong(n.o) || !vach.has(khoaO(n.o[0], n.o[1])))
      them(pt, `Người đi bộ ${n.id} phải ở ô có vạch người đi bộ.`);
    else if (!laTenHuong(n.di) || nhanTruc(kt(n.o[0], n.o[1]), HUONG_THEO_TEN[n.di]))
      them(pt, `Người đi bộ ${n.id}: hướng đi (di) phải cắt ngang đường.`);
    const coLuc = n.luc !== undefined;
    const coCach = n.khi_xe_cach !== undefined;
    if (coLuc === coCach)
      them(pt, `Người đi bộ ${n.id}: cần đúng một trong hai: luc (giây) hoặc khi_xe_cach (m).`);
    if (coLuc && !soNguyenTrong(n.luc, 0, 300)) them(pt, `Người đi bộ ${n.id}: luc phải từ 0 đến 300 giây.`);
    if (coCach && !soNguyenTrong(n.khi_xe_cach, 5, 60))
      them(pt, `Người đi bộ ${n.id}: khi_xe_cach phải từ 5 đến 60 m.`);
  }

  // Luồng xe.
  const idXe = new Set<string>();
  let tongXe = 0;
  for (const x of p.xe_khac ?? []) {
    const pt = `xe:${x?.id}`;
    if (!x || typeof x.id !== "string" || !x.id || x.id.length > 20 || idXe.has(x.id)) {
      them("ban_do", "Luồng xe cần mã (id) riêng, tối đa 20 ký tự.");
      continue;
    }
    idXe.add(x.id);
    if (x.loai !== "o_to" && x.loai !== "xe_tai" && x.loai !== "xe_may")
      them(pt, `Luồng ${x.id}: loại xe không có.`);
    if (!soNguyenTrong(x.so_xe, 1, 20)) them(pt, `Luồng ${x.id}: số xe phải từ 1 đến 20.`);
    else tongXe += x.so_xe;
    if (!soNguyenTrong(x.bat_dau, 0, 240)) them(pt, `Luồng ${x.id}: bat_dau phải từ 0 đến 240 giây.`);
    if (!soNguyenTrong(x.cach, 3, 120)) them(pt, `Luồng ${x.id}: hai xe phải cách nhau 3–120 giây.`);
    if (!soNguyenTrong(x.toc_do, 10, 60)) them(pt, `Luồng ${x.id}: tốc độ phải từ 10 đến 60 km/h.`);
    const lt = kiemTuyen(luoi, cam, camRe, x.tuyen);
    if (lt) them(pt, `Luồng ${x.id}: ${lt}`);
  }
  if (tongXe > SO_XE_TOI_DA) them("ban_do", `Tổng số xe khác tối đa ${SO_XE_TOI_DA}, đang có ${tongXe}.`);

  // Có đường đi đúng luật từ xuất phát tới đích.
  if (xpHopLe && dichHopLe && !loi.length && !coDuongDiDung(luoi, cam, camRe, xp!, dich!.o))
    them("ban_do", "Không có đường đi đúng luật từ điểm xuất phát tới đích.");
  return loi;
}

/** Kiểm tuyến của một luồng xe; trả lý do sai hoặc null. */
function kiemTuyen(
  luoi: readonly string[],
  cam: ReadonlySet<string>,
  camRe: ReadonlyMap<string, ReadonlySet<string>>,
  tuyen: unknown,
): string | null {
  if (!Array.isArray(tuyen) || tuyen.length < 2 || !tuyen.every(laO)) return "tuyến cần ít nhất 2 ô.";
  const hang = luoi.length;
  const cot = luoi[0]!.length;
  const bien = (o: OLuoi) => o[0] === 0 || o[1] === 0 || o[0] === hang - 1 || o[1] === cot - 1;
  if (!bien(tuyen[0]!) || !bien(tuyen.at(-1)!)) return "ô đầu và ô cuối của tuyến phải ở mép bản đồ.";
  let hTruoc: number | null = null;
  for (let i = 1; i < tuyen.length; i++) {
    const [r0, c0] = tuyen[i - 1]!;
    const [r1, c1] = tuyen[i]!;
    if (r0 !== r1 && c0 !== c1) return `ô ${tenO([r0, c0])} và ${tenO([r1, c1])} không cùng hàng, cùng cột.`;
    const h = huongDoan(c1 - c0, r1 - r0);
    if (h === null) return `hai ô liền nhau trùng nhau (${tenO([r0, c0])}).`;
    if (hTruoc !== null) {
      const lech = (h - hTruoc + 8) % 8;
      if (lech === 4) return `tuyến quay đầu ở ${tenO([r0, c0])}.`;
      if (lech !== 0) {
        if (kyTuO(luoi, r0, c0) !== "+") return `tuyến rẽ ở ${tenO([r0, c0])} không phải nơi giao nhau.`;
        if (camRe.get(khoaOH(r0, c0, hTruoc))?.has(lech === 2 ? "phai" : "trai"))
          return `tuyến rẽ nơi có biển cấm rẽ ở ${tenO([r0, c0])}.`;
      } else if (kyTuO(luoi, r0, c0) === "+" && i > 1 && camRe.get(khoaOH(r0, c0, h))?.has("thang"))
        return `tuyến đi thẳng nơi cấm đi thẳng ở ${tenO([r0, c0])}.`;
    }
    const [dx, dy] = BUOC_HUONG[h];
    for (let r = r0, c = c0; ; r += dy, c += dx) {
      const ch = kyTuO(luoi, r, c);
      if (!laDuong(ch) || !nhanTruc(ch, h)) return `ô ${tenO([r, c])} không có đường theo chiều của tuyến.`;
      if (biCamDi(luoi, cam, r, c, h)) return `tuyến đi ngược chiều hoặc vào đường cấm ở ${tenO([r, c])}.`;
      if (r === r1 && c === c1) break;
    }
    hTruoc = h;
  }
  const cuoi = tuyen.at(-1)!;
  const dau = tuyen[0]!;
  if (kyTuO(luoi, dau[0], dau[1]) === "+" || kyTuO(luoi, cuoi[0], cuoi[1]) === "+")
    return "ô đầu và ô cuối của tuyến không được là nơi giao nhau.";
  return null;
}

/** Tìm đường (theo ô và chiều) từ xuất phát tới đích mà không đi ngược chiều, không vào đường cấm, không rẽ nơi cấm rẽ. */
function coDuongDiDung(
  luoi: readonly string[],
  cam: ReadonlySet<string>,
  camRe: ReadonlyMap<string, ReadonlySet<string>>,
  xp: { o: OLuoi; huong: TenHuong },
  dich: OLuoi,
): boolean {
  const da = new Set<string>();
  const hang: Array<[number, number, number]> = [[xp.o[0], xp.o[1], HUONG_THEO_TEN[xp.huong]]];
  while (hang.length) {
    const [r, c, h] = hang.shift()!;
    const k = khoaOH(r, c, h);
    if (da.has(k)) continue;
    da.add(k);
    if (r === dich[0] && c === dich[1]) return true;
    const ch = kyTuO(luoi, r, c);
    const buoc: Array<[number, "thang" | "trai" | "phai" | "quay"]> = [[h, "thang"]];
    if (ch === "+") buoc.push([(h + 6) % 8, "trai"], [(h + 2) % 8, "phai"]);
    else if (laHaiChieu(ch)) buoc.push([(h + 4) % 8, "quay"]);
    for (const [h2, kieu] of buoc) {
      if (ch === "+" && kieu !== "quay" && camRe.get(k)?.has(kieu)) continue;
      if (kieu === "quay") {
        hang.push([r, c, h2]);
        continue;
      }
      const [r2, c2] = oKe(r, c, h2);
      const ke = kyTuO(luoi, r2, c2);
      if (!laDuong(ke) || !nhanTruc(ke, h2) || biCamDi(luoi, cam, r2, c2, h2)) continue;
      hang.push([r2, c2, h2]);
    }
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Thế giới (phần cố định của một lượt)                                */
/* ------------------------------------------------------------------ */

interface GiaoTrenLan {
  khoa: string;
  r: number;
  c: number;
  /** Quãng đường (cm) trên làn tới mép vào, mép ra của ô. */
  s_vao: number;
  s_ra: number;
  truc: TrucDuong;
}

interface VachTrenLan {
  khoa: string;
  s_tu: number;
  s_den: number;
}

interface ChuThichLan {
  lan: LanDaDung;
  giao: GiaoTrenLan[];
  vach: VachTrenLan[];
}

export interface TheGioi {
  bd: PayloadBanDo;
  luoi: readonly string[];
  hang: number;
  cot: number;
  loai: LoaiXeNguoiLai;
  giam: boolean;
  v_max: number;
  /** Nhịp cuối của lượt: giờ của bản đồ (không có ở chế độ giảm chuyển động), tối đa 5 phút. */
  nhip_toi_da: number;
  den: ReadonlyMap<string, DenBanDo>;
  /** "r,c,h" → giới hạn tốc độ (km/h) và chỉ số biển. */
  toc_do: ReadonlyMap<string, { kmh: number; bien: number }>;
  /** "r,c,h" (ô nơi giao nhau, chiều đi vào) → hướng bị cấm và mã biển. */
  cam_re: ReadonlyMap<string, ReadonlyMap<"trai" | "phai" | "thang", string>>;
  /** "r,c,h" → mã biển cấm vào. */
  cam_vao: ReadonlyMap<string, string>;
  duong_cam: ReadonlySet<string>;
  vach: ReadonlySet<string>;
  nguoi_di_bo: readonly NguoiDiBoBanDo[];
  mp: MoPhong;
  lan_xe: ReadonlyMap<string, ChuThichLan>;
  /** Tốc độ tối đa gốc của từng xe tự chạy (mm/nhịp). */
  v_goc: ReadonlyMap<string, number>;
}

function sTrenLan(lan: LanDaDung, p: DiemCm): number {
  for (const d of lan.doan) {
    const h = p.x === d.tu.x && p.y === d.tu.y ? d.huong : huongDoan(p.x - d.tu.x, p.y - d.tu.y);
    if (h !== d.huong) continue;
    const t = Math.max(Math.abs(p.x - d.tu.x), Math.abs(p.y - d.tu.y));
    const truc = Math.max(Math.abs(d.den.x - d.tu.x), Math.abs(d.den.y - d.tu.y));
    if (t > truc) continue;
    return d.s0 + Math.trunc((t * d.dai) / truc);
  }
  throw new Error(`Điểm (${p.x}, ${p.y}) không nằm trên làn ${lan.id}.`);
}

/** Dựng làn M5 (cm) và chú thích (nơi giao nhau, vạch) cho một tuyến đã kiểm. */
function dungLanTuyen(
  id: string,
  tuyen: readonly OLuoi[],
  luoi: readonly string[],
  vach: ReadonlySet<string>,
  tocDo: number,
): ChuThichLan {
  const diem: DiemCm[] = [];
  const oDi: Array<{ r: number; c: number; h: number }> = [];
  let h0 = huongDoan(tuyen[1]![1] - tuyen[0]![1], tuyen[1]![0] - tuyen[0]![0])!;
  diem.push(cuaVao(tuyen[0]![0], tuyen[0]![1], h0, 1));
  for (let i = 1; i < tuyen.length; i++) {
    const [r0, c0] = tuyen[i - 1]!;
    const [r1, c1] = tuyen[i]!;
    const h = huongDoan(c1 - c0, r1 - r0)!;
    if (i > 1 && h !== h0) diem.push(...duongRe(r0, c0, h0, 1, h));
    const [dx, dy] = BUOC_HUONG[h];
    for (let r = r0 + (i > 1 ? dy : 0), c = c0 + (i > 1 ? dx : 0); ; r += dy, c += dx) {
      oDi.push({ r, c, h });
      if (r === r1 && c === c1) break;
    }
    h0 = h;
  }
  const cuoi = tuyen.at(-1)!;
  diem.push(cuaRa(cuoi[0], cuoi[1], h0, 1));
  // Bỏ điểm trùng liền nhau (mép ra của đường rẽ có thể trùng điểm sau).
  const gon = diem.filter((p, i) => i === 0 || p.x !== diem[i - 1]!.x || p.y !== diem[i - 1]!.y);
  const lan = dungLan({ id, diem: gon, toc_do_toi_da: tocDo });
  const giao: GiaoTrenLan[] = [];
  const vachLan: VachTrenLan[] = [];
  for (let i = 0; i < oDi.length; i++) {
    const { r, c, h } = oDi[i]!;
    const ch = kyTuO(luoi, r, c);
    if (ch === "+") {
      const hRa = oDi[i + 1]?.h ?? h;
      giao.push({
        khoa: khoaO(r, c),
        r,
        c,
        s_vao: sTrenLan(lan, cuaVao(r, c, h, 1)),
        s_ra: sTrenLan(lan, cuaRa(r, c, hRa, 1)),
        truc: trucCua(h),
      });
    } else if (vach.has(khoaO(r, c))) {
      const t = diemLan(r, c, h, 1);
      const [dx, dy] = BUOC_HUONG[h as Huong];
      vachLan.push({
        khoa: khoaO(r, c),
        s_tu: sTrenLan(lan, { x: t.x - dx * NUA_VACH, y: t.y - dy * NUA_VACH }),
        s_den: sTrenLan(lan, { x: t.x + dx * NUA_VACH, y: t.y + dy * NUA_VACH }),
      });
    }
  }
  return { lan, giao, vach: vachLan };
}

/** Dựng thế giới của một lượt. Bản đồ phải đã qua `kiemTraBanDo` (không thì ném lỗi). */
export function dungTheGioi(bd: PayloadBanDo, loai: LoaiXeNguoiLai, giam: boolean): TheGioi {
  const loi = kiemTraBanDo(bd);
  if (loi.length) throw new Error(`Bản đồ không hợp lệ: ${loi.map((l) => l.loi).join(" ")}`);
  const luoi = bd.o;
  const den = new Map(bd.den.map((d) => [khoaO(d.o[0], d.o[1]), d]));
  const duongCam = new Set((bd.duong_cam ?? []).map((o) => khoaO(o[0], o[1])));
  const vach = new Set(bd.vach_di_bo.map((v) => khoaO(v.o[0], v.o[1])));

  // Vùng tốc độ: từ ô đặt biển theo chiều đi tới trước nơi giao nhau (hoặc biển tốc độ khác).
  const tocDo = new Map<string, { kmh: number; bien: number }>();
  const coBienTocDo = new Set(
    bd.bien
      .filter((b) => b.ma === MA_BIEN_TOC_DO)
      .map((b) => khoaOH(b.o[0], b.o[1], HUONG_THEO_TEN[b.huong])),
  );
  bd.bien.forEach((b, i) => {
    if (b.ma !== MA_BIEN_TOC_DO) return;
    const h = HUONG_THEO_TEN[b.huong];
    let [r, c] = b.o;
    for (let dau = true; ; dau = false) {
      const ch = kyTuO(luoi, r, c);
      if (!laDuong(ch) || ch === "+" || !nhanTruc(ch, h)) break;
      if (!dau && coBienTocDo.has(khoaOH(r, c, h))) break;
      tocDo.set(khoaOH(r, c, h), { kmh: b.toc_do!, bien: i });
      [r, c] = oKe(r, c, h);
    }
  });

  const camRe = new Map<string, Map<"trai" | "phai" | "thang", string>>();
  const camVao = new Map<string, string>();
  for (const b of bd.bien) {
    const k = khoaOH(b.o[0], b.o[1], HUONG_THEO_TEN[b.huong]);
    if (Object.hasOwn(MA_BIEN_CAM_RE, b.ma)) {
      const m = camRe.get(k) ?? new Map();
      m.set(MA_BIEN_CAM_RE[b.ma]!, b.ma);
      camRe.set(k, m);
    } else if ((MA_BIEN_CAM_VAO as readonly string[]).includes(b.ma)) camVao.set(k, b.ma);
  }

  // Xe khác: mỗi luồng một làn M5.
  const lanXe = new Map<string, ChuThichLan>();
  const xe: XeKhoiTao[] = [];
  const vGoc = new Map<string, number>();
  for (const l of bd.xe_khac) {
    const v = mmNhip(l.toc_do);
    const ct = dungLanTuyen(`lan-${l.id}`, l.tuyen, luoi, vach, v);
    lanXe.set(ct.lan.id, ct);
    for (let i = 0; i < l.so_xe; i++) {
      const id = `${l.id}-${String(i + 1).padStart(2, "0")}`;
      xe.push({ id, loai: l.loai, lan: ct.lan.id, nhip_vao: (l.bat_dau + i * l.cach) * 20 });
      vGoc.set(id, v);
    }
  }
  const mp = dungMoPhong({
    lan: [...lanXe.values()].map((ct) => ({
      id: ct.lan.id,
      diem: ct.lan.doan.map((d) => d.tu).concat([ct.lan.doan.at(-1)!.den]),
      toc_do_toi_da: ct.lan.toc_do_toi_da,
    })),
    dac_diem: [],
    bien: [],
    xe,
  });

  const nhipGio = !giam && bd.gio_giay ? bd.gio_giay * 20 : NHIP_TOI_DA;
  return {
    bd,
    luoi,
    hang: luoi.length,
    cot: luoi[0]!.length,
    loai,
    giam,
    v_max: vMaxXe(loai, giam),
    nhip_toi_da: Math.min(NHIP_TOI_DA, nhipGio),
    den,
    toc_do: tocDo,
    cam_re: camRe,
    cam_vao: camVao,
    duong_cam: duongCam,
    vach,
    nguoi_di_bo: [...bd.nguoi_di_bo].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    mp,
    lan_xe: lanXe,
    v_goc: vGoc,
  };
}

/* ------------------------------------------------------------------ */
/* Trạng thái                                                          */
/* ------------------------------------------------------------------ */

export type HuongLai = "trai" | "phai";
export type ThaoTacDangLam = "re" | "doi_lan" | "quay_dau";

export interface NguoiChoiPho {
  xe: XeNguoiLai;
  /** Chiều đi theo đường (hướng chính), kể cả khi đang chuyển làn. */
  h_duong: Huong;
  thao_tac: ThaoTacDangLam | null;
  /** Hướng định rẽ ở nơi giao nhau tới. */
  y_dinh: HuongLai | null;
  xi_nhan: HuongLai | null;
  ga: boolean;
  phanh: boolean;
  /** Ô đang chứa đầu xe. */
  o: [number, number];
  /** Đang qua nơi giao nhau: ô, chiều đi vào, đã qua vạch dừng chưa. */
  giao: { r: number; c: number; h: number; qua_vach: boolean } | null;
}

export interface NguoiDiBoPho {
  id: string;
  tt: "cho" | "di" | "xong";
  /** Đã đi được (mm) từ mép vỉa hè bên xuất phát. */
  p: number;
}

export const LOAI_LOI_LAI = [
  "vuot_den_do",
  "qua_toc_do",
  "sai_lan",
  "khong_nhuong_nguoi_di_bo",
  "re_khong_xi_nhan",
  "vao_duong_cam",
  "re_cam",
  "khong_nhuong_duong",
  "va_cham",
] as const;
export type LoaiLoiLai = (typeof LOAI_LOI_LAI)[number];

export interface LoiLai {
  loai: LoaiLoiLai;
  /** Nhịp bắt đầu vi phạm (để phát lại). */
  nhip: number;
  /** Chỗ xảy ra, cm. */
  x: number;
  y: number;
  /** Người chơi đã làm gì, cụ thể. */
  chi_tiet: string;
  /** Quá tốc độ: tốc độ cao nhất và giới hạn (km/h). */
  toc_do?: number;
  gioi_han?: number;
  /** Mã biển liên quan, nếu có. */
  bien?: string;
}

export interface TrangThaiPho {
  nhip: number;
  nguoi: NguoiChoiPho;
  mp: TrangThaiMoPhong;
  /**
   * Xe tự chạy chưa tới giờ vào đường, xếp theo giờ vào: để ngoài trạng thái M5 cho tới giờ vào, để
   * M5 không phải duyệt cả chục xe đang chờ ở mỗi nhịp.
   */
  cho_vao: Xe[];
  di_bo: NguoiDiBoPho[];
  /** Ô nơi giao nhau → id xe tự chạy đang giữ lượt. */
  giu_cho: Record<string, string>;
  /** "xe@ô": xe tự chạy được đi tiếp vì đèn chuyển khi không kịp dừng. */
  duoc_qua: string[];
  /** Xe tự chạy va chạm → nhịp được kéo khỏi đường. */
  xe_hong: Record<string, number>;
  loi: LoiLai[];
  /** Đang quá tốc độ: số nhịp liên tiếp, nhịp bắt đầu, tốc độ cao nhất, giới hạn, chỉ số lỗi đã ghi. */
  qua_toc_do: {
    dem: number;
    tu: number;
    max: number;
    gioi_han: number;
    x: number;
    y: number;
    loi: number | null;
  } | null;
  sai_lan: boolean;
  trong_duong_cam: boolean;
  /** Xe, người đã va chạm (không ghi lỗi hai lần). */
  da_va: string[];
  /** Vết đầu xe người chơi (cm), mỗi NHIP_VET nhịp: x0, y0, x1, y1… */
  vet: number[];
  ket_thuc: null | "den_dich" | "het_gio" | "dung";
}

const oCuaMm = (x: number, y: number): [number, number] => [
  Math.floor(y / (O * 10)),
  Math.floor(x / (O * 10)),
];

export function trangThaiDauPho(the: TheGioi): TrangThaiPho {
  const { o, huong } = the.bd.xuat_phat;
  const h = HUONG_THEO_TEN[huong];
  // Đầu xe ở tâm ô: thân xe (tối đa 4,5 m) nằm trong ô.
  const t = diemLan(o[0], o[1], h, 1);
  const x = t.x * 10;
  const y = t.y * 10;
  const mp = trangThaiDau(the.mp);
  return {
    nhip: 0,
    nguoi: {
      xe: { loai: the.loai, x, y, huong: h, v: 0, moc: [] },
      h_duong: h,
      thao_tac: null,
      y_dinh: null,
      xi_nhan: null,
      ga: false,
      phanh: false,
      o: oCuaMm(x, y),
      giao: null,
    },
    mp: { ...mp, xe: [], xong: false },
    cho_vao: [...mp.xe].sort((a, b) => a.nhip_vao - b.nhip_vao || (a.id < b.id ? -1 : 1)),
    di_bo: the.nguoi_di_bo.map((n) => ({ id: n.id, tt: "cho", p: 0 })),
    giu_cho: {},
    duoc_qua: [],
    xe_hong: {},
    loi: [],
    qua_toc_do: null,
    sai_lan: false,
    trong_duong_cam: false,
    da_va: [],
    vet: [Math.trunc(x / 10), Math.trunc(y / 10)],
    ket_thuc: null,
  };
}

/* ------------------------------------------------------------------ */
/* Hỏi đáp về vị trí                                                   */
/* ------------------------------------------------------------------ */

const kt = (the: TheGioi, r: number, c: number) => kyTuO(the.luoi, r, c);

/** Nơi giao nhau ở phía trước trong O_CHUAN_BI_RE ô (người chơi đang đi thẳng theo đường), hoặc null. */
export function giaoPhiaTruoc(the: TheGioi, n: NguoiChoiPho): [number, number] | null {
  if (n.thao_tac || n.giao) return null;
  const [r0, c0] = n.o;
  if (kt(the, r0, c0) === "+") return null;
  let [r, c] = [r0, c0];
  for (let i = 0; i < O_CHUAN_BI_RE; i++) {
    [r, c] = oKe(r, c, n.h_duong);
    const ch = kt(the, r, c);
    if (ch === "+") return [r, c];
    if (!laDuong(ch) || !nhanTruc(ch, n.h_duong)) return null;
  }
  return null;
}

/** Hướng ra ở nơi giao nhau (r, c) khi đi vào theo `h` với ý định `yd`: rẽ, đi thẳng, hoặc null (không đi được). */
export function huongRaGiao(
  the: TheGioi,
  r: number,
  c: number,
  h: number,
  yd: HuongLai | null,
): { kieu: "trai" | "phai" | "thang"; h2: number } | null {
  if (yd) {
    const h2 = yd === "trai" ? (h + 6) % 8 : (h + 2) % 8;
    const [r2, c2] = oKe(r, c, h2);
    if (laDuong(kt(the, r2, c2)) && nhanTruc(kt(the, r2, c2), h2)) return { kieu: yd, h2 };
  }
  const [r1, c1] = oKe(r, c, h);
  if (laDuong(kt(the, r1, c1)) && nhanTruc(kt(the, r1, c1), h)) return { kieu: "thang", h2: h };
  return null;
}

/** Độ lệch ngang (cm) của đầu xe so với tim đường, dương là lệch sang phải theo chiều `h`. */
function lechNgang(n: NguoiChoiPho, h: number): number {
  const [r, c] = n.o;
  const t = tamO(r, c);
  const [px, py] = benPhai(h);
  return Math.trunc((n.xe.x / 10 - t.x) * px + (n.xe.y / 10 - t.y) * py);
}

/** Còn bao nhiêu mm đường đi được phía trước (tính tới ô đầu tiên không đi thẳng được, tối đa 2 ô). */
function conDuongPhiaTruoc(the: TheGioi, n: NguoiChoiPho): number {
  const h = n.h_duong;
  const [r, c] = n.o;
  const [dx, dy] = BUOC_HUONG[h];
  const mep =
    dx !== 0
      ? dx > 0
        ? (c + 1) * O * 10 - n.xe.x
        : n.xe.x - c * O * 10
      : dy > 0
        ? (r + 1) * O * 10 - n.xe.y
        : n.xe.y - r * O * 10;
  const [r1, c1] = oKe(r, c, h);
  const ke = kt(the, r1, c1);
  if (!laDuong(ke) || !nhanTruc(ke, h) || ke === "+") return mep;
  return mep + O * 10;
}

/** Vị trí người đi bộ (cm). */
export function viTriNguoiDiBo(n: NguoiDiBoBanDo, p: number): DiemCm {
  const t = tamO(n.o[0], n.o[1]);
  const h = HUONG_THEO_TEN[n.di];
  const [dx, dy] = BUOC_HUONG[h];
  const dau = { x: t.x - (dx * O) / 2 + dx * 100, y: t.y - (dy * O) / 2 + dy * 100 };
  return { x: dau.x + Math.trunc((dx * p) / 10), y: dau.y + Math.trunc((dy * p) / 10) };
}

/** Người đi bộ đang ở trên mặt đường (không còn trên vỉa hè). */
const trenMatDuong = (p: number) => p > (VIA - 100) * 10 && p < (O - VIA - 100) * 10;

/** Hộp bao của xe người chơi (cm). */
export function hopBaoNguoiChoi(xe: XeNguoiLai): HopBao {
  return hopBao({
    x: Math.trunc(xe.x / 10),
    y: Math.trunc(xe.y / 10),
    huong: xe.huong,
    loai: xe.loai as LoaiXe,
  });
}

const hopNguoi = (p: DiemCm): HopBao => ({ x1: p.x - 30, y1: p.y - 30, x2: p.x + 30, y2: p.y + 30 });
const noRong = (b: HopBao, m: number): HopBao => ({ x1: b.x1 - m, y1: b.y1 - m, x2: b.x2 + m, y2: b.y2 + m });
const chuaDiem = (b: HopBao, p: DiemCm) => p.x >= b.x1 && p.x <= b.x2 && p.y >= b.y1 && p.y <= b.y2;
const hopO = (r: number, c: number, thu = 0): HopBao => ({
  x1: c * O + thu,
  y1: r * O + thu,
  x2: (c + 1) * O - thu,
  y2: (r + 1) * O - thu,
});
/** Dải vạch người đi bộ trên mặt đường (cm). */
function hopVach(the: TheGioi, r: number, c: number): HopBao {
  const t = tamO(r, c);
  return trucDuongO(kt(the, r, c)) === "ngang"
    ? { x1: t.x - NUA_VACH, x2: t.x + NUA_VACH, y1: r * O + VIA, y2: (r + 1) * O - VIA }
    : { y1: t.y - NUA_VACH, y2: t.y + NUA_VACH, x1: c * O + VIA, x2: (c + 1) * O - VIA };
}
const trucDuongO = (ch: string): TrucDuong => (ch === "-" || ch === "<" || ch === ">" ? "ngang" : "doc");

const conTrenDuong = (x: { trang_thai: string }) => x.trang_thai !== "cho" && x.trang_thai !== "da_qua";

/**
 * Quãng đường (cm) đầu tiên trong [sTu, sDen] mà tim làn đi vào hộp `b`, hoặc null. Tính theo từng
 * đoạn thẳng của làn (giao khoảng tham số theo x và theo y), không lấy mẫu. Phép chia số thực là
 * phép IEEE làm tròn đúng nên cho cùng kết quả trên mọi bộ máy JavaScript.
 */
function sVaoHop(lan: LanDaDung, sTu: number, sDen: number, b: HopBao): number | null {
  for (const d of lan.doan) {
    if (d.s0 + d.dai < sTu) continue;
    if (d.s0 > sDen) break;
    const [bx, by] = BUOC_HUONG[d.huong];
    const truc = Math.max(Math.abs(d.den.x - d.tu.x), Math.abs(d.den.y - d.tu.y));
    let lo = Math.max(0, ((sTu - d.s0) * truc) / d.dai);
    let hi = Math.min(truc, ((sDen - d.s0) * truc) / d.dai);
    for (const [b0, p0, m1, m2] of [
      [bx, d.tu.x, b.x1, b.x2],
      [by, d.tu.y, b.y1, b.y2],
    ] as const) {
      if (b0 === 0) {
        if (p0 < m1 || p0 > m2) hi = -1;
      } else {
        const t1 = (m1 - p0) / b0;
        const t2 = (m2 - p0) / b0;
        lo = Math.max(lo, Math.min(t1, t2));
        hi = Math.min(hi, Math.max(t1, t2));
      }
    }
    if (lo <= hi) return d.s0 + Math.ceil((lo * d.dai) / truc);
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Thao tác của người chơi                                             */
/* ------------------------------------------------------------------ */

export type ThaoTacLai =
  | { thao_tac: "ga"; tham_so: boolean }
  | { thao_tac: "phanh"; tham_so: boolean }
  | { thao_tac: "lai"; tham_so: HuongLai }
  | { thao_tac: "xi_nhan"; tham_so: HuongLai | null };

const moMm = (p: DiemCm): DiemMm => ({ x: p.x * 10, y: p.y * 10 });

function ghiLoi(
  tt: TrangThaiPho,
  l: Omit<LoiLai, "nhip" | "x" | "y"> & Partial<Pick<LoiLai, "nhip" | "x" | "y">>,
) {
  tt.loi = [
    ...tt.loi,
    {
      nhip: l.nhip ?? tt.nhip,
      x: l.x ?? Math.trunc(tt.nguoi.xe.x / 10),
      y: l.y ?? Math.trunc(tt.nguoi.xe.y / 10),
      ...l,
    } as LoiLai,
  ];
}

const TEN_HUONG_LAI: Record<HuongLai, string> = { trai: "trái", phai: "phải" };

/** Kiểm xi nhan khi bắt đầu chuyển hướng; ghi lỗi nếu chưa bật đúng bên. */
function kiemXiNhan(tt: TrangThaiPho, ben: HuongLai, viec: string) {
  if (tt.nguoi.xi_nhan === ben) return;
  ghiLoi(tt, {
    loai: "re_khong_xi_nhan",
    chi_tiet: tt.nguoi.xi_nhan
      ? `${viec} nhưng bật xi nhan bên ${TEN_HUONG_LAI[tt.nguoi.xi_nhan]}.`
      : `${viec} mà không bật xi nhan.`,
  });
}

/**
 * Áp một thao tác lên trạng thái (trả trạng thái mới). Không đổi vị trí xe: mọi chuyển động đi qua
 * `buocPho`, nên áp thao tác ở cuối nhật ký không làm lệch trạng thái giữa máy chủ và điện thoại.
 */
export function apThaoTacLai(the: TheGioi, tt: TrangThaiPho, t: ThaoTacLai): TrangThaiPho {
  if (tt.ket_thuc) return tt;
  const n: NguoiChoiPho = { ...tt.nguoi, xe: { ...tt.nguoi.xe, moc: [...tt.nguoi.xe.moc] } };
  const moi: TrangThaiPho = { ...tt, nguoi: n };
  switch (t.thao_tac) {
    case "ga":
      n.ga = t.tham_so;
      return moi;
    case "phanh":
      n.phanh = t.tham_so;
      return moi;
    case "xi_nhan":
      n.xi_nhan = t.tham_so;
      return moi;
    case "lai":
      break;
  }
  const ben = t.tham_so;
  if (n.thao_tac || n.giao) return tt;
  const truoc = giaoPhiaTruoc(the, n);
  if (truoc) {
    n.y_dinh = n.y_dinh === ben ? null : ben;
    return moi;
  }
  const [r, c] = n.o;
  const ch = kt(the, r, c);
  if (!laDuong(ch) || ch === "+") return tt;
  const h = n.h_duong;
  const [dx, dy] = BUOC_HUONG[h];
  const [px, py] = benPhai(h);
  const lech = lechNgang(n, h) >= 0 ? 1 : -1;
  const con = conDuongPhiaTruoc(the, n);

  // Mốc tính bằng mm từ đúng vị trí đầu xe (không làm tròn về cm), kéo ngang về tim làn nếu lệch.
  const f: DiemMm = { x: n.xe.x, y: n.xe.y };
  const veTim = (l: number): DiemMm => {
    const tim = diemLan(r, c, h, l);
    return dx === 0 ? { x: tim.x * 10, y: f.y } : { x: f.x, y: tim.y * 10 };
  };
  const bo = (ds: DiemMm[]) => ds.filter((p, i) => i > 0 || p.x !== f.x || p.y !== f.y);

  // Quay đầu: đứng yên, nút trái, đường hai chiều.
  if (n.xe.v === 0 && ben === "trai" && laHaiChieu(ch)) {
    if (con < 1500) return tt;
    const k = 1000;
    const goc = veTim(1);
    const ngang = LECH_LAN * 20 - 2 * k;
    const a = { x: goc.x + dx * k - px * k, y: goc.y + dy * k - py * k };
    const b = { x: a.x - px * ngang, y: a.y - py * ngang };
    const e = { x: b.x - dx * k - px * k, y: b.y - dy * k - py * k };
    const f2 = { x: e.x - dx * 500, y: e.y - dy * 500 };
    kiemXiNhan(moi, "trai", "Quay đầu xe");
    n.xe.moc = bo([goc, a, b, e, f2]);
    n.thao_tac = "quay_dau";
    n.h_duong = ((h + 4) % 8) as Huong;
    return moi;
  }

  // Chuyển làn giữa phố.
  const dich = ben === "phai" ? 1 : -1;
  if (lech === dich || con < 5000) return tt;
  kiemXiNhan(moi, ben, `Chuyển sang làn bên ${TEN_HUONG_LAI[ben]}`);
  const goc = veTim(lech);
  const ngang = LECH_LAN * 20;
  const b = { x: goc.x + dx * ngang + px * ngang * dich, y: goc.y + dy * ngang + py * ngang * dich };
  const c2 = { x: b.x + dx * 1000, y: b.y + dy * 1000 };
  n.xe.moc = bo([goc, b, c2]);
  n.thao_tac = "doi_lan";
  return moi;
}

/* ------------------------------------------------------------------ */
/* Xe tự chạy                                                          */
/* ------------------------------------------------------------------ */

/**
 * Đặt trần tốc độ cho từng xe tự chạy trước nhịp M5: dừng trước đèn đỏ (trừ xe không kịp dừng khi
 * đèn chuyển vàng), trước vạch có người đi bộ, trước vật cản ở làn khác (xe người chơi, xe luồng
 * khác), và chờ lượt vào nơi giao nhau. Sửa `moi` tại chỗ (bản sao của nhịp này).
 */
function dieuKhienXeTuChay(
  the: TheGioi,
  cu: TrangThaiPho,
  moi: TrangThaiPho,
  nhip: number,
): { tran: Map<string, number>; hoan: Set<string> } {
  const tran = new Map<string, number>();
  /** Xe chưa vào đường mà đầu làn đang bị chiếm: hoãn một nhịp. */
  const hoan = new Set<string>();
  const giu = { ...cu.giu_cho };
  const duocQua = new Set(cu.duoc_qua);
  const xe = cu.mp.xe;
  const hopNguoiChoi = hopBaoNguoiChoi(cu.nguoi.xe);
  const tren = xe.filter(conTrenDuong);
  const hop = new Map(tren.map((x) => [x.id, hopBao(x)]));
  const trongO = (b: HopBao, r: number, c: number) => chongNhau(b, hopO(r, c, 50));
  const theoId = new Map(xe.map((x) => [x.id, x]));
  const giaoCua = (x: { lan: string }, k: string) => the.lan_xe.get(x.lan)?.giao.find((v) => v.khoa === k);
  // Vạch đang có người sang.
  const vachCoNguoi = new Set<string>();
  moi.di_bo.forEach((d, i) => {
    if (d.tt === "di") vachCoNguoi.add(khoaO(the.nguoi_di_bo[i]!.o[0], the.nguoi_di_bo[i]!.o[1]));
  });

  // Nhả chỗ: xe đã qua hẳn nơi giao nhau, đã rời đường, hoặc hỏng.
  for (const [k, id] of Object.entries(giu)) {
    const x = theoId.get(id);
    const g = x ? giaoCua(x, k) : undefined;
    if (
      !x ||
      !g ||
      !conTrenDuong(x) ||
      x.trang_thai === "va_cham" ||
      x.s > (g.s_ra + KICH_THUOC_XE[x.loai].dai) * 10
    )
      delete giu[k];
  }
  for (const k of [...duocQua]) {
    const [id, o] = k.split("@");
    const x = theoId.get(id!);
    const g = x ? giaoCua(x, o!) : undefined;
    if (!x || !g || x.s > g.s_ra * 10) duocQua.delete(k);
  }

  // Người chơi đang ở, hoặc đang tới, nơi giao nhau nào.
  const nc = cu.nguoi;
  const giaoNguoiChoi = new Set<string>();
  for (let r = Math.floor(hopNguoiChoi.y1 / O); r <= Math.floor(hopNguoiChoi.y2 / O); r++)
    for (let c = Math.floor(hopNguoiChoi.x1 / O); c <= Math.floor(hopNguoiChoi.x2 / O); c++)
      if (kt(the, r, c) === "+" && trongO(hopNguoiChoi, r, c)) giaoNguoiChoi.add(khoaO(r, c));
  const toi = giaoPhiaTruoc(the, nc);
  if (toi && nc.xe.v > 0) {
    const [dx, dy] = BUOC_HUONG[nc.h_duong];
    const vao = cuaVao(toi[0], toi[1], nc.h_duong, 1);
    const d = dx !== 0 ? (vao.x * 10 - nc.xe.x) * dx : (vao.y * 10 - nc.xe.y) * dy;
    if (d <= NHUONG_NGUOI_CHOI_MM) giaoNguoiChoi.add(khoaO(toi[0], toi[1]));
  }

  const xin: Array<{ id: string; khoa: string; d: number }> = [];
  const dungTai = new Map<string, number>();
  const hanChe = (id: string, d: number) =>
    dungTai.set(id, Math.min(dungTai.get(id) ?? Number.POSITIVE_INFINITY, d));

  for (const x of xe) {
    if (x.trang_thai === "da_qua" || x.trang_thai === "va_cham" || x.trang_thai === "bi_chan") continue;
    const ct = the.lan_xe.get(x.lan)!;
    if (x.trang_thai === "cho") {
      // Chưa vào đường: chờ khi đầu làn bị xe người chơi (hoặc xe luồng khác) chiếm.
      if (nhip < x.nhip_vao) continue;
      const dau = viTriTrenLan(ct.lan, 0);
      const vung = noRong({ x1: dau.x, y1: dau.y, x2: dau.x, y2: dau.y }, 700);
      if (
        chongNhau(vung, hopNguoiChoi) ||
        tren.some((o) => o.lan !== x.lan && chongNhau(vung, hop.get(o.id)!))
      )
        hoan.add(x.id);
      continue;
    }

    // Nơi giao nhau kế tiếp chưa vào.
    const g = ct.giao.find((v) => v.s_vao * 10 > x.s);
    if (g) {
      const dVao = g.s_vao * 10 - x.s;
      const dung = dVao - 500;
      const den = the.den.get(g.khoa);
      let denCho = true;
      if (den) {
        const mau = mauDenPho(den, nhip, g.truc);
        const k = `${x.id}@${g.khoa}`;
        if (mau !== "xanh" && !duocQua.has(k)) {
          if (dung < 0 || (mau === "vang" && x.v * x.v > 2 * PHANH_THUONG * dung)) duocQua.add(k);
          else {
            denCho = false;
            hanChe(x.id, dung);
          }
        }
      }
      // Xin lượt khi đã gần và đèn cho đi; phải dừng đèn thì trả lượt đang giữ.
      if (giu[g.khoa] !== x.id && denCho && dVao <= GIU_CHO_MM) xin.push({ id: x.id, khoa: g.khoa, d: dVao });
      if (!denCho && giu[g.khoa] === x.id) delete giu[g.khoa];
    }

    // Vạch người đi bộ phía trước có người đang sang.
    for (const v of ct.vach) {
      if (v.s_tu * 10 <= x.s) continue;
      if (v.s_tu * 10 - x.s > NHIN_VAT_CAN_CM * 10) break;
      if (vachCoNguoi.has(v.khoa)) hanChe(x.id, (v.s_tu - 100) * 10 - x.s);
      break;
    }

    // Vật cản trên đường đi ở làn khác (xe cùng làn thì M5 tự giữ khoảng cách).
    const sCm = Math.trunc(x.s / 10);
    const vatCan: HopBao[] = [];
    const gan = (b: HopBao) =>
      Math.max(b.x1 - x.x, x.x - b.x2, b.y1 - x.y, x.y - b.y2) <= NHIN_VAT_CAN_CM + 600;
    if (gan(hopNguoiChoi)) vatCan.push(noRong(hopNguoiChoi, 60));
    for (const o of tren)
      if (o.id !== x.id && o.lan !== x.lan && gan(hop.get(o.id)!)) vatCan.push(noRong(hop.get(o.id)!, 60));
    let gap: number | null = null;
    for (const b of vatCan) {
      const s = sVaoHop(ct.lan, sCm + 1, sCm + NHIN_VAT_CAN_CM, b);
      if (s !== null && (gap === null || s < gap)) gap = s;
    }
    if (gap !== null) hanChe(x.id, Math.max(0, (gap - sCm - KHOANG_DUNG_VAT_CAN_CM) * 10));
  }

  // Cấp lượt vào nơi giao nhau: gần nhất trước, cùng khoảng cách thì theo id.
  xin.sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : 1));
  for (const r of xin) {
    const [gr, gc] = r.khoa.split(",").map(Number) as [number, number];
    const trong =
      !giu[r.khoa] &&
      !giaoNguoiChoi.has(r.khoa) &&
      !tren.some((o) => o.id !== r.id && trongO(hop.get(o.id)!, gr, gc));
    if (trong) giu[r.khoa] = r.id;
    else hanChe(r.id, r.d - 500);
  }

  for (const x of xe) {
    const goc = the.v_goc.get(x.id) ?? x.v_max;
    const d = dungTai.get(x.id);
    tran.set(
      x.id,
      d === undefined ? goc : Math.min(goc, Math.floor(Math.sqrt(2 * PHANH_DU_KIEN * Math.max(0, d)))),
    );
  }
  moi.giu_cho = giu;
  moi.duoc_qua = [...duocQua].sort();
  return { tran, hoan };
}

/* ------------------------------------------------------------------ */
/* Một nhịp                                                            */
/* ------------------------------------------------------------------ */

/** Một nhịp của cả khu phố. Trả trạng thái mới, không sửa trạng thái cũ. */
export function buocPho(the: TheGioi, tt: TrangThaiPho): TrangThaiPho {
  if (tt.ket_thuc) return tt;
  const nhip = tt.nhip + 1;
  const moi: TrangThaiPho = { ...tt, nhip };

  // 1. Người đi bộ (theo vị trí xe ở nhịp trước).
  const hopNC = hopBaoNguoiChoi(tt.nguoi.xe);
  const xeTren = tt.mp.xe.filter(conTrenDuong);
  moi.di_bo = tt.di_bo.map((d, i) => {
    const n = the.nguoi_di_bo[i]!;
    if (d.tt === "xong") return d;
    if (d.tt === "di") {
      const p = d.p + TOC_DO_DI_BO;
      return p >= DAI_DI_BO_MM ? { ...d, tt: "xong" as const, p: DAI_DI_BO_MM } : { ...d, p };
    }
    let den = false;
    if (n.luc !== undefined) den = nhip >= n.luc * 20;
    else {
      // Bước ra khi xe người chơi đang đi tới vạch và còn cách `khi_xe_cach` m.
      const nc = tt.nguoi;
      const h = nc.h_duong;
      const [dx, dy] = BUOC_HUONG[h];
      const t = tamO(n.o[0], n.o[1]);
      const cungDuong =
        nhanTruc(kt(the, n.o[0], n.o[1]), h) &&
        (dx !== 0 ? Math.floor(nc.xe.y / (O * 10)) === n.o[0] : Math.floor(nc.xe.x / (O * 10)) === n.o[1]);
      const d2 =
        dx !== 0
          ? (t.x * 10 - NUA_VACH * 10 * dx - nc.xe.x) * dx
          : (t.y * 10 - NUA_VACH * 10 * dy - nc.xe.y) * dy;
      den = cungDuong && !nc.thao_tac && d2 > 0 && d2 <= n.khi_xe_cach! * 1000;
    }
    if (!den) return d;
    // Có xe đang đè lên vạch thì chờ.
    const vach = hopVach(the, n.o[0], n.o[1]);
    if (chongNhau(vach, hopNC) || xeTren.some((x) => chongNhau(vach, hopBao(x)))) return d;
    return { ...d, tt: "di" as const, p: 0 };
  });

  // 2. Xe tự chạy: đưa xe tới giờ vào trạng thái M5, đặt trần tốc độ, rồi một nhịp M5.
  let soVao = 0;
  while (soVao < tt.cho_vao.length && tt.cho_vao[soVao]!.nhip_vao <= nhip) soVao++;
  const cu =
    soVao > 0
      ? {
          ...tt,
          mp: {
            ...tt.mp,
            xe: [...tt.mp.xe, ...tt.cho_vao.slice(0, soVao)].sort((a, b) => (a.id < b.id ? -1 : 1)),
          },
        }
      : tt;
  moi.cho_vao = soVao > 0 ? tt.cho_vao.slice(soVao) : tt.cho_vao;
  const { tran, hoan } = dieuKhienXeTuChay(the, cu, moi, nhip);
  const xeDau = cu.mp.xe.map((x) => {
    if (hoan.has(x.id)) return { ...x, nhip_vao: nhip + 1 };
    const v = tran.get(x.id);
    return v !== undefined && v !== x.v_max ? { ...x, v_max: v } : x;
  });
  const sauM5 = buocMoPhong(the.mp, { ...tt.mp, xe: xeDau, su_kien: [], dung_yen: 0, xong: false });
  const xeHong = { ...tt.xe_hong };
  let xeAi = sauM5.xe.map((x) => {
    if (x.trang_thai === "va_cham" && xeHong[x.id] === undefined) xeHong[x.id] = nhip + NHIP_GO_XE_HONG;
    // Xe va chạm đứng một lúc rồi được kéo khỏi đường, để không chặn phố tới hết lượt.
    return xeHong[x.id] !== undefined && nhip >= xeHong[x.id]!
      ? { ...x, trang_thai: "da_qua" as const, v: 0 }
      : x;
  });
  xeAi = xeAi.filter((x) => x.trang_thai !== "da_qua");

  // 3. Xe người chơi di chuyển.
  const truoc = tt.nguoi;
  let n: NguoiChoiPho = { ...truoc, xe: { ...truoc.xe, moc: [...truoc.xe.moc] } };
  let v = tocDoSau(n.xe.loai, n.xe.v, n, the.v_max);
  if (!n.xe.moc.length && !n.giao) {
    // Không đi thẳng tiếp được (ngõ cụt, ngã ba chưa chọn hướng): dừng trước chỗ hết đường.
    const [r, c] = n.o;
    const [r1, c1] = oKe(r, c, n.h_duong);
    const ke = kt(the, r1, c1);
    const diDuoc =
      laDuong(ke) &&
      nhanTruc(ke, n.h_duong) &&
      (ke !== "+" || huongRaGiao(the, r1, c1, n.h_duong, n.y_dinh) !== null);
    if (!diDuoc) {
      const [dx, dy] = BUOC_HUONG[n.h_duong];
      const mep =
        dx !== 0
          ? dx > 0
            ? (c + 1) * O * 10 - n.xe.x
            : n.xe.x - c * O * 10
          : dy > 0
            ? (r + 1) * O * 10 - n.xe.y
            : n.xe.y - r * O * 10;
      v = Math.min(v, Math.max(0, mep - DUNG_TRUOC_CUT_MM));
    }
  }
  n.xe = { ...diChuyen({ ...n.xe, v }, v), v };
  n.o = oCuaMm(n.xe.x, n.xe.y);

  // 4. Va chạm với xe tự chạy, người đi bộ: xe người chơi dừng lại ở chỗ trước khi chạm.
  {
    const hNC = hopBaoNguoiChoi(n.xe);
    let va = false;
    const daVa = [...tt.da_va];
    const hong: string[] = [];
    for (const x of xeAi) {
      if (!conTrenDuong(x) || !chongNhau(hNC, hopBao(x))) continue;
      va = true;
      if (daVa.includes(x.id)) continue;
      daVa.push(x.id);
      hong.push(x.id);
      ghiLoi(moi, {
        loai: "va_cham",
        chi_tiet: `Va chạm với ${x.loai === "xe_may" ? "xe mô tô" : x.loai === "xe_tai" ? "xe tải" : "xe ô tô"}.`,
      });
    }
    if (hong.length) {
      xeAi = xeAi.map((o) => (hong.includes(o.id) ? { ...o, trang_thai: "va_cham" as const, v: 0 } : o));
      for (const id of hong) xeHong[id] = nhip + NHIP_GO_XE_HONG;
    }
    moi.di_bo = moi.di_bo.map((d, i) => {
      if (d.tt !== "di" || !chongNhau(hNC, hopNguoi(viTriNguoiDiBo(the.nguoi_di_bo[i]!, d.p)))) return d;
      va = true;
      if (!daVa.includes(`nguoi:${d.id}`)) {
        daVa.push(`nguoi:${d.id}`);
        ghiLoi(moi, { loai: "va_cham", chi_tiet: "Va chạm với người đi bộ." });
      }
      return { ...d, tt: "xong" as const };
    });
    moi.da_va = daVa;
    if (va) n = { ...truoc, xe: { ...truoc.xe, v: 0 } };
  }
  moi.nguoi = n;
  moi.xe_hong = xeHong;
  moi.mp = { ...sauM5, xe: xeAi, su_kien: [] };

  // Xong rẽ, chuyển làn, quay đầu: tắt xi nhan như xe thật.
  if (!n.xe.moc.length && n.thao_tac) {
    if (n.thao_tac === "re" || n.thao_tac === "quay_dau") n.h_duong = n.xe.huong;
    n.thao_tac = null;
    n.xi_nhan = null;
  }

  // 5. Vào ô mới.
  const oCu = truoc.o;
  if (n.o[0] !== oCu[0] || n.o[1] !== oCu[1]) {
    const [r, c] = n.o;
    const ch = kt(the, r, c);
    const chCu = kt(the, oCu[0], oCu[1]);
    const hDi = n.xe.huong % 2 === 0 ? n.xe.huong : n.h_duong;
    if (chCu === "+" && ch !== "+") n.giao = null;
    if (ch === "+" && chCu !== "+" && !n.thao_tac) vaoGiao(the, moi, n, r, c, oCu, xeAi);
    if (ch !== "+") {
      const cam = biCamDi(the.luoi, the.duong_cam, r, c, hDi);
      if (cam && !moi.trong_duong_cam) {
        const ma = the.cam_vao.get(khoaOH(r, c, hDi)) ?? (the.duong_cam.has(khoaO(r, c)) ? "P.101" : "P.102");
        ghiLoi(moi, {
          loai: "vao_duong_cam",
          chi_tiet:
            ma === "P.101"
              ? "Đi vào đường có biển Đường cấm."
              : "Đi ngược chiều vào đường một chiều có biển Cấm đi ngược chiều.",
          bien: ma,
        });
      }
      moi.trong_duong_cam = cam;
    }
    if (r === the.bd.dich.o[0] && c === the.bd.dich.o[1]) moi.ket_thuc = "den_dich";
  }

  // 6. Vượt đèn đỏ: đầu xe qua vạch dừng (mép nơi giao nhau) quá DUNG_SAI_VACH_CM khi đèn đỏ.
  if (n.giao && !n.giao.qua_vach) {
    const g = n.giao;
    const [dx, dy] = BUOC_HUONG[g.h as Huong];
    const vao = cuaVao(g.r, g.c, g.h, 1);
    const sau = dx !== 0 ? (n.xe.x - vao.x * 10) * dx : (n.xe.y - vao.y * 10) * dy;
    if (sau >= DUNG_SAI_VACH_CM * 10) {
      n.giao = { ...g, qua_vach: true };
      const den = the.den.get(khoaO(g.r, g.c));
      if (den && mauDenPho(den, nhip, trucCua(g.h)) === "do")
        ghiLoi(moi, { loai: "vuot_den_do", chi_tiet: "Đi qua vạch dừng khi đèn tín hiệu đang đỏ." });
    }
  }

  // 7. Đi sai phần đường (đường hai chiều; không kể lúc quay đầu, lúc rẽ).
  {
    const ch = kt(the, n.o[0], n.o[1]);
    if (laHaiChieu(ch) && n.thao_tac !== "quay_dau" && n.thao_tac !== "re") {
      const lech = lechNgang(n, n.h_duong);
      if (lech < -DUNG_SAI_LAN_CM && !tt.sai_lan) {
        moi.sai_lan = true;
        ghiLoi(moi, { loai: "sai_lan", chi_tiet: "Đi sang phần đường của chiều ngược lại." });
      } else if (lech > 0) moi.sai_lan = false;
    } else if (ch === "+") moi.sai_lan = false;
  }

  // 8. Quá tốc độ theo biển từ NGUONG_QUA_TOC_DO_KMH, liên tục quá 1 giây. Một lần quá tốc độ (tới khi
  // về dưới ngưỡng) là một lỗi, ghi tốc độ cao nhất.
  {
    const vung = the.toc_do.get(khoaOH(n.o[0], n.o[1], n.h_duong));
    const tocDo = kmh(n.xe.v);
    const q = tt.qua_toc_do;
    if (vung && n.xe.v * 72 - vung.kmh * 1000 >= NGUONG_QUA_TOC_DO_KMH * 1000) {
      const dang =
        q && q.gioi_han === vung.kmh
          ? { ...q, dem: q.dem + 1, max: Math.max(q.max, tocDo) }
          : {
              dem: 1,
              tu: nhip,
              max: tocDo,
              gioi_han: vung.kmh,
              x: Math.trunc(n.xe.x / 10),
              y: Math.trunc(n.xe.y / 10),
              loi: null as number | null,
            };
      if (dang.dem > NHIP_QUA_TOC_DO) {
        const chiTiet = `Chạy ${dang.max} km/h ở đoạn giới hạn ${dang.gioi_han} km/h.`;
        if (dang.loi === null) {
          ghiLoi(moi, {
            loai: "qua_toc_do",
            nhip: dang.tu,
            x: dang.x,
            y: dang.y,
            chi_tiet: chiTiet,
            toc_do: dang.max,
            gioi_han: dang.gioi_han,
            bien: MA_BIEN_TOC_DO,
          });
          dang.loi = moi.loi.length - 1;
        } else if (moi.loi[dang.loi]!.toc_do !== dang.max) {
          const i = dang.loi;
          moi.loi = moi.loi.map((l, j) => (j === i ? { ...l, toc_do: dang.max, chi_tiet: chiTiet } : l));
        }
      }
      moi.qua_toc_do = dang;
    } else moi.qua_toc_do = null;
  }

  // 9. Không nhường người đi bộ: đầu xe vào dải vạch khi có người đang sang trên mặt đường.
  {
    const [r, c] = n.o;
    if (the.vach.has(khoaO(r, c))) {
      const vach = hopVach(the, r, c);
      const vaoTruoc = chuaDiem(vach, { x: Math.trunc(truoc.xe.x / 10), y: Math.trunc(truoc.xe.y / 10) });
      const vaoSau = chuaDiem(vach, { x: Math.trunc(n.xe.x / 10), y: Math.trunc(n.xe.y / 10) });
      if (vaoSau && !vaoTruoc) {
        const dang = moi.di_bo.some((d, i) => {
          const m = the.nguoi_di_bo[i]!;
          return d.tt === "di" && m.o[0] === r && m.o[1] === c && trenMatDuong(d.p);
        });
        if (dang)
          ghiLoi(moi, {
            loai: "khong_nhuong_nguoi_di_bo",
            chi_tiet: "Đi qua vạch người đi bộ khi có người đang sang đường.",
          });
      }
    }
  }

  // 10. Vết, hết giờ.
  if (nhip % NHIP_VET === 0) moi.vet = [...tt.vet, Math.trunc(n.xe.x / 10), Math.trunc(n.xe.y / 10)];
  if (!moi.ket_thuc && nhip >= the.nhip_toi_da) moi.ket_thuc = "het_gio";
  return moi;
}

/** Đầu xe người chơi vừa vào nơi giao nhau (r, c): chọn đường ra theo ý định, ghi lỗi cấm rẽ, xi nhan, nhường đường. */
function vaoGiao(
  the: TheGioi,
  moi: TrangThaiPho,
  n: NguoiChoiPho,
  r: number,
  c: number,
  oCu: readonly [number, number],
  xeAi: ReadonlyArray<Parameters<typeof hopBao>[0] & { trang_thai: string }>,
) {
  const h = n.h_duong;
  n.giao = { r, c, h, qua_vach: false };
  const ra = huongRaGiao(the, r, c, h, n.y_dinh);
  n.y_dinh = null;
  const camMa = ra ? the.cam_re.get(khoaOH(r, c, h))?.get(ra.kieu) : undefined;
  if (ra && camMa)
    ghiLoi(moi, {
      loai: "re_cam",
      chi_tiet:
        ra.kieu === "thang"
          ? "Đi thẳng qua nơi giao nhau có biển cấm đi thẳng."
          : `Rẽ ${TEN_HUONG_LAI[ra.kieu]} nơi có biển cấm rẽ ${TEN_HUONG_LAI[ra.kieu]}.`,
      bien: camMa,
    });
  if (!the.den.has(khoaO(r, c))) {
    const khac = xeAi.some(
      (x) => conTrenDuong(x) && x.trang_thai !== "va_cham" && chongNhau(hopBao(x), hopO(r, c, 100)),
    );
    if (khac)
      ghiLoi(moi, {
        loai: "khong_nhuong_duong",
        chi_tiet: "Đi vào nơi giao nhau khi xe khác đang đi trong đó.",
      });
  }
  if (ra && ra.kieu !== "thang") {
    kiemXiNhan(moi, ra.kieu, `Rẽ ${TEN_HUONG_LAI[ra.kieu]}`);
    const lech = lechNgang({ ...n, o: [oCu[0], oCu[1]] }, h) >= 0 ? 1 : -1;
    n.xe.moc = duongRe(r, c, h, lech, ra.h2).map(moMm);
    n.thao_tac = "re";
  }
}

export { NHIP_MS };
