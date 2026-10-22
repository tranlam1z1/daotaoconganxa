/**
 * Kịch bản E2E thống kê lấy cán bộ làm trung tâm:
 *  1. /quan-tri (Tổng quan): ô số cán bộ, thẻ "Chưa học lần nào" có người chưa học, bấm tên mở hồ sơ;
 *  2. /quan-tri/bao-cao mở sẵn tab "Cán bộ", tìm theo tên, bấm tên mở hồ sơ của người đó;
 *  3. hồ sơ có đủ bốn phần, bài thi ghi đúng kết quả, tải được Excel và PDF;
 *  4. tab "Báo cáo tổng hợp" có đủ bốn báo cáo cũ;
 *  5. cán bộ quản lý đội khác mở hồ sơ thì gặp trang "Không đủ quyền";
 *  6. ba trang không cuộn ngang trên khung điện thoại 360×740.
 *
 * Tự tạo đơn vị, tài khoản, đề thi và câu hỏi riêng (tiền tố e2e-), không phụ thuộc dữ liệu seed.
 */
import { taoDonVi } from "@qdpl/db";
import { type NguCanhE2E, TIEN_TO } from "./chay.ts";

export default async function baoCaoCanBo(n: NguCanhE2E) {
  const ma = `${TIEN_TO}bccb-${crypto.randomUUID().slice(0, 6)}`;
  const { sql } = n;

  // Dọn theo thứ tự ngược: tài khoản (taoTaiKhoan tự xóa) trước, rồi đề, câu hỏi, đơn vị.
  n.donDep(async () => {
    await sql`DELETE FROM exams WHERE title LIKE ${`${ma}%`}`;
    await sql`DELETE FROM questions WHERE code LIKE ${`${ma}%`}`;
    await sql`DELETE FROM question_topics WHERE code LIKE ${`${ma}%`}`;
    await sql`DELETE FROM audit_log WHERE actor LIKE ${`${TIEN_TO}%`} AND action = 'bao_cao.xuat'`;
    for (const cap of [2, 1])
      await sql`DELETE FROM units WHERE code LIKE ${`${ma}%`} AND nlevel(path) = ${cap}`;
  });

  const phong = await taoDonVi({ code: `${ma}-P`, name: "Phòng thử thống kê" }, ma);
  const doi1 = await taoDonVi({ code: `${ma}-1`, name: "Đội thử số 1", parentId: phong.id }, ma);
  const doi2 = await taoDonVi({ code: `${ma}-2`, name: "Đội thử số 2", parentId: phong.id, ordinal: 1 }, ma);

  const quanLy = await n.taoTaiKhoan({ role: "quan_ly", ten: "Đội trưởng Thử Một" });
  const quanLyKhac = await n.taoTaiKhoan({ role: "quan_ly", ten: "Đội trưởng Thử Hai" });
  const daHoc = await n.taoTaiKhoan({ ten: "Nguyễn Văn Đã Học" });
  const chuaHoc = await n.taoTaiKhoan({ ten: "Trần Thị Chưa Học" });
  await sql`UPDATE accounts SET unit_id = ${doi1.id}, rank_title = 'Đại úy', so_hieu = '123-456'
            WHERE id IN ${sql([quanLy.id, daHoc.id, chuaHoc.id])}`;
  await sql`UPDATE accounts SET unit_id = ${doi2.id} WHERE id = ${quanLyKhac.id}`;

  // Một đề giao cho Đội 1; người "đã học" nộp một lượt 80 điểm (đạt) và luyện tập 2 câu, đúng 1.
  const [de] = await sql<Array<{ id: string }>>`
    INSERT INTO exams (title, matrix, question_count, duration_minutes, pass_score, status, published_at)
    VALUES (${`${ma} Đề sát hạch thử`}, '[]', 30, 45, 70, 'xuat_ban', now())
    RETURNING id`;
  const [giao] = await sql<Array<{ id: string }>>`
    INSERT INTO exam_assignments (exam_id, unit_id, include_subunits, opens_at, due_at, assigned_by)
    VALUES (${de!.id}, ${doi1.id}, true, now() - interval '2 days', now() + interval '5 days', ${ma})
    RETURNING id`;
  await sql`
    INSERT INTO exam_attempts (exam_id, assignment_id, account_id, attempt_no, items, started_at, deadline_at,
                               submitted_at, submit_kind, correct, total, score, passed, status)
    VALUES (${de!.id}, ${giao!.id}, ${daHoc.id}, 1, '[]', now() - interval '3 hours', now() - interval '2 hours',
            now() - interval '150 minutes', 'nguoi_thi', 24, 30, 80, true, 'da_nop')`;
  const [chuDe] = await sql<Array<{ id: string }>>`
    INSERT INTO question_topics (code, name) VALUES (${`${ma}-cd`}, 'Chủ đề thử thống kê') RETURNING id`;
  const [phien] = await sql<Array<{ id: string }>>`
    INSERT INTO practice_sessions (account_id, topic_id, total, started_at, finished_at)
    VALUES (${daHoc.id}, ${chuDe!.id}, 2, now() - interval '1 hour', now() - interval '50 minutes')
    RETURNING id`;
  // Mỗi câu chỉ trả lời được một lần trong một phiên, nên tạo hai câu.
  for (const [i, dung] of [true, false].entries()) {
    const [cau] = await sql<Array<{ id: string }>>`
      INSERT INTO questions (code, topic_id, level, kind, stem, options, answer, explanation, status)
      VALUES (${`${ma}-${i + 1}`}, ${chuDe!.id}, 'de', 'dung_sai', ${`Câu thử thống kê ${i + 1}`}, '{}',
              ${sql.json({ dung: ["dung"] })}, 'Giải thích.', 'da_duyet')
      RETURNING id`;
    await sql`
      INSERT INTO practice_answers (session_id, question_id, question_version, correct, created_at)
      VALUES (${phien!.id}, ${cau!.id}, 1, ${dung}, now() - interval '55 minutes')`;
  }

  const page = await n.moTrang({ width: 1280, height: 900 });
  await n.dangNhap(page, quanLy);

  /* 1. Tổng quan */
  await page.goto(`${n.web}/quan-tri`);
  await page.getByRole("heading", { name: "Tổng quan", exact: true }).waitFor();
  const chu = (await page.locator("main, body").first().innerText()).replace(/\s+/g, " ");
  if (!chu.includes("Phạm vi: Đội thử số 1"))
    throw new Error("Tổng quan: không ghi phạm vi là Đội thử số 1.");
  // Đội 1 có 2 cán bộ và đội trưởng.
  const oCanBo = page.locator("dl > div", { hasText: "Cán bộ" }).first().locator("dd").first();
  if ((await oCanBo.innerText()).trim() !== "3") {
    throw new Error(`Tổng quan: ô Cán bộ ghi ${await oCanBo.innerText()}, chờ 3.`);
  }
  const theChuaHoc = page
    .locator("div", { has: page.getByRole("heading", { name: /Chưa học lần nào/ }) })
    .last();
  await theChuaHoc.getByRole("link", { name: "Trần Thị Chưa Học" }).waitFor();
  if (await theChuaHoc.getByRole("link", { name: "Nguyễn Văn Đã Học" }).count()) {
    throw new Error("Tổng quan: người đã học lại nằm trong thẻ Chưa học lần nào.");
  }
  await n.chupAnh(page, "1-tong-quan");
  await theChuaHoc.getByRole("link", { name: "Trần Thị Chưa Học" }).click();
  await page.waitForURL(new RegExp(`/quan-tri/bao-cao/can-bo/${chuaHoc.id}`));
  await page.getByRole("heading", { name: "Trần Thị Chưa Học" }).waitFor();
  await page.getByText("Chưa làm", { exact: true }).waitFor();

  /* 2. Danh sách cán bộ */
  await page.goto(`${n.web}/quan-tri/bao-cao`);
  const tabCanBo = page
    .getByRole("navigation", { name: "Loại báo cáo" })
    .getByRole("link", { name: "Cán bộ" });
  if ((await tabCanBo.getAttribute("aria-current")) !== "page") {
    throw new Error("Báo cáo: tab Cán bộ không phải tab mở đầu.");
  }
  await page.getByRole("link", { name: "Nguyễn Văn Đã Học" }).waitFor();
  await n.chupAnh(page, "2-danh-sach");
  await page.getByLabel("Tìm cán bộ").fill("Đã Học");
  await page.getByRole("button", { name: "Xem báo cáo" }).click();
  await page.waitForURL(/q=/);
  if (await page.getByRole("link", { name: "Trần Thị Chưa Học" }).count()) {
    throw new Error("Báo cáo: tìm theo tên không lọc được danh sách.");
  }
  await page.getByRole("link", { name: "Nguyễn Văn Đã Học" }).click();
  await page.waitForURL(new RegExp(`/quan-tri/bao-cao/can-bo/${daHoc.id}`));

  /* 3. Hồ sơ */
  await page.getByRole("heading", { name: "Nguyễn Văn Đã Học" }).waitFor();
  for (const phan of ["Bài thi", "Bài học", "Luyện tập"]) {
    await page.getByRole("heading", { name: phan, exact: true }).waitFor();
  }
  const dongDe = page.getByRole("row", { name: new RegExp(`${ma} Đề sát hạch thử`) });
  const chuDong = (await dongDe.innerText()).replace(/\s+/g, " ");
  for (const co of ["Đạt", "80", "24/30"]) {
    if (!chuDong.includes(co)) throw new Error(`Hồ sơ: dòng đề thi thiếu "${co}": ${chuDong}`);
  }
  await page.getByRole("row", { name: /Chủ đề thử thống kê/ }).waitFor();
  await n.chupAnh(page, "3-ho-so");
  for (const [nut, loai] of [
    ["Tải Excel", "spreadsheetml"],
    ["Tải PDF", "application/pdf"],
  ] as const) {
    const href = await page.getByRole("link", { name: nut }).getAttribute("href");
    const res = await page.request.get(`${n.web}${href}`);
    const ct = res.headers()["content-type"] ?? "";
    if (res.status() !== 200 || !ct.includes(loai)) {
      throw new Error(`Hồ sơ: ${nut} trả ${res.status()} ${ct}.`);
    }
    if ((await res.body()).length < 1000) throw new Error(`Hồ sơ: tệp ${nut} quá nhỏ.`);
  }
  await page.getByRole("link", { name: "Danh sách cán bộ" }).click();
  await page.waitForURL(/\/quan-tri\/bao-cao(\?|$)/);

  /* 4. Báo cáo tổng hợp */
  await page.getByRole("link", { name: "Báo cáo tổng hợp" }).click();
  const tongHop = page.getByRole("navigation", { name: "Báo cáo tổng hợp" });
  for (const ten of ["Kết quả đề thi", "Tổng hợp đơn vị", "Luyện tập", "Câu hỏi khó"]) {
    await tongHop.getByRole("link", { name: ten, exact: true }).waitFor();
  }
  await n.chupAnh(page, "4-tong-hop");

  /* 5. Ngoài phạm vi */
  const trangKhac = await n.moTrang({ width: 1280, height: 900 });
  await n.dangNhap(trangKhac, quanLyKhac);
  const res = await trangKhac.goto(`${n.web}/quan-tri/bao-cao/can-bo/${daHoc.id}`);
  if (res?.status() !== 403) throw new Error(`Ngoài phạm vi: chờ 403, nhận ${res?.status()}.`);
  if (await trangKhac.getByText("Nguyễn Văn Đã Học").count()) {
    throw new Error("Ngoài phạm vi: trang vẫn lộ tên cán bộ.");
  }

  /* 6. Điện thoại */
  const dt = await n.moTrang();
  await n.dangNhap(dt, quanLy);
  for (const [duong, noi] of [
    ["/quan-tri", "Tổng quan"],
    ["/quan-tri/bao-cao", "Danh sách cán bộ"],
    [`/quan-tri/bao-cao/can-bo/${daHoc.id}`, "Hồ sơ cán bộ"],
  ] as const) {
    await dt.goto(`${n.web}${duong}`);
    await dt.getByRole("heading", { level: 2 }).first().waitFor();
    await n.kiemKhongCuonNgang(dt, `${noi} (điện thoại)`);
  }
  await n.chupAnh(dt, "6-ho-so-dien-thoai");
}
