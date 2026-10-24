# Hướng dẫn đưa app Thống Kê Giờ Công lên online

Kiến trúc: app chạy trên **GitHub Pages** (miễn phí), dữ liệu dùng chung nằm trong 1 file
`timesheet-data.json` trên **Google Drive**. Mọi người mở link là xem được; chỉ admin
(có mật khẩu + tài khoản Google của bạn) mới cập nhật được dữ liệu.

> **Lưu ý bảo mật:** mật khẩu admin chỉ khoá giao diện. Lớp bảo vệ thật sự là tài khoản
> Google — chỉ tài khoản đã tạo file Drive mới ghi đè được dữ liệu chung.

## Bộ công cụ (nhiều công cụ trong 1 repo)

Repo này là **Bộ công cụ dự án**. Mỗi repo cũ là **một chức năng lớn**; người dùng
**đăng nhập một lần ở trang chủ rồi chọn chức năng**.

| Đường dẫn | Chức năng | Ai được dùng | Nguồn |
|---|---|---|---|
| `index.html` | Trang chủ: Đăng nhập → Chọn chức năng | — | — |
| `tracking.html` | Thống kê giờ công dự án (các bước bên dưới) | Mọi nhân viên | — |
| `tools/swat-hour/` | SWAT Hour (nhúng trong tab SWAT của `tracking.html`) | theo `tracking.html` | `xaxa9ztb/swat-hour` |
| `tools/timesheet/` | Timesheet cá nhân | Mọi nhân viên | `xaxa9ztb/Timesheet` (`git subtree`, giữ lịch sử) |
| `tools/tiendotm/` | Tiến độ thi công thang máy | **Quản lý dự án, Site Sup** | `xaxa9ztb/TiendoTM` (`git subtree`, giữ lịch sử) |

### Đăng nhập & phân quyền (`js/session.js`)
- Nhân viên đăng nhập bằng **họ tên đầy đủ + mã số nhân viên**, đối chiếu với EE Data (không phân
  biệt hoa/thường, có dấu/không dấu). Danh sách nhân viên lấy từ dữ liệu đã lưu trên máy; nếu
  không khớp thì tự cập nhật từ Google Drive **một lần** rồi thử lại.
- **Ghi nhớ trên thiết bị này**: giữ đăng nhập 30 ngày (hợp cho điện thoại dùng Timesheet hằng ngày).
  Không chọn thì phiên hết khi đóng tab. Phiên **quản trị không bao giờ được ghi nhớ**.
- **Vai trò lấy theo chức danh (cột Position trong EE Data)**:
  - *Quản lý dự án*: chứa `project manager` / `quản lý dự án`
  - *Site Sup*: chứa `supervisor` / `site sup` / `project engineer` / `giám sát`
    (cùng định nghĩa Site Sup đang dùng ở Dashboard)
  - còn lại: *Nhân viên*. Quản trị viên được dùng mọi chức năng.
  - Đổi quy tắc: sửa `ROLE_RULES` và `roles` của từng chức năng trong `TOOLS` ở `js/session.js`.
- Mở thẳng link một chức năng khi chưa đăng nhập → về trang đăng nhập, xong **tự quay lại đúng
  chức năng đó**. Không đủ quyền → về trang chủ kèm thông báo lý do.
- Timesheet tự điền họ tên / mã NV / chức vụ từ phiên đăng nhập (chỉ điền ô còn trống).

> **Giới hạn:** đây là kiểm soát **phía trình duyệt** (web tĩnh GitHub Pages): đủ để điều hướng
> đúng người, nhưng người rành kỹ thuật vẫn có thể vượt qua. Cần bảo mật thật sự (dữ liệu nhạy
> cảm, quyền ghi) thì phải có xác thực phía máy chủ — ví dụ Azure Static Web Apps + Entra ID.

### Thêm một chức năng mới
1. Chép công cụ vào `tools/<tên>/`.
2. Trong `<head>`: `<script src="../../js/session.js"></script><script>Session.guard('<id>');</script>`
3. Ngay sau `<body>`: `<script src="../toolset-nav.js" data-tool="Tên chức năng"></script>`
4. Khai báo `<id>` trong `TOOLS` (`js/session.js`, thêm `roles` nếu giới hạn quyền) và nội dung thẻ
   trong `CARDS` / `ICONS` / `ORDER` ở `index.html`.

- Các chức năng cùng chạy trên `https://xaxa9ztb.github.io`, nên dữ liệu đã lưu trên trình duyệt
  (ví dụ chấm công của Timesheet) vẫn còn khi mở ở đường dẫn mới.
- Từ nay sửa Timesheet / TiendoTM **ngay trong repo này** (thư mục `tools/...`).

---

## Bước 1 — Đặt mật khẩu admin

1. Mở app (localhost hoặc sau này là link github.io), nhấn **F12** → tab **Console**.
2. Gõ (thay `mật-khẩu-của-bạn`):
   ```js
   await hashPassword('mật-khẩu-của-bạn')
   ```
3. Copy chuỗi kết quả (64 ký tự hex), dán vào `js/config.js`:
   ```js
   ADMIN_PASSWORD_HASH: 'chuỗi-vừa-copy',
   ```

## Bước 2 — Đưa app lên GitHub Pages (làm hoàn toàn trên web)

1. Đăng nhập [github.com](https://github.com) → nút **+** góc phải → **New repository**.
   - Repository name: `timesheet-app` (hoặc tên tuỳ ý)
   - Chọn **Public** → **Create repository**.
2. Trong trang repo mới → link **uploading an existing file**.
3. Mở thư mục `E:\Swat SW\timesheet-app` trong File Explorer, chọn **toàn bộ** file và
   thư mục con (`index.html`, `css`, `js`, `README-DEPLOY.md`... — KHÔNG cần `server.ps1`
   và file Excel), kéo thả vào trang upload → **Commit changes**.
   - Lưu ý: kéo cả thư mục `css` và `js` vào (trình duyệt Chrome/Edge hỗ trợ kéo thư mục).
4. Vào **Settings** (của repo) → menu trái **Pages**:
   - Source: **Deploy from a branch**
   - Branch: `main`, thư mục `/ (root)` → **Save**.
5. Chờ 1-2 phút, trang Pages sẽ hiện link dạng:
   `https://<tên-github-của-bạn>.github.io/timesheet-app/`
   — đây là link gửi cho mọi người.

## Bước 3 — Tạo Google Cloud project (một lần duy nhất, ~20 phút)

Vào [console.cloud.google.com](https://console.cloud.google.com), đăng nhập Google.

**3.1. Tạo project:** thanh trên cùng → chọn project → **New Project** → đặt tên
(vd `timesheet-app`) → **Create** → chọn project vừa tạo.

**3.2. Bật Drive API:** menu ☰ → **APIs & Services → Library** → tìm
**Google Drive API** → **Enable**.

**3.3. Tạo API key (cho mọi người đọc dữ liệu):**
- **APIs & Services → Credentials** → **+ Create credentials → API key** → copy key.
- Nhấn vào key vừa tạo để hạn chế (khuyến nghị):
  - *Application restrictions*: **Websites** → thêm `https://<tên-github>.github.io/*`
  - *API restrictions*: **Restrict key** → chọn **Google Drive API** → **Save**.
- Dán vào `config.js`: `GOOGLE_API_KEY: 'AIza...'`

**3.4. Cấu hình OAuth consent (cho admin đăng nhập):**
- **APIs & Services → OAuth consent screen** → User type: **External** → **Create**.
- Điền App name (`Timesheet App`), email hỗ trợ = email của bạn → **Save and continue**
  qua các bước còn lại (không cần thêm scope thủ công).
- Ở mục **Test users** → **+ Add users** → thêm email Google của bạn.
  (App ở chế độ Testing chỉ cho phép test user đăng nhập — với 1 admin là đủ, không cần
  gửi Google xét duyệt.)

**3.5. Tạo OAuth Client ID:**
- **Credentials** → **+ Create credentials → OAuth client ID**.
- Application type: **Web application**.
- **Authorized JavaScript origins** thêm 2 dòng:
  - `https://<tên-github>.github.io`
  - `http://localhost:5173` (để chạy thử trên máy)
- **Create** → copy **Client ID** (dạng `xxxx.apps.googleusercontent.com`).
- Dán vào `config.js`: `GOOGLE_CLIENT_ID: 'xxxx.apps.googleusercontent.com'`

## Bước 4 — Tạo file dữ liệu trên Drive (một lần duy nhất)

1. Mở app trên máy (localhost) — lúc này `config.js` đã có `GOOGLE_CLIENT_ID`.
2. Bấm **Cập nhật Data** → import file Data v1.xlsx để app có dữ liệu mới nhất.
3. Nhấn **F12** → Console, chạy:
   ```js
   await Cloud.createDriveFile()
   ```
   → cửa sổ đăng nhập Google hiện ra, chọn tài khoản của bạn và đồng ý.
4. Console in ra `DRIVE_FILE_ID = ...` — copy dán vào `config.js`:
   ```js
   DRIVE_FILE_ID: '1AbC...',
   ```

## Bước 5 — Upload config.js hoàn chỉnh lên GitHub

`js/config.js` giờ đã đủ 4 giá trị. Vào repo GitHub → mở thư mục `js` → nhấn vào
`config.js` → biểu tượng ✏️ (Edit) → dán nội dung mới → **Commit changes**.
Chờ 1-2 phút để Pages cập nhật.

---

## Sử dụng hằng ngày

**Người xem:** mở link github.io → đăng nhập (họ tên + mã NV) → chọn **Thống kê giờ công dự án**
→ app tự tải dữ liệu mới nhất từ Drive. Chỉ xem, lọc — không thấy các nút thêm/sửa/xoá.

**Admin cập nhật dữ liệu:**
1. Mở link github.io → **Đăng nhập quản trị** → nhập mật khẩu → chọn **Thống kê giờ công dự án**
   (hoặc đang ở trong app thì bấm **🔒 Admin**).
2. Bấm **Cập nhật Data** → import file tổng hoặc file lẻ như bình thường.
3. Bấm **Lưu lên Drive** → đăng nhập Google (lần đầu mỗi phiên) → xong.
   Mọi người tải lại trang là thấy dữ liệu mới.

## Sự cố thường gặp

| Hiện tượng | Nguyên nhân / cách xử lý |
|---|---|
| "Không tải được từ Drive" | Kiểm tra `DRIVE_FILE_ID`, `GOOGLE_API_KEY` trong config.js; API key phải cho phép domain github.io |
| Đăng nhập Google báo lỗi `origin_mismatch` | Thêm đúng domain vào **Authorized JavaScript origins** (bước 3.5) |
| Đăng nhập báo app chưa xác minh / access denied | Thêm email của bạn vào **Test users** (bước 3.4) |
| Quên mật khẩu admin | Tạo hash mới (bước 1) và sửa `config.js` trên GitHub |
| Muốn đổi dữ liệu về bản cũ | Google Drive giữ lịch sử phiên bản: mở drive.google.com → chuột phải file `timesheet-data.json` → Manage versions |
| Sửa code xong nhưng trang vẫn chạy bản cũ | Trình duyệt/GitHub Pages cache file css/js. Khi cập nhật code, tăng số version `?v=...` ở các dòng `<link>`/`<script>` trong `tracking.html` (ví dụ `?v=2` → `?v=3`); người xem chỉ cần tải lại trang. Chữa cháy nhanh: Ctrl+F5 |
