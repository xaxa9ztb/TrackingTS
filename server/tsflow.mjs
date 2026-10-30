// Quy trình duyệt bảng công 3 cấp (Timesheet cá nhân):
//   submitted  → mọi dự án (WBS) trong bảng công phải được MỘT Site Sup của dự án đó duyệt (hoặc Quản lý trực tiếp của người nộp, hoặc admin)
//   sitesup_ok → mọi dự án phải được MỘT Quản lý dự án của dự án đó duyệt (hoặc Quản lý trực tiếp / admin)
//   pm_ok      → Admin / Admin dự án xử lý cuối: duyệt các hoạt động NGOÀI dự án (họp, huấn luyện, nghỉ…) rồi bấm Process
//   approved   → dữ liệu sang bảng Theo dõi giờ công; hệ thống gửi thư kèm Excel cho Fitter, Site Sup, Quản lý dự án liên quan
// Cấp nào không có dự án nào cần duyệt (bảng công chỉ có hoạt động ngoài dự án) thì tự bỏ qua. Giám sát nộp thẳng cấp Quản lý dự án.
// Ai đã duyệt dự án nào ghi ở ts_approvals; bảng công bị trả lại / nộp lại thì xoá hết.
// Các hàm dùng chung của api.mjs được truyền vào qua `h` để tránh nhập vòng.
import { keyOf } from './supervisors.mjs';
import { projectWbs } from './tsdoc.mjs';
import { notifyEvent } from './notify.mjs';
import { otPendingOfDoc, otLeaveCounts } from './otleave.mjs';

export const LEVEL_OF = { submitted: 'sitesup', sitesup_ok: 'pm', pm_ok: 'admin' };
const NEXT = { submitted: 'sitesup_ok', sitesup_ok: 'pm_ok' };
const PENDING = ['submitted', 'sitesup_ok', 'pm_ok'];
const ph = (n) => Array.from({ length: n }, () => '?').join(', ');
const isAdminish = (me) => !!(me && (me.isAdmin || me.isProjAdmin));

// Các dự án (trong wbsList) mà người này duyệt được ở cấp `level`: admin → tất cả (mọi cấp); Quản lý trực tiếp của người nộp → tất cả (cấp mình có vai trò);
// còn lại → các dự án được gán cho họ ở cấp đó. Cấp admin: Admin / Admin dự án → ['*'].
export function covers(me, level, wbsList, staff, ownerSupervisor) {
  if (level === 'admin') return isAdminish(me) ? ['*'] : [];
  if (me.isAdmin) return wbsList.slice();
  if (!me.empId) return [];
  if (!me.roles.includes(level)) return [];
  if (ownerSupervisor && keyOf(ownerSupervisor) === keyOf(me.name)) return wbsList.slice();
  return wbsList.filter(w => ((staff.get(w) || { sitesup: [], pm: [] })[level] || []).includes(me.empId));
}

async function approvalsOf(env, pairs) {
  // pairs: [{emp_id, period}] → Map 'emp|period|level' → Map wbs → by_name
  const out = new Map();
  if (!pairs.length) return out;
  const emps = [...new Set(pairs.map(p => p.emp_id))];
  const { results } = await env.DB.prepare(`SELECT * FROM ts_approvals WHERE emp_id IN (${ph(emps.length)})`).bind(...emps).all();
  for (const r of results) {
    const k = `${r.emp_id}|${r.period}|${r.level}`;
    if (!out.has(k)) out.set(k, new Map());
    out.get(k).set(r.wbs, r.by_name);
  }
  return out;
}

// Dự án còn thiếu duyệt ở cấp hiện tại
const remainingOf = (wbs, approved) => wbs.filter(w => !(approved && approved.has(w)));

async function pendingDocs(env) {
  const { results } = await env.DB.prepare(`SELECT d.emp_id, d.period, d.version, d.status, d.entry_count, d.submitted_at, d.sitesup_by, d.sitesup_at, d.pm_by, d.note,
      e.full_name, e.position, e.supervisor
    FROM ts_docs d JOIN employees e ON e.emp_id = d.emp_id WHERE d.status IN ('submitted', 'sitesup_ok', 'pm_ok') ORDER BY d.submitted_at LIMIT 400`).all();
  if (!results.length) return { docs: [], wbs: new Map(), appr: new Map() };
  const w = (await env.DB.prepare(`SELECT w.emp_id, w.period, w.wbs FROM ts_doc_wbs w JOIN ts_docs d ON d.emp_id = w.emp_id AND d.period = w.period WHERE d.status IN ('submitted', 'sitesup_ok', 'pm_ok')`).all()).results;
  const wbs = new Map();
  for (const x of w) { const k = x.emp_id + '|' + x.period; if (!wbs.has(k)) wbs.set(k, []); wbs.get(k).push(x.wbs); }
  return { docs: results, wbs, appr: await approvalsOf(env, results) };
}

// Hộp thư duyệt: bảng công còn dự án thuộc phần người này duyệt (hoặc đang chờ Admin xử lý nếu là Admin) + số OT / đơn nghỉ chờ cho huy hiệu
export async function tsInbox(h, env, me) {
  h.need(me, 'sitesup', 'pm', 'projadmin');
  const { docs, wbs, appr } = await pendingDocs(env);
  const staff = await h.projectStaff(env);
  const out = [];
  for (const d of docs) {
    const level = LEVEL_OF[d.status], list = wbs.get(d.emp_id + '|' + d.period) || [];
    if (d.emp_id === me.empId && !me.isAdmin) continue;     // không tự duyệt bảng công của mình
    const cov = covers(me, level, list, staff, d.supervisor);
    const approved = appr.get(`${d.emp_id}|${d.period}|${level}`);
    if (level === 'admin' ? !cov.length : !remainingOf(cov, approved).length) continue;
    out.push({ empId: d.emp_id, name: d.full_name, position: d.position, period: d.period, version: d.version, status: d.status, level, entries: d.entry_count,
      submittedAt: d.submitted_at, sitesupBy: d.sitesup_by, sitesupAt: d.sitesup_at, pmBy: d.pm_by, wbs: list,
      remaining: level === 'admin' ? [] : remainingOf(list, approved), approvedBy: approved ? [...new Set(approved.values())] : [] });
  }
  return h.json({ items: out, ...(await otLeaveCounts(h, env, me, staff)) });
}

async function loadDoc(h, env, emp, period) {
  h.periodParam(period);
  const row = await env.DB.prepare('SELECT d.*, e.full_name, e.position, e.supervisor FROM ts_docs d JOIN employees e ON e.emp_id = d.emp_id WHERE d.emp_id = ? AND d.period = ?').bind(emp, period).first();
  if (!row) throw new h.HttpError(404, 'Không có bảng công này');
  const wbs = (await env.DB.prepare('SELECT wbs FROM ts_doc_wbs WHERE emp_id = ? AND period = ?').bind(emp, period).all()).results.map(x => x.wbs);
  return { row, wbs };
}
export const loadDocForReview = (h, env, me, emp, period) => loadDoc(h, env, emp, period);

// Gửi lại thư "đã duyệt xong" kèm Excel: chỉ Admin / Admin dự án (người xử lý cuối)
export const canResend = (me) => isAdminish(me);

export async function reviewDoc(h, env, me, emp, period) {
  h.need(me, 'sitesup', 'pm', 'projadmin');
  const { row, wbs } = await loadDoc(h, env, emp, period);
  const level = LEVEL_OF[row.status];
  const staff = await h.projectStaff(env);
  const appr = (await approvalsOf(env, [row])).get(`${emp}|${period}|${level}`);
  const self = emp === me.empId && !me.isAdmin;
  const cov = level && !self ? covers(me, level, wbs, staff, row.supervisor) : [];
  const mine = level === 'admin' ? cov.length > 0 : remainingOf(cov, appr).length > 0;
  const resend = row.status === 'approved' && canResend(me);
  if (!mine && !resend && !isAdminish(me) && !cov.length) throw new h.HttpError(403, 'Bạn không phải người duyệt bảng công này');
  let otPending = [];
  try { otPending = await otPendingOfDoc(env, emp, period, JSON.parse(row.data).entries || []); } catch (e) { otPending = []; }
  const all = (await env.DB.prepare('SELECT level, wbs, by_name FROM ts_approvals WHERE emp_id = ? AND period = ?').bind(emp, period).all()).results;
  const text = `{"ok":true,"period":${JSON.stringify(row.period)},"emp":${JSON.stringify(row.emp_id)},"version":${row.version},"status":${JSON.stringify(row.status)}` +
    `,"name":${JSON.stringify(row.full_name)},"position":${JSON.stringify(row.position)},"level":${JSON.stringify(level || '')},"canAct":${!!mine},"canResend":${!!resend},"pmBy":${JSON.stringify(row.pm_by)},"finalBy":${JSON.stringify(row.final_by)},` +
    `"wbs":${JSON.stringify(wbs)},"remaining":${JSON.stringify(level && level !== 'admin' ? remainingOf(wbs, appr) : [])},"approvals":${JSON.stringify(all)},` +
    `"direct":${row.status === 'sitesup_ok' && !row.sitesup_by},"otPending":${JSON.stringify(otPending)},` +
    `"submittedAt":${JSON.stringify(row.submitted_at)},"sitesupBy":${JSON.stringify(row.sitesup_by)},"sitesupAt":${JSON.stringify(row.sitesup_at)},"note":${JSON.stringify(row.note)},"data":${row.data}}`;
  return new Response(text, { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

// File Excel (bảng công, bảng phụ cấp xe) do trình duyệt của Admin tạo khi bấm Process, đính kèm vào thư báo.
// Máy chủ không dựng Excel (ExcelJS nặng so với giới hạn CPU gói miễn phí) nên chỉ kiểm tra: ≤ 3 tệp .xlsx, tên an toàn, đúng chữ ký zip, ≤ 1,5 MB mỗi tệp.
const MAX_FILE_B64 = 2000000;
export function cleanFiles(h, list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 3).map(f => ({ name: h.str(f && f.name, 120).replace(/[^\w.\- ]+/g, '_'), content: String((f && f.content) || '') }))
    .filter(f => /\.xlsx$/i.test(f.name) && f.content.length > 100 && f.content.length <= MAX_FILE_B64 && /^[A-Za-z0-9+/]+={0,2}$/.test(f.content) && f.content.startsWith('UEsD'));
}

// Các bảng công đã duyệt xong gần đây (30 bảng mới nhất) — để gửi lại thư kèm Excel
export async function approvedList(h, env, me) {
  if (!isAdminish(me)) throw new h.HttpError(403, 'Chỉ Admin / Admin dự án gửi lại thư duyệt xong');
  const { results } = await env.DB.prepare(`SELECT d.emp_id, d.period, d.pm_by, d.final_by, d.final_at, e.full_name, e.position FROM ts_docs d JOIN employees e ON e.emp_id = d.emp_id
    WHERE d.status = 'approved' ORDER BY d.final_at DESC, d.pm_at DESC LIMIT 30`).all();
  const w = results.length ? (await env.DB.prepare(`SELECT w.emp_id, w.period, w.wbs FROM ts_doc_wbs w JOIN ts_docs d ON d.emp_id = w.emp_id AND d.period = w.period WHERE d.status = 'approved'`).all()).results : [];
  const wbs = new Map();
  for (const x of w) { const k = x.emp_id + '|' + x.period; if (!wbs.has(k)) wbs.set(k, []); wbs.get(k).push(x.wbs); }
  return h.json({ items: results.map(d => ({ empId: d.emp_id, name: d.full_name, position: d.position, period: d.period, pmBy: d.pm_by, finalBy: d.final_by, finalAt: d.final_at, wbs: wbs.get(d.emp_id + '|' + d.period) || [] })) });
}

export async function resendApproved(h, env, me, emp, period, request) {
  if (!canResend(me)) throw new h.HttpError(403, 'Chỉ Admin / Admin dự án gửi lại thư duyệt xong');
  const body = await h.readJson(request);
  const { row, wbs } = await loadDoc(h, env, emp, period);
  if (row.status !== 'approved') throw new h.HttpError(409, 'Chỉ gửi lại được thư của bảng công đã được Admin xử lý xong');
  const files = cleanFiles(h, body.files);
  if (!files.length) throw new h.HttpError(400, 'Không có file Excel hợp lệ để đính kèm');
  if (!h.mailConfigured(env)) throw new h.HttpError(503, 'Chưa cấu hình gửi email (BREVO_API_KEY, MAIL_FROM)');
  const r = await notifyEvent(env, 'approved', { empId: emp, period, wbs, by: row.final_by || me.name, files, resendBy: me, resend: true });
  await h.audit(env, me, 'ts_resend', 'ts_doc', `${emp}:${period}`, undefined, { files: files.length, ok: !!(r && r.ok) });
  if (!(r && r.ok)) throw new h.HttpError(502, 'Gửi thư không thành công: ' + ((r && r.error) || 'lỗi không rõ') + ' — thử lại sau ít phút');
  return h.json({ ok: true, files: files.length });
}

// Sau khi một cấp đủ duyệt (hoặc không có dự án nào cần duyệt ở cấp đó) → chuyển sang cấp kế. Trả về { status, moved: [các trạng thái đã chuyển tới] }.
export async function settle(h, env, emp, period, status, wbs) {
  const moved = [];
  for (let guard = 0; guard < 3 && NEXT[status]; guard++) {
    const level = LEVEL_OF[status];
    const appr = (await approvalsOf(env, [{ emp_id: emp, period }])).get(`${emp}|${period}|${level}`);
    if (wbs.length && remainingOf(wbs, appr).length) break;          // còn dự án chưa duyệt ở cấp này
    const names = appr ? [...new Set(appr.values())].join(', ') : '';
    const t = h.now(), next = NEXT[status];
    const sql = level === 'sitesup'
      ? "UPDATE ts_docs SET status = ?, sitesup_by = ?, sitesup_at = ? WHERE emp_id = ? AND period = ? AND status = ?"
      : "UPDATE ts_docs SET status = ?, pm_by = ?, pm_at = ? WHERE emp_id = ? AND period = ? AND status = ?";
    const r = await env.DB.prepare(sql).bind(next, names, t, emp, period, status).run();
    if (!(r.meta && r.meta.changes === 1)) break;                    // người khác vừa chuyển
    status = next; moved.push(next);
  }
  return { status, moved };
}

// Gửi thư cho cấp vừa tới
export async function notifyStage(env, status, { empId, period, wbs, by = '' }) {
  if (status === 'submitted') return notifyEvent(env, 'submitted', { empId, period, wbs });
  if (status === 'sitesup_ok') return notifyEvent(env, 'sitesup_ok', { empId, period, wbs, by });
  if (status === 'pm_ok') return notifyEvent(env, 'pm_ok', { empId, period, wbs, by });
  return null;
}

export async function decideDoc(h, env, me, emp, period, action, request) {
  h.need(me, 'sitesup', 'pm', 'projadmin');
  const body = await h.readJson(request);
  const { row, wbs } = await loadDoc(h, env, emp, period);
  const level = LEVEL_OF[row.status];
  if (!level) throw new h.HttpError(409, 'Bảng công này không ở trạng thái chờ duyệt');
  if (emp === me.empId && !me.isAdmin) throw new h.HttpError(403, 'Không tự duyệt bảng công của chính mình');
  const staff = await h.projectStaff(env);
  const cov = covers(me, level, wbs, staff, row.supervisor);
  const appr = (await approvalsOf(env, [row])).get(`${emp}|${period}|${level}`);
  const todo = level === 'admin' ? cov : remainingOf(cov, appr);
  if (!todo.length) throw new h.HttpError(403, level === 'admin' ? 'Chỉ Admin / Admin dự án xử lý cuối bảng công này'
    : (cov.length ? 'Bạn đã duyệt các dự án của mình trong bảng công này — chờ người duyệt các dự án còn lại' : 'Bạn không phải người duyệt bảng công này ở cấp hiện tại'));
  const t = h.now();
  if (action === 'reject') {
    const note = h.str(body.note, 500);
    if (note.length < 3) throw new h.HttpError(400, 'Cần ghi lý do trả lại (để người chấm công biết sửa gì)');
    const r = await env.DB.prepare("UPDATE ts_docs SET status = 'rejected', note = ?, submitted_at = '' WHERE emp_id = ? AND period = ? AND status = ?").bind(`${me.name}: ${note}`, emp, period, row.status).run();
    if (!(r.meta && r.meta.changes === 1)) throw new h.HttpError(409, 'Bảng công vừa thay đổi — tải lại danh sách');
    await env.DB.prepare('DELETE FROM ts_approvals WHERE emp_id = ? AND period = ?').bind(emp, period).run();
    await h.audit(env, me, 'ts_reject', 'ts_doc', `${emp}:${period}`, { status: row.status }, { note });
    await notifyEvent(env, 'rejected', { empId: emp, period, wbs, note: `${me.name}: ${note}` });
    return h.json({ ok: true, status: 'rejected' });
  }
  if (level !== 'admin') {
    // ghi các dự án người này duyệt, rồi xem cấp đã đủ chưa
    await env.DB.batch(todo.map(w => env.DB.prepare('INSERT OR IGNORE INTO ts_approvals (emp_id, period, level, wbs, by_emp, by_name, at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(emp, period, level, w, me.empId || '', me.name, t)));
    const s = await settle(h, env, emp, period, row.status, wbs);
    await h.audit(env, me, level === 'sitesup' ? 'ts_sitesup_ok' : 'ts_pm_ok', 'ts_doc', `${emp}:${period}`, undefined, { wbs: todo, status: s.status });
    if (s.moved.length) await notifyStage(env, s.status, { empId: emp, period, wbs, by: me.name });
    const left = s.status === row.status ? remainingOf(wbs, (await approvalsOf(env, [row])).get(`${emp}|${period}|${level}`)) : [];
    return h.json({ ok: true, status: s.status, approved: todo, remaining: left });
  }
  // Admin xử lý cuối → đã duyệt xong
  const r = await env.DB.prepare("UPDATE ts_docs SET status = 'approved', final_by = ?, final_at = ? WHERE emp_id = ? AND period = ? AND status = 'pm_ok'").bind(me.name, t, emp, period).run();
  if (!(r.meta && r.meta.changes === 1)) throw new h.HttpError(409, 'Bảng công vừa thay đổi — tải lại danh sách');
  let pushed;
  try { pushed = await h.pushApprovedRows(env, me, row, period); }
  catch (e) {   // chưa đẩy được → trả về cấp trước để xử lý lại, không để trạng thái "đã duyệt" mà dữ liệu chưa sang
    await env.DB.prepare("UPDATE ts_docs SET status = 'pm_ok', final_by = '', final_at = '' WHERE emp_id = ? AND period = ? AND status = 'approved'").bind(emp, period).run();
    throw e;
  }
  await h.audit(env, me, 'ts_approved', 'ts_doc', `${emp}:${period}`, undefined, { rows: pushed });
  await notifyEvent(env, 'approved', { empId: emp, period, wbs, by: me.name, pushed, files: cleanFiles(h, body.files), resendBy: me });
  return h.json({ ok: true, status: 'approved', pushed });
}

// Thu hồi: chỉ khi chưa ai duyệt (chưa có dòng ts_approvals)
export async function withdrawDoc(h, env, emp, period) {
  const n = (await env.DB.prepare('SELECT COUNT(*) c FROM ts_approvals WHERE emp_id = ? AND period = ?').bind(emp, period).first()).c;
  if (n) throw new h.HttpError(409, 'Đã có người duyệt một phần bảng công này nên không thu hồi được — nhờ người duyệt trả lại');
  const r = await env.DB.prepare("UPDATE ts_docs SET status = 'draft', submitted_at = '' WHERE emp_id = ? AND period = ? AND (status = 'submitted' OR (status = 'sitesup_ok' AND sitesup_by = ''))").bind(emp, period).run();
  if (!(r.meta && r.meta.changes === 1)) throw new h.HttpError(409, 'Chỉ thu hồi được khi chưa ai duyệt');
}

export { projectWbs };
