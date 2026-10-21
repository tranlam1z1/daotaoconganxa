/**
 * Kịch bản E2E trò chơi (docs/PLAN.md GĐ10) trên khung điện thoại 360×740:
 *  1. Vượt màn: bản đồ có màn 2 khóa → chơi màn 1 đúng 10/10 → về bản đồ, màn 2 đã mở.
 *  2. Ghép lỗi với mức phạt: chơi hoàn toàn bằng chạm (chạm hành vi, chạm mức phạt) → nộp → hộp
 *     "Đúng" với "Đúng x/y cặp"; mức phạt đúng chỉ hiện sau "Xem chi tiết" (GĐ17b, H5).
 *  3. Đua thời gian: trả lời sai 3 câu bằng một chạm, nhịp sang câu khoảng 350 ms, đồng hồ chạy hết
 *     60 giây; màn kết thúc liệt kê 3 câu chưa đúng, mỗi câu "Xem chi tiết" thu gọn (GĐ17b, H3).
 *
 * Tự tạo chủ đề 20 câu (2 màn) và 5 dòng mức phạt đã duyệt, xóa khi xong.
 */
import { moTaMucPhat } from "@qdpl/dao-tao";
import { luuChuDeCauHoi, type TaoCauHoiInput, taoNhieuCauHoi } from "@qdpl/db";
import { type NguCanhE2E, TIEN_TO } from "./chay.ts";
import { hopKetQua } from "./hop-ket-qua.ts";

const NGUOI_TAO = `${TIEN_TO}tro-choi`;
const DUNG = "Đây là phương án đúng";

export default async function troChoi(n: NguCanhE2E) {
  const duoi = crypto.randomUUID().slice(0, 8);
  const ma = `${TIEN_TO}tro-choi-${duoi}`;
  const tenChuDe = `Trò chơi E2E ${duoi}`;
  const chuDe = await luuChuDeCauHoi({ code: ma, name: tenChuDe });
  n.donDep(() => n.sql`DELETE FROM question_topics WHERE id = ${chuDe.id}`);
  n.donDep(() => n.sql`DELETE FROM questions WHERE created_by = ${NGUOI_TAO} AND topic_id = ${chuDe.id}`);
  const cau = (i: number): TaoCauHoiInput => ({
    topicId: chuDe.id,
    level: (["de", "trung_binh", "kho"] as const)[i % 3]!,
    kind: "mot_dap_an",
    stem: `Câu trò chơi E2E số ${i + 1}?`,
    options: {
      phuong_an: [
        { id: "a", text: DUNG },
        { id: "b", text: "Phương án sai" },
      ],
    },
    answer: { dung: ["a"] },
    explanation: "Giải thích.",
    citations: [],
    status: "da_duyet",
  });
  await taoNhieuCauHoi(
    Array.from({ length: 20 }, (_, i) => cau(i)),
    NGUOI_TAO,
  );

  // 5 dòng mức phạt đã duyệt, mức khác nhau từng đôi.
  const maMucPhat = `${TIEN_TO}mp-${duoi}`;
  n.donDep(() => n.sql`DELETE FROM violations WHERE code LIKE ${`${maMucPhat}%`}`);
  for (const [i, m] of [300_000, 700_000, 1_500_000, 3_000_000, 9_000_000].entries()) {
    await n.sql`
      INSERT INTO violations (code, vehicle, behavior, fine_min, fine_max, citation_urn, effective_from, status)
      VALUES (${`${maMucPhat}-${i}`}, 'mo_to', ${`Hành vi E2E ${duoi} số ${i + 1}`}, ${m}, ${m * 2},
              'vn:vbqppl:nd:100/2026/NĐ-CP#dieu-3', '2020-01-01', 'da_duyet')`;
  }

  const tk = await n.taoTaiKhoan({ ten: "Cán bộ trò chơi E2E" });
  const page = await n.moTrang();
  await n.dangNhap(page, tk);

  /* 1. Vượt màn ------------------------------------------------------ */
  await page.goto(`${n.web}/tro-choi`);
  await n.kiemKhongCuonNgang(page, "Trang trò chơi");
  await n.chupAnh(page, "1-trang-tro-choi");
  await page.getByRole("link", { name: "Vượt màn", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Vượt màn" })
    .getByRole("link", { name: new RegExp(tenChuDe) })
    .click();
  await page.getByRole("img", { name: "Màn 2 chưa mở" }).waitFor();
  await n.kiemKhongCuonNgang(page, "Bản đồ màn");
  await n.chupAnh(page, "2-ban-do-truoc");

  await Promise.all([
    page.waitForURL(/\/luyen-tap\/[0-9a-f-]{36}\?cau=1/),
    page.getByRole("button", { name: /^Chơi màn 1/ }).click(),
  ]);
  for (let i = 1; i <= 10; i++) {
    await page.getByText(`Câu ${i}/10`).waitFor();
    await page.getByRole("button", { name: new RegExp(DUNG) }).click();
    await page.getByRole("button", { name: "Kiểm tra" }).click();
    await hopKetQua(page, "Đúng").waitFor();
    if (i < 10) await page.getByRole("link", { name: "Câu tiếp" }).click();
    else {
      await Promise.all([
        page.waitForURL(/\/tro-choi\/vuot-man\//),
        page.getByRole("button", { name: "Xem kết quả" }).click(),
      ]);
    }
  }
  await page.getByText("Màn 1: đúng 10/10 câu").waitFor();
  await page.getByText("Đã mở màn 2.").waitFor();
  // Màn 2 đã mở trên bản đồ: có nút chơi, không còn ổ khóa.
  await page.getByRole("button", { name: /^Chơi màn 2/ }).waitFor();
  if (await page.getByRole("img", { name: "Màn 2 chưa mở" }).count())
    throw new Error("Màn 2 vẫn khóa sau khi qua màn 1.");
  await n.kiemKhongCuonNgang(page, "Bản đồ màn sau khi qua màn 1");
  await n.chupAnh(page, "3-ban-do-sau");

  /* 2. Ghép lỗi với mức phạt ----------------------------------------- */
  await page.goto(`${n.web}/tro-choi/ghep-cap`);
  await page.getByLabel("Xe mô tô, xe gắn máy").check();
  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await page.getByText("Đã ghép 0/").waitFor();
  const hanhVi = page.getByRole("region", { name: "Hành vi vi phạm" }).getByRole("button");
  const soCap = await hanhVi.count();
  for (let i = 0; i < soCap; i++) {
    const nut = hanhVi.nth(i);
    const ten = (await nut.innerText()).split("\n")[0]!.trim();
    // Tra mức phạt đúng của hành vi này trong dữ liệu tra cứu, như người chơi tra bằng mục Tra cứu nhanh.
    const [dong] = await n.sql<Array<{ fine_min: number; fine_max: number }>>`
      SELECT fine_min::float AS fine_min, fine_max::float AS fine_max FROM violations
      WHERE behavior = ${ten} AND status = 'da_duyet' LIMIT 1`;
    if (!dong) throw new Error(`Không tìm thấy mức phạt của "${ten}".`);
    await nut.click();
    await page
      .getByRole("region", { name: "Mức phạt" })
      .getByRole("button", {
        name: new RegExp(`^${moTaMucPhat(dong.fine_min, dong.fine_max).replace(/\./g, "\\.")}`),
      })
      .click();
  }
  await n.kiemKhongCuonNgang(page, "Bảng ghép cặp");
  await n.chupAnh(page, "4-ghep-cap");
  // Giảm chuyển động: hộp không phóng to, chỉ còn hiện dần (chuyển tiếp opacity).
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Nộp" }).click();
  const hopGhep = hopKetQua(page, "Đúng");
  await hopGhep.waitFor();
  const hieuUng = await hopGhep.evaluate((el) => {
    const c = getComputedStyle(el);
    return { anim: c.animationName, phongTo: c.transitionProperty.includes("transform"), bien: c.transform };
  });
  if (hieuUng.anim !== "none" || hieuUng.phongTo || hieuUng.bien !== "none")
    throw new Error(`Giảm chuyển động nhưng hộp còn hiệu ứng: ${JSON.stringify(hieuUng)}.`);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const caoXem = (await hopGhep.getByRole("button", { name: "Xem chi tiết" }).boundingBox())?.height ?? 0;
  if (caoXem < 48) throw new Error(`Nút "Xem chi tiết" cao ${caoXem}px, cần ≥ 48px.`);
  await hopGhep.getByText(`Đúng ${soCap}/${soCap} cặp`).waitFor();
  const mucPhat = hopGhep.getByRole("heading", { name: "Mức phạt đúng" });
  if (await mucPhat.isVisible()) throw new Error("Mức phạt đúng hiện khi chưa bấm Xem chi tiết.");
  await n.kiemKhongCuonNgang(page, "Hộp kết quả ghép cặp");
  await n.chupAnh(page, "5-ghep-cap-ket-qua");
  await hopGhep.getByRole("button", { name: "Xem chi tiết" }).click();
  await mucPhat.waitFor();
  const cao = (await hopGhep.getByRole("button", { name: "Chơi ván mới" }).boundingBox())?.height ?? 0;
  if (cao < 48) throw new Error(`Nút "Chơi ván mới" cao ${cao}px, cần ≥ 48px.`);
  await n.chupAnh(page, "5a-ghep-cap-chi-tiet");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Xem lại kết quả" }).waitFor();

  /* 3. Đua thời gian -------------------------------------------------- */
  await page.goto(`${n.web}/tro-choi/dua-thoi-gian`);
  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await page.getByRole("timer").waitFor();
  const [dua] = (await n.sql`
    SELECT items FROM practice_sessions WHERE account_id = ${tk.id} AND source = 'game:dua_thoi_gian'
    ORDER BY started_at DESC LIMIT 1`) as any[];
  type CauDua = {
    de: { kind: string; options: { phuong_an?: Array<{ id: string; text: string }> } };
    noi_dung: { answer: { dung: string[] }; explanation: string | null; citations: string[] };
  };
  const chuSai = (c: CauDua) => {
    const dungId = c.noi_dung.answer.dung[0];
    if (c.de.kind === "dung_sai") return dungId === "dung" ? "Sai" : "Đúng";
    return c.de.options.phuong_an!.find((x) => x.id !== dungId)!.text;
  };
  const nhip: number[] = [];
  for (let i = 1; i <= 3; i++) {
    await page.getByText(`Câu ${i}`, { exact: true }).waitFor();
    await page.getByRole("button", { name: chuSai(dua.items[i - 1]), exact: true }).click();
    // Nhịp: từ lúc hiện "Sai" tới lúc câu sau hiện ra, vẫn khoảng 350 ms (H3).
    await page.getByText(/^(Đúng|Sai)$/).waitFor();
    const t = Date.now();
    await page.getByText(`Câu ${i + 1}`, { exact: true }).waitFor();
    nhip.push(Date.now() - t);
  }
  console.log(`  Đua: nhịp sang câu ${nhip.join(", ")} ms`);
  if (nhip.some((x) => x < 250 || x > 1000))
    throw new Error(`Nhịp sang câu không còn khoảng 350 ms: ${nhip.join(", ")}.`);
  await n.kiemKhongCuonNgang(page, "Đua thời gian");
  await n.chupAnh(page, "6-dua-thoi-gian");

  // Hết 60 giây: màn kết thúc liệt kê 3 câu chưa đúng, chi tiết thu gọn.
  await page.getByText("Số câu đúng").waitFor({ timeout: 80_000 });
  // Chỉ mục con trực tiếp: danh sách căn cứ trong phần chi tiết cũng là listitem.
  const dsSai = page.getByRole("region", { name: "Câu chưa đúng" }).locator("ol > li");
  await dsSai.first().waitFor();
  if ((await dsSai.count()) !== 3)
    throw new Error(`Màn kết thúc có ${await dsSai.count()} câu chưa đúng, cần 3.`);
  for (let i = 0; i < 3; i++) {
    const nd = (dua.items[i] as CauDua).noi_dung;
    const nut = dsSai.nth(i).getByRole("button", { name: "Xem chi tiết" });
    if (!nd.explanation?.trim() && !nd.citations.length) continue;
    if ((await nut.getAttribute("aria-expanded")) !== "false")
      throw new Error("Chi tiết câu sai không thu gọn.");
    if (nd.explanation?.trim()) {
      const giai = dsSai.nth(i).getByText(nd.explanation.trim());
      if (await giai.isVisible()) throw new Error("Giải thích câu sai hiện khi chưa bấm Xem chi tiết.");
      await nut.click();
      await giai.waitFor();
    }
  }
  await n.kiemKhongCuonNgang(page, "Đua thời gian, kết thúc");
  await n.chupAnh(page, "7-dua-ket-thuc");
}
