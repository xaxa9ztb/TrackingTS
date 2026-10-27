// Kiểm thử nhận diện / trích số chứng từ hàng hoá (tools/tiendotm/chungtu.js) trên văn bản mô phỏng OCR.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const CT = require('../../tools/tiendotm/chungtu.js');

const HBL = `HOUSE BILL OF LADING
SHIPPER: SCHINDLER (CHINA) ELEVATOR CO., LTD
CONSIGNEE: SCHINDLER VIETNAM
B/L NO.: SZXHAN26031234
PORT OF LOADING: SHEKOU    PORT OF DISCHARGE: HAIPHONG
SHIPPED ON BOARD DATE: 12 JAN 2026
DATE OF ISSUE: 15 JAN 2026`;

const PL = `PACKING LIST
Packing List No.: PL-2026-0158        Date: 10/01/2026
Invoice No: INV123456
TOTAL: 48 PACKAGES
GROSS WEIGHT 12,450 KGS`;

const CO = `CERTIFICATE OF ORIGIN
Form E
Reference No. E262400123456789
Country of origin: CHINA
Date: 2026-01-09`;

const CQ = `CERTIFICATE OF QUALITY
Certificate No.: QC/2026/00771
Date of issue: 08.01.2026
Product: Elevator components`;

test('nhận diện đúng loại chứng từ từ nội dung', () => {
  assert.equal(CT.detect(HBL, 'scan1.pdf'), 'hbl');
  assert.equal(CT.detect(PL, 'scan2.pdf'), 'pl');
  assert.equal(CT.detect(CO, 'scan3.pdf'), 'co');
  assert.equal(CT.detect(CQ, 'scan4.pdf'), 'cq');
});

test('nhận diện theo tên file khi nội dung ít chữ', () => {
  assert.equal(CT.detect('', 'HBL_SZX.pdf'), 'hbl');
  assert.equal(CT.detect('', 'Packing-list.jpg'), 'pl');
  assert.equal(CT.detect('', 'CO form E.pdf'), 'co');
  assert.equal(CT.detect('', 'CQ.pdf'), 'cq');
  assert.equal(CT.detect('xin chao', 'abc.pdf'), null);
});

test('HBL: lấy số vận đơn và ngày cấp', () => {
  const r = CT.extract('hbl', HBL);
  assert.equal(r.so, 'SZXHAN26031234');
  assert.equal(r.ngay, '2026-01-15');
});

test('Packing List: lấy số, ngày, số kiện', () => {
  const r = CT.extract('pl', PL);
  assert.equal(r.so, 'PL-2026-0158');
  assert.equal(r.ngay, '2026-01-10');
  assert.equal(r.kien, '48');
});

test('C/O: lấy số tham chiếu, ngày, nước xuất xứ', () => {
  const r = CT.extract('co', CO);
  assert.equal(r.so, 'E262400123456789');
  assert.equal(r.ngay, '2026-01-09');
  assert.equal(r.xuatxu, 'Trung Quốc');
});

test('C/Q: lấy số chứng nhận và ngày', () => {
  const r = CT.extract('cq', CQ);
  assert.equal(r.so, 'QC/2026/00771');
  assert.equal(r.ngay, '2026-01-08');
});

test('ngày: nhiều định dạng', () => {
  assert.equal(CT.findDate('Date: 05/02/2026'), '2026-02-05');
  assert.equal(CT.findDate('issued 5 Feb 2026'), '2026-02-05');
  assert.equal(CT.findDate('FEB 5, 2026'), '2026-02-05');
  assert.equal(CT.findDate('2026-02-05'), '2026-02-05');
  assert.equal(CT.findDate('ngày 31/13/2026'), '');
});

test('không bịa số khi không có nhãn / không có chữ số', () => {
  assert.equal(CT.extract('hbl', 'BILL OF LADING\nB/L NO.: ABCDE').so, '');
  assert.equal(CT.extract('pl', 'PACKING LIST\nnothing here').so, '');
});

test('có dấu tiếng Việt cũng nhận diện được', () => {
  assert.equal(CT.detect('GIẤY CHỨNG NHẬN XUẤT XỨ\nSố: 12345', 'a.pdf'), 'co');
  assert.equal(CT.detect('DANH MỤC ĐÓNG GÓI', 'a.pdf'), 'pl');
});
