/** Mùa giải đơn vị (docs/PLAN.md GĐ-G6, mục "Kiểm tra đã xong"): chấm điểm tuần, lên/xuống hạng, mốc chốt. */
import { describe, expect, test } from "bun:test";
import { ngayVietNam } from "../src/diem-thuong.ts";
import {
  type CauHinhMuaGiai,
  CAU_HINH_MUA_GIAI_MAC_DINH as CFG,
  cacTuanCuaMua,
  canDeLenHang,
  chiaNhom,
  chotTuan,
  type DonViDauVaoChot,
  datLaiMem,
  diemTuanDonVi,
  hanChotTuan,
  ketQuaTuan,
  kiemCauHinhMuaGiai,
  ngayKetThucMua,
  phanNhomTuanSau,
  saoKetQuaTuan,
  tinhVaoMuaGiai,
  tuanCua,
  tuanThu,
  tuanToiHanChot,
  xepHangBanDau,
  xepTrongNhom,
} from "../src/mua-giai.ts";

const dv = (i: number, bac: number, xp: number[], quanSo = 5, nhom = 1): DonViDauVaoChot => ({
  unit_id: `u${String(i).padStart(2, "0")}`,
  ten: `Đội ${String(i).padStart(2, "0")}`,
  bac,
  nhom,
  quan_so: quanSo,
  xp_tung_nguoi: xp,
});

describe("cấu hình", () => {
  test("cấu hình mặc định hợp lệ; số lên + xuống không được chiếm cả nhóm", () => {
    expect(kiemCauHinhMuaGiai(CFG)).toEqual([]);
    expect(kiemCauHinhMuaGiai({ ...CFG, co_nhom: 4, so_len: 2, so_xuong: 2 })).toHaveLength(1);
    expect(kiemCauHinhMuaGiai({ ...CFG, tran_xp_tuan: 0 })).toHaveLength(1);
  });
});

describe("điểm tuần của đơn vị", () => {
  test("một người đạt 2.000 XP chỉ tính 700 (trần)", () => {
    const d = diemTuanDonVi({ xpTungNguoi: [2000], quanSo: 5 }, CFG);
    expect(d.xp_tinh).toBe(700);
    expect(d.diem).toBe(140);
  });

  test("đơn vị 5 người có 1 người chơi bị chia cho 5", () => {
    const d = diemTuanDonVi({ xpTungNguoi: [300], quanSo: 5 }, CFG);
    expect(d.diem).toBe(60);
    expect(d.ty_le_tham_gia).toBe(0.2);
  });

  test("đơn vị dưới 3 thành viên hoạt động không xếp hạng", () => {
    expect(diemTuanDonVi({ xpTungNguoi: [500, 500], quanSo: 2 }, CFG).xep_hang).toBe(false);
    expect(diemTuanDonVi({ xpTungNguoi: [], quanSo: 3 }, CFG).xep_hang).toBe(true);
    const xep = xepTrongNhom([
      { unit_id: "a", ten: "Ít người", diem: 500, ty_le_tham_gia: 1, xep_hang: false },
      { unit_id: "b", ten: "Đủ người", diem: 10, ty_le_tham_gia: 0.2, xep_hang: true },
    ]);
    expect(xep.map((d) => [d.unit_id, d.hang])).toEqual([
      ["b", 1],
      ["a", null],
    ]);
  });

  test("bằng điểm thì đơn vị có tỷ lệ người tham gia cao hơn đứng trên", () => {
    // A: 1 người 400 XP / 4 người = 100, tham gia 25%. B: 4 người 100 XP / 4 = 100, tham gia 100%.
    const a = diemTuanDonVi({ xpTungNguoi: [400], quanSo: 4 }, CFG);
    const b = diemTuanDonVi({ xpTungNguoi: [100, 100, 100, 100], quanSo: 4 }, CFG);
    expect(a.diem).toBe(b.diem);
    const xep = xepTrongNhom([
      { unit_id: "a", ten: "A", ...a },
      { unit_id: "b", ten: "B", ...b },
    ]);
    expect(xep[0]!.unit_id).toBe("b");
  });

  test("người không chơi không làm tăng tỷ lệ; XP âm hay 0 bị bỏ qua", () => {
    const d = diemTuanDonVi({ xpTungNguoi: [0, 50], quanSo: 5 }, CFG);
    expect(d.so_nguoi_choi).toBe(1);
    expect(d.diem).toBe(10);
  });
});

describe("lên hạng, xuống hạng", () => {
  const nhom10 = (bac: number) =>
    chotTuan(
      Array.from({ length: 10 }, (_, i) => dv(i + 1, bac, [100 * (10 - i)])),
      CFG,
    );

  test("nhóm 10 đơn vị ở hạng giữa: 2 đầu lên, 2 cuối xuống", () => {
    const kq = nhom10(2);
    expect(kq.filter((d) => d.ket_qua === "len").map((d) => d.unit_id)).toEqual(["u01", "u02"]);
    expect(kq.filter((d) => d.ket_qua === "xuong").map((d) => d.unit_id)).toEqual(["u09", "u10"]);
    expect(kq.filter((d) => d.ket_qua === "giu")).toHaveLength(6);
    expect(kq.find((d) => d.unit_id === "u01")!.bac_tuan_sau).toBe(1);
    expect(kq.find((d) => d.unit_id === "u10")!.bac_tuan_sau).toBe(3);
  });

  test("hạng 1 không lên, hạng thấp nhất không xuống", () => {
    expect(nhom10(1).filter((d) => d.ket_qua === "len")).toHaveLength(0);
    expect(nhom10(1).filter((d) => d.ket_qua === "xuong")).toHaveLength(2);
    expect(nhom10(4).filter((d) => d.ket_qua === "xuong")).toHaveLength(0);
    expect(nhom10(4).filter((d) => d.ket_qua === "len")).toHaveLength(2);
  });

  test("nhóm nhỏ: không đơn vị nào vừa lên vừa xuống; ưu tiên lên", () => {
    const cfg = { so_hang: 4, so_len: 2, so_xuong: 2 };
    expect([1, 2, 3].map((h) => ketQuaTuan(h, 3, 2, cfg))).toEqual(["len", "len", "xuong"]);
    expect([1, 2].map((h) => ketQuaTuan(h, 2, 2, cfg))).toEqual(["len", "len"]);
  });

  test("đơn vị không xếp hạng giữ nguyên hạng, không có kết quả", () => {
    const kq = chotTuan([dv(1, 2, [700, 700], 2), dv(2, 2, [10]), dv(3, 2, [5]), dv(4, 2, [1])], CFG);
    const it = kq.find((d) => d.unit_id === "u01")!;
    expect(it.hang).toBeNull();
    expect(it.ket_qua).toBeNull();
    expect(it.bac_tuan_sau).toBe(2);
  });
});

describe("chia nhóm, xếp hạng ban đầu, đặt lại mềm", () => {
  test("20 đơn vị, cỡ 10: 2 nhóm 10, tổng điểm hai nhóm gần bằng nhau (chia kiểu rắn)", () => {
    const ds = Array.from({ length: 20 }, (_, i) => ({ unit_id: `u${i}`, diem_truoc: 20 - i }));
    const nhom = chiaNhom(ds, 10);
    const tong = [0, 0];
    const dem = [0, 0];
    for (const d of ds) {
      const g = nhom.get(d.unit_id)! - 1;
      tong[g]! += d.diem_truoc;
      dem[g]!++;
    }
    expect(dem).toEqual([10, 10]);
    expect(Math.abs(tong[0]! - tong[1]!)).toBeLessThanOrEqual(10);
    expect(nhom.get("u0")).not.toBe(nhom.get("u1")); // hai đơn vị mạnh nhất không chung nhóm
  });

  test("số nhóm làm tròn theo cỡ nhóm, ít nhất 1", () => {
    const ds = (n: number) => Array.from({ length: n }, (_, i) => ({ unit_id: `u${i}`, diem_truoc: i }));
    expect(new Set(chiaNhom(ds(4), 10).values()).size).toBe(1);
    expect(new Set(chiaNhom(ds(14), 10).values()).size).toBe(1);
    expect(new Set(chiaNhom(ds(16), 10).values()).size).toBe(2);
  });

  test("mùa đầu: chia đều theo XP trung bình, hạng trên nhận phần dư", () => {
    const ds = Array.from({ length: 10 }, (_, i) => ({ unit_id: `u${i}`, xp_trung_binh: 100 - i }));
    const bac = xepHangBanDau(ds, 4);
    const dem = [1, 2, 3, 4].map((b) => [...bac.values()].filter((x) => x === b).length);
    expect(dem).toEqual([3, 3, 2, 2]);
    expect(bac.get("u0")).toBe(1);
    expect(bac.get("u9")).toBe(4);
  });

  test("đặt lại mềm: xuống một hạng, hạng thấp nhất giữ nguyên", () => {
    expect(datLaiMem(1, 4)).toBe(2);
    expect(datLaiMem(4, 4)).toBe(4);
  });

  test("đơn vị mới vào giữa mùa xếp hạng thấp nhất", () => {
    const ra = phanNhomTuanSau([{ unit_id: "a", bac_tuan_sau: 1, diem: 5 }], ["moi"], {
      so_hang: 3,
      co_nhom: 10,
    });
    expect(ra.find((d) => d.unit_id === "moi")!.bac).toBe(3);
  });
});

describe("mốc thời gian (giờ Việt Nam)", () => {
  // Tuần 21/9/2026 (thứ Hai) – 27/9/2026 (Chủ nhật). Mốc chốt: 06:00 thứ Hai 28/9 = 23:00 UTC 27/9.
  const tuan = "2026-09-21";

  test("XP lúc 23:59 Chủ nhật tính cho tuần đó", () => {
    const luc = new Date("2026-09-27T16:59:00Z"); // 23:59 giờ VN
    expect(tuanCua(luc)).toBe(tuan);
    expect(tinhVaoMuaGiai({ ngay: ngayVietNam(luc), ghiLuc: luc }, tuan)).toBe(true);
    // 00:00 thứ Hai đã sang tuần sau.
    expect(tuanCua(new Date("2026-09-27T17:00:00Z"))).toBe("2026-09-28");
  });

  test("lượt offline chơi Chủ nhật, đồng bộ 05:59 thứ Hai được tính; 06:01 thì không", () => {
    const ngay = "2026-09-27";
    expect(hanChotTuan(tuan).toISOString()).toBe("2026-09-27T23:00:00.000Z");
    expect(tinhVaoMuaGiai({ ngay, ghiLuc: new Date("2026-09-27T22:59:00Z") }, tuan)).toBe(true);
    expect(tinhVaoMuaGiai({ ngay, ghiLuc: new Date("2026-09-27T23:01:00Z") }, tuan)).toBe(false);
  });

  test("XP của ngày ngoài tuần không tính", () => {
    const ghiLuc = new Date("2026-09-24T03:00:00Z");
    expect(tinhVaoMuaGiai({ ngay: "2026-09-20", ghiLuc }, tuan)).toBe(false);
    expect(tinhVaoMuaGiai({ ngay: "2026-09-28", ghiLuc }, tuan)).toBe(false);
  });

  test("tuần tới hạn chốt: chưa qua 06:00 thì chưa chốt; lỡ nhịp thì chốt bù", () => {
    const bd = "2026-09-07";
    expect(tuanToiHanChot(bd, 12, new Date("2026-09-27T22:59:00Z"))).toEqual(["2026-09-07", "2026-09-14"]);
    expect(tuanToiHanChot(bd, 12, new Date("2026-09-27T23:00:00Z"))).toEqual([
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
    ]);
    expect(tuanToiHanChot(bd, 2, new Date("2026-12-01T00:00:00Z"))).toHaveLength(2);
  });

  test("tuần của mùa và ngày kết thúc", () => {
    expect(cacTuanCuaMua("2026-09-07", 3)).toEqual(["2026-09-07", "2026-09-14", "2026-09-21"]);
    expect(ngayKetThucMua("2026-09-07", 12)).toBe("2026-11-29");
    expect(tuanThu("2026-09-07", "2026-09-21")).toBe(3);
  });
});

describe("hiển thị", () => {
  test("cần bao nhiêu điểm để vào vùng lên hạng", () => {
    const nhom = [
      { unit_id: "a", diem: 50, hang: 1, quan_so: 5 },
      { unit_id: "b", diem: 40, hang: 2, quan_so: 5 },
      { unit_id: "c", diem: 30, hang: 3, quan_so: 4 },
    ];
    expect(canDeLenHang(nhom, "c", 2, CFG)).toEqual({ diem_can: 10.01, xp_can: 41, diem_moc: 40 });
    expect(canDeLenHang(nhom, "b", 2, CFG)).toBeNull(); // đã trong vùng lên hạng
    expect(canDeLenHang(nhom, "c", 1, CFG)).toBeNull(); // hạng 1 không lên nữa
  });

  test("sao kết quả tuần: lên 3, giữ 2, xuống 1", () => {
    expect([saoKetQuaTuan("len"), saoKetQuaTuan("giu"), saoKetQuaTuan("xuong")]).toEqual([3, 2, 1]);
  });
});

describe("mô phỏng 3 hạng × 10 đơn vị × 4 tuần, so với phép tính tay", () => {
  // Đơn vị i (1..30) có 5 người, mỗi tuần 1 người chơi 20·(31 − i) XP → điểm 4·(31 − i).
  // Tuần 1: hạng 1 = u01–u10, hạng 2 = u11–u20, hạng 3 = u21–u30, mỗi hạng 1 nhóm.
  // Tính tay:
  //  - Tuần 1: u09, u10 xuống hạng 2; u11, u12 lên hạng 1; u19, u20 xuống hạng 3; u21, u22 lên hạng 2.
  //  - Tuần 2: hạng 1 = u01–u08, u11, u12 → u11, u12 đứng cuối, xuống; hạng 2 = u09, u10, u13–u18,
  //    u21, u22 → u09, u10 lên, u21, u22 xuống; hạng 3 = u19, u20, u23–u30 → u19, u20 lên.
  //  - Tuần 3 quay về đúng xếp hạng tuần 1, tuần 4 giống tuần 2.
  const cfg: CauHinhMuaGiai = { ...CFG, so_hang: 3 };
  const xp = (i: number) => 20 * (31 - i);
  const ma = (i: number) => `u${String(i).padStart(2, "0")}`;
  const khoang = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, k) => ma(a + k));

  test("kết quả lên/xuống từng tuần khớp", () => {
    let phan = new Map<string, { bac: number; nhom: number }>();
    for (let i = 1; i <= 30; i++) phan.set(ma(i), { bac: Math.ceil(i / 10), nhom: 1 });
    const ketQua: Array<{ len: string[]; xuong: string[] }> = [];
    const hangTuan: Array<Record<number, string[]>> = [];

    for (let tuan = 1; tuan <= 4; tuan++) {
      const dauVao = [...phan].map(([id, p]) =>
        dv(Number(id.slice(1)), p.bac, [xp(Number(id.slice(1)))], 5, p.nhom),
      );
      const chot = chotTuan(dauVao, cfg);
      hangTuan.push(
        Object.fromEntries(
          [1, 2, 3].map((b) => [
            b,
            chot
              .filter((d) => d.bac === b)
              .map((d) => d.unit_id)
              .sort(),
          ]),
        ),
      );
      ketQua.push({
        len: chot
          .filter((d) => d.ket_qua === "len")
          .map((d) => d.unit_id)
          .sort(),
        xuong: chot
          .filter((d) => d.ket_qua === "xuong")
          .map((d) => d.unit_id)
          .sort(),
      });
      phan = new Map(phanNhomTuanSau(chot, [], cfg).map((d) => [d.unit_id, { bac: d.bac, nhom: d.nhom }]));
    }

    const t1 = { len: ["u11", "u12", "u21", "u22"], xuong: ["u09", "u10", "u19", "u20"] };
    const t2 = { len: ["u09", "u10", "u19", "u20"], xuong: ["u11", "u12", "u21", "u22"] };
    expect(ketQua).toEqual([t1, t2, t1, t2]);

    expect(hangTuan[1]![1]).toEqual([...khoang(1, 8), "u11", "u12"]);
    expect(hangTuan[1]![2]).toEqual(["u09", "u10", ...khoang(13, 18), "u21", "u22"]);
    expect(hangTuan[1]![3]).toEqual(["u19", "u20", ...khoang(23, 30)]);
    expect(hangTuan[2]).toEqual(hangTuan[0]!);
    // Điểm: u01 = 4·30 = 120 XP/người.
    const chot1 = chotTuan([dv(1, 1, [xp(1)])], cfg);
    expect(chot1[0]!.diem).toBe(120);
  });
});
