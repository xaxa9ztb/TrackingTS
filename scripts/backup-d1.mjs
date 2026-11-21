// Sao lưu tự động toàn bộ D1 → Google Drive (chạy trên GitHub Actions, .github/workflows/backup.yml — 2 lần / tuần).
// Đọc từng bảng theo trang bằng `wrangler d1 execute --remote --json`, tạo file .json.gz CÙNG ĐỊNH DẠNG với bản sao lưu
// tải về từ trang Quản trị (server/backup.mjs), rồi gửi tới Web app Apps Script (tools/backup/apps-script/Code.gs) —
// Apps Script tự giữ tối đa 10 bản mới nhất.
// BACKUP_LOCAL=1: đọc D1 cục bộ (chỉ để thử script trên máy).
// Biến môi trường: DB_NAME (mặc định trackingts), BACKUP_DRIVE_URL, BACKUP_DRIVE_TOKEN, [OUT] (ghi thêm file ra đĩa — chỉ để thử)
// KHÔNG in dữ liệu ra nhật ký (repo công khai: nhật ký Actions ai cũng xem được).
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const DB = process.env.DB_NAME || 'trackingts';
const SKIP = /^(sqlite_|_cf_|d1_migrations$)/;
const q = (n) => '"' + String(n).replace(/"/g, '""') + '"';

function sql(command) {
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', DB, process.env.BACKUP_LOCAL ? '--local' : '--remote', '--json', '--command', command],
    { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const j = JSON.parse(out.slice(out.indexOf('[')));
  const r = Array.isArray(j) ? j[0] : j;
  if (!r || r.success === false) throw new Error('Truy vấn D1 lỗi');
  return r.results || [];
}

const tables = sql("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").map(r => r.name).filter(n => !SKIP.test(n));
const mig = (() => { try { const r = sql('SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 1'); return r[0] ? r[0].name : ''; } catch (e) { return ''; } })();
const backup = { format: 'trackingts-backup', version: 1, createdAt: new Date().toISOString(), createdBy: 'GitHub Actions', source: 'auto', schema: mig, tables: {} };
let total = 0;
for (const t of tables) {
  const info = sql(`PRAGMA table_info(${q(t)})`);
  const columns = info.map(c => c.name), blobs = info.filter(c => /BLOB/i.test(c.type || '')).map(c => c.name);
  const sel = columns.map(c => (blobs.includes(c) ? `CASE WHEN ${q(c)} IS NULL THEN NULL ELSE lower(hex(${q(c)})) END AS ${q(c)}` : q(c))).join(', ');
  const limit = blobs.length ? 5 : 5000, rows = [];
  let after = 0;
  for (;;) {
    const page = sql(`SELECT rowid AS __rid, ${sel} FROM ${q(t)} WHERE rowid > ${after} ORDER BY rowid LIMIT ${limit}`);
    for (const r of page) rows.push(columns.map(c => (r[c] === undefined ? null : r[c])));
    if (page.length < limit) break;
    after = page[page.length - 1].__rid;
  }
  backup.tables[t] = { columns, blobs, rows };
  total += rows.length;
  console.log(`${t}: ${rows.length} dòng`);
}

const gz = gzipSync(Buffer.from(JSON.stringify(backup)));
const stamp = backup.createdAt.slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
const name = `trackingts-backup-${stamp}-auto.json.gz`;
console.log(`Tổng ${tables.length} bảng, ${total} dòng — ${(gz.length / 1024 / 1024).toFixed(2)} MB nén`);
if (process.env.OUT) writeFileSync(process.env.OUT, gz);

const url = String(process.env.BACKUP_DRIVE_URL || '').trim(), token = String(process.env.BACKUP_DRIVE_TOKEN || '').trim();
if (!url || !token) { console.log('::warning::Chưa có BACKUP_DRIVE_URL / BACKUP_DRIVE_TOKEN — không đẩy lên Google Drive'); process.exit(process.env.OUT ? 0 : 1); }
const resp = await fetch(url, { method: 'POST', redirect: 'follow', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ token, action: 'upload', name, b64: gz.toString('base64'), note: 'Sao lưu tự động (GitHub Actions)' }) });
let d = null; try { d = await resp.json(); } catch (e) { /* không phải JSON */ }
if (!resp.ok || !d || d.error || !d.ok) { console.error(`::error::Đẩy lên Google Drive thất bại: ${(d && d.error) || 'HTTP ' + resp.status}`); process.exit(1); }
console.log(`Đã lưu ${name} lên Google Drive${d.pruned ? `; đã xoá ${d.pruned} bản cũ (giữ tối đa 10)` : ''}`);
