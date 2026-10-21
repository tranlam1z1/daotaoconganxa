/**
 * Trò chơi (docs/PLAN.md GĐ10): mở màn theo ngưỡng 80%, sao theo tỷ lệ đúng, đồng hồ đua thời
 * gian do máy chủ quyết định, ghép cặp mức phạt chấm theo id bất kể thứ tự, và quy tắc XP.
 */
import { describe, expect, test } from "bun:test";
import {
  type CauHoiNguon,
  capNhatTienDoMan,
  chamGhepCap,
  chiaCauTheoMan,
  chonDongGhepCap,
  conNhanTraLoiDua,
  type DongMucPhatGame,
  deGhepCap,
  giayConLaiDua,
  LoiGhepCap,
  type MucDoCauHoi,
  manDaMo,
  moTaMucPhat,
  saoTheoTyLe,
  soManCuaChuDe,
  type TienDoMan,
  xpTroChoi,
} from "../src/index.ts";

function cau(i: number, level: MucDoCauHoi): CauHoiNguon {
  return {
    id: `q-${String(i).padStart(3, "0")}`,
    version: 1,
    topic_id: "t",
    kind: "mot_dap_an",
    level,
    stem: `Câu ${i}?`,
    options: { phuong_an: [{ id: "a", text: "A" }] },
    answer: { dung: ["a"] },
    explanation: "g",
    citations: [],
  };
}

describe("vượt màn", () => {
  test("số màn theo số câu đã duyệt", () => {
    expect(soManCuaChuDe(4)).toBe(0);
    expect(soManCuaChuDe(7)).toBe(1);
    expect(soManCuaChuDe(25)).toBe(2);
    expect(soManCuaChuDe(500)).toBe(10);
  });

  test("chia màn từ dễ tới khó, mỗi màn 10 câu, không lặp câu", () => {
    const kho = [
      ...Array.from({ length: 10 }, (_, i) => cau(i, "kho")),
      ...Array.from({ length: 10 }, (_, i) => cau(100 + i, "de")),
      ...Array.from({ length: 5 }, (_, i) => cau(200 + i, "trung_binh")),
    ];
    const man = chiaCauTheoMan(kho);
    expect(man).toHaveLength(2);
    expect(man.every((m) => m.length === 10)).toBe(true);
    expect(man[0]!.every((c) => c.level === "de")).toBe(true);
    expect(new Set(man.flat().map((c) => c.id)).size).toBe(20);
    // Chạy lại với thứ tự nguồn khác vẫn ra cùng các màn.
    expect(chiaCauTheoMan([...kho].reverse())).toEqual(man);
  });

  test("màn 2 bị khóa khi màn 1 chưa đạt 80%, mở khi đạt", () => {
    const tienDo = new Map<number, TienDoMan>();
    expect(manDaMo(1, tienDo)).toBe(true);
    expect(manDaMo(2, tienDo)).toBe(false);

    tienDo.set(1, capNhatTienDoMan(null, 0.7));
    expect(manDaMo(2, tienDo)).toBe(false);

    tienDo.set(1, capNhatTienDoMan(tienDo.get(1)!, 0.8));
    expect(manDaMo(2, tienDo)).toBe(true);
    expect(manDaMo(3, tienDo)).toBe(false);
  });

  test("chơi lại kém hơn không làm mất sao hay trạng thái qua màn", () => {
    const tot = capNhatTienDoMan(null, 1);
    expect(tot).toEqual({ best_ratio: 1, stars: 3, qua: true });
    expect(capNhatTienDoMan(tot, 0.3)).toEqual(tot);
  });

  test("sao theo tỷ lệ đúng", () => {
    expect(saoTheoTyLe(0.7)).toBe(0);
    expect(saoTheoTyLe(0.8)).toBe(1);
    expect(saoTheoTyLe(0.9)).toBe(2);
    expect(saoTheoTyLe(1)).toBe(3);
  });
});

describe("đua thời gian", () => {
  const batDau = new Date("2026-09-24T02:00:00Z");
  const sau = (giay: number) => new Date(batDau.getTime() + giay * 1000);

  test("nhận câu trả lời trong 60 giây và phần dung sai 3 giây", () => {
    expect(conNhanTraLoiDua(batDau, sau(0))).toBe(true);
    expect(conNhanTraLoiDua(batDau, sau(59.9))).toBe(true);
    expect(conNhanTraLoiDua(batDau, sau(63))).toBe(true);
  });

  test("không nhận câu trả lời sau 60 giây cộng dung sai", () => {
    expect(conNhanTraLoiDua(batDau, sau(63.001))).toBe(false);
    expect(conNhanTraLoiDua(batDau, sau(3600))).toBe(false);
  });

  test("giây còn lại không âm", () => {
    expect(giayConLaiDua(batDau, sau(0))).toBe(60);
    expect(giayConLaiDua(batDau, sau(59.2))).toBe(1);
    expect(giayConLaiDua(batDau, sau(70))).toBe(0);
  });
});

describe("ghép cặp lỗi – mức phạt", () => {
  const DS: DongMucPhatGame[] = [
    {
      id: "v1",
      hanh_vi: "Không đội mũ bảo hiểm",
      loai_xe: "mo_to",
      fine_min: 400_000,
      fine_max: 600_000,
      citation_urn: "vn:a",
    },
    {
      id: "v2",
      hanh_vi: "Vượt đèn đỏ",
      loai_xe: "mo_to",
      fine_min: 4_000_000,
      fine_max: 6_000_000,
      citation_urn: "vn:b",
    },
    {
      id: "v3",
      hanh_vi: "Dùng điện thoại",
      loai_xe: "mo_to",
      fine_min: 2_000_000,
      fine_max: 3_000_000,
      citation_urn: "vn:c",
    },
    {
      id: "v4",
      hanh_vi: "Trùng mức với v1",
      loai_xe: "o_to",
      fine_min: 400_000,
      fine_max: 600_000,
      citation_urn: "vn:d",
    },
    {
      id: "v5",
      hanh_vi: "Nồng độ cồn",
      loai_xe: "o_to",
      fine_min: 6_000_000,
      fine_max: 8_000_000,
      citation_urn: "vn:e",
    },
    {
      id: "v6",
      hanh_vi: "Không thắt dây an toàn",
      loai_xe: "o_to",
      fine_min: 800_000,
      fine_max: 1_000_000,
      citation_urn: "vn:f",
    },
  ];

  test("mô tả mức phạt theo cách viết tiền Việt Nam", () => {
    expect(moTaMucPhat(800_000, 1_000_000)).toBe("Từ 800.000 đến 1.000.000 đồng");
    expect(moTaMucPhat(2_000_000, 2_000_000)).toBe("2.000.000 đồng");
  });

  test("một ván có 5 dòng với mức phạt khác nhau từng đôi; cùng seed thì cùng ván", () => {
    const van = chonDongGhepCap(DS, "seed-1");
    expect(van).toHaveLength(5);
    expect(new Set(van.map((d) => `${d.fine_min}-${d.fine_max}`)).size).toBe(5);
    expect(chonDongGhepCap([...DS].reverse(), "seed-1")).toEqual(van);
  });

  test("không đủ 3 mức phạt khác nhau thì báo thiếu dữ liệu", () => {
    expect(() => chonDongGhepCap([DS[0]!, DS[3]!, DS[1]!], "s")).toThrow(LoiGhepCap);
  });

  test("đề không để lộ cặp đúng qua id; ghép đúng dù ghép theo thứ tự nào", () => {
    const van = chonDongGhepCap(DS, "seed-2");
    const de = deGhepCap(van, "seed-2");
    expect(de.phai.some((p) => van.some((d) => d.id === p.id))).toBe(false);

    // Tìm cặp đúng qua văn bản mức phạt, rồi dựng câu trả lời theo thứ tự đảo ngược.
    const theoMucPhat = new Map(de.phai.map((p) => [p.text, p.id]));
    const cap: Record<string, string> = {};
    for (const d of [...van].reverse()) cap[d.id] = theoMucPhat.get(moTaMucPhat(d.fine_min, d.fine_max))!;
    const kq = chamGhepCap(van, "seed-2", cap);
    expect(kq).toMatchObject({ dung: 5, tong: 5 });
  });

  test("ghép sai hai cặp thì đúng 3/5, có chỉ ra mức phạt đúng", () => {
    const van = chonDongGhepCap(DS, "seed-3");
    const de = deGhepCap(van, "seed-3");
    const theoMucPhat = new Map(de.phai.map((p) => [p.text, p.id]));
    const cap: Record<string, string> = {};
    for (const d of van) cap[d.id] = theoMucPhat.get(moTaMucPhat(d.fine_min, d.fine_max))!;
    [cap[van[0]!.id], cap[van[1]!.id]] = [cap[van[1]!.id]!, cap[van[0]!.id]!];
    const kq = chamGhepCap(van, "seed-3", cap);
    expect(kq.dung).toBe(3);
    expect(kq.chi_tiet[0]).toMatchObject({
      dung: false,
      muc_phat_dung: moTaMucPhat(van[0]!.fine_min, van[0]!.fine_max),
    });
    // Ván khác seed thì id vế phải khác: không dùng lại được câu trả lời của ván cũ.
    expect(chamGhepCap(van, "seed-khac", cap).dung).toBe(0);
  });
});

describe("XP trò chơi", () => {
  test("vượt màn: 2 XP mỗi câu đúng, thêm 10 khi qua màn lần đầu", () => {
    expect(xpTroChoi("vuot_man", { soDung: 8, tong: 10, quaManLanDau: true })).toBe(26);
    expect(xpTroChoi("vuot_man", { soDung: 8, tong: 10 })).toBe(16);
  });

  test("đua thời gian: thưởng phá kỷ lục chỉ khi có câu đúng", () => {
    expect(xpTroChoi("dua_thoi_gian", { soDung: 12, tong: 15, phaKyLuc: true })).toBe(17);
    expect(xpTroChoi("dua_thoi_gian", { soDung: 0, tong: 3, phaKyLuc: true })).toBe(0);
  });

  test("ghép cặp: thưởng khi đúng hết", () => {
    expect(xpTroChoi("ghep_cap", { soDung: 5, tong: 5 })).toBe(10);
    expect(xpTroChoi("ghep_cap", { soDung: 4, tong: 5 })).toBe(4);
  });
});
