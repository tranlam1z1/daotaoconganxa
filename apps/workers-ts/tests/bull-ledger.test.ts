/**
 * Sổ cái nạp kho: `ingest_runs` / `ingest_items`, và cách tính ngưỡng hoàn thành đợt.
 * Chạy trên CSDL test riêng (xem bunfig.toml + packages/db/src/test-setup.ts).
 */
import { describe, expect, test } from "bun:test";
import { sql } from "@qdpl/db";
import { groupWaves, waveRatio } from "../src/backfill.ts";
import type { CorpusTargetRow } from "../src/bull/frame.ts";
import {
  completionRatio,
  countItems,
  createRun,
  findActiveRun,
  getItem,
  getRun,
  patchItemBySource,
  patchItemByUrn,
  recordDiscovered,
  refreshRunCounts,
  runProgress,
  setRunState,
  updateRunScope,
} from "../src/bull/ledger.ts";

const NGUON = "fixture";

async function newRun(ten = `test:ledger:${crypto.randomUUID()}`): Promise<string> {
  return await createRun({ ten, nguon: NGUON, phamVi: { nhom: "kiem_thu", da_day: [] } });
}

describe("sổ cái ingest_runs / ingest_items", () => {
  test("ghi mục phát hiện là idempotent theo (run, nguồn, sourceId)", async () => {
    const runId = await newRun();
    const rows = [
      { nguon: NGUON, sourceId: "a", url: "file:///a.md", soKyHieu: "1/2026/NĐ-CP" },
      { nguon: NGUON, sourceId: "b", url: "file:///b.md" },
    ];
    expect(await recordDiscovered(runId, rows)).toBe(2);
    // Chạy lại đúng job discover đó: không thêm dòng nào nữa.
    expect(await recordDiscovered(runId, rows)).toBe(0);
    expect(await recordDiscovered(runId, [...rows, { nguon: NGUON, sourceId: "c" }])).toBe(1);

    const c = await countItems(runId);
    expect(c.tong).toBe(3);
    expect(c.cho).toBe(3);

    const item = await getItem(runId, NGUON, "a");
    expect(item?.giai_doan).toBe("phat_hien");
    expect(item?.trang_thai).toBe("cho");
    expect(item?.so_ky_hieu).toBe("1/2026/NĐ-CP");
  });

  test("cập nhật mục theo nguồn rồi theo URN, giữ đủ giai_doan/so_lan_thu/loi/job_id", async () => {
    const runId = await newRun();
    await recordDiscovered(runId, [{ nguon: NGUON, sourceId: "x", url: "file:///x.md" }]);

    await patchItemBySource(runId, NGUON, "x", {
      giaiDoan: "tai_ve",
      trangThai: "dang_chay",
      soLanThu: 1,
      jobId: "fetch:job-1",
      batDau: true,
    });
    let item = await getItem(runId, NGUON, "x");
    expect(item?.giai_doan).toBe("tai_ve");
    expect(item?.trang_thai).toBe("dang_chay");
    expect(item?.so_lan_thu).toBe(1);
    expect(item?.job_id).toBe("fetch:job-1");
    expect(item?.bat_dau).toBeTruthy();

    // Lỗi có lý do, rồi thử lại lần 2 -> xóa lỗi cũ.
    await patchItemBySource(runId, NGUON, "x", { trangThai: "loi", loi: "HTTP 404", soLanThu: 1 });
    item = await getItem(runId, NGUON, "x");
    expect(item?.trang_thai).toBe("loi");
    expect(item?.loi).toBe("HTTP 404");

    await patchItemBySource(runId, NGUON, "x", { trangThai: "dang_chay", loi: null, soLanThu: 2 });
    item = await getItem(runId, NGUON, "x");
    expect(item?.loi).toBeNull();
    expect(item?.so_lan_thu).toBe(2);

    // Sau bước ingest, các giai đoạn sau chỉ biết URN.
    const urn = "vn:vbqppl:nd:100/2026/NĐ-CP";
    await patchItemBySource(runId, NGUON, "x", { documentUrn: urn, giaiDoan: "chuyen_doi" });
    expect(await patchItemByUrn(runId, urn, { giaiDoan: "xong", trangThai: "xong", ketThuc: true })).toBe(1);
    item = await getItem(runId, NGUON, "x");
    expect(item?.giai_doan).toBe("xong");
    expect(item?.trang_thai).toBe("xong");
    expect(item?.ket_thuc).toBeTruthy();
    // Đợt khác không bị đụng tới.
    expect(await patchItemByUrn(await newRun(), urn, { trangThai: "xong" })).toBe(0);
  });

  test("tổng hợp số liệu vào ingest_runs và tính tiến độ", async () => {
    const runId = await newRun();
    await recordDiscovered(
      runId,
      ["a", "b", "c", "d"].map((s) => ({ nguon: NGUON, sourceId: s })),
    );
    await patchItemBySource(runId, NGUON, "a", { trangThai: "xong", giaiDoan: "xong" });
    await patchItemBySource(runId, NGUON, "b", { trangThai: "bo_qua" });
    await patchItemBySource(runId, NGUON, "c", { trangThai: "loi", loi: "hỏng" });

    const c = await refreshRunCounts(runId);
    expect(c).toMatchObject({ tong: 4, xong: 1, bo_qua: 1, loi: 1, cho: 1 });

    const run = await getRun(runId);
    expect(run?.da_phat_hien).toBe(4);
    expect(run?.da_nap).toBe(1);
    expect(run?.that_bai).toBe(1);
    expect(run?.bo_qua).toBe(1);

    const p = await runProgress(runId);
    expect(p?.tyLe).toBeCloseTo(0.5, 5);
    expect(p?.theoGiaiDoan.length).toBeGreaterThan(0);
  });

  test("đợt đang chạy tìm lại được theo tên, và pham_vi ghi bằng jsonb (không phải chuỗi)", async () => {
    const ten = `test:resume:${crypto.randomUUID()}`;
    const runId = await createRun({ ten, nguon: NGUON, phamVi: { nhom: "kiem_thu", da_day: ["o-1"] } });
    const found = await findActiveRun(ten);
    expect(found).toBeDefined();
    expect(found?.id).toBe(runId);
    expect(typeof found?.pham_vi).toBe("object");
    expect((found?.pham_vi as { da_day: string[] } | undefined)?.da_day).toEqual(["o-1"]);

    await updateRunScope(runId, { nhom: "kiem_thu", da_day: ["o-1", "o-2"] });
    const [row] = await sql`SELECT pham_vi FROM ingest_runs WHERE id = ${runId}`;
    expect((row as { pham_vi: { da_day: string[] } }).pham_vi.da_day).toEqual(["o-1", "o-2"]);

    await setRunState(runId, "hoan_thanh", "xong test");
    const done = await getRun(runId);
    expect(done?.trang_thai).toBe("hoan_thanh");
    expect(done?.ket_thuc).toBeTruthy();
    expect(await findActiveRun(ten)).toBeUndefined();
  });
});

describe("ngưỡng hoàn thành đợt", () => {
  test("completionRatio tính cả mục bỏ qua, đợt rỗng coi như xong", () => {
    expect(completionRatio({ tong: 0, xong: 0, bo_qua: 0 })).toBe(1);
    expect(completionRatio({ tong: 100, xong: 90, bo_qua: 5 })).toBeCloseTo(0.95, 5);
    expect(completionRatio({ tong: 100, xong: 90, bo_qua: 0 })).toBeCloseTo(0.9, 5);
  });

  test("waveRatio chỉ tính phần TĂNG THÊM của đợt, không bị đợt trước che", () => {
    // Đợt trước: 1000 mục, 950 xong. Đợt này vừa phát hiện 10 mục, chưa xong cái nào.
    const truoc = { tong: 1000, cho: 50, dang_chay: 0, xong: 950, loi: 0, bo_qua: 0 };
    const hienTai = { tong: 1010, cho: 60, dang_chay: 0, xong: 950, loi: 0, bo_qua: 0 };
    const w = waveRatio(truoc, hienTai);
    expect(w.tong).toBe(10);
    expect(w.xong).toBe(0);
    expect(w.tyLe).toBe(0);

    // Đợt này xong 19/20 (có 1 bỏ qua) -> đạt 95%.
    const sau = { tong: 1020, cho: 1, dang_chay: 0, xong: 968, loi: 0, bo_qua: 1 };
    const w2 = waveRatio(truoc, sau);
    expect(w2.tong).toBe(20);
    expect(w2.xong).toBe(19);
    expect(w2.tyLe).toBeCloseTo(0.95, 5);
    expect(w2.tyLe >= 0.95).toBe(true);

    // Chưa phát hiện được gì -> coi như 1 để không kẹt vĩnh viễn (điều kiện hàng đợi
    // rỗng do waitForWave kiểm tra riêng).
    expect(waveRatio(truoc, truoc).tyLe).toBe(1);
  });

  test("groupWaves gom theo ưu tiên, đợt ưu tiên nhỏ chạy trước", () => {
    const t = (ma: string, uu_tien: number): CorpusTargetRow => ({
      id: ma,
      ma,
      nhom: "x",
      uu_tien,
      doc_type: "nd",
      co_quan: null,
      nam_tu: null,
      nam_den: null,
      chi_con_hieu_luc: true,
      nguon: "congbao",
      so_luong_ky_vong: null,
      ghi_chu: null,
      tu_khoa: [],
      loai_tru: [],
    });
    const waves = groupWaves([t("c", 30), t("a", 10), t("b", 10)]);
    expect(waves.map((w) => w.uuTien)).toEqual([10, 30]);
    expect(waves[0]?.targets.map((x) => x.ma).sort()).toEqual(["a", "b"]);
  });
});
