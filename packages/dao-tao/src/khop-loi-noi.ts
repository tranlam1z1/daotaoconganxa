/**
 * Khớp lời nói với phương án trả lời (docs/PLAN.md GĐ14).
 *
 * Người học nói "A", "đáp án bê", "phương án hai", hoặc đọc gần đúng nội dung phương án. Trình
 * duyệt nhận dạng giọng nói thành chữ; hàm ở đây quyết định chữ đó chỉ phương án nào. So khớp
 * trên chữ đã bỏ dấu, vì bộ nhận dạng hay sai dấu ("bê" thành "be", "đê" thành "de").
 *
 * Nguyên tắc: không đoán. Nói hai chữ cái, nói chữ cái không có trong câu, hay nội dung gần
 * đều nhiều phương án thì trả "không chắc" để giao diện hỏi lại.
 */

export interface PhuongAnLoiNoi {
  id: string;
  text: string;
}

export type KetQuaKhopLoiNoi =
  | { loai: "khop"; id: string; viTri: number; cach: "chu_cai" | "noi_dung" }
  | { loai: "khong_chac"; lyDo: "rong" | "mo_ho" | "ngoai_pham_vi" };

/** Điểm giống tối thiểu để nhận theo nội dung, và khoảng cách tối thiểu với phương án thứ hai. */
export const NGUONG_KHOP_NOI_DUNG = 0.6;
export const CACH_BIET_TOI_THIEU = 0.15;

/** Bỏ dấu tiếng Việt, chữ thường, chỉ giữ chữ và số. */
export function chuanHoaLoiNoi(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Nhãn chữ cái của phương án thứ `i` (0 → "A"). */
export function chuCaiPhuongAn(i: number): string {
  return String.fromCharCode(65 + i);
}

/**
 * Cách đọc tên chữ cái sau khi bỏ dấu: "bê", "bờ" → B; "xê", "cờ" → C; "đê", "dờ" → D.
 * Chỉ nhận khi cả lời nói (sau khi bỏ lời đệm) là đúng một chữ cái.
 */
const TEN_CHU_CAI: ReadonlyArray<readonly string[]> = [
  ["a"],
  ["b", "be", "bo"],
  ["c", "xe", "se", "ce", "co"],
  ["d", "de", "do"],
  ["e"],
  ["f", "ep", "ef"],
];

const SO_THU_TU: Readonly<Record<string, number>> = {
  "1": 0,
  "2": 1,
  "3": 2,
  "4": 3,
  "5": 4,
  "6": 5,
  mot: 0,
  hai: 1,
  ba: 2,
  bon: 3,
  tu: 3,
  nam: 4,
  sau: 5,
};

/** Lời đệm đứng đầu, xếp cụm dài trước để "toi chon" không bị cắt thành "toi" + "chon". */
const DEM_DAU = [
  "cau tra loi cua toi la",
  "cau tra loi la",
  "toi chon",
  "em chon",
  "minh chon",
  "chon",
  "lua chon",
  "phuong an",
  "dap an",
  "tra loi",
  "cau",
  "so",
  "y",
  "la",
];

/** Tiểu từ cuối câu: "B ạ", "A nhé". */
const DEM_CUOI = ["a", "nhe", "nha", "day", "nhi"];

function laChuCai(tu: string): number {
  return TEN_CHU_CAI.findIndex((ds) => ds.includes(tu));
}

function boDemDau(tu: string[]): { tu: string[]; coDem: boolean } {
  let con = tu;
  let coDem = false;
  let doi = true;
  while (doi && con.length > 1) {
    doi = false;
    for (const dem of DEM_DAU) {
      const t = dem.split(" ");
      if (con.length > t.length && t.every((x, i) => con[i] === x)) {
        con = con.slice(t.length);
        coDem = true;
        doi = true;
        break;
      }
    }
  }
  return { tu: con, coDem };
}

function boDemCuoi(tu: string[]): string[] {
  let con = tu;
  while (con.length > 1 && DEM_CUOI.includes(con[con.length - 1]!)) con = con.slice(0, -1);
  return con;
}

function bigram(s: string): Map<string, number> {
  const t = s.replace(/\s/g, "");
  const m = new Map<string, number>();
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/** Hệ số Dice trên cặp ký tự: 1 là trùng khít, 0 là không có cặp nào chung. */
export function doGiong(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const x = bigram(a);
  const y = bigram(b);
  let chung = 0;
  let tong = 0;
  for (const [g, n] of x) {
    chung += Math.min(n, y.get(g) ?? 0);
    tong += n;
  }
  for (const n of y.values()) tong += n;
  return tong ? (2 * chung) / tong : 0;
}

function diemNoiDung(loi: string, phuongAn: string): number {
  if (!phuongAn) return 0;
  let diem = doGiong(loi, phuongAn);
  // Đọc trọn phương án kèm lời đệm ("đúng rồi", "là sai"): coi như khớp.
  if (` ${loi} `.includes(` ${phuongAn} `)) diem = Math.max(diem, 0.95);
  // "không đúng" chứa "đúng" nhưng nghĩa ngược lại: phủ định lệch nhau thì hạ điểm.
  const phuDinh = (s: string) => /(^| )(khong|chua|chang)( |$)/.test(s);
  if (phuDinh(loi) !== phuDinh(phuongAn)) diem *= 0.5;
  return diem;
}

/**
 * Khớp một câu nói với danh sách phương án (đúng thứ tự đang hiện trên màn hình).
 * Trả phương án khi chắc chắn; còn lại trả "không chắc" kèm lý do.
 */
export function khopLoiNoi(loiNoi: string, phuongAn: readonly PhuongAnLoiNoi[]): KetQuaKhopLoiNoi {
  const chuan = chuanHoaLoiNoi(loiNoi);
  if (!chuan || phuongAn.length === 0) return { loai: "khong_chac", lyDo: "rong" };

  const { tu: sauDem, coDem } = boDemDau(chuan.split(" "));
  const tu = boDemCuoi(sauDem);

  // 1. Một chữ cái (hoặc số thứ tự sau lời đệm "phương án", "đáp án").
  if (tu.length === 1) {
    const chu = laChuCai(tu[0]!);
    const so = coDem ? SO_THU_TU[tu[0]!] : undefined;
    const viTri = chu >= 0 ? chu : so;
    if (viTri !== undefined) {
      if (viTri >= phuongAn.length) return { loai: "khong_chac", lyDo: "ngoai_pham_vi" };
      return { loai: "khop", id: phuongAn[viTri]!.id, viTri, cach: "chu_cai" };
    }
  }
  // Toàn chữ cái nối nhau ("a hoặc b", "b c"): người học còn phân vân.
  const cacChuCai = tu.filter((t) => laChuCai(t) >= 0);
  if (
    tu.length > 1 &&
    cacChuCai.length >= 2 &&
    tu.every((t) => laChuCai(t) >= 0 || t === "hoac" || t === "va")
  ) {
    return { loai: "khong_chac", lyDo: "mo_ho" };
  }

  // 2. Đọc nội dung phương án.
  const loi = tu.join(" ");
  const diem = phuongAn
    .map((p, viTri) => ({ viTri, d: diemNoiDung(loi, chuanHoaLoiNoi(p.text)) }))
    .sort((a, b) => b.d - a.d);
  const nhat = diem[0]!;
  const nhi = diem[1]?.d ?? 0;
  if (nhat.d >= NGUONG_KHOP_NOI_DUNG && nhat.d - nhi >= CACH_BIET_TOI_THIEU) {
    return { loai: "khop", id: phuongAn[nhat.viTri]!.id, viTri: nhat.viTri, cach: "noi_dung" };
  }
  return { loai: "khong_chac", lyDo: "mo_ho" };
}
