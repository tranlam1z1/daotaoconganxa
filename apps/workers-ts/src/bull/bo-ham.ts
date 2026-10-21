/**
 * BỘ HÃM toàn tiến trình cho worker BullMQ.
 *
 * Vì sao cần: mỗi hàng đợi có concurrency riêng, nên `--concurrency 1` vẫn cho phép một tiến trình
 * chạy 13 job cùng lúc (mỗi hàng đợi một job). Mọi job của đường ống đều đọc ghi cụm Postgres
 * DÙNG CHUNG trên DigitalOcean (db-s-1vcpu-1gb, 23 CSDL của nhiều dự án). Sự cố 08/9/2026: worker
 * chạy ở máy vận hành đẩy 755 văn bản qua convert → sohoa → parse → index; bảng `nodes` nhận
 * 142.315 lượt chèn và 142.242 lượt sửa, bảng `embeddings` 112.832 lượt chèn vào chỉ mục HNSW
 * 433 MB (lớn hơn RAM của cụm) — CPU cụm CSDL lên 100%, kéo theo các ứng dụng khác dùng chung cụm.
 *
 *  - `BULL_MAX_ACTIVE`: số job chạy đồng thời tối đa của CẢ tiến trình (mọi hàng đợi cộng lại).
 *    Mặc định 2.
 *  - `BULL_CPU_DUTY`: tỷ lệ 0 < x ≤ 1. Sau một job kéo dài d giây, chỗ chạy đó nghỉ d·(1/x − 1)
 *    giây trước khi nhận job kế tiếp. x = 0,5 nghĩa là tối đa nửa thời gian có việc; x = 1 là
 *    không nghỉ (mặc định).
 */

const num = (v: string | undefined, def: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
};

export interface CauHinhBoHam {
  /** Số job chạy đồng thời tối đa trong tiến trình. */
  toiDa: number;
  /** Tỷ lệ chiếm CPU 0 < duty ≤ 1. */
  duty: number;
}

export function docCauHinhBoHam(env: NodeJS.ProcessEnv = process.env): CauHinhBoHam {
  const toiDa = Math.max(1, Math.floor(num(env.BULL_MAX_ACTIVE, 2)));
  const duty = Math.min(1, num(env.BULL_CPU_DUTY, 1));
  return { toiDa, duty };
}

/** Thời gian nghỉ sau một job kéo dài `chayMs` để tỷ lệ có việc không vượt `duty`. */
export function thoiGianNghiMs(chayMs: number, duty: number): number {
  if (duty >= 1 || chayMs <= 0) return 0;
  return Math.round(chayMs * (1 / duty - 1));
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Semaphore đơn giản: `chay(fn)` chờ tới khi có chỗ, chạy `fn`, rồi giữ chỗ thêm khoảng nghỉ
 * theo `duty` trước khi trả chỗ. Không giới hạn số người chờ — BullMQ đã giới hạn bằng
 * concurrency của từng hàng đợi.
 */
export class BoHam {
  private dangChay = 0;
  private hangCho: Array<() => void> = [];
  readonly cauHinh: CauHinhBoHam;

  constructor(cauHinh: Partial<CauHinhBoHam> = {}) {
    this.cauHinh = { ...docCauHinhBoHam(), ...cauHinh };
  }

  get soDangChay(): number {
    return this.dangChay;
  }

  get soDangCho(): number {
    return this.hangCho.length;
  }

  private async lay(): Promise<void> {
    if (this.dangChay < this.cauHinh.toiDa) {
      this.dangChay += 1;
      return;
    }
    await new Promise<void>((r) => this.hangCho.push(r));
    this.dangChay += 1;
  }

  private tra(): void {
    this.dangChay -= 1;
    const ke = this.hangCho.shift();
    if (ke) ke();
  }

  async chay<T>(fn: () => Promise<T>): Promise<T> {
    await this.lay();
    const batDau = Date.now();
    try {
      return await fn();
    } finally {
      const nghi = thoiGianNghiMs(Date.now() - batDau, this.cauHinh.duty);
      if (nghi > 0) await sleep(nghi);
      this.tra();
    }
  }
}
