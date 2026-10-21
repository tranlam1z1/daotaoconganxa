/**
 * Bộ bảo vệ tài liệu hướng dẫn: so trạng thái hiện tại của giao diện và nội dung với
 * content/huong-dan/khoa.json để biết bài nào phải chụp lại hình, bài nào chỉ cần dựng lại PDF,
 * và trang nào mới xuất hiện mà chưa có bài hướng dẫn.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  type BaiHuongDan,
  type Khoa,
  type KhoHuongDan,
  tenAnhTrongMarkdown,
} from "../../apps/web/app/lib/huong-dan.ts";
import { THU_MUC_ANH } from "./kho.ts";
import { bam, chuKyGiaoDien, type RouteTrang, soSanhDacDiem, tepGiaoDienCuaBai } from "./nguon.ts";

export type LyDoChup = "chua_chup" | "giao_dien_doi" | "kich_ban_doi" | "thieu_anh";

export const NHAN_LY_DO: Record<LyDoChup, string> = {
  chua_chup: "chưa từng chụp",
  giao_dien_doi: "giao diện của trang đã đổi",
  kich_ban_doi: "kịch bản chụp hình đã đổi",
  thieu_anh: "thiếu tệp ảnh",
};

export interface HienTaiBai {
  giao_dien: string;
  dac_diem: Record<string, string[]>;
  kich_ban: string;
  noi_dung: string;
}

export interface DanhGiaBai {
  bai: BaiHuongDan;
  canChup: LyDoChup[];
  /** Đặc điểm giao diện thêm/bớt so với lần chụp trước. */
  them: string[];
  bot: string[];
  noiDungDoi: boolean;
  choRaSoat: boolean;
  hienTai: HienTaiBai;
}

export interface BaoCao {
  bai: DanhGiaBai[];
  /** Trang có giao diện mà chưa bài nào hướng dẫn. */
  routeChuaCo: RouteTrang[];
  loiNoiDung: string[];
  chuKyPdf: string;
  pdfCu: boolean;
}

export function trangThaiHienTai(bai: BaiHuongDan, cay: RouteTrang[]): HienTaiBai {
  const giaoDien = chuKyGiaoDien(tepGiaoDienCuaBai(bai, cay));
  return {
    giao_dien: giaoDien.chu_ky,
    dac_diem: giaoDien.dac_diem,
    kich_ban: bam(JSON.stringify(bai.anh)),
    noi_dung: bam(JSON.stringify([bai.tieu_de, bai.tom_tat, bai.markdown])),
  };
}

export function tepAnh(ten: string): string {
  return join(THU_MUC_ANH, `${ten}.png`);
}

export function danhGia(kho: KhoHuongDan, baiCoTep: string[], khoa: Khoa, cay: RouteTrang[]): BaoCao {
  const loiNoiDung: string[] = [];
  for (const id of kho.thieu)
    loiNoiDung.push(`Bài "${id}" có trong mục lục nhưng thiếu tệp ${id}.md hoặc ${id}.json.`);

  const trongMucLuc = new Set(kho.mucLuc.chuong.flatMap((c) => c.bai));
  for (const id of baiCoTep) {
    if (!trongMucLuc.has(id)) loiNoiDung.push(`Bài "${id}" có tệp nhưng chưa được đưa vào muc-luc.json.`);
  }

  const routeTheoTep = new Map(cay.map((r) => [r.file, r]));
  const tenAnhDaDung = new Map<string, string>();
  for (const bai of kho.dsBai) {
    for (const r of bai.routes) {
      if (!routeTheoTep.has(r)) loiNoiDung.push(`Bài "${bai.id}" khai route không tồn tại: ${r}.`);
    }
    const trongBai = new Set(tenAnhTrongMarkdown(bai.markdown));
    for (const kb of bai.anh) {
      const chuSoHuu = tenAnhDaDung.get(kb.ten);
      if (chuSoHuu) loiNoiDung.push(`Tên ảnh "${kb.ten}" dùng ở cả bài "${chuSoHuu}" và "${bai.id}".`);
      tenAnhDaDung.set(kb.ten, bai.id);
      if (!trongBai.has(kb.ten))
        loiNoiDung.push(`Bài "${bai.id}": ảnh "${kb.ten}" có kịch bản nhưng không được chèn vào bài.`);
      if (!kb.danh_dau.length) loiNoiDung.push(`Bài "${bai.id}": ảnh "${kb.ten}" chưa khoanh vùng nào.`);
    }
    for (const ten of trongBai) {
      if (!bai.anh.some((a) => a.ten === ten))
        loiNoiDung.push(`Bài "${bai.id}": chèn ảnh "${ten}" nhưng thiếu kịch bản chụp.`);
    }
    if (!bai.anh.length) loiNoiDung.push(`Bài "${bai.id}" chưa có hình minh hoạ nào.`);
  }

  const daHuongDan = new Set(kho.dsBai.flatMap((b) => b.routes));
  const boQua = new Set(kho.mucLuc.khong_can_huong_dan.map((x) => x.route));
  const routeChuaCo = cay.filter(
    (r) => r.coGiaoDien && !r.laKhung && !daHuongDan.has(r.file) && !boQua.has(r.file),
  );

  const dsDanhGia = kho.dsBai.map((bai): DanhGiaBai => {
    const hienTai = trangThaiHienTai(bai, cay);
    const cu = khoa.bai[bai.id];
    const canChup: LyDoChup[] = [];
    let them: string[] = [];
    let bot: string[] = [];
    if (!cu) {
      canChup.push("chua_chup");
    } else {
      if (cu.giao_dien !== hienTai.giao_dien) {
        canChup.push("giao_dien_doi");
        ({ them, bot } = soSanhDacDiem(cu.dac_diem, hienTai.dac_diem));
      }
      if (cu.kich_ban !== hienTai.kich_ban) canChup.push("kich_ban_doi");
    }
    if (bai.anh.some((kb) => !existsSync(tepAnh(kb.ten)))) canChup.push("thieu_anh");
    return {
      bai,
      canChup,
      them,
      bot,
      noiDungDoi: Boolean(cu && cu.noi_dung !== hienTai.noi_dung),
      choRaSoat: Boolean(cu?.cho_ra_soat && cu.cho_ra_soat.noi_dung_luc_chup === hienTai.noi_dung),
      hienTai,
    };
  });

  const chuKyPdf = tinhChuKyPdf(kho);
  return {
    bai: dsDanhGia,
    routeChuaCo,
    loiNoiDung,
    chuKyPdf,
    pdfCu: khoa.pdf?.chu_ky !== chuKyPdf,
  };
}

/** PDF phụ thuộc mục lục, lời văn, kịch bản (chú giải) và chính các tệp ảnh. */
export function tinhChuKyPdf(kho: KhoHuongDan): string {
  const phan = kho.dsBai.map((bai) => ({
    id: bai.id,
    so: bai.so,
    noi_dung: bam(JSON.stringify([bai.tieu_de, bai.tom_tat, bai.markdown, bai.anh])),
    anh: bai.anh.map((kb) => (existsSync(tepAnh(kb.ten)) ? bam(readFileSync(tepAnh(kb.ten))) : null)),
  }));
  return bam(JSON.stringify({ muc_luc: kho.mucLuc, phan }));
}
