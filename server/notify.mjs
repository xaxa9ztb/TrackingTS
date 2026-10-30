// Thư tự động của luồng bảng công: thông báo khi nộp / duyệt / trả lại (gửi ngay từ API),
// báo cáo thi công cuối ngày và nhắc hạn (chạy theo lịch trong cron/worker.mjs).
// Mọi hàm ở đây KHÔNG ném lỗi ra ngoài — thư hỏng không được làm hỏng nộp / duyệt bảng công.
import { effectiveRoles, adminEmails } from './roles.mjs';
import { keyOf } from './supervisors.mjs';
import { entryHours, allowanceSummary, periodRange } from './tsdoc.mjs';
import { mailConfigured, sendMail, sendMailBatch, esc, layout } from './mail.mjs';
import OtLeave from '../tools/timesheet/otleave.js';
import Labor from '../tools/timesheet/labor.js';

const LEAVE_CODES = ['6010', '6020', '6090'];
const MAX_MAILS_PER_RUN = 40;      // gói miễn phí: tối đa 50 lần gọi ra ngoài mỗi lần chạy (gồm cả truy vấn D1)
const WEEKDAY = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const fmtH = (h) => (Math.round(h * 10) / 10).toString().replace('.', ',');
const fmtDMY = (s) => String(s).split('-').reverse().join('/');
const fmtDM = (s) => String(s).split('-').reverse().slice(0, 2).join('/');
const periodLabel = (p) => `${parseInt(p.slice(5), 10)}/${p.slice(0, 4)}`;
const link = (env, path) => (env.APP_URL ? String(env.APP_URL).replace(/\/+$/, '') + path : '');
// mở thẳng bảng công này trong trang Duyệt bảng công (tools/approvals/app.js đọc #xem=…)
const reviewLink = (env, empId, period) => link(env, `/tools/approvals/#xem=${encodeURIComponent(empId)}/${period}`);

// Ngày giờ Việt Nam (UTC+7) của một thời điểm
export const vnDate = (d = new Date()) => new Date(d.getTime() + 7 * 36e5).toISOString().slice(0, 10);
function weekdayOf(date) { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
// ngày 16 trở đi thuộc kỳ của tháng sau
export function periodOfDate(date) {
  let y = +date.slice(0, 4), m = +date.slice(5, 7);
  if (+date.slice(8, 10) >= 16) { m += 1; if (m > 12) { m = 1; y += 1; } }
  return `${y}-${String(m).padStart(2, '0')}`;
}

// Admin / Admin dự án (nhận bảng công chờ xử lý cuối): email trong ADMIN_EMAILS + nhân viên có vai trò admin / projadmin
export async function adminsFor(env) {
  const out = new Map();
  adminEmails(env).forEach(email => out.set(email, { email, name: '' }));
  const { results } = await env.DB.prepare("SELECT full_name, email FROM employees WHERE active = 1 AND email <> '' AND (role_override = 'admin' OR extra_role = 'projadmin')").all();
  results.forEach(e => { const k = String(e.email).toLowerCase(); out.set(k, { email: k, name: e.full_name || '' }); });
  return [...out.values()];
}

// Quản lý trực tiếp (theo tên trong cột Giám sát của EE Data) — bất kể vai trò — có email
async function directSupervisors(env, name, ctx = {}) {
  if (!name) return [];
  if (!ctx.emps) ctx.emps = (await env.DB.prepare("SELECT * FROM employees WHERE active = 1 AND email <> ''").all()).results;
  return ctx.emps.filter(e => keyOf(e.full_name) === keyOf(name)).map(e => ({ email: String(e.email).toLowerCase(), name: e.full_name }));
}

// Giám sát (Site Sup / Quản lý dự án): chỉ chấm giờ OT, đăng ký OT trước khi làm, Quản lý dự án duyệt, bảng công cuối kỳ nộp thẳng QLDA. e: dòng employees.
export const isLead = (env, e) => { const r = e ? effectiveRoles(e, e.email, env) : []; return r.includes('sitesup') || r.includes('pm'); };

const prevPeriodOf = (p) => { let y = +p.slice(0, 4), m = +p.slice(5, 7) - 1; if (m < 1) { m = 12; y -= 1; } return `${y}-${String(m).padStart(2, '0')}`; };
const ph = (n) => Array.from({ length: n }, () => '?').join(', ');

// Người được thông báo ở mỗi cấp duyệt: người được gán cho các dự án trong bảng công, hoặc "Quản lý trực tiếp" của người nộp (cấp Site Sup);
// không ai thì gửi admin để bảng công không bị bỏ quên.
export async function approversFor(env, level, wbsList, ownerSupervisor, ctx = {}, { fallback = true } = {}) {
  const out = new Map();
  const add = (e) => { const k = String(e.email || '').toLowerCase(); if (k) out.set(k, { email: k, name: e.full_name || '' }); };
  const wbs = [...new Set((wbsList || []).filter(Boolean))].slice(0, 30);
  if (wbs.length) {
    const { results } = await env.DB.prepare(`SELECT e.full_name, e.email FROM project_staff s JOIN employees e ON e.emp_id = s.emp_id
      WHERE s.role = ? AND s.wbs IN (${ph(wbs.length)}) AND e.active = 1 AND e.email <> ''`).bind(level, ...wbs).all();
    results.forEach(add);
  }
  if (ownerSupervisor) {     // Quản lý trực tiếp: Site Sup của fitter (cấp Site Sup) / Quản lý dự án của giám sát (cấp QLDA)
    if (!ctx.emps) ctx.emps = (await env.DB.prepare("SELECT * FROM employees WHERE active = 1 AND email <> ''").all()).results;
    ctx.emps.filter(e => keyOf(e.full_name) === keyOf(ownerSupervisor) && effectiveRoles(e, e.email, env).includes(level)).forEach(add);
  }
  if (!out.size && fallback) {
    adminEmails(env).forEach(email => out.set(email, { email, name: '' }));
    if (!ctx.admins) ctx.admins = (await env.DB.prepare("SELECT full_name, email FROM employees WHERE active = 1 AND email <> '' AND role_override = 'admin'").all()).results;
    ctx.admins.forEach(add);
  }
  return [...out.values()];
}

// Như approversFor nhưng dựng sẵn từ MỘT lượt truy vấn (batch) — dùng cho thư hằng ngày, nơi có nhiều bảng công
// cần tìm người duyệt mà cron gói miễn phí giới hạn số lượt gọi D1.
async function approverIndex(env) {
  const [st, em] = await env.DB.batch([
    env.DB.prepare("SELECT s.wbs, s.role, e.full_name, e.email FROM project_staff s JOIN employees e ON e.emp_id = s.emp_id WHERE e.active = 1 AND e.email <> ''"),
    env.DB.prepare("SELECT * FROM employees WHERE active = 1 AND email <> ''"),
  ]);
  const person = (e) => ({ email: String(e.email).toLowerCase(), name: e.full_name || '' });
  const byWbs = new Map();     // wbs → { sitesup: [], pm: [] }
  for (const r of st.results) {
    const k = String(r.wbs || '').trim();
    if (!byWbs.has(k)) byWbs.set(k, { sitesup: [], pm: [] });
    if (byWbs.get(k)[r.role]) byWbs.get(k)[r.role].push(person(r));
  }
  const sups = em.results.filter(e => effectiveRoles(e, e.email, env).includes('sitesup'));
  const pms = em.results.filter(e => effectiveRoles(e, e.email, env).includes('pm'));
  const admins = [...adminEmails(env).map(email => ({ email, name: '' })), ...em.results.filter(e => e.role_override === 'admin').map(person)];
  const projAdmins = em.results.filter(e => e.extra_role === 'projadmin').map(person);
  const direct = (name) => (name ? sups.filter(e => keyOf(e.full_name) === keyOf(name)).map(person) : []);
  const directAny = (name) => (name ? em.results.filter(e => keyOf(e.full_name) === keyOf(name)).map(person) : []);
  const directPm = (name) => (name ? pms.filter(e => keyOf(e.full_name) === keyOf(name)).map(person) : []);
  const uniq = (list) => { const m = new Map(); list.forEach(p => { if (p.email && !m.has(p.email)) m.set(p.email, p); }); return [...m.values()]; };
  return {
    direct, directAny, admins: () => uniq(admins), adminish: () => uniq([...admins, ...projAdmins]),
    staff: (wbs) => { const x = byWbs.get(String(wbs || '').trim()); return x ? uniq([...x.sitesup, ...x.pm]) : []; },
    approvers(level, wbsList, ownerSupervisor, approvedSet) {
      const todo = (wbsList || []).filter(w => !(approvedSet && approvedSet.has(w)));      // dự án đã được duyệt ở cấp này thì không nhắc nữa
      if (approvedSet && (wbsList || []).length && !todo.length) return [];
      let out = todo.flatMap(w => (byWbs.get(w) || {})[level] || []);
      out = out.concat(level === 'sitesup' ? direct(ownerSupervisor) : directPm(ownerSupervisor));
      out = uniq(out);
      return out.length ? out : uniq(admins);
    },
  };
}

// Tổng giờ của một bảng công (theo phân loại giờ bd đã lưu khi nộp)
function docTotals(data) {
  let total = 0, normal = 0;
  const entries = (data && Array.isArray(data.entries)) ? data.entries : [];
  const days = new Set();
  for (const e of entries) {
    const bd = e && e.bd && typeof e.bd === 'object' ? e.bd : null;
    const h = bd ? Object.values(bd).reduce((a, v) => a + (typeof v === 'number' ? v : 0), 0) : entryHours(e);
    total += h; normal += bd && typeof bd.NORMAL === 'number' ? bd.NORMAL : (bd ? 0 : h);
    if (e && e.date && !LEAVE_CODES.includes(String(e.activityCode))) days.add(e.date);
  }
  return { total, normal, ot: Math.max(0, total - normal), days: days.size, lines: entries.length, allow: allowanceSummary(data) };
}

async function ownerOf(env, empId) {
  return env.DB.prepare('SELECT emp_id, full_name, email, supervisor FROM employees WHERE emp_id = ?').bind(empId).first();
}

// kind: 'submitted' | 'sitesup_ok' | 'approved' | 'rejected'
export async function notifyEvent(env, kind, { empId, period, wbs = [], by = '', note = '', pushed = 0, files = [], resendBy = null, resend = false, otPending = [], lead = false }) {
  try {
    if (!mailConfigured(env)) return { ok: false, skipped: true };
    const owner = await ownerOf(env, empId);
    if (!owner) return { ok: false, skipped: true };
    const who = `${owner.full_name} (${empId})`, kp = `kỳ lương ${periodLabel(period)}`;
    const review = reviewLink(env, empId, period), mine = link(env, '/tools/timesheet/');
    let to, subject, html, cc = [];
    if (kind === 'pm_ok') {
      // đã qua mọi Site Sup và Quản lý dự án của các dự án → chờ Admin / Admin dự án xử lý cuối
      to = await adminsFor(env);
      const row = await env.DB.prepare('SELECT data FROM ts_docs WHERE emp_id = ? AND period = ?').bind(empId, period).first();
      let t = null;
      try { t = row ? docTotals(JSON.parse(row.data)) : null; } catch (e) { t = null; }
      return await sendMail(env, { to, subject: `[Bảng công] ${owner.full_name} — ${kp}: chờ Admin xử lý cuối`,
        html: layout('Bảng công chờ Admin xử lý', `<p>Bảng công ${esc(kp)} của <b>${esc(who)}</b> đã được Site Sup và Quản lý dự án của các dự án duyệt xong.</p>
          ${t ? `<p style="background:#f8fafc;border:1px solid #e5e7eb;padding:10px;border-radius:6px"><b>${fmtH(t.total)} giờ</b> (thường ${fmtH(t.normal)}, tăng ca ${fmtH(t.ot)}) · ${t.days} ngày làm việc</p>` : ''}
          ${t && t.allow ? `<p style="background:#fffbeb;border:1px solid #fde68a;padding:10px;border-radius:6px"><b>Phụ cấp xe:</b> ${esc(t.allow)}</p>` : ''}
          ${wbs.length ? `<p>Dự án: ${esc(wbs.join(', '))}</p>` : ''}
          <p>Admin xem các <b>hoạt động ngoài dự án</b> (họp, huấn luyện, nghỉ…), bấm <b>Process</b>: dữ liệu sang bảng Theo dõi giờ công và hệ thống gửi thư kèm Excel cho Fitter, Site Sup, Quản lý dự án.</p>`, { url: review, label: 'Mở bảng công để xử lý' }) });
    }
    if (kind === 'admin_edit') {
      // báo người chủ bảng công: Quản trị viên đã sửa (kèm ghi chú); người không có tài khoản (không có email) thì thôi
      if (!owner.email) return { ok: false, skipped: true };
      return await sendMail(env, { to: [{ email: owner.email, name: owner.full_name }], subject: `[Bảng công] Quản trị viên đã sửa bảng công ${kp} của bạn`,
        html: layout('Quản trị viên đã sửa bảng công', `<p><b>${esc(by)}</b> (quản trị viên) đã sửa bảng công ${esc(kp)} của bạn.</p>${box('#fffbeb', '#fde68a', `<b>Ghi chú:</b> ${esc(note)}`)}
          <p>Mở Timesheet để xem các dòng bị sửa (đánh dấu <b>Admin sửa</b>). Nếu chưa đúng, liên hệ quản trị viên.</p>`, { url: mine, label: 'Mở Timesheet' }) });
    }
    if (kind === 'ot_unapproved') {
      // Bảng công đã nộp nhưng còn ngày tăng ca chưa duyệt: nhắc người nộp và người duyệt OT (Site Sup; giám sát → Quản lý dự án)
      const days = otPending.slice().sort((a, b) => a.date.localeCompare(b.date));
      const list = days.map(d => `<li>${esc(WEEKDAY[weekdayOf(d.date)])} ${esc(fmtDMY(d.date))} — ${fmtH(d.ot)} giờ${d.status === 'rejected' ? ' <b style="color:#b91c1c">(đã bị từ chối)</b>' : ' <span style="color:#b45309">(chờ duyệt)</span>'}</li>`).join('');
      const total = days.reduce((a, d) => a + d.ot, 0);
      const approvers = await approversFor(env, lead ? 'pm' : 'sitesup', wbs, owner.supervisor);
      const sends = [];
      if (owner.email) sends.push({ to: [{ email: owner.email, name: owner.full_name }], subject: `[Tăng ca] Bảng công ${periodLabel(period)} đã nộp nhưng còn ${days.length} ngày tăng ca chưa được duyệt`,
        html: layout('Còn tăng ca chưa được duyệt', `<p>Bảng công ${esc(kp)} của bạn đã được nhận. Tuy nhiên còn <b>${days.length} ngày tăng ca (${fmtH(total)} giờ)</b> chưa được ${lead ? 'Quản lý dự án' : 'Site Sup'} duyệt:</p><ul>${list}</ul>
          <p>Giờ tăng ca chưa duyệt có thể không được tính. Hãy liên hệ ${lead ? 'Quản lý dự án' : 'Site Sup'} để được duyệt${days.some(d => d.status === 'rejected') ? '; ngày bị từ chối cần sửa giờ rồi gửi lại' : ''}.</p>`, { url: mine, label: 'Mở Timesheet' }) });
      if (approvers.length) sends.push({ to: approvers, subject: `[Tăng ca] ${owner.full_name} nộp bảng công ${periodLabel(period)} — còn ${days.length} ngày tăng ca chờ bạn duyệt`,
        html: layout('Tăng ca chờ bạn duyệt', `<p>${esc(who)} đã nộp bảng công ${esc(kp)} nhưng còn <b>${days.length} ngày tăng ca (${fmtH(total)} giờ)</b> chưa được duyệt:</p><ul>${list}</ul>
          <p>Vào <b>Duyệt bảng công → Tăng ca chờ duyệt</b> để duyệt hoặc không duyệt (kèm lý do).</p>`, { url: link(env, '/tools/approvals/#tangca'), label: 'Mở Tăng ca chờ duyệt' }) });
      let last = { ok: false, skipped: true };
      for (const m of sends) last = await sendMail(env, m);
      return last;
    }
    if (kind === 'submitted' || kind === 'sitesup_ok' || kind === 'submitted_direct') {
      const level = kind === 'submitted' ? 'sitesup' : 'pm';
      to = await approversFor(env, level, wbs, owner.supervisor);
      const row = await env.DB.prepare('SELECT data FROM ts_docs WHERE emp_id = ? AND period = ?').bind(empId, period).first();
      let t = null;
      try { t = row ? docTotals(JSON.parse(row.data)) : null; } catch (e) { t = null; }
      subject = `[Bảng công] ${owner.full_name} đã nộp ${kp}${kind === 'submitted_direct' ? ' (giờ tăng ca)' : ''} — chờ ${level === 'pm' ? 'Quản lý dự án' : 'Site Sup'} duyệt`;
      html = layout(`Có bảng công chờ bạn duyệt`, `<p>${esc(who)} ${kind === 'sitesup_ok' ? 'đã được Site Sup ' + esc(by) + ' duyệt' : 'đã nộp'} bảng công ${esc(kp)}${kind === 'submitted_direct' ? ' — bảng công của giám sát, <b>chỉ gồm giờ tăng ca</b>, nộp thẳng Quản lý dự án' : ''}.</p>
        ${t ? `<p style="background:#f8fafc;border:1px solid #e5e7eb;padding:10px;border-radius:6px"><b>${fmtH(t.total)} giờ</b> (thường ${fmtH(t.normal)}, tăng ca ${fmtH(t.ot)}) · ${t.days} ngày làm việc · ${t.lines} dòng chấm công</p>` : ''}
        ${t && t.allow ? `<p style="background:#fffbeb;border:1px solid #fde68a;padding:10px;border-radius:6px"><b>Phụ cấp xe:</b> ${esc(t.allow)}</p>` : ''}
        ${wbs.length ? `<p>Dự án: ${esc(wbs.join(', '))}</p>` : ''}<p>Bấm nút dưới để mở thẳng bảng công này trong <b>Duyệt bảng công</b>: xem chi tiết, duyệt hoặc trả lại kèm lý do.</p>`, { url: review, label: 'Mở bảng công để duyệt' });
    } else if (kind === 'approved') {
      // người nộp (To) + Site Sup của các dự án trong bảng công / Quản lý trực tiếp (CC); không có ai thì không báo admin
      to = owner.email ? [{ email: owner.email, name: owner.full_name }] : [];
      // Fitter (To); CC: Site Sup + Quản lý dự án của các dự án trong bảng công, Quản lý trực tiếp (Site Sup / QLDA), Admin xử lý
      const ctx = {};
      cc = (await approversFor(env, 'sitesup', wbs, owner.supervisor, ctx, { fallback: false })).concat(await approversFor(env, 'pm', wbs, owner.supervisor, ctx, { fallback: false }));
      // thư luôn CC Quản lý dự án đã duyệt bảng công này (hoặc người bấm gửi lại)
      if (resendBy && resendBy.email) cc = cc.concat([{ email: String(resendBy.email).toLowerCase(), name: resendBy.name || '' }]);
      const row = await env.DB.prepare('SELECT data FROM ts_docs WHERE emp_id = ? AND period = ?').bind(empId, period).first();
      let t = null;
      try { t = row ? docTotals(JSON.parse(row.data)) : null; } catch (e) { t = null; }
      subject = `[Bảng công] ${owner.full_name} — ${kp} đã được duyệt xong${files.length ? ' (kèm Excel)' : ''}`;
      if (resend) subject = '[Gửi lại] ' + subject.replace(/^\[Bảng công\] /, '');
      html = layout('Bảng công đã được duyệt', `<p>Bảng công ${esc(kp)} của <b>${esc(who)}</b> đã được ${esc(by)} duyệt xong.${pushed ? ` ${pushed} dòng đã chuyển sang bảng Theo dõi giờ công.` : ''}</p>
        ${t ? `<p style="background:#f8fafc;border:1px solid #e5e7eb;padding:10px;border-radius:6px"><b>${fmtH(t.total)} giờ</b> (thường ${fmtH(t.normal)}, tăng ca ${fmtH(t.ot)}) · ${t.days} ngày làm việc</p>` : ''}
        ${t && t.allow ? `<p style="background:#fffbeb;border:1px solid #fde68a;padding:10px;border-radius:6px"><b>Phụ cấp xe:</b> ${esc(t.allow)}</p>` : ''}
        ${wbs.length ? `<p>Dự án: ${esc(wbs.join(', '))}</p>` : ''}
        ${files.length ? `<p><b>Đính kèm:</b></p><ul style="margin:0;padding-left:18px">${files.map(f => `<li>${esc(f.name)}</li>`).join('')}</ul>` : `<p style="color:#6b7280">Thư này không kèm file Excel (không tạo được lúc duyệt) — tải bảng công và phụ cấp ngay trong Timesheet (Xuất Excel / Tải form phụ cấp).</p>`}`, { url: mine, label: 'Mở Timesheet' });
    } else if (kind === 'rejected') {
      to = owner.email ? [{ email: owner.email, name: owner.full_name }] : [];
      subject = `[Bảng công] ${kp} bị trả lại — cần sửa`;
      html = layout('Bảng công bị trả lại', `<p>Bảng công ${esc(kp)} của bạn đã bị trả lại.</p><p style="background:#fef2f2;border:1px solid #fecaca;padding:10px;border-radius:6px"><b>Lý do:</b> ${esc(note)}</p>
        <p>Mở Timesheet, sửa rồi bấm <b>Nộp bảng công</b> lại.</p>`, { url: mine, label: 'Mở Timesheet' });
    } else return { ok: false, skipped: true };
    return await sendMail(env, { to, cc, subject, html, attachments: files });
  } catch (e) { console.error('notifyEvent', e); return { ok: false, error: 'Lỗi soạn thư' }; }
}

const LEAVE_LABEL = { '6010': 'Nghỉ phép năm', '6020': 'Nghỉ ốm', '6090': 'Nghỉ không lương' };
const box = (bg, bd, html) => `<p style="background:${bg};border:1px solid ${bd};padding:10px;border-radius:6px">${html}</p>`;
const leaveSpan = (l) => l.date_from === l.date_to ? fmtDMY(l.date_from) : `${fmtDMY(l.date_from)} → ${fmtDMY(l.date_to)}`;
function leaveCount(l) {
  let days = [];
  try { days = JSON.parse(l.days || '[]'); } catch (e) { days = []; }
  return days.reduce((a, d) => a + (d.half ? 0.5 : 1), 0);
}

// Giám sát đăng ký OT trước khi làm → Quản lý dự án duyệt (một thư cho các ngày vừa gửi). owner: dòng employees của giám sát.
export async function notifyOtRequest(env, { owner, days }) {
  try {
    if (!mailConfigured(env) || !days.length) return { ok: false, skipped: true };
    const wbs = [...new Set(days.flatMap(d => String(d.wbs || '').split(',').filter(Boolean)))];
    const to = await approversFor(env, 'pm', wbs, owner.supervisor);
    const sorted = days.slice().sort((a, b) => a.date.localeCompare(b.date));
    const lines = sorted.map(d => `<li>${esc(WEEKDAY[weekdayOf(d.date)])} ${esc(fmtDMY(d.date))} — <b>${fmtH(d.ot)} giờ</b>${d.items && d.items[0] ? ` · ${esc(d.items.map(i => `${i.start}–${i.end}`).join(', '))}` : ''}${d.items && d.items[0] && d.items[0].project ? ` · ${esc(d.items[0].project)}` : ''}${d.date < vnDate() ? ' <span style="color:#b91c1c">(đăng ký sau ngày làm)</span>' : ''}</li>`).join('');
    const total = sorted.reduce((a, d) => a + d.ot, 0);
    return await sendMail(env, { to, subject: `[Tăng ca] ${owner.full_name} đăng ký ${sorted.length} ngày tăng ca (${fmtH(total)} giờ) — chờ bạn duyệt`,
      html: layout('Giám sát đăng ký tăng ca', `<p>${esc(owner.full_name)} (${esc(owner.emp_id)}) đăng ký tăng ca${sorted.length > 1 ? ` ${sorted.length} ngày` : ''}:</p><ul>${lines}</ul>
        <p>Giám sát đăng ký tăng ca <b>trước khi làm</b>; Quản lý dự án duyệt tại <b>Duyệt bảng công → Tăng ca chờ duyệt</b>.</p>`, { url: link(env, '/tools/approvals/#tangca'), label: 'Mở Tăng ca chờ duyệt' }) });
  } catch (e) { console.error('notifyOtRequest', e); return { ok: false, error: 'Lỗi soạn thư' }; }
}

// Kết quả duyệt tăng ca → fitter (một thư cho các ngày được duyệt / không duyệt cùng lúc)
export async function notifyOt(env, { empId, action, by, note = '', days = [] }) {
  try {
    if (!mailConfigured(env) || !days.length) return { ok: false, skipped: true };
    const owner = await ownerOf(env, empId);
    if (!owner || !owner.email) return { ok: false, skipped: true };
    const ok = action === 'approve', list = days.slice().sort((a, b) => a.date.localeCompare(b.date));
    const lines = list.map(d => `<li>${esc(WEEKDAY[weekdayOf(d.date)])} ${esc(fmtDMY(d.date))} — tăng ca <b>${fmtH(d.ot)} giờ</b></li>`).join('');
    const total = list.reduce((a, d) => a + (+d.ot || 0), 0);
    const subject = ok ? `[Tăng ca] Đã duyệt ${list.length} ngày tăng ca (${fmtH(total)} giờ)` : `[Tăng ca] ${list.length} ngày tăng ca KHÔNG được duyệt — cần sửa`;
    const html = layout(ok ? 'Tăng ca đã được duyệt' : 'Tăng ca không được duyệt', `<p>${esc(by)} đã ${ok ? 'duyệt' : '<b>không duyệt</b>'} tăng ca của bạn:</p><ul>${lines}</ul>`
      + (ok ? '<p>Nếu sửa giờ của các ngày này, tăng ca sẽ phải duyệt lại.</p>'
        : box('#fef2f2', '#fecaca', `<b>Lý do:</b> ${esc(note)}`) + '<p>Mở Timesheet, sửa giờ của các ngày này (bỏ phần tăng ca hoặc ghi rõ báo cáo thi công) — tăng ca sẽ tự gửi duyệt lại.</p>'),
      { url: link(env, '/tools/timesheet/'), label: 'Mở Timesheet' });
    return await sendMail(env, { to: [{ email: owner.email, name: owner.full_name }], subject, html });
  } catch (e) { console.error('notifyOt', e); return { ok: false, error: 'Lỗi soạn thư' }; }
}

// Đơn nghỉ: 'request' → người duyệt (Site Sup / QLDA của dự án + Quản lý trực tiếp); 'approved' | 'rejected' → fitter
export async function notifyLeave(env, kind, { leave, written = '' }) {
  try {
    if (!mailConfigured(env)) return { ok: false, skipped: true };
    const owner = await ownerOf(env, leave.emp_id);
    if (!owner) return { ok: false, skipped: true };
    const what = `${LEAVE_LABEL[leave.type] || 'Nghỉ'} ${leaveSpan(leave)} (${fmtH(leaveCount(leave))} ngày công)`;
    let to, subject, html;
    if (kind === 'request') {
      // Người duyệt = Quản lý trực tiếp của người xin nghỉ (không có / không có email → admin)
      const ctx = {};
      const sup = await directSupervisors(env, owner.supervisor, ctx);
      to = sup.length ? sup : await approversFor(env, 'sitesup', [], '', ctx);
      const by = OtLeave.fmtDeadline(OtLeave.approveDeadlineMs(leave.type, leave.date_from, leave.date_to));
      subject = `[Đơn nghỉ] ${owner.full_name} xin ${what} — duyệt trước ${by}`;
      html = layout('Có đơn nghỉ chờ bạn duyệt', `<p>${esc(owner.full_name)} (${esc(owner.emp_id)}) xin <b>${esc(what)}</b>.</p>`
        + (leave.reason ? box('#f8fafc', '#e5e7eb', `<b>Lý do:</b> ${esc(leave.reason)}`) : '')
        + `<p>Bạn là <b>quản lý trực tiếp</b> nên duyệt đơn này. Hạn duyệt: <b>${esc(by)}</b>. Duyệt xong, các ngày nghỉ tự ghi vào bảng công của ${esc(owner.full_name)}.</p>`,
        { url: link(env, '/tools/leave/'), label: 'Mở Nghỉ phép / ốm để duyệt' });
    } else if (kind === 'approved' || kind === 'rejected') {
      if (!owner.email) return { ok: false, skipped: true };
      to = [{ email: owner.email, name: owner.full_name }];
      const ok = kind === 'approved';
      subject = ok ? `[Đơn nghỉ] Đã duyệt: ${what}` : `[Đơn nghỉ] Không được duyệt: ${what}`;
      html = layout(ok ? 'Đơn nghỉ đã được duyệt' : 'Đơn nghỉ không được duyệt', `<p>${esc(leave.decided_by)} đã ${ok ? 'duyệt' : '<b>không duyệt</b>'} đơn <b>${esc(what)}</b> của bạn.</p>`
        + (ok ? box('#f0fdf4', '#bbf7d0', `Các ngày nghỉ đã tự ghi vào bảng công của bạn${written ? ` (${esc(written)})` : ''}. Không cần chấm công những ngày này.`)
          : box('#fef2f2', '#fecaca', `<b>Lý do:</b> ${esc(leave.note)}`)),
        { url: link(env, '/tools/timesheet/'), label: 'Mở Timesheet' });
    } else return { ok: false, skipped: true };
    return await sendMail(env, { to, subject, html });
  } catch (e) { console.error('notifyLeave', e); return { ok: false, error: 'Lỗi soạn thư' }; }
}

// ---------- báo cáo thi công cuối ngày ----------
async function loggedKeys(env, prefix) {
  const { results } = await env.DB.prepare('SELECT key FROM mail_log WHERE key LIKE ?').bind(prefix + '%').all();
  return new Set(results.map(r => r.key));
}
async function logKeys(env, keys) {
  if (!keys.length) return;
  const t = new Date().toISOString();
  await env.DB.batch(keys.map(k => env.DB.prepare('INSERT OR IGNORE INTO mail_log (key, sent_at) VALUES (?, ?)').bind(k, t)));
}

// Mỗi Site Sup / Quản lý dự án một thư hằng ngày (18:30), gồm:
//   📝 các dòng chấm công trong ngày của fitter thuộc dự án họ phụ trách (kèm báo cáo thi công),
//   ⏳ bảng công đang chờ CHÍNH họ duyệt (bấm là mở thẳng bảng công đó),
//   ⏱ ngày tăng ca chờ họ duyệt (Site Sup duyệt hằng ngày), 🏖 đơn nghỉ chờ họ duyệt (phải duyệt trước ngày bắt đầu),
//   ⚠️ fitter họ quản lý trực tiếp đang dùng Timesheet mà hôm nay chưa chấm công (T2–T7).
// Chỉ đọc đúng các dòng của ngày (json_each trong D1); mọi tra cứu khác gom vào 2 lượt batch (giới hạn lượt gọi của cron).
export async function runDigest(env, { now = new Date() } = {}) {
  const summary = { date: vnDate(now), entries: 0, pending: 0, ot: 0, leave: 0, missing: 0, recipients: 0, sent: 0, failed: 0, skipped: 0, errors: [] };
  try {
    if (!mailConfigured(env)) { summary.skipped = 1; summary.errors.push('Chưa cấu hình gửi email'); return summary; }
    const date = summary.date, period = periodOfDate(date), workday = weekdayOf(date) !== 0;
    // đầu ngày Việt Nam (ms) — các dòng có u (thời điểm sửa) từ đây trở đi là chấm hôm nay; dùng để gộp ngày chấm bù vào MỘT thư
    const dayStartMs = Date.parse(date + 'T00:00:00+07:00');
    const [rowsQ, pendQ, wbsQ, openQ, otQ, leaveQ, lateQ, datesQ, apprQ] = await env.DB.batch([
      env.DB.prepare(`SELECT d.emp_id, e.full_name, e.supervisor,
          json_extract(x.value, '$.projectName') pn, json_extract(x.value, '$.workNumber') wbs, json_extract(x.value, '$.startTime') st,
          json_extract(x.value, '$.endTime') et, json_extract(x.value, '$.breakTime') br, json_extract(x.value, '$.activityCode') ac,
          json_extract(x.value, '$.report') rp, json_extract(x.value, '$.remarks') rm
        FROM ts_docs d JOIN employees e ON e.emp_id = d.emp_id, json_each(d.data, '$.entries') x
        WHERE d.period = ? AND json_extract(x.value, '$.date') = ?`).bind(period, date),
      env.DB.prepare(`SELECT d.emp_id, d.period, d.status, d.submitted_at, e.full_name, e.supervisor FROM ts_docs d JOIN employees e ON e.emp_id = d.emp_id
        WHERE d.status IN ('submitted', 'sitesup_ok', 'pm_ok') ORDER BY d.submitted_at`),
      env.DB.prepare(`SELECT w.emp_id, w.period, w.wbs FROM ts_doc_wbs w JOIN ts_docs d ON d.emp_id = w.emp_id AND d.period = w.period WHERE d.status IN ('submitted', 'sitesup_ok', 'pm_ok')`),
      env.DB.prepare(`SELECT d.emp_id, e.full_name, e.supervisor, e.email, e.position, e.role_override, json_extract(d.data, '$.sch') sch FROM ts_docs d JOIN employees e ON e.emp_id = d.emp_id
        WHERE d.period = ? AND d.status IN ('draft', 'rejected') AND e.active = 1`).bind(period),
      env.DB.prepare(`SELECT o.emp_id, o.date, o.ot, o.wbs, e.full_name, e.supervisor, e.position, e.role_override, e.email FROM ts_ot o JOIN employees e ON e.emp_id = o.emp_id
        WHERE o.status = 'pending' ORDER BY o.date LIMIT 400`),
      env.DB.prepare(`SELECT l.*, e.full_name, e.supervisor, e.position, e.role_override, e.email FROM ts_leave l JOIN employees e ON e.emp_id = l.emp_id
        WHERE l.status = 'pending' AND l.date_to >= ? ORDER BY l.date_from LIMIT 200`).bind(date),
      // chấm công BÙ: dòng của các ngày trước hôm nay nhưng được thêm / sửa trong hôm nay (bỏ dòng nghỉ do đơn nghỉ tự ghi)
      env.DB.prepare(`SELECT d.emp_id, e.full_name, e.supervisor, json_extract(x.value, '$.date') dt,
          json_extract(x.value, '$.projectName') pn, json_extract(x.value, '$.workNumber') wbs, json_extract(x.value, '$.startTime') st,
          json_extract(x.value, '$.endTime') et, json_extract(x.value, '$.breakTime') br, json_extract(x.value, '$.activityCode') ac,
          json_extract(x.value, '$.report') rp, json_extract(x.value, '$.lv') lv
        FROM ts_docs d JOIN employees e ON e.emp_id = d.emp_id, json_each(d.data, '$.entries') x
        WHERE d.period IN (?, ?) AND json_extract(x.value, '$.date') < ? AND json_extract(x.value, '$.u') >= ?`).bind(period, prevPeriodOf(period), date, dayStartMs),
      // các ngày đã chấm của kỳ (người chưa nộp) — để nhắc đúng những ngày còn thiếu
      env.DB.prepare(`SELECT d.emp_id, json_extract(x.value, '$.date') dt FROM ts_docs d, json_each(d.data, '$.entries') x
        WHERE d.period = ? AND d.status IN ('draft', 'rejected')`).bind(period),
      env.DB.prepare(`SELECT a.emp_id, a.period, a.level, a.wbs FROM ts_approvals a JOIN ts_docs d ON d.emp_id = a.emp_id AND d.period = a.period WHERE d.status IN ('submitted', 'sitesup_ok')`),
    ]);
    const rows = rowsQ.results, work = rows.filter(r => !LEAVE_CODES.includes(String(r.ac)));
    summary.entries = work.length;
    const idx = await approverIndex(env);

    const byPerson = new Map();     // email → { person, projects: Map, pending: [], missing: [] }
    const recOf = (p) => { let r = byPerson.get(p.email); if (!r) { r = { person: p, projects: new Map(), pending: [], missing: [], ot: [], leave: [], late: new Map() }; byPerson.set(p.email, r); } return r; };
    // 📝 chấm công trong ngày → người phụ trách dự án (không có dự án: Quản lý trực tiếp)
    for (const r of work) {
      const w = String(r.wbs || '').trim();
      const people = (w && idx.staff(w).length) ? idx.staff(w) : idx.direct(r.supervisor);
      for (const p of people) {
        const rec = recOf(p), pk = (w || '—') + '|' + (r.pn || '');
        const proj = rec.projects.get(pk) || { name: r.pn || '(không ghi dự án)', wbs: w, rows: [] };
        rec.projects.set(pk, proj); proj.rows.push(r);
      }
    }
    // ⏳ bảng công chờ duyệt → đúng người duyệt ở cấp hiện tại
    const wbsOf = new Map();
    wbsQ.results.forEach(r => { const k = r.emp_id + '|' + r.period; if (!wbsOf.has(k)) wbsOf.set(k, []); wbsOf.get(k).push(r.wbs); });
    const doneWbs = new Map();       // 'emp|period|level' → Set các dự án đã duyệt ở cấp đó
    apprQ.results.forEach(a => { const k = `${a.emp_id}|${a.period}|${a.level}`; if (!doneWbs.has(k)) doneWbs.set(k, new Set()); doneWbs.get(k).add(a.wbs); });
    for (const d of pendQ.results) {
      const level = d.status === 'submitted' ? 'sitesup' : d.status === 'sitesup_ok' ? 'pm' : 'admin';
      summary.pending++;
      // chỉ người còn dự án chưa duyệt mới được nhắc; cấp admin → Admin / Admin dự án
      const people = level === 'admin' ? idx.adminish() : idx.approvers(level, wbsOf.get(d.emp_id + '|' + d.period) || [], d.supervisor, doneWbs.get(`${d.emp_id}|${d.period}|${level}`));
      for (const p of people) recOf(p).pending.push({ ...d, level });
    }
    // ⏱ tăng ca chờ duyệt → Site Sup của dự án trong ngày / Quản lý trực tiếp; 🏖 đơn nghỉ → thêm QLDA của dự án
    const wl = (s) => String(s || '').split(',').filter(Boolean);
    summary.ot = otQ.results.length; summary.leave = leaveQ.results.length;
    // OT của fitter → Site Sup; OT / đơn nghỉ của giám sát → Quản lý dự án
    for (const o of otQ.results) for (const p of idx.approvers(isLead(env, o) ? 'pm' : 'sitesup', wl(o.wbs), o.supervisor)) recOf(p).ot.push(o);
    for (const l of leaveQ.results) {
      // đơn nghỉ: chỉ Quản lý trực tiếp duyệt (không có → admin)
      const ppl = idx.directAny(l.supervisor).length ? idx.directAny(l.supervisor) : idx.admins();
      const seen = new Set();
      for (const p of ppl) { if (seen.has(p.email)) continue; seen.add(p.email); recOf(p).leave.push(l); }
    }
    // 📌 chấm công BÙ hôm nay cho các ngày trước: gộp vào CÙNG thư báo cáo của hôm nay (mỗi người một thư duy nhất)
    const late = lateQ.results.filter(r => !LEAVE_CODES.includes(String(r.ac)) && !r.lv);
    summary.late = late.length;
    for (const r of late) {
      const w = String(r.wbs || '').trim();
      const people = (w && idx.staff(w).length) ? idx.staff(w) : idx.direct(r.supervisor);
      for (const p of people) {
        const rec = recOf(p), g = rec.late.get(r.emp_id) || { name: r.full_name, dates: new Set(), rows: [] };
        rec.late.set(r.emp_id, g); g.dates.add(r.dt); g.rows.push(r);
      }
    }
    // ⚠️ chưa chấm công hôm nay (chỉ người đang dùng Timesheet kỳ này, chưa nộp; Chủ nhật bỏ qua).
    // Giám sát (Site Sup / QLDA) chỉ chấm giờ OT nên không bị nhắc / không báo vào danh sách chưa chấm.
    const present = new Set(rows.map(r => r.emp_id));
    const open = openQ.results.filter(d => !isLead(env, d));
    if (workday) {
      for (const d of open) {
        if (present.has(d.emp_id)) continue;
        const sups = idx.direct(d.supervisor);
        if (sups.length) summary.missing++;
        sups.forEach(p => recOf(p).missing.push(d));
      }
    }
    // ✉ nhắc CHÍNH fitter chưa chấm công hôm nay, kèm các ngày còn thiếu trong kỳ — một lượt gọi Brevo cho tất cả
    summary.fitterReminders = 0;
    if (workday) {
      const have = new Map();
      datesQ.results.forEach(x => { if (!have.has(x.emp_id)) have.set(x.emp_id, new Set()); have.get(x.emp_id).add(x.dt); });
      const doneF = await loggedKeys(env, `fremind:${date}:`);
      const items = [], keysF = [];
      for (const d of open) {
        if (!d.email || present.has(d.emp_id) || doneF.has(`fremind:${date}:${d.emp_id}`)) continue;
        const got = have.get(d.emp_id) || new Set();
        const miss = OtLeave.leaveDays(periodRange(period).start, date, d.sch || Labor.DEFAULT_SCHEDULE, Labor).filter(x => !got.has(x.date)).map(x => x.date);
        if (!miss.includes(date)) continue;
        const earlier = miss.filter(x => x < date);
        items.push({ to: { email: d.email, name: d.full_name }, subject: `[Nhắc] Hôm nay (${fmtDMY(date)}) bạn chưa chấm công`,
          html: layout('Nhắc chấm công', `<p>Chào ${esc(d.full_name)},</p><p>Hôm nay <b>${esc(WEEKDAY[weekdayOf(date)])} ${esc(fmtDMY(date))}</b> bạn chưa chấm công. Mở Timesheet và chấm trước khi hết ngày (kèm báo cáo thi công).</p>`
            + (earlier.length ? `<p style="background:#fffbeb;border:1px solid #fde68a;padding:10px;border-radius:6px">Kỳ lương này bạn còn thiếu cả: <b>${earlier.map(x => esc(fmtDM(x))).join(', ')}</b>. Chấm bù hôm nay cũng được — giám sát sẽ nhận <b>một thư tổng hợp</b> các ngày bù.</p>` : '')
            + `<p>Nghỉ phép / ốm: làm <b>đơn nghỉ trước ngày nghỉ</b>, quản lý duyệt xong ngày nghỉ tự ghi vào bảng công.</p>`, { url: link(env, '/tools/timesheet/'), label: 'Mở Timesheet' }) });
        keysF.push(`fremind:${date}:${d.emp_id}`);
      }
      if (items.length) {
        const r = await sendMailBatch(env, items);
        summary.fitterReminders = r.sent; summary.failed += r.failed; r.errors.forEach(e => summary.errors.push('Nhắc fitter: ' + e));
        if (r.sent) await logKeys(env, keysF);
      }
    }

    summary.recipients = byPerson.size;
    if (!byPerson.size) return summary;
    const done = await loggedKeys(env, `digest:${date}:`);
    const sentKeys = [];
    let mails = 0;
    const url = link(env, '/tools/approvals/');
    const dayLabel = `${WEEKDAY[weekdayOf(date)]} ${fmtDMY(date)}`;
    const h3 = (t) => `<h3 style="font-size:15px;margin:18px 0 6px">${t}</h3>`;
    for (const [email, rec] of byPerson) {
      const key = `digest:${date}:${email}`;
      if (done.has(key)) { summary.skipped++; continue; }
      if (mails >= MAX_MAILS_PER_RUN) { summary.errors.push('Đã đạt giới hạn số thư mỗi lần chạy'); break; }
      mails++;
      const nRows = [...rec.projects.values()].reduce((n, p) => n + p.rows.length, 0);
      const blocks = [...rec.projects.values()].map(p => {
        const lines = p.rows.map(r => {
          const h = entryHours({ startTime: r.st, endTime: r.et, breakTime: r.br });
          return `<li><b>${esc(r.full_name)}</b> · ${esc(r.st)}–${esc(r.et)} · ${fmtH(h)} giờ · mã ${esc(r.ac)}<br>`
            + (r.rp ? `<span style="color:#1e40af">📝 ${esc(r.rp)}</span>` : `<span style="color:#9ca3af">(chưa có báo cáo thi công)</span>`)
            + (r.rm ? `<br><span style="color:#6b7280">Ghi chú: ${esc(r.rm)}</span>` : '') + '</li>';
        }).join('');
        return `<h4 style="font-size:14px;margin:12px 0 4px">${esc(p.name)}${p.wbs ? ` <span style="color:#6b7280;font-weight:normal">(${esc(p.wbs)})</span>` : ''}</h4><ul style="margin:0;padding-left:18px">${lines}</ul>`;
      }).join('');
      const pend = rec.pending.map(d => `<li><a href="${esc(reviewLink(env, d.emp_id, d.period))}" style="color:#1d4ed8;font-weight:bold">${esc(d.full_name)} — kỳ ${esc(periodLabel(d.period))}</a>`
        + ` <span style="color:#6b7280">· ${d.level === 'admin' ? 'đã qua Site Sup và QLDA, chờ Admin xử lý cuối' : d.level === 'pm' ? 'Site Sup đã duyệt, chờ bạn duyệt lần 2' : 'chờ bạn duyệt'}${d.submitted_at ? ` · nộp ${esc(fmtDMY(String(d.submitted_at).slice(0, 10)))}` : ''}</span></li>`).join('');
      const miss = rec.missing.map(d => esc(d.full_name)).join(', ');
      const otList = rec.ot.map(o => `<li><b>${esc(o.full_name)}</b> · ${esc(WEEKDAY[weekdayOf(o.date)])} ${esc(fmtDMY(o.date))} · tăng ca <b>${fmtH(o.ot)} giờ</b>${o.wbs ? ` · ${esc(o.wbs)}` : ''}</li>`).join('');
      const lvList = rec.leave.map(l => `<li><b>${esc(l.full_name)}</b> · ${esc(LEAVE_LABEL[l.type] || 'Nghỉ')} ${esc(leaveSpan(l))} (${fmtH(leaveCount(l))} ngày)`
        + ` · <span style="color:#b45309">duyệt trước ${esc(fmtDMY(l.date_from))}</span>${l.reason ? `<br><span style="color:#6b7280">${esc(l.reason)}</span>` : ''}</li>`).join('');
      const lateRows = [...rec.late.values()];
      const lateHtml = lateRows.map(g => {
        const ds = [...g.dates].sort();
        return `<li><b>${esc(g.name)}</b> chấm bù ${ds.length} ngày: ${ds.map(x => esc(fmtDM(x))).join(', ')} (${g.rows.length} dòng)<ul style="margin:2px 0 6px;padding-left:16px">`
          + g.rows.slice().sort((a, b) => a.dt.localeCompare(b.dt) || String(a.st).localeCompare(String(b.st))).slice(0, 12).map(r => `<li>${esc(fmtDM(r.dt))} · ${esc(r.st)}–${esc(r.et)} · ${fmtH(entryHours({ startTime: r.st, endTime: r.et, breakTime: r.br }))} giờ · ${esc(r.pn || '—')}${r.rp ? ` — <span style="color:#1e40af">📝 ${esc(r.rp)}</span>` : ''}</li>`).join('')
          + (g.rows.length > 12 ? `<li style="color:#6b7280">… và ${g.rows.length - 12} dòng khác</li>` : '') + '</ul></li>';
      }).join('');
      const nLate = lateRows.reduce((n, g) => n + g.rows.length, 0);
      const top = [nRows ? `<b>${nRows}</b> dòng chấm công` : 'chưa có dòng chấm công nào ở dự án của bạn',
        nLate ? `<b style="color:#b45309">${nLate}</b> dòng chấm bù` : '',
        rec.pending.length ? `<b style="color:#b45309">${rec.pending.length}</b> bảng công chờ bạn duyệt` : '',
        rec.ot.length ? `<b style="color:#b45309">${rec.ot.length}</b> ngày tăng ca chờ duyệt` : '',
        rec.leave.length ? `<b style="color:#b45309">${rec.leave.length}</b> đơn nghỉ chờ duyệt` : '',
        rec.missing.length ? `<b style="color:#b91c1c">${rec.missing.length}</b> fitter chưa chấm công` : ''].filter(Boolean).join(' · ');
      const body = `<p style="background:#f8fafc;border:1px solid #e5e7eb;padding:10px;border-radius:6px">Hôm nay: ${top}.</p>`
        + (nRows ? h3('📝 Chấm công trong ngày — dự án bạn phụ trách') + blocks : '')
        + (lateRows.length ? h3('📌 Chấm công bù hôm nay cho các ngày trước (tổng hợp một thư)') + `<ul style="margin:0;padding-left:18px">${lateHtml}</ul>` : '')
        + (rec.pending.length ? h3('⏳ Bảng công chờ bạn duyệt') + `<ul style="margin:0;padding-left:18px">${pend}</ul><p style="color:#6b7280;font-size:13px;margin:6px 0 0">Bấm tên để mở thẳng bảng công đó.</p>` : '')
        + (rec.ot.length ? h3('⏱ Tăng ca chờ bạn duyệt') + `<ul style="margin:0;padding-left:18px">${otList}</ul><p style="color:#6b7280;font-size:13px;margin:6px 0 0">Mở <b>Duyệt bảng công → Tăng ca chờ duyệt</b> để duyệt (chọn nhiều ngày một lần). Bảng công vẫn nộp được khi còn tăng ca chưa duyệt, nhưng giờ chưa duyệt có thể không được tính.</p>` : '')
        + (rec.leave.length ? h3('🏖 Đơn nghỉ chờ bạn duyệt') + `<ul style="margin:0;padding-left:18px">${lvList}</ul>` : '')
        + (rec.missing.length ? h3('⚠️ Hôm nay chưa chấm công') + `<p style="margin:0">${miss}</p><p style="color:#6b7280;font-size:13px;margin:6px 0 0">Fitter bạn quản lý trực tiếp đang dùng Timesheet kỳ này — nhắc chấm công trước khi hết ngày.</p>` : '');
      // Tiêu đề ngắn: "Tên fitter - Tên dự án - WBS - Chấm công/báo cáo ngày dd.mm.yyyy"; nhiều fitter / dự án thì gọn thành số lượng;
      // có duyệt OT / nghỉ phép / bảng công thì thêm vào cuối. Nút mở trang duyệt CHỈ có khi có việc cần duyệt.
      const dmy = date.split('-').reverse().join('.');
      const fitters = new Set(), projs = new Map();
      for (const p of rec.projects.values()) { p.rows.forEach(r => fitters.add(r.full_name)); projs.set(p.wbs + '|' + p.name, p); }
      lateRows.forEach(g => fitters.add(g.name));
      let head;
      if (fitters.size === 1 && projs.size === 1) { const p = [...projs.values()][0]; head = `${[...fitters][0]} - ${p.name}${p.wbs ? ' - ' + p.wbs : ''}`; }
      else if (fitters.size === 1 && !projs.size) head = [...fitters][0];
      else head = `${fitters.size || 0} fitter - ${projs.size} dự án`;
      const duyet = [rec.ot.length ? 'Duyệt OT' : '', rec.leave.length ? 'Duyệt nghỉ phép' : '', rec.pending.length ? 'Duyệt bảng công' : ''].filter(Boolean).join(' + ');
      const subject = `${head} - Chấm công/báo cáo ngày ${dmy}${duyet ? ' - ' + duyet : ''}`;
      const needAction = rec.pending.length || rec.ot.length || rec.leave.length;
      const html = layout(`Chấm công / báo cáo thi công ${dayLabel}`, body, needAction ? { url, label: 'Mở Duyệt bảng công' } : null);
      const r = await sendMail(env, { to: [rec.person], subject, html });
      if (r.ok) { summary.sent++; sentKeys.push(key); } else { summary.failed++; summary.errors.push(`${email}: ${r.error}`); }
    }
    await logKeys(env, sentKeys);
  } catch (e) { console.error('runDigest', e); summary.errors.push('Lỗi: ' + (e && e.message)); }
  return summary;
}

// ---------- nhắc hạn: ngày 9 (fitter chưa nộp), ngày 11 (fitter chưa nộp + người duyệt còn bảng công chờ) ----------
export async function runReminders(env, { now = new Date() } = {}) {
  const summary = { date: vnDate(now), stage: '', sent: 0, failed: 0, skipped: 0, errors: [] };
  try {
    if (!mailConfigured(env)) { summary.skipped = 1; summary.errors.push('Chưa cấu hình gửi email'); return summary; }
    const day = +summary.date.slice(8, 10);
    if (day !== 9 && day !== 11) return summary;
    summary.stage = day === 9 ? 'r9' : 'r11';
    const period = summary.date.slice(0, 7);                       // kỳ kết thúc ngày 15 tháng này
    const prefix = `remind:${period}:`;
    const done = await loggedKeys(env, prefix);
    const sentKeys = [];
    let mails = 0;
    const deadline = `12/${period.slice(5)}/${period.slice(0, 4)}`;
    const mine = link(env, '/tools/timesheet/'), review = link(env, '/tools/approvals/');

    const { results: open } = await env.DB.prepare(`SELECT e.emp_id, e.full_name, e.email, d.status FROM employees e
      LEFT JOIN ts_docs d ON d.emp_id = e.emp_id AND d.period = ?
      WHERE e.active = 1 AND e.email <> '' AND (d.status IS NULL OR d.status IN ('draft', 'rejected'))`).bind(period).all();
    for (const e of open) {
      const key = `${prefix}${summary.stage}:${e.emp_id}`;
      if (done.has(key)) { summary.skipped++; continue; }
      if (mails >= MAX_MAILS_PER_RUN) { summary.errors.push('Đã đạt giới hạn số thư mỗi lần chạy'); break; }
      mails++;
      const late = day === 11;
      const subject = late ? `[Nhắc] Ngày mai (12/${period.slice(5)}) là hạn nộp bảng công kỳ ${periodLabel(period)}` : `[Nhắc] Hạn nộp bảng công kỳ ${periodLabel(period)} là ${deadline}`;
      const html = layout('Nhắc nộp bảng công', `<p>Chào ${esc(e.full_name)},</p>
        <p>Hạn nộp bảng công kỳ lương ${esc(periodLabel(period))} là <b>${esc(deadline)}</b>. ${e.status === 'rejected' ? 'Bảng công của bạn đang bị <b>trả lại</b> — hãy sửa và nộp lại.' : 'Bạn chưa nộp.'}</p>
        <p>Nhớ chấm trước cả các ngày còn lại của kỳ (đến ngày 15) rồi bấm <b>Nộp bảng công</b>.</p>`, { url: mine, label: 'Mở Timesheet' });
      const r = await sendMail(env, { to: [{ email: e.email, name: e.full_name }], subject, html });
      if (r.ok) { summary.sent++; sentKeys.push(key); } else { summary.failed++; summary.errors.push(`${e.email}: ${r.error}`); }
    }

    if (day === 11) {
      // người duyệt còn bảng công chờ
      const { results: pend } = await env.DB.prepare(`SELECT d.emp_id, d.status, e.full_name, e.supervisor FROM ts_docs d JOIN employees e ON e.emp_id = d.emp_id
        WHERE d.period = ? AND d.status IN ('submitted', 'sitesup_ok', 'pm_ok')`).bind(period).all();
      const wbsOf = new Map();
      if (pend.length) {
        const { results } = await env.DB.prepare('SELECT emp_id, wbs FROM ts_doc_wbs WHERE period = ?').bind(period).all();
        results.forEach(r => { if (!wbsOf.has(r.emp_id)) wbsOf.set(r.emp_id, []); wbsOf.get(r.emp_id).push(r.wbs); });
      }
      const byApprover = new Map(), ctx = {};
      let admins = null;
      for (const d of pend) {
        const level = d.status === 'submitted' ? 'sitesup' : d.status === 'sitesup_ok' ? 'pm' : 'admin';
        const people = level === 'admin' ? (admins = admins || await adminsFor(env)) : await approversFor(env, level, wbsOf.get(d.emp_id) || [], d.supervisor, ctx);
        for (const a of people) {
          const rec = byApprover.get(a.email) || { a, list: [] };
          byApprover.set(a.email, rec); rec.list.push(`${d.full_name} (${level === 'pm' ? 'chờ Quản lý dự án' : level === 'admin' ? 'chờ Admin xử lý cuối' : 'chờ Site Sup'})`);
        }
      }
      for (const [email, rec] of byApprover) {
        const key = `${prefix}a11:${email}`;
        if (done.has(key)) { summary.skipped++; continue; }
        if (mails >= MAX_MAILS_PER_RUN) break;
        mails++;
        const html = layout('Còn bảng công chờ bạn duyệt', `<p>Còn ${rec.list.length} bảng công kỳ ${esc(periodLabel(period))} đang chờ bạn duyệt:</p><ul>${rec.list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`, { url: review, label: 'Mở Duyệt bảng công' });
        const r = await sendMail(env, { to: [rec.a], subject: `[Nhắc] Còn ${rec.list.length} bảng công chờ bạn duyệt (kỳ ${periodLabel(period)})`, html });
        if (r.ok) { summary.sent++; sentKeys.push(key); } else { summary.failed++; summary.errors.push(`${email}: ${r.error}`); }
      }
    }
    await logKeys(env, sentKeys);
  } catch (e) { console.error('runReminders', e); summary.errors.push('Lỗi: ' + (e && e.message)); }
  return summary;
}
