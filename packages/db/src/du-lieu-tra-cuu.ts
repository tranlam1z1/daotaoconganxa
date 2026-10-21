/**
 * Duyệt dữ liệu tra cứu trong ứng dụng (docs/PLAN.md GĐ-G0, docs/GAME_DESIGN.md §3.1): mức phạt,
 * biển báo, quy trình, biểu mẫu đi qua cùng vòng đời duyệt với câu hỏi, thay cho việc sửa `trang_thai`
 * trong tệp JSON.
 *
 * Ba bảng giữ tên trạng thái lưu trữ cũ là `ngung`; tệp này ánh xạ `luu_tru` ↔ `ngung` để luật
 * chung ở @qdpl/dao-tao (vong-doi-duyet.ts) dùng được nguyên vẹn.
 */
import {
  chuoiTimBienBao,
  type LoaiXe,
  NHOM_LUAT,
  type NhomLuat,
  TEN_LOAI_XE,
  type TrangThaiDuyet,
} from "@qdpl/dao-tao";
import type { LoaiTepTaiLieu, TepTaiLieu } from "./bieu-mau.ts";
import { sql, type Tx } from "./client.ts";

export const LOAI_DU_LIEU_TRA_CUU = [
  "muc-phat",
  "bien-bao",
  "quy-trinh",
  "toc-do-toi-da",
  "luat-giay-to",
  "tai-trong",
  "bieu-mau",
] as const;
export type LoaiDuLieuTraCuu = (typeof LOAI_DU_LIEU_TRA_CUU)[number];

const BANG: Record<LoaiDuLieuTraCuu, { bang: string; kind: string; ten: string }> = {
  "muc-phat": { bang: "violations", kind: "violation", ten: "behavior" },
  "bien-bao": { bang: "traffic_signs", kind: "traffic_sign", ten: "name" },
  "quy-trinh": { bang: "procedures", kind: "procedure", ten: "title" },
  // Tốc độ tối đa theo loại xe và loại đường (GĐ-G2).
  "toc-do-toi-da": { bang: "speed_limits", kind: "speed_limit", ten: "name" },
  // Luật giấy tờ của trò Kiểm tra giấy tờ (GĐ-T1).
  "luat-giay-to": { bang: "document_rules", kind: "document_rule", ten: "name" },
  // Giới hạn tải trọng của trò Trạm cân (GĐ-T12, câu D17).
  "tai-trong": { bang: "load_limits", kind: "load_limit", ten: "name" },
  // Biểu mẫu, hướng dẫn dạng tệp của trang "Quy trình, Biểu mẫu" (migration 0066).
  "bieu-mau": { bang: "form_templates", kind: "form_template", ten: "title" },
};

export const tenLichSuDuLieu = (loai: LoaiDuLieuTraCuu) => BANG[loai].kind;

/** Trạng thái trong bảng → trạng thái của luật chung. */
export function sangTrangThaiChung(status: string): TrangThaiDuyet {
  return (status === "ngung" ? "luu_tru" : status) as TrangThaiDuyet;
}
/** Trạng thái của luật chung → trạng thái trong bảng. */
export function sangTrangThaiBang(status: TrangThaiDuyet): string {
  return status === "luu_tru" ? "ngung" : status;
}

export interface DongDuLieuRow {
  code: string;
  ten: string;
  status: string;
  version: number;
  approved_by: string | null;
  approved_at: Date | null;
  reject_reason: string | null;
  topic_id: string | null;
  updated_at: Date;
  [k: string]: unknown;
}

/** Lọc nhóm luật (GĐ-T11): chỉ có nghĩa với luật giấy tờ; nhóm lạ thì bỏ qua. */
const locNhom = (loai: LoaiDuLieuTraCuu, nhom?: string) =>
  loai === "luat-giay-to" && (NHOM_LUAT as readonly string[]).includes(nhom ?? "")
    ? sql`nhom = ${nhom as NhomLuat}`
    : sql`true`;

export async function danhSachDuLieuTraCuu(
  loai: LoaiDuLieuTraCuu,
  loc: { status?: string; q?: string; nhom?: string; limit?: number; offset?: number } = {},
): Promise<{ items: DongDuLieuRow[]; tong: number }> {
  const b = BANG[loai];
  const dk = [locNhom(loai, loc.nhom)];
  if (loc.status) dk.push(sql`status = ${sangTrangThaiBang(loc.status as TrangThaiDuyet)}`);
  if (loc.q) dk.push(sql`(code ILIKE ${`%${loc.q}%`} OR ${sql(b.ten)} ILIKE ${`%${loc.q}%`})`);
  const where = dk.reduce((a, c) => sql`${a} AND ${c}`);
  const [items, [dem]] = await Promise.all([
    sql<DongDuLieuRow[]>`
      SELECT *, ${sql(b.ten)} AS ten FROM ${sql(b.bang)}
      WHERE ${where}
      ORDER BY CASE status WHEN 'cho_duyet' THEN 0 WHEN 'nhap' THEN 1 WHEN 'tu_choi' THEN 2 ELSE 3 END, code
      LIMIT ${loc.limit ?? 500} OFFSET ${loc.offset ?? 0}`,
    sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM ${sql(b.bang)} WHERE ${where}`,
  ]);
  return { items, tong: dem?.n ?? 0 };
}

export async function dongDuLieuTraCuu(
  loai: LoaiDuLieuTraCuu,
  code: string,
): Promise<DongDuLieuRow | undefined> {
  const b = BANG[loai];
  const [r] = await sql<DongDuLieuRow[]>`
    SELECT *, ${sql(b.ten)} AS ten FROM ${sql(b.bang)} WHERE code = ${code}`;
  return r;
}

export async function demDuLieuTheoTrangThai(
  loai: LoaiDuLieuTraCuu,
  nhom?: string,
): Promise<Record<string, number>> {
  const rows = (await sql`
    SELECT status, count(*)::int AS n FROM ${sql(BANG[loai].bang)} WHERE ${locNhom(loai, nhom)} GROUP BY status`) as any[];
  return Object.fromEntries(rows.map((r) => [sangTrangThaiChung(r.status), r.n]));
}

/** Số dòng chờ duyệt của từng loại, để trang duyệt báo ngay trên tab loại nào còn việc. */
export async function demChoDuyetMoiLoai(): Promise<Record<LoaiDuLieuTraCuu, number>> {
  const dem = await Promise.all(
    LOAI_DU_LIEU_TRA_CUU.map(async (loai) => {
      const [r] = await sql<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM ${sql(BANG[loai].bang)} WHERE status = 'cho_duyet'`;
      return [loai, r?.n ?? 0] as const;
    }),
  );
  return Object.fromEntries(dem) as Record<LoaiDuLieuTraCuu, number>;
}

/** Lịch sử duyệt của một dòng dữ liệu tra cứu, đọc từ `content_reviews`. */
export async function lichSuDuyetDuLieu(
  kind: string,
  ref: string,
): Promise<Array<{ version: number; action: string; actor: string; note: string | null; created_at: Date }>> {
  return await sql`
    SELECT version, action, actor, note, created_at FROM content_reviews
    WHERE kind = ${kind} AND ref = ${ref} ORDER BY created_at, id`;
}

async function ghiLichSu(
  tx: Tx,
  kind: string,
  ref: string,
  version: number,
  action: string,
  actor: string,
  note?: string | null,
) {
  await tx`
    INSERT INTO content_reviews (kind, ref, version, action, actor, note)
    VALUES (${kind}, ${ref}, ${version}, ${action}, ${actor}, ${note ?? null})`;
}

/** Trường sửa được của từng loại: mọi trường trừ mã, vì trò chơi và lịch sử duyệt trỏ theo mã. */
export interface SuaMucPhat {
  vehicle: LoaiXe;
  behavior: string;
  group_name: string | null;
  keywords: string[];
  fine_min: number;
  fine_max: number;
  point_deduction: number | null;
  extra_penalties: string[];
  /** Khoảng tốc độ vượt của lỗi quá tốc độ; `speed_over_min` null là dòng không theo tốc độ. */
  speed_over_min: number | null;
  speed_over_max: number | null;
  speed_bounds: string;
  /** Khung phần trăm quá tải (GĐ-T12); `qua_tai_loai` null là dòng không theo quá tải. */
  qua_tai_loai: string | null;
  qua_tai_tu: number | null;
  qua_tai_den: number | null;
  qua_tai_bien: string;
  citation_urn: string;
  effective_from: string;
  effective_to: string | null;
  note: string | null;
  topic_id: string | null;
}
export interface SuaBienBao {
  group_name: string;
  name: string;
  meaning: string;
  citation_urn: string;
  /** Thao tác đúng và giải thích trong trò Cung đường biển báo (GĐ-G8); null: biển không dùng. */
  reaction: string | null;
  reaction_note: string | null;
  note: string | null;
  topic_id: string | null;
}
/** Tốc độ tối đa: sửa mọi trường trừ mã. Tên hiển thị ghép từ loại xe và tên loại đường. */
export interface SuaTocDoToiDa {
  vehicle_class: string;
  violation_vehicle: LoaiXe;
  road_type: string;
  road_type_name: string;
  max_speed: number;
  citation_urn: string;
  effective_from: string;
  effective_to: string | null;
  note: string | null;
  topic_id: string | null;
}
/**
 * Luật giấy tờ: sửa mọi trường trừ mã. Kiểu kiểm, phần được kiểm và tham số phải hợp nhau theo nhóm;
 * tầng gọi kiểm bằng `kiemTraLuatGiayTo` (@qdpl/dao-tao) trước khi ghi.
 */
export interface SuaLuatGiayTo {
  nhom: NhomLuat;
  check_kind: string;
  /** Giấy tờ (nhóm người lái) hoặc phần được kiểm (nhóm hồ sơ phạt nguội, vận tải khách). */
  doc_kind: string | null;
  /** Loại xe áp dụng; rỗng là mọi loại. */
  vehicle_classes: string[];
  params: Record<string, unknown>;
  name: string;
  explanation: string;
  citation_urn: string;
  violation_code: string | null;
  effective_from: string;
  effective_to: string | null;
  note: string | null;
  topic_id: string | null;
}
/** Giới hạn tải trọng (GĐ-T12): sửa mọi trường trừ mã. Số trục, khoảng cách trục chỉ có ở cụm trục. */
export interface SuaTaiTrong {
  kind: "tong" | "truc_don" | "cum_truc";
  vehicle_class: string | null;
  group_axles: number | null;
  spacing_from_cm: number | null;
  spacing_to_cm: number | null;
  limit_kg: number;
  name: string;
  citation_urn: string;
  effective_from: string;
  effective_to: string | null;
  note: string | null;
  topic_id: string | null;
}
export interface SuaQuyTrinh {
  kind: "vi_pham" | "tai_nan";
  title: string;
  summary: string | null;
  steps: Array<{ tieu_de: string; mo_ta: string; can_cu?: string | null }>;
  note: string | null;
  topic_id: string | null;
}
/** Biểu mẫu: sửa tên, tóm tắt, loại. Tệp thay bằng `thayTepBieuMau`, phân loại bằng `phanLoaiTaiLieu`. */
export interface SuaBieuMau {
  title: string;
  summary: string | null;
  kind: LoaiTepTaiLieu;
  note: string | null;
  topic_id: string | null;
}

/**
 * Sửa một dòng. Chỉ ghi khi `version` khớp. `sau` là hệ quả tính bằng `hauQuaSua` (trạng thái
 * theo luật chung): sửa dòng đã duyệt thì về chờ duyệt và tăng phiên bản, nên tình huống trò chơi
 * trỏ tới dòng này tự rút khỏi trò chơi cho tới khi duyệt lại.
 */
export async function suaDuLieuTraCuu(
  loai: LoaiDuLieuTraCuu,
  code: string,
  du: SuaMucPhat | SuaBienBao | SuaQuyTrinh | SuaTocDoToiDa | SuaLuatGiayTo | SuaTaiTrong | SuaBieuMau,
  versionCu: number,
  sau: { status: TrangThaiDuyet; version: number },
  actor: string,
): Promise<boolean> {
  const status = sangTrangThaiBang(sau.status);
  return (await sql.begin(async (tx) => {
    let r: { count: number };
    if (loai === "muc-phat") {
      const d = du as SuaMucPhat;
      const noi = [d.behavior, ...d.keywords, d.group_name ?? ""].join(" ");
      r = await tx`
        UPDATE violations SET vehicle = ${d.vehicle}, behavior = ${d.behavior}, group_name = ${d.group_name},
          keywords = ${d.keywords}, search_text = unaccent(lower(${noi})),
          fine_min = ${d.fine_min}, fine_max = ${d.fine_max}, point_deduction = ${d.point_deduction},
          extra_penalties = ${tx.json(d.extra_penalties as never)},
          speed_over_min = ${d.speed_over_min}, speed_over_max = ${d.speed_over_max},
          speed_bounds = ${d.speed_bounds}, qua_tai_loai = ${d.qua_tai_loai}, qua_tai_tu = ${d.qua_tai_tu},
          qua_tai_den = ${d.qua_tai_den}, qua_tai_bien = ${d.qua_tai_bien}, citation_urn = ${d.citation_urn},
          effective_from = ${d.effective_from}, effective_to = ${d.effective_to},
          note = ${d.note}, topic_id = ${d.topic_id},
          status = ${status}, version = ${sau.version}, updated_at = now()
        WHERE code = ${code} AND version = ${versionCu}`;
    } else if (loai === "bien-bao") {
      const d = du as SuaBienBao;
      r = await tx`
        UPDATE traffic_signs SET group_name = ${d.group_name}, name = ${d.name}, meaning = ${d.meaning},
          citation_urn = ${d.citation_urn},
          reaction = ${d.reaction}, reaction_note = ${d.reaction_note}, note = ${d.note}, topic_id = ${d.topic_id}, search_text = ${chuoiTimBienBao({ ma: code, ten: d.name })},
          status = ${status}, version = ${sau.version}, updated_at = now()
        WHERE code = ${code} AND version = ${versionCu}`;
    } else if (loai === "toc-do-toi-da") {
      const d = du as SuaTocDoToiDa;
      r = await tx`
        UPDATE speed_limits SET vehicle_class = ${d.vehicle_class}, violation_vehicle = ${d.violation_vehicle},
          road_type = ${d.road_type}, road_type_name = ${d.road_type_name},
          name = ${`${d.vehicle_class} — ${d.road_type_name}`},
          max_speed = ${d.max_speed}, citation_urn = ${d.citation_urn},
          effective_from = ${d.effective_from}, effective_to = ${d.effective_to},
          note = ${d.note}, topic_id = ${d.topic_id},
          status = ${status}, version = ${sau.version}, updated_at = now()
        WHERE code = ${code} AND version = ${versionCu}`;
    } else if (loai === "tai-trong") {
      const d = du as SuaTaiTrong;
      r = await tx`
        UPDATE load_limits SET kind = ${d.kind}, vehicle_class = ${d.vehicle_class},
          group_axles = ${d.group_axles}, spacing_from_cm = ${d.spacing_from_cm},
          spacing_to_cm = ${d.spacing_to_cm}, limit_kg = ${d.limit_kg}, name = ${d.name},
          citation_urn = ${d.citation_urn}, effective_from = ${d.effective_from},
          effective_to = ${d.effective_to}, note = ${d.note}, topic_id = ${d.topic_id},
          status = ${status}, version = ${sau.version}, updated_at = now()
        WHERE code = ${code} AND version = ${versionCu}`;
    } else if (loai === "luat-giay-to") {
      const d = du as SuaLuatGiayTo;
      r = await tx`
        UPDATE document_rules SET nhom = ${d.nhom}, check_kind = ${d.check_kind}, doc_kind = ${d.doc_kind},
          vehicle_classes = ${d.vehicle_classes}, params = ${tx.json(d.params as never)},
          name = ${d.name}, explanation = ${d.explanation},
          citation_urn = ${d.citation_urn}, violation_code = ${d.violation_code},
          effective_from = ${d.effective_from}, effective_to = ${d.effective_to}, note = ${d.note},
          topic_id = ${d.topic_id}, status = ${status}, version = ${sau.version}, updated_at = now()
        WHERE code = ${code} AND version = ${versionCu}`;
    } else if (loai === "bieu-mau") {
      const d = du as SuaBieuMau;
      r = await tx`
        UPDATE form_templates SET title = ${d.title}, summary = ${d.summary}, kind = ${d.kind},
          note = ${d.note}, topic_id = ${d.topic_id},
          status = ${status}, version = ${sau.version}, updated_at = now()
        WHERE code = ${code} AND version = ${versionCu}`;
    } else {
      const d = du as SuaQuyTrinh;
      r = await tx`
        UPDATE procedures SET kind = ${d.kind}, title = ${d.title}, summary = ${d.summary},
          steps = ${tx.json(d.steps as never)},
          note = ${d.note}, topic_id = ${d.topic_id},
          status = ${status}, version = ${sau.version}, updated_at = now()
        WHERE code = ${code} AND version = ${versionCu}`;
    }
    if (!r.count) return false;
    await ghiLichSu(tx, BANG[loai].kind, code, sau.version, "sua", actor);
    return true;
  })) as boolean;
}

/**
 * Loại soạn được dòng mới trong ứng dụng bằng JSON. Biển báo và biểu mẫu kèm ảnh, tệp nên soạn riêng
 * qua `taoBienBao`, `taoBieuMau`.
 */
export const LOAI_SOAN_DUOC = [
  "muc-phat",
  "quy-trinh",
  "toc-do-toi-da",
  "luat-giay-to",
  "tai-trong",
] as const satisfies readonly LoaiDuLieuTraCuu[];
export type LoaiSoanDuoc = (typeof LOAI_SOAN_DUOC)[number];

export interface TaoLuatGiayTo extends SuaLuatGiayTo {
  code: string;
}
export interface TaoTocDoToiDa extends SuaTocDoToiDa {
  code: string;
}
export interface TaoTaiTrong extends SuaTaiTrong {
  code: string;
}

export interface TaoMucPhat extends SuaMucPhat {
  code: string;
}
export interface TaoQuyTrinh extends SuaQuyTrinh, PhanLoaiLucTao {
  code: string;
}
/** Phương tiện và loại vi phạm gắn ngay lúc soạn; null là không gắn. */
interface PhanLoaiLucTao {
  vehicle: LoaiXe | null;
  group_name: string | null;
}

/**
 * Thêm một dòng soạn trong ứng dụng, ở trạng thái `status` (nhap hoặc cho_duyet), phiên bản 1.
 * Trả false khi mã đã có (kể cả dòng đã ngừng). `created_by` giữ dòng khỏi bị lệnh nạp tệp ngừng.
 */
export async function taoDuLieuTraCuu(
  loai: LoaiSoanDuoc,
  du: TaoMucPhat | TaoQuyTrinh | TaoTocDoToiDa | TaoLuatGiayTo | TaoTaiTrong,
  status: "nhap" | "cho_duyet",
  actor: string,
): Promise<boolean> {
  return (await sql.begin(async (tx) => {
    let r: { count: number };
    if (loai === "muc-phat") {
      const d = du as TaoMucPhat;
      const noi = [d.behavior, ...d.keywords, d.group_name ?? ""].join(" ");
      r = await tx`
        INSERT INTO violations (code, vehicle, group_name, behavior, keywords, search_text,
          fine_min, fine_max, extra_penalties, point_deduction, speed_over_min, speed_over_max, speed_bounds,
          qua_tai_loai, qua_tai_tu, qua_tai_den, qua_tai_bien,
          citation_urn, effective_from, effective_to, status, note, topic_id, created_by, updated_at)
        VALUES (${d.code}, ${d.vehicle}, ${d.group_name}, ${d.behavior}, ${d.keywords}, unaccent(lower(${noi})),
          ${d.fine_min}, ${d.fine_max}, ${tx.json(d.extra_penalties as never)}, ${d.point_deduction},
          ${d.speed_over_min}, ${d.speed_over_max}, ${d.speed_bounds},
          ${d.qua_tai_loai}, ${d.qua_tai_tu}, ${d.qua_tai_den}, ${d.qua_tai_bien}, ${d.citation_urn},
          ${d.effective_from}, ${d.effective_to}, ${status}, ${d.note}, ${d.topic_id}, ${actor}, now())
        ON CONFLICT (code) DO NOTHING`;
    } else if (loai === "toc-do-toi-da") {
      const d = du as TaoTocDoToiDa;
      r = await tx`
        INSERT INTO speed_limits (code, vehicle_class, violation_vehicle, road_type, road_type_name, name,
          max_speed, citation_urn, effective_from, effective_to, status, note, topic_id, created_by, updated_at)
        VALUES (${d.code}, ${d.vehicle_class}, ${d.violation_vehicle}, ${d.road_type}, ${d.road_type_name},
          ${`${d.vehicle_class} — ${d.road_type_name}`}, ${d.max_speed}, ${d.citation_urn},
          ${d.effective_from}, ${d.effective_to}, ${status}, ${d.note}, ${d.topic_id}, ${actor}, now())
        ON CONFLICT (code) DO NOTHING`;
    } else if (loai === "luat-giay-to") {
      const d = du as TaoLuatGiayTo;
      r = await tx`
        INSERT INTO document_rules (code, nhom, check_kind, doc_kind, vehicle_classes, params, name,
          explanation, citation_urn, violation_code, effective_from, effective_to, status, note, topic_id,
          created_by, updated_at)
        VALUES (${d.code}, ${d.nhom}, ${d.check_kind}, ${d.doc_kind}, ${d.vehicle_classes},
          ${tx.json(d.params as never)}, ${d.name}, ${d.explanation}, ${d.citation_urn}, ${d.violation_code},
          ${d.effective_from}, ${d.effective_to}, ${status}, ${d.note}, ${d.topic_id}, ${actor}, now())
        ON CONFLICT (code) DO NOTHING`;
    } else if (loai === "tai-trong") {
      const d = du as TaoTaiTrong;
      r = await tx`
        INSERT INTO load_limits (code, kind, vehicle_class, group_axles, spacing_from_cm, spacing_to_cm,
          limit_kg, name, citation_urn, effective_from, effective_to, status, note, topic_id, created_by,
          updated_at)
        VALUES (${d.code}, ${d.kind}, ${d.vehicle_class}, ${d.group_axles}, ${d.spacing_from_cm},
          ${d.spacing_to_cm}, ${d.limit_kg}, ${d.name}, ${d.citation_urn}, ${d.effective_from},
          ${d.effective_to}, ${status}, ${d.note}, ${d.topic_id}, ${actor}, now())
        ON CONFLICT (code) DO NOTHING`;
    } else {
      const d = du as TaoQuyTrinh;
      r = await tx`
        INSERT INTO procedures (code, kind, title, summary, steps, ordinal, vehicle, group_name,
          status, note, topic_id, created_by, updated_at)
        VALUES (${d.code}, ${d.kind}, ${d.title}, ${d.summary}, ${tx.json(d.steps as never)},
          (SELECT coalesce(max(ordinal), -1) + 1 FROM procedures), ${d.vehicle}, ${d.group_name},
          ${status}, ${d.note}, ${d.topic_id}, ${actor}, now())
        ON CONFLICT (code) DO NOTHING`;
    }
    if (!r.count) return false;
    await ghiLichSu(tx, BANG[loai].kind, du.code, 1, "tao", actor);
    if (status === "cho_duyet") await ghiLichSu(tx, BANG[loai].kind, du.code, 1, "gui_duyet", actor);
    return true;
  })) as boolean;
}

export interface TaoBienBao extends SuaBienBao {
  code: string;
  /** URI ảnh biển trong kho đối tượng (assets/bien-bao/…). */
  image_uri: string;
}

/**
 * Thêm một biển báo soạn trong ứng dụng (ảnh đã nằm trong kho đối tượng), ở trạng thái `status`, phiên
 * bản 1, xếp cuối nhóm. Trả false khi mã đã có (kể cả biển đã ngừng).
 */
export async function taoBienBao(
  d: TaoBienBao,
  status: "nhap" | "cho_duyet",
  actor: string,
): Promise<boolean> {
  const kind = BANG["bien-bao"].kind;
  return (await sql.begin(async (tx) => {
    const r = await tx`
      INSERT INTO traffic_signs (code, group_name, name, meaning, search_text, image_uri, citation_urn,
        ordinal, reaction, reaction_note, status, note, topic_id, created_by, updated_at)
      VALUES (${d.code}, ${d.group_name}, ${d.name}, ${d.meaning},
        ${chuoiTimBienBao({ ma: d.code, ten: d.name })}, ${d.image_uri}, ${d.citation_urn},
        (SELECT coalesce(max(ordinal), 0) + 1 FROM traffic_signs WHERE group_name = ${d.group_name}),
        ${d.reaction}, ${d.reaction_note}, ${status}, ${d.note}, ${d.topic_id}, ${actor}, now())
      ON CONFLICT (code) DO NOTHING`;
    if (!r.count) return false;
    await ghiLichSu(tx, kind, d.code, 1, "tao", actor);
    if (status === "cho_duyet") await ghiLichSu(tx, kind, d.code, 1, "gui_duyet", actor);
    return true;
  })) as boolean;
}

/**
 * Thay ảnh của một biển báo. Ảnh là nội dung được duyệt nên theo đúng luật sửa (`sau` tính bằng
 * `hauQuaSua`). Trả false khi `version` không khớp.
 */
export async function thayAnhBienBao(
  code: string,
  imageUri: string,
  versionCu: number,
  sau: { status: TrangThaiDuyet; version: number },
  actor: string,
): Promise<boolean> {
  return (await sql.begin(async (tx) => {
    const r = await tx`
      UPDATE traffic_signs SET image_uri = ${imageUri}, status = ${sangTrangThaiBang(sau.status)},
        version = ${sau.version}, updated_at = now()
      WHERE code = ${code} AND version = ${versionCu}`;
    if (!r.count) return false;
    await ghiLichSu(tx, BANG["bien-bao"].kind, code, sau.version, "thay_anh", actor);
    return true;
  })) as boolean;
}

/** Ảnh còn biển hoặc câu hỏi nào dùng không; ảnh không còn ai dùng thì gỡ khỏi kho được. */
export async function anhBienBaoConDung(imageUri: string): Promise<boolean> {
  const [r] = await sql`
    SELECT 1 FROM traffic_signs WHERE image_uri = ${imageUri}
    UNION ALL
    SELECT 1 FROM questions WHERE ${imageUri} = ANY(image_uris) OR position(${imageUri} in options::text) > 0
    LIMIT 1`;
  return Boolean(r);
}

export interface TaoBieuMau extends SuaBieuMau, PhanLoaiLucTao {
  code: string;
  tep: TepTaiLieu;
}

/**
 * Thêm một biểu mẫu (tệp đã nằm trong kho đối tượng), ở trạng thái `status`, phiên bản 1.
 * Trả false khi mã đã có (kể cả dòng đã ngừng).
 */
export async function taoBieuMau(
  d: TaoBieuMau,
  status: "nhap" | "cho_duyet",
  actor: string,
): Promise<boolean> {
  const kind = BANG["bieu-mau"].kind;
  return (await sql.begin(async (tx) => {
    const r = await tx`
      INSERT INTO form_templates (code, kind, title, summary, vehicle, group_name,
        file_uri, file_name, file_ext, file_size, status, note, topic_id, created_by, updated_at)
      VALUES (${d.code}, ${d.kind}, ${d.title}, ${d.summary}, ${d.vehicle}, ${d.group_name},
        ${d.tep.uri}, ${d.tep.ten}, ${d.tep.duoi}, ${d.tep.kichThuoc},
        ${status}, ${d.note}, ${d.topic_id}, ${actor}, now())
      ON CONFLICT (code) DO NOTHING`;
    if (!r.count) return false;
    await ghiLichSu(tx, kind, d.code, 1, "tao", actor);
    if (status === "cho_duyet") await ghiLichSu(tx, kind, d.code, 1, "gui_duyet", actor);
    return true;
  })) as boolean;
}

/**
 * Thay tệp của một biểu mẫu. Tệp là nội dung được duyệt nên theo đúng luật sửa (`sau` tính bằng
 * `hauQuaSua`): biểu mẫu đã duyệt về chờ duyệt và tăng phiên bản. Trả false khi `version` không khớp.
 */
export async function thayTepBieuMau(
  code: string,
  tep: TepTaiLieu,
  versionCu: number,
  sau: { status: TrangThaiDuyet; version: number },
  actor: string,
): Promise<boolean> {
  return (await sql.begin(async (tx) => {
    const r = await tx`
      UPDATE form_templates SET file_uri = ${tep.uri}, file_name = ${tep.ten}, file_ext = ${tep.duoi},
        file_size = ${tep.kichThuoc}, status = ${sangTrangThaiBang(sau.status)}, version = ${sau.version},
        updated_at = now()
      WHERE code = ${code} AND version = ${versionCu}`;
    if (!r.count) return false;
    await ghiLichSu(tx, BANG["bieu-mau"].kind, code, sau.version, "thay_tep", actor, tep.ten);
    return true;
  })) as boolean;
}

/** Loại có phân loại (phương tiện, loại vi phạm) và ghim: các mục của trang "Quy trình, Biểu mẫu". */
export const LOAI_CO_PHAN_LOAI = ["quy-trinh", "bieu-mau"] as const satisfies readonly LoaiDuLieuTraCuu[];
export type LoaiCoPhanLoai = (typeof LOAI_CO_PHAN_LOAI)[number];

/**
 * Đặt phương tiện, loại vi phạm và ghim của một quy trình hoặc biểu mẫu. Đây là phân loại để lọc và
 * xếp thứ tự, không phải nội dung được duyệt: giữ nguyên trạng thái và phiên bản, chỉ ghi lịch sử.
 */
export async function phanLoaiTaiLieu(
  loai: LoaiCoPhanLoai,
  code: string,
  d: { vehicle: LoaiXe | null; group_name: string | null; pinned: boolean },
  actor: string,
): Promise<boolean> {
  const b = BANG[loai];
  return (await sql.begin(async (tx) => {
    const [r] = (await tx`
      UPDATE ${tx(b.bang)} SET vehicle = ${d.vehicle}, group_name = ${d.group_name}, pinned = ${d.pinned}
      WHERE code = ${code} RETURNING version`) as any[];
    if (!r) return false;
    const ghiChu = [
      d.vehicle ? TEN_LOAI_XE[d.vehicle] : "mọi phương tiện",
      d.group_name ?? "không gắn loại vi phạm",
    ];
    if (d.pinned) ghiChu.push("ghim");
    await ghiLichSu(tx, b.kind, code, r.version, "phan_loai", actor, ghiChu.join(" · "));
    return true;
  })) as boolean;
}

/**
 * Xóa hẳn một dòng chưa từng duyệt: đang nháp hoặc bị từ chối, và chưa có lần duyệt nào. Dòng đã từng
 * duyệt có thể đã nằm trong lượt chơi hoặc được tình huống trò chơi trỏ tới nên chỉ ngừng dùng. Trả dòng
 * đã xóa, hoặc undefined khi dòng không xóa được. Lịch sử duyệt của dòng được giữ lại.
 */
export async function xoaDuLieuTraCuu(
  loai: LoaiDuLieuTraCuu,
  code: string,
  actor: string,
): Promise<DongDuLieuRow | undefined> {
  const b = BANG[loai];
  return (await sql.begin(async (tx) => {
    const [r] = await tx<DongDuLieuRow[]>`
      DELETE FROM ${tx(b.bang)}
      WHERE code = ${code} AND status IN ('nhap', 'tu_choi') AND approved_at IS NULL
      RETURNING *`;
    if (r) await ghiLichSu(tx, b.kind, code, r.version, "xoa", actor);
    return r;
  })) as DongDuLieuRow | undefined;
}

/**
 * Chuyển trạng thái các dòng (theo luật chung). Trả các dòng đã chuyển; dòng không ở trạng thái
 * `tu` bị bỏ qua.
 */
export async function chuyenTrangThaiDuLieu(inp: {
  loai: LoaiDuLieuTraCuu;
  codes: string[];
  tu: readonly TrangThaiDuyet[];
  den: TrangThaiDuyet;
  hanhDong: string;
  actor: string;
  ghiChu?: string | null;
}): Promise<Array<{ code: string; version: number }>> {
  if (!inp.codes.length) return [];
  const b = BANG[inp.loai];
  const den = sangTrangThaiBang(inp.den);
  const tu = inp.tu.map(sangTrangThaiBang);
  return (await sql.begin(async (tx) => {
    const rows = (await tx`
      UPDATE ${tx(b.bang)} SET
        status = ${den}, updated_at = now(),
        approved_by = CASE WHEN ${den} = 'da_duyet' THEN ${inp.actor} ELSE approved_by END,
        approved_at = CASE WHEN ${den} = 'da_duyet' THEN now() ELSE approved_at END,
        reject_reason = CASE WHEN ${den} = 'tu_choi' THEN ${inp.ghiChu ?? null}
                             WHEN ${den} = 'cho_duyet' THEN NULL ELSE reject_reason END
      WHERE code = ANY(${inp.codes}) AND status = ANY(${tu})
      RETURNING code, version`) as any[];
    for (const r of rows) await ghiLichSu(tx, b.kind, r.code, r.version, inp.hanhDong, inp.actor, inp.ghiChu);
    return rows;
  })) as Array<{ code: string; version: number }>;
}
