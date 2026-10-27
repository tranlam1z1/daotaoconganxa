-- DATA ONLY: chỉ chuyên đề đã đối chiếu cả slug và tiêu đề trong kiểm kê đợt 2.
-- Không dùng từ khóa để tự lưu trữ các chuyên đề khác. Không xóa bài, ghi danh hoặc tiến độ.
-- Nhật ký giữ trạng thái/nhóm trước chuyển đổi; không xử lý lại bản ghi đã được người biên tập mở lại.
BEGIN;
WITH reviewed AS MATERIALIZED (
 SELECT id,status,nhom_hoc_tap FROM courses
 WHERE slug='thong-tu-13-2025-tt-bca-sua-doi-bo-sung-mot-so-dieu-cua-cac-thong-tu-q'
 AND title='Thông tư 13/2025/TT-BCA: Sửa đổi, bổ sung một số điều của các thông tư quy định về trật tự, an toàn giao thông đường bộ, đường sắt và đường thủy nội địa'
 AND status <> 'luu_tru'
 AND NOT EXISTS(SELECT 1 FROM audit_log a WHERE a.action='dao_tao.chuyen_de.ngung_pham_vi_dot_2' AND a.target=courses.id::text)
 FOR UPDATE
), logged AS (
 INSERT INTO audit_log(actor,action,target,detail)
 SELECT 'migration:0082','dao_tao.chuyen_de.ngung_pham_vi_dot_2',id::text,
 jsonb_build_object('trang_thai_truoc',status,'nhom_truoc',nhom_hoc_tap,'trang_thai_sau','luu_tru',
 'ly_do','Chuyên đề giao thông đã rà soát, ngoài phạm vi ba nhóm của sản phẩm')
 FROM reviewed RETURNING target
)
UPDATE courses c SET status='luu_tru',updated_at=now() FROM logged WHERE c.id::text=logged.target;
COMMIT;
