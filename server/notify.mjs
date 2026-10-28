// Thư tự động của luồng bảng công: thông báo khi nộp / duyệt / trả lại (gửi ngay từ API),
// báo cáo thi công cuối ngày và nhắc hạn (chạy theo lịch trong cron/worker.mjs).
// Mọi hàm ở đây KHÔNG ném lỗi ra ngoài — thư hỏng không được làm hỏng nộp / duyệt bảng công.
import { effectiveRoles, adminEmails } from './roles.mjs';
import { keyOf } from './supervisors.mjs';
import { entryHours, allowanceSummary } from './tsdoc.mjs';
import { mailConfigured, sendMail, esc, layout } from './mail.mjs';

const LEAVE_CODES = ['6010', '6020', '6090'];
const MAX_MAILS_PER_RUN = 40;      // gói miễn phí: tối đa 50 lần gọi ra ngoài mỗi lần chạy (gồm cả truy vấn D1)
const WEEKDAY = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const fmtH = (h) => (Math.round(h * 10) / 10).toString().replace('.', ',');
const fmtDMY = (s) => String(s).split('-').reverse().join('/');
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

const ph = (n) => Array.from({ length: n }, () => '?').join(', ');

// Người được thông báo ở mỗi cấp duyệt: người được gán cho các dự án trong bảng công, hoặc "Quản lý trực tiếp" của người nộp (cấp Site Sup);
// không ai thì gửi admin để bảng công không bị bỏ quên.
export async function approversFor(env, level, wbsList, ownerSupervisor, ctx = {}) {
  const out = new Map();
  const add = (e) => { const k = String(e.email || '').toLowerCase(); if (k) out.set(k, { email: k, name: e.full_name || '' }); };
  const wbs = [...new Set((wbsList || []).filter(Boolean))].slice(0, 30);
  if (wbs.length) {
    const { results } = await env.DB.prepare(`SELECT e.full_name, e.email FROM project_staff s JOIN employees e ON e.emp_id = s.emp_id
      WHERE s.role = ? AND s.wbs IN (${ph(wbs.length)}) AND e.active = 1 AND e.email <> ''`).bind(level, ...wbs).all();
    results.forEach(add);
  }
  if (level === 'sitesup' && ownerSupervisor) {
    if (!ctx.emps) ctx.emps = (await env.DB.prepare("SELECT * FROM employees WHERE active = 1 AND email <> ''").all()).results;
    ctx.emps.filter(e => keyOf(e.full_name) === keyOf(ownerSupervisor) && effectiveRoles(e, e.email, env).includes('sitesup')).forEach(add);
  }
  if (!out.size) {
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
  const admins = [...adminEmails(env).map(email => ({ email, name: '' })), ...em.results.filter(e => e.role_override === 'admin').map(person)];
  const direct = (name) => (name ? sups.filter(e => keyOf(e.full_name) === keyOf(name)).map(person) : []);
  const uniq = (list) => { const m = new Map(); list.forEach(p => { if (p.email && !m.has(p.email)) m.set(p.email, p); }); return [...m.values()]; };
  return {
    direct,
    staff: (wbs) => { const x = byWbs.get(String(wbs || '').trim()); return x ? uniq([...x.sitesup, ...x.pm]) : []; },
    approvers(level, wbsList, ownerSupervisor) {
      let out = (wbsList || []).flatMap(w => (byWbs.get(w) || {})[level] || []);
      if (level === 'sitesup') out = out.concat(direct(ownerSupervisor));
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
export async function notifyEvent(env, kind, { empId, period, wbs = [], by = '', note = '', pushed = 0 }) {
  try {
    if (!mailConfigured(env)) return { ok: false, skipped: true };
    const owner = await ownerOf(env, empId);
    if (!owner) return { ok: false, skipped: true };
    const who = `${owner.full_name} (${empId})`, kp = `kỳ lương ${periodLabel(period)}`;
    const review = reviewLink(env, empId, period), mine = link(env, '/tools/timesheet/');
    let to, subject, html;
    if (kind === 'submitted' || kind === 'sitesup_ok') {
      const level = kind === 'submitted' ? 'sitesup' : 'pm';
      to = await approversFor(env, level, wbs, owner.supervisor);
      const row = await env.DB.prepare('SELECT data FROM ts_docs WHERE emp_id = ? AND period = ?').bind(empId, period).first();
      let t = null;
      try { t = row ? docTotals(JSON.parse(row.data)) : null; } catch (e) { t = null; }
      subject = `[Bảng công] ${owner.full_name} đã nộp ${kp} — chờ ${level === 'pm' ? 'Quản lý dự án' : 'Site Sup'} duyệt`;
      html = layout(`Có bảng công chờ bạn duyệt`, `<p>${esc(who)} ${kind === 'submitted' ? 'đã nộp' : 'đã được Site Sup ' + esc(by) + ' duyệt'} bảng công ${esc(kp)}.</p>
        ${t ? `<p style="background:#f8fafc;border:1px solid #e5e7eb;padding:10px;border-radius:6px"><b>${fmtH(t.total)} giờ</b> (thường ${fmtH(t.normal)}, tăng ca ${fmtH(t.ot)}) · ${t.days} ngày làm việc · ${t.lines} dòng chấm công</p>` : ''}
        ${t && t.allow ? `<p style="background:#fffbeb;border:1px solid #fde68a;padding:10px;border-radius:6px"><b>Phụ cấp xe:</b> ${esc(t.allow)}</p>` : ''}
        ${wbs.length ? `<p>Dự án: ${esc(wbs.join(', '))}</p>` : ''}<p>Bấm nút dưới để mở thẳng bảng công này trong <b>Duyệt bảng công</b>: xem chi tiết, duyệt hoặc trả lại kèm lý do.</p>`, { url: review, label: 'Mở bảng công để duyệt' });
    } else if (kind === 'approved') {
      to = owner.email ? [{ email: owner.email, name: owner.full_name }] : [];
      subject = `[Bảng công] ${kp} của bạn đã được duyệt xong`;
      html = layout('Bảng công đã được duyệt', `<p>Bảng công ${esc(kp)} của bạn đã được ${esc(by)} duyệt xong.${pushed ? ` ${pushed} dòng đã chuyển sang bảng Theo dõi giờ công.` : ''}</p>`, { url: mine, label: 'Mở Timesheet' });
    } else if (kind === 'rejected') {
      to = owner.email ? [{ email: owner.email, name: owner.full_name }] : [];
      subject = `[Bảng công] ${kp} bị trả lại — cần sửa`;
      html = layout('Bảng công bị trả lại', `<p>Bảng công ${esc(kp)} của bạn đã bị trả lại.</p><p style="background:#fef2f2;border:1px solid #fecaca;padding:10px;border-radius:6px"><b>Lý do:</b> ${esc(note)}</p>
        <p>Mở Timesheet, sửa rồi bấm <b>Nộp bảng công</b> lại.</p>`, { url: mine, label: 'Mở Timesheet' });
    } else return { ok: false, skipped: true };
    return await sendMail(env, { to, subject, html });
  } catch (e) { console.error('notifyEvent', e); return { ok: false, error: 'Lỗi soạn thư' }; }
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
//   ⚠️ fitter họ quản lý trực tiếp đang dùng Timesheet mà hôm nay chưa chấm công (T2–T7).
// Chỉ đọc đúng các dòng của ngày (json_each trong D1); mọi tra cứu khác gom vào 2 lượt batch (giới hạn lượt gọi của cron).
export async function runDigest(env, { now = new Date() } = {}) {
  const summary = { date: vnDate(now), entries: 0, pending: 0, missing: 0, recipients: 0, sent: 0, failed: 0, skipped: 0, errors: [] };
  try {
    if (!mailConfigured(env)) { summary.skipped = 1; summary.errors.push('Chưa cấu hình gửi email'); return summary; }
    const date = summary.date, period = periodOfDate(date), workday = weekdayOf(date) !== 0;
    const [rowsQ, pendQ, wbsQ, openQ] = await env.DB.batch([
      env.DB.prepare(`SELECT d.emp_id, e.full_name, e.supervisor,
          json_extract(x.value, '$.projectName') pn, json_extract(x.value, '$.workNumber') wbs, json_extract(x.value, '$.startTime') st,
          json_extract(x.value, '$.endTime') et, json_extract(x.value, '$.breakTime') br, json_extract(x.value, '$.activityCode') ac,
          json_extract(x.value, '$.report') rp, json_extract(x.value, '$.remarks') rm
        FROM ts_docs d JOIN employees e ON e.emp_id = d.emp_id, json_each(d.data, '$.entries') x
        WHERE d.period = ? AND json_extract(x.value, '$.date') = ?`).bind(period, date),
      env.DB.prepare(`SELECT d.emp_id, d.period, d.status, d.submitted_at, e.full_name, e.supervisor FROM ts_docs d JOIN employees e ON e.emp_id = d.emp_id
        WHERE d.status IN ('submitted', 'sitesup_ok') ORDER BY d.submitted_at`),
      env.DB.prepare(`SELECT w.emp_id, w.period, w.wbs FROM ts_doc_wbs w JOIN ts_docs d ON d.emp_id = w.emp_id AND d.period = w.period WHERE d.status IN ('submitted', 'sitesup_ok')`),
      env.DB.prepare(`SELECT d.emp_id, e.full_name, e.supervisor FROM ts_docs d JOIN employees e ON e.emp_id = d.emp_id
        WHERE d.period = ? AND d.status IN ('draft', 'rejected') AND e.active = 1`).bind(period),
    ]);
    const rows = rowsQ.results, work = rows.filter(r => !LEAVE_CODES.includes(String(r.ac)));
    summary.entries = work.length;
    const idx = await approverIndex(env);

    const byPerson = new Map();     // email → { person, projects: Map, pending: [], missing: [] }
    const recOf = (p) => { let r = byPerson.get(p.email); if (!r) { r = { person: p, projects: new Map(), pending: [], missing: [] }; byPerson.set(p.email, r); } return r; };
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
    for (const d of pendQ.results) {
      const level = d.status === 'submitted' ? 'sitesup' : 'pm';
      summary.pending++;
      for (const p of idx.approvers(level, wbsOf.get(d.emp_id + '|' + d.period) || [], d.supervisor)) recOf(p).pending.push({ ...d, level });
    }
    // ⚠️ chưa chấm công hôm nay (chỉ người đang dùng Timesheet kỳ này, chưa nộp; Chủ nhật bỏ qua)
    if (workday) {
      const present = new Set(rows.map(r => r.emp_id));
      for (const d of openQ.results) {
        if (present.has(d.emp_id)) continue;
        const sups = idx.direct(d.supervisor);
        if (sups.length) summary.missing++;
        sups.forEach(p => recOf(p).missing.push(d));
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
        + ` <span style="color:#6b7280">· ${d.level === 'pm' ? 'Site Sup đã duyệt, chờ bạn duyệt lần 2' : 'chờ bạn duyệt'}${d.submitted_at ? ` · nộp ${esc(fmtDMY(String(d.submitted_at).slice(0, 10)))}` : ''}</span></li>`).join('');
      const miss = rec.missing.map(d => esc(d.full_name)).join(', ');
      const top = [nRows ? `<b>${nRows}</b> dòng chấm công` : 'chưa có dòng chấm công nào ở dự án của bạn',
        rec.pending.length ? `<b style="color:#b45309">${rec.pending.length}</b> bảng công chờ bạn duyệt` : '',
        rec.missing.length ? `<b style="color:#b91c1c">${rec.missing.length}</b> fitter chưa chấm công` : ''].filter(Boolean).join(' · ');
      const body = `<p style="background:#f8fafc;border:1px solid #e5e7eb;padding:10px;border-radius:6px">Hôm nay: ${top}.</p>`
        + (nRows ? h3('📝 Chấm công trong ngày — dự án bạn phụ trách') + blocks : '')
        + (rec.pending.length ? h3('⏳ Bảng công chờ bạn duyệt') + `<ul style="margin:0;padding-left:18px">${pend}</ul><p style="color:#6b7280;font-size:13px;margin:6px 0 0">Bấm tên để mở thẳng bảng công đó.</p>` : '')
        + (rec.missing.length ? h3('⚠️ Hôm nay chưa chấm công') + `<p style="margin:0">${miss}</p><p style="color:#6b7280;font-size:13px;margin:6px 0 0">Fitter bạn quản lý trực tiếp đang dùng Timesheet kỳ này — nhắc chấm công trước khi hết ngày.</p>` : '');
      const subject = `[Báo cáo thi công] ${dayLabel} — ${nRows} dòng chấm công${rec.pending.length ? ` · ${rec.pending.length} chờ duyệt` : ''}`;
      const html = layout(`Báo cáo thi công ${dayLabel}`, body, { url, label: 'Mở Duyệt bảng công' });
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
        WHERE d.period = ? AND d.status IN ('submitted', 'sitesup_ok')`).bind(period).all();
      const wbsOf = new Map();
      if (pend.length) {
        const { results } = await env.DB.prepare('SELECT emp_id, wbs FROM ts_doc_wbs WHERE period = ?').bind(period).all();
        results.forEach(r => { if (!wbsOf.has(r.emp_id)) wbsOf.set(r.emp_id, []); wbsOf.get(r.emp_id).push(r.wbs); });
      }
      const byApprover = new Map(), ctx = {};
      for (const d of pend) {
        const level = d.status === 'submitted' ? 'sitesup' : 'pm';
        for (const a of await approversFor(env, level, wbsOf.get(d.emp_id) || [], d.supervisor, ctx)) {
          const rec = byApprover.get(a.email) || { a, list: [] };
          byApprover.set(a.email, rec); rec.list.push(`${d.full_name} (${level === 'pm' ? 'chờ Quản lý dự án' : 'chờ Site Sup'})`);
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
