/**
 * Xác định tuổi người vi phạm tính đến hôm nay: tuổi đủ năm-tháng-ngày, tổng số ngày, nhóm tuổi khi
 * xử phạt vi phạm hành chính, khi chịu trách nhiệm hình sự, các mốc tuổi điều khiển phương tiện và
 * mốc tuổi kế tiếp.
 *
 * Không rõ ngày sinh thì lấy ngày cuối tháng (biết tháng, năm) hoặc ngày cuối năm (chỉ biết năm),
 * tức là ngày muộn nhất có thể, có lợi cho người vi phạm.
 *
 * "Đủ N tuổi" là từ ngày sinh nhật thứ N. Người sinh 29/02 thì năm không nhuận đủ tuổi vào 01/03
 * (cũng là cách tính có lợi cho người vi phạm).
 *
 * Mọi ngày là chuỗi YYYY-MM-DD, tính trên Date UTC để không lệch theo múi giờ của máy.
 */

export type KieuNgaySinh = "ngay" | "thang" | "nam";

/**
 * Căn cứ dùng trong kết luận. `daDoiChieu: false` là căn cứ chưa đối chiếu được với nguyên văn đang
 * có hiệu lực (kho văn bản chưa có), trang hiện nhãn "Cần đối chiếu". Đối chiếu xong thì sửa câu
 * chữ ở đây và đổi cờ.
 */
export const CAN_CU = {
  vphc: {
    nhan: "Điều 5 và Điều 134 Luật Xử lý vi phạm hành chính số 15/2012/QH13 (sửa đổi, bổ sung năm 2020)",
    daDoiChieu: false,
  },
  hinhSu: {
    nhan: "Điều 12 Bộ luật Hình sự số 100/2015/QH13 (sửa đổi, bổ sung năm 2017)",
    daDoiChieu: false,
  },
  ngaySinhThieu: {
    nhan: "Quy tắc lấy ngày cuối tháng, cuối năm khi không xác định được ngày, tháng sinh",
    daDoiChieu: false,
  },
  laiXe: {
    nhan: "Khoản 1 Điều 59 Luật Trật tự, an toàn giao thông đường bộ số 36/2024/QH15",
    daDoiChieu: true,
  },
} as const;

export type MaCanCu = keyof typeof CAN_CU;

/** Kết luận theo một nhóm tuổi: tên nhóm và nội dung áp dụng. */
export type KetLuan = { nhom: string; noiDung: string[]; canCu: MaCanCu };

/** Mốc tuổi điều khiển phương tiện (khoản 1 Điều 59 Luật số 36/2024/QH15). */
export const MOC_LAI_XE: ReadonlyArray<{ tuoi: number; noiDung: string }> = [
  { tuoi: 16, noiDung: "Điều khiển xe gắn máy" },
  {
    tuoi: 18,
    noiDung:
      "Cấp giấy phép lái xe hạng A1, A, B1, B, C1; cấp chứng chỉ bồi dưỡng kiến thức pháp luật về giao thông đường bộ để điều khiển xe máy chuyên dùng",
  },
  { tuoi: 21, noiDung: "Cấp giấy phép lái xe hạng C, BE" },
  { tuoi: 24, noiDung: "Cấp giấy phép lái xe hạng D1, D2, C1E, CE" },
  { tuoi: 27, noiDung: "Cấp giấy phép lái xe hạng D, D1E, D2E, DE" },
];

/** Các mốc tuổi có ý nghĩa pháp lý, dùng để báo mốc kế tiếp. */
const MOC_TUOI = [14, 16, 18, 21, 24, 27];

const NGAY_MS = 86_400_000;

const tuIso = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const sangIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const pad = (n: number) => String(n).padStart(2, "0");

/** Số ngày của tháng m (1-12) năm y. */
export function soNgayTrongThang(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Chuỗi YYYY-MM-DD có thật trên lịch (loại 30/02...). */
export function laNgayCoThat(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const ms = tuIso(v);
  return !Number.isNaN(ms) && sangIso(ms) === v;
}

/** Ngày sinh dùng để tính: ngày cụ thể, hoặc ngày cuối tháng/năm khi không rõ ngày sinh. */
export function ngaySinhTinh(kieu: KieuNgaySinh, nam: number, thang?: number, ngay?: number): string {
  if (kieu === "nam") return `${nam}-12-31`;
  const m = thang ?? 12;
  const d = kieu === "thang" ? soNgayTrongThang(nam, m) : (ngay ?? 1);
  return `${nam}-${pad(m)}-${pad(d)}`;
}

const tachNgay = (iso: string) => ({
  y: Number(iso.slice(0, 4)),
  m: Number(iso.slice(5, 7)),
  d: Number(iso.slice(8, 10)),
});

/**
 * Ngày đủ k tháng tuổi: cùng ngày của tháng thứ k sau tháng sinh; tháng đó không có ngày ấy (sinh
 * 29/02, 31/01...) thì là ngày 01 của tháng kế tiếp.
 */
function ngayDuThang(sinh: string, k: number): string {
  const { y, m, d } = tachNgay(sinh);
  const t = m - 1 + k;
  const nam = y + Math.floor(t / 12);
  const thang = (t % 12) + 1;
  if (d <= soNgayTrongThang(nam, thang)) return `${nam}-${pad(thang)}-${pad(d)}`;
  return thang === 12 ? `${nam + 1}-01-01` : `${nam}-${pad(thang + 1)}-01`;
}

/** Ngày đủ n tuổi của người sinh ngày `sinh`; sinh 29/02 mà năm đủ tuổi không nhuận thì là 01/03. */
export function ngayDuTuoi(sinh: string, n: number): string {
  return ngayDuThang(sinh, 12 * n);
}

/** Số ngày từ `tu` đến `den` (không tính ngày `tu`). */
export function soNgayGiua(tu: string, den: string): number {
  return Math.round((tuIso(den) - tuIso(tu)) / NGAY_MS);
}

/** Tuổi đủ năm-tháng-ngày từ `sinh` đến `den` (den ≥ sinh). */
export function tuoiDayDu(sinh: string, den: string): { nam: number; thang: number; ngay: number } {
  const a = tachNgay(sinh);
  const b = tachNgay(den);
  // Số tháng đủ: bắt đầu từ chênh lệch theo lịch, lùi lại khi mốc tháng còn sau `den`.
  let k = (b.y - a.y) * 12 + (b.m - a.m);
  while (k > 0 && ngayDuThang(sinh, k) > den) k -= 1;
  return { nam: Math.floor(k / 12), thang: k % 12, ngay: soNgayGiua(ngayDuThang(sinh, k), den) };
}

/** Nhóm tuổi khi xử phạt vi phạm hành chính. */
export function ketLuanVphc(tuoi: number): KetLuan {
  if (tuoi < 14)
    return {
      nhom: "Dưới 14 tuổi",
      noiDung: ["Không bị xử phạt vi phạm hành chính."],
      canCu: "vphc",
    };
  if (tuoi < 16)
    return {
      nhom: "Từ đủ 14 tuổi đến dưới 16 tuổi",
      noiDung: [
        "Chỉ bị xử phạt vi phạm hành chính về hành vi vi phạm do cố ý.",
        "Không áp dụng hình thức phạt tiền.",
      ],
      canCu: "vphc",
    };
  if (tuoi < 18)
    return {
      nhom: "Từ đủ 16 tuổi đến dưới 18 tuổi",
      noiDung: [
        "Bị xử phạt vi phạm hành chính về mọi vi phạm hành chính.",
        "Nếu phạt tiền thì mức tiền phạt không quá 1/2 mức tiền phạt áp dụng đối với người thành niên; không có tiền nộp phạt hoặc không có khả năng thi hành thì cha mẹ hoặc người giám hộ phải nộp thay.",
      ],
      canCu: "vphc",
    };
  return {
    nhom: "Từ đủ 18 tuổi trở lên",
    noiDung: ["Bị xử phạt vi phạm hành chính như người thành niên."],
    canCu: "vphc",
  };
}

/** Nhóm tuổi chịu trách nhiệm hình sự. */
export function ketLuanHinhSu(tuoi: number): KetLuan {
  if (tuoi < 14)
    return {
      nhom: "Dưới 14 tuổi",
      noiDung: ["Chưa đến tuổi chịu trách nhiệm hình sự."],
      canCu: "hinhSu",
    };
  if (tuoi < 16)
    return {
      nhom: "Từ đủ 14 tuổi đến dưới 16 tuổi",
      noiDung: [
        "Chỉ chịu trách nhiệm hình sự về tội phạm rất nghiêm trọng, tội phạm đặc biệt nghiêm trọng thuộc các tội được liệt kê tại khoản 2 Điều 12 Bộ luật Hình sự.",
      ],
      canCu: "hinhSu",
    };
  if (tuoi < 18)
    return {
      nhom: "Từ đủ 16 tuổi đến dưới 18 tuổi",
      noiDung: [
        "Chịu trách nhiệm hình sự về mọi tội phạm, trừ những tội phạm mà Bộ luật Hình sự có quy định khác.",
        "Là người dưới 18 tuổi phạm tội, áp dụng các quy định riêng đối với người dưới 18 tuổi.",
      ],
      canCu: "hinhSu",
    };
  return {
    nhom: "Từ đủ 18 tuổi trở lên",
    noiDung: [
      "Chịu trách nhiệm hình sự về mọi tội phạm, trừ những tội phạm mà Bộ luật Hình sự có quy định khác.",
    ],
    canCu: "hinhSu",
  };
}

export type KetQuaTuoi = {
  ngaySinh: string;
  /** Khác "ngay" thì `ngaySinh` là ngày cuối tháng/năm lấy thay cho ngày sinh không rõ. */
  kieu: KieuNgaySinh;
  homNay: string;
  tuoi: { nam: number; thang: number; ngay: number };
  tongNgay: number;
  vphc: KetLuan;
  hinhSu: KetLuan;
  laiXe: Array<{ tuoi: number; noiDung: string; ngayDu: string; conNgay: number }>;
  /** Mốc tuổi kế tiếp chưa đủ, null khi đã qua mọi mốc. */
  mocKeTiep: { tuoi: number; ngayDu: string; conNgay: number } | null;
};

/** Tính toàn bộ kết quả; `ngaySinh` phải có thật và không sau `homNay`. */
export function xacDinhTuoi(ngaySinh: string, homNay: string, kieu: KieuNgaySinh = "ngay"): KetQuaTuoi {
  const tuoi = tuoiDayDu(ngaySinh, homNay);
  const moc = (n: number) => {
    const ngayDu = ngayDuTuoi(ngaySinh, n);
    return { ngayDu, conNgay: Math.max(0, soNgayGiua(homNay, ngayDu)) };
  };
  const tiep = MOC_TUOI.find((n) => n > tuoi.nam);
  return {
    ngaySinh,
    kieu,
    homNay,
    tuoi,
    tongNgay: soNgayGiua(ngaySinh, homNay),
    vphc: ketLuanVphc(tuoi.nam),
    hinhSu: ketLuanHinhSu(tuoi.nam),
    laiXe: MOC_LAI_XE.map((m) => ({ ...m, ...moc(m.tuoi) })),
    mocKeTiep: tiep === undefined ? null : { tuoi: tiep, ...moc(tiep) },
  };
}
