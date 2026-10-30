// Nhập bảng công từ Excel (giám sát / QLDA / Admin) — đọc file mẫu Schindler, chỉnh theo quy tắc & dữ liệu dự án, nộp qua /api/ts/import (server/tsimport.mjs).
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtH = (h) => (Math.round(h * 10) / 10).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  const plain = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, ' ').trim();
  const TS = TsExcel, pad = (n) => String(n).padStart(2, '0');
  const HR_WBS = ['PAID LEAVE', 'UNPAID LEAVE', 'TRAINING-NI', 'TRAINING-EI', 'MEETINGS'];
  const rangeOf = (p) => { const [y, m] = p.split('-').map(Number); const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1; return { start: `${py}-${pad(pm)}-16`, end: `${y}-${pad(m)}-15` }; };
  const hoursOf = (e) => {
    const t = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return m ? +m[1] + +m[2] / 60 : null; };
    const a = t(e.startTime), b = t(e.endTime);
    if (a === null || b === null) return 0;
    let d = b - a; if (d < 0) d += 24;
    return Math.max(0, d - (parseFloat(e.breakTime) || 0));
  };

  let employees = [], projects = new Map(), cards = [], seq = 0;

  function toast(msg) { const el = $('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 5000); }
  async function api(method, path, body) {
    let resp;
    try {
      resp = await fetch(path, { method, credentials: 'same-origin', redirect: 'manual', cache: 'no-store',
        headers: body === undefined ? {} : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) { const err = new Error('Không gửi được yêu cầu tới máy chủ — kiểm tra mạng rồi thử lại.'); err.status = 0; throw err; }
    if (resp.type === 'opaqueredirect' || (resp.status >= 300 && resp.status < 400)) { const err = new Error('Phiên đăng nhập đã hết hạn — tải lại trang (F5).'); err.status = 401; throw err; }
    let data = {}; try { data = await resp.json(); } catch (e) { /* không phải JSON */ }
    if (!resp.ok) { const err = new Error(data.error || ('Lỗi máy chủ (HTTP ' + resp.status + ')')); err.status = resp.status; throw err; }
    return data;
  }
  const gate = (m, err) => { const el = $('gate'); el.innerHTML = m; el.className = 'ac-msg' + (err ? ' err' : ''); el.hidden = false; };
  const loadJs = (src) => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('không tải được thư viện đọc Excel (cần mạng)')); document.head.appendChild(s); });

  // ---------- đọc file ----------
  function matchEmployee(p) {
    const id = String(p.empId || '').trim().toLowerCase();
    let e = employees.find(x => String(x.empId).trim().toLowerCase() === id);
    if (e) return e.empId;
    const nm = plain(p.name);
    const byName = nm ? employees.filter(x => plain(x.name) === nm) : [];
    return byName.length === 1 ? byName[0].empId : '';
  }
  async function readFiles(files) {
    $('pickMsg').textContent = 'Đang đọc…';
    try { if (!window.ExcelJS) await loadJs('https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js'); }
    catch (e) { $('pickMsg').className = 'ac-note err'; $('pickMsg').textContent = '✗ ' + e.message; return; }
    for (const f of files) {
      try {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(await f.arrayBuffer());
        const sheet = wb.getWorksheet('New TS') || wb.worksheets[0];
        const p = TS.parseTimesheet(sheet);
        const sch = LaborVN.DEFAULT_SCHEDULE;
        cards.push({ id: ++seq, file: f.name, parsed: p, empId: matchEmployee(p), period: p.period, sch, include: true, del: new Set(),
          rows: p.entries.map((e, i) => ({ ...e, id: Date.now() * 100 + seq * 1000 + i, otMode: 'auto', otType: 'NORMAL', dutyHour: '0', report: e.remarks ? '' : '' })) });
      } catch (e) { cards.push({ id: ++seq, file: f.name, error: 'Không đọc được file: ' + e.message }); }
    }
    $('pickMsg').className = 'ac-note'; $('pickMsg').textContent = `${cards.length} file`;
    render();
  }

  // ---------- kiểm tra theo quy tắc ----------
  function analyse(c) {
    const range = c.period ? rangeOf(c.period) : null;
    const rows = c.rows.filter(r => !c.del.has(r.id));
    const bds = LaborVN.breakdownAll(rows.map(r => ({ ...r })), c.sch, hoursOf);
    const per = new Map();        // id → {issues[], warns[], bd}
    const byDay = new Map();
    rows.forEach(r => { if (!byDay.has(r.date)) byDay.set(r.date, []); byDay.get(r.date).push(r); });
    rows.forEach(r => {
      const issues = [], warns = [];
      const code = String(r.activityCode || ''), leave = LaborVN.LEAVE_CODES.includes(code), unpaid = code === '6090';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date || '')) issues.push('Chưa có ngày');
      else if (range && (r.date < range.start || r.date > range.end)) issues.push(`Ngày ngoài kỳ ${range.start.split('-').reverse().join('/')} – ${range.end.split('-').reverse().join('/')}`);
      if (!unpaid && (!/^\d{1,2}:\d{2}$/.test(r.startTime || '') || !/^\d{1,2}:\d{2}$/.test(r.endTime || ''))) issues.push('Thiếu giờ vào / ra');
      else if (!unpaid && r.startTime === r.endTime) issues.push('Giờ vào trùng giờ ra');
      if (!TS.ACT_META.some(a => a.id === code)) issues.push('Chưa chọn mã công việc hợp lệ');
      const meta = TS.ACT_META.find(a => a.id === code), wbs = String(r.workNumber || '').trim();
      if (!leave) {
        if (meta && meta.cat === 'HR') { if (wbs && !HR_WBS.includes(wbs.toUpperCase()) && !projects.has(wbs.toUpperCase())) warns.push('WBS lạ cho hoạt động ngoài dự án'); }
        else if (!wbs) issues.push('Chưa chọn dự án (WBS)');
        else if (!projects.has(wbs.toUpperCase())) issues.push('WBS không có trong danh sách dự án');
      }
      const h = hoursOf(r);
      if (!unpaid && h > 16) issues.push('Ca dài hơn 16 giờ — kiểm tra giờ vào / ra');
      // chồng giờ trong cùng ngày
      (byDay.get(r.date) || []).forEach(o => {
        if (o === r || unpaid || !o.startTime || !o.endTime || !r.startTime || !r.endTime) return;
        const s1 = TS.calculateHours('00:00', r.startTime, 0), e1 = s1 + hoursOf({ startTime: r.startTime, endTime: r.endTime, breakTime: 0 }), s2 = TS.calculateHours('00:00', o.startTime, 0), e2 = s2 + hoursOf({ startTime: o.startTime, endTime: o.endTime, breakTime: 0 });
        if (r.id < o.id && s1 < e2 && s2 < e1) warns.push('Trùng giờ với dòng khác cùng ngày');
      });
      const bd = bds.get(r.id) || {}, normal = bd.NORMAL || 0, ot = Object.keys(bd).filter(k => k !== 'NORMAL').reduce((a, k) => a + bd[k], 0);
      if (r.excel && (r.excel.normal || Object.keys(r.excel.ot).length)) {
        const xo = Object.values(r.excel.ot).reduce((a, v) => a + v, 0);
        if (Math.abs(r.excel.normal - normal) > 0.26 || Math.abs(xo - ot) > 0.26) warns.push(`Excel ghi ${fmtH(r.excel.normal)}h thường + ${fmtH(xo)}h OT; theo quy tắc là ${fmtH(normal)}h + ${fmtH(ot)}h — hệ thống tính lại theo quy tắc`);
      }
      per.set(r.id, { issues, warns, bd });
    });
    return per;
  }

  // ---------- giao diện ----------
  const actOptions = (sel) => TS.ACT_META.map(a => `<option value="${esc(a.id)}"${a.id === String(sel) ? ' selected' : ''}>${esc(a.desc.slice(0, 46))}</option>`).join('') + (TS.ACT_META.some(a => a.id === String(sel)) ? '' : `<option value="" selected>— chọn —</option>`);
  function cardHtml(c) {
    if (c.error) return `<section class="ac-card up-card"><b>${esc(c.file)}</b> <span class="up-err">${esc(c.error)}</span> <button class="btn small" data-rm="${c.id}">Bỏ</button></section>`;
    const per = analyse(c), rows = c.rows;
    const nIss = [...per.values()].reduce((a, x) => a + x.issues.length, 0), emp = employees.find(e => e.empId === c.empId);
    const tot = [...per.entries()].reduce((a, [id, x]) => { if (c.del.has(id)) return a; Object.keys(x.bd).forEach(k => { a[k === 'NORMAL' ? 0 : 1] += x.bd[k]; }); return a; }, [0, 0]);
    c.ok = !nIss && !!emp && !!c.period && rows.some(r => !c.del.has(r.id));
    const probs = [...c.parsed.problems, ...(emp ? [] : ['Chưa xác định được nhân viên trong EE Data — chọn bên dưới']), ...(c.period ? [] : ['Chưa chọn kỳ lương'])];
    return `<section class="ac-card up-card" data-c="${c.id}">
      <div class="up-head"><b>${esc(c.file)}</b>
        <label>Nhân viên <input type="search" list="dlEmp" data-f="emp" value="${esc(emp ? `${emp.empId} — ${emp.name}` : c.empId)}" size="34" placeholder="gõ mã / tên"></label>
        <label>Kỳ lương (tháng kết thúc) <input type="month" data-f="period" value="${esc(c.period)}"></label>
        <label>Lịch làm việc <select data-f="sch">${Object.keys(LaborVN.SCHEDULES).map(k => `<option value="${k}"${c.sch === k ? ' selected' : ''}>${esc(LaborVN.SCHEDULES[k].label || k)}</option>`).join('')}</select></label>
        <label><input type="checkbox" data-f="include"${c.include ? ' checked' : ''}> Nộp bảng công này</label>
        <button class="btn small" data-rm="${c.id}">Bỏ file</button></div>
      <div class="ap-meta">${esc(c.parsed.name)} (${esc(c.parsed.empId)}) · ${esc(c.parsed.position)} · ${rows.length - c.del.size} dòng · <b>${fmtH(tot[0])}</b> giờ thường + <b>${fmtH(tot[1])}</b> giờ OT (tính lại theo quy tắc) ·
        ${c.ok ? '<span class="up-ok">✓ hợp lệ</span>' : `<span class="up-err">${nIss + probs.length} vấn đề cần sửa</span>`}</div>
      ${probs.map(p => `<div class="ap-flag err">⚠ ${esc(p)}</div>`).join('')}
      <div class="ac-scroll ac-tall"><table class="ac-table ta-edit"><thead><tr><th>Ngày</th><th>Từ</th><th>Đến</th><th>Nghỉ</th><th>Mã CV</th><th>Dự án</th><th>WBS</th><th>Báo cáo / ghi chú</th><th></th></tr></thead><tbody>
      ${rows.map(r => { const x = per.get(r.id) || { issues: [], warns: [], bd: {} }, del = c.del.has(r.id);
        return `<tr data-r="${r.id}" class="${del ? 'del' : x.issues.length ? 'bad' : ''}">
        <td><input type="date" data-f="date" value="${esc(r.date)}"></td><td><input type="time" data-f="startTime" value="${esc(r.startTime)}"></td><td><input type="time" data-f="endTime" value="${esc(r.endTime)}"></td>
        <td><input type="number" min="0" step="0.5" data-f="breakTime" value="${esc(r.breakTime)}" style="width:58px"></td>
        <td><select data-f="activityCode">${actOptions(r.activityCode)}</select></td>
        <td class="wide"><input data-f="projectName" value="${esc(r.projectName)}"></td><td><input data-f="workNumber" list="dlWbs" value="${esc(r.workNumber)}" style="width:110px"></td>
        <td class="wide"><input data-f="remarks" value="${esc(r.remarks)}">${x.issues.map(i => `<div class="iss">✗ ${esc(i)}</div>`).join('')}${x.warns.map(i => `<div class="wrn">⚠ ${esc(i)}</div>`).join('')}
          <div class="up-bd">${Object.keys(x.bd).map(k => `<span class="${k === 'NORMAL' ? '' : 'ot'}">${k === 'NORMAL' ? 'Thường' : k} ${fmtH(x.bd[k])}</span>`).join('')}</div></td>
        <td><button class="btn small" data-del title="Xoá / khôi phục dòng">🗑</button></td></tr>`; }).join('')}
      </tbody></table></div></section>`;
  }
  function render() {
    $('cards').innerHTML = (cards.length ? '<h2 style="margin:14px 0 6px">2. Kiểm tra và chỉnh lại</h2>' : '') + cards.map(cardHtml).join('');
    const ok = cards.filter(c => !c.error && c.include && c.ok), bad = cards.filter(c => !c.error && c.include && !c.ok);
    $('secSend').hidden = !cards.length;
    $('btnSend').disabled = !ok.length || !!bad.length;
    $('sendSummary').innerHTML = `${ok.length} bảng công hợp lệ sẽ được nộp${bad.length ? ` · <span class="up-err">${bad.length} bảng còn lỗi — sửa hoặc bỏ tick "Nộp bảng công này"</span>` : ''}. Nhân viên đã có bảng công đang nộp / đang duyệt sẽ không bị ghi đè.`;
  }
  const cardOf = (el) => cards.find(c => c.id === +el.closest('[data-c]').dataset.c);
  function wire() {
    $('fFiles').addEventListener('change', (ev) => { const f = [...ev.target.files]; ev.target.value = ''; if (f.length) readFiles(f); });
    const cardsEl = $('cards');
    cardsEl.addEventListener('click', (ev) => {
      const rm = ev.target.closest('[data-rm]'); if (rm) { cards = cards.filter(c => c.id !== +rm.dataset.rm); render(); return; }
      const del = ev.target.closest('[data-del]'); if (del) { const c = cardOf(del), id = +del.closest('tr').dataset.r; if (c.del.has(id)) c.del.delete(id); else c.del.add(id); render(); }
    });
    cardsEl.addEventListener('change', (ev) => {
      const el = ev.target, f = el.dataset.f; if (!f) return;
      const c = cardOf(el);
      if (f === 'emp') { const id = String(el.value).split('—')[0].trim(); const e = employees.find(x => x.empId.toLowerCase() === id.toLowerCase()); c.empId = e ? e.empId : ''; }
      else if (f === 'period') c.period = el.value;
      else if (f === 'sch') c.sch = el.value;
      else if (f === 'include') c.include = el.checked;
      else { const r = c.rows.find(x => x.id === +el.closest('tr').dataset.r); r[f] = el.value;
        if (f === 'workNumber') { const p = projects.get(String(el.value).trim().toUpperCase()); if (p && !r.projectName) r.projectName = p; if (p && r.projectName !== p) r.projectName = p; } }
      render();
    });
    $('btnSend').addEventListener('click', send);
  }

  // ---------- nộp ----------
  async function send() {
    const list = cards.filter(c => !c.error && c.include && c.ok);
    if (!list.length) return;
    if (!confirm(`Nộp ${list.length} bảng công? Hệ thống ghi bảng công cho từng nhân viên và gửi thư cho Site Sup / Quản lý dự án để duyệt từ đầu.`)) return;
    const btn = $('btnSend'), msg = $('sendMsg');
    btn.disabled = true; msg.className = 'ac-note'; msg.textContent = 'Đang nộp…';
    const out = [];
    try {
      for (let i = 0; i < list.length; i += 10) {
        const part = list.slice(i, i + 10), items = part.map(c => {
          const rows = c.rows.filter(r => !c.del.has(r.id));
          const bds = LaborVN.breakdownAll(rows.map(r => ({ ...r })), c.sch, hoursOf), base = Date.now() * 100 + c.id * 1000, u = Date.now();
          const entries = rows.map((r, k) => { const { excel, row, ...e } = r;
            return { ...e, id: base + k, breakTime: String(r.breakTime === '' ? '0' : r.breakTime), bd: bds.get(r.id) || {}, cat: TS.catOf(String(r.activityCode)), u, report: r.remarks || '' }; });
          return { empId: c.empId, period: c.period, sch: c.sch, entries };
        });
        const r = await api('POST', '/api/ts/import', { items });
        r.results.forEach((x, k) => out.push({ card: part[k], ...x }));
      }
      msg.textContent = '';
    } catch (e) { msg.className = 'ac-note err'; msg.textContent = '✗ ' + e.message; btn.disabled = false; }
    $('results').innerHTML = `<table class="ac-table"><thead><tr><th>File</th><th>Nhân viên</th><th>Kết quả</th></tr></thead><tbody>${out.map(x => `<tr><td>${esc(x.card.file)}</td><td>${esc(x.name || x.empId)} · kỳ ${esc(x.period)}</td>
      <td>${x.ok ? `<span class="up-ok">✓ đã nộp — ${x.entries} dòng, chờ duyệt (${esc(x.status)})</span>` : `<span class="up-err">✗ ${esc(x.error)}</span>`}</td></tr>`).join('')}</tbody></table>`;
    const done = out.filter(x => x.ok).map(x => x.card.id);
    cards = cards.filter(c => !done.includes(c.id)); render();
    $('secSend').hidden = false;
    toast(`✓ Đã nộp ${done.length}/${out.length} bảng công.`);
  }

  async function start() {
    let me;
    try { me = await api('GET', '/api/me'); }
    catch (e) { $('who').textContent = ''; gate(e.status === 404 || e.status === 405 ? 'Trang này chỉ dùng trên <b>máy chủ mới (Cloudflare)</b>.' : esc(e.message), true); return; }
    $('who').innerHTML = `Đăng nhập: <b>${esc(me.name)}</b>`;
    if (!me.isAdmin && !me.roles.some(r => ['pm', 'sitesup', 'projadmin'].includes(r))) { gate('Chỉ <b>Site Sup</b>, <b>Quản lý dự án</b>, <b>Admin dự án</b> và <b>Admin</b> dùng trang này.'); return; }
    try {
      employees = (await api('GET', '/api/employees')).employees;
      for (const p of (await api('GET', '/api/projects')).projects) projects.set(String(p.wbs).toUpperCase(), p.projectName);
    } catch (e) { gate('✗ ' + esc(e.message), true); return; }
    const dl = document.createElement('datalist'); dl.id = 'dlEmp'; dl.innerHTML = employees.map(e => `<option value="${esc(e.empId)} — ${esc(e.name)}">`).join(''); document.body.appendChild(dl);
    $('dlWbs').innerHTML = [...projects.entries()].map(([w, n]) => `<option value="${esc(w)}">${esc(n)}</option>`).join('');
    $('secPick').hidden = false; wire();
  }
  start();
})();
