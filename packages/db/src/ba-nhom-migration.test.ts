import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { sql } from "./client.ts";

const migration = (file: string) => readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8");
test("chuyển ba nhóm lưu snapshot, giữ lịch sử/quyền và không tự gán nhóm công an", async () => {
  const files = await Promise.all([
    migration("0078_mo_rong_nhom_ba_doi_tuong.sql"),
    migration("0079_chuyen_du_lieu_ba_nhom.sql"),
    migration("0080_chot_ba_nhom.sql"),
  ]);
  // Schema riêng: không đổi constraint hoặc dữ liệu fixture dùng chung của bộ test.
  const schema = `test_ba_nhom_${crypto.randomUUID().replaceAll("-", "")}`;
  await sql.begin(async (tx) => {
    await tx.unsafe(`CREATE SCHEMA "${schema}"`);
    await tx.unsafe(`SET LOCAL search_path TO "${schema}"`);
    await tx.unsafe(`CREATE TABLE accounts(id uuid primary key,role text,unit_id text,nhom_doi_tuong text[] NOT NULL,
      CONSTRAINT accounts_nhom_doi_tuong_check CHECK(nhom_doi_tuong <@ ARRAY['cong_an_cap_xa','cong_chuc_cap_xa','vien_chuc','dang_vien']::text[]));
      CREATE TABLE courses(id uuid primary key,status text,nhom_hoc_tap text[] NOT NULL,
      CONSTRAINT courses_nhom_hoc_tap_check CHECK(nhom_hoc_tap <@ ARRAY['cong_an_cap_xa','cong_chuc_cap_xa','vien_chuc','dang_vien']::text[]));
      CREATE TABLE progress(account_id uuid references accounts(id),course_id uuid references courses(id),score int);
      INSERT INTO accounts VALUES
      ('00000000-0000-0000-0000-000000000001','quan_ly','don-vi-goc',ARRAY['cong_chuc_cap_xa','dang_vien','cong_chuc_cap_xa']),
      ('00000000-0000-0000-0000-000000000002','can_bo','don-vi-goc',ARRAY['cong_an_cap_xa']),
      ('00000000-0000-0000-0000-000000000003','can_bo',NULL,'{}');
      INSERT INTO courses VALUES
      ('00000000-0000-0000-0000-000000000011','xuat_ban',ARRAY['cong_an_cap_xa']),
      ('00000000-0000-0000-0000-000000000012','xuat_ban',ARRAY['cong_an_cap_xa','cong_chuc_cap_xa','vien_chuc']);
      INSERT INTO progress VALUES('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011',87);`);
    for (const file of files) await tx.unsafe(file.replace(/^BEGIN;|^COMMIT;/gm, ""));
    const accounts = await tx`SELECT role,unit_id,nhom_doi_tuong FROM accounts ORDER BY id`;
    expect(accounts[0]).toMatchObject({
      role: "quan_ly",
      unit_id: "don-vi-goc",
      nhom_doi_tuong: ["cong_chuc", "dang_vien"],
    });
    expect(accounts[1]!.nhom_doi_tuong).toEqual([]);
    expect(accounts[2]!.nhom_doi_tuong).toEqual([]);
    const courses = await tx`SELECT status,nhom_hoc_tap FROM courses ORDER BY id`;
    expect(courses[0]).toMatchObject({ status: "xuat_ban", nhom_hoc_tap: [] });
    expect(courses[1]!.nhom_hoc_tap).toEqual(["cong_chuc", "vien_chuc"]);
    expect((await tx`SELECT score FROM progress`)[0]!.score).toBe(87);
    expect((await tx`SELECT count(*)::int AS n FROM audience_group_migration_history`)[0]!.n).toBe(4);
    await tx.unsafe(files[1]!.replace(/^BEGIN;|^COMMIT;/gm, ""));
    const backup =
      await tx`SELECT groups_before FROM audience_group_migration_history WHERE entity_kind='account' AND entity_id='00000000-0000-0000-0000-000000000001'`;
    expect(backup[0]!.groups_before).toEqual(["cong_chuc_cap_xa", "dang_vien", "cong_chuc_cap_xa"]);
    for (const group of ["cong_an_cap_xa", "cong_chuc_cap_xa"]) {
      await expect(
        tx.savepoint(async (sp) => sp`UPDATE accounts SET nhom_doi_tuong=ARRAY[${group}]`),
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        tx.savepoint(async (sp) => sp`UPDATE courses SET nhom_hoc_tap=ARRAY[${group}]`),
      ).rejects.toMatchObject({ code: "23514" });
    }
    await tx.unsafe(`DROP SCHEMA "${schema}" CASCADE`);
  });
});

test("lưu trữ đúng chuyên đề giao thông đã kiểm kê, giữ bài và tiến độ, không đoán theo tên", async () => {
  const file = (await migration("0082_luu_tru_chuyen_de_giao_thong_da_ra_soat.sql")).replace(
    /^BEGIN;|^COMMIT;/gm,
    "",
  );
  const schema = `test_pham_vi_${crypto.randomUUID().replaceAll("-", "")}`;
  await sql.begin(async (tx) => {
    await tx.unsafe(`CREATE SCHEMA "${schema}"`);
    await tx.unsafe(`SET LOCAL search_path TO "${schema}"`);
    await tx.unsafe(`CREATE TABLE courses(id uuid PRIMARY KEY,slug text,title text,status text,nhom_hoc_tap text[],updated_at timestamptz);
      CREATE TABLE audit_log(actor text,action text,target text,detail jsonb);
      CREATE TABLE progress(course_id uuid REFERENCES courses(id),score int);`);
    const slug = "thong-tu-13-2025-tt-bca-sua-doi-bo-sung-mot-so-dieu-cua-cac-thong-tu-q";
    const title =
      "Thông tư 13/2025/TT-BCA: Sửa đổi, bổ sung một số điều của các thông tư quy định về trật tự, an toàn giao thông đường bộ, đường sắt và đường thủy nội địa";
    const id = crypto.randomUUID();
    await tx`INSERT INTO courses VALUES(${id},${slug},${title},'xuat_ban',ARRAY['cong_chuc'],now()),
     (${crypto.randomUUID()},'chuyen-de-khac',${title},'xuat_ban',ARRAY['cong_chuc'],now())`;
    await tx`INSERT INTO progress VALUES(${id},90)`;
    await tx.unsafe(file);
    expect((await tx`SELECT status FROM courses WHERE id=${id}`)[0]!.status).toBe("luu_tru");
    expect((await tx`SELECT status FROM courses WHERE slug='chuyen-de-khac'`)[0]!.status).toBe("xuat_ban");
    expect((await tx`SELECT score FROM progress`)[0]!.score).toBe(90);
    const [log] = await tx`SELECT detail FROM audit_log`;
    expect(log!.detail).toMatchObject({ trang_thai_truoc: "xuat_ban", nhom_truoc: ["cong_chuc"] });
    await tx.unsafe(file);
    expect((await tx`SELECT count(*)::int AS n FROM audit_log`)[0]!.n).toBe(1);
    await tx.unsafe(`DROP SCHEMA "${schema}" CASCADE`);
  });
});
