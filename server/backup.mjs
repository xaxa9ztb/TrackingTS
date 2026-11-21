// Sao lưu & khôi phục TOÀN BỘ dữ liệu (mọi bảng D1) — chỉ Admin, không dùng trong chế độ demo.
// Định dạng bản sao lưu (file .json.gz, dùng chung cho bản tải về máy, bản trên Google Drive và bản tự động của GitHub Actions):
//   { format: 'trackingts-backup', version: 1, createdAt, createdBy, source: 'manual'|'auto', schema,
//     tables: { <tên bảng>: { columns: [...], blobs: [...cột nhị phân, giá trị dạng hex], rows: [[...], ...] } } }
// Trình duyệt đọc / ghi theo từng trang nhỏ (tránh giới hạn bộ nhớ, thời gian của máy chủ):
//   GET  /api/admin/backup/tables                → danh sách bảng (cột, cột nhị phân, số dòng, thứ tự phụ thuộc)
//   GET  /api/admin/backup/rows?table=&after=    → một trang dòng (theo rowid)
//   POST /api/admin/backup/restore/clear         → xoá sạch các bảng sắp khôi phục (bảng con trước)
//   POST /api/admin/backup/restore/rows          → chèn một trang dòng
//   POST /api/admin/backup/restore/done          → ghi nhật ký
// Google Drive (qua Apps Script của chủ tài khoản Drive — tools/backup/apps-script/Code.gs; giữ tối đa 10 bản):
//   GET  /api/admin/backup/drive                 → danh sách bản trên Drive
//   GET  /api/admin/backup/drive/file?id=        → tải một bản (file .json.gz)
//   POST /api/admin/backup/drive?name=           → đẩy bản sao lưu (nội dung file thô, header x-ts-upload: 1)
export const FORMAT = 'trackingts-backup';
export const SKIP_TABLE = /^(sqlite_|_cf_|d1_migrations$)/;
export const NAME_RE = /^trackingts-backup-[A-Za-z0-9_.-]{1,80}\.json\.gz$/;
const PAGE_ROWS = 500, PAGE_BLOB_ROWS = 2, PAGE_BYTES = 3 * 1024 * 1024;
const q = (n) => '"' + String(n).replace(/"/g, '""') + '"';

// thứ tự bảng: bảng cha (được tham chiếu) trước bảng con
export function topoOrder(list) {
  const by = new Map(list.map(t => [t.name, t])), out = [], seen = new Set(), stack = new Set();
  const visit = (n) => {
    if (seen.has(n) || stack.has(n) || !by.has(n)) return;
    stack.add(n); by.get(n).deps.forEach(visit); stack.delete(n); seen.add(n); out.push(by.get(n));
  };
  list.map(t => t.name).sort().forEach(visit);
  return out;
}

export async function tableList(env) {
  const { results } = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all();
  const out = [];
  for (const { name } of results) {
    if (SKIP_TABLE.test(name)) continue;
    const cols = (await env.DB.prepare(`PRAGMA table_info(${q(name)})`).all()).results || [];
    const fks = (await env.DB.prepare(`PRAGMA foreign_key_list(${q(name)})`).all()).results || [];
    const cnt = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${q(name)}`).first();
    out.push({ name, columns: cols.map(c => c.name), blobs: cols.filter(c => /BLOB/i.test(c.type || '')).map(c => c.name),
      deps: [...new Set(fks.map(f => f.table))].filter(t => t !== name), rows: cnt ? cnt.n : 0 });
  }
  return topoOrder(out);
}

const hexOf = (v) => { if (v == null) return null; const u = v instanceof Uint8Array ? v : new Uint8Array(v); let s = ''; for (let i = 0; i < u.length; i++) s += u[i].toString(16).padStart(2, '0'); return s; };
const bytesOfHex = (h) => { const s = String(h || ''); if (!/^(?:[0-9a-f]{2})*$/i.test(s)) return null; const u = new Uint8Array(s.length / 2); for (let i = 0; i < u.length; i++) u[i] = parseInt(s.substr(i * 2, 2), 16); return u; };
export function b64Encode(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
export function b64Decode(b64) { const s = atob(String(b64 || '')); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }

async function findTable(h, env, name) {
  const t = (await tableList(env)).find(x => x.name === name);
  if (!t) throw new h.HttpError(400, `Không có bảng “${name}” trong cơ sở dữ liệu`);
  return t;
}

async function rowsPage(h, env, url) {
  const t = await findTable(h, env, url.searchParams.get('table') || '');
  const after = Math.max(0, Number(url.searchParams.get('after')) || 0);
  const limit = t.blobs.length ? PAGE_BLOB_ROWS : PAGE_ROWS;
  const { results } = await env.DB.prepare(`SELECT rowid AS __rid, ${t.columns.map(q).join(', ')} FROM ${q(t.name)} WHERE rowid > ? ORDER BY rowid LIMIT ?`).bind(after, limit).all();
  const rows = []; let last = after, bytes = 0;
  for (const r of results) {
    const row = t.columns.map(c => (t.blobs.includes(c) ? hexOf(r[c]) : r[c]));
    rows.push(row); last = r.__rid;
    bytes += JSON.stringify(row).length; if (bytes > PAGE_BYTES) break;
  }
  return h.json({ table: t.name, columns: t.columns, blobs: t.blobs, rows, last, done: results.length < limit && rows.length === results.length });
}

async function restoreClear(h, env, me, request) {
  const b = await h.readJson(request);
  const list = await tableList(env), names = new Set(Array.isArray(b.tables) ? b.tables : []);
  const pick = list.filter(t => names.has(t.name)).reverse();   // bảng con trước
  if (!pick.length) throw new h.HttpError(400, 'Bản sao lưu không có bảng nào khớp với cơ sở dữ liệu hiện tại');
  // giữ dòng nhân viên của chính Admin đang khôi phục (admin gắn theo vai trò trong dữ liệu vẫn đăng nhập được giữa chừng);
  // dòng này được ghi đè bằng dữ liệu trong bản sao lưu ngay khi chèn lại bảng employees
  await env.DB.batch(pick.map(t => (t.name === 'employees' && me.email
    ? env.DB.prepare(`DELETE FROM ${q(t.name)} WHERE email IS NULL OR email <> ? COLLATE NOCASE`).bind(me.email)
    : env.DB.prepare(`DELETE FROM ${q(t.name)}`))));
  return h.json({ ok: true, cleared: pick.map(t => t.name) });
}

async function restoreRows(h, env, request) {
  const b = await h.readJson(request);
  const t = await findTable(h, env, String(b.table || ''));
  const cols = Array.isArray(b.columns) ? b.columns.map(String) : [], blobs = new Set(Array.isArray(b.blobs) ? b.blobs : []);
  const rows = Array.isArray(b.rows) ? b.rows : [];
  if (rows.length > 1000) throw new h.HttpError(400, 'Mỗi lần gửi tối đa 1000 dòng');
  const keep = cols.map((c, i) => [c, i]).filter(([c]) => t.columns.includes(c));   // chỉ cột còn có trong cấu trúc hiện tại
  if (!keep.length) return h.json({ ok: true, inserted: 0 });
  const sql = `INSERT OR REPLACE INTO ${q(t.name)} (${keep.map(([c]) => q(c)).join(', ')}) VALUES (${keep.map(() => '?').join(', ')})`;
  const st = rows.filter(Array.isArray).map(r => env.DB.prepare(sql).bind(...keep.map(([c, i]) => {
    const v = r[i] === undefined ? null : r[i];
    if (v != null && blobs.has(c) && t.blobs.includes(c)) { const u = bytesOfHex(v); if (!u) throw new h.HttpError(400, `Dữ liệu nhị phân cột ${c} không hợp lệ`); return u; }
    return v;
  })));
  for (let i = 0; i < st.length; i += 100) await env.DB.batch(st.slice(i, i + 100));
  return h.json({ ok: true, inserted: st.length });
}

// ---------- Google Drive (Apps Script) ----------
export const driveConfigured = (env) => !!(String(env.BACKUP_DRIVE_URL || '').trim() && String(env.BACKUP_DRIVE_TOKEN || '').trim());
async function drive(h, env, payload) {
  if (!driveConfigured(env)) throw new h.HttpError(400, 'Chưa cấu hình sao lưu Google Drive (BACKUP_DRIVE_URL, BACKUP_DRIVE_TOKEN) — xem tools/backup/apps-script/HUONG-DAN.md');
  const doFetch = env.BACKUP_FETCH || fetch;
  let r;
  try {
    r = await doFetch(String(env.BACKUP_DRIVE_URL).trim(), { method: 'POST', headers: { 'content-type': 'application/json' }, redirect: 'follow',
      body: JSON.stringify({ ...payload, token: String(env.BACKUP_DRIVE_TOKEN).trim() }) });
  } catch (e) { throw new h.HttpError(502, 'Không kết nối được Google Drive (Apps Script)'); }
  let d = null; try { d = await r.json(); } catch (e) { /* không phải JSON */ }
  if (!r.ok || !d) throw new h.HttpError(502, 'Google Drive (Apps Script) trả lời không hợp lệ — kiểm tra lại địa chỉ triển khai Web app');
  if (d.error) throw new h.HttpError(502, 'Google Drive: ' + d.error);
  return d;
}

export async function routeBackup(h, env, me, path, method, url, request) {
  if (!path.startsWith('/api/admin/backup/')) return null;
  if (!me.isAdmin) throw new h.HttpError(403, 'Chỉ Admin được sao lưu / khôi phục dữ liệu');
  if (env.DEMO || env.DEMO_EMAIL) throw new h.HttpError(400, 'Không dùng sao lưu / khôi phục trong chế độ demo');
  if (path === '/api/admin/backup/tables' && method === 'GET') {
    const m = await env.DB.prepare("SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 1").first().catch(() => null);
    return h.json({ format: FORMAT, version: 1, schema: m ? m.name : '', tables: await tableList(env), drive: driveConfigured(env) });
  }
  if (path === '/api/admin/backup/rows' && method === 'GET') return await rowsPage(h, env, url);
  if (path === '/api/admin/backup/restore/clear' && method === 'POST') return await restoreClear(h, env, me, request);
  if (path === '/api/admin/backup/restore/rows' && method === 'POST') return await restoreRows(h, env, request);
  if (path === '/api/admin/backup/restore/done' && method === 'POST') {
    const b = await h.readJson(request);
    await h.audit(env, me, 'backup_restore', 'database', h.str(b.name, 120), undefined, { from: h.str(b.from, 20), createdAt: h.str(b.createdAt, 40), rows: b.rows && typeof b.rows === 'object' ? b.rows : {} });
    return h.json({ ok: true });
  }
  if (path === '/api/admin/backup/drive' && method === 'GET') {
    if (!driveConfigured(env)) return h.json({ configured: false, files: [] });
    const d = await drive(h, env, { action: 'list' });
    return h.json({ configured: true, files: Array.isArray(d.files) ? d.files : [], keep: d.keep || 10 });
  }
  if (path === '/api/admin/backup/drive/file' && method === 'GET') {
    const id = String(url.searchParams.get('id') || '');
    if (!/^[A-Za-z0-9_-]{10,200}$/.test(id)) throw new h.HttpError(400, 'Mã file không hợp lệ');
    const d = await drive(h, env, { action: 'get', id });
    const name = NAME_RE.test(String(d.name || '')) ? d.name : 'trackingts-backup.json.gz';
    return new Response(b64Decode(d.b64), { headers: { 'content-type': 'application/gzip', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' } });
  }
  if (path === '/api/admin/backup/drive' && method === 'POST') {
    const name = String(url.searchParams.get('name') || '');
    if (!NAME_RE.test(name)) throw new h.HttpError(400, 'Tên file sao lưu không hợp lệ');
    const buf = new Uint8Array(await request.arrayBuffer());
    if (!buf.length || buf[0] !== 0x1f || buf[1] !== 0x8b) throw new h.HttpError(400, 'File sao lưu phải là .json.gz');
    if (buf.length > 40 * 1024 * 1024) throw new h.HttpError(413, 'File sao lưu quá lớn (tối đa 40 MB)');
    const d = await drive(h, env, { action: 'upload', name, b64: b64Encode(buf), note: `Sao lưu thủ công bởi ${me.email}` });
    await h.audit(env, me, 'backup_drive', 'database', name, undefined, { size: buf.length, pruned: d.pruned || 0 });
    return h.json({ ok: true, file: d.file || null, pruned: d.pruned || 0 });
  }
  return null;
}
