# Nghiên cứu: duyệt bảng công bằng nút bấm trong email (người duyệt không có tài khoản app)

> Tài liệu nghiên cứu / đề xuất — **chưa triển khai**. Cần anh/chị chọn phương án ở mục 6 trước khi làm.

## 1. Bối cảnh

Hiện mọi người duyệt (Site Sup, Quản lý dự án, Admin) phải đăng nhập app qua Cloudflare Access (mã OTP gửi email) rồi vào trang *Duyệt bảng công*.
Một số Site Sup / Quản lý dự án **thỉnh thoảng mới phải duyệt** (không xử lý hằng tháng) và không có tài khoản app. Mong muốn: nhận email → bấm nút **Duyệt** (hoặc **Trả lại**) ngay trong thư.

## 2. Ràng buộc kỹ thuật hiện tại

- Toàn bộ `/api/*` và các trang nằm sau **Cloudflare Access**. Người ngoài danh sách không vào được, kể cả bấm link trong mail.
- Người duyệt được xác định bằng `employees.email` + vai trò + `project_staff` (Site Sup / PM theo WBS). Người không có tài khoản **không có dòng trong `employees`** nên hệ thống không biết họ là ai.
- Quy trình 3 cấp: Site Sup (mọi dự án liên quan) → Quản lý dự án → Admin xử lý; cấp cuối luôn do Admin/Admin dự án bấm trong app (kèm tạo file Excel đính kèm trên trình duyệt) nên **không** đưa vào duyệt qua email.
- Mail gửi qua Brevo; mỗi người nhận có thể có link riêng (đã dùng `messageVersions`).

## 3. Các phương án

### A. Link ký số dùng một lần ("magic link") — khuyến nghị
Mỗi mail gửi tới người duyệt kèm 2 nút **Duyệt** / **Trả lại**. Mỗi nút là URL chứa **token ngẫu nhiên** (≥128 bit) lưu trong bảng mới `approval_tokens(token_hash, emp_id, period, level, approver_email, action, expires_at, used_at)`.

1. Bấm nút → mở trang xác nhận nhỏ `/a/<token>` (hiển thị: tên nhân viên, kỳ, số giờ, OT, dự án; ô ghi chú khi trả lại; nút **Xác nhận**). **Không** thực hiện hành động ngay khi GET, để trình quét link của máy chủ mail (Outlook Safe Links, Gmail) không vô tình duyệt hộ.
2. Xác nhận (POST) → máy chủ kiểm tra token chưa dùng, chưa hết hạn, bảng công còn đúng trạng thái/cấp → chạy chính hàm `decideDoc` hiện có, ghi `audit_log` với tên người duyệt + "qua email".
3. Token chỉ lưu dạng băm; dùng 1 lần; hết hạn (đề xuất 7 ngày hoặc đến hạn chốt công); tự vô hiệu khi bảng công đổi trạng thái, bị sửa (version đổi) hoặc đã có người khác duyệt đủ.
4. Cần mở một **đường ngoại lệ trong Cloudflare Access** (Bypass policy) cho đúng đường dẫn `/a/*` và `/api/mail-approve/*`; mọi đường khác vẫn bị bảo vệ.

Ưu: không phải tạo tài khoản; thao tác 2 chạm; tái dùng logic duyệt hiện có.
Nhược: ai chuyển tiếp (forward) thư thì người đó duyệt được → giảm rủi ro bằng token 1 lần + hết hạn + trang xác nhận + nhật ký.

### B. Magic link + xác nhận mã OTP qua email
Như A, nhưng trang xác nhận gửi thêm mã 6 số vào **đúng email người duyệt** và bắt nhập lại. Chống chuyển tiếp thư tốt hơn, nhưng thêm 1 bước (gần bằng đăng nhập Access) và cần xây thêm cơ chế OTP riêng. Chỉ nên làm nếu A bị coi là chưa đủ an toàn.

### C. Cấp tài khoản "người duyệt thỉnh thoảng"
Thêm họ vào Cloudflare Access (Everyone đã bật, nên thực chất họ đã đăng nhập được bằng OTP) và tạo dòng `employees` với vai trò Site Sup/PM. Không cần code mới, mỗi lần duyệt phải nhập OTP (~30 giây). Là phương án **an toàn nhất** và đơn giản nhất; hợp lý nếu số người ít.

### D. Trả lời email (reply-to-approve)
Người duyệt trả lời thư "OK". Cần nhận email vào (Brevo inbound / Cloudflare Email Routing), phân tích nội dung, rất dễ nhầm và khó chứng minh người gửi. **Không khuyến nghị.**

## 4. So sánh

| Tiêu chí | A. Magic link | B. Link + OTP | C. Tài khoản | D. Reply |
|---|---|---|---|---|
| Số thao tác của người duyệt | 2 | 3–4 | 3–4 | 2 |
| Cần tài khoản | Không | Không | Có | Không |
| Chống chuyển tiếp thư | Trung bình | Tốt | Tốt | Kém |
| Công sức làm | Vừa (~1–2 ngày) | Lớn | Không | Lớn, rủi ro |
| Thay đổi Cloudflare Access | Có (bypass 2 đường) | Có | Không | Có |

## 5. Rủi ro và biện pháp (nếu làm A)

- **Trình quét link tự mở URL:** nút chỉ mở trang xác nhận, hành động thực hiện bằng POST có token CSRF.
- **Lộ/chuyển tiếp thư:** token 1 lần, hết hạn nhanh, chỉ áp dụng cho đúng 1 cấp + 1 bảng công + 1 email người duyệt; ghi nhật ký IP, thời điểm.
- **Duyệt nhầm bảng công đã bị sửa:** token gắn `version` của bảng công; đổi version là vô hiệu.
- **Phạm vi:** chỉ cấp Site Sup và Quản lý dự án; trả lại (reject) bắt buộc ghi chú; cấp Admin vẫn duyệt trong app.
- **Giả mạo người duyệt:** chỉ tạo token cho những người đã được phân công trong `project_staff`; người nhận mail và người ghi vào nhật ký là một.
- **Người chưa có tài khoản:** cần nơi lưu email + họ tên của họ (ví dụ cột `email` ở `project_staff` hoặc bảng `external_approvers`) vì hiện `employees` mới có người có app.

## 6. Đề xuất

1. **Ngắn hạn:** dùng phương án **C** cho những người duyệt thỉnh thoảng — tạo tài khoản, họ đăng nhập bằng OTP (đã sửa Access sang Everyone).
2. **Nếu vẫn cần "bấm trong mail":** làm phương án **A** (magic link, 1 lần, có trang xác nhận), giới hạn cấp Site Sup/PM; bổ sung B sau nếu cần an toàn hơn.
3. Cần quyết định: (a) có chấp nhận ngoại lệ Cloudflare Access cho `/a/*`; (b) thời hạn token (7 ngày?); (c) nơi lưu danh bạ người duyệt ngoài app.

Ước tính A: 1 migration (`approval_tokens`), 2 endpoint (xem/xác nhận), trang `/a/`, thêm nút vào mail `submitted`/`sitesup_ok`, test; không đổi quy trình duyệt hiện có.
