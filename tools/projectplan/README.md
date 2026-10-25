# Quản lý dự án (bản demo)

Dành cho **Quản lý dự án và Site Sup**. Thay cho file Excel "Quản lý Lắp đặt NI" — Excel vẫn dùng để
**nhập / xuất** (cùng 2 sheet, cùng cách trình bày), còn việc cập nhật hằng ngày làm trên ứng dụng.

> **Bản demo, chưa áp dụng:** dữ liệu lưu trên trình duyệt của từng máy (`localStorage`, khoá `pm_data_v1`).
> Chia sẻ giữa các giám sát bằng **Xuất Excel → gửi file → Nhập Excel** (nhập sẽ **thay toàn bộ** dữ liệu
> trên máy, có Hoàn tác). Muốn nhiều người cùng sửa một bộ dữ liệu cần kho dùng chung (bước sau).

## Hai nhiệm vụ chính
### 1. Điều phối nhân sự (Fitter allocation) — tab *Điều phối nhân sự*
- Lưới **fitter × ngày** (2 / 4 / 6 / 8 tuần), mỗi đoạn phân công là một dải màu theo dự án;
  **dự kiến** = dải sọc. Nền vàng = ngày lễ (theo `../timesheet/labor.js`), xám = Chủ nhật.
- **Bấm ô trống** (hoặc **kéo chuột** qua nhiều ngày) → phân công: dự án (hoặc *Dự án mới…*), từ – đến,
  Chính thức / Dự kiến, tuỳ chọn bỏ qua Chủ nhật & ngày lễ. Phân công đè lên ngày đã có → cảnh báo trước.
- **Bấm dải màu** → sửa / kéo dài / thu ngắn / đổi fitter / *Bỏ trống*. Mọi thay đổi có **Hoàn tác**.
- Dòng cuối **Chưa có việc**: số fitter rảnh mỗi ngày làm việc; chip *Hôm nay*: số fitter có việc, ai đang rảnh.
- *Làm nổi* một dự án để thấy ai đang ở đâu. Bấm tên fitter để sửa, đổi thứ tự, xoá (gợi ý tên từ EE Data).

### 2. Lịch trình dự án — tab *Lịch trình dự án*
- Bảng dự án: thông số thang, **hàng** (xuất xưởng, về cảng, hàng về), **lắp đặt** (XD bàn giao hố,
  CĐT yêu cầu lắp, team nhận hố, bàn giao), nhân sự kế hoạch + **fitter thực tế lấy từ lưới điều phối**, giám sát.
- Mỗi mốc gồm **ngày + "Đã xong" + ghi chú** (vì Excel ghi lẫn ngày và chữ "xong", "đã về", "theo lịch hàng về"…).
- **Cảnh báo**: mốc đã qua ngày chưa xác nhận · chưa phân công fitter quanh ngày nhận hố · nhận hố trước khi
  XD giao hố · hàng về sau ngày nhận hố · ngày cần kiểm tra (nhập nhầm định dạng).
- Khung **Sắp tới 14 ngày**; lọc theo trạng thái, giám sát, tìm không dấu. Trên điện thoại hiện dạng thẻ.
- **Gộp dự án**: tên ngắn trong lưới không khớp chắc chắn với Plan (vd. "Thanh Xuân") được tạo thành dự án
  riêng — gộp vào dự án đúng, phân công chuyển theo.

## Nhập / xuất Excel (`pmio.js`)
- **Nhập** bằng SheetJS (`js/xlsx.full.min.js`; ExcelJS lỗi khi đọc file có *bảng Excel* như sheet Plan).
  - Sheet **Nhân sự**: tìm dòng ngày + cột "Tên"; đoạn phân công = ô gộp **hoặc** các ô liền nhau cùng màu
    (tên dự án có thể nằm giữa đoạn); ô màu **xám = dự kiến**; ô có màu mà không có tên → bỏ qua, có cảnh báo.
  - Sheet **Plan**: khớp cột theo **tên cột**; cột ngày nhận ngày thật, "25.10.2026", "20/11/2026",
    "xong / đã xong / đã về", "chưa / chưa có", ghi chú khác. Ô ngày định dạng **tháng/ngày** (kiểu Mỹ) mà
    ngày ≤ 12 → nhập như Excel lưu nhưng **cảnh báo + gợi ý** đổi ngày/tháng (bấm *Dùng …* trong ứng dụng).
  - Tên ngắn trong lưới khớp dự án Plan khi chắc chắn (bỏ dấu, chứa trọn từ); mơ hồ → dự án riêng + cảnh báo.
- **Xuất** bằng ExcelJS: đúng 2 sheet — *Nhân sự* (dòng thứ, dòng ngày, ô gộp tô màu theo dự án, xám = dự kiến)
  và *Plan* (21 cột như file gốc, ô *Tên dự án* tô màu dự án). Ngày ghi theo UTC (không lệch ngày).
  Xuất rồi nhập lại cho **đúng dữ liệu ban đầu**.

## Kiểm thử
`pmio.js` chạy được trong Node (`module.exports`) để thử với file thật mà không cần trình duyệt.
**Không commit file dữ liệu thật** (`.gitignore` đã chặn `*.xlsx`).
