-- Máy chủ Cloudflare (D1) — giai đoạn 2: nhân viên, dự án, phân công dự án, nhật ký.
-- Chỉ lưu dữ liệu cần cho công việc: KHÔNG lưu ngày sinh, giới tính, CCCD, BHXH.

CREATE TABLE employees (
  emp_id        TEXT PRIMARY KEY,
  full_name     TEXT NOT NULL,
  position      TEXT NOT NULL DEFAULT '',
  supervisor    TEXT NOT NULL DEFAULT '',
  -- email đăng nhập (Cloudflare Access); admin gắn tay, mỗi email một người
  email         TEXT UNIQUE COLLATE NOCASE,
  -- '' = theo chức danh; 'admin' | 'pm' | 'sitesup' | 'staff' = admin chỉnh tay
  role_override TEXT NOT NULL DEFAULT '' CHECK (role_override IN ('', 'admin', 'pm', 'sitesup', 'staff')),
  active        INTEGER NOT NULL DEFAULT 1,
  updated_at    TEXT NOT NULL
);

CREATE TABLE projects (
  wbs           TEXT PRIMARY KEY,
  project_name  TEXT NOT NULL DEFAULT '',
  project_number TEXT NOT NULL DEFAULT '',
  product_line  TEXT NOT NULL DEFAULT '',
  customer      TEXT NOT NULL DEFAULT '',
  supervisor    TEXT NOT NULL DEFAULT '',
  -- các trường còn lại của dự án (thông số thang…) giữ nguyên dạng JSON
  extra         TEXT NOT NULL DEFAULT '{}',
  updated_at    TEXT NOT NULL
);

-- Site Sup / Quản lý dự án phụ trách từng dự án (dùng cho luồng duyệt)
CREATE TABLE project_staff (
  wbs     TEXT NOT NULL REFERENCES projects(wbs) ON DELETE CASCADE,
  emp_id  TEXT NOT NULL REFERENCES employees(emp_id) ON DELETE CASCADE,
  role    TEXT NOT NULL CHECK (role IN ('sitesup', 'pm')),
  PRIMARY KEY (wbs, emp_id, role)
);
CREATE INDEX project_staff_emp ON project_staff(emp_id);

-- Ai sửa gì, lúc nào, giá trị cũ / mới
CREATE TABLE audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  at         TEXT NOT NULL,
  actor      TEXT NOT NULL,
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  TEXT NOT NULL DEFAULT '',
  before     TEXT,
  after      TEXT
);
CREATE INDEX audit_log_at ON audit_log(at);
