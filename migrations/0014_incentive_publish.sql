-- Phát hành đợt thưởng: sau khi Admin chốt và bấm "Phát hành", người được chia thưởng nhận email và xem được tiền thưởng
-- CỦA MÌNH (theo từng dự án + báo cáo SWAT của dự án) trong trang "Thưởng của tôi". Chưa phát hành thì người dùng không thấy.
ALTER TABLE inc_batches ADD COLUMN published_at TEXT NOT NULL DEFAULT '';
ALTER TABLE inc_batches ADD COLUMN published_by TEXT NOT NULL DEFAULT '';
CREATE INDEX idx_inc_lines_emp ON inc_lines (emp_id);
