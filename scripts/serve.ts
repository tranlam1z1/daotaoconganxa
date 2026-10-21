/**
 * Bộ khởi chạy dịch vụ theo hồ sơ cổng.
 *
 *   bun run scripts/serve.ts web api            # chạy web + api, hồ sơ dev
 *   bun run scripts/serve.ts --profile thu api  # chạy api ở hồ sơ thử nghiệm
 *
 * Trước khi chạy, mọi cổng liên quan đều được giải phóng: nếu đang bị chiếm bởi một
 * tiến trình KHÁC thì tiến trình đó bị kết thúc (SIGTERM rồi SIGKILL nếu cần).
 * Xem LENH.md.
 */
import { apiUrl, ensurePortFree, type Profile, portFor, type ServiceName } from "@qdpl/config";

const ALL: ServiceName[] = ["web", "api", "mcp"];

const argv = process.argv.slice(2);
let profile: Profile = (process.env.QDPL_PROFILE as Profile) ?? "dev";
const services: ServiceName[] = [];
const extra: string[] = [];

for (let i = 0; i < argv.length; i++) {
  const a = argv[i]!;
  if (a === "--profile" || a === "-p") {
    const v = argv[++i];
    if (v !== "dev" && v !== "thu") {
      console.error(`Hồ sơ không hợp lệ: ${v}. Chọn "dev" hoặc "thu".`);
      process.exit(1);
    }
    profile = v;
  } else if (a === "--all") {
    services.push(...ALL);
  } else if (ALL.includes(a as ServiceName)) {
    services.push(a as ServiceName);
  } else {
    extra.push(a);
  }
}

if (!services.length) services.push("web", "api");

const unique = [...new Set(services)];
console.error(`Hồ sơ: ${profile} | dịch vụ: ${unique.join(", ")}`);

// Bước 1: giải phóng toàn bộ cổng trước, để không có dịch vụ nào khởi động nửa chừng rồi hỏng.
for (const s of unique) {
  const port = portFor(s, profile);
  try {
    await ensurePortFree(port);
  } catch (e) {
    console.error(`Không giải phóng được cổng ${port} cho ${s}: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
}

// Bước 2: khởi chạy.
const env = {
  ...process.env,
  QDPL_PROFILE: profile,
  API_URL: apiUrl(profile),
  WEB_PORT: String(portFor("web", profile)),
  PORT: String(portFor("api", profile)),
  MCP_PORT: String(portFor("mcp", profile)),
};

const commands: Record<ServiceName, string[]> = {
  web: ["bun", "run", "--cwd", "apps/web", "dev"],
  api: ["bun", "run", "apps/api/src/index.ts"],
  mcp: ["bun", "run", "apps/mcp/src/index.ts", "--http"],
};

const children = unique.map((s) => {
  const port = portFor(s, profile);
  console.error(`  ${s.padEnd(4)} -> http://127.0.0.1:${port}`);
  return {
    name: s,
    proc: Bun.spawn([...commands[s], ...extra], {
      env,
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
    }),
  };
});

const stopAll = (signal: NodeJS.Signals) => {
  for (const c of children) {
    try {
      c.proc.kill(signal === "SIGINT" ? 2 : 15);
    } catch {
      // đã thoát
    }
  }
};
process.on("SIGINT", () => {
  stopAll("SIGINT");
  process.exit(0);
});
process.on("SIGTERM", () => {
  stopAll("SIGTERM");
  process.exit(0);
});

// Nếu một dịch vụ chết thì dừng cả nhóm, tránh trạng thái nửa vời khó hiểu.
await Promise.race(
  children.map(async (c) => {
    const code = await c.proc.exited;
    console.error(`Dịch vụ ${c.name} đã thoát với mã ${code}. Dừng các dịch vụ còn lại.`);
    stopAll("SIGTERM");
    process.exit(code ?? 1);
  }),
);
