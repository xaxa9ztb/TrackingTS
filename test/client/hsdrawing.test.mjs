// Hồ sơ Dự án › Bìa & trang ký bản vẽ: đọc khung tên (số bản vẽ, tờ, tên), loại trang, bộ bản vẽ theo thang. Dữ liệu GIẢ.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const H = require('../../tools/tiendotm/hsdrawing.js');
const W = 2384, HH = 1684;
// item kiểu pdf.js đã đổi toạ độ: y = mép trên
const it = (s, x, y, h = 9) => ({ s, x, y, w: s.length * h * 0.5, h });
// khung tên góc phải dưới giống bản vẽ AutoCAD (nhãn song ngữ bị tách thành nhiều mảnh)
const block = (no, sheet, title) => [
  it('Tên dự án / Project name: BIỆT THỰ MẪU', 1805, 1405), it('Bên mua / Client: ÔNG NGUYỄN VĂN A', 1806, 1443),
  it('Tên bản vẽ / Drawing Title:', 1980, 1472), ...title.split('\n').map((t, i) => it(t, 2047, 1490 + i * 11, 10)),
  it('Duyệt', 1981, 1512), it('Hiệu chỉnh', 2310, 1536), it('Revision', 2316, 1549), it('Checked by', 1981, 1564), it('00', 2318, 1566),
  it('Tỉ Lệ / Scale:', 1981, 1622), it('NTS', 2040, 1622), it('Ngày / Date: 16.11.2026', 2100, 1622),
  it('Số bản vẽ / Drawing', 1982, 1646), it('No:', 2075, 1646), it(no, 2095, 1646), it(sheet[0], 2318, 1646), it(sheet[1], 2350, 1646),
  it('Kí hiệu / Abbre.', 20, 20), it('Schindler 3000', 400, 900),
];

test('parseTitleBlock: số bản vẽ (nhãn song ngữ tách mảnh), tờ 02/04, tên 1–2 dòng, revision, tỉ lệ, dự án', () => {
  const r = H.parseTitleBlock(block('VQ22530_SCH_LB_PL1', ['02', '04'], 'MẶT BẰNG XE THANG TẠI\nCÁC TẦNG ĐIỂN HÌNH'), W, HH);
  assert.equal(r.kind, 'drawing');
  assert.equal(r.no, 'VQ22530_SCH_LB_PL1'); assert.equal(r.sheet, '02/04');
  assert.equal(r.title, 'MẶT BẰNG XE THANG TẠI CÁC TẦNG ĐIỂN HÌNH');
  assert.equal(r.rev, '00'); assert.equal(r.scale, 'NTS'); assert.equal(r.project, 'BIỆT THỰ MẪU'); assert.equal(r.line, 'Schindler 3000');
});

test('parseTitleBlock: tên cùng dòng sau dấu ":"; trang danh mục; trang bìa', () => {
  const r = H.parseTitleBlock([it('Drawing title: LAYOUT HỐ THANG', 1900, 1500), it('Drawing No: TM-01', 1900, 1600)], W, HH);
  assert.equal(r.title, 'LAYOUT HỐ THANG'); assert.equal(r.no, 'TM-01');
  assert.equal(H.parseTitleBlock([it('DANH MỤC BẢN VẼ', 1000, 100), it('01/04 THÔNG SỐ KỸ THUẬT', 200, 200)], W, HH).kind, 'index');
  assert.equal(H.parseTitleBlock([it('BẢN VẼ THI CÔNG THANG MÁY', 900, 700, 40), it('BIỆT THỰ MẪU', 900, 760, 30)], W, HH).kind, 'cover');
});

test('liftLabel: ký hiệu thang từ số bản vẽ, nếu không có thì từ tên file', () => {
  assert.equal(H.liftLabel('VQ22530_SCH_LB_PL3'), 'PL3');
  assert.equal(H.liftLabel('', 'BV_ThangTM02_r01.pdf'), 'TM02');
  assert.equal(H.liftLabel('ABC-L2'), 'L2');
});

test('summarizeSet + rowsFromSets: bỏ bìa / danh mục riêng, số hiệu + tờ, khổ A3 khi bật', () => {
  const pg = (kind, no, sheet, title) => ({ w: W, h: HH, info: { kind, no, sheet, title, rev: '00', line: kind === 'index' ? 'Schindler 3000' : '' } });
  const pages = [pg('cover'), pg('index'), pg('drawing', 'X_PL1', '01/02', 'THÔNG SỐ'), pg('drawing', 'X_PL1', '02/02', 'MẶT CẮT')];
  const st = H.summarizeSet('X_PL1_r00.pdf', pages); st.pageInfo = pages;
  assert.deepEqual([st.no, st.label, st.line, st.pages, st.drawings, st.hasIndex, st.kho], ['X_PL1', 'PL1', 'Schindler 3000', 4, 2, true, 'A1']);
  const rows = H.rowsFromSets([st], { a3: true });
  assert.deepEqual(rows.map(r => [r.so, r.ten, r.kho, r.goc]), [['X_PL1 – 01/02', 'THÔNG SỐ', 'A3', 'A1'], ['X_PL1 – 02/02', 'MẶT CẮT', 'A3', 'A1']]);
  // file không đọc được khung tên: mỗi trang 1 dòng, tên theo file
  const st2 = H.summarizeSet('Ban ve thang 2.pdf', [{ w: 842, h: 595, info: { kind: 'other' } }]); st2.pageInfo = [{ w: 842, h: 595, info: { kind: 'other' } }];
  assert.deepEqual(H.rowsFromSets([st2], { prefix: 'TM' }).map(r => [r.so, r.ten, r.kho]), [['TM-01', 'Ban ve thang 2', 'A4']]);
});

let PDFLib = null; try { PDFLib = require('pdf-lib'); } catch (e) { /* CI không cài */ }
test('assemble: đưa trang A1 / A4 dọc về A3 đúng hướng, trang A3 giữ nguyên', { skip: !PDFLib && 'chưa cài pdf-lib' }, async () => {
  const mk = async (sizes) => { const d = await PDFLib.PDFDocument.create(); sizes.forEach(s => d.addPage(s)); return { name: 'x.pdf', bytes: await d.save() }; };
  const cd = await PDFLib.PDFDocument.create(); cd.addPage(H.A3); const cover = await cd.save();
  const out = await H.assemble(PDFLib, cover, [await mk([[2384, 1684], [595, 842], [1190.55, 841.89]])], { a3: true, stats: true });
  const d = await PDFLib.PDFDocument.load(out.bytes);
  assert.deepEqual(d.getPages().map(p => [Math.round(p.getWidth()), Math.round(p.getHeight())]), [[1191, 842], [1191, 842], [842, 1191], [1191, 842]]);
  assert.equal(out.resized, 2);
});
