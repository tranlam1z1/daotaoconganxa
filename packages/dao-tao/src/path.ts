/**
 * Lộ trình và gợi ý bước kế tiếp (ke-hoach/09-a §6, §8.1).
 *
 * Quy tắc sản phẩm ở đây: người học KHÔNG BAO GIỜ nhìn thấy một màn hình không có việc gì
 * để làm. Hàm `buocKeTiep` luôn trả về một hành động — nếu không còn gì thì trả về việc ôn
 * tập, và nếu cũng không có gì để ôn thì trả về việc xem lại hồ sơ sản phẩm.
 */

import { mucThanhThao, type TrangThaiKyNang } from "./mastery.ts";
import { denHan, type TheOn } from "./srs.ts";

export interface BaiTrongLoTrinh {
  id: string;
  slug: string;
  ordinal: number;
  title: string;
  estimatedMinutes: number;
  /** Mã kỹ năng bài này dạy. */
  skills: string[];
  status: string;
}

export interface TienDoBai {
  lessonId: string;
  state: "chua_mo" | "dang_hoc" | "xong";
  lastBlockOrdinal: number;
  secondsSpent: number;
}

export type LoaiBuoc = "hoc_bai" | "hoc_tiep" | "on_tap" | "va_loi" | "danh_gia" | "xem_ho_so";

export interface BuocKeTiep {
  loai: LoaiBuoc;
  nhan: string;
  duong_dan: string;
  ly_do: string;
  phut?: number;
  lessonId?: string;
  maLoi?: string;
}

export interface NguCanhLoTrinh {
  courseSlug: string;
  bai: BaiTrongLoTrinh[];
  tienDo: Map<string, TienDoBai>;
  theOn: TheOn[];
  /** Mã lỗi khái niệm đã mắc từ 2 lần trở lên (09-a §6.3). */
  maLoiLapLai: string[];
  /** Bài đánh giá đang mở, nếu có. */
  danhGiaMo?: { id: string; title: string; level: number };
  thanhThao: Map<string, TrangThaiKyNang>;
}

/**
 * Bước kế tiếp nên làm.
 *
 * Thứ tự ưu tiên có chủ đích: vá lỗi trước, vì học tiếp trên một hiểu sai chỉ làm hiểu sai
 * lan rộng. Ôn tập đứng trên bài mới vì thẻ quá hạn mất giá trị rất nhanh.
 */
/**
 * Số bài để hiển thị cho người học: đánh theo vị trí trong lộ trình, KHÔNG dùng `ordinal`
 * trong kho. `ordinal` là chỗ đứng khi biên tập nên hay ngắt quãng (bài 2, 3, 4 chưa xuất
 * bản thì bài xuất bản kế tiếp vẫn mang số 5); người học chỉ cần "bài 1 rồi bài 2".
 */
export function soBaiHienThi(theoThuTu: BaiTrongLoTrinh[], b: { id: string }): number {
  return theoThuTu.findIndex((x) => x.id === b.id) + 1;
}

export function buocKeTiep(nc: NguCanhLoTrinh): BuocKeTiep {
  const goc = `/dao-tao/${nc.courseSlug}`;

  if (nc.maLoiLapLai.length) {
    const ma = nc.maLoiLapLai[0]!;
    return {
      loai: "va_loi",
      nhan: "Vá một hiểu nhầm hay gặp",
      duong_dan: `${goc}/va-loi/${encodeURIComponent(ma)}`,
      ly_do: `Bạn đã mắc lỗi "${ma}" từ hai lần trở lên`,
      phut: 4,
      maLoi: ma,
    };
  }

  const denHanCount = nc.theOn.filter((t) => denHan(t)).length;
  if (denHanCount >= 5) {
    return {
      loai: "on_tap",
      nhan: `Ôn ${denHanCount} thẻ đến hạn`,
      duong_dan: `${goc}/on-tap`,
      ly_do: "Thẻ để quá hạn lâu sẽ phải học lại từ đầu",
      phut: Math.min(10, Math.ceil(denHanCount / 4)),
    };
  }

  const theoThuTu = [...nc.bai].sort((a, b) => a.ordinal - b.ordinal);
  const dangHoc = theoThuTu.find((b) => nc.tienDo.get(b.id)?.state === "dang_hoc");
  if (dangHoc) {
    return {
      loai: "hoc_tiep",
      nhan: `Học tiếp bài ${soBaiHienThi(theoThuTu, dangHoc)}: ${dangHoc.title}`,
      duong_dan: `${goc}/${dangHoc.slug}`,
      ly_do: "Bạn đang dở bài này",
      phut: dangHoc.estimatedMinutes,
      lessonId: dangHoc.id,
    };
  }

  if (nc.danhGiaMo) {
    return {
      loai: "danh_gia",
      nhan: nc.danhGiaMo.title,
      duong_dan: `${goc}/danh-gia/${nc.danhGiaMo.id}`,
      ly_do: "Đã học xong cụm bài trước bài đánh giá này",
    };
  }

  const chuaHoc = theoThuTu.find((b) => !nc.tienDo.get(b.id) || nc.tienDo.get(b.id)?.state === "chua_mo");
  if (chuaHoc) {
    return {
      loai: "hoc_bai",
      nhan: `Học bài ${soBaiHienThi(theoThuTu, chuaHoc)}: ${chuaHoc.title}`,
      duong_dan: `${goc}/${chuaHoc.slug}`,
      ly_do: "Bài kế tiếp trong lộ trình",
      phut: chuaHoc.estimatedMinutes,
      lessonId: chuaHoc.id,
    };
  }

  if (denHanCount > 0) {
    return {
      loai: "on_tap",
      nhan: `Ôn ${denHanCount} thẻ`,
      duong_dan: `${goc}/on-tap`,
      ly_do: "Đã học hết bài; giữ nhịp bằng ôn tập",
      phut: 5,
    };
  }

  return {
    loai: "xem_ho_so",
    nhan: "Xem lại hồ sơ sản phẩm đã làm",
    duong_dan: `${goc}/tien-do`,
    ly_do: "Bạn đã đi hết lộ trình của chuyên đề này",
  };
}

export interface TomTatTienDo {
  tongBai: number;
  xong: number;
  dangHoc: number;
  phanTram: number;
  phutDaHoc: number;
  kyNangVung: number;
  kyNangHong: number;
  theDenHan: number;
}

export function tomTatTienDo(nc: NguCanhLoTrinh): TomTatTienDo {
  const tienDo = [...nc.tienDo.values()];
  const xong = tienDo.filter((t) => t.state === "xong").length;
  const thanhThao = [...nc.thanhThao.values()].map(mucThanhThao);
  return {
    tongBai: nc.bai.length,
    xong,
    dangHoc: tienDo.filter((t) => t.state === "dang_hoc").length,
    phanTram: nc.bai.length ? Math.round((xong / nc.bai.length) * 100) : 0,
    phutDaHoc: Math.round(tienDo.reduce((t, x) => t + x.secondsSpent, 0) / 60),
    kyNangVung: thanhThao.filter((m) => m === "vung").length,
    kyNangHong: thanhThao.filter((m) => m === "hong").length,
    theDenHan: nc.theOn.filter((t) => denHan(t)).length,
  };
}

/**
 * Bài học nên ưu tiên để lấp một kỹ năng còn hổng — dùng cho màn hình "vá nhanh" và cho
 * gợi ý sau khi trượt bài đánh giá.
 */
export function baiChoKyNangHong(
  bai: BaiTrongLoTrinh[],
  kyNangHong: string[],
  soLuong = 3,
): BaiTrongLoTrinh[] {
  if (!kyNangHong.length) return [];
  const diem = (b: BaiTrongLoTrinh) => b.skills.filter((s) => kyNangHong.includes(s)).length;
  return bai
    .filter((b) => diem(b) > 0)
    .sort((a, b) => diem(b) - diem(a) || a.ordinal - b.ordinal)
    .slice(0, soLuong);
}
