/**
 * Nạp tình huống DEMO của trò chơi vào `game_content`, trạng thái chờ duyệt (docs/PLAN.md GĐ-G2).
 *
 *   bun run packages/db/src/seed-tro-choi.ts
 *
 * Hiện có: 20 tình huống "Súng bắn tốc độ" ở data/tro-choi/sung-ban-toc-do.json (GĐ-G2), 42 tình
 * huống "Lập biên bản" ở data/tro-choi/lap-bien-ban.json (GĐ-G3) và 30 hồ sơ "Kiểm tra giấy tờ" ở
 * data/tro-choi/kiem-tra-giay-to.json (GĐ-T1).
 *
 * Súng bắn tốc độ: Mỗi tình huống chỉ
 * có dữ kiện; đáp án suy ra từ mức phạt theo tốc độ đã duyệt. Tham chiếu ghi sẵn: mọi dòng mức phạt
 * theo tốc độ của loại xe đó (data/tra-cuu/muc-phat.json) và biển P.127, nên sửa một khung phạt thì
 * tình huống tự rút khỏi trò chơi cho tới khi duyệt lại.
 *
 * Chạy lại được: tình huống đã có (theo tên) thì bỏ qua, không đổi trạng thái đã duyệt.
 */
import { join } from "node:path";
import {
  type DapAnDungXe,
  type DongMucPhat,
  type HoSoGiayTo,
  kiemTraHoSoTroChoi,
  kiemTraTinhHuongBienBan,
  kiemTraTinhHuongDungXe,
  kiemTraTinhHuongTocDo,
  MA_DUNG_XE,
  MA_KIEM_TRA_GIAY_TO,
  MA_LAP_BIEN_BAN,
  MA_QUY_TRINH_DUNG_XE,
  MA_SUNG_BAN_TOC_DO,
  type MaLoiGiayTo,
  type PayloadDungXe,
  type TinhHuongTocDo,
} from "@qdpl/dao-tao";
import { napDoanDuongCamBien } from "./cam-bien.ts";
import { napChotDem } from "./chot-dem.ts";
import { sql } from "./client.ts";
import { napHoSoPhatNguoi } from "./duyet-phat-nguoi.ts";
import { napXeKhach } from "./len-xe-khach.ts";
import { taoNoiDungTroChoi } from "./noi-dung-tro-choi.ts";
import { napKichBanSoiCamera } from "./soi-camera.ts";
import { napSoiXeCaiTao } from "./soi-xe-cai-tao.ts";
import { napTaiDung } from "./tai-dung.ts";
import { napXeTramCan } from "./tram-can.ts";
import { napTruyVet } from "./truy-vet.ts";
import { napTuLai } from "./tu-lai.ts";

const GOC = join(import.meta.dir, "..", "..", "..");
const NGUOI_TAO = "seed-demo";
const GHI_CHU_DEMO =
  "Dữ liệu demo, chưa duyệt. Tình huống giả định để thử trò chơi; khung phạt, mức tiền, trừ điểm suy ra từ bảng mức phạt theo tốc độ, bảng này còn là bản nháp chờ đơn vị chuyên môn đối chiếu Nghị định số 168/2024/NĐ-CP.";

interface TinhHuongTep {
  ma: string;
  tieu_de: string;
  muc_do: "de" | "trung_binh" | "kho";
  du_kien: TinhHuongTocDo;
  y_do?: string;
}

export async function napTinhHuongSungBan(
  opts: { tienToTen?: string; tinhHuong?: TinhHuongTep[]; mucPhat?: DongMucPhat[]; maBien?: string } = {},
): Promise<{ daTao: number; daCo: number }> {
  const tinhHuong =
    opts.tinhHuong ??
    (
      (await Bun.file(join(GOC, "data", "tro-choi", "sung-ban-toc-do.json")).json()) as {
        tinh_huong: TinhHuongTep[];
      }
    ).tinh_huong;
  const mucPhat =
    opts.mucPhat ??
    ((await Bun.file(join(GOC, "data", "tra-cuu", "muc-phat.json")).json()) as { dong: DongMucPhat[] }).dong;
  const [chuDe] = (await sql`SELECT id FROM question_topics WHERE code = 'gt-toc-do-khoang-cach'`) as any[];

  let daTao = 0;
  let daCo = 0;
  for (const t of tinhHuong) {
    const loi = kiemTraTinhHuongTocDo(t.du_kien);
    if (loi.length) throw new Error(`Tình huống ${t.ma} không hợp lệ: ${loi.join(" ")}`);
    const tieuDe = `${opts.tienToTen ?? ""}${t.tieu_de}`;
    const [co] =
      (await sql`SELECT id FROM game_content WHERE game_code = ${MA_SUNG_BAN_TOC_DO} AND title = ${tieuDe}`) as any[];
    if (co) {
      daCo++;
      continue;
    }
    const refs = [
      ...mucPhat
        .filter((d) => d.xe === t.du_kien.loai_xe && d.toc_do_vuot)
        .map((d) => ({ loai: "violation" as const, ma: d.ma })),
      { loai: "traffic_sign" as const, ma: opts.maBien ?? "P.127" },
    ];
    await taoNoiDungTroChoi(
      {
        game_code: MA_SUNG_BAN_TOC_DO,
        topic_id: chuDe?.id ?? null,
        level: t.muc_do,
        title: tieuDe,
        payload: { ...t.du_kien },
        answer: {},
        explanation: `${GHI_CHU_DEMO} Ý đồ của tình huống: ${t.y_do ?? "không ghi"}.`,
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

/* ------------------------------------------------------------------ */
/* Lập biên bản (GĐ-G3)                                                */
/* ------------------------------------------------------------------ */

const GHI_CHU_DEMO_BIEN_BAN =
  "Dữ liệu demo, chưa duyệt. Tình huống giả định để thử trò chơi; điều khoản, khung tiền, hình thức bổ sung, trừ điểm lấy từ bảng mức phạt, bảng này còn là bản nháp chờ đơn vị chuyên môn đối chiếu Nghị định số 168/2024/NĐ-CP (căn cứ mới ghi tới mức Điều).";

export interface TinhHuongBienBanTep {
  ma: string;
  tieu_de: string;
  muc_do: "de" | "trung_binh" | "kho";
  loi_ke: string;
  hinh?: string | null;
  vi_pham: string[];
  y_do?: string;
  ghi_chu_kiem_tra?: string;
}

/**
 * Nạp tình huống Lập biên bản vào chờ duyệt. Tình huống chỉ trỏ tới mã mức phạt (refs), nên sửa
 * một dòng mức phạt thì tình huống tự rút khỏi trò chơi cho tới khi duyệt lại.
 */
export async function napTinhHuongLapBienBan(
  opts: {
    tienToTen?: string;
    tienToMa?: string;
    tinhHuong?: TinhHuongBienBanTep[];
    mucPhat?: DongMucPhat[];
  } = {},
): Promise<{ daTao: number; daCo: number }> {
  const tinhHuong =
    opts.tinhHuong ??
    (
      (await Bun.file(join(GOC, "data", "tro-choi", "lap-bien-ban.json")).json()) as {
        tinh_huong: TinhHuongBienBanTep[];
      }
    ).tinh_huong;
  const mucPhat =
    opts.mucPhat ??
    ((await Bun.file(join(GOC, "data", "tra-cuu", "muc-phat.json")).json()) as { dong: DongMucPhat[] }).dong;
  const bang = new Map(
    mucPhat.map((d) => [
      `${opts.tienToMa ?? ""}${d.ma}`,
      {
        ma: `${opts.tienToMa ?? ""}${d.ma}`,
        xe: d.xe,
        phat_tu: d.phat_tu,
        phat_den: d.phat_den,
        hinh_thuc_bo_sung: d.hinh_thuc_bo_sung ?? [],
        tru_diem: d.tru_diem ?? null,
      },
    ]),
  );
  const [chuDe] = (await sql`SELECT id FROM question_topics WHERE code = 'gt-xu-ly-vi-pham'`) as any[];

  let daTao = 0;
  let daCo = 0;
  for (const t of tinhHuong) {
    const viPham = t.vi_pham.map((m) => `${opts.tienToMa ?? ""}${m}`);
    const payload = { loi_ke: t.loi_ke, hinh: t.hinh ?? null };
    const loi = kiemTraTinhHuongBienBan(payload, { vi_pham: viPham }, bang);
    if (loi.length) throw new Error(`Tình huống ${t.ma} không hợp lệ: ${loi.join(" ")}`);
    const tieuDe = `${opts.tienToTen ?? ""}${t.tieu_de}`;
    const [co] =
      (await sql`SELECT id FROM game_content WHERE game_code = ${MA_LAP_BIEN_BAN} AND title = ${tieuDe}`) as any[];
    if (co) {
      daCo++;
      continue;
    }
    await taoNoiDungTroChoi(
      {
        game_code: MA_LAP_BIEN_BAN,
        topic_id: chuDe?.id ?? null,
        level: t.muc_do,
        title: tieuDe,
        payload,
        answer: { vi_pham: viPham },
        explanation: [
          GHI_CHU_DEMO_BIEN_BAN,
          `Ý đồ của tình huống: ${t.y_do ?? "không ghi"}`,
          t.ghi_chu_kiem_tra ? `Cần đơn vị chuyên môn kiểm tra: ${t.ghi_chu_kiem_tra}` : null,
        ]
          .filter(Boolean)
          .join(" "),
        citations: [],
        refs: viPham.map((ma) => ({ loai: "violation" as const, ma })),
        offline_ok: true,
        status: "cho_duyet",
      },
      NGUOI_TAO,
    );
    daTao++;
  }
  return { daTao, daCo };
}

/* ------------------------------------------------------------------ */
/* Kiểm tra giấy tờ (GĐ-T1)                                            */
/* ------------------------------------------------------------------ */

const GHI_CHU_DEMO_GIAY_TO =
  "Dữ liệu demo, chưa duyệt. Hồ sơ giả định, sinh bằng hàm sinh hồ sơ dùng chung; lỗi của hồ sơ suy ra từ luật giấy tờ (data/tra-cuu/luat-giay-to.json), luật này còn là bản nháp chưa đối chiếu Luật số 36/2024/QH15 và văn bản về bảo hiểm bắt buộc.";

export interface HoSoGiayToTep {
  ma: string;
  tieu_de: string;
  muc: number;
  loi: MaLoiGiayTo[];
  y_do?: string;
  ho_so: HoSoGiayTo;
}

/**
 * Nạp hồ sơ Kiểm tra giấy tờ vào chờ duyệt. Hồ sơ không trỏ tới mức phạt nào (luật giấy tờ chưa có
 * mã mức phạt), nên không có tham chiếu; hồ sơ rút khỏi trò khi luật đã duyệt không còn cho đúng
 * các lỗi dự kiến (packages/dao-tao, `dungDuocOMan`).
 */
export async function napHoSoGiayTo(
  opts: { tienToTen?: string; hoSo?: HoSoGiayToTep[] } = {},
): Promise<{ daTao: number; daCo: number }> {
  const hoSo =
    opts.hoSo ??
    (
      (await Bun.file(join(GOC, "data", "tro-choi", "kiem-tra-giay-to.json")).json()) as {
        ho_so: HoSoGiayToTep[];
      }
    ).ho_so;
  const [chuDe] =
    (await sql`SELECT id FROM question_topics WHERE code = 'gt-phuong-tien-nguoi-lai'`) as any[];
  let daTao = 0;
  let daCo = 0;
  for (const h of hoSo) {
    const payload = { ...h.ho_so, muc: h.muc };
    const loi = kiemTraHoSoTroChoi(payload, h.loi);
    if (loi.length) throw new Error(`Hồ sơ ${h.ma} không hợp lệ: ${loi.join(" ")}`);
    const tieuDe = `${opts.tienToTen ?? ""}${h.tieu_de}`;
    const [co] =
      (await sql`SELECT id FROM game_content WHERE game_code = ${MA_KIEM_TRA_GIAY_TO} AND title = ${tieuDe}`) as any[];
    if (co) {
      daCo++;
      continue;
    }
    await taoNoiDungTroChoi(
      {
        game_code: MA_KIEM_TRA_GIAY_TO,
        topic_id: chuDe?.id ?? null,
        level: h.muc <= 2 ? "de" : h.muc <= 4 ? "trung_binh" : "kho",
        title: tieuDe,
        payload: payload as unknown as Record<string, unknown>,
        answer: { loi: h.loi },
        explanation: `${GHI_CHU_DEMO_GIAY_TO} Ý đồ của hồ sơ: ${h.y_do ?? "không ghi"}`,
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

/* ------------------------------------------------------------------ */
/* Dừng xe đúng quy trình (GĐ-T4)                                      */
/* ------------------------------------------------------------------ */

const GHI_CHU_DEMO_DUNG_XE =
  "Dữ liệu demo, chưa duyệt. Tình huống giả định; giấy tờ sinh bằng hàm sinh hồ sơ dùng chung. Quy trình các bước (quy trình dung-xe-kiem-tra), vị trí an toàn, thời gian thổi của máy đo, hướng xử lý chưa đối chiếu văn bản: kho văn bản đang nối chưa có văn bản nào về quy trình dừng xe, kiểm tra nồng độ cồn, tạm giữ phương tiện.";

export interface TinhHuongDungXeTep {
  ma: string;
  tieu_de: string;
  y_do?: string;
  can_kiem_tra?: string;
  tinh_huong: PayloadDungXe;
  dap_an: DapAnDungXe;
}

/**
 * Nạp tình huống Dừng xe vào chờ duyệt. Tham chiếu: quy trình dừng xe và các dòng mức phạt tình huống
 * trỏ tới, nên sửa quy trình hoặc mức phạt thì tình huống tự rút khỏi trò cho tới khi duyệt lại.
 */
export async function napTinhHuongDungXe(
  opts: { tienToTen?: string; tinhHuong?: TinhHuongDungXeTep[] } = {},
): Promise<{ daTao: number; daCo: number }> {
  const tinhHuong =
    opts.tinhHuong ??
    (
      (await Bun.file(join(GOC, "data", "tro-choi", "dung-xe.json")).json()) as {
        tinh_huong: TinhHuongDungXeTep[];
      }
    ).tinh_huong;
  const [chuDe] = (await sql`SELECT id FROM question_topics WHERE code = 'gt-xu-ly-vi-pham'`) as any[];
  let daTao = 0;
  let daCo = 0;
  for (const t of tinhHuong) {
    const loi = kiemTraTinhHuongDungXe(t.tinh_huong, t.dap_an);
    if (loi.length) throw new Error(`Tình huống ${t.ma} không hợp lệ: ${loi.join(" ")}`);
    const tieuDe = `${opts.tienToTen ?? ""}${t.tieu_de}`;
    const [co] =
      (await sql`SELECT id FROM game_content WHERE game_code = ${MA_DUNG_XE} AND title = ${tieuDe}`) as any[];
    if (co) {
      daCo++;
      continue;
    }
    const maMucPhat = [
      ...new Set(t.dap_an.vi_pham_khac.map((v) => v.ma_muc_phat).filter((m): m is string => !!m)),
    ];
    await taoNoiDungTroChoi(
      {
        game_code: MA_DUNG_XE,
        topic_id: chuDe?.id ?? null,
        level: t.tinh_huong.muc <= 2 ? "de" : t.tinh_huong.muc <= 4 ? "trung_binh" : "kho",
        title: tieuDe,
        payload: t.tinh_huong as unknown as Record<string, unknown>,
        answer: t.dap_an as unknown as Record<string, unknown>,
        explanation: [
          GHI_CHU_DEMO_DUNG_XE,
          `Ý đồ của tình huống: ${t.y_do ?? "không ghi"}`,
          t.can_kiem_tra ? `Cần đơn vị chuyên môn kiểm tra: ${t.can_kiem_tra}` : null,
        ]
          .filter(Boolean)
          .join(" "),
        citations: [],
        refs: [
          { loai: "procedure" as const, ma: MA_QUY_TRINH_DUNG_XE },
          ...maMucPhat.map((ma) => ({ loai: "violation" as const, ma })),
        ],
        offline_ok: true,
        status: "cho_duyet",
      },
      NGUOI_TAO,
    );
    daTao++;
  }
  return { daTao, daCo };
}

if (import.meta.main) {
  const r = await napTinhHuongSungBan();
  console.log(`Súng bắn tốc độ: tạo ${r.daTao} tình huống demo (chờ duyệt), ${r.daCo} tình huống đã có.`);
  const b = await napTinhHuongLapBienBan();
  console.log(`Lập biên bản: tạo ${b.daTao} tình huống demo (chờ duyệt), ${b.daCo} tình huống đã có.`);
  const g = await napHoSoGiayTo();
  console.log(`Kiểm tra giấy tờ: tạo ${g.daTao} hồ sơ demo (chờ duyệt), ${g.daCo} hồ sơ đã có.`);
  const d = await napTinhHuongDungXe();
  console.log(
    `Dừng xe đúng quy trình: tạo ${d.daTao} tình huống demo (chờ duyệt), ${d.daCo} tình huống đã có.`,
  );
  const c = await napDoanDuongCamBien();
  console.log(`Cắm biển cho tuyến đường: tạo ${c.daTao} đoạn đường demo (chờ duyệt), ${c.daCo} đoạn đã có.`);
  const s = await napKichBanSoiCamera();
  console.log(`Soi camera: tạo ${s.daTao} kịch bản demo (chờ duyệt), ${s.daCo} kịch bản đã có.`);
  const pn = await napHoSoPhatNguoi();
  console.log(`Duyệt hồ sơ phạt nguội: tạo ${pn.daTao} hồ sơ demo (chờ duyệt), ${pn.daCo} hồ sơ đã có.`);
  const tc = await napXeTramCan();
  console.log(`Trạm cân tải trọng: tạo ${tc.daTao} xe demo (chờ duyệt), ${tc.daCo} xe đã có.`);
  const xk = await napXeKhach();
  console.log(`Lên xe khách: tạo ${xk.daTao} xe demo (chờ duyệt), ${xk.daCo} xe đã có.`);
  const sx = await napSoiXeCaiTao();
  console.log(`Soi xe cải tạo: tạo ${sx.daTao} biến thể và xe demo (chờ duyệt), ${sx.daCo} đã có.`);
  const cd = await napChotDem();
  console.log(
    `Dựng chốt an toàn ban đêm: tạo ${cd.daTao} đoạn đường và bộ tiêu chí demo (chờ duyệt), ${cd.daCo} đã có.`,
  );
  const tv = await napTruyVet();
  console.log(`Truy vết xe bỏ trốn: tạo ${tv.daTao} vụ demo (chờ duyệt), ${tv.daCo} vụ đã có.`);
  const td = await napTaiDung();
  console.log(`Tái dựng hiện trường: tạo ${td.daTao} vụ demo (chờ duyệt), ${td.daCo} vụ đã có.`);
  const tl = await napTuLai();
  console.log(`Tự lái qua phố: tạo ${tl.daTao} khu phố và bảng lỗi demo (chờ duyệt), ${tl.daCo} đã có.`);
  console.log(
    "Để chơi thử: duyệt các dòng mức phạt (và biển P.127 cho Súng bắn tốc độ) ở /quan-tri/du-lieu-tra-cuu, duyệt tình huống ở /quan-tri/noi-dung-tro-choi, rồi bật trò ở cùng trang.",
  );
  await sql.end();
}
