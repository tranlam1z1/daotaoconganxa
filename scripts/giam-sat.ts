/**
 * Bảng giám sát toàn cảnh: hạ tầng, kho văn bản, độ phủ theo khung, đợt nạp, hàng đợi.
 *
 *   bun run scripts/giam-sat.ts            # in một lần
 *   bun run scripts/giam-sat.ts --theo-doi # cập nhật mỗi 5 giây
 *   bun run scripts/giam-sat.ts --json
 */

import { currentProfile, isPortFree, portFor } from "@qdpl/config";
import { activeRuns, reconcileCorpus, runProgress, sql, thongKeSoHoa, tienDoNapKho } from "@qdpl/db";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const watch = args.includes("--theo-doi") || args.includes("--watch");

const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - s.length));
const padL = (s: string, n: number) => " ".repeat(Math.max(0, n - s.length)) + s;

async function checkRedis(): Promise<{ ok: boolean; message: string }> {
  if (!process.env.REDIS_URL) return { ok: false, message: "chưa đặt REDIS_URL" };
  try {
    const { pingRedis } = await import("@qdpl/queue");
    return await pingRedis();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

async function queueSnapshot() {
  if (!process.env.REDIS_URL) return undefined;
  try {
    const { snapshotAll } = await import("@qdpl/queue");
    return await snapshotAll();
  } catch {
    return undefined;
  }
}

async function collect() {
  const profile = currentProfile();
  const [dbStat] = (await sql`
    SELECT (SELECT count(*) FROM documents) AS van_ban,
           (SELECT count(*) FROM document_versions) AS phien_ban,
           (SELECT count(*) FROM nodes) AS nut,
           (SELECT count(*) FROM amendment_ops WHERE review_status='pending') AS lenh_cho_duyet,
           (SELECT count(*) FROM review_queue WHERE state='open') AS viec_bien_tap,
           (SELECT count(*) FROM embeddings) AS vector`) as any[];

  const services = await Promise.all(
    (["web", "api", "mcp"] as const).map(async (s) => {
      const port = portFor(s, profile);
      return { ten: s, cong: port, dang_chay: !(await isPortFree(port)) };
    }),
  );

  const redis = await checkRedis();
  const queues = await queueSnapshot();
  const coverage = await reconcileCorpus();
  const runs = await activeRuns();
  const runDetails = await Promise.all(runs.map((r) => runProgress(String(r.id))));

  const tienDo = await tienDoNapKho().catch(() => undefined);
  const soHoa = await thongKeSoHoa().catch(() => undefined);

  return {
    profile,
    dbStat,
    services,
    redis,
    queues,
    coverage,
    runs: runDetails.filter(Boolean),
    tienDo,
    soHoa,
  };
}

function render(d: Awaited<ReturnType<typeof collect>>): string {
  const L: string[] = [];
  L.push(`GIÁM SÁT quydinhphapluat.vn — hồ sơ ${d.profile} — ${new Date().toLocaleString("vi-VN")}`);
  L.push("=".repeat(84));

  L.push("Dịch vụ:");
  for (const s of d.services) {
    L.push(`  ${pad(s.ten, 6)} cổng ${s.cong}  ${s.dang_chay ? "đang chạy" : "chưa chạy"}`);
  }
  L.push(`  redis  ${d.redis.ok ? "kết nối được" : "KHÔNG kết nối"} — ${d.redis.message}`);

  L.push("");
  L.push("Kho văn bản:");
  const s = d.dbStat;
  L.push(
    `  văn bản ${s.van_ban} | phiên bản ${s.phien_ban} | nút ${s.nut} | vector ${s.vector}\n` +
      `  lệnh sửa đổi chờ duyệt ${s.lenh_cho_duyet} | việc biên tập đang mở ${s.viec_bien_tap}`,
  );

  if (d.tienDo?.tong) {
    const t = d.tienDo;
    const rong = 40;
    const day = Math.round(t.tyLe * rong);
    L.push("");
    L.push("Tiến độ nạp kho (so với tổng đếm được ở nguồn):");
    L.push(`  [${"#".repeat(day)}${".".repeat(rong - day)}] ${(t.tyLe * 100).toFixed(1)}%`);
    L.push(
      `  ${t.daCo.toLocaleString("vi-VN")} / ${t.tong.toLocaleString("vi-VN")} văn bản` +
        (t.soLoaiChuaDem
          ? `  (còn ${t.soLoaiChuaDem} loại chưa đếm mẫu số — chạy: bun run pipeline nguon dem)`
          : ""),
    );
    for (const x of t.theoLoai.filter((y) => y.tongONguon > 0).slice(0, 8)) {
      const n = Math.round(x.tyLe * 20);
      L.push(
        `    ${pad(x.loai, 22)}${padL(x.daCo.toLocaleString("vi-VN"), 7)} /${padL(x.tongONguon.toLocaleString("vi-VN"), 8)}  ` +
          `[${"#".repeat(n)}${".".repeat(20 - n)}] ${(x.tyLe * 100).toFixed(1)}%`,
      );
    }
  } else {
    L.push("");
    L.push("Tiến độ nạp kho: chưa có mẫu số. Chạy `bun run pipeline nguon dem` để đếm tổng ở nguồn.");
  }

  if (d.soHoa && Object.keys(d.soHoa.theoTrangThai).length) {
    const sh = d.soHoa;
    const tongViec = Object.values(sh.theoTrangThai).reduce((a, b) => a + b, 0);
    L.push("");
    L.push(
      `Số hóa PDF: ${tongViec} việc — ` +
        Object.entries(sh.theoTrangThai)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ") +
        ` | cụm đã nộp: ${sh.soCuaSoDaNop}` +
        (sh.choDayParse ? ` | CHỜ ĐẨY PARSE: ${sh.choDayParse} (bun run pipeline so-hoa dong-bo)` : ""),
    );
  }

  if (d.queues?.length) {
    L.push("");
    L.push("Hàng đợi:");
    L.push(
      `  ${pad("tên", 22)}${padL("chờ", 8)}${padL("chạy", 7)}${padL("xong", 9)}${padL("hỏng", 7)}${padL("hoãn", 7)}`,
    );
    for (const q of d.queues) {
      const busy = q.cho + q.dang_chay + q.tri_hoan > 0 || q.that_bai > 0;
      if (!busy && q.hoan_thanh === 0) continue;
      L.push(
        `  ${pad(q.ten.replace(/^qdpl-/, ""), 22)}${padL(String(q.cho), 8)}${padL(String(q.dang_chay), 7)}` +
          `${padL(String(q.hoan_thanh), 9)}${padL(String(q.that_bai), 7)}${padL(String(q.tri_hoan), 7)}` +
          (q.tam_dung ? "  [tạm dừng]" : ""),
      );
    }
    const tongHong = d.queues.reduce((a, q) => a + q.that_bai, 0);
    if (tongHong) L.push(`  Có ${tongHong} job hỏng. Xem: bun run pipeline bull failures`);
  }

  if (d.runs.length) {
    L.push("");
    L.push("Đợt nạp đang chạy:");
    for (const r of d.runs as any[]) {
      L.push(
        `  ${r.ten} (${r.nguon}) — phát hiện ${r.da_phat_hien}, đã nạp ${r.da_nap}, lỗi ${r.that_bai}` +
          ` — hoàn thành ${(r.ty_le_hoan_thanh * 100).toFixed(1)}%`,
      );
      const stages = Object.entries(r.theo_giai_doan)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");
      if (stages) L.push(`    theo giai đoạn: ${stages}`);
    }
  }

  L.push("");
  L.push("Độ phủ theo khung cấu trúc kho:");
  const byGroup = new Map<string, { co: number; kyVong: number; oCoDuLieu: number; tongO: number }>();
  for (const c of d.coverage) {
    const g = byGroup.get(c.nhom) ?? { co: 0, kyVong: 0, oCoDuLieu: 0, tongO: 0 };
    g.co += c.so_luong_co;
    g.kyVong += c.so_luong_ky_vong ?? 0;
    if (c.so_luong_co > 0) g.oCoDuLieu++;
    g.tongO++;
    byGroup.set(c.nhom, g);
  }
  for (const [nhom, g] of [...byGroup.entries()].sort()) {
    const tyLe = g.kyVong ? ` (${((g.co / g.kyVong) * 100).toFixed(0)}% so với kỳ vọng ${g.kyVong})` : "";
    L.push(
      `  ${pad(nhom, 20)} ${padL(String(g.co), 7)} văn bản, ${g.oCoDuLieu}/${g.tongO} ô có dữ liệu${tyLe}`,
    );
  }
  const tongCo = d.coverage.reduce((a, c) => a + c.so_luong_co, 0);
  const oTrong = d.coverage.filter((c) => c.so_luong_co === 0).length;
  L.push(`  Tổng: ${tongCo} văn bản khớp khung; còn ${oTrong}/${d.coverage.length} ô CHƯA có dữ liệu.`);
  L.push("=".repeat(84));
  return L.join("\n");
}

async function once() {
  const d = await collect();
  console.log(asJson ? JSON.stringify(d, null, 2) : render(d));
}

/** Đóng mọi kết nối. ioredis và BullMQ giữ event loop sống nếu không đóng. */
async function shutdown(): Promise<void> {
  if (process.env.REDIS_URL) {
    try {
      const { closeQueues, closeConnection } = await import("@qdpl/queue");
      await closeQueues();
      await closeConnection();
    } catch {
      // chưa từng mở kết nối
    }
  }
  await sql.end({ timeout: 3 }).catch(() => undefined);
}

if (watch) {
  process.on("SIGINT", async () => {
    await shutdown();
    process.exit(0);
  });
  for (;;) {
    process.stdout.write("\x1b[2J\x1b[H");
    await once();
    await Bun.sleep(5000);
  }
} else {
  await once();
  await shutdown();
  process.exit(0);
}
