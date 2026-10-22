/**
 * Gieo ngân hàng câu hỏi lĩnh vực giao thông đường bộ (docs/PLAN.md GĐ3).
 *
 * Hai việc:
 *  1. Cây chủ đề câu hỏi, dựng theo cây chuyên đề giao thông của seed-dao-tao-gtdb.ts, thêm
 *     vài chủ đề con dưới "Quy tắc giao thông".
 *  2. Chuyển các bài tập `trac_nghiem`, `ghep_cap`, `sap_xep` đã soạn trong các chuyên đề giao
 *     thông thành câu hỏi ngân hàng ở trạng thái `da_duyet` (đã qua biên tập khi soạn bài).
 *     Cần chạy seed-dao-tao-gtdb.ts trước; chưa có thì bước này bỏ qua và báo ra.
 *
 * Ghi thêm tệp mẫu nhập câu hỏi ra data/mau/mau-nhap-cau-hoi.xlsx.
 *
 * Chạy lại được: câu đã có mã thì bỏ qua, chủ đề cập nhật theo mã.
 * Chạy: bun run db:seed:ngan-hang
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  COT_EXCEL_CAU_HOI,
  DONG_MAU_CAU_HOI,
  HUONG_DAN_TEP_CAU_HOI,
  kiemTraCauHoi,
  type LoaiCauHoi,
  type MucDoCauHoi,
  type NoiDungCauHoi,
} from "@qdpl/dao-tao";
import { sql } from "./client.ts";
import { linhVucTheoSlug } from "./dao-tao.ts";
import {
  luuChuDeCauHoi,
  maCauHoiDaCo,
  type TaoCauHoiInput,
  taoNhieuCauHoi,
  taoTepCauHoi,
} from "./ngan-hang.ts";

const ROOT = join(import.meta.dir, "..", "..", "..");
const NGUOI_GIEO = "he_thong:seed-ngan-hang";

/* ------------------------------------------------------------------ */
/* Cây chủ đề                                                          */
/* ------------------------------------------------------------------ */

interface KhungChuDe {
  code: string;
  name: string;
  cha?: string;
  /** Chuyên đề giao thông mà bài tập được chuyển về chủ đề này. */
  chuyenDe?: string;
}

export const CAY_CHU_DE_GT: KhungChuDe[] = [
  { code: "gt", name: "Giao thông đường bộ" },
  {
    code: "gt-he-thong-phap-luat",
    name: "Hệ thống pháp luật giao thông đường bộ",
    cha: "gt",
    chuyenDe: "he-thong-phap-luat-gtdb",
  },
  { code: "gt-quy-tac", name: "Quy tắc giao thông", cha: "gt", chuyenDe: "quy-tac-giao-thong-duong-bo" },
  { code: "gt-toc-do-khoang-cach", name: "Tốc độ, khoảng cách", cha: "gt-quy-tac" },
  { code: "gt-nong-do-con", name: "Nồng độ cồn và hành vi bị cấm", cha: "gt-quy-tac" },
  {
    code: "gt-phuong-tien-nguoi-lai",
    name: "Phương tiện và người lái xe",
    cha: "gt",
    chuyenDe: "phuong-tien-va-nguoi-lai-xe",
  },
  { code: "gt-giay-phep-lai-xe", name: "Giấy phép lái xe", cha: "gt-phuong-tien-nguoi-lai" },
  { code: "gt-kiem-dinh-nien-han", name: "Kiểm định, niên hạn sử dụng", cha: "gt-phuong-tien-nguoi-lai" },
  {
    code: "gt-tuan-tra-kiem-soat",
    name: "Tuần tra, kiểm soát, chỉ huy giao thông",
    cha: "gt",
    chuyenDe: "tuan-tra-kiem-soat-gtdb",
  },
  {
    code: "gt-xu-ly-vi-pham",
    name: "Xử lý vi phạm hành chính",
    cha: "gt",
    chuyenDe: "xu-ly-vi-pham-giao-thong-duong-bo",
  },
  {
    code: "gt-tru-diem-gplx",
    name: "Trừ điểm, phục hồi điểm giấy phép lái xe",
    cha: "gt-xu-ly-vi-pham",
    chuyenDe: "tru-diem-phuc-hoi-diem-gplx",
  },
  {
    code: "gt-van-tai-tai-trong",
    name: "Vận tải và kiểm soát tải trọng",
    cha: "gt-xu-ly-vi-pham",
    chuyenDe: "van-tai-duong-bo-va-kiem-soat-tai-trong",
  },
  {
    code: "gt-tai-nan",
    name: "Điều tra, giải quyết tai nạn giao thông",
    cha: "gt",
    chuyenDe: "dieu-tra-giai-quyet-tai-nan-giao-thong",
  },
];

async function gieoChuDe(): Promise<Map<string, string>> {
  const linhVuc = await linhVucTheoSlug("giao-thong-duong-bo");
  const id = new Map<string, string>();
  for (const [i, t] of CAY_CHU_DE_GT.entries()) {
    const row = await luuChuDeCauHoi({
      code: t.code,
      name: t.name,
      fieldId: linhVuc?.id ?? null,
      parentId: t.cha ? (id.get(t.cha) ?? null) : null,
      ordinal: i,
    });
    id.set(t.code, row.id);
  }
  console.log(
    `  ${CAY_CHU_DE_GT.length} chủ đề${linhVuc ? "" : " (chưa có lĩnh vực giao thông, chưa gắn lĩnh vực)"}`,
  );
  return id;
}

/* ------------------------------------------------------------------ */
/* Chuyển bài tập đã soạn                                              */
/* ------------------------------------------------------------------ */

interface HoatDongCu {
  id: string;
  kind: string;
  prompt: Record<string, any>;
  answer: Record<string, any>;
  citations: string[];
  difficulty: string;
  course_slug: string;
}

function mucDoTuDoKho(d: number): MucDoCauHoi {
  if (d < 0.4) return "de";
  if (d > 0.7) return "kho";
  return "trung_binh";
}

const muc = (ds: unknown): Array<{ id: string; text: string }> =>
  Array.isArray(ds) ? ds.map((m: any) => ({ id: String(m.id), text: String(m.text) })) : [];

/** Bài tập -> câu hỏi ngân hàng. Trả null khi dạng bài không chuyển được. */
function tuHoatDong(a: HoatDongCu): NoiDungCauHoi | null {
  const chung = {
    level: mucDoTuDoKho(Number(a.difficulty)),
    stem: String(a.prompt.cau_hoi ?? "").trim(),
    explanation: (a.answer.giai_thich as string | undefined)?.trim() || null,
    citations: a.citations,
  };
  if (a.kind === "trac_nghiem") {
    const dung: string[] = a.answer.dung ?? [];
    const kind: LoaiCauHoi = dung.length > 1 ? "nhieu_dap_an" : "mot_dap_an";
    return { ...chung, kind, options: { phuong_an: muc(a.prompt.phuong_an) }, answer: { dung } };
  }
  if (a.kind === "ghep_cap") {
    return {
      ...chung,
      kind: "ghep_cap",
      options: { trai: muc(a.prompt.trai), phai: muc(a.prompt.phai) },
      answer: { cap: a.answer.cap ?? {} },
    };
  }
  if (a.kind === "sap_xep") {
    return {
      ...chung,
      kind: "sap_xep",
      options: { phuong_an: muc(a.prompt.muc ?? a.prompt.buoc ?? a.prompt.phuong_an) },
      answer: { thu_tu: a.answer.thu_tu ?? [] },
    };
  }
  return null;
}

async function chuyenBaiTap(chuDe: Map<string, string>): Promise<TaoCauHoiInput[]> {
  const theoChuyenDe = new Map(CAY_CHU_DE_GT.filter((t) => t.chuyenDe).map((t) => [t.chuyenDe!, t.code]));
  const rows = (await sql`
    SELECT a.id, a.kind, a.prompt, a.answer, a.citations, a.difficulty::text AS difficulty, c.slug AS course_slug
    FROM activities a JOIN courses c ON c.id = a.course_id
    WHERE c.slug = ANY(${[...theoChuyenDe.keys()]}) AND a.kind IN ('trac_nghiem', 'ghep_cap', 'sap_xep')
      AND NOT a.retired
    ORDER BY c.slug, a.ordinal`) as unknown as HoatDongCu[];
  if (!rows.length) {
    console.log(
      "  chưa có bài tập giao thông trong CSDL; chạy bun run db:seed:dao-tao:gtdb trước để chuyển bài tập",
    );
    return [];
  }

  // seed-dao-tao-gtdb.ts xóa và tạo lại bài tập mỗi lần chạy, nên id bài tập (và mã BT-… suy từ
  // nó) đổi sau mỗi lần gieo. Bỏ qua bài tập đã có câu chuyển sang cùng đề, để chạy lại không trùng.
  const daChuyen = new Set(
    (
      (await sql`SELECT stem FROM questions WHERE code LIKE 'BT-%'`) as unknown as Array<{ stem: string }>
    ).map((r) => r.stem),
  );
  const ra: TaoCauHoiInput[] = [];
  for (const a of rows) {
    const nd = tuHoatDong(a);
    if (!nd) continue;
    if (daChuyen.has(nd.stem)) continue;
    daChuyen.add(nd.stem);
    const loi = kiemTraCauHoi(nd);
    if (loi.length) {
      console.warn(`  bỏ qua bài tập ${a.id} (${a.course_slug}): ${loi.join("; ")}`);
      continue;
    }
    ra.push({
      ...nd,
      // Mã suy từ id bài tập để chạy lại không tạo trùng.
      code: `BT-${a.id.slice(0, 8).toUpperCase()}`,
      topicId: chuDe.get(theoChuyenDe.get(a.course_slug)!) ?? null,
      status: "da_duyet",
      source: "nguoi",
    });
  }
  console.log(
    `  ${ra.length}/${rows.length} bài tập chuyển mới thành câu hỏi đã duyệt (còn lại đã có hoặc không chuyển được)`,
  );
  return ra;
}

/* ------------------------------------------------------------------ */
/* Tệp mẫu                                                             */
/* ------------------------------------------------------------------ */

export async function ghiTepMauNhapCauHoi(): Promise<string> {
  const duongDan = join(ROOT, "data", "mau", "mau-nhap-cau-hoi.xlsx");
  await mkdir(join(ROOT, "data", "mau"), { recursive: true });
  await writeFile(duongDan, await taoTepCauHoi(COT_EXCEL_CAU_HOI, DONG_MAU_CAU_HOI, HUONG_DAN_TEP_CAU_HOI));
  return duongDan;
}

/* ------------------------------------------------------------------ */

/**
 * Gắn bài học của các chuyên đề giao thông với chủ đề tương ứng (docs/PLAN.md GĐ11), để cuối
 * bài rút được câu kiểm tra nhanh. Chỉ gắn bài chưa có chủ đề: quản trị viên nội dung đã chọn chủ đề
 * khác cho bài nào thì giữ nguyên.
 */
async function ganChuDeChoBaiHoc(chuDe: Map<string, string>): Promise<number> {
  let so = 0;
  for (const t of CAY_CHU_DE_GT) {
    const topicId = t.chuyenDe ? chuDe.get(t.code) : undefined;
    if (!topicId) continue;
    const rows = await sql`
      UPDATE lessons l SET topic_id = ${topicId}
      FROM courses c
      WHERE c.id = l.course_id AND c.slug = ${t.chuyenDe!} AND l.topic_id IS NULL
      RETURNING l.id`;
    so += rows.length;
  }
  return so;
}

export async function gieoNganHang(): Promise<void> {
  const chuDe = await gieoChuDe();
  console.log(`  gắn chủ đề cho ${await ganChuDeChoBaiHoc(chuDe)} bài học chưa có chủ đề`);
  const tatCa = await chuyenBaiTap(chuDe);
  const daCo = await maCauHoiDaCo(tatCa.map((c) => c.code!).filter(Boolean));
  const moi = tatCa.filter((c) => !daCo.has(c.code!));
  await taoNhieuCauHoi(moi, NGUOI_GIEO);
  const daDuyet = moi.filter((c) => c.status === "da_duyet").length;
  console.log(
    `  thêm ${moi.length} câu (${daDuyet} đã duyệt, ${moi.length - daDuyet} chờ duyệt); ${daCo.size} câu đã có, bỏ qua`,
  );
}

if (import.meta.main) {
  console.log("Gieo ngân hàng câu hỏi giao thông đường bộ…");
  await gieoNganHang();
  console.log(`  tệp mẫu: ${await ghiTepMauNhapCauHoi()}`);
  console.log("Xong.");
  await sql.end();
}
