/**
 * Dữ liệu của trò "Trạm cân tải trọng" (docs/PLAN.md GĐ-T12): giới hạn tải trọng (`load_limits`, câu D17),
 * khung phần trăm quá tải (`violations.qua_tai_*`), nguồn xe cho lượt chơi và gói offline, nạp mẫu.
 *
 * Nguồn là xe ĐÃ DUYỆT (qua `noiDungDungDuoc`) kèm giới hạn tải trọng và khung phần trăm ĐÃ DUYỆT, còn hiệu
 * lực tại ngày chơi. Đáp án không lưu ở đây: packages/dao-tao (tram-can.ts) suy ra từ các ngưỡng đó, nên
 * ngưỡng đổi sau khi duyệt lại thì đáp án đổi theo; ngưỡng đang sửa (về chờ duyệt) thì rời nguồn và xe cần
 * nó không vào lượt.
 */
import { join } from "node:path";
import {
  type DongTaiTrongTep,
  type GioiHanTaiTrong,
  type KhungQuaTai,
  kiemTraXeTramCan,
  MA_TRAM_CAN,
  type MucPhatDaDuyet,
  type NguonTramCan,
  type PayloadTramCan,
  type XeTramCan,
} from "@qdpl/dao-tao";
import { sql } from "./client.ts";
import { noiDungDungDuoc, taoNoiDungTroChoi } from "./noi-dung-tro-choi.ts";
import { type CheDoNap, giuTrangThai, trangThaiNap } from "./tra-cuu-nhanh.ts";

/**
 * Nạp giới hạn tải trọng, cùng cách với tốc độ tối đa: `cheDo = cho_duyet` (mặc định của script) đưa dòng
 * mới hoặc đổi nội dung vào chờ duyệt. Dòng trong phạm vi `tienTo` mà không còn trong tệp thì ngừng.
 */
export async function napTaiTrong(
  ds: DongTaiTrongTep[],
  opts: { tienTo?: string; cheDo?: CheDoNap } = {},
): Promise<{ daNap: number; ngung: number }> {
  const theoTep = (opts.cheDo ?? "theo_tep") === "theo_tep";
  let ngung = 0;
  await sql.begin(async (tx) => {
    for (const d of ds) {
      await tx`
        INSERT INTO load_limits (code, kind, vehicle_class, group_axles, spacing_from_cm, spacing_to_cm, limit_kg,
          name, citation_urn, effective_from, effective_to, status, note, updated_at)
        VALUES (${d.ma}, ${d.loai}, ${d.loai_xe ?? null}, ${d.so_truc_cum ?? null}, ${d.cach_tu_cm ?? null},
          ${d.cach_den_cm ?? null}, ${d.gioi_han_kg}, ${d.ten}, ${d.can_cu}, ${d.hieu_luc_tu}, ${d.hieu_luc_den ?? null},
          ${trangThaiNap(d.trang_thai, theoTep)}, ${d.ghi_chu ?? null}, now())
        ON CONFLICT (code) DO UPDATE SET
          kind = EXCLUDED.kind, vehicle_class = EXCLUDED.vehicle_class, group_axles = EXCLUDED.group_axles,
          spacing_from_cm = EXCLUDED.spacing_from_cm, spacing_to_cm = EXCLUDED.spacing_to_cm,
          limit_kg = EXCLUDED.limit_kg, name = EXCLUDED.name, citation_urn = EXCLUDED.citation_urn,
          effective_from = EXCLUDED.effective_from, effective_to = EXCLUDED.effective_to,
          note = EXCLUDED.note, updated_at = now(),
          ${giuTrangThai(
            tx,
            "load_limits",
            theoTep,
            tx`(load_limits.kind, load_limits.vehicle_class, load_limits.group_axles, load_limits.spacing_from_cm,
            load_limits.spacing_to_cm, load_limits.limit_kg, load_limits.name, load_limits.citation_urn,
            load_limits.effective_from, load_limits.effective_to)
            IS DISTINCT FROM (EXCLUDED.kind, EXCLUDED.vehicle_class, EXCLUDED.group_axles, EXCLUDED.spacing_from_cm,
            EXCLUDED.spacing_to_cm, EXCLUDED.limit_kg, EXCLUDED.name, EXCLUDED.citation_urn,
            EXCLUDED.effective_from, EXCLUDED.effective_to)`,
          )}`;
    }
    const phamVi = `${(opts.tienTo ?? "").replace(/[\\%_]/g, "\\$&")}%`;
    const r = await tx`
      UPDATE load_limits SET status = 'ngung', updated_at = now()
      WHERE status <> 'ngung' AND created_by IS NULL AND code LIKE ${phamVi}
        AND NOT (code = ANY(${ds.map((d) => d.ma)}))`;
    ngung = r.count;
  });
  return { daNap: ds.length, ngung };
}

/** Giới hạn tải trọng đã duyệt, còn hiệu lực tại `ngay` (YYYY-MM-DD). */
export async function gioiHanTaiTrongDaDuyet(ngay: string): Promise<GioiHanTaiTrong[]> {
  const rows = (await sql`
    SELECT code, version, kind, vehicle_class, group_axles, spacing_from_cm, spacing_to_cm, limit_kg, name, citation_urn
    FROM load_limits
    WHERE status = 'da_duyet' AND effective_from <= ${ngay} AND (effective_to IS NULL OR effective_to > ${ngay})
    ORDER BY code`) as any[];
  return rows.map((r) => ({
    ma: r.code,
    version: r.version,
    loai: r.kind,
    loai_xe: r.vehicle_class,
    so_truc_cum: r.group_axles,
    cach_tu_cm: r.spacing_from_cm,
    cach_den_cm: r.spacing_to_cm,
    gioi_han_kg: r.limit_kg,
    ten: r.name,
    can_cu: r.citation_urn,
  }));
}

/** Khung phần trăm quá tải đã duyệt, còn hiệu lực tại `ngay`, kèm dòng mức phạt của từng khung. */
export async function khungQuaTaiDaDuyet(
  ngay: string,
): Promise<{ khung: KhungQuaTai[]; muc_phat: Record<string, MucPhatDaDuyet> }> {
  const rows = (await sql`
    SELECT code, version, behavior, fine_min, fine_max, point_deduction, extra_penalties, citation_urn,
           qua_tai_loai, qua_tai_tu, qua_tai_den, qua_tai_bien
    FROM violations
    WHERE qua_tai_loai IS NOT NULL AND vehicle = 'o_to' AND status = 'da_duyet'
      AND effective_from <= ${ngay} AND (effective_to IS NULL OR effective_to > ${ngay})
    ORDER BY code`) as any[];
  return {
    khung: rows.map((r) => ({
      ma: r.code,
      loai: r.qua_tai_loai,
      khoang: {
        tu: Number(r.qua_tai_tu),
        den: r.qua_tai_den === null ? null : Number(r.qua_tai_den),
        bien: r.qua_tai_bien,
      },
    })),
    muc_phat: Object.fromEntries(
      rows.map((r) => [
        r.code,
        {
          ma: r.code,
          version: r.version,
          hanh_vi: r.behavior,
          phat_tu: Number(r.fine_min),
          phat_den: Number(r.fine_max),
          tru_diem: r.point_deduction,
          hinh_thuc_bo_sung: (r.extra_penalties as string[]) ?? [],
          can_cu: r.citation_urn,
        },
      ]),
    ),
  };
}

/** Nguồn của trò: xe dùng được kèm giới hạn và khung đã duyệt. `chiOffline` cho gói offline. */
export async function nguonTramCan(opts: { ngay: string; chiOffline?: boolean }): Promise<NguonTramCan[]> {
  const [ds, gioiHan, { khung, muc_phat }] = await Promise.all([
    noiDungDungDuoc(MA_TRAM_CAN, { chiOffline: opts.chiOffline }),
    gioiHanTaiTrongDaDuyet(opts.ngay),
    khungQuaTaiDaDuyet(opts.ngay),
  ]);
  const kq: NguonTramCan[] = [];
  for (const d of ds) {
    const p = d.payload as unknown as PayloadTramCan;
    if (kiemTraXeTramCan(p).length) continue;
    const { muc, ...xe } = p;
    kq.push({
      id: d.id,
      code: d.code,
      version: d.version,
      topic_id: d.topic_id,
      muc,
      xe,
      gioi_han: gioiHan,
      khung,
      muc_phat,
    });
  }
  return kq;
}

/** URN căn cứ của giới hạn tải trọng đã duyệt (cho scripts/check-citations.ts). */
export async function canCuTaiTrongDaDuyet(): Promise<string[]> {
  const rows = await sql`SELECT DISTINCT citation_urn AS urn FROM load_limits WHERE status = 'da_duyet'`;
  return rows.map((r: any) => r.urn as string);
}

/* ------------------------------------------------------------------ */
/* Nạp xe mẫu                                                          */
/* ------------------------------------------------------------------ */

const GOC = join(import.meta.dir, "..", "..", "..");
const GHI_CHU_DEMO_TRAM_CAN =
  "Dữ liệu demo, chưa duyệt. Xe, phiếu cân, giấy tờ giả định. Dấu đúng, cặp số quyết định suy ra từ giới hạn tải trọng (data/tra-cuu/tai-trong.json) và khung phần trăm quá tải (data/tra-cuu/muc-phat.json); cả hai là SỐ MINH HỌA, kho văn bản chưa có văn bản về tải trọng, giấy phép lưu hành, xử phạt quá tải.";

export interface XeTramCanTep {
  ma: string;
  tieu_de: string;
  muc: number;
  y_do?: string;
  xe: XeTramCan;
}

/** Nạp xe Trạm cân vào chờ duyệt (data/tro-choi/tram-can.json). Chạy lại được; xe sai dạng thì dừng. */
export async function napXeTramCan(
  opts: { tienToTen?: string; xe?: XeTramCanTep[] } = {},
): Promise<{ daTao: number; daCo: number }> {
  const ds =
    opts.xe ??
    ((await Bun.file(join(GOC, "data", "tro-choi", "tram-can.json")).json()) as { xe: XeTramCanTep[] }).xe;
  const [chuDe] = (await sql`SELECT id FROM question_topics WHERE code = 'gt-xu-ly-vi-pham'`) as any[];
  let daTao = 0;
  let daCo = 0;
  for (const x of ds) {
    const payload: PayloadTramCan = { ...x.xe, muc: x.muc };
    const loi = kiemTraXeTramCan(payload);
    if (loi.length) throw new Error(`Xe ${x.ma} không hợp lệ: ${loi.join(" ")}`);
    const tieuDe = `${opts.tienToTen ?? ""}${x.tieu_de}`;
    const [co] =
      (await sql`SELECT id FROM game_content WHERE game_code = ${MA_TRAM_CAN} AND title = ${tieuDe}`) as any[];
    if (co) {
      daCo++;
      continue;
    }
    await taoNoiDungTroChoi(
      {
        game_code: MA_TRAM_CAN,
        topic_id: chuDe?.id ?? null,
        level: x.muc <= 2 ? "de" : x.muc <= 4 ? "trung_binh" : "kho",
        title: tieuDe,
        payload: payload as unknown as Record<string, unknown>,
        answer: {},
        explanation: `${GHI_CHU_DEMO_TRAM_CAN} Ý đồ của xe: ${x.y_do ?? "không ghi"}`,
        citations: [],
        refs: [],
        offline_ok: true,
        status: "cho_duyet",
      },
      "seed-demo",
    );
    daTao++;
  }
  return { daTao, daCo };
}
