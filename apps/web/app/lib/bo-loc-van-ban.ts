import { isIsoDate, todayIso } from "./format";

export const NHOM_VAN_BAN: Record<string, string> = {
  phap_luat: "Văn bản pháp luật",
  dang: "Văn bản Đảng",
  khac: "Tài liệu khác",
  chua_phan_loai: "Chưa phân loại",
};
export const KHOA_BO_LOC = [
  "q",
  "family",
  "docType",
  "status",
  "field",
  "issuer",
  "locality",
  "scope",
  "sort",
  "asOf",
] as const;
export type BoLocVanBan = Record<(typeof KHOA_BO_LOC)[number], string>;
export type DanhMucLoc = Record<string, Array<{ value: string; count: number; label?: string }>>;
export function docBoLoc(p: URLSearchParams): BoLocVanBan {
  return Object.fromEntries(KHOA_BO_LOC.map((k) => [k, (p.get(k) ?? "").trim()])) as BoLocVanBan;
}
export function duongTraCuu(loc: BoLocVanBan, page = 1, bo?: string): string {
  const p = new URLSearchParams();
  for (const k of KHOA_BO_LOC) if (k !== bo && loc[k]) p.set(k, loc[k]);
  if (page > 1) p.set("page", String(page));
  return `/tim-kiem${p.size ? `?${p}` : ""}`;
}
export function loiBoLoc(loc: BoLocVanBan): string | null {
  if (loc.q.length > 500) return "Từ khóa tối đa 500 ký tự.";
  if (loc.asOf && !isIsoDate(loc.asOf)) return "Ngày tra cứu không tồn tại. Hãy chọn lại ngày.";
  if (loc.sort && !["phu_hop", "moi_nhat", "thu_bac"].includes(loc.sort)) return "Cách sắp xếp không hợp lệ.";
  if (loc.family && !(loc.family in NHOM_VAN_BAN)) return "Nhóm văn bản không hợp lệ.";
  if (loc.scope && !["trung_uong", "dia_phuong"].includes(loc.scope)) return "Phạm vi không hợp lệ.";
  if (
    loc.status &&
    ![
      "chua_hieu_luc",
      "con_hieu_luc",
      "het_hieu_luc_mot_phan",
      "het_hieu_luc",
      "ngung_hieu_luc",
      "khong_xac_dinh",
    ].includes(loc.status)
  )
    return "Trạng thái không hợp lệ.";
  return null;
}
export const ngayTra = (loc: BoLocVanBan) => loc.asOf || todayIso();
export function voiNgay(href: string, asOf?: string): string {
  if (!asOf) return href;
  const url = new URL(href, "http://local");
  url.searchParams.set("asOf", asOf);
  return url.pathname + url.search + url.hash;
}
export function nguonAnToan(s?: string): string | undefined {
  if (!s) return undefined;
  try {
    const u = new URL(s);
    return ["https:", "http:"].includes(u.protocol) && !u.username && !u.password ? u.href : undefined;
  } catch {
    return undefined;
  }
}
