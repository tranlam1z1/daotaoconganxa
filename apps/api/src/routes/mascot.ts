/**
 * API thời gian chạy của mascot (ke-hoach/09-b).
 *
 * Ba việc: chọn nhân vật cho một ngữ cảnh, chọn hành động cho một sự kiện, ghi lại kết quả.
 *
 * Hạn mức tần suất kiểm ở đây chứ không chỉ ở giao diện: trình duyệt tải lại trang ba lần
 * không được phép nhận ba lần chào. Ngoại lệ duy nhất là nhóm sự kiện pháp lý — căn cứ hết
 * hiệu lực phải báo kể cả khi người học đã bật chế độ yên lặng.
 */

import { type CheDoHoc, type KhoiNoiDung, locTheoCheDo } from "@qdpl/dao-tao";
import {
  baiHocTheoSlug,
  banGiaoDangBat,
  caiDatMascot,
  chuyenDeTheoSlug,
  danhSachHanhDong,
  danhSachNhanVat,
  ghiDanhCuaNguoiHoc,
  ghiSuKienMascot,
  hoatDongCuaBai,
  khoiCuaBai,
  maLoiLapLai,
  maLoiTheoCode,
  type PersonaRow,
  theOnCuaGhiDanh,
} from "@qdpl/db";
import {
  chonHanhDong,
  chonNhanVat,
  chonTrangPhuc,
  type HanhDong,
  KICH_HOAT,
  type KichHoat,
  lapLoTrinhDanDat,
  type NhanVat,
  type TrangPhuc,
  type TrangThai,
  thayBien,
  veMascot,
} from "@qdpl/mascot";
import { Hono } from "hono";
import { z } from "zod";
import { danhTinh } from "../auth.ts";
import { coGiongDoc } from "../giong-doc.ts";
import { asDate, badRequest, notFound, parseBody, parseQuery } from "../http.ts";
import { chuanBiDoc, docThanhTieng } from "./giong-doc.ts";

export const mascot = new Hono();

/** Chuyển bản ghi CSDL thành nhân vật của gói @qdpl/mascot. */
export function toNhanVat(r: PersonaRow): NhanVat {
  return {
    id: r.id,
    code: r.code,
    fullName: r.full_name,
    nickName: r.nick_name,
    roleLine: r.role_line,
    bio: r.bio ?? undefined,
    audiences: r.audiences,
    topics: r.topics,
    voice: r.voice as unknown as NhanVat["voice"],
    palette: r.palette as unknown as NhanVat["palette"],
    body: r.body as NhanVat["body"],
    headGear: r.head_gear,
    defaultProp: r.default_prop as NhanVat["defaultProp"],
    allowedCostumes: r.allowed_costumes as TrangPhuc[],
    characterSheet: r.character_sheet,
    enabled: r.enabled,
    isDefault: r.is_default,
    ordinal: r.ordinal,
  };
}

function toHanhDong(r: Awaited<ReturnType<typeof danhSachHanhDong>>[number]): HanhDong {
  return {
    id: r.id,
    code: r.code,
    personaId: r.persona_id,
    trigger: r.trigger as KichHoat,
    conditions: r.conditions as HanhDong["conditions"],
    priority: r.priority,
    cooldownSeconds: r.cooldown_seconds,
    maxPerSession: r.max_per_session,
    maxPerDay: r.max_per_day,
    anchor: r.anchor as HanhDong["anchor"],
    state: r.state as TrangThai,
    pose: r.pose as HanhDong["pose"],
    costume: r.costume as TrangPhuc | null,
    prop: r.prop as HanhDong["prop"],
    effect: r.effect as HanhDong["effect"],
    speech: r.speech as HanhDong["speech"],
    cta: r.cta && Object.keys(r.cta).length ? (r.cta as unknown as HanhDong["cta"]) : null,
    audiences: r.audiences,
    courseIds: r.course_ids,
    enabled: r.enabled,
  };
}

function moTaNhanVat(nv: NhanVat, costume: TrangPhuc, state: TrangThai = "binh_thuong") {
  return {
    id: nv.id,
    code: nv.code,
    fullName: nv.fullName,
    nickName: nv.nickName,
    roleLine: nv.roleLine,
    bio: nv.bio ?? null,
    palette: nv.palette,
    body: nv.body,
    headGear: nv.headGear,
    defaultProp: nv.defaultProp,
    allowedCostumes: nv.allowedCostumes,
    costume,
    voice: nv.voice,
    svg: veMascot({ persona: nv, state, costume }),
  };
}

/* ------------------------------------------------------------------ */
/* Chọn nhân vật                                                       */
/* ------------------------------------------------------------------ */

/**
 * GET /v1/mascot/dong-hanh — nhân vật nào đi cùng người học ở đây, và VÌ SAO.
 * Lý do trả về cùng kết quả: với 7 nhân vật và 6 tầng ưu tiên, không ai đoán được bằng mắt.
 */
mascot.get("/dong-hanh", async (c) => {
  const p = parseQuery(
    c,
    z.object({
      chuyenDe: z.string().trim().optional(),
      nguCanh: z.string().trim().optional(),
      trangThai: z.string().trim().optional(),
    }),
  );

  const caiDat = await caiDatMascot();
  if (!caiDat.enabled) {
    return c.json({ bat: false, nhanVat: null, lyDo: "tat_toan_he_thong" });
  }

  const [rows, banGiao] = await Promise.all([danhSachNhanVat(true), banGiaoDangBat()]);
  const nhanVat = rows.map(toNhanVat);

  const course = p.chuyenDe ? await chuyenDeTheoSlug(p.chuyenDe) : undefined;
  const principal = await danhTinh(c);
  const enrollment =
    principal?.accountId && course ? await ghiDanhCuaNguoiHoc(principal.accountId, course.id) : undefined;

  if (enrollment?.mascot_level === "tat") {
    return c.json({ bat: false, nhanVat: null, lyDo: "nguoi_hoc_tat" });
  }

  const kq = chonNhanVat({
    nhanVat,
    nguoiHocChonId: enrollment?.mascot_id ?? null,
    khoaDoi: course?.mascot_locked ?? false,
    nguCanh: p.nguCanh ?? null,
    banGiao,
    chuyenDeChiDinhId: course?.mascot_id ?? null,
    audiences: course?.audience ?? [],
    topics: [...(course?.tags ?? []), ...(course?.taxonomy_codes ?? [])],
  });

  if (!kq.nhanVat) return c.json({ bat: false, nhanVat: null, lyDo: kq.lyDo });

  const costume = chonTrangPhuc(kq.nhanVat, (course?.mascot_costume as TrangPhuc | null) ?? null);
  const trangThai = (p.trangThai ?? "binh_thuong") as TrangThai;
  return c.json({
    bat: true,
    lyDo: kq.lyDo,
    mucXuatHien: enrollment?.mascot_level ?? caiDat.default_level,
    chuyenDong: caiDat.motion,
    giongDoc: coGiongDoc(),
    nhanVat: moTaNhanVat(kq.nhanVat, costume, trangThai),
  });
});

/** GET /v1/mascot/nhan-vat — danh sách nhân vật để người học chọn. */
mascot.get("/nhan-vat", async (c) => {
  const rows = await danhSachNhanVat(true);
  return c.json({
    items: rows.map((r) => {
      const nv = toNhanVat(r);
      return moTaNhanVat(nv, chonTrangPhuc(nv), "vui");
    }),
  });
});

/**
 * GET /v1/mascot/hinh — dựng SVG một biến thể bất kỳ.
 * Dùng cho ô xem trước ở màn hình quản trị và cho ảnh tham chiếu khi sinh ảnh bằng AI.
 */
mascot.get("/hinh", async (c) => {
  const p = parseQuery(
    c,
    z.object({
      code: z.string().trim().min(1),
      trangThai: z.string().trim().default("binh_thuong"),
      trangPhuc: z.string().trim().optional(),
      tuThe: z.string().trim().optional(),
      daoCu: z.string().trim().optional(),
      hieuUng: z.string().trim().optional(),
      size: z.coerce.number().int().min(32).max(1024).optional(),
      tinh: z.coerce.boolean().optional(),
    }),
  );
  const rows = await danhSachNhanVat(false);
  const row = rows.find((r) => r.code === p.code);
  if (!row) throw notFound(`Không có nhân vật ${p.code}`);
  const nv = toNhanVat(row);
  const svg = veMascot({
    persona: nv,
    state: p.trangThai as TrangThai,
    costume: chonTrangPhuc(nv, (p.trangPhuc as TrangPhuc | undefined) ?? null),
    ...(p.tuThe ? { pose: p.tuThe as never } : {}),
    ...(p.daoCu ? { prop: p.daoCu as never } : {}),
    ...(p.hieuUng ? { effect: p.hieuUng as never } : {}),
    ...(p.size ? { size: p.size } : {}),
    ...(p.tinh ? { tinh: true } : {}),
  });
  return c.body(svg, 200, {
    "content-type": "image/svg+xml; charset=utf-8",
    // Bản dựng chỉ đổi khi dữ liệu nhân vật đổi; cache ngắn là đủ và giữ được xem trước tức thì.
    "cache-control": "public, max-age=300",
  });
});

/* ------------------------------------------------------------------ */
/* Chọn hành động                                                      */
/* ------------------------------------------------------------------ */

const phienSchema = z.object({
  trigger: z.string().trim(),
  chuyenDe: z.string().trim().optional(),
  ghiDanhId: z.string().uuid().optional(),
  nguCanh: z.string().trim().optional(),
  bien: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  phien: z
    .object({
      soLanTrongPhien: z.number().int().min(0).default(0),
      giayTuLanTruoc: z.number().int().min(0).default(99_999),
      lanChayGanNhat: z.record(z.string(), z.number()).default({}),
      soLanTrongPhienTheoCode: z.record(z.string(), z.number()).default({}),
      soLanHomNayTheoCode: z.record(z.string(), z.number()).default({}),
      daDong: z.array(z.string()).default([]),
      dangNhapLieu: z.boolean().default(false),
      nguoiHocGoi: z.boolean().default(false),
    })
    // Phiên rỗng = phiên vừa mở: chưa hiện lần nào, chưa có hành động nào đang nghỉ.
    .default({
      soLanTrongPhien: 0,
      giayTuLanTruoc: 99_999,
      lanChayGanNhat: {},
      soLanTrongPhienTheoCode: {},
      soLanHomNayTheoCode: {},
      daDong: [],
      dangNhapLieu: false,
      nguoiHocGoi: false,
    }),
});

/**
 * POST /v1/mascot/su-kien — báo một sự kiện, nhận về hành động nên chạy (hoặc im lặng).
 *
 * Im lặng là câu trả lời hợp lệ và là câu trả lời thường gặp nhất. Kèm `lyDoImLang` để
 * màn hình quản trị "diễn thử" giải thích được vì sao không thấy gì.
 */
mascot.post("/su-kien", async (c) => {
  const body = await parseBody(c, phienSchema);
  if (!(KICH_HOAT as readonly string[]).includes(body.trigger)) {
    throw badRequest(`Không có bộ kích hoạt "${body.trigger}"`);
  }
  let trigger = body.trigger as KichHoat;

  const caiDat = await caiDatMascot();
  if (!caiDat.enabled) return c.json({ hanhDong: null, lyDoImLang: "tat_toan_he_thong" });

  const [personaRows, banGiao] = await Promise.all([danhSachNhanVat(true), banGiaoDangBat()]);

  const course = body.chuyenDe ? await chuyenDeTheoSlug(body.chuyenDe) : undefined;
  const principal = await danhTinh(c);
  const enrollment =
    principal?.accountId && course ? await ghiDanhCuaNguoiHoc(principal.accountId, course.id) : undefined;

  // Bổ sung biến từ dữ liệu THẬT của người học thay vì tin số trình duyệt gửi lên.
  //
  // Hai lý do: trình duyệt không biết lịch sử làm bài của cả chuyên đề, nên nó không thể
  // tính được "đã mắc lỗi này bao nhiêu lần"; và số do trình duyệt gửi thì sửa được. Thiếu
  // bước này, hành động `sai_lap_lai` không bao giờ khớp — người học sai đi sai lại vẫn
  // không được mời làm bài vá.
  const bien: Record<string, string | number | boolean> = { ...body.bien };

  // Tên lỗi hiển thị lấy từ danh mục, không dùng mã kỹ thuật. Người học đọc "nhầm quy định
  // chuyển tiếp", không đọc "nham_chuyen_tiep".
  if (bien.ma_loi) {
    const loi = await maLoiTheoCode(String(bien.ma_loi));
    if (loi) bien.ten_loi = loi.name.charAt(0).toLowerCase() + loi.name.slice(1);
  }

  if (enrollment) {
    if (["tra_loi_sai", "sai_lap_lai"].includes(trigger)) {
      const lapLai = await maLoiLapLai(enrollment.id, 1);
      const maLoi = String(bien.ma_loi ?? "");
      const khop = maLoi ? lapLai.find((m) => m.ma_loi === maLoi) : undefined;
      const soLan = khop?.so_lan ?? (maLoi ? 0 : Math.max(0, ...lapLai.map((m) => m.so_lan)));
      bien.so_lan_cung_ma_loi = soLan;

      // Nâng cấp sự kiện khi cùng một lỗi lặp lại: trình duyệt chỉ biết "vừa trả lời sai",
      // còn việc đây là lần thứ mấy mắc CÙNG một lỗi thì chỉ máy chủ biết. Không có bước
      // này, hành động `sai_lap_lai` — lời mời làm bài vá — không bao giờ chạy được.
      if (trigger === "tra_loi_sai" && soLan > 1) trigger = "sai_lap_lai";
    }
    if (trigger === "den_han_on_tap") {
      const homNay = new Date().toISOString().slice(0, 10);
      const the = await theOnCuaGhiDanh(enrollment.id);
      bien.so_the_den_han = the.filter((t) => !t.suspended && (asDate(t.due_on) ?? "") <= homNay).length;
      bien.so_the = bien.so_the_den_han;
    }
  }

  // Nạp hành động SAU khi `trigger` đã chốt: bước nâng cấp ở trên có thể đã đổi sự kiện.
  const actionRows = await danhSachHanhDong({ trigger, chiBat: true });

  const kq = chonHanhDong(
    trigger,
    actionRows.map(toHanhDong),
    {
      bien,
      ...(course?.audience?.[0] ? { audience: course.audience[0] } : {}),
      ...(course?.id ? { courseId: course.id } : {}),
      mucXuatHien: (enrollment?.mascot_level ?? caiDat.default_level) as never,
      ...body.phien,
    },
    { maxPerSession: caiDat.max_per_session, minGapSeconds: caiDat.min_gap_seconds },
  );

  if (!kq.hanhDong || !kq.loiThoai) {
    return c.json({ hanhDong: null, lyDoImLang: kq.lyDoImLang ?? "khong_co_hanh_dong" });
  }

  const nhanVat = personaRows.map(toNhanVat);
  // Hành động khai nhân vật cố định thì dùng nhân vật đó (Cân Nhắc chủ trì bài đánh giá);
  // không khai thì theo định tuyến chung.
  const chon = kq.hanhDong.personaId
    ? {
        nhanVat: nhanVat.find((n) => n.id === kq.hanhDong!.personaId) ?? null,
        lyDo: "hanh_dong_chi_dinh" as const,
      }
    : chonNhanVat({
        nhanVat,
        nguoiHocChonId: enrollment?.mascot_id ?? null,
        khoaDoi: course?.mascot_locked ?? false,
        nguCanh: body.nguCanh ?? null,
        banGiao,
        chuyenDeChiDinhId: course?.mascot_id ?? null,
        audiences: course?.audience ?? [],
        topics: [...(course?.tags ?? []), ...(course?.taxonomy_codes ?? [])],
      });

  if (!chon.nhanVat) return c.json({ hanhDong: null, lyDoImLang: "khong_co_nhan_vat" });

  const costume = chonTrangPhuc(
    chon.nhanVat,
    kq.hanhDong.costume ?? (course?.mascot_costume as TrangPhuc | null) ?? null,
  );

  await ghiSuKienMascot({
    enrollmentId: enrollment?.id ?? body.ghiDanhId ?? null,
    actionId: kq.hanhDong.id,
    personaId: chon.nhanVat.id,
    trigger,
    outcome: "hien",
  });

  return c.json({
    hanhDong: {
      code: kq.hanhDong.code,
      actionId: kq.hanhDong.id,
      anchor: kq.hanhDong.anchor,
      state: kq.hanhDong.state,
      pose: kq.hanhDong.pose,
      prop: kq.hanhDong.prop ?? chon.nhanVat.defaultProp,
      effect: kq.hanhDong.effect,
      costume,
      // Lời thoại đã thay biến của phiên học; loại lời quyết định cách giao diện render nó.
      loiThoai: {
        text: thayBien(kq.loiThoai.text, bien),
        loai: kq.loiThoai.loai ?? "loi_dan",
        citations: kq.loiThoai.citations ?? [],
      },
      cta: kq.hanhDong.cta,
    },
    nhanVat: moTaNhanVat(chon.nhanVat, costume, kq.hanhDong.state),
    lyDoChon: chon.lyDo,
    chuyenDong: caiDat.motion,
  });
});

/**
 * Bí danh cũ của /v1/giong-doc (docs/PLAN.md GĐ14): cùng handler, cùng yêu cầu đăng nhập, hạn
 * mức tính theo tài khoản. Giữ để lời gọi cũ không gãy.
 */
mascot.post("/giong-doc", docThanhTieng);
mascot.post("/giong-doc/chuan-bi", chuanBiDoc);

/** POST /v1/mascot/phan-hoi — người học bấm, đóng, bỏ qua hoặc tắt hẳn mascot. */
mascot.post("/phan-hoi", async (c) => {
  const body = await parseBody(
    c,
    z.object({
      actionId: z.string().uuid().optional(),
      personaId: z.string().uuid().optional(),
      ghiDanhId: z.string().uuid().optional(),
      trigger: z.string().trim(),
      ketQua: z.enum(["hien", "bam_cta", "dong", "bo_qua", "tat_mascot"]),
    }),
  );
  await ghiSuKienMascot({
    enrollmentId: body.ghiDanhId ?? null,
    actionId: body.actionId ?? null,
    personaId: body.personaId ?? null,
    trigger: body.trigger,
    outcome: body.ketQua,
  });
  return c.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Dẫn dắt bài học                                                     */
/* ------------------------------------------------------------------ */

/**
 * GET /v1/mascot/dan-dat — lộ trình gia sư dẫn người học đi hết một bài (09-b §7).
 *
 * Dựng ở máy chủ vì lộ trình phụ thuộc cấu trúc khối của bài. Lời dẫn là lời ĐIỀU HƯỚNG,
 * không phải nội dung pháp lý: nó nói khối nào là căn cứ và cần làm gì với khối đó, không
 * diễn giải chính quy định.
 */
mascot.get("/dan-dat", async (c) => {
  const p = parseQuery(
    c,
    z.object({
      chuyenDe: z.string().trim().min(1),
      bai: z.string().trim().min(1),
      cheDo: z.enum(["day_du", "nhanh", "tra_cuu", "on_thi"]).optional(),
    }),
  );

  const course = await chuyenDeTheoSlug(p.chuyenDe);
  if (course?.status !== "xuat_ban") throw notFound("Không tìm thấy chuyên đề");
  const bai = await baiHocTheoSlug(course.id, p.bai);
  if (bai?.status !== "xuat_ban") throw notFound("Bài học chưa xuất bản");

  // Chế độ chọn đúng như trang bài học (routes/dao-tao.ts): lộ trình chỉ được đi qua các khối
  // người học đang thấy, nếu không bước dẫn dắt sẽ trỏ tới khối đã bị lọc khỏi trang.
  const principal = await danhTinh(c);
  const enrollment = principal?.accountId
    ? await ghiDanhCuaNguoiHoc(principal.accountId, course.id)
    : undefined;
  const cheDo = (p.cheDo ?? enrollment?.mode ?? course.default_mode) as CheDoHoc;

  const [khoiRows, hoatDong, rows] = await Promise.all([
    khoiCuaBai(bai.id),
    hoatDongCuaBai(bai.id),
    danhSachNhanVat(true),
  ]);
  const khoi = locTheoCheDo(
    khoiRows.map((k) => ({ id: k.id, kind: k.kind as KhoiNoiDung["kind"], modes: k.modes as CheDoHoc[] })),
    cheDo,
  );

  const nhanVat = rows.map(toNhanVat);
  const chon = chonNhanVat({
    nhanVat,
    chuyenDeChiDinhId: course.mascot_id,
    audiences: course.audience,
    topics: [...course.tags, ...course.taxonomy_codes],
  });

  return c.json({
    buoc: lapLoTrinhDanDat(
      khoi.map((k, i) => ({ id: k.id, ordinal: i + 1, kind: k.kind })),
      {
        tenNhanVat: chon.nhanVat?.fullName ?? "Trợ lý",
        vaiNhanVat: chon.nhanVat?.roleLine ?? "",
        tieuDeBai: bai.title,
        soPhut: bai.estimated_minutes,
        soBaiTap: hoatDong.length,
        canCuHong: bai.citation_health !== "ok",
      },
    ),
  });
});
