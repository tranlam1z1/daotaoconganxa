/**
 * Hồ sơ điểm mạnh, điểm yếu theo chủ đề (docs/GAME_DESIGN.md §6.2).
 *
 * Mỗi câu trả lời có chủ đề (luyện tập, thi, trò chơi) cập nhật một dòng (người, chủ đề):
 * số lượt, số lần đúng, và trung bình trượt `score_ema` nghiêng về các lần gần đây. Hàm thuần,
 * để tính lại được toàn bộ hồ sơ từ lịch sử khi đổi công thức.
 */

/** Trọng số của lần trả lời mới nhất trong trung bình trượt. */
export const HE_SO_EMA = 0.2;
/** Chủ đề có ít hơn số lượt này chưa được xếp mạnh/yếu (gộp lên chủ đề cha nếu có). */
export const SO_LUOT_TOI_THIEU_HO_SO = 5;
/** Ngưỡng tách mạnh và yếu: chủ đề đúng ổn định từ 70% trở lên không bị gọi là yếu. */
export const NGUONG_MANH = 0.7;
export const SO_CHU_DE_HIEN = 3;

export interface ThongKeChuDe {
  attempts: number;
  correct: number;
  score_ema: number;
}

/** Cập nhật thống kê một chủ đề sau một câu trả lời. Lần đầu tiên thì trung bình bằng chính kết quả. */
export function capNhatHoSo(cu: ThongKeChuDe | null, dung: boolean): ThongKeChuDe {
  const x = dung ? 1 : 0;
  if (!cu || cu.attempts <= 0) return { attempts: 1, correct: x, score_ema: x };
  return {
    attempts: cu.attempts + 1,
    correct: cu.correct + x,
    score_ema: Math.round(((1 - HE_SO_EMA) * cu.score_ema + HE_SO_EMA * x) * 100_000) / 100_000,
  };
}

export interface DongHoSo extends ThongKeChuDe {
  topic_id: string;
  ten: string;
  parent_id: string | null;
}

export interface ChuDeHoSo {
  topic_id: string;
  ten: string;
  attempts: number;
  correct: number;
  /** Trung bình trượt, 0–1. */
  diem: number;
}

/**
 * Gộp chủ đề con chưa đủ lượt lên chủ đề cha (từ tầng sâu nhất lên), rồi chia mạnh/yếu:
 * mạnh là chủ đề đủ lượt có điểm từ NGUONG_MANH trở lên (cao nhất trước), yếu là chủ đề đủ lượt
 * dưới ngưỡng (thấp nhất trước). Mỗi phía tối đa `soChuDe` chủ đề.
 *
 * `cay` là mọi chủ đề (kể cả chủ đề chưa có lượt nào), để gộp được lên chủ đề cha chưa có dòng.
 */
export function manhYeu(
  ds: readonly DongHoSo[],
  cay: ReadonlyArray<{ topic_id: string; ten: string; parent_id: string | null }> = [],
  soChuDe = SO_CHU_DE_HIEN,
): { manh: ChuDeHoSo[]; yeu: ChuDeHoSo[] } {
  const nut = new Map<string, DongHoSo>();
  for (const t of cay) nut.set(t.topic_id, { ...t, attempts: 0, correct: 0, score_ema: 0 });
  for (const d of ds) nut.set(d.topic_id, { ...d });

  const doSau = (id: string): number => {
    let n = 0;
    let p = nut.get(id)?.parent_id ?? null;
    const daQua = new Set<string>([id]);
    while (p && nut.has(p) && !daQua.has(p)) {
      daQua.add(p);
      n++;
      p = nut.get(p)!.parent_id;
    }
    return n;
  };

  const thuTu = [...nut.keys()].sort((a, b) => doSau(b) - doSau(a));
  for (const id of thuTu) {
    const n = nut.get(id)!;
    if (n.attempts === 0 || n.attempts >= SO_LUOT_TOI_THIEU_HO_SO) continue;
    const cha = n.parent_id ? nut.get(n.parent_id) : undefined;
    if (!cha) continue;
    const tong = cha.attempts + n.attempts;
    cha.score_ema = (cha.score_ema * cha.attempts + n.score_ema * n.attempts) / tong;
    cha.attempts = tong;
    cha.correct += n.correct;
    nut.delete(id);
  }

  const du = [...nut.values()]
    .filter((n) => n.attempts >= SO_LUOT_TOI_THIEU_HO_SO)
    .map((n) => ({
      topic_id: n.topic_id,
      ten: n.ten,
      attempts: n.attempts,
      correct: n.correct,
      diem: Math.round(n.score_ema * 1000) / 1000,
    }));
  const theoTen = (a: ChuDeHoSo, b: ChuDeHoSo) => a.ten.localeCompare(b.ten, "vi");
  return {
    manh: du
      .filter((c) => c.diem >= NGUONG_MANH)
      .sort((a, b) => b.diem - a.diem || theoTen(a, b))
      .slice(0, soChuDe),
    yeu: du
      .filter((c) => c.diem < NGUONG_MANH)
      .sort((a, b) => a.diem - b.diem || theoTen(a, b))
      .slice(0, soChuDe),
  };
}
