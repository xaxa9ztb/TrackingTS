// Quản lý dự án — baseline, sai lệch, đội subcon, thực tế theo chấm công. Dữ liệu trong test là dữ liệu GIẢ.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const P = require('../../tools/projectplan/pmio.js');
const A = require('../../tools/projectplan/actual.js');

function sample() {
  const d = P.emptyData();
  const a = P.newProject({ id: 'pA', name: 'Alpha', wbs: 'E-1' }), b = P.newProject({ id: 'pB', name: 'Beta', wbs: 'E-2', mode: 'sub', subcon: 'Gia Khang' });
  a.teamStart.date = '2026-11-02'; a.handover.date = '2026-12-10';
  b.teamStart.date = '2026-11-05';
  d.projects = [a, b];
  d.fitters = [{ id: 'f1', name: 'Thợ Một', empId: 'F1' }, { id: 's1', name: 'Gia Khang', sub: true, company: 'Gia Khang' }];
  d.alloc = { f1: { '2026-11-02': { p: 'pA' }, '2026-11-03': { p: 'pA' }, '2026-11-04': { p: 'pA', t: 1 } }, s1: { '2026-11-05': { p: 'pB' }, '2026-11-06': { p: 'pB' } } };
  return d;
}

test('fix: dữ liệu cũ thiếu mốc mới / baseline / subcon được bổ sung, không mất dữ liệu', () => {
  const old = { version: 1, fitters: [], projects: [{ id: 'p', name: 'Cũ', teamStart: { date: '2026-01-01', done: true, note: '' } }], alloc: {} };
  const d = P.fix(old);
  assert.deepEqual(d.baselines, []); assert.deepEqual(d.subcons, []);
  assert.deepEqual(d.projects[0].mechDone, { date: '', done: false, note: '' });
  assert.equal(d.projects[0].teamStart.date, '2026-01-01');
  assert.equal(d.projects[0].mode, '');
});

test('snapshotBaseline: lưu ngày mốc + khoảng phân công chính thức (bỏ dự kiến)', () => {
  const b = P.snapshotBaseline(sample(), { name: 'BL0', by: 'QLDA', note: 'duyệt' });
  assert.equal(b.name, 'BL0'); assert.equal(b.by, 'QLDA');
  assert.deepEqual(b.ms.pA, { teamStart: '2026-11-02', handover: '2026-12-10' });
  assert.deepEqual(b.al.pA, { from: '2026-11-02', to: '2026-11-03', days: 2 });   // ngày 04/11 dự kiến không tính
  assert.deepEqual(b.al.pB, { from: '2026-11-05', to: '2026-11-06', days: 2 });
});

test('variance: lệch ngày từng mốc so với baseline; slip lấy mốc bàn giao trước', () => {
  const d = sample(), b = P.snapshotBaseline(d, { name: 'BL0' });
  d.projects[0].handover.date = '2026-12-16'; d.projects[0].teamStart.date = '2026-10-30';
  d.projects.push(P.newProject({ id: 'pC', name: 'Thêm sau' }));
  const v = P.variance(d, b), A1 = v.find(x => x.p.id === 'pA'), B1 = v.find(x => x.p.id === 'pB'), C1 = v.find(x => x.p.id === 'pC');
  assert.equal(A1.ms.handover.diff, 6); assert.equal(A1.ms.teamStart.diff, -3);
  assert.equal(A1.slip, 6); assert.equal(A1.slipKey, 'handover');
  assert.equal(B1.slip, 0); assert.equal(B1.slipKey, 'teamStart');
  assert.equal(C1.inBase, false); assert.equal(C1.slip, null);
  assert.equal(P.variance(d, null)[0].slip, null);   // chưa có baseline
});

test('merge: baseline + danh sách subcon của hai máy được gộp theo id', () => {
  const base = sample(), local = JSON.parse(JSON.stringify(base)), remote = JSON.parse(JSON.stringify(base));
  local.baselines.push({ id: 'b1', name: 'BL máy tôi', at: '2026-11-01', ms: {}, al: {} });
  remote.subcons.push({ id: 's9', name: 'Minh Loi' });
  const m = P.merge(base, local, remote).data;
  assert.deepEqual(m.baselines.map(x => x.id), ['b1']);
  assert.deepEqual(m.subcons.map(x => x.name), ['Minh Loi']);
  assert.equal(m.fitters.find(f => f.id === 's1').sub, true);
});

test('subconNames: lấy tên công ty từ chức danh "Sub_<Công ty>_Fitter", bỏ trùng', () => {
  const rows = [['ID', 'Position Title'], [1, 'Sub_Gia Khang_Fitter'], [2, 'Sub_Gia Khang _Fitter'], [3, 'Sub_Minh Loi_Fitter'], [4, 'S/C Fitter VNM'], [5, 'NI Technician'], [6, 'sub_TTT_fitter']];
  assert.deepEqual(P.subconNames(rows), ['Gia Khang', 'Minh Loi', 'TTT']);
});

test('Excel: cột Hình thức thi công / mốc mới có trong PLAN_COLUMNS; parseMode đọc được chữ', () => {
  const ks = P.PLAN_COLUMNS.map(c => c.k);
  ['mechDone', 'testReady', 'mode', 'subcon', 'wbs'].forEach(k => assert.ok(ks.includes(k), k));
  assert.equal(P.parseMode('Subcon'), 'sub'); assert.equal(P.parseMode('Inhouse'), 'in'); assert.equal(P.parseMode('Kết hợp'), 'mix'); assert.equal(P.parseMode(''), '');
});

test('applyImport thay toàn bộ: giữ baseline, danh sách subcon và cờ đội subcon', () => {
  const cur = sample(); cur.baselines.push({ id: 'b1', name: 'BL0', ms: {}, al: {} }); cur.subcons.push({ id: 's9', name: 'Gia Khang' });
  const imp = P.emptyData(); imp.fitters = [{ id: 'x1', name: 'Gia Khang', empId: '' }, { id: 'x2', name: 'Thợ Hai', empId: '' }]; imp.alloc = { x1: {}, x2: {} };
  const all = P.applyImport(cur, imp, { plan: true, grid: true, mode: 'replace' }).data;
  assert.equal(all.baselines.length, 1); assert.equal(all.subcons.length, 1);
  assert.equal(all.fitters.find(f => f.name === 'Gia Khang').sub, true);
  const grid = P.applyImport(cur, imp, { plan: false, grid: true, mode: 'replace' }).data;
  assert.equal(grid.fitters.find(f => f.name === 'Gia Khang').sub, true);
  assert.ok(!grid.fitters.find(f => f.name === 'Thợ Hai').sub);
});

test('projectActuals: ngày đầu / cuối, giờ lắp và giờ tester theo WBS', () => {
  const rows = [
    { empId: 'F1', wbs: 'e-1', date: '2026-11-03', total: 8 }, { empId: 'F1', wbs: 'E-1', date: '2026-11-02', normal: 8, ot1: 2 },
    { empId: 'TC1', wbs: 'E-1', date: '2026-11-20', total: 6 }, { empId: 'TC1', wbs: 'E-2', date: '2026-11-21', total: 4 }, { empId: 'F1', wbs: '', date: '2026-11-04', total: 8 },
  ];
  const r = A.projectActuals(rows, ['tc1']);
  assert.deepEqual(r['E-1'].inst, { first: '2026-11-02', last: '2026-11-03', hours: 18 });
  assert.deepEqual(r['E-1'].test, { first: '2026-11-20', last: '2026-11-20', hours: 6 });
  assert.equal(r['E-1'].hours, 24); assert.equal(r['E-1'].people, 2);
  assert.equal(r['E-2'].inst.hours, 0); assert.equal(r['E-2'].test.hours, 4);   // dự án subcon: chỉ có giờ tester
});
