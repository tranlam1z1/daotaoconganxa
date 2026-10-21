/**
 * Dữ liệu của trò "Truy vết xe bỏ trốn" (docs/PLAN.md GĐ-T17): nguồn vụ cho lượt chơi và gói offline, nạp
 * dữ liệu mẫu, và ghi thao tác mở camera, khóa xe của lượt online.
 *
 * Câu D23 (đã chọn route riêng của trò): khung sinh mọi đề lúc tạo lượt, nên đoạn cảnh theo camera người
 * chơi chọn do route riêng trả (apps/api/src/routes/truy-vet.ts). Nhật ký "mo", "khoa" được ghi vào ảnh
 * chụp bước (`game_runs.items[0].noi_dung.nhat_ky`) trong một giao dịch khóa dòng lượt (cùng khóa với
 * `ghiBuoc`), để khi chấm máy chủ chỉ tin nhật ký này, không tin nhật ký máy khách gửi.
 */
import { join } from "node:path";
import {
  apThaoTacTV,
  type BuocTruyVet,
  chayNhatKyTV,
  type DoanCanh,
  dungDoanCanh,
  dungVu,
  kiemTraVu,
  type LoiThaoTac,
  MA_TRUY_VET,
  type NguonTruyVet,
  type PayloadVuTruyVet,
  type ThamSoTruyVet,
  type ThaoTacTruyVet,
  type TrangThaiTruyVet,
} from "@qdpl/dao-tao";
import { sql } from "./client.ts";
import { noiDungDungDuoc, taoNoiDungTroChoi } from "./noi-dung-tro-choi.ts";

/** Nguồn của trò: vụ đã duyệt và hợp lệ (mọi biến thể sinh được lộ trình). */
export async function nguonTruyVet(opts: { chiOffline?: boolean } = {}): Promise<NguonTruyVet[]> {
  const ds = await noiDungDungDuoc(MA_TRUY_VET, { chiOffline: opts.chiOffline });
  const kq: NguonTruyVet[] = [];
  for (const r of ds) {
    const p = r.payload as unknown as PayloadVuTruyVet;
    if (kiemTraVu(p).length) continue;
    kq.push({ id: r.id, code: r.code, version: r.version, topic_id: r.topic_id, vu: p });
  }
  return kq;
}

/* ------------------------------------------------------------------ */
/* Mở camera, khóa xe (lượt online)                                    */
/* ------------------------------------------------------------------ */

export interface YeuCauMoCamera {
  camera: string;
  cho: boolean;
  /** Khóa một xe trong đoạn cảnh vừa mở, trước khi mở camera này. */
  khoa: { doan: number; xe: string } | null;
}

export type KetQuaMoCamera =
  | { ok: true; doan: DoanCanh; trang_thai: TrangThaiTruyVet }
  | { ok: false; ly_do: "khong_co_luot" | "khong_phai_cua_ban" | "khong_mo_duoc"; thong_bao: string }
  | { ok: false; ly_do: "thao_tac"; loi: LoiThaoTac };

/**
 * Mở một camera cho lượt online của `accountId`: áp thao tác khóa (nếu có) rồi mở, bằng cùng hàm với bộ
 * chấm; hợp lệ thì ghi vào ảnh chụp bước. Lượt phải của người gọi, đang chơi, không phải lượt offline, bước
 * chưa được chấm. Trả đoạn cảnh (không có vai của xe) và trạng thái mới.
 */
export async function moCameraTruyVet(
  runId: string,
  accountId: string,
  yc: YeuCauMoCamera,
  now: Date = new Date(),
): Promise<KetQuaMoCamera> {
  return (await sql.begin(async (tx) => {
    const [l] = (await tx`
      SELECT account_id, game_code, status, offline, items, step_opened_at FROM game_runs
      WHERE id = ${runId} FOR UPDATE`) as any[];
    if (!l || l.game_code !== MA_TRUY_VET)
      return { ok: false, ly_do: "khong_co_luot", thong_bao: "Không có lượt chơi này." };
    if (l.account_id !== accountId)
      return { ok: false, ly_do: "khong_phai_cua_ban", thong_bao: "Lượt chơi này không phải của bạn." };
    if (l.status !== "dang_choi" || l.offline)
      return { ok: false, ly_do: "khong_mo_duoc", thong_bao: "Lượt chơi đã kết thúc." };
    const [daCham] =
      (await tx`SELECT 1 FROM game_run_steps WHERE run_id = ${runId} AND ordinal = 1`) as any[];
    if (daCham) return { ok: false, ly_do: "khong_mo_duoc", thong_bao: "Vụ đã được chấm." };

    const items = l.items as Array<{ noi_dung: BuocTruyVet }>;
    const nd = items[0]!.noi_dung;
    const v = dungVu(nd.vu, nd.bi_mat);
    // Mốc thời gian thật của thao tác (nhịp 50 ms từ lúc mở bước), chỉ để lưu vết; chấm theo giờ trong trò.
    const moLuc = l.step_opened_at?.["1"] ? new Date(l.step_opened_at["1"]).getTime() : now.getTime();
    const nhip = Math.max(0, Math.floor((now.getTime() - moLuc) / 50));
    const moi: Array<{ nhip: number; thao_tac: ThaoTacTruyVet; tham_so: ThamSoTruyVet }> = [];
    if (yc.khoa) moi.push({ nhip, thao_tac: "khoa", tham_so: { doan: yc.khoa.doan, xe: yc.khoa.xe } });
    moi.push({ nhip, thao_tac: "mo", tham_so: { camera: yc.camera, cho: yc.cho } });

    let tt = chayNhatKyTV(v, nd.nhat_ky, nd.lo_trinh);
    for (const op of moi) {
      const kq = apThaoTacTV(v, tt, op, nd.lo_trinh);
      if ("loi" in kq) return { ok: false, ly_do: "thao_tac", loi: kq.loi };
      tt = kq.tt;
    }
    const nhatKy = [...nd.nhat_ky, ...moi];
    await tx`
      UPDATE game_runs SET items = jsonb_set(items, '{0,noi_dung,nhat_ky}', ${tx.json(nhatKy as never)})
      WHERE id = ${runId}`;
    return { ok: true, doan: dungDoanCanh(v, tt.doan.at(-1)!, nd.lo_trinh), trang_thai: tt };
  })) as KetQuaMoCamera;
}

/* ------------------------------------------------------------------ */
/* Nạp dữ liệu mẫu                                                     */
/* ------------------------------------------------------------------ */

const GOC = join(import.meta.dir, "..", "..", "..");
const NGUOI_TAO = "seed-demo";
const GHI_CHU_DEMO =
  "Dữ liệu demo, chưa duyệt. Bản đồ, tên phố, biển số là hư cấu; lộ trình, xe mồi, xe nền sinh từ seed. Lời tin báo do hệ thống soạn, cần người soạn viết lại. Căn cứ về hành vi bỏ chạy sau tai nạn và trách nhiệm của người điều khiển phương tiện liên quan tới vụ tai nạn chưa có trong kho văn bản (tra ngày 30/9/2026). Cần đơn vị xác nhận trò không lộ phương pháp nghiệp vụ không được công bố.";

export interface VuTruyVetTep {
  ma: string;
  tieu_de: string;
  y_do?: string;
  payload: PayloadVuTruyVet;
}

/** Nạp các vụ mẫu (data/tro-choi/truy-vet.json) vào chờ duyệt. Chạy lại được: vụ đã có (theo tên) thì bỏ qua. */
export async function napTruyVet(
  opts: { tienToTen?: string; vu?: VuTruyVetTep[] } = {},
): Promise<{ daTao: number; daCo: number }> {
  const vu =
    opts.vu ??
    ((await Bun.file(join(GOC, "data", "tro-choi", "truy-vet.json")).json()) as { vu: VuTruyVetTep[] }).vu;
  const [chuDe] = (await sql`SELECT id FROM question_topics WHERE code = 'gt-quy-tac'`) as any[];
  let daTao = 0;
  let daCo = 0;
  for (const m of vu) {
    const loi = kiemTraVu(m.payload);
    if (loi.length) throw new Error(`Vụ ${m.ma} không hợp lệ: ${loi.map((l) => l.loi).join(" ")}`);
    const tieuDe = `${opts.tienToTen ?? ""}${m.tieu_de}`;
    const [co] =
      (await sql`SELECT id FROM game_content WHERE game_code = ${MA_TRUY_VET} AND title = ${tieuDe}`) as any[];
    if (co) {
      daCo++;
      continue;
    }
    await taoNoiDungTroChoi(
      {
        game_code: MA_TRUY_VET,
        topic_id: chuDe?.id ?? null,
        level: m.payload.muc <= 2 ? "de" : m.payload.muc <= 4 ? "trung_binh" : "kho",
        title: tieuDe,
        payload: m.payload as unknown as Record<string, unknown>,
        answer: {},
        explanation: `${GHI_CHU_DEMO} Ý đồ: ${m.y_do || "không ghi"}`,
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
