/** Kiểm kê chỉ đọc; không in tên/email người dùng, không tự gán nhóm hoặc xuất bản. */
import { sql } from "../packages/db/src/client.ts";

try {
  const [db] = await sql`SELECT current_database() AS name`;
  const [accounts, courses, fields] = await Promise.all([
    sql`SELECT nhom_doi_tuong AS nhom, count(*)::int AS so_luong
        FROM accounts WHERE NOT la_khach GROUP BY nhom_doi_tuong ORDER BY nhom_doi_tuong`,
    sql`SELECT c.slug,c.title,c.status,c.nhom_hoc_tap AS nhom,f.slug AS linh_vuc,
        c.as_of,(SELECT count(*)::int FROM lessons l WHERE l.course_id=c.id) AS so_bai
        FROM courses c LEFT JOIN fields f ON f.id=c.field_id ORDER BY c.slug`,
    sql`SELECT slug,name,status FROM fields ORDER BY ordinal,name`,
  ]);
  const needsReview = courses.map((c) => ({
    ...c,
    ly_do_ra_soat: [
      ...(c.nhom.length ? [] : ["Chưa phân nhóm"]),
      ...(c.linh_vuc ? [] : ["Chưa gắn lĩnh vực"]),
      ...(/giao thông|biển báo|nồng độ cồn|giấy phép lái xe|tải trọng/i.test(c.title)
        ? ["Tiêu đề có dấu hiệu chuyên ngành giao thông; cần người biên tập xác định phạm vi"]
        : []),
      ...(c.so_bai ? [] : ["Chưa có bài học"]),
    ],
  }));
  console.log(
    JSON.stringify(
      {
        database: db?.name,
        generated_at: new Date().toISOString(),
        tai_khoan_theo_nhom: accounts,
        linh_vuc: fields,
        chuyen_de: needsReview,
        luu_y:
          "Dấu hiệu từ tiêu đề chỉ phục vụ rà soát; báo cáo không thay thế việc duyệt nội dung và căn cứ.",
      },
      null,
      2,
    ),
  );
} finally {
  await sql.end();
}
