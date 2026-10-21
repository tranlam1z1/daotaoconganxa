/**
 * Dữ liệu trang chủ: thẻ của carousel trò chơi và số liệu của lưới 4 ô chức năng.
 * Chỉ tính toán trên dữ liệu API đã có, không gọi API (loader của routes/home.tsx gọi).
 */

import type { DanhMucTroChoi, TongQuanLuotChoi } from "./luot-choi";
import type { PhienTomTat } from "./luyen-tap.server";
import type { BaiThi } from "./thi";

export interface TheDanhMuc {
  /** Mã trò chơi. */
  khoa: string;
  nhan: string;
  /** Mô tả ngắn, hiện trên thẻ ở màn hình rộng; null: không có. */
  moTa: string | null;
  /** Đường dẫn khi chạm; null: thẻ là nút vào chơi ngay trò `khoa` (một chạm, như "Chơi ngay"). */
  to: string | null;
}

/** Số thẻ mỗi trang carousel: lưới 2 hàng × 3 cột. */
export const THE_MOI_TRANG = 6;

/**
 * Trò của GĐ10–GĐ14 (engine "cu"): API chỉ trả mã, tên và trang riêng nằm ở đây (cùng tên với
 * trang /tro-choi). Vượt màn cần chọn chủ đề nên mở ngăn chi tiết của nó trên trang /tro-choi.
 */
const TRO_CHOI_CU: Record<string, Omit<TheDanhMuc, "khoa">> = {
  vuot_man: {
    nhan: "Vượt màn",
    moTa: "Mỗi màn 10 câu, từ dễ tới khó. Đúng từ 8 câu trở lên thì mở màn tiếp theo.",
    to: "/tro-choi?tro=vuot_man",
  },
  doan_bien_bao: {
    nhan: "Đoán biển báo",
    moTa: "Nhìn biển, chọn đúng tên trong 4 phương án cùng nhóm.",
    to: "/tro-choi/doan-bien-bao",
  },
  hoi_nhanh_giong_noi: {
    nhan: "Hỏi nhanh bằng giọng nói",
    moTa: "Nghe câu hỏi, nói đáp án. Mỗi lượt 10 câu, không tính giờ.",
    to: "/tro-choi/hoi-nhanh-giong-noi",
  },
  dua_thoi_gian: {
    nhan: "Đua thời gian 60 giây",
    moTa: "Trả lời đúng nhiều câu nhất trong 60 giây.",
    to: "/tro-choi/dua-thoi-gian",
  },
  ghep_cap: {
    nhan: "Ghép lỗi với mức phạt",
    moTa: "Ghép 5 hành vi vi phạm với đúng mức tiền phạt.",
    to: "/tro-choi/ghep-cap",
  },
};

/**
 * Mọi trò đang bật, cùng thứ tự với trang /tro-choi: trò trên khung chung trước, trò cũ sau.
 * Trò có màn phải chọn màn nên mở ngăn chi tiết của trò đó trên trang /tro-choi (`?tro=<mã>`).
 */
export function danhSachTroChoi(tq: TongQuanLuotChoi | DanhMucTroChoi): TheDanhMuc[] {
  const khung = tq.tro_choi.map(
    (g): TheDanhMuc => ({
      khoa: g.ma,
      nhan: g.ten,
      moTa: g.mo_ta || null,
      to: g.man ? `/tro-choi?tro=${g.ma}` : null,
    }),
  );
  const cu = tq.tro_choi_cu.flatMap((ma) => {
    const t = TRO_CHOI_CU[ma];
    return t ? [{ khoa: ma, ...t }] : [];
  });
  return [...khung, ...cu];
}

/**
 * Thẻ trò chơi cho người chưa đăng nhập hoặc tài khoản chưa được xác minh: cùng danh sách, nhưng mọi
 * thẻ là liên kết tới trang của trò (trò chơi ngay một chạm thì mở ngăn chi tiết của trò đó). Trang
 * đó tự chuyển sang đăng nhập, xong thì về đúng trò đã chọn; tài khoản chưa xác minh thì về trang
 * Tài khoản.
 */
export function danhSachTroChoiCongKhai(dm: DanhMucTroChoi): TheDanhMuc[] {
  return danhSachTroChoi(dm).map((t) => ({ ...t, to: t.to ?? `/tro-choi?tro=${t.khoa}` }));
}

export function chiaTrang<T>(items: T[], moiTrang = THE_MOI_TRANG): T[][] {
  const trang: T[][] = [];
  for (let i = 0; i < items.length; i += moiTrang) trang.push(items.slice(i, i + moiTrang));
  return trang;
}

/** Số liệu riêng của người đăng nhập. Phần nào null là không lấy được: ô đó hiện trạng thái rỗng. */
export interface ThongKeNguoiHoc {
  thi: { dangMo: number; daThi: number; daDat: number } | null;
  luyenTap: { soPhien: number; tyLeDung: number | null } | null;
}

export function tinhThongKe(baiThi: BaiThi[] | null, lichSu: PhienTomTat[] | null): ThongKeNguoiHoc {
  const daXong = lichSu?.filter((p) => p.finished_at && p.total) ?? [];
  const tongCau = daXong.reduce((s, p) => s + p.total, 0);
  return {
    thi: baiThi
      ? {
          dangMo: baiThi.filter((b) => b.trang_thai === "chua_lam" || b.trang_thai === "dang_lam").length,
          daThi: baiThi.filter((b) => b.so_luot_nop > 0).length,
          daDat: baiThi.filter((b) => b.da_dat).length,
        }
      : null,
    luyenTap: lichSu
      ? {
          soPhien: daXong.length,
          // Cùng cách tính với trang /toi.
          tyLeDung: tongCau
            ? Math.round((daXong.reduce((s, p) => s + (p.correct ?? 0), 0) / tongCau) * 100)
            : null,
        }
      : null,
  };
}
