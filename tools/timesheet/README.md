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

## Ngày lễ & giờ làm thêm (tự động — `labor.js`)
Căn cứ: Bộ luật Lao động 2019 (Điều 98, 105, 106, 111, 112), Nghị định 145/2020 (Điều 57),
Nghị quyết 28/2026/QH16 (24/11 — Ngày Văn hóa Việt Nam, nghỉ hưởng nguyên lương từ 2026).

**Ngày nghỉ lễ, Tết** tự tính cho mọi năm (âm lịch theo múi giờ Việt Nam):
Tết Dương lịch 1/1 · Tết Âm lịch 5 ngày (mặc định: ngày cuối năm âm + mùng 1–4) · Giỗ Tổ 10/3 âm lịch ·
30/4 · 1/5 · Quốc khánh 2/9 + 1 ngày liền kề (các năm đã công bố ghi trong `NATIONAL_DAY_EXTRA`) · 24/11 (từ 2026).
Ngày lễ trùng **ngày nghỉ hằng tuần** → **nghỉ bù** ngày làm việc kế tiếp (cũng tính như ngày lễ).
Lịch hiện các ngày lễ của kỳ lương.

**Chia giờ công** (dòng mới mặc định *Tự tính theo Luật Lao động*):

| Thời điểm làm việc | Ngày thường | Ngày nghỉ hằng tuần | Ngày lễ / nghỉ bù |
|---|---|---|---|
| Giờ hành chính 08:00–12:00, 13:00–17:00 | Giờ thường (tối đa 8 giờ/ngày) | OT2 · 200% | OT3 · 300% |
| Ban ngày ngoài giờ (06:00–08:00, 12:00–13:00 nếu không nghỉ, 17:00–22:00) | OT1 · 150% | OT2 · 200% | OT3 · 300% |
| Ban đêm 22:00–06:00 hôm sau | OT4 · 200% — hoặc **OT7 · 210%** nếu hôm đó đã làm thêm ban ngày | OT5 · 270% | OT6 · 390% |

- Ca đêm 22:00–06:00 thuộc về **ngày bắt đầu** ca (như mẫu: "22:00 – 6:00 hôm sau – ngày CN / lễ").
- **Nghỉ (giờ)** tự gợi ý 1 khi ca đi qua 12:00–13:00; giờ nghỉ trừ vào giờ trưa trước.
- **Lịch làm việc** (thẻ Thông tin nhân viên → Sửa): *T2–T6 + sáng T7* (mặc định, như trước) · *T2–T6* · *T2–T7*
  — quyết định ngày nghỉ hằng tuần (OT2 / OT5) và ngày nghỉ bù.
- Mã nghỉ phép / ốm / không lương (6010, 6020, 6090): không tính làm thêm giờ.
- Một dòng có thể vừa giờ thường vừa nhiều loại OT → Excel ghi đúng từng cột G, I..O; cột *Check* vẫn = 0
  (công thức dùng `MOD(F-E,1)` nên ca qua nửa đêm cũng đúng).
- Dòng đã lưu trước bản này (không có `otMode`) **giữ nguyên** loại giờ đã chọn; mở ra tick *Tự tính* để tính lại.
  Bỏ tick để tự chọn một loại giờ cho cả dòng như trước.
- Doanh nghiệp chọn phương án nghỉ Tết khác (ví dụ 2 ngày trước + 3 ngày sau Tết): sửa `statutoryHolidays()` trong `labor.js`.
- Kiểm thử quy tắc: `node` chạy trực tiếp được `labor.js` (`module.exports`).

## Báo cáo tổng quan (cho giám sát)
Nút **Báo cáo** trên thanh trên → trang A4 của kỳ lương đang xem; **In / Lưu PDF** (in của trình duyệt, dùng được
ngoại tuyến) để gửi giám sát. Vừa 1 trang A4 dọc (kỳ có nhiều hơn khoảng 4 dự án thì phần ký tên có thể sang trang 2); tên file PDF gợi ý `Bao_cao_tong_quan_<tên>_Thang_MM_YYYY`.
- Số liệu chính: tổng giờ làm việc (không tính nghỉ) và số ngày làm việc, giờ thường, tăng ca (% tổng),
  số ngày / giờ nghỉ, ngày T2–T6 chưa chấm.
- Biểu đồ giờ theo ngày (giờ thường xanh, tăng ca cam, vạch 8 giờ; nền ngày lễ / ngày nghỉ hằng tuần; P = nghỉ;
  chấm đỏ = chưa chấm; rê chuột để xem số giờ).
- Theo dự án (ngày, giờ thường, OT, tổng, tỷ lệ) · theo hoạt động (mã công việc, tỷ lệ) và theo nhóm (NI, MOD, EI…).
- Giờ công theo loại (hệ số, giờ, tỷ lệ, **giờ quy đổi** theo hệ số) · nghỉ theo loại (6010 / 6020 / 6090, ngày nào)
  · ngày lễ trong kỳ · ô ký *Người lao động* / *Giám sát (PM / PE) xác nhận*.
- Mã nghỉ phép / ốm / không lương **không** tính vào giờ làm việc và tỷ lệ hoạt động.

## Lộ trình kỳ lương (Gantt)
Thẻ **Lộ trình kỳ lương (Gantt)** nằm ngay dưới thông tin nhân viên (thu gọn / mở, nhớ lựa chọn trên máy) và cũng là mục
**Lộ trình trong kỳ** trong **Báo cáo** nộp cuối kỳ — để người chấm công và giám sát nhìn cả kỳ 16 → 15 trong một hình.
- Mỗi **dự án** một hàng (sắp theo ngày bắt đầu, mỗi dự án một màu), mỗi **ngày làm** một ô ghi số giờ; vạch cam dưới ô = có tăng ca.
- Các ngày làm cách nhau chỉ bằng ngày nghỉ hằng tuần / lễ được **nối liền** thành một đoạn; ngày chưa chấm (chấm đỏ) thì không nối.
- Hàng **Nghỉ phép / ốm** riêng (mã 6010 / 6020 / 6090, không tính vào giờ làm).
- Trong **Báo cáo** biểu đồ thu gọn (mỗi dự án một dòng chữ) để vẫn vừa trang A4.
- Hơn 10 dự án trong kỳ: 9 dự án đầu hiện riêng, phần còn lại gộp thành hàng "N dự án khác" để báo cáo vẫn gọn.
- Trên trang chính, bấm một ô để lọc danh sách chấm công theo ngày đó. Rê chuột / chạm giữ để xem giờ thường, giờ tăng ca.
- Điện thoại: biểu đồ cuộn ngang trong khung, trang không bị tràn.
- Mã: `buildGantt()` + `GanttChart` trong `src/app.jsx` (dùng chung số liệu với `buildReport()`).

## Gửi mail cho giám sát
Nút **Gửi mail** (cạnh Xuất Excel) mở ngăn *Gửi bảng công cho giám sát*:
- **Gửi đến / CC**: email giám sát, quản lý (nhớ cho lần sau); gợi ý tên giám sát theo EE Data.
- **Tiêu đề / Nội dung** soạn sẵn theo số liệu kỳ (tổng giờ, giờ thường, OT từng loại, nghỉ, dự án, ngày chưa chấm);
  sửa được, có nút *Soạn lại*. File bảng chấm công Excel của kỳ được tạo sẵn để đính kèm.
- Cách gửi (web tĩnh không tự gửi thư được, nên mở ứng dụng mail đã điền sẵn):
  - **Gửi kèm file Excel** — chỉ hiện khi máy hỗ trợ chia sẻ file (điện thoại, Windows, Mac): bảng chia sẻ → chọn
    Gmail / Outlook, **file đã đính kèm sẵn**; địa chỉ giám sát được chép sẵn để dán vào ô Người nhận.
  - **Outlook / ứng dụng mail trên máy** (`mailto:`), **Gmail (web)**, **Outlook web** (Office 365): thư điền sẵn
    người nhận, tiêu đề, nội dung; file Excel **tự tải về** để người dùng đính kèm (trình duyệt không cho tự đính kèm).
- Link `mailto:` giữ dưới ~1900 ký tự (Outlook cắt link dài): nội dung quá dài thì bỏ danh sách dự án (đã có trong file).

## Ngày trong file Excel
Ngày ghi vào Excel phải tạo bằng `excelDate(y, m, d)` (= `Date.UTC`), **không** dùng `new Date(y, m-1, d)`:
ExcelJS đổi Date sang số ngày Excel theo UTC, nên 0 giờ giờ Việt Nam (UTC+7) thành 17:00 hôm trước → Excel lùi 1 ngày
(lỗi đã gặp trước 10/2026, kéo theo sai cột Thứ và giờ công thường ngày Chủ nhật). Khi admin nhập bảng công,
`js/importer.js` tự sửa các ngày có dấu hiệu lỗi này (phần lẻ đúng 17:00) từ file xuất bằng bản cũ.
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
