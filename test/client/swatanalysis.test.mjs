// tools/incentive/analysis.js — bảng SWAT Analysis (cột A–AH như file gốc). Số liệu trong test là dữ liệu GIẢ / dựng lại từ công thức.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const A = require('../../tools/incentive/analysis.js');

test('Product line: ES1.1 / ES1.2 / ES 1.3 → ES1; các dòng khác giữ nguyên', () => {
  assert.deepEqual(['ES1.1', 'ES1.2', 'es 1.3', 'ES1', 'ES 5.0', 'S3300', 'Villa Lift', 'ES10'].map(A.productLine), ['ES1', 'ES1', 'ES1', 'ES1', 'ES 5.0', 'S3300', 'Villa Lift', 'ES10']);
});

test('lấy dữ liệu dòng: W = thưởng Scorecard (Fitter + Site-sup) × unit, AD đã chi trước, AE chi đợt này, AG giờ Fitter theo Scorecard', () => {
  const batch = { projects: [{ wbs: '111', name: 'DA', units: 2, stops: 4, kind: 'final30', total: 3000000, swat: { sc: { pf: 4000000, ps: 1000000, used: 224 } }, analysis: { yanspn: 41216040 } }] };
  const [r] = A.rows(batch, { project: () => ({ projectNumber: '814520969', productLine: 'ES1.2' }), pmName: () => 'Tên PM', paidBefore: () => 7000000 });
  assert.deepEqual([r.projectNumber, r.product, r.pm, r.units, r.stops, r.incentive, r.paidBefore, r.paidNow, r.fitterHours, r.yanspn],
    ['814520969', 'ES1', 'Tên PM', 2, 4, 10000000, 7000000, 3000000, 224, 41216040]);
});

test('tính như công thức Excel của file mẫu (dòng ES1, 4 stops)', () => {
  const r = { units: 1, stops: 4, product: 'ES1', yanspn: 41216040, incentive: 11487500, paidBefore: 0, paidNow: 8041250, fitterHours: 224 };
  const x = A.calc(r);
  assert.equal(x.K, 91216040); assert.equal(x.L, 48384000); assert.equal(Math.round(x.M), 39432960); assert.equal(Math.round(x.N), 51783080);
  assert.equal(x.Q, 29714286); assert.equal(x.R, 16000000); assert.equal(x.S, 13714286); assert.equal(Math.round(x.V), 38068794); assert.equal(Math.round(x.AC), 26581294);
  assert.equal(x.AF, 264);
  assert.equal(A.calc({ ...r, yanspn: null }).K, null, 'chưa nhập J → chưa tính');
  assert.equal(A.calc({ ...r, product: 'ES 5.0' }).R, 0);
});

test('xuất Excel: sheet tháng (công thức, cột Q tra sheet Standard Saving trong cùng file) + sheet Standard Saving', async (t) => {
  let ExcelJS; try { ExcelJS = require('exceljs'); } catch (e) { return t.skip('chưa cài exceljs'); }
  const wb = A.build(ExcelJS, { month: '2026-09' }, [{ wbs: '11947299', projectNumber: '814520969', name: 'DA', pm: 'PM', units: 1, stops: 4, product: 'ES1', yanspn: 41216040, incentive: 11487500, paidBefore: 0, paidNow: 8041250, fitterHours: 224 }]);
  assert.deepEqual(wb.worksheets.map(w => w.name), ['092026', 'Standard Saving']);
  const ws = wb.getWorksheet('092026');
  assert.equal(ws.getCell('A1').value, 'SWAT ANALYSIS - HN SEPT 2026');
  assert.equal(ws.getCell('J8').value, 41216040);
  assert.equal(ws.getCell('Q8').value.formula, "VLOOKUP(H8,'Standard Saving'!$B$5:$E$23,2,0)");
  assert.equal(ws.getCell('K8').value.formula, 'J8+$O$2*G8');
  assert.deepEqual([ws.getCell('W8').value, ws.getCell('AE8').value, ws.getCell('AG8').value, ws.getCell('E8').value], [11487500, 8041250, 224, 11947299]);
  assert.equal(A.fileName('2026-09'), 'SWAT Analysis - HN SEPT 2026.xlsx');
});
