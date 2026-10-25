-- Timesheet cá nhân trên máy chủ: mỗi người một "bảng công" cho mỗi kỳ lương (16 tháng trước → 15 tháng này).
-- period = 'YYYY-MM' của tháng KẾT THÚC kỳ (như app: kỳ 16/10–15/11 là '2026-11').
-- data = JSON {entries:[…dòng chấm công + báo cáo thi công…], deleted:{id: thời điểm xoá}}; version dùng để chống ghi đè khi
-- sửa trên hai máy; status: draft (đang chấm) | submitted | sitesup_ok | approved | rejected — duyệt ở giai đoạn sau.
CREATE TABLE ts_docs (
  emp_id      TEXT NOT NULL,
  period      TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  status      TEXT NOT NULL DEFAULT 'draft',
  data        TEXT NOT NULL DEFAULT '{}',
  entry_count INTEGER NOT NULL DEFAULT 0,
  saved_at    TEXT NOT NULL,
  saved_by    TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (emp_id, period)
);
