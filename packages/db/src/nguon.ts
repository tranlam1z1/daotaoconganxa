/**
 * Mẫu số của việc nạp kho: tổng số văn bản mỗi loại đang có Ở NGUỒN.
 *
 * Không có con số này thì mọi báo cáo chỉ nói được "đã nạp bao nhiêu", không trả lời được
 * "còn bao nhiêu" và "bao giờ xong". Số liệu do lệnh `pipeline nguon dem` đếm trực tiếp từ
 * trang danh sách của nguồn rồi ghi vào đây.
 */
import { sql } from "./client.ts";

export interface ThongKeNguonRow {
  nguon: string;
  loai: string;
  doc_type: string | null;
  tong: number;
  so_trang: number | null;
  moi_trang: number | null;
  chinh_xac: boolean;
  cap_nhat_luc: Date;
}

export async function ghiThongKeNguon(input: {
  nguon: string;
  loai: string;
  docType?: string | null;
  tong: number;
  soTrang?: number | null;
  moiTrang?: number | null;
  chinhXac?: boolean;
}): Promise<void> {
  await sql`
    INSERT INTO nguon_thong_ke (nguon, loai, doc_type, tong, so_trang, moi_trang, chinh_xac, cap_nhat_luc)
    VALUES (${input.nguon}, ${input.loai}, ${input.docType ?? null}, ${input.tong},
            ${input.soTrang ?? null}, ${input.moiTrang ?? null}, ${input.chinhXac ?? true}, now())
    ON CONFLICT (nguon, loai) DO UPDATE SET
      doc_type = EXCLUDED.doc_type,
      tong = EXCLUDED.tong,
      so_trang = EXCLUDED.so_trang,
      moi_trang = EXCLUDED.moi_trang,
      chinh_xac = EXCLUDED.chinh_xac,
      cap_nhat_luc = now()`;
}

export async function layThongKeNguon(nguon?: string): Promise<ThongKeNguonRow[]> {
  return (await sql`
    SELECT * FROM nguon_thong_ke
    WHERE (${nguon ?? null}::text IS NULL OR nguon = ${nguon ?? null})
    ORDER BY tong DESC`) as unknown as ThongKeNguonRow[];
}

export interface TienDoLoai {
  nguon: string;
  loai: string;
  docType: string | null;
  tongONguon: number;
  daCo: number;
  tyLe: number;
  capNhatLuc: Date;
}

export interface TienDoNapKho {
  /** Tổng số văn bản phải cào, cộng theo mọi loại đã đếm được ở nguồn. */
  tong: number;
  /** Số văn bản đã có trong kho thuộc các loại đó. */
  daCo: number;
  tyLe: number;
  theoLoai: TienDoLoai[];
  /** Số loại trong khung chưa đếm được mẫu số — phần chưa biết của tiến độ. */
  soLoaiChuaDem: number;
}

/**
 * Tiến độ nạp kho = số văn bản đã có / tổng ở nguồn, theo từng loại.
 * Chỉ tính những loại đã đếm được mẫu số; số loại chưa đếm được trả về riêng để báo cáo
 * không giả vờ rằng phần chưa biết là bằng không.
 */
export async function tienDoNapKho(): Promise<TienDoNapKho> {
  const rows = (await sql`
    SELECT ns.nguon, ns.loai, ns.doc_type, ns.tong, ns.cap_nhat_luc,
           coalesce((SELECT count(*)::int FROM documents d WHERE d.doc_type = ns.doc_type), 0) AS da_co
    FROM nguon_thong_ke ns
    ORDER BY ns.tong DESC`) as unknown as Array<{
    nguon: string;
    loai: string;
    doc_type: string | null;
    tong: number;
    da_co: number;
    cap_nhat_luc: Date;
  }>;
  const theoLoai: TienDoLoai[] = rows.map((r) => ({
    nguon: r.nguon,
    loai: r.loai,
    docType: r.doc_type,
    tongONguon: r.tong,
    daCo: r.da_co,
    tyLe: r.tong ? Math.min(1, r.da_co / r.tong) : 0,
    capNhatLuc: r.cap_nhat_luc,
  }));
  const tong = theoLoai.reduce((s, x) => s + x.tongONguon, 0);
  const daCo = theoLoai.reduce((s, x) => s + Math.min(x.daCo, x.tongONguon), 0);
  const [chua] = (await sql`
    SELECT count(DISTINCT ct.doc_type)::int AS n FROM corpus_targets ct
    WHERE ct.doc_type IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM nguon_thong_ke ns WHERE ns.doc_type = ct.doc_type)`) as Array<{
    n: number;
  }>;
  return {
    tong,
    daCo,
    tyLe: tong ? daCo / tong : 0,
    theoLoai,
    soLoaiChuaDem: chua?.n ?? 0,
  };
}
