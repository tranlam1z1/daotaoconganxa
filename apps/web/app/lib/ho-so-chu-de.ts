/**
 * Hồ sơ điểm mạnh, điểm yếu theo chủ đề (đọc từ API `/v1/toi/ho-so-chu-de`). Khớp với
 * `hoSoChuDe` của @qdpl/db.
 */
import { goiApiQuanTri } from "./quan-tri.server";

export interface HoSoChuDeWeb {
  manh: Array<{ topic_id: string; ten: string; attempts: number; correct: number; diem: number }>;
  yeu: Array<{ topic_id: string; ten: string; attempts: number; correct: number; diem: number }>;
  tong_luot: number;
}

export const hoSoChuDe = (token: string) => goiApiQuanTri<HoSoChuDeWeb>(token, "/v1/toi/ho-so-chu-de");
