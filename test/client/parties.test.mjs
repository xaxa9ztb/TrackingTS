// Hồ sơ Dự án — nhận diện Chủ đầu tư (Bên Mua / Bên Giao thầu / Bên A) và Nhà thầu trong hợp đồng. Dữ liệu GIẢ.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const H = require('../../tools/tiendotm/parties.js');
const PRE = 'CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM\nHỢP ĐỒNG THI CÔNG LẮP ĐẶT THANG MÁY\nSố: 12/2026/HĐTC\n- Căn cứ Luật Xây dựng;\n- Căn cứ nhu cầu của Chủ đầu tư Công ty CP Sai Lầm về dự án;\nHôm nay, ngày 05 tháng 11 năm 2026, chúng tôi gồm:\n';
const TAIL = '\nĐIỀU 1: NỘI DUNG CÔNG VIỆC\nBên A giao cho Bên B thi công. Chủ đầu tư nghiệm thu…\n';

test('Bên Giao thầu (gọi tắt là Bên A) / Bên Nhận thầu — nhãn đầu khối', () => {
  const t = PRE + 'BÊN GIAO THẦU (gọi tắt là Bên A): CÔNG TY CỔ PHẦN BẤT ĐỘNG SẢN MẪU\nĐịa chỉ: 12 Đường Số 1, Quận 1, TP.HCM\nĐại diện: Ông Trần Văn Chủ   Chức vụ: Tổng Giám đốc\nTài khoản: 0123456789\n' +
    'BÊN NHẬN THẦU (gọi tắt là Bên B): CHI NHÁNH CÔNG TY TNHH SCHINDLER VIỆT NAM TẠI HÀ NỘI\nĐịa chỉ: Hà Nội' + TAIL;
  const r = H.parse(t);
  assert.equal(r.style, 'A');
  assert.equal(r.owner.name, 'CÔNG TY CỔ PHẦN BẤT ĐỘNG SẢN MẪU');
  assert.equal(r.owner.rep, 'Trần Văn Chủ');
  assert.equal(r.owner.addr, '12 Đường Số 1, Quận 1, TP.HCM');
  assert.match(r.contractor.name, /SCHINDLER/);
});

test('Bên Mua / Bên Bán, tên ở dòng sau nhãn', () => {
  const t = PRE + 'BÊN MUA:\nCÔNG TY TNHH ĐẦU TƯ GAMMA\nĐịa chỉ: Quận 3\nBÊN BÁN:\nCÔNG TY TNHH SCHINDLER VIỆT NAM' + TAIL;
  const r = H.parse(t);
  assert.equal(r.owner.name, 'CÔNG TY TNHH ĐẦU TƯ GAMMA'); assert.match(r.contractor.name, /SCHINDLER/);
});

test('Bên A / Bên B có số thứ tự, "Tên công ty:" trong khối', () => {
  const t = PRE + '1. BÊN A (CHỦ ĐẦU TƯ):\nTên công ty: Ban Quản lý dự án Đầu tư Xây dựng Quận 7\nĐịa chỉ: Quận 7\n2. BÊN B (NHÀ THẦU):\nTên công ty: Công ty TNHH Thang máy Giả' + TAIL;
  const r = H.parse(t);
  assert.equal(r.owner.name, 'Ban Quản lý dự án Đầu tư Xây dựng Quận 7'); assert.equal(r.contractor.name, 'Công ty TNHH Thang máy Giả');
});

test('bố cục B: chi tiết trước, cuối khối "(dưới đây gọi là Bên Giao thầu)"', () => {
  const t = PRE + 'CÔNG TY CỔ PHẦN DELTA\nĐịa chỉ: 9 Đường X\nĐại diện: Bà Lê Thị Đại\n(dưới đây gọi là “Bên Giao thầu”)\nvà\nCÔNG TY TNHH SCHINDLER VIỆT NAM\nĐịa chỉ: TP.HCM\n(dưới đây gọi là “Bên Nhận thầu”)' + TAIL;
  const r = H.parse(t);
  assert.equal(r.style, 'B'); assert.equal(r.owner.name, 'CÔNG TY CỔ PHẦN DELTA'); assert.equal(r.owner.rep, 'Lê Thị Đại'); assert.match(r.contractor.name, /SCHINDLER/);
});

test('không bắt nhầm "Chủ đầu tư" ở phần căn cứ; bỏ đuôi "(sau đây gọi là Bên A)"', () => {
  const t = PRE + 'BÊN MUA: CÔNG TY TNHH EPSILON (sau đây gọi là Bên A)\nĐịa chỉ: Hà Nội\nBÊN BÁN: CÔNG TY TNHH SCHINDLER VIỆT NAM (sau đây gọi là Bên B)' + TAIL;
  const r = H.parse(t);
  assert.equal(r.owner.name, 'CÔNG TY TNHH EPSILON'); assert.equal(r.contractor.name, 'CÔNG TY TNHH SCHINDLER VIỆT NAM');
});

test('đảo khối nhầm: Schindler không bao giờ là chủ đầu tư', () => {
  const t = PRE + 'BÊN A: CÔNG TY TNHH SCHINDLER VIỆT NAM\nBÊN B: CÔNG TY CP ZETA' + TAIL;
  const r = H.parse(t);
  assert.equal(r.owner.name, 'CÔNG TY CP ZETA'); assert.match(r.contractor.name, /SCHINDLER/);
});
