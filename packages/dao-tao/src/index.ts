/**
 * Gói miền của mô-đun đào tạo (ke-hoach/09-a).
 *
 * Chỉ chứa luật thuần: kiểu khối, chấm bài, mức thành thạo, lịch ôn, lộ trình, thống kê.
 * Không chạm CSDL và không gọi mạng, nên chạy được trong test, trong worker và trong API
 * mà không cần dựng gì.
 */
export * as banDo from "./ban-do/index.ts";
export * from "./bien-bao.ts";
export * from "./blocks.ts";
export * from "./cau-hoi.ts";
export * from "./cham-tu-luan.ts";
export * from "./de-thi.ts";
export * as diaGioi from "./dia-gioi.ts";
export * from "./diem-thuong.ts";
export * from "./grading.ts";
export * from "./hanh-van.ts";
export * from "./hau-kiem-bai-hoc.ts";
export * from "./hau-kiem-cau-hoi.ts";
export * from "./hau-kiem-nhom-hoc.ts";
export * from "./ho-so-chu-de.ts";
export * from "./khop-loi-noi.ts";
export * from "./lich-nhac.ts";
export * from "./luyen-tap.ts";
export * from "./mastery.ts";
export * as moPhong from "./mo-phong/index.ts";
export * from "./mua-giai.ts";
export * from "./nhom-hoc.ts";
export * from "./path.ts";
export * as ranhGioi from "./ranh-gioi.ts";
export * from "./sach-noi.ts";
export * from "./srs.ts";
export * from "./stats.ts";
export * from "./tham-chieu.ts";
export * from "./tra-cuu-nhanh.ts";
export * from "./tro-choi/cam-bien.ts";
export * from "./tro-choi/chot-dem.ts";
export * from "./tro-choi/chung/bien-ban.ts";
export * from "./tro-choi/chung/giay-to.ts";
export * from "./tro-choi/chung/man-choi.ts";
export * as nhatKy from "./tro-choi/chung/nhat-ky.ts";
export * from "./tro-choi/cung-duong-bien-bao.ts";
export * from "./tro-choi/dang-ky.ts";
export * from "./tro-choi/doan-bien-bao.ts";
export * from "./tro-choi/dua-thoi-gian.ts";
export * from "./tro-choi/dung-xe.ts";
export * from "./tro-choi/duyet-phat-nguoi.ts";
export * from "./tro-choi/duyet-phat-nguoi-kiem.ts";
export * from "./tro-choi/ghep-cap-muc-phat.ts";
export * from "./tro-choi/hinh-xe-tham-so.ts";
export * from "./tro-choi/hoi-nhanh-giong-noi.ts";
export * from "./tro-choi/khung.ts";
export * from "./tro-choi/kiem-tra-giay-to.ts";
export * from "./tro-choi/lap-bien-ban.ts";
export * from "./tro-choi/len-xe-khach.ts";
export * from "./tro-choi/len-xe-khach-kiem.ts";
export * from "./tro-choi/soi-camera.ts";
export * from "./tro-choi/soi-xe-cai-tao.ts";
export * from "./tro-choi/soi-xe-cai-tao-kiem.ts";
export * from "./tro-choi/sung-ban-toc-do.ts";
export * from "./tro-choi/tai-dung.ts";
export * from "./tro-choi/thu-nghiem.ts";
export * from "./tro-choi/tram-can.ts";
export * from "./tro-choi/tram-can-kiem.ts";
export * from "./tro-choi/truy-vet.ts";
export * from "./tro-choi/tu-lai.ts";
export * as tuLaiPho from "./tro-choi/tu-lai-pho.ts";
export * from "./tro-choi/vuot-man.ts";
export * from "./tro-choi/xp.ts";
export * from "./types.ts";
export * from "./vong-doi-duyet.ts";
