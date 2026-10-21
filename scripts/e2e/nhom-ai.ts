/**
 * Kịch bản E2E AI của nhóm học cùng (docs/PLAN.md GĐ16d). Chạy hai lần:
 *
 *   bun run e2e nhom-ai                                        # AI tắt
 *   NHOM_AI_CHO_PHEP_MOCK=1 bun run e2e nhom-ai --khong-build  # AI bật với provider mock
 *
 * AI tắt (provider mock ngoài NODE_ENV=test): trưởng nhóm không thấy nút "Gợi ý thứ tự học", trang
 * quản trị nhóm không có khối "Tóm tắt tiến độ", API trả 503.
 *
 * AI bật: nhóm có đề ôn tập D rồi bài L1, L2. Mock xếp bài học trước đề ôn tập nên gợi ý là L1, L2,
 * D. Trưởng nhóm mở hộp bằng bàn phím trên khung 360×740 (Tab không ra ngoài hộp, Esc đóng và trả
 * tiêu điểm, khóa cuộn nền, nút ≥ 48px, chữ ≥ 16px), thấy thứ tự gợi ý, thứ tự nhóm chưa đổi; bấm "Áp dụng
 * thứ tự này" thì thứ tự nhóm đổi. Mở lại thì hộp báo thứ tự đã khớp. Quản trị bấm "Tóm tắt tiến độ
 * bằng AI": có câu cảnh báo, nhận xét có họ tên thật, không còn mã TVn.
 */
import { createSession } from "@qdpl/auth";
import type { Page } from "playwright-core";
import { type NguCanhE2E, TIEN_TO } from "./chay.ts";

const API = `http://127.0.0.1:${process.env.E2E_API_PORT ?? 3291}`;
const CANH_BAO = "Tóm tắt do AI soạn từ số liệu trong bảng dưới đây, cần đối chiếu với bảng.";

async function goiApi(token: string, method: string, path: string, body?: unknown) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: (await r.json().catch(() => null)) as any };
}

/** Mọi nút trong hộp thoại đang mở cao ≥ 48px, chữ không tràn khỏi nút. */
async function kiemNutTrongHop(page: Page, noi: string) {
  const loi = await page.evaluate(() =>
    [...(document.querySelector("dialog[open]")?.querySelectorAll("button") ?? [])]
      .filter((e) => e.clientWidth > 0)
      .flatMap((e) => {
        const ten = (e.getAttribute("aria-label") ?? e.textContent ?? "").trim().slice(0, 40);
        const r = e.getBoundingClientRect();
        return [
          ...(r.height < 47.5 ? [`${ten} cao ${r.height.toFixed(0)}px`] : []),
          ...(e.scrollWidth > e.clientWidth + 1 ? [`${ten} tràn chữ`] : []),
        ];
      }),
  );
  if (loi.length) throw new Error(`${noi}: ${loi.join("; ")}`);
}

/** Chữ nội dung trong hộp ≥ 16px; dòng phụ khai rõ bằng `text-sm` được bỏ qua, như kịch bản nhom-hoc. */
async function kiemCoChu(page: Page, noi: string) {
  const nho = await page.evaluate(() =>
    [...(document.querySelector("dialog[open]")?.querySelectorAll("h2, h3, p, li, span, button") ?? [])]
      .filter((e) => [...e.childNodes].some((c) => c.nodeType === 3 && (c.textContent ?? "").trim()))
      .filter((e) => !e.closest(".text-sm, .text-xs, .sr-only") && (e as HTMLElement).offsetWidth > 0)
      .filter((e) => Number.parseFloat(getComputedStyle(e).fontSize) < 15.9)
      .map((e) => `${(e.textContent ?? "").trim().slice(0, 30)} ${getComputedStyle(e).fontSize}`),
  );
  if (nho.length) throw new Error(`${noi}: chữ nội dung dưới 16px: ${nho.join("; ")}`);
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
  await page
    .waitForFunction((c) => (getComputedStyle(document.documentElement).overflow === "hidden") === c, can, {
      timeout: 2000,
    })
    .catch(() => {
      throw new Error(`${noi}: cuộn nền ${can ? "không khóa" : "vẫn khóa"}.`);
    });
}

export default async function nhomAi(n: NguCanhE2E) {
  const aiBat = process.env.NHOM_AI_CHO_PHEP_MOCK === "1";
  const ma = `${TIEN_TO}nhom-ai-${crypto.randomUUID().slice(0, 8)}`;
  const ten = (x: string) => `${x} nhóm AI E2E ${ma.slice(-8)}`;

  // Dữ liệu riêng: chuyên đề xuất bản có 2 bài, chủ đề có 5 câu đã duyệt.
  const [c] = await n.sql<Array<{ id: string }>>`
    INSERT INTO courses (slug, title, status, as_of)
    VALUES (${ma}, 'Chuyên đề nhóm AI E2E', 'xuat_ban', '2026-09-01') RETURNING id`;
  n.donDep(() => n.sql`DELETE FROM courses WHERE id = ${c!.id}`);
  const bai: string[] = [];
  for (const i of [1, 2]) {
    const [l] = await n.sql<Array<{ id: string }>>`
      INSERT INTO lessons (course_id, slug, ordinal, title, status)
      VALUES (${c!.id}, ${`bai-${i}`}, ${i}, ${ten(`Bài L${i}`)}, 'xuat_ban') RETURNING id`;
    await n.sql`
      INSERT INTO lesson_blocks (lesson_id, ordinal, kind, data, status)
      VALUES (${l!.id}, 1, 'giang', ${n.sql.json({ md: "Nội dung bài thử." })}, 'xuat_ban')`;
    bai.push(l!.id);
  }
  const [t] = await n.sql<Array<{ id: string }>>`
    INSERT INTO question_topics (code, name) VALUES (${ma}, ${ten("Chủ đề")}) RETURNING id`;
  n.donDep(() => n.sql`DELETE FROM question_topics WHERE id = ${t!.id}`);
  n.donDep(() => n.sql`DELETE FROM questions WHERE code LIKE ${`${ma}-%`}`);
  for (let i = 1; i <= 5; i++) {
    await n.sql`
      INSERT INTO questions (code, topic_id, level, kind, stem, options, answer, explanation, status)
      VALUES (${`${ma}-${i}`}, ${t!.id}, 'de', 'dung_sai', ${`Nhận định nhóm AI E2E số ${i}`}, '{}',
              ${n.sql.json({ dung: ["dung"] })}, 'Giải thích.', 'da_duyet')`;
  }

  const a = await n.taoTaiKhoan({ ten: ten("Cán bộ A") });
  const b = await n.taoTaiKhoan({ ten: ten("Cán bộ B") });
  const q = await n.taoTaiKhoan({ ten: ten("Quản trị"), role: "quan_tri" });
  n.donDep(() => n.sql`DELETE FROM study_groups WHERE owner_account_id IN (${a.id}, ${b.id})`);

  // Nhóm lập bằng API (giao diện lập nhóm đã có kịch bản nhom-hoc): đề ôn tập trước, rồi hai bài.
  const tkA = (await createSession(a.id, "e2e")).token;
  const tkB = (await createSession(b.id, "e2e")).token;
  const tao = await goiApi(tkA, "POST", "/v1/nhom", { ten: ten("Nhóm") });
  if (tao.status !== 201) throw new Error(`Tạo nhóm trả ${tao.status}.`);
  const nhom = tao.body.id as string;
  await goiApi(tkB, "POST", "/v1/nhom/tham-gia", { ma: tao.body.ma_moi });
  const chiaSe = async (body: unknown) =>
    (await goiApi(tkA, "POST", `/v1/nhom/${nhom}/muc`, body)).body.id as string;
  const d = await chiaSe({ loai: "de_on_tap", topic_id: t!.id, so_cau: 5, ten: ten("Đề D") });
  const l1 = await chiaSe({ loai: "bai_hoc", lesson_id: bai[0] });
  const l2 = await chiaSe({ loai: "bai_hoc", lesson_id: bai[1] });
  const thuTu = async () =>
    ((await goiApi(tkA, "GET", `/v1/nhom/${nhom}`)).body.muc as any[]).map((m) => m.id);

  const pa = await n.moTrang();
  await n.dangNhap(pa, a);
  await pa.goto(`${n.web}/nhom/${nhom}`);
  await pa.getByRole("heading", { name: /Bài trong nhóm/ }).waitFor();
  const nut = pa.getByRole("button", { name: "Gợi ý thứ tự học" });

  const pq = await n.moTrang({ width: 1280, height: 800 });
  await n.dangNhap(pq, q);

  if (!aiBat) {
    if (await nut.count()) throw new Error("AI tắt nhưng trưởng nhóm vẫn thấy nút Gợi ý thứ tự học.");
    const r = await goiApi(tkA, "POST", `/v1/nhom/${nhom}/ai/thu-tu`);
    if (r.status !== 503) throw new Error(`AI tắt nhưng API gợi ý trả ${r.status}, cần 503.`);
    await pq.goto(`${n.web}/quan-tri/nhom/${nhom}`);
    await pq.getByRole("heading", { name: /Tiến độ thành viên/ }).waitFor();
    if (await pq.locator("[data-tom-tat-ai]").count())
      throw new Error("AI tắt nhưng trang quản trị có khối tóm tắt.");
    await n.chupAnh(pa, "tat-1-khong-co-nut");
    return;
  }

  // 1. Mở hộp bằng bàn phím: gợi ý L1, L2, D; thứ tự nhóm chưa đổi.
  await nut.focus();
  await pa.keyboard.press("Enter");
  const hop = pa.getByRole("dialog", { name: "Gợi ý thứ tự học" });
  await hop.waitFor();
  await kiemKhoaCuon(pa, true, "Hộp Gợi ý thứ tự học đang mở");
  const ds = hop.locator("[data-goi-y-thu-tu] li");
  await ds.first().waitFor({ timeout: 25_000 });
  await kiemTabTrongHop(pa, 6, "Hộp Gợi ý thứ tự học");
  await kiemCoChu(pa, "Hộp Gợi ý thứ tự học");
  const chu = await ds.allTextContents();
  const mong = [ten("Bài L1"), ten("Bài L2"), ten("Đề D")];
  if (!mong.every((x, i) => chu[i]?.includes(x))) throw new Error(`Thứ tự gợi ý sai: ${chu.join(" | ")}`);
  if (!chu[0]?.includes("Đang ở vị trí 2")) throw new Error(`Không nêu vị trí cũ: ${chu[0]}`);
  if ((await thuTu()).join() !== [d, l1, l2].join()) throw new Error("Gợi ý tự áp dụng khi chưa bấm.");
  await n.kiemKhongCuonNgang(pa, "Hộp Gợi ý thứ tự học");
  await kiemNutTrongHop(pa, "Hộp Gợi ý thứ tự học");
  await n.chupAnh(pa, "bat-1-hop-goi-y");

  // 2. Áp dụng: hộp đóng, thứ tự nhóm đổi.
  await hop.getByRole("button", { name: "Áp dụng thứ tự này" }).click();
  await hop.waitFor({ state: "hidden" });
  if ((await thuTu()).join() !== [l1, l2, d].join())
    throw new Error("Áp dụng xong nhưng thứ tự nhóm không đổi.");

  // 3. Mở lại: thứ tự đã khớp, chỉ còn nút Đóng.
  await nut.click();
  await hop.getByText("Thứ tự hiện tại đã khớp với gợi ý").waitFor({ timeout: 25_000 });
  if (await hop.getByRole("button", { name: "Áp dụng thứ tự này" }).count()) {
    throw new Error("Thứ tự đã khớp nhưng vẫn có nút Áp dụng.");
  }
  // Esc đóng hộp, trả tiêu điểm về nút đã mở hộp, hết khóa cuộn.
  await pa.keyboard.press("Escape");
  await hop.waitFor({ state: "hidden" });
  await kiemKhoaCuon(pa, false, "Sau khi Esc đóng hộp Gợi ý thứ tự học");
  const tieuDiem = await pa.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
  if (tieuDiem !== "Gợi ý thứ tự học") throw new Error(`Esc đóng hộp nhưng tiêu điểm ở "${tieuDiem}".`);

  // 4. Quản trị: tóm tắt có cảnh báo, họ tên thật, không còn mã.
  await pq.goto(`${n.web}/quan-tri/nhom/${nhom}`);
  const khoi = pq.locator("[data-tom-tat-ai]");
  await khoi.getByRole("button", { name: "Tóm tắt tiến độ bằng AI" }).click();
  await khoi.getByText(CANH_BAO).waitFor({ timeout: 25_000 });
  const nhanXet = (await khoi.locator("li").allTextContents()).join("\n");
  if (!nhanXet.includes(ten("Cán bộ B"))) throw new Error(`Tóm tắt không có họ tên thật: ${nhanXet}`);
  if (/\b(?:TV|M)\d+\b/.test(nhanXet)) throw new Error(`Tóm tắt còn mã: ${nhanXet}`);
  await n.chupAnh(pq, "bat-2-tom-tat");
}
