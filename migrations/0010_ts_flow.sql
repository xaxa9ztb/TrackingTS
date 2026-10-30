-- Quy trình duyệt bảng công 3 cấp: mọi dự án (WBS) trong bảng công phải được Site Sup rồi Quản lý dự án của dự án đó duyệt, sau đó Admin xử lý cuối.
-- ts_approvals: ai đã duyệt dự án nào ở cấp nào ('sitesup' | 'pm'); xoá hết khi bảng công bị trả lại / nộp lại.
-- Trạng thái ts_docs.status: draft → submitted (chờ Site Sup) → sitesup_ok (chờ QLDA) → pm_ok (chờ Admin xử lý) → approved; rejected = bị trả lại.
CREATE TABLE ts_approvals (
  emp_id  TEXT NOT NULL,
  period  TEXT NOT NULL,
  level   TEXT NOT NULL,
  wbs     TEXT NOT NULL,
  by_emp  TEXT NOT NULL DEFAULT '',
  by_name TEXT NOT NULL DEFAULT '',
  at      TEXT NOT NULL,
  PRIMARY KEY (emp_id, period, level, wbs)
);
ALTER TABLE ts_docs ADD COLUMN final_by TEXT NOT NULL DEFAULT '';
ALTER TABLE ts_docs ADD COLUMN final_at TEXT NOT NULL DEFAULT '';
