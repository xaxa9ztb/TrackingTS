// Đọc file bảng chấm công Excel (tools/timesheet/tsexcel.js · parseTimesheet) trên worksheet giả lập.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const X = require('../../tools/timesheet/tsexcel.js');

// worksheet giả: cells theo địa chỉ 'E3' hoặc (hàng, cột)
const colLetter = (c) => { let s = ''; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
function sheet(header, rows) {
  const cells = new Map(Object.entries(header));
  rows.forEach((r, i) => Object.entries(r).forEach(([c, v]) => cells.set(colLetter(+c) + (10 + i), v)));
  const cell = (addr) => ({ value: cells.has(addr) ? cells.get(addr) : null });
  return { getCell: (a) => cell(a), getRow: (r) => ({ getCell: (c) => cell(colLetter(c) + r) }), rowCount: 10 + rows.length + 5 };
}
const D = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const T = (h, m) => (h + m / 60) / 24;

test('parseTimesheet: đọc tiêu đề, ngày, giờ (số Excel / Date / chuỗi), nghỉ, dự án, WBS, mã công việc từ dấu x, ghi chú; bỏ dòng Total', () => {
  const s = sheet({ E3: 'Phan Anh Đức', E4: { formula: 'x', result: '562033' }, X4: 'NI Technician', AS4: 'NI', AS3: D(2026, 11, 1) }, [
    { 3: D(2026, 10, 16), 5: T(8, 0), 6: T(17, 0), 7: 8, 8: 1, 18: 'Dự án A', 19: 'W-100', 21: 'x', 51: 'ghi chú' },
    { 3: '17/10/2026', 5: '08:30', 6: new Date(Date.UTC(1899, 11, 30, 19, 0)), 8: 0.5, 9: 2, 18: 'Dự án A', 19: 'W-100', 48: 'X' },
    { 3: null, 6: 'Total:' },
    { 3: 46000.0, 5: T(7, 0), 6: T(12, 0), 18: 'Dự án B', 19: 'W-200', 50: 'x' },
  ]);
  const r = X.parseTimesheet(s);
  assert.deepEqual([r.name, r.empId, r.position, r.dept, r.period], ['Phan Anh Đức', '562033', 'NI Technician', 'NI', '2026-11']);
  assert.equal(r.problems.length, 0);
  assert.equal(r.entries.length, 3);
  const [a, b, c] = r.entries;
  assert.deepEqual([a.date, a.startTime, a.endTime, a.breakTime, a.workNumber, a.projectName, a.remarks, a.activityCode, a.excel.normal], ['2026-10-16', '08:00', '17:00', '1', 'W-100', 'Dự án A', 'ghi chú', '100', 8]);
  assert.deepEqual([b.date, b.startTime, b.endTime, b.breakTime, b.activityCode, b.excel.ot], ['2026-10-17', '08:30', '19:00', '0.5', '6010', { OT1: 2 }]);
  assert.equal(c.date, '2025-12-09'); assert.equal(c.activityCode, '6090'); assert.equal(c.endTime, '12:00');
});

test('parseTimesheet: thiếu mã nhân viên / tháng / dòng → báo vấn đề', () => {
  const r = X.parseTimesheet(sheet({}, []));
  assert.equal(r.problems.length, 3); assert.match(r.problems[0], /mã nhân viên/);
});
