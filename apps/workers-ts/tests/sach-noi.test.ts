/**
 * Worker sách nói (docs/PLAN.md GĐ14) trên Postgres test thật, Vbee và kho đối tượng là bản giả
 * trong bộ nhớ có bộ đếm lượt gọi. Dữ liệu mang tiền tố riêng và được dọn sau khi chạy.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { amThanhCuaBai, sql } from "@qdpl/db";
import { dungSachNoiBai, type NguonDoc } from "../src/bull/workers/sach-noi.ts";

const PREFIX = "test-sach-noi";
let baiId = "";
let baiHai = "";

function nguonGia() {
  const kho = new Map<string, Uint8Array>();
  const dem = { doc: 0 };
  const nguon: NguonDoc = {
    khoa: (loi) => createHash("sha256").update(`giong-thu|${loi}`).digest("hex"),
    doc: async (loi) => {
      dem.doc += 1;
      // 16 000 byte ở 128 kbps là 1 giây.
      return new Uint8Array(16_000 * Math.max(1, Math.ceil(loi.length / 50)));
    },
    coSan: async (uri) => kho.has(uri),
    lay: async (uri) => kho.get(uri)!,
    luu: async (uri, mp3) => {
      kho.set(uri, mp3);
    },
  };
  return { nguon, dem, kho };
}

async function donDep() {
  await sql`DELETE FROM courses WHERE slug LIKE ${`${PREFIX}%`}`;
}

beforeAll(async () => {
  await donDep();
  const [c] = (await sql`
    INSERT INTO courses (slug, title, status, as_of) VALUES (${`${PREFIX}-cd`}, 'Chuyên đề thử sách nói', 'xuat_ban', '2026-09-01')
    RETURNING id`) as any[];
  const ids: string[] = [];
  for (const [i, slug] of ["bai-1", "bai-2"].entries()) {
    const [l] = (await sql`
      INSERT INTO lessons (course_id, slug, ordinal, title, status, body_md)
      VALUES (${c.id}, ${slug}, ${i + 1}, ${`Bài thử ${i + 1}`}, 'xuat_ban', '') RETURNING id`) as any[];
    ids.push(l.id);
  }
  [baiId, baiHai] = ids as [string, string];
  await sql`
    INSERT INTO lesson_blocks (lesson_id, ordinal, kind, data, status) VALUES
      (${baiId}, 1, 'giang', ${sql.json({ md: `${PREFIX}: người lái xe **phải** giảm tốc độ.` })}, 'xuat_ban'),
      (${baiId}, 2, 'video', ${sql.json({ nguon: "x.mp4" })}, 'xuat_ban'),
      (${baiId}, 3, 'tom_tat', ${sql.json({ y: [`${PREFIX} ý một`, "Ý hai"] })}, 'xuat_ban')`;
  // Bài hai có một khối trùng lời với bài một: dùng lại tệp, không đọc lại.
  await sql`
    INSERT INTO lesson_blocks (lesson_id, ordinal, kind, data, status) VALUES
      (${baiHai}, 1, 'giang', ${sql.json({ md: `${PREFIX}: người lái xe **phải** giảm tốc độ.` })}, 'xuat_ban')`;
});
afterAll(donDep);

describe("dựng sách nói", () => {
  test("lần đầu đọc đủ các khối đọc được, bỏ khối video; lần hai không gọi lại Vbee", async () => {
    const { nguon, dem, kho } = nguonGia();

    const lan1 = await dungSachNoiBai(baiId, nguon);
    expect(lan1).toMatchObject({ so_khoi: 2, goi_moi: 2, khong_doi: 0 });
    expect(dem.doc).toBe(2);
    expect(kho.size).toBe(2);
    const ds = await amThanhCuaBai(baiId);
    expect(ds.map((a) => a.ordinal)).toEqual([1, 3]);
    for (const a of ds) {
      expect(a.uri).toStartWith("giong-doc/");
      expect(Number(a.seconds)).toBeGreaterThan(0);
    }

    const lan2 = await dungSachNoiBai(baiId, nguon);
    expect(lan2).toMatchObject({ so_khoi: 2, goi_moi: 0, khong_doi: 2 });
    expect(dem.doc).toBe(2);
  });

  test("lời trùng ở bài khác dùng lại tệp đã có", async () => {
    const { nguon, dem } = nguonGia();
    const kq = await dungSachNoiBai(baiHai, nguon);
    expect(kq).toMatchObject({ so_khoi: 1, goi_moi: 0, dung_lai: 1 });
    expect(dem.doc).toBe(0);
  });

  test("sửa lời một khối thì chỉ đọc lại khối đó; khối không còn đọc được thì bỏ bản đọc", async () => {
    const { nguon, dem } = nguonGia();
    await sql`
      UPDATE lesson_blocks SET data = ${sql.json({ y: [`${PREFIX} ý một đã sửa`] })}
      WHERE lesson_id = ${baiId} AND ordinal = 3`;
    const kq = await dungSachNoiBai(baiId, nguon);
    expect(kq).toMatchObject({ goi_moi: 1, khong_doi: 1 });
    expect(dem.doc).toBe(1);

    // Xóa khối thì CSDL tự xóa bản đọc (ON DELETE CASCADE); đổi sang loại không đọc thì worker bỏ.
    await sql`
      UPDATE lesson_blocks SET kind = 'video', data = ${sql.json({ nguon: "y.mp4" })}
      WHERE lesson_id = ${baiId} AND ordinal = 3`;
    const sauXoa = await dungSachNoiBai(baiId, nguon);
    expect(sauXoa).toMatchObject({ so_khoi: 1, bo: 1 });
    expect((await amThanhCuaBai(baiId)).length).toBe(1);
    expect(dem.doc).toBe(1);
  });
});
