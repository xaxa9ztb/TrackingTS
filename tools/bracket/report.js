// Báo cáo khảo sát bracket (bản in / PDF, khổ A4 dọc) — dựng HTML từ phiếu, dùng chung trình duyệt và kiểm thử Node.
//   Report.html(survey, { now }) → chuỗi HTML (đặt trong .rp, kiểu ở report.css)
//   Report.verdict(computed)     → { level: ok | site | bad | none, title, text }
// Biểu đồ: mỗi vị trí một hàng, dải dung sai của bracket đã đặt (xanh) + vùng ±10 mm xử lý tại công trường (vàng),
// điểm đo có hình riêng theo kết quả (● đạt, ▲ / ▼ xử lý tại công trường, ✕ không đạt) — không chỉ dựa vào màu.
(function (root) {
  'use strict';
  const B = root.Bracket || (typeof require === 'function' ? require('./bracket.js') : null);

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clean = (t) => String(t || '').replace(/\s{2,}/g, ' ');
  const dmy = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('/') : '');
  const num = (v) => (B.num(v) === null ? '' : String(B.num(v)));

  const ICON = { ok: '✓', pad: '▲', trim: '▼', change: '✕', pit: '✕', none: '–' };
  const TONE = { ok: 'ok', pad: 'site', trim: 'site', change: 'bad', pit: 'bad', none: 'mute' };
  function short(e) {
    switch (e.status) {
      case 'ok': return ['Đạt', ''];
      case 'pad': return ['Đệm bản mã 10mm', `lệch +${e.dev} mm`];
      case 'trim': return ['Đục tỉa chân bracket', `lệch −${e.dev} mm`];
      case 'change': return [`Đổi sang ${clean(e.suggest)}`, 'lệch quá 10 mm'];
      case 'pit': return ['Chỉnh sửa hố thang', e.fam ? `ngoài dải cả dòng ${e.fam}` : 'ngoài dải cả danh mục'];
      default: return [clean(e.text), ''];
    }
  }
  const cell = (e) => {
    if (!e || !e.text) return '<span class="rp-dash">—</span>';
    const [m, s] = short(e);
    return `<span class="rp-res ${TONE[e.status] || 'mute'}"><i aria-hidden="true">${ICON[e.status] || ''}</i><span><b>${esc(m)}</b>${s ? `<small>${esc(s)}</small>` : ''}</span></span>`;
  };

  function verdict(c) {
    const S = c.summary;
    if (!S.total) return { level: 'none', title: 'Chưa có số đo', text: 'Nhập SF2 / SG đo thực tế ở mục 3 để có kết luận.' };
    const swap = S.zSwap + S.oSwap, pit = S.zPit + S.oPit, site = S.zSite + S.oSite;
    if (pit) return { level: 'bad', title: 'Cần chỉnh sửa hố thang', text: `${pit} số đo vượt dung sai toàn bộ bracket${swap ? `, ${swap} số đo cần đổi bracket` : ''}. Chưa đặt hàng khi chưa xử lý.` };
    if (swap) return { level: 'bad', title: 'Cần đổi loại bracket', text: `${swap} số đo lệch quá 10 mm — xem đề xuất bracket thay thế bên dưới trước khi đặt hàng.` };
    if (site) return { level: 'site', title: 'Đạt — có xử lý tại công trường', text: `${site} số đo lệch ≤ 10 mm: đệm bản mã / đục tỉa chân bracket, không cần đổi bracket đã đặt.` };
    return { level: 'ok', title: 'Đạt toàn bộ', text: 'Mọi số đo nằm trong dung sai bracket đã chọn — có thể đặt hàng.' };
  }

  // ---------- biểu đồ dải dung sai (SVG) ----------
  const W = 330, PADL = 30, PADR = 14, ROWH = 15, PADT = 26, PADB = 24;
  function chart(kind, rows, br) {
    const key = kind === 'z' ? 'sf2' : 'sg', res = kind === 'z' ? 'z' : 'o';
    const label = kind === 'z' ? 'SF2 — Z Bracket' : 'SG — Omega Bracket';
    const pts = rows.map((r, i) => ({ i, v: B.num(r[key]), e: r[res], line: r.line })).filter((p) => p.v !== null);
    if (!br || !pts.length) {
      return `<figure class="rp-chart"><figcaption>${label}</figcaption><div class="rp-empty">${br ? 'Chưa có số đo' : 'Chưa chọn bracket'}</div></figure>`;
    }
    // trục: bao dải dung sai ± 40 mm; số đo quá xa vẽ ở mép kèm mũi tên + giá trị
    let lo = Math.min(br.min - 40, ...pts.map((p) => p.v)), hi = Math.max(br.max + 40, ...pts.map((p) => p.v));
    lo = Math.max(lo, br.min - 80); hi = Math.min(hi, br.max + 80);
    const step = (hi - lo) > 200 ? 50 : (hi - lo) > 100 ? 25 : 10;
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    const n = rows.length, H = PADT + n * ROWH + PADB, x = (v) => PADL + (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo) * (W - PADL - PADR);
    const y = (i) => PADT + i * ROWH + ROWH / 2;
    const out = [];
    // vùng ±10 mm (xử lý tại công trường) + dải dung sai
    out.push(`<rect class="tol" x="${x(br.min - B.TOL)}" y="${PADT - 4}" width="${x(br.max + B.TOL) - x(br.min - B.TOL)}" height="${n * ROWH + 8}" rx="3"/>`);
    out.push(`<rect class="band" x="${x(br.min)}" y="${PADT - 4}" width="${x(br.max) - x(br.min)}" height="${n * ROWH + 8}" rx="3"/>`);
    // lưới + nhãn trục
    for (let v = lo; v <= hi; v += step) {
      out.push(`<line class="grid" x1="${x(v)}" x2="${x(v)}" y1="${PADT - 4}" y2="${PADT + n * ROWH + 4}"/>`);
      out.push(`<text class="ax" x="${x(v)}" y="${H - 8}" text-anchor="middle">${v}</text>`);
    }
    out.push(`<text class="lim" x="${x(br.min)}" y="${PADT - 9}" text-anchor="middle">${br.min}</text><text class="lim" x="${x(br.max)}" y="${PADT - 9}" text-anchor="middle">${br.max}</text>`);
    rows.forEach((r, i) => {
      out.push(`<text class="row" x="${PADL - 6}" y="${y(i) + 3.5}" text-anchor="end">${i + 1}</text>`);
      if (i % 2) out.push(`<rect class="zebra" x="${PADL}" y="${PADT + i * ROWH}" width="${W - PADL - PADR}" height="${ROWH}"/>`);
    });
    pts.forEach((p) => {
      const cx = x(p.v), cy = y(p.i), st = p.e.status, off = p.v < lo || p.v > hi;
      const t = `${p.i + 1}. ${p.line || ''} ${key.toUpperCase()} = ${p.v} mm — ${clean(p.e.text)}`;
      let m;
      if (st === 'ok') m = `<circle class="m ok" cx="${cx}" cy="${cy}" r="4.2"/>`;
      else if (st === 'pad' || st === 'trim') m = `<path class="m site" d="M${cx} ${cy + (st === 'pad' ? -5 : 5)} L${cx + 4.6} ${cy + (st === 'pad' ? 3.5 : -3.5)} L${cx - 4.6} ${cy + (st === 'pad' ? 3.5 : -3.5)} Z"/>`;
      else m = `<path class="m bad" d="M${cx - 3.8} ${cy - 3.8} L${cx + 3.8} ${cy + 3.8} M${cx + 3.8} ${cy - 3.8} L${cx - 3.8} ${cy + 3.8}"/>`;
      out.push(`<g><title>${esc(t)}</title>${m}${off ? `<text class="off" x="${cx + (p.v > hi ? -8 : 8)}" y="${cy - 5}" text-anchor="${p.v > hi ? 'end' : 'start'}">${p.v > hi ? '→' : '←'} ${p.v}</text>` : ''}</g>`);
    });
    return `<figure class="rp-chart"><figcaption>${label} <span>· ${esc(clean(br.name))} (${br.min}–${br.max} mm)</span></figcaption>
      <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(label)}: số đo từng vị trí so với dải dung sai ${br.min}–${br.max} mm">${out.join('')}</svg></figure>`;
  }

  // ---------- trang báo cáo ----------
  function html(s, opts = {}) {
    const c = B.compute(s), S = c.summary, v = verdict(c);
    const rows = c.rows.filter((r) => B.num(r.sf2) !== null || B.num(r.sg) !== null || String(r.line || '').trim());
    const now = opts.now ? new Date(opts.now) : new Date();
    const made = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    const info = [['Dự án', s.project], ['Địa điểm', s.location], ['Số hợp đồng', s.contract], ['Mã thang', s.liftId],
      ['Ngày khảo sát', dmy(s.date)], ['Người khảo sát', s.surveyor],
      ['Giếng thang BS × TS', B.num(s.bs) !== null || B.num(s.ts) !== null ? `${num(s.bs) || '—'} × ${num(s.ts) || '—'} mm` : ''],
      ['Tải trọng · Số điểm dừng', [num(s.load) && `${num(s.load)} kg`, num(s.stops) && `${num(s.stops)} điểm dừng`].filter(Boolean).join(' · ')]];
    const tile = (val, t, tone) => `<div class="rp-tile ${val ? tone : ''}"><b>${val}</b><span>${t}</span></div>`;
    const brCard = (kind) => {
      const b = kind === 'z' ? c.zb : c.ob, d = kind === 'z' ? c.design.z : c.design.o, dv = kind === 'z' ? s.sf2Design : s.sgDesign;
      const name = kind === 'z' ? 'Z Bracket' : 'Omega Bracket', m = kind === 'z' ? 'SF' : 'SG';
      return `<div class="rp-br"><h4>${name}</h4>${b ? `<p class="rp-brn">${esc(clean(b.name))}</p>
        <p>${m}min – ${m}max: <b>${b.min} – ${b.max} mm</b>${kind === 'z' ? ` · dòng <b>${b.fam}</b>` : ''}</p>` : '<p class="rp-brn">Chưa chọn</p>'}
        <p>${m}${kind === 'z' ? '2' : ''} theo bản vẽ: <b>${num(dv) ? num(dv) + ' mm' : '—'}</b>${d.text ? ` <span class="rp-res ${d.ok ? 'ok' : 'bad'} inline"><i>${d.ok ? '✓' : '⚠'}</i><b>${d.ok ? 'Phù hợp' : 'Không phù hợp'}</b></span>` : ''}</p></div>`;
    };
    // việc cần làm: gom theo loại xử lý
    const todo = { pad: [], trim: [], change: [], pit: [] };
    rows.forEach((r, i) => [['z', 'SF2', r.sf2], ['o', 'SG', r.sg]].forEach(([k, m, val]) => {
      const e = r[k]; if (todo[e.status]) todo[e.status].push({ i, line: r.line, m, val, e });
    }));
    const who = (x) => `<b>${x.i + 1}${x.line ? ' · ' + esc(x.line) : ''}</b> (${x.m} ${x.val} mm${x.e.dev ? `, lệch ${x.e.dev} mm` : ''}${x.e.suggest ? ` → <b>${esc(clean(x.e.suggest))}</b>` : ''})`;
    const todoBlock = [['pit', 'bad', '✕ Chỉnh sửa hố thang', 'vượt dung sai toàn bộ bracket'], ['change', 'bad', '✕ Đổi loại bracket', 'lệch quá 10 mm, đề xuất bracket thay thế'],
      ['pad', 'site', '▲ Đệm bản mã 10 mm', 'vượt max ≤ 10 mm, không đổi bracket'], ['trim', 'site', '▼ Đục tỉa chân bracket', 'nhỏ hơn min ≤ 10 mm, không đổi bracket']]
      .filter(([k]) => todo[k].length)
      .map(([k, tone, t, sub]) => `<li class="${tone}"><p><b>${t}</b> <span>— ${sub}</span></p><p>${todo[k].map(who).join('; ')}</p></li>`).join('');
    const sum = [['Tổng số vị trí khảo sát', S.total], ['Số vị trí ĐẠT (SF2 và SG đều trong dung sai)', S.pass],
      ['Cần thay đổi Z Bracket (SF2 ngoài dung sai)', S.zChange], ['· xử lý tại công trường (đệm / đục)', S.zSite, 1], ['· đổi sang loại Z Bracket khác (cùng dòng)', S.zSwap, 1],
      ['Cần thay đổi Omega Bracket (SG ngoài dung sai)', S.oChange], ['· xử lý tại công trường (đệm / đục)', S.oSite, 1], ['· đổi sang loại Omega Bracket khác', S.oSwap, 1],
      ['SF2 vượt dung sai toàn bộ Z Bracket — chỉnh sửa hố thang', S.zPit], ['SG vượt dung sai toàn bộ Omega Bracket — chỉnh sửa hố thang', S.oPit]]
      .map(([t, n, sub]) => `<tr class="${sub ? 'sub' : ''}"><td>${t}</td><td>${n}</td></tr>`).join('');

    return `<article class="rp" lang="vi">
  <header class="rp-head">
    <div><p class="rp-kicker">Bộ công cụ dự án · Phiếu khảo sát trước khi đặt hàng</p>
      <h1>Khảo sát Bracket hố thang</h1><p class="rp-sub">Z Bracket (SF2) &amp; Omega Bracket (SG) · ${esc(s.project || 'Chưa đặt tên dự án')}${s.liftId ? ' · thang ' + esc(s.liftId) : ''}</p></div>
    <div class="rp-meta"><span>Ngày khảo sát</span><b>${dmy(s.date) || '—'}</b><span>Ngày xuất</span><b>${made}</b></div>
  </header>

  <section class="rp-verdict ${v.level}"><i aria-hidden="true">${{ ok: '✓', site: '▲', bad: '✕', none: '…' }[v.level]}</i><div><h2>${v.title}</h2><p>${v.text}</p></div></section>

  <section class="rp-tiles">${tile(S.total, 'vị trí khảo sát', 'info')}${tile(S.pass, 'đạt cả SF2 &amp; SG', 'ok')}${tile(S.zSite + S.oSite, 'xử lý tại công trường', 'site')}${tile(S.zSwap + S.oSwap, 'cần đổi bracket', 'bad')}${tile(S.zPit + S.oPit, 'chỉnh sửa hố thang', 'bad')}</section>

  <section class="rp-grid2">
    <div class="rp-card"><h3>1 · Thông tin dự án &amp; thang</h3><dl class="rp-info">${info.map(([k, val]) => `<dt>${k}</dt><dd>${esc(val) || '—'}</dd>`).join('')}</dl></div>
    <div class="rp-card"><h3>2 · Bracket đặt hàng</h3><div class="rp-brs">${brCard('z')}${brCard('o')}</div></div>
  </section>

  <section class="rp-card rp-keep"><h3>3 · Số đo so với dải dung sai</h3>
    <div class="rp-charts">${chart('z', rows, c.zb)}${chart('o', rows, c.ob)}</div>
    <p class="rp-legend"><span class="lg band"></span>Dải dung sai bracket đã đặt <span class="lg tol"></span>±10 mm — xử lý tại công trường
      <span class="lg-m ok">●</span>Đạt <span class="lg-m site">▲▼</span>Đệm / đục <span class="lg-m bad">✕</span>Không đạt <span class="muted">· số = STT vị trí</span></p>
  </section>

  <section class="rp-card"><h3>4 · Kết quả từng vị trí</h3>
    <table class="rp-table"><thead><tr><th class="n">STT</th><th>Vị trí (line)</th><th class="r">SF2 (mm)</th><th>Kết quả Z Bracket</th><th class="r">SG (mm)</th><th>Kết quả Omega Bracket</th></tr></thead>
    <tbody>${rows.map((r, i) => `<tr><td class="n">${i + 1}</td><td>${esc(r.line) || '—'}</td><td class="r">${num(r.sf2) || '—'}</td><td>${cell(r.z)}</td><td class="r">${num(r.sg) || '—'}</td><td>${cell(r.o)}</td></tr>`).join('') || '<tr><td colspan="6" class="rp-dash">Chưa có vị trí khảo sát</td></tr>'}</tbody></table>
  </section>

  <section class="rp-grid2 rp-keep">
    <div class="rp-card"><h3>5 · Việc cần làm</h3>${todoBlock ? `<ul class="rp-todo">${todoBlock}</ul>` : `<p class="rp-none">${S.total ? '✓ Không có vị trí cần xử lý.' : 'Chưa có số đo.'}</p>`}</div>
    <div class="rp-card"><h3>6 · Kết luận</h3><table class="rp-sum">${sum}</table></div>
  </section>

  <section class="rp-sign rp-keep">${['Người khảo sát', 'Giám sát (Site Sup)', 'Quản lý dự án'].map((t, i) => `<div><p>${t}</p><div class="rp-line"></div><p class="rp-name">${i === 0 ? esc(s.surveyor || '') : ''}</p></div>`).join('')}</section>

  <footer class="rp-foot">Dung sai theo ${esc(B.SOURCE)} — chỉ áp dụng SC-AP. Lệch ≤ ${B.TOL} mm xử lý tại công trường; Z Bracket chỉ đề xuất cùng dòng, Omega đề xuất trong cả danh mục. Đối chiếu bản gốc trước khi quyết định đổi bracket chính thức.</footer>
</article>`;
  }

  const fileName = (s) => B.fileName(s).replace(/\.xlsx$/, '');
  const api = { html, verdict, chart, fileName };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BracketReport = api;
})(typeof window !== 'undefined' ? window : globalThis);
