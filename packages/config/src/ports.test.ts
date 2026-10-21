import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  apiUrl,
  bindHost,
  ensurePortFree,
  findPortHolders,
  isPortFree,
  listenWithRetry,
  PORTS,
  PortBusyError,
  portFor,
} from "./ports.ts";

/** Cổng cao, ít khả năng trùng với dịch vụ thật trên máy. */
const TEST_PORT = 39871;
const TEST_PORT_2 = 39872;

/** Mở một tiến trình con chỉ để chiếm cổng. */
async function spawnHolder(port: number): Promise<{ pid: number; kill: () => void }> {
  const code = `Bun.serve({ port: ${port}, fetch: () => new Response("giữ cổng") }); setInterval(() => {}, 1000);`;
  const proc = Bun.spawn(["bun", "-e", code], { stdout: "ignore", stderr: "ignore" });
  // Chờ tới khi cổng thực sự bị chiếm.
  for (let i = 0; i < 60; i++) {
    await Bun.sleep(50);
    if (!(await isPortFree(port))) break;
  }
  return { pid: proc.pid, kill: () => proc.kill(9) };
}

describe("sơ đồ cổng", () => {
  // Test phải độc lập với .env của máy: xóa biến ép cổng trước mỗi ca, khôi phục sau.
  const KEYS = [
    "WEB_PORT",
    "PORT",
    "API_PORT",
    "MCP_PORT",
    "API_URL",
    "QDPL_PROFILE",
    "NODE_ENV",
    "HOST",
    "APP_URL",
    "APP_DOMAIN",
  ] as const;
  let saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
    for (const k of KEYS) delete process.env[k];
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  test("hai hồ sơ không dùng chung cổng nào", () => {
    const dev = Object.values(PORTS.dev);
    const thu = Object.values(PORTS.thu);
    expect(new Set([...dev, ...thu]).size).toBe(dev.length + thu.length);
  });

  test("cổng đúng theo yêu cầu: dev 3030, thử 3060", () => {
    expect(PORTS.dev.web).toBe(3030);
    expect(PORTS.thu.web).toBe(3060);
    expect(portFor("web", "dev")).toBe(3030);
    expect(portFor("web", "thu")).toBe(3060);
  });

  test("biến môi trường riêng của dịch vụ được ưu tiên", () => {
    process.env.WEB_PORT = "4444";
    expect(portFor("web", "dev")).toBe(4444);
    delete process.env.WEB_PORT;
    expect(portFor("web", "dev")).toBe(3030);
  });

  test("trên máy chủ thật, PORT của nền tảng áp cho mọi dịch vụ", () => {
    process.env.NODE_ENV = "production";
    process.env.PORT = "8080";
    // Mỗi thành phần trên App Platform là một tiến trình riêng nên dùng chung tên biến PORT.
    expect(portFor("web")).toBe(8080);
    expect(portFor("api")).toBe(8080);
    expect(portFor("mcp")).toBe(8080);
    // Biến riêng của dịch vụ vẫn được ưu tiên.
    process.env.MCP_PORT = "9090";
    expect(portFor("mcp")).toBe(9090);
  });

  test("trên máy phát triển, PORT chỉ áp cho api", () => {
    process.env.PORT = "8080";
    expect(portFor("api")).toBe(8080);
    // web và mcp giữ sơ đồ cổng: một biến PORT sót trong .env không được kéo cả ba về một cổng.
    expect(portFor("web")).toBe(3030);
    expect(portFor("mcp")).toBe(3032);
  });

  test("địa chỉ lắng nghe: loopback khi phát triển, mọi giao diện khi production", () => {
    expect(bindHost()).toBe("127.0.0.1");
    process.env.NODE_ENV = "production";
    expect(bindHost()).toBe("0.0.0.0");
    process.env.HOST = "10.0.0.5";
    expect(bindHost()).toBe("10.0.0.5");
  });

  test("thiếu NODE_ENV vẫn nhận ra máy chủ thật nhờ biến APP_URL của nền tảng", () => {
    process.env.APP_URL = "https://qdpl-abcde.ondigitalocean.app";
    process.env.PORT = "8080";
    expect(portFor("web")).toBe(8080);
    expect(bindHost()).toBe("0.0.0.0");
  });

  test("apiUrl theo hồ sơ", () => {
    expect(apiUrl("dev")).toBe("http://127.0.0.1:3031");
    expect(apiUrl("thu")).toBe("http://127.0.0.1:3061");
  });
});

describe("phát hiện và giải phóng cổng", () => {
  test("cổng trống thì báo trống và không làm gì", async () => {
    expect(await isPortFree(TEST_PORT)).toBe(true);
    await ensurePortFree(TEST_PORT, { log: () => {} });
  });

  test("tìm được tiến trình đang giữ cổng, kèm dòng lệnh", async () => {
    const holder = await spawnHolder(TEST_PORT);
    try {
      expect(await isPortFree(TEST_PORT)).toBe(false);
      const holders = await findPortHolders(TEST_PORT);
      expect(holders.length).toBeGreaterThan(0);
      expect(holders.map((h) => h.pid)).toContain(holder.pid);
      expect(holders[0]!.command).toContain("bun");
    } finally {
      holder.kill();
    }
  });

  test("kết thúc tiến trình khác đang chiếm cổng rồi giải phóng", async () => {
    const holder = await spawnHolder(TEST_PORT);
    const logs: string[] = [];
    expect(await isPortFree(TEST_PORT)).toBe(false);

    await ensurePortFree(TEST_PORT, { log: (m) => logs.push(m) });

    expect(await isPortFree(TEST_PORT)).toBe(true);
    expect(logs.join("\n")).toContain(`pid ${holder.pid}`);
    expect(logs.join("\n")).toContain("SIGTERM");
    // Tiến trình đã thoát thật
    expect(() => process.kill(holder.pid, 0)).toThrow();
  });

  test("KHÔNG tự kết thúc chính mình khi tiến trình hiện tại đang giữ cổng", async () => {
    const server = Bun.serve({ port: TEST_PORT_2, fetch: () => new Response("của chính tôi") });
    const logs: string[] = [];
    try {
      await ensurePortFree(TEST_PORT_2, { log: (m) => logs.push(m) });
      // Vẫn sống và vẫn phục vụ
      const res = await fetch(`http://127.0.0.1:${TEST_PORT_2}/`);
      expect(await res.text()).toBe("của chính tôi");
      expect(logs.join("\n")).toContain("chính tiến trình này");
    } finally {
      server.stop(true);
    }
  });

  test("chế độ không cho kết thúc thì báo lỗi rõ ràng thay vì giết tiến trình", async () => {
    const holder = await spawnHolder(TEST_PORT);
    try {
      const err = await ensurePortFree(TEST_PORT, { killIfBusy: false, log: () => {} }).catch((e) => e);
      expect(err).toBeInstanceOf(PortBusyError);
      expect(err.message).toContain(String(holder.pid));
      // Tiến trình vẫn còn sống
      expect(() => process.kill(holder.pid, 0)).not.toThrow();
    } finally {
      holder.kill();
    }
  });

  test("listenWithRetry mở được cổng dù đang bị chiếm", async () => {
    const holder = await spawnHolder(TEST_PORT);
    let server: ReturnType<typeof Bun.serve> | undefined;
    try {
      server = await listenWithRetry(
        TEST_PORT,
        () => Bun.serve({ port: TEST_PORT, fetch: () => new Response("máy chủ mới") }),
        { log: () => {} },
      );
      const res = await fetch(`http://127.0.0.1:${TEST_PORT}/`);
      expect(await res.text()).toBe("máy chủ mới");
      expect(() => process.kill(holder.pid, 0)).toThrow();
    } finally {
      server?.stop(true);
      try {
        holder.kill();
      } catch {
        // đã bị kết thúc ở trên
      }
    }
  });
});
