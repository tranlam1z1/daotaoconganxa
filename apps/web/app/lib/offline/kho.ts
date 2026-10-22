/**
 * Kho dữ liệu offline trên máy (IndexedDB) cho luyện tập khi mất mạng (docs/PLAN.md GĐ13).
 *
 *  - `goi`: gói câu hỏi đã tải của từng chủ đề (khóa: mã chủ đề). Gói có đáp án để chấm trên máy.
 *  - `phien`: phiên đã làm trên máy (khóa: client_id của phiên), kèm từng câu trả lời mang
 *    client_id riêng, và cờ đã đồng bộ hay chưa.
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

interface KhoSchema extends DBSchema {
  goi: { key: string; value: GoiOffline };
  phien: { key: string; value: PhienOffline; indexes: { theo_bat_dau: string } };
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
