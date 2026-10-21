/**
 * Trò "Lên xe khách" (docs/PLAN.md GĐ-T13): luật vận tải hành khách (nhóm van_tai_khach của M1), đếm người,
 * chấm lỗi, dấu, thứ tự nặng nhẹ (câu D19), đọc câu trả lời, sinh lượt theo màn, đề không lộ đáp án. Chạy
 * trên chính 20 xe mẫu, luật mẫu và dòng mức phạt mẫu trong data/.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  type BuocLuot,
  type BuocXeKhach,
  type ChiTietXeKhach,
  cacLanLaiLienTuc,
  chamThuTuNangNhe,
  dinhNghiaTheoMan,
  kiemTraGiayToVanTai,
  kiemTraLuatGiayTo,
  kiemTraXeKhach,
  kiemTraXeKhachTroChoi,
  type LuatVanTaiKhach,
  laNguoi,
  type MaLoiVanTai,
  MUC_SO_NGUOI,
  type MucPhatDaDuyet,
  type NguonXeKhach,
  SO_XE_THEO_MAN_XK,
  soDoKhoang,
  TRO_CHOI_LEN_XE_KHACH as TC,
  taoRng,
  type XeKhach,
  xeKhachDungDuocOMan,
} from "../src/index.ts";

const GOC = join(import.meta.dir, "..", "..", "..");
const LUAT: LuatVanTaiKhach[] = (
  (await Bun.file(join(GOC, "data", "tra-cuu", "luat-van-tai-khach.json")).json()) as { dong: any[] }
).dong.map((d) => ({
  ma: d.ma,
  version: 1,
  nhom: d.nhom,
  kiem: d.kiem,
  phan: d.phan,
  tham_so: d.tham_so,
  ten: d.ten,
  giai_thich: d.giai_thich,
  can_cu: d.can_cu,
  ma_muc_phat: d.ma_muc_phat,
}));
const MUC_PHAT: Record<string, MucPhatDaDuyet> = Object.fromEntries(
  ((await Bun.file(join(GOC, "data", "tra-cuu", "muc-phat.json")).json()) as { dong: any[] }).dong
    .filter((d) => String(d.ma).startsWith("oto-khach-"))
    .map((d) => [
      d.ma,
      {
        ma: d.ma,
        version: 1,
        hanh_vi: d.hanh_vi,
        phat_tu: d.phat_tu,
        phat_den: d.phat_den,
        tru_diem: d.tru_diem,
        hinh_thuc_bo_sung: d.hinh_thuc_bo_sung,
        can_cu: d.can_cu,
      },
    ]),
);
const MAU = (
  (await Bun.file(join(GOC, "data", "tro-choi", "xe-khach.json")).json()) as {
    xe: Array<{ ma: string; muc: number; loi: MaLoiVanTai[]; xe: XeKhach }>;
  }
).xe;

/** Luật cách tính trẻ em chỉ dùng trong test (tệp luật cố ý không có luật này). */
const TRE_EM: LuatVanTaiKhach = {
  ma: "thu-tre-em",
  version: 1,
  nhom: "van_tai_khach",
  kiem: "tre_em",
  phan: "khoang_xe",
  tham_so: { so_tre: 3, bang_nguoi: 2, lam_tron: "len" },
  ten: "Luật trẻ em dùng trong test",
  giai_thich: "Chỉ để thử bộ đếm, không phải quy định.",
  can_cu: "vn:thu",
  ma_muc_phat: null,
};

const mau = (ma: string) => MAU.find((x) => x.ma === ma)!;
const nguonTu = (
  x: (typeof MAU)[number],
  o: { luat?: LuatVanTaiKhach[]; mucPhat?: Record<string, MucPhatDaDuyet>; xe?: XeKhach } = {},
): NguonXeKhach => ({
  id: x.ma,
  code: x.ma,
  version: 1,
  topic_id: null,
  muc: x.muc,
  xe: o.xe ?? x.xe,
  loi_du_kien: x.loi,
  luat: o.luat ?? LUAT,
  muc_phat: o.mucPhat ?? MUC_PHAT,
});

/** Bước của đúng một xe ở một màn, dựng qua chính taoLuot. */
function buoc(ma: string, man = 5, n = nguonTu(mau(ma)), seed = "x"): BuocLuot<BuocXeKhach> {
  const [b] = TC.taoLuot([n], taoRng(seed), man);
  if (!b) throw new Error(`Xe ${ma} không vào được màn ${man}`);
  return b;
}
const cham = (b: BuocLuot<BuocXeKhach>, raw: unknown) => {
  const tl = TC.docTraLoi(raw);
  if (!tl) throw new Error("Câu trả lời không hợp lệ");
  return TC.chamBuoc(b, tl);
};
const ct = (r: { chiTiet?: unknown }) => r.chiTiet as ChiTietXeKhach;
const idNguoi = (b: BuocLuot<BuocXeKhach>) =>
  b.noi_dung.phan_tu.filter((p) => laNguoi(p.hinh)).map((p) => p.id);
const idVat = (b: BuocLuot<BuocXeKhach>) =>
  b.noi_dung.phan_tu.filter((p) => !laNguoi(p.hinh)).map((p) => p.id);

/** Trả lời đúng hoàn toàn một bước (thứ tự đúng theo mức phạt). */
function traLoiDung(b: BuocLuot<BuocXeKhach>) {
  const n = b.noi_dung;
  const cham = n.loi.filter((l) => l.ma !== "cho_qua_nguoi").map((l) => l.cho[0]!);
  const thuTu = [...n.loi]
    .sort((a, c) => (n.phat_toi_da[c.ma] ?? -1) - (n.phat_toi_da[a.ma] ?? -1))
    .map((l) => l.cho[0]!);
  return {
    dem: idNguoi(b),
    so_vuot: n.so_vuot,
    cham,
    dau: n.dau,
    thu_tu: n.dau === "lap_bien_ban" ? thuTu : [],
  };
}

/* ------------------------------------------------------------------ */

describe("luật vận tải hành khách (M1, nhóm van_tai_khach)", () => {
  test("luật mẫu hợp lệ; sai cặp kiểu kiểm và phần, thiếu ngưỡng, luật trẻ em sai tham số bị báo lỗi", () => {
    for (const l of LUAT) expect(kiemTraLuatGiayTo(l)).toEqual([]);
    expect(kiemTraLuatGiayTo(TRE_EM)).toEqual([]);
    expect(kiemTraLuatGiayTo({ ...LUAT[0]!, phan: "phu_hieu" }).length).toBeGreaterThan(0);
    const lienTuc = LUAT.find((l) => l.kiem === "lai_lien_tuc")!;
    expect(kiemTraLuatGiayTo({ ...lienTuc, tham_so: { toi_da_phut: 240 } }).length).toBeGreaterThan(0);
    expect(kiemTraLuatGiayTo({ ...lienTuc, tham_so: {} }).length).toBeGreaterThan(0);
    expect(
      kiemTraLuatGiayTo({ ...TRE_EM, tham_so: { so_tre: 2, bang_nguoi: 3, lam_tron: "len" } }),
    ).toContain("Luật trẻ em: bang_nguoi không được lớn hơn so_tre.");
    expect(kiemTraLuatGiayTo({ ...TRE_EM, nhom: "khac" as never })).toEqual(["Nhóm luật không hợp lệ."]);
  });

  test("tệp luật không có luật cách tính trẻ em (không tự đặt)", () => {
    expect(LUAT.some((l) => l.kiem === "tre_em")).toBe(false);
  });

  test("dữ liệu giám sát: đoạn không liền nhau hoặc giờ ngược bị báo lỗi", () => {
    const g = mau("XK-15").xe.giam_sat_hanh_trinh;
    expect(kiemTraGiayToVanTai({ giam_sat_hanh_trinh: g })).toEqual([]);
    const ho = { ...g, doan: [g.doan[0]!, { ...g.doan[1]!, tu: "09:05" }] };
    expect(kiemTraGiayToVanTai({ giam_sat_hanh_trinh: ho }).length).toBeGreaterThan(0);
    const nguoc = { ...g, doan: [{ tu: "10:00", den: "09:00", chay: true }] };
    expect(kiemTraGiayToVanTai({ giam_sat_hanh_trinh: nguoc }).length).toBeGreaterThan(0);
  });

  test("20 xe mẫu hợp lệ; luật cho đúng lỗi dự kiến; xe có trẻ em không tính được khi chưa có luật trẻ em", () => {
    expect(MAU).toHaveLength(20);
    for (const x of MAU) {
      expect(kiemTraXeKhachTroChoi({ ...x.xe, muc: x.muc }, x.loi)).toEqual([]);
      const coTre = x.xe.phan_tu.some((p) => p.hinh === "tre_em");
      const r = kiemTraXeKhach(x.xe, coTre ? [...LUAT, TRE_EM] : LUAT);
      expect(r?.map((l) => l.ma).sort()).toEqual([...x.loi].sort());
      if (coTre) {
        expect(kiemTraXeKhach(x.xe, LUAT)).toBeNull();
        expect(xeKhachDungDuocOMan(nguonTu(x), 5)).toBe(false);
        expect(xeKhachDungDuocOMan(nguonTu(x, { luat: [...LUAT, TRE_EM] }), 5)).toBe(true);
      } else expect(xeKhachDungDuocOMan(nguonTu(x), 5)).toBe(true);
    }
  });

  test("thời gian lái liên tục: đúng bằng ngưỡng không vượt, hơn một phút là vượt", () => {
    const x = mau("XK-14").xe;
    expect(kiemTraXeKhach(x, LUAT)).toEqual([]);
    const g = x.giam_sat_hanh_trinh;
    const hon = {
      ...x,
      giam_sat_hanh_trinh: {
        ...g,
        doan: [{ ...g.doan[0]!, den: "10:01" }, { ...g.doan[1]!, tu: "10:01" }, g.doan[2]!],
      },
    };
    expect(kiemTraXeKhach(hon, LUAT)!.map((l) => l.ma)).toEqual(["lai_lien_tuc_qua_gio"]);
  });

  test("lần dừng ngắn hơn thời gian nghỉ tối thiểu không ngắt lái liên tục; dừng đủ thì ngắt", () => {
    const g = mau("XK-17").xe.giam_sat_hanh_trinh;
    expect(cacLanLaiLienTuc(g, 15).map((l) => l.phut)).toEqual([260]);
    expect(cacLanLaiLienTuc(g, 10).map((l) => l.phut)).toEqual([120, 140]);
    const r = kiemTraXeKhach(mau("XK-17").xe, LUAT)!.find((l) => l.ma === "lai_lien_tuc_qua_gio")!;
    expect(r.cho).toEqual(["gs.doan.0", "gs.doan.2"]);
  });

  test("tổng thời gian lái trong ngày đúng bằng ngưỡng không vượt", () => {
    const x = mau("XK-15").xe;
    const g = x.giam_sat_hanh_trinh;
    // 240 + 240 + 120 = 600 phút.
    const bang = {
      ...x,
      lenh_van_chuyen: { ...x.lenh_van_chuyen!, bien_so: x.bien_so },
      giam_sat_hanh_trinh: { ...g, doan: [...g.doan.slice(0, 4), { ...g.doan[4]!, den: "16:00" }] },
    };
    expect(kiemTraXeKhach(bang, LUAT)).toEqual([]);
  });

  test("lệnh vận chuyển sai ngày, sai lái xe; phù hiệu hết hạn; hết hạn đúng ngày kiểm tra vẫn còn giá trị", () => {
    expect(kiemTraXeKhach(mau("XK-09").xe, LUAT)!.map((l) => l.ma)).toEqual(["lenh_sai_ngay"]);
    expect(kiemTraXeKhach(mau("XK-12").xe, LUAT)!.map((l) => l.ma)).toEqual([
      "lenh_sai_lai_xe",
      "thieu_phu_hieu",
    ]);
    const x = mau("XK-11").xe;
    expect(x.phu_hieu!.co_gia_tri_den).toBe(x.ngay_kiem_tra);
    expect(kiemTraXeKhach(x, LUAT)).toEqual([]);
    const truoc = { ...x, phu_hieu: { ...x.phu_hieu!, co_gia_tri_den: "2026-09-14" } };
    expect(kiemTraXeKhach(truoc, LUAT)!.map((l) => l.ma)).toEqual(["phu_hieu_het_han"]);
  });

  test("luật chưa duyệt (vắng khỏi nguồn): xe không vào màn cần luật đó, vẫn vào màn thấp hơn", () => {
    const thieu = LUAT.filter((l) => l.kiem !== "lai_trong_ngay");
    const n = nguonTu(mau("XK-06"), { luat: thieu });
    expect(xeKhachDungDuocOMan(n, 3)).toBe(true);
    expect(xeKhachDungDuocOMan(n, 4)).toBe(false);
  });

  test("ngưỡng đổi sau khi duyệt lại thì đáp án đổi theo", () => {
    const n = nguonTu(mau("XK-13"));
    expect(xeKhachDungDuocOMan(n, 4)).toBe(true);
    const moi = LUAT.map((l) =>
      l.kiem === "lai_lien_tuc" ? { ...l, tham_so: { ...l.tham_so, toi_da_phut: 300 } } : l,
    );
    // Ngưỡng mới 300 phút: xe lái 270 phút không còn lỗi, khác dự kiến nên không vào lượt.
    expect(kiemTraXeKhach(n.xe, moi)).toEqual([]);
    expect(xeKhachDungDuocOMan({ ...n, luat: moi }, 4)).toBe(false);
  });
});

describe("đếm người", () => {
  test("đếm đúng từng người và báo đúng số vượt: +10", () => {
    const b = buoc("XK-02", 1);
    expect(b.noi_dung.so_vuot).toBe(2);
    const r = cham(b, { dem: idNguoi(b), so_vuot: 2, dau: "lap_bien_ban" });
    expect(ct(r).diem_dem).toBe(10);
  });

  test("đếm dư (chạm vật dễ nhầm): không có điểm đếm, vật nằm trong danh sách đếm dư", () => {
    const b = buoc("XK-02", 1);
    const vat = idVat(b)[0]!;
    const r = cham(b, { dem: [...idNguoi(b), vat], so_vuot: 3, dau: "lap_bien_ban" });
    expect(ct(r).diem_dem).toBe(0);
    expect(ct(r).dem_du).toEqual([vat]);
    // Chạm vật nhưng vẫn báo đúng số vượt: vẫn không có điểm đếm.
    expect(ct(cham(b, { dem: [...idNguoi(b), vat], so_vuot: 2, dau: "lap_bien_ban" })).diem_dem).toBe(0);
  });

  test("đếm thiếu: không có điểm đếm, người bị sót nằm trong danh sách", () => {
    const b = buoc("XK-02", 1);
    const [dau, ...con] = idNguoi(b);
    const r = cham(b, { dem: con, so_vuot: 1, dau: "lap_bien_ban" });
    expect(ct(r).diem_dem).toBe(0);
    expect(ct(r).bo_sot).toEqual([dau!]);
  });

  test("chạm hai lần cùng một người không tính hai lần", () => {
    const b = buoc("XK-02", 1);
    const ds = idNguoi(b);
    const r = cham(b, { dem: [...ds, ds[0], ds[1]], so_vuot: 2, dau: "lap_bien_ban" });
    expect(ct(r).diem_dem).toBe(10);
    expect(ct(r).dem_du).toEqual([]);
  });

  test("đếm đúng người nhưng báo sai số vượt: không có điểm đếm", () => {
    const b = buoc("XK-02", 1);
    expect(ct(cham(b, { dem: idNguoi(b), so_vuot: 1, dau: "lap_bien_ban" })).diem_dem).toBe(0);
  });

  test("xe đúng bằng số chỗ: báo 0 là đúng, dấu đúng là Cho đi", () => {
    const b = buoc("XK-04", 1);
    expect(b.noi_dung.so_vuot).toBe(0);
    expect(b.noi_dung.dau).toBe("cho_di");
    const r = cham(b, { dem: idNguoi(b), so_vuot: 0, dau: "cho_di" });
    expect(r.diem).toBe(15);
    expect(b.diem_toi_da).toBe(15);
  });

  test("id người sinh theo lượt: seed khác thì id khác, id không mang tên loại", () => {
    const a = buoc("XK-05", 2, undefined, "a").noi_dung.phan_tu.map((p) => p.id);
    const c = buoc("XK-05", 2, undefined, "c").noi_dung.phan_tu.map((p) => p.id);
    expect(a).not.toEqual(c);
    for (const id of a) expect(id).toMatch(/^[a-z0-9]{8}$/);
    expect(new Set(a).size).toBe(a.length);
  });

  test("xe có trẻ em đếm theo luật trẻ em đã duyệt (3 trẻ tính bằng 2 người, làm tròn lên)", () => {
    const n = nguonTu(mau("XK-07"), { luat: [...LUAT, TRE_EM] });
    const b = buoc("XK-07", 2, n);
    // 29 người lớn, 2 trẻ em: 2 × 2 / 3 = 1,33 → 2; 31 người trên 28 chỗ.
    expect(b.noi_dung.so_quy_doi).toBe(31);
    expect(b.noi_dung.so_vuot).toBe(3);
    expect(ct(cham(b, { dem: idNguoi(b), so_vuot: 3, dau: "lap_bien_ban" })).diem_dem).toBe(10);
  });
});

describe("lỗi giấy tờ, giám sát và dấu", () => {
  test("trả lời đúng hoàn toàn: đủ điểm tối đa", () => {
    for (const x of MAU.filter((m) => !m.xe.phan_tu.some((p) => p.hinh === "tre_em"))) {
      const b = buoc(x.ma, 5);
      const r = cham(b, traLoiDung(b));
      expect(r.diem).toBe(b.diem_toi_da);
      expect(r.dung).toBe(true);
    }
  });

  test("mỗi lỗi chỉ đúng +5; chạm nhầm −2 chỉ trong phần lỗi, không âm", () => {
    const b = buoc("XK-18", 5);
    // 3 lỗi giấy tờ, giám sát: 10 + 15 + 5 + 5 = 35.
    expect(b.diem_toi_da).toBe(35);
    const dung = traLoiDung(b);
    const motLoi = { ...dung, cham: ["lvc.ngay"], thu_tu: ["lvc.ngay"] };
    expect(ct(cham(b, motLoi)).diem_loi).toBe(5);
    const nham = { ...dung, cham: ["lvc.ngay", "lvc.tuyen", "ph.loai", "gs.doan.1"], thu_tu: [] };
    expect(ct(cham(b, nham)).diem_loi).toBe(0);
    const r = cham(b, nham);
    expect(r.diem).toBe(10 + 0 + 5);
    expect(ct(r).cho_nham).toEqual(["lvc.tuyen", "ph.loai", "gs.doan.1"]);
  });

  test("dấu sai: không có điểm dấu; Cho đi thì không có điểm thứ tự", () => {
    const b = buoc("XK-10", 3);
    const r = cham(b, { ...traLoiDung(b), dau: "cho_di" });
    expect(ct(r).diem_dau).toBe(0);
    expect(ct(r).diem_thu_tu).toBe(0);
  });

  test("màn 1–2 không kiểm giấy tờ: xe có lỗi giấy vẫn là Cho đi nếu không vượt", () => {
    const b = buoc("XK-09", 3);
    expect(b.noi_dung.dau).toBe("lap_bien_ban");
    const n = nguonTu({ ...mau("XK-09"), muc: 2 });
    const b2 = buoc("XK-09", 2, n);
    expect(b2.noi_dung.loi).toEqual([]);
    expect(b2.noi_dung.dau).toBe("cho_di");
  });

  test("biên bản theo thứ tự nặng đến nhẹ, mức phạt lấy từ dòng đã duyệt", () => {
    const b = buoc("XK-17", 5);
    expect(b.noi_dung.bien_ban.map((d) => d.muc_phat?.ma)).toEqual([
      "oto-khach-thoi-gian-lai",
      "oto-khach-cho-qua-nguoi",
    ]);
  });
});

describe("thứ tự nặng đến nhẹ (câu D19)", () => {
  test("đúng 5; sai một cặp liền kề 2; còn lại 0", () => {
    expect(chamThuTuNangNhe([5, 4, 2])).toBe(5);
    expect(chamThuTuNangNhe([4, 5, 2])).toBe(2);
    expect(chamThuTuNangNhe([5, 2, 4])).toBe(2);
    expect(chamThuTuNangNhe([2, 4, 5])).toBe(0);
    expect(chamThuTuNangNhe([2, 2])).toBe(5);
  });

  test("hai lỗi cùng mức phạt tối đa: thứ tự nào cũng đúng", () => {
    const b = buoc("XK-12", 3);
    expect(b.noi_dung.co_thu_tu).toBe(true);
    const dung = traLoiDung(b);
    for (const thu_tu of [
      ["lvc.lai_xe", "thieu.phu_hieu"],
      ["thieu.phu_hieu", "lvc.lai_xe"],
    ]) {
      const r = cham(b, { ...dung, thu_tu });
      expect(ct(r).diem_thu_tu).toBe(5);
      expect(r.diem).toBe(b.diem_toi_da);
    }
  });

  test("ba lỗi, hai lỗi cùng mức: đặt lỗi nặng nhất xuống giữa thì sai một cặp liền kề", () => {
    const b = buoc("XK-18", 5);
    const dung = traLoiDung(b);
    const r = (thu_tu: string[]) => ct(cham(b, { ...dung, thu_tu })).diem_thu_tu;
    expect(r(["gs.tong", "ph.bien_so", "lvc.ngay"])).toBe(5);
    expect(r(["gs.tong", "lvc.ngay", "ph.bien_so"])).toBe(5);
    expect(r(["lvc.ngay", "gs.tong", "ph.bien_so"])).toBe(2);
    expect(r(["lvc.ngay", "ph.bien_so", "gs.tong"])).toBe(0);
  });

  test("mục chở quá số người trong bước sắp; mục trùng hoặc chạm nhầm bị bỏ", () => {
    const b = buoc("XK-10", 3);
    const dung = traLoiDung(b);
    expect(ct(cham(b, { ...dung, thu_tu: [MUC_SO_NGUOI, "ph.co_gia_tri_den"] })).diem_thu_tu).toBe(5);
    expect(ct(cham(b, { ...dung, thu_tu: ["ph.co_gia_tri_den", MUC_SO_NGUOI] })).diem_thu_tu).toBe(2);
    const thua = {
      ...dung,
      cham: ["ph.co_gia_tri_den", "ph.loai"],
      thu_tu: ["ph.loai", MUC_SO_NGUOI, "ph.co_gia_tri_den"],
    };
    expect(ct(cham(b, thua)).thu_tu_nguoi_choi).toEqual(["cho_qua_nguoi", "phu_hieu_het_han"]);
  });

  test("lỗi chưa có mức phạt đã duyệt không vào bước sắp", () => {
    const { "oto-khach-thoi-gian-lai": _, ...conLai } = MUC_PHAT;
    const b = buoc("XK-17", 5, nguonTu(mau("XK-17"), { mucPhat: conLai }));
    // Còn một lỗi có mức phạt: không có bước sắp; biên bản ghi "chưa có mức phạt".
    expect(b.noi_dung.co_thu_tu).toBe(false);
    expect(b.diem_toi_da).toBe(10 + 5 + 5);
    expect(b.noi_dung.bien_ban.some((d) => d.muc_phat === null)).toBe(true);
    const r = cham(b, traLoiDung(b));
    expect(ct(r).thu_tu_dung).toEqual(["cho_qua_nguoi"]);
    expect(r.diem).toBe(b.diem_toi_da);
  });
});

describe("đọc câu trả lời", () => {
  test("dấu lạ, số vượt ngoài 0–60, id sai dạng, chỗ lạ, thứ tự có chỗ chưa chạm: không nhận", () => {
    const hop = { dem: [], so_vuot: 0, cham: [], dau: "cho_di", thu_tu: [] };
    expect(TC.docTraLoi(hop)).not.toBeNull();
    for (const sai of [
      { ...hop, dau: "giu_lai" },
      { ...hop, so_vuot: -1 },
      { ...hop, so_vuot: 61 },
      { ...hop, so_vuot: 1.5 },
      { ...hop, dem: ["NGUOI_LON"] },
      { ...hop, cham: ["gplx.hang"] },
      { ...hop, cham: ["gs.doan.40"] },
      { ...hop, dau: "lap_bien_ban", cham: ["lvc.ngay"], thu_tu: ["ph.so"] },
    ])
      expect(TC.docTraLoi(sai)).toBeNull();
  });

  test("Cho đi bỏ thứ tự; điểm, cờ đúng, số vượt đúng máy khách gửi kèm bị bỏ qua", () => {
    const tl = TC.docTraLoi({
      dem: ["abcd1234", "abcd1234"],
      so_vuot: 0,
      cham: [],
      dau: "cho_di",
      thu_tu: [MUC_SO_NGUOI],
      diem: 30,
      dung: true,
      so_vuot_dung: 0,
    });
    expect(tl).toEqual({ dem: ["abcd1234"], so_vuot: 0, cham: [], dau: "cho_di", thu_tu: [] });
  });
});

describe("lượt và đề", () => {
  const NGUON = MAU.map((x) => nguonTu(x));

  test("số xe và giờ theo màn; tất định theo seed", () => {
    for (let m = 1; m <= 5; m++) {
      const l = TC.taoLuot(NGUON, taoRng(`s${m}`), m);
      expect(l).toHaveLength(SO_XE_THEO_MAN_XK[m]!);
      expect(l.some((b) => b.noi_dung.dau === "lap_bien_ban")).toBe(true);
      for (const b of l) expect(b.noi_dung.xe.phan_tu.some((p) => p.hinh === "tre_em")).toBe(false);
      expect(JSON.stringify(TC.taoLuot(NGUON, taoRng(`s${m}`), m))).toBe(JSON.stringify(l));
    }
    expect(dinhNghiaTheoMan(TC, 1).thoiGian).toBeNull();
    expect(dinhNghiaTheoMan(TC, 3).thoiGian).toEqual({ moiBuocMs: 180_000 });
    expect(dinhNghiaTheoMan(TC, 5).thoiGian).toEqual({ moiBuocMs: 210_000 });
    expect(TC.taoLuot(NGUON, taoRng("m1"), 1).every((b) => b.noi_dung.xe.loai_xe === "xe_16_cho")).toBe(true);
  });

  const KHOA_CAM = [
    "loi",
    "luat",
    "so_vuot",
    "so_quy_doi",
    "dau",
    "bien_ban",
    "muc_phat",
    "phat_toi_da",
    "co_thu_tu",
    "can_cu",
    "giai_thich",
    "noi_dung",
    "answer",
    "dap_an",
    "muc",
  ];
  const coKhoaCam = (v: unknown): string | null => {
    if (Array.isArray(v))
      for (const x of v) {
        const k = coKhoaCam(x);
        if (k) return k;
      }
    else if (v && typeof v === "object")
      for (const [k, x] of Object.entries(v)) {
        if (KHOA_CAM.includes(k)) return k;
        const con = coKhoaCam(x);
        if (con) return con;
      }
    return null;
  };

  test("đề không có số chỗ quy đổi, số người vượt, lỗi, luật; giấy tờ từ màn 3, giám sát từ màn 4", () => {
    for (let m = 1; m <= 5; m++)
      for (const b of TC.taoLuot(NGUON, taoRng(`d${m}`), m)) {
        const de = TC.deChoNguoiChoi(b);
        expect(coKhoaCam(de)).toBeNull();
        expect(de.so_cho).toBe(soDoKhoang(de.loai_xe).so_cho);
        expect(de.giay_to === null).toBe(m < 3);
        expect(de.lai_xe === null).toBe(m < 3);
        expect(de.giam_sat === null).toBe(m < 4);
        // Phần tử sắp theo id, không theo thứ tự người soạn.
        const ids = de.phan_tu.map((p) => p.id);
        expect(ids).toEqual([...ids].sort());
        expect(Object.keys(de.phan_tu[0]!).sort()).toEqual(["hinh", "id", "o"]);
      }
  });

  test("cùng xe cùng đáp án ở máy khách (gói offline) và máy chủ", () => {
    const goi = JSON.parse(JSON.stringify(NGUON)) as NguonXeKhach[];
    const a = TC.taoLuot(NGUON, taoRng("off"), 5);
    const c = TC.taoLuot(goi, taoRng("off"), 5);
    expect(JSON.stringify(c)).toBe(JSON.stringify(a));
    for (const [i, b] of a.entries()) {
      const tl = traLoiDung(b);
      expect(cham(c[i]!, JSON.parse(JSON.stringify(tl))).diem).toBe(cham(b, tl).diem);
    }
  });
});
