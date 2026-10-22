import { index, type RouteConfig, route } from "@react-router/dev/routes";

/**
 * Bản đồ route theo ke-hoach/10-frontend-ux.md §2 (đường dẫn tiếng Việt, không dấu).
 *
 * Tên tệp route được giữ nguyên qua các lần làm lại giao diện: content/huong-dan khai bài
 * hướng dẫn theo tên tệp, và scripts/huong-dan kiểm tra khớp với danh sách này.
 */
export default [
  index("routes/home.tsx"),
  route("tim-kiem", "routes/search.tsx"),
  route("van-ban/:docType/:slug", "routes/document.tsx", [
    index("routes/document.read.tsx"),
    route("thuoc-tinh", "routes/document.properties.tsx"),
    route("luoc-do", "routes/document.diagram.tsx"),
    route("phien-ban", "routes/document.versions.tsx"),
  ]),
  // Tệp PDF gốc của văn bản nạp từ bản quét, chuyển tiếp từ API; trang đọc nhúng tệp này.
  route("van-ban/:docType/:slug/tep-goc", "routes/document.tep-goc.tsx"),
  // Ảnh từng trang của tệp gốc, cho điện thoại (không hiện được PDF trong khung).
  route("van-ban/:docType/:slug/tep-goc/trang/:trang", "routes/document.tep-goc.tsx", {
    id: "document-tep-goc-trang",
  }),
  route("so-sanh", "routes/compare.tsx"),
  route("hoi-dap", "routes/ask.tsx"),
  route("ung-dung", "routes/usecases.tsx"),

  // Mục Tra cứu trên header: chọn giữa văn bản và tra cứu nhanh (docs/PLAN.md GĐ5).
  route("tra-cuu", "routes/tra-cuu.tsx"),
  route("tra-cuu-nhanh", "routes/tra-cuu-nhanh._index.tsx"),
  route("tra-cuu-nhanh/muc-phat", "routes/tra-cuu-nhanh.muc-phat.tsx"),
  route("tra-cuu-nhanh/toc-do", "routes/tra-cuu-nhanh.toc-do.tsx"),
  // Quy trình, Biểu mẫu: một tệp cho trang tra chung (quy trình và biểu mẫu) và chi tiết quy trình.
  route("tra-cuu-nhanh/quy-trinh", "routes/tra-cuu-nhanh.quy-trinh.tsx", { id: "quy-trinh-danh-sach" }),
  route("tra-cuu-nhanh/quy-trinh/:ma", "routes/tra-cuu-nhanh.quy-trinh.tsx", { id: "quy-trinh-chi-tiet" }),
  // Biểu mẫu, hướng dẫn dạng tệp; tệp phục vụ qua resource route chuyển tiếp từ API.
  route("tra-cuu-nhanh/bieu-mau/:ma", "routes/tra-cuu-nhanh.bieu-mau.tsx"),
  route("tra-cuu-nhanh/bieu-mau/:ma/tep", "routes/tra-cuu-nhanh.bieu-mau.tep.tsx"),
  // Biển báo (docs/PLAN.md GĐ12); ảnh phục vụ qua resource route chuyển tiếp từ API.
  route("tra-cuu-nhanh/bien-bao", "routes/tra-cuu-nhanh.bien-bao.tsx"),
  route("bien-bao/anh/:tep", "routes/bien-bao.anh.tsx"),
  // Ảnh đại diện người dùng tự tải lên (đổi ở /tai-khoan), chuyển tiếp từ API.
  route("anh-dai-dien/:tep", "routes/anh-dai-dien.tsx"),
  // Bộ công cụ nghiệp vụ ở trang chủ (lib/cong-cu.ts).
  route("cong-cu", "routes/cong-cu._index.tsx"),
  // Chuyển đổi địa giới hành chính (lib/dia-gioi.ts): đường tĩnh nên thắng "cong-cu/:ma".
  route("cong-cu/dia-gioi-hanh-chinh", "routes/cong-cu.dia-gioi._index.tsx"),
  route("cong-cu/dia-gioi-hanh-chinh/thu-cong", "routes/cong-cu.dia-gioi.thu-cong.tsx"),
  route("cong-cu/dia-gioi-hanh-chinh/vi-tri", "routes/cong-cu.dia-gioi.vi-tri.tsx"),
  route("cong-cu/dia-gioi-hanh-chinh/dia-chi", "routes/cong-cu.dia-gioi.dia-chi.tsx"),
  route("cong-cu/dia-gioi-hanh-chinh/tra-nguoc", "routes/cong-cu.dia-gioi.tra-nguoc.tsx"),
  // Tính ngày hẹn lên làm việc (lib/tinh-ngay-xu-ly.ts), cũng thắng "cong-cu/:ma".
  route("cong-cu/tinh-ngay-xu-ly", "routes/cong-cu.tinh-ngay-xu-ly.tsx"),
  // Xác định tuổi vi phạm (lib/xac-dinh-tuoi.ts), cũng thắng "cong-cu/:ma".
  route("cong-cu/xac-dinh-tuoi", "routes/cong-cu.xac-dinh-tuoi.tsx"),
  // Tính % quá tải (lib/tinh-qua-tai.ts), cũng thắng "cong-cu/:ma".
  route("cong-cu/tinh-qua-tai", "routes/cong-cu.tinh-qua-tai.tsx"),
  // Cơi nới thùng xe (lib/coi-noi-thung.ts), quá khổ hàng hóa (lib/qua-kho.ts), sổ ghi số đo kèm ảnh
  // (lib/so-do.ts), hạng GPLX theo phương tiện (lib/loai-gplx.ts), mức phạt nồng độ cồn
  // (lib/nong-do-con.ts): cũng thắng "cong-cu/:ma".
  route("cong-cu/coi-noi-thanh-thung", "routes/cong-cu.coi-noi-thanh-thung.tsx"),
  route("cong-cu/qua-kho-hang-hoa", "routes/cong-cu.qua-kho-hang-hoa.tsx"),
  route("cong-cu/do-dac-dien-tu", "routes/cong-cu.do-dac-dien-tu.tsx"),
  route("cong-cu/loai-gplx", "routes/cong-cu.loai-gplx.tsx"),
  route("cong-cu/nong-do-con", "routes/cong-cu.nong-do-con.tsx"),
  route("cong-cu/:ma", "routes/cong-cu.tsx"),

  // Luyện tập (docs/PLAN.md GĐ4). "can-cu" khai trước ":phien" để không bị hiểu là id phiên.
  route("luyen-tap", "routes/luyen-tap._index.tsx"),
  route("luyen-tap/can-cu", "routes/luyen-tap.can-cu.tsx"),
  // Luyện tập không cần mạng (docs/PLAN.md GĐ13): route chạy phía client, khai trước ":phien".
  route("luyen-tap/offline", "routes/luyen-tap.offline.tsx"),
  route("luyen-tap/:phien", "routes/luyen-tap.phien.tsx"),
  route("luyen-tap/:phien/luu", "routes/luyen-tap.phien.luu.tsx"),
  route("luyen-tap/:phien/ket-qua", "routes/luyen-tap.ket-qua.tsx"),
  route("toi", "routes/toi.tsx"),
  // Nhóm học cùng (docs/PLAN.md GĐ16b). Đường tĩnh "nguon", "tham-gia/:ma" khai trước ":id";
  // "nguon" và ".../tien-do" chỉ có loader, cho hộp thoại đọc qua fetcher.
  route("nhom", "routes/nhom.tsx"),
  route("nhom/nguon", "routes/nhom.nguon.tsx"),
  route("nhom/tham-gia/:ma", "routes/nhom.tham-gia.tsx"),
  route("nhom/:id", "routes/nhom.chi-tiet.tsx"),
  route("nhom/:id/thanh-vien/:accountId/tien-do", "routes/nhom.tien-do.tsx"),
  // Cầu nối thông báo đẩy cho khối Nhắc học ở /toi (docs/PLAN.md GĐ15), không có giao diện.
  route("thong-bao", "routes/thong-bao.tsx"),
  // Xem trước bộ biểu tượng (docs/PROMPT_BO_ICON.md), chỉ bật ở môi trường dev.
  route("xem-bieu-tuong", "routes/xem-bieu-tuong.tsx"),

  // Thi sát hạch (docs/PLAN.md GĐ6). "luot/:id/luu" là resource route lưu từng câu trả lời.
  route("thi", "routes/thi._index.tsx"),
  route("thi/luot/:id", "routes/thi.luot.tsx"),
  route("thi/luot/:id/luu", "routes/thi.luot.luu.tsx"),
  route("thi/luot/:id/ket-qua", "routes/thi.ket-qua.tsx"),

  // Bài giảng (docs/PLAN.md GĐ11): danh mục lĩnh vực → chuyên đề → bài. Tên tệp giữ "training.*".
  route("hoc", "routes/training.tsx"),
  route("hoc/:course", "routes/training.course.tsx"),
  route("hoc/:course/:lesson", "routes/training.lesson.tsx"),
  // Đường cũ /dao-tao chuyển sang /hoc; ba trang tiến độ, ôn tập, vá lỗi vẫn ở /dao-tao.
  route("dao-tao", "routes/dao-tao.chuyen-huong.tsx", { id: "dao-tao-chuyen-huong" }),
  route("dao-tao/:course", "routes/dao-tao.chuyen-huong.tsx", { id: "dao-tao-chuyen-huong-chuyen-de" }),
  // Đường tĩnh khai trước ":lesson" để "tien-do", "on-tap" không bị hiểu là slug bài học.
  route("dao-tao/:course/tien-do", "routes/training.progress.tsx"),
  route("dao-tao/:course/on-tap", "routes/training.review.tsx"),
  route("dao-tao/:course/va-loi/:maLoi", "routes/training.patch.tsx"),
  route("dao-tao/:course/:lesson", "routes/dao-tao.chuyen-huong.tsx", { id: "dao-tao-chuyen-huong-bai" }),

  // Bảng điều khiển quản trị: route bảo vệ, layout riêng.
  route("quan-tri", "routes/quan-tri.tsx", [
    index("routes/quan-tri._index.tsx"),
    // Tổ chức (docs/PLAN.md GĐ2): cán bộ quản lý xem, quản trị viên sửa.
    route("don-vi", "routes/quan-tri.don-vi.tsx"),
    route("nguoi-dung", "routes/quan-tri.nguoi-dung.tsx"),
    route("nguoi-dung/mau", "routes/quan-tri.nguoi-dung.mau.tsx"),
    // Ngân hàng câu hỏi (docs/PLAN.md GĐ3). Đường tĩnh "moi", "tep/:loai" khai trước ":id".
    route("cau-hoi", "routes/quan-tri.cau-hoi.tsx"),
    route("cau-hoi/moi", "routes/quan-tri.cau-hoi.sua.tsx", { id: "quan-tri-cau-hoi-moi" }),
    route("cau-hoi/tep/:loai", "routes/quan-tri.cau-hoi.tep.tsx"),
    route("cau-hoi/:id", "routes/quan-tri.cau-hoi.sua.tsx"),
    // Dữ liệu tra cứu nhanh, duyệt như câu hỏi (docs/PLAN.md GĐ-G0).
    route("du-lieu-tra-cuu", "routes/quan-tri.du-lieu-tra-cuu.tsx"),
    route("du-lieu-tra-cuu/moi", "routes/quan-tri.du-lieu-tra-cuu.moi.tsx"),
    // Tệp của biểu mẫu ở mọi trạng thái, cho người soạn và người duyệt xem trước.
    route("du-lieu-tra-cuu/tep/:ma", "routes/quan-tri.du-lieu-tra-cuu.tep.tsx"),
    // Dữ liệu cho ô chọn căn cứ: tìm văn bản trong kho, mục lục điều, khoản, điểm.
    route("can-cu", "routes/quan-tri.can-cu.tsx"),
    // Kho văn bản: thêm, sửa nội dung Markdown, xóa. URN có "/" nên trang sửa nhận URN qua ?urn=.
    route("van-ban", "routes/quan-tri.van-ban.tsx"),
    route("van-ban/moi", "routes/quan-tri.van-ban.sua.tsx", { id: "quan-tri-van-ban-moi" }),
    route("van-ban/sua", "routes/quan-tri.van-ban.sua.tsx"),
    // Chấm tự luận: hàng chấm của bài giảng và của đề thi, đổi qua lại bằng công tắc đầu trang.
    route("cham-tu-luan", "routes/quan-tri.cham-tu-luan.tsx"),
    route("cham-tu-luan/de-thi", "routes/quan-tri.cham-tu-luan.de-thi.tsx"),
    // Thi sát hạch (docs/PLAN.md GĐ6). "de-thi/moi" khai trước ":id".
    route("de-thi", "routes/quan-tri.de-thi.tsx"),
    route("de-thi/moi", "routes/quan-tri.de-thi.sua.tsx", { id: "quan-tri-de-thi-moi" }),
    route("de-thi/tu-pdf", "routes/quan-tri.de-thi.tu-pdf.tsx"),
    // Ma trận ở trang riêng: bước hai khi tạo đề ("moi/ma-tran"), hoặc sửa ma trận của đề đã có.
    route("de-thi/moi/ma-tran", "routes/quan-tri.de-thi.ma-tran.tsx", { id: "quan-tri-de-thi-moi-ma-tran" }),
    route("de-thi/:id/ma-tran", "routes/quan-tri.de-thi.ma-tran.tsx"),
    // Đường cũ của hàng chấm tự luận đề thi, chuyển sang "cham-tu-luan/de-thi"; khai trước ":id".
    route("de-thi/cham-tu-luan", "routes/quan-tri.de-thi.cham-tu-luan.tsx"),
    route("de-thi/:id", "routes/quan-tri.de-thi.sua.tsx"),
    route("giao-bai", "routes/quan-tri.giao-bai.tsx"),
    // Báo cáo (docs/PLAN.md GĐ7): danh sách cán bộ và báo cáo tổng hợp, tệp Excel/PDF tải qua
    // resource route. "can-bo/:id" là hồ sơ chi tiết của một cán bộ.
    route("bao-cao", "routes/quan-tri.bao-cao.tsx"),
    route("bao-cao/tai/:loai", "routes/quan-tri.bao-cao.tai.tsx"),
    route("bao-cao/can-bo/:id", "routes/quan-tri.bao-cao.can-bo.tsx"),
    route("bao-cao/can-bo/:id/tai", "routes/quan-tri.bao-cao.can-bo.tai.tsx"),
    // Nhóm học cùng (docs/PLAN.md GĐ16c): quản lý xem nhóm có thành viên trong phạm vi, lưu trữ nhóm.
    route("nhom", "routes/quan-tri.nhom.tsx"),
    route("nhom/:id", "routes/quan-tri.nhom.chi-tiet.tsx"),
    // Soạn bài giảng: chuyên đề → bài → khối nội dung. Đường tĩnh "moi", "tu-pdf" khai trước ":slug", ":id".
    route("chuyen-de", "routes/quan-tri.chuyen-de.tsx"),
    route("chuyen-de/moi", "routes/quan-tri.chuyen-de.sua.tsx", { id: "quan-tri-chuyen-de-moi" }),
    route("chuyen-de/tu-pdf", "routes/quan-tri.chuyen-de.tu-pdf.tsx"),
    route("chuyen-de/:slug", "routes/quan-tri.chuyen-de.sua.tsx"),
    route("chuyen-de/:slug/bai/moi", "routes/quan-tri.chuyen-de.bai.tsx", {
      id: "quan-tri-chuyen-de-bai-moi",
    }),
    route("chuyen-de/:slug/bai/:id", "routes/quan-tri.chuyen-de.bai.tsx"),
  ]),

  route("huong-dan", "routes/huong-dan._index.tsx"),
  route("huong-dan/:bai", "routes/huong-dan.bai.tsx"),

  route("dang-nhap", "routes/dang-nhap.tsx"),
  route("dang-ky", "routes/dang-ky.tsx"),
  route("dang-xuat", "routes/dang-xuat.tsx"),
  route("doi-mat-khau", "routes/doi-mat-khau.tsx"),
  route("tai-khoan", "routes/tai-khoan.tsx"),
  // Cầu nối API cho màn hình chạy phía client, chỉ các đường dẫn trong danh sách cho phép (GĐ13).
  route("api/*", "routes/api.$.tsx"),
  // Cầu nối giọng nói (docs/PLAN.md GĐ14): đọc thành tiếng, khớp lời nói, sách nói. Cụ thể hơn "api/*".
  route("api/giong-doc", "routes/api.giong-doc.$.tsx", { id: "api-giong-doc-goc" }),
  route("api/giong-doc/*", "routes/api.giong-doc.$.tsx"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
