# Kho dữ liệu chung cho "Quản lý dự án" — hướng dẫn triển khai (≈ 10 phút, làm 1 lần)

Mục tiêu: mọi **Quản lý dự án / Site Sup** cùng xem và sửa **một** bộ dữ liệu điều phối fitter + lịch trình dự án,
lưu trên Google Drive — **không cần gửi file Excel qua lại**. Giám sát **không cần tài khoản Google**: chỉ cần
đăng nhập Bộ công cụ như bình thường.

```
Bộ công cụ (trình duyệt) ──POST──▶ Apps Script (chạy bằng tài khoản admin) ──▶ projectplan-data.json (Drive của admin, riêng tư)
                                          │
                                          └── kiểm tra người dùng trong EE Data (file timesheet-data.json)
```

## Người làm: quản trị viên (tài khoản Google đang giữ file `timesheet-data.json`)

1. Mở <https://script.google.com> → **Dự án mới** → đặt tên `Kho Quản lý dự án`.
2. Xoá nội dung mẫu, dán toàn bộ nội dung file [`Code.gs`](Code.gs) → **Lưu**.
3. **Cài đặt dự án** (biểu tượng bánh răng) → **Thuộc tính tập lệnh** → thêm:
   | Thuộc tính | Giá trị |
   |---|---|
   | `MAIN_FILE_ID` | giá trị `DRIVE_FILE_ID` trong `js/config.js` (để kiểm tra người dùng theo EE Data) |
   | `ADMIN_KEY` | *(không bắt buộc)* mã quản trị — tạo ở bước 6 |
4. **Triển khai → Tùy chọn triển khai mới** → loại **Ứng dụng web**:
   - *Thực thi dưới dạng*: **Tôi** (tài khoản admin)
   - *Người có quyền truy cập*: **Bất kỳ ai**
   → **Triển khai** → cấp quyền (Google hỏi quyền Drive cho chính tài khoản admin) → chép **URL ứng dụng web**
   (dạng `https://script.google.com/macros/s/…/exec`).
5. Mở `js/config.js` trên GitHub, điền `PM_SYNC_URL: 'URL vừa chép'`, rồi tăng số `?v=` của `config.js`
   trong các trang (hoặc nhờ người phát triển) để máy người dùng nhận cấu hình mới.
6. *(Không bắt buộc — để admin cũng đọc / sửa được)*: mở trang chủ Bộ công cụ, bấm F12 → Console, chạy:
   ```js
   const pw = prompt('Mật khẩu admin'); const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw + '|pm-store'));
   console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''));
   ```
   Chép chuỗi in ra vào thuộc tính `ADMIN_KEY` (bước 3). Mã này tính từ **mật khẩu**, không đoán được từ
   mã băm công khai trong `config.js`.

Xong: lần đầu một giám sát mở **Quản lý dự án**, dữ liệu trên máy họ (nếu có) được đưa lên làm bản chung;
từ đó mọi người cùng dùng bản chung. File `projectplan-data.json` tự tạo trong Drive của admin.

## Cách hoạt động
- **Tự tải** khi mở trang, khi quay lại tab và mỗi ~90 giây; **tự lưu** ~1,5 giây sau mỗi thay đổi
  (hoặc bấm **Lưu lên Drive**). Thanh trạng thái: *Đã lưu trên Drive · giờ · bởi ai · phiên bản*.
- **Hai người sửa cùng lúc:** mỗi lần lưu kèm số phiên bản; nếu đã có người lưu trước, ứng dụng **gộp** thay đổi
  (theo từng dự án / fitter / ô phân công) rồi lưu lại. Cùng sửa đúng một mục → bản của người lưu sau được giữ,
  có thông báo.
- **Mất mạng:** thay đổi giữ trên máy, có mạng lại tự lưu. Rời trang khi còn thay đổi chưa lưu → trình duyệt hỏi lại.
- **Quyền:** chỉ người có **họ tên + mã NV trong EE Data** với chức danh Quản lý dự án / Site Sup (và admin có
  `ADMIN_KEY`) đọc / lưu được. Danh sách được đọc lại từ file dữ liệu chung (lưu đệm 10 phút).
- **Phục hồi:** Drive giữ các phiên bản cũ của `projectplan-data.json` (File → Lịch sử phiên bản);
  Excel vẫn **Nhập / Xuất** được trong menu ⋯ (dự phòng, gửi người ngoài).

## Giới hạn (bản demo)
- Xác thực giống đăng nhập Bộ công cụ (họ tên + mã NV) — đủ cho nội bộ, **không** thay được đăng nhập
  tài khoản công ty. Muốn chặt hơn: đặt *Người có quyền truy cập* = người trong tổ chức (Google Workspace)
  hoặc chuyển sang máy chủ có đăng nhập Microsoft / Google.
- Apps Script có hạn mức (≈ 20.000 lượt gọi / ngày với tài khoản thường) — dư cho một nhóm giám sát.
- Khi cập nhật `Code.gs`: **Triển khai → Quản lý các bản triển khai → Sửa → Phiên bản mới** (URL giữ nguyên).
