# Timesheet cá nhân (chức năng của Bộ công cụ dự án)

GitHub Pages phục vụ thẳng các file **đã build** — người dùng không cần làm gì.

| File | Vai trò |
|---|---|
| `src/app.jsx` | **Mã nguồn** giao diện (React + JSX). Sửa ở đây. |
| `app.js` | Sinh tự động từ `src/app.jsx` — **đừng sửa tay** |
| `tailwind.css` | CSS Tailwind v3 sinh tự động từ các class trong mã nguồn |
| `ts-template.xlsx` | Mẫu bảng chấm công Schindler (trắng), chỉ tải khi bấm **Xuất Excel** |
| `index.html` | Trang; đăng nhập/phân quyền qua `../../js/session.js` |

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
