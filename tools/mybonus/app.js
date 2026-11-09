// Thưởng của tôi — mỗi người chỉ xem tiền thưởng CỦA MÌNH ở các đợt Admin đã phát hành (máy chủ chỉ trả các dòng mang Mã NV
// của người đăng nhập: /api/incentive/mine). Mỗi dự án: số tiền, % giờ công, báo cáo SWAT (Standard Hour + Scorecard) của dự án.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => Math.round(Number(n) || 0).toLocaleString('vi-VN');
  const fmt1 = (n) => (n == null || n === '' ? '—' : (Math.round((Number(n) || 0) * 10) / 10).toLocaleString('vi-VN'));
  const pct = (x) => (x == null ? '—' : (Math.round(x * 1000) / 10).toLocaleString('vi-VN') + '%');
  const ml = (m) => `${m.slice(5, 7)}/${m.slice(0, 4)}`;
  const KIND = { first70: 'Trả lần đầu 70%', first100: 'Trả đủ 100%', final30: 'Đợt cuối 30%', final20: 'Đợt cuối 20%', other: 'Đã chia' };
  let data = { batches: [] };

  async function api(path) {
    let resp;
    try { resp = await fetch(path, { credentials: 'same-origin', redirect: 'manual', cache: 'no-store' }); }
    catch (e) { throw new Error('Không gửi được yêu cầu tới máy chủ — kiểm tra mạng rồi thử lại.'); }
    if (resp.type === 'opaqueredirect' || (resp.status >= 300 && resp.status < 400)) throw new Error('Phiên đăng nhập đã hết hạn — tải lại trang (F5).');
    let d = {}; try { d = await resp.json(); } catch (e) { /* bỏ qua */ }
    if (!resp.ok) { const err = new Error(d.error || ('Lỗi máy chủ (HTTP ' + resp.status + ')')); err.status = resp.status; throw err; }
    return d;
  }
  const gate = (m, err) => { const el = $('gate'); el.innerHTML = m; el.className = 'ac-msg' + (err ? ' err' : ''); el.hidden = false; };

  function render() {
    const years = [...new Set(data.batches.map(b => b.month.slice(0, 4)))].sort().reverse();
    const sel = $('fYear'), keep = sel.value;
    sel.innerHTML = '<option value="">Tất cả</option>' + years.map(y => `<option${y === keep ? ' selected' : ''}>${y}</option>`).join('');
    const y = sel.value, list = data.batches.filter(b => !y || b.month.startsWith(y));
    const total = list.reduce((a, b) => a + b.total, 0), nP = new Set(list.flatMap(b => b.projects.map(p => p.wbs))).size;
    const box = (l, v) => `<div><span>${l}</span><b>${v}</b></div>`;
    $('kpis').innerHTML = list.length ? box(y ? `Tổng thưởng năm ${y}` : 'Tổng thưởng', money(total) + ' đ') + box('Số đợt', list.length) + box('Số dự án', nP) : '';
    $('batches').innerHTML = list.map(b => `<article class="mb-batch" id="dot-${b.id}">
        <header><b>Đợt ${ml(b.month)}</b><span class="ac-note">${esc(b.title || '')}${b.publishedAt ? ' · phát hành ' + esc(new Date(b.publishedAt).toLocaleDateString('vi-VN')) : ''}</span><b class="amt">${money(b.total)} đ</b></header>
        <div class="ac-scroll"><table class="ac-table ni-cards"><thead><tr><th>Dự án</th><th>Đợt trả</th><th>Vai trò</th><th class="r">Giờ công · %</th><th class="r">Tiền thưởng (đ)</th><th></th></tr></thead><tbody>
        ${b.projects.map(p => p.lines.map(l => `<tr><td data-label="Dự án"><b>${esc(p.name)}</b> <span class="mono ac-note">${esc(p.wbs)}</span></td><td data-label="Đợt trả">${esc(KIND[p.kind] || p.kind)}</td>
          <td data-label="Vai trò">${l.role === 'sup' ? 'Site-sup' : 'Fitter'}</td><td class="r" data-label="Giờ công · %">${l.role === 'fitter' ? `${fmt1(l.hours)} giờ · ${pct(l.pct)}` : '—'}</td>
          <td class="r" data-label="Tiền thưởng"><b>${money(l.amount)}</b>${l.before ? `<div class="ac-note">tổng ${money(l.total)} − đã nhận ${money(l.before)}</div>` : ''}</td>
          <td><button class="btn small" type="button" data-d="${b.id}|${esc(p.wbs)}">Báo cáo SWAT</button></td></tr>`).join('')).join('')}
        </tbody></table></div></article>`).join('')
      || '<p class="ac-note">Chưa có đợt thưởng nào của bạn được phát hành. Khi Admin phát hành đợt thưởng, bạn sẽ nhận email và xem được tại đây.</p>';
  }

  let toolReady = null;
  function tool() {
    if (toolReady) return toolReady;
    toolReady = new Promise((ok) => {
      const f = $('tool');
      const done = () => { const w = f.contentWindow; if (w && w.SWAT) ok(w.SWAT); else setTimeout(done, 100); };
      f.addEventListener('load', () => setTimeout(done, 50), { once: true });
      f.src = '../swat-hour/index.html';
    });
    return toolReady;
  }
  async function openDetail(id, wbs) {
    const d = await api(`/api/incentive/mine/${id}/${encodeURIComponent(wbs)}`);
    const p = d.project, sc = p.sc || {}, std = p.std || {}, l = p.lines[0], units = p.units || 1;
    const dl = (rows) => `<dl>${rows.filter(Boolean).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
    const yes = (x) => (x ? '✓' : '✗');
    $('hDetail').textContent = `Báo cáo SWAT — ${p.name} (đợt ${ml(d.batch.month)})`;
    $('detail').innerHTML = `<p class="ac-note">WBS <b>${esc(p.wbs)}</b>${p.product ? ' · ' + esc(p.product) : ''}${p.stops ? ' · ' + p.stops + ' điểm dừng' : ''} · ${units} unit · ${esc(KIND[p.kind] || p.kind)}</p>
      <div class="mb-grid">
        <div class="mb-box me"><h3>Thưởng của bạn</h3>${dl(p.lines.map(x => [x.role === 'sup' ? 'Vai trò' : 'Vai trò', x.role === 'sup' ? 'Site-sup' : 'Fitter']).slice(0, 1).concat(
          p.lines.flatMap(x => [x.role === 'fitter' ? ['Giờ công của bạn', fmt1(x.hours) + ' giờ'] : null, x.role === 'fitter' ? ['% giờ công trên dự án', pct(x.pct)] : null,
            x.before ? ['Tổng được hưởng (final)', money(x.total) + ' đ'] : null, x.before ? ['Đã nhận đợt trước', money(x.before) + ' đ'] : null, ['Đợt này', `<span class="big">${money(x.amount)} đ</span>`]])))}</div>
        <div class="mb-box"><h3>Standard Hour</h3>${dl([['Giờ tiêu chuẩn / unit', fmt1(std.perUnit)], ['Giờ tiêu chuẩn toàn dự án', fmt1(std.whole)], ['Giờ đã dùng (bảng công)', fmt1(std.used)], p.fitterHours ? ['Tổng giờ các fitter được chia', fmt1(p.fitterHours)] : null])}</div>
        <div class="mb-box"><h3>Scorecard</h3>${p.sc ? dl([['Giờ thực tế (dùng + dự phòng)', fmt1(sc.act)], ['Tiết kiệm (− là vượt)', fmt1(-(sc.save || 0))], ['Block 12 giờ', fmt1(sc.block)],
          ['Fitter score', `${sc.fs} / 3`], ['Site-sup score', `${sc.ss} / 6`],
          sc.crit ? ['SAIS · PQC ≥ 90% · không thẻ vàng', `${yes(sc.crit.sais)} ${yes(sc.crit.pqc)} ${yes(sc.crit.yellow)}`] : null,
          ['Thưởng Fitter / unit', money(sc.pf) + ' đ'], ['Thưởng Site-sup / unit', money(sc.ps) + ' đ']]) : '<p class="ac-note">Dữ liệu đợt này được nhập từ file kế toán — không có Scorecard chi tiết.</p>'}</div>
        <div class="mb-box"><h3>Quỹ thưởng dự án</h3>${dl([['Quỹ Fitter', p.fundF == null ? '—' : money(p.fundF) + ' đ'], ['Quỹ Site-sup', p.fundS == null ? '—' : money(p.fundS) + ' đ'], ['Tỉ lệ trả đợt này', p.rate ? Math.round(p.rate * 100) + '%' : '—']])}
          <p class="ac-note">Fitter chia quỹ Fitter theo % giờ công trên dự án.</p></div>
      </div>`;
    $('toolBox').hidden = !d.swatState;
    $('toolBox').open = false;
    $('toolBox').ontoggle = async () => {
      if (!$('toolBox').open || !d.swatState) return;
      const S = await tool();
      S.setState(d.swatState); S.recalc(); if (S.setConfirmed) S.setConfirmed(true);
    };
    $('secDetail').hidden = false;
    $('secDetail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function boot() {
    try {
      const me = await api('/api/me');
      $('who').textContent = `Đăng nhập: ${me.name || me.email}${me.empId ? ' · Mã NV ' + me.empId : ''}`;
      if (!me.empId) { gate('Tài khoản chưa gắn với nhân viên nào nên chưa có thưởng để xem. Liên hệ quản trị viên.'); return; }
      data = await api('/api/incentive/mine');
      $('secMine').hidden = false;
      render();
      const m = /dot=(\d+)/.exec(location.hash);
      if (m) { const el = $('dot-' + m[1]); if (el) { el.classList.add('hl'); if (el.closest('article')) $('fYear').value = ''; el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }
    } catch (e) { gate('✗ ' + esc(e.message), true); }
    $('fYear').onchange = render;
    $('batches').addEventListener('click', (ev) => { const b = ev.target.closest('[data-d]'); if (!b) return; const [id, wbs] = b.dataset.d.split('|'); openDetail(id, wbs).catch(e => alert(e.message)); });
    $('dClose').onclick = () => { $('secDetail').hidden = true; };
  }
  boot();
})();
