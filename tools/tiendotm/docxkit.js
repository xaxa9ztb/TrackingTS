// Bộ dựng Word (.docx) dùng chung cho Hồ sơ Dự án: công văn (khuôn header/footer chung), biên bản, hồ sơ pháp lý.
// Thuần JS (trình duyệt + Node để kiểm thử); cần JSZip truyền vào khi đóng gói.
(function (root) {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const DOTS = '……………………';
  const orDots = (v, n) => (String(v == null ? '' : v).trim() ? String(v).trim() : (n ? '.'.repeat(n) : DOTS));

  // ---- chữ (run) ----
  // r('chữ', {b, i, u, sz (pt), caps, color, font}) ; chuỗi có \n → xuống dòng trong cùng đoạn
  function r(text, o = {}) {
    const pr = [];
    if (o.font) pr.push(`<w:rFonts w:ascii="${esc(o.font)}" w:hAnsi="${esc(o.font)}" w:cs="${esc(o.font)}"/>`);
    if (o.b) pr.push('<w:b/><w:bCs/>');
    if (o.i) pr.push('<w:i/><w:iCs/>');
    if (o.caps) pr.push('<w:caps/>');
    if (o.color) pr.push(`<w:color w:val="${esc(o.color)}"/>`);
    if (o.sz) pr.push(`<w:sz w:val="${Math.round(o.sz * 2)}"/><w:szCs w:val="${Math.round(o.sz * 2)}"/>`);
    if (o.u) pr.push('<w:u w:val="single"/>');
    const rpr = pr.length ? `<w:rPr>${pr.join('')}</w:rPr>` : '';
    return String(text == null ? '' : text).split('\n').map((t, i) => `<w:r>${rpr}${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`).join('');
  }
  const tab = () => '<w:r><w:tab/></w:r>';
  // ---- đoạn ----
  // p(runs|chuỗi, {align: left|center|right|both, ind (twip trái), hang (twip treo), first, before, after (pt), line (1.15…), keep, pageBreak, tabs:[pos]})
  function p(content, o = {}) {
    const runs = Array.isArray(content) ? content.join('') : (typeof content === 'string' && content.startsWith('<w:r') ? content : r(content, o.run || {}));
    const pr = [];
    if (o.style) pr.push(`<w:pStyle w:val="${o.style}"/>`);
    if (o.keep) pr.push('<w:keepNext/>');
    if (o.pageBreak) pr.push('<w:pageBreakBefore/>');
    if (o.tabs) pr.push(`<w:tabs>${o.tabs.map(t => `<w:tab w:val="${t.align || 'left'}" w:pos="${t.pos || t}"/>`).join('')}</w:tabs>`);
    pr.push(`<w:spacing w:before="${Math.round((o.before || 0) * 20)}" w:after="${Math.round((o.after == null ? 4 : o.after) * 20)}" w:line="${Math.round((o.line || 1.15) * 240)}" w:lineRule="auto"/>`);
    if (o.ind || o.hang || o.first) pr.push(`<w:ind w:left="${o.ind || 0}"${o.hang ? ` w:hanging="${o.hang}"` : ''}${o.first ? ` w:firstLine="${o.first}"` : ''}/>`);
    if (o.align) pr.push(`<w:jc w:val="${o.align}"/>`);
    return `<w:p><w:pPr>${pr.join('')}</w:pPr>${runs}</w:p>`;
  }
  // gạch đầu dòng / đánh số (chữ thường, không phụ thuộc numbering.xml của mẫu)
  const bullet = (content, o = {}) => p([r((o.mark || '•') + '\t', o.run || {}), Array.isArray(content) ? content.join('') : r(content, o.run || {})], { ind: o.ind || 720, hang: 360, tabs: [o.ind || 720], align: 'both', after: 3, ...o });
  const pageBreak = () => '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

  // ---- bảng ----
  // table(rows, {widths:[twip], border: true|false, header: số dòng đầu in đậm + nền, fill, fontSz, cellAlign:[...] })
  // ô: chuỗi | {t, b, align, span, fill, runs, vAlign}
  function table(rows, o = {}) {
    const widths = o.widths || [];
    const total = widths.reduce((a, b) => a + b, 0) || 9000;
    const bd = o.border === false ? 'none' : 'single';
    const borders = `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(k => `<w:${k} w:val="${bd}" w:sz="4" w:space="0" w:color="000000"/>`).join('')}</w:tblBorders>`;
    const grid = `<w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;
    const body = rows.map((row, ri) => {
      let ci = 0;
      const head = ri < (o.header || 0);
      const cells = row.map((c) => {
        const cell = c && typeof c === 'object' && !Array.isArray(c) ? c : { t: c };
        const span = cell.span || 1;
        const w = widths.slice(ci, ci + span).reduce((a, b) => a + b, 0) || Math.round(total / row.length);
        const al = cell.align || (o.cellAlign && o.cellAlign[ci]) || (head ? 'center' : 'left');
        ci += span;
        const fill = cell.fill || (head ? (o.fill || 'D9E2F3') : '');
        const run = { b: cell.b || head, sz: o.fontSz, i: cell.i };
        const paras = cell.runs ? [p(cell.runs, { align: al, after: 0 })]
          : String(cell.t == null ? '' : cell.t).split('\n\n').map(t => p(r(t, run), { align: al, after: 0 }));
        return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ''}${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ''}<w:vAlign w:val="${cell.vAlign || 'center'}"/></w:tcPr>${paras.join('')}</w:tc>`;
      }).join('');
      const trPr = (o.rowH ? `<w:trHeight w:val="${o.rowH}"/>` : '') + (head ? '<w:tblHeader/>' : '');
      return `<w:tr>${trPr ? `<w:trPr>${trPr}</w:trPr>` : ''}${cells}</w:tr>`;
    }).join('');
    return `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/>${o.center ? '<w:jc w:val="center"/>' : ''}${borders}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>${grid}${body}</w:tbl>${p('', { after: 0 })}`;
  }

  // ---- đóng gói ----
  const NS = 'xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  // Văn bản trắng (hồ sơ pháp lý, biên bản theo thể thức hành chính): A4, Times New Roman 13, lề 2/2/3/1.5 cm, số trang ở chân trang
  async function blankDocx(JSZip, bodyXml, o = {}) {
    const z = new JSZip();
    const font = o.font || 'Times New Roman', sz = Math.round((o.size || 13) * 2);
    const land = !!o.landscape;
    const pg = land ? '<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>' : '<w:pgSz w:w="11906" w:h="16838"/>';
    const mar = o.margins || (land ? [1134, 1134, 1134, 1134] : [1134, 851, 1134, 1701]);   // trên, phải, dưới, trái
    z.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
    z.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
    z.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(o.title || '')}</dc:title><dc:creator>Hồ sơ Dự án</dc:creator></cp:coreProperties>`);
    z.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>');
    z.file('word/settings.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="720"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>');
    z.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${font}" w:cs="${font}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblCellMar><w:left w:w="108" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`);
    z.file('word/footer1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}>${o.pageNumbers === false ? p('') : `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r></w:p>`}</w:ftr>`);
    const sect = `<w:sectPr><w:footerReference w:type="default" r:id="rId3"/>${pg}<w:pgMar w:top="${mar[0]}" w:right="${mar[1]}" w:bottom="${mar[2]}" w:left="${mar[3]}" w:header="567" w:footer="454" w:gutter="0"/><w:cols w:space="720"/></w:sectPr>`;
    z.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${bodyXml}${sect}</w:body></w:document>`);
    return z;
  }
  // Công văn theo khuôn chung: giữ nguyên header (logo) / footer (địa chỉ công ty) / styles của mẫu công văn,
  // thay toàn bộ thân văn bản; giữ sectPr (khổ giấy, lề, tham chiếu header/footer) của mẫu.
  function letterheadDocx(zip, bodyXml) {
    return zip.file('word/document.xml').async('string').then((doc) => {
      const b0 = doc.indexOf('<w:body>') + '<w:body>'.length;
      const s0 = doc.lastIndexOf('<w:sectPr');
      if (b0 < 8 || s0 < 0) throw new Error('Mẫu công văn không đúng định dạng');
      zip.file('word/document.xml', doc.slice(0, b0) + bodyXml + doc.slice(s0));
      // bỏ phần thuộc tính tuỳ chỉnh / glossary không cần (nếu có) — giữ nguyên để Word mở đúng
      return zip;
    });
  }
  // ngày dạng "ngày 05 tháng 09 năm 2026" (iso = YYYY-MM-DD; trống → chấm để điền tay)
  function ngayVN(iso, place) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    const pre = place ? place + ', ' : '';
    return m ? `${pre}ngày ${m[3]} tháng ${m[2]} năm ${m[1]}` : `${pre}ngày …… tháng …… năm ${new Date().getFullYear()}`;
  }
  const dmy = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : '…/…/……'; };
  const api = { esc, r, tab, p, bullet, pageBreak, table, blankDocx, letterheadDocx, ngayVN, dmy, orDots, DOTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DocxKit = api;
})(typeof window !== 'undefined' ? window : globalThis);
