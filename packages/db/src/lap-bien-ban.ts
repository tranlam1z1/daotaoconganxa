/**
 * Nguồn nội dung của trò "Lập biên bản" (docs/PLAN.md GĐ-G3).
 *
 * Mỗi nguồn là một tình huống ĐÃ DUYỆT (qua `noiDungDungDuoc`, nên mọi mức phạt được trỏ tới cũng
 * đã duyệt đúng phiên bản) kèm các dòng mức phạt ĐÃ DUYỆT, còn hiệu lực tại ngày chơi, cùng loại xe
 * với hành vi đúng. Điều khoản, khung tiền, hình thức bổ sung lấy từ các dòng đó, không lưu lại.
 */
import {
  type DapAnBienBanGoc,
  type LoaiXe,
  MA_LAP_BIEN_BAN,
  type MucPhatBienBan,
  type NguonLapBienBan,
  type TinhHuongBienBan,
} from "@qdpl/dao-tao";
import { sql } from "./client.ts";
import { noiDungDungDuoc } from "./noi-dung-tro-choi.ts";

/** Mức phạt đã duyệt, áp dụng tại `ngay` (mọi hành vi, kể cả theo tốc độ). */
export async function mucPhatDaDuyetTai(ngay: string): Promise<MucPhatBienBan[]> {
  const rows = (await sql`
    SELECT code, version, vehicle, group_name, behavior, keywords, fine_min, fine_max, point_deduction,
           extra_penalties, citation_urn
    FROM violations
    WHERE status = 'da_duyet'
      AND effective_from <= ${ngay} AND (effective_to IS NULL OR effective_to > ${ngay})
    ORDER BY code`) as any[];
  return rows.map((r) => ({
    ma: r.code,
    version: r.version,
    xe: r.vehicle as LoaiXe,
    nhom: r.group_name,
    hanh_vi: r.behavior,
    tu_khoa: r.keywords ?? [],
    phat_tu: Number(r.fine_min),
    phat_den: Number(r.fine_max),
    tru_diem: r.point_deduction,
    hinh_thuc_bo_sung: (r.extra_penalties as string[]) ?? [],
    can_cu: r.citation_urn,
  }));
}

/** Nguồn của trò. Tình huống trỏ tới mức phạt không còn hiệu lực tại ngày chơi bị luật thuần loại. */
export async function nguonLapBienBan(opts: {
  ngay: string;
  chiOffline?: boolean;
}): Promise<NguonLapBienBan[]> {
  const [tinhHuong, mucPhat] = await Promise.all([
    noiDungDungDuoc(MA_LAP_BIEN_BAN, { chiOffline: opts.chiOffline }),
    mucPhatDaDuyetTai(opts.ngay),
  ]);
  const theoMa = new Map(mucPhat.map((r) => [r.ma, r]));
  return tinhHuong.map((t) => {
    const p = t.payload as Partial<TinhHuongBienBan>;
    const a = t.answer as Partial<DapAnBienBanGoc>;
    const viPham = Array.isArray(a.vi_pham) ? a.vi_pham.map(String) : [];
    const xe = theoMa.get(viPham[0] ?? "")?.xe;
    return {
      id: t.id,
      code: t.code,
      version: t.version,
      topic_id: t.topic_id,
      tinh_huong: { loi_ke: String(p.loi_ke ?? ""), hinh: typeof p.hinh === "string" ? p.hinh : null },
      dap_an: {
        vi_pham: viPham,
        ...(Array.isArray(a.muc_cu_the) ? { muc_cu_the: a.muc_cu_the } : {}),
      },
      muc_phat: mucPhat.filter((r) => r.xe === xe),
      can_cu_khac: [...new Set(mucPhat.filter((r) => r.xe !== xe).map((r) => r.can_cu))],
    };
  });
}
