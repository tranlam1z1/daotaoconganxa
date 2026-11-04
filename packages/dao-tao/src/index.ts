/**
 * Gói miền của mô-đun đào tạo (ke-hoach/09-a).
 *
 * Chỉ chứa luật thuần: kiểu khối, chấm bài, mức thành thạo, lịch ôn, lộ trình, thống kê.
 * Không chạm CSDL và không gọi mạng, nên chạy được trong test, trong worker và trong API
 * mà không cần dựng gì.
 */
export * from "./bien-bao.ts";
export * from "./blocks.ts";
export * from "./cau-hoi.ts";
export * from "./cham-tu-luan.ts";
export * from "./de-thi.ts";
export * as diaGioi from "./dia-gioi.ts";
export * from "./grading.ts";
export * from "./hanh-van.ts";
export * from "./hau-kiem-bai-hoc.ts";
export * from "./hau-kiem-cau-hoi.ts";
export * from "./hau-kiem-nhom-hoc.ts";
export * from "./ho-so-chu-de.ts";
export * from "./khop-loi-noi.ts";
export * from "./lich-nhac.ts";
export * from "./luat-tai-lieu.ts";
export * from "./luyen-tap.ts";
export * from "./mastery.ts";
export * from "./ngay.ts";
export * from "./nhom-doi-tuong.ts";
export * from "./nhom-hoc.ts";
export * from "./path.ts";
export * as ranhGioi from "./ranh-gioi.ts";
export * from "./sach-noi.ts";
export * from "./srs.ts";
export * from "./stats.ts";
export * from "./tai-trong.ts";
export * from "./tra-cuu-nhanh.ts";
export * from "./types.ts";
export * from "./vong-doi-duyet.ts";
