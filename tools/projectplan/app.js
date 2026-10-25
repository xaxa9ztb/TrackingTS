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
  const saveUI = () => { try { localStorage.setItem(UI_KEY, JSON.stringify({ tab: ui.tab, weeks: ui.weeks, started: ui.started })); } catch (e) { /* bỏ qua */ } };
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
    $('tabAlloc').setAttribute('aria-selected', String(ui.tab === 'alloc'));
    $('tabPlan').setAttribute('aria-selected', String(ui.tab === 'plan'));
    $('btnExport').disabled = empty;
    if (empty) return;
    if (ui.tab === 'alloc') renderAlloc(); else renderPlan();
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
        h += `<td class="bar${v.t ? ' tent' : ''}${hi && hi !== v.p ? ' dim' : ''}" colspan="${j - i + 1}" data-f="${esc(f.id)}" data-d="${d}" tabindex="0" role="button" title="${esc(title)}" aria-label="${esc(title)}"><span style="background:${safeColor(p.color)};color:${textOn(p.color)}">${esc(p.name)}</span></td>`;
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
    const bar = e.target.closest('td.bar'), nm = e.target.closest('td.name[data-f]');
    if (bar) { const blk = blockAt(bar.dataset.f, bar.dataset.d); openAssign({ f: bar.dataset.f, from: blk.from, to: blk.to, edit: blk }); }
    else if (nm) openFitter(nm.dataset.f);
  });
  $('alTable').addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('td[tabindex]')) { e.preventDefault(); e.target.click(); } });

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
  $('planList').addEventListener('click', (e) => { const r = e.target.closest('[data-p]'); if (r) openProject(r.dataset.p); });
  $('planList').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-p]')) openProject(e.target.dataset.p); });
  $('upcoming').addEventListener('click', (e) => { const r = e.target.closest('[data-p]'); if (r) openProject(r.dataset.p); });
  ['planSearch', 'planStatus', 'planSup'].forEach(id => $(id).addEventListener('input', renderPlan));

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
    $('pjShared').value = ''; sharedHint(p.wbs);
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
    sharedHint(x.wbs);
  });
  $('pj_wbs').addEventListener('input', () => sharedHint($('pj_wbs').value.trim()));
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
  loadShared().then(render);
  if (STORE_URL) pull();
})();
