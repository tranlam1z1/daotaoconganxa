-- DATA ONLY: mã công chức cũ chuyển sang cong_chuc; công an không có nhóm thay thế.
-- Chỉ đổi các mảng nhóm. Không sửa vai trò, đơn vị, trạng thái hay lịch sử học.
-- Snapshot và cập nhật trong cùng transaction; chạy lại không đổi snapshot gốc.
BEGIN;
INSERT INTO audience_group_migration_history(entity_kind,entity_id,groups_before,groups_after)
SELECT 'account',a.id,a.nhom_doi_tuong,
 ARRAY(SELECT DISTINCT CASE g WHEN 'cong_chuc_cap_xa' THEN 'cong_chuc' ELSE g END
       FROM unnest(a.nhom_doi_tuong) AS g WHERE g <> 'cong_an_cap_xa' ORDER BY 1)
FROM accounts a WHERE a.nhom_doi_tuong && ARRAY['cong_an_cap_xa','cong_chuc_cap_xa']::text[]
ON CONFLICT DO NOTHING;
INSERT INTO audience_group_migration_history(entity_kind,entity_id,groups_before,groups_after)
SELECT 'course',c.id,c.nhom_hoc_tap,
 ARRAY(SELECT DISTINCT CASE g WHEN 'cong_chuc_cap_xa' THEN 'cong_chuc' ELSE g END
       FROM unnest(c.nhom_hoc_tap) AS g WHERE g <> 'cong_an_cap_xa' ORDER BY 1)
FROM courses c WHERE c.nhom_hoc_tap && ARRAY['cong_an_cap_xa','cong_chuc_cap_xa']::text[]
ON CONFLICT DO NOTHING;
UPDATE accounts a SET nhom_doi_tuong=h.groups_after
FROM audience_group_migration_history h
WHERE h.entity_kind='account' AND h.entity_id=a.id AND a.nhom_doi_tuong=h.groups_before;
UPDATE courses c SET nhom_hoc_tap=h.groups_after
FROM audience_group_migration_history h
WHERE h.entity_kind='course' AND h.entity_id=c.id AND c.nhom_hoc_tap=h.groups_before;
COMMIT;
