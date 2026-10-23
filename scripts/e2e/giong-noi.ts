/**
 * Kịch bản E2E giọng nói (docs/PLAN.md GĐ14) trên khung điện thoại 360×740.
 *
 * Micro giả lập: thay SpeechRecognition của trình duyệt bằng một lớp trả sẵn câu đã định, để kiểm
 * được đường đi từ lời nói tới ô hỏi đáp, tới đáp án, mà không cần âm thanh thật. Phần khớp lời
 * nói với phương án vẫn chạy thật ở API.
 *  1. Trình duyệt không có SpeechRecognition: không có nút micro ở hỏi đáp và luyện tập.
 *  2. Hỏi đáp: nói câu hỏi thì ô hỏi điền đúng câu.
 *  3. Luyện tập: nói "đáp án B" thì chọn phương án thứ hai; nói lời mơ hồ thì yêu cầu nói lại.
 *  4. Sách nói: phát, đổi tốc độ, tạm dừng thì lưu vị trí, mở lại thấy "nghe tiếp".
 *
 * Nên chạy với Vbee tắt và kho cục bộ, để không gọi dịch vụ đọc thật và không ghi lên R2:
 *   VBEE_APP_ID= STORAGE_BACKEND=local STORAGE_DIR=<thư mục tạm> bun run e2e giong-noi
 */
import { luuChuDeCauHoi, type TaoCauHoiInput, taoNhieuCauHoi } from "@qdpl/db";
import { putObject, storageMode } from "@qdpl/storage";
import type { Page } from "playwright-core";
import { type NguCanhE2E, TIEN_TO } from "./chay.ts";

const NGUOI_TAO = `${TIEN_TO}giong-noi`;
const CAU_HOI_NOI = "nồng độ cồn xe máy phạt bao nhiêu";

/** Lớp SpeechRecognition giả: mỗi lần start() lấy một câu trong window.__loiNoi rồi báo kết quả. */
async function giaLapMicro(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown> & { __loiNoi: string[] };
    w.__loiNoi = [];
    class MicroGia {
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        const loi = w.__loiNoi.shift() ?? "";
        setTimeout(() => {
          if (loi)
            this.onresult?.({
              resultIndex: 0,
              results: { length: 1, 0: { isFinal: true, 0: { transcript: loi } } },
            });
          else this.onerror?.({ error: "no-speech" });
          this.onend?.();
        }, 150);
      }
      stop() {}
      abort() {}
    }
    w.SpeechRecognition = MicroGia;
    w.webkitSpeechRecognition = MicroGia;
  });
}

async function noi(page: Page, ...loi: string[]) {
  await page.evaluate((ds) => {
    (window as unknown as { __loiNoi: string[] }).__loiNoi.push(...ds);
  }, loi);
}

/** Trang đã chạy JavaScript phía trình duyệt: nút micro chỉ hiện sau bước này. */
async function choHydrate(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
}

/** 2 giây MP3 im lặng (MPEG-1 Layer III, 128 kbps, 44,1 kHz): khung chỉ có đầu khung, dữ liệu rỗng. */
function mp3ImLang(giay: number): Uint8Array {
  const soKhung = Math.ceil((giay * 44_100) / 1152);
  const out = new Uint8Array(soKhung * 417);
  for (let i = 0; i < soKhung; i++) out.set([0xff, 0xfb, 0x90, 0xc4], i * 417);
  return out;
}

export default async function giongNoi(n: NguCanhE2E) {
  const duoi = crypto.randomUUID().slice(0, 8);
  const chuDe = await luuChuDeCauHoi({ code: `${TIEN_TO}giong-noi-${duoi}`, name: `Giọng nói E2E ${duoi}` });
  n.donDep(() => n.sql`DELETE FROM question_topics WHERE id = ${chuDe.id}`);
  n.donDep(() => n.sql`DELETE FROM questions WHERE created_by = ${NGUOI_TAO} AND topic_id = ${chuDe.id}`);
  const cau = (i: number): TaoCauHoiInput => ({
    topicId: chuDe.id,
    level: "de",
    kind: "mot_dap_an",
    stem: `Câu giọng nói E2E số ${i + 1}: người lái xe máy có nồng độ cồn bị xử lý thế nào?`,
    options: {
      phuong_an: [
        { id: "a", text: "Phạt tiền và tước giấy phép lái xe" },
        { id: "b", text: "Nhắc nhở" },
        { id: "c", text: "Không bị xử lý" },
      ],
    },
    answer: { dung: ["a"] },
    explanation: "Giải thích.",
    citations: [],
    status: "da_duyet",
  });
  await taoNhieuCauHoi(
    Array.from({ length: 3 }, (_, i) => cau(i)),
    NGUOI_TAO,
  );
  const tk = await n.taoTaiKhoan({ ten: "Cán bộ giọng nói E2E" });

  /* 1. Không có SpeechRecognition ------------------------------------- */
  const khongMic = await n.moTrang();
  await khongMic.addInitScript(() => {
    for (const k of ["SpeechRecognition", "webkitSpeechRecognition"]) {
      Object.defineProperty(window, k, { value: undefined, configurable: true, writable: true });
    }
  });
  await n.dangNhap(khongMic, tk);
  await khongMic.goto(`${n.web}/hoi-dap`);
  await choHydrate(khongMic);
  if (await khongMic.locator("[data-nut-micro]").count())
    throw new Error("Hỏi đáp vẫn hiện nút micro khi không hỗ trợ.");
  await khongMic.goto(`${n.web}/luyen-tap`);
  await Promise.all([
    khongMic.waitForURL(/\/luyen-tap\/[0-9a-f-]{36}/),
    khongMic.locator("button", { hasText: `Giọng nói E2E ${duoi}` }).click(),
  ]);
  await choHydrate(khongMic);
  if (await khongMic.getByRole("button", { name: "Nói đáp án" }).count())
    throw new Error("Luyện tập vẫn hiện nút nói đáp án khi không hỗ trợ.");

  /* 2. Hỏi đáp: nói câu hỏi ------------------------------------------- */
  const page = await n.moTrang();
  await giaLapMicro(page);
  await n.dangNhap(page, tk);
  await page.goto(`${n.web}/hoi-dap`);
  const nutHoi = page.getByRole("button", { name: "Nói câu hỏi" });
  await nutHoi.waitFor();
  await n.kiemKhongCuonNgang(page, "Hỏi đáp có nút micro");
  await noi(page, CAU_HOI_NOI);
  await nutHoi.click();
  await page.waitForFunction(
    (cau) => (document.getElementById("cau-hoi") as HTMLTextAreaElement | null)?.value === cau,
    CAU_HOI_NOI,
  );
  await n.chupAnh(page, "2-hoi-dap-da-dien");

  /* 3. Luyện tập: nói đáp án ------------------------------------------ */
  await page.goto(`${n.web}/luyen-tap`);
  await Promise.all([
    page.waitForURL(/\/luyen-tap\/[0-9a-f-]{36}/),
    page.locator("button", { hasText: `Giọng nói E2E ${duoi}` }).click(),
  ]);
  const nutNoi = page.getByRole("button", { name: "Nói đáp án" });
  await nutNoi.waitFor();
  await n.kiemKhongCuonNgang(page, "Luyện tập có thanh giọng nói");
  await noi(page, "ờ để tôi nghĩ");
  await nutNoi.click();
  await page.getByText("chưa rõ đáp án").waitFor();
  const phuongAn = page.locator("fieldset li button");
  if ((await phuongAn.nth(0).getAttribute("aria-pressed")) === "true")
    throw new Error("Lời nói mơ hồ mà vẫn tự chọn đáp án.");
  await noi(page, "đáp án bê");
  await nutNoi.click();
  await page.waitForFunction(
    () => document.querySelectorAll("fieldset li button")[1]?.getAttribute("aria-pressed") === "true",
  );
  await n.chupAnh(page, "3-luyen-tap-noi-dap-an");

  /* 4. Sách nói ---------------------------------------------------------- */
  if (storageMode() !== "local") {
    console.warn("  [giong-noi] Kho đang là R2: bỏ qua phần sách nói. Chạy với STORAGE_BACKEND=local.");
    return;
  }
  const [bai] = await n.sql<Array<{ id: string; chuyen_de: string; slug: string }>>`
    SELECT l.id, c.slug AS chuyen_de, l.slug FROM lessons l JOIN courses c ON c.id = l.course_id
    WHERE l.status = 'xuat_ban' AND c.status = 'xuat_ban'
      AND (SELECT count(*) FROM lesson_blocks b WHERE b.lesson_id = l.id AND b.kind IN ('giang', 'tom_tat')) >= 2
    ORDER BY c.slug, l.ordinal LIMIT 1`;
  if (!bai) throw new Error("CSDL chưa có bài giảng. Chạy bun run db:seed:dao-tao:gtdb.");
  const uriTien = `giong-doc/${TIEN_TO}${duoi}`;
  n.donDep(() => n.sql`DELETE FROM lesson_audio WHERE uri LIKE ${`${uriTien}%`}`);
  const khoi = await n.sql<Array<{ id: string }>>`
    SELECT id FROM lesson_blocks WHERE lesson_id = ${bai.id} AND kind IN ('giang', 'tom_tat', 'can_cu') ORDER BY ordinal`;
  for (const [i, k] of khoi.entries()) {
    const uri = `${uriTien}-${i}.mp3`;
    await putObject(uri, mp3ImLang(2), { contentType: "audio/mpeg" });
    await n.sql`
      INSERT INTO lesson_audio (lesson_id, block_id, uri, seconds, text_hash)
      VALUES (${bai.id}, ${k.id}, ${uri}, 2, ${`${TIEN_TO}${duoi}-${i}`})
      ON CONFLICT (lesson_id, block_id) DO NOTHING`;
  }

  await page.goto(`${n.web}/hoc/${bai.chuyen_de}/${bai.slug}`);
  const trinhPhat = page.locator("[data-sach-noi]");
  await trinhPhat.waitFor();
  await n.kiemKhongCuonNgang(page, "Bài giảng có sách nói");
  await trinhPhat.getByText(/Đoạn 1\//).waitFor();
  await trinhPhat.getByRole("button", { name: "1,5×" }).click();
  if ((await trinhPhat.getByRole("button", { name: "1,5×" }).getAttribute("aria-pressed")) !== "true")
    throw new Error("Nút tốc độ 1,5× không chọn được.");
  await trinhPhat.getByRole("button", { name: /^Nghe/ }).click();
  await trinhPhat.getByRole("button", { name: "Tạm dừng" }).waitFor();
  await n.chupAnh(page, "6-sach-noi-dang-phat");
  await page.waitForTimeout(600);
  await trinhPhat.getByRole("button", { name: "Tạm dừng" }).click();
  // Tạm dừng thì lưu vị trí nghe lên máy chủ.
  for (let i = 0; i < 30; i++) {
    const [v] =
      await n.sql`SELECT 1 FROM audio_positions WHERE account_id = ${tk.id} AND lesson_id = ${bai.id}`;
    if (v) break;
    if (i === 29) throw new Error("Tạm dừng mà không lưu vị trí nghe.");
    await Bun.sleep(200);
  }
  // Chờ mọi lượt lưu đang bay tới nơi, để lệnh sửa dưới đây không bị ghi đè.
  await Bun.sleep(1000);
  // Mở lại ở vị trí khác trong bài để thấy "nghe tiếp".
  await n.sql`
    UPDATE audio_positions SET block_id = ${khoi[1]!.id}, offset_seconds = 1.5
    WHERE account_id = ${tk.id} AND lesson_id = ${bai.id}`;
  await page.reload();
  await trinhPhat.getByText("Lần trước bạn nghe tới đoạn").waitFor();
  await trinhPhat.getByRole("button", { name: "Nghe tiếp" }).waitFor();
  await n.chupAnh(page, "7-sach-noi-nghe-tiep");
}
