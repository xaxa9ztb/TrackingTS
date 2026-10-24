# Timesheet cá nhân (chức năng của Bộ công cụ dự án)

GitHub Pages phục vụ thẳng các file **đã build** — người dùng không cần làm gì.

| File | Vai trò |
|---|---|
| `src/app.jsx` | **Mã nguồn** giao diện (React + JSX). Sửa ở đây. |
| `app.js` | Sinh tự động từ `src/app.jsx` — **đừng sửa tay** |
| `tailwind.css` | CSS Tailwind v3 sinh tự động từ các class trong mã nguồn |
| `ts-template.xlsx` | Mẫu bảng chấm công Schindler (trắng), chỉ tải khi bấm **Xuất Excel** |
| `index.html` | Trang; đăng nhập/phân quyền qua `../../js/session.js` |

## Giao diện (responsive)
| Màn hình | Bố cục |
|---|---|
| Máy tính ≥ 1024px | 2 cột: thẻ tổng hợp + **lịch kỳ lương** bên trái, **bảng** chấm công bên phải; form thêm/sửa là **ngăn trượt bên phải** |
| Tablet 768–1023px | Thẻ tổng hợp (2×2) cạnh lịch; danh sách thẻ theo ngày bên dưới |
| Điện thoại < 768px | Danh sách thẻ theo ngày, nút **+** nổi; form toàn màn hình |

- Mặc định mở **kỳ lương đang diễn ra** (16 tháng trước → 15 tháng này, chứa hôm nay); lưu một dòng thuộc kỳ khác thì tự chuyển sang kỳ đó.
- Lịch: số giờ mỗi ngày, ngày T2–T6 **chưa chấm** (chấm đỏ), ngày lễ, ngày có OT; bấm ngày trống để thêm, bấm ngày đã chấm để lọc.
- **Thông tin nhân viên** và **Dữ liệu dự án** luôn hiện ở đầu trang (không phải mở Cài đặt):
  sửa họ tên / mã NV / chức vụ / phòng ban ngay tại chỗ (bấm **Sửa**); thẻ dự án cho biết số dự án,
  lần đồng bộ gần nhất (`Cloud.getLastSyncedAt()`, dùng chung cho cả Bộ công cụ) và nút **Đồng bộ ngay**.
  Nút bánh răng chỉ còn **Sao lưu / Khôi phục / Xóa dữ liệu**.
- Xóa có **Hoàn tác** (thông báo dưới màn hình) thay cho hộp xác nhận.
- Dữ liệu (`ts_entries_v28`, `ts_profile_v28`, `ts_projects_v28`) và file Excel xuất ra **không đổi**.

## Sửa Timesheet
```bash
cd tools/timesheet
npm install        # lần đầu
# sửa src/app.jsx
npm run build      # cập nhật app.js + tailwind.css
```
Commit **cả** `src/app.jsx`, `app.js` và `tailwind.css`, rồi tăng `?v=` của `app.js` / `tailwind.css`
trong `index.html` để trình duyệt tải bản mới.

Vì sao build sẵn: trước đây trang tải Babel (~2,3 MB) để dịch JSX và Tailwind "play CDN" để sinh
CSS **ngay trên điện thoại** mỗi lần mở, cùng ExcelJS (~0,9 MB) và mẫu Excel nhúng trong HTML.
Nay chỉ tải phần cần để hiển thị; ExcelJS và mẫu Excel tải khi bấm Xuất Excel.
