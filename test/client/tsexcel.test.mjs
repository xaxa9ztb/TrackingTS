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

// Mẫu bảng công 2026: thêm cột P "Số giờ trực Standby" → Check Q, Activities R, Project S, Work Number T, mã công việc V..BA (5090 trước 5060,
// thêm AZ/BA = 1192-0/1192-1), Remarks BB, tháng ở AT3. Đọc theo tiêu đề dòng 8 (+ mã ở dòng 9), không theo vị trí cố định.
function sheet2026(header, rows) {
  const H = { C8: 'Date / Ngày', E8: 'From', F8: 'To', G8: 'Normal Hour (Giờ làm việc bình thường)', H8: 'Breaktime \n(Nghỉ giũa giờ)', I8: 'OT1 - Normal Day', J8: 'OT2 - Sunday',
    P8: 'Số giờ trực Standby', Q8: 'Check\n(Luôn bằng 0)', R8: 'Activities', S8: 'Project Name / Description', T8: 'Work Number\nNI/MOD: PE1 sales order', U8: 'NI\nMOD\nHR', BB8: 'Remarks' };
  const codes = { 22: '100', 23: '1193', 24: '1110', 25: '1731', 26: '1194', 27: '1720', 28: '1900', 29: '1191', 30: '1192- 0', 31: '1192- 1', 32: '1393', 33: '1394', 34: '1310', 35: '1392-0',
    36: '1400', 37: '1500', 38: '1600', 39: '1710', 40: '1715', 41: '1725', 42: '1700', 43: '5010', 44: '5021', 45: '5022', 46: '5040', 47: '5090/ ES1', 48: '5060', 49: '6010/1 Holiday', 50: '6020', 51: '6090', 52: '1192-0', 53: '1192-1' };
  Object.entries(codes).forEach(([c, t]) => { H[colLetter(+c) + '8'] = t + ' mô tả'; H[colLetter(+c) + '9'] = { formula: 'LEFT()', result: t.slice(0, 4) }; });
  return sheet({ ...H, ...header }, rows);
}

test('parseTimesheet mẫu 2026: dự án ở S, WBS ở T, giờ trực ở P, mã từ dấu x (5090 cột AU, 5060 cột AV), ghi chú BB, tháng AT3, phòng ban AT4', () => {
  const s = sheet2026({ E3: 'Phạm Văn K', E4: '547000', W4: 'Position :', X4: 'NI Technician', AS3: ':', AT3: D(2026, 11, 1), AS4: ':', AT4: 'NI HCM', AR3: 'MONTH', AR4: 'Dept.' }, [
    { 3: D(2026, 10, 16), 5: T(8, 0), 6: T(17, 0), 7: 8, 8: 1, 17: 0, 18: '1110', 19: 'NR Chú Châm', 20: '11863740', 21: 'NI', 24: 'x', 54: 'Chấm bù' },
    { 3: D(2026, 10, 18), 5: T(8, 0), 6: T(20, 0), 8: 1, 9: 3, 16: 2, 18: '5090', 19: 'Dự án B', 20: 'W-2', 47: 'x' },
    { 3: D(2026, 10, 19), 5: T(8, 0), 6: T(17, 0), 7: 8, 8: 1, 19: 'Dự án C', 20: 'W-3', 48: 'x' },
    { 3: D(2026, 10, 20), 5: T(8, 0), 6: T(17, 0), 7: 8, 8: 1, 19: 'Dự án C', 20: 'W-3', 52: 'x' },
    { 3: D(2026, 10, 27), 5: T(8, 0), 6: T(17, 0), 7: 8, 8: 1, 19: 'Nghỉ phép', 20: 'PAID LEAVE', 49: 'x' },
    { 6: 'Total:', 7: 32 },
  ]);
  const r = X.parseTimesheet(s);
  assert.equal(r.layout, '2026');
  assert.deepEqual([r.empId, r.position, r.dept, r.period, r.problems], ['547000', 'NI Technician', 'NI HCM', '2026-11', []]);
  assert.deepEqual(r.entries.map(e => [e.projectName, e.workNumber, e.activityCode]),
    [['NR Chú Châm', '11863740', '1110'], ['Dự án B', 'W-2', '5090'], ['Dự án C', 'W-3', '5060'], ['Dự án C', 'W-3', '1192-0'], ['Nghỉ phép', 'PAID LEAVE', '6010']]);
  assert.equal(r.entries[0].remarks, 'Chấm bù');
  assert.equal(r.entries[1].dutyHour, '2'); assert.deepEqual(r.entries[1].excel.ot, { OT1: 3 });
  assert.equal(r.entries[0].dutyHour, undefined);
});

test('ACT_COL theo mẫu 2026 + codeOf', () => {
  assert.deepEqual(['100', '1110', '5090', '5060', '6010', '6090', '1192-0'].map(c => X.activityToCol(c)), [22, 24, 47, 48, 49, 51, 30]);
  assert.equal(X.activityToCol('1192'), 30);
  assert.deepEqual(['6010/1 Holiday', '1192- 1', '5090/ ES1', 'Remarks', '1392'].map(X.codeOf), ['6010', '1192-1', '5090', '', '1392-0']);
});

let ExcelJS; try { ExcelJS = require('exceljs'); } catch (e) { /* không có */ }
test('buildTimesheet → parseTimesheet (mẫu ts-template.xlsx 2026): đúng ô, công thức Check, chữ ký dưới dòng Total', { skip: !ExcelJS && 'chưa cài exceljs' }, async () => {
  const fs = require('node:fs');
  const entries = [
    { date: '2026-10-16', startTime: '08:00', endTime: '17:00', breakTime: '1', activityCode: '1110', projectName: 'Dự án A', workNumber: 'W-1', remarks: 'ghi chú', otType: 'NORMAL' },
    { date: '2026-10-18', startTime: '08:00', endTime: '20:00', breakTime: '1', activityCode: '5090', projectName: 'Dự án B', workNumber: 'W-2', remarks: '', otType: 'OT1', dutyHour: '2' },
  ];
  const f = await X.buildTimesheet(ExcelJS, fs.readFileSync('tools/timesheet/ts-template.xlsx'), { entries, bdOf: () => ({}), profile: { name: 'Nguyễn Văn A', empId: '500001', position: 'NI Technician', dept: 'NI HCM' }, month: '2026-11' });
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(f.buffer);
  const ws = wb.getWorksheet('New TS');
  assert.equal(ws.getCell('S10').value, 'Dự án A'); assert.equal(ws.getCell('T10').value, 'W-1'); assert.equal(ws.getCell('X10').value, 'x'); assert.equal(ws.getCell('BB10').value, 'ghi chú');
  assert.equal(ws.getCell('AU11').value, 'x'); assert.equal(ws.getCell('P11').value, 2);
  assert.equal(ws.getCell('Q10').value.formula, 'MOD(F10-E10,1)*24-SUM(G10:O10)');
  assert.equal(ws.getCell('F12').value, 'Total:');
  assert.ok(ws.getCell('AT3').value);
  const r = X.parseTimesheet(ws);
  assert.equal(r.layout, '2026');
  assert.deepEqual([r.name, r.empId, r.dept, r.period], ['Nguyễn Văn A', '500001', 'NI HCM', '2026-11']);
  assert.deepEqual(r.entries.map(e => [e.date, e.projectName, e.workNumber, e.activityCode, e.remarks, e.dutyHour]),
    [['2026-10-16', 'Dự án A', 'W-1', '1110', 'ghi chú', undefined], ['2026-10-18', 'Dự án B', 'W-2', '5090', '', '2']]);
});

test('buildTimesheet từ chối mẫu không đúng bố cục 2026 (tránh xuất lệch cột khi trình duyệt còn giữ mẫu cũ)', { skip: !ExcelJS && 'chưa cài exceljs' }, async () => {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('New TS');
  ws.getCell('C8').value = 'Date'; ws.getCell('P8').value = 'Check'; ws.getCell('R8').value = 'Project Name';
  const buf = await wb.xlsx.writeBuffer();
  await assert.rejects(() => X.buildTimesheet(ExcelJS, buf, { entries: [], bdOf: () => ({}), profile: {}, month: '2026-11' }), /mẫu Schindler 2026/);
  assert.match(X.TEMPLATE, /^ts-template\.xlsx\?v=/);
});

test('cột T (Work Number): mã toàn chữ số ghi dạng số, mã chữ (TRAINING-NI, PAID LEAVE) giữ dạng chữ; đọc lại vẫn là chuỗi', { skip: !ExcelJS && 'chưa cài exceljs' }, async () => {
  const fs = require('node:fs');
  const mk = (date, wn) => ({ date, startTime: '08:00', endTime: '17:00', breakTime: '1', activityCode: '1110', projectName: 'P', workNumber: wn, remarks: '', otType: 'NORMAL' });
  const f = await X.buildTimesheet(ExcelJS, fs.readFileSync('tools/timesheet/ts-template.xlsx'), { entries: [mk('2026-10-16', '812441010'), mk('2026-10-17', 'TRAINING-NI'), mk('2026-10-18', 'PAID LEAVE'), mk('2026-10-19', '0123')],
    bdOf: () => ({}), profile: { name: 'A', empId: '1', position: 'x', dept: 'NI' }, month: '2026-11' });
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(f.buffer); const ws = wb.getWorksheet('New TS');
  assert.equal(ws.getCell('T10').value, 812441010); assert.equal(ws.getCell('T10').numFmt, '0');
  assert.equal(ws.getCell('T11').value, 'TRAINING-NI'); assert.equal(ws.getCell('T12').value, 'PAID LEAVE');
  assert.equal(ws.getCell('T13').value, '0123');          // số 0 đầu → giữ chữ để không mất số 0
  assert.deepEqual(X.parseTimesheet(ws).entries.map(e => e.workNumber), ['812441010', 'TRAINING-NI', 'PAID LEAVE', '0123']);
});
