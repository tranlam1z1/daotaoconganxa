/**
 * Kiểm thử POST /v1/ask trên Postgres thật, provider LLM ở chế độ mock.
 * Bất biến quan trọng nhất: KHÔNG BAO GIỜ trả kết luận mà thiếu trích dẫn hợp lệ.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import { sql } from "@qdpl/db";
import { isMock, loadPrompt, render } from "@qdpl/llm";
import { AS_OF_SAU, AS_OF_TRUOC, ensureIndexed, URN_GOC } from "../../../packages/search/src/testing.ts";
import { createApp } from "./app.ts";
import { DISCLAIMER, NO_BASIS_ANSWER } from "./routes/ask.ts";

const app = createApp();
/** Dấu nhận biết để dọn ask_logs do test tạo ra. */
const MARK = "[test-qdpl-ask]";

/** Hỏi đáp bắt buộc đăng nhập (docs/PLAN.md GĐ0 S2): test hỏi bằng một tài khoản riêng. */
const EMAIL = "test-qdpl-ask@vidu.vn";
let token = "";

async function ask(payload: Record<string, unknown>): Promise<{ status: number; body: any }> {
  const res = await app.request("http://test/v1/ask", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ skipAnalysis: true, ...payload }),
  });
  return { status: res.status, body: await res.json() };
}

beforeAll(async () => {
  await ensureIndexed();
  await sql`DELETE FROM accounts WHERE email = ${EMAIL}`;
  const [acc] = await sql<Array<{ id: string }>>`
    INSERT INTO accounts (email, role) VALUES (${EMAIL}, 'can_bo') RETURNING id`;
  token = (await createSession(acc!.id, "test")).token;
});

afterAll(async () => {
  await sql`DELETE FROM ask_logs WHERE question LIKE ${`%${MARK}%`}`;
  await sql`DELETE FROM accounts WHERE email = ${EMAIL}`;
});

describe("prompt trong prompts/ask", () => {
  // Prompt do nhánh nội dung sở hữu; test này khóa HỢP ĐỒNG tên biến giữa hai bên,
  // để đổi tên biến trong file .md không âm thầm sinh prompt còn chỗ trống.
  test("ask/answer nạp được và điền hết biến", () => {
    const p = loadPrompt("ask/answer");
    expect(p.system.trim().length).toBeGreaterThan(0);
    expect(p.user.trim().length).toBeGreaterThan(0);
    const filled = render(p.user, {
      question: "câu hỏi",
      as_of: "2026-06-01",
      question_analysis: "{}",
      context_nodes: "[]",
      relations: "[]",
    });
    expect(filled).not.toMatch(/\{\{\s*\w+\s*\}\}/);
  });

  test("ask/analyze-question nạp được và điền hết biến", () => {
    const p = loadPrompt("ask/analyze-question");
    expect(p.system.trim().length).toBeGreaterThan(0);
    const filled = render(p.user, {
      question: "câu hỏi",
      today: "2026-06-01",
      as_of_ui: "",
      conversation_context: "[]",
    });
    expect(filled).not.toMatch(/\{\{\s*\w+\s*\}\}/);
  });
});

describe("POST /v1/ask", () => {
  test("câu hỏi quá ngắn trả 400", async () => {
    const { status, body } = await ask({ question: "a" });
    expect(status).toBe(400);
    expect(body.error.code).toBe("tham_so_khong_hop_le");
  });

  test("có căn cứ: mọi trích dẫn đều tồn tại và có hiệu lực tại asOf", async () => {
    const { status, body } = await ask({
      question: `${MARK} Thời hạn thẩm định kế hoạch thử nghiệm là bao nhiêu ngày?`,
      asOf: AS_OF_TRUOC,
    });
    expect(status).toBe(200);
    expect(body.retrieval.total).toBeGreaterThan(0);
    expect(body.citations.length).toBeGreaterThan(0);
    for (const cit of body.citations) {
      expect(cit.exists).toBe(true);
      expect(cit.effective).toBe(true);
      expect(cit.urn).toStartWith(`${URN_GOC}#`);
      expect(cit.validFrom).not.toBeNull();
    }
    expect(body.disclaimer).toBe(DISCLAIMER);
  });

  test("BẤT BIẾN: không có trích dẫn hợp lệ thì không được đưa ra kết luận", async () => {
    const cauHoi = [
      `${MARK} Quy định về xuất khẩu cá tra sang Hoa Kỳ như thế nào?`,
      `${MARK} Mức phạt vi phạm nồng độ cồn khi lái xe máy là bao nhiêu?`,
      `${MARK} Thủ tục cấp hộ chiếu phổ thông gồm những bước nào?`,
    ];
    for (const q of cauHoi) {
      const { body } = await ask({ question: q, asOf: AS_OF_TRUOC });
      if (body.citations.length === 0) {
        expect(body.insufficientBasis).toBe(true);
        expect(body.answer).toBe(NO_BASIS_ANSWER);
      } else {
        expect(body.insufficientBasis).toBe(false);
        expect(body.answer).not.toBe(NO_BASIS_ANSWER);
      }
    }
  });

  test("câu hỏi ngoài phạm vi dữ liệu -> insufficientBasis = true", async () => {
    const { body } = await ask({
      question: `${MARK} Quy định về xuất khẩu cá tra sang thị trường Hoa Kỳ ra sao?`,
      asOf: AS_OF_TRUOC,
    });
    expect(body.retrieval.total).toBe(0);
    expect(body.citations).toEqual([]);
    expect(body.insufficientBasis).toBe(true);
    expect(body.answer).toBe(NO_BASIS_ANSWER);
  });

  test("mở rộng ngữ cảnh bằng đồ thị được ghi lại", async () => {
    const { body } = await ask({
      question: `${MARK} Cơ quan chuyên môn thẩm định kế hoạch thử nghiệm trong thời hạn bao lâu?`,
      asOf: AS_OF_TRUOC,
      maxExpand: 10,
    });
    expect(body.retrieval.expanded).toBeGreaterThanOrEqual(0);
    expect(body.retrieval.hits.some((h: any) => h.matchedBy.includes("graph"))).toBe(true);
  });

  test("trích dẫn nút đã bãi bỏ được gắn cờ cảnh báo", async () => {
    const { body } = await ask({
      question: `${MARK} Tổ chức, cá nhân có liên quan có thuộc đối tượng áp dụng không?`,
      asOf: AS_OF_SAU,
      includeRepealed: true,
      topK: 3,
    });
    const coBaiBo = body.rejectedCitations
      .concat(body.citations)
      .some((x: any) => x.nodeStatus === "repealed");
    if (coBaiBo) {
      expect(body.flags).toContain("trich_dan_da_bi_bai_bo");
      expect(body.warnings.some((w: string) => w.includes("bãi bỏ"))).toBe(true);
    }
  });

  test("ở chế độ mock vẫn trả truy xuất đầy đủ và nêu rõ trong note", async () => {
    const { body } = await ask({
      question: `${MARK} Kế hoạch thử nghiệm gồm những nội dung nào?`,
      asOf: AS_OF_TRUOC,
    });
    expect(body.mock).toBe(isMock());
    if (isMock()) {
      expect(body.note).toContain("ANTHROPIC_API_KEY");
      expect(body.retrieval.hits.length).toBeGreaterThan(0);
      expect(body.retrieval.hits[0].snippet.length).toBeGreaterThan(0);
    }
  });

  test("ghi log vào bảng ask_logs", async () => {
    const q = `${MARK} Ai có thẩm quyền phê duyệt kế hoạch thử nghiệm?`;
    const { body } = await ask({ question: q, asOf: AS_OF_TRUOC });
    expect(body.id).not.toBeNull();
    const [row] = await sql<
      Array<{
        question: string;
        as_of: Date;
        answer: string;
        citations: unknown;
        retrieval: unknown;
        faithful: boolean;
      }>
    >`SELECT question, as_of, answer, citations, retrieval, faithful FROM ask_logs WHERE id = ${body.id}::uuid`;
    expect(row).toBeDefined();
    expect(row!.question).toBe(q);
    // Cột jsonb phải là mảng thật, không phải chuỗi JSON hai lần.
    expect(Array.isArray(row!.citations)).toBe(true);
    expect(Array.isArray(row!.retrieval)).toBe(true);
    expect(row!.faithful).toBe(!body.insufficientBasis);
    const [t] = await sql<Array<{ t: string }>>`
      SELECT jsonb_typeof(citations) AS t FROM ask_logs WHERE id = ${body.id}::uuid`;
    expect(t!.t).toBe("array");
  });
});
