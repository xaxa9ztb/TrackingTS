-- Hồ sơ Dự án: phân quyền sửa. Admin / Quản lý dự án / Admin dự án sửa mọi hồ sơ; Site Sup sửa hồ sơ mình tạo
-- (owner_email: 'emp:<mã NV>' hoặc email), hồ sơ của người khác chỉ xem — trừ khi Admin cấp quyền (editors: mảng email JSON).
ALTER TABLE hs_projects ADD COLUMN owner_email TEXT NOT NULL DEFAULT '';
ALTER TABLE hs_projects ADD COLUMN editors TEXT NOT NULL DEFAULT '[]';
