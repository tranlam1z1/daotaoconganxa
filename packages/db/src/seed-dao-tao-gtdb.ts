/**
 * Gieo cây chuyên đề của LĨNH VỰC GIAO THÔNG ĐƯỜNG BỘ, dành cho cảnh sát giao thông đường bộ
 * (ke-hoach/09 §3, 09-a). Tách khỏi seed-dao-tao.ts (lĩnh vực đầu tư công) để hai lĩnh vực
 * biên soạn độc lập; dùng lại đúng slug lĩnh vực và hai chuyên đề khung mà seed-dao-tao.ts đã
 * khai báo (`giao-thong-duong-bo`, `quy-tac-giao-thong-duong-bo`,
 * `xu-ly-vi-pham-giao-thong-duong-bo`) nên chạy lệnh nào trước cũng được.
 *
 * Cây chuyên đề (theo trình tự công tác của cảnh sát giao thông):
 *   1. Hệ thống pháp luật về trật tự, an toàn giao thông đường bộ   (gốc)
 *   2. Quy tắc giao thông đường bộ                                   (nối tiếp 1)
 *   3. Phương tiện và người điều khiển phương tiện                  (nối tiếp 2)
 *   4. Tuần tra, kiểm soát, chỉ huy và điều khiển giao thông        (nối tiếp 3)
 *   5. Xử lý vi phạm hành chính về giao thông đường bộ              (nối tiếp 4)
 *      5a. Trừ điểm, phục hồi điểm giấy phép lái xe                 (cụ thể hoá 5)
 *      5b. Vận tải đường bộ và kiểm soát tải trọng                  (cụ thể hoá 5)
 *   6. Điều tra, giải quyết tai nạn giao thông đường bộ             (nối tiếp 5)
 *
 * Mọi viện dẫn là URN văn bản trong kho. Trước khi gieo, script tra từng URN của bản đồ pháp
 * lý; văn bản chưa có trong kho thì báo ra và KHÔNG đưa vào bản đồ (không viện dẫn thứ chưa
 * kiểm chứng được). Bài chưa soạn nội dung ở trạng thái `nhap`, không hiện ra ngoài.
 *
 * Chạy: bun run packages/db/src/seed-dao-tao-gtdb.ts
 */

import { sql } from "./client.ts";
import {
  datTrangThaiBaiHoc,
  datTrangThaiChuyenDe,
  linhVucTheoSlug,
  luuBaiHoc,
  luuChuyenDe,
  luuHoatDong,
  luuKhoi,
  luuKyNang,
  luuLinhVuc,
} from "./dao-tao.ts";

export const AS_OF_GTDB = "2026-09-08";

/* ------------------------------------------------------------------ */
/* Văn bản của lĩnh vực (URN trong kho)                                 */
/* ------------------------------------------------------------------ */

export const VB = {
  // Luật
  L_DUONG_BO: "vn:vbqppl:l:35/2024/QH15",
  L_TTATGT: "vn:vbqppl:l:36/2024/QH15",
  L_XLVPHC: "vn:vbqppl:l:15/2012/QH13",
  L_XLVPHC_SD_2020: "vn:vbqppl:l:67/2020/QH14",
  L_XLVPHC_SD_2025: "vn:vbqppl:l:88/2025/QH15",
  L_GTDB_2008: "vn:vbqppl:l:23/2008/QH12",
  /** Sửa 10 luật về an ninh, trật tự — Điều 7 sửa Luật TTATGT, Điều 8 sửa Luật Đường bộ; hiệu lực 01/7/2026. */
  L_118_2025: "vn:vbqppl:l:118/2025/QH15",
  // Nghị định hướng dẫn hai luật 2024
  ND_151_2024: "vn:vbqppl:nd:151/2024/NĐ-CP", // chi tiết Luật TTATGT
  ND_158_2024: "vn:vbqppl:nd:158/2024/NĐ-CP", // vận tải đường bộ
  ND_165_2024: "vn:vbqppl:nd:165/2024/NĐ-CP", // chi tiết Luật Đường bộ + Điều 77 Luật TTATGT
  ND_168_2024: "vn:vbqppl:nd:168/2024/NĐ-CP", // xử phạt, trừ điểm GPLX
  ND_184_2025: "vn:vbqppl:nd:184/2025/NĐ-CP", // sửa NĐ 151/2024
  ND_118_2021: "vn:vbqppl:nd:118/2021/NĐ-CP", // chi tiết Luật XLVPHC
  ND_135_2021: "vn:vbqppl:nd:135/2021/NĐ-CP", // phương tiện, thiết bị kỹ thuật nghiệp vụ
  // Nghị định sửa đổi năm 2026
  ND_218_2026: "vn:vbqppl:nd:218/2026/NĐ-CP", // sửa NĐ 158/2024
  ND_236_2026: "vn:vbqppl:nd:236/2026/NĐ-CP", // sửa NĐ 151/2024
  ND_238_2026: "vn:vbqppl:nd:238/2026/NĐ-CP", // sửa NĐ 168/2024
  ND_241_2026: "vn:vbqppl:nd:241/2026/NĐ-CP", // sửa NĐ 165/2024
  ND_319_2026: "vn:vbqppl:nd:319/2026/NĐ-CP", // thiết bị giám sát hành trình (hiệu lực 01/7/2027)
  ND_94_2026: "vn:vbqppl:nd:94/2026/NĐ-CP", // đào tạo, sát hạch lái xe (bãi bỏ NĐ 160/2024)
  ND_89_2026: "vn:vbqppl:nd:89/2026/NĐ-CP", // kiểm định, niên hạn (thay NĐ 166/2024)
  ND_336_2025: "vn:vbqppl:nd:336/2025/NĐ-CP", // xử phạt VPHC trong hoạt động đường bộ
  ND_160_2024: "vn:vbqppl:nd:160/2024/NĐ-CP", // đào tạo, sát hạch (hết hiệu lực 01/7/2026)
  ND_166_2024: "vn:vbqppl:nd:166/2024/NĐ-CP", // kiểm định (hết hiệu lực 01/7/2026)
  // Nghị định lịch sử (tra cứu hành vi trước 01/01/2025)
  ND_100_2019: "vn:vbqppl:nd:100/2019/NĐ-CP",
  ND_123_2021: "vn:vbqppl:nd:123/2021/NĐ-CP",
  // Thông tư Bộ Công an
  TT_73_2024_BCA: "vn:vbqppl:tt:73/2024/TT-BCA", // tuần tra, kiểm soát
  TT_69_2024_BCA: "vn:vbqppl:tt:69/2024/TT-BCA", // chỉ huy, điều khiển giao thông
  TT_72_2024_BCA: "vn:vbqppl:tt:72/2024/TT-BCA", // điều tra, giải quyết tai nạn
  TT_79_2024_BCA: "vn:vbqppl:tt:79/2024/TT-BCA", // đăng ký xe, biển số
  TT_35_2024_BCA: "vn:vbqppl:tt:35/2024/TT-BCA", // sát hạch, cấp giấy phép lái xe
  TT_12_2025_BCA: "vn:vbqppl:tt:12/2025/TT-BCA", // sát hạch, cấp giấy phép lái xe (2025)
  TT_65_2020_BCA: "vn:vbqppl:tt:65/2020/TT-BCA", // tuần tra, kiểm soát (hết hiệu lực)
  TT_65_2024_BCA: "vn:vbqppl:tt:65/2024/TT-BCA", // kiểm tra kiến thức pháp luật để phục hồi điểm GPLX
  TT_108_2026_BCA: "vn:vbqppl:tt:108/2026/TT-BCA", // sát hạch, cấp GPLX (thay TT 12/2025/TT-BCA từ 01/7/2026)
  TT_105_2026_BCA: "vn:vbqppl:tt:105/2026/TT-BCA", // sửa TT 65/2024/TT-BCA về kiểm tra kiến thức phục hồi điểm
} as const;

/** Số ký hiệu đọc được cho người, suy từ URN. */
function tenVanBan(urn: string): string {
  const [, , loai, soKyHieu] = urn.split(":");
  const nhan: Record<string, string> = {
    l: "Luật số",
    nd: "Nghị định số",
    tt: "Thông tư số",
    "qd-ttg": "Quyết định số",
    ttlt: "Thông tư liên tịch số",
    vbhn: "Văn bản hợp nhất số",
    "nq-cp": "Nghị quyết số",
  };
  return `${nhan[loai ?? ""] ?? "Văn bản"} ${soKyHieu}`;
}

/* ------------------------------------------------------------------ */
/* Mã lỗi khái niệm riêng của lĩnh vực                                  */
/* ------------------------------------------------------------------ */

const MA_LOI_GTDB = [
  {
    code: "sai_khung_tien_phat",
    name: "Áp dụng sai khung tiền phạt",
    description:
      "Xác định sai điểm, khoản của nghị định xử phạt nên mức tiền phạt hoặc hình thức phạt bổ sung sai.",
    remedy:
      "Đối chiếu hành vi với đúng điểm, khoản, điều của nghị định xử phạt đang có hiệu lực tại thời điểm vi phạm.",
  },
  {
    code: "sai_tham_quyen_xu_phat",
    name: "Sai thẩm quyền xử phạt",
    description:
      "Người ra quyết định không có thẩm quyền với mức phạt, hình thức phạt bổ sung hoặc biện pháp khắc phục.",
    remedy:
      "Tra bảng thẩm quyền theo chức danh trong nghị định xử phạt và Luật Xử lý vi phạm hành chính; chuyển hồ sơ đúng cấp.",
  },
  {
    code: "sai_trinh_tu_kiem_soat",
    name: "Sai căn cứ, trình tự dừng phương tiện và kiểm soát",
    description: "Dừng xe không thuộc các căn cứ được phép, hoặc bỏ bước trong trình tự kiểm soát.",
    remedy: "Đối chiếu căn cứ dừng phương tiện và trình tự kiểm soát quy định tại thông tư của Bộ Công an.",
  },
  {
    code: "sai_thoi_han_xu_ly",
    name: "Sai thời hạn lập biên bản, ra quyết định",
    description: "Quá thời hạn lập biên bản, ra quyết định xử phạt hoặc thời hạn tạm giữ.",
    remedy:
      "Ghi mốc thời gian ở từng bước của hồ sơ và đối chiếu với thời hạn trong Luật Xử lý vi phạm hành chính.",
  },
  {
    code: "nham_bien_phap_ngan_chan",
    name: "Nhầm hình thức phạt bổ sung với biện pháp ngăn chặn",
    description:
      "Lẫn giữa tước quyền sử dụng giấy phép, trừ điểm giấy phép lái xe và tạm giữ giấy tờ, phương tiện.",
    remedy:
      "Phân biệt ba nhóm: hình thức xử phạt, biện pháp ngăn chặn, biện pháp bảo đảm thi hành, theo từng điều luật.",
  },
  {
    code: "vien_dan_sai_dieu_khoan",
    name: "Viện dẫn sai điều, khoản, điểm",
    description:
      "Biên bản hoặc quyết định ghi sai đơn vị viện dẫn hoặc thiếu ngày, cơ quan ban hành của văn bản.",
    remedy: "Viện dẫn theo chuẩn: điểm, khoản, Điều, số ký hiệu, ngày ban hành, cơ quan ban hành.",
  },
];

async function gieoMaLoi() {
  for (const m of MA_LOI_GTDB) {
    await sql`
      INSERT INTO error_tags (code, name, description, remedy)
      VALUES (${m.code}, ${m.name}, ${m.description}, ${m.remedy})
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description,
                                       remedy = EXCLUDED.remedy`;
  }
  console.log(`  ${MA_LOI_GTDB.length} mã lỗi khái niệm của lĩnh vực`);
}

/* ------------------------------------------------------------------ */
/* Khung cây chuyên đề                                                  */
/* ------------------------------------------------------------------ */

interface KhungKyNang {
  code: string;
  name: string;
  prerequisites: string[];
}

interface KhungBai {
  slug: string;
  title: string;
  skills: string[];
  phut: number;
}

interface KhungChuyenDe {
  slug: string;
  title: string;
  summary: string;
  level: "co_ban" | "nang_cao";
  audience: string[];
  tags: string[];
  objectives: string[];
  /** Chuyên đề cha (cụ thể hoá) — slug. */
  cha?: string;
  /** Chuyên đề liền trước (nối tiếp) — slug. */
  noiTiepTu?: string;
  /** Văn bản đang có hiệu lực mà chuyên đề dựa vào. */
  hienHanh: string[];
  /** Văn bản đã hết hiệu lực nhưng vẫn cần cho tra cứu vụ việc cũ. */
  lichSu?: string[];
  kyNang: KhungKyNang[];
  bai: KhungBai[];
}

const DOI_TUONG_CSGT = ["can_bo_chuyen_mon", "thanh_tra"];

export const CAY_GTDB: KhungChuyenDe[] = [
  {
    slug: "he-thong-phap-luat-gtdb",
    title: "Hệ thống pháp luật về trật tự, an toàn giao thông đường bộ và cách xác định văn bản áp dụng",
    summary:
      "Hai luật nền năm 2024 (Luật Đường bộ, Luật Trật tự, an toàn giao thông đường bộ), các nghị định " +
      "quy định chi tiết và thông tư của Bộ Công an; dòng thời gian hiệu lực từ Luật Giao thông đường bộ " +
      "năm 2008 tới các nghị định sửa đổi năm 2026; cách xác định văn bản áp dụng cho một vụ việc theo " +
      "thời điểm vi phạm và cách viện dẫn đúng chuẩn trong biên bản, quyết định.",
    level: "co_ban",
    audience: DOI_TUONG_CSGT,
    tags: ["giao_thong_duong_bo", "hieu_luc", "thu_bac_van_ban"],
    objectives: [
      "Liệt kê đúng hệ thống văn bản điều chỉnh trật tự, an toàn giao thông đường bộ theo thứ bậc",
      "Xác định văn bản áp dụng cho một hành vi theo thời điểm vi phạm, kể cả vụ việc trước ngày 01/01/2025",
      "Viện dẫn điều, khoản, điểm đúng chuẩn trong biên bản và quyết định xử phạt",
    ],
    hienHanh: [
      VB.L_DUONG_BO,
      VB.L_TTATGT,
      VB.L_118_2025,
      VB.L_XLVPHC,
      VB.L_XLVPHC_SD_2020,
      VB.L_XLVPHC_SD_2025,
      VB.ND_151_2024,
      VB.ND_165_2024,
      VB.ND_168_2024,
      VB.ND_158_2024,
      VB.ND_236_2026,
      VB.ND_238_2026,
      VB.ND_241_2026,
      VB.ND_218_2026,
      VB.ND_336_2025,
      VB.ND_94_2026,
      VB.ND_89_2026,
    ],
    lichSu: [VB.L_GTDB_2008, VB.ND_100_2019, VB.ND_123_2021, VB.ND_160_2024, VB.ND_166_2024],
    kyNang: [
      { code: "gtdb_tra_cuu_hieu_luc", name: "Tra cứu hiệu lực theo thời điểm vi phạm", prerequisites: [] },
      {
        code: "gtdb_thu_bac_van_ban",
        name: "Xác định thứ bậc và văn bản được ưu tiên áp dụng",
        prerequisites: ["gtdb_tra_cuu_hieu_luc"],
      },
      {
        code: "gtdb_vien_dan",
        name: "Viện dẫn điều, khoản, điểm đúng chuẩn",
        prerequisites: ["gtdb_thu_bac_van_ban"],
      },
    ],
    bai: [
      {
        slug: "bai-1-hai-luat-nen-2024",
        title: "Hai luật nền năm 2024 và hệ thống văn bản hướng dẫn",
        skills: ["gtdb_tra_cuu_hieu_luc"],
        phut: 18,
      },
      {
        slug: "bai-2-dong-thoi-gian-hieu-luc",
        title: "Dòng thời gian hiệu lực và điều khoản chuyển tiếp: từ Luật năm 2008 sang hai luật năm 2024",
        skills: ["gtdb_tra_cuu_hieu_luc"],
        phut: 18,
      },
      {
        slug: "bai-3-thu-bac-va-mau-thuan",
        title: "Thứ bậc văn bản và xử lý mâu thuẫn giữa nghị định và thông tư",
        skills: ["gtdb_thu_bac_van_ban"],
        phut: 16,
      },
      {
        slug: "bai-4-vien-dan-trong-bien-ban",
        title: "Viện dẫn đúng chuẩn trong biên bản và quyết định xử phạt",
        skills: ["gtdb_vien_dan"],
        phut: 16,
      },
    ],
  },
  {
    slug: "quy-tac-giao-thong-duong-bo",
    title: "Quy tắc giao thông đường bộ",
    summary:
      "Quy tắc chung, chấp hành báo hiệu đường bộ, tốc độ và khoảng cách an toàn, vượt, tránh, chuyển " +
      "hướng, nhường đường, dừng đỗ, giao thông trên đường cao tốc, người đi bộ, xe thô sơ, xe ưu tiên " +
      "và các hành vi bị nghiêm cấm theo Luật Trật tự, an toàn giao thông đường bộ.",
    level: "co_ban",
    audience: DOI_TUONG_CSGT,
    tags: ["giao_thong_duong_bo", "quy_tac_giao_thong"],
    objectives: [
      "Xác định đúng văn bản điều chỉnh một tình huống giao thông theo thời điểm",
      "Vận dụng đúng quy tắc giao thông đường bộ khi xác định hành vi vi phạm",
      "Phân biệt hành vi vi phạm quy tắc với hành vi thuộc nhóm điều kiện phương tiện, người lái",
    ],
    noiTiepTu: "he-thong-phap-luat-gtdb",
    hienHanh: [
      VB.L_TTATGT,
      VB.L_118_2025,
      VB.L_DUONG_BO,
      VB.ND_151_2024,
      VB.ND_236_2026,
      VB.ND_168_2024,
      VB.ND_238_2026,
    ],
    kyNang: [
      { code: "gtdb_quy_tac_chung", name: "Quy tắc chung và báo hiệu đường bộ", prerequisites: [] },
      {
        code: "gtdb_toc_do_khoang_cach",
        name: "Tốc độ và khoảng cách an toàn",
        prerequisites: ["gtdb_quy_tac_chung"],
      },
      {
        code: "gtdb_vuot_tranh_nhuong",
        name: "Vượt, tránh, chuyển hướng, nhường đường, dừng đỗ",
        prerequisites: ["gtdb_quy_tac_chung"],
      },
      {
        code: "gtdb_duong_cao_toc",
        name: "Giao thông trên đường cao tốc, hầm, cầu, phà",
        prerequisites: ["gtdb_toc_do_khoang_cach"],
      },
      {
        code: "gtdb_hanh_vi_bi_cam",
        name: "Nồng độ cồn, chất ma túy và các hành vi bị nghiêm cấm",
        prerequisites: ["gtdb_quy_tac_chung"],
      },
    ],
    bai: [
      {
        slug: "bai-1-quy-tac-chung-va-bao-hieu",
        title: "Quy tắc chung và chấp hành báo hiệu đường bộ",
        skills: ["gtdb_quy_tac_chung"],
        phut: 20,
      },
      {
        slug: "bai-2-toc-do-va-khoang-cach",
        title: "Tốc độ và khoảng cách an toàn giữa các xe",
        skills: ["gtdb_toc_do_khoang_cach"],
        phut: 18,
      },
      {
        slug: "bai-3-vuot-tranh-chuyen-huong",
        title: "Vượt xe, tránh xe, chuyển hướng, nhường đường, dừng xe, đỗ xe",
        skills: ["gtdb_vuot_tranh_nhuong"],
        phut: 22,
      },
      {
        slug: "bai-4-duong-cao-toc-ham-pha",
        title: "Giao thông trên đường cao tốc, trong hầm, trên cầu và phà",
        skills: ["gtdb_duong_cao_toc"],
        phut: 16,
      },
      {
        slug: "bai-5-nguoi-di-bo-xe-tho-so-xe-uu-tien",
        title: "Người đi bộ, xe thô sơ, xe ưu tiên, xe chở trẻ em và người khuyết tật",
        skills: ["gtdb_quy_tac_chung"],
        phut: 16,
      },
      {
        slug: "bai-6-nong-do-con-va-hanh-vi-bi-cam",
        title: "Nồng độ cồn, chất ma túy và các hành vi bị nghiêm cấm",
        skills: ["gtdb_hanh_vi_bi_cam"],
        phut: 18,
      },
    ],
  },
  {
    slug: "phuong-tien-va-nguoi-lai-xe",
    title: "Phương tiện và người điều khiển phương tiện tham gia giao thông đường bộ",
    summary:
      "Điều kiện của xe cơ giới, xe máy chuyên dùng khi tham gia giao thông; đăng ký xe, biển số xe và " +
      "biển số định danh; giấy phép lái xe theo hạng, độ tuổi, sức khỏe, đào tạo, sát hạch; giấy tờ " +
      "người lái xe phải mang theo và kiểm tra qua tài khoản định danh điện tử.",
    level: "co_ban",
    audience: DOI_TUONG_CSGT,
    tags: ["giao_thong_duong_bo", "phuong_tien", "giay_phep_lai_xe"],
    objectives: [
      "Kiểm tra được điều kiện tham gia giao thông của phương tiện và giấy tờ của người lái xe",
      "Xác định đúng hạng giấy phép lái xe tương ứng với loại xe điều khiển",
      "Nhận diện giấy tờ, biển số không hợp lệ và xử lý đúng quy định",
    ],
    noiTiepTu: "quy-tac-giao-thong-duong-bo",
    hienHanh: [
      VB.L_TTATGT,
      VB.L_118_2025,
      VB.ND_151_2024,
      VB.ND_236_2026,
      VB.ND_94_2026,
      VB.ND_89_2026,
      VB.TT_79_2024_BCA,
      VB.TT_108_2026_BCA,
    ],
    lichSu: [VB.ND_160_2024, VB.ND_166_2024, VB.TT_35_2024_BCA, VB.TT_12_2025_BCA],
    kyNang: [
      {
        code: "gtdb_dieu_kien_phuong_tien",
        name: "Điều kiện phương tiện tham gia giao thông",
        prerequisites: [],
      },
      {
        code: "gtdb_dang_ky_xe",
        name: "Đăng ký xe, biển số xe",
        prerequisites: ["gtdb_dieu_kien_phuong_tien"],
      },
      {
        code: "gtdb_giay_phep_lai_xe",
        name: "Giấy phép lái xe và điều kiện người lái xe",
        prerequisites: [],
      },
      {
        code: "gtdb_kiem_tra_giay_to",
        name: "Kiểm tra giấy tờ, kể cả qua tài khoản định danh",
        prerequisites: ["gtdb_dang_ky_xe", "gtdb_giay_phep_lai_xe"],
      },
    ],
    bai: [
      {
        slug: "bai-1-dieu-kien-xe-co-gioi",
        title: "Điều kiện xe cơ giới, xe máy chuyên dùng tham gia giao thông và kiểm định",
        skills: ["gtdb_dieu_kien_phuong_tien"],
        phut: 18,
      },
      {
        slug: "bai-2-dang-ky-xe-bien-so",
        title: "Đăng ký xe, biển số xe và biển số định danh",
        skills: ["gtdb_dang_ky_xe"],
        phut: 18,
      },
      {
        slug: "bai-3-giay-phep-lai-xe",
        title: "Giấy phép lái xe: hạng, độ tuổi, sức khỏe, đào tạo và sát hạch",
        skills: ["gtdb_giay_phep_lai_xe"],
        phut: 20,
      },
      {
        slug: "bai-4-giay-to-mang-theo",
        title: "Giấy tờ người lái xe phải mang theo và kiểm tra qua tài khoản định danh",
        skills: ["gtdb_kiem_tra_giay_to"],
        phut: 16,
      },
    ],
  },
  {
    slug: "tuan-tra-kiem-soat-gtdb",
    title: "Tuần tra, kiểm soát, chỉ huy và điều khiển giao thông đường bộ",
    summary:
      "Nhiệm vụ, quyền hạn, hình thức tuần tra, kiểm soát của Cảnh sát giao thông; căn cứ dừng phương " +
      "tiện và trình tự kiểm soát; phương tiện, thiết bị kỹ thuật nghiệp vụ và dữ liệu hình ảnh; chỉ huy, " +
      "điều khiển giao thông, giải quyết ùn tắc và phối hợp với lực lượng khác.",
    level: "nang_cao",
    audience: DOI_TUONG_CSGT,
    tags: ["giao_thong_duong_bo", "tuan_tra_kiem_soat"],
    objectives: [
      "Xác định đúng căn cứ được phép dừng phương tiện và thực hiện đúng trình tự kiểm soát",
      "Sử dụng và ghi nhận kết quả của phương tiện, thiết bị kỹ thuật nghiệp vụ đúng quy định",
      "Tổ chức chỉ huy, điều khiển giao thông và phối hợp đúng thẩm quyền",
    ],
    noiTiepTu: "phuong-tien-va-nguoi-lai-xe",
    hienHanh: [VB.L_TTATGT, VB.ND_151_2024, VB.ND_135_2021, VB.TT_73_2024_BCA, VB.TT_69_2024_BCA],
    lichSu: [VB.TT_65_2020_BCA],
    kyNang: [
      { code: "gtdb_to_chuc_tuan_tra", name: "Tổ chức tuần tra, kiểm soát", prerequisites: [] },
      {
        code: "gtdb_dung_phuong_tien",
        name: "Căn cứ dừng phương tiện và trình tự kiểm soát",
        prerequisites: ["gtdb_to_chuc_tuan_tra"],
      },
      {
        code: "gtdb_thiet_bi_nghiep_vu",
        name: "Phương tiện, thiết bị kỹ thuật nghiệp vụ và dữ liệu",
        prerequisites: ["gtdb_dung_phuong_tien"],
      },
      {
        code: "gtdb_chi_huy_dieu_khien",
        name: "Chỉ huy, điều khiển giao thông",
        prerequisites: ["gtdb_to_chuc_tuan_tra"],
      },
    ],
    bai: [
      {
        slug: "bai-1-nhiem-vu-quyen-han-hinh-thuc",
        title: "Nhiệm vụ, quyền hạn và hình thức tuần tra, kiểm soát",
        skills: ["gtdb_to_chuc_tuan_tra"],
        phut: 18,
      },
      {
        slug: "bai-2-can-cu-dung-xe-va-trinh-tu",
        title: "Căn cứ dừng phương tiện và trình tự kiểm soát",
        skills: ["gtdb_dung_phuong_tien"],
        phut: 22,
      },
      {
        slug: "bai-3-thiet-bi-ky-thuat-nghiep-vu",
        title: "Phương tiện, thiết bị kỹ thuật nghiệp vụ, hệ thống giám sát và dữ liệu hình ảnh",
        skills: ["gtdb_thiet_bi_nghiep_vu"],
        phut: 18,
      },
      {
        slug: "bai-4-chi-huy-dieu-khien-giao-thong",
        title: "Chỉ huy, điều khiển giao thông và giải quyết ùn tắc",
        skills: ["gtdb_chi_huy_dieu_khien"],
        phut: 16,
      },
      {
        slug: "bai-5-ung-xu-ghi-hinh-phoi-hop",
        title: "Ứng xử khi kiểm soát, ghi hình và phối hợp với lực lượng khác",
        skills: ["gtdb_dung_phuong_tien"],
        phut: 16,
      },
    ],
  },
  {
    slug: "xu-ly-vi-pham-giao-thong-duong-bo",
    title: "Xử lý vi phạm hành chính về giao thông đường bộ",
    summary:
      "Tiếp nối chuyên đề tuần tra, kiểm soát: xác định hành vi và khung tiền phạt; thẩm quyền xử phạt " +
      "của Cảnh sát giao thông; lập biên bản, xử phạt tại chỗ, thời hạn; tạm giữ phương tiện, giấy tờ, " +
      "tước quyền sử dụng giấy phép; tình tiết tăng nặng, giảm nhẹ; xử phạt qua phương tiện kỹ thuật " +
      "nghiệp vụ; giải trình, khiếu nại và sai sót thường gặp.",
    level: "nang_cao",
    audience: DOI_TUONG_CSGT,
    tags: ["giao_thong_duong_bo", "xu_phat_hanh_chinh"],
    objectives: [
      "Xác định đúng thẩm quyền và trình tự xử phạt vi phạm hành chính",
      "Lập được hồ sơ xử phạt đủ thành phần và đúng thời hạn",
      "Áp dụng đúng hình thức xử phạt bổ sung, biện pháp ngăn chặn và biện pháp khắc phục hậu quả",
    ],
    noiTiepTu: "tuan-tra-kiem-soat-gtdb",
    hienHanh: [
      VB.L_XLVPHC,
      VB.L_XLVPHC_SD_2020,
      VB.L_XLVPHC_SD_2025,
      VB.L_TTATGT,
      VB.ND_168_2024,
      VB.ND_238_2026,
      VB.ND_118_2021,
      VB.TT_73_2024_BCA,
    ],
    lichSu: [VB.ND_100_2019, VB.ND_123_2021],
    kyNang: [
      { code: "gtdb_xac_dinh_hanh_vi", name: "Xác định hành vi và khung tiền phạt", prerequisites: [] },
      {
        code: "gtdb_tham_quyen_xu_phat",
        name: "Thẩm quyền xử phạt",
        prerequisites: ["gtdb_xac_dinh_hanh_vi"],
      },
      {
        code: "gtdb_lap_bien_ban",
        name: "Lập biên bản và ra quyết định xử phạt đúng thời hạn",
        prerequisites: ["gtdb_tham_quyen_xu_phat"],
      },
      {
        code: "gtdb_bien_phap_ngan_chan",
        name: "Tạm giữ, tước quyền sử dụng giấy phép và các biện pháp khác",
        prerequisites: ["gtdb_lap_bien_ban"],
      },
      {
        code: "gtdb_phat_nguoi",
        name: "Xử phạt qua phương tiện, thiết bị kỹ thuật nghiệp vụ",
        prerequisites: ["gtdb_lap_bien_ban"],
      },
      {
        code: "gtdb_khieu_nai",
        name: "Giải trình, khiếu nại và tự kiểm tra hồ sơ",
        prerequisites: ["gtdb_bien_phap_ngan_chan"],
      },
    ],
    bai: [
      {
        slug: "bai-1-hanh-vi-va-khung-tien-phat",
        title: "Xác định hành vi vi phạm và khung tiền phạt theo Nghị định số 168/2024/NĐ-CP",
        skills: ["gtdb_xac_dinh_hanh_vi"],
        phut: 22,
      },
      {
        slug: "bai-2-tham-quyen-xu-phat",
        title: "Thẩm quyền xử phạt của Cảnh sát giao thông",
        skills: ["gtdb_tham_quyen_xu_phat"],
        phut: 18,
      },
      {
        slug: "bai-3-lap-bien-ban-va-thoi-han",
        title: "Lập biên bản, xử phạt tại chỗ, ra quyết định và thời hạn",
        skills: ["gtdb_lap_bien_ban"],
        phut: 22,
      },
      {
        slug: "bai-4-tam-giu-va-tuoc-giay-phep",
        title: "Tạm giữ phương tiện, giấy tờ; tước quyền sử dụng giấy phép",
        skills: ["gtdb_bien_phap_ngan_chan"],
        phut: 20,
      },
      {
        slug: "bai-5-tinh-tiet-tang-nang-giam-nhe",
        title: "Hình thức phạt bổ sung, tình tiết tăng nặng, giảm nhẹ và nhiều hành vi trong một vụ",
        skills: ["gtdb_xac_dinh_hanh_vi"],
        phut: 18,
      },
      {
        slug: "bai-6-phat-nguoi",
        title: "Xử phạt qua phương tiện, thiết bị kỹ thuật nghiệp vụ",
        skills: ["gtdb_phat_nguoi"],
        phut: 18,
      },
      {
        slug: "bai-7-khieu-nai-va-sai-sot",
        title: "Giải trình, khiếu nại và sai sót thường gặp trong hồ sơ xử phạt",
        skills: ["gtdb_khieu_nai"],
        phut: 18,
      },
    ],
  },
  {
    slug: "tru-diem-phuc-hoi-diem-gplx",
    title: "Trừ điểm, phục hồi điểm giấy phép lái xe",
    summary:
      "Cụ thể hoá chuyên đề xử lý vi phạm cho cơ chế điểm giấy phép lái xe áp dụng từ ngày 01/01/2025: " +
      "hành vi bị trừ điểm, ghi trừ điểm trong quyết định xử phạt, dữ liệu điểm, phục hồi điểm và kiểm " +
      "tra kiến thức pháp luật.",
    level: "nang_cao",
    audience: DOI_TUONG_CSGT,
    tags: ["giao_thong_duong_bo", "giay_phep_lai_xe", "tru_diem"],
    objectives: [
      "Xác định đúng hành vi bị trừ điểm và số điểm bị trừ",
      "Ghi nội dung trừ điểm đúng chỗ trong quyết định xử phạt và cập nhật dữ liệu",
      "Hướng dẫn đúng thủ tục phục hồi điểm và kiểm tra kiến thức pháp luật",
    ],
    cha: "xu-ly-vi-pham-giao-thong-duong-bo",
    hienHanh: [
      VB.L_TTATGT,
      VB.ND_168_2024,
      VB.ND_238_2026,
      VB.ND_151_2024,
      VB.TT_65_2024_BCA,
      VB.TT_105_2026_BCA,
    ],
    kyNang: [
      { code: "gtdb_co_che_diem", name: "Cơ chế điểm giấy phép lái xe", prerequisites: [] },
      {
        code: "gtdb_tru_diem",
        name: "Trừ điểm trong quyết định xử phạt",
        prerequisites: ["gtdb_co_che_diem"],
      },
      {
        code: "gtdb_phuc_hoi_diem",
        name: "Phục hồi điểm và kiểm tra kiến thức pháp luật",
        prerequisites: ["gtdb_tru_diem"],
      },
    ],
    bai: [
      {
        slug: "bai-1-co-che-diem-va-hanh-vi-bi-tru",
        title: "Cơ chế điểm giấy phép lái xe và các hành vi bị trừ điểm",
        skills: ["gtdb_co_che_diem"],
        phut: 16,
      },
      {
        slug: "bai-2-tru-diem-trong-quyet-dinh",
        title: "Trình tự trừ điểm trong quyết định xử phạt và cập nhật dữ liệu",
        skills: ["gtdb_tru_diem"],
        phut: 16,
      },
      {
        slug: "bai-3-phuc-hoi-diem",
        title: "Phục hồi điểm và kiểm tra kiến thức pháp luật",
        skills: ["gtdb_phuc_hoi_diem"],
        phut: 14,
      },
    ],
  },
  {
    slug: "van-tai-duong-bo-va-kiem-soat-tai-trong",
    title: "Vận tải đường bộ và kiểm soát tải trọng, kích thước phương tiện",
    summary:
      "Cụ thể hoá chuyên đề xử lý vi phạm cho nhóm phương tiện kinh doanh vận tải: điều kiện kinh doanh " +
      "vận tải bằng xe ô tô, kiểm soát tải trọng và kích thước xe, thiết bị giám sát hành trình và " +
      "thiết bị ghi nhận hình ảnh, các vi phạm thường gặp của đơn vị kinh doanh vận tải.",
    level: "nang_cao",
    audience: DOI_TUONG_CSGT,
    tags: ["giao_thong_duong_bo", "van_tai", "tai_trong"],
    objectives: [
      "Kiểm tra được điều kiện kinh doanh vận tải và giấy tờ của xe kinh doanh vận tải",
      "Xác định đúng hành vi vi phạm tải trọng, kích thước và trách nhiệm của từng chủ thể",
      "Khai thác dữ liệu thiết bị giám sát hành trình đúng quy định",
    ],
    cha: "xu-ly-vi-pham-giao-thong-duong-bo",
    hienHanh: [
      VB.L_DUONG_BO,
      VB.L_TTATGT,
      VB.L_118_2025,
      VB.ND_158_2024,
      VB.ND_218_2026,
      VB.ND_168_2024,
      VB.ND_238_2026,
      VB.ND_336_2025,
      VB.ND_319_2026,
    ],
    kyNang: [
      {
        code: "gtdb_kinh_doanh_van_tai",
        name: "Điều kiện kinh doanh vận tải bằng xe ô tô",
        prerequisites: [],
      },
      {
        code: "gtdb_tai_trong",
        name: "Kiểm soát tải trọng, kích thước xe",
        prerequisites: ["gtdb_kinh_doanh_van_tai"],
      },
      {
        code: "gtdb_giam_sat_hanh_trinh",
        name: "Thiết bị giám sát hành trình và dữ liệu",
        prerequisites: ["gtdb_kinh_doanh_van_tai"],
      },
    ],
    bai: [
      {
        slug: "bai-1-dieu-kien-kinh-doanh-van-tai",
        title: "Điều kiện kinh doanh vận tải bằng xe ô tô và giấy tờ của xe kinh doanh vận tải",
        skills: ["gtdb_kinh_doanh_van_tai"],
        phut: 18,
      },
      {
        slug: "bai-2-kiem-soat-tai-trong",
        title: "Kiểm soát tải trọng, kích thước xe và trách nhiệm của lái xe, chủ xe, người xếp hàng",
        skills: ["gtdb_tai_trong"],
        phut: 20,
      },
      {
        slug: "bai-3-thiet-bi-giam-sat-hanh-trinh",
        title: "Thiết bị giám sát hành trình, thiết bị ghi nhận hình ảnh và khai thác dữ liệu",
        skills: ["gtdb_giam_sat_hanh_trinh"],
        phut: 16,
      },
      {
        slug: "bai-4-vi-pham-thuong-gap-van-tai",
        title: "Vi phạm thường gặp của đơn vị kinh doanh vận tải và cách lập hồ sơ",
        skills: ["gtdb_tai_trong"],
        phut: 16,
      },
    ],
  },
  {
    slug: "dieu-tra-giai-quyet-tai-nan-giao-thong",
    title: "Điều tra, giải quyết tai nạn giao thông đường bộ",
    summary:
      "Tiếp nhận tin báo, bảo vệ hiện trường, cứu nạn; khám nghiệm hiện trường, phương tiện, dấu vết; " +
      "xác định nguyên nhân, lỗi, phân loại vụ việc và xử lý; thống kê, báo cáo, giải quyết bồi thường " +
      "và trả phương tiện.",
    level: "nang_cao",
    audience: DOI_TUONG_CSGT,
    tags: ["giao_thong_duong_bo", "tai_nan_giao_thong"],
    objectives: [
      "Thực hiện đúng trình tự tiếp nhận, bảo vệ hiện trường và khám nghiệm",
      "Xác định nguyên nhân, lỗi và phân loại vụ tai nạn để xử lý đúng thẩm quyền",
      "Lập hồ sơ vụ tai nạn đủ thành phần, đúng thời hạn",
    ],
    noiTiepTu: "xu-ly-vi-pham-giao-thong-duong-bo",
    hienHanh: [VB.L_TTATGT, VB.ND_151_2024, VB.TT_72_2024_BCA],
    kyNang: [
      {
        code: "gtdb_tiep_nhan_hien_truong",
        name: "Tiếp nhận tin báo và bảo vệ hiện trường",
        prerequisites: [],
      },
      {
        code: "gtdb_kham_nghiem",
        name: "Khám nghiệm hiện trường, phương tiện, dấu vết",
        prerequisites: ["gtdb_tiep_nhan_hien_truong"],
      },
      {
        code: "gtdb_xac_dinh_loi",
        name: "Xác định nguyên nhân, lỗi và phân loại vụ việc",
        prerequisites: ["gtdb_kham_nghiem"],
      },
      {
        code: "gtdb_ho_so_tai_nan",
        name: "Hồ sơ, thống kê và giải quyết hậu quả",
        prerequisites: ["gtdb_xac_dinh_loi"],
      },
    ],
    bai: [
      {
        slug: "bai-1-tiep-nhan-bao-ve-hien-truong",
        title: "Tiếp nhận tin báo, bảo vệ hiện trường và cứu nạn",
        skills: ["gtdb_tiep_nhan_hien_truong"],
        phut: 16,
      },
      {
        slug: "bai-2-kham-nghiem",
        title: "Khám nghiệm hiện trường, phương tiện và dấu vết",
        skills: ["gtdb_kham_nghiem"],
        phut: 20,
      },
      {
        slug: "bai-3-nguyen-nhan-loi-phan-loai",
        title: "Xác định nguyên nhân, lỗi, phân loại và xử lý vụ tai nạn",
        skills: ["gtdb_xac_dinh_loi"],
        phut: 20,
      },
      {
        slug: "bai-4-ho-so-thong-ke-boi-thuong",
        title: "Hồ sơ, thống kê, báo cáo, giải quyết bồi thường và trả phương tiện",
        skills: ["gtdb_ho_so_tai_nan"],
        phut: 16,
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Kiểm chứng viện dẫn với kho                                          */
/* ------------------------------------------------------------------ */

interface TrangThaiVanBan {
  urn: string;
  co: boolean;
  status?: string;
  title?: string;
}

/** Tra kho một lượt cho mọi URN; văn bản chưa có thì không được đưa vào bản đồ pháp lý. */
async function traKho(urns: string[]): Promise<Map<string, TrangThaiVanBan>> {
  const ds = [...new Set(urns)];
  const rows = await sql<{ urn: string; status: string; title: string }[]>`
    SELECT urn, status, title FROM documents WHERE urn = ANY(${ds}::text[])`;
  const co = new Map(rows.map((r) => [r.urn, r]));
  return new Map(
    ds.map((u) => {
      const r = co.get(u);
      return [u, r ? { urn: u, co: true, status: r.status, title: r.title } : { urn: u, co: false }];
    }),
  );
}

/* ------------------------------------------------------------------ */
/* Bài đã soạn đủ nội dung                                              */
/* ------------------------------------------------------------------ */

type SoanBai = (courseId: string, lessonId: string) => Promise<void>;

/** Khoá `slug chuyên đề › slug bài`. Bài trong danh sách này được xuất bản sau khi soạn. */
const BAI_DA_SOAN: Record<string, SoanBai> = {
  "he-thong-phap-luat-gtdb › bai-1-hai-luat-nen-2024": soanHeThongBai1,
  "he-thong-phap-luat-gtdb › bai-2-dong-thoi-gian-hieu-luc": soanHeThongBai2,
  "van-tai-duong-bo-va-kiem-soat-tai-trong › bai-3-thiet-bi-giam-sat-hanh-trinh": soanVanTaiBai3,
  "phuong-tien-va-nguoi-lai-xe › bai-1-dieu-kien-xe-co-gioi": soanPhuongTienBai1,
  "phuong-tien-va-nguoi-lai-xe › bai-3-giay-phep-lai-xe": soanPhuongTienBai3,
  "phuong-tien-va-nguoi-lai-xe › bai-4-giay-to-mang-theo": soanPhuongTienBai4,
  "tru-diem-phuc-hoi-diem-gplx › bai-1-co-che-diem-va-hanh-vi-bi-tru": soanTruDiemBai1,
};

/* ------------------------------------------------------------------ */
/* Nội dung bài đã soạn                                                 */
/* ------------------------------------------------------------------ */

interface KhoiSoan {
  kind: string;
  data: Record<string, unknown>;
  citations?: string[];
}

async function ghiKhoi(lessonId: string, khoi: KhoiSoan[]) {
  await sql`DELETE FROM lesson_blocks WHERE lesson_id = ${lessonId}::uuid`;
  await sql`DELETE FROM activities WHERE lesson_id = ${lessonId}::uuid`;
  for (const [i, k] of khoi.entries()) {
    await luuKhoi({ lessonId, ordinal: i + 1, kind: k.kind, data: k.data, citations: k.citations ?? [] });
  }
}

/** Chuyên đề 1, bài 1 — hai luật nền năm 2024 và hệ thống văn bản hướng dẫn. */
async function soanHeThongBai1(courseId: string, lessonId: string) {
  const khoi: KhoiSoan[] = [
    {
      kind: "kich_ban",
      data: {
        luot: [
          {
            vai: "Cán bộ",
            loi: "Tôi dùng lại mẫu quyết định xử phạt của năm 2024; phần căn cứ ghi Nghị định số 100/2019/NĐ-CP.",
          },
          {
            vai: "Tổ trưởng",
            loi: "Hành vi xảy ra tháng 8 năm 2026. Tại thời điểm đó, văn bản xử phạt về trật tự, an toàn giao thông đường bộ đang có hiệu lực là văn bản nào?",
          },
          { vai: "Cán bộ", loi: "Tôi chưa tra lại trạng thái hiệu lực." },
        ],
      },
    },
    {
      kind: "giang",
      data: {
        md:
          "Từ ngày 01/01/2025, lĩnh vực giao thông đường bộ được điều chỉnh bởi **hai luật nền** cùng có hiệu lực: " +
          "**Luật Đường bộ số 35/2024/QH15** (hoạt động đường bộ: kết cấu hạ tầng, vận tải đường bộ) và " +
          "**Luật Trật tự, an toàn giao thông đường bộ số 36/2024/QH15** (quy tắc giao thông; phương tiện và " +
          "người tham gia giao thông; chỉ huy, điều khiển, tuần tra, kiểm soát; giải quyết tai nạn giao thông; trách " +
          "nhiệm quản lý nhà nước — Điều 1 của Luật). Cả hai luật được Quốc hội thông qua ngày 27/6/2024.\n\n" +
          "Dưới hai luật là bốn nghị định gốc cùng có hiệu lực từ ngày 01/01/2025: Nghị định số 151/2024/NĐ-CP " +
          "(quy định chi tiết Luật Trật tự, an toàn giao thông đường bộ), Nghị định số 165/2024/NĐ-CP (quy định chi " +
          "tiết Luật Đường bộ và Điều 77 Luật Trật tự, an toàn giao thông đường bộ), Nghị định số 168/2024/NĐ-CP " +
          "(xử phạt vi phạm hành chính về trật tự, an toàn giao thông; trừ điểm, phục hồi điểm giấy phép lái xe) " +
          "và Nghị định số 158/2024/NĐ-CP (hoạt động vận tải đường bộ).\n\n" +
          "Năm 2026 khung này được sửa đổi đồng loạt: Luật số 118/2025/QH15 sửa cả hai luật nền từ ngày 01/7/2026; " +
          "bốn nghị định gốc lần lượt được sửa bởi Nghị định số 236, 241, 238 và 218/2026/NĐ-CP. Hai bộ chủ trì: " +
          "**Bộ Công an** đề nghị ban hành các nghị định về trật tự, an toàn giao thông và xử phạt; **Bộ Xây dựng** " +
          "(tiếp nhận chức năng của Bộ Giao thông vận tải) đề nghị ban hành các nghị định về đường bộ và vận tải.",
      },
    },
    {
      kind: "can_cu",
      data: {
        urn: VB.L_TTATGT,
        nhan: "Điều 1 Luật Trật tự, an toàn giao thông đường bộ số 36/2024/QH15 ngày 27/6/2024 của Quốc hội",
        nguyen_van:
          "Luật này quy định về quy tắc, phương tiện, người tham gia giao thông đường bộ, chỉ huy, điều khiển, tuần " +
          "tra, kiểm soát, giải quyết tai nạn giao thông đường bộ, trách nhiệm quản lý nhà nước và trách nhiệm của cơ " +
          "quan, tổ chức, cá nhân có liên quan đến trật tự, an toàn giao thông đường bộ.",
        as_of: AS_OF_GTDB,
      },
      citations: [VB.L_TTATGT],
    },
    {
      kind: "bang_tra",
      data: {
        cot: ["Thứ bậc", "Văn bản", "Nội dung điều chỉnh", "Hiệu lực từ", "Đã được sửa đổi bởi"],
        dong: [
          [
            "Luật",
            "Luật Đường bộ số 35/2024/QH15",
            "Hoạt động đường bộ: kết cấu hạ tầng, vận tải đường bộ",
            "01/01/2025",
            "Luật số 118/2025/QH15 (Điều 8), từ 01/7/2026",
          ],
          [
            "Luật",
            "Luật Trật tự, an toàn giao thông đường bộ số 36/2024/QH15",
            "Quy tắc giao thông; phương tiện, người tham gia giao thông; chỉ huy, điều khiển, tuần tra, kiểm soát; giải quyết tai nạn giao thông (Điều 1)",
            "01/01/2025",
            "Luật số 118/2025/QH15 (Điều 7), từ 01/7/2026",
          ],
          [
            "Luật",
            "Luật Xử lý vi phạm hành chính số 15/2012/QH13",
            "Nguyên tắc, thẩm quyền, trình tự xử phạt chung cho mọi lĩnh vực",
            "—",
            "Luật số 67/2020/QH14; Luật số 88/2025/QH15 (từ 01/7/2025)",
          ],
          [
            "Nghị định",
            "151/2024/NĐ-CP",
            "Quy định chi tiết Luật Trật tự, an toàn giao thông đường bộ",
            "01/01/2025",
            "Nghị định số 184/2025/NĐ-CP; Nghị định số 236/2026/NĐ-CP (từ 01/7/2026)",
          ],
          [
            "Nghị định",
            "165/2024/NĐ-CP",
            "Quy định chi tiết Luật Đường bộ và Điều 77 Luật Trật tự, an toàn giao thông đường bộ",
            "01/01/2025",
            "Nghị định số 241/2026/NĐ-CP (từ 01/7/2026)",
          ],
          [
            "Nghị định",
            "168/2024/NĐ-CP",
            "Xử phạt vi phạm hành chính về trật tự, an toàn giao thông; trừ điểm, phục hồi điểm giấy phép lái xe",
            "01/01/2025",
            "Nghị định số 238/2026/NĐ-CP (từ 15/8/2026)",
          ],
          [
            "Nghị định",
            "158/2024/NĐ-CP",
            "Hoạt động vận tải đường bộ",
            "01/01/2025",
            "Nghị định số 218/2026/NĐ-CP (từ 10/8/2026)",
          ],
          [
            "Nghị định",
            "336/2025/NĐ-CP",
            "Xử phạt vi phạm hành chính trong hoạt động đường bộ",
            "01/3/2026",
            "—",
          ],
          [
            "Nghị định",
            "94/2026/NĐ-CP",
            "Đào tạo và sát hạch lái xe (bãi bỏ Nghị định số 160/2024/NĐ-CP)",
            "01/7/2026",
            "—",
          ],
          [
            "Nghị định",
            "89/2026/NĐ-CP",
            "Kiểm định xe cơ giới; niên hạn sử dụng (thay Nghị định số 166/2024/NĐ-CP)",
            "01/7/2026",
            "—",
          ],
          [
            "Nghị định",
            "319/2026/NĐ-CP",
            "Thiết bị giám sát trên phương tiện giao thông đường bộ",
            "01/7/2027 (chưa có hiệu lực)",
            "—",
          ],
        ],
      },
      citations: [
        VB.L_DUONG_BO,
        VB.L_TTATGT,
        VB.L_118_2025,
        VB.L_XLVPHC,
        VB.L_XLVPHC_SD_2025,
        VB.ND_151_2024,
        VB.ND_165_2024,
        VB.ND_168_2024,
        VB.ND_158_2024,
        VB.ND_236_2026,
        VB.ND_241_2026,
        VB.ND_238_2026,
        VB.ND_218_2026,
        VB.ND_336_2025,
        VB.ND_94_2026,
        VB.ND_89_2026,
        VB.ND_319_2026,
      ],
    },
    {
      kind: "can_cu",
      data: {
        urn: VB.L_118_2025,
        nhan: "Khoản 1, khoản 2 và khoản 3 Điều 11 Luật số 118/2025/QH15 ngày 10/12/2025 của Quốc hội (trích)",
        nguyen_van:
          "1. Luật này có hiệu lực thi hành từ ngày 01 tháng 7 năm 2026, trừ quy định tại khoản 2 Điều này. " +
          "2. Quy định tại điểm a khoản 20 Điều 7 của Luật này có hiệu lực thi hành từ ngày 01 tháng 01 năm 2026. " +
          "3. Thay thế cụm từ “Bộ Giao thông vận tải” bằng cụm từ “Bộ Xây dựng” tại điểm 1.1a, tiểu mục 1 thuộc " +
          "phần V- Phí thuộc lĩnh vực giao thông vận tải trong Danh mục phí, lệ phí ban hành kèm theo Luật Phí và lệ phí " +
          "số 97/2015/QH13 […]",
        as_of: AS_OF_GTDB,
      },
      citations: [VB.L_118_2025],
    },
    {
      kind: "hoi_nhanh",
      data: {
        cau_hoi:
          "Từ ngày 01/7/2026, bộ nào thực hiện chức năng quản lý nhà nước về hoạt động đường bộ thay cho Bộ Giao thông vận tải?",
        phuong_an: [
          { id: "a", text: "Bộ Công an" },
          { id: "b", text: "Bộ Xây dựng" },
          { id: "c", text: "Bộ Nội vụ" },
        ],
        dap_an: "b",
        giai_thich:
          "Khoản 1 Điều 8 Luật số 118/2025/QH15 sửa khoản 6 Điều 2 Luật Đường bộ: cơ quan quản lý đường bộ là cơ quan " +
          "thuộc Bộ Xây dựng. Điều 38 Nghị định số 218/2026/NĐ-CP thay cụm từ “Bộ Giao thông vận tải” bằng " +
          "“Bộ Xây dựng” trong Nghị định số 158/2024/NĐ-CP.",
      },
    },
    {
      kind: "so_do_trinh_tu",
      data: {
        buoc: [
          {
            ma: "b1",
            nhan: "Xác định thời điểm hành vi",
            mo_ta: "Ngày, giờ vi phạm ghi trong biên bản hoặc dữ liệu thiết bị",
          },
          {
            ma: "b2",
            nhan: "Chọn luật nền",
            mo_ta:
              "Từ 01/01/2025: Luật số 36/2024/QH15 và Luật số 35/2024/QH15; từ 01/7/2026 đọc kèm Luật số 118/2025/QH15",
          },
          {
            ma: "b3",
            nhan: "Chọn nghị định xử phạt và bản sửa đổi",
            mo_ta: "Nghị định số 168/2024/NĐ-CP; hành vi từ 15/8/2026 đọc kèm Nghị định số 238/2026/NĐ-CP",
          },
          {
            ma: "b4",
            nhan: "Tra thông tư hướng dẫn trình tự",
            mo_ta: "Thông tư của Bộ Công an về tuần tra, kiểm soát, xử lý vi phạm",
          },
          {
            ma: "b5",
            nhan: "Ghi viện dẫn",
            mo_ta: "Điểm, khoản, Điều, số ký hiệu, ngày ban hành, cơ quan ban hành",
          },
        ],
        canh: [
          { tu: "b1", den: "b2" },
          { tu: "b2", den: "b3" },
          { tu: "b3", den: "b4" },
          { tu: "b4", den: "b5" },
        ],
      },
      citations: [VB.L_TTATGT, VB.L_118_2025, VB.ND_168_2024, VB.ND_238_2026],
    },
    {
      kind: "canh_bao",
      data: {
        loai: "hieu_luc",
        md:
          "Không dùng lại phần căn cứ của hồ sơ cũ mà chưa tra lại hiệu lực. Từ ngày 01/7/2026, các cụm từ " +
          "“Bộ Giao thông vận tải”, “Sở Giao thông vận tải” trong biểu mẫu cũ đã được thay bằng " +
          "“Bộ Xây dựng”, “Sở Xây dựng” (khoản 3 Điều 11 Luật số 118/2025/QH15; Điều 38 Nghị định số " +
          "218/2026/NĐ-CP).",
      },
    },
    {
      kind: "the_lat",
      data: {
        the: [
          {
            truoc: "Luật nền",
            sau: "Luật điều chỉnh trực tiếp lĩnh vực; các nghị định, thông tư chỉ quy định chi tiết những điều luật giao.",
          },
          {
            truoc: "Văn bản sửa đổi, bổ sung",
            sau: "Văn bản thay một số điều, khoản, điểm của văn bản gốc; văn bản gốc vẫn còn hiệu lực và phải đọc kèm bản sửa đổi.",
          },
          {
            truoc: "Thời điểm áp dụng",
            sau: "Ngày hành vi xảy ra hoặc ngày hồ sơ được tiếp nhận; văn bản áp dụng là văn bản đang có hiệu lực tại ngày đó.",
          },
          {
            truoc: "Hai bộ chủ trì",
            sau: "Bộ Công an: trật tự, an toàn giao thông và xử phạt. Bộ Xây dựng: đường bộ, vận tải, đăng kiểm.",
          },
        ],
      },
      citations: [VB.L_118_2025, VB.ND_236_2026, VB.ND_241_2026],
    },
    {
      kind: "tom_tat",
      data: {
        y: [
          "Từ 01/01/2025, hai luật nền là Luật số 35/2024/QH15 và Luật số 36/2024/QH15; bốn nghị định gốc là 151, 165, 168 và 158/2024/NĐ-CP.",
          "Từ 01/7/2026, đọc hai luật nền kèm Luật số 118/2025/QH15; các nghị định gốc đọc kèm bản sửa đổi năm 2026.",
          "Bộ Xây dựng thay Bộ Giao thông vận tải trong toàn bộ hệ thống văn bản (khoản 3 Điều 11 Luật số 118/2025/QH15).",
          "Mọi viện dẫn phải xác định theo thời điểm của hành vi, không theo mẫu hồ sơ cũ.",
        ],
      },
    },
  ];
  await ghiKhoi(lessonId, khoi);

  await luuHoatDong({
    courseId,
    lessonId,
    ordinal: 1,
    kind: "trac_nghiem",
    mode: "may",
    title: "Chọn văn bản xử phạt theo thời điểm vi phạm",
    prompt: {
      cau_hoi:
        "Ngày 20/8/2026, tổ tuần tra phát hiện xe ô tô gắn biển số không đúng quy cách. Văn bản xử phạt áp dụng là văn bản nào?",
      phuong_an: [
        { id: "a", text: "Nghị định số 100/2019/NĐ-CP" },
        {
          id: "b",
          text: "Nghị định số 168/2024/NĐ-CP đã được sửa đổi, bổ sung bởi Nghị định số 238/2026/NĐ-CP",
        },
        {
          id: "c",
          text: "Nghị định số 168/2024/NĐ-CP bản chưa sửa đổi, vì Nghị định số 238/2026/NĐ-CP chưa có hiệu lực",
        },
      ],
    },
    answer: {
      dung: ["b"],
      giai_thich:
        "Nghị định số 238/2026/NĐ-CP có hiệu lực từ ngày 15/8/2026 và sửa điểm b khoản 8 Điều 13 Nghị định số " +
        "168/2024/NĐ-CP về hành vi gắn biển số không đúng quy cách (Điều 3 Nghị định số 238/2026/NĐ-CP).",
      phuong_an: [
        {
          id: "a",
          text: "Nghị định số 100/2019/NĐ-CP",
          ma_loi: "dung_van_ban_het_hieu_luc",
          giai_thich: "Nghị định số 100/2019/NĐ-CP thuộc khung pháp lý trước ngày 01/01/2025.",
        },
        {
          id: "b",
          text: "Nghị định số 168/2024/NĐ-CP đã được sửa đổi bởi Nghị định số 238/2026/NĐ-CP",
          dung: true,
        },
        {
          id: "c",
          text: "Nghị định số 168/2024/NĐ-CP bản chưa sửa đổi",
          ma_loi: "nham_chuyen_tiep",
          giai_thich: "Nghị định số 238/2026/NĐ-CP có hiệu lực từ ngày 15/8/2026, trước ngày xảy ra hành vi.",
        },
      ],
    },
    skills: ["gtdb_tra_cuu_hieu_luc"],
    errorTags: ["dung_van_ban_het_hieu_luc", "nham_chuyen_tiep"],
    citations: [VB.ND_168_2024, VB.ND_238_2026],
    points: 2,
    level: 1,
  });

  await luuHoatDong({
    courseId,
    lessonId,
    ordinal: 2,
    kind: "ghep_cap",
    mode: "may",
    title: "Ghép nghị định với nội dung điều chỉnh",
    prompt: {
      cau_hoi: "Ghép mỗi nghị định với nội dung mà nghị định đó quy định.",
      trai: [
        { id: "t1", text: "Nghị định số 94/2026/NĐ-CP" },
        { id: "t2", text: "Nghị định số 89/2026/NĐ-CP" },
        { id: "t3", text: "Nghị định số 158/2024/NĐ-CP" },
        { id: "t4", text: "Nghị định số 168/2024/NĐ-CP" },
        { id: "t5", text: "Nghị định số 165/2024/NĐ-CP" },
      ],
      phai: [
        { id: "p1", text: "Hoạt động đào tạo và sát hạch lái xe" },
        { id: "p2", text: "Kiểm định xe cơ giới; niên hạn sử dụng của xe cơ giới" },
        { id: "p3", text: "Hoạt động vận tải đường bộ" },
        {
          id: "p4",
          text: "Xử phạt vi phạm hành chính về trật tự, an toàn giao thông; trừ điểm, phục hồi điểm giấy phép lái xe",
        },
        {
          id: "p5",
          text: "Quy định chi tiết Luật Đường bộ và Điều 77 Luật Trật tự, an toàn giao thông đường bộ",
        },
      ],
    },
    answer: {
      cap: { t1: "p1", t2: "p2", t3: "p3", t4: "p4", t5: "p5" },
      giai_thich: "Nội dung điều chỉnh lấy theo Điều 1 (phạm vi điều chỉnh) và tên gọi của từng nghị định.",
    },
    skills: ["gtdb_tra_cuu_hieu_luc"],
    errorTags: ["vien_dan_sai_dieu_khoan"],
    citations: [VB.ND_94_2026, VB.ND_89_2026, VB.ND_158_2024, VB.ND_168_2024, VB.ND_165_2024],
    points: 2,
    level: 1,
  });
}

/** Chuyên đề 1, bài 2 — dòng thời gian hiệu lực và điều khoản chuyển tiếp. */
async function soanHeThongBai2(courseId: string, lessonId: string) {
  const khoi: KhoiSoan[] = [
    {
      kind: "giang",
      data: {
        md:
          "Văn bản áp dụng cho một vụ việc được xác định theo **thời điểm của hành vi** (với xử phạt) hoặc **thời điểm " +
          "tiếp nhận hồ sơ** (với thủ tục hành chính). Hai loại mốc phải tra: mốc **hiệu lực** của từng văn bản và " +
          "**điều khoản chuyển tiếp** cho phép hồ sơ đang dở tiếp tục theo văn bản cũ.\n\n" +
          "Một văn bản sửa đổi, bổ sung không thay thế toàn bộ văn bản gốc: sau ngày sửa đổi có hiệu lực, văn bản gốc " +
          "vẫn được viện dẫn, kèm theo bản sửa đổi. Ví dụ hành vi vi phạm từ ngày 15/8/2026 được xử phạt theo Nghị định " +
          "số 168/2024/NĐ-CP đã được sửa đổi, bổ sung bởi Nghị định số 238/2026/NĐ-CP.\n\n" +
          "Khi một nghị định mới bãi bỏ nghị định cũ (Nghị định số 94/2026/NĐ-CP bãi bỏ Nghị định số 160/2024/NĐ-CP; " +
          "Nghị định số 89/2026/NĐ-CP thay Nghị định số 166/2024/NĐ-CP), giấy phép, giấy chứng nhận đã cấp theo nghị " +
          "định cũ tiếp tục có giá trị theo quy định chuyển tiếp của nghị định mới.",
      },
    },
    {
      kind: "can_cu",
      data: {
        urn: VB.L_TTATGT,
        nhan: "Khoản 1 và khoản 3 Điều 88; khoản 1 Điều 89 Luật số 36/2024/QH15 (trích)",
        nguyen_van:
          "Điều 88. 1. Luật này có hiệu lực thi hành từ ngày 01 tháng 01 năm 2025, trừ trường hợp quy định tại khoản 2 " +
          "Điều này. […] 3. Luật Giao thông đường bộ số 23/2008/QH12 đã được sửa đổi, bổ sung một số điều theo Luật số " +
          "35/2018/QH14 và Luật số 44/2019/QH14 hết hiệu lực kể từ ngày Luật này có hiệu lực thi hành, trừ trường hợp " +
          "quy định tại các khoản 1, 2, 5 và 6 Điều 89 của Luật này. Điều 89. 1. Giấy phép lái xe được cấp trước ngày " +
          "Luật này có hiệu lực thi hành được tiếp tục sử dụng theo thời hạn ghi trên giấy phép lái xe.",
        as_of: AS_OF_GTDB,
      },
      citations: [VB.L_TTATGT],
    },
    {
      kind: "dong_thoi_gian",
      data: {
        moc: [
          {
            ngay: "2025-01-01",
            nhan: "Luật số 35/2024/QH15, Luật số 36/2024/QH15 và các Nghị định số 151, 165, 168, 158/2024/NĐ-CP có hiệu lực",
            loai: "hieu_luc",
          },
          {
            ngay: "2025-07-01",
            nhan: "Luật số 88/2025/QH15 sửa Luật Xử lý vi phạm hành chính có hiệu lực; Nghị định số 184/2025/NĐ-CP sửa Nghị định số 151/2024/NĐ-CP",
            loai: "hieu_luc",
          },
          {
            ngay: "2026-01-01",
            nhan: "Khoản 3 Điều 10 Luật số 36/2024/QH15 (thiết bị an toàn cho trẻ em trên xe ô tô) có hiệu lực theo khoản 2 Điều 88; điểm a khoản 20 Điều 7 Luật số 118/2025/QH15 có hiệu lực sớm",
            loai: "hieu_luc",
          },
          {
            ngay: "2026-03-01",
            nhan: "Nghị định số 336/2025/NĐ-CP (xử phạt trong hoạt động đường bộ) có hiệu lực",
            loai: "hieu_luc",
          },
          {
            ngay: "2026-07-01",
            nhan: "Luật số 118/2025/QH15; Nghị định số 236, 241, 94, 89/2026/NĐ-CP có hiệu lực; Nghị định số 160/2024 và 166/2024/NĐ-CP hết hiệu lực",
            loai: "thay_the",
          },
          {
            ngay: "2026-08-10",
            nhan: "Nghị định số 218/2026/NĐ-CP sửa Nghị định số 158/2024/NĐ-CP có hiệu lực",
            loai: "hieu_luc",
          },
          {
            ngay: "2026-08-15",
            nhan: "Nghị định số 238/2026/NĐ-CP sửa Nghị định số 168/2024/NĐ-CP có hiệu lực",
            loai: "hieu_luc",
          },
          {
            ngay: "2027-07-01",
            nhan: "Nghị định số 319/2026/NĐ-CP về thiết bị giám sát trên phương tiện có hiệu lực",
            loai: "hieu_luc",
          },
        ],
        ghi_chu:
          "Ngày hiệu lực lấy theo điều khoản thi hành của từng văn bản trong kho; Nghị định số 184/2025/NĐ-CP được " +
          "nêu tại phần mở đầu Nghị định số 236/2026/NĐ-CP.",
      },
      citations: [
        VB.L_TTATGT,
        VB.L_DUONG_BO,
        VB.L_118_2025,
        VB.L_XLVPHC_SD_2025,
        VB.ND_236_2026,
        VB.ND_241_2026,
        VB.ND_238_2026,
        VB.ND_218_2026,
        VB.ND_94_2026,
        VB.ND_89_2026,
        VB.ND_336_2025,
        VB.ND_319_2026,
      ],
    },
    {
      kind: "can_cu",
      data: {
        urn: VB.ND_218_2026,
        nhan: "Khoản 1 và điểm b khoản 5 Điều 39 Nghị định số 218/2026/NĐ-CP ngày 19/6/2026 của Chính phủ",
        nguyen_van:
          "1. Nghị định này có hiệu lực thi hành từ ngày 10 tháng 8 năm 2026. […] 5. Điều khoản chuyển tiếp […] " +
          "b) Các hồ sơ thủ tục hành chính đã được cơ quan có thẩm quyền tiếp nhận hồ sơ trước ngày Nghị định này có " +
          "hiệu lực thi hành thì cơ quan có thẩm quyền đã tiếp nhận hồ sơ tiếp tục thực hiện theo quy định của văn bản " +
          "quy phạm pháp luật tại thời điểm tiếp nhận hồ sơ; trường hợp hồ sơ phải trả lại, tổ chức, cá nhân hoàn thiện " +
          "hồ sơ và gửi cơ quan có thẩm quyền giải quyết sau ngày Nghị định này có hiệu lực, thì thực hiện theo trình tự, " +
          "thủ tục quy định tại Nghị định này;",
        as_of: AS_OF_GTDB,
      },
      citations: [VB.ND_218_2026],
    },
    {
      kind: "can_cu",
      data: {
        urn: VB.ND_94_2026,
        nhan: "Điều 41 Nghị định số 94/2026/NĐ-CP ngày 31/3/2026 của Chính phủ",
        nguyen_van:
          "1. Nghị định này có hiệu lực thi hành từ ngày 01 tháng 7 năm 2026. 2. Nghị định này bãi bỏ Nghị định số " +
          "160/2024/NĐ-CP ngày 18 tháng 12 năm 2024 của Chính phủ quy định về hoạt động đào tạo và sát hạch lái xe.",
        as_of: AS_OF_GTDB,
      },
      citations: [VB.ND_94_2026],
    },
    {
      kind: "cay_quyet_dinh",
      data: {
        goc: "q1",
        nut: {
          q1: { hoi: "Hành vi vi phạm xảy ra trước ngày 01/01/2025?", co: "kl_cu", khong: "q2" },
          kl_cu: {
            ket_luan:
              "Áp dụng khung pháp lý cũ: Luật Giao thông đường bộ số 23/2008/QH12 (hết hiệu lực từ 01/01/2025 theo khoản 3 " +
              "Điều 88 Luật số 36/2024/QH15) và nghị định xử phạt có hiệu lực tại thời điểm " +
              "vi phạm (Nghị định số 100/2019/NĐ-CP, sửa đổi bởi Nghị định số 123/2021/NĐ-CP). Tra bản đã hết hiệu lực trong kho.",
          },
          q2: { hoi: "Hành vi vi phạm xảy ra từ ngày 15/8/2026?", co: "kl_moi", khong: "kl_goc" },
          kl_moi: {
            ket_luan:
              "Áp dụng Nghị định số 168/2024/NĐ-CP đã được sửa đổi, bổ sung bởi Nghị định số 238/2026/NĐ-CP; đối chiếu điều, " +
              "khoản, điểm đã sửa trong Nghị định số 238/2026/NĐ-CP trước khi ghi mức phạt.",
          },
          kl_goc: {
            ket_luan:
              "Áp dụng Nghị định số 168/2024/NĐ-CP bản có hiệu lực từ ngày 01/01/2025 đến hết ngày 14/8/2026 (chưa sửa đổi).",
          },
        },
      },
      citations: [VB.L_TTATGT, VB.ND_168_2024, VB.ND_238_2026],
    },
    {
      kind: "hoi_nhanh",
      data: {
        cau_hoi:
          "Hồ sơ đề nghị cấp phù hiệu xe kinh doanh vận tải được tiếp nhận ngày 05/8/2026, giải quyết ngày 12/8/2026. Trình tự áp dụng theo văn bản nào?",
        phuong_an: [
          { id: "a", text: "Nghị định số 218/2026/NĐ-CP, vì ngày giải quyết sau ngày 10/8/2026" },
          {
            id: "b",
            text: "Văn bản có hiệu lực tại thời điểm tiếp nhận hồ sơ (Nghị định số 158/2024/NĐ-CP bản trước sửa đổi)",
          },
          { id: "c", text: "Do cơ quan tiếp nhận tự chọn" },
        ],
        dap_an: "b",
        giai_thich:
          "Điểm b khoản 5 Điều 39 Nghị định số 218/2026/NĐ-CP: hồ sơ đã tiếp nhận trước ngày nghị định có hiệu lực " +
          "tiếp tục thực hiện theo quy định tại thời điểm tiếp nhận hồ sơ.",
      },
    },
    {
      kind: "canh_bao",
      data: {
        loai: "hieu_luc",
        md:
          "Bản hợp nhất do hệ thống tạo là tài liệu tham khảo. Căn cứ chính thức để viện dẫn là văn bản gốc kèm văn bản " +
          "sửa đổi, hoặc văn bản hợp nhất do cơ quan nhà nước ban hành. Nghị định số 319/2026/NĐ-CP chỉ có hiệu lực từ " +
          "ngày 01/7/2027; không viện dẫn để xử lý vụ việc trước ngày đó.",
      },
    },
    {
      kind: "tom_tat",
      data: {
        y: [
          "Xử phạt: chọn văn bản theo ngày hành vi; thủ tục hành chính: theo ngày tiếp nhận hồ sơ (điểm b khoản 5 Điều 39 Nghị định số 218/2026/NĐ-CP).",
          "Từ 15/8/2026, Nghị định số 168/2024/NĐ-CP phải đọc kèm Nghị định số 238/2026/NĐ-CP.",
          "Từ 01/7/2026, Nghị định số 160/2024/NĐ-CP và 166/2024/NĐ-CP hết hiệu lực; giấy phép đã cấp tiếp tục có giá trị theo quy định chuyển tiếp.",
          "Văn bản chưa có hiệu lực (Nghị định số 319/2026/NĐ-CP) không dùng làm căn cứ xử lý.",
        ],
      },
    },
  ];
  await ghiKhoi(lessonId, khoi);

  await luuHoatDong({
    courseId,
    lessonId,
    ordinal: 1,
    kind: "sap_xep",
    mode: "may",
    title: "Sắp xếp mốc hiệu lực",
    prompt: {
      cau_hoi: "Sắp xếp các mốc sau theo thứ tự thời gian, từ sớm nhất đến muộn nhất.",
      muc: [
        { id: "m3", text: "Nghị định số 238/2026/NĐ-CP có hiệu lực" },
        { id: "m1", text: "Luật số 36/2024/QH15 có hiệu lực" },
        { id: "m4", text: "Nghị định số 319/2026/NĐ-CP có hiệu lực" },
        { id: "m2", text: "Luật số 118/2025/QH15 có hiệu lực" },
      ],
    },
    answer: {
      thu_tu: ["m1", "m2", "m3", "m4"],
      giai_thich: "01/01/2025; 01/7/2026; 15/8/2026; 01/7/2027.",
    },
    skills: ["gtdb_tra_cuu_hieu_luc"],
    citations: [VB.L_TTATGT, VB.L_118_2025, VB.ND_238_2026, VB.ND_319_2026],
    points: 2,
    level: 1,
  });

  await luuHoatDong({
    courseId,
    lessonId,
    ordinal: 2,
    kind: "trac_nghiem",
    mode: "may",
    title: "Giấy phép cấp theo nghị định đã bị bãi bỏ",
    prompt: {
      cau_hoi:
        "Giấy phép xe tập lái được cấp ngày 20/5/2026 theo Nghị định số 160/2024/NĐ-CP. Sau ngày 01/7/2026, giấy phép này còn giá trị không?",
      phuong_an: [
        { id: "a", text: "Hết giá trị, vì Nghị định số 160/2024/NĐ-CP đã bị bãi bỏ" },
        {
          id: "b",
          text: "Còn giá trị theo thời hạn ghi trên giấy phép, theo quy định chuyển tiếp của Nghị định số 94/2026/NĐ-CP",
        },
        { id: "c", text: "Còn giá trị đến hết ngày 31/12/2026" },
      ],
    },
    answer: {
      dung: ["b"],
      giai_thich:
        "Khoản 1 Điều 42 Nghị định số 94/2026/NĐ-CP: giấy phép xe tập lái cấp trước ngày nghị định có hiệu lực tiếp tục " +
        "còn giá trị sử dụng theo thời hạn của giấy phép.",
      phuong_an: [
        {
          id: "a",
          text: "Hết giá trị",
          ma_loi: "nham_chuyen_tiep",
          giai_thich:
            "Bãi bỏ nghị định cũ không làm mất giá trị giấy phép đã cấp khi có quy định chuyển tiếp.",
        },
        { id: "b", text: "Còn giá trị theo thời hạn của giấy phép", dung: true },
        {
          id: "c",
          text: "Đến hết ngày 31/12/2026",
          ma_loi: "vien_dan_sai_dieu_khoan",
          giai_thich: "Không có mốc này trong Điều 42 Nghị định số 94/2026/NĐ-CP.",
        },
      ],
    },
    skills: ["gtdb_tra_cuu_hieu_luc"],
    errorTags: ["nham_chuyen_tiep", "vien_dan_sai_dieu_khoan"],
    citations: [VB.ND_94_2026],
    points: 2,
    level: 1,
  });
}

/** Chuyên đề vận tải, bài 3 — thiết bị giám sát hành trình và thiết bị ghi nhận hình ảnh. */
async function soanVanTaiBai3(courseId: string, lessonId: string) {
  const khoi: KhoiSoan[] = [
    {
      kind: "giang",
      data: {
        md:
          "Từ ngày 01/7/2026, khoản 2 Điều 35 Luật Trật tự, an toàn giao thông đường bộ (sửa đổi tại khoản 6 Điều 7 " +
          "Luật số 118/2025/QH15) quy định hai nhóm xe phải lắp thiết bị giám sát: **xe ô tô kinh doanh vận tải hàng " +
          "hóa, xe ô tô kinh doanh vận tải hành khách dưới 08 chỗ, xe ô tô đầu kéo, xe cứu thương, xe vận tải nội bộ** " +
          "phải lắp thiết bị giám sát hành trình và thiết bị ghi nhận hình ảnh người lái xe; **xe ô tô kinh doanh vận tải " +
          "hành khách từ 08 chỗ trở lên** phải lắp thêm thiết bị ghi nhận hình ảnh khoang chở khách.\n\n" +
          "Chế tài với xe không lắp, lắp nhưng thiết bị không có tác dụng, hoặc làm sai lệch dữ liệu nằm ở Điều 20 và " +
          "Điều 21 Nghị định số 168/2024/NĐ-CP, đã được sửa đổi bởi Nghị định số 238/2026/NĐ-CP từ ngày 15/8/2026. " +
          "Yêu cầu kỹ thuật, việc truyền, lưu trữ và khai thác dữ liệu do Nghị định số 319/2026/NĐ-CP quy định, có hiệu " +
          "lực từ ngày 01/7/2027.",
      },
    },
    {
      kind: "can_cu",
      data: {
        urn: VB.L_118_2025,
        nhan: "Khoản 6 Điều 7 Luật số 118/2025/QH15 (sửa đổi khoản 2 Điều 35 Luật Trật tự, an toàn giao thông đường bộ), có hiệu lực từ 01/7/2026",
        nguyen_van:
          "2. Xe ô tô kinh doanh vận tải hàng hóa, xe ô tô kinh doanh vận tải hành khách dưới 08 chỗ (không kể chỗ của " +
          "người lái xe), xe ô tô đầu kéo, xe cứu thương, xe vận tải nội bộ phải lắp thiết bị giám sát hành trình, thiết " +
          "bị ghi nhận hình ảnh người lái xe. Xe ô tô kinh doanh vận tải hành khách từ 08 chỗ trở lên (không kể chỗ của " +
          "người lái xe) phải lắp thiết bị giám sát hành trình, thiết bị ghi nhận hình ảnh người lái xe, thiết bị ghi " +
          "nhận hình ảnh khoang chở khách. Việc xử lý dữ liệu thu được từ thiết bị ghi nhận hình ảnh người lái xe, thiết " +
          "bị ghi nhận hình ảnh khoang chở khách thực hiện theo quy định của pháp luật về bảo vệ dữ liệu cá nhân và quy " +
          "định khác của pháp luật có liên quan.",
        as_of: AS_OF_GTDB,
      },
      citations: [VB.L_118_2025, VB.L_TTATGT],
    },
    {
      kind: "doi_chieu",
      data: {
        truoc:
          "Khoản 2 Điều 35 Luật số 36/2024/QH15 (bản có hiệu lực 01/01/2025 – 30/6/2026): Xe ô tô kinh doanh vận tải " +
          "phải lắp thiết bị giám sát hành trình. Xe ô tô chở người từ 08 chỗ trở lên (không kể chỗ của người lái xe) " +
          "kinh doanh vận tải, xe ô tô đầu kéo, xe cứu thương phải lắp thiết bị giám sát hành trình và thiết bị ghi nhận " +
          "hình ảnh người lái xe.",
        sau:
          "Khoản 2 Điều 35 sau sửa đổi (từ 01/7/2026, khoản 6 Điều 7 Luật số 118/2025/QH15): xe ô tô kinh doanh vận " +
          "tải hàng hóa, xe kinh doanh vận tải hành khách dưới 08 chỗ, xe đầu kéo, xe cứu thương, xe vận tải nội bộ phải " +
          "lắp thiết bị giám sát hành trình và thiết bị ghi nhận hình ảnh người lái xe; xe kinh doanh vận tải hành khách " +
          "từ 08 chỗ trở lên phải lắp thêm thiết bị ghi nhận hình ảnh khoang chở khách.",
      },
      citations: [VB.L_TTATGT, VB.L_118_2025],
    },
    {
      kind: "bang_tra",
      data: {
        cot: [
          "Loại xe",
          "Thiết bị giám sát hành trình",
          "Thiết bị ghi nhận hình ảnh người lái xe",
          "Thiết bị ghi nhận hình ảnh khoang chở khách",
        ],
        dong: [
          ["Xe ô tô kinh doanh vận tải hàng hóa", "Bắt buộc", "Bắt buộc", "Không"],
          ["Xe ô tô kinh doanh vận tải hành khách dưới 08 chỗ", "Bắt buộc", "Bắt buộc", "Không"],
          ["Xe ô tô kinh doanh vận tải hành khách từ 08 chỗ trở lên", "Bắt buộc", "Bắt buộc", "Bắt buộc"],
          ["Xe ô tô đầu kéo", "Bắt buộc", "Bắt buộc", "Không"],
          ["Xe cứu thương", "Bắt buộc", "Bắt buộc", "Không"],
          ["Xe vận tải nội bộ", "Bắt buộc", "Bắt buộc", "Không"],
        ],
      },
      citations: [VB.L_118_2025],
    },
    {
      kind: "hoi_nhanh",
      data: {
        cau_hoi: "Xe ô tô kinh doanh vận tải hành khách 16 chỗ phải lắp những thiết bị nào?",
        phuong_an: [
          { id: "a", text: "Chỉ thiết bị giám sát hành trình" },
          { id: "b", text: "Thiết bị giám sát hành trình và thiết bị ghi nhận hình ảnh người lái xe" },
          {
            id: "c",
            text: "Cả ba: giám sát hành trình, ghi nhận hình ảnh người lái xe, ghi nhận hình ảnh khoang chở khách",
          },
        ],
        dap_an: "c",
        giai_thich:
          "Xe kinh doanh vận tải hành khách từ 08 chỗ trở lên thuộc nhóm phải lắp cả ba thiết bị (khoản 2 Điều 35 Luật Trật tự, an toàn giao thông đường bộ, sửa đổi năm 2025).",
      },
    },
    {
      kind: "can_cu",
      data: {
        urn: VB.ND_238_2026,
        nhan: "Khoản 3 Điều 8 Nghị định số 238/2026/NĐ-CP (sửa đổi điểm c khoản 5 Điều 21 Nghị định số 168/2024/NĐ-CP), có hiệu lực từ 15/8/2026",
        nguyen_van:
          "c) Điều khiển xe ô tô kinh doanh vận tải, xe ô tô đầu kéo, xe vận tải nội bộ không lắp thiết bị giám sát hành " +
          "trình hoặc có lắp thiết bị giám sát hành trình nhưng không có tác dụng trong quá trình xe tham gia giao thông " +
          "theo quy định hoặc làm sai lệch dữ liệu của thiết bị giám sát hành trình lắp trên xe ô tô;",
        as_of: AS_OF_GTDB,
      },
      citations: [VB.ND_238_2026, VB.ND_168_2024],
    },
    {
      kind: "can_cu",
      data: {
        urn: VB.ND_238_2026,
        nhan: "Khoản 2 Điều 8 Nghị định số 238/2026/NĐ-CP (sửa đổi điểm b khoản 3 Điều 21 Nghị định số 168/2024/NĐ-CP)",
        nguyen_van:
          "b) Điều khiển xe ô tô kinh doanh vận tải, xe ô tô đầu kéo, xe vận tải nội bộ không lắp thiết bị ghi nhận hình " +
          "ảnh người lái xe hoặc có lắp thiết bị ghi nhận hình ảnh người lái xe nhưng không có tác dụng trong quá trình xe " +
          "tham gia giao thông theo quy định hoặc làm sai lệch dữ liệu của thiết bị ghi nhận hình ảnh người lái xe lắp " +
          "trên xe ô tô.",
        as_of: AS_OF_GTDB,
      },
      citations: [VB.ND_238_2026, VB.ND_168_2024],
    },
    {
      kind: "dong_thoi_gian",
      data: {
        moc: [
          {
            ngay: "2026-07-01",
            nhan: "Luật số 118/2025/QH15 có hiệu lực: yêu cầu lắp thiết bị theo khoản 2 Điều 35 mới",
            loai: "hieu_luc",
          },
          {
            ngay: "2026-08-15",
            nhan: "Nghị định số 238/2026/NĐ-CP có hiệu lực: chế tài tại Điều 20, Điều 21 Nghị định số 168/2024/NĐ-CP được sửa",
            loai: "hieu_luc",
          },
          {
            ngay: "2027-07-01",
            nhan: "Nghị định số 319/2026/NĐ-CP có hiệu lực: yêu cầu kỹ thuật, truyền và khai thác dữ liệu",
            loai: "hieu_luc",
          },
          {
            ngay: "2029-12-31",
            nhan: "Hết thời hạn dùng thiết bị lắp trước 01/7/2027 theo QCVN 06:2024/BCA (khoản 1 Điều 13 Nghị định số 319/2026/NĐ-CP)",
            loai: "thay_the",
          },
        ],
      },
      citations: [VB.L_118_2025, VB.ND_238_2026, VB.ND_319_2026],
    },
    {
      kind: "canh_bao",
      data: {
        loai: "hieu_luc",
        md:
          "Nghị định số 319/2026/NĐ-CP chưa có hiệu lực cho tới ngày 01/7/2027; trước ngày đó không viện dẫn nghị định " +
          "này để xử phạt. Thiết bị đã lắp trước ngày 01/7/2027 được dùng tiếp theo QCVN 06:2024/BCA và Thông tư số " +
          "71/2024/TT-BCA đến hết ngày 31/12/2029 (khoản 1 Điều 13 Nghị định số 319/2026/NĐ-CP).",
      },
    },
    {
      kind: "the_lat",
      data: {
        the: [
          {
            truoc: "Thiết bị giám sát hành trình",
            sau: "Thiết bị ghi và truyền dữ liệu hành trình của xe; bắt buộc với mọi xe kinh doanh vận tải, xe đầu kéo, xe cứu thương, xe vận tải nội bộ.",
          },
          {
            truoc: "Thiết bị ghi nhận hình ảnh người lái xe",
            sau: "Bắt buộc cùng với thiết bị giám sát hành trình; dữ liệu xử lý theo pháp luật về bảo vệ dữ liệu cá nhân.",
          },
          {
            truoc: "Thiết bị ghi nhận hình ảnh khoang chở khách",
            sau: "Chỉ bắt buộc với xe kinh doanh vận tải hành khách từ 08 chỗ trở lên.",
          },
          {
            truoc: "Phương tiện giao thông thông minh",
            sau: "Phương tiện mà toàn bộ việc điều khiển, duy trì hoạt động không cần sự điều khiển trực tiếp của người lái (khoản 4 Điều 34, sửa đổi năm 2025).",
          },
        ],
      },
      citations: [VB.L_118_2025],
    },
    {
      kind: "tom_tat",
      data: {
        y: [
          "Từ 01/7/2026, xe kinh doanh vận tải, xe đầu kéo, xe cứu thương, xe vận tải nội bộ phải có thiết bị giám sát hành trình và thiết bị ghi nhận hình ảnh người lái xe (khoản 6 Điều 7 Luật số 118/2025/QH15).",
          "Xe kinh doanh vận tải hành khách từ 08 chỗ trở lên phải có thêm thiết bị ghi nhận hình ảnh khoang chở khách.",
          "Chế tài: Điều 20, Điều 21 Nghị định số 168/2024/NĐ-CP, sửa đổi bởi Điều 7, Điều 8 Nghị định số 238/2026/NĐ-CP.",
          "Nghị định số 319/2026/NĐ-CP chỉ áp dụng từ 01/7/2027; thiết bị cũ dùng đến hết 31/12/2029.",
        ],
      },
    },
  ];
  await ghiKhoi(lessonId, khoi);

  await luuHoatDong({
    courseId,
    lessonId,
    ordinal: 1,
    kind: "trac_nghiem",
    mode: "may",
    title: "Thiết bị bắt buộc trên xe đầu kéo",
    prompt: {
      cau_hoi:
        "Ngày 20/8/2026, tổ kiểm soát dừng một xe ô tô đầu kéo. Theo quy định đang có hiệu lực, xe này phải có thiết bị nào?",
      phuong_an: [
        { id: "a", text: "Thiết bị giám sát hành trình và thiết bị ghi nhận hình ảnh người lái xe" },
        { id: "b", text: "Cả ba thiết bị, kể cả thiết bị ghi nhận hình ảnh khoang chở khách" },
        { id: "c", text: "Không bắt buộc, vì xe đầu kéo không chở khách" },
      ],
    },
    answer: {
      dung: ["a"],
      giai_thich:
        "Khoản 2 Điều 35 Luật Trật tự, an toàn giao thông đường bộ (sửa đổi bởi khoản 6 Điều 7 Luật số 118/2025/QH15) " +
        "xếp xe ô tô đầu kéo vào nhóm phải lắp thiết bị giám sát hành trình và thiết bị ghi nhận hình ảnh người lái xe.",
      phuong_an: [
        { id: "a", text: "Giám sát hành trình và ghi nhận hình ảnh người lái xe", dung: true },
        {
          id: "b",
          text: "Cả ba thiết bị",
          ma_loi: "vien_dan_sai_dieu_khoan",
          giai_thich:
            "Thiết bị ghi nhận hình ảnh khoang chở khách chỉ bắt buộc với xe kinh doanh vận tải hành khách từ 08 chỗ trở lên.",
        },
        {
          id: "c",
          text: "Không bắt buộc",
          ma_loi: "sai_khung_tien_phat",
          giai_thich:
            "Xe đầu kéo được nêu đích danh trong khoản 2 Điều 35; hành vi không lắp bị xử phạt theo điểm c khoản 5 Điều 21 Nghị định số 168/2024/NĐ-CP (sửa đổi năm 2026).",
        },
      ],
    },
    skills: ["gtdb_giam_sat_hanh_trinh"],
    errorTags: ["vien_dan_sai_dieu_khoan", "sai_khung_tien_phat"],
    citations: [VB.L_118_2025, VB.ND_238_2026],
    points: 2,
    level: 1,
  });

  await luuHoatDong({
    courseId,
    lessonId,
    ordinal: 2,
    kind: "ghep_cap",
    mode: "may",
    title: "Ghép loại xe với thiết bị bắt buộc",
    prompt: {
      cau_hoi: "Ghép mỗi loại xe với bộ thiết bị bắt buộc tương ứng.",
      trai: [
        { id: "t1", text: "Xe ô tô kinh doanh vận tải hành khách 29 chỗ" },
        { id: "t2", text: "Xe ô tô kinh doanh vận tải hàng hóa" },
        { id: "t3", text: "Xe cứu thương" },
        { id: "t4", text: "Xe ô tô cá nhân 05 chỗ không kinh doanh vận tải" },
      ],
      phai: [
        {
          id: "p1",
          text: "Giám sát hành trình, ghi nhận hình ảnh người lái xe, ghi nhận hình ảnh khoang chở khách",
        },
        { id: "p2", text: "Giám sát hành trình và ghi nhận hình ảnh người lái xe" },
        { id: "p3", text: "Không thuộc diện bắt buộc theo khoản 2 Điều 35" },
      ],
    },
    answer: {
      cap: { t1: "p1", t2: "p2", t3: "p2", t4: "p3" },
      giai_thich:
        "Đối chiếu từng loại xe với khoản 2 Điều 35 Luật Trật tự, an toàn giao thông đường bộ (sửa đổi năm 2025).",
    },
    skills: ["gtdb_giam_sat_hanh_trinh"],
    errorTags: ["vien_dan_sai_dieu_khoan"],
    citations: [VB.L_118_2025],
    points: 2,
    level: 1,
  });
}

/** Chuyên đề phương tiện, bài 1 — điều kiện xe cơ giới tham gia giao thông, kiểm định và niên hạn sử dụng. */
async function soanPhuongTienBai1(courseId: string, lessonId: string) {
  const khoi: KhoiSoan[] = [
    {
      kind: "kich_ban",
      data: {
        luot: [
          {
            vai: "Cán bộ",
            loi: "Xe tải này sản xuất năm 2000, giấy chứng nhận kiểm định còn hạn đến tháng 11 năm 2026. Có được tiếp tục lưu hành không?",
          },
          {
            vai: "Tổ trưởng",
            loi: "Niên hạn của xe ô tô tải tính từ năm sản xuất là bao nhiêu năm, và giấy chứng nhận kiểm định còn giá trị trong trường hợp nào?",
          },
        ],
      },
    },
    {
      kind: "giang",
      data: {
        md:
          "Điều kiện để xe cơ giới tham gia giao thông được quy định tại Điều 35 Luật Trật tự, an toàn giao thông đường " +
          "bộ; khoản 2 và khoản 3 của Điều này đã được sửa đổi bởi khoản 6 Điều 7 Luật số 118/2025/QH15, có hiệu lực từ " +
          "ngày 01/7/2026. Việc kiểm định và **niên hạn sử dụng** của xe cơ giới được quy định chi tiết tại Nghị định số " +
          "89/2026/NĐ-CP (có hiệu lực từ ngày 01/7/2026, thay Nghị định số 166/2024/NĐ-CP).\n\n" +
          "Ba nội dung cán bộ kiểm soát phải đối chiếu tại hiện trường: (1) **giấy chứng nhận kiểm định** còn hiệu lực hay " +
          "không, với năm trường hợp hết hiệu lực nêu tại khoản 5 Điều 13 Nghị định số 89/2026/NĐ-CP; (2) **tem kiểm định** " +
          "dán trên xe tham gia giao thông (khoản 2 Điều 13; quy định về dán tem hết hiệu lực từ ngày 01/01/2027 theo khoản " +
          "3 Điều 26); (3) **niên hạn sử dụng** tính từ năm sản xuất theo Điều 18, với năm sản xuất xác định theo thứ tự tài " +
          "liệu tại Điều 19. Danh sách xe hết niên hạn được tổng hợp trên cơ sở dữ liệu đăng kiểm để phục vụ tuần tra, kiểm " +
          "soát (khoản 5 Điều 18).\n\n" +
          "Nghị định số 89/2026/NĐ-CP không áp dụng với hoạt động kiểm định xe thuộc phạm vi quản lý của Bộ Quốc phòng, " +
          "Bộ Công an (khoản 2 Điều 2).",
      },
    },
    {
      kind: "can_cu",
      data: {
        urn: VB.L_TTATGT,
        nhan: "Khoản 1 Điều 35 Luật Trật tự, an toàn giao thông đường bộ số 36/2024/QH15",
        nguyen_van:
          "1. Xe cơ giới, xe máy chuyên dùng tham gia giao thông đường bộ phải đáp ứng các điều kiện sau đây: a) Được " +
          "cấp chứng nhận đăng ký xe và gắn biển số xe theo quy định của pháp luật; b) Bảo đảm chất lượng an toàn kỹ " +
          "thuật và bảo vệ môi trường theo quy định của pháp luật.",
        as_of: AS_OF_GTDB,
      },
      citations: [VB.L_TTATGT],
    },
    {
      kind: "can_cu",
      data: {
        urn: VB.ND_89_2026,
        nhan: "Điều 18 Nghị định số 89/2026/NĐ-CP ngày 30/3/2026 của Chính phủ",
        nguyen_van:
          "1. Hai mươi lăm (25) năm tính từ năm sản xuất đối với xe ô tô chở hàng (xe ô tô tải), xe ô tô chở hàng chuyên " +
          "dùng (xe ô tô tải chuyên dùng). 2. Hai mươi (20) năm tính từ năm sản xuất đối với xe ô tô chở người có số người " +
          "cho phép chở từ 09 người trở lên (không kể người lái xe), xe ô tô chở trẻ em mầm non, xe ô tô chở học sinh, xe " +
          "chở hàng bốn bánh có gắn động cơ. 3. Mười lăm (15) năm tính từ năm sản xuất đối với xe chở người bốn bánh có gắn " +
          "động cơ. 4. Niên hạn sử dụng đối với xe tương tự xe cơ giới được áp dụng như các loại xe cơ giới tại khoản 1, " +
          "khoản 2 và khoản 3 Điều này; bảo đảm phù hợp với từng chức năng, công dụng của từng loại xe tương tự. 5. Danh " +
          "sách xe hết niên hạn sử dụng được tổng hợp trên cơ sở dữ liệu đăng kiểm xe cơ giới để phục vụ công tác tuần tra, " +
          "kiểm soát.",
        as_of: AS_OF_GTDB,
      },
      citations: [VB.ND_89_2026],
    },
    {
      kind: "bang_tra",
      data: {
        cot: ["Loại xe", "Niên hạn sử dụng", "Căn cứ"],
        dong: [
          [
            "Xe ô tô tải, xe ô tô tải chuyên dùng",
            "25 năm tính từ năm sản xuất",
            "Khoản 1 Điều 18 Nghị định số 89/2026/NĐ-CP",
          ],
          [
            "Xe ô tô chở người từ 09 người trở lên (không kể người lái); xe chở trẻ em mầm non; xe chở học sinh; xe chở hàng bốn bánh có gắn động cơ (khoản 2 Điều 18)",
            "20 năm tính từ năm sản xuất",
            "Khoản 2 Điều 18 Nghị định số 89/2026/NĐ-CP",
          ],
          [
            "Xe chở người bốn bánh có gắn động cơ (khoản 3 Điều 18)",
            "15 năm tính từ năm sản xuất",
            "Khoản 3 Điều 18 Nghị định số 89/2026/NĐ-CP",
          ],
          [
            "Xe tương tự xe cơ giới",
            "Áp dụng như loại xe cơ giới tương ứng",
            "Khoản 4 Điều 18 Nghị định số 89/2026/NĐ-CP",
          ],
          [
            "Xe không có tài liệu xác định năm sản xuất",
            "Được coi là hết niên hạn sử dụng",
            "Khoản 2 Điều 19 Nghị định số 89/2026/NĐ-CP",
          ],
        ],
      },
      citations: [VB.ND_89_2026],
    },
    {
      kind: "hoi_nhanh",
      data: {
        cau_hoi: "Xe ô tô tải sản xuất năm 2000 thì hết niên hạn sử dụng sau năm nào?",
        phuong_an: [
          { id: "a", text: "Sau năm 2020" },
          { id: "b", text: "Sau năm 2025" },
          { id: "c", text: "Xe tải không có niên hạn sử dụng" },
        ],
        dap_an: "b",
        giai_thich:
          "Khoản 1 Điều 18 Nghị định số 89/2026/NĐ-CP: 25 năm tính từ năm sản xuất; xe sản xuất năm 2000 hết niên hạn sau năm 2025.",
      },
    },
    {
      kind: "so_do_trinh_tu",
      data: {
        buoc: [
          {
            ma: "b1",
            nhan: "Xác định năm sản xuất",
            mo_ta:
              "Theo thứ tự ưu tiên tại khoản 1 Điều 19: giấy chứng nhận chất lượng xe nhập khẩu hoặc phiếu kiểm tra chất lượng xuất xưởng; thông tin của nhà sản xuất gắn trên xe; kết quả tra cứu từ nhà sản xuất",
          },
          {
            ma: "b2",
            nhan: "Đối chiếu loại xe với niên hạn",
            mo_ta: "Điều 18: 25 năm, 20 năm hoặc 15 năm tùy loại xe",
          },
          {
            ma: "b3",
            nhan: "Tra danh sách xe hết niên hạn",
            mo_ta: "Cơ sở dữ liệu đăng kiểm xe cơ giới (khoản 5 Điều 18)",
          },
          {
            ma: "b4",
            nhan: "Kiểm tra giấy chứng nhận kiểm định",
            mo_ta:
              "Bản điện tử hoặc bản giấy in từ phần mềm quản lý (khoản 1 Điều 13); năm trường hợp hết hiệu lực (khoản 5 Điều 13)",
          },
          {
            ma: "b5",
            nhan: "Kết luận và lập hồ sơ",
            mo_ta: "Ghi rõ căn cứ: điều, khoản, điểm của Nghị định số 89/2026/NĐ-CP",
          },
        ],
        canh: [
          { tu: "b1", den: "b2" },
          { tu: "b2", den: "b3" },
          { tu: "b3", den: "b4" },
          { tu: "b4", den: "b5" },
        ],
      },
      citations: [VB.ND_89_2026],
    },
    {
      kind: "can_cu",
      data: {
        urn: VB.ND_89_2026,
        nhan: "Khoản 2, khoản 3 và khoản 5 Điều 13 Nghị định số 89/2026/NĐ-CP",
        nguyen_van:
          "2. Xe tham gia giao thông thì được cấp giấy chứng nhận kiểm định và dán tem kiểm định. 3. Xe không tham gia giao " +
          "thông hoặc khi tham gia giao thông phải được cấp phép của cơ quan có thẩm quyền thì chỉ cấp giấy chứng nhận kiểm " +
          "định, không dán tem kiểm định. […] 5. Giấy chứng nhận kiểm định hết hiệu lực khi: a) Phương tiện không bảo đảm an " +
          "toàn kỹ thuật và bảo vệ môi trường theo quy định của pháp luật; b) Đã có thông tin về việc giấy chứng nhận kiểm " +
          "định bị mất hoặc thu hồi trên phần mềm quản lý kiểm định; c) Giấy chứng nhận kiểm định đã được thay thế bởi giấy " +
          "chứng nhận kiểm định khác; d) Phương tiện có kết quả kiểm định không đạt; đ) Phương tiện đã bị cải tạo trái phép.",
        as_of: AS_OF_GTDB,
      },
      citations: [VB.ND_89_2026],
    },
    {
      kind: "canh_bao",
      data: {
        loai: "hieu_luc",
        md:
          "Quy định về dán tem kiểm định tại khoản 2 Điều 13 Nghị định số 89/2026/NĐ-CP hết hiệu lực từ ngày 01/01/2027 " +
          "(khoản 3 Điều 26). Từ ngày đó, việc kiểm tra dựa trên giấy chứng nhận kiểm định điện tử và dữ liệu đăng kiểm, " +
          "không dựa vào tem dán trên xe. Phương tiện đã được xác định niên hạn trước ngày 01/01/2025 tiếp tục áp dụng niên " +
          "hạn đã xác định (khoản 3 Điều 25).",
      },
    },
    {
      kind: "the_lat",
      data: {
        the: [
          {
            truoc: "Niên hạn sử dụng",
            sau: "Số năm tối đa xe được sử dụng, tính từ năm sản xuất; hết niên hạn thì không được tham gia giao thông (Điều 18 Nghị định số 89/2026/NĐ-CP).",
          },
          {
            truoc: "Năm sản xuất",
            sau: "Xác định theo thứ tự ưu tiên ba nguồn tài liệu tại khoản 1 Điều 19; không có tài liệu thì xe được coi là hết niên hạn.",
          },
          {
            truoc: "Giấy chứng nhận kiểm định",
            sau: "Cấp dưới dạng bản điện tử; bản giấy in từ phần mềm quản lý khi chủ xe yêu cầu, không dùng phôi ấn chỉ (khoản 1 Điều 13).",
          },
          {
            truoc: "Tem kiểm định",
            sau: "Dán trên xe tham gia giao thông; quy định dán tem hết hiệu lực từ ngày 01/01/2027.",
          },
        ],
      },
      citations: [VB.ND_89_2026],
    },
    {
      kind: "tom_tat",
      data: {
        y: [
          "Niên hạn: 25 năm với xe tải; 20 năm với xe chở người từ 09 chỗ, xe chở trẻ em mầm non, học sinh, xe chở hàng bốn bánh có gắn động cơ theo khoản 2; 15 năm với xe chở người bốn bánh có gắn động cơ theo khoản 3 Điều 18 Nghị định số 89/2026/NĐ-CP.",
          "Năm sản xuất xác định theo thứ tự tài liệu tại Điều 19; không có tài liệu thì coi là hết niên hạn.",
          "Giấy chứng nhận kiểm định hết hiệu lực trong năm trường hợp tại khoản 5 Điều 13.",
          "Tem kiểm định chỉ còn là căn cứ đến hết ngày 31/12/2026 (khoản 3 Điều 26).",
        ],
      },
    },
  ];
  await ghiKhoi(lessonId, khoi);

  await luuHoatDong({
    courseId,
    lessonId,
    ordinal: 1,
    kind: "tinh_toan",
    mode: "may",
    title: "Năm cuối cùng được sử dụng",
    prompt: {
      cau_hoi:
        "Xe ô tô chở người 29 chỗ (không kể người lái) có phiếu kiểm tra chất lượng xuất xưởng ghi năm sản xuất 2010. Năm cuối cùng xe còn trong niên hạn sử dụng là năm nào?",
      don_vi: "năm",
    },
    answer: {
      so: 2030,
      sai_so: 0,
      giai_thich:
        "Khoản 2 Điều 18 Nghị định số 89/2026/NĐ-CP: 20 năm tính từ năm sản xuất; 2010 + 20 = 2030.",
    },
    skills: ["gtdb_dieu_kien_phuong_tien"],
    errorTags: ["vien_dan_sai_dieu_khoan"],
    citations: [VB.ND_89_2026],
    points: 2,
    level: 1,
  });

  await luuHoatDong({
    courseId,
    lessonId,
    ordinal: 2,
    kind: "trac_nghiem",
    mode: "may",
    title: "Giấy chứng nhận kiểm định còn hạn nhưng xe đã cải tạo",
    prompt: {
      cau_hoi:
        "Xe tải có giấy chứng nhận kiểm định còn thời hạn, nhưng thùng xe đã được cơi nới trái phép so với hồ sơ kiểm định. Giấy chứng nhận kiểm định này còn hiệu lực không?",
      phuong_an: [
        { id: "a", text: "Còn hiệu lực đến hết thời hạn ghi trên giấy" },
        { id: "b", text: "Hết hiệu lực, vì phương tiện đã bị cải tạo trái phép" },
        { id: "c", text: "Chỉ hết hiệu lực khi cơ sở đăng kiểm thu hồi" },
      ],
    },
    answer: {
      dung: ["b"],
      giai_thich:
        "Điểm đ khoản 5 Điều 13 Nghị định số 89/2026/NĐ-CP: giấy chứng nhận kiểm định hết hiệu lực khi phương tiện đã bị cải tạo trái phép.",
      phuong_an: [
        {
          id: "a",
          text: "Còn hiệu lực đến hết thời hạn",
          ma_loi: "vien_dan_sai_dieu_khoan",
          giai_thich:
            "Thời hạn ghi trên giấy không phải căn cứ duy nhất; khoản 5 Điều 13 nêu năm trường hợp hết hiệu lực trước hạn.",
        },
        { id: "b", text: "Hết hiệu lực vì cải tạo trái phép", dung: true },
        {
          id: "c",
          text: "Chỉ khi bị thu hồi",
          ma_loi: "vien_dan_sai_dieu_khoan",
          giai_thich:
            "Thu hồi là một trường hợp riêng (điểm b khoản 5 Điều 13); cải tạo trái phép là trường hợp khác (điểm đ).",
        },
      ],
    },
    skills: ["gtdb_dieu_kien_phuong_tien"],
    errorTags: ["vien_dan_sai_dieu_khoan"],
    citations: [VB.ND_89_2026],
    points: 2,
    level: 1,
  });
}

/** Chuyên đề phương tiện, bài 3 — giấy phép lái xe: hạng, độ tuổi, sát hạch. */
async function soanPhuongTienBai3(courseId: string, lessonId: string) {
  const khoi: KhoiSoan[] = [
    {
      kind: "giang",
      data: {
        md:
          "Từ ngày 01/01/2025, hệ thống hạng giấy phép lái xe được quy định lại tại Điều 57 Luật Trật tự, an toàn " +
          "giao thông đường bộ: hạng **A1, A, B1** cho xe mô tô; **B, C1, C** cho xe ô tô chở người đến 08 chỗ và xe " +
          "tải theo khối lượng toàn bộ; **D1, D2, D** cho xe chở người trên 08 chỗ; các hạng **BE, C1E, CE, D1E, D2E, DE** " +
          "cho xe kéo rơ moóc trên 750 kg. Độ tuổi tối thiểu của từng hạng quy định tại Điều 59.\n\n" +
          "Giấy phép lái xe cấp trước ngày 01/01/2025 (các hạng A1, A2, A3, A4, B1, B2, C, D, E, F cũ) tiếp tục được " +
          "sử dụng theo thời hạn ghi trên giấy phép, với phạm vi điều khiển xe quy định tại khoản 2 Điều 89 của Luật; " +
          "khi đổi, cấp lại thì chuyển sang hạng mới theo khoản 3 Điều 89.\n\n" +
          "Việc sát hạch, cấp, đổi, cấp lại, thu hồi giấy phép lái xe từ ngày 01/7/2026 thực hiện theo Thông tư số " +
          "108/2026/TT-BCA của Bộ trưởng Bộ Công an, thay Thông tư số 12/2025/TT-BCA; một số nội dung sát hạch mới " +
          "được áp dụng theo lộ trình tới năm 2028.",
      },
    },
    {
      kind: "can_cu",
      data: {
        urn: VB.L_TTATGT,
        nhan: "Khoản 1 Điều 57 Luật Trật tự, an toàn giao thông đường bộ số 36/2024/QH15 (trích các điểm a, b, c, d, đ, e, g, h, i)",
        nguyen_van:
          "1. Giấy phép lái xe bao gồm các hạng sau đây: a) Hạng A1 cấp cho người lái xe mô tô hai bánh có dung tích " +
          "xi-lanh đến 125 cm³ hoặc có công suất động cơ điện đến 11 kW; b) Hạng A cấp cho người lái xe mô tô hai bánh " +
          "có dung tích xi-lanh trên 125 cm³ hoặc có công suất động cơ điện trên 11 kW và các loại xe quy định cho giấy " +
          "phép lái xe hạng A1; c) Hạng B1 cấp cho người lái xe mô tô ba bánh và các loại xe quy định cho giấy phép lái " +
          "xe hạng A1; d) Hạng B cấp cho người lái xe ô tô chở người đến 08 chỗ (không kể chỗ của người lái xe); xe ô tô " +
          "tải và ô tô chuyên dùng có khối lượng toàn bộ theo thiết kế đến 3.500 kg; các loại xe ô tô quy định cho giấy " +
          "phép lái xe hạng B kéo rơ moóc có khối lượng toàn bộ theo thiết kế đến 750 kg; đ) Hạng C1 cấp cho người lái " +
          "xe ô tô tải và ô tô chuyên dùng có khối lượng toàn bộ theo thiết kế trên 3.500 kg đến 7.500 kg; […]; e) Hạng C " +
          "cấp cho người lái xe ô tô tải và ô tô chuyên dùng có khối lượng toàn bộ theo thiết kế trên 7.500 kg; […]; " +
          "g) Hạng D1 cấp cho người lái xe ô tô chở người trên 08 chỗ (không kể chỗ của người lái xe) đến 16 chỗ (không " +
          "kể chỗ của người lái xe); […]; h) Hạng D2 cấp cho người lái xe ô tô chở người (kể cả xe buýt) trên 16 chỗ " +
          "(không kể chỗ của người lái xe) đến 29 chỗ (không kể chỗ của người lái xe); […]; i) Hạng D cấp cho người lái " +
          "xe ô tô chở người (kể cả xe buýt) trên 29 chỗ (không kể chỗ của người lái xe); xe ô tô chở người giường nằm; […]",
        as_of: AS_OF_GTDB,
      },
      citations: [VB.L_TTATGT],
    },
    {
      kind: "bang_tra",
      data: {
        cot: [
          "Hạng",
          "Loại xe được điều khiển (tóm lược theo khoản 1 Điều 57)",
          "Tuổi tối thiểu (khoản 1 Điều 59)",
        ],
        dong: [
          ["A1", "Mô tô hai bánh đến 125 cm³ hoặc động cơ điện đến 11 kW", "Đủ 18 tuổi"],
          ["A", "Mô tô hai bánh trên 125 cm³ hoặc trên 11 kW; xe của hạng A1", "Đủ 18 tuổi"],
          ["B1", "Mô tô ba bánh; xe của hạng A1", "Đủ 18 tuổi"],
          [
            "B",
            "Ô tô chở người đến 08 chỗ; ô tô tải, ô tô chuyên dùng khối lượng toàn bộ đến 3.500 kg; kéo rơ moóc đến 750 kg",
            "Đủ 18 tuổi",
          ],
          [
            "C1",
            "Ô tô tải, ô tô chuyên dùng khối lượng toàn bộ trên 3.500 kg đến 7.500 kg; xe của hạng B",
            "Đủ 18 tuổi",
          ],
          [
            "C",
            "Ô tô tải, ô tô chuyên dùng khối lượng toàn bộ trên 7.500 kg; xe của hạng B, C1",
            "Đủ 21 tuổi",
          ],
          ["BE", "Xe của hạng B kéo rơ moóc trên 750 kg", "Đủ 21 tuổi"],
          ["D1", "Ô tô chở người trên 08 đến 16 chỗ; xe của hạng B, C1, C", "Đủ 24 tuổi"],
          ["D2", "Ô tô chở người (kể cả xe buýt) trên 16 đến 29 chỗ; xe của hạng B, C1, C, D1", "Đủ 24 tuổi"],
          [
            "C1E, CE",
            "Xe của hạng C1, C kéo rơ moóc trên 750 kg; CE gồm cả ô tô đầu kéo kéo sơ mi rơ moóc",
            "Đủ 24 tuổi",
          ],
          [
            "D",
            "Ô tô chở người (kể cả xe buýt) trên 29 chỗ; xe chở người giường nằm; xe của hạng B, C1, C, D1, D2",
            "Đủ 27 tuổi",
          ],
          [
            "D1E, D2E, DE",
            "Xe của hạng D1, D2, D kéo rơ moóc trên 750 kg; DE gồm cả xe chở khách nối toa",
            "Đủ 27 tuổi",
          ],
        ],
      },
      citations: [VB.L_TTATGT],
    },
    {
      kind: "can_cu",
      data: {
        urn: VB.L_TTATGT,
        nhan: "Khoản 1 Điều 59 Luật số 36/2024/QH15",
        nguyen_van:
          "1. Độ tuổi của người lái xe, người điều khiển xe máy chuyên dùng được quy định như sau: a) Người đủ 16 tuổi " +
          "trở lên được điều khiển xe gắn máy; b) Người đủ 18 tuổi trở lên được cấp giấy phép lái xe hạng A1, A, B1, B, " +
          "C1, được cấp chứng chỉ bồi dưỡng kiến thức pháp luật về giao thông đường bộ để điều khiển xe máy chuyên dùng " +
          "tham gia giao thông đường bộ; c) Người đủ 21 tuổi trở lên được cấp giấy phép lái xe hạng C, BE; d) Người đủ " +
          "24 tuổi trở lên được cấp giấy phép lái xe hạng D1, D2, C1E, CE; đ) Người đủ 27 tuổi trở lên được cấp giấy phép " +
          "lái xe hạng D, D1E, D2E, DE; e) Tuổi tối đa của người lái xe ô tô chở người (kể cả xe buýt) trên 29 chỗ (không " +
          "kể chỗ của người lái xe), xe ô tô chở người giường nằm là đủ 57 tuổi đối với nam, đủ 55 tuổi đối với nữ.",
        as_of: AS_OF_GTDB,
      },
      citations: [VB.L_TTATGT],
    },
    {
      kind: "hoi_nhanh",
      data: {
        cau_hoi:
          "Người 20 tuổi điều khiển xe ô tô tải có khối lượng toàn bộ theo thiết kế 9.000 kg. Người này có thể có giấy phép lái xe hợp lệ cho xe đó không?",
        phuong_an: [
          { id: "a", text: "Có, nếu có giấy phép lái xe hạng C1" },
          { id: "b", text: "Không, vì xe trên 7.500 kg cần hạng C và hạng C chỉ cấp cho người đủ 21 tuổi" },
          { id: "c", text: "Có, nếu có giấy phép lái xe hạng B" },
        ],
        dap_an: "b",
        giai_thich:
          "Điểm e khoản 1 Điều 57: xe tải trên 7.500 kg thuộc hạng C; điểm c khoản 1 Điều 59: hạng C cấp cho người đủ 21 tuổi trở lên.",
      },
    },
    {
      kind: "can_cu",
      data: {
        urn: VB.L_TTATGT,
        nhan: "Khoản 2 Điều 89 Luật số 36/2024/QH15 (trích điểm a, đ, e, g, h)",
        nguyen_van:
          "2. Giấy phép lái xe được cấp trước ngày Luật này có hiệu lực thi hành nếu chưa thực hiện đổi, cấp lại theo " +
          "quy định của Luật này có hiệu lực sử dụng như sau: a) Giấy phép lái xe hạng A1 được tiếp tục điều khiển xe mô tô " +
          "hai bánh có dung tích xi-lanh từ 50 cm³ đến dưới 175 cm³ hoặc có công suất động cơ điện từ 04 kW đến dưới 14 kW; " +
          "[…] đ) Giấy phép lái xe hạng B1 số tự động cấp cho người không hành nghề lái xe được tiếp tục điều khiển xe ô tô " +
          "số tự động chở người đến 08 chỗ (không kể chỗ của người lái xe); xe ô tô tải, kể cả ô tô tải chuyên dùng số tự " +
          "động có trọng tải dưới 3.500 kg; e) Giấy phép lái xe hạng B1 cấp cho người không hành nghề lái xe được tiếp tục " +
          "điều khiển xe ô tô chở người đến 08 chỗ (không kể chỗ của người lái xe); xe ô tô tải, máy kéo có trọng tải dưới " +
          "3.500 kg; g) Giấy phép lái xe hạng B2 cấp cho người hành nghề lái xe được tiếp tục điều khiển xe ô tô chở người " +
          "đến 08 chỗ (không kể chỗ của người lái xe); xe ô tô tải, máy kéo có trọng tải dưới 3.500 kg; h) Giấy phép lái " +
          "xe hạng C được tiếp tục điều khiển xe ô tô tải, máy kéo có trọng tải từ 3.500 kg trở lên và các loại xe quy định " +
          "cho các giấy phép lái xe hạng B1, B2 quy định tại các điểm đ, e và g khoản này; […]",
        as_of: AS_OF_GTDB,
      },
      citations: [VB.L_TTATGT],
    },
    {
      kind: "can_cu",
      data: {
        urn: VB.TT_108_2026_BCA,
        nhan: "Khoản 1, khoản 2 và khoản 6 Điều 41 Thông tư số 108/2026/TT-BCA ngày 29/6/2026 của Bộ trưởng Bộ Công an (trích)",
        nguyen_van:
          "1. Thông tư này có hiệu lực thi hành từ ngày 01 tháng 7 năm 2026, trừ trường hợp quy định tại khoản 2, khoản 3, " +
          "khoản 4, khoản 5 Điều này. 2. Nội dung sát hạch lý thuyết, sát hạch thực hành lái xe trong hình, sát hạch thực " +
          "hành lái xe trên đường quy định tại khoản 4 Điều 4 Thông tư này áp dụng từ ngày 01 tháng 3 năm 2027; nội dung " +
          "bài sát hạch số 2 quy định tại khoản 4 Điều 4 và Phụ lục I ban hành kèm theo Thông tư này áp dụng từ ngày 01 " +
          "tháng 01 năm 2028. […] 6. Thông tư số 12/2025/TT-BCA ngày 28 tháng 02 năm 2025 của Bộ trưởng Bộ Công an quy " +
          "định về sát hạch, cấp giấy phép lái xe; cấp, sử dụng giấy phép lái xe quốc tế hết hiệu lực kể từ ngày Thông tư " +
          "này có hiệu lực thi hành, trừ các trường hợp quy định tại khoản 1, khoản 2, khoản 3 Điều 4 […]",
        as_of: AS_OF_GTDB,
      },
      citations: [VB.TT_108_2026_BCA],
    },
    {
      kind: "dong_thoi_gian",
      data: {
        moc: [
          {
            ngay: "2025-01-01",
            nhan: "Hệ thống hạng giấy phép lái xe mới (Điều 57 Luật số 36/2024/QH15) có hiệu lực; giấy phép cũ dùng tiếp theo Điều 89",
            loai: "hieu_luc",
          },
          {
            ngay: "2026-07-01",
            nhan: "Thông tư số 108/2026/TT-BCA có hiệu lực, thay Thông tư số 12/2025/TT-BCA",
            loai: "thay_the",
          },
          {
            ngay: "2027-03-01",
            nhan: "Nội dung sát hạch lý thuyết, trong hình, trên đường theo khoản 4 Điều 4 Thông tư số 108/2026/TT-BCA được áp dụng",
            loai: "hieu_luc",
          },
          {
            ngay: "2028-01-01",
            nhan: "Bài sát hạch số 2 theo Phụ lục I Thông tư số 108/2026/TT-BCA được áp dụng",
            loai: "hieu_luc",
          },
        ],
      },
      citations: [VB.L_TTATGT, VB.TT_108_2026_BCA],
    },
    {
      kind: "canh_bao",
      data: {
        loai: "hieu_luc",
        md:
          "Khi kiểm tra giấy phép lái xe cấp trước ngày 01/01/2025, đối chiếu phạm vi điều khiển theo khoản 2 Điều 89 " +
          "Luật số 36/2024/QH15 (ví dụ hạng B2 cũ vẫn điều khiển được xe ô tô chở người đến 08 chỗ và xe tải dưới 3.500 kg), " +
          "không quy chiếu sang hạng mới cùng tên. Giấy phép lái xe không thời hạn cấp trước ngày 01/7/2012 vẫn có giá trị; " +
          "Luật chỉ khuyến khích đổi (khoản 3 Điều 62).",
      },
    },
    {
      kind: "the_lat",
      data: {
        the: [
          {
            truoc: "Khối lượng toàn bộ theo thiết kế",
            sau: "Tiêu chí phân hạng B, C1, C cho xe tải theo Điều 57 (đến 3.500 kg; trên 3.500 đến 7.500 kg; trên 7.500 kg).",
          },
          {
            truoc: "Hạng có chữ E (BE, C1E, CE, D1E, D2E, DE)",
            sau: "Cấp cho người lái xe của hạng gốc kéo rơ moóc có khối lượng toàn bộ trên 750 kg; CE gồm ô tô đầu kéo kéo sơ mi rơ moóc.",
          },
          {
            truoc: "Tuổi tối đa",
            sau: "Đủ 57 tuổi với nam, đủ 55 tuổi với nữ đối với người lái xe chở người trên 29 chỗ và xe giường nằm (điểm e khoản 1 Điều 59).",
          },
          {
            truoc: "Giấy phép lái xe cũ",
            sau: "Cấp trước 01/01/2025: dùng tiếp theo thời hạn ghi trên giấy phép, phạm vi điều khiển theo khoản 2 Điều 89.",
          },
        ],
      },
      citations: [VB.L_TTATGT],
    },
    {
      kind: "tom_tat",
      data: {
        y: [
          "Hạng giấy phép lái xe từ 01/01/2025 theo khoản 1 Điều 57 Luật số 36/2024/QH15; tuổi tối thiểu 18, 21, 24, 27 theo khoản 1 Điều 59.",
          "Giấy phép cấp trước 01/01/2025 dùng tiếp theo thời hạn và phạm vi tại khoản 2 Điều 89; đổi, cấp lại sang hạng mới theo khoản 3 Điều 89.",
          "Sát hạch, cấp giấy phép lái xe từ 01/7/2026 theo Thông tư số 108/2026/TT-BCA; nội dung sát hạch mới áp dụng từ 01/3/2027 và 01/01/2028.",
        ],
      },
    },
  ];
  await ghiKhoi(lessonId, khoi);

  await luuHoatDong({
    courseId,
    lessonId,
    ordinal: 1,
    kind: "trac_nghiem",
    mode: "may",
    title: "Hạng giấy phép lái xe cho xe tải 5.000 kg",
    prompt: {
      cau_hoi:
        "Xe ô tô tải có khối lượng toàn bộ theo thiết kế 5.000 kg. Người lái xe cần giấy phép lái xe tối thiểu hạng nào theo Điều 57 Luật số 36/2024/QH15?",
      phuong_an: [
        { id: "a", text: "Hạng B" },
        { id: "b", text: "Hạng C1" },
        { id: "c", text: "Hạng C" },
      ],
    },
    answer: {
      dung: ["b"],
      giai_thich:
        "Điểm đ khoản 1 Điều 57: hạng C1 cấp cho người lái xe ô tô tải có khối lượng toàn bộ theo thiết kế trên 3.500 kg đến 7.500 kg. Hạng C cũng điều khiển được, nhưng hạng tối thiểu là C1.",
      phuong_an: [
        {
          id: "a",
          text: "Hạng B",
          ma_loi: "vien_dan_sai_dieu_khoan",
          giai_thich: "Hạng B chỉ đến 3.500 kg (điểm d khoản 1 Điều 57).",
        },
        { id: "b", text: "Hạng C1", dung: true },
        {
          id: "c",
          text: "Hạng C",
          ma_loi: "vien_dan_sai_dieu_khoan",
          giai_thich:
            "Hạng C dành cho xe trên 7.500 kg; người có hạng C được lái xe của hạng C1, nhưng hạng tối thiểu theo câu hỏi là C1.",
        },
      ],
    },
    skills: ["gtdb_giay_phep_lai_xe"],
    errorTags: ["vien_dan_sai_dieu_khoan"],
    citations: [VB.L_TTATGT],
    points: 2,
    level: 1,
  });

  await luuHoatDong({
    courseId,
    lessonId,
    ordinal: 2,
    kind: "ghep_cap",
    mode: "may",
    title: "Ghép hạng giấy phép lái xe với độ tuổi tối thiểu",
    prompt: {
      cau_hoi:
        "Ghép mỗi hạng giấy phép lái xe với độ tuổi tối thiểu được cấp theo khoản 1 Điều 59 Luật số 36/2024/QH15.",
      trai: [
        { id: "t1", text: "Hạng C1" },
        { id: "t2", text: "Hạng C" },
        { id: "t3", text: "Hạng D2" },
        { id: "t4", text: "Hạng DE" },
      ],
      phai: [
        { id: "p18", text: "Đủ 18 tuổi" },
        { id: "p21", text: "Đủ 21 tuổi" },
        { id: "p24", text: "Đủ 24 tuổi" },
        { id: "p27", text: "Đủ 27 tuổi" },
      ],
    },
    answer: {
      cap: { t1: "p18", t2: "p21", t3: "p24", t4: "p27" },
      giai_thich: "Điểm b, c, d, đ khoản 1 Điều 59 Luật số 36/2024/QH15.",
    },
    skills: ["gtdb_giay_phep_lai_xe"],
    errorTags: ["vien_dan_sai_dieu_khoan"],
    citations: [VB.L_TTATGT],
    points: 2,
    level: 1,
  });
}

/** Chuyên đề phương tiện, bài 4 — giấy tờ người lái xe phải mang theo và kiểm tra qua tài khoản định danh. */
async function soanPhuongTienBai4(courseId: string, lessonId: string) {
  const khoi: KhoiSoan[] = [
    {
      kind: "kich_ban",
      data: {
        luot: [
          {
            vai: "Người lái xe",
            loi: "Xe của tôi đang thế chấp ở ngân hàng, giấy đăng ký xe ngân hàng giữ. Tôi chỉ có bản photo.",
          },
          {
            vai: "Cán bộ",
            loi: "Bản sao phải có chứng thực và kèm bản gốc giấy xác nhận còn hiệu lực của ngân hàng. Anh có giấy xác nhận đó không?",
          },
        ],
      },
    },
    {
      kind: "giang",
      data: {
        md:
          "Khoản 1 Điều 56 Luật Trật tự, an toàn giao thông đường bộ quy định người lái xe phải **đủ tuổi, sức khỏe**, có " +
          "**giấy phép lái xe đang còn điểm, còn hiệu lực, phù hợp với loại xe** (trừ người lái xe gắn máy) và phải mang " +
          "theo bốn loại giấy tờ: chứng nhận đăng ký xe (hoặc bản sao có chứng thực kèm bản gốc giấy xác nhận của tổ chức " +
          "tín dụng khi xe đang thế chấp), giấy phép lái xe, chứng nhận kiểm định (với xe cơ giới thuộc diện kiểm định) và " +
          "chứng nhận bảo hiểm bắt buộc trách nhiệm dân sự.\n\n" +
          "Người điều khiển xe máy chuyên dùng mang theo bằng hoặc chứng chỉ điều khiển xe máy chuyên dùng cùng giấy phép " +
          "lái xe hoặc chứng chỉ bồi dưỡng kiến thức pháp luật về giao thông đường bộ (khoản 2 Điều 56). Người lái xe gắn " +
          "máy không cần giấy phép lái xe nhưng phải đủ 16 tuổi, đủ sức khỏe, hiểu biết quy tắc giao thông và có kỹ năng " +
          "điều khiển (khoản 4 Điều 56, điểm a khoản 1 Điều 59).\n\n" +
          "Giấy tờ đã tích hợp vào **tài khoản định danh điện tử** thì việc xuất trình, kiểm tra có thể thực hiện qua tài " +
          "khoản đó (khoản 3 Điều 56); cán bộ kiểm soát không yêu cầu bản giấy trong trường hợp này.",
      },
    },
    {
      kind: "can_cu",
      data: {
        urn: VB.L_TTATGT,
        nhan: "Khoản 1 và khoản 3 Điều 56 Luật Trật tự, an toàn giao thông đường bộ số 36/2024/QH15",
        nguyen_van:
          "1. Người lái xe tham gia giao thông đường bộ phải đủ tuổi, sức khỏe theo quy định của pháp luật; có giấy phép " +
          "lái xe đang còn điểm, còn hiệu lực phù hợp với loại xe đang điều khiển do cơ quan có thẩm quyền cấp, trừ người " +
          "lái xe gắn máy quy định tại khoản 4 Điều này. Khi tham gia giao thông đường bộ, người lái xe phải mang theo các " +
          "giấy tờ sau đây: a) Chứng nhận đăng ký xe hoặc bản sao Chứng nhận đăng ký xe có chứng thực kèm bản gốc giấy tờ " +
          "xác nhận của tổ chức tín dụng, chi nhánh ngân hàng nước ngoài còn hiệu lực trong trường hợp xe đang được thế " +
          "chấp tại tổ chức tín dụng, chi nhánh ngân hàng nước ngoài; b) Giấy phép lái xe phù hợp với loại xe đang điều " +
          "khiển; c) Chứng nhận kiểm định an toàn kỹ thuật và bảo vệ môi trường đối với xe cơ giới theo quy định của pháp " +
          "luật; d) Chứng nhận bảo hiểm bắt buộc trách nhiệm dân sự của chủ xe cơ giới. […] 3. Trường hợp giấy tờ quy " +
          "định tại khoản 1 và khoản 2 Điều này đã được tích hợp vào tài khoản định danh điện tử thì việc xuất trình, kiểm " +
          "tra có thể thực hiện thông qua tài khoản định danh điện tử.",
        as_of: AS_OF_GTDB,
      },
      citations: [VB.L_TTATGT],
    },
    {
      kind: "bang_tra",
      data: {
        cot: ["Người điều khiển", "Giấy tờ phải mang theo", "Căn cứ"],
        dong: [
          [
            "Người lái xe cơ giới (ô tô, mô tô)",
            "Chứng nhận đăng ký xe (hoặc bản sao chứng thực kèm bản gốc giấy xác nhận của tổ chức tín dụng khi thế chấp); giấy phép lái xe phù hợp; chứng nhận kiểm định (xe thuộc diện kiểm định); chứng nhận bảo hiểm bắt buộc trách nhiệm dân sự",
            "Khoản 1 Điều 56",
          ],
          [
            "Người điều khiển xe máy chuyên dùng",
            "Chứng nhận đăng ký xe; bằng hoặc chứng chỉ điều khiển xe máy chuyên dùng; giấy phép lái xe hoặc chứng chỉ bồi dưỡng kiến thức pháp luật về giao thông đường bộ; chứng nhận kiểm định; chứng nhận bảo hiểm bắt buộc trách nhiệm dân sự",
            "Khoản 2 Điều 56",
          ],
          [
            "Người lái xe gắn máy",
            "Không cần giấy phép lái xe; phải đủ 16 tuổi, đủ sức khỏe, hiểu biết quy tắc giao thông và có kỹ năng điều khiển",
            "Khoản 4 Điều 56; điểm a khoản 1 Điều 59",
          ],
          [
            "Mọi trường hợp đã tích hợp giấy tờ vào tài khoản định danh điện tử",
            "Xuất trình, kiểm tra qua tài khoản định danh điện tử",
            "Khoản 3 Điều 56",
          ],
        ],
      },
      citations: [VB.L_TTATGT],
    },
    {
      kind: "hoi_nhanh",
      data: {
        cau_hoi:
          "Xe ô tô đang thế chấp tại ngân hàng. Người lái xe xuất trình bản sao chứng nhận đăng ký xe có chứng thực nhưng không có giấy xác nhận của ngân hàng. Giấy tờ đăng ký xe đã đủ theo điểm a khoản 1 Điều 56 chưa?",
        phuong_an: [
          { id: "a", text: "Đã đủ, vì bản sao có chứng thực có giá trị như bản chính" },
          { id: "b", text: "Chưa đủ, vì phải kèm bản gốc giấy xác nhận còn hiệu lực của tổ chức tín dụng" },
          {
            id: "c",
            text: "Chưa đủ, vì trong mọi trường hợp phải xuất trình bản chính chứng nhận đăng ký xe",
          },
        ],
        dap_an: "b",
        giai_thich:
          "Điểm a khoản 1 Điều 56: bản sao có chứng thực chỉ đủ khi kèm bản gốc giấy tờ xác nhận còn hiệu lực của tổ chức tín dụng, chi nhánh ngân hàng nước ngoài.",
      },
    },
    {
      kind: "so_do_trinh_tu",
      data: {
        buoc: [
          {
            ma: "b1",
            nhan: "Yêu cầu xuất trình giấy tờ",
            mo_ta: "Bản giấy, hoặc qua tài khoản định danh điện tử nếu đã tích hợp (khoản 3 Điều 56)",
          },
          {
            ma: "b2",
            nhan: "Đối chiếu giấy phép lái xe",
            mo_ta: "Hạng phù hợp loại xe; còn hiệu lực; còn điểm (khoản 1 Điều 56, Điều 57, Điều 58)",
          },
          {
            ma: "b3",
            nhan: "Đối chiếu đăng ký xe và biển số",
            mo_ta:
              "Chứng nhận đăng ký xe hoặc bản sao chứng thực kèm giấy xác nhận thế chấp (điểm a khoản 1 Điều 56)",
          },
          {
            ma: "b4",
            nhan: "Đối chiếu kiểm định và bảo hiểm",
            mo_ta:
              "Chứng nhận kiểm định còn hiệu lực; chứng nhận bảo hiểm bắt buộc (điểm c, d khoản 1 Điều 56)",
          },
          {
            ma: "b5",
            nhan: "Kết luận và ghi nhận",
            mo_ta: "Ghi rõ giấy tờ thiếu, không hợp lệ và căn cứ điểm, khoản, Điều",
          },
        ],
        canh: [
          { tu: "b1", den: "b2" },
          { tu: "b2", den: "b3" },
          { tu: "b3", den: "b4" },
          { tu: "b4", den: "b5" },
        ],
      },
      citations: [VB.L_TTATGT],
    },
    {
      kind: "canh_bao",
      data: {
        loai: "hieu_luc",
        md:
          "Giấy phép lái xe bị trừ hết điểm thì người có giấy phép không được điều khiển phương tiện theo giấy phép đó " +
          "(khoản 3 Điều 58); khi kiểm tra phải đối chiếu số điểm còn lại trên cơ sở dữ liệu, không chỉ đối chiếu thời hạn " +
          "in trên giấy phép.",
      },
    },
    {
      kind: "the_lat",
      data: {
        the: [
          {
            truoc: "Giấy phép lái xe đang còn điểm",
            sau: "Giấy phép chưa bị trừ hết 12 điểm trên cơ sở dữ liệu về trật tự, an toàn giao thông (Điều 58).",
          },
          {
            truoc: "Tài khoản định danh điện tử",
            sau: "Nơi tích hợp giấy tờ của người lái xe; xuất trình và kiểm tra qua tài khoản có giá trị như giấy tờ (khoản 3 Điều 56).",
          },
          {
            truoc: "Xe gắn máy",
            sau: "Người lái không cần giấy phép lái xe, nhưng phải đủ 16 tuổi và đủ sức khỏe (khoản 4 Điều 56).",
          },
        ],
      },
      citations: [VB.L_TTATGT],
    },
    {
      kind: "tom_tat",
      data: {
        y: [
          "Bốn giấy tờ của người lái xe cơ giới theo khoản 1 Điều 56 Luật số 36/2024/QH15: đăng ký xe, giấy phép lái xe, chứng nhận kiểm định, chứng nhận bảo hiểm bắt buộc.",
          "Xe thế chấp: bản sao chứng nhận đăng ký xe có chứng thực phải kèm bản gốc giấy xác nhận còn hiệu lực của tổ chức tín dụng.",
          "Giấy tờ đã tích hợp vào tài khoản định danh điện tử được kiểm tra qua tài khoản (khoản 3 Điều 56).",
          "Giấy phép lái xe phải còn hiệu lực và còn điểm; hết điểm thì không được điều khiển xe theo giấy phép đó (khoản 3 Điều 58).",
        ],
      },
    },
  ];
  await ghiKhoi(lessonId, khoi);

  await luuHoatDong({
    courseId,
    lessonId,
    ordinal: 1,
    kind: "trac_nghiem",
    mode: "may",
    title: "Người lái xe gắn máy và giấy phép lái xe",
    prompt: {
      cau_hoi:
        "Người 17 tuổi điều khiển xe gắn máy, không có giấy phép lái xe. Theo Luật số 36/2024/QH15, việc không có giấy phép lái xe có vi phạm không?",
      phuong_an: [
        { id: "a", text: "Có, vì mọi người điều khiển xe cơ giới đều phải có giấy phép lái xe" },
        {
          id: "b",
          text: "Không, vì người lái xe gắn máy không thuộc diện phải có giấy phép lái xe; điều kiện là đủ 16 tuổi, đủ sức khỏe, hiểu biết quy tắc giao thông và có kỹ năng điều khiển",
        },
        { id: "c", text: "Không, vì người dưới 18 tuổi không phải mang theo giấy tờ gì" },
      ],
    },
    answer: {
      dung: ["b"],
      giai_thich:
        "Khoản 1 Điều 56 loại trừ người lái xe gắn máy khỏi yêu cầu giấy phép lái xe; khoản 4 Điều 56 và điểm a khoản 1 Điều 59 quy định điều kiện tuổi (đủ 16), sức khỏe, hiểu biết quy tắc và kỹ năng.",
      phuong_an: [
        {
          id: "a",
          text: "Có vi phạm",
          ma_loi: "vien_dan_sai_dieu_khoan",
          giai_thich: "Khoản 1 Điều 56 có ngoại lệ cho người lái xe gắn máy.",
        },
        { id: "b", text: "Không vi phạm về giấy phép lái xe", dung: true },
        {
          id: "c",
          text: "Không phải mang giấy tờ",
          ma_loi: "vien_dan_sai_dieu_khoan",
          giai_thich:
            "Luật không có quy định miễn giấy tờ theo tuổi; ngoại lệ chỉ áp dụng cho giấy phép lái xe của người lái xe gắn máy.",
        },
      ],
    },
    skills: ["gtdb_kiem_tra_giay_to"],
    errorTags: ["vien_dan_sai_dieu_khoan"],
    citations: [VB.L_TTATGT],
    points: 2,
    level: 1,
  });

  await luuHoatDong({
    courseId,
    lessonId,
    ordinal: 2,
    kind: "ghep_cap",
    mode: "may",
    title: "Ghép tình huống với căn cứ tại Điều 56",
    prompt: {
      cau_hoi:
        "Ghép mỗi tình huống kiểm tra giấy tờ với điểm, khoản của Điều 56 Luật số 36/2024/QH15 điều chỉnh tình huống đó.",
      trai: [
        { id: "t1", text: "Xe đang thế chấp, người lái xuất trình bản sao chứng nhận đăng ký xe" },
        { id: "t2", text: "Người lái xe xuất trình giấy tờ qua ứng dụng định danh điện tử" },
        {
          id: "t3",
          text: "Người điều khiển máy xúc di chuyển trên đường xuất trình chứng chỉ điều khiển xe máy chuyên dùng",
        },
        { id: "t4", text: "Người lái xe ô tô không có chứng nhận bảo hiểm bắt buộc trách nhiệm dân sự" },
      ],
      phai: [
        { id: "p1", text: "Điểm a khoản 1 Điều 56" },
        { id: "p2", text: "Khoản 3 Điều 56" },
        { id: "p3", text: "Khoản 2 Điều 56" },
        { id: "p4", text: "Điểm d khoản 1 Điều 56" },
      ],
    },
    answer: {
      cap: { t1: "p1", t2: "p2", t3: "p3", t4: "p4" },
      giai_thich: "Đối chiếu từng tình huống với các điểm, khoản của Điều 56.",
    },
    skills: ["gtdb_kiem_tra_giay_to"],
    errorTags: ["vien_dan_sai_dieu_khoan"],
    citations: [VB.L_TTATGT],
    points: 2,
    level: 1,
  });
}

/** Chuyên đề trừ điểm, bài 1 — cơ chế điểm giấy phép lái xe. */
async function soanTruDiemBai1(courseId: string, lessonId: string) {
  const khoi: KhoiSoan[] = [
    {
      kind: "giang",
      data: {
        md:
          "Điều 58 Luật Trật tự, an toàn giao thông đường bộ đặt ra cơ chế **điểm của giấy phép lái xe**: mỗi giấy phép có " +
          "**12 điểm**, được quản lý trên cơ sở dữ liệu về trật tự, an toàn giao thông đường bộ. Số điểm bị trừ mỗi lần vi " +
          "phạm tùy tính chất, mức độ hành vi và được cập nhật ngay sau khi quyết định xử phạt có hiệu lực thi hành; người " +
          "có thẩm quyền xử phạt vi phạm hành chính là người có thẩm quyền trừ điểm.\n\n" +
          "Điểm được phục hồi đủ 12 nếu trong 12 tháng kể từ lần bị trừ gần nhất giấy phép không bị trừ thêm. Giấy phép " +
          "bị trừ hết điểm thì người có giấy phép không được điều khiển phương tiện theo giấy phép đó; sau ít nhất 06 tháng, " +
          "người đó dự kiểm tra kiến thức pháp luật do Cảnh sát giao thông tổ chức, đạt yêu cầu thì được phục hồi đủ 12 điểm. " +
          "Từ ngày 01/7/2026, nội dung, phương pháp và trình tự kiểm tra thực hiện theo Thông tư số 65/2024/TT-BCA đã được " +
          "sửa đổi bởi Thông tư số 105/2026/TT-BCA.\n\n" +
          "Hành vi bị trừ điểm và số điểm trừ cụ thể quy định tại Nghị định số 168/2024/NĐ-CP (sửa đổi bởi Nghị định số " +
          "238/2026/NĐ-CP); nội dung này được trình bày ở bài 2 của chuyên đề.",
      },
    },
    {
      kind: "can_cu",
      data: {
        urn: VB.L_TTATGT,
        nhan: "Điều 58 Luật Trật tự, an toàn giao thông đường bộ số 36/2024/QH15 (khoản 1 đến khoản 5)",
        nguyen_van:
          "1. Điểm của giấy phép lái xe được dùng để quản lý việc chấp hành pháp luật về trật tự, an toàn giao thông đường " +
          "bộ của người lái xe trên hệ thống cơ sở dữ liệu về trật tự, an toàn giao thông đường bộ, bao gồm 12 điểm. Số " +
          "điểm trừ mỗi lần vi phạm tùy thuộc tính chất, mức độ của hành vi vi phạm pháp luật về trật tự, an toàn giao thông " +
          "đường bộ. Dữ liệu về điểm trừ giấy phép lái xe của người vi phạm sẽ được cập nhật vào hệ thống cơ sở dữ liệu ngay " +
          "sau khi quyết định xử phạt có hiệu lực thi hành và thông báo cho người bị trừ điểm giấy phép lái xe biết. 2. Giấy " +
          "phép lái xe chưa bị trừ hết điểm và không bị trừ điểm trong thời hạn 12 tháng từ ngày bị trừ điểm gần nhất thì " +
          "được phục hồi đủ 12 điểm. 3. Trường hợp giấy phép lái xe bị trừ hết điểm thì người có giấy phép lái xe không được " +
          "điều khiển phương tiện tham gia giao thông đường bộ theo giấy phép lái xe đó. Sau thời hạn ít nhất là 06 tháng kể " +
          "từ ngày bị trừ hết điểm, người có giấy phép lái xe được tham gia kiểm tra nội dung kiến thức pháp luật về trật tự, " +
          "an toàn giao thông đường bộ theo quy định tại khoản 7 Điều 61 của Luật này do lực lượng Cảnh sát giao thông tổ " +
          "chức, có kết quả đạt yêu cầu thì được phục hồi đủ 12 điểm. 4. Giấy phép lái xe sau khi đổi, cấp lại, nâng hạng " +
          "được giữ nguyên số điểm của giấy phép lái xe trước khi đổi, cấp lại, nâng hạng. 5. Người có thẩm quyền xử phạt vi " +
          "phạm hành chính có thẩm quyền trừ điểm giấy phép lái xe.",
        as_of: AS_OF_GTDB,
      },
      citations: [VB.L_TTATGT],
    },
    {
      kind: "so_do_trinh_tu",
      data: {
        buoc: [
          {
            ma: "b1",
            nhan: "Vi phạm thuộc hành vi bị trừ điểm",
            mo_ta: "Theo Nghị định số 168/2024/NĐ-CP (sửa đổi bởi Nghị định số 238/2026/NĐ-CP)",
          },
          {
            ma: "b2",
            nhan: "Quyết định xử phạt ghi nội dung trừ điểm",
            mo_ta: "Người có thẩm quyền xử phạt là người có thẩm quyền trừ điểm (khoản 5 Điều 58)",
          },
          {
            ma: "b3",
            nhan: "Cập nhật dữ liệu và thông báo",
            mo_ta: "Ngay sau khi quyết định xử phạt có hiệu lực thi hành (khoản 1 Điều 58)",
          },
          {
            ma: "b4",
            nhan: "Còn điểm: theo dõi 12 tháng",
            mo_ta: "Không bị trừ thêm thì phục hồi đủ 12 điểm (khoản 2 Điều 58)",
          },
          {
            ma: "b5",
            nhan: "Hết điểm: dừng điều khiển xe",
            mo_ta:
              "Sau ít nhất 06 tháng, kiểm tra kiến thức pháp luật đạt yêu cầu thì phục hồi (khoản 3 Điều 58)",
          },
        ],
        canh: [
          { tu: "b1", den: "b2" },
          { tu: "b2", den: "b3" },
          { tu: "b3", den: "b4" },
          { tu: "b3", den: "b5" },
        ],
      },
      citations: [VB.L_TTATGT, VB.ND_168_2024],
    },
    {
      kind: "hoi_nhanh",
      data: {
        cau_hoi:
          "Giấy phép lái xe bị trừ hết điểm ngày 01/02/2026 và người lái xe không vi phạm gì thêm. Sớm nhất từ khi nào người này được dự kiểm tra kiến thức pháp luật để phục hồi điểm?",
        phuong_an: [
          { id: "a", text: "Ngay sau khi quyết định xử phạt có hiệu lực" },
          { id: "b", text: "Sau ít nhất 06 tháng kể từ ngày bị trừ hết điểm, tức từ ngày 01/8/2026" },
          { id: "c", text: "Sau 12 tháng, tức từ ngày 01/02/2027" },
        ],
        dap_an: "b",
        giai_thich:
          "Khoản 3 Điều 58: sau thời hạn ít nhất là 06 tháng kể từ ngày bị trừ hết điểm. Thời hạn 12 tháng ở khoản 2 áp dụng cho trường hợp còn điểm.",
      },
    },
    {
      kind: "can_cu",
      data: {
        urn: VB.TT_105_2026_BCA,
        nhan: "Điều 1 Thông tư số 105/2026/TT-BCA ngày 26/6/2026 của Bộ trưởng Bộ Công an (sửa đổi Điều 6 Thông tư số 65/2024/TT-BCA) — trích khoản 2 và khoản 4 của Điều 6 mới",
        nguyen_van:
          "2. Phương pháp kiểm tra: người dự kiểm tra thực hiện bài kiểm tra trắc nghiệm trên máy tính qua phần mềm kiểm " +
          "tra kiến thức pháp luật về trật tự, an toàn giao thông đường bộ, trừ trường hợp quy định tại khoản 8 Điều 7, được " +
          "sửa đổi, bổ sung tại Điều 2 Thông tư này. […] 4. Người dự kiểm tra có kết quả kiểm tra đạt yêu cầu được phục hồi " +
          "điểm giấy phép lái xe. Người dự kiểm tra có kết quả kiểm tra không đạt yêu cầu có thể đăng ký kiểm tra lại sau 07 " +
          "ngày làm việc, kể từ ngày kết thúc kiểm tra trước đó.",
        as_of: AS_OF_GTDB,
      },
      citations: [VB.TT_105_2026_BCA, VB.TT_65_2024_BCA],
    },
    {
      kind: "can_cu",
      data: {
        urn: VB.TT_105_2026_BCA,
        nhan: "Điều 2 Thông tư số 105/2026/TT-BCA (sửa đổi Điều 7 Thông tư số 65/2024/TT-BCA) — trích khoản 1 và điểm b khoản 2 của Điều 7 mới",
        nguyen_van:
          "1. Hồ sơ đăng ký kiểm tra: a) Đơn đề nghị kiểm tra kiến thức pháp luật về trật tự, an toàn giao thông đường bộ " +
          "theo Mẫu số 01 Phụ lục kèm theo Thông tư này; b) Giấy khám sức khoẻ của người đăng ký kiểm tra do cơ sở y tế có " +
          "thẩm quyền cấp còn giá trị sử dụng (bản giấy hoặc bản điện tử). […] b) Hồ sơ đăng ký kiểm tra nộp cho Công an " +
          "cấp xã, cơ quan có thẩm quyền kiểm tra trước ngày đăng ký kiểm tra bằng một trong các hình thức sau: trực tuyến " +
          "tại Cổng dịch vụ công quốc gia, Cổng dịch vụ công Bộ Công an, qua Ứng dụng định danh quốc gia hoặc các ứng dụng " +
          "của lực lượng Công an nhân dân; qua dịch vụ bưu chính; trực tiếp.",
        as_of: AS_OF_GTDB,
      },
      citations: [VB.TT_105_2026_BCA, VB.TT_65_2024_BCA],
    },
    {
      kind: "canh_bao",
      data: {
        loai: "hieu_luc",
        md:
          "Thông tư số 105/2026/TT-BCA có hiệu lực từ ngày 01/7/2026; theo khoản 3 Điều 6 của Thông tư, một số nội dung về " +
          "đề, thời gian, kết cấu bài kiểm tra của Thông tư số 65/2024/TT-BCA và Thông tư số 13/2025/TT-BCA vẫn được thực " +
          "hiện đến hết ngày 30/6/2027. Khi hướng dẫn người dân, đối chiếu đúng mốc thời gian đăng ký kiểm tra.",
      },
    },
    {
      kind: "the_lat",
      data: {
        the: [
          { truoc: "12 điểm", sau: "Số điểm của mỗi giấy phép lái xe trên cơ sở dữ liệu (khoản 1 Điều 58)." },
          {
            truoc: "Phục hồi tự động",
            sau: "Không bị trừ điểm trong 12 tháng kể từ lần trừ gần nhất và chưa hết điểm (khoản 2 Điều 58).",
          },
          {
            truoc: "Phục hồi sau kiểm tra",
            sau: "Bị trừ hết điểm: sau ít nhất 06 tháng, kiểm tra kiến thức pháp luật đạt yêu cầu (khoản 3 Điều 58).",
          },
          {
            truoc: "Đổi, cấp lại, nâng hạng",
            sau: "Giữ nguyên số điểm của giấy phép trước đó (khoản 4 Điều 58).",
          },
        ],
      },
      citations: [VB.L_TTATGT],
    },
    {
      kind: "tom_tat",
      data: {
        y: [
          "Mỗi giấy phép lái xe có 12 điểm; điểm trừ cập nhật ngay sau khi quyết định xử phạt có hiệu lực (khoản 1 Điều 58 Luật số 36/2024/QH15).",
          "Còn điểm và không vi phạm thêm trong 12 tháng: phục hồi đủ 12 điểm; hết điểm: không được lái xe, sau ít nhất 06 tháng kiểm tra kiến thức pháp luật.",
          "Người có thẩm quyền xử phạt là người có thẩm quyền trừ điểm (khoản 5 Điều 58).",
          "Kiểm tra kiến thức pháp luật: trắc nghiệm trên máy tính; không đạt thì đăng ký lại sau 07 ngày làm việc (Điều 1 Thông tư số 105/2026/TT-BCA).",
        ],
      },
    },
  ];
  await ghiKhoi(lessonId, khoi);

  await luuHoatDong({
    courseId,
    lessonId,
    ordinal: 1,
    kind: "trac_nghiem",
    mode: "may",
    title: "Phục hồi điểm khi còn điểm",
    prompt: {
      cau_hoi:
        "Giấy phép lái xe bị trừ 4 điểm ngày 10/3/2026 (còn 8 điểm), sau đó không vi phạm gì thêm. Giấy phép được phục hồi đủ 12 điểm từ khi nào?",
      phuong_an: [
        { id: "a", text: "Sau 06 tháng, từ ngày 10/9/2026" },
        { id: "b", text: "Sau 12 tháng kể từ ngày bị trừ điểm gần nhất, từ ngày 10/3/2027" },
        { id: "c", text: "Chỉ khi dự kiểm tra kiến thức pháp luật đạt yêu cầu" },
      ],
    },
    answer: {
      dung: ["b"],
      giai_thich:
        "Khoản 2 Điều 58: giấy phép chưa bị trừ hết điểm và không bị trừ điểm trong thời hạn 12 tháng từ ngày bị trừ gần nhất thì được phục hồi đủ 12 điểm.",
      phuong_an: [
        {
          id: "a",
          text: "Sau 06 tháng",
          ma_loi: "vien_dan_sai_dieu_khoan",
          giai_thich: "Mốc 06 tháng thuộc khoản 3, áp dụng khi bị trừ hết điểm.",
        },
        { id: "b", text: "Sau 12 tháng", dung: true },
        {
          id: "c",
          text: "Phải kiểm tra kiến thức",
          ma_loi: "nham_bien_phap_ngan_chan",
          giai_thich:
            "Kiểm tra kiến thức pháp luật chỉ áp dụng với giấy phép đã bị trừ hết điểm (khoản 3 Điều 58).",
        },
      ],
    },
    skills: ["gtdb_co_che_diem"],
    errorTags: ["vien_dan_sai_dieu_khoan", "nham_bien_phap_ngan_chan"],
    citations: [VB.L_TTATGT],
    points: 2,
    level: 1,
  });

  await luuHoatDong({
    courseId,
    lessonId,
    ordinal: 2,
    kind: "sap_xep",
    mode: "may",
    title: "Trình tự phục hồi điểm khi giấy phép bị trừ hết điểm",
    prompt: {
      cau_hoi: "Sắp xếp các bước theo đúng trình tự đối với giấy phép lái xe đã bị trừ hết điểm.",
      muc: [
        { id: "m3", text: "Nộp hồ sơ đăng ký kiểm tra (đơn đề nghị và giấy khám sức khỏe còn giá trị)" },
        { id: "m1", text: "Quyết định xử phạt có hiệu lực, dữ liệu điểm được cập nhật về 0" },
        {
          id: "m4",
          text: "Làm bài kiểm tra trắc nghiệm trên máy tính; đạt yêu cầu thì được phục hồi đủ 12 điểm",
        },
        { id: "m2", text: "Không điều khiển phương tiện theo giấy phép đó; chờ ít nhất 06 tháng" },
      ],
    },
    answer: {
      thu_tu: ["m1", "m2", "m3", "m4"],
      giai_thich:
        "Khoản 1 và khoản 3 Điều 58 Luật số 36/2024/QH15; Điều 1 và Điều 2 Thông tư số 105/2026/TT-BCA.",
    },
    skills: ["gtdb_co_che_diem", "gtdb_phuc_hoi_diem"],
    citations: [VB.L_TTATGT, VB.TT_105_2026_BCA],
    points: 2,
    level: 1,
  });
}

/* ------------------------------------------------------------------ */
/* Gieo                                                                 */
/* ------------------------------------------------------------------ */

export async function gieoCayGtdb() {
  const kho = await traKho(CAY_GTDB.flatMap((c) => [...c.hienHanh, ...(c.lichSu ?? [])]));
  const thieu = [...kho.values()].filter((v) => !v.co).map((v) => v.urn);
  if (thieu.length) {
    console.warn(`  CHƯA CÓ TRONG KHO (${thieu.length}), không đưa vào bản đồ pháp lý:`);
    for (const u of thieu) console.warn(`    - ${tenVanBan(u)}  (${u})`);
  }

  // Lĩnh vực: seed-dao-tao.ts có thể đã tạo; chỉ tạo khi chưa có, không ghi đè mô tả của bên kia.
  const slugLinhVuc = "giao-thong-duong-bo";
  let linhVuc = await linhVucTheoSlug(slugLinhVuc);
  if (!linhVuc) {
    linhVuc = await luuLinhVuc({
      slug: slugLinhVuc,
      name: "Pháp luật giao thông đường bộ",
      summary:
        "Lĩnh vực dành cho lực lượng thi hành pháp luật về giao thông đường bộ: hệ thống văn bản, quy " +
        "tắc giao thông, phương tiện và người lái, tuần tra kiểm soát, xử lý vi phạm, điều tra tai nạn.",
      audienceNote: "Cảnh sát giao thông đường bộ",
      ordinal: 1,
      status: "bien_tap",
    });
  }
  console.log(`  lĩnh vực "${linhVuc.slug}"`);

  const idChuyenDe = new Map<string, string>();
  let soChuyenDeXuatBan = 0;

  for (const [i, cd] of CAY_GTDB.entries()) {
    const hienHanh = cd.hienHanh.filter((u) => kho.get(u)?.co);
    const lichSu = (cd.lichSu ?? []).filter((u) => kho.get(u)?.co);
    const course = await luuChuyenDe({
      slug: cd.slug,
      title: cd.title,
      summary: cd.summary,
      audience: cd.audience,
      level: cd.level,
      tags: cd.tags,
      taxonomyCodes: [],
      objectives: cd.objectives,
      asOf: AS_OF_GTDB,
      durationMinutes: cd.bai.reduce((t, b) => t + b.phut, 0) || null,
      defaultMode: "day_du",
      mascotId: null,
      mascotLocked: false,
      mascotCostume: "cong_so",
      legalMap: {
        ghi_chu:
          "Hai luật nền có hiệu lực từ ngày 01/01/2025; các nghị định hướng dẫn được sửa đổi trong " +
          "năm 2026. Vụ việc xảy ra trước ngày 01/01/2025 áp dụng văn bản ở mục lịch sử. Chạy lại " +
          "scripts/check-citations.ts trước mỗi lần xuất bản.",
        hien_hanh: hienHanh,
        lich_su: lichSu,
        chua_co_trong_kho: [...cd.hienHanh, ...(cd.lichSu ?? [])].filter((u) => !kho.get(u)?.co),
      },
      fieldId: linhVuc.id,
      parentId: cd.cha ? (idChuyenDe.get(cd.cha) ?? null) : null,
      followsId: cd.noiTiepTu ? (idChuyenDe.get(cd.noiTiepTu) ?? null) : null,
      audienceGroup: "khach_hang",
      ordinal: i,
    });
    idChuyenDe.set(cd.slug, course.id);

    await luuKyNang(
      course.id,
      cd.kyNang.map((k, j) => ({ ...k, ordinal: j })),
    );

    let soBaiXuatBan = 0;
    for (const [j, b] of cd.bai.entries()) {
      const bai = await luuBaiHoc({
        courseId: course.id,
        slug: b.slug,
        ordinal: j + 1,
        title: b.title,
        asOf: AS_OF_GTDB,
        estimatedMinutes: b.phut,
        skills: b.skills,
        source: "nguoi",
      });
      const soan = BAI_DA_SOAN[`${cd.slug} › ${b.slug}`];
      if (soan) {
        await soan(course.id, bai.id);
        await datTrangThaiBaiHoc(bai.id, "xuat_ban");
        soBaiXuatBan += 1;
      }
    }

    // Chuyên đề chỉ xuất bản khi có ít nhất một bài thật; còn lại ở trạng thái biên tập.
    await datTrangThaiChuyenDe(course.id, soBaiXuatBan > 0 ? "xuat_ban" : "bien_tap");
    if (soBaiXuatBan > 0) soChuyenDeXuatBan += 1;
    console.log(
      `  chuyên đề "${cd.slug}": ${cd.bai.length} bài (${soBaiXuatBan} đã soạn), ${cd.kyNang.length} kỹ năng, ` +
        `${hienHanh.length}/${cd.hienHanh.length} văn bản hiện hành có trong kho`,
    );
  }

  if (soChuyenDeXuatBan > 0 && linhVuc.status !== "xuat_ban") {
    await sql`UPDATE fields SET status = 'xuat_ban', updated_at = now() WHERE id = ${linhVuc.id}::uuid`;
    console.log(`  lĩnh vực "${linhVuc.slug}" chuyển sang xuất bản (${soChuyenDeXuatBan} chuyên đề có bài)`);
  }
}

if (import.meta.main) {
  console.log("Gieo cây chuyên đề giao thông đường bộ…");
  await gieoMaLoi();
  await gieoCayGtdb();
  console.log("Xong.");
  await sql.end();
}
