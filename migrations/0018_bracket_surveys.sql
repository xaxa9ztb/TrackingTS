-- Khảo sát Bracket hố thang (tools/bracket): phiếu lưu trên máy chủ để mọi người cùng xem.
-- Sửa / xoá: người tạo phiếu (owner_key: 'emp:<mã NV>' hoặc email) và Admin; người khác chỉ xem.
CREATE TABLE IF NOT EXISTS bracket_surveys (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  cid         TEXT NOT NULL DEFAULT '',        -- mã phiếu phía trình duyệt (giữ link #… cũ, chống đưa lên trùng)
  project     TEXT NOT NULL DEFAULT '',
  lift_id     TEXT NOT NULL DEFAULT '',
  survey_date TEXT NOT NULL DEFAULT '',
  data        TEXT NOT NULL DEFAULT '{}',
  version     INTEGER NOT NULL DEFAULT 1,
  owner_key   TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT '',
  created_by  TEXT NOT NULL DEFAULT '',
  updated_at  TEXT NOT NULL DEFAULT '',
  updated_by  TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS bracket_surveys_cid ON bracket_surveys (cid) WHERE cid <> '';
