// Hồ sơ Dự án › Công văn, biên bản — XEM TRƯỚC và SỬA TAY trước khi xuất Word.
// Thân văn bản do hsletters.js dựng (WordprocessingML) → HTML trang A4 để xem; mỗi đoạn (kể cả đoạn trong ô bảng)
// là một ô sửa được. Sửa tay lưu theo đoạn: { [khoá]: { o: chữ gốc của đoạn, x: các run XML mới } } và được áp lại
// lên XML lúc xuất (applyEdits). Đoạn gốc đổi chữ (do sửa ô thông tin) → sửa tay đó không còn khớp, báo người dùng.
// Phần chuỗi (paragraphs / applyEdits / toHtml) thuần JS — chạy được trong Node để kiểm thử; phần DOM chỉ ở trình duyệt.
(function (root) {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const unx = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const P_RE = /<w:p>([\s\S]*?)<\/w:p>/g;
  const split = (inner) => { const m = /^(<w:pPr>[\s\S]*?<\/w:pPr>)?([\s\S]*)$/.exec(inner); return { ppr: m[1] || '', runs: m[2] || '' }; };
  // chữ thuần của một đoạn: \n = xuống dòng, \t = tab
  function runsText(runs) {
    let t = '';
    String(runs).replace(/<w:br\/>|<w:tab\/>|<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g, (m, x) => { t += m === '<w:br/>' ? '\n' : m === '<w:tab/>' ? '\t' : unx(x); return m; });
    return t;
  }
  // mọi đoạn theo thứ tự trong văn bản (cả đoạn trong bảng)
  function paragraphs(xml) {
    const out = []; let m; P_RE.lastIndex = 0;
    while ((m = P_RE.exec(xml))) { const s = split(m[1]); out.push({ i: out.length, start: m.index, end: m.index + m[0].length, ppr: s.ppr, runs: s.runs, text: runsText(s.runs) }); }
    return out;
  }
  // áp sửa tay; trả { xml, plan: Map(chỉ số đoạn → khoá), miss: [khoá không còn khớp] }
  function applyEdits(xml, ed) {
    const plan = new Map(), miss = [];
    const keys = ed && typeof ed === 'object' ? Object.keys(ed) : [];
    if (!keys.length) return { xml, plan, miss };
    const ps = paragraphs(xml), taken = new Set();
    keys.forEach((k) => {
      const e = ed[k]; if (!e || typeof e.x !== 'string') return;
      let i = Number(String(k).split('_')[0]);
      if (!(ps[i] && ps[i].text === e.o && !taken.has(i))) i = ps.findIndex((p) => p.text === e.o && !taken.has(p.i) && p.text.trim());
      if (i < 0) { miss.push(k); return; }
      taken.add(i); plan.set(i, k);
    });
    if (!plan.size) return { xml, plan, miss };
    let res = '', pos = 0;
    ps.forEach((p) => { if (plan.has(p.i)) { res += xml.slice(pos, p.start) + '<w:p>' + p.ppr + ed[plan.get(p.i)].x + '</w:p>'; pos = p.end; } });
    return { xml: res + xml.slice(pos), plan, miss };
  }

  // ---------- XML → HTML (trang A4) ----------
  const tw = (v) => (Number(v) || 0) / 20;                           // twip → pt
  const attr = (s, name) => { const m = new RegExp('w:' + name + '="([^"]*)"').exec(s || ''); return m ? m[1] : null; };
  function rprCss(rpr) {
    const c = [];
    if (/<w:b\/>/.test(rpr)) c.push('font-weight:700');
    if (/<w:i\/>/.test(rpr)) c.push('font-style:italic');
    if (/<w:u\s/.test(rpr)) c.push('text-decoration:underline');
    if (/<w:caps\/>/.test(rpr)) c.push('text-transform:uppercase');
    const sz = /<w:sz w:val="(\d+)"/.exec(rpr); if (sz) c.push('font-size:' + (sz[1] / 2) + 'pt');
    const f = /<w:rFonts w:ascii="([^"]*)"/.exec(rpr); if (f) c.push(`font-family:'${f[1].replace(/'/g, '')}',sans-serif`);
    const col = /<w:color w:val="([0-9A-Fa-f]{6})"/.exec(rpr); if (col) c.push('color:#' + col[1]);
    return c.join(';');
  }
  function runsHtml(runs, tabW) {
    let h = '';
    String(runs).replace(/<w:r>([\s\S]*?)<\/w:r>/g, (m, inner) => {
      const rp = /^<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(inner), rpr = rp ? rp[0] : '';
      const body = rp ? inner.slice(rp[0].length) : inner;
      body.replace(/<w:br\/>|<w:tab\/>|<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g, (t, x) => {
        if (t === '<w:br/>') h += '<br>';
        else if (t === '<w:tab/>') h += `<span class="pv-tab" data-tab="1" contenteditable="false" style="width:${tabW}pt"></span>`;
        else if (x !== '') h += `<span data-rpr="${esc(rpr)}"${rprCss(rpr) ? ` style="${rprCss(rpr)}"` : ''}>${esc(unx(x))}</span>`;
        return t;
      });
      return m;
    });
    return h;
  }
  function paraHtml(p, o) {
    const pp = p.ppr, css = [];
    const jc = attr(/<w:jc [^>]*>/.exec(pp) && /<w:jc [^>]*>/.exec(pp)[0], 'val');
    if (jc) css.push('text-align:' + (jc === 'both' ? 'justify' : jc));
    const sp = (/<w:spacing [^>]*>/.exec(pp) || [''])[0];
    const before = tw(attr(sp, 'before')), after = tw(attr(sp, 'after')), line = Number(attr(sp, 'line')) || 276;
    css.push(`margin:${before}pt 0 ${after}pt 0`, `line-height:${(line / 240).toFixed(2)}`);
    const ind = (/<w:ind [^>]*>/.exec(pp) || [''])[0];
    const left = tw(attr(ind, 'left')), hang = tw(attr(ind, 'hanging')), first = tw(attr(ind, 'firstLine'));
    if (left) css.push('padding-left:' + left + 'pt');
    if (hang) css.push('text-indent:-' + hang + 'pt'); else if (first) css.push('text-indent:' + first + 'pt');
    const empty = !p.text.trim();
    if (empty) return `<div class="pv-e" style="${css.join(';')}">&#8203;</div>`;
    const k = o.plan.get(p.i);
    return `<div class="pv-p${k != null ? ' ed' : ''}" data-pi="${p.i}"${k != null ? ` data-k="${esc(k)}"` : ''} data-o="${esc(o.base[p.i] ? o.base[p.i].text : p.text)}" contenteditable="${o.editable ? 'true' : 'false'}" spellcheck="false" style="${css.join(';')}">${runsHtml(p.runs, hang || 36)}</div>`;
  }
  function tableHtml(tbl, o, nextPara) {
    const widths = []; tbl.replace(/<w:gridCol w:w="(\d+)"\/>/g, (m, w) => { widths.push(+w); return m; });
    const total = widths.reduce((a, b) => a + b, 0) || 9000;
    const bd = /<w:tblBorders>[\s\S]*?w:val="none"/.test(tbl) ? 'none' : '1px solid #000';
    let h = `<table class="pv-t" style="width:${Math.min(100, total / 9026 * 100).toFixed(1)}%"><colgroup>${widths.map((w) => `<col style="width:${(w / total * 100).toFixed(2)}%">`).join('')}</colgroup>`;
    tbl.replace(/<w:tr>([\s\S]*?)<\/w:tr>/g, (m, tr) => {
      h += '<tr>';
      tr.replace(/<w:tc>([\s\S]*?)<\/w:tc>/g, (m2, tc) => {
        const pr = (/<w:tcPr>([\s\S]*?)<\/w:tcPr>/.exec(tc) || ['', ''])[1];
        const span = Number(attr((/<w:gridSpan [^>]*>/.exec(pr) || [''])[0], 'val')) || 1;
        const fill = attr((/<w:shd [^>]*>/.exec(pr) || [''])[0], 'fill');
        const va = attr((/<w:vAlign [^>]*>/.exec(pr) || [''])[0], 'val') || 'top';
        let inner = '';
        tc.replace(P_RE, () => { inner += paraHtml(nextPara(), o); return ''; });
        h += `<td${span > 1 ? ` colspan="${span}"` : ''} style="border:${bd};vertical-align:${va === 'center' ? 'middle' : va}${fill && fill !== 'auto' ? ';background:#' + fill : ''}">${inner}</td>`;
        return m2;
      });
      h += '</tr>';
      return m;
    });
    return h + '</table>';
  }
  // HTML thân văn bản; o = { ed, editable } → { html, miss, plan }
  function toHtml(baseXml, o = {}) {
    const base = paragraphs(baseXml);
    const A = applyEdits(baseXml, o.ed);
    const ps = paragraphs(A.xml);
    let pi = 0;
    const ctx = { plan: A.plan, base, editable: o.editable !== false };
    const next = () => ps[pi++];
    let html = '';
    A.xml.replace(/<w:tbl>[\s\S]*?<\/w:tbl>|<w:p>[\s\S]*?<\/w:p>/g, (m) => {
      if (m.startsWith('<w:tbl>')) html += tableHtml(m, ctx, next);
      else html += paraHtml(next(), ctx);
      return m;
    });
    return { html, miss: A.miss, plan: A.plan, count: A.plan.size };
  }

  // ---------- (trình duyệt) ô sửa → run XML ----------
  const setFlag = (rpr, tag, xml, on) => {
    let inner = rpr ? rpr.replace(/^<w:rPr>|<\/w:rPr>$/g, '') : '';
    const re = new RegExp('<w:' + tag + '(?:\\s[^>]*)?/>' + (tag === 'b' ? '(<w:bCs/>)?' : tag === 'i' ? '(<w:iCs/>)?' : ''), 'g');
    const has = re.test(inner);
    if (on === false && has) inner = inner.replace(re, '');
    if (on === true && !has) inner = xml + inner;
    return inner ? '<w:rPr>' + inner + '</w:rPr>' : '';
  };
  function domToRuns(el) {
    const firstSpan = el.querySelector('[data-rpr]');
    const baseRpr = firstSpan ? firstSpan.getAttribute('data-rpr') : '';
    const out = [];
    const push = (rpr, fx, body) => {
      let r = rpr;
      if (fx.b !== undefined) r = setFlag(r, 'b', '<w:b/><w:bCs/>', fx.b);
      if (fx.i !== undefined) r = setFlag(r, 'i', '<w:i/><w:iCs/>', fx.i);
      if (fx.u !== undefined) r = setFlag(r, 'u', '<w:u w:val="single"/>', fx.u);
      out.push(`<w:r>${r}${body}</w:r>`);
    };
    const walk = (n, rpr, fx, top) => {
      if (n.nodeType === 3) { const t = n.nodeValue.replace(/​/g, '').replace(/ /g, ' '); if (t) push(rpr, fx, `<w:t xml:space="preserve">${esc(t)}</w:t>`); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (tag === 'BR') { push(rpr, fx, '<w:br/>'); return; }
      if (n.getAttribute('data-tab')) { out.push('<w:r><w:tab/></w:r>'); return; }
      const r2 = n.hasAttribute('data-rpr') ? n.getAttribute('data-rpr') : rpr;
      const f2 = Object.assign({}, fx);
      if (tag === 'B' || tag === 'STRONG') f2.b = true;
      if (tag === 'I' || tag === 'EM') f2.i = true;
      if (tag === 'U') f2.u = true;
      const st = n.style || {};
      if (!n.hasAttribute('data-rpr')) {           // span do trình duyệt tạo khi bấm B / I / U (kiểu chữ trong style)
        if (st.fontWeight) f2.b = /bold|[6-9]00/.test(st.fontWeight);
        if (st.fontStyle) f2.i = st.fontStyle === 'italic';
        if (st.textDecoration || st.textDecorationLine) f2.u = /underline/.test(st.textDecorationLine || st.textDecoration);
      }
      if (!top && (tag === 'DIV' || tag === 'P') && out.length) push(r2, f2, '<w:br/>');   // Enter tạo khối mới → xuống dòng
      n.childNodes.forEach((c) => walk(c, r2, f2, false));
    };
    el.childNodes.forEach((c) => walk(c, baseRpr, {}, false));
    // bỏ xuống dòng thừa ở cuối (trình duyệt hay chèn <br> cuối ô)
    while (out.length && /<w:br\/><\/w:r>$/.test(out[out.length - 1]) && !/<w:t /.test(out[out.length - 1])) out.pop();
    return out.join('');
  }

  // dạng chuẩn để so hai dãy run (cùng chữ + cùng định dạng → giống nhau dù cách chia run khác)
  function canon(runs) {
    const seq = [];
    String(runs).replace(/<w:r>([\s\S]*?)<\/w:r>/g, (m, inner) => {
      const rp = /^<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(inner), rpr = rp ? rp[1] : '';
      (rp ? inner.slice(rp[0].length) : inner).replace(/<w:br\/>|<w:tab\/>|<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g, (t, x) => {
        const tok = t === '<w:br/>' ? '\n' : t === '<w:tab/>' ? '\t' : unx(x);
        if (!tok) return t;
        const key = tok === '\t' ? '' : rpr;
        if (seq.length && seq[seq.length - 1][0] === key) seq[seq.length - 1][1] += tok; else seq.push([key, tok]);
        return t;
      });
      return m;
    });
    return JSON.stringify(seq);
  }
  const api = { paragraphs, applyEdits, runsText, toHtml, domToRuns, canon, esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HsPreview = api;
})(typeof window !== 'undefined' ? window : globalThis);
