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

interface NutCay {
  id: string;
  parent_id: string | null;
  name: string;
  loai: LoaiDonVi;
}

/**
 * Id các đơn vị cần hiện khi lọc: đơn vị khớp từ khóa và loại, cộng mọi cấp trên của chúng để cây
 * vẫn liền. Trả null khi không có bộ lọc nào.
 */
export function locCay(ds: NutCay[], q: string, loai: LoaiDonVi | ""): Set<string> | null {
  const tu = khoaTimDonVi(q).split(" ").filter(Boolean);
  if (!tu.length && !loai) return null;
  const theoId = new Map(ds.map((d) => [d.id, d]));
  const hien = new Set<string>();
  for (const d of ds) {
    if (loai && d.loai !== loai) continue;
    const ten = khoaTimDonVi(d.name);
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

/** Đơn vị hiện được khi không có cấp trên nào nằm trong `dangThu` (nhánh đang thu gọn). */
export function canHien(ds: Pick<NutCay, "id" | "parent_id">[], id: string, dangThu: Set<string>): boolean {
  const theoId = new Map(ds.map((d) => [d.id, d]));
  for (let cha = theoId.get(id)?.parent_id; cha; cha = theoId.get(cha)?.parent_id) {
    if (dangThu.has(cha)) return false;
  }
  return true;
}
