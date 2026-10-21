/**
 * Dữ liệu của trò "Tự lái qua phố" (docs/PLAN.md GĐ-T9): nguồn khu phố cho lượt chơi và gói offline,
 * nạp dữ liệu mẫu.
 *
 * Trò có hai loại nội dung `game_content` (game_code = 'tu_lai'), phân biệt bằng `payload.kieu`:
 *  - "ban_do": bản đồ khu phố, `refs` trỏ tới mọi biển trên bản đồ. Sửa một biển thì bản đồ rút khỏi
 *    trò cho tới khi duyệt lại.
 *  - "anh_xa_loi": bảng lỗi → mức phạt theo loại xe (câu D9), `refs` trỏ tới các dòng mức phạt. Chỉ
 *    duyệt được khi mọi dòng mức phạt được trỏ tới đã duyệt; sửa một dòng thì bảng rút khỏi trò.
 *    Không có bảng đã duyệt thì trò vẫn chơi được: biên bản dùng tên lỗi mặc định, ghi "Chưa có mức
 *    phạt đã duyệt" và "Căn cứ đang được cập nhật".
 */
import { join } from "node:path";
import {
  kiemTraAnhXaLoi,
  kiemTraBanDo,
  MA_TU_LAI,
  maBienCuaBanDo,
  maMucPhatCuaAnhXa,
  type NguonTuLai,
  type PayloadAnhXaLoi,
  type PayloadBanDo,
} from "@qdpl/dao-tao";
import { nguonBienBaoPhanUng } from "./bien-bao.ts";
import { sql } from "./client.ts";
import { mucPhatDaDuyetTheoMa } from "./kiem-tra-giay-to.ts";
import { type NoiDungTroChoiRow, noiDungDungDuoc, taoNoiDungTroChoi } from "./noi-dung-tro-choi.ts";

const kieuCua = (r: NoiDungTroChoiRow) => (r.payload as { kieu?: string }).kieu;

/** Bảng lỗi đã duyệt và dùng được; nhiều bảng thì lấy bảng duyệt gần nhất. */
function chonAnhXa(ds: readonly NoiDungTroChoiRow[]): PayloadAnhXaLoi | null {
  const hop = ds
    .filter((r) => kieuCua(r) === "anh_xa_loi")
    .filter((r) => kiemTraAnhXaLoi(r.payload as unknown as PayloadAnhXaLoi).length === 0)
    .sort(
      (a, b) => (b.approved_at?.getTime() ?? 0) - (a.approved_at?.getTime() ?? 0) || a.id.localeCompare(b.id),
    );
  return hop[0] ? (hop[0].payload as unknown as PayloadAnhXaLoi) : null;
}

/** Nguồn của trò: khu phố dùng được kèm biển, bảng lỗi, mức phạt đã duyệt tại `ngay`. */
export async function nguonTuLai(opts: { ngay: string; chiOffline?: boolean }): Promise<NguonTuLai[]> {
  const [ds, bien] = await Promise.all([
    noiDungDungDuoc(MA_TU_LAI, { chiOffline: opts.chiOffline }),
    nguonBienBaoPhanUng(),
  ]);
  const anhXa = chonAnhXa(ds);
  const mucPhat = await mucPhatDaDuyetTheoMa(maMucPhatCuaAnhXa(anhXa), opts.ngay);
  const theoMa = new Map(bien.map((b) => [b.ma, b]));
  const kq: NguonTuLai[] = [];
  for (const r of ds) {
    if (kieuCua(r) !== "ban_do") continue;
    const p = r.payload as unknown as PayloadBanDo;
    if (kiemTraBanDo(p, new Set(theoMa.keys())).length) continue;
    kq.push({
      id: r.id,
      code: r.code,
      version: r.version,
      topic_id: r.topic_id,
      ban_do: p,
      bien: maBienCuaBanDo(p).map((ma) => {
        const b = theoMa.get(ma)!;
        return {
          ma: b.ma,
          version: b.version,
          nhom: b.nhom,
          ten: b.ten,
          anh: b.anh,
          can_cu: b.can_cu,
          phan_ung: b.phan_ung,
        };
      }),
      anh_xa: anhXa,
      muc_phat: mucPhat,
    });
  }
  return kq;
}

/* ------------------------------------------------------------------ */
/* Nạp dữ liệu mẫu                                                     */
/* ------------------------------------------------------------------ */

const GOC = join(import.meta.dir, "..", "..", "..");
const NGUOI_TAO = "seed-demo";
const GHI_CHU_DEMO_BAN_DO =
  "Dữ liệu demo, chưa duyệt. Khu phố giả định; vị trí đèn, biển, người đi bộ, xe khác do hệ thống soạn để luyện lái, chưa đối chiếu QCVN 41:2024/BGTVT.";
const GHI_CHU_DEMO_ANH_XA =
  "Dữ liệu demo, chưa duyệt. Tên hành vi, lời giải thích và mã mức phạt do hệ thống soạn khi kho chưa có Luật số 36/2024/QH15 và Nghị định số 168/2024/NĐ-CP; chưa đối chiếu nguyên văn.";

interface TepTuLai {
  ban_do: Array<{ ma: string; tieu_de: string; y_do?: string; payload: PayloadBanDo }>;
  anh_xa_loi: { ma: string; tieu_de: string; y_do?: string; payload: PayloadAnhXaLoi };
}

/**
 * Nạp khu phố và bảng lỗi mẫu vào chờ duyệt (data/tro-choi/tu-lai.json). Chạy lại được: nội dung đã
 * có (theo tên) thì bỏ qua. Không kiểm biển đã duyệt ở đây: biển mẫu còn là bản nháp.
 */
export async function napTuLai(
  opts: { tienToTen?: string; tep?: TepTuLai } = {},
): Promise<{ daTao: number; daCo: number }> {
  const tep = opts.tep ?? ((await Bun.file(join(GOC, "data", "tro-choi", "tu-lai.json")).json()) as TepTuLai);
  const [chuDe] = (await sql`SELECT id FROM question_topics WHERE code = 'gt-quy-tac'`) as any[];
  let daTao = 0;
  let daCo = 0;
  const muc = [
    ...tep.ban_do.map((b) => ({ ...b, anhXa: false })),
    { ...tep.anh_xa_loi, payload: tep.anh_xa_loi.payload as unknown as PayloadBanDo, anhXa: true },
  ];
  for (const m of muc) {
    const loi = m.anhXa
      ? kiemTraAnhXaLoi(m.payload as unknown as PayloadAnhXaLoi)
      : kiemTraBanDo(m.payload as PayloadBanDo);
    if (loi.length) throw new Error(`Nội dung ${m.ma} không hợp lệ: ${loi.map((l) => l.loi).join(" ")}`);
    const tieuDe = `${opts.tienToTen ?? ""}${m.tieu_de}`;
    const [co] =
      (await sql`SELECT id FROM game_content WHERE game_code = ${MA_TU_LAI} AND title = ${tieuDe}`) as any[];
    if (co) {
      daCo++;
      continue;
    }
    const refs = m.anhXa
      ? maMucPhatCuaAnhXa(m.payload as unknown as PayloadAnhXaLoi).map((ma) => ({
          loai: "violation" as const,
          ma,
        }))
      : maBienCuaBanDo(m.payload as PayloadBanDo).map((ma) => ({ loai: "traffic_sign" as const, ma }));
    const man = m.anhXa ? 1 : (m.payload as PayloadBanDo).man;
    await taoNoiDungTroChoi(
      {
        game_code: MA_TU_LAI,
        topic_id: chuDe?.id ?? null,
        level: man <= 1 ? "de" : man === 2 ? "trung_binh" : "kho",
        title: tieuDe,
        payload: m.payload as unknown as Record<string, unknown>,
        answer: {},
        explanation: `${m.anhXa ? GHI_CHU_DEMO_ANH_XA : GHI_CHU_DEMO_BAN_DO} Ý đồ: ${m.y_do ?? "không ghi"}`,
        citations: [],
        refs,
        offline_ok: true,
        status: "cho_duyet",
      },
      NGUOI_TAO,
    );
    daTao++;
  }
  return { daTao, daCo };
}
