/**
 * Dữ liệu của trò "Soi camera" (docs/PLAN.md GĐ-T5): nguồn kịch bản cho lượt chơi và gói offline,
 * nạp kịch bản mẫu.
 *
 * Nguồn là kịch bản ĐÃ DUYỆT (qua `noiDungDungDuoc`) kèm dòng mức phạt ĐÃ DUYỆT, còn hiệu lực tại ngày
 * chơi, của các mã mà đáp án trỏ tới. Kịch bản trỏ tới các mã đó bằng `refs`, nên sửa một dòng mức
 * phạt thì kịch bản rút khỏi trò cho tới khi duyệt lại. Kịch bản mà mô phỏng không còn khớp đáp án
 * (`kiemTraKichBan`) cũng không vào lượt.
 */
import { join } from "node:path";
import {
  type DapAnKichBan,
  kiemTraKichBan,
  MA_SOI_CAMERA,
  type NguonSoiCamera,
  type PayloadKichBan,
} from "@qdpl/dao-tao";
import { sql } from "./client.ts";
import { mucPhatDaDuyetTheoMa } from "./kiem-tra-giay-to.ts";
import { noiDungDungDuoc, taoNoiDungTroChoi } from "./noi-dung-tro-choi.ts";

const maMucPhat = (da: DapAnKichBan) => [
  ...new Set(da.vi_pham.map((v) => v.ma_muc_phat).filter((m): m is string => Boolean(m))),
];

export async function nguonSoiCamera(opts: {
  ngay: string;
  chiOffline?: boolean;
}): Promise<NguonSoiCamera[]> {
  const ds = await noiDungDungDuoc(MA_SOI_CAMERA, { chiOffline: opts.chiOffline });
  const mucPhat = await mucPhatDaDuyetTheoMa(
    [...new Set(ds.flatMap((d) => maMucPhat(d.answer as unknown as DapAnKichBan)))],
    opts.ngay,
  );
  const kq: NguonSoiCamera[] = [];
  for (const d of ds) {
    const p = d.payload as unknown as PayloadKichBan;
    const da = d.answer as unknown as DapAnKichBan;
    if (kiemTraKichBan(p, da).length) continue;
    kq.push({
      id: d.id,
      code: d.code,
      version: d.version,
      topic_id: d.topic_id,
      kich_ban: p,
      dap_an: da,
      muc_phat: Object.fromEntries(
        maMucPhat(da)
          .filter((m) => mucPhat[m])
          .map((m) => [m, mucPhat[m]!]),
      ),
    });
  }
  return kq;
}

/* ------------------------------------------------------------------ */
/* Nạp kịch bản mẫu                                                    */
/* ------------------------------------------------------------------ */

const GOC = join(import.meta.dir, "..", "..", "..");
const GHI_CHU_DEMO_SOI_CAMERA =
  "Dữ liệu demo, chưa duyệt. Kịch bản xe giả định; hành vi nào là vi phạm và mã mức phạt tương ứng do hệ thống soạn, chưa đối chiếu Nghị định số 168/2024/NĐ-CP (chưa có trong kho).";

export interface KichBanTep {
  ma: string;
  tieu_de: string;
  y_do?: string;
  payload: PayloadKichBan;
  answer: DapAnKichBan;
}

/**
 * Nạp kịch bản Soi camera vào chờ duyệt (data/tro-choi/soi-camera.json). Chạy lại được: kịch bản đã có
 * (theo tên) thì bỏ qua. Kịch bản không khớp mô phỏng thì dừng, báo lỗi.
 */
export async function napKichBanSoiCamera(
  opts: { tienToTen?: string; doan?: KichBanTep[] } = {},
): Promise<{ daTao: number; daCo: number }> {
  const ds =
    opts.doan ??
    ((await Bun.file(join(GOC, "data", "tro-choi", "soi-camera.json")).json()) as { doan: KichBanTep[] })
      .doan;
  const [chuDe] = (await sql`SELECT id FROM question_topics WHERE code = 'gt-xu-ly-vi-pham'`) as any[];
  let daTao = 0;
  let daCo = 0;
  for (const d of ds) {
    const loi = kiemTraKichBan(d.payload, d.answer);
    if (loi.length) throw new Error(`Kịch bản ${d.ma} không hợp lệ: ${loi.map((l) => l.loi).join(" ")}`);
    const tieuDe = `${opts.tienToTen ?? ""}${d.tieu_de}`;
    const [co] =
      (await sql`SELECT id FROM game_content WHERE game_code = ${MA_SOI_CAMERA} AND title = ${tieuDe}`) as any[];
    if (co) {
      daCo++;
      continue;
    }
    await taoNoiDungTroChoi(
      {
        game_code: MA_SOI_CAMERA,
        topic_id: chuDe?.id ?? null,
        level: d.payload.muc <= 2 ? "de" : d.payload.muc <= 4 ? "trung_binh" : "kho",
        title: tieuDe,
        payload: d.payload as unknown as Record<string, unknown>,
        answer: d.answer as unknown as Record<string, unknown>,
        explanation: `${GHI_CHU_DEMO_SOI_CAMERA} Ý đồ của đoạn: ${d.y_do ?? "không ghi"}`,
        citations: [],
        refs: maMucPhat(d.answer).map((ma) => ({ loai: "violation" as const, ma })),
        offline_ok: true,
        status: "cho_duyet",
      },
      "seed-demo",
    );
    daTao++;
  }
  return { daTao, daCo };
}
