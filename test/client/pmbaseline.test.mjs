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

test('snapshotProject: baseline của MỘT dự án — ngày mốc + khoảng phân công chính thức (bỏ dự kiến); tên tự đánh BL0, BL1', () => {
  const d = sample(), a = d.projects[0];
  const b0 = P.snapshotProject(d, a, { by: 'QLDA', note: 'duyệt' });
  assert.equal(b0.name, 'BL0'); assert.equal(b0.by, 'QLDA');
  assert.deepEqual(b0.ms, { teamStart: '2026-11-02', handover: '2026-12-10' });
  assert.deepEqual(b0.al, { from: '2026-11-02', to: '2026-11-03', days: 2 });   // ngày 04/11 dự kiến không tính
  a.bl.push(b0);
  assert.equal(P.snapshotProject(d, a, {}).name, 'BL1');
  assert.equal(d.projects[1].bl.length, 0);                                      // dự án khác không bị chốt theo
});

test('variance: mỗi dự án so với baseline CỦA RIÊNG NÓ; chọn bản mới nhất hoặc bản đầu tiên', () => {
  const d = sample(), a = d.projects[0], b = d.projects[1];
  a.bl.push(P.snapshotProject(d, a, {}));                      // BL0: bàn giao 10/12
  a.handover.date = '2026-12-16'; a.teamStart.date = '2026-10-30';
  let v = P.variance(d, 'last'), A1 = v.find(x => x.p.id === 'pA'), B1 = v.find(x => x.p.id === 'pB');
  assert.equal(A1.ms.handover.diff, 6); assert.equal(A1.ms.teamStart.diff, -3);
  assert.equal(A1.slip, 6); assert.equal(A1.slipKey, 'handover'); assert.equal(A1.bl.name, 'BL0');
  assert.equal(B1.inBase, false); assert.equal(B1.slip, null);   // Beta chưa chốt → không có sai lệch
  a.bl.push(P.snapshotProject(d, a, {}));                      // BL1: chốt lại theo kế hoạch mới (16/12)
  a.handover.date = '2026-12-18';
  assert.equal(P.variance(d, 'last').find(x => x.p.id === 'pA').slip, 2);     // so với BL1
  assert.equal(P.variance(d, 'first').find(x => x.p.id === 'pA').slip, 8);    // so với kế hoạch gốc BL0
  b.bl.push(P.snapshotProject(d, b, {}));
  assert.equal(P.variance(d, 'last').find(x => x.p.id === 'pB').slip, 0);
});

test('fix: baseline CHUNG (bản đầu) được chuyển thành baseline của từng dự án, không nhân đôi khi chạy lại', () => {
  const d = sample();
  d.baselines = [{ id: 'g1', name: 'BL chung', at: '2026-11-01T00:00:00Z', by: 'QLDA', note: 'cũ', ms: { pA: { handover: '2026-12-10' } }, al: { pA: { from: '2026-11-02', to: '2026-11-03', days: 2 }, pB: { from: '2026-11-05', to: '2026-11-06', days: 2 } } }];
  P.fix(d);
  assert.deepEqual(d.baselines, []);
  assert.equal(d.projects[0].bl.length, 1); assert.equal(d.projects[0].bl[0].name, 'BL chung'); assert.deepEqual(d.projects[0].bl[0].ms, { handover: '2026-12-10' });
  assert.equal(d.projects[1].bl.length, 1); assert.deepEqual(d.projects[1].bl[0].al, { from: '2026-11-05', to: '2026-11-06', days: 2 });
  P.fix(d); assert.equal(d.projects[0].bl.length, 1);
});

test('merge: baseline chốt ở máy này (trong dự án) + danh sách subcon ở máy kia được gộp', () => {
  const base = sample(), local = JSON.parse(JSON.stringify(base)), remote = JSON.parse(JSON.stringify(base));
  local.projects[0].bl.push({ id: 'b1', name: 'BL0', at: '2026-11-01', ms: {}, al: null });
  remote.subcons.push({ id: 's9', name: 'Minh Loi' });
  const m = P.merge(base, local, remote).data;
  assert.deepEqual(m.projects[0].bl.map(x => x.id), ['b1']);
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

test('applyImport: giữ baseline của dự án, danh sách subcon và cờ đội subcon', () => {
  const cur = sample(); cur.projects[0].bl.push({ id: 'b1', name: 'BL0', ms: {}, al: null }); cur.subcons.push({ id: 's9', name: 'Gia Khang' });
  const imp = P.emptyData(); imp.fitters = [{ id: 'x1', name: 'Gia Khang', empId: '' }, { id: 'x2', name: 'Thợ Hai', empId: '' }]; imp.alloc = { x1: {}, x2: {} };
  imp.projects = [P.newProject({ id: 'y1', name: 'Alpha đổi tên', wbs: 'E-1', address: 'mới' })];
  const all = P.applyImport(cur, imp, { plan: true, grid: true, mode: 'replace' }).data;
  assert.equal(all.projects[0].bl.length, 1); assert.equal(all.subcons.length, 1);          // thay toàn bộ: dự án trùng WBS giữ baseline
  const ow = P.applyImport(cur, imp, { plan: true, grid: false, mode: 'overwrite' }).data;
  assert.equal(ow.projects.find(p => p.id === 'pA').bl.length, 1); assert.equal(ow.projects.find(p => p.id === 'pA').address, 'mới');   // ghi đè thông tin, không mất baseline
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

test('Mốc SAIS (nghiệm thu nội bộ) + Kiểm định: có trong mô hình, cột Excel, đọc được từ sheet Plan, dùng cho sai lệch', () => {
  assert.deepEqual(P.MILESTONES.map(m => m.key).slice(-3), ['sais', 'inspect', 'handover']);
  const d = P.fix({ version: 1, fitters: [], projects: [{ id: 'p', name: 'Cũ' }], alloc: {} });
  assert.deepEqual([d.projects[0].sais, d.projects[0].inspect], [{ date: '', done: false, note: '' }, { date: '', done: false, note: '' }]);
  const XLSX = require('../../js/xlsx.full.min.js');
  const ws = XLSX.utils.aoa_to_sheet([['STT', 'Tên Dự án', 'SAIS', 'Kiểm định'], [1, 'Alpha', '05.12.2026', 'xong']]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Plan');
  const p = P.parseWorkbook(XLSX, wb).data.projects[0];
  assert.equal(p.sais.date, '2026-12-05'); assert.equal(p.inspect.done, true);
  // không có ngày bàn giao → sai lệch lấy theo mốc Kiểm định
  const dd = P.emptyData(); const q = P.newProject({ id: 'q', name: 'Q' }); q.inspect.date = '2026-12-10'; dd.projects = [q];
  q.bl.push(P.snapshotProject(dd, q, {})); q.inspect.date = '2026-12-13';
  assert.equal(P.variance(dd, 'last')[0].slip, 3);
});
