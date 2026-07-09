# SWAT Hour (công cụ nhúng trong TrackingTS)

Công cụ ước tính **giờ công lắp đặt thang máy** (SWAT / fitter hour) và tiền
thưởng theo *Installation Incentive Scheme* 2024/2025/2026. Được nhúng vào
TrackingTS ở tab **SWAT Hour** và truy cập trực tiếp tại `tools/swat-hour/`.

Nguồn gốc: vendored từ repo **[xaxa9ztb/swat-hour](https://github.com/xaxa9ztb/swat-hour)**.

## Tích hợp 2 chiều với TrackingTS

- Chọn dự án ở tab **SWAT Hour** (hoặc đổi dự án trên **Dashboard**) → TrackingTS
  đổ thông số kỹ thuật (từ `specs` YAN_COM của dự án) và **giờ đã dùng** (tổng
  bảng công theo WBS) sang công cụ qua `window.SWAT.setInputs(...)`.
- Công cụ tính xong trả kết quả (`SWAT_RESULT` / `getResult()`); TrackingTS hiển
  thị **giờ định mức toàn dự án / đã dùng / còn lại** và cho phép admin ghi
  **giờ định mức** thành **Target giờ** của dự án (dùng cho gauge Dashboard).

Phần wiring nằm ở `js/swat.js` của TrackingTS.

## Khác biệt so với bản gốc

Chỉ 1 thay đổi: handler `postMessage('SWAT_SET')` được bổ sung gọi `calc()` và
`postResult()` để công cụ tự tính lại và trả kết quả ngay khi nhận dữ liệu từ
TrackingTS.

## 🔒 Bảo mật dữ liệu

KHÔNG commit dữ liệu nội bộ (file `YAN_COM*.xlsx`, `Swat 20xx/*.xlsx`…) lên
GitHub — chỉ chứa **mã công cụ**. Xem `.gitignore` ở gốc repo.
