/**
 * Nạp lại các chuỗi hiển thị đã được viết lại theo QUY-TAC-HANH-VAN.md vào CSDL.
 *
 * Script này CHỈ UPDATE. Không xoá dòng nào, không đổi trạng thái xuất bản, không đụng tới
 * tiến độ hay bài làm của người học — khác với `bun run db:seed:dao-tao`, vốn xoá và chèn lại
 * toàn bộ khối nội dung của bài 1 và bài 5.
 *
 * Nhân vật và lời thoại lấy trực tiếp từ mã nguồn (@qdpl/mascot). Nội dung bài học sửa theo
 * bảng cặp chuỗi cũ → mới bên dưới; mỗi cặp là một chuỗi đầy đủ, không dùng thay thế bộ phận,
 * để không có chuỗi nào bị sửa nhầm một nửa.
 *
 * Chạy thử (không ghi):  bun run scripts/cap-nhat-hanh-van.ts --thu
 * Chạy thật:             bun run scripts/cap-nhat-hanh-van.ts
 */

import { HANH_DONG_GOC, NHAN_VAT_GOC } from "@qdpl/mascot";
import { sql } from "../packages/db/src/client.ts";

const THU = process.argv.includes("--thu");

const SLUG_CHUYEN_DE = "dau-tu-cntt-ngan-sach-nha-nuoc";

const TOM_TAT_CU =
  "Đi hết vòng đời một dự án CNTT dùng ngân sách nhà nước, bám đúng khung pháp lý hiện hành và " +
  "dạy luôn cách xử lý khi khung pháp lý đổi giữa chừng.";

const TOM_TAT_MOI =
  "Trình bày trọn vòng đời một dự án công nghệ thông tin sử dụng ngân sách nhà nước theo khung " +
  "pháp lý đang có hiệu lực, kèm cách xác định văn bản áp dụng khi khung pháp lý thay đổi.";

/**
 * Cặp chuỗi cũ → mới cho nội dung bài học và bài tập.
 * Xếp chuỗi dài trước chuỗi ngắn: không cặp nào được là chuỗi con của cặp đứng sau nó.
 */
const CAP_CHUOI: ReadonlyArray<readonly [string, string]> = [
  // --- Bài 1: khối giảng ---
  [
    "Việc đầu tiên của mọi hồ sơ đầu tư CNTT không phải là viết, mà là **xác định khung văn bản áp dụng " +
      "tại thời điểm của hồ sơ**. Một mẫu tờ trình đúng của năm ngoái có thể sai hoàn toàn trong năm nay, " +
      "không phải vì viết dở mà vì căn cứ của nó đã bị bãi bỏ.\n\n" +
      "Khung pháp lý của lĩnh vực này đã đổi **ba lần trong 18 tháng**. Đó không phải trường hợp cá biệt; " +
      "đó là điều kiện làm việc bình thường mà bạn phải có cách xử lý.",
    "Việc đầu tiên khi lập một hồ sơ đầu tư ứng dụng công nghệ thông tin là **xác định khung văn bản " +
      "áp dụng tại thời điểm của hồ sơ**. Một mẫu tờ trình đúng ở năm trước có thể không còn đúng ở năm " +
      "sau, do căn cứ ban hành của mẫu đó đã bị bãi bỏ.\n\n" +
      "Khung pháp lý của lĩnh vực này đã thay đổi **ba lần trong 18 tháng**. Việc thay đổi văn bản áp " +
      "dụng là tình huống thường gặp, cần được xử lý theo một trình tự thống nhất.",
  ],

  // --- Bài 1: kịch bản mở đầu ---
  [
    "Em vừa lấy mẫu tờ trình của dự án năm ngoái ra dùng lại.",
    "Tôi lấy lại mẫu tờ trình của dự án năm trước để dùng cho hồ sơ này.",
  ],
  ["… em chưa kiểm.", "Tôi chưa kiểm tra nội dung đó."],

  // --- Bài 1: dòng thời gian ---
  [
    "Dự án đã có quyết định đầu tư trước 01/7/2026 vẫn theo NĐ 45/2026 (điều khoản chuyển tiếp).",
    "Dự án đã có quyết định đầu tư trước ngày 01/7/2026 tiếp tục áp dụng Nghị định số 45/2026/NĐ-CP " +
      "theo điều khoản chuyển tiếp.",
  ],
  [
    "NĐ 224/2026/NĐ-CP có hiệu lực, bãi bỏ NĐ 45/2026",
    "Nghị định số 224/2026/NĐ-CP có hiệu lực, bãi bỏ Nghị định số 45/2026/NĐ-CP",
  ],
  ["NĐ 45/2026/NĐ-CP có hiệu lực", "Nghị định số 45/2026/NĐ-CP có hiệu lực"],
  [
    "TT 39/2026 và TT 41/2026/TT-BKHCN có hiệu lực",
    "Thông tư số 39/2026/TT-BKHCN và Thông tư số 41/2026/TT-BKHCN có hiệu lực",
  ],

  // --- Bài 1: hỏi nhanh ---
  [
    "Điều 91 NĐ 224/2026 cho phép dự án đã có quyết định đầu tư trước 01/7/2026 tiếp tục theo " +
      "NĐ 45/2026, trừ khi cấp có thẩm quyền chọn chuyển sang khung mới.",
    "Điều 91 Nghị định số 224/2026/NĐ-CP cho phép dự án đã có quyết định đầu tư trước ngày 01/7/2026 " +
      "tiếp tục áp dụng Nghị định số 45/2026/NĐ-CP, trừ trường hợp cấp có thẩm quyền quyết định áp " +
      "dụng văn bản mới.",
  ],
  ["NĐ 224/2026 vì đang là văn bản hiện hành", "Nghị định số 224/2026/NĐ-CP, vì là văn bản đang có hiệu lực"],
  ["NĐ 45/2026 theo điều khoản chuyển tiếp", "Nghị định số 45/2026/NĐ-CP, theo điều khoản chuyển tiếp"],

  // --- Bài 1: cảnh báo ---
  [
    "Đừng bao giờ chép danh mục căn cứ từ một hồ sơ cũ. Chép danh mục căn cứ là cách nhanh nhất " +
      "để mang một văn bản đã hết hiệu lực vào hồ sơ mới.",
    "Không sao chép danh mục căn cứ từ hồ sơ cũ. Sao chép danh mục căn cứ là nguyên nhân phổ biến " +
      "đưa một văn bản đã hết hiệu lực vào hồ sơ mới.",
  ],

  // --- Bài 1: thẻ lật ---
  [
    "Thời điểm mà ta hỏi hệ thống: 'lúc đó luật quy định thế nào?'",
    "Thời điểm được chọn để tra cứu: nội dung quy định có hiệu lực tại ngày đó.",
  ],

  // --- Bài 1: tóm tắt ---
  [
    "Xác định khung văn bản áp dụng trước khi viết bất cứ dòng nào.",
    "Xác định khung văn bản áp dụng trước khi soạn thảo hồ sơ.",
  ],
  [
    "Khung pháp lý đổi liên tục — coi đó là điều kiện làm việc bình thường.",
    "Khung pháp lý thay đổi thường xuyên; mỗi hồ sơ phải xác định lại văn bản áp dụng.",
  ],
  [
    "Điều khoản chuyển tiếp quyết định hồ sơ đang dở theo văn bản nào.",
    "Điều khoản chuyển tiếp quyết định hồ sơ đang thực hiện theo văn bản nào.",
  ],
  ["Không chép danh mục căn cứ từ hồ sơ cũ.", "Không sao chép danh mục căn cứ từ hồ sơ cũ."],

  // --- Bài 1: hoạt động ---
  [
    "Điều 91 khoản 2 NĐ 224/2026 nêu hai điều kiện thay thế nhau: đã có quyết định đầu tư " +
      "HOẶC đã có báo cáo thẩm định trước 01/7/2026.",
    "Khoản 2 Điều 91 Nghị định số 224/2026/NĐ-CP nêu hai điều kiện thay thế nhau: đã có quyết định " +
      "đầu tư hoặc đã có báo cáo thẩm định trước ngày 01/7/2026.",
  ],
  [
    "NĐ 45/2026 — vì đã có báo cáo thẩm định trước 01/7/2026",
    "Nghị định số 45/2026/NĐ-CP, vì đã có báo cáo thẩm định trước ngày 01/7/2026",
  ],
  [
    "NĐ 224/2026 — vì quyết định đầu tư ban hành sau 01/7/2026",
    "Nghị định số 224/2026/NĐ-CP, vì quyết định đầu tư ban hành sau ngày 01/7/2026",
  ],
  [
    "NĐ 64/2007 — vì là văn bản gốc của lĩnh vực",
    "Nghị định số 64/2007/NĐ-CP, vì là văn bản gốc của lĩnh vực",
  ],
  ["Đúng: đã có báo cáo thẩm định trước mốc.", "Đúng: đã có báo cáo thẩm định trước mốc 01/7/2026."],
  [
    "NĐ 64/2007 đã bị Điều 90 NĐ 224/2026 bãi bỏ.",
    "Nghị định số 64/2007/NĐ-CP đã bị Điều 90 Nghị định số 224/2026/NĐ-CP bãi bỏ.",
  ],
  [
    "Thời điểm trước, hiệu lực sau, rồi mới tới chuyển tiếp.",
    "Xác định thời điểm trước, tra trạng thái hiệu lực sau, rồi mới đọc điều khoản chuyển tiếp.",
  ],

  // --- Bài 5: khối giảng ---
  [
    "Tổng mức đầu tư của một dự án CNTT dùng ngân sách nhà nước không phải là một con số ước lượng. " +
      "Nó là **tổng của các thành phần được thông tư quy định**, và mỗi thành phần phải chỉ ra được " +
      "cách tính đã dùng.\n\n" +
      "Điểm phải nhớ của bài này: phương pháp lập dự toán phần mềm nội bộ **đã đổi** từ 01/7/2026.",
    "Tổng mức đầu tư của một dự án công nghệ thông tin sử dụng ngân sách nhà nước là **tổng của các " +
      "khoản mục chi phí do thông tư quy định**, không phải một con số ước lượng. Mỗi khoản mục phải " +
      "nêu được phương pháp xác định đã dùng.\n\n" +
      "Phương pháp lập dự toán phần mềm nội bộ **đã thay đổi** kể từ ngày 01/7/2026.",
  ],

  // --- Bài 5: cảnh báo phương pháp ---
  [
    "Phương pháp **Use Case Point** theo Quyết định 671/QĐ-BTTTT không còn là phương pháp pháp định: " +
      "căn cứ ban hành của nó đã hết hiệu lực và TT 39/2026/TT-BKHCN không dẫn chiếu phương pháp này. " +
      "Chỉ dùng nó cho dự án chuyển tiếp áp dụng quy định tại thời điểm phê duyệt.",
    "Phương pháp **điểm trường hợp sử dụng (use case point)** theo Quyết định số 671/QĐ-BTTTT không " +
      "còn là phương pháp pháp định: căn cứ ban hành đã hết hiệu lực và Thông tư số 39/2026/TT-BKHCN " +
      "không dẫn chiếu phương pháp này. Phương pháp này chỉ áp dụng cho dự án chuyển tiếp theo quy " +
      "định tại thời điểm phê duyệt.",
  ],

  // --- Bài 5: căn cứ, máy tính, tóm tắt ---
  [
    "Thông tư số 39/2026/TT-BKHCN, hiệu lực 01/7/2026",
    "Thông tư số 39/2026/TT-BKHCN, có hiệu lực từ ngày 01/7/2026",
  ],
  [
    "Chế độ chuyển tiếp (Use Case Point) có sẵn nhưng hiện cảnh báo không còn là phương pháp pháp định.",
    "Chế độ chuyển tiếp theo phương pháp điểm trường hợp sử dụng (use case point) vẫn dùng được, " +
      "kèm cảnh báo phương pháp này không còn là phương pháp pháp định.",
  ],
  [
    "Tổng mức đầu tư là tổng các thành phần thông tư quy định, không phải con số ước lượng.",
    "Tổng mức đầu tư là tổng các khoản mục chi phí do thông tư quy định, không phải con số ước lượng.",
  ],
  [
    "Phần mềm nội bộ tính theo công tháng / công ngày và đơn giá cụ thể (TT 39/2026).",
    "Phần mềm nội bộ tính theo công tháng, công ngày và đơn giá cụ thể (Thông tư số 39/2026/TT-BKHCN).",
  ],

  // --- Bài 5: hoạt động ---
  [
    "Dự phòng tối đa 10% của tổng các thành phần còn lại (TT 39/2026/TT-BKHCN).",
    "Dự phòng tối đa 10% của tổng các khoản mục còn lại (Thông tư số 39/2026/TT-BKHCN).",
  ],
  [
    "TT 39/2026/TT-BKHCN quy định báo giá theo công tháng/công ngày và đơn giá cụ thể.",
    "Thông tư số 39/2026/TT-BKHCN quy định báo giá theo công tháng, công ngày và đơn giá cụ thể.",
  ],
  [
    "Căn cứ ban hành của phương pháp này đã hết hiệu lực; chỉ dùng cho dự án chuyển tiếp.",
    "Căn cứ ban hành của phương pháp này đã hết hiệu lực; chỉ áp dụng cho dự án chuyển tiếp.",
  ],
  [
    "TT 39/2026 không ấn định tỷ lệ phần trăm cho các hạng mục này.",
    "Thông tư số 39/2026/TT-BKHCN không ấn định tỷ lệ phần trăm cho các hạng mục này.",
  ],
  [
    "Công tháng / công ngày và đơn giá cụ thể theo TT 39/2026",
    "Công tháng, công ngày và đơn giá cụ thể theo Thông tư số 39/2026/TT-BKHCN",
  ],
  ["Use Case Point theo QĐ 671/QĐ-BTTTT", "Điểm trường hợp sử dụng theo Quyết định số 671/QĐ-BTTTT"],
  ["Công tháng / đơn giá", "Công tháng, công ngày và đơn giá cụ thể"],
  ["Use Case Point", "Điểm trường hợp sử dụng"],
];

/**
 * Chuỗi JSON chuẩn hoá: khoá của mọi đối tượng được sắp xếp. Postgres lưu `jsonb` với thứ tự
 * khoá riêng, nên so sánh bằng JSON.stringify thô sẽ báo khác nhau ở những bản ghi thực ra
 * giống hệt.
 */
function chuanHoa(giaTri: unknown): string {
  const di = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(di);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, x]) => [k, di(x)]),
      );
    }
    return v;
  };
  return JSON.stringify(di(giaTri));
}

/** Áp bảng cặp chuỗi lên một giá trị JSON; trả về null nếu không có gì đổi. */
function thay<T>(giaTri: T): T | null {
  let s = JSON.stringify(giaTri);
  const goc = s;
  for (const [cu, moi] of CAP_CHUOI) {
    // Đi qua JSON.stringify để chuỗi cũ/mới được thoát đúng như đang nằm trong JSON.
    const cuJson = JSON.stringify(cu).slice(1, -1);
    const moiJson = JSON.stringify(moi).slice(1, -1);
    s = s.split(cuJson).join(moiJson);
  }
  return s === goc ? null : (JSON.parse(s) as T);
}

let soDong = 0;

/* ------------------------------------------------------------------ */
/* 1. Tóm tắt chuyên đề                                                */
/* ------------------------------------------------------------------ */

const chuyenDe = await sql`SELECT id, summary FROM courses WHERE slug = ${SLUG_CHUYEN_DE}`;
if (!chuyenDe.length) {
  console.log(`Không thấy chuyên đề "${SLUG_CHUYEN_DE}".`);
} else if (chuyenDe[0]!.summary !== TOM_TAT_CU) {
  console.log("Tóm tắt chuyên đề không khớp bản cũ, bỏ qua để khỏi ghi đè bản đã sửa tay:");
  console.log(`  đang có: ${chuyenDe[0]!.summary}`);
} else {
  console.log("courses.summary");
  console.log(`  cũ : ${TOM_TAT_CU}`);
  console.log(`  mới: ${TOM_TAT_MOI}`);
  if (!THU) await sql`UPDATE courses SET summary = ${TOM_TAT_MOI} WHERE id = ${chuyenDe[0]!.id}::uuid`;
  soDong += 1;
}

/* ------------------------------------------------------------------ */
/* 2. Nhân vật — lấy thẳng từ mã nguồn                                 */
/* ------------------------------------------------------------------ */

for (const nv of NHAN_VAT_GOC) {
  const dong = await sql`
    SELECT nick_name, role_line, bio, voice FROM mascot_personas WHERE code = ${nv.code}`;
  if (!dong.length) continue;
  const d = dong[0]!;
  const doi =
    d.nick_name !== nv.nickName ||
    d.role_line !== nv.roleLine ||
    d.bio !== (nv.bio ?? null) ||
    chuanHoa(d.voice) !== chuanHoa(nv.voice);
  if (!doi) continue;

  console.log(`mascot_personas[${nv.code}]`);
  console.log(`  cũ : ${d.nick_name} | ${d.role_line}`);
  console.log(`  mới: ${nv.nickName} | ${nv.roleLine}`);
  if (!THU) {
    await sql`
      UPDATE mascot_personas
         SET nick_name = ${nv.nickName}, role_line = ${nv.roleLine}, bio = ${nv.bio ?? null},
             voice = ${sql.json(nv.voice as unknown as Record<string, unknown>)}
       WHERE code = ${nv.code}`;
  }
  soDong += 1;
}

/* ------------------------------------------------------------------ */
/* 3. Lời thoại và lời mời của hành động                               */
/* ------------------------------------------------------------------ */

for (const hd of HANH_DONG_GOC) {
  const dong = await sql`SELECT speech, cta FROM mascot_actions WHERE code = ${hd.code}`;
  if (!dong.length) continue;
  const d = dong[0]!;
  const doi = chuanHoa(d.speech) !== chuanHoa(hd.speech) || chuanHoa(d.cta ?? {}) !== chuanHoa(hd.cta ?? {});
  if (!doi) continue;

  console.log(`mascot_actions[${hd.code}]`);
  for (const s of d.speech as Array<{ text: string }>) console.log(`  cũ : ${s.text}`);
  for (const s of hd.speech) console.log(`  mới: ${s.text}`);
  if (!THU) {
    await sql`
      UPDATE mascot_actions
         SET speech = ${sql.json(hd.speech as unknown as Record<string, unknown>)},
             cta = ${sql.json((hd.cta ?? {}) as unknown as Record<string, unknown>)}
       WHERE code = ${hd.code}`;
  }
  soDong += 1;
}

/* ------------------------------------------------------------------ */
/* 4. Khối nội dung bài học                                            */
/* ------------------------------------------------------------------ */

const khoi = await sql`SELECT id, kind, data FROM lesson_blocks`;
for (const k of khoi) {
  const moi = thay(k.data);
  if (!moi) continue;
  console.log(`lesson_blocks[${k.kind}] ${k.id}`);
  if (!THU) await sql`UPDATE lesson_blocks SET data = ${sql.json(moi)} WHERE id = ${k.id}::uuid`;
  soDong += 1;
}

/* ------------------------------------------------------------------ */
/* 5. Bài tập                                                          */
/* ------------------------------------------------------------------ */

const hoatDong = await sql`SELECT id, title, prompt, answer FROM activities`;
for (const h of hoatDong) {
  const promptMoi = thay(h.prompt);
  const answerMoi = thay(h.answer);
  if (!promptMoi && !answerMoi) continue;
  console.log(`activities["${h.title}"] ${h.id}`);
  if (!THU) {
    if (promptMoi) await sql`UPDATE activities SET prompt = ${sql.json(promptMoi)} WHERE id = ${h.id}::uuid`;
    if (answerMoi) await sql`UPDATE activities SET answer = ${sql.json(answerMoi)} WHERE id = ${h.id}::uuid`;
  }
  soDong += 1;
}

console.log(THU ? `\nChạy thử: ${soDong} bản ghi sẽ được cập nhật.` : `\nĐã cập nhật ${soDong} bản ghi.`);
await sql.end();
