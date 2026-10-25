// API của Bộ công cụ (Cloudflare Pages Functions + D1).
// Mọi yêu cầu (trừ /api/health) phải qua Cloudflare Access; máy chủ kiểm tra lại chữ ký JWT,
// tìm nhân viên theo email rồi kiểm tra vai trò cho TỪNG yêu cầu. Mọi thao tác ghi đều vào nhật ký.

import { verifyAccessJwt, teamHost } from './auth.mjs';
import { effectiveRoles, rolesFromPosition, adminEmails } from './roles.mjs';
import { matchSupervisor, keyOf } from './supervisors.mjs';

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
// Gói miễn phí của D1 giới hạn số câu lệnh mỗi lần gọi và 100 tham số mỗi câu lệnh, nên ghi nhiều dòng
// một câu lệnh (tối đa 100 tham số) và giới hạn số câu lệnh mỗi yêu cầu — trang quản trị gửi từng đợt nhỏ.
const MAX_STMTS = 40;
const EMP_PER_STMT = 20;      // 5 tham số × 20 = 100
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
    if (id && name) empRows.set(id, [id, name, str(e.position, 200), str(e.supervisor, 200), t]);
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
    ...chunks([...empRows.values()], EMP_PER_STMT).map(r => multiRow('employees', ['emp_id', 'full_name', 'position', 'supervisor', 'updated_at'], 'emp_id', r)),
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
  need(me, 'pm');
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
  need(me, 'pm');
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
    if (path === '/api/admin/emails' && method === 'POST') return await setEmails(env, me, request);
    if (path === '/api/supervisors' && method === 'GET') return await listSupervisors(env, me);
    if (path === '/api/supervisors/apply' && method === 'POST') return await applySupervisors(env, me, request);
    if ((m = path.match(/^\/api\/admin\/employees\/([^/]+)$/)) && method === 'PATCH') return await patchEmployee(env, me, decodeURIComponent(m[1]), request);
    if (path === '/api/admin/audit' && method === 'GET') return await listAudit(env, me, url);
    throw new HttpError(404, 'Không có đường dẫn này');
  } catch (e) {
    if (e && e.status) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'Lỗi máy chủ' }, 500);
  }
}
