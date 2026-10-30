-- Admin / Admin dự án sửa bảng công của người khác: ghi lại ai sửa, lúc nào, ghi chú gì (người chủ bảng công thấy trong Timesheet).
-- Chi tiết từng lần sửa nằm ở nhật ký (audit_log); đây là lần sửa gần nhất.
ALTER TABLE ts_docs ADD COLUMN admin_by TEXT NOT NULL DEFAULT '';
ALTER TABLE ts_docs ADD COLUMN admin_at TEXT NOT NULL DEFAULT '';
ALTER TABLE ts_docs ADD COLUMN admin_note TEXT NOT NULL DEFAULT '';

-- Vai trò "Admin dự án": cột riêng (role_override có ràng buộc CHECK không đổi được an toàn). extra_role = '' | 'projadmin'.
ALTER TABLE employees ADD COLUMN extra_role TEXT NOT NULL DEFAULT '';
