/**
 * Tìm và lọc cây đơn vị phía giao diện: ô chọn đơn vị (ChonDonVi) và trang /quan-tri/don-vi.
 * Danh sách loại là bản sao của LOAI_DON_VI trong @qdpl/db; CHECK của bảng `units` và zod ở API
 * là nơi kiểm, tệp này chỉ để hiển thị.
 */

export type LoaiDonVi =
  | "xa"
  | "co_quan_hanh_chinh"
  | "don_vi_su_nghiep"
  | "to_chuc_dang"
  | "doan_the"
  | "khac";

export const NHAN_LOAI: Record<LoaiDonVi, string> = {
  xa: "Xã, phường",
  co_quan_hanh_chinh: "Cơ quan hành chính",
  don_vi_su_nghiep: "Đơn vị sự nghiệp",
  to_chuc_dang: "Tổ chức Đảng",
  doan_the: "Đoàn thể",
  khac: "Khác",
};

export const DS_LOAI = Object.keys(NHAN_LOAI) as LoaiDonVi[];

/** Khóa so khớp: bỏ dấu, `đ` thành `d`, chữ thường, gộp khoảng trắng. */
export function khoaTimDonVi(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Đơn vị có tên hoặc đường dẫn cấp trên chứa mọi từ của `q`. Tên bắt đầu bằng `q` xếp trước, còn
 * lại giữ thứ tự cây. `q` rỗng trả `gioiHan` mục đầu.
 */
export function timDonVi<T extends { ten: string; duong: string }>(ds: T[], q: string, gioiHan = 50): T[] {
  const khoa = khoaTimDonVi(q);
  if (!khoa) return ds.slice(0, gioiHan);
  const tu = khoa.split(" ");
  const khop = ds
    .map((d, i) => ({ d, i, ten: khoaTimDonVi(d.ten), duong: khoaTimDonVi(d.duong) }))
    .filter((x) => tu.every((t) => x.ten.includes(t) || x.duong.includes(t)));
  khop.sort((a, b) => Number(b.ten.startsWith(khoa)) - Number(a.ten.startsWith(khoa)) || a.i - b.i);
  return khop.slice(0, gioiHan).map((x) => x.d);
}

/**
 * Các dòng của ô chọn: kết quả `timDonVi` cắt ở `gioiHan`, và `conLai` là số mục khớp bị cắt.
 * Chưa gõ gì thì đơn vị đang chọn luôn có mặt (đứng đầu nếu nằm ngoài giới hạn), để mở danh sách
 * vẫn thấy và đánh dấu được nó.
 */
export function ketQuaChon<T extends { id: string; ten: string; duong: string }>(
  ds: T[],
  q: string,
  chon: string,
  gioiHan = 50,
): { muc: T[]; conLai: number } {
  const khop = timDonVi(ds, q, Number.POSITIVE_INFINITY);
  const muc = khop.slice(0, gioiHan);
  const dangChon =
    !khoaTimDonVi(q) && chon && !muc.some((d) => d.id === chon) ? khop.find((d) => d.id === chon) : undefined;
  return dangChon
    ? { muc: [dangChon, ...muc], conLai: khop.length - muc.length - 1 }
    : { muc, conLai: khop.length - muc.length };
}

interface NutCay {
  id: string;
  parent_id: string | null;
  name: string;
  loai: LoaiDonVi;
  /** Mã đơn vị và mã xã: có thì tìm được theo chúng (trang quản trị). */
  code?: string;
  ma_hanh_chinh?: string | null;
}

/**
 * Id các đơn vị cần hiện khi lọc: đơn vị khớp từ khóa (tên, mã đơn vị, mã xã) và loại, cộng mọi
 * cấp trên của chúng để cây vẫn liền. Trả null khi không có bộ lọc nào.
 */
export function locCay(ds: NutCay[], q: string, loai: LoaiDonVi | ""): Set<string> | null {
  const tu = khoaTimDonVi(q).split(" ").filter(Boolean);
  if (!tu.length && !loai) return null;
  const theoId = new Map(ds.map((d) => [d.id, d]));
  const hien = new Set<string>();
  for (const d of ds) {
    if (loai && d.loai !== loai) continue;
    const ten = khoaTimDonVi([d.name, d.code ?? "", d.ma_hanh_chinh ?? ""].join(" "));
    if (!tu.every((t) => ten.includes(t))) continue;
    for (
      let n: NutCay | undefined = d;
      n && !hien.has(n.id);
      n = n.parent_id ? theoId.get(n.parent_id) : undefined
    ) {
      hien.add(n.id);
    }
  }
  return hien;
}

/**
 * Các đơn vị hiện được khi thu gọn các nhánh trong `dangThu`: bỏ mọi con cháu của chúng, giữ thứ tự.
 * Dựng bảng tra một lần và nhớ kết quả từng nút, nên chạy tuyến tính theo số đơn vị.
 */
export function locTheoThu<T extends Pick<NutCay, "id" | "parent_id">>(ds: T[], dangThu: Set<string>): T[] {
  const theoId = new Map(ds.map((d) => [d.id, d]));
  const an = new Map<string, boolean>();
  const biAn = (id: string): boolean => {
    const daBiet = an.get(id);
    if (daBiet !== undefined) return daBiet;
    const cha = theoId.get(id)?.parent_id;
    const kq = cha ? dangThu.has(cha) || biAn(cha) : false;
    an.set(id, kq);
    return kq;
  };
  return ds.filter((d) => !biAn(d.id));
}

/** Một mục của ô chọn đơn vị: `duong` là tên các cấp trên nối bằng " › ". */
export interface MucDonVi {
  id: string;
  ten: string;
  cap: number;
  loai: LoaiDonVi;
  duong: string;
}

/** Chuyển danh sách đơn vị của API quản trị (theo thứ tự cây) sang mục của ô chọn. */
export function thanhMucDonVi(ds: Array<NutCay & { cap: number }>): MucDonVi[] {
  const theoId = new Map(ds.map((d) => [d.id, d]));
  const duong = (id: string | null): string[] => {
    const d = id ? theoId.get(id) : undefined;
    return d ? [...duong(d.parent_id), d.name] : [];
  };
  return ds.map((d) => ({
    id: d.id,
    ten: d.name,
    cap: d.cap,
    loai: d.loai,
    duong: duong(d.parent_id).join(" › "),
  }));
}

/**
 * Danh sách cho ô chọn: lọc theo loại (nếu có), và giữ giá trị đang gắn kể cả khi đơn vị đó đã
 * ngừng dùng hoặc đổi loại, để lưu biểu mẫu không âm thầm xóa nó. Mục giữ lại đứng đầu, ghi "(ngừng dùng)".
 */
export function dsChon(
  items: MucDonVi[],
  chiLoai: LoaiDonVi | undefined,
  dangGan: { id: string; ten: string } | null | undefined,
): MucDonVi[] {
  const ds = chiLoai ? items.filter((d) => d.loai === chiLoai) : items;
  if (!dangGan || ds.some((d) => d.id === dangGan.id)) return ds;
  const giuLai: MucDonVi = {
    id: dangGan.id,
    ten: `${dangGan.ten} (ngừng dùng)`,
    cap: 1,
    loai: chiLoai ?? "khac",
    duong: "",
  };
  return [giuLai, ...ds];
}
