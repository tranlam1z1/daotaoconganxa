/**
 * Dữ liệu của trò "Dừng xe đúng quy trình" (docs/PLAN.md GĐ-T4): nguồn tình huống cho lượt chơi và gói
 * offline.
 *
 * Nguồn là tình huống ĐÃ DUYỆT (qua `noiDungDungDuoc`) kèm quy trình "Dừng xe kiểm tra" ĐÃ DUYỆT
 * (bảng `procedures`, có phiên bản), luật giấy tờ đã duyệt theo loại xe và mức phạt đã duyệt mà luật
 * hoặc tình huống trỏ tới. Quy trình chưa duyệt thì trò không có nguồn nào. Sửa quy trình thì quy
 * trình về bản nháp và mọi tình huống (có tham chiếu `procedure:dung-xe-kiem-tra`) rút khỏi trò.
 */
import {
  type DapAnDungXe,
  kiemTraTinhHuongDungXe,
  luatChoXe,
  MA_DUNG_XE,
  MA_QUY_TRINH_DUNG_XE,
  type NguonDungXe,
  type PayloadDungXe,
} from "@qdpl/dao-tao";
import { sql } from "./client.ts";
import { luatGiayToDaDuyet, mucPhatDaDuyetTheoMa } from "./kiem-tra-giay-to.ts";
import { noiDungDungDuoc } from "./noi-dung-tro-choi.ts";

/** Quy trình dừng xe đã duyệt, kèm phiên bản; chưa duyệt thì undefined. */
export async function quyTrinhDungXeDaDuyet(): Promise<NguonDungXe["quy_trinh"] | undefined> {
  const [r] = (await sql`
    SELECT code, kind, title, summary, steps, status, version FROM procedures
    WHERE code = ${MA_QUY_TRINH_DUNG_XE} AND status = 'da_duyet'`) as any[];
  if (!r) return undefined;
  return {
    ma: r.code,
    loai: r.kind,
    tieu_de: r.title,
    tom_tat: r.summary ?? undefined,
    cac_buoc: r.steps ?? [],
    trang_thai: r.status,
    version: r.version,
  };
}

/** Nguồn của trò. `chiOffline` cho gói offline. */
export async function nguonDungXe(opts: { ngay: string; chiOffline?: boolean }): Promise<NguonDungXe[]> {
  const [tinhHuong, quyTrinh, luat] = await Promise.all([
    noiDungDungDuoc(MA_DUNG_XE, { chiOffline: opts.chiOffline }),
    quyTrinhDungXeDaDuyet(),
    luatGiayToDaDuyet(opts.ngay),
  ]);
  if (!quyTrinh) return [];
  const hop = tinhHuong
    .map((h) => ({ h, p: h.payload as unknown as PayloadDungXe, d: h.answer as unknown as DapAnDungXe }))
    .filter(({ p, d }) => kiemTraTinhHuongDungXe(p, d).length === 0);
  const maMucPhat = new Set<string>();
  for (const l of luat) if (l.ma_muc_phat) maMucPhat.add(l.ma_muc_phat);
  for (const { d } of hop) for (const v of d.vi_pham_khac) if (v.ma_muc_phat) maMucPhat.add(v.ma_muc_phat);
  const mucPhat = await mucPhatDaDuyetTheoMa([...maMucPhat], opts.ngay);
  return hop.map(({ h, p, d }) => {
    const luatXe = luatChoXe(luat, p.ho_so.xe.phan_loai);
    const ma = new Set([...luatXe.map((l) => l.ma_muc_phat), ...d.vi_pham_khac.map((v) => v.ma_muc_phat)]);
    return {
      id: h.id,
      code: h.code,
      version: h.version,
      topic_id: h.topic_id,
      tinh_huong: p,
      dap_an: d,
      quy_trinh: quyTrinh,
      luat: luatXe,
      muc_phat: Object.fromEntries(Object.entries(mucPhat).filter(([k]) => ma.has(k))),
    };
  });
}
