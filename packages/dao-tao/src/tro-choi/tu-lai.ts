/**
 * Trò "Tự lái qua phố" (docs/PLAN.md GĐ-T9, docs/GAME_DESIGN.md §5.9).
 *
 * Người chơi chọn ô tô con hoặc xe mô tô, lái từ điểm xuất phát tới đích qua một khu phố nhìn từ trên
 * xuống (tu-lai-pho.ts), bằng nút ga, phanh, trái, phải, xi nhan. Game âm thầm ghi lỗi; cuối lượt
 * xuất "biên bản" (M4) liệt kê từng lỗi, thời điểm, căn cứ, mức phạt.
 *
 * Người chơi gửi nhật ký điều khiển theo nhịp (M7). Thao tác đầu là `bat_dau` (loại xe, chế độ giảm
 * chuyển động) ở nhịp 0. Máy chủ chạy lại cả khu phố từ bản đồ và nhật ký, bỏ qua mọi kết quả máy
 * khách gửi. Thao tác ghi ở nhịp n được áp trước bước n → n+1, như trên điện thoại.
 *
 * Chấm: bắt đầu 100 điểm, mỗi lỗi trừ theo nhóm (nhẹ 5, vừa 10, nặng 20, va chạm 30); tới đích trong
 * giờ +10 (không vượt 100); không tới đích tối đa 50; không dưới 0.
 *
 * Bảng lỗi → mức phạt là nội dung có duyệt riêng (game_content, kieu = "anh_xa_loi", câu D9): tên hành
 * vi, lời giải thích, căn cứ và mã dòng mức phạt theo loại xe. Lỗi chưa có mã, hoặc mã chưa có mức
 * phạt đã duyệt tại ngày chơi, vẫn được ghi; dòng mức phạt ghi "Chưa có mức phạt đã duyệt".
 *
 * Không có gì bí mật trong đề: điện thoại cần cả bản đồ để lái. Đề không có bảng lỗi, lời giải thích,
 * căn cứ (khóa cấm của khung chung).
 */
import type { NhomBienBao, ThaoTacBienBao } from "../bien-bao.ts";
import { tron } from "../de-thi.ts";
import { NHIP_MS } from "../mo-phong/mo-phong.ts";
import { LOAI_XE_NGUOI_LAI, type LoaiXeNguoiLai } from "../mo-phong/xe-nguoi-lai.ts";
import { type DongBienBan, dongBienBan, type MucPhatDaDuyet } from "./chung/bien-ban.ts";
import type { CauHinhMan } from "./chung/man-choi.ts";
import { bamTrangThai, chayLaiRoiCham, docNhatKy, LoiNhatKy, type NhatKy } from "./chung/nhat-ky.ts";
import type { BuocLuot, DinhNghiaTroChoi, KetQuaChamBuoc } from "./khung.ts";
import {
  apThaoTacLai,
  buocPho,
  dungTheGioi,
  kiemTraBanDo,
  LOAI_LOI_LAI,
  type LoaiLoiLai,
  type LoiLai,
  NHIP_VET,
  type PayloadBanDo,
  SO_MAN_TU_LAI,
  type ThaoTacLai,
  type TheGioi,
  type TrangThaiPho,
  trangThaiDauPho,
} from "./tu-lai-pho.ts";

export {
  kiemTraBanDo,
  LOAI_LOI_LAI,
  type LoaiLoiLai,
  type LoiLai,
  type PayloadBanDo,
  SO_MAN_TU_LAI,
} from "./tu-lai-pho.ts";

export const MA_TU_LAI = "tu_lai";
export const DIEM_TOI_DA_TU_LAI = 100;
export const THUONG_DEN_DICH = 10;
export const TRAN_KHONG_DEN_DICH = 50;
/** Nhật ký một lượt: tối đa 5 phút mô phỏng, cộng dung sai. */
export const TONG_NHIP_TOI_DA_TU_LAI = (5 * 60_000) / NHIP_MS + 20;

/** Điểm trừ mỗi lỗi, theo nhóm của GAME_DESIGN §5.9 (nhẹ 5, vừa 10, nặng 20, va chạm 30). */
export const TRU_DIEM_LOI: Readonly<Record<LoaiLoiLai, number>> = {
  re_khong_xi_nhan: 5,
  sai_lan: 10,
  qua_toc_do: 10,
  re_cam: 10,
  khong_nhuong_duong: 10,
  vuot_den_do: 20,
  khong_nhuong_nguoi_di_bo: 20,
  vao_duong_cam: 20,
  va_cham: 30,
};

/**
 * Tên và "đúng ra phải làm gì" mặc định của từng lỗi, là quy ước của trò chơi. Tên hành vi theo văn
 * bản, lời giải thích và căn cứ lấy từ bảng lỗi đã duyệt; thiếu thì dùng tên ở đây và ghi "Căn cứ
 * đang được cập nhật".
 */
export const LOI_MAC_DINH: Readonly<Record<LoaiLoiLai, { ten: string; dung_ra: string }>> = {
  vuot_den_do: {
    ten: "Không chấp hành hiệu lệnh của đèn tín hiệu",
    dung_ra: "Dừng trước vạch dừng khi đèn đỏ. Đèn vàng thì dừng nếu còn kịp dừng an toàn.",
  },
  qua_toc_do: {
    ten: "Chạy quá tốc độ ghi trên biển",
    dung_ra: "Giữ tốc độ không quá số ghi trên biển tốc độ tối đa.",
  },
  sai_lan: {
    ten: "Đi không đúng phần đường",
    dung_ra: "Đi bên phải theo chiều đi của mình; không lấn sang phần đường chiều ngược lại.",
  },
  khong_nhuong_nguoi_di_bo: {
    ten: "Không nhường đường cho người đi bộ ở nơi có vạch kẻ đường dành cho người đi bộ",
    dung_ra: "Giảm tốc, dừng trước vạch, chờ người đi bộ sang hết rồi mới đi.",
  },
  re_khong_xi_nhan: {
    ten: "Chuyển hướng, chuyển làn không có tín hiệu báo trước",
    dung_ra: "Bật xi nhan đúng bên trước khi rẽ, chuyển làn, quay đầu.",
  },
  vao_duong_cam: {
    ten: "Đi vào đường cấm, đi ngược chiều của đường một chiều",
    dung_ra: "Không đi vào đoạn có biển cấm; tìm đường khác tới đích.",
  },
  re_cam: {
    ten: "Không chấp hành biển báo cấm rẽ",
    dung_ra: "Làm theo biển cấm rẽ trái, cấm rẽ phải, cấm đi thẳng ở nơi giao nhau.",
  },
  khong_nhuong_duong: {
    ten: "Không nhường đường tại nơi giao nhau",
    dung_ra: "Ở nơi giao nhau không có đèn, chờ xe đang đi trong nơi giao nhau qua hết rồi mới vào.",
  },
  va_cham: {
    ten: "Để xảy ra va chạm",
    dung_ra: "Giữ khoảng cách, giảm tốc, quan sát xe và người phía trước.",
  },
};

/* ------------------------------------------------------------------ */
/* Màn chơi                                                            */
/* ------------------------------------------------------------------ */

/**
 * 3 màn, mỗi màn gộp hai hàng của bảng màn trong GAME_DESIGN §5.9. Màn 1 không tính giờ (bản đồ màn 1
 * để `gio_giay` null); giờ màn 2, 3 nằm trong bản đồ.
 */
export const MAN_TU_LAI: readonly CauHinhMan[] = [
  {
    so: 1,
    ten: "Màn 1: Làm quen",
    moTa: "Phố vắng, đèn tín hiệu, biển tốc độ, biển cấm rẽ. Không có xe khác. Không tính giờ.",
    caLuotMs: null,
    xpCoBan: 10,
  },
  {
    so: 2,
    ten: "Màn 2: Phố đông",
    moTa: "Có xe khác, người đi bộ sang đường, đường hai làn. Có giờ.",
    caLuotMs: null,
    xpCoBan: 12,
  },
  {
    so: 3,
    ten: "Màn 3: Giờ cao điểm",
    moTa: "Nơi giao nhau không đèn, đường một chiều, người đi bộ bất ngờ bước ra. Có giờ.",
    caLuotMs: null,
    xpCoBan: 14,
  },
];

const ganMan = (man: number | undefined) =>
  Math.min(SO_MAN_TU_LAI, Math.max(1, Number.isInteger(man) ? (man as number) : 1));

/* ------------------------------------------------------------------ */
/* Bảng lỗi → mức phạt                                                 */
/* ------------------------------------------------------------------ */

/** Một bậc quá tốc độ: vượt từ `tu` tới `den` km/h (đều gồm cận, `den` null là không giới hạn trên). */
export interface BacTocDo {
  tu: number;
  den: number | null;
  ma: string;
}

export interface MucLoiAnhXa {
  /** Tên hành vi theo văn bản. */
  ten?: string;
  giai_thich?: string;
  /** URN điều khoản; null khi chưa có trong kho. */
  can_cu?: string | null;
  /** Mã dòng mức phạt theo loại xe người chơi. */
  muc_phat?: Partial<Record<LoaiXeNguoiLai, string | null>>;
  /** Quá tốc độ: mã theo bậc km/h vượt, theo loại xe. */
  bac_toc_do?: Partial<Record<LoaiXeNguoiLai, BacTocDo[]>>;
}

/** Bảng lỗi → mức phạt, lưu ở game_content.payload (kieu = "anh_xa_loi"). */
export interface PayloadAnhXaLoi {
  kieu: "anh_xa_loi";
  loi: Partial<Record<LoaiLoiLai, MucLoiAnhXa>>;
}

/** Kiểm bảng lỗi. Rỗng là hợp lệ. */
export function kiemTraAnhXaLoi(
  p: Partial<PayloadAnhXaLoi> | null | undefined,
): Array<{ phan_tu: string; loi: string }> {
  const loi: Array<{ phan_tu: string; loi: string }> = [];
  if (!p || p.kieu !== "anh_xa_loi" || !p.loi || typeof p.loi !== "object")
    return [{ phan_tu: "anh_xa", loi: 'Bảng lỗi cần kieu = "anh_xa_loi" và danh sách lỗi (loi).' }];
  for (const [k, m] of Object.entries(p.loi)) {
    const pt = `loi:${k}`;
    if (!(LOAI_LOI_LAI as readonly string[]).includes(k)) {
      loi.push({ phan_tu: pt, loi: `Lỗi "${k}" không có trong trò.` });
      continue;
    }
    if (!m || typeof m !== "object") {
      loi.push({ phan_tu: pt, loi: `Lỗi ${k}: cần một đối tượng.` });
      continue;
    }
    for (const [xe, ma] of Object.entries(m.muc_phat ?? {}))
      if (!LOAI_XE_NGUOI_LAI.includes(xe as LoaiXeNguoiLai) || (ma !== null && typeof ma !== "string"))
        loi.push({ phan_tu: pt, loi: `Lỗi ${k}: mức phạt của "${xe}" không hợp lệ.` });
    for (const [xe, bac] of Object.entries(m.bac_toc_do ?? {})) {
      if (k !== "qua_toc_do") loi.push({ phan_tu: pt, loi: `Lỗi ${k}: chỉ lỗi quá tốc độ có bậc tốc độ.` });
      if (!LOAI_XE_NGUOI_LAI.includes(xe as LoaiXeNguoiLai) || !Array.isArray(bac)) {
        loi.push({ phan_tu: pt, loi: `Lỗi ${k}: bậc tốc độ của "${xe}" không hợp lệ.` });
        continue;
      }
      for (const b of bac)
        if (
          !Number.isInteger(b?.tu) ||
          (b.den !== null && !Number.isInteger(b.den)) ||
          typeof b.ma !== "string"
        )
          loi.push({ phan_tu: pt, loi: `Lỗi ${k}: mỗi bậc tốc độ cần tu, den (số km/h hoặc null) và ma.` });
    }
  }
  return loi;
}

/** Các mã mức phạt bảng lỗi trỏ tới. */
export function maMucPhatCuaAnhXa(a: PayloadAnhXaLoi | null | undefined): string[] {
  const ma = new Set<string>();
  for (const m of Object.values(a?.loi ?? {})) {
    for (const v of Object.values(m?.muc_phat ?? {})) if (v) ma.add(v);
    for (const bac of Object.values(m?.bac_toc_do ?? {})) for (const b of bac ?? []) ma.add(b.ma);
  }
  return [...ma].sort();
}

/** Mã mức phạt của một lỗi cụ thể, hoặc null. */
export function maMucPhatCuaLoi(a: PayloadAnhXaLoi | null, l: LoiLai, xe: LoaiXeNguoiLai): string | null {
  const m = a?.loi[l.loai];
  if (!m) return null;
  if (l.loai === "qua_toc_do" && l.toc_do !== undefined && l.gioi_han !== undefined) {
    const vuot = l.toc_do - l.gioi_han;
    const b = (m.bac_toc_do?.[xe] ?? []).find((x) => vuot >= x.tu && (x.den === null || vuot <= x.den));
    if (b) return b.ma;
  }
  return m.muc_phat?.[xe] ?? null;
}

/* ------------------------------------------------------------------ */
/* Nguồn, bước, đề                                                     */
/* ------------------------------------------------------------------ */

/** Biển đã duyệt dùng trên bản đồ (để vẽ và gọi tên). */
export interface BienTuLai {
  ma: string;
  version: number;
  nhom: NhomBienBao;
  ten: string;
  anh: string;
  can_cu: string;
  phan_ung: ThaoTacBienBao | null;
}

/** Một nguồn của trò: bản đồ đã duyệt kèm biển đã duyệt, bảng lỗi đã duyệt, mức phạt đã duyệt. */
export interface NguonTuLai {
  id: string;
  code: string;
  version: number;
  topic_id: string | null;
  ban_do: PayloadBanDo;
  bien: BienTuLai[];
  anh_xa: PayloadAnhXaLoi | null;
  muc_phat: Record<string, MucPhatDaDuyet>;
}

export interface BuocTuLai {
  man: number;
  ban_do: PayloadBanDo;
  bien: BienTuLai[];
  anh_xa: PayloadAnhXaLoi | null;
  muc_phat: Record<string, MucPhatDaDuyet>;
}

/** Phần đề gửi người chơi: bản đồ và hình biển, không có bảng lỗi, căn cứ. */
export interface DeTuLai {
  man: number;
  ban_do: PayloadBanDo;
  bien: Array<{ ma: string; ten: string; anh: string }>;
  xe: readonly LoaiXeNguoiLai[];
}

export const THAO_TAC_TU_LAI = ["bat_dau", "ga", "phanh", "lai", "xi_nhan"] as const;
export type ThaoTacTuLai = (typeof THAO_TAC_TU_LAI)[number];
export type ThamSoTuLai = { xe: LoaiXeNguoiLai; giam: boolean } | boolean | "trai" | "phai" | null;
export type TraLoiTuLai = NhatKy<ThaoTacTuLai, ThamSoTuLai>;

/** Các mã biển một bản đồ dùng. */
export const maBienCuaBanDo = (bd: Pick<PayloadBanDo, "bien">) =>
  [...new Set(bd.bien.map((b) => b.ma))].sort();

/* ------------------------------------------------------------------ */
/* Chạy lại                                                            */
/* ------------------------------------------------------------------ */

/** Đọc thao tác `bat_dau` đầu nhật ký. Sai thì ném LoiNhatKy. */
export function batDauCua(nk: TraLoiTuLai): { xe: LoaiXeNguoiLai; giam: boolean } {
  const dau = nk.thao_tac[0];
  if (!dau || dau.thao_tac !== "bat_dau" || dau.nhip !== 0)
    throw new LoiNhatKy("Nhật ký phải bắt đầu bằng chọn xe ở nhịp 0.");
  return dau.tham_so as { xe: LoaiXeNguoiLai; giam: boolean };
}

/** Đổi một thao tác nhật ký (trừ bat_dau) thành thao tác lái. */
export function thaoTacLaiCua(t: { thao_tac: ThaoTacTuLai; tham_so: ThamSoTuLai }): ThaoTacLai {
  switch (t.thao_tac) {
    case "ga":
    case "phanh":
      return { thao_tac: t.thao_tac, tham_so: t.tham_so as boolean };
    case "lai":
      return { thao_tac: "lai", tham_so: t.tham_so as "trai" | "phai" };
    case "xi_nhan":
      return { thao_tac: "xi_nhan", tham_so: t.tham_so as "trai" | "phai" | null };
    default:
      throw new LoiNhatKy("Nhật ký chọn xe hai lần.");
  }
}

export interface KetQuaChayTuLai {
  the: TheGioi;
  tt: TrangThaiPho;
}

/**
 * Chạy lại cả lượt từ bản đồ và nhật ký, tới khi xong, hết giờ, hoặc tới `tong_nhip` của nhật ký
 * (`denNhip` nhỏ hơn thì dừng ở đó, dùng để phát lại một khoảnh khắc). Ném LoiNhatKy khi nhật ký sai.
 */
export function chayLaiTuLai(bd: PayloadBanDo, nk: TraLoiTuLai, denNhip?: number): KetQuaChayTuLai {
  const { xe, giam } = batDauCua(nk);
  const the = dungTheGioi(bd, xe, giam);
  let tt = trangThaiDauPho(the);
  const ops = nk.thao_tac;
  let i = 1;
  const gioi = Math.min(nk.tong_nhip, denNhip ?? Number.POSITIVE_INFINITY);
  while (!tt.ket_thuc && tt.nhip < gioi) {
    while (i < ops.length && ops[i]!.nhip <= tt.nhip) tt = apThaoTacLai(the, tt, thaoTacLaiCua(ops[i++]!));
    tt = buocPho(the, tt);
  }
  if (!tt.ket_thuc && denNhip === undefined) tt = { ...tt, ket_thuc: "dung" };
  return { the, tt };
}

/* ------------------------------------------------------------------ */
/* Chấm                                                                */
/* ------------------------------------------------------------------ */

export interface LoiTuLaiKetQua extends LoiLai {
  stt: number;
  tru: number;
  /** Mô tả lỗi theo văn bản (từ bảng lỗi đã duyệt, hoặc tên mặc định). */
  ten: string;
  dung_ra: string;
  giai_thich: string;
  /** Dòng biên bản (M4). */
  bien_ban: DongBienBan;
}

export interface ChiTietTuLai {
  hop_le: boolean;
  ly_do: string | null;
  xe: LoaiXeNguoiLai | null;
  giam: boolean;
  den_dich: boolean;
  ket_thuc: TrangThaiPho["ket_thuc"];
  /** Nhịp cuối của lần chạy lại. */
  nhip: number;
  diem: number;
  thuong_den_dich: number;
  loi: LoiTuLaiKetQua[];
  /** Vết đầu xe (cm), mỗi NHIP_VET nhịp. */
  vet: number[];
  nhip_vet: number;
  /** Băm trạng thái cuối (test máy chủ và điện thoại khớp nhau). */
  bam: string;
}

/** Điểm của một lượt từ các lỗi và việc tới đích. */
export function diemTuLai(
  loi: readonly Pick<LoiLai, "loai">[],
  denDich: boolean,
): { diem: number; thuong: number } {
  const tru = loi.reduce((s, l) => s + TRU_DIEM_LOI[l.loai], 0);
  const thuong = denDich ? THUONG_DEN_DICH : 0;
  let diem = Math.min(DIEM_TOI_DA_TU_LAI, DIEM_TOI_DA_TU_LAI - tru + thuong);
  if (!denDich) diem = Math.min(diem, TRAN_KHONG_DEN_DICH);
  return { diem: Math.max(0, diem), thuong };
}

/** "1:05": thời điểm của nhịp trong lượt. */
export const thoiDiem = (nhip: number) => {
  const s = Math.floor((nhip * NHIP_MS) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Băm trạng thái cuối, cùng cách ở máy chủ và điện thoại. */
export function bamTuLai(tt: TrangThaiPho): string {
  return bamTrangThai({
    nhip: tt.nhip,
    nguoi: tt.nguoi,
    xe: tt.mp.xe.map((x) => [x.id, x.x, x.y, x.v, x.trang_thai]),
    di_bo: tt.di_bo,
    loi: tt.loi,
    ket_thuc: tt.ket_thuc,
  });
}

/** Dựng kết quả chi tiết (lỗi, biên bản, vết) từ trạng thái cuối. */
export function ketQuaTuLai(
  b: Pick<BuocTuLai, "anh_xa" | "muc_phat">,
  xe: LoaiXeNguoiLai,
  giam: boolean,
  tt: TrangThaiPho,
): ChiTietTuLai {
  const denDich = tt.ket_thuc === "den_dich";
  const { diem, thuong } = diemTuLai(tt.loi, denDich);
  const loi: LoiTuLaiKetQua[] = [...tt.loi]
    .sort((a, c) => a.nhip - c.nhip)
    .map((l, i) => {
      const m = b.anh_xa?.loi[l.loai];
      const ten = m?.ten || LOI_MAC_DINH[l.loai].ten;
      return {
        ...l,
        stt: i + 1,
        tru: TRU_DIEM_LOI[l.loai],
        ten,
        dung_ra: LOI_MAC_DINH[l.loai].dung_ra,
        giai_thich: m?.giai_thich ?? "",
        bien_ban: dongBienBan({
          hanhVi: ten,
          chiTiet: `Lúc ${thoiDiem(l.nhip)}: ${l.chi_tiet}`,
          canCu: m?.can_cu ? [m.can_cu] : [],
          maMucPhat: maMucPhatCuaLoi(b.anh_xa, l, xe),
          mucPhat: b.muc_phat,
        }),
      };
    });
  return {
    hop_le: true,
    ly_do: null,
    xe,
    giam,
    den_dich: denDich,
    ket_thuc: tt.ket_thuc,
    nhip: tt.nhip,
    diem,
    thuong_den_dich: thuong,
    loi,
    vet: tt.vet,
    nhip_vet: NHIP_VET,
    bam: bamTuLai(tt),
  };
}

function dungBuoc(n: NguonTuLai, man: number): BuocLuot<BuocTuLai> {
  return {
    thu_tu: 1,
    ref_kind: "game_content",
    ref_id: n.id,
    ref_version: n.version,
    topic_id: n.topic_id,
    diem_toi_da: DIEM_TOI_DA_TU_LAI,
    noi_dung: {
      man,
      ban_do: n.ban_do,
      bien: n.bien.filter((b) => n.ban_do.bien.some((x) => x.ma === b.ma)),
      anh_xa: n.anh_xa,
      muc_phat: n.muc_phat,
    },
  };
}

/** Nguồn dùng được: bản đồ hợp lệ và mọi biển trên bản đồ đã duyệt. */
export function nguonTuLaiDungDuoc(n: NguonTuLai): boolean {
  if (!n?.ban_do || !Array.isArray(n.bien)) return false;
  return kiemTraBanDo(n.ban_do, new Set(n.bien.map((b) => b.ma))).length === 0;
}

export const TRO_CHOI_TU_LAI: DinhNghiaTroChoi<BuocTuLai, DeTuLai, TraLoiTuLai> = {
  ma: MA_TU_LAI,
  ten: "Tự lái qua phố",
  moTa: "Lái xe qua khu phố từ điểm xuất phát tới đích. Game âm thầm ghi lỗi và lập biên bản cuối lượt.",
  offline: true,
  nguon: "tu_lai_ban_do",
  soBuoc: 1,
  thoiGian: null,
  thuongNhanh: false,
  xpCoBan: 10,
  manChoi: MAN_TU_LAI,

  locNguon(nguon) {
    return (nguon as NguonTuLai[]).filter(nguonTuLaiDungDuoc);
  },

  taoLuot(nguon, rng, man) {
    const m = ganMan(man);
    const ds = (this.locNguon(nguon) as NguonTuLai[])
      .filter((n) => n.ban_do.man === m)
      .sort((a, b) => a.id.localeCompare(b.id));
    const chon = tron(ds, rng)[0];
    return chon ? [dungBuoc(chon, m)] : [];
  },

  deChoNguoiChoi(buoc) {
    const b = buoc.noi_dung;
    return {
      man: b.man,
      ban_do: b.ban_do,
      bien: b.bien.map((x) => ({ ma: x.ma, ten: x.ten, anh: x.anh })),
      xe: LOAI_XE_NGUOI_LAI,
    };
  },

  docTraLoi(raw) {
    return docNhatKy<ThaoTacTuLai, ThamSoTuLai>(
      raw,
      (thaoTac, thamSo) => {
        switch (thaoTac) {
          case "bat_dau": {
            if (!thamSo || typeof thamSo !== "object") return null;
            const { xe, giam } = thamSo as Record<string, unknown>;
            if (!LOAI_XE_NGUOI_LAI.includes(xe as LoaiXeNguoiLai) || typeof giam !== "boolean") return null;
            return { thao_tac: "bat_dau", tham_so: { xe: xe as LoaiXeNguoiLai, giam } };
          }
          case "ga":
          case "phanh":
            return typeof thamSo === "boolean" ? { thao_tac: thaoTac, tham_so: thamSo } : null;
          case "lai":
            return thamSo === "trai" || thamSo === "phai" ? { thao_tac: "lai", tham_so: thamSo } : null;
          case "xi_nhan":
            return thamSo === "trai" || thamSo === "phai" || thamSo === null
              ? { thao_tac: "xi_nhan", tham_so: thamSo }
              : null;
          default:
            return null;
        }
      },
      { tongNhipToiDa: TONG_NHIP_TOI_DA_TU_LAI },
    );
  },

  chamBuoc(buoc, tl, ngCanh): KetQuaChamBuoc {
    const b = buoc.noi_dung;
    const kq = chayLaiRoiCham(tl, ngCanh?.thoiGianMs ?? null, (nk) => {
      const { xe, giam } = batDauCua(nk);
      const { tt } = chayLaiTuLai(b.ban_do, nk);
      return ketQuaTuLai(b, xe, giam, tt);
    });
    const chiTiet: ChiTietTuLai = kq.hop_le
      ? kq.ket_qua
      : {
          hop_le: false,
          ly_do: kq.ly_do,
          xe: null,
          giam: false,
          den_dich: false,
          ket_thuc: null,
          nhip: 0,
          diem: 0,
          thuong_den_dich: 0,
          loi: [],
          vet: [],
          nhip_vet: NHIP_VET,
          bam: "",
        };
    const giaiThich = !kq.hop_le
      ? `Không chấm được lượt lái: ${kq.ly_do}`
      : `${chiTiet.den_dich ? "Tới đích" : chiTiet.ket_thuc === "het_gio" ? "Hết giờ, chưa tới đích" : "Dừng lượt, chưa tới đích"}. ${
          chiTiet.loi.length ? `Mắc ${chiTiet.loi.length} lỗi.` : "Không mắc lỗi nào."
        }`;
    return {
      diem: chiTiet.diem,
      diemToiDa: buoc.diem_toi_da,
      // "Đúng" khi đủ điểm (khớp điểm hiện trên khung phản hồi); lỗi nhẹ bù bằng thưởng tới đích vẫn ở biên bản.
      dung: kq.hop_le && chiTiet.diem >= buoc.diem_toi_da,
      chiTiet,
      giaiThich,
      canCu: [...new Set(chiTiet.loi.flatMap((l) => l.bien_ban.can_cu))],
    };
  },
};
