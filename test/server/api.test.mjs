// Kiểm thử API máy chủ (server/api.mjs) trên D1 giả lập cục bộ (wrangler getPlatformProxy).
// Chạy: npm run test:server   — không cần mạng, không cần tài khoản Cloudflare.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
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
  for (const f of readdirSync(path.join(ROOT, 'migrations')).filter(n => n.endsWith('.sql')).sort()) {
    const sql = readFileSync(path.join(ROOT, 'migrations', f), 'utf8').split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
    for (const stmt of sql.split(';').map(x => x.trim()).filter(Boolean)) await proxy.env.DB.prepare(stmt).run();
  }
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
