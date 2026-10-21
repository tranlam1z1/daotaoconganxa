/**
 * Bộ kiểm dạng hồ sơ của trò "Duyệt hồ sơ phạt nguội" (docs/PLAN.md GĐ-T11). Chỉ máy chủ dùng: khi nạp
 * hồ sơ mẫu, khi lấy nguồn cho lượt chơi và gói offline. Tách khỏi tro-choi/duyet-phat-nguoi.ts để mã
 * tải xuống điện thoại gọn (ngân sách mã riêng của trò, GAME_DESIGN §1.4).
 */
import { CHO_THIEU_PHAT_NGUOI, type ChoThieuPhatNguoi, laNgay } from "./chung/giay-to.ts";
import {
  CANH_ANH,
  CHE_ANH,
  CHO_THIEU_TOI_DA,
  choThieuCuaMan,
  HANH_VI_PHAT_NGUOI,
  LOAI_THIET_BI,
  MAN_HAI_CHO_THIEU,
  manCuaChoThieu,
  type PayloadPhatNguoi,
  SO_MAN_PHAT_NGUOI,
  TEN_CHO_THIEU,
} from "./duyet-phat-nguoi.ts";

const THOI_DIEM_RE = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
const GIO_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const laThoiDiem = (s: unknown): s is string =>
  typeof s === "string" && THOI_DIEM_RE.test(s) && laNgay(s.slice(0, 10));

const chuoi = (v: unknown, min = 1) => typeof v === "string" && v.trim().length >= min;
const laBool = (v: unknown) => v === undefined || typeof v === "boolean";

/** Kiểm dạng một hồ sơ và danh sách chỗ thiếu dự kiến. Trả danh sách lỗi; rỗng là hợp lệ. */
export function kiemTraHoSoPhatNguoi(
  p: Partial<PayloadPhatNguoi> | null | undefined,
  choThieu: unknown,
): string[] {
  if (!p || typeof p !== "object") return ["Thiếu hồ sơ."];
  const loi: string[] = [];
  if (!Number.isInteger(p.muc) || (p.muc ?? 0) < 1 || (p.muc ?? 0) > SO_MAN_PHAT_NGUOI)
    loi.push(`Màn của hồ sơ (muc) phải từ 1 đến ${SO_MAN_PHAT_NGUOI}.`);
  if (p.loai_xe !== "o_to" && p.loai_xe !== "mo_to") loi.push("Loại xe phải là o_to hoặc mo_to.");
  if (!chuoi(p.bien_so, 7) || !/^[0-9A-Z.\- ]+$/.test(p.bien_so ?? "")) loi.push("Biển số không hợp lệ.");
  else if (
    !Array.isArray(p.ky_tu_mo) ||
    p.ky_tu_mo.some((i) => !Number.isInteger(i) || !/[0-9A-Z]/.test(p.bien_so![i] ?? ""))
  )
    loi.push("Vị trí ký tự mờ (ky_tu_mo) phải trỏ vào chữ hoặc số của biển số.");
  if (!chuoi(p.bien_so_he_thong, 3)) loi.push("Thiếu biển số hệ thống nhận dạng.");
  if (p.thoi_diem !== null && !laThoiDiem(p.thoi_diem))
    loi.push("Thời điểm phải có dạng YYYY-MM-DDTHH:mm:ss hoặc null.");
  if (!chuoi(p.vi_tri, 5)) loi.push("Thiếu vị trí.");
  const t = p.thiet_bi;
  if (
    !t ||
    !(LOAI_THIET_BI as readonly string[]).includes(t.loai) ||
    !chuoi(t.ma, 3) ||
    !laNgay(t.han_kiem_dinh)
  )
    loi.push("Thiết bị cần loại, mã và hạn kiểm định (YYYY-MM-DD).");
  const d = p.de_xuat;
  if (!d || !(HANH_VI_PHAT_NGUOI as readonly string[]).includes(d.hanh_vi))
    loi.push("Hành vi đề xuất không hợp lệ.");
  else if (d.ma_muc_phat !== null && !chuoi(d.ma_muc_phat, 2))
    loi.push("Mã mức phạt phải là chuỗi hoặc null.");
  const v = p.do_toc_do;
  if (v !== undefined && !(Number.isInteger(v?.do_duoc) && Number.isInteger(v?.gioi_han) && v!.gioi_han > 0))
    loi.push("Số đo tốc độ cần tốc độ đo được và giới hạn (km/h, số nguyên).");
  if (t?.loai === "toc_do" && !v) loi.push("Thiết bị đo tốc độ phải có số đo tốc độ.");
  const a = p.anh;
  if (!a || !(CANH_ANH as readonly string[]).includes(a.canh)) loi.push("Cảnh của ảnh không hợp lệ.");
  else {
    if (!Number.isInteger(a.do_mo) || a.do_mo < 0 || a.do_mo > 3) loi.push("Độ mờ của ảnh phải từ 0 đến 3.");
    if (typeof a.toi !== "boolean") loi.push("Ảnh cần cờ tối (toi).");
    if (!(CHE_ANH as readonly string[]).includes(a.che)) loi.push("Che khuất của ảnh không hợp lệ.");
    if (a.den !== undefined && !["do", "vang", "xanh"].includes(a.den)) loi.push("Màu đèn không hợp lệ.");
    if (a.canh === "giao_lo" && (a.den === undefined || typeof a.qua_vach !== "boolean"))
      loi.push("Cảnh giao lộ cần màu đèn và cờ qua vạch.");
    if (a.canh === "duong_lan" && a.lan !== "o_to" && a.lan !== "xe_may")
      loi.push("Cảnh làn đường cần làn xe.");
    if (a.canh === "loi_vao_cam" && typeof a.vao_duong_cam !== "boolean")
      loi.push("Cảnh lối vào đường cấm cần cờ đã vào.");
    if (![a.qua_vach, a.mu, a.vao_duong_cam].every(laBool)) loi.push("Cờ của ảnh phải là true hoặc false.");
    if (a.mu !== undefined && p.loai_xe !== "mo_to") loi.push("Chỉ xe mô tô có cờ mũ bảo hiểm.");
    if (
      a.khung_gio &&
      !(GIO_RE.test(a.khung_gio.tu) && GIO_RE.test(a.khung_gio.den) && a.khung_gio.tu < a.khung_gio.den)
    )
      loi.push('Khung giờ cấm cần "tu" trước "den", dạng HH:mm.');
  }
  if (
    !Array.isArray(choThieu) ||
    choThieu.some((c) => !(CHO_THIEU_PHAT_NGUOI as readonly string[]).includes(c as string)) ||
    new Set(choThieu).size !== choThieu.length
  )
    loi.push("Danh sách chỗ thiếu dự kiến có mã không hợp lệ hoặc trùng.");
  else {
    if (choThieu.length > CHO_THIEU_TOI_DA) loi.push(`Mỗi hồ sơ thiếu nhiều nhất ${CHO_THIEU_TOI_DA} chỗ.`);
    if (choThieu.length > 1 && (p.muc ?? 0) < MAN_HAI_CHO_THIEU)
      loi.push(`Hồ sơ thiếu hai chỗ chỉ có từ màn ${MAN_HAI_CHO_THIEU}.`);
    if (Number.isInteger(p.muc)) {
      const cho = choThieuCuaMan(p.muc!);
      for (const c of choThieu as ChoThieuPhatNguoi[])
        if (!cho.has(c))
          loi.push(
            `Chỗ thiếu "${TEN_CHO_THIEU[c]}" chỉ có từ màn ${manCuaChoThieu(c)}, hồ sơ ở màn ${p.muc}.`,
          );
    }
  }
  return loi;
}
