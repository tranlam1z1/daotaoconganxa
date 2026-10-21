/**
 * Tính mức xử phạt nồng độ cồn (routes/cong-cu.nong-do-con.tsx): từ kết quả đo và loại xe ra mức vi
 * phạm, khung tiền phạt, trừ điểm hoặc tước giấy phép lái xe.
 *
 * Ba mức theo kết quả đo, giống nhau ở mọi loại xe:
 * - Mức 1: có nồng độ cồn nhưng chưa vượt quá 50 mg/100 ml máu hoặc 0,25 mg/1 lít khí thở.
 * - Mức 2: vượt quá 50 đến 80 mg/100 ml máu hoặc vượt quá 0,25 đến 0,4 mg/1 lít khí thở.
 * - Mức 3: vượt quá 80 mg/100 ml máu hoặc vượt quá 0,4 mg/1 lít khí thở.
 * Không chấp hành yêu cầu kiểm tra nồng độ cồn bị phạt bằng khung của mức 3.
 *
 * Căn cứ: Điều 6, 7, 8, 9 Nghị định số 168/2024/NĐ-CP (xem lib/khung-phat.ts về việc đối chiếu).
 */
import { type KhungPhat, ND_168 } from "./khung-phat";

export type LoaiXeCon = "o-to" | "mo-to" | "xe-may-chuyen-dung" | "xe-tho-so";
export type CachDo = "khi-tho" | "mau";
/** 0 là không có nồng độ cồn. */
export type MucCon = 0 | 1 | 2 | 3;

export const CACH_DO: Record<CachDo, { ten: string; donVi: string; nguong: readonly [number, number] }> = {
  "khi-tho": { ten: "Khí thở", donVi: "mg/1 lít khí thở", nguong: [0.25, 0.4] },
  mau: { ten: "Máu", donVi: "mg/100 ml máu", nguong: [50, 80] },
};

export const laCachDo = (v: string | null): v is CachDo => v !== null && v in CACH_DO;

/** Mức vi phạm theo kết quả đo: "chưa vượt quá" ngưỡng thì còn ở mức dưới. */
export function mucNongDo(cach: CachDo, giaTri: number): MucCon {
  if (giaTri <= 0) return 0;
  const [n1, n2] = CACH_DO[cach].nguong;
  if (giaTri <= n1) return 1;
  return giaTri <= n2 ? 2 : 3;
}

/** Khoảng nồng độ của một mức theo đơn vị của cách đo, ví dụ "Vượt quá 0,25 đến 0,4 mg/1 lít khí thở". */
export function moTaMuc(cach: CachDo, muc: 1 | 2 | 3): string {
  const { donVi, nguong } = CACH_DO[cach];
  const [n1, n2] = nguong.map((n) => n.toLocaleString("vi-VN"));
  if (muc === 1) return `Chưa vượt quá ${n1} ${donVi}`;
  return muc === 2 ? `Vượt quá ${n1} đến ${n2} ${donVi}` : `Vượt quá ${n2} ${donVi}`;
}

const HANH_VI: Record<1 | 2 | 3, string> = {
  1: "Điều khiển xe trên đường mà trong máu hoặc hơi thở có nồng độ cồn nhưng chưa vượt quá 50 miligam/100 mililít máu hoặc chưa vượt quá 0,25 miligam/1 lít khí thở",
  2: "Điều khiển xe trên đường mà trong máu hoặc hơi thở có nồng độ cồn vượt quá 50 miligam đến 80 miligam/100 mililít máu hoặc vượt quá 0,25 miligam đến 0,4 miligam/1 lít khí thở",
  3: "Điều khiển xe trên đường mà trong máu hoặc hơi thở có nồng độ cồn vượt quá 80 miligam/100 mililít máu hoặc vượt quá 0,4 miligam/1 lít khí thở",
};
const HANH_VI_KHONG_CHAP_HANH = "Không chấp hành yêu cầu kiểm tra về nồng độ cồn của người thi hành công vụ";

const TUOC_GPLX = "Tước quyền sử dụng giấy phép lái xe từ 22 tháng đến 24 tháng";
const TR = 1_000_000;

type Dong = Omit<KhungPhat, "doiTuong" | "hanhVi" | "daDoiChieu">;

const khung = (hanhVi: string, d: Dong): KhungPhat => ({
  doiTuong: "Người điều khiển",
  hanhVi,
  daDoiChieu: false,
  ...d,
});

/** Một loại xe: ba khung theo mức 1, 2, 3 và khung không chấp hành kiểm tra. */
function bang(muc: readonly [Dong, Dong, Dong], khongChapHanh: Dong) {
  return {
    muc: [khung(HANH_VI[1], muc[0]), khung(HANH_VI[2], muc[1]), khung(HANH_VI[3], muc[2])] as const,
    khongChapHanh: khung(HANH_VI_KHONG_CHAP_HANH, khongChapHanh),
  };
}

export const LOAI_XE_CON: Record<
  LoaiXeCon,
  { ten: string; moTa: string; muc: readonly [KhungPhat, KhungPhat, KhungPhat]; khongChapHanh: KhungPhat }
> = {
  "o-to": {
    ten: "Ô tô",
    moTa: "Xe ô tô, xe chở người bốn bánh có gắn động cơ, xe chở hàng bốn bánh có gắn động cơ và các loại xe tương tự xe ô tô",
    ...bang(
      [
        {
          phatTu: 6 * TR,
          phatDen: 8 * TR,
          truDiem: 4,
          canCu: `Điểm c khoản 6, điểm b khoản 16 Điều 6 ${ND_168}`,
        },
        {
          phatTu: 18 * TR,
          phatDen: 20 * TR,
          truDiem: 10,
          canCu: `Điểm a khoản 9, điểm d khoản 16 Điều 6 ${ND_168}`,
        },
        {
          phatTu: 30 * TR,
          phatDen: 40 * TR,
          boSung: [TUOC_GPLX],
          canCu: `Điểm a khoản 11, điểm c khoản 15 Điều 6 ${ND_168}`,
        },
      ],
      {
        phatTu: 30 * TR,
        phatDen: 40 * TR,
        boSung: [TUOC_GPLX],
        canCu: `Điểm b khoản 11, điểm c khoản 15 Điều 6 ${ND_168}`,
      },
    ),
  },
  "mo-to": {
    ten: "Xe máy",
    moTa: "Xe mô tô, xe gắn máy, các loại xe tương tự xe mô tô và các loại xe tương tự xe gắn máy",
    ...bang(
      [
        {
          phatTu: 2 * TR,
          phatDen: 3 * TR,
          truDiem: 4,
          canCu: `Điểm a khoản 6, điểm b khoản 13 Điều 7 ${ND_168}`,
        },
        {
          phatTu: 6 * TR,
          phatDen: 8 * TR,
          truDiem: 10,
          canCu: `Điểm b khoản 8, điểm d khoản 13 Điều 7 ${ND_168}`,
        },
        {
          phatTu: 8 * TR,
          phatDen: 10 * TR,
          boSung: [TUOC_GPLX],
          canCu: `Điểm d khoản 9, điểm c khoản 12 Điều 7 ${ND_168}`,
        },
      ],
      {
        phatTu: 8 * TR,
        phatDen: 10 * TR,
        boSung: [TUOC_GPLX],
        canCu: `Điểm đ khoản 9, điểm c khoản 12 Điều 7 ${ND_168}`,
      },
    ),
  },
  "xe-may-chuyen-dung": {
    ten: "Xe máy chuyên dùng",
    moTa: "Xe máy thi công, xe máy nông nghiệp, lâm nghiệp và các loại xe máy chuyên dùng khác",
    ...bang(
      [
        { phatTu: 3 * TR, phatDen: 5 * TR, canCu: `Điểm c khoản 6 Điều 8 ${ND_168}` },
        { phatTu: 6 * TR, phatDen: 8 * TR, canCu: `Điểm a khoản 7 Điều 8 ${ND_168}` },
        { phatTu: 18 * TR, phatDen: 20 * TR, canCu: `Điểm a khoản 9 Điều 8 ${ND_168}` },
      ],
      { phatTu: 18 * TR, phatDen: 20 * TR, canCu: `Điểm b khoản 9 Điều 8 ${ND_168}` },
    ),
  },
  "xe-tho-so": {
    ten: "Xe đạp, xe thô sơ",
    moTa: "Xe đạp, xe đạp máy và các loại xe thô sơ khác",
    ...bang(
      [
        { phatTu: 100_000, phatDen: 200_000, canCu: `Điểm p khoản 1 Điều 9 ${ND_168}` },
        { phatTu: 300_000, phatDen: 400_000, canCu: `Điểm d khoản 3 Điều 9 ${ND_168}` },
        { phatTu: 400_000, phatDen: 600_000, canCu: `Điểm b khoản 4 Điều 9 ${ND_168}` },
      ],
      { phatTu: 400_000, phatDen: 600_000, canCu: `Điểm c khoản 4 Điều 9 ${ND_168}` },
    ),
  },
};

export const laLoaiXeCon = (v: string | null): v is LoaiXeCon => v !== null && v in LOAI_XE_CON;

export interface KetQuaCon {
  /** null khi không chấp hành yêu cầu kiểm tra (không có kết quả đo). */
  muc: MucCon | null;
  /** null khi không có nồng độ cồn. */
  khung: KhungPhat | null;
}

/** Tra khung phạt theo loại xe và kết quả đo. */
export function tinhMucPhatCon(loai: LoaiXeCon, cach: CachDo, giaTri: number): KetQuaCon {
  const muc = mucNongDo(cach, giaTri);
  return { muc, khung: LOAI_XE_CON[loai].muc[muc - 1] ?? null };
}

export function khongChapHanhKiemTra(loai: LoaiXeCon): KetQuaCon {
  return { muc: null, khung: LOAI_XE_CON[loai].khongChapHanh };
}
