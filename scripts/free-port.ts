/**
 * Giải phóng một hoặc nhiều cổng.
 *
 *   bun run scripts/free-port.ts 3030 3031
 *   bun run scripts/free-port.ts --profile thu --all
 *   bun run scripts/free-port.ts 3030 --xem        # chỉ xem, không kết thúc tiến trình
 */
import { ensurePortFree, findPortHolders, isPortFree, PORTS, type Profile, portFor } from "@qdpl/config";

const argv = process.argv.slice(2);
const dryRun = argv.includes("--xem") || argv.includes("--dry-run");
let profile: Profile = "dev";
const ports: number[] = [];

for (let i = 0; i < argv.length; i++) {
  const a = argv[i]!;
  if (a === "--profile" || a === "-p") {
    const v = argv[++i];
    profile = v === "thu" ? "thu" : "dev";
  } else if (a === "--all") {
    ports.push(...Object.values(PORTS[profile]));
  } else if (/^\d+$/.test(a)) {
    ports.push(Number(a));
  }
}
if (!ports.length) {
  ports.push(portFor("web", profile), portFor("api", profile), portFor("mcp", profile));
}

for (const port of [...new Set(ports)]) {
  if (await isPortFree(port)) {
    console.log(`Cổng ${port}: trống.`);
    continue;
  }
  const holders = await findPortHolders(port);
  console.log(
    `Cổng ${port}: đang bị chiếm bởi ${holders.map((h) => `pid ${h.pid} (${h.command})`).join(", ") || "(không rõ)"}`,
  );
  if (dryRun) continue;
  try {
    await ensurePortFree(port, { log: (m) => console.log(`  ${m}`) });
    console.log(`  -> đã giải phóng cổng ${port}.`);
  } catch (e) {
    console.error(`  -> LỖI: ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  }
}
