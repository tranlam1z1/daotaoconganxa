/**
 * Nạp dữ liệu tài liệu của tra cứu nhanh: luật tài liệu (`document_rules`) và giới hạn tải trọng
 * (`load_limits`).
 *
 * Cùng cách nạp với mức phạt: `cheDo = cho_duyet` (mặc định của script) đưa dòng mới hoặc đổi nội
 * dung vào chờ duyệt. Dòng có trong CSDL mà không còn trong tệp thì chuyển sang ngừng. Mỗi nhóm luật
 * nạp riêng, không đụng tới nhóm khác.
 */
import {
  type DongTaiTrongTep,
  type KieuKiem,
  type KieuKiemPhatNguoi,
  type KieuKiemVanTai,
  type LoaiGiayTo,
  NHOM_LUAT_MAC_DINH,
  type NhomLuat,
  type PhanHoSoPhatNguoi,
  type PhanLoaiXe,
  type PhanVanTai,
  type ThamSoVanTai,
} from "@qdpl/dao-tao";
import { sql } from "./client.ts";
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
 * Một dòng của data/tra-cuu/luat-ho-so-phat-nguoi.json (nhóm `ho_so_phat_nguoi`). `phan` là
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
 * Một dòng của data/tra-cuu/luat-van-tai-khach.json (nhóm `van_tai_khach`). `phan` là phần được
 * kiểm (khoang xe, lệnh vận chuyển, phù hiệu, giám sát hành trình), lưu ở cột `doc_kind`.
 */
export interface DongLuatVanTaiTep extends Omit<DongLuatGiayToTep, "nhom" | "kiem" | "giay_to" | "tham_so"> {
  nhom: "van_tai_khach";
  kiem: KieuKiemVanTai;
  phan: PhanVanTai;
  tham_so: ThamSoVanTai;
}

/**
 * Nạp luật tài liệu, cùng cách với mức phạt: `cheDo = cho_duyet` (mặc định của script) đưa dòng mới
 * hoặc đổi nội dung vào chờ duyệt. Dòng có trong CSDL (trong phạm vi `tienTo` và nhóm `nhom`) mà
 * không còn trong tệp thì chuyển sang ngừng. Mỗi tệp một nhóm: nạp tệp của nhóm này không đụng
 * tới luật của nhóm khác.
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

/** URN căn cứ của luật tài liệu đã duyệt (cho scripts/check-citations.ts). */
export async function canCuLuatGiayToDaDuyet(): Promise<string[]> {
  const rows = await sql`SELECT DISTINCT citation_urn AS urn FROM document_rules WHERE status = 'da_duyet'`;
  return rows.map((r: any) => r.urn as string);
}

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

/** URN căn cứ của giới hạn tải trọng đã duyệt (cho scripts/check-citations.ts). */
export async function canCuTaiTrongDaDuyet(): Promise<string[]> {
  const rows = await sql`SELECT DISTINCT citation_urn AS urn FROM load_limits WHERE status = 'da_duyet'`;
  return rows.map((r: any) => r.urn as string);
}
