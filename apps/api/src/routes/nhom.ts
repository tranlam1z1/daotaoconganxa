/**
 * Nhóm học cùng cho người học (docs/PLAN.md GĐ16a, docs/PROMPT_NHOM_HOC_CUNG.md mục 2.5), gắn ở
 * /v1/nhom. Cần đăng nhập, vai trò `can_bo` trở lên.
 *
 * Ranh giới:
 *  - Người không đang ở trong nhóm (kể cả quản lý) gọi `/:id...` nhận 404, không lộ nhóm có tồn tại.
 *  - Nhóm đã lưu trữ chỉ còn xem được: mọi thao tác ghi nhận 409.
 *  - Mọi đầu vào kiểm bằng zod `.strict()`: khóa lạ (ví dụ `phan_tram`) bị từ chối. Tiến độ chỉ
 *    tính ở máy chủ từ dữ liệu gốc; không route nào nhận phần trăm.
 *  - Phản hồi cho thành viên chỉ có phần trăm, không có điểm, số câu đúng, số lần làm.
 *  - Sai mã mời quá 10 lần trong 15 phút, bấm cổ vũ quá 60 lần mỗi phút: 429.
 *
 * Quản lý xem nhóm (docs/PLAN.md GĐ16c) ở `quanTriNhomRoute`, gắn tại /v1/quan-tri/nhom.
 */
import type { Principal } from "@qdpl/auth";
import {
  type BangMa,
  CANH_BAO_TOM_TAT,
  GIOI_HAN_AI_NHOM,
  GIOI_HAN_NHOM,
  type HauKiemAiNhom,
  hauKiemGoiYThuTu,
  hauKiemTomTat,
  nhanLuotTrongCuaSo,
  PROMPT_GOI_Y_THU_TU,
  PROMPT_TOM_TAT_TIEN_DO,
  THONG_BAO_CHUA_BAT_AI,
  THONG_BAO_KHONG_GOI_Y,
  thayMa,
} from "@qdpl/dao-tao";
import {
  bamDauVaoAi,
  batDauMuc,
  chiaSeMuc,
  chiTietNhom,
  chiTietNhomQuanLy,
  chuyenTruongNhom,
  coVu,
  danhSachNhomQuanLy,
  datHanGoiY,
  doiMaMoi,
  ghiChuAi,
  goMuc,
  ketQuaAiDaCo,
  type LoaiGhiChuAi,
  LoiNhom,
  luuTruNhom,
  luuTruNhomQuanLy,
  moiRaKhoiNhom,
  nguCanhGoiYThuTu,
  nguCanhTomTat,
  nguonBaiHoc,
  nguonChuDe,
  nhomCuaToi,
  roiNhom,
  sapThuTuMuc,
  soLanGoiAiHomNay,
  suaNhom,
  taoNhom,
  thamGiaNhom,
  tienDoThanhVien,
  xemTruocTheoMa,
} from "@qdpl/db";
import { complete, isMock, type LlmResponse, loadPrompt, render, safeJson } from "@qdpl/llm";
import { type Context, Hono } from "hono";
import { z } from "zod";
import {
  batBuocPhamViDonVi,
  batBuocVaiTro,
  ghiNhatKy,
  KhongDuQuyen,
  NgoaiPhamVi,
  phamViCua,
} from "../auth.ts";
import { badRequest, conflict, notFound, parseBody, parseQuery } from "../http.ts";

export const nhomRoute = new Hono();

/** 403 cho thao tác chỉ trưởng nhóm (hoặc người chia sẻ) làm được, không phải thiếu vai trò. */
class KhongDuQuyenTrongNhom extends KhongDuQuyen {
  constructor(message: string) {
    super("can_bo");
    this.message = message;
  }
}

/** Đổi lỗi nghiệp vụ sang mã HTTP. 429 không có trong ApiError nên trả thẳng. */
async function xuLy(c: Context, fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (!(e instanceof LoiNhom)) throw e;
    if (e.loai === "khong_tim_thay") throw notFound(e.message);
    if (e.loai === "xung_dot") throw conflict(e.message);
    if (e.loai === "khong_du_quyen") throw new KhongDuQuyenTrongNhom(e.message);
    if (e.loai === "ngoai_pham_vi") throw new NgoaiPhamVi(e.message);
    if (e.loai === "qua_han_muc") return c.json({ error: { code: "qua_han_muc", message: e.message } }, 429);
    throw badRequest(e.message);
  }
}

async function taiKhoan(c: Context): Promise<string> {
  const p: Principal = await batBuocVaiTro(c, "can_bo");
  if (!p.accountId) throw badRequest("Phiên đăng nhập không gắn với tài khoản nào.");
  return p.accountId;
}

const uuid = z.string().uuid();

/** Id trong đường dẫn: sai dạng trả 404 như id không tồn tại. */
function id(c: Context, ten: string): string {
  const r = uuid.safeParse(c.req.param(ten) ?? "");
  if (!r.success) throw notFound("Không tìm thấy nhóm.");
  return r.data;
}

/** Có ký tự điều khiển (mã dưới 32 hoặc 127) không; `choXuongDong` cho phép ký tự xuống dòng. */
function coKyTuDieuKhien(s: string, choXuongDong: boolean): boolean {
  for (let i = 0; i < s.length; i++) {
    const ma = s.charCodeAt(i);
    if (choXuongDong && ma === 10) continue;
    if (ma < 32 || ma === 127) return true;
  }
  return false;
}

/** Chữ do người dùng nhập: văn bản thuần, không nhận thẻ HTML và ký tự điều khiển. */
const chuThuan = (toiThieu: number, toiDa: number, nhieuDong = false) =>
  z
    .string()
    .trim()
    .min(toiThieu)
    .max(toiDa)
    .refine((s) => !/[<>]/.test(s), "Không dùng ký tự < và >.")
    .refine((s) => !coKyTuDieuKhien(s, nhieuDong), "Có ký tự điều khiển không hợp lệ.");

const tenNhom = chuThuan(GIOI_HAN_NHOM.tenNhom.toiThieu, GIOI_HAN_NHOM.tenNhom.toiDa);
const moTa = chuThuan(0, GIOI_HAN_NHOM.moTa, true);

/* ------------------------------------------------------------------ */
/* Giới hạn bấm cổ vũ, đếm trong bộ nhớ (API chạy 1 instance)           */
/* ------------------------------------------------------------------ */

const luotCoVu = new Map<string, number[]>();

function choPhepCoVu(accountId: string, now = Date.now()): boolean {
  const kq = nhanLuotTrongCuaSo(luotCoVu.get(accountId) ?? [], now, 60_000, GIOI_HAN_NHOM.coVuMoiPhut);
  luotCoVu.set(accountId, kq.moc);
  if (luotCoVu.size > 5000) {
    for (const [k, v] of luotCoVu) if (!v.some((t) => now - t < 60_000)) luotCoVu.delete(k);
  }
  return kq.duoc;
}

/* ------------------------------------------------------------------ */
/* AI (docs/PLAN.md GĐ16d)                                              */
/* ------------------------------------------------------------------ */

/**
 * AI có được bật không. Provider mock chỉ trả kết quả trong test (NODE_ENV=test), hoặc khi đặt rõ
 * NHOM_AI_CHO_PHEP_MOCK=1 cho kịch bản E2E. Ngoài hai trường hợp đó, văn bản của mock không bao giờ
 * tới người dùng: API trả 503 và giao diện ẩn nút.
 */
export function aiNhomDuocBat(): boolean {
  if (!isMock()) return true;
  return process.env.NODE_ENV === "test" || process.env.NHOM_AI_CHO_PHEP_MOCK === "1";
}

const chuaBatAi = (c: Context) =>
  c.json({ error: { code: "chua_bat_ai", message: THONG_BAO_CHUA_BAT_AI } }, 503);

const quaHanMucAi = (c: Context, n: number, theo: string) =>
  c.json(
    {
      error: {
        code: "qua_han_muc",
        message: `Đã dùng hết ${n} lần gợi ý bằng AI trong ngày ${theo}. Thử lại vào ngày mai.`,
      },
    },
    429,
  );

class HetGio extends Error {}

/** Gọi mô hình bậc `light`, hết giờ sau NHOM_AI_HET_GIO_MS (mặc định 20 giây), không chờ kết quả trễ. */
async function goiMoHinh(prompt: string, bien: Record<string, string | number>): Promise<LlmResponse> {
  const p = loadPrompt(prompt);
  const hetGio = Number(process.env.NHOM_AI_HET_GIO_MS) || GIOI_HAN_AI_NHOM.hetGioMs;
  let hen: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      complete({
        tier: "light",
        promptName: prompt,
        promptVersion: p.version,
        cacheableSystem: p.system,
        user: render(p.user, bien),
        maxTokens: 1_000,
      }),
      new Promise<never>((_, tuChoi) => {
        hen = setTimeout(
          () => tuChoi(new HetGio(`Hết giờ sau ${(hetGio / 1000).toLocaleString("vi-VN")} giây.`)),
          hetGio,
        );
      }),
    ]);
  } finally {
    clearTimeout(hen);
  }
}

/**
 * Một lượt AI. Cùng dữ liệu vào đã có kết quả đạt thì dùng lại, không gọi mô hình, không tính hạn
 * mức (Đ17). Không thì kiểm hạn mức, gọi mô hình, hậu kiểm tất định, ghi `study_group_ai_notes` kể
 * cả khi bị loại hay hết giờ. Kết quả trả về còn dạng mã; lý do loại không trả cho người dùng.
 */
async function luotAi<T>(o: {
  kind: LoaiGhiChuAi;
  prompt: string;
  groupId: string;
  requestedBy: string | null;
  scopePath: string | null;
  dauVao: unknown;
  bien: Record<string, string | number>;
  hauKiem: (json: unknown) => HauKiemAiNhom<T>;
  /** Trả Response 429 khi đã hết hạn mức; chỉ gọi khi cần gọi mô hình. */
  hanMuc: () => Promise<Response | null>;
}): Promise<Response | { ketQua: T | null; tuBoNhoDem: boolean }> {
  const inputHash = bamDauVaoAi(o.prompt, loadPrompt(o.prompt).version, o.dauVao);
  const khoa = { groupId: o.groupId, kind: o.kind, scopePath: o.scopePath, inputHash };
  const cu = await ketQuaAiDaCo(khoa);
  if (cu) return { ketQua: cu as T, tuBoNhoDem: true };
  const chan = await o.hanMuc();
  if (chan) return chan;

  const ghi = { ...khoa, requestedBy: o.requestedBy };
  let res: LlmResponse;
  try {
    res = await goiMoHinh(o.prompt, o.bien);
  } catch (e) {
    const lyDo = e instanceof HetGio ? e.message : `Lỗi gọi mô hình: ${e instanceof Error ? e.message : e}`;
    console.warn(`[nhom-ai] ${o.kind} nhóm ${o.groupId}: ${lyDo}`);
    await ghiChuAi({ ...ghi, dat: false, lyDo });
    return { ketQua: null, tuBoNhoDem: false };
  }
  const hk = o.hauKiem(res.json ?? safeJson(res.text));
  if (!hk.dat) console.warn(`[nhom-ai] ${o.kind} nhóm ${o.groupId} bị loại: ${hk.ly_do}`);
  await ghiChuAi({
    ...ghi,
    dat: hk.dat,
    ...(hk.dat ? { content: hk.ket_qua } : { lyDo: hk.ly_do }),
    model: res.model,
    tokensIn: res.tokensIn,
    tokensOut: res.tokensOut,
    costUsd: res.costUsd,
  });
  return { ketQua: hk.dat ? hk.ket_qua : null, tuBoNhoDem: false };
}

/** Mã mục -> { id, tên } theo bảng đối chiếu của lượt gọi. */
const mucTheoMa = (bang: BangMa, ma: string) => ({
  id: bang.get(ma)?.id ?? ma,
  ten: bang.get(ma)?.ten ?? ma,
});

/* ------------------------------------------------------------------ */
/* Đường tĩnh (khai trước `/:id`)                                       */
/* ------------------------------------------------------------------ */

/** GET /v1/nhom: nhóm của tôi, kèm phần trăm của tôi và trung bình nhóm. */
nhomRoute.get("/", async (c) => {
  const acc = await taiKhoan(c);
  return c.json({ items: await nhomCuaToi(acc) });
});

/** POST /v1/nhom: tạo nhóm, trả kèm mã mời. */
nhomRoute.post("/", (c) =>
  xuLy(c, async () => {
    const acc = await taiKhoan(c);
    const b = await parseBody(c, z.object({ ten: tenNhom, mo_ta: moTa.optional() }).strict());
    const g = await taoNhom({ accountId: acc, ten: b.ten, moTa: b.mo_ta || null });
    return c.json(g, 201);
  }),
);

/** GET /v1/nhom/nguon?loai=bai_hoc|chu_de&q=: bài xuất bản hoặc chủ đề đủ câu để chia sẻ. */
nhomRoute.get("/nguon", async (c) => {
  const acc = await taiKhoan(c);
  const q = parseQuery(
    c,
    z.object({ loai: z.enum(["bai_hoc", "chu_de"]), q: z.string().trim().max(80).optional() }).strict(),
  );
  const items = q.loai === "bai_hoc" ? await nguonBaiHoc(q.q) : await nguonChuDe(acc, q.q);
  return c.json({ items });
});

/** GET /v1/nhom/ma/:ma: xem trước nhóm trước khi tham gia. */
nhomRoute.get("/ma/:ma", (c) =>
  xuLy(c, async () => {
    const acc = await taiKhoan(c);
    return c.json(await xemTruocTheoMa(c.req.param("ma"), acc));
  }),
);

/** POST /v1/nhom/tham-gia: tham gia bằng mã mời. */
nhomRoute.post("/tham-gia", (c) =>
  xuLy(c, async () => {
    const acc = await taiKhoan(c);
    const b = await parseBody(c, z.object({ ma: z.string().trim().min(1).max(20) }).strict());
    return c.json(await thamGiaNhom(b.ma, acc));
  }),
);

/* ------------------------------------------------------------------ */
/* Một nhóm                                                            */
/* ------------------------------------------------------------------ */

/** GET /v1/nhom/:id: mục kèm phần trăm của tôi, thành viên kèm phần trăm chung và lượt cổ vũ. */
nhomRoute.get("/:id", (c) =>
  xuLy(c, async () => {
    const acc = await taiKhoan(c);
    // `ai_bat`: giao diện chỉ hiện nút "Gợi ý thứ tự học" khi AI đang bật (GĐ16d).
    return c.json({ ...(await chiTietNhom(id(c, "id"), acc)), ai_bat: aiNhomDuocBat() });
  }),
);

/**
 * POST /v1/nhom/:id/ai/thu-tu: AI-1 gợi ý thứ tự học (trưởng nhóm). Không tự áp dụng: trưởng nhóm xem
 * trước rồi gọi `PUT /:id/muc/thu-tu`. Hậu kiểm loại thì trả câu cố định, không trả đầu ra của mô hình.
 */
nhomRoute.post("/:id/ai/thu-tu", (c) =>
  xuLy(c, async () => {
    const acc = await taiKhoan(c);
    const g = id(c, "id");
    if (!aiNhomDuocBat()) return chuaBatAi(c);
    const { dauVao, bang } = await nguCanhGoiYThuTu(g, acc);
    if (dauVao.muc.length < 2) {
      return c.json({ dat: false, thong_bao: "Nhóm cần có từ 2 mục trở lên để gợi ý thứ tự." });
    }
    const kq = await luotAi({
      kind: "thu_tu_hoc",
      prompt: PROMPT_GOI_Y_THU_TU,
      groupId: g,
      requestedBy: acc,
      scopePath: null,
      dauVao,
      bien: { du_lieu: JSON.stringify(dauVao), so_muc: dauVao.muc.length },
      hauKiem: (json) => hauKiemGoiYThuTu(json, dauVao),
      hanMuc: async () =>
        (await soLanGoiAiHomNay({ kind: "thu_tu_hoc", groupId: g })) >= GIOI_HAN_AI_NHOM.goiYMoiNhomMoiNgay
          ? quaHanMucAi(c, GIOI_HAN_AI_NHOM.goiYMoiNhomMoiNgay, "cho nhóm này")
          : null,
    });
    if (kq instanceof Response) return kq;
    if (!kq.ketQua) return c.json({ dat: false, thong_bao: THONG_BAO_KHONG_GOI_Y });
    return c.json({
      dat: true,
      tu_bo_nho_dem: kq.tuBoNhoDem,
      thu_tu: kq.ketQua.thu_tu.map((ma) => mucTheoMa(bang, ma)),
      ghi_chu: thayMa(kq.ketQua.ghi_chu, bang),
    });
  }),
);

/** PATCH /v1/nhom/:id: sửa tên, mô tả (trưởng nhóm). */
nhomRoute.patch("/:id", (c) =>
  xuLy(c, async () => {
    const acc = await taiKhoan(c);
    const g = id(c, "id");
    const b = await parseBody(
      c,
      z.object({ ten: tenNhom.optional(), mo_ta: moTa.nullable().optional() }).strict(),
    );
    if (b.ten === undefined && b.mo_ta === undefined) throw badRequest("Cần gửi tên hoặc mô tả mới.");
    await suaNhom(g, acc, { ten: b.ten, moTa: b.mo_ta === undefined ? undefined : b.mo_ta || null });
    return c.json(await chiTietNhom(g, acc));
  }),
);

/** POST /v1/nhom/:id/ma-moi: đổi mã mời (trưởng nhóm). Mã cũ hết dùng ngay. */
nhomRoute.post("/:id/ma-moi", (c) =>
  xuLy(c, async () => {
    const acc = await taiKhoan(c);
    return c.json(await doiMaMoi(id(c, "id"), acc));
  }),
);

/** POST /v1/nhom/:id/roi: rời nhóm. */
nhomRoute.post("/:id/roi", (c) =>
  xuLy(c, async () => {
    const acc = await taiKhoan(c);
    return c.json(await roiNhom(id(c, "id"), acc));
  }),
);

/** POST /v1/nhom/:id/thanh-vien/:accountId/moi-ra: trưởng nhóm mời một thành viên ra khỏi nhóm. */
nhomRoute.post("/:id/thanh-vien/:accountId/moi-ra", (c) =>
  xuLy(c, async () => {
    const acc = await taiKhoan(c);
    await moiRaKhoiNhom(id(c, "id"), acc, id(c, "accountId"));
    return c.json({ ok: true });
  }),
);

/** POST /v1/nhom/:id/thanh-vien/:accountId/truong-nhom: chuyển quyền trưởng nhóm. */
nhomRoute.post("/:id/thanh-vien/:accountId/truong-nhom", (c) =>
  xuLy(c, async () => {
    const acc = await taiKhoan(c);
    await chuyenTruongNhom(id(c, "id"), acc, id(c, "accountId"));
    return c.json({ ok: true });
  }),
);

/** GET /v1/nhom/:id/thanh-vien/:accountId/tien-do: phần trăm từng mục của một thành viên. */
nhomRoute.get("/:id/thanh-vien/:accountId/tien-do", (c) =>
  xuLy(c, async () => {
    const acc = await taiKhoan(c);
    return c.json(await tienDoThanhVien(id(c, "id"), acc, id(c, "accountId")));
  }),
);

const chiaSeSchema = z.discriminatedUnion("loai", [
  z.object({ loai: z.literal("bai_hoc"), lesson_id: uuid }).strict(),
  z
    .object({
      loai: z.literal("de_on_tap"),
      topic_id: uuid,
      so_cau: z.number().int().min(GIOI_HAN_NHOM.cauDeOnTap.toiThieu).max(GIOI_HAN_NHOM.cauDeOnTap.toiDa),
      ten: chuThuan(GIOI_HAN_NHOM.tenDeOnTap.toiThieu, GIOI_HAN_NHOM.tenDeOnTap.toiDa),
    })
    .strict(),
]);

/** POST /v1/nhom/:id/muc: chia sẻ một bài học hoặc một đề ôn tập vào nhóm. */
nhomRoute.post("/:id/muc", (c) =>
  xuLy(c, async () => {
    const acc = await taiKhoan(c);
    const g = id(c, "id");
    const b = await parseBody(c, chiaSeSchema);
    const muc =
      b.loai === "bai_hoc"
        ? await chiaSeMuc(g, acc, { loai: "bai_hoc", lessonId: b.lesson_id })
        : await chiaSeMuc(g, acc, { loai: "de_on_tap", topicId: b.topic_id, soCau: b.so_cau, ten: b.ten });
    return c.json(muc, 201);
  }),
);

/** PUT /v1/nhom/:id/muc/thu-tu: sắp thứ tự (trưởng nhóm); `item_ids` là hoán vị các mục đang có. */
nhomRoute.put("/:id/muc/thu-tu", (c) =>
  xuLy(c, async () => {
    const acc = await taiKhoan(c);
    const g = id(c, "id");
    const b = await parseBody(
      c,
      z.object({ item_ids: z.array(uuid).max(GIOI_HAN_NHOM.mucMoiNhom) }).strict(),
    );
    await sapThuTuMuc(g, acc, b.item_ids);
    return c.json({ ok: true });
  }),
);

/** DELETE /v1/nhom/:id/muc/:itemId: gỡ mục. */
nhomRoute.delete("/:id/muc/:itemId", (c) =>
  xuLy(c, async () => {
    const acc = await taiKhoan(c);
    await goMuc(id(c, "id"), acc, id(c, "itemId"));
    return c.json({ ok: true });
  }),
);

/** PATCH /v1/nhom/:id/muc/:itemId: đặt hoặc bỏ hạn gợi ý (trưởng nhóm). */
nhomRoute.patch("/:id/muc/:itemId", (c) =>
  xuLy(c, async () => {
    const acc = await taiKhoan(c);
    const g = id(c, "id");
    const item = id(c, "itemId");
    const b = await parseBody(
      c,
      z
        .object({
          han_goi_y: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có dạng YYYY-MM-DD")
            .nullable(),
        })
        .strict(),
    );
    await datHanGoiY(g, acc, item, b.han_goi_y);
    return c.json({ ok: true });
  }),
);

/** POST /v1/nhom/:id/muc/:itemId/bat-dau: bài học trả đường dẫn; đề ôn tập tạo hoặc trả phiên đang làm. */
nhomRoute.post("/:id/muc/:itemId/bat-dau", (c) =>
  xuLy(c, async () => {
    const acc = await taiKhoan(c);
    const kq = await batDauMuc(id(c, "id"), acc, id(c, "itemId"));
    return c.json(kq, kq.loai === "de_on_tap" && !kq.da_co ? 201 : 200);
  }),
);

/** POST /v1/nhom/:id/co-vu/:accountId: cổ vũ hoặc bỏ cổ vũ hôm nay. */
nhomRoute.post("/:id/co-vu/:accountId", (c) =>
  xuLy(c, async () => {
    const acc = await taiKhoan(c);
    const g = id(c, "id");
    const den = id(c, "accountId");
    if (!choPhepCoVu(acc)) {
      return c.json(
        { error: { code: "qua_han_muc", message: "Bấm cổ vũ quá nhiều lần. Thử lại sau một phút." } },
        429,
      );
    }
    return c.json(await coVu(g, acc, den));
  }),
);

/** POST /v1/nhom/:id/luu-tru: lưu trữ nhóm (trưởng nhóm). */
nhomRoute.post("/:id/luu-tru", (c) =>
  xuLy(c, async () => {
    const acc = await taiKhoan(c);
    await luuTruNhom(id(c, "id"), acc);
    return c.json({ ok: true });
  }),
);

/* ------------------------------------------------------------------ */
/* Quản lý: /v1/quan-tri/nhom (GĐ16c)                                  */
/* ------------------------------------------------------------------ */

/**
 * `quan_ly` trở lên, lọc theo cây đơn vị của người gọi ở câu truy vấn (N11, đề xuất Đ11):
 *  - thành viên ngoài phạm vi chỉ có số lượng, không có họ tên, không có id;
 *  - nhóm không có thành viên nào trong phạm vi trả 404 như nhóm không tồn tại;
 *  - `quan_ly` chưa gắn đơn vị nhận 403; `quan_tri` thấy mọi nhóm.
 * Quản lý chỉ xem và lưu trữ; không sửa nội dung nhóm, không cổ vũ từ đây.
 */
export const quanTriNhomRoute = new Hono();

async function quanLy(c: Context): Promise<{ p: Principal; phamVi: string | null }> {
  const p = await batBuocVaiTro(c, "quan_ly");
  const phamVi = phamViCua(p);
  if (phamVi === "khong_co") {
    throw new NgoaiPhamVi("Tài khoản chưa gắn đơn vị nên không xem được nhóm học cùng.");
  }
  return { p, phamVi };
}

/** GET /v1/quan-tri/nhom?don_vi=&q=&trang_thai=: nhóm có ít nhất một thành viên trong phạm vi. */
quanTriNhomRoute.get("/", async (c) => {
  const { phamVi } = await quanLy(c);
  const q = parseQuery(
    c,
    z
      .object({
        don_vi: uuid.optional(),
        q: z.string().trim().max(80).optional(),
        trang_thai: z.enum(["hoat_dong", "luu_tru"]).optional(),
      })
      .strict(),
  );
  const donVi = q.don_vi ? (await batBuocPhamViDonVi(c, q.don_vi)).unitPath : null;
  const items = await danhSachNhomQuanLy({ phamVi, donVi, q: q.q, trangThai: q.trang_thai });
  return c.json({ items });
});

/** GET /v1/quan-tri/nhom/:id: thành viên trong phạm vi và tiến độ từng mục, kèm số người ngoài phạm vi. */
quanTriNhomRoute.get("/:id", (c) =>
  xuLy(c, async () => {
    const { phamVi } = await quanLy(c);
    return c.json({ ...(await chiTietNhomQuanLy(id(c, "id"), phamVi)), ai_bat: aiNhomDuocBat() });
  }),
);

/**
 * POST /v1/quan-tri/nhom/:id/ai/tom-tat: AI-2 tóm tắt tiến độ (`quan_ly` trở lên), chỉ từ số liệu của
 * thành viên trong phạm vi người gọi; mỗi phạm vi một bản. Máy chủ thay mã TVn, Mn bằng họ tên, tên
 * mục SAU khi hậu kiểm. Bị loại thì trả `dat: false`, giao diện không hiện khối tóm tắt.
 */
quanTriNhomRoute.post("/:id/ai/tom-tat", (c) =>
  xuLy(c, async () => {
    const { p, phamVi } = await quanLy(c);
    const g = id(c, "id");
    if (!aiNhomDuocBat()) return chuaBatAi(c);
    const { dauVao, bang } = await nguCanhTomTat(g, phamVi);
    if (!dauVao.so_thanh_vien) return c.json({ dat: false });
    const nguoi = p.accountId ?? null;
    const kq = await luotAi({
      kind: "tom_tat_tien_do",
      prompt: PROMPT_TOM_TAT_TIEN_DO,
      groupId: g,
      requestedBy: nguoi,
      scopePath: phamVi,
      dauVao,
      bien: { du_lieu: JSON.stringify(dauVao), so_thanh_vien: dauVao.so_thanh_vien },
      hauKiem: (json) => hauKiemTomTat(json, dauVao),
      hanMuc: async () =>
        (await soLanGoiAiHomNay({ kind: "tom_tat_tien_do", requestedBy: nguoi })) >=
        GIOI_HAN_AI_NHOM.tomTatMoiNguoiMoiNgay
          ? quaHanMucAi(c, GIOI_HAN_AI_NHOM.tomTatMoiNguoiMoiNgay, "của tài khoản này")
          : null,
    });
    if (kq instanceof Response) return kq;
    if (!kq.ketQua) return c.json({ dat: false });
    return c.json({
      dat: true,
      tu_bo_nho_dem: kq.tuBoNhoDem,
      canh_bao: CANH_BAO_TOM_TAT,
      nhan_xet: kq.ketQua.nhan_xet.map((cau) => thayMa(cau, bang)),
      muc_can_chu_y: kq.ketQua.muc_can_chu_y.map((ma) => mucTheoMa(bang, ma)),
    });
  }),
);

/** POST /v1/quan-tri/nhom/:id/luu-tru: lưu trữ nhóm có trưởng nhóm trong phạm vi (N11), ghi nhật ký. */
quanTriNhomRoute.post("/:id/luu-tru", (c) =>
  xuLy(c, async () => {
    const { p, phamVi } = await quanLy(c);
    const g = id(c, "id");
    const kq = await luuTruNhomQuanLy(g, phamVi, p.accountId ?? null);
    await ghiNhatKy(p.email, "nhom.luu_tru", g, { ten: kq.ten, so_thanh_vien: kq.so_thanh_vien });
    return c.json({ ok: true });
  }),
);
