// API của Bộ công cụ (Cloudflare Pages Functions + D1).
// Mọi yêu cầu (trừ /api/health) phải qua Cloudflare Access; máy chủ kiểm tra lại chữ ký JWT,
// tìm nhân viên theo email rồi kiểm tra vai trò cho TỪNG yêu cầu. Mọi thao tác ghi đều vào nhật ký.

import { verifyAccessJwt, teamHost } from './auth.mjs';
import { effectiveRoles, rolesFromPosition, adminEmails } from './roles.mjs';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
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
  if (!emp && !roles.includes('admin')) throw new HttpError(403, 'Email này chưa được gắn với nhân viên nào — liên hệ admin');
  return {
    email, roles,
    isAdmin: roles.includes('admin'),
    empId: emp ? emp.emp_id : '',
    name: emp ? emp.full_name : email,
    position: emp ? emp.position : '',
  };
}

function need(me, ...roles) {
  if (me.isAdmin || roles.some(r => me.roles.includes(r))) return;
  throw new HttpError(403, 'Bạn không có quyền thực hiện thao tác này');
}

function employeeOut(e, full) {
  const base = { empId: e.emp_id, name: e.full_name, position: e.position };
  if (!full) return base;
  return {
    ...base, supervisor: e.supervisor, email: e.email || '', roleOverride: e.role_override,
    active: !!e.active, roles: e.role_override ? (e.role_override === 'staff' ? [] : [e.role_override]) : rolesFromPosition(e.position),
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
  return json({ ...me, projects: results });
}

async function listEmployees(env, me) {
  const full = me.isAdmin || me.roles.includes('pm');
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
  need(me, 'pm');
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
async function importData(env, me, request) {
  need(me);
  const body = await readJson(request);
  const employees = Array.isArray(body.employees) ? body.employees : [];
  const projects = Array.isArray(body.projects) ? body.projects : [];
  if (employees.length > MAX_ROWS || projects.length > MAX_ROWS) throw new HttpError(413, 'Quá nhiều dòng trong một lần gửi');
  const t = now();
  const stmts = [];
  const empIds = [];
  for (const e of employees) {
    const id = str(e && e.empId, 50);
    const name = str(e && e.fullName, 200);
    if (!id || !name) continue;
    empIds.push(id);
    stmts.push(env.DB.prepare(
      `INSERT INTO employees (emp_id, full_name, position, supervisor, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(emp_id) DO UPDATE SET full_name = excluded.full_name, position = excluded.position,
         supervisor = excluded.supervisor, updated_at = excluded.updated_at`
    ).bind(id, name, str(e.position, 200), str(e.supervisor, 200), t));
  }
  let projCount = 0;
  for (const p of projects) {
    const wbs = str(p && p.wbs, 100);
    if (!wbs) continue;
    projCount++;
    const extra = {};
    for (const [k, v] of Object.entries(p)) if (!PROJECT_COLS[k]) extra[k] = v;
    stmts.push(env.DB.prepare(
      `INSERT INTO projects (wbs, project_name, project_number, product_line, customer, supervisor, extra, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(wbs) DO UPDATE SET project_name = excluded.project_name, project_number = excluded.project_number,
         product_line = excluded.product_line, customer = excluded.customer, supervisor = excluded.supervisor,
         extra = excluded.extra, updated_at = excluded.updated_at`
    ).bind(wbs, str(p.projectName, 300), str(p.projectNumber, 100), str(p.productLine, 200), str(p.customer, 300),
      str(p.supervisor, 200), JSON.stringify(extra).slice(0, 20000), t));
  }
  let deactivated = 0;
  if (body.deactivateMissing && empIds.length) {
    const { results } = await env.DB.prepare('SELECT emp_id FROM employees WHERE active = 1').all();
    const keep = new Set(empIds);
    for (const r of results) {
      if (keep.has(r.emp_id)) continue;
      deactivated++;
      stmts.push(env.DB.prepare('UPDATE employees SET active = 0, updated_at = ? WHERE emp_id = ?').bind(t, r.emp_id));
    }
  }
  if (stmts.length) await env.DB.batch(stmts);
  const summary = { employees: empIds.length, projects: projCount, deactivated };
  await audit(env, me, 'import', 'data', '', undefined, summary);
  return json({ ok: true, ...summary });
}

async function patchEmployee(env, me, empId, request) {
  need(me);
  const body = await readJson(request);
  const emp = await env.DB.prepare('SELECT * FROM employees WHERE emp_id = ?').bind(empId).first();
  if (!emp) throw new HttpError(404, 'Không có nhân viên ' + empId);
  const isSelf = me.empId && me.empId === empId;
  const next = { email: emp.email, role_override: emp.role_override, active: emp.active };
  if ('email' in body) {
    const e = str(body.email, 200).toLowerCase();
    if (e && !EMAIL_RE.test(e)) throw new HttpError(400, 'Email không hợp lệ');
    next.email = e || null;
  }
  if ('roleOverride' in body) {
    const r = str(body.roleOverride, 20);
    if (!['', 'admin', 'pm', 'sitesup', 'staff'].includes(r)) throw new HttpError(400, 'Vai trò không hợp lệ');
    next.role_override = r;
  }
  if ('active' in body) next.active = body.active ? 1 : 0;
  if (isSelf && (next.active !== emp.active || next.role_override !== emp.role_override || next.email !== emp.email)) {
    throw new HttpError(400, 'Không tự đổi email, vai trò hay khoá tài khoản của chính mình — nhờ admin khác làm');
  }
  try {
    await env.DB.prepare('UPDATE employees SET email = ?, role_override = ?, active = ?, updated_at = ? WHERE emp_id = ?')
      .bind(next.email, next.role_override, next.active, now(), empId).run();
  } catch (e) {
    if (/UNIQUE/i.test(String(e && e.message))) throw new HttpError(409, 'Email này đã gắn cho nhân viên khác');
    throw e;
  }
  const pick = (r) => ({ email: r.email || '', roleOverride: r.role_override, active: !!r.active });
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

// ---------- điểm vào ----------

// opts.getKeys: chỉ dùng khi kiểm thử (thay nguồn khoá công khai của Access)
export async function handle(request, env, opts = {}) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method.toUpperCase();
  try {
    if (path === '/api/health' && method === 'GET') {
      // Chỉ báo "có / chưa có" từng giá trị cấu hình, không bao giờ trả giá trị — để biết thiếu gì khi cấu hình đăng nhập
      const hasTeam = !!teamHost(env.ACCESS_TEAM_DOMAIN), hasAud = !!String(env.ACCESS_AUD || '').trim();
      return json({
        ok: true, db: !!env.DB, auth: hasTeam && hasAud,
        config: { ACCESS_TEAM_DOMAIN: hasTeam, ACCESS_AUD: hasAud, ADMIN_EMAILS: adminEmails(env).length > 0 },
      });
    }
    if (!env.DB) throw new HttpError(503, 'Máy chủ chưa gắn cơ sở dữ liệu');
    // Yêu cầu ghi bắt buộc là JSON: trang lạ không gửi được kiểu này sang (chặn giả mạo yêu cầu)
    if (method !== 'GET' && method !== 'HEAD') {
      const ct = (request.headers.get('content-type') || '').toLowerCase();
      if (!ct.startsWith('application/json')) throw new HttpError(415, 'Yêu cầu ghi phải gửi dạng JSON');
    }
    const { email } = await verifyAccessJwt(request.headers.get('cf-access-jwt-assertion'), env, opts);
    const me = await loadMe(env, email);

    let m;
    if (path === '/api/me' && method === 'GET') return await getMe(env, me);
    if (path === '/api/employees' && method === 'GET') return await listEmployees(env, me);
    if (path === '/api/projects' && method === 'GET') return await listProjects(env);
    if ((m = path.match(/^\/api\/projects\/([^/]+)\/staff$/)) && method === 'PUT') return await putProjectStaff(env, me, decodeURIComponent(m[1]), request);
    if (path === '/api/admin/import' && method === 'POST') return await importData(env, me, request);
    if ((m = path.match(/^\/api\/admin\/employees\/([^/]+)$/)) && method === 'PATCH') return await patchEmployee(env, me, decodeURIComponent(m[1]), request);
    if (path === '/api/admin/audit' && method === 'GET') return await listAudit(env, me, url);
    throw new HttpError(404, 'Không có đường dẫn này');
  } catch (e) {
    if (e && e.status) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'Lỗi máy chủ' }, 500);
  }
}
