/**
 * Dữ liệu của trò "Dựng chốt an toàn ban đêm" (docs/PLAN.md GĐ-T15): nguồn đoạn đường cho lượt chơi và
 * gói offline, nạp dữ liệu mẫu.
 *
 * Trò có hai loại nội dung `game_content` (game_code = 'chot_dem'), phân biệt bằng `payload.kieu`:
 *  - "doan_duong": đoạn đường ban đêm, vị trí chốt, túi đồ, dòng xe; `ma_tieu_chi` trỏ tới một bộ tiêu chí.
 *  - "tieu_chi_chot": ngưỡng của sáu tiêu chí chấm và nguồn từng tiêu chí. Không gửi người chơi (chỉ vào
 *    ảnh chụp lượt ở máy chủ và gói offline).
 * Đoạn đường chỉ vào lượt khi bộ tiêu chí nó trỏ tới cũng đã duyệt và hợp lệ. Sửa bộ tiêu chí thì bộ đó về
 * chờ duyệt, mọi đoạn trỏ tới nó rút khỏi trò cho tới khi duyệt lại.
 */
import { join } from "node:path";
import {
  kiemTraDoanChot,
  kiemTraTieuChiChot,
  MA_CHOT_DEM,
  type NguonChotDem,
  type PayloadDoanChot,
  type PayloadTieuChiChot,
} from "@qdpl/dao-tao";
import { sql } from "./client.ts";
import { type NoiDungTroChoiRow, noiDungDungDuoc, taoNoiDungTroChoi } from "./noi-dung-tro-choi.ts";

const kieuCua = (r: NoiDungTroChoiRow) => (r.payload as { kieu?: string }).kieu;

/** Nguồn của trò: đoạn đường dùng được kèm bộ tiêu chí đã duyệt. Nhiều bộ cùng mã thì lấy bộ duyệt gần nhất. */
export async function nguonChotDem(opts: { chiOffline?: boolean } = {}): Promise<NguonChotDem[]> {
  const ds = await noiDungDungDuoc(MA_CHOT_DEM, { chiOffline: opts.chiOffline });
  const tieuChi = new Map<string, PayloadTieuChiChot>();
  for (const r of ds
    .filter((r) => kieuCua(r) === "tieu_chi_chot")
    .sort(
      (a, b) => (a.approved_at?.getTime() ?? 0) - (b.approved_at?.getTime() ?? 0) || a.id.localeCompare(b.id),
    )) {
    const p = r.payload as unknown as PayloadTieuChiChot;
    if (!kiemTraTieuChiChot(p).length) tieuChi.set(p.ma, p);
  }
  const kq: NguonChotDem[] = [];
  for (const r of ds) {
    if (kieuCua(r) !== "doan_duong") continue;
    const p = r.payload as unknown as PayloadDoanChot;
    const tc = tieuChi.get(p.ma_tieu_chi);
    if (!tc || kiemTraDoanChot(p).length) continue;
    kq.push({ id: r.id, code: r.code, version: r.version, topic_id: r.topic_id, doan: p, tieu_chi: tc });
  }
  return kq;
}

/* ------------------------------------------------------------------ */
/* Nạp dữ liệu mẫu                                                     */
/* ------------------------------------------------------------------ */

const GOC = join(import.meta.dir, "..", "..", "..");
const NGUOI_TAO = "seed-demo";
const GHI_CHU_DEMO_DOAN =
  "Dữ liệu demo, chưa duyệt. Đoạn đường, dòng xe, túi đồ giả định do hệ thống soạn; tầm nhìn ban đêm, vùng nguy hiểm quanh chiến sĩ là thông số mô phỏng chưa được đơn vị chuyên môn kiểm tra.";
const GHI_CHU_DEMO_TIEU_CHI =
  "Dữ liệu demo, chưa duyệt. Mọi ngưỡng là số minh họa. Chưa tra được kho văn bản (MCP quydinhphapluat không kết nối được ngày 29/9/2026); QCVN 41:2024/BGTVT chưa có trong kho (câu D21). Vị trí đứng của chiến sĩ theo tài liệu nghiệp vụ do đơn vị cung cấp (chưa có).";

export interface DoanChotTep {
  ma: string;
  tieu_de: string;
  y_do?: string;
  payload: PayloadDoanChot;
}

export interface TieuChiChotTep {
  ma: string;
  tieu_de: string;
  payload: PayloadTieuChiChot;
}

/**
 * Nạp bộ tiêu chí (data/tro-choi/tieu-chi-chot.json) và đoạn đường (data/tro-choi/chot-dem.json) vào chờ
 * duyệt. Chạy lại được: nội dung đã có (theo tên) thì bỏ qua.
 */
export async function napChotDem(
  opts: { tienToTen?: string; doan?: DoanChotTep[]; tieuChi?: TieuChiChotTep[] } = {},
): Promise<{ daTao: number; daCo: number }> {
  const tieuChi =
    opts.tieuChi ??
    (
      (await Bun.file(join(GOC, "data", "tro-choi", "tieu-chi-chot.json")).json()) as {
        tieu_chi: TieuChiChotTep[];
      }
    ).tieu_chi;
  const doan =
    opts.doan ??
    ((await Bun.file(join(GOC, "data", "tro-choi", "chot-dem.json")).json()) as { doan: DoanChotTep[] }).doan;
  const [chuDe] = (await sql`SELECT id FROM question_topics WHERE code = 'gt-quy-tac'`) as any[];
  let daTao = 0;
  let daCo = 0;
  const muc = [
    ...tieuChi.map((t) => ({ ...t, y_do: undefined, laTieuChi: true, man: 3 })),
    ...doan.map((d) => ({ ...d, laTieuChi: false, man: d.payload.muc })),
  ];
  for (const m of muc) {
    const loi = m.laTieuChi
      ? kiemTraTieuChiChot(m.payload as PayloadTieuChiChot)
      : kiemTraDoanChot(m.payload as PayloadDoanChot);
    if (loi.length) throw new Error(`Nội dung ${m.ma} không hợp lệ: ${loi.join(" ")}`);
    const tieuDe = `${opts.tienToTen ?? ""}${m.tieu_de}`;
    const [co] =
      (await sql`SELECT id FROM game_content WHERE game_code = ${MA_CHOT_DEM} AND title = ${tieuDe}`) as any[];
    if (co) {
      daCo++;
      continue;
    }
    await taoNoiDungTroChoi(
      {
        game_code: MA_CHOT_DEM,
        topic_id: chuDe?.id ?? null,
        level: m.man <= 2 ? "de" : m.man <= 4 ? "trung_binh" : "kho",
        title: tieuDe,
        payload: m.payload as unknown as Record<string, unknown>,
        answer: {},
        explanation: m.laTieuChi
          ? GHI_CHU_DEMO_TIEU_CHI
          : `${GHI_CHU_DEMO_DOAN} Ý đồ: ${("y_do" in m && m.y_do) || "không ghi"}`,
        citations: [],
        refs: [],
        offline_ok: true,
        status: "cho_duyet",
      },
      NGUOI_TAO,
    );
    daTao++;
  }
  return { daTao, daCo };
}
