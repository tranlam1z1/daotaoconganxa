/**
 * Phía người thi (docs/PLAN.md GĐ6): bài được giao, bắt đầu hoặc làm tiếp lượt, lưu từng câu,
 * nộp bài, xem kết quả.
 *
 * - Không phản hồi nào trước khi nộp chứa đáp án: phần đề là `CauTrongDe.de`, không có
 *   `noi_dung` (ảnh chụp kèm đáp án chỉ đọc ở máy chủ).
 * - Đồng hồ theo máy chủ: trả `giay_con_lai` và `server_now` để giao diện đếm lùi; câu trả lời
 *   quá hạn + 30 giây bị từ chối (409) và lượt được tự nộp.
 * - Lượt của người khác trả 404, không trả 403: không lộ id lượt nào có thật.
 */
import {
  chamCauHoi,
  DO_DAI_BAI_VIET,
  diemCau,
  duocXemDapAn,
  giayConLai,
  type TraLoiCauHoi,
} from "@qdpl/dao-tao";
import {
  baiThiCuaToi,
  batDauLuot,
  chamTuLuanCuaLuot,
  giaoBaiChoNguoi,
  ketQuaTungCau,
  LoiNghiepVu,
  type LuotThiRow,
  layDeThi,
  layGiaoBai,
  layLuot,
  luuTraLoi,
  nopLuot,
  traLoiCuaLuot,
  tuNopLuotQuaHan,
} from "@qdpl/db";
import { goiMoHinhChamTuLuan } from "@qdpl/llm";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import { batBuocDangNhap } from "../auth.ts";
import { badRequest, conflict, notFound, parseBody } from "../http.ts";

const uuid = z.string().uuid("Id phải là UUID hợp lệ");

function idHopLe(raw: string | undefined): string {
  const r = uuid.safeParse(raw ?? "");
  if (!r.success) throw badRequest("Id phải là UUID hợp lệ");
  return r.data;
}

function doiLoi(e: unknown): never {
  if (e instanceof LoiNghiepVu) {
    if (e.loai === "khong_tim_thay") throw notFound(e.message);
    if (e.loai === "xung_dot") throw conflict(e.message);
    throw badRequest(e.message);
  }
  throw e;
}

type TrangThaiBai = "chua_mo" | "chua_lam" | "dang_lam" | "da_xong" | "het_han";

export const thiRoute = new Hono();

/** GET /v1/thi — bài được giao cho người đang đăng nhập, kèm trạng thái và hạn. */
thiRoute.get("/", async (c) => {
  const p = await batBuocDangNhap(c);
  const now = new Date();
  // Lượt quá hạn của chính người này được nộp ngay, để danh sách không còn "đang làm" giả.
  await tuNopLuotQuaHan(now, p.accountId);
  const ds = await baiThiCuaToi(p.accountId as string, p.unitPath ?? null);
  const items = ds.map((b) => {
    const han = new Date(b.due_at);
    const trangThai: TrangThaiBai = b.luot_dang_lam
      ? "dang_lam"
      : b.so_luot_nop > 0 && (b.so_luot_nop >= b.max_attempts || now >= han)
        ? "da_xong"
        : now >= han
          ? "het_han"
          : now < new Date(b.opens_at)
            ? "chua_mo"
            : "chua_lam";
    return {
      ...b,
      trang_thai: trangThai,
      con_luot: Math.max(0, b.max_attempts - b.so_luot_nop),
      duoc_bat_dau:
        (trangThai === "chua_lam" || trangThai === "da_xong") &&
        b.so_luot_nop < b.max_attempts &&
        now < han &&
        b.exam_status === "xuat_ban",
    };
  });
  return c.json({ items, server_now: now.toISOString() });
});

/**
 * POST /v1/thi/:giaoBai/bat-dau — bắt đầu lượt mới (201), hoặc trả lượt đang làm dở (200).
 * Hết lượt, chưa mở, quá hạn, đề đã đóng: 409 kèm lý do.
 */
thiRoute.post("/:giaoBai/bat-dau", async (c) => {
  const p = await batBuocDangNhap(c);
  const bai = await giaoBaiChoNguoi(
    idHopLe(c.req.param("giaoBai")),
    p.accountId as string,
    p.unitPath ?? null,
  );
  if (!bai || bai.cancelled_at) throw notFound("Không có bài thi này trong danh sách được giao.");
  try {
    const kq = await batDauLuot({ assignment: bai, accountId: p.accountId as string });
    return c.json({ luot_id: kq.id, tiep_tuc: kq.tiepTuc }, kq.tiepTuc ? 200 : 201);
  } catch (e) {
    doiLoi(e);
  }
});

async function luotCuaToi(c: Context): Promise<LuotThiRow> {
  const p = await batBuocDangNhap(c);
  const luot = await layLuot(idHopLe(c.req.param("id")));
  if (!luot || luot.account_id !== p.accountId) throw notFound("Không tìm thấy lượt thi.");
  return luot;
}

/**
 * GET /v1/thi/luot/:id — đề của lượt (không có đáp án), câu trả lời đã lưu và thời gian còn lại.
 * Mở lại lượt quá hạn thì lượt được nộp luôn và trả trạng thái đã nộp.
 */
thiRoute.get("/luot/:id", async (c) => {
  let luot = await luotCuaToi(c);
  const now = new Date();
  if (luot.status === "dang_lam" && giayConLai(new Date(luot.deadline_at), now) === 0) {
    await tuNopLuotQuaHan(now, luot.account_id);
    luot = (await layLuot(luot.id)) as LuotThiRow;
  }
  const de = await layDeThi(luot.exam_id);
  const traLoi = await traLoiCuaLuot(luot.id);
  return c.json({
    id: luot.id,
    exam_title: de?.title ?? "",
    trang_thai: luot.status,
    so_cau: luot.items.length,
    started_at: luot.started_at,
    deadline_at: luot.deadline_at,
    server_now: now.toISOString(),
    giay_con_lai: luot.status === "dang_lam" ? giayConLai(new Date(luot.deadline_at), now) : 0,
    cau: luot.items.map((item, i) => ({ thu_tu: i + 1, de: item.de, tra_loi: traLoi.get(i + 1) ?? null })),
  });
});

const traLoiSchema = z.object({
  tra_loi: z
    .object({
      chon: z.array(z.string().max(50)).max(20).optional(),
      thu_tu: z.array(z.string().max(50)).max(20).optional(),
      cap: z.record(z.string().max(50), z.string().max(50)).optional(),
      o_trong: z.record(z.string().max(10), z.string().max(500)).optional(),
      bai_viet: z
        .string()
        .max(
          DO_DAI_BAI_VIET.toiDa,
          `Bài viết dài quá ${DO_DAI_BAI_VIET.toiDa.toLocaleString("vi-VN")} ký tự.`,
        )
        .optional(),
    })
    .strict(),
});

/** PUT /v1/thi/luot/:id/cau/:thuTu — lưu (hoặc sửa) câu trả lời của một câu. */
thiRoute.put("/luot/:id/cau/:thuTu", async (c) => {
  const luot = await luotCuaToi(c);
  const thuTu = Number(c.req.param("thuTu"));
  if (!Number.isInteger(thuTu) || thuTu < 1) throw badRequest("Số thứ tự câu không hợp lệ.");
  const { tra_loi } = await parseBody(c, traLoiSchema);
  try {
    await luuTraLoi({ luot, thuTu, traLoi: tra_loi as TraLoiCauHoi });
  } catch (e) {
    doiLoi(e);
  }
  return c.json({ da_luu: true, giay_con_lai: giayConLai(new Date(luot.deadline_at), new Date()) });
});

/**
 * POST /v1/thi/luot/:id/nop — nộp và chấm. Câu tự luận được mô hình chấm ngay trong yêu cầu
 * này để công bố điểm luôn (vài giây); câu mô hình không chấm được chờ giảng viên, lượt ở
 * `cho_cham`. Gọi lại trên lượt đã nộp thì trả kết quả cũ.
 */
thiRoute.post("/luot/:id/nop", async (c) => {
  const luot = await luotCuaToi(c);
  const { choCham } = await nopLuot(luot.id, "nguoi_thi");
  if (choCham) await chamTuLuanCuaLuot(luot.id, goiMoHinhChamTuLuan);
  return c.json(await ketQua(luot.id, false));
});

/**
 * GET /v1/thi/luot/:id/ket-qua — điểm, đạt hay không, thời gian làm; từng câu kèm đáp án chỉ
 * khi cấu hình đề cho xem (ngay sau khi nộp, hoặc sau hạn bài giao). Lượt còn câu tự luận chờ
 * mô hình (ví dụ tự nộp khi hết giờ) thì chấm luôn trước khi trả.
 */
thiRoute.get("/luot/:id/ket-qua", async (c) => {
  const luot = await luotCuaToi(c);
  if (luot.status === "dang_lam") throw conflict("Bài thi chưa nộp.");
  if (luot.status === "cho_cham") await chamTuLuanCuaLuot(luot.id, goiMoHinhChamTuLuan);
  return c.json(await ketQua(luot.id, true));
});

async function ketQua(attemptId: string, kemChiTiet: boolean) {
  const luot = (await layLuot(attemptId)) as LuotThiRow;
  const [de, bai, cau] = await Promise.all([
    layDeThi(luot.exam_id),
    layGiaoBai(luot.assignment_id),
    ketQuaTungCau(luot.id),
  ]);
  const now = new Date();
  const xemDapAn = Boolean(de && bai && duocXemDapAn(de.show_answers, new Date(bai.due_at), now));
  const daChot = luot.status === "da_nop";
  // Điểm một câu đã chấm; câu chấm trước khi có cột `points` chỉ có cờ đúng/sai.
  const diemCua = (i: number) => {
    const r = cau.get(i + 1);
    if (!r) return daChot ? 0 : null;
    if (r.grading_state !== "xong") return null;
    return r.points ?? (r.correct ? diemCau(luot.items[i]!) : 0);
  };
  return {
    id: luot.id,
    exam_title: de?.title ?? "",
    trang_thai: luot.status,
    kieu_nop: luot.submit_kind,
    dung: luot.correct,
    tong: luot.total,
    diem: luot.score,
    diem_dat: de?.pass_score ?? null,
    dat: luot.passed,
    co_tu_luan: luot.items.some((it) => it.noi_dung.kind === "tu_luan"),
    so_cau_cho_cham: [...cau.values()].filter((r) => r.grading_state !== "xong").length,
    // Điểm theo thang của đề (trước khi quy về 100), để hiện "8 / 15 điểm".
    diem_tho: daChot
      ? Math.round(luot.items.reduce((s, _, i) => s + (diemCua(i) ?? 0), 0) * 100) / 100
      : null,
    tong_diem_tho: luot.items.reduce((s, it) => s + diemCau(it), 0),
    lan_thu: luot.attempt_no,
    bat_dau: luot.started_at,
    nop_luc: luot.submitted_at,
    giay_lam_bai: luot.submitted_at
      ? Math.max(
          0,
          Math.round((new Date(luot.submitted_at).getTime() - new Date(luot.started_at).getTime()) / 1000),
        )
      : null,
    xem_dap_an: xemDapAn,
    ...(de?.show_answers === "sau_han" && !xemDapAn && bai ? { xem_dap_an_tu: bai.due_at } : {}),
    ...(kemChiTiet && xemDapAn
      ? {
          chi_tiet: luot.items.map((item, i) => {
            const r = cau.get(i + 1);
            const t = r?.response ?? null;
            const chung = {
              thu_tu: i + 1,
              de: item.de,
              tra_loi: t,
              diem: diemCua(i),
              diem_toi_da: diemCau(item),
            };
            if (item.noi_dung.kind === "tu_luan") {
              // Không chấm lại: đọc điểm, nhận xét theo tiêu chí đã lưu; đáp án gợi ý ở `giai_thich`.
              return {
                ...chung,
                trang_thai_cham: r?.grading_state ?? "xong",
                cham_boi: r?.graded_by ?? null,
                nhan_xet: r?.feedback ?? null,
                ket_qua: {
                  dung: Boolean(r?.correct),
                  ty_le:
                    r?.points != null && r.max_points
                      ? Math.round((r.points / r.max_points) * 1000) / 1000
                      : 0,
                  dap_an: {},
                  giai_thich: item.noi_dung.explanation,
                  can_cu: item.noi_dung.citations,
                },
              };
            }
            return {
              ...chung,
              ket_qua: t ? chamCauHoi(item.noi_dung, t) : { ...chamCauHoi(item.noi_dung, {}), dung: false },
            };
          }),
        }
      : {}),
  };
}
