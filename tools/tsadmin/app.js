// Quản lý bảng công (Admin / Admin dự án) — giao diện cho /api/admin/ts/* (xem server/tsadmin.mjs).
// Xem bảng công của mọi nhân viên theo kỳ lương và sửa; mỗi lần sửa phải ghi chú, người chủ bảng công thấy "Quản trị viên đã sửa".
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtTime = (iso) => { try { return new Date(iso).toLocaleString('vi-VN'); } catch (e) { return iso; } };
  const STATUS = { draft: 'Đang chấm', submitted: 'Chờ Site Sup', sitesup_ok: 'Chờ QLDA', pm_ok: 'Chờ Admin xử lý', approved: 'Đã duyệt xong', rejected: 'Bị trả lại' };
  const TS = TsExcel;
  const hoursOf = (e) => {
    const t = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return m ? +m[1] + +m[2] / 60 : null; };
    const a = t(e.startTime), b = t(e.endTime);
    if (a === null || b === null) return 0;
    let d = b - a; if (d < 0) d += 24;
    return Math.max(0, d - (parseFloat(e.breakTime) || 0));
  };
  const pad = (n) => String(n).padStart(2, '0');
  const periodOfDate = (iso) => { let y = +iso.slice(0, 4), m = +iso.slice(5, 7); if (+iso.slice(8, 10) >= 16) { m++; if (m > 12) { m = 1; y++; } } return `${y}-${pad(m)}`; };
  const shift = (p, n) => { let y = +p.slice(0, 4), m = +p.slice(5, 7) + n; while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; } return `${y}-${pad(m)}`; };
  const rangeOf = (p) => { const [y, m] = p.split('-').map(Number); const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1; return { start: `${py}-${pad(pm)}-16`, end: `${y}-${pad(m)}-15` }; };
  const labelOf = (p) => { const r = rangeOf(p); return `Kỳ ${+p.slice(5)}/${p.slice(0, 4)} (${r.start.split('-').reverse().join('/')} – ${r.end.split('-').reverse().join('/')})`; };

  let period = periodOfDate(new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10)), docs = [], others = [], cur = null;

  function toast(msg) { const el = $('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 5000); }
  async function api(method, path, body) {
    let resp;
    try {
      resp = await fetch(path, { method, credentials: 'same-origin', redirect: 'manual', cache: 'no-store',
        headers: body === undefined ? {} : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) { const err = new Error('Không gửi được yêu cầu tới máy chủ — kiểm tra mạng rồi thử lại.'); err.status = 0; throw err; }
    if (resp.type === 'opaqueredirect' || (resp.status >= 300 && resp.status < 400)) { const err = new Error('Phiên đăng nhập đã hết hạn — tải lại trang (F5).'); err.status = 401; throw err; }
    let data = {}; try { data = await resp.json(); } catch (e) { /* không phải JSON */ }
    if (!resp.ok) { const err = new Error(data.error || ('Lỗi máy chủ (HTTP ' + resp.status + ')')); err.status = resp.status; err.data = data; throw err; }
    return data;
  }
  const gate = (m, err) => { const el = $('gate'); el.innerHTML = m; el.className = 'ac-msg' + (err ? ' err' : ''); el.hidden = false; };

  // ---------- danh sách ----------
  async function loadList() {
    $('pLabel').textContent = labelOf(period);
    const body = $('tDocs').tBodies[0];
    body.innerHTML = '<tr><td colspan="6" class="ac-note">Đang tải…</td></tr>';
    try {
      const r = await api('GET', '/api/admin/ts/docs?period=' + period);
      docs = r.docs; others = r.others; renderList(); loadHr();
    } catch (e) { body.innerHTML = `<tr><td colspan="6" class="ac-note err">✗ ${esc(e.message)}</td></tr>`; }
  }
  function renderList() {
    const q = $('fFilter').value.trim().toLowerCase();
    const hit = (d) => !q || [d.empId, d.name, STATUS[d.status] || d.status].join(' ').toLowerCase().includes(q);
    const list = docs.filter(hit);
    $('tDocs').tBodies[0].innerHTML = list.map(d => `<tr data-emp="${esc(d.empId)}"><td class="mono">${esc(d.empId)}</td>
        <td><b>${esc(d.name)}</b>${d.account ? '' : ' <span class="pill">không có tài khoản</span>'}<div class="ac-note">${esc(d.position)}</div></td>
        <td><span class="ta-st ${esc(d.status)}">${esc(STATUS[d.status] || d.status)}</span></td><td class="r">${d.entries}</td>
        <td>${d.adminBy ? `<span class="ta-adm">Quản trị viên ${esc(d.adminBy)} · ${esc(fmtTime(d.adminAt))}<br>${esc(d.adminNote)}</span>` : `<span class="ac-note">${esc(d.savedBy || '')}</span>`}</td>
        <td><button class="btn small primary" data-open>Xem / sửa</button></td></tr>`).join('') || '<tr><td colspan="6" class="ac-note">Chưa có bảng công nào trong kỳ này.</td></tr>';
    $('listNote').textContent = `${list.length}/${docs.length} bảng công`;
    $('tOthers').tBodies[0].innerHTML = others.filter(o => !q || (o.empId + ' ' + o.name).toLowerCase().includes(q)).slice(0, 300).map(o => `<tr data-emp="${esc(o.empId)}"><td class="mono">${esc(o.empId)}</td><td>${esc(o.name)}</td><td>${esc(o.position)}</td>
        <td>${o.account ? 'có' : '—'}</td><td><button class="btn small" data-open>Tạo / nhập hộ</button></td></tr>`).join('') || '<tr><td colspan="5" class="ac-note">Mọi nhân viên đã có bảng công.</td></tr>';
  }

  // ---------- sửa ----------
  const rowHtml = (e, i) => `<tr data-i="${i}">
    <td><input type="date" data-f="date" value="${esc(e.date)}"></td><td><input type="time" data-f="startTime" value="${esc(e.startTime)}"></td><td><input type="time" data-f="endTime" value="${esc(e.endTime)}"></td>
    <td><input type="number" min="0" step="0.5" data-f="breakTime" value="${esc(e.breakTime)}" style="width:60px"></td>
    <td><select data-f="activityCode">${TS.ACT_META.map(a => `<option value="${esc(a.id)}"${a.id === String(e.activityCode) ? ' selected' : ''}>${esc(a.desc.slice(0, 42))}</option>`).join('')}${TS.ACT_META.some(a => a.id === String(e.activityCode)) ? '' : `<option value="${esc(e.activityCode)}" selected>${esc(e.activityCode)}</option>`}</select></td>
    <td class="wide"><input data-f="projectName" value="${esc(e.projectName)}"></td><td><input data-f="workNumber" value="${esc(e.workNumber)}" style="width:110px"></td>
    <td class="wide"><input data-f="report" value="${esc(e.report || e.remarks || '')}"></td><td><button class="btn small" data-del title="Xoá dòng">🗑</button></td></tr>`;
  async function openDoc(emp) {
    $('eMsg').textContent = '';
    try {
      const d = await api('GET', `/api/admin/ts/doc/${encodeURIComponent(emp)}/${period}`);
      cur = { emp, d, rows: (d.data.entries || []).slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.startTime).localeCompare(String(b.startTime))).map(e => ({ ...e })), del: new Set(), orig: new Map() };
      cur.rows.forEach(e => cur.orig.set(String(e.id), JSON.stringify(e)));
      $('eTitle').textContent = `${d.name} — ${labelOf(period)}`;
      $('eMeta').innerHTML = `<b>${esc(d.name)}</b> (${esc(emp)}) · ${esc(d.position)} · <span class="ta-st ${esc(d.status)}">${esc(STATUS[d.status] || d.status)}</span> · phiên bản ${d.version}${d.account ? '' : ' · <span class="pill">không có tài khoản app</span>'}`;
      $('eFlags').innerHTML = (d.adminBy ? `<div class="ap-flag">Lần sửa gần nhất: Quản trị viên <b>${esc(d.adminBy)}</b> · ${esc(fmtTime(d.adminAt))} — ${esc(d.adminNote)}</div>` : '')
        + (['approved'].includes(d.status) ? '<div class="ap-flag err">⚠ Bảng công đã duyệt xong — sửa sẽ cập nhật lại bảng Theo dõi giờ công.</div>' : '')
        + (d.status !== 'draft' && d.status !== 'rejected' ? '<div class="ap-flag">Bảng công đã nộp: người chủ không tự sửa được; bản sửa của bạn thay các dòng tương ứng.</div>' : '');
      $('tEdit').tBodies[0].innerHTML = cur.rows.map(rowHtml).join('');
      $('eNote').value = ''; $('secEdit').hidden = false; summary();
      $('secEdit').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) { toast('✗ ' + e.message); }
  }
  const FIELDS = ['date', 'startTime', 'endTime', 'breakTime', 'activityCode', 'projectName', 'workNumber', 'report'];
  const val = (e, f) => String(f === 'report' ? (e.report != null ? e.report : (e.remarks || '')) : (e[f] == null ? '' : e[f])).trim();
  function summary() {
    const rows = [...$('tEdit').tBodies[0].rows];
    let changed = 0;
    rows.forEach(tr => {
      const i = +tr.dataset.i, isDel = cur.del.has(i), e = {};
      tr.querySelectorAll('[data-f]').forEach(el => { e[el.dataset.f] = el.value; });
      const base = cur.orig.get(String(cur.rows[i].id));
      const o = base ? JSON.parse(base) : null;
      const differs = isDel || !o || FIELDS.some(f => val(o, f) !== val(e, f));
      tr.classList.toggle('del', isDel); tr.classList.toggle('chg', differs && !isDel);
      if (differs) changed++;
    });
    $('eSummary').textContent = `${rows.length} dòng · ${changed} dòng sửa / thêm / xoá`;
  }
  function collect() {
    const range = rangeOf(period), entries = [], errs = [];
    [...$('tEdit').tBodies[0].rows].forEach((tr, k) => {
      const i = +tr.dataset.i; if (cur.del.has(i)) return;
      const e = { ...cur.rows[i] };
      tr.querySelectorAll('[data-f]').forEach(el => { const f = el.dataset.f; if (f === 'report') e.report = el.value.trim(); else e[f] = el.value.trim(); });
      const leave = LaborVN.LEAVE_CODES.includes(String(e.activityCode)), where = `Dòng ${k + 1}`;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) errs.push(`${where}: chưa chọn ngày`);
      else if (e.date < range.start || e.date > range.end) errs.push(`${where}: ngày ${e.date} ngoài kỳ lương`);
      if (!(leave && String(e.activityCode) === '6090') && (!/^\d{1,2}:\d{2}$/.test(e.startTime || '') || !/^\d{1,2}:\d{2}$/.test(e.endTime || ''))) errs.push(`${where}: thiếu giờ vào / ra`);
      e.breakTime = String(e.breakTime === '' || e.breakTime == null ? '0' : e.breakTime);
      e.otMode = e.otMode || 'auto'; e.otType = e.otType || 'NORMAL'; e.dutyHour = e.dutyHour || '0';
      if (e.id == null || e.id === '') e.id = Date.now() * 100 + k;
      delete e.bd; delete e.cat;
      entries.push(e);
    });
    const sch = LaborVN.SCHEDULES[cur.d.data.sch] ? cur.d.data.sch : LaborVN.DEFAULT_SCHEDULE;
    if (!errs.length) {
      const bds = LaborVN.breakdownAll(entries, sch, hoursOf);
      entries.forEach(e => { e.bd = bds.get(e.id) || {}; e.cat = TS.catOf(String(e.activityCode)); });
    }
    return { entries, errs, sch };
  }
  async function save() {
    const msg = $('eMsg'), note = $('eNote').value.trim();
    if (note.length < 3) { msg.className = 'ac-note err'; msg.textContent = 'Cần ghi chú lý do sửa.'; $('eNote').focus(); return; }
    const { entries, errs, sch } = collect();
    if (errs.length) { msg.className = 'ac-note err'; msg.textContent = '✗ ' + errs.slice(0, 3).join('; '); return; }
    if (!confirm(`Lưu bản sửa bảng công của ${cur.d.name}? Người chủ sẽ thấy "Quản trị viên đã sửa" kèm ghi chú${cur.d.account ? ' và nhận email' : ''}.`)) return;
    $('eSave').disabled = true; msg.className = 'ac-note'; msg.textContent = 'Đang lưu…';
    try {
      const r = await api('PUT', `/api/admin/ts/doc/${encodeURIComponent(cur.emp)}/${period}`, { baseVersion: cur.d.version, note, data: { entries, sch } });
      toast(`✓ Đã lưu: ${r.changed} dòng sửa / thêm, ${r.removed} dòng xoá${r.pushed ? `; đã cập nhật lại ${r.pushed} dòng bảng Theo dõi giờ công` : ''}.`);
      $('secEdit').hidden = true; cur = null; await loadList();
    } catch (e) { msg.className = 'ac-note err'; msg.textContent = '✗ ' + e.message; }
    finally { $('eSave').disabled = false; }
  }

  // ---------- xuất cho HR ----------
  let hrDocs = [];
  const loadJs = (src) => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('không tải được thư viện ' + src.split('/').pop())); document.head.appendChild(s); });
  const tpl = async (name) => { const r = await fetch('../timesheet/' + name); if (!r.ok) throw new Error('không tải được mẫu ' + name + ' (HTTP ' + r.status + ')'); return r.arrayBuffer(); };
  async function loadHr() {
    const body = $('tHr').tBodies[0];
    try {
      const r = await api('GET', '/api/admin/ts/approved?period=' + period);
      hrDocs = r.docs;
      body.innerHTML = hrDocs.map((d, i) => `<tr><td><input type="checkbox" data-i="${i}" checked></td><td class="mono">${esc(d.empId)}</td><td><b>${esc(d.name)}</b></td><td class="r">${d.entries}</td><td>${esc(d.finalBy || '')} ${d.finalAt ? esc(fmtTime(d.finalAt)) : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="ac-note">Chưa có bảng công nào được duyệt xong trong kỳ này.</td></tr>';
      $('hrAll').checked = true; hrCount();
    } catch (e) { hrDocs = []; body.innerHTML = `<tr><td colspan="5" class="ac-note err">✗ ${esc(e.message)}</td></tr>`; }
  }
  const hrPicked = () => [...$('tHr').querySelectorAll('input[data-i]:checked')].map(x => hrDocs[+x.dataset.i]);
  function hrCount() { $('hrNote').textContent = `Đã chọn ${hrPicked().length}/${hrDocs.length} bảng công`; $('hrExport').disabled = !hrPicked().length; }
  async function hrRun() {
    const picked = hrPicked(), msg = $('hrMsg');
    if (!picked.length) return;
    $('hrExport').disabled = true; msg.className = 'ac-note'; msg.textContent = 'Đang chuẩn bị thư viện…';
    try {
      if (!window.ExcelJS) await loadJs('https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js');
      if (!window.JSZip) await loadJs('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
      const d = new Date(), today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const r = await TsHrExport.build({ ExcelJS, JSZip, TsExcel: TS, TsAllowance }, { docs: picked, period, today,
        tpl: { timesheet: await tpl('ts-template.xlsx'), allowance: await tpl('phucap-xe-template.xlsx') },
        onProgress: (n, total) => { msg.textContent = `Đang tạo file Excel ${n}/${total}…`; } });
      const a = document.createElement('a'); a.href = URL.createObjectURL(r.blob); a.download = r.name; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      msg.textContent = `✓ Đã tạo ${r.name}: ${r.files.tsCount} bảng công, phụ cấp xe ${r.files.province} tab, phụ cấp xăng ${r.files.fuel} tab.`;
    } catch (e) { msg.className = 'ac-note err'; msg.textContent = '✗ ' + e.message; }
    finally { hrCount(); }
  }

  function wire() {
    $('hrReload').addEventListener('click', loadHr);
    $('hrExport').addEventListener('click', hrRun);
    $('hrAll').addEventListener('change', () => { $('tHr').querySelectorAll('input[data-i]').forEach(x => { x.checked = $('hrAll').checked; }); hrCount(); });
    $('tHr').tBodies[0].addEventListener('change', hrCount);
    $('pPrev').addEventListener('click', () => { period = shift(period, -1); $('secEdit').hidden = true; loadList(); });
    $('pNext').addEventListener('click', () => { period = shift(period, 1); $('secEdit').hidden = true; loadList(); });
    $('fFilter').addEventListener('input', renderList);
    for (const id of ['tDocs', 'tOthers']) $(id).tBodies[0].addEventListener('click', (ev) => { const b = ev.target.closest('[data-open]'); if (b) openDoc(b.closest('tr').dataset.emp); });
    $('eClose').addEventListener('click', () => { $('secEdit').hidden = true; cur = null; });
    $('tEdit').tBodies[0].addEventListener('input', summary);
    $('tEdit').tBodies[0].addEventListener('click', (ev) => { const b = ev.target.closest('[data-del]'); if (!b) return; const i = +b.closest('tr').dataset.i; if (cur.del.has(i)) cur.del.delete(i); else cur.del.add(i); summary(); });
    $('eAdd').addEventListener('click', () => {
      const r = rangeOf(period), last = cur.rows.length ? cur.rows[cur.rows.length - 1] : null;
      const e = { id: Date.now() * 100 + cur.rows.length, date: last ? last.date : r.end, startTime: '08:00', endTime: '17:00', breakTime: '1', otMode: 'auto', otType: 'NORMAL', activityCode: last ? last.activityCode : '1110', projectName: last ? last.projectName : '', workNumber: last ? last.workNumber : '', dutyHour: '0', report: '' };
      cur.rows.push(e);
      $('tEdit').tBodies[0].insertAdjacentHTML('beforeend', rowHtml(e, cur.rows.length - 1)); summary();
    });
    $('eSave').addEventListener('click', save);
    $('hRun').addEventListener('click', runHistory);
  }

  // ---------- nhập lịch sử từ Theo dõi giờ công ----------
  async function runHistory() {
    const a = $('hFrom').value, b = $('hTo').value || a, log = $('hLog');
    if (!/^\d{4}-\d{2}$/.test(a) || !/^\d{4}-\d{2}$/.test(b) || b < a) { toast('Chọn khoảng kỳ lương hợp lệ (từ kỳ ≤ đến kỳ).'); return; }
    if (!confirm(`Nhập lịch sử từ kỳ ${a} đến kỳ ${b}? Nhân viên đã có bảng công kỳ đó không bị ghi đè.`)) return;
    $('hRun').disabled = true; log.textContent = '';
    const say = (t) => { log.textContent += t + '\n'; log.scrollTop = log.scrollHeight; };
    let grand = 0, emps = 0;
    try {
      for (let p = a; p <= b; p = shift(p, 1)) {
        const info = await api('GET', '/api/admin/ts/history?period=' + p);
        say(`Kỳ ${p}: ${info.employees} nhân viên có dữ liệu, ${info.done} đã có bảng công`);
        for (let guard = 0; guard < 400; guard++) {
          const r = await api('POST', '/api/admin/ts/history', { period: p });
          if (r.imported) { say(`   + ${r.imported} nhân viên (${r.rows} dòng), còn ${r.remaining}`); grand += r.rows; emps += r.imported; }
          if (!r.remaining) break;
        }
      }
      say(`✓ Xong: ${emps} bảng công, ${grand} dòng.`); toast(`✓ Đã nhập ${emps} bảng công lịch sử.`);
    } catch (e) { say('✗ ' + e.message); }
    finally { $('hRun').disabled = false; }
  }

  async function start() {
    let me;
    try { me = await fetch('/api/me', { credentials: 'same-origin', redirect: 'manual', cache: 'no-store' }).then(r => r.json()); }
    catch (e) { gate('Trang này chỉ dùng trên <b>máy chủ mới (Cloudflare)</b>.'); return; }
    $('who').innerHTML = `Đăng nhập: <b>${esc(me.name)}</b> · ${me.isAdmin ? 'Admin' : me.isProjAdmin ? 'Admin dự án' : ''}`;
    if (!me.isAdmin && !me.isProjAdmin) { gate('Chỉ <b>Admin</b> và <b>Admin dự án</b> dùng trang này.'); return; }
    $('secList').hidden = false; $('secHr').hidden = false; $('secHist').hidden = false; wire(); await loadList();
  }
  start();
})();
