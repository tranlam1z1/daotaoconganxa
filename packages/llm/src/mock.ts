/**
 * Provider mock/replay: dùng khi không có ANTHROPIC_API_KEY.
 * - Nếu có bản ghi trong LLM_CACHE_DIR khớp hash yêu cầu -> phát lại (replay thật).
 * - Nếu không -> sinh kết quả tất định theo quy tắc, đủ để pipeline chạy và test được.
 * Nhờ vậy toàn bộ hệ thống chạy end-to-end mà không tốn chi phí; cắm key vào là chạy thật.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LlmProvider, LlmRequest, LlmResponse } from "./types.ts";
import { modelFor } from "./types.ts";

export function requestHash(req: LlmRequest): string {
  const material = JSON.stringify({
    tier: req.tier,
    promptName: req.promptName,
    promptVersion: req.promptVersion,
    system: req.system,
    cacheableSystem: req.cacheableSystem,
    user: req.user,
    images: req.images?.map((i) => Bun.hash(i.base64).toString(16)),
    pdfs: req.pdfs?.map((p) => Bun.hash(p.base64).toString(16)),
    docs: req.docs?.map((d) => [d.key, Bun.hash(d.text).toString(16)]),
    jsonSchema: req.jsonSchema,
  });
  return Bun.hash(material).toString(16);
}

export class MockProvider implements LlmProvider {
  readonly name = "mock";
  constructor(private cacheDir = process.env.LLM_CACHE_DIR ?? "./data/llm-cache") {}

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const hash = requestHash(req);
    const file = join(this.cacheDir, `${req.promptName}.${hash}.json`);
    try {
      const cached = JSON.parse(await readFile(file, "utf8")) as LlmResponse;
      return { ...cached, fromCache: true };
    } catch {
      // không có bản ghi -> sinh kết quả tất định
    }
    const res = synthesize(req);
    await mkdir(this.cacheDir, { recursive: true }).catch(() => {});
    await writeFile(file, JSON.stringify(res, null, 2)).catch(() => {});
    return res;
  }
}

function synthesize(req: LlmRequest): LlmResponse {
  const model = modelFor(req.tier);
  const base: LlmResponse = {
    text: "",
    citations: [],
    model,
    tokensIn: Math.ceil(req.user.length / 3),
    tokensOut: 0,
    cacheReadTokens: 0,
    costUsd: 0,
    fromCache: true,
    stopReason: "end_turn",
  };
  if (req.promptName === "dao-tao/sinh-cau-hoi-ngan-hang") {
    const json = mockCauHoiNganHang(req.user);
    const text = JSON.stringify(json);
    return { ...base, json, text, tokensOut: Math.ceil(text.length / 3) };
  }
  if (req.promptName === "dao-tao/cham-tu-luan") {
    const json = mockChamTuLuan(req.user);
    const text = JSON.stringify(json);
    return { ...base, json, text, tokensOut: Math.ceil(text.length / 3) };
  }
  if (req.promptName === "dao-tao/dan-y-tu-van-ban") {
    const json = mockDanY(nutNguCanh(req.user), Number(/SỐ BÀI TỐI ĐA:\s*(\d+)/.exec(req.user)?.[1] ?? 6));
    const text = JSON.stringify(json);
    return { ...base, json, text, tokensOut: Math.ceil(text.length / 3) };
  }
  if (req.promptName === "dao-tao/soan-bai-hoc" || req.promptName === "dao-tao/sinh-bai-tap") {
    const nut = nutNguCanh(req.user);
    const json = req.promptName === "dao-tao/soan-bai-hoc" ? mockKhoiBaiHoc(nut) : mockBaiTap(nut, req.user);
    const text = JSON.stringify(json);
    return { ...base, json, text, tokensOut: Math.ceil(text.length / 3) };
  }
  if (req.promptName === "nhom-hoc/goi-y-thu-tu" || req.promptName === "nhom-hoc/tom-tat-tien-do") {
    const duLieu = duLieuNhomHoc(req.user);
    const json =
      req.promptName === "nhom-hoc/goi-y-thu-tu" ? mockGoiYThuTu(duLieu) : mockTomTatTienDo(duLieu);
    const text = JSON.stringify(json);
    return { ...base, json, text, tokensOut: Math.ceil(text.length / 3) };
  }
  if (req.jsonSchema) {
    // Trả về cấu trúc rỗng hợp lệ theo schema để pipeline không vỡ.
    const empty = emptyForSchema(req.jsonSchema);
    return { ...base, json: empty, text: JSON.stringify(empty) };
  }
  const cited = req.docs?.[0];
  const text = cited
    ? `[MOCK] Chưa cấu hình ANTHROPIC_API_KEY nên không sinh được câu trả lời. Ngữ cảnh đã truy xuất: ${req.docs?.length} đoạn, đoạn đầu: ${cited.title}.`
    : "[MOCK] Chưa cấu hình ANTHROPIC_API_KEY.";
  return {
    ...base,
    text,
    citations: cited ? [{ docKey: cited.key, citedText: cited.text.slice(0, 120) }] : [],
    tokensOut: Math.ceil(text.length / 3),
  };
}

/**
 * Câu hỏi ngân hàng giả lập (docs/PLAN.md GĐ8), dựng thẳng từ nguyên văn các điều khoản trong
 * ngữ cảnh (`### <urn>` rồi nhãn, tiêu đề, nội dung): câu đúng/sai "nội dung này thuộc điều nào"
 * và câu một đáp án chọn điều khoản. Căn cứ luôn là URN có trong ngữ cảnh, nên kết quả qua được
 * hậu kiểm, đủ để chạy trọn luồng sinh → hậu kiểm → chờ duyệt mà không cần khóa API.
 */
/**
 * Các khối `### <urn>` của ngữ cảnh. Mọi prompt đều chốt bằng một đoạn câu lệnh đứng sau ngữ cảnh
 * ("Soạn 8 câu hỏi…"); bỏ đoạn cuối đó, không thì nó thành nội dung của điều khoản cuối.
 */
export function khoiNguCanh(user: string): string[] {
  const s = user.trimEnd();
  const cat = s.lastIndexOf("\n\n");
  return (cat < 0 ? s : s.slice(0, cat)).split(/^### /m).slice(1);
}

function mockCauHoiNganHang(user: string): { cau_hoi: unknown[] } {
  const soCau = Math.max(0, Number(/SỐ CÂU CẦN SOẠN:\s*(\d+)/.exec(user)?.[1] ?? 5));
  // Dòng loại câu dạng "mot_dap_an (Một đáp án), tu_luan (Tự luận)": chỉ lấy mã loại.
  const loai: string[] =
    (/LOẠI CÂU ĐƯỢC DÙNG:\s*(.*)/.exec(user)?.[1] ?? "").match(
      /\b(?:mot_dap_an|nhieu_dap_an|dung_sai|dien_khuyet|sap_xep|ghep_cap|tu_luan)\b/g,
    ) ?? [];
  const mucDo = /MỨC ĐỘ:\s*(de|trung_binh|kho)\b/.exec(user)?.[1];
  const nut = khoiNguCanh(user)
    .map((khoi) => {
      const [urn = "", nhan = "", ...noiDung] = khoi.trim().split("\n");
      const text = noiDung.join(" ").replace(/\s+/g, " ").trim();
      return {
        urn: urn.trim(),
        nhan: nhan.trim(),
        text: text.length > 180 ? `${text.slice(0, 180)}…` : text,
      };
    })
    .filter((n) => n.urn && n.text);
  if (!nut.length) return { cau_hoi: [] };

  const chiTuLuan = loai.length > 0 && loai.every((l) => l === "tu_luan");
  const coTuLuan = loai.includes("tu_luan");
  const dungMotDapAn = (loai.includes("mot_dap_an") || !loai.includes("dung_sai")) && nut.length >= 2;
  const dungDungSai = loai.includes("dung_sai") || !dungMotDapAn;
  const mucCua = (i: number) => mucDo ?? (["de", "trung_binh", "kho"] as const)[i % 3];

  return {
    cau_hoi: Array.from({ length: soCau }, (_, i) => {
      const n = nut[i % nut.length]!;
      const vong = Math.floor(i / nut.length);
      // Câu tự luận: tình huống áp dụng một điều khoản, rubric theo định dạng của prompt.
      if (chiTuLuan || (coTuLuan && i % 3 === 2)) {
        return {
          kind: "tu_luan",
          level: mucCua(i),
          stem: `${vong ? `(Lượt ${vong + 1}) ` : ""}Tình huống: cán bộ cần áp dụng quy định "${n.text}". Nêu căn cứ và hướng xử lý.`,
          explanation: `Viện dẫn ${n.nhan}; nêu nội dung quy định và áp dụng vào tình huống.`,
          citations: [n.urn],
          rubric: {
            tieu_chi: [
              {
                ma: "can_cu",
                ten: "Căn cứ pháp lý",
                trong_so: 60,
                muc: [
                  { diem: 0, mo_ta: "Không nêu hoặc dùng văn bản hết hiệu lực" },
                  { diem: 4, mo_ta: `Viện dẫn đúng ${n.nhan}` },
                ],
              },
              {
                ma: "ap_dung",
                ten: "Áp dụng vào tình huống",
                trong_so: 40,
                muc: [
                  { diem: 0, mo_ta: "Không áp dụng" },
                  { diem: 4, mo_ta: "Áp dụng đúng" },
                ],
              },
            ],
            nguong_dat: 50,
          },
        };
      }
      const chon = dungMotDapAn && (!dungDungSai || i % 2 === 1);
      if (chon) {
        const khac = nut.filter((x) => x.urn !== n.urn).slice(0, 3);
        const ds = [n, ...khac].sort((a, b) => a.urn.localeCompare(b.urn));
        return {
          kind: "mot_dap_an",
          level: mucCua(i),
          stem: `${vong ? `(Lượt ${vong + 1}) ` : ""}Quy định nào có nội dung: "${n.text}"?`,
          options: { phuong_an: ds.map((x, k) => ({ id: String.fromCharCode(97 + k), text: x.nhan })) },
          answer: { dung: [String.fromCharCode(97 + ds.indexOf(n))] },
          explanation: `Nội dung này là nguyên văn ${n.nhan}.`,
          citations: [n.urn],
        };
      }
      // Câu đúng/sai: xen kẽ nhận định đúng và nhận định gán nhầm sang điều khoản khác.
      const nham = nut.length > 1 && vong % 2 === 1 ? nut[(i + 1) % nut.length]! : undefined;
      return {
        kind: "dung_sai",
        level: mucCua(i),
        stem: `${vong ? `(Lượt ${vong + 1}) ` : ""}${(nham ?? n).nhan} quy định: "${n.text}"`,
        answer: { dung: [nham ? "sai" : "dung"] },
        explanation: nham
          ? `Sai. Nội dung này thuộc ${n.nhan}, không phải ${nham.nhan}.`
          : `Đúng. Đây là nguyên văn ${n.nhan}.`,
        citations: [n.urn],
      };
    }),
  };
}

interface NutNguCanh {
  urn: string;
  nhan: string;
  /** Dòng nội dung đầu tiên, là một đoạn liền của nguyên văn nên dùng làm trích dẫn được. */
  dau: string;
}

/**
 * Các nút trong phần NGỮ CẢNH của prompt soạn bài (`### <urn>`, rồi nhãn, rồi nội dung). Chỉ
 * tách sau tiêu đề NGỮ CẢNH: phần nội dung bài học đứng trước có thể có tiêu đề Markdown `###`.
 */
function nutNguCanh(user: string): NutNguCanh[] {
  const i = user.indexOf("NGỮ CẢNH");
  return khoiNguCanh(i < 0 ? "" : user.slice(i))
    .map((khoi) => {
      const [urn = "", nhan = "", ...noiDung] = khoi.trim().split("\n");
      return { urn: urn.trim(), nhan: nhan.trim(), dau: noiDung.map((d) => d.trim()).find(Boolean) ?? "" };
    })
    .filter((n) => n.urn && n.dau);
}

const rutGon = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

/**
 * Chấm tự luận giả lập: bài từ 200 ký tự được mức cao nhất của mỗi tiêu chí, ngắn hơn được 0;
 * riêng tiêu chí `can_cu` chỉ có điểm khi bài nhắc tới "Điều". Bằng chứng là đầu bài làm, nên qua
 * được hậu kiểm bằng chứng.
 */
function mockChamTuLuan(user: string): unknown {
  const baiLam = /<<<BAI_LAM\n([\s\S]*?)\nBAI_LAM>>>/.exec(user)?.[1]?.trim() ?? "";
  const dongRubric = /RUBRIC:\n(.*)/.exec(user)?.[1] ?? "{}";
  let rubric: { tieu_chi?: Array<{ ma: string; muc: Array<{ diem: number }> }> } = {};
  try {
    rubric = JSON.parse(dongRubric);
  } catch {}
  const du = baiLam.length >= 200;
  const coCanCu = /Điều\s+\d+/i.test(baiLam);
  return {
    tieu_chi: (rubric.tieu_chi ?? []).map((tc) => {
      const cao = Math.max(...tc.muc.map((m) => m.diem));
      const dat = du && (tc.ma !== "can_cu" || coCanCu);
      return {
        ma: tc.ma,
        diem: dat ? cao : 0,
        nhan_xet: dat ? "Đạt yêu cầu của tiêu chí." : "Chưa đạt: bổ sung nội dung và viện dẫn điều khoản.",
        bang_chung: baiLam.slice(0, 40),
      };
    }),
    tom_tat: du ? "Bài trình bày đủ ý." : "Bài còn quá ngắn, chưa đủ để đánh giá.",
  };
}

/** Dàn ý giả lập: chia các điều khoản theo thứ tự thành tối đa `soBai` nhóm liền nhau, mỗi nhóm một bài. */
function mockDanY(nut: NutNguCanh[], soBai: number): { bai: unknown[] } {
  const n = Math.max(1, Math.min(soBai, nut.length));
  const moiBai = Math.ceil(nut.length / n);
  const bai: unknown[] = [];
  for (let i = 0; i < nut.length; i += moiBai) {
    const nhom = nut.slice(i, i + moiBai);
    bai.push({
      tieu_de: `Áp dụng ${nhom[0]!.nhan}`,
      tom_tat: `Nắm và áp dụng đúng ${nhom.map((x) => x.nhan).join("; ")}.`,
      can_cu: nhom.map((x) => x.urn),
    });
  }
  return { bai };
}

/**
 * Bài học giả lập (ke-hoach/09-a §5): giảng mở bài, thẻ căn cứ chép nguyên dòng đầu của từng
 * điều khoản, câu hỏi nhanh, thẻ lật, chốt lại. Mọi viện dẫn lấy từ ngữ cảnh nên qua được hậu kiểm.
 */
function mockKhoiBaiHoc(nut: NutNguCanh[]): { khoi: unknown[] } {
  if (!nut.length) {
    return {
      khoi: [
        {
          kind: "canh_bao",
          data: { md: "Chưa đủ căn cứ trong kho — cần quản trị viên nội dung bổ sung.", loai: "thieu_can_cu" },
          citations: [],
        },
      ],
    };
  }
  const n = nut[0]!;
  const khac = nut.filter((x) => x.urn !== n.urn).slice(0, 3);
  const ds = [n, ...khac].sort((a, b) => a.urn.localeCompare(b.urn));
  const hoiNhanh = khac.length
    ? {
        cau_hoi: `Quy định nào có nội dung: "${rutGon(n.dau, 120)}"?`,
        phuong_an: ds.map((x, k) => ({ id: String.fromCharCode(97 + k), text: x.nhan })),
        dap_an: String.fromCharCode(97 + ds.indexOf(n)),
        giai_thich: `Nội dung này là nguyên văn ${n.nhan}.`,
      }
    : {
        cau_hoi: `${n.nhan} quy định: "${rutGon(n.dau, 120)}". Nhận định này đúng hay sai?`,
        phuong_an: [
          { id: "a", text: "Đúng" },
          { id: "b", text: "Sai" },
        ],
        dap_an: "a",
        giai_thich: `Đúng. Đây là nguyên văn ${n.nhan}.`,
      };
  return {
    khoi: [
      {
        kind: "giang",
        data: { md: `Bài này đi qua ${nut.length} quy định: ${nut.map((x) => x.nhan).join("; ")}.` },
        citations: [],
      },
      ...nut.slice(0, 3).map((x) => ({
        kind: "can_cu",
        data: { urn: x.urn, nhan: x.nhan, nguyen_van: x.dau.slice(0, 200) },
        citations: [x.urn],
      })),
      { kind: "hoi_nhanh", data: hoiNhanh, citations: [n.urn] },
      {
        kind: "the_lat",
        data: { the: nut.slice(0, 4).map((x) => ({ truoc: x.nhan, sau: rutGon(x.dau, 160) })) },
        citations: nut.slice(0, 4).map((x) => x.urn),
      },
      {
        kind: "tom_tat",
        data: { y: nut.slice(0, 5).map((x) => `${x.nhan}: ${rutGon(x.dau, 80)}`) },
        citations: [],
      },
    ],
  };
}

/**
 * Bài tập giả lập theo DẠNG BÀI CẦN SOẠN: bài viết có căn cứ kèm rubric hợp lệ (tiêu chí `can_cu`
 * nặng nhất, có mức 0) khi được yêu cầu hoặc khi không nêu dạng; câu trắc nghiệm chọn điều khoản
 * khi được yêu cầu.
 */
function mockBaiTap(nut: NutNguCanh[], user: string): { bai_tap: unknown[] } {
  if (!nut.length) return { bai_tap: [] };
  const dang = /DẠNG BÀI CẦN SOẠN:\s*(.*)/.exec(user)?.[1]?.trim() ?? "";
  const n = nut[0]!;
  const baiTap: unknown[] = [];
  if (!dang || dang.includes("viet_co_can_cu")) {
    baiTap.push({
      kind: "viet_co_can_cu",
      title: `Vận dụng ${n.nhan}`,
      prompt: {
        cau_hoi: `Một đồng nghiệp hỏi anh/chị về nội dung "${rutGon(n.dau, 120)}". Hãy giải thích quy định này và nêu căn cứ.`,
        huong_dan: "Viết 150–300 từ, bắt buộc trích điều khoản áp dụng.",
      },
      answer: { giai_thich: `Nêu đúng ${n.nhan} và giải thích nội dung quy định.` },
      rubric: {
        tieu_chi: [
          {
            ma: "can_cu",
            ten: "Viện dẫn đúng và còn hiệu lực",
            trong_so: 50,
            muc: [
              { diem: 0, mo_ta: "Không viện dẫn, viện dẫn sai hoặc dùng văn bản đã hết hiệu lực" },
              { diem: 25, mo_ta: "Viện dẫn đúng văn bản nhưng sai điều, khoản" },
              { diem: 50, mo_ta: "Viện dẫn đúng điều, khoản còn hiệu lực" },
            ],
          },
          {
            ma: "lap_luan",
            ten: "Lập luận",
            trong_so: 30,
            muc: [
              { diem: 0, mo_ta: "Không giải thích" },
              { diem: 30, mo_ta: "Giải thích đúng nội dung quy định" },
            ],
          },
          {
            ma: "trinh_bay",
            ten: "Trình bày",
            trong_so: 20,
            muc: [
              { diem: 0, mo_ta: "Khó hiểu" },
              { diem: 20, mo_ta: "Rõ ràng, mạch lạc" },
            ],
          },
        ],
        nguong_dat: 60,
      },
      citations: [n.urn],
      error_tags: [],
      level: 1,
      points: 10,
    });
  }
  const khac = nut.filter((x) => x.urn !== n.urn).slice(0, 3);
  if (dang.includes("trac_nghiem") && khac.length) {
    const ds = [n, ...khac].sort((a, b) => a.urn.localeCompare(b.urn));
    const id = (x: NutNguCanh) => String.fromCharCode(97 + ds.indexOf(x));
    baiTap.push({
      kind: "trac_nghiem",
      title: "Chọn điều khoản",
      // Phương án trong đề kèm `dung` như mô hình thật hay viết: hậu kiểm phải tách đáp án ra.
      prompt: {
        cau_hoi: `Quy định nào có nội dung: "${rutGon(n.dau, 120)}"?`,
        phuong_an: ds.map((x) => ({ id: id(x), text: x.nhan, dung: x === n })),
      },
      answer: { giai_thich: `Nội dung này là nguyên văn ${n.nhan}.` },
      citations: [n.urn],
      level: 1,
    });
  }
  return { bai_tap: baiTap };
}

/** Dòng JSON "DỮ LIỆU" trong prompt của nhóm học cùng (docs/PLAN.md GĐ16d). */
function duLieuNhomHoc(user: string): any {
  const dong = user.split("\n").find((l) => l.trim().startsWith("{"));
  try {
    return dong ? JSON.parse(dong) : {};
  } catch {
    return {};
  }
}

/**
 * Gợi ý thứ tự học giả lập (GĐ16d, AI-1): bài học trước đề ôn tập; trong mỗi loại, mục có hạn gợi
 * ý gần hơn trước, không hạn thì giữ thứ tự cũ. Chỉ dùng mã mục, không số, nên qua được hậu kiểm.
 */
function mockGoiYThuTu(d: any): { thu_tu: string[]; ghi_chu: string } {
  const muc: any[] = Array.isArray(d.muc) ? d.muc : [];
  const han = (m: any) =>
    typeof m.so_ngay_den_han === "number" ? m.so_ngay_den_han : Number.POSITIVE_INFINITY;
  const thuTu = muc
    .map((m, i) => ({ m, i }))
    .sort(
      (a, b) =>
        (a.m.loai === "bai_hoc" ? 0 : 1) - (b.m.loai === "bai_hoc" ? 0 : 1) ||
        han(a.m) - han(b.m) ||
        a.i - b.i,
    )
    .map((x) => String(x.m.ma));
  return {
    thu_tu: thuTu,
    ghi_chu: "Bài học đặt trước đề ôn tập. Trong mỗi loại, mục có hạn gợi ý gần hơn đặt trước.",
  };
}

/**
 * Tóm tắt tiến độ giả lập (GĐ16d, AI-2): 3–4 câu dựng từ số liệu có sẵn trong đầu vào (trung bình,
 * mục có tỷ lệ hoàn thành thấp nhất, thành viên chưa bắt đầu, thành viên lâu chưa học), chỉ dùng
 * mã TVn, Mn. Mọi con số lấy nguyên từ đầu vào, nên qua được hậu kiểm.
 */
function mockTomTatTienDo(d: any): { nhan_xet: string[]; muc_can_chu_y: string[] } {
  const muc: any[] = Array.isArray(d.muc) ? d.muc : [];
  const tv: any[] = Array.isArray(d.thanh_vien) ? d.thanh_vien : [];
  const cau: string[] = [];
  cau.push(
    typeof d.trung_binh_nhom === "number"
      ? `Tiến độ trung bình của ${d.so_thanh_vien} thành viên trong phạm vi là ${d.trung_binh_nhom}%.`
      : `Nhóm có ${d.so_thanh_vien} thành viên trong phạm vi, chưa có mục nào được tính tiến độ.`,
  );
  const tangDan = [...muc].sort((a, b) => a.ty_le_hoan_thanh - b.ty_le_hoan_thanh);
  const thap = tangDan[0];
  cau.push(
    thap
      ? `Mục ${thap.ma} có tỷ lệ hoàn thành thấp nhất, ${thap.ty_le_hoan_thanh}% thành viên đã xong.`
      : "Nhóm chưa có mục nào được tính vào tiến độ.",
  );
  const chuaBatDau = tv.filter((t) => Object.values(t.phan_tram_tung_muc ?? {}).every((v) => v === 0));
  cau.push(
    chuaBatDau.length
      ? `Thành viên chưa bắt đầu mục nào: ${chuaBatDau.map((t) => t.ma).join(", ")}.`
      : "Mọi thành viên đã bắt đầu ít nhất một mục.",
  );
  const lau = tv
    .filter((t) => typeof t.so_ngay_tu_lan_hoc_gan_nhat === "number" && t.so_ngay_tu_lan_hoc_gan_nhat >= 7)
    .sort((a, b) => b.so_ngay_tu_lan_hoc_gan_nhat - a.so_ngay_tu_lan_hoc_gan_nhat)[0];
  if (lau) cau.push(`${lau.ma} chưa học trong ${lau.so_ngay_tu_lan_hoc_gan_nhat} ngày gần đây.`);
  return {
    nhan_xet: cau,
    muc_can_chu_y: tangDan
      .filter((m) => m.ty_le_hoan_thanh < 50)
      .slice(0, 3)
      .map((m) => String(m.ma)),
  };
}

function emptyForSchema(schema: any): unknown {
  if (!schema || typeof schema !== "object") return null;
  if (schema.type === "array") return [];
  if (schema.type === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(schema.properties ?? {})) out[k] = emptyForSchema(v);
    return out;
  }
  if (schema.type === "string") return "";
  if (schema.type === "number" || schema.type === "integer") return 0;
  if (schema.type === "boolean") return false;
  return null;
}
