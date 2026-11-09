-- Incentive (thưởng lắp đặt) — chỉ Admin. Scheme 'swat' (Installation Incentive Scheme); 'site' để sau.
-- Mỗi tháng (thường tháng lẻ) một ĐỢT chia thưởng / scheme. data = JSON toàn bộ đợt: các dự án (loại trả 70% / 100% /
-- final 30% / 20%, quỹ thưởng theo Scorecard, Standard Hour đã duyệt) + bảng chia cho từng người.
-- status: draft (đang làm) | done (đã chốt — tính vào lịch sử "đã trả"). source: app | import (tải từ file Excel kế toán).
CREATE TABLE inc_batches (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  scheme      TEXT NOT NULL DEFAULT 'swat',
  month       TEXT NOT NULL,
  title       TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'draft',
  source      TEXT NOT NULL DEFAULT 'app',
  data        TEXT NOT NULL DEFAULT '{"projects":[]}',
  total       REAL NOT NULL DEFAULT 0,
  n_projects  INTEGER NOT NULL DEFAULT 0,
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  created_by  TEXT NOT NULL DEFAULT '',
  updated_at  TEXT NOT NULL,
  updated_by  TEXT NOT NULL DEFAULT '',
  UNIQUE (scheme, month)
);
-- Từng khoản đã chia (ghi lại mỗi lần lưu đợt) — để biết dự án đã trả đợt nào, mỗi người đã nhận bao nhiêu
CREATE TABLE inc_lines (
  batch_id     INTEGER NOT NULL,
  wbs          TEXT NOT NULL,
  project_name TEXT NOT NULL DEFAULT '',
  kind         TEXT NOT NULL DEFAULT '',
  role         TEXT NOT NULL DEFAULT 'fitter',
  emp_id       TEXT NOT NULL DEFAULT '',
  name         TEXT NOT NULL DEFAULT '',
  amount       REAL NOT NULL DEFAULT 0,
  pct          REAL
);
CREATE INDEX idx_inc_lines_wbs ON inc_lines (wbs);
CREATE INDEX idx_inc_lines_batch ON inc_lines (batch_id);
