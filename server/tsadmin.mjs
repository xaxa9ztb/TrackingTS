// Admin / Admin dự án: xem mọi bảng công của mọi nhân viên (kể cả người không có tài khoản) và sửa được.
// Mỗi lần sửa BẮT BUỘC kèm ghi chú; bảng công lưu "Quản trị viên <tên> đã sửa lúc … : <ghi chú>" (người chủ thấy trong Timesheet),
// các dòng bị sửa đánh dấu ae = 1, dòng bị xoá được nhớ (tombstone) để máy của người chủ gộp đúng. Chi tiết nằm ở nhật ký (audit_log).
// Các hàm dùng chung của api.mjs (HttpError, json, …) được truyền vào qua `h` để tránh nhập vòng.
import { PERIOD_RE, checkDoc, checkSubmitEntries, projectWbs } from './tsdoc.mjs';
import { notifyEvent } from './notify.mjs';

const parse = (s, d) => { try { return JSON.parse(s); } catch (e) { return d; } };
const canAdmin = (me) => !!(me && (me.isAdmin || me.isProjAdmin));
function needAdmin(h, me) { if (!canAdmin(me)) throw new h.HttpError(403, 'Chỉ Admin hoặc Admin dự án dùng được chức năng này'); }
const strip = (e) => { const { u, ae, bd, cat, ...rest } = e; return JSON.stringify(rest, Object.keys(rest).sort()); };

async function listDocs(h, env, me, url) {
  needAdmin(h, me);
  const period = String(url.searchParams.get('period') || '');
  if (!PERIOD_RE.test(period)) throw new h.HttpError(400, 'Kỳ lương không hợp lệ (dạng YYYY-MM)');
  const { results } = await env.DB.prepare(`SELECT d.emp_id, d.version, d.status, d.entry_count, d.saved_at, d.saved_by, d.submitted_at, d.pm_by, d.pm_at, d.sitesup_by, d.admin_by, d.admin_at, d.admin_note,
      e.full_name, e.position, e.supervisor, e.email, e.active FROM ts_docs d LEFT JOIN employees e ON e.emp_id = d.emp_id WHERE d.period = ? ORDER BY e.full_name LIMIT 1000`).bind(period).all();
  const have = new Set(results.map(r => r.emp_id));
  const emps = (await env.DB.prepare("SELECT emp_id, full_name, position, supervisor, email FROM employees WHERE active = 1 ORDER BY full_name").all()).results;
  return h.json({ period,
    docs: results.map(r => ({ empId: r.emp_id, name: r.full_name || r.emp_id, position: r.position || '', supervisor: r.supervisor || '', account: !!r.email, active: r.active !== 0,
      version: r.version, status: r.status, entries: r.entry_count, savedAt: r.saved_at, savedBy: r.saved_by, submittedAt: r.submitted_at, sitesupBy: r.sitesup_by, pmBy: r.pm_by, pmAt: r.pm_at,
      adminBy: r.admin_by, adminAt: r.admin_at, adminNote: r.admin_note })),
    others: emps.filter(e => !have.has(e.emp_id)).map(e => ({ empId: e.emp_id, name: e.full_name, position: e.position, account: !!e.email })) });
}

// Xuất hàng loạt cho HR: toàn bộ bảng công ĐÃ DUYỆT XONG của một kỳ, kèm dữ liệu (trình duyệt Admin tự dựng file Excel và nén zip).
async function approvedDocs(h, env, me, url) {
  needAdmin(h, me);
  const period = String(url.searchParams.get('period') || '');
  if (!PERIOD_RE.test(period)) throw new h.HttpError(400, 'Kỳ lương không hợp lệ (dạng YYYY-MM)');
  const { results } = await env.DB.prepare(`SELECT d.emp_id, d.data, d.entry_count, d.final_by, d.final_at, e.full_name, e.position
      FROM ts_docs d LEFT JOIN employees e ON e.emp_id = d.emp_id WHERE d.period = ? AND d.status = 'approved' ORDER BY e.full_name LIMIT 1000`).bind(period).all();
  const head = (r) => JSON.stringify({ empId: r.emp_id, name: r.full_name || r.emp_id, position: r.position || '', entries: r.entry_count, finalBy: r.final_by || '', finalAt: r.final_at || '' });
  const items = results.map(r => head(r).slice(0, -1) + ',"data":' + (r.data || '{"entries":[]}') + '}');
  return new Response(`{"period":${JSON.stringify(period)},"docs":[${items.join(',')}]}`, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

async function getDoc(h, env, me, emp, period) {
  needAdmin(h, me);
  h.periodParam(period);
  const owner = await env.DB.prepare('SELECT emp_id, full_name, position, supervisor, email FROM employees WHERE emp_id = ?').bind(emp).first();
  if (!owner) throw new h.HttpError(404, 'Không có nhân viên ' + emp);
  const r = await env.DB.prepare('SELECT version, status, data, saved_at, saved_by, pm_by, admin_by, admin_at, admin_note FROM ts_docs WHERE emp_id = ? AND period = ?').bind(emp, period).first();
  return h.json({ empId: emp, name: owner.full_name, position: owner.position, supervisor: owner.supervisor, account: !!owner.email, period,
    version: r ? r.version : 0, status: r ? r.status : 'draft', savedAt: r ? r.saved_at : '', savedBy: r ? r.saved_by : '', pmBy: r ? r.pm_by : '',
    adminBy: r ? r.admin_by : '', adminAt: r ? r.admin_at : '', adminNote: r ? r.admin_note : '', data: r ? parse(r.data, { entries: [], deleted: {} }) : { entries: [], deleted: {} } });
}

// PUT {baseVersion, data:{entries, deleted?, sch?, allow?}, note}
async function putDoc(h, env, me, emp, period, request) {
  needAdmin(h, me);
  h.periodParam(period);
  const body = await h.readJson(request);
  const note = h.str(body.note, 400);
  if (note.length < 3) throw new h.HttpError(400, 'Cần ghi chú lý do sửa (người chủ bảng công sẽ thấy)');
  const owner = await env.DB.prepare('SELECT emp_id, full_name, position, email FROM employees WHERE emp_id = ?').bind(emp).first();
  if (!owner) throw new h.HttpError(404, 'Không có nhân viên ' + emp);
  const row = await env.DB.prepare('SELECT * FROM ts_docs WHERE emp_id = ? AND period = ?').bind(emp, period).first();
  const base = Number(body.baseVersion);
  if (!Number.isInteger(base) || base !== (row ? row.version : 0)) {
    return h.json({ ok: false, conflict: true, version: row ? row.version : 0, error: 'Bảng công vừa được sửa ở nơi khác — tải lại rồi sửa tiếp' }, 409);
  }
  const old = row ? parse(row.data, { entries: [], deleted: {} }) : { entries: [], deleted: {} };
  const input = body.data && typeof body.data === 'object' ? body.data : {};
  const t = Date.now(), at = h.now();
  const oldBy = new Map((old.entries || []).map(e => [String(e.id), e]));
  const newEntries = (Array.isArray(input.entries) ? input.entries : []).map((e) => {
    if (!e || typeof e !== 'object') return e;
    const o = oldBy.get(String(e.id));
    return !o || strip(o) !== strip(e) || JSON.stringify(o.bd || null) !== JSON.stringify(e.bd || null) ? { ...e, u: t, ae: 1 } : o;   // chỉ đánh dấu dòng thật sự bị sửa / thêm
  });
  const keep = new Set(newEntries.filter(Boolean).map(e => String(e.id)));
  const deleted = { ...(old.deleted || {}) };
  oldBy.forEach((e, id) => { if (!keep.has(id)) deleted[id] = t; });
  let checked;
  try { checked = checkDoc(period, { entries: newEntries, deleted, sch: input.sch !== undefined ? input.sch : old.sch, allow: input.allow !== undefined ? input.allow : old.allow }); }
  catch (e) { throw new h.HttpError(400, e.message); }
  const status = row ? row.status : 'draft';
  const entries = JSON.parse(checked.data).entries;
  if (status !== 'draft' && status !== 'rejected') {
    const bad = checkSubmitEntries(entries);       // bảng công đã nộp / duyệt: mỗi dòng phải có phân loại giờ bd khớp giờ vào – ra
    if (bad) throw new h.HttpError(400, bad);
  }
  const changed = entries.filter(e => e.ae === 1 && e.u === t).length, removed = [...oldBy.keys()].filter(id => !keep.has(id)).length;
  if (!changed && !removed) throw new h.HttpError(400, 'Chưa có thay đổi nào để lưu');
  const by = me.name;
  let r;
  if (row) {
    r = await env.DB.prepare('UPDATE ts_docs SET version = version + 1, data = ?, entry_count = ?, saved_at = ?, saved_by = ?, admin_by = ?, admin_at = ?, admin_note = ? WHERE emp_id = ? AND period = ? AND version = ?')
      .bind(checked.data, checked.count, at, 'Admin · ' + by, by, at, note, emp, period, base).run();
  } else {
    r = await env.DB.prepare("INSERT INTO ts_docs (emp_id, period, version, status, data, entry_count, saved_at, saved_by, admin_by, admin_at, admin_note) VALUES (?, ?, 1, 'draft', ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(emp_id, period) DO NOTHING")
      .bind(emp, period, checked.data, checked.count, at, 'Admin · ' + by, by, at, note).run();
  }
  if (!(r.meta && r.meta.changes === 1)) throw new h.HttpError(409, 'Bảng công vừa thay đổi — tải lại rồi sửa tiếp');
  // đã nộp / đang duyệt: cập nhật danh sách dự án để người duyệt đúng người; đã duyệt xong: đẩy lại sang bảng Theo dõi giờ công
  let pushed = 0;
  if (status !== 'draft' && status !== 'rejected') {
    const wbs = projectWbs(entries);
    const stmts = [env.DB.prepare('DELETE FROM ts_doc_wbs WHERE emp_id = ? AND period = ?').bind(emp, period)];
    if (wbs.length) stmts.push(env.DB.prepare(`INSERT INTO ts_doc_wbs (emp_id, period, wbs) VALUES ${wbs.map(() => '(?, ?, ?)').join(', ')}`).bind(...wbs.flatMap(w => [emp, period, w])));
    await env.DB.batch(stmts);
  }
  if (status === 'approved') pushed = await h.pushApprovedRows(env, me, { ...row, data: checked.data, full_name: owner.full_name, position: owner.position }, period);
  await h.audit(env, me, 'ts_admin_edit', 'ts_doc', `${emp}:${period}`, { entries: oldBy.size, status }, { entries: checked.count, changed, removed, note, pushed });
  await notifyEvent(env, 'admin_edit', { empId: emp, period, by, note, files: [], pushed: changed + removed });
  return h.json({ ok: true, version: base + 1, status, changed, removed, pushed, adminBy: by, adminAt: at });
}

export async function routeTsAdmin(h, env, me, path, method, url, request) {
  let m;
  if (path === '/api/admin/ts/docs' && method === 'GET') return listDocs(h, env, me, url);
  if (path === '/api/admin/ts/approved' && method === 'GET') return approvedDocs(h, env, me, url);
  if ((m = path.match(/^\/api\/admin\/ts\/doc\/([^/]+)\/([^/]+)$/)) && method === 'GET') return getDoc(h, env, me, decodeURIComponent(m[1]), decodeURIComponent(m[2]));
  if ((m = path.match(/^\/api\/admin\/ts\/doc\/([^/]+)\/([^/]+)$/)) && method === 'PUT') return putDoc(h, env, me, decodeURIComponent(m[1]), decodeURIComponent(m[2]), request);
  return null;
}
