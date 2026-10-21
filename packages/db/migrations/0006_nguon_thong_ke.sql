-- Mẫu số của việc nạp kho: TỔNG số văn bản mỗi loại đang có ở nguồn, đếm trực tiếp từ
-- trang danh sách của nguồn. Có bảng này thì tiến độ mới trả lời được câu "còn bao nhiêu",
-- thay vì chỉ "đã nạp bao nhiêu" (ke-hoach/04 §7, ke-hoach/12 §2).
CREATE TABLE IF NOT EXISTS nguon_thong_ke (
  nguon       text NOT NULL,             -- congbao | vbpl | vanban-chinhphu
  loai        text NOT NULL,             -- slug loại văn bản ở nguồn: nghi-dinh, thong-tu…
  doc_type    text,                      -- mã loại nội bộ tương ứng: nd, tt… (để nối với kho)
  tong        int  NOT NULL,             -- tổng số văn bản đếm được ở nguồn
  so_trang    int,
  moi_trang   int,
  chinh_xac   boolean NOT NULL DEFAULT true,
  cap_nhat_luc timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (nguon, loai)
);
