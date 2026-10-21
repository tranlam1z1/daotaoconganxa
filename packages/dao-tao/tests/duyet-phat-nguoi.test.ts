/**
 * Trò "Duyệt hồ sơ phạt nguội" (docs/PLAN.md GĐ-T11): luật kiểm hồ sơ (nhóm ho_so_phat_nguoi của M1),
 * chấm điểm, đọc câu trả lời, sinh lượt theo màn, đề không lộ đáp án. Chạy trên chính 30 hồ sơ mẫu và
 * luật mẫu trong data/.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  type BuocLuot,
  type BuocPhatNguoi,
  CHO_THIEU_PHAT_NGUOI,
  type ChiTietPhatNguoi,
  type ChoThieuPhatNguoi,
  choThieuCuaMan,
  dinhNghiaTheoMan,
  type HoSoPhatNguoi,
  hoSoDungDuocOMan,
  KY_TU_MO,
  kiemTraHoSoPhatNguoi,
  kiemTraHoSoPN,
  kiemTraLuatGiayTo,
  type LuatHoSoPhatNguoi,
  MAN_DUYET_PHAT_NGUOI,
  type NguonPhatNguoi,
  SO_HO_SO_THEO_MAN,
  TRO_CHOI_DUYET_PHAT_NGUOI as TC,
  taoRng,
} from "../src/index.ts";

const GOC = join(import.meta.dir, "..", "..", "..");
const LUAT: LuatHoSoPhatNguoi[] = (
  (await Bun.file(join(GOC, "data", "tra-cuu", "luat-ho-so-phat-nguoi.json")).json()) as { dong: any[] }
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
const MAU = (
  (await Bun.file(join(GOC, "data", "tro-choi", "phat-nguoi.json")).json()) as {
    ho_so: Array<{ ma: string; muc: number; cho_thieu: ChoThieuPhatNguoi[]; ho_so: HoSoPhatNguoi }>;
  }
).ho_so;

const nguonTu = (h: (typeof MAU)[number], luat = LUAT): NguonPhatNguoi => ({
  id: h.ma,
  code: h.ma,
  version: 1,
  topic_id: null,
  muc: h.muc,
  ho_so: h.ho_so,
  cho_thieu_du_kien: h.cho_thieu,
  luat,
  muc_phat: {},
});
const NGUON = MAU.map((h) => nguonTu(h));
const mau = (ma: string) => MAU.find((h) => h.ma === ma)!;

/** Bước của đúng một hồ sơ ở một màn, dựng qua chính taoLuot. */
function buoc(ma: string, man = 5, n = nguonTu(mau(ma))): BuocLuot<BuocPhatNguoi> {
  const [b] = TC.taoLuot([n], taoRng("x"), man);
  if (!b) throw new Error(`Hồ sơ ${ma} không vào được màn ${man}`);
  return b;
}
const cham = (b: BuocLuot<BuocPhatNguoi>, raw: unknown) => {
  const tl = TC.docTraLoi(raw);
  if (!tl) throw new Error("Câu trả lời không hợp lệ");
  return TC.chamBuoc(b, tl);
};

describe("luật kiểm hồ sơ (M1, nhóm ho_so_phat_nguoi)", () => {
  test("luật mẫu hợp lệ; luật sai cặp kiểu kiểm và phần bị báo lỗi", () => {
    for (const l of LUAT) expect(kiemTraLuatGiayTo(l)).toEqual([]);
    expect(kiemTraLuatGiayTo({ ...LUAT[0]!, phan: "anh" }).length).toBeGreaterThan(0);
    expect(kiemTraLuatGiayTo({ ...LUAT[0]!, kiem: "khop_xe" as never }).length).toBeGreaterThan(0);
    expect(kiemTraLuatGiayTo({ ...LUAT[2]!, tham_so: {} }).length).toBeGreaterThan(0);
    expect(kiemTraLuatGiayTo({ ...LUAT[0]!, nhom: "khac" as never })).toEqual(["Nhóm luật không hợp lệ."]);
  });

  test("30 hồ sơ mẫu hợp lệ; luật cho đúng chỗ thiếu dự kiến ở màn của hồ sơ và màn 5", () => {
    expect(MAU.length).toBe(30);
    for (const h of MAU) {
      expect(kiemTraHoSoPhatNguoi({ ...h.ho_so, muc: h.muc }, h.cho_thieu)).toEqual([]);
      for (let man = h.muc; man <= 5; man++) expect(hoSoDungDuocOMan(nguonTu(h), man)).toBe(true);
      if (h.muc > 1) expect(hoSoDungDuocOMan(nguonTu(h), h.muc - 1)).toBe(false);
    }
  });

  test("mỗi kiểu kiểm phát hiện đúng chỗ thiếu của nó, và mỗi chỗ thiếu có trong hồ sơ mẫu", () => {
    for (const c of CHO_THIEU_PHAT_NGUOI) {
      const cos = MAU.filter((h) => h.cho_thieu.includes(c));
      expect(cos.length).toBeGreaterThan(0);
      for (const h of cos) {
        // Bỏ luật của chỗ thiếu này thì bộ kiểm không còn thấy nó.
        const bo = LUAT.filter((l) => kiemTraHoSoPN(h.ho_so, [l]).every((x) => x.ma !== c));
        expect(kiemTraHoSoPN(h.ho_so, bo).map((x) => x.ma)).not.toContain(c);
        expect(kiemTraHoSoPN(h.ho_so, LUAT).map((x) => x.ma)).toContain(c);
      }
    }
  });

  test("luật chưa duyệt (vắng khỏi nguồn) thì hồ sơ cần luật đó không vào lượt", () => {
    const thieuLuat = LUAT.filter((l) => l.kiem !== "thay_hanh_vi");
    const n = nguonTu(mau("PN-01"), thieuLuat);
    expect(hoSoDungDuocOMan(n, 1)).toBe(false);
    expect(TC.taoLuot([n], taoRng("a"), 1)).toEqual([]);
    // Luật chỉ có ở màn 5 thiếu thì màn 1–4 vẫn chơi được.
    const n5 = nguonTu(
      mau("PN-01"),
      LUAT.filter((l) => l.kiem !== "trong_khung_gio"),
    );
    expect(hoSoDungDuocOMan(n5, 4)).toBe(true);
    expect(hoSoDungDuocOMan(n5, 5)).toBe(false);
  });

  test("ký tự dễ nhầm 8/B, 0/D và biển số mờ bị phát hiện", () => {
    for (const ma of ["PN-26", "PN-27"]) {
      const [c] = kiemTraHoSoPN(mau(ma).ho_so, LUAT);
      expect(c?.ma).toBe("bien_so_khong_doc_duoc");
      expect(c?.mo_ta).toContain(mau(ma).ho_so.bien_so);
    }
    const h = { ...mau("PN-26").ho_so, bien_so_he_thong: "29-B1 456.78" };
    expect(kiemTraHoSoPN(h, LUAT)).toEqual([]);
  });

  test("khung giờ cấm: đúng giờ bắt đầu là trong giờ, đúng giờ kết thúc là ngoài giờ", () => {
    const h = mau("PN-29").ho_so; // 16:00–19:00
    const luc = (gio: string) =>
      kiemTraHoSoPN({ ...h, thoi_diem: `2026-09-16T${gio}` }, LUAT).map((c) => c.ma);
    expect(luc("16:00:00")).toEqual([]);
    expect(luc("18:59:59")).toEqual([]);
    expect(luc("19:00:00")).toEqual(["ngoai_khung_gio"]);
    expect(luc("15:59:59")).toEqual(["ngoai_khung_gio"]);
    // Khung giờ chỉ xét ở màn 5.
    expect(kiemTraHoSoPN({ ...h, thoi_diem: "2026-09-16T20:00:00" }, LUAT, choThieuCuaMan(4))).toEqual([]);
  });

  test("hạn kiểm định: hết hạn đúng ngày ghi hình vẫn còn hạn, trước một ngày là hết hạn", () => {
    expect(kiemTraHoSoPN(mau("PN-29").ho_so, LUAT)).toEqual([]);
    expect(kiemTraHoSoPN(mau("PN-24").ho_so, LUAT).map((c) => c.ma)).toContain("thiet_bi_het_han_kiem_dinh");
  });

  test("ảnh không rõ thì không so hành vi (không báo thêm chỗ thiếu hành vi)", () => {
    const h = { ...mau("PN-17").ho_so, anh: { ...mau("PN-17").ho_so.anh, do_mo: 3 } };
    expect(kiemTraHoSoPN(h, LUAT).map((c) => c.ma)).toEqual(["anh_khong_ro_hanh_vi"]);
  });
});

describe("chấm điểm", () => {
  test("hồ sơ đủ căn cứ: gửi 10/10, trả lại 0/10; có thông báo vi phạm", () => {
    const b = buoc("PN-01", 1);
    expect(b.diem_toi_da).toBe(10);
    const gui = cham(b, { quyet_dinh: "gui" });
    expect([gui.diem, gui.dung]).toEqual([10, true]);
    expect((gui.chiTiet as ChiTietPhatNguoi).thong_bao).toHaveLength(1);
    expect((gui.chiTiet as ChiTietPhatNguoi).thong_bao[0]!.chi_tiet).toContain("30A-123.45");
    const tra = cham(b, { quyet_dinh: "tra_lai", cho: ["anh"] });
    expect([tra.diem, tra.dung]).toEqual([0, false]);
  });

  test("hồ sơ thiếu 1 chỗ: trả lại chỉ đúng 15/15; gửi 0/15", () => {
    const b = buoc("PN-05", 1);
    expect(b.diem_toi_da).toBe(15);
    expect(cham(b, { quyet_dinh: "tra_lai", cho: ["thoi_diem"] }).diem).toBe(15);
    expect(cham(b, { quyet_dinh: "gui" }).diem).toBe(0);
    expect((cham(b, { quyet_dinh: "gui" }).chiTiet as ChiTietPhatNguoi).thong_bao).toEqual([]);
  });

  test("hồ sơ thiếu 2 chỗ: chỉ đúng 1 chỗ 15/20, đủ 2 chỗ 20/20", () => {
    const b = buoc("PN-23", 4);
    expect(b.diem_toi_da).toBe(20);
    expect(cham(b, { quyet_dinh: "tra_lai", cho: ["bien_so"] }).diem).toBe(15);
    const du = cham(b, { quyet_dinh: "tra_lai", cho: ["bien_so", "thoi_diem"] });
    expect([du.diem, du.dung]).toEqual([20, true]);
  });

  test("chạm nhầm −2 chỉ trong phần chỉ chỗ thiếu, điểm bước không âm", () => {
    const b = buoc("PN-05", 1);
    expect(cham(b, { quyet_dinh: "tra_lai", cho: ["thoi_diem", "vi_tri"] }).diem).toBe(13);
    // Chỉ chạm nhầm: vẫn giữ 10 điểm quyết định, phần chỉ chỗ thiếu không âm.
    const nham = cham(b, { quyet_dinh: "tra_lai", cho: ["vi_tri", "anh", "bien_so", "thiet_bi", "hanh_vi"] });
    expect(nham.diem).toBe(10);
    expect((nham.chiTiet as ChiTietPhatNguoi).cho_nham).toHaveLength(5);
    // Hồ sơ đủ căn cứ bị trả lại kèm nhiều chỗ nhầm: 0, không âm.
    expect(cham(buoc("PN-01", 1), { quyet_dinh: "tra_lai", cho: ["vi_tri", "anh", "hanh_vi"] }).diem).toBe(0);
  });

  test("gửi nhầm mất nhiều điểm hơn trả nhầm (câu D15)", () => {
    const guiNham = buoc("PN-05", 1);
    const traNham = buoc("PN-01", 1);
    const matGui = guiNham.diem_toi_da - cham(guiNham, { quyet_dinh: "gui" }).diem;
    const matTra = traNham.diem_toi_da - cham(traNham, { quyet_dinh: "tra_lai", cho: ["anh"] }).diem;
    expect(matGui).toBeGreaterThan(matTra);
    const b2 = buoc("PN-24", 4);
    expect(b2.diem_toi_da - cham(b2, { quyet_dinh: "gui" }).diem).toBe(20);
  });

  test("ngoài khung giờ: chạm thời điểm hoặc hành vi đều là chỉ đúng", () => {
    const b = buoc("PN-28", 5);
    expect(cham(b, { quyet_dinh: "tra_lai", cho: ["thoi_diem"] }).diem).toBe(15);
    expect(cham(b, { quyet_dinh: "tra_lai", cho: ["hanh_vi"] }).diem).toBe(15);
    expect(cham(b, { quyet_dinh: "tra_lai", cho: ["thoi_diem", "hanh_vi"] }).diem).toBe(15);
  });
});

describe("đọc câu trả lời", () => {
  test("trả lại mà không chỉ chỗ thiếu, chỗ lạ, quyết định lạ: không nhận", () => {
    expect(TC.docTraLoi({ quyet_dinh: "tra_lai", cho: [] })).toBeNull();
    expect(TC.docTraLoi({ quyet_dinh: "tra_lai" })).toBeNull();
    expect(TC.docTraLoi({ quyet_dinh: "tra_lai", cho: ["khac"] })).toBeNull();
    expect(TC.docTraLoi({ quyet_dinh: "giu_lai", cho: ["anh"] })).toBeNull();
    expect(TC.docTraLoi(null)).toBeNull();
  });

  test("gửi bỏ các chỗ đã chạm; điểm, cờ đúng máy khách gửi kèm bị bỏ qua", () => {
    expect(TC.docTraLoi({ quyet_dinh: "gui", cho: ["anh"] })).toEqual({ quyet_dinh: "gui", cho: [] });
    const b = buoc("PN-05", 1);
    const gian = cham(b, { quyet_dinh: "gui", dung: true, diem: 15, ket_qua: { dung: true } });
    expect([gian.diem, gian.dung]).toEqual([0, false]);
  });
});

describe("lượt và đề", () => {
  test("số hồ sơ theo màn, giờ theo màn, tất định theo seed", () => {
    for (const man of [1, 2, 3, 4, 5]) {
      const l = TC.taoLuot(NGUON, taoRng(`s${man}`), man);
      expect(l).toHaveLength(SO_HO_SO_THEO_MAN[man]!);
      expect(new Set(l.map((b) => b.ref_id)).size).toBe(l.length);
      const du = l.filter((b) => b.noi_dung.cho_thieu.length === 0).length;
      expect(du).toBeGreaterThanOrEqual(Math.ceil(l.length * 0.3));
      expect(l.length - du).toBeGreaterThanOrEqual(Math.ceil(l.length * 0.4));
      expect(l.every((b) => mau(b.ref_id!).muc <= man)).toBe(true);
    }
    expect(TC.taoLuot(NGUON, taoRng("q"), 3)).toEqual(TC.taoLuot(NGUON, taoRng("q"), 3));
    expect(dinhNghiaTheoMan(TC, 1).thoiGian).toBeNull();
    expect(dinhNghiaTheoMan(TC, 5).thoiGian).toEqual({ caLuotMs: 270_000 });
    expect(MAN_DUYET_PHAT_NGUOI).toHaveLength(5);
  });

  test("đề không có khóa cấm, không có độ rõ biển số, chỗ thiếu, luật; biển số đã làm nhiễu", () => {
    const CAM =
      /"(answer|dap_an|giai_thich|can_cu|explanation|loi|luat|loi_du_kien|cho_thieu|cho_thieu_du_kien|ky_tu_mo|muc|thong_bao|bien_ban|ma_muc_phat|noi_dung)"/;
    for (const b of TC.taoLuot(NGUON, taoRng("de"), 5)) {
      const de = TC.deChoNguoiChoi(b);
      expect(JSON.stringify(de)).not.toMatch(CAM);
      expect(de.bien_so_anh.length).toBe(b.noi_dung.ho_so.bien_so.length);
    }
    const de12 = TC.deChoNguoiChoi(buoc("PN-12", 2));
    expect(de12.bien_so_anh).toBe(`30G-5${KY_TU_MO}${KY_TU_MO}.27`);
    expect(TC.deChoNguoiChoi(buoc("PN-26", 5)).bien_so_anh).toBe("29-B1 456.78");
  });

  test("cùng hồ sơ cùng đáp án ở máy khách (gói offline) và máy chủ", () => {
    const l = TC.taoLuot(NGUON, taoRng("off"), 5);
    // Gói offline mang ảnh chụp lượt qua JSON; điện thoại chấm lại bằng cùng mã.
    const goi = JSON.parse(JSON.stringify(l)) as typeof l;
    for (const [i, b] of l.entries()) {
      for (const tl of [
        { quyet_dinh: "gui" },
        { quyet_dinh: "tra_lai", cho: ["thoi_diem", "bien_so"] },
        { quyet_dinh: "tra_lai", cho: ["anh", "vi_tri"] },
      ]) {
        expect(cham(goi[i]!, tl)).toEqual(cham(b, tl));
      }
      expect(TC.deChoNguoiChoi(goi[i]!)).toEqual(TC.deChoNguoiChoi(b));
    }
  });
});
