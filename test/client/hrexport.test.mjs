// Kiểm thử xuất hàng loạt cho HR (tools/tsadmin/hrexport.js): tên tab, cấu trúc zip, mỗi nhân viên một tab phụ cấp.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const H = require('../../tools/tsadmin/hrexport.js');

let ExcelJS, JSZip;
try { ExcelJS = require('exceljs'); JSZip = require('jszip'); } catch (e) { /* không có */ }
const skip = !ExcelJS && 'chưa cài exceljs / jszip';

test('tên tab: tối đa 31 ký tự, bỏ ký tự cấm, trùng thì thêm mã NV', () => {
  const used = new Set();
  assert.equal(H.sheetName('Nguyễn Văn A', 'E1', used), 'Nguyễn Văn A');
  assert.equal(H.sheetName('Nguyễn Văn A', 'E2', used), 'Nguyễn Văn A (E2)');
  assert.equal(H.sheetName('A/B:C*D?[x]', 'E3', used), 'A B C D x');
  const long = H.sheetName('x'.repeat(50), 'E4', used);
  assert.equal(long.length, 31);
  assert.equal(H.monthLabel('2026-10'), 'thang 10 2026');
});

test('zip: Bảng công/<TEN>.xlsx và Phụ cấp/Pc Xe|Pc Xang - thang M YYYY.xlsx, mỗi nhân viên một tab', { skip }, async () => {
  const tsT = fs.readFileSync('tools/timesheet/ts-template.xlsx'), alT = fs.readFileSync('tools/timesheet/phucap-xe-template.xlsx');
  const days = (n) => Array.from({ length: n }, (_, i) => `2026-09-${String(16 + i).padStart(2, '0')}`);
  const mk = (empId, name, wbs, n, types) => {
    const entries = days(n).map((date, i) => ({ id: i + 1, date, workNumber: wbs, projectName: 'Dự án ' + wbs, activityCode: '1110', startTime: '08:00', endTime: '17:00', breakTime: '1', bd: { NORMAL: 8 } }));
    return { empId, name, position: 'Fitter', data: { entries, allow: { rows: types.map((t, i) => ({ id: String(i), type: t, wbs, project: 'Dự án ' + wbs, from: '2026-09-16', to: '2026-10-15', location: 'Thủ Đức', remarks: '', ownVehicle: t === 'province' })) } } };
  };
  const docs = [mk('E1', 'Nguyễn Văn A', 'W-1', 5, ['fuel']), mk('E2', 'Trần Thị B', 'W-2', 3, ['fuel']), mk('E3', 'Lê C', 'W-3', 24, ['province']), mk('E4', 'Không Phụ Cấp', 'W-4', 2, [])];
  const r = await H.build({ ExcelJS, JSZip, TsExcel: require('../../tools/timesheet/tsexcel.js'), TsAllowance: require('../../tools/timesheet/allowance.js') },
    { docs, period: '2026-10', tpl: { timesheet: tsT, allowance: alT }, today: '2026-10-20' });
  assert.deepEqual(r.files, { tsCount: 4, province: 1, fuel: 2 });
  const z = await JSZip.loadAsync(Buffer.from(await r.blob.arrayBuffer()));
  const names = Object.keys(z.files).filter(n => !z.files[n].dir).sort();
  assert.deepEqual(names, ['Bảng công/KHONG PHU CAP.xlsx', 'Bảng công/LE C.xlsx', 'Bảng công/NGUYEN VAN A.xlsx', 'Bảng công/TRAN THI B.xlsx', 'Phụ cấp/Pc Xang - thang 10 2026.xlsx', 'Phụ cấp/Pc Xe - thang 10 2026.xlsx']);
  const fuel = new ExcelJS.Workbook(); await fuel.xlsx.load(await z.file('Phụ cấp/Pc Xang - thang 10 2026.xlsx').async('nodebuffer'));
  assert.deepEqual(fuel.worksheets.map(w => w.name), ['Nguyễn Văn A', 'Trần Thị B']);
  assert.equal(fuel.worksheets[0].getCell('G8').value, 5); assert.equal(fuel.worksheets[1].getCell('G8').value, 3);
  assert.equal(fuel.worksheets[1].getCell('B8').value, 'Trần Thị B');
  const pv = new ExcelJS.Workbook(); await pv.xlsx.load(await z.file('Phụ cấp/Pc Xe - thang 10 2026.xlsx').async('nodebuffer'));
  assert.deepEqual(pv.worksheets.map(w => w.name), ['Lê C']);
});
