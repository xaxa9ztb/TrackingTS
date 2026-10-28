// Kiểm thử API máy chủ (server/api.mjs) trên D1 giả lập cục bộ (wrangler getPlatformProxy).
// Chạy: npm run test:server   — không cần mạng, không cần tài khoản Cloudflare.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getPlatformProxy } from 'wrangler';
import { handle } from '../../server/api.mjs';
import OtLeave from '../../tools/timesheet/otleave.js';
import TsSync from '../../tools/timesheet/tssync.js';
import LaborVN from '../../tools/timesheet/labor.js';


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

async function call(method, p, { email, token, body, contentType, envOver, cookie } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (email) headers['cf-access-jwt-assertion'] = await tokenFor(email);
  if (token) headers['cf-access-jwt-assertion'] = token;
  if (body !== undefined) headers['content-type'] = contentType || 'application/json';
  const req = new Request('https://trackingts.pages.dev' + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const resp = await handle(req, { ...env, ...(envOver || {}) }, { getKeys });
  return { status: resp.status, data: await resp.json(), setCookie: resp.headers.get('set-cookie') || '' };
}

// Brevo giả: ghi lại các thư "đã gửi"; brevoMode = 'ok' | 'fail'
const sentMail = []; let brevoMode = 'ok';
const fakeBrevo = async (url, init) => {
  const body = JSON.parse(init.body);
  sentMail.push({ url, key: init.headers['api-key'], ...body });
  return brevoMode === 'ok' ? { ok: true, status: 201, json: async () => ({ messageId: 'x' }) } : { ok: false, status: 401, json: async () => ({ message: 'Key not found' }) };
};
const mailsTo = (email) => sentMail.filter(m => m.to.some(t => t.email === email));

before(async () => {
  proxy = await getPlatformProxy({ configPath: path.join(ROOT, 'wrangler.toml'), persist: false });
  for (const f of readdirSync(path.join(ROOT, 'migrations')).filter(n => n.endsWith('.sql')).sort()) {
    const sql = readFileSync(path.join(ROOT, 'migrations', f), 'utf8').split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
    for (const stmt of sql.split(';').map(x => x.trim()).filter(Boolean)) { await proxy.env.DB.prepare(stmt).run(); await proxy.env.DB_DEMO.prepare(stmt).run(); }
  }
  env = { DB: proxy.env.DB, DB_DEMO: proxy.env.DB_DEMO, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ADMIN_EMAILS: 'boss@example.com',
    BREVO_API_KEY: 'test-key', MAIL_FROM: 'noreply@example.com', MAIL_FROM_NAME: 'Bộ công cụ', MAIL_FETCH: fakeBrevo, APP_URL: 'https://nihan-ts.pages.dev' };
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
  assert.deepEqual(r.data, { ok: true, db: true, auth: true, config: { ACCESS_TEAM_DOMAIN: true, ACCESS_AUD: true, ADMIN_EMAILS: true, MAIL: true } });
  // thiếu cấu hình: báo đúng giá trị nào thiếu, không lộ giá trị
  const miss = await call('GET', '/api/health', { envOver: { ACCESS_AUD: '', ADMIN_EMAILS: undefined } });
  assert.deepEqual(miss.data.config, { ACCESS_TEAM_DOMAIN: true, ACCESS_AUD: false, ADMIN_EMAILS: false, MAIL: true });
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

// ---------- tự phân công Site Sup theo cột "Giám sát" của dự án ----------
test('tự phân công: khớp tên khác thứ tự / thiếu tên đệm, nhận biết trùng tên và không khớp', async () => {
  await call('POST', '/api/admin/import', { email: 'boss@example.com', body: {
    employees: [
      { empId: 'SV01', fullName: 'Nguyễn Văn An', position: 'Site Supervisor' },
      { empId: 'SV02', fullName: 'Trần Thị Bình', position: 'NI Site Supervisor' },
      { empId: 'SV03', fullName: 'Lê Văn Cường', position: 'Fitter' },
      { empId: 'SV05', fullName: 'Phạm Minh Đức', position: 'Fitter' },
      { empId: 'SV06', fullName: 'Phạm Minh Đức', position: 'Technician' },
      { empId: 'SV07', fullName: 'Hoàng Văn Em', position: 'Fitter' },
      { empId: 'SV08', fullName: 'Hoàng Văn Em', position: 'Site Supervisor' },
    ],
    projects: [
      { wbs: 'SP1', projectName: 'A1', supervisor: 'An Nguyễn Văn' },        // khác thứ tự
      { wbs: 'SP2', projectName: 'A2', supervisor: 'An nguyen van' },        // không dấu, chữ thường
      { wbs: 'SP3', projectName: 'A3', supervisor: 'Trần Thị Bình' },        // khớp đúng
      { wbs: 'SP4', projectName: 'A4', supervisor: 'Phạm Minh Đức' },        // 2 người trùng tên, không ai là Site Sup → không tự chọn
      { wbs: 'SP5', projectName: 'A5', supervisor: 'Văn Cường' },            // thiếu tên đệm / họ
      { wbs: 'SP6', projectName: 'A6', supervisor: '' },                      // không có giám sát
      { wbs: 'SP7', projectName: 'A7', supervisor: 'Không Ai Cả' },          // không khớp
      { wbs: 'SP8', projectName: 'A8', supervisor: 'Hoàng Văn Em' },         // trùng tên, ưu tiên người có chức danh Site Sup
    ] } });
  const r = await call('GET', '/api/supervisors', { email: 'boss@example.com' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const g = Object.fromEntries(r.data.groups.map(x => [x.label, x]));
  assert.equal(g['An Nguyễn Văn'].match.empId, 'SV01');
  assert.equal(g['An Nguyễn Văn'].match.how, 'words');
  assert.equal(g['An Nguyễn Văn'].projects, 2, '"An Nguyễn Văn" và "An nguyen van" là cùng một nhóm (bỏ dấu, chữ thường)');
  assert.ok(!g['An nguyen van']);
  assert.equal(g['Trần Thị Bình'].match.how, 'exact');
  assert.equal(g['Phạm Minh Đức'].match, null);
  assert.deepEqual(g['Phạm Minh Đức'].candidates.map(c => c.empId).sort(), ['SV05', 'SV06']);
  assert.equal(g['Văn Cường'].match.empId, 'SV03'); assert.equal(g['Văn Cường'].match.how, 'subset');
  assert.equal(g['Không Ai Cả'].match, null); assert.deepEqual(g['Không Ai Cả'].candidates, []);
  assert.equal(g['Hoàng Văn Em'].match.empId, 'SV08');
  assert.ok(!('' in g), 'dự án không có giám sát không thành nhóm');
});

test('tự phân công: chỉ Admin / Quản lý dự án; fitter bị chặn', async () => {
  assert.equal((await call('GET', '/api/supervisors', { email: 'tho@example.com' })).status, 403);
  assert.equal((await call('POST', '/api/supervisors/apply', { email: 'tho@example.com', body: { items: [{ key: 'x', empId: 'SV01' }] } })).status, 403);
  assert.equal((await call('GET', '/api/supervisors', { email: 'pm@example.com' })).status, 200);
});

test('tự phân công: áp dụng nhiều nhóm, nhớ lựa chọn, không đè dự án đã có Site Sup', async () => {
  // SP2 đã được gán tay cho SV02 trước đó
  assert.equal((await call('PUT', '/api/projects/SP2/staff', { email: 'boss@example.com', body: { sitesup: ['SV02'], pm: [] } })).status, 200);
  const list = (await call('GET', '/api/supervisors', { email: 'boss@example.com' })).data.groups;
  const key = (label) => list.find(x => x.label === label).key;
  const r = await call('POST', '/api/supervisors/apply', { email: 'boss@example.com', body: { items: [
    { key: key('An Nguyễn Văn'), empId: 'SV01' },
    { key: key('Trần Thị Bình'), empId: 'SV02' },
    { key: key('Phạm Minh Đức'), empId: 'SV05' },               // admin tự chọn trong 2 người trùng tên
    { key: key('Không Ai Cả'), empId: 'KHONGCO' },               // sai mã → lỗi riêng, không hỏng nhóm khác
  ] } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.assigned, 3);   // SP1, SP3, SP4 (SP2 đã có Site Sup → bỏ qua)
  assert.match(r.data.results[3].error, /Không có nhân viên/);
  const staff = (await env.DB.prepare("SELECT wbs, emp_id FROM project_staff WHERE role = 'sitesup' AND wbs LIKE 'SP%' ORDER BY wbs").all()).results;
  assert.deepEqual(staff, [{ wbs: 'SP1', emp_id: 'SV01' }, { wbs: 'SP2', emp_id: 'SV02' }, { wbs: 'SP3', emp_id: 'SV02' }, { wbs: 'SP4', emp_id: 'SV05' }]);
  // lựa chọn được nhớ: lần sau nhóm "Phạm Minh Đức" tự khớp (alias)
  const again = (await call('GET', '/api/supervisors', { email: 'boss@example.com' })).data.groups.find(x => x.label === 'Phạm Minh Đức');
  assert.equal(again.match.empId, 'SV05'); assert.equal(again.match.how, 'alias');
  assert.equal(again.withSitesup, 1);
  // nhật ký
  const log = (await call('GET', '/api/admin/audit?limit=5', { email: 'boss@example.com' })).data.entries.find(e => e.action === 'auto_staff');
  assert.ok(log && log.after.assigned === 3);
});

test('tự phân công: bỏ chế độ "chỉ dự án chưa có" thì thay Site Sup cũ', async () => {
  const key = (await call('GET', '/api/supervisors', { email: 'boss@example.com' })).data.groups.find(x => x.label === 'An Nguyễn Văn').key;
  const r = await call('POST', '/api/supervisors/apply', { email: 'boss@example.com', body: { onlyEmpty: false, items: [{ key, empId: 'SV01' }] } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.assigned, 2);   // SP1 và SP2
  const sp2 = (await env.DB.prepare("SELECT emp_id FROM project_staff WHERE wbs = 'SP2' AND role = 'sitesup'").all()).results;
  assert.deepEqual(sp2, [{ emp_id: 'SV01' }]);
});

test('tự phân công: nhân viên bị khoá không được chọn; quá 30 nhóm bị từ chối', async () => {
  await call('PATCH', '/api/admin/employees/SV03', { email: 'boss@example.com', body: { active: false } });
  const key = (await call('GET', '/api/supervisors', { email: 'boss@example.com' })).data.groups.find(x => x.label === 'Văn Cường').key;
  const r = await call('POST', '/api/supervisors/apply', { email: 'boss@example.com', body: { items: [{ key, empId: 'SV03' }] } });
  assert.match(r.data.results[0].error, /bị khoá/);
  assert.equal(r.data.assigned, 0);
  const many = Array.from({ length: 31 }, (_, i) => ({ key: 'k' + i, empId: 'SV01' }));
  assert.equal((await call('POST', '/api/supervisors/apply', { email: 'boss@example.com', body: { items: many } })).status, 413);
});

test('tự phân công: dữ liệu 312 dự án / 9 giám sát — áp dụng một lần, đúng số dự án', async () => {
  const names = ['Giám Sát Một', 'Giám Sát Hai', 'Giám Sát Ba'];
  await call('POST', '/api/admin/import', { email: 'boss@example.com', body: { employees: names.map((n, i) => ({ empId: 'GS' + i, fullName: n, position: 'Site Supervisor' })) } });
  const projects = Array.from({ length: 312 }, (_, i) => ({ wbs: 'GP-' + i, projectName: 'P' + i, supervisor: names[i % 3].split(' ').reverse().join(' ') }));
  for (let i = 0; i < projects.length; i += 40) await call('POST', '/api/admin/import', { email: 'boss@example.com', body: { projects: projects.slice(i, i + 40) } });
  const labels = new Set(projects.slice(0, 3).map(p => p.supervisor));
  const groups = (await call('GET', '/api/supervisors', { email: 'boss@example.com' })).data.groups.filter(x => labels.has(x.label));
  assert.equal(groups.length, 3);
  assert.ok(groups.every(x => x.match && x.projects === 104));
  const r = await call('POST', '/api/supervisors/apply', { email: 'boss@example.com', body: { items: groups.map(x => ({ key: x.key, empId: x.match.empId })) } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.assigned, 312);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) c FROM project_staff WHERE role = 'sitesup' AND wbs LIKE 'GP-%'").first()).c, 312);
});

// ---------- gán một Quản lý dự án cho nhiều dự án ----------
test('gán một Quản lý dự án cho mọi dự án: chỉ dự án chưa có; thay thế khi chọn', async () => {
  await call('POST', '/api/admin/import', { email: 'boss@example.com', body: { employees: [
    { empId: 'PM1', fullName: 'Lê Thanh Tùng', position: 'Project Manager - Volume Business' },
    { empId: 'PM2', fullName: 'Người Khác', position: 'Project Manager' },
    { empId: 'FT1', fullName: 'Thợ Lắp', position: 'Fitter' },
  ] } });
  const total = (await env.DB.prepare('SELECT COUNT(*) c FROM projects').first()).c;
  // một dự án đã có PM2
  assert.equal((await call('PUT', '/api/projects/SP5/staff', { email: 'boss@example.com', body: { sitesup: [], pm: ['PM2'] } })).status, 200);
  const hadPm = (await env.DB.prepare("SELECT COUNT(DISTINCT wbs) c FROM project_staff WHERE role = 'pm'").first()).c;
  const r = await call('POST', '/api/projects/pm', { email: 'boss@example.com', body: { empId: 'PM1' } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.assigned, total - hadPm);
  assert.equal(r.data.skipped, hadPm);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) c FROM project_staff WHERE role = 'pm' AND emp_id = 'PM1'").first()).c, total - hadPm);
  assert.deepEqual((await env.DB.prepare("SELECT emp_id FROM project_staff WHERE role = 'pm' AND wbs = 'SP5'").all()).results, [{ emp_id: 'PM2' }], 'không đè dự án đã có PM');
  // chạy lại: không có gì mới
  assert.equal((await call('POST', '/api/projects/pm', { email: 'boss@example.com', body: { empId: 'PM1' } })).data.assigned, 0);
  // thay thế toàn bộ
  const all = await call('POST', '/api/projects/pm', { email: 'boss@example.com', body: { empId: 'PM1', onlyEmpty: false } });
  assert.equal(all.data.assigned, total);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) c FROM project_staff WHERE role = 'pm' AND emp_id = 'PM1'").first()).c, total);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) c FROM project_staff WHERE role = 'pm' AND emp_id <> 'PM1'").first()).c, 0);
  const log = (await call('GET', '/api/admin/audit?limit=3', { email: 'boss@example.com' })).data.entries.find(e => e.action === 'assign_pm');
  assert.ok(log && log.after.empId === 'PM1');
});

test('gán Quản lý dự án: chỉ chọn được người có vai trò QLDA; chặn fitter; người không có / bị khoá', async () => {
  assert.equal((await call('POST', '/api/projects/pm', { email: 'tho@example.com', body: { empId: 'PM1' } })).status, 403);
  assert.equal((await call('POST', '/api/projects/pm', { email: 'boss@example.com', body: { empId: 'FT1' } })).status, 400);
  assert.equal((await call('POST', '/api/projects/pm', { email: 'boss@example.com', body: { empId: 'KHONGCO' } })).status, 404);
  assert.equal((await call('POST', '/api/projects/pm', { email: 'boss@example.com', body: {} })).status, 404);
  await call('PATCH', '/api/admin/employees/PM2', { email: 'boss@example.com', body: { active: false } });
  assert.equal((await call('POST', '/api/projects/pm', { email: 'boss@example.com', body: { empId: 'PM2' } })).status, 400);
});

// ---------- ngày vào làm + kho dữ liệu Quản lý dự án ----------
test('nhân viên: ai đăng nhập cũng thấy chức danh / giám sát / ngày vào làm; không thấy email', async () => {
  await call('POST', '/api/admin/import', { email: 'boss@example.com', body: { employees: [
    { empId: 'DT1', fullName: 'Có Ngày', position: 'Fitter', supervisor: 'Sếp', hireDate: '2015-03-01', startDate: '2016-04-02', dob: '1990-01-01' }] } });
  const r = await call('GET', '/api/employees', { email: 'tho@example.com' });
  const e = r.data.employees.find(x => x.empId === 'DT1');
  assert.equal(e.supervisor, 'Sếp'); assert.equal(e.hireDate, '2015-03-01'); assert.equal(e.startDate, '2016-04-02');
  assert.ok(!('email' in e) && !('dob' in e));
  const row = await env.DB.prepare('SELECT * FROM employees WHERE emp_id = ?').bind('DT1').first();
  assert.ok(!('dob' in row));
});

const PM_DATA = (n = 1) => ({ fitters: Array.from({ length: n }, (_, i) => ({ id: 'f' + i, name: 'Fitter ' + i })), projects: [{ id: 'p1', name: 'P1' }], alloc: { 'f0|2026-10-26': { pid: 'p1' } } });

test('kho Quản lý dự án: tải lần đầu rỗng, lưu v1, lưu v2, đọc lại đúng', async () => {
  assert.equal((await call('PATCH', '/api/admin/employees/SV01', { email: 'boss@example.com', body: { email: 'sv01@example.com' } })).status, 200);
  const load0 = await call('POST', '/api/pm-store', { email: 'pm@example.com', body: { action: 'load' } });
  assert.equal(load0.status, 200);
  assert.deepEqual([load0.data.ok, load0.data.version, load0.data.data], [true, 0, null]);
  const s1 = await call('POST', '/api/pm-store', { email: 'pm@example.com', body: { action: 'save', baseVersion: 0, data: PM_DATA(2) } });
  assert.deepEqual([s1.data.ok, s1.data.version], [true, 1], JSON.stringify(s1.data));
  const s2 = await call('POST', '/api/pm-store', { email: 'sv01@example.com', body: { action: 'save', baseVersion: 1, data: PM_DATA(3) } });
  assert.deepEqual([s2.data.ok, s2.data.version], [true, 2], JSON.stringify(s2.data));
  const load = await call('POST', '/api/pm-store', { email: 'boss@example.com', body: { action: 'load' } });
  assert.equal(load.data.version, 2);
  assert.equal(load.data.data.fitters.length, 3);
  assert.ok(load.data.updatedBy && load.data.updatedAt);
});

test('kho Quản lý dự án: lưu trên bản cũ → xung đột, trả bản mới nhất để gộp; không ghi đè', async () => {
  const stale = await call('POST', '/api/pm-store', { email: 'pm@example.com', body: { action: 'save', baseVersion: 1, data: PM_DATA(9) } });
  assert.equal(stale.data.ok, false); assert.equal(stale.data.conflict, true); assert.equal(stale.data.version, 2);
  assert.equal(stale.data.data.fitters.length, 3, 'trả đúng bản đang lưu');
  const zero = await call('POST', '/api/pm-store', { email: 'pm@example.com', body: { action: 'save', baseVersion: 0, data: PM_DATA(9) } });
  assert.equal(zero.data.conflict, true, 'baseVersion 0 khi đã có dữ liệu cũng là xung đột');
  assert.equal((await call('POST', '/api/pm-store', { email: 'pm@example.com', body: { action: 'load' } })).data.data.fitters.length, 3);
});

test('kho Quản lý dự án: fitter bị từ chối (denied), dữ liệu sai / quá lớn bị từ chối', async () => {
  const denied = await call('POST', '/api/pm-store', { email: 'tho@example.com', body: { action: 'load' } });
  assert.equal(denied.status, 200); assert.equal(denied.data.denied, true);
  assert.equal((await call('POST', '/api/pm-store', { email: 'tho@example.com', body: { action: 'save', baseVersion: 2, data: PM_DATA() } })).data.denied, true);
  const bad = await call('POST', '/api/pm-store', { email: 'pm@example.com', body: { action: 'save', baseVersion: 2, data: { fitters: 1 } } });
  assert.equal(bad.data.ok, false); assert.match(bad.data.error, /không hợp lệ/);
  const arr = await call('POST', '/api/pm-store', { email: 'pm@example.com', body: { action: 'save', baseVersion: 2, data: { fitters: [], projects: [], alloc: [] } } });
  assert.equal(arr.data.ok, false);
  const huge = { fitters: [{ blob: 'x'.repeat(1600000) }], projects: [], alloc: {} };
  const big = await call('POST', '/api/pm-store', { email: 'pm@example.com', body: { action: 'save', baseVersion: 2, data: huge } });
  assert.equal(big.data.ok, false); assert.match(big.data.error, /quá lớn/);
  assert.equal((await call('POST', '/api/pm-store', { email: 'pm@example.com', body: { action: 'xoa' } })).data.ok, false);
  assert.equal((await call('POST', '/api/pm-store', { email: 'pm@example.com', body: { action: 'load' } })).data.version, 2, 'dữ liệu không bị đổi');
});

test('kho Quản lý dự án: hai người lưu cùng lúc — đúng một người thành công', async () => {
  const [a, b] = await Promise.all([
    call('POST', '/api/pm-store', { email: 'pm@example.com', body: { action: 'save', baseVersion: 2, data: PM_DATA(4) } }),
    call('POST', '/api/pm-store', { email: 'sv01@example.com', body: { action: 'save', baseVersion: 2, data: PM_DATA(5) } }),
  ]);
  assert.equal([a, b].filter(x => x.data.ok).length, 1, JSON.stringify([a.data.ok, b.data.ok]));
  assert.equal([a, b].filter(x => x.data.conflict).length, 1);
  assert.equal((await call('POST', '/api/pm-store', { email: 'pm@example.com', body: { action: 'load' } })).data.version, 3);
});

// ---------- bảng công cho Thống kê giờ công ----------
const tsRow = (i) => ({ id: 1000 + i, empId: 'E' + (i % 50), empName: 'Nhân viên ' + (i % 50), wbs: 'W-' + (i % 9), projectName: 'Dự án ' + (i % 9),
  activities: 'Lắp đặt ' + i, category: 'NI', date: `2026-09-${String(1 + (i % 28)).padStart(2, '0')}`, timeFrom: '08:00', timeTo: '17:00', role: 'Fitter', normal: 8, ot1: 0 });

async function uploadTs(email, rows, { baseVersion, count } = {}) {
  const b = await call('POST', '/api/admin/timesheets/begin', { email, body: {} });
  assert.equal(b.status, 200, JSON.stringify(b.data));
  for (let i = 0; i < rows.length; i += 160) {
    const r = await call('POST', '/api/admin/timesheets/rows', { email, body: { batch: b.data.batch, rows: rows.slice(i, i + 160) } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
  }
  const c = await call('POST', '/api/admin/timesheets/commit', { email, body: { batch: b.data.batch, baseVersion: baseVersion ?? b.data.version, count: count ?? rows.length } });
  return { begin: b, commit: c };
}
async function readTs(email) {
  const out = []; let after = 0, pages = 0, meta;
  for (;;) {
    const r = await call('GET', `/api/timesheets?after=${after}&limit=500`, { email });
    assert.equal(r.status, 200); meta = r.data; pages++;
    out.push(...r.data.rows);
    if (r.data.next === null) break; after = r.data.next;
  }
  return { rows: out, pages, meta };
}

test('bảng công: chưa có dữ liệu → meta rỗng, danh sách rỗng', async () => {
  const m = await call('GET', '/api/timesheets/meta', { email: 'tho@example.com' });
  assert.deepEqual([m.data.version, m.data.count], [0, 0]);
  assert.deepEqual((await readTs('tho@example.com')).rows, []);
});

test('bảng công: nạp 12.439 dòng theo đợt, đọc lại đủ và đúng từng dòng', async () => {
  const rows = Array.from({ length: 12439 }, (_, i) => tsRow(i));
  const { commit } = await uploadTs('boss@example.com', rows);
  assert.equal(commit.status, 200, JSON.stringify(commit.data));
  assert.deepEqual([commit.data.version, commit.data.count], [1, 12439]);
  const got = await readTs('tho@example.com');           // fitter đọc được
  assert.equal(got.rows.length, 12439);
  assert.equal(got.pages, 25);
  assert.equal(got.meta.version, 1);
  const { id, ...expected } = rows[777];
  assert.deepEqual(got.rows[777], expected, 'dòng giữ nguyên các trường, bỏ id');
  assert.ok(got.rows.every(r => !('id' in r)));
});

test('bảng công: chỉ admin nạp; người thường chỉ đọc', async () => {
  for (const email of ['tho@example.com', 'sv01@example.com']) {   // fitter và Site Sup
    assert.equal((await call('POST', '/api/admin/timesheets/begin', { email, body: {} })).status, 403);
    assert.equal((await call('POST', '/api/admin/timesheets/rows', { email, body: { batch: 2, rows: [] } })).status, 403);
    assert.equal((await call('POST', '/api/admin/timesheets/commit', { email, body: { batch: 2 } })).status, 403);
  }
});

test('bảng công: thay thế nguyên tử — đang nạp dở thì người xem vẫn thấy bản cũ; commit xong mới đổi', async () => {
  const b = await call('POST', '/api/admin/timesheets/begin', { email: 'boss@example.com', body: {} });
  await call('POST', '/api/admin/timesheets/rows', { email: 'boss@example.com', body: { batch: b.data.batch, rows: [tsRow(1), tsRow(2)] } });
  assert.equal((await readTs('tho@example.com')).rows.length, 12439, 'bản cũ còn nguyên khi đợt mới chưa commit');
  const bad = await call('POST', '/api/admin/timesheets/commit', { email: 'boss@example.com', body: { batch: b.data.batch, baseVersion: 1, count: 3 } });
  assert.equal(bad.status, 400); assert.match(bad.data.error, /chưa đủ dòng/);
  assert.equal((await readTs('tho@example.com')).rows.length, 12439);
  const ok = await call('POST', '/api/admin/timesheets/commit', { email: 'boss@example.com', body: { batch: b.data.batch, baseVersion: 1, count: 2 } });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  const after = await readTs('tho@example.com');
  assert.equal(after.rows.length, 2); assert.equal(after.meta.version, 2);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) c FROM timesheets').first()).c, 2, 'dòng của đợt cũ đã được dọn');
});

test('bảng công: có người cập nhật trước → xung đột 409, không ghi đè', async () => {
  const other = await uploadTs('boss@example.com', [tsRow(7), tsRow(8), tsRow(9)]);
  assert.equal(other.commit.status, 200);
  assert.equal(other.commit.data.version, 3);
  const stale = await uploadTs('boss@example.com', [tsRow(1)], { baseVersion: 2 });   // admin này vẫn đang giữ bản số 2
  assert.equal(stale.commit.status, 409); assert.equal(stale.commit.data.conflict, true); assert.equal(stale.commit.data.version, 3);
  const now = await readTs('tho@example.com');
  assert.equal(now.rows.length, 3); assert.equal(now.meta.version, 3);
});

test('bảng công: dòng thiếu mã NV / ngày hoặc quá lớn bị bỏ qua; đợt không hợp lệ / quá nhiều dòng bị từ chối', async () => {
  const b = await call('POST', '/api/admin/timesheets/begin', { email: 'boss@example.com', body: {} });
  const r = await call('POST', '/api/admin/timesheets/rows', { email: 'boss@example.com', body: { batch: b.data.batch, rows: [
    tsRow(1), { date: '2026-09-01' }, { empId: 'E1' }, null, 'x', { ...tsRow(2), activities: 'y'.repeat(4000) }] } });
  assert.deepEqual([r.data.inserted, r.data.skipped], [1, 5]);
  assert.equal((await call('POST', '/api/admin/timesheets/rows', { email: 'boss@example.com', body: { batch: 999, rows: [] } })).status, 400);
  assert.equal((await call('POST', '/api/admin/timesheets/rows', { email: 'boss@example.com', body: { batch: b.data.batch, rows: Array.from({ length: 161 }, (_, i) => tsRow(i)) } })).status, 413);
  assert.equal((await readTs('tho@example.com')).rows.length, 3, 'đợt dở dang không ảnh hưởng người xem');
});

// ---------- sửa / xoá dự án (Swat Hour Target, tab Dự án) ----------
const swatFields = { swatTargetHour: 812.5, targetSwat: true, swatState: { inputs: { stops: 12, load: 1000 }, confirmed: true } };
const getProject = async (wbs) => (await call('GET', '/api/projects', { email: 'tho@example.com' })).data.projects.find(p => p.wbs === wbs);

test('dự án: admin lưu Swat → mọi người thấy; các trường khác và người phụ trách giữ nguyên', async () => {
  await call('PUT', '/api/projects/BW-5/staff', { email: 'boss@example.com', body: { sitesup: [], pm: [] } });
  const before = await getProject('BW-5');
  const r = await call('PATCH', '/api/admin/projects/BW-5', { email: 'boss@example.com', body: { fields: swatFields } });
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.created, false);
  const after = await getProject('BW-5');
  assert.equal(after.targetSwat, true); assert.equal(after.swatTargetHour, 812.5); assert.deepEqual(after.swatState, swatFields.swatState);
  assert.equal(after.projectName, before.projectName); assert.deepEqual(after.specs, before.specs, 'thông số thang không mất');
  assert.deepEqual(after.staff, before.staff, 'người phụ trách không bị xoá');
});

test('dự án: sửa từng trường (tên, giám sát, target) và thêm dự án mới', async () => {
  const r = await call('PATCH', '/api/admin/projects/BW-6', { email: 'boss@example.com', body: { fields: { projectName: 'Tên mới', supervisor: 'Giám sát X', targetHour: 99, targetHourManual: true } } });
  assert.equal(r.status, 200);
  const p = await getProject('BW-6');
  assert.equal(p.projectName, 'Tên mới'); assert.equal(p.supervisor, 'Giám sát X'); assert.equal(p.targetHour, 99); assert.equal(p.customer, 'KH ' + (5 % 7));
  const c = await call('PATCH', '/api/admin/projects/NEW-1', { email: 'boss@example.com', body: { fields: { projectName: 'Mới tinh', source: 'manual', targetHour: 10 } } });
  assert.equal(c.status, 200); assert.equal(c.data.created, true);
  assert.equal((await getProject('NEW-1')).projectName, 'Mới tinh');
  const log = await call('GET', '/api/admin/audit', { email: 'boss@example.com' });
  assert.ok(log.data.entries.some(e => e.action === 'project_create' && e.entity_id === 'NEW-1' && e.after.projectName === 'Mới tinh'));
});

test('dự án: chỉ admin được sửa / xoá; dữ liệu sai bị từ chối', async () => {
  for (const email of ['tho@example.com', 'sv01@example.com']) {
    assert.equal((await call('PATCH', '/api/admin/projects/BW-5', { email, body: { fields: { projectName: 'x' } } })).status, 403);
    assert.equal((await call('POST', '/api/admin/projects/delete', { email, body: { wbs: ['BW-5'] } })).status, 403);
  }
  assert.equal((await call('PATCH', '/api/admin/projects/BW-5', { email: 'boss@example.com', body: {} })).status, 400);
  assert.equal((await call('PATCH', '/api/admin/projects/BW-5', { email: 'boss@example.com', body: { fields: { swatState: 'y'.repeat(25000) } } })).status, 413);
  assert.equal((await getProject('BW-5')).swatTargetHour, 812.5, 'bản cũ còn nguyên sau khi bị từ chối');
});

test('dự án: xoá hàng loạt (kèm người phụ trách), bỏ qua mã không tồn tại', async () => {
  const r = await call('POST', '/api/admin/projects/delete', { email: 'boss@example.com', body: { wbs: ['NEW-1', 'BW-7', 'KHONG-CO'] } });
  assert.equal(r.status, 200); assert.equal(r.data.deleted, 2);
  assert.equal(await getProject('NEW-1'), undefined); assert.equal(await getProject('BW-7'), undefined);
  assert.ok(await getProject('BW-5'));
  assert.equal((await call('POST', '/api/admin/projects/delete', { email: 'boss@example.com', body: { wbs: [] } })).status, 400);
});

// ---------- Timesheet cá nhân trên máy chủ (bảng công theo kỳ lương) ----------
const myEntry = (id, date, extra = {}) => ({ id, date, startTime: '08:00', endTime: '17:00', breakTime: '1', otMode: 'auto', otType: 'NORMAL', activityCode: '1110', projectName: 'Toà nhà A', workNumber: 'W-100', remarks: '', report: 'Lắp ray tầng 3', ...extra });

test('timesheet cá nhân: chuẩn bị 2 tài khoản', async () => {
  await call('POST', '/api/admin/import', { email: 'boss@example.com', body: { employees: [{ empId: 'TS1', fullName: 'Thợ Một', position: 'Fitter' }, { empId: 'TS2', fullName: 'Thợ Hai', position: 'Fitter' }] } });
  const r = await call('POST', '/api/admin/emails', { email: 'boss@example.com', body: { items: [{ empId: 'TS1', email: 'ts1@example.com' }, { empId: 'TS2', email: 'ts2@example.com' }] } });
  assert.equal(r.data.applied, 2);
});

test('timesheet cá nhân: chưa có bảng công → trống, phiên bản 0; ghi lần đầu → phiên bản 1', async () => {
  const empty = await call('GET', '/api/ts/docs/2026-11', { email: 'ts1@example.com' });
  assert.equal(empty.status, 200); assert.equal(empty.data.version, 0); assert.deepEqual(empty.data.data.entries, []);
  assert.deepEqual((await call('GET', '/api/ts/docs', { email: 'ts1@example.com' })).data.docs, []);
  const put = await call('PUT', '/api/ts/docs/2026-11', { email: 'ts1@example.com', body: { baseVersion: 0, data: { entries: [myEntry(1001, '2026-10-16'), myEntry(1002, '2026-11-15')], deleted: {} } } });
  assert.equal(put.status, 200, JSON.stringify(put.data)); assert.equal(put.data.version, 1);
  const got = await call('GET', '/api/ts/docs/2026-11', { email: 'ts1@example.com' });
  assert.equal(got.data.version, 1); assert.equal(got.data.status, 'draft');
  assert.equal(got.data.data.entries.length, 2); assert.equal(got.data.data.entries[0].report, 'Lắp ray tầng 3');
  const list = (await call('GET', '/api/ts/docs', { email: 'ts1@example.com' })).data.docs;
  assert.deepEqual(list.map(d => [d.period, d.version, d.entries, d.status]), [['2026-11', 1, 2, 'draft']]);
});

test('timesheet cá nhân: ghi tiếp đúng phiên bản; phiên bản cũ → 409 kèm bản hiện có để gộp', async () => {
  const ok = await call('PUT', '/api/ts/docs/2026-11', { email: 'ts1@example.com', body: { baseVersion: 1, data: { entries: [myEntry(1001, '2026-10-16'), myEntry(1002, '2026-11-15'), myEntry(1003, '2026-11-02')], deleted: {} } } });
  assert.equal(ok.status, 200); assert.equal(ok.data.version, 2);
  const stale = await call('PUT', '/api/ts/docs/2026-11', { email: 'ts1@example.com', body: { baseVersion: 1, data: { entries: [myEntry(1009, '2026-11-03')], deleted: {} } } });
  assert.equal(stale.status, 409); assert.equal(stale.data.conflict, true); assert.equal(stale.data.version, 2);
  assert.equal(stale.data.data.entries.length, 3, 'trả về bản trên máy chủ');
  assert.equal((await call('GET', '/api/ts/docs/2026-11', { email: 'ts1@example.com' })).data.data.entries.length, 3, 'bản trên máy chủ không bị ghi đè');
  const again = await call('PUT', '/api/ts/docs/2026-11', { email: 'ts1@example.com', body: { baseVersion: 0, data: { entries: [], deleted: {} } } });
  assert.equal(again.status, 409, 'báo là mới (0) nhưng đã có → xung đột, không ghi đè');
});

test('timesheet cá nhân: mỗi người chỉ thấy bảng công của mình', async () => {
  const other = await call('GET', '/api/ts/docs/2026-11', { email: 'ts2@example.com' });
  assert.equal(other.data.version, 0); assert.deepEqual(other.data.data.entries, []);
  assert.deepEqual((await call('GET', '/api/ts/docs', { email: 'ts2@example.com' })).data.docs, []);
  assert.equal((await call('GET', '/api/ts/docs/2026-11')).status, 401);
  assert.equal((await call('GET', '/api/ts/docs', { email: 'boss@example.com' })).status, 403, 'tài khoản chưa gắn nhân viên không có Timesheet');
});

test('timesheet cá nhân: dữ liệu sai bị từ chối (ngoài kỳ, thiếu id, quá nhiều dòng, kỳ sai)', async () => {
  const put = (period, data, base = 2) => call('PUT', '/api/ts/docs/' + period, { email: 'ts1@example.com', body: { baseVersion: base, data } });
  assert.equal((await put('2026-11', { entries: [myEntry(1, '2026-10-15')] })).status, 400, 'ngày 15/10 thuộc kỳ trước');
  assert.equal((await put('2026-11', { entries: [myEntry(1, '2026-11-16')] })).status, 400, 'ngày 16/11 thuộc kỳ sau');
  assert.equal((await put('2026-11', { entries: [{ date: '2026-11-02' }] })).status, 400);
  assert.equal((await put('2026-11', { entries: [myEntry('abc', '2026-11-02')] })).status, 400);
  assert.equal((await put('2026-11', { entries: [myEntry(5, 'xx')] })).status, 400);
  assert.equal((await put('2026-11', { entries: Array.from({ length: 401 }, (_, i) => myEntry(2000 + i, '2026-11-02')) })).status, 400);
  assert.equal((await put('2026-11', { entries: [myEntry(7, '2026-11-02', { remarks: 'x'.repeat(3000) })] })).status, 400);
  assert.equal((await put('2026-13', { entries: [] }, 0)).status, 400);
  assert.equal((await put('abc', { entries: [] }, 0)).status, 400);
  assert.equal((await call('PUT', '/api/ts/docs/2026-11', { email: 'ts1@example.com', body: { data: { entries: [] } } })).status, 400, 'thiếu baseVersion');
  assert.equal((await call('GET', '/api/ts/docs/2026-11', { email: 'ts1@example.com' })).data.data.entries.length, 3, 'không dòng sai nào được ghi');
  assert.equal((await put('2026-01', { entries: [myEntry(1, '2025-12-16'), myEntry(2, '2026-01-15')] }, 0)).status, 200, 'kỳ tháng 1 chạy từ 16/12 năm trước');
});

test('timesheet cá nhân: đã nộp / đã duyệt thì khoá, không sửa được; bị từ chối thì sửa lại được', async () => {
  for (const status of ['submitted', 'sitesup_ok', 'approved']) {
    await env.DB.prepare("UPDATE ts_docs SET status = ? WHERE emp_id = 'TS1' AND period = '2026-11'").bind(status).run();
    const cur = (await call('GET', '/api/ts/docs/2026-11', { email: 'ts1@example.com' })).data.version;
    const r = await call('PUT', '/api/ts/docs/2026-11', { email: 'ts1@example.com', body: { baseVersion: cur, data: { entries: [myEntry(1, '2026-11-02')] } } });
    assert.equal(r.status, 423, status); assert.equal(r.data.locked, true); assert.equal(r.data.status, status);
  }
  assert.equal((await call('GET', '/api/ts/docs/2026-11', { email: 'ts1@example.com' })).data.data.entries.length, 3);
  await env.DB.prepare("UPDATE ts_docs SET status = 'rejected' WHERE emp_id = 'TS1' AND period = '2026-11'").run();
  const cur = (await call('GET', '/api/ts/docs/2026-11', { email: 'ts1@example.com' })).data.version;
  const r = await call('PUT', '/api/ts/docs/2026-11', { email: 'ts1@example.com', body: { baseVersion: cur, data: { entries: [myEntry(1, '2026-11-02')] } } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
});

// ---------- nộp bảng công, duyệt hai cấp, đẩy sang bảng Theo dõi giờ công ----------
const okEntry = (id, date, extra = {}) => myEntry(id, date, { workNumber: 'WA-1', projectName: 'Dự án duyệt', bd: { NORMAL: 8 }, cat: 'NI', ...extra });
const putDoc = (email, period, entries, base) => call('PUT', '/api/ts/docs/' + period, { email, body: { baseVersion: base, data: { entries, deleted: {}, sch: 'mon-sat-am' } } });
const docOf = async (email, period) => (await call('GET', '/api/ts/docs/' + period, { email })).data;
const submit = async (email, period) => call('POST', `/api/ts/docs/${period}/submit`, { email, body: { baseVersion: (await docOf(email, period)).version } });
const tsRowsOf = async () => (await readTs('boss@example.com')).rows;

test('duyệt: chuẩn bị Site Sup, Quản lý dự án, dự án WA-1 và người nộp', async () => {
  await call('POST', '/api/admin/import', { email: 'boss@example.com', body: {
    employees: [{ empId: 'AP1', fullName: 'Giám Sát Duyệt', position: 'Site Supervisor' }, { empId: 'AP2', fullName: 'Giám Sát Khác', position: 'Site Supervisor' }, { empId: 'AP3', fullName: 'Quản Lý Duyệt', position: 'Project Manager' }, { empId: 'TS3', fullName: 'Thợ Ba', position: 'Fitter', supervisor: 'Giám Sát Khác' }],
    projects: [{ wbs: 'WA-1', projectName: 'Dự án duyệt' }] } });
  const r = await call('POST', '/api/admin/emails', { email: 'boss@example.com', body: { items: [{ empId: 'AP1', email: 'ap1@example.com' }, { empId: 'AP2', email: 'ap2@example.com' }, { empId: 'AP3', email: 'ap3@example.com' }, { empId: 'TS3', email: 'ts3@example.com' }] } });
  assert.equal(r.data.applied, 4);
  assert.equal((await call('PUT', '/api/projects/WA-1/staff', { email: 'boss@example.com', body: { sitesup: ['AP1'], pm: ['AP3'] } })).status, 200);
});

test('nộp: thiếu / sai phân loại giờ bị từ chối; hợp lệ thì khoá bảng công', async () => {
  assert.equal((await submit('ts2@example.com', '2026-12')).status, 404, 'chưa có bảng công');
  await putDoc('ts2@example.com', '2026-12', [myEntry(1, '2026-11-16', { workNumber: 'WA-1' })], 0);
  let r = await submit('ts2@example.com', '2026-12');
  assert.equal(r.status, 400); assert.match(r.data.error, /chưa có phân loại giờ/);
  await putDoc('ts2@example.com', '2026-12', [okEntry(1, '2026-11-16', { bd: { NORMAL: 5 } })], 1);
  r = await submit('ts2@example.com', '2026-12');
  assert.equal(r.status, 400); assert.match(r.data.error, /không khớp/);
  await putDoc('ts2@example.com', '2026-12', [okEntry(1, '2026-11-16'), okEntry(2, '2026-11-17', { bd: { NORMAL: 6, OT1: 2 } })], 2);
  r = await call('POST', '/api/ts/docs/2026-12/submit', { email: 'ts2@example.com', body: { baseVersion: 1 } });
  assert.equal(r.status, 409); assert.equal(r.data.conflict, true, 'số phiên bản cũ');
  r = await submit('ts2@example.com', '2026-12');
  assert.equal(r.status, 400); assert.match(r.data.error, /1 ngày tăng ca chưa được Site Sup duyệt \(17\/11\)/);
  // fitter gửi ngày tăng ca → Site Sup duyệt → nộp được
  const entries = (await docOf('ts2@example.com', '2026-12')).data.entries;
  const days = OtLeave.otDays(entries, e => e.bd);
  r = await call('PUT', '/api/ts/ot/mine', { email: 'ts2@example.com', body: { period: '2026-12', days } });
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.days['2026-11-17'].status, 'pending');
  r = await call('POST', '/api/ts/ot/decide', { email: 'ap1@example.com', body: { action: 'approve', items: [{ emp: 'TS2', date: '2026-11-17', sig: days[0].sig }] } });
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.done, 1);
  r = await submit('ts2@example.com', '2026-12');
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.status, 'submitted');
  assert.equal((await submit('ts2@example.com', '2026-12')).status, 409, 'nộp lần hai');
  const put = await putDoc('ts2@example.com', '2026-12', [okEntry(1, '2026-11-16')], 3);
  assert.equal(put.status, 423, 'đã nộp thì khoá');
  assert.equal((await docOf('ts2@example.com', '2026-12')).status, 'submitted');
});

test('duyệt: chỉ người phụ trách dự án thấy và duyệt được; người khác bị từ chối', async () => {
  const inbox = (email) => call('GET', '/api/ts/inbox', { email });
  assert.deepEqual((await inbox('ap1@example.com')).data.items.map(i => [i.empId, i.period, i.level, i.wbs]), [['TS2', '2026-12', 'sitesup', ['WA-1']]]);
  assert.deepEqual((await inbox('ap2@example.com')).data.items, [], 'Site Sup không phụ trách dự án này');
  assert.deepEqual((await inbox('ap3@example.com')).data.items, [], 'Quản lý dự án chỉ thấy khi giám sát đã duyệt');
  assert.equal((await inbox('ts1@example.com')).status, 403, 'nhân viên thường không có hộp duyệt');
  assert.equal((await call('GET', '/api/ts/review/TS2/2026-12', { email: 'ap2@example.com' })).status, 403);
  const rv = await call('GET', '/api/ts/review/TS2/2026-12', { email: 'ap1@example.com' });
  assert.equal(rv.status, 200); assert.equal(rv.data.canAct, true); assert.equal(rv.data.name, 'Thợ Hai'); assert.equal(rv.data.data.entries.length, 2);
  assert.equal((await call('POST', '/api/ts/review/TS2/2026-12/approve', { email: 'ap2@example.com', body: {} })).status, 403);
  assert.equal((await call('POST', '/api/ts/review/TS2/2026-12/approve', { email: 'ap3@example.com', body: {} })).status, 403, 'QLDA chưa đến lượt: không có quyền ở cấp Site Sup');
  assert.equal((await call('POST', '/api/ts/review/TS2/2026-12/approve', { email: 'ts1@example.com', body: {} })).status, 403);
});

test('duyệt: Site Sup duyệt → QLDA duyệt → dòng sang bảng Theo dõi giờ công, thay chứ không nhân đôi', async () => {
  const before = (await call('GET', '/api/timesheets/meta', { email: 'boss@example.com' })).data;
  let r = await call('POST', '/api/ts/review/TS2/2026-12/approve', { email: 'ap1@example.com', body: {} });
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.status, 'sitesup_ok');
  assert.equal((await call('POST', '/api/ts/review/TS2/2026-12/approve', { email: 'ap1@example.com', body: {} })).status, 403, 'đã qua cấp Site Sup');
  assert.equal((await docOf('ts2@example.com', '2026-12')).status, 'sitesup_ok');
  assert.equal((await call('GET', '/api/ts/inbox', { email: 'ap1@example.com' })).data.items.length, 0);
  const inb = (await call('GET', '/api/ts/inbox', { email: 'ap3@example.com' })).data.items;
  assert.deepEqual(inb.map(i => [i.empId, i.level, i.sitesupBy]), [['TS2', 'pm', 'Giám Sát Duyệt']]);
  assert.equal((await call('POST', '/api/ts/docs/2026-12/withdraw', { email: 'ts2@example.com', body: {} })).status, 409, 'giám sát đã duyệt thì không thu hồi được');
  r = await call('POST', '/api/ts/review/TS2/2026-12/approve', { email: 'ap3@example.com', body: {} });
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.status, 'approved'); assert.equal(r.data.pushed, 2);
  const after = (await call('GET', '/api/timesheets/meta', { email: 'boss@example.com' })).data;
  assert.equal(after.count, before.count + 2); assert.equal(after.version, before.version + 1, 'máy khách sẽ tải lại bảng Theo dõi giờ công');
  const rows = (await tsRowsOf()).filter(x => x.empId === 'TS2');
  assert.equal(rows.length, 2);
  const day2 = rows.find(x => x.date === '2026-11-17');
  assert.deepEqual([day2.normal, day2.ot1, day2.total, day2.wbs, day2.activities, day2.category, day2.empName, day2.isFitter, day2.source], [6, 2, 8, 'WA-1', '1110', 'NI', 'Thợ Hai', true, 'approved']);
  assert.equal((await docOf('ts2@example.com', '2026-12')).status, 'approved');
  assert.equal((await putDoc('ts2@example.com', '2026-12', [], 3)).status, 423, 'đã duyệt xong thì khoá hẳn');
  const log = (await call('GET', '/api/admin/audit?limit=20', { email: 'boss@example.com' })).data.entries.map(e => e.action);
  assert.ok(['ts_submit', 'ts_sitesup_ok', 'ts_approved'].every(a => log.includes(a)));
});

test('duyệt: trả lại cần lý do; người nộp sửa lại và nộp lại; duyệt lần hai thay dòng cũ', async () => {
  await putDoc('ts3@example.com', '2026-12', [okEntry(11, '2026-11-18'), okEntry(12, '2026-11-19')], 0);
  assert.equal((await submit('ts3@example.com', '2026-12')).status, 200);
  // Thợ Ba có "Quản lý trực tiếp" là Giám Sát Khác (AP2) → AP2 cũng duyệt được dù không phụ trách dự án
  assert.equal((await call('GET', '/api/ts/inbox', { email: 'ap2@example.com' })).data.items.length, 1);
  assert.equal((await call('POST', '/api/ts/review/TS3/2026-12/reject', { email: 'ap1@example.com', body: { note: '' } })).status, 400);
  const rj = await call('POST', '/api/ts/review/TS3/2026-12/reject', { email: 'ap1@example.com', body: { note: 'Thiếu ngày 20/11' } });
  assert.equal(rj.status, 200); assert.equal(rj.data.status, 'rejected');
  const mine = (await call('GET', '/api/ts/docs', { email: 'ts3@example.com' })).data.docs.find(d => d.period === '2026-12');
  assert.equal(mine.status, 'rejected'); assert.match(mine.note, /Giám Sát Duyệt: Thiếu ngày 20\/11/);
  const d = await docOf('ts3@example.com', '2026-12');
  assert.equal((await putDoc('ts3@example.com', '2026-12', [...d.data.entries, okEntry(13, '2026-11-20')], d.version)).status, 200, 'bị trả lại thì sửa được');
  assert.equal((await submit('ts3@example.com', '2026-12')).status, 200);
  assert.equal((await call('POST', '/api/ts/review/TS3/2026-12/approve', { email: 'ap1@example.com', body: {} })).status, 200);
  assert.equal((await call('POST', '/api/ts/review/TS3/2026-12/approve', { email: 'ap3@example.com', body: {} })).status, 200);
  assert.equal((await tsRowsOf()).filter(x => x.empId === 'TS3').length, 3);
  // trả lại sau khi QLDA duyệt không được (đã xong); nhưng admin nạp lại + duyệt lại kỳ khác không nhân đôi: giả lập duyệt lại bằng cách đưa trạng thái về sitesup_ok
  await env.DB.prepare("UPDATE ts_docs SET status = 'sitesup_ok' WHERE emp_id = 'TS3' AND period = '2026-12'").run();
  assert.equal((await call('POST', '/api/ts/review/TS3/2026-12/approve', { email: 'ap3@example.com', body: {} })).status, 200);
  assert.equal((await tsRowsOf()).filter(x => x.empId === 'TS3').length, 3, 'duyệt lại không nhân đôi dòng');
});

test('duyệt: thu hồi khi giám sát chưa duyệt', async () => {
  await putDoc('ts1@example.com', '2026-12', [okEntry(21, '2026-11-18')], 0);
  assert.equal((await submit('ts1@example.com', '2026-12')).status, 200);
  assert.equal((await call('POST', '/api/ts/docs/2026-12/withdraw', { email: 'ts1@example.com', body: {} })).status, 200);
  assert.equal((await docOf('ts1@example.com', '2026-12')).status, 'draft');
  assert.equal((await call('GET', '/api/ts/inbox', { email: 'ap1@example.com' })).data.items.filter(i => i.empId === 'TS1').length, 0);
});

test('bảng Theo dõi giờ công: admin nạp lại từ Excel không làm mất dòng đã duyệt (trừ ngày đã có dòng mới của người đó)', async () => {
  const cur = (await call('GET', '/api/timesheets/meta', { email: 'boss@example.com' })).data;
  const approvedBefore = (await tsRowsOf()).filter(x => x.source === 'approved').length;
  assert.ok(approvedBefore >= 5);
  const up = await uploadTs('boss@example.com', [tsRow(1), { ...tsRow(2), empId: 'TS2', date: '2026-11-17', empName: 'Thợ Hai' }], { baseVersion: cur.version });
  assert.equal(up.commit.status, 200, JSON.stringify(up.commit.data));
  const rows = await tsRowsOf();
  assert.equal(rows.filter(x => x.empId === 'TS2').length, 2, 'ngày 17/11 lấy bản Excel mới, ngày 16/11 giữ bản đã duyệt');
  assert.equal(rows.find(x => x.empId === 'TS2' && x.date === '2026-11-17').source, undefined, 'bản Excel thắng ở ngày trùng');
  assert.equal(rows.find(x => x.empId === 'TS2' && x.date === '2026-11-16').source, 'approved');
  assert.equal(rows.filter(x => x.empId === 'TS3').length, 3, 'người khác không bị ảnh hưởng');
  assert.equal(up.commit.data.count, rows.length);
});

test('gợi ý người nhận mail báo cáo: Site Sup / QLDA của đúng các dự án hỏi', async () => {
  const r = await call('GET', '/api/ts/approvers?wbs=WA-1,KHONG-CO', { email: 'ts1@example.com' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.approvers.map(a => [a.name, a.email, a.level, a.wbs]), [['Quản Lý Duyệt', 'ap3@example.com', 'pm', ['WA-1']], ['Giám Sát Duyệt', 'ap1@example.com', 'sitesup', ['WA-1']]]);
  assert.deepEqual((await call('GET', '/api/ts/approvers?wbs=', { email: 'ts1@example.com' })).data.approvers, []);
  assert.equal((await call('GET', '/api/ts/approvers?wbs=WA-1', { email: 'boss@example.com' })).status, 403, 'tài khoản chưa gắn nhân viên');
  assert.equal((await call('GET', '/api/ts/approvers?wbs=WA-1')).status, 401);
  // không lộ email người đã bị khoá
  await call('PATCH', '/api/admin/employees/AP1', { email: 'boss@example.com', body: { active: false } });
  assert.deepEqual((await call('GET', '/api/ts/approvers?wbs=WA-1', { email: 'ts1@example.com' })).data.approvers.map(a => a.level), ['pm']);
  await call('PATCH', '/api/admin/employees/AP1', { email: 'boss@example.com', body: { active: true } });
});

// ---------- thư tự động (Brevo) ----------
import { runDigest, runReminders, vnDate } from '../../server/notify.mjs';
const staffEmail = (n) => `ts${n}@example.com`;

test('thư: chuẩn bị TS4–TS6 (cùng phụ trách dự án WA-1) và TS7 (chỉ có Quản lý trực tiếp)', async () => {
  await call('POST', '/api/admin/import', { email: 'boss@example.com', body: { employees: [
    { empId: 'TS4', fullName: 'Thợ Bốn', position: 'Fitter' }, { empId: 'TS5', fullName: 'Thợ Năm', position: 'Fitter' },
    { empId: 'TS6', fullName: 'Thợ Sáu', position: 'Fitter' }, { empId: 'TS7', fullName: 'Thợ Bảy', position: 'Fitter', supervisor: 'Giám Sát Khác' }] } });
  const r = await call('POST', '/api/admin/emails', { email: 'boss@example.com', body: { items: [4, 5, 6, 7].map(n => ({ empId: 'TS' + n, email: staffEmail(n) })) } });
  assert.equal(r.data.applied, 4);
});

test('thư: nộp → báo Site Sup; Site Sup duyệt → báo Quản lý dự án; duyệt xong / trả lại → báo người nộp', async () => {
  sentMail.length = 0;
  await putDoc(staffEmail(4), '2026-12', [okEntry(41, '2026-11-18')], 0);
  assert.equal((await submit(staffEmail(4), '2026-12')).status, 200);
  assert.equal(sentMail.length, 1);
  let m = sentMail[0];
  assert.deepEqual(m.to.map(t => t.email), ['ap1@example.com']);
  assert.match(m.subject, /Thợ Bốn đã nộp kỳ lương 12\/2026 — chờ Site Sup duyệt/);
  assert.equal(m.sender.email, 'noreply@example.com'); assert.equal(m.key, 'test-key');
  assert.equal(m.sender.name, 'Bộ công cụ'); assert.match(m.htmlContent, /Thư tự động từ Bộ công cụ\./, 'chân thư dùng đúng tên người gửi đã cấu hình');
  assert.match(m.htmlContent, /https:\/\/nihan-ts\.pages\.dev\/tools\/approvals\/#xem=TS4\/2026-12/, 'nút mở thẳng bảng công vừa nộp');
  assert.match(m.htmlContent, /8 giờ<\/b> \(thường 8, tăng ca 0\) · 1 ngày làm việc · 1 dòng/, 'thư có tổng giờ của bảng công');
  sentMail.length = 0;
  assert.equal((await call('POST', '/api/ts/review/TS4/2026-12/approve', { email: 'ap1@example.com', body: {} })).status, 200);
  assert.deepEqual(sentMail.map(x => x.to.map(t => t.email)), [['ap3@example.com']]);
  assert.match(sentMail[0].subject, /chờ Quản lý dự án duyệt/); assert.match(sentMail[0].htmlContent, /Giám Sát Duyệt/);
  sentMail.length = 0;
  assert.equal((await call('POST', '/api/ts/review/TS4/2026-12/approve', { email: 'ap3@example.com', body: {} })).status, 200);
  assert.deepEqual(sentMail.map(x => x.to.map(t => t.email)), [[staffEmail(4)]]); assert.match(sentMail[0].subject, /đã được duyệt xong/);
  // trả lại
  await putDoc(staffEmail(5), '2026-12', [okEntry(51, '2026-11-18')], 0);
  assert.equal((await submit(staffEmail(5), '2026-12')).status, 200);
  sentMail.length = 0;
  assert.equal((await call('POST', '/api/ts/review/TS5/2026-12/reject', { email: 'ap1@example.com', body: { note: 'Thiếu ngày 20/11 <b>gấp</b>' } })).status, 200);
  assert.deepEqual(sentMail.map(x => x.to.map(t => t.email)), [[staffEmail(5)]]);
  assert.match(sentMail[0].htmlContent, /Thiếu ngày 20\/11 &lt;b&gt;gấp&lt;\/b&gt;/, 'nội dung người dùng nhập được thoát HTML');
});

test('thư: không có người phụ trách dự án → Quản lý trực tiếp; không ai cả → admin', async () => {
  sentMail.length = 0;
  await putDoc(staffEmail(7), '2026-12', [okEntry(71, '2026-11-18', { workNumber: 'KHONG-DU-AN' })], 0);
  assert.equal((await submit(staffEmail(7), '2026-12')).status, 200);
  assert.deepEqual(sentMail.map(x => x.to.map(t => t.email)), [['ap2@example.com']], 'Thợ Bảy có Quản lý trực tiếp là Giám Sát Khác (AP2)');
  sentMail.length = 0;
  await putDoc(staffEmail(6), '2026-12', [okEntry(61, '2026-11-18', { workNumber: 'KHONG-DU-AN' })], 0);
  assert.equal((await submit(staffEmail(6), '2026-12')).status, 200);
  assert.deepEqual(sentMail[0].to.map(t => t.email).sort(), ['boss@example.com', 'pm@example.com'], 'không ai phụ trách → báo admin (email admin khởi tạo + người được đặt quyền admin) để không bị bỏ quên');
});

test('thư: Brevo lỗi hoặc chưa cấu hình thì nộp / duyệt vẫn thành công', async () => {
  brevoMode = 'fail'; sentMail.length = 0;
  await putDoc('ts2@example.com', '2027-01', [okEntry(91, '2026-12-18')], 0);
  assert.equal((await submit('ts2@example.com', '2027-01')).status, 200, 'Brevo trả 401 nhưng bảng công vẫn được nộp');
  assert.equal(sentMail.length, 1);
  brevoMode = 'ok';
  await putDoc('ts2@example.com', '2027-02', [okEntry(92, '2027-01-18')], 0);
  sentMail.length = 0;
  const d = (await docOf('ts2@example.com', '2027-02'));
  const r = await call('POST', '/api/ts/docs/2027-02/submit', { email: 'ts2@example.com', body: { baseVersion: d.version }, envOver: { BREVO_API_KEY: '' } });
  assert.equal(r.status, 200); assert.equal(sentMail.length, 0, 'chưa có khoá API → không gọi Brevo');
});

test('thư thử: chỉ admin; báo rõ khi chưa cấu hình; /api/health cho biết đã cấu hình hay chưa', async () => {
  sentMail.length = 0;
  assert.equal((await call('POST', '/api/admin/mail/test', { email: 'ts1@example.com', body: {} })).status, 403);
  const ok = await call('POST', '/api/admin/mail/test', { email: 'boss@example.com', body: {} });
  assert.equal(ok.data.ok, true); assert.match(sentMail[0].subject, /^\[Thử\] Email từ Bộ công cụ$/); assert.equal(ok.data.to, 'boss@example.com'); assert.equal(sentMail.length, 1);
  const none = await call('POST', '/api/admin/mail/test', { email: 'boss@example.com', body: {}, envOver: { MAIL_FROM: '' } });
  assert.equal(none.data.ok, false); assert.equal(none.data.configured, false); assert.match(none.data.error, /BREVO_API_KEY/);
  brevoMode = 'fail';
  const bad = await call('POST', '/api/admin/mail/test', { email: 'boss@example.com', body: {} });
  assert.equal(bad.data.ok, false); assert.match(bad.data.error, /401/); brevoMode = 'ok';
  assert.equal((await call('GET', '/api/health')).data.config.MAIL, true);
  assert.equal((await call('GET', '/api/health', { envOver: { BREVO_API_KEY: '' } })).data.config.MAIL, false);
});

test('báo cáo tối: mỗi người phụ trách một thư với dòng chấm công của fitter trong ngày; chạy lại không gửi trùng', async () => {
  const day = '2026-11-05', now = new Date('2026-11-05T11:30:00Z');       // 18:30 giờ Việt Nam
  const e = (id, date, extra) => okEntry(id, date, { report: 'Đã lắp xong ray tầng 5', ...extra });
  await putDoc(staffEmail(4), '2026-11', [e(401, day), e(402, '2026-11-04', { report: 'hôm qua' }), e(403, day, { activityCode: '6010', report: 'nghỉ phép' })], 0);
  await putDoc(staffEmail(7), '2026-11', [e(701, day, { workNumber: '', projectName: '', report: 'Việc không thuộc dự án' })], 0);
  sentMail.length = 0;
  const sum = await runDigest(env, { now });
  assert.equal(sum.date, day); assert.equal(sum.entries, 2, 'chỉ dòng của ngày, bỏ mã nghỉ phép');
  assert.equal(sum.sent, sum.recipients, JSON.stringify(sum)); assert.ok(sum.pending >= 1);
  const ap1 = mailsTo('ap1@example.com'), ap3 = mailsTo('ap3@example.com'), ap2 = mailsTo('ap2@example.com');
  assert.equal(ap1.length, 1); assert.equal(ap3.length, 1); assert.equal(ap2.length, 1);
  assert.match(ap1[0].subject, /\[Báo cáo thi công\] Thứ 5 05\/11\/2026 — 1 dòng/);
  assert.match(ap1[0].htmlContent, /Thợ Bốn/); assert.match(ap1[0].htmlContent, /Đã lắp xong ray tầng 5/); assert.match(ap1[0].htmlContent, /8 giờ/);
  assert.doesNotMatch(ap1[0].htmlContent, /hôm qua|nghỉ phép|Thợ Bảy/);
  assert.match(ap2[0].htmlContent, /Thợ Bảy/); assert.doesNotMatch(ap2[0].htmlContent, /Thợ Bốn/, 'AP2 chỉ nhận fitter mình quản lý trực tiếp');
  // ⏳ bảng công chờ duyệt: TS7 (Quản lý trực tiếp AP2) đã nộp kỳ 12/2026 → thư của AP2 có mục chờ duyệt, bấm mở thẳng bảng công
  assert.match(ap2[0].subject, /· 1 chờ duyệt$/); assert.match(ap2[0].htmlContent, /Bảng công chờ bạn duyệt/);
  assert.match(ap2[0].htmlContent, /tools\/approvals\/#xem=TS7\/2026-12/);
  assert.ok(sentMail.some(m => m.to.some(t => t.email === 'boss@example.com') && /#xem=TS6\/2026-12/.test(m.htmlContent)), 'bảng công không ai phụ trách → admin thấy trong mục chờ duyệt');
  sentMail.length = 0;
  const again = await runDigest(env, { now });
  assert.equal(again.sent, 0); assert.equal(again.skipped, sum.sent); assert.equal(sentMail.length, 0);
  // ⚠️ ngày 06/11 (T6) TS7 đang dùng Timesheet kỳ 11 nhưng chưa chấm → báo Quản lý trực tiếp (AP2)
  const s6 = await runDigest(env, { now: new Date('2026-11-06T11:30:00Z') });
  assert.equal(s6.entries, 0, 'ngày khác không có dòng nào'); assert.ok(s6.missing >= 1, JSON.stringify(s6));
  const m6 = mailsTo('ap2@example.com');
  assert.equal(m6.length, 1); assert.match(m6[0].htmlContent, /Hôm nay chưa chấm công<\/h3><p style="margin:0">[^<]*Thợ Bảy/);
  assert.match(m6[0].subject, /— 0 dòng chấm công/);
  sentMail.length = 0;
  const s8 = await runDigest(env, { now: new Date('2026-11-08T11:30:00Z') });     // Chủ nhật
  assert.equal(s8.missing, 0, 'Chủ nhật không báo chưa chấm công');
  assert.equal((await runDigest({ ...env, BREVO_API_KEY: '' }, { now })).sent, 0);
});

test('nhắc hạn: ngày 9 nhắc người chưa nộp; ngày 11 nhắc lại và nhắc người duyệt; ngày khác không gửi; không gửi trùng', async () => {
  // kỳ 2026-11: TS4 chưa nộp (bản nháp), TS1 bị trả lại, TS7 đã nộp
  const d4 = await docOf(staffEmail(4), '2026-11'); assert.equal(d4.status, 'draft');
  await submit(staffEmail(7), '2026-11');
  assert.equal((await call('GET', '/api/ts/docs', { email: staffEmail(7) })).data.docs.find(d => d.period === '2026-11').status, 'submitted');
  sentMail.length = 0;
  assert.equal((await runReminders(env, { now: new Date('2026-11-08T01:00:00Z') })).sent, 0, 'ngày 8 không nhắc');
  const s9 = await runReminders(env, { now: new Date('2026-11-09T01:00:00Z') });
  assert.equal(s9.stage, 'r9'); assert.ok(s9.sent >= 3, JSON.stringify(s9));
  assert.ok(mailsTo(staffEmail(4)).length === 1 && /Hạn nộp bảng công kỳ 11\/2026 là 12\/11\/2026/.test(mailsTo(staffEmail(4))[0].subject));
  assert.match(mailsTo('ts1@example.com')[0].htmlContent, /trả lại/, 'người bị trả lại được nhắc sửa');
  assert.equal(mailsTo(staffEmail(7)).length, 0, 'đã nộp thì không nhắc');
  assert.ok(mailsTo('ap1@example.com').every(m => !/chờ bạn duyệt/.test(m.subject)), 'ngày 9 chưa nhắc người duyệt (AP1 chỉ nhận nhắc nộp bảng công của chính mình)');
  const total9 = sentMail.length;
  assert.equal((await runReminders(env, { now: new Date('2026-11-09T02:00:00Z') })).sent, 0, 'chạy lại cùng ngày không gửi trùng');
  sentMail.length = 0;
  const s11 = await runReminders(env, { now: new Date('2026-11-11T01:00:00Z') });
  assert.equal(s11.stage, 'r11'); assert.ok(s11.sent > 0);
  assert.match(mailsTo(staffEmail(4))[0].subject, /Ngày mai \(12\/11\) là hạn nộp/);
  const ap2 = mailsTo('ap2@example.com').filter(m => /chờ bạn duyệt/.test(m.subject));
  assert.equal(ap2.length, 1); assert.match(ap2[0].htmlContent, /Thợ Bảy/, 'AP2 là Quản lý trực tiếp của TS7 nên được nhắc duyệt');
  assert.ok(total9 > 0);
});


// ---------- chế độ Demo: cơ sở dữ liệu riêng, không ảnh hưởng dữ liệu thật ----------
const DEMO = 'ts_demo=1';
test('demo: trạng thái và vào demo (đặt cookie, dựng dữ liệu mẫu)', async () => {
  const st = await call('GET', '/api/demo/status', { email: 'boss@example.com' });
  assert.deepEqual(st.data, { available: true, active: false });
  const r = await call('POST', '/api/demo/start', { email: 'boss@example.com', body: { role: 'sitesup' } });
  assert.equal(r.status, 200);
  assert.match(r.setCookie, /ts_demo=1/); assert.match(r.setCookie, /HttpOnly/); assert.match(r.setCookie, /Secure/);
  assert.equal(r.data.role, 'sitesup'); assert.ok(r.data.employees >= 9 && r.data.timesheets > 50 && r.data.docs === 4);
  const me = await call('GET', '/api/me', { email: 'boss@example.com', cookie: DEMO });
  assert.equal(me.data.demo, true);
  assert.equal(me.data.empId, 'D002', 'vai Site Sup = nhân viên mẫu Trần Thị Bình');
  assert.equal(me.data.name, 'Trần Thị Bình');
  assert.deepEqual(me.data.roles, ['sitesup']);
  assert.equal(me.data.isAdmin, false, 'admin khởi tạo (ADMIN_EMAILS) không có hiệu lực trong demo — vai trò do người dùng chọn');
  assert.equal(me.data.projects.length, 2, 'Site Sup mẫu phụ trách 2 dự án');
});

test('demo: dữ liệu demo tách hẳn dữ liệu thật (đọc và ghi)', async () => {
  const real = await call('GET', '/api/projects', { email: 'boss@example.com' });
  const demo = await call('GET', '/api/projects', { email: 'boss@example.com', cookie: DEMO });
  assert.ok(demo.data.projects.some(p => p.wbs === 'DEMO-001'));
  assert.ok(!real.data.projects.some(p => p.wbs.startsWith('DEMO-')), 'dữ liệu thật không có dự án demo');
  await call('POST', '/api/demo/start', { email: 'boss@example.com', body: { role: 'admin' } });
  const patch = await call('PATCH', '/api/admin/projects/DEMO-001', { email: 'boss@example.com', cookie: DEMO, body: { fields: { projectName: 'Sửa trong demo' } } });
  assert.equal(patch.status, 200);
  const after = await call('GET', '/api/projects', { email: 'boss@example.com' });
  assert.deepEqual(after.data.projects.map(p => p.projectName), real.data.projects.map(p => p.projectName), 'sửa trong demo không đổi dữ liệu thật');
  const demoAfter = await call('GET', '/api/projects', { email: 'boss@example.com', cookie: DEMO });
  assert.equal(demoAfter.data.projects.find(p => p.wbs === 'DEMO-001').projectName, 'Sửa trong demo');
  const audit = await call('GET', '/api/admin/audit', { email: 'boss@example.com' });
  assert.ok(!audit.data.entries.some(e => e.entity_id === 'DEMO-001'), 'nhật ký thật không ghi thao tác demo');
});

test('demo: vai trò nhân viên không có quyền admin; vai trò đúng như đã chọn', async () => {
  await call('POST', '/api/demo/start', { email: 'someone@example.com', body: { role: 'staff' } });
  const me = await call('GET', '/api/me', { email: 'someone@example.com', cookie: DEMO });
  assert.deepEqual(me.data.roles, []);
  const deny = await call('POST', '/api/admin/projects/delete', { email: 'someone@example.com', cookie: DEMO, body: { wbs: ['DEMO-001'] } });
  assert.equal(deny.status, 403);
});

test('demo: trọn luồng như thật — Fitter nộp → Site Sup duyệt → QLDA duyệt; thư chỉ gửi về người thử, có [DEMO]', async () => {
  const T = 'tester@example.com', opt = { email: T, cookie: DEMO };
  await call('POST', '/api/demo/start', { email: T, body: { role: 'staff' } });
  sentMail.length = 0;
  const me = (await call('GET', '/api/me', opt)).data;
  assert.equal(me.empId, 'D101'); assert.deepEqual(me.roles, []);
  // gợi ý người nhận mail báo cáo ngày: về chính người thử, không lộ địa chỉ giả
  const ap = await call('GET', '/api/ts/approvers?wbs=DEMO-001', opt);
  assert.ok(ap.data.approvers.length >= 2); assert.ok(ap.data.approvers.every(a => a.email === T));
  assert.ok(ap.data.approvers.some(a => a.name === 'Trần Thị Bình' && a.level === 'sitesup'));
  // kỳ trước đã chấm đủ, chưa nộp → nộp
  const docs = (await call('GET', '/api/ts/docs', opt)).data;
  const per = (docs.docs || docs.items || []).map(d => d.period).sort()[0];
  const d = (await call('GET', '/api/ts/docs/' + per, opt)).data;
  assert.equal(d.status, 'draft');
  assert.equal((await call('POST', `/api/ts/docs/${per}/submit`, { ...opt, body: { baseVersion: d.version } })).status, 200);
  assert.equal(sentMail.length, 1);
  let m = sentMail[0];
  assert.deepEqual(m.to, [{ email: T }], 'thư demo chỉ tới người thử'); assert.equal(m.cc, undefined);
  assert.match(m.subject, /^\[DEMO\] \[Bảng công\] Phạm Minh Dũng đã nộp/);
  assert.match(m.htmlContent, /THƯ DEMO/); assert.match(m.htmlContent, /sẽ gửi tới: <b>Trần Thị Bình<\/b>/);
  // đổi vai Site Sup: dữ liệu giữ nguyên, thấy bảng công vừa nộp
  const sw = await call('POST', '/api/demo/role', { ...opt, body: { role: 'sitesup' } });
  assert.equal(sw.status, 200); assert.equal(sw.data.empId, 'D002');
  const inbox = (await call('GET', '/api/ts/inbox', opt)).data.items;
  assert.ok(inbox.some(x => x.empId === 'D101' && x.period === per), 'Site Sup thấy bảng công Fitter vừa nộp');
  sentMail.length = 0;
  assert.equal((await call('POST', `/api/ts/review/D101/${per}/approve`, { ...opt, body: {} })).status, 200);
  assert.equal(sentMail.length, 1); assert.deepEqual(sentMail[0].to, [{ email: T }]);
  assert.match(sentMail[0].subject, /^\[DEMO\].*chờ Quản lý dự án duyệt/); assert.match(sentMail[0].htmlContent, /Nguyễn Văn An/);
  // đổi vai Quản lý dự án → duyệt xong → báo người nộp (chính người thử, vai Phạm Minh Dũng)
  assert.equal((await call('POST', '/api/demo/role', { ...opt, body: { role: 'pm' } })).data.empId, 'D001');
  sentMail.length = 0;
  const done = await call('POST', `/api/ts/review/D101/${per}/approve`, { ...opt, body: {} });
  assert.equal(done.status, 200); assert.equal(done.data.status, 'approved');
  assert.equal(sentMail.length, 1); assert.match(sentMail[0].subject, /^\[DEMO\].*đã được duyệt xong/);
  assert.match(sentMail[0].htmlContent, /sẽ gửi tới: <b>Phạm Minh Dũng \(CC: Trần Thị Bình\)<\/b>/, 'thật: gửi Fitter, CC Site Sup của dự án');
  assert.match(sentMail[0].htmlContent, /dòng đã chuyển sang bảng Theo dõi giờ công/);
  // chỉ một người dùng email người thử; đổi vai không tạo trùng email
  const emps = (await call('GET', '/api/employees', opt)).data.employees;
  assert.equal(emps.filter(e => e.email === T).length, 1);
  assert.ok(emps.filter(e => e.email !== T).every(e => /@demo\.invalid$/.test(e.email)), 'nhân viên mẫu khác chỉ có email giả');
  // không thư nào rời khỏi người thử
  const real = await call('POST', '/api/demo/role', { email: T, body: { role: 'pm' } });
  assert.equal(real.status, 400, 'đổi vai chỉ dùng trong demo');
});

test('demo: giới hạn số thư demo mỗi ngày', async () => {
  const T = 'quota@example.com', opt = { email: T, cookie: DEMO };
  await call('POST', '/api/demo/start', { email: T, body: { role: 'admin' } });
  const { DEMO_MAILS_PER_DAY } = await import('../../server/mail.mjs');
  sentMail.length = 0;
  let last;
  for (let i = 0; i < DEMO_MAILS_PER_DAY + 2; i++) last = await call('POST', '/api/admin/mail/test', { ...opt, body: { to: 'x@example.com' } });
  assert.ok(sentMail.length <= DEMO_MAILS_PER_DAY, 'không vượt giới hạn');
  assert.ok(sentMail.every(m => m.to.length === 1 && m.to[0].email === T), 'thư thử trong demo cũng chỉ về người thử');
  assert.equal(last.data.ok, false);
  await call('POST', '/api/demo/reset', { ...opt, body: {} });
  const after = await call('POST', '/api/admin/mail/test', { ...opt, body: { to: 'x@example.com' } });
  assert.equal(after.data.ok, false, 'làm mới dữ liệu demo không mở lại giới hạn trong ngày');
});

test('demo: làm lại dữ liệu mẫu và thoát demo', async () => {
  await call('POST', '/api/demo/start', { email: 'boss@example.com', body: { role: 'admin' } });
  await call('PATCH', '/api/admin/projects/DEMO-002', { email: 'boss@example.com', cookie: DEMO, body: { fields: { projectName: 'Đã sửa' } } });
  const rs = await call('POST', '/api/demo/reset', { email: 'boss@example.com', cookie: DEMO, body: {} });
  assert.equal(rs.status, 200); assert.equal(rs.data.role, 'admin');
  const p = await call('GET', '/api/projects', { email: 'boss@example.com', cookie: DEMO });
  assert.notEqual(p.data.projects.find(x => x.wbs === 'DEMO-002').projectName, 'Đã sửa');
  const noDemo = await call('POST', '/api/demo/reset', { email: 'boss@example.com', body: {} });
  assert.equal(noDemo.status, 400, 'reset chỉ dùng được khi đang ở demo');
  const stop = await call('POST', '/api/demo/stop', { email: 'boss@example.com', cookie: DEMO, body: {} });
  assert.match(stop.setCookie, /Max-Age=0/);
});

test('demo: máy chủ không có DB_DEMO → báo chưa bật, cookie bị bỏ qua', async () => {
  const r = await call('POST', '/api/demo/start', { email: 'boss@example.com', body: { role: 'admin' }, envOver: { DB_DEMO: undefined } });
  assert.equal(r.status, 503);
  const me = await call('GET', '/api/me', { email: 'boss@example.com', cookie: DEMO, envOver: { DB_DEMO: undefined } });
  assert.equal(me.data.demo, false);
  const st = await call('GET', '/api/demo/status', { email: 'boss@example.com', envOver: { DB_DEMO: undefined } });
  assert.equal(st.data.available, false);
});

test('phụ cấp xe: lưu cùng bảng công (đã làm sạch), dữ liệu sai bị từ chối', async () => {
  const fuel = (extra = {}) => ({ id: '501', type: 'fuel', wbs: 'WA-1', project: 'Dự án duyệt', from: '2027-01-16', to: '2027-02-15', location: 'Thủ Đức', remarks: '', ...extra });
  const put = (allow, base) => call('PUT', '/api/ts/docs/2027-02', { email: 'ts1@example.com', body: { baseVersion: base, data: { entries: [okEntry(901, '2027-01-18'), okEntry(902, '2027-01-19')], deleted: {}, allow } } });
  let r = await put({ rows: [fuel({ hack: 1, ownVehicle: true })], u: 77 }, 0);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const got = (await docOf('ts1@example.com', '2027-02')).data.allow;
  assert.equal(got.u, 77); assert.equal(got.rows[0].hack, undefined); assert.equal(got.rows[0].ownVehicle, false);
  assert.equal((await put({ rows: [fuel({ type: 'taxi' })] }, 1)).status, 400);
  assert.equal((await put({ rows: [fuel({ from: '2027-01-10' })] }, 1)).status, 400, 'ngoài kỳ lương');
  assert.equal((await put('abc', 1)).status, 400);
  assert.equal((await docOf('ts1@example.com', '2027-02')).version, 1, 'không ghi bản sai');
});

test('phụ cấp xe: còn lỗi thì không nộp được; hợp lệ thì nộp, thư báo Site Sup có số tiền, người duyệt thấy phụ cấp', async () => {
  const prov = { id: '502', type: 'province', wbs: 'WA-1', project: 'Dự án duyệt', from: '2027-01-16', to: '2027-02-15', ownVehicle: true };
  await call('PUT', '/api/ts/docs/2027-02', { email: 'ts1@example.com', body: { baseVersion: 1, data: { entries: [okEntry(901, '2027-01-18'), okEntry(902, '2027-01-19')], deleted: {}, allow: { rows: [prov], u: 80 } } } });
  let r = await submit('ts1@example.com', '2027-02');
  assert.equal(r.status, 400); assert.match(r.data.error, /Phụ cấp xe chưa hợp lệ.*trên 20 ngày/);
  await call('PUT', '/api/ts/docs/2027-02', { email: 'ts1@example.com', body: { baseVersion: 2, data: { entries: [okEntry(901, '2027-01-18'), okEntry(902, '2027-01-19')], deleted: {},
    allow: { rows: [{ id: '501', type: 'fuel', wbs: 'WA-1', project: 'Dự án duyệt', from: '2027-01-16', to: '2027-02-15' }], u: 90 } } } });
  sentMail.length = 0;
  r = await submit('ts1@example.com', '2027-02');
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.match(sentMail[0].htmlContent, /Phụ cấp xe:<\/b> Xăng xe 2 ngày = 120\.000 đ — tổng 120\.000 đ/);
  const rv = await call('GET', '/api/ts/review/TS1/2027-02', { email: 'ap1@example.com' });
  assert.equal(rv.status, 200); assert.equal(rv.data.data.allow.rows[0].type, 'fuel');
});

// ---------- duyệt tăng ca hằng ngày ----------
const otDaysOf = (entries) => OtLeave.otDays(entries, e => e.bd);
const putOt = (email, period, days) => call('PUT', '/api/ts/ot/mine', { email, body: { period, days } });
const decideOt = (email, action, items, note) => call('POST', '/api/ts/ot/decide', { email, body: { action, items, note } });
const otEntry = (id, date, end = '19:00', extra = {}) => okEntry(id, date, { endTime: end, bd: { NORMAL: 8, OT1: end === '19:00' ? 2 : 1 }, ...extra });

test('tăng ca: fitter gửi ngày OT → chờ duyệt; chỉ Site Sup của dự án / Quản lý trực tiếp thấy; dữ liệu sai bị từ chối', async () => {
  const entries = [otEntry(3001, '2027-02-17'), otEntry(3002, '2027-02-18', '18:00'), okEntry(3003, '2027-02-19')];
  const days = otDaysOf(entries);
  assert.deepEqual(days.map(d => [d.date, d.ot]), [['2027-02-17', 2], ['2027-02-18', 1]]);
  let r = await putOt('ts1@example.com', '2027-03', days);
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.added, 2);
  assert.deepEqual(Object.values(r.data.days).map(d => d.status), ['pending', 'pending']);
  assert.equal((await call('GET', '/api/ts/ot/mine?period=2027-03', { email: 'ts1@example.com' })).data.days['2027-02-18'].ot, 1);
  const inbox = (await call('GET', '/api/ts/ot/inbox', { email: 'ap1@example.com' })).data.items.filter(i => i.empId === 'TS1');
  assert.deepEqual(inbox.map(i => [i.date, i.ot, i.wbs]), [['2027-02-17', 2, ['WA-1']], ['2027-02-18', 1, ['WA-1']]]);
  assert.equal(inbox[0].items[0].report, 'Lắp ray tầng 3', 'người duyệt xem được báo cáo thi công của ngày');
  assert.equal((await call('GET', '/api/ts/ot/inbox', { email: 'ap2@example.com' })).data.items.filter(i => i.empId === 'TS1').length, 0, 'Site Sup khác không thấy');
  assert.equal((await call('GET', '/api/ts/ot/inbox', { email: 'ts2@example.com' })).status, 403);
  const counts = (await call('GET', '/api/ts/inbox', { email: 'ap1@example.com' })).data;
  assert.ok(counts.ot >= 2, 'huy hiệu trang chủ có số ngày tăng ca chờ duyệt');
  // dữ liệu sai
  assert.equal((await putOt('ts1@example.com', '2027-03', [{ ...days[0], date: '2027-03-20' }])).status, 400, 'ngoài kỳ');
  assert.equal((await putOt('ts1@example.com', '2027-03', [{ ...days[0], ot: 0 }])).status, 400);
  assert.equal((await putOt('ts1@example.com', '2027-03', [{ ...days[0], sig: '' }])).status, 400);
  assert.equal((await putOt('ts1@example.com', '2027-99', days)).status, 400);
  assert.equal((await call('GET', '/api/ts/ot/mine?period=2027-03', { email: 'ts2@example.com' })).data.days['2027-02-17'], undefined, 'mỗi người chỉ thấy của mình');
});

test('tăng ca: không duyệt cần lý do + thư báo fitter; sửa giờ → chờ duyệt lại; duyệt → thư báo; bỏ OT → xoá yêu cầu', async () => {
  const entries = [otEntry(3001, '2027-02-17'), otEntry(3002, '2027-02-18', '18:00'), okEntry(3003, '2027-02-19')];
  let days = otDaysOf(entries);
  const item = (d) => ({ emp: 'TS1', date: d.date, sig: d.sig });
  assert.equal((await decideOt('ap1@example.com', 'reject', [item(days[1])], '')).status, 400, 'thiếu lý do');
  assert.equal((await decideOt('ap2@example.com', 'approve', [item(days[0])])).data.skipped[0].reason, 'bạn không phải người duyệt');
  sentMail.length = 0;
  let r = await decideOt('ap1@example.com', 'reject', [item(days[1])], 'Ngày 18 không có lệnh tăng ca');
  assert.equal(r.status, 200); assert.equal(r.data.done, 1);
  assert.equal(sentMail.length, 1); assert.deepEqual(sentMail[0].to.map(t => t.email), ['ts1@example.com']);
  assert.match(sentMail[0].subject, /KHÔNG được duyệt/); assert.match(sentMail[0].htmlContent, /Ngày 18 không có lệnh tăng ca/);
  // fitter sửa giờ ngày 18 → dấu vân tay đổi → chờ duyệt lại; duyệt bằng dấu vân tay cũ bị bỏ qua
  const edited = [entries[0], otEntry(3002, '2027-02-18', '18:00', { startTime: '08:30', bd: { NORMAL: 8, OT1: 0.5 } }), entries[2]];
  const days2 = otDaysOf(edited);
  r = await putOt('ts1@example.com', '2027-03', days2);
  assert.equal(r.data.reset, 1); assert.equal(r.data.days['2027-02-18'].status, 'pending'); assert.equal(r.data.days['2027-02-18'].note, '');
  r = await decideOt('ap1@example.com', 'approve', [item(days[1])]);
  assert.equal(r.data.done, 0); assert.match(r.data.skipped[0].reason, /vừa sửa giờ/);
  sentMail.length = 0;
  r = await decideOt('ap1@example.com', 'approve', days2.map(item));
  assert.equal(r.data.done, 2);
  assert.equal(sentMail.length, 1, 'một thư cho nhiều ngày'); assert.match(sentMail[0].subject, /Đã duyệt 2 ngày tăng ca \(2,5 giờ\)/);
  // gửi lại y nguyên: vẫn đã duyệt
  r = await putOt('ts1@example.com', '2027-03', days2);
  assert.deepEqual(Object.values(r.data.days).map(d => [d.status, d.by]), [['approved', 'Giám Sát Duyệt'], ['approved', 'Giám Sát Duyệt']]);
  // bỏ tăng ca ngày 17 → yêu cầu của ngày đó bị xoá
  r = await putOt('ts1@example.com', '2027-03', days2.slice(1));
  assert.equal(r.data.removed, 1); assert.deepEqual(Object.keys(r.data.days), ['2027-02-18']);
  const log = (await call('GET', '/api/admin/audit?limit=30', { email: 'boss@example.com' })).data.entries.map(e => e.action);
  assert.ok(log.includes('ot_approve') && log.includes('ot_reject'));
});

test('tăng ca: nộp bảng công bị chặn khi còn ngày OT chưa duyệt / đã sửa sau khi duyệt; bảng công đã nộp thì OT khoá', async () => {
  const entries = [otEntry(3101, '2027-03-17'), otEntry(3102, '2027-03-18')];
  await putDoc('ts2@example.com', '2027-04', entries, 0);
  let r = await submit('ts2@example.com', '2027-04');
  assert.equal(r.status, 400); assert.match(r.data.error, /Còn 2 ngày tăng ca chưa được Site Sup duyệt \(17\/03, 18\/03\)/);
  const days = otDaysOf(entries);
  await putOt('ts2@example.com', '2027-04', days);
  await decideOt('ap1@example.com', 'approve', [{ emp: 'TS2', date: days[0].date, sig: days[0].sig }]);
  await decideOt('ap1@example.com', 'reject', [{ emp: 'TS2', date: days[1].date, sig: days[1].sig }], 'Không có lệnh');
  r = await submit('ts2@example.com', '2027-04');
  assert.equal(r.status, 400); assert.match(r.data.error, /Còn 1 ngày.*\(18\/03\).*1 ngày bị từ chối/);
  // sửa giờ ngày 17 sau khi đã duyệt (trên máy chủ) mà chưa duyệt lại → cũng bị chặn
  const edited = [otEntry(3101, '2027-03-17', '18:00'), okEntry(3102, '2027-03-18')];
  await putDoc('ts2@example.com', '2027-04', edited, 1);
  r = await submit('ts2@example.com', '2027-04');
  assert.equal(r.status, 400); assert.match(r.data.error, /\(17\/03\)/);
  const d2 = otDaysOf(edited);
  await putOt('ts2@example.com', '2027-04', d2);
  await decideOt('ap1@example.com', 'approve', d2.map(d => ({ emp: 'TS2', date: d.date, sig: d.sig })));
  r = await submit('ts2@example.com', '2027-04');
  assert.equal(r.status, 200, JSON.stringify(r.data));
  // đã nộp: gửi OT khác không đổi gì, duyệt / từ chối bị bỏ qua
  r = await putOt('ts2@example.com', '2027-04', []);
  assert.equal(r.data.locked, true); assert.equal(Object.keys(r.data.days).length, 1);
  r = await decideOt('ap1@example.com', 'reject', d2.map(d => ({ emp: 'TS2', date: d.date, sig: d.sig })), 'thử');
  assert.equal(r.data.done, 0); assert.equal(r.data.skipped[0].reason, 'bảng công đã nộp');
});

// ---------- đơn nghỉ phép / ốm ----------
const TsSyncPeriod = (d) => TsSync.periodOf(d);
const addD = (n) => OtLeave.addDay(vnDate(), n);
const leaveReq = (email, body) => call('POST', '/api/ts/leave', { email, body: { sch: 'mon-fri', ...body } });

test('đơn nghỉ: phải làm trước ngày bắt đầu; loại / ngày sai bị từ chối; trùng đơn → 409; thư tới Site Sup, QLDA, Quản lý trực tiếp', async () => {
  assert.equal((await leaveReq('ts3@example.com', { type: '6010', from: vnDate(), to: vnDate() })).status, 400, 'nghỉ hôm nay: quá muộn');
  assert.match((await leaveReq('ts3@example.com', { type: '6010', from: addD(-2), to: addD(1) })).data.error, /TRƯỚC ngày bắt đầu/);
  assert.equal((await leaveReq('ts3@example.com', { type: '1110', from: addD(7), to: addD(8) })).status, 400, 'không phải mã nghỉ');
  assert.equal((await leaveReq('ts3@example.com', { type: '6010', from: addD(8), to: addD(7) })).status, 400);
  assert.equal((await leaveReq('ts3@example.com', { type: '6010', from: addD(7), to: addD(60) })).status, 400, 'quá 31 ngày');
  sentMail.length = 0;
  const from = addD(7), to = addD(13);
  const r = await leaveReq('ts3@example.com', { type: '6020', from, to, reason: 'Sốt xuất huyết' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const want = OtLeave.leaveDays(from, to, 'mon-fri', LaborVN);
  assert.deepEqual(r.data.leave.days, want); assert.equal(r.data.leave.status, 'pending'); assert.equal(r.data.leave.label, 'Nghỉ ốm');
  assert.ok(want.length >= 4 && want.length <= 5, 'chỉ tính ngày làm việc');
  assert.equal(sentMail.length, 1);
  assert.deepEqual(sentMail[0].to.map(t => t.email).sort(), ['ap1@example.com', 'ap2@example.com', 'ap3@example.com']);
  assert.match(sentMail[0].subject, /\[Đơn nghỉ\] Thợ Ba xin Nghỉ ốm/); assert.match(sentMail[0].htmlContent, /Sốt xuất huyết/);
  assert.equal((await leaveReq('ts3@example.com', { type: '6010', from: addD(9), to: addD(20) })).status, 409, 'trùng đơn đang chờ');
  const mine = (await call('GET', '/api/ts/leave/mine', { email: 'ts3@example.com' })).data.leaves;
  assert.equal(mine.length, 1); assert.equal(mine[0].count, want.length);
});

test('đơn nghỉ: người duyệt thấy đơn; không duyệt cần lý do; duyệt → tự ghi dòng nghỉ vào bảng công, ghi lại không nhân đôi, thư báo fitter', async () => {
  const id = (await call('GET', '/api/ts/leave/mine', { email: 'ts3@example.com' })).data.leaves[0].id;
  for (const e of ['ap1@example.com', 'ap2@example.com', 'ap3@example.com']) {
    assert.ok((await call('GET', '/api/ts/leave/inbox', { email: e })).data.items.some(x => x.id === id), e);
  }
  assert.equal((await call('GET', '/api/ts/leave/inbox', { email: 'ts1@example.com' })).status, 403);
  assert.ok((await call('GET', '/api/ts/inbox', { email: 'ap2@example.com' })).data.leave >= 1);
  assert.equal((await call('POST', `/api/ts/leave/${id}/reject`, { email: 'ap2@example.com', body: { note: '' } })).status, 400);
  assert.equal((await call('POST', `/api/ts/leave/${id}/approve`, { email: 'ts1@example.com', body: {} })).status, 403);
  // bảng công của các kỳ nghỉ: làm trống để kiểm tra
  const leave = (await call('GET', '/api/ts/leave/mine', { email: 'ts3@example.com' })).data.leaves[0];
  const periods = [...new Set(leave.days.map(d => TsSyncPeriod(d.date)))];
  for (const p of periods) await env.DB.prepare('DELETE FROM ts_docs WHERE emp_id = ? AND period = ?').bind('TS3', p).run();
  sentMail.length = 0;
  let r = await call('POST', `/api/ts/leave/${id}/approve`, { email: 'ap2@example.com', body: {} });
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.written, leave.days.length);
  const got = [];
  for (const p of periods) got.push(...(await docOf('ts3@example.com', p)).data.entries);
  assert.deepEqual(got.map(e => e.date).sort(), leave.days.map(d => d.date));
  assert.ok(got.every(e => e.activityCode === '6020' && e.lv === String(id) && e.startTime === '08:00' && e.endTime === '17:00' && e.projectName === 'Nghỉ ốm'));
  assert.equal(sentMail.length, 1); assert.deepEqual(sentMail[0].to.map(t => t.email), ['ts3@example.com']);
  assert.match(sentMail[0].subject, /Đã duyệt: Nghỉ ốm/); assert.match(sentMail[0].htmlContent, /tự ghi vào bảng công/);
  // bấm duyệt lần nữa: không nhân đôi, không gửi thư nữa
  sentMail.length = 0;
  r = await call('POST', `/api/ts/leave/${id}/approve`, { email: 'ap2@example.com', body: {} });
  assert.equal(r.status, 200); assert.equal(r.data.written, 0); assert.equal(sentMail.length, 0);
  let n = 0;
  for (const p of periods) n += (await docOf('ts3@example.com', p)).data.entries.length;
  assert.equal(n, leave.days.length);
  assert.equal((await call('POST', `/api/ts/leave/${id}/cancel`, { email: 'ts3@example.com', body: {} })).status, 409, 'đã duyệt thì không tự huỷ được');
  assert.equal((await call('GET', '/api/ts/leave/inbox', { email: 'ap1@example.com' })).data.items.filter(x => x.id === id).length, 0);
});

test('đơn nghỉ: không duyệt → thư có lý do; fitter huỷ đơn chờ; quá ngày bắt đầu không duyệt được; kỳ đã nộp thì không ghi', async () => {
  let r = await leaveReq('ts3@example.com', { type: '6010', from: addD(43), to: addD(45) });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  sentMail.length = 0;
  assert.equal((await call('POST', `/api/ts/leave/${r.data.leave.id}/reject`, { email: 'ap1@example.com', body: { note: 'Đang gấp tiến độ' } })).status, 200);
  assert.match(sentMail[0].subject, /Không được duyệt: Nghỉ phép năm/); assert.match(sentMail[0].htmlContent, /Đang gấp tiến độ/);
  r = await leaveReq('ts3@example.com', { type: '6090', from: addD(43), to: addD(46) });
  assert.equal(r.status, 200, 'đơn bị từ chối không tính trùng');
  assert.equal((await call('POST', `/api/ts/leave/${r.data.leave.id}/cancel`, { email: 'ts1@example.com', body: {} })).status, 409, 'đơn của người khác');
  assert.equal((await call('POST', `/api/ts/leave/${r.data.leave.id}/cancel`, { email: 'ts3@example.com', body: {} })).status, 200);
  // đơn đã tới ngày bắt đầu mà chưa duyệt
  const late = await env.DB.prepare("INSERT INTO ts_leave (emp_id, type, date_from, date_to, days, reason, wbs, status, created_at) VALUES ('TS3', '6010', ?, ?, ?, '', 'WA-1', 'pending', '') RETURNING id")
    .bind(vnDate(), vnDate(), JSON.stringify([{ date: vnDate(), half: false }])).first();
  assert.equal((await call('GET', '/api/ts/leave/inbox', { email: 'ap1@example.com' })).data.items.find(x => x.id === late.id).expired, true);
  r = await call('POST', `/api/ts/leave/${late.id}/approve`, { email: 'ap1@example.com', body: {} });
  assert.equal(r.status, 409); assert.match(r.data.error, /không duyệt được nữa/);
  assert.equal((await call('POST', `/api/ts/leave/${late.id}/reject`, { email: 'ap1@example.com', body: { note: 'Quá hạn' } })).status, 200);
  // kỳ đã nộp: duyệt vẫn thành công nhưng không ghi, báo lại
  r = await leaveReq('ts3@example.com', { type: '6010', from: addD(50), to: addD(50 + (OtLeave.leaveDays(addD(50), addD(50), 'mon-fri', LaborVN).length ? 0 : 2)) });
  const p = TsSyncPeriod(r.data.leave.days[0].date);
  await env.DB.prepare('DELETE FROM ts_docs WHERE emp_id = ? AND period = ?').bind('TS3', p).run();
  await env.DB.prepare("INSERT INTO ts_docs (emp_id, period, version, status, data, entry_count, saved_at, saved_by) VALUES ('TS3', ?, 1, 'submitted', '{\"entries\":[],\"deleted\":{}}', 0, '', '')").bind(p).run();
  r = await call('POST', `/api/ts/leave/${r.data.leave.id}/approve`, { email: 'ap1@example.com', body: {} });
  assert.equal(r.status, 200); assert.equal(r.data.written, 0); assert.match(r.data.note, /đã nộp/);
});

test('báo cáo tối: có mục tăng ca chờ duyệt và đơn nghỉ chờ duyệt', async () => {
  const entries = [otEntry(3201, '2027-02-24')];
  await putOt('ts1@example.com', '2027-03', otDaysOf(entries));
  const lv = await leaveReq('ts3@example.com', { type: '6010', from: addD(60), to: addD(63), reason: 'Cưới em gái' });
  assert.equal(lv.status, 200, JSON.stringify(lv.data));
  await env.DB.prepare("DELETE FROM mail_log WHERE key LIKE 'digest:%'").run();
  sentMail.length = 0;
  const sum = await runDigest(env, { now: new Date() });
  assert.ok(sum.ot >= 1 && sum.leave >= 1, JSON.stringify(sum));
  const m = mailsTo('ap1@example.com')[0];
  assert.ok(m, 'Site Sup nhận thư');
  assert.match(m.htmlContent, /Tăng ca chờ bạn duyệt/); assert.match(m.htmlContent, /Thợ Một/);
  assert.match(m.htmlContent, /Đơn nghỉ chờ bạn duyệt/); assert.match(m.htmlContent, /Cưới em gái/);
  assert.match(m.subject, /ngày OT chờ duyệt/);
});

// ---------- thư duyệt xong kèm Excel ----------
test('duyệt xong: thư kèm Excel gửi Fitter, CC Site Sup của dự án; tệp sai bị bỏ; không có tệp vẫn duyệt và báo rõ', async () => {
  const zip = (n) => 'UEsDBBQAAAAIA' + 'A'.repeat(n);          // giả dạng zip (chữ ký PK) — máy chủ chỉ kiểm tra chữ ký, kích thước, tên
  const files = [{ name: 'Tho Mot_Thang_03_2027.xlsx', content: zip(200) }, { name: 'Phu_cap_xe.xlsx', content: zip(300) },
    { name: 'virus.exe', content: zip(200) }, { name: 'x.xlsx', content: 'bad base64!!' }, { name: 'y.xlsx', content: 'QUJD' + 'A'.repeat(200) }];
  await putDoc('ts1@example.com', '2027-05', [okEntry(4101, '2027-04-20')], 0);
  assert.equal((await submit('ts1@example.com', '2027-05')).status, 200);
  assert.equal((await call('POST', '/api/ts/review/TS1/2027-05/approve', { email: 'ap1@example.com', body: {} })).status, 200);
  sentMail.length = 0;
  let r = await call('POST', '/api/ts/review/TS1/2027-05/approve', { email: 'ap3@example.com', body: { files } });
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.status, 'approved');
  assert.equal(sentMail.length, 1);
  const m = sentMail[0];
  assert.deepEqual(m.to.map(t => t.email), ['ts1@example.com']);
  assert.deepEqual((m.cc || []).map(t => t.email), ['ap1@example.com'], 'CC Site Sup của dự án WA-1, không báo admin');
  assert.deepEqual(m.attachment.map(a => a.name), ['Tho_Mot_Thang_03_2027.xlsx'.replace('Tho_Mot', 'Tho Mot'), 'Phu_cap_xe.xlsx'], 'chỉ giữ tệp .xlsx hợp lệ');
  assert.match(m.subject, /Thợ Một — kỳ lương 5\/2027 đã được duyệt xong \(kèm Excel\)/);
  assert.match(m.htmlContent, /Đính kèm/);
  // không gửi tệp: vẫn duyệt, thư không kèm file và báo rõ
  await putDoc('ts2@example.com', '2027-05', [okEntry(4102, '2027-04-20')], 0);
  await submit('ts2@example.com', '2027-05');
  await call('POST', '/api/ts/review/TS2/2027-05/approve', { email: 'ap1@example.com', body: {} });
  sentMail.length = 0;
  r = await call('POST', '/api/ts/review/TS2/2027-05/approve', { email: 'ap3@example.com', body: {} });
  assert.equal(r.status, 200);
  assert.equal(sentMail[0].attachment, undefined); assert.match(sentMail[0].htmlContent, /không kèm file Excel/);
});
