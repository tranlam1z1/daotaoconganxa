/**
 * Kho dữ liệu offline trên máy (IndexedDB) cho luyện tập khi mất mạng (docs/PLAN.md GĐ13).
 *
 *  - `goi`: gói câu hỏi đã tải của từng chủ đề (khóa: mã chủ đề). Gói có đáp án để chấm trên máy.
 *  - `phien`: phiên đã làm trên máy (khóa: client_id của phiên), kèm từng câu trả lời mang
 *    client_id riêng, và cờ đã đồng bộ hay chưa.
 *  - `goi_tro_choi`: gói nội dung của từng trò chơi (khóa: mã trò), GĐ-G0.
 *  - `luot_choi`: lượt chơi trên máy (khóa: client_id của lượt), GĐ-G0.
 *
 * Chỉ chạy trong trình duyệt. Mỗi thiết bị một kho riêng; đăng xuất không tự xóa kho.
 */
import { type DBSchema, type IDBPDatabase, openDB } from "idb";

import type { CauHoiNguon, CauTrongDe, TraLoiCauHoi } from "./cham";

export interface GoiOffline {
  chu_de: { id: string; code: string; name: string };
  tai_luc: string;
  cau: CauHoiNguon[];
}

export interface CauTraLoiOffline {
  client_id: string;
  question_id: string;
  question_version: number;
  tra_loi: TraLoiCauHoi;
  dung: boolean;
  giay: number | null;
}

export interface PhienOffline {
  client_id: string;
  chu_de: { id: string; code: string; name: string };
  bat_dau: string;
  ket_thuc: string | null;
  items: CauTrongDe[];
  cau_tra_loi: CauTraLoiOffline[];
  /** Thời điểm máy chủ đã nhận đủ (kể cả phần kết thúc); null là còn chờ gửi. */
  da_dong_bo: string | null;
}

/** Gói nội dung của một trò chơi (docs/PLAN.md GĐ-G0), đúng như /v1/luot-choi/goi-offline/:ma trả về. */
export interface GoiTroChoiOffline {
  goi_id: string;
  ma: string;
  ten: string;
  tai_luc: string;
  het_han: string;
  nguon: unknown[];
  /** Các màn lúc tải gói (trò có màn, GĐ-T1): chỉ chơi offline được màn đang mở. */
  man?: Array<{ so: number; ten: string; da_mo: boolean }> | null;
}

export interface BuocOffline {
  client_id: string;
  thu_tu: number;
  tra_loi: unknown;
  luc: string;
  /** Kết quả chấm trên máy, chỉ để hiện phản hồi; máy chủ chấm lại khi đồng bộ. */
  diem: number;
  diem_toi_da: number;
  dung: boolean | null;
  giai_thich: string | null;
  can_cu: string[];
  chi_tiet: unknown;
}

export interface LuotOffline {
  client_id: string;
  ma: string;
  ten: string;
  goi_id: string;
  seed: string;
  bat_dau: string;
  ket_thuc: string | null;
  /** Màn của lượt (trò có màn); máy chủ sinh lại lượt theo màn này. */
  man?: number | null;
  so_buoc: number;
  buoc: BuocOffline[];
  da_dong_bo: string | null;
  /** XP máy chủ báo khi đồng bộ xong. */
  xp: number | null;
}

interface KhoSchema extends DBSchema {
  goi: { key: string; value: GoiOffline };
  phien: { key: string; value: PhienOffline; indexes: { theo_bat_dau: string } };
  goi_tro_choi: { key: string; value: GoiTroChoiOffline };
  luot_choi: { key: string; value: LuotOffline; indexes: { theo_bat_dau: string } };
}

const TEN_KHO = "qdpl-offline";
let moKho: Promise<IDBPDatabase<KhoSchema>> | undefined;

function kho(): Promise<IDBPDatabase<KhoSchema>> {
  moKho ??= openDB<KhoSchema>(TEN_KHO, 2, {
    upgrade(db, cu) {
      if (cu < 1) {
        db.createObjectStore("goi", { keyPath: "chu_de.code" });
        db.createObjectStore("phien", { keyPath: "client_id" }).createIndex("theo_bat_dau", "bat_dau");
      }
      if (cu < 2) {
        db.createObjectStore("goi_tro_choi", { keyPath: "ma" });
        db.createObjectStore("luot_choi", { keyPath: "client_id" }).createIndex("theo_bat_dau", "bat_dau");
      }
    },
  });
  return moKho;
}

export async function luuGoi(g: GoiOffline): Promise<void> {
  await (await kho()).put("goi", g);
}

export async function layGoi(ma: string): Promise<GoiOffline | undefined> {
  return await (await kho()).get("goi", ma);
}

export async function danhSachGoi(): Promise<GoiOffline[]> {
  return await (await kho()).getAll("goi");
}

export async function xoaGoi(ma: string): Promise<void> {
  await (await kho()).delete("goi", ma);
}

export async function luuPhien(p: PhienOffline): Promise<void> {
  await (await kho()).put("phien", p);
}

export async function layPhien(clientId: string): Promise<PhienOffline | undefined> {
  return await (await kho()).get("phien", clientId);
}

/** Phiên còn phải gửi lên máy chủ: chưa đồng bộ, hoặc có câu trả lời mới sau lần gửi trước. */
export async function phienChoDongBo(): Promise<PhienOffline[]> {
  // Chỉ phiên đã nộp: trước đó người học còn sửa câu trả lời, mà máy chủ không cho sửa câu đã nhận.
  return (await (await kho()).getAll("phien")).filter(
    (p) => !p.da_dong_bo && Boolean(p.ket_thuc) && p.cau_tra_loi.length > 0,
  );
}

/** Phiên gần đây nhất lên trước, để trang hiện lịch sử làm trên máy. */
export async function phienGanDay(soPhien = 10): Promise<PhienOffline[]> {
  const ds = await (await kho()).getAllFromIndex("phien", "theo_bat_dau");
  return ds.reverse().slice(0, soPhien);
}

/* ------------------------------------------------------------------ */
/* Trò chơi (docs/PLAN.md GĐ-G0)                                       */
/* ------------------------------------------------------------------ */

export async function luuGoiTroChoi(g: GoiTroChoiOffline): Promise<void> {
  await (await kho()).put("goi_tro_choi", g);
}

export async function layGoiTroChoi(ma: string): Promise<GoiTroChoiOffline | undefined> {
  return await (await kho()).get("goi_tro_choi", ma);
}

export async function danhSachGoiTroChoi(): Promise<GoiTroChoiOffline[]> {
  return await (await kho()).getAll("goi_tro_choi");
}

export async function xoaGoiTroChoi(ma: string): Promise<void> {
  await (await kho()).delete("goi_tro_choi", ma);
}

export async function luuLuot(l: LuotOffline): Promise<void> {
  await (await kho()).put("luot_choi", l);
}

export async function layLuotOffline(clientId: string): Promise<LuotOffline | undefined> {
  return await (await kho()).get("luot_choi", clientId);
}

/** Lượt còn phải gửi: chưa đồng bộ và đã có ít nhất một bước. */
export async function luotChoDongBo(): Promise<LuotOffline[]> {
  return (await (await kho()).getAll("luot_choi")).filter((l) => !l.da_dong_bo && l.buoc.length > 0);
}

export async function luotGanDay(soLuot = 10): Promise<LuotOffline[]> {
  const ds = await (await kho()).getAllFromIndex("luot_choi", "theo_bat_dau");
  return ds.reverse().slice(0, soLuot);
}
