/**
 * Tính cơi nới thành thùng xe (routes/cong-cu.coi-noi-thanh-thung.tsx): so kích thước lòng thùng đo
 * thực tế với kích thước ghi trong giấy chứng nhận kiểm định. Mọi kích thước tính bằng mm.
 *
 * Mỗi chiều (dài, rộng, cao) nhập một cặp số "theo giấy" và "đo được"; chiều nào không đo thì bỏ
 * trống. Chênh lệch trong phạm vi sai số cho phép (người dùng nhập, mặc định 0) coi là đúng. Đủ cả
 * ba chiều thì tính thêm thể tích thùng tăng thêm.
 *
 * Căn cứ xử phạt: điểm b khoản 4 Điều 13 (người điều khiển) và điểm h khoản 14 Điều 32 (chủ xe)
 * Nghị định số 168/2024/NĐ-CP (xem lib/khung-phat.ts về việc đối chiếu).
 */
import { type KhungPhat, ND_168 } from "./khung-phat";

export type Chieu = "dai" | "rong" | "cao";

export const CHIEU: ReadonlyArray<{ ma: Chieu; ten: string }> = [
  { ma: "dai", ten: "Chiều dài" },
  { ma: "rong", ten: "Chiều rộng" },
  { ma: "cao", ten: "Chiều cao" },
];

export interface SoSanhChieu {
  chieu: Chieu;
  giay: number;
  doDuoc: number;
  /** Đo được trừ theo giấy (mm); dương là lớn hơn giấy. */
  chenh: number;
  /** Chênh so với kích thước theo giấy, làm tròn 2 chữ số thập phân. */
  phanTram: number;
  trangThai: "dung" | "lon-hon" | "nho-hon";
}

export interface KetQuaCoiNoi {
  chieu: SoSanhChieu[];
  /** Có chiều lệch quá sai số: kích thước thùng không đúng giấy chứng nhận. */
  khongDung: boolean;
  /** Có chiều lớn hơn giấy quá sai số. */
  coiNoi: boolean;
  /** Thể tích lòng thùng (m³), chỉ có khi nhập đủ ba chiều. */
  theTich: { giay: number; doDuoc: number; chenh: number; phanTram: number } | null;
  khung: KhungPhat[];
}

const HANH_VI =
  "xe ô tô tải (kể cả rơ moóc và sơ mi rơ moóc) có kích thước thùng xe không đúng với thông số kỹ thuật được ghi trong giấy chứng nhận kiểm định an toàn kỹ thuật và bảo vệ môi trường của xe";

export const KHUNG_COI_NOI: readonly KhungPhat[] = [
  {
    doiTuong: "Người điều khiển",
    hanhVi: `Điều khiển ${HANH_VI}`,
    phatTu: 2_000_000,
    phatDen: 3_000_000,
    truDiem: 2,
    khacPhuc: ["Buộc khôi phục lại tình trạng ban đầu đã bị thay đổi do vi phạm hành chính gây ra"],
    canCu: `Điểm b khoản 4, điểm a khoản 11, điểm a khoản 13 Điều 13 ${ND_168}`,
    daDoiChieu: false,
  },
  {
    doiTuong: "Chủ xe",
    hanhVi: `Chủ xe đưa ${HANH_VI} tham gia giao thông`,
    phatTu: 28_000_000,
    phatDen: 30_000_000,
    toChuc: { phatTu: 56_000_000, phatDen: 60_000_000 },
    boSung: [
      "Tước quyền sử dụng giấy chứng nhận kiểm định và tem kiểm định của xe từ 01 tháng đến 03 tháng",
      "Trừ 02 điểm giấy phép lái xe nếu chủ xe là người trực tiếp điều khiển xe",
    ],
    khacPhuc: [
      "Buộc khôi phục lại hình dáng, kích thước ban đầu của xe và đăng kiểm lại trước khi đưa xe ra tham gia giao thông",
    ],
    canCu: `Điểm h khoản 14, điểm d khoản 18, điểm d khoản 19, điểm a khoản 21 Điều 32 ${ND_168}`,
    daDoiChieu: false,
  },
];

const tron2 = (n: number) => Math.round(n * 100) / 100;
const m3 = (d: number, r: number, c: number) => (d * r * c) / 1e9;

/**
 * So từng chiều đã nhập; `saiSo` (mm) là mức lệch còn coi là đúng. Kích thước theo giấy phải lớn
 * hơn 0.
 */
export function tinhCoiNoi(
  nhap: Partial<Record<Chieu, { giay: number; doDuoc: number }>>,
  saiSo = 0,
): KetQuaCoiNoi {
  const chieu: SoSanhChieu[] = [];
  for (const { ma } of CHIEU) {
    const c = nhap[ma];
    if (!c) continue;
    // Làm tròn tới 0,01 mm để bỏ sai số dấu phẩy động khi nhập số lẻ.
    const chenh = tron2(c.doDuoc - c.giay);
    chieu.push({
      chieu: ma,
      giay: c.giay,
      doDuoc: c.doDuoc,
      chenh,
      phanTram: tron2((chenh / c.giay) * 100),
      trangThai: chenh > saiSo ? "lon-hon" : chenh < -saiSo ? "nho-hon" : "dung",
    });
  }
  const khongDung = chieu.some((c) => c.trangThai !== "dung");
  let theTich: KetQuaCoiNoi["theTich"] = null;
  const { dai, rong, cao } = nhap;
  if (dai && rong && cao) {
    const giay = m3(dai.giay, rong.giay, cao.giay);
    const doDuoc = m3(dai.doDuoc, rong.doDuoc, cao.doDuoc);
    theTich = {
      giay: tron2(giay),
      doDuoc: tron2(doDuoc),
      chenh: tron2(doDuoc - giay),
      phanTram: tron2(((doDuoc - giay) / giay) * 100),
    };
  }
  return {
    chieu,
    khongDung,
    coiNoi: chieu.some((c) => c.trangThai === "lon-hon"),
    theTich,
    khung: khongDung ? [...KHUNG_COI_NOI] : [],
  };
}
