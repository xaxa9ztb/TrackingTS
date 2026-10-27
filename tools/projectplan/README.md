# Quản lý dự án (bản demo)

Dành cho **Quản lý dự án và Site Sup**. Thay cho file Excel "Quản lý Lắp đặt NI" — Excel vẫn dùng để
**nhập / xuất** (cùng 2 sheet, cùng cách trình bày), còn việc cập nhật hằng ngày làm trên ứng dụng.

## Lưu trữ
- **Kho dữ liệu chung trên Google Drive** (khuyến nghị — bỏ được file Excel): mọi Quản lý dự án / Site Sup cùng sửa
  một bộ dữ liệu, **tự tải khi mở, tự lưu sau mỗi thay đổi**, hai người sửa cùng lúc được **gộp** (`PMIO.merge`),
  mất mạng thì giữ trên máy và tự lưu khi có mạng. Cần quản trị viên triển khai 1 lần một Google Apps Script
  (`apps-script/Code.gs`) rồi điền `PM_SYNC_URL` trong `js/config.js` — xem [`apps-script/HUONG-DAN.md`](apps-script/HUONG-DAN.md).
- **Chưa cấu hình** (`PM_SYNC_URL` trống): dữ liệu chỉ lưu trên trình duyệt của từng máy (`localStorage`, khoá
  `pm_data_v1`); chia sẻ tạm bằng Xuất / Nhập Excel (menu ⋯).
- Excel vẫn **nhập / xuất** được ở menu ⋯ (dự phòng, gửi người ngoài). Khi đã kết nối kho chung, *Nhập Excel*
  thay **dữ liệu chung của cả nhóm** (có Hoàn tác).

## Dữ liệu dùng chung (EE Data + Dự án — như Thống kê giờ công)
- Dòng **Dữ liệu dùng chung**: số nhân viên / dự án trên máy, lần đồng bộ, nút **Đồng bộ** (tải từ Google Drive,
  dùng chung với Thống kê giờ công, Timesheet, Hồ sơ chất lượng).
- **+ Từ dữ liệu nhân sự**: thêm fitter từ EE Data (lọc chức danh fitter / lắp đặt; tuỳ chọn mọi chức danh), có mã NV.
- Hộp **Fitter**: liên kết tên hiển thị (vd. "Do") với nhân viên trong EE Data (gợi ý tự động khi tên khớp duy nhất);
  mã NV không còn trong EE Data → ⚠ trên lưới.
- Hộp **Dự án**: *Chọn từ danh sách dự án chung (WBS)* → điền sẵn tên, WBS, loại thang, giám sát; WBS không có trong
  danh sách chung → cảnh báo trên bảng.

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

## Bổ sung: xem lịch trình, kéo thả, so với chấm công thực tế
- **Kéo thả (máy tính, chuột)** trên lưới *Điều phối nhân sự*: kéo cả dải màu sang fitter / ngày khác (có khung gợi ý, đè lên ngày
  đã có thì hỏi lại); kéo **mép trái / phải** của dải để rút ngắn / kéo dài. Bấm (không kéo) vẫn mở hộp sửa; mọi thay đổi có **Hoàn tác**.
- **Lịch trình (Gantt)** (tab *Lịch trình dự án* → nút *Lịch trình (Gantt)*): mỗi dự án một dòng — dải xám = hàng (xuất xưởng → hàng về),
  dải màu dự án = lắp đặt (nhận hố → bàn giao), gạch xanh = thời gian fitter được phân công, ◇ = các mốc (đặc = đã xong, đỏ = quá hạn chưa xác nhận),
  vạch đỏ = hôm nay. Site Sup bấm **Dự án của tôi** để chỉ xem dự án mình giám sát. Bấm tên dự án để mở chi tiết.
- **Thực tế & bám kế hoạch** (tab mới): đối chiếu lưới điều phối với bảng *Theo dõi giờ công* (dữ liệu của Thống kê giờ công — trên bản
  Cloudflare gồm cả bảng công nhân viên tự nộp đã được duyệt). Cần: fitter được **liên kết mã NV** (EE Data) và dự án có **WBS**.
  - *So sánh với kế hoạch*: mỗi ô ngày ✓ đúng dự án · ≠ làm dự án khác · ✗ có kế hoạch nhưng không chấm công · + làm ngoài kế hoạch; dự kiến không tính.
  - *Gantt thực tế*: dải liên tiếp theo dự án mà fitter thực sự chấm công trong tháng.
  - Bảng **đánh giá theo giám sát / dự án / fitter**: % bám kế hoạch (= ngày đúng ÷ ngày có phân công chính thức) và % giờ thực tế trên dự án đúng kế hoạch.
  - Logic thuần ở `actual.js` (có kiểm thử `test/client/actual.test.mjs`).
- **Tự điền thông số thang từ dự án chung**: dự án đã có WBS khớp danh sách dự án chung được **tự điền các ô còn trống** (loại thang, số điểm dừng,
  tải trọng, hành trình, số lượng, giám sát) khi mở trang / đồng bộ; có Hoàn tác. Trong hộp thoại dự án: nút *↻ Điền thông số thang…* và gợi ý
  *Có phải dự án … ?* khi tên khớp duy nhất. Menu ⋯ → *Điền thông số thang từ dữ liệu dự án chung* để làm hàng loạt.
  (Cột thông số của dự án chung được nhận theo **từ khoá** — stops / điểm dừng, load / tải trọng, travel / hành trình, qty / số lượng.)

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
