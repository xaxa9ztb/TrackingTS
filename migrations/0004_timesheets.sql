-- Bảng công đã nhập cho Thống kê giờ công (dòng dạng JSON như trong trình duyệt, kèm vài cột để lọc).
-- Nạp theo "đợt" (batch): đợt mới được ghi riêng rồi chuyển sang "đang dùng" một lần (nguyên tử), nên người xem
-- không bao giờ thấy dữ liệu dở dang. Đợt đang dùng + số phiên bản nằm trong kv_store (khoá 'timesheets_meta').
CREATE TABLE timesheets (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  batch   INTEGER NOT NULL,
  emp_id  TEXT NOT NULL,
  date    TEXT NOT NULL,
  wbs     TEXT NOT NULL DEFAULT '',
  data    TEXT NOT NULL
);
