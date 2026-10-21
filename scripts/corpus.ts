/**
 * Khung cấu trúc kho văn bản.
 *
 *   bun run scripts/corpus.ts nap          # nạp content/khung-van-ban.json vào CSDL
 *   bun run scripts/corpus.ts doi-soat     # so khung với thực tế, in độ phủ
 *   bun run scripts/corpus.ts ky-vong <ma> <so>   # đặt số lượng kỳ vọng cho một ô
 */
import { listTargets, loadCorpusFramework, reconcileCorpus, setExpected, sql } from "@qdpl/db";

const [cmd, ...rest] = process.argv.slice(2);
const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - s.length));

switch (cmd) {
  case "nap": {
    const n = await loadCorpusFramework();
    console.log(`Đã nạp ${n} ô của khung vào bảng corpus_targets.`);
    break;
  }
  case "doi-soat": {
    const nhom = rest[0];
    const rows = await reconcileCorpus(nhom);
    console.log(`Đối soát ${rows.length} ô${nhom ? ` thuộc nhóm ${nhom}` : ""}:\n`);
    console.log(`${pad("ô", 26)}${pad("nhóm", 18)}${pad("có", 8)}${pad("kỳ vọng", 10)}độ phủ`);
    for (const r of rows.sort((a, b) => a.uu_tien - b.uu_tien)) {
      const phu = r.ty_le === null ? "chưa biết" : `${(r.ty_le * 100).toFixed(0)}%`;
      console.log(
        `${pad(r.target_ma, 26)}${pad(r.nhom, 18)}${pad(String(r.so_luong_co), 8)}${pad(String(r.so_luong_ky_vong ?? "-"), 10)}${phu}`,
      );
    }
    const trong = rows.filter((r) => r.so_luong_co === 0);
    if (trong.length) {
      console.log(`\n${trong.length} ô chưa có dữ liệu: ${trong.map((r) => r.target_ma).join(", ")}`);
    }
    break;
  }
  case "ky-vong": {
    const [ma, so] = rest;
    if (!ma || !so) {
      console.error("Dùng: bun run scripts/corpus.ts ky-vong <ma-o> <so-luong>");
      process.exit(1);
    }
    await setExpected(ma, Number(so));
    console.log(`Đã đặt số lượng kỳ vọng của ô ${ma} = ${so}.`);
    break;
  }
  default: {
    const targets = await listTargets();
    console.log("Lệnh: nap | doi-soat [nhóm] | ky-vong <ma> <so>\n");
    console.log(`Khung hiện có ${targets.length} ô, theo nhóm:`);
    const g = new Map<string, number>();
    for (const t of targets) g.set(t.nhom, (g.get(t.nhom) ?? 0) + 1);
    for (const [k, v] of [...g.entries()].sort()) console.log(`  ${pad(k, 20)} ${v} ô`);
  }
}
await sql.end();
