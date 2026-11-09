// Khảo sát Bracket hố thang — giao diện. Phần tính toán ở bracket.js (window.Bracket).
// Phiếu lưu trên máy (localStorage) — xuất Excel theo mẫu bracket-template.xlsx để gửi / lưu trữ.
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
  function load() {
    try { const d = JSON.parse(localStorage.getItem(KEY) || '{}'); return Array.isArray(d.surveys) ? d.surveys : []; } catch (e) { return []; }
  }
  let surveys = load();
  let cur = null;               // phiếu đang mở
  let saveTimer = 0;
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify({ surveys })); $('saved').textContent = 'Đã lưu trên máy này'; }
    catch (e) { $('saved').textContent = 'Không lưu được (bộ nhớ trình duyệt đầy)'; }
  }
  function touch() {
    if (!cur) return;
    cur.updatedAt = new Date().toISOString();
    $('saved').textContent = 'Đang lưu…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 400);
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
  function renderList() {
    const list = surveys.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    $('listEmpty').hidden = list.length > 0;
    $('list').innerHTML = list.map((s) => {
      const c = B.compute(s);
      const title = [s.project || 'Phiếu chưa đặt tên', s.liftId].filter(Boolean).join(' · ');
      const meta = [fmtDate(s.date), c.summary.total ? `${c.summary.total} vị trí · ${c.summary.pass} đạt` : 'chưa có số đo', s.zBracket, s.oBracket].filter(Boolean).join(' · ');
      return `<li><button type="button" class="bk-open" data-open="${esc(s.id)}"><b>${esc(title)}</b><span>${esc(meta)}</span></button>
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
    $('secList').hidden = true; $('editor').hidden = false;
    document.querySelectorAll('#editor [data-k]').forEach((el) => { el.value = cur[el.dataset.k] == null ? '' : cur[el.dataset.k]; });
    $('saved').textContent = 'Đã lưu trên máy này';
    renderRows();
    history.replaceState(null, '', '#' + cur.id);
    window.scrollTo(0, 0);
  }
  function close() {
    clearTimeout(saveTimer); if (cur) persist();
    cur = null; $('editor').hidden = true; $('secList').hidden = false;
    history.replaceState(null, '', location.pathname + location.search);
    renderList();
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
    $('btnNew').addEventListener('click', () => { const s = blank(); surveys.push(s); persist(); open(s.id); $('f_project').focus(); });
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
    $('btnDup').addEventListener('click', () => {
      if (!cur) return;
      const s = JSON.parse(JSON.stringify(cur));
      Object.assign(s, { id: uid(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), liftId: s.liftId ? s.liftId + ' (bản sao)' : '(bản sao)', date: today(),
        rows: s.rows.map((r) => ({ line: r.line, sf2: '', sg: '' })) });
      surveys.push(s); persist(); open(s.id); toast('Đã nhân bản phiếu (giữ thông tin dự án, bracket và tên vị trí; xóa số đo).');
    });
    $('btnDelete').addEventListener('click', () => {
      if (!cur || !confirm('Xóa phiếu khảo sát này khỏi máy? Không hoàn tác được — hãy xuất Excel trước nếu cần giữ.')) return;
      surveys = surveys.filter((s) => s.id !== cur.id); persist(); cur = null; close(); toast('Đã xóa phiếu.');
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
    window.addEventListener('pagehide', () => { if (cur) { clearTimeout(saveTimer); persist(); } });
  }

  const me = (typeof Session !== 'undefined' && Session.current && Session.current()) || null;
  if (me && me.name) $('who').innerHTML = `Đăng nhập: <b>${esc(me.name)}</b> · phiếu lưu trên máy này`;
  bracketOptions(); refTables(); bind(); renderList();
  const h = location.hash.slice(1); if (h && surveys.some((s) => s.id === h)) open(h);
})();
