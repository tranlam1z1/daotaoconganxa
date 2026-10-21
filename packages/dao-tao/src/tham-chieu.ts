/**
 * Tham chiếu của nội dung trò chơi tới nội dung khác (docs/GAME_DESIGN.md §3.2).
 *
 * Một tình huống trò chơi không chép lại mức phạt, biển báo hay câu hỏi: nó trỏ tới chúng bằng mã.
 * Lúc duyệt, phiên bản của từng mục được trỏ tới được ghi lại. Trò chơi chỉ dùng tình huống mà MỌI
 * mục được trỏ tới đang ở trạng thái đã duyệt và vẫn đúng phiên bản đã ghi; mục đó bị sửa hoặc gỡ
 * duyệt thì tình huống tự rút khỏi trò chơi cho tới khi được duyệt lại.
 */

export const LOAI_THAM_CHIEU = ["question", "violation", "traffic_sign", "procedure", "speed_limit"] as const;
export type LoaiThamChieu = (typeof LOAI_THAM_CHIEU)[number];

export const TEN_LOAI_THAM_CHIEU: Record<LoaiThamChieu, string> = {
  question: "câu hỏi",
  violation: "mức phạt",
  traffic_sign: "biển báo",
  procedure: "quy trình",
  speed_limit: "tốc độ tối đa",
};

/** Tham chiếu đã ghi phiên bản (lưu trong game_content.refs). */
export interface ThamChieu {
  loai: LoaiThamChieu;
  ma: string;
  version: number;
}

/** Trạng thái hiện tại của một mục được trỏ tới. `status` theo tên trong bảng của mục đó. */
export interface TrangThaiMuc {
  status: string;
  version: number;
}

const hoa = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const khoaThamChieu = (loai: string, ma: string) => `${loai}:${ma}`;

function tenMuc(loai: LoaiThamChieu, ma: string): string {
  return `${TEN_LOAI_THAM_CHIEU[loai] ?? loai} ${ma}`;
}

/**
 * Kiểm các tham chiếu đã ghi phiên bản so với trạng thái hiện tại. Trả danh sách lý do không
 * dùng được (rỗng là dùng được).
 */
export function kiemTraThamChieu(
  refs: readonly ThamChieu[],
  hienTai: ReadonlyMap<string, TrangThaiMuc>,
): string[] {
  const lyDo: string[] = [];
  for (const r of refs) {
    const m = hienTai.get(khoaThamChieu(r.loai, r.ma));
    const ten = tenMuc(r.loai, r.ma);
    if (!m) lyDo.push(`Không còn ${ten}.`);
    else if (m.status !== "da_duyet") lyDo.push(`${hoa(ten)} không còn ở trạng thái đã duyệt.`);
    else if (m.version !== r.version)
      lyDo.push(
        `${hoa(ten)} đã được sửa (phiên bản ${r.version} thành ${m.version}), cần duyệt lại tình huống.`,
      );
  }
  return lyDo;
}

/**
 * Ghi phiên bản cho tham chiếu lúc duyệt. Mục chưa duyệt hoặc không tồn tại thì báo lỗi: không
 * duyệt được tình huống trỏ tới nội dung chưa duyệt.
 */
export function ghiPhienBanThamChieu(
  refs: ReadonlyArray<{ loai: LoaiThamChieu; ma: string }>,
  hienTai: ReadonlyMap<string, TrangThaiMuc>,
): { refs: ThamChieu[]; loi: string[] } {
  const loi: string[] = [];
  const kq: ThamChieu[] = [];
  const daGap = new Set<string>();
  for (const r of refs) {
    const k = khoaThamChieu(r.loai, r.ma);
    if (daGap.has(k)) continue;
    daGap.add(k);
    const m = hienTai.get(k);
    if (!m) loi.push(`Không có ${tenMuc(r.loai, r.ma)}.`);
    else if (m.status !== "da_duyet") loi.push(`${hoa(tenMuc(r.loai, r.ma))} chưa được duyệt.`);
    else kq.push({ loai: r.loai, ma: r.ma, version: m.version });
  }
  return { refs: kq, loi };
}

/**
 * Đọc tham chiếu từ dòng chữ biên tập viên nhập, mỗi dòng "loai:ma" (ví dụ "violation:oto-toc-do-5-10").
 * Trả các tham chiếu hợp lệ và lỗi theo dòng.
 */
export function docThamChieu(dong: readonly string[]): {
  refs: Array<{ loai: LoaiThamChieu; ma: string }>;
  loi: string[];
} {
  const refs: Array<{ loai: LoaiThamChieu; ma: string }> = [];
  const loi: string[] = [];
  for (const [i, raw] of dong.entries()) {
    const s = raw.trim();
    if (!s) continue;
    const vt = s.indexOf(":");
    const loai = s.slice(0, vt) as LoaiThamChieu;
    const ma = s.slice(vt + 1).trim();
    if (vt <= 0 || !ma || !(LOAI_THAM_CHIEU as readonly string[]).includes(loai)) {
      loi.push(`Dòng ${i + 1}: "${s}" không đúng dạng loai:ma (loai là ${LOAI_THAM_CHIEU.join(", ")}).`);
    } else refs.push({ loai, ma });
  }
  return { refs, loi };
}
