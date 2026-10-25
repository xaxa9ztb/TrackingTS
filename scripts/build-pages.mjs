// Gom các file giao diện vào dist/ để đưa lên Cloudflare Pages (thư mục functions/ ở gốc repo
// được wrangler đóng gói riêng thành /api). Không đưa mã máy chủ, kiểm thử, tài liệu nội bộ lên.
import { cpSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');

const INCLUDE = ['index.html', 'tracking.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons', 'tools',
  'docs/Huong-dan-su-dung-nguoi-dung.pdf']; // trang chủ + Thống kê giờ công có link tới file này
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

// Header bảo mật cho mọi trang (Cloudflare Pages đọc file _headers)
writeFileSync(path.join(OUT, '_headers'), [
  '/*',
  '  X-Content-Type-Options: nosniff',
  '  Referrer-Policy: strict-origin-when-cross-origin',
  '  X-Frame-Options: SAMEORIGIN',
  '',
].join('\n'));

console.log('Đã gom giao diện vào', path.relative(ROOT, OUT) + '/');
