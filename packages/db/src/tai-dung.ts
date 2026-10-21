/**
 * Dữ liệu của trò "Tái dựng hiện trường" (docs/PLAN.md GĐ-T10): nguồn vụ va chạm cho lượt chơi và gói
 * offline, nạp vụ mẫu.
 *
 * Nguồn là vụ ĐÃ DUYỆT (qua `noiDungDungDuoc`) kèm dòng mức phạt ĐÃ DUYỆT, còn hiệu lực tại ngày chơi, của
 * các mã mà lỗi đúng trỏ tới. Vụ trỏ tới các mã đó bằng `refs`, nên sửa một dòng mức phạt thì vụ rút khỏi
 * trò cho tới khi duyệt lại. Vụ mà dựng cảnh gốc không còn hợp lệ (`kiemTraVuTaiDung`) cũng không vào lượt.
 */
import { join } from "node:path";
import {
  type DapAnTaiDung,
  kiemTraVuTaiDung,
  MA_TAI_DUNG,
  type NguonTaiDung,
  type PayloadTaiDung,
} from "@qdpl/dao-tao";
import { sql } from "./client.ts";
import { mucPhatDaDuyetTheoMa } from "./kiem-tra-giay-to.ts";
import { noiDungDungDuoc, taoNoiDungTroChoi } from "./noi-dung-tro-choi.ts";

const maMucPhat = (da: DapAnTaiDung) => [
  ...new Set((da.loi ?? []).map((l) => l.ma_muc_phat).filter(Boolean)),
];

export async function nguonTaiDung(opts: { ngay: string; chiOffline?: boolean }): Promise<NguonTaiDung[]> {
  const ds = await noiDungDungDuoc(MA_TAI_DUNG, { chiOffline: opts.chiOffline });
  const mucPhat = await mucPhatDaDuyetTheoMa(
    [...new Set(ds.flatMap((d) => maMucPhat(d.answer as unknown as DapAnTaiDung)))],
    opts.ngay,
  );
  const kq: NguonTaiDung[] = [];
  for (const d of ds) {
    const vu = d.payload as unknown as PayloadTaiDung;
    const da = d.answer as unknown as DapAnTaiDung;
    if (kiemTraVuTaiDung(vu, da).length) continue;
    kq.push({
      id: d.id,
      code: d.code,
      version: d.version,
      topic_id: d.topic_id,
      vu,
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
/* Nạp vụ mẫu                                                          */
/* ------------------------------------------------------------------ */

const GOC = join(import.meta.dir, "..", "..", "..");
const GHI_CHU_DEMO_TAI_DUNG =
  "Dữ liệu demo, chưa duyệt. Vụ va chạm giả định do hệ thống soạn; mô phỏng minh họa, không phải phương pháp giám định. Căn cứ về xử lý tai nạn chờ khách hàng cung cấp (câu D10); lỗi đúng và mã mức phạt chưa đối chiếu văn bản (kho chưa có Luật số 36/2024/QH15, Nghị định số 168/2024/NĐ-CP).";

export interface VuTaiDungTep {
  ma: string;
  tieu_de: string;
  payload: PayloadTaiDung;
  answer: DapAnTaiDung;
}

/**
 * Nạp vụ Tái dựng hiện trường vào chờ duyệt (data/tro-choi/tai-dung.json). Chạy lại được: vụ đã có (theo
 * tên) thì bỏ qua. Vụ không hợp lệ (dựng cảnh gốc không sinh va chạm…) thì dừng, báo lỗi.
 */
export async function napTaiDung(
  opts: { tienToTen?: string; vu?: VuTaiDungTep[] } = {},
): Promise<{ daTao: number; daCo: number }> {
  const ds =
    opts.vu ??
    ((await Bun.file(join(GOC, "data", "tro-choi", "tai-dung.json")).json()) as { vu: VuTaiDungTep[] }).vu;
  const [chuDe] = (await sql`SELECT id FROM question_topics WHERE code = 'gt-xu-ly-vi-pham'`) as any[];
  let daTao = 0;
  let daCo = 0;
  for (const v of ds) {
    const loi = kiemTraVuTaiDung(v.payload, v.answer);
    if (loi.length) throw new Error(`Vụ ${v.ma} không hợp lệ: ${loi.map((l) => l.loi).join(" ")}`);
    const tieuDe = `${opts.tienToTen ?? ""}${v.tieu_de}`;
    const [co] =
      (await sql`SELECT id FROM game_content WHERE game_code = ${MA_TAI_DUNG} AND title = ${tieuDe}`) as any[];
    if (co) {
      daCo++;
      continue;
    }
    await taoNoiDungTroChoi(
      {
        game_code: MA_TAI_DUNG,
        topic_id: chuDe?.id ?? null,
        level: v.payload.muc <= 2 ? "de" : v.payload.muc <= 4 ? "trung_binh" : "kho",
        title: tieuDe,
        payload: v.payload as unknown as Record<string, unknown>,
        answer: v.answer as unknown as Record<string, unknown>,
        explanation: GHI_CHU_DEMO_TAI_DUNG,
        citations: [],
        refs: maMucPhat(v.answer).map((ma) => ({ loai: "violation" as const, ma })),
        offline_ok: true,
        status: "cho_duyet",
      },
      "seed-demo",
    );
    daTao++;
  }
  return { daTao, daCo };
}
