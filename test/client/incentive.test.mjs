// Incentive SWAT (tools/incentive/incentive.js): chia thưởng theo % giờ công, các đợt 70% / 100% / final 30% / 20%,
// đọc file "List Fitter and Supervisor for Incentive". Dữ liệu trong test là dữ liệu GIẢ.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Inc = require('../../tools/incentive/incentive.js');

test('lựa chọn đợt trả theo lịch sử dự án', () => {
  assert.deepEqual(Inc.optionsFor([]), ['first70', 'first100']);
  assert.deepEqual(Inc.optionsFor([{ kind: 'first70', month: '2026-03' }]), ['final30', 'final20']);
  assert.deepEqual(Inc.optionsFor([{ kind: 'first100', month: '2026-03' }]), []);
  assert.deepEqual(Inc.optionsFor([{ kind: 'first70', month: '2026-01' }, { kind: 'final20', month: '2026-09' }]), []);
  assert.deepEqual(Inc.optionsFor([{ kind: 'other', month: '2022-01' }]), [], 'dữ liệu cũ coi như đã trả đủ');
  assert.equal(Inc.statusOf([{ kind: 'first70', month: '2026-03' }]).text, 'Đã trả 70% · 03/2026');
  assert.equal(Inc.statusOf([]).code, 'none');
  assert.equal(Inc.monthsBetween('2026-03', '2026-11'), 8);
});

test('trả lần đầu 70%: Site-sup = quỹ × 70%, Fitter chia theo % giờ công', () => {
  const r = Inc.compute({ kind: 'first70', fundF: 10870000, fundS: 1551400, sup: { empId: 'S1', name: 'Giám Sát A' },
    fitters: [{ empId: 'F1', name: 'Thợ A', hours: 204 }, { empId: 'F2', name: 'Thợ B', hours: 24 }, { empId: 'F3', name: 'Thợ C', hours: 20 }] });
  assert.equal(r.lines[0].amount, 1085980);
  assert.equal(Math.round(r.lines[1].amount), Math.round(10870000 * 0.7 * 204 / 248));
  assert.ok(Math.abs(r.fitterTotal - 10870000 * 0.7) < 0.05);
  assert.ok(Math.abs(r.total - (10870000 + 1551400) * 0.7) < 0.05);
  const full = Inc.compute({ kind: 'first100', fundF: 1000, fundS: 100, sup: { name: 'X' }, fitters: [{ name: 'Y', hours: 1 }] });
  assert.equal(full.total, 1100);
});

test('đợt cuối: tổng (100% hoặc 90%) × % giờ công − đã nhận đợt trước; người mới nhận đủ phần của mình', () => {
  const paid = { S1: 1750000, F1: 4593750, F2: 1750000 };
  const r = Inc.compute({ kind: 'final20', fundF: 16100000, fundS: 4900000, sup: { empId: 'S1', name: 'GS' }, paid,
    fitters: [{ empId: 'F1', name: 'A', hours: 52.5 }, { empId: 'F2', name: 'B', hours: 20 }, { empId: 'F4', name: 'Mới', hours: 27.5 }] });
  const [s, a, b, n] = r.lines;
  // đợt cuối 20% (quá 6 tháng chưa final): Site-sup không nhận thêm (= 0); fitter vẫn chia theo giờ công
  assert.deepEqual([s.total, s.before, s.amount], [4410000, 1750000, 0]);
  assert.deepEqual([a.total, a.amount], [7607250, 3013500]);
  assert.deepEqual([b.total, b.amount], [2898000, 1148000]);
  assert.deepEqual([n.before, n.amount], [0, 3984750]);
  const f30 = Inc.compute({ kind: 'final30', fundF: 1000, fundS: 0, fitters: [{ empId: 'F1', name: 'A', hours: 1 }], paid: { F1: 700 } });
  assert.equal(f30.lines[0].amount, 300);
  // nhập tay số tiền thì giữ số nhập tay
  const m = Inc.compute({ kind: 'first70', fundF: 1000, fundS: 0, fitters: [{ name: 'A', hours: 1, amount: 555 }] });
  assert.deepEqual([m.lines[0].amount, m.lines[0].auto, m.lines[0].manual], [555, 700, true]);
  // không có giờ công: chia đều
  const eq = Inc.compute({ kind: 'first100', fundF: 900, fundS: 0, fitters: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] });
  assert.deepEqual(eq.lines.map(l => l.amount), [300, 300, 300]);
});

test('tổng hợp theo người cho cả đợt', () => {
  const p1 = Inc.compute({ kind: 'first70', fundF: 1000, fundS: 100, sup: { empId: 'S1', name: 'GS' }, fitters: [{ empId: 'F1', name: 'A', hours: 1 }] });
  const p2 = Inc.compute({ kind: 'first70', fundF: 2000, fundS: 100, sup: { empId: 'S1', name: 'GS' }, fitters: [{ empId: 'F1', name: 'A', hours: 1 }, { name: 'B', hours: 1 }] });
  const by = Inc.byPerson([p1, p2]);
  assert.deepEqual(by.map(x => [x.role, x.name, x.amount, x.projects]), [['sup', 'GS', 140, 2], ['fitter', 'A', 1400, 2], ['fitter', 'B', 700, 1]]);
});

test('tháng của sheet', () => {
  assert.equal(Inc.monthOfSheet('09 2026', ''), '2026-09');
  assert.equal(Inc.monthOfSheet('Jul.22', 'LIST FITTER AND SUPERVISOR FOR INCENTIVE - HN July 2022'), '2022-07');
  assert.equal(Inc.monthOfSheet('Sheet1', 'LIST FITTER AND SUPERVISOR FOR INCENTIVE - HN Sept 2026'), '2026-09');
  assert.equal(Inc.monthOfSheet('X', ''), '');
});

// sheet giả: { 'A1': v | {v, f} }
function fakeSheet(name, cells, rows = 40) {
  const COL = (s) => s.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  const map = new Map();
  for (const [k, v] of Object.entries(cells)) { const m = /^([A-Z]+)(\d+)$/.exec(k); map.set(`${+m[2]}|${COL(m[1])}`, v && typeof v === 'object' ? v : { v }); }
  return { name, rows, cell: (r, c) => map.get(`${r}|${c}`) || null };
}
const HDR = { A1: 'LIST FITTER AND SUPERVISOR FOR INCENTIVE - HN Sept 2026', P1: 'Tổng số tiền tạm tính đợt 1', Q1: 'Trả Đợt 1', R1: 'Tổng số tiền Final',
  S1: 'Tổng tiền cụ thể từng người -FINAL', T1: 'Tổng tiền thanh toán đợt 2 = Final - đợt 1', W1: '% Tỉ lệ Giờ Công',
  A2: 'No.', B2: 'Project Name', C2: 'Project Number', D2: 'WBS', E2: 'No. Of passed Units', F2: 'No of stop', G2: 'Product\nLine',
  I2: 'Site-sup\nName', J2: 'Fitter\nName', K2: 'Incentive Package', L2: 'Site-sup incentive', M2: 'Fitter\nincentive', N2: 'Note', O2: 'Payment Rate' };

test('đọc sheet mẫu mới: đợt 1 (70%), đợt cuối 20%, Mã NV từ danh sách cuối sheet, đối chiếu ô tổng', () => {
  const sh = fakeSheet('09 2026', { ...HDR,
    B3: 'Dự án Một', C3: 812000001, D3: 11000001, E3: 1, F3: 7, G3: 'S3300 / ES1', K3: { v: 870, f: '=SUM(L3:M6)' }, O3: 0.7,
    I4: 'Giám Sát A', L4: { v: 70, f: '=Q4' },
    J5: 'Thợ A', M5: { v: 600, f: '=Q5' }, W5: 0.75,
    J6: 'Thợ B', M6: { v: 200, f: '=Q6' }, W6: 0.25,
    B7: 'Dự án Hai', D7: 11000002, K7: { v: 300, f: '=SUM(L7:M9)' }, N7: 'chốt 20%  chưa HO quá 6 tháng', O7: 0.9, T7: { v: 300, f: '=SUM(T8:T9)' },
    I8: 'Giám Sát A', L8: { f: '=T8' },
    J9: 'Thợ A', M9: { v: 300, f: '=T9' }, Q9: 400, S9: { v: 700, f: '=$R$9*0.9*W9%' }, W9: 100,
    K12: { v: 1170, f: '=SUM(K3:K11)' },
    G14: 'List of Fitter and Supervisor  derserve Incentive in September 2026', I15: 'Mã NV', J15: 'Site-sup name',
    I16: 900001, J16: 'Giám Sát A', I17: 'Mã NV', J17: 'Fitter', I18: 900101, J18: 'Thợ A', I19: 900102, J19: 'Thợ B',
  });
  const [s] = Inc.parseWorkbook({ sheets: [sh] });
  assert.equal(s.month, '2026-09');
  assert.equal(s.total, 1170); assert.equal(s.matches, true);
  const [p1, p2] = s.projects;
  assert.deepEqual([p1.wbs, p1.projectNumber, p1.stops, p1.kind, p1.rate], ['11000001', '812000001', 7, 'first70', 0.7]);
  assert.deepEqual(p1.lines.map(l => [l.role, l.empId, l.amount, l.pct]), [['sup', '900001', 70, null], ['fitter', '900101', 600, 0.75], ['fitter', '900102', 200, 0.25]]);
  assert.equal(p2.kind, 'final20');
  assert.deepEqual(p2.lines.map(l => [l.role, l.amount, l.before, l.total]), [['sup', 0, 0, 0], ['fitter', 300, 400, 700]]);
  // sheet không có tiêu đề Fitter → bỏ qua
  assert.equal(Inc.parseWorkbook({ sheets: [fakeSheet('HRMS', { A1: 'x' })] }).length, 0);
});

test('đọc sheet: tổng không khớp ô tổng trong file → cảnh báo', () => {
  const sh = fakeSheet('03 2026', { ...HDR, B3: 'P', D3: 11000003, K3: { v: 100, f: '=SUM(L3:M4)' }, O3: 1, J4: 'Thợ', M4: 100, K6: { v: 999, f: '=SUM(K3:K5)' } });
  const [s] = Inc.parseWorkbook({ sheets: [sh] });
  assert.equal(s.projects[0].kind, 'first100');
  assert.equal(s.matches, false); assert.match(s.warnings[0], /khác ô tổng/);
});

test('đã nhận đợt trước: khớp theo Mã NV, thiếu Mã NV thì theo tên', () => {
  const paid = Inc.paidMap([{ lines: [{ empId: '', name: 'Nguyễn Văn A', amount: 700 }, { empId: 'F2', name: 'B', amount: 100 }] }, { lines: [{ empId: 'F2', name: 'B', amount: 50 }] }]);
  assert.equal(Inc.paidOf(paid, { empId: 'F9', name: 'nguyen van a' }), 700);
  assert.equal(Inc.paidOf(paid, { empId: 'F2', name: 'Tên khác' }), 150);
  const r = Inc.compute({ kind: 'final30', fundF: 1000, fundS: 0, paid, fitters: [{ empId: 'F9', name: 'Nguyễn Văn A', hours: 1 }] });
  assert.equal(r.lines[0].amount, 300);
});

test('Site-sup đợt cuối: 30% final quá 60 ngày từ bàn giao khách hàng → 0; 20% → luôn 0; fitter không đổi', () => {
  const base = { fundF: 1000, fundS: 200, sup: { empId: 'S1', name: 'GS' }, fitters: [{ empId: 'F1', name: 'Thợ', hours: 10 }], paid: { S1: 140, F1: 700 } };
  const supOf = (r) => r.lines.find(l => l.role === 'sup').amount, fitOf = (r) => r.lines.find(l => l.role === 'fitter').amount;
  let r = Inc.compute({ ...base, kind: 'final30', handoverDate: '2026-01-01', finalDate: '2026-03-01' });      // 59 ngày
  assert.deepEqual([supOf(r), fitOf(r), r.supRule.zero, r.supRule.days], [60, 300, false, 59]);
  r = Inc.compute({ ...base, kind: 'final30', handoverDate: '2026-01-01', finalDate: '2026-03-03' });         // 61 ngày
  assert.deepEqual([supOf(r), fitOf(r), r.supRule.zero, r.supRule.days], [0, 300, true, 61]);
  r = Inc.compute({ ...base, kind: 'final30' });                                                             // chưa nhập ngày
  assert.deepEqual([supOf(r), r.supRule.need], [60, true]);
  r = Inc.compute({ ...base, kind: 'final20' });
  assert.deepEqual([supOf(r), fitOf(r), r.supRule.zero], [0, 200, true]);
  r = Inc.compute({ ...base, kind: 'first70' });
  assert.equal(supOf(r), 140);
});
