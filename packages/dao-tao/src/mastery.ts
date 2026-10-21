/**
 * Theo dõi mức thành thạo bằng mô hình BKT rút gọn (ke-hoach/09-a §6.2).
 *
 * Vì sao không dùng "đúng bao nhiêu phần trăm câu": tỷ lệ đúng không phân biệt được người
 * đoán trúng với người thật sự hiểu, và không xử lý được việc người học tiến bộ giữa chừng.
 * BKT giữ một xác suất "người này đã biết kỹ năng đó" và cập nhật sau mỗi lượt làm bài, có
 * tính tới khả năng đoán trúng (`guess`) và khả năng biết mà vẫn sai (`slip`).
 */

export interface ThamSoBkt {
  /** Xác suất biết nhưng vẫn trả lời sai. */
  slip: number;
  /** Xác suất không biết nhưng đoán trúng. */
  guess: number;
  /** Xác suất học được sau một lượt làm bài. */
  learn: number;
  /** Xác suất biết trước khi làm bài nào. */
  banDau: number;
}

export const BKT_MAC_DINH: ThamSoBkt = { slip: 0.1, guess: 0.2, learn: 0.15, banDau: 0.1 };

/**
 * Tham số theo dạng bài: câu trắc nghiệm 4 lựa chọn đoán trúng 25%, câu tự luận gần như
 * không đoán được. Dùng sai `guess` thì một người bấm bừa vẫn được coi là thành thạo.
 */
export const BKT_THEO_DANG: Record<string, Partial<ThamSoBkt>> = {
  trac_nghiem: { guess: 0.25 },
  dung_sai: { guess: 0.5, slip: 0.15 },
  ghep_cap: { guess: 0.15 },
  keo_tha_so_do: { guess: 0.15 },
  dien_khuyet: { guess: 0.05 },
  sap_xep: { guess: 0.05 },
  tinh_toan: { guess: 0.02 },
  truy_tim: { guess: 0.02 },
  viet_co_can_cu: { guess: 0.01, slip: 0.15 },
  phan_bien: { guess: 0.01, slip: 0.2 },
  du_an_nho: { guess: 0.01, slip: 0.2 },
};

export function thamSoCho(dangBai: string): ThamSoBkt {
  return { ...BKT_MAC_DINH, ...(BKT_THEO_DANG[dangBai] ?? {}) };
}

/** Ngưỡng coi là vững / hổng (09-a §6.2). */
export const NGUONG_VUNG = 0.85;
export const NGUONG_HONG = 0.4;
/** Dưới ngưỡng hổng nhưng làm chưa đủ số lần này thì chưa kết luận là hổng. */
export const SO_LAN_TOI_THIEU_DE_KET_LUAN = 3;

export interface TrangThaiKyNang {
  pKnown: number;
  attempts: number;
  correct: number;
}

/**
 * Cập nhật P(biết) sau một lượt làm bài.
 *
 * `dung` là kết quả nhị phân. Bài chấm theo thang điểm quy về nhị phân ở tầng gọi bằng
 * `passed` — nửa vời thì coi là chưa đạt, vì mục tiêu là biết chắc chứ không phải biết mang máng.
 */
export function capNhatThanhThao(
  hienTai: TrangThaiKyNang,
  dung: boolean,
  ts: ThamSoBkt = BKT_MAC_DINH,
): TrangThaiKyNang {
  const p = Math.min(Math.max(hienTai.pKnown, 0.001), 0.999);
  const sau = dung
    ? (p * (1 - ts.slip)) / (p * (1 - ts.slip) + (1 - p) * ts.guess)
    : (p * ts.slip) / (p * ts.slip + (1 - p) * (1 - ts.guess));
  const moi = sau + (1 - sau) * ts.learn;
  return {
    pKnown: Math.min(Math.max(Number(moi.toFixed(3)), 0), 1),
    attempts: hienTai.attempts + 1,
    correct: hienTai.correct + (dung ? 1 : 0),
  };
}

export type MucThanhThao = "chua_hoc" | "dang_hoc" | "vung" | "hong";

export function mucThanhThao(t: TrangThaiKyNang): MucThanhThao {
  if (t.attempts === 0) return "chua_hoc";
  if (t.pKnown >= NGUONG_VUNG) return "vung";
  if (t.pKnown < NGUONG_HONG && t.attempts >= SO_LAN_TOI_THIEU_DE_KET_LUAN) return "hong";
  return "dang_hoc";
}

export const NHAN_MUC_THANH_THAO: Record<MucThanhThao, string> = {
  chua_hoc: "Chưa học",
  dang_hoc: "Đang học",
  vung: "Vững",
  hong: "Còn hổng",
};

export interface KyNang {
  id: string;
  code: string;
  name: string;
  prerequisites: string[];
}

/**
 * Kỹ năng đã mở khoá: mọi kỹ năng tiên quyết đều đạt mức `vung`.
 * Kỹ năng không có tiên quyết luôn mở.
 */
export function kyNangDaMo(kyNang: KyNang[], thanhThao: Map<string, TrangThaiKyNang>): Set<string> {
  const theoCode = new Map(kyNang.map((k) => [k.code, k]));
  const mo = new Set<string>();
  // Lặp tới khi không mở thêm được: đồ thị tiên quyết nông, vài vòng là đủ.
  for (let vong = 0; vong < kyNang.length + 1; vong++) {
    let themDuoc = false;
    for (const k of kyNang) {
      if (mo.has(k.code)) continue;
      const du = k.prerequisites.every((p) => {
        const truoc = theoCode.get(p);
        if (!truoc) return true; // tiên quyết trỏ ra ngoài chuyên đề: không chặn.
        const t = thanhThao.get(truoc.id);
        return t ? mucThanhThao(t) === "vung" : false;
      });
      if (du) {
        mo.add(k.code);
        themDuoc = true;
      }
    }
    if (!themDuoc) break;
  }
  return mo;
}

/**
 * Phát hiện chu trình trong đồ thị tiên quyết. Trả về danh sách mã kỹ năng nằm trong chu
 * trình; rỗng là hợp lệ. Màn hình quản trị gọi hàm này trước khi lưu bản đồ năng lực.
 */
export function timChuTrinh(kyNang: KyNang[]): string[] {
  const canh = new Map(kyNang.map((k) => [k.code, k.prerequisites]));
  const mau = new Map<string, 0 | 1 | 2>();
  const trongChuTrinh = new Set<string>();

  const di = (code: string, duong: string[]): boolean => {
    if (mau.get(code) === 1) {
      // Quay lại một nút đang mở: cả đoạn từ đó tới đây nằm trong chu trình.
      const tu = duong.indexOf(code);
      for (const c of duong.slice(tu)) trongChuTrinh.add(c);
      return true;
    }
    if (mau.get(code) === 2) return false;
    mau.set(code, 1);
    let co = false;
    for (const truoc of canh.get(code) ?? []) {
      if (!canh.has(truoc)) continue;
      if (di(truoc, [...duong, code])) co = true;
    }
    mau.set(code, 2);
    return co;
  };

  for (const k of kyNang) di(k.code, []);
  return [...trongChuTrinh];
}
