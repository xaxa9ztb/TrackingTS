# Hướng dẫn đưa app Thống Kê Giờ Công lên online

Kiến trúc: app chạy trên **GitHub Pages** (miễn phí), dữ liệu dùng chung nằm trong 1 file
`timesheet-data.json` trên **Google Drive**. Mọi người mở link là xem được; chỉ admin
(có mật khẩu + tài khoản Google của bạn) mới cập nhật được dữ liệu.

> **Lưu ý bảo mật:** mật khẩu admin chỉ khoá giao diện. Lớp bảo vệ thật sự là tài khoản
> Google — chỉ tài khoản đã tạo file Drive mới ghi đè được dữ liệu chung.

## Bộ công cụ (tất cả trong 1 repo)

Trang chủ hiển thị các chức năng dạng **biểu tượng** (màu riêng cho từng chức năng; xám = đang phát triển),
ngay cả ở màn đăng nhập: chọn biểu tượng rồi đăng nhập là mở thẳng chức năng đó.

Repo **TrackingTS** là nơi **duy nhất** chứa và phát triển **Bộ công cụ dự án**: mọi chức năng
(kể cả Timesheet, Hồ sơ chất lượng thang máy, SWAT Hour trước đây nằm ở repo riêng) đều sửa ngay
trong repo này. Người dùng **đăng nhập một lần ở trang chủ rồi chọn chức năng**.

| Đường dẫn | Chức năng | Ai được dùng | Nguồn gốc |
|---|---|---|---|
| `index.html` | Trang chủ: Đăng nhập → Chọn chức năng | — | — |
| `tracking.html` | Thống kê giờ công dự án (các bước bên dưới) | Mọi nhân viên | — |
| `tools/swat-hour/` | SWAT Hour (nhúng trong tab SWAT của `tracking.html`) | theo `tracking.html` | chép từ `xaxa9ztb/swat-hour` |
| `tools/timesheet/` | Timesheet cá nhân | Mọi nhân viên | `xaxa9ztb/Timesheet` (`git subtree`, giữ lịch sử) — **ngừng phát triển** |
| `tools/tiendotm/` | Hồ sơ chất lượng thang máy (hồ sơ quản lý chất lượng + bảng tiến độ thi công) | **Quản lý dự án, Site Sup** | `xaxa9ztb/TiendoTM` (`git subtree`, giữ lịch sử) — **ngừng phát triển** |
| `tools/accounts/` | Tài khoản & phân quyền — chỉ chạy trên **máy chủ Cloudflare** (xem mục *Máy chủ mới*) | **Admin**, Quản lý dự án (phân công) | — |
| `tools/projectplan/` | Quản lý dự án — **bản demo**: điều phối fitter + lịch trình dự án; lưu chung trên Drive qua Apps Script (`PM_SYNC_URL`), Excel nhập / xuất dự phòng | **Quản lý dự án, Site Sup** | — (xem `tools/projectplan/README.md`, `apps-script/HUONG-DAN.md`) |

**Đang phát triển** — đã có chỗ ở trang chủ (nhóm *Quản lý dự án & Giám sát dự án*, dành cho
Quản lý dự án và Site Sup); bấm vào chỉ hiện thông báo "đang phát triển" và phạm vi dự kiến:

| Mã (`TOOLS`) | Chức năng | Phạm vi dự kiến |
|---|---|---|
| `handover` | Hồ sơ bàn giao NI – EI | Tổng hợp tài liệu, kiểm tra đảm bảo quy trình bàn giao |
| `ffplus` | Hồ sơ FF+ | Tổng hợp tài liệu + công cụ kiểm tra hồ sơ đầy đủ cho quy trình FF+ |
| `materials` | Điều phối công cụ dụng cụ, vật tư | Quản lý, điều phối công cụ dụng cụ và vật tư |

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
- Mỗi lần mở trang chủ / chức năng, phiên được **so lại với EE Data trên máy**: đổi chức danh thì
  quyền đổi theo (kể cả phiên "ghi nhớ"); mã NV bị xoá khỏi EE Data (nghỉ việc) thì **phiên kết thúc**.
- **Đăng xuất** xong bấm *Back* không xem lại được chức năng (trình duyệt hay khôi phục trang cũ từ
  bộ nhớ đệm); các tab khác đang mở chức năng cũng tự thoát.
- Timesheet tự điền họ tên / mã NV / chức vụ từ phiên đăng nhập (chỉ điền ô còn trống).

### Dữ liệu Dự án dùng chung
- **Trang chủ** có thẻ **Dữ liệu dùng chung**: lần đồng bộ gần nhất, lúc admin cập nhật dữ liệu, số nhân viên / dự án
  trên máy và nút **Đồng bộ ngay** (tải bản mới nhất từ Google Drive cho mọi chức năng). Không tự tải khi mở trang
  (tiết kiệm hạn mức Drive); đồng bộ xong, quyền theo chức danh được cập nhật ngay. Admin có thêm liên kết
  *Cập nhật dữ liệu lên Drive*.
- Danh sách dự án của **Timesheet** lấy **chung với tab Dự án** của Thống kê giờ công (cùng kho
  dữ liệu trên máy, nguồn là file Google Drive). WBS của dự án = *Work Number* trong Timesheet.
- Admin import Yan_COM rồi **Lưu lên Drive** như bình thường → người dùng Timesheet bấm
  **Đồng bộ ngay** ở thẻ *Dữ liệu dự án* ngay trên màn hình Timesheet (hiện số dự án và lần đồng bộ gần nhất) là có danh sách mới. Không còn Google Sheet
  dự án riêng cho Timesheet.
- **Timesheet và Thống kê giờ công hoạt động độc lập**: chỉ dùng chung *EE Data* và *Dự án*
  (Timesheet chỉ đọc). Hai bên **không import dữ liệu chấm công cho nhau** — bảng công vào
  Thống kê giờ công vẫn do admin nhập tay qua **Cập nhật Data** như trước.
- **Hồ sơ chất lượng thang máy** (`tools/tiendotm`) cũng đọc danh sách này: ô *Chọn dự án từ danh sách chung* ở bước 1 điền sẵn Tên dự án,
  Bên Mua / Chủ đầu tư (customer) và Thiết bị (product line). Địa chỉ, số hợp đồng vẫn lấy từ OCR / nhập tay.

### Thông tin cá nhân không đưa lên Drive
File dữ liệu trên Google Drive **ai có link cũng tải được**, nên khi **Lưu lên Drive** app **bỏ**
các trường cá nhân mà người xem không cần: *ngày sinh, giới tính, username, mã cá nhân (personId)*.
- Máy admin đã import EE Data **vẫn giữ** các trường này (Export Excel, sửa nhân viên vẫn đủ).
- File **sao lưu JSON** trên máy admin vẫn đầy đủ → giữ ở nơi an toàn, không chia sẻ.
- File trên Drive chỉ gọn lại sau lần **Lưu lên Drive** kế tiếp. Google Drive còn giữ các phiên bản
  cũ của file (~30 ngày, chỉ chủ sở hữu xem được qua API có đăng nhập).

### Cài lên máy & dùng khi mất mạng (PWA — `sw.js`, `manifest.webmanifest`, `js/pwa.js`)
- Trang chủ có thẻ **Cài Bộ công cụ lên máy** (Chrome / Edge / Android); trên iPhone: Safari →
  **Chia sẻ → Thêm vào MH chính**. Sau đó mở từ màn hình chính như một ứng dụng.
- Mỗi chức năng đã mở **một lần khi có mạng** sẽ mở được khi **mất mạng**: Timesheet (cả Xuất Excel),
  Thống kê giờ công (dữ liệu trên máy), TiendoTM (trừ OCR lần đầu — cần tải mô hình nhận dạng),
  và đăng nhập lại bằng danh sách nhân viên trên máy. Có nhãn **📴 Ngoại tuyến** khi mất mạng.
- Khi cập nhật code: vẫn **tăng `?v=`** như cũ. Nếu **thêm file mới** cần dùng ngoại tuyến hoặc đổi
  cách lưu đệm: thêm vào `SHELL_FILES` / `CDN_FILES` trong `sw.js` và **tăng `VERSION`**.

### Timesheet: mã nguồn & build
Timesheet được **build sẵn** (mở nhanh hơn ~5 lần trên điện thoại): sửa `tools/timesheet/src/app.jsx`
rồi chạy `npm install && npm run build` trong `tools/timesheet/` — xem `tools/timesheet/README.md`.

### Repo cũ (ngừng phát triển)
`xaxa9ztb/Timesheet` và `xaxa9ztb/TiendoTM` **không phát triển nữa**: chỉ còn **trang tự chuyển
hướng** sang Bộ công cụ (link cũ vẫn dùng được). Nên *Archive* hai repo này (Settings → General →
Danger Zone → *Archive this repository*) để không ai sửa nhầm ở đó. Mọi thay đổi làm trong
`tools/timesheet/`, `tools/tiendotm/` của repo này.

> **Giới hạn:** đây là kiểm soát **phía trình duyệt** (web tĩnh GitHub Pages): đủ để điều hướng
> đúng người, nhưng người rành kỹ thuật vẫn có thể vượt qua. Cần bảo mật thật sự (dữ liệu nhạy
> cảm, quyền ghi) thì phải có xác thực phía máy chủ — ví dụ Azure Static Web Apps + Entra ID.

### Thêm một chức năng mới
1. Chép công cụ vào `tools/<tên>/`.
2. Trong `<head>`: `<script src="../../js/session.js"></script><script>Session.guard('<id>');</script>`
3. Ngay sau `<body>`: `<script src="../toolset-nav.js" data-tool="Tên chức năng"></script>`
4. Khai báo `<id>` trong `TOOLS` (`js/session.js`, thêm `roles` nếu giới hạn quyền) và nội dung thẻ
   trong `CARDS` / `ICONS` / `GROUPS` ở `index.html`.

**Đưa một chức năng "đang phát triển" vào dùng** (ví dụ `ffplus`): làm bước 1–3 ở trên, rồi trong
`TOOLS` thay `soon: true` bằng `path: 'tools/<tên>/'`; trong `CARDS` bỏ `scope`, thêm `meta` nếu cần.
Tăng `?v=` của `js/session.js` và `VERSION` trong `sw.js` (thêm trang mới vào `SHELL_FILES`).

- Các chức năng cùng chạy trên `https://xaxa9ztb.github.io`, nên dữ liệu đã lưu trên trình duyệt
  (ví dụ chấm công của Timesheet) vẫn còn khi mở ở đường dẫn mới.
- Sửa Timesheet / Hồ sơ chất lượng thang máy / SWAT Hour **ngay trong repo này** (thư mục `tools/...`).

---

## Máy chủ mới trên Cloudflare (đang chuyển dần)

Theo đề xuất đã duyệt: giao diện chạy trên **Cloudflare Pages**, dữ liệu trong **D1**, đăng nhập bằng
**Cloudflare Access** (mã gửi qua email / Google), quyền kiểm tra ở máy chủ cho từng yêu cầu. Gói miễn phí, 0 đ.
Trong lúc chuyển, bản GitHub Pages + Google Drive **vẫn chạy như cũ**.

| Thành phần | Ở đâu |
|---|---|
| API (`/api/*`) | `server/api.mjs` (vai trò: `server/roles.mjs`, xác thực Access: `server/auth.mjs`), điểm vào `functions/api/[[path]].js` |
| Cấu trúc dữ liệu D1 | `migrations/*.sql` — thêm file mới, không sửa file cũ |
| Cấu hình | `wrangler.toml` (`database_id` do GitHub Actions điền, không sửa tay) |
| Đóng gói giao diện | `scripts/build-pages.mjs` → `dist/` |
| Triển khai | `.github/workflows/cloudflare.yml`: mọi PR chạy kiểm thử; merge vào `main` → tự triển khai |
| Kiểm thử máy chủ | `npm install && npm run test:server` (D1 giả lập, không cần mạng / tài khoản) |
| Trang quản trị | `tools/accounts/` — gắn email (từng người hoặc **dán danh sách** mã NV + email từ Excel), vai trò, phân công dự án, đưa EE Data + Dự án lên (gửi từng đợt nhỏ, vừa giới hạn của gói miễn phí), **tự phân công Site Sup theo cột Giám sát của dự án** (khớp tên không phân biệt dấu / thứ tự họ tên, ghi nhớ lựa chọn), **gán một Quản lý dự án cho nhiều dự án một lần**, nhật ký |

**Đã làm (người giữ tài khoản Cloudflare):** tài khoản + quản trị phụ, API token `trackingts-deploy`
(Workers Scripts, D1, Cloudflare Pages, Workers R2 Storage — Edit), secret GitHub `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`. Lần merge đầu tiên vào `main` sẽ tự tạo D1 `trackingts` và dự án Pages `trackingts`
(địa chỉ dạng `https://<tên>.pages.dev`; Cloudflare thêm hậu tố ngẫu nhiên nếu tên đã có người dùng, vd. `trackingts-90q` — xem đúng địa chỉ ở **Workers & Pages → dự án**, hoặc dòng *Deployment complete* trong log Actions).
**Đổi tên / địa chỉ:** tên dự án Pages không đổi được sau khi tạo. Muốn tên khác: GitHub → Variables → thêm `PAGES_PROJECT` (vd. `comhanoi`) → Run workflow (tạo dự án mới, D1 và dữ liệu giữ nguyên) → sửa *Destinations* của ứng dụng Access sang địa chỉ mới → xoá dự án cũ.
Khi chưa bật Access, API **từ chối mọi yêu cầu** (chỉ `/api/health` trả lời) — không lộ dữ liệu.

### Bật Cloudflare Access (bước 5)
1. dash.cloudflare.com → **Zero Trust** → đặt **team name** (vd. `trackingts-team`) → chọn gói **Free**.
2. **Settings → Authentication → Login methods**: *One-time PIN* có sẵn (mã gửi qua email). Tuỳ chọn thêm **Google**.
3. **Access → Applications → Add an application → Self-hosted**:
   - *Application name*: `trackingts` · *Session Duration*: **1 month** (giữ đăng nhập 30 ngày).
   - *Domain*: địa chỉ Pages ở trên (vd. `<tên>.pages.dev`).
   - *Policy*: tên `Team`, *Action* **Allow**, *Include* → **Everyone** (ai cũng nhận được mã PIN qua email để đăng nhập).
     **Không cần nhập danh sách email ở Cloudflare**: ai được vào xem dữ liệu do máy chủ quyết định theo trang
     **Tài khoản & phân quyền** (email chưa gắn nhân viên hoặc đã khoá thì máy chủ từ chối mọi dữ liệu).
     Đang dùng policy *Emails* cũ thì mở policy → đổi *Include* sang **Everyone** → Save.
   - Lưu. Mở lại ứng dụng vừa tạo → chép **Application Audience (AUD) Tag**.
4. GitHub → **Settings → Secrets and variables → Actions**:
   - Tab **Variables**: `ACCESS_TEAM_DOMAIN` = team name; `ACCESS_AUD` = AUD Tag vừa chép.
   - Tab **Secrets**: `ADMIN_EMAILS` = email của admin (nhiều email cách nhau dấu phẩy) — người được vào với quyền
     admin ngay cả khi chưa gắn với nhân viên nào.
   - Ba giá trị này được `scripts/write-vars.mjs` ghi vào `wrangler.toml` của **lần triển khai** (không commit), nên
     đổi giá trị thì chỉ cần **Run workflow** lại. Kiểm tra: `/api/health` (sau khi đăng nhập) trả `auth:true` và
     mục `config` cho biết giá trị nào còn thiếu (chỉ báo true/false, không lộ giá trị).
5. **Actions → Cloudflare → Run workflow** (nhánh `main`) để áp dụng. Mở địa chỉ Pages → đăng nhập bằng mã gửi qua email
   → vào `tools/accounts/` → chọn file sao lưu .json (Thống kê giờ công → Cập nhật Data → ⬇ Tải bản sao lưu) →
   **Đưa lên máy chủ** → gắn email cho từng người → phân công Site Sup / Quản lý dự án cho dự án.

### Email tự động (Brevo)
Gói miễn phí của Brevo gửi tối đa 300 thư mỗi ngày — dư cho nhóm dưới 20 người.
1. Tạo tài khoản **brevo.com**, *Senders, Domains & Dedicated IPs → Senders → Add a sender*: tên `Bộ công cụ dự án`, email là một Gmail riêng (vd. `nihan.timesheet@gmail.com`), xác nhận qua mã gửi vào Gmail đó.
2. *SMTP & API → API Keys → Generate a new API key* (chỉ hiện một lần). Nếu có mục *Security → Authorized IPs* đang bật thì **tắt** (máy chủ Cloudflare đổi IP liên tục).
3. GitHub → **Settings → Secrets and variables → Actions**: Secret `BREVO_API_KEY` = khoá vừa tạo; Variables `MAIL_FROM` = Gmail đã xác minh, `MAIL_FROM_NAME` = tên người gửi hiển thị trong thư, vd. `Phòng NI Hà Nội` (đổi được bất cứ lúc nào: sửa biến này rồi chạy lại workflow).
4. Khoá Cloudflare dùng để triển khai (`CLOUDFLARE_API_TOKEN`) cần thêm quyền **Account → Workers Scripts → Edit** (Cloudflare → My Profile → API Tokens → Edit). Thiếu quyền này thì bước *Email tự động (Worker theo lịch)* báo lỗi nhưng giao diện vẫn triển khai bình thường.
5. **Run workflow** (hoặc merge một thay đổi). Vào **Tài khoản & phân quyền → 6. Email tự động** → *Gửi thử một email cho tôi* để kiểm tra.

Cách hoạt động: thư báo nộp / duyệt / trả lại gửi ngay từ API (`server/notify.mjs`); báo cáo cuối ngày và nhắc hạn do Worker theo lịch `cron/worker.mjs`
(18:30 và 08:00 giờ Việt Nam) gửi, dùng chung D1; bảng `mail_log` chống gửi trùng khi chạy lại. Khoá API được ghi vào cấu hình triển khai
(`[vars]`, không commit) giống các giá trị đăng nhập; người xem được Cloudflare dashboard của bạn mới thấy. Người nhận: Site Sup / Quản lý dự án được gán cho dự án
(hoặc *Quản lý trực tiếp* của fitter); không ai phụ trách thì gửi admin. Mỗi lần chạy gửi tối đa 40 thư (giới hạn lệnh gọi của gói miễn phí).

### Chế độ máy chủ của giao diện (bản `*.pages.dev`)
`scripts/build-pages.mjs` đóng gói **cùng mã nguồn** với bản github.io nhưng đặt chế độ máy chủ (bản github.io không đổi):
- `js/session.js`: `SERVER_MODE = true` → **không còn đăng nhập họ tên + mã NV**. Danh tính do Cloudflare Access xác thực email,
  `/api/me` cho biết là ai và vai trò gì (Admin / Quản lý dự án / Site Sup / nhân viên). Phiên chỉ là bản lưu đệm 7 ngày và được
  hỏi lại máy chủ mỗi lần mở trang: đổi vai trò, khoá tài khoản có hiệu lực ngay. Đăng xuất kết thúc luôn phiên Access.
- `js/config.js` được **thay bằng bản tối giản** (`{ SERVER: true, PM_SYNC_URL: '/api/pm-store' }`): khoá Google, mã băm mật khẩu admin
  không được chép sang bản máy chủ.
- `js/cloud.js`: nhân viên + dự án đọc từ `/api/employees`, `/api/projects` (nút **Đồng bộ ngay** vẫn dùng như cũ; tự đồng bộ khi dữ liệu
  trên máy cũ quá 1 giờ).
- **Bảng công của Thống kê giờ công** nằm trên máy chủ (bảng `timesheets` trong D1, migration `0004`). Trang Thống kê giờ công tự tải về
  khi có bản mới (theo trang 1000 dòng; chỉ trang này tải, các chức năng khác chỉ lấy nhân viên + dự án). Admin nhập bảng công như cũ
  (**Cập nhật Data** → mục *Bổ sung Bảng công*, hoặc *Nạp bản sao lưu .json*) rồi bấm **Lưu lên máy chủ**: máy chủ nhận từng đợt
  160 dòng vào một "đợt" riêng và chỉ **chuyển sang dùng khi đủ dòng** (lỗi giữa chừng thì bản đang dùng không đổi). Có chặn ghi đè nhầm
  giống bản Drive (mất hơn 20% dòng / máy chủ có bản mới hơn → phải gõ `LUU`), và máy admin còn chỉnh sửa chưa lưu thì đồng bộ
  **không ghi đè**. Nhân viên + dự án quản lý ở trang *Tài khoản* nên mục nhập nhân viên / dự án bị ẩn ở bản này.
- **Timesheet cá nhân** lưu online theo kỳ lương (bảng `ts_docs`, migration `0005`; `GET/PUT /api/ts/docs/:kỳ`): chấm công trên máy trước rồi tự đồng bộ,
  gộp theo dòng khi sửa trên nhiều máy, có số phiên bản; chỉ chủ tài khoản đọc / ghi bảng công của mình; kỳ đã nộp / đã duyệt bị khoá (HTTP 423).
- **Nộp & duyệt bảng công hai cấp** (migration `0006`; trang `tools/approvals/` — chức năng **Duyệt bảng công** trên trang chủ cho Site Sup / Quản lý dự án / Admin):
  `POST /api/ts/docs/:kỳ/submit|withdraw`, `GET /api/ts/inbox`, `GET /api/ts/review/:mã NV/:kỳ`, `POST …/approve|reject`.
  Ai duyệt được: ở cấp **Site Sup** — Site Sup được gán cho một dự án (WBS) có trong bảng công (trang Tài khoản → Phân công dự án) hoặc là *Quản lý trực tiếp*
  của người nộp; ở cấp **Quản lý dự án** — người được gán Quản lý dự án cho một dự án trong bảng công; Admin duyệt thay được. (Bảng công nhiều dự án:
  một người phụ trách ở cấp đó duyệt là đủ.) Duyệt xong cấp cuối, dòng được **đẩy sang bảng `timesheets`** (cột `src = ts:<mã NV>:<kỳ>`), thay các dòng cũ của
  người đó trong kỳ (duyệt lại không nhân đôi); admin nạp lại bảng công từ Excel thì dòng đã duyệt **được giữ** ở những ngày bản nạp mới chưa có dòng của người đó.
  Phân loại giờ (thường / OT) do trình duyệt tính bằng `labor.js` (chạy trên máy chủ gói miễn phí quá giới hạn CPU) và máy chủ kiểm tra tổng; người duyệt thấy
  cảnh báo nếu phân loại khác kết quả tính lại.
- **Email tự động qua Brevo** (xem mục *Email tự động* bên dưới): thông báo khi có bảng công chờ duyệt / được duyệt / bị trả lại; báo cáo thi công cuối
  ngày (18:30) gửi Site Sup & Quản lý dự án; nhắc hạn nộp (8:00 ngày 9 và 11). Chưa cấu hình Brevo thì hệ thống vẫn chạy bình thường, chỉ không gửi thư;
  fitter vẫn tự gửi thư được bằng nút **Báo cáo ngày** / **Gửi mail** trong Timesheet. Sao lưu dữ liệu: D1 có sẵn *Time Travel* (khôi phục về bất kỳ phút nào
  trong 30 ngày gần nhất, không tốn thêm phí — Cloudflare → D1 → cơ sở dữ liệu → *Time Travel*).
- **Sửa / xoá dự án và Swat Hour Target** (tab Dự án, tab SWAT) ghi thẳng lên máy chủ (`PATCH /api/admin/projects/:wbs`, `POST /api/admin/projects/delete`,
  chỉ admin, có nhật ký). Ghi lên máy chủ **trước**, lỗi thì báo và không đổi gì trên máy — nên đồng bộ không làm mất. Chỉ gửi các trường vừa sửa
  nên không đè thay đổi của người khác.
- **Quản lý dự án**: kho dữ liệu chung lưu trong D1 (`/api/pm-store`, có số phiên bản + gộp khi hai người cùng sửa) thay cho Apps Script.
- Thống kê giờ công: quyền admin theo máy chủ, không còn chữ "Drive". **Chưa chuyển:** Timesheet cá nhân lưu online + luồng duyệt
  (giai đoạn 4).

**Danh sách email chỉ ở một nơi:** trang Tài khoản (ai là ai, vai trò gì, ai bị khoá). Cloudflare Access chỉ xác minh *email này đúng là của bạn*
(mã PIN gửi qua email) và cho mọi email qua cửa; máy chủ kiểm tra từng yêu cầu: email chưa gắn với nhân viên (hoặc đã bị khoá) **không** lấy được dữ liệu.
Người lạ có thể thấy trang đăng nhập và giao diện (mã nguồn không chứa dữ liệu) nhưng không thấy nhân viên, dự án, bảng công nào.

---

### Mục Quản trị (`admin.html`) — chỉ admin

Dữ liệu nền của hệ thống không còn nằm trong “Thống kê giờ công” mà gom vào **Quản trị** (thẻ riêng trên trang chủ, chỉ hiện với admin; người khác mở thẳng địa chỉ cũng bị chuyển về trang chủ):

| Tab | Nội dung |
|---|---|
| Nhân viên | EE Data: thêm / sửa / xoá nhân viên |
| Dự án | Danh sách dự án, thông số thang, Swat Target Hour |
| Bảng công | Bảng “Theo dõi giờ công” — **nạp Excel hàng tháng** (nút *Cập nhật Data*, rồi *Lưu lên máy chủ* / *Lưu lên Drive*) |
| Tài khoản & phân quyền | (bản Cloudflare) gắn email, vai trò, phân công Site Sup / Quản lý dự án — trang `tools/accounts/` nhúng vào |

Trên bản Cloudflare, **hai nguồn bảng công chạy song song**: (1) admin nạp file Excel hàng tháng như bản GitHub; (2) bảng công do nhân viên tự chấm công (Timesheet cá nhân) tự đẩy vào bảng Theo dõi giờ công khi Quản lý bấm phê duyệt. Nạp lại Excel không làm mất các dòng đã duyệt (dòng có nguồn “approved” được giữ cho những ngày Excel chưa có). “Thống kê giờ công” chỉ còn Dashboard, Bảng công (xem) và SWAT.

### Chế độ Demo (chạy thử, không ảnh hưởng dữ liệu thật)

- Mọi người dùng được vào app (đã qua Cloudflare Access) bấm **🧪 Chạy thử (Demo)** ở chân trang chủ, chọn vai trò *Fitter (Phạm Minh Dũng) / Site Sup (Trần Thị Bình) / Quản lý dự án (Nguyễn Văn An) / Quản trị viên* — dữ liệu mẫu (8 nhân viên, 4 dự án, ~110 dòng bảng công, 1 bảng công chờ Site Sup, 1 chờ QLDA, kỳ trước của Fitter đã chấm đủ chờ nộp) được dựng sẵn.
- **Đổi vai trò giữ nguyên dữ liệu** (`POST /api/demo/role` chỉ chuyển email người thử sang nhân viên mẫu khác) → thử trọn luồng Fitter nộp → Site Sup duyệt → QLDA duyệt → vào bảng Theo dõi giờ công. Các nhân viên mẫu khác có email giả `<mã>@demo.invalid`.
- Dùng **cơ sở dữ liệu D1 riêng `trackingts-demo`** (binding `DB_DEMO`), tự tạo khi triển khai (`.github/workflows/cloudflare.yml`). Cookie `ts_demo` làm máy chủ chuyển mọi yêu cầu sang cơ sở dữ liệu này; danh sách admin khởi tạo (`ADMIN_EMAILS`) không có hiệu lực — vai trò do người dùng chọn.
- **Email trong demo vẫn gửi thật qua Brevo nhưng LUÔN chỉ tới email của người đang thử** (email đăng nhập Cloudflare Access), không bao giờ tới địa chỉ khác: tiêu đề có `[DEMO]`, đầu thư có khung vàng "THƯ DEMO" ghi rõ trong hệ thống thật thư sẽ gửi tới ai. Tối đa 60 thư demo / ngày (để không dùng hết 300 thư/ngày của gói miễn phí). Thư tự soạn trong Timesheet ở chế độ demo cũng có `[DEMO]` ở tiêu đề.
- Trên trình duyệt, khoá `localStorage` / `sessionStorage` / IndexedDB được đổi tên có tiền tố `demo:` / `demo_` nên **bảng công cá nhân và phiên đăng nhập thật không bị đụng**; thoát demo thì dữ liệu demo trên trình duyệt được dọn.
- Thanh vàng ở đầu mọi trang: *Làm mới dữ liệu demo* (dựng lại dữ liệu mẫu), *Đổi vai trò*, *Thoát demo*. Mã: `server/demo.mjs`, `js/demo.js`.
- Nếu bước tạo D1 demo lỗi khi triển khai, workflow tự gỡ binding và chỉ tắt demo (nút không hiện), bản chính vẫn triển khai bình thường.

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

**Chặn ghi đè nhầm:** trước khi lưu, app tải bản đang có trên Drive để so sánh. Nếu máy này **mất hơn 20%**
nhân viên / dự án / dòng bảng công (với loại có từ 20 dòng trở lên; loại ít hơn thì chỉ khi máy này trống hẳn),
hoặc bản trên Drive **mới hơn** bản máy này đang có, hoặc không đọc được bản trên Drive → app **dừng lại**, liệt kê
chênh lệch và chỉ lưu khi gõ `LUU`. Thường nên bấm Huỷ, tải lại trang (lấy bản mới nhất) rồi làm lại; gõ `LUU`
khi cố ý (vừa khôi phục phiên bản cũ, hoặc vừa xoá dữ liệu sai).

## Giảm rủi ro khi còn dùng Google Drive

File dữ liệu trên Drive **ai có link cũng tải được** và đăng nhập Bộ công cụ chỉ là họ tên + mã NV, nên đây chỉ là
lớp bảo vệ tạm thời. Ba việc admin nên làm (mỗi việc vài phút):

1. **Giới hạn API key** — [console.cloud.google.com](https://console.cloud.google.com) → đúng project →
   **APIs & Services → Credentials** → bấm vào API key đang dùng:
   - *Application restrictions*: **Websites** → **Add** `https://xaxa9ztb.github.io/*` (thêm `http://localhost:5173/*`
     nếu còn chạy thử trên máy) → *API restrictions*: **Restrict key** → chỉ chọn **Google Drive API** → **Save**.
   - Mở lại Bộ công cụ, bấm **Đồng bộ ngay** ở trang chủ để chắc vẫn tải được (thay đổi có thể mất ~5 phút).
   - Chỉ chặn người khác dùng key của bạn làm hết hạn mức; **không** làm file Drive hết công khai.
2. **Đổi mật khẩu admin dài** (từ 16 ký tự, vd. một câu 4–5 từ không dấu): mở trang Thống kê giờ công → F12 →
   Console → `await hashPassword('mật-khẩu-mới')` → dán kết quả vào `ADMIN_PASSWORD_HASH` của `js/config.js` trên
   GitHub → Commit → chờ 1–2 phút, tải lại trang **2 lần** (lần đầu trình duyệt còn dùng bản lưu đệm).
   Nếu đã triển khai kho Quản lý dự án (`PM_SYNC_URL`): tạo lại `ADMIN_KEY` theo
   [`apps-script/HUONG-DAN.md`](tools/projectplan/apps-script/HUONG-DAN.md) bước 6 bằng mật khẩu mới.
3. **Tài khoản Google dự phòng** (khi mất tài khoản chính vẫn cứu được dữ liệu):
   - drive.google.com → chuột phải `timesheet-data.json` → **Chia sẻ** → thêm email dự phòng, quyền **Người chỉnh sửa**.
   - Google Cloud Console → **IAM & Admin → IAM** → **Grant access** → email dự phòng, vai trò **Owner**.
   - **OAuth consent screen → Test users** → thêm email dự phòng.
   - Tài khoản dự phòng dùng để **giữ quyền truy cập và lịch sử phiên bản**, không dùng để bấm *Lưu lên Drive*
     hằng ngày (quyền `drive.file` của app chỉ ghi được file do chính tài khoản đó tạo qua app). Khi mất tài khoản chính:
     đăng nhập bằng tài khoản dự phòng, tải file về máy → **Cập nhật Data → ⬆ Nạp bản sao lưu (.json)** (nhận được
     cả file tải thẳng từ Drive) → `await Cloud.createDriveFile()`
     (bước 4) → thay `DRIVE_FILE_ID` mới vào `config.js`.

## Sự cố thường gặp

| Hiện tượng | Nguyên nhân / cách xử lý |
|---|---|
| "Không tải được từ Drive" | Kiểm tra `DRIVE_FILE_ID`, `GOOGLE_API_KEY` trong config.js; API key phải cho phép domain github.io |
| Đăng nhập Google báo lỗi `origin_mismatch` | Thêm đúng domain vào **Authorized JavaScript origins** (bước 3.5) |
| Đăng nhập báo app chưa xác minh / access denied | Thêm email của bạn vào **Test users** (bước 3.4) |
| Quên mật khẩu admin | Tạo hash mới (bước 1) và sửa `config.js` trên GitHub |
| Muốn đổi dữ liệu về bản cũ | Google Drive giữ lịch sử phiên bản: mở drive.google.com → chuột phải file `timesheet-data.json` → Manage versions |
| Sửa code xong nhưng trang vẫn chạy bản cũ | Trình duyệt/GitHub Pages cache file css/js. Khi cập nhật code, tăng số version `?v=...` ở các dòng `<link>`/`<script>` trong `tracking.html` (ví dụ `?v=2` → `?v=3`); người xem chỉ cần tải lại trang. Chữa cháy nhanh: Ctrl+F5 |
