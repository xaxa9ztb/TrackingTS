-- Khảo sát Bracket › Tra dung sai: ID đặt hàng + ghi chú cho từng loại bracket, và bản vẽ đính kèm theo loại.
-- ID đặt hàng: Admin / Quản lý dự án / Admin dự án sửa (có nhật ký). Bản vẽ: mọi người dùng đăng nhập đính kèm;
-- người đính kèm hoặc Admin xoá. File lưu thành các khúc ≤ 1 MB (D1 giới hạn kích thước một giá trị).
CREATE TABLE IF NOT EXISTS bracket_info (
  name        TEXT PRIMARY KEY,
  order_id    TEXT NOT NULL DEFAULT '',
  note        TEXT NOT NULL DEFAULT '',
  updated_at  TEXT NOT NULL DEFAULT '',
  updated_by  TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS bracket_files (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  bracket     TEXT NOT NULL,
  file_name   TEXT NOT NULL DEFAULT '',
  mime        TEXT NOT NULL DEFAULT 'application/octet-stream',
  size        INTEGER NOT NULL DEFAULT 0,
  chunks      INTEGER NOT NULL DEFAULT 0,
  owner_key   TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT '',
  created_by  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS bracket_files_bracket ON bracket_files (bracket);
CREATE TABLE IF NOT EXISTS bracket_file_chunks (
  file_id     INTEGER NOT NULL,
  seq         INTEGER NOT NULL,
  data        BLOB NOT NULL,
  PRIMARY KEY (file_id, seq)
);
