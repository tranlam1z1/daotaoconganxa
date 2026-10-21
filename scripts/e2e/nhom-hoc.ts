/**
 * Kịch bản E2E nhóm học cùng (docs/PLAN.md GĐ16b) trên khung điện thoại 360×740.
 *
 * A tạo nhóm bằng bàn phím, sao chép liên kết mời; B chưa đăng nhập mở liên kết, đăng nhập, tham
 * gia. A chia sẻ một bài học và một đề ôn tập 5 câu; B học xong bài; A thấy phần trăm chung của B
 * là 50. A cổ vũ B, B thấy 1 lượt; A bấm lại thì về 0. Mọi trang và mọi hộp thoại: không cuộn
 * ngang, nút cao ≥ 48px. Esc đóng hộp và trả tiêu điểm; giảm chuyển động thì hộp chỉ hiện dần, không phóng to.
 *
 * Tự tạo chuyên đề, bài học, chủ đề 5 câu đã duyệt riêng, để kết quả không phụ thuộc dữ liệu seed.
 */
import { createSession } from "@qdpl/auth";
import type { Page } from "playwright-core";
import { type NguCanhE2E, TIEN_TO } from "./chay.ts";

/** Mọi nút, liên kết, ô chọn trong vùng nhóm (hoặc hộp thoại đang mở) cao ≥ 48px. */
async function kiemNut48(page: Page, noi: string) {
  const thap = await page.evaluate(() => {
    const goc = document.querySelector("dialog[open]") ?? document.querySelector("[data-nhom]");
    if (!goc) return ["không thấy vùng nhóm học cùng"];
    return [...goc.querySelectorAll("button, a[href], input[type=checkbox], input[type=radio]")]
      .map((e) => {
        // offsetHeight: chiều cao bố cục, không tính phép phóng to lúc hộp thoại đang mở dần.
        const r = e.getBoundingClientRect();
        const cao = (e as HTMLElement).offsetHeight;
        const vung = (e.closest("label") as HTMLElement | null)?.offsetHeight ?? 0;
        const ten = (e.getAttribute("aria-label") ?? e.textContent ?? "").trim().slice(0, 40);
        return { ten, cao: Math.max(cao, vung), hien: r.width > 0 && r.height > 0 };
      })
      .filter((x) => x.hien && x.cao < 47.5)
      .map((x) => `${x.ten || "(không nhãn)"} ${x.cao.toFixed(0)}px`);
  });
  if (thap.length) throw new Error(`${noi}: vùng chạm thấp hơn 48px: ${thap.join("; ")}`);
}

/** Chữ trong nút không tràn khỏi nút (nút mặc định không xuống dòng). */
async function kiemChuTrongNut(page: Page, noi: string) {
  const tran = await page.evaluate(() => {
    const goc = document.querySelector("dialog[open]") ?? document.querySelector("[data-nhom]");
    return [...(goc?.querySelectorAll("button, a[href]") ?? [])]
      .filter((e) => e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1)
      .map((e) => (e.textContent ?? "").trim().slice(0, 40));
  });
  if (tran.length) throw new Error(`${noi}: chữ tràn khỏi nút: ${tran.join("; ")}`);
}

/**
 * Chữ nội dung ≥ 16px. Dòng phụ khai rõ bằng lớp `text-sm`, `text-xs` (loại mục, số thành viên,
 * nhãn ô nhập, nhãn nút nhỏ) được bỏ qua, như các trang có sẵn.
 */
async function kiemCoChu(page: Page, noi: string) {
  const nho = await page.evaluate(() => {
    const goc = document.querySelector("dialog[open]") ?? document.querySelector("[data-nhom]");
    const laPhu = (e: Element) => Boolean(e.closest(".text-sm, .text-xs, .sr-only"));
    return [...(goc?.querySelectorAll("h1, h2, h3, p, li, span, a, label, button, legend") ?? [])]
      .filter((e) => [...e.childNodes].some((c) => c.nodeType === 3 && (c.textContent ?? "").trim()))
      .filter((e) => !laPhu(e) && (e as HTMLElement).offsetWidth > 0)
      .filter((e) => Number.parseFloat(getComputedStyle(e).fontSize) < 15.9)
      .map((e) => `${(e.textContent ?? "").trim().slice(0, 30)} ${getComputedStyle(e).fontSize}`);
  });
  if (nho.length) throw new Error(`${noi}: chữ nội dung dưới 16px: ${nho.join("; ")}`);
}

async function kiemBoCuc(n: NguCanhE2E, page: Page, noi: string) {
  await n.kiemKhongCuonNgang(page, noi);
  await kiemNut48(page, noi);
  await kiemChuTrongNut(page, noi);
  await kiemCoChu(page, noi);
}

/** Bấm Tab nhiều lần: tiêu điểm không rời hộp thoại đang mở (ra thanh trình duyệt thì là body). */
async function kiemTabTrongHop(page: Page, lan: number, noi: string) {
  for (let i = 0; i < lan; i++) {
    await page.keyboard.press("Tab");
    const trong = await page.evaluate(
      () =>
        document.activeElement === document.body || Boolean(document.activeElement?.closest("dialog[open]")),
    );
    if (!trong) throw new Error(`${noi}: lần Tab thứ ${i + 1} đưa tiêu điểm ra ngoài hộp thoại.`);
  }
}

/** Trang phía sau bị khóa cuộn khi hộp mở, và hết khóa khi đóng. */
async function kiemKhoaCuon(page: Page, can: boolean, noi: string) {
  // Sự kiện close của <dialog> chạy ở lượt xử lý sau khi hộp ẩn: chờ tối đa 2 giây.
  await page
    .waitForFunction((c) => (getComputedStyle(document.documentElement).overflow === "hidden") === c, can, {
      timeout: 2000,
    })
    .catch(() => {
      throw new Error(`${noi}: cuộn nền ${can ? "không khóa" : "vẫn khóa"}.`);
    });
}

/** Bấm Tab cho tới khi tiêu điểm vào phần tử có `id` (chỉ dùng bàn phím). */
async function tabToi(page: Page, id: string, noi: string) {
  for (let i = 0; i < 6; i++) {
    if (await page.evaluate((x) => document.activeElement?.id === x, id)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`${noi}: bấm Tab không tới được ô #${id}.`);
}

/** Tiêu điểm đang ở phần tử có chữ `chu`. */
async function kiemTieuDiem(page: Page, chu: string, noi: string) {
  const dang = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
  if (!dang.includes(chu)) throw new Error(`${noi}: tiêu điểm ở "${dang}", cần ở "${chu}".`);
}

export default async function nhomHoc(n: NguCanhE2E) {
  const ma = `${TIEN_TO}nhom-hoc-${crypto.randomUUID().slice(0, 8)}`;
  const tenBai = `Bài nhóm học E2E ${ma.slice(-8)}`;
  const tenChuDe = `Chủ đề nhóm học E2E ${ma.slice(-8)}`;
  const tenNhom = `Nhóm E2E ${ma.slice(-8)}`;

  // Dữ liệu riêng: một chuyên đề xuất bản có một bài hai khối, một chủ đề có 5 câu đã duyệt.
  const [c] = await n.sql<Array<{ id: string }>>`
    INSERT INTO courses (slug, title, status, as_of)
    VALUES (${ma}, 'Chuyên đề nhóm học E2E', 'xuat_ban', '2026-09-01') RETURNING id`;
  n.donDep(() => n.sql`DELETE FROM courses WHERE id = ${c!.id}`);
  const [l] = await n.sql<Array<{ id: string }>>`
    INSERT INTO lessons (course_id, slug, ordinal, title, status)
    VALUES (${c!.id}, 'bai-1', 1, ${tenBai}, 'xuat_ban') RETURNING id`;
  await n.sql`
    INSERT INTO lesson_blocks (lesson_id, ordinal, kind, data, status)
    VALUES (${l!.id}, 1, 'giang', ${n.sql.json({ md: "Nội dung bài thử nhóm học." })}, 'xuat_ban'),
           (${l!.id}, 2, 'tom_tat', ${n.sql.json({ y: ["Ý một", "Ý hai"] })}, 'xuat_ban')`;
  const [t] = await n.sql<Array<{ id: string }>>`
    INSERT INTO question_topics (code, name) VALUES (${ma}, ${tenChuDe}) RETURNING id`;
  n.donDep(() => n.sql`DELETE FROM question_topics WHERE id = ${t!.id}`);
  n.donDep(() => n.sql`DELETE FROM questions WHERE code LIKE ${`${ma}-%`}`);
  for (let i = 1; i <= 5; i++) {
    await n.sql`
      INSERT INTO questions (code, topic_id, level, kind, stem, options, answer, explanation, status)
      VALUES (${`${ma}-${i}`}, ${t!.id}, 'de', 'dung_sai', ${`Nhận định nhóm học E2E số ${i}`}, '{}',
              ${n.sql.json({ dung: ["dung"] })}, 'Giải thích.', 'da_duyet')`;
  }

  const a = await n.taoTaiKhoan({ ten: "Cán bộ A nhóm E2E" });
  const b = await n.taoTaiKhoan({ ten: "Cán bộ B nhóm E2E" });
  // Chạy trước khi xóa tài khoản: study_groups.owner_account_id là RESTRICT.
  n.donDep(
    () => n.sql`
      DELETE FROM study_groups WHERE id IN (
        SELECT group_id FROM study_group_members WHERE account_id IN (${a.id}, ${b.id}))`,
  );

  // 1. A: trang trống, hộp "Tham gia nhóm" mở bằng bàn phím, Esc đóng và trả tiêu điểm.
  const pa = await n.moTrang();
  await n.dangNhap(pa, a);
  await pa.goto(`${n.web}/nhom`);
  await pa.getByText("Bạn chưa ở trong nhóm nào").waitFor();
  await kiemBoCuc(n, pa, "Trang /nhom khi chưa có nhóm");
  await n.chupAnh(pa, "1-chua-co-nhom");

  await pa.getByRole("button", { name: "Nhập mã mời" }).focus();
  await pa.keyboard.press("Enter");
  const hopMa = pa.getByRole("dialog", { name: "Tham gia nhóm" });
  await hopMa.waitFor();
  await kiemBoCuc(n, pa, "Hộp Tham gia nhóm");
  await kiemKhoaCuon(pa, true, "Hộp Tham gia nhóm đang mở");
  await pa.keyboard.press("Escape");
  await hopMa.waitFor({ state: "hidden" });
  await kiemTieuDiem(pa, "Nhập mã mời", "Sau khi Esc đóng hộp Tham gia nhóm");
  await kiemKhoaCuon(pa, false, "Sau khi đóng hộp Tham gia nhóm");

  // 2. A tạo nhóm bằng bàn phím: Enter mở hộp, Tab tới ô tên, Enter gửi.
  await pa.getByRole("button", { name: "Tạo nhóm" }).focus();
  await pa.keyboard.press("Enter");
  await pa.getByRole("dialog", { name: "Tạo nhóm" }).waitFor();
  await kiemBoCuc(n, pa, "Hộp Tạo nhóm");
  await kiemTabTrongHop(pa, 8, "Hộp Tạo nhóm");
  await tabToi(pa, "ten-nhom", "Hộp Tạo nhóm");
  await pa.keyboard.type(tenNhom);
  await pa.keyboard.press("Enter");
  const hopXong = pa.getByRole("dialog", { name: "Đã tạo nhóm" });
  await hopXong.waitFor();
  await hopXong.getByRole("button", { name: "Sao chép liên kết mời" }).click();
  await hopXong.getByRole("status").waitFor();
  const lienKet = await hopXong.getByLabel("Liên kết mời").inputValue();
  if (!/\/nhom\/tham-gia\/[2-9A-HJKMNP-Z]{8}$/.test(lienKet))
    throw new Error(`Liên kết mời sai dạng: ${lienKet}`);
  await kiemBoCuc(n, pa, "Hộp Đã tạo nhóm");
  await n.chupAnh(pa, "2-da-tao-nhom");
  await Promise.all([
    pa.waitForURL(/\/nhom\/[0-9a-f-]{36}$/),
    hopXong.getByRole("link", { name: "Mở nhóm" }).click(),
  ]);
  const trangNhom = pa.url();

  // 3. B chưa đăng nhập mở liên kết: chuyển sang đăng nhập rồi quay lại trang tham gia.
  const pb = await n.moTrang();
  await pb.goto(lienKet);
  await pb.waitForURL(/\/dang-nhap/);
  await pb.fill('input[name="ten_dang_nhap"]', b.username);
  await pb.fill('input[name="mat_khau"]', b.password);
  await Promise.all([
    pb.waitForURL(/\/nhom\/tham-gia\//),
    pb.locator('form:has(input[name="ten_dang_nhap"]) button[type="submit"]').click(),
  ]);
  await pb.getByText("không thấy điểm", { exact: false }).waitFor();
  await pb.getByText(tenNhom).waitFor();
  await kiemBoCuc(n, pb, "Trang tham gia nhóm");
  await n.chupAnh(pb, "3-tham-gia");
  await Promise.all([
    pb.waitForURL(/\/nhom\/[0-9a-f-]{36}$/),
    pb.getByRole("button", { name: "Tham gia nhóm" }).click(),
  ]);

  // 4. A chia sẻ một bài học và một đề ôn tập 5 câu.
  await pa.goto(trangNhom);
  await kiemBoCuc(n, pa, "Trang nhóm khi chưa có bài");
  await pa.getByRole("button", { name: "Chia sẻ vào nhóm" }).click();
  const hopChiaSe = pa.getByRole("dialog", { name: "Chia sẻ vào nhóm" });
  await hopChiaSe.waitFor();
  await hopChiaSe.getByRole("searchbox").fill(tenBai);
  await hopChiaSe.getByRole("button", { name: "Tìm" }).click();
  await hopChiaSe.getByText(tenBai).click();
  await kiemBoCuc(n, pa, "Hộp Chia sẻ vào nhóm (bài học)");
  await n.chupAnh(pa, "4-chia-se-bai");
  await hopChiaSe.getByRole("button", { name: "Chia sẻ bài học" }).click();
  await hopChiaSe.waitFor({ state: "hidden" });
  await pa.getByRole("heading", { name: "Bài trong nhóm (1)" }).waitFor();

  await pa.getByRole("button", { name: "Chia sẻ vào nhóm" }).click();
  await hopChiaSe.waitFor();
  await hopChiaSe.getByText("Đề ôn tập", { exact: true }).click();
  await hopChiaSe.locator("#chu-de-de option", { hasText: tenChuDe }).waitFor({ state: "attached" });
  await hopChiaSe.getByLabel("Chủ đề").selectOption({ label: `${tenChuDe} (5 câu)` });
  await hopChiaSe.getByLabel(/Số câu/).fill("5");
  await hopChiaSe.getByLabel("Tên đề").fill("Đề ôn nhóm E2E");
  await kiemBoCuc(n, pa, "Hộp Chia sẻ vào nhóm (đề ôn tập)");
  await hopChiaSe.getByRole("button", { name: "Chia sẻ đề ôn tập" }).click();
  await hopChiaSe.waitFor({ state: "hidden" });
  await pa.getByRole("heading", { name: "Bài trong nhóm (2)" }).waitFor();
  await pa.getByText("Đề ôn nhóm E2E").waitFor();
  await kiemBoCuc(n, pa, "Trang nhóm có hai mục");

  // 5. B học xong bài học từ nhóm.
  await pb.goto(trangNhom);
  await pb.locator("li", { hasText: tenBai }).getByRole("button", { name: "Học bài" }).click();
  await pb.waitForURL(/\/hoc\//);
  await pb.getByRole("button", { name: "Hoàn thành bài" }).click();
  await pb.getByText("Đã hoàn thành bài", { exact: false }).waitFor();

  // 6. A thấy phần trăm chung của B là 50 (bài học 100, đề ôn tập 0).
  await pa.reload();
  const hangB = pa.locator("li", { hasText: "Cán bộ B nhóm E2E" });
  await hangB.getByText("50%", { exact: true }).waitFor();
  await n.chupAnh(pa, "5-b-50");

  // 7. A cổ vũ B; B thấy 1 lượt. A bấm lại thì về 0.
  const nutCoVu = hangB.getByRole("button", { name: /^Cổ vũ Cán bộ B nhóm E2E/ });
  // Nút đổi ngay khi bấm; chờ máy chủ ghi xong (nút hết khóa) rồi B mới mở trang.
  const daGhi = (bam: boolean) => hangB.locator(`button[aria-pressed="${bam}"]:not([disabled])`).waitFor();
  await nutCoVu.click();
  await hangB.getByRole("button", { name: "Cổ vũ Cán bộ B nhóm E2E, đã nhận 1 lượt" }).waitFor();
  await daGhi(true);
  await pb.goto(trangNhom);
  await pb.locator("li", { hasText: "Cán bộ B nhóm E2E" }).getByText("1 lượt cổ vũ").waitFor();
  await nutCoVu.click();
  await hangB.getByRole("button", { name: "Cổ vũ Cán bộ B nhóm E2E, đã nhận 0 lượt" }).waitFor();
  await daGhi(false);
  await pb.reload();
  await pb.locator("li", { hasText: "Cán bộ B nhóm E2E" }).getByText("0 lượt cổ vũ").waitFor();
  await kiemBoCuc(n, pb, "Trang nhóm của B");

  // 7b. B làm đề ôn tập từ nhóm, kết thúc phiên, về nhóm: mục đó 100%, phần trăm chung 100.
  await pb.locator("li", { hasText: "Đề ôn nhóm E2E" }).getByRole("button", { name: "Làm đề" }).click();
  await pb.waitForURL(/\/luyen-tap\/[0-9a-f-]{36}/);
  await pb.getByText("Đề ôn tập của nhóm: Đề ôn nhóm E2E", { exact: false }).waitFor();
  for (let i = 1; i <= 5; i++) {
    await pb.getByText(`Câu ${i}/5`).waitFor();
    await pb.getByRole("button", { name: "Đúng", exact: true }).click();
    await pb.getByRole("button", { name: "Kiểm tra" }).click();
    await pb
      .locator("[role=status]")
      .filter({ hasText: /Đúng\.|Chưa đúng\./ })
      .waitFor();
    if (i < 5) await pb.getByRole("link", { name: "Câu tiếp" }).click();
    else
      await Promise.all([
        pb.waitForURL(/\/ket-qua$/),
        pb.getByRole("button", { name: "Xem kết quả" }).click(),
      ]);
  }
  await Promise.all([
    pb.waitForURL(/\/nhom\/[0-9a-f-]{36}$/),
    pb.getByRole("link", { name: "Về nhóm" }).click(),
  ]);
  await pb.getByRole("progressbar", { name: "Tiến độ chung của tôi trong nhóm" }).waitFor();
  const cuaB = await pb.evaluate(() => ({
    chung: document
      .querySelector('[aria-label="Tiến độ chung của tôi trong nhóm"]')
      ?.getAttribute("aria-valuenow"),
    de: document
      .querySelector('[aria-label="Tiến độ của tôi: Đề ôn nhóm E2E"]')
      ?.getAttribute("aria-valuenow"),
  }));
  if (cuaB.chung !== "100" || cuaB.de !== "100") throw new Error(`B sau khi làm đề: ${JSON.stringify(cuaB)}`);

  // 8. Hộp tiến độ thành viên: mở bằng chạm vào họ tên, Esc trả tiêu điểm về đúng nút.
  await hangB.getByRole("button", { name: /Cán bộ B nhóm E2E$/ }).click();
  const hopTienDo = pa.getByRole("dialog", { name: "Tiến độ của Cán bộ B nhóm E2E" });
  await hopTienDo.getByText("Tiến độ chung").waitFor();
  await kiemBoCuc(n, pa, "Hộp Tiến độ của thành viên");
  await pa.keyboard.press("Escape");
  await hopTienDo.waitFor({ state: "hidden" });
  await kiemTieuDiem(pa, "Cán bộ B nhóm E2E", "Sau khi Esc đóng hộp tiến độ");

  // 9. Hộp mời thành viên: chế độ thường có hiệu ứng phóng to kèm hiện dần (≥ 100 ms); bật giảm
  // chuyển động thì chỉ còn hiện dần (opacity), không phóng to (lớp .hop-thoai ở styles/app.css), vẫn
  // đóng mở được.
  const hieuUng = () =>
    pa.evaluate(() => {
      const s = getComputedStyle(document.querySelector("dialog[open]") as HTMLElement);
      const giay = s.transitionDuration.split(",").map((x) => Number.parseFloat(x));
      const thuocTinh = s.transitionProperty.split(",").map((x) => x.trim());
      return {
        chuyenMs: Math.max(...giay) * 1000,
        hoatAnh: s.animationName,
        phongTo: thuocTinh.includes("transform"),
      };
    });
  const hopMoi = pa.getByRole("dialog", { name: "Mời thành viên" });
  await pa.getByRole("button", { name: "Mời thành viên" }).click();
  await hopMoi.waitFor();
  const thuong = await hieuUng();
  if (thuong.chuyenMs < 100)
    throw new Error(`Chế độ thường mà hộp thoại không có hiệu ứng: ${JSON.stringify(thuong)}`);
  await hopMoi.getByRole("button", { name: "Đóng" }).click();
  await hopMoi.waitFor({ state: "hidden" });

  await pa.emulateMedia({ reducedMotion: "reduce" });
  await pa.getByRole("button", { name: "Mời thành viên" }).click();
  await hopMoi.waitFor();
  const giam = await hieuUng();
  if (giam.phongTo || giam.hoatAnh !== "none") {
    throw new Error(`Giảm chuyển động mà hộp thoại còn hiệu ứng: ${JSON.stringify(giam)}`);
  }
  if (!lienKet.endsWith(await hopMoi.locator("[data-ma-moi]").innerText())) {
    throw new Error("Mã mời trong hộp Mời thành viên khác với liên kết đã sao chép.");
  }
  await kiemBoCuc(n, pa, "Hộp Mời thành viên");
  await hopMoi.getByRole("button", { name: "Đóng" }).click();
  await hopMoi.waitFor({ state: "hidden" });
  await pa.emulateMedia({ reducedMotion: "no-preference" });

  // 10. Hộp tùy chọn mục và hộp xác nhận: lỗi hiện trong hộp, hộp không đóng.
  await pa.locator("li", { hasText: tenBai }).getByRole("button", { name: "Tùy chọn" }).click();
  const hopTuyChon = pa.getByRole("dialog", { name: `Tùy chọn: ${tenBai}` });
  await hopTuyChon.waitFor();
  await kiemBoCuc(n, pa, "Hộp Tùy chọn mục");
  await pa.keyboard.press("Escape");
  await hopTuyChon.waitFor({ state: "hidden" });

  await pa.getByRole("button", { name: "Rời nhóm" }).click();
  const hopRoi = pa.getByRole("dialog", { name: "Rời nhóm" });
  await hopRoi.waitFor();
  await hopRoi.getByRole("button", { name: "Rời nhóm" }).click();
  await hopRoi.getByRole("alert").waitFor();
  await kiemBoCuc(n, pa, "Hộp xác nhận Rời nhóm khi có lỗi");
  await n.chupAnh(pa, "6-loi-trong-hop");
  await hopRoi.getByRole("button", { name: "Hủy" }).click();
  await hopRoi.waitFor({ state: "hidden" });

  // 11. Chia sẻ từ trang bài học: bài đã có trong nhóm thì báo riêng cho nhóm đó.
  await pa.goto(`${n.web}/hoc/${ma}/bai-1`);
  await pa.getByRole("button", { name: "Chia sẻ vào nhóm" }).click();
  const hopBai = pa.getByRole("dialog", { name: "Chia sẻ vào nhóm" });
  await hopBai.waitFor();
  await hopBai.getByText(tenNhom).click();
  await kiemBoCuc(n, pa, "Hộp Chia sẻ từ trang bài học");
  await hopBai.getByRole("button", { name: "Chia sẻ bài học" }).click();
  await hopBai.getByText("Bài học này đã có trong nhóm.").waitFor();
  await hopBai.getByRole("button", { name: "Xong" }).click();
  await hopBai.waitFor({ state: "hidden" });

  // 12. Lối vào (N1): điện thoại có dòng "Nhóm học cùng" trong ngăn "Thêm", mục "Học" sáng ở
  // trang nhóm; máy tính 1280px sáng mục "Học & luyện tập"; menu cán bộ vẫn 4 mục.
  await pa.goto(trangNhom);
  const thanhDuoi = pa.getByRole("navigation", { name: "Điều hướng chính" });
  if ((await thanhDuoi.getByRole("link", { name: "Học" }).getAttribute("aria-current")) !== "page") {
    throw new Error("Ở trang nhóm, mục Học trên thanh dưới chưa ở trạng thái đang chọn.");
  }
  const soMucDuoi = await thanhDuoi.getByRole("link").count();
  if (soMucDuoi !== 4) throw new Error(`Thanh dưới có ${soMucDuoi} mục, cần 4 (cộng nút Thêm).`);
  await thanhDuoi.getByRole("button", { name: "Thêm" }).click();
  await pa.getByRole("dialog").getByRole("link", { name: "Nhóm học cùng" }).waitFor();
  await pa.keyboard.press("Escape");

  const pc = await n.moTrang({ width: 1280, height: 800 });
  await n.dangNhap(pc, a);
  await pc.goto(`${n.web}/nhom`);
  const menuMayTinh = pc.getByRole("navigation", { name: "Điều hướng chính" });
  if (
    (await menuMayTinh.getByRole("link", { name: "Học & luyện tập" }).getAttribute("aria-current")) !== "page"
  ) {
    throw new Error("Ở /nhom trên máy tính, mục Học & luyện tập chưa ở trạng thái đang chọn.");
  }
  const soMucMayTinh = await menuMayTinh.getByRole("link").count();
  if (soMucMayTinh !== 4) throw new Error(`Menu máy tính có ${soMucMayTinh} mục, cần 4.`);

  // 13. Nút "Cổ vũ" khi máy chủ báo lỗi: trở lại trạng thái cũ và hiện lỗi. Gọi thẳng API tới khi
  // chạm giới hạn 60 lần mỗi phút (429), tải lại trang, rồi bấm trên giao diện.
  const nhomId = trangNhom.split("/").pop()!;
  const { token } = await createSession(a.id, "e2e");
  const api = `http://127.0.0.1:${process.env.E2E_API_PORT ?? 3291}/v1/nhom/${nhomId}/co-vu/${b.id}`;
  for (let i = 0; i < 70; i++) {
    const r = await fetch(api, { method: "POST", headers: { authorization: `Bearer ${token}` } });
    if (r.status === 429) break;
  }
  await pa.reload();
  const truocKhiBam = await nutCoVu.getAttribute("aria-pressed");
  await nutCoVu.click();
  await hangB.getByRole("alert").filter({ hasText: "quá nhiều lần" }).waitFor();
  if ((await nutCoVu.getAttribute("aria-pressed")) !== truocKhiBam) {
    throw new Error("Máy chủ báo lỗi mà nút Cổ vũ không trở lại trạng thái cũ.");
  }
  await kiemBoCuc(n, pa, "Trang nhóm khi nút Cổ vũ báo lỗi");
}
