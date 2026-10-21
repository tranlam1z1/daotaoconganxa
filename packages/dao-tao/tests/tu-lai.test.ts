/**
 * Trò "Tự lái qua phố" (docs/PLAN.md GĐ-T9): kiểm bản đồ, phát hiện lỗi lái, chấm, biên bản, nhật ký,
 * tính tất định.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { taoRng } from "../src/de-thi.ts";
import { CHUA_CO_MUC_PHAT, type MucPhatDaDuyet, moTaMucPhatBienBan } from "../src/tro-choi/chung/bien-ban.ts";
import type { BuocLuot } from "../src/tro-choi/khung.ts";
import {
  type BuocTuLai,
  bamTuLai,
  type ChiTietTuLai,
  chayLaiTuLai,
  diemTuLai,
  kiemTraAnhXaLoi,
  maMucPhatCuaAnhXa,
  maMucPhatCuaLoi,
  type NguonTuLai,
  type PayloadAnhXaLoi,
  TRO_CHOI_TU_LAI,
  type TraLoiTuLai,
} from "../src/tro-choi/tu-lai.ts";
import {
  apThaoTacLai,
  buocPho,
  dungTheGioi,
  kiemTraBanDo,
  type LoaiLoiLai,
  mauDenPho,
  type PayloadBanDo,
  trangThaiDauPho,
} from "../src/tro-choi/tu-lai-pho.ts";

const GOC = join(import.meta.dir, "..", "..", "..");
const DU_LIEU = JSON.parse(readFileSync(join(GOC, "data", "tro-choi", "tu-lai.json"), "utf8")) as {
  ban_do: Array<{ ma: string; payload: PayloadBanDo }>;
  anh_xa_loi: { payload: PayloadAnhXaLoi };
};
const ANH_XA = DU_LIEU.anh_xa_loi.payload;

/** Bản đồ thử: một phố ngang (hàng 2) cắt một phố dọc (cột 4). */
function banDo(p: Partial<PayloadBanDo> = {}): PayloadBanDo {
  return {
    kieu: "ban_do",
    man: 1,
    o: ["....|.......", "....|.......", "----+-------", "....|.......", "....|.......", "....|......."],
    xuat_phat: { o: [2, 0], huong: "dong" },
    dich: { o: [2, 11] },
    gio_giay: null,
    den: [],
    bien: [],
    vach_di_bo: [],
    nguoi_di_bo: [],
    xe_khac: [],
    ...p,
  };
}

type Op = [number, string, unknown];
const nhatKy = (ops: Op[], tong: number, xe: "o_to" | "xe_may" = "o_to"): TraLoiTuLai => ({
  thao_tac: [
    { nhip: 0, thao_tac: "bat_dau", tham_so: { xe, giam: false } },
    ...ops.map(([nhip, t, p]) => ({ nhip, thao_tac: t as any, tham_so: p as any })),
  ],
  tong_nhip: tong,
});

const lai = (bd: PayloadBanDo, ops: Op[], tong = 1200, xe: "o_to" | "xe_may" = "o_to") =>
  chayLaiTuLai(bd, nhatKy(ops, tong, xe)).tt;
const loaiLoi = (bd: PayloadBanDo, ops: Op[], tong?: number) => lai(bd, ops, tong).loi.map((l) => l.loai);

describe("Tự lái: kiểm bản đồ", () => {
  test("3 khu phố mẫu và bảng lỗi mẫu hợp lệ; mỗi màn 1–3 có ít nhất một khu phố", () => {
    for (const b of DU_LIEU.ban_do)
      expect({ ma: b.ma, loi: kiemTraBanDo(b.payload) }).toEqual({ ma: b.ma, loi: [] });
    expect(DU_LIEU.ban_do.map((b) => b.payload.man).sort()).toEqual([1, 2, 3]);
    expect(kiemTraAnhXaLoi(ANH_XA)).toEqual([]);
  });

  test("lỗi chỉ đúng phần tử: ký tự lạ, lối vào cấm thiếu biển, biển chưa duyệt, tuyến xe đi ngược chiều", () => {
    const loi = kiemTraBanDo(
      banDo({
        o: ["....|.......", "....|.......", "----+-<<<<<<", "....|.......", "....|.......", "....|..X...."],
      }),
    );
    expect(loi.some((l) => l.phan_tu === "o:5,7")).toBe(true);
    const thieuBien = kiemTraBanDo(
      banDo({
        o: ["....|.......", "....|.......", "----+<<<<<<<", "....|.......", "....|.......", "....|......."],
        dich: { o: [5, 4] },
      }),
    );
    expect(thieuBien.map((l) => l.phan_tu)).toContain("o:2,5");
    const coBien = banDo({
      o: ["....|.......", "....|.......", "----+<<<<<<<", "....|.......", "....|.......", "....|......."],
      dich: { o: [5, 4] },
      bien: [{ ma: "P.102", o: [2, 5], huong: "dong" }],
      xe_khac: [
        {
          id: "x",
          loai: "o_to",
          tuyen: [
            [2, 0],
            [2, 11],
          ],
          bat_dau: 0,
          cach: 5,
          so_xe: 1,
          toc_do: 30,
        },
      ],
    });
    const l2 = kiemTraBanDo(coBien, new Set(["P.127"]));
    expect(l2.map((l) => l.phan_tu)).toEqual(expect.arrayContaining(["bien:0", "xe:x"]));
    expect(l2.some((l) => l.phan_tu === "o:2,5")).toBe(false);
  });

  test("đích không tới được bằng đường đúng luật thì báo lỗi", () => {
    const loi = kiemTraBanDo(
      banDo({
        o: ["....|.......", "....|.......", "----+>>>>>>>", "....|.......", "....|.......", "....|......."],
        xuat_phat: { o: [2, 11], huong: "tay" },
        dich: { o: [2, 0] },
      }),
    );
    expect(loi.length).toBeGreaterThan(0);
  });
});

describe("Tự lái: đèn tín hiệu", () => {
  test("hai trục thay nhau xanh, có đỏ chung khi chuyển pha", () => {
    const d = { o: [2, 4] as const, xanh: 3, vang: 1, do_chung: 1, truc_dau: "ngang" as const };
    const m = (n: number) => [mauDenPho(d, n, "ngang"), mauDenPho(d, n, "doc")];
    expect(m(0)).toEqual(["xanh", "do"]);
    expect(m(60)).toEqual(["vang", "do"]);
    expect(m(80)).toEqual(["do", "do"]);
    expect(m(100)).toEqual(["do", "xanh"]);
    expect(m(180)).toEqual(["do", "do"]);
    expect(m(200)).toEqual(["xanh", "do"]);
  });

  // Giữ ga từ đầu: đầu xe qua vạch dừng (mép ô nơi giao nhau, cột 4) quanh nhịp 108.
  const qua = (vang: number) =>
    banDo({ den: [{ o: [2, 4], xanh: 3, vang, do_chung: 0, truc_dau: "ngang" }] });

  test("qua vạch dừng khi đèn đỏ: bắt lỗi vượt đèn đỏ", () => {
    expect(loaiLoi(qua(1), [[0, "ga", true]], 400)).toContain("vuot_den_do");
  });

  test("qua vạch khi đèn vàng: không bắt", () => {
    expect(loaiLoi(qua(5), [[0, "ga", true]], 400)).not.toContain("vuot_den_do");
  });

  test("dừng trước vạch khi đỏ, chờ xanh rồi đi: không lỗi", () => {
    // Pha ngang: xanh 0–59, vàng 60–79, đỏ 80–139, xanh lại từ 140.
    const bd = qua(1);
    const tt = lai(
      bd,
      [
        [0, "ga", true],
        [60, "ga", false],
        [60, "phanh", true],
        [140, "phanh", false],
        [140, "ga", true],
      ],
      500,
    );
    expect(tt.loi.map((l) => l.loai)).toEqual([]);
    expect(tt.ket_thuc).toBe("den_dich");
  });
});

describe("Tự lái: quá tốc độ", () => {
  const bd = banDo({ bien: [{ ma: "P.127", o: [2, 1], huong: "dong", toc_do: 30 }] });

  test("vượt từ 5 km/h liên tục quá 1 giây mới bắt; ghi tốc độ cao nhất", () => {
    // Giữ ga: tốc độ qua 35 km/h (≥ 487 mm/nhịp) ở nhịp 82.
    const ngan = lai(
      bd,
      [
        [0, "ga", true],
        [96, "ga", false],
        [96, "phanh", true],
        [101, "phanh", false],
      ],
      300,
    );
    expect(ngan.loi.filter((l) => l.loai === "qua_toc_do")).toEqual([]);
    const dai = lai(
      bd,
      [
        [0, "ga", true],
        [120, "ga", false],
        [120, "phanh", true],
        [135, "phanh", false],
      ],
      300,
    );
    const l = dai.loi.filter((x) => x.loai === "qua_toc_do");
    expect(l).toHaveLength(1);
    expect(l[0]!.gioi_han).toBe(30);
    expect(l[0]!.nhip).toBe(82);
    // Vùng biển hết ở nơi giao nhau (cột 4): tốc độ cao nhất trong vùng.
    expect(l[0]!.toc_do).toBe(46);
  });

  test("đoạn không có biển tốc độ thì không bắt", () => {
    expect(loaiLoi(banDo(), [[0, "ga", true]], 300)).not.toContain("qua_toc_do");
  });

  test("biển hết hiệu lực ở nơi giao nhau kế tiếp", () => {
    const the = dungTheGioi(bd, "o_to", false);
    expect(the.toc_do.get("2,3,2")?.kmh).toBe(30);
    expect(the.toc_do.has("2,5,2")).toBe(false);
  });
});

describe("Tự lái: rẽ, xi nhan, biển cấm", () => {
  const bd = banDo({ dich: { o: [5, 4] } });
  // Đầu xe vào ô cột 1 (vùng chuẩn bị rẽ) quanh nhịp 38.

  test("rẽ phải có xi nhan: tới đích, không lỗi", () => {
    const tt = lai(
      bd,
      [
        [0, "ga", true],
        [50, "xi_nhan", "phai"],
        [50, "lai", "phai"],
        [80, "ga", false],
      ],
      600,
    );
    expect(tt.loi).toEqual([]);
    expect(tt.ket_thuc).toBe("den_dich");
    // Xong rẽ thì xi nhan tự tắt.
    expect(tt.nguoi.xi_nhan).toBeNull();
  });

  test("rẽ không xi nhan, hoặc xi nhan sai bên: bắt lỗi", () => {
    expect(
      loaiLoi(
        bd,
        [
          [0, "ga", true],
          [50, "lai", "phai"],
          [80, "ga", false],
        ],
        600,
      ),
    ).toEqual(["re_khong_xi_nhan"]);
    const sai = lai(
      bd,
      [
        [0, "ga", true],
        [50, "xi_nhan", "trai"],
        [50, "lai", "phai"],
        [80, "ga", false],
      ],
      600,
    );
    expect(sai.loi.map((l) => l.loai)).toEqual(["re_khong_xi_nhan"]);
    expect(sai.loi[0]!.chi_tiet).toContain("bên trái");
  });

  test("chạm nút rẽ lần hai là bỏ ý định rẽ", () => {
    const tt = lai(
      bd,
      [
        [0, "ga", true],
        [50, "lai", "phai"],
        [52, "lai", "phai"],
      ],
      400,
    );
    expect(tt.ket_thuc).not.toBe("den_dich");
    expect(tt.nguoi.xe.x).toBeGreaterThan(50_000);
  });

  test("rẽ nơi có biển cấm rẽ: bắt lỗi cấm rẽ", () => {
    const cam = banDo({ dich: { o: [0, 4] }, bien: [{ ma: "P.123a", o: [2, 4], huong: "dong" }] });
    const l = loaiLoi(
      cam,
      [
        [0, "ga", true],
        [50, "xi_nhan", "trai"],
        [50, "lai", "trai"],
        [80, "ga", false],
      ],
      600,
    );
    expect(l).toEqual(["re_cam"]);
  });

  test("đi vào đường một chiều theo chiều ngược: bắt lỗi đi vào đường cấm một lần", () => {
    const mot = banDo({
      o: ["....|.......", "....|.......", "----+<<<<<<<", "....|.......", "....|.......", "....|......."],
      dich: { o: [5, 4] },
      bien: [{ ma: "P.102", o: [2, 5], huong: "dong" }],
    });
    const tt = lai(mot, [[0, "ga", true]], 600);
    expect(tt.loi.map((l) => l.loai)).toEqual(["vao_duong_cam"]);
    expect(tt.loi[0]!.bien).toBe("P.102");
  });

  test("ngã ba chưa chọn hướng thì xe dừng trước nơi giao nhau, chọn hướng rồi đi tiếp", () => {
    const ba = banDo({
      o: ["....|.......", "....|.......", "----+.......", "....|.......", "....|.......", "....|......."],
      dich: { o: [5, 4] },
    });
    const dung = lai(ba, [[0, "ga", true]], 500);
    expect(dung.nguoi.xe.v).toBe(0);
    expect(dung.nguoi.o).toEqual([2, 3]);
    const di = lai(
      ba,
      [
        [0, "ga", true],
        [300, "xi_nhan", "phai"],
        [300, "lai", "phai"],
      ],
      800,
    );
    expect(di.ket_thuc).toBe("den_dich");
    expect(di.loi).toEqual([]);
  });
});

describe("Tự lái: phần đường, người đi bộ, va chạm", () => {
  const pho = banDo({
    o: ["..............", "--------------", "..............", ".............."],
    xuat_phat: { o: [1, 0], huong: "dong" },
    dich: { o: [1, 13] },
  });

  test("chuyển sang làn chiều ngược lại: bắt đi sai phần đường (một lần), và chuyển làn không xi nhan", () => {
    const tt = lai(
      pho,
      [
        [0, "ga", true],
        [30, "lai", "trai"],
        [40, "lai", "phai"],
        [45, "lai", "trai"],
      ],
      90,
    );
    const l = tt.loi.map((x) => x.loai);
    expect(l.filter((x) => x === "sai_lan")).toHaveLength(1);
    expect(l).toContain("re_khong_xi_nhan");
  });

  test("quay đầu khi đứng yên, có xi nhan trái: không lỗi, xe đi chiều ngược lại", () => {
    const tt = lai(
      pho,
      [
        [0, "xi_nhan", "trai"],
        [0, "lai", "trai"],
        [1, "ga", true],
      ],
      80,
    );
    expect(tt.loi).toEqual([]);
    expect(tt.nguoi.h_duong).toBe(6);
  });

  const vach = (luc: number) =>
    banDo({
      ...pho,
      vach_di_bo: [{ o: [1, 3] }],
      nguoi_di_bo: [{ id: "n", o: [1, 3], di: "bac", luc }],
    });

  test("đi qua vạch khi người đi bộ đang sang: bắt không nhường người đi bộ", () => {
    expect(loaiLoi(vach(0), [[0, "ga", true]], 200)).toContain("khong_nhuong_nguoi_di_bo");
  });

  test("người đi bộ sang sau khi xe đã qua: không lỗi", () => {
    expect(loaiLoi(vach(8), [[0, "ga", true]], 200)).toEqual([]);
  });

  test("dừng chờ người đi bộ sang hết rồi đi: không lỗi", () => {
    const tt = lai(
      vach(0),
      [
        [0, "ga", true],
        [60, "ga", false],
        [60, "phanh", true],
        [150, "phanh", false],
        [150, "ga", true],
      ],
      400,
    );
    expect(tt.loi).toEqual([]);
  });

  test("lấn làn đâm vào xe chiều ngược lại: bắt va chạm một lần, xe người chơi dừng lại", () => {
    const bd = banDo({
      ...pho,
      xe_khac: [
        {
          id: "x",
          loai: "o_to",
          tuyen: [
            [1, 13],
            [1, 0],
          ],
          bat_dau: 0,
          cach: 60,
          so_xe: 1,
          toc_do: 30,
        },
      ],
    });
    const tt = lai(
      bd,
      [
        [0, "xi_nhan", "trai"],
        [0, "ga", true],
        [20, "lai", "trai"],
      ],
      400,
    );
    const l = tt.loi.map((x) => x.loai);
    expect(l.filter((x) => x === "va_cham")).toHaveLength(1);
    expect(l).toContain("sai_lan");
  });

  test("nơi giao nhau không đèn: vào khi xe khác đang trong đó thì bắt không nhường đường", () => {
    const bd = banDo({
      dich: { o: [2, 11] },
      xe_khac: [
        {
          id: "x",
          loai: "o_to",
          tuyen: [
            [0, 4],
            [5, 4],
          ],
          bat_dau: 0,
          cach: 3,
          so_xe: 20,
          toc_do: 30,
        },
      ],
    });
    // Xe người chơi dừng chờ trước nơi giao nhau rồi lao vào ở các thời điểm khác nhau.
    let coLoi = false;
    // Ga tới nhịp 90 rồi phanh: xe dừng cách mép nơi giao nhau chừng 3 m.
    for (let di = 130; di < 330 && !coLoi; di += 2) {
      const l = loaiLoi(
        bd,
        [
          [0, "ga", true],
          [90, "ga", false],
          [90, "phanh", true],
          [di, "phanh", false],
          [di, "ga", true],
        ],
        di + 80,
      );
      coLoi = l.includes("khong_nhuong_duong");
    }
    expect(coLoi).toBe(true);
  });
});

describe("Tự lái: xe khác", () => {
  test("khu phố mẫu chạy 5 phút không có xe tự chạy nào va chạm nhau; xe dừng đèn đỏ", () => {
    for (const b of DU_LIEU.ban_do) {
      const the = dungTheGioi(b.payload, "o_to", true);
      let tt = trangThaiDauPho(the);
      let vuotDo = 0;
      while (!tt.ket_thuc) {
        const truoc = tt;
        tt = buocPho(the, tt);
        // Xe tự chạy không đi vào nơi giao nhau khi đèn của nó đỏ (trừ xe đã được đi tiếp khi đèn chuyển).
        for (const x of tt.mp.xe) {
          const c = the.lan_xe.get(x.lan)!;
          for (const g of c.giao) {
            const den = the.den.get(g.khoa);
            const cu = truoc.mp.xe.find((v) => v.id === x.id);
            if (!den || !cu || cu.s > g.s_vao * 10 || x.s <= g.s_vao * 10) continue;
            if (mauDenPho(den, tt.nhip, g.truc) === "do" && !tt.duoc_qua.includes(`${x.id}@${g.khoa}`))
              vuotDo++;
          }
        }
      }
      expect({ ma: b.ma, hong: Object.keys(tt.xe_hong), vuotDo }).toEqual({ ma: b.ma, hong: [], vuotDo: 0 });
    }
  });
});

describe("Tự lái: chấm và biên bản", () => {
  test("điểm: 100 trừ theo nhóm, tới đích +10 không vượt 100, không tới đích tối đa 50, không dưới 0", () => {
    const l = (...ds: LoaiLoiLai[]) => ds.map((loai) => ({ loai }));
    expect(diemTuLai([], true).diem).toBe(100);
    expect(diemTuLai(l("re_khong_xi_nhan"), true).diem).toBe(100);
    expect(diemTuLai(l("vuot_den_do"), true).diem).toBe(90);
    expect(diemTuLai(l("sai_lan"), false).diem).toBe(50);
    expect(diemTuLai(l("va_cham", "va_cham", "va_cham", "va_cham"), true).diem).toBe(0);
    expect(diemTuLai(l("va_cham", "vuot_den_do", "qua_toc_do"), false).diem).toBe(40);
  });

  test("mã mức phạt theo loại xe và bậc quá tốc độ", () => {
    const qua = (toc_do: number) => ({
      loai: "qua_toc_do" as const,
      nhip: 0,
      x: 0,
      y: 0,
      chi_tiet: "",
      toc_do,
      gioi_han: 30,
    });
    expect(maMucPhatCuaLoi(ANH_XA, qua(36), "o_to")).toBe("oto-toc-do-5-10");
    expect(maMucPhatCuaLoi(ANH_XA, qua(50), "o_to")).toBe("oto-toc-do-10-20");
    expect(maMucPhatCuaLoi(ANH_XA, qua(51), "xe_may")).toBe("mt-toc-do-tren-20");
    expect(maMucPhatCuaLoi(ANH_XA, { ...qua(0), loai: "vuot_den_do" }, "xe_may")).toBe("mt-den-do");
    expect(maMucPhatCuaLoi(ANH_XA, { ...qua(0), loai: "sai_lan" }, "o_to")).toBeNull();
    expect(maMucPhatCuaAnhXa(ANH_XA)).toContain("oto-den-do");
  });

  const muc: MucPhatDaDuyet = {
    ma: "oto-den-do",
    version: 1,
    hanh_vi: "Không chấp hành hiệu lệnh của đèn tín hiệu giao thông",
    phat_tu: 18_000_000,
    phat_den: 20_000_000,
    tru_diem: 4,
    hinh_thuc_bo_sung: [],
    can_cu: "vn:vbqppl:nd:thu#dieu-6",
  };
  const buoc = (bd: PayloadBanDo, mp: Record<string, MucPhatDaDuyet>): BuocLuot<BuocTuLai> => ({
    thu_tu: 1,
    ref_kind: "game_content",
    ref_id: "x",
    ref_version: 1,
    topic_id: null,
    diem_toi_da: 100,
    noi_dung: { man: 1, ban_do: bd, bien: [], anh_xa: ANH_XA, muc_phat: mp },
  });
  const docVaCham = (bd: PayloadBanDo, mp: Record<string, MucPhatDaDuyet>, ops: Op[], tong: number) =>
    TRO_CHOI_TU_LAI.chamBuoc(buoc(bd, mp), TRO_CHOI_TU_LAI.docTraLoi(nhatKy(ops, tong))!, {
      thoiGianMs: null,
      offline: false,
    });
  const doDen = banDo({ den: [{ o: [2, 4], xanh: 3, vang: 1, do_chung: 0, truc_dau: "ngang" }] });

  test("biên bản dùng mức phạt đã duyệt; mã chưa duyệt thì ghi Chưa có mức phạt đã duyệt", () => {
    const co = docVaCham(doDen, { "oto-den-do": muc }, [[0, "ga", true]], 400);
    const ct = co.chiTiet as ChiTietTuLai;
    expect(ct.den_dich).toBe(true);
    expect(co.diem).toBe(90);
    expect(ct.loi).toHaveLength(1);
    expect(ct.loi[0]!.bien_ban.muc_phat?.ma).toBe("oto-den-do");
    expect(ct.loi[0]!.bien_ban.can_cu).toEqual([muc.can_cu]);
    expect(ct.loi[0]!.bien_ban.chi_tiet).toMatch(/^Lúc 0:0\d: /);
    expect(co.canCu).toEqual([muc.can_cu]);
    const chua = docVaCham(doDen, {}, [[0, "ga", true]], 400).chiTiet as ChiTietTuLai;
    expect(moTaMucPhatBienBan(chua.loi[0]!.bien_ban.muc_phat)).toBe(CHUA_CO_MUC_PHAT);
  });

  test("điểm máy khách gửi bị bỏ qua; nhịp không tăng dần hay thiếu chọn xe: 0 điểm", () => {
    const tl = TRO_CHOI_TU_LAI.docTraLoi({ ...nhatKy([[0, "ga", true]], 400), diem: 100, loi: [] })!;
    expect(TRO_CHOI_TU_LAI.chamBuoc(buoc(doDen, {}), tl).diem).toBe(90);
    const lui = docVaCham(
      doDen,
      {},
      [
        [50, "ga", true],
        [20, "ga", false],
      ],
      400,
    );
    expect(lui.diem).toBe(0);
    expect((lui.chiTiet as ChiTietTuLai).hop_le).toBe(false);
    const thieu = TRO_CHOI_TU_LAI.docTraLoi({
      thao_tac: [{ nhip: 0, thao_tac: "ga", tham_so: true }],
      tong_nhip: 10,
    })!;
    expect(TRO_CHOI_TU_LAI.chamBuoc(buoc(doDen, {}), thieu).diem).toBe(0);
    // Thao tác sai dạng: từ chối đọc (API báo 400).
    expect(TRO_CHOI_TU_LAI.docTraLoi(nhatKy([[1, "lai", "len"]], 10))).toBeNull();
    expect(TRO_CHOI_TU_LAI.docTraLoi(nhatKy([], 999_999))).toBeNull();
  });

  test("nhật ký dài hơn đồng hồ máy chủ quá 10%: 0 điểm", () => {
    const tl = TRO_CHOI_TU_LAI.docTraLoi(nhatKy([[0, "ga", true]], 400))!;
    const kq = TRO_CHOI_TU_LAI.chamBuoc(buoc(doDen, {}), tl, { thoiGianMs: 5_000, offline: false });
    expect(kq.diem).toBe(0);
    expect((kq.chiTiet as ChiTietTuLai).ly_do).toBe("Nhật ký không khớp đồng hồ máy chủ.");
  });

  test("không tới đích: tối đa 50", () => {
    const kq = docVaCham(
      banDo(),
      {},
      [
        [0, "ga", true],
        [30, "ga", false],
      ],
      200,
    );
    expect((kq.chiTiet as ChiTietTuLai).ket_thuc).toBe("dung");
    expect(kq.diem).toBe(50);
  });

  test("đề không có bảng lỗi, lời giải thích, căn cứ; taoLuot chọn bản đồ đúng màn", () => {
    const nguon: NguonTuLai[] = DU_LIEU.ban_do.map((b, i) => ({
      id: `id-${i}`,
      code: b.ma,
      version: 1,
      topic_id: null,
      ban_do: b.payload,
      bien: ["P.127", "P.123a", "P.102", "W.224"].map((ma) => ({
        ma,
        version: 1,
        nhom: "cam" as const,
        ten: ma,
        anh: `${ma}.svg`,
        can_cu: "urn",
        phan_ung: null,
      })),
      anh_xa: ANH_XA,
      muc_phat: {},
    }));
    const b = TRO_CHOI_TU_LAI.taoLuot(nguon, taoRng("s"), 3);
    expect(b).toHaveLength(1);
    expect(b[0]!.noi_dung.ban_do.man).toBe(3);
    const de = JSON.stringify(TRO_CHOI_TU_LAI.deChoNguoiChoi(b[0]!));
    for (const k of ["answer", "dap_an", "giai_thich", "can_cu", "explanation", "anh_xa", "muc_phat"])
      expect(de).not.toContain(`"${k}"`);
    // Thiếu biển đã duyệt thì bản đồ không dùng được.
    expect(TRO_CHOI_TU_LAI.locNguon(nguon.map((n) => ({ ...n, bien: [] })))).toEqual([]);
  });
});

describe("Tự lái: tất định", () => {
  /** Nhật ký lái ngẫu nhiên (theo seed) trên một khu phố mẫu. */
  function nhatKyNgauNhien(seed: string): TraLoiTuLai {
    const rng = taoRng(seed);
    const ops: Op[] = [];
    let n = 0;
    for (let i = 0; i < 60; i++) {
      n += 1 + Math.floor(rng() * 40);
      const r = rng();
      if (r < 0.35) ops.push([n, "ga", rng() < 0.7]);
      else if (r < 0.55) ops.push([n, "phanh", rng() < 0.5]);
      else if (r < 0.8) ops.push([n, "lai", rng() < 0.5 ? "trai" : "phai"]);
      else ops.push([n, "xi_nhan", rng() < 0.4 ? "trai" : rng() < 0.8 ? "phai" : null]);
    }
    const nk = nhatKy(ops, n + 100, rng() < 0.5 ? "o_to" : "xe_may");
    return nk;
  }

  test("20 nhật ký mẫu: chạy lại hai lần cùng băm; chạy từng thao tác như điện thoại cũng cùng băm", () => {
    const bam = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const b = DU_LIEU.ban_do[i % 3]!.payload;
      const nk = nhatKyNgauNhien(`lai-${i}`);
      const a = bamTuLai(chayLaiTuLai(b, nk).tt);
      expect(bamTuLai(chayLaiTuLai(b, nk).tt)).toBe(a);
      // Như điện thoại: áp thao tác ngay khi bấm (trước nhịp kế), mỗi khung hình tiến một nhịp.
      const bd = nk.thao_tac[0]!.tham_so as { xe: "o_to" | "xe_may"; giam: boolean };
      const the = dungTheGioi(b, bd.xe, bd.giam);
      let tt = trangThaiDauPho(the);
      let j = 1;
      while (!tt.ket_thuc && tt.nhip < nk.tong_nhip) {
        while (j < nk.thao_tac.length && nk.thao_tac[j]!.nhip === tt.nhip) {
          const t = nk.thao_tac[j++]!;
          tt = apThaoTacLai(the, tt, { thao_tac: t.thao_tac, tham_so: t.tham_so } as any);
        }
        tt = buocPho(the, tt);
      }
      if (!tt.ket_thuc) tt = { ...tt, ket_thuc: "dung" };
      expect(bamTuLai(tt)).toBe(a);
      bam.add(a);
    }
    // Các nhật ký khác nhau cho trạng thái khác nhau.
    expect(bam.size).toBeGreaterThan(15);
  });

  test("chạy lại một lượt 5 phút dưới 200 ms (sau lần chạy làm nóng)", () => {
    const b = DU_LIEU.ban_do[2]!.payload;
    const nk: TraLoiTuLai = {
      thao_tac: [{ nhip: 0, thao_tac: "bat_dau", tham_so: { xe: "o_to", giam: true } }],
      tong_nhip: 6000,
    };
    chayLaiTuLai(b, nk);
    const t = performance.now();
    const { tt } = chayLaiTuLai(b, nk);
    expect(tt.nhip).toBe(6000);
    expect(performance.now() - t).toBeLessThan(200);
  });

  test("không gọi Math.sin, Math.cos, Math.atan2, Math.random, Date.now", () => {
    for (const f of ["tu-lai.ts", "tu-lai-pho.ts"]) {
      const ma = readFileSync(join(import.meta.dir, "..", "src", "tro-choi", f), "utf8").replace(
        /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
        "",
      );
      expect({
        f,
        cam: ma.match(/Math\.(sin|cos|tan|atan2?|random|hypot)\s*\(|Date\.now\s*\(|new Date\s*\(/g),
      }).toEqual({
        f,
        cam: null,
      });
    }
  });
});
