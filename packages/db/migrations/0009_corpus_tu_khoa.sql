-- Ô khung theo LĨNH VỰC: danh mục của nguồn chỉ lọc được theo loại văn bản, nên muốn nạp
-- "toàn bộ văn bản về giao thông đường bộ" thì bước phát hiện phải lọc theo tiêu đề.
-- `tu_khoa`: mục được giữ khi tiêu đề chứa ÍT NHẤT MỘT từ khóa; `loai_tru`: bị bỏ khi
-- tiêu đề chứa BẤT KỲ từ nào. Ô không có từ khóa giữ nguyên hành vi cũ (lấy cả loại).
ALTER TABLE corpus_targets
  ADD COLUMN IF NOT EXISTS tu_khoa  text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS loai_tru text[] NOT NULL DEFAULT '{}';
