// Quản lý dự án — nhập Excel có chọn lọc (P.applyImport): chọn sheet Plan / Nhân sự, Bổ sung / Ghi đè trùng / Thay toàn bộ.
// Dữ liệu trong test là dữ liệu GIẢ.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const P = require('../../tools/projectplan/pmio.js');

function current() {
  const d = P.emptyData();
  d.projects = [
    P.newProject({ id: 'pA', name: 'Toà nhà Alpha', wbs: 'E-1', address: 'Q1', liftType: '', color: '#111111' }),
    P.newProject({ id: 'pB', name: 'Biệt thự Beta', wbs: '', address: 'Q2' }),
    P.newProject({ id: 'pC', name: 'Gamma (không có trong file)', wbs: 'E-3' }),
  ];
  d.fitters = [{ id: 'f1', name: 'Nguyễn Văn A', empId: 'N1' }, { id: 'f2', name: 'Trần Văn B', empId: '' }];
  d.alloc = { f1: { '2026-11-02': { p: 'pA' }, '2026-11-03': { p: 'pA' } }, f2: { '2026-11-02': { p: 'pB' }, '2026-11-20': { p: 'pC' } } };
  return d;
}
function fromFile() {
  const d = P.emptyData();
  d.projects = [
    P.newProject({ id: 'x1', name: 'Toà nhà Alpha (mới đổi tên)', wbs: 'E-1', address: 'Q1 mới', liftType: 'S3000' }),
    P.newProject({ id: 'x2', name: 'Biệt thự Beta', address: '' , liftType: 'S5000' }),
    P.newProject({ id: 'x3', name: 'Delta mới', wbs: 'E-4' }),
    P.newProject({ id: 'x4', name: 'Epsilon', fromGrid: true }),
  ];
  d.fitters = [{ id: 'g1', name: 'NGUYEN VAN A', empId: 'N1' }, { id: 'g3', name: 'Lê Văn C', empId: '' }];
  d.alloc = { g1: { '2026-11-02': { p: 'x3' }, '2026-11-04': { p: 'x1' } }, g3: { '2026-11-03': { p: 'x4', t: 1 } } };
  return d;
}

test('Bổ sung: chỉ thêm mới, điền ô trống, không đổi dữ liệu đã có', () => {
  const { data, summary } = P.applyImport(current(), fromFile(), { plan: true, grid: true, mode: 'merge' });
  const A = data.projects.find(p => p.id === 'pA');
  assert.equal(A.name, 'Toà nhà Alpha');          // không đổi tên
  assert.equal(A.address, 'Q1');                  // không đổi địa chỉ
  assert.equal(A.liftType, 'S3000');              // ô trống được điền
  assert.equal(A.color, '#111111');
  assert.ok(data.projects.some(p => p.wbs === 'E-4'));
  assert.ok(data.projects.some(p => p.id === 'pC'));  // dự án không có trong file vẫn còn
  assert.equal(data.alloc.f1['2026-11-02'].p, 'pA');   // ô đã có phân công giữ nguyên
  assert.equal(data.alloc.f1['2026-11-04'].p, 'pA');   // ô trống được điền (x1 → pA theo WBS)
  assert.equal(data.fitters.length, 3);                // thêm Lê Văn C, A khớp theo mã NV
  assert.equal(summary.cellsSkip, 1);
});

test('Ghi đè dữ liệu trùng: dự án trùng lấy theo file; lịch fitter trong file thay đúng như file trong khoảng ngày', () => {
  const { data, summary } = P.applyImport(current(), fromFile(), { plan: true, grid: true, mode: 'overwrite' });
  const A = data.projects.find(p => p.id === 'pA');
  assert.equal(A.name, 'Toà nhà Alpha (mới đổi tên)');
  assert.equal(A.address, 'Q1 mới');
  assert.equal(A.color, '#111111');                    // giữ màu, id
  const delta = data.projects.find(p => p.wbs === 'E-4');
  assert.equal(data.alloc.f1['2026-11-02'].p, delta.id);  // ô bị ghi đè theo file
  assert.equal(data.alloc.f1['2026-11-03'], undefined);   // trong khoảng file, file để trống → bỏ trống
  assert.equal(data.alloc.f2['2026-11-20'].p, 'pC');      // fitter không có trong file giữ nguyên
  assert.ok(summary.cellsDel >= 1);
});

test('Chỉ nhập Plan: không đụng fitter / phân công', () => {
  const cur = current();
  const { data } = P.applyImport(cur, fromFile(), { plan: true, grid: false, mode: 'overwrite' });
  assert.deepEqual(data.fitters, cur.fitters);
  assert.deepEqual(data.alloc, cur.alloc);
  assert.ok(!data.projects.some(p => p.name === 'Epsilon'));  // dự án chỉ có trong lưới không nhập khi bỏ sheet Nhân sự
});

test('Chỉ nhập Nhân sự: dự án dùng trong lưới mà chưa có thì được thêm, thông tin dự án đã có không đổi', () => {
  const { data, summary } = P.applyImport(current(), fromFile(), { plan: false, grid: true, mode: 'merge' });
  assert.equal(data.projects.find(p => p.id === 'pA').address, 'Q1');
  assert.ok(data.projects.some(p => p.name === 'Epsilon'));
  assert.ok(data.projects.some(p => p.wbs === 'E-4'));       // Delta được dùng ở lưới → thêm
  assert.equal(summary.pGrid, 2);
});

test('Thay toàn bộ Plan: dự án không có trong file bị xoá, trừ dự án còn phân công', () => {
  const cur = current(); delete cur.alloc.f2['2026-11-20'];
  const { data, summary } = P.applyImport(cur, fromFile(), { plan: true, grid: false, mode: 'replace' });
  assert.ok(!data.projects.some(p => p.id === 'pC'));
  assert.equal(summary.pDel, 1);
  const cur2 = current();
  const r2 = P.applyImport(cur2, fromFile(), { plan: true, grid: false, mode: 'replace' });
  assert.ok(r2.data.projects.some(p => p.id === 'pC'));     // còn phân công 20/11 → giữ
  assert.equal(r2.summary.pKept, 1);
});

test('Thay toàn bộ cả 2 phần = dữ liệu file (như trước)', () => {
  const imp = fromFile();
  const { data, summary } = P.applyImport(current(), imp, { plan: true, grid: true, mode: 'replace' });
  assert.deepEqual(data, imp);
  assert.equal(summary.all, true);
});
