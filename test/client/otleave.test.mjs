// Kiểm thử phần dùng chung duyệt tăng ca / đơn nghỉ (tools/timesheet/otleave.js). Chạy: npm run test:client
import { test } from 'node:test';
import assert from 'node:assert/strict';
import OtLeave from '../../tools/timesheet/otleave.js';
import Labor from '../../tools/timesheet/labor.js';

const e = (id, date, start, end, extra = {}) => ({ id, date, startTime: start, endTime: end, breakTime: '1', otMode: 'auto', otType: 'NORMAL', activityCode: '1110', workNumber: 'W-1', projectName: 'A', report: 'r' + id, ...extra });
const bdOf = (x) => x.bd || {};

test('daySig: không phụ thuộc thứ tự dòng; đổi giờ / mã / WBS / cách tính OT thì đổi; đổi báo cáo thi công thì không', () => {
  const a = e(1, '2026-11-02', '08:00', '12:00'), b = e(2, '2026-11-02', '13:00', '19:00', { breakTime: '0' }), c = e(3, '2026-11-03', '08:00', '17:00');
  const s = OtLeave.daySig([a, b, c], '2026-11-02');
  assert.equal(OtLeave.daySig([c, b, a], '2026-11-02'), s);
  assert.notEqual(OtLeave.daySig([a, { ...b, endTime: '20:00' }], '2026-11-02'), s);
  assert.notEqual(OtLeave.daySig([a, { ...b, workNumber: 'W-2' }], '2026-11-02'), s);
  assert.notEqual(OtLeave.daySig([a, { ...b, activityCode: '1120' }], '2026-11-02'), s);
  assert.notEqual(OtLeave.daySig([a, { ...b, otMode: 'manual', otType: 'OT2' }], '2026-11-02'), s);
  assert.equal(OtLeave.daySig([a, { ...b, report: 'khác', remarks: 'x', u: 9 }], '2026-11-02'), s);
  assert.equal(OtLeave.daySig([a, { ...b, workNumber: ' w-1 ' }], '2026-11-02'), s, 'WBS không phân biệt hoa thường / khoảng trắng');
});

test('otDays: cộng giờ OT theo ngày, bỏ ngày không OT và dòng nghỉ; có WBS, chi tiết từng dòng', () => {
  const list = [
    e(1, '2026-11-03', '13:00', '19:00', { breakTime: '0', bd: { NORMAL: 4, OT1: 2 } }),
    e(2, '2026-11-03', '08:00', '12:00', { breakTime: '0', workNumber: 'W-2', bd: { NORMAL: 4 } }),
    e(3, '2026-11-04', '08:00', '17:00', { bd: { NORMAL: 8 } }),
    e(4, '2026-11-08', '08:00', '12:00', { breakTime: '0', bd: { OT2: 4 } }),
    e(5, '2026-11-05', '08:00', '17:00', { activityCode: '6010', bd: { NORMAL: 8, OT1: 1 } }),
  ];
  const d = OtLeave.otDays(list, bdOf);
  assert.deepEqual(d.map(x => [x.date, x.ot, x.total]), [['2026-11-03', 2, 10], ['2026-11-08', 4, 4]]);
  assert.deepEqual(d[0].wbs, ['W-1', 'W-2']);
  assert.deepEqual(d[0].items.map(i => i.start), ['08:00', '13:00'], 'chi tiết theo giờ vào');
  assert.equal(d[0].items[1].report, 'r1');
  assert.equal(d[0].sig, OtLeave.daySig(list, '2026-11-03'));
  assert.deepEqual(OtLeave.otDays([], bdOf), []);
});

test('leaveDays: bỏ ngày nghỉ hằng tuần và ngày lễ; T7 của lịch "T2–T6, sáng T7" là nửa ngày', () => {
  // 2026-11-02 (T2) → 2026-11-08 (CN)
  const a = OtLeave.leaveDays('2026-11-02', '2026-11-08', 'mon-sat-am', Labor);
  assert.deepEqual(a.map(d => d.date), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']);
  assert.equal(a[5].half, true); assert.equal(a[0].half, false);
  assert.equal(OtLeave.dayCount(a), 5.5);
  assert.equal(OtLeave.dayCount(OtLeave.leaveDays('2026-11-02', '2026-11-08', 'mon-fri', Labor)), 5);
  assert.equal(OtLeave.dayCount(OtLeave.leaveDays('2026-11-02', '2026-11-08', 'mon-sat', Labor)), 6);
  // Quốc khánh 2/9/2026 (T4) không tính
  assert.ok(!OtLeave.leaveDays('2026-08-31', '2026-09-04', 'mon-fri', Labor).some(d => d.date === '2026-09-02'));
  assert.deepEqual(OtLeave.leaveDays('2026-11-08', '2026-11-08', 'mon-sat-am', Labor), [], 'chỉ Chủ nhật');
  assert.deepEqual(OtLeave.leaveDays('2026-11-09', '2026-11-02', 'mon-fri', Labor), [], 'ngược ngày');
});

test('leaveEntry: dòng chấm công nghỉ hợp lệ (cả ngày / nửa ngày / không lương)', () => {
  const full = OtLeave.leaveEntry({ date: '2026-11-02', half: false }, '6020', 7, '123', 5);
  assert.deepEqual([full.startTime, full.endTime, full.breakTime, full.activityCode, full.workNumber, full.projectName, full.lv, full.u],
    ['08:00', '17:00', '1', '6020', 'PAID LEAVE', 'Nghỉ ốm', '7', 5]);
  const half = OtLeave.leaveEntry({ date: '2026-11-07', half: true }, '6010', 7, '124', 5);
  assert.deepEqual([half.startTime, half.endTime, half.breakTime], ['08:00', '12:00', '0']);
  const unpaid = OtLeave.leaveEntry({ date: '2026-11-03', half: false }, '6090', 8, '125', 5);
  assert.deepEqual([unpaid.startTime, unpaid.endTime, unpaid.workNumber], ['', '', 'UNPAID LEAVE']);
  assert.equal(OtLeave.addDay('2026-12-31', 1), '2027-01-01');
});
