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
  const LG = { ngay: '', people: [], machines: [], docs: {}, khOld: '', khNew: '', ed: {} };   // hồ sơ pháp lý
  // bìa & trang ký bản vẽ: 2 loại — bản vẽ thi công (shop drawing) và bản vẽ hoàn công (as-built), mỗi loại một bộ dữ liệu riêng
  const DWK = {
    shop: { label: 'Bản vẽ thi công (Shop drawing)', short: 'Bản vẽ thi công', tieuDe: 'BẢN VẼ THI CÔNG', phuDe: '(SHOP DRAWING)', kyTitle: 'DUYỆT BẢN VẼ THI CÔNG', prefix: 'TM', file: 'Ban ve thi cong' },
    asbuilt: { label: 'Bản vẽ hoàn công (As-built)', short: 'Bản vẽ hoàn công', tieuDe: 'BẢN VẼ HOÀN CÔNG', phuDe: '(AS-BUILT DRAWING)', kyTitle: 'XÁC NHẬN BẢN VẼ HOÀN CÔNG', prefix: 'HC', file: 'Ban ve hoan cong' },
  };
  const blankDW = (k) => ({ kind: k, tieuDe: DWK[k].tieuDe, phuDe: DWK[k].phuDe, kyTitle: DWK[k].kyTitle, heThong: 'HỆ THỐNG THANG MÁY', thietBi: '', prefix: DWK[k].prefix, ngay: '', soBanVe: '', list: [], ky: [], sets: [], opt: { a3: true, sep: true, idx: 'auto' } });
  const DWS = { shop: blankDW('shop'), asbuilt: blankDW('asbuilt') };
  let dwKind = 'shop', DW = DWS.shop;
  const dwFilesBy = { shop: [], asbuilt: [] };
  let dwFiles = dwFilesBy.shop;                              // bản vẽ tải lên: chỉ giữ trong bộ nhớ, không lưu lên máy chủ

  // ---------- chụp / khôi phục toàn bộ dữ liệu của công cụ ----------
  const SKIP = new Set(['ppInput', 'file', 'ct_file', 'hsFilter', 'hsKhFile', 'hsDwFiles']);
  function fieldEls() { return [...document.querySelectorAll('.wrap input[id], .wrap select[id], .wrap textarea[id]')].filter(el => el.type !== 'file' && !SKIP.has(el.id) && !el.closest('[data-hs-nosave]')); }
  function snapshot() {
    if (typeof pullForm === 'function') { try { pullForm(); } catch (e) { /* form chưa sẵn sàng */ } }
    const f = {};
    fieldEls().forEach(el => { f[el.id] = (el.type === 'checkbox' || el.type === 'radio') ? !!el.checked : el.value; });
    return { v: 1, S: JSON.parse(JSON.stringify(S)), f, lt: LT, lg: LG, dw: { ...DWS.shop }, dws: JSON.parse(JSON.stringify(DWS)) };
  }
  function restore(d) {
    if (!d || typeof d !== 'object') return;
    S.gplan = null; S.hsDone = {}; S.bbEd = {};   // bảng Gantt đã chỉnh thuộc từng dự án — không mang sang dự án khác
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
    Object.assign(LG, { ngay: '', people: [], machines: [], docs: {}, khOld: '', khNew: '', ed: {} }, d.lg || {});
    Object.keys(DWS).forEach(k => { const src = (d.dws && d.dws[k]) || (k === 'shop' ? d.dw : null); DWS[k] = Object.assign(blankDW(k), src || {}, { kind: k }); });
    DW = DWS[dwKind];
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
      dlg.addEventListener('cancel', (e) => e.preventDefault()); // chỉ đóng bằng nút Đóng / Lưu quyền
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
    const sub = String(screen).split(':'); screen = sub[0];
    if (screen === 'screenDrawing' && sub[1] && DWK[sub[1]]) { dwFilesBy[dwKind] = dwFiles; dwKind = sub[1]; DW = DWS[dwKind]; dwFiles = dwFilesBy[dwKind]; }
    prefillCommon();
    if (typeof prefillQuality === 'function' && /screenLetters|screenNhatKy/.test(screen)) { try { prefillQuality(); } catch (e) { /* bỏ qua */ } }
    showScreen(screen);
    if (screen === 'screenLetters') renderLetters();
    if (screen === 'screenLegal') renderLegal();
    if (screen === 'screenDrawing') renderDrawing();
  }

  // ===== Điều hướng theo tab + Tổng quan dự án =====
  const TAB_IC = {};   // biểu tượng lấy từ thanh tab (một nguồn)
  const tabIcon = (k) => TAB_IC[k] || (TAB_IC[k] = (document.querySelector(`#hsTabs [data-go="${k}"] .ti`) || {}).innerHTML || '');
  function go(tab) {
    if (st.booted && !readOnly() && (st.cur || projName())) save('nav');
    prefillCommon(); syncInfo();
    if (tab === 'overview') { showScreen('screenChoose'); return; }
    if (tab === 'info') { showScreen('screenInfo'); return; }
    if (tab === 'schedule' || tab === 'quality') { chooseFn(tab); syncInfo(); return; }
    enter({ nhatky: 'screenNhatKy', letters: 'screenLetters', legal: 'screenLegal', drawing: 'screenDrawing' }[tab] || 'screenChoose');
  }
  function onScreen(name) {
    const hb = $('hsBar'); if (hb) document.documentElement.style.setProperty('--hs-bar-h', (hb.offsetHeight + 8) + 'px');
    if (name === 'screenChoose') renderOverview();
    if (name === 'screenInfo') renderMeter();
    if (name === 'quality' || name === 'screenLegal') buildToc(name);
  }
  // ghi lại lần xuất gần nhất của từng chức năng (hiện ở Tổng quan)
  function markDone(k) { S.hsDone = Object.assign({}, S.hsDone, { [k]: new Date().toISOString() }); }
  // ===== Một nguồn thông tin dự án: các ô trùng ở Tiến độ / Hồ sơ chất lượng / Biên bản bàn giao chỉ hiển thị (đồng bộ từ tab Thông tin dự án) =====
  const dmyOf = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
  const MIRROR = [   // [ô trùng, ô gốc ở tab Thông tin dự án, khoá S.project, đổi định dạng]
    ['p_name', 'hs_congtrinh', 'name'], ['p_addr', 'hs_diadiem', 'addr'], ['p_no', 'hs_sohd', 'no'], ['p_cdate', 'hs_ngayhd', 'cdate', dmyOf],
    ['p_buyer', 'hs_cdt', 'buyer'], ['p_rep', 'hs_cdt_daidien', 'rep'], ['p_baddr', 'hs_cdt_diachi', 'baddr'], ['p_seller', 'hs_nhathau', 'seller'], ['p_equip', 'hs_thietbi', 'equip'],
    ['q_congtrinh', 'hs_congtrinh'], ['q_diadiem', 'hs_diadiem'], ['q_hangmuc', 'hs_hangmuc'], ['q_sohd', 'hs_sohd'], ['q_ngayhd', 'hs_ngayhd'],
    ['q_cdt_diachi', 'hs_cdt_diachi'], ['q_cdt_daidien', 'hs_cdt_daidien'], ['q_nt_diachi', 'hs_nt_diachi'],
  ];
  function syncInfo() {
    const P = S.project || (S.project = {});
    MIRROR.forEach(([mid, src, key, fmt]) => {
      const el = $(mid), v = gv(src); if (!el) return;
      if (!el.dataset.mirror) {   // lần đầu: khoá ô, gắn nhãn
        el.dataset.mirror = src; el.readOnly = true; el.classList.add('hs-mirror'); el.title = 'Lấy từ tab Thông tin dự án — bấm để sửa ở đó';
        const lb = el.closest('.f') && el.closest('.f').querySelector('label'); if (lb && !lb.querySelector('.hs-lnk')) lb.insertAdjacentHTML('beforeend', ' <span class="hs-lnk" aria-hidden="true">🔗</span>');
      }
      if (!v) return;   // ô gốc trống: giữ giá trị cũ (đã được chép sang ô gốc bằng prefillCommon nếu có)
      const val = fmt ? fmt(v) : v; el.value = val; if (key) P[key] = val;
    });
  }
  function mirrorClick(e) {
    const el = e.target.closest && e.target.closest('.hs-mirror'); if (!el) return;
    const src = el.dataset.mirror; go('info');
    setTimeout(() => { const t = $(src); if (t) { t.scrollIntoView({ block: 'center' }); t.focus({ preventScroll: true }); t.classList.add('hs-flash'); setTimeout(() => t.classList.remove('hs-flash'), 1600); } }, 350);
  }

  // mức độ đầy đủ của Thông tin dự án
  const INFO_REQ = [['hs_congtrinh', 'Tên công trình'], ['hs_diadiem', 'Địa điểm'], ['hs_cdt', 'Chủ đầu tư'], ['hs_cdt_diachi', 'Địa chỉ CĐT'], ['hs_sohd', 'Số hợp đồng'], ['hs_ngayhd', 'Ngày ký HĐ'],
    ['hs_thietbi', 'Thiết bị'], ['hs_nguoiky', 'Người ký'], ['hs_chucvuky', 'Chức vụ người ký'], ['hs_pm_ten', 'Người liên hệ'], ['hs_pm_dt', 'Điện thoại liên hệ'], ['hs_cht', 'Chỉ huy trưởng']];
  function infoFill() { const miss = INFO_REQ.filter(([id]) => !gv(id)); return { n: INFO_REQ.length - miss.length, total: INFO_REQ.length, miss }; }
  function meterHtml(f, cta) {
    const pct = Math.round(f.n / f.total * 100), ok = !f.miss.length;
    return `<div class="hs-mt${ok ? ' ok' : ''}"><div class="hs-mt-h"><b>${ok ? '✓ Đã đủ thông tin chính' : `Đã điền ${f.n}/${f.total} thông tin chính`}</b>${cta || ''}</div>
      <div class="hs-mt-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${f.total}" aria-valuenow="${f.n}"><i style="width:${pct}%"></i></div>
      ${ok ? '' : `<div class="hs-mt-miss">Còn thiếu: ${f.miss.map(([id, t]) => `<button type="button" class="hs-chip" data-focus="${id}">${esc(t)}</button>`).join('')}</div>`}</div>`;
  }
  function renderMeter() {
    const box = $('hsInfoMeter'); if (!box) return;
    box.innerHTML = meterHtml(infoFill());
    box.onclick = (e) => { const c = e.target.closest('[data-focus]'); if (c) { const el = $(c.dataset.focus); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => el.focus({ preventScroll: true }), 300); } } };
  }
  const dShort = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };
  function renderOverview() {
    const box = $('hsOverview'); if (!box) return;
    const I = info(), done = S.hsDone || {}, f = infoFill();
    const nLet = Object.keys(LT).filter(k => LT[k] && LT[k]._last).length + (done.letters ? 0 : 0);
    const totalLet = HsLetters.LETTERS.length + 2;
    let sched = null;
    try { if (typeof planSchedule === 'function' && S.gplan && S.gplan.items && S.gplan.items.length) { const L = (S.gplans && S.gplans.list) || []; const m = L.find((x) => x.main) || S.gplan; const p = planSchedule(m); sched = `${p.total} ngày · xong ${dShort(p.end.toISOString())}${L.length > 1 ? ` · ${L.length} bảng` : ''}`; } } catch (e) { /* chưa lập */ }
    const st2 = (k, alt) => done[k] ? { t: 'Đã xuất ' + dShort(done[k]), ok: true } : alt || { t: 'Chưa xuất', ok: false };
    const nEl = (S.qElevs || []).filter(e => String(e.name || '').trim()).length;
    const cards = [
      ['schedule', 'Tiến độ thi công', 'Lập bảng tiến độ theo hợp đồng, chỉnh kéo thả trên Gantt, xuất Excel / PDF A3 và thư xác nhận hàng về.', sched ? { t: sched, ok: true } : st2('schedule', { t: 'Chưa lập', ok: false })],
      ['quality', 'Hồ sơ chất lượng', 'Bộ hồ sơ nghiệm thu (Word): các bên, chứng từ hàng hoá, danh sách thang, đợt nghiệm thu.', st2('quality', nEl ? { t: `${nEl} thang · chưa xuất`, ok: false } : null)],
      ['nhatky', 'Nhật ký thi công', 'Sổ nhật ký thi công xây dựng — điền sẵn ngày từng trang.', st2('nhatky')],
      ['letters', 'Công văn, biên bản', 'Thông báo hàng về, tồn tại giếng thang, mời kiểm định, bàn giao, RFA / RFI, báo giá phát sinh…', nLet ? { t: `Đã xuất ${nLet}/${totalLet} văn bản`, ok: true } : { t: `${totalLet} mẫu có sẵn`, ok: false }],
      ['legal', 'Hồ sơ pháp lý', 'Bìa, danh mục, quyết định Ban chỉ huy, trách nhiệm, chữ ký mẫu, đội PCCC, sơ đồ tổ chức, máy móc.', st2('legal')],
      ['drawing', 'Bìa & trang ký bản vẽ', 'Shop drawing / As-built: ghép A3, trang ngăn cách, danh mục, bìa và trang ký.', done.drawing_shop || done.drawing_asbuilt ? { t: 'Đã tạo ' + [done.drawing_shop && 'shop', done.drawing_asbuilt && 'as-built'].filter(Boolean).join(' + '), ok: true } : { t: 'Chưa tạo', ok: false }],
    ];
    const chip = (lb, v) => v ? `<span class="hs-kv"><small>${lb}</small>${esc(v)}</span>` : '';
    box.innerHTML = `<div class="panel hs-sum">
        <div class="hs-sum-t"><div><div class="hs-lbl">Công trình</div><h2 class="hs-sum-n">${esc(I.congTrinh || 'Chưa đặt tên công trình')}</h2>${I.diaDiem ? `<div class="hs-mini">${esc(I.diaDiem)}</div>` : ''}</div>
          <button type="button" class="btn sm gho" data-go="info">✎ Sửa thông tin dự án</button></div>
        <div class="hs-kvs">${chip('Chủ đầu tư', I.chuDauTu)}${chip('Hợp đồng', I.soHD ? I.soHD + (I.ngayHD ? ' · ' + dShort(I.ngayHD) : '') : '')}${chip('WBS', I.wbs)}${chip('Thiết bị', I.thietBi)}${chip('Số thang', I.soThang)}</div>
        ${meterHtml(f, f.miss.length ? '<button type="button" class="btn sm sec" data-go="info">Bổ sung →</button>' : '')}
      </div>
      <div class="hs-ovh"><h2>Chức năng</h2><span class="hs-mini">Bấm để mở — hoặc dùng thanh tab phía trên. Mọi thứ nhập vào được lưu theo dự án.</span></div>
      <div class="hs-fgrid">${cards.map(([k, t, d, s2]) => `<button type="button" class="hs-fc" data-go="${k}">
          <span class="hs-fi">${tabIcon(k)}</span><span class="hs-ft"><b>${t}</b><span>${d}</span></span>
          <span class="hs-fs2 ${s2.ok ? 'ok' : ''}">${s2.ok ? '✓ ' : ''}${esc(s2.t)}</span><span class="hs-go" aria-hidden="true">Mở →</span></button>`).join('')}</div>`;
    box.querySelector('.hs-mt').onclick = (e) => { const c = e.target.closest('[data-focus]'); if (c) { go('info'); setTimeout(() => { const el = $(c.dataset.focus); if (el) { el.scrollIntoView({ block: 'center' }); el.focus({ preventScroll: true }); } }, 350); } };
  }
  // mục lục nhảy nhanh cho màn hình dài (Hồ sơ chất lượng, Hồ sơ pháp lý)
  function buildToc(id) {
    const sec = $(id); if (!sec) return;
    const panels = [...sec.querySelectorAll(':scope > .panel')].filter(p => p.querySelector('h2'));
    let nav = sec.querySelector(':scope > .hs-toc');
    if (panels.length < 3) { if (nav) nav.remove(); return; }
    if (!nav) { nav = document.createElement('nav'); nav.className = 'hs-toc'; nav.setAttribute('aria-label', 'Đến nhanh mục'); sec.insertBefore(nav, sec.firstChild); }
    nav.innerHTML = '<span class="hs-toc-l">Đến mục:</span>' + panels.map((p, i) => {
      if (!p.id) p.id = id + '_m' + i;
      const h = p.querySelector('h2').cloneNode(true); h.querySelectorAll('.det,.pill,.hs-mini').forEach(x => x.remove());
      const no = (h.querySelector('.no') || {}).textContent || ''; const t = h.textContent.replace(no, '').trim().replace(/\s*\(.*$/, '');
      return `<a href="#${p.id}" data-toc="${p.id}">${no && no.length <= 3 ? `<b>${esc(no)}</b> ` : ''}${esc(t.length > 34 ? t.slice(0, 32) + '…' : t)}</a>`;
    }).join('');
    // tô mục đang xem
    const mark = () => { if (sec.classList.contains('hide')) return; const top = (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--hs-bar-h')) || 100) + 70; let cur = panels[0];
      panels.forEach(p => { if (p.getBoundingClientRect().top <= top) cur = p; }); nav.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.toc === cur.id)); };
    if (!sec._tocScroll) { sec._tocScroll = true; window.addEventListener('scroll', () => { clearTimeout(sec._tocT); sec._tocT = setTimeout(mark, 60); }, { passive: true }); }
    mark();
    nav.onclick = (e) => { const a = e.target.closest('[data-toc]'); if (!a) return; e.preventDefault(); const el = $(a.dataset.toc); const y = el.getBoundingClientRect().top + window.scrollY - (($('hsBar') || {}).offsetHeight || 0) - 56; window.scrollTo({ top: y, behavior: 'smooth' }); };
  }

  // ===== Công văn, biên bản =====
  let tplBuf = null, curLetter = null;
  const letterTpl = async () => tplBuf || (tplBuf = await fetch('thu_hangve_template.docx', { cache: 'force-cache' }).then(r => { if (!r.ok) throw new Error('Không tải được khuôn công văn'); return r.arrayBuffer(); }));
  // biểu tượng (nét, 24×24) cho từng văn bản
  const LI = {
    pause: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7M14 8.5v7"/>',
    stamp: '<path d="M9 3h6l-1 6h-4z"/><path d="M5 13h14a1 1 0 0 1 1 1v3H4v-3a1 1 0 0 1 1-1z"/><path d="M10 9v4M14 9v4M5 21h14"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.3 9.3a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.4-2.7 4"/><path d="M12 17.5h.01"/>',
    calc: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M10 11h5M10 14.5h5M10 18h3"/><path d="M4 8v10" opacity=".55"/>',
    pkgok: '<path d="M21 8l-9-5-9 5v8l9 5 4-2.2"/><path d="M3 8l9 5 9-5M12 13v8"/><path d="M16.5 17.5l1.8 1.8 3.2-3.6"/>',
    truck: '<path d="M2 6h11v9H2zM13 9h4l3 3v3h-7"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 14h3v3H8z"/>',
    shaft: '<rect x="6" y="2.5" width="12" height="19" rx="1"/><path d="M12 2.5v19"/><path d="M9 8l-1.5 2.5h3zM15 16l1.5-2.5h-3z"/>',
    warn: '<path d="M12 3.5L2.5 20h19z"/><path d="M12 10v4.5M12 17.3h.01"/>',
    clip: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M8.5 12.5l2.2 2.2 4.8-5"/>',
    mail: '<rect x="3" y="5.5" width="18" height="13.5" rx="2"/><path d="M3.6 7.2L12 13l8.4-5.8"/>',
    gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/><circle cx="12" cy="18" r="1.3"/>',
    ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
    award: '<circle cx="12" cy="9" r="6"/><path d="M9 14.5L7.5 21l4.5-2.5 4.5 2.5L15 14.5"/><path d="M9.5 9l1.7 1.7L14.5 7.5"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10.5" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/><path d="M12 14.5v2.5"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>',
    hand: '<path d="M3 14h4l3 2h4a1.5 1.5 0 0 1 0 3H9"/><path d="M7 14l3.5-3h4l4.5 3.5"/><path d="M3 20h4"/><rect x="13" y="3" width="7" height="6" rx="1"/>',
    teach: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/><path d="M22 9v6"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    cone: '<path d="M10.4 3h3.2l5 16H5.4z"/><path d="M7.6 12h8.8M8.9 7.8h6.2"/><path d="M3 19.5h18"/>',
  };
  const lic = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${LI[k] || LI.mail}</svg>`;
  // giai đoạn dự án → màu; mỗi văn bản: icon, tên ngắn, mô tả 1 dòng; jump = mẫu nằm ở khung bên dưới
  const LPHASE = [
    { id: 'td', name: 'Trình duyệt & phát sinh', note: 'trước và trong khi thi công', c: '#7c3aed', items: [
      { id: 'rfa', ic: 'stamp', t: 'RFA — Đề xuất phê duyệt', s: 'Trình bản vẽ, vật tư, biện pháp, tiến độ để CĐT / TVGS duyệt' },
      { id: 'rfi', ic: 'help', t: 'RFI — Yêu cầu cung cấp thông tin', s: 'Hỏi CĐT làm rõ cao độ, nguồn điện, kích thước…' },
      { id: 'bao_gia_ps', ic: 'calc', t: 'Báo giá công việc phát sinh', s: 'Tự tính tổng, VAT, bằng chữ; điều khoản thanh toán' }] },
    { id: 'hv', name: 'Trước khi hàng về', note: 'chuẩn bị mặt bằng, giao hàng', c: '#2563eb', items: [
      { id: 'xn_hangve', ic: 'pkgok', t: 'Thư xác nhận ngày giao vật tư về công trường', s: 'Ngày hàng về, mặt bằng lưu kho — có ô Khách hàng xác nhận' },
      { id: 'hangve1', ic: 'cal', t: 'Thông báo hàng về — lần 1', s: 'Gửi trước 30 ngày: lịch hàng về, yêu cầu mặt bằng' },
      { id: 'hangve2', ic: 'truck', t: 'Thông báo hàng về — lần 2', s: 'Gửi trước 1 tuần: ngày giao, kho bãi, đường vận chuyển' },
      { id: 'defect_mos', ic: 'shaft', t: 'Tồn tại giếng thang trước khi hàng về', s: 'Kết quả khảo sát giếng thang, hạng mục CĐT cần sửa' },
      { jump: 'hsBBPanel', focus: 'bx_ngay', key: 'bbxn', bb: true, ic: 'clip', t: 'BB xác nhận thiết bị đến công trường', s: 'Lấy dữ liệu chứng từ từ Hồ sơ chất lượng' }] },
    { id: 'kd', name: 'Thi công & kiểm định', note: 'lắp đặt, nghiệm thu', c: '#0891b2', items: [
      { id: 'defect_ld', ic: 'cone', t: 'Tồn tại giếng thang & điều kiện công trường trước lắp đặt', s: 'Danh sách tồn tại + bảng kiểm tra kho, điện, lan can, móc treo…' },
      { id: 'tam_dung', ic: 'pause', t: 'Thông báo tạm dừng thi công', s: 'Tồn đọng CĐT / nhà thầu XD, hiện trạng, khối lượng còn lại; báo trước 07 ngày để quay lại' },
      { id: 'bao_quan', ic: 'lock', t: 'Bảo quản tài sản khi tạm dừng', s: 'Trách nhiệm bảo quản thiết bị khi công trường dừng' },
      { id: 'defect_kd', ic: 'warn', t: 'Tồn tại giếng thang trước kiểm định', s: 'Các hạng mục cần khắc phục trước khi kiểm định' },
      { id: 'moi_kd', ic: 'mail', t: 'Thư mời kiểm định thang máy', s: 'Mời CĐT / TVGS tham gia kiểm định' },
      { id: 'bb_cote', ic: 'ruler', t: 'BB nghiệm thu cote cửa tầng', s: 'Biên bản hiện trường kiểm tra cao độ cửa tầng' },
      { id: 'kq_nt', ic: 'award', t: 'Thông báo kết quả nghiệm thu', s: 'Kết quả nghiệm thu / kiểm định từng hạng mục' }] },
    { id: 'bg', name: 'Bàn giao & bảo hành', note: 'đưa vào sử dụng', c: '#059669', items: [
      { id: 'ban_giao', ic: 'key', t: 'Thông báo bàn giao thang máy', s: 'Đề nghị CĐT nhận bàn giao, đưa vào sử dụng' },
      { jump: 'hsBanGiaoH', key: 'bangiao', bb: true, ic: 'hand', t: 'BB bàn giao thang máy (song ngữ)', s: 'Mỗi thang 1 biên bản — dữ liệu từ Hồ sơ chất lượng' },
      { id: 'bb_huanluyen', ic: 'teach', t: 'BB huấn luyện & bàn giao chìa khoá', s: 'Hướng dẫn sử dụng, cứu hộ, giao chìa khoá' },
      { id: 'han_bh', ic: 'shield', t: 'Thời hạn bảo hành, bảo trì', s: 'Thông báo thời hạn bảo hành, bảo trì miễn phí' },
      { id: 'tinh_bh', ic: 'clock', t: 'Cách tính thời gian bảo hành', s: 'Mốc bắt đầu tính bảo hành, bảo trì miễn phí' }] },
  ];
  const LKIND = (it, d) => it.bb || (d && d.kind === 'bb') ? 'bb' : d && d.kind === 'rfa' ? 'phieu' : 'cv';
  const LTAG = { cv: 'CV', bb: 'BB', phieu: '' };
  let lQuery = '', lKind = '';
  // văn bản chưa có trong LPHASE (thêm mẫu mới sau này) → nhóm "Khác"
  function letterPhases() {
    const known = new Set(LPHASE.flatMap(g => g.items.map(i => i.id).filter(Boolean)));
    const extra = HsLetters.LETTERS.filter(d => !known.has(d.id)).map(d => ({ id: d.id, ic: d.kind === 'bb' ? 'clip' : 'mail', t: d.name, s: '' }));
    return extra.length ? [...LPHASE, { id: 'khac', name: 'Văn bản khác', note: '', c: '#64748b', items: extra }] : LPHASE;
  }
  const letterMeta = (id) => { for (const g of letterPhases()) { const it = g.items.find(i => i.id === id); if (it) return { g, it }; } return null; };
  const vnFold = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  function renderLetters() {
    const list = $('hsLetterList'), form = $('hsLetterForm'), bar = $('hsLetterBar');
    const open = !!HsLetters.LETTERS.find(x => x.id === curLetter);
    list.hidden = open; bar.hidden = open; form.hidden = !open;
    const xm = $('hsXnEmail'); if (xm) { xm.hidden = !(open && curLetter === 'xn_hangve'); if (!xm.hidden && typeof window.buildEmail === 'function') { try { window.buildEmail(); } catch (e) { /* chưa lập tiến độ */ } } }
    if (open) { renderLetterForm(); return; }
    const q = vnFold(lQuery).trim();
    let n = 0;
    const html = letterPhases().map((g, gi) => {
      const tiles = g.items.map(it => {
        const d = it.id ? HsLetters.LETTERS.find(x => x.id === it.id) : null;
        if (it.id && !d) return '';
        const kind = LKIND(it, d);
        if (lKind && kind !== lKind) return '';
        if (q && !vnFold(`${it.t} ${it.s} ${d ? d.name : ''} ${g.name} ${LTAG[kind]}`).includes(q)) return '';
        n++;
        const done = d && LT[d.id] && LT[d.id]._last;
        const tag = LTAG[kind] ? `<span class="hs-tag">${LTAG[kind]}</span>` : '';
        return `<button type="button" class="hs-tile${tag ? ' tg' : ''}" style="--pc:${g.c}" ${it.jump ? `data-jump="${it.jump}"${it.focus ? ` data-focus="${it.focus}"` : ''}` : `data-letter="${it.id}"`} title="${esc(d ? d.name : it.t)}">
          <span class="hs-tic">${lic(it.ic)}</span><span class="hs-tt"><b>${tag}${esc(it.t)}</b><span>${esc(it.s)}</span>${it.jump ? '<span class="hs-go">↓ mẫu ở khung bên dưới</span>' : ''}</span>
          ${done ? `<span class="hs-done" title="Đã xuất lúc ${esc(fmtTime(done))}">✓</span>` : ''}</button>`;
      }).join('');
      return tiles ? `<section class="hs-phase" style="--pc:${g.c}"><div class="hs-ph"><span class="pn">${gi + 1}</span><b>${esc(g.name)}</b>${g.note ? `<small>· ${esc(g.note)}</small>` : ''}</div><div class="hs-tiles">${tiles}</div></section>` : '';
    }).join('');
    list.innerHTML = n ? html : `<div class="hs-empty">Không có văn bản nào khớp “${esc(lQuery)}”. <button type="button" class="hs-link" data-lclear>Xoá bộ lọc</button></div>`;
  }
  function renderLetterForm() {
    const host = $('hsLetterForm');
    const d = HsLetters.LETTERS.find(x => x.id === curLetter);
    if (!d) { host.innerHTML = ''; return; }
    const v = LT[d.id] || (LT[d.id] = {});
    // thư hàng về: điền sẵn ngày hàng về / mặt bằng / số thang từ bảng tiến độ (không ghi đè ô đã sửa)
    if (d.id === 'xn_hangve' && typeof window.xnDefaults === 'function') { try { const o = window.xnDefaults(); Object.keys(o).forEach(k => { if (o[k] && (v[k] == null || v[k] === '' || (k === 'soThang' && v[k] === '01'))) v[k] = o[k]; }); } catch (e) { /* chưa lập tiến độ */ } }
    // gợi ý số tiếp theo: lấy số của văn bản cùng loại xuất gần nhất (công văn chung 1 dãy số; biên bản 1 dãy; RFA / RFI mỗi loại 1 dãy)
    const same = (x) => x && (d.kind === 'rfa' ? x.id === d.id : x.kind === d.kind);
    const lastSo = Object.keys(LT).filter(k => k !== d.id && LT[k] && LT[k].so && LT[k]._last && same(HsLetters.LETTERS.find(x => x.id === k)))
      .sort((a, b) => String(LT[b]._last).localeCompare(String(LT[a]._last)))[0];
    const sugg = !v.so && lastSo ? HsLetters.nextSo(LT[lastSo].so) : '';
    const fld = (k, label, type, o = {}) => {
      const val = v[k] != null ? v[k] : (o.def || '');
      const inp = type === 'textarea' ? `<textarea data-lk="${k}" rows="${o.rows || 4}" placeholder="${esc(o.ph || '')}">${esc(val)}</textarea>`
        : type === 'select' ? `<input data-lk="${k}" type="text" list="dl_${k}" value="${esc(val)}" placeholder="${esc(o.ph || 'chọn hoặc gõ')}"><datalist id="dl_${k}">${(o.options || []).map(x => `<option value="${esc(x)}">`).join('')}</datalist>`
        : `<input data-lk="${k}" type="${type === 'date' ? 'date' : 'text'}" value="${esc(val)}" placeholder="${esc(o.ph || '')}">`;
      const hint = k === 'so' && sugg ? `<button type="button" class="hs-link" data-sonext="${esc(sugg)}" title="Số tiếp theo sau ${esc(LT[lastSo].so)}">↳ Dùng số tiếp theo: ${esc(sugg)}</button>` : '';
      return `<div class="f${type === 'textarea' || o.wide ? ' hs-wide' : ''}"><label>${esc(label)}</label>${inp}${hint}</div>`;
    };
    const m = letterMeta(d.id), pc = m ? m.g.c : '#64748b';
    host.innerHTML = `<div class="hs-fh" style="--pc:${pc}"><span class="hs-tic">${lic(m ? m.it.ic : 'mail')}</span><div><h3>${esc(d.name)}</h3><p>${m ? esc(m.g.name) + (m.it.s ? ' · ' + esc(m.it.s) : '') : ''}</p></div><button type="button" class="btn gho sm hs-back" data-lback>← Tất cả văn bản</button></div>
      <div class="hs-lfw${pvWide ? ' wide' : ''}"><div class="hs-lfc"><p class="hs-lfh"><b>① Thông tin</b> — điền từng ô; bản xem trước bên cạnh cập nhật ngay.</p>
      <div class="grid g2">${fld('so', d.kind === 'bb' ? 'Số biên bản' : d.kind === 'rfa' ? 'Số ' + d.id.toUpperCase() : 'Số công văn', 'text', { ph: d.kind === 'rfa' ? `VD: ${d.id.toUpperCase()}-SCH-001` : 'VD: 125/2026/SCH-HN' })}${fld('ngay', 'Ngày lập', 'date', { def: todayISO() })}
      ${(d.fields || []).map(x => fld(x.k, x.label, x.type || 'text', x)).join('')}
      ${d.kind === 'letter' ? fld('kinhGui', 'Kính gửi (để trống = Chủ đầu tư)', 'text', { ph: gv('hs_cdt') }) + fld('dongKinhGui', 'Đồng kính gửi (để trống = Ban QLDA; TVGS)', 'text', { ph: [gv('hs_qlda'), gv('hs_tvgs')].filter(Boolean).join('; ') }) : ''}</div>
      <div class="row hs-lgo" style="gap:10px;margin-top:12px"><button class="btn pri" id="hsLetterGo">⬇ Xuất ${d.kind === 'bb' ? 'biên bản' : d.kind === 'rfa' ? 'phiếu ' + d.id.toUpperCase() : 'công văn'} (.docx)</button><span id="hsLetterSt" class="hs-mini"></span></div></div>
      <div class="hs-pvw"><div class="hs-pvbar"><b>② Xem trước &amp; sửa tay</b>
        <span class="hs-pvtools" role="toolbar" aria-label="Định dạng chữ trong đoạn đang sửa"><button type="button" data-fmt="bold" title="In đậm (Ctrl+B)"><b>B</b></button><button type="button" data-fmt="italic" title="In nghiêng (Ctrl+I)"><i>I</i></button><button type="button" data-fmt="underline" title="Gạch chân (Ctrl+U)"><u>U</u></button></span>
        <button type="button" class="btn gho sm" data-pvreset disabled title="Trả đoạn đang chọn về nội dung tự sinh từ ô thông tin">↺ Bỏ sửa đoạn này</button>
        <button type="button" class="btn gho sm" data-pvresetall hidden>↺ Bỏ mọi sửa tay</button>
        <button type="button" class="btn gho sm" data-pvwide title="Mở rộng / thu hẹp khung xem trước">${pvWide ? '⇤ Thu hẹp' : '⤢ Mở rộng'}</button></div>
        <p class="hs-pvhint">Bấm vào <b>từng đoạn</b> trên trang để sửa trực tiếp — mỗi đoạn là một ô riêng; đoạn đã sửa có <span class="hs-pvmark">vạch vàng</span>. Bản Word xuất ra đúng nội dung trang này (logo, chân trang theo mẫu công văn; chỗ ngắt trang có thể khác đôi chút).</p>
        <p class="hs-pvmiss" id="hsPvMiss" hidden></p>
        <div class="hs-pvs" id="hsPvScroll"><div class="pv-page" id="hsPv"></div></div></div></div>`;
    (d.fields || []).forEach(x => { if (v[x.k] == null && x.def) v[x.k] = x.def; });
    if (v.ngay == null) v.ngay = todayISO();
    renderLetterPreview();
  }
  // ---------- xem trước + sửa tay (hspreview.js) ----------
  let pvWide = false, pvTimer = 0, pvImgs = null, pvFocus = null;
  async function pvLogos() {
    if (pvImgs) return pvImgs;
    pvImgs = { a: '', b: '' };
    try {
      const z = await JSZip.loadAsync(await letterTpl());
      const url = async (n) => { const f = z.file('word/media/' + n); return f ? URL.createObjectURL(new Blob([await f.async('uint8array')], { type: 'image/jpeg' })) : ''; };
      pvImgs = { a: await url('image1.jpeg'), b: await url('image2.jpeg') };
    } catch (e) { /* không có logo: vẫn xem được thân văn bản */ }
    return pvImgs;
  }
  function renderLetterPreview() {
    const box = $('hsPv'), d = HsLetters.LETTERS.find(x => x.id === curLetter);
    if (!box || !d || !window.HsPreview) return;
    const v = LT[d.id] || (LT[d.id] = {});
    let out;
    try { out = HsPreview.toHtml(HsLetters.compose(d, info(), v), { ed: v._ed, editable: !readOnly() }); }
    catch (e) { box.innerHTML = `<p class="hs-mini">⚠ Chưa xem trước được: ${esc(e.message)}</p>`; return; }
    box.innerHTML = `<div class="pv-hd"><img data-logo="a" alt=""><img data-logo="b" alt=""></div><div class="pv-body">${out.html}</div>
      <div class="pv-ft">Schindler Vietnam Ltd.- Hanoi Branch · Suite 03, Level 12A Indochina Plaza Hanoi · 241 Xuan Thuy, Cau Giay, Hanoi, Vietnam · Tel (84-24) 3974 2677 · www.schindler.vn</div>`;
    pvLogos().then(L => box.querySelectorAll('[data-logo]').forEach(im => { if (L[im.dataset.logo]) im.src = L[im.dataset.logo]; else im.remove(); }));
    const n = out.count, miss = out.miss.length;
    const ra = host().querySelector('[data-pvresetall]'); if (ra) { ra.hidden = !(n || miss); ra.textContent = `↺ Bỏ mọi sửa tay (${n + miss})`; }
    const mi = $('hsPvMiss'); mi.hidden = !miss;
    if (miss) mi.innerHTML = `⚠ ${miss} đoạn sửa tay không còn khớp vì nội dung tự sinh đã đổi (do sửa ô thông tin) — sẽ <b>không</b> được dùng khi xuất. <button type="button" class="hs-link" data-pvdropmiss>Xoá các sửa tay này</button>`;
    pvFit(); pvToolbar();
  }
  const host = () => $('hsLetterForm');
  function pvFit() {
    const sc = $('hsPvScroll'), pg = $('hsPv'); if (!sc || !pg) return;
    const k = Math.min(1, (sc.clientWidth - 16) / pg.offsetWidth);
    pg.style.transform = k < 1 ? `scale(${k})` : ''; pg.style.transformOrigin = 'top left';
    pg.parentElement.style.height = k < 1 ? Math.ceil(pg.offsetHeight * k + 16) + 'px' : '';
  }
  function pvToolbar() {
    const b = host() && host().querySelector('[data-pvreset]'); if (!b) return;
    b.disabled = !(pvFocus && pvFocus.isConnected && pvFocus.classList.contains('ed'));
  }
  // lưu sửa tay của một đoạn (so với chữ gốc tự sinh; sửa về đúng như gốc thì bỏ)
  function pvSave(el) {
    const d = HsLetters.LETTERS.find(x => x.id === curLetter); if (!d || !el || readOnly()) return;
    const v = LT[d.id] || (LT[d.id] = {});
    const ed = v._ed || (v._ed = {});
    const runs = HsPreview.domToRuns(el), o = el.dataset.o || '';
    const base = HsPreview.paragraphs(HsLetters.compose(d, info(), v))[+el.dataset.pi];
    let k = el.dataset.k;
    if (base && HsPreview.canon(runs) === HsPreview.canon(base.runs)) { if (k != null) delete ed[k]; delete el.dataset.k; el.classList.remove('ed'); }
    else {
      if (k == null) { k = String(el.dataset.pi); if (ed[k]) k = k + '_' + Date.now().toString(36); el.dataset.k = k; }
      ed[k] = { o, x: runs }; el.classList.add('ed');
    }
    if (!Object.keys(ed).length) delete v._ed;
    const ra = host().querySelector('[data-pvresetall]'), n = Object.keys(v._ed || {}).length;
    if (ra) { ra.hidden = !n; ra.textContent = `↺ Bỏ mọi sửa tay (${n})`; }
    pvToolbar(); saveSoon();
  }
  // mở thẳng một văn bản trong mục Công văn, biên bản (VD từ nút ở mục Tiến độ)
  function openLetter(id) {
    go('letters');
    curLetter = HsLetters.LETTERS.find(x => x.id === id) ? id : null;
    lQuery = ''; lKind = ''; const q = $('hsLetterQ'); if (q) q.value = '';
    renderLetters();
    const f = $('hsLetterForm'); if (f) { (f.hidden ? $('screenLetters') : f).scrollIntoView({ block: 'start' }); f.classList.remove('hs-flash'); void f.offsetWidth; f.classList.add('hs-flash'); }
  }
  async function exportLetter() {
    const d = HsLetters.LETTERS.find(x => x.id === curLetter); if (!d) return;
    const stEl = $('hsLetterSt'); stEl.textContent = 'Đang tạo…';
    try {
      const zip = await HsLetters.build(JSZip, await letterTpl(), d, info(), LT[d.id] || {});
      saveAs(await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), HsLetters.fileName(d, info(), LT[d.id] || {}));
      LT[d.id]._last = new Date().toISOString();
      renderLetters(); saveSoon(); const st2 = $('hsLetterSt'); if (st2) st2.textContent = '✓ Đã xuất ' + fmtTime(LT[d.id]._last);
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
    $('hsLgDocs').innerHTML = HsLegal.DOCS.map((d, i) => `<label class="chk hs-doc"><input type="checkbox" data-doc="${d.id}"${LG.docs[d.id] === false ? '' : ' checked'}> ${i + 1}. ${esc(d.name)}${LG.ed && LG.ed[d.id] ? ' <span class="hs-edtag" title="Có sửa tay trên bản xem trước">✎ đã sửa</span>' : ''} <a href="#" data-lgpv="${d.id}">xem &amp; sửa</a> · <a href="#" data-one="${d.id}">tải riêng</a></label>`).join('');
    const sel = $('hsLgPvDoc'); if (sel && !sel.options.length) sel.innerHTML = HsLegal.DOCS.map((d, i) => `<option value="${d.id}">${i + 1}. ${esc(d.name)}</option>`).join('');
    if (lgPv && !$('hsLgPvWrap').hidden) lgPv.render();
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
      stEl.textContent = `✓ Đã xuất ${list.length} tài liệu`; markDone('legal'); saveSoon();
    } catch (e) { console.error(e); stEl.textContent = '⚠ ' + e.message; }
  }
  // xem trước + sửa tay từng văn bản pháp lý (khung chung HsPreview.mount)
  let lgPv = null, lgPvT = 0;
  function openLegalPreview(id) {
    const wrap = $('hsLgPvWrap'), btn = $('hsLgPvBtn');
    if (id) { $('hsLgPvDoc').value = id; wrap.hidden = false; }
    else wrap.hidden = !wrap.hidden;
    btn.textContent = wrap.hidden ? '👁 Xem trước & sửa tay' : '✕ Đóng xem trước'; btn.setAttribute('aria-expanded', String(!wrap.hidden));
    if (wrap.hidden) return;
    if (!lgPv) lgPv = HsPreview.mount($('hsLgPvHost'), {
      pageClass: 'pv-legal',
      build: async () => HsLegal.compose($('hsLgPvDoc').value, info(), LG),
      getEd: () => (LG.ed || {})[$('hsLgPvDoc').value],
      setEd: (ed) => { const id = $('hsLgPvDoc').value; LG.ed = LG.ed || {}; if (ed) LG.ed[id] = ed; else delete LG.ed[id]; saveSoon(); const t = document.querySelector(`#hsLgDocs [data-doc="${id}"]`); if (t) { const lab = t.closest('label'), tag = lab.querySelector('.hs-edtag'); if (ed && !tag) lab.querySelector('[data-lgpv]').insertAdjacentHTML('beforebegin', '<span class="hs-edtag" title="Có sửa tay trên bản xem trước">✎ đã sửa</span> '); if (!ed && tag) tag.remove(); } },
      editable: () => !readOnly(),
    });
    lgPv.render();
    wrap.scrollIntoView({ block: 'start', behavior: 'smooth' });
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
    if (dwKind === 'asbuilt') return [{ title: 'Chủ đầu tư', org: I.chuDauTu, ten: '', chucVu: '' }, { title: 'Tư vấn giám sát', org: I.tvgs || I.banQLDA, ten: '', chucVu: '' },
      { title: 'Nhà thầu thi công (lập bản vẽ)', org: I.nhaThau, ten: I.chtTen, chucVu: I.chtTen ? 'Chỉ huy trưởng' : '' }];
    return [{ title: 'Chủ đầu tư', org: I.chuDauTu, ten: '', chucVu: '' }, { title: 'Ban quản lý dự án / Tư vấn giám sát', org: I.banQLDA || I.tvgs, ten: '', chucVu: '' },
      { title: 'Nhà thầu cung cấp, lắp đặt', org: I.nhaThau, ten: I.nguoiKy, chucVu: I.chucVuKy }];
  }
  function setDwKind(k) {
    if (!DWK[k]) k = 'shop';
    dwFilesBy[dwKind] = dwFiles;
    dwKind = k; DW = DWS[k]; dwFiles = dwFilesBy[k];
    renderDrawing();
  }
  function renderDrawing() {
    document.querySelectorAll('#hsDwKind [data-kind]').forEach(b => { const on = b.dataset.kind === dwKind; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    const kn = $('hsDwKindName'); if (kn) kn.textContent = DWK[dwKind].short;
    if (!DW.ngay) DW.ngay = todayISO();
    if (!DW.thietBi) DW.thietBi = gv('hs_thietbi');
    if (!DW.ky || !DW.ky.length) DW.ky = defaultKy();
    ['tieuDe', 'phuDe', 'kyTitle', 'heThong', 'thietBi', 'prefix', 'ngay', 'soBanVe'].forEach(k => { const el = $('hsDw_' + k); if (el) el.value = DW[k] || ''; });
    $('hsDwKy').innerHTML = DW.ky.map((c, i) => `<div class="hs-ky" data-i="${i}"><div class="f"><label>Cột ký ${i + 1} — tiêu đề</label><input data-kk="title" value="${esc(c.title)}"></div>
      <div class="f"><label>Đơn vị</label><input data-kk="org" value="${esc(c.org)}"></div><div class="f"><label>Họ tên người ký</label><input data-kk="ten" value="${esc(c.ten)}" placeholder="(để trống: điền tay)"></div>
      <div class="f"><label>Chức vụ</label><input data-kk="chucVu" value="${esc(c.chucVu)}"></div></div>`).join('');
    paintDwList();
  }
  const dwOpt = () => (DW.opt = Object.assign({ a3: true, sep: true, idx: 'auto' }, DW.opt || {}));
  // có lập danh mục bản vẽ trên trang ký không: tự động = không lập khi MỌI bộ đã có danh mục riêng
  const useIndex = () => { const o = dwOpt(), sets = DW.sets || []; return o.idx === 'yes' ? true : o.idx === 'no' ? !sets.length : !(sets.length && sets.every(x => x.hasIndex)); };
  function paintDwSets() {
    const o = dwOpt(), sets = DW.sets || [];
    $('hsDwA3').checked = !!o.a3; $('hsDwSep').checked = !!o.sep;
    document.querySelectorAll('input[name=hsDwIdx]').forEach(r => { r.checked = r.value === o.idx; });
    $('hsDwSetsWrap').hidden = !sets.length;
    $('hsDwSets').tBodies[0].innerHTML = sets.map((x, i) => `<tr data-i="${i}"><td>${i + 1}</td><td><input data-sk="label" value="${esc(x.label)}" style="width:110px" aria-label="Ký hiệu thang"></td><td class="hs-mini">${esc(x.no || '—')}</td><td class="hs-mini">${esc(x.line || '')}</td>
      <td class="hs-mini">${x.drawings} bản vẽ / ${x.pages} trang</td><td class="hs-mini">${esc(x.kho)}${o.a3 && x.kho !== 'A3' ? ' → A3' : ''}</td><td>${x.hasIndex ? '✓ có' : '—'}</td><td class="hs-mini">${esc(x.file)}</td></tr>`).join('');
    const ui = useIndex();
    $('hsDwIdxNote').textContent = !sets.length ? '' : ui ? `Trang ký sẽ có danh mục ${DW.list.length} bản vẽ (tên lấy theo khung tên từng trang).`
      : `Mọi bộ đã có danh mục riêng → trang ký không lập danh mục chi tiết, chỉ liệt kê ${sets.length} bộ bản vẽ.`;
    $('hsDwListWrap').hidden = !ui && sets.length > 0;
  }
  function paintDwList() {
    paintDwSets();
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
      dwFiles = dwFiles.concat(add); dwFilesBy[dwKind] = dwFiles;
      // đọc khung tên từng trang (pdf.js): số bản vẽ, tờ, tên bản vẽ, trang bìa / danh mục của từng bộ
      let sets = null;
      try {
        if (window.pdfjsLib) { pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; stEl.textContent = 'Đang đọc khung tên bản vẽ…'; sets = await HsDrawing.analyze(pdfjsLib, add); }
      } catch (e) { console.warn(e); sets = null; }
      if (sets) add.forEach((f, i) => { f.set = sets[i]; });
      const all = fresh ? add : dwFiles;
      if (fresh) DW.sets = [];
      DW.sets = DW.sets.concat(add.map(f => f.set ? (({ pageInfo, ...x }) => x)(f.set) : { file: f.name, label: HsDrawing.liftLabel('', f.name), no: '', line: '', pages: 0, drawings: 0, hasIndex: false, kho: '' }));
      const rows = all.every(f => f.set) ? HsDrawing.rowsFromSets(all.map((f, i) => Object.assign({}, f.set, { label: (DW.sets[i] || {}).label })), { a3: dwOpt().a3, prefix: DW.prefix || 'TM' })
        : await HsDrawing.listDrawings(PDFLib, add, DW.prefix || 'TM');
      // bắt đầu phiên mới / đọc được khung tên → danh mục theo file; không đọc được → nối tiếp và đánh lại số hiệu
      if (fresh || all.every(f => f.set)) DW.list = rows; else DW.list = DW.list.concat(rows);
      DW.list.forEach((x, i) => { if (/^[A-Z]{1,4}-\d+$/.test(x.so || '')) x.so = `${DW.prefix || 'TM'}-${String(i + 1).padStart(2, '0')}`; });
      const named = DW.list.filter(x => x.rev !== undefined && x.so && !/^[A-Z]{1,4}-\d+$/.test(x.so)).length;
      paintDwList(); stEl.textContent = `✓ Đã đọc ${add.length} file · ${rows.length} bản vẽ${named ? ` · ${named} bản vẽ lấy được số hiệu + tên theo khung tên` : ''}`; onEdit();
    } catch (e) { console.error(e); stEl.textContent = '⚠ ' + e.message; }
  }
  async function exportDrawing(withFiles) {
    const stEl = $('hsDwSt'); stEl.textContent = 'Đang tạo PDF…';
    try {
      await pdfLibs();
      const I = info();
      const D = { ...DW, chuDauTu: I.chuDauTu, banQLDA: I.banQLDA || I.tvgs, congTrinh: I.congTrinh, diaDiem: I.diaDiem, hangMuc: I.hangMuc,
        hopDong: [I.soHD, I.ngayHD ? 'ngày ' + I.ngayHD.split('-').reverse().join('/') : ''].filter(Boolean).join(' '), nhaThau: I.nhaThau, nhaThauDiaChi: I.nhaThauDiaChi, noiLap: I.noiLap, drawings: DW.list, ky: DW.ky, sets: DW.sets || [], useIndex: useIndex() };
      const o = dwOpt(), F = await fonts();
      const cover = await HsDrawing.buildCover(PDFLib, fontkit, F, D);
      if (withFiles) stEl.textContent = o.a3 ? 'Đang ghép và đưa bản vẽ về khổ A3…' : 'Đang ghép bản vẽ…';
      const sets = dwFiles.map((f, i) => Object.assign({}, f.set || {}, DW.sets[i] || {}, { pageInfo: f.set ? f.set.pageInfo : [] }));
      const out = withFiles ? await HsDrawing.assemble(PDFLib, cover, dwFiles, { a3: o.a3, sep: o.sep && dwFiles.length > 1, sets, D, fonts: F, fontkit }) : cover;
      const nm = (I.congTrinh || 'du an').replace(/[\\/:*?"<>|]/g, '');
      saveAs(new Blob([out], { type: 'application/pdf' }), withFiles ? `${DWK[dwKind].file} (kem bia va trang ky) - ${nm}.pdf` : `Bia va trang ky - ${DWK[dwKind].file} - ${nm}.pdf`);
      DW._last = new Date().toISOString();
      stEl.textContent = '✓ Đã tạo PDF'; markDone('drawing_' + dwKind); saveSoon();
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
    document.addEventListener('click', (e) => {
      const b = e.target.closest('button[onclick]'); if (!b) return;
      const oc = b.getAttribute('onclick');
      if (/export|Excel|PDF|downloadLetter|exportLetter|print/i.test(oc)) {
        const k = /exportExcel|print/.test(oc) ? 'schedule' : /exportQuality/.test(oc) ? 'quality' : /exportNhatKy/.test(oc) ? 'nhatky' : /exportBBXN|exportBanGiao|exportLetter/.test(oc) ? 'letters' : '';
        if (k) markDone(k);
        saveSoon();
      }
    }, true);
    // thanh tab chức năng + thẻ ở Tổng quan
    $('hsTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });
    $('hsOverview').addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });
    document.addEventListener('click', mirrorClick);
    $('screenInfo').addEventListener('input', () => { clearTimeout(st.meterT); st.meterT = setTimeout(renderMeter, 150); });
    // công văn
    $('hsLetterList').addEventListener('click', (e) => {
      if (e.target.closest('[data-lclear]')) { lQuery = ''; lKind = ''; $('hsLetterQ').value = ''; document.querySelectorAll('#hsLetterKind [data-lkind]').forEach(x => x.classList.toggle('on', !x.dataset.lkind)); renderLetters(); return; }
      const j = e.target.closest('[data-jump]');
      if (j) { const el = $(j.dataset.jump); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); const box = el.closest('.panel') || el; box.classList.remove('hs-flash'); void box.offsetWidth; box.classList.add('hs-flash'); const f = j.dataset.focus && $(j.dataset.focus); if (f) setTimeout(() => f.focus({ preventScroll: true }), 450); } return; }
      const b = e.target.closest('[data-letter]'); if (!b) return;
      curLetter = b.dataset.letter; renderLetters(); $('screenLetters').scrollIntoView({ block: 'start' });
    });
    $('hsLetterQ').addEventListener('input', (e) => { lQuery = e.target.value; renderLetters(); });
    $('hsLetterKind').addEventListener('click', (e) => { const b = e.target.closest('[data-lkind]'); if (!b) return; lKind = b.dataset.lkind; document.querySelectorAll('#hsLetterKind [data-lkind]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); renderLetters(); });
    $('hsLetterForm').addEventListener('input', (e) => {
      const k = e.target.dataset.lk;
      if (k && curLetter) { (LT[curLetter] || (LT[curLetter] = {}))[k] = e.target.value; clearTimeout(pvTimer); pvTimer = setTimeout(renderLetterPreview, 250); return; }
      const pe = e.target.closest && e.target.closest('#hsPv .pv-p');
      if (pe) { clearTimeout(pvTimer); pvTimer = setTimeout(() => pvSave(pe), 500); }
    });
    $('hsLetterForm').addEventListener('focusin', (e) => { const pe = e.target.closest('#hsPv .pv-p'); if (pe) { pvFocus = pe; pvToolbar(); } });
    $('hsLetterForm').addEventListener('focusout', (e) => { const pe = e.target.closest('#hsPv .pv-p'); if (pe) { clearTimeout(pvTimer); pvSave(pe); } });
    $('hsLetterForm').addEventListener('keydown', (e) => {
      const pe = e.target.closest && e.target.closest('#hsPv .pv-p'); if (!pe) return;
      if (e.key === 'Enter') { e.preventDefault(); document.execCommand('insertLineBreak'); }   // Enter = xuống dòng trong đoạn
      if (e.key === 'Escape') pe.blur();
    });
    // dán: chỉ lấy chữ thuần (không mang định dạng web / Word lạ vào)
    $('hsLetterForm').addEventListener('paste', (e) => {
      if (!e.target.closest || !e.target.closest('#hsPv .pv-p')) return;
      e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
    });
    $('hsLetterForm').addEventListener('mousedown', (e) => { if (e.target.closest('[data-fmt]')) e.preventDefault(); });   // giữ con trỏ trong đoạn
    window.addEventListener('resize', () => { if (curLetter) pvFit(); });
    $('hsLetterForm').addEventListener('click', (e) => { const sn = e.target.closest('[data-sonext]'); if (sn && curLetter) { const inp = $('hsLetterForm').querySelector('[data-lk="so"]'); inp.value = sn.dataset.sonext; (LT[curLetter] || (LT[curLetter] = {})).so = inp.value; sn.remove(); inp.dispatchEvent(new Event('input', { bubbles: true })); return; } if (e.target.id === 'hsLetterGo') exportLetter();
      const fm = e.target.closest('[data-fmt]'); if (fm) { if (pvFocus && pvFocus.isConnected) { pvFocus.focus(); document.execCommand(fm.dataset.fmt); pvSave(pvFocus); } return; }
      if (e.target.closest('[data-pvreset]') && pvFocus && pvFocus.dataset.k != null && curLetter) { const v = LT[curLetter]; if (v && v._ed) { delete v._ed[pvFocus.dataset.k]; if (!Object.keys(v._ed).length) delete v._ed; } pvFocus = null; renderLetterPreview(); saveSoon(); return; }
      if (e.target.closest('[data-pvresetall]') && curLetter) { if (!confirm('Bỏ mọi sửa tay trên bản xem trước của văn bản này? Văn bản trở về đúng nội dung tự sinh từ các ô thông tin.')) return; delete (LT[curLetter] || {})._ed; renderLetterPreview(); saveSoon(); return; }
      if (e.target.closest('[data-pvdropmiss]') && curLetter) { const v = LT[curLetter], d = HsLetters.LETTERS.find(x => x.id === curLetter); const A = HsPreview.applyEdits(HsLetters.compose(d, info(), v), v._ed); A.miss.forEach(k => delete v._ed[k]); if (v._ed && !Object.keys(v._ed).length) delete v._ed; renderLetterPreview(); saveSoon(); return; }
      if (e.target.closest('[data-pvwide]')) { pvWide = !pvWide; const w = host().querySelector('.hs-lfw'); w.classList.toggle('wide', pvWide); e.target.closest('[data-pvwide]').textContent = pvWide ? '⇤ Thu hẹp' : '⤢ Mở rộng'; pvFit(); return; }
      if (e.target.closest('[data-lback]')) { curLetter = null; renderLetters(); $('screenLetters').scrollIntoView({ block: 'start' }); } });
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
    $('hsLgDocs').addEventListener('click', (e) => { const a = e.target.closest('[data-one]'); if (a) { e.preventDefault(); exportLegal(a.dataset.one); return; } const v = e.target.closest('[data-lgpv]'); if (v) { e.preventDefault(); openLegalPreview(v.dataset.lgpv); } });
    $('hsLgPvBtn').addEventListener('click', () => openLegalPreview());
    $('hsLgPvDoc').addEventListener('change', () => { if (lgPv) lgPv.render(); });
    // đổi người, máy móc, ngày… → xem trước đang mở tự cập nhật
    $('screenLegal').addEventListener('input', (e) => { if (!lgPv || $('hsLgPvWrap').hidden || e.target.closest('#hsLgPvWrap')) return; clearTimeout(lgPvT); lgPvT = setTimeout(() => lgPv.render(), 400); });
    $('screenLegal').addEventListener('change', (e) => { if (!lgPv || $('hsLgPvWrap').hidden || e.target.closest('#hsLgPvWrap')) return; clearTimeout(lgPvT); lgPvT = setTimeout(() => lgPv.render(), 200); });
    $('hsLgGo').onclick = () => exportLegal();
    $('hsKhOld').addEventListener('input', (e) => { LG.khOld = e.target.value; });
    $('hsKhNew').addEventListener('input', (e) => { LG.khNew = e.target.value; });
    $('hsKhFile').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; exportKh(f); });
    // bản vẽ
    ['tieuDe', 'phuDe', 'kyTitle', 'heThong', 'thietBi', 'prefix', 'ngay', 'soBanVe'].forEach(k => $('hsDw_' + k).addEventListener('input', (e) => { DW[k] = e.target.value; }));
    $('hsDwKind').addEventListener('click', (e) => { const b = e.target.closest('[data-kind]'); if (b) setDwKind(b.dataset.kind); });
    $('hsDwKy').addEventListener('input', (e) => { const k = e.target.dataset.kk, box = e.target.closest('[data-i]'); if (k && box) DW.ky[+box.dataset.i][k] = e.target.value; });
    $('hsDwResetKy').onclick = () => { DW.ky = defaultKy(); renderDrawing(); onEdit(); };
    $('hsDwTable').addEventListener('input', (e) => { const k = e.target.dataset.dk, tr = e.target.closest('tr[data-i]'); if (k && tr) DW.list[+tr.dataset.i][k] = e.target.value; });
    $('hsDwTable').addEventListener('click', (e) => { const b = e.target.closest('[data-ddel]'); if (b) { DW.list.splice(+b.dataset.ddel, 1); paintDwList(); onEdit(); } });
    $('hsDwAdd').onclick = () => { DW.list.push({ so: `${DW.prefix || 'TM'}-${String(DW.list.length + 1).padStart(2, '0')}`, ten: '', kho: 'A3' }); paintDwList(); };
    $('hsDwFiles').addEventListener('change', (e) => { const fs = [...e.target.files]; e.target.value = ''; addDwFiles(fs); });
    $('hsDwClear').onclick = () => { dwFiles = []; dwFilesBy[dwKind] = dwFiles; DW.list = []; DW.sets = []; paintDwList(); onEdit(); };
    $('hsDwA3').addEventListener('change', (e) => { dwOpt().a3 = e.target.checked; DW.list.forEach(x => { if (x.goc) x.kho = e.target.checked ? 'A3' : x.goc; }); paintDwList(); onEdit(); });
    $('hsDwSep').addEventListener('change', (e) => { dwOpt().sep = e.target.checked; onEdit(); });
    document.querySelectorAll('input[name=hsDwIdx]').forEach(r => r.addEventListener('change', () => { dwOpt().idx = r.value; paintDwList(); onEdit(); }));
    $('hsDwSets').addEventListener('input', (e) => { const tr = e.target.closest('tr[data-i]'); if (tr && e.target.dataset.sk) { DW.sets[+tr.dataset.i][e.target.dataset.sk] = e.target.value; } });
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
      if (d && d.data && confirm(`Có hồ sơ mới đang nhập dở trên máy này (${fmtTime(d.t)}). Mở tiếp?\n(Huỷ = bắt đầu hồ sơ trống.)`)) { restore(d.data); bar('Đã mở nháp trên máy — bấm Lưu để lưu hồ sơ', 'warn'); prefillCommon(); showScreen('screenChoose'); }
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
      prefillCommon(); syncInfo(); renderOverview();
    } catch (e) { bar('⚠ ' + e.message, 'err'); showScreen('screenHome'); loadList(); }
    st.booted = true;
  }
  window.HS = { boot, save, toList, enter, go, openLetter, onScreen, renderOverview, syncInfo, info, snapshot, restore, prefillCommon, _st: st, _LT: LT, _LG: LG, get _DW() { return DW; }, _DWS: DWS };
})();
