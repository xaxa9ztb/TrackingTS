-- Đăng ký tài khoản: người đăng nhập (Cloudflare Access) bằng email chưa gắn với nhân viên nào
-- gửi yêu cầu (họ tên + mã NV); admin nhận email, duyệt → email được gắn vào nhân viên đó.
-- status: pending | approved | rejected. Mỗi email chỉ có một yêu cầu (gửi lại = cập nhật).
CREATE TABLE registrations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  full_name   TEXT NOT NULL,
  emp_id      TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'pending',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  notified_at TEXT NOT NULL DEFAULT '',
  decided_at  TEXT NOT NULL DEFAULT '',
  decided_by  TEXT NOT NULL DEFAULT '',
  decision_note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX registrations_status ON registrations (status, created_at);
