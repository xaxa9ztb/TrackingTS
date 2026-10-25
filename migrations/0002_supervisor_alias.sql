-- Ghi nhớ "tên giám sát ghi trong dự án" ↔ nhân viên, để lần nhập dữ liệu sau tự phân công đúng
-- (tên trong Yan_COM thường khác thứ tự / cách viết so với EE Data).
CREATE TABLE supervisor_alias (
  norm        TEXT PRIMARY KEY,                 -- tên đã bỏ dấu, chữ thường
  label       TEXT NOT NULL,                    -- cách viết gốc (để hiển thị)
  emp_id      TEXT NOT NULL REFERENCES employees(emp_id) ON DELETE CASCADE,
  updated_at  TEXT NOT NULL
);
