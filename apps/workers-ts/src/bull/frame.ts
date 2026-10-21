/**
 * KHUNG CẤU TRÚC KHO (`corpus_targets`): kho ĐÁNG LẼ phải có những gì.
 *
 * Bộ điều phối nạp kho (src/backfill.ts) đọc khung này để biết phải nạp cái gì,
 * theo thứ tự nào. Thứ tự ưu tiên lấy từ ke-hoach/04 §5:
 *   1. hạ tầng pháp lý (Luật BHVBQPPL và văn bản hướng dẫn)
 *   2. Hiến pháp, bộ luật/luật, nghị định, thông tư còn hiệu lực
 *   3. văn bản hợp nhất chính thức
 *   4. văn bản hết hiệu lực còn cần tra cứu lịch sử (từ 2005)
 *   5. chuyên đề ưu tiên (đầu tư công, đấu thầu, ngân sách, CNTT, KH&CN)
 *   6. địa phương: Thanh Hóa trước
 *
 * Số lượng kỳ vọng là ƯỚC TÍNH của kế hoạch, dùng để biết còn thiếu bao nhiêu;
 * xác nhận lại bằng đối soát với danh mục của nguồn.
 */
import { sql } from "@qdpl/db";
import type { DiscoverJob } from "@qdpl/queue";
import { LOAI_TRU_GTDB, TU_KHOA_GTDB } from "../crawler/tu-khoa.ts";

export interface CorpusTargetRow {
  id: string;
  ma: string;
  nhom: string;
  uu_tien: number;
  doc_type: string | null;
  co_quan: string | null;
  nam_tu: number | null;
  nam_den: number | null;
  chi_con_hieu_luc: boolean;
  nguon: string;
  so_luong_ky_vong: number | null;
  ghi_chu: string | null;
  /** Lọc theo tiêu đề ở bước phát hiện (ô khung theo lĩnh vực); rỗng = lấy cả loại. */
  tu_khoa: string[];
  loai_tru: string[];
}

export interface CorpusTargetSeed {
  ma: string;
  nhom: string;
  uuTien: number;
  docType?: string;
  coQuan?: string;
  namTu?: number;
  namDen?: number;
  chiConHieuLuc?: boolean;
  nguon?: string;
  soLuongKyVong?: number;
  ghiChu?: string;
  tuKhoa?: readonly string[];
  loaiTru?: readonly string[];
}

/**
 * Khung mặc định. Mỗi dòng là một "ô" của kho.
 * Chỉnh sửa ở đây rồi chạy `bull frame --seed` để cập nhật CSDL.
 */
export const DEFAULT_TARGETS: CorpusTargetSeed[] = [
  // 1. Hạ tầng pháp lý — phải có trước vì mọi việc còn lại dựa vào nó.
  {
    ma: "ha-tang-luat-bhvbqppl",
    nhom: "ha_tang_phap_ly",
    uuTien: 10,
    docType: "l",
    nguon: "congbao",
    soLuongKyVong: 5,
    ghiChu: "Luật Ban hành VBQPPL và các luật về công tác xây dựng pháp luật",
  },
  {
    ma: "ha-tang-nghi-dinh-huong-dan",
    nhom: "ha_tang_phap_ly",
    uuTien: 11,
    docType: "nd",
    nguon: "congbao",
    soLuongKyVong: 10,
    ghiChu: "Nghị định quy định chi tiết Luật BHVBQPPL, pháp điển, hợp nhất",
  },
  // 2. Nền: Hiến pháp -> luật -> nghị định -> thông tư.
  {
    ma: "hien-phap",
    nhom: "hien_phap",
    uuTien: 20,
    docType: "hp",
    nguon: "congbao",
    soLuongKyVong: 2,
    ghiChu: "Hiến pháp 2013 và nghị quyết sửa đổi 2025",
  },
  {
    ma: "bo-luat-con-hieu-luc",
    nhom: "luat",
    uuTien: 30,
    docType: "bl",
    nguon: "congbao",
    soLuongKyVong: 15,
  },
  {
    ma: "luat-con-hieu-luc",
    nhom: "luat",
    uuTien: 31,
    docType: "l",
    nguon: "congbao",
    soLuongKyVong: 250,
    ghiChu: "Ước tính ke-hoach/04 §5",
  },
  {
    ma: "phap-lenh-con-hieu-luc",
    nhom: "luat",
    uuTien: 32,
    docType: "pl",
    nguon: "congbao",
    soLuongKyVong: 30,
  },
  {
    ma: "nghi-dinh-con-hieu-luc",
    nhom: "nghi_dinh",
    uuTien: 40,
    docType: "nd",
    nguon: "congbao",
    soLuongKyVong: 1500,
    ghiChu: "Ước tính ke-hoach/04 §5",
  },
  {
    ma: "quyet-dinh-ttg-con-hieu-luc",
    nhom: "nghi_dinh",
    uuTien: 41,
    docType: "qd-ttg",
    nguon: "congbao",
    soLuongKyVong: 800,
  },
  {
    ma: "thong-tu-con-hieu-luc",
    nhom: "thong_tu",
    uuTien: 50,
    docType: "tt",
    nguon: "congbao",
    soLuongKyVong: 6000,
    ghiChu: "Ước tính ke-hoach/04 §5",
  },
  // 3. Văn bản hợp nhất chính thức của những văn bản trên.
  {
    ma: "van-ban-hop-nhat",
    nhom: "vbhn",
    uuTien: 60,
    docType: "vbhn",
    nguon: "congbao",
    soLuongKyVong: 1000,
  },
  // 4. Lịch sử: văn bản hết hiệu lực từ 2005 trở lại đây.
  {
    ma: "lich-su-tu-2005",
    nhom: "lich_su",
    uuTien: 70,
    docType: "nd",
    namTu: 2005,
    chiConHieuLuc: false,
    nguon: "congbao",
    ghiChu: "Văn bản hết hiệu lực nhưng vẫn cần cho tra cứu lịch sử",
  },
  // 5. Chuyên đề ưu tiên (ke-hoach/09). Lọc theo lĩnh vực làm ở bước đối soát,
  //    vì danh mục nguồn chỉ cho lọc theo loại văn bản.
  {
    ma: "chuyen-de-dau-tu-cong-dau-thau",
    nhom: "chuyen_de",
    uuTien: 80,
    docType: "nd",
    nguon: "congbao",
    ghiChu: "Đầu tư công, đấu thầu, ngân sách — lọc theo lĩnh vực khi đối soát",
  },
  {
    ma: "chuyen-de-cntt-khcn",
    nhom: "chuyen_de",
    uuTien: 81,
    docType: "tt",
    nguon: "congbao",
    ghiChu: "CNTT/chuyển đổi số, KH&CN — lọc theo lĩnh vực khi đối soát",
  },
  // 5b. Lĩnh vực GIAO THÔNG ĐƯỜNG BỘ (đào tạo cảnh sát giao thông đường bộ): quét trọn danh mục
  //     từng loại, chỉ giữ mục có tiêu đề khớp từ khóa. Từ Luật trở xuống, lấy cả văn bản đã
  //     hết hiệu lực để tra cứu lịch sử và so sánh thời điểm.
  ...GTDB_TARGETS(),
  // 6. Địa phương: Thanh Hóa trước.
  {
    ma: "dia-phuong-thanh-hoa",
    nhom: "dia_phuong",
    uuTien: 90,
    docType: "qd-ubnd-t",
    coQuan: "UBND tỉnh Thanh Hóa",
    nguon: "vbpl",
    ghiChu: "Công báo tỉnh Thanh Hóa; mở rộng địa phương khác sau",
  },
];

/** Các ô của lĩnh vực giao thông đường bộ, theo thứ bậc văn bản (uu_tien tăng dần = nạp sau). */
function GTDB_TARGETS(): CorpusTargetSeed[] {
  const chung = {
    nhom: "gtdb",
    nguon: "congbao",
    chiConHieuLuc: false,
    tuKhoa: TU_KHOA_GTDB,
    loaiTru: LOAI_TRU_GTDB,
  };
  const loai: Array<[string, string, number, string]> = [
    [
      "gtdb-luat",
      "l",
      82,
      "Luật Đường bộ, Luật Trật tự, an toàn giao thông đường bộ, Luật GTĐB 2008, Luật XLVPHC",
    ],
    ["gtdb-phap-lenh", "pl", 83, "Pháp lệnh liên quan (nếu có)"],
    ["gtdb-nghi-dinh", "nd", 84, "Nghị định quy định chi tiết, xử phạt, vận tải, đăng ký xe, hạ tầng"],
    ["gtdb-nghi-quyet", "nq-cp", 85, "Nghị quyết của Chính phủ/Quốc hội về an toàn giao thông"],
    ["gtdb-quyet-dinh", "qd-ttg", 86, "Quyết định của Thủ tướng và bộ trưởng về giao thông đường bộ"],
    ["gtdb-thong-tu", "tt", 87, "Thông tư Bộ Công an, Bộ Xây dựng (GTVT cũ), Bộ Tài chính, Bộ Y tế"],
    ["gtdb-thong-tu-lien-tich", "ttlt", 88, "Thông tư liên tịch còn giá trị tra cứu"],
    ["gtdb-van-ban-hop-nhat", "vbhn", 89, "Văn bản hợp nhất chính thức của lĩnh vực"],
  ];
  return loai.map(([ma, docType, uuTien, ghiChu]) => ({ ma, docType, uuTien, ghiChu, ...chung }));
}

/**
 * Ô khung dùng để KIỂM CHỨNG đường ống (nguồn `fixture`, đọc file trong data/fixtures).
 * Không nạp cùng khung thật: chỉ thêm khi gọi `ensureCorpusTargets({ kiemThu: true })`.
 */
export const FIXTURE_TARGETS: CorpusTargetSeed[] = [
  {
    ma: "kiem-thu-fixture",
    nhom: "kiem_thu",
    uuTien: 999,
    docType: "nd",
    nguon: "fixture",
    soLuongKyVong: 2,
    ghiChu: "Ô khung kiểm chứng đường ống, đọc data/fixtures/*.md",
  },
];

export interface SeedResult {
  tong: number;
  them_moi: number;
}

/** Ghi khung mặc định vào `corpus_targets` (idempotent theo `ma`). */
export async function ensureCorpusTargets(opts: { kiemThu?: boolean } = {}): Promise<SeedResult> {
  const seeds = [...DEFAULT_TARGETS, ...(opts.kiemThu ? FIXTURE_TARGETS : [])];
  let themMoi = 0;
  for (const t of seeds) {
    const rows = await sql`
      INSERT INTO corpus_targets (ma, nhom, uu_tien, doc_type, co_quan, nam_tu, nam_den,
                                  chi_con_hieu_luc, nguon, so_luong_ky_vong, ghi_chu, tu_khoa, loai_tru)
      VALUES (${t.ma}, ${t.nhom}, ${t.uuTien}, ${t.docType ?? null}, ${t.coQuan ?? null},
              ${t.namTu ?? null}, ${t.namDen ?? null}, ${t.chiConHieuLuc ?? true},
              ${t.nguon ?? "congbao"}, ${t.soLuongKyVong ?? null}, ${t.ghiChu ?? null},
              ${[...(t.tuKhoa ?? [])]}::text[], ${[...(t.loaiTru ?? [])]}::text[])
      ON CONFLICT (ma) DO UPDATE SET
        nhom = EXCLUDED.nhom, uu_tien = EXCLUDED.uu_tien, doc_type = EXCLUDED.doc_type,
        co_quan = EXCLUDED.co_quan, nam_tu = EXCLUDED.nam_tu, nam_den = EXCLUDED.nam_den,
        chi_con_hieu_luc = EXCLUDED.chi_con_hieu_luc, nguon = EXCLUDED.nguon,
        so_luong_ky_vong = EXCLUDED.so_luong_ky_vong, ghi_chu = EXCLUDED.ghi_chu,
        tu_khoa = EXCLUDED.tu_khoa, loai_tru = EXCLUDED.loai_tru,
        updated_at = now()
      RETURNING (xmax = 0) AS inserted`;
    if ((rows[0] as { inserted: boolean } | undefined)?.inserted) themMoi += 1;
  }
  return { tong: seeds.length, them_moi: themMoi };
}

export interface ListTargetOptions {
  nhom?: string;
  ma?: string[];
  limit?: number;
}

/** Đọc khung theo nhóm, sắp theo ưu tiên (số nhỏ = làm trước). */
export async function listTargets(opts: ListTargetOptions = {}): Promise<CorpusTargetRow[]> {
  const rows = await sql<CorpusTargetRow[]>`
    SELECT * FROM corpus_targets
    WHERE (${opts.nhom ?? null}::text IS NULL OR nhom = ${opts.nhom ?? null})
      AND (${opts.ma ?? null}::text[] IS NULL OR ma = ANY(${opts.ma ?? null}))
    ORDER BY uu_tien ASC, ma ASC
    ${opts.limit ? sql`LIMIT ${opts.limit}` : sql``}`;
  return rows;
}

/* ------------------------------------------------------------------ */
/* Ô khung -> job discover                                             */
/* ------------------------------------------------------------------ */

/** Mã loại văn bản nội bộ -> slug danh mục của Công báo. */
export const CONGBAO_SLUG: Record<string, string> = {
  hp: "hien-phap",
  bl: "luat",
  l: "luat",
  pl: "phap-lenh",
  lenh: "lenh",
  nd: "nghi-dinh",
  "nq-cp": "nghi-quyet",
  "qd-ttg": "quyet-dinh",
  tt: "thong-tu",
  ttlt: "thong-tu-lien-tich",
  vbhn: "van-ban-hop-nhat",
};

/** Mã loại văn bản nội bộ -> mảnh slug dùng để lọc URL của vbpl.vn. */
export const VBPL_SLUG: Record<string, string> = {
  hp: "hien-phap",
  bl: "bo-luat",
  l: "luat",
  nd: "nghi-dinh",
  tt: "thong-tu",
  vbhn: "van-ban-hop-nhat",
};

/** Slug loại văn bản ở nguồn tương ứng; undefined nghĩa là không lọc theo loại. */
export function sourceTypeSlug(nguon: string, docType: string | null): string | undefined {
  if (!docType) return undefined;
  if (nguon === "congbao") return CONGBAO_SLUG[docType];
  if (nguon === "vbpl") return VBPL_SLUG[docType];
  return undefined;
}

/** Danh mục thông tư của Công báo có ~950 trang; chặn trên đủ rộng để quét trọn. */
export const MAX_PAGES_THEO_LINH_VUC = Number(process.env.BULL_DISCOVER_MAX_PAGES_LINH_VUC ?? 2000);

export interface DiscoverJobPlan {
  target: CorpusTargetRow;
  data: DiscoverJob;
  /** Khóa sinh jobId tất định — chạy lại backfill không tạo job trùng. */
  key: string;
}

/** Dựng job `discover` cho một ô khung. */
export function planDiscover(
  target: CorpusTargetRow,
  opts: { runId: string; limit?: number; page?: number },
): DiscoverJobPlan {
  const page = opts.page ?? 1;
  const loai = sourceTypeSlug(target.nguon, target.doc_type);
  const since = target.nam_tu ? `${target.nam_tu}-01-01` : undefined;
  const tuKhoa = target.tu_khoa ?? [];
  const loaiTru = target.loai_tru ?? [];
  const data: DiscoverJob = {
    runId: opts.runId,
    nguon: target.nguon,
    ...(loai ? { loai } : {}),
    ...(since ? { since } : {}),
    ...(opts.limit ? { limit: opts.limit } : {}),
    page,
    // Ô theo lĩnh vực: phải quét hết danh mục của loại đó, không dừng ở chặn trên mặc định.
    ...(tuKhoa.length ? { tuKhoa, toiDaTrang: MAX_PAGES_THEO_LINH_VUC } : {}),
    ...(loaiTru.length ? { loaiTru } : {}),
  };
  return { target, data, key: `${opts.runId}:${target.ma}:p${page}` };
}

/* ------------------------------------------------------------------ */
/* Đối soát độ phủ                                                     */
/* ------------------------------------------------------------------ */

export interface CoverageRow {
  target_ma: string;
  so_luong_co: number;
  so_luong_ky_vong: number | null;
  ty_le: number | null;
}

/**
 * Đếm số văn bản đang có trong kho khớp với một ô khung rồi ghi `corpus_coverage`.
 * Đây là câu trả lời cho "kho còn thiếu bao nhiêu", không phải "đã nạp được bao nhiêu".
 */
export async function refreshCoverage(target: CorpusTargetRow): Promise<CoverageRow> {
  const tuKhoa = target.tu_khoa ?? [];
  const loaiTru = target.loai_tru ?? [];
  const [row] = await sql`
    SELECT count(*)::int AS n FROM documents
    WHERE (${target.doc_type}::text IS NULL OR doc_type = ${target.doc_type})
      AND (${target.nam_tu}::int IS NULL OR extract(year FROM issued_date) >= ${target.nam_tu})
      AND (${target.nam_den}::int IS NULL OR extract(year FROM issued_date) <= ${target.nam_den})
      AND (${!target.chi_con_hieu_luc} OR status <> 'het_hieu_luc')
      AND (cardinality(${tuKhoa}::text[]) = 0
           OR EXISTS (SELECT 1 FROM unnest(${tuKhoa}::text[]) k WHERE title ILIKE '%' || k || '%'))
      AND NOT EXISTS (SELECT 1 FROM unnest(${loaiTru}::text[]) k WHERE title ILIKE '%' || k || '%')`;
  const soLuongCo = (row as { n: number }).n;
  const kyVong = target.so_luong_ky_vong;
  const tyLe = kyVong && kyVong > 0 ? Math.min(1, soLuongCo / kyVong) : null;
  await sql`
    INSERT INTO corpus_coverage (target_ma, so_luong_co, so_luong_ky_vong, ty_le, thieu_mau, cap_nhat_luc)
    VALUES (${target.ma}, ${soLuongCo}, ${kyVong}, ${tyLe}, ${sql.json([] as never)}, now())
    ON CONFLICT (target_ma) DO UPDATE SET
      so_luong_co = EXCLUDED.so_luong_co,
      so_luong_ky_vong = EXCLUDED.so_luong_ky_vong,
      ty_le = EXCLUDED.ty_le,
      cap_nhat_luc = now()`;
  return { target_ma: target.ma, so_luong_co: soLuongCo, so_luong_ky_vong: kyVong, ty_le: tyLe };
}
