/**
 * Chuyển đổi địa giới hành chính (công cụ /cong-cu/dia-gioi-hanh-chinh): đối chiếu tỉnh, huyện, xã
 * trước sắp xếp năm 2025 (63 tỉnh, ba cấp) với tỉnh, xã hiện nay (34 tỉnh, hai cấp).
 *
 * Dữ liệu nằm ở data/dia-gioi/dia-gioi.json, do scripts/dia-gioi.ts dựng từ nguồn công khai (xem
 * data/dia-gioi/README.md). Tệp này không đọc tệp: nơi gọi đọc rồi truyền vào `taoBoTra`.
 */

/** Đơn vị hiện nay: tỉnh (mã 2 số) hoặc xã, phường, đặc khu (mã 5 số) kèm mã tỉnh. */
export interface TinhMoi {
  ma: string;
  ten: string;
}
export interface XaMoi {
  ma: string;
  ten: string;
  tinh: string;
}

/** Đơn vị trước sắp xếp. */
export interface TinhCu {
  ma: string;
  ten: string;
}
export interface HuyenCu {
  ma: string;
  ten: string;
  tinh: string;
  /**
   * Chỉ có ở huyện không chia xã (huyện đảo Bạch Long Vĩ, Cồn Cỏ, Hoàng Sa, Lý Sơn, Côn Đảo):
   * mã xã mới nhận toàn bộ huyện.
   */
  moi?: string[];
}
export interface XaCu {
  ma: string;
  ten: string;
  huyen: string;
  /**
   * Mã các xã mới nhận địa giới của xã này. Nhiều mã nghĩa là xã cũ được chia; mã đầu là xã mới
   * chứa trung tâm xã cũ theo nguồn dữ liệu.
   */
  moi: string[];
  /**
   * Tâm xã cũ theo nguồn dữ liệu, [kinh độ, vĩ độ]; chỉ dùng để ước lượng xã cũ tại một vị trí
   * (`xaCuGanNhat`). Không có khi nguồn cho hai xã cũ cùng một tọa độ.
   */
  tam?: [number, number];
}

export interface DuLieuDiaGioi {
  /** Ngày dựng tệp (YYYY-MM-DD). */
  phienBan: string;
  nguon: Array<{ ten: string; url: string; giayPhep: string; ghiChu: string }>;
  tinhMoi: TinhMoi[];
  xaMoi: XaMoi[];
  tinhCu: TinhCu[];
  huyenCu: HuyenCu[];
  xaCu: XaCu[];
}

/* ------------------------------------------------------------------ */
/* Chữ                                                                 */
/* ------------------------------------------------------------------ */

const DAU_THANH = "̣̀́̃̉";
// "oa", "oe", "uy" cuối tiếng mang dấu ở nguyên âm sau (kiểu mới: Hoà, Thuỷ) chuyển về nguyên âm
// trước (kiểu cũ: Hòa, Thủy), thống nhất với cách viết của văn bản trong kho. "qu" không đổi (Quý).
const KIEU_MOI = new RegExp(`(?<![qQ])([oOuU])([aAeEyY])([${DAU_THANH}])(?![\\p{L}\\p{M}])`, "gu");

/** Đặt dấu thanh theo kiểu cũ: "Thanh Hoá" → "Thanh Hóa", "Thuỷ" → "Thủy". */
export function dauKieuCu(s: string): string {
  return s.normalize("NFD").replace(KIEU_MOI, "$1$3$2").normalize("NFC");
}

/** Khóa so khớp: bỏ dấu, chữ thường, gộp khoảng trắng. */
export function khoaTim(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const LOAI_DON_VI = /^(thành phố|tỉnh|quận|huyện|thị xã|thị trấn|phường|xã|đặc khu)\s+/i;

/** Tên bỏ loại đơn vị đứng đầu: "Phường Hạc Thành" → "Hạc Thành". Dùng để sắp xếp và tìm. */
export function tenRieng(ten: string): string {
  return ten.replace(LOAI_DON_VI, "");
}

/** So sánh theo tên riêng, thứ tự chữ cái tiếng Việt; tên là số (Phường 1, 2…) theo giá trị số. */
export function soSanhTen(a: string, b: string): number {
  return tenRieng(a).localeCompare(tenRieng(b), "vi", { numeric: true });
}

const thoatRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Cụm `k` đứng trọn từ trong `chu`; cả hai đã qua `khoaTim`. */
const coCum = (chu: string, k: string) => new RegExp(`(?<![a-z0-9])${thoatRegex(k)}(?![a-z0-9])`).test(chu);

/**
 * Địa chỉ gõ tự do `chu` có nêu xã mang tên riêng `k` (cả hai đã qua `khoaTim`): tên viết kèm loại đơn
 * vị ("phường Lam Sơn", "P. Lam Sơn", "TT Lam Sơn"), hoặc đứng riêng một phần giữa hai dấu phẩy. Phần
 * đầu thường là số nhà, tên đường nên không tính; "thị xã …" là cấp huyện nên không tính là "xã …".
 */
function neuTenXa(chu: string, k: string): boolean {
  const kemLoai = new RegExp(
    `(?<![a-z0-9])(?<!thi )(?:phuong|xa|thi tran|tt|p|x)[.\\s]\\s*${thoatRegex(k)}(?![a-z0-9])`,
  );
  return (
    kemLoai.test(chu) ||
    chu
      .split(/[,;]/)
      .slice(1)
      .some((p) => p.trim() === k)
  );
}

/* ------------------------------------------------------------------ */
/* Tra cứu                                                             */
/* ------------------------------------------------------------------ */

export interface KetQuaXa {
  xaCu: XaCu;
  huyenCu: HuyenCu;
  tinhCu: TinhCu;
  /** Xã mới theo thứ tự của `xaCu.moi`, kèm tỉnh. */
  moi: Array<{ xa: XaMoi; tinh: TinhMoi }>;
  /** Xã cũ được chia cho nhiều xã mới. */
  biChia: boolean;
}

export interface KetQuaHuyen {
  huyenCu: HuyenCu;
  tinhCu: TinhCu;
  /** Tỉnh mới nhận huyện (một huyện cũ không bị tách sang hai tỉnh). */
  tinhMoi: TinhMoi[];
  /** Các xã mới có phần địa giới của huyện cũ. */
  xaMoi: XaMoi[];
}

export interface KetQuaTinh {
  tinhCu: TinhCu;
  tinhMoi: TinhMoi[];
  /** Các tỉnh cũ khác cùng nhập vào tỉnh mới. */
  hopNhatVoi: TinhCu[];
}

export interface KetQuaTraNguoc {
  xaMoi: XaMoi;
  tinhMoi: TinhMoi;
  /** Xã cũ nhập vào; `motPhan` = chỉ một phần xã cũ (xã cũ bị chia). */
  xaCu: Array<{ xa: XaCu; huyen: HuyenCu; tinh: TinhCu; motPhan: boolean }>;
  /** Huyện không chia xã nhập nguyên vào (huyện đảo). */
  huyenCu: Array<{ huyen: HuyenCu; tinh: TinhCu }>;
}

/** Đơn vị trước sắp xếp tại một vị trí đã biết xã mới. */
export interface KetQuaXaCu {
  /** Xã cũ tại vị trí; null khi chưa xác định được (xem `coThe`) hoặc huyện cũ không chia xã. */
  xa: XaCu | null;
  /** Huyện, tỉnh cũ: có khi đã rõ xã cũ, hoặc mọi đơn vị cũ nhập vào xã mới cùng huyện, cùng tỉnh. */
  huyen: HuyenCu | null;
  tinh: TinhCu | null;
  /** Các xã cũ đã nhập vào xã mới, khi chưa xác định được vị trí thuộc xã cũ nào; rỗng khi đã rõ. */
  coThe: Array<{ xa: XaCu; huyen: HuyenCu }>;
}

export interface BoTraDiaGioi {
  phienBan: string;
  nguon: DuLieuDiaGioi["nguon"];
  dsTinhCu(): TinhCu[];
  dsHuyenCu(maTinh: string): HuyenCu[];
  dsXaCu(maHuyen: string): XaCu[];
  dsTinhMoi(): TinhMoi[];
  dsXaMoi(maTinh: string): XaMoi[];
  tinhCu(ma: string): TinhCu | undefined;
  huyenCu(ma: string): HuyenCu | undefined;
  xaCu(ma: string): XaCu | undefined;
  tinhMoi(ma: string): TinhMoi | undefined;
  xaMoi(ma: string): XaMoi | undefined;
  chuyenXa(maXa: string): KetQuaXa | null;
  chuyenHuyen(maHuyen: string): KetQuaHuyen | null;
  chuyenTinh(maTinh: string): KetQuaTinh | null;
  traNguoc(maXaMoi: string): KetQuaTraNguoc | null;
  /**
   * Đơn vị cũ tại một vị trí thuộc xã mới. `tenBanDo` là tên các đơn vị bản đồ ghi tại vị trí đó (có
   * hoặc không có loại đơn vị), `diaChiGo` là địa chỉ người dùng gõ (nếu có). Nhận khi bản đồ nêu đúng
   * một xã cũ đã nhập vào xã mới; bản đồ không xác định được thì nhận khi địa chỉ gõ nêu đúng một xã cũ
   * như vậy. Xã mới chỉ có một đơn vị cũ thì không cần tên.
   */
  xaCuTaiViTri(maXaMoi: string, tenBanDo: string[], diaChiGo?: string): KetQuaXaCu | null;
  /** Tìm xã mới theo tên (không phân biệt dấu); lọc theo tỉnh nếu có. */
  timXaMoi(q: string, maTinh?: string, gioiHan?: number): Array<{ xa: XaMoi; tinh: TinhMoi }>;
}

/**
 * Xã cũ có tâm gần vị trí nhất trong các xã cũ có thể (`KetQuaXaCu.coThe`), để ước lượng khi tên không
 * xác định được. Đây là ước lượng: ranh xã cũ không có trong dữ liệu, vị trí gần ranh có thể thuộc xã
 * bên cạnh. Trả null khi có xã thiếu tâm dùng được (`tamDung`), vì xã thiếu tâm có thể mới là xã đúng.
 */
export function xaCuGanNhat<T extends { xa: XaCu }>(
  coThe: T[],
  lat: number,
  lon: number,
  tamDung: (xa: XaCu) => boolean = () => true,
): T | null {
  // Tính phẳng quanh vị trí: đủ đúng trong phạm vi một xã.
  const coKinh = Math.cos((lat * Math.PI) / 180);
  let gan: T | null = null;
  let nho = Number.POSITIVE_INFINITY;
  for (const c of coThe) {
    const tam = c.xa.tam;
    if (!tam || !tamDung(c.xa)) return null;
    const cach = Math.hypot((tam[0] - lon) * coKinh, tam[1] - lat);
    if (cach < nho) {
      nho = cach;
      gan = c;
    }
  }
  return gan;
}

function nhomTheo<T>(ds: T[], khoa: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of ds) {
    const k = khoa(x);
    const nhom = m.get(k);
    if (nhom) nhom.push(x);
    else m.set(k, [x]);
  }
  return m;
}

const theoMa = <T extends { ma: string }>(ds: T[]) => new Map(ds.map((x) => [x.ma, x]));
const theoTen = <T extends { ten: string }>(ds: T[]) => [...ds].sort((a, b) => soSanhTen(a.ten, b.ten));

/** Dựng bộ tra từ dữ liệu đã đọc: lập chỉ mục một lần, các hàm tra sau đó không duyệt cả tệp. */
export function taoBoTra(d: DuLieuDiaGioi): BoTraDiaGioi {
  const mTinhCu = theoMa(d.tinhCu);
  const mHuyenCu = theoMa(d.huyenCu);
  const mXaCu = theoMa(d.xaCu);
  const mTinhMoi = theoMa(d.tinhMoi);
  const mXaMoi = theoMa(d.xaMoi);

  const huyenTheoTinh = nhomTheo(theoTen(d.huyenCu), (h) => h.tinh);
  const xaTheoHuyen = nhomTheo(theoTen(d.xaCu), (x) => x.huyen);
  const xaMoiTheoTinh = nhomTheo(theoTen(d.xaMoi), (x) => x.tinh);

  // Ngược: mã xã mới → xã cũ, huyện (đảo) cũ.
  const xaCuTheoXaMoi = new Map<string, XaCu[]>();
  for (const x of d.xaCu)
    for (const m of x.moi) {
      const ds = xaCuTheoXaMoi.get(m);
      if (ds) ds.push(x);
      else xaCuTheoXaMoi.set(m, [x]);
    }
  const huyenCuTheoXaMoi = new Map<string, HuyenCu[]>();
  for (const h of d.huyenCu)
    for (const m of h.moi ?? []) {
      const ds = huyenCuTheoXaMoi.get(m);
      if (ds) ds.push(h);
      else huyenCuTheoXaMoi.set(m, [h]);
    }

  const khoaXaMoi = d.xaMoi.map((x) => ({ x, k: khoaTim(tenRieng(x.ten)), kDu: khoaTim(x.ten) }));

  /** Mã xã mới nhận địa giới của huyện: hợp của các xã cũ, hoặc `moi` của huyện đảo. */
  const xaMoiCuaHuyen = (h: HuyenCu): string[] => {
    const ma = new Set<string>(h.moi ?? []);
    for (const x of xaTheoHuyen.get(h.ma) ?? []) for (const m of x.moi) ma.add(m);
    return [...ma];
  };
  const tinhMoiCuaXaMoi = (ma: string[]): TinhMoi[] => {
    const tinh = new Set(ma.map((m) => mXaMoi.get(m)?.tinh).filter((t): t is string => !!t));
    return [...tinh].map((t) => mTinhMoi.get(t)).filter((t): t is TinhMoi => !!t);
  };
  const tinhMoiCuaTinhCu = new Map<string, TinhMoi[]>();
  for (const t of d.tinhCu) {
    const ma = (huyenTheoTinh.get(t.ma) ?? []).flatMap(xaMoiCuaHuyen);
    tinhMoiCuaTinhCu.set(t.ma, tinhMoiCuaXaMoi(ma));
  }

  const moiCua = (ma: string) => {
    const xa = mXaMoi.get(ma);
    const tinh = xa ? mTinhMoi.get(xa.tinh) : undefined;
    return xa && tinh ? { xa, tinh } : null;
  };

  const traNguoc = (maXaMoi: string): KetQuaTraNguoc | null => {
    const g = moiCua(maXaMoi);
    if (!g) return null;
    const xaCu = (xaCuTheoXaMoi.get(maXaMoi) ?? [])
      .map((xa) => {
        const huyen = mHuyenCu.get(xa.huyen);
        const tinh = huyen && mTinhCu.get(huyen.tinh);
        return huyen && tinh ? { xa, huyen, tinh, motPhan: xa.moi.length > 1 } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort(
        (a, b) =>
          soSanhTen(a.tinh.ten, b.tinh.ten) ||
          soSanhTen(a.huyen.ten, b.huyen.ten) ||
          soSanhTen(a.xa.ten, b.xa.ten),
      );
    const huyenCu = (huyenCuTheoXaMoi.get(maXaMoi) ?? [])
      .map((huyen) => {
        const tinh = mTinhCu.get(huyen.tinh);
        return tinh ? { huyen, tinh } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    return { xaMoi: g.xa, tinhMoi: g.tinh, xaCu, huyenCu };
  };

  return {
    phienBan: d.phienBan,
    nguon: d.nguon,
    dsTinhCu: () => theoTen(d.tinhCu),
    dsHuyenCu: (maTinh) => huyenTheoTinh.get(maTinh) ?? [],
    dsXaCu: (maHuyen) => xaTheoHuyen.get(maHuyen) ?? [],
    dsTinhMoi: () => theoTen(d.tinhMoi),
    dsXaMoi: (maTinh) => xaMoiTheoTinh.get(maTinh) ?? [],
    tinhCu: (ma) => mTinhCu.get(ma),
    huyenCu: (ma) => mHuyenCu.get(ma),
    xaCu: (ma) => mXaCu.get(ma),
    tinhMoi: (ma) => mTinhMoi.get(ma),
    xaMoi: (ma) => mXaMoi.get(ma),

    chuyenXa(maXa) {
      const xaCu = mXaCu.get(maXa);
      const huyenCu = xaCu && mHuyenCu.get(xaCu.huyen);
      const tinhCu = huyenCu && mTinhCu.get(huyenCu.tinh);
      if (!xaCu || !huyenCu || !tinhCu) return null;
      const moi = xaCu.moi.map(moiCua).filter((m): m is NonNullable<typeof m> => !!m);
      return { xaCu, huyenCu, tinhCu, moi, biChia: moi.length > 1 };
    },

    chuyenHuyen(maHuyen) {
      const huyenCu = mHuyenCu.get(maHuyen);
      const tinhCu = huyenCu && mTinhCu.get(huyenCu.tinh);
      if (!huyenCu || !tinhCu) return null;
      const ma = xaMoiCuaHuyen(huyenCu);
      const xaMoi = theoTen(ma.map((m) => mXaMoi.get(m)).filter((x): x is XaMoi => !!x));
      return { huyenCu, tinhCu, tinhMoi: tinhMoiCuaXaMoi(ma), xaMoi };
    },

    chuyenTinh(maTinh) {
      const tinhCu = mTinhCu.get(maTinh);
      if (!tinhCu) return null;
      const tinhMoi = tinhMoiCuaTinhCu.get(maTinh) ?? [];
      const maMoi = new Set(tinhMoi.map((t) => t.ma));
      const hopNhatVoi = theoTen(
        d.tinhCu.filter(
          (t) => t.ma !== maTinh && (tinhMoiCuaTinhCu.get(t.ma) ?? []).some((m) => maMoi.has(m.ma)),
        ),
      );
      return { tinhCu, tinhMoi, hopNhatVoi };
    },

    traNguoc,

    xaCuTaiViTri(maXaMoi, tenBanDo, diaChiGo = "") {
      const kq = traNguoc(maXaMoi);
      if (!kq) return null;
      const nguon: Array<{ xa: XaCu | null; huyen: HuyenCu; tinh: TinhCu }> = [
        ...kq.xaCu,
        ...kq.huyenCu.map((h) => ({ xa: null, ...h })),
      ];
      const dau = nguon[0];
      if (!dau) return null;

      const khoa = tenBanDo.map((t) => khoaTim(tenRieng(t)));
      const khoaDu = new Set(tenBanDo.map(khoaTim));
      const kMoi = khoaTim(tenRieng(kq.xaMoi.ten));
      const chuGo = khoaTim(diaChiGo);
      // Xã cũ trùng tên xã mới: một lần nêu tên có thể chính là xã mới, nên cần thêm căn cứ (tên lặp lại
      // ở cấp dưới trên bản đồ, hoặc nguồn nêu tên còn ghi huyện cũ, tức theo địa giới cũ).
      const theoBanDo = kq.xaCu.filter(({ xa, huyen }) => {
        const k = khoaTim(tenRieng(xa.ten));
        const lan = khoa.filter((x) => x === k).length;
        return lan > (k === kMoi && !khoaDu.has(khoaTim(huyen.ten)) ? 1 : 0);
      });
      // Bản đồ ghi tên tại đúng vị trí nên được ưu tiên; địa chỉ gõ chỉ dùng khi bản đồ không xác định được.
      const khop =
        theoBanDo.length === 1
          ? theoBanDo
          : kq.xaCu.filter(({ xa, huyen }) => {
              const k = khoaTim(tenRieng(xa.ten));
              return neuTenXa(chuGo, k) && (k !== kMoi || coCum(chuGo, khoaTim(huyen.ten)));
            });
      const mot = nguon.length === 1 ? dau : khop.length === 1 ? khop[0] : undefined;
      if (mot) return { xa: mot.xa, huyen: mot.huyen, tinh: mot.tinh, coThe: [] };
      return {
        xa: null,
        huyen: nguon.every((n) => n.huyen.ma === dau.huyen.ma) ? dau.huyen : null,
        tinh: nguon.every((n) => n.tinh.ma === dau.tinh.ma) ? dau.tinh : null,
        coThe: kq.xaCu.map(({ xa, huyen }) => ({ xa, huyen })),
      };
    },

    timXaMoi(q, maTinh, gioiHan = 30) {
      const k = khoaTim(q);
      if (!k) return [];
      // Tên riêng khớp từ đầu xếp trước, rồi tên riêng chứa chuỗi, rồi cả tên (gõ "phường hạc…").
      const hang = (m: (typeof khoaXaMoi)[number]) =>
        m.k.startsWith(k) ? 0 : m.k.includes(k) ? 1 : m.kDu.includes(k) ? 2 : -1;
      return khoaXaMoi
        .filter((m) => !maTinh || m.x.tinh === maTinh)
        .map((m) => ({ m, h: hang(m) }))
        .filter((m) => m.h >= 0)
        .sort((a, b) => a.h - b.h || soSanhTen(a.m.x.ten, b.m.x.ten))
        .slice(0, gioiHan)
        .map(({ m }) => moiCua(m.x.ma))
        .filter((m): m is NonNullable<typeof m> => !!m);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Thôn, tổ dân phố                                                    */
/* ------------------------------------------------------------------ */

/** Một dòng phương án sắp xếp thôn: các thôn cũ (ghi như nguồn, có thể là "Một phần …") thành `moi`. */
export interface DongThon {
  cu: string[];
  moi: string;
}

/** data/dia-gioi/thon.json (scripts/thon.ts). */
export interface DuLieuThon {
  phienBan: string;
  /** Theo mã tỉnh mới: căn cứ (văn bản kèm phương án) và các dòng sắp xếp thôn theo mã xã mới. */
  tinh: Record<string, { canCu: string; xa: Record<string, DongThon[]> }>;
}

/** Các dòng sắp xếp khớp một tên thôn cũ trong một xã mới, kèm căn cứ. */
export interface KetQuaThon {
  canCu: string;
  dong: DongThon[];
}

const LOAI_THON = /(?<![a-z0-9])(?:thon|to dan pho|tdp|khu pho|to|ban|lang|xom)\s+(?:so\s+(?=\d))?(?=\S)/;

/**
 * Khóa so khớp tên thôn: bỏ phần trong ngoặc, lấy phần sau loại đơn vị đầu tiên, nên "Một phần thôn
 * Thống Nhất (…)", "Thôn Thống Nhất" và "Thống Nhất" cùng khóa. Nguồn ghi "Thôn Thôn 2" cho thôn 2.
 */
function khoaThon(s: string): string {
  const k = khoaTim(s.replace(/\(.*$/, "")).replace(/^(?:thon )+/, "thon ");
  const m = LOAI_THON.exec(k);
  return m ? k.slice(m.index + m[0].length) : k;
}

/** Dựng bộ tra thôn cũ → thôn mới từ dữ liệu đã đọc. */
export function taoBoTraThon(d: DuLieuThon) {
  const chiMuc = new Map(
    Object.values(d.tinh).flatMap(({ canCu, xa }) =>
      Object.entries(xa).map(([ma, ds]) => {
        const dong = ds.map((dong) => ({
          dong,
          cu: dong.cu.map((c) => {
            const ngoac = khoaTim(/\((.*)$/.exec(c)?.[1] ?? "");
            // "Thôn 3 (Tên gọi quen thuộc: Hòa Trinh)": tra được theo cả hai tên.
            const quen = /quen thuoc:\s*([^)]+)/.exec(ngoac)?.[1]?.trim();
            return { khoa: quen ? [khoaThon(c), quen] : [khoaThon(c)], ngoac };
          }),
        }));
        return [ma, { canCu, ds: dong }] as const;
      }),
    ),
  );
  return {
    phienBan: d.phienBan,
    /**
     * Các dòng sắp xếp có thôn cũ tên `thon` trong xã mới: null khi chưa có dữ liệu thôn của xã, `dong`
     * rỗng khi không thấy tên (nguồn chỉ ghi thôn được sắp xếp lại). Nhiều dòng khi thôn cũ bị chia,
     * hoặc các xã cũ nhập vào xã mới có thôn trùng tên; `tenXaCu` giúp chọn khi nguồn ghi kèm tên xã cũ
     * ("Thôn 5 (Minh Tân)", "Thôn 1 Hoằng Thái").
     */
    tra(maXaMoi: string, thon: string, tenXaCu = ""): KetQuaThon | null {
      const muc = chiMuc.get(maXaMoi);
      if (!muc) return null;
      const { canCu, ds } = muc;
      const k = khoaThon(thon);
      if (!k) return { canCu, dong: [] };
      const kXa = khoaTim(tenRieng(tenXaCu));
      // Khóa chưa bỏ loại đơn vị để nhận tên riêng mở đầu bằng "Làng", "Bản"… ("Làng Pheo").
      const khoa = new Set([k, khoaTim(thon), `${k} ${kXa}`]);
      const khop = ds
        .map(({ dong, cu }) => ({ dong, cu: cu.filter((c) => c.khoa.some((x) => khoa.has(x))) }))
        .filter((x) => x.cu.length);
      const dungXa = kXa ? khop.filter((x) => x.cu.some((c) => coCum(c.ngoac, kXa))) : [];
      return { canCu, dong: (dungXa.length ? dungXa : khop).map((x) => x.dong) };
    },
  };
}
