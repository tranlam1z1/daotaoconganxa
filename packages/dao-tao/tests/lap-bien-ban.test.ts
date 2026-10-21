/**
 * Trò "Lập biên bản" (docs/PLAN.md GĐ-G3): chấm từng ô, ghép dòng khi có 2 hành vi, kiểm tình
 * huống, dựng lựa chọn (không lộ mã mức phạt), tìm không dấu, và kiểm 20 tình huống demo với bảng
 * mức phạt thật.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { taoRng } from "../src/de-thi.ts";
import type { DongMucPhat } from "../src/tra-cuu-nhanh.ts";
import { chamBuocCoGio } from "../src/tro-choi/khung.ts";
import {
  type BuocBienBan,
  DIEM_MOI_O,
  diemBoSung,
  dungBuocBienBan,
  dungCayDieuKhoan,
  kiemTraTinhHuongBienBan,
  TRO_CHOI_LAP_BIEN_BAN as LBB,
  type MucPhatBienBan,
  moTaDieuKhoan,
  type NguonLapBienBan,
  type TraLoiBienBan,
  tachDieuKhoan,
  timHanhVi,
} from "../src/tro-choi/lap-bien-ban.ts";

const GOC = join(import.meta.dir, "..", "..", "..");
const ND = "vn:vbqppl:nd:168/2024/NĐ-CP";

function mp(ma: string, o: Partial<MucPhatBienBan> = {}): MucPhatBienBan {
  return {
    ma,
    version: 1,
    xe: "mo_to",
    nhom: "Nhóm A",
    hanh_vi: `Hành vi ${ma}`,
    tu_khoa: [],
    phat_tu: 400_000,
    phat_den: 600_000,
    tru_diem: null,
    hinh_thuc_bo_sung: [],
    can_cu: `${ND}#dieu-7.khoan-2.diem-a`,
    ...o,
  };
}

const MU = mp("mu", {
  nhom: "Mũ bảo hiểm",
  hanh_vi: "Không đội mũ bảo hiểm khi điều khiển xe",
  tu_khoa: ["mũ bảo hiểm"],
  can_cu: `${ND}#dieu-7.khoan-2.diem-h`,
});
const DEN = mp("den", {
  nhom: "Đèn tín hiệu",
  hanh_vi: "Không chấp hành hiệu lệnh của đèn tín hiệu giao thông",
  phat_tu: 4_000_000,
  phat_den: 6_000_000,
  tru_diem: 4,
  can_cu: `${ND}#dieu-7.khoan-7.diem-c`,
});
const CON = mp("con", {
  nhom: "Nồng độ cồn",
  hanh_vi: "Nồng độ cồn vượt quá 80 miligam",
  phat_tu: 8_000_000,
  phat_den: 10_000_000,
  hinh_thuc_bo_sung: ["Tước quyền sử dụng giấy phép lái xe từ 22 tháng đến 24 tháng"],
  tru_diem: null,
  can_cu: `${ND}#dieu-7.khoan-10.diem-a`,
});
const OTO = mp("oto-den", { xe: "o_to", nhom: "Đèn tín hiệu", can_cu: `${ND}#dieu-6.khoan-9.diem-b` });
const BANG: MucPhatBienBan[] = [MU, DEN, CON];

function nguon(viPham: string[], id = "th-1"): NguonLapBienBan {
  return {
    id,
    code: id,
    version: 1,
    topic_id: null,
    tinh_huong: { loi_ke: "Anh A điều khiển xe mô tô trên đường nội thị, tổ công tác dừng xe kiểm tra." },
    dap_an: { vi_pham: viPham },
    muc_phat: BANG,
    can_cu_khac: [OTO.can_cu],
  };
}

function buoc(viPham: string[]): BuocBienBan {
  return dungBuocBienBan(nguon(viPham), 1, taoRng("seed-test"))!.noi_dung;
}

/** Câu trả lời đúng hoàn toàn cho một bước. */
function traLoiDung(b: BuocBienBan): TraLoiBienBan {
  return {
    dong: b.dap_an.dong.map((d) => ({ hanh_vi: d.hanh_vi, dieu_khoan: d.dieu_khoan, tien: d.phat_tu })),
    bo_sung: [...b.dap_an.bo_sung],
  };
}

const cham = (b: BuocBienBan, t: TraLoiBienBan) =>
  LBB.chamBuoc(
    {
      thu_tu: 1,
      ref_kind: "game_content",
      ref_id: "x",
      ref_version: 1,
      topic_id: null,
      diem_toi_da: 100,
      noi_dung: b,
    },
    t,
  );

describe("chấm từng ô", () => {
  test("đúng cả 4 ô được 100", () => {
    const b = buoc(["con"]);
    const kq = cham(b, traLoiDung(b));
    expect(kq.diem).toBe(100);
    expect(kq.dung).toBe(true);
    expect((kq.chiTiet as any).diem_o).toEqual({ hanh_vi: 25, dieu_khoan: 25, tien: 25, bo_sung: 25 });
  });

  test("tiền ở biên dưới và biên trên của khung được đủ điểm; ngoài khung 1 đồng được 0", () => {
    const b = buoc(["mu"]);
    const voi = (tien: number) => {
      const t = traLoiDung(b);
      t.dong[0]!.tien = tien;
      return (cham(b, t).chiTiet as any).diem_o.tien;
    };
    expect(voi(400_000)).toBe(25);
    expect(voi(600_000)).toBe(25);
    expect(voi(399_999)).toBe(0);
    expect(voi(600_001)).toBe(0);
  });

  test("hình thức bổ sung: thiếu một mục được 0, thừa một mục được 12,5, thừa hai mục được 0", () => {
    const b = buoc(["con"]);
    const khac = b.lua_chon_bo_sung.map((o) => o.id).filter((id) => !b.dap_an.bo_sung.includes(id));
    expect(khac.length).toBeGreaterThanOrEqual(1);
    const voi = (bs: string[]) => (cham(b, { ...traLoiDung(b), bo_sung: bs }).chiTiet as any).diem_o.bo_sung;
    expect(voi([])).toBe(0);
    expect(voi([...b.dap_an.bo_sung, khac[0]!])).toBe(12.5);
    expect(cham(b, { ...traLoiDung(b), bo_sung: [...b.dap_an.bo_sung, khac[0]!] }).diem).toBe(87.5);
    expect(diemBoSung(["a", "x", "y"], ["a"])).toBe(0);
    // Không có mục nào đúng: để trống được đủ điểm, đánh một mục thừa được một nửa.
    expect(diemBoSung([], [])).toBe(DIEM_MOI_O);
    expect(diemBoSung(["x"], [])).toBe(DIEM_MOI_O / 2);
  });

  test("sai hành vi, sai Điều: mỗi ô 0, các ô khác vẫn được chấm riêng", () => {
    const b = buoc(["mu"]);
    const t = traLoiDung(b);
    t.dong[0]!.hanh_vi = b.lua_chon_hanh_vi.find((o) => o.id !== t.dong[0]!.hanh_vi)!.id;
    t.dong[0]!.dieu_khoan = `${ND}#dieu-6`;
    const kq = cham(b, t);
    expect((kq.chiTiet as any).diem_o).toEqual({ hanh_vi: 0, dieu_khoan: 0, tien: 25, bo_sung: 25 });
    expect(kq.dung).toBe(false);
  });

  test("điều khoản phải đúng tới điểm: đúng Điều, sai khoản được 0", () => {
    const b = buoc(["mu"]);
    const t = traLoiDung(b);
    t.dong[0]!.dieu_khoan = `${ND}#dieu-7.khoan-2`;
    expect((cham(b, t).chiTiet as any).diem_o.dieu_khoan).toBe(0);
  });

  test("tình huống 2 hành vi điền đảo thứ tự vẫn được đủ điểm", () => {
    const b = buoc(["mu", "den"]);
    const t = traLoiDung(b);
    t.dong.reverse();
    const kq = cham(b, t);
    expect(kq.diem).toBe(100);
    expect((kq.chiTiet as any).dong.map((d: any) => d.dap_an)).toEqual([1, 0]);
  });

  test("2 hành vi, một dòng sai hết: ô 1–3 mỗi ô được một nửa", () => {
    const b = buoc(["mu", "den"]);
    const t = traLoiDung(b);
    t.dong[1] = { hanh_vi: null, dieu_khoan: null, tien: null };
    const kq = cham(b, t);
    expect((kq.chiTiet as any).diem_o).toEqual({ hanh_vi: 12.5, dieu_khoan: 12.5, tien: 12.5, bo_sung: 25 });
  });

  test("2 hành vi: ghép dòng theo cách cho điểm cao nhất, kể cả khi hành vi điền lẫn", () => {
    const b = buoc(["mu", "den"]);
    const [mu, den] = b.dap_an.dong;
    // Dòng 1 chọn hành vi mũ nhưng Điều và tiền của đèn đỏ; dòng 2 ngược lại.
    const t: TraLoiBienBan = {
      dong: [
        { hanh_vi: mu!.hanh_vi, dieu_khoan: den!.dieu_khoan, tien: den!.phat_tu },
        { hanh_vi: den!.hanh_vi, dieu_khoan: mu!.dieu_khoan, tien: mu!.phat_tu },
      ],
      bo_sung: b.dap_an.bo_sung,
    };
    const ct = cham(b, t).chiTiet as any;
    // Ghép theo Điều và tiền (4 ô đúng) tốt hơn ghép theo hành vi (2 ô đúng).
    expect(ct.dong.map((d: any) => d.dap_an)).toEqual([1, 0]);
    expect(ct.diem_o).toEqual({ hanh_vi: 0, dieu_khoan: 25, tien: 25, bo_sung: 25 });
  });

  test("không tính giờ, không thưởng nhanh: trả lời sau 10 phút vẫn đủ điểm", () => {
    const b = buoc(["mu"]);
    const moLuc = new Date("2026-09-27T01:00:00Z");
    const kq = chamBuocCoGio(
      LBB,
      {
        thu_tu: 1,
        ref_kind: "game_content",
        ref_id: "x",
        ref_version: 1,
        topic_id: null,
        diem_toi_da: 100,
        noi_dung: b,
      },
      traLoiDung(b),
      { moLuc, luc: new Date(moLuc.getTime() + 600_000), offline: false },
    );
    expect(kq).toMatchObject({ diem: 100, thuong: 0, hetGio: false });
  });
});

describe("đọc câu trả lời", () => {
  test("sai dạng trả null; thiếu ô thì nhận null", () => {
    expect(LBB.docTraLoi(null)).toBeNull();
    expect(LBB.docTraLoi({ dong: [], bo_sung: [] })).toBeNull();
    expect(LBB.docTraLoi({ dong: [{}, {}, {}], bo_sung: [] })).toBeNull();
    expect(LBB.docTraLoi({ dong: [{ tien: "400000" }], bo_sung: [] })).toBeNull();
    expect(LBB.docTraLoi({ dong: [{ tien: -1 }], bo_sung: [] })).toBeNull();
    expect(LBB.docTraLoi({ dong: [{ hanh_vi: "hv-1" }], bo_sung: [1] })).toBeNull();
    expect(LBB.docTraLoi({ dong: [{ hanh_vi: "hv-1" }], bo_sung: ["bs-1"] })).toEqual({
      dong: [{ hanh_vi: "hv-1", dieu_khoan: null, tien: null }],
      bo_sung: ["bs-1"],
    });
  });
});

describe("kiểm tình huống", () => {
  const bang = new Map([...BANG, OTO].map((r) => [r.ma, r]));
  const loiKe = { loi_ke: "Anh A điều khiển xe mô tô trên đường nội thị, tổ công tác dừng xe kiểm tra." };

  test("hợp lệ", () => {
    expect(kiemTraTinhHuongBienBan(loiKe, { vi_pham: ["mu", "den"] }, bang)).toEqual([]);
  });

  test("trỏ tới mã mức phạt không tồn tại: báo rõ mã", () => {
    const loi = kiemTraTinhHuongBienBan(loiKe, { vi_pham: ["khong-co"] }, bang);
    expect(loi.join(" ")).toContain('Mức phạt "khong-co" không tồn tại');
  });

  test("2 hành vi khác loại xe: báo rõ", () => {
    const loi = kiemTraTinhHuongBienBan(loiKe, { vi_pham: ["mu", "oto-den"] }, bang);
    expect(loi.join(" ")).toContain("Hai hành vi khác loại xe");
  });

  test("thiếu lời kể, không có mã, quá 2 mã, trùng mã, trùng mục bổ sung, mức cụ thể ngoài khung", () => {
    expect(kiemTraTinhHuongBienBan({ loi_ke: "ngắn" }, { vi_pham: ["mu"] }, bang).join(" ")).toContain(
      "quá ngắn",
    );
    expect(kiemTraTinhHuongBienBan(loiKe, { vi_pham: [] }, bang).join(" ")).toContain("1 đến 2 mã");
    expect(kiemTraTinhHuongBienBan(loiKe, { vi_pham: ["mu", "den", "con"] }, bang).join(" ")).toContain(
      "1 đến 2 mã",
    );
    expect(kiemTraTinhHuongBienBan(loiKe, { vi_pham: ["mu", "mu"] }, bang).join(" ")).toContain("trùng mã");
    const den2 = mp("den2", { tru_diem: 4 });
    const b2 = new Map([...bang, ["den2", den2]]);
    expect(kiemTraTinhHuongBienBan(loiKe, { vi_pham: ["den", "den2"] }, b2).join(" ")).toContain(
      "cùng mục bổ sung",
    );
    expect(
      kiemTraTinhHuongBienBan(
        loiKe,
        { vi_pham: ["mu"], muc_cu_the: [{ ma: "mu", so_tien: 700_000, ly_do: "tái phạm" }] },
        bang,
      ).join(" "),
    ).toContain("ngoài khung");
  });

  test("nguồn trỏ tới mức phạt không còn (chưa duyệt, hết hiệu lực) bị loại khỏi lượt", () => {
    const n = nguon(["mu"]);
    n.muc_phat = [DEN, CON];
    expect(LBB.locNguon([n])).toEqual([]);
  });
});

describe("dựng bước và phần đề", () => {
  test("phần đề không chứa mã mức phạt, khung tiền hay đáp án", () => {
    const [b] = LBB.taoLuot(
      [nguon(["mu", "den"], "a"), nguon(["con"], "b"), nguon(["mu"], "c")],
      taoRng("x"),
    );
    const de = LBB.deChoNguoiChoi(b!);
    const s = JSON.stringify(de);
    // Mã mức phạt không xuất hiện dưới dạng giá trị ("con" cũng là tên khóa nút con của cây điều khoản).
    for (const ma of ["mu", "den", "con"]) expect(s).not.toMatch(new RegExp(`"${ma}"(?!:)`));
    for (const k of ["dap_an", "phat_tu", "phat_den", "tru_diem", "400000", "4000000"])
      expect(s).not.toContain(k);
    expect(de.so_dong).toBe(b!.noi_dung.dap_an.dong.length);
  });

  test("lượt 3 biên bản, tất định theo seed", () => {
    const ds = ["a", "b", "c", "d"].map((id) => nguon(["mu"], id));
    const l1 = LBB.taoLuot(ds, taoRng("s1"));
    expect(l1).toHaveLength(3);
    expect(LBB.taoLuot([...ds].reverse(), taoRng("s1"))).toEqual(l1);
  });

  test("hành vi chỉ gồm loại xe của tình huống; ô Điều có cả Điều của loại xe khác", () => {
    const b = buoc(["mu"]);
    expect(b.lua_chon_hanh_vi).toHaveLength(3);
    expect(b.dieu_khoan.map((d) => d.nhan)).toEqual(["Điều 6 · 168/2024/NĐ-CP", "Điều 7 · 168/2024/NĐ-CP"]);
    // Khoản, điểm chỉ lấy từ dòng cùng nhóm (Mũ bảo hiểm).
    const d7 = b.dieu_khoan.find((d) => d.id.endsWith("dieu-7"))!;
    expect(d7.con.map((k) => k.nhan)).toEqual(["Khoản 2"]);
    expect(d7.con[0]!.con.map((k) => k.id)).toEqual([`${ND}#dieu-7.khoan-2.diem-h`]);
  });

  test("căn cứ chỉ ghi tới Điều: cây chỉ có Điều, chấm theo Điều", () => {
    const n = nguon(["mu"]);
    n.muc_phat = BANG.map((r) => ({ ...r, can_cu: `${ND}#dieu-7` }));
    const b = dungBuocBienBan(n, 1, taoRng("y"))!.noi_dung;
    expect(b.dieu_khoan.every((d) => d.con.length === 0)).toBe(true);
    expect(cham(b, traLoiDung(b)).diem).toBe(100);
  });

  test("dựng cây sắp Điều, khoản theo số", () => {
    const cay = dungCayDieuKhoan(
      [{ can_cu: `${ND}#dieu-7.khoan-10` }, { can_cu: `${ND}#dieu-7.khoan-2` }],
      [{ can_cu: `${ND}#dieu-12` }, { can_cu: `${ND}#dieu-7` }],
    );
    expect(cay.map((d) => d.nhan.split(" ")[1])).toEqual(["7", "12"]);
    expect(cay[0]!.con.map((k) => k.nhan)).toEqual(["Khoản 2", "Khoản 10"]);
  });
});

describe("URN điều khoản", () => {
  test("tách và đọc theo chuẩn trích dẫn", () => {
    expect(tachDieuKhoan(`${ND}#dieu-7.khoan-2.diem-h`)).toMatchObject({ dieu: "7", khoan: "2", diem: "h" });
    expect(moTaDieuKhoan(`${ND}#dieu-7.khoan-2.diem-h`)).toBe(
      "Điểm h khoản 2 Điều 7 Nghị định số 168/2024/NĐ-CP",
    );
    expect(moTaDieuKhoan(`${ND}#dieu-6`)).toBe("Điều 6 Nghị định số 168/2024/NĐ-CP");
    expect(tachDieuKhoan("khong-phai-urn")).toBeNull();
    expect(tachDieuKhoan(`${ND}#diem-a`)).toBeNull();
  });
});

describe("tìm hành vi không dấu", () => {
  test("'khong doi mu' tìm ra hành vi mũ bảo hiểm", () => {
    const b = buoc(["mu"]);
    const kq = timHanhVi(b.lua_chon_hanh_vi, "khong doi mu");
    expect(kq.map((o) => o.text)).toEqual(["Không đội mũ bảo hiểm khi điều khiển xe"]);
    expect(timHanhVi(b.lua_chon_hanh_vi, "  ")).toHaveLength(3);
    expect(timHanhVi(b.lua_chon_hanh_vi, "đèn TÍN hiệu")).toHaveLength(1);
  });
});

const mucPhatTep = (
  (await Bun.file(join(GOC, "data/tra-cuu/muc-phat.json")).json()) as { dong: DongMucPhat[] }
).dong;
const tepDemo = (await Bun.file(join(GOC, "data/tro-choi/lap-bien-ban.json")).json()) as {
  luu_y_bien_tap: string[];
  tinh_huong: Array<{ ma: string; tieu_de: string; loi_ke: string; vi_pham: string[]; muc_do: string }>;
};

describe("dữ liệu demo", () => {
  const mucPhat = mucPhatTep;
  const tep = tepDemo;
  const bang = new Map(
    mucPhat.map((d) => [
      d.ma,
      {
        ma: d.ma,
        version: 1,
        xe: d.xe,
        nhom: d.nhom ?? null,
        hanh_vi: d.hanh_vi,
        tu_khoa: d.tu_khoa ?? [],
        phat_tu: d.phat_tu,
        phat_den: d.phat_den,
        tru_diem: d.tru_diem ?? null,
        hinh_thuc_bo_sung: d.hinh_thuc_bo_sung ?? [],
        can_cu: d.can_cu,
      } satisfies MucPhatBienBan,
    ]),
  );

  test("42 tình huống, ghi rõ là dữ liệu demo chưa duyệt, mã và tiêu đề không trùng", () => {
    expect(tep.tinh_huong).toHaveLength(42);
    expect(tep.luu_y_bien_tap[0]).toContain("DỮ LIỆU DEMO, CHƯA DUYỆT");
    expect(new Set(tep.tinh_huong.map((t) => t.ma)).size).toBe(42);
    // Seed bỏ qua tình huống trùng tiêu đề, nên tiêu đề trùng là mất tình huống.
    expect(new Set(tep.tinh_huong.map((t) => t.tieu_de)).size).toBe(42);
  });

  test("mọi tình huống hợp lệ với bảng mức phạt, phủ ít nhất 3 nhóm, có tình huống 2 hành vi", () => {
    for (const t of tep.tinh_huong) expect([t.ma, kiemTraTinhHuongBienBan(t, t, bang)]).toEqual([t.ma, []]);
    const nhom = new Set(tep.tinh_huong.flatMap((t) => t.vi_pham.map((m) => bang.get(m)!.nhom)));
    expect(nhom.size).toBeGreaterThanOrEqual(3);
    expect(tep.tinh_huong.some((t) => t.vi_pham.length === 2)).toBe(true);
  });

  test("mọi tình huống demo dựng được bước và đúng hoàn toàn thì được 100", () => {
    for (const t of tep.tinh_huong) {
      const xe = bang.get(t.vi_pham[0]!)!.xe;
      const n: NguonLapBienBan = {
        id: t.ma,
        code: t.ma,
        version: 1,
        topic_id: null,
        tinh_huong: { loi_ke: t.loi_ke },
        dap_an: { vi_pham: t.vi_pham },
        muc_phat: [...bang.values()].filter((r) => r.xe === xe),
        can_cu_khac: [...new Set([...bang.values()].filter((r) => r.xe !== xe).map((r) => r.can_cu))],
      };
      const b = dungBuocBienBan(n, 1, taoRng(t.ma))!.noi_dung;
      expect([t.ma, cham(b, traLoiDung(b)).diem]).toEqual([t.ma, 100]);
    }
  });
});
