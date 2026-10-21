/**
 * API luyện tập của người học (docs/PLAN.md GĐ4), gắn ở /v1/luyen-tap.
 *
 * Ranh giới:
 *  - Mọi route cần đăng nhập; phiên chỉ chủ phiên đọc và trả lời được (người khác nhận 403).
 *  - Chỉ câu `da_duyet` được rút vào phiên. Phiên lưu ảnh chụp câu, nên sửa câu sau đó không
 *    đổi đề đang làm.
 *  - Đề gửi đi KHÔNG có đáp án. Đáp án, giải thích và căn cứ chỉ trả về sau khi câu đã được chấm.
 *  - Người học lưu tạm câu trả lời (`/luu-tam`), đi tới đi lui và sửa được tới khi kết thúc phiên;
 *    lúc kết thúc mới chấm cả phiên. Trong lúc làm, máy chủ không báo đúng/sai.
 */

import type { Principal } from "@qdpl/auth";
import {
  type CauHoiNguon,
  type CauTrongPhien,
  capNhatCauSai,
  chamCauHoi,
  deChoNguoiHoc,
  type KetQuaCauHoi,
  type NoiDungCauHoi,
  rutCauLuyenTap,
  type TraLoiCauHoi,
} from "@qdpl/dao-tao";
import {
  cauHoiTheoIds,
  cauTraLoiCuaPhien,
  chuDeLuyenTap,
  chuDeTheoMaHoacId,
  ghiCauTraLoi,
  goiOfflineTheoChuDe,
  ketThucPhien,
  ketThucPhienOffline,
  layHoacTaoPhienOffline,
  lichSuCauCuaToi,
  luuBanNhap,
  mucNhomCuaPhien,
  nguonCauSai,
  nguonTheoChuDe,
  type PhienLuyenTapRow,
  phienLuyenTap,
  taoPhienLuyenTap,
} from "@qdpl/db";
import { Hono } from "hono";
import { z } from "zod";
import { batBuocDangNhap, KhongDuQuyen } from "../auth.ts";
import { badRequest, conflict, notFound, parseBody } from "../http.ts";

export const luyenTap = new Hono();

const uuid = z.string().uuid();

/** Lỗi 403 riêng cho phiên của người khác (không phải thiếu vai trò). */
class KhongPhaiPhienCuaBan extends KhongDuQuyen {
  constructor() {
    super("khach");
    this.message = "Phiên luyện tập này không phải của bạn.";
  }
}

function taiKhoan(p: Principal): string {
  if (!p.accountId) throw badRequest("Phiên đăng nhập không gắn với tài khoản nào.");
  return p.accountId;
}

async function layPhienCuaToi(id: string, accountId: string): Promise<PhienLuyenTapRow> {
  if (!uuid.safeParse(id).success) throw notFound("Không có phiên luyện tập này.");
  const phien = await phienLuyenTap(id);
  if (!phien) throw notFound("Không có phiên luyện tập này.");
  if (phien.account_id !== accountId) throw new KhongPhaiPhienCuaBan();
  return phien;
}

const items = (p: PhienLuyenTapRow) => p.items as unknown as CauTrongPhien[];

/** Phản hồi chấm cho một câu đã trả lời, tính lại từ ảnh chụp và câu trả lời đã lưu. */
function phanHoi(cau: CauTrongPhien, traLoi: TraLoiCauHoi): KetQuaCauHoi {
  return chamCauHoi(cau.noi_dung, traLoi);
}

/** Câu trả lời có nội dung (đã chọn, đã xếp, đã ghép hoặc đã điền ít nhất một ô). */
function coTraLoi(t: Record<string, unknown> | null | undefined): boolean {
  if (!t) return false;
  const x = t as TraLoiCauHoi;
  return Boolean(
    x.chon?.length ||
      x.thu_tu?.length ||
      Object.values(x.cap ?? {}).some(Boolean) ||
      Object.values(x.o_trong ?? {}).some((v) => String(v).trim()),
  );
}

/** Câu trả lời chưa chấm của phiên đang làm (phiên đã kết thúc thì không còn bản nháp nào). */
const banNhap = (p: PhienLuyenTapRow) => (p.finished_at ? {} : (p.draft_answers ?? {}));

/**
 * Phiên dạng gửi cho người học. Câu đã lưu tạm có câu trả lời nhưng KHÔNG có kết quả chấm, để mở
 * lại phiên (mất mạng, tải lại trang) vẫn thấy đáp án đã chọn mà không lộ đúng/sai. Câu đã chấm
 * (phiên đã kết thúc, hoặc Đua thời gian) có thêm phản hồi chấm.
 */
async function phienChoNguoiHoc(p: PhienLuyenTapRow) {
  const daTraLoi = new Map((await cauTraLoiCuaPhien(p.id)).map((a) => [a.question_id, a]));
  const ds = items(p);
  const nhap = banNhap(p);
  const soNhap = ds.filter(
    (c, i) => !daTraLoi.has(c.question_id) && coTraLoi(nhap[String(i + 1)]?.tra_loi),
  ).length;
  // Đề ôn tập của nhóm học cùng (docs/PLAN.md GĐ16a, đề xuất Đ14): tên đề và nhóm để quay về.
  const nhom = p.source === "nhom" && p.group_item_id ? await mucNhomCuaPhien(p.group_item_id) : null;
  return {
    id: p.id,
    nguon: p.source,
    chu_de: p.topic_name,
    ...(nhom ? { nhom } : {}),
    bat_dau: p.started_at,
    ket_thuc: p.finished_at,
    tong: p.total,
    dung: p.finished_at ? p.correct : ds.filter((c) => daTraLoi.get(c.question_id)?.correct).length,
    da_tra_loi: daTraLoi.size + soNhap,
    cau: ds.map((c, i) => {
      const a = daTraLoi.get(c.question_id);
      const n = nhap[String(i + 1)];
      return {
        stt: i + 1,
        muc_do: c.level,
        de: c.de,
        ...(a
          ? { tra_loi: a.response, ket_qua: phanHoi(c, a.response as TraLoiCauHoi) }
          : n
            ? { tra_loi: n.tra_loi }
            : {}),
      };
    }),
  };
}

/* ------------------------------------------------------------------ */

/** GET /v1/luyen-tap/chu-de: cây chủ đề, số câu đã duyệt, tiến độ của tôi, số câu sai. */
luyenTap.get("/chu-de", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  const [chuDe, cauSai] = await Promise.all([chuDeLuyenTap(acc), nguonCauSai(acc)]);
  return c.json({ items: chuDe, so_cau_sai: cauSai.length });
});

/** POST /v1/luyen-tap/phien: tạo phiên theo chủ đề (`chu_de`: mã hoặc id) hoặc từ câu sai. */
luyenTap.post("/phien", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  const b = await parseBody(
    c,
    z.object({
      nguon: z.enum(["chu_de", "cau_sai"]).default("chu_de"),
      chu_de: z.string().trim().max(80).optional(),
      // Phiên ngắn hơn 10 câu, ví dụ kiểm tra nhanh cuối bài giảng (GĐ11). Bỏ trống là 10 câu.
      so_cau: z.number().int().min(3).max(10).optional(),
    }),
  );

  let topicId: string | null = null;
  let nguon: CauHoiNguon[];
  if (b.nguon === "cau_sai") {
    nguon = (await nguonCauSai(acc)) as unknown as CauHoiNguon[];
    if (!nguon.length) throw badRequest("Bạn chưa có câu sai nào để luyện lại.");
  } else {
    if (!b.chu_de) throw badRequest("Hãy chọn một chủ đề.");
    const t = await chuDeTheoMaHoacId(b.chu_de);
    if (!t) throw notFound("Không có chủ đề này.");
    topicId = t.id;
    nguon = (await nguonTheoChuDe(t.id)) as unknown as CauHoiNguon[];
    if (!nguon.length) throw badRequest("Chủ đề này chưa có câu hỏi nào đã duyệt.");
  }

  const lichSu = await lichSuCauCuaToi(
    acc,
    nguon.map((q) => q.id),
  );
  const seed = `${acc}|${Date.now()}|${crypto.randomUUID()}`;
  const ds = rutCauLuyenTap({ nguon, seed, lichSu, ...(b.so_cau ? { soCau: b.so_cau } : {}) });
  const { id } = await taoPhienLuyenTap({ accountId: acc, topicId, source: b.nguon, items: ds });
  return c.json({ id, tong: ds.length }, 201);
});

/** GET /v1/luyen-tap/phien/:id: đề của phiên, không có đáp án của câu chưa trả lời. */
luyenTap.get("/phien/:id", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  const p = await layPhienCuaToi(c.req.param("id"), acc);
  return c.json(await phienChoNguoiHoc(p));
});

const traLoiCau = z.object({
  chon: z.array(z.string().max(40)).max(12).optional(),
  thu_tu: z.array(z.string().max(40)).max(12).optional(),
  cap: z.record(z.string().max(40), z.string().max(40)).optional(),
  o_trong: z.record(z.string().max(4), z.string().max(200)).optional(),
});

const giayLam = z
  .number()
  .int()
  .min(0)
  .max(24 * 3600);

/**
 * POST /v1/luyen-tap/phien/:id/luu-tam: lưu câu trả lời của một câu, chưa chấm. Gọi lại bao nhiêu
 * lần cũng được tới khi kết thúc phiên; lần sau thay câu trả lời, `giay` cộng dồn. Không trả đúng/sai.
 */
luyenTap.post("/phien/:id/luu-tam", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  const p = await layPhienCuaToi(c.req.param("id"), acc);
  if (p.finished_at) throw conflict("Phiên đã kết thúc, không sửa câu trả lời được.");
  const b = await parseBody(
    c,
    z.object({ stt: z.number().int().min(1), tra_loi: traLoiCau, giay: giayLam.optional() }),
  );
  const cau = items(p)[b.stt - 1];
  if (!cau) throw badRequest(`Phiên không có câu số ${b.stt}.`);
  if ((await cauTraLoiCuaPhien(p.id)).some((a) => a.question_id === cau.question_id)) {
    throw conflict("Câu này đã được chấm, không sửa được.");
  }
  const ok = await luuBanNhap({ sessionId: p.id, stt: b.stt, traLoi: b.tra_loi, giayThem: b.giay ?? 0 });
  if (!ok) throw conflict("Phiên đã kết thúc, không sửa câu trả lời được.");
  return c.json({ stt: b.stt, da_luu: true });
});

/**
 * Chấm các câu đã lưu tạm của phiên và ghi thành câu trả lời chính thức (cập nhật câu sai, hồ sơ chủ
 * đề). Câu đã chấm trước đó và câu bỏ trống thì bỏ qua. Gọi hai lần cũng không chấm trùng.
 */
async function chamBanNhap(p: PhienLuyenTapRow, acc: string): Promise<void> {
  const nhap = banNhap(p);
  if (!Object.keys(nhap).length) return;
  const daCham = new Set((await cauTraLoiCuaPhien(p.id)).map((a) => a.question_id));
  const ds = items(p);
  for (const [stt, n] of Object.entries(nhap).sort(([a], [b]) => Number(a) - Number(b))) {
    const cau = ds[Number(stt) - 1];
    if (!cau || daCham.has(cau.question_id) || !coTraLoi(n.tra_loi)) continue;
    const traLoi = n.tra_loi as TraLoiCauHoi;
    await ghiCauTraLoi({
      sessionId: p.id,
      accountId: acc,
      questionId: cau.question_id,
      version: cau.version,
      response: traLoi,
      correct: phanHoi(cau, traLoi).dung,
      seconds: Number.isFinite(n.giay) ? n.giay : null,
      clientId: null,
      tinhCauSai: capNhatCauSai,
      topicId: cau.topic_id,
    });
  }
}

/** POST /v1/luyen-tap/phien/:id/tra-loi: chấm ngay một câu, trả đúng/sai, đáp án, giải thích, căn cứ. */
luyenTap.post("/phien/:id/tra-loi", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  const p = await layPhienCuaToi(c.req.param("id"), acc);
  if (p.finished_at) throw conflict("Phiên đã kết thúc, không trả lời thêm được.");
  const b = await parseBody(
    c,
    z.object({
      stt: z.number().int().min(1),
      tra_loi: traLoiCau,
      giay: giayLam.optional(),
      client_id: z.string().trim().min(8).max(80).optional(),
    }),
  );
  const cau = items(p)[b.stt - 1];
  if (!cau) throw badRequest(`Phiên không có câu số ${b.stt}.`);

  const ketQua = phanHoi(cau, b.tra_loi);
  const kq = await ghiCauTraLoi({
    sessionId: p.id,
    accountId: acc,
    questionId: cau.question_id,
    version: cau.version,
    response: b.tra_loi,
    correct: ketQua.dung,
    seconds: b.giay ?? null,
    clientId: b.client_id ?? null,
    tinhCauSai: capNhatCauSai,
    topicId: cau.topic_id,
  });
  if (kq === "da_tra_loi") throw conflict("Câu này đã được trả lời trong phiên, không chấm lại.");
  return c.json({ stt: b.stt, ...ketQua });
});

/** POST /v1/luyen-tap/phien/:id/ket-thuc: chấm các câu đã lưu tạm rồi chốt kết quả; gọi lại trả nguyên kết quả cũ. */
luyenTap.post("/phien/:id/ket-thuc", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  const p = await layPhienCuaToi(c.req.param("id"), acc);
  await chamBanNhap(p, acc);
  const xong = await ketThucPhien(p.id);
  return c.json({
    id: xong.id,
    dung: xong.correct,
    tong: xong.total,
    giay: xong.seconds_spent,
  });
});

/* ------------------------------------------------------------------ */
/* Offline (docs/PLAN.md GĐ13)                                         */
/* ------------------------------------------------------------------ */

function sangNoiDung(q: CauHoiNguon): NoiDungCauHoi {
  return {
    kind: q.kind,
    level: q.level,
    stem: q.stem,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation,
    citations: q.citations,
    image_uris: q.image_uris,
  };
}

/**
 * GET /v1/luyen-tap/goi-offline/:chuDe: gói câu hỏi của một chủ đề để luyện khi mất mạng.
 *
 * Gói có ĐÁP ÁN, để máy chấm được khi không có mạng. Chỉ câu đã duyệt và `offline_ok`; thi sát
 * hạch không có gói offline (A7). Kết quả làm trên máy được chấm lại ở máy chủ khi đồng bộ, nên
 * sửa đáp án trên máy không đổi được kết quả ghi nhận.
 */
luyenTap.get("/goi-offline/:chuDe", async (c) => {
  taiKhoan(await batBuocDangNhap(c));
  const t = await chuDeTheoMaHoacId(c.req.param("chuDe"));
  if (!t) throw notFound("Không có chủ đề này.");
  const cau = (await goiOfflineTheoChuDe(t.id)) as unknown as CauHoiNguon[];
  return c.json({ chu_de: t, tai_luc: new Date().toISOString(), cau });
});

const cauTraLoiOffline = z.object({
  client_id: uuid,
  question_id: uuid,
  question_version: z.number().int().min(1),
  tra_loi: z.object({
    chon: z.array(z.string().max(40)).max(12).optional(),
    thu_tu: z.array(z.string().max(40)).max(12).optional(),
    cap: z.record(z.string().max(40), z.string().max(40)).optional(),
    o_trong: z.record(z.string().max(4), z.string().max(200)).optional(),
  }),
  giay: z
    .number()
    .int()
    .min(0)
    .max(24 * 3600)
    .nullish(),
});

const phienOffline = z.object({
  client_id: uuid,
  chu_de: uuid.nullish(),
  bat_dau: z.string().datetime({ offset: true }),
  ket_thuc: z.string().datetime({ offset: true }).nullish(),
  items: z
    .array(z.object({ question_id: uuid, version: z.number().int().min(1) }))
    .min(1)
    .max(50),
  cau_tra_loi: z.array(cauTraLoiOffline).max(50).default([]),
});

/**
 * POST /v1/luyen-tap/dong-bo: gửi các phiên đã làm khi mất mạng.
 *
 * - Gửi lại bao nhiêu lần cũng không sinh bản trùng: phiên theo `client_id` của phiên, câu trả lời
 *   theo `client_id` của câu (UNIQUE trong CSDL).
 * - Máy chủ CHẤM LẠI từng câu bằng nội dung câu hỏi hiện tại, không tin kết quả chấm của máy.
 * - `client_id` đã thuộc tài khoản khác thì phiên đó bị bỏ qua, báo lỗi riêng cho phiên đó.
 */
luyenTap.post("/dong-bo", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  const b = await parseBody(c, z.object({ phien: z.array(phienOffline).min(1).max(20) }));
  const now = new Date();
  const ketQua = [];

  for (const p of b.phien) {
    const ids = [
      ...new Set([...p.items.map((i) => i.question_id), ...p.cau_tra_loi.map((a) => a.question_id)]),
    ];
    const cauHoi = new Map(
      ((await cauHoiTheoIds(ids)) as unknown as CauHoiNguon[]).map((q) => [q.id, q] as const),
    );
    const items: CauTrongPhien[] = p.items.flatMap((i) => {
      const q = cauHoi.get(i.question_id);
      if (!q) return [];
      const noiDung = sangNoiDung(q);
      return [
        {
          question_id: q.id,
          version: i.version,
          topic_id: q.topic_id,
          level: q.level,
          de: deChoNguoiHoc(noiDung),
          noi_dung: noiDung,
        },
      ];
    });
    if (!items.length) {
      ketQua.push({ client_id: p.client_id, loi: "Các câu của phiên không còn trong ngân hàng." });
      continue;
    }
    const batDau = new Date(p.bat_dau);
    const phien = await layHoacTaoPhienOffline({
      accountId: acc,
      clientId: p.client_id,
      topicId: p.chu_de ?? null,
      items,
      batDau: batDau > now ? now : batDau,
    });
    if (phien.cuaNguoiKhac) {
      ketQua.push({ client_id: p.client_id, loi: "Mã phiên đã được dùng cho tài khoản khác." });
      continue;
    }

    const trongPhien = new Set(items.map((i) => i.question_id));
    let moi = 0;
    let trung = 0;
    for (const a of p.cau_tra_loi) {
      const q = cauHoi.get(a.question_id);
      if (!q || !trongPhien.has(a.question_id)) continue;
      const kq = await ghiCauTraLoi({
        sessionId: phien.id,
        accountId: acc,
        questionId: a.question_id,
        version: a.question_version,
        response: a.tra_loi,
        correct: chamCauHoi(sangNoiDung(q), a.tra_loi as TraLoiCauHoi).dung,
        seconds: a.giay ?? null,
        clientId: a.client_id,
        tinhCauSai: capNhatCauSai,
        topicId: q.topic_id,
      });
      if (kq === "ok") moi++;
      else trung++;
    }

    if (p.ket_thuc) await ketThucPhienOffline(phien.id, new Date(p.ket_thuc), now);
    ketQua.push({
      client_id: p.client_id,
      id: phien.id,
      so_cau_moi: moi,
      so_cau_trung: trung,
      da_ket_thuc: Boolean(p.ket_thuc) || phien.daKetThuc,
    });
  }
  return c.json({ ket_qua: ketQua });
});
