# Sao lưu lên Google Drive — cài đặt một lần (~10 phút)

Bộ công cụ sao lưu **toàn bộ dữ liệu** (mọi bảng trên máy chủ Cloudflare D1) thành file `trackingts-backup-….json.gz`:

| Cách | Khi nào | Lưu ở đâu |
|---|---|---|
| **Tải về máy** | Admin bấm *Quản trị → Sao lưu & khôi phục → Tải bản sao lưu về máy* | Máy tính của người bấm |
| **Lên Drive ngay** | Admin bấm *Sao lưu lên Google Drive ngay* | Thư mục `TrackingTS-Backup` trên Drive |
| **Tự động** | 02:07 sáng **thứ Hai và thứ Năm** (giờ VN) — GitHub Actions, workflow *Backup* | Thư mục `TrackingTS-Backup` trên Drive |

Drive **giữ tối đa 10 bản** mới nhất (cả tự động lẫn thủ công) — bản cũ hơn được chuyển vào Thùng rác (Drive tự xoá hẳn sau 30 ngày).
Khôi phục: *Quản trị → Sao lưu & khôi phục* → chọn một bản trên Drive (*Khôi phục…*) hoặc chọn file trên máy.

Máy chủ không giữ khoá Google: một **Apps Script** chạy dưới tài khoản Google của bạn làm cầu nối, có **mã bí mật** riêng.

## 1. Tạo Apps Script

1. Đăng nhập Google bằng tài khoản sẽ chứa bản sao lưu (nên là tài khoản công việc / tài khoản riêng cho dự án, không phải tài khoản cá nhân của nhân viên).
2. Mở <https://script.google.com> → **New project** → đặt tên `TrackingTS Backup`.
3. Xoá nội dung mẫu, dán toàn bộ file [`Code.gs`](Code.gs) → **Save**.
4. **Project Settings** (bánh răng) → *Script properties* → **Add script property**:
   - Property: `BACKUP_TOKEN`
   - Value: một chuỗi ngẫu nhiên **dài ít nhất 32 ký tự**, chỉ gồm chữ, số, `-`, `_` (vd. tạo bằng trình quản lý mật khẩu). Giữ kín chuỗi này.
5. **Deploy → New deployment** → loại **Web app**:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone** (an toàn vì mọi yêu cầu phải kèm mã bí mật; không có mã thì không đọc / ghi được gì)
   - **Deploy** → cấp quyền Drive khi được hỏi → chép **Web app URL** (dạng `https://script.google.com/macros/s/…/exec`).
6. Kiểm tra: mở Web app URL trên trình duyệt → thấy `{"ok":true,"service":"trackingts-backup"}`.

Thư mục `TrackingTS-Backup` được tạo tự động ở thư mục gốc Drive trong lần sao lưu đầu tiên (muốn dùng thư mục khác: thêm script property `FOLDER_ID` = mã thư mục).

## 2. Khai báo trên GitHub

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Giá trị |
|---|---|
| `BACKUP_DRIVE_URL` | Web app URL ở bước 1.5 |
| `BACKUP_DRIVE_TOKEN` | Chuỗi `BACKUP_TOKEN` ở bước 1.4 |

Sau đó chạy lại triển khai (push lên `main`, hoặc *Actions → Cloudflare → Run workflow*) để trang Quản trị dùng được Drive.
Thử sao lưu tự động ngay: *Actions → Backup → Run workflow* → xem bước *Sao lưu lên Google Drive* báo “Đã lưu … lên Google Drive”.

## Lưu ý

- File sao lưu chứa **dữ liệu cá nhân** (họ tên, email, bảng công, thu nhập incentive…) và tài liệu bracket đã tải lên: chỉ để trong Drive của tài khoản phụ trách, **không chia sẻ thư mục** cho người ngoài.
- Repo công khai: nhật ký GitHub Actions chỉ ghi số dòng từng bảng, **không** ghi dữ liệu; file sao lưu không được lưu làm artifact.
- GitHub tự tắt lịch chạy của repo không có hoạt động trong 60 ngày — khi đó vào *Actions → Backup → Enable workflow*.
- Đổi mã bí mật: sửa `BACKUP_TOKEN` trong Apps Script **và** secret `BACKUP_DRIVE_TOKEN` trên GitHub, rồi chạy lại triển khai.
- Sửa `Code.gs` sau này: *Deploy → Manage deployments → Edit → Version: New version* (giữ nguyên URL).
