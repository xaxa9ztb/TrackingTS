// Thu nhập dự kiến (tools/timesheet/income.js). Chạy: npm run test:client
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const I = require('../../tools/timesheet/income.js');
const Labor = require('../../tools/timesheet/labor.js');

test('tỷ lệ OT khớp LaborVN.OT_RATES', () => {
  Object.keys(I.RATES).forEach(k => assert.equal(I.RATES[k], Labor.OT_RATES[k], k));
});

test('compute: lương giờ = lương ÷ 26 ÷ 8; OT theo tỷ lệ; cộng trợ cấp xe; trừ nghỉ không lương', () => {
  const entries = [
    { date: '2026-11-02', activityCode: '1110', bd: { NORMAL: 8, OT1: 2 } },
    { date: '2026-11-03', activityCode: '1110', bd: { OT1: 1, OT2: 4 } },
    { date: '2026-11-04', activityCode: '6090', bd: {} },
    { date: '2026-11-04', activityCode: '6090', bd: {} },          // trùng ngày → 1 ngày
    { date: '2026-11-05', activityCode: '6010', bd: { NORMAL: 8 } },
  ];
  const c = I.compute({ base: 20800000, entries, bdOf: e => e.bd, allowance: 180000 });
  assert.equal(c.hourly, 100000);                         // 20.800.000 / 26 / 8
  assert.deepEqual(c.ot.map(x => [x.cat, x.hours, x.amount]), [['OT1', 3, 450000], ['OT2', 4, 800000]]);
  assert.equal(c.otPay, 1250000); assert.equal(c.otHours, 7);
  assert.equal(c.unpaidDays, 1); assert.equal(c.deduction, 800000);
  assert.equal(c.total, 20800000 - 800000 + 1250000 + 180000);
});

test('compute: chưa nhập lương → chỉ còn trợ cấp; dữ liệu rỗng / sai không lỗi', () => {
  assert.equal(I.compute({ base: 0, entries: [{ date: 'x', activityCode: '1110', bd: { OT1: 2 } }], bdOf: e => e.bd, allowance: 60000 }).total, 60000);
  assert.equal(I.compute({ base: 'abc', entries: [null, {}], bdOf: () => null, allowance: -5 }).total, 0);
});

test('parseMoney / fmtMoney', () => {
  assert.equal(I.parseMoney('12.500.000 đ'), 12500000); assert.equal(I.parseMoney(''), 0); assert.equal(I.parseMoney('99999999999999'), 9e9);
  assert.equal(I.fmtMoney(1250000).replace(/\s/g, ''), '1.250.000');
});
