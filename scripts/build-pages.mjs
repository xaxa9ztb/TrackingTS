// Gom các file giao diện vào dist/ để đưa lên Cloudflare Pages (thư mục functions/ ở gốc repo
// được wrangler đóng gói riêng thành /api). Không đưa mã máy chủ, kiểm thử, tài liệu nội bộ lên.
import { cpSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');

const INCLUDE = ['index.html', 'tracking.html', 'admin.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons', 'tools',
  'docs/Huong-dan-su-dung-nguoi-dung.pdf', // trang chủ + Thống kê giờ công có link tới file này
  'huong-dan.html', 'docs/huong-dan', // tài liệu hướng dẫn sử dụng + ảnh minh họa
  'huong-dan-timesheet.html', 'docs/Huong-dan-Timesheet-ca-nhan.pdf', 'docs/video']; // tài liệu training + video Timesheet cá nhân
const SKIP = /(^|\/)(node_modules|package(-lock)?\.json)(\/|$)/;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const item of INCLUDE) {
  const src = path.join(ROOT, item);
  if (!existsSync(src)) throw new Error('Thiếu ' + item);
  cpSync(src, path.join(OUT, item), {
    recursive: true,
    filter: (p) => !SKIP.test(path.relative(ROOT, p).split(path.sep).join('/')),
  });
}

// ---- Chế độ máy chủ cho bản Cloudflare (bản github.io giữ nguyên, không bị đổi) ----
// 1. Session: danh tính + vai trò lấy từ /api/me (Cloudflare Access đã xác thực email)
const sessionFile = path.join(OUT, 'js', 'session.js');
const sessionSrc = readFileSync(sessionFile, 'utf8');
if (sessionSrc.split('const SERVER_MODE = false;').length !== 2) throw new Error('js/session.js phải có đúng một dòng "const SERVER_MODE = false;"');
writeFileSync(sessionFile, sessionSrc.replace('const SERVER_MODE = false;', 'const SERVER_MODE = true;'));
// 2. Cấu hình tối giản: KHÔNG chép khoá Google, mã băm mật khẩu admin… sang bản máy chủ
writeFileSync(path.join(OUT, 'js', 'config.js'),
  '// Bản máy chủ Cloudflare — sinh tự động bởi scripts/build-pages.mjs. Quyền do máy chủ cấp (Cloudflare Access + /api).\n' +
  "window.CONFIG = { SERVER: true, PM_SYNC_URL: '/api/pm-store' };\n");

// Header bảo mật cho mọi trang (Cloudflare Pages đọc file _headers)
writeFileSync(path.join(OUT, '_headers'), [
  '/*',
  '  X-Content-Type-Options: nosniff',
  '  Referrer-Policy: strict-origin-when-cross-origin',
  '  X-Frame-Options: SAMEORIGIN',
  '',
].join('\n'));

console.log('Đã gom giao diện vào', path.relative(ROOT, OUT) + '/');
