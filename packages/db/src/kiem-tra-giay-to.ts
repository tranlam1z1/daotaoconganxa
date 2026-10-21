/**
 * Dữ liệu của trò "Kiểm tra giấy tờ" (docs/PLAN.md GĐ-T1): nạp và đọc luật giấy tờ
 * (`document_rules`), nguồn hồ sơ cho lượt chơi và gói offline.
 *
 * Nguồn của trò là hồ sơ ĐÃ DUYỆT (qua `noiDungDungDuoc`) kèm luật giấy tờ ĐÃ DUYỆT còn hiệu lực tại
 * ngày chơi và mức phạt ĐÃ DUYỆT mà luật trỏ tới. Đáp án không lưu ở đây: bộ kiểm ở packages/dao-tao
 * suy ra từ luật. Sửa một luật thì luật đó về chờ duyệt và rời nguồn; hồ sơ cần luật đó không vào
 * lượt cho tới khi luật được duyệt lại (`dungDuocOMan`).
 */
import {
  type KieuKiem,
  type KieuKiemPhatNguoi,
  type KieuKiemVanTai,
  kiemTraHoSoTroChoi,
  type LoaiGiayTo,
  type LuatGiayTo,
  luatChoXe,
  MA_KIEM_TRA_GIAY_TO,
  type MaLoiGiayTo,
  type MucPhatDaDuyet,
  type NguonGiayTo,
  NHOM_LUAT_MAC_DINH,
  type NhomLuat,
  type PayloadHoSo,
  type PhanHoSoPhatNguoi,
  type PhanLoaiXe,
  type PhanVanTai,
  type ThamSoVanTai,
} from "@qdpl/dao-tao";
import { sql } from "./client.ts";
import { noiDungDungDuoc } from "./noi-dung-tro-choi.ts";
import { type CheDoNap, giuTrangThai, trangThaiNap } from "./tra-cuu-nhanh.ts";

/** Một dòng của data/tra-cuu/luat-giay-to.json (nhóm giấy tờ người lái). */
export interface DongLuatGiayToTep {
  ma: string;
  nhom?: "giay_to_nguoi_lai";
  kiem: KieuKiem;
  giay_to: LoaiGiayTo | null;
  phan_loai: PhanLoaiXe[];
  tham_so: { truong?: "bien_so" | "nhan_hieu"; hang?: string[] };
  ten: string;
  giai_thich: string;
  can_cu: string;
  ma_muc_phat: string | null;
  hieu_luc_tu: string;
  hieu_luc_den?: string | null;
  trang_thai: string;
  ghi_chu?: string | null;
}

/**
 * Một dòng của data/tra-cuu/luat-ho-so-phat-nguoi.json (nhóm `ho_so_phat_nguoi`, GĐ-T11). `phan` là
 * phần hồ sơ được kiểm, lưu ở cột `doc_kind`.
 */
export interface DongLuatPhatNguoiTep
  extends Omit<DongLuatGiayToTep, "nhom" | "kiem" | "giay_to" | "tham_so"> {
  nhom: "ho_so_phat_nguoi";
  kiem: KieuKiemPhatNguoi;
  phan: PhanHoSoPhatNguoi;
  tham_so: { do_mo_toi_da?: number };
}

/**
 * Một dòng của data/tra-cuu/luat-van-tai-khach.json (nhóm `van_tai_khach`, GĐ-T13). `phan` là phần được
 * kiểm (khoang xe, lệnh vận chuyển, phù hiệu, giám sát hành trình), lưu ở cột `doc_kind`.
 */
export interface DongLuatVanTaiTep extends Omit<DongLuatGiayToTep, "nhom" | "kiem" | "giay_to" | "tham_so"> {
  nhom: "van_tai_khach";
  kiem: KieuKiemVanTai;
  phan: PhanVanTai;
  tham_so: ThamSoVanTai;
}

/**
 * Nạp luật giấy tờ, cùng cách với mức phạt: `cheDo = cho_duyet` (mặc định của script) đưa dòng mới
 * hoặc đổi nội dung vào chờ duyệt. Dòng có trong CSDL (trong phạm vi `tienTo` và nhóm `nhom`) mà
 * không còn trong tệp thì chuyển sang ngừng. Mỗi tệp một nhóm (GĐ-T11): nạp tệp của nhóm này không
 * đụng tới luật của nhóm khác.
 */
export async function napLuatGiayTo(
  ds: Array<DongLuatGiayToTep | DongLuatPhatNguoiTep | DongLuatVanTaiTep>,
  opts: { tienTo?: string; cheDo?: CheDoNap; nhom?: NhomLuat } = {},
): Promise<{ daNap: number; ngung: number }> {
  const theoTep = (opts.cheDo ?? "theo_tep") === "theo_tep";
  const nhom = opts.nhom ?? NHOM_LUAT_MAC_DINH;
  const khac = ds.find((d) => (d.nhom ?? NHOM_LUAT_MAC_DINH) !== nhom);
  if (khac) throw new Error(`Luật ${khac.ma} thuộc nhóm khác với nhóm đang nạp (${nhom}).`);
  let ngung = 0;
  await sql.begin(async (tx) => {
    for (const d of ds) {
      await tx`
        INSERT INTO document_rules (code, nhom, check_kind, doc_kind, vehicle_classes, params, name, explanation,
          citation_urn, violation_code, effective_from, effective_to, status, note, updated_at)
        VALUES (${d.ma}, ${nhom}, ${d.kiem}, ${"phan" in d ? d.phan : d.giay_to}, ${d.phan_loai}, ${tx.json(d.tham_so as never)}, ${d.ten},
          ${d.giai_thich}, ${d.can_cu}, ${d.ma_muc_phat}, ${d.hieu_luc_tu}, ${d.hieu_luc_den ?? null},
          ${trangThaiNap(d.trang_thai, theoTep)}, ${d.ghi_chu ?? null}, now())
        ON CONFLICT (code) DO UPDATE SET
          nhom = EXCLUDED.nhom, check_kind = EXCLUDED.check_kind, doc_kind = EXCLUDED.doc_kind,
          vehicle_classes = EXCLUDED.vehicle_classes, params = EXCLUDED.params, name = EXCLUDED.name,
          explanation = EXCLUDED.explanation, citation_urn = EXCLUDED.citation_urn,
          violation_code = EXCLUDED.violation_code, effective_from = EXCLUDED.effective_from,
          effective_to = EXCLUDED.effective_to, note = EXCLUDED.note, updated_at = now(),
          ${giuTrangThai(
            tx,
            "document_rules",
            theoTep,
            tx`(document_rules.check_kind, document_rules.doc_kind, document_rules.vehicle_classes,
            document_rules.params, document_rules.name, document_rules.explanation, document_rules.citation_urn,
            document_rules.violation_code, document_rules.effective_from, document_rules.effective_to)
            IS DISTINCT FROM (EXCLUDED.check_kind, EXCLUDED.doc_kind, EXCLUDED.vehicle_classes, EXCLUDED.params,
            EXCLUDED.name, EXCLUDED.explanation, EXCLUDED.citation_urn, EXCLUDED.violation_code,
            EXCLUDED.effective_from, EXCLUDED.effective_to)`,
          )}`;
    }
    const phamVi = `${(opts.tienTo ?? "").replace(/[\\%_]/g, "\\$&")}%`;
    const r = await tx`
      UPDATE document_rules SET status = 'ngung', updated_at = now()
      WHERE status <> 'ngung' AND created_by IS NULL AND nhom = ${nhom} AND code LIKE ${phamVi}
        AND NOT (code = ANY(${ds.map((d) => d.ma)}))`;
    ngung = r.count;
  });
  return { daNap: ds.length, ngung };
}

/** Luật giấy tờ người lái đã duyệt, còn hiệu lực tại `ngay` (YYYY-MM-DD). */
export async function luatGiayToDaDuyet(ngay: string): Promise<LuatGiayTo[]> {
  const rows = (await sql`
    SELECT code, version, check_kind, doc_kind, vehicle_classes, params, name, explanation, citation_urn,
           violation_code
    FROM document_rules
    WHERE nhom = 'giay_to_nguoi_lai' AND status = 'da_duyet'
      AND effective_from <= ${ngay} AND (effective_to IS NULL OR effective_to > ${ngay})
    ORDER BY code`) as any[];
  return rows.map((r) => ({
    ma: r.code,
    version: r.version,
    kiem: r.check_kind,
    giay_to: r.doc_kind,
    phan_loai: r.vehicle_classes ?? [],
    tham_so: r.params ?? {},
    ten: r.name,
    giai_thich: r.explanation,
    can_cu: r.citation_urn,
    ma_muc_phat: r.violation_code,
  }));
}

/** Mức phạt đã duyệt, còn hiệu lực tại `ngay`, theo mã. Mã không có hoặc chưa duyệt thì vắng. */
export async function mucPhatDaDuyetTheoMa(
  codes: readonly string[],
  ngay: string,
): Promise<Record<string, MucPhatDaDuyet>> {
  if (!codes.length) return {};
  const rows = (await sql`
    SELECT code, version, behavior, fine_min, fine_max, point_deduction, extra_penalties, citation_urn
    FROM violations
    WHERE code = ANY(${[...codes]}) AND status = 'da_duyet'
      AND effective_from <= ${ngay} AND (effective_to IS NULL OR effective_to > ${ngay})`) as any[];
  return Object.fromEntries(
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
  );
}

/** Nguồn của trò: hồ sơ dùng được kèm luật (theo loại xe) và mức phạt. `chiOffline` cho gói offline. */
export async function nguonKiemTraGiayTo(opts: {
  ngay: string;
  chiOffline?: boolean;
}): Promise<NguonGiayTo[]> {
  const [hoSo, luat] = await Promise.all([
    noiDungDungDuoc(MA_KIEM_TRA_GIAY_TO, { chiOffline: opts.chiOffline }),
    luatGiayToDaDuyet(opts.ngay),
  ]);
  const mucPhat = await mucPhatDaDuyetTheoMa(
    [...new Set(luat.map((l) => l.ma_muc_phat).filter((m): m is string => Boolean(m)))],
    opts.ngay,
  );
  const kq: NguonGiayTo[] = [];
  for (const h of hoSo) {
    const p = h.payload as unknown as PayloadHoSo;
    const loi = (h.answer as { loi?: MaLoiGiayTo[] }).loi ?? [];
    if (kiemTraHoSoTroChoi(p, loi).length) continue;
    const { muc, ...hs } = p;
    const luatXe = luatChoXe(luat, hs.xe.phan_loai);
    kq.push({
      id: h.id,
      code: h.code,
      version: h.version,
      topic_id: h.topic_id,
      muc,
      ho_so: hs,
      loi_du_kien: loi,
      luat: luatXe,
      muc_phat: Object.fromEntries(
        luatXe
          .filter((l) => l.ma_muc_phat && mucPhat[l.ma_muc_phat])
          .map((l) => [l.ma_muc_phat!, mucPhat[l.ma_muc_phat!]!]),
      ),
    });
  }
  return kq;
}

/** URN căn cứ của luật giấy tờ đã duyệt (cho scripts/check-citations.ts). */
export async function canCuLuatGiayToDaDuyet(): Promise<string[]> {
  const rows = await sql`SELECT DISTINCT citation_urn AS urn FROM document_rules WHERE status = 'da_duyet'`;
  return rows.map((r: any) => r.urn as string);
}

/** Dòng tệp → luật (phiên bản 1). Dùng khi sinh hồ sơ mẫu từ tệp, chưa qua CSDL. */
export function luatGiayToTuTep(d: DongLuatGiayToTep): LuatGiayTo {
  return {
    ma: d.ma,
    version: 1,
    kiem: d.kiem,
    giay_to: d.giay_to,
    phan_loai: d.phan_loai,
    tham_so: d.tham_so,
    ten: d.ten,
    giai_thich: d.giai_thich,
    can_cu: d.can_cu,
    ma_muc_phat: d.ma_muc_phat,
  };
}
