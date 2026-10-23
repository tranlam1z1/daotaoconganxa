/**
 * Sơ đồ cổng và tiện ích giải phóng cổng.
 *
 * Hai hồ sơ chạy song song được, không giẫm chân nhau:
 *   dev — dành cho người phát triển (mặc định)
 *   thu — dành cho phiên kiểm thử tự động của trợ lý
 */

export type Profile = "dev" | "thu";
export type ServiceName = "web" | "api" | "mcp";

/** Cổng theo dịch vụ và hồ sơ. Xem LENH.md. */
export const PORTS: Record<Profile, Record<ServiceName, number>> = {
  dev: { web: 3030, api: 3031, mcp: 3032 },
  thu: { web: 3060, api: 3061, mcp: 3062 },
};

export function currentProfile(): Profile {
  const p = process.env.QDPL_PROFILE;
  return p === "thu" ? "thu" : "dev";
}

/**
 * Đang chạy trên máy chủ thật (DigitalOcean App Platform, Docker, systemd...) hay trên máy
 * người phát triển.
 *
 * Nhận biết bằng NODE_ENV=production, hoặc bằng các biến mà App Platform tự đặt cho mọi
 * thành phần (APP_URL, APP_DOMAIN). Có lối thứ hai vì quên khai NODE_ENV là lỗi dễ mắc khi
 * tạo ứng dụng bằng bảng điều khiển, mà hậu quả thì khó đoán: dịch vụ chỉ nghe loopback,
 * health check trượt, nền tảng báo thành phần hỏng chứ không nói vì sao.
 */
export function isProduction(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  return Boolean(process.env.APP_URL || process.env.APP_DOMAIN);
}

/**
 * Cổng của một dịch vụ.
 *
 * Thứ tự ưu tiên:
 *   1. biến môi trường riêng của dịch vụ (WEB_PORT / API_PORT / MCP_PORT)
 *   2. PORT — nền tảng lưu trữ chỉ định cổng qua biến này. Mỗi thành phần trên App Platform
 *      là một tiến trình riêng nên PORT không gây lẫn giữa các dịch vụ. Chỉ nhận PORT khi
 *      NODE_ENV=production, để một biến PORT sót trong .env không kéo cả ba dịch vụ về
 *      cùng một cổng lúc chạy `bun run dev:all`.
 *   3. sơ đồ cổng theo hồ sơ.
 *
 * Riêng api vẫn nhận PORT ở mọi môi trường: scripts/serve.ts đặt PORT cho api từ trước.
 */
export function portFor(service: ServiceName, profile: Profile = currentProfile()): number {
  const platformPort = isProduction() ? process.env.PORT : undefined;
  const explicit = {
    web: process.env.WEB_PORT ?? platformPort,
    api: process.env.API_PORT ?? process.env.PORT,
    mcp: process.env.MCP_PORT ?? platformPort,
  }[service];
  if (explicit && Number.isFinite(Number(explicit))) return Number(explicit);
  return PORTS[profile][service];
}

/**
 * Địa chỉ để mở cổng lắng nghe.
 *
 * Trên máy phát triển chỉ mở ở 127.0.0.1 — không phơi dịch vụ ra mạng LAN. Trên máy chủ thật
 * phải mở ở mọi giao diện, vì bộ cân bằng tải của nền tảng gọi vào từ một địa chỉ khác;
 * chỉ nghe loopback thì health check trượt và thành phần bị coi là hỏng.
 */
export function bindHost(): string {
  return process.env.HOST ?? (isProduction() ? "0.0.0.0" : "127.0.0.1");
}

/** URL nội bộ của API, để web và script gọi tới. */
export function apiUrl(profile: Profile = currentProfile()): string {
  return process.env.API_URL ?? `http://127.0.0.1:${portFor("api", profile)}`;
}

export interface PortHolder {
  pid: number;
  command: string;
}

/**
 * Tìm các tiến trình đang LẮNG NGHE trên một cổng.
 * Windows dùng netstat/tasklist; Linux dùng ss, rồi lsof.
 * Chỉ nhận tiến trình ở trạng thái LISTEN — không đụng tới kết nối đang mở tới cổng đó.
 */
export async function findPortHolders(port: number): Promise<PortHolder[]> {
  const pids = new Set<number>();

  const run = async (cmd: string[]): Promise<string> => {
    try {
      const p = Bun.spawn(cmd, { stdout: "pipe", stderr: "ignore" });
      const out = await new Response(p.stdout).text();
      await p.exited;
      return out;
    } catch {
      return "";
    }
  };

  if (process.platform === "win32") {
    for (const pid of windowsListenerPids(await run(["netstat", "-ano", "-p", "tcp"]), port)) {
      pids.add(pid);
    }
  } else {
    // ss: dòng LISTEN có users:(("tên",pid=123,fd=4))
    const ssOut = await run(["ss", "-ltnpH", `sport = :${port}`]);
    for (const m of ssOut.matchAll(/pid=(\d+)/g)) pids.add(Number(m[1]));

    if (!pids.size) {
      const lsofOut = await run(["lsof", "-ti", `tcp:${port}`, "-sTCP:LISTEN"]);
      for (const line of lsofOut.split("\n")) {
        const n = Number(line.trim());
        if (Number.isFinite(n) && n > 0) pids.add(n);
      }
    }
  }

  const holders: PortHolder[] = [];
  for (const pid of pids) {
    let command = "?";
    try {
      if (process.platform === "win32") {
        const task = await run(["tasklist", "/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"]);
        command = task.match(/^"([^"]+)","\d+"/m)?.[1] ?? "?";
        if (command === "?") {
          // tasklist có thể bị chặn ngay cả khi Get-Process vẫn đọc được tên tiến trình.
          command =
            (
              await run([
                "powershell.exe",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                `(Get-Process -Id ${pid} -ErrorAction Stop).ProcessName`,
              ])
            ).trim() || "?";
        }
      } else {
        command = (await Bun.file(`/proc/${pid}/cmdline`).text()).replace(/\0/g, " ").trim() || "?";
      }
    } catch {
      // tiến trình đã thoát giữa chừng
    }
    holders.push({ pid, command: command.slice(0, 120) });
  }
  return holders;
}

/** Chỉ lấy PID lắng nghe đúng cổng cục bộ, kể cả IPv6; bỏ kết nối tới máy chủ khác. */
export function windowsListenerPids(output: string, port: number): number[] {
  const pids = new Set<number>();
  for (const line of output.split(/\r?\n/)) {
    const [protocol, local, , state, rawPid] = line.trim().split(/\s+/);
    if (protocol !== "TCP" || state !== "LISTENING") continue;
    if (Number(local?.slice(local.lastIndexOf(":") + 1)) !== port) continue;
    const pid = Number(rawPid);
    if (Number.isInteger(pid) && pid > 0) pids.add(pid);
  }
  return [...pids];
}

/** Cổng có đang bị chiếm không (thử mở thật, chắc chắn hơn là đọc bảng tiến trình). */
export async function isPortFree(port: number): Promise<boolean> {
  try {
    const s = Bun.listen({ hostname: "127.0.0.1", port, socket: { data() {} } });
    s.stop(true);
    return true;
  } catch {
    return false;
  }
}

export interface EnsureOptions {
  /** Cho phép kết thúc tiến trình đang chiếm cổng. Mặc định bật ở dev, tắt ở production. */
  killIfBusy?: boolean;
  /** Chờ tối đa bao lâu sau khi gửi tín hiệu, mili giây. */
  timeoutMs?: number;
  /** Nơi in thông báo. */
  log?: (msg: string) => void;
}

export class PortBusyError extends Error {
  constructor(
    readonly port: number,
    readonly holders: PortHolder[],
    message: string,
  ) {
    super(message);
    this.name = "PortBusyError";
  }
}

/**
 * Bảo đảm cổng trống trước khi mở.
 *
 * Nếu cổng đang bị chiếm bởi MỘT TIẾN TRÌNH KHÁC (pid khác pid hiện tại), gửi SIGTERM,
 * chờ, rồi SIGKILL nếu cần, sau đó mở lại. Nếu chính tiến trình này đang giữ cổng thì
 * không làm gì (kết thúc chính mình là vô nghĩa).
 *
 * Ở NODE_ENV=production, mặc định KHÔNG kết thúc tiến trình khác: trên máy chủ thật,
 * cổng bận thường nghĩa là đã có bản đang phục vụ, giết nó là gây gián đoạn dịch vụ.
 */
export async function ensurePortFree(port: number, opts: EnsureOptions = {}): Promise<void> {
  const log = opts.log ?? ((m: string) => console.error(m));
  const isProd = isProduction();
  const allowKill = opts.killIfBusy ?? (process.env.QDPL_KILL_PORT === "0" ? false : !isProd);
  const timeoutMs = opts.timeoutMs ?? 5000;

  if (await isPortFree(port)) return;

  const holders = await findPortHolders(port);

  if (!holders.length) {
    // Tiến trình có thể vừa thoát giữa lần thử bind và lúc đọc bảng kết nối.
    if (await isPortFree(port)) return;
    throw new PortBusyError(
      port,
      [],
      `Cổng ${port} đang bận nhưng không xác định được tiến trình nào giữ nó ` +
        "(có thể do tiến trình của người dùng khác). Hãy chọn cổng khác.",
    );
  }

  const others = holders.filter((h) => h.pid !== process.pid);
  if (!others.length) {
    log(`Cổng ${port} do chính tiến trình này (pid ${process.pid}) đang giữ — không cần làm gì.`);
    return;
  }

  if (!allowKill) {
    throw new PortBusyError(
      port,
      others,
      `Cổng ${port} đang bị chiếm bởi ${others.map((h) => `pid ${h.pid} (${h.command})`).join(", ")}. ` +
        "Không tự kết thúc tiến trình vì đang ở chế độ production hoặc QDPL_KILL_PORT=0.",
    );
  }

  for (const h of others) {
    log(`Cổng ${port} đang bị chiếm bởi pid ${h.pid}: ${h.command}`);
    log(`  gửi SIGTERM tới pid ${h.pid}...`);
    try {
      process.kill(h.pid, "SIGTERM");
    } catch (e) {
      log(`  không gửi được SIGTERM: ${e instanceof Error ? e.message : e}`);
    }
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await Bun.sleep(150);
    if (await isPortFree(port)) {
      log(`  cổng ${port} đã được giải phóng.`);
      return;
    }
  }

  // Còn giữ cổng sau khi hết thời gian chờ: buộc kết thúc.
  for (const h of await findPortHolders(port)) {
    if (h.pid === process.pid) continue;
    log(`  pid ${h.pid} không thoát sau ${timeoutMs}ms, gửi SIGKILL...`);
    try {
      process.kill(h.pid, "SIGKILL");
    } catch {
      // đã thoát rồi
    }
  }

  const hardDeadline = Date.now() + 3000;
  while (Date.now() < hardDeadline) {
    await Bun.sleep(150);
    if (await isPortFree(port)) {
      log(`  cổng ${port} đã được giải phóng.`);
      return;
    }
  }

  throw new PortBusyError(
    port,
    await findPortHolders(port),
    `Không giải phóng được cổng ${port} sau khi đã gửi SIGKILL.`,
  );
}

/**
 * Mở cổng, tự giải phóng nếu đang bận.
 * `serve` là hàm mở máy chủ thật (ví dụ () => Bun.serve({...})).
 */
export async function listenWithRetry<T>(port: number, serve: () => T, opts: EnsureOptions = {}): Promise<T> {
  await ensurePortFree(port, opts);
  try {
    return serve();
  } catch (e) {
    // Có thể có tiến trình khác vừa chiếm cổng ngay giữa hai bước; thử giải phóng thêm một lần.
    const msg = e instanceof Error ? e.message : String(e);
    if (!/EADDRINUSE|address already in use|in use/i.test(msg)) throw e;
    (opts.log ?? console.error)(`Cổng ${port} bị chiếm lại ngay sau khi giải phóng, thử lần nữa...`);
    await ensurePortFree(port, opts);
    return serve();
  }
}
