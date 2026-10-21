/**
 * Biển báo (docs/PLAN.md GĐ12).
 *
 *  - `bienBao`, gắn ở /v1/tra-cuu/bien-bao: tra cứu công khai như phần tra cứu nhanh. Chỉ biển
 *    đã duyệt; bật TRA_CUU_NHANH_BAN_NHAP=1 để biên tập viên xem cả bản nháp.
 *  - `doanBienBao`, gắn ở /v1/tro-choi/doan-bien-bao: game đoán biển báo trong khung game của
 *    GĐ10 (phiên `game:doan_bien_bao`, chấm trên máy chủ, XP một lần mỗi ván).
 */

import type { Principal } from "@qdpl/auth";
import {
  type BienBaoGame,
  type CauDoan,
  chamCauDoan,
  deCauDoan,
  LoiDoanBienBao,
  NHOM_BIEN_BAO,
  taoVanDoan,
  xpTroChoi,
} from "@qdpl/dao-tao";
import {
  type BienBaoRow,
  bienBaoTheoMa,
  congXp,
  danhSachBienBao,
  ghiDiemGame,
  ghiTraLoiDoan,
  ketThucVanDoan,
  phienLuyenTap,
  sql,
  taoPhienGame,
} from "@qdpl/db";
import { docUrnOf } from "@qdpl/legal-model";
import { getObject } from "@qdpl/storage";
import { Hono } from "hono";
import { z } from "zod";
import { batBuocDangNhap, KhongDuQuyen } from "../auth.ts";
import { badRequest, conflict, notFound, parseBody, parseQuery } from "../http.ts";
import { vanBanCoTrongKho } from "./tra-cuu-nhanh.ts";

const gomBanNhap = () => process.env.TRA_CUU_NHANH_BAN_NHAP === "1";

/** Tên tệp ảnh trong image_uri (assets/bien-bao/P.102.svg -> P.102.svg). */
const tepAnh = (uri: string) => uri.split("/").pop() ?? uri;

function sangBienBao(r: BienBaoRow, coTrongKho: Set<string>) {
  return {
    ma: r.code,
    nhom: r.group_name,
    ten: r.name,
    y_nghia: r.meaning,
    anh: tepAnh(r.image_uri),
    can_cu: r.citation_urn,
    // Văn bản căn cứ chưa nạp vào kho thì giao diện chỉ ghi viện dẫn, không dẫn tới trang đọc.
    can_cu_mo_duoc: coTrongKho.has(docUrnOf(r.citation_urn)),
    ban_nhap: r.status !== "da_duyet",
  };
}

/* ------------------------------------------------------------------ */
/* Tra cứu                                                             */
/* ------------------------------------------------------------------ */

export const bienBao = new Hono();

bienBao.get("/", async (c) => {
  const p = parseQuery(
    c,
    z.object({ q: z.string().trim().max(100).optional(), nhom: z.enum(NHOM_BIEN_BAO).optional() }),
  );
  const rows = await danhSachBienBao({ q: p.q, nhom: p.nhom, gomBanNhap: gomBanNhap() });
  const coTrongKho = await vanBanCoTrongKho(rows.map((r) => r.citation_urn));
  return c.json({ items: rows.map((r) => sangBienBao(r, coTrongKho)), ban_nhap: gomBanNhap() });
});

const LOAI_ANH: Record<string, string> = { svg: "image/svg+xml", png: "image/png", webp: "image/webp" };

/** GET /v1/tra-cuu/bien-bao/anh/:tep: ảnh biển từ kho đối tượng, cho phép bộ nhớ đệm lâu. */
bienBao.get("/anh/:tep", async (c) => {
  const tep = c.req.param("tep");
  const duoi = /^[\w.-]+\.(svg|png|webp)$/i.exec(tep)?.[1]?.toLowerCase();
  if (!duoi) throw notFound("Không có ảnh này.");
  let du: Uint8Array;
  try {
    du = await getObject(`assets/bien-bao/${tep}`);
  } catch {
    throw notFound("Không có ảnh này.");
  }
  return new Response(du as BodyInit, {
    headers: {
      "content-type": LOAI_ANH[duoi]!,
      "cache-control": "public, max-age=86400",
      // Ảnh SVG tự soạn: không cho chạy mã nhúng nếu có ai mở thẳng tệp.
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
});

bienBao.get("/:ma", async (c) => {
  const r = await bienBaoTheoMa(c.req.param("ma"), gomBanNhap());
  if (!r) throw notFound("Không có biển báo này.");
  return c.json(sangBienBao(r, await vanBanCoTrongKho([r.citation_urn])));
});

/* ------------------------------------------------------------------ */
/* Game đoán biển báo                                                  */
/* ------------------------------------------------------------------ */

export const doanBienBao = new Hono();

const uuid = z.string().uuid();

/** Một câu trong ván: câu hỏi kèm ảnh chụp tên các phương án và thông tin đáp án. */
interface CauVan extends CauDoan {
  ten_phuong_an: string[];
  ten: string;
  y_nghia: string;
  can_cu: string;
  tra_loi?: { chon: string; dung: boolean };
}

function taiKhoan(p: Principal): string {
  if (!p.accountId) throw badRequest("Phiên đăng nhập không gắn với tài khoản nào.");
  return p.accountId;
}

async function layVan(id: string, acc: string) {
  if (!uuid.safeParse(id).success) throw notFound("Không có ván này.");
  const p = await phienLuyenTap(id);
  if (p?.source !== "game:doan_bien_bao") throw notFound("Không có ván này.");
  if (p.account_id !== acc) throw new KhongDuQuyen("khach");
  return { p, cau: p.items as unknown as CauVan[] };
}

/** Phần gửi người chơi của một câu: ảnh và 4 tên, không có mã biển. */
const deGui = (c: CauVan) => ({
  stt: c.stt,
  anh: c.anh,
  phuong_an: c.ten_phuong_an.map((text, i) => ({ id: String(i), text })),
});

/** POST /v1/tro-choi/doan-bien-bao/bat-dau: ván 10 câu từ các biển đã duyệt. */
doanBienBao.post("/bat-dau", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  const ds: BienBaoGame[] = (await danhSachBienBao({ gomBanNhap: gomBanNhap() })).map((r) => {
    // Ván chơi không dùng cờ mở được căn cứ.
    const b = sangBienBao(r, new Set());
    return { ma: b.ma, nhom: b.nhom, ten: b.ten, y_nghia: b.y_nghia, anh: b.anh, can_cu: b.can_cu };
  });
  let van: CauDoan[];
  try {
    van = taoVanDoan(ds, `${acc}|doan|${crypto.randomUUID()}`);
  } catch (err) {
    if (err instanceof LoiDoanBienBao) throw badRequest(err.message);
    throw err;
  }
  const theoMa = new Map(ds.map((b) => [b.ma, b]));
  const items: CauVan[] = van.map((cau) => {
    const b = theoMa.get(cau.ma)!;
    return {
      ...cau,
      ten_phuong_an: deCauDoan(cau, theoMa).phuong_an.map((x) => x.text),
      ten: b.ten,
      y_nghia: b.y_nghia,
      can_cu: b.can_cu,
    };
  });
  const phien = await taoPhienGame({ accountId: acc, topicId: null, source: "game:doan_bien_bao", items });
  return c.json({ id: phien.id, cau: items.map(deGui) }, 201);
});

/** POST /v1/tro-choi/doan-bien-bao/:id/tra-loi: chấm một câu; trả lời lại nhận 409. */
doanBienBao.post("/:id/tra-loi", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  const { p, cau } = await layVan(c.req.param("id"), acc);
  if (p.finished_at) throw conflict("Ván đã kết thúc.");
  const b = await parseBody(c, z.object({ stt: z.number().int().min(1), chon: z.string().max(4) }));
  const cauHoi = cau[b.stt - 1];
  if (!cauHoi) throw badRequest(`Ván không có câu số ${b.stt}.`);
  const dung = chamCauDoan(cauHoi, b.chon);
  if (!(await ghiTraLoiDoan(p.id, b.stt - 1, b.chon, dung))) {
    throw conflict("Câu này đã được trả lời, không chấm lại.");
  }
  return c.json({
    stt: b.stt,
    dung,
    dap_an: String(cauHoi.phuong_an.indexOf(cauHoi.ma)),
    ten: cauHoi.ten,
    y_nghia: cauHoi.y_nghia,
    can_cu: cauHoi.can_cu,
  });
});

/** POST /v1/tro-choi/doan-bien-bao/:id/ket-thuc: chốt ván, ghi điểm và XP một lần. */
doanBienBao.post("/:id/ket-thuc", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  const { p, cau } = await layVan(c.req.param("id"), acc);
  const kq = (await sql.begin(async (tx) => {
    const dung = await ketThucVanDoan(tx, p.id);
    if (dung === null) return { dung: p.correct ?? 0, xp: 0 };
    const xp = xpTroChoi("doan_bien_bao", { soDung: dung, tong: cau.length });
    await ghiDiemGame(tx, { accountId: acc, gameCode: "doan_bien_bao", sessionId: p.id, score: dung });
    await congXp(tx, { accountId: acc, nguon: "game:doan_bien_bao", nguonId: p.id, xp });
    return { dung, xp };
  })) as { dung: number; xp: number };
  return c.json({ id: p.id, dung: kq.dung, tong: cau.length, xp: kq.xp });
});
