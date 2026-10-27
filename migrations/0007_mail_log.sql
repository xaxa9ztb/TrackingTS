-- Nhật ký thư tự động (báo cáo tối, nhắc hạn): mỗi thư một khoá, để chạy lại lịch không gửi trùng.
CREATE TABLE mail_log (
  key     TEXT PRIMARY KEY,
  sent_at TEXT NOT NULL
);
