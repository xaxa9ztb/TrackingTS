// API của Bộ công cụ (Cloudflare Pages Functions + D1).
// Mọi yêu cầu (trừ /api/health) phải qua Cloudflare Access; máy chủ kiểm tra lại chữ ký JWT,
// tìm nhân viên theo email rồi kiểm tra vai trò cho TỪNG yêu cầu. Mọi thao tác ghi đều vào nhật ký.

import { verifyAccessJwt, teamHost } from './auth.mjs';
import { effectiveRoles, rolesFromPosition, adminEmails, parseExtraRoles, ALL_ROLES } from './roles.mjs';
import { matchSupervisor, keyOf } from './supervisors.mjs';
import { notifyEvent } from './notify.mjs';
import { mailConfigured, sendMail, layout, senderName, esc } from './mail.mjs';
import { demoRequested, staleDemoCookie, demoCookie, demoEnv, seedDemo, switchPersona, DEMO_ROLES } from './demo.mjs';
import { PERIOD_RE, checkDoc, periodRange, checkSubmitEntries, checkSubmitAllowance, trackingRow, vnDate, amendLockedChanges, amendLockedMsg } from './tsdoc.mjs';
import { routeTsAdmin } from './tsadmin.mjs';
import { routeTsImport, backfillMine } from './tsimport.mjs';
import { routeIncentive } from './incentive.mjs';
import { routeHsProject } from './hsproject.mjs';
import { tsInbox, reviewDoc, decideDoc, resendApproved, approvedList, settle, notifyStage, withdrawDoc, projectWbs, projectWbsKnown } from './tsflow.mjs';
import { routeOtLeave, otPendingDays, isLead } from './otleave.mjs';

export class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra || null; }
}

const json = (data, status = 200, extraHeaders) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(extraHeaders || {}) },
});

const now = () => new Date().toISOString();
const str = (v, max = 500) => (v === undefined || v === null) ? '' : String(v).trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ROWS = 5000;
const PROJECT_COLS = { wbs: 1, projectName: 1, projectNumber: 1, productLine: 1, customer: 1, supervisor: 1 };

async function readJson(request) {
  try { return await request.json(); }
  catch (e) { throw new HttpError(400, 'Nội dung gửi lên không phải JSON hợp lệ'); }
}

async function audit(env, me, action, entity, entityId, before, after) {
  await env.DB.prepare('INSERT INTO audit_log (at, actor, action, entity, entity_id, before, after) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(now(), me.email, action, entity, entityId || '',
      before === undefined ? null : JSON.stringify(before), after === undefined ? null : JSON.stringify(after))
    .run();
}

async function loadMe(env, email) {
  const emp = await env.DB.prepare('SELECT * FROM employees WHERE email = ? COLLATE NOCASE').bind(email).first();
  if (emp && !emp.active) throw new HttpError(403, 'Tài khoản này đã bị khoá — liên hệ admin');
  const roles = effectiveRoles(emp, email, env);
  // email lạ: trang chủ chuyển sang bước Đăng ký (register: true) — xem /api/register
  if (!emp && !roles.includes('admin')) throw new HttpError(403, 'Email này chưa được gắn với nhân viên nào — gửi yêu cầu đăng ký để admin cấp tài khoản', { register: true, email });
  return {
    email, roles,
    isAdmin: roles.includes('admin'),
    isProjAdmin: roles.includes('projadmin'),         // Admin dự án: xử lý bảng công / dự án như admin nhưng không quản lý tài khoản, vai trò, hệ thống
    empId: emp ? emp.emp_id : '',
    name: emp ? emp.full_name : email,
    position: emp ? emp.position : '',
  };
}

// ---------- đăng ký tài khoản (email lạ → gửi họ tên + mã NV → admin duyệt) ----------
const EMPID_RE = /^[A-Za-z0-9._-]{1,30}$/;
const regOut = (r) => r && ({ id: r.id, email: r.email, name: r.full_name, empId: r.emp_id, note: r.note, status: r.status,
  createdAt: r.created_at, updatedAt: r.updated_at, decidedAt: r.decided_at, decidedBy: r.decided_by, decisionNote: r.decision_note });

// email đã gắn nhân viên thì không cần đăng ký
async function regGuard(env, email) {
  const emp = await env.DB.prepare('SELECT emp_id, active FROM employees WHERE email = ? COLLATE NOCASE').bind(email).first();
  if (emp) throw new HttpError(409, emp.active ? 'Email này đã có tài khoản — tải lại trang để vào' : 'Tài khoản này đã bị khoá — liên hệ admin');
}

async function registerGet(env, email) {
  await regGuard(env, email);
  const r = await env.DB.prepare('SELECT * FROM registrations WHERE email = ? COLLATE NOCASE').bind(email).first();
  return json({ email, request: regOut(r) });
}

// người nhận thư báo có yêu cầu đăng ký: ADMIN_EMAILS + nhân viên có vai trò admin
async function adminRecipients(env) {
  const list = adminEmails(env).map(e => ({ email: e }));
  const { results } = await env.DB.prepare("SELECT * FROM employees WHERE active = 1 AND email <> ''").all();
  for (const e of results) if (effectiveRoles(e, e.email, env).includes('admin')) list.push({ email: String(e.email).toLowerCase(), name: e.full_name });
  return list;
}

async function registerPost(env, email, request) {
  await regGuard(env, email);
  const body = await readJson(request);
  const name = str(body.name, 100).replace(/\s+/g, ' '), empId = str(body.empId, 30).toUpperCase(), note = str(body.note, 300);
  if (name.length < 4 || !/\s/.test(name)) throw new HttpError(400, 'Nhập họ và tên đầy đủ');
  if (!EMPID_RE.test(empId)) throw new HttpError(400, 'Mã nhân viên chỉ gồm chữ, số, dấu chấm, gạch (tối đa 30 ký tự)');
  const t = now();
  const cur = await env.DB.prepare('SELECT * FROM registrations WHERE email = ? COLLATE NOCASE').bind(email).first();
  const changed = !cur || cur.status !== 'pending' || cur.full_name !== name || cur.emp_id !== empId || cur.note !== note;
  if (cur) {
    await env.DB.prepare("UPDATE registrations SET full_name = ?, emp_id = ?, note = ?, status = 'pending', updated_at = ?, decided_at = '', decided_by = '', decision_note = '' WHERE id = ?")
      .bind(name, empId, note, t, cur.id).run();
  } else {
    await env.DB.prepare('INSERT INTO registrations (email, full_name, emp_id, note, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(email.toLowerCase(), name, empId, note, 'pending', t, t).run();
  }
  const r = await env.DB.prepare('SELECT * FROM registrations WHERE email = ? COLLATE NOCASE').bind(email).first();
  // báo admin: khi có thay đổi, tối đa 1 thư / 10 phút cho mỗi email (chống gửi dồn)
  let mailed = false;
  const recent = r.notified_at && (Date.parse(t) - Date.parse(r.notified_at) < 10 * 60e3);
  if (changed && !recent) {
    const emp = await env.DB.prepare('SELECT emp_id, full_name, email FROM employees WHERE emp_id = ?').bind(empId).first();
    const check = !emp ? '<p style="color:#b45309">⚠ Mã NV này <b>chưa có</b> trong dữ liệu nhân viên — cần thêm nhân viên trước khi duyệt.</p>'
      : emp.email ? `<p style="color:#b45309">⚠ Mã NV này đang gắn email <b>${esc(emp.email)}</b> (${esc(emp.full_name)}).</p>`
      : `<p style="color:#047857">✓ Mã NV có trong dữ liệu: <b>${esc(emp.full_name)}</b> — chưa có email.</p>`;
    const to = await adminRecipients(env);
    const res = await sendMail(env, { to, subject: `[Đăng ký] ${name} (${empId}) xin cấp tài khoản`,
      html: layout('Có yêu cầu đăng ký tài khoản mới', `<p><b>${esc(name)}</b> vừa đăng nhập bằng email <b>${esc(r.email)}</b> và xin cấp tài khoản.</p>
<table style="border-collapse:collapse;font-size:14px"><tr><td style="padding:3px 12px 3px 0;color:#667085">Họ tên</td><td><b>${esc(name)}</b></td></tr>
<tr><td style="padding:3px 12px 3px 0;color:#667085">Mã NV</td><td><b>${esc(empId)}</b></td></tr>
<tr><td style="padding:3px 12px 3px 0;color:#667085">Email</td><td>${esc(r.email)}</td></tr>${note ? `<tr><td style="padding:3px 12px 3px 0;color:#667085">Ghi chú</td><td>${esc(note)}</td></tr>` : ''}</table>
${check}<p>Duyệt trong trang <b>Tài khoản &amp; phân quyền</b> → mục <i>Yêu cầu đăng ký</i>: email sẽ được gắn vào nhân viên và người đăng ký nhận thư báo.</p>`,
        { url: `${env.APP_URL}/tools/accounts/#dangky`, label: 'Mở yêu cầu đăng ký' }) }).catch(e => ({ ok: false, error: String(e && e.message || e) }));
    mailed = !!(res && res.ok);
    if (mailed) await env.DB.prepare('UPDATE registrations SET notified_at = ? WHERE id = ?').bind(t, r.id).run();
  }
  return json({ ok: true, mailed, request: regOut(r) });
}

async function regList(env, me, url) {
  need(me);
  const all = url.searchParams.get('all') === '1';
  const { results } = await env.DB.prepare(all ? 'SELECT * FROM registrations ORDER BY updated_at DESC LIMIT 200'
    : "SELECT * FROM registrations WHERE status = 'pending' ORDER BY created_at").all();
  const ids = [...new Set(results.map(r => r.emp_id))];
  const emps = new Map();
  if (ids.length) {
    const q = await env.DB.prepare(`SELECT emp_id, full_name, position, email, active FROM employees WHERE emp_id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
    for (const e of q.results) emps.set(e.emp_id, e);
  }
  return json({ requests: results.map(r => {
    const e = emps.get(r.emp_id);
    return { ...regOut(r), employee: e ? { empId: e.emp_id, name: e.full_name, position: e.position, email: e.email || '', active: !!e.active } : null };
  }) });
}

async function regDecide(env, me, id, action, request) {
  need(me);
  const body = await readJson(request);
  const r = await env.DB.prepare('SELECT * FROM registrations WHERE id = ?').bind(id).first();
  if (!r) throw new HttpError(404, 'Không có yêu cầu này');
  if (r.status !== 'pending') throw new HttpError(409, 'Yêu cầu này đã được xử lý');
  const t = now(), note = str(body.note, 300);
  let empOut = null;
  if (action === 'approve') {
    const empId = str(body.empId || r.emp_id, 30).toUpperCase();
    const emp = await env.DB.prepare('SELECT * FROM employees WHERE emp_id = ?').bind(empId).first();
    if (!emp) throw new HttpError(400, `Mã NV ${empId} chưa có trong dữ liệu nhân viên — thêm nhân viên (Quản trị → Nhân viên) rồi duyệt lại, hoặc sửa mã NV`);
    if (!emp.active) throw new HttpError(409, `Nhân viên ${empId} đang bị khoá`);
    if (emp.email && emp.email.toLowerCase() !== r.email.toLowerCase())
      throw new HttpError(409, `Nhân viên ${empId} (${emp.full_name}) đang gắn email ${emp.email} — gỡ email cũ ở bảng Tài khoản trước nếu đúng là người này`);
    const owner = await env.DB.prepare('SELECT emp_id FROM employees WHERE email = ? COLLATE NOCASE AND emp_id <> ?').bind(r.email, empId).first();
    if (owner) throw new HttpError(409, `Email này đã gắn cho nhân viên ${owner.emp_id}`);
    await env.DB.batch([
      env.DB.prepare('UPDATE employees SET email = ?, updated_at = ? WHERE emp_id = ?').bind(r.email.toLowerCase(), t, empId),
      env.DB.prepare("UPDATE registrations SET status = 'approved', emp_id = ?, decided_at = ?, decided_by = ?, decision_note = ? WHERE id = ?").bind(empId, t, me.name || me.email, note, id),
    ]);
    await audit(env, me, 'register_approve', 'employee', empId, { email: emp.email || '' }, { email: r.email, request: id });
    empOut = { empId, name: emp.full_name };
    await sendMail(env, { to: [{ email: r.email, name: emp.full_name }], subject: 'Tài khoản Bộ công cụ dự án đã được cấp',
      html: layout('Tài khoản của bạn đã sẵn sàng', `<p>Chào ${esc(emp.full_name)},</p><p>Admin đã duyệt yêu cầu đăng ký: email <b>${esc(r.email)}</b> đã được gắn với mã nhân viên <b>${esc(empId)}</b>.</p>${note ? `<p>Ghi chú của admin: ${esc(note)}</p>` : ''}<p>Mở Bộ công cụ, đăng nhập bằng email này (mã gửi về hộp thư) để bắt đầu dùng.</p>`,
        { url: `${env.APP_URL}/`, label: 'Mở Bộ công cụ dự án' }) }).catch(() => {});
  } else {
    if (!note) throw new HttpError(400, 'Nhập lý do không duyệt (người đăng ký nhận được qua email)');
    await env.DB.prepare("UPDATE registrations SET status = 'rejected', decided_at = ?, decided_by = ?, decision_note = ? WHERE id = ?").bind(t, me.name || me.email, note, id).run();
    await audit(env, me, 'register_reject', 'registration', String(id), undefined, { email: r.email, empId: r.emp_id, note });
    await sendMail(env, { to: [{ email: r.email, name: r.full_name }], subject: 'Yêu cầu đăng ký Bộ công cụ dự án chưa được duyệt',
      html: layout('Yêu cầu đăng ký chưa được duyệt', `<p>Chào ${esc(r.full_name)},</p><p>Admin chưa duyệt yêu cầu đăng ký của email <b>${esc(r.email)}</b>.</p><p>Lý do: <b>${esc(note)}</b></p><p>Bạn có thể mở lại Bộ công cụ, sửa thông tin và gửi lại yêu cầu.</p>`,
        { url: `${env.APP_URL}/`, label: 'Mở Bộ công cụ dự án' }) }).catch(() => {});
  }
  const after = await env.DB.prepare('SELECT * FROM registrations WHERE id = ?').bind(id).first();
  return json({ ok: true, request: regOut(after), employee: empOut });
}

function need(me, ...roles) {
  if (me.isAdmin || roles.some(r => me.roles.includes(r))) return;
  throw new HttpError(403, 'Bạn không có quyền thực hiện thao tác này');
}

function employeeOut(e, full) {
  const base = { empId: e.emp_id, name: e.full_name, position: e.position, supervisor: e.supervisor, hireDate: e.hire_date || '', startDate: e.start_date || '' };
  if (!full) return base;
  return {
    ...base, email: e.email || '', roleOverride: e.role_override, extraRoles: parseExtraRoles(e.extra_role),
    active: !!e.active, roles: effectiveRoles(e, '', {}),
    updatedAt: e.updated_at,
  };
}

async function projectStaff(env) {
  const { results } = await env.DB.prepare('SELECT wbs, emp_id, role FROM project_staff ORDER BY wbs, role, emp_id').all();
  const map = new Map();
  for (const r of results) {
    if (!map.has(r.wbs)) map.set(r.wbs, { sitesup: [], pm: [] });
    map.get(r.wbs)[r.role].push(r.emp_id);
  }
  return map;
}

// ---------- các route ----------

async function getMe(env, me) {
  const { results } = me.empId
    ? await env.DB.prepare('SELECT wbs, role FROM project_staff WHERE emp_id = ? ORDER BY wbs').bind(me.empId).all()
    : { results: [] };
  let registrations = 0;
  if (me.isAdmin) { const c = await env.DB.prepare("SELECT COUNT(*) AS n FROM registrations WHERE status = 'pending'").first(); registrations = c ? c.n : 0; }
  return json({ ...me, projects: results, demo: !!env.DEMO, registrations });
}

// ---------- chế độ Demo: cơ sở dữ liệu D1 riêng (DB_DEMO), xem server/demo.mjs ----------
async function demoStart(realEnv, email, request) {
  if (!realEnv.DB_DEMO) throw new HttpError(503, 'Chế độ demo chưa được bật trên máy chủ này');
  const body = await readJson(request);
  const role = DEMO_ROLES.includes(body.role) ? body.role : 'staff';
  // dữ liệu mẫu vừa dựng (< 12 giờ) → chỉ đổi vai trò, không xoá / dựng lại (mỗi lần dựng ~ vài trăm lượt ghi D1, tính chung hạn mức tài khoản)
  const mark = await realEnv.DB_DEMO.prepare("SELECT saved_at FROM kv_store WHERE key = 'demo_seeded'").first().catch(() => null);
  if (mark && Date.now() - Date.parse(mark.saved_at) < 12 * 3600e3 && !body.fresh) {
    const p = await switchPersona(realEnv.DB_DEMO, email, role).catch(() => null);
    if (p) return json({ ok: true, role, reused: true, ...p }, 200, { 'set-cookie': demoCookie(true) });
  }
  const r = await seedDemo(realEnv.DB_DEMO, { email }, role);
  await realEnv.DB_DEMO.prepare("INSERT INTO kv_store (key, version, data, saved_at, saved_by) VALUES ('demo_seeded', 1, '', ?, '') ON CONFLICT(key) DO UPDATE SET saved_at = excluded.saved_at").bind(now()).run();
  return json({ ok: true, role, ...r }, 200, { 'set-cookie': demoCookie(true) });
}
// đổi vai trò trong demo, giữ nguyên dữ liệu (bảng công đã nộp / duyệt…)
async function demoRole(env, email, request) {
  const body = await readJson(request);
  if (!DEMO_ROLES.includes(body.role)) throw new HttpError(400, 'Vai trò không hợp lệ');
  const p = await switchPersona(env.DB, email, body.role);
  if (!p) throw new HttpError(409, 'Dữ liệu demo chưa có — bấm Làm mới dữ liệu demo');
  return json({ ok: true, ...p });
}

async function listEmployees(env, me) {
  const full = me.isAdmin || me.roles.includes('pm') || me.isProjAdmin;
  const sql = full ? 'SELECT * FROM employees ORDER BY full_name' : 'SELECT * FROM employees WHERE active = 1 ORDER BY full_name';
  const { results } = await env.DB.prepare(sql).all();
  return json({ employees: results.map(e => employeeOut(e, full)) });
}

async function listProjects(env) {
  const { results } = await env.DB.prepare('SELECT * FROM projects ORDER BY wbs').all();
  const staff = await projectStaff(env);
  return json({
    projects: results.map(p => {
      let extra = {};
      try { extra = JSON.parse(p.extra || '{}'); } catch (e) { /* bỏ qua */ }
      return {
        ...extra, wbs: p.wbs, projectName: p.project_name, projectNumber: p.project_number,
        productLine: p.product_line, customer: p.customer, supervisor: p.supervisor,
        staff: staff.get(p.wbs) || { sitesup: [], pm: [] }, updatedAt: p.updated_at,
      };
    }),
  });
}

async function putProjectStaff(env, me, wbs, request) {
  need(me, 'pm', 'projadmin');
  const body = await readJson(request);
  const project = await env.DB.prepare('SELECT wbs FROM projects WHERE wbs = ?').bind(wbs).first();
  if (!project) throw new HttpError(404, 'Không có dự án ' + wbs);
  const wanted = { sitesup: [], pm: [] };
  for (const role of ['sitesup', 'pm']) {
    const ids = Array.isArray(body[role]) ? body[role] : [];
    wanted[role] = [...new Set(ids.map(x => str(x, 50)).filter(Boolean))];
  }
  const all = [...new Set([...wanted.sitesup, ...wanted.pm])];
  if (all.length) {
    const { results } = await env.DB.prepare(`SELECT emp_id FROM employees WHERE emp_id IN (${all.map(() => '?').join(',')})`).bind(...all).all();
    const known = new Set(results.map(r => r.emp_id));
    const missing = all.filter(id => !known.has(id));
    if (missing.length) throw new HttpError(400, 'Không có nhân viên: ' + missing.join(', '));
  }
  const before = (await projectStaff(env)).get(wbs) || { sitesup: [], pm: [] };
  const stmts = [env.DB.prepare('DELETE FROM project_staff WHERE wbs = ?').bind(wbs)];
  for (const role of ['sitesup', 'pm']) {
    for (const id of wanted[role]) stmts.push(env.DB.prepare('INSERT INTO project_staff (wbs, emp_id, role) VALUES (?, ?, ?)').bind(wbs, id, role));
  }
  await env.DB.batch(stmts);
  await audit(env, me, 'set_staff', 'project', wbs, before, wanted);
  return json({ ok: true, wbs, staff: wanted });
}

// Đưa EE Data + Dự án (cùng định dạng file Drive / bản sao lưu JSON) lên máy chủ.
// Không đụng tới email, vai trò chỉnh tay, trạng thái khoá đã đặt trên máy chủ.
// Gói miễn phí của D1 giới hạn số câu lệnh mỗi lần gọi và 100 tham số mỗi câu lệnh, nên ghi nhiều dòng
// một câu lệnh (tối đa 100 tham số) và giới hạn số câu lệnh mỗi yêu cầu — trang quản trị gửi từng đợt nhỏ.
const MAX_STMTS = 40;
const EMP_PER_STMT = 14;      // 7 tham số × 14 = 98
const PROJ_PER_STMT = 12;     // 8 tham số × 12 = 96
const IDS_PER_STMT = 90;

function multiRow(table, cols, conflictKey, rows) {
  const ph = '(' + cols.map(() => '?').join(', ') + ')';
  const upd = cols.filter(c => c !== conflictKey).map(c => `${c} = excluded.${c}`).join(', ');
  return {
    sql: `INSERT INTO ${table} (${cols.join(', ')}) VALUES ${rows.map(() => ph).join(', ')} ON CONFLICT(${conflictKey}) DO UPDATE SET ${upd}`,
    params: rows.flat(),
  };
}
const chunks = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

async function importData(env, me, request) {
  need(me);
  const body = await readJson(request);
  const employees = Array.isArray(body.employees) ? body.employees : [];
  const projects = Array.isArray(body.projects) ? body.projects : [];
  if (employees.length > MAX_ROWS || projects.length > MAX_ROWS) throw new HttpError(413, 'Quá nhiều dòng trong một lần gửi');
  const t = now();

  const empRows = new Map();   // emp_id → dòng (dòng sau đè dòng trước)
  for (const e of employees) {
    const id = str(e && e.empId, 50), name = str(e && e.fullName, 200);
    if (id && name) empRows.set(id, [id, name, str(e.position, 200), str(e.supervisor, 200), str(e.hireDate, 40), str(e.startDate, 40), t]);
  }
  const projRows = new Map();
  for (const p of projects) {
    const wbs = str(p && p.wbs, 100);
    if (!wbs) continue;
    const extra = {};
    for (const [k, v] of Object.entries(p)) if (!PROJECT_COLS[k]) extra[k] = v;
    projRows.set(wbs, [wbs, str(p.projectName, 300), str(p.projectNumber, 100), str(p.productLine, 200), str(p.customer, 300),
      str(p.supervisor, 200), JSON.stringify(extra).slice(0, 20000), t]);
  }

  const parts = [
    ...chunks([...empRows.values()], EMP_PER_STMT).map(r => multiRow('employees', ['emp_id', 'full_name', 'position', 'supervisor', 'hire_date', 'start_date', 'updated_at'], 'emp_id', r)),
    ...chunks([...projRows.values()], PROJ_PER_STMT).map(r => multiRow('projects', ['wbs', 'project_name', 'project_number', 'product_line', 'customer', 'supervisor', 'extra', 'updated_at'], 'wbs', r)),
  ];

  // "Khoá người không còn trong EE Data": danh sách đầy đủ có thể gửi riêng (allEmpIds) vì dữ liệu được gửi từng đợt
  let deactivated = 0;
  const keepList = Array.isArray(body.allEmpIds) ? body.allEmpIds.map(x => str(x, 50)).filter(Boolean) : [...empRows.keys()];
  if (body.deactivateMissing && keepList.length) {
    const keep = new Set(keepList);
    const { results } = await env.DB.prepare('SELECT emp_id FROM employees WHERE active = 1').all();
    const missing = results.map(r => r.emp_id).filter(id => !keep.has(id));
    deactivated = missing.length;
    for (const ids of chunks(missing, IDS_PER_STMT)) {
      parts.push({ sql: `UPDATE employees SET active = 0, updated_at = ? WHERE emp_id IN (${ids.map(() => '?').join(', ')})`, params: [t, ...ids] });
    }
  }
  if (parts.length > MAX_STMTS) throw new HttpError(413, 'Gửi quá nhiều dòng một lần — gửi từng đợt nhỏ hơn (tối đa khoảng 300 nhân viên hoặc 150 dự án mỗi lần)');
  if (parts.length) await env.DB.batch(parts.map(x => env.DB.prepare(x.sql).bind(...x.params)));
  const summary = { employees: empRows.size, projects: projRows.size, deactivated };
  await audit(env, me, 'import', 'data', '', undefined, summary);
  return json({ ok: true, ...summary });
}

// Gắn email hàng loạt: [{ empId, email }, …] (tối đa 40 dòng mỗi lần). Trả kết quả từng dòng; dòng lỗi không làm hỏng dòng khác.
async function setEmails(env, me, request) {
  need(me);
  const body = await readJson(request);
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) throw new HttpError(400, 'Chưa có dòng nào');
  if (items.length > 40) throw new HttpError(413, 'Gửi tối đa 40 dòng mỗi lần');
  const rows = items.map(i => ({ empId: str(i && i.empId, 50), email: str(i && i.email, 200).toLowerCase() }));
  const ids = [...new Set(rows.map(r => r.empId).filter(Boolean))];
  const mails = [...new Set(rows.map(r => r.email).filter(e => EMAIL_RE.test(e)))];
  const emps = new Map();
  if (ids.length) {
    const { results } = await env.DB.prepare(`SELECT emp_id, full_name, email FROM employees WHERE emp_id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
    for (const r of results) emps.set(r.emp_id, r);
  }
  const owner = new Map();     // email → emp_id đang giữ
  if (mails.length) {
    const { results } = await env.DB.prepare(`SELECT emp_id, email FROM employees WHERE email IN (${mails.map(() => '?').join(',')}) COLLATE NOCASE`).bind(...mails).all();
    for (const r of results) owner.set(String(r.email).toLowerCase(), r.emp_id);
  }
  const taken = new Map();     // email → empId trong chính yêu cầu này
  const results = [], stmts = [], changes = [];
  const t = now();
  for (const r of rows) {
    const res = { empId: r.empId, email: r.email, ok: false, error: '' };
    results.push(res);
    if (!r.empId) { res.error = 'Thiếu mã NV'; continue; }
    if (!EMAIL_RE.test(r.email)) { res.error = 'Email không hợp lệ'; continue; }
    const emp = emps.get(r.empId);
    if (!emp) { res.error = 'Không có mã NV này trên máy chủ'; continue; }
    if (me.empId && me.empId === r.empId) { res.error = 'Không tự đổi email của chính mình ở đây'; continue; }
    if (taken.has(r.email) && taken.get(r.email) !== r.empId) { res.error = 'Email trùng với một dòng khác trong danh sách'; continue; }
    if (owner.has(r.email) && owner.get(r.email) !== r.empId) { res.error = 'Email đã gắn cho nhân viên ' + owner.get(r.email); continue; }
    taken.set(r.email, r.empId);
    res.ok = true; res.name = emp.full_name;
    if ((emp.email || '').toLowerCase() === r.email) { res.unchanged = true; continue; }
    stmts.push(env.DB.prepare('UPDATE employees SET email = ?, updated_at = ? WHERE emp_id = ?').bind(r.email, t, r.empId));
    changes.push({ empId: r.empId, before: emp.email || '', after: r.email });
  }
  if (stmts.length) {
    await env.DB.batch(stmts);
    await audit(env, me, 'set_emails', 'employee', '', undefined, { changes });
  }
  return json({ ok: true, applied: changes.length, results });
}

// ---------- tự phân công Site Sup theo cột "Giám sát" của dự án ----------
async function supervisorGroups(env) {
  const { results: projs } = await env.DB.prepare("SELECT wbs, supervisor FROM projects WHERE TRIM(supervisor) <> ''").all();
  const { results: emps } = await env.DB.prepare('SELECT emp_id, full_name, position, active FROM employees').all();
  const { results: aliasRows } = await env.DB.prepare('SELECT norm, emp_id FROM supervisor_alias').all();
  const { results: staffed } = await env.DB.prepare("SELECT DISTINCT wbs FROM project_staff WHERE role = 'sitesup'").all();
  const alias = new Map(aliasRows.map(a => [a.norm, a.emp_id]));
  const has = new Set(staffed.map(r => r.wbs));
  const groups = new Map();
  for (const p of projs) {
    const k = keyOf(p.supervisor);
    if (!k) continue;
    if (!groups.has(k)) groups.set(k, { key: k, label: String(p.supervisor).trim(), projects: [], withSitesup: 0 });
    const g = groups.get(k);
    g.projects.push(p.wbs);
    if (has.has(p.wbs)) g.withSitesup++;
  }
  return { groups: [...groups.values()], emps, alias };
}

async function listSupervisors(env, me) {
  need(me, 'pm', 'projadmin');
  const { groups, emps, alias } = await supervisorGroups(env);
  const out = groups.map(g => {
    const m = matchSupervisor(g.label, emps, alias.get(g.key));
    return {
      key: g.key, label: g.label, projects: g.projects.length, withSitesup: g.withSitesup,
      match: m.match ? { empId: m.match.emp_id, name: m.match.full_name, position: m.match.position, how: m.how } : null,
      candidates: m.candidates.map(e => ({ empId: e.emp_id, name: e.full_name, position: e.position })),
    };
  }).sort((a, b) => b.projects - a.projects);
  return json({ groups: out, totalProjects: out.reduce((n, g) => n + g.projects, 0) });
}

// items: [{ key, empId }]; onlyEmpty (mặc định true): chỉ dự án chưa có Site Sup
async function applySupervisors(env, me, request) {
  need(me, 'pm', 'projadmin');
  const body = await readJson(request);
  const items = Array.isArray(body.items) ? body.items : [];
  const onlyEmpty = body.onlyEmpty !== false;
  if (!items.length) throw new HttpError(400, 'Chưa chọn nhóm nào');
  if (items.length > 30) throw new HttpError(413, 'Tối đa 30 nhóm mỗi lần');
  const { groups } = await supervisorGroups(env);
  const byKey = new Map(groups.map(g => [g.key, g]));
  const empIds = [...new Set(items.map(i => str(i && i.empId, 50)).filter(Boolean))];
  const { results: found } = empIds.length
    ? await env.DB.prepare(`SELECT emp_id, full_name, active FROM employees WHERE emp_id IN (${empIds.map(() => '?').join(',')})`).bind(...empIds).all()
    : { results: [] };
  const emp = new Map(found.map(e => [e.emp_id, e]));
  const { results: staffed } = await env.DB.prepare("SELECT DISTINCT wbs FROM project_staff WHERE role = 'sitesup'").all();
  const has = new Set(staffed.map(r => r.wbs));

  const t = now(), results = [], parts = [], aliasRows = [], changes = [];
  const wbsTouched = new Map();   // wbs → empId (nhóm sau không đè nhóm trước trong cùng yêu cầu)
  for (const it of items) {
    const key = str(it && it.key, 300), empId = str(it && it.empId, 50);
    const g = byKey.get(key), e = emp.get(empId);
    const res = { key, empId, ok: false, assigned: 0, skipped: 0, error: '' };
    results.push(res);
    if (!g) { res.error = 'Không có nhóm giám sát này'; continue; }
    if (!e) { res.error = 'Không có nhân viên ' + (empId || '(trống)'); continue; }
    if (!e.active) { res.error = 'Nhân viên ' + empId + ' đã bị khoá'; continue; }
    aliasRows.push([key, g.label, empId, t]);
    for (const wbs of g.projects) {
      if (wbsTouched.has(wbs) || (onlyEmpty && has.has(wbs))) { res.skipped++; continue; }
      wbsTouched.set(wbs, empId); res.assigned++;
    }
    res.ok = true; res.name = e.full_name;
    changes.push({ key: g.label, empId, assigned: res.assigned, skipped: res.skipped });
  }
  const wbsList = [...wbsTouched.keys()];
  if (!onlyEmpty) {
    for (let i = 0; i < wbsList.length; i += 90) {
      const ids = wbsList.slice(i, i + 90);
      parts.push({ sql: `DELETE FROM project_staff WHERE role = 'sitesup' AND wbs IN (${ids.map(() => '?').join(',')})`, params: ids });
    }
  }
  for (let i = 0; i < wbsList.length; i += 45) {
    const rows = wbsList.slice(i, i + 45).map(w => [w, wbsTouched.get(w)]);
    parts.push({ sql: `INSERT OR IGNORE INTO project_staff (wbs, emp_id, role) VALUES ${rows.map(() => "(?, ?, 'sitesup')").join(', ')}`, params: rows.flat() });
  }
  for (const a of aliasRows) {
    parts.push({ sql: 'INSERT INTO supervisor_alias (norm, label, emp_id, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(norm) DO UPDATE SET label = excluded.label, emp_id = excluded.emp_id, updated_at = excluded.updated_at', params: a });
  }
  if (parts.length > MAX_STMTS) throw new HttpError(413, 'Quá nhiều dự án một lần — chọn ít nhóm hơn');
  if (parts.length) await env.DB.batch(parts.map(x => env.DB.prepare(x.sql).bind(...x.params)));
  const assigned = wbsList.length;
  if (changes.length) await audit(env, me, 'auto_staff', 'project', '', undefined, { onlyEmpty, assigned, groups: changes });
  return json({ ok: true, assigned, results });
}

// Gán MỘT Quản lý dự án cho nhiều dự án một lần (thường: mọi dự án do cùng một người quản lý).
// onlyEmpty (mặc định true): chỉ dự án chưa có Quản lý dự án.
async function assignPmAll(env, me, request) {
  need(me, 'pm', 'projadmin');
  const body = await readJson(request);
  const empId = str(body.empId, 50);
  const onlyEmpty = body.onlyEmpty !== false;
  const emp = empId ? await env.DB.prepare('SELECT * FROM employees WHERE emp_id = ?').bind(empId).first() : null;
  if (!emp) throw new HttpError(404, 'Không có nhân viên ' + (empId || '(trống)'));
  if (!emp.active) throw new HttpError(400, 'Nhân viên này đã bị khoá');
  const roles = effectiveRoles(emp, emp.email, env);
  if (!roles.includes('pm') && !roles.includes('admin')) throw new HttpError(400, 'Người này không có vai trò Quản lý dự án (theo chức danh hoặc vai trò chỉnh tay)');

  const { results: projs } = await env.DB.prepare('SELECT wbs FROM projects').all();
  const { results: have } = await env.DB.prepare("SELECT DISTINCT wbs FROM project_staff WHERE role = 'pm'").all();
  const hasPm = new Set(have.map(r => r.wbs));
  const targets = projs.map(r => r.wbs).filter(w => !(onlyEmpty && hasPm.has(w)));
  const parts = [];
  if (!onlyEmpty) {
    for (const ids of chunks(targets, IDS_PER_STMT)) parts.push({ sql: `DELETE FROM project_staff WHERE role = 'pm' AND wbs IN (${ids.map(() => '?').join(',')})`, params: ids });
  }
  for (const ids of chunks(targets, 45)) {
    parts.push({ sql: `INSERT OR IGNORE INTO project_staff (wbs, emp_id, role) VALUES ${ids.map(() => "(?, ?, 'pm')").join(', ')}`, params: ids.flatMap(w => [w, empId]) });
  }
  if (parts.length > MAX_STMTS) throw new HttpError(413, 'Quá nhiều dự án một lần');
  if (parts.length) await env.DB.batch(parts.map(x => env.DB.prepare(x.sql).bind(...x.params)));
  const summary = { empId, name: emp.full_name, assigned: targets.length, skipped: projs.length - targets.length, onlyEmpty };
  await audit(env, me, 'assign_pm', 'project', '', undefined, summary);
  return json({ ok: true, ...summary });
}

// ---------- kho dữ liệu chung của "Quản lý dự án" (giao thức giống Apps Script cũ: load / save + số phiên bản) ----------
const PM_KEY = 'projectplan';
const PM_MAX_BYTES = 1500000;       // D1: một dòng tối đa ~2 MB
async function pmStore(env, me, request) {
  if (!(me.isAdmin || me.roles.includes('pm') || me.roles.includes('sitesup'))) {
    return json({ ok: false, denied: true, error: 'Chỉ Quản lý dự án và Site Sup được dùng kho dữ liệu này' });
  }
  const body = await readJson(request);
  const row = await env.DB.prepare('SELECT version, data, saved_at, saved_by FROM kv_store WHERE key = ?').bind(PM_KEY).first();
  const cur = row ? { version: row.version, updatedAt: row.saved_at, updatedBy: row.saved_by, data: row.data ? JSON.parse(row.data) : null }
    : { version: 0, updatedAt: '', updatedBy: '', data: null };
  if (body.action === 'load') return json({ ok: true, ...cur, user: me.name });
  if (body.action !== 'save') return json({ ok: false, error: 'Thao tác không hỗ trợ' });

  const d = body.data;
  if (!d || !Array.isArray(d.fitters) || !Array.isArray(d.projects) || typeof d.alloc !== 'object' || d.alloc === null || Array.isArray(d.alloc)) {
    return json({ ok: false, error: 'Dữ liệu không hợp lệ' });
  }
  const text = JSON.stringify({ fitters: d.fitters, projects: d.projects, alloc: d.alloc });
  if (text.length > PM_MAX_BYTES) return json({ ok: false, error: 'Dữ liệu quá lớn để lưu một lần' });
  const base = Number(body.baseVersion) || 0;
  const t = now();
  // Ghi có điều kiện theo số phiên bản (nguyên tử): có người lưu trước thì không ghi, trả bản mới nhất để gộp
  const res = base === 0
    ? await env.DB.prepare('INSERT INTO kv_store (key, version, data, saved_at, saved_by) VALUES (?, 1, ?, ?, ?) ON CONFLICT(key) DO NOTHING').bind(PM_KEY, text, t, me.name).run()
    : await env.DB.prepare('UPDATE kv_store SET version = version + 1, data = ?, saved_at = ?, saved_by = ? WHERE key = ? AND version = ?').bind(text, t, me.name, PM_KEY, base).run();
  if (!res.meta || res.meta.changes !== 1) {
    const now2 = await env.DB.prepare('SELECT version, data, saved_at, saved_by FROM kv_store WHERE key = ?').bind(PM_KEY).first();
    return json({ ok: false, conflict: true, version: now2 ? now2.version : 0, updatedAt: now2 ? now2.saved_at : '', updatedBy: now2 ? now2.saved_by : '', data: now2 && now2.data ? JSON.parse(now2.data) : null });
  }
  return json({ ok: true, version: base + 1, updatedAt: t, updatedBy: me.name });
}

// ---------- bảng công cho Thống kê giờ công ----------
const TS_KEY = 'timesheets_meta';
const TS_ROWS_PER_REQUEST = 160;     // 5 tham số × 20 dòng = 100 tham số mỗi câu lệnh → tối đa 8 câu lệnh; đủ nhẹ cho giới hạn ~10 ms CPU của gói miễn phí
const TS_PAGE = 1000;
const TS_DATA_MAX = 3000;

async function tsMetaRow(env) {
  const row = await env.DB.prepare('SELECT version, data FROM kv_store WHERE key = ?').bind(TS_KEY).first();
  const m = row && row.data ? JSON.parse(row.data) : {};
  return { cas: row ? row.version : null, meta: { active: m.active || 0, next: m.next || 1, dataVersion: m.dataVersion || 0, count: m.count || 0, updatedAt: m.updatedAt || '', updatedBy: m.updatedBy || '' } };
}
// ghi meta có điều kiện (cas = số phiên bản của dòng kv_store lúc đọc); trả true nếu ghi được
async function tsMetaWrite(env, cas, meta) {
  const text = JSON.stringify(meta);
  const res = cas === null
    ? await env.DB.prepare("INSERT INTO kv_store (key, version, data, saved_at, saved_by) VALUES (?, 1, ?, ?, '') ON CONFLICT(key) DO NOTHING").bind(TS_KEY, text, now()).run()
    : await env.DB.prepare('UPDATE kv_store SET version = version + 1, data = ?, saved_at = ? WHERE key = ? AND version = ?').bind(text, now(), TS_KEY, cas).run();
  return !!(res.meta && res.meta.changes === 1);
}

async function tsMeta(env) {
  const { meta } = await tsMetaRow(env);
  return json({ version: meta.dataVersion, count: meta.count, updatedAt: meta.updatedAt, updatedBy: meta.updatedBy });
}

// Trang dữ liệu: ghép chuỗi JSON có sẵn, không parse từng dòng (tiết kiệm thời gian xử lý của gói miễn phí)
async function tsList(env, url) {
  const { meta } = await tsMetaRow(env);
  const after = Math.max(0, parseInt(url.searchParams.get('after') || '0', 10) || 0);
  const limit = Math.min(TS_PAGE, Math.max(1, parseInt(url.searchParams.get('limit') || String(TS_PAGE), 10) || TS_PAGE));
  const { results } = meta.active
    ? await env.DB.prepare('SELECT id, data FROM timesheets WHERE batch = ? AND id > ? ORDER BY id LIMIT ?').bind(meta.active, after, limit).all()
    : { results: [] };
  const next = results.length === limit ? results[results.length - 1].id : null;
  // withId=1: kèm mã dòng (_sid) — máy admin so chênh lệch rồi chỉ gửi dòng đổi khi lưu (giảm lượt ghi D1)
  const withId = url.searchParams.get('withId') === '1';
  const one = (r) => (withId ? (r.data.length > 2 ? `{"_sid":${r.id},${r.data.slice(1)}` : `{"_sid":${r.id}}`) : r.data);
  const text = `{"version":${meta.dataVersion},"count":${meta.count},"next":${next === null ? 'null' : next},"rows":[${results.map(one).join(',')}]}`;
  return new Response(text, { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

// Bước 1: xin một đợt mới (và dọn các đợt dở dang trước đó)
async function tsBegin(env, me) {
  need(me);
  for (let i = 0; i < 4; i++) {
    const { cas, meta } = await tsMetaRow(env);
    const batch = meta.next;
    if (await tsMetaWrite(env, cas, { ...meta, next: batch + 1 })) {
      await env.DB.prepare('DELETE FROM timesheets WHERE batch <> ?').bind(meta.active).run();
      return json({ ok: true, batch, version: meta.dataVersion, active: meta.active });
    }
  }
  throw new HttpError(409, 'Máy chủ đang bận, thử lại');
}

// Bước 2: ghi từng đợt nhỏ vào đợt vừa xin
async function tsRows(env, me, request) {
  need(me);
  const body = await readJson(request);
  const batch = parseInt(body.batch, 10);
  const rows = Array.isArray(body.rows) ? body.rows : [];
  const { meta } = await tsMetaRow(env);
  if (!(batch > meta.active && batch < meta.next)) throw new HttpError(400, 'Đợt tải lên không hợp lệ — bắt đầu lại');
  if (rows.length > TS_ROWS_PER_REQUEST) throw new HttpError(413, `Gửi tối đa ${TS_ROWS_PER_REQUEST} dòng mỗi lần`);
  const vals = [];
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const empId = str(r.empId, 50), date = str(r.date, 20);
    if (!empId || !date) continue;
    const { id, ...rest } = r;
    const data = JSON.stringify(rest);
    if (data.length > TS_DATA_MAX) continue;
    vals.push([batch, empId, date, str(r.wbs, 100), data]);
  }
  const parts = chunks(vals, 20).map(c => ({
    sql: `INSERT INTO timesheets (batch, emp_id, date, wbs, data) VALUES ${c.map(() => '(?, ?, ?, ?, ?)').join(', ')}`,
    params: c.flat(),
  }));
  if (parts.length) await env.DB.batch(parts.map(x => env.DB.prepare(x.sql).bind(...x.params)));
  return json({ ok: true, inserted: vals.length, skipped: rows.length - vals.length });
}

// Bước 3: chuyển đợt mới sang "đang dùng" (nguyên tử); kiểm tra đủ số dòng và chưa có ai cập nhật trước
async function tsCommit(env, me, request) {
  need(me);
  const body = await readJson(request);
  const batch = parseInt(body.batch, 10);
  const { cas, meta } = await tsMetaRow(env);
  if (!(batch > meta.active && batch < meta.next)) throw new HttpError(400, 'Đợt tải lên không hợp lệ — bắt đầu lại');
  if (Number(body.baseVersion) !== meta.dataVersion) {
    return json({ ok: false, conflict: true, version: meta.dataVersion, error: 'Máy chủ có bảng công mới hơn bản bạn đang có — Đồng bộ lại trước khi lưu.' }, 409);
  }
  if (body.mode === 'delta') return await tsCommitDelta(env, me, body, batch, cas, meta);
  let have = (await env.DB.prepare('SELECT COUNT(*) c FROM timesheets WHERE batch = ?').bind(batch).first()).c;
  const want = Number(body.count);
  if (have !== want) throw new HttpError(400, `Đợt tải lên chưa đủ dòng (có ${have}, cần ${want}) — thử lại`);
  // Dòng do duyệt bảng công đẩy sang (src khác rỗng) không bị mất khi nạp lại từ Excel: giữ lại những ngày mà bản nạp mới chưa có dòng của người đó
  if (meta.active) {
    const kept = await env.DB.prepare(`INSERT INTO timesheets (batch, emp_id, date, wbs, data, src) SELECT ?, o.emp_id, o.date, o.wbs, o.data, o.src FROM timesheets o
      WHERE o.batch = ? AND o.src <> '' AND NOT EXISTS (SELECT 1 FROM timesheets n WHERE n.batch = ? AND n.emp_id = o.emp_id AND n.date = o.date)`).bind(batch, meta.active, batch).run();
    if (kept.meta && kept.meta.changes) have += kept.meta.changes;
  }
  const next = { ...meta, active: batch, dataVersion: meta.dataVersion + 1, count: have, updatedAt: now(), updatedBy: me.name };
  if (!(await tsMetaWrite(env, cas, next))) throw new HttpError(409, 'Có người vừa cập nhật bảng công — thử lại');
  await env.DB.prepare('DELETE FROM timesheets WHERE batch <> ?').bind(batch).run();
  await audit(env, me, 'timesheets_commit', 'timesheets', String(next.dataVersion), { count: meta.count, version: meta.dataVersion }, { count: have, version: next.dataVersion });
  return json({ ok: true, version: next.dataVersion, count: have });
}

// Lưu CHÊNH LỆCH (thay cho ghi lại cả bảng — mỗi lần ghi lại cả bảng tốn ~4 lượt ghi D1 cho MỖI dòng):
// đợt `batch` chỉ chứa các dòng mới / đã sửa; body.del = mã các dòng (_sid) của bản đang dùng cần xoá.
// Một giao dịch: ghi meta có điều kiện (cas) + chuyển dòng mới sang đợt đang dùng + xoá dòng cũ + cập nhật số dòng;
// mọi câu sau câu ghi meta đều kèm điều kiện "meta đúng là của lần lưu này" (nonce) → bị người khác lưu trước thì không đổi gì.
// Dòng do duyệt bảng công đẩy sang (src khác rỗng) chỉ bị xoá khi lần lưu này có dòng mới cùng người + cùng ngày (như khi nạp cả bảng).
const TS_DELTA_MAX_DEL = 20000;
async function tsCommitDelta(env, me, body, batch, cas, meta) {
  if (!meta.active) throw new HttpError(400, 'Máy chủ chưa có bảng công — lưu cả bảng');
  const del = [...new Set((Array.isArray(body.del) ? body.del : []).map(x => parseInt(x, 10)).filter(x => x > 0))];
  if (del.length > TS_DELTA_MAX_DEL) throw new HttpError(413, 'Quá nhiều dòng cần xoá — lưu cả bảng');
  const st = await env.DB.prepare('SELECT COUNT(*) c, MIN(id) m FROM timesheets WHERE batch = ?').bind(batch).first();
  if (st.c !== Number(body.count)) throw new HttpError(400, `Đợt tải lên chưa đủ dòng (có ${st.c}, cần ${Number(body.count)}) — thử lại`);
  const minNew = st.m == null ? Number.MAX_SAFE_INTEGER : st.m;
  const nonce = crypto.randomUUID();
  const next = { ...meta, dataVersion: meta.dataVersion + 1, updatedAt: now(), updatedBy: me.name, nonce };
  const guard = "EXISTS (SELECT 1 FROM kv_store WHERE key = ? AND json_extract(data, '$.nonce') = ?)";
  const stmts = [
    env.DB.prepare('UPDATE kv_store SET version = version + 1, data = ?, saved_at = ? WHERE key = ? AND version = ?').bind(JSON.stringify(next), now(), TS_KEY, cas),
    env.DB.prepare(`UPDATE timesheets SET batch = ? WHERE batch = ? AND ${guard}`).bind(meta.active, batch, TS_KEY, nonce),
  ];
  for (const c of chunks(del, 90)) {
    stmts.push(env.DB.prepare(`DELETE FROM timesheets WHERE batch = ? AND id IN (${c.map(() => '?').join(', ')})
      AND (src = '' OR EXISTS (SELECT 1 FROM timesheets n WHERE n.batch = ? AND n.emp_id = timesheets.emp_id AND n.date = timesheets.date AND n.id >= ?)) AND ${guard}`)
      .bind(meta.active, ...c, meta.active, minNew, TS_KEY, nonce));
  }
  stmts.push(env.DB.prepare(`UPDATE kv_store SET data = json_set(data, '$.count', (SELECT COUNT(*) FROM timesheets WHERE batch = ?)) WHERE key = ? AND json_extract(data, '$.nonce') = ?`)
    .bind(meta.active, TS_KEY, nonce));
  const res = await env.DB.batch(stmts);
  if (!(res[0].meta && res[0].meta.changes === 1)) return json({ ok: false, conflict: true, version: meta.dataVersion, error: 'Có người vừa cập nhật bảng công — Đồng bộ lại trước khi lưu.' }, 409);
  const removed = res.slice(2, -1).reduce((s, r) => s + ((r.meta && r.meta.changes) || 0), 0);
  const { meta: after } = await tsMetaRow(env);
  await audit(env, me, 'timesheets_commit', 'timesheets', String(after.dataVersion), { count: meta.count, version: meta.dataVersion },
    { count: after.count, version: after.dataVersion, mode: 'delta', added: st.c, removed });
  return json({ ok: true, version: after.dataVersion, count: after.count, added: st.c, removed });
}

// ---------- sửa / xoá từng dự án (tab Dự án, Swat Hour Target) ----------
const PROJECT_SKIP = { wbs: 1, staff: 1, updatedAt: 1 };
const PROJECT_EXTRA_MAX = 20000;

// Gộp các trường gửi lên vào dự án (chưa có thì tạo mới). Chỉ ghi các trường được gửi nên không đè lên
// những trường người khác vừa đổi (vd. Swat do admin khác lưu).
async function patchProject(env, me, wbs, request) {
  need(me);
  const body = await readJson(request);
  const fields = body && typeof body.fields === 'object' && body.fields && !Array.isArray(body.fields) ? body.fields : null;
  if (!fields) throw new HttpError(400, 'Thiếu dữ liệu dự án');
  wbs = str(wbs, 100);
  if (!wbs) throw new HttpError(400, 'Thiếu mã WBS');
  const row = await env.DB.prepare('SELECT * FROM projects WHERE wbs = ?').bind(wbs).first();
  const cur = row || { project_name: '', project_number: '', product_line: '', customer: '', supervisor: '', extra: '{}' };
  let extra = {};
  try { extra = JSON.parse(cur.extra || '{}'); } catch (e) { /* bỏ qua */ }
  const col = { projectName: cur.project_name, projectNumber: cur.project_number, productLine: cur.product_line, customer: cur.customer, supervisor: cur.supervisor };
  const changed = {};
  for (const [k, v] of Object.entries(fields)) {
    if (PROJECT_SKIP[k] || v === undefined) continue;
    if (k in col) { col[k] = str(v, k === 'projectName' || k === 'customer' ? 300 : 200); changed[k] = col[k]; }
    else { extra[k] = v; changed[k] = v; }
  }
  const extraText = JSON.stringify(extra);
  if (extraText.length > PROJECT_EXTRA_MAX) throw new HttpError(413, 'Dữ liệu dự án quá lớn');
  // không đổi gì (vd. duyệt lại Standard Hour với cùng thông số) → không ghi, không ghi nhật ký
  if (row && extraText === (row.extra || '{}') && col.projectName === row.project_name && col.projectNumber === row.project_number
    && col.productLine === row.product_line && col.customer === row.customer && col.supervisor === row.supervisor) return json({ ok: true, wbs, updatedAt: row.updated_at, created: false, unchanged: true });
  const t = now();
  await env.DB.prepare('INSERT INTO projects (wbs, project_name, project_number, product_line, customer, supervisor, extra, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(wbs) DO UPDATE SET project_name = excluded.project_name, project_number = excluded.project_number, product_line = excluded.product_line, ' +
    'customer = excluded.customer, supervisor = excluded.supervisor, extra = excluded.extra, updated_at = excluded.updated_at')
    .bind(wbs, col.projectName, col.projectNumber, col.productLine, col.customer, col.supervisor, extraText, t).run();
  await audit(env, me, row ? 'project_update' : 'project_create', 'project', wbs, undefined, changed);
  return json({ ok: true, wbs, updatedAt: t, created: !row });
}

async function deleteProjects(env, me, request) {
  need(me);
  const body = await readJson(request);
  const list = (Array.isArray(body.wbs) ? body.wbs : []).map(w => str(w, 100)).filter(Boolean);
  if (!list.length) throw new HttpError(400, 'Chưa chọn dự án nào');
  if (list.length > 60) throw new HttpError(413, 'Xoá tối đa 60 dự án mỗi lần');
  const ph = list.map(() => '?').join(', ');
  const have = (await env.DB.prepare(`SELECT wbs FROM projects WHERE wbs IN (${ph})`).bind(...list).all()).results.map(r => r.wbs);
  if (have.length) await env.DB.prepare(`DELETE FROM projects WHERE wbs IN (${ph})`).bind(...list).run();
  await audit(env, me, 'project_delete', 'project', have.join(',').slice(0, 400), { wbs: have }, undefined);
  return json({ ok: true, deleted: have.length });
}

// ---------- Timesheet cá nhân: bảng công theo kỳ lương của chính người đăng nhập ----------
const LOCKED_STATUSES = ['submitted', 'sitesup_ok', 'pm_ok', 'approved'];

function needOwnEmp(me) {
  if (!me.empId) throw new HttpError(403, 'Tài khoản chưa gắn với nhân viên nào nên chưa có Timesheet cá nhân');
  return me.empId;
}
function periodParam(p) {
  if (!PERIOD_RE.test(p)) throw new HttpError(400, 'Kỳ lương không hợp lệ (dạng YYYY-MM)');
  return p;
}

async function listMyDocs(env, me, url) {
  const emp = needOwnEmp(me);
  // các kỳ trước: dựng bảng công (chỉ xem, "đã duyệt") từ dữ liệu Theo dõi giờ công nếu người này chưa có — lỗi ở đây không chặn việc mở Timesheet.
  // Chỉ chạy khi trình duyệt xin (?history=1 — lần đồng bộ đầu tiên mỗi ngày), KHÔNG mỗi lượt đồng bộ 90 giây (tốn hạn mức đọc D1).
  if (url && url.searchParams.get('history') === '1') {
    try { await backfillMine(H, env, emp, new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)); }   // ngày theo giờ Việt Nam
    catch (e) { console.error('backfillMine', e); }
  }
  const { results } = await env.DB.prepare('SELECT period, version, status, entry_count, saved_at, submitted_at, sitesup_by, sitesup_at, pm_by, pm_at, note, admin_by, admin_at, admin_note, amend_rev, amend_from, amend_note, amend_at, amend_since FROM ts_docs WHERE emp_id = ? ORDER BY period DESC LIMIT 36').bind(emp).all();
  return json({ docs: results.map(r => ({ period: r.period, version: r.version, status: r.status, entries: r.entry_count, savedAt: r.saved_at,
    submittedAt: r.submitted_at, sitesupBy: r.sitesup_by, sitesupAt: r.sitesup_at, pmBy: r.pm_by, pmAt: r.pm_at, note: r.note,
    adminBy: r.admin_by, adminAt: r.admin_at, adminNote: r.admin_note,
    amendRev: r.amend_rev || 0, amendFrom: r.amend_from || '', amendNote: r.amend_note || '', amendAt: r.amend_at || '', amendSince: r.amend_since || '' })) });
}

async function getMyDoc(env, me, period, url) {
  const emp = needOwnEmp(me);
  periodParam(period);
  const r = await env.DB.prepare('SELECT version, status, data, saved_at, amend_from, base_data FROM ts_docs WHERE emp_id = ? AND period = ?').bind(emp, period).first();
  // chuỗi JSON có sẵn được ghép thẳng vào kết quả (không parse lại) để tiết kiệm thời gian xử lý của gói miễn phí
  // ?base=1 khi đang điều chỉnh: kèm bản lúc bắt đầu điều chỉnh (Timesheet hiện các ngày thay đổi trước khi nộp lại)
  const base = r && r.amend_from && r.base_data && url && url.searchParams.get('base') === '1' ? r.base_data : 'null';
  const text = `{"period":${JSON.stringify(period)},"version":${r ? r.version : 0},"status":${JSON.stringify(r ? r.status : 'draft')},"savedAt":${JSON.stringify(r ? r.saved_at : '')},"base":${base},"data":${r ? r.data : '{"entries":[],"deleted":{}}'}}`;
  return new Response(text, { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

async function putMyDoc(env, me, period, request) {
  const emp = needOwnEmp(me);
  periodParam(period);
  const body = await readJson(request);
  const base = Number(body.baseVersion);
  if (!Number.isInteger(base) || base < 0) throw new HttpError(400, 'Thiếu số phiên bản (baseVersion)');
  let checked;
  try { checked = checkDoc(period, body.data); } catch (e) { throw new HttpError(400, e.message); }
  const t = now();
  let changed;
  if (base === 0) {
    const r = await env.DB.prepare("INSERT INTO ts_docs (emp_id, period, version, status, data, entry_count, saved_at, saved_by) VALUES (?, ?, 1, 'draft', ?, ?, ?, ?) ON CONFLICT(emp_id, period) DO NOTHING")
      .bind(emp, period, checked.data, checked.count, t, me.email).run();
    changed = r.meta && r.meta.changes === 1;
  } else {
    // đang điều chỉnh: không được sửa các ngày trước ngày nộp
    const am = await env.DB.prepare('SELECT amend_from, amend_since, base_data FROM ts_docs WHERE emp_id = ? AND period = ?').bind(emp, period).first();
    if (am && am.amend_from && am.amend_since && am.base_data) {
      const bad = amendLockedChanges(JSON.parse(am.base_data), JSON.parse(checked.data), am.amend_since);
      if (bad.length) throw new HttpError(400, amendLockedMsg(bad, am.amend_since));
    }
    const r = await env.DB.prepare(`UPDATE ts_docs SET version = version + 1, data = ?, entry_count = ?, saved_at = ?, saved_by = ? WHERE emp_id = ? AND period = ? AND version = ? AND status NOT IN ('submitted', 'sitesup_ok', 'pm_ok', 'approved')`)
      .bind(checked.data, checked.count, t, me.email, emp, period, base).run();
    changed = r.meta && r.meta.changes === 1;
  }
  if (changed) return json({ ok: true, period, version: base + 1, savedAt: t });
  // không ghi được: đã bị khoá (đã nộp / duyệt) hoặc có bản mới hơn → trả bản hiện có để máy khách gộp
  const cur = await env.DB.prepare('SELECT version, status, data, saved_at FROM ts_docs WHERE emp_id = ? AND period = ?').bind(emp, period).first();
  if (cur && LOCKED_STATUSES.includes(cur.status)) {
    return json({ ok: false, locked: true, version: cur.version, status: cur.status, error: 'Bảng công kỳ này đã nộp / đã duyệt nên không sửa được nữa' }, 423);
  }
  return new Response(`{"ok":false,"conflict":true,"version":${cur ? cur.version : 0},"status":${JSON.stringify(cur ? cur.status : 'draft')},"data":${cur ? cur.data : '{"entries":[],"deleted":{}}'}}`,
    { status: 409, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

// Gợi ý người nhận khi fitter tự gửi mail báo cáo thi công: Site Sup / Quản lý dự án được gán cho các dự án (WBS) của ngày đó.
// Chỉ trả tên + email của đúng những người phụ trách các dự án mà người hỏi đang làm.
async function tsApprovers(env, me, url) {
  needOwnEmp(me);
  const list = [...new Set((url.searchParams.get('wbs') || '').split(',').map(x => str(x, 100)).filter(Boolean))].slice(0, 20);
  if (!list.length) return json({ approvers: [] });
  const { results } = await env.DB.prepare(`SELECT s.wbs, s.role, e.emp_id, e.full_name, e.email FROM project_staff s JOIN employees e ON e.emp_id = s.emp_id
    WHERE s.wbs IN (${list.map(() => '?').join(', ')}) AND e.active = 1 AND e.email <> '' ORDER BY s.role, e.full_name`).bind(...list).all();
  const by = new Map();
  for (const r of results) {
    const k = r.emp_id + '|' + r.role;
    // demo: thư do fitter tự gửi cũng về email của người đang thử (không gửi tới địa chỉ giả)
    if (!by.has(k)) by.set(k, { empId: r.emp_id, name: r.full_name, email: env.DEMO ? env.DEMO_EMAIL : r.email, level: r.role, wbs: [] });
    by.get(k).wbs.push(r.wbs);
  }
  return json({ approvers: [...by.values()] });
}

// ---------- nộp bảng công và duyệt hai cấp (Site Sup → Quản lý dự án) ----------
const DOC_JSON_HEAD = (r) => `{"ok":true,"period":${JSON.stringify(r.period)},"emp":${JSON.stringify(r.emp_id)},"version":${r.version},"status":${JSON.stringify(r.status)}`;

// Chủ bảng công bấm Nộp: máy khách đã gửi bản mới nhất (có phân loại giờ bd cho từng dòng) rồi gọi đây với đúng số phiên bản.
async function submitMyDoc(env, me, period, request) {
  const emp = needOwnEmp(me);
  periodParam(period);
  const body = await readJson(request);
  const row = await env.DB.prepare('SELECT version, status, data, amend_from, amend_since, base_data FROM ts_docs WHERE emp_id = ? AND period = ?').bind(emp, period).first();
  if (!row) throw new HttpError(404, 'Chưa có bảng công kỳ này');
  if (!['draft', 'rejected'].includes(row.status)) throw new HttpError(409, 'Bảng công kỳ này đã nộp rồi');
  if (row.amend_from && row.amend_since && row.base_data) {
    const bad = amendLockedChanges(JSON.parse(row.base_data), JSON.parse(row.data), row.amend_since);
    if (bad.length) throw new HttpError(400, amendLockedMsg(bad, row.amend_since));
  }
  if (Number(body.baseVersion) !== row.version) return json({ ok: false, conflict: true, version: row.version, error: 'Bản trên máy chủ khác bản bạn đang xem — chờ đồng bộ xong rồi nộp lại' }, 409);
  const data = JSON.parse(row.data);
  const entries = Array.isArray(data.entries) ? data.entries : [];
  const bad = checkSubmitEntries(entries);
  if (bad) throw new HttpError(400, bad);
  const allow = checkSubmitAllowance(period, data);
  if (allow.error) throw new HttpError(400, allow.error);
  return json(await startApproval(env, me, emp, period, row.version, entries, allow.computed.totals.amount));
}

// Bắt đầu quy trình duyệt cho bảng công đã kiểm tra hợp lệ (nộp bởi chính chủ hoặc nhập hộ qua /api/ts/import): đặt trạng thái, ghi dự án,
// bỏ qua cấp không có dự án, gửi thư cho cấp đầu tiên và thư nhắc OT chưa duyệt.
async function startApproval(env, me, emp, period, version, entries, allowanceAmount = 0) {
  // Giám sát (Site Sup / QLDA): bảng công chỉ gồm giờ tăng ca, nộp thẳng Quản lý dự án
  const owner = await env.DB.prepare('SELECT * FROM employees WHERE emp_id = ?').bind(emp).first();
  const lead = isLead(env, owner);
  if (lead) {
    const normal = [...new Set(entries.filter(e => !['6010', '6020', '6090'].includes(String(e.activityCode)) && (+(e.bd || {}).NORMAL || 0) > 0.01).map(e => e.date))];
    if (normal.length) throw new HttpError(400, `Giám sát chỉ nộp giờ tăng ca — xoá các dòng giờ thường (ngày ${normal.slice(0, 6).map(d => d.slice(8, 10) + '/' + d.slice(5, 7)).join(', ')}${normal.length > 6 ? '…' : ''})`);
  }
  // tăng ca chưa duyệt KHÔNG chặn nộp: vẫn nhận, thư nhắc người nộp và người duyệt
  const otPending = await otPendingDays(env, emp, period, entries);
  const { known: wbsList, unknown: unlisted } = await projectWbsKnown(env, entries);       // chỉ dự án CÓ TRONG DANH SÁCH (hoạt động ngoài dự án và dự án fitter tự gõ chưa có trong danh sách do Admin / Admin dự án xử lý)
  const t = now();
  const status = lead ? 'sitesup_ok' : 'submitted';     // giám sát: bỏ cấp Site Sup, chờ Quản lý dự án (sitesup_by để trống)
  const r = await env.DB.prepare(`UPDATE ts_docs SET status = ?, submitted_at = ?, sitesup_by = '', sitesup_at = '', pm_by = '', pm_at = '', note = '' WHERE emp_id = ? AND period = ? AND version = ? AND status IN ('draft', 'rejected')`)
    .bind(status, t, emp, period, version).run();
  if (!(r.meta && r.meta.changes === 1)) throw new HttpError(409, 'Bảng công vừa thay đổi — thử lại');
  const stmts = [env.DB.prepare('DELETE FROM ts_doc_wbs WHERE emp_id = ? AND period = ?').bind(emp, period)];
  if (wbsList.length) stmts.push(env.DB.prepare(`INSERT INTO ts_doc_wbs (emp_id, period, wbs) VALUES ${wbsList.map(() => '(?, ?, ?)').join(', ')}`).bind(...wbsList.flatMap(w => [emp, period, w])));
  await env.DB.batch(stmts);
  await audit(env, me, 'ts_submit', 'ts_doc', `${emp}:${period}`, undefined, { entries: entries.length, wbs: wbsList.length, allowance: allowanceAmount, by: me.email, otPending: otPending.length, direct: lead, unlisted });
  // cấp nào không có dự án cần duyệt thì tự bỏ qua (bảng công chỉ có hoạt động ngoài dự án → thẳng Admin)
  const s = await settle(H, env, emp, period, status, wbsList);
  if (s.moved.length) await notifyStage(env, s.status, { empId: emp, period, wbs: wbsList, by: '' });
  else await notifyEvent(env, lead ? 'submitted_direct' : 'submitted', { empId: emp, period, wbs: wbsList, otPending });
  if (otPending.length) await notifyEvent(env, 'ot_unapproved', { empId: emp, period, wbs: wbsList, otPending, lead });
  await env.DB.prepare('DELETE FROM ts_approvals WHERE emp_id = ? AND period = ?').bind(emp, period).run();
  return { ok: true, status: s.status, version, submittedAt: t, otPending: otPending.length };
}


// ---------- điều chỉnh bảng công đã nộp / đã duyệt ----------
// Ví dụ: nộp ngày 9, chấm trước 10 → 15; thực tế sau đó khác → fitter bấm "Điều chỉnh bảng công" (ghi lý do), bảng công mở lại để sửa,
// rồi nộp lại qua đủ Site Sup → QLDA → Admin. Bảng Theo dõi giờ công giữ bản đã duyệt cho tới khi bản điều chỉnh được duyệt xong
// (pushApprovedRows thay các dòng của người đó trong kỳ). base_data giữ bản lúc bắt đầu điều chỉnh để người duyệt thấy ngày nào đổi
// và để huỷ điều chỉnh (khôi phục). Điều chỉnh tiếp khi bản điều chỉnh đang chờ duyệt: giữ nguyên bản gốc + lần điều chỉnh.
const AMENDABLE = ['submitted', 'sitesup_ok', 'pm_ok', 'approved'];
async function amendMyDoc(env, me, period, request) {
  const emp = needOwnEmp(me);
  periodParam(period);
  const body = await readJson(request);
  const reason = str(body.reason, 500);
  if (reason.length < 3) throw new HttpError(400, 'Cần ghi lý do điều chỉnh (vd. "Ngày 12–15 thực tế làm dự án khác")');
  const row = await env.DB.prepare('SELECT status, amend_from, amend_since, submitted_at FROM ts_docs WHERE emp_id = ? AND period = ?').bind(emp, period).first();
  if (!row) throw new HttpError(404, 'Chưa có bảng công kỳ này');
  if (!AMENDABLE.includes(row.status)) throw new HttpError(409, 'Bảng công kỳ này chưa nộp (đang sửa được) — không cần điều chỉnh');
  const t = now(), first = !row.amend_from;
  // chỉ điều chỉnh các ngày đã chấm TRƯỚC: từ ngày nộp (lần nộp đầu, giờ VN) đến hết kỳ (ngày 15)
  const { start, end } = periodRange(period);
  let since = row.amend_since || vnDate(row.submitted_at) || start;
  if (since < start) since = start;   // amend_since giữ ngày nộp LẦN ĐẦU qua mọi lần điều chỉnh
  if (since > end) throw new HttpError(409, `Bảng công này nộp sau khi hết kỳ (ngày ${end.slice(8, 10)}/${end.slice(5, 7)}) nên không có ngày chấm trước để điều chỉnh — cần sửa thì liên hệ giám sát / Admin`);
  const r = await env.DB.prepare(`UPDATE ts_docs SET status = 'draft', submitted_at = '', note = '',
      amend_rev = amend_rev + ?, amend_from = CASE WHEN amend_from = '' THEN ? ELSE amend_from END,
      base_data = CASE WHEN amend_from = '' THEN data ELSE base_data END, amend_since = ?, amend_note = ?, amend_at = ?, amend_by = ?
    WHERE emp_id = ? AND period = ? AND status = ?`).bind(first ? 1 : 0, row.status, since, reason, t, me.email, emp, period, row.status).run();
  if (!(r.meta && r.meta.changes === 1)) throw new HttpError(409, 'Bảng công vừa thay đổi — tải lại trang rồi thử lại');
  await env.DB.prepare('DELETE FROM ts_approvals WHERE emp_id = ? AND period = ?').bind(emp, period).run();
  const after = await env.DB.prepare('SELECT amend_rev, amend_from, amend_since FROM ts_docs WHERE emp_id = ? AND period = ?').bind(emp, period).first();
  await audit(env, me, 'ts_amend', 'ts_doc', `${emp}:${period}`, { status: row.status }, { reason, rev: after.amend_rev, from: after.amend_from, since: after.amend_since });
  return json({ ok: true, status: 'draft', amendRev: after.amend_rev, amendFrom: after.amend_from, amendNote: reason, amendAt: t, amendSince: after.amend_since });
}

// Huỷ điều chỉnh (chưa nộp lại, hoặc bản điều chỉnh bị trả lại): khôi phục bản lúc bắt đầu điều chỉnh;
// bắt đầu từ bản đã duyệt xong → trở lại "Đã duyệt xong" (dữ liệu Theo dõi giờ công vẫn là bản đó), còn lại → "Đang chấm".
async function cancelAmendMyDoc(env, me, period) {
  const emp = needOwnEmp(me);
  periodParam(period);
  const row = await env.DB.prepare('SELECT version, status, amend_from, base_data FROM ts_docs WHERE emp_id = ? AND period = ?').bind(emp, period).first();
  if (!row || !row.amend_from || !row.base_data) throw new HttpError(409, 'Bảng công kỳ này không đang điều chỉnh');
  if (!['draft', 'rejected'].includes(row.status)) throw new HttpError(409, 'Bản điều chỉnh đang chờ duyệt — thu hồi hoặc nhờ người duyệt trả lại trước khi huỷ');
  let base;
  try { base = JSON.parse(row.base_data); } catch (e) { throw new HttpError(500, 'Bản gốc bị lỗi — liên hệ quản trị viên'); }
  const entries = Array.isArray(base.entries) ? base.entries : [];
  const status = row.amend_from === 'approved' ? 'approved' : 'draft';
  const t = now();
  const r = await env.DB.prepare(`UPDATE ts_docs SET version = version + 1, status = ?, data = base_data, entry_count = ?, saved_at = ?, saved_by = ?, note = '',
      amend_rev = MAX(amend_rev - 1, 0), amend_from = '', base_data = '', amend_note = '', amend_at = '', amend_by = ''
    WHERE emp_id = ? AND period = ? AND version = ? AND status = ?`).bind(status, entries.length, t, me.email, emp, period, row.version, row.status).run();
  if (!(r.meta && r.meta.changes === 1)) throw new HttpError(409, 'Bảng công vừa thay đổi — tải lại trang rồi thử lại');
  if (status === 'approved') {   // dự án của bản đã duyệt (bản điều chỉnh có thể đã ghi đè khi nộp lại)
    const { known } = await projectWbsKnown(env, entries);
    const stmts = [env.DB.prepare('DELETE FROM ts_doc_wbs WHERE emp_id = ? AND period = ?').bind(emp, period)];
    if (known.length) stmts.push(env.DB.prepare(`INSERT INTO ts_doc_wbs (emp_id, period, wbs) VALUES ${known.map(() => '(?, ?, ?)').join(', ')}`).bind(...known.flatMap(w => [emp, period, w])));
    await env.DB.batch(stmts);
  }
  await env.DB.prepare('DELETE FROM ts_approvals WHERE emp_id = ? AND period = ?').bind(emp, period).run();
  await audit(env, me, 'ts_amend_cancel', 'ts_doc', `${emp}:${period}`, { status: row.status }, { status });
  return json({ ok: true, status, version: row.version + 1 });
}

async function withdrawMyDoc(env, me, period) {
  const emp = needOwnEmp(me);
  periodParam(period);
  await withdrawDoc(H, env, emp, period);        // chỉ khi chưa ai duyệt (kể cả duyệt một phần)
  await audit(env, me, 'ts_withdraw', 'ts_doc', `${emp}:${period}`);
  return json({ ok: true, status: 'draft' });
}

const supKey = (s) => keyOf(s);

// Người này có quyền duyệt bảng công đang chờ ở cấp `level` không?
// Site Sup: được gán cho một dự án (WBS) trong bảng công, hoặc là "Quản lý trực tiếp" của người nộp. Quản lý dự án: được gán QLDA cho một dự án trong bảng công.
// Admin duyệt thay được mọi bảng công. (Một bảng công nhiều dự án: chỉ cần một người phụ trách ở cấp đó duyệt.)
function canAct(me, level, wbsList, staff, ownerSupervisor) {
  if (me.isAdmin) return true;
  if (!me.empId) return false;
  if (level === 'sitesup' && !me.roles.includes('sitesup')) return false;
  if (level === 'pm' && !me.roles.includes('pm')) return false;
  if (wbsList.some(w => (staff.get(w) || { sitesup: [], pm: [] })[level].includes(me.empId))) return true;
  // "Quản lý trực tiếp": Site Sup của fitter (cấp Site Sup); QLDA của giám sát (cấp QLDA — bảng công / OT của giám sát)
  return !!ownerSupervisor && supKey(ownerSupervisor) === supKey(me.name);
}

// Đẩy các dòng của bảng công đã duyệt xong sang bảng Theo dõi giờ công (thay các dòng cũ của người đó trong cùng kỳ)
async function pushApprovedRows(env, me, row, period) {
  const emp = row.emp_id;
  const entries = (JSON.parse(row.data).entries || []);
  const owner = { empId: emp, name: row.full_name, isSiteSup: rolesFromPosition(row.position).includes('sitesup'), isFitter: rolesFromPosition(row.position).length === 0 };
  const rows = entries.map(e => trackingRow(e, owner, period)).filter(r => JSON.stringify(r).length <= TS_DATA_MAX);
  const { start, end } = periodRange(period);
  const src = `ts:${emp}:${period}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { cas, meta } = await tsMetaRow(env);
    const batch = meta.active || meta.next;
    // chỉ xoá / thêm dòng KHÁC với dòng đang có của người này trong kỳ (duyệt lại bản giống hệt → không ghi gì)
    const { results: cur } = await env.DB.prepare('SELECT id, data, src FROM timesheets WHERE batch = ? AND emp_id = ? AND date >= ? AND date <= ?').bind(batch, emp, start, end).all();
    const pool = new Map();
    for (const r of cur) { const k = r.src + '\u0001' + r.data; if (!pool.has(k)) pool.set(k, []); pool.get(k).push(r.id); }
    const add = [];
    for (const r of rows) { const k = src + '\u0001' + JSON.stringify(r), ids = pool.get(k); if (ids && ids.length) ids.pop(); else add.push(r); }
    const drop = [...pool.values()].flat();
    if (!add.length && !drop.length && meta.active === batch) return rows.length;
    const parts = [
      ...chunks(drop, 90).map(c => env.DB.prepare(`DELETE FROM timesheets WHERE batch = ? AND id IN (${c.map(() => '?').join(', ')})`).bind(batch, ...c)),
      ...chunks(add, 14).map(c => env.DB.prepare(`INSERT INTO timesheets (batch, emp_id, date, wbs, data, src) VALUES ${c.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')}`)
        .bind(...c.flatMap(r => [batch, emp, r.date, r.wbs, JSON.stringify(r), src]))),
    ];
    const res = await env.DB.batch(parts);
    // số dòng = số cũ − dòng vừa xoá + dòng vừa thêm (không COUNT(*) cả bảng: mỗi lần duyệt đọc hàng chục nghìn dòng, tốn hạn mức D1)
    const removed = res.slice(0, chunks(drop, 90).length).reduce((s, r) => s + ((r.meta && r.meta.changes) || 0), 0);
    const count = meta.active === batch && Number.isFinite(meta.count)
      ? Math.max(0, meta.count - removed + add.length)
      : (await env.DB.prepare('SELECT COUNT(*) c FROM timesheets WHERE batch = ?').bind(batch).first()).c;
    const next = { ...meta, active: batch, next: Math.max(meta.next, batch + 1), dataVersion: meta.dataVersion + 1, count, updatedAt: now(), updatedBy: 'Duyệt bảng công · ' + me.name };
    if (await tsMetaWrite(env, cas, next)) return rows.length;
  }
  throw new HttpError(409, 'Máy chủ đang bận khi cập nhật bảng Theo dõi giờ công — bấm Duyệt lại');
}

// Admin gửi thử một thư để kiểm tra cấu hình Brevo (gửi tới chính admin, hoặc một địa chỉ chỉ định)
async function sendTestMail(env, me, request) {
  need(me);
  const body = await readJson(request);
  const to = str(body.to, 200) || me.email;
  if (!mailConfigured(env)) return json({ ok: false, configured: false, error: 'Chưa cấu hình gửi email: cần BREVO_API_KEY và MAIL_FROM (GitHub → Settings → Secrets and variables → Actions) rồi chạy lại triển khai.' }, 200);
  const r = await sendMail(env, { to: [{ email: to }], subject: `[Thử] Email từ ${senderName(env)}`, html: layout('Gửi thử thành công', `<p>Đây là thư thử do ${me.name} bấm trong trang Tài khoản. Nếu bạn đọc được thư này, cấu hình gửi email đã đúng.</p>`) });
  await audit(env, me, 'mail_test', 'mail', to, undefined, { ok: r.ok });
  return json({ ok: r.ok, configured: true, to, error: r.error || '' });
}

async function patchEmployee(env, me, empId, request) {
  need(me);
  const body = await readJson(request);
  const emp = await env.DB.prepare('SELECT * FROM employees WHERE emp_id = ?').bind(empId).first();
  if (!emp) throw new HttpError(404, 'Không có nhân viên ' + empId);
  const isSelf = me.empId && me.empId === empId;
  const next = { email: emp.email, role_override: emp.role_override, extra_role: emp.extra_role || '', active: emp.active };
  if ('email' in body) {
    const e = str(body.email, 200).toLowerCase();
    if (e && !EMAIL_RE.test(e)) throw new HttpError(400, 'Email không hợp lệ');
    next.email = e || null;
  }
  if ('roleOverride' in body) {
    const r = str(body.roleOverride, 20);
    if (!['', 'admin', 'projadmin', 'pm', 'sitesup', 'staff'].includes(r)) throw new HttpError(400, 'Vai trò không hợp lệ');
    // (tương thích) 'projadmin' chọn như vai trò chính → chuyển thành vai trò kiêm nhiệm
    if (r === 'projadmin') { next.role_override = ''; if (!parseExtraRoles(next.extra_role).includes('projadmin')) next.extra_role = [...parseExtraRoles(next.extra_role), 'projadmin'].join(','); }
    else next.role_override = r;
  }
  if ('extraRoles' in body) {
    if (!Array.isArray(body.extraRoles) || body.extraRoles.some(x => !ALL_ROLES.includes(x))) throw new HttpError(400, 'Vai trò kiêm nhiệm không hợp lệ');
    next.extra_role = ALL_ROLES.filter(r => body.extraRoles.includes(r)).join(',');
  }
  if ('active' in body) next.active = body.active ? 1 : 0;
  if (isSelf && (next.active !== emp.active || next.role_override !== emp.role_override || next.extra_role !== (emp.extra_role || '') || next.email !== emp.email)) {
    throw new HttpError(400, 'Không tự đổi email, vai trò hay khoá tài khoản của chính mình — nhờ admin khác làm');
  }
  try {
    await env.DB.prepare('UPDATE employees SET email = ?, role_override = ?, extra_role = ?, active = ?, updated_at = ? WHERE emp_id = ?')
      .bind(next.email, next.role_override, next.extra_role, next.active, now(), empId).run();
  } catch (e) {
    if (/UNIQUE/i.test(String(e && e.message))) throw new HttpError(409, 'Email này đã gắn cho nhân viên khác');
    throw e;
  }
  const pick = (r) => ({ email: r.email || '', roleOverride: r.role_override, extraRoles: parseExtraRoles(r.extra_role), active: !!r.active });
  await audit(env, me, 'update', 'employee', empId, pick(emp), pick(next));
  const after = await env.DB.prepare('SELECT * FROM employees WHERE emp_id = ?').bind(empId).first();
  return json({ ok: true, employee: employeeOut(after, true) });
}

async function listAudit(env, me, url) {
  need(me);
  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit') || '100', 10) || 100));
  const { results } = await env.DB.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?').bind(limit).all();
  return json({ entries: results.map(r => ({ ...r, before: r.before ? JSON.parse(r.before) : null, after: r.after ? JSON.parse(r.after) : null })) });
}

// các hàm dùng chung truyền cho server/otleave.mjs (duyệt tăng ca, đơn nghỉ)
const H = { startApproval, HttpError, json, need, needOwnEmp, audit, projectStaff, canAct, readJson, str, now, LOCKED_STATUSES, periodParam, pushApprovedRows, mailConfigured, tsMetaRow };

// ---------- điểm vào ----------

// opts.getKeys: chỉ dùng khi kiểm thử (thay nguồn khoá công khai của Access)
export async function handle(request, env, opts = {}) {
  const resp = await handleApi(request, env, opts);
  // cookie demo còn sót mà trình duyệt không ở chế độ demo: xoá đi cho sạch (dữ liệu thật vẫn được phục vụ bình thường)
  if (staleDemoCookie(request) && !resp.headers.has('set-cookie')) {
    try { resp.headers.append('set-cookie', demoCookie(false)); } catch (e) { /* header không sửa được: bỏ qua */ }
  }
  return resp;
}

async function handleApi(request, env, opts = {}) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method.toUpperCase();
  env = { ...env, APP_URL: env.APP_URL || url.origin };   // địa chỉ dùng trong liên kết của thư
  try {
    if (path === '/api/health' && method === 'GET') {
      // Chỉ báo "có / chưa có" từng giá trị cấu hình, không bao giờ trả giá trị — để biết thiếu gì khi cấu hình đăng nhập
      const hasTeam = !!teamHost(env.ACCESS_TEAM_DOMAIN), hasAud = !!String(env.ACCESS_AUD || '').trim();
      return json({
        ok: true, db: !!env.DB, auth: hasTeam && hasAud,
        config: { ACCESS_TEAM_DOMAIN: hasTeam, ACCESS_AUD: hasAud, ADMIN_EMAILS: adminEmails(env).length > 0, MAIL: mailConfigured(env) },
      });
    }
    if (!env.DB) throw new HttpError(503, 'Máy chủ chưa gắn cơ sở dữ liệu');
    const realEnv = env;
    // Chế độ demo: cookie ts_demo=1 → toàn bộ yêu cầu dùng cơ sở dữ liệu demo riêng, không đụng dữ liệu thật
    const demo = !!(env.DB_DEMO && demoRequested(request));
    if (demo) env = demoEnv(env);   // email người thử gắn vào sau khi xác thực (thư demo chỉ gửi về email này)
    // Yêu cầu ghi bắt buộc là JSON: trang lạ không gửi được kiểu này sang (chặn giả mạo yêu cầu)
    if (method !== 'GET' && method !== 'HEAD') {
      const ct = (request.headers.get('content-type') || '').toLowerCase();
      if (!ct.startsWith('application/json')) throw new HttpError(415, 'Yêu cầu ghi phải gửi dạng JSON');
    }
    const { email } = await verifyAccessJwt(request.headers.get('cf-access-jwt-assertion'), env, opts);
    if (demo) env.DEMO_EMAIL = String(email || '').toLowerCase();
    if (path === '/api/demo/status' && method === 'GET') return json({ available: !!realEnv.DB_DEMO, active: demo });
    if (path === '/api/demo/start' && method === 'POST') return await demoStart(realEnv, email, request);
    if (path === '/api/demo/stop' && method === 'POST') return json({ ok: true }, 200, { 'set-cookie': demoCookie(false) });
    if (path === '/api/demo/role' && method === 'POST') {
      if (!demo) throw new HttpError(400, 'Chỉ dùng trong chế độ demo');
      return await demoRole(env, email, request);
    }
    // Đăng ký tài khoản: dùng được khi email CHƯA gắn với nhân viên nào (chưa qua loadMe) — luôn trên dữ liệu thật
    if (path === '/api/register' && method === 'GET') return await registerGet(realEnv, email);
    if (path === '/api/register' && method === 'POST') return await registerPost(realEnv, email, request);
    const me = await loadMe(env, email);
    if (path === '/api/demo/reset' && method === 'POST') {       // dựng lại dữ liệu mẫu (giữ nguyên vai trò đang thử)
      if (!demo) throw new HttpError(400, 'Chỉ dùng trong chế độ demo');
      const role = me.isAdmin ? 'admin' : me.roles.includes('pm') ? 'pm' : me.roles.includes('sitesup') ? 'sitesup' : 'staff';
      const r = await seedDemo(env.DB, { email }, role);
      await env.DB.prepare("INSERT INTO kv_store (key, version, data, saved_at, saved_by) VALUES ('demo_seeded', 1, '', ?, '') ON CONFLICT(key) DO UPDATE SET saved_at = excluded.saved_at").bind(now()).run();
      return json({ ok: true, role, ...r });
    }

    let m;
    if (path === '/api/me' && method === 'GET') return await getMe(env, me);
    if (path === '/api/employees' && method === 'GET') return await listEmployees(env, me);
    if (path === '/api/projects' && method === 'GET') return await listProjects(env);
    if ((m = path.match(/^\/api\/projects\/([^/]+)\/staff$/)) && method === 'PUT') return await putProjectStaff(env, me, decodeURIComponent(m[1]), request);
    if (path === '/api/admin/import' && method === 'POST') return await importData(env, me, request);
    if (path === '/api/admin/emails' && method === 'POST') return await setEmails(env, me, request);
    if (path === '/api/admin/registrations' && method === 'GET') return await regList(env, me, url);
    if ((m = path.match(/^\/api\/admin\/registrations\/(\d+)\/(approve|reject)$/)) && method === 'POST') return await regDecide(env, me, Number(m[1]), m[2], request);
    if (path === '/api/timesheets/meta' && method === 'GET') return await tsMeta(env);
    if (path === '/api/timesheets' && method === 'GET') return await tsList(env, url);
    if (path === '/api/admin/timesheets/begin' && method === 'POST') return await tsBegin(env, me);
    if (path === '/api/admin/timesheets/rows' && method === 'POST') return await tsRows(env, me, request);
    if (path === '/api/admin/timesheets/commit' && method === 'POST') return await tsCommit(env, me, request);
    if (path === '/api/pm-store' && method === 'POST') return await pmStore(env, me, request);
    if (path === '/api/projects/pm' && method === 'POST') return await assignPmAll(env, me, request);
    if (path === '/api/supervisors' && method === 'GET') return await listSupervisors(env, me);
    if (path === '/api/supervisors/apply' && method === 'POST') return await applySupervisors(env, me, request);
    if ((m = path.match(/^\/api\/admin\/employees\/([^/]+)$/)) && method === 'PATCH') return await patchEmployee(env, me, decodeURIComponent(m[1]), request);
    if ((m = path.match(/^\/api\/admin\/projects\/([^/]+)$/)) && method === 'PATCH') return await patchProject(env, me, decodeURIComponent(m[1]), request);
    if (path === '/api/admin/projects/delete' && method === 'POST') return await deleteProjects(env, me, request);
    if (path === '/api/ts/docs' && method === 'GET') return await listMyDocs(env, me, url);
    if ((m = path.match(/^\/api\/ts\/docs\/([^/]+)$/)) && method === 'GET') return await getMyDoc(env, me, decodeURIComponent(m[1]), url);
    if ((m = path.match(/^\/api\/ts\/docs\/([^/]+)$/)) && method === 'PUT') return await putMyDoc(env, me, decodeURIComponent(m[1]), request);
    if ((m = path.match(/^\/api\/ts\/docs\/([^/]+)\/submit$/)) && method === 'POST') return await submitMyDoc(env, me, decodeURIComponent(m[1]), request);
    if ((m = path.match(/^\/api\/ts\/docs\/([^/]+)\/withdraw$/)) && method === 'POST') return await withdrawMyDoc(env, me, decodeURIComponent(m[1]));
    if ((m = path.match(/^\/api\/ts\/docs\/([^/]+)\/amend$/)) && method === 'POST') return await amendMyDoc(env, me, decodeURIComponent(m[1]), request);
    if ((m = path.match(/^\/api\/ts\/docs\/([^/]+)\/amend-cancel$/)) && method === 'POST') return await cancelAmendMyDoc(env, me, decodeURIComponent(m[1]));
    if (path === '/api/admin/mail/test' && method === 'POST') return await sendTestMail(env, me, request);
    if (path === '/api/ts/approvers' && method === 'GET') return await tsApprovers(env, me, url);
    if (path === '/api/ts/inbox' && method === 'GET') return await tsInbox(H, env, me);
    if ((m = path.match(/^\/api\/ts\/review\/([^/]+)\/([^/]+)$/)) && method === 'GET') return await reviewDoc(H, env, me, decodeURIComponent(m[1]), decodeURIComponent(m[2]));
    if (path === '/api/ts/approved' && method === 'GET') return await approvedList(H, env, me, url);
    if ((m = path.match(/^\/api\/ts\/review\/([^/]+)\/([^/]+)\/resend$/)) && method === 'POST') return await resendApproved(H, env, me, decodeURIComponent(m[1]), decodeURIComponent(m[2]), request);
    if ((m = path.match(/^\/api\/ts\/review\/([^/]+)\/([^/]+)\/(approve|reject)$/)) && method === 'POST') return await decideDoc(H, env, me, decodeURIComponent(m[1]), decodeURIComponent(m[2]), m[3], request);
    if (path === '/api/admin/audit' && method === 'GET') return await listAudit(env, me, url);
    if (path.startsWith('/api/admin/ts/') || path === '/api/ts/import') {
      const r = (await routeTsImport(H, env, me, path, method, url, request)) || (await routeTsAdmin(H, env, me, path, method, url, request));
      if (r) return r;
    }
    if (path.startsWith('/api/hs/')) {
      const r = await routeHsProject(H, env, me, path, method, request);
      if (r) return r;
    }
    if (path.startsWith('/api/incentive/')) {
      const r = await routeIncentive(H, env, me, path, method, url, request);
      if (r) return r;
    }
    if (path.startsWith('/api/ts/ot/') || path.startsWith('/api/ts/leave')) {
      const r = await routeOtLeave(H, env, me, path, method, url, request);
      if (r) return r;
    }
    throw new HttpError(404, 'Không có đường dẫn này');
  } catch (e) {
    if (e && e.status) return json({ error: e.message, ...(e.extra || {}) }, e.status);
    console.error(e);
    return json({ error: 'Lỗi máy chủ' }, 500);
  }
}
