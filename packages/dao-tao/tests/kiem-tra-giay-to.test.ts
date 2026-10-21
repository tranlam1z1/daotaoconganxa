/**
 * Trò "Kiểm tra giấy tờ" (docs/PLAN.md GĐ-T1): chấm điểm, đọc câu trả lời, sinh lượt theo màn, đề
 * không lộ đáp án, và chạy trên chính 30 hồ sơ mẫu + luật mẫu trong data/.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  type BuocGiayTo,
  type BuocLuot,
  DIEM_MOI_NGUOI,
  dinhNghiaTheoMan,
  dungDuocOMan,
  giayToCuaMan,
  type HoSoGiayTo,
  kiemTraHoSo,
  kiemTraHoSoTroChoi,
  type LuatGiayTo,
  loiCuaMan,
  MAN_KIEM_TRA_GIAY_TO,
  type MaLoiGiayTo,
  type NguonGiayTo,
  SO_NGUOI_MOI_LUOT,
  sinhHoSo,
  TRO_CHOI_KIEM_TRA_GIAY_TO as TC,
  taoRng,
} from "../src/index.ts";
import { LUAT_THU } from "./luat-giay-to-thu.ts";

const NGAY = "2026-09-15";

function nguon(
  id: string,
  muc: number,
  loi: MaLoiGiayTo[],
  seed = id,
  luat: LuatGiayTo[] = LUAT_THU,
): NguonGiayTo {
  const ho_so = sinhHoSo({ loi, ngayKiemTra: NGAY, luat: LUAT_THU, tinhVi: muc === 5 }, taoRng(seed));
  return { id, code: id, version: 1, topic_id: null, muc, ho_so, loi_du_kien: loi, luat, muc_phat: {} };
}

/** Bước dựng từ một nguồn ở một màn, qua chính taoLuot (một nguồn duy nhất không đủ lượt nên gọi thẳng). */
function buocTu(n: NguonGiayTo, man = 5): BuocLuot<BuocGiayTo> {
  const loi = kiemTraHoSo(n.ho_so, n.luat, loiCuaMan(man));
  const theoMa = new Map(n.luat.map((l) => [l.ma, l]));
  return {
    thu_tu: 1,
    ref_kind: "game_content",
    ref_id: n.id,
    ref_version: 1,
    topic_id: null,
    diem_toi_da: DIEM_MOI_NGUOI,
    noi_dung: {
      man,
      ho_so: n.ho_so,
      giay_to_hien: giayToCuaMan(man),
      loi,
      luat: loi.map((l) => theoMa.get(l.luat_ma)!),
      bien_ban: [],
    },
  };
}

const cham = (b: BuocLuot<BuocGiayTo>, raw: unknown) => {
  const tl = TC.docTraLoi(raw);
  if (!tl) throw new Error("câu trả lời sai dạng");
  return TC.chamBuoc(b, tl);
};

describe("chấm một người lái", () => {
  const hopLe = buocTu(nguon("h", 3, []));
  const motLoi = buocTu(nguon("m", 3, ["bao_hiem_ngoai_han"]));
  const haiLoi = buocTu(nguon("k", 4, ["gplx_sai_hang", "bao_hiem_ngoai_han"]));

  test("hợp lệ: cho qua 20 điểm, giữ lại 0 điểm", () => {
    expect(cham(hopLe, { quyet_dinh: "cho_qua" }).diem).toBe(20);
    const giu = cham(hopLe, { quyet_dinh: "giu_lai", dau_hieu: ["gplx.so"] });
    expect(giu.diem).toBe(0);
    expect(giu.dung).toBe(false);
  });

  test("có lỗi: cho qua 0 điểm; giữ lại và chỉ ra đủ lỗi 20 điểm", () => {
    expect(cham(motLoi, { quyet_dinh: "cho_qua" }).diem).toBe(0);
    const kq = cham(motLoi, { quyet_dinh: "giu_lai", dau_hieu: ["bao_hiem.thoi_han"] });
    expect(kq.diem).toBe(20);
    expect(kq.dung).toBe(true);
    expect(kq.canCu.length).toBeGreaterThan(0);
  });

  test("hai lỗi chỉ ra một: 15 điểm; đánh dấu nhầm trừ 2 mỗi chi tiết, phần chỉ ra không âm", () => {
    expect(cham(haiLoi, { quyet_dinh: "giu_lai", dau_hieu: ["gplx.hang"] }).diem).toBe(15);
    expect(cham(haiLoi, { quyet_dinh: "giu_lai", dau_hieu: ["gplx.hang", "gplx.so"] }).diem).toBe(13);
    const nhieuNham = cham(motLoi, {
      quyet_dinh: "giu_lai",
      dau_hieu: ["gplx.so", "gplx.ho_ten", "dang_ky.mau", "dang_ky.so", "bao_hiem.so", "bao_hiem.chu_xe"],
    });
    expect(nhieuNham.diem).toBe(10);
    const ct = nhieuNham.chiTiet as { dau_hieu_sai: unknown[]; loi: Array<{ da_chi_ra: boolean }> };
    expect(ct.dau_hieu_sai).toHaveLength(6);
    expect(ct.loi[0]!.da_chi_ra).toBe(false);
  });

  test("một chi tiết dùng chung chỉ ra được lỗi (biển số trên xe)", () => {
    const b = buocTu(nguon("bs", 2, ["dang_ky_sai_bien_so"]));
    expect(cham(b, { quyet_dinh: "giu_lai", dau_hieu: ["xe.bien_so"] }).diem).toBe(20);
  });

  test("đọc câu trả lời: giữ lại phải có chi tiết; chi tiết lạ bị từ chối; cho qua bỏ các dấu", () => {
    expect(TC.docTraLoi({ quyet_dinh: "giu_lai", dau_hieu: [] })).toBeNull();
    expect(TC.docTraLoi({ quyet_dinh: "giu_lai", dau_hieu: ["khong.co"] })).toBeNull();
    expect(TC.docTraLoi({ quyet_dinh: "cho_qua", dau_hieu: ["gplx.so"] })).toEqual({
      quyet_dinh: "cho_qua",
      dau_hieu: [],
    });
    expect(TC.docTraLoi({ quyet_dinh: "ok" })).toBeNull();
    expect(TC.docTraLoi({ quyet_dinh: "giu_lai", dau_hieu: ["gplx.so", "gplx.so"] })!.dau_hieu).toEqual([
      "gplx.so",
    ]);
  });
});

describe("sinh lượt theo màn", () => {
  const ds: NguonGiayTo[] = [];
  let i = 0;
  const them = (muc: number, loi: MaLoiGiayTo[], n: number) => {
    for (let k = 0; k < n; k++) ds.push(nguon(`n${String(i++).padStart(2, "0")}`, muc, loi));
  };
  them(1, [], 4);
  them(1, ["thieu_gplx"], 2);
  them(1, ["gplx_ngoai_han"], 2);
  them(2, [], 2);
  them(2, ["dang_ky_sai_bien_so"], 3);
  them(3, ["bao_hiem_ngoai_han"], 3);
  them(5, ["gplx_nguoi_khac"], 2);

  test("màn 1 chỉ dùng hồ sơ màn 1, đủ 8 người, có người hợp lệ và người có lỗi", () => {
    const l = TC.taoLuot(ds, taoRng("s"), 1);
    expect(l).toHaveLength(SO_NGUOI_MOI_LUOT);
    expect(l.every((b) => b.noi_dung.man === 1)).toBe(true);
    expect(l.filter((b) => b.noi_dung.loi.length === 0).length).toBeGreaterThanOrEqual(2);
    expect(l.filter((b) => b.noi_dung.loi.length > 0).length).toBeGreaterThanOrEqual(3);
    expect(new Set(l.map((b) => b.ref_id)).size).toBe(8);
    const muc1 = new Set(ds.filter((n) => n.muc === 1).map((n) => n.id));
    expect(l.every((b) => muc1.has(b.ref_id!))).toBe(true);
    expect(l.every((b) => b.noi_dung.giay_to_hien.join() === "gplx")).toBe(true);
  });

  test("màn cao ưu tiên hồ sơ của màn đó, không dùng hồ sơ của màn cao hơn", () => {
    const l = TC.taoLuot(ds, taoRng("s"), 3);
    const theoId = new Map(ds.map((n) => [n.id, n]));
    expect(l.every((b) => theoId.get(b.ref_id!)!.muc <= 3)).toBe(true);
    expect(l.filter((b) => theoId.get(b.ref_id!)!.muc === 3).length).toBe(3);
  });

  test("tất định: cùng seed, cùng màn, nguồn đảo thứ tự vẫn ra cùng lượt", () => {
    const a = TC.taoLuot(ds, taoRng("t"), 2).map((b) => b.ref_id);
    const b = TC.taoLuot([...ds].reverse(), taoRng("t"), 2).map((b) => b.ref_id);
    expect(a).toEqual(b);
  });

  test("hồ sơ mà luật đã duyệt cho kết quả khác dự kiến, hoặc thiếu luật, không vào lượt", () => {
    const sai = { ...nguon("sai", 1, []), loi_du_kien: ["thieu_gplx" as MaLoiGiayTo] };
    expect(dungDuocOMan(sai, 1)).toBe(false);
    const thieuLuat = nguon(
      "tl",
      1,
      [],
      "tl",
      LUAT_THU.filter((l) => l.ma !== "han-gplx"),
    );
    expect(dungDuocOMan(thieuLuat, 1)).toBe(false);
    expect(dungDuocOMan(nguon("ok", 1, []), 1)).toBe(true);
    expect(dungDuocOMan(nguon("cao", 3, []), 2)).toBe(false);
  });

  test("đề không có lỗi, luật, biên bản; chỉ có giấy tờ của màn", () => {
    const [b] = TC.taoLuot(ds, taoRng("d"), 2);
    const de = TC.deChoNguoiChoi(b!) as unknown as Record<string, unknown>;
    const chuoi = JSON.stringify(de);
    for (const k of ['"loi"', '"luat"', '"bien_ban"', '"loi_du_kien"', '"giai_thich"', '"can_cu"'])
      expect(chuoi).not.toContain(k);
    expect(Object.keys(de.giay_to as object).sort()).toEqual(["dang_ky", "gplx"]);
  });

  test("giờ và XP theo màn qua dinhNghiaTheoMan; trò không có màn giữ nguyên", () => {
    expect(dinhNghiaTheoMan(TC, 1).thoiGian).toBeNull();
    const m2 = dinhNghiaTheoMan(TC, 2);
    expect(m2.thoiGian).toEqual({ caLuotMs: MAN_KIEM_TRA_GIAY_TO[1]!.caLuotMs! });
    expect(m2.xpCoBan).toBe(MAN_KIEM_TRA_GIAY_TO[1]!.xpCoBan!);
    // Phương thức vẫn chạy đúng trên định nghĩa đã áp màn.
    expect(m2.taoLuot(ds, taoRng("s"), 2)).toHaveLength(8);
    expect(dinhNghiaTheoMan(TC, null)).toBe(TC);
  });
});

describe("dữ liệu mẫu trong data/", () => {
  const GOC = join(import.meta.dir, "..", "..", "..");

  test("30 hồ sơ mẫu hợp lệ; luật mẫu cho đúng lỗi dự kiến ở màn của hồ sơ và mọi màn cao hơn; mỗi màn đủ lượt", async () => {
    const tepLuat = (await Bun.file(join(GOC, "data", "tra-cuu", "luat-giay-to.json")).json()) as {
      dong: any[];
    };
    const luat: LuatGiayTo[] = tepLuat.dong.map((d) => ({ ...d, version: 1 }));
    const tep = (await Bun.file(join(GOC, "data", "tro-choi", "kiem-tra-giay-to.json")).json()) as {
      ho_so: Array<{ ma: string; muc: number; loi: MaLoiGiayTo[]; ho_so: HoSoGiayTo }>;
    };
    expect(tep.ho_so).toHaveLength(30);
    const ds: NguonGiayTo[] = tep.ho_so.map((h) => {
      expect(kiemTraHoSoTroChoi({ ...h.ho_so, muc: h.muc }, h.loi)).toEqual([]);
      return {
        id: h.ma,
        code: h.ma,
        version: 1,
        topic_id: null,
        muc: h.muc,
        ho_so: h.ho_so,
        loi_du_kien: h.loi,
        luat,
        muc_phat: {},
      };
    });
    for (const n of ds) for (let man = n.muc; man <= 5; man++) expect(dungDuocOMan(n, man)).toBe(true);
    for (let man = 1; man <= 5; man++) expect(TC.taoLuot(ds, taoRng(`m${man}`), man)).toHaveLength(8);
    expect(TC.locNguon(ds)).toHaveLength(30);
  });
});
