// Hồ sơ Dự án — đọc chữ từ file hợp đồng Word / Excel ngay trên máy (không upload), để dùng chung bộ trích xuất
// thông tin hợp đồng (extract) như với PDF / ảnh.
//   .docx / .docm  → đọc word/document.xml (đoạn văn + bảng; bảng 2 cột "Nhãn | Giá trị" → "Nhãn: Giá trị")
//   .doc (Word 97-2003) → đọc gần đúng các đoạn chữ trong file nhị phân (khuyên lưu lại .docx / PDF nếu thiếu)
//   .xlsx / .xlsm / .xls / .csv / .ods → mỗi dòng của từng sheet thành một dòng chữ (SheetJS)
// Hàm thuần kiểm thử bằng Node: test/client/docread.test.mjs
(function (root) {
  'use strict';
  const ent = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(Number(d))).replace(/&amp;/g, '&');
  const norm = (s) => String(s == null ? '' : s).replace(/[ \t ]+/g, ' ').trim();

  // chữ của một đoạn <w:p>: <w:t>, tab, xuống dòng
  function paraText(x) {
    let out = '';
    x.replace(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:(?:br|cr)(?:\s[^>]*)?\/>|<w:noBreakHyphen\/>/g, (m, t) => {
      if (t != null) out += ent(t);
      else if (m.startsWith('<w:tab')) out += ' ';
      else if (m.startsWith('<w:noBreak')) out += '-';
      else out += '\n';
      return '';
    });
    return out;
  }
  // một dòng bảng → 1 dòng chữ. 2 ô có chữ, ô đầu ngắn (nhãn) → "Nhãn: Giá trị"; còn lại nối bằng " | "
  function rowLine(cells) {
    const c = cells.map(norm).filter(Boolean);
    const out = [];
    for (let i = 0; i < c.length; i++) if (i === 0 || c[i] !== c[i - 1]) out.push(c[i]);   // ô gộp ngang lặp chữ
    if (out.length === 2 && out[0].length <= 60 && !/[:：]\s*$/.test(out[0])) return out[0] + ': ' + out[1];
    if (out.length === 2) return out[0] + ' ' + out[1];
    return out.join(' | ');
  }
  // vị trí kết thúc thẻ đóng tương ứng (đếm lồng nhau) của <w:tbl> bắt đầu tại i
  function blockEnd(xml, i, tag) {
    const re = new RegExp(`<w:${tag}[ >]|</w:${tag}>`, 'g'); re.lastIndex = i;
    let depth = 0, m;
    while ((m = re.exec(xml))) { if (m[0][1] === '/') { depth--; if (!depth) return m.index + m[0].length; } else depth++; }
    return xml.length;
  }
  function tableText(x) {
    const inner = x.replace(/^<w:tbl[ >]/, '').slice(0, -'</w:tbl>'.length);
    const lines = [];
    // bảng lồng → chữ của bảng con nằm trong ô của bảng cha (đủ cho việc dò thông tin)
    inner.split(/<\/w:tr>/).forEach(tr => {
      const cells = tr.split(/<\/w:tc>/).slice(0, -1).map(tc => (tc.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []).map(paraText).join(' '));
      if (cells.length) { const l = rowLine(cells); if (l) lines.push(l); }
    });
    return lines.join('\n');
  }
  // document.xml → chữ theo thứ tự: đoạn văn và bảng
  function docxXmlToText(xml) {
    const body = (xml.match(/<w:body>([\s\S]*)<\/w:body>/) || [null, xml])[1];
    const out = [];
    const re = /<w:tbl[ >]|<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g;
    let m;
    while ((m = re.exec(body))) {
      if (m[0].startsWith('<w:tbl')) { const e = blockEnd(body, m.index, 'tbl'); out.push(tableText(body.slice(m.index, e))); re.lastIndex = e; }
      else out.push(m[0] === '<w:p/>' ? '' : paraText(m[0]));
    }
    return out.map(s => s.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  // Word 97-2003 (.doc): lấy các đoạn chữ UTF-16LE (tiếng Việt) và chữ 1 byte dài ≥ 4 ký tự — đọc gần đúng
  function legacyDocText(bytes) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const ok = (c) => c === 9 || c === 10 || c === 13 || (c >= 32 && c < 0xfffe && !(c >= 0x7f && c < 0xa0) && !(c >= 0xd800 && c < 0xe000));
    const runs = [];
    let cur = '';
    for (let i = 0; i + 1 < u8.length; i += 2) {
      const c = u8[i] | (u8[i + 1] << 8);
      const latin = c < 0x250 || (c >= 0x1e00 && c < 0x1f00) || (c >= 0x2000 && c < 0x2070) || (c >= 0x300 && c < 0x370);
      if (ok(c) && latin) cur += String.fromCharCode(c); else { if (cur.replace(/\s/g, '').length >= 4) runs.push(cur); cur = ''; }
    }
    if (cur.replace(/\s/g, '').length >= 4) runs.push(cur);
    // chữ trong .doc chủ yếu là UTF-16 (tiếng Việt) — chỉ giữ đoạn có ít nhất 1 chữ cái và tỉ lệ chữ/số cao
    const good = runs.filter(r => /[A-Za-zÀ-ỹ]/.test(r) && (r.match(/[A-Za-z0-9À-ỹ\s.,:;()\/\-]/g) || []).length / r.length > 0.85);
    let text = good.join('\n');
    if (text.replace(/\s/g, '').length < 200) {   // file lưu chữ 1 byte (không dấu)
      let s = '', parts = [];
      for (let i = 0; i < u8.length; i++) { const c = u8[i]; if (c === 9 || c === 10 || c === 13 || (c >= 32 && c < 127)) s += String.fromCharCode(c); else { if (s.replace(/\s/g, '').length >= 6) parts.push(s); s = ''; } }
      if (s.replace(/\s/g, '').length >= 6) parts.push(s);
      const alt = parts.filter(r => /[A-Za-z]{3}/.test(r)).join('\n');
      if (alt.length > text.length) text = alt;
    }
    return text.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
  }
  // bảng tính: rows (mảng các dòng, mỗi dòng mảng ô) → chữ
  function rowsToText(rows) {
    return (rows || []).map(r => rowLine((r || []).map(v => (v instanceof Date ? `${String(v.getDate()).padStart(2, '0')}/${String(v.getMonth() + 1).padStart(2, '0')}/${v.getFullYear()}` : v == null ? '' : String(v))))).filter(Boolean).join('\n');
  }

  const KIND = (name) => {
    const n = String(name || '').toLowerCase();
    if (/\.(docx|docm|dotx)$/.test(n)) return 'docx';
    if (/\.doc$/.test(n)) return 'doc';
    if (/\.(xlsx|xlsm|xls|xlsb|csv|ods)$/.test(n)) return 'sheet';
    if (/\.pdf$/.test(n)) return 'pdf';
    if (/\.(png|jpe?g|webp|bmp|gif|tiff?)$/.test(n)) return 'image';
    return '';
  };

  // ---------- trình duyệt ----------
  let xlsxLoading = null;
  function loadXLSX(base) {
    if (root.XLSX) return Promise.resolve(root.XLSX);
    if (!xlsxLoading) xlsxLoading = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = (base || '../../js/') + 'xlsx.full.min.js?v=36';
      s.onload = () => res(root.XLSX); s.onerror = () => { xlsxLoading = null; rej(new Error('không tải được thư viện đọc Excel')); };
      document.head.appendChild(s);
    });
    return xlsxLoading;
  }
  // File → { text, kind, note }
  async function fileToText(f) {
    const kind = KIND(f.name);
    const buf = await f.arrayBuffer();
    if (kind === 'docx') {
      if (!root.JSZip) throw new Error('chưa tải được thư viện đọc Word (JSZip)');
      const zip = await root.JSZip.loadAsync(buf);
      const doc = zip.file('word/document.xml');
      if (!doc) throw new Error('file Word không hợp lệ');
      let text = docxXmlToText(await doc.async('string'));
      // đầu trang / chân trang (số hợp đồng hay nằm ở đây)
      const hf = Object.keys(zip.files).filter(k => /^word\/(header|footer)\d*\.xml$/.test(k)).sort();
      for (const k of hf) { const t = docxXmlToText(await zip.file(k).async('string')); if (t && !text.includes(t)) text += '\n' + t; }
      return { text, kind };
    }
    if (kind === 'doc') {
      const u8 = new Uint8Array(buf);
      if (u8[0] === 0x50 && u8[1] === 0x4b) return fileToText(new File([buf], f.name + 'x'));   // thực chất là .docx
      return { text: legacyDocText(u8), kind, note: 'File Word đời cũ (.doc): đọc gần đúng. Nếu thiếu thông tin, mở bằng Word và lưu lại dạng .docx hoặc PDF rồi quét lại.' };
    }
    if (kind === 'sheet') {
      const X = await loadXLSX();
      const wb = X.read(new Uint8Array(buf), { type: 'array', cellDates: true });
      const parts = wb.SheetNames.map(n => {
        const rows = X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '', blankrows: false });
        const t = rowsToText(rows);
        return t ? (wb.SheetNames.length > 1 ? `[${n}]\n` : '') + t : '';
      }).filter(Boolean);
      return { text: parts.join('\n\n'), kind, sheets: wb.SheetNames.length };
    }
    throw new Error('định dạng chưa hỗ trợ');
  }

  const api = { docxXmlToText, legacyDocText, rowsToText, rowLine, KIND, fileToText, loadXLSX };
  root.DocRead = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
