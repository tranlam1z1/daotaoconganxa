/**
 * API lượt chơi trên khung trò chơi chung (docs/PLAN.md GĐ-G0, docs/GAME_DESIGN.md §2.9), gắn ở
 * /v1/luot-choi.
 *
 * Chốt bảo mật (giữ như GĐ0):
 *  - Mọi route cần đăng nhập, trừ /danh-muc (chỉ mã và tên trò đang bật, cho trang chủ của khách);
 *    người chơi lấy từ phiên đăng nhập, không bao giờ từ body.
 *  - Lượt chỉ chủ lượt đọc, trả lời, kết thúc được (người khác nhận 403).
 *  - Chấm trên máy chủ bằng ảnh chụp các bước trong CSDL. Máy khách chỉ gửi lựa chọn; điểm, đúng/sai,
 *    thời gian do máy khách gửi (nếu có) đều bị bỏ qua. Giờ tính theo lúc máy chủ gửi đề.
 *  - Đề gửi đi không có đáp án; đáp án, giải thích, căn cứ chỉ có trong phản hồi SAU khi bước đã chấm.
 *  - Mỗi bước chấm một lần (409 khi gửi lại); XP mỗi lượt cộng một lần.
 *  - Đồng bộ offline: máy chủ sinh lại lượt từ gói đã cấp cho CHÍNH người đó và seed của lượt, rồi
 *    chấm lại từng bước. Trùng client_id thì bỏ qua.
 *  - Màn chơi (GĐ-T1): trò có màn chỉ chơi được màn đã mở của chính người gọi (tính từ game_level_progress);
 *    giờ và XP cơ bản của lượt theo màn đã ghi trong lượt, không theo số máy khách gửi.
 */

import type { Principal } from "@qdpl/auth";
import {
  type BuocLuot,
  buocHienTai,
  chamBuocCoGio,
  conLaiBuocMs,
  conNhanTheoHanLuot,
  dinhNghiaTheoMan,
  type KetQuaBuoc,
  layTroChoi,
  manCua,
  manDangMo,
  manMacDinh,
  moDuocMan,
  ngayVietNam,
  type TroChoiBatKy,
  taoRng,
  tongKetLuot,
} from "@qdpl/dao-tao";
import {
  type BuocDaChoiRow,
  buocDaChoi,
  danhSachTroChoiDb,
  donLuotBoDo,
  ghiBuoc,
  goiTroChoi,
  ketThucLuot,
  type LuotChoiRow,
  layHoacTaoLuotOffline,
  layNguonTroChoi,
  lichSuLuotChoi,
  luotChoi,
  moBuoc,
  SO_NGAY_HAN_GOI,
  saoTheoMan,
  taoGoiTroChoi,
  taoLuotChoi,
  thongKeTroChoiCuaToi,
  trangThaiCauHoi,
  troChoiTheoMa,
} from "@qdpl/db";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { batBuocDangNhap } from "../auth.ts";
import { badRequest, conflict, notFound, parseBody } from "../http.ts";

export const luotChoiRoute = new Hono();

const uuid = z.string().uuid();

function taiKhoan(p: Principal): string {
  if (!p.accountId) throw badRequest("Phiên đăng nhập không gắn với tài khoản nào.");
  return p.accountId;
}

function khongPhaiCuaBan(): HTTPException {
  return new HTTPException(403, { message: "Lượt chơi này không phải của bạn." });
}

/** Các màn của trò kèm trạng thái mở và số sao tốt nhất của người chơi (trò có màn, GĐ-T1). */
async function manCuaToi(dn: TroChoiBatKy, acc: string) {
  if (!dn.manChoi?.length) return null;
  const sao = await saoTheoMan(acc, dn.ma);
  const mo = new Set(manDangMo(dn.manChoi.length, sao));
  return dn.manChoi.map((m) => ({
    so: m.so,
    ten: m.ten,
    mo_ta: m.moTa,
    giay_ca_luot: m.caLuotMs ? m.caLuotMs / 1000 : null,
    da_mo: mo.has(m.so),
    sao: sao.get(m.so) ?? 0,
  }));
}

/** Màn chơi được của người gọi: màn đã chọn (phải đang mở) hoặc màn mặc định. Trò không có màn: null. */
async function manDuocChoi(dn: TroChoiBatKy, acc: string, chon: number | undefined): Promise<number | null> {
  if (!dn.manChoi?.length) return null;
  const sao = await saoTheoMan(acc, dn.ma);
  if (chon === undefined) return manMacDinh(dn.manChoi.length, sao);
  if (!moDuocMan(chon, dn.manChoi.length, sao)) throw conflict("Màn này chưa mở. Hãy qua màn trước đó.");
  return chon;
}

/** Trò đang bật, chạy trên khung chung và có định nghĩa trong mã. */
async function troChoiChoiDuoc(ma: string): Promise<{ dn: TroChoiBatKy; ten: string; offline: boolean }> {
  const g = await troChoiTheoMa(ma);
  const dn = layTroChoi(ma);
  if (!g?.enabled || g.engine !== "luot_choi" || !dn) throw notFound("Không có trò chơi này.");
  return { dn, ten: g.name, offline: g.offline_ok && dn.offline };
}

/** Nguồn nội dung đã duyệt của một trò. G0 chỉ có câu hỏi ngân hàng. */
async function nguonNoiDung(dn: TroChoiBatKy, chiOffline = false): Promise<unknown[]> {
  // Bảng nguồn ở packages/db/src/nguon-tro-choi.ts (GĐ-G2); dữ liệu theo ngày lấy tại hôm nay.
  return dn.locNguon(await layNguonTroChoi(dn.nguon, { chiOffline, ngay: ngayVietNam() }));
}

async function layLuotCuaToi(id: string, acc: string): Promise<LuotChoiRow> {
  if (!uuid.safeParse(id).success) throw notFound("Không có lượt chơi này.");
  const l = await luotChoi(id);
  if (!l) throw notFound("Không có lượt chơi này.");
  if (l.account_id !== acc) throw khongPhaiCuaBan();
  return l;
}

/** Kết quả chấm gửi cho người chơi, dựng lại từ bước đã ghi (để xem lại lượt). */
function ketQuaDaGhi(dn: TroChoiBatKy, b: BuocLuot, r: BuocDaChoiRow, offline: boolean) {
  const goc = dn.chamBuoc(b, r.response, { thoiGianMs: r.elapsed_ms, offline });
  return {
    diem: r.points,
    thuong: r.bonus,
    diem_toi_da: r.max_points,
    dung: r.correct,
    het_gio: r.timed_out,
    thoi_gian_ms: r.elapsed_ms,
    giai_thich: goc.giaiThich,
    can_cu: goc.canCu,
    chi_tiet: goc.chiTiet ?? null,
  };
}

function ketQuaMoi(kq: KetQuaBuoc) {
  return {
    diem: kq.diem,
    thuong: kq.thuong,
    diem_toi_da: kq.diemToiDa,
    dung: kq.dung,
    het_gio: kq.hetGio,
    thoi_gian_ms: kq.thoiGianMs,
    giai_thich: kq.giaiThich,
    can_cu: kq.canCu,
    chi_tiet: kq.chiTiet ?? null,
  };
}

/**
 * Lượt dạng gửi cho người chơi. Bước đã trả lời: đề, câu trả lời, kết quả. Bước hiện tại: chỉ đề
 * và thời gian còn lại (mở bước ghi lúc máy chủ gửi đề). Các bước sau: không gửi gì.
 */
async function luotChoNguoiChoi(l: LuotChoiRow, dn: TroChoiBatKy, ten: string, now: Date) {
  const daGhi = await buocDaChoi(l.id);
  const theoThuTu = new Map(daGhi.map((r) => [r.ordinal, r]));
  const items = l.items;
  const dangChoi = l.status === "dang_choi";
  const hienTai = dangChoi ? buocHienTai(items.length, new Set(theoThuTu.keys())) : null;

  let buoc_hien_tai: Record<string, unknown> | null = null;
  if (hienTai !== null) {
    const b = items[hienTai - 1]!;
    const moLuc = await moBuoc(l.id, hienTai, now);
    buoc_hien_tai = {
      thu_tu: hienTai,
      de: dn.deChoNguoiChoi(b),
      thoi_gian_ms: dn.thoiGian?.moiBuocMs ?? null,
      con_lai_ms: conLaiBuocMs(dn, moLuc, now),
    };
  }

  const tk = tongKetLuot(
    daGhi.map((r) => ({ diem: r.points, thuong: r.bonus, dung: r.correct })),
    items,
  );
  const man = manCua(dn, l.level);
  const caLuotMs = dn.thoiGian?.caLuotMs ?? null;
  return {
    id: l.id,
    ma: l.game_code,
    ten,
    man: man ? { so: man.so, ten: man.ten, mo_ta: man.moTa, so_man: dn.manChoi?.length ?? 1 } : null,
    ca_luot_ms: caLuotMs,
    con_lai_luot_ms: dangChoi && l.deadline_at ? Math.max(0, l.deadline_at.getTime() - now.getTime()) : null,
    trang_thai: l.status,
    offline: l.offline,
    bat_dau: l.started_at,
    ket_thuc: l.finished_at,
    so_buoc: items.length,
    han_luot: l.deadline_at,
    buoc_hien_tai,
    da_choi: daGhi.map((r) => {
      const b = items[r.ordinal - 1]!;
      return {
        thu_tu: r.ordinal,
        de: dn.deChoNguoiChoi(b),
        tra_loi: r.response,
        ket_qua: ketQuaDaGhi(dn, b, r, l.offline),
      };
    }),
    tong_ket: dangChoi
      ? null
      : {
          diem: tk.diem,
          thuong: tk.thuong,
          diem_toi_da: tk.diemToiDa,
          ty_le: tk.tyLe,
          sao: l.stars ?? tk.sao,
          so_dung: tk.soDung,
          xp: l.xp ?? 0,
        },
  };
}

/* ------------------------------------------------------------------ */
/* Danh sách, bắt đầu                                                  */
/* ------------------------------------------------------------------ */

/** GET /v1/luot-choi: trò đang bật trên khung chung, thống kê của tôi, lượt đang chơi dở, lượt gần đây. */
luotChoiRoute.get("/", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  await donLuotBoDo(acc);
  const [games, tk, ganDay] = await Promise.all([
    danhSachTroChoiDb({ chiDangBat: true }),
    thongKeTroChoiCuaToi(acc),
    lichSuLuotChoi(acc, 10),
  ]);
  const dsKhung = games.filter((g) => g.engine === "luot_choi" && layTroChoi(g.code));
  const manTheoTro = new Map(
    await Promise.all(dsKhung.map(async (g) => [g.code, await manCuaToi(layTroChoi(g.code)!, acc)] as const)),
  );
  return c.json({
    tro_choi: dsKhung.map((g) => {
      const dn = layTroChoi(g.code)!;
      return {
        man: manTheoTro.get(g.code) ?? null,
        ma: g.code,
        ten: g.name,
        mo_ta: g.description ?? dn.moTa,
        offline: g.offline_ok && dn.offline,
        so_buoc: dn.soBuoc,
        giay_moi_buoc: dn.thoiGian?.moiBuocMs ? dn.thoiGian.moiBuocMs / 1000 : null,
        hom_nay: tk.get(g.code)?.hom_nay ?? 0,
        tot_nhat: tk.get(g.code)?.tot_nhat ?? null,
        sao_tot_nhat: tk.get(g.code)?.sao_tot_nhat ?? null,
      };
    }),
    // Trò của GĐ10–GĐ14 vẫn chạy trên API cũ; trang Trò chơi dùng danh sách này để ẩn hiện thẻ.
    tro_choi_cu: games.filter((g) => g.engine === "cu").map((g) => g.code),
    dang_choi: ganDay.find((l) => l.status === "dang_choi" && !l.offline) ?? null,
    gan_day: ganDay.filter((l) => l.status !== "dang_choi"),
  });
});

/**
 * GET /v1/luot-choi/danh-muc: danh mục trò đang bật, không cần đăng nhập. Trang chủ hiện cho khách
 * xem, bấm vào trò thì đưa đi đăng nhập. Chỉ mã, tên, mô tả và trò có màn hay không: không có thống kê,
 * nội dung.
 */
luotChoiRoute.get("/danh-muc", async (c) => {
  const games = await danhSachTroChoiDb({ chiDangBat: true });
  return c.json({
    tro_choi: games
      .filter((g) => g.engine === "luot_choi" && layTroChoi(g.code))
      .map((g) => {
        const dn = layTroChoi(g.code)!;
        return { ma: g.code, ten: g.name, mo_ta: g.description ?? dn.moTa, man: Boolean(dn.manChoi?.length) };
      }),
    tro_choi_cu: games.filter((g) => g.engine === "cu").map((g) => g.code),
  });
});

/** GET /v1/luot-choi/lich-su: 20 lượt gần nhất của tôi. */
luotChoiRoute.get("/lich-su", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  return c.json({ items: await lichSuLuotChoi(acc, 20) });
});

/** POST /v1/luot-choi/:ma/bat-dau: tạo lượt từ nội dung đã duyệt; trả lượt với đề bước 1. */
luotChoiRoute.post("/:ma/bat-dau", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  const { dn: dnGoc, ten } = await troChoiChoiDuoc(c.req.param("ma"));
  // Thân yêu cầu có thể rỗng (nút "Chơi" một chạm); `man` chỉ có nghĩa với trò có màn.
  const raw = await c.req.json().catch(() => ({}));
  const yc = z.object({ man: z.number().int().min(1).max(50).optional() }).safeParse(raw ?? {});
  if (!yc.success) throw badRequest("Số màn không hợp lệ.");
  const man = await manDuocChoi(dnGoc, acc, yc.data.man);
  const dn = dinhNghiaTheoMan(dnGoc, man);
  const nguon = await nguonNoiDung(dn);
  if (nguon.length < dn.soBuoc) {
    throw badRequest(`Chưa đủ nội dung đã duyệt để chơi: cần ${dn.soBuoc}, mới có ${nguon.length}.`);
  }
  const seed = crypto.randomUUID();
  const items = man === null ? dn.taoLuot(nguon, taoRng(seed)) : dn.taoLuot(nguon, taoRng(seed), man);
  if (man !== null && items.length < dn.soBuoc) {
    throw badRequest(`Chưa đủ nội dung đã duyệt cho màn ${man}: cần ${dn.soBuoc}, mới có ${items.length}.`);
  }
  const caLuotMs = dn.thoiGian?.caLuotMs;
  const now = new Date();
  const l = await taoLuotChoi({
    gameCode: dn.ma,
    accountId: acc,
    seed,
    items,
    deadlineAt: caLuotMs ? new Date(now.getTime() + caLuotMs) : null,
    level: man,
  });
  return c.json(await luotChoNguoiChoi(l, dn, ten, now), 201);
});

/* ------------------------------------------------------------------ */
/* Chơi                                                                */
/* ------------------------------------------------------------------ */

async function dinhNghiaCuaLuot(l: LuotChoiRow): Promise<{ dn: TroChoiBatKy; ten: string }> {
  const dn = layTroChoi(l.game_code);
  if (!dn) throw notFound("Trò chơi của lượt này không còn.");
  const g = await troChoiTheoMa(l.game_code);
  // Giờ và XP cơ bản theo màn đã ghi trong lượt (trò có màn).
  return { dn: dinhNghiaTheoMan(dn, l.level), ten: g?.name ?? dn.ten };
}

/** Hết hạn cả lượt (trò có giờ cả lượt): tự kết thúc với trạng thái hết giờ. */
async function tuKetThucNeuHetGio(l: LuotChoiRow, dn: TroChoiBatKy, now: Date): Promise<LuotChoiRow> {
  if (l.status !== "dang_choi" || conNhanTheoHanLuot(l.deadline_at, now)) return l;
  return (await ketThucLuot(l.id, { xpCoBan: dn.xpCoBan, trangThai: "het_gio", now })).luot;
}

/** GET /v1/luot-choi/luot/:id: lượt của tôi; đang chơi thì kèm đề bước hiện tại. */
luotChoiRoute.get("/luot/:id", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  let l = await layLuotCuaToi(c.req.param("id"), acc);
  const { dn, ten } = await dinhNghiaCuaLuot(l);
  const now = new Date();
  l = await tuKetThucNeuHetGio(l, dn, now);
  return c.json(await luotChoNguoiChoi(l, dn, ten, now));
});

/**
 * POST /v1/luot-choi/luot/:id/buoc/:thuTu: trả lời bước hiện tại. Chấm trên máy chủ, trả kết quả
 * kèm giải thích và căn cứ. KHÔNG trả đề bước sau: đồng hồ bước sau chỉ chạy khi người chơi mở nó.
 */
luotChoiRoute.post("/luot/:id/buoc/:thuTu", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  let l = await layLuotCuaToi(c.req.param("id"), acc);
  const { dn } = await dinhNghiaCuaLuot(l);
  const now = new Date();
  l = await tuKetThucNeuHetGio(l, dn, now);
  if (l.status !== "dang_choi") throw conflict("Lượt chơi đã kết thúc, không trả lời thêm được.");

  const thuTu = Number(c.req.param("thuTu"));
  const b = await parseBody(c, z.object({ tra_loi: z.unknown(), client_id: uuid.optional() }));
  const daGhi = new Set((await buocDaChoi(l.id)).map((r) => r.ordinal));
  if (!Number.isInteger(thuTu) || thuTu < 1 || thuTu > l.items.length) {
    throw badRequest(`Lượt không có bước số ${c.req.param("thuTu")}.`);
  }
  if (daGhi.has(thuTu)) throw conflict("Bước này đã được trả lời, không chấm lại.");
  if (buocHienTai(l.items.length, daGhi) !== thuTu) throw conflict("Hãy trả lời các bước theo thứ tự.");

  const traLoi = dn.docTraLoi(b.tra_loi);
  if (traLoi === null) throw badRequest("Câu trả lời không đúng dạng của trò chơi này.");
  const buoc = l.items[thuTu - 1]!;
  // Bước chưa từng được gửi đề (không qua GET) thì tính là mở ngay lúc này.
  const moLuc = await moBuoc(l.id, thuTu, now);
  const kq = chamBuocCoGio(dn, buoc, traLoi, { moLuc, luc: now, offline: false });
  const ghi = await ghiBuoc({
    runId: l.id,
    accountId: acc,
    buoc,
    moLuc,
    traLoiLuc: now,
    thoiGianMs: kq.thoiGianMs,
    response: traLoi,
    dung: kq.dung,
    diem: kq.diem,
    thuong: kq.thuong,
    hetGio: kq.hetGio,
    clientId: b.client_id ?? null,
  });
  if (ghi === "da_tra_loi") throw conflict("Bước này đã được trả lời, không chấm lại.");
  if (ghi === "luot_da_xong") throw conflict("Lượt chơi đã kết thúc, không trả lời thêm được.");
  return c.json({
    thu_tu: thuTu,
    ket_qua: ketQuaMoi(kq),
    con_buoc: buocHienTai(l.items.length, new Set([...daGhi, thuTu])) !== null,
  });
});

/**
 * POST /v1/luot-choi/luot/:id/ket-thuc: tổng kết, cộng XP. Gọi lại trả nguyên tổng kết, không cộng
 * XP lần hai. Kết thúc sớm được: bước chưa trả lời tính 0 điểm.
 */
luotChoiRoute.post("/luot/:id/ket-thuc", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  const l = await layLuotCuaToi(c.req.param("id"), acc);
  const { dn, ten } = await dinhNghiaCuaLuot(l);
  const now = new Date();
  const het = !conNhanTheoHanLuot(l.deadline_at, now);
  const { luot } = await ketThucLuot(l.id, { xpCoBan: dn.xpCoBan, trangThai: het ? "het_gio" : "xong", now });
  return c.json(await luotChoNguoiChoi(luot, dn, ten, now));
});

/* ------------------------------------------------------------------ */
/* Offline                                                             */
/* ------------------------------------------------------------------ */

/** Số nội dung tối đa của một gói, để tải nhanh trên mạng yếu. */
const SO_MUC_GOI_TOI_DA = 60;

/**
 * GET /v1/luot-choi/goi-offline/:ma: gói nội dung đã duyệt KÈM ĐÁP ÁN để chơi khi mất mạng.
 * Gói được ghi lại theo người nhận; khi đồng bộ, máy chủ chỉ nhận lượt dựng từ gói của chính người đó.
 */
luotChoiRoute.get("/goi-offline/:ma", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  const { dn, ten, offline } = await troChoiChoiDuoc(c.req.param("ma"));
  if (!offline) throw badRequest("Trò chơi này không chơi được khi mất mạng.");
  const nguon = (await nguonNoiDung(dn, true)).slice(0, SO_MUC_GOI_TOI_DA);
  if (nguon.length < dn.soBuoc) throw badRequest("Chưa đủ nội dung được phép dùng offline cho trò chơi này.");
  const goi = await taoGoiTroChoi({ accountId: acc, gameCode: dn.ma, items: nguon });
  return c.json({
    goi_id: goi.id,
    ma: dn.ma,
    ten,
    // Màn đang mở lúc tải gói (trò có màn). Khi đồng bộ, máy chủ kiểm lại theo tiến độ hiện tại.
    man: await manCuaToi(dn, acc),
    tai_luc: goi.issued_at,
    het_han: goi.expires_at,
    nguon: goi.items,
  });
});

const luotOffline = z.object({
  client_id: uuid,
  ma: z.string().trim().min(2).max(40),
  goi_id: uuid,
  seed: z.string().trim().min(8).max(80),
  man: z.number().int().min(1).max(50).nullish(),
  bat_dau: z.string().datetime({ offset: true }),
  ket_thuc: z.string().datetime({ offset: true }).nullish(),
  buoc: z
    .array(
      z.object({
        client_id: uuid,
        thu_tu: z.number().int().min(1).max(100),
        tra_loi: z.unknown(),
        luc: z.string().datetime({ offset: true }).nullish(),
      }),
    )
    .max(100)
    .default([]),
});

/**
 * POST /v1/luot-choi/dong-bo: gửi các lượt đã chơi khi mất mạng.
 *
 * - Lượt dựng lại từ gói (của chính người gọi, đúng trò) và seed: máy khách không gửi nội dung hay
 *   đáp án nào, chỉ gửi lựa chọn. Máy chủ chấm lại từng bước, không có thưởng nhanh.
 * - Gửi lại bao nhiêu lần cũng không trùng: lượt theo `client_id` của lượt, bước theo `client_id` của
 *   bước; lượt chỉ kết thúc và cộng XP một lần.
 * - Chơi sau hạn gói: bỏ qua lượt. Nội dung đã bị gỡ duyệt trước khi đồng bộ: vẫn lưu, bước đó 0 điểm.
 * - XP theo thời điểm chơi thật, trong 7 ngày (như luyện tập offline GĐ13).
 */
luotChoiRoute.post("/dong-bo", async (c) => {
  const acc = taiKhoan(await batBuocDangNhap(c));
  const b = await parseBody(c, z.object({ luot: z.array(luotOffline).min(1).max(20) }));
  const now = new Date();
  const ketQua = [];

  for (const p of b.luot) {
    const loi = (thongBao: string) => ketQua.push({ client_id: p.client_id, loi: thongBao });
    const dn = layTroChoi(p.ma);
    const goi = await goiTroChoi(p.goi_id);
    if (!dn || !goi || goi.account_id !== acc || goi.game_code !== p.ma) {
      loi("Gói nội dung không hợp lệ cho tài khoản này.");
      continue;
    }
    const batDau = new Date(p.bat_dau);
    if (batDau > new Date(goi.expires_at.getTime() + 60_000)) {
      loi(`Lượt chơi sau khi gói hết hạn (${SO_NGAY_HAN_GOI} ngày). Hãy tải lại gói.`);
      continue;
    }
    if (batDau < new Date(goi.issued_at.getTime() - 5 * 60_000)) {
      loi("Thời điểm bắt đầu trước khi tải gói.");
      continue;
    }
    let man: number | null = null;
    if (dn.manChoi?.length) {
      const sao = await saoTheoMan(acc, dn.ma);
      man = p.man ?? manMacDinh(dn.manChoi.length, sao);
      if (!moDuocMan(man, dn.manChoi.length, sao)) {
        loi("Màn của lượt chưa mở với tài khoản này.");
        continue;
      }
    }
    const dnMan = dinhNghiaTheoMan(dn, man);
    const items =
      man === null ? dn.taoLuot(goi.items, taoRng(p.seed)) : dn.taoLuot(goi.items, taoRng(p.seed), man);
    const luot = await layHoacTaoLuotOffline({
      accountId: acc,
      gameCode: p.ma,
      clientId: p.client_id,
      packId: goi.id,
      seed: p.seed,
      items,
      batDau: batDau > now ? now : batDau,
      level: man,
    });
    if (luot.cuaNguoiKhac) {
      loi("Mã lượt đã được dùng cho tài khoản khác.");
      continue;
    }

    // Nội dung bị gỡ duyệt sau khi tải gói: vẫn lưu câu trả lời nhưng bước đó không có điểm.
    const trangThai = await trangThaiCauHoi(
      items.filter((i) => i.ref_kind === "question" && i.ref_id).map((i) => i.ref_id!),
    );
    let moi = 0;
    let trung = 0;
    for (const a of p.buoc) {
      const buoc = items[a.thu_tu - 1];
      const traLoi = buoc ? dn.docTraLoi(a.tra_loi) : null;
      if (!buoc || traLoi === null) continue;
      const kq = chamBuocCoGio(dnMan, buoc, traLoi, { moLuc: null, luc: now, offline: true });
      const goDuyet = buoc.ref_kind === "question" && trangThai.get(buoc.ref_id!)?.status !== "da_duyet";
      const traLoiLuc = a.luc ? new Date(a.luc) : batDau;
      const ghi = await ghiBuoc({
        runId: luot.id,
        accountId: acc,
        buoc,
        moLuc: null,
        traLoiLuc: traLoiLuc > now ? now : traLoiLuc,
        thoiGianMs: null,
        response: traLoi,
        dung: kq.dung,
        diem: goDuyet ? 0 : kq.diem,
        thuong: 0,
        hetGio: false,
        clientId: a.client_id,
      });
      if (ghi === "ok") moi++;
      else trung++;
    }

    let xp = 0;
    let daKetThuc = luot.daKetThuc;
    if (p.ket_thuc && !luot.daKetThuc) {
      const kt = await ketThucLuot(luot.id, { xpCoBan: dnMan.xpCoBan, luc: new Date(p.ket_thuc), now });
      if (kt.moiKetThuc) xp = kt.luot.xp ?? 0;
      daKetThuc = true;
    }
    ketQua.push({
      client_id: p.client_id,
      id: luot.id,
      so_buoc_moi: moi,
      so_buoc_trung: trung,
      da_ket_thuc: daKetThuc,
      xp,
    });
  }
  return c.json({ ket_qua: ketQua });
});
