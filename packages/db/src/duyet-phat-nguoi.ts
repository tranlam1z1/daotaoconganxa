/**
 * Dữ liệu của trò "Duyệt hồ sơ phạt nguội" (docs/PLAN.md GĐ-T11): luật kiểm hồ sơ đã duyệt
 * (`document_rules`, nhóm `ho_so_phat_nguoi`, câu D16), nguồn hồ sơ cho lượt chơi và gói offline, nạp
 * hồ sơ mẫu.
 *
 * Nguồn là hồ sơ ĐÃ DUYỆT (qua `noiDungDungDuoc`) kèm luật kiểm hồ sơ ĐÃ DUYỆT còn hiệu lực tại ngày
 * chơi và dòng mức phạt ĐÃ DUYỆT của hành vi đề xuất. Hồ sơ trỏ tới dòng mức phạt bằng `refs`, nên sửa
 * dòng đó thì hồ sơ rút khỏi trò cho tới khi duyệt lại. Sửa một luật kiểm hồ sơ thì luật về chờ duyệt và
 * rời nguồn; hồ sơ cần luật đó không vào lượt (`hoSoDungDuocOMan`).
 */
import { join } from "node:path";
import {
  type ChoThieuPhatNguoi,
  type HoSoPhatNguoi,
  kiemTraHoSoPhatNguoi,
  type LuatHoSoPhatNguoi,
  MA_DUYET_PHAT_NGUOI,
  type NguonPhatNguoi,
  type PayloadPhatNguoi,
} from "@qdpl/dao-tao";
import { sql } from "./client.ts";
import { mucPhatDaDuyetTheoMa } from "./kiem-tra-giay-to.ts";
import { noiDungDungDuoc, taoNoiDungTroChoi } from "./noi-dung-tro-choi.ts";

/** Luật kiểm hồ sơ phạt nguội đã duyệt, còn hiệu lực tại `ngay` (YYYY-MM-DD). */
export async function luatPhatNguoiDaDuyet(ngay: string): Promise<LuatHoSoPhatNguoi[]> {
  const rows = (await sql`
    SELECT code, version, check_kind, doc_kind, params, name, explanation, citation_urn, violation_code
    FROM document_rules
    WHERE nhom = 'ho_so_phat_nguoi' AND status = 'da_duyet'
      AND effective_from <= ${ngay} AND (effective_to IS NULL OR effective_to > ${ngay})
    ORDER BY code`) as any[];
  return rows.map((r) => ({
    ma: r.code,
    version: r.version,
    nhom: "ho_so_phat_nguoi" as const,
    kiem: r.check_kind,
    phan: r.doc_kind,
    tham_so: r.params ?? {},
    ten: r.name,
    giai_thich: r.explanation,
    can_cu: r.citation_urn,
    ma_muc_phat: r.violation_code,
  }));
}

const maMucPhat = (p: HoSoPhatNguoi) => (p.de_xuat?.ma_muc_phat ? [p.de_xuat.ma_muc_phat] : []);

/** Nguồn của trò: hồ sơ dùng được kèm luật và mức phạt. `chiOffline` cho gói offline. */
export async function nguonDuyetPhatNguoi(opts: {
  ngay: string;
  chiOffline?: boolean;
}): Promise<NguonPhatNguoi[]> {
  const [hoSo, luat] = await Promise.all([
    noiDungDungDuoc(MA_DUYET_PHAT_NGUOI, { chiOffline: opts.chiOffline }),
    luatPhatNguoiDaDuyet(opts.ngay),
  ]);
  const mucPhat = await mucPhatDaDuyetTheoMa(
    [...new Set(hoSo.flatMap((h) => maMucPhat(h.payload as unknown as HoSoPhatNguoi)))],
    opts.ngay,
  );
  const kq: NguonPhatNguoi[] = [];
  for (const h of hoSo) {
    const p = h.payload as unknown as PayloadPhatNguoi;
    const cho = (h.answer as { cho_thieu?: ChoThieuPhatNguoi[] }).cho_thieu ?? [];
    if (kiemTraHoSoPhatNguoi(p, cho).length) continue;
    const { muc, ...hs } = p;
    kq.push({
      id: h.id,
      code: h.code,
      version: h.version,
      topic_id: h.topic_id,
      muc,
      ho_so: hs,
      cho_thieu_du_kien: cho,
      luat,
      muc_phat: Object.fromEntries(
        maMucPhat(hs)
          .filter((m) => mucPhat[m])
          .map((m) => [m, mucPhat[m]!]),
      ),
    });
  }
  return kq;
}

/* ------------------------------------------------------------------ */
/* Nạp hồ sơ mẫu                                                       */
/* ------------------------------------------------------------------ */

const GOC = join(import.meta.dir, "..", "..", "..");
const GHI_CHU_DEMO_PHAT_NGUOI =
  "Dữ liệu demo, chưa duyệt. Hồ sơ giả định; chỗ thiếu suy ra từ luật kiểm hồ sơ (data/tra-cuu/luat-ho-so-phat-nguoi.json), luật này còn là bản nháp: kho văn bản chưa có văn bản về sử dụng dữ liệu thu từ thiết bị kỹ thuật nghiệp vụ, thủ tục gửi thông báo, kiểm định thiết bị. Mã mức phạt của hành vi đề xuất chưa đối chiếu Nghị định số 168/2024/NĐ-CP (chưa có trong kho).";

export interface HoSoPhatNguoiTep {
  ma: string;
  tieu_de: string;
  muc: number;
  cho_thieu: ChoThieuPhatNguoi[];
  y_do?: string;
  ho_so: HoSoPhatNguoi;
}

/**
 * Nạp hồ sơ Duyệt phạt nguội vào chờ duyệt (data/tro-choi/phat-nguoi.json). Chạy lại được: hồ sơ đã có
 * (theo tên) thì bỏ qua. Hồ sơ sai dạng thì dừng, báo lỗi.
 */
export async function napHoSoPhatNguoi(
  opts: { tienToTen?: string; hoSo?: HoSoPhatNguoiTep[] } = {},
): Promise<{ daTao: number; daCo: number }> {
  const ds =
    opts.hoSo ??
    (
      (await Bun.file(join(GOC, "data", "tro-choi", "phat-nguoi.json")).json()) as {
        ho_so: HoSoPhatNguoiTep[];
      }
    ).ho_so;
  const [chuDe] = (await sql`SELECT id FROM question_topics WHERE code = 'gt-xu-ly-vi-pham'`) as any[];
  let daTao = 0;
  let daCo = 0;
  for (const h of ds) {
    const payload: PayloadPhatNguoi = { ...h.ho_so, muc: h.muc };
    const loi = kiemTraHoSoPhatNguoi(payload, h.cho_thieu);
    if (loi.length) throw new Error(`Hồ sơ ${h.ma} không hợp lệ: ${loi.join(" ")}`);
    const tieuDe = `${opts.tienToTen ?? ""}${h.tieu_de}`;
    const [co] =
      (await sql`SELECT id FROM game_content WHERE game_code = ${MA_DUYET_PHAT_NGUOI} AND title = ${tieuDe}`) as any[];
    if (co) {
      daCo++;
      continue;
    }
    await taoNoiDungTroChoi(
      {
        game_code: MA_DUYET_PHAT_NGUOI,
        topic_id: chuDe?.id ?? null,
        level: h.muc <= 2 ? "de" : h.muc <= 4 ? "trung_binh" : "kho",
        title: tieuDe,
        payload: payload as unknown as Record<string, unknown>,
        answer: { cho_thieu: h.cho_thieu },
        explanation: `${GHI_CHU_DEMO_PHAT_NGUOI} Ý đồ của hồ sơ: ${h.y_do ?? "không ghi"}`,
        citations: [],
        refs: maMucPhat(h.ho_so).map((ma) => ({ loai: "violation" as const, ma })),
        offline_ok: true,
        status: "cho_duyet",
      },
      "seed-demo",
    );
    daTao++;
  }
  return { daTao, daCo };
}
