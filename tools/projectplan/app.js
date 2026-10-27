// Quản lý dự án (bản demo) — điều phối fitter + lịch trình dự án.
// Dữ liệu lưu trên trình duyệt (localStorage); chia sẻ bằng Xuất / Nhập Excel (pmio.js).
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const P = window.PMIO;
  const KEY = 'pm_data_v1', UI_KEY = 'pm_ui_v1';
  const EXCELJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
  const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // chữ trắng trên nền đậm, chữ đen trên nền nhạt (độ sáng tương đối WCAG)
  const textOn = (hex) => {
    const c = safeColor(hex).slice(1), lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = 0.2126 * lin(parseInt(c.slice(0, 2), 16)) + 0.7152 * lin(parseInt(c.slice(2, 4), 16)) + 0.0722 * lin(parseInt(c.slice(4, 6), 16));
    return L < 0.22 ? '#fff' : '#111827';
  };
  const safeColor = (c) => (/^#[0-9a-f]{6}$/i.test(String(c || '')) ? c : '#cbd5e1');
  const pad = (n) => String(n).padStart(2, '0');
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const wd = (s) => P.isoToUTCDate(s).getUTCDay();
  const dm = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '');
  const mondayOf = (s) => P.addDays(s, -((wd(s) + 6) % 7));
  const holiday = (s) => (window.LaborVN ? LaborVN.holidayInfo(s) : null);
  const offDay = (s) => wd(s) === 0 || !!holiday(s);

  // ---------------- dữ liệu ----------------
  function load() {
    try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.version === 1) return d; } catch (e) { /* hỏng → bắt đầu lại */ }
    return P.emptyData();
  }
  let data = load();
  let ui = (() => { try { return JSON.parse(localStorage.getItem(UI_KEY)) || {}; } catch (e) { return {}; } })();
  ui.weeks = ui.weeks || (window.innerWidth < 700 ? 2 : 4);
  ui.tab = ui.tab || 'alloc';
  let viewStart = mondayOf(today());
  const saveUI = () => { try { localStorage.setItem(UI_KEY, JSON.stringify({ tab: ui.tab, weeks: ui.weeks, started: ui.started, planView: ui.planView, actMode: ui.actMode })); } catch (e) { /* bỏ qua */ } };
  function save() {
    data.updatedAt = new Date().toISOString();
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) { toast('Không lưu được trên máy này (bộ nhớ trình duyệt đầy hoặc bị chặn). Hãy Xuất Excel để giữ dữ liệu.'); }
    if (STORE_URL) scheduleSave();
  }

  // ================= KHO DỮ LIỆU CHUNG (Google Drive qua Apps Script) =================
  // Mọi Quản lý dự án / Site Sup cùng xem & sửa một bộ dữ liệu: tự tải khi mở, tự lưu sau mỗi thay đổi,
  // có người lưu trước → gộp thay đổi (PMIO.merge) rồi lưu lại. Mất mạng → giữ trên máy, có mạng lại thì lưu.
  const STORE_URL = (window.CONFIG && CONFIG.PM_SYNC_URL) || '';
  const STORE_NAME = (window.CONFIG && CONFIG.SERVER) ? 'máy chủ' : 'Drive';   // bản Cloudflare lưu trên máy chủ, bản github.io lưu trên Drive (Apps Script)
  const BASE_KEY = 'pm_base_v1', META_KEY = 'pm_store_meta_v1';
  const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  let base = readJSON(BASE_KEY);                                   // bản chung lúc đồng bộ lần cuối
  let meta = readJSON(META_KEY) || { version: null, updatedAt: '', updatedBy: '' };
  let st = { phase: 'idle', msg: '' };
  let saving = false, saveTimer = null, lastPull = 0;
  const core = (d) => ({ fitters: d.fitters || [], projects: d.projects || [], alloc: d.alloc || {} });
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const dirty = () => !!STORE_URL && (!base ? !!(data.fitters.length || data.projects.length) : !P.same(core(data), core(base)));
  const keepMeta = () => { try { localStorage.setItem(BASE_KEY, JSON.stringify(base)); localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) { /* bỏ qua */ } };
  function who() {
    const s = typeof Session !== 'undefined' ? Session.current() : null;
    if (!s) return null;
    if (s.admin) { let k = ''; try { k = sessionStorage.getItem('pmStoreKey') || ''; } catch (e) { /* bỏ qua */ } return { admin: k || 'none' }; }
    return { name: s.name, empId: s.empId };
  }
  async function call(action, extra) {
    // Apps Script (khác tên miền) buộc dùng text/plain để khỏi bị chặn CORS; máy chủ Cloudflare cùng tên miền nên gửi JSON
    const same = STORE_URL.startsWith('/');
    const res = await fetch(STORE_URL, { method: 'POST', credentials: 'same-origin', redirect: same ? 'manual' : 'follow',
      headers: { 'Content-Type': same ? 'application/json' : 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action, user: who() }, extra || {})) });
    if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400) || res.status === 401) throw new Error('Phiên đăng nhập đã hết hạn — tải lại trang (F5)');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }
  function scheduleSave(ms) { if (!STORE_URL) return; clearTimeout(saveTimer); saveTimer = setTimeout(() => push(), ms == null ? 1500 : ms); renderStore(); }
  // nhận bản chung mới nhất
  function applyRemote(r) {
    const remote = r.data ? core(r.data) : core(P.emptyData());
    let conflicts = 0;
    if (meta.version === r.version && base) { /* không có gì mới */ }
    else if (!dirty()) { data = Object.assign(P.emptyData(), clone(remote)); }
    else {
      const remoteEmpty = !remote.fitters.length && !remote.projects.length;
      if (!(remoteEmpty && !base)) { const m = P.merge(base ? core(base) : null, core(data), remote); data = Object.assign(P.emptyData(), m.data); conflicts = m.conflicts; }
    }
    base = clone(remote); meta = { version: r.version, updatedAt: r.updatedAt || '', updatedBy: r.updatedBy || '' };
    keepMeta();
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* bỏ qua */ }
    if (conflicts) toast(`Đã gộp với thay đổi của ${meta.updatedBy || 'người khác'} — ${conflicts} mục cả hai cùng sửa, giữ bản của bạn.`);
    if (dirty()) scheduleSave(300);
  }
  async function pull() {
    if (!STORE_URL || saving) return;
    if (navigator.onLine === false) { st = { phase: 'offline' }; renderStore(); return; }
    st = { phase: 'loading' }; renderStore();
    try {
      const r = await call('load');
      lastPull = Date.now();
      if (r.denied) st = { phase: 'denied', msg: r.error };
      else if (!r.ok) throw new Error(r.error || 'lỗi không rõ');
      else { applyRemote(r); st = { phase: 'idle' }; }
    } catch (e) { st = { phase: 'error', msg: e.message }; }
    render();
  }
  async function push() {
    if (!STORE_URL || saving || !dirty()) { renderStore(); return; }
    if (navigator.onLine === false) { st = { phase: 'offline' }; renderStore(); return; }
    if (meta.version === null) return pull(); // chưa tải bản chung lần nào → tải & gộp trước
    saving = true; st = { phase: 'saving' }; renderStore();
    try {
      for (let i = 0; i < 4; i++) {
        const sent = clone(core(data));
        const r = await call('save', { baseVersion: meta.version || 0, data: sent });
        if (r.ok) { base = sent; meta = { version: r.version, updatedAt: r.updatedAt, updatedBy: r.updatedBy }; keepMeta(); st = { phase: 'idle' }; break; }
        if (r.denied) { st = { phase: 'denied', msg: r.error }; break; }
        if (!r.conflict) throw new Error(r.error || 'lỗi không rõ');
        // có người lưu trước: gộp rồi thử lại
        const remote = r.data ? core(r.data) : core(P.emptyData());
        const m = P.merge(base ? core(base) : null, core(data), remote);
        data = Object.assign(P.emptyData(), m.data); base = clone(remote);
        meta = { version: r.version, updatedAt: r.updatedAt || '', updatedBy: r.updatedBy || '' }; keepMeta();
        try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* bỏ qua */ }
        if (m.conflicts) toast(`${meta.updatedBy || 'Người khác'} vừa lưu — đã gộp, ${m.conflicts} mục cả hai cùng sửa: giữ bản của bạn.`);
      }
    } catch (e) { st = { phase: 'error', msg: e.message }; }
    saving = false;
    render();
    if (st.phase === 'idle' && dirty()) scheduleSave(800); // có sửa thêm trong lúc đang lưu
  }
  const fmtWhen = (iso) => {
    const d = new Date(iso); if (!iso || isNaN(d)) return '';
    const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return d.toDateString() === new Date().toDateString() ? `${hm} hôm nay` : `${hm} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  };
  function renderStore() {
    const bar = $('storeBar');
    $('btnSave').hidden = !STORE_URL;
    $('btnSave').querySelector('span').textContent = 'Lưu lên ' + STORE_NAME;
    $('miReload').textContent = 'Tải lại dữ liệu chung từ ' + STORE_NAME;
    $('miReload').hidden = !STORE_URL;
    $('miSample').hidden = !!STORE_URL;
    $('miClear').textContent = STORE_URL ? 'Bỏ dữ liệu trên máy, tải lại từ ' + STORE_NAME : 'Xóa toàn bộ dữ liệu trên máy';
    if (!STORE_URL) {
      bar.innerHTML = '<span class="dot warn"></span><span><b>Chỉ lưu trên máy này</b> — chưa kết nối kho dữ liệu chung trên Drive (quản trị viên: xem hướng dẫn). Chia sẻ tạm bằng Xuất / Nhập Excel trong menu ⋯.</span>';
      return;
    }
    const d = dirty(), ph = st.phase;
    $('btnSave').disabled = saving || !d || ph === 'denied';
    let dot = 'ok', txt, act = '';
    if (ph === 'loading') { dot = 'busy'; txt = 'Đang tải dữ liệu chung…'; }
    else if (ph === 'saving') { dot = 'busy'; txt = 'Đang lưu lên ' + STORE_NAME + '…'; }
    else if (ph === 'denied') { dot = 'err'; txt = `<b>Không dùng được kho dữ liệu chung:</b> ${esc(st.msg)}`; }
    else if (ph === 'error') { dot = 'err'; txt = `<b>Chưa kết nối được kho dữ liệu chung</b> (${esc(st.msg)}) — thay đổi vẫn giữ trên máy.`; act = '<button type="button" class="lnk" data-act="retry">Thử lại</button>'; }
    else if (ph === 'offline') { dot = 'warn'; txt = `<b>Ngoại tuyến</b> — thay đổi giữ trên máy, tự lưu lên ${STORE_NAME} khi có mạng.`; }
    else if (d) { dot = 'warn'; txt = `<b>Có thay đổi chưa lưu</b> — đang tự lưu lên ${STORE_NAME}…`; }
    else if (meta.version) { txt = `<b>Đã lưu trên ${STORE_NAME}</b> · ${esc(fmtWhen(meta.updatedAt))}${meta.updatedBy ? ' · bởi ' + esc(meta.updatedBy) : ''} · phiên bản ${meta.version}`; act = '<button type="button" class="lnk" data-act="reload">Tải lại</button>'; }
    else { txt = `<b>Kho dữ liệu chung đang trống</b> — dữ liệu bạn nhập sẽ được lưu lên ${STORE_NAME} cho cả nhóm.`; }
    bar.innerHTML = `<span class="dot ${dot}"></span><span>${txt}</span>${act}`;
  }

  // ================= DỮ LIỆU DÙNG CHUNG (EE Data + Dự án, như Thống kê giờ công) =================
  let EE = [], SHARED = [];
  const FITTER_RE = /fitter|lap dat|installer|technician|ky thuat|tho/;
  async function loadShared() {
    if (typeof DB === 'undefined') return;
    try { [EE, SHARED] = await Promise.all([DB.getAll('employees'), DB.getAll('projects')]); EE = EE || []; SHARED = SHARED || []; } catch (e) { EE = []; SHARED = []; }
    $('eeNames').innerHTML = EE.filter(e => FITTER_RE.test(P.plain(e.position)))
      .map(e => `<option value="${esc(e.fullName + ' · ' + e.empId)}">${esc(e.position)}</option>`).join('');
    $('sharedProjects').innerHTML = SHARED.slice(0, 3000).map(x => `<option value="${esc(x.wbs + ' — ' + x.projectName)}">`).join('');
  }
  const eeById = (id) => EE.find(e => P.plain(e.empId) === P.plain(id));
  function renderShared() {
    const ok = typeof Cloud !== 'undefined' && Cloud.configured();
    const at = ok && Cloud.getLastSyncedAt ? Cloud.getLastSyncedAt() : '';
    $('sharedBar').innerHTML = `<span class="dot ${at ? 'ok' : 'warn'}"></span><span>Dữ liệu dùng chung: <b>${EE.length}</b> nhân viên · <b>${SHARED.length}</b> dự án` +
      (at ? ` · đồng bộ ${esc(fmtWhen(at))}` : ' · chưa đồng bộ trên máy này') + '</span>' +
      (ok ? `<button type="button" class="lnk" id="btnShared"${navigator.onLine === false ? ' disabled' : ''}>Đồng bộ</button>` : '');
  }
  $('sharedBar').addEventListener('click', async (e) => {
    const b = e.target.closest('#btnShared'); if (!b) return;
    b.disabled = true; b.textContent = 'Đang đồng bộ…';
    try { const d = await Cloud.loadFromDrive(); await loadShared(); toast(`Đã cập nhật dữ liệu chung: ${(d.employees || []).length} nhân viên, ${(d.projects || []).length} dự án.`); }
    catch (err) { toast(/QUOTA/.test(err.message) ? 'Google Drive đang giới hạn lượt tải hôm nay — dùng dữ liệu đã có trên máy.' : 'Chưa đồng bộ được: ' + err.message); }
    renderShared(); render();
  });
  $('storeBar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'retry') { if (meta.version === null || !dirty()) pull(); else push(); }
    if (b.dataset.act === 'reload') pull();
  });
  $('btnSave').addEventListener('click', () => { clearTimeout(saveTimer); push(); });
  const byId = () => { const m = {}; data.projects.forEach(p => { m[p.id] = p; }); return m; };
  // thay đổi có Hoàn tác (lastSnap: để thông báo riêng sau đó vẫn hoàn tác được)
  let lastSnap = null;
  function commit(msg, mutate) {
    const snap = lastSnap = JSON.stringify(data);
    mutate();
    save(); render();
    if (msg) toast(msg, { label: 'Hoàn tác', run: () => { data = JSON.parse(snap); save(); render(); toast('Đã hoàn tác.'); } });
  }

  // đoạn liền nhau cùng dự án + cùng trạng thái chứa ngày d (kể cả ngoài khung đang xem)
  function blockAt(fid, d) {
    const m = data.alloc[fid] || {}, v = m[d];
    if (!v) return null;
    const same = (x) => x && x.p === v.p && !!x.t === !!v.t;
    let a = d, b = d;
    while (same(m[P.addDays(a, -1)])) a = P.addDays(a, -1);
    while (same(m[P.addDays(b, 1)])) b = P.addDays(b, 1);
    return { p: v.p, t: !!v.t, from: a, to: b };
  }
  // các đoạn phân công của một dự án (theo fitter)
  function projectRuns(pid, from, to) {
    const out = [];
    data.fitters.forEach(f => {
      const m = data.alloc[f.id] || {};
      const ds = Object.keys(m).filter(d => m[d].p === pid && (!from || d >= from) && (!to || d <= to)).sort();
      let cur = null;
      ds.forEach(d => {
        if (cur && P.addDays(cur.to, 1) === d && !!m[d].t === cur.t) cur.to = d;
        else { cur = { f, from: d, to: d, t: !!m[d].t }; out.push(cur); }
      });
    });
    return out;
  }

  // ---------------- khung chung ----------------
  function render() {
    renderStore(); renderShared();
    const empty = !data.fitters.length && !data.projects.length && !ui.started;
    $('viewEmpty').hidden = !empty;
    const firstLoad = STORE_URL && meta.version === null && st.phase === 'loading';
    $('viewEmpty').querySelector('h2').textContent = firstLoad ? 'Đang tải dữ liệu chung…' : 'Chưa có dữ liệu';
    $('viewEmpty').querySelector('.pp-empty-actions').hidden = firstLoad;
    document.querySelector('.pp-tabs').hidden = empty;
    $('viewAlloc').hidden = empty || ui.tab !== 'alloc';
    $('viewPlan').hidden = empty || ui.tab !== 'plan';
    $('viewActual').hidden = empty || ui.tab !== 'actual';
    $('tabAlloc').setAttribute('aria-selected', String(ui.tab === 'alloc'));
    $('tabPlan').setAttribute('aria-selected', String(ui.tab === 'plan'));
    $('tabActual').setAttribute('aria-selected', String(ui.tab === 'actual'));
    $('btnExport').disabled = empty;
    if (empty) return;
    if (ui.tab === 'alloc') renderAlloc(); else if (ui.tab === 'plan') renderPlan(); else renderActual();
  }
  function setTab(t) { ui.tab = t; saveUI(); render(); }

  // ================= ĐIỀU PHỐI NHÂN SỰ =================
  function renderAlloc() {
    $('weeks').value = String(ui.weeks);
    const days = P.daysBetween(viewStart, P.addDays(viewStart, ui.weeks * 7 - 1));
    const t = today(), pm = byId();
    $('rangeLabel').textContent = `${P.fmtVN(days[0])} – ${P.fmtVN(days[days.length - 1])}`;

    // dự án để làm nổi
    const hiSel = $('hiProject'), hi = hiSel.value;
    const used = new Set(); Object.values(data.alloc).forEach(m => Object.values(m).forEach(v => used.add(v.p)));
    hiSel.innerHTML = '<option value="">Tất cả dự án</option>' + data.projects.filter(p => used.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi')).map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
    hiSel.value = pm[hi] ? hi : '';

    const dayCls = (d) => [wd(d) === 0 ? 'sun' : '', holiday(d) ? 'hol' : '', d === t ? 'today' : ''].filter(Boolean).join(' ');
    // dòng tháng
    const months = []; days.forEach(d => { const k = d.slice(0, 7); const last = months[months.length - 1]; if (last && last.k === k) last.n++; else months.push({ k, n: 1 }); });
    const nameW = window.innerWidth < 600 ? 112 : 160;
    $('alTable').style.width = (nameW + days.length * 36) + 'px';
    alGeo = { nameW, start: days[0], n: days.length };
    let h = `<colgroup><col style="width:${nameW}px">${days.map(() => '<col style="width:36px">').join('')}</colgroup><thead><tr><th class="name"></th>${months.map(m => `<th colspan="${m.n}">Tháng ${Number(m.k.slice(5))}/${m.k.slice(0, 4)}</th>`).join('')}</tr>`;
    h += `<tr><th class="name" scope="col">Fitter (${data.fitters.length})</th>${days.map(d => {
      const hol = holiday(d);
      return `<th class="day ${dayCls(d)}" scope="col" title="${esc(`${WD[wd(d)]} ${P.fmtVN(d)}${hol ? ' — ' + hol.name : ''}`)}"><span class="dw">${WD[wd(d)]}</span><span class="dd">${Number(d.slice(8))}</span></th>`;
    }).join('')}</tr></thead><tbody>`;

    const idle = days.map(() => 0);
    data.fitters.forEach(f => {
      const m = data.alloc[f.id] || {};
      let work = 0, tent = 0;
      days.forEach((d, i) => { if (m[d] && pm[m[d].p]) { work++; if (m[d].t) tent++; } else if (!offDay(d)) idle[i]++; });
      const link = !f.empId ? '' : (EE.length && !eeById(f.empId) ? ` · <span class="warn" title="Mã NV không còn trong dữ liệu nhân sự">${esc(f.empId)} ⚠</span>` : ` · ${esc(f.empId)}`);
      h += `<tr><td class="name" data-f="${esc(f.id)}" tabindex="0" role="button" aria-label="${esc('Sửa fitter ' + f.name)}"><span class="nm">${esc(f.name)}</span><span class="nd">${work} ngày có việc${tent ? ` · ${tent} dự kiến` : ''}${link}</span></td>`;
      for (let i = 0; i < days.length;) {
        const d = days[i], v = m[d];
        if (!v || !pm[v.p]) { h += `<td class="cell ${dayCls(d)}" data-f="${esc(f.id)}" data-d="${d}"></td>`; i++; continue; }
        let j = i; while (j + 1 < days.length && m[days[j + 1]] && m[days[j + 1]].p === v.p && !!m[days[j + 1]].t === !!v.t) j++;
        const p = pm[v.p], blk = blockAt(f.id, d);
        const title = `${p.name}${v.t ? ' (dự kiến)' : ''} · ${f.name} · ${P.fmtVN(blk.from)} – ${P.fmtVN(blk.to)}`;
        h += `<td class="bar${v.t ? ' tent' : ''}${hi && hi !== v.p ? ' dim' : ''}" colspan="${j - i + 1}" data-f="${esc(f.id)}" data-d="${d}" tabindex="0" role="button" title="${esc(title)}" aria-label="${esc(title)}">${d === blk.from ? '<i class="rz l" data-e="l"></i>' : ''}${days[j] === blk.to ? '<i class="rz r" data-e="r"></i>' : ''}<span style="background:${safeColor(p.color)};color:${textOn(p.color)}">${esc(p.name)}</span></td>`;
        i = j + 1;
      }
      h += '</tr>';
    });
    h += `</tbody><tfoot><tr><td class="name" title="Số fitter chưa có việc trong ngày làm việc">Chưa có việc</td>${days.map((d, i) => `<td class="${idle[i] && !offDay(d) ? 'idle' : ''} ${dayCls(d)}">${offDay(d) ? '' : idle[i] || ''}</td>`).join('')}</tr></tfoot>`;
    $('alTable').innerHTML = h;

    // hôm nay
    const on = data.fitters.filter(f => (data.alloc[f.id] || {})[t] && pm[data.alloc[f.id][t].p]);
    const free = data.fitters.filter(f => !on.includes(f));
    const tentT = on.filter(f => data.alloc[f.id][t].t).length;
    const projT = new Set(on.map(f => data.alloc[f.id][t].p)).size;
    $('todayStats').innerHTML = `<span class="chip">Hôm nay ${P.fmtVN(t)}: <b>${on.length}/${data.fitters.length}</b> fitter có việc · <b>${projT}</b> dự án</span>` +
      (tentT ? `<span class="chip">${tentT} phân công dự kiến</span>` : '') +
      (free.length && !offDay(t) ? `<span class="chip warn">Chưa có việc hôm nay: ${free.map(f => esc(f.name)).join(', ')}</span>` : '');
  }

  let alGeo = null;
  // chọn khoảng ngày bằng kéo chuột trên một dòng
  let drag = null;
  function markSel() {
    document.querySelectorAll('#alTable td.sel').forEach(x => x.classList.remove('sel'));
    if (!drag) return;
    const [a, b] = drag.a <= drag.b ? [drag.a, drag.b] : [drag.b, drag.a];
    document.querySelectorAll(`#alTable td.cell[data-f="${CSS.escape(drag.f)}"]`).forEach(x => { if (x.dataset.d >= a && x.dataset.d <= b) x.classList.add('sel'); });
  }
  $('alTable').addEventListener('pointerdown', (e) => {
    const c = e.target.closest('td.cell'); if (!c || e.button > 0) return;
    drag = { f: c.dataset.f, a: c.dataset.d, b: c.dataset.d }; markSel();
    try { c.releasePointerCapture(e.pointerId); } catch (_) { /* cảm ứng */ }
  });
  $('alTable').addEventListener('pointerover', (e) => {
    if (!drag) return; const c = e.target.closest('td.cell');
    if (c && c.dataset.f === drag.f) { drag.b = c.dataset.d; markSel(); }
  });
  document.addEventListener('pointerup', () => {
    if (!drag) return;
    const d = drag; drag = null;
    const [a, b] = d.a <= d.b ? [d.a, d.b] : [d.b, d.a];
    openAssign({ f: d.f, from: a, to: b });
    markSel();
  });
  $('alTable').addEventListener('click', (e) => {
    if (suppressClick) { suppressClick = false; return; }
    const bar = e.target.closest('td.bar'), nm = e.target.closest('td.name[data-f]');
    if (bar) { const blk = blockAt(bar.dataset.f, bar.dataset.d); openAssign({ f: bar.dataset.f, from: blk.from, to: blk.to, edit: blk }); }
    else if (nm) openFitter(nm.dataset.f);
  });
  $('alTable').addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('td[tabindex]')) { e.preventDefault(); e.target.click(); } });


  // ---------- kéo thả đoạn phân công (chuột trên máy tính) ----------
  // Kéo cả đoạn sang fitter / ngày khác (chuyển), kéo mép trái / phải để rút ngắn / kéo dài. Mọi thay đổi có Hoàn tác.
  let mv = null, suppressClick = false;
  const COLW = 36;
  const dayDiff = (a, b) => Math.round((P.isoToUTCDate(b) - P.isoToUTCDate(a)) / 864e5);
  function cellAtPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    const td = el && el.closest ? el.closest('#alTable td[data-f][data-d]') : null;
    if (!td) return null;
    let d = td.dataset.d;
    if (td.classList.contains('bar')) { const r = td.getBoundingClientRect(); d = P.addDays(d, Math.max(0, Math.min(td.colSpan - 1, Math.floor((x - r.left) / COLW)))); }
    return { f: td.dataset.f, d, row: td.parentElement };
  }
  function ghostFor(row, from, to, bad) {
    let g = $('alGhost');
    if (!g) { g = document.createElement('div'); g.id = 'alGhost'; g.className = 'al-ghost'; $('alScroll').appendChild(g); }
    const box = $('alScroll').getBoundingClientRect(), tb = $('alTable').getBoundingClientRect(), rr = row.getBoundingClientRect();
    const a = Math.max(0, dayDiff(alGeo.start, from)), b = Math.min(alGeo.n - 1, dayDiff(alGeo.start, to));
    if (b < a) { g.hidden = true; return; }
    g.hidden = false;
    g.style.left = (tb.left - box.left + $('alScroll').scrollLeft + alGeo.nameW + a * COLW + 1) + 'px';
    g.style.width = ((b - a + 1) * COLW - 2) + 'px';
    g.style.top = (rr.top - box.top + $('alScroll').scrollTop + 2) + 'px';
    g.style.height = (rr.height - 4) + 'px';
    g.classList.toggle('bad', !!bad);
  }
  const clearGhost = () => { const g = $('alGhost'); if (g) g.remove(); document.querySelectorAll('#alTable td.moving').forEach(x => x.classList.remove('moving')); };
  // vị trí mới của đoạn theo con trỏ → { f, from, to } (hoặc null nếu chưa hợp lệ)
  function mvTarget(e) {
    const c = cellAtPoint(e.clientX, e.clientY); if (!c) return null;
    const b = mv.blk;
    if (mv.mode === 'move') { const dd = dayDiff(mv.grab, c.d); return { f: c.f, row: c.row, from: P.addDays(b.from, dd), to: P.addDays(b.to, dd) }; }
    if (c.f !== mv.f) return null;
    if (mv.mode === 'rl') return { f: mv.f, row: c.row, from: c.d > b.to ? b.to : c.d, to: b.to };
    return { f: mv.f, row: c.row, from: b.from, to: c.d < b.from ? b.from : c.d };
  }
  $('alTable').addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const bar = e.target.closest('td.bar'); if (!bar) return;
    const rz = e.target.closest('.rz'), c = cellAtPoint(e.clientX, e.clientY), blk = blockAt(bar.dataset.f, bar.dataset.d);
    if (!c || !blk) return;
    mv = { mode: rz ? (rz.dataset.e === 'l' ? 'rl' : 'rr') : 'move', f: bar.dataset.f, blk, grab: c.d, x0: e.clientX, y0: e.clientY, moved: false, target: null };
  });
  document.addEventListener('pointermove', (e) => {
    if (!mv) return;
    if (!mv.moved) { if (Math.hypot(e.clientX - mv.x0, e.clientY - mv.y0) < 5) return; mv.moved = true; document.querySelectorAll(`#alTable td.bar[data-f="${CSS.escape(mv.f)}"]`).forEach(td => { const b = blockAt(td.dataset.f, td.dataset.d); if (b && b.from === mv.blk.from) td.classList.add('moving'); }); }
    const t = mvTarget(e); mv.target = t;
    if (!t) { const g = $('alGhost'); if (g) g.hidden = true; return; }
    const m = data.alloc[t.f] || {}, own = new Set(t.f === mv.f ? P.daysBetween(mv.blk.from, mv.blk.to) : []);
    const clash = P.daysBetween(t.from, t.to).some(d => m[d] && !own.has(d));
    ghostFor(t.row, t.from, t.to, clash);
  });
  document.addEventListener('pointerup', () => {
    if (!mv) return;
    const m0 = mv; mv = null;
    clearGhost();
    if (!m0.moved) return;
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
    const t = m0.target; if (!t) return;
    const b = m0.blk;
    if (t.f === m0.f && t.from === b.from && t.to === b.to) return;
    applyBlockMove(b, m0.f, t);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && mv) { mv = null; clearGhost(); } });
  function applyBlockMove(b, fromF, t) {
    const oldDays = P.daysBetween(b.from, b.to);
    const resize = t.f === fromF && (t.from !== b.from || t.to !== b.to) && (t.from === b.from || t.to === b.to);
    const newDays = P.daysBetween(t.from, t.to);
    const tm = data.alloc[t.f] || {}, own = new Set(t.f === fromF ? oldDays : []);
    const clash = newDays.filter(d => tm[d] && !own.has(d));
    const fn = (id) => (data.fitters.find(f => f.id === id) || {}).name || '';
    if (clash.length && !confirm(`Vị trí mới đè lên ${clash.length} ngày đã có phân công của ${fn(t.f)}. Vẫn thực hiện?`)) return;
    commit(null, () => {
      const src = data.alloc[fromF] || (data.alloc[fromF] = {});
      oldDays.forEach(d => { delete src[d]; });
      const dst = data.alloc[t.f] || (data.alloc[t.f] = {});
      newDays.forEach(d => { dst[d] = b.t ? { p: b.p, t: 1 } : { p: b.p }; });
    });
    const pn = (byId()[b.p] || {}).name || '';
    toastUndoLast(resize ? `Đã đổi thời gian ${pn}: ${dm(t.from)} – ${dm(t.to)}.` : `Đã chuyển ${pn} → ${fn(t.f)} (${dm(t.from)} – ${dm(t.to)}).`);
  }

  // ---------- hộp thoại phân công ----------
  let asCtx = null;
  function projectOptions(sel) {
    const open = data.projects.filter(p => !p.done || p.id === sel).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    return '<option value="">— chọn dự án —</option>' + open.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('') + '<option value="__new">＋ Dự án mới…</option>';
  }
  function openAssign(ctx) {
    if (!data.fitters.length) { toast('Hãy thêm fitter trước.'); openFitter(null); return; }
    asCtx = ctx;
    $('asTitle').textContent = ctx.edit ? 'Sửa phân công' : 'Phân công';
    $('asFitter').innerHTML = data.fitters.map(f => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('');
    $('asFitter').value = ctx.f || data.fitters[0].id;
    $('asProject').innerHTML = projectOptions(ctx.edit && ctx.edit.p);
    $('asProject').value = ctx.edit ? ctx.edit.p : (ui.lastProject && byId()[ui.lastProject] ? ui.lastProject : '');
    $('asNewWrap').hidden = true; $('asNewName').value = '';
    $('asFrom').value = ctx.from; $('asTo').value = ctx.to;
    document.querySelector(`input[name=asStatus][value="${ctx.edit && ctx.edit.t ? 1 : 0}"]`).checked = true;
    $('asSkipSun').checked = false;
    $('asClear').hidden = !ctx.edit && !rangeHasAlloc();
    assignWarn();
    $('dlgAssign').showModal();
    (ctx.edit ? $('asFrom') : $('asProject')).focus();
  }
  function rangeHasAlloc() {
    const m = data.alloc[$('asFitter').value] || {};
    const a = $('asFrom').value, b = $('asTo').value; if (!a || !b) return false;
    return P.daysBetween(a <= b ? a : b, a <= b ? b : a).some(d => m[d]);
  }
  function assignWarn() {
    const fid = $('asFitter').value, m = data.alloc[fid] || {}, pm = byId();
    let a = $('asFrom').value, b = $('asTo').value, msg = '';
    if (a && b) {
      if (a > b) [a, b] = [b, a];
      const n = P.daysBetween(a, b).length;
      if (n > 366) msg = 'Khoảng ngày quá dài (tối đa 1 năm).';
      else {
        const pid = $('asProject').value, t = document.querySelector('input[name=asStatus]:checked').value === '1';
        const own = asCtx && asCtx.edit && fid === asCtx.f ? new Set(P.daysBetween(asCtx.edit.from, asCtx.edit.to)) : new Set();
        const over = {};
        P.daysBetween(a, b).forEach(d => { const v = m[d]; if (v && !own.has(d) && !(v.p === pid && !!v.t === t) && pm[v.p]) over[pm[v.p].name] = (over[pm[v.p].name] || 0) + 1; });
        const k = Object.keys(over);
        if (k.length) msg = `Sẽ thay phân công đang có: ${k.map(x => `${x} (${over[x]} ngày)`).join(', ')}.`;
      }
    }
    $('asWarn').textContent = msg;
    $('asClear').hidden = !(asCtx && asCtx.edit) && !rangeHasAlloc();
  }
  ['asFitter', 'asFrom', 'asTo', 'asProject'].forEach(id => $(id).addEventListener('change', assignWarn));
  document.querySelectorAll('input[name=asStatus]').forEach(r => r.addEventListener('change', assignWarn));
  $('asProject').addEventListener('change', () => { const n = $('asProject').value === '__new'; $('asNewWrap').hidden = !n; if (n) $('asNewName').focus(); });
  $('asCancel').addEventListener('click', () => $('dlgAssign').close());
  $('formAssign').addEventListener('submit', (e) => {
    e.preventDefault();
    const fid = $('asFitter').value;
    let a = $('asFrom').value, b = $('asTo').value;
    if (!a || !b) { $('asWarn').textContent = 'Chọn ngày bắt đầu và kết thúc.'; return; }
    if (a > b) [a, b] = [b, a];
    if (P.daysBetween(a, b).length > 366) { $('asWarn').textContent = 'Khoảng ngày quá dài (tối đa 1 năm).'; return; }
    let pid = $('asProject').value;
    const newName = $('asNewName').value.trim();
    if (!pid || (pid === '__new' && !newName)) { $('asWarn').textContent = pid === '__new' ? 'Nhập tên dự án mới.' : 'Chọn dự án.'; (pid === '__new' ? $('asNewName') : $('asProject')).focus(); return; }
    const t = document.querySelector('input[name=asStatus]:checked').value === '1';
    const skip = $('asSkipSun').checked;
    const fname = data.fitters.find(f => f.id === fid).name;
    commit(null, () => {
      if (pid === '__new') { const p = P.newProject({ name: newName }); data.projects.push(p); P.assignColors(data.projects); pid = p.id; }
      const m = data.alloc[fid] || (data.alloc[fid] = {});
      if (asCtx.edit) { const om = data.alloc[asCtx.f] || {}; P.daysBetween(asCtx.edit.from, asCtx.edit.to).forEach(d => { delete om[d]; }); }
      P.daysBetween(a, b).forEach(d => { if (skip && offDay(d)) { delete m[d]; return; } m[d] = t ? { p: pid, t: 1 } : { p: pid }; });
    });
    ui.lastProject = pid;
    $('dlgAssign').close();
    const pname = byId()[pid].name;
    toastUndoLast(`Đã phân công ${fname} → ${pname} (${dm(a)} – ${dm(b)}${t ? ', dự kiến' : ''}).`);
  });
  $('asClear').addEventListener('click', () => {
    const fid = $('asFitter').value;
    let a = $('asFrom').value, b = $('asTo').value; if (a > b) [a, b] = [b, a];
    const ed = asCtx.edit;
    const fname = data.fitters.find(f => f.id === fid).name;
    commit(null, () => {
      const m = data.alloc[fid] || {};
      if (ed) { const om = data.alloc[asCtx.f] || {}; P.daysBetween(ed.from, ed.to).forEach(d => { delete om[d]; }); }
      else P.daysBetween(a, b).forEach(d => { delete m[d]; });
    });
    $('dlgAssign').close();
    toastUndoLast(`Đã bỏ trống ${fname} ${ed ? `${dm(ed.from)} – ${dm(ed.to)}` : `${dm(a)} – ${dm(b)}`}.`);
  });
  // commit(null, …) không hiện thông báo → hiện thông báo riêng nhưng vẫn hoàn tác được thay đổi vừa rồi
  function toastUndoLast(msg) {
    const snap = lastSnap;
    toast(msg, { label: 'Hoàn tác', run: () => { data = JSON.parse(snap); save(); render(); toast('Đã hoàn tác.'); } });
  }

  // ---------- fitter ----------
  let ftId = null;
  function linkText() {
    const id = $('ftEmp').value, e = id ? eeById(id) : null;
    if (e) return `Đã liên kết: ${e.fullName} · ${e.empId} · ${e.position}`;
    if (id) return EE.length ? `Mã ${id} không còn trong dữ liệu nhân sự (đã nghỉ / đổi mã?).` : `Mã NV ${id}.`;
    const n = P.plain($('ftName').value);
    const cand = n ? EE.filter(x => FITTER_RE.test(P.plain(x.position)) && (' ' + P.plain(x.fullName) + ' ').endsWith(' ' + n + ' ')) : [];
    return cand.length === 1 ? `SUGGEST:${cand[0].empId}` : 'Chưa liên kết với dữ liệu nhân sự (không bắt buộc).';
  }
  function showLink() {
    const t = linkText();
    if (t.startsWith('SUGGEST:')) {
      const e = eeById(t.slice(8));
      $('ftLink').innerHTML = `Có thể là <b>${esc(e.fullName)}</b> (${esc(e.empId)}) — <button type="button" class="lnk" id="ftUse">Liên kết</button>`;
    } else $('ftLink').textContent = t;
  }
  function openFitter(id) {
    ftId = id;
    const f = data.fitters.find(x => x.id === id);
    $('ftTitle').textContent = f ? 'Sửa fitter' : 'Thêm fitter';
    $('ftName').value = f ? f.name : ''; $('ftEmp').value = f ? f.empId || '' : '';
    const e = f && f.empId ? eeById(f.empId) : null;
    $('ftEE').value = e ? `${e.fullName} · ${e.empId}` : (f && f.empId ? f.empId : '');
    $('ftDelete').hidden = $('ftUp').hidden = $('ftDown').hidden = !f;
    const n = f ? Object.keys(data.alloc[f.id] || {}).length : 0;
    $('ftStats').textContent = f ? `${n} ngày đã phân công.` : '';
    showLink();
    $('dlgFitter').showModal(); $('ftName').focus();
  }
  $('ftEE').addEventListener('input', () => {
    const v = $('ftEE').value.trim(), m = v.match(/·\s*([^·]+)$/);
    const e = m ? eeById(m[1].trim()) : (eeById(v) || null);
    $('ftEmp').value = e ? e.empId : (v ? v : '');
    if (e && !$('ftName').value.trim()) $('ftName').value = e.fullName;
    showLink();
  });
  $('ftName').addEventListener('input', showLink);
  $('ftLink').addEventListener('click', (ev) => {
    if (!ev.target.closest('#ftUse')) return;
    const e = eeById(linkText().slice(8)); if (!e) return;
    $('ftEmp').value = e.empId; $('ftEE').value = `${e.fullName} · ${e.empId}`; showLink();
  });

  // ---------- thêm fitter từ dữ liệu nhân sự ----------
  function renderEEList() {
    const q = P.plain($('eeSearch').value), all = $('eeAll').checked;
    const used = new Set(data.fitters.map(f => P.plain(f.empId)).filter(Boolean));
    const list = EE.filter(e => (all || FITTER_RE.test(P.plain(e.position))) && !used.has(P.plain(e.empId)) &&
      (!q || P.plain(`${e.fullName} ${e.empId} ${e.position} ${e.supervisor || ''}`).includes(q)))
      .sort((a, b) => String(a.fullName).localeCompare(String(b.fullName), 'vi')).slice(0, 300);
    $('eeList').innerHTML = list.length ? list.map(e => `<label class="ee-row"><input type="checkbox" value="${esc(e.empId)}"><span>${esc(e.fullName)}</span><span class="sub">${esc(e.empId)} · ${esc(e.position)}</span></label>`).join('')
      : `<p class="hint" style="padding:10px">${EE.length ? 'Không có nhân viên phù hợp (hoặc đã có trong danh sách).' : 'Máy chưa có dữ liệu nhân sự — bấm “Đồng bộ” ở dòng Dữ liệu dùng chung.'}</p>`;
    $('eeHint').textContent = `${list.length} nhân viên${list.length === 300 ? ' (gõ để lọc thêm)' : ''}.`;
  }
  $('addFromEE').addEventListener('click', () => { $('eeSearch').value = ''; renderEEList(); $('dlgEE').showModal(); $('eeSearch').focus(); });
  ['eeSearch', 'eeAll'].forEach(id => $(id).addEventListener('input', renderEEList));
  $('eeCancel').addEventListener('click', () => $('dlgEE').close());
  $('formEE').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const ids = [...document.querySelectorAll('#eeList input:checked')].map(x => x.value);
    if (!ids.length) { $('eeHint').textContent = 'Chọn ít nhất một nhân viên.'; return; }
    commit(`Đã thêm ${ids.length} fitter từ dữ liệu nhân sự.`, () => {
      ids.forEach(id => { const e = eeById(id); if (!e) return; const nf = { id: P.uid('f'), name: e.fullName, empId: e.empId }; data.fitters.push(nf); data.alloc[nf.id] = {}; });
    });
    $('dlgEE').close();
  });
  $('ftCancel').addEventListener('click', () => $('dlgFitter').close());
  $('formFitter').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('ftName').value.trim(); if (!name) return;
    const emp = $('ftEE').value.trim() ? $('ftEmp').value.trim() : '';
    commit(ftId ? 'Đã lưu fitter.' : `Đã thêm fitter ${name}.`, () => {
      const f = data.fitters.find(x => x.id === ftId);
      if (f) { f.name = name; f.empId = emp; } else { const nf = { id: P.uid('f'), name, empId: emp }; data.fitters.push(nf); data.alloc[nf.id] = {}; }
    });
    $('dlgFitter').close();
  });
  $('ftDelete').addEventListener('click', () => {
    const f = data.fitters.find(x => x.id === ftId); if (!f) return;
    const n = Object.keys(data.alloc[f.id] || {}).length;
    if (n && !confirm(`Xóa ${f.name} và ${n} ngày đã phân công?`)) return;
    commit(`Đã xóa fitter ${f.name}.`, () => { data.fitters = data.fitters.filter(x => x.id !== f.id); delete data.alloc[f.id]; });
    $('dlgFitter').close();
  });
  const move = (dir) => {
    const i = data.fitters.findIndex(x => x.id === ftId), j = i + dir;
    if (i < 0 || j < 0 || j >= data.fitters.length) return;
    commit(null, () => { const a = data.fitters; [a[i], a[j]] = [a[j], a[i]]; });
  };
  $('ftUp').addEventListener('click', () => move(-1));
  $('ftDown').addEventListener('click', () => move(1));

  // ================= LỊCH TRÌNH DỰ ÁN =================
  const LATE_KEYS = ['factory', 'port', 'arrival', 'shaftReady', 'ownerStart', 'teamStart'];
  function alertsOf(p, t) {
    const out = [];
    P.MILESTONES.forEach(m => { if (p[m.key].check) out.push({ c: 'bad', s: `Kiểm tra ngày ${m.short}` }); });
    if (p.done) return out;
    const late = LATE_KEYS.filter(k => p[k].date && !p[k].done && p[k].date < t).map(k => P.MILESTONES.find(m => m.key === k).short);
    if (late.length) out.push({ c: 'warn', s: `Đã qua ngày, chưa xác nhận: ${late.join(', ')}` });
    const ts = p.teamStart.date, sr = p.shaftReady.date, ar = p.arrival.date;
    if (ts && !p.teamStart.done && ts >= P.addDays(t, -7) && ts <= P.addDays(t, 14) && !projectRuns(p.id, P.addDays(ts, -3), P.addDays(ts, 14)).length)
      out.push({ c: 'bad', s: `Chưa phân công fitter cho ngày nhận hố ${dm(ts)}` });
    if (ts && sr && ts < sr) out.push({ c: 'warn', s: `Nhận hố (${dm(ts)}) trước khi XD giao hố (${dm(sr)})` });
    if (ts && ar && !p.arrival.done && ar > ts) out.push({ c: 'warn', s: `Hàng về (${dm(ar)}) sau ngày nhận hố (${dm(ts)})` });
    return out;
  }
  function msCell(m, t) {
    if (!m) return '<dd>—</dd>';
    if (m.check) return `<dd class="chk" title="Ngày có thể nhập nhầm định dạng">⚠ ${P.fmtVN(m.date)}</dd>`;
    if (m.done) return `<dd class="done">✓ ${m.date ? dm(m.date) : 'xong'}${m.note && !m.date ? '' : ''}</dd>`;
    if (m.date) { const c = m.date < t ? 'late' : m.date <= P.addDays(t, 7) ? 'soon' : ''; return `<dd class="${c}">${P.fmtVN(m.date)}${m.note ? ` <span class="sub">· ${esc(m.note)}</span>` : ''}</dd>`; }
    if (m.note) return `<dd class="note">${esc(m.note)}</dd>`;
    return '<dd>—</dd>';
  }
  const msDl = (p, keys, t) => `<dl class="ms">${keys.map(k => { const m = P.MILESTONES.find(x => x.key === k); return `<dt>${m.short}</dt>${msCell(p[k], t)}`; }).join('')}</dl>`;
  function nextDate(p, t) { const ds = P.MILESTONES.map(m => p[m.key]).filter(m => m.date && !m.done).map(m => m.date).sort(); return ds.find(d => d >= t) || ds[0] || '9999'; }
  function fittersOf(p, t) {
    const runs = projectRuns(p.id, P.addDays(t, -14), P.addDays(t, 60));
    const by = {}; runs.forEach(r => { (by[r.f.id] = by[r.f.id] || { f: r.f, from: r.from, to: r.to, t: r.t }); by[r.f.id].to = r.to; });
    return Object.values(by).map(x => `<span class="fit" title="${esc(`${P.fmtVN(x.from)} – ${P.fmtVN(x.to)}`)}">${esc(x.f.name)} ${dm(x.from)}–${dm(x.to)}${x.t ? ' (dk)' : ''}</span>`).join('');
  }

  function renderPlan() {
    const t = today(), q = P.plain($('planSearch').value), st = $('planStatus').value, sup = $('planSup').value;
    const sups = [...new Set(data.projects.map(p => (p.supervisor || '').trim()).filter(Boolean).map(s => s.replace(/\s+/g, ' ')))];
    const supKey = (s) => P.plain(s);
    const uniq = []; sups.forEach(s => { if (!uniq.some(u => supKey(u) === supKey(s))) uniq.push(s); });
    $('planSup').innerHTML = '<option value="">Tất cả</option>' + uniq.sort((a, b) => a.localeCompare(b, 'vi')).map(s => `<option value="${esc(supKey(s))}">${esc(s)}</option>`).join('');
    $('planSup').value = uniq.some(s => supKey(s) === sup) ? sup : '';
    const list = data.projects.filter(p => (st === 'all' || (st === 'done' ? p.done : !p.done)) &&
      (!$('planSup').value || supKey(p.supervisor) === $('planSup').value) &&
      (!q || P.plain([p.name, p.address, p.supervisor, p.teamPlan, p.note, p.wbs, (p.aliases || []).join(' ')].join(' ')).includes(q)))
      .sort((a, b) => (a.fromGrid - b.fromGrid) || nextDate(a, t).localeCompare(nextDate(b, t)) || a.name.localeCompare(b.name, 'vi'));

    // sắp tới 14 ngày + đã qua chưa xác nhận
    const ev = [];
    data.projects.filter(p => !p.done).forEach(p => P.MILESTONES.forEach(m => {
      const v = p[m.key];
      if (v.date && !v.done && v.date <= P.addDays(t, 14) && (v.date >= t || LATE_KEYS.includes(m.key))) ev.push({ p, m, d: v.date, late: v.date < t });
    }));
    ev.sort((a, b) => (b.late - a.late) || a.d.localeCompare(b.d));
    const lateN = ev.filter(e => e.late).length;
    $('upcoming').innerHTML = `<h2>Sắp tới 14 ngày${lateN ? ` · <span class="badge warn">${lateN} mốc đã qua chưa xác nhận</span>` : ''}</h2>` +
      (ev.length ? `<ul class="up-list">${ev.slice(0, 16).map(e => `<li class="${e.late ? 'late' : ''}"><span class="ud">${dm(e.d)}</span><span><span class="up-p" data-p="${esc(e.p.id)}">${esc(e.p.name)}</span> · ${e.m.short}</span></li>`).join('')}</ul>` +
        (ev.length > 16 ? `<p class="sub">… và ${ev.length - 16} mốc khác</p>` : '') : '<p class="sub">Không có mốc nào trong 14 ngày tới.</p>');

    const liftInfo = (p) => [p.travel, p.load !== '' && p.load != null ? (typeof p.load === 'number' ? p.load + 'kg' : p.load) : '', p.stops ? p.stops + ' điểm dừng' : ''].filter(Boolean).join(' · ');
    const badges = (p) => (p.province ? '<span class="badge">Tỉnh</span>' : '') + (p.fromGrid ? '<span class="badge" title="Tên ngắn trong sheet Nhân sự, chưa có trong Plan">Chỉ có trong lưới nhân sự</span>' : '') + (p.done ? '<span class="badge ok">Hoàn thành</span>' : '');
    const alertHtml = (p) => alertsOf(p, t).map(a => `<span class="badge ${a.c}">${esc(a.s)}</span>`).join('');
    const gv = ui.planView === 'gantt';
    $('planViewList').setAttribute('aria-pressed', String(!gv)); $('planViewGantt').setAttribute('aria-pressed', String(gv));
    $('planList').hidden = gv; $('planGantt').hidden = !gv; $('upcoming').hidden = gv;
    $('planMine').hidden = !data.projects.some(isMine);
    if (gv) { if (list.length) renderGantt(list.filter(p => !p.fromGrid || p.wbs || P.MILESTONES.some(m => p[m.key].date))); else $('planGantt').innerHTML = '<p class="pp-empty">Không có dự án phù hợp.</p>'; return; }
    if (!list.length) { $('planList').innerHTML = '<p class="pp-empty">Không có dự án phù hợp.</p>'; return; }
    let h = `<table class="pl"><thead><tr><th>Dự án</th><th>Thang</th><th>Hàng</th><th>Lắp đặt</th><th>Nhân sự</th><th>Giám sát · cảnh báo</th></tr></thead><tbody>`;
    const gridOnly = list.filter(p => p.fromGrid).length;
    const grpRow = `<tr class="grp"><td colspan="6"><b>Tên chỉ có trong lưới nhân sự (${gridOnly})</b> — chưa có trong sheet Plan: bấm để bổ sung thông tin, hoặc gộp vào dự án đúng.</td></tr>`;
    list.forEach((p, i) => {
      if (p.fromGrid && (i === 0 || !list[i - 1].fromGrid)) h += grpRow;
      h += `<tr class="row" data-p="${esc(p.id)}" tabindex="0">
        <td><div class="pn"><i class="sw" style="background:${safeColor(p.color)}"></i>${esc(p.name)}</div><div class="sub">${esc(p.address)}${p.wbs ? ` · <span class="${SHARED.length && !sharedByWbs(p.wbs) ? 'badge warn' : ''}" title="${SHARED.length && !sharedByWbs(p.wbs) ? 'WBS không có trong danh sách dự án chung' : 'WBS'}">${esc(p.wbs)}</span>` : ''}</div>${badges(p)}</td>
        <td>${p.liftCount ? `<b>${esc(p.liftCount)} × ${esc(p.liftType)}</b>` : esc(p.liftType)}<div class="sub">${esc(liftInfo(p))}</div></td>
        <td>${msDl(p, ['factory', 'port', 'arrival'], t)}${p.transport ? `<div class="sub">${esc(p.transport)}</div>` : ''}</td>
        <td>${msDl(p, ['shaftReady', 'ownerStart', 'teamStart', 'handover'], t)}</td>
        <td>${p.teamPlan ? `<div>${esc(p.teamPlan)}</div>` : ''}${fittersOf(p, t)}</td>
        <td>${esc(p.supervisor)}<div class="alerts">${alertHtml(p)}</div></td></tr>`;
    });
    h += '</tbody></table><div class="pl-cards">';
    list.forEach((p, i) => {
      if (p.fromGrid && (i === 0 || !list[i - 1].fromGrid)) h += `<p class="grp-card"><b>Tên chỉ có trong lưới nhân sự (${gridOnly})</b> — bấm để bổ sung thông tin hoặc gộp.</p>`;
      h += `<div class="pl-card" data-p="${esc(p.id)}" tabindex="0" role="button"><div class="pn"><i class="sw" style="background:${safeColor(p.color)}"></i>${esc(p.name)}</div>
        <div class="sub">${esc(p.address)}${p.supervisor ? ' · GS: ' + esc(p.supervisor) : ''}</div>${badges(p)}
        <div class="sub">${p.liftCount ? esc(p.liftCount) + ' × ' + esc(p.liftType) + ' · ' : ''}${esc(liftInfo(p))}</div>
        ${msDl(p, ['arrival', 'shaftReady', 'teamStart', 'handover'], t)}
        <div>${p.teamPlan ? esc(p.teamPlan) + ' ' : ''}${fittersOf(p, t)}</div><div class="alerts">${alertHtml(p)}</div></div>`;
    });
    $('planList').innerHTML = h + '</div>';
  }

  // ---------- lịch trình dạng Gantt (giám sát xem lại nhanh) ----------
  ui.planView = ui.planView || 'list';
  const ganttSpan = () => ({ from: P.addDays(today(), -30), to: P.addDays(today(), 150) });
  function renderGantt(list) {
    const t = today(), sp = ganttSpan(), days = P.daysBetween(sp.from, sp.to), PX = 6;      // 6 px / ngày
    const idx = (d) => dayDiff(sp.from, d) * PX;
    const W = days.length * PX, nameW = window.innerWidth < 600 ? 130 : 220;
    const months = []; days.forEach(d => { const k = d.slice(0, 7), l = months[months.length - 1]; if (l && l.k === k) l.n++; else months.push({ k, n: 1 }); });
    const pmv = (p, k) => (p[k] && p[k].date) || '';
    const clip = (a, b) => (!a || !b || b < sp.from || a > sp.to) ? null : { a: a > sp.from ? a : sp.from, b: b < sp.to ? b : sp.to };
    let h = `<div class="gt-legend"><span><i style="background:#94a3b8"></i>Hàng (xuất xưởng → hàng về)</span><span><i style="background:var(--blue)"></i>Lắp đặt (nhận hố → bàn giao)</span><span><i style="background:#059669"></i>Fitter được phân công</span><span>◇ mốc (đặc = đã xong, đỏ = quá hạn chưa xác nhận)</span><span style="color:var(--red)">| hôm nay</span></div>`;
    h += `<div class="gt-scroll"><table class="gt" style="width:${nameW + W}px"><colgroup><col style="width:${nameW}px"><col style="width:${W}px"></colgroup><thead><tr><th class="name">Dự án (${list.length})</th><th><div style="display:flex">${months.map(m => `<span style="width:${m.n * PX}px;overflow:hidden;white-space:nowrap;border-left:1px solid #e5e7eb;padding-left:3px">${Number(m.k.slice(5))}/${m.k.slice(2, 4)}</span>`).join('')}</div></th></tr></thead><tbody>`;
    list.forEach(p => {
      const goodsA = pmv(p, 'factory') || pmv(p, 'port') || pmv(p, 'arrival'), goodsB = pmv(p, 'arrival') || pmv(p, 'port') || pmv(p, 'factory');
      const instA = pmv(p, 'teamStart') || pmv(p, 'ownerStart') || pmv(p, 'shaftReady'), instB = pmv(p, 'handover') || (instA ? P.addDays(instA, 30) : '');
      const segs = [];
      const g = clip(goodsA, goodsB < goodsA ? goodsA : goodsB), ins = clip(instA, instB < instA ? instA : instB);
      if (g) segs.push(`<span class="seg goods" style="left:${idx(g.a)}px;width:${Math.max(PX, idx(g.b) - idx(g.a) + PX)}px"></span>`);
      if (ins) segs.push(`<span class="seg inst" style="left:${idx(ins.a)}px;width:${Math.max(PX, idx(ins.b) - idx(ins.a) + PX)}px;background:${safeColor(p.color)}"></span>`);
      const runs = projectRuns(p.id, sp.from, sp.to);
      if (runs.length) { const a = runs.reduce((m, r) => (r.from < m ? r.from : m), runs[0].from), b = runs.reduce((m, r) => (r.to > m ? r.to : m), runs[0].to); segs.push(`<span class="seg crew" style="left:${idx(a)}px;width:${idx(b) - idx(a) + PX}px" title="Fitter: ${esc([...new Set(runs.map(r => r.f.name))].join(', '))}"></span>`); }
      P.MILESTONES.forEach(m => {
        const v = p[m.key]; if (!v || !v.date || v.date < sp.from || v.date > sp.to) return;
        const late = !v.done && v.date < t && LATE_KEYS.includes(m.key);
        segs.push(`<span class="mk${v.done ? ' done' : ''}${late ? ' late' : ''}" style="left:${idx(v.date) + PX / 2}px" title="${esc(`${m.label}: ${P.fmtVN(v.date)}${v.done ? ' (đã xong)' : ''}`)}"></span>`);
      });
      h += `<tr data-p="${esc(p.id)}"><td class="name" tabindex="0" data-p="${esc(p.id)}"><b>${esc(p.name)}</b><small>${esc([p.supervisor, p.liftCount ? p.liftCount + ' × ' + (p.liftType || 'thang') : p.liftType].filter(Boolean).join(' · '))}</small></td><td><div class="tl">${segs.join('')}</div></td></tr>`;
    });
    h += `</tbody></table></div>`;
    $('planGantt').innerHTML = h;
    const tbl = $('planGantt').querySelector('.gt'), line = document.createElement('div');
    line.className = 'today-line'; line.style.left = (nameW + idx(t) + PX / 2) + 'px'; line.style.top = '0'; line.style.height = tbl.offsetHeight + 'px';
    tbl.appendChild(line);
    const sc = $('planGantt').querySelector('.gt-scroll'); sc.scrollLeft = Math.max(0, idx(t) - 160);
  }
  function setPlanView(v) { ui.planView = v; saveUI(); render(); }
  $('planViewList').addEventListener('click', () => setPlanView('list'));
  $('planViewGantt').addEventListener('click', () => setPlanView('gantt'));
  $('planGantt').addEventListener('click', (e) => { const r = e.target.closest('td.name[data-p]'); if (r) openProject(r.dataset.p); });
  // Site Sup: mặc định xem dự án mình giám sát
  const myName = () => { const s = typeof Session !== 'undefined' ? Session.current() : null; return s && s.name ? P.plain(s.name) : ''; };
  const isMine = (p) => { const n = myName(); return !!n && !!p.supervisor && (P.plain(p.supervisor) === n || n.endsWith(' ' + P.plain(p.supervisor)) || P.plain(p.supervisor).endsWith(' ' + n)); };
  $('planMine').addEventListener('click', () => {
    const mine = data.projects.find(isMine); if (!mine) { toast('Không thấy dự án nào ghi giám sát là tên của bạn.'); return; }
    $('planSup').value = P.plain(mine.supervisor); renderPlan();
  });

  $('planList').addEventListener('click', (e) => { const r = e.target.closest('[data-p]'); if (r) openProject(r.dataset.p); });
  $('planList').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-p]')) openProject(e.target.dataset.p); });
  $('upcoming').addEventListener('click', (e) => { const r = e.target.closest('[data-p]'); if (r) openProject(r.dataset.p); });
  ['planSearch', 'planStatus', 'planSup'].forEach(id => $(id).addEventListener('input', renderPlan));


  // ================= THỰC TẾ & BÁM KẾ HOẠCH =================
  // Đối chiếu lưới điều phối với bảng "Theo dõi giờ công" (cùng dữ liệu của Thống kê giờ công; bản Cloudflare gồm cả
  // bảng công nhân viên tự nộp sau khi được duyệt). Mỗi fitter phải được liên kết mã NV (EE Data) và mỗi dự án có WBS.
  const A = window.PlanActual;
  let act = { month: today().slice(0, 7), rows: null, loadedMonth: '', tried: false };
  ui.actMode = ui.actMode || 'compare';
  const monthDays = (m) => { const a = m + '-01'; let b = a; while (P.addDays(b, 1).slice(0, 7) === m) b = P.addDays(b, 1); return P.daysBetween(a, b); };
  const shiftMonth = (m, n) => { const [y, mo] = m.split('-').map(Number); const d = new Date(Date.UTC(y, mo - 1 + n, 1)); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1); };
  const pctCls = (v) => (v == null ? '' : v >= 90 ? 'g' : v >= 70 ? 'a' : 'r');
  const pctTxt = (v) => (v == null ? '—' : String(v).replace('.', ',') + '%');
  const wbsMap = () => { const m = {}; data.projects.forEach(p => { if (p.wbs) m[A.norm(p.wbs)] = p; }); return m; };

  async function loadActualRows(force) {
    if (typeof DB === 'undefined') { act.rows = []; return; }
    if (force && typeof Cloud !== 'undefined' && Cloud.configured() && navigator.onLine !== false) {
      try { await Cloud.loadFromDrive({ timesheets: true }); } catch (e) { toast('Chưa tải được bảng công mới nhất: ' + e.message); }
    }
    try { act.rows = await DB.getAll('timesheets'); } catch (e) { act.rows = []; }
    act.loadedMonth = act.month;
  }
  async function renderActual() {
    const myMonth = act.month;
    if (act.rows === null) { $('actInfo').innerHTML = '<span class="dot busy"></span><span>Đang đọc bảng công trên máy…</span>'; await loadActualRows(false); if (myMonth !== act.month) return; }
    const days = monthDays(act.month), from = days[0], to = days[days.length - 1];
    $('actMode').value = ui.actMode;
    $('actLabel').textContent = `Tháng ${Number(act.month.slice(5))}/${act.month.slice(0, 4)}`;
    const inMonth = act.rows.filter(r => r.date >= from && r.date <= to).length;
    const linked = data.fitters.filter(f => f.empId).length;
    const hours = A.hoursByDay(act.rows, from, to);
    const res = A.compare({ data, hours, days, offDay });
    const T = res.totals, t = today();
    $('actInfo').innerHTML = `<span class="dot ${inMonth ? 'ok' : 'warn'}"></span><span>Bảng công trên máy: <b>${act.rows.length.toLocaleString('vi-VN')}</b> dòng · tháng này <b>${inMonth.toLocaleString('vi-VN')}</b> dòng · fitter đã liên kết mã NV: <b>${linked}/${data.fitters.length}</b></span>`;
    if (!data.fitters.length) { $('actSummary').innerHTML = ''; $('actTable').innerHTML = ''; $('actTables').innerHTML = '<p class="pp-empty">Chưa có fitter nào.</p>'; return; }
    $('actSummary').innerHTML = (T.n
      ? `<span class="chip">Bám kế hoạch: <b class="pct ${pctCls(T.pct)}">${pctTxt(T.pct)}</b> (${T.ok}/${T.n} ngày công theo kế hoạch)</span>` +
        `<span class="chip">Làm đúng dự án: <b>${T.ok}</b></span><span class="chip">Làm dự án khác: <b>${T.diff}</b></span><span class="chip ${T.miss ? 'warn' : ''}">Không chấm công: <b>${T.miss}</b></span>` +
        `<span class="chip">Ngoài kế hoạch: <b>${T.extra}</b> ngày</span><span class="chip">Giờ đúng kế hoạch: <b>${pctTxt(T.util)}</b></span>`
      : `<span class="chip warn">Chưa đối chiếu được: ${!inMonth ? 'tháng này chưa có dữ liệu chấm công (bấm “Tải bảng công mới nhất”)' : !linked ? 'chưa có fitter nào liên kết mã nhân viên' : 'chưa có phân công chính thức gắn WBS trong tháng này'}.</span>`)
      + (T.nolink ? `<span class="chip warn" title="Dự án trong kế hoạch chưa có WBS nên không đối chiếu được">${T.nolink} ngày thuộc dự án chưa có WBS</span>` : '');
    const wm = wbsMap(), nameW = window.innerWidth < 600 ? 112 : 170, CW = 30;
    $('actTable').style.width = (nameW + days.length * CW) + 'px';
    const dcls = (d) => [wd(d) === 0 ? 'sun' : '', holiday(d) ? 'hol' : '', d === t ? 'today' : ''].filter(Boolean).join(' ');
    let h = `<colgroup><col style="width:${nameW}px">${days.map(() => `<col style="width:${CW}px">`).join('')}</colgroup><thead><tr><th class="name" scope="col">Fitter (${data.fitters.length})</th>${days.map(d => {
      const hol = holiday(d);
      return `<th class="day ${dcls(d)}" scope="col" title="${esc(`${WD[wd(d)]} ${P.fmtVN(d)}${hol ? ' — ' + hol.name : ''}`)}"><span class="dw">${WD[wd(d)]}</span><span class="dd">${Number(d.slice(8))}</span></th>`;
    }).join('')}</tr></thead><tbody>`;
    const pm = byId();
    res.fitters.forEach(r => {
      const sub = !r.linked ? '<span class="warn">chưa liên kết mã NV</span>' : `${r.actualHours ? Math.round(r.actualHours) + 'h thực tế' : 'chưa có chấm công'}${r.pct != null ? ` · <b class="pct ${pctCls(r.pct)}">${pctTxt(r.pct)}</b>` : ''}`;
      h += `<tr><td class="name"><span class="nm">${esc(r.name)}</span><span class="nd">${sub}</span></td>`;
      if (ui.actMode === 'gantt') {
        const runs = A.actualRuns(r, days, wm).map(x => ({ x, p: x.project }));
        for (let i = 0; i < days.length;) {
          const run = runs.find(z => z.x.startIdx === i);
          if (!run) { h += `<td class="${dcls(days[i])}"></td>`; i++; continue; }
          const n = run.x.endIdx - run.x.startIdx + 1, p = run.p, col = p ? p.color : '#cbd5e1';
          const title = `${p ? p.name : 'WBS ' + run.x.wbs} · ${r.name} · ${P.fmtVN(days[run.x.startIdx])} – ${P.fmtVN(days[run.x.endIdx])} · ${Math.round(run.x.hours * 10) / 10}h`;
          h += `<td class="act" colspan="${n}" title="${esc(title)}"><span style="background:${safeColor(col)};color:${textOn(col)}">${n > 1 ? esc(p ? p.name : run.x.wbs) : ''}</span></td>`;
          i += n;
        }
      } else {
        days.forEach(d => {
          const c = r.days[d], plan = c.plan && pm[c.plan.p], mark = { ok: '✓', diff: '≠', miss: '✗', extra: '+', tent: '·', nolink: '?' }[c.st] || '';
          const actTxt = c.act ? Object.keys(c.act.byWbs).map(w => `${(wm[w] ? wm[w].name : 'WBS ' + w)} ${Math.round(c.act.byWbs[w] * 10) / 10}h`).join(', ') : 'không chấm công';
          const title = `${P.fmtVN(d)} · ${r.name}\nKế hoạch: ${plan ? plan.name + (c.plan.t ? ' (dự kiến)' : '') : '—'}\nThực tế: ${actTxt}`;
          h += `<td class="cmp ${c.st} ${dcls(d)}" title="${esc(title)}">${mark}${plan ? `<i style="background:${safeColor(plan.color)}"></i>` : ''}</td>`;
        });
      }
      h += '</tr>';
    });
    $('actTable').innerHTML = h + '</tbody>';
    $('actLegend').innerHTML = ui.actMode === 'gantt'
      ? 'Mỗi dải = số ngày liên tiếp fitter chấm công cho cùng một dự án (theo WBS trong bảng công). Dải xám = WBS chưa có trong danh sách dự án của kế hoạch.'
      : '<b>✓</b> đúng dự án theo kế hoạch · <b>≠</b> làm dự án khác · <b>✗</b> kế hoạch có nhưng không chấm công · <b>+</b> làm ngoài kế hoạch · <b>·</b> kế hoạch dự kiến (không tính %) · <b>?</b> dự án chưa có WBS. Gạch màu dưới ô = dự án trong kế hoạch.';

    const row = (r, nameCol) => `<tr><td>${esc(nameCol)}</td><td>${r.n}</td><td>${r.ok}</td><td>${r.diff}</td><td>${r.miss}</td><td><b class="pct ${pctCls(r.pct)}">${pctTxt(r.pct)}</b></td><td>${pctTxt(r.util)}</td></tr>`;
    const head = (first) => `<thead><tr><th>${first}</th><th>Ngày KH</th><th>Đúng</th><th>Khác DA</th><th>Vắng</th><th>% bám KH</th><th>% giờ</th></tr></thead>`;
    const fitRows = res.fitters.filter(r => r.linked).map(r => ({ ...r, n: r.ok + r.diff + r.miss, util: r.util })).sort((a, b) => (a.pct == null) - (b.pct == null) || a.pct - b.pct);
    $('actTables').innerHTML =
      `<p class="act-note">% bám kế hoạch = ngày chấm công đúng dự án ÷ ngày có phân công chính thức (gắn WBS) ở các ngày làm việc. % giờ = giờ thực tế trên dự án đúng kế hoạch ÷ (8 giờ × ngày kế hoạch). Phân công dự kiến và ngày nghỉ không có người đi làm không bị tính.</p>` +
      `<table class="act-tbl"><caption>Đánh giá theo giám sát (hiệu quả bám kế hoạch)</caption>${head('Giám sát')}<tbody>${res.bySupervisor.map(r => row(r, r.label)).join('') || '<tr><td colspan="7">Chưa có dữ liệu đối chiếu.</td></tr>'}</tbody></table>` +
      `<table class="act-tbl"><caption>Theo dự án</caption>${head('Dự án')}<tbody>${res.byProject.map(r => row(r, r.label)).join('') || '<tr><td colspan="7">Chưa có dữ liệu đối chiếu.</td></tr>'}</tbody></table>` +
      `<table class="act-tbl"><caption>Theo fitter</caption>${head('Fitter')}<tbody>${fitRows.map(r => row(r, r.name)).join('') || '<tr><td colspan="7">Chưa có fitter liên kết mã NV.</td></tr>'}</tbody></table>`;
  }
  const actGo = (m) => { act.month = m; render(); };
  $('actPrev').addEventListener('click', () => actGo(shiftMonth(act.month, -1)));
  $('actNext').addEventListener('click', () => actGo(shiftMonth(act.month, 1)));
  $('actNow').addEventListener('click', () => actGo(today().slice(0, 7)));
  $('actMode').addEventListener('change', () => { ui.actMode = $('actMode').value; saveUI(); render(); });
  $('actLoad').addEventListener('click', async () => {
    const b = $('actLoad'); b.disabled = true; b.textContent = 'Đang tải…';
    await loadActualRows(true);
    b.disabled = false; b.textContent = '⟳ Tải bảng công mới nhất';
    toast(`Đã đọc ${act.rows.length.toLocaleString('vi-VN')} dòng bảng công.`);
    render();
  });

  // ---------- hộp thoại dự án ----------
  let pjId = null;
  const PJ_TEXT = ['name', 'address', 'wbs', 'liftType', 'travel', 'transport', 'teamPlan', 'supervisor', 'note'];
  function openProject(id) {
    pjId = id;
    const p = data.projects.find(x => x.id === id) || P.newProject();
    $('pjTitle').textContent = id ? 'Dự án' : 'Thêm dự án';
    PJ_TEXT.forEach(k => { $('pj_' + k).value = p[k] || ''; });
    $('pj_liftCount').value = p.liftCount === '' || p.liftCount == null ? '' : p.liftCount;
    $('pj_stops').value = p.stops === '' || p.stops == null ? '' : p.stops;
    $('pj_load').value = p.load === '' || p.load == null ? '' : p.load;
    $('pj_province').value = p.province === true ? '1' : p.province === false ? '0' : '';
    $('pj_color').value = safeColor(p.color || '#66ccff');
    $('pj_done').checked = !!p.done;
    $('pjMilestones').innerHTML = P.MILESTONES.map(m => {
      const v = p[m.key] || P.emptyMs();
      return `<div class="msr" data-k="${m.key}"><span class="msl">${m.label}</span>
        <input type="date" class="msd" value="${esc(v.date)}" aria-label="${esc(m.label + ' — ngày')}">
        <label class="chk"><input type="checkbox" class="msx"${v.done ? ' checked' : ''}> Đã xong</label>
        <input type="text" class="msn" value="${esc(v.note)}" placeholder="Ghi chú (vd. theo lịch hàng về)" aria-label="${esc(m.label + ' — ghi chú')}">
        ${v.check ? `<span class="msc">⚠ Excel hiển thị khác ngày đang lưu — có thể là ${P.fmtVN(v.check)}. <button type="button" data-use="${esc(v.check)}">Dùng ${P.fmtVN(v.check)}</button> · <button type="button" data-keep="1">Giữ ${P.fmtVN(v.date)}</button></span>` : ''}</div>`;
    }).join('');
    const runs = id ? projectRuns(id) : [];
    $('pjAllocated').textContent = runs.length ? 'Đã phân công: ' + runs.map(r => `${r.f.name} ${dm(r.from)}–${dm(r.to)}${r.t ? ' (dự kiến)' : ''}`).join(', ') : 'Chưa phân công fitter (phân công ở tab Điều phối nhân sự).';
    $('pjDelete').hidden = !id;
    $('pjMergeWrap').hidden = !id;
    $('pjMergeTo').innerHTML = '<option value="">— chọn dự án —</option>' + data.projects.filter(x => x.id !== id).sort((a, b) => a.name.localeCompare(b.name, 'vi')).map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');
    const sups = [...new Set(data.projects.map(x => x.supervisor).filter(Boolean))];
    $('supList').innerHTML = sups.map(s => `<option value="${esc(s)}">`).join('');
    $('pjShared').value = ''; sharedHint(p.wbs); pjAssist();
    $('dlgProject').showModal();
    $('pj_name').focus();
  }
  const sharedByWbs = (w) => SHARED.find(x => P.plain(x.wbs) === P.plain(w));
  function sharedHint(w) {
    const x = w ? sharedByWbs(w) : null;
    $('pjSharedHint').textContent = !w ? (SHARED.length ? 'Liên kết với dự án trong dữ liệu chung để điền sẵn tên, WBS, loại thang.' : '')
      : x ? `Đã liên kết: ${x.wbs} — ${x.projectName}${x.customer ? ' · ' + x.customer : ''}` : (SHARED.length ? `WBS ${w} không có trong danh sách dự án chung.` : '');
  }
  $('pjShared').addEventListener('change', () => {
    const v = $('pjShared').value, w = v.split(' — ')[0].trim(), x = sharedByWbs(w);
    if (!x) return;
    $('pj_wbs').value = x.wbs;
    if (!$('pj_name').value.trim() || (data.projects.find(p => p.id === pjId) || {}).fromGrid) $('pj_name').value = x.projectName;
    if (!$('pj_liftType').value.trim() && x.productLine) $('pj_liftType').value = x.productLine;
    if (!$('pj_supervisor').value.trim() && x.supervisor) $('pj_supervisor').value = x.supervisor;
    fillDialog(x, false);
    sharedHint(x.wbs); pjAssist();
  });
  $('pj_wbs').addEventListener('input', () => sharedHint($('pj_wbs').value.trim()));

  // ---------- tự điền thông số thang từ dữ liệu dự án chung (Thống kê giờ công) ----------
  // Cột thông số của dự án chung đặt tên theo file Yan_COM nên nhận theo TỪ KHOÁ, không theo tên cố định.
  const specNum = (v) => { const m = String(v == null ? '' : v).replace(/,/g, '.').match(/\d+(\.\d+)?/); return m ? Number(m[0]) : ''; };
  function specsOf(x) {
    const out = {}, sp = x.specs || {};
    Object.keys(sp).forEach(k => {
      const key = P.plain(k), v = sp[k];
      if (v === '' || v == null) return;
      if (out.stops === undefined && /(^| )(stops?|landings?|floors?|so diem dung|diem dung|so tang)( |$)/.test(key)) { const n = specNum(v); if (n !== '') out.stops = n; }
      else if (out.load === undefined && /(^| )(load|capacity|tai trong|rated load|kg)( |$)/.test(key)) { const n = specNum(v); if (n !== '') out.load = n; }
      else if (out.travel === undefined && /(^| )(travel|rise|hanh trinh|lift height|travel height)( |$)/.test(key)) out.travel = String(v).trim();
      else if (out.liftCount === undefined && /(^| )(qty|quantity|so luong|units?|no of lifts?|lifts?)( |$)/.test(key)) { const n = specNum(v); if (n !== '' && n > 0 && n < 100) out.liftCount = n; }
    });
    if (x.productLine) out.liftType = x.productLine;
    if (x.supervisor) out.supervisor = x.supervisor;
    return out;
  }
  const isEmptyVal = (v) => v === '' || v == null;
  // điền vào các trường CÒN TRỐNG của dự án p; trả về danh sách trường đã điền
  function fillProject(p, x, overwrite) {
    const sp = specsOf(x), done = [];
    ['liftType', 'stops', 'load', 'travel', 'liftCount', 'supervisor'].forEach(k => {
      if (sp[k] !== undefined && (overwrite || isEmptyVal(p[k]))) { if (p[k] !== sp[k]) { p[k] = sp[k]; done.push(k); } }
    });
    return done;
  }
  const FIELD_VN = { liftType: 'loại thang', stops: 'số điểm dừng', load: 'tải trọng', travel: 'hành trình', liftCount: 'số lượng', supervisor: 'giám sát' };
  function autofillAll(announce) {
    const todo = data.projects.map(p => ({ p, x: p.wbs ? sharedByWbs(p.wbs) : null })).filter(o => o.x && Object.keys(specsOf(o.x)).some(k => isEmptyVal(o.p[k]) && specsOf(o.x)[k] !== undefined));
    if (!todo.length) { if (announce) toast('Mọi dự án đã liên kết WBS đều đủ thông số thang.'); return 0; }
    commit(`Đã tự điền thông số thang cho ${todo.length} dự án từ dữ liệu dự án chung.`, () => { todo.forEach(o => fillProject(o.p, o.x, false)); });
    return todo.length;
  }
  $('miAutofill').addEventListener('click', () => { closeMenu(); autofillAll(true); });
  // gợi ý WBS cho dự án chưa liên kết: khớp tên (bỏ dấu) với dự án chung, chỉ khi duy nhất
  function suggestShared(name) {
    const n = P.plain(name); if (n.length < 4) return null;
    const hits = SHARED.filter(x => { const m = P.plain(x.projectName); return m && (m === n || m.includes(n) || (m.length >= 6 && n.includes(m))); });
    return hits.length === 1 ? hits[0] : null;
  }
  function pjAssist() {
    const w = $('pj_wbs').value.trim(), x = w ? sharedByWbs(w) : null;
    const can = x && Object.keys(specsOf(x)).length > 0;
    $('pjFill').hidden = !can;
    if (can) $('pjFill').textContent = '↻ Điền thông số thang từ dự án chung (' + [specsOf(x).liftType, specsOf(x).stops ? specsOf(x).stops + ' điểm dừng' : '', specsOf(x).load ? specsOf(x).load + 'kg' : ''].filter(Boolean).join(' · ') + ')';
    const sg = !w ? suggestShared($('pj_name').value) : null;
    $('pjSuggest').hidden = !sg;
    if (sg) { $('pjSuggest').textContent = `💡 Có phải dự án ${sg.wbs} — ${sg.projectName}? Bấm để liên kết`; $('pjSuggest').dataset.w = sg.wbs; }
  }
  function fillDialog(x, overwrite) {
    const sp = specsOf(x), set = (id, k) => { if (sp[k] !== undefined && (overwrite || !$(id).value.trim())) $(id).value = sp[k]; };
    set('pj_liftType', 'liftType'); set('pj_stops', 'stops'); set('pj_load', 'load'); set('pj_travel', 'travel'); set('pj_liftCount', 'liftCount'); set('pj_supervisor', 'supervisor');
  }
  $('pjFill').addEventListener('click', () => { const x = sharedByWbs($('pj_wbs').value.trim()); if (x) { fillDialog(x, true); toast('Đã điền thông số thang từ dự án chung (kiểm tra rồi bấm Lưu).'); } });
  $('pjSuggest').addEventListener('click', () => { const x = sharedByWbs($('pjSuggest').dataset.w); if (!x) return; $('pj_wbs').value = x.wbs; fillDialog(x, false); sharedHint(x.wbs); pjAssist(); });
  ['pj_wbs', 'pj_name'].forEach(id => $(id).addEventListener('input', pjAssist));

  $('pjMilestones').addEventListener('click', (e) => {
    const use = e.target.closest('[data-use]'), keep = e.target.closest('[data-keep]');
    if (!use && !keep) return;
    const row = e.target.closest('.msr');
    if (use) row.querySelector('.msd').value = use.dataset.use;
    row.dataset.checked = '1';
    e.target.closest('.msc').remove();
  });
  $('pjCancel').addEventListener('click', () => $('dlgProject').close());
  $('formProject').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('pj_name').value.trim(); if (!name) { $('pj_name').focus(); return; }
    commit(pjId ? `Đã lưu dự án ${name}.` : `Đã thêm dự án ${name}.`, () => {
      let p = data.projects.find(x => x.id === pjId);
      if (!p) { p = P.newProject(); data.projects.push(p); }
      PJ_TEXT.forEach(k => { p[k] = $('pj_' + k).value.trim(); });
      const num = (v) => (v === '' ? '' : Number(v));
      p.liftCount = num($('pj_liftCount').value); p.stops = num($('pj_stops').value);
      const ld = $('pj_load').value.trim(); p.load = /^\d+([.,]\d+)?$/.test(ld) ? Number(ld.replace(',', '.')) : ld;
      p.province = $('pj_province').value === '' ? null : $('pj_province').value === '1';
      p.color = $('pj_color').value; p.done = $('pj_done').checked;
      document.querySelectorAll('#pjMilestones .msr').forEach(r => {
        const old = p[r.dataset.k] || {};
        const v = { date: r.querySelector('.msd').value, done: r.querySelector('.msx').checked, note: r.querySelector('.msn').value.trim() };
        if (old.check && !r.dataset.checked && v.date === old.date) v.check = old.check; // chưa xử lý cảnh báo → giữ
        p[r.dataset.k] = v;
      });
      if (p.fromGrid && (p.address || p.liftType || P.MILESTONES.some(m => p[m.key].date))) delete p.fromGrid;
    });
    $('dlgProject').close();
  });
  $('pjDelete').addEventListener('click', () => {
    const p = data.projects.find(x => x.id === pjId); if (!p) return;
    const n = Object.values(data.alloc).reduce((s, m) => s + Object.values(m).filter(v => v.p === p.id).length, 0);
    if (!confirm(`Xóa dự án “${p.name}”${n ? ` và ${n} ngày phân công` : ''}?`)) return;
    commit(`Đã xóa dự án ${p.name}.`, () => {
      data.projects = data.projects.filter(x => x.id !== p.id);
      Object.values(data.alloc).forEach(m => Object.keys(m).forEach(d => { if (m[d].p === p.id) delete m[d]; }));
    });
    $('dlgProject').close();
  });
  $('pjMerge').addEventListener('click', () => {
    const src = data.projects.find(x => x.id === pjId), dst = data.projects.find(x => x.id === $('pjMergeTo').value);
    if (!src || !dst) { $('pjMergeTo').focus(); return; }
    if (!confirm(`Gộp “${src.name}” vào “${dst.name}”? Toàn bộ phân công chuyển sang “${dst.name}”, dự án “${src.name}” bị xóa.`)) return;
    commit(`Đã gộp ${src.name} vào ${dst.name}.`, () => {
      Object.values(data.alloc).forEach(m => Object.values(m).forEach(v => { if (v.p === src.id) v.p = dst.id; }));
      dst.aliases = [...new Set([...(dst.aliases || []), src.name, ...(src.aliases || [])])];
      P.MILESTONES.forEach(m => { const a = dst[m.key], b = src[m.key]; if (!a.date && !a.done && !a.note && (b.date || b.done || b.note)) dst[m.key] = b; });
      ['address', 'liftType', 'travel', 'transport', 'teamPlan', 'supervisor', 'note', 'wbs'].forEach(k => { if (!dst[k] && src[k]) dst[k] = src[k]; });
      data.projects = data.projects.filter(x => x.id !== src.id);
    });
    $('dlgProject').close();
  });

  // ================= NHẬP / XUẤT EXCEL =================
  let pending = null;
  $('fileImport').addEventListener('change', async (e) => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    try {
      const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellStyles: true });
      pending = P.parseWorkbook(XLSX, wb);
    } catch (err) { toast('Không đọc được file: ' + err.message); return; }
    const s = pending.stats, w = pending.warnings;
    if (!s.fitters && !s.projects) { toast('File không có sheet “Nhân sự” / “Plan” theo mẫu.'); pending = null; return; }
    const has = data.fitters.length || data.projects.length;
    $('imBody').innerHTML = `<p>File <b>${esc(file.name)}</b></p>
      <div class="im-stats">
        <div><b>${s.fitters}</b>fitter</div>
        <div><b>${s.cells}</b>ngày phân công${s.tentative ? ` (${s.tentative} dự kiến)` : ''}</div>
        <div><b>${s.projects - s.fromGrid}</b>dự án trong Plan</div>
        <div><b>${s.fromGrid}</b>tên chỉ có trong lưới nhân sự</div>
        ${s.from ? `<div><b>${dm(s.from)}–${dm(s.to)}</b>khoảng ngày</div>` : ''}
      </div>
      ${w.length ? `<p><b>${w.length} điểm cần kiểm tra</b> (đã nhập, có thể sửa trong ứng dụng):</p><ul class="im-warn">${w.map(x => `<li>${esc(x.msg)}</li>`).join('')}</ul>` : '<p>Không có cảnh báo.</p>'}
      <p class="sub">Ô màu xám trong sheet Nhân sự được hiểu là <b>dự kiến</b>. Tên ngắn trong lưới được khớp với dự án trong Plan khi chắc chắn.</p>
      ${has ? `<p class="im-replace">${STORE_URL ? `Dữ liệu <b>chung của cả nhóm trên ${STORE_NAME}</b>` : 'Dữ liệu hiện có trên máy'} sẽ được <b>thay toàn bộ</b> bằng dữ liệu trong file (có thể Hoàn tác ngay sau khi nhập).</p>` : ''}`;
    $('dlgImport').showModal();
  });
  $('imCancel').addEventListener('click', () => { pending = null; $('dlgImport').close(); });
  $('imApply').addEventListener('click', () => {
    if (!pending) return;
    const nd = pending.data, s = pending.stats; pending = null;
    $('dlgImport').close();
    if (s.from) viewStart = mondayOf(today() >= s.from && today() <= s.to ? today() : s.from);
    commit(`Đã nhập ${s.fitters} fitter, ${s.projects} dự án.`, () => { data = nd; });
  });

  let excelLoading = null;
  const ensureExcelJS = () => {
    if (window.ExcelJS) return Promise.resolve();
    excelLoading = excelLoading || new Promise((res, rej) => {
      const sc = document.createElement('script'); sc.src = EXCELJS_URL; sc.onload = res;
      sc.onerror = () => { excelLoading = null; rej(new Error('không tải được thư viện Excel' + (navigator.onLine === false ? ' (đang ngoại tuyến)' : ''))); };
      document.head.appendChild(sc);
    });
    return excelLoading;
  };
  $('btnExport').addEventListener('click', async () => {
    closeMenu();
    const b = $('btnExport'); b.disabled = true;
    try {
      await ensureExcelJS();
      const wb = P.buildWorkbook(ExcelJS, data);
      const blob = new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Quan_ly_lap_dat_NI_${today()}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('Đã xuất Excel (sheet Nhân sự + Plan).');
    } catch (err) { toast('Không xuất được Excel: ' + err.message); }
    finally { b.disabled = false; }
  });

  // ---------- dữ liệu mẫu (tên giả định) ----------
  function sample() {
    const d = P.emptyData(), t = mondayOf(today());
    const ps = [
      { name: 'Dự án mẫu A — Chung cư', address: 'Quận 1', liftCount: 2, liftType: 'ES5.0', travel: '30m', load: 1000, stops: 11, transport: 'Đi biển', supervisor: 'Giám sát 1',
        factory: { date: '', done: true, note: '' }, port: { date: '', done: true, note: '' }, arrival: { date: P.addDays(t, -10), done: true, note: '' },
        shaftReady: { date: P.addDays(t, -3), done: true, note: '' }, ownerStart: { date: P.addDays(t, 0), done: false, note: '' }, teamStart: { date: P.addDays(t, 0), done: false, note: '' }, teamPlan: '2 fitter' },
      { name: 'Dự án mẫu B — Biệt thự', address: 'Huyện X', province: true, liftCount: 1, liftType: 'ES1', travel: '12m', load: 630, stops: 4, transport: 'Đi tàu hỏa', supervisor: 'Giám sát 2',
        factory: { date: P.addDays(t, -5), done: false, note: '' }, arrival: { date: P.addDays(t, 9), done: false, note: '' }, shaftReady: { date: P.addDays(t, 10), done: false, note: '' },
        teamStart: { date: P.addDays(t, 12), done: false, note: '' }, handover: { date: '', done: false, note: 'Trước Tết' } },
      { name: 'Dự án mẫu C — Nhà xưởng', address: 'KCN Y', province: true, liftCount: 2, liftType: 'XJS', travel: '15m', load: 3000, stops: 3, supervisor: 'Giám sát 1',
        arrival: { date: P.addDays(t, 20), done: false, note: '' }, teamStart: { date: P.addDays(t, 24), done: false, note: '' } },
    ].map((x, i) => { const p = P.newProject(Object.assign({}, x)); P.MILESTONES.forEach(m => { p[m.key] = Object.assign(P.emptyMs(), x[m.key] || {}); }); p.color = '#' + P.PALETTE[i]; return p; });
    d.projects = ps;
    d.fitters = ['Fitter 1', 'Fitter 2', 'Fitter 3', 'Fitter 4', 'Fitter 5'].map(n => ({ id: P.uid('f'), name: n, empId: '' }));
    const put = (fi, pi, a, b, tent) => { const m = d.alloc[d.fitters[fi].id] || (d.alloc[d.fitters[fi].id] = {}); P.daysBetween(P.addDays(t, a), P.addDays(t, b)).forEach(x => { m[x] = tent ? { p: ps[pi].id, t: 1 } : { p: ps[pi].id }; }); };
    put(0, 0, -7, 13); put(1, 0, 0, 13); put(2, 1, 12, 27, true); put(3, 2, -7, 4); put(3, 1, 12, 27, true);
    d.fitters.forEach(f => { d.alloc[f.id] = d.alloc[f.id] || {}; });
    return d;
  }

  // ---------------- toast ----------------
  let toastTimer = null;
  function toast(msg, action) {
    $('toastMsg').textContent = msg;
    const b = $('toastAct');
    b.hidden = !action; if (action) { b.textContent = action.label; b.onclick = () => { $('toast').hidden = true; action.run(); }; }
    $('toast').hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, action ? 8000 : 5000);
  }
  $('toastX').addEventListener('click', () => { $('toast').hidden = true; });

  // ---------------- nối sự kiện ----------------
  $('tabAlloc').addEventListener('click', () => setTab('alloc'));
  $('tabPlan').addEventListener('click', () => setTab('plan'));
  $('tabActual').addEventListener('click', () => setTab('actual'));
  $('prevWeek').addEventListener('click', () => { viewStart = P.addDays(viewStart, -7); renderAlloc(); });
  $('nextWeek').addEventListener('click', () => { viewStart = P.addDays(viewStart, 7); renderAlloc(); });
  $('thisWeek').addEventListener('click', () => { viewStart = mondayOf(today()); renderAlloc(); });
  $('weeks').addEventListener('change', () => { ui.weeks = Number($('weeks').value); saveUI(); renderAlloc(); });
  $('hiProject').addEventListener('change', renderAlloc);
  $('addFitter').addEventListener('click', () => openFitter(null));
  $('addProject').addEventListener('click', () => openProject(null));
  $('emptyImport').addEventListener('click', () => $('fileImport').click());
  $('miImport').addEventListener('click', () => { closeMenu(); $('fileImport').click(); });
  $('miReload').addEventListener('click', () => { closeMenu(); pull(); });
  $('emptyStart').addEventListener('click', () => { ui.started = true; saveUI(); render(); openFitter(null); });
  const loadSample = () => {
    if ((data.fitters.length || data.projects.length) && !confirm('Thay dữ liệu hiện có bằng dữ liệu mẫu?')) return;
    commit('Đã tạo dữ liệu mẫu (tên giả định).', () => { data = sample(); });
  };
  $('emptySample').addEventListener('click', loadSample);
  $('miSample').addEventListener('click', () => { closeMenu(); loadSample(); });
  $('miClear').addEventListener('click', () => {
    closeMenu();
    if (STORE_URL) { // không xoá dữ liệu chung — chỉ bỏ bản trên máy và tải lại
      if (dirty() && !confirm('Bỏ các thay đổi chưa lưu lên ' + STORE_NAME + ' và tải lại dữ liệu chung?')) return;
      clearTimeout(saveTimer); base = null; meta = { version: null, updatedAt: '', updatedBy: '' }; keepMeta();
      data = P.emptyData(); try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* bỏ qua */ }
      pull(); return;
    }
    if (!confirm('Xóa toàn bộ dữ liệu Quản lý dự án trên máy này? (Nên Xuất Excel trước.)')) return;
    ui.started = false; saveUI();
    commit('Đã xóa dữ liệu.', () => { data = P.emptyData(); });
  });
  const closeMenu = () => { $('moreMenu').hidden = true; $('btnMore').setAttribute('aria-expanded', 'false'); };
  $('btnMore').addEventListener('click', (e) => { e.stopPropagation(); const o = $('moreMenu').hidden; $('moreMenu').hidden = !o; $('btnMore').setAttribute('aria-expanded', String(o)); });
  document.addEventListener('click', (e) => { if (!e.target.closest('#moreMenu')) closeMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  // bấm ra ngoài hộp thoại để đóng
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));
  // tab khác vừa sửa dữ liệu
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) { data = load(); render(); }
    if (e.key === META_KEY || e.key === BASE_KEY) { base = readJSON(BASE_KEY); meta = readJSON(META_KEY) || meta; renderStore(); }
  });
  // kho chung: có mạng lại → lưu; quay lại tab / định kỳ → lấy thay đổi của người khác
  window.addEventListener('online', () => { if (dirty()) push(); else pull(); renderShared(); });
  window.addEventListener('offline', () => { if (STORE_URL) { st = { phase: 'offline' }; renderStore(); } renderShared(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - lastPull > 20000) { if (dirty()) push(); else pull(); } });
  if (STORE_URL) setInterval(() => { if (document.visibilityState === 'visible' && !saving && !document.querySelector('dialog[open]')) { if (dirty()) push(); else pull(); } }, 90000);
  // rời trang khi còn thay đổi chưa lên Drive → hỏi lại
  window.addEventListener('beforeunload', (e) => { if (dirty() && st.phase !== 'denied') { e.preventDefault(); e.returnValue = ''; } });

  render();
  loadShared().then(() => { render(); if (SHARED.length && data.projects.length) autofillAll(false); });
  if (STORE_URL) pull();
})();
