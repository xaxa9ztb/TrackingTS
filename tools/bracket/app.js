// Khảo sát Bracket hố thang — giao diện. Phần tính toán ở bracket.js (window.Bracket).
// Bản máy chủ: phiếu lưu trên hệ thống (/api/bracket/surveys) — mọi người cùng xem, chỉ người tạo và Admin được sửa.
// Bản không có máy chủ: phiếu lưu trên máy (localStorage). Xuất Excel theo mẫu bracket-template.xlsx / báo cáo PDF.
(function () {
  'use strict';
  const B = window.Bracket;
  const KEY = 'ni_bracket_v1';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const fmtDate = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('/') : '');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // ---------- lưu trữ ----------
  const SERVER = typeof Session !== 'undefined' && !!Session.SERVER;
  function loadLocal() {
    try { const d = JSON.parse(localStorage.getItem(KEY) || '{}'); return Array.isArray(d.surveys) ? d.surveys : []; } catch (e) { return []; }
  }
  let surveys = SERVER ? [] : loadLocal();
  let cur = null;               // phiếu đang mở
  let saveTimer = 0, retryTimer = 0;
  const setSaved = (t) => { $('saved').textContent = t; };
  const hhmm = (iso) => { const d = new Date(iso || Date.now()); return isNaN(d) ? '' : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); };
  // dữ liệu phiếu gửi lên máy chủ (bỏ phần thông tin quản lý _m)
  const strip = (x) => { const { _m, ...d } = x; return d; };
  const fromServer = (it) => Object.assign({}, it.data, { id: it.data && it.data.id ? it.data.id : 'srv' + it.id,
    _m: { sid: it.id, version: it.version, canEdit: !!it.canEdit, mine: !!it.mine, createdBy: it.createdBy, updatedBy: it.updatedBy, updatedAt: it.updatedAt, dirty: false } });
  const editable = (x) => !SERVER || !!(x && x._m && x._m.canEdit);

  async function api(method, path, body, keepalive) {
    let resp;
    try {
      resp = await fetch(path, { method, credentials: 'same-origin', redirect: 'manual', cache: 'no-store', keepalive: !!keepalive,
        headers: body === undefined ? {} : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) { const err = new Error('Không kết nối được hệ thống'); err.status = 0; throw err; }
    if (resp.type === 'opaqueredirect' || (resp.status >= 300 && resp.status < 400)) { const err = new Error('Phiên đăng nhập đã hết hạn — tải lại trang (F5)'); err.status = 401; throw err; }
    let data = {}; try { data = await resp.json(); } catch (e) { /* không phải JSON */ }
    if (!resp.ok) { const err = new Error(data.error || ('Lỗi hệ thống (HTTP ' + resp.status + ')')); err.status = resp.status; throw err; }
    return data;
  }
  async function loadServer() {
    $('listEmpty').hidden = true; $('list').innerHTML = '<li class="bk-loading ni-muted">Đang tải phiếu từ hệ thống…</li>';
    try { const r = await api('GET', '/api/bracket/surveys'); surveys = (r.items || []).map(fromServer); }
    catch (e) { $('list').innerHTML = `<li class="bk-loading bk-warn">⚠ Không tải được danh sách phiếu: ${esc(e.message)}. <button type="button" class="ni-btn small" id="btnReload">Thử lại</button></li>`; return false; }
    renderList(); return true;
  }
  // lưu phiếu đang mở lên hệ thống (chỉ khi có thay đổi và được quyền sửa)
  let saving = false, again = false;
  async function saveServer(x) {
    if (!x || !x._m || !x._m.canEdit || !x._m.dirty) return;
    if (saving) { again = true; return; }
    saving = true; clearTimeout(retryTimer); x._m.dirty = false;
    if (cur === x) setSaved('Đang lưu lên hệ thống…');
    try {
      const r = await api('PUT', '/api/bracket/surveys/' + x._m.sid, { version: x._m.version, data: strip(x) });
      Object.assign(x._m, { version: r.survey.version, updatedAt: r.survey.updatedAt, updatedBy: r.survey.updatedBy });
      if (cur === x) setSaved('Đã lưu lên hệ thống lúc ' + hhmm(r.survey.updatedAt));
    } catch (e) {
      x._m.dirty = true;
      if (e.status === 409) {
        if (cur === x) setSaved('⚠ ' + e.message);
        if (confirm('Phiếu này vừa được sửa ở nơi khác (máy khác hoặc Admin).\n\nBấm OK để tải bản mới nhất (thay đổi chưa lưu của bạn trên phiếu này sẽ bị bỏ).')) await reloadOne(x);
      } else if (e.status === 403 || e.status === 404) {
        x._m.dirty = false; if (cur === x) setSaved('⚠ ' + e.message);
      } else {
        if (cur === x) setSaved('⚠ Chưa lưu được (' + e.message + ') — tự thử lại sau 15 giây');
        retryTimer = setTimeout(() => saveServer(x), 15000);
      }
    } finally {
      saving = false;
      if (again) { again = false; saveServer(x); }
    }
  }
  async function reloadOne(x) {
    try {
      const r = await api('GET', '/api/bracket/surveys/' + x._m.sid);
      const n = fromServer(r.survey), i = surveys.indexOf(x);
      if (i >= 0) surveys[i] = n;
      if (cur === x) open(n.id);
    } catch (e) { toast('Không tải lại được phiếu: ' + e.message); }
  }
  function persist() {
    if (SERVER) { if (cur) saveServer(cur); return; }
    try { localStorage.setItem(KEY, JSON.stringify({ surveys })); setSaved('Đã lưu trên máy này'); }
    catch (e) { setSaved('Không lưu được (bộ nhớ trình duyệt đầy)'); }
  }
  function touch() {
    if (!cur || !editable(cur)) return;
    cur.updatedAt = new Date().toISOString();
    if (cur._m) cur._m.dirty = true;
    setSaved('Đang lưu…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, SERVER ? 1200 : 400);
  }
  // thêm phiếu mới (bản máy chủ: tạo trên hệ thống trước rồi mới mở)
  async function addSurvey(x) {
    if (!SERVER) { surveys.push(x); persist(); return x; }
    try { const r = await api('POST', '/api/bracket/surveys', { data: strip(x) }); const n = fromServer(r.survey); surveys.push(n); return n; }
    catch (e) { toast('Không tạo được phiếu trên hệ thống: ' + e.message); return null; }
  }
  // phiếu cũ còn lưu trên máy này (trước khi có hệ thống) → đưa lên
  function renderLocalBanner() {
    const box = $('localBanner'); if (!box) return;
    const n = SERVER ? loadLocal().length : 0;
    box.hidden = !n;
    if (n) box.innerHTML = `<span>📤 Máy này còn <b>${n}</b> phiếu khảo sát lưu riêng trên trình duyệt (từ trước khi có hệ thống) — đưa lên để mọi người cùng xem.</span><button type="button" class="ni-btn primary small" id="btnUpload">Đưa ${n} phiếu lên hệ thống</button>`;
  }
  async function uploadLocal() {
    const list = loadLocal(); if (!list.length) return;
    const btn = $('btnUpload'); if (btn) { btn.disabled = true; btn.textContent = 'Đang đưa lên…'; }
    const left = []; let ok = 0;
    for (const x of list) {
      try { await api('POST', '/api/bracket/surveys', { data: strip(x) }); ok++; } catch (e) { left.push(x); }
    }
    try { if (left.length) localStorage.setItem(KEY, JSON.stringify({ surveys: left })); else localStorage.removeItem(KEY); } catch (e) { /* bỏ qua */ }
    toast(left.length ? `Đã đưa ${ok} phiếu lên; ${left.length} phiếu chưa được — thử lại sau.` : `Đã đưa ${ok} phiếu lên hệ thống.`);
    await loadServer(); renderLocalBanner();
  }
  let toastTimer = 0;
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
  }

  function blank() {
    const me = (typeof Session !== 'undefined' && Session.current && Session.current()) || {};
    return { id: uid(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      project: '', location: '', contract: '', surveyor: me.name || '', date: today(), liftId: '', bs: '', ts: '', load: '', stops: '',
      sf2Design: '', sgDesign: '', zBracket: '', oBracket: '', rows: [{ line: '', sf2: '', sg: '' }] };
  }

  // ---------- danh sách ----------
  let lMine = false, lQ = '';
  const fold = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  function renderList() {
    const q = fold(lQ).trim();
    const all = surveys.slice().sort((a, b) => String((b._m && b._m.updatedAt) || b.updatedAt).localeCompare(String((a._m && a._m.updatedAt) || a.updatedAt)));
    const list = all.filter((s) => (!lMine || !s._m || s._m.mine) && (!q || fold([s.project, s.liftId, s.location, s.contract, s.surveyor, s._m && s._m.createdBy].join(' ')).includes(q)));
    $('listEmpty').hidden = list.length > 0;
    $('listEmpty').innerHTML = all.length ? 'Không có phiếu nào khớp bộ lọc.' : 'Chưa có phiếu nào. Bấm <b>+ Phiếu mới</b> để bắt đầu.';
    $('list').innerHTML = list.map((s) => {
      const c = B.compute(s);
      const title = [s.project || 'Phiếu chưa đặt tên', s.liftId].filter(Boolean).join(' · ');
      const meta = [fmtDate(s.date), c.summary.total ? `${c.summary.total} vị trí · ${c.summary.pass} đạt` : 'chưa có số đo', s.zBracket, s.oBracket].filter(Boolean).join(' · ');
      const own = s._m ? `<span class="bk-own${s._m.mine ? ' me' : ''}">${s._m.mine ? '★ Phiếu của tôi' : '👤 ' + esc(s._m.createdBy || '')}${s._m.canEdit ? '' : ' · 🔒 chỉ xem'}</span>` : '';
      return `<li><button type="button" class="bk-open" data-open="${esc(s.id)}"><b>${esc(title)}</b><span>${esc(meta)}</span>${own}</button>
        <button type="button" class="ni-btn small" data-xls="${esc(s.id)}" aria-haspopup="menu">Xuất ▾</button></li>`;
    }).join('');
  }

  // ---------- trình sửa ----------
  function bracketOptions() {
    const fam = { AL: 'Dòng AL', CL: 'Dòng CL', CHL: 'Dòng CHL', CH: 'Dòng CH' };
    $('selZ').innerHTML = '<option value="">— Chọn Z Bracket —</option>' + B.FAMILIES.map((f) => `<optgroup label="${fam[f]}">${
      B.Z.filter((b) => b.fam === f).map((b) => `<option value="${esc(b.name)}">${esc(b.name)}  (${b.min}–${b.max})</option>`).join('')}</optgroup>`).join('');
    const groups = [['Family A', (b) => /^O-A/.test(b.name)], ['Family B', (b) => /^O-B/.test(b.name)]];
    $('selO').innerHTML = '<option value="">— Chọn Omega Bracket —</option>' + groups.map(([g, f]) => `<optgroup label="${g}">${
      B.O.filter(f).map((b) => `<option value="${esc(b.name)}">${esc(b.name.replace(/\s{2,}/g, ' '))}  (${b.min}–${b.max})</option>`).join('')}</optgroup>`).join('');
  }
  function refTables() {
    const z = B.FAMILIES.map((f) => `<tr class="fam"><td colspan="3">Dòng ${f}</td></tr>` + B.Z.filter((b) => b.fam === f)
      .map((b) => `<tr data-n="${esc(b.name)}"><td>${esc(b.name)}</td><td>${b.min}</td><td>${b.max}</td></tr>`).join('')).join('');
    $('refZ').innerHTML = `<thead><tr><th>Bracket</th><th>SFmin</th><th>SFmax</th></tr></thead><tbody>${z}</tbody>`;
    $('refO').innerHTML = `<thead><tr><th>Bracket</th><th>SGmin</th><th>SGmax</th></tr></thead><tbody>${
      B.O.map((b) => `<tr data-n="${esc(b.name)}"><td>${esc(b.name.replace(/\s{2,}/g, ' '))}${B.NOTE_O[b.name] ? ' *' : ''}</td><td>${b.min}</td><td>${b.max}</td></tr>`).join('')}</tbody>`
      + `<caption class="bk-cap">${Object.entries(B.NOTE_O).map(([n, t]) => `* ${esc(n.replace(/\s{2,}/g, ' '))}: ${esc(t)}`).join('<br>')}</caption>`;
    $('refSrc').textContent = 'Nguồn: ' + B.SOURCE;
  }

  // Kết quả ngắn gọn trên app (biểu tượng + chữ, không chỉ dựa vào màu); câu đầy đủ như Excel ở title / trình đọc màn hình
  const CHIP = { ok: 'ok', pad: 'site', trim: 'site', change: 'bad', pit: 'bad', none: 'none' };
  const clean = (t) => String(t || '').replace(/\s{2,}/g, ' ');
  function shortText(e) {
    switch (e.status) {
      case 'ok': return ['✓', 'Đạt', ''];
      case 'pad': return ['▲', 'Đệm bản mã 10mm', `lệch +${e.dev}mm · không đổi bracket`];
      case 'trim': return ['▼', 'Đục tỉa chân bracket', `lệch −${e.dev}mm · không đổi bracket`];
      case 'change': return ['✕', `Đổi sang ${clean(e.suggest) || '?'}`, 'lệch quá 10mm'];
      case 'pit': return ['✕', 'Chỉnh sửa hố thang', e.fam ? `ngoài dải cả dòng ${e.fam}` : 'ngoài dải cả danh mục Omega'];
      default: return ['', clean(e.text), ''];
    }
  }
  const chip = (e) => {
    if (!e || !e.text) return '';
    const [ic, main, sub] = shortText(e);
    return `<span class="bk-chip ${CHIP[e.status] || 'none'}" title="${esc(clean(e.text))}">${ic ? `<span class="bk-ic" aria-hidden="true">${ic}</span>` : ''}<span aria-hidden="true"><b>${esc(main)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span><span class="sr-only">${esc(clean(e.text))}</span></span>`;
  };
  const TRASH = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 12.5h9l1-12.5M10 11v5.5M14 11v5.5"/></svg>';

  function rowHtml(r, i) {
    return `<tr data-i="${i}">
      <td class="bk-n">${i + 1}</td>
      <td class="bk-line" data-l="Vị trí (Line)"><input data-r="line" value="${esc(r.line)}" maxlength="80" placeholder="VD: Sàn T1" aria-label="Vị trí dòng ${i + 1}"></td>
      <td class="bk-num bk-z" data-l="SF2 (mm)"><input data-r="sf2" value="${esc(r.sf2)}" inputmode="decimal" aria-label="SF2 dòng ${i + 1}"></td>
      <td class="bk-res bk-zr" data-res="z"></td>
      <td class="bk-num bk-o" data-l="SG (mm)"><input data-r="sg" value="${esc(r.sg)}" inputmode="decimal" aria-label="SG dòng ${i + 1}"></td>
      <td class="bk-res bk-or" data-res="o"></td>
      <td class="bk-act"><button type="button" class="bk-del" data-del="${i}" aria-label="Xóa dòng ${i + 1}" title="Xóa dòng">${TRASH}</button></td>
    </tr>`;
  }
  function renderRows() {
    $('rows').innerHTML = cur.rows.map(rowHtml).join('');
    $('btnAddRow').disabled = cur.rows.length >= B.MAX_ROWS;
    $('btnAddRow').textContent = cur.rows.length >= B.MAX_ROWS ? `Đủ ${B.MAX_ROWS} vị trí (tối đa của mẫu Excel)` : '+ Thêm vị trí';
    const ro = !editable(cur);
    $('btnAddRow').hidden = ro;
    document.querySelectorAll('#editor input, #editor select').forEach((el) => { el.disabled = ro; });
    refresh();
  }

  // cập nhật mọi kết quả (không dựng lại ô nhập để không mất con trỏ)
  function refresh() {
    const c = B.compute(cur);
    const zb = c.zb, ob = c.ob;
    $('rangeZ').innerHTML = zb ? `SFmin / SFmax: <b>${zb.min} – ${zb.max} mm</b> · dòng <b>${zb.fam}</b>` : '';
    $('rangeO').innerHTML = ob ? `SGmin / SGmax: <b>${ob.min} – ${ob.max} mm</b>${B.NOTE_O[ob.name] ? `<br><span class="bk-warn">⚠ ${esc(B.NOTE_O[ob.name])}</span>` : ''}` : '';
    // phiếu cũ chọn bracket đã bị bỏ khỏi danh mục mới (vd. Z-AL2, Z-AL3 không còn SC-AP từ bản Ae25)
    if (cur.zBracket && !zb) $('rangeZ').innerHTML = `<span class="bk-warn">⚠ ${esc(cur.zBracket)} không còn trong danh mục SC-AP (J 45350713 Ae25) — chọn lại loại Z Bracket.</span>`;
    if (cur.oBracket && !ob) $('rangeO').innerHTML = `<span class="bk-warn">⚠ ${esc(cur.oBracket.replace(/\s{2,}/g, ' '))} không có trong danh mục — chọn lại loại Omega Bracket.</span>`;
    const dz = c.design.z, dO = c.design.o;
    $('checkZ').textContent = dz.text ? (dz.ok ? '✓ ' : '⚠ ') + dz.text : ''; $('checkZ').className = 'bk-check ' + (dz.ok ? 'ok' : dz.text ? 'bad' : '');
    $('checkO').textContent = dO.text ? (dO.ok ? '✓ ' : '⚠ ') + dO.text.replace(/\s{2,}/g, ' ') : ''; $('checkO').className = 'bk-check ' + (dO.ok ? 'ok' : dO.text ? 'bad' : '');
    document.querySelectorAll('#rows tr').forEach((tr) => {
      const r = c.rows[+tr.dataset.i]; if (!r) return;
      tr.querySelector('[data-res=z]').innerHTML = chip(r.z);
      tr.querySelector('[data-res=o]').innerHTML = chip(r.o);
    });
    // số đo không phải số → viền đỏ + gợi ý (thay vì im lặng không ra kết quả)
    document.querySelectorAll('#rows input[data-r=sf2], #rows input[data-r=sg], #editor input[inputmode=decimal][data-k]').forEach((el) => {
      const bad = el.value.trim() !== '' && B.num(el.value) === null;
      el.setAttribute('aria-invalid', bad ? 'true' : 'false');
      el.title = bad ? 'Nhập số (mm), ví dụ 147' : '';
    });
    const used = cur.rows.filter((r) => String(r.sf2).trim() || String(r.sg).trim()).length;
    $('rowCount').textContent = `${used} / ${B.MAX_ROWS} vị trí có số đo`;
    const S = c.summary;
    const site = S.zSite + S.oSite, swap = S.zSwap + S.oSwap, pit = S.zPit + S.oPit;
    const tile = (v, t, cls) => `<div class="bk-tile ${v ? cls : ''}"><b>${v}</b><span>${t}</span></div>`;
    $('tiles').innerHTML = tile(S.total, 'vị trí khảo sát', 'info') + tile(S.pass, 'đạt cả SF2 &amp; SG', 'ok')
      + tile(site, 'xử lý tại công trường', 'site') + tile(swap, 'cần đổi bracket', 'bad') + tile(pit, 'chỉnh sửa hố thang', 'bad');
    $('stickyInfo').textContent = S.total ? `${S.total} vị trí · ${S.pass} đạt` : 'Chưa có số đo';
    const line = (t, v, cls = '', sub = false) => `<dt class="${sub ? 'sub' : ''}">${t}</dt><dd class="${[sub ? 'sub' : '', cls].join(' ')}">${v}</dd>`;
    $('sum').innerHTML = line('Tổng số vị trí khảo sát', S.total)
      + line('Số vị trí ĐẠT (SF2 và SG đều trong dung sai)', S.pass, S.total && S.pass === S.total ? 'good' : '')
      + line('Số vị trí cần thay đổi Z Bracket (SF2 ngoài dung sai)', S.zChange, S.zChange ? 'warn' : '')
      + line('• Xử lý tại công trường (đệm bản mã / đục tỉa — không đổi bracket)', S.zSite, '', true)
      + line('• Cần đổi sang loại Z Bracket khác (cùng dòng)', S.zSwap, '', true)
      + line('Số vị trí cần thay đổi Omega Bracket (SG ngoài dung sai)', S.oChange, S.oChange ? 'warn' : '')
      + line('• Xử lý tại công trường (đệm bản mã / đục tỉa — không đổi bracket)', S.oSite, '', true)
      + line('• Cần đổi sang loại Omega Bracket khác', S.oSwap, '', true)
      + line('SF2 vượt dung sai toàn bộ Z Bracket (chỉnh sửa hố thang)', S.zPit, S.zPit ? 'warn' : '')
      + line('SG vượt dung sai toàn bộ Omega Bracket (chỉnh sửa hố thang)', S.oPit, S.oPit ? 'warn' : '');
    document.querySelectorAll('#refZ tr[data-n]').forEach((tr) => tr.classList.toggle('on', tr.dataset.n === cur.zBracket));
    document.querySelectorAll('#refO tr[data-n]').forEach((tr) => tr.classList.toggle('on', tr.dataset.n === cur.oBracket));
  }

  function open(id) {
    cur = surveys.find((s) => s.id === id) || null;
    if (!cur) return;
    $('secList').hidden = true; $('secLookup').hidden = true; $('bkTabs').hidden = true; $('editor').hidden = false;
    document.querySelectorAll('#editor [data-k]').forEach((el) => { el.value = cur[el.dataset.k] == null ? '' : cur[el.dataset.k]; });
    setSaved(SERVER ? (cur._m.updatedAt ? `Lưu trên hệ thống · sửa lần cuối ${hhmm(cur._m.updatedAt)} ${new Date(cur._m.updatedAt).toLocaleDateString('vi-VN')}${cur._m.updatedBy ? ' bởi ' + cur._m.updatedBy : ''}` : 'Lưu trên hệ thống') : 'Đã lưu trên máy này');
    const ro = !editable(cur);
    $('editor').classList.toggle('bk-ro', ro);
    $('roNote').hidden = !ro;
    if (ro) $('roNote').innerHTML = `🔒 Phiếu của <b>${esc(cur._m.createdBy || 'người khác')}</b> — bạn chỉ được xem và xuất báo cáo. Chỉ người tạo phiếu và Admin được sửa. Cần chỉnh? Bấm <b>Nhân bản</b> để tạo bản của bạn.`;
    $('btnDelete').hidden = ro;
    renderRows();
    history.replaceState(null, '', '#' + cur.id);
    window.scrollTo(0, 0);
  }
  function close() {
    clearTimeout(saveTimer); if (cur && editable(cur)) persist();
    cur = null; $('editor').hidden = true; $('bkTabs').hidden = false; showTab('list');
    history.replaceState(null, '', location.pathname + location.search);
    renderList();
  }

  // ---------- tab Tra dung sai (không cần phiếu) ----------
  const fmtMm = (v) => String(v);
  function lookupTables() {
    const famName = { AL: 'Dòng AL', CL: 'Dòng CL', CHL: 'Dòng CHL', CH: 'Dòng CH' };
    $('lkZ').innerHTML = '<thead><tr><th>Mã bracket</th><th>SFmin</th><th>SFmax</th><th>Dải</th></tr></thead><tbody>' + B.FAMILIES.map((f) => `<tr class="fam" data-fam="${f}"><td colspan="4">${famName[f]}</td></tr>` +
      B.Z.filter((b) => b.fam === f).map((b) => `<tr data-n="${esc(b.name)}" data-fam="${f}"><td>${esc(b.name)}</td><td>${b.min}</td><td>${b.max}</td><td>${b.max - b.min}</td></tr>`).join('')).join('') + '</tbody>';
    $('lkO').innerHTML = '<thead><tr><th>Mã bracket</th><th>SGmin</th><th>SGmax</th><th>Dải</th></tr></thead><tbody>' +
      B.O.map((b) => `<tr data-n="${esc(b.name)}"><td>${esc(clean(b.name))}</td><td>${b.min}</td><td>${b.max}</td><td>${b.max - b.min}</td></tr>`).join('') + '</tbody>';
    $('lkSrc').textContent = 'Nguồn: ' + B.SOURCE + ' · Chỉ áp dụng thị trường SC-AP.';
  }
  const normId = (t) => String(t || '').toUpperCase().replace(/\s+/g, '').replace(/^Z-?/, '').replace(/^O-?/, '');
  // bracket chứa số đo: dải hẹp nhất trước; không loại nào chứa → loại gần nhất (và mức lệch)
  function fits(list, x) {
    const hit = list.filter((b) => b.min <= x && b.max >= x).sort((a, b) => (a.max - a.min) - (b.max - b.min) || a.min - b.min);
    if (hit.length) return { hit, near: null };
    const near = list.map((b) => ({ b, d: x < b.min ? b.min - x : x - b.max })).sort((a, b) => a.d - b.d)[0];
    return { hit: [], near };
  }
  function lookup() {
    const xz = B.num($('lkSf2').value), xo = B.num($('lkSg').value), fam = $('lkFam').value, q = normId($('lkQ').value);
    const zList = fam ? B.Z.filter((b) => b.fam === fam) : B.Z;
    const chip = (b, best) => `<span class="bk-fit${best ? ' best' : ''}"><b>${esc(clean(b.name))}</b> ${b.min}–${b.max}${best ? ' · <i>gợi ý: dải hẹp nhất</i>' : ''}</span>`;
    const res = [], fitZ = new Set(), fitO = new Set(), bestSet = new Set();
    ['lkSf2', 'lkSg'].forEach((id) => { const el = $(id), bad = el.value.trim() !== '' && B.num(el.value) === null; el.setAttribute('aria-invalid', bad ? 'true' : 'false'); });
    if (xz !== null) {
      const parts = (fam ? [fam] : B.FAMILIES).map((f) => {
        const r = fits(B.Z.filter((b) => b.fam === f), xz);
        r.hit.forEach((b, i) => { fitZ.add(b.name); if (!i) bestSet.add(b.name); });
        return r.hit.length ? `<div class="bk-lkrow"><span class="bk-lkf">Dòng ${f}</span>${r.hit.map((b, i) => chip(b, !i)).join('')}</div>`
          : `<div class="bk-lkrow"><span class="bk-lkf">Dòng ${f}</span><span class="bk-nofit">Không loại nào chứa ${xz} mm${r.near ? ` — gần nhất <b>${esc(r.near.b.name)}</b> (${r.near.b.min}–${r.near.b.max}, lệch ${Math.round(r.near.d)} mm${r.near.d <= B.TOL ? ': đệm bản mã / đục tỉa được' : ''})` : ''}</span></div>`;
      }).join('');
      res.push(`<div class="bk-lkblk"><h3>Z Bracket cho SF2 = ${xz} mm</h3>${parts}</div>`);
    }
    if (xo !== null) {
      const r = fits(B.O, xo);
      r.hit.forEach((b, i) => { fitO.add(b.name); if (!i) bestSet.add(b.name); });
      res.push(`<div class="bk-lkblk"><h3>Omega Bracket cho SG = ${xo} mm</h3><div class="bk-lkrow">${r.hit.length ? r.hit.map((b, i) => chip(b, !i)).join('')
        : `<span class="bk-nofit">Không loại nào chứa ${xo} mm${r.near ? ` — gần nhất <b>${esc(clean(r.near.b.name))}</b> (${r.near.b.min}–${r.near.b.max}, lệch ${Math.round(r.near.d)} mm${r.near.d <= B.TOL ? ': đệm bản mã / đục tỉa được' : ''})` : ''}</span>`}</div></div>`);
    }
    if (q && xz === null && xo === null) {
      const m = [...B.Z, ...B.O].filter((b) => normId(b.name).includes(q));
      res.push(m.length ? `<div class="bk-lkblk"><h3>Mã khớp “${esc($('lkQ').value.trim())}”</h3><div class="bk-lkrow">${m.map((b) => `<span class="bk-fit"><b>${esc(clean(b.name))}</b> ${b.fam ? 'SF' : 'SG'} ${b.min}–${b.max} mm</span>`).join('')}</div></div>`
        : `<p class="bk-nofit">Không có mã bracket nào khớp “${esc($('lkQ').value.trim())}”.</p>`);
    }
    $('lkRes').innerHTML = res.join('') || '<p class="ni-muted">Nhập SF2 / SG hoặc mã bracket — bảng bên dưới tô các loại phù hợp.</p>';
    // tô / lọc bảng
    const show = (n) => !q || normId(n).includes(q);
    document.querySelectorAll('#lkZ tbody tr[data-n]').forEach((tr) => { const n = tr.dataset.n, vis = (!fam || tr.dataset.fam === fam) && show(n);
      tr.hidden = !vis; tr.classList.toggle('fit', fitZ.has(n)); tr.classList.toggle('on', bestSet.has(n)); });
    document.querySelectorAll('#lkZ tbody tr.fam').forEach((tr) => { tr.hidden = ![...document.querySelectorAll(`#lkZ tbody tr[data-n][data-fam="${tr.dataset.fam}"]`)].some((x) => !x.hidden); });
    document.querySelectorAll('#lkO tbody tr[data-n]').forEach((tr) => { const n = tr.dataset.n; tr.hidden = !show(n); tr.classList.toggle('fit', fitO.has(n)); tr.classList.toggle('on', bestSet.has(n)); });
  }
  function showTab(t) {
    const look = t === 'lookup';
    $('secLookup').hidden = !look; $('secList').hidden = look;
    $('tabList').setAttribute('aria-selected', String(!look)); $('tabLookup').setAttribute('aria-selected', String(look));
    try { localStorage.setItem('bk_tab', t); } catch (e) { /* bỏ qua */ }
    if (look) lookup();
  }

  // ---------- Excel ----------
  let tplBuf = null;
  async function exportXlsx(s) {
    if (!window.JSZip) { toast('Chưa tải xong thư viện Excel — kiểm tra mạng rồi thử lại.'); return; }
    try {
      if (!tplBuf) {
        const r = await fetch('bracket-template.xlsx');
        if (!r.ok) throw new Error('không tải được mẫu Excel');
        tplBuf = await r.arrayBuffer();
      }
      const out = await B.fillXlsx(window.JSZip, tplBuf, s);
      const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = B.fileName(s);
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      const extra = (s.rows || []).filter((r) => String(r.sf2).trim() || String(r.sg).trim()).length > B.MAX_ROWS ? ` (chỉ ${B.MAX_ROWS} vị trí đầu)` : '';
      toast(`Đã tạo ${B.fileName(s)}${extra}`);
    } catch (e) { toast('Không xuất được Excel: ' + e.message); }
  }

  // ---------- báo cáo PDF (xem trước khổ A4, in / lưu PDF bằng trình duyệt) ----------
  const R = window.BracketReport;
  let rpSurvey = null;
  function fitPage() {
    const page = $('rpPage'), box = $('rpScroll');
    if (!page || $('rpOverlay').hidden) return;
    const full = page.offsetWidth, avail = box.clientWidth - 32, k = Math.min(1, avail / full);
    page.style.transform = k < 1 ? `scale(${k})` : '';
    page.style.marginBottom = k < 1 ? `${-(1 - k) * page.offsetHeight}px` : '';
    page.style.marginLeft = page.style.marginRight = k < 1 ? `${-(1 - k) * full / 2}px` : '';
  }
  function openReport(s) {
    rpSurvey = s;
    $('rpPage').innerHTML = R.html(s);
    $('rpOverlay').hidden = false; document.body.style.overflow = 'hidden';
    $('rpScroll').scrollTop = 0; fitPage(); $('rpPrint').focus();
  }
  function closeReport() { $('rpOverlay').hidden = true; document.body.style.overflow = ''; rpSurvey = null; }
  function printReport() {
    if (!rpSurvey) return;
    const title = document.title;
    document.title = R.fileName(rpSurvey);               // tên file PDF gợi ý khi "Lưu dưới dạng PDF"
    document.body.classList.add('rp-printing');
    const done = () => { document.body.classList.remove('rp-printing'); document.title = title; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(done, 1500);                               // trình duyệt không báo afterprint
  }

  // ---------- menu Xuất báo cáo: PDF / Excel ----------
  let menuFor = null;
  function openMenu(btn, s) {
    menuFor = s;
    const m = $('exportMenu'), r = btn.getBoundingClientRect();
    m.hidden = false;
    const mh = m.offsetHeight, mw = m.offsetWidth;
    const top = r.bottom + 6 + mh > window.innerHeight ? r.top - mh - 6 : r.bottom + 6;
    m.style.top = `${Math.max(8, top)}px`;
    m.style.left = `${Math.max(8, Math.min(window.innerWidth - mw - 8, r.right - mw))}px`;
    m.querySelector('button').focus();
  }
  function closeMenu() { $('exportMenu').hidden = true; menuFor = null; }

  // ---------- sự kiện ----------
  function bind() {
    $('btnNew').addEventListener('click', async () => { const b = $('btnNew'); b.disabled = true; const s = await addSurvey(blank()); b.disabled = false; if (s) { open(s.id); $('f_project').focus(); } });
    $('secList').addEventListener('click', (e) => {
      if (e.target.closest('#btnUpload')) uploadLocal();
      else if (e.target.closest('#btnReload')) loadServer();
      const f = e.target.closest('[data-lmine]'); if (f) { lMine = f.dataset.lmine === '1'; document.querySelectorAll('[data-lmine]').forEach((x) => x.setAttribute('aria-pressed', String(x === f))); renderList(); }
    });
    $('listQ').addEventListener('input', (e) => { lQ = e.target.value; renderList(); });
    $('bkTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) showTab(b.dataset.tab); });
    $('bkTabs').addEventListener('keydown', (e) => { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; const t = $('tabList').getAttribute('aria-selected') === 'true' ? 'lookup' : 'list'; showTab(t); $(t === 'list' ? 'tabList' : 'tabLookup').focus(); });
    ['lkSf2', 'lkSg', 'lkQ', 'lkFam'].forEach((id) => $(id).addEventListener('input', lookup));
    $('list').addEventListener('click', (e) => {
      const o = e.target.closest('[data-open]'); if (o) { open(o.dataset.open); return; }
      const x = e.target.closest('[data-xls]'); if (x) { const s = surveys.find((v) => v.id === x.dataset.xls); if (s) openMenu(x, s); }
    });
    $('btnBack').addEventListener('click', close);
    ['btnExport', 'btnExport2', 'btnExport3'].forEach((id) => $(id).addEventListener('click', (e) => { e.stopPropagation(); if (cur) openMenu(e.currentTarget, cur); }));
    $('exportMenu').addEventListener('click', (e) => {
      const b = e.target.closest('[data-out]'); if (!b || !menuFor) return;
      const s = menuFor; closeMenu();
      if (b.dataset.out === 'pdf') openReport(s); else exportXlsx(s);
    });
    document.addEventListener('click', (e) => { if (!$('exportMenu').hidden && !e.target.closest('#exportMenu, [data-xls]')) closeMenu(); });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('exportMenu').hidden) closeMenu(); else if (!$('rpOverlay').hidden) closeReport();
    });
    $('rpClose').addEventListener('click', closeReport);
    $('rpPrint').addEventListener('click', printReport);
    $('rpXlsx').addEventListener('click', () => rpSurvey && exportXlsx(rpSurvey));
    window.addEventListener('resize', fitPage);
    $('btnDup').addEventListener('click', async () => {
      if (!cur) return;
      if (editable(cur)) { clearTimeout(saveTimer); persist(); }
      const s = JSON.parse(JSON.stringify(strip(cur)));
      const me = (typeof Session !== 'undefined' && Session.current && Session.current()) || {};
      Object.assign(s, { id: uid(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), liftId: s.liftId ? s.liftId + ' (bản sao)' : '(bản sao)', date: today(),
        surveyor: me.name || s.surveyor, rows: s.rows.map((r) => ({ line: r.line, sf2: '', sg: '' })) });
      const n = await addSurvey(s); if (!n) return;
      open(n.id); toast('Đã nhân bản phiếu (giữ thông tin dự án, bracket và tên vị trí; xóa số đo).');
    });
    $('btnDelete').addEventListener('click', async () => {
      if (!cur || !editable(cur)) return;
      if (!confirm(SERVER ? 'Xóa phiếu khảo sát này khỏi hệ thống? Mọi người sẽ không còn thấy phiếu. Không hoàn tác được — hãy xuất Excel trước nếu cần giữ.' : 'Xóa phiếu khảo sát này khỏi máy? Không hoàn tác được — hãy xuất Excel trước nếu cần giữ.')) return;
      if (SERVER) { try { await api('DELETE', '/api/bracket/surveys/' + cur._m.sid, {}); } catch (e) { toast('Không xóa được: ' + e.message); return; } }
      const x = cur; clearTimeout(saveTimer); surveys = surveys.filter((s) => s !== x); if (!SERVER) persist(); cur = null; close(); toast('Đã xóa phiếu.');
    });
    // ô thông tin + bracket
    $('editor').addEventListener('input', (e) => {
      const el = e.target;
      if (el.dataset.k && cur) { cur[el.dataset.k] = el.value; touch(); refresh(); return; }
      const tr = el.closest('#rows tr');
      if (tr && el.dataset.r && cur) { cur.rows[+tr.dataset.i][el.dataset.r] = el.value; touch(); refresh(); }
    });
    $('editor').addEventListener('change', (e) => { if (e.target.dataset.k && cur) { cur[e.target.dataset.k] = e.target.value; touch(); refresh(); } });
    $('btnAddRow').addEventListener('click', () => {
      if (!cur || cur.rows.length >= B.MAX_ROWS) return;
      cur.rows.push({ line: '', sf2: '', sg: '' }); touch(); renderRows();
      const inp = document.querySelector(`#rows tr[data-i="${cur.rows.length - 1}"] [data-r=line]`); if (inp) inp.focus();
    });
    $('rows').addEventListener('click', (e) => {
      const d = e.target.closest('[data-del]'); if (!d || !cur) return;
      const i = +d.dataset.del, r = cur.rows[i];
      if ((String(r.sf2).trim() || String(r.sg).trim()) && !confirm(`Xóa dòng ${i + 1}${r.line ? ' (' + r.line + ')' : ''}?`)) return;
      cur.rows.splice(i, 1); if (!cur.rows.length) cur.rows.push({ line: '', sf2: '', sg: '' });
      touch(); renderRows();
    });
    // Enter ở ô SG → sang dòng sau (tự thêm dòng)
    $('rows').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || !cur) return;
      const el = e.target, tr = el.closest('tr'); if (!tr) return;
      e.preventDefault();
      const i = +tr.dataset.i, order = ['line', 'sf2', 'sg'], k = order.indexOf(el.dataset.r);
      if (k < 2) { const n = tr.querySelector(`[data-r=${order[k + 1]}]`); if (n) n.focus(); return; }
      if (i === cur.rows.length - 1) { if (cur.rows.length >= B.MAX_ROWS) return; cur.rows.push({ line: '', sf2: '', sg: '' }); touch(); renderRows(); }
      const n = document.querySelector(`#rows tr[data-i="${i + 1}"] [data-r=line]`); if (n) n.focus();
    });
    window.addEventListener('pagehide', () => {
      if (!cur || !editable(cur)) return;
      clearTimeout(saveTimer);
      if (!SERVER) { persist(); return; }
      if (cur._m.dirty) api('PUT', '/api/bracket/surveys/' + cur._m.sid, { version: cur._m.version, data: strip(cur) }, true).catch(() => {});
    });
  }

  const me = (typeof Session !== 'undefined' && Session.current && Session.current()) || null;
  if (me && me.name) $('who').innerHTML = `Đăng nhập: <b>${esc(me.name)}</b> · ` + (SERVER ? 'phiếu lưu trên hệ thống — mọi người cùng xem; chỉ người tạo và Admin được sửa' : 'phiếu lưu trên máy này');
  $('listTitle').textContent = SERVER ? 'Phiếu khảo sát trên hệ thống' : 'Phiếu khảo sát trên máy này';
  $('listTools').hidden = !SERVER;
  bracketOptions(); refTables(); lookupTables(); bind();
  let tab0 = 'list'; try { tab0 = localStorage.getItem('bk_tab') === 'lookup' ? 'lookup' : 'list'; } catch (e) { /* bỏ qua */ }
  if (location.hash === '#tra') tab0 = 'lookup';
  showTab(tab0);
  (async () => {
    if (SERVER) { if (!(await loadServer())) return; renderLocalBanner(); } else renderList();
    const h = location.hash.slice(1); if (h && surveys.some((s) => s.id === h)) open(h);
  })();
})();
