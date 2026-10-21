/**
 * Ôn tập giãn cách theo SM-2 rút gọn (ke-hoach/09-a §6.4).
 *
 * Ràng buộc riêng của lĩnh vực pháp lý: khi văn bản căn cứ của một thẻ thay đổi, thẻ bị TREO
 * ngay và chỉ quay lại lịch sau khi biên tập cập nhật. Một hệ ôn tập thông thường sẽ vui vẻ
 * nhồi vào đầu người học một quy định đã hết hiệu lực — ở đây thì không được phép.
 */

export type ChatLuongNho = 0 | 1 | 2 | 3 | 4 | 5;

export interface TheOn {
  intervalDays: number;
  ease: number;
  reps: number;
  lapses: number;
  dueOn: string;
  suspended: boolean;
}

/** Các mốc cách quãng cố định cho ba lần đầu; từ lần 4 nhân theo hệ số dễ. */
const MOC_DAU = [1, 3, 7];
export const EASE_MIN = 1.3;
export const EASE_MAX = 2.5;

export function ngayHomNay(): string {
  return new Date().toISOString().slice(0, 10);
}

export function congNgay(ngay: string, so: number): string {
  const d = new Date(`${ngay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + so);
  return d.toISOString().slice(0, 10);
}

export function theMoi(homNay = ngayHomNay()): TheOn {
  return { intervalDays: 0, ease: 2.5, reps: 0, lapses: 0, dueOn: homNay, suspended: false };
}

/**
 * Cập nhật một thẻ sau khi ôn.
 *
 * `chatLuong` 0–5 như SM-2: dưới 3 là quên, thẻ quay về đầu. Giao diện chỉ hiện ba nút
 * ("quên" = 1, "khó" = 3, "dễ" = 5) — năm mức lựa chọn là quá nhiều cho một phiên 5 phút.
 */
export function onThe(the: TheOn, chatLuong: ChatLuongNho, homNay = ngayHomNay()): TheOn {
  const quen = chatLuong < 3;

  // Hệ số dễ theo công thức SM-2, chặn trong [1,3; 2,5].
  const easeMoi = Math.min(
    EASE_MAX,
    Math.max(EASE_MIN, the.ease + (0.1 - (5 - chatLuong) * (0.08 + (5 - chatLuong) * 0.02))),
  );

  if (quen) {
    return {
      intervalDays: 1,
      ease: easeMoi,
      reps: 0,
      lapses: the.lapses + 1,
      dueOn: congNgay(homNay, 1),
      suspended: false,
    };
  }

  const reps = the.reps + 1;
  const khoang =
    reps <= MOC_DAU.length
      ? MOC_DAU[reps - 1]!
      : Math.min(365, Math.round(Math.max(the.intervalDays, 1) * easeMoi));

  return {
    intervalDays: khoang,
    ease: easeMoi,
    reps,
    lapses: the.lapses,
    dueOn: congNgay(homNay, khoang),
    suspended: false,
  };
}

/**
 * Treo thẻ vì văn bản căn cứ đã đổi. Giữ nguyên tiến trình ôn để khi biên tập cập nhật xong
 * người học không phải học lại từ đầu.
 */
export function treoThe(the: TheOn): TheOn {
  return { ...the, suspended: true };
}

export function boTreo(the: TheOn, homNay = ngayHomNay()): TheOn {
  // Nội dung đã đổi thì phải gặp lại sớm, dù lịch cũ còn xa.
  return { ...the, suspended: false, dueOn: homNay, intervalDays: Math.min(the.intervalDays, 1) };
}

export function denHan(the: TheOn, homNay = ngayHomNay()): boolean {
  return !the.suspended && the.dueOn <= homNay;
}

/**
 * Chọn thẻ cho phiên ôn hôm nay. Ưu tiên thẻ quá hạn lâu nhất, rồi tới thẻ hay quên
 * (`lapses` cao) — thẻ khó phải được gặp trước khi hết thời gian của phiên 5 phút.
 */
export function chonPhienOn<T extends TheOn>(the: T[], soLuong = 20, homNay = ngayHomNay()): T[] {
  return the
    .filter((t) => denHan(t, homNay))
    .sort((a, b) => (a.dueOn === b.dueOn ? b.lapses - a.lapses : a.dueOn < b.dueOn ? -1 : 1))
    .slice(0, soLuong);
}
