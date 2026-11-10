// Tab "Dự án theo tháng" (js/projmonth.js): kỳ chấm công 16 → 15, gom giờ theo dự án → người → ngày.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const P = require('../../js/projmonth.js');

test('cycleOf / cycleRange: ngày 16 trở đi thuộc kỳ tháng sau, kể cả qua năm', () => {
  assert.equal(P.cycleOf('2026-10-15'), '2026-10');
  assert.equal(P.cycleOf('2026-10-16'), '2026-11');
  assert.equal(P.cycleOf('2026-12-20'), '2027-01');
  assert.deepEqual(P.cycleRange('2026-01'), { from: '2025-12-16', to: '2026-01-15' });
});

test('aggregate: chỉ dòng trong kỳ, gom theo WBS → nhân sự → ngày; tổng dự án = tổng các người; sắp nhiều giờ trước', () => {
  const rows = [
    { empId: 'E1', empName: 'An', date: '2026-10-16', timeFrom: '08:00', timeTo: '17:00', wbs: 'W1', activities: '1110', normal: 8, ot1: 0, total: 8 },
    { empId: 'E1', empName: 'An', date: '2026-10-17', wbs: 'W1', activities: '1110', normal: 8, ot1: 2, total: 10 },
    { empId: 'E1', empName: 'An', date: '2026-10-17', timeFrom: '18:00', wbs: 'W1', activities: '1110', normal: 0, ot1: 1, total: 1 },
    { empId: 'E2', empName: 'Bình', date: '2026-11-15', wbs: 'W1', normal: 4, total: 4 },
    { empId: 'E2', empName: 'Bình', date: '2026-11-02', wbs: '', projectNameFree: 'Dự án tự gõ', normal: 8 },
    { empId: 'E3', date: '2026-11-16', wbs: 'W1', normal: 8, total: 8 },          // kỳ sau
    { empId: 'E3', date: '2026-10-15', wbs: 'W1', normal: 8, total: 8 },          // kỳ trước
    { empId: 'E3', date: '2026-10-20', wbs: 'W9', normal: 0, total: 0 },          // 0 giờ → bỏ
  ];
  const r = P.aggregate(rows, '2026-11', { projectName: (x) => (x.wbs === 'W1' ? 'Dự án Một' : x.projectNameFree || '') });
  assert.deepEqual([r.from, r.to], ['2026-10-16', '2026-11-15']);
  assert.deepEqual(r.totals, { projects: 2, people: 2, normal: 28, ot: 3, total: 31 });
  const [w1, free] = r.projects;
  assert.deepEqual([w1.wbs, w1.name, w1.total, w1.normal, w1.ot], ['W1', 'Dự án Một', 23, 20, 3]);
  assert.deepEqual([free.wbs, free.name, free.total], ['', 'Dự án tự gõ', 8]);
  assert.deepEqual(w1.people.map(e => [e.empId, e.total, e.days]), [['E1', 19, 2], ['E2', 4, 1]]);
  assert.deepEqual(w1.people[0].rows.map(x => [x.date, x.from, x.total]), [['2026-10-16', '08:00', 8], ['2026-10-17', '', 10], ['2026-10-17', '18:00', 1]]);
  assert.equal(w1.people.reduce((s, e) => s + e.total, 0), w1.total);
});

test('monthsWithData: các kỳ có dữ liệu, mới nhất trước', () => {
  assert.deepEqual(P.monthsWithData([{ date: '2026-10-16' }, { date: '2026-09-01' }, { date: '2026-11-01' }, {}]), ['2026-11', '2026-09']);
});
