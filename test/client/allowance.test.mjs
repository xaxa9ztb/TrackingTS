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

test('xăng xe: 60.000 đ × số ngày chấm công tại dự án trong khoảng; ngày trùng giữa hai dòng chỉ tính một lần', () => {
  const entries = [...days('2026-10-20', 5).map(d => E(d, 'W1')), E('2026-10-22', 'W2'), E('2026-10-27', 'W2')];
  const c = A.compute(entries, { rows: [R(1, 'fuel', 'W1', '2026-10-16', '2026-10-22'), R(2, 'fuel', 'W2', '2026-10-16', '2026-11-15')] }, RANGE);
  assert.equal(c.ok, true, c.problems.join('; '));
  assert.equal(c.rows[0].days, 3); assert.equal(c.rows[0].amount, 180000);
  assert.equal(c.rows[1].days, 1, 'ngày 22 đã tính ở W1'); assert.equal(c.rows[1].overlap, 1);
  assert.deepEqual(c.totals, { fuelDays: 4, fuelAmount: 240000, provinceAmount: 0, amount: 240000 });
  assert.match(A.summary(c), /Xăng xe 4 ngày = 240\.000 đ — tổng 240\.000 đ/);
});

test('xăng xe: không có ngày chấm công / chưa chọn dự án / ngày ngược → lỗi', () => {
  const c = A.compute([E('2026-10-20', 'W1')], { rows: [R(1, 'fuel', 'W9', '2026-10-16', '2026-10-30'), R(2, 'fuel', '', '2026-10-16', '2026-10-30'), R(3, 'fuel', 'W1', '2026-10-25', '2026-10-20')] }, RANGE);
  assert.equal(c.ok, false);
  assert.match(c.rows[0].problems[0], /Không có ngày chấm công/);
  assert.match(c.rows[1].problems[0], /Chưa chọn dự án/);
  assert.match(c.rows[2].problems[0], /sau ngày kết thúc/);
});

test('xe đi tỉnh: cần trên 20 ngày chấm công + tự mang xe; 1.000.000 đ / tháng; chỉ một dòng; không đồng thời xăng xe cùng dự án', () => {
  const entries = days('2026-10-16', 21).map(d => E(d, 'P1'));
  const ok = A.compute(entries, { rows: [R(1, 'province', 'P1', '2026-10-16', '2026-11-15', { ownVehicle: true })] }, RANGE);
  assert.equal(ok.ok, true, ok.problems.join('; ')); assert.equal(ok.rows[0].days, 21); assert.equal(ok.totals.amount, 1000000);
  const few = A.compute(entries.slice(0, 20), { rows: [R(1, 'province', 'P1', '2026-10-16', '2026-11-15', { ownVehicle: true })] }, RANGE);
  assert.match(few.problems[0], /trên 20 ngày.*đang có 20 ngày/);
  const noCar = A.compute(entries, { rows: [R(1, 'province', 'P1', '2026-10-16', '2026-11-15')] }, RANGE);
  assert.match(noCar.problems[0], /tự mang xe/);
  const two = A.compute(entries, { rows: [R(1, 'province', 'P1', '2026-10-16', '2026-11-15', { ownVehicle: true }), R(2, 'province', 'P1', '2026-10-16', '2026-11-15', { ownVehicle: true })] }, RANGE);
  assert.ok(two.problems.some(p => /chỉ có một phụ cấp xe đi tỉnh/.test(p)));
  const both = A.compute(entries, { rows: [R(1, 'province', 'P1', '2026-10-16', '2026-11-15', { ownVehicle: true }), R(2, 'fuel', 'P1', '2026-10-16', '2026-10-20')] }, RANGE);
  assert.ok(both.problems.some(p => /đã có phụ cấp xăng xe/.test(p)));
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
