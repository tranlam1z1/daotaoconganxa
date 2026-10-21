/**
 * Âm thanh trò chơi tạo bằng Web Audio API (docs/VISUAL_STYLE.md §4.1): không có tệp âm thanh, nên
 * không tốn dung lượng và có sẵn khi offline. Mỗi âm 1–3 nốt ngắn, âm lượng tối đa 30%.
 *
 * Chỉ phát khi người chơi đã bật âm thanh (mặc định tắt). Bộ âm thanh chỉ được tạo ở lần phát đầu
 * tiên, nên khi tắt âm thanh thì không có AudioContext nào được tạo.
 */
import { layCaiDatGame } from "./cai-dat";

export type TenAm =
  | "khoi_dong"
  | "dung"
  | "sai"
  | "combo"
  | "tich"
  | "het_gio"
  | "sao"
  | "hoan_thanh"
  | "len_cap"
  | "bip";

/** [tần số Hz, bắt đầu (giây), độ dài (giây)] */
type Not = [number, number, number];

const BAN_NHAC: Record<TenAm, { nots: Not[]; song: OscillatorType }> = {
  khoi_dong: {
    nots: [
      [523, 0, 0.09],
      [784, 0.08, 0.14],
    ],
    song: "triangle",
  },
  dung: {
    nots: [
      [659, 0, 0.08],
      [988, 0.07, 0.14],
    ],
    song: "triangle",
  },
  sai: { nots: [[220, 0, 0.22]], song: "square" },
  combo: {
    nots: [
      [784, 0, 0.07],
      [1047, 0.06, 0.12],
    ],
    song: "triangle",
  },
  tich: { nots: [[1200, 0, 0.04]], song: "sine" },
  het_gio: { nots: [[196, 0, 0.45]], song: "sawtooth" },
  sao: { nots: [[880, 0, 0.12]], song: "triangle" },
  hoan_thanh: {
    nots: [
      [523, 0, 0.12],
      [659, 0.1, 0.12],
      [784, 0.2, 0.3],
    ],
    song: "triangle",
  },
  len_cap: {
    nots: [
      [523, 0, 0.14],
      [659, 0.12, 0.14],
      [1047, 0.24, 0.34],
    ],
    song: "triangle",
  },
  bip: { nots: [[1568, 0, 0.07]], song: "square" },
};

const AM_LUONG = 0.3;
let ctx: AudioContext | null = null;

function layNgucCanh(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  ctx ??= new Ctx();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/**
 * Phát một âm. `caoDo` nâng tần số (combo càng dài càng cao, tối đa 1 quãng tám).
 * Không bật âm thanh, hoặc trình duyệt chặn: im lặng, không báo lỗi.
 */
export function phatAm(ten: TenAm, caoDo = 0): void {
  if (!layCaiDatGame().amThanh) return;
  const c = layNgucCanh();
  if (!c) return;
  const { nots, song } = BAN_NHAC[ten];
  const heSo = 2 ** Math.min(1, Math.max(0, caoDo) / 12);
  const t0 = c.currentTime + 0.01;
  for (const [tan, bd, dai] of nots) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = song;
    osc.frequency.value = tan * heSo;
    // Bao âm: lên nhanh, tắt dần, tránh tiếng "tách" ở đầu và cuối nốt.
    g.gain.setValueAtTime(0, t0 + bd);
    g.gain.linearRampToValueAtTime(
      AM_LUONG * (song === "square" || song === "sawtooth" ? 0.35 : 1),
      t0 + bd + 0.01,
    );
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + bd + dai);
    osc.connect(g).connect(c.destination);
    osc.start(t0 + bd);
    osc.stop(t0 + bd + dai + 0.02);
  }
}
