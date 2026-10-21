/**
 * API trò chơi (docs/PLAN.md GĐ10), gắn ở /v1/tro-choi.
 *
 * Khung game chung: bắt đầu → chơi → kết thúc → tính XP.
 *  - Vượt màn và đua thời gian tạo phiên luyện tập `source = game:*`; người chơi trả lời và kết
 *    thúc qua /v1/luyen-tap/phien/:id/* như luyện tập. Ba hàm cuối tệp này được routes/luyen-tap.ts
 *    gọi để thêm phần riêng của game: đồng hồ đua thời gian và việc tính màn, kỷ lục, XP khi kết thúc.
 *  - Ghép cặp là một ván nộp một lần, chấm ở đây.
 * Mọi việc chấm đều ở máy chủ; đề gửi đi không có đáp án.
 */

import type { Principal } from "@qdpl/auth";
import {
  type CauHoiNguon,
  capNhatTienDoMan,
  chamGhepCap,
  chiaCauTheoMan,
  chonDongGhepCap,
  conNhanTraLoiDua,
  type DongMucPhatGame,
  deGhepCap,
  hanDua,
  LOAI_CAU_DUA,
  LOAI_CAU_HOI_NHANH,
  LoiGhepCap,
  manDaMo,
  rutCauLuyenTap,
  SO_CAU_DUA,
  SO_CAU_HOI_NHANH,
  SO_CAU_MOI_MAN,
  soManCuaChuDe,
  type TienDoMan,
  xpTroChoi,
} from "@qdpl/dao-tao";
import {
  chotVanGhepCap,
  chuDeLuyenTap,
  chuDeTheoMaHoacId,
  congXp,
  damBaoMan,
  danhSachTroChoiDb,
  ghiDiemGame,
  ghiTienDoMan,
  kyLucCuaToi,
  kyLucTruoc,
  manCuaPhien,
  manTheoId,
  mucPhatChoGhepCap,
  nguonDuaThoiGian,
  nguonTheoChuDe,
  type PhienLuyenTapRow,
  phienLuyenTap,
  sql,
  taoPhienGame,
  tienDoManCuaToi,
  tienDoManKhoa,
} from "@qdpl/db";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { batBuocDangNhap, KhongDuQuyen } from "../auth.ts";
import { badRequest, conflict, notFound, parseBody, today } from "../http.ts";

export const troChoi = new Hono();

const uuid = z.string().uuid();

function taiKhoan(p: Principal): string {
  if (!p.accountId) throw badRequest("Phiên đăng nhập không gắn với tài khoản nào.");
  return p.accountId;
}

/** Màn chưa mở: 403 với thông báo riêng, không phải thiếu vai trò. */
function manChuaMo(): HTTPException {
  return new HTTPException(403, { message: "Màn này chưa mở. Hãy qua màn trước với ít nhất 80% câu đúng." });
}

/* ------------------------------------------------------------------ */
/* Tổng quan                                                           */
/* ------------------------------------------------------------------ */

/**
 * GET /v1/tro-choi: chủ đề chơi được vượt màn, kỷ lục đua thời gian và ghép cặp của tôi, và cờ bật
 * tắt của các trò cũ. Trò trên khung chung (GĐ-G0) liệt kê ở /v1/luot-choi.
 */
troChoi.get("/", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  const [chuDe, dua, ghep, games] = await Promise.all([
    chuDeLuyenTap(acc),
    kyLucCuaToi(acc, "dua_thoi_gian"),
    kyLucCuaToi(acc, "ghep_cap"),
    danhSachTroChoiDb(),
  ]);
  return c.json({
    // Trò nào đang hiện cho người học (bảng games, docs/PLAN.md GĐ-G0).
    bat: Object.fromEntries(games.filter((g) => g.engine === "cu").map((g) => [g.code, g.enabled])),
    vuot_man: chuDe
      .filter((t) => soManCuaChuDe(t.so_cau) > 0)
      .map((t) => ({
        code: t.code,
        name: t.name,
        parent_id: t.parent_id,
        id: t.id,
        so_man: soManCuaChuDe(t.so_cau),
      })),
    dua_thoi_gian: dua,
    ghep_cap: ghep,
  });
});

/* ------------------------------------------------------------------ */
/* Vượt màn                                                            */
/* ------------------------------------------------------------------ */

async function banDoMan(acc: string, topicId: string) {
  const nguon = (await nguonTheoChuDe(topicId)) as unknown as CauHoiNguon[];
  const khuc = chiaCauTheoMan(nguon);
  const man = await damBaoMan(topicId, khuc.length, SO_CAU_MOI_MAN);
  const daCo = new Map((await tienDoManCuaToi(acc, topicId)).map((r) => [r.ordinal, r]));
  const tienDo = new Map<number, TienDoMan>(
    [...daCo].map(([k, r]) => [
      k,
      { best_ratio: r.best_ratio, stars: r.stars, qua: Boolean(r.completed_at) },
    ]),
  );
  return {
    khuc,
    man: man.map((m, i) => ({
      id: m.id,
      thu_tu: m.ordinal,
      so_cau: khuc[i]?.length ?? 0,
      mo: manDaMo(m.ordinal, tienDo),
      sao: tienDo.get(m.ordinal)?.stars ?? 0,
      qua: tienDo.get(m.ordinal)?.qua ?? false,
      ty_le_tot_nhat: tienDo.get(m.ordinal)?.best_ratio ?? null,
    })),
  };
}

/** GET /v1/tro-choi/vuot-man/:chuDe: bản đồ màn của một chủ đề (mã hoặc id). */
troChoi.get("/vuot-man/:chuDe", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  const t = await chuDeTheoMaHoacId(c.req.param("chuDe"));
  if (!t) throw notFound("Không có chủ đề này.");
  const { man } = await banDoMan(acc, t.id);
  return c.json({ chu_de: { id: t.id, code: t.code, name: t.name }, man });
});

/** POST /v1/tro-choi/vuot-man/man/:id/bat-dau: chơi một màn. Màn chưa mở trả 403. */
troChoi.post("/vuot-man/man/:id/bat-dau", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  const id = c.req.param("id");
  if (!uuid.safeParse(id).success) throw notFound("Không có màn này.");
  const m = await manTheoId(id);
  if (!m) throw notFound("Không có màn này.");
  const { khuc, man } = await banDoMan(acc, m.topic_id);
  const trenBanDo = man.find((x) => x.id === m.id);
  if (!trenBanDo || !khuc[m.ordinal - 1]?.length) throw notFound("Màn này không còn câu hỏi.");
  if (!trenBanDo.mo) throw manChuaMo();

  const cau = khuc[m.ordinal - 1]!;
  const items = rutCauLuyenTap({
    nguon: cau,
    seed: `${acc}|${m.id}|${crypto.randomUUID()}`,
    soCau: cau.length,
  });
  const phien = await taoPhienGame({
    accountId: acc,
    topicId: m.topic_id,
    source: "game:vuot_man",
    items,
    gameLevelId: m.id,
  });
  return c.json({ id: phien.id, man: m.ordinal, tong: items.length }, 201);
});

/* ------------------------------------------------------------------ */
/* Đua thời gian                                                       */
/* ------------------------------------------------------------------ */

troChoi.get("/dua-thoi-gian", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  return c.json(await kyLucCuaToi(acc, "dua_thoi_gian"));
});

/** POST /v1/tro-choi/dua-thoi-gian/bat-dau: đồng hồ 60 giây bắt đầu từ lúc máy chủ tạo phiên. */
troChoi.post("/dua-thoi-gian/bat-dau", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  const b = await parseBody(c, z.object({ chu_de: z.string().trim().max(80).optional() }));
  let topicId: string | null = null;
  if (b.chu_de) {
    const t = await chuDeTheoMaHoacId(b.chu_de);
    if (!t) throw notFound("Không có chủ đề này.");
    topicId = t.id;
  }
  const nguon = (await nguonDuaThoiGian(LOAI_CAU_DUA, topicId)) as unknown as CauHoiNguon[];
  if (nguon.length < 5)
    throw badRequest("Chưa đủ câu hỏi một đáp án hoặc đúng/sai đã duyệt để đua thời gian.");
  const items = rutCauLuyenTap({
    nguon,
    seed: `${acc}|dua|${crypto.randomUUID()}`,
    soCau: Math.min(SO_CAU_DUA, nguon.length),
  });
  const phien = await taoPhienGame({ accountId: acc, topicId, source: "game:dua_thoi_gian", items });
  return c.json(
    { id: phien.id, bat_dau: phien.started_at, han: hanDua(phien.started_at), tong: items.length },
    201,
  );
});

/* ------------------------------------------------------------------ */
/* Hỏi nhanh bằng giọng nói (docs/PLAN.md GĐ14)                        */
/* ------------------------------------------------------------------ */

troChoi.get("/hoi-nhanh-giong-noi", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  return c.json(await kyLucCuaToi(acc, "hoi_nhanh_giong_noi"));
});

/**
 * POST /v1/tro-choi/hoi-nhanh-giong-noi/bat-dau: một lượt 10 câu một đáp án hoặc đúng/sai.
 * Trả lời và kết thúc qua API luyện tập như đua thời gian, nhưng không tính giờ.
 */
troChoi.post("/hoi-nhanh-giong-noi/bat-dau", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  const nguon = (await nguonDuaThoiGian(LOAI_CAU_HOI_NHANH, null)) as unknown as CauHoiNguon[];
  if (nguon.length < 3) throw badRequest("Chưa đủ câu hỏi một đáp án hoặc đúng/sai đã duyệt để chơi.");
  const items = rutCauLuyenTap({
    nguon,
    seed: `${acc}|hoi-nhanh|${crypto.randomUUID()}`,
    soCau: Math.min(SO_CAU_HOI_NHANH, nguon.length),
  });
  const phien = await taoPhienGame({
    accountId: acc,
    topicId: null,
    source: "game:hoi_nhanh_giong_noi",
    items,
  });
  return c.json({ id: phien.id, tong: items.length }, 201);
});

/* ------------------------------------------------------------------ */
/* Ghép cặp lỗi – mức phạt                                             */
/* ------------------------------------------------------------------ */

interface VanGhepCap {
  seed: string;
  dong: DongMucPhatGame[];
  tra_loi?: Record<string, string>;
}

async function layVanCuaToi(id: string, acc: string): Promise<{ p: PhienLuyenTapRow; van: VanGhepCap }> {
  if (!uuid.safeParse(id).success) throw notFound("Không có ván này.");
  const p = await phienLuyenTap(id);
  if (p?.source !== "game:ghep_cap") throw notFound("Không có ván này.");
  if (p.account_id !== acc) throw new KhongDuQuyen("khach");
  return { p, van: p.items[0] as unknown as VanGhepCap };
}

troChoi.post("/ghep-cap/bat-dau", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  const b = await parseBody(c, z.object({ xe: z.enum(["o_to", "mo_to"]).optional() }));
  const ds = await mucPhatChoGhepCap(today(), b.xe ?? null);
  const seed = crypto.randomUUID();
  let dong: DongMucPhatGame[];
  try {
    dong = chonDongGhepCap(ds, seed);
  } catch (err) {
    if (err instanceof LoiGhepCap) throw badRequest(err.message);
    throw err;
  }
  const van: VanGhepCap = { seed, dong };
  const phien = await taoPhienGame({ accountId: acc, topicId: null, source: "game:ghep_cap", items: [van] });
  return c.json({ id: phien.id, de: deGhepCap(dong, seed) }, 201);
});

/** GET /v1/tro-choi/ghep-cap/:id: đề của ván; ván đã nộp thì kèm kết quả. */
troChoi.get("/ghep-cap/:id", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  const { p, van } = await layVanCuaToi(c.req.param("id"), acc);
  return c.json({
    id: p.id,
    de: deGhepCap(van.dong, van.seed),
    ket_thuc: p.finished_at,
    ...(p.finished_at && van.tra_loi ? { ket_qua: chamGhepCap(van.dong, van.seed, van.tra_loi) } : {}),
  });
});

/** POST /v1/tro-choi/ghep-cap/:id/nop: chấm cả ván một lần; nộp lại nhận 409. */
troChoi.post("/ghep-cap/:id/nop", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  const { p, van } = await layVanCuaToi(c.req.param("id"), acc);
  if (p.finished_at) throw conflict("Ván này đã nộp.");
  const b = await parseBody(c, z.object({ cap: z.record(z.string().max(40), z.string().max(40)) }));
  const kq = chamGhepCap(van.dong, van.seed, b.cap);
  const xp = xpTroChoi("ghep_cap", { soDung: kq.dung, tong: kq.tong });
  const daChot = (await sql.begin(async (tx) => {
    if (!(await chotVanGhepCap(tx, { sessionId: p.id, correct: kq.dung, response: b.cap }))) return false;
    await ghiDiemGame(tx, { accountId: acc, gameCode: "ghep_cap", sessionId: p.id, score: kq.dung });
    await congXp(tx, { accountId: acc, nguon: "game:ghep_cap", nguonId: p.id, xp });
    return true;
  })) as boolean;
  if (!daChot) throw conflict("Ván này đã nộp.");
  return c.json({ ...kq, xp });
});

/* ------------------------------------------------------------------ */
/* Móc nối cho routes/luyen-tap.ts                                     */
/* ------------------------------------------------------------------ */

/**
 * Phiên có phải phiên câu hỏi (luyện tập, vượt màn, đua thời gian) không. Ván ghép cặp và ván đoán
 * biển báo (GĐ12) thì không: chúng có API riêng.
 */
export function laPhienCauHoi(p: Pick<PhienLuyenTapRow, "source">): boolean {
  return p.source !== "game:ghep_cap" && p.source !== "game:doan_bien_bao";
}

/** Đua thời gian hết 60 giây cộng dung sai thì không nhận câu trả lời nữa (409). */
export function kiemTraGioGame(p: Pick<PhienLuyenTapRow, "source" | "started_at">, now = new Date()): void {
  if (p.source === "game:dua_thoi_gian" && !conNhanTraLoiDua(new Date(p.started_at), now)) {
    throw conflict("Hết giờ. Câu trả lời gửi sau 60 giây không được tính.");
  }
}

/**
 * Phần riêng của game khi kết thúc phiên: cập nhật màn và sao (vượt màn), ghi kỷ lục (đua thời
 * gian), cộng XP. Gọi lại trên phiên đã kết thúc không cộng thêm gì: tiến độ chỉ giữ kết quả tốt
 * nhất, điểm và XP có khóa duy nhất theo phiên. Trả thông tin để gộp vào phản hồi kết thúc.
 */
export async function sauKetThucGame(p: PhienLuyenTapRow): Promise<Record<string, unknown>> {
  const soDung = p.correct ?? 0;
  const tong = p.total;
  if (p.source === "game:vuot_man") {
    const m = await manCuaPhien(p.id);
    if (!m) return {};
    const tyLe = tong ? soDung / tong : 0;
    return (await sql.begin(async (tx) => {
      const cu = await tienDoManKhoa(tx, p.account_id, m.id);
      const moi = capNhatTienDoMan(cu, tyLe, m.pass_ratio);
      await ghiTienDoMan(tx, { accountId: p.account_id, levelId: m.id, ...moi });
      const xp = xpTroChoi("vuot_man", { soDung, tong, quaManLanDau: !cu?.qua && moi.qua });
      await congXp(tx, { accountId: p.account_id, nguon: "game:vuot_man", nguonId: p.id, xp });
      return {
        tro_choi: {
          ma: "vuot_man",
          man: m.ordinal,
          chu_de_id: m.topic_id,
          ty_le: tyLe,
          dat: tyLe >= m.pass_ratio,
          sao: capNhatTienDoMan(null, tyLe, m.pass_ratio).stars,
          xp,
        },
      };
    })) as Record<string, unknown>;
  }
  if (p.source === "game:dua_thoi_gian") {
    return (await sql.begin(async (tx) => {
      const truoc = await kyLucTruoc(tx, p.account_id, "dua_thoi_gian", p.id);
      await ghiDiemGame(tx, {
        accountId: p.account_id,
        gameCode: "dua_thoi_gian",
        sessionId: p.id,
        score: soDung,
      });
      const phaKyLuc = truoc === null || soDung > truoc;
      const xp = xpTroChoi("dua_thoi_gian", { soDung, tong, phaKyLuc });
      await congXp(tx, { accountId: p.account_id, nguon: "game:dua_thoi_gian", nguonId: p.id, xp });
      return {
        tro_choi: {
          ma: "dua_thoi_gian",
          diem: soDung,
          ky_luc: Math.max(truoc ?? 0, soDung),
          pha_ky_luc: phaKyLuc,
          xp,
        },
      };
    })) as Record<string, unknown>;
  }
  if (p.source === "game:hoi_nhanh_giong_noi") {
    return (await sql.begin(async (tx) => {
      const truoc = await kyLucTruoc(tx, p.account_id, "hoi_nhanh_giong_noi", p.id);
      await ghiDiemGame(tx, {
        accountId: p.account_id,
        gameCode: "hoi_nhanh_giong_noi",
        sessionId: p.id,
        score: soDung,
      });
      const xp = xpTroChoi("hoi_nhanh_giong_noi", { soDung, tong });
      await congXp(tx, { accountId: p.account_id, nguon: "game:hoi_nhanh_giong_noi", nguonId: p.id, xp });
      return {
        tro_choi: {
          ma: "hoi_nhanh_giong_noi",
          diem: soDung,
          tong,
          ky_luc: Math.max(truoc ?? 0, soDung),
          pha_ky_luc: truoc === null || soDung > truoc,
          xp,
        },
      };
    })) as Record<string, unknown>;
  }
  return {};
}
