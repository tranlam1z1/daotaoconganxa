/**
 * Điều phối nạp kho trên REDIS THẬT.
 *
 * Chạy trên CSDL Redis số 15 của cùng máy chủ (không đụng dữ liệu hàng đợi thật) và
 * xóa sạch những hàng đợi đã dùng khi xong. Không có REDIS_URL thì cả nhóm test này
 * được BỎ QUA có điều kiện, không làm hỏng `bun test`.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "@qdpl/db";

/** Đổi sang CSDL Redis 15 TRƯỚC khi có bất kỳ kết nối nào được mở. */
const REDIS_GOC = process.env.REDIS_URL;
const coRedis = Boolean(REDIS_GOC);
if (REDIS_GOC) {
  const u = new URL(REDIS_GOC);
  u.pathname = "/15";
  process.env.REDIS_URL = u.toString();
}

const { closeConnection, QUEUES } = await import("@qdpl/queue");
const { closeQueues, getQueue, safeJobId } = await import("../src/bull/queues.ts");
const { backfill } = await import("../src/backfill.ts");
const { ensureCorpusTargets, listTargets, planDiscover } = await import("../src/bull/frame.ts");
const { countItems, getRun } = await import("../src/bull/ledger.ts");

const MA = "kiem-thu-fixture";

/** Không có Redis thì bỏ qua có điều kiện thay vì để test hỏng. */
const moTa = coRedis ? describe : describe.skip;

moTa("bộ điều phối nạp kho (Redis thật, CSDL 15)", () => {
  beforeAll(async () => {
    await ensureCorpusTargets({ kiemThu: true });
    // Sạch trước khi chạy để lần chạy trước không ảnh hưởng kết quả.
    await getQueue(QUEUES.discover).obliterate({ force: true });
    await sql`DELETE FROM ingest_runs WHERE ten = 'backfill:kiem_thu'`;
  });

  afterAll(async () => {
    await getQueue(QUEUES.discover)
      .obliterate({ force: true })
      .catch(() => undefined);
    await sql`DELETE FROM ingest_runs WHERE ten = 'backfill:kiem_thu'`;
    await closeQueues();
    await closeConnection();
    if (REDIS_GOC) process.env.REDIS_URL = REDIS_GOC;
  });

  test("khung kiểm thử có ô fixture và sinh được job discover tất định", async () => {
    const targets = await listTargets({ nhom: "kiem_thu" });
    expect(targets.map((t) => t.ma)).toContain(MA);
    const target = targets.find((t) => t.ma === MA)!;
    const plan = planDiscover(target, { runId: "run-1", limit: 5 });
    expect(plan.key).toBe("run-1:kiem-thu-fixture:p1");
    expect(plan.data).toMatchObject({ runId: "run-1", nguon: "fixture", page: 1, limit: 5 });
  });

  test("chạy hai lần cùng một lệnh: dùng lại đợt, không tạo job trùng", async () => {
    const lan1 = await backfill({ nhom: "kiem_thu", cho: false, perPage: 5 });
    expect(lan1.moi_tao).toBe(true);
    expect(lan1.tong_job_da_day).toBe(1);

    const q = getQueue(QUEUES.discover);
    const sau1 = await q.getJobCounts("waiting", "active", "delayed", "completed", "failed");
    expect((sau1.waiting ?? 0) + (sau1.delayed ?? 0)).toBe(1);

    // Lần hai: cùng lệnh, không cờ gì thêm.
    const lan2 = await backfill({ nhom: "kiem_thu", cho: false, perPage: 5 });
    expect(lan2.runId).toBe(lan1.runId); // dùng lại đợt đang chạy
    expect(lan2.moi_tao).toBe(false);
    expect(lan2.tong_job_da_day).toBe(0); // ô khung đã đẩy job -> bỏ qua

    const sau2 = await q.getJobCounts("waiting", "active", "delayed", "completed", "failed");
    expect((sau2.waiting ?? 0) + (sau2.delayed ?? 0)).toBe(1);

    // Kể cả khi ép đẩy lại đúng job đó, jobId tất định chặn trùng.
    const target = (await listTargets({ nhom: "kiem_thu" })).find((t) => t.ma === MA)!;
    const plan = planDiscover(target, { runId: lan1.runId, limit: 5 });
    const { add } = await import("../src/bull/queues.ts");
    const idLai = await add(QUEUES.discover, plan.data, { key: plan.key });
    const sau3 = await q.getJobCounts("waiting", "active", "delayed", "completed", "failed");
    expect((sau3.waiting ?? 0) + (sau3.delayed ?? 0)).toBe(1);
    expect(String(idLai)).toBe(safeJobId(QUEUES.discover, plan.key));

    // Sổ cái chưa có mục nào (worker chưa chạy) và đợt vẫn đang chạy.
    expect((await countItems(lan1.runId)).tong).toBe(0);
    expect((await getRun(lan1.runId))?.trang_thai).toBe("dang_chay");
  });

  test("chạy tiếp bằng --resume phải trỏ đúng đợt đã có", async () => {
    const lan1 = await backfill({ nhom: "kiem_thu", cho: false, perPage: 5 });
    const tiep = await backfill({ nhom: "kiem_thu", cho: false, perPage: 5, runId: lan1.runId });
    expect(tiep.runId).toBe(lan1.runId);
    expect(tiep.tong_job_da_day).toBe(0);
    await expect(
      backfill({ nhom: "kiem_thu", cho: false, runId: "00000000-0000-0000-0000-000000000000" }),
    ).rejects.toThrow(/Không có đợt nạp/);
  });

  test("không có ô khung khớp thì báo lỗi rõ ràng", async () => {
    await expect(backfill({ nhom: "khong-co-nhom-nay", cho: false })).rejects.toThrow(/ô khung/);
  });
});
