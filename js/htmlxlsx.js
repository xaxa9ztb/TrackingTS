// Bảng HTML (style viết inline, như form SWAT "Installation Hours" / "SWAT SCORE CARD") → sheet Excel CÓ ĐỊNH DẠNG bằng ExcelJS:
// màu nền, màu chữ, đậm / nghiêng / gạch chân, cỡ chữ, viền, căn lề, ô gộp (colspan / rowspan), độ rộng cột (<colgroup>), chiều cao dòng.
// Dùng chung cho: công cụ SWAT (Xuất Excel) và Incentive (Standard Hour / Scorecard, mỗi dự án 1 sheet) → cùng một form.
(function (root) {
  'use strict';
  const hex = (c) => {
    c = String(c || '').trim().toLowerCase();
    let m = /^#([0-9a-f]{3})$/.exec(c); if (m) return 'FF' + m[1].split('').map(x => x + x).join('').toUpperCase();
    m = /^#([0-9a-f]{6})$/.exec(c); if (m) return 'FF' + m[1].toUpperCase();
    m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(c);
    if (m) { if (m[4] != null && +m[4] === 0) return null; return 'FF' + [m[1], m[2], m[3]].map(n => (+n).toString(16).padStart(2, '0')).join('').toUpperCase(); }
    const named = { black: 'FF000000', white: 'FFFFFFFF', red: 'FFFF0000', yellow: 'FFFFFF00' };
    return named[c] || null;
  };
  // "font-size:11pt" / "13px" → pt
  const pt = (v) => { const m = /^([\d.]+)(px|pt)?$/.exec(String(v || '').trim()); if (!m) return null; return m[2] === 'px' ? Math.round(+m[1] * 0.75 * 2) / 2 : +m[1]; };
  function parseStyle(s) {
    const o = {};
    String(s || '').split(';').forEach(d => { const i = d.indexOf(':'); if (i > 0) o[d.slice(0, i).trim().toLowerCase()] = d.slice(i + 1).trim(); });
    return o;
  }
  // "1px solid #000" → ExcelJS border side
  function side(v) {
    if (!v || /none|hidden/.test(v)) return null;
    const w = /([\d.]+)px/.exec(v), c = /(#[0-9a-f]{3,6}|rgba?\([^)]+\)|black|white)/i.exec(v);
    const px = w ? +w[1] : 1;
    return { style: px >= 2 ? 'medium' : 'thin', color: { argb: hex(c && c[1]) || 'FF000000' } };
  }
  // text → số khi là số thuần (giữ số chữ số thập phân), số kiểu "11.875.000" (vi-VN) → số nguyên có phân nhóm
  function value(t) {
    const s = String(t).replace(/\u00a0/g, ' ').trim();
    if (/^-?\d+(\.\d+)?$/.test(s) && !/^0\d/.test(s) && s.length <= 15) { const d = (s.split('.')[1] || '').length; return { v: Number(s), fmt: d ? '0.' + '0'.repeat(d) : '0' }; }
    if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) return { v: Number(s.replace(/\./g, '')), fmt: '#,##0' };
    return { v: s };
  }

  function cellText(td) {
    const c = td.cloneNode(true);
    c.querySelectorAll('br').forEach(b => b.replaceWith('\n'));
    return String(c.textContent || '').replace(/\u00a0/g, ' ').replace(/[ \t\r]+/g, ' ').replace(/ *\n */g, '\n').trim();
  }
  // table: phần tử <table>; trả về worksheet
  function addSheet(wb, table, name, opts = {}) {
    const ws = wb.addWorksheet(name, { views: [{ showGridLines: false }], pageSetup: { orientation: opts.landscape ? 'landscape' : 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 1, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } } });
    const base = parseStyle(table.getAttribute('style'));
    // độ rộng cột từ <colgroup><col style="width:…px">
    const widths = [];
    table.querySelectorAll('col').forEach(c => { const m = /width:\s*([\d.]+)px/.exec(c.getAttribute('style') || ''); widths.push(m ? +m[1] : null); });
    (opts.widths || []).forEach((w, i) => { if (w) widths[i] = w; });
    const taken = new Set();
    let r = 0, maxC = 0;
    for (const tr of table.querySelectorAll('tr')) {
      r++;
      let c = 0;
      const trs = parseStyle(tr.getAttribute('style'));
      const hm = /([\d.]+)px/.exec(trs.height || '');
      for (const td of tr.children) {
        if (!/^T[DH]$/.test(td.tagName)) continue;
        c++;
        while (taken.has(r + ':' + c)) c++;
        const cs = Math.max(1, +td.getAttribute('colspan') || 1), rs = Math.max(1, +td.getAttribute('rowspan') || 1);
        for (let i = 0; i < rs; i++) for (let j = 0; j < cs; j++) taken.add((r + i) + ':' + (c + j));
        const st = { ...base, ...parseStyle(td.getAttribute('style')) };
        const cell = ws.getCell(r, c);
        const text = cellText(td);   // textContent: innerText của phần tử đang ẩn luôn rỗng; <br> → xuống dòng
        if (text) { const x = value(text); cell.value = x.v; if (x.fmt) cell.numFmt = x.fmt; }
        const font = { name: opts.font || 'Arial', size: pt(st['font-size']) || opts.size || 10 };
        if (/bold|[6-9]00/.test(st['font-weight'] || '') || td.tagName === 'TH') font.bold = true;
        if (/italic/.test(st['font-style'] || '')) font.italic = true;
        if (/underline/.test(st['text-decoration'] || '')) font.underline = true;
        const fc = hex(st.color); if (fc) font.color = { argb: fc };
        cell.font = font;
        const bg = hex(st.background || st['background-color']);
        if (bg && bg !== 'FFFFFFFF') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        const al = { vertical: 'middle', wrapText: true };
        const ta = st['text-align']; if (/center|right|left/.test(ta || '')) al.horizontal = /center/.test(ta) ? 'center' : /right/.test(ta) ? 'right' : 'left';
        else if (typeof cell.value === 'number') al.horizontal = 'right';
        if (/vertical-rl|vertical-lr/.test(st['writing-mode'] || '')) al.textRotation = 90;
        cell.alignment = al;
        const all = side(st.border);
        const b = { top: side(st['border-top']) || all, left: side(st['border-left']) || all, bottom: side(st['border-bottom']) || all, right: side(st['border-right']) || all };
        if (b.top || b.left || b.bottom || b.right) {
          // viền ô gộp: kẻ cho mọi ô con ở mép
          for (let i = 0; i < rs; i++) for (let j = 0; j < cs; j++) {
            const x = ws.getCell(r + i, c + j), o = {};
            if (i === 0 && b.top) o.top = b.top; if (i === rs - 1 && b.bottom) o.bottom = b.bottom;
            if (j === 0 && b.left) o.left = b.left; if (j === cs - 1 && b.right) o.right = b.right;
            x.border = { ...(x.border || {}), ...o };
          }
        }
        if (cs > 1 || rs > 1) ws.mergeCells(r, c, r + rs - 1, c + cs - 1);
        const h = /([\d.]+)px/.exec(st.height || ''); if (h) ws.getRow(r).height = Math.max(ws.getRow(r).height || 0, +h[1] * 0.75);
        c += cs - 1; maxC = Math.max(maxC, c);
      }
      if (hm) ws.getRow(r).height = +hm[1] * 0.75;
    }
    for (let i = 1; i <= maxC; i++) ws.getColumn(i).width = widths[i - 1] ? Math.max(1.5, Math.round(widths[i - 1] / 7 * 10) / 10) : 12;
    return ws;
  }
  // html: chuỗi chứa một <table> → worksheet (cần DOM của trình duyệt)
  function addSheetHtml(wb, html, name, opts) {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:-99999px;top:0;visibility:hidden';
    box.innerHTML = html; document.body.appendChild(box);
    try { return addSheet(wb, box.querySelector('table'), name, opts); } finally { box.remove(); }
  }
  // tên sheet hợp lệ (≤ 31 ký tự, không []:*?/\), không trùng
  function sheetName(s, used) {
    let n = String(s || 'Sheet').replace(/[\[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Sheet';
    for (let i = 2; used && used.has(n.toLowerCase()); i++) n = n.slice(0, 28) + '~' + i;
    if (used) used.add(n.toLowerCase());
    return n;
  }
  // độ rộng cột (px) cho bảng "Installation Hours" (không có <colgroup>): A nhãn, B đơn vị, C giá trị, D ghi chú, E cách, F bước, G nội dung, H giờ
  const HOURS_WIDTHS = [250, 34, 90, 150, 14, 52, 380, 64];
  const api = { addSheet, addSheetHtml, sheetName, HOURS_WIDTHS, parseStyle, hex, value };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HtmlXlsx = api;
})(typeof window !== 'undefined' ? window : globalThis);
