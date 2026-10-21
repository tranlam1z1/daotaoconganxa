/**
 * Dữ liệu của trò "Lên xe khách" (docs/PLAN.md GĐ-T13): luật vận tải hành khách đã duyệt (`document_rules`,
 * nhóm `van_tai_khach`, câu D16), nguồn xe cho lượt chơi và gói offline, nạp xe mẫu.
 *
 * Nguồn là xe ĐÃ DUYỆT (qua `noiDungDungDuoc`) kèm luật vận tải ĐÃ DUYỆT còn hiệu lực tại ngày chơi và dòng
 * mức phạt ĐÃ DUYỆT mà luật trỏ tới. Đáp án không lưu ở đây: packages/dao-tao (len-xe-khach.ts) suy ra từ
 * luật, nên ngưỡng thời gian lái đổi sau khi duyệt lại thì đáp án đổi theo. Sửa một luật thì luật về chờ
 * duyệt và rời nguồn; xe cần luật đó không vào lượt (`xeKhachDungDuocOMan`).
 */
import { join } from "node:path";
import {
  kiemTraXeKhachTroChoi,
  type LuatVanTaiKhach,
  MA_LEN_XE_KHACH,
  type MaLoiVanTai,
  type NguonXeKhach,
  type PayloadXeKhach,
  type XeKhach,
} from "@qdpl/dao-tao";
import { sql } from "./client.ts";
import { mucPhatDaDuyetTheoMa } from "./kiem-tra-giay-to.ts";
import { noiDungDungDuoc, taoNoiDungTroChoi } from "./noi-dung-tro-choi.ts";

/** Luật vận tải hành khách đã duyệt, còn hiệu lực tại `ngay` (YYYY-MM-DD). */
export async function luatVanTaiDaDuyet(ngay: string): Promise<LuatVanTaiKhach[]> {
  const rows = (await sql`
    SELECT code, version, check_kind, doc_kind, params, name, explanation, citation_urn, violation_code
    FROM document_rules
    WHERE nhom = 'van_tai_khach' AND status = 'da_duyet'
      AND effective_from <= ${ngay} AND (effective_to IS NULL OR effective_to > ${ngay})
    ORDER BY code`) as any[];
  return rows.map((r) => ({
    ma: r.code,
    version: r.version,
    nhom: "van_tai_khach" as const,
    kiem: r.check_kind,
    phan: r.doc_kind,
    tham_so: r.params ?? {},
    ten: r.name,
    giai_thich: r.explanation,
    can_cu: r.citation_urn,
    ma_muc_phat: r.violation_code,
  }));
}

/** Nguồn của trò: xe dùng được kèm luật và mức phạt. `chiOffline` cho gói offline. */
export async function nguonLenXeKhach(opts: { ngay: string; chiOffline?: boolean }): Promise<NguonXeKhach[]> {
  const [ds, luat] = await Promise.all([
    noiDungDungDuoc(MA_LEN_XE_KHACH, { chiOffline: opts.chiOffline }),
    luatVanTaiDaDuyet(opts.ngay),
  ]);
  const mucPhat = await mucPhatDaDuyetTheoMa(
    [...new Set(luat.map((l) => l.ma_muc_phat).filter((m): m is string => Boolean(m)))],
    opts.ngay,
  );
  const kq: NguonXeKhach[] = [];
  for (const d of ds) {
    const p = d.payload as unknown as PayloadXeKhach;
    const loi = (d.answer as { loi?: MaLoiVanTai[] }).loi ?? [];
    if (kiemTraXeKhachTroChoi(p, loi).length) continue;
    const { muc, ...xe } = p;
    kq.push({
      id: d.id,
      code: d.code,
      version: d.version,
      topic_id: d.topic_id,
      muc,
      xe,
      loi_du_kien: loi,
      luat,
      muc_phat: mucPhat,
    });
  }
  return kq;
}

/* ------------------------------------------------------------------ */
/* Nạp xe mẫu                                                          */
/* ------------------------------------------------------------------ */

const GOC = join(import.meta.dir, "..", "..", "..");
const GHI_CHU_DEMO_XE_KHACH =
  "Dữ liệu demo, chưa duyệt. Xe, hành khách, giấy tờ, dữ liệu giám sát giả định. Lỗi suy ra từ luật vận tải hành khách (data/tra-cuu/luat-van-tai-khach.json), luật này còn là bản nháp: kho văn bản chưa có văn bản về chở quá số người, lệnh vận chuyển, phù hiệu, thiết bị giám sát hành trình, thời gian lái xe. Ngưỡng thời gian lái trong luật là SỐ MINH HỌA. Chưa có luật cách tính trẻ em: xe có trẻ em không vào lượt cho tới khi đơn vị chuyên môn soạn và duyệt luật đó.";

export interface XeKhachTep {
  ma: string;
  tieu_de: string;
  muc: number;
  loi: MaLoiVanTai[];
  y_do?: string;
  xe: XeKhach;
}

/** Nạp xe Lên xe khách vào chờ duyệt (data/tro-choi/xe-khach.json). Chạy lại được; xe sai dạng thì dừng. */
export async function napXeKhach(
  opts: { tienToTen?: string; xe?: XeKhachTep[] } = {},
): Promise<{ daTao: number; daCo: number }> {
  const ds =
    opts.xe ??
    ((await Bun.file(join(GOC, "data", "tro-choi", "xe-khach.json")).json()) as { xe: XeKhachTep[] }).xe;
  const [chuDe] = (await sql`SELECT id FROM question_topics WHERE code = 'gt-xu-ly-vi-pham'`) as any[];
  let daTao = 0;
  let daCo = 0;
  for (const x of ds) {
    const payload: PayloadXeKhach = { ...x.xe, muc: x.muc };
    const loi = kiemTraXeKhachTroChoi(payload, x.loi);
    if (loi.length) throw new Error(`Xe ${x.ma} không hợp lệ: ${loi.join(" ")}`);
    const tieuDe = `${opts.tienToTen ?? ""}${x.tieu_de}`;
    const [co] =
      (await sql`SELECT id FROM game_content WHERE game_code = ${MA_LEN_XE_KHACH} AND title = ${tieuDe}`) as any[];
    if (co) {
      daCo++;
      continue;
    }
    await taoNoiDungTroChoi(
      {
        game_code: MA_LEN_XE_KHACH,
        topic_id: chuDe?.id ?? null,
        level: x.muc <= 2 ? "de" : x.muc <= 4 ? "trung_binh" : "kho",
        title: tieuDe,
        payload: payload as unknown as Record<string, unknown>,
        answer: { loi: x.loi },
        explanation: `${GHI_CHU_DEMO_XE_KHACH} Ý đồ của xe: ${x.y_do ?? "không ghi"}`,
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
