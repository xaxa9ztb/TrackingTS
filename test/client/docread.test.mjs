// Hồ sơ Dự án — đọc chữ từ hợp đồng Word / Excel (tools/tiendotm/docread.js). Dữ liệu trong test là dữ liệu GIẢ.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const D = require('../../tools/tiendotm/docread.js');
const XLSX = require('../../js/xlsx.full.min.js');

const W = (body) => `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>${body}<w:sectPr/></w:body></w:document>`;
const P = (...runs) => `<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr>${runs.map(t => t === '\t' ? '<w:r><w:tab/></w:r>' : `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${t}</w:t></w:r>`).join('')}</w:p>`;
const TC = (t) => `<w:tc><w:tcPr/>${P(t)}</w:tc>`;
const TR = (...c) => `<w:tr>${c.map(TC).join('')}</w:tr>`;

test('docxXmlToText: đoạn văn (gộp run, tab, ký tự &), bảng 2 cột thành "Nhãn: Giá trị", bảng nhiều cột nối bằng |', () => {
  const xml = W(P('HỢP ĐỒNG MUA BÁN ', 'THANG MÁY') + P('Số:', '\t', '07/HĐKT-2026') + '<w:p/>' +
    `<w:tbl><w:tblPr/>${TR('Tên dự án', 'Toà nhà Alpha &amp; Beta')}${TR('Địa điểm xây dựng:', 'Quận 1, TP.HCM')}${TR('Loại thang', 'Tải trọng', 'Số điểm dừng')}</w:tbl>` +
    P('Bên Mua: Công ty TNHH Mẫu'));
  const t = D.docxXmlToText(xml);
  assert.equal(t, ['HỢP ĐỒNG MUA BÁN THANG MÁY', 'Số: 07/HĐKT-2026', '', 'Tên dự án: Toà nhà Alpha & Beta', 'Địa điểm xây dựng: Quận 1, TP.HCM', 'Loại thang | Tải trọng | Số điểm dừng', 'Bên Mua: Công ty TNHH Mẫu'].join('\n'));
});

test('docxXmlToText: bảng lồng trong bảng không làm mất chữ phía sau', () => {
  const inner = `<w:tbl>${TR('A1', 'B1')}</w:tbl>`;
  const xml = W(`<w:tbl><w:tr><w:tc>${P('Ngoài')}${inner}</w:tc><w:tc>${P('Phải')}</w:tc></w:tr></w:tbl>` + P('Sau bảng'));
  const t = D.docxXmlToText(xml);
  assert.ok(t.endsWith('Sau bảng'), t); assert.ok(/Ngoài/.test(t) && /Phải/.test(t), t);
});

test('rowsToText (Excel): dòng trống bỏ, ô gộp lặp chữ bỏ trùng, ngày dạng dd/mm/yyyy', () => {
  const t = D.rowsToText([['Số hợp đồng', '19943/SCH-LT'], [], ['', ''], ['Ngày ký', new Date(2026, 10, 5)], ['Thiết bị', 'S3300', 'S3300', '4 điểm dừng']]);
  assert.equal(t, 'Số hợp đồng: 19943/SCH-LT\nNgày ký: 05/11/2026\nThiết bị | S3300 | 4 điểm dừng');
});

test('Excel thật (SheetJS): đọc nhiều sheet giống trình duyệt', () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Tên công trình', 'Chung cư Gamma'], ['Chủ đầu tư', 'Công ty CP Mẫu']]), 'Thông tin');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const rd = XLSX.read(new Uint8Array(buf), { type: 'array' });
  const t = D.rowsToText(XLSX.utils.sheet_to_json(rd.Sheets[rd.SheetNames[0]], { header: 1, raw: false, defval: '' }));
  assert.equal(t, 'Tên công trình: Chung cư Gamma\nChủ đầu tư: Công ty CP Mẫu');
});

test('legacyDocText (.doc cũ): lấy được đoạn chữ UTF-16 tiếng Việt lẫn trong dữ liệu nhị phân', () => {
  const enc = (s) => { const b = new Uint8Array(s.length * 2); for (let i = 0; i < s.length; i++) { b[i * 2] = s.charCodeAt(i) & 255; b[i * 2 + 1] = s.charCodeAt(i) >> 8; } return b; };
  const junk = new Uint8Array(64).map((_, i) => (i * 37 + 200) & 255);
  const parts = [junk, enc('HỢP ĐỒNG MUA BÁN THANG MÁY\rSố: 07/HĐKT-2026\rTên dự án: Toà nhà Delta\r'), junk];
  const all = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; parts.forEach(p => { all.set(p, o); o += p.length; });
  const t = D.legacyDocText(all);
  assert.ok(/HỢP ĐỒNG MUA BÁN THANG MÁY/.test(t) && /Tên dự án: Toà nhà Delta/.test(t), t);
});

test('KIND: nhận đúng loại file', () => {
  assert.deepEqual(['a.DOCX', 'b.doc', 'c.xlsx', 'd.xls', 'e.csv', 'f.pdf', 'g.JPG', 'h.txt'].map(D.KIND), ['docx', 'doc', 'sheet', 'sheet', 'sheet', 'pdf', 'image', '']);
});
