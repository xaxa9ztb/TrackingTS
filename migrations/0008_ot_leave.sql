-- Duyệt tăng ca (OT) theo NGÀY: fitter chấm công có giờ OT → một yêu cầu cho ngày đó, Site Sup duyệt hằng ngày.
-- sig = dấu vân tay các dòng chấm công của ngày (tools/timesheet/otleave.js · daySig): fitter sửa giờ sau khi duyệt → sig đổi → chờ duyệt lại.
-- Nộp bảng công: mọi ngày có OT phải có dòng ở đây với status = 'approved' và đúng sig.
CREATE TABLE ts_ot (
  emp_id       TEXT NOT NULL,
  date         TEXT NOT NULL,
  period       TEXT NOT NULL,
  ot           REAL NOT NULL DEFAULT 0,          -- số giờ tăng ca của ngày
  total        REAL NOT NULL DEFAULT 0,          -- tổng giờ của ngày
  sig          TEXT NOT NULL,
  wbs          TEXT NOT NULL DEFAULT '',         -- các WBS của ngày, cách nhau dấu phẩy (tìm người duyệt)
  detail       TEXT NOT NULL DEFAULT '[]',       -- JSON: giờ vào–ra, dự án, báo cáo thi công từng dòng (để người duyệt xem)
  status       TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  requested_at TEXT NOT NULL,
  decided_by   TEXT NOT NULL DEFAULT '',
  decided_at   TEXT NOT NULL DEFAULT '',
  note         TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (emp_id, date)
);
CREATE INDEX idx_ts_ot_status ON ts_ot (status, date);

-- Đơn nghỉ phép năm (6010) / ốm (6020) / không lương (6090): làm và được duyệt TRƯỚC ngày bắt đầu;
-- duyệt xong máy chủ tự ghi các dòng nghỉ vào bảng công (ts_docs) của fitter.
CREATE TABLE ts_leave (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  emp_id     TEXT NOT NULL,
  type       TEXT NOT NULL,
  date_from  TEXT NOT NULL,
  date_to    TEXT NOT NULL,
  days       TEXT NOT NULL DEFAULT '[]',        -- JSON [{date, half}] các ngày làm việc trong khoảng
  reason     TEXT NOT NULL DEFAULT '',
  wbs        TEXT NOT NULL DEFAULT '',          -- các dự án fitter đang làm lúc xin nghỉ (tìm người duyệt)
  status    TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected | cancelled
  created_at TEXT NOT NULL,
  decided_by TEXT NOT NULL DEFAULT '',
  decided_at TEXT NOT NULL DEFAULT '',
  note       TEXT NOT NULL DEFAULT '',
  written    TEXT NOT NULL DEFAULT ''           -- kết quả ghi vào bảng công, vd "2026-11: 3 dòng"
);
CREATE INDEX idx_ts_leave_emp ON ts_leave (emp_id, date_from);
CREATE INDEX idx_ts_leave_status ON ts_leave (status, date_from);
