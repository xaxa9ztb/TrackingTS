// Kiểm thử Khảo sát Bracket hố thang (tools/bracket/bracket.js): đánh giá số đo, đề xuất bracket, kết luận, điền mẫu Excel.
// Quy tắc đã được đối chiếu với công thức của "Phiếu khảo sát trước khi đặt hàng" (LibreOffice tính lại 14.472 ô, 0 khác biệt).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const B = require('../../tools/bracket/bracket.js');
let JSZip = null;
try { JSZip = require('jszip'); } catch (e) { /* CI không cài */ }

const OA = 'O-A1 / O-A2  106-1';

test('danh mục chỉ SC-AP: 29 Z Bracket (J 45350713 Ae25) + 9 Omega loại 106 (J 44928432 Ae29 mục 6)', () => {
  assert.equal(B.Z.length, 29); assert.equal(B.O.length, 9);
  assert.ok(B.O.every(o => / 106-\d$/.test(o.name)), 'Omega SC-AP chỉ có loại 106, không LH / 160 / 190');
  // Ae25: không còn SC-AP ở ES1 / ES5.0
  ['Z-AL2', 'Z-AL3', 'Z-AL7', 'Z-AL9', 'Z-CHL3', 'Z-CHL4', 'Z-CHL7'].forEach(n => assert.equal(B.findZ(n), null, n));
  assert.deepEqual(B.findZ('Z-CL1'), { name: 'Z-CL1', min: 38, max: 82, fam: 'CL' });
  assert.deepEqual([...new Set(B.Z.map(b => b.fam))], ['AL', 'CL', 'CHL', 'CH']);
  assert.deepEqual(B.findZ('Z-AL4'), { name: 'Z-AL4', min: 105, max: 200, fam: 'AL' });
  assert.deepEqual(B.findO('O-B  106-4'), { name: 'O-B  106-4', min: 155, max: 305 });
  assert.equal(B.findO('O-B  190-5'), null);
  B.Z.concat(B.O).forEach(b => assert.ok(b.min < b.max, b.name));
});

test('Z Bracket: đạt / đệm bản mã / đục tỉa / đổi cùng dòng / chỉnh sửa hố thang', () => {
  assert.deepEqual(B.evaluate('z', '', 'Z-AL4'), { text: '', status: '', flag: '' });
  assert.equal(B.evaluate('z', 150, '').text, 'Chưa chọn loại Z Bracket');
  assert.deepEqual(B.evaluate('z', 150, 'Z-AL4'), { text: 'Đạt (trong dung sai Z-AL4)', status: 'ok', flag: 1 });
  assert.equal(B.evaluate('z', 105, 'Z-AL4').status, 'ok', 'biên dưới tính là đạt');
  assert.equal(B.evaluate('z', 208, 'Z-AL4').text, 'Không đạt (lệch 8mm) - Đệm bản mã 10mm - không cần đổi bracket');
  assert.equal(B.evaluate('z', 210, 'Z-AL4').status, 'pad', 'lệch đúng 10mm vẫn đệm');
  assert.equal(B.evaluate('z', 96, 'Z-AL4').text, 'Không đạt (lệch 9mm) - Đục tỉa chân bracket - không cần đổi bracket');
  // lệch > 10mm: đề xuất bracket chứa số đo có dải hẹp nhất, CÙNG DÒNG AL
  const r = B.evaluate('z', 260, 'Z-AL4');
  assert.equal(r.text, 'Không đạt - Đề xuất: Z-AL6'); assert.equal(r.status, 'change');
  assert.equal(B.evaluate('z', 80, 'Z-AL4').text, 'Không đạt - Đề xuất: Z-AL11', 'AL11 (40mm) hẹp hơn AL2 / AL12 / AL3');
  assert.equal(B.evaluate('z', 40, 'Z-CL4').text, 'Không đạt - Đề xuất: Z-CL1', 'dòng CL có CL1 từ 38');
  // ngoài toàn bộ dòng đã đặt
  assert.equal(B.evaluate('z', 40, 'Z-AL4').text, 'KHÔNG PHÙ HỢP - Vượt dung sai toàn bộ dòng AL, cần chỉnh sửa hố thang');
  assert.equal(B.evaluate('z', 600, 'Z-CH4').status, 'pit');
  // dòng CHL chỉ còn Z-CHL2 (52–105): ngoài dải là phải chỉnh sửa hố thang
  assert.equal(B.evaluate('z', 160, 'Z-CHL2').text, 'KHÔNG PHÙ HỢP - Vượt dung sai toàn bộ dòng CHL, cần chỉnh sửa hố thang');
  // phiếu cũ chọn loại đã bỏ khỏi danh mục → coi như chưa chọn
  assert.equal(B.evaluate('z', 150, 'Z-AL3').text, 'Chưa chọn loại Z Bracket');
});

test('Omega: đề xuất trong toàn danh mục; 2 bracket cùng độ rộng chọn đúng bracket chứa số đo (lỗi cũ dòng 27/31)', () => {
  assert.equal(B.evaluate('o', 100, OA).status, 'ok');
  assert.equal(B.evaluate('o', 130, OA).text, 'Không đạt (lệch 7mm) - Đệm bản mã 10mm - không cần đổi bracket');
  assert.equal(B.evaluate('o', 140, OA).text, 'Không đạt - Đề xuất: O-A1 / O-A2  106-2', 'SG=140 → 106-2 (83–143), không nhầm 106-1');
  assert.equal(B.evaluate('o', 55, OA).text, 'Không đạt (lệch 8mm) - Đục tỉa chân bracket - không cần đổi bracket');
  assert.equal(B.evaluate('o', 40, OA).text, 'KHÔNG PHÙ HỢP - Vượt dung sai toàn bộ bracket, cần chỉnh sửa hố thang');
  // danh mục SC-AP chỉ tới 305 mm (O-A2 106-5, O-B 106-4)
  assert.equal(B.evaluate('o', 400, OA).text, 'KHÔNG PHÙ HỢP - Vượt dung sai toàn bộ bracket, cần chỉnh sửa hố thang');
  assert.equal(B.evaluate('o', 290, OA).text, 'Không đạt - Đề xuất: O-A2  106-5');
});

test('kiểm tra bản vẽ + kết luận (giống D58–D67)', () => {
  const s = { zBracket: 'Z-AL4', oBracket: OA, sf2Design: 147, sgDesign: 140, rows: [
    { line: 'T1', sf2: 150, sg: 75 },     // đạt cả hai
    { line: 'T2', sf2: 208, sg: 130 },    // Z đệm, O đệm
    { line: 'T3', sf2: 260, sg: 140 },    // Z đổi, O đổi
    { line: 'T4', sf2: 40, sg: 40 },      // Z hố thang, O hố thang
    { line: 'T5', sf2: '', sg: 100 },     // chỉ có SG
  ] };
  const c = B.compute(s);
  assert.deepEqual(c.design.z, { text: 'Phù hợp với Z-AL4', ok: true });
  assert.deepEqual(c.design.o, { text: 'KHÔNG phù hợp - kiểm tra lại bản vẽ / bracket', ok: false });
  assert.deepEqual(c.summary, { total: 4, pass: 1, zChange: 3, zSite: 1, zSwap: 1, oChange: 3, oSite: 1, oSwap: 1, zPit: 1, oPit: 1 });
  assert.equal(B.compute({ rows: Array.from({ length: 40 }, () => ({ sf2: 1 })) }).rows.length, B.MAX_ROWS);
});

test('ghi ô vào XML của sheet: giữ kiểu, giữ công thức, chuỗi được thoát ký tự', () => {
  const xml = '<row r="5"><c r="C5" s="6" t="s"><v>4</v></c><c r="D5" s="6"/></row><row r="17"><c r="E17" s="10" t="str"><f aca="false">IF(1,"a")</f><v>cũ</v></c><c r="C9" s="8"/></row>';
  let x = B.setCell(xml, 'C5', 'A & <B>');
  assert.match(x, /<c r="C5" s="6" t="inlineStr"><is><t xml:space="preserve">A &amp; &lt;B&gt;<\/t><\/is><\/c>/);
  x = B.setCell(x, 'E17', 'Phù hợp với Z-AL4');
  assert.match(x, /<c r="E17" s="10" t="str"><f aca="false">IF\(1,"a"\)<\/f><v>Phù hợp với Z-AL4<\/v><\/c>/);
  x = B.setCell(x, 'C9', B.excelDate('2026-05-20'));
  assert.match(x, /<c r="C9" s="8" t="n"><v>46162<\/v><\/c>/);
  x = B.setCell(x, 'C5', '');
  assert.match(x, /<c r="C5" s="6"\/>/);
  assert.equal(B.fileName({ project: '523 Minh Khai', liftId: 'PL1' }), 'Khao_sat_bracket_523_Minh_Khai_PL1.xlsx');
});

test('điền mẫu Excel: ô nhập, kết quả lưu sẵn, Excel tự tính lại khi mở; mẫu không chứa dữ liệu dự án', { skip: !JSZip && 'chưa cài jszip' }, async () => {
  const tpl = fs.readFileSync(new URL('../../tools/bracket/bracket-template.xlsx', import.meta.url));
  const clean = await JSZip.loadAsync(tpl);
  const ss = await clean.file('xl/sharedStrings.xml').async('string');
  assert.doesNotMatch(ss, /Minh Khai|Sửu/);
  const out = await B.fillXlsx(JSZip, tpl, { project: 'Dự án thử', date: '2026-11-06', bs: 1750, zBracket: 'Z-AL4', oBracket: OA, sf2Design: 147, sgDesign: 74,
    rows: [{ line: 'Sàn T1', sf2: 150, sg: 75 }, { line: 'Sàn T2', sf2: 260, sg: 140 }] });
  const z = await JSZip.loadAsync(out);
  const sh = await z.file('xl/worksheets/sheet1.xml').async('string');
  assert.match(sh, /<c r="C5"[^>]*t="inlineStr"><is><t xml:space="preserve">Dự án thử<\/t>/);
  assert.match(sh, /<c r="C19"[^>]*><is><t xml:space="preserve">Z-AL4<\/t>/);
  assert.match(sh, /<c r="D27"[^>]*><f[^>]*>[\s\S]*?<\/f><v>Không đạt - Đề xuất: Z-AL6<\/v>/);
  assert.match(sh, /<c r="D58"[^>]*><f[^>]*>COUNTA\(\$C\$26:\$C\$55\)<\/f><v>2<\/v>/);
  assert.match(sh, /<conditionalFormatting sqref="D25:D55">/, 'giữ định dạng có điều kiện');
  assert.match(sh, /<dataValidations count="2">/, 'giữ danh sách chọn bracket');
  assert.match(await z.file('xl/workbook.xml').async('string'), /<calcPr[^>]*fullCalcOnLoad="1"/);
});

test('báo cáo PDF: kết luận chung, ô số, biểu đồ, việc cần làm, ký tên', () => {
  const R = require('../../tools/bracket/report.js');
  const base = { project: 'Dự án <thử>', liftId: 'L1', date: '2026-11-09', surveyor: 'Người A', zBracket: 'Z-AL4', oBracket: OA, sf2Design: 147, sgDesign: 74 };
  assert.equal(R.verdict(B.compute({ ...base, rows: [] })).level, 'none');
  assert.equal(R.verdict(B.compute({ ...base, rows: [{ sf2: 150, sg: 75 }] })).level, 'ok');
  assert.equal(R.verdict(B.compute({ ...base, rows: [{ sf2: 208, sg: 75 }] })).level, 'site');
  assert.equal(R.verdict(B.compute({ ...base, rows: [{ sf2: 260, sg: 75 }] })).title, 'Cần đổi loại bracket');
  assert.equal(R.verdict(B.compute({ ...base, rows: [{ sf2: 40, sg: 75 }] })).title, 'Cần chỉnh sửa hố thang');
  const h = R.html({ ...base, rows: [{ line: 'Sàn T1', sf2: 150, sg: 75 }, { line: 'Sàn T2', sf2: 208, sg: 140 }, { line: 'Sàn T9', sf2: 470, sg: 330 }] }, { now: '2026-11-09T10:00:00' });
  assert.match(h, /Dự án &lt;thử&gt;/, 'chữ người dùng được thoát ký tự');
  assert.match(h, /rp-verdict bad/);
  assert.equal((h.match(/<svg /g) || []).length, 2, 'hai biểu đồ SF2 / SG');
  assert.match(h, /→ 470/, 'số đo ngoài trục vẽ ở mép kèm giá trị');
  assert.match(h, /Đệm bản mã 10 mm[\s\S]*Sàn T2/);
  assert.match(h, /Đổi loại bracket[\s\S]*O-A1 \/ O-A2 106-2/);
  assert.match(h, /Người khảo sát[\s\S]*Giám sát[\s\S]*Quản lý dự án/);
  assert.equal(R.fileName(base), 'Khao_sat_bracket_Du_an_thu_L1');
});
