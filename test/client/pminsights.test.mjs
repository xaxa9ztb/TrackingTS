// Quản lý dự án — Đợt 2 / 3 (insights.js): tải nguồn lực, cảnh báo, lý do sai lệch, subcon, % hoàn thành,
// kế hoạch 3 tuần + PPC, gợi ý fitter, báo cáo tuần. Dữ liệu trong test là dữ liệu GIẢ.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const P = require('../../tools/projectplan/pmio.js');
globalThis.PMIO = P;
const I = require('../../tools/projectplan/insights.js');
const offDay = (d) => new Date(d + 'T00:00:00Z').getUTCDay() === 0;
const TODAY = '2026-11-16';   // thứ Hai

function sample() {
  const d = P.emptyData();
  const a = P.newProject({ id: 'pA', name: 'Alpha', wbs: 'E-1', liftType: 'S3000', mode: 'in' });
  a.teamStart.date = '2026-11-16'; a.handover.date = '2026-12-20'; a.arrival.date = '2026-11-20'; a.testReady.date = '2026-11-25';
  const b = P.newProject({ id: 'pB', name: 'Beta', wbs: 'E-2', mode: 'sub', subcon: 'Gia Khang' });
  b.teamStart.date = '2026-11-18'; b.testReady.date = '2026-11-26'; b.handover.date = '2026-12-05';
  const c = P.newProject({ id: 'pC', name: 'Gamma', wbs: 'E-3', mode: 'sub', subcon: 'Gia Khang' });
  c.teamStart.date = '2026-11-17'; c.handover.date = '2026-12-10';
  const e = P.newProject({ id: 'pE', name: 'Epsilon', mode: 'in' });
  e.teamStart.date = '2026-11-23'; e.handover.date = '2026-12-31';
  d.projects = [a, b, c, e];
  d.fitters = [{ id: 'f1', name: 'Thợ Một', empId: 'F1' }, { id: 'f2', name: 'Thợ Hai', empId: 'F2' }, { id: 's1', name: 'Gia Khang', sub: true, company: 'Gia Khang' }];
  const al = (fid, days, p, t) => days.forEach(x => { (d.alloc[fid] = d.alloc[fid] || {})[x] = t ? { p, t: 1 } : { p }; });
  al('f1', ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'], 'pA');
  al('f2', ['2026-11-19', '2026-11-20'], 'pA', true);
  al('s1', ['2026-11-18', '2026-11-19'], 'pB');
  return d;
}

test('progressPct: % hoàn thành có trọng số; null khi chưa cập nhật', () => {
  assert.equal(I.progressPct(P.newProject()), null);
  assert.equal(I.progressPct({ prog: { rail: 100, doors: 50 } }), 35);   // 25 + 10
  assert.equal(I.progressPct({ prog: Object.fromEntries(I.STAGES.map(s => [s.k, 100])) }), 100);
  assert.equal(I.STAGES.reduce((a, s) => a + s.w, 0), 100);
});

test('resourceLoad: công suất, đã phân công, dự kiến, nghỉ phép, dự án chưa có người, nhu cầu test theo tuần', () => {
  const d = sample();
  const leaves = [{ empId: 'f2', from: '2026-11-17', to: '2026-11-17', status: 'approved' }, { empId: 'T1', from: '2026-11-24', to: '2026-11-25', status: 'approved' }];
  const r = I.resourceLoad({ data: d, from: TODAY, weeks: 2, offDay, leaves, testers: ['T1'] });
  assert.equal(r[0].w, '2026-11-16'); assert.equal(r[0].workdays, 6);
  assert.equal(r[0].cap, 12); assert.equal(r[0].booked, 4); assert.equal(r[0].tent, 2); assert.equal(r[0].leave, 1); assert.equal(r[0].free, 5);
  assert.deepEqual(r[0].unstaffed, []);                       // Alpha có người; Epsilon bắt đầu tuần sau
  assert.deepEqual(r[0].subUnstaffed, ['pC']);                // Gamma (subcon) chưa có đội
  assert.deepEqual(r[1].unstaffed.sort(), ['pA', 'pE']);      // tuần sau không ai ở Alpha / Epsilon
  assert.deepEqual(r[1].testDemand.sort(), ['pA', 'pB']);
  assert.equal(r[1].testers, 1); assert.equal(r[1].testerDays, 6 - 2);
});

test('conflicts: nghỉ phép trùng phân công, xếp trước hàng về, vượt định mức, thiếu tester, subcon quá tải, sắp nhận hố chưa có người', () => {
  const d = sample();
  d.alloc.f1['2026-11-24'] = { p: 'pA' };
  const leaves = [{ empId: 'F1', from: '2026-11-17', to: '2026-11-18', status: 'approved' }, { empId: 'F1', from: '2026-11-24', to: '2026-11-24', status: 'pending' }];
  const c = I.conflicts({ data: d, today: TODAY, leaves, offDay, target: (w) => (w === 'E-1' ? 30 : 0), actual: (w) => (w === 'E-1' ? 10 : 0), testers: ['T1'] });
  const t = (type) => c.filter(x => x.type === type);
  assert.equal(t('leave').length, 2);
  assert.equal(t('leave').find(x => x.lvl === 'bad').msg.includes('17/11, 18/11'), true);
  assert.equal(t('leave').find(x => x.lvl === 'warn').msg.includes('chờ duyệt'), true);
  assert.ok(t('early').some(x => x.pid === 'pA' && /hàng về dự kiến 20\/11/.test(x.msg)));
  assert.ok(t('hours').some(x => x.pid === 'pA' && x.lvl === 'warn' && /50h > định mức 30h/.test(x.msg)));   // 10h + 5 ngày × 8
  assert.ok(t('tester').some(x => /2 dự án sẵn sàng test nhưng chỉ có 1 tester/.test(x.msg)));
  assert.ok(t('subcon').some(x => /Gia Khang: 2 dự án/.test(x.msg)));
  assert.ok(t('unstaffed').some(x => x.pid === 'pE') && t('unstaffed').some(x => x.pid === 'pC'));
  assert.equal(c[0].lvl, 'bad');                                // đỏ xếp trước
});

test('reasonStats + subconScore: lý do dời mốc, tỉ lệ đúng hạn theo công ty subcon', () => {
  const d = sample(), b = d.projects[1], c = d.projects[2];
  b.bl.push(P.snapshotProject(d, b, {})); c.bl.push(P.snapshotProject(d, c, {}));
  b.handover.date = '2026-12-12';
  b.log.push({ at: '2026-11-20', k: 'handover', from: '2026-12-05', to: '2026-12-12', r: 'shaft' });
  c.log.push({ at: '2026-11-21', k: 'teamStart', from: '2026-11-17', to: '2026-11-19', r: 'subcon' });
  const rs = I.reasonStats(d.projects);
  assert.deepEqual(rs.map(x => [x.k, x.n, x.days]), [['shaft', 1, 7], ['subcon', 1, 2]]);
  const sc = I.subconScore(d, 'last');
  assert.equal(sc.length, 1); assert.equal(sc[0].name, 'Gia Khang');
  assert.deepEqual([sc[0].projects, sc[0].compared, sc[0].late, sc[0].onTimePct, sc[0].avgLate], [2, 2, 1, 50, 7]);
  assert.equal(sc[0].reasons[0].label, 'Hố / mặt bằng chưa bàn giao');
});

test('lookahead + commitWeek + autoClose + ppc', () => {
  const d = sample(), a = d.projects[0];
  a.pre = { shaft: true, power: true };
  const la = I.lookahead(d, TODAY, 3);
  const ts = la.find(x => x.pid === 'pA' && x.k === 'teamStart');
  assert.equal(ts.week, '2026-11-16'); assert.equal(ts.ready, false);          // thiếu hàng về + giàn giáo
  assert.deepEqual(ts.pre.filter(x => !x.ok).map(x => x.k), ['goods', 'scaffold']);
  assert.ok(la.every(x => x.date <= '2026-12-06'));
  const wk = la.filter(x => x.week === '2026-11-16');
  assert.equal(I.commitWeek(d, '2026-11-16', wk, { by: 'QLDA' }), wk.length);
  assert.equal(I.commitWeek(d, '2026-11-16', wk, {}), 0, 'không nhân đôi');
  a.teamStart.done = true;
  assert.equal(I.autoClose(d, TODAY), 1);
  const cB = d.projects.find(p => p.id === 'pC').cm[0]; cB.ok = false; cB.r = 'shaft';
  const pp = I.ppc(d)[0];
  assert.equal(pp.w, '2026-11-16'); assert.equal(pp.done, 1); assert.equal(pp.failed, 1); assert.equal(pp.pct, 50);
  assert.equal(pp.reasons[0].label, 'Hố / mặt bằng chưa bàn giao');
});

test('suggestFitters: ưu tiên người rảnh, có kinh nghiệm cùng loại thang, trừ ngày nghỉ phép', () => {
  const d = sample();
  d.fitters.push({ id: 'f3', name: 'Thợ Ba', empId: 'F3' });
  const exp = I.experience([{ empId: 'F3', wbs: 'X-9', total: 400 }, { empId: 'F2', wbs: 'X-8', total: 200 }],
    (w) => ({ 'X-9': { productLine: 'S3000' }, 'X-8': { productLine: 'S5000' } })[w]);
  const s = I.suggestFitters({ data: d, project: d.projects[0], from: '2026-11-18', to: '2026-11-21', offDay, exp,
    leaves: [{ empId: 'F2', from: '2026-11-21', to: '2026-11-21', status: 'approved' }] });
  assert.deepEqual(s.map(x => x.f.id), ['f3', 'f1', 'f2']);
  assert.ok(s[0].why.some(w => /S3000/.test(w)));
  assert.equal(s.find(x => x.f.id === 'f1').busy, 0, 'đang làm chính dự án này thì không tính là bận');
  assert.equal(s.find(x => x.f.id === 'f2').leave, 1);
  assert.ok(!s.some(x => x.f.sub), 'không gợi ý đội subcon');
});

test('weeklyReport: dự án trễ, mốc đến hạn 2 tuần, mốc quá hạn, PPC tuần trước', () => {
  const d = sample(), a = d.projects[0];
  a.bl.push(P.snapshotProject(d, a, {})); a.handover.date = '2026-12-24';
  d.projects[2].shaftReady.date = '2026-11-10';
  const r = I.weeklyReport({ data: d, today: '2026-11-18' });
  assert.equal(r.week, '2026-11-16');
  assert.equal(r.late[0].p.id, 'pA'); assert.equal(r.late[0].slip, 4);
  assert.equal(r.notBl, 3);
  assert.ok(r.due.some(x => x.p.id === 'pA' && x.m.key === 'arrival' && !x.next));
  assert.ok(r.overdue.some(x => x.p.id === 'pC' && x.m.key === 'shaftReady'));
});

test('fix + applyImport: trường mới (prog, pre, log, cm) có sẵn và không bị file Excel ghi đè', () => {
  const d = P.fix({ version: 1, fitters: [], projects: [{ id: 'p', name: 'Cũ' }], alloc: {} });
  assert.deepEqual([d.projects[0].prog, d.projects[0].pre, d.projects[0].log, d.projects[0].cm], [{}, {}, [], []]);
  const cur = sample(); cur.projects[0].prog = { rail: 80 }; cur.projects[0].log.push({ k: 'handover', r: 'goods' });
  const imp = P.emptyData(); imp.projects = [P.newProject({ id: 'n', name: 'Alpha', wbs: 'E-1', address: 'mới' })];
  for (const mode of ['merge', 'overwrite', 'replace']) {
    const out = P.applyImport(cur, imp, { plan: true, grid: mode !== 'replace', mode }).data.projects.find(p => p.wbs === 'E-1');
    assert.deepEqual(out.prog, { rail: 80 }, mode); assert.equal(out.log.length, 1, mode);
  }
});
