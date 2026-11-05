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

test('dòng cũ (chưa có số ngày) — xăng xe: 60.000 đ × số ngày chấm công tại dự án trong khoảng; ngày trùng giữa hai dòng chỉ tính một lần', () => {
  const entries = [...days('2026-10-20', 5).map(d => E(d, 'W1')), E('2026-10-22', 'W2'), E('2026-10-27', 'W2')];
  const c = A.compute(entries, { rows: [R(1, 'fuel', 'W1', '2026-10-16', '2026-10-22'), R(2, 'fuel', 'W2', '2026-10-16', '2026-11-15')] }, RANGE);
  assert.equal(c.ok, true, c.problems.join('; '));
  assert.equal(c.rows[0].days, 3); assert.equal(c.rows[0].amount, 180000);
  assert.equal(c.rows[1].days, 1, 'ngày 22 đã tính ở W1'); assert.equal(c.rows[1].overlap, 1);
  assert.deepEqual(c.totals, { fuelDays: 4, fuelAmount: 240000, provinceDays: 0, provinceAmount: 0, amount: 240000 });
  assert.match(A.summary(c), /Xăng xe 4 ngày = 240\.000 đ — tổng 240\.000 đ/);
});

test('xăng xe: dòng cũ không có ngày chấm công / chưa nhập dự án / ngày ngược → lỗi', () => {
  const c = A.compute([E('2026-10-20', 'W1')], { rows: [R(1, 'fuel', 'W9', '2026-10-16', '2026-10-30'), R(2, 'fuel', '', '2026-10-16', '2026-10-30'), R(3, 'fuel', 'W1', '2026-10-25', '2026-10-20')] }, RANGE);
  assert.equal(c.ok, false);
  assert.match(c.rows[0].problems[0], /Chưa nhập số ngày/);
  assert.match(c.rows[1].problems[0], /Chưa nhập dự án/);
  assert.match(c.rows[2].problems[0], /sau ngày kết thúc/);
});

test('dòng cũ — xe đi tỉnh: cần trên 20 ngày chấm công + tự mang xe; 1.000.000 đ / tháng; chỉ một dòng; không đồng thời xăng xe cùng dự án', () => {
  const entries = days('2026-10-16', 21).map(d => E(d, 'P1'));
  const ok = A.compute(entries, { rows: [R(1, 'province', 'P1', '2026-10-16', '2026-11-15', { ownVehicle: true })] }, RANGE);
  assert.equal(ok.ok, true, ok.problems.join('; ')); assert.equal(ok.rows[0].days, 21); assert.equal(ok.totals.amount, 1000000);
  const few = A.compute(entries.slice(0, 20), { rows: [R(1, 'province', 'P1', '2026-10-16', '2026-11-15', { ownVehicle: true })] }, RANGE);
  assert.match(few.problems[0], /tổng trên 20 ngày.*đang có 20 ngày/);
  const noCar = A.compute(entries, { rows: [R(1, 'province', 'P1', '2026-10-16', '2026-11-15')] }, RANGE);
  assert.match(noCar.problems[0], /tự mang xe/);
  const both = A.compute(entries, { rows: [R(1, 'province', 'P1', '2026-10-16', '2026-11-15', { ownVehicle: true }), R(2, 'fuel', 'P1', '2026-10-16', '2026-10-20')] }, RANGE);
  assert.ok(both.problems.some(p => /đã có phụ cấp xăng xe/.test(p)));
});

test('độc lập với chấm công: số ngày tự khai, không cần dòng chấm công, khoảng ngày tuỳ ý trong kỳ', () => {
  assert.equal(A.LINK_TIMESHEET, false);
  const c = A.compute([], { rows: [R(1, 'fuel', 'W1', '2026-10-16', '2026-11-15', { days: 25 }), R(2, 'fuel', 'W2', '2026-10-20', '2026-10-25', { days: 3 })] }, RANGE);
  assert.equal(c.ok, true, c.problems.join('; '));
  assert.deepEqual(c.totals, { fuelDays: 28, fuelAmount: 28 * 60000, provinceDays: 0, provinceAmount: 0, amount: 28 * 60000 });
  // có chấm công cũng không ảnh hưởng số ngày khai
  const w = A.compute([E('2026-10-20', 'W1')], { rows: [R(1, 'fuel', 'W1', '2026-10-16', '2026-10-31', { days: 10 })] }, RANGE);
  assert.equal(w.rows[0].days, 10);
  const over = A.compute([], { rows: [R(1, 'fuel', 'W1', '2026-10-20', '2026-10-22', { days: 5 }), R(2, 'fuel', 'W2', '2026-10-20', '2026-10-22', { days: 0 })] }, RANGE);
  assert.match(over.rows[0].problems[0], /nhiều hơn số ngày của khoảng đã chọn \(3\)/);
  assert.match(over.rows[1].problems[0], /Chưa nhập số ngày/);
  const prov = A.compute([], { rows: [R(1, 'province', 'P1', '2026-10-16', '2026-11-15', { days: 22, ownVehicle: true })] }, RANGE);
  assert.equal(prov.ok, true, prov.problems.join('; ')); assert.equal(prov.totals.amount, 1000000);
  const few = A.compute([], { rows: [R(1, 'province', 'P1', '2026-10-16', '2026-11-15', { days: 17, ownVehicle: true })] }, RANGE);
  assert.match(few.problems[0], /tổng trên 20 ngày.*đang có 17 ngày/);
  assert.equal(A.sanitize({ rows: [R(1, 'fuel', 'W1', '2026-10-20', '2026-10-21', { days: 2 })] }, RANGE).rows[0].days, 2);
  assert.equal(A.sanitize({ rows: [R(1, 'fuel', 'W1', '2026-10-20', '2026-10-21')] }, RANGE).rows[0].days, undefined);
  assert.throws(() => A.sanitize({ rows: [R(1, 'fuel', 'W1', '2026-10-20', '2026-10-21', { days: 1.5 })] }, RANGE), /số nguyên/);
  assert.throws(() => A.sanitize({ rows: [R(1, 'fuel', 'W1', '2026-10-20', '2026-10-21', { days: 99 })] }, RANGE), /số nguyên/);
});

test('nhiều giai đoạn / nhiều dự án: xe đi tỉnh cộng ngày các dòng, 1.000.000 đ chia theo ngày; khai trùng ngày bị chặn', () => {
  const rows = [
    R(1, 'province', 'P1', '2026-10-16', '2026-10-31', { days: 14, ownVehicle: true }),
    R(2, 'province', 'P2', '2026-11-01', '2026-11-15', { days: 9, ownVehicle: true }),
    R(3, 'fuel', 'W1', '2026-11-01', '2026-11-15', { days: 4 }),
  ];
  const c = A.compute([], { rows }, RANGE);
  assert.equal(c.ok, true, c.problems.join('; '));
  assert.equal(c.totals.provinceDays, 23); assert.equal(c.totals.provinceAmount, 1000000);
  assert.equal(c.rows[0].amount, 608696); assert.equal(c.rows[1].amount, 391304);
  assert.equal(c.totals.amount, 1000000 + 240000);
  assert.match(A.summary(c), /Xe đi tỉnh 23 ngày = 1\.000\.000 đ/);
  // tổng chưa đủ 21 ngày → 0 đ, cả hai dòng báo
  const few = A.compute([], { rows: [rows[0], { ...rows[1], days: 5 }] }, RANGE);
  assert.equal(few.totals.provinceAmount, 0); assert.equal(few.problems.length, 2);
  assert.match(few.problems[0], /đang có 19 ngày ở 2 dòng/);
  // khai trùng: 2 dòng xăng xe cùng 20–22/10 (3 ngày) mà khai 2 + 2 ngày
  const dup = A.compute([], { rows: [R(1, 'fuel', 'W1', '2026-10-20', '2026-10-22', { days: 2 }), R(2, 'fuel', 'W2', '2026-10-21', '2026-10-22', { days: 2 })] }, RANGE);
  assert.ok(dup.problems.some(p => /trùng khoảng ngày khai tổng 4 ngày, nhiều hơn 3 ngày/.test(p)));
  // cùng dự án vừa xăng xe vừa đi tỉnh chỉ lỗi khi chồng khoảng ngày
  const both = A.compute([], { rows: [R(1, 'province', 'P1', '2026-10-16', '2026-11-10', { days: 22, ownVehicle: true }), R(2, 'fuel', 'P1', '2026-11-11', '2026-11-15', { days: 3 })] }, RANGE);
  assert.equal(both.ok, true, both.problems.join('; '));
  // 8 dòng xe đi tỉnh được; dòng thứ 9 báo
  const nine = A.compute([], { rows: Array.from({ length: 9 }, (_, i) => R(i + 1, 'province', 'P' + i, '2026-10-16', '2026-10-18', { days: 3, ownVehicle: true })) }, RANGE);
  assert.ok(nine.problems.some(p => /Tối đa 8 dòng/.test(p)));
});

test('làm sạch: cắt độ dài, bỏ trùng id, chặn loại / ngày sai và ngày ngoài kỳ', () => {
  assert.equal(A.sanitize(null, RANGE), null);
  const s = A.sanitize({ rows: [R(1, 'fuel', 'W1', '2026-10-20', '2026-10-21', { location: 'x'.repeat(500), ownVehicle: true, extra: 1 }), R(1, 'fuel', 'W2', '2026-10-20', '2026-10-21')], u: 42 }, RANGE);
  assert.equal(s.rows.length, 1); assert.equal(s.rows[0].location.length, 200); assert.equal(s.rows[0].ownVehicle, false); assert.equal(s.rows[0].extra, undefined); assert.equal(s.u, 42);
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
  const c = A.compute(entries, { rows: [R(1, 'fuel', 'W1', '2026-11-01', '2026-11-15', { location: 'Phường 1' }), R(2, 'province', 'P1', '2026-10-16', '2026-11-15', { ownVehicle: true, location: 'Bình Dương' })] }, RANGE);
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
