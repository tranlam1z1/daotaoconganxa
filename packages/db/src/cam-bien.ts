/**
 * Dữ liệu của trò "Cắm biển cho tuyến đường" (docs/PLAN.md GĐ-T3): nguồn đoạn đường cho lượt chơi
 * và gói offline, nạp đoạn đường mẫu.
 *
 * Nguồn của trò là đoạn đường ĐÃ DUYỆT (qua `noiDungDungDuoc`) kèm các biển ĐÃ DUYỆT có phản ứng
 * trong khay của đoạn. Mỗi đoạn trỏ tới mọi biển trong khay bằng `refs`, nên sửa một biển (tên, ảnh,
 * phản ứng) thì đoạn đó tự rút khỏi trò cho tới khi được duyệt lại. Đoạn có biển trong khay chưa
 * duyệt, hoặc bố cục không hợp lệ, cũng không vào lượt (`kiemTraDoanDuong` ở packages/dao-tao).
 */
import { join } from "node:path";
import {
  type DapAnDoanDuong,
  kiemTraDoanDuong,
  MA_CAM_BIEN,
  type NguonCamBien,
  type PayloadDoanDuong,
} from "@qdpl/dao-tao";
import { nguonBienBaoPhanUng } from "./bien-bao.ts";
import { sql } from "./client.ts";
import { noiDungDungDuoc, taoNoiDungTroChoi } from "./noi-dung-tro-choi.ts";

/** Nguồn của trò: đoạn đường dùng được kèm biển trong khay. `chiOffline` cho gói offline. */
export async function nguonCamBien(opts: { chiOffline?: boolean } = {}): Promise<NguonCamBien[]> {
  const [doan, bien] = await Promise.all([
    noiDungDungDuoc(MA_CAM_BIEN, { chiOffline: opts.chiOffline }),
    nguonBienBaoPhanUng(),
  ]);
  const theoMa = new Map(bien.map((b) => [b.ma, b]));
  const kq: NguonCamBien[] = [];
  for (const d of doan) {
    const p = d.payload as unknown as PayloadDoanDuong;
    const da = d.answer as unknown as DapAnDoanDuong;
    if (kiemTraDoanDuong(p, da, new Set(theoMa.keys())).length) continue;
    kq.push({
      id: d.id,
      code: d.code,
      version: d.version,
      topic_id: d.topic_id,
      doan: p,
      dap_an: da,
      bien: p.khay.map((m) => {
        const b = theoMa.get(m)!;
        return {
          ma: b.ma,
          version: b.version,
          nhom: b.nhom,
          ten: b.ten,
          y_nghia: b.y_nghia,
          anh: b.anh,
          can_cu: b.can_cu,
          phan_ung: b.phan_ung,
        };
      }),
    });
  }
  return kq;
}

/* ------------------------------------------------------------------ */
/* Nạp đoạn đường mẫu                                                  */
/* ------------------------------------------------------------------ */

const GOC = join(import.meta.dir, "..", "..", "..");
const NGUOI_TAO = "seed-demo";
const GHI_CHU_DEMO_CAM_BIEN =
  "Dữ liệu demo, chưa duyệt. Đoạn đường giả định; biển đúng, biển chấp nhận được và vị trí nên để trống do hệ thống soạn, chưa đối chiếu QCVN 41:2024/BGTVT.";

export interface DoanDuongTep {
  ma: string;
  tieu_de: string;
  y_do?: string;
  payload: PayloadDoanDuong;
  answer: DapAnDoanDuong;
}

/**
 * Nạp đoạn đường Cắm biển vào chờ duyệt (data/tro-choi/cam-bien.json). Chạy lại được: đoạn đã có
 * (theo tên) thì bỏ qua. Không kiểm biển đã duyệt ở đây: biển mẫu còn là bản nháp.
 */
export async function napDoanDuongCamBien(
  opts: { tienToTen?: string; doan?: DoanDuongTep[] } = {},
): Promise<{ daTao: number; daCo: number }> {
  const ds =
    opts.doan ??
    ((await Bun.file(join(GOC, "data", "tro-choi", "cam-bien.json")).json()) as { doan: DoanDuongTep[] })
      .doan;
  const [chuDe] = (await sql`SELECT id FROM question_topics WHERE code = 'gt-quy-tac'`) as any[];
  let daTao = 0;
  let daCo = 0;
  for (const d of ds) {
    const loi = kiemTraDoanDuong(d.payload, d.answer);
    if (loi.length) throw new Error(`Đoạn đường ${d.ma} không hợp lệ: ${loi.map((l) => l.loi).join(" ")}`);
    const tieuDe = `${opts.tienToTen ?? ""}${d.tieu_de}`;
    const [co] =
      (await sql`SELECT id FROM game_content WHERE game_code = ${MA_CAM_BIEN} AND title = ${tieuDe}`) as any[];
    if (co) {
      daCo++;
      continue;
    }
    await taoNoiDungTroChoi(
      {
        game_code: MA_CAM_BIEN,
        topic_id: chuDe?.id ?? null,
        level: d.payload.muc <= 2 ? "de" : d.payload.muc <= 4 ? "trung_binh" : "kho",
        title: tieuDe,
        payload: d.payload as unknown as Record<string, unknown>,
        answer: d.answer as unknown as Record<string, unknown>,
        explanation: `${GHI_CHU_DEMO_CAM_BIEN} Ý đồ của đoạn: ${d.y_do ?? "không ghi"}`,
        citations: [],
        refs: d.payload.khay.map((ma) => ({ loai: "traffic_sign" as const, ma })),
        offline_ok: true,
        status: "cho_duyet",
      },
      NGUOI_TAO,
    );
    daTao++;
  }
  return { daTao, daCo };
}
