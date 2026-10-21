/**
 * Dữ liệu của trò "Soi xe cải tạo" (docs/PLAN.md GĐ-T14). Trò có hai loại nội dung `game_content`
 * (game_code = 'soi_xe_cai_tao'), phân biệt bằng `payload.kieu` như trò Tự lái:
 *  - "bien_the": một mục danh mục biến thể cải tạo (tên, kiểu biến đổi hình, dòng giấy, mã mức phạt, căn
 *    cứ), `refs` trỏ tới dòng mức phạt. Sửa dòng mức phạt thì mục rút khỏi trò cho tới khi duyệt lại;
 *  - "xe": một xe (tham số xe gốc, biến thể áp lên xe). Xe dùng biến thể chưa duyệt thì không vào lượt.
 *
 * Đáp án (chỗ sai, vùng đáp án, dòng giấy) không lưu: packages/dao-tao suy ra từ tham số và danh mục.
 */
import { join } from "node:path";
import {
  type BienTheCaiTao,
  kiemTraBienTheCaiTao,
  kiemTraXeCaiTao,
  kiemTraXeVoiDanhMuc,
  MA_SOI_XE_CAI_TAO,
  type NguonSoiXe,
  type XeCaiTao,
} from "@qdpl/dao-tao";
import { sql } from "./client.ts";
import { mucPhatDaDuyetTheoMa } from "./kiem-tra-giay-to.ts";
import { type NoiDungTroChoiRow, noiDungDungDuoc, taoNoiDungTroChoi } from "./noi-dung-tro-choi.ts";

const kieuCua = (r: NoiDungTroChoiRow) => (r.payload as { kieu?: string }).kieu;

/** Danh mục biến thể đã duyệt (hợp lệ) trong các nội dung đã lấy. */
function danhMucTu(ds: NoiDungTroChoiRow[]): BienTheCaiTao[] {
  return ds
    .filter((r) => kieuCua(r) === "bien_the")
    .map((r) => ({ ...(r.payload as unknown as Omit<BienTheCaiTao, "version">), version: r.version }))
    .filter((b) => kiemTraBienTheCaiTao(b).length === 0);
}

/** Nguồn của trò: xe dùng được kèm danh mục và mức phạt đã duyệt. `chiOffline` cho gói offline. */
export async function nguonSoiXeCaiTao(opts: { ngay: string; chiOffline?: boolean }): Promise<NguonSoiXe[]> {
  const ds = await noiDungDungDuoc(MA_SOI_XE_CAI_TAO, { chiOffline: opts.chiOffline });
  const danhMuc = danhMucTu(ds);
  const mucPhat = await mucPhatDaDuyetTheoMa(
    [...new Set(danhMuc.map((b) => b.ma_muc_phat).filter((m): m is string => Boolean(m)))],
    opts.ngay,
  );
  const kq: NguonSoiXe[] = [];
  for (const r of ds) {
    if (kieuCua(r) !== "xe") continue;
    const { kieu: _, muc, ...xe } = r.payload as unknown as XeCaiTao & { kieu: string; muc: number };
    if (kiemTraXeCaiTao({ ...xe, muc }).length || kiemTraXeVoiDanhMuc(xe, danhMuc).length) continue;
    kq.push({
      id: r.id,
      code: r.code,
      version: r.version,
      topic_id: r.topic_id,
      muc,
      xe,
      danh_muc: danhMuc,
      muc_phat: mucPhat,
    });
  }
  return kq;
}

/* ------------------------------------------------------------------ */
/* Nạp mẫu                                                             */
/* ------------------------------------------------------------------ */

const GOC = join(import.meta.dir, "..", "..", "..");
const GHI_CHU_DEMO_SOI_XE =
  "Dữ liệu demo, chưa duyệt. Xe, thông số, biến thể cải tạo giả định. Căn cứ của danh mục biến thể ghi vn:chua-co-trong-kho: khi soạn (29/9/2026) không tra được kho văn bản (máy chủ tra cứu mất kết nối), chưa đối chiếu quy định về cải tạo phương tiện. Mức phạt là số minh họa.";

export interface BienTheCaiTaoTep extends Omit<BienTheCaiTao, "version"> {
  tieu_de: string;
}
export interface XeCaiTaoTep {
  ma: string;
  tieu_de: string;
  muc: number;
  y_do?: string;
  xe: XeCaiTao;
}

async function taoNeuChua(
  tieuDe: string,
  noiDung: Parameters<typeof taoNoiDungTroChoi>[0],
): Promise<boolean> {
  const [co] =
    (await sql`SELECT id FROM game_content WHERE game_code = ${MA_SOI_XE_CAI_TAO} AND title = ${tieuDe}`) as any[];
  if (co) return false;
  await taoNoiDungTroChoi(noiDung, "seed-demo");
  return true;
}

/**
 * Nạp danh mục biến thể (data/tro-choi/bien-the-cai-tao.json) và xe (data/tro-choi/xe-cai-tao.json) vào chờ
 * duyệt. Chạy lại được (theo tên). Mục sai dạng, xe không khớp danh mục thì dừng, báo lỗi.
 */
export async function napSoiXeCaiTao(
  opts: { tienToTen?: string; danhMuc?: BienTheCaiTaoTep[]; xe?: XeCaiTaoTep[] } = {},
): Promise<{ daTao: number; daCo: number }> {
  const danhMuc =
    opts.danhMuc ??
    (
      (await Bun.file(join(GOC, "data", "tro-choi", "bien-the-cai-tao.json")).json()) as {
        bien_the: BienTheCaiTaoTep[];
      }
    ).bien_the;
  const xe =
    opts.xe ??
    ((await Bun.file(join(GOC, "data", "tro-choi", "xe-cai-tao.json")).json()) as { xe: XeCaiTaoTep[] }).xe;
  const [chuDe] = (await sql`SELECT id FROM question_topics WHERE code = 'gt-xu-ly-vi-pham'`) as any[];
  let daTao = 0;
  let daCo = 0;
  const dem = (tao: boolean) => (tao ? daTao++ : daCo++);
  for (const { tieu_de, ...b } of danhMuc) {
    const loi = kiemTraBienTheCaiTao(b);
    if (loi.length) throw new Error(`Biến thể ${b.ma} không hợp lệ: ${loi.join(" ")}`);
    const tieuDe = `${opts.tienToTen ?? ""}${tieu_de}`;
    dem(
      await taoNeuChua(tieuDe, {
        game_code: MA_SOI_XE_CAI_TAO,
        topic_id: chuDe?.id ?? null,
        level: "de",
        title: tieuDe,
        payload: { kieu: "bien_the", ...b } as unknown as Record<string, unknown>,
        answer: {},
        explanation: `${GHI_CHU_DEMO_SOI_XE} ${b.giai_thich}`,
        citations: [],
        refs: b.ma_muc_phat ? [{ loai: "violation" as const, ma: b.ma_muc_phat }] : [],
        offline_ok: true,
        status: "cho_duyet",
      }),
    );
  }
  for (const x of xe) {
    const loi = [...kiemTraXeCaiTao({ ...x.xe, muc: x.muc }), ...kiemTraXeVoiDanhMuc(x.xe, danhMuc)];
    if (loi.length) throw new Error(`Xe ${x.ma} không hợp lệ: ${loi.join(" ")}`);
    const tieuDe = `${opts.tienToTen ?? ""}${x.tieu_de}`;
    dem(
      await taoNeuChua(tieuDe, {
        game_code: MA_SOI_XE_CAI_TAO,
        topic_id: chuDe?.id ?? null,
        level: x.muc <= 2 ? "de" : x.muc <= 4 ? "trung_binh" : "kho",
        title: tieuDe,
        payload: { kieu: "xe", ...x.xe, muc: x.muc } as unknown as Record<string, unknown>,
        answer: {},
        explanation: `${GHI_CHU_DEMO_SOI_XE} Ý đồ của xe: ${x.y_do ?? "không ghi"}`,
        citations: [],
        refs: [],
        offline_ok: true,
        status: "cho_duyet",
      }),
    );
  }
  return { daTao, daCo };
}
