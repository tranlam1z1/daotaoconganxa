/**
 * API quản trị nội dung trò chơi (docs/PLAN.md GĐ-G0, docs/GAME_DESIGN.md §3), gắn ở
 * /v1/quan-tri/noi-dung-tro-choi.
 *
 * Quyền giống ngân hàng câu hỏi (GĐ3):
 *  - Xem, tạo, sửa, gửi duyệt, lưu trữ: `bien_tap` trở lên.
 *  - Duyệt, từ chối: vai trò đọc từ NGAN_HANG_VAI_TRO_DUYET (mặc định `phap_che`).
 *  - Bật tắt một trò chơi cho người học: `quan_tri`.
 *
 * Mọi phản hồi ở đây có `answer`, nên KHÔNG route người chơi nào được dùng lại các hàm này.
 */

import type { Role } from "@qdpl/auth";
import {
  chuyenTrangThai,
  docThamChieu,
  type HanhDongDuyet,
  hauQuaSua,
  LOAI_THAM_CHIEU,
  MUC_DO_CAU_HOI,
  TRANG_THAI_DUYET,
  trangThaiTruoc,
} from "@qdpl/dao-tao";
import {
  chuyenTrangThaiNoiDung,
  danhSachNoiDungTroChoi,
  danhSachTroChoiDb,
  datBatTroChoi,
  demNoiDungTheoTrangThai,
  kiemTraToanBoThamChieu,
  lichSuDuyetNoiDung,
  type NoiDungTroChoiInput,
  type NoiDungTroChoiRow,
  noiDungTroChoiTheoId,
  suaNoiDungTroChoi,
  taoNoiDungTroChoi,
  troChoiTheoMa,
} from "@qdpl/db";
import { Hono } from "hono";
import { z } from "zod";
import { batBuocVaiTro, ghiNhatKy } from "../auth.ts";
import { badRequest, conflict, notFound, parseBody, parseQuery } from "../http.ts";
import { vaiTroDuyet } from "./ngan-hang.ts";

export const noiDungTroChoiRoute = new Hono();

const uuid = z.string().uuid();

const TEN_HANH_DONG: Record<HanhDongDuyet, string> = {
  gui_duyet: "gửi duyệt",
  duyet: "duyệt",
  tu_choi: "từ chối",
  luu_tru: "lưu trữ",
};

function vaiTroCho(hd: HanhDongDuyet): Role {
  return hd === "duyet" || hd === "tu_choi" ? vaiTroDuyet() : "bien_tap";
}

const thamChieuSchema = z.object({ loai: z.enum(LOAI_THAM_CHIEU), ma: z.string().trim().min(1).max(80) });

const noiDungSchema = z.object({
  game_code: z.string().trim().min(2).max(40),
  topic_id: uuid.nullish(),
  level: z.enum(MUC_DO_CAU_HOI).default("trung_binh"),
  title: z.string().trim().min(3).max(300),
  payload: z.record(z.string(), z.unknown()).default({}),
  answer: z.record(z.string(), z.unknown()).default({}),
  explanation: z.string().trim().max(4000).nullish(),
  citations: z
    .array(
      z
        .string()
        .trim()
        .regex(/^vn:\S+$/, "Căn cứ phải là URN dạng vn:..."),
    )
    .max(20)
    .default([]),
  /** Tham chiếu dạng đối tượng, hoặc dòng chữ "loai:ma" mỗi dòng một mục. */
  refs: z.union([z.array(thamChieuSchema).max(50), z.string().max(5000)]).default([]),
  offline_ok: z.boolean().default(true),
});

async function chuanBi(b: z.infer<typeof noiDungSchema>): Promise<NoiDungTroChoiInput> {
  const g = await troChoiTheoMa(b.game_code);
  if (!g) throw badRequest(`Không có trò chơi "${b.game_code}".`);
  let refs = Array.isArray(b.refs) ? b.refs : [];
  if (typeof b.refs === "string") {
    const doc = docThamChieu(b.refs.split(/\r?\n/));
    if (doc.loi.length) throw badRequest("Tham chiếu chưa đúng dạng", doc.loi);
    refs = doc.refs;
  }
  return {
    game_code: b.game_code,
    topic_id: b.topic_id ?? null,
    level: b.level,
    title: b.title,
    payload: b.payload,
    answer: b.answer,
    explanation: b.explanation ?? null,
    citations: b.citations,
    refs: refs.map((r) => ({ loai: r.loai, ma: r.ma })),
    offline_ok: b.offline_ok,
  };
}

async function layNoiDung(id: string): Promise<NoiDungTroChoiRow> {
  if (!uuid.safeParse(id).success) throw notFound("Không có nội dung này.");
  const nd = await noiDungTroChoiTheoId(id);
  if (!nd) throw notFound("Không có nội dung này.");
  return nd;
}

/* ------------------------------------------------------------------ */
/* Trò chơi                                                            */
/* ------------------------------------------------------------------ */

/** GET /tro-choi: mọi trò chơi đã đăng ký (kể cả đang tắt). */
noiDungTroChoiRoute.get("/tro-choi", async (c) => {
  await batBuocVaiTro(c, "bien_tap");
  return c.json({ items: await danhSachTroChoiDb(), vai_tro_duyet: vaiTroDuyet() });
});

/** PATCH /tro-choi/:ma: bật hoặc tắt một trò cho người học. */
noiDungTroChoiRoute.patch("/tro-choi/:ma", async (c) => {
  const p = await batBuocVaiTro(c, "quan_tri");
  const b = await parseBody(c, z.object({ enabled: z.boolean() }));
  if (!(await datBatTroChoi(c.req.param("ma"), b.enabled))) throw notFound("Không có trò chơi này.");
  await ghiNhatKy(p.email, b.enabled ? "tro_choi.bat" : "tro_choi.tat", c.req.param("ma"));
  return c.json(await troChoiTheoMa(c.req.param("ma")));
});

/* ------------------------------------------------------------------ */
/* Nội dung                                                            */
/* ------------------------------------------------------------------ */

noiDungTroChoiRoute.get("/", async (c) => {
  await batBuocVaiTro(c, "bien_tap");
  const q = parseQuery(
    c,
    z.object({
      game: z.string().max(40).optional(),
      status: z.enum(TRANG_THAI_DUYET).optional(),
      topic: uuid.optional(),
      q: z.string().trim().max(200).optional(),
      can_xem_lai: z.enum(["1", "0"]).optional(),
      trang: z.coerce.number().int().min(1).default(1),
      co: z.coerce.number().int().min(1).max(200).default(200),
    }),
  );
  // Tab "Cần xem lại": kiểm lại tham chiếu của mọi nội dung đã duyệt trước khi lọc.
  if (q.can_xem_lai === "1") await kiemTraToanBoThamChieu();
  const [ds, dem] = await Promise.all([
    danhSachNoiDungTroChoi({
      game: q.game,
      status: q.status,
      topicId: q.topic,
      q: q.q,
      canXemLai: q.can_xem_lai === "1",
      limit: q.co,
      offset: (q.trang - 1) * q.co,
    }),
    demNoiDungTheoTrangThai(),
  ]);
  return c.json({
    items: ds.items,
    tong: ds.tong,
    trang: q.trang,
    co: q.co,
    dem,
    vai_tro_duyet: vaiTroDuyet(),
  });
});

noiDungTroChoiRoute.post("/", async (c) => {
  const p = await batBuocVaiTro(c, "bien_tap");
  const b = await parseBody(c, noiDungSchema.extend({ gui_duyet: z.boolean().default(false) }));
  const nd = await taoNoiDungTroChoi(
    { ...(await chuanBi(b)), status: b.gui_duyet ? "cho_duyet" : "nhap" },
    p.email,
  );
  return c.json(nd, 201);
});

noiDungTroChoiRoute.get("/:id", async (c) => {
  await batBuocVaiTro(c, "bien_tap");
  const nd = await layNoiDung(c.req.param("id"));
  return c.json({ ...nd, lich_su: await lichSuDuyetNoiDung("game_content", nd.id) });
});

noiDungTroChoiRoute.put("/:id", async (c) => {
  const p = await batBuocVaiTro(c, "bien_tap");
  const cu = await layNoiDung(c.req.param("id"));
  const b = await parseBody(c, noiDungSchema.extend({ version: z.number().int().min(1) }));
  const daSua = "Nội dung đã được người khác sửa. Hãy tải lại trang rồi sửa tiếp.";
  if (b.version !== cu.version) throw conflict(daSua);
  const sau = hauQuaSua(cu.status, cu.version);
  if (!sau) throw conflict("Nội dung đã lưu trữ, không sửa được.");
  const nd = await suaNoiDungTroChoi(cu.id, await chuanBi(b), cu.version, sau, p.email);
  if (!nd) throw conflict(daSua);
  return c.json(nd);
});

function routeHanhDong(duongDan: string, hd: HanhDongDuyet) {
  noiDungTroChoiRoute.post(`/:id/${duongDan}`, async (c) => {
    const p = await batBuocVaiTro(c, vaiTroCho(hd));
    const cu = await layNoiDung(c.req.param("id"));
    let ghiChu: string | null = null;
    if (hd === "tu_choi")
      ghiChu = (await parseBody(c, z.object({ ly_do: z.string().trim().min(3).max(1000) }))).ly_do;
    const den = chuyenTrangThai(cu.status, hd);
    if (!den) throw conflict(`Không ${TEN_HANH_DONG[hd]} được nội dung đang ở trạng thái "${cu.status}".`);
    const kq = await chuyenTrangThaiNoiDung({
      id: cu.id,
      tu: trangThaiTruoc(hd),
      den,
      hanhDong: hd,
      actor: p.email,
      ghiChu,
    });
    if (!kq) throw conflict("Trạng thái nội dung vừa thay đổi. Hãy tải lại trang.");
    if (!kq.ok) throw conflict("Chưa duyệt được: nội dung trỏ tới mục chưa duyệt.", kq.loi);
    return c.json(await noiDungTroChoiTheoId(cu.id));
  });
}

routeHanhDong("gui-duyet", "gui_duyet");
routeHanhDong("duyet", "duyet");
routeHanhDong("tu-choi", "tu_choi");
routeHanhDong("luu-tru", "luu_tru");

/** Duyệt hàng loạt: chỉ nội dung đang chờ duyệt và mọi tham chiếu đã duyệt; còn lại bị bỏ qua. */
noiDungTroChoiRoute.post("/duyet-hang-loat", async (c) => {
  const p = await batBuocVaiTro(c, vaiTroDuyet());
  const b = await parseBody(c, z.object({ ids: z.array(uuid).min(1).max(500) }));
  const daDuyet: string[] = [];
  const boQua: Array<{ id: string; ly_do: string }> = [];
  for (const id of new Set(b.ids)) {
    const kq = await chuyenTrangThaiNoiDung({
      id,
      tu: trangThaiTruoc("duyet"),
      den: "da_duyet",
      hanhDong: "duyet",
      actor: p.email,
    });
    if (kq?.ok) daDuyet.push(id);
    else boQua.push({ id, ly_do: kq ? kq.loi.join(" ") : "Không ở trạng thái chờ duyệt." });
  }
  return c.json({ da_duyet: daDuyet.length, bo_qua: boQua });
});
