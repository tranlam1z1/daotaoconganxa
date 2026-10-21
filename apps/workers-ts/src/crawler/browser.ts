/**
 * Phiên trình duyệt thật (Puppeteer + Chromium) cho những nguồn chặn client không phải trình duyệt.
 *
 * Vì sao cần: vbpl.vn đặt sau tường lửa ứng dụng có thử thách JavaScript. Mọi yêu cầu HTTP
 * thông thường — kể cả khi đặt User-Agent trình duyệt — đều nhận 403 kèm trang "you have been
 * blocked" (đã kiểm chứng ngày 06/9/2026, kể cả /robots.txt và /sitemap.xml). Chỉ trình duyệt
 * thật chạy được JavaScript của thử thách mới vào được.
 *
 * Cách dùng đúng đắn:
 *  - Mở trình duyệt MỘT LẦN, vượt thử thách, lấy cookie, rồi tái sử dụng cookie đó cho các
 *    yêu cầu sau. Không mở trình duyệt cho từng trang.
 *  - Giữ nhịp chậm (mặc định 1 yêu cầu / 2 giây) vì đây là hạ tầng công của cơ quan nhà nước.
 *  - Chỉ đọc nội dung công khai mà người dùng bình thường xem được: văn bản quy phạm pháp luật
 *    không thuộc phạm vi bảo hộ quyền tác giả (Điều 15 Luật Sở hữu trí tuệ) và Nghị định
 *    52/2015/NĐ-CP quy định tổ chức, cá nhân được khai thác, sử dụng.
 */
import type { Browser, Page } from "puppeteer-core";
import { log } from "../log.ts";

const DEFAULT_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

export interface BrowserSessionOptions {
  /** Đường dẫn tới Chromium. Mặc định dò trong cache của Playwright rồi tới Chrome hệ thống. */
  executablePath?: string;
  userAgent?: string;
  /** Khoảng nghỉ tối thiểu giữa hai lần tải trang, mili giây. */
  minIntervalMs?: number;
  /** Trang dùng để vượt thử thách (thường là trang chủ của nguồn). */
  warmupUrl: string;
  /** Thời gian chờ sau khi mở trang vượt thử thách. */
  warmupWaitMs?: number;
  headless?: boolean;
}

/** Dò đường dẫn Chromium khả dụng trên máy. */
export function findChromium(): string | undefined {
  const home = process.env.HOME ?? "";
  const candidates = [
    process.env.CHROMIUM_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    ...[
      `${home}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`,
      `${home}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`,
      `${home}/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`,
    ],
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    try {
      if (Bun.file(p).size > 0) return p;
    } catch {
      // bỏ qua, thử ứng viên tiếp theo
    }
  }
  return undefined;
}

export class BrowserUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrowserUnavailableError";
  }
}

export class BrowserSession {
  private browser?: Browser;
  private page?: Page;
  private lastFetch = 0;
  private warmedUp = false;
  private readonly opts: Required<Omit<BrowserSessionOptions, "executablePath">> & {
    executablePath?: string;
  };

  constructor(opts: BrowserSessionOptions) {
    this.opts = {
      userAgent: opts.userAgent ?? DEFAULT_UA,
      minIntervalMs: opts.minIntervalMs ?? 2000,
      warmupUrl: opts.warmupUrl,
      warmupWaitMs: opts.warmupWaitMs ?? 5000,
      headless: opts.headless ?? true,
      executablePath: opts.executablePath ?? findChromium(),
    };
  }

  private async launch(): Promise<void> {
    if (this.browser) return;
    const exe = this.opts.executablePath;
    if (!exe) {
      throw new BrowserUnavailableError(
        "Không tìm thấy Chromium. Cài bằng: bunx playwright install chromium, " +
          "hoặc đặt biến môi trường CHROMIUM_PATH.",
      );
    }
    const puppeteer = (await import("puppeteer-core")).default;
    this.browser = await puppeteer.launch({
      executablePath: exe,
      headless: this.opts.headless,
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        // Ẩn cờ tự động hóa: trình duyệt điều khiển bằng chương trình vẫn là trình duyệt thật,
        // nhưng cờ này khiến tường lửa từ chối trước cả khi chạy thử thách.
        "--disable-blink-features=AutomationControlled",
        "--lang=vi-VN",
        "--accept-lang=vi-VN,vi;q=0.9,en;q=0.8",
        `--user-agent=${this.opts.userAgent}`,
      ],
    });
    this.page = await this.browser.newPage();
    await this.page.setUserAgent(this.opts.userAgent);
    await this.page.setViewport({ width: 1440, height: 1000 });
    await this.page.emulateTimezone("Asia/Ho_Chi_Minh");
    await this.page.setExtraHTTPHeaders({ "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8" });
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      Object.defineProperty(navigator, "languages", { get: () => ["vi-VN", "vi", "en-US", "en"] });
      // @ts-expect-error bổ sung đối tượng mà trình duyệt thật luôn có
      window.chrome = { runtime: {} };
    });
    log.info(`Đã mở Chromium: ${exe}`);
  }

  /** Mở trang vượt thử thách để lấy cookie. Chỉ chạy một lần cho mỗi phiên. */
  async warmup(): Promise<void> {
    if (this.warmedUp) return;
    await this.launch();
    const page = this.page!;
    const res = await page.goto(this.opts.warmupUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await new Promise((r) => setTimeout(r, this.opts.warmupWaitMs));
    const html = await page.content();
    if (/you have been blocked|403 Forbidden/i.test(html)) {
      throw new BrowserUnavailableError(
        `Vẫn bị tường lửa chặn tại ${this.opts.warmupUrl} (HTTP ${res?.status()}). ` +
          "Có thể nguồn đã siết thêm; cần xem lại cấu hình trình duyệt.",
      );
    }
    this.warmedUp = true;
    log.info(`Đã vượt thử thách tại ${this.opts.warmupUrl}`, { status: res?.status() });
  }

  private async throttle(): Promise<void> {
    const wait = this.lastFetch + this.opts.minIntervalMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastFetch = Date.now();
  }

  /**
   * Tải một URL và trả về thân phản hồi đầy đủ.
   * Dùng fetch NGAY TRONG trang đã vượt thử thách nên kế thừa cookie và cùng nguồn;
   * cách này lấy được cả phần thân được truyền theo luồng (streaming), điều mà
   * việc đọc DOM không làm được khi ứng dụng React hydrate lỗi.
   */
  async fetchText(url: string): Promise<{ status: number; body: string }> {
    await this.warmup();
    await this.throttle();
    const page = this.page!;
    return await page.evaluate(async (u: string) => {
      const r = await fetch(u, { credentials: "include" });
      return { status: r.status, body: await r.text() };
    }, url);
  }

  /** Mở URL như người dùng thật và trả về DOM sau khi trang ổn định. */
  async renderText(url: string, opts: { waitMs?: number; waitForText?: string } = {}): Promise<string> {
    await this.warmup();
    await this.throttle();
    const page = this.page!;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    if (opts.waitForText) {
      await page
        .waitForFunction(
          (needle: string) => document.body.innerText.includes(needle),
          { timeout: 30_000 },
          opts.waitForText,
        )
        .catch(() => undefined);
    }
    await new Promise((r) => setTimeout(r, opts.waitMs ?? 4000));
    return await page.content();
  }

  /** Chuỗi Cookie để tái sử dụng cho yêu cầu HTTP thường (rẻ hơn nhiều so với mở trang). */
  async cookieHeader(): Promise<string> {
    await this.warmup();
    const cookies = await this.page!.cookies();
    return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  }

  async close(): Promise<void> {
    await this.browser?.close().catch(() => undefined);
    this.browser = undefined;
    this.page = undefined;
    this.warmedUp = false;
  }
}

/** Phiên dùng chung cho vbpl.vn. */
let vbplSession: BrowserSession | undefined;

export function getVbplSession(): BrowserSession {
  if (!vbplSession) {
    vbplSession = new BrowserSession({
      warmupUrl: "https://vbpl.vn/",
      minIntervalMs: Number(process.env.VBPL_MIN_INTERVAL_MS ?? 2000),
    });
  }
  return vbplSession;
}

export async function closeAllSessions(): Promise<void> {
  await vbplSession?.close();
  vbplSession = undefined;
}
