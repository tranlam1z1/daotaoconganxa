-- 0071: Bỏ ký hiệu Markdown khỏi nodes.text_plain của các nút đã lưu.
--
-- plainText() (packages/legal-model) trước đây giữ nguyên ký hiệu trích dẫn "> " và chữ đậm "**" của
-- Markdown, nên đoạn trích kết quả tìm kiếm lộ "> >". Hàm đã sửa cho nút lưu mới; migration này sửa
-- các nút đã có bằng cùng phép thay. Cột tsv không cần dựng lại: các ký hiệu này không sinh từ khóa.
--
-- Chạy lại được: lần sau không còn dòng nào khớp.

UPDATE nodes
SET text_plain = btrim(regexp_replace(regexp_replace(regexp_replace(text_plain,
      '^[ \t]*(?:>[ \t]*)+', '', 'gn'),
      '(?:[ \t]+>){2,}[ \t]+', ' ', 'g'),
      '\*\*', '', 'g'), E' \t\n\r')
WHERE text_plain ~ '(^|\n)[ \t]*>' OR text_plain ~ '[ \t]>[ \t]+>' OR text_plain LIKE '%**%';
