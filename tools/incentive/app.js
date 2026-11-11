// Incentive — Thưởng lắp đặt (chỉ Admin). Scheme SWAT; SITE để sau.
// Luồng một đợt: 1 chọn dự án + cách trả → 2 duyệt Standard Hour → 3 duyệt Scorecard (công cụ tools/swat-hour nhúng iframe,
// lưu trạng thái vào dự án cho lần sau) → 4 chia thưởng theo % giờ công → 5 tổng hợp, xuất Excel, chốt đợt.
// Máy chủ: server/incentive.mjs; tính toán: incentive.js; file List: incexcel.js.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => Math.round(Number(n) || 0).toLocaleString('vi-VN');
  const fmt1 = (n) => (Math.round((Number(n) || 0) * 10) / 10).toLocaleString('vi-VN');
  const pct = (x) => (x == null ? '—' : (Math.round(x * 1000) / 10).toLocaleString('vi-VN') + '%');
  const ml = (m) => (m ? `${m.slice(5, 7)}/${m.slice(0, 4)}` : '');
  const fmtTime = (iso) => { try { return new Date(iso).toLocaleString('vi-VN'); } catch (e) { return iso; } };
  const SCHEME = 'swat';
  const KINDS = Incentive.KINDS, plain = Incentive.plain;

  let me = null, employees = [], empByName = new Map(), empById = new Map(), projects = new Map(), history = [], batches = [];
  let cur = null;          // đợt đang mở {id, month, title, status, version, source, data}
  let step = 1, revIdx = 0, hoursBy = new Map(), saveTimer = null, saving = null, dirty = false;

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
  const readOnly = () => !cur || cur.status === 'done';
  const items = () => (cur ? cur.data.projects : []);

  // ---------- dữ liệu chung ----------
  async function loadRefs() {
    const [e, p, h] = await Promise.all([api('GET', '/api/employees'), api('GET', '/api/projects'), api('GET', '/api/incentive/history?scheme=' + SCHEME)]);
    employees = e.employees || [];
    empByName = new Map(employees.map(x => [plain(x.name), x]));
    empById = new Map(employees.map(x => [String(x.empId), x]));
    projects = new Map((p.projects || []).map(x => [String(x.wbs), x]));
    history = h.items || [];
    const hw = new Map(); history.forEach(x => { if (!hw.has(x.wbs)) hw.set(x.wbs, x.name || ''); });
    $('dlHistWbs').innerHTML = [...hw].map(([w, n]) => `<option value="${esc(w)}" label="${esc(n)}"></option>`).join('');
    $('dlProjWbs').innerHTML = [...projects.values()].map(x => `<option value="${esc(x.wbs)}" label="${esc(x.projectName || x.name || '')}"></option>`).join('');
    $('dlEmp').innerHTML = employees.filter(x => x.active !== false).map(x => `<option value="${esc(x.name)}" label="${esc(x.empId)} · ${esc(x.position || '')}"></option>`).join('');
  }
  const histOf = (wbs) => history.filter(x => x.wbs === wbs && (!cur || x.batchId !== cur.id));
  const empOf = (name) => empByName.get(plain(name)) || null;

  // ---------- danh sách đợt ----------
  const STATUS_PILL = (b) => (b.status === 'done' ? `<span class="pill ok">Đã chốt</span>${b.source === 'import' ? ' <span class="pill info">từ Excel</span>' : ''}` : '<span class="pill wait">Đang làm</span>')
    + (b.publishedAt ? ` <span class="pill info" title="Phát hành lúc ${esc(fmtTime(b.publishedAt))}">📣 Đã phát hành</span>` : '');
  async function loadList() {
    const r = await api('GET', '/api/incentive/batches?scheme=' + SCHEME);
    batches = r.batches || [];
    $('tBatches').tBodies[0].innerHTML = batches.map(b => `<tr data-id="${b.id}">
        <td data-label="Tháng"><b>${ml(b.month)}</b></td><td data-label="Đợt">${esc(b.title || '—')}</td><td data-label="Trạng thái">${STATUS_PILL(b)}</td>
        <td class="r" data-label="Dự án">${b.projects}</td><td class="r" data-label="Tổng tiền"><b>${money(b.total)}</b></td>
        <td data-label="Cập nhật"><span class="ac-note">${esc(fmtTime(b.updatedAt))} · ${esc(b.updatedBy)}</span></td>
        <td><button class="btn small" type="button" data-open>Mở</button></td></tr>`).join('')
      || '<tr><td colspan="7" class="ac-note">Chưa có đợt nào. Bấm <b>+ Đợt mới</b>, hoặc <b>Tải Excel lên</b> để ghi nhận các đợt đã chia trước đây.</td></tr>';
    $('listNote').textContent = batches.length ? `${batches.length} đợt · đã chốt ${batches.filter(b => b.status === 'done').length} · đã phát hành ${batches.filter(b => b.publishedAt).length}` : '';
    const unpub = batches.filter(b => b.status === 'done' && !b.publishedAt);
    $('btnPubAll').hidden = !unpub.length;
    $('btnPubAll').textContent = `📣 Phát hành ${unpub.length} đợt đã chốt`;
    if (unpub.length) $('listNote').textContent += ` — ${unpub.length} đợt đã chốt CHƯA phát hành: người được chia thưởng chưa xem được trong trang "Thưởng của tôi".`;
    renderReport();
  }

  // ---------- báo cáo & tra cứu (các đợt đã chốt) ----------
  function renderReport() {
    const yearSel = $('rYear'), batchSel = $('rBatch');
    const years = [...new Set(history.map(h => h.month.slice(0, 4)))].sort().reverse();
    const keepY = yearSel.value, keepB = batchSel.value;
    yearSel.innerHTML = '<option value="">Tất cả</option>' + years.map(y => `<option${y === keepY ? ' selected' : ''}>${y}</option>`).join('');
    const y = yearSel.value;
    const bIds = [...new Map(history.filter(h => !y || h.month.startsWith(y)).map(h => [h.batchId, h.month])).entries()].sort((a, b) => b[1].localeCompare(a[1]));
    batchSel.innerHTML = '<option value="">Tất cả các đợt</option>' + bIds.map(([id, m]) => `<option value="${id}"${String(id) === keepB ? ' selected' : ''}>Đợt ${ml(m)}</option>`).join('');
    const bId = batchSel.value, view = $('rView').value, q = plain($('rSearch').value);
    // các dòng (mỗi dòng = một người ở một dự án trong một đợt) sau khi lọc
    const rows = [];
    history.forEach(h => {
      if (y && !h.month.startsWith(y)) return;
      if (bId && String(h.batchId) !== bId) return;
      const projHit = !q || plain(`${h.name} ${h.wbs}`).includes(q);
      h.lines.forEach(l => { if (projHit || plain(`${l.name} ${l.empId}`).includes(q)) rows.push({ ...l, batchId: h.batchId, month: h.month, wbs: h.wbs, project: h.name, kind: h.kind }); });
    });
    const sum = (list, f = () => true) => list.filter(f).reduce((a, r) => a + (Number(r.amount) || 0), 0);
    const pkey = (r) => r.empId || 'n:' + plain(r.name);
    const box = (l, v) => `<div><span>${l}</span><b>${v}</b></div>`;
    $('rKpis').innerHTML = rows.length ? box('Tổng đã chia', money(sum(rows)) + ' đ') + box('Fitter', money(sum(rows, r => r.role === 'fitter')) + ' đ') + box('Site-sup', money(sum(rows, r => r.role === 'sup')) + ' đ')
      + box('Đợt', new Set(rows.map(r => r.batchId)).size) + box('Dự án', new Set(rows.map(r => r.wbs)).size) + box('Người nhận', new Set(rows.map(pkey)).size) : '';
    if (!history.length) { $('rBody').innerHTML = '<p class="ac-note">Chưa có đợt nào đã chốt. Chốt một đợt hoặc tải file Excel các đợt trước lên để xem báo cáo.</p>'; return; }
    if (!rows.length) { $('rBody').innerHTML = '<p class="ac-note">Không có kết quả phù hợp.</p>'; return; }
    const group = (keyFn) => { const m = new Map(); rows.forEach(r => { const k = keyFn(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }); return [...m.values()]; };
    const role = (r) => (r.role === 'sup' ? 'Site-sup' : 'Fitter');
    const kindS = (k) => (KINDS[k] ? KINDS[k].short : k);
    const table = (head, body) => `<div class="ac-scroll"><table class="ac-table ni-cards"><thead><tr>${head.map(x => `<th${x.startsWith('>') ? ' class="r"' : ''}>${x.replace(/^>/, '')}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
    let html = '';
    if (view === 'batch') {
      html = table(['Đợt', 'Tên đợt', '>Dự án', '>Người nhận', '>Fitter', '>Site-sup', '>Tổng', ''], group(r => r.batchId).sort((a, b) => b[0].month.localeCompare(a[0].month)).map(g => {
        const b = batches.find(x => x.id === g[0].batchId) || {};
        return `<tr><td data-label="Đợt"><b>${ml(g[0].month)}</b> ${b.publishedAt ? '<span class="pill info" title="Đã phát hành">📣</span>' : ''}</td><td data-label="Tên đợt">${esc(b.title || '')}</td>
          <td class="r" data-label="Dự án">${new Set(g.map(r => r.wbs)).size}</td><td class="r" data-label="Người nhận">${new Set(g.map(pkey)).size}</td>
          <td class="r" data-label="Fitter">${money(sum(g, r => r.role === 'fitter'))}</td><td class="r" data-label="Site-sup">${money(sum(g, r => r.role === 'sup'))}</td><td class="r" data-label="Tổng"><b>${money(sum(g))}</b></td>
          <td><button class="btn small" type="button" data-openb="${g[0].batchId}">Mở đợt</button></td></tr>`;
      }).join(''));
    } else if (view === 'project') {
      const gs = group(r => r.wbs).sort((a, b) => sum(b) - sum(a));
      html = gs.slice(0, 300).map(g => `<details class="in-rep"${gs.length === 1 ? ' open' : ''}><summary><b>${esc(g[0].project || g[0].wbs)}</b> <span class="mono ac-note">${esc(g[0].wbs)}</span>
          <span class="ac-note">${[...new Set(g.map(r => `${ml(r.month)} ${kindS(r.kind)}`))].join(' · ')}</span><span class="in-amt">${money(sum(g))} đ</span></summary>
        <div>${table(['Đợt', 'Loại', 'Vai trò', 'Họ tên', 'Mã NV', '>% giờ công', '>Số tiền (đ)'], g.slice().sort((a, b) => a.month.localeCompare(b.month) || (a.role === b.role ? b.amount - a.amount : a.role === 'sup' ? -1 : 1)).map(r => `<tr>
          <td data-label="Đợt">${ml(r.month)}</td><td data-label="Loại">${esc(kindS(r.kind))}</td><td data-label="Vai trò">${role(r)}</td><td data-label="Họ tên">${esc(r.name)}</td><td class="mono" data-label="Mã NV">${esc(r.empId || '—')}</td>
          <td class="r" data-label="% giờ công">${r.pct == null ? '' : pct(r.pct)}</td><td class="r" data-label="Số tiền"><b>${money(r.amount)}</b></td></tr>`).join(''))}</div></details>`).join('')
        + (gs.length > 300 ? `<p class="ac-note">… còn ${gs.length - 300} dự án — lọc thêm để xem.</p>` : '');
    } else {
      const gs = group(pkey).sort((a, b) => sum(b) - sum(a));
      html = gs.slice(0, 300).map(g => `<details class="in-rep"${gs.length === 1 ? ' open' : ''}><summary><b>${esc(g[0].name)}</b> <span class="mono ac-note">${esc((g.find(r => r.empId) || {}).empId || '')}</span>
          <span class="ac-note">${[...new Set(g.map(role))].join(' / ')} · ${new Set(g.map(r => r.wbs)).size} dự án · ${new Set(g.map(r => r.batchId)).size} đợt</span><span class="in-amt">${money(sum(g))} đ</span></summary>
        <div>${table(['Đợt', 'Dự án', 'WBS', 'Loại', 'Vai trò', '>% giờ công', '>Số tiền (đ)'], g.slice().sort((a, b) => b.month.localeCompare(a.month)).map(r => `<tr>
          <td data-label="Đợt">${ml(r.month)}</td><td data-label="Dự án">${esc(r.project)}</td><td class="mono" data-label="WBS">${esc(r.wbs)}</td><td data-label="Loại">${esc(kindS(r.kind))}</td><td data-label="Vai trò">${role(r)}</td>
          <td class="r" data-label="% giờ công">${r.pct == null ? '' : pct(r.pct)}</td><td class="r" data-label="Số tiền"><b>${money(r.amount)}</b></td></tr>`).join(''))}</div></details>`).join('')
        + (gs.length > 300 ? `<p class="ac-note">… còn ${gs.length - 300} người — lọc thêm để xem.</p>` : '');
    }
    $('rBody').innerHTML = html;
  }

  function nextOddMonth() {
    const d = new Date(Date.now() + 7 * 36e5); let y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
    if (m % 2 === 0) m++; if (m > 12) { m = 1; y++; }
    return `${y}-${String(m).padStart(2, '0')}`;
  }

  // ---------- mở một đợt ----------
  async function openBatch(id) {
    const b = await api('GET', '/api/incentive/batches/' + id);
    cur = b; cur.data = cur.data || { projects: [] }; cur.data.projects = cur.data.projects || [];
    items().forEach(normalize);
    hoursBy = new Map(); revIdx = 0; dirty = false;
    $('secList').hidden = true; $('secImport').hidden = true; $('secReport').hidden = true; $('editor').hidden = false;
    renderBar();
    go(items().length ? (items().every(p => p.lines && p.lines.length) ? 5 : 1) : 1);
    window.scrollTo(0, 0);
  }
  // dự án nhập từ Excel chưa có cấu trúc chia → dựng lại từ các dòng (giữ đúng số tiền: nhập tay)
  function normalize(p) {
    p.swat = p.swat || {};
    if (!p.fitters) {
      const sup = (p.lines || []).find(l => l.role === 'sup');
      p.sup = sup ? { empId: sup.empId || '', name: sup.name, amount: p.imported ? sup.amount : undefined } : null;
      p.fitters = (p.lines || []).filter(l => l.role === 'fitter').map(l => ({ empId: l.empId || '', name: l.name,
        hours: l.hours != null ? l.hours : (l.pct != null ? Math.round(l.pct * 1000) / 10 : 0), amount: p.imported ? l.amount : undefined }));
      if (p.imported && p.fundF == null) {
        const k = KINDS[p.kind] || KINDS.first70;
        if (k.stage !== 'final') { p.fundF = Math.round(p.fitters.reduce((s, f) => s + (Number(f.amount) || 0), 0) / k.rate); p.fundS = Math.round((p.sup && Number(p.sup.amount) || 0) / k.rate); }
        else { p.fundF = 0; p.fundS = 0; }
      }
    }
    recompute(p);
  }
  function recompute(p) {
    const r = Incentive.compute({ kind: p.kind, fundF: p.fundF, fundS: p.fundS, sup: p.sup, fitters: p.fitters, paid: Incentive.paidMap(histOf(p.wbs)), handoverDate: p.handoverDate, finalDate: p.finalDate });
    p.lines = r.lines; p.total = r.total; p.fitterTotal = r.fitterTotal; p.supTotal = r.supTotal; p.supRule = r.supRule;
    return r;
  }
  function renderBar() {
    $('edTitle').textContent = `Đợt thưởng SWAT tháng ${ml(cur.month)}${cur.title ? ' — ' + cur.title : ''}`;
    $('edStatus').innerHTML = STATUS_PILL(cur);
    $('edTotal').textContent = money(items().reduce((s, p) => s + (p.total || 0), 0));
    $('edSave').hidden = readOnly();
    $('roNote').hidden = !readOnly();
  }

  // ---------- lưu ----------
  function changed() {
    if (readOnly()) return;
    dirty = true; $('edSaved').textContent = '● chưa lưu';
    renderBar();
    clearTimeout(saveTimer); saveTimer = setTimeout(() => save().catch(() => {}), 1500);
  }
  async function save(status) {
    if (!cur) return;
    clearTimeout(saveTimer);
    if (saving) await saving.catch(() => {});
    items().forEach(recompute);
    const body = { version: cur.version, data: cur.data };
    if (status) body.status = status;
    $('edSaved').textContent = 'Đang lưu…';
    saving = api('PUT', '/api/incentive/batches/' + cur.id, body);
    try {
      const r = await saving;
      cur.version = r.version; cur.status = r.status; cur.total = r.total; dirty = false;
      $('edSaved').textContent = '✓ Đã lưu ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      renderBar();
      return r;
    } catch (e) { $('edSaved').textContent = '⚠ Chưa lưu được'; toast(e.message); throw e; }
    finally { saving = null; }
  }

  // ---------- các bước ----------
  function go(n) {
    if (n >= 2 && !items().length) { toast('Chọn ít nhất 1 dự án ở bước 1.'); n = 1; }
    step = n;
    document.querySelectorAll('#steps button').forEach(b => { const s = +b.dataset.step; b.classList.toggle('on', s === n); b.setAttribute('aria-current', s === n ? 'step' : 'false'); });
    $('st1').hidden = n !== 1; $('st23').hidden = !(n === 2 || n === 3); $('st4').hidden = n !== 4; $('st5').hidden = n !== 5;
    if (n === 1) renderProjects();
    if (n === 2 || n === 3) openReview(revIdx);
    if (n === 4) renderSplits(true);
    if (n === 5) renderSummary();
  }

  // ----- bước 1: chọn dự án -----
  function renderProjects() {
    const q = plain($('pFilter').value), showDone = $('pShowDone').checked, ro = readOnly();
    const chosen = new Map(items().map(p => [p.wbs, p]));
    const list = [...projects.values()].filter(p => SwatItem.isSwatProject(p) || chosen.has(String(p.wbs)));
    items().forEach(p => { if (!projects.has(p.wbs)) list.push({ wbs: p.wbs, projectName: p.name, supervisor: p.supervisor || '', productLine: p.product || '' }); });
    let shown = 0;
    const rows = list.map(p => {
      const wbs = String(p.wbs), sel = chosen.get(wbs), hist = histOf(wbs), st = Incentive.statusOf(hist), opts = Incentive.optionsFor(hist);
      if (!sel && !opts.length && !showDone) return '';
      if (q && !plain(`${p.projectName} ${wbs} ${p.supervisor}`).includes(q)) return '';
      shown++;
      const kinds = sel && !opts.includes(sel.kind) ? [sel.kind, ...opts] : opts;
      const months = st.code === 'first' ? Incentive.monthsBetween(st.since, cur.month) : 0;
      return `<tr class="${sel ? 'sel' : ''} ${!opts.length && !sel ? 'dim' : ''}" data-wbs="${esc(wbs)}">
        <td><input type="checkbox" data-pick ${sel ? 'checked' : ''} ${(!opts.length && !sel) || ro ? 'disabled' : ''} aria-label="Chọn ${esc(p.projectName)}"></td>
        <td data-label="Dự án"><b>${esc(p.projectName || '(không tên)')}</b>${p.targetSwat ? '' : ' <span class="pill bad" title="Chưa ghi Swat Hour Target ở Thống kê giờ công dự án">chưa có SWAT</span>'}</td>
        <td class="mono" data-label="WBS">${esc(wbs)}</td><td data-label="Giám sát">${esc(p.supervisor || '—')}</td><td data-label="Sản phẩm">${esc(p.productLine || '')}</td>
        <td data-label="Đã trả">${st.code === 'none' ? '<span class="ac-note">Chưa trả</span>' : `<span class="pill ${st.code === 'done' ? 'ok' : 'info'}">${esc(st.text)}</span>`}${months >= 6 ? ` <span class="pill wait">${months} tháng</span>` : ''}</td>
        <td data-label="Đợt này trả">${sel ? `<select data-kind ${ro ? 'disabled' : ''}>${kinds.map(k => `<option value="${k}" ${k === sel.kind ? 'selected' : ''}>${esc(KINDS[k].label)}</option>`).join('')}</select>`
          : (opts.length ? `<span class="ac-note">${opts.map(k => KINDS[k].short).join(' / ')}</span>` : '<span class="ac-note">—</span>')}</td></tr>`;
    }).join('');
    $('tProjects').tBodies[0].innerHTML = rows || '<tr><td colspan="7" class="ac-note">Không có dự án phù hợp.</td></tr>';
    $('pNote').textContent = `Đã chọn ${items().length} dự án · hiện ${shown}`;
  }
  function addProject(wbs) {
    const p = projects.get(wbs) || { wbs, projectName: wbs };
    const hist = histOf(wbs), opts = Incentive.optionsFor(hist), st = Incentive.statusOf(hist);
    let kind = opts[0];
    if (kind === 'final30' && st.since && Incentive.monthsBetween(st.since, cur.month) >= 6) kind = 'final20';
    const st0 = p.swatState && p.swatState.v ? p.swatState.v : {};
    const item = { wbs, name: p.projectName || '', projectNumber: p.projectNumber || '', product: p.productLine || '', supervisor: p.supervisor || '',
      units: Number(st0.units) || 1, stops: Number(st0.stops) || null, kind, swat: {}, fundF: 0, fundS: 0, sup: null, fitters: null, lines: [] };
    normalizeNew(item);
    cur.data.projects.push(item);
  }
  function normalizeNew(item) { item.fitters = item.fitters || []; recompute(item); }

  // ----- bước 2 + 3: duyệt Standard Hour / Scorecard -----
  let toolReady = null;
  function tool() {
    if (toolReady) return toolReady;
    toolReady = new Promise((resolve, reject) => {
      const f = $('tool');
      const done = () => { const w = f.contentWindow; if (w && w.SWAT) resolve(w.SWAT); else setTimeout(done, 100); };
      f.addEventListener('load', () => setTimeout(done, 50), { once: true });
      f.src = '../swat-hour/index.html';
      setTimeout(() => reject(new Error('Không mở được công cụ SWAT Hour')), 20000);
    });
    return toolReady;
  }
  async function hoursFor(list, force) {
    const need = list.filter(w => force || !hoursBy.has(w));
    for (let i = 0; i < need.length; i += 50) {
      const r = await api('GET', '/api/incentive/hours?wbs=' + encodeURIComponent(need.slice(i, i + 50).join(',')));
      (r.projects || []).forEach(x => hoursBy.set(x.wbs, x));
    }
  }
  async function loadIntoTool(p) {
    const S = await tool();
    await hoursFor([p.wbs]);
    const used = (hoursBy.get(p.wbs) || {}).total || 0;
    const proj = projects.get(p.wbs);
    const it = proj ? SwatItem.toToolItem(proj, used) : { label: `${p.name} (${p.wbs})`, pname: p.name, pref: p.wbs, product: 's3300', usedHours: used };
    it.saved = p.swat.state || (proj && proj.swatState) || null;
    S.loadProjects([it]);
    S.selectProject(p.wbs);
    // mục 6 "Dự kiến tiền thưởng theo người": danh sách người + giờ (không gồm 1194) từ /api/incentive/hours
    if (S.setPeople) S.setPeople(((hoursBy.get(p.wbs) || {}).people || []).map(x => ({ empId: x.empId, name: x.name, hours: x.hours, role: x.role })));
    return S;
  }
  // lọc danh sách dự án ở bước 2/3: gõ tên hoặc WBS (không phân biệt dấu / hoa thường), tuỳ chọn chỉ hiện dự án chưa duyệt bước này
  const fold = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  function revMatch(p) {
    const q = fold(($('revQ') || {}).value || '').trim();
    if ($('revTodo') && $('revTodo').checked && (step === 3 ? (p.swat || {}).scOk : (p.swat || {}).stdOk)) return false;
    if (!q) return true;
    const hay = fold((p.name || '') + ' ' + (p.wbs || ''));
    return q.split(/\s+/).every(w => hay.includes(w));
  }
  function renderRevList() {
    const all = items();
    const shown = all.map((p, i) => [p, i]).filter(([p]) => revMatch(p));
    if ($('revCount')) $('revCount').textContent = shown.length === all.length ? `${all.length} dự án` : `${shown.length} / ${all.length} dự án`;
    if (!shown.length) { $('revList').innerHTML = '<li class="in-empty">Không có dự án nào khớp bộ lọc.</li>'; return; }
    $('revList').innerHTML = shown.map(([p, i]) => {
      const s = p.swat || {};
      const chips = `${s.stdOk ? '✓ Std' : '○ Std'} · ${s.scOk ? '✓ Scorecard' : '○ Scorecard'}${s.changed ? ' · ⚠ đã sửa' : ''}`;
      return `<li><button type="button" data-rev="${i}" class="${i === revIdx ? 'on' : ''}">${esc(p.name || p.wbs)}<small>${esc(p.wbs)} · ${KINDS[p.kind].short} · ${chips}</small></button></li>`;
    }).join('');
  }
  async function openReview(i) {
    revIdx = Math.max(0, Math.min(i, items().length - 1));
    const sc = step === 3;
    $('h23').textContent = sc ? '3. Duyệt Scorecard' : '2. Duyệt Standard Hour';
    $('help23').innerHTML = sc
      ? 'Kiểm tra mục <b>5 — SWAT Scorecard</b>: giờ đã dùng (từ Theo dõi giờ công) + giờ dự phòng, các tiêu chí chấm điểm, Quality Boost. Bấm <b>Duyệt</b>: quỹ thưởng Fitter / Site-sup của dự án lấy theo Scorecard (× số unit).'
      : 'Kiểm tra mục <b>1–4</b> của bảng SWAT (thông số thang, hạng mục cộng thêm, giờ tiêu chuẩn). Sửa nếu cần rồi bấm <b>Duyệt</b> — thông số được <b>lưu vào dự án</b> để lần sau mở lại đúng như vậy.';
    $('revApprove').textContent = sc ? '✓ Duyệt Scorecard' : '✓ Duyệt Standard Hour';
    $('revApprove').hidden = readOnly();
    renderRevList();
    $('revMsg').textContent = 'Đang nạp dự án vào công cụ SWAT…';
    try {
      await loadIntoTool(items()[revIdx]);
      $('revMsg').textContent = '';
      scrollTool(sc);
      renderRevSum();
    } catch (e) { $('revMsg').textContent = '✗ ' + e.message; }
  }
  function scrollTool(sc) {
    try {
      const w = $('tool').contentWindow, d = w.document;
      const el = sc ? d.getElementById('scScheme') : d.getElementById('pname');
      const card = el && el.closest('.card');
      w.scrollTo(0, card ? Math.max(0, card.getBoundingClientRect().top + w.scrollY - 8) : 0);
    } catch (e) { /* bỏ qua */ }
  }
  function toolNow() {
    const w = $('tool').contentWindow;
    if (!w || !w.SWAT) return null;
    return { state: w.SWAT.getState(), res: w.SWAT.getResult(), sd: w.SWAT.scoreData() };
  }
  function renderRevSum() {
    const p = items()[revIdx], t = toolNow();
    if (!p || !t) return;
    const h = t.res.hours, sd = t.sd || {}, units = Number(sd.units) || 1;
    const box = (l, v) => `<div><span>${l}</span><b>${v}</b></div>`;
    $('revSum').innerHTML = (step === 2
      ? [box('Giờ tiêu chuẩn / unit', fmt1(h.standard_per_unit)), box('Số unit', units), box('Giờ tiêu chuẩn toàn dự án', fmt1(h.standard_whole_project)), box('Giờ đã dùng (bảng công)', fmt1(h.used)), box('Còn lại', fmt1(h.remaining))]
      : [box('Giờ thực tế (dùng + dự phòng)', fmt1(sd.act)), box('Tiết kiệm (− là vượt)', fmt1(-(sd.save || 0))), box('Fitter score', `${sd.fs || 0} / 3`), box('Site-sup score', `${sd.ss || 0} / 6`),
        box('Thưởng Fitter (× unit)', money((sd.pf || 0) * units)), box('Thưởng Site-sup (× unit)', money((sd.ps || 0) * units))]).join('')
      + box('Trạng thái', `${p.swat.stdOk ? '✓ Std đã duyệt' : '○ Std chưa duyệt'} · ${p.swat.scOk ? '✓ Scorecard đã duyệt' : '○ Scorecard chưa duyệt'}`);
  }
  async function approve() {
    if (readOnly()) return;
    const p = items()[revIdx], t = toolNow();
    if (!p || !t) return;
    const sd = t.sd || {}, units = Number(sd.units) || 1;
    p.swat.state = t.state; p.swat.changed = false;
    p.units = units; p.stops = sd.stops || p.stops; p.swat.year = sd.year;
    p.swat.std = { perUnit: t.res.hours.standard_per_unit, whole: t.res.hours.standard_whole_project, used: t.res.hours.used, units };
    if (step === 2) { p.swat.stdOk = true; p.swat.stdAt = new Date().toISOString(); }
    else {
      p.swat.scOk = true; p.swat.scAt = new Date().toISOString();
      p.swat.sc = { act: sd.act, std: sd.std, reserve: sd.reserve, save: sd.save, block: sd.block, fs: sd.fs, ss: sd.ss, bf: sd.bf, bs: sd.bs, pf: sd.pf, ps: sd.ps, crit: sd.crit };
      if (!p.fundManual) { p.fundF = Math.round((sd.pf || 0) * units); p.fundS = Math.round((sd.ps || 0) * units); }
      if (!p.swat.stdOk) { p.swat.stdOk = true; p.swat.stdAt = p.swat.scAt; }
    }
    recompute(p);
    $('revMsg').textContent = 'Đang lưu thông số vào dự án…';
    try {
      // lưu trạng thái SWAT vào dự án (như "Ghi Swat Target" ở Thống kê giờ công dự án) để lần sau dùng lại
      await api('PATCH', '/api/admin/projects/' + encodeURIComponent(p.wbs), { fields: { swatState: t.state, swatTargetHour: Math.round((t.res.hours.standard_whole_project || 0) * 10) / 10, targetSwat: true } });
      const proj = projects.get(p.wbs); if (proj) { proj.swatState = t.state; proj.targetSwat = true; proj.swatTargetHour = t.res.hours.standard_whole_project; }
      try { const S = await tool(); if (S.setTarget) S.setTarget(t.res.hours.standard_whole_project, (t.state.v || {}).shape); } catch (e) { /* bỏ qua: chỉ để tắt cảnh báo lệch Swat Target */ }
      $('revMsg').textContent = step === 2 ? '✓ Đã duyệt Standard Hour và lưu vào dự án.' : `✓ Đã duyệt Scorecard — quỹ Fitter ${money(p.fundF)} đ, Site-sup ${money(p.fundS)} đ.`;
    } catch (e) { $('revMsg').textContent = '⚠ Đã duyệt trong đợt nhưng chưa lưu được vào dự án: ' + e.message; }
    changed(); renderRevList(); renderRevSum();
  }

  // ----- bước 4: chia thưởng -----
  async function renderSplits(fetchHours) {
    const list = items();
    if (fetchHours) {
      $('splits').innerHTML = '<p class="ac-note">Đang lấy giờ công từ bảng Theo dõi giờ công…</p>';
      try { await hoursFor(list.map(p => p.wbs)); } catch (e) { toast(e.message); }
      list.forEach(p => { if (!p.fitters || (!p.fitters.length && !p.imported)) initPeople(p); recompute(p); });
    }
    $('splits').innerHTML = list.map((p, i) => splitCard(p, i)).join('') || '<p class="ac-note">Chưa chọn dự án.</p>';
    renderBar();
  }
  function initPeople(p) {
    const h = hoursBy.get(p.wbs) || { people: [] };
    p.fitters = h.people.filter(x => x.role === 'fitter').map(x => ({ empId: x.empId, name: x.name, hours: x.hours }));
    if (!p.sup) {
      const proj = projects.get(p.wbs) || {};
      const byName = proj.supervisor ? empOf(proj.supervisor) : null;
      const st = proj.staff && proj.staff.sitesup && proj.staff.sitesup[0] ? empById.get(String(proj.staff.sitesup[0])) : null;
      const e = byName || st || null;
      p.sup = e ? { empId: e.empId, name: e.name } : (proj.supervisor ? { empId: '', name: proj.supervisor } : null);
    }
  }
  function splitCard(p, i) {
    const ro = readOnly(), k = KINDS[p.kind] || KINDS.first70, final = k.stage === 'final';
    const hist = histOf(p.wbs), opts = Incentive.optionsFor(hist), kinds = opts.includes(p.kind) ? opts : [p.kind, ...opts];
    const dis = ro ? 'disabled' : '';
    const sc = p.swat && p.swat.sc;
    const warn = [];
    if (!p.swat.scOk && !p.imported) warn.push('Scorecard chưa duyệt (bước 3) — quỹ thưởng đang là số nhập tay.');
    if (!(Number(p.fundF) || Number(p.fundS))) warn.push('Quỹ thưởng = 0 (Scorecard không đạt điểm, hoặc chưa duyệt).');
    if (!(p.fitters || []).length) warn.push('Chưa có fitter — không có giờ công của dự án trong Theo dõi giờ công. Thêm tay bên dưới.');
    const hb = hoursBy.get(p.wbs);
    if (hb && hb.excluded1194 > 0 && !p.imported) warn.push(`Đã <b>không tính ${fmt1(hb.excluded1194)} giờ</b> mã <b>1194</b> (NI Quality Hour — lỗi chất lượng, không phải lỗi lắp đặt) khi chia % giờ công và giờ thực tế SWAT.`);
    const rule = p.supRule || {};
    if (rule.need && !p.imported) warn.push(`Đợt cuối 30%: nhập <b>Ngày bàn giao khách hàng</b> và <b>Ngày final bàn giao</b> để kiểm tra điều kiện Site-sup (final quá ${Incentive.FINAL_LATE_DAYS} ngày → Site-sup = 0).`);
    if (rule.zero && !p.imported) {
      const supL = (p.lines || []).find(l => l.role === 'sup');
      warn.push(esc(rule.reason) + (supL && supL.manual && supL.amount ? ' <b>— Site-sup đang có số nhập tay, kiểm tra lại.</b>' : '.'));
    }
    if (final) {
      const have = new Set(p.lines.map(l => plain(l.name)));
      const miss = [...new Map(hist.flatMap(h => h.lines).filter(l => !have.has(plain(l.name))).map(l => [plain(l.name), l])).values()];
      if (miss.length) warn.push(`Đã nhận đợt trước nhưng không có trong bảng chia đợt này: ${miss.map(l => `${esc(l.name)} (${money(l.amount)} đ)`).join(', ')}.`);
    }
    const lineRow = (l, j) => {
      const role = l.role === 'sup' ? 'Site-sup' : 'Fitter';
      const nameIn = `<input type="text" list="dlEmp" value="${esc(l.name)}" data-f="name" data-j="${j}" ${dis} aria-label="Tên ${role}">`;
      return `<tr data-j="${j}"><td data-label="Vai trò">${role}</td><td data-label="Họ tên">${nameIn}</td><td class="mono" data-label="Mã NV">${esc(l.empId || '—')}</td>
        <td class="r" data-label="Giờ công">${l.role === 'fitter' ? `<input class="num" type="number" step="0.1" min="0" value="${l.hours != null ? l.hours : ''}" data-f="hours" data-j="${j}" ${dis} aria-label="Giờ công">` : ''}</td>
        <td class="r" data-label="% giờ công">${l.role === 'fitter' ? pct(l.pct) : ''}</td>
        ${final ? `<td class="r" data-label="Tổng final">${money(l.total)}</td><td class="r" data-label="Đã nhận">${money(l.before)}</td>` : ''}
        <td class="r" data-label="Kỳ này"><input class="num ${l.manual ? 'manual' : ''}" type="number" step="1" value="${l.manual ? Math.round(l.amount) : ''}" placeholder="${money(l.auto)}" data-f="amount" data-j="${j}" ${dis} aria-label="Số tiền kỳ này" title="${l.manual ? 'Đã sửa tay — tính theo công thức: ' + money(l.auto) : 'Tính theo công thức'}"></td>
        <td>${ro ? '' : `<button class="in-x" type="button" data-del="${j}" aria-label="Bỏ dòng">✕</button>`}</td></tr>`;
    };
    // j: 's' = site-sup, số = chỉ số fitter
    const supLine = p.lines.find(l => l.role === 'sup');
    const fitLines = p.lines.filter(l => l.role === 'fitter');
    return `<div class="in-split" data-i="${i}">
      <h3>${esc(p.name || p.wbs)} <span class="mono ac-note">${esc(p.wbs)}</span> <span class="pill info">${esc(k.short)}</span>${p.imported ? ' <span class="pill">từ Excel</span>' : ''}</h3>
      ${ro ? '' : `<div class="in-funds"><label>Mã WBS <input type="text" value="${esc(p.wbs)}" data-f="wbs" list="dlProjWbs" autocomplete="off" aria-label="Mã WBS"></label>
        <label class="in-grow">Tên dự án <input type="text" value="${esc(p.name || '')}" data-f="pname" maxlength="300" aria-label="Tên dự án"></label>
        <span class="ac-note">Sửa khi mã / tên bị nhầm (vd. từ file Excel cũ). WBS đúng ở nhiều đợt → dùng <b>✎ Đổi mã WBS</b> ở danh sách đợt.</span></div>`}
      ${warn.map(w => `<div class="in-warn">⚠ ${w}</div>`).join('')}
      <div class="in-funds">
        <label>Đợt này trả <select data-f="kind" ${dis}>${kinds.map(x => `<option value="${x}" ${x === p.kind ? 'selected' : ''}>${esc(KINDS[x].label)}</option>`).join('')}</select></label>
        <label>Quỹ Fitter (đ) <input class="num" type="number" step="1" min="0" value="${Math.round(Number(p.fundF) || 0)}" data-f="fundF" ${dis}></label>
        <label>Quỹ Site-sup (đ) <input class="num" type="number" step="1" min="0" value="${Math.round(Number(p.fundS) || 0)}" data-f="fundS" ${dis}></label>
        ${sc ? `<span class="ac-note">Theo Scorecard: Fitter ${money(sc.pf * (p.units || 1))} · Site-sup ${money(sc.ps * (p.units || 1))}${p.fundManual && !ro ? ` <button class="btn small" type="button" data-f="resetFund">↺ Lấy theo Scorecard</button>` : ''}</span>` : ''}
        <span class="ac-note">Tỉ lệ ${final ? 'final' : 'trả'}: <b>${Math.round(k.rate * 100)}%</b></span>
      </div>
      ${p.kind === 'final30' ? `<div class="in-funds">
        <label>Ngày bàn giao khách hàng <input type="date" value="${esc(p.handoverDate || '')}" data-f="handoverDate" ${dis}></label>
        <label>Ngày final bàn giao <input type="date" value="${esc(p.finalDate || '')}" data-f="finalDate" ${dis}></label>
        <span class="ac-note">${rule.days != null ? `Final sau <b>${rule.days}</b> ngày — ${rule.zero ? '<b style="color:var(--red)">quá ' + Incentive.FINAL_LATE_DAYS + ' ngày: Site-sup = 0</b>' : 'trong ' + Incentive.FINAL_LATE_DAYS + ' ngày: Site-sup nhận đủ'}` : `Quá ${Incentive.FINAL_LATE_DAYS} ngày kể từ ngày bàn giao khách hàng → Site-sup = 0`}</span>
      </div>` : ''}
      <div class="ac-scroll"><table class="ac-table ni-cards">
        <thead><tr><th>Vai trò</th><th>Họ tên</th><th>Mã NV</th><th class="r">Giờ công</th><th class="r">%</th>${final ? '<th class="r">Tổng final</th><th class="r">Đã nhận</th>' : ''}<th class="r">Kỳ này (đ)</th><th></th></tr></thead>
        <tbody>${supLine ? lineRow(supLine, 's') : (ro ? '' : `<tr><td>Site-sup</td><td colspan="${final ? 7 : 5}"><button class="btn small" type="button" data-f="addSup">+ Thêm Site-sup</button></td></tr>`)}
          ${fitLines.map((l, j) => lineRow(l, j)).join('')}</tbody>
        <tfoot><tr><td colspan="${final ? 7 : 5}">${ro ? '' : '<button class="btn small" type="button" data-f="addFit">+ Thêm fitter</button>'} <span class="ac-note">Tổng giờ fitter ${fmt1(fitLines.reduce((s, l) => s + (l.hours || 0), 0))}</span></td>
          <td class="r">${money(p.total)}</td><td></td></tr></tfoot>
      </table></div></div>`;
  }
  function onSplitChange(ev) {
    const card = ev.target.closest('.in-split'); if (!card || !card.isConnected || readOnly() || onSplitChange.busy) return;   // busy: vẽ lại thẻ làm ô đang gõ mất focus → trình duyệt bắn thêm 'change'
    const p = items()[+card.dataset.i], f = ev.target.dataset.f, j = ev.target.dataset.j;
    if (!p || !f) return;
    const v = ev.target.value;
    if (f === 'wbs') {
      const w = v.trim();
      if (!w) return toast('Mã WBS không được để trống');
      if (items().some((x, i) => i !== +card.dataset.i && String(x.wbs) === w)) { ev.target.value = p.wbs; return toast(`Đợt này đã có dự án ${w}`); }
      p.wbs = w;
      const pr = projects.get(w); if (pr && (pr.projectName || pr.name)) p.name = pr.projectName || pr.name;
    }
    else if (f === 'pname') p.name = v.trim();
    else if (f === 'handoverDate' || f === 'finalDate') p[f] = v;
    else if (f === 'kind') p.kind = v;
    else if (f === 'fundF' || f === 'fundS') { p[f] = Math.max(0, Number(v) || 0); p.fundManual = true; }
    else if (j != null) {
      const x = j === 's' ? p.sup : p.fitters[+j];
      if (!x) return;
      if (f === 'name') { x.name = v.trim(); const e = empOf(x.name); x.empId = e ? e.empId : ''; }
      if (f === 'hours') x.hours = Math.max(0, Number(v) || 0);
      if (f === 'amount') x.amount = v === '' ? undefined : Number(v);
    }
    recompute(p);
    onSplitChange.busy = true;
    try { card.outerHTML = splitCard(p, +card.dataset.i); } finally { onSplitChange.busy = false; }
    changed();
  }
  function onSplitClick(ev) {
    const b = ev.target.closest('button'); if (!b || readOnly()) return;
    const card = b.closest('.in-split'); if (!card) return;
    const p = items()[+card.dataset.i];
    if (b.dataset.del != null) { if (b.dataset.del === 's') p.sup = null; else p.fitters.splice(+b.dataset.del, 1); }
    else if (b.dataset.f === 'addFit') p.fitters.push({ empId: '', name: '', hours: 0 });
    else if (b.dataset.f === 'addSup') p.sup = { empId: '', name: '' };
    else if (b.dataset.f === 'resetFund') { const sc = p.swat.sc; p.fundManual = false; p.fundF = Math.round(sc.pf * (p.units || 1)); p.fundS = Math.round(sc.ps * (p.units || 1)); }
    else return;
    recompute(p);
    card.outerHTML = splitCard(p, +card.dataset.i);
    changed();
  }

  // ----- bước 5: tổng hợp -----
  function renderSummary() {
    const list = items(); list.forEach(recompute);
    const tot = list.reduce((s, p) => s + p.total, 0), tf = list.reduce((s, p) => s + p.fitterTotal, 0), ts = list.reduce((s, p) => s + p.supTotal, 0);
    const people = Incentive.byPerson(list);
    const box = (l, v) => `<div><span>${l}</span><b>${v}</b></div>`;
    $('kpis').innerHTML = box('Tổng chi đợt này', money(tot) + ' đ') + box('Fitter', money(tf) + ' đ') + box('Site-sup', money(ts) + ' đ') + box('Dự án', list.length)
      + box('Người nhận', `${people.filter(x => x.role === 'fitter').length} fitter · ${people.filter(x => x.role === 'sup').length} site-sup`);
    $('tSumProj').tBodies[0].innerHTML = list.map(p => `<tr><td data-label="Dự án"><b>${esc(p.name)}</b> <span class="mono ac-note">${esc(p.wbs)}</span></td>
      <td data-label="Đợt này">${esc(KINDS[p.kind].short)}</td><td class="r" data-label="Quỹ Fitter">${money(p.fundF)}</td><td class="r" data-label="Quỹ Site-sup">${money(p.fundS)}</td>
      <td class="r" data-label="Fitter nhận">${money(p.fitterTotal)}</td><td class="r" data-label="Site-sup nhận">${money(p.supTotal)}</td><td class="r" data-label="Tổng"><b>${money(p.total)}</b></td>
      <td data-label="Duyệt">${p.imported ? '<span class="pill">từ Excel</span>' : `${p.swat.stdOk ? '<span class="pill ok">Std</span>' : '<span class="pill wait">Std</span>'} ${p.swat.scOk ? '<span class="pill ok">Scorecard</span>' : '<span class="pill wait">Scorecard</span>'}`}</td></tr>`).join('')
      || '<tr><td colspan="8" class="ac-note">Chưa có dự án.</td></tr>';
    const pr = (role) => people.filter(x => x.role === role).map(x => `<tr><td data-label="Họ tên">${esc(x.name)}</td><td class="mono" data-label="Mã NV">${esc(x.empId || (empOf(x.name) || {}).empId || '—')}</td><td class="r" data-label="Dự án">${x.projects}</td><td class="r" data-label="Tiền thưởng"><b>${money(x.amount)}</b></td></tr>`).join('')
      || '<tr><td colspan="4" class="ac-note">—</td></tr>';
    $('tSumSup').tBodies[0].innerHTML = pr('sup');
    $('tSumFit').tBodies[0].innerHTML = pr('fitter');
    renderAnalysis();
    const sg = cur.data.signers || {};
    document.querySelectorAll('[data-sg]').forEach(i => { i.value = sg[i.dataset.sg] || ''; i.disabled = readOnly(); });
    const ro = readOnly();
    $('edDone').hidden = ro; $('edReopen').hidden = !ro; $('edDelete').hidden = ro;
    $('pubBox').hidden = !ro;
    $('pubGo').textContent = cur.publishedAt ? '✉ Gửi lại email' : '📣 Phát hành';
    if (cur.publishedAt) $('pubNote').innerHTML = `Đã phát hành lúc <b>${esc(fmtTime(cur.publishedAt))}</b>${cur.publishedBy ? ' · ' + esc(cur.publishedBy) : ''} — người được chia thưởng xem được trong trang <b>Thưởng của tôi</b>. Sửa đợt (Mở lại) thì người dùng tạm không thấy cho tới khi chốt lại.`;
    const noId = people.filter(x => !x.empId && x.amount).map(x => x.name);
    if (noId.length && !cur.publishedAt) $('pubNote').innerHTML += ` <span style="color:var(--red)">Thiếu Mã NV (không nhận được email / không xem được): ${noId.map(esc).join(', ')} — sửa ở bước 4.</span>`;
    const notOk = list.filter(p => !p.imported && !(p.swat.stdOk && p.swat.scOk));
    $('doneNote').textContent = ro ? 'Đợt đã chốt — được tính vào lịch sử "đã trả" của các dự án.' : (notOk.length ? `Còn ${notOk.length} dự án chưa duyệt đủ Standard Hour + Scorecard.` : 'Kiểm tra xong → Chốt đợt: dự án được ghi nhận đã trả đợt này.');
  }

  // ----- SWAT Analysis (bước 5): Admin nhập YANSPN cost (cột J), phần còn lại lấy từ dự án / Scorecard -----
  const anCfg = () => SwatAnalysis.cfgOf(cur.data.analysisCfg);
  function anCtx() {
    return {
      project: (w) => { const pr = projects.get(w); if (!pr) return {}; const t = SwatItem.toToolItem(pr, 0); return { projectNumber: pr.projectNumber, productLine: pr.productLine, projectName: pr.projectName, stops: t.stops }; },
      pmName: (w) => { const pr = projects.get(w); const ids = (pr && pr.staff && pr.staff.pm) || []; return ids.map(id => (empById.get(String(id)) || {}).name || id).join(', '); },
      paidBefore: (w) => histOf(w).reduce((s, h) => s + (h.lines || []).reduce((a, l) => a + (Number(l.amount) || 0), 0), 0),
    };
  }
  const anRows = () => SwatAnalysis.rows({ projects: items() }, anCtx());
  function renderAnalysis() {
    const c = anCfg();
    $('anBranch').value = c.branch; $('anOffset').value = money(c.offset); $('anAdjust').value = c.adjust; $('anRate').value = money(c.rate2025);
    const m = (v) => (v == null ? '—' : `<span class="${v < 0 ? 'neg' : ''}">${money(Math.round(v))}</span>`);
    const pc = (v) => (v == null ? '—' : Math.round(v * 100) + '%');
    $('tAna').tBodies[0].innerHTML = anRows().map((r, i) => { const x = SwatAnalysis.calc(r, c); return `<tr data-i="${i}">
      <td><b>${esc(r.name)}</b> <span class="mono ac-note">${esc(r.wbs)}</span></td><td>${esc(r.pm || '—')}</td><td>${esc(r.product || '—')}</td><td class="r">${r.units}</td><td class="r">${r.stops == null ? '—' : r.stops}</td>
      <td class="r"><input data-an="yanspn" inputmode="numeric" value="${r.yanspn == null ? '' : money(r.yanspn)}" placeholder="nhập" aria-label="YANSPN cost ${esc(r.wbs)}"></td>
      <td class="r">${m(x.K)}</td><td class="r">${m(x.M)}</td><td class="r">${m(x.N)}</td><td class="r">${m(x.V)}</td><td class="r"><b>${m(x.W)}</b></td><td class="r">${pc(x.Y)}</td><td class="r">${m(x.AC)}</td>
      <td class="r">${r.paidBefore ? m(r.paidBefore) : '—'}</td><td class="r">${m(r.paidNow)}</td><td class="r">${r.fitterHours == null ? '—' : fmt1(r.fitterHours)}</td></tr>`; }).join('')
      || '<tr><td colspan="16" class="ac-note">Chưa có dự án.</td></tr>';
  }
  const parseNum = (s) => { const t = String(s || '').replace(/[^\d,.-]/g, ''); if (!t) return null; const n = Number(/,\d{1,2}$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(/[.,]/g, '')); return isFinite(n) ? n : null; };
  let anTimer = null;
  function saveAnalysis() {
    // đợt đã chốt vẫn lưu được (chỉ dữ liệu phân tích, không đổi tiền) → gửi thẳng, giữ nguyên trạng thái
    if (!readOnly()) { changed(); return; }
    clearTimeout(anTimer);
    anTimer = setTimeout(async () => {
      $('anMsg').textContent = 'Đang lưu…';
      try { const r = await api('PUT', '/api/incentive/batches/' + cur.id, { version: cur.version, data: cur.data }); cur.version = r.version; $('anMsg').textContent = '✓ Đã lưu'; }
      catch (e) { $('anMsg').textContent = '✗ ' + e.message; }
    }, 800);
  }
  function onAnalysisInput(ev) {
    const t = ev.target;
    if (t.dataset.an === 'yanspn') {
      const p = items()[+t.closest('tr').dataset.i]; if (!p) return;
      p.analysis = { ...(p.analysis || {}), yanspn: parseNum(t.value) };
    } else if (t.id && t.id.startsWith('an')) {
      const c = { ...(cur.data.analysisCfg || {}) };
      if (t.id === 'anBranch') c.branch = t.value.trim() || SwatAnalysis.DEFAULTS.branch;
      if (t.id === 'anOffset') c.offset = parseNum(t.value) || SwatAnalysis.DEFAULTS.offset;
      if (t.id === 'anAdjust') { const v = Number(String(t.value).replace(',', '.')); c.adjust = v > 0 ? v : SwatAnalysis.DEFAULTS.adjust; }
      if (t.id === 'anRate') c.rate2025 = parseNum(t.value) || SwatAnalysis.DEFAULTS.rate2025;
      cur.data.analysisCfg = c;
    } else return;
    renderAnalysis(); saveAnalysis();
  }
  async function exportAnalysis() {
    $('xMsg').textContent = 'Đang tạo SWAT Analysis…';
    try {
      await waitFor(() => window.ExcelJS);
      items().forEach(recompute);
      const list = anRows();
      const wb = SwatAnalysis.build(window.ExcelJS, { month: cur.month }, list, anCfg());
      const buf = await wb.xlsx.writeBuffer();
      download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), SwatAnalysis.fileName(cur.month));
      const miss = list.filter(r => r.yanspn == null).length;
      $('xMsg').textContent = '✓ Đã tải SWAT Analysis.' + (miss ? ` Còn ${miss} dự án chưa nhập YANSPN cost (cột J tô cam).` : '');
    } catch (e) { $('xMsg').textContent = '✗ ' + e.message; }
  }

  // ---------- xuất file ----------
  function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 200); }
  const waitFor = (test, ms = 15000) => new Promise((res, rej) => { const t0 = Date.now(); (function poll() { if (test()) res(); else if (Date.now() - t0 > ms) rej(new Error('Chưa tải được thư viện Excel — kiểm tra mạng rồi thử lại.')); else setTimeout(poll, 100); })(); });
  async function exportList() {
    $('xMsg').textContent = 'Đang tạo file…';
    try {
      await waitFor(() => window.ExcelJS);
      items().forEach(recompute);
      const wb = IncExcel.build(window.ExcelJS, { month: cur.month, projects: items(), signers: cur.data.signers || {} });
      const buf = await wb.xlsx.writeBuffer();
      download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), IncExcel.fileName(cur));
      $('xMsg').textContent = '✓ Đã tải file List Fitter and Supervisor.';
    } catch (e) { $('xMsg').textContent = '✗ ' + e.message; }
  }
  async function exportOverview() {
    $('xMsg').textContent = 'Đang tạo báo cáo tổng quan…';
    try {
      await waitFor(() => window.ExcelJS);
      items().forEach(recompute);
      const wb = IncExcel.buildOverview(window.ExcelJS, { month: cur.month, title: cur.title, status: cur.status, publishedAt: cur.publishedAt, projects: items(), signers: cur.data.signers || {} });
      const buf = await wb.xlsx.writeBuffer();
      download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), IncExcel.overviewName(cur));
      $('xMsg').textContent = '✓ Đã tải báo cáo tổng quan chi thưởng.';
    } catch (e) { $('xMsg').textContent = '✗ ' + e.message; }
  }
  let sheetJs = null;
  const loadSheetJs = () => sheetJs || (sheetJs = new Promise((res, rej) => { if (window.XLSX) return res(window.XLSX); const s = document.createElement('script'); s.src = '../../js/xlsx.full.min.js?v=36'; s.onload = () => res(window.XLSX); s.onerror = () => rej(new Error('Không tải được thư viện Excel')); document.head.appendChild(s); }));
  // Standard Hour / Scorecard: mỗi dự án 1 sheet, ĐÚNG FORM của công cụ SWAT (màu, viền, ô gộp, độ rộng cột — cùng bộ chuyển js/htmlxlsx.js)
  async function exportSwat(kind) {
    const list = items(); if (!list.length) return;
    $('xMsg').textContent = `Đang dựng ${kind === 'std' ? 'Standard Hour' : 'Scorecard'} cho ${list.length} dự án…`;
    try {
      await waitFor(() => window.ExcelJS);
      const wb = new ExcelJS.Workbook(), used = new Set();
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        const S = await loadIntoTool(p);
        const t = S.exportTables();
        const html = kind === 'std' ? t.hours : t.scorecard;
        if (!html) continue;
        HtmlXlsx.addSheetHtml(wb, html, HtmlXlsx.sheetName(`${i + 1}. ${p.name || p.wbs}`, used),
          kind === 'std' ? { widths: HtmlXlsx.HOURS_WIDTHS, landscape: true, size: 9 } : { size: 11 });
      }
      if (!wb.worksheets.length) throw new Error('Chưa có dữ liệu SWAT để xuất');
      const buf = await wb.xlsx.writeBuffer();
      download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${kind === 'std' ? 'Standard Hour SWAT' : 'Scorecard SWAT'} - ${ml(cur.month).replace('/', '-')}.xlsx`);
      $('xMsg').textContent = `✓ Đã xuất ${wb.worksheets.length} sheet.`;
      if (step === 2 || step === 3) openReview(revIdx);
    } catch (e) { $('xMsg').textContent = '✗ ' + e.message; }
  }

  // ---------- tải Excel lên (ghi đè) ----------
  let parsed = [];
  async function onImportFile(file) {
    $('impMsg').className = 'ac-note'; $('impMsg').textContent = 'Đang đọc file…'; $('impPreview').hidden = true;
    try {
      await waitFor(() => window.ExcelJS);
      const wb = new window.ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      parsed = Incentive.parseWorkbook(Incentive.bookFromExcelJS(wb));
      // điền Mã NV còn thiếu theo tên trong danh sách nhân viên
      parsed.forEach(s => s.projects.forEach(p => p.lines.forEach(l => { if (!l.empId) { const e = empOf(l.name); if (e) l.empId = e.empId; } })));
      if (!parsed.length) throw new Error('Không tìm thấy sheet nào đúng mẫu List Fitter and Supervisor for Incentive');
      const have = new Map(batches.map(b => [b.month, b]));
      $('tImport').tBodies[0].innerHTML = parsed.map((s, i) => {
        const ex = have.get(s.month);
        const ok = !s.hidden && s.matches !== false;
        return `<tr><td><input type="checkbox" data-imp="${i}" ${ok ? 'checked' : ''} aria-label="Nhập sheet ${esc(s.sheet)}"></td>
          <td data-label="Sheet"><b>${esc(s.sheet)}</b>${s.hidden ? ' <span class="pill">ẩn</span>' : ''}</td><td data-label="Tháng">${ml(s.month)}</td><td class="r" data-label="Dự án">${s.projects.length}</td>
          <td class="r" data-label="Tổng">${money(s.total)}</td>
          <td data-label="Đối chiếu">${s.matches === true ? '<span class="pill ok">khớp ô tổng</span>' : s.matches === false ? `<span class="pill bad" title="${esc(s.warnings[0] || '')}">lệch ${money((s.fileTotal || 0) - s.total)}</span>` : '<span class="ac-note">không có ô tổng</span>'}</td>
          <td data-label="Trong hệ thống">${ex ? `<span class="pill wait">ghi đè đợt ${ex.status === 'done' ? 'đã chốt' : 'đang làm'} (${money(ex.total)} đ)</span>` : '<span class="ac-note">tạo mới</span>'}</td></tr>`;
      }).join('');
      $('impAll').checked = false;
      $('impPreview').hidden = false;
      const warn = parsed.reduce((n, s) => n + s.warnings.length, 0);
      $('impMsg').textContent = `Đọc được ${parsed.length} sheet. Sheet ẩn và sheet lệch ô tổng không được chọn sẵn.${warn ? ` (${warn} ghi chú khi đọc)` : ''}`;
      impCount();
    } catch (e) { $('impMsg').className = 'ac-note err'; $('impMsg').textContent = '✗ ' + e.message; }
  }
  const pickedImp = () => [...document.querySelectorAll('[data-imp]:checked')].map(c => parsed[+c.dataset.imp]);
  function impCount() { const n = pickedImp().length; $('impGo').disabled = !n; $('impNote').textContent = n ? `${n} đợt được chọn` : ''; }
  async function doImport() {
    const list = pickedImp(); if (!list.length) return;
    const over = list.filter(s => batches.some(b => b.month === s.month));
    if (!confirm(`Nhập ${list.length} đợt từ file?${over.length ? `\n\n${over.length} đợt đã có sẽ bị GHI ĐÈ phần chia tiền: ${over.map(s => ml(s.month)).join(', ')}.` : ''}`)) return;
    $('impGo').disabled = true; $('impNote').textContent = 'Đang nhập…';
    try {
      const sheets = list.map(s => ({ sheet: s.sheet, month: s.month, title: s.title, projects: s.projects.map(p => ({ ...p, lines: p.lines.map(({ row, ...l }) => l) })) }));
      const r = await api('POST', '/api/incentive/import', { scheme: SCHEME, sheets });
      toast(`✓ Đã nhập ${r.batches.length} đợt (${r.batches.filter(b => b.replaced).length} đợt ghi đè).`);
      $('secImport').hidden = true;
      await loadRefs(); await loadList();
    } catch (e) { $('impNote').textContent = '✗ ' + e.message; }
    finally { $('impGo').disabled = false; }
  }

  // ---------- gắn sự kiện ----------
  function wire() {
    let rnPlan = null;
    const rnReset = () => { rnPlan = null; $('rnGo').disabled = true; };
    $('btnRename').onclick = () => { const f = $('renameForm'); f.hidden = !f.hidden; $('btnRename').setAttribute('aria-expanded', String(!f.hidden)); if (!f.hidden) $('rnFrom').focus(); };
    $('rnCancel').onclick = () => { $('renameForm').hidden = true; $('btnRename').setAttribute('aria-expanded', 'false'); rnReset(); $('rnMsg').textContent = ''; };
    ['rnFrom', 'rnTo', 'rnName'].forEach(id => $(id).addEventListener('input', rnReset));
    $('rnTo').addEventListener('change', () => { const pr = projects.get($('rnTo').value.trim()); if (pr && !$('rnName').value.trim()) $('rnName').value = pr.projectName || pr.name || ''; });
    const rnBody = (dryRun) => ({ scheme: SCHEME, from: $('rnFrom').value.trim(), to: $('rnTo').value.trim(), name: $('rnName').value.trim(), dryRun });
    $('rnPreview').onclick = async () => {
      const msg = $('rnMsg'); msg.className = 'ac-note'; msg.textContent = 'Đang kiểm tra…';
      try {
        const r = await api('POST', '/api/incentive/rename-wbs', rnBody(true));
        rnPlan = r;
        msg.innerHTML = (r.batches.length ? `Sẽ đổi <b>${esc(r.from)}</b> → <b>${esc(r.to)}</b> ở ${r.batches.length} đợt: ` + r.batches.map(b => `${ml(b.month)} (${b.lines} người${b.name ? ', ' + esc(b.name) : ''})`).join(' · ') : `Không đợt nào có mã ${esc(r.from)}.`)
          + (r.conflicts.length ? `<br><span style="color:var(--red)">Bỏ qua ${r.conflicts.length} đợt đã có sẵn dự án ${esc(r.to)} (mở đợt đó để gộp tay): ${r.conflicts.map(c => ml(c.month)).join(', ')}</span>` : '');
        $('rnGo').disabled = !r.batches.length;
      } catch (e) { msg.className = 'ac-note err'; msg.textContent = '✗ ' + e.message; rnReset(); }
    };
    $('renameForm').onsubmit = async (ev) => {
      ev.preventDefault();
      if (!rnPlan || !rnPlan.batches.length) return;
      if (!confirm(`Đổi mã WBS ${rnPlan.from} → ${rnPlan.to} ở ${rnPlan.batches.length} đợt?\nBáo cáo, lịch sử "đã trả" và trang "Thưởng của tôi" sẽ hiện theo mã mới. Đợt đã phát hành vẫn giữ phát hành.`)) return;
      const msg = $('rnMsg');
      try {
        const r = await api('POST', '/api/incentive/rename-wbs', rnBody(false));
        msg.className = 'ac-note'; msg.textContent = `✓ Đã đổi ở ${r.batches.length} đợt.`;
        rnReset(); await loadRefs(); await loadList();
      } catch (e) { msg.className = 'ac-note err'; msg.textContent = '✗ ' + e.message; }
    };
    // gộp tên: dòng chỉ có tên (không Mã NV, vd. "SUU TRI NGO") → nhân viên khớp tên (bỏ dấu, đổi thứ tự từ) ở mọi đợt
    $('btnFixNames').onclick = async () => {
      const btn = $('btnFixNames'); btn.disabled = true;
      try {
        const r = await api('POST', '/api/incentive/fix-names', { scheme: SCHEME, dryRun: true });
        const miss = r.unmatched.length ? `\n\nKhông khớp được nhân viên nào (hoặc trùng tên) — sửa tay ở bước 4 của đợt: ${r.unmatched.join(', ')}` : '';
        if (!r.lines) { alert('Không có dòng nào cần gộp: mọi người đã có Mã NV.' + miss); return; }
        const list = r.pairs.map(p => `• ${p.from} → ${p.name} (${p.empId}) — ${p.months.map(ml).join(', ')}`).join('\n');
        if (!confirm(`Gộp ${r.lines} dòng ở ${r.batches} đợt:\n\n${list}${miss}\n\nBáo cáo theo người và trang "Thưởng của tôi" sẽ tính chung cho nhân viên đó. Tiếp tục?`)) return;
        const d = await api('POST', '/api/incentive/fix-names', { scheme: SCHEME });
        alert(`✓ Đã gộp ${d.lines} dòng ở ${d.batches} đợt.`);
        await loadRefs(); await loadList();
      } catch (e) { alert('✗ ' + e.message); }
      finally { btn.disabled = false; }
    };
    $('btnPubAll').onclick = async () => {
      const list = batches.filter(b => b.status === 'done' && !b.publishedAt).sort((a, b) => a.month.localeCompare(b.month));
      if (!list.length) return;
      if (!confirm(`Phát hành ${list.length} đợt đã chốt (${list.map(b => ml(b.month)).join(', ')})?\nNgười được chia thưởng sẽ xem được tiền của mình trong trang "Thưởng của tôi".`)) return;
      const mail = confirm('Gửi email thông báo cho từng người?\n\nOK = gửi email (mỗi đợt một email cho mỗi người)\nHuỷ = KHÔNG gửi email, chỉ cho xem trong app (nên chọn với các đợt cũ)');
      const btn = $('btnPubAll'); btn.disabled = true;
      let ok = 0, sent = 0; const noId = new Set(), errs = [];
      for (const b of list) {
        btn.textContent = `Đang phát hành ${ok + 1}/${list.length}…`;
        try { const r = await api('POST', `/api/incentive/batches/${b.id}/publish`, { sendMail: mail }); ok++; sent += r.sent || 0; (r.noId || []).forEach(n => noId.add(n)); }
        catch (e) { errs.push(`${ml(b.month)}: ${e.message}`); }
      }
      btn.disabled = false;
      alert(`Đã phát hành ${ok}/${list.length} đợt.` + (mail ? ` Đã gửi ${sent} email.` : ' Không gửi email.')
        + (noId.size ? `\n\nThiếu Mã NV (chưa xem được thưởng): ${[...noId].join(', ')} — mở đợt, sửa ở bước 4 rồi chốt + phát hành lại.` : '')
        + (errs.length ? '\n\nLỗi:\n' + errs.join('\n') : ''));
      await loadList();
    };
    $('btnNew').onclick = () => { $('newForm').hidden = false; $('newMonth').value = nextOddMonth(); $('newTitle').value = ''; $('newMsg').textContent = ''; $('newMonth').focus(); };
    $('newCancel').onclick = () => { $('newForm').hidden = true; };
    $('newForm').onsubmit = async (ev) => {
      ev.preventDefault();
      try {
        const b = await api('POST', '/api/incentive/batches', { scheme: SCHEME, month: $('newMonth').value, title: $('newTitle').value.trim() });
        $('newForm').hidden = true; await loadList(); await openBatch(b.id);
      } catch (e) { $('newMsg').textContent = e.message; }
    };
    $('tBatches').addEventListener('click', (ev) => { const b = ev.target.closest('[data-open]'); if (b) openBatch(+b.closest('tr').dataset.id).catch(e => toast(e.message)); });
    $('btnImport').onclick = () => { $('secImport').hidden = false; $('impPreview').hidden = true; $('impMsg').textContent = ''; $('impFile').value = ''; $('secImport').scrollIntoView({ behavior: 'smooth' }); };
    $('impClose').onclick = () => { $('secImport').hidden = true; };
    $('impFile').onchange = (ev) => { const f = ev.target.files[0]; if (f) onImportFile(f); };
    $('tImport').addEventListener('change', impCount);
    $('impAll').onchange = (ev) => { document.querySelectorAll('[data-imp]').forEach(c => { c.checked = ev.target.checked; }); impCount(); };
    $('impGo').onclick = doImport;

    $('edBack').onclick = async () => {
      if (dirty) { try { await save(); } catch (e) { if (!confirm('Chưa lưu được thay đổi. Vẫn rời đợt này?')) return; } }
      cur = null; $('editor').hidden = true; $('secList').hidden = false; $('secReport').hidden = false; await loadRefs(); await loadList();
    };
    $('edSave').onclick = () => save().catch(() => {});
    $('steps').addEventListener('click', (ev) => { const b = ev.target.closest('[data-step]'); if (b) go(+b.dataset.step); });
    $('pFilter').oninput = renderProjects; $('pShowDone').onchange = renderProjects;
    $('tProjects').addEventListener('change', (ev) => {
      if (readOnly()) return;
      const tr = ev.target.closest('tr'); if (!tr) return;
      const wbs = tr.dataset.wbs;
      if (ev.target.matches('[data-pick]')) {
        if (ev.target.checked) addProject(wbs);
        else {
          const i = items().findIndex(p => p.wbs === wbs), p = items()[i];
          if (p && (p.swat.stdOk || p.swat.scOk) && !confirm(`Bỏ "${p.name}" khỏi đợt? Phần đã duyệt trong đợt sẽ mất (thông số SWAT đã lưu vào dự án vẫn còn).`)) { ev.target.checked = true; return; }
          items().splice(i, 1);
        }
      }
      if (ev.target.matches('[data-kind]')) { const p = items().find(x => x.wbs === wbs); if (p) { p.kind = ev.target.value; recompute(p); } }
      renderProjects(); changed();
    });
    $('revList').addEventListener('click', (ev) => { const b = ev.target.closest('[data-rev]'); if (b) openReview(+b.dataset.rev); });
    $('revApprove').onclick = approve;
    $('revNext').onclick = () => {
      // dự án tiếp theo trong danh sách đang lọc (hết thì quay về đầu)
      const idx = items().map((p, i) => i).filter(i => revMatch(items()[i]));
      const nx = idx.find(i => i > revIdx); openReview(nx != null ? nx : (idx.length ? idx[0] : (revIdx + 1 < items().length ? revIdx + 1 : 0)));
    };
    $('revQ').addEventListener('input', renderRevList);
    $('revTodo').addEventListener('change', renderRevList);
    $('revQ').addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      const b = $('revList').querySelector('[data-rev]'); if (b) { ev.preventDefault(); openReview(+b.dataset.rev); }
    });
    window.addEventListener('message', (ev) => {
      if (!ev.data || ev.data.type !== 'SWAT_RESULT' || !(step === 2 || step === 3) || !cur) return;
      const p = items()[revIdx]; if (!p) return;
      try {
        const st = $('tool').contentWindow.SWAT.getState();
        if (p.swat.state && (p.swat.stdOk || p.swat.scOk) && JSON.stringify(st) !== JSON.stringify(p.swat.state) && !p.swat.changed) {
          p.swat.changed = true; $('revMsg').textContent = '⚠ Đã sửa sau khi duyệt — bấm Duyệt lại để cập nhật.'; renderRevList();
        }
      } catch (e) { /* bỏ qua */ }
      renderRevSum();
    });
    $('hoursReload').onclick = async () => {
      if (readOnly()) return;
      if (!confirm('Lấy lại danh sách fitter và giờ công từ bảng Theo dõi giờ công cho mọi dự án trong đợt? Các chỉnh sửa tay ở bước 4 (tên, giờ, số tiền) sẽ bị thay.')) return;
      try { await hoursFor(items().map(p => p.wbs), true); } catch (e) { toast(e.message); return; }
      items().forEach(p => { p.fitters = null; initPeople(p); p.imported = false; recompute(p); });
      renderSplits(false); changed();
    };
    $('splits').addEventListener('change', onSplitChange);
    $('splits').addEventListener('click', onSplitClick);
    document.querySelectorAll('[data-sg]').forEach(i => i.addEventListener('change', () => { cur.data.signers = cur.data.signers || {}; cur.data.signers[i.dataset.sg] = i.value.trim(); changed(); }));
    ['rYear', 'rBatch', 'rView'].forEach(id => $(id).addEventListener('change', renderReport));
    $('rSearch').addEventListener('input', () => { clearTimeout(renderReport.t); renderReport.t = setTimeout(renderReport, 200); });
    $('rBody').addEventListener('click', (ev) => { const b = ev.target.closest('[data-openb]'); if (b) openBatch(+b.dataset.openb).catch(e => toast(e.message)); });
    $('pubGo').onclick = async () => {
      if (!cur || cur.status !== 'done') return;
      const mail = $('pubMail').checked, again = !!cur.publishedAt;
      const people = Incentive.byPerson(items()).filter(x => x.amount);
      if (!confirm(`${again ? 'Gửi lại email' : 'Phát hành'} đợt thưởng tháng ${ml(cur.month)}?\n${people.length} người được chia thưởng${mail ? ' sẽ nhận email chi tiết (chỉ tiền của chính họ)' : ' — KHÔNG gửi email'} và xem được trong trang "Thưởng của tôi".`)) return;
      $('pubGo').disabled = true; $('pubMsg').className = 'ac-note'; $('pubMsg').textContent = 'Đang phát hành…';
      try {
        const r = await api('POST', `/api/incentive/batches/${cur.id}/publish`, { sendMail: mail });
        cur.publishedAt = r.publishedAt;
        const miss = [...r.noEmail.map(n => n + ' (không có email)'), ...r.noId.map(n => n + ' (thiếu Mã NV — không xem được trong app)')];
        $('pubMsg').textContent = `✓ Đã phát hành${r.mail ? ` — gửi ${r.sent}/${r.people} email${r.failed ? `, lỗi ${r.failed}: ${r.error || ''}` : ''}` : ''}.${miss.length ? ' Lưu ý: ' + miss.join('; ') + '.' : ''}`;
        renderBar(); renderSummary();
      } catch (e) { $('pubMsg').className = 'ac-note err'; $('pubMsg').textContent = '✗ ' + e.message; }
      finally { $('pubGo').disabled = false; }
    };
    $('xList').onclick = exportList;
    $('xOverview').onclick = exportOverview;
    $('xAna').onclick = exportAnalysis;
    $('tAna').addEventListener('change', onAnalysisInput);
    ['anBranch', 'anOffset', 'anAdjust', 'anRate'].forEach(id => $(id).addEventListener('change', onAnalysisInput));
    $('xStd').onclick = () => exportSwat('std');
    $('xSc').onclick = () => exportSwat('sc');
    $('edDone').onclick = async () => {
      const list = items();
      if (!list.length) return toast('Đợt chưa có dự án.');
      const notOk = list.filter(p => !p.imported && !(p.swat.stdOk && p.swat.scOk));
      if (notOk.length) return toast(`Còn dự án chưa duyệt đủ Standard Hour + Scorecard: ${notOk.map(p => p.name || p.wbs).join(', ')}.`);
      if (!confirm(`Chốt đợt thưởng tháng ${ml(cur.month)} — tổng ${money(list.reduce((s, p) => s + p.total, 0))} đ?\nSau khi chốt, các dự án được ghi nhận đã trả đợt này (lần sau sẽ hiện lựa chọn đợt cuối).`)) return;
      try { await save('done'); await loadRefs(); toast('✓ Đã chốt đợt.'); go(5); } catch (e) { /* đã báo */ }
    };
    $('edReopen').onclick = async () => {
      if (!confirm('Mở lại đợt này để sửa? Đợt sẽ tạm KHÔNG tính vào lịch sử "đã trả" cho tới khi chốt lại.')) return;
      cur.status = 'draft';
      try { await save('draft'); await loadRefs(); go(step); } catch (e) { cur.status = 'done'; }
    };
    $('edDelete').onclick = async () => {
      if (!confirm(`Xoá hẳn đợt thưởng tháng ${ml(cur.month)}? Không khôi phục được.`)) return;
      try { await api('DELETE', '/api/incentive/batches/' + cur.id, {}); cur = null; $('editor').hidden = true; $('secList').hidden = false; $('secReport').hidden = false; await Promise.all([loadList(), loadRefs()]); toast('Đã xoá đợt.'); }
      catch (e) { toast(e.message); }
    };
    window.addEventListener('beforeunload', (ev) => { if (dirty) { ev.preventDefault(); ev.returnValue = ''; } });
  }

  async function boot() {
    try {
      me = await api('GET', '/api/me');
      $('who').textContent = `Đăng nhập: ${me.name || me.email}`;
      if (!me.isAdmin) { gate('Chức năng <b>Incentive</b> chỉ dành cho <b>Quản trị viên (Admin)</b>.', true); return; }
      await loadRefs(); await loadList();
      $('secList').hidden = false; $('secReport').hidden = false;
      wire();
    } catch (e) { gate('✗ ' + esc(e.message), true); }
  }
  boot();
})();
