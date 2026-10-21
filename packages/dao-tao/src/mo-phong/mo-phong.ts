/**
 * Bộ mô phỏng giao thông tất định (mô-đun M5, docs/GAME_DESIGN.md §2.3, §4).
 *
 * Luật tất định:
 *  - Bước thời gian cố định NHIP_MS (50 ms, 20 nhịp mỗi giây). Hình vẽ nội suy giữa hai nhịp.
 *  - Số nguyên ở mọi chỗ: bản đồ cm, quãng đường và tốc độ của xe mm, mm/nhịp.
 *  - Không dùng Math.sin, Math.cos, Math.atan2, Math.random, Date.now (test quét mã nguồn). Căn
 *    bậc hai được dùng vì chuẩn IEEE bắt buộc làm tròn đúng.
 *  - Mỗi nhịp, mọi xe quyết định tốc độ từ ảnh chụp của nhịp TRƯỚC, rồi mới cùng di chuyển; xe duyệt
 *    theo thứ tự id. Nhờ vậy kết quả không phụ thuộc thứ tự xử lý.
 *
 * Người lái mô phỏng: chạy tới tốc độ tối đa; thấy biển thì phản ứng theo `phan_ung` của biển;
 * thấy đặc điểm nguy hiểm (chỉ khi đã tới gần, NHIN_THAY_DAC_DIEM_CM) thì giảm về tốc độ an toàn;
 * giữ khoảng cách với xe trước. Phải phanh mạnh hơn mức bình thường là "phanh gấp"; vào đặc điểm
 * nhanh hơn tốc độ an toàn quá DUNG_SAI_TOC_DO là "nguy hiểm".
 *
 * Rẽ: xe đi hết làn thì sang làn kế tiếp trong lộ trình (`XeKhoiTao.lo_trinh`), phần quãng đường dư
 * đi tiếp trên làn mới; đổi hướng thì phát sự kiện `re`. Trước khúc ngoặt trong một làn và trước chỗ
 * rẽ, người lái giảm về TOC_DO_QUA_KHUC theo độ gắt. Xe chỉ giữ khoảng cách với xe CÙNG làn: ở giao
 * lộ, xe các làn khác nhau không nhường nhau (luật nhường đường là việc của trò 8).
 *
 * Va chạm: sau khi mọi xe di chuyển, hai xe có hộp bao chồng nhau là va chạm (sự kiện `va_cham`, một
 * lần mỗi cặp); cả hai dừng tại chỗ, trạng thái `va_cham`. Hộp bao là hình chữ nhật thẳng trục; xe đi
 * chéo dùng hộp bao ngoài của hình xe xoay 45° (lớn hơn xe thật một chút, nghiêng về báo va chạm).
 *
 * Trò 3 dùng: một làn, biển, đặc điểm, xe tự chạy. Kiểu sự kiện có sẵn tên cho trò 5, 8, 9, 10.
 *
 * GĐ-T5 (Soi camera), mọi phần đều tùy chọn trong cấu hình:
 *  - Đèn tín hiệu (den.ts): xe dừng trước vạch khi đèn đỏ, hoặc khi đèn vàng mà còn kịp dừng bằng
 *    phanh thường; xe có `bo_qua_den` thì không dừng. Qua vạch lúc đèn đỏ: sự kiện `vuot_den_do`.
 *  - Làn dành cho loại xe (`Lan.danh_cho`): xe khác loại vào làn thì phát `sai_lan` lúc vào đường.
 *  - Xe máy không đội mũ bảo hiểm: phát `khong_mu_bao_hiem` lúc vào đường.
 *  - Dừng theo kịch bản (`XeKhoiTao.dung`): xe dừng tại chỗ đã định; trong vùng cấm dừng thì phát
 *    `dung_do_sai`, ngoài vùng thì `dung_xe`; đi tiếp thì phát `tiep_tuc`.
 *  - `chay_du_nhip`: không tự kết thúc khi mọi xe đứng yên (xe chờ đèn đỏ); người gọi tự giới hạn nhịp.
 *
 * GĐ-T15 (Dựng chốt an toàn ban đêm), mọi phần đều tùy chọn; cấu hình không có thì chạy y như cũ:
 *  - Vật cản tạm (vat-can.ts): xe thấy vật cản trên làn mình thì sang làn tránh khi đủ chỗ (sự kiện
 *    `chuyen_lan`), không thì dừng trước vật cản chờ. Ban ngày thấy vật cản từ TAM_NHIN_BIEN_CM.
 *  - Ban đêm (`dem`, tam-nhin.ts): tầm nhìn tới biển, vật cản theo đèn pha, đèn cảnh báo và đoạn khuất,
 *    tra bảng, thay cho TAM_NHIN_BIEN_CM. Xe đã thấy (hoặc đã qua) một vật cảnh báo thì giảm dần về
 *    TOC_DO_CHAM trước vùng chốt; xe chưa được cảnh báo chỉ giảm khi đã thấy vật cản, có thể phải phanh
 *    gấp. Trong vùng chốt mọi xe đi không quá TOC_DO_CHAM.
 *  - Người đứng trên đường (`nguoi`): hộp bao xe vào vùng nguy hiểm thì phát `vao_vung_nguy_hiem`.
 *  - Xe vào đường giữa làn (`XeKhoiTao.s_vao`, xe từ đường ngang rẽ vào): vào ở TOC_DO_CHAM.
 *  - Hàng chờ đo bằng `doHangCho` (vat-can.ts), đọc trạng thái, không nằm trong vòng bước.
 */
import {
  type BienTrenDuong,
  NHIP_DUNG_TAI_BIEN,
  TAM_NHIN_BIEN_CM,
  TOC_DO_CHAM,
  VUNG_GIAM_TOC_CM,
} from "./bien.ts";
import { type DenTinHieu, LUI_VACH_MM, mauDen, TAM_NHIN_DEN_CM } from "./den.ts";
import {
  BUOC_HUONG,
  type DacDiem,
  doLechHuong,
  dungLan,
  type Lan,
  type LanDaDung,
  TOC_DO_AN_TOAN,
  type VungCamDung,
  viTriTrenLan,
} from "./duong.ts";
import { type CanhDem, type DoanKhuat, type LoaiVatNhin, thayDuoc } from "./tam-nhin.ts";
import {
  coChoChuyenLan,
  DUNG_TRUOC_VAT_CAN_CM,
  type NguoiTrenDuong,
  trongVungNguyHiem,
  type VatCan,
  vatCanPhiaTruoc,
  XET_CHUYEN_LAN_CM,
} from "./vat-can.ts";
import {
  KHOANG_CACH_TOI_THIEU_CM,
  kichThuocXe,
  PHANH_DU_KIEN,
  PHANH_GAP,
  PHANH_THUONG,
  TANG_TOC,
  TOC_DO_QUA_KHUC,
  type Xe,
  type XeKhoiTao,
} from "./xe.ts";

/** Một nhịp logic, ms. */
export const NHIP_MS = 50;
/** Một lượt mô phỏng tối đa 5 phút. */
export const NHIP_TOI_DA = (5 * 60_000) / NHIP_MS;
/** Không xe nào nhúc nhích trong số nhịp này (3 giây) thì kết thúc. */
export const NHIP_DUNG_YEN_KET_THUC = 60;
/** Không có biển, người lái chỉ thấy đặc điểm nguy hiểm khi còn cách chừng này (cm). */
export const NHIN_THAY_DAC_DIEM_CM = 1200;
/** Vào đặc điểm nhanh hơn tốc độ an toàn quá mức này (mm/nhịp, ≈ 10 km/h) là nguy hiểm. */
export const DUNG_SAI_TOC_DO = 140;
/** Chỉ tính phanh gấp khi xe đang chạy nhanh hơn mức này (mm/nhịp, ≈ 10 km/h), không tính lúc nhích xe. */
export const TOC_DO_TINH_PHANH_GAP = 140;

/**
 * Sự kiện. Đang phát: phanh_gap, nguy_hiem, dung_theo_bien, bi_chan, qua_an_toan, ra_khoi_duong, re,
 * va_cham; GĐ-T15 thêm chuyen_lan, vao_vung_nguy_hiem. Các tên còn lại dành cho trò 5, 8, 9 (chưa phát).
 */
export type LoaiSuKien =
  | "phanh_gap"
  | "nguy_hiem"
  | "dung_theo_bien"
  | "bi_chan"
  | "qua_an_toan"
  | "ra_khoi_duong"
  | "vuot_den_do"
  | "qua_toc_do"
  | "va_cham"
  | "re"
  | "khong_nhuong_duong"
  | "sai_lan"
  | "dung_do_sai"
  | "khong_mu_bao_hiem"
  | "dung_xe"
  | "tiep_tuc"
  | "chuyen_lan"
  | "vao_vung_nguy_hiem";

export interface SuKien {
  nhip: number;
  loai: LoaiSuKien;
  xe: string;
  /** Đặc điểm gây ra sự kiện, nếu có. */
  dac_diem: string | null;
  /** Biển gây ra sự kiện, nếu có. */
  bien: string | null;
  x: number;
  y: number;
  /** Tốc độ của xe lúc đó, mm/nhịp. */
  v: number;
  /** Xe kia trong vụ va chạm (chỉ có ở `va_cham`). */
  xe_khac?: string;
  /** Đèn liên quan (chỉ có ở `vuot_den_do`). */
  den?: string;
  /** Vùng cấm dừng liên quan (chỉ có ở `dung_do_sai`). */
  vung?: string;
  /** GĐ-T15: vật cản hoặc vật cảnh báo gây phanh gấp; làn mới ở `chuyen_lan`. */
  vat?: string;
  /** GĐ-T15: người có vùng nguy hiểm bị xe đi vào (chỉ có ở `vao_vung_nguy_hiem`). */
  nguoi?: string;
}

/** GĐ-T15: vật cảnh báo đặt trên đường (biển quay về phía xe tới, đèn cảnh báo, xe tuần tra). */
export interface VatCanhBao {
  id: string;
  loai: Extract<LoaiVatNhin, "bien" | "den" | "xe">;
  /** Quãng đường dọc làn (mọi làn cùng quãng đường), cm. */
  s: number;
}

/** GĐ-T15: cảnh ban đêm. Mọi làn có vật cản phải song song, cùng quãng đường. */
export interface CauHinhDem {
  canh_bao: readonly VatCanhBao[];
  khuat: readonly DoanKhuat[];
  /** Vùng chốt (cm dọc làn): xe đi không quá TOC_DO_CHAM; null khi không có chốt. */
  vung_chot: { s_tu: number; s_den: number } | null;
}

export interface CauHinhMoPhong {
  lan: readonly Lan[];
  dac_diem: readonly DacDiem[];
  bien: readonly BienTrenDuong[];
  xe: readonly XeKhoiTao[];
  den?: readonly DenTinHieu[];
  vung_cam_dung?: readonly VungCamDung[];
  chay_du_nhip?: boolean;
  /** GĐ-T15. */
  vat_can?: readonly VatCan[];
  nguoi?: readonly NguoiTrenDuong[];
  dem?: CauHinhDem;
}

export interface MoPhong {
  lan: ReadonlyMap<string, LanDaDung>;
  dac_diem: readonly DacDiem[];
  bien: readonly BienTrenDuong[];
  xe: readonly XeKhoiTao[];
  den: readonly DenTinHieu[];
  vung_cam_dung: readonly VungCamDung[];
  chay_du_nhip: boolean;
  vat_can: readonly VatCan[];
  nguoi: readonly NguoiTrenDuong[];
  dem: CauHinhDem | null;
}

export interface TrangThaiMoPhong {
  nhip: number;
  xe: Xe[];
  su_kien: SuKien[];
  /** Số nhịp liên tiếp không xe nào di chuyển. */
  dung_yen: number;
  xong: boolean;
}

const theoId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Dựng bộ mô phỏng từ cấu hình. Ném lỗi khi cấu hình trỏ tới làn không có (lỗi lập trình). */
export function dungMoPhong(ch: CauHinhMoPhong): MoPhong {
  const lan = new Map(ch.lan.map((l) => [l.id, dungLan(l)]));
  const coLan = (id: string, cua: string) => {
    if (!lan.has(id)) throw new Error(`${cua} trỏ tới làn không có: ${id}.`);
  };
  for (const d of ch.dac_diem) coLan(d.lan, `Đặc điểm ${d.id}`);
  for (const b of ch.bien) coLan(b.lan, `Biển ${b.id}`);
  for (const x of ch.xe) {
    coLan(x.lan, `Xe ${x.id}`);
    let truoc = lan.get(x.lan)!;
    for (const id of x.lo_trinh ?? []) {
      coLan(id, `Lộ trình của xe ${x.id}`);
      const sau = lan.get(id)!;
      const cuoi = truoc.doan.at(-1)!.den;
      const dau = sau.doan[0]!.tu;
      if (cuoi.x !== dau.x || cuoi.y !== dau.y)
        throw new Error(`Lộ trình của xe ${x.id}: làn ${truoc.id} không nối với làn ${id}.`);
      truoc = sau;
    }
  }
  for (const d of ch.den ?? []) for (const v of d.vach) coLan(v.lan, `Đèn ${d.id}`);
  for (const v of ch.vung_cam_dung ?? []) coLan(v.lan, `Vùng cấm dừng ${v.id}`);
  for (const v of ch.vat_can ?? []) {
    coLan(v.lan, `Vật cản ${v.id}`);
    if (v.lan_tranh) coLan(v.lan_tranh, `Làn tránh của vật cản ${v.id}`);
  }
  return {
    lan,
    dac_diem: [...ch.dac_diem].sort(theoId),
    bien: [...ch.bien].sort(
      (a, b) => a.s - b.s || (a.id < b.id ? -1 : a.id > b.id ? 1 : a.ma < b.ma ? -1 : 1),
    ),
    xe: [...ch.xe].sort(theoId),
    den: [...(ch.den ?? [])].sort(theoId),
    vung_cam_dung: [...(ch.vung_cam_dung ?? [])].sort(theoId),
    chay_du_nhip: Boolean(ch.chay_du_nhip),
    vat_can: [...(ch.vat_can ?? [])].sort(theoId),
    nguoi: [...(ch.nguoi ?? [])].sort(theoId),
    dem: ch.dem
      ? {
          canh_bao: [...ch.dem.canh_bao].sort(theoId),
          khuat: [...ch.dem.khuat].sort(theoId),
          vung_chot: ch.dem.vung_chot,
        }
      : null,
  };
}

/** Nguồn sáng và đoạn khuất của cảnh đêm, theo dạng tam-nhin.ts cần; null khi không phải ban đêm. */
function canhDem(mp: MoPhong): CanhDem | null {
  return mp.dem ? { khuat: mp.dem.khuat, sang: mp.dem.canh_bao.filter((c) => c.loai !== "bien") } : null;
}

/** Người lái ở `sMm` (mm) thấy vật ở `sVat` (cm) không: ban đêm theo tam-nhin.ts, ban ngày theo tầm nhìn biển. */
function thayVat(cd: CanhDem | null, loai: LoaiVatNhin, sMm: number, sVat: number): boolean {
  if (!cd) {
    const d = sVat * 10 - sMm;
    return d >= 0 && d <= TAM_NHIN_BIEN_CM * 10;
  }
  return thayDuoc(cd, loai, Math.floor(sMm / 10), sVat);
}

export function trangThaiDau(mp: MoPhong): TrangThaiMoPhong {
  const xe: Xe[] = mp.xe.map((k) => {
    const l = mp.lan.get(k.lan)!;
    const s0 = k.s_vao ?? 0;
    const p = viTriTrenLan(l, s0);
    return {
      id: k.id,
      loai: k.loai,
      lan: k.lan,
      s: s0 * 10,
      v: 0,
      v_max: Math.min(k.v_max ?? l.toc_do_toi_da, l.toc_do_toi_da),
      x: p.x,
      y: p.y,
      huong: p.huong,
      trang_thai: "cho",
      uu_tien: Boolean(k.uu_tien),
      nguoi_lai: "tu_dong",
      nhip_vao: k.nhip_vao,
      dung_con: 0,
      giam_den: 0,
      bien_da_qua: [],
      dac_diem_da_qua: [],
      phanh_gap_vi: [],
      lo_trinh: [...(k.lo_trinh ?? [])],
      mu_bao_hiem: k.mu_bao_hiem !== false,
      bo_qua_den: Boolean(k.bo_qua_den),
      dung_kb: k.dung ? { s: k.dung.s, so_nhip: k.dung.so_nhip } : null,
      dang_dung_kb: false,
      den_da_qua: [],
      // Chỉ thêm khi khai: trạng thái (và mã băm) của xe không khai giữ nguyên như trước.
      ...(k.kich_thuoc ? { kich_thuoc: { dai: k.kich_thuoc.dai, rong: k.kich_thuoc.rong } } : {}),
    };
  });
  return { nhip: 0, xe, su_kien: [], dung_yen: 0, xong: xe.length === 0 };
}

/** Tốc độ lớn nhất lúc này để còn kịp về `vt` sau `d` mm với mức phanh tính trước. */
function tocDoKip(d: number, vt: number): number {
  return Math.floor(Math.sqrt(vt * vt + 2 * PHANH_DU_KIEN * Math.max(0, d)));
}

interface RangBuoc {
  d: number;
  vt: number;
  /** Id biển, đặc điểm, khúc ngoặt hoặc đèn; null khi là xe phía trước hay chỗ dừng theo kịch bản. */
  vi: string | null;
  loai: "bien" | "dac_diem" | "xe" | "khuc" | "den" | "kich_ban" | "vat_can" | "canh_bao";
}

/** Loại tầm nhìn của một vật cản: đèn, xe đỗ có đèn thấy từ xa; biển, cọc phản quang. */
const nhinVatCan = (v: Pick<VatCan, "loai">): LoaiVatNhin =>
  v.loai === "xe_do" ? "xe" : v.loai === "den" ? "den" : v.loai === "bien" ? "bien" : "coc";

function suKien(
  tt: { nhip: number },
  loai: LoaiSuKien,
  x: Xe,
  vi: { dac_diem?: string; bien?: string } = {},
): SuKien {
  return {
    nhip: tt.nhip,
    loai,
    xe: x.id,
    dac_diem: vi.dac_diem ?? null,
    bien: vi.bien ?? null,
    x: x.x,
    y: x.y,
    v: x.v,
  };
}

/** Một nhịp. Trả trạng thái mới, không sửa trạng thái cũ. */
export function buocMoPhong(mp: MoPhong, tt: TrangThaiMoPhong): TrangThaiMoPhong {
  if (tt.xong) return tt;
  const nhip = tt.nhip + 1;
  const truoc = tt.xe;
  const moi: Xe[] = [];
  const sk: SuKien[] = [];
  let diChuyen = false;
  let conCho = false;
  const cd = canhDem(mp);
  /** Xe đã xử lý trong nhịp này (trạng thái mới), để xét chỗ sang làn. */
  const daXuLy = new Map<string, Xe>();
  const tenLan = (id: string, xe: string) =>
    truoc.filter((o) => o.id !== xe && o.lan === id && o.trang_thai !== "cho" && o.trang_thai !== "da_qua");

  for (const c of truoc) {
    const x: Xe = {
      ...c,
      bien_da_qua: [...c.bien_da_qua],
      dac_diem_da_qua: [...c.dac_diem_da_qua],
      phanh_gap_vi: [...c.phanh_gap_vi],
      lo_trinh: [...c.lo_trinh],
      den_da_qua: [...c.den_da_qua],
    };
    moi.push(x);
    daXuLy.set(x.id, x);
    let lan = mp.lan.get(x.lan)!;
    let cungLan = tenLan(x.lan, x.id);

    if (x.trang_thai === "da_qua" || x.trang_thai === "bi_chan" || x.trang_thai === "va_cham") continue;

    if (x.trang_thai === "cho") {
      if (nhip < x.nhip_vao) {
        conCho = true;
        continue;
      }
      const dai = kichThuocXe(x).dai * 10;
      if (x.s === 0) {
        // Vào đường khi đầu làn trống. Xét cả xe đã xử lý trong nhịp này (GĐ-T15): hai xe chờ ở đầu
        // cùng một làn không được vào cùng một nhịp rồi chồng lên nhau.
        const chan = (o: Xe) => o.s - kichThuocXe(o).dai * 10 < dai + KHOANG_CACH_TOI_THIEU_CM * 10;
        if (
          cungLan.some(chan) ||
          moi.some(
            (o) =>
              o !== x && o.lan === x.lan && o.trang_thai !== "cho" && o.trang_thai !== "da_qua" && chan(o),
          )
        )
          continue;
      } else if (!coChoChuyenLan(x, x.lan, truoc, mp.vat_can)) continue; // GĐ-T15: vào giữa làn.
      x.trang_thai = "chay";
      x.v = x.s === 0 ? x.v_max : Math.min(x.v_max, TOC_DO_CHAM);
      diChuyen = true;
      if (lan.danh_cho && !lan.danh_cho.includes(x.loai)) sk.push(suKien({ nhip }, "sai_lan", x));
      if (!x.mu_bao_hiem) sk.push(suKien({ nhip }, "khong_mu_bao_hiem", x));
      continue;
    }

    if (x.dung_con > 0) {
      x.dung_con--;
      x.v = 0;
      x.trang_thai = x.dung_con > 0 ? "dung" : "chay";
      if (!x.dung_con && x.dang_dung_kb) {
        x.dang_dung_kb = false;
        sk.push(suKien({ nhip }, "tiep_tuc", x));
      }
      continue;
    }

    // GĐ-T15: thấy vật cản trên làn mình, còn gần, làn tránh đủ chỗ thì sang làn.
    const vcTruoc = mp.vat_can.length ? vatCanPhiaTruoc(mp.vat_can, x.lan, x.s) : null;
    if (
      vcTruoc?.lan_tranh &&
      vcTruoc.s_tu * 10 - x.s <= XET_CHUYEN_LAN_CM * 10 &&
      thayVat(cd, nhinVatCan(vcTruoc), x.s, vcTruoc.s_tu) &&
      coChoChuyenLan(
        x,
        vcTruoc.lan_tranh,
        truoc.map((o) => daXuLy.get(o.id) ?? o),
        mp.vat_can,
      )
    ) {
      lan = mp.lan.get(vcTruoc.lan_tranh)!;
      x.lan = lan.id;
      x.s = Math.min(x.s, lan.dai * 10);
      const p = viTriTrenLan(lan, Math.floor(x.s / 10));
      x.x = p.x;
      x.y = p.y;
      x.huong = p.huong;
      sk.push({ ...suKien({ nhip }, "chuyen_lan", x), vat: vcTruoc.id });
      cungLan = tenLan(x.lan, x.id);
    }

    // Ràng buộc tốc độ.
    let tran = x.v_max;
    if (x.giam_den > x.s) tran = Math.min(tran, TOC_DO_CHAM);
    const rb: RangBuoc[] = [];
    for (const b of mp.bien) {
      if (b.lan !== x.lan || x.bien_da_qua.includes(`${b.id}|${b.ma}`)) continue;
      const d = b.s * 10 - x.s;
      if (d < 0 || (cd ? !thayDuoc(cd, "bien", Math.floor(x.s / 10), b.s) : d > TAM_NHIN_BIEN_CM * 10))
        continue;
      if (b.phan_ung === "giam_toc") rb.push({ d, vt: TOC_DO_CHAM, vi: b.id, loai: "bien" });
      else if (b.phan_ung === "dung_lai" || b.phan_ung === "khong_vao")
        rb.push({ d, vt: 0, vi: b.id, loai: "bien" });
    }
    for (const dd of mp.dac_diem) {
      if (dd.lan !== x.lan) continue;
      const an = TOC_DO_AN_TOAN[dd.loai];
      if (an === null) continue;
      if (x.s >= dd.s_tu * 10 && x.s <= dd.s_den * 10) tran = Math.min(tran, an);
      const d = dd.s_tu * 10 - x.s;
      if (d > 0 && d <= NHIN_THAY_DAC_DIEM_CM * 10) rb.push({ d, vt: an, vi: dd.id, loai: "dac_diem" });
    }
    // Khúc ngoặt phía trước trong làn, và chỗ rẽ sang làn kế tiếp.
    for (let i = 1; i < lan.doan.length; i++) {
      const lech = doLechHuong(lan.doan[i - 1]!.huong, lan.doan[i]!.huong);
      const d = lan.doan[i]!.s0 * 10 - x.s;
      if (lech > 0 && d > 0 && d <= TAM_NHIN_BIEN_CM * 10)
        rb.push({ d, vt: TOC_DO_QUA_KHUC[lech as 1 | 2 | 3 | 4], vi: `${lan.id}#${i}`, loai: "khuc" });
    }
    const lanSau = x.lo_trinh[0] ? mp.lan.get(x.lo_trinh[0]) : undefined;
    if (lanSau) {
      const lech = doLechHuong(lan.doan.at(-1)!.huong, lanSau.doan[0]!.huong);
      const d = lan.dai * 10 - x.s;
      if (lech > 0 && d > 0 && d <= TAM_NHIN_BIEN_CM * 10)
        rb.push({
          d,
          vt: TOC_DO_QUA_KHUC[lech as 1 | 2 | 3 | 4],
          vi: `${lan.id}>${lanSau.id}`,
          loai: "khuc",
        });
    }
    // Đèn tín hiệu: dừng trước vạch khi đỏ, hoặc khi vàng mà còn kịp dừng bằng phanh thường.
    if (!x.bo_qua_den) {
      for (const den of mp.den) {
        if (x.den_da_qua.includes(den.id)) continue;
        const vach = den.vach.find((v) => v.lan === x.lan);
        if (!vach) continue;
        // Chỉ bỏ qua khi đầu xe đã qua vạch; nhích quá chỗ dừng một chút vẫn phải đứng chờ.
        if (x.s > vach.s * 10 || vach.s * 10 - x.s > TAM_NHIN_DEN_CM * 10) continue;
        const d = Math.max(0, vach.s * 10 - LUI_VACH_MM - x.s);
        const mau = mauDen(den, nhip);
        if (mau === "do" || (mau === "vang" && x.v * x.v <= 2 * PHANH_THUONG * d))
          rb.push({ d, vt: 0, vi: den.id, loai: "den" });
      }
    }
    // Chỗ dừng theo kịch bản.
    if (x.dung_kb) {
      const d = x.dung_kb.s * 10 - x.s;
      if (d >= 0) rb.push({ d, vt: 0, vi: null, loai: "kich_ban" });
    }
    // GĐ-T15: vật cản trên làn (chưa sang làn được thì dừng trước vật cản), vùng chốt ban đêm.
    const vc = mp.vat_can.length ? vatCanPhiaTruoc(mp.vat_can, x.lan, x.s) : null;
    if (vc && thayVat(cd, nhinVatCan(vc), x.s, vc.s_tu))
      rb.push({ d: vc.s_tu * 10 - DUNG_TRUOC_VAT_CAN_CM * 10 - x.s, vt: 0, vi: vc.id, loai: "vat_can" });
    const vz = mp.dem?.vung_chot;
    if (vz && x.s < vz.s_tu * 10) {
      const d = vz.s_tu * 10 - x.s;
      // Đã qua hoặc đã thấy một vật cảnh báo: giảm dần từ xa. Chưa: chỉ giảm khi thấy vùng chốt.
      if (mp.dem!.canh_bao.some((c) => c.s * 10 <= x.s || thayVat(cd, c.loai, x.s, c.s)))
        rb.push({ d, vt: TOC_DO_CHAM, vi: "canh_bao", loai: "canh_bao" });
      else if (thayVat(cd, "coc", x.s, vz.s_tu))
        rb.push({ d, vt: TOC_DO_CHAM, vi: "vung_chot", loai: "vat_can" });
    } else if (vz && x.s <= vz.s_den * 10)
      rb.push({ d: 0, vt: TOC_DO_CHAM, vi: "vung_chot", loai: "vat_can" });
    let dauXe: Xe | null = null;
    for (const o of cungLan) if (o.s > x.s && (!dauXe || o.s < dauXe.s)) dauXe = o;
    if (dauXe) {
      const d = dauXe.s - kichThuocXe(dauXe).dai * 10 - KHOANG_CACH_TOI_THIEU_CM * 10 - x.s;
      rb.push({ d, vt: dauXe.v, vi: null, loai: "xe" });
    }

    let dich = tran;
    let rang: RangBuoc | null = null;
    for (const r of rb) {
      const k = tocDoKip(r.d, r.vt);
      if (k < dich) {
        dich = k;
        rang = r;
      }
    }

    let v: number;
    if (dich >= x.v) v = Math.min(dich, x.v + TANG_TOC);
    else if (x.v - dich > PHANH_THUONG) {
      v = Math.max(dich, x.v - PHANH_GAP);
      // Phanh gấp vì biển, đặc điểm, vật cản hay vật cảnh báo (không tính phanh vì xe trước).
      if (
        rang &&
        (rang.loai === "bien" ||
          rang.loai === "dac_diem" ||
          rang.loai === "vat_can" ||
          rang.loai === "canh_bao") &&
        x.v > TOC_DO_TINH_PHANH_GAP &&
        !x.phanh_gap_vi.includes(rang.vi!)
      ) {
        x.phanh_gap_vi.push(rang.vi!);
        sk.push(
          rang.loai === "bien" || rang.loai === "dac_diem"
            ? suKien(
                { nhip },
                "phanh_gap",
                x,
                rang.loai === "bien" ? { bien: rang.vi! } : { dac_diem: rang.vi! },
              )
            : { ...suKien({ nhip }, "phanh_gap", x), vat: rang.vi! },
        );
      }
    } else v = dich;
    v = Math.max(0, v);

    const sCu = x.s;
    let sMoi = x.s + v;

    // Biển trong đoạn vừa đi: dừng tại biển, hoặc ghi đã qua.
    for (const b of mp.bien) {
      const khoa = `${b.id}|${b.ma}`;
      if (b.lan !== x.lan || x.bien_da_qua.includes(khoa)) continue;
      const sb = b.s * 10;
      if (sb < sCu || sb > sMoi) continue;
      if (b.phan_ung === "dung_lai" || b.phan_ung === "khong_vao") {
        sMoi = sb;
        v = 0;
        x.bien_da_qua.push(khoa);
        x.s = sMoi;
        const p = viTriTrenLan(lan, Math.floor(sMoi / 10));
        x.x = p.x;
        x.y = p.y;
        x.v = 0;
        if (b.phan_ung === "dung_lai") {
          x.dung_con = NHIP_DUNG_TAI_BIEN;
          x.trang_thai = "dung";
          sk.push(suKien({ nhip }, "dung_theo_bien", x, { bien: b.id }));
        } else {
          x.trang_thai = "bi_chan";
          sk.push(suKien({ nhip }, "bi_chan", x, { bien: b.id }));
        }
        break;
      }
      x.bien_da_qua.push(khoa);
      if (b.phan_ung === "giam_toc") x.giam_den = Math.max(x.giam_den, (b.s + VUNG_GIAM_TOC_CM) * 10);
    }

    // Tới chỗ dừng theo kịch bản: dừng đúng chỗ, xét vùng cấm dừng.
    if (x.trang_thai === "chay" && x.dung_kb && sMoi >= x.dung_kb.s * 10) {
      sMoi = x.dung_kb.s * 10;
      x.s = sMoi;
      x.v = 0;
      const p = viTriTrenLan(lan, Math.floor(sMoi / 10));
      x.x = p.x;
      x.y = p.y;
      x.dung_con = x.dung_kb.so_nhip;
      x.dang_dung_kb = true;
      x.trang_thai = "dung";
      const vung = mp.vung_cam_dung.find(
        (z) => z.lan === x.lan && x.dung_kb!.s >= z.s_tu && x.dung_kb!.s <= z.s_den,
      );
      x.dung_kb = null;
      sk.push(
        vung ? { ...suKien({ nhip }, "dung_do_sai", x), vung: vung.id } : suKien({ nhip }, "dung_xe", x),
      );
    }

    if (x.trang_thai === "chay") {
      // Qua vạch dừng của đèn.
      for (const den of mp.den) {
        if (x.den_da_qua.includes(den.id)) continue;
        const vach = den.vach.find((z) => z.lan === x.lan);
        if (!vach || vach.s * 10 <= sCu || vach.s * 10 > sMoi) continue;
        x.den_da_qua.push(den.id);
        if (mauDen(den, nhip) === "do") sk.push({ ...suKien({ nhip }, "vuot_den_do", x), den: den.id });
      }
      x.s = sMoi;
      x.v = v;
      const p = viTriTrenLan(lan, Math.floor(sMoi / 10));
      x.x = p.x;
      x.y = p.y;
      x.huong = p.huong;
      // Đi vào đặc điểm.
      for (const dd of mp.dac_diem) {
        if (dd.lan !== x.lan || x.dac_diem_da_qua.includes(dd.id)) continue;
        const st = dd.s_tu * 10;
        if (st <= sCu || st > sMoi) continue;
        x.dac_diem_da_qua.push(dd.id);
        const an = TOC_DO_AN_TOAN[dd.loai];
        if (an === null) continue;
        sk.push(
          suKien({ nhip }, v > an + DUNG_SAI_TOC_DO ? "nguy_hiem" : "qua_an_toan", x, { dac_diem: dd.id }),
        );
      }
      if (sMoi >= lan.dai * 10 && x.lo_trinh.length) {
        // Rẽ: sang làn kế tiếp, đi tiếp phần quãng đường dư.
        const huongCu = lan.doan.at(-1)!.huong;
        const ln = mp.lan.get(x.lo_trinh.shift()!)!;
        x.lan = ln.id;
        x.s = Math.min(sMoi - lan.dai * 10, ln.dai * 10);
        const q = viTriTrenLan(ln, Math.floor(x.s / 10));
        x.x = q.x;
        x.y = q.y;
        x.huong = q.huong;
        if (doLechHuong(huongCu, ln.doan[0]!.huong) > 0) sk.push(suKien({ nhip }, "re", x));
      } else if (sMoi >= lan.dai * 10) {
        x.trang_thai = "da_qua";
        sk.push(suKien({ nhip }, "ra_khoi_duong", x));
      }
    }
    if (x.s !== sCu || x.lan !== c.lan) diChuyen = true;
  }

  // Va chạm: xét từng cặp xe đang trên đường, theo thứ tự id.
  const tren = moi.filter((x) => x.trang_thai !== "cho" && x.trang_thai !== "da_qua");
  for (let i = 0; i < tren.length; i++) {
    for (let j = i + 1; j < tren.length; j++) {
      const a = tren[i]!;
      const b = tren[j]!;
      if (a.trang_thai === "va_cham" && b.trang_thai === "va_cham") continue;
      if (!chongNhau(hopBao(a), hopBao(b))) continue;
      sk.push({ ...suKien({ nhip }, "va_cham", a), xe_khac: b.id });
      for (const x of [a, b]) {
        x.trang_thai = "va_cham";
        x.v = 0;
        x.dung_con = 0;
      }
    }
  }

  // GĐ-T15: xe vào vùng nguy hiểm quanh người đứng trên đường, mỗi cặp xe, người một lần.
  if (mp.nguoi.length) {
    const daBao = new Set(
      tt.su_kien.filter((s) => s.loai === "vao_vung_nguy_hiem").map((s) => `${s.xe}|${s.nguoi}`),
    );
    for (const x of tren) {
      const h = hopBao(x);
      for (const n of mp.nguoi) {
        if (daBao.has(`${x.id}|${n.id}`) || !trongVungNguyHiem(h, n)) continue;
        sk.push({ ...suKien({ nhip }, "vao_vung_nguy_hiem", x), nguoi: n.id });
      }
    }
  }

  const dungYen = diChuyen ? 0 : tt.dung_yen + 1;
  const hetXe = moi.every(
    (x) => x.trang_thai === "da_qua" || x.trang_thai === "bi_chan" || x.trang_thai === "va_cham",
  );
  return {
    nhip,
    xe: moi,
    su_kien: sk.length ? [...tt.su_kien, ...sk] : tt.su_kien,
    dung_yen: dungYen,
    xong: mp.chay_du_nhip
      ? nhip >= NHIP_TOI_DA
      : hetXe || nhip >= NHIP_TOI_DA || (!conCho && dungYen >= NHIP_DUNG_YEN_KET_THUC),
  };
}

/* ------------------------------------------------------------------ */
/* Hộp bao và va chạm                                                  */
/* ------------------------------------------------------------------ */

/** Hộp bao thẳng trục của một xe, cm. x1 < x2, y1 < y2. */
export interface HopBao {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** 1/√2 nhân 1000, làm tròn: đủ cho hộp bao, không cần hàm lượng giác. */
const CHEO_PHAN_NGHIN = 707;

/**
 * Hộp bao của xe từ tọa độ đầu xe, hướng và kích thước. Xe kéo dài về phía sau theo hướng đi. Đi
 * chéo: hộp bao ngoài của hình chữ nhật xoay 45°, nửa cạnh (dài + rộng) / (2√2).
 */
export function hopBao(x: Pick<Xe, "x" | "y" | "huong" | "loai" | "kich_thuoc">): HopBao {
  const { dai, rong } = kichThuocXe(x);
  const [bx, by] = BUOC_HUONG[x.huong];
  if (bx !== 0 && by !== 0) {
    const lui = Math.trunc((dai * CHEO_PHAN_NGHIN) / 1000);
    const cx = x.x - Math.trunc((bx * lui) / 2);
    const cy = x.y - Math.trunc((by * lui) / 2);
    const nua = Math.trunc(((dai + rong) * CHEO_PHAN_NGHIN) / 2000);
    return { x1: cx - nua, y1: cy - nua, x2: cx + nua, y2: cy + nua };
  }
  const duoiX = x.x - bx * dai;
  const duoiY = x.y - by * dai;
  const nua = Math.trunc(rong / 2);
  return bx !== 0
    ? { x1: Math.min(x.x, duoiX), x2: Math.max(x.x, duoiX), y1: x.y - nua, y2: x.y + nua }
    : { x1: x.x - nua, x2: x.x + nua, y1: Math.min(x.y, duoiY), y2: Math.max(x.y, duoiY) };
}

/** Hai hộp bao chồng lên nhau (chạm mép chưa tính). */
export function chongNhau(a: HopBao, b: HopBao): boolean {
  return a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
}

/** Chạy tới khi xong (hoặc tới `nhipToiDa`). */
export function chayDenHet(mp: MoPhong, nhipToiDa = NHIP_TOI_DA): TrangThaiMoPhong {
  let tt = trangThaiDau(mp);
  while (!tt.xong && tt.nhip < nhipToiDa) tt = buocMoPhong(mp, tt);
  return tt;
}
