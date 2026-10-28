// Duyệt bảng công — giao diện cho /api/ts/inbox, /api/ts/review (xem server/api.mjs).
// Đăng nhập do Cloudflare Access lo; máy chủ kiểm tra từng yêu cầu. Trang này chỉ hiển thị và gửi quyết định.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDMY = (s) => String(s).split('-').reverse().join('/');
  const fmtDM = (s) => { const [, m, d] = String(s).split('-'); return `${d}/${m}`; };
  const fmtH = (h) => (Math.round(h * 10) / 10).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  const fmtTime = (iso) => { try { return new Date(iso).toLocaleString('vi-VN'); } catch (e) { return iso; } };
  const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const LEVEL_LABEL = { sitesup: 'Site Sup', pm: 'Quản lý dự án' };
  const STATUS_LABEL = { submitted: 'Chờ Site Sup', sitesup_ok: 'Site Sup đã duyệt — chờ Quản lý dự án', approved: 'Đã duyệt xong', rejected: 'Đã trả lại', draft: 'Đang chấm' };

  let me = null, current = null;      // current = { emp, period, doc }

  function toast(msg) {
    const el = $('toast'); el.textContent = msg; el.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 4000);
  }

  async function api(method, path, body) {
    let resp;
    try {
      resp = await fetch(path, {
        method, credentials: 'same-origin', redirect: 'manual', cache: 'no-store',
        headers: body === undefined ? {} : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) { const err = new Error('Không gửi được yêu cầu tới máy chủ — kiểm tra mạng rồi thử lại.'); err.status = 0; throw err; }
    if (resp.type === 'opaqueredirect' || (resp.status >= 300 && resp.status < 400)) {
      const err = new Error('Phiên đăng nhập đã hết hạn — tải lại trang (F5) để đăng nhập lại.'); err.status = 401; throw err;
    }
    let data = {};
    try { data = await resp.json(); } catch (e) { /* không phải JSON */ }
    if (!resp.ok) { const err = new Error(data.error || ('Lỗi máy chủ (HTTP ' + resp.status + ')')); err.status = resp.status; throw err; }
    return data;
  }

  function gate(msg, isErr) { const el = $('gate'); el.innerHTML = msg; el.className = 'ac-msg' + (isErr ? ' err' : ''); el.hidden = false; }

  // ---------- hộp thư ----------
  async function loadInbox() {
    const body = $('inbox').tBodies[0];
    try {
      const r = await api('GET', '/api/ts/inbox');
      body.innerHTML = r.items.map(i => `<tr data-emp="${esc(i.empId)}" data-period="${esc(i.period)}">
          <td><b>${esc(i.name)}</b><div class="ac-note">${esc(i.empId)} · ${esc(i.position)}</div></td>
          <td>${esc(i.period.slice(5))}/${esc(i.period.slice(0, 4))}</td>
          <td>${esc(LEVEL_LABEL[i.level])}${i.level === 'pm' && i.sitesupBy ? `<div class="ac-note">Site Sup: ${esc(i.sitesupBy)}</div>` : ''}</td>
          <td class="mono">${esc(i.wbs.join(', ') || '—')}</td>
          <td class="r">${i.entries}</td>
          <td>${esc(fmtTime(i.submittedAt))}</td>
          <td><button class="btn small primary" data-open>Xem & duyệt</button></td></tr>`).join('')
        || '<tr><td colspan="7" class="ac-note">Không có bảng công nào đang chờ bạn duyệt.</td></tr>';
      $('inboxNote').textContent = r.items.length ? `${r.items.length} bảng công đang chờ bạn.` : '';
    } catch (e) { body.innerHTML = `<tr><td colspan="7" class="ac-note err">✗ ${esc(e.message)}</td></tr>`; }
  }

  // ---------- chi tiết ----------
  const hoursOf = (e) => {
    const t = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return m ? +m[1] + +m[2] / 60 : null; };
    const a = t(e.startTime), b = t(e.endTime);
    if (a === null || b === null) return 0;
    let d = b - a; if (d < 0) d += 24;
    return Math.max(0, d - (parseFloat(e.breakTime) || 0));
  };
  const isLeave = (e) => LaborVN.LEAVE_CODES.includes(String(e.activityCode));
  const dow = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };
  const addDay = (s, n) => { const [y, m, d] = s.split('-').map(Number); const x = new Date(y, m - 1, d + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  function periodRange(p) { const [y, m] = p.split('-').map(Number); const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1; return { start: `${py}-${String(pm).padStart(2, '0')}-16`, end: `${y}-${String(m).padStart(2, '0')}-15` }; }
  function isWorkday(d, sch) { const w = dow(d); return w >= 1 && (w <= 5 || (w === 6 && sch === 'mon-sat')) && !LaborVN.isHoliday(d, sch); }

  function renderDetail(emp, period, doc) {
    const sch = LaborVN.SCHEDULES[doc.data.sch] ? doc.data.sch : LaborVN.DEFAULT_SCHEDULE;
    const entries = (doc.data.entries || []).slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.startTime).localeCompare(String(b.startTime)));
    const recomputed = LaborVN.breakdownAll(entries, sch, hoursOf);
    $('dTitle').textContent = `${doc.name} — kỳ ${period.slice(5)}/${period.slice(0, 4)}`;
    $('dMeta').innerHTML = `<b>${esc(doc.name)}</b> (${esc(emp)}) · ${esc(doc.position)} · ${esc(STATUS_LABEL[doc.status] || doc.status)} · nộp lúc ${esc(fmtTime(doc.submittedAt))}`
      + (doc.sitesupBy ? ` · Site Sup <b>${esc(doc.sitesupBy)}</b> đã duyệt lúc ${esc(fmtTime(doc.sitesupAt))}` : '');

    let normal = 0, ot = 0; const days = new Set(), leaveDays = new Set(), projects = new Map(), mismatches = [];
    const rows = entries.map(e => {
      const bd = e.bd || {}, h = Object.values(bd).reduce((s, v) => s + (+v || 0), 0);
      const leave = isLeave(e);
      if (leave) leaveDays.add(e.date);
      else {
        days.add(e.date);
        const n = +bd.NORMAL || 0; normal += n; ot += h - n;
        const k = (e.workNumber || '') + '|' + (e.projectName || '');
        const p = projects.get(k) || { name: e.projectName || '(không ghi dự án)', wbs: e.workNumber || '', days: new Set(), normal: 0, ot: 0 };
        p.days.add(e.date); p.normal += n; p.ot += h - n; projects.set(k, p);
      }
      // so với phân loại tính lại từ giờ vào – ra bằng quy định hiện hành
      const re = recomputed.get(e.id) || {};
      const keys = new Set([...Object.keys(bd), ...Object.keys(re)]);
      const diff = [...keys].some(k => Math.abs((+bd[k] || 0) - (+re[k] || 0)) > 0.11);
      if (diff) mismatches.push(e.date);
      const pills = Object.keys(bd).filter(k => bd[k] > 0).map(k => `<span class="pill ${k === 'NORMAL' ? '' : 'ot'}">${k === 'NORMAL' ? 'Thường' : k} ${fmtH(bd[k])}</span>`).join('');
      return `<tr class="${diff ? 'bad' : ''}"><td>${esc(WEEKDAYS[dow(e.date)])} ${esc(fmtDM(e.date))}</td>
        <td>${esc(e.startTime)}–${esc(e.endTime)}${+e.breakTime ? `<div class="ac-note">nghỉ ${esc(e.breakTime)}h</div>` : ''}</td>
        <td class="r"><b>${fmtH(h)}</b></td><td>${pills}</td><td class="mono">${esc(e.activityCode)}</td>
        <td>${esc(e.projectName || '—')} <span class="mono">${esc(e.workNumber || '')}</span>${e.remarks ? `<div class="ac-note">${esc(e.remarks)}</div>` : ''}${e.report ? `<div class="rep">📝 ${esc(e.report)}</div>` : ''}</td></tr>`;
    });
    $('dDays').tBodies[0].innerHTML = rows.join('') || '<tr><td colspan="6" class="ac-note">Bảng công trống.</td></tr>';
    $('dProjects').tBodies[0].innerHTML = [...projects.values()].sort((a, b) => (b.normal + b.ot) - (a.normal + a.ot)).map(p => `<tr><td>${esc(p.name)}</td><td class="mono">${esc(p.wbs)}</td>
        <td class="r">${p.days.size}</td><td class="r">${fmtH(p.normal)}</td><td class="r">${fmtH(p.ot)}</td><td class="r"><b>${fmtH(p.normal + p.ot)}</b></td></tr>`).join('') || '<tr><td colspan="6" class="ac-note">Không có giờ làm việc.</td></tr>';
    $('dKpis').innerHTML = [['Tổng giờ làm', fmtH(normal + ot)], ['Giờ thường', fmtH(normal)], ['Tăng ca (OT)', fmtH(ot)], ['Ngày làm việc', days.size], ['Ngày nghỉ', leaveDays.size]]
      .map(([l, v]) => `<div class="ap-kpi"><span>${l}</span><b>${v}</b></div>`).join('');

    // cảnh báo: ngày làm việc chưa chấm, phân loại giờ khác bản tính lại
    const flags = [];
    const { start, end } = periodRange(period);
    const have = new Set(entries.map(e => e.date)), missing = [];
    for (let d = start; d <= end; d = addDay(d, 1)) if (isWorkday(d, sch) && !have.has(d)) missing.push(d);
    if (missing.length) flags.push(`<div class="ap-flag err">⚠ ${missing.length} ngày làm việc chưa chấm: ${missing.map(fmtDM).join(', ')}</div>`);
    if (mismatches.length) flags.push(`<div class="ap-flag err">⚠ Phân loại giờ (thường / OT) khác kết quả tính lại từ giờ vào – ra ở các ngày: ${[...new Set(mismatches)].map(fmtDM).join(', ')} (dòng tô đỏ). Nên hỏi lại người chấm công.</div>`);
    if (!missing.length && !mismatches.length) flags.push('<div class="ap-flag ok">✓ Đủ ngày làm việc; phân loại giờ khớp kết quả tính lại.</div>');
    if (doc.note) flags.push(`<div class="ap-flag">Ghi chú lần trả lại trước: ${esc(doc.note)}</div>`);
    $('dFlags').innerHTML = flags.join('');
    $('dActions').hidden = !doc.canAct;
    $('rejectBox').hidden = true; $('dMsg').textContent = '';
    $('btnApprove').textContent = doc.level === 'pm' ? 'Duyệt (chuyển sang Theo dõi giờ công)' : 'Duyệt (chuyển sang Quản lý dự án)';
    $('secDetail').hidden = false;
    $('secDetail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function openDoc(emp, period) {
    try {
      const doc = await api('GET', `/api/ts/review/${encodeURIComponent(emp)}/${encodeURIComponent(period)}`);
      current = { emp, period, doc };
      renderDetail(emp, period, doc);
    } catch (e) { toast('✗ ' + e.message); }
  }

  async function decide(action, note) {
    const msg = $('dMsg');
    const { emp, period } = current;
    msg.className = 'ac-note'; msg.textContent = 'Đang gửi…';
    ['btnApprove', 'btnReject', 'btnRejectOpen'].forEach(id => { $(id).disabled = true; });
    try {
      const r = await api('POST', `/api/ts/review/${encodeURIComponent(emp)}/${encodeURIComponent(period)}/${action}`, action === 'reject' ? { note } : {});
      const text = action === 'reject' ? 'Đã trả lại bảng công cho người chấm công.'
        : r.status === 'approved' ? `Đã duyệt xong — ${r.pushed} dòng đã sang bảng Theo dõi giờ công.` : 'Đã duyệt — chuyển sang Quản lý dự án.';
      toast('✓ ' + text);
      $('secDetail').hidden = true; current = null;
      await loadInbox();
    } catch (e) { msg.className = 'ac-note err'; msg.textContent = '✗ ' + e.message; }
    finally { ['btnApprove', 'btnReject', 'btnRejectOpen'].forEach(id => { $(id).disabled = false; }); }
  }

  function wire() {
    $('inbox').tBodies[0].addEventListener('click', (ev) => {
      const tr = ev.target.closest('tr[data-emp]');
      if (tr && ev.target.closest('[data-open]')) openDoc(tr.dataset.emp, tr.dataset.period);
    });
    $('btnReload').addEventListener('click', loadInbox);
    $('btnClose').addEventListener('click', () => { $('secDetail').hidden = true; current = null; });
    $('btnApprove').addEventListener('click', () => {
      const lv = current.doc.level === 'pm' ? 'Quản lý dự án' : 'Site Sup';
      if (confirm(`Xác nhận duyệt bảng công của ${current.doc.name} (kỳ ${current.period.slice(5)}/${current.period.slice(0, 4)}) với tư cách ${lv}?`)) decide('approve');
    });
    $('btnRejectOpen').addEventListener('click', () => { $('rejectBox').hidden = false; $('rejectNote').focus(); });
    $('btnRejectCancel').addEventListener('click', () => { $('rejectBox').hidden = true; });
    $('btnReject').addEventListener('click', () => {
      const note = $('rejectNote').value.trim();
      if (note.length < 3) { $('dMsg').className = 'ac-note err'; $('dMsg').textContent = 'Cần ghi lý do trả lại.'; return; }
      decide('reject', note).then(() => { $('rejectNote').value = ''; });
    });
  }

  async function start() {
    try { me = await api('GET', '/api/me'); }
    catch (e) {
      $('who').textContent = '';
      if (e.status === 404 || e.status === 405 || (e.status === 0 && location.hostname.endsWith('github.io'))) gate('Trang này chỉ dùng trên <b>máy chủ mới (Cloudflare)</b>.');
      else gate(esc(e.message), true);
      return;
    }
    const roleName = { admin: 'Admin', pm: 'Quản lý dự án', sitesup: 'Site Sup' };
    $('who').innerHTML = `Đăng nhập: <b>${esc(me.name)}</b> · ${esc(me.roles.map(r => roleName[r] || r).join(', ') || 'Nhân viên')}`;
    if (!me.isAdmin && !me.roles.includes('pm') && !me.roles.includes('sitesup')) { gate('Chỉ <b>Site Sup</b>, <b>Quản lý dự án</b> và <b>Admin</b> dùng trang này.'); return; }
    $('secInbox').hidden = false;
    wire();
    await loadInbox();
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
  }

  // link trong email: #xem=<mã NV>/<kỳ> mở thẳng bảng công đó
  function openFromHash() {
    const m = /^#xem=([^/]+)\/(\d{4}-\d{2})$/.exec(location.hash);
    if (!m) return;
    history.replaceState(null, '', location.pathname + location.search);
    openDoc(decodeURIComponent(m[1]), m[2]);
  }

  start();
})();
