// Bảng tiến độ — trình chỉnh Gantt: tính lịch, nối tiếp / gối đầu, kéo dời, đổi số ngày, thêm / xoá / đổi thứ tự dòng
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const G = require('../../tools/tiendotm/gantt.js');

const D = (s) => G.pd(s), I = (d) => G.iso(d);
// 2026-06-29 là thứ Hai; 02/09/2026 là lễ
const ctx = { base: D('2026-06-29'), mode: 'work', H: new Set(['2026-09-02']) };
// giống computeSchedule(): mốc → I (SX, không việc con) → II (2 việc) → III
const rows0 = [
  { id: '0', name: 'MỐC', ph: 'M', sec: true, days: '–' },
  { id: 'I', name: 'SẢN XUẤT', ph: 'P', sec: true, days: 3 },
  { id: 'II', name: 'LẮP ĐẶT', ph: 'I', sec: true, days: 5 },
  { id: '1', name: 'Bước 1', ph: 'I', sec: false, days: 2 },
  { id: '2', name: 'Bước 2', ph: 'I', sec: false, days: 3 },
  { id: 'III', name: 'BÀN GIAO', ph: 'H', sec: true, days: 1 },
];

test('lịch làm việc: bỏ T7, CN, lễ; đếm và dời ngày', () => {
  const C = G.cal('work', new Set(['2026-09-02']));
  assert.equal(I(C.nextStart(D('2026-07-03'))), '2026-07-06');       // T6 → T2
  assert.equal(I(C.end(D('2026-07-01'), 3)), '2026-07-03');
  assert.equal(I(C.end(D('2026-09-01'), 2)), '2026-09-03');           // qua ngày lễ
  assert.equal(C.count(D('2026-07-01'), D('2026-07-07')), 5);
  assert.equal(I(C.shift(D('2026-07-06'), -1)), '2026-07-03');
  const K = G.cal('cal', []);
  assert.equal(I(K.end(D('2026-07-03'), 3)), '2026-07-05');           // ngày lịch: tính cả T7, CN
});

test('tạo từ bảng tự sinh: dòng nối tiếp, nhóm có việc con là dòng tổng hợp, đánh số I / II.1', () => {
  const items = G.fromRows(rows0);
  assert.deepEqual(items.map(x => x.kind), ['base', 'group', 'group', 'task', 'task', 'group']);
  const R = G.compute(items, ctx);
  const by = Object.fromEntries(R.rows.map(r => [r.id, r]));
  assert.deepEqual(R.rows.map(r => r.id), ['0', 'I', 'II', 'II.1', 'II.2', 'III']);
  assert.equal(I(by.I.s), '2026-06-30'); assert.equal(I(by.I.e), '2026-07-02');
  assert.equal(I(by['II.1'].s), '2026-07-03'); assert.equal(I(by['II.1'].e), '2026-07-06');
  assert.equal(I(by['II.2'].e), '2026-07-09');
  assert.equal(by.II.summary, true); assert.equal(I(by.II.s), '2026-07-03'); assert.equal(I(by.II.e), '2026-07-09'); assert.equal(by.II.days, 5);
  assert.equal(I(by.III.s), '2026-07-10'); assert.equal(I(R.end), '2026-07-10');
  assert.equal(R.total, 9);
});

test('kéo dời việc nối tiếp → lag, các việc sau tự dời theo; đổi số ngày; ngày kết thúc', () => {
  let items = G.fromRows(rows0);
  const u = (id) => G.compute(items, ctx).rows.find(r => r.id === id).uid;
  items = G.setStart(items, u('II.1'), '2026-07-08', ctx);             // dời sau 3 ngày làm việc
  let by = Object.fromEntries(G.compute(items, ctx).rows.map(r => [r.id, r]));
  assert.equal(by['II.1'].lag, 3); assert.equal(I(by['II.1'].s), '2026-07-08');
  assert.equal(I(by['II.2'].s), '2026-07-10'); assert.equal(I(by.III.s), '2026-07-15');
  items = G.setStart(items, u('II.1'), '2026-07-01', ctx);             // kéo lùi: gối đầu với giai đoạn I
  by = Object.fromEntries(G.compute(items, ctx).rows.map(r => [r.id, r]));
  assert.equal(by['II.1'].lag, -2); assert.equal(I(by['II.1'].s), '2026-07-01');
  items = G.setDays(items, u('II.2'), 6);
  items = G.setEnd(items, u('II.1'), '2026-07-03', ctx);
  by = Object.fromEntries(G.compute(items, ctx).rows.map(r => [r.id, r]));
  assert.equal(by['II.1'].days, 3); assert.equal(by['II.2'].days, 6);
  assert.equal(I(by['II.2'].s), '2026-07-06'); assert.equal(I(by['II.2'].e), '2026-07-13');
});

test('việc cố định ngày (bỏ nối tiếp) không dời theo; bật lại nối tiếp giữ nguyên vị trí', () => {
  let items = G.fromRows(rows0);
  const u = (id) => G.compute(items, ctx).rows.find(r => r.id === id).uid;
  const id3 = u('III');
  items = G.setLink(items, id3, false, ctx);
  items = G.setStart(items, id3, '2026-07-25', ctx);                   // T7 → dồn sang T2
  items = G.setDays(items, u('II.2'), 10);
  let r3 = G.compute(items, ctx).rows.find(r => r.id === 'III');
  assert.equal(r3.link, false); assert.equal(I(r3.s), '2026-07-27');
  items = G.setLink(items, id3, true, ctx);
  r3 = G.compute(items, ctx).rows.find(r => r.id === 'III');
  assert.equal(r3.link, true); assert.equal(I(r3.s), '2026-07-27');
});

test('thêm / xoá / đổi thứ tự dòng, mốc ◆; đánh số lại', () => {
  let items = G.fromRows(rows0);
  const R0 = G.compute(items, ctx).rows;
  let r = G.insert(items, R0.find(x => x.id === 'II.2').uid, 'task', ctx); items = r.items;
  r = G.insert(items, r.uid, 'ms', ctx); items = r.items;
  let R = G.compute(items, ctx).rows;
  assert.deepEqual(R.map(x => x.id), ['0', 'I', 'II', 'II.1', 'II.2', 'II.3', 'II.4', 'III']);
  const ms = R.find(x => x.id === 'II.4');
  assert.equal(ms.kind, 'ms'); assert.equal(ms.days, '–'); assert.equal(I(ms.s), I(R.find(x => x.id === 'II.3').e));
  r = G.insert(items, R.find(x => x.id === 'III').uid, 'group', ctx); items = r.items;
  R = G.compute(items, ctx).rows; assert.equal(R[R.length - 1].id, 'IV');
  items = G.remove(items, R.find(x => x.id === 'II.1').uid);
  items = G.remove(items, R[0].uid);                                   // mốc khởi tính: không xoá được
  R = G.compute(items, ctx).rows; assert.equal(R[0].kind, 'base'); assert.equal(R.filter(x => /^II\./.test(x.id)).length, 3);
  items = G.move(items, R.find(x => x.id === 'III').uid, 0);          // không vượt lên trên mốc
  R = G.compute(items, ctx).rows; assert.equal(R[0].kind, 'base'); assert.equal(R[1].name, 'BÀN GIAO');
  assert.deepEqual(R.slice(0, 3).map(x => x.id), ['0', 'I', 'II']);
});

test('nhóm hết việc con trở lại thành 1 công việc; ngày lịch', () => {
  let items = G.fromRows(rows0);
  const R = G.compute(items, ctx).rows;
  items = G.remove(G.remove(items, R[3].uid), R[4].uid);
  const II = G.compute(items, ctx).rows.find(x => x.id === 'II');
  assert.equal(II.summary, undefined); assert.equal(II.days, 5);
  const C2 = G.compute(G.fromRows(rows0), { ...ctx, mode: 'cal' });
  assert.equal(I(C2.end), '2026-07-08');
});
