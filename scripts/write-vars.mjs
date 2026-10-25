// Ghi cấu hình đăng nhập (ACCESS_TEAM_DOMAIN, ACCESS_AUD, ADMIN_EMAILS) vào wrangler.toml TRƯỚC khi
// triển khai, để giá trị đi cùng bản triển khai (không phụ thuộc secret riêng của dự án Pages).
// Chỉ chạy trên máy chủ CI; wrangler.toml đã sửa KHÔNG được commit.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'wrangler.toml');
const RULES = {
  ACCESS_TEAM_DOMAIN: /^[A-Za-z0-9.-]{1,100}$/,
  ACCESS_AUD: /^[A-Za-z0-9]{16,128}$/,
  ADMIN_EMAILS: /^[^\s,;@]+@[^\s,;@]+(\s*[,;]\s*[^\s,;@]+@[^\s,;@]+)*$/,
};

const lines = [];
for (const [key, re] of Object.entries(RULES)) {
  const v = String(process.env[key] || '').trim();
  if (!v) { console.log(`${key} chưa khai báo — bỏ qua (API sẽ từ chối mọi yêu cầu cho tới khi có đủ cấu hình)`); continue; }
  if (!re.test(v)) { console.error(`::error::${key} có định dạng không hợp lệ — kiểm tra lại giá trị trên GitHub`); process.exit(1); }
  lines.push(`${key} = ${JSON.stringify(v)}`);
  console.log(`${key} đã khai báo`);
}
if (lines.length) {
  const toml = readFileSync(FILE, 'utf8').replace(/\n\[vars\][\s\S]*?(?=\n\[|$)/, '');
  writeFileSync(FILE, toml.replace(/\s*$/, '\n') + '\n[vars]\n' + lines.join('\n') + '\n');
}
