-- Ngày vào làm / bắt đầu (Thống kê giờ công dùng; trước đây nằm trong file Drive công khai, không thuộc nhóm nhạy cảm)
ALTER TABLE employees ADD COLUMN hire_date TEXT NOT NULL DEFAULT '';
ALTER TABLE employees ADD COLUMN start_date TEXT NOT NULL DEFAULT '';

-- Kho dữ liệu chung dạng khoá → JSON có số phiên bản (Quản lý dự án: điều phối fitter + lịch trình)
CREATE TABLE kv_store (
  key       TEXT PRIMARY KEY,
  version   INTEGER NOT NULL DEFAULT 0,
  data      TEXT,
  saved_at  TEXT NOT NULL DEFAULT '',
  saved_by  TEXT NOT NULL DEFAULT ''
);
