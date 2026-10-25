// Kiểm thử API máy chủ (server/api.mjs) trên D1 giả lập cục bộ (wrangler getPlatformProxy).
// Chạy: npm run test:server   — không cần mạng, không cần tài khoản Cloudflare.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getPlatformProxy } from 'wrangler';
import { handle } from '../../server/api.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TEAM = 'team-test';
const ISS = `https://${TEAM}.cloudflareaccess.com`;
const AUD = 'aud-trackingts-test';

let proxy, env, keys, otherKeys;

async function makeKeys(kid) {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid, alg: 'RS256', use: 'sig' };
  return { kid, privateKey: pair.privateKey, jwk };
}
const b64url = (buf) => Buffer.from(buf).toString('base64url');
async function sign(k, claims) {
  const head = b64url(JSON.stringify({ alg: 'RS256', kid: k.kid, typ: 'JWT' }));
  const body = b64url(JSON.stringify(claims));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', k.privateKey, new TextEncoder().encode(head + '.' + body));
  return `${head}.${body}.${b64url(sig)}`;
}
const t = () => Math.floor(Date.now() / 1000);
const tokenFor = (email, over = {}) => sign(keys, { aud: [AUD], iss: ISS, email, iat: t(), nbf: t() - 5, exp: t() + 3600, ...over });

let keySet = () => [keys.jwk];
const getKeys = async () => keySet();

async function call(method, p, { email, token, body, contentType, envOver } = {}) {
  const headers = {};
  if (email) headers['cf-access-jwt-assertion'] = await tokenFor(email);
  if (token) headers['cf-access-jwt-assertion'] = token;
  if (body !== undefined) headers['content-type'] = contentType || 'application/json';
  const req = new Request('https://trackingts.pages.dev' + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const resp = await handle(req, { ...env, ...(envOver || {}) }, { getKeys });
  return { status: resp.status, data: await resp.json() };
}

before(async () => {
  proxy = await getPlatformProxy({ configPath: path.join(ROOT, 'wrangler.toml'), persist: false });
  const sql = readFileSync(path.join(ROOT, 'migrations/0001_init.sql'), 'utf8')
    .split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
  for (const stmt of sql.split(';').map(s => s.trim()).filter(Boolean)) await proxy.env.DB.prepare(stmt).run();
  env = { DB: proxy.env.DB, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ADMIN_EMAILS: 'boss@example.com' };
  keys = await makeKeys('k1');
  otherKeys = await makeKeys('k1'); // cùng kid nhưng khoá khác → chữ ký sai
});
after(async () => { if (proxy) await proxy.dispose(); });

const SAMPLE = {
  employees: [
    { empId: 'F01', fullName: 'Nguyễn Văn Thợ', position: 'Fitter', supervisor: 'Trần Giám Sát', dob: '1990-01-01', gender: 'Nam' },
    { empId: 'S01', fullName: 'Trần Giám Sát', position: 'Site Supervisor' },
    { empId: 'P01', fullName: 'Lê Quản Lý', position: 'Project Manager' },
    { empId: 'F02', fullName: 'Phạm Văn Hai', position: 'Fitter' },
  ],
  projects: [
    { wbs: 'W-100', projectName: 'Toà nhà A', customer: 'Chủ đầu tư A', productLine: 'S3000', specs: { stops: 12 } },
    { wbs: 'W-200', projectName: 'Toà nhà B' },
  ],
};

test('health: không cần đăng nhập, báo đã cấu hình', async () => {
  const r = await call('GET', '/api/health');
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { ok: true, db: true, auth: true, config: { ACCESS_TEAM_DOMAIN: true, ACCESS_AUD: true, ADMIN_EMAILS: true } });
  // thiếu cấu hình: báo đúng giá trị nào thiếu, không lộ giá trị
  const miss = await call('GET', '/api/health', { envOver: { ACCESS_AUD: '', ADMIN_EMAILS: undefined } });
  assert.deepEqual(miss.data.config, { ACCESS_TEAM_DOMAIN: true, ACCESS_AUD: false, ADMIN_EMAILS: false });
  assert.equal(miss.data.auth, false);
  assert.ok(!JSON.stringify(r.data).includes(AUD));
});

test('chưa cấu hình Access → 503, không mở cửa', async () => {
  const r = await call('GET', '/api/me', { email: 'boss@example.com', envOver: { ACCESS_AUD: '' } });
  assert.equal(r.status, 503);
});

test('token: thiếu / rác / sai chữ ký / sai aud / sai iss / hết hạn → 401', async () => {
  assert.equal((await call('GET', '/api/me')).status, 401);
  assert.equal((await call('GET', '/api/me', { token: 'abc.def.ghi' })).status, 401);
  const forged = await sign(otherKeys, { aud: [AUD], iss: ISS, email: 'boss@example.com', exp: t() + 3600 });
  assert.equal((await call('GET', '/api/me', { token: forged })).status, 401);
  assert.equal((await call('GET', '/api/me', { token: await tokenFor('boss@example.com', { aud: ['other-app'] }) })).status, 401);
  assert.equal((await call('GET', '/api/me', { token: await tokenFor('boss@example.com', { iss: 'https://evil.cloudflareaccess.com' }) })).status, 401);
  assert.equal((await call('GET', '/api/me', { token: await tokenFor('boss@example.com', { exp: t() - 3600 }) })).status, 401);
  const none = b64url(JSON.stringify({ alg: 'none', kid: 'k1' })) + '.' + b64url(JSON.stringify({ aud: [AUD], iss: ISS, email: 'boss@example.com', exp: t() + 3600 })) + '.';
  assert.equal((await call('GET', '/api/me', { token: none })).status, 401);
});

test('admin khởi tạo (ADMIN_EMAILS) đăng nhập được khi chưa có nhân viên nào', async () => {
  const r = await call('GET', '/api/me', { email: 'Boss@Example.com' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.roles, ['admin']);
});

test('email lạ → 403', async () => {
  const r = await call('GET', '/api/me', { email: 'stranger@example.com' });
  assert.equal(r.status, 403);
});

test('ghi phải là JSON (chặn form giả mạo từ trang khác) → 415', async () => {
  const r = await call('POST', '/api/admin/import', { email: 'boss@example.com', body: SAMPLE, contentType: 'text/plain' });
  assert.equal(r.status, 415);
});

test('admin đưa EE Data + Dự án lên; không lưu ngày sinh / giới tính', async () => {
  const r = await call('POST', '/api/admin/import', { email: 'boss@example.com', body: SAMPLE });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.employees, 4);
  assert.equal(r.data.projects, 2);
  const row = await env.DB.prepare('SELECT * FROM employees WHERE emp_id = ?').bind('F01').first();
  assert.equal(row.full_name, 'Nguyễn Văn Thợ');
  assert.ok(!('dob' in row) && !('gender' in row));
  const p = (await call('GET', '/api/projects', { email: 'boss@example.com' })).data.projects.find(x => x.wbs === 'W-100');
  assert.equal(p.customer, 'Chủ đầu tư A');
  assert.deepEqual(p.specs, { stops: 12 });
});

test('admin gắn email; email sai → 400; trùng → 409', async () => {
  for (const [id, email] of [['F01', 'tho@example.com'], ['S01', 'sup@example.com'], ['P01', 'pm@example.com'], ['F02', 'hai@example.com']]) {
    const r = await call('PATCH', `/api/admin/employees/${id}`, { email: 'boss@example.com', body: { email } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
  }
  assert.equal((await call('PATCH', '/api/admin/employees/F02', { email: 'boss@example.com', body: { email: 'not-an-email' } })).status, 400);
  assert.equal((await call('PATCH', '/api/admin/employees/F02', { email: 'boss@example.com', body: { email: 'THO@example.com' } })).status, 409);
  assert.equal((await call('PATCH', '/api/admin/employees/NOPE', { email: 'boss@example.com', body: { email: 'x@example.com' } })).status, 404);
});

test('vai trò theo chức danh: fitter / Site Sup / Quản lý dự án', async () => {
  assert.deepEqual((await call('GET', '/api/me', { email: 'tho@example.com' })).data.roles, []);
  assert.deepEqual((await call('GET', '/api/me', { email: 'SUP@example.com' })).data.roles, ['sitesup']);
  assert.deepEqual((await call('GET', '/api/me', { email: 'pm@example.com' })).data.roles, ['pm']);
});

test('fitter và Site Sup: không thấy email người khác, không vào được chức năng admin', async () => {
  for (const email of ['tho@example.com', 'sup@example.com']) {
    const list = await call('GET', '/api/employees', { email });
    assert.equal(list.status, 200);
    assert.ok(list.data.employees.length >= 4);
    assert.ok(list.data.employees.every(e => !('email' in e) && !('roleOverride' in e)), 'không lộ email');
    assert.equal((await call('POST', '/api/admin/import', { email, body: SAMPLE })).status, 403);
    assert.equal((await call('PATCH', '/api/admin/employees/F02', { email, body: { email: 'z@example.com' } })).status, 403);
    assert.equal((await call('GET', '/api/admin/audit', { email })).status, 403);
    assert.equal((await call('PUT', '/api/projects/W-100/staff', { email, body: { sitesup: ['S01'] } })).status, 403);
  }
});

test('Quản lý dự án: xem email, phân công dự án; không vào được chức năng admin', async () => {
  const list = await call('GET', '/api/employees', { email: 'pm@example.com' });
  assert.ok(list.data.employees.find(e => e.empId === 'F01').email === 'tho@example.com');
  const r = await call('PUT', '/api/projects/W-100/staff', { email: 'pm@example.com', body: { sitesup: ['S01'], pm: ['P01', 'P01'] } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual(r.data.staff, { sitesup: ['S01'], pm: ['P01'] });
  assert.equal((await call('PUT', '/api/projects/W-100/staff', { email: 'pm@example.com', body: { sitesup: ['NOPE'] } })).status, 400);
  assert.equal((await call('PUT', '/api/projects/W-999/staff', { email: 'pm@example.com', body: { sitesup: [] } })).status, 404);
  assert.equal((await call('POST', '/api/admin/import', { email: 'pm@example.com', body: SAMPLE })).status, 403);
  assert.equal((await call('PATCH', '/api/admin/employees/F02', { email: 'pm@example.com', body: { active: false } })).status, 403);
  const me = await call('GET', '/api/me', { email: 'sup@example.com' });
  assert.deepEqual(me.data.projects, [{ wbs: 'W-100', role: 'sitesup' }]);
  const proj = (await call('GET', '/api/projects', { email: 'tho@example.com' })).data.projects.find(p => p.wbs === 'W-100');
  assert.deepEqual(proj.staff, { sitesup: ['S01'], pm: ['P01'] });
});

test('đưa dữ liệu lần nữa không xoá email / vai trò đã đặt', async () => {
  await call('POST', '/api/admin/import', { email: 'boss@example.com', body: SAMPLE });
  assert.equal((await call('GET', '/api/me', { email: 'tho@example.com' })).status, 200);
});

test('vai trò chỉnh tay: cho fitter làm admin; tự đổi của chính mình bị chặn', async () => {
  assert.equal((await call('PATCH', '/api/admin/employees/F02', { email: 'boss@example.com', body: { roleOverride: 'admin' } })).status, 200);
  assert.deepEqual((await call('GET', '/api/me', { email: 'hai@example.com' })).data.roles, ['admin']);
  const self = await call('PATCH', '/api/admin/employees/F02', { email: 'hai@example.com', body: { active: false } });
  assert.equal(self.status, 400);
  assert.equal((await call('PATCH', '/api/admin/employees/F02', { email: 'boss@example.com', body: { roleOverride: '' } })).status, 200);
  assert.equal((await call('PATCH', '/api/admin/employees/F02', { email: 'boss@example.com', body: { roleOverride: 'boss' } })).status, 400);
});

test('khoá tài khoản → người đó bị chặn ngay', async () => {
  assert.equal((await call('PATCH', '/api/admin/employees/F02', { email: 'boss@example.com', body: { active: false } })).status, 200);
  const r = await call('GET', '/api/me', { email: 'hai@example.com' });
  assert.equal(r.status, 403);
  assert.match(r.data.error, /khoá/);
});

test('đưa dữ liệu có "khoá người không còn trong EE Data"', async () => {
  const body = { employees: SAMPLE.employees.filter(e => e.empId !== 'S01'), projects: [], deactivateMissing: true };
  const r = await call('POST', '/api/admin/import', { email: 'boss@example.com', body });
  assert.equal(r.data.deactivated, 1);
  assert.equal((await call('GET', '/api/me', { email: 'sup@example.com' })).status, 403);
});

test('nhật ký ghi đủ: ai, làm gì, giá trị cũ / mới', async () => {
  const r = await call('GET', '/api/admin/audit?limit=50', { email: 'boss@example.com' });
  assert.equal(r.status, 200);
  const actions = r.data.entries.map(e => `${e.actor}:${e.action}:${e.entity}`);
  assert.ok(actions.includes('boss@example.com:import:data'));
  assert.ok(actions.includes('pm@example.com:set_staff:project'));
  const lock = r.data.entries.find(e => e.action === 'update' && e.entity_id === 'F02' && e.after && e.after.active === false);
  assert.ok(lock && lock.before.active === true, 'có giá trị trước / sau');
});

test('khoá Access xoay vòng: kid mới được tải lại', async () => {
  const fresh = await makeKeys('k2');
  let calls = 0;
  keySet = () => { calls++; return calls === 1 ? [keys.jwk] : [keys.jwk, fresh.jwk]; };
  const tok = await sign(fresh, { aud: [AUD], iss: ISS, email: 'boss@example.com', exp: t() + 3600 });
  assert.equal((await call('GET', '/api/me', { token: tok })).status, 200);
  keySet = () => [keys.jwk];
});

test('đường dẫn lạ → 404', async () => {
  assert.equal((await call('GET', '/api/nope', { email: 'boss@example.com' })).status, 404);
});

// ---------- đưa dữ liệu lớn theo từng đợt + gắn email hàng loạt ----------
const bigEmployees = Array.from({ length: 677 }, (_, i) => ({ empId: 'B' + String(i + 1).padStart(4, '0'), fullName: 'Người số ' + (i + 1), position: i % 50 === 0 ? 'Site Supervisor' : 'Fitter' }));
const bigProjects = Array.from({ length: 312 }, (_, i) => ({ wbs: 'BW-' + (i + 1), projectName: 'Dự án ' + (i + 1), customer: 'KH ' + (i % 7), specs: { stops: i % 30, note: 'x'.repeat(200) } }));

test('đưa 677 nhân viên + 312 dự án theo từng đợt nhỏ: đủ dòng, không lỗi', async () => {
  let n = 0;
  for (let i = 0; i < bigEmployees.length; i += 200) {
    const r = await call('POST', '/api/admin/import', { email: 'boss@example.com', body: { employees: bigEmployees.slice(i, i + 200) } });
    assert.equal(r.status, 200, JSON.stringify(r.data)); n += r.data.employees;
  }
  assert.equal(n, 677);
  let p = 0;
  for (let i = 0; i < bigProjects.length; i += 100) {
    const r = await call('POST', '/api/admin/import', { email: 'boss@example.com', body: { projects: bigProjects.slice(i, i + 100) } });
    assert.equal(r.status, 200, JSON.stringify(r.data)); p += r.data.projects;
  }
  assert.equal(p, 312);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) c FROM employees WHERE emp_id LIKE 'B%'").first()).c, 677);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) c FROM projects WHERE wbs LIKE 'BW-%'").first()).c, 312);
});

test('một yêu cầu quá lớn bị từ chối rõ ràng (413), không làm hỏng dữ liệu', async () => {
  const r = await call('POST', '/api/admin/import', { email: 'boss@example.com', body: { employees: bigEmployees, projects: bigProjects } });
  assert.equal(r.status, 413);
  assert.match(r.data.error, /từng đợt/);
});

test('dòng trùng mã trong cùng một đợt: dòng sau thắng, không lỗi', async () => {
  const r = await call('POST', '/api/admin/import', { email: 'boss@example.com', body: { employees: [
    { empId: 'D1', fullName: 'Tên cũ' }, { empId: 'D1', fullName: 'Tên mới' }, { empId: '', fullName: 'Thiếu mã' }] } });
  assert.equal(r.status, 200);
  assert.equal(r.data.employees, 1);
  assert.equal((await env.DB.prepare('SELECT full_name n FROM employees WHERE emp_id = ?').bind('D1').first()).n, 'Tên mới');
});

test('khoá người không còn trong danh sách đầy đủ (allEmpIds), gửi riêng', async () => {
  const keep = bigEmployees.slice(0, 600).map(e => e.empId).concat(['F01', 'P01', 'S01', 'F02', 'D1']);
  const r = await call('POST', '/api/admin/import', { email: 'boss@example.com', body: { deactivateMissing: true, allEmpIds: keep } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.deactivated, 77);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) c FROM employees WHERE emp_id LIKE 'B%' AND active = 0").first()).c, 77);
});

test('gắn email hàng loạt: đúng / sai từng dòng, dòng lỗi không làm hỏng dòng khác', async () => {
  const r = await call('POST', '/api/admin/emails', { email: 'boss@example.com', body: { items: [
    { empId: 'B0001', email: 'Mot@Example.com' },
    { empId: 'B0002', email: 'b0002@example.com' },
    { empId: 'B0003', email: 'khong-phai-email' },
    { empId: 'KHONGCO', email: 'ba@example.com' },
    { empId: 'B0004', email: 'mot@example.com' },          // trùng dòng 1 trong cùng danh sách
    { empId: 'B0005', email: 'tho@example.com' },          // đã gắn cho F01
    { empId: '', email: 'x@example.com' },
  ] } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const by = Object.fromEntries(r.data.results.map((x, i) => [i, x]));
  assert.equal(by[0].ok, true); assert.equal(by[1].ok, true);
  assert.match(by[2].error, /không hợp lệ/); assert.match(by[3].error, /Không có mã NV/);
  assert.match(by[4].error, /trùng/); assert.match(by[5].error, /đã gắn cho nhân viên F01/); assert.match(by[6].error, /Thiếu mã/);
  assert.equal(r.data.applied, 2);
  assert.equal((await env.DB.prepare('SELECT email e FROM employees WHERE emp_id = ?').bind('B0001').first()).e, 'mot@example.com');
  // làm lại đúng danh sách cũ: không đổi gì
  const again = await call('POST', '/api/admin/emails', { email: 'boss@example.com', body: { items: [{ empId: 'B0001', email: 'mot@example.com' }] } });
  assert.equal(again.data.applied, 0); assert.equal(again.data.results[0].unchanged, true);
  // nhật ký
  const log = (await call('GET', '/api/admin/audit?limit=5', { email: 'boss@example.com' })).data.entries.find(e => e.action === 'set_emails');
  assert.ok(log && log.after.changes.length === 2);
});

test('gắn email hàng loạt: chỉ admin; tối đa 40 dòng; không tự đổi email của mình', async () => {
  assert.equal((await call('POST', '/api/admin/emails', { email: 'pm@example.com', body: { items: [{ empId: 'B0010', email: 'z@example.com' }] } })).status, 403);
  assert.equal((await call('POST', '/api/admin/emails', { email: 'boss@example.com', body: { items: [] } })).status, 400);
  const many = Array.from({ length: 41 }, (_, i) => ({ empId: 'B' + String(i + 20).padStart(4, '0'), email: `m${i}@example.com` }));
  assert.equal((await call('POST', '/api/admin/emails', { email: 'boss@example.com', body: { items: many } })).status, 413);
  const self = await call('POST', '/api/admin/emails', { email: 'pm@example.com', body: { items: [] } });
  assert.equal(self.status, 403);
  // người dùng có empId (P01 làm admin chỉnh tay) không tự đổi email của chính mình
  await call('PATCH', '/api/admin/employees/P01', { email: 'boss@example.com', body: { roleOverride: 'admin' } });
  const own = await call('POST', '/api/admin/emails', { email: 'pm@example.com', body: { items: [{ empId: 'P01', email: 'moi@example.com' }] } });
  assert.match(own.data.results[0].error, /chính mình/);
});
