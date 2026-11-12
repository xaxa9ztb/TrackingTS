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

async function call(method, p, { email, token, body, contentType, envOver, cookie, demoHeader = true } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  // trình duyệt ở chế độ demo luôn gửi kèm header này (js/demo.js)
  if (cookie && /ts_demo=1/.test(cookie) && demoHeader) headers['x-ts-demo'] = '1';
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
  // thư gửi hàng loạt (messageVersions): tách thành từng thư như người nhận thấy
  if (body.messageVersions) body.messageVersions.forEach(v => sentMail.push({ url, key: init.headers['api-key'], sender: body.sender, ...v }));
  else sentMail.push({ url, key: init.headers['api-key'], ...body });
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
// Admin xử lý cuối (cấp 3): bảng công đã qua Site Sup + QLDA → Process → approved
const finalApprove = (emp, period, files) => call('POST', `/api/ts/review/${emp}/${period}/approve`, { email: 'boss@example.com', body: files ? { files } : {} });
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
  // tăng ca chưa duyệt KHÔNG chặn nộp: vẫn nhận, có thư nhắc người nộp và Site Sup
  const entries = (await docOf('ts2@example.com', '2026-12')).data.entries;
  const days = OtLeave.otDays(entries, e => e.bd);
  r = await call('PUT', '/api/ts/ot/mine', { email: 'ts2@example.com', body: { period: '2026-12', days } });
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.days['2026-11-17'].status, 'pending');
  r = await decideOt('ap1@example.com', 'approve', [{ emp: 'TS2', date: '2026-11-17', sig: days[0].sig }]);
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
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.status, 'pm_ok', 'QLDA duyệt xong → chờ Admin xử lý cuối');
  assert.equal((await call('GET', '/api/timesheets/meta', { email: 'boss@example.com' })).data.count, before.count, 'chưa sang bảng Theo dõi giờ công khi Admin chưa xử lý');
  assert.equal((await call('POST', '/api/ts/review/TS2/2026-12/approve', { email: 'ap3@example.com', body: {} })).status, 403, 'QLDA không xử lý cuối');
  assert.equal((await call('GET', '/api/ts/inbox', { email: 'ap3@example.com' })).data.items.length, 0);
  assert.deepEqual((await call('GET', '/api/ts/inbox', { email: 'boss@example.com' })).data.items.filter(i => i.empId === 'TS2').map(i => [i.level, i.status]), [['admin', 'pm_ok']]);
  r = await finalApprove('TS2', '2026-12');
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
  assert.equal((await call('POST', '/api/ts/review/TS3/2026-12/approve', { email: 'ap3@example.com', body: {} })).data.status, 'pm_ok');
  assert.equal((await finalApprove('TS3', '2026-12')).status, 200);
  assert.equal((await tsRowsOf()).filter(x => x.empId === 'TS3').length, 3);
  // xử lý cuối lần nữa (giả lập: đưa trạng thái về pm_ok) không nhân đôi dòng
  await env.DB.prepare("UPDATE ts_docs SET status = 'pm_ok' WHERE emp_id = 'TS3' AND period = '2026-12'").run();
  assert.equal((await finalApprove('TS3', '2026-12')).status, 200);
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
  assert.equal((await call('POST', '/api/ts/review/TS4/2026-12/approve', { email: 'ap3@example.com', body: {} })).data.status, 'pm_ok');
  assert.equal(sentMail.length, 1); assert.ok(sentMail[0].to.some(t => t.email === 'boss@example.com') && !sentMail[0].to.some(t => t.email === staffEmail(4)), 'QLDA duyệt xong → báo Admin xử lý cuối (chưa báo người nộp)');
  assert.match(sentMail[0].subject, /chờ Admin xử lý cuối/);
  sentMail.length = 0;
  assert.equal((await finalApprove('TS4', '2026-12')).status, 200);
  assert.deepEqual(sentMail.map(x => x.to.map(t => t.email)), [[staffEmail(4)]]); assert.match(sentMail[0].subject, /đã được duyệt xong/);
  // trả lại
  await putDoc(staffEmail(5), '2026-12', [okEntry(51, '2026-11-18')], 0);
  assert.equal((await submit(staffEmail(5), '2026-12')).status, 200);
  sentMail.length = 0;
  assert.equal((await call('POST', '/api/ts/review/TS5/2026-12/reject', { email: 'ap1@example.com', body: { note: 'Thiếu ngày 20/11 <b>gấp</b>' } })).status, 200);
  assert.deepEqual(sentMail.map(x => x.to.map(t => t.email)), [[staffEmail(5)]]);
  assert.match(sentMail[0].htmlContent, /Thiếu ngày 20\/11 &lt;b&gt;gấp&lt;\/b&gt;/, 'nội dung người dùng nhập được thoát HTML');
});

test('thư: WBS không có trong danh sách dự án → Admin / Admin dự án duyệt', async () => {
  sentMail.length = 0;
  await putDoc(staffEmail(7), '2026-12', [okEntry(71, '2026-11-18', { workNumber: 'KHONG-DU-AN' })], 0);
  assert.equal((await submit(staffEmail(7), '2026-12')).status, 200);
  assert.deepEqual(sentMail[0].to.map(t => t.email).sort(), ['boss@example.com', 'pm@example.com'], 'WBS không có trong danh sách dự án → Admin / Admin dự án duyệt (không đi qua Site Sup, QLDA)');
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
  assert.match(ap1[0].subject, /^Thợ Bốn - Dự án duyệt - WA-1 - Chấm công\/báo cáo ngày 05\.11\.2026/);
  assert.doesNotMatch(ap1[0].subject, /Duyệt OT|Duyệt nghỉ phép/);
  for (const m of sentMail.filter(x => /Chấm công\/báo cáo ngày/.test(x.subject))) assert.equal(/Mở Duyệt bảng công/.test(m.htmlContent), / - Duyệt /.test(m.subject), 'nút duyệt chỉ khi có việc cần duyệt: ' + m.subject);
  assert.match(ap1[0].htmlContent, /Thợ Bốn/); assert.match(ap1[0].htmlContent, /Đã lắp xong ray tầng 5/); assert.match(ap1[0].htmlContent, /8 giờ/);
  assert.doesNotMatch(ap1[0].htmlContent, /hôm qua|nghỉ phép|Thợ Bảy/);
  assert.match(ap2[0].htmlContent, /Thợ Bảy/); assert.doesNotMatch(ap2[0].htmlContent, /Thợ Bốn/, 'AP2 chỉ nhận fitter mình quản lý trực tiếp');
  // ⏳ bảng công chờ duyệt: TS7 (Quản lý trực tiếp AP2) đã nộp kỳ 12/2026 → thư của AP2 có mục chờ duyệt, bấm mở thẳng bảng công
  assert.doesNotMatch(ap2[0].htmlContent, /#xem=TS7\/2026-12/, 'WBS không có trong danh sách dự án → không chờ Site Sup / QLDA');
  for (const id of ['TS6', 'TS7']) assert.ok(sentMail.some(m => m.to.some(t => t.email === 'boss@example.com') && new RegExp('#xem=' + id + '/2026-12').test(m.htmlContent)), 'bảng công có WBS không có trong danh sách → Admin thấy trong mục chờ duyệt');
  sentMail.length = 0;
  const again = await runDigest(env, { now });
  assert.equal(again.sent, 0); assert.equal(again.skipped, sum.sent); assert.equal(sentMail.length, 0);
  // ⚠️ ngày 06/11 (T6) TS7 đang dùng Timesheet kỳ 11 nhưng chưa chấm → báo Quản lý trực tiếp (AP2)
  const s6 = await runDigest(env, { now: new Date('2026-11-06T11:30:00Z') });
  assert.equal(s6.entries, 0, 'ngày khác không có dòng nào'); assert.ok(s6.missing >= 1, JSON.stringify(s6));
  const m6 = mailsTo('ap2@example.com');
  assert.equal(m6.length, 1); assert.match(m6[0].htmlContent, /Hôm nay chưa chấm công<\/h3><p style="margin:0">[^<]*Thợ Bảy/);
  assert.match(m6[0].subject, /Chấm công\/báo cáo ngày 06\.11\.2026/);
  sentMail.length = 0;
  const s8 = await runDigest(env, { now: new Date('2026-11-08T11:30:00Z') });     // Chủ nhật
  assert.equal(s8.missing, 0, 'Chủ nhật không báo chưa chấm công');
  assert.equal((await runDigest({ ...env, BREVO_API_KEY: '' }, { now })).sent, 0);
});

test('nhắc hạn: ngày 9 nhắc người chưa nộp; ngày 11 nhắc lại và nhắc người duyệt; ngày khác không gửi; không gửi trùng', async () => {
  // kỳ 2026-11: TS4 chưa nộp (bản nháp), TS1 bị trả lại, TS7 đã nộp
  const d4 = await docOf(staffEmail(4), '2026-11'); assert.equal(d4.status, 'draft');
  await submit(staffEmail(7), '2026-11');
  assert.equal((await call('GET', '/api/ts/docs', { email: staffEmail(7) })).data.docs.find(d => d.period === '2026-11').status, 'pm_ok', 'chỉ có hoạt động ngoài dự án → bỏ qua Site Sup / QLDA, chờ Admin');
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
  // TS7 chỉ có hoạt động ngoài dự án (không WBS) → không cần Site Sup / QLDA của dự án duyệt, thẳng Admin xử lý → Admin được nhắc
  const adm = mailsTo('boss@example.com').filter(m => /chờ bạn duyệt/.test(m.subject));
  assert.equal(adm.length, 1); assert.match(adm[0].htmlContent, /Thợ Bảy[^<]*chờ Admin xử lý cuối/, 'bảng công chỉ hoạt động ngoài dự án chờ Admin');
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
  const pmDone = await call('POST', `/api/ts/review/D101/${per}/approve`, { ...opt, body: {} });
  assert.equal(pmDone.status, 200); assert.equal(pmDone.data.status, 'pm_ok', 'QLDA duyệt xong → chờ Admin xử lý cuối');
  assert.equal(sentMail.length, 1); assert.match(sentMail[0].subject, /^\[DEMO\].*chờ Admin xử lý cuối/);
  // đổi vai Quản trị viên → xử lý cuối → duyệt xong → báo người nộp (chính người thử, vai Phạm Minh Dũng)
  assert.equal((await call('POST', '/api/demo/role', { ...opt, body: { role: 'admin' } })).status, 200);
  sentMail.length = 0;
  const done = await call('POST', `/api/ts/review/D101/${per}/approve`, { ...opt, body: {} });
  assert.equal(done.status, 200); assert.equal(done.data.status, 'approved');
  assert.equal(sentMail.length, 1); assert.match(sentMail[0].subject, /^\[DEMO\].*đã được duyệt xong/);
  assert.match(sentMail[0].htmlContent, /sẽ gửi tới: <b>Phạm Minh Dũng \(CC: Trần Thị Bình, Nguyễn Văn An/, 'thật: gửi Fitter, CC Site Sup + QLDA của dự án + Admin');
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
  const prov = { id: '502', type: 'province', wbs: 'WA-1', project: 'Dự án duyệt', from: '2027-01-16', to: '2027-02-15', ownVehicle: false };
  await call('PUT', '/api/ts/docs/2027-02', { email: 'ts1@example.com', body: { baseVersion: 1, data: { entries: [okEntry(901, '2027-01-18'), okEntry(902, '2027-01-19')], deleted: {}, allow: { rows: [prov], u: 80 } } } });
  let r = await submit('ts1@example.com', '2027-02');
  assert.equal(r.status, 400); assert.match(r.data.error, /Phụ cấp xe chưa hợp lệ.*tự mang xe/);
  await call('PUT', '/api/ts/docs/2027-02', { email: 'ts1@example.com', body: { baseVersion: 2, data: { entries: [okEntry(901, '2027-01-18'), okEntry(902, '2027-01-19')], deleted: {},
    allow: { rows: [{ id: '501', type: 'fuel', wbs: 'WA-1', project: 'Dự án duyệt', from: '2027-01-18', to: '2027-01-19' }], u: 90 } } } });
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

test('tăng ca: nộp bảng công KHÔNG bị chặn khi còn ngày OT chưa duyệt — vẫn nhận, thư nhắc người nộp + Site Sup; sửa sau khi duyệt thì tính lại; đã duyệt xong thì OT khoá', async () => {
  const entries = [otEntry(3101, '2027-03-17'), otEntry(3102, '2027-03-18')];
  await putDoc('ts2@example.com', '2027-04', entries, 0);
  const days = otDaysOf(entries);
  await putOt('ts2@example.com', '2027-04', days);
  await decideOt('ap1@example.com', 'approve', [{ emp: 'TS2', date: days[0].date, sig: days[0].sig }]);
  await decideOt('ap1@example.com', 'reject', [{ emp: 'TS2', date: days[1].date, sig: days[1].sig }], 'Không có lệnh');
  sentMail.length = 0;
  const r = await submit('ts2@example.com', '2027-04');
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.status, 'submitted'); assert.equal(r.data.otPending, 1);
  const own = mailsTo('ts2@example.com'), sup = mailsTo('ap1@example.com');
  assert.ok(own.some(m => /còn 1 ngày tăng ca chưa được duyệt/.test(m.subject) && /18\/03\/2027[\s\S]*bị từ chối/.test(m.htmlContent)), 'thư nhắc người nộp, nêu ngày bị từ chối');
  assert.ok(sup.some(m => /còn 1 ngày tăng ca chờ bạn duyệt/.test(m.subject) && /#tangca/.test(m.htmlContent)), 'thư nhắc Site Sup');
  assert.ok(sup.some(m => /đã nộp kỳ lương 4\/2027/.test(m.subject)), 'thư nộp bảng công vẫn gửi như thường');
  // bảng công đã nộp: Site Sup vẫn duyệt OT được (ngày bị từ chối đã sửa & gửi lại thì không còn ở đây vì bảng công đã khoá)
  const d2 = days.slice(1);
  const rr = await decideOt('ap1@example.com', 'approve', d2.map(d => ({ emp: 'TS2', date: d.date, sig: d.sig })));
  assert.equal(rr.data.done, 1, 'duyệt OT sau khi đã nộp');
  // OT chưa gửi lên máy chủ lúc nộp (máy khách chưa kịp): máy chủ tạo yêu cầu chờ duyệt để người duyệt thấy
  await putDoc('ts3@example.com', '2027-04', [otEntry(3201, '2027-03-19')], 0);
  const r3 = await submit('ts3@example.com', '2027-04');
  assert.equal(r3.status, 200); assert.equal(r3.data.otPending, 1);
  assert.equal((await call('GET', '/api/ts/ot/inbox', { email: 'ap1@example.com' })).data.items.filter(i => i.empId === 'TS3').length, 1);
  // bảng công đã duyệt xong: OT khoá
  await env.DB.prepare("UPDATE ts_docs SET status = 'approved' WHERE emp_id = 'TS2' AND period = '2027-04'").run();
  const x = await decideOt('ap1@example.com', 'reject', d2.map(d => ({ emp: 'TS2', date: d.date, sig: d.sig })), 'thử');
  assert.equal(x.data.done, 0); assert.equal(x.data.skipped[0].reason, 'bảng công đã duyệt xong');
});

// ---------- đơn nghỉ phép / ốm ----------
const TsSyncPeriod = (d) => TsSync.periodOf(d);
const addD = (n) => OtLeave.addDay(vnDate(), n);
// đồng hồ giả lập (giờ Việt Nam): thứ Hai 2027-08-02 09:00. Giờ bắt đầu nghỉ = 08:00 ngày nghỉ đầu.
const AT = (iso) => ({ TEST_NOW: iso + '+07:00' });
const leaveReq = (email, body, at = '2027-08-02T09:00:00') => call('POST', '/api/ts/leave', { email, body: { sch: 'mon-fri', ...body }, envOver: AT(at) });
const leaveCall = (m, p, o, at = '2027-08-02T09:00:00') => call(m, p, { ...o, envOver: AT(at) });
const TS3_SUP = 'ap2@example.com';          // Quản lý trực tiếp của Thợ Ba (cột Giám sát = Giám Sát Khác)

test('đơn nghỉ: hạn nộp theo loại — ốm ≥ 2 giờ; phép 1 ngày ≥ 24 giờ, 2–3 ngày ≥ 3 ngày, dài hơn ≥ 1 tuần; loại / ngày sai bị từ chối; trùng đơn → 409', async () => {
  const bad = (r, re) => { assert.equal(r.status, 400, JSON.stringify(r.data)); assert.match(r.data.error, re); };
  // nghỉ ốm hôm nay (3/8 08:00): nộp lúc 09:00 ngày 2 → còn 23 giờ — được; nộp sát giờ (lúc 06:30 sáng cùng ngày nghỉ) → quá hạn
  assert.equal((await leaveReq('ts3@example.com', { type: '6020', from: '2027-08-03', to: '2027-08-03', reason: 'Sốt cao' }, '2027-08-03T05:59:00')).status, 200, 'ốm: 06:00 vẫn kịp (đủ 2 giờ)');
  await env.DB.prepare("DELETE FROM ts_leave").run();
  bad(await leaveReq('ts3@example.com', { type: '6020', from: '2027-08-03', to: '2027-08-03' }, '2027-08-03T06:30:00'), /phải nộp đơn trước tối thiểu 2 giờ \(muộn nhất 06:00 ngày 03\/08\/2027/);
  // nghỉ phép 1 ngày: trước 24 giờ
  bad(await leaveReq('ts3@example.com', { type: '6010', from: '2027-08-03', to: '2027-08-03' }, '2027-08-02T09:00:00'), /trước 24 giờ/);
  assert.equal((await leaveReq('ts3@example.com', { type: '6010', from: '2027-08-04', to: '2027-08-04' }, '2027-08-02T09:00:00')).status, 200);
  await env.DB.prepare("DELETE FROM ts_leave").run();
  // 2–3 ngày: trước 3 ngày (T2 9:00 → nghỉ T5 sớm nhất là 5/8 08:00 ≥ 72 giờ? 2/8 09:00 → 5/8 08:00 = 71 giờ → thiếu 1 giờ)
  bad(await leaveReq('ts3@example.com', { type: '6010', from: '2027-08-05', to: '2027-08-06' }, '2027-08-02T09:00:00'), /trước 3 ngày/);
  assert.equal((await leaveReq('ts3@example.com', { type: '6010', from: '2027-08-05', to: '2027-08-06' }, '2027-08-02T08:00:00')).status, 200, 'đủ đúng 72 giờ');
  await env.DB.prepare("DELETE FROM ts_leave").run();
  // dài hơn (4 ngày công trở lên): trước 1 tuần
  bad(await leaveReq('ts3@example.com', { type: '6010', from: '2027-08-09', to: '2027-08-12' }, '2027-08-02T09:00:00'), /trước 1 tuần/);
  assert.equal((await leaveReq('ts3@example.com', { type: '6010', from: '2027-08-10', to: '2027-08-13' }, '2027-08-02T09:00:00')).status, 200);
  await env.DB.prepare("DELETE FROM ts_leave").run();
  // sai
  bad(await leaveReq('ts3@example.com', { type: '6010', from: '2027-08-01', to: '2027-08-04' }), /ngày đã qua/);
  bad(await leaveReq('ts3@example.com', { type: '1110', from: '2027-08-20', to: '2027-08-21' }), /Loại nghỉ không hợp lệ/);
  bad(await leaveReq('ts3@example.com', { type: '6010', from: '2027-08-21', to: '2027-08-20' }), /Ngày nghỉ không hợp lệ/);
  bad(await leaveReq('ts3@example.com', { type: '6010', from: '2027-08-20', to: '2027-10-20' }), /tối đa 31 ngày/);
  bad(await leaveReq('ts3@example.com', { type: '6010', from: '2027-08-14', to: '2027-08-15' }), /toàn ngày nghỉ hằng tuần/);
  // trùng đơn
  assert.equal((await leaveReq('ts3@example.com', { type: '6010', from: '2027-08-20', to: '2027-08-20', reason: 'Đám cưới' })).status, 200);
  assert.equal((await leaveReq('ts3@example.com', { type: '6090', from: '2027-08-20', to: '2027-08-20' })).status, 409);
  assert.equal((await leaveCall('GET', '/api/ts/leave/mine', { email: 'ts3@example.com' })).data.leaves.length, 1);
});

test('đơn nghỉ: chỉ Quản lý trực tiếp (và admin) nhận thư + duyệt; không tự duyệt; duyệt → ghi vào bảng công, không nhân đôi, thư báo fitter', async () => {
  await env.DB.prepare("DELETE FROM ts_leave").run();
  sentMail.length = 0;
  const from = '2027-08-18', to = '2027-08-20';
  const r = await leaveReq('ts3@example.com', { type: '6020', from, to, reason: 'Sốt xuất huyết' });
  assert.equal(r.status, 200, JSON.stringify(r.data)); const id = r.data.leave.id;
  assert.equal(sentMail.length, 1); assert.deepEqual(sentMail[0].to.map(t => t.email), [TS3_SUP], 'chỉ Quản lý trực tiếp, không báo Site Sup / QLDA của dự án');
  assert.match(sentMail[0].subject, /\[Đơn nghỉ\] Thợ Ba xin Nghỉ ốm 18\/08\/2027 → 20\/08\/2027 \(3 ngày công\) — duyệt trước 23:59 ngày 20\/08\/2027/);
  assert.match(sentMail[0].htmlContent, /tools\/leave\//); assert.match(sentMail[0].htmlContent, /Sốt xuất huyết/);
  const inbox = async (e) => (await leaveCall('GET', '/api/ts/leave/inbox', { email: e })).data.items.filter(x => x.id === id).length;
  assert.equal(await inbox(TS3_SUP), 1); assert.equal(await inbox('boss@example.com'), 1, 'admin duyệt thay');
  assert.equal(await inbox('ap1@example.com'), 0, 'Site Sup của dự án không phải quản lý trực tiếp'); assert.equal(await inbox('ap3@example.com'), 0);
  assert.equal((await leaveCall('POST', `/api/ts/leave/${id}/approve`, { email: 'ap1@example.com', body: {} })).status, 403);
  assert.equal((await leaveCall('POST', `/api/ts/leave/${id}/approve`, { email: 'ts3@example.com', body: {} })).status, 403, 'không tự duyệt');
  assert.equal((await leaveCall('POST', `/api/ts/leave/${id}/reject`, { email: TS3_SUP, body: { note: '' } })).status, 400);
  assert.ok((await leaveCall('GET', '/api/ts/inbox', { email: TS3_SUP })).data.leave >= 1, 'huy hiệu trang chủ');
  const leave = (await leaveCall('GET', '/api/ts/leave/mine', { email: 'ts3@example.com' })).data.leaves[0];
  const periods = [...new Set(leave.days.map(d => TsSyncPeriod(d.date)))];
  for (const p of periods) await env.DB.prepare('DELETE FROM ts_docs WHERE emp_id = ? AND period = ?').bind('TS3', p).run();
  sentMail.length = 0;
  let a = await leaveCall('POST', `/api/ts/leave/${id}/approve`, { email: TS3_SUP, body: {} }, '2027-08-18T20:00:00');   // nghỉ ốm đã bắt đầu nhưng vẫn duyệt được đến hết ngày nghỉ cuối
  assert.equal(a.status, 200, JSON.stringify(a.data)); assert.equal(a.data.written, leave.days.length);
  const got = [];
  for (const p of periods) got.push(...(await docOf('ts3@example.com', p)).data.entries);
  assert.deepEqual(got.map(e => e.date).sort(), leave.days.map(d => d.date));
  assert.ok(got.every(e => e.activityCode === '6020' && e.lv === String(id) && e.startTime === '08:00' && e.endTime === '17:00'));
  assert.equal(sentMail.length, 1); assert.deepEqual(sentMail[0].to.map(t => t.email), ['ts3@example.com']); assert.match(sentMail[0].subject, /Đã duyệt: Nghỉ ốm/);
  sentMail.length = 0;
  a = await leaveCall('POST', `/api/ts/leave/${id}/approve`, { email: TS3_SUP, body: {} });
  assert.equal(a.data.written, 0); assert.equal(sentMail.length, 0);
  assert.equal((await leaveCall('POST', `/api/ts/leave/${id}/cancel`, { email: 'ts3@example.com', body: {} })).status, 409, 'đã duyệt thì không tự huỷ');
});

test('đơn nghỉ: nghỉ phép phải duyệt TRƯỚC giờ bắt đầu; không duyệt kèm lý do; huỷ đơn chờ; người xin nghỉ không có quản lý trực tiếp → admin; kỳ đã nộp không ghi', async () => {
  await env.DB.prepare("DELETE FROM ts_leave").run();
  let r = await leaveReq('ts3@example.com', { type: '6010', from: '2027-08-25', to: '2027-08-25' });
  const id = r.data.leave.id;
  // quá giờ bắt đầu → không duyệt được, chỉ không duyệt
  r = await leaveCall('POST', `/api/ts/leave/${id}/approve`, { email: TS3_SUP, body: {} }, '2027-08-25T08:30:00');
  assert.equal(r.status, 409); assert.match(r.data.error, /quá hạn duyệt/);
  assert.equal((await leaveCall('GET', '/api/ts/leave/inbox', { email: TS3_SUP }, '2027-08-25T08:30:00')).data.items.find(x => x.id === id).expired, true);
  sentMail.length = 0;
  assert.equal((await leaveCall('POST', `/api/ts/leave/${id}/reject`, { email: TS3_SUP, body: { note: 'Quá hạn duyệt' } }, '2027-08-25T08:30:00')).status, 200);
  assert.match(sentMail[0].subject, /Không được duyệt: Nghỉ phép năm/); assert.match(sentMail[0].htmlContent, /Quá hạn duyệt/);
  // huỷ đơn chờ
  r = await leaveReq('ts3@example.com', { type: '6090', from: '2027-09-01', to: '2027-09-02' }, '2027-08-20T09:00:00');
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal((await leaveCall('POST', `/api/ts/leave/${r.data.leave.id}/cancel`, { email: 'ts1@example.com', body: {} })).status, 409, 'đơn của người khác');
  assert.equal((await leaveCall('POST', `/api/ts/leave/${r.data.leave.id}/cancel`, { email: 'ts3@example.com', body: {} })).status, 200);
  // người xin nghỉ không có quản lý trực tiếp (TS1) → thư tới admin, admin duyệt
  sentMail.length = 0;
  r = await leaveReq('ts1@example.com', { type: '6010', from: '2027-09-06', to: '2027-09-06' }, '2027-09-01T09:00:00');
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.ok(sentMail[0].to.some(t => t.email === 'boss@example.com'), 'không có quản lý trực tiếp → báo admin');
  assert.equal((await leaveCall('GET', '/api/ts/leave/inbox', { email: 'ap1@example.com' })).data.items.filter(x => x.empId === 'TS1').length, 0);
  // kỳ đã nộp: duyệt vẫn thành công nhưng không ghi, báo lại
  const p = TsSyncPeriod('2027-09-06');
  await env.DB.prepare('DELETE FROM ts_docs WHERE emp_id = ? AND period = ?').bind('TS1', p).run();
  await env.DB.prepare("INSERT INTO ts_docs (emp_id, period, version, status, data, entry_count, saved_at, saved_by) VALUES ('TS1', ?, 1, 'submitted', '{\"entries\":[],\"deleted\":{}}', 0, '', '')").bind(p).run();
  r = await leaveCall('POST', `/api/ts/leave/${r.data.leave.id}/approve`, { email: 'boss@example.com', body: {} }, '2027-09-01T10:00:00');
  assert.equal(r.status, 200); assert.equal(r.data.written, 0); assert.match(r.data.note, /đã nộp/);
});

test('báo cáo tối: tăng ca chờ duyệt gửi Site Sup; đơn nghỉ chờ duyệt gửi đúng Quản lý trực tiếp', async () => {
  const entries = [otEntry(3201, '2027-02-24')];
  await putOt('ts1@example.com', '2027-03', otDaysOf(entries));
  await env.DB.prepare("DELETE FROM ts_leave").run();
  const lv = await leaveReq('ts3@example.com', { type: '6010', from: '2027-08-30', to: '2027-09-02', reason: 'Cưới em gái' });
  assert.equal(lv.status, 200, JSON.stringify(lv.data));
  await env.DB.prepare("DELETE FROM mail_log WHERE key LIKE 'digest:%'").run();
  sentMail.length = 0;
  const sum = await runDigest(env, { now: new Date() });
  assert.ok(sum.ot >= 1 && sum.leave >= 1, JSON.stringify(sum));
  const m1 = mailsTo('ap1@example.com')[0];
  assert.ok(m1, 'Site Sup nhận thư'); assert.match(m1.htmlContent, /Đề nghị phê duyệt tăng ca/); assert.match(m1.htmlContent, /Thợ Một/);
  assert.doesNotMatch(m1.htmlContent, /Cưới em gái/, 'đơn nghỉ không gửi Site Sup của dự án');
  assert.match(m1.subject, /Chấm công\/báo cáo ngày .* - Duyệt OT/);
  const m2 = mailsTo(TS3_SUP).find(m => /Cưới em gái/.test(m.htmlContent));
  assert.ok(m2, 'Quản lý trực tiếp nhận đơn nghỉ trong thư tổng hợp'); assert.match(m2.htmlContent, /Đơn nghỉ chờ bạn duyệt/);
  assert.match(m2.subject, /Duyệt nghỉ phép/); assert.match(m2.htmlContent, /Mở Duyệt bảng công/);
});

// ---------- thư duyệt xong kèm Excel ----------
test('duyệt xong: thư kèm Excel gửi Fitter, CC Site Sup của dự án; tệp sai bị bỏ; không có tệp vẫn duyệt và báo rõ', async () => {
  const zip = (n) => 'UEsDBBQAAAAIA' + 'A'.repeat(n);          // giả dạng zip (chữ ký PK) — máy chủ chỉ kiểm tra chữ ký, kích thước, tên
  const files = [{ name: 'Tho Mot_Thang_03_2027.xlsx', content: zip(200) }, { name: 'Phu_cap_xe.xlsx', content: zip(300) },
    { name: 'virus.exe', content: zip(200) }, { name: 'x.xlsx', content: 'bad base64!!' }, { name: 'y.xlsx', content: 'QUJD' + 'A'.repeat(200) }];
  await putDoc('ts1@example.com', '2027-05', [okEntry(4101, '2027-04-20')], 0);
  assert.equal((await submit('ts1@example.com', '2027-05')).status, 200);
  assert.equal((await call('POST', '/api/ts/review/TS1/2027-05/approve', { email: 'ap1@example.com', body: {} })).status, 200);
  assert.equal((await call('POST', '/api/ts/review/TS1/2027-05/approve', { email: 'ap3@example.com', body: { files } })).data.status, 'pm_ok', 'QLDA duyệt xong chưa gửi thư kèm file — chờ Admin');
  sentMail.length = 0;
  let r = await finalApprove('TS1', '2027-05', files);
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.status, 'approved');
  assert.equal(sentMail.length, 1);
  const m = sentMail[0];
  assert.deepEqual(m.to.map(t => t.email), ['ts1@example.com']);
  assert.deepEqual((m.cc || []).map(t => t.email).sort(), ['ap1@example.com', 'ap3@example.com', 'boss@example.com'], 'CC Site Sup + QLDA của dự án WA-1 + Admin xử lý');
  assert.deepEqual(m.attachment.map(a => a.name), ['Tho_Mot_Thang_03_2027.xlsx'.replace('Tho_Mot', 'Tho Mot'), 'Phu_cap_xe.xlsx'], 'chỉ giữ tệp .xlsx hợp lệ');
  assert.match(m.subject, /Thợ Một — kỳ lương 5\/2027 đã được duyệt xong \(kèm Excel\)/);
  assert.match(m.htmlContent, /Đính kèm/);
  // không gửi tệp: vẫn duyệt, thư không kèm file và báo rõ
  await putDoc('ts2@example.com', '2027-05', [okEntry(4102, '2027-04-20')], 0);
  await submit('ts2@example.com', '2027-05');
  await call('POST', '/api/ts/review/TS2/2027-05/approve', { email: 'ap1@example.com', body: {} });
  await call('POST', '/api/ts/review/TS2/2027-05/approve', { email: 'ap3@example.com', body: {} });
  sentMail.length = 0;
  r = await finalApprove('TS2', '2027-05');
  assert.equal(r.status, 200);
  assert.equal(sentMail[0].attachment, undefined); assert.match(sentMail[0].htmlContent, /không kèm file Excel/);
});

test('gửi lại thư duyệt xong: chỉ Admin / Admin dự án; luôn CC người gửi lại; chưa xử lý cuối thì không gửi; lỗi Brevo báo rõ', async () => {
  const zip = 'UEsDBBQAAAAIA' + 'A'.repeat(200);
  const body = { files: [{ name: 'a.xlsx', content: zip }] };
  const url = '/api/ts/review/TS1/2027-05/resend';
  const list = (await call('GET', '/api/ts/approved', { email: 'boss@example.com' })).data.items;
  assert.ok(list.some(i => i.empId === 'TS1' && i.period === '2027-05' && i.pmBy === 'Quản Lý Duyệt' && i.finalBy));
  assert.equal((await call('GET', '/api/ts/approved', { email: 'ap3@example.com' })).status, 403, 'QLDA không còn gửi lại — Admin xử lý cuối');
  assert.equal((await call('GET', '/api/ts/approved', { email: 'ap1@example.com' })).status, 403);
  assert.equal((await call('POST', url, { email: 'ap3@example.com', body })).status, 403);
  assert.equal((await call('POST', url, { email: 'ts1@example.com', body })).status, 403);
  sentMail.length = 0;
  const r = await call('POST', url, { email: 'boss@example.com', body });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.match(sentMail[0].subject, /^\[Gửi lại\] Thợ Một/);
  assert.deepEqual(sentMail[0].to.map(t => t.email), ['ts1@example.com']);
  assert.deepEqual(sentMail[0].cc.map(t => t.email).sort(), ['ap1@example.com', 'ap3@example.com', 'boss@example.com'], 'CC Site Sup + QLDA của dự án + người gửi lại');
  assert.equal(sentMail[0].attachment.length, 1);
  assert.equal((await call('POST', url, { email: 'boss@example.com', body: { files: [] } })).status, 400);
  assert.equal((await call('POST', '/api/ts/review/TS3/2026-12/resend', { email: 'boss@example.com', body })).status, 200, 'bảng công đã duyệt xong khác');
  await env.DB.prepare("UPDATE ts_docs SET status = 'pm_ok' WHERE emp_id = 'TS1' AND period = '2027-05'").run();
  assert.equal((await call('POST', url, { email: 'boss@example.com', body })).status, 409, 'chưa được Admin xử lý cuối');
  await env.DB.prepare("UPDATE ts_docs SET status = 'approved' WHERE emp_id = 'TS1' AND period = '2027-05'").run();
  brevoMode = 'fail';
  const bad = await call('POST', url, { email: 'boss@example.com', body });
  brevoMode = 'ok';
  assert.equal(bad.status, 502); assert.match(bad.data.error, /Gửi thư không thành công/);
});

// ---------- nhắc chấm công, chấm bù, giám sát chỉ chấm OT ----------
test('báo cáo tối: nhắc fitter chưa chấm hôm nay (kèm ngày thiếu); ngày chấm bù gộp vào MỘT thư của giám sát; giám sát không bị nhắc; không gửi trùng', async () => {
  const day = '2027-06-10', now = new Date('2027-06-10T11:30:00Z');                // Thứ 5, 18:30 giờ Việt Nam
  const todayU = Date.parse('2027-06-10T09:00:00+07:00');
  await putDoc('ts1@example.com', '2027-06', [okEntry(6101, '2027-06-08', { u: 1 })], 0);                                  // chưa chấm hôm nay
  await putDoc('ts2@example.com', '2027-06', [okEntry(6201, day, { u: todayU }), okEntry(6202, '2027-06-07', { u: todayU, report: 'bù thứ 2' }),
    okEntry(6203, '2027-06-08', { u: todayU, report: 'bù thứ 3' })], 0);
  await putDoc('ap1@example.com', '2027-06', [okEntry(6301, '2027-06-08', { u: 1, bd: { OT1: 2 } })], 0);                 // giám sát: không bị nhắc
  sentMail.length = 0;
  const sum = await runDigest(env, { now });
  assert.equal(sum.late, 3 - 1, JSON.stringify(sum)); assert.ok(sum.fitterReminders >= 1);
  const rem = (e) => mailsTo(e).filter(m => /bạn chưa chấm công/.test(m.subject));
  assert.equal(rem('ts1@example.com').length, 1); assert.match(rem('ts1@example.com')[0].subject, /Hôm nay \(10\/06\/2027\) bạn chưa chấm công/);
  assert.match(rem('ts1@example.com')[0].htmlContent, /còn thiếu cả: <b>[^<]*17\/05[^<]*<\/b>/, 'liệt kê ngày còn thiếu trong kỳ');
  assert.equal(rem('ts2@example.com').length, 0, 'đã chấm hôm nay');
  assert.equal(rem('ap1@example.com').length, 0, 'giám sát không bị nhắc chấm công hằng ngày');
  // giám sát nhận MỘT thư tổng hợp: có phần chấm bù của Thợ Hai (2 ngày) và báo Thợ Một chưa chấm; AP1 (giám sát) không nằm trong danh sách chưa chấm
  const ap1 = mailsTo('ap1@example.com').filter(m => /Chấm công\/báo cáo ngày/.test(m.subject));
  assert.equal(ap1.length, 1, 'một thư duy nhất');
  assert.match(ap1[0].htmlContent, /Chấm công bù hôm nay[\s\S]*Thợ Hai<\/b> chấm bù 2 ngày: 07\/06, 08\/06/);
  assert.match(ap1[0].htmlContent, /bù thứ 2/); assert.match(ap1[0].subject, /^Thợ Hai - Dự án duyệt - WA-1 - Chấm công\/báo cáo ngày 10\.06\.2027/);
  assert.doesNotMatch(ap1[0].htmlContent, /Hôm nay chưa chấm công<\/h3><p style="margin:0">[^<]*Giám Sát Duyệt/);
  sentMail.length = 0;
  const again = await runDigest(env, { now });
  assert.equal(again.fitterReminders, 0); assert.equal(sentMail.length, 0, 'chạy lại không gửi trùng');
});

test('báo cáo tối: ngày có OT → "Đề nghị phê duyệt OT và chấm công"; chấm sau 18:30 → thư tổng hợp sáng hôm sau', async () => {
  const day = '2027-07-12', eve = new Date('2027-07-12T11:30:00Z'), morn = new Date('2027-07-13T01:00:00Z');
  const at = (hm) => Date.parse(`${day}T${hm}:00+07:00`);
  const e1 = otEntry(7101, day, '19:00', { u: at('17:30'), report: 'lắp ray' });
  await putDoc('ts1@example.com', '2027-07', [e1], 0);
  await putOt('ts1@example.com', '2027-07', otDaysOf([e1]));
  await putDoc('ts2@example.com', '2027-07', [okEntry(7201, day, { u: at('19:45'), report: 'chấm muộn' })], 0);   // sau 18:30
  await env.DB.prepare("DELETE FROM mail_log WHERE key LIKE 'digest%'").run();
  sentMail.length = 0;
  const sum = await runDigest(env, { now: eve });
  const ap = mailsTo('ap1@example.com').filter(m => /Chấm công|chấm công/.test(m.subject));
  assert.equal(ap.length, 1, JSON.stringify(sum));
  assert.match(ap[0].subject, /^Thợ Một - Dự án duyệt - WA-1 - Đề nghị phê duyệt OT và chấm công ngày 12\.07\.2027/);
  assert.match(ap[0].htmlContent, /lắp ray/); assert.doesNotMatch(ap[0].htmlContent, /chấm muộn/, 'dòng chấm sau 18:30 không vào thư 18:30');
  sentMail.length = 0;
  const am = await runDigest(env, { now: morn, morning: true });
  assert.equal(am.date, day); assert.equal(am.morning, true);
  const apm = mailsTo('ap1@example.com');
  assert.equal(apm.length, 1, JSON.stringify(am));
  assert.match(apm[0].subject, /^Thợ Hai - Dự án duyệt - WA-1 - Chấm công\/báo cáo ngày 12\.07\.2027/);
  assert.match(apm[0].htmlContent, /chấm muộn/); assert.doesNotMatch(apm[0].htmlContent, /lắp ray/);
  sentMail.length = 0;
  await runDigest(env, { now: morn, morning: true });
  assert.equal(sentMail.length, 0, 'thư sáng không gửi trùng');
});

test('giám sát: bảng công chỉ giờ OT nộp thẳng Quản lý dự án; đăng ký OT báo ngay QLDA; QLDA duyệt OT; không tự duyệt của mình', async () => {
  const lead = 'ap1@example.com', pm = 'ap3@example.com';
  const ot = (id, date) => okEntry(id, date, { startTime: '17:00', endTime: '19:00', breakTime: '0', bd: { OT1: 2 } });
  // dòng giờ thường → không nộp được
  await putDoc(lead, '2027-07', [okEntry(7001, '2027-06-17')], 0);
  let r = await submit(lead, '2027-07');
  assert.equal(r.status, 400); assert.match(r.data.error, /Giám sát chỉ nộp giờ tăng ca/);
  // đăng ký OT (trước khi làm: ngày trong tương lai) → thư tới QLDA, yêu cầu vào hộp OT của QLDA, không vào hộp của Site Sup khác
  await putDoc(lead, '2027-07', [ot(7101, '2027-06-17'), ot(7102, '2027-06-18')], 1);
  const days = otDaysOf([ot(7101, '2027-06-17'), ot(7102, '2027-06-18')]);
  sentMail.length = 0;
  r = await putOt(lead, '2027-07', days);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const m = mailsTo(pm).find(x => /đăng ký 2 ngày tăng ca/.test(x.subject));
  assert.ok(m, 'thư đăng ký OT tới Quản lý dự án'); assert.match(m.htmlContent, /Giám sát đăng ký tăng ca/);
  const inbox = (e) => call('GET', '/api/ts/ot/inbox', { email: e });
  assert.equal((await inbox(pm)).data.items.filter(i => i.empId === 'AP1').length, 2, 'QLDA thấy OT của giám sát');
  assert.equal((await inbox('ap2@example.com')).data.items.filter(i => i.empId === 'AP1').length, 0, 'Site Sup khác không duyệt OT của giám sát');
  assert.equal((await inbox(lead)).data.items.filter(i => i.empId === 'AP1').length, 0, 'không tự duyệt OT của mình');
  assert.equal((await decideOt(lead, 'approve', days.map(d => ({ emp: 'AP1', date: d.date, sig: d.sig })))).data.done, 0);
  const before = (await inbox(pm)).data.items.filter(i => i.empId === 'AP1');
  assert.ok(before.every(i => i.lead === true && i.late === false), 'đăng ký trước ngày làm');
  await env.DB.prepare("UPDATE ts_ot SET requested_at = '2027-06-19T01:00:00.000Z' WHERE emp_id = 'AP1' AND date = '2027-06-18'").run();
  assert.equal((await inbox(pm)).data.items.find(i => i.empId === 'AP1' && i.date === '2027-06-18').late, true, 'đăng ký sau ngày làm được đánh dấu');
  assert.equal((await decideOt(pm, 'approve', days.map(d => ({ emp: 'AP1', date: d.date, sig: d.sig })))).data.done, 2);
  // nộp: nộp thẳng QLDA (bỏ cấp Site Sup)
  sentMail.length = 0;
  r = await submit(lead, '2027-07');
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.status, 'sitesup_ok'); assert.equal(r.data.otPending, 0);
  assert.ok(mailsTo(pm).some(x => /đã nộp kỳ lương 7\/2027 \(giờ tăng ca\)/.test(x.subject) && /chỉ gồm giờ tăng ca/.test(x.htmlContent)));
  assert.equal(mailsTo('ap2@example.com').length, 0);
  assert.equal((await call('GET', '/api/ts/inbox', { email: pm })).data.items.filter(i => i.empId === 'AP1' && i.level === 'pm').length, 1);
  assert.equal((await call('GET', '/api/ts/inbox', { email: 'ap2@example.com' })).data.items.filter(i => i.empId === 'AP1').length, 0);
  assert.equal((await call('POST', '/api/ts/review/AP1/2027-07/approve', { email: lead, body: {} })).status, 403, 'không tự duyệt bảng công của mình');
  assert.equal((await call('POST', '/api/ts/docs/2027-07/withdraw', { email: lead, body: {} })).status, 200, 'thu hồi được khi QLDA chưa duyệt');
  assert.equal((await submit(lead, '2027-07')).status, 200);
  assert.equal((await call('POST', '/api/ts/review/AP1/2027-07/approve', { email: pm, body: {} })).data.status, 'pm_ok');
  assert.equal((await finalApprove('AP1', '2027-07')).data.status, 'approved');
});

// ---------- Admin / Admin dự án xem và sửa mọi bảng công ----------
test('Admin dự án: tạo vai trò; không quản lý tài khoản nhưng phân công dự án và dùng chức năng bảng công', async () => {
  await call('POST', '/api/admin/import', { email: 'boss@example.com', body: { employees: [{ empId: 'PA1', fullName: 'Admin Dự Án', position: 'Project Administrator' }, { empId: 'NA1', fullName: 'Fitter Không Tài Khoản', position: 'Fitter' }] } });
  assert.equal((await call('POST', '/api/admin/emails', { email: 'boss@example.com', body: { items: [{ empId: 'PA1', email: 'pa1@example.com' }] } })).data.applied, 1);
  assert.equal((await call('PATCH', '/api/admin/employees/PA1', { email: 'boss@example.com', body: { roleOverride: 'projadmin' } })).status, 200);
  const me = (await call('GET', '/api/me', { email: 'pa1@example.com' })).data;
  assert.deepEqual(me.roles, ['projadmin']); assert.equal(me.isAdmin, false); assert.equal(me.isProjAdmin, true);
  assert.equal((await call('PATCH', '/api/admin/employees/TS1', { email: 'pa1@example.com', body: { roleOverride: 'admin' } })).status, 403, 'không đổi vai trò / tài khoản');
  assert.equal((await call('POST', '/api/admin/emails', { email: 'pa1@example.com', body: { items: [] } })).status, 403);
  assert.equal((await call('PUT', '/api/projects/WA-1/staff', { email: 'pa1@example.com', body: { sitesup: ['AP1'], pm: ['AP3'] } })).status, 200, 'phân công dự án');
  assert.equal((await call('GET', '/api/admin/ts/docs?period=2027-05', { email: 'pa1@example.com' })).status, 200);
  assert.equal((await call('GET', '/api/admin/ts/docs?period=2027-05', { email: 'ap1@example.com' })).status, 403, 'Site Sup không dùng');
  assert.equal((await call('GET', '/api/admin/ts/docs?period=2027-05', { email: 'ts1@example.com' })).status, 403);
});

test('Kiêm nhiệm nhiều vai trò: Quản lý dự án kiêm Admin + Admin dự án; chỉ admin chỉnh được, không tự chỉnh mình', async () => {
  await call('POST', '/api/admin/import', { email: 'boss@example.com', body: { employees: [{ empId: 'MR1', fullName: 'Quản Lý Kiêm Nhiệm', position: 'Project Manager' }] } });
  assert.equal((await call('POST', '/api/admin/emails', { email: 'boss@example.com', body: { items: [{ empId: 'MR1', email: 'mr1@example.com' }] } })).data.applied, 1);
  let me = (await call('GET', '/api/me', { email: 'mr1@example.com' })).data;
  assert.deepEqual(me.roles, ['pm']); assert.equal(me.isAdmin, false);
  const patch = (body, who = 'boss@example.com') => call('PATCH', '/api/admin/employees/MR1', { email: who, body });
  assert.equal((await patch({ extraRoles: ['admin', 'projadmin'] })).status, 200);
  me = (await call('GET', '/api/me', { email: 'mr1@example.com' })).data;
  assert.deepEqual(me.roles, ['admin', 'projadmin', 'pm'], 'vai trò chính theo chức danh + kiêm nhiệm');
  assert.equal(me.isAdmin, true); assert.equal(me.isProjAdmin, true);
  const out = (await call('GET', '/api/employees', { email: 'boss@example.com' })).data.employees.find(e => e.empId === 'MR1');
  assert.deepEqual(out.extraRoles, ['admin', 'projadmin']); assert.deepEqual(out.roles, ['admin', 'projadmin', 'pm']);
  assert.equal((await patch({ extraRoles: ['boss'] })).status, 400);
  assert.equal((await patch({ extraRoles: ['admin'] }, 'mr1@example.com')).status, 400, 'không tự đổi vai trò của mình');
  assert.equal((await call('GET', '/api/admin/ts/docs?period=2027-05', { email: 'mr1@example.com' })).status, 200, 'dùng được chức năng Admin dự án');
  assert.equal((await patch({ extraRoles: [] })).status, 200);
  assert.deepEqual((await call('GET', '/api/me', { email: 'mr1@example.com' })).data.roles, ['pm']);
});

test('Dự án / WBS fitter tự gõ chưa có trong danh sách → Admin / Admin dự án duyệt; dự án có trong danh sách vẫn qua Site Sup + QLDA', async () => {
  const dateOf = (n) => `2027-12-${16 + n}`;
  // 1) chỉ có WBS tự gõ: bỏ qua cấp Site Sup / QLDA, chờ Admin xử lý
  await putDoc('ts1@example.com', '2028-01', [okEntry(10101, dateOf(1), { workNumber: 'ZZ-TAYGO', projectName: 'Dự án tự gõ' })], 0);
  let r = await submit('ts1@example.com', '2028-01');
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.status, 'pm_ok');
  assert.equal((await call('POST', '/api/ts/review/TS1/2028-01/approve', { email: 'ap1@example.com', body: {} })).status, 403, 'Site Sup của dự án khác không duyệt được');
  const rv = (await call('GET', '/api/ts/review/TS1/2028-01', { email: 'pa1@example.com' })).data;
  assert.deepEqual(rv.unlisted, ['ZZ-TAYGO']); assert.equal(rv.canAct, true, 'Admin dự án xử lý được');
  // 2) lẫn dự án có trong danh sách: chỉ WBS có trong danh sách đi qua Site Sup
  await putDoc('ts2@example.com', '2028-01', [okEntry(10201, dateOf(1)), okEntry(10202, dateOf(2), { workNumber: 'zz-tay-go-2', projectName: 'Khác' })], 0);
  r = await submit('ts2@example.com', '2028-01');
  assert.equal(r.data.status, 'submitted');
  const wbs = (await env.DB.prepare("SELECT wbs FROM ts_doc_wbs WHERE emp_id = 'TS2' AND period = '2028-01'").all()).results.map(x => x.wbs);
  assert.deepEqual(wbs, ['WA-1'], 'WBS ngoài danh sách không bắt Site Sup / QLDA duyệt');
  assert.deepEqual((await call('GET', '/api/ts/review/TS2/2028-01', { email: 'pa1@example.com' })).data.unlisted, ['zz-tay-go-2']);
});

test('Xuất cho HR: chỉ Admin / Admin dự án lấy được bảng công ĐÃ DUYỆT XONG của kỳ, kèm dữ liệu', async () => {
  const get = (period, email) => call('GET', '/api/admin/ts/approved?period=' + period, { email });
  const r = await get('2027-07', 'pa1@example.com');
  assert.equal(r.status, 200); assert.equal(r.data.period, '2027-07');
  const ap1 = r.data.docs.find(d => d.empId === 'AP1');
  assert.ok(ap1 && Array.isArray(ap1.data.entries) && ap1.entries === ap1.data.entries.length, 'có dữ liệu bảng công');
  assert.ok((await get('2027-07', 'boss@example.com')).data.docs.length >= 1);
  assert.equal((await get('2027-07', 'ap1@example.com')).status, 403);
  assert.equal((await get('2027-13', 'pa1@example.com')).status, 400);
  await putDoc('ts1@example.com', '2027-09', [okEntry(9101, '2027-08-20')], 0);
  assert.equal((await get('2027-09', 'pa1@example.com')).data.docs.length, 0, 'bản nháp / chưa duyệt xong không có trong danh sách');
});

test('Admin sửa bảng công: bắt buộc ghi chú; đánh dấu dòng bị sửa; người chủ thấy ghi chú + nhận thư; người không có tài khoản vẫn tạo / sửa được', async () => {
  const get = (e, p) => call('GET', `/api/admin/ts/doc/${e}/${p}`, { email: 'pa1@example.com' });
  const put = (e, p, body, who = 'pa1@example.com') => call('PUT', `/api/admin/ts/doc/${e}/${p}`, { email: who, body });
  // Thợ Một (TS1) kỳ 2027-08: bản nháp
  await putDoc('ts1@example.com', '2027-08', [okEntry(8101, '2027-07-20'), okEntry(8102, '2027-07-21')], 0);
  let d = (await get('TS1', '2027-08')).data;
  assert.equal(d.version, 1); assert.equal(d.data.entries.length, 2); assert.equal(d.account, true);
  const e1 = d.data.entries.map(e => e.id === 8101 ? { ...e, endTime: '18:00', remarks: 'Admin sửa giờ ra' } : e);
  assert.equal((await put('TS1', '2027-08', { baseVersion: 1, data: { entries: e1 } })).status, 400, 'thiếu ghi chú');
  assert.equal((await put('TS1', '2027-08', { baseVersion: 1, note: 'x', data: { entries: e1 } })).status, 400, 'ghi chú quá ngắn');
  assert.equal((await put('TS1', '2027-08', { baseVersion: 1, note: 'Không đổi gì', data: { entries: d.data.entries } })).status, 400, 'chưa có thay đổi');
  assert.equal((await put('TS1', '2027-08', { baseVersion: 1, note: 'Sửa giờ ra', data: { entries: e1 } }, 'ts1@example.com')).status, 403);
  sentMail.length = 0;
  let r = await put('TS1', '2027-08', { baseVersion: 1, note: 'Giờ ra thực tế 18:00 theo nhật ký công trình', data: { entries: e1.filter(e => e.id !== 8102).concat([okEntry(8103, '2027-07-22')]) } });
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.version, 2); assert.equal(r.data.changed, 2); assert.equal(r.data.removed, 1);
  assert.equal((await put('TS1', '2027-08', { baseVersion: 1, note: 'Sửa tiếp', data: { entries: e1 } })).status, 409, 'phiên bản cũ');
  d = (await get('TS1', '2027-08')).data;
  assert.deepEqual(d.data.entries.map(e => [e.id, !!e.ae]).sort(), [[8101, true], [8103, true]]);
  assert.ok(d.data.deleted['8102'] > 0, 'dòng bị xoá được nhớ để máy người chủ gộp đúng');
  assert.equal(d.adminBy, 'Admin Dự Án'); assert.match(d.adminNote, /Giờ ra thực tế/);
  const mine = (await call('GET', '/api/ts/docs', { email: 'ts1@example.com' })).data.docs.find(x => x.period === '2027-08');
  assert.equal(mine.adminBy, 'Admin Dự Án'); assert.match(mine.adminNote, /nhật ký công trình/); assert.equal(mine.version, 2);
  assert.ok(mailsTo('ts1@example.com').some(m => /Quản trị viên đã sửa bảng công/.test(m.subject) && /nhật ký công trình/.test(m.htmlContent)), 'thư báo người chủ');
  const log = (await call('GET', '/api/admin/audit?limit=5', { email: 'boss@example.com' })).data.entries.find(x => x.action === 'ts_admin_edit');
  assert.equal(log.after.note.slice(0, 10), 'Giờ ra thự');
  // người không có tài khoản: tạo bảng công mới (version 0)
  sentMail.length = 0;
  r = await put('NA1', '2027-08', { baseVersion: 0, note: 'Nhập hộ từ bảng giấy', data: { entries: [okEntry(9001, '2027-07-20'), okEntry(9002, '2027-07-21')] } });
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.changed, 2);
  assert.equal((await get('NA1', '2027-08')).data.account, false); assert.equal(sentMail.length, 0, 'không có email → không gửi thư');
  const list = (await call('GET', '/api/admin/ts/docs?period=2027-08', { email: 'pa1@example.com' })).data;
  assert.ok(list.docs.some(x => x.empId === 'NA1' && !x.account && x.entries === 2) && list.docs.some(x => x.empId === 'TS1' && x.adminBy));
  assert.ok(list.others.some(x => x.empId === 'TS2'), 'danh sách người chưa có bảng công kỳ này');
  assert.equal((await get('KHONG-CO', '2027-08')).status, 404);
});

test('Admin sửa bảng công đã nộp / đã duyệt: phải có phân loại giờ hợp lệ; đã duyệt thì đẩy lại sang bảng Theo dõi giờ công', async () => {
  const put = (e, p, body) => call('PUT', `/api/admin/ts/doc/${e}/${p}`, { email: 'boss@example.com', body });
  await putDoc('ts2@example.com', '2027-08', [okEntry(8201, '2027-07-20'), okEntry(8202, '2027-07-21')], 0);
  assert.equal((await submit('ts2@example.com', '2027-08')).status, 200);
  const d = (await call('GET', '/api/admin/ts/doc/TS2/2027-08', { email: 'boss@example.com' })).data;
  assert.equal(d.status, 'submitted');
  const noBd = d.data.entries.map(e => e.id === 8201 ? { ...e, endTime: '18:00', bd: undefined } : e);
  let r = await put('TS2', '2027-08', { baseVersion: d.version, note: 'Sửa giờ ra', data: { entries: noBd } });
  assert.equal(r.status, 400); assert.match(r.data.error, /chưa có phân loại giờ/);
  const ok = d.data.entries.map(e => e.id === 8201 ? { ...e, endTime: '18:00', bd: { NORMAL: 8, OT1: 1 } } : e);
  r = await put('TS2', '2027-08', { baseVersion: d.version, note: 'Giờ ra 18:00, có 1 giờ OT', data: { entries: ok } });
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.status, 'submitted');
  assert.equal((await docOf('ts2@example.com', '2027-08')).status, 'submitted', 'trạng thái giữ nguyên, người nộp không tự sửa được');
  // duyệt xong rồi sửa lại → đẩy lại
  assert.equal((await call('POST', '/api/ts/review/TS2/2027-08/approve', { email: 'ap1@example.com', body: {} })).status, 200);
  assert.equal((await call('POST', '/api/ts/review/TS2/2027-08/approve', { email: 'ap3@example.com', body: {} })).data.status, 'pm_ok');
  assert.equal((await finalApprove('TS2', '2027-08')).data.pushed, 2);
  const d2 = (await call('GET', '/api/admin/ts/doc/TS2/2027-08', { email: 'boss@example.com' })).data;
  const fixed = d2.data.entries.map(e => e.id === 8202 ? { ...e, endTime: '19:00', bd: { NORMAL: 8, OT1: 2 } } : e);
  r = await put('TS2', '2027-08', { baseVersion: d2.version, note: 'Bổ sung OT ngày 21', data: { entries: fixed } });
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.status, 'approved'); assert.equal(r.data.pushed, 2);
  const row = (await tsRowsOf()).find(x => x.empId === 'TS2' && x.date === '2027-07-21');
  assert.equal(row.ot1, 2, 'bảng Theo dõi giờ công cập nhật theo bản đã sửa');
});

// ---------- quy trình duyệt 3 cấp: mọi dự án → Site Sup, mọi dự án → QLDA, rồi Admin ----------
test('duyệt 3 cấp: bảng công nhiều dự án cần Site Sup rồi QLDA của TỪNG dự án; duyệt một phần; thu hồi bị chặn; hoạt động ngoài dự án do Admin; Admin dự án xử lý cuối', async () => {
  await call('POST', '/api/admin/import', { email: 'boss@example.com', body: { employees: [{ empId: 'AP4', fullName: 'Quản Lý Hai', position: 'Project Manager' }], projects: [{ wbs: 'WB-2', projectName: 'Dự án hai' }] } });
  await call('POST', '/api/admin/emails', { email: 'boss@example.com', body: { items: [{ empId: 'AP4', email: 'ap4@example.com' }] } });
  assert.equal((await call('PUT', '/api/projects/WB-2/staff', { email: 'boss@example.com', body: { sitesup: ['AP2'], pm: ['AP4'] } })).status, 200);
  const e = (id, date, extra) => okEntry(id, date, extra);
  await putDoc('ts1@example.com', '2027-10', [e(1001, '2027-09-20'), e(1002, '2027-09-21', { workNumber: 'WB-2', projectName: 'Dự án hai' }),
    e(1003, '2027-09-22', { workNumber: 'MEETINGS', projectName: 'Họp', activityCode: '5010', cat: 'HR' })], 0);
  sentMail.length = 0;
  let r = await submit('ts1@example.com', '2027-10');
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.status, 'submitted');
  assert.deepEqual((await env.DB.prepare("SELECT wbs FROM ts_doc_wbs WHERE emp_id = 'TS1' AND period = '2027-10' ORDER BY wbs").all()).results.map(x => x.wbs), ['WA-1', 'WB-2'], 'hoạt động ngoài dự án (MEETINGS) không tính là dự án');
  assert.deepEqual([...new Set(sentMail.filter(m => /đã nộp/.test(m.subject)).flatMap(m => m.to.map(t => t.email)))].sort(), ['ap1@example.com', 'ap2@example.com'], 'thư tới Site Sup của từng dự án');
  const inbox = async (em) => (await call('GET', '/api/ts/inbox', { email: em })).data.items.filter(i => i.empId === 'TS1' && i.period === '2027-10');
  assert.equal((await inbox('ap1@example.com')).length, 1); assert.equal((await inbox('ap2@example.com')).length, 1);
  assert.equal((await inbox('ap3@example.com')).length, 0, 'QLDA chưa đến lượt');
  // Site Sup dự án WA-1 duyệt → còn WB-2
  r = await call('POST', '/api/ts/review/TS1/2027-10/approve', { email: 'ap1@example.com', body: {} });
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.status, 'submitted'); assert.deepEqual(r.data.approved, ['WA-1']); assert.deepEqual(r.data.remaining, ['WB-2']);
  assert.equal((await inbox('ap1@example.com')).length, 0, 'đã duyệt phần của mình thì hết trong hộp thư');
  assert.equal((await call('POST', '/api/ts/review/TS1/2027-10/approve', { email: 'ap1@example.com', body: {} })).status, 403, 'duyệt lại: không còn dự án nào của mình');
  const rv = (await call('GET', '/api/ts/review/TS1/2027-10', { email: 'ap2@example.com' })).data;
  assert.deepEqual(rv.remaining, ['WB-2']); assert.deepEqual(rv.approvals.map(a => [a.level, a.wbs, a.by_name]), [['sitesup', 'WA-1', 'Giám Sát Duyệt']]);
  assert.equal((await call('POST', '/api/ts/docs/2027-10/withdraw', { email: 'ts1@example.com', body: {} })).status, 409, 'đã có người duyệt một phần: không thu hồi');
  // Site Sup dự án WB-2 duyệt → đủ → chuyển QLDA, thư tới QLDA của cả hai dự án
  sentMail.length = 0;
  r = await call('POST', '/api/ts/review/TS1/2027-10/approve', { email: 'ap2@example.com', body: {} });
  assert.equal(r.data.status, 'sitesup_ok');
  assert.deepEqual([...new Set(sentMail.flatMap(m => m.to.map(t => t.email)))].sort(), ['ap3@example.com', 'ap4@example.com']);
  assert.equal((await inbox('ap1@example.com')).length, 0); assert.equal((await inbox('ap2@example.com')).length, 0);
  // QLDA: AP3 (WA-1) rồi AP4 (WB-2)
  r = await call('POST', '/api/ts/review/TS1/2027-10/approve', { email: 'ap3@example.com', body: {} });
  assert.equal(r.data.status, 'sitesup_ok'); assert.deepEqual(r.data.remaining, ['WB-2']);
  sentMail.length = 0;
  r = await call('POST', '/api/ts/review/TS1/2027-10/approve', { email: 'ap4@example.com', body: {} });
  assert.equal(r.data.status, 'pm_ok');
  assert.ok(sentMail.some(m => /chờ Admin xử lý cuối/.test(m.subject) && m.to.some(t => t.email === 'boss@example.com') && m.to.some(t => t.email === 'pa1@example.com')), 'thư tới Admin và Admin dự án');
  assert.equal((await docOf('ts1@example.com', '2027-10')).status, 'pm_ok');
  // Admin dự án xử lý cuối (QLDA không xử lý được)
  assert.equal((await call('POST', '/api/ts/review/TS1/2027-10/approve', { email: 'ap4@example.com', body: {} })).status, 403);
  const adm = (await call('GET', '/api/ts/inbox', { email: 'pa1@example.com' })).data.items.find(i => i.empId === 'TS1' && i.period === '2027-10');
  assert.equal(adm.level, 'admin');
  sentMail.length = 0;
  const zip = 'UEsDBBQAAAAIA' + 'A'.repeat(200);
  r = await call('POST', '/api/ts/review/TS1/2027-10/approve', { email: 'pa1@example.com', body: { files: [{ name: 'THO MOT.xlsx', content: zip }] } });
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.status, 'approved');
  const fin = sentMail.find(m => /đã được duyệt xong/.test(m.subject));
  assert.deepEqual(fin.to.map(t => t.email), ['ts1@example.com']);
  assert.deepEqual(fin.cc.map(t => t.email).sort(), ['ap1@example.com', 'ap2@example.com', 'ap3@example.com', 'ap4@example.com', 'pa1@example.com'], 'CC mọi Site Sup + QLDA của các dự án + Admin xử lý');
  assert.equal(fin.attachment[0].name, 'THO MOT.xlsx');
});

test('duyệt 3 cấp: trả lại xoá mọi lần duyệt một phần; nộp lại duyệt từ đầu; bảng công chỉ hoạt động ngoài dự án đi thẳng Admin', async () => {
  const e = (id, date, extra) => okEntry(id, date, extra);
  await putDoc('ts2@example.com', '2027-10', [e(2001, '2027-09-20'), e(2002, '2027-09-21', { workNumber: 'WB-2', projectName: 'Dự án hai' })], 0);
  assert.equal((await submit('ts2@example.com', '2027-10')).status, 200);
  assert.equal((await call('POST', '/api/ts/review/TS2/2027-10/approve', { email: 'ap1@example.com', body: {} })).data.remaining.length, 1);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) c FROM ts_approvals WHERE emp_id = 'TS2' AND period = '2027-10'").first()).c, 1);
  // Site Sup khác (dự án còn lại) trả lại → xoá lần duyệt của AP1
  assert.equal((await call('POST', '/api/ts/review/TS2/2027-10/reject', { email: 'ap2@example.com', body: { note: 'Sai dự án ngày 21' } })).data.status, 'rejected');
  assert.equal((await env.DB.prepare("SELECT COUNT(*) c FROM ts_approvals WHERE emp_id = 'TS2' AND period = '2027-10'").first()).c, 0);
  const d = await docOf('ts2@example.com', '2027-10');
  assert.equal((await putDoc('ts2@example.com', '2027-10', d.data.entries, d.version)).status, 200);
  assert.equal((await submit('ts2@example.com', '2027-10')).data.status, 'submitted');
  assert.equal((await call('GET', '/api/ts/inbox', { email: 'ap1@example.com' })).data.items.filter(i => i.empId === 'TS2' && i.period === '2027-10').length, 1, 'nộp lại: duyệt từ đầu');
  // chỉ hoạt động ngoài dự án → thẳng Admin
  const meet = (id, date) => e(id, date, { workNumber: 'TRAINING-NI', projectName: 'Huấn luyện', activityCode: '5021', cat: 'HR' });
  await putDoc('ts3@example.com', '2027-10', [meet(3001, '2027-09-20'), meet(3002, '2027-09-21')], 0);
  const r = await submit('ts3@example.com', '2027-10');
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.status, 'pm_ok');
  assert.equal((await call('GET', '/api/ts/inbox', { email: 'ap2@example.com' })).data.items.filter(i => i.empId === 'TS3' && i.period === '2027-10').length, 0, 'Site Sup không phải duyệt hoạt động ngoài dự án');
  assert.equal((await call('GET', '/api/ts/inbox', { email: 'boss@example.com' })).data.items.filter(i => i.empId === 'TS3' && i.level === 'admin').length, 1);
});

// ---------- nhập dữ liệu: lịch sử từ Theo dõi giờ công + nhập hộ từ Excel ----------
test('nhập lịch sử từ Theo dõi giờ công: dựng bảng công từng nhân viên theo kỳ (cả người không có tài khoản); không ghi đè; chỉ Admin / Admin dự án', async () => {
  await call('POST', '/api/admin/import', { email: 'boss@example.com', body: { employees: [{ empId: 'HX1', fullName: 'Hóa Xuân Một', position: 'Fitter' }, { empId: 'HX2', fullName: 'Hóa Xuân Hai', position: 'Fitter' }] } });
  const row = (emp, date, o = {}) => ({ empId: emp, empName: 'x', date, timeFrom: '08:00', timeTo: '17:00', normal: 8, ot1: 0, ot2: 0, total: 8, activities: '1110', projectNameFree: 'Dự án lịch sử', wbs: 'H-1', category: 'INS', ...o });
  const cur = (await call('GET', '/api/timesheets/meta', { email: 'boss@example.com' })).data;
  const rows = [row('HX1', '2026-07-20'), row('HX1', '2026-07-21', { timeTo: '19:00', normal: 8, ot1: 2, total: 10 }), row('HX1', '2026-08-10'), row('HX2', '2026-07-22', { timeFrom: '', timeTo: '', normal: 4, total: 4 }), row('NOREG', '2026-07-22')];
  const up = await uploadTs('boss@example.com', rows, { baseVersion: cur.version });
  assert.equal(up.commit.status, 200, JSON.stringify(up.commit.data));
  assert.equal((await call('GET', '/api/admin/ts/history?period=2026-08', { email: 'ts1@example.com' })).status, 403);
  assert.equal((await call('POST', '/api/admin/ts/history', { email: 'ap1@example.com', body: { period: '2026-08' } })).status, 403);
  const info = (await call('GET', '/api/admin/ts/history?period=2026-08', { email: 'pa1@example.com' })).data;
  assert.deepEqual([info.employees, info.done, info.rows], [3, 0, 5], 'kỳ 16/07–15/08 có 3 nhân viên (kể cả mã chưa đăng ký)');
  await env.DB.prepare("INSERT INTO ts_docs (emp_id, period, version, status, data, entry_count, saved_at, saved_by) VALUES ('HX2', '2026-08', 1, 'draft', '{\"entries\":[],\"deleted\":{}}', 0, '', '')").run();
  const r = await call('POST', '/api/admin/ts/history', { email: 'pa1@example.com', body: { period: '2026-08' } });
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.imported, 2, 'bỏ qua HX2 đã có bảng công'); assert.equal(r.data.remaining, 0);
  const doc = (await call('GET', '/api/admin/ts/doc/HX1/2026-08', { email: 'pa1@example.com' })).data;
  assert.equal(doc.status, 'approved'); assert.equal(doc.account, false, 'nhân viên không có tài khoản vẫn có bảng công');
  assert.equal(doc.data.entries.length, 3);
  const e2 = doc.data.entries.find(e => e.date === '2026-07-21');
  assert.deepEqual([e2.startTime, e2.endTime, e2.breakTime, e2.workNumber, e2.activityCode, e2.otMode], ['08:00', '19:00', '1', 'H-1', '1110', 'manual']);
  assert.deepEqual(e2.bd, { NORMAL: 8, OT1: 2 }); assert.equal(e2.otType, 'NORMAL'); assert.equal(e2.imp, 1);
  assert.deepEqual((await env.DB.prepare("SELECT wbs FROM ts_doc_wbs WHERE emp_id = 'HX1' AND period = '2026-08'").all()).results.map(x => x.wbs), ['H-1']);
  assert.equal((await call('POST', '/api/admin/ts/history', { email: 'boss@example.com', body: { period: '2026-08' } })).data.imported, 0, 'chạy lại không ghi đè');
  assert.equal((await call('GET', '/api/admin/ts/doc/HX2/2026-08', { email: 'pa1@example.com' })).data.data.entries.length, 0, 'bảng công đã có không bị đổi');
  // bảng công lịch sử xuất được Excel / sửa được (có bd khớp)
  const ed = await call('PUT', '/api/admin/ts/doc/HX1/2026-08', { email: 'pa1@example.com', body: { baseVersion: doc.version, note: 'Sửa thử', data: { entries: doc.data.entries.map(e => e.date === '2026-07-20' ? { ...e, remarks: 'đã kiểm tra' } : e) } } });
  assert.equal(ed.status, 200, JSON.stringify(ed.data));
});

test('nhập hộ từ Excel: giám sát / QLDA / Admin ghi bảng công cho nhân viên (kể cả không có tài khoản) rồi quy trình duyệt chạy từ đầu; kiểm tra hợp lệ', async () => {
  const mk = (id, date, extra) => okEntry(id, date, extra);
  const item = (empId, entries, period = '2027-11') => ({ empId, period, sch: 'mon-sat-am', entries });
  const post = (em, items) => call('POST', '/api/ts/import', { email: em, body: { items } });
  assert.equal((await post('ts1@example.com', [item('HX1', [mk(1, '2027-10-20')])])).status, 403, 'nhân viên thường không nhập hộ');
  assert.equal((await post('ap1@example.com', [])).status, 400);
  sentMail.length = 0;
  const r = await post('ap1@example.com', [item('HX1', [mk(5001, '2027-10-20'), mk(5002, '2027-10-21', { bd: { NORMAL: 8, OT1: 2 }, endTime: '19:00' })]),
    item('KHONG-CO', [mk(5101, '2027-10-20')]), item('HX2', [mk(5201, '2027-12-20')]), item('HX2', [{ id: 5301, date: '2027-10-20' }])]);
  assert.equal(r.status, 200); const [a, b, c, d] = r.data.results;
  assert.deepEqual([a.ok, a.status, a.entries], [true, 'submitted', 2], JSON.stringify(a));
  assert.equal(b.ok, false); assert.match(b.error, /chưa có trong EE Data/);
  assert.equal(c.ok, false); assert.match(c.error, /không thuộc kỳ lương/);
  assert.equal(d.ok, false);
  const doc = (await call('GET', '/api/admin/ts/doc/HX1/2027-11', { email: 'pa1@example.com' })).data;
  assert.equal(doc.status, 'submitted'); assert.equal(doc.account, false); assert.equal(doc.savedBy, 'Nhập hộ · Giám Sát Duyệt');
  assert.ok(sentMail.some(m => /Hóa Xuân Một đã nộp/.test(m.subject) && m.to.some(t => t.email === 'ap1@example.com')), 'quy trình duyệt bắt đầu: thư tới Site Sup của dự án');
  assert.equal((await call('GET', '/api/ts/inbox', { email: 'ap1@example.com' })).data.items.filter(i => i.empId === 'HX1' && i.period === '2027-11').length, 1);
  // đã nộp rồi → không ghi đè
  const again = await post('ap3@example.com', [item('HX1', [mk(5002, '2027-10-21')])]);
  assert.equal(again.data.results[0].ok, false); assert.match(again.data.results[0].error, /đã nộp/);
  // bản nháp / bị trả lại thì ghi đè được; QLDA và Admin dự án nhập được
  await call('POST', '/api/ts/review/HX1/2027-11/reject', { email: 'ap1@example.com', body: { note: 'Sai dự án' } });
  const fix = await post('pa1@example.com', [item('HX1', [mk(5003, '2027-10-22')])]);
  assert.equal(fix.data.results[0].ok, true, JSON.stringify(fix.data));
  assert.equal((await call('GET', '/api/admin/ts/doc/HX1/2027-11', { email: 'pa1@example.com' })).data.data.entries.length, 1, 'thay bằng bản mới');
  // phân loại giờ sai bị từ chối (checkSubmitEntries)
  const bad = await post('ap3@example.com', [item('HX2', [mk(5401, '2027-10-23', { bd: { NORMAL: 3 } })])]);
  assert.match(bad.data.results[0].error, /không khớp/);
});

test('đăng ký tài khoản: email lạ gửi họ tên + mã NV → admin nhận email; duyệt gắn email vào nhân viên; không duyệt có lý do; chống gửi dồn', async () => {
  const S = 'nguoila@example.com';
  await env.DB.prepare('INSERT INTO employees (emp_id, full_name, position, updated_at) VALUES (?, ?, ?, ?)').bind('R01', 'Phạm Văn Rèn', 'Fitter', new Date().toISOString()).run();
  // /api/me báo cần đăng ký
  const me = await call('GET', '/api/me', { email: S });
  assert.equal(me.status, 403);
  assert.equal(me.data.register, true);
  assert.equal(me.data.email, S);
  // chưa có yêu cầu
  assert.deepEqual((await call('GET', '/api/register', { email: S })).data, { email: S, request: null });
  // kiểm tra dữ liệu
  assert.equal((await call('POST', '/api/register', { email: S, body: { name: 'An', empId: 'R01' } })).status, 400);
  assert.equal((await call('POST', '/api/register', { email: S, body: { name: 'Phạm Văn Rèn', empId: 'R 01 !' } })).status, 400);
  // gửi yêu cầu → thư cho admin (ADMIN_EMAILS)
  const before = sentMail.length;
  const r = await call('POST', '/api/register', { email: S, body: { name: '  Phạm   Văn Rèn ', empId: 'r01', note: 'Fitter đội 2' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.mailed, true);
  assert.equal(r.data.request.status, 'pending');
  assert.equal(r.data.request.name, 'Phạm Văn Rèn');
  assert.equal(r.data.request.empId, 'R01');
  const m = sentMail.slice(before).find(x => x.to.some(t => t.email === 'boss@example.com'));
  assert.ok(m, 'admin nhận thư');
  assert.match(m.subject, /\[Đăng ký\] Phạm Văn Rèn \(R01\)/);
  assert.match(m.htmlContent, /tools\/accounts\/#dangky/);
  // gửi lại ngay (sửa ghi chú) → cập nhật, không gửi thư dồn
  const n2 = sentMail.length;
  const r2 = await call('POST', '/api/register', { email: S, body: { name: 'Phạm Văn Rèn', empId: 'R01', note: 'Fitter đội 2 - Sao Mai' } });
  assert.equal(r2.data.mailed, false);
  assert.equal(sentMail.length, n2);
  assert.equal((await call('GET', '/api/register', { email: S })).data.request.note, 'Fitter đội 2 - Sao Mai');
  // admin thấy số chờ trong /api/me và danh sách có đối chiếu nhân viên
  assert.ok((await call('GET', '/api/me', { email: 'boss@example.com' })).data.registrations >= 1);
  assert.equal((await call('GET', '/api/admin/registrations', { email: S })).status, 403);
  assert.equal((await call('GET', '/api/admin/registrations', { email: 'sup@example.com' })).status, 403);
  const list = await call('GET', '/api/admin/registrations', { email: 'boss@example.com' });
  const item = list.data.requests.find(x => x.email === S);
  assert.ok(item);
  assert.equal(item.employee.empId, 'R01');
  // không duyệt cần lý do; mã NV không có → báo rõ
  assert.equal((await call('POST', `/api/admin/registrations/${item.id}/reject`, { email: 'boss@example.com', body: {} })).status, 400);
  assert.equal((await call('POST', `/api/admin/registrations/${item.id}/approve`, { email: 'boss@example.com', body: { empId: 'KHONGCO' } })).status, 400);
  // duyệt → email gắn vào F02, người đăng ký nhận thư, vào được app
  const nb = sentMail.length;
  const ok = await call('POST', `/api/admin/registrations/${item.id}/approve`, { email: 'boss@example.com', body: {} });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal(ok.data.request.status, 'approved');
  assert.ok(sentMail.slice(nb).some(x => x.to.some(t => t.email === S) && /đã được cấp/.test(x.subject)));
  const me2 = await call('GET', '/api/me', { email: S });
  assert.equal(me2.status, 200);
  assert.equal(me2.data.empId, 'R01');
  assert.equal((await call('POST', `/api/admin/registrations/${item.id}/approve`, { email: 'boss@example.com', body: {} })).status, 409);
  // đã có tài khoản thì không đăng ký nữa
  assert.equal((await call('POST', '/api/register', { email: S, body: { name: 'Phạm Văn Rèn', empId: 'R01' } })).status, 409);
  // email lạ thứ hai xin mã NV đã có email → admin bị chặn khi duyệt; không duyệt có lý do → thư báo
  const S2 = 'mao@example.com';
  await call('POST', '/api/register', { email: S2, body: { name: 'Người Mạo Danh', empId: 'R01' } });
  const it2 = (await call('GET', '/api/admin/registrations', { email: 'boss@example.com' })).data.requests.find(x => x.email === S2);
  assert.equal(it2.employee.email, S);
  assert.equal((await call('POST', `/api/admin/registrations/${it2.id}/approve`, { email: 'boss@example.com', body: {} })).status, 409);
  const nr = sentMail.length;
  const rj = await call('POST', `/api/admin/registrations/${it2.id}/reject`, { email: 'boss@example.com', body: { note: 'Mã NV không khớp' } });
  assert.equal(rj.status, 200);
  assert.ok(sentMail.slice(nr).some(x => x.to.some(t => t.email === S2) && /Mã NV không khớp/.test(x.htmlContent)));
  assert.equal((await call('GET', '/api/register', { email: S2 })).data.request.status, 'rejected');
  // gửi lại sau khi bị từ chối → chờ duyệt lại
  const again = await call('POST', '/api/register', { email: S2, body: { name: 'Người Mạo Danh', empId: 'F01' } });
  assert.equal(again.data.request.status, 'pending');
});

test('demo: cookie còn sót nhưng trình duyệt không ở chế độ demo (không có header) → dữ liệu thật + xoá cookie', async () => {
  const DEMO = 'ts_demo=1';
  const real = await call('GET', '/api/me', { email: 'boss@example.com', cookie: DEMO, demoHeader: false });
  assert.equal(real.status, 200);
  assert.equal(real.data.demo, false);
  assert.ok(real.data.roles.includes('admin'), 'admin trong ADMIN_EMAILS vẫn là admin');
  assert.match(real.setCookie, /ts_demo=;.*Max-Age=0/);
  const st = await call('GET', '/api/demo/status', { email: 'boss@example.com', cookie: DEMO, demoHeader: false });
  assert.equal(st.data.active, false);
  // có header → vẫn vào demo như cũ, không xoá cookie
  const d = await call('GET', '/api/me', { email: 'boss@example.com', cookie: DEMO });
  assert.equal(d.data.demo, true);
  assert.equal(d.setCookie, '');
});

test('điều chỉnh bảng công: đã duyệt xong → điều chỉnh (có lý do) → duyệt lại đủ 3 cấp → Theo dõi giờ công cập nhật; huỷ điều chỉnh khôi phục', async () => {
  const P = '2028-05';          // kỳ 16/04 → 15/05/2028
  const amend = (reason, email = 'ts1@example.com') => call('POST', `/api/ts/docs/${P}/amend`, { email, body: { reason } });
  const cancel = (email = 'ts1@example.com') => call('POST', `/api/ts/docs/${P}/amend-cancel`, { email, body: {} });
  const approveAll = async () => {
    assert.equal((await call('POST', `/api/ts/review/TS1/${P}/approve`, { email: 'ap1@example.com', body: {} })).data.status, 'sitesup_ok');
    assert.equal((await call('POST', `/api/ts/review/TS1/${P}/approve`, { email: 'ap3@example.com', body: {} })).data.status, 'pm_ok');
    const f = await finalApprove('TS1', P);
    assert.equal(f.status, 200, JSON.stringify(f.data));
    return f.data;
  };
  const rowsOf = async () => (await tsRowsOf()).filter(x => x.empId === 'TS1' && x.date >= '2028-04-16' && x.date <= '2028-05-15').sort((a, b) => a.date.localeCompare(b.date));

  // chưa nộp: không cần điều chỉnh
  await putDoc('ts1@example.com', P, [okEntry(501, '2028-04-17'), okEntry(502, '2028-04-18')], 0);
  assert.equal((await amend('Đổi dự án')).status, 409, 'đang chấm thì sửa thẳng, không cần điều chỉnh');
  assert.equal((await submit('ts1@example.com', P)).status, 200);
  assert.equal((await approveAll()).pushed, 2);
  assert.deepEqual((await rowsOf()).map(r => r.wbs), ['WA-1', 'WA-1']);

  // điều chỉnh: cần lý do; chỉ chủ bảng công
  assert.equal((await amend('')).status, 400, 'thiếu lý do');
  let r = await amend('Ngày 18/04 thực tế làm dự án khác');
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual([r.data.status, r.data.amendRev, r.data.amendFrom], ['draft', 1, 'approved']);
  let mine = (await call('GET', '/api/ts/docs', { email: 'ts1@example.com' })).data.docs.find(d => d.period === P);
  assert.deepEqual([mine.status, mine.amendRev, mine.amendFrom, mine.amendNote], ['draft', 1, 'approved', 'Ngày 18/04 thực tế làm dự án khác']);
  assert.equal((await rowsOf()).length, 2, 'đang điều chỉnh: Theo dõi giờ công vẫn giữ bản đã duyệt');

  // sửa lại cho đúng thực tế rồi nộp lại
  let d = await docOf('ts1@example.com', P);
  const changed = [okEntry(501, '2028-04-17'), okEntry(502, '2028-04-18', { workNumber: 'WA-1', projectName: 'Dự án duyệt', startTime: '07:30', endTime: '12:30', breakTime: '0', bd: { NORMAL: 5 } }), okEntry(503, '2028-04-19')];
  assert.equal((await putDoc('ts1@example.com', P, changed, d.version)).status, 200, 'đang điều chỉnh thì sửa được');
  assert.equal((await submit('ts1@example.com', P)).status, 200);
  assert.equal((await putDoc('ts1@example.com', P, [], (await docOf('ts1@example.com', P)).version)).status, 423, 'nộp lại thì khoá');

  // người duyệt thấy đây là bản điều chỉnh + bản trước để so
  const inb = (await call('GET', '/api/ts/inbox', { email: 'ap1@example.com' })).data.items.find(i => i.empId === 'TS1' && i.period === P);
  assert.deepEqual(inb.amend, { rev: 1, from: 'approved', note: 'Ngày 18/04 thực tế làm dự án khác', since: '2028-04-16' }, 'nộp trước khi kỳ bắt đầu → sửa được cả kỳ');
  const rv = (await call('GET', `/api/ts/review/TS1/${P}`, { email: 'ap1@example.com' })).data;
  assert.equal(rv.amend.rev, 1); assert.equal(rv.base.entries.length, 2); assert.equal(rv.data.entries.length, 3);

  // điều chỉnh tiếp khi đang chờ duyệt (Site Sup đã duyệt một phần): vẫn giữ bản gốc đã duyệt, không tăng số lần
  assert.equal((await call('POST', `/api/ts/review/TS1/${P}/approve`, { email: 'ap1@example.com', body: {} })).data.status, 'sitesup_ok');
  r = await amend('Bổ sung thêm ngày 20/04');
  assert.deepEqual([r.status, r.data.amendRev, r.data.amendFrom], [200, 1, 'approved']);
  assert.equal((await call('GET', `/api/ts/inbox`, { email: 'ap3@example.com' })).data.items.filter(i => i.empId === 'TS1' && i.period === P).length, 0, 'rút khỏi hộp duyệt');
  assert.equal((await call('GET', `/api/ts/review/TS1/${P}`, { email: 'boss@example.com' })).data.base.entries.length, 2);

  // nộp lại → duyệt đủ 3 cấp → bảng Theo dõi giờ công thay bằng bản mới
  assert.equal((await submit('ts1@example.com', P)).status, 200);
  assert.equal((await approveAll()).pushed, 3);
  const rows = await rowsOf();
  assert.deepEqual(rows.map(x => [x.date, x.total]), [['2028-04-17', 8], ['2028-04-18', 5], ['2028-04-19', 8]], 'thay dòng cũ, không nhân đôi');
  mine = (await call('GET', '/api/ts/docs', { email: 'ts1@example.com' })).data.docs.find(d => d.period === P);
  assert.deepEqual([mine.status, mine.amendRev, mine.amendFrom], ['approved', 1, ''], 'duyệt xong: hết đang điều chỉnh, giữ số lần');
  assert.equal((await call('GET', `/api/ts/review/TS1/${P}`, { email: 'boss@example.com' })).data.base, null);

  // điều chỉnh lần 2 rồi huỷ: khôi phục đúng bản đã duyệt, trở lại "Đã duyệt xong"
  assert.equal((await cancel()).status, 409, 'không đang điều chỉnh');
  r = await amend('Thử điều chỉnh lần hai');
  assert.equal(r.data.amendRev, 2);
  d = await docOf('ts1@example.com', P);
  assert.equal((await putDoc('ts1@example.com', P, [okEntry(501, '2028-04-17')], d.version)).status, 200);
  assert.equal((await submit('ts1@example.com', P)).status, 200);
  assert.equal((await cancel()).status, 409, 'đang chờ duyệt thì không huỷ được');
  assert.equal((await call('POST', `/api/ts/review/TS1/${P}/reject`, { email: 'ap1@example.com', body: { note: 'Không đúng thực tế' } })).status, 200);
  r = await cancel();
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.status, 'approved');
  d = await docOf('ts1@example.com', P);
  assert.deepEqual([d.status, d.data.entries.length], ['approved', 3], 'khôi phục bản đã duyệt');
  mine = (await call('GET', '/api/ts/docs', { email: 'ts1@example.com' })).data.docs.find(x => x.period === P);
  assert.deepEqual([mine.amendRev, mine.amendFrom], [1, '']);
  assert.equal((await rowsOf()).length, 3, 'Theo dõi giờ công không đổi');
  const log = (await call('GET', '/api/admin/audit?limit=60', { email: 'boss@example.com' })).data.entries.map(e => e.action);
  assert.ok(log.includes('ts_amend') && log.includes('ts_amend_cancel'));
});

test('bảng công chờ Admin xử lý (pm_ok) cũng bị khoá, không ghi đè được', async () => {
  const P = '2028-07';
  await putDoc('ts1@example.com', P, [okEntry(601, '2028-06-17')], 0);
  assert.equal((await submit('ts1@example.com', P)).status, 200);
  await call('POST', `/api/ts/review/TS1/${P}/approve`, { email: 'ap1@example.com', body: {} });
  assert.equal((await call('POST', `/api/ts/review/TS1/${P}/approve`, { email: 'ap3@example.com', body: {} })).data.status, 'pm_ok');
  const d = await docOf('ts1@example.com', P);
  assert.equal((await putDoc('ts1@example.com', P, [], d.version)).status, 423);
});

test('điều chỉnh bảng công: chỉ sửa được các ngày từ ngày nộp đến hết kỳ (ngày 15)', async () => {
  const P = '2028-09';          // kỳ 16/08 → 15/09/2028
  const amend = (reason) => call('POST', `/api/ts/docs/${P}/amend`, { email: 'ts1@example.com', body: { reason } });
  await putDoc('ts1@example.com', P, [okEntry(701, '2028-09-08'), okEntry(702, '2028-09-12'), okEntry(703, '2028-09-14')], 0);
  assert.equal((await submit('ts1@example.com', P)).status, 200);
  // nộp ngày 10/09 (giờ VN) → 12/09 và 14/09 là ngày chấm trước
  await env.DB.prepare("UPDATE ts_docs SET submitted_at = '2028-09-09T18:30:00Z' WHERE emp_id = 'TS1' AND period = ?").bind(P).run();
  let r = await amend('Ngày 12 và 14 thực tế khác');
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.amendSince, '2028-09-10', 'ngày nộp theo giờ Việt Nam');
  const mine = (await call('GET', '/api/ts/docs', { email: 'ts1@example.com' })).data.docs.find(d => d.period === P);
  assert.equal(mine.amendSince, '2028-09-10');
  let d = await docOf('ts1@example.com', P);
  // sửa ngày 08/09 (trước ngày nộp) → bị chặn
  r = await putDoc('ts1@example.com', P, [okEntry(701, '2028-09-08', { endTime: '19:00', bd: { NORMAL: 8, OT1: 2 } }), okEntry(702, '2028-09-12'), okEntry(703, '2028-09-14')], d.version);
  assert.equal(r.status, 400); assert.match(r.data.error, /từ 10\/09.*08\/09/);
  r = await putDoc('ts1@example.com', P, [okEntry(702, '2028-09-12'), okEntry(703, '2028-09-14')], d.version);
  assert.equal(r.status, 400, 'xoá ngày trước ngày nộp cũng bị chặn');
  r = await putDoc('ts1@example.com', P, [okEntry(709, '2028-09-05'), okEntry(701, '2028-09-08'), okEntry(702, '2028-09-12'), okEntry(703, '2028-09-14')], d.version);
  assert.equal(r.status, 400, 'thêm ngày trước ngày nộp cũng bị chặn');
  // sửa 12/09, bỏ 14/09, thêm 15/09 → được
  r = await putDoc('ts1@example.com', P, [okEntry(701, '2028-09-08'), okEntry(702, '2028-09-12', { workNumber: 'WA-1', projectName: 'Dự án khác' }), okEntry(704, '2028-09-15')], d.version);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal((await submit('ts1@example.com', P)).status, 200);
  const rv = (await call('GET', `/api/ts/review/TS1/${P}`, { email: 'ap1@example.com' })).data;
  assert.equal(rv.amend.since, '2028-09-10');
  // điều chỉnh lần nữa: mốc vẫn là ngày nộp lần đầu (không lùi theo lần nộp lại)
  r = await amend('Sửa tiếp ngày 15');
  assert.equal(r.data.amendSince, '2028-09-10');

  // nộp sau khi hết kỳ → không có ngày chấm trước để điều chỉnh
  const Q = '2028-11';
  await putDoc('ts1@example.com', Q, [okEntry(801, '2028-10-20')], 0);
  assert.equal((await submit('ts1@example.com', Q)).status, 200);
  await env.DB.prepare("UPDATE ts_docs SET submitted_at = '2028-11-16T02:00:00Z' WHERE emp_id = 'TS1' AND period = ?").bind(Q).run();
  r = await call('POST', `/api/ts/docs/${Q}/amend`, { email: 'ts1@example.com', body: { reason: 'Muốn sửa' } });
  assert.equal(r.status, 409); assert.match(r.data.error, /nộp sau khi hết kỳ/);
});

test('Incentive SWAT: chỉ Admin; tạo đợt, lưu, chốt → lịch sử; giờ công theo dự án; nhập Excel ghi đè', async () => {
  const A = 'boss@example.com';
  assert.equal((await call('GET', '/api/incentive/batches?scheme=swat', { email: 'ap1@example.com' })).status, 403, 'Site Sup không vào được');
  assert.equal((await call('GET', '/api/incentive/batches?scheme=swat', { email: 'ts1@example.com' })).status, 403);
  let r = await call('POST', '/api/incentive/batches', { email: A, body: { scheme: 'swat', month: '2026-11', title: 'Đợt tháng 11' } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const id = r.data.id;
  assert.equal((await call('POST', '/api/incentive/batches', { email: A, body: { scheme: 'swat', month: '2026-11' } })).status, 409, 'mỗi tháng một đợt');
  assert.equal((await call('POST', '/api/incentive/batches', { email: A, body: { scheme: 'swat', month: '2026-13' } })).status, 400);
  const data = { projects: [{ wbs: 'WA-1', name: 'Dự án duyệt', kind: 'first70', fundF: 1000, fundS: 100, lines: [
    { role: 'sup', empId: 'AP1', name: 'Giám Sát Duyệt', amount: 70 }, { role: 'fitter', empId: 'TS1', name: 'Thợ Một', hours: 30, pct: 0.75, amount: 525 },
    { role: 'fitter', empId: 'TS2', name: 'Thợ Hai', hours: 10, pct: 0.25, amount: 175 }] }] };
  r = await call('PUT', `/api/incentive/batches/${id}`, { email: A, body: { version: 1, data } });
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.total, 770);
  assert.equal((await call('PUT', `/api/incentive/batches/${id}`, { email: A, body: { version: 1, data } })).status, 409, 'chống ghi đè');
  assert.equal((await call('PUT', `/api/incentive/batches/${id}`, { email: A, body: { version: 2, data: { projects: [{ ...data.projects[0], kind: 'x' }] } } })).status, 400);
  // đang làm (draft) thì chưa tính vào lịch sử
  assert.deepEqual((await call('GET', '/api/incentive/history?scheme=swat', { email: A })).data.items, []);
  r = await call('PUT', `/api/incentive/batches/${id}`, { email: A, body: { version: 2, data, status: 'done' } });
  assert.equal(r.data.status, 'done');
  let h = (await call('GET', '/api/incentive/history?scheme=swat', { email: A })).data.items;
  assert.deepEqual(h.map(x => [x.month, x.wbs, x.kind, x.lines.length]), [['2026-11', 'WA-1', 'first70', 3]]);
  const list = (await call('GET', '/api/incentive/batches?scheme=swat', { email: A })).data.batches;
  assert.deepEqual(list.map(b => [b.month, b.status, b.projects, b.total]), [['2026-11', 'done', 1, 770]]);
  // giờ công theo người từ bảng Theo dõi giờ công (dòng đã duyệt của các test trước)
  r = await call('GET', '/api/incentive/hours?wbs=WA-1,KHONG-CO', { email: A });
  assert.equal(r.status, 200);
  const wa = r.data.projects.find(p => p.wbs === 'WA-1');
  assert.ok(wa.total > 0 && wa.people.some(p => p.empId === 'TS1' && p.role === 'fitter'), JSON.stringify(wa));
  assert.deepEqual(r.data.projects.find(p => p.wbs === 'KHONG-CO').people, []);
  // nhập file Excel: tháng 11 đã có → thay phần chia tiền (giữ trường khác của dự án), tháng 09 chưa có → tạo mới, đã chốt
  r = await call('POST', '/api/incentive/import', { email: A, body: { scheme: 'swat', sheets: [
    { sheet: '11 2026', month: '2026-11', title: 'HN Nov 2026', projects: [{ wbs: 'WA-1', name: 'Dự án duyệt', kind: 'first70', rate: 0.7, lines: [{ role: 'fitter', empId: 'TS1', name: 'Thợ Một', amount: 600 }] }] },
    { sheet: '09 2026', month: '2026-09', projects: [{ wbs: 'WB-2', name: 'Dự án B', kind: 'first100', lines: [{ role: 'sup', name: 'GS', amount: 50 }] }] }] } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual(r.data.batches.map(b => [b.month, b.replaced, b.total, b.before]), [['2026-11', true, 600, 770], ['2026-09', false, 50, null]]);
  const b11 = (await call('GET', `/api/incentive/batches/${id}`, { email: A })).data;
  assert.deepEqual([b11.status, b11.source, b11.data.projects[0].fundF, b11.data.projects[0].lines.length], ['done', 'import', 1000, 1]);
  h = (await call('GET', '/api/incentive/history?scheme=swat', { email: A })).data.items;
  assert.deepEqual(h.map(x => [x.month, x.wbs, x.kind]), [['2026-09', 'WB-2', 'first100'], ['2026-11', 'WA-1', 'first70']]);
  assert.equal((await call('POST', '/api/incentive/import', { email: A, body: { scheme: 'swat', sheets: [{ month: '2026-11', projects: [] }, { month: '2026-11', projects: [] }] } })).status, 400);
  // xoá đợt
  assert.equal((await call('DELETE', `/api/incentive/batches/${id}`, { email: A, body: {} })).status, 200);
  assert.deepEqual((await call('GET', '/api/incentive/history?scheme=swat', { email: A })).data.items.map(x => x.month), ['2026-09']);
});

test('Incentive: phát hành → email chi tiết cho từng người; "Thưởng của tôi" chỉ thấy tiền của mình, chỉ đợt đã phát hành', async () => {
  const A = 'boss@example.com';
  const id = (await call('POST', '/api/incentive/batches', { email: A, body: { scheme: 'swat', month: '2027-01' } })).data.id;
  const proj = (wbs, lines) => ({ wbs, name: 'Dự án ' + wbs, kind: 'first70', fundF: 1000, fundS: 100, units: 1, swat: { state: { v: { stops: '7' } }, std: { perUnit: 200 }, sc: { pf: 1000, ps: 100, fs: 3, ss: 6 } }, lines });
  const data = { projects: [
    proj('WA-1', [{ role: 'sup', empId: 'AP1', name: 'Giám Sát Duyệt', amount: 70 }, { role: 'fitter', empId: 'TS1', name: 'Thợ Một', hours: 30, pct: 0.75, amount: 525 }, { role: 'fitter', empId: 'TS2', name: 'Thợ Hai', hours: 10, pct: 0.25, amount: 175 }]),
    proj('WA-2', [{ role: 'fitter', empId: 'TS1', name: 'Thợ Một', hours: 5, pct: 1, amount: 300 }, { role: 'fitter', empId: '', name: 'Không Mã', hours: 1, pct: 0, amount: 10 }]) ] };
  assert.equal((await call('PUT', `/api/incentive/batches/${id}`, { email: A, body: { version: 1, data } })).status, 200);
  assert.equal((await call('POST', `/api/incentive/batches/${id}/publish`, { email: A, body: { sendMail: true } })).status, 409, 'chưa chốt thì chưa phát hành');
  assert.equal((await call('PUT', `/api/incentive/batches/${id}`, { email: A, body: { version: 2, data, status: 'done' } })).status, 200);
  // chốt rồi nhưng chưa phát hành: người dùng chưa thấy
  assert.deepEqual((await call('GET', '/api/incentive/mine', { email: 'ts1@example.com' })).data.batches, []);
  assert.equal((await call('POST', `/api/incentive/batches/${id}/publish`, { email: 'ts1@example.com', body: {} })).status, 403);
  const before = sentMail.length;
  const r = await call('POST', `/api/incentive/batches/${id}/publish`, { email: A, body: { sendMail: true } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual([r.data.people, r.data.sent, r.data.noId], [3, 3, ['Không Mã']]);
  const m1 = sentMail.slice(before).find(m => m.to.some(t => t.email === 'ts1@example.com'));
  assert.match(m1.subject, /01\/2027.*825/);
  assert.match(m1.htmlContent, /WA-1/); assert.match(m1.htmlContent, /WA-2/);
  assert.doesNotMatch(m1.htmlContent, /Thợ Hai|175|Giám Sát Duyệt/, 'thư của Thợ Một không có tiền của người khác');
  assert.match(m1.htmlContent, /tools\/mybonus\/#dot=/);
  // Thưởng của tôi
  const mine = (await call('GET', '/api/incentive/mine', { email: 'ts1@example.com' })).data;
  assert.equal(mine.batches.length, 1);
  assert.deepEqual([mine.batches[0].month, mine.batches[0].total, mine.batches[0].projects.map(p => [p.wbs, p.amount])], ['2027-01', 825, [['WA-1', 525], ['WA-2', 300]]]);
  assert.equal(JSON.stringify(mine).includes('Thợ Hai'), false, 'không lộ dòng của người khác');
  assert.equal(mine.batches[0].projects[0].fundF, 1000); assert.equal(mine.batches[0].projects[0].sc.fs, 3);
  const sup = (await call('GET', '/api/incentive/mine', { email: 'ap1@example.com' })).data.batches[0];
  assert.deepEqual(sup.projects.map(p => [p.wbs, p.lines[0].role, p.amount]), [['WA-1', 'sup', 70]]);
  const d = await call('GET', `/api/incentive/mine/${id}/WA-1`, { email: 'ts2@example.com' });
  assert.equal(d.status, 200); assert.deepEqual(d.data.project.lines.map(l => l.amount), [175]); assert.equal(d.data.swatState.v.stops, '7');
  assert.equal((await call('GET', `/api/incentive/mine/${id}/WA-2`, { email: 'ts2@example.com' })).status, 404, 'không có thưởng ở dự án này');
  assert.equal((await call('GET', `/api/incentive/mine/${id}/WA-1`, { email: 'ts3@example.com' })).status, 404);
  // mở lại đợt (đang sửa) → người dùng tạm không thấy
  const cur = (await call('GET', `/api/incentive/batches/${id}`, { email: A })).data;
  assert.ok(cur.publishedAt);
  await call('PUT', `/api/incentive/batches/${id}`, { email: A, body: { version: cur.version, data, status: 'draft' } });
  assert.deepEqual((await call('GET', '/api/incentive/mine', { email: 'ts1@example.com' })).data.batches, []);
});

test('Timesheet cá nhân: tự dựng bảng công các kỳ đã qua từ Theo dõi giờ công (chỉ của mình, không đụng kỳ hiện tại / kỳ đã có)', async () => {
  await call('POST', '/api/admin/import', { email: 'boss@example.com', body: { employees: [{ empId: 'BF1', fullName: 'Bù Lịch Sử', position: 'Fitter' }, { empId: 'BF2', fullName: 'Người Khác', position: 'Fitter' }] } });
  await call('POST', '/api/admin/emails', { email: 'boss@example.com', body: { items: [{ empId: 'BF1', email: 'bf1@example.com' }, { empId: 'BF2', email: 'bf2@example.com' }] } });
  const vn = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const shift = (iso, days) => new Date(Date.parse(iso + 'T00:00:00Z') + days * 864e5).toISOString().slice(0, 10);
  const old1 = shift(vn, -70), old2 = shift(vn, -40), curDay = vn;   // hai kỳ đã qua + hôm nay (kỳ hiện tại)
  const row = (emp, date, o = {}) => ({ empId: emp, empName: 'x', date, timeFrom: '08:00', timeTo: '17:00', normal: 8, ot1: 0, total: 8, activities: '1110', projectNameFree: 'DA cũ', wbs: '812441010', ...o });
  const meta = (await call('GET', '/api/timesheets/meta', { email: 'boss@example.com' })).data;
  const keep = [];
  for (let after = 0; ;) { const p = (await call('GET', '/api/timesheets?after=' + after, { email: 'boss@example.com' })).data; keep.push(...p.rows); if (p.next == null) break; after = p.next; }
  const up = await uploadTs('boss@example.com', [...keep, row('BF1', old1), row('BF1', shift(old1, 1)), row('BF1', old2, { normal: 8, ot1: 2, total: 10, timeTo: '19:00' }), row('BF1', curDay), row('BF2', old1)], { baseVersion: meta.version });
  assert.equal(up.commit.status, 200, JSON.stringify(up.commit.data));
  const P = (iso) => { let y = +iso.slice(0, 4), m = +iso.slice(5, 7); if (+iso.slice(8) >= 16) { m++; if (m > 12) { m = 1; y++; } } return `${y}-${String(m).padStart(2, '0')}`; };
  assert.deepEqual((await call('GET', '/api/ts/docs', { email: 'bf1@example.com' })).data.docs, [], 'không xin history=1 thì không dựng (đồng bộ 90 giây không tốn đọc)');
  const docs = (await call('GET', '/api/ts/docs?history=1', { email: 'bf1@example.com' })).data.docs;
  const want = [...new Set([P(old1), P(old2)])].sort().reverse();
  assert.deepEqual(docs.map(d => d.period), want, 'chỉ các kỳ đã qua, không có kỳ hiện tại');
  assert.ok(docs.every(d => d.status === 'approved'));
  const d1 = (await call('GET', '/api/ts/docs/' + P(old2), { email: 'bf1@example.com' })).data;
  const e = d1.data.entries.find(x => x.date === old2);
  assert.deepEqual([e.workNumber, e.bd.NORMAL, e.bd.OT1], ['812441010', 8, 2]);
  // kỳ hiện tại vẫn trống → người dùng chấm công bình thường
  assert.equal((await call('GET', '/api/ts/docs/' + P(curDay), { email: 'bf1@example.com' })).data.status, 'draft');
  // gọi lại không tạo trùng; người khác chỉ thấy của mình
  assert.equal((await call('GET', '/api/ts/docs?history=1', { email: 'bf1@example.com' })).data.docs.length, want.length);
  assert.deepEqual((await call('GET', '/api/ts/docs?history=1', { email: 'bf2@example.com' })).data.docs.map(d => d.period), [P(old1)]);
});

test('Incentive: đổi mã WBS nhầm ở mọi đợt (xem trước, bỏ qua đợt đã có mã mới, giữ phát hành, cập nhật lịch sử / Thưởng của tôi)', async () => {
  const A = 'boss@example.com';
  const mk = async (month, projects, status = 'done') => {
    const r = await call('POST', '/api/incentive/batches', { email: A, body: { scheme: 'swat', month } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const p = await call('PUT', `/api/incentive/batches/${r.data.id}`, { email: A, body: { version: 1, status, data: { projects } } });
    assert.equal(p.status, 200, JSON.stringify(p.data));
    return r.data.id;
  };
  const prj = (wbs, name, kind, amount) => ({ wbs, name, kind, fundF: 100, fundS: 0, lines: [{ role: 'fitter', empId: 'TS1', name: 'Thợ Một', hours: 10, pct: 1, amount }] });
  const b1 = await mk('2031-01', [prj('SAI-1', 'Tên cũ', 'first70', 70)]);
  await mk('2031-03', [prj('SAI-1', 'Tên cũ', 'final30', 30), prj('OTHER', 'Khác', 'first100', 5)]);
  await mk('2031-05', [prj('SAI-1', 'Tên cũ', 'final30', 1), prj('DUNG-1', 'Đã có', 'final30', 2)]);
  assert.equal((await call('POST', `/api/incentive/batches/${b1}/publish`, { email: A, body: { sendMail: false } })).status, 200);
  assert.equal((await call('POST', '/api/incentive/rename-wbs', { email: 'ap1@example.com', body: { scheme: 'swat', from: 'SAI-1', to: 'DUNG-1' } })).status, 403);
  const pre = (await call('POST', '/api/incentive/rename-wbs', { email: A, body: { scheme: 'swat', from: 'SAI-1', to: 'DUNG-1', name: 'Tên đúng', dryRun: true } })).data;
  assert.deepEqual(pre.batches.map(b => b.month), ['2031-01', '2031-03']); assert.deepEqual(pre.conflicts.map(c => c.month), ['2031-05']);
  assert.ok((await call('GET', '/api/incentive/history?scheme=swat', { email: A })).data.items.some(x => x.wbs === 'SAI-1' && x.month === '2031-01'), 'xem trước không đổi gì');
  const r = await call('POST', '/api/incentive/rename-wbs', { email: A, body: { scheme: 'swat', from: 'SAI-1', to: 'DUNG-1', name: 'Tên đúng' } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const h = (await call('GET', '/api/incentive/history?scheme=swat', { email: A })).data.items.filter(x => x.month.startsWith('2031'));
  assert.deepEqual(h.map(x => [x.month, x.wbs, x.name]).sort(), [['2031-01', 'DUNG-1', 'Tên đúng'], ['2031-03', 'DUNG-1', 'Tên đúng'], ['2031-03', 'OTHER', 'Khác'], ['2031-05', 'DUNG-1', 'Đã có'], ['2031-05', 'SAI-1', 'Tên cũ']]);
  const b = (await call('GET', `/api/incentive/batches/${b1}`, { email: A })).data;
  assert.deepEqual([b.status, !!b.publishedAt, b.data.projects[0].wbs, b.data.projects[0].name], ['done', true, 'DUNG-1', 'Tên đúng']);
  const mine = (await call('GET', '/api/incentive/mine', { email: 'ts1@example.com' })).data;
  const it = (mine.batches || mine.items || []).find(x => x.month === '2031-01');
  assert.ok(it && it.projects.some(p => p.wbs === 'DUNG-1'), JSON.stringify(mine).slice(0, 300));
});

test('Incentive: giờ công tính thưởng SWAT không gồm mã 1194 (NI Quality Hour)', async () => {
  const A = 'boss@example.com';
  const meta = (await call('GET', '/api/timesheets/meta', { email: A })).data;
  const keep = [];
  for (let after = 0; ;) { const p = (await call('GET', '/api/timesheets?after=' + after, { email: A })).data; keep.push(...p.rows); if (p.next == null) break; after = p.next; }
  const row = (emp, date, act, total) => ({ empId: emp, empName: 'x', date, timeFrom: '08:00', timeTo: '17:00', normal: total, total, activities: act, wbs: 'Q-1194' });
  const up = await uploadTs(A, [...keep, row('TS1', '2032-01-05', '1110', 8), row('TS1', '2032-01-06', '1194', 8), row('TS2', '2032-01-05', '1110', 8), row('TS2', '2032-01-07', '1194 ', 4)], { baseVersion: meta.version });
  assert.equal(up.commit.status, 200, JSON.stringify(up.commit.data));
  const p = (await call('GET', '/api/incentive/hours?wbs=Q-1194', { email: A })).data.projects[0];
  assert.deepEqual([p.total, p.excluded1194], [16, 12]);
  assert.deepEqual(p.people.map(x => [x.empId, x.hours]).sort(), [['TS1', 8], ['TS2', 8]]);
});

test('Incentive: gộp tên không dấu / đảo thứ tự ("SUU TRI NGO") vào nhân viên có Mã NV — tự gắn khi lưu + nút gộp các đợt cũ', async () => {
  const A = 'boss@example.com';
  await call('POST', '/api/admin/import', { email: A, body: { employees: [{ empId: 'NS1', fullName: 'Ngô Trí Sửu', position: 'Site Supervisor' }, { empId: 'NT1', fullName: 'Lê Văn Trùng', position: 'Fitter' }, { empId: 'NT2', fullName: 'Lê Văn Trùng', position: 'Fitter' }] } });
  const r = await call('POST', '/api/incentive/batches', { email: A, body: { scheme: 'swat', month: '2033-02' } });
  const id = r.data.id;
  // dữ liệu cũ (nhập Excel trước đây) nằm thẳng trong DB, chưa có Mã NV
  const data = { projects: [{ wbs: 'NM-1', name: 'Dự án', kind: 'first70', lines: [
    { role: 'sup', empId: '', name: 'SUU TRI NGO', amount: 100 }, { role: 'fitter', empId: '', name: 'LE VAN TRUNG', amount: 50 }, { role: 'fitter', empId: '', name: 'Ai Đó Lạ', amount: 10 }] }] };
  await env.DB.prepare("UPDATE inc_batches SET data = ?, status = 'done' WHERE id = ?").bind(JSON.stringify(data), id).run();
  assert.equal((await call('POST', '/api/incentive/fix-names', { email: 'ap1@example.com', body: { scheme: 'swat' } })).status, 403);
  const pre = (await call('POST', '/api/incentive/fix-names', { email: A, body: { scheme: 'swat', dryRun: true } })).data;
  assert.deepEqual(pre.pairs.filter(p => p.months.includes('2033-02')).map(p => [p.from, p.empId, p.name]), [['SUU TRI NGO', 'NS1', 'Ngô Trí Sửu']]);
  assert.ok(pre.unmatched.includes('LE VAN TRUNG') && pre.unmatched.includes('Ai Đó Lạ'), 'trùng tên / không có → không tự gắn');
  const done = await call('POST', '/api/incentive/fix-names', { email: A, body: { scheme: 'swat' } });
  assert.equal(done.status, 200, JSON.stringify(done.data));
  const b = (await call('GET', `/api/incentive/batches/${id}`, { email: A })).data;
  assert.deepEqual(b.data.projects[0].lines.map(l => [l.empId, l.name]), [['NS1', 'Ngô Trí Sửu'], ['', 'LE VAN TRUNG'], ['', 'Ai Đó Lạ']]);
  const h = (await call('GET', '/api/incentive/history?scheme=swat', { email: A })).data.items.find(x => x.month === '2033-02');
  assert.ok(h.lines.some(l => l.empId === 'NS1' && l.name === 'Ngô Trí Sửu'));
  // lưu đợt (bước 4) với tên không dấu → máy chủ tự gắn Mã NV
  const put = await call('PUT', `/api/incentive/batches/${id}`, { email: A, body: { version: b.version, data: { projects: [{ wbs: 'NM-1', name: 'Dự án', kind: 'first70', sup: { empId: '', name: 'ngo tri suu' },
    lines: [{ role: 'sup', empId: '', name: 'ngo tri suu', amount: 100 }] }] } } });
  assert.equal(put.status, 200, JSON.stringify(put.data));
  const p2 = (await call('GET', `/api/incentive/batches/${id}`, { email: A })).data.data.projects[0];
  assert.deepEqual([p2.lines[0].empId, p2.lines[0].name, p2.sup.empId, p2.sup.name], ['NS1', 'Ngô Trí Sửu', 'NS1', 'Ngô Trí Sửu']);
});

test('Incentive: tự lưu đợt chỉ ghi lại dòng chia thưởng của dự án có thay đổi (giảm lượt ghi D1)', async () => {
  const A = 'boss@example.com';
  const b = (await call('POST', '/api/incentive/batches', { email: A, body: { scheme: 'swat', month: '2034-01' } })).data;
  const prj = (wbs, amount) => ({ wbs, name: 'DA ' + wbs, kind: 'first70', lines: [{ role: 'fitter', empId: 'TS1', name: 'Thợ Một', amount }, { role: 'sup', empId: 'TS2', name: 'Thợ Hai', amount: 5 }] });
  const put = async (version, projects) => { const r = await call('PUT', `/api/incentive/batches/${b.id}`, { email: A, body: { version, data: { projects } } }); assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data.version; };
  const ids = async () => (await env.DB.prepare('SELECT rowid AS id, wbs FROM inc_lines WHERE batch_id = ? ORDER BY rowid').bind(b.id).all()).results;
  let v = await put(1, [prj('W1', 10), prj('W2', 20), prj('W3', 30)]);
  const first = await ids();
  // dòng mốc (rowid lớn) — dòng nào được ghi lại sau đó sẽ có rowid lớn hơn mốc
  await env.DB.prepare("INSERT INTO inc_lines (batch_id, wbs) VALUES (-1, 'MOC')").run();
  const moc = (await env.DB.prepare("SELECT rowid r FROM inc_lines WHERE batch_id = -1").first()).r;
  v = await put(v, [prj('W1', 10), prj('W2', 20), prj('W3', 30)]);
  assert.deepEqual(await ids(), first, 'không đổi gì → không xoá / ghi lại dòng nào');
  v = await put(v, [prj('W1', 10), prj('W2', 25), prj('W4', 1)]);
  const after = await ids();
  assert.deepEqual(after.filter(r => r.wbs === 'W1'), first.filter(r => r.wbs === 'W1'), 'dự án không đổi giữ nguyên dòng');
  assert.ok(after.filter(r => r.wbs === 'W2').every(r => r.id > moc) && after.filter(r => r.wbs === 'W1').every(r => r.id < moc), 'chỉ dự án đổi số tiền được ghi lại');
  assert.ok(!after.some(r => r.wbs === 'W3') && after.some(r => r.wbs === 'W4'));
  await env.DB.prepare('DELETE FROM inc_lines WHERE batch_id = -1').run();
  const sums = (await env.DB.prepare('SELECT wbs, SUM(amount) t FROM inc_lines WHERE batch_id = ? GROUP BY wbs ORDER BY wbs').bind(b.id).all()).results;
  assert.deepEqual(sums.map(x => [x.wbs, x.t]), [['W1', 15], ['W2', 30], ['W4', 6]]);
});

test('Bảng công Thống kê: LƯU CHÊNH LỆCH — chỉ ghi dòng mới / sửa + xoá theo mã dòng, giữ dòng duyệt đẩy sang, chống ghi đè', async () => {
  const A = 'boss@example.com';
  const meta0 = (await call('GET', '/api/timesheets/meta', { email: A })).data;
  // nền: bảng hiện có + 5 dòng thử
  const keep = [];
  for (let after = 0; ;) { const p = (await call('GET', '/api/timesheets?after=' + after, { email: A })).data; keep.push(...p.rows); if (p.next == null) break; after = p.next; }
  const mk = (i) => ({ empId: 'DL' + i, empName: 'Delta ' + i, wbs: 'DW', projectName: 'Delta', activities: '1110', category: 'NI', date: '2035-01-0' + (i + 1), timeFrom: '08:00', timeTo: '17:00', role: 'Fitter', normal: 8, total: 8 });
  const up = await uploadTs(A, [...keep, mk(1), mk(2), mk(3), mk(4)], { baseVersion: meta0.version });
  assert.equal(up.commit.status, 200, JSON.stringify(up.commit.data));
  const base = (await call('GET', '/api/timesheets/meta', { email: A })).data;
  // dòng duyệt bảng công đẩy sang (src khác rỗng)
  await env.DB.prepare("UPDATE timesheets SET src = 'ts:DL4:2035-01' WHERE batch = (SELECT json_extract(data, '$.active') FROM kv_store WHERE key = 'timesheets_meta') AND emp_id = 'DL4'").run();
  // danh sách có mã dòng
  const withId = (await call('GET', '/api/timesheets?withId=1&limit=1000', { email: A })).data;
  const sid = (emp) => withId.rows.find(r => r.empId === emp)._sid;
  assert.ok(sid('DL1') > 0 && !('_sid' in (await call('GET', '/api/timesheets?limit=5', { email: A })).data.rows[0]), 'chỉ kèm _sid khi xin withId=1');
  const delta = async (add, del, baseVersion) => {
    const b = (await call('POST', '/api/admin/timesheets/begin', { email: A, body: {} })).data;
    if (add.length) assert.equal((await call('POST', '/api/admin/timesheets/rows', { email: A, body: { batch: b.batch, rows: add } })).status, 200);
    return call('POST', '/api/admin/timesheets/commit', { email: A, body: { batch: b.batch, baseVersion, count: add.length, mode: 'delta', del } });
  };
  // sửa DL2 (xoá cũ + thêm mới), xoá DL3, thêm DL5; DL4 (dòng duyệt) nằm trong danh sách xoá nhưng KHÔNG có dòng mới cùng ngày → giữ lại
  const r = await delta([{ ...mk(2), total: 9 }, mk(5)], [sid('DL2'), sid('DL3'), sid('DL4')], base.version);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual([r.data.added, r.data.removed, r.data.count, r.data.version], [2, 2, base.count, base.version + 1]);
  const rows = (await readTs(A)).rows.filter(x => x.wbs === 'DW').map(x => [x.empId, x.total]).sort();
  assert.deepEqual(rows, [['DL1', 8], ['DL2', 9], ['DL4', 8], ['DL5', 8]]);
  // bản cũ (baseVersion lệch) → 409, không đổi gì
  const stale = await delta([mk(6)], [sid('DL1')], base.version);
  assert.equal(stale.status, 409);
  assert.deepEqual((await readTs(A)).rows.filter(x => x.wbs === 'DW').map(x => x.empId).sort(), ['DL1', 'DL2', 'DL4', 'DL5']);
  assert.equal((await call('GET', '/api/timesheets/meta', { email: A })).data.version, base.version + 1);
});

test('Không đổi gì thì không ghi: lưu đợt Incentive giống hệt giữ nguyên phiên bản; PATCH dự án giống hệt không ghi nhật ký', async () => {
  const A = 'boss@example.com';
  const b = (await call('POST', '/api/incentive/batches', { email: A, body: { scheme: 'swat', month: '2034-03' } })).data;
  const data = { projects: [{ wbs: 'NC-1', name: 'DA', kind: 'first70', lines: [{ role: 'fitter', empId: 'TS1', name: 'Thợ Một', amount: 10 }] }] };
  const p1 = (await call('PUT', `/api/incentive/batches/${b.id}`, { email: A, body: { version: 1, data } })).data;
  const p2 = (await call('PUT', `/api/incentive/batches/${b.id}`, { email: A, body: { version: p1.version, data } })).data;
  assert.deepEqual([p2.ok, p2.version, p2.unchanged], [true, p1.version, true]);
  const p3 = (await call('PUT', `/api/incentive/batches/${b.id}`, { email: A, body: { version: p2.version, data: { projects: [{ ...data.projects[0], lines: [{ ...data.projects[0].lines[0], amount: 11 }] }] } } })).data;
  assert.equal(p3.version, p1.version + 1, 'đổi số tiền → lưu');
  const n0 = (await env.DB.prepare("SELECT COUNT(*) c FROM audit_log WHERE action = 'project_update'").first()).c;
  const f = { swatTargetHour: 204.8, targetSwat: true, swatState: { v: { stops: '4' } } };
  await call('PATCH', '/api/admin/projects/NC-PRJ', { email: A, body: { fields: f } });
  const again = (await call('PATCH', '/api/admin/projects/NC-PRJ', { email: A, body: { fields: f } })).data;
  assert.equal(again.unchanged, true);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) c FROM audit_log WHERE action = 'project_update'").first()).c, n0, 'không ghi nhật ký khi không đổi');
  await call('PATCH', '/api/admin/projects/NC-PRJ', { email: A, body: { fields: { ...f, swatTargetHour: 256.1 } } });
  assert.equal((await env.DB.prepare("SELECT COUNT(*) c FROM audit_log WHERE action = 'project_update'").first()).c, n0 + 1);
});

test('Incentive SWAT Analysis: YANSPN cost đã nhập ở đợt trước được trả lại cho đợt sau (cùng WBS)', async () => {
  const A = 'boss@example.com';
  const mk = async (month, projects) => { const b = (await call('POST', '/api/incentive/batches', { email: A, body: { scheme: 'swat', month } })).data;
    await call('PUT', `/api/incentive/batches/${b.id}`, { email: A, body: { version: 1, data: { projects } } }); return b.id; };
  await mk('2035-03', [{ wbs: 'AN-1', name: 'A', kind: 'first70', analysis: { yanspn: 41216040 }, lines: [] }, { wbs: 'AN-2', name: 'B', kind: 'first70', lines: [] }]);
  await mk('2035-05', [{ wbs: 'AN-1', name: 'A', kind: 'first70', analysis: { yanspn: 50000000 }, lines: [] }]);
  const cur = await mk('2035-09', [{ wbs: 'AN-1', name: 'A', kind: 'final30', lines: [] }]);
  assert.equal((await call('GET', `/api/incentive/analysis-prev?scheme=swat&exclude=${cur}`, { email: 'ap1@example.com' })).status, 403);
  const r = (await call('GET', `/api/incentive/analysis-prev?scheme=swat&exclude=${cur}`, { email: A })).data.items;
  assert.deepEqual(r['AN-1'], { yanspn: 50000000, month: '2035-05' }, 'lấy đợt gần nhất');
  assert.equal(r['AN-2'], undefined);
});
