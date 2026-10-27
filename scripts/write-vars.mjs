// Ghi cấu hình (đăng nhập: ACCESS_TEAM_DOMAIN, ACCESS_AUD, ADMIN_EMAILS; gửi email: BREVO_API_KEY, MAIL_FROM, MAIL_FROM_NAME, APP_URL)
// vào wrangler.toml TRƯỚC khi triển khai, để giá trị đi cùng bản triển khai (không phụ thuộc secret riêng của dự án Pages).
// Dùng:  node scripts/write-vars.mjs [--file cron/wrangler.toml] [--keys A,B,C]
// Chỉ chạy trên máy chủ CI; file đã sửa KHÔNG được commit.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = (name) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : ''; };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.resolve(ROOT, arg('file') || 'wrangler.toml');
const ALL_RULES = {
  BREVO_API_KEY: /^[A-Za-z0-9_.-]{20,300}$/,
  MAIL_FROM: /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/,
  MAIL_FROM_NAME: /^[^\u0000-\u001f"\\]{1,100}$/,
  APP_URL: /^https:\/\/[A-Za-z0-9.-]{3,200}$/,
  ACCESS_TEAM_DOMAIN: /^[A-Za-z0-9.-]{1,100}$/,
  ACCESS_AUD: /^[A-Za-z0-9]{16,128}$/,
  ADMIN_EMAILS: /^[^\s,;@]+@[^\s,;@]+(\s*[,;]\s*[^\s,;@]+@[^\s,;@]+)*$/,
};
const wanted = (arg('keys') || 'ACCESS_TEAM_DOMAIN,ACCESS_AUD,ADMIN_EMAILS,BREVO_API_KEY,MAIL_FROM,MAIL_FROM_NAME').split(',').map(x => x.trim()).filter(Boolean);
const RULES = Object.fromEntries(wanted.map(k => { if (!ALL_RULES[k]) { console.error(`::error::Không biết khoá ${k}`); process.exit(1); } return [k, ALL_RULES[k]]; }));

const lines = [];
for (const [key, re] of Object.entries(RULES)) {
  const v = String(process.env[key] || '').trim();
  if (!v) { console.log(`${key} chưa khai báo — bỏ qua`); continue; }
  if (!re.test(v)) { console.error(`::error::${key} có định dạng không hợp lệ — kiểm tra lại giá trị trên GitHub`); process.exit(1); }
  lines.push(`${key} = ${JSON.stringify(v)}`);
  console.log(`${key} đã khai báo`);
}
if (lines.length) {
  const toml = readFileSync(FILE, 'utf8').replace(/\n\[vars\][\s\S]*?(?=\n\[|$)/, '');
  writeFileSync(FILE, toml.replace(/\s*$/, '\n') + '\n[vars]\n' + lines.join('\n') + '\n');
}
