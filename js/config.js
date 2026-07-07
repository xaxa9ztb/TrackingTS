// ============================================================
// CẤU HÌNH TRIỂN KHAI ONLINE
// Điền các giá trị theo hướng dẫn trong README-DEPLOY.md.
// Để trống tất cả = chạy cục bộ như bình thường (không khoá admin,
// dữ liệu chỉ nằm trong trình duyệt).
// ============================================================
window.CONFIG = {
  // ID file timesheet-data.json trên Google Drive (bước 4 trong hướng dẫn)
  DRIVE_FILE_ID: '13uhqhaSv7ftZ7OUr6SYcSQiYr-BMANcp',

  // API key của Google Cloud - để mọi người ĐỌC dữ liệu công khai (bước 3)
  GOOGLE_API_KEY: 'AIzaSyB20Mngfbb8H8UynhThD_wzOqd1hoPFytw',

  // OAuth Client ID - để admin đăng nhập Google và GHI dữ liệu (bước 3)
  GOOGLE_CLIENT_ID: '582334439349-v5atdq870ta952hh7trdnk99v21gflv5.apps.googleusercontent.com',

  // SHA-256 (hex) của mật khẩu admin. Tạo bằng cách mở Console (F12) trên app
  // và chạy:  await hashPassword('mật-khẩu-của-bạn')
  // Để trống = không khoá (chỉ nên để trống khi chạy cục bộ).
  ADMIN_PASSWORD_HASH: '6edcd46c8c68d46dbf4fc318b2edb4f88cb556c4d8c4473c3a8ac67b3d9106e8',
};
