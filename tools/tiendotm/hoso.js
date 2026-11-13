// Hồ sơ Dự án — lớp vỏ: danh sách hồ sơ dự án đã lưu, lưu / mở lại toàn bộ dữ liệu đã nhập theo dự án,
// thông tin dùng chung, và 3 chức năng mới (Công văn – biên bản, Hồ sơ pháp lý, Bìa & trang ký bản vẽ).
// Bản Cloudflare: lưu lên máy chủ (/api/hs/projects). Bản github.io: lưu trong trình duyệt (localStorage).
// Tiết kiệm lượt ghi: chỉ lưu khi có thay đổi — bấm Lưu, tự lưu mỗi 5 phút, sau khi xuất tài liệu; nháp luôn giữ trên máy.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plain = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  const SERVER = typeof Session !== 'undefined' && Session.SERVER;
  const AUTOSAVE_MS = 5 * 60 * 1000;
  const NHA_THAU = 'CHI NHÁNH CÔNG TY TNHH SCHINDLER VIỆT NAM TẠI HÀ NỘI';
  const fmtTime = (t) => { if (!t) return ''; const d = new Date(t); return isNaN(d) ? String(t) : d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }); };
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  // ---------- kho lưu: máy chủ hoặc trình duyệt ----------
  async function api(method, path, body) {
    let resp;
    try {
      resp = await fetch(path, { method, credentials: 'same-origin', redirect: 'manual', cache: 'no-store',
        headers: body === undefined ? {} : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) { const err = new Error('Không kết nối được máy chủ — dữ liệu vẫn giữ nháp trên máy này.'); err.status = 0; throw err; }
    if (resp.type === 'opaqueredirect' || (resp.status >= 300 && resp.status < 400)) { const err = new Error('Phiên đăng nhập đã hết hạn — tải lại trang (F5).'); err.status = 401; throw err; }
    let data = {}; try { data = await resp.json(); } catch (e) { /* không phải JSON */ }
    if (!resp.ok) { const err = new Error(data.error || ('Lỗi máy chủ (HTTP ' + resp.status + ')')); err.status = resp.status; err.data = data; throw err; }
    return data;
  }
  const LKEY = 'hs_projects_local';
  const local = {
    read() { try { return JSON.parse(localStorage.getItem(LKEY) || '') || { seq: 0, items: [] }; } catch (e) { return { seq: 0, items: [] }; } },
    write(db) { localStorage.setItem(LKEY, JSON.stringify(db)); },
  };
  const head = (x) => { const { data, ...h } = x; return h; };
  const Store = SERVER ? {
    list: () => api('GET', '/api/hs/projects').then(r => r.items || []),
    get: (id) => api('GET', '/api/hs/projects/' + id).then(r => r.project),
    create: (b) => api('POST', '/api/hs/projects', b),
    put: (id, b) => api('PUT', '/api/hs/projects/' + id, b),
    editors: (id, editors) => api('PUT', '/api/hs/projects/' + id + '/editors', { editors }),
    del: (id) => api('DELETE', '/api/hs/projects/' + id, {}),
  } : {
    async list() { return local.read().items.map(head).map(x => ({ ...x, canEdit: true, canDelete: true })).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))); },
    async get(id) { const x = local.read().items.find(i => i.id === +id); if (!x) { const e = new Error('Không có hồ sơ dự án này'); e.status = 404; throw e; } return { ...x, canEdit: true, canDelete: true }; },
    async create(b) {
      const db = local.read();
      const ex = b.wbs && db.items.find(i => i.wbs === b.wbs);
      if (ex) return { ok: true, existing: true, project: ex };
      const t = new Date().toISOString(), me = whoAmI();
      const p = { id: ++db.seq, wbs: b.wbs || '', name: b.name, customer: b.customer || '', contract: b.contract || '', data: b.data, version: 1, createdAt: t, createdBy: me, updatedAt: t, updatedBy: me };
      db.items.push(p); local.write(db); return { ok: true, project: p };
    },
    async put(id, b) {
      const db = local.read(), p = db.items.find(i => i.id === +id);
      if (!p) { const e = new Error('Không có hồ sơ dự án này'); e.status = 404; throw e; }
      if (+b.version !== p.version) { const e = new Error('Hồ sơ đã được sửa ở cửa sổ khác — tải lại để xem bản mới'); e.status = 409; throw e; }
      Object.assign(p, { wbs: b.wbs || '', name: b.name, customer: b.customer || '', contract: b.contract || '', data: b.data, version: p.version + 1, updatedAt: new Date().toISOString(), updatedBy: whoAmI() });
      local.write(db); return { ok: true, project: head(p) };
    },
    async del(id) { const db = local.read(); db.items = db.items.filter(i => i.id !== +id); local.write(db); return { ok: true }; },
  };
  function whoAmI() { try { const s = Session.current && Session.current(); return (s && (s.name || s.email)) || ''; } catch (e) { return ''; } }

  // ---------- trạng thái ----------
  const st = { cur: null, lastJson: '', saving: null, timer: null, draftT: null, booted: false };
  // dữ liệu riêng của 3 chức năng mới (lưu cùng hồ sơ)
  const LT = {};                                              // công văn: LT[id] = {so, ngay, ...ô riêng}
  const LG = { ngay: '', people: [], machines: [], docs: {}, khOld: '', khNew: '' };   // hồ sơ pháp lý
  const DW = { tieuDe: 'BẢN VẼ THI CÔNG', phuDe: '(SHOP DRAWING)', heThong: 'HỆ THỐNG THANG MÁY', thietBi: '', prefix: 'TM', ngay: '', soBanVe: '', list: [], ky: [] };
  let dwFiles = [];                                          // bản vẽ tải lên: chỉ giữ trong bộ nhớ, không lưu lên máy chủ

  // ---------- chụp / khôi phục toàn bộ dữ liệu của công cụ ----------
  const SKIP = new Set(['ppInput', 'file', 'ct_file', 'hsFilter', 'hsKhFile', 'hsDwFiles']);
  function fieldEls() { return [...document.querySelectorAll('.wrap input[id], .wrap select[id], .wrap textarea[id]')].filter(el => el.type !== 'file' && !SKIP.has(el.id) && !el.closest('[data-hs-nosave]')); }
  function snapshot() {
    if (typeof pullForm === 'function') { try { pullForm(); } catch (e) { /* form chưa sẵn sàng */ } }
    const f = {};
    fieldEls().forEach(el => { f[el.id] = (el.type === 'checkbox' || el.type === 'radio') ? !!el.checked : el.value; });
    return { v: 1, S: JSON.parse(JSON.stringify(S)), f, lt: LT, lg: LG, dw: { ...DW } };
  }
  function restore(d) {
    if (!d || typeof d !== 'object') return;
    if (d.S) Object.keys(d.S).forEach(k => { S[k] = d.S[k]; });
    const R = (fn) => { try { if (typeof window[fn] === 'function') window[fn](); } catch (e) { console.warn(fn, e); } };
    ['renderSigners', 'renderSteps', 'renderFactors', 'renderQElevs', 'renderQParties', 'renderQExtras', 'renderQPhases', 'pushForm'].forEach(R);
    const f = d.f || {};
    Object.keys(f).forEach(id => {
      const el = $(id); if (!el || el.type === 'file' || SKIP.has(id)) return;
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!f[id]; else el.value = f[id];
    });
    ['renderQElevs', 'renderQPhases'].forEach(R);
    if (typeof qTogglePL === 'function') { try { qTogglePL(); } catch (e) { /* bỏ qua */ } }
    Object.keys(LT).forEach(k => delete LT[k]); Object.assign(LT, d.lt || {});
    Object.assign(LG, { ngay: '', people: [], machines: [], docs: {}, khOld: '', khNew: '' }, d.lg || {});
    Object.assign(DW, d.dw || {});
  }
  const json = () => JSON.stringify(snapshot());

  // ---------- thông tin dự án dùng chung (cho công văn, pháp lý, bản vẽ) ----------
  const gv = (id) => { const el = $(id); return el ? String(el.value || '').trim() : ''; };
  const toIso = (s) => { s = String(s || '').trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };
  // điền các ô dùng chung từ dữ liệu hợp đồng / hồ sơ chất lượng (chỉ ô đang trống)
  function prefillCommon() {
    if (typeof pullForm === 'function') { try { pullForm(); } catch (e) { /* bỏ qua */ } }
    const P = S.project || {};
    const set = (id, v) => { const el = $(id); if (el && v && !String(el.value || '').trim()) el.value = v; };
    const party = (re) => { const p = (S.qParties || []).find(z => re.test(z.role || '')); return p ? p.name : ''; };
    set('hs_congtrinh', gv('q_congtrinh') || P.name); set('hs_diadiem', gv('q_diadiem') || P.addr);
    set('hs_cdt', P.buyer || party(/chủ đầu tư|tổng thầu/i)); set('hs_cdt_diachi', gv('q_cdt_diachi') || P.baddr); set('hs_cdt_daidien', gv('q_cdt_daidien') || P.rep);
    set('hs_qlda', party(/quản lý dự án|qlda/i)); set('hs_tvgs', party(/giám sát|tvgs/i));
    set('hs_sohd', gv('q_sohd') || P.no); set('hs_ngayhd', gv('q_ngayhd') || toIso(P.cdate)); set('hs_hangmuc', gv('q_hangmuc'));
    set('hs_thietbi', P.equip); set('hs_wbs', P.wbs); set('hs_noilap', gv('q_diadanh') || 'Hà Nội'); set('hs_nhathau', NHA_THAU);
    set('hs_cht', gv('nk_cht_ten'));
  }
  function info() {
    const n = (S.qElevs || []).filter(e => String(e.name || '').trim()).length;
    return {
      congTrinh: gv('hs_congtrinh'), duAn: gv('hs_congtrinh'), diaDiem: gv('hs_diadiem'), chuDauTu: gv('hs_cdt'), cdtDiaChi: gv('hs_cdt_diachi'), cdtDaiDien: gv('hs_cdt_daidien'),
      banQLDA: gv('hs_qlda'), tvgs: gv('hs_tvgs'), soHD: gv('hs_sohd'), ngayHD: gv('hs_ngayhd'), hangMuc: gv('hs_hangmuc') || 'Cung cấp và lắp đặt hệ thống thang máy',
      thietBi: gv('hs_thietbi'), nhaThau: gv('hs_nhathau') || NHA_THAU, nhaThauDiaChi: gv('hs_nt_diachi'), noiLap: gv('hs_noilap') || 'Hà Nội',
      nguoiKy: gv('hs_nguoiky'), chucVuKy: gv('hs_chucvuky'), pmTen: gv('hs_pm_ten'), pmDT: gv('hs_pm_dt'), pmEmail: gv('hs_pm_email'), chtTen: gv('hs_cht'),
      soThang: n ? String(n).padStart(2, '0') : '', wbs: gv('hs_wbs'),
    };
  }
  const projName = () => gv('hs_congtrinh') || (S.project && S.project.name) || gv('q_congtrinh');
  const headFields = () => { const I = info(); return { name: projName(), wbs: I.wbs || (S.project && S.project.wbs) || '', customer: I.chuDauTu || (S.project && S.project.buyer) || '', contract: I.soHD || (S.project && S.project.no) || '' }; };

  // ---------- thanh trạng thái hồ sơ ----------
  function bar(msg, kind) {
    const b = $('hsBar'); if (!b) return;
    b.hidden = false;
    $('hsBarName').textContent = st.cur ? st.cur.name : (projName() || 'Hồ sơ mới (chưa lưu)');
    $('hsBarMeta').textContent = st.cur ? [st.cur.wbs && 'WBS ' + st.cur.wbs, 'cập nhật ' + fmtTime(st.cur.updatedAt) + (st.cur.updatedBy ? ' · ' + st.cur.updatedBy : '')].filter(Boolean).join(' · ') : '';
    if (msg != null) { const s = $('hsBarStatus'); s.textContent = msg; s.className = 'hs-st' + (kind ? ' ' + kind : ''); }
  }
  // ---------- nháp trên máy (an toàn khi mất mạng / máy chủ hết hạn mức) ----------
  const draftKey = () => 'hs_draft_' + (st.cur ? st.cur.id : 'new');
  function saveDraft() {
    try { localStorage.setItem(draftKey(), JSON.stringify({ t: Date.now(), base: st.cur ? st.cur.version : 0, data: snapshot() })); } catch (e) { /* bộ nhớ đầy */ }
  }
  function dropDraft() { try { localStorage.removeItem(draftKey()); } catch (e) { /* bỏ qua */ } }
  function readDraft(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; } }

  // ---------- lưu ----------
  const readOnly = () => !!(st.cur && st.cur.canEdit === false);
  async function save(reason) {
    if (readOnly()) { if (reason === 'manual') bar('👁 Chỉ xem — bạn chưa có quyền sửa hồ sơ này (liên hệ Admin để được cấp quyền). Vẫn xuất được tài liệu.', 'warn'); return true; }
    if (st.saving) return st.saving;
    const run = (async () => {
      const data = snapshot(), text = JSON.stringify(data), h = headFields();
      if (st.cur && text === st.lastJson && h.name === st.cur.name && h.wbs === (st.cur.wbs || '') && h.customer === (st.cur.customer || '') && h.contract === (st.cur.contract || '')) {
        if (reason === 'manual') bar('✓ Không có thay đổi cần lưu', 'ok');
        return true;
      }
      if (!h.name) { if (reason === 'manual') bar('Nhập Tên công trình (thông tin dùng chung) để lưu hồ sơ', 'warn'); return false; }
      bar('Đang lưu…');
      try {
        if (!st.cur) {
          const r = await Store.create({ ...h, data });
          if (r.existing) {
            if (confirm(`Dự án WBS ${h.wbs} đã có hồ sơ “${r.project.name}”. Mở hồ sơ đó?\n(Bấm Huỷ để lưu thành hồ sơ riêng không gắn WBS.)`)) { saveDraft(); location.search = '?p=' + r.project.id; return false; }
            const r2 = await Store.create({ ...h, wbs: '', data });
            st.cur = head(r2.project);
          } else st.cur = head(r.project);
          try { localStorage.removeItem('hs_draft_new'); } catch (e) { /* bỏ qua */ }
          history.replaceState(null, '', '?p=' + st.cur.id);
        } else {
          const r = await Store.put(st.cur.id, { version: st.cur.version, ...h, data });
          st.cur = { ...st.cur, ...r.project };
        }
        st.lastJson = text;
        clearTimeout(st.draftT);
        dropDraft();
        bar('✓ Đã lưu ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + (SERVER ? ' lên máy chủ' : ' trên máy này'), 'ok');
        return true;
      } catch (e) {
        saveDraft();
        if (e.status === 409) bar('⚠ ' + e.message + ' — bản của bạn vẫn giữ nháp trên máy.', 'err');
        else bar('⚠ Chưa lưu được: ' + e.message, 'err');
        return false;
      }
    })();
    st.saving = run;
    try { return await run; } finally { st.saving = null; }
  }
  const saveSoon = () => { clearTimeout(st.soon); st.soon = setTimeout(() => save('export'), 1500); };
  function onEdit() {
    if (readOnly()) return;
    clearTimeout(st.draftT);
    st.draftT = setTimeout(() => {
      if (!st.booted || !$('screenHome').classList.contains('hide') || st.saving) return;
      if (json() === st.lastJson) return;   // vừa lưu xong / sửa rồi trả lại như cũ
      saveDraft(); bar('● Có thay đổi chưa lưu (tự lưu sau tối đa 5 phút)', 'warn');
    }, 2500);
  }

  // ---------- màn hình danh sách dự án ----------
  let items = [];
  async function loadList() {
    const tb = $('hsTable').tBodies[0];
    tb.innerHTML = '<tr><td colspan="6" class="hs-empty">Đang tải…</td></tr>';
    try { items = await Store.list(); } catch (e) { tb.innerHTML = `<tr><td colspan="6" class="hs-empty err">${esc(e.message)}</td></tr>`; return; }
    paintList();
  }
  function paintList() {
    const tb = $('hsTable').tBodies[0];
    const terms = plain($('hsFilter').value).split(/\s+/).filter(Boolean);
    const rows = items.filter(x => { const k = plain([x.name, x.wbs, x.customer, x.contract, x.updatedBy].join(' ')); return terms.every(t => k.includes(t)); });
    $('hsCount').textContent = items.length ? `${rows.length}/${items.length} hồ sơ` : '';
    const nd = readDraft('hs_draft_new');
    const draftRow = nd && nd.data ? `<tr class="hs-draft"><td data-label="Dự án"><b>${esc((nd.data.f && nd.data.f.hs_congtrinh) || (nd.data.S && nd.data.S.project && nd.data.S.project.name) || 'Hồ sơ mới chưa lưu')}</b> <span class="pill wait">nháp trên máy</span></td><td colspan="4" data-label="">Bắt đầu lúc ${esc(fmtTime(nd.t))} — chưa lưu lên ${SERVER ? 'máy chủ' : 'danh sách'}</td><td class="hs-act"><button class="btn sm pri" data-open="new">Mở tiếp</button> <button class="btn sm gho" data-deldraft="new" title="Xoá bản nháp trên máy này">Xoá nháp</button></td></tr>` : '';
    tb.innerHTML = draftRow + (rows.length ? rows.map(x => `<tr data-id="${x.id}">
      <td data-label="Dự án"><b>${esc(x.name)}</b>${x.canEdit === false ? ' <span class="pill ro" title="Bạn chỉ được xem — liên hệ Admin để được cấp quyền sửa">chỉ xem</span>' : ''}${readDraft('hs_draft_' + x.id) ? ` <span class="pill wait" title="Có thay đổi chưa lưu trên máy này">nháp</span> <button class="hs-link" data-deldraft="${x.id}" title="Bỏ các thay đổi chưa lưu trên máy này">xoá nháp</button>` : ''}${x.editors && x.editors.length ? `<div class="hs-by" title="${esc(x.editors.join(', '))}">Được cấp quyền sửa: ${x.editors.length} người</div>` : ''}</td>
      <td data-label="WBS">${esc(x.wbs || '—')}</td><td data-label="Chủ đầu tư">${esc(x.customer || '—')}</td><td data-label="Hợp đồng">${esc(x.contract || '—')}</td>
      <td data-label="Cập nhật">${esc(fmtTime(x.updatedAt))}<div class="hs-by">${esc(x.updatedBy || '')}${x.createdBy && x.createdBy !== x.updatedBy ? ' · tạo: ' + esc(x.createdBy) : ''}</div></td>
      <td class="hs-act"><button class="btn sm pri" data-open="${x.id}">${x.canEdit === false ? 'Xem' : 'Mở'}</button>${x.canGrant ? ` <button class="btn sm gho" data-grant="${x.id}" title="Cấp quyền sửa cho Site Sup">Quyền sửa</button>` : ''}${x.canDelete !== false ? ` <button class="btn sm gho" data-del="${x.id}" title="Xoá hồ sơ">Xoá</button>` : ''}</td></tr>`).join('')
      : `<tr><td colspan="6" class="hs-empty">${items.length ? 'Không có hồ sơ khớp từ khoá' : 'Chưa có hồ sơ dự án nào — bấm “Tạo hồ sơ dự án mới”.'}</td></tr>`);
  }
  async function delProject(id) {
    const x = items.find(i => i.id === +id); if (!x) return;
    if (!confirm(`Xoá hồ sơ dự án “${x.name}”? Thao tác không hoàn tác được.`)) return;
    try { await Store.del(id); try { localStorage.removeItem('hs_draft_' + id); } catch (e) { /* bỏ qua */ } items = items.filter(i => i.id !== +id); paintList(); }
    catch (e) { alert(e.message); }
  }
  function delDraft(key) {
    const isNew = key === 'new';
    const x = isNew ? null : items.find(i => i.id === +key);
    if (!confirm(isNew ? 'Xoá hồ sơ mới đang nhập dở (chưa lưu) trên máy này?' : `Bỏ các thay đổi chưa lưu của “${x ? x.name : 'hồ sơ'}” trên máy này? Bản đã lưu trên ${SERVER ? 'máy chủ' : 'danh sách'} vẫn giữ nguyên.`)) return;
    try { localStorage.removeItem('hs_draft_' + key); } catch (e) { /* bỏ qua */ }
    paintList();
  }
  let sups = null;
  async function grantDlg(id) {
    const x = items.find(i => i.id === +id); if (!x) return;
    let dlg = $('hsGrantDlg');
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.id = 'hsGrantDlg'; dlg.className = 'hs-dlg';
      dlg.innerHTML = `<form method="dialog"><h3 style="margin:0 0 4px">Cấp quyền sửa hồ sơ</h3><p class="hs-mini" id="hsGrantName" style="margin:0 0 10px"></p>
        <p class="hs-mini" style="margin:0 0 6px">Admin, Quản lý dự án và người tạo luôn sửa được. Tick Site Sup được phép sửa hồ sơ này:</p>
        <div id="hsGrantList" class="hs-grant-list"></div>
        <label class="hs-mini" style="display:block;margin-top:10px">Email khác (cách nhau dấu phẩy)<input id="hsGrantMore" type="text" style="width:100%;margin-top:4px"></label>
        <p id="hsGrantSt" class="hs-mini" style="min-height:1.2em"></p>
        <div class="row" style="justify-content:flex-end;gap:8px"><button value="cancel" class="btn gho sm">Đóng</button><button id="hsGrantSave" value="default" class="btn pri sm">Lưu quyền</button></div></form>`;
      document.body.appendChild(dlg);
    }
    $('hsGrantName').textContent = x.name + (x.wbs ? ' · WBS ' + x.wbs : '');
    $('hsGrantSt').textContent = '';
    const cur = new Set((x.editors || []).map(e => e.toLowerCase()));
    if (!sups) {
      try { const r = await api('GET', '/api/employees'); sups = (r.employees || []).filter(e => e.email && e.active !== false && (e.roles || []).includes('sitesup')).map(e => ({ email: String(e.email).toLowerCase(), name: e.name || e.fullName || e.email })); }
      catch (e) { sups = []; }
    }
    const known = new Set(sups.map(s => s.email));
    $('hsGrantList').innerHTML = sups.length ? sups.map(s => `<label class="chk"><input type="checkbox" value="${esc(s.email)}"${cur.has(s.email) ? ' checked' : ''}> ${esc(s.name)} <span class="hs-mini">${esc(s.email)}</span></label>`).join('') : '<span class="hs-mini">Không tải được danh sách Site Sup — nhập email bên dưới.</span>';
    $('hsGrantMore').value = [...cur].filter(e => !known.has(e)).join(', ');
    $('hsGrantSave').onclick = async (ev) => {
      ev.preventDefault();
      const list = [...dlg.querySelectorAll('#hsGrantList input:checked')].map(i => i.value).concat($('hsGrantMore').value.split(/[,;\s]+/).map(v => v.trim()).filter(Boolean));
      $('hsGrantSt').textContent = 'Đang lưu…';
      try { const r = await Store.editors(id, list); Object.assign(x, r.project); paintList(); dlg.close(); }
      catch (e) { $('hsGrantSt').textContent = '⚠ ' + e.message; }
    };
    dlg.showModal();
  }
  async function toList() {
    if (st.booted && !$('screenHome').classList.contains('hide')) return;
    if (st.cur || projName()) { const ok = await save('nav'); if (!ok && !confirm('Chưa lưu được hồ sơ (dữ liệu vẫn giữ nháp trên máy). Vẫn quay lại danh sách?')) return; }
    location.search = '';
  }

  // ---------- 4 chức năng ----------
  function enter(screen) {
    prefillCommon();
    if (typeof prefillQuality === 'function' && /screenLetters|screenNhatKy/.test(screen)) { try { prefillQuality(); } catch (e) { /* bỏ qua */ } }
    showScreen(screen);
    if (screen === 'screenLetters') renderLetters();
    if (screen === 'screenLegal') renderLegal();
    if (screen === 'screenDrawing') renderDrawing();
  }

  // ===== Công văn, biên bản =====
  let tplBuf = null, curLetter = null;
  const letterTpl = async () => tplBuf || (tplBuf = await fetch('thu_hangve_template.docx', { cache: 'force-cache' }).then(r => { if (!r.ok) throw new Error('Không tải được khuôn công văn'); return r.arrayBuffer(); }));
  function renderLetters() {
    const box = $('hsLetterList');
    const item = (d) => { const done = LT[d.id] && LT[d.id]._last; return `<button class="hs-li${curLetter === d.id ? ' on' : ''}" data-letter="${d.id}"><span class="hs-k">${d.kind === 'bb' ? 'BB' : 'CV'}</span><span class="hs-n">${esc(d.name)}</span>${done ? `<span class="hs-done" title="Đã xuất lúc ${esc(fmtTime(done))}">✓</span>` : ''}</button>`; };
    box.innerHTML = `<div class="hs-grp">Công văn gửi Chủ đầu tư / các bên</div>${HsLetters.LETTERS.filter(d => d.kind === 'letter').map(item).join('')}
      <div class="hs-grp">Biên bản</div>${HsLetters.LETTERS.filter(d => d.kind === 'bb').map(item).join('')}`;
    renderLetterForm();
  }
  function renderLetterForm() {
    const host = $('hsLetterForm');
    const d = HsLetters.LETTERS.find(x => x.id === curLetter);
    if (!d) { host.innerHTML = '<p class="hint" style="margin:0">Chọn một công văn / biên bản ở danh sách bên trái. Tất cả dùng chung <b>một khuôn công văn của nhà thầu</b> (logo đầu trang, địa chỉ chân trang, khối Kính gửi – V/v – Tham chiếu hợp đồng, khối ký và nơi nhận giống nhau) và lấy thông tin ở mục <b>Thông tin dự án dùng chung</b>.</p>'; return; }
    const v = LT[d.id] || (LT[d.id] = {});
    const fld = (k, label, type, o = {}) => {
      const val = v[k] != null ? v[k] : (o.def || '');
      const inp = type === 'textarea' ? `<textarea data-lk="${k}" rows="${o.rows || 4}" placeholder="${esc(o.ph || '')}">${esc(val)}</textarea>`
        : `<input data-lk="${k}" type="${type === 'date' ? 'date' : 'text'}" value="${esc(val)}" placeholder="${esc(o.ph || '')}">`;
      return `<div class="f${type === 'textarea' || o.wide ? ' hs-wide' : ''}"><label>${esc(label)}</label>${inp}</div>`;
    };
    host.innerHTML = `<h3 class="hs-h3">${esc(d.name)}</h3>
      <div class="grid g2">${fld('so', d.kind === 'bb' ? 'Số biên bản' : 'Số công văn', 'text', { ph: 'VD: 125/2026/SCH-HN' })}${fld('ngay', 'Ngày lập', 'date', { def: todayISO() })}
      ${(d.fields || []).map(x => fld(x.k, x.label, x.type || 'text', x)).join('')}
      ${d.kind === 'letter' ? fld('kinhGui', 'Kính gửi (để trống = Chủ đầu tư)', 'text', { ph: gv('hs_cdt') }) + fld('dongKinhGui', 'Đồng kính gửi (để trống = Ban QLDA; TVGS)', 'text', { ph: [gv('hs_qlda'), gv('hs_tvgs')].filter(Boolean).join('; ') }) : ''}</div>
      <div class="row" style="gap:10px;margin-top:12px"><button class="btn pri" id="hsLetterGo">⬇ Xuất ${d.kind === 'bb' ? 'biên bản' : 'công văn'} (.docx)</button><span id="hsLetterSt" class="hs-mini"></span></div>`;
    (d.fields || []).forEach(x => { if (v[x.k] == null && x.def) v[x.k] = x.def; });
    if (v.ngay == null) v.ngay = todayISO();
  }
  async function exportLetter() {
    const d = HsLetters.LETTERS.find(x => x.id === curLetter); if (!d) return;
    const stEl = $('hsLetterSt'); stEl.textContent = 'Đang tạo…';
    try {
      const zip = await HsLetters.build(JSZip, await letterTpl(), d, info(), LT[d.id] || {});
      saveAs(await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), HsLetters.fileName(d, info(), LT[d.id] || {}));
      LT[d.id]._last = new Date().toISOString();
      stEl.textContent = '✓ Đã xuất'; renderLetters(); saveSoon();
    } catch (e) { console.error(e); stEl.textContent = '⚠ ' + e.message; }
  }

  // ===== Hồ sơ pháp lý =====
  function renderLegal() {
    if (!LG.ngay) LG.ngay = todayISO();
    if (!LG.people.length) LG.people = [{ ten: gv('hs_cht'), gioi: 'Ông', role: 'cht', bch: true, pccc: false }, { ten: '', gioi: 'Ông', role: 'atld', bch: true, pccc: true }, { ten: '', gioi: 'Ông', role: 'cn', bch: false, pccc: true }];
    if (!LG.machines.length) LG.machines = HsLegal.MAY_MOC.map(x => ({ ...x }));
    $('hsLgNgay').value = LG.ngay;
    const roleOpt = (v) => Object.entries(HsLegal.ROLES).map(([k, r]) => `<option value="${k}"${k === v ? ' selected' : ''}>${esc(r.label || 'Khác (ghi ở cột Vị trí)')}</option>`).join('');
    $('hsPeople').tBodies[0].innerHTML = LG.people.map((x, i) => `<tr data-i="${i}">
      <td>${i + 1}</td><td><input data-pk="ten" value="${esc(x.ten)}" list="hsEmpList" placeholder="Họ và tên"></td>
      <td><select data-pk="gioi"><option${x.gioi !== 'Bà' ? ' selected' : ''}>Ông</option><option${x.gioi === 'Bà' ? ' selected' : ''}>Bà</option></select></td>
      <td><select data-pk="role">${roleOpt(x.role)}</select></td><td><input data-pk="viTri" value="${esc(x.viTri || '')}" placeholder="(theo vai trò)"></td>
      <td class="c"><input type="checkbox" data-pk="bch"${x.bch ? ' checked' : ''}></td><td class="c"><input type="checkbox" data-pk="pccc"${x.pccc ? ' checked' : ''}></td>
      <td><button class="icb" data-pdel="${i}" title="Xoá">×</button></td></tr>`).join('');
    $('hsMachines').tBodies[0].innerHTML = LG.machines.map((x, i) => `<tr data-i="${i}"><td>${i + 1}</td><td><input data-mk="ten" value="${esc(x.ten)}"></td><td><input data-mk="dvt" value="${esc(x.dvt)}"></td><td><input data-mk="sl" value="${esc(x.sl)}"></td><td><button class="icb" data-mdel="${i}" title="Xoá">×</button></td></tr>`).join('');
    $('hsLgDocs').innerHTML = HsLegal.DOCS.map((d, i) => `<label class="chk hs-doc"><input type="checkbox" data-doc="${d.id}"${LG.docs[d.id] === false ? '' : ' checked'}> ${i + 1}. ${esc(d.name)} <a href="#" data-one="${d.id}">tải riêng</a></label>`).join('');
    $('hsKhOld').value = LG.khOld || ''; $('hsKhNew').value = LG.khNew || (gv('hs_congtrinh') || '').toUpperCase();
    fillEmpList();
  }
  let empLoaded = false;
  async function fillEmpList() {
    if (empLoaded) return; empLoaded = true;
    try {
      let rows = [];
      if (SERVER) rows = (await api('GET', '/api/employees')).employees || [];
      else if (typeof DB !== 'undefined') rows = await DB.getAll('employees');
      $('hsEmpList').innerHTML = rows.filter(x => x && x.name && x.active !== false).map(x => `<option value="${esc(x.name)}"></option>`).join('');
    } catch (e) { /* không có danh sách nhân viên: nhập tay */ }
  }
  async function exportLegal(one) {
    const stEl = $('hsLgSt'); stEl.textContent = 'Đang tạo…';
    try {
      const I = info();
      const list = one ? HsLegal.DOCS.filter(d => d.id === one) : HsLegal.DOCS.filter(d => LG.docs[d.id] !== false);
      if (!list.length) { stEl.textContent = 'Chưa chọn tài liệu nào'; return; }
      const MT = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      if (list.length === 1) {
        const z = await HsLegal.build(JSZip, list[0].id, I, LG);
        saveAs(await z.generateAsync({ type: 'blob', mimeType: MT }), HsLegal.fileName(list[0], HsLegal.DOCS.indexOf(list[0])).replace(/^\d+\. /, '') .replace(/\.docx$/, ` - ${(I.congTrinh || 'du an').replace(/[\\/:*?"<>|]/g, '')}.docx`));
      } else {
        const out = new JSZip();
        for (const d of list) { const z = await HsLegal.build(JSZip, d.id, I, LG); out.file(HsLegal.fileName(d, HsLegal.DOCS.indexOf(d)), await z.generateAsync({ type: 'uint8array' })); }
        saveAs(await out.generateAsync({ type: 'blob' }), `Ho so phap ly - ${(I.congTrinh || 'du an').replace(/[\\/:*?"<>|]/g, '')}.zip`);
      }
      LG._last = new Date().toISOString();
      stEl.textContent = `✓ Đã xuất ${list.length} tài liệu`; saveSoon();
    } catch (e) { console.error(e); stEl.textContent = '⚠ ' + e.message; }
  }
  async function exportKh(file) {
    const stEl = $('hsKhSt');
    const oldN = String(LG.khOld || '').trim(), newN = String(LG.khNew || '').trim();
    if (!file) return;
    if (!oldN || !newN) { stEl.textContent = 'Nhập tên công trình cũ (trong file mẫu) và tên mới trước'; return; }
    stEl.textContent = 'Đang thay…';
    try {
      const { zip, count } = await HsLegal.replaceInDocx(JSZip, await file.arrayBuffer(), [[oldN, newN]]);
      if (!count) { stEl.textContent = `Không tìm thấy “${oldN}” trong file — kiểm tra lại tên cũ`; return; }
      saveAs(await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), file.name.replace(/\.docx$/i, '') + ' - ' + newN.replace(/[\\/:*?"<>|]/g, '') + '.docx');
      stEl.textContent = `✓ Đã thay ${count} chỗ`; saveSoon();
    } catch (e) { console.error(e); stEl.textContent = '⚠ Không đọc được file Word (.docx): ' + e.message; }
  }

  // ===== Bìa & trang ký bản vẽ =====
  const loadScript = (src) => new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => bad(new Error('Không tải được thư viện ' + src.split('/').slice(-3).join('/'))); document.head.appendChild(s); });
  let pdfReady = null, fontBufs = null;
  const pdfLibs = () => pdfReady || (pdfReady = (async () => {
    if (!window.PDFLib) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js');
    if (!window.fontkit) await loadScript('https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js');
  })().catch(e => { pdfReady = null; throw e; }));
  const fonts = async () => fontBufs || (fontBufs = await (async () => {
    const get = (n) => fetch('fonts/' + n, { cache: 'force-cache' }).then(r => { if (!r.ok) throw new Error('Không tải được phông chữ'); return r.arrayBuffer(); });
    const [r, b, i] = await Promise.all([get('Tinos_400Regular.ttf'), get('Tinos_700Bold.ttf'), get('Tinos_400Regular_Italic.ttf')]);
    return { r, b, i };
  })());
  function defaultKy() {
    const I = info();
    return [{ title: 'Chủ đầu tư', org: I.chuDauTu, ten: '', chucVu: '' }, { title: 'Ban quản lý dự án / Tư vấn giám sát', org: I.banQLDA || I.tvgs, ten: '', chucVu: '' },
      { title: 'Nhà thầu cung cấp, lắp đặt', org: I.nhaThau, ten: I.nguoiKy, chucVu: I.chucVuKy }];
  }
  function renderDrawing() {
    if (!DW.ngay) DW.ngay = todayISO();
    if (!DW.thietBi) DW.thietBi = gv('hs_thietbi');
    if (!DW.ky || !DW.ky.length) DW.ky = defaultKy();
    ['tieuDe', 'phuDe', 'heThong', 'thietBi', 'prefix', 'ngay', 'soBanVe'].forEach(k => { const el = $('hsDw_' + k); if (el) el.value = DW[k] || ''; });
    $('hsDwKy').innerHTML = DW.ky.map((c, i) => `<div class="hs-ky" data-i="${i}"><div class="f"><label>Cột ký ${i + 1} — tiêu đề</label><input data-kk="title" value="${esc(c.title)}"></div>
      <div class="f"><label>Đơn vị</label><input data-kk="org" value="${esc(c.org)}"></div><div class="f"><label>Họ tên người ký</label><input data-kk="ten" value="${esc(c.ten)}" placeholder="(để trống: điền tay)"></div>
      <div class="f"><label>Chức vụ</label><input data-kk="chucVu" value="${esc(c.chucVu)}"></div></div>`).join('');
    paintDwList();
  }
  function paintDwList() {
    $('hsDwTable').tBodies[0].innerHTML = DW.list.length ? DW.list.map((x, i) => `<tr data-i="${i}"><td>${i + 1}</td><td><input data-dk="so" value="${esc(x.so)}"></td><td><input data-dk="ten" value="${esc(x.ten)}"></td><td><input data-dk="kho" value="${esc(x.kho)}" style="width:70px"></td><td class="hs-mini">${esc(x.file || '')}</td><td><button class="icb" data-ddel="${i}" title="Xoá dòng">×</button></td></tr>`).join('')
      : '<tr><td colspan="6" class="hs-empty">Tải bản vẽ PDF lên để tự lập danh mục (mỗi trang = 1 bản vẽ), hoặc thêm dòng tay.</td></tr>';
    $('hsDwFilesNote').textContent = dwFiles.length ? `${dwFiles.length} file bản vẽ đang mở (${dwFiles.map(f => f.name).join(', ')}) — chỉ xử lý trên máy, không tải lên máy chủ.` : 'Chưa có file bản vẽ trong phiên này (danh mục đã lưu vẫn còn; muốn ghép bìa vào bản vẽ thì tải file lên lại).';
    $('hsDwMerge').disabled = !dwFiles.length;
  }
  async function addDwFiles(fileList) {
    const stEl = $('hsDwSt'); stEl.textContent = 'Đang đọc bản vẽ…';
    try {
      await pdfLibs();
      const add = [];
      for (const f of fileList) { if (!/\.pdf$/i.test(f.name)) continue; add.push({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }); }
      if (!add.length) { stEl.textContent = 'Chỉ nhận file PDF'; return; }
      const fresh = !dwFiles.length;
      dwFiles = dwFiles.concat(add);
      const rows = await HsDrawing.listDrawings(PDFLib, add, DW.prefix || 'TM');
      // bắt đầu phiên mới → danh mục theo file mới; đã có file → nối tiếp và đánh lại số hiệu
      if (fresh) DW.list = rows; else DW.list = DW.list.concat(rows);
      DW.list.forEach((x, i) => { if (/^[A-Z]{1,4}-\d+$/.test(x.so || '')) x.so = `${DW.prefix || 'TM'}-${String(i + 1).padStart(2, '0')}`; });
      paintDwList(); stEl.textContent = `✓ Đã đọc ${rows.length} trang bản vẽ`; onEdit();
    } catch (e) { console.error(e); stEl.textContent = '⚠ ' + e.message; }
  }
  async function exportDrawing(withFiles) {
    const stEl = $('hsDwSt'); stEl.textContent = 'Đang tạo PDF…';
    try {
      await pdfLibs();
      const I = info();
      const D = { ...DW, chuDauTu: I.chuDauTu, banQLDA: I.banQLDA || I.tvgs, congTrinh: I.congTrinh, diaDiem: I.diaDiem, hangMuc: I.hangMuc,
        hopDong: [I.soHD, I.ngayHD ? 'ngày ' + I.ngayHD.split('-').reverse().join('/') : ''].filter(Boolean).join(' '), nhaThau: I.nhaThau, nhaThauDiaChi: I.nhaThauDiaChi, noiLap: I.noiLap, drawings: DW.list, ky: DW.ky };
      const cover = await HsDrawing.buildCover(PDFLib, fontkit, await fonts(), D);
      const out = withFiles ? await HsDrawing.merge(PDFLib, cover, dwFiles) : cover;
      const nm = (I.congTrinh || 'du an').replace(/[\\/:*?"<>|]/g, '');
      saveAs(new Blob([out], { type: 'application/pdf' }), withFiles ? `Ban ve thi cong (kem bia va trang ky) - ${nm}.pdf` : `Bia va trang ky ban ve - ${nm}.pdf`);
      DW._last = new Date().toISOString();
      stEl.textContent = '✓ Đã tạo PDF'; saveSoon();
    } catch (e) { console.error(e); stEl.textContent = '⚠ ' + e.message; }
  }

  // ---------- gắn sự kiện ----------
  function wire() {
    $('hsFilter').addEventListener('input', paintList);
    $('hsTable').addEventListener('click', (e) => {
      const o = e.target.closest('[data-open]'); if (o) { location.search = '?p=' + o.dataset.open; return; }
      const d = e.target.closest('[data-del]'); if (d) { delProject(d.dataset.del); return; }
      const dd = e.target.closest('[data-deldraft]'); if (dd) { delDraft(dd.dataset.deldraft); return; }
      const gr = e.target.closest('[data-grant]'); if (gr) { grantDlg(gr.dataset.grant); return; }
      const tr = e.target.closest('tr[data-id]'); if (tr && !e.target.closest('button')) location.search = '?p=' + tr.dataset.id;
    });
    $('hsNew').onclick = () => { location.search = '?p=new'; };
    $('hsSave').onclick = () => save('manual');
    $('hsToList').onclick = toList;
    // ghi nhận sửa → nháp trên máy; xuất tài liệu ở các chức năng cũ → lưu sau khi xuất
    document.querySelector('.wrap').addEventListener('input', onEdit);
    document.querySelector('.wrap').addEventListener('change', onEdit);
    document.addEventListener('click', (e) => { const b = e.target.closest('button[onclick]'); if (b && /export|Excel|PDF|downloadLetter|exportLetter/i.test(b.getAttribute('onclick'))) saveSoon(); }, true);
    document.querySelectorAll('[data-fn]').forEach(b => b.addEventListener('click', () => {
      const f = b.dataset.fn;
      if (f === 'schedule' || f === 'quality') { prefillCommon(); chooseFn(f); }
      else enter(f);
    }));
    // công văn
    $('hsLetterList').addEventListener('click', (e) => { const b = e.target.closest('[data-letter]'); if (!b) return; curLetter = b.dataset.letter; renderLetters(); });
    $('hsLetterForm').addEventListener('input', (e) => { const k = e.target.dataset.lk; if (k && curLetter) (LT[curLetter] || (LT[curLetter] = {}))[k] = e.target.value; });
    $('hsLetterForm').addEventListener('click', (e) => { if (e.target.id === 'hsLetterGo') exportLetter(); });
    // pháp lý
    $('hsLgNgay').addEventListener('input', (e) => { LG.ngay = e.target.value; });
    $('hsPeople').addEventListener('input', (e) => { const k = e.target.dataset.pk, tr = e.target.closest('tr[data-i]'); if (!k || !tr) return; LG.people[+tr.dataset.i][k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; });
    $('hsPeople').addEventListener('change', (e) => {
      const tr = e.target.closest('tr[data-i]'); if (!tr) return; const x = LG.people[+tr.dataset.i];
      if (e.target.dataset.pk === 'role') { const r = HsLegal.ROLES[x.role] || {}; x.bch = !!r.bch; x.pccc = !!r.pccc || x.pccc; renderLegal(); }
      if (e.target.type === 'checkbox') x[e.target.dataset.pk] = e.target.checked;
    });
    $('hsPeople').addEventListener('click', (e) => { const b = e.target.closest('[data-pdel]'); if (b) { LG.people.splice(+b.dataset.pdel, 1); renderLegal(); onEdit(); } });
    $('hsAddPerson').onclick = () => { LG.people.push({ ten: '', gioi: 'Ông', role: 'cn', bch: false, pccc: false }); renderLegal(); };
    $('hsMachines').addEventListener('input', (e) => { const k = e.target.dataset.mk, tr = e.target.closest('tr[data-i]'); if (k && tr) LG.machines[+tr.dataset.i][k] = e.target.value; });
    $('hsMachines').addEventListener('click', (e) => { const b = e.target.closest('[data-mdel]'); if (b) { LG.machines.splice(+b.dataset.mdel, 1); renderLegal(); onEdit(); } });
    $('hsAddMachine').onclick = () => { LG.machines.push({ ten: '', dvt: 'Chiếc', sl: 1 }); renderLegal(); };
    $('hsResetMachines').onclick = () => { if (confirm('Đưa danh sách máy móc về danh sách mặc định?')) { LG.machines = HsLegal.MAY_MOC.map(x => ({ ...x })); renderLegal(); onEdit(); } };
    $('hsLgDocs').addEventListener('change', (e) => { const id = e.target.dataset.doc; if (id) LG.docs[id] = e.target.checked; });
    $('hsLgDocs').addEventListener('click', (e) => { const a = e.target.closest('[data-one]'); if (a) { e.preventDefault(); exportLegal(a.dataset.one); } });
    $('hsLgGo').onclick = () => exportLegal();
    $('hsKhOld').addEventListener('input', (e) => { LG.khOld = e.target.value; });
    $('hsKhNew').addEventListener('input', (e) => { LG.khNew = e.target.value; });
    $('hsKhFile').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; exportKh(f); });
    // bản vẽ
    ['tieuDe', 'phuDe', 'heThong', 'thietBi', 'prefix', 'ngay', 'soBanVe'].forEach(k => $('hsDw_' + k).addEventListener('input', (e) => { DW[k] = e.target.value; }));
    $('hsDwKy').addEventListener('input', (e) => { const k = e.target.dataset.kk, box = e.target.closest('[data-i]'); if (k && box) DW.ky[+box.dataset.i][k] = e.target.value; });
    $('hsDwResetKy').onclick = () => { DW.ky = defaultKy(); renderDrawing(); onEdit(); };
    $('hsDwTable').addEventListener('input', (e) => { const k = e.target.dataset.dk, tr = e.target.closest('tr[data-i]'); if (k && tr) DW.list[+tr.dataset.i][k] = e.target.value; });
    $('hsDwTable').addEventListener('click', (e) => { const b = e.target.closest('[data-ddel]'); if (b) { DW.list.splice(+b.dataset.ddel, 1); paintDwList(); onEdit(); } });
    $('hsDwAdd').onclick = () => { DW.list.push({ so: `${DW.prefix || 'TM'}-${String(DW.list.length + 1).padStart(2, '0')}`, ten: '', kho: 'A3' }); paintDwList(); };
    $('hsDwFiles').addEventListener('change', (e) => { const fs = [...e.target.files]; e.target.value = ''; addDwFiles(fs); });
    $('hsDwClear').onclick = () => { dwFiles = []; DW.list = []; paintDwList(); onEdit(); };
    $('hsDwCover').onclick = () => exportDrawing(false);
    $('hsDwMerge').onclick = () => exportDrawing(true);
    window.addEventListener('beforeunload', (e) => {
      if (!st.booted || $('screenHome').classList.contains('hide') === false || readOnly()) return;
      try { if (json() !== st.lastJson) { saveDraft(); e.preventDefault(); e.returnValue = ''; } } catch (x) { /* bỏ qua */ }
    });
    setInterval(() => { if (st.booted && $('screenHome').classList.contains('hide') && (st.cur || projName())) save('auto'); }, AUTOSAVE_MS);
  }

  // ---------- khởi động ----------
  async function boot() {
    wire();
    const q = new URLSearchParams(location.search).get('p');
    if (!q) { $('hsBar').hidden = true; showScreen('screenHome'); loadList(); st.booted = true; return; }
    if (q === 'new') {
      const d = readDraft('hs_draft_new');
      if (d && d.data && confirm(`Có hồ sơ mới đang nhập dở trên máy này (${fmtTime(d.t)}). Mở tiếp?\n(Huỷ = bắt đầu hồ sơ trống.)`)) { restore(d.data); bar('Đã mở nháp trên máy — bấm Lưu để lưu hồ sơ', 'warn'); showScreen('screenChoose'); prefillCommon(); }
      else { try { localStorage.removeItem('hs_draft_new'); } catch (e) { /* bỏ qua */ } bar('Hồ sơ mới — nhập hợp đồng hoặc bỏ qua để nhập tay', ''); showScreen('screenContract'); }
      st.lastJson = ''; st.booted = true; return;
    }
    bar('Đang mở hồ sơ…');
    showScreen('screenChoose');
    try {
      const p = await Store.get(q);
      st.cur = head(p);
      restore(p.data);
      st.lastJson = json();
      const d = readDraft('hs_draft_' + p.id);
      if (!readOnly() && d && d.data && JSON.stringify(d.data) !== st.lastJson && confirm(`Trên máy này có thay đổi chưa lưu của hồ sơ “${p.name}” (${fmtTime(d.t)}).\nKhôi phục các thay đổi đó?`)) { restore(d.data); bar('Đã khôi phục thay đổi chưa lưu — bấm Lưu để lưu lên ' + (SERVER ? 'máy chủ' : 'danh sách'), 'warn'); }
      else { if (d) dropDraft(); bar('✓ Đã mở hồ sơ', 'ok'); }
      if (readOnly()) { dropDraft(); bar('👁 Chỉ xem — hồ sơ của ' + (p.createdBy || 'người khác') + '. Muốn sửa: liên hệ Admin để được cấp quyền. Vẫn xuất được tài liệu.', 'warn'); $('hsSave').disabled = true; $('hsSave').title = 'Bạn chưa có quyền sửa hồ sơ này'; }
      prefillCommon();
    } catch (e) { bar('⚠ ' + e.message, 'err'); showScreen('screenHome'); loadList(); }
    st.booted = true;
  }
  window.HS = { boot, save, toList, enter, info, snapshot, restore, prefillCommon, _st: st, _LT: LT, _LG: LG, _DW: DW };
})();
