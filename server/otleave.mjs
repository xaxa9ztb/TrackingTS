// Duyệt tăng ca (OT) hằng ngày và đơn nghỉ phép / ốm / không lương của Timesheet cá nhân.
//
// Tăng ca: máy khách (Timesheet) tính các ngày có giờ OT (tools/timesheet/otleave.js · otDays) và gửi lên sau mỗi lần đồng bộ;
//   mỗi ngày là một yêu cầu chờ Site Sup duyệt. Sửa dòng của ngày đã duyệt → dấu vân tay (sig) đổi → chờ duyệt lại.
//   Nộp bảng công: mọi ngày có OT phải được duyệt đúng sig (otSubmitError, gọi từ submitMyDoc).
// Nghỉ: fitter làm đơn TRƯỚC ngày bắt đầu; Site Sup / QLDA của dự án hoặc Quản lý trực tiếp duyệt trước ngày bắt đầu;
//   duyệt xong máy chủ tự ghi một dòng nghỉ cho mỗi ngày làm việc vào bảng công (ts_docs) của kỳ tương ứng.
// Các hàm dùng chung của api.mjs (HttpError, json, need, …) được truyền vào qua `h` để tránh nhập vòng.
import OtLeave from '../tools/timesheet/otleave.js';
import Labor from '../tools/timesheet/labor.js';
import { keyOf } from './supervisors.mjs';
import { PERIOD_RE, periodRange, checkDoc } from './tsdoc.mjs';
import { vnDate, periodOfDate, notifyOt, notifyLeave } from './notify.mjs';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SCHEDULES = ['mon-sat-am', 'mon-fri', 'mon-sat'];
const MAX_OT_DAYS = 31;
const MAX_DECIDE = 100;
const ph = (n) => Array.from({ length: n }, () => '?').join(', ');
const r2 = (n) => Math.round(n * 100) / 100;
const parse = (s, d) => { try { return JSON.parse(s); } catch (e) { return d; } };
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);

// ---------- tăng ca ----------
const otOut = (r) => ({ status: r.status, ot: r.ot, total: r.total, sig: r.sig, note: r.note, by: r.decided_by, at: r.decided_at, requestedAt: r.requested_at });

async function otStatuses(env, emp, period) {
  const { results } = await env.DB.prepare('SELECT * FROM ts_ot WHERE emp_id = ? AND period = ? ORDER BY date').bind(emp, period).all();
  const days = {};
  results.forEach(r => { days[r.date] = otOut(r); });
  return days;
}

// làm sạch một ngày OT máy khách gửi lên
function cleanOtDay(d, start, end) {
  if (!d || typeof d !== 'object' || !DATE_RE.test(String(d.date)) || d.date < start || d.date > end) return null;
  const ot = Number(d.ot), total = Number(d.total);
  if (!(ot > 0.01 && ot <= 24) || !(total >= ot && total <= 48)) return null;
  const sig = String(d.sig || '');
  if (!sig || sig.length > 4000) return null;
  const s = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const wbs = [...new Set((Array.isArray(d.wbs) ? d.wbs : []).map(w => s(w, 100)).filter(Boolean))].slice(0, 10);
  const items = (Array.isArray(d.items) ? d.items : []).slice(0, 12).map(i => ({
    start: s(i && i.start, 5), end: s(i && i.end, 5), brk: s(i && i.brk, 5), code: s(i && i.code, 10),
    wbs: s(i && i.wbs, 100), project: s(i && i.project, 120), report: s(i && i.report, 400),
  }));
  return { date: d.date, ot: r2(ot), total: r2(total), sig, wbs: wbs.join(','), detail: JSON.stringify(items) };
}

// PUT /api/ts/ot/mine {period, days:[…]} — danh sách ĐẦY ĐỦ các ngày có OT của kỳ (ngày không còn OT thì bỏ yêu cầu).
async function putMyOt(h, env, me, request) {
  const emp = h.needOwnEmp(me);
  const body = await h.readJson(request);
  const period = String(body.period || '');
  if (!PERIOD_RE.test(period)) throw new h.HttpError(400, 'Kỳ lương không hợp lệ (dạng YYYY-MM)');
  if (!Array.isArray(body.days) || body.days.length > MAX_OT_DAYS) throw new h.HttpError(400, 'Danh sách ngày tăng ca không hợp lệ');
  const doc = await env.DB.prepare('SELECT status FROM ts_docs WHERE emp_id = ? AND period = ?').bind(emp, period).first();
  // bảng công đã nộp / duyệt: OT đã chốt, không đổi nữa
  if (doc && h.LOCKED_STATUSES.includes(doc.status)) return h.json({ ok: true, locked: true, period, days: await otStatuses(env, emp, period) });
  const { start, end } = periodRange(period);
  const want = new Map();
  for (const d of body.days) {
    const c = cleanOtDay(d, start, end);
    if (!c) throw new h.HttpError(400, `Ngày tăng ca ${String(d && d.date)} không hợp lệ`);
    want.set(c.date, c);
  }
  const { results: cur } = await env.DB.prepare('SELECT * FROM ts_ot WHERE emp_id = ? AND period = ?').bind(emp, period).all();
  const have = new Map(cur.map(r => [r.date, r]));
  const t = h.now(), stmts = [];
  let reset = 0, added = 0;
  for (const c of want.values()) {
    const r = have.get(c.date);
    if (r && r.sig === c.sig) {
      if (r.ot !== c.ot || r.total !== c.total || r.wbs !== c.wbs || r.detail !== c.detail) {
        stmts.push(env.DB.prepare('UPDATE ts_ot SET ot = ?, total = ?, wbs = ?, detail = ? WHERE emp_id = ? AND date = ? AND sig = ?')
          .bind(c.ot, c.total, c.wbs, c.detail, emp, c.date, c.sig));
      }
      continue;
    }
    if (r) reset++; else added++;
    stmts.push(env.DB.prepare(`INSERT INTO ts_ot (emp_id, date, period, ot, total, sig, wbs, detail, status, requested_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      ON CONFLICT(emp_id, date) DO UPDATE SET period = excluded.period, ot = excluded.ot, total = excluded.total, sig = excluded.sig, wbs = excluded.wbs,
      detail = excluded.detail, status = 'pending', requested_at = excluded.requested_at, decided_by = '', decided_at = '', note = ''`)
      .bind(emp, c.date, period, c.ot, c.total, c.sig, c.wbs, c.detail, t));
  }
  const gone = cur.filter(r => !want.has(r.date)).map(r => r.date);
  if (gone.length) stmts.push(env.DB.prepare(`DELETE FROM ts_ot WHERE emp_id = ? AND date IN (${ph(gone.length)})`).bind(emp, ...gone));
  if (stmts.length) await env.DB.batch(stmts);
  return h.json({ ok: true, period, added, reset, removed: gone.length, days: await otStatuses(env, emp, period) });
}

async function getMyOt(h, env, me, url) {
  const emp = h.needOwnEmp(me);
  const period = String(url.searchParams.get('period') || '');
  if (!PERIOD_RE.test(period)) throw new h.HttpError(400, 'Kỳ lương không hợp lệ (dạng YYYY-MM)');
  return h.json({ period, days: await otStatuses(env, emp, period) });
}

const otWbs = (r) => String(r.wbs || '').split(',').filter(Boolean);

async function pendingOt(env) {
  const { results } = await env.DB.prepare(`SELECT o.*, e.full_name, e.position, e.supervisor FROM ts_ot o JOIN employees e ON e.emp_id = o.emp_id
    WHERE o.status = 'pending' ORDER BY o.date, e.full_name LIMIT 500`).all();
  return results;
}

// Các ngày OT đang chờ người này duyệt (Site Sup của dự án trong ngày, hoặc Quản lý trực tiếp; admin thấy hết)
async function otInboxRows(h, env, me, staff) {
  const rows = await pendingOt(env);
  return rows.filter(r => h.canAct(me, 'sitesup', otWbs(r), staff, r.supervisor));
}

async function otInbox(h, env, me) {
  h.need(me, 'sitesup', 'pm');
  const staff = await h.projectStaff(env);
  const rows = await otInboxRows(h, env, me, staff);
  return h.json({ items: rows.map(r => ({ empId: r.emp_id, name: r.full_name, position: r.position, date: r.date, period: r.period, ot: r.ot, total: r.total,
    sig: r.sig, wbs: otWbs(r), items: parse(r.detail, []), requestedAt: r.requested_at })) });
}

// POST /api/ts/ot/decide {items:[{emp, date, sig}], action:'approve'|'reject', note}
async function decideOt(h, env, me, request) {
  h.need(me, 'sitesup', 'pm');
  const body = await h.readJson(request);
  const action = body.action === 'reject' ? 'reject' : body.action === 'approve' ? 'approve' : '';
  if (!action) throw new h.HttpError(400, 'Thiếu thao tác (duyệt / từ chối)');
  const list = Array.isArray(body.items) ? body.items : [];
  if (!list.length || list.length > MAX_DECIDE) throw new h.HttpError(400, `Chọn từ 1 đến ${MAX_DECIDE} ngày tăng ca`);
  const note = h.str(body.note, 300);
  if (action === 'reject' && note.length < 3) throw new h.HttpError(400, 'Cần ghi lý do không duyệt tăng ca (để fitter biết sửa gì)');
  const staff = await h.projectStaff(env);
  const keys = list.map(x => ({ emp: h.str(x && x.emp, 40), date: h.str(x && x.date, 10), sig: String((x && x.sig) || '') }));
  if (keys.some(k => !k.emp || !DATE_RE.test(k.date))) throw new h.HttpError(400, 'Ngày tăng ca không hợp lệ');
  const emps = [...new Set(keys.map(k => k.emp))];
  const { results } = await env.DB.prepare(`SELECT o.*, e.supervisor, e.full_name FROM ts_ot o JOIN employees e ON e.emp_id = o.emp_id WHERE o.emp_id IN (${ph(emps.length)})`).bind(...emps).all();
  const rowOf = new Map(results.map(r => [r.emp_id + '|' + r.date, r]));
  const periods = [...new Set(results.map(r => r.emp_id + '|' + r.period))];
  const locked = new Set();
  if (periods.length) {
    const docs = (await env.DB.prepare(`SELECT emp_id, period, status FROM ts_docs WHERE emp_id IN (${ph(emps.length)})`).bind(...emps).all()).results;
    docs.forEach(d => { if (h.LOCKED_STATUSES.includes(d.status)) locked.add(d.emp_id + '|' + d.period); });
  }
  const t = h.now(), status = action === 'approve' ? 'approved' : 'rejected', done = [], skipped = [], stmts = [];
  for (const k of keys) {
    const r = rowOf.get(k.emp + '|' + k.date);
    const why = !r ? 'không còn yêu cầu' : r.sig !== k.sig ? 'fitter vừa sửa giờ — tải lại' : locked.has(r.emp_id + '|' + r.period) ? 'bảng công đã nộp'
      : !h.canAct(me, 'sitesup', otWbs(r), staff, r.supervisor) ? 'bạn không phải người duyệt' : '';
    if (why) { skipped.push({ emp: k.emp, date: k.date, reason: why }); continue; }
    stmts.push(env.DB.prepare('UPDATE ts_ot SET status = ?, decided_by = ?, decided_at = ?, note = ? WHERE emp_id = ? AND date = ? AND sig = ?')
      .bind(status, me.name, t, action === 'reject' ? note : '', r.emp_id, r.date, r.sig));
    done.push(r);
  }
  if (stmts.length) await env.DB.batch(stmts);
  if (done.length) {
    await h.audit(env, me, action === 'approve' ? 'ot_approve' : 'ot_reject', 'ts_ot', done.map(r => `${r.emp_id}:${r.date}`).join(',').slice(0, 400), undefined, { days: done.length, note });
    // mỗi fitter một thư báo kết quả
    const byEmp = new Map();
    done.forEach(r => { if (!byEmp.has(r.emp_id)) byEmp.set(r.emp_id, []); byEmp.get(r.emp_id).push({ date: r.date, ot: r.ot }); });
    for (const [empId, days] of byEmp) await notifyOt(env, { empId, action, by: me.name, note, days });
  }
  return h.json({ ok: true, status, done: done.length, skipped });
}

// Nộp bảng công: ngày nào có OT (theo phân loại giờ bd đã gửi) phải được duyệt đúng các dòng hiện tại. Trả về lỗi hoặc ''.
export async function otSubmitError(env, emp, period, entries) {
  const days = OtLeave.otDays(entries, (e) => (e.bd && typeof e.bd === 'object' ? e.bd : {}));
  if (!days.length) return '';
  const { results } = await env.DB.prepare('SELECT date, sig, status FROM ts_ot WHERE emp_id = ? AND period = ?').bind(emp, period).all();
  const by = new Map(results.map(r => [r.date, r]));
  const fmt = (d) => d.slice(8, 10) + '/' + d.slice(5, 7);
  const bad = days.filter(d => { const r = by.get(d.date); return !r || r.status !== 'approved' || r.sig !== d.sig; });
  if (!bad.length) return '';
  const rej = bad.filter(d => (by.get(d.date) || {}).status === 'rejected');
  const list = bad.slice(0, 5).map(d => fmt(d.date)).join(', ') + (bad.length > 5 ? ` và ${bad.length - 5} ngày khác` : '');
  return `Còn ${bad.length} ngày tăng ca chưa được Site Sup duyệt (${list})${rej.length ? ` — trong đó ${rej.length} ngày bị từ chối, cần sửa giờ` : ''}. Chờ duyệt xong rồi nộp lại.`;
}

// ---------- đơn nghỉ ----------
const leaveOut = (r, today) => ({
  id: r.id, empId: r.emp_id, type: r.type, label: (OtLeave.LEAVE_TYPES[r.type] || {}).label || r.type, from: r.date_from, to: r.date_to,
  days: parse(r.days, []), count: OtLeave.dayCount(parse(r.days, [])), reason: r.reason, status: r.status, createdAt: r.created_at,
  decidedBy: r.decided_by, decidedAt: r.decided_at, note: r.note, written: r.written, expired: r.status === 'pending' && today >= r.date_from,
  ...(r.full_name !== undefined ? { name: r.full_name, position: r.position } : {}),
});

// các WBS fitter đang làm gần đây (2 kỳ mới nhất) — để tìm Site Sup / QLDA duyệt đơn
async function recentWbs(env, emp) {
  const { results } = await env.DB.prepare(`SELECT DISTINCT trim(json_extract(x.value, '$.workNumber')) w FROM
    (SELECT data FROM ts_docs WHERE emp_id = ? ORDER BY period DESC LIMIT 2) d, json_each(d.data, '$.entries') x`).bind(emp).all();
  return results.map(r => String(r.w || '')).filter(w => w && !/LEAVE/i.test(w)).slice(0, 10);
}

async function createLeave(h, env, me, request) {
  const emp = h.needOwnEmp(me);
  const body = await h.readJson(request);
  const type = String(body.type || '');
  if (!OtLeave.LEAVE_TYPES[type]) throw new h.HttpError(400, 'Loại nghỉ không hợp lệ');
  const from = String(body.from || ''), to = String(body.to || body.from || '');
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || to < from) throw new h.HttpError(400, 'Ngày nghỉ không hợp lệ');
  const today = vnDate();
  if (from <= today) throw new h.HttpError(400, 'Đơn nghỉ phải làm TRƯỚC ngày bắt đầu nghỉ (sớm nhất là nghỉ từ ngày mai) để quản lý kịp duyệt');
  if (daysBetween(from, to) + 1 > OtLeave.MAX_LEAVE_DAYS) throw new h.HttpError(400, `Mỗi đơn tối đa ${OtLeave.MAX_LEAVE_DAYS} ngày — chia thành nhiều đơn`);
  if (daysBetween(today, from) > 120) throw new h.HttpError(400, 'Chỉ làm đơn cho ngày nghỉ trong vòng 4 tháng tới');
  let sch = SCHEDULES.includes(body.sch) ? body.sch : '';
  if (!sch) {
    const d = await env.DB.prepare('SELECT data FROM ts_docs WHERE emp_id = ? ORDER BY period DESC LIMIT 1').bind(emp).first();
    sch = (d && parse(d.data, {}).sch) || Labor.DEFAULT_SCHEDULE;
  }
  const days = OtLeave.leaveDays(from, to, sch, Labor);
  if (!days.length) throw new h.HttpError(400, 'Khoảng ngày này toàn ngày nghỉ hằng tuần / ngày lễ — không cần làm đơn');
  const reason = h.str(body.reason, 300);
  const clash = await env.DB.prepare("SELECT id, date_from, date_to FROM ts_leave WHERE emp_id = ? AND status IN ('pending', 'approved') AND date_from <= ? AND date_to >= ? LIMIT 1")
    .bind(emp, to, from).first();
  if (clash) throw new h.HttpError(409, `Trùng với đơn nghỉ #${clash.id} (${clash.date_from} → ${clash.date_to}) đang chờ / đã duyệt`);
  const wbs = await recentWbs(env, emp);
  const r = await env.DB.prepare("INSERT INTO ts_leave (emp_id, type, date_from, date_to, days, reason, wbs, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?) RETURNING *")
    .bind(emp, type, from, to, JSON.stringify(days), reason, wbs.join(','), h.now()).first();
  await h.audit(env, me, 'leave_request', 'ts_leave', String(r.id), undefined, { type, from, to, days: OtLeave.dayCount(days) });
  await notifyLeave(env, 'request', { leave: r });
  return h.json({ ok: true, leave: leaveOut(r, today) });
}

async function myLeaves(h, env, me) {
  const emp = h.needOwnEmp(me);
  const { results } = await env.DB.prepare('SELECT * FROM ts_leave WHERE emp_id = ? ORDER BY date_from DESC, id DESC LIMIT 40').bind(emp).all();
  const today = vnDate();
  return h.json({ today, leaves: results.map(r => leaveOut(r, today)) });
}

async function cancelLeave(h, env, me, id) {
  const emp = h.needOwnEmp(me);
  const r = await env.DB.prepare("UPDATE ts_leave SET status = 'cancelled', decided_at = ? WHERE id = ? AND emp_id = ? AND status = 'pending'").bind(h.now(), id, emp).run();
  if (!(r.meta && r.meta.changes === 1)) throw new h.HttpError(409, 'Chỉ huỷ được đơn đang chờ duyệt — đơn đã duyệt thì báo quản lý');
  await h.audit(env, me, 'leave_cancel', 'ts_leave', String(id));
  return h.json({ ok: true, status: 'cancelled' });
}

// Người duyệt đơn nghỉ: admin; hoặc Site Sup / QLDA là Quản lý trực tiếp của fitter, hoặc được gán cho dự án fitter đang làm.
function canLeave(me, row, staff) {
  if (me.isAdmin) return true;
  if (!me.empId || me.empId === row.emp_id || !(me.roles.includes('sitesup') || me.roles.includes('pm'))) return false;
  if (row.supervisor && keyOf(row.supervisor) === keyOf(me.name)) return true;
  return String(row.wbs || '').split(',').filter(Boolean).some(w => { const s = staff.get(w); return s && (s.sitesup.includes(me.empId) || s.pm.includes(me.empId)); });
}

async function leaveInboxRows(env, me, staff) {
  const { results } = await env.DB.prepare(`SELECT l.*, e.full_name, e.position, e.supervisor FROM ts_leave l JOIN employees e ON e.emp_id = l.emp_id
    WHERE l.status = 'pending' ORDER BY l.date_from LIMIT 300`).all();
  return results.filter(r => canLeave(me, r, staff));
}

async function leaveInbox(h, env, me) {
  h.need(me, 'sitesup', 'pm');
  const staff = await h.projectStaff(env);
  const today = vnDate();
  return h.json({ today, items: (await leaveInboxRows(env, me, staff)).map(r => leaveOut(r, today)) });
}

// Ghi các dòng nghỉ của đơn vào bảng công từng kỳ. Kỳ đã nộp / duyệt thì bỏ qua (ghi chú lại). Ghi lại nhiều lần không nhân đôi (theo lv).
async function writeLeave(env, row, by) {
  const days = parse(row.days, []);
  const byPeriod = new Map();
  days.forEach(d => { const p = periodOfDate(d.date); if (!byPeriod.has(p)) byPeriod.set(p, []); byPeriod.get(p).push(d); });
  const notes = [];
  let n = 0;
  for (const [period, list] of byPeriod) {
    let msg = '';
    for (let attempt = 0; attempt < 4 && !msg; attempt++) {
      const doc = await env.DB.prepare('SELECT version, status, data FROM ts_docs WHERE emp_id = ? AND period = ?').bind(row.emp_id, period).first();
      if (doc && ['submitted', 'sitesup_ok', 'approved'].includes(doc.status)) { msg = `kỳ ${period}: bảng công đã nộp, chưa ghi — fitter thu hồi rồi thêm tay`; break; }
      const data = doc ? parse(doc.data, { entries: [], deleted: {} }) : { entries: [], deleted: {} };
      const entries = Array.isArray(data.entries) ? data.entries : [];
      const have = new Set(entries.filter(e => String(e.lv || '') === String(row.id)).map(e => e.date));
      const u = Date.now();
      const add = list.filter(d => !have.has(d.date)).map((d, i) => OtLeave.leaveEntry(d, row.type, row.id, String(u * 1000 + n + i), u));
      if (!add.length) { msg = `kỳ ${period}: đã có ${list.length} dòng`; break; }
      let checked;
      try { checked = checkDoc(period, { ...data, entries: entries.concat(add) }); }
      catch (e) { msg = `kỳ ${period}: không ghi được (${e.message})`; break; }
      const r = doc
        ? await env.DB.prepare(`UPDATE ts_docs SET version = version + 1, data = ?, entry_count = ?, saved_at = ?, saved_by = ? WHERE emp_id = ? AND period = ? AND version = ? AND status NOT IN ('submitted', 'sitesup_ok', 'approved')`)
          .bind(checked.data, checked.count, new Date().toISOString(), 'Đơn nghỉ · ' + by, row.emp_id, period, doc.version).run()
        : await env.DB.prepare("INSERT INTO ts_docs (emp_id, period, version, status, data, entry_count, saved_at, saved_by) VALUES (?, ?, 1, 'draft', ?, ?, ?, ?) ON CONFLICT(emp_id, period) DO NOTHING")
          .bind(row.emp_id, period, checked.data, checked.count, new Date().toISOString(), 'Đơn nghỉ · ' + by).run();
      if (r.meta && r.meta.changes === 1) { n += add.length; msg = `kỳ ${period}: ${add.length} dòng`; }
    }
    notes.push(msg || `kỳ ${period}: máy chủ bận, chưa ghi — bấm Duyệt lại`);
  }
  return { written: n, text: notes.join('; ') };
}

async function decideLeave(h, env, me, id, action, request) {
  h.need(me, 'sitesup', 'pm');
  const body = await h.readJson(request);
  const row = await env.DB.prepare('SELECT l.*, e.full_name, e.position, e.supervisor FROM ts_leave l JOIN employees e ON e.emp_id = l.emp_id WHERE l.id = ?').bind(id).first();
  if (!row) throw new h.HttpError(404, 'Không có đơn nghỉ này');
  const staff = await h.projectStaff(env);
  if (!canLeave(me, row, staff)) throw new h.HttpError(403, 'Bạn không phải người duyệt đơn nghỉ này');
  const t = h.now(), today = vnDate();
  if (action === 'reject') {
    const note = h.str(body.note, 300);
    if (note.length < 3) throw new h.HttpError(400, 'Cần ghi lý do không duyệt');
    const r = await env.DB.prepare("UPDATE ts_leave SET status = 'rejected', decided_by = ?, decided_at = ?, note = ? WHERE id = ? AND status = 'pending'").bind(me.name, t, note, id).run();
    if (!(r.meta && r.meta.changes === 1)) throw new h.HttpError(409, 'Đơn này không còn chờ duyệt — tải lại danh sách');
    await h.audit(env, me, 'leave_reject', 'ts_leave', String(id), undefined, { note });
    await notifyLeave(env, 'rejected', { leave: { ...row, decided_by: me.name, note } });
    return h.json({ ok: true, status: 'rejected' });
  }
  // duyệt: còn chờ duyệt (hoặc đã duyệt mà chưa ghi xong → ghi lại) và chưa tới ngày bắt đầu
  if (row.status === 'pending') {
    if (today >= row.date_from) throw new h.HttpError(409, `Đã tới ngày bắt đầu nghỉ (${row.date_from}) — không duyệt được nữa, chỉ không duyệt`);
    const r = await env.DB.prepare("UPDATE ts_leave SET status = 'approved', decided_by = ?, decided_at = ?, note = ? WHERE id = ? AND status = 'pending'")
      .bind(me.name, t, h.str(body.note, 300), id).run();
    if (!(r.meta && r.meta.changes === 1)) throw new h.HttpError(409, 'Đơn này không còn chờ duyệt — tải lại danh sách');
  } else if (row.status !== 'approved') throw new h.HttpError(409, 'Đơn này không còn chờ duyệt — tải lại danh sách');
  const w = await writeLeave(env, row, me.name);
  await env.DB.prepare('UPDATE ts_leave SET written = ? WHERE id = ?').bind(w.text.slice(0, 500), id).run();
  await h.audit(env, me, 'leave_approve', 'ts_leave', String(id), undefined, { written: w.text });
  if (row.status === 'pending') await notifyLeave(env, 'approved', { leave: { ...row, decided_by: me.name }, written: w.text });
  return h.json({ ok: true, status: 'approved', written: w.written, note: w.text });
}

// số việc chờ người này duyệt (huy hiệu ở trang chủ / hộp thư duyệt)
export async function otLeaveCounts(h, env, me, staff) {
  const today = vnDate();
  const [ot, lv] = await Promise.all([otInboxRows(h, env, me, staff), leaveInboxRows(env, me, staff)]);
  return { ot: ot.length, leave: lv.filter(r => today < r.date_from).length };
}

// Điều phối route; trả về null nếu không phải route của phần này.
export async function routeOtLeave(h, env, me, path, method, url, request) {
  let m;
  if (path === '/api/ts/ot/mine' && method === 'PUT') return putMyOt(h, env, me, request);
  if (path === '/api/ts/ot/mine' && method === 'GET') return getMyOt(h, env, me, url);
  if (path === '/api/ts/ot/inbox' && method === 'GET') return otInbox(h, env, me);
  if (path === '/api/ts/ot/decide' && method === 'POST') return decideOt(h, env, me, request);
  if (path === '/api/ts/leave' && method === 'POST') return createLeave(h, env, me, request);
  if (path === '/api/ts/leave/mine' && method === 'GET') return myLeaves(h, env, me);
  if (path === '/api/ts/leave/inbox' && method === 'GET') return leaveInbox(h, env, me);
  if ((m = path.match(/^\/api\/ts\/leave\/(\d{1,9})\/cancel$/)) && method === 'POST') return cancelLeave(h, env, me, +m[1]);
  if ((m = path.match(/^\/api\/ts\/leave\/(\d{1,9})\/(approve|reject)$/)) && method === 'POST') return decideLeave(h, env, me, +m[1], m[2], request);
  return null;
}
