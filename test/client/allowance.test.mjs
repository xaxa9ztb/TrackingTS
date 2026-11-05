// Kiểm thử phụ cấp xe của Timesheet cá nhân (tools/timesheet/allowance.js): tính ngày / tiền, lỗi, làm sạch, điền mẫu Excel.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const A = require('../../tools/timesheet/allowance.js');

const RANGE = { start: '2026-10-16', end: '2026-11-15' };
const E = (date, wbs, extra = {}) => ({ id: Math.floor(Math.random() * 1e12), date, workNumber: wbs, projectName: 'Dự án ' + wbs, activityCode: '1110', ...extra });
const days = (from, n) => Array.from({ length: n }, (_, i) => { const d = new Date(from + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); });
const R = (id, type, wbs, from, to, extra = {}) => ({ id: String(id), type, wbs, project: 'Dự án ' + wbs, from, to, location: '', remarks: '', ownVehicle: false, ...extra });

test('dự án trong kỳ: gom theo WBS, bỏ ngày nghỉ phép, nhiều ngày nhất trước', () => {
  const entries = [E('2026-10-20', 'W1'), E('2026-10-20', 'w1 '), E('2026-10-21', 'W1'), E('2026-10-22', 'W2'), E('2026-10-23', 'W2', { activityCode: '6010' }), E('2026-09-01', 'W3')];
  const p = A.projectsOf(entries, RANGE.start, RANGE.end);
  assert.deepEqual(p.map(x => [x.wbs, x.days, x.first, x.last]), [['W1', 2, '2026-10-20', '2026-10-21'], ['W2', 1, '2026-10-22', '2026-10-22']]);
  assert.equal(p[0].project, 'Dự án W1');
});

test('số ngày tự tính = đến ngày − từ ngày + 1; không cần chấm công', () => {
  assert.equal(A.LINK_TIMESHEET, false);
  const c = A.compute([], { rows: [R(1, 'fuel', 'W1', '2026-10-16', '2026-10-25', { days: 3 }), R(2, 'fuel', 'W2', '2026-10-26', '2026-10-31')] }, RANGE);
  assert.equal(c.ok, true, c.problems.join('; '));
  assert.deepEqual(c.rows.map(x => x.days), [10, 6], 'số ngày khai tay bị bỏ qua');
  assert.deepEqual(c.totals, { fuelDays: 16, fuelAmount: 960000, provinceDays: 0, provinceAmount: 0, amount: 960000 });
  assert.match(A.summary(c), /Xăng xe 16 ngày = 960\.000 đ — tổng 960\.000 đ/);
  // có chấm công cũng không ảnh hưởng
  assert.equal(A.compute([E('2026-10-20', 'W1')], { rows: [R(1, 'fuel', 'W1', '2026-10-16', '2026-10-31')] }, RANGE).rows[0].days, 16);
  assert.equal(A.spanDays('2026-10-31', '2026-11-02'), 3);
});

test('lỗi: chưa nhập dự án, ngày ngược, ngoài kỳ', () => {
  const c = A.compute([], { rows: [R(1, 'fuel', '', '2026-10-16', '2026-10-17'), R(2, 'fuel', 'W1', '2026-10-25', '2026-10-20'), R(3, 'fuel', 'W2', '2026-11-19', '2026-11-27')] }, RANGE);
  assert.match(c.rows[0].problems[0], /Chưa nhập dự án/);
  assert.match(c.rows[1].problems[0], /sau ngày kết thúc/);
  assert.match(c.rows[2].problems[0], /Ngoài kỳ lương/);
});

test('không trùng ngày giữa các dòng (kể cả khác loại); báo ở dòng sau', () => {
  const c = A.compute([], { rows: [R(1, 'fuel', 'W1', '2026-10-16', '2026-10-25'), R(2, 'fuel', 'W2', '2026-10-25', '2026-10-30'), R(3, 'province', 'P1', '2026-10-28', '2026-11-15', { ownVehicle: true })] }, RANGE);
  assert.equal(c.rows[0].problems.length, 0);
  assert.match(c.rows[1].problems[0], /Trùng ngày với dòng Xăng xe W1 \(16\/10–25\/10\)/);
  assert.ok(c.rows[2].problems.some(p => /Trùng ngày với dòng Xăng xe W2/.test(p)));
  // nối tiếp nhau thì hợp lệ
  const ok = A.compute([], { rows: [R(1, 'fuel', 'W1', '2026-10-16', '2026-10-25'), R(2, 'fuel', 'W2', '2026-10-26', '2026-10-30')] }, RANGE);
  assert.equal(ok.ok, true, ok.problems.join('; '));
});

test('xe đi tỉnh: nhiều giai đoạn cộng ngày, tổng trên 20 → 1.000.000 đ chia theo ngày; thiếu xe / chưa đủ ngày → lỗi', () => {
  const rows = [
    R(1, 'province', 'P1', '2026-10-16', '2026-10-29', { ownVehicle: true }),   // 14 ngày
    R(2, 'province', 'P2', '2026-10-30', '2026-11-07', { ownVehicle: true }),   // 9 ngày
    R(3, 'fuel', 'W1', '2026-11-08', '2026-11-11'),                              // 4 ngày
  ];
  const c = A.compute([], { rows }, RANGE);
  assert.equal(c.ok, true, c.problems.join('; '));
  assert.equal(c.totals.provinceDays, 23); assert.equal(c.totals.provinceAmount, 1000000);
  assert.equal(c.rows[0].amount, 608696); assert.equal(c.rows[1].amount, 391304);
  assert.equal(c.totals.amount, 1000000 + 240000);
  assert.match(A.summary(c), /Xe đi tỉnh 23 ngày = 1\.000\.000 đ/);
  const few = A.compute([], { rows: [rows[0], { ...rows[1], to: '2026-11-03' }] }, RANGE);    // 14 + 5
  assert.equal(few.totals.provinceAmount, 0); assert.equal(few.problems.length, 2);
  assert.match(few.problems[0], /tổng trên 20 ngày.*đang có 19 ngày ở 2 dòng/);
  const noCar = A.compute([], { rows: [R(1, 'province', 'P1', '2026-10-16', '2026-11-15')] }, RANGE);
  assert.ok(noCar.problems.some(p => /tự mang xe/.test(p)));
  const nine = A.compute([], { rows: Array.from({ length: 9 }, (_, i) => { const d = String(16 + i * 2); return R(i + 1, 'province', 'P' + i, `2026-10-${d}`, `2026-10-${String(17 + i * 2)}`, { ownVehicle: true }); }) }, RANGE);
  assert.ok(nine.problems.some(p => /Tối đa 8 dòng/.test(p)));
});

test('làm sạch: cắt độ dài, bỏ trùng id, chặn loại / ngày sai và ngày ngoài kỳ', () => {
  assert.equal(A.sanitize(null, RANGE), null);
  const s = A.sanitize({ rows: [R(1, 'fuel', 'W1', '2026-10-20', '2026-10-21', { location: 'x'.repeat(500), ownVehicle: true, extra: 1, days: 9 }), R(1, 'fuel', 'W2', '2026-10-20', '2026-10-21')], u: 42 }, RANGE);
  assert.equal(s.rows.length, 1); assert.equal(s.rows[0].days, 2, 'số ngày lưu = khoảng ngày'); assert.equal(s.rows[0].location.length, 200); assert.equal(s.rows[0].ownVehicle, false); assert.equal(s.rows[0].extra, undefined); assert.equal(s.u, 42);
  assert.throws(() => A.sanitize({ rows: [R(1, 'taxi', 'W1', '2026-10-20', '2026-10-21')] }, RANGE), /Loại phụ cấp/);
  assert.throws(() => A.sanitize({ rows: [R(1, 'fuel', 'W1', '2026-10-20', '20/10')] }, RANGE), /Ngày/);
  assert.throws(() => A.sanitize({ rows: [R(1, 'fuel', 'W1', '2026-10-01', '2026-10-21')] }, RANGE), /kỳ lương/);
  assert.throws(() => A.sanitize({ rows: [{ ...R(1, 'fuel', 'W1', '2026-10-20', '2026-10-21'), id: 'x' }] }, RANGE), /mã/);
  assert.throws(() => A.sanitize([], RANGE), /không hợp lệ/);
});

test('tên file Excel không dấu', () => {
  assert.equal(A.fileName('Nguyễn Văn Đức', '2026-11'), 'Phu_cap_xe_Nguyen_Van_Duc_Thang_11_2026.xlsx');
});

// ExcelJS chỉ có ở máy đã cài (CI không cài) → bỏ qua nếu thiếu
let ExcelJS = null;
try { ExcelJS = require('exceljs'); } catch (e) { /* không có */ }
test('điền mẫu "Bảng phụ cấp xe": 2 sheet, công thức tổng, người nhận', { skip: !ExcelJS && 'chưa cài exceljs' }, async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(fs.readFileSync(new URL('../../tools/timesheet/phucap-xe-template.xlsx', import.meta.url)));
  const entries = [...days('2026-10-16', 21).map(d => E(d, 'P1')), E('2026-11-10', 'W1'), E('2026-11-11', 'W1')];
  const c = A.compute(entries, { rows: [R(1, 'fuel', 'W1', '2026-11-14', '2026-11-15', { location: 'Phường 1' }), R(2, 'province', 'P1', '2026-10-16', '2026-11-13', { ownVehicle: true, location: 'Bình Dương' })] }, RANGE);
  assert.equal(c.ok, true, c.problems.join('; '));
  A.fillWorkbook(wb, { name: 'Nguyễn Văn A', empId: 'D101', computed: c, date: '2026-11-12' });
  const s1 = wb.getWorksheet('Xăng xe 60K'), s2 = wb.getWorksheet('Phụ cấp Xe đi tỉnh');
  assert.equal(s1.getCell('C8').value, 'W1'); assert.equal(s1.getCell('G8').value, 2); assert.equal(s1.getCell('H8').value.result, 120000);
  assert.equal(s1.getCell('C9').value, null, 'dòng mẫu đã xoá');
  assert.equal(s1.getCell('H19').value.result, 120000);
  assert.equal(s2.getCell('C10').value, 'P1'); assert.equal(s2.getCell('F10').value, 1000000); assert.equal(s2.getCell('F6').value, '12/11/2026');
  assert.match(s1.getCell('A21').value, /Nguyễn Văn A/);
  const buf = await wb.xlsx.writeBuffer();
  assert.ok(buf.byteLength > 5000);
});

test('tên file đính kèm: Pc Xang / Pc Xe - TÊN KHÔNG DẤU IN HOA - thang M YYYY; mỗi loại một sheet', () => {
  assert.equal(A.fileNameByType('Phan Anh Đức', '2026-10', 'fuel'), 'Pc Xang - PHAN ANH DUC - thang 10 2026.xlsx');
  assert.equal(A.fileNameByType('Phan Anh Đức', '2027-03', 'province'), 'Pc Xe - PHAN ANH DUC - thang 3 2027.xlsx');
  const sheets = ['Xăng xe 60K', 'Phụ cấp Xe đi tỉnh'].map((name, i) => ({ id: i + 1, name }));
  const wb = { worksheets: sheets.slice(), getWorksheet: (n) => wb.worksheets.find(w => w.name === n), removeWorksheet: (id) => { wb.worksheets = wb.worksheets.filter(w => w.id !== id); } };
  A.keepSheet(wb, 'province'); assert.deepEqual(wb.worksheets.map(w => w.name), ['Phụ cấp Xe đi tỉnh']);
});
