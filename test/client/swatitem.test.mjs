// js/swatitem.js · countsForSwat: giờ tính SWAT / thưởng lắp đặt không gồm mã 1194 (NI Quality Hour — lỗi chất lượng)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const S = require('../../js/swatitem.js');

test('countsForSwat: bỏ 1194 (kể cả có khoảng trắng / chữ phía sau), giữ các mã khác', () => {
  assert.deepEqual(['1110', '1194', ' 1194 ', '1194 - NI Quality', 1194, '1193', '5090', '', null].map(a => S.countsForSwat({ activities: a })),
    [true, false, false, false, false, true, true, true, true]);
});

test('toToolItem: truyền Swat Hour Target đã xác nhận để công cụ cảnh báo khi lệch định mức đang tính', () => {
  const base = { wbs: '11847104', projectName: 'X', productLine: 'S3300', specs: {} };
  assert.equal(S.toToolItem({ ...base, targetSwat: true, swatTargetHour: 256.1 }, 0).target, 256.1);
  assert.equal(S.toToolItem({ ...base, targetSwat: false, swatTargetHour: 256.1 }, 0).target, null, 'chưa xác nhận → không so');
  assert.equal(S.toToolItem({ ...base, targetSwat: true }, 0).target, null);
});
