/**
 * Gieo dữ liệu cho mô-đun đào tạo và bộ nhân vật đồng hành (ke-hoach/09-a, 09-b).
 *
 * Gieo hai thứ:
 *  1. Bộ bảy nhân vật, bảng bàn giao theo ngữ cảnh, thư viện hành động, danh mục mã lỗi.
 *     Đây là dữ liệu VẬN HÀNH, không phải dữ liệu mẫu — hệ thống cần nó để chạy.
 *  2. Cây đào tạo: hai lĩnh vực, sáu chuyên đề và lộ trình bài của từng chuyên đề
 *     (ke-hoach/09 §1, §2). Bài 1 và bài 5 của chuyên đề công nghệ thông tin được soạn đủ
 *     khối nội dung và bài tập để trình đọc bài học có thứ thật mà hiển thị.
 *
 * Bài chưa soạn nằm ở trạng thái `nhap`, KHÔNG phải `xuat_ban`: trang công khai chỉ hiện
 * bài đã có nội dung thật, chứ không hiện vỏ rỗng.
 *
 * Chạy: bun run packages/db/src/seed-dao-tao.ts
 */

import { NHOM_HOC_TAP } from "@qdpl/dao-tao";
import { BAN_GIAO_GOC, HANH_DONG_GOC, NHAN_VAT_GOC } from "@qdpl/mascot";
import { sql } from "./client.ts";
import {
  datTrangThaiBaiHoc,
  datTrangThaiChuyenDe,
  luuBaiHoc,
  luuChuyenDe,
  luuHoatDong,
  luuKhoi,
  luuKyNang,
  luuLinhVuc,
  type TrangThaiNoiDungDb,
  xoaBaiNgoaiLoTrinh,
} from "./dao-tao.ts";
import { luuBanGiao, luuHanhDong, luuNhanVat, nhanVatTheoCode } from "./mascot.ts";

const AS_OF = "2026-09-06";

/**
 * Nhóm đối tượng học tập cho chuyên đề mẫu.
 *
 * Nội dung trong cây mẫu là nội dung dùng chung nên gắn cả bốn nhóm
 * (docs/nhom-doi-tuong-hoc-tap.md). Không gắn nhóm thì chuyên đề không lọt qua
 * bộ lọc danh mục công khai, nên trang `/hoc` không hiện chuyên đề nào.
 */
const NHOM_DUNG_CHUNG = [...NHOM_HOC_TAP];

/** URN các nút văn bản mà chuyên đề mẫu viện dẫn (ke-hoach/09 §2.1). */
const ND_224 = "vn:vbqppl:nd:224/2026/NĐ-CP";
const TT_39 = "vn:vbqppl:tt:39/2026/TT-BKHCN";
const TT_41 = "vn:vbqppl:tt:41/2026/TT-BKHCN";
const ND_45 = "vn:vbqppl:nd:45/2026/NĐ-CP";

/* ------------------------------------------------------------------ */
/* 1. Nhân vật                                                         */
/* ------------------------------------------------------------------ */

async function gieoNhanVat() {
  for (const nv of NHAN_VAT_GOC) {
    await luuNhanVat({
      code: nv.code,
      fullName: nv.fullName,
      nickName: nv.nickName,
      roleLine: nv.roleLine,
      bio: nv.bio ?? null,
      audiences: [...nv.audiences],
      topics: [...nv.topics],
      voice: nv.voice as unknown as Record<string, unknown>,
      palette: nv.palette as unknown as Record<string, string>,
      body: nv.body,
      headGear: nv.headGear ?? null,
      defaultProp: nv.defaultProp,
      allowedCostumes: [...nv.allowedCostumes],
      characterSheet: nv.characterSheet,
      enabled: nv.enabled,
      isDefault: nv.isDefault,
      ordinal: nv.ordinal,
    });
  }
  console.log(`  ${NHAN_VAT_GOC.length} nhân vật`);

  for (const bg of BAN_GIAO_GOC) {
    const nv = await nhanVatTheoCode(bg.personaCode);
    if (nv) await luuBanGiao(bg.context, nv.id, bg.note);
  }
  console.log(`  ${BAN_GIAO_GOC.length} luật bàn giao theo ngữ cảnh`);

  for (const hd of HANH_DONG_GOC) {
    const nv = hd.personaCode ? await nhanVatTheoCode(hd.personaCode) : undefined;
    await luuHanhDong({
      code: hd.code,
      personaId: nv?.id ?? null,
      trigger: hd.trigger,
      conditions: hd.conditions,
      priority: hd.priority,
      cooldownSeconds: hd.cooldownSeconds,
      maxPerSession: hd.maxPerSession,
      maxPerDay: hd.maxPerDay,
      anchor: hd.anchor,
      state: hd.state,
      pose: hd.pose,
      costume: hd.costume ?? null,
      prop: hd.prop ?? null,
      effect: hd.effect,
      speech: hd.speech,
      cta: hd.cta ?? {},
      audiences: hd.audiences,
      courseIds: hd.courseIds,
      enabled: hd.enabled,
    });
  }
  console.log(`  ${HANH_DONG_GOC.length} hành động`);
}

/* ------------------------------------------------------------------ */
/* 2. Danh mục mã lỗi khái niệm                                        */
/* ------------------------------------------------------------------ */

const MA_LOI = [
  {
    code: "dung_van_ban_het_hieu_luc",
    name: "Dùng văn bản đã hết hiệu lực",
    description: "Viện dẫn một văn bản đã bị bãi bỏ hoặc thay thế tại thời điểm áp dụng.",
    remedy: "Luôn tra trạng thái hiệu lực theo thời điểm trước khi viện dẫn.",
  },
  {
    code: "nham_chuyen_tiep",
    name: "Nhầm quy định chuyển tiếp",
    description: "Áp dụng văn bản mới cho dự án thuộc diện chuyển tiếp, hoặc ngược lại.",
    remedy: "Đọc điều khoản chuyển tiếp và xác định mốc thời điểm của hồ sơ.",
  },
  {
    code: "sai_tham_quyen",
    name: "Sai thẩm quyền quyết định",
    description: "Xác định sai cấp có thẩm quyền quyết định chủ trương hoặc phê duyệt.",
    remedy: "Đối chiếu bảng phân cấp thẩm quyền theo tổng mức đầu tư và nguồn vốn.",
  },
  {
    code: "nham_loai_hoat_dong",
    name: "Nhầm loại hoạt động",
    description: "Nhầm giữa dự án đầu tư, mua sắm, thuê dịch vụ và chi thường xuyên.",
    remedy: "Chạy cây quyết định phân loại trước khi chọn trình tự thủ tục.",
  },
  {
    code: "sai_phuong_phap_du_toan",
    name: "Sai phương pháp lập dự toán",
    description: "Dùng phương pháp không còn là phương pháp pháp định tại thời điểm lập.",
    remedy: "Xác định thông tư về chi phí đang có hiệu lực rồi mới chọn phương pháp.",
  },
  {
    code: "thieu_ho_so",
    name: "Thiếu thành phần hồ sơ",
    description: "Bỏ sót tài liệu bắt buộc của giai đoạn.",
    remedy: "Đối chiếu danh mục hồ sơ trong phụ lục của thông tư tương ứng.",
  },
  {
    code: "sai_don_vi_tinh",
    name: "Sai đơn vị tính",
    description: "Nhầm công tháng với công ngày, hoặc nhầm đơn vị tiền.",
    remedy: "Ghi rõ đơn vị ở từng dòng dự toán trước khi cộng.",
  },
];

async function gieoMaLoi() {
  for (const m of MA_LOI) {
    await sql`
      INSERT INTO error_tags (code, name, description, remedy)
      VALUES (${m.code}, ${m.name}, ${m.description}, ${m.remedy})
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description,
                                       remedy = EXCLUDED.remedy`;
  }
  console.log(`  ${MA_LOI.length} mã lỗi khái niệm`);
}

/* ------------------------------------------------------------------ */
/* 3. Lĩnh vực đào tạo và cây chuyên đề                                */
/* ------------------------------------------------------------------ */

/**
 * Khung nội dung đào tạo (ke-hoach/09 §1, §2).
 *
 * Ba bậc: lĩnh vực → nhóm đối tượng → chuyên đề, và trong bậc chuyên đề có hai quan hệ.
 * Chuyên đề "Thực hiện dự án" NỐI TIẾP chuyên đề "Lập dự án" trên cùng một hồ sơ; chuyên đề
 * "Dự án đầu tư công nghệ thông tin" CỤ THỂ HOÁ hai chuyên đề đó cho một loại hình dự án.
 * Nhóm tư vấn học lại đúng nền pháp lý ấy, cộng thêm chuyên đề về phương pháp tư vấn và
 * phương pháp sư phạm để hướng dẫn lại nhóm thứ nhất.
 *
 * Chỉ chuyên đề công nghệ thông tin có bài đã soạn (bài 1 và bài 5). Các chuyên đề còn lại
 * mới có lộ trình và bản đồ kỹ năng, nằm ở trạng thái `bien_tap`: trang công khai hiện tên
 * để người học thấy trọn lộ trình của lĩnh vực, nhưng không mở được bài nào.
 */

interface KhungBai {
  slug: string;
  title: string;
  skills: string[];
  phut: number;
}

interface KhungKyNang {
  code: string;
  name: string;
  prerequisites?: string[];
}

interface KhungChuyenDe {
  slug: string;
  title: string;
  summary: string;
  level: "co_ban" | "nang_cao" | "chuyen_sau";
  audience: string[];
  tags: string[];
  taxonomyCodes: string[];
  objectives: string[];
  nhomDoiTuong: "khach_hang" | "tu_van";
  /** Slug chuyên đề cha: chuyên đề này thu hẹp phạm vi của chuyên đề đó. */
  cha?: string;
  /** Slug chuyên đề liền trước trong chuỗi nối tiếp. */
  noiTiepTu?: string;
  trangThai: TrangThaiNoiDungDb;
  mascot?: string;
  legalMap?: Record<string, unknown>;
  kyNang: KhungKyNang[];
  bai: KhungBai[];
}

interface KhungLinhVuc {
  slug: string;
  name: string;
  summary: string;
  doiTuong: string;
  trangThai: TrangThaiNoiDungDb;
  /**
   * Chuyên đề trong `chuyenDe` chỉ là khung tạm thời, nhường chỗ cho seed riêng của lĩnh vực.
   *
   * Lĩnh vực giao thông đường bộ có cây chuyên đề riêng ở `seed-dao-tao-gtdb.ts`. Nếu tệp này
   * cứ ghi đè khung tạm mỗi lần chạy thì thứ tự chạy hai script sẽ quyết định cây nào thắng.
   * Vì vậy: lĩnh vực đã có chuyên đề trong kho thì bỏ qua khung tạm.
   */
  khungTamThoi?: boolean;
  chuyenDe: KhungChuyenDe[];
}

const LAP_DU_AN: KhungChuyenDe = {
  slug: "lap-du-an-dau-tu-nsnn",
  title: "Lập dự án đầu tư sử dụng ngân sách Nhà nước",
  summary:
    "Giai đoạn chuẩn bị đầu tư: xác định văn bản áp dụng theo thời điểm, phân loại hoạt động và nguồn " +
    "vốn, chủ trương đầu tư, báo cáo nghiên cứu khả thi, tổng mức đầu tư, thẩm định và quyết định đầu tư.",
  level: "co_ban",
  audience: ["can_bo_chuyen_mon", "lanh_dao"],
  tags: ["dau_tu_cong", "chuan_bi_dau_tu", "ngan_sach"],
  taxonomyCodes: ["dau-tu-cong", "ngan-sach"],
  objectives: [
    "Xác định đúng khung văn bản áp dụng theo thời điểm của hồ sơ",
    "Phân loại đúng hoạt động và nguồn vốn trước khi chọn trình tự thủ tục",
    "Lập được hồ sơ chủ trương đầu tư và báo cáo nghiên cứu khả thi của một dự án cụ thể",
    "Xác định tổng mức đầu tư theo đúng khoản mục chi phí và đúng phương pháp",
    "Xác định đúng thẩm quyền, hồ sơ và thời hạn của bước thẩm định, quyết định đầu tư",
  ],
  nhomDoiTuong: "khach_hang",
  trangThai: "bien_tap",
  mascot: "seu_dau_do",
  kyNang: [
    { code: "tra_cuu_hieu_luc", name: "Tra cứu hiệu lực theo thời điểm" },
    {
      code: "phan_loai_hoat_dong",
      name: "Phân loại hoạt động và nguồn vốn",
      prerequisites: ["tra_cuu_hieu_luc"],
    },
    {
      code: "chu_truong_dau_tu",
      name: "Lập và thẩm định chủ trương đầu tư",
      prerequisites: ["phan_loai_hoat_dong"],
    },
    { code: "lap_bcnckt", name: "Lập báo cáo nghiên cứu khả thi", prerequisites: ["chu_truong_dau_tu"] },
    { code: "lap_tong_muc_dau_tu", name: "Xác định tổng mức đầu tư", prerequisites: ["lap_bcnckt"] },
    {
      code: "tham_dinh_phe_duyet",
      name: "Thẩm định và quyết định đầu tư",
      prerequisites: ["lap_tong_muc_dau_tu"],
    },
  ],
  bai: [
    {
      slug: "bai-1-khung-van-ban-ap-dung",
      title: "Khung văn bản áp dụng và thứ bậc hiệu lực",
      skills: ["tra_cuu_hieu_luc"],
      phut: 18,
    },
    {
      slug: "bai-2-phan-loai-hoat-dong-va-nguon-von",
      title: "Phân loại hoạt động và xác định nguồn vốn",
      skills: ["phan_loai_hoat_dong"],
      phut: 20,
    },
    {
      slug: "bai-3-chu-truong-dau-tu",
      title: "Chủ trương đầu tư",
      skills: ["chu_truong_dau_tu"],
      phut: 22,
    },
    {
      slug: "bai-4-bao-cao-nghien-cuu-kha-thi",
      title: "Báo cáo nghiên cứu khả thi và báo cáo kinh tế - kỹ thuật",
      skills: ["lap_bcnckt"],
      phut: 25,
    },
    {
      slug: "bai-5-tong-muc-dau-tu",
      title: "Tổng mức đầu tư và các khoản mục chi phí",
      skills: ["lap_tong_muc_dau_tu"],
      phut: 24,
    },
    {
      slug: "bai-6-tham-dinh-quyet-dinh-dau-tu",
      title: "Thẩm định và quyết định đầu tư",
      skills: ["tham_dinh_phe_duyet"],
      phut: 20,
    },
  ],
};

const THUC_HIEN_DU_AN: KhungChuyenDe = {
  slug: "thuc-hien-du-an-dau-tu-nsnn",
  title: "Thực hiện dự án đầu tư sử dụng ngân sách Nhà nước",
  summary:
    "Giai đoạn thực hiện và kết thúc đầu tư, tiếp nối chuyên đề lập dự án trên cùng một hồ sơ: thiết kế " +
    "và dự toán, lựa chọn nhà thầu, hợp đồng và thanh toán, giám sát triển khai, nghiệm thu, bàn giao, " +
    "bảo hành, quyết toán và công tác kiểm tra.",
  level: "nang_cao",
  audience: ["can_bo_chuyen_mon", "ke_toan", "thanh_tra"],
  tags: ["dau_tu_cong", "dau_thau", "hop_dong", "quyet_toan"],
  taxonomyCodes: ["dau-tu-cong", "dau-thau"],
  objectives: [
    "Xác định đúng dự án áp dụng thiết kế một bước hay hai bước và lập được dự toán",
    "Lập được kế hoạch lựa chọn nhà thầu phù hợp với đặc thù gói thầu",
    "Quản lý được hợp đồng, tạm ứng, thanh toán theo đúng điều khoản và đúng nguồn vốn",
    "Tổ chức được công tác giám sát triển khai, nghiệm thu, bàn giao và bảo hành",
    "Chuẩn bị được hồ sơ quyết toán và danh mục tự kiểm tra tuân thủ",
  ],
  nhomDoiTuong: "khach_hang",
  noiTiepTu: "lap-du-an-dau-tu-nsnn",
  trangThai: "bien_tap",
  mascot: "can_nhac",
  kyNang: [
    { code: "thiet_ke_du_toan", name: "Thiết kế và dự toán" },
    { code: "lua_chon_nha_thau", name: "Lựa chọn nhà thầu", prerequisites: ["thiet_ke_du_toan"] },
    {
      code: "quan_ly_hop_dong",
      name: "Quản lý hợp đồng và thanh toán",
      prerequisites: ["lua_chon_nha_thau"],
    },
    { code: "giam_sat_trien_khai", name: "Giám sát triển khai", prerequisites: ["quan_ly_hop_dong"] },
    {
      code: "nghiem_thu_ban_giao",
      name: "Nghiệm thu, bàn giao, bảo hành",
      prerequisites: ["giam_sat_trien_khai"],
    },
    {
      code: "quyet_toan_kiem_tra",
      name: "Quyết toán và tuân thủ kiểm tra",
      prerequisites: ["nghiem_thu_ban_giao"],
    },
  ],
  bai: [
    {
      slug: "bai-1-thiet-ke-va-du-toan",
      title: "Thiết kế một bước, hai bước và dự toán",
      skills: ["thiet_ke_du_toan"],
      phut: 24,
    },
    {
      slug: "bai-2-ke-hoach-lua-chon-nha-thau",
      title: "Kế hoạch lựa chọn nhà thầu",
      skills: ["lua_chon_nha_thau"],
      phut: 22,
    },
    {
      slug: "bai-3-hop-dong-tam-ung-thanh-toan",
      title: "Hợp đồng, tạm ứng và thanh toán",
      skills: ["quan_ly_hop_dong"],
      phut: 22,
    },
    {
      slug: "bai-4-giam-sat-trien-khai",
      title: "Triển khai và giám sát thực hiện",
      skills: ["giam_sat_trien_khai"],
      phut: 20,
    },
    {
      slug: "bai-5-nghiem-thu-ban-giao-bao-hanh",
      title: "Nghiệm thu, bàn giao, hồ sơ hoàn thành và bảo hành",
      skills: ["nghiem_thu_ban_giao"],
      phut: 20,
    },
    {
      slug: "bai-6-quyet-toan-va-kiem-tra",
      title: "Quyết toán và công tác kiểm tra, thanh tra, kiểm toán",
      skills: ["quyet_toan_kiem_tra"],
      phut: 20,
    },
  ],
};

/**
 * Chuyên đề công nghệ thông tin giữ nguyên slug cũ `dau-tu-cntt-ngan-sach-nha-nuoc`.
 *
 * Slug là địa chỉ đã phát ra ngoài: người học đang mở dở bài 1 và bài 5 ở địa chỉ đó, và
 * bộ kiểm thử API cũng gọi tới đó. Đổi slug khi tách chuyên đề là làm hỏng cả hai.
 */
const DU_AN_CNTT: KhungChuyenDe = {
  slug: "dau-tu-cntt-ngan-sach-nha-nuoc",
  title: "Dự án đầu tư công nghệ thông tin sử dụng ngân sách Nhà nước",
  summary:
    "Phần cụ thể hoá của hai chuyên đề lập và thực hiện dự án cho loại hình dự án ứng dụng công nghệ " +
    "thông tin: khung pháp lý riêng và cách xác định văn bản áp dụng khi khung đó thay đổi, phân loại " +
    "đầu tư với mua sắm và thuê dịch vụ, yêu cầu nội dung hồ sơ, chi phí phần mềm nội bộ, thiết kế, " +
    "gói thầu và nghiệm thu phần mềm.",
  level: "chuyen_sau",
  audience: ["can_bo_chuyen_mon", "ke_toan"],
  tags: ["dau_tu_cong", "cntt", "chi_phi", "dau_thau"],
  taxonomyCodes: ["dau-tu-cong", "cntt"],
  objectives: [
    "Xác định đúng khung văn bản áp dụng cho dự án công nghệ thông tin theo thời điểm của hồ sơ",
    "Phân loại đúng hoạt động ứng dụng công nghệ thông tin thành đầu tư, mua sắm hoặc thuê dịch vụ",
    "Tính được chi phí phần mềm nội bộ theo phương pháp đang có hiệu lực",
    "Nhận diện các sai sót đặc thù của dự án công nghệ thông tin bị kiểm tra, thanh tra phát hiện",
  ],
  nhomDoiTuong: "khach_hang",
  cha: "thuc-hien-du-an-dau-tu-nsnn",
  trangThai: "xuat_ban",
  mascot: "muc_thuoc",
  legalMap: {
    ghi_chu:
      "Khung pháp lý thay đổi ba lần trong 18 tháng; Nghị định số 45/2026/NĐ-CP hết hiệu lực từ " +
      "ngày 01/7/2026 (ke-hoach/09 §2.1). Chạy lại scripts/check-citations.ts trước mỗi lần xuất bản.",
    hien_hanh: [ND_224, TT_39, TT_41],
    chuyen_tiep: [ND_45],
  },
  kyNang: [
    { code: "tra_cuu_hieu_luc", name: "Tra cứu hiệu lực theo thời điểm" },
    {
      code: "phan_loai_hoat_dong_cntt",
      name: "Phân loại đầu tư, mua sắm, thuê dịch vụ công nghệ thông tin",
      prerequisites: ["tra_cuu_hieu_luc"],
    },
    {
      code: "lap_bcnckt",
      name: "Lập nội dung hồ sơ dự án công nghệ thông tin",
      prerequisites: ["phan_loai_hoat_dong_cntt"],
    },
    {
      code: "an_toan_thong_tin_cap_do",
      name: "Yêu cầu an toàn thông tin theo cấp độ",
      prerequisites: ["lap_bcnckt"],
    },
    { code: "lap_tong_muc_dau_tu", name: "Xác định chi phí phần mềm nội bộ", prerequisites: ["lap_bcnckt"] },
    {
      code: "thiet_ke_phan_mem",
      name: "Thiết kế cơ sở và thiết kế chi tiết phần mềm",
      prerequisites: ["lap_tong_muc_dau_tu"],
    },
    { code: "goi_thau_phan_mem", name: "Gói thầu phần mềm", prerequisites: ["thiet_ke_phan_mem"] },
    {
      code: "kiem_thu_nghiem_thu",
      name: "Kiểm thử, nghiệm thu, quyết toán phần mềm",
      prerequisites: ["goi_thau_phan_mem"],
    },
    { code: "tuan_thu_kiem_tra", name: "Tuân thủ và tự kiểm tra", prerequisites: ["kiem_thu_nghiem_thu"] },
  ],
  bai: [
    {
      slug: "bai-1-tong-quan-thu-bac",
      title: "Khung pháp lý của dự án công nghệ thông tin và cách xác định văn bản áp dụng",
      skills: ["tra_cuu_hieu_luc"],
      phut: 18,
    },
    {
      slug: "bai-2-phan-loai-hoat-dong-cntt",
      title: "Phân loại: đầu tư hệ thống, mua sắm, thuê dịch vụ công nghệ thông tin",
      skills: ["phan_loai_hoat_dong_cntt"],
      phut: 20,
    },
    {
      slug: "bai-3-noi-dung-ho-so-du-an-cntt",
      title: "Nội dung đặc thù của hồ sơ dự án công nghệ thông tin",
      skills: ["lap_bcnckt"],
      phut: 24,
    },
    {
      slug: "bai-4-an-toan-thong-tin-theo-cap-do",
      title: "Yêu cầu an toàn thông tin theo cấp độ trong hồ sơ dự án",
      skills: ["an_toan_thong_tin_cap_do"],
      phut: 20,
    },
    {
      slug: "bai-5-tong-muc-dau-tu",
      title: "Tổng mức đầu tư và chi phí phần mềm nội bộ",
      skills: ["lap_tong_muc_dau_tu"],
      phut: 28,
    },
    {
      slug: "bai-6-thiet-ke-phan-mem-va-du-toan",
      title: "Thiết kế cơ sở, thiết kế chi tiết phần mềm và dự toán",
      skills: ["thiet_ke_phan_mem"],
      phut: 24,
    },
    {
      slug: "bai-7-goi-thau-phan-mem",
      title: "Gói thầu phần mềm: kế hoạch lựa chọn nhà thầu và hợp đồng",
      skills: ["goi_thau_phan_mem"],
      phut: 22,
    },
    {
      slug: "bai-8-kiem-thu-nghiem-thu-phan-mem",
      title: "Kiểm thử, vận hành thử, nghiệm thu và sai sót đặc thù",
      skills: ["kiem_thu_nghiem_thu", "tuan_thu_kiem_tra"],
      phut: 24,
    },
  ],
};

const TU_VAN_DAU_TU: KhungChuyenDe = {
  slug: "tu-van-dau-tu-va-su-pham",
  title: "Tư vấn đầu tư và phương pháp sư phạm cho người đi tư vấn",
  summary:
    "Chuyên đề của nhóm tư vấn, học sau ba chuyên đề nghiệp vụ của lĩnh vực: phạm vi và trách nhiệm " +
    "của tổ chức tư vấn, điều kiện năng lực và chi phí tư vấn, cách khảo sát nhu cầu và chẩn đoán hồ " +
    "sơ của đơn vị được tư vấn, cách viết ý kiến tư vấn có viện dẫn, và phương pháp dạy lại nội dung " +
    "pháp lý cho người lớn đang làm nghề.",
  level: "chuyen_sau",
  audience: ["can_bo_chuyen_mon"],
  tags: ["tu_van", "su_pham", "dau_tu_cong"],
  taxonomyCodes: ["dau-tu-cong"],
  objectives: [
    "Xác định đúng phạm vi, trách nhiệm và giới hạn của ý kiến tư vấn",
    "Lập được đề cương nhiệm vụ tư vấn và dự toán chi phí tư vấn",
    "Chẩn đoán được hồ sơ của đơn vị được tư vấn và chỉ ra chỗ thiếu căn cứ",
    "Viết được ý kiến tư vấn có viện dẫn tới điều khoản và thời điểm áp dụng",
    "Thiết kế và điều hành được một buổi đào tạo lại cho cán bộ của đơn vị được tư vấn",
  ],
  nhomDoiTuong: "tu_van",
  noiTiepTu: "dau-tu-cntt-ngan-sach-nha-nuoc",
  trangThai: "bien_tap",
  mascot: "muc_thuoc",
  kyNang: [
    { code: "pham_vi_tu_van", name: "Phạm vi và trách nhiệm tư vấn" },
    {
      code: "chi_phi_tu_van",
      name: "Điều kiện năng lực và chi phí tư vấn",
      prerequisites: ["pham_vi_tu_van"],
    },
    {
      code: "chan_doan_ho_so",
      name: "Chẩn đoán hồ sơ của đơn vị được tư vấn",
      prerequisites: ["pham_vi_tu_van"],
    },
    { code: "y_kien_tu_van", name: "Viết ý kiến tư vấn có viện dẫn", prerequisites: ["chan_doan_ho_so"] },
    { code: "su_pham_nguoi_lon", name: "Phương pháp dạy người lớn đang làm nghề" },
    {
      code: "dieu_hanh_buoi_dao_tao",
      name: "Thiết kế và điều hành buổi đào tạo",
      prerequisites: ["su_pham_nguoi_lon", "y_kien_tu_van"],
    },
  ],
  bai: [
    {
      slug: "bai-1-pham-vi-va-trach-nhiem-tu-van",
      title: "Phạm vi, trách nhiệm và giới hạn của ý kiến tư vấn",
      skills: ["pham_vi_tu_van"],
      phut: 18,
    },
    {
      slug: "bai-2-nang-luc-va-chi-phi-tu-van",
      title: "Điều kiện năng lực, đề cương nhiệm vụ và chi phí tư vấn",
      skills: ["chi_phi_tu_van"],
      phut: 20,
    },
    {
      slug: "bai-3-khao-sat-va-chan-doan-ho-so",
      title: "Khảo sát nhu cầu và chẩn đoán hồ sơ của đơn vị được tư vấn",
      skills: ["chan_doan_ho_so"],
      phut: 22,
    },
    {
      slug: "bai-4-viet-y-kien-tu-van",
      title: "Viết ý kiến tư vấn có viện dẫn",
      skills: ["y_kien_tu_van"],
      phut: 22,
    },
    {
      slug: "bai-5-phuong-phap-su-pham",
      title: "Phương pháp dạy nội dung pháp lý cho người lớn đang làm nghề",
      skills: ["su_pham_nguoi_lon"],
      phut: 20,
    },
    {
      slug: "bai-6-dieu-hanh-buoi-dao-tao",
      title: "Thiết kế và điều hành một buổi đào tạo tại đơn vị",
      skills: ["dieu_hanh_buoi_dao_tao"],
      phut: 22,
    },
  ],
};

const CAY_DAO_TAO: KhungLinhVuc[] = [
  {
    slug: "dau-tu-cong-nsnn",
    name: "Đầu tư và tư vấn đầu tư dự án sử dụng ngân sách Nhà nước",
    summary:
      "Bốn chuyên đề bám trình tự pháp lý của một dự án đầu tư sử dụng ngân sách nhà nước: lập dự án, " +
      "thực hiện dự án, phần cụ thể hoá cho dự án công nghệ thông tin, và phần tư vấn, sư phạm dành cho " +
      "người hướng dẫn lại ba chuyên đề trên.",
    doiTuong: "Cán bộ chuẩn bị và quản lý dự án của cơ quan nhà nước; chuyên viên tổ chức tư vấn đầu tư",
    trangThai: "xuat_ban",
    chuyenDe: [LAP_DU_AN, THUC_HIEN_DU_AN, DU_AN_CNTT, TU_VAN_DAU_TU],
  },
  {
    slug: "giao-thong-duong-bo",
    name: "Pháp luật giao thông đường bộ",
    summary:
      "Lĩnh vực dành cho lực lượng thi hành pháp luật về giao thông đường bộ. Lộ trình đang được biên " +
      "soạn; danh mục dưới đây nêu phạm vi dự kiến của từng chuyên đề.",
    doiTuong: "Cảnh sát giao thông đường bộ",
    trangThai: "bien_tap",
    khungTamThoi: true,
    chuyenDe: [
      {
        slug: "quy-tac-giao-thong-duong-bo",
        title: "Quy tắc giao thông đường bộ",
        summary:
          "Hệ thống văn bản về trật tự, an toàn giao thông đường bộ; quy tắc giao thông; điều kiện của " +
          "người lái xe và phương tiện tham gia giao thông.",
        level: "co_ban",
        audience: ["can_bo_chuyen_mon"],
        tags: ["giao_thong_duong_bo"],
        taxonomyCodes: [],
        objectives: [
          "Xác định đúng văn bản điều chỉnh một tình huống giao thông theo thời điểm",
          "Vận dụng đúng quy tắc giao thông đường bộ khi xác định hành vi vi phạm",
        ],
        nhomDoiTuong: "khach_hang",
        trangThai: "bien_tap",
        kyNang: [],
        bai: [],
      },
      {
        slug: "xu-ly-vi-pham-giao-thong-duong-bo",
        title: "Xử lý vi phạm hành chính về giao thông đường bộ",
        summary:
          "Tiếp nối chuyên đề quy tắc giao thông: thẩm quyền, trình tự lập biên bản, ra quyết định xử " +
          "phạt, áp dụng biện pháp ngăn chặn và giải quyết khiếu nại.",
        level: "nang_cao",
        audience: ["can_bo_chuyen_mon", "thanh_tra"],
        tags: ["giao_thong_duong_bo", "xu_phat_hanh_chinh"],
        taxonomyCodes: [],
        objectives: [
          "Xác định đúng thẩm quyền và trình tự xử phạt vi phạm hành chính",
          "Lập được hồ sơ xử phạt đủ thành phần và đúng thời hạn",
        ],
        nhomDoiTuong: "khach_hang",
        noiTiepTu: "quy-tac-giao-thong-duong-bo",
        trangThai: "bien_tap",
        kyNang: [],
        bai: [],
      },
    ],
  },
];

/** Bài đã soạn đủ khối nội dung; khoá theo `slug chuyên đề › slug bài`. */
const BAI_DA_SOAN: Record<string, (courseId: string, lessonId: string) => Promise<void>> = {
  "dau-tu-cntt-ngan-sach-nha-nuoc › bai-1-tong-quan-thu-bac": soanBai1,
  "dau-tu-cntt-ngan-sach-nha-nuoc › bai-5-tong-muc-dau-tu": soanBai5,
};

async function gieoCayDaoTao() {
  // Id theo slug: chuyên đề cha và chuyên đề liền trước được tham chiếu bằng slug trong khung
  // nội dung, nên phải gieo theo đúng thứ tự khai báo rồi tra lại id.
  const idChuyenDe = new Map<string, string>();

  for (const lv of CAY_DAO_TAO) {
    const linhVuc = await luuLinhVuc({
      slug: lv.slug,
      name: lv.name,
      summary: lv.summary,
      audienceNote: lv.doiTuong,
      ordinal: CAY_DAO_TAO.indexOf(lv),
      status: lv.trangThai,
    });
    console.log(`  lĩnh vực "${linhVuc.slug}"`);

    if (lv.khungTamThoi) {
      const [dem] = await sql<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM courses WHERE field_id = ${linhVuc.id}::uuid`;
      const n = dem?.n ?? 0;
      if (n > 0) {
        console.log(`    đã có ${n} chuyên đề do seed riêng gieo — bỏ qua khung tạm`);
        continue;
      }
    }

    for (const [i, cd] of lv.chuyenDe.entries()) {
      const mascot = cd.mascot ? await nhanVatTheoCode(cd.mascot) : undefined;
      const course = await luuChuyenDe({
        slug: cd.slug,
        title: cd.title,
        summary: cd.summary,
        audience: cd.audience,
        level: cd.level,
        tags: cd.tags,
        taxonomyCodes: cd.taxonomyCodes,
        objectives: cd.objectives,
        asOf: AS_OF,
        durationMinutes: cd.bai.reduce((t, b) => t + b.phut, 0) || null,
        defaultMode: "day_du",
        mascotId: mascot?.id ?? null,
        mascotLocked: false,
        mascotCostume: "cong_so",
        legalMap: cd.legalMap ?? {},
        fieldId: linhVuc.id,
        parentId: cd.cha ? (idChuyenDe.get(cd.cha) ?? null) : null,
        followsId: cd.noiTiepTu ? (idChuyenDe.get(cd.noiTiepTu) ?? null) : null,
        audienceGroup: cd.nhomDoiTuong,
        nhomHocTap: NHOM_DUNG_CHUNG,
        ordinal: i,
      });
      idChuyenDe.set(cd.slug, course.id);

      await luuKyNang(
        course.id,
        cd.kyNang.map((k, j) => ({ ...k, ordinal: j })),
      );

      for (const [j, b] of cd.bai.entries()) {
        const bai = await luuBaiHoc({
          courseId: course.id,
          slug: b.slug,
          ordinal: j + 1,
          title: b.title,
          asOf: AS_OF,
          estimatedMinutes: b.phut,
          skills: b.skills,
          source: "nguoi",
        });
        const soan = BAI_DA_SOAN[`${cd.slug} › ${b.slug}`];
        if (soan) await soan(course.id, bai.id);
      }

      const daXoa = await xoaBaiNgoaiLoTrinh(
        course.id,
        cd.bai.map((b) => b.slug),
      );
      await datTrangThaiChuyenDe(course.id, cd.trangThai);

      console.log(
        `    chuyên đề "${cd.slug}" — ${cd.bai.length} bài, ${cd.kyNang.length} kỹ năng` +
          (daXoa.length ? `, xoá ${daXoa.length} bài của lộ trình cũ` : ""),
      );
    }
  }
}

/** Bài 1 — soạn đủ để trình đọc bài học có nội dung thật. */
async function soanBai1(courseId: string, lessonId: string) {
  await sql`DELETE FROM lesson_blocks WHERE lesson_id = ${lessonId}::uuid`;
  await sql`DELETE FROM activities WHERE lesson_id = ${lessonId}::uuid`;

  const khoi = [
    {
      kind: "kich_ban",
      data: {
        luot: [
          { vai: "Chuyên viên", loi: "Tôi lấy lại mẫu tờ trình của dự án năm trước để dùng cho hồ sơ này." },
          { vai: "Trưởng phòng", loi: "Mẫu đó dựng trên nghị định nào? Nghị định ấy còn hiệu lực không?" },
          { vai: "Chuyên viên", loi: "Tôi chưa kiểm tra nội dung đó." },
        ],
      },
    },
    {
      kind: "giang",
      data: {
        md:
          "Việc đầu tiên khi lập một hồ sơ đầu tư ứng dụng công nghệ thông tin là **xác định khung văn bản " +
          "áp dụng tại thời điểm của hồ sơ**. Một mẫu tờ trình đúng ở năm trước có thể không còn đúng ở năm " +
          "sau, do căn cứ ban hành của mẫu đó đã bị bãi bỏ.\n\n" +
          "Khung pháp lý của lĩnh vực này đã thay đổi **ba lần trong 18 tháng**. Việc thay đổi văn bản áp " +
          "dụng là tình huống thường gặp, cần được xử lý theo một trình tự thống nhất.",
      },
    },
    {
      kind: "dong_thoi_gian",
      data: {
        moc: [
          { ngay: "2026-03-01", nhan: "Nghị định số 45/2026/NĐ-CP có hiệu lực", loai: "hieu_luc" },
          {
            ngay: "2026-07-01",
            nhan: "Nghị định số 224/2026/NĐ-CP có hiệu lực, bãi bỏ Nghị định số 45/2026/NĐ-CP",
            loai: "thay_the",
          },
          {
            ngay: "2026-07-01",
            nhan: "Thông tư số 39/2026/TT-BKHCN và Thông tư số 41/2026/TT-BKHCN có hiệu lực",
            loai: "hieu_luc",
          },
        ],
        ghi_chu:
          "Dự án đã có quyết định đầu tư trước ngày 01/7/2026 tiếp tục áp dụng Nghị định số 45/2026/NĐ-CP " +
          "theo điều khoản chuyển tiếp.",
      },
      citations: [ND_224, ND_45],
    },
    {
      kind: "can_cu",
      data: {
        urn: ND_224,
        nhan: "Nghị định số 224/2026/NĐ-CP ngày 24/6/2026 của Chính phủ",
        nguyen_van:
          "Nghị định quy định chi tiết và biện pháp thi hành Luật Chuyển đổi số. " +
          "Điều 90 bãi bỏ Nghị định số 45/2026/NĐ-CP; Điều 91 quy định chuyển tiếp.",
        as_of: AS_OF,
      },
      citations: [ND_224],
    },
    {
      kind: "hoi_nhanh",
      data: {
        cau_hoi:
          "Một dự án có quyết định đầu tư ngày 15/5/2026. Nay lập thiết kế chi tiết. Áp dụng nghị định nào?",
        phuong_an: [
          { id: "a", text: "Nghị định số 224/2026/NĐ-CP, vì là văn bản đang có hiệu lực" },
          { id: "b", text: "Nghị định số 45/2026/NĐ-CP, theo điều khoản chuyển tiếp" },
          { id: "c", text: "Tuỳ cấp có thẩm quyền quyết định" },
        ],
        dap_an: "b",
        giai_thich:
          "Điều 91 Nghị định số 224/2026/NĐ-CP cho phép dự án đã có quyết định đầu tư trước ngày 01/7/2026 " +
          "tiếp tục áp dụng Nghị định số 45/2026/NĐ-CP, trừ trường hợp cấp có thẩm quyền quyết định áp " +
          "dụng văn bản mới.",
      },
      citations: [ND_224],
    },
    {
      kind: "so_do_trinh_tu",
      data: {
        buoc: [
          {
            ma: "b1",
            nhan: "Xác định thời điểm của hồ sơ",
            mo_ta: "Ngày quyết định đầu tư hoặc ngày thẩm định",
          },
          {
            ma: "b2",
            nhan: "Tra trạng thái hiệu lực tại thời điểm đó",
            mo_ta: "Dùng công cụ tra cứu theo as_of",
          },
          { ma: "b3", nhan: "Đọc điều khoản chuyển tiếp", mo_ta: "Xác định hồ sơ thuộc diện nào" },
          { ma: "b4", nhan: "Chốt danh mục văn bản áp dụng", mo_ta: "Ghi rõ trong tờ trình" },
        ],
        canh: [
          { tu: "b1", den: "b2" },
          { tu: "b2", den: "b3" },
          { tu: "b3", den: "b4" },
        ],
      },
      citations: [ND_224],
    },
    {
      kind: "canh_bao",
      data: {
        loai: "hieu_luc",
        md:
          "Không sao chép danh mục căn cứ từ hồ sơ cũ. Sao chép danh mục căn cứ là nguyên nhân phổ biến " +
          "đưa một văn bản đã hết hiệu lực vào hồ sơ mới.",
      },
    },
    {
      kind: "the_lat",
      data: {
        the: [
          {
            truoc: "Hết hiệu lực toàn bộ",
            sau: "Văn bản không còn giá trị áp dụng kể từ ngày ghi trong văn bản bãi bỏ.",
          },
          {
            truoc: "Điều khoản chuyển tiếp",
            sau: "Quy định cho phép hồ sơ đang dở tiếp tục theo văn bản cũ.",
          },
          {
            truoc: "as_of",
            sau: "Thời điểm được chọn để tra cứu: nội dung quy định có hiệu lực tại ngày đó.",
          },
        ],
      },
      citations: [ND_224],
    },
    {
      kind: "tom_tat",
      data: {
        y: [
          "Xác định khung văn bản áp dụng trước khi soạn thảo hồ sơ.",
          "Khung pháp lý thay đổi thường xuyên; mỗi hồ sơ phải xác định lại văn bản áp dụng.",
          "Điều khoản chuyển tiếp quyết định hồ sơ đang thực hiện theo văn bản nào.",
          "Không sao chép danh mục căn cứ từ hồ sơ cũ.",
        ],
      },
    },
  ];

  for (const [i, k] of khoi.entries()) {
    await luuKhoi({
      lessonId,
      ordinal: i + 1,
      kind: k.kind,
      data: k.data as Record<string, unknown>,
      citations: (k as { citations?: string[] }).citations ?? [],
    });
  }

  await luuHoatDong({
    courseId,
    lessonId,
    ordinal: 1,
    kind: "trac_nghiem",
    mode: "may",
    title: "Chọn khung văn bản áp dụng",
    prompt: {
      cau_hoi:
        "Hồ sơ thẩm định nộp ngày 20/6/2026, quyết định đầu tư ban hành ngày 10/8/2026. " +
        "Khung nghị định nào áp dụng cho các bước tiếp theo?",
      phuong_an: [
        { id: "a", text: "Nghị định số 45/2026/NĐ-CP, vì đã có báo cáo thẩm định trước ngày 01/7/2026" },
        { id: "b", text: "Nghị định số 224/2026/NĐ-CP, vì quyết định đầu tư ban hành sau ngày 01/7/2026" },
        { id: "c", text: "Nghị định số 64/2007/NĐ-CP, vì là văn bản gốc của lĩnh vực" },
      ],
    },
    answer: {
      dung: ["a"],
      giai_thich:
        "Khoản 2 Điều 91 Nghị định số 224/2026/NĐ-CP nêu hai điều kiện thay thế nhau: đã có quyết định " +
        "đầu tư hoặc đã có báo cáo thẩm định trước ngày 01/7/2026.",
      phuong_an: [
        {
          id: "a",
          text: "Nghị định số 45/2026/NĐ-CP",
          dung: true,
          giai_thich: "Đúng: đã có báo cáo thẩm định trước mốc 01/7/2026.",
        },
        {
          id: "b",
          text: "Nghị định số 224/2026/NĐ-CP",
          ma_loi: "nham_chuyen_tiep",
          giai_thich: "Điều kiện chuyển tiếp xét cả mốc báo cáo thẩm định, không chỉ mốc quyết định đầu tư.",
        },
        {
          id: "c",
          text: "Nghị định số 64/2007/NĐ-CP",
          ma_loi: "dung_van_ban_het_hieu_luc",
          giai_thich: "Nghị định số 64/2007/NĐ-CP đã bị Điều 90 Nghị định số 224/2026/NĐ-CP bãi bỏ.",
        },
      ],
    },
    skills: ["tra_cuu_hieu_luc"],
    errorTags: ["nham_chuyen_tiep", "dung_van_ban_het_hieu_luc"],
    citations: [ND_224],
    points: 2,
    level: 1,
  });

  await luuHoatDong({
    courseId,
    lessonId,
    ordinal: 2,
    kind: "sap_xep",
    mode: "may",
    title: "Trình tự xác định văn bản áp dụng",
    prompt: {
      cau_hoi: "Sắp xếp bốn bước xác định khung văn bản áp dụng theo đúng thứ tự.",
      muc: [
        { id: "b3", text: "Đọc điều khoản chuyển tiếp" },
        { id: "b1", text: "Xác định thời điểm của hồ sơ" },
        { id: "b4", text: "Chốt danh mục văn bản áp dụng" },
        { id: "b2", text: "Tra trạng thái hiệu lực tại thời điểm đó" },
      ],
    },
    answer: {
      thu_tu: ["b1", "b2", "b3", "b4"],
      giai_thich:
        "Xác định thời điểm trước, tra trạng thái hiệu lực sau, rồi mới đọc điều khoản chuyển tiếp.",
    },
    skills: ["tra_cuu_hieu_luc"],
    citations: [ND_224],
    points: 2,
    level: 1,
  });

  await datTrangThaiBaiHoc(lessonId, "xuat_ban");
  console.log("  bài 1 đã soạn và xuất bản");
}

/** Bài 5 — trọng tâm chi phí, có khối công thức và bài tính. */
async function soanBai5(courseId: string, lessonId: string) {
  await sql`DELETE FROM lesson_blocks WHERE lesson_id = ${lessonId}::uuid`;
  await sql`DELETE FROM activities WHERE lesson_id = ${lessonId}::uuid`;

  const khoi = [
    {
      kind: "giang",
      data: {
        md:
          "Tổng mức đầu tư của một dự án công nghệ thông tin sử dụng ngân sách nhà nước là **tổng của các " +
          "khoản mục chi phí do thông tư quy định**, không phải một con số ước lượng. Mỗi khoản mục phải " +
          "nêu được phương pháp xác định đã dùng.\n\n" +
          "Phương pháp lập dự toán phần mềm nội bộ **đã thay đổi** kể từ ngày 01/7/2026.",
      },
    },
    {
      kind: "canh_bao",
      data: {
        loai: "phuong_phap",
        md:
          "Phương pháp **điểm trường hợp sử dụng (use case point)** theo Quyết định số 671/QĐ-BTTTT không " +
          "còn là phương pháp pháp định: căn cứ ban hành đã hết hiệu lực và Thông tư số 39/2026/TT-BKHCN " +
          "không dẫn chiếu phương pháp này. Phương pháp này chỉ áp dụng cho dự án chuyển tiếp theo quy " +
          "định tại thời điểm phê duyệt.",
      },
      citations: [TT_39],
    },
    {
      kind: "can_cu",
      data: {
        urn: TT_39,
        nhan: "Thông tư số 39/2026/TT-BKHCN, có hiệu lực từ ngày 01/7/2026",
        nguyen_van:
          "Quy định lập và quản lý chi phí trong đầu tư, mua sắm, thuê dịch vụ phục vụ chuyển đổi số " +
          "sử dụng ngân sách nhà nước; thay thế Thông tư số 18/2024/TT-BTTTT.",
        as_of: AS_OF,
      },
      citations: [TT_39],
    },
    {
      kind: "cong_thuc",
      data: {
        latex: "G = G_{TB/DV} + G_{QLDA} + G_{TV} + G_{K} + G_{DP}",
        mo_ta:
          "Tổng mức đầu tư gồm chi phí thiết bị/dịch vụ, quản lý dự án, tư vấn, chi phí khác và dự phòng.",
        bien: [
          { ma: "G_TB_DV", nhan: "Chi phí thiết bị / dịch vụ", don_vi: "đồng", mac_dinh: 10_000_000_000 },
          { ma: "G_QLDA", nhan: "Chi phí quản lý dự án", don_vi: "đồng", mac_dinh: 400_000_000 },
          { ma: "G_TV", nhan: "Chi phí tư vấn", don_vi: "đồng", mac_dinh: 900_000_000 },
          { ma: "G_K", nhan: "Chi phí khác", don_vi: "đồng", mac_dinh: 300_000_000 },
          { ma: "G_DP", nhan: "Dự phòng (tối đa 10%)", don_vi: "đồng", mac_dinh: 1_160_000_000 },
        ],
        rang_buoc: [{ ma: "du_phong_toi_da", mo_ta: "G_DP ≤ 10% tổng các thành phần còn lại" }],
      },
      citations: [TT_39],
    },
    {
      kind: "bang_tra",
      data: {
        cot: ["Hạng mục", "Đơn vị", "Ghi chú"],
        dong: [
          ["Nghiên cứu phát triển – phân tích – thiết kế", "công tháng", "Theo đơn giá cụ thể"],
          ["Lập trình", "công tháng", "Theo đơn giá cụ thể"],
          ["Thử nghiệm, kiểm thử nội bộ", "công tháng", ""],
          ["Cài đặt, hiệu chỉnh", "công ngày", ""],
          ["Chi phí chung", "—", "Không ấn định tỷ lệ phần trăm"],
          ["Thu nhập chịu thuế tính trước", "—", "Không ấn định tỷ lệ phần trăm"],
        ],
      },
      citations: [TT_39],
    },
    {
      kind: "may_tinh",
      data: {
        cong_cu: "chi_phi_phan_mem",
        che_do: "tt_39_2026",
        ghi_chu:
          "Chế độ chuyển tiếp theo phương pháp điểm trường hợp sử dụng (use case point) vẫn dùng được, " +
          "kèm cảnh báo phương pháp này không còn là phương pháp pháp định.",
      },
      citations: [TT_39],
    },
    {
      kind: "tom_tat",
      data: {
        y: [
          "Tổng mức đầu tư là tổng các khoản mục chi phí do thông tư quy định, không phải con số ước lượng.",
          "Phần mềm nội bộ tính theo công tháng, công ngày và đơn giá cụ thể (Thông tư số 39/2026/TT-BKHCN).",
          "Dự phòng tối đa 10%.",
          "Chi phí thuê dịch vụ phần mềm chia đều cho 96 tháng.",
        ],
      },
      citations: [TT_39],
    },
  ];

  for (const [i, k] of khoi.entries()) {
    await luuKhoi({
      lessonId,
      ordinal: i + 1,
      kind: k.kind,
      data: k.data as Record<string, unknown>,
      citations: (k as { citations?: string[] }).citations ?? [],
    });
  }

  await luuHoatDong({
    courseId,
    lessonId,
    ordinal: 1,
    kind: "tinh_toan",
    mode: "may",
    title: "Dự phòng tối đa",
    prompt: {
      cau_hoi:
        "Các thành phần G_TB/DV + G_QLDA + G_TV + G_K của dự án là 11.600.000.000 đồng. " +
        "Chi phí dự phòng tối đa được phép là bao nhiêu đồng?",
      don_vi: "đồng",
    },
    answer: {
      so: 1_160_000_000,
      sai_so: 1000,
      giai_thich: "Dự phòng tối đa 10% của tổng các khoản mục còn lại (Thông tư số 39/2026/TT-BKHCN).",
    },
    skills: ["lap_tong_muc_dau_tu"],
    errorTags: ["sai_don_vi_tinh"],
    citations: [TT_39],
    points: 2,
    level: 1,
  });

  await luuHoatDong({
    courseId,
    lessonId,
    ordinal: 2,
    kind: "trac_nghiem",
    mode: "may",
    title: "Phương pháp lập dự toán phần mềm nội bộ",
    prompt: {
      cau_hoi: "Dự án phê duyệt tháng 9/2026. Lập dự toán phần mềm nội bộ theo phương pháp nào?",
      phuong_an: [
        { id: "a", text: "Điểm trường hợp sử dụng theo Quyết định số 671/QĐ-BTTTT" },
        { id: "b", text: "Công tháng, công ngày và đơn giá cụ thể theo Thông tư số 39/2026/TT-BKHCN" },
        { id: "c", text: "Tỷ lệ phần trăm trên chi phí thiết bị" },
      ],
    },
    answer: {
      dung: ["b"],
      giai_thich:
        "Thông tư số 39/2026/TT-BKHCN quy định báo giá theo công tháng, công ngày và đơn giá cụ thể.",
      phuong_an: [
        {
          id: "a",
          text: "Điểm trường hợp sử dụng",
          ma_loi: "sai_phuong_phap_du_toan",
          giai_thich:
            "Căn cứ ban hành của phương pháp này đã hết hiệu lực; chỉ áp dụng cho dự án chuyển tiếp.",
        },
        { id: "b", text: "Công tháng, công ngày và đơn giá cụ thể", dung: true },
        {
          id: "c",
          text: "Tỷ lệ phần trăm",
          ma_loi: "sai_phuong_phap_du_toan",
          giai_thich: "Thông tư số 39/2026/TT-BKHCN không ấn định tỷ lệ phần trăm cho các hạng mục này.",
        },
      ],
    },
    skills: ["lap_tong_muc_dau_tu"],
    errorTags: ["sai_phuong_phap_du_toan"],
    citations: [TT_39, TT_41],
    points: 2,
    level: 1,
  });

  await luuHoatDong({
    courseId,
    lessonId,
    ordinal: 3,
    kind: "viet_co_can_cu",
    mode: "ai",
    title: "Thuyết minh phương pháp lập dự toán",
    prompt: {
      cau_hoi:
        "Viết mục 'Phương pháp lập dự toán phần mềm nội bộ' cho báo cáo nghiên cứu khả thi của dự án ví dụ " +
        "(khoảng 200 từ). Bắt buộc nêu căn cứ và ghi rõ thời điểm áp dụng.",
      huong_dan: "Nêu phương pháp, đơn vị tính, cấu trúc chi phí và trần dự phòng.",
    },
    answer: {},
    rubric: {
      tieu_chi: [
        {
          ma: "can_cu",
          ten: "Viện dẫn đúng và còn hiệu lực",
          trong_so: 40,
          muc: [
            { diem: 0, mo_ta: "Không viện dẫn, hoặc viện dẫn văn bản đã hết hiệu lực" },
            { diem: 2, mo_ta: "Viện dẫn đúng văn bản nhưng không rõ điều khoản hoặc thời điểm" },
            { diem: 4, mo_ta: "Viện dẫn đúng tới điều khoản, ghi rõ thời điểm áp dụng" },
          ],
        },
        {
          ma: "day_du",
          ten: "Đủ nội dung bắt buộc",
          trong_so: 30,
          muc: [
            { diem: 0, mo_ta: "Thiếu phương pháp hoặc thiếu cấu trúc chi phí" },
            { diem: 4, mo_ta: "Đủ phương pháp, đơn vị tính, cấu trúc chi phí, trần dự phòng" },
          ],
        },
        {
          ma: "lap_luan",
          ten: "Lập luận chặt chẽ",
          trong_so: 20,
          muc: [
            { diem: 0, mo_ta: "Kết luận không theo từ căn cứ đã nêu" },
            { diem: 4, mo_ta: "Mỗi khẳng định gắn với một căn cứ" },
          ],
        },
        {
          ma: "trinh_bay",
          ten: "Trình bày, thuật ngữ",
          trong_so: 10,
          muc: [
            { diem: 0, mo_ta: "Dùng sai thuật ngữ chuyên ngành" },
            { diem: 4, mo_ta: "Thuật ngữ chuẩn, trình bày rõ ràng" },
          ],
        },
      ],
      nguong_dat: 70,
    },
    skills: ["lap_tong_muc_dau_tu", "lap_bcnckt"],
    citations: [TT_39],
    points: 10,
    level: 2,
  });

  await datTrangThaiBaiHoc(lessonId, "xuat_ban");
  console.log("  bài 5 đã soạn và xuất bản");
}

/* ------------------------------------------------------------------ */

console.log("Gieo dữ liệu đào tạo và mascot…");
await gieoNhanVat();
await gieoMaLoi();
await gieoCayDaoTao();
console.log("Xong.");
await sql.end();
