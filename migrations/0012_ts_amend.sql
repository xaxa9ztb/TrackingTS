-- Điều chỉnh bảng công đã nộp / đã duyệt (Timesheet cá nhân): fitter chấm trước các ngày cuối kỳ rồi thực tế thay đổi →
-- bấm "Điều chỉnh bảng công" (ghi lý do) để sửa lại cho đúng, rồi nộp lại qua đủ Site Sup → QLDA → Admin.
-- Trong lúc điều chỉnh, bảng Theo dõi giờ công vẫn giữ bản đã duyệt; duyệt xong bản điều chỉnh thì thay bằng bản mới.
--   amend_rev  : số lần điều chỉnh (lần 1, 2…)
--   amend_from : trạng thái lúc bắt đầu điều chỉnh ('approved', 'submitted'…); '' = không đang điều chỉnh
--   amend_note / amend_at / amend_by : lý do, thời điểm, người bấm
--   base_data  : bản bảng công lúc bắt đầu điều chỉnh (để người duyệt so ngày nào thay đổi; huỷ điều chỉnh thì khôi phục)
--   amend_since: ngày nộp bảng công lần đầu (giờ VN, giữ qua các lần điều chỉnh) — chỉ được điều chỉnh các ngày từ ngày này đến hết kỳ (ngày 15), tức các ngày đã chấm trước
ALTER TABLE ts_docs ADD COLUMN amend_rev INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ts_docs ADD COLUMN amend_from TEXT NOT NULL DEFAULT '';
ALTER TABLE ts_docs ADD COLUMN amend_note TEXT NOT NULL DEFAULT '';
ALTER TABLE ts_docs ADD COLUMN amend_at TEXT NOT NULL DEFAULT '';
ALTER TABLE ts_docs ADD COLUMN amend_by TEXT NOT NULL DEFAULT '';
ALTER TABLE ts_docs ADD COLUMN base_data TEXT NOT NULL DEFAULT '';
ALTER TABLE ts_docs ADD COLUMN amend_since TEXT NOT NULL DEFAULT '';
