-- DATA ONLY: khung biên soạn, không phải nội dung pháp lý đã duyệt.
-- Chạy lại không ghi đè nội dung đã được biên tập (ON CONFLICT DO NOTHING).
BEGIN;
INSERT INTO fields(slug,name,summary,audience_note,ordinal,status) VALUES
 ('cong-vu-hanh-chinh','Công vụ và hành chính','Danh mục biên soạn về công vụ, thẩm quyền, thủ tục hành chính, văn thư, tiếp công dân và đánh giá.','Công chức',10,'nhap'),
 ('nghiep-vu-vien-chuc','Nghiệp vụ viên chức','Danh mục biên soạn về vị trí việc làm, hợp đồng, chức danh, đạo đức nghề nghiệp và bồi dưỡng theo ngành.','Viên chức',20,'nhap'),
 ('cong-tac-dang','Công tác Đảng','Danh mục biên soạn về sinh hoạt chi bộ, công tác đảng viên, kiểm tra và giám sát.','Đảng viên',30,'nhap')
ON CONFLICT(slug) DO NOTHING;
INSERT INTO courses(slug,title,summary,as_of,status,nhom_hoc_tap,field_id,tags)
SELECT v.slug,v.title,'Khung biên soạn. Chưa có bài học và chưa được duyệt nội dung, nguồn hoặc thời điểm áp dụng.','2026-10-27'::date,'nhap',ARRAY[v.nhom],f.id,ARRAY['khung-bien-soan-ba-nhom']
FROM (VALUES
 ('cong-chuc-cong-vu-va-xu-ly-cong-viec','Công vụ và xử lý công việc hành chính','cong_chuc','cong-vu-hanh-chinh'),
 ('vien-chuc-vi-tri-va-dao-duc-nghe-nghiep','Vị trí việc làm và đạo đức nghề nghiệp của viên chức','vien_chuc','nghiep-vu-vien-chuc'),
 ('dang-vien-sinh-hoat-va-cong-tac-dang','Sinh hoạt chi bộ và công tác đảng viên','dang_vien','cong-tac-dang')
) AS v(slug,title,nhom,field_slug)
JOIN fields f ON f.slug=v.field_slug
ON CONFLICT(slug) DO NOTHING;
COMMIT;
