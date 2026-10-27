// Kiểm thử so sánh kế hoạch điều phối với chấm công thực tế (tools/projectplan/actual.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const A = require('../../tools/projectplan/actual.js');

const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'];   // T2..CN
const offDay = (d) => d === '2026-10-11';
const data = {
  projects: [{ id: 'pA', name: 'Dự án A', wbs: 'W-A', supervisor: 'Bình' }, { id: 'pB', name: 'Dự án B', wbs: 'W-B', supervisor: 'Cường' }, { id: 'pC', name: 'Dự án C', wbs: '', supervisor: 'Bình' }],
  fitters: [{ id: 'f1', name: 'An', empId: 'E1' }, { id: 'f2', name: 'Bảo', empId: '' }],
  alloc: {
    f1: { '2026-10-05': { p: 'pA' }, '2026-10-06': { p: 'pA' }, '2026-10-07': { p: 'pA' }, '2026-10-08': { p: 'pB' }, '2026-10-09': { p: 'pB', t: true }, '2026-10-10': { p: 'pC' } },
    f2: { '2026-10-05': { p: 'pA' } },
  },
};
const rows = [
  { empId: 'e1', date: '2026-10-05', wbs: 'w-a', normal: 8, total: 8 },                      // đúng kế hoạch (không phân biệt hoa thường)
  { empId: 'E1', date: '2026-10-06', wbs: 'W-B', normal: 8, total: 8 },                      // làm dự án khác
  // 2026-10-07: kế hoạch A nhưng không chấm công
  { empId: 'E1', date: '2026-10-08', wbs: 'W-B', normal: 6, ot1: 2 },                        // đúng (tổng tính từ các cột)
  { empId: 'E1', date: '2026-10-09', wbs: 'W-A', normal: 8, total: 8 },                      // kế hoạch dự kiến → không tính %, nhưng có chấm công
  { empId: 'E1', date: '2026-10-10', wbs: 'W-C', normal: 8, total: 8 },                      // dự án chưa có WBS
  { empId: 'E1', date: '2026-10-11', wbs: 'W-A', normal: 8, total: 8 },                      // Chủ nhật có làm, không có kế hoạch → không tính "ngoài kế hoạch"
  { empId: 'E1', date: '2026-09-30', wbs: 'W-A', normal: 8, total: 8 },                      // ngoài khoảng
];

test('hoursByDay: gộp theo nhân viên + ngày + WBS, bỏ dòng ngoài khoảng và dòng 0 giờ', () => {
  const h = A.hoursByDay([...rows, { empId: 'E9', date: '2026-10-05', wbs: 'W-A', normal: 0 }], days[0], days[6]);
  assert.equal(h['E1|2026-10-08'].total, 8);
  assert.equal(h['E1|2026-10-05'].byWbs['W-A'], 8);
  assert.equal(h['E1|2026-09-30'], undefined);
  assert.equal(h['E9|2026-10-05'], undefined);
});

test('compare: đúng / khác dự án / vắng / dự kiến / chưa có WBS', () => {
  const r = A.compare({ data, hours: A.hoursByDay(rows, days[0], days[6]), days, offDay });
  const f1 = r.fitters[0];
  assert.deepEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'].map(d => f1.days[d].st),
    ['ok', 'diff', 'miss', 'ok', 'tent', 'nolink']);
  assert.equal(f1.ok, 2); assert.equal(f1.diff, 1); assert.equal(f1.miss, 1);
  assert.equal(f1.pct, 50);
  assert.equal(f1.extra, 0, 'Chủ nhật làm bù không bị coi là ngoài kế hoạch');
});

test('compare: fitter chưa liên kết mã NV không bị tính % (không có dữ liệu để đối chiếu)', () => {
  const r = A.compare({ data, hours: A.hoursByDay(rows, days[0], days[6]), days, offDay });
  const f2 = r.fitters[1];
  assert.equal(f2.linked, false); assert.equal(f2.pct, null); assert.equal(f2.ok + f2.diff + f2.miss, 0);
});

test('compare: tổng, theo dự án, theo giám sát', () => {
  const r = A.compare({ data, hours: A.hoursByDay(rows, days[0], days[6]), days, offDay });
  assert.equal(r.totals.n, 4); assert.equal(r.totals.pct, 50);
  const sup = Object.fromEntries(r.bySupervisor.map(s => [s.label, s]));
  assert.equal(sup['Bình'].n, 3, 'Bình giám sát A: ok, diff, miss (dự án C chưa WBS không tính)');
  assert.equal(sup['Bình'].pct, 33.3);
  assert.equal(sup['Cường'].pct, 100);
  assert.equal(r.byProject.find(p => p.label === 'Dự án A').miss, 1);
  assert.equal(r.totals.util, Math.round((8 + 0 + 0 + 8) / (8 * 4) * 1000) / 10);
});

test('compare: làm ngoài kế hoạch ngày thường được ghi nhận', () => {
  const d2 = { ...data, alloc: { f1: {} }, fitters: [data.fitters[0]] };
  const r = A.compare({ data: d2, hours: A.hoursByDay(rows, days[0], days[6]), days, offDay });
  assert.equal(r.fitters[0].extra, 5);
  assert.equal(r.totals.pct, null);
});

test('actualRuns: gộp các ngày liền nhau cùng dự án thành một đoạn', () => {
  const r = A.compare({ data, hours: A.hoursByDay(rows, days[0], days[6]), days, offDay });
  const wmap = { 'W-A': { id: 'pA', name: 'A', color: '#f00' }, 'W-B': { id: 'pB', name: 'B', color: '#0f0' } };
  const runs = A.actualRuns(r.fitters[0], days, wmap);
  assert.deepEqual(runs.map(x => [x.key, x.startIdx, x.endIdx]),
    [['pA', 0, 0], ['pB', 1, 1], ['pB', 3, 3], ['pA', 4, 4], ['wbs:W-C', 5, 5], ['pA', 6, 6]]);
  const merged = A.actualRuns({ days: { a: { act: { total: 8, byWbs: { 'W-A': 8 } } }, b: { act: { total: 8, byWbs: { 'W-A': 8 } } } } }, ['a', 'b'], wmap);
  assert.equal(merged.length, 1); assert.equal(merged[0].hours, 16);
});
