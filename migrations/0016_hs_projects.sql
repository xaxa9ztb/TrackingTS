-- Hồ sơ Dự án (tools/tiendotm): thông tin đã nhập cho từng dự án (tiến độ & nghiệm thu, công văn – biên bản, hồ sơ pháp lý,
-- bìa & trang ký bản vẽ) lưu trên máy chủ để lần sau mở lại không phải nhập lại; bảng nhỏ, không thêm chỉ mục (ít lượt ghi).
CREATE TABLE IF NOT EXISTS hs_projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  wbs         TEXT NOT NULL DEFAULT '',
  name        TEXT NOT NULL DEFAULT '',
  customer    TEXT NOT NULL DEFAULT '',
  contract    TEXT NOT NULL DEFAULT '',
  data        TEXT NOT NULL DEFAULT '{}',
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT '',
  created_by  TEXT NOT NULL DEFAULT '',
  updated_at  TEXT NOT NULL DEFAULT '',
  updated_by  TEXT NOT NULL DEFAULT ''
);
