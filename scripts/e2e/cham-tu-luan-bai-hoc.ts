/**
 * Kịch bản E2E giảng viên chấm tự luận của bài học, khung máy tính 1280×900:
 *  1. một bài tự luận AI chưa chấm được nằm trong hàng chấm, mở từ mục "Chấm tự luận" của menu quản trị;
 *  2. giảng viên chọn mức điểm từng tiêu chí, ghi nhận xét, chấm; bài rời hàng chấm;
 *  3. học viên mở lại bài học thấy điểm, đạt và nhận xét của giảng viên.
 */
import { datTrangThaiBaiHoc, datTrangThaiChuyenDe, luuBaiHoc, luuChuyenDe, luuHoatDong } from "@qdpl/db";
import type { NguCanhE2E } from "./chay.ts";

const rubric = {
  tieu_chi: [
    {
      ma: "can_cu",
      ten: "Căn cứ pháp lý",
      trong_so: 60,
      muc: [
        { diem: 0, mo_ta: "Không viện dẫn" },
        { diem: 4, mo_ta: "Viện dẫn đúng điều khoản" },
      ],
    },
    {
      ma: "noi_dung",
      ten: "Nội dung",
      trong_so: 40,
      muc: [
        { diem: 0, mo_ta: "Sai" },
        { diem: 4, mo_ta: "Đúng và đủ" },
      ],
    },
  ],
  nguong_dat: 50,
};

export default async function chamTuLuanBaiHoc(n: NguCanhE2E) {
  const ma = `e2e-cham-${crypto.randomUUID().slice(0, 8)}`;
  n.donDep(() => n.sql`DELETE FROM courses WHERE slug = ${ma}`);
  const baiViet = `Bài làm ${ma}: theo Điều 2, người lái xe phải mang theo giấy phép lái xe khi tham gia giao thông.`;
  const nhanXet = `Nhận xét ${ma}: viện dẫn đúng.`;

  const course = await luuChuyenDe({ slug: ma, title: `Chuyên đề ${ma}`, asOf: "2026-01-01" });
  await datTrangThaiChuyenDe(course.id, "xuat_ban");
  const bai = await luuBaiHoc({
    courseId: course.id,
    slug: "bai-1",
    ordinal: 1,
    title: `Bài ${ma}`,
    asOf: "2026-01-01",
  });
  await datTrangThaiBaiHoc(bai.id, "xuat_ban");
  const hd = await luuHoatDong({
    courseId: course.id,
    lessonId: bai.id,
    kind: "viet_co_can_cu",
    mode: "ai",
    title: "Tự luận E2E",
    prompt: { cau_hoi: `Câu hỏi ${ma}: nêu nghĩa vụ mang giấy phép lái xe.` },
    answer: { giai_thich: "Đáp án gợi ý E2E." },
    rubric,
    citations: [],
    points: 10,
    source: "nguoi",
  });

  const hocVien = await n.taoTaiKhoan({ ten: "Học viên chấm tự luận E2E" });
  const giangVien = await n.taoTaiKhoan({ role: "bien_tap", ten: "Giảng viên E2E" });
  const [gd] = await n.sql<Array<{ id: string }>>`
    INSERT INTO enrollments (account_id, course_id) VALUES (${hocVien.id}::uuid, ${course.id}::uuid) RETURNING id`;
  // Lượt AI không chấm được: điểm 0, chờ giảng viên (như POST /v1/dao-tao/hoat-dong/:id/nop ghi).
  await n.sql`
    INSERT INTO attempts (enrollment_id, activity_id, response, score, max_score, passed, feedback, graded_by, review_state)
    VALUES (${gd!.id}::uuid, ${hd.id}::uuid, ${n.sql.json({ bai_viet: baiViet })}, 0, 10, false,
            ${n.sql.json({ tom_tat: "AI chưa chấm được bài này. Bài đã được chuyển cho giảng viên chấm." })},
            'nguoi', 'cho_doi_chieu')`;

  // 1–2. Giảng viên chấm.
  const page = await n.moTrang({ width: 1280, height: 900 });
  const loiTrang: string[] = [];
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await n.dangNhap(page, giangVien);
  await page.goto(`${n.web}/quan-tri`);
  await Promise.all([
    page.waitForURL((u) => u.pathname === "/quan-tri/cham-tu-luan"),
    page
      .getByRole("navigation", { name: "Điều hướng quản trị" })
      .getByRole("link", { name: "Chấm tự luận", exact: true })
      .click(),
  ]);
  const the = page.locator("li", { hasText: baiViet });
  await the.getByText("AI chưa chấm được. Học viên đang chờ điểm.").waitFor();
  await the.getByText(`Câu hỏi ${ma}`).waitFor();
  await n.kiemKhongCuonNgang(page, "hàng chấm tự luận bài học");
  await n.chupAnh(page, "hang-cham");
  // Mức cao nhất của từng tiêu chí (ô 0 là "Chọn mức").
  await the.getByLabel("Căn cứ pháp lý (trọng số 60)").selectOption({ index: 2 });
  await the.getByLabel("Nội dung (trọng số 40)").selectOption({ index: 2 });
  await the.getByLabel("Nhận xét cho học viên (không bắt buộc)").fill(nhanXet);
  await the.getByRole("button", { name: "Chấm bài này" }).click();
  await page.getByText("Đã chấm: 10/10 điểm, đạt.").waitFor();
  await the.waitFor({ state: "detached" });
  await n.chupAnh(page, "da-cham");

  const [luot] = await n.sql<Array<{ reviewer_score: string; passed: boolean; review_state: string }>>`
    SELECT reviewer_score, passed, review_state FROM attempts WHERE enrollment_id = ${gd!.id}::uuid`;
  if (Number(luot?.reviewer_score) !== 10 || !luot?.passed || luot.review_state !== "da_doi_chieu") {
    throw new Error(`Lượt sau khi chấm không đúng: ${JSON.stringify(luot)}`);
  }

  // Công tắc đầu trang sang hàng chấm của đề thi (dùng chung form chấm): hai tab mở được, rồi quay lại.
  const nguon = page.getByRole("navigation", { name: "Nguồn bài chấm" });
  await Promise.all([
    page.waitForURL((u) => u.pathname === "/quan-tri/cham-tu-luan/de-thi"),
    nguon.getByRole("link", { name: "Đề thi", exact: true }).click(),
  ]);
  await page.getByRole("link", { name: "AI đã chấm", exact: true }).click();
  await page.waitForURL((u) => u.searchParams.get("che_do") === "da_cham_ai");
  await n.chupAnh(page, "de-thi");
  await Promise.all([
    page.waitForURL((u) => u.pathname === "/quan-tri/cham-tu-luan"),
    nguon.getByRole("link", { name: "Bài giảng", exact: true }).click(),
  ]);

  // 3. Học viên thấy điểm của giảng viên ở trang bài.
  const trangHoc = await n.moTrang({ width: 1280, height: 900 });
  trangHoc.on("pageerror", (e) => loiTrang.push(e.message));
  await n.dangNhap(trangHoc, hocVien);
  await trangHoc.goto(`${n.web}/hoc/${ma}/bai-1`);
  await trangHoc.getByText("Đạt: 10/10 điểm").waitFor();
  await trangHoc.getByText("Giảng viên đã chấm. Đây là điểm cuối cùng.").waitFor();
  await trangHoc.getByText(nhanXet).waitFor();
  await trangHoc.getByText("Căn cứ pháp lý: 4/4").waitFor();
  await n.chupAnh(trangHoc, "hoc-vien");

  if (loiTrang.length) throw new Error(`Trang có lỗi JavaScript: ${loiTrang.join("; ")}`);
}
