-- Nộp và duyệt bảng công (Timesheet cá nhân): trạng thái đã có ở ts_docs.status; thêm ai duyệt / lý do trả lại.
ALTER TABLE ts_docs ADD COLUMN submitted_at TEXT NOT NULL DEFAULT '';
ALTER TABLE ts_docs ADD COLUMN sitesup_by TEXT NOT NULL DEFAULT '';
ALTER TABLE ts_docs ADD COLUMN sitesup_at TEXT NOT NULL DEFAULT '';
ALTER TABLE ts_docs ADD COLUMN pm_by TEXT NOT NULL DEFAULT '';
ALTER TABLE ts_docs ADD COLUMN pm_at TEXT NOT NULL DEFAULT '';
ALTER TABLE ts_docs ADD COLUMN note TEXT NOT NULL DEFAULT '';

-- Các dự án (WBS) có trong bảng công đã nộp: để biết Site Sup / Quản lý dự án nào phải duyệt
CREATE TABLE ts_doc_wbs (
  emp_id TEXT NOT NULL,
  period TEXT NOT NULL,
  wbs    TEXT NOT NULL,
  PRIMARY KEY (emp_id, period, wbs)
);

-- Dòng của bảng Theo dõi giờ công do duyệt bảng công đẩy sang có src = 'ts:<mã NV>:<kỳ>' (dòng nhập từ Excel: src rỗng)
ALTER TABLE timesheets ADD COLUMN src TEXT NOT NULL DEFAULT '';
CREATE INDEX idx_timesheets_emp_date ON timesheets (batch, emp_id, date);
