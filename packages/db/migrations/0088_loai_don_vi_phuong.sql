-- Bổ sung cho 0087: nhãn cấp cũ "Phường", "Đặc khu" (và "Xã, phường") cũng là đơn vị cấp xã.
-- 0087 chỉ nhận đúng chữ "Xã" nên các đơn vị này còn mang loại `khac`. Chỉ đổi dòng đang là
-- `khac` để không ghi đè loại quản trị viên đã chọn.

UPDATE units SET loai = 'xa'
WHERE loai = 'khac'
  AND lower(trim(level_label)) IN ('phường', 'đặc khu', 'xã, phường', 'xã, phường, đặc khu');
