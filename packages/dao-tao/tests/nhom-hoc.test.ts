/**
 * Nhóm học cùng (docs/PLAN.md GĐ16a): phần trăm tiến độ, mã mời, ngày cổ vũ theo giờ Việt Nam,
 * bộ đếm lượt. Số mong đợi tính tay trong từng ca.
 */
import { describe, expect, test } from "bun:test";
import {
  BANG_CHU_MA_MOI,
  CAI_DAT_MAC_DINH,
  chuanHoaMaMoi,
  type DuLieuMucCuaNguoi,
  khoaDuLieuMuc,
  khoaXpDeOnTap,
  type MucNhomTinh,
  ngayCoVu,
  nhanLuotTrongCuaSo,
  phanTramBai,
  phanTramDeOnTap,
  sinhMaMoi,
  thongBaoCanGui,
  tinhTienDoNhom,
  trangThaiMuc,
} from "../src/index.ts";

/** Hàm cũ ở apps/api/src/routes/dao-tao.ts trước GĐ16a, chép nguyên văn để so. */
function phanTramBaiCu(t: { state: string; last_block_ordinal: number } | undefined, soKhoi: number): number {
  if (t?.state === "xong") return 100;
  if (t?.state !== "dang_hoc" || soKhoi === 0) return 0;
  return Math.min(99, Math.round((t.last_block_ordinal / soKhoi) * 100));
}

const bai = (id: string, p: Partial<MucNhomTinh> = {}): MucNhomTinh => ({
  id,
  loai: "bai_hoc",
  con_xuat_ban: true,
  so_khoi: 4,
  so_cau_con_duyet: 0,
  ...p,
});
const de = (id: string, p: Partial<MucNhomTinh> = {}): MucNhomTinh => ({
  id,
  loai: "de_on_tap",
  con_xuat_ban: false,
  so_khoi: 0,
  so_cau_con_duyet: 5,
  ...p,
});

describe("phần trăm một mục", () => {
  test("phanTramBai mới khớp hàm cũ trên 7 bộ đầu vào", () => {
    const ca: Array<[{ state: string; last_block_ordinal: number } | undefined, number, number]> = [
      [{ state: "xong", last_block_ordinal: 0 }, 4, 100],
      [{ state: "dang_hoc", last_block_ordinal: 0 }, 4, 0],
      [{ state: "dang_hoc", last_block_ordinal: 1 }, 3, 33],
      [{ state: "dang_hoc", last_block_ordinal: 2 }, 3, 67],
      [{ state: "dang_hoc", last_block_ordinal: 4 }, 4, 99],
      [{ state: "dang_hoc", last_block_ordinal: 2 }, 0, 0],
      [{ state: "chua_mo", last_block_ordinal: 3 }, 4, 0],
    ];
    for (const [t, soKhoi, mong] of ca) {
      expect(phanTramBaiCu(t, soKhoi)).toBe(mong);
      expect(phanTramBai(t?.state, t?.last_block_ordinal ?? 0, soKhoi)).toBe(mong);
    }
    expect(phanTramBai(undefined, 0, 4)).toBe(phanTramBaiCu(undefined, 4));
  });

  test("đề ôn tập đã trả lời 5/5 câu mà chưa kết thúc là 99, không phải 100", () => {
    expect(phanTramDeOnTap([{ da_ket_thuc: false, da_tra_loi: 5, tong: 5 }])).toBe(99);
    expect(phanTramDeOnTap([{ da_ket_thuc: false, da_tra_loi: 3, tong: 5 }])).toBe(60);
    // 2/3 = 66,67 làm tròn xuống.
    expect(phanTramDeOnTap([{ da_ket_thuc: false, da_tra_loi: 2, tong: 3 }])).toBe(66);
    expect(phanTramDeOnTap([])).toBe(0);
  });

  test("hai phiên 40 và 100 của cùng một mục lấy 100", () => {
    expect(
      phanTramDeOnTap([
        { da_ket_thuc: false, da_tra_loi: 2, tong: 5 },
        { da_ket_thuc: true, da_tra_loi: 1, tong: 5 },
      ]),
    ).toBe(100);
  });

  test("trạng thái mục: bài không còn xuất bản, đề còn dưới 5 câu đã duyệt", () => {
    expect(trangThaiMuc(bai("b"))).toBe("tinh");
    expect(trangThaiMuc(bai("b", { con_xuat_ban: false }))).toBe("khong_con_xuat_ban");
    expect(trangThaiMuc(de("d", { so_cau_con_duyet: 5 }))).toBe("tinh");
    expect(trangThaiMuc(de("d", { so_cau_con_duyet: 4 }))).toBe("khong_du_cau");
  });
});

describe("tiến độ cả nhóm", () => {
  const xong = (): DuLieuMucCuaNguoi => ({ bai: { state: "xong", last_block_ordinal: 0 } });

  test("mục không còn xuất bản, không đủ câu không vào mẫu số (mục đã gỡ không có trong danh sách)", () => {
    const td = tinhTienDoNhom({
      muc: [bai("b1"), bai("b2", { con_xuat_ban: false }), de("d1", { so_cau_con_duyet: 4 })],
      thanhVien: ["A"],
      duLieu: new Map([[khoaDuLieuMuc("A", "b1"), xong()]]),
    });
    expect(td.thanh_vien[0]!.muc).toEqual({ b1: 100, b2: null, d1: null });
    expect(td.thanh_vien[0]!.phan_tram).toBe(100);
  });

  test("không có mục nào được tính thì phần trăm chung và trung bình nhóm là null", () => {
    const rong = tinhTienDoNhom({ muc: [], thanhVien: ["A", "B"], duLieu: new Map() });
    expect(rong.thanh_vien.map((t) => t.phan_tram)).toEqual([null, null]);
    expect(rong.trung_binh).toBeNull();
    const khongTinh = tinhTienDoNhom({
      muc: [bai("b", { con_xuat_ban: false })],
      thanhVien: ["A"],
      duLieu: new Map(),
    });
    expect(khongTinh.thanh_vien[0]!.phan_tram).toBeNull();
  });

  test("ba mục 100, 0, 100 cho 66 (làm tròn xuống, không phải 67)", () => {
    const td = tinhTienDoNhom({
      muc: [bai("b1"), bai("b2"), de("d1")],
      thanhVien: ["B"],
      duLieu: new Map<string, DuLieuMucCuaNguoi>([
        [khoaDuLieuMuc("B", "b1"), xong()],
        [khoaDuLieuMuc("B", "d1"), { phien: [{ da_ket_thuc: true, da_tra_loi: 5, tong: 5 }] }],
      ]),
    });
    expect(td.thanh_vien[0]!.phan_tram).toBe(66);
  });

  test("trung bình nhóm chỉ tính thành viên đang ở trong nhóm, làm tròn xuống", () => {
    const duLieu = new Map<string, DuLieuMucCuaNguoi>([
      [khoaDuLieuMuc("A", "b1"), xong()],
      [khoaDuLieuMuc("B", "b1"), { bai: { state: "dang_hoc", last_block_ordinal: 1 } }],
      // C đã rời: dữ liệu còn nhưng không có trong danh sách thành viên.
      [khoaDuLieuMuc("C", "b1"), xong()],
    ]);
    const td = tinhTienDoNhom({ muc: [bai("b1")], thanhVien: ["A", "B"], duLieu });
    // A = 100, B = round(1/4 × 100) = 25; trung bình ⌊125 / 2⌋ = 62.
    expect(td.thanh_vien.map((t) => [t.account_id, t.phan_tram])).toEqual([
      ["A", 100],
      ["B", 25],
    ]);
    expect(td.trung_binh).toBe(62);
  });
});

describe("cổ vũ, XP, bộ đếm", () => {
  test("23:30 ngày 01/10/2026 và 00:30 ngày 02/10/2026 giờ Việt Nam là hai ngày khác nhau", () => {
    const truoc = new Date("2026-10-01T23:30:00+07:00");
    const sau = new Date("2026-10-02T00:30:00+07:00");
    expect(ngayCoVu(truoc)).toBe("2026-10-01");
    expect(ngayCoVu(sau)).toBe("2026-10-02");
    // Cùng một ngày giờ Việt Nam dù khác ngày UTC (00:30 giờ VN là 17:30 UTC hôm trước).
    expect(ngayCoVu(new Date("2026-10-02T00:30:00+07:00"))).toBe(
      ngayCoVu(new Date("2026-10-02T23:59:00+07:00")),
    );
  });

  test("khóa XP đề ôn tập theo người và mục, không theo phiên", () => {
    expect(khoaXpDeOnTap("muc-1", "nguoi-1")).toBe("nhom:muc-1:nguoi-1");
    expect(khoaXpDeOnTap("muc-1", "nguoi-1")).toBe(khoaXpDeOnTap("muc-1", "nguoi-1"));
    expect(khoaXpDeOnTap("muc-1", "nguoi-2")).not.toBe(khoaXpDeOnTap("muc-1", "nguoi-1"));
  });

  test("bộ đếm cửa sổ trượt: lượt thứ 61 trong một phút bị từ chối, sang phút sau lại nhận", () => {
    let moc: number[] = [];
    const t0 = 1_000_000;
    for (let i = 0; i < 60; i++) {
      const kq = nhanLuotTrongCuaSo(moc, t0 + i * 100, 60_000, 60);
      expect(kq.duoc).toBe(true);
      moc = kq.moc;
    }
    expect(nhanLuotTrongCuaSo(moc, t0 + 6_000, 60_000, 60).duoc).toBe(false);
    expect(nhanLuotTrongCuaSo(moc, t0 + 60_000, 60_000, 60).duoc).toBe(true);
  });
});

describe("mã mời", () => {
  test("1.000 mã sinh ra đều dài 8 ký tự và không chứa 0, O, 1, I, L", () => {
    expect(BANG_CHU_MA_MOI).toHaveLength(31);
    for (let i = 0; i < 1000; i++) {
      const ma = sinhMaMoi();
      expect(ma).toMatch(/^[2-9A-HJKMNP-Z]{8}$/);
      expect(ma).not.toMatch(/[01OIL]/);
    }
  });

  test("byte ngoài bội số của 31 bị bỏ, không làm lệch phân bố", () => {
    // 248..255 bị bỏ; 0 và 31 cùng ra ký tự đầu bảng.
    const byte = [255, 248, 0, 31, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    expect(sinhMaMoi(() => Uint8Array.from(byte))).toBe("22345678");
  });

  test("chuẩn hóa mã người dùng gõ", () => {
    expect(chuanHoaMaMoi(" abcd-efgh ")).toBe("ABCDEFGH");
    expect(chuanHoaMaMoi("ABCD EFG")).toBeNull();
    expect(chuanHoaMaMoi("ABCDEFG0")).toBeNull();
    expect(chuanHoaMaMoi("ABCDEFGI")).toBeNull();
  });
});

describe("thông báo nhóm học cùng", () => {
  const luc = (vn: string) => new Date(`${vn.replace(" ", "T")}:00+07:00`);
  const nguoi = (nhom?: { co_vu_moi: number; muc_moi: number }, bat = true) => ({
    cai_dat: { ...CAI_DAT_MAC_DINH, group_activity: bat },
    da_hoc_hom_nay: true,
    chuoi_ngay: 0,
    co_thu_thach: false,
    bai_giao_moi: [],
    ...(nhom ? { nhom_hoc: nhom } : {}),
  });

  test("có lượt cổ vũ hoặc bài mới thì một thông báo nhom_hoc, ref là ngày giờ Việt Nam", () => {
    const ds = thongBaoCanGui(nguoi({ co_vu_moi: 2, muc_moi: 1 }), luc("2026-10-01 09:00"));
    expect(ds).toEqual([
      {
        kind: "nhom_hoc",
        ref: "2026-10-01",
        tieu_de: "Nhóm học cùng",
        noi_dung: "Hôm nay bạn nhận 2 lượt cổ vũ. Nhóm của bạn có 1 bài mới được chia sẻ.",
        url: "/nhom",
      },
    ]);
  });

  test("không có hoạt động, tắt công tắc, giờ yên lặng: không gửi", () => {
    expect(thongBaoCanGui(nguoi({ co_vu_moi: 0, muc_moi: 0 }), luc("2026-10-01 09:00"))).toEqual([]);
    expect(thongBaoCanGui(nguoi(undefined), luc("2026-10-01 09:00"))).toEqual([]);
    expect(thongBaoCanGui(nguoi({ co_vu_moi: 1, muc_moi: 0 }, false), luc("2026-10-01 09:00"))).toEqual([]);
    expect(thongBaoCanGui(nguoi({ co_vu_moi: 1, muc_moi: 0 }), luc("2026-10-01 23:00"))).toEqual([]);
  });
});
