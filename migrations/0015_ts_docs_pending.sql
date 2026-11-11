-- Hộp "chờ duyệt" (gọi mỗi lần mở trang chủ của Site Sup / QLDA / Admin) và mail nhắc lọc ts_docs theo status IN ('submitted','sitesup_ok','pm_ok').
-- Không có chỉ mục → quét toàn bộ bảng (cả các kỳ lịch sử đã duyệt) mỗi lần → tốn lượt đọc D1.
-- Chỉ mục MỘT PHẦN: chỉ chứa bảng công đang chờ duyệt → nhỏ, gần như không tốn thêm lượt ghi.
CREATE INDEX IF NOT EXISTS idx_ts_docs_pending ON ts_docs (status, submitted_at) WHERE status IN ('submitted', 'sitesup_ok', 'pm_ok');
