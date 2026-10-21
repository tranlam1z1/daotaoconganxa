/**
 * AI của nhóm học cùng (docs/PLAN.md GĐ16d): đầu vào ẩn danh và hậu kiểm tất định. Mỗi ca loại
 * nêu đúng một lý do; hai ca đạt (AI-1, AI-2) và một ca chữ số trong mã TVn không bị coi là số.
 */
import { describe, expect, test } from "bun:test";
import {
  dungDauVaoGoiYThuTu,
  dungDauVaoTomTat,
  hauKiemGoiYThuTu,
  hauKiemTomTat,
  kiemChuAi,
  type MucNguon,
  type ThanhVienNguon,
  thayMa,
} from "../src/index.ts";

/** 12:00 ngày 30/9/2026 giờ Việt Nam. */
const NOW = new Date("2026-09-30T05:00:00Z");

const muc = (id: string, ten: string, p: Partial<MucNguon> = {}): MucNguon => ({
  id,
  ten,
  loai: "bai_hoc",
  chu_de: "dung-xe",
  so_khoi: 4,
  so_cau: null,
  so_phut: 10,
  han_goi_y: null,
  trang_thai: "tinh",
  ...p,
});

const MUC: MucNguon[] = [
  muc("de-1", "Đề ôn tập dừng xe", { loai: "de_on_tap", so_khoi: null, so_cau: 10, so_phut: null }),
  muc("bai-1", "Quy trình dừng xe kiểm soát", { han_goi_y: "2026-10-03" }),
  muc("bai-2", "Lập biên bản vi phạm", { han_goi_y: "2026-09-28" }),
  muc("bai-go", "Bài đã gỡ xuất bản", { trang_thai: "khong_con_xuat_ban" }),
];

const THANH_VIEN: ThanhVienNguon[] = [
  {
    id: "u-1",
    ho_ten: "Nguyễn Văn An",
    phan_tram: 100,
    muc: { "de-1": 100, "bai-1": 100, "bai-2": 100 },
    lan_hoc_gan_nhat: "2026-09-29T02:00:00Z",
  },
  {
    id: "u-2",
    ho_ten: "Trần Thị Bình",
    phan_tram: 50,
    muc: { "bai-1": 100, "bai-2": 50 },
    lan_hoc_gan_nhat: null,
  },
  { id: "u-3", ho_ten: "Lê Văn Cường", phan_tram: 0, muc: {}, lan_hoc_gan_nhat: "2026-09-10T02:00:00Z" },
];

const goiY = dungDauVaoGoiYThuTu(MUC.slice(0, 3), NOW);
const tomTat = dungDauVaoTomTat({ muc: MUC, thanhVien: THANH_VIEN, trungBinh: 50 }, NOW);

describe("dựng đầu vào", () => {
  test("AI-1: mã M1…Mn theo thứ tự hiện tại, số ngày đến hạn theo ngày Việt Nam, không có người", () => {
    expect(goiY.dauVao.muc.map((m) => m.ma)).toEqual(["M1", "M2", "M3"]);
    expect(goiY.dauVao.muc.map((m) => m.so_ngay_den_han)).toEqual([null, 3, -2]);
    expect(goiY.dauVao.muc[0]).toMatchObject({ loai: "de_on_tap", so_cau: 10, so_khoi: null, so_phut: null });
    expect(goiY.bang.get("M2")).toEqual({ loai: "muc", id: "bai-1", ten: "Quy trình dừng xe kiểm soát" });
  });

  test("AI-2: bỏ mục không tính, thành viên là TVn, không có họ tên, số tổng hợp tính sẵn", () => {
    const { dauVao, bang } = tomTat;
    const chuoi = JSON.stringify(dauVao);
    for (const t of THANH_VIEN) {
      expect(chuoi).not.toContain(t.ho_ten);
      expect(chuoi).not.toContain(t.id);
    }
    expect(chuoi).not.toContain("Bài đã gỡ");
    expect(dauVao.muc.map((m) => [m.ma, m.so_nguoi_hoan_thanh, m.ty_le_hoan_thanh])).toEqual([
      ["M1", 1, 33],
      ["M2", 2, 66],
      ["M3", 1, 33],
    ]);
    expect(dauVao.thanh_vien.map((t) => t.ma)).toEqual(["TV1", "TV2", "TV3"]);
    expect(dauVao.thanh_vien.map((t) => t.so_ngay_tu_lan_hoc_gan_nhat)).toEqual([1, null, 20]);
    expect(dauVao.thanh_vien[2]!.phan_tram_tung_muc).toEqual({ M1: 0, M2: 0, M3: 0 });
    expect(dauVao.so_thanh_vien_chua_bat_dau).toBe(1);
    expect(bang.get("TV2")).toEqual({ loai: "thanh_vien", id: "u-2", ten: "Trần Thị Bình" });
  });
});

describe("hậu kiểm AI-1 (gợi ý thứ tự)", () => {
  const ghiChu = "M3 có hạn gợi ý đã qua nên đặt đầu. Bài học đặt trước đề ôn tập.";

  test("đạt: hoán vị đúng, ghi chú dùng mã", () => {
    const kq = hauKiemGoiYThuTu({ thu_tu: ["M3", "M2", "M1"], ghi_chu: ghiChu }, goiY.dauVao);
    expect(kq).toEqual({ dat: true, ket_qua: { thu_tu: ["M3", "M2", "M1"], ghi_chu: ghiChu } });
  });

  test("biên độ dài: ghi chú 300 ký tự đạt, 301 ký tự bị loại", () => {
    const dai = (n: number) => "Bài học đặt trước đề ôn tập".padEnd(n, " x");
    expect(dai(300)).toHaveLength(300);
    expect(hauKiemGoiYThuTu({ thu_tu: ["M1", "M2", "M3"], ghi_chu: dai(300) }, goiY.dauVao).dat).toBe(true);
    expect(hauKiemGoiYThuTu({ thu_tu: ["M1", "M2", "M3"], ghi_chu: dai(301) }, goiY.dauVao)).toEqual({
      dat: false,
      ly_do: "ghi_chu dài quá 300 ký tự.",
    });
  });

  test.each([
    ["thiếu mã", { thu_tu: ["M3", "M2"], ghi_chu: ghiChu }, "hoán vị"],
    ["thừa mã", { thu_tu: ["M3", "M2", "M1", "M4"], ghi_chu: ghiChu }, "hoán vị"],
    ["lặp mã", { thu_tu: ["M3", "M3", "M1"], ghi_chu: ghiChu }, "mã lặp"],
    ["không phải JSON", null, "Không đọc được JSON"],
    ["thu_tu có phần tử không phải chuỗi", { thu_tu: ["M1", 2, "M3"], ghi_chu: "" }, "Thiếu thu_tu"],
    [
      "ghi chú quá 300 ký tự",
      { thu_tu: ["M1", "M2", "M3"], ghi_chu: "Bài học đặt trước. ".repeat(20) },
      "300",
    ],
    [
      "ghi chú nêu Điều 5",
      { thu_tu: ["M1", "M2", "M3"], ghi_chu: "M2 liên quan Điều 5 nên đặt trước." },
      "Điều",
    ],
    ["ghi chú nêu Nghị định", { thu_tu: ["M1", "M2", "M3"], ghi_chu: "M2 theo Nghị định mới." }, "Nghị định"],
    ["ghi chú nêu mã không có", { thu_tu: ["M1", "M2", "M3"], ghi_chu: "M7 đặt trước." }, "M7"],
    [
      "ghi chú chép tên mục",
      { thu_tu: ["M1", "M2", "M3"], ghi_chu: "Lập biên bản vi phạm đặt sau." },
      "tên mục",
    ],
  ])("loại khi %s", (_ten, json, lyDo) => {
    const kq = hauKiemGoiYThuTu(json, goiY.dauVao);
    expect(kq.dat).toBe(false);
    if (!kq.dat) expect(kq.ly_do).toContain(lyDo);
  });
});

describe("hậu kiểm AI-2 (tóm tắt tiến độ)", () => {
  const cauDat = [
    "Trung bình tiến độ của 3 thành viên là 50%.",
    "M1 và M3 có tỷ lệ hoàn thành 33%, thấp nhất trong nhóm.",
    "TV3 chưa bắt đầu mục nào và đã 20 ngày chưa học.",
  ];

  test("đạt: 3 câu, số có trong dữ liệu, mã tồn tại", () => {
    const kq = hauKiemTomTat({ nhan_xet: cauDat, muc_can_chu_y: ["M1", "M3"] }, tomTat.dauVao);
    expect(kq).toEqual({ dat: true, ket_qua: { nhan_xet: cauDat, muc_can_chu_y: ["M1", "M3"] } });
  });

  const voiCau = (cau: string) => ({ nhan_xet: [...cauDat.slice(0, 2), cau], muc_can_chu_y: [] });

  test.each([
    ["số không có trong dữ liệu", voiCau("TV2 đã học 45% chương trình."), "Số không có trong dữ liệu: 45"],
    ["mã thành viên không tồn tại", voiCau("TV9 chưa bắt đầu."), "Mã không tồn tại: TV9"],
    ["nêu Điều kèm số", voiCau("M2 gắn với Điều 5."), "Điều"],
    ["nêu Nghị định", voiCau("Nhóm học theo Nghị định mới."), "Nghị định"],
    ["nêu Luật", voiCau("Nhóm cần ôn Luật mới."), "Luật"],
    ["nêu khoản", voiCau("M2 thuộc khoản riêng."), "khoản"],
    ["nêu số hiệu", voiCau("M2 gắn với văn bản 3/2026."), "số hiệu"],
    ["nêu số tiền 500.000 đồng", voiCau("Mức 500.000 đồng áp dụng cho M2."), "số tiền"],
    ["nêu số tiền 20 triệu", voiCau("Mức 20 triệu áp dụng cho M2."), "số tiền"],
    ["có emoji", voiCau("TV1 đã hoàn thành mọi mục 🎉."), "emoji"],
    ["có dấu chấm than", voiCau("TV1 đã hoàn thành mọi mục!"), "dau_cham_than"],
    ["chép tên mục", voiCau("Quy trình dừng xe kiểm soát có tỷ lệ 66%."), "tên mục"],
    ["câu quá 300 ký tự", voiCau(`TV1 đã hoàn thành mọi mục${", M1".repeat(80)}.`), "quá dài"],
    ["ít hơn 3 câu", { nhan_xet: cauDat.slice(0, 2), muc_can_chu_y: [] }, "3–5 câu"],
    ["nhiều hơn 5 câu", { nhan_xet: [...cauDat, ...cauDat], muc_can_chu_y: [] }, "3–5 câu"],
    ["mục cần chú ý không tồn tại", { nhan_xet: cauDat, muc_can_chu_y: ["M9"] }, "muc_can_chu_y"],
    ["mục cần chú ý lặp", { nhan_xet: cauDat, muc_can_chu_y: ["M1", "M1"] }, "muc_can_chu_y"],
    ["thiếu nhan_xet", { muc_can_chu_y: [] }, "Thiếu nhan_xet"],
  ])("loại khi %s", (_ten, json, lyDo) => {
    const kq = hauKiemTomTat(json, tomTat.dauVao);
    expect(kq.dat).toBe(false);
    if (!kq.dat) expect(kq.ly_do).toContain(lyDo);
  });

  test("chữ số trong mã TV12, M10 không bị coi là số; số thập phân so theo giá trị", () => {
    const o = { maHopLe: new Set(["TV12", "M10"]), tenMuc: [], soHopLe: new Set(["7", "12.5"]) };
    expect(kiemChuAi("TV12 đã 7 ngày chưa học M10.", o)).toBeNull();
    expect(kiemChuAi("TV12 đạt 12,5% ở M10.", o)).toBeNull();
    expect(kiemChuAi("TV12 đạt 13% ở M10.", o)).toBe("Số không có trong dữ liệu: 13.");
  });
});

test("thay mã bằng tên sau hậu kiểm: thành viên thành họ tên, mục thành tên trong ngoặc kép", () => {
  expect(thayMa("TV3 chưa học M1; TV9 giữ nguyên.", tomTat.bang)).toBe(
    "Lê Văn Cường chưa học “Đề ôn tập dừng xe”; TV9 giữ nguyên.",
  );
});
