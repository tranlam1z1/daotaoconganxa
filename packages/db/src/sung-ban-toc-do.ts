/**
 * Nguồn nội dung của trò "Súng bắn tốc độ" (docs/PLAN.md GĐ-G2).
 *
 * Mỗi nguồn là một tình huống xe ĐÃ DUYỆT (qua `noiDungDungDuoc`, nên mọi mục được trỏ tới cũng đã
 * duyệt đúng phiên bản) kèm các khung mức phạt theo tốc độ ĐÃ DUYỆT, còn hiệu lực tại ngày chơi, của
 * đúng loại xe. Đáp án không lưu ở đây: luật thuần suy ra từ khung (packages/dao-tao).
 */
import {
  type KhungPhatTocDo,
  kiemTraTinhHuongTocDo,
  type LoaiXe,
  MA_SUNG_BAN_TOC_DO,
  type NguonSungBan,
  type TinhHuongTocDo,
} from "@qdpl/dao-tao";
import { sql } from "./client.ts";
import { noiDungDungDuoc } from "./noi-dung-tro-choi.ts";

/** Khung mức phạt theo tốc độ đã duyệt, áp dụng tại `ngay`, theo loại xe. */
export async function khungPhatTocDoDaDuyet(ngay: string): Promise<Map<LoaiXe, KhungPhatTocDo[]>> {
  const rows = (await sql`
    SELECT code, version, vehicle, speed_over_min::float8 AS tu, speed_over_max::float8 AS den, speed_bounds,
           fine_min, fine_max, point_deduction, extra_penalties, citation_urn
    FROM violations
    WHERE status = 'da_duyet' AND speed_over_min IS NOT NULL
      AND effective_from <= ${ngay} AND (effective_to IS NULL OR effective_to > ${ngay})
    ORDER BY vehicle, speed_over_min`) as any[];
  const kq = new Map<LoaiXe, KhungPhatTocDo[]>();
  for (const r of rows) {
    const k: KhungPhatTocDo = {
      ma: r.code,
      version: r.version,
      toc_do_vuot: { tu: r.tu, den: r.den, bien: r.speed_bounds },
      phat_tu: Number(r.fine_min),
      phat_den: Number(r.fine_max),
      tru_diem: r.point_deduction,
      hinh_thuc_bo_sung: (r.extra_penalties as string[]) ?? [],
      can_cu: r.citation_urn,
    };
    kq.set(r.vehicle, [...(kq.get(r.vehicle) ?? []), k]);
  }
  return kq;
}

/** Nguồn của trò: tình huống dùng được kèm khung phạt của loại xe. `chiOffline` cho gói offline. */
export async function nguonSungBanTocDo(opts: {
  ngay: string;
  chiOffline?: boolean;
}): Promise<NguonSungBan[]> {
  const [tinhHuong, khung] = await Promise.all([
    noiDungDungDuoc(MA_SUNG_BAN_TOC_DO, { chiOffline: opts.chiOffline }),
    khungPhatTocDoDaDuyet(opts.ngay),
  ]);
  return tinhHuong
    .filter((t) => kiemTraTinhHuongTocDo(t.payload as Partial<TinhHuongTocDo>).length === 0)
    .map((t) => {
      const th = t.payload as unknown as TinhHuongTocDo;
      return {
        id: t.id,
        code: t.code,
        version: t.version,
        topic_id: t.topic_id,
        tinh_huong: {
          loai_xe: th.loai_xe,
          mo_ta_xe: th.mo_ta_xe,
          boi_canh: th.boi_canh,
          bien_toc_do: th.bien_toc_do,
          toc_do_do: th.toc_do_do,
        },
        khung: khung.get(th.loai_xe) ?? [],
      };
    });
}
